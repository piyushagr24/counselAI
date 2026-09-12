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


def _auth_headers(email: str = "tester_enh@example.com", password: str = "password123") -> dict:
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": email, "password": password, "name": "Enhancement Tester"},
    )
    if signup_res.status_code == 200:
        tok = signup_res.json()["access_token"]
    else:
        login_res = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        tok = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_magic_bytes_validation():
    headers = _auth_headers()
    # 1. Reject fake PDF
    fake_pdf = io.BytesIO(b"NOT A REAL PDF FILE CONTENT")
    res = client.post(
        "/api/contracts/upload",
        files={"file": ("spoofed.pdf", fake_pdf, "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 400
    assert "Corrupted or invalid PDF" in res.json()["detail"]

    # 2. Reject fake DOCX
    fake_docx = io.BytesIO(b"NOT A REAL ZIP OR DOCX CONTENT")
    res = client.post(
        "/api/contracts/upload",
        files={"file": ("spoofed.docx", fake_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers,
    )
    assert res.status_code == 400
    assert "Corrupted or invalid DOCX" in res.json()["detail"]


def test_dashboard_stats_endpoint():
    headers = _auth_headers()
    res = client.get("/api/contracts/stats", headers=headers)
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
    headers = _auth_headers()
    # Upload two real contracts
    pdf1 = _real_pdf_bytes("Contract version 1 with initial terms and $1000 fee.")
    pdf2 = _real_pdf_bytes("Contract version 2 with modified terms and $2000 fee.")

    res1 = client.post(
        "/api/contracts/upload",
        files={"file": ("v1.pdf", io.BytesIO(pdf1), "application/pdf")},
        headers=headers,
    )
    assert res1.status_code == 200
    id1 = res1.json()["contract_id"]

    res2 = client.post(
        "/api/contracts/upload",
        files={"file": ("v2.pdf", io.BytesIO(pdf2), "application/pdf")},
        headers=headers,
    )
    assert res2.status_code == 200
    id2 = res2.json()["contract_id"]

    # Compare by IDs
    cmp_res = client.post(
        "/api/contracts/compare-ids",
        json={"contract_a_id": id1, "contract_b_id": id2},
        headers=headers,
    )
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["contract_a_id"] == id1
    assert cmp_data["contract_b_id"] == id2
    assert "changes" in cmp_data
    assert "ai_summary" in cmp_data

    # Test delete endpoint
    del_res1 = client.delete(f"/api/contracts/{id1}", headers=headers)
    assert del_res1.status_code == 204

    del_res2 = client.delete(f"/api/contracts/{id2}", headers=headers)
    assert del_res2.status_code == 204

    # Verify deleted contract is gone
    get_res = client.get(f"/api/contracts/{id1}", headers=headers)
    assert get_res.status_code == 404


def test_truncated_json_array_recovery():
    from app.utils.json_parsing import extract_list_loose

    raw = (
        '[\n'
        '  {"title": "Risk 1", "severity": "High", "explanation": "Exp 1", "evidence": "Ev 1"},\n'
        '  {"title": "Risk 2", "severity": "Medium", "explanation": "Exp 2", "evidence": "Ev 2"},\n'
        '  {"title": "Risk 3", "severity": "Low", "explanation": "Cut off mid'
    )
    items = extract_list_loose(raw)
    assert len(items) == 2
    assert items[0]["title"] == "Risk 1"
    assert items[1]["title"] == "Risk 2"


def test_risk_finding_severity_normalization():
    from app.models.schemas import RiskFinding

    r_med = RiskFinding(title="T", severity="medium", explanation="E", evidence="Ev")
    assert r_med.severity == "Medium"

    r_hi = RiskFinding(title="T", severity="HIGH", explanation="E", evidence=None)
    assert r_hi.severity == "High"
    assert r_hi.evidence == ""

    r_crit = RiskFinding(title="T", severity="critical severity", explanation="E")
    assert r_crit.severity == "Critical"

    r_low = RiskFinding(title="T", severity="low", explanation="E")
    assert r_low.severity == "Low"
