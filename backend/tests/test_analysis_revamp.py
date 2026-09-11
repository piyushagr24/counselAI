import io
import json
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import docx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.models.schemas import Obligation, DateItem, DeadlinesSummary
from app.services.extraction import extract_docx
from app.services.summarization import summarize_contract
from app.services.obligations import _deduplicate_obligations
from app.services.deadlines import _deduplicate_date_items, _merge
from app.services.risk_analysis import _deduplicate_risks
from app.services.rag import answer_question
from app.services.llm_client import _post_json, LLMError

client = TestClient(app)


def _make_docx_with_table_bytes() -> bytes:
    doc = docx.Document()
    doc.add_heading("Master Services Agreement", level=1)
    doc.add_paragraph("This Agreement is made between Provider and Client.")

    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Deliverable"
    table.cell(0, 1).text = "Fee"
    table.cell(1, 0).text = "Software License"
    table.cell(1, 1).text = "$5,000 / month"

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_docx_table_extraction_captures_tables(tmp_path):
    docx_bytes = _make_docx_with_table_bytes()
    file_path = tmp_path / "test_table.docx"
    file_path.write_bytes(docx_bytes)

    extraction = extract_docx(str(file_path))
    assert extraction["metadata"]["source_type"] == "docx"
    assert extraction["metadata"]["table_count"] == 1
    assert "Software License" in extraction["full_text"]
    assert "$5,000 / month" in extraction["full_text"]
    assert any("| Deliverable | Fee |" in s["text"] for s in extraction["segments"])


def test_summary_disk_caching(tmp_path):
    contract_id = "test-cache-contract-123"
    contract_data = {
        "full_text": "Sample master service agreement between Alpha Corp and Beta LLC.",
        "segments": [{"index": 1, "page_number": 1, "heading": "Intro", "text": "Sample text."}],
        "metadata": {"source_type": "docx", "num_pages": 1, "num_segments": 1, "char_count": 65, "word_count": 10},
    }

    with patch.object(settings, "upload_dir", str(tmp_path)):
        # Write contract extraction JSON
        json_path = tmp_path / f"{contract_id}.json"
        json_path.write_text(json.dumps(contract_data), encoding="utf-8")

        mock_llm_response = json.dumps({
            "title": "Alpha-Beta Agreement",
            "executive_summary": "Comprehensive executive agreement.",
            "contract_type": "Service Agreement",
            "contract_purpose": "Service delivery",
            "parties": ["Alpha Corp", "Beta LLC"],
            "effective_date": "2026-01-01",
            "expiration_date": "2027-01-01",
            "duration": "1 year",
            "financial_terms": "$10,000 total",
            "payment_terms": "Net 30",
            "governing_law_and_jurisdiction": "New York",
            "key_obligations": ["Provide services"],
            "termination_conditions": "30 days notice",
            "liability_and_indemnification": "Capped at fees paid",
            "dispute_resolution": "Arbitration",
            "confidentiality_terms": "3 years survival",
            "overall_risk_score": "Medium",
            "key_risks_summary": ["Short cure period"],
            "important_clauses": ["Confidentiality", "Termination"],
        })

        with patch("app.services.summarization.generate_answer", return_value=mock_llm_response) as mock_generate:
            # First call: invokes LLM and saves to cache
            res1 = summarize_contract(contract_id, force=False)
            assert mock_generate.call_count == 1
            assert res1["summary"]["title"] == "Alpha-Beta Agreement"

            # Check cache file exists
            cache_file = tmp_path / f"{contract_id}_summary.json"
            assert cache_file.exists()

            # Second call: must return cached response without calling LLM again
            res2 = summarize_contract(contract_id, force=False)
            assert mock_generate.call_count == 1  # Still 1! No new call
            assert res2["summary"]["title"] == "Alpha-Beta Agreement"

            # Third call with force=True: must re-invoke LLM
            res3 = summarize_contract(contract_id, force=True)
            assert mock_generate.call_count == 2


def test_obligations_deduplication():
    raw_obs = [
        Obligation(responsible_party="Vendor", obligation="Provide monthly reports within 5 days", deadline="5 days", category="Reporting", priority="Standard"),
        Obligation(responsible_party="Vendor", obligation="Provide monthly reports within 5 days", deadline="5 days", category="Reporting", priority="Standard"),  # exact duplicate
        Obligation(responsible_party="Client", obligation="Pay monthly invoice within 30 days", deadline="30 days", category="Payment", priority="High"),
    ]
    deduped = _deduplicate_obligations(raw_obs)
    assert len(deduped) == 2
    assert deduped[0].responsible_party == "Vendor"
    assert deduped[1].responsible_party == "Client"


def test_deadlines_deduplication_and_merge():
    d1 = DeadlinesSummary(
        contract_start_date="2026-01-01",
        payment_deadlines=[DateItem(description="Invoice due", date_or_timeframe="30 days", page_number=1)],
        other_dates=[],
    )
    d2 = DeadlinesSummary(
        contract_end_date="2027-01-01",
        payment_deadlines=[
            DateItem(description="Invoice due", date_or_timeframe="30 days", page_number=1),  # duplicate
            DateItem(description="Late fee", date_or_timeframe="60 days", page_number=2),
        ],
        other_dates=[],
    )
    merged = _merge(d1, d2)
    assert merged.contract_start_date == "2026-01-01"
    assert merged.contract_end_date == "2027-01-01"
    assert len(merged.payment_deadlines) == 2  # deduplicated from 3 to 2


def test_risks_deduplication():
    risks = [
        {"title": "Unlimited Liability", "evidence": "Neither party shall limit liability", "severity": "High"},
        {"title": "Unlimited Liability", "evidence": "Neither party shall limit liability", "severity": "High"},  # duplicate
        {"title": "One-sided Termination", "evidence": "Vendor may terminate at will", "severity": "Medium"},
    ]
    deduped = _deduplicate_risks(risks)
    assert len(deduped) == 2


def test_rag_with_conversation_history(tmp_path):
    contract_id = "test-rag-chat"
    with patch.object(settings, "upload_dir", str(tmp_path)):
        with patch("app.services.rag.query_chunks") as mock_chunks:
            mock_chunks.return_value = [
                {"text": "The Client must pay $500 monthly fee.", "page_number": 1, "heading": "Fees", "chunk_index": 0, "distance": 0.1}
            ]
            with patch("app.services.rag.generate_answer", return_value="The monthly fee is $500.") as mock_generate:
                history = [
                    {"role": "user", "content": "What is this contract about?"},
                    {"role": "assistant", "content": "This is a subscription agreement."},
                ]
                res = answer_question(contract_id, "What is the fee?", history=history)
                assert res["answer"] == "The monthly fee is $500."
                assert len(res["sources"]) == 1

                # Verify prompt passed conversation history to generate_answer
                prompt_arg = mock_generate.call_args[0][1]
                assert "<conversation_history>" in prompt_arg
                assert "What is this contract about?" in prompt_arg

