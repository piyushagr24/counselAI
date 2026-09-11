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
import os
import time
from functools import lru_cache
from typing import Any, Dict, List

from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import settings
from app.models.schemas import RiskFinding
from app.services.extraction_batching import atomize_segments, pack_batches, label_batch
from app.services.llm_client import generate_answer
from app.utils.json_parsing import extract_list_loose

MAX_UNIT_CHARS = 2000
MAX_BATCH_CHARS = 7000

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
    "Use each excerpt's page/section label to fill 'page_number' (integer or null) and 'section' (heading text or null). "
    "Assign 'severity' as exactly one of 'Low', 'Medium', 'High', 'Critical' based on potential commercial and legal exposure. "
    "Provide an actionable, practical 'recommendation' explaining how to mitigate or renegotiate this risk. "
    "Assign 'category' as one of: 'Financial', 'Operational', 'Legal & Regulatory', 'IP & Data', 'Termination'. "
    "Respond with ONLY a JSON array where each item has exactly these keys: "
    '{"title": string, "severity": "Low"|"Medium"|"High"|"Critical", "explanation": string, '
    '"evidence": string, "page_number": integer|null, "section": string|null, '
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
        raw = generate_answer(SYSTEM_PROMPT, labeled_excerpts, max_tokens=1000)
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
        try:
            items.append(RiskFinding(**entry).model_dump())
        except ValidationError:
            continue  # skip malformed individual findings
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


def analyze_risks(contract_id: str, force: bool = False) -> Dict[str, Any]:
    cache_path = _cache_path(contract_id)
    if not force and os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    extraction = _load_extraction(contract_id)
    units = atomize_segments(extraction["segments"], MAX_UNIT_CHARS)
    if not units:
        raise HTTPException(status_code=422, detail="No contract text available to analyze.")

    analyzer = get_risk_analyzer()
    all_risks: List[Dict[str, Any]] = []
    batches = pack_batches(units, MAX_BATCH_CHARS)
    for batch in batches:
        try:
            all_risks.extend(analyzer.analyze_batch(label_batch(batch)))
        except Exception:
            if not all_risks and len(batches) == 1:
                raise
        if len(batches) > 1:
            time.sleep(0.35)  # subtle pacing delay to respect Groq OTPM/RPM window

    unique_risks = _deduplicate_risks(all_risks)
    output = {"contract_id": contract_id, "method": analyzer.method_name, "risks": unique_risks}
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return output
