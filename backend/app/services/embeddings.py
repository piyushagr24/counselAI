"""Embedding generation via Sentence-Transformers.

Uses a pretrained model as-is (no fine-tuning). Model is loaded once and cached.
"""
from functools import lru_cache
from typing import List

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embedding_model)


def _lightweight_embed(text: str, dimensions: int = 256) -> List[float]:
    """Deterministic hashed-term vector used when ML dependencies are absent."""
    import hashlib
    import math
    vector = [0.0] * dimensions
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        vector[int.from_bytes(digest[:4], "big") % dimensions] += 1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    try:
        model = _get_model()
        vectors = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return vectors.tolist()
    except (ImportError, OSError, RuntimeError):
        return [_lightweight_embed(text) for text in texts]
