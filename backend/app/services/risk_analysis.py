"""Contract risk detection.

Default backend: the configured LLM, doing evidence-grounded analysis over
batched contract excerpts (same batching architecture as Step 8's
obligations/deadlines extraction). This is NOT a trained risk-classification
model — it's the general-purpose LLM applying a risk-analysis prompt.

Modular by design: RiskAnalyzer is the interface every backend implements.
get_risk_analyzer() tries a dedicated trained model first (RISK_MODEL_PATH),
falling back to the LLM analyzer. No trained risk model ships with this
project — MLRiskClassifier is a placeholder for later, and instantiating it
without a real model raises NotImplementedError rather than pretending to work.
"""
import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Any, Dict, List

from fastapi import HTTPException
from pydantic import ValidationError

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.models.schemas import RiskFinding
from app.services.extraction_batching import atomize_segments, pack_batches, label_batch, resolve_item_location
from app.services.llm_client import generate_answer
from app.utils.json_parsing import extract_list_loose

MAX_UNIT_CHARS = 1200
MAX_BATCH_CHARS = 4500

RISK_CATEGORIES = [
    "Unlimited liability",
    "One-sided termination rights",
    "Missing confidentiality protection",
    "Missing payment deadlines",
    "Ambiguous language",
    "Excessive penalties",
    "Broad indemnification",
    "Unfavorable renewal terms",
    "Unusual notice periods",
    "Unfavorable IP ownership",
]

SYSTEM_PROMPT = (
    "You are an expert corporate legal risk analyst. Examine the contract excerpts below and identify "
    "potentially risky, one-sided, or ambiguous clauses, focusing on (but not limited to): "
    f"{', '.join(RISK_CATEGORIES)}. "
    "Base every finding strictly on text actually present in the excerpts — never invent a "
    "clause or risk that isn't there. Every finding MUST include a verbatim 'evidence' quote copied from the excerpt. "
    "For each finding, specify 'excerpt_id': integer (the Excerpt N number 1..N where this risk appears) "
    "and 'page_number': integer (the Page: X number stated in that excerpt's header). Use the 'Section:' tag if present to fill 'section'. "
    "Assign 'severity' as exactly one of 'Low', 'Medium', 'High', 'Critical' based on potential commercial and legal exposure. "
    "Provide an actionable, practical 'recommendation' explaining how to mitigate or renegotiate this risk. "
    "Assign 'category' as one of: 'Financial', 'Operational', 'Legal & Regulatory', 'IP & Data', 'Termination'. "
    "Respond with ONLY a JSON array where each item has exactly these keys: "
    '{"title": string, "severity": "Low"|"Medium"|"High"|"Critical", "explanation": string, '
    '"evidence": string, "excerpt_id": integer|null, "page_number": integer|null, "section": string|null, '
    '"recommendation": string, "category": string}. '
    "If these excerpts contain no meaningful risk, respond with []."
)


class RiskAnalyzer:
    """Interface every backend implements."""

    method_name = "base"

    def analyze_batch(self, labeled_excerpts: str) -> List[Dict[str, Any]]:
        raise NotImplementedError


class LLMRiskAnalyzer(RiskAnalyzer):
    method_name = "llm_grounded_analysis"

    def analyze_batch(self, labeled_excerpts: str) -> List[Dict[str, Any]]:
        raw = generate_answer(SYSTEM_PROMPT, labeled_excerpts, max_tokens=800)
        return _parse_batch_response(raw)


class MLRiskClassifier(RiskAnalyzer):
    """Placeholder for a future dedicated, trained risk-classification model.
    No such model exists yet — instantiating this without a real model at
    RISK_MODEL_PATH must fail loudly, never silently pretend to be trained."""

    method_name = "ml_risk_classifier"

    def __init__(self, model_path: str):
        raise NotImplementedError(
            "No trained risk-classification model ships with this project. "
            "Set RISK_MODEL_PATH to a real trained model to use this backend."
        )

    def analyze_batch(self, labeled_excerpts: str) -> List[Dict[str, Any]]:
        raise NotImplementedError


@lru_cache(maxsize=1)
def get_risk_analyzer() -> RiskAnalyzer:
    if settings.risk_model_path:
        try:
            return MLRiskClassifier(settings.risk_model_path)
        except Exception:
            pass  # fall through to the LLM analyzer
    return LLMRiskAnalyzer()


def _extraction_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}.json")


def _cache_path(contract_id: str) -> str:
    return os.path.join(settings.upload_dir, f"{contract_id}_risks.json")


def _load_extraction(contract_id: str) -> Dict[str, Any]:
    path = _extraction_path(contract_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No contract found with id '{contract_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_batch_response(raw: str) -> List[Dict[str, Any]]:
    data = extract_list_loose(raw)
    items = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        try:
            items.append(RiskFinding(**entry).model_dump())
        except ValidationError as e:
            logger.warning("Skipping invalid risk finding entry: %s (error: %s)", entry, e)
            continue
    return items


def _deduplicate_risks(risks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    unique = []
    for r in risks:
        clean_title = "".join(c for c in (r.get("title") or "").lower() if c.isalnum())[:50]
        clean_evidence = "".join(c for c in (r.get("evidence") or "").lower() if c.isalnum())[:60]
        key = (clean_title, clean_evidence)
        if key not in seen and clean_title:
            seen.add(key)
            unique.append(r)
    return unique


def _process_risk_batch(batch: List[Dict[str, Any]], analyzer: RiskAnalyzer, total_pages: Any) -> List[Dict[str, Any]]:
    batch_risks = analyzer.analyze_batch(label_batch(batch))
    for r in batch_risks:
        resolved_page, resolved_sec = resolve_item_location(
            item_page=r.get("page_number"),
            item_section=r.get("section"),
            text_snippet=r.get("evidence", ""),
            batch=batch,
            total_pages=total_pages,
            excerpt_id=r.get("excerpt_id"),
        )
        r["page_number"] = resolved_page
        if resolved_sec:
            r["section"] = resolved_sec
    return batch_risks


_contract_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_contract_lock(contract_id: str) -> threading.Lock:
    with _locks_guard:
        if contract_id not in _contract_locks:
            _contract_locks[contract_id] = threading.Lock()
        return _contract_locks[contract_id]


def analyze_risks(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _cache_path(contract_id)
    if not force and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
                # Serve from cache if findings exist (including explicit empty list [])
                if "risks" in cached and cached["risks"] is not None:
                    return cached
        except Exception:
            pass  # Recompute if corrupted or unreadable

    # Prevent concurrent foreground & background execution for the exact same contract
    with _get_contract_lock(contract_id):
        # Double-check cache inside lock in case another thread just completed it
        if not force and os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    if "risks" in cached and cached["risks"] is not None:
                        return cached
            except Exception:
                pass

        extraction = _load_extraction(contract_id)
        units = atomize_segments(extraction["segments"], MAX_UNIT_CHARS)
        if not units:
            raise HTTPException(status_code=422, detail="No contract text available to analyze.")

        total_pages = extraction.get("metadata", {}).get("num_pages")
        analyzer = get_risk_analyzer()
        all_risks: List[Dict[str, Any]] = []
        batches = pack_batches(units, MAX_BATCH_CHARS)

        for idx, batch in enumerate(batches):
            b_risks = _process_risk_batch(batch, analyzer, total_pages)
            all_risks.extend(b_risks)
            if idx < len(batches) - 1:
                time.sleep(0.5)  # gentle pacing between batches to respect TPM limits

        unique_risks = _deduplicate_risks(all_risks)
        output = {"contract_id": contract_id, "method": analyzer.method_name, "risks": unique_risks}
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        return output
