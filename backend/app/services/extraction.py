"""Text extraction for uploaded contracts. No AI here — pure parsing."""
import math
import pymupdf
import docx
from docx.text.paragraph import Paragraph
from docx.table import Table
from fastapi import HTTPException

SUPPORTED_EXTS = {".pdf", ".docx"}


def _finalize(full_text: str, segments: list[dict], metadata: dict) -> dict:
    words = full_text.split()
    metadata["char_count"] = len(full_text)
    metadata["word_count"] = len(words)
    metadata["num_segments"] = len(segments)
    metadata["estimated_reading_time_mins"] = max(1, math.ceil(len(words) / 200))
    return {"full_text": full_text, "segments": segments, "metadata": metadata}


def extract_pdf(path: str) -> dict:
    try:
        pdf = pymupdf.open(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not open PDF: {e}")

    if pdf.page_count == 0:
        pdf.close()
        raise HTTPException(status_code=422, detail="PDF has no pages.")

    segments, full_text_parts = [], []
    table_count = 0
    segment_idx = 0

    for page_num, page in enumerate(pdf, start=1):
        # Extract blocks sorted in natural reading order
        blocks = page.get_text("blocks")
        page_text_blocks = []

        for b in blocks:
            # b = (x0, y0, x1, y1, text, block_no, block_type)
            if len(b) >= 5 and b[4]:
                b_text = b[4].strip()
                if b_text:
                    page_text_blocks.append(b_text)

        if not page_text_blocks:
            # Fallback to plain text if blocks returned nothing
            raw_text = page.get_text("text").strip()
            if raw_text:
                page_text_blocks.append(raw_text)

        if page_text_blocks:
            page_full_text = "\n\n".join(page_text_blocks)
            segment_idx += 1
            segments.append({
                "index": segment_idx,
                "page_number": page_num,
                "heading": None,
                "text": page_full_text,
            })
            full_text_parts.append(page_full_text)

    metadata = {
        "source_type": "pdf",
        "num_pages": pdf.page_count,
        "table_count": table_count,
    }
    pdf.close()
    full_text = "\n\n".join(t for t in full_text_parts if t).strip()

    if not full_text:
        raise HTTPException(status_code=422, detail="No extractable text found (scanned/image-only PDF?).")

    return _finalize(full_text, segments, metadata)


def _format_table_as_markdown(table: Table) -> str:
    """Format a python-docx Table into clean Markdown table rows."""
    rows_text = []
    for row in table.rows:
        cells = [c.text.strip().replace("\n", " ") for c in row.cells]
        if any(cells):
            rows_text.append("| " + " | ".join(cells) + " |")

    if not rows_text:
        return ""

    if len(rows_text) >= 1:
        col_count = len(table.rows[0].cells)
        divider = "| " + " | ".join(["---"] * col_count) + " |"
        rows_text.insert(1, divider)

    return "\n".join(rows_text)


def extract_docx(path: str) -> dict:
    try:
        document = docx.Document(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not open DOCX: {e}")

    segments, full_text_parts, idx = [], [], 0
    pending_heading = None
    pending_heading_text = None
    table_count = 0

    # Traverse document body elements to preserve paragraph and table sequence
    for child in document.element.body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if tag == "p":
            para = Paragraph(child, document)
            text = para.text.strip()
            if not text:
                continue
            heading = (
                para.style.name
                if para.style and para.style.name.lower().startswith("heading")
                else None
            )
            if heading:
                pending_heading = heading
                pending_heading_text = text
                continue

            idx += 1
            segments.append({"index": idx, "page_number": None, "heading": pending_heading, "text": text})
            full_text_parts.append(f"{pending_heading_text}\n{text}" if pending_heading_text else text)
            pending_heading = None
            pending_heading_text = None

        elif tag == "tbl":
            table_count += 1
            tbl = Table(child, document)
            tbl_text = _format_table_as_markdown(tbl)
            if tbl_text:
                idx += 1
                heading = pending_heading or "Table"
                segments.append({"index": idx, "page_number": None, "heading": heading, "text": tbl_text})
                full_text_parts.append(f"{pending_heading_text}\n{tbl_text}" if pending_heading_text else tbl_text)
                pending_heading = None
                pending_heading_text = None

    if pending_heading:
        idx += 1
        segments.append({"index": idx, "page_number": None, "heading": pending_heading, "text": pending_heading_text or ""})
        full_text_parts.append(pending_heading_text or "")

    metadata = {
        "source_type": "docx",
        "num_pages": None,
        "table_count": table_count,
    }
    full_text = "\n\n".join(full_text_parts).strip()

    if not full_text:
        raise HTTPException(status_code=422, detail="No extractable text found in DOCX.")

    return _finalize(full_text, segments, metadata)


def extract_text(path: str, ext: str) -> dict:
    if ext == ".pdf":
        return extract_pdf(path)
    if ext == ".docx":
        return extract_docx(path)
    raise HTTPException(status_code=400, detail=f"Extraction not supported for '{ext}'")
