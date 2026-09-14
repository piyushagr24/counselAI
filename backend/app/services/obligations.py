"""Obligation extraction. Reuses extraction (Step 3) and the configured LLM
client (Step 5). Grounded strictly in the uploaded contract — no invented
parties, actions, or deadlines. Malformed LLM output is skipped, not fatal.
"""
import json
import os
import time
from typing import Any, Dict, List

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import Obligation
from app.services.extraction_batching import atomize_segments, pack_batches, label_batch, resolve_item_location
from app.services.llm_client import generate_answer
from app.utils.json_parsing import extract_list_loose

MAX_UNIT_CHARS = 2000
MAX_BATCH_CHARS = 7000

SYSTEM_PROMPT = (
    "You are an expert contract analyst. From the contract excerpts below, extract every "
    "distinct legal obligation — an explicit required duty or action by a party. "
    "Use ONLY the 'Page: X' tag in each excerpt header to fill 'page_number' (as an integer). "
    "NEVER use the Excerpt number (e.g. Excerpt 4) as the page number. Use the 'Section:' tag if present to fill 'section'. "
    "Classify each obligation into 'category' (one of: 'Payment', 'Delivery', 'Confidentiality', 'Compliance', 'Reporting', 'Termination', 'Intellectual Property', 'General') "
    "and 'priority' (one of: 'High', 'Medium', 'Standard'). "
    "Use ONLY information explicitly stated in the excerpts — never invent a responsible party, action, or deadline. "
    "If a field is not stated, use null. Respond with ONLY a JSON array where each item has exactly these keys: "
    '{"responsible_party": string|null, "obligation": string, "deadline": string|null, '
    '"section": string|null, "page_number": integer|null, "category": string, "priority": "High"|"Medium"|"Standard"}. '
    "If no obligations are found in these excerpts, respond with []."
)


def _extraction_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}.json")


def _cache_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}_obligations.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = _extraction_path(contract_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_batch_response(raw: str) -> List[Obligation]:
    data = extract_list_loose(raw)
    items = []
    for entry in data:
        try:
            items.append(Obligation(**entry))
        except ValidationError:
            continue  # skip malformed individual items
    return items


def _deduplicate_obligations(obligations: List[Obligation]) -> List[Obligation]:
    seen = set()
    unique = []
    for ob in obligations:
        clean_party = (ob.responsible_party or "").lower().strip()
        clean_text = "".join(c for c in ob.obligation.lower() if c.isalnum())[:70]
        key = (clean_party, clean_text)
        if key not in seen and clean_text:
            seen.add(key)
            unique.append(ob)
    return unique


def extract_obligations(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _cache_path(contract_id)
    if not force and os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    extraction = _load_extraction(contract_id)
    units = atomize_segments(extraction["segments"], MAX_UNIT_CHARS)
    if not units:
        raise HTTPException(status_code=422, detail="No contract text available to analyze.")

    total_pages = extraction.get("metadata", {}).get("num_pages")
    all_obligations: List[Obligation] = []
    batches = pack_batches(units, MAX_BATCH_CHARS)
    for batch in batches:
        raw = generate_answer(SYSTEM_PROMPT, label_batch(batch), max_tokens=1000)
        batch_items = _parse_batch_response(raw)
        for ob in batch_items:
            resolved_page, resolved_sec = resolve_item_location(
                item_page=ob.page_number,
                item_section=ob.section,
                text_snippet=ob.obligation,
                batch=batch,
                total_pages=total_pages,
            )
            ob.page_number = resolved_page
            if resolved_sec:
                ob.section = resolved_sec
        all_obligations.extend(batch_items)
        if len(batches) > 1:
            time.sleep(0.35)  # subtle pacing delay to respect Groq OTPM/RPM limits

    unique_obligations = _deduplicate_obligations(all_obligations)
    output = {"contract_id": contract_id, "obligations": [o.model_dump() for o in unique_obligations]}
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return output

