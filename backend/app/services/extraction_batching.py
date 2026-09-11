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
        for piece in split_text(seg["text"], max_unit_chars, overlap=0):
            units.append(
                {"text": piece, "page_number": seg.get("page_number"), "heading": seg.get("heading")}
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
    parts = []
    for i, u in enumerate(units, start=1):
        if u.get("page_number"):
            loc = f"page {u['page_number']}"
        elif u.get("heading"):
            loc = u["heading"]
        else:
            loc = f"excerpt {i}"
        parts.append(f"[Excerpt {i} — {loc}]\n{u['text']}")
    return "\n\n".join(parts)
