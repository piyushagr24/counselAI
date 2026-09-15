"""Shared helpers for batching extracted segments into LLM-sized, labeled
prompts. Used by obligation and deadline extraction. No overlap is used here
(unlike RAG chunking) so batches never contain duplicated text, which would
otherwise cause duplicate extracted obligations/dates.
"""
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.chunking import split_text

_STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me",
    "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd",
    "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
    "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
    "yourselves", "shall", "will", "may", "must", "party", "parties", "agreement"
}


def atomize_segments(segments: List[Dict[str, Any]], max_unit_chars: int = 1200) -> List[Dict[str, Any]]:
    """Split any oversized segment into smaller pieces, keeping page/heading attached."""
    units = []
    for seg in segments:
        p_num = seg.get("page_number") or 1
        for piece in split_text(seg["text"], max_unit_chars, overlap=0):
            units.append(
                {"text": piece, "page_number": p_num, "heading": seg.get("heading")}
            )
    return units


def pack_batches(units: List[Dict[str, Any]], max_batch_chars: int = 4500) -> List[List[Dict[str, Any]]]:
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


def _extract_keywords(text: str) -> Set[str]:
    words = re.findall(r'[a-zA-Z0-9_\$₹€£]+', text.lower())
    return {w for w in words if len(w) > 1 and w not in _STOPWORDS}


def resolve_item_location(
    item_page: Any,
    item_section: Any,
    text_snippet: str,
    batch: List[Dict[str, Any]],
    total_pages: Any = None,
    excerpt_id: Any = None,
) -> Tuple[int, Any]:
    """Ground and resolve the exact page number and heading for an extracted item.
    Guarantees that excerpt/chunk indices are never mistaken for contract page numbers.
    """
    if not batch:
        try:
            return int(item_page) if item_page else 1, item_section
        except (ValueError, TypeError):
            return 1, item_section

    primary_page = batch[0].get("page_number") or 1
    batch_pages = {u.get("page_number") for u in batch if u.get("page_number") is not None}

    # 1. Direct excerpt_id mapping if explicitly provided by the model
    try:
        ex_val = int(excerpt_id) if excerpt_id is not None else None
    except (ValueError, TypeError):
        ex_val = None

    if ex_val is not None and 1 <= ex_val <= len(batch):
        mapped = batch[ex_val - 1]
        return mapped.get("page_number") or primary_page, mapped.get("heading") or item_section

    # 2. Token overlap and substring evidence matching
    if text_snippet:
        clean_snip = "".join(c for c in text_snippet.lower() if c.isalnum())
        if len(clean_snip) >= 15:
            prefix = clean_snip[:50]
            for u in batch:
                clean_u = "".join(c for c in u["text"].lower() if c.isalnum())
                if prefix in clean_u:
                    return u.get("page_number") or primary_page, u.get("heading") or item_section

        snip_keywords = _extract_keywords(text_snippet)
        if snip_keywords:
            best_unit = None
            best_score = 0
            for u in batch:
                u_keywords = _extract_keywords(u["text"])
                overlap = len(snip_keywords & u_keywords)
                if overlap > best_score:
                    best_score = overlap
                    best_unit = u

            if best_unit is not None and (
                best_score >= 2 or (len(snip_keywords) > 0 and (best_score / len(snip_keywords)) >= 0.3)
            ):
                return best_unit.get("page_number") or primary_page, best_unit.get("heading") or item_section

    # 3. Disambiguate item_page vs excerpt index
    try:
        page_val = int(item_page) if item_page is not None else None
    except (ValueError, TypeError):
        page_val = None

    if page_val is not None:
        # If the returned number matches a 1-based unit index in batch (e.g. LLM used Excerpt index as page_number)
        if 1 <= page_val <= len(batch):
            candidate_unit = batch[page_val - 1]
            candidate_page = candidate_unit.get("page_number") or primary_page

            if page_val not in batch_pages:
                return candidate_page, candidate_unit.get("heading") or item_section

            if text_snippet:
                cand_keywords = _extract_keywords(candidate_unit["text"])
                snip_keywords = _extract_keywords(text_snippet)
                if len(snip_keywords & cand_keywords) >= 1:
                    return candidate_page, candidate_unit.get("heading") or item_section

        try:
            tot = int(total_pages) if total_pages is not None else None
        except (ValueError, TypeError):
            tot = None

        if tot is not None and tot > 0:
            if 1 <= page_val <= tot:
                return page_val, item_section
            if 1 <= page_val <= len(batch):
                mapped = batch[page_val - 1]
                return mapped.get("page_number") or primary_page, mapped.get("heading") or item_section
            return min(tot, primary_page), item_section

        if page_val in batch_pages:
            return page_val, item_section

    return primary_page, item_section

