"""Shared contract ingestion pipeline: validate -> save -> extract -> chunk ->
embed & index. Used by the /upload endpoint and by /compare (which ingests
two files the same way before diffing them).
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import UploadFile, HTTPException

from app.core.config import settings
from app.services.extraction import extract_text
from app.services.chunking import chunk_segments
from app.services.vector_store import add_chunks
from app.utils.file_validation import validate_file


def ingest_contract(file: UploadFile) -> Dict[str, Any]:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    ext, contents = validate_file(file, max_bytes)

    contract_id = str(uuid.uuid4())
    os.makedirs(settings.upload_dir, exist_ok=True)
    dest_path = os.path.join(settings.upload_dir, f"{contract_id}{ext}")

    try:
        with open(dest_path, "wb") as f:
            f.write(contents)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    extraction = extract_text(dest_path, ext)
    extraction["original_filename"] = file.filename or f"{contract_id}{ext}"
    extraction["size_bytes"] = len(contents)
    extraction["upload_date"] = datetime.now(timezone.utc).isoformat()

    extraction_path = os.path.join(settings.upload_dir, f"{contract_id}.json")
    with open(extraction_path, "w", encoding="utf-8") as f:
        json.dump(extraction, f, ensure_ascii=False)

    chunks = chunk_segments(extraction["segments"])
    chunks_indexed = add_chunks(contract_id, chunks)

    return {
        "contract_id": contract_id,
        "filename": file.filename,
        "size_bytes": len(contents),
        "extraction": extraction,
        "chunks_indexed": chunks_indexed,
    }
