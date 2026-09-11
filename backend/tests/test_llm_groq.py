"""Unit and integration tests for Groq LLM integration and edge-case handling."""
import json
import os
import sys
from unittest.mock import patch, MagicMock
from urllib import error

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.services.llm_client import (
    generate_answer,
    _get_groq_key,
    _post_json,
    LLMError,
)
from app.utils.json_parsing import parse_json_loose, extract_list_loose


def test_groq_key_resolution():
    """Verify Groq API key auto-discovery and backwards compatibility."""
    # 1. Direct groq_api_key
    with patch.object(settings, "groq_api_key", "gsk_direct_key"):
        with patch.object(settings, "openai_api_key", ""):
            with patch.object(settings, "gemini_api_key", ""):
                assert _get_groq_key() == "gsk_direct_key"

    # 2. Fallback from openai_api_key if starts with gsk_
    with patch.object(settings, "groq_api_key", ""):
        with patch.object(settings, "openai_api_key", "gsk_from_openai"):
            with patch.object(settings, "gemini_api_key", ""):
                assert _get_groq_key() == "gsk_from_openai"

    # 3. Fallback from gemini_api_key if starts with gsk_
    with patch.object(settings, "groq_api_key", ""):
        with patch.object(settings, "openai_api_key", ""):
            with patch.object(settings, "gemini_api_key", "gsk_from_gemini"):
                assert _get_groq_key() == "gsk_from_gemini"


def test_post_json_includes_user_agent():
    """Verify custom User-Agent is sent to bypass Cloudflare 403 blocks."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"status": "ok"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        _post_json("https://api.groq.com/test", {"hello": "world"}, {"Authorization": "Bearer test"})
        req_sent = mock_urlopen.call_args[0][0]
        assert "User-agent" in req_sent.headers or "User-Agent" in req_sent.headers
        user_agent = req_sent.headers.get("User-agent") or req_sent.headers.get("User-Agent")
        assert "LegalAI-Assistant" in user_agent


def test_post_json_retries_on_429():
    """Verify exponential backoff retry occurs on HTTP 429."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        err_429 = error.HTTPError(
            url="https://api.groq.com/test",
            code=429,
            msg="Too Many Requests",
            hdrs={"Retry-After": "0.01"},
            fp=MagicMock(read=lambda: b'{"error": "rate limit"}'),
        )
        mock_ctx = MagicMock()
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"success": true}'
        mock_ctx.__enter__.return_value = mock_resp

        mock_urlopen.side_effect = [err_429, mock_ctx]

        result = _post_json("https://api.groq.com/test", {}, {}, max_retries=2)
        assert result == {"success": True}
        assert mock_urlopen.call_count == 2


def test_extract_list_loose_handles_arrays_and_objects():
    """Verify list extraction handles bare lists, markdown fences, and wrapped dictionaries."""
    # 1. Bare array
    raw_array = '[{"title": "Risk 1"}, {"title": "Risk 2"}]'
    assert len(extract_list_loose(raw_array)) == 2

    # 2. Wrapped in markdown code fence
    raw_fenced = '```json\n[{"title": "Risk 1"}]\n```'
    assert len(extract_list_loose(raw_fenced)) == 1

    # 3. Wrapped in dict under 'risks' key
    raw_dict_risks = '{"risks": [{"title": "Risk A"}, {"title": "Risk B"}]}'
    extracted = extract_list_loose(raw_dict_risks)
    assert len(extracted) == 2
    assert extracted[0]["title"] == "Risk A"

    # 4. Wrapped in dict under 'obligations' key
    raw_dict_obligations = '{"obligations": [{"action": "Pay within 10 days"}]}'
    extracted_ob = extract_list_loose(raw_dict_obligations)
    assert len(extracted_ob) == 1

    # 5. Invalid / empty
    assert extract_list_loose("invalid json string") == []


def test_mock_fallback_when_key_missing():
    """Verify deterministic mock response when mock_fallback=True and key is missing."""
    with patch.object(settings, "llm_provider", "groq"):
        with patch.object(settings, "groq_api_key", ""):
            with patch.object(settings, "openai_api_key", ""):
                with patch.object(settings, "gemini_api_key", ""):
                    with patch.object(settings, "mock_fallback", True):
                        ans = generate_answer("Please summarize", "test contract")
                        assert "contract_purpose" in ans or "could not find" in ans.lower()


def test_live_groq_generation():
    """Verify live Groq API connectivity if GROQ_API_KEY is available in .env."""
    key = _get_groq_key()
    if not key or not key.startswith("gsk_"):
        pytest.skip("No valid Groq API key configured; skipping live test.")

    with patch.object(settings, "llm_provider", "groq"):
        with patch.object(settings, "llm_model", "qwen/qwen3.8-27b"):
            with patch.object(settings, "mock_fallback", False):
                answer = generate_answer(
                    system_prompt="You are a legal assistant. Answer concisely.",
                    user_prompt="Who signed the contract between Alice Corp and Bob LLC?",
                    max_tokens=200,
                )
                assert isinstance(answer, str)
                assert len(answer.strip()) > 0
