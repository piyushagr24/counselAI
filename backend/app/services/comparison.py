"""Contract comparison. Reuses extraction (Step 3), chunking (Step 4), and
embeddings (Step 4) for a deterministic similarity-based diff, then makes one
LLM call (Step 5's client) to summarize and categorize the changes already
found — the LLM never sees the raw contracts, only the detected diff, so it
cannot invent changes that weren't actually detected.
"""
import json
import os
from typing import Any, Dict, List, Tuple

import numpy as np
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import ChangeItem, HighlightedChange
from app.services.chunking import chunk_segments
from app.services.embeddings import embed_texts
from app.services.llm_client import generate_answer
from app.utils.json_parsing import parse_json_loose

HIGH_SIMILARITY = 0.90  # >= this: treated as unchanged, not reported
MOD_SIMILARITY = 0.55  # below this: no meaningful match -> ADDED/REMOVED
MAX_CHANGES_FOR_LLM = 40  # cap on how many changes are sent to the summary prompt

SUMMARY_SYSTEM_PROMPT = (
    "You are a contract analysis assistant. Below is a list of already-detected changes "
    "between two versions of a contract (ADDED, REMOVED, or MODIFIED clauses), each with its "
    "text and, where available, page/section location. Using ONLY the changes listed — do not "
    "invent any change not present in the list — write a concise summary (3-6 sentences) of the "
    "most important changes for someone deciding whether to sign the new version. Then "
    "categorize each significant change under one of: Payment, Liability, Termination, Dates, "
    "Obligations, Intellectual Property, Confidentiality, Other. When setting 'page_number', "
    "use ONLY the actual document page number from the location tag (e.g., if 'page A: 2', use 2). "
    "NEVER use the item list index as a page number. If no page is present, use null. "
    "Respond with ONLY valid JSON (no markdown, no commentary) matching exactly this shape: "
    '{"summary": string, "highlighted_changes": [{"category": string, '
    '"change_type": "ADDED"|"REMOVED"|"MODIFIED", "description": string, '
    '"section": string|null, "page_number": integer|null}]}'
)


def _extraction_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = _extraction_path(contract_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _cosine_sim(a: List[float], b: List[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _diff_chunks(chunks_a: List[Dict[str, Any]], chunks_b: List[Dict[str, Any]]) -> List[ChangeItem]:
    """Greedy best-match diff by embedding similarity. Handles unequal
    document lengths naturally: unmatched A chunks -> REMOVED, unmatched B
    chunks -> ADDED, weakly-matched pairs -> MODIFIED."""
    if not chunks_a and not chunks_b:
        return []

    emb_a = embed_texts([c["text"] for c in chunks_a]) if chunks_a else []
    emb_b = embed_texts([c["text"] for c in chunks_b]) if chunks_b else []

    matched_b_indices = set()
    changes: List[ChangeItem] = []

    for i, ca in enumerate(chunks_a):
        best_j, best_score = None, -1.0
        for j, eb in enumerate(emb_b):
            score = _cosine_sim(emb_a[i], eb)
            if score > best_score:
                best_j, best_score = j, score

        if best_j is None or best_score < MOD_SIMILARITY:
            changes.append(
                ChangeItem(
                    change_type="REMOVED",
                    section=ca.get("heading"),
                    page_number_a=ca.get("page_number"),
                    text_a=ca["text"],
                )
            )
            continue

        matched_b_indices.add(best_j)
        if best_score < HIGH_SIMILARITY:
            cb = chunks_b[best_j]
            changes.append(
                ChangeItem(
                    change_type="MODIFIED",
                    section=ca.get("heading") or cb.get("heading"),
                    page_number_a=ca.get("page_number"),
                    page_number_b=cb.get("page_number"),
                    text_a=ca["text"],
                    text_b=cb["text"],
                    similarity=round(best_score, 4),
                )
            )
        # else: similarity >= HIGH_SIMILARITY -> effectively unchanged, not reported

    for j, cb in enumerate(chunks_b):
        if j not in matched_b_indices:
            changes.append(
                ChangeItem(
                    change_type="ADDED",
                    section=cb.get("heading"),
                    page_number_b=cb.get("page_number"),
                    text_b=cb["text"],
                )
            )

    return changes


def _summarize_changes(changes: List[ChangeItem]) -> Tuple[str, List[HighlightedChange]]:
    if not changes:
        return "No meaningful differences were detected between the two contract versions.", []

    lines = []
    for i, c in enumerate(changes[:MAX_CHANGES_FOR_LLM], start=1):
        loc = (
            f"page A:{c.page_number_a} / page B:{c.page_number_b}"
            if (c.page_number_a or c.page_number_b)
            else (c.section or "")
        )
        if c.change_type == "REMOVED":
            lines.append(f"{i}. [REMOVED — {loc}] {c.text_a}")
        elif c.change_type == "ADDED":
            lines.append(f"{i}. [ADDED — {loc}] {c.text_b}")
        else:
            lines.append(f"{i}. [MODIFIED — {loc}]\n   OLD: {c.text_a}\n   NEW: {c.text_b}")

    prompt = "Detected changes:\n\n" + "\n\n".join(lines)
    raw = generate_answer(SUMMARY_SYSTEM_PROMPT, prompt, max_tokens=1000)

    try:
        data = parse_json_loose(raw)
    except json.JSONDecodeError:
        return "Changes were detected between the two versions; see the change list below.", []

    summary = (data.get("summary") or "").strip() or "Changes were detected; see the change list below."
    highlighted = []
    for entry in data.get("highlighted_changes", []):
        try:
            highlighted.append(HighlightedChange(**entry))
        except ValidationError:
            continue

    return summary, highlighted


def compare_contracts(contract_a_id: str, contract_b_id: str) -> Dict[str, Any]:
    extraction_a = _load_extraction(contract_a_id)
    extraction_b = _load_extraction(contract_b_id)

    chunks_a = chunk_segments(extraction_a.get("segments", []))
    chunks_b = chunk_segments(extraction_b.get("segments", []))

    if not chunks_a and not chunks_b:
        raise HTTPException(status_code=422, detail="Neither contract has extractable text to compare.")

    changes = _diff_chunks(chunks_a, chunks_b)
    summary, highlighted = _summarize_changes(changes)

    return {
        "contract_a_id": contract_a_id,
        "contract_b_id": contract_b_id,
        "changes": [c.model_dump() for c in changes],
        "ai_summary": summary,
        "highlighted_changes": [h.model_dump() for h in highlighted],
    }
