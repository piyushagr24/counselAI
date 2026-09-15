"""Obligation extraction. Reuses extraction (Step 3) and the configured LLM
client (Step 5). Grounded strictly in the uploaded contract — no invented
parties, actions, or deadlines. Malformed LLM output is skipped, not fatal.
"""
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import Obligation
from app.services.extraction_batching import atomize_segments, pack_batches, label_batch, resolve_item_location
from app.services.llm_client import generate_answer
from app.utils.json_parsing import extract_list_loose

MAX_UNIT_CHARS = 1200
MAX_BATCH_CHARS = 4500

SYSTEM_PROMPT = (
    "You are an expert contract analyst. From the contract excerpts below, extract every "
    "distinct legal obligation — an explicit required duty or action by a party. "
    "For each obligation, specify 'excerpt_id': integer (the Excerpt N number 1..N where this obligation appears) "
    "and 'page_number': integer (the Page: X number stated in that excerpt's header). "
    "Use the 'Section:' tag if present to fill 'section'. "
    "Classify each obligation into 'category' (one of: 'Payment', 'Delivery', 'Confidentiality', 'Compliance', 'Reporting', 'Termination', 'Intellectual Property', 'General') "
    "and 'priority' (one of: 'High', 'Medium', 'Standard'). "
    "Use ONLY information explicitly stated in the excerpts — never invent a responsible party, action, or deadline. "
    "If a field is not stated, use null. Respond with ONLY a JSON array where each item has exactly these keys: "
    '{"responsible_party": string|null, "obligation": string, "deadline": string|null, '
    '"section": string|null, "excerpt_id": integer|null, "page_number": integer|null, "category": string, "priority": "High"|"Medium"|"Standard"}. '
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


_contract_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_contract_lock(contract_id: str) -> threading.Lock:
    with _locks_guard:
        if contract_id not in _contract_locks:
            _contract_locks[contract_id] = threading.Lock()
        return _contract_locks[contract_id]


def _process_obligation_batch(batch: List[Dict[str, Any]], total_pages: Any) -> List[Obligation]:
    raw = generate_answer(SYSTEM_PROMPT, label_batch(batch), max_tokens=650)
    batch_items = _parse_batch_response(raw)
    for ob in batch_items:
        resolved_page, resolved_sec = resolve_item_location(
            item_page=ob.page_number,
            item_section=ob.section,
            text_snippet=ob.obligation,
            batch=batch,
            total_pages=total_pages,
            excerpt_id=getattr(ob, "excerpt_id", None),
        )
        ob.page_number = resolved_page
        if resolved_sec:
            ob.section = resolved_sec
    return batch_items


def extract_obligations(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _cache_path(contract_id)
    if not force and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            obs = cached.get("obligations", [])
            extraction = _load_extraction(contract_id)
            total_pages = extraction.get("metadata", {}).get("num_pages") or 1
            all_page_one = len(obs) > 1 and all(o.get("page_number") == 1 for o in obs)
            if not (total_pages > 1 and all_page_one):
                return cached
        except Exception:
            pass

    with _get_contract_lock(contract_id):
        if not force and os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                obs = cached.get("obligations", [])
                extraction = _load_extraction(contract_id)
                total_pages = extraction.get("metadata", {}).get("num_pages") or 1
                all_page_one = len(obs) > 1 and all(o.get("page_number") == 1 for o in obs)
                if not (total_pages > 1 and all_page_one):
                    return cached
            except Exception:
                pass

        extraction = _load_extraction(contract_id)
        units = atomize_segments(extraction["segments"], MAX_UNIT_CHARS)
        if not units:
            raise HTTPException(status_code=422, detail="No contract text available to analyze.")

        total_pages = extraction.get("metadata", {}).get("num_pages")
        all_obligations: List[Obligation] = []
        batches = pack_batches(units, MAX_BATCH_CHARS)

        for idx, batch in enumerate(batches):
            b_obs = _process_obligation_batch(batch, total_pages)
            all_obligations.extend(b_obs)
            if idx < len(batches) - 1:
                time.sleep(0.5)  # gentle pacing between batches to respect TPM limits

        unique_obligations = _deduplicate_obligations(all_obligations)
        output = {"contract_id": contract_id, "obligations": [o.model_dump() for o in unique_obligations]}
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        return output

