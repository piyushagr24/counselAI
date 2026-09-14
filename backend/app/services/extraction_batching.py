"""Shared helpers for batching extracted segments into LLM-sized, labeled
prompts. Used by obligation and deadline extraction. No overlap is used here
(unlike RAG chunking) so batches never contain duplicated text, which would
otherwise cause duplicate extracted obligations/dates.
"""
from typing import Any, Dict, List

from app.services.chunking import split_text


def atomize_segments(segments: List[Dict[str, Any]], max_unit_chars: int) -> List[Dict[str, Any]]:
    """Split any oversized segment into smaller pieces, keeping page/heading attached."""
    units = []
    for seg in segments:
        p_num = seg.get("page_number") or 1
        for piece in split_text(seg["text"], max_unit_chars, overlap=0):
            units.append(
                {"text": piece, "page_number": p_num, "heading": seg.get("heading")}
            )
    return units


def pack_batches(units: List[Dict[str, Any]], max_batch_chars: int) -> List[List[Dict[str, Any]]]:
    """Greedily group units under a character budget to minimize LLM calls."""
    batches, current, current_len = [], [], 0
    for u in units:
        if current and current_len + len(u["text"]) > max_batch_chars:
            batches.append(current)
            current, current_len = [], 0
        current.append(u)
        current_len += len(u["text"])
    if current:
        batches.append(current)
    return batches


def label_batch(units: List[Dict[str, Any]]) -> str:
    """Format units into clearly labeled excerpts for LLM prompts.
    Explicitly tags 'Page: X' so models never confuse excerpt indices with page numbers.
    """
    parts = []
    for i, u in enumerate(units, start=1):
        p_num = u.get("page_number") or 1
        page_tag = f"Page: {p_num}"
        heading_tag = f" | Section: {u['heading']}" if u.get("heading") else ""
        parts.append(f"[Excerpt {i} | {page_tag}{heading_tag}]\n{u['text']}")
    return "\n\n".join(parts)


def resolve_item_location(
    item_page: Any,
    item_section: Any,
    text_snippet: str,
    batch: List[Dict[str, Any]],
    total_pages: Any = None,
) -> tuple[int, Any]:
    """Ground and resolve the exact page number and heading for an extracted item.
    Guarantees that excerpt/chunk indices are never mistaken for contract page numbers.
    """
    if not batch:
        return item_page or 1, item_section

    batch_pages = {u.get("page_number") for u in batch if u.get("page_number") is not None}
    primary_page = batch[0].get("page_number") or 1

    # 1. Evidence text matching: exact or substring match against batch units
    if text_snippet:
        clean_snip = "".join(c for c in text_snippet.lower() if c.isalnum())
        if len(clean_snip) >= 20:
            prefix = clean_snip[:60]
            for u in batch:
                clean_u = "".join(c for c in u["text"].lower() if c.isalnum())
                if prefix in clean_u:
                    u_page = u.get("page_number") or primary_page
                    u_sec = u.get("heading") or item_section
                    return u_page, u_sec

    # 2. Check if item_page was actually a 1-based excerpt index in the batch
    try:
        page_val = int(item_page) if item_page is not None else None
    except (ValueError, TypeError):
        page_val = None

    if page_val is not None:
        # If the returned number matches a unit index (1..len(batch)) but is NOT an actual page in batch
        if 1 <= page_val <= len(batch) and page_val not in batch_pages:
            mapped_unit = batch[page_val - 1]
            return mapped_unit.get("page_number") or primary_page, mapped_unit.get("heading") or item_section

        # If total_pages is known and page_val exceeds total document pages, it's an excerpt/chunk index
        try:
            tot = int(total_pages) if total_pages is not None else None
        except (ValueError, TypeError):
            tot = None

        if tot is not None and tot > 0 and page_val > tot:
            if 1 <= page_val <= len(batch):
                mapped_unit = batch[page_val - 1]
                return mapped_unit.get("page_number") or primary_page, mapped_unit.get("heading") or item_section
            return min(tot, primary_page), item_section

        if page_val in batch_pages:
            return page_val, item_section

        if tot is not None and 1 <= page_val <= tot:
            return page_val, item_section

    return primary_page, item_section

