"""Classifies each contract chunk into a clause category and caches the
result per contract. Reuses extraction (Step 3) and chunking (Step 4) —
classification runs on the same chunks used for embeddings, so page/heading
metadata is already attached.
"""
import json
import math
import os
from typing import Any, Dict

from fastapi import HTTPException

from app.core.config import settings
from app.services.chunking import chunk_segments
from app.services.classifier import get_classifier


def _extraction_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}.json")


def _clauses_cache_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}_clauses.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = _extraction_path(contract_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def classify_contract(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _clauses_cache_path(contract_id)
    classifier = get_classifier()

    if not force and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            clauses = cached.get("clauses", [])
            is_stale_keyword = (
                cached.get("method") == "keyword_fallback"
                or (clauses and all(c.get("confidence") in (0.0, 0.5) for c in clauses))
            )
            total_pages_meta = 1
            try:
                ext_p = _extraction_path(contract_id)
                if os.path.exists(ext_p):
                    with open(ext_p, "r", encoding="utf-8") as ef:
                        total_pages_meta = json.load(ef).get("metadata", {}).get("num_pages") or 1
            except Exception:
                pass
            all_page_one = len(clauses) > 1 and all(c.get("page_number", 1) == 1 for c in clauses)
            is_stale_pages = total_pages_meta > 1 and all_page_one

            if not is_stale_pages and not (is_stale_keyword and classifier.method_name != "keyword_fallback"):
                return cached
        except Exception:
            pass

    extraction = _load_extraction(contract_id)
    chunks = chunk_segments(extraction["segments"])
    if not chunks:
        raise HTTPException(status_code=422, detail="No contract text available to classify.")

    total_pages = extraction.get("metadata", {}).get("num_pages") or 1
    classifier = get_classifier()
    chunk_texts = [c["text"] for c in chunks]
    classifications = classifier.classify_batch(chunk_texts)

    seg_pages = [c.get("page_number") for c in chunks if c.get("page_number")]
    all_chunks_page_one = total_pages > 1 and len(chunks) > 1 and (not seg_pages or all(p == 1 for p in seg_pages))

    results = []
    for i, (chunk, (category, confidence)) in enumerate(zip(chunks, classifications)):
        p_num = chunk.get("page_number")
        if all_chunks_page_one or p_num is None or p_num <= 0:
            p_num = min(total_pages, max(1, math.floor(i / max(1, len(chunks)) * total_pages) + 1))
        results.append(
            {
                "chunk_index": i,
                "page_number": p_num,
                "heading": chunk.get("heading"),
                "text": chunk["text"],
                "category": category,
                "confidence": round(confidence, 4),
            }
        )

    results.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    output = {"contract_id": contract_id, "method": classifier.method_name, "clauses": results}
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)
    return output
