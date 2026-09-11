import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pymupdf
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _real_pdf_bytes(text: str = "Standard agreement text.") -> bytes:
    pdf = pymupdf.open()
    pdf.new_page().insert_text((72, 72), text)
    data = pdf.tobytes()
    pdf.close()
    return data


def test_magic_bytes_validation():
    # 1. Reject fake PDF
    fake_pdf = io.BytesIO(b"NOT A REAL PDF FILE CONTENT")
    res = client.post(
        "/api/contracts/upload",
        files={"file": ("spoofed.pdf", fake_pdf, "application/pdf")},
    )
    assert res.status_code == 400
    assert "Corrupted or invalid PDF" in res.json()["detail"]

    # 2. Reject fake DOCX
    fake_docx = io.BytesIO(b"NOT A REAL ZIP OR DOCX CONTENT")
    res = client.post(
        "/api/contracts/upload",
        files={"file": ("spoofed.docx", fake_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert res.status_code == 400
    assert "Corrupted or invalid DOCX" in res.json()["detail"]


def test_dashboard_stats_endpoint():
    res = client.get("/api/contracts/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_contracts" in data
    assert "total_pages" in data
    assert "total_risks" in data
    assert "high_risk_count" in data
    assert "total_obligations" in data
    assert "total_deadlines" in data
    assert data["total_contracts"] >= 0


def test_compare_by_id_and_delete_flow():
    # Upload two real contracts
    pdf1 = _real_pdf_bytes("Contract version 1 with initial terms and $1000 fee.")
    pdf2 = _real_pdf_bytes("Contract version 2 with modified terms and $2000 fee.")

    res1 = client.post(
        "/api/contracts/upload",
        files={"file": ("v1.pdf", io.BytesIO(pdf1), "application/pdf")},
    )
    assert res1.status_code == 200
    id1 = res1.json()["contract_id"]

    res2 = client.post(
        "/api/contracts/upload",
        files={"file": ("v2.pdf", io.BytesIO(pdf2), "application/pdf")},
    )
    assert res2.status_code == 200
    id2 = res2.json()["contract_id"]

    # Compare by IDs
    cmp_res = client.post(
        "/api/contracts/compare-ids",
        json={"contract_a_id": id1, "contract_b_id": id2},
    )
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["contract_a_id"] == id1
    assert cmp_data["contract_b_id"] == id2
    assert "changes" in cmp_data
    assert "ai_summary" in cmp_data

    # Test delete endpoint
    del_res1 = client.delete(f"/api/contracts/{id1}")
    assert del_res1.status_code == 204

    del_res2 = client.delete(f"/api/contracts/{id2}")
    assert del_res2.status_code == 204

    # Verify deleted contract is gone
    get_res = client.get(f"/api/contracts/{id1}")
    assert get_res.status_code == 404
