"""Deadline/date extraction. Same architecture as obligations.py — batches
grounded excerpts through the LLM, then merges each batch's structured result
deterministically (no extra LLM call needed for merging).
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
from app.models.schemas import DeadlinesSummary, DateItem
from app.services.extraction_batching import atomize_segments, pack_batches, label_batch, resolve_item_location
from app.services.llm_client import generate_answer
from app.utils.json_parsing import parse_json_loose

MAX_UNIT_CHARS = 2000
MAX_BATCH_CHARS = 11000

_DATE_ITEM_SHAPE = '{"description": string, "date_or_timeframe": string|null, "excerpt_id": integer|null, "page_number": integer|null}'

SYSTEM_PROMPT = (
    "You are an expert contract analyst. From the contract excerpts below, extract any explicit "
    "dates, timeframes, and deadline milestones for: contract start/effective date, contract end/expiration date, "
    "renewal date or window, termination notice period, breach cure period, payment deadlines, "
    "delivery deadlines, and any other critical milestones. Use ONLY what is explicitly stated in the excerpts — "
    "never invent a date. For each item, specify 'excerpt_id': integer (the Excerpt N number 1..N where this item appears) "
    "and 'page_number': integer (the Page: X number stated in that excerpt's header). "
    "If a field has no information in these excerpts, use null for single-value fields or an "
    "empty array for list fields. Respond with ONLY valid JSON matching this shape:\n"
    '{"contract_start_date": string|null, "contract_end_date": string|null, '
    '"renewal_date": string|null, "termination_notice_period": string|null, '
    f'"payment_deadlines": [{_DATE_ITEM_SHAPE}], "delivery_deadlines": [{_DATE_ITEM_SHAPE}], '
    f'"other_dates": [{_DATE_ITEM_SHAPE}]}}'
)


def _extraction_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}.json")


def _cache_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}_deadlines.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = _extraction_path(contract_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_batch_response(raw: str) -> DeadlinesSummary:
    try:
        return DeadlinesSummary(**parse_json_loose(raw))
    except (json.JSONDecodeError, ValidationError):
        return DeadlinesSummary()  # malformed batch contributes nothing, not fatal


def _deduplicate_date_items(items: List[DateItem]) -> List[DateItem]:
    seen = set()
    unique = []
    for it in items:
        clean_desc = "".join(c for c in it.description.lower() if c.isalnum())[:50]
        clean_date = (it.date_or_timeframe or "").lower().strip()
        key = (clean_desc, clean_date)
        if key not in seen and (clean_desc or clean_date):
            seen.add(key)
            unique.append(it)
    return unique


def _merge(a: DeadlinesSummary, b: DeadlinesSummary) -> DeadlinesSummary:
    merged_payments = _deduplicate_date_items(a.payment_deadlines + b.payment_deadlines)
    merged_deliveries = _deduplicate_date_items(a.delivery_deadlines + b.delivery_deadlines)
    merged_others = _deduplicate_date_items(a.other_dates + b.other_dates)

    return DeadlinesSummary(
        contract_start_date=a.contract_start_date or b.contract_start_date,
        contract_end_date=a.contract_end_date or b.contract_end_date,
        renewal_date=a.renewal_date or b.renewal_date,
        termination_notice_period=a.termination_notice_period or b.termination_notice_period,
        payment_deadlines=merged_payments,
        delivery_deadlines=merged_deliveries,
        other_dates=merged_others,
    )


_contract_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_contract_lock(contract_id: str) -> threading.Lock:
    with _locks_guard:
        if contract_id not in _contract_locks:
            _contract_locks[contract_id] = threading.Lock()
        return _contract_locks[contract_id]


def _process_deadline_batch(batch: List[Dict[str, Any]], total_pages: Any) -> DeadlinesSummary:
    raw = generate_answer(SYSTEM_PROMPT, label_batch(batch), max_tokens=600)
    batch_summary = _parse_batch_response(raw)
    for lst in (batch_summary.payment_deadlines, batch_summary.delivery_deadlines, batch_summary.other_dates):
        for item in lst:
            p_num, _ = resolve_item_location(
                item_page=item.page_number,
                item_section=None,
                text_snippet=f"{item.description} {item.date_or_timeframe or ''}",
                batch=batch,
                total_pages=total_pages,
                excerpt_id=getattr(item, "excerpt_id", None),
            )
            item.page_number = p_num
    return batch_summary


def extract_deadlines(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _cache_path(contract_id)
    if not force and os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    with _get_contract_lock(contract_id):
        if not force and os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        extraction = _load_extraction(contract_id)
        units = atomize_segments(extraction["segments"], MAX_UNIT_CHARS)
        if not units:
            raise HTTPException(status_code=422, detail="No contract text available to analyze.")

        total_pages = extraction.get("metadata", {}).get("num_pages")
        batches = pack_batches(units, MAX_BATCH_CHARS)

        if len(batches) == 1:
            merged = _process_deadline_batch(batches[0], total_pages)
        else:
            merged = DeadlinesSummary()
            with ThreadPoolExecutor(max_workers=2) as executor:
                batch_results = list(executor.map(
                    lambda b: _process_deadline_batch(b, total_pages),
                    batches,
                ))
                for b_sum in batch_results:
                    merged = _merge(merged, b_sum)

        output = {"contract_id": contract_id, "deadlines": merged.model_dump()}
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        return output

