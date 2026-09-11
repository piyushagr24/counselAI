"""Vector store with ChromaDB in production and a JSON fallback for lightweight local runs."""
import json
import math
import os
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.services.embeddings import embed_texts

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
except ImportError:
    chromadb = None

_client = None
if chromadb is not None:
    _client = chromadb.PersistentClient(path=settings.chroma_persist_dir, settings=ChromaSettings(anonymized_telemetry=False))
_FALLBACK_PATH = os.path.join(settings.chroma_persist_dir, "contract_chunks.json")


def _get_collection():
    if _client is None:
        return None
    return _client.get_or_create_collection(name="contract_chunks")


def _read_fallback() -> list[dict]:
    try:
        with open(_FALLBACK_PATH, "r", encoding="utf-8") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_fallback(records: list[dict]) -> None:
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)
    with open(_FALLBACK_PATH, "w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False)


def add_chunks(contract_id: str, chunks: List[Dict[str, Any]]) -> int:
    """Embed and store chunks for a contract. Returns number of chunks indexed."""
    if not chunks:
        return 0

    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)

    ids = [f"{contract_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "contract_id": contract_id,
            "chunk_index": i,
            # Chroma metadata can't store None -> use -1 sentinel for "no page" (DOCX)
            "page_number": c["page_number"] if c.get("page_number") is not None else -1,
            "heading": c.get("heading") or "",
        }
        for i, c in enumerate(chunks)
    ]

    collection = _get_collection()
    if collection is not None:
        collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=texts)
    else:
        records = _read_fallback()
        records.extend({"id": item_id, "embedding": embedding, "metadata": metadata, "text": text} for item_id, embedding, metadata, text in zip(ids, embeddings, metadatas, texts))
        _write_fallback(records)
    return len(chunks)


def delete_chunks(contract_id: str) -> None:
    """Delete all indexed chunks belonging to a contract."""
    collection = _get_collection()
    if collection is not None:
        collection.delete(where={"contract_id": contract_id})
    else:
        _write_fallback([record for record in _read_fallback() if record["metadata"].get("contract_id") != contract_id])


def query_chunks(query_text: str, contract_id: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    """Return the top_k chunks most similar to query_text, optionally scoped to one contract."""
    query_embedding = embed_texts([query_text])[0]

    collection = _get_collection()
    if collection is None:
        records = [record for record in _read_fallback() if not contract_id or record["metadata"].get("contract_id") == contract_id]
        def similarity(record: dict) -> float:
            return sum(a * b for a, b in zip(query_embedding, record["embedding"]))
        records.sort(key=similarity, reverse=True)
        return [{"text": record["text"], "page_number": record["metadata"].get("page_number") if record["metadata"].get("page_number") != -1 else None, "heading": record["metadata"].get("heading") or None, "contract_id": record["metadata"].get("contract_id"), "chunk_index": record["metadata"].get("chunk_index"), "distance": 1 - similarity(record)} for record in records[:top_k]]

    where = {"contract_id": contract_id} if contract_id else None
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k, where=where)

    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    hits = []
    for text, meta, dist in zip(docs, metadatas, distances):
        hits.append(
            {
                "text": text,
                "page_number": meta.get("page_number") if meta.get("page_number") != -1 else None,
                "heading": meta.get("heading") or None,
                "contract_id": meta.get("contract_id"),
                "chunk_index": meta.get("chunk_index"),
                "distance": dist,
            }
        )
    return hits
