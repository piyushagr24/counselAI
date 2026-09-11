"""Classifies each contract chunk into a clause category and caches the
result per contract. Reuses extraction (Step 3) and chunking (Step 4) —
classification runs on the same chunks used for embeddings, so page/heading
metadata is already attached.
"""
import json
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
    if not force and os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    extraction = _load_extraction(contract_id)
    chunks = chunk_segments(extraction["segments"])
    if not chunks:
        raise HTTPException(status_code=422, detail="No contract text available to classify.")

    classifier = get_classifier()
    results = []
    for i, chunk in enumerate(chunks):
        category, confidence = classifier.classify(chunk["text"])
        results.append(
            {
                "chunk_index": i,
                "page_number": chunk.get("page_number"),
                "heading": chunk.get("heading"),
                "text": chunk["text"],
                "category": category,
                "confidence": round(confidence, 4),
            }
        )

    output = {"contract_id": contract_id, "method": classifier.method_name, "clauses": results}
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)
    return output
