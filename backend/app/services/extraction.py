"""Text extraction for uploaded contracts. No AI here — pure parsing."""
import math
import zipfile
import xml.etree.ElementTree as ET
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


def _estimate_docx_pages(path: str, word_count: int, para_count: int = 0) -> int:
    """Extract page count from DOCX extended properties or estimate from word/para count."""
    pages_from_props = None
    explicit_breaks = 0
    try:
        with zipfile.ZipFile(path) as z:
            if "docProps/app.xml" in z.namelist():
                app_xml = z.read("docProps/app.xml")
                root = ET.fromstring(app_xml)
                pages_el = root.find("{http://schemas.openxmlformats.org/officeDocument/2006/extended-properties}Pages")
                if pages_el is not None and pages_el.text:
                    try:
                        p = int(pages_el.text.strip())
                        if p > 0:
                            pages_from_props = p
                    except ValueError:
                        pass

            if "word/document.xml" in z.namelist():
                doc_xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
                explicit_breaks = doc_xml.count('w:type="page"') + doc_xml.count("w:lastRenderedPageBreak")
    except Exception:
        pass

    # Typical commercial/legal contracts average ~200-250 words per printed page
    # (accounting for 1-inch margins, 1.15-1.5 line spacing, headings, and signature blocks)
    est_from_words = max(1, math.ceil(word_count / 220)) if word_count > 0 else 1
    est_from_paras = max(1, math.ceil(para_count / 14)) if para_count > 0 else 1
    density_est = max(est_from_words, est_from_paras)

    if explicit_breaks > 0:
        return max(explicit_breaks + 1, pages_from_props or 1, density_est)

    if pages_from_props is not None and pages_from_props > 1:
        return max(pages_from_props, density_est)

    return density_est


def extract_docx(path: str) -> dict:
    try:
        document = docx.Document(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not open DOCX: {e}")

    segments, full_text_parts, idx = [], [], 0
    pending_heading = None
    pending_heading_text = None
    table_count = 0

    raw_segments = []
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

            xml = para._p.xml if hasattr(para, "_p") and para._p is not None else ""
            has_break = ('lastRenderedPageBreak' in xml) or ('w:type="page"' in xml)

            # Subdivide paragraphs containing multiple clauses or lines separated by newlines
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            if len(lines) > 1:
                for line_idx, line in enumerate(lines):
                    is_sub_heading = any(line.lower().startswith(pfx) for pfx in [
                        "clause ", "section ", "article ", "schedule ", "annexure", "now this agreement", "in witness"
                    ])
                    cur_heading = (pending_heading if line_idx == 0 else None)
                    if is_sub_heading and not cur_heading:
                        cur_heading = "Clause"
                    raw_segments.append({
                        "heading": cur_heading,
                        "heading_text": pending_heading_text if line_idx == 0 else None,
                        "text": line,
                        "has_break": has_break if line_idx == 0 else False,
                        "words": len(line.split()),
                    })
            else:
                raw_segments.append({
                    "heading": pending_heading,
                    "heading_text": pending_heading_text,
                    "text": text,
                    "has_break": has_break,
                    "words": len(text.split()),
                })
            pending_heading = None
            pending_heading_text = None

        elif tag == "tbl":
            table_count += 1
            tbl = Table(child, document)
            tbl_text = _format_table_as_markdown(tbl)
            if tbl_text:
                heading = pending_heading or "Table"
                xml = tbl._tbl.xml if hasattr(tbl, "_tbl") and tbl._tbl is not None else ""
                has_break = ('lastRenderedPageBreak' in xml) or ('w:type="page"' in xml)
                raw_segments.append({
                    "heading": heading,
                    "heading_text": pending_heading_text,
                    "text": tbl_text,
                    "has_break": has_break,
                    "words": len(tbl_text.split()),
                })
                pending_heading = None
                pending_heading_text = None

    if pending_heading and pending_heading_text:
        raw_segments.append({
            "heading": pending_heading,
            "heading_text": None,
            "text": pending_heading_text,
            "has_break": False,
            "words": len(pending_heading_text.split()),
        })

    full_text_parts = [
        f"{s['heading_text']}\n{s['text']}" if s.get("heading_text") else s["text"]
        for s in raw_segments
    ]
    full_text = "\n\n".join(full_text_parts).strip()

    if not full_text:
        raise HTTPException(status_code=422, detail="No extractable text found in DOCX.")

    words = full_text.split()
    total_words = len(words)
    num_pages = _estimate_docx_pages(path, total_words, para_count=len(raw_segments))

    words_per_page = max(60, math.ceil(total_words / max(1, num_pages)))
    current_page = 1
    cum_words = 0

    segments = []
    for idx, s in enumerate(raw_segments, start=1):
        if s.get("has_break") and idx > 1:
            current_page = min(num_pages, current_page + 1)

        mid_words = cum_words + (s["words"] // 2)
        page_by_words = min(num_pages, max(1, (mid_words // words_per_page) + 1))
        current_page = min(num_pages, max(current_page, page_by_words))

        segments.append({
            "index": idx,
            "page_number": current_page,
            "heading": s["heading"],
            "text": s["text"],
        })
        cum_words += s["words"]

    metadata = {
        "source_type": "docx",
        "num_pages": num_pages,
        "table_count": table_count,
    }

    return _finalize(full_text, segments, metadata)


def extract_text(path: str, ext: str) -> dict:
    if ext == ".pdf":
        return extract_pdf(path)
    if ext == ".docx":
        return extract_docx(path)
    raise HTTPException(status_code=400, detail=f"Extraction not supported for '{ext}'")
