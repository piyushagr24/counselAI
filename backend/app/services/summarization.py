"""Contract summarization. Reuses extraction output (Step 3) and the configured
LLM client (Step 5). Results are cached to disk so subsequent requests do not
hit LLM rate limits. Long contracts are map-reduced with adaptive pacing.
"""
import json
import os
import time
from typing import Any, Dict

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import ContractSummary
from app.services.chunking import split_text
from app.services.llm_client import generate_answer, LLMError
from app.utils.json_parsing import parse_json_loose

MAX_SINGLE_PASS_CHARS = 25000  # above this, use map-reduce instead of one LLM call
MAP_CHUNK_CHARS = 8000
MAP_OVERLAP = 250

SUMMARY_SCHEMA_HINT = (
    '{"title": string, "executive_summary": string, "contract_type": string, '
    '"contract_purpose": string, "parties": [string], "effective_date": string, '
    '"expiration_date": string, "duration": string, "financial_terms": string, '
    '"payment_terms": string, "governing_law_and_jurisdiction": string, '
    '"key_obligations": [string], "termination_conditions": string, '
    '"liability_and_indemnification": string, "dispute_resolution": string, '
    '"confidentiality_terms": string, "overall_risk_score": "Low"|"Medium"|"High"|"Critical", '
    '"key_risks_summary": [string], "important_clauses": [string]}'
)

REDUCE_SYSTEM_PROMPT = (
    "You are a senior corporate counsel and expert contract analysis assistant. "
    "Carefully analyze the contract text/notes provided and synthesize an executive-grade summary. "
    "Base every field strictly on the provided text — never invent facts, names, or provisions. "
    "Provide a detailed, professional 2-3 paragraph 'executive_summary' describing the commercial purpose, "
    "core transaction, rights, and potential exposure. Extract explicit dates, financial terms, governing law, "
    "liabilities, and key obligations. "
    'If a string field is not present in the contract, use "Not specified in the contract." '
    "If a list field has no items, use an empty list []. "
    "Respond with ONLY valid JSON matching this schema (no markdown, no preamble):\n"
    f"{SUMMARY_SCHEMA_HINT}"
)

MAP_SYSTEM_PROMPT = (
    "You are a contract analysis assistant. From this contract excerpt, extract concise factual "
    "notes relevant to: contract title, contract type, parties involved, purpose, effective and expiration dates, "
    "term/duration, payment and financial terms, governing law/jurisdiction, key obligations, termination conditions, "
    "liability caps, indemnification, dispute resolution, confidentiality, and notable risks. "
    "Do not invent information. If nothing relevant appears, respond with exactly: 'No relevant information.'"
)


def _cache_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}_summary.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = os.path.join(settings.upload_dir, f"{contract_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_summary_json(raw: str) -> ContractSummary:
    try:
        parsed = parse_json_loose(raw)
        # Ensure contract_purpose fallback if only executive_summary is returned
        if not parsed.get("contract_purpose") and parsed.get("executive_summary"):
            parsed["contract_purpose"] = parsed["executive_summary"][:300]
        return ContractSummary(**parsed)
    except (json.JSONDecodeError, ValidationError) as e:
        raise LLMError(f"LLM returned an unexpected format for the summary: {e}")


def _map_reduce_summarize(full_text: str) -> ContractSummary:
    pieces = split_text(full_text, MAP_CHUNK_CHARS, MAP_OVERLAP)
    notes = []
    for piece in pieces:
        note = generate_answer(MAP_SYSTEM_PROMPT, piece, max_tokens=500)
        if note.strip() and "no relevant information" not in note.lower():
            notes.append(note.strip())
        time.sleep(0.3)  # subtle pacing delay to respect Groq OTPM/RPM window

    combined_notes = "\n\n".join(notes) if notes else "No relevant information extracted."
    raw = generate_answer(REDUCE_SYSTEM_PROMPT, combined_notes, max_tokens=1500)
    return _parse_summary_json(raw)


def _single_pass_summarize(full_text: str) -> ContractSummary:
    raw = generate_answer(REDUCE_SYSTEM_PROMPT, full_text, max_tokens=1500)
    return _parse_summary_json(raw)


def summarize_contract(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache = _cache_path(contract_id)
    if not force and os.path.exists(cache):
        try:
            with open(cache, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass  # Recompute if cache is corrupted

    extraction = _load_extraction(contract_id)
    full_text = extraction.get("full_text", "")

    if not full_text.strip():
        raise HTTPException(status_code=422, detail="Contract has no extracted text to summarize.")

    if len(full_text) > MAX_SINGLE_PASS_CHARS:
        summary, method = _map_reduce_summarize(full_text), "map_reduce"
    else:
        summary, method = _single_pass_summarize(full_text), "single_pass"

    output = {
        "contract_id": contract_id,
        "method": method,
        "summary": summary.model_dump(),
    }

    try:
        with open(cache, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return output

