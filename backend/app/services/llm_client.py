"""Provider-neutral LLM client supporting Groq, Gemini, Anthropic, and OpenAI
with resilient HTTP handling, rate-limit retry, and an offline deterministic fallback.
"""
import json
import logging
import os
import random
import re
import threading
import time
from urllib import error, request

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    pass


def _get_groq_key() -> str:
    """Resolve Groq API key with backwards-compatible fallback to older env vars."""
    if settings.groq_api_key.strip():
        return settings.groq_api_key.strip()
    if os.environ.get("GROQ_API_KEY", "").strip():
        return os.environ.get("GROQ_API_KEY", "").strip()
    # Check if a Groq key (starts with 'gsk_') was placed in OPENAI_API_KEY or GEMINI_API_KEY
    if settings.openai_api_key.strip().startswith("gsk_"):
        return settings.openai_api_key.strip()
    if settings.gemini_api_key.strip().startswith("gsk_"):
        return settings.gemini_api_key.strip()
    return ""


def _get_gemini_key() -> str:
    """Resolve Gemini API key with backwards-compatible fallback to GOOGLE_API_KEY and env vars."""
    if settings.gemini_api_key.strip():
        return settings.gemini_api_key.strip()
    if os.environ.get("GEMINI_API_KEY", "").strip():
        return os.environ.get("GEMINI_API_KEY", "").strip()
    if getattr(settings, "google_api_key", "").strip():
        return settings.google_api_key.strip()
    if os.environ.get("GOOGLE_API_KEY", "").strip():
        return os.environ.get("GOOGLE_API_KEY", "").strip()
    if settings.openai_api_key.strip().startswith("AIzaSy"):
        return settings.openai_api_key.strip()
    if settings.groq_api_key.strip().startswith("AIzaSy"):
        return settings.groq_api_key.strip()
    return ""


def generate_answer(system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
    provider = settings.llm_provider.lower().strip()
    groq_key = _get_groq_key()
    gemini_key = _get_gemini_key()

    # Auto-route to Gemini if Groq is default/configured but only Gemini key is available
    if provider == "groq" and not groq_key and gemini_key:
        logger.info("GROQ_API_KEY not set, but GEMINI_API_KEY detected; routing to Gemini.")
        provider = "gemini"

    try:
        if provider == "gemini":
            if not gemini_key:
                if groq_key:
                    logger.warning("GEMINI_API_KEY is not configured; falling over to Groq.")
                    return _generate_groq(system_prompt, user_prompt, max_tokens, api_key=groq_key)
                if settings.mock_fallback:
                    logger.warning("GEMINI_API_KEY is not configured; using offline mock fallback.")
                    return _generate_mock(system_prompt, user_prompt)
                raise LLMError("GEMINI_API_KEY is not set in .env")
            try:
                return _generate_gemini(system_prompt, user_prompt, max_tokens, api_key=gemini_key)
            except Exception as gemini_exc:
                if groq_key:
                    logger.warning("All Gemini models failed (%s). Cross-provider failover to Groq...", gemini_exc)
                    return _generate_groq(system_prompt, user_prompt, max_tokens, api_key=groq_key)
                raise

        if provider == "groq":
            if not groq_key:
                if gemini_key:
                    logger.warning("GROQ_API_KEY is not configured; failing over to Gemini.")
                    return _generate_gemini(system_prompt, user_prompt, max_tokens, api_key=gemini_key)
                if settings.mock_fallback:
                    logger.warning("GROQ_API_KEY is not configured; using offline mock fallback.")
                    return _generate_mock(system_prompt, user_prompt)
                raise LLMError("GROQ_API_KEY is not set in .env")
            try:
                return _generate_groq(system_prompt, user_prompt, max_tokens, api_key=groq_key)
            except Exception as groq_exc:
                if gemini_key:
                    logger.warning("All Groq models failed (%s). Cross-provider failover to Gemini...", groq_exc)
                    return _generate_gemini(system_prompt, user_prompt, max_tokens, api_key=gemini_key)
                raise

        if provider == "anthropic":
            if not settings.anthropic_api_key and settings.mock_fallback:
                logger.warning("ANTHROPIC_API_KEY is not configured; using offline mock fallback.")
                return _generate_mock(system_prompt, user_prompt)
            return _generate_anthropic(system_prompt, user_prompt, max_tokens)

        if provider in {"openai", "openrouter"}:
            if not settings.openai_api_key and settings.mock_fallback:
                logger.warning("OPENAI_API_KEY is not configured; using offline mock fallback.")
                return _generate_mock(system_prompt, user_prompt)
            return _generate_openai_compatible(system_prompt, user_prompt, max_tokens)

        if provider in {"mock", "fallback"}:
            return _generate_mock(system_prompt, user_prompt)

        raise LLMError(f"Unsupported LLM_PROVIDER: '{settings.llm_provider}'")

    except LLMError as exc:
        if settings.mock_fallback and provider not in {"mock", "fallback"}:
            logger.warning("LLM request failed (%s); switching to mock fallback.", exc)
            return _generate_mock(system_prompt, user_prompt)
        raise


class RateLimitFailover(LLMError):
    def __init__(self, sleep_secs: float, detail: str):
        super().__init__(detail)
        self.sleep_secs = sleep_secs
        self.detail = detail


GROQ_MODEL_POOL = [
    "qwen/qwen3.8-27b",
    "groq/compound-mini",
    "groq/compound",
]

GEMINI_MODEL_POOL = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
]

_model_cooldowns: dict[str, float] = {}
_cooldown_lock = threading.Lock()

_gemini_model_cooldowns: dict[str, float] = {}
_gemini_cooldown_lock = threading.Lock()


def _get_ordered_groq_models() -> list[str]:
    raw = settings.llm_model.strip()
    primary = raw if not raw.startswith("gemini") else "qwen/qwen3.8-27b"
    pool = [primary] + [m for m in GROQ_MODEL_POOL if m != primary]
    now = time.time()
    with _cooldown_lock:
        ready = [m for m in pool if _model_cooldowns.get(m, 0.0) <= now]
        cooling = [m for m in pool if _model_cooldowns.get(m, 0.0) > now]
    return ready + cooling if ready else pool


def _set_groq_cooldown(model: str, seconds: float):
    with _cooldown_lock:
        _model_cooldowns[model] = time.time() + seconds


def _get_ordered_gemini_models() -> list[str]:
    raw = settings.llm_model.strip()
    primary = raw if raw.startswith("gemini") else "gemini-2.0-flash"
    pool = [primary] + [m for m in GEMINI_MODEL_POOL if m != primary]
    now = time.time()
    with _gemini_cooldown_lock:
        ready = [m for m in pool if _gemini_model_cooldowns.get(m, 0.0) <= now]
        cooling = [m for m in pool if _gemini_model_cooldowns.get(m, 0.0) > now]
    return ready + cooling if ready else pool


def _set_gemini_cooldown(model: str, seconds: float):
    with _gemini_cooldown_lock:
        _gemini_model_cooldowns[model] = time.time() + seconds


def _generate_groq(system_prompt: str, user_prompt: str, max_tokens: int, api_key: str) -> str:
    url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
    models = _get_ordered_groq_models()
    last_exc = None

    for i, model in enumerate(models):
        is_last = (i == len(models) - 1)
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        with _llm_semaphore:
            try:
                data = _post_json(
                    url,
                    payload,
                    {"Authorization": f"Bearer {api_key}"},
                    max_retries=2 if not is_last else 4,
                    allow_failover=not is_last,
                )
                msg = data["choices"][0]["message"]
                content = (msg.get("content") or "").strip()
                if not content and msg.get("reasoning"):
                    content = msg["reasoning"].strip()
                if content:
                    logger.info("Groq inference succeeded using model: %s", model)
                    return content
            except RateLimitFailover as rlf:
                _set_groq_cooldown(model, rlf.sleep_secs)
                logger.warning(
                    "Groq model '%s' rate-limited (cooldown: %.1fs). Instantly failing over to next model in pool...",
                    model,
                    rlf.sleep_secs,
                )
                last_exc = rlf
                continue
            except Exception as exc:
                logger.warning("Groq model '%s' failed (%s). Trying next model in pool...", model, exc)
                last_exc = exc
                continue

    if last_exc:
        raise last_exc
    raise LLMError("All Groq models failed in pool.")


def _generate_anthropic(system_prompt: str, user_prompt: str, max_tokens: int) -> str:
    if not settings.anthropic_api_key:
        raise LLMError("ANTHROPIC_API_KEY is not set in .env")
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    with _llm_semaphore:
        try:
            response = client.messages.create(
                model=settings.llm_model.strip(),
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except anthropic.APIError as exc:
            raise LLMError(f"Anthropic LLM request failed: {exc}") from exc
    return "".join(block.text for block in response.content if block.type == "text").strip()


_last_request_time: float = 0.0
_MIN_REQUEST_INTERVAL: float = 0.8  # seconds between consecutive API calls to prevent bursting
_request_lock = threading.Lock()
_llm_semaphore = threading.Semaphore(1)  # Strictly serialize LLM calls to protect free/dev tier token budgets
_remaining_tokens: int = 8000
_token_reset_target: float = 0.0


def _pace_request():
    """Ensure at least _MIN_REQUEST_INTERVAL has elapsed and remaining tokens are safe."""
    global _last_request_time, _remaining_tokens, _token_reset_target
    with _request_lock:
        now = time.time()
        # If upstream reports that remaining tokens in the window are low, pause for replenishment
        if _remaining_tokens < 2500 and now < _token_reset_target:
            pause_time = min(max(0.1, _token_reset_target - now), 15.0)
            logger.info("Proactively pacing for token replenishment (remaining: %d, pause: %.2fs)", _remaining_tokens, pause_time)
            time.sleep(pause_time)
            now = time.time()

        elapsed = now - _last_request_time
        if elapsed < _MIN_REQUEST_INTERVAL:
            time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
        _last_request_time = time.time()


def _post_json(url: str, payload: dict, headers: dict, max_retries: int = 5, allow_failover: bool = False) -> dict:
    """Post JSON with custom User-Agent, adaptive pacing, and automatic backoff retry on HTTP 429/503."""
    global _remaining_tokens, _token_reset_target
    _pace_request()
    body = json.dumps(payload).encode("utf-8")
    default_headers = {
        "Content-Type": "application/json",
        "User-Agent": "LegalAI-Assistant/1.0",
    }
    merged_headers = {**default_headers, **headers}

    for attempt in range(max_retries + 1):
        req = request.Request(url, data=body, headers=merged_headers, method="POST")
        try:
            with request.urlopen(req, timeout=90) as response:
                _last_request_time = time.time()
                resp_headers = getattr(response, "headers", None)
                if resp_headers and hasattr(resp_headers, "get"):
                    rem = resp_headers.get("x-ratelimit-remaining-tokens")
                    rst = resp_headers.get("x-ratelimit-reset-tokens")
                    if rem is not None:
                        try:
                            _remaining_tokens = int(rem)
                        except (ValueError, TypeError):
                            pass
                    if rst is not None:
                        try:
                            sec = 0.0
                            rst_str = str(rst).strip()
                            if rst_str.endswith("ms"):
                                sec = float(rst_str[:-2]) / 1000.0
                            elif rst_str.endswith("s"):
                                sec = float(rst_str[:-1])
                            _token_reset_target = time.time() + sec
                        except Exception:
                            pass
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            try:
                detail = exc.read().decode("utf-8", errors="replace")
            except Exception:
                detail = str(exc)

            # Edge Case: Rate Limit (HTTP 429) backoff retry
            if exc.code == 429:
                sleep_secs = None
                # 1. Parse Groq's exact duration from error JSON ("Please try again in 9.54s.")
                match = re.search(r"try again in ([0-9.]+)\s*s", detail, re.IGNORECASE)
                if match:
                    try:
                        sleep_secs = float(match.group(1)) + 0.5
                    except (ValueError, TypeError):
                        pass
                # 2. Check standard Retry-After header
                if sleep_secs is None:
                    headers_obj = getattr(exc, "headers", None)
                    retry_after = headers_obj.get("Retry-After") if headers_obj and hasattr(headers_obj, "get") else None
                    if retry_after:
                        try:
                            sleep_secs = float(retry_after) + 0.5
                        except (ValueError, TypeError):
                            pass
                # 3. Fallback exponential backoff
                if sleep_secs is None:
                    sleep_secs = 2.0 * (2 ** attempt) + random.uniform(0.2, 0.6)

                sleep_secs = min(sleep_secs, 35.0)

                # If caller enabled multi-model failover, don't sleep 35s — signal failover immediately!
                if allow_failover:
                    raise RateLimitFailover(sleep_secs, detail)

                if attempt < max_retries:
                    logger.warning("Rate limited (429). Retrying in %.2fs (attempt %d/%d)...", sleep_secs, attempt + 1, max_retries)
                    time.sleep(sleep_secs)
                    continue
                raise LLMError(
                    f"LLM rate limit reached (HTTP 429) after {max_retries} retries. "
                    "Please wait a moment before sending additional requests."
                ) from exc

            # Transient Gateway / Overload Errors (502, 503, 504)
            if exc.code in {502, 503, 504} and attempt < max_retries:
                sleep_secs = 1.0 * (2 ** attempt) + random.uniform(0.1, 0.4)
                logger.info("Transient upstream error (%d). Retrying in %.2fs (attempt %d/%d)...", exc.code, sleep_secs, attempt + 1, max_retries)
                time.sleep(sleep_secs)
                continue

            # Diagnostic guidance for common HTTP errors
            if exc.code == 404:
                raise LLMError(
                    f"LLM model not found (404) on '{url}'. Configured model: '{settings.llm_model}'. "
                    "For Groq, recommended models include 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', or 'qwen/qwen3.8-27b'."
                ) from exc

            if exc.code == 403:
                raise LLMError(f"Access forbidden (403): Check API key permissions and network headers. Details: {detail}") from exc

            raise LLMError(f"LLM request failed ({exc.code}): {detail}") from exc

        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt < max_retries and isinstance(exc, (error.URLError, TimeoutError)):
                time.sleep(1.0 + attempt * 0.5)
                continue
            raise LLMError(f"LLM connection/decoding failed: {exc}") from exc

    raise LLMError(f"LLM request failed after {max_retries} retries.")



def _generate_openai_compatible(system_prompt: str, user_prompt: str, max_tokens: int) -> str:
    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    with _llm_semaphore:
        data = _post_json(
            url,
            {
                "model": settings.llm_model.strip(),
                "max_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            {"Authorization": f"Bearer {settings.openai_api_key}"},
        )
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, AttributeError) as exc:
        raise LLMError("OpenAI-compatible provider returned an unexpected response") from exc


def _generate_gemini(system_prompt: str, user_prompt: str, max_tokens: int, api_key: str) -> str:
    models = _get_ordered_gemini_models()
    last_exc = None

    for i, model in enumerate(models):
        is_last = (i == len(models) - 1)
        url = f"{settings.gemini_base_url.rstrip('/')}/models/{model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.1,
            },
        }
        with _llm_semaphore:
            try:
                data = _post_json(
                    url,
                    payload,
                    {"x-goog-api-key": api_key},
                    max_retries=2 if not is_last else 3,
                    allow_failover=not is_last,
                )
                candidates = data.get("candidates", [])
                if not candidates:
                    raise LLMError(f"Gemini returned no candidates: {data}")
                parts = candidates[0].get("content", {}).get("parts", [])
                content = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p).strip()
                if content:
                    fence_match = re.search(r"^```(?:json)?\s*\n(.*)\n```$", content, flags=re.DOTALL)
                    if fence_match:
                        content = fence_match.group(1).strip()
                    logger.info("Gemini inference succeeded using model: %s", model)
                    return content
            except RateLimitFailover as rlf:
                _set_gemini_cooldown(model, rlf.sleep_secs)
                logger.warning(
                    "Gemini model '%s' rate-limited (cooldown: %.1fs). Instantly failing over to next Gemini model...",
                    model,
                    rlf.sleep_secs,
                )
                last_exc = rlf
                continue
            except Exception as exc:
                logger.warning("Gemini model '%s' failed (%s). Trying next Gemini model in pool...", model, exc)
                last_exc = exc
                continue

    if last_exc:
        raise last_exc
    raise LLMError("All Gemini models failed in pool.")


def _generate_mock(system_prompt: str, user_prompt: str) -> str:
    """Return schema-compatible responses for local development and tests."""
    prompt = system_prompt.lower()
    if "numbered contract excerpt" in prompt or "legal clause categories" in prompt:
        import re
        indices = [int(m) for m in re.findall(r"\[Excerpt\s+(\d+)\]", user_prompt)]
        categories = ["Confidentiality", "Payment", "Termination", "Liability", "Governing Law", "Intellectual Property"]
        mock_items = []
        for idx in (indices or [1]):
            mock_items.append({
                "index": idx,
                "category": categories[(idx - 1) % len(categories)],
                "confidence": 0.92,
            })
        return json.dumps(mock_items)
    if "exactly this sentence" in prompt and "could not find" in prompt:
        return "I could not find this information in the uploaded contract."
    if ("contract_purpose" in prompt or "executive_summary" in prompt) and "important_clauses" in prompt:
        return json.dumps({
            "title": "Commercial Agreement",
            "executive_summary": "Standard commercial agreement defining obligations, payment terms, and confidentiality between the parties.",
            "contract_type": "Commercial Contract",
            "contract_purpose": "Not specified in the contract.",
            "parties": ["Party A", "Party B"],
            "effective_date": "Not specified in the contract.",
            "expiration_date": "Not specified in the contract.",
            "duration": "Not specified in the contract.",
            "financial_terms": "Not specified in the contract.",
            "payment_terms": "Not specified in the contract.",
            "governing_law_and_jurisdiction": "Not specified in the contract.",
            "key_obligations": ["Comply with stated terms and conditions."],
            "termination_conditions": "Not specified in the contract.",
            "liability_and_indemnification": "Not specified in the contract.",
            "dispute_resolution": "Not specified in the contract.",
            "confidentiality_terms": "Not specified in the contract.",
            "overall_risk_score": "Low",
            "key_risks_summary": [],
            "important_clauses": ["Confidentiality", "Termination"],
        })
    if "contract_start_date" in prompt:
        return json.dumps({
            "contract_start_date": None,
            "contract_end_date": None,
            "renewal_date": None,
            "termination_notice_period": None,
            "payment_deadlines": [],
            "delivery_deadlines": [],
            "other_dates": [],
        })
    if "responsible_party" in prompt and "obligation" in prompt:
        return "[]"
    if '"severity"' in prompt and "evidence" in prompt:
        return json.dumps([
            {
                "title": "Uncapped or Broad Indemnification",
                "severity": "High",
                "explanation": "Broad indemnification language with asymmetrical liability exposure.",
                "evidence": "Neither party is liable for indirect, incidental, special, or consequential damages.",
                "page_number": 1,
                "section": "Limitation of Liability",
                "recommendation": "Negotiate mutual indemnification and cap total aggregate liability.",
                "category": "Legal & Regulatory",
            },
            {
                "title": "Automatic Renewal Terms",
                "severity": "Medium",
                "explanation": "Contract automatically renews unless affirmative notice of non-renewal is provided.",
                "evidence": "The Agreement automatically renews for additional one-year periods unless written notice is provided.",
                "page_number": 1,
                "section": "Term and Renewal",
                "recommendation": "Calendar renewal notice deadlines at least 60 days in advance.",
                "category": "Termination",
            },
        ])
    if '"summary"' in prompt and "highlighted_changes" in prompt:
        return json.dumps({
            "summary": "No material changes were detected by the offline analysis.",
            "highlighted_changes": [],
        })
    if "counsel" in prompt or "user_question" in user_prompt.lower():
        u_lower = user_prompt.lower()
        if "indemnif" in u_lower:
            return "An indemnification clause is a contractual agreement where one party promises to compensate the other for specified damages, liabilities, or losses."
        if "nda" in u_lower:
            return "A Non-Disclosure Agreement (NDA) protects confidential information shared between parties from unauthorized disclosure."
        if "hello" in u_lower or "hi" in u_lower or "who are you" in u_lower:
            return "Hello! I am Counsel, your AI legal assistant. I can help review contracts, analyze clauses, evaluate liabilities, and explain legal concepts."
        if "simpler" in u_lower or "explain" in u_lower or "<conversation_history>" in user_prompt:
            return "To put it simply, this provision outlines key obligations and timelines agreed upon by the parties."
        return "Based on the available information, here is the relevant legal guidance and context."
    return "I could not find this information in the uploaded contract."


