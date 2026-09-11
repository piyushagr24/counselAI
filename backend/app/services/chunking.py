"""Split extracted segments (PDF pages / DOCX sections) into overlapping chunks.

Each segment is chunked independently so page_number/heading metadata stays
accurate per chunk (no merging across segments).
"""
from typing import List, Dict, Any

from app.core.config import settings


def split_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    if len(text) <= chunk_size:
        return [text]

    pieces, start = [], 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            last_space = text.rfind(" ", start, end)
            if last_space > start:
                end = last_space
        pieces.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [p for p in pieces if p]


def chunk_segments(
    segments: List[Dict[str, Any]],
    chunk_size: int = None,
    overlap: int = None,
) -> List[Dict[str, Any]]:
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    chunks = []
    for seg in segments:
        for piece in split_text(seg["text"], chunk_size, overlap):
            chunks.append(
                {
                    "text": piece,
                    "page_number": seg.get("page_number"),
                    "heading": seg.get("heading"),
                    "source_segment_index": seg.get("index"),
                }
            )
    return chunks
