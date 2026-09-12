import io
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pymupdf
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _auth_headers(email: str = "tester@example.com", password: str = "password123") -> dict:
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": email, "password": password, "name": email.split("@")[0].title()},
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


def _real_pdf_bytes() -> bytes:
    pdf = pymupdf.open()
    pdf.new_page().insert_text((72, 72), "Sample contract text.")
    data = pdf.tobytes()
    pdf.close()
    return data


def test_upload_requires_auth():
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("demo.pdf", io.BytesIO(_real_pdf_bytes()), "application/pdf")},
    )
    assert response.status_code == 401


def test_upload_valid_pdf():
    headers = _auth_headers("alice@example.com")
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("demo.pdf", io.BytesIO(_real_pdf_bytes()), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "demo.pdf"
    assert body["status"] == "uploaded"


def test_upload_rejects_bad_extension():
    headers = _auth_headers("alice@example.com")
    fake_file = io.BytesIO(b"not a contract")
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("notes.txt", fake_file, "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_upload_rejects_empty_file():
    headers = _auth_headers("alice@example.com")
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("empty.pdf", empty_file, "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 400


def test_user_isolation_between_accounts():
    headers_alice = _auth_headers("user_alice@example.com")
    headers_bob = _auth_headers("user_bob@example.com")

    # Bob starts with 0 contracts
    res_bob_list = client.get("/api/contracts", headers=headers_bob)
    assert res_bob_list.status_code == 200
    bob_contracts_initial = [c for c in res_bob_list.json()]

    # Alice uploads a contract
    res_upload = client.post(
        "/api/contracts/upload",
        files={"file": ("alice_contract.pdf", io.BytesIO(_real_pdf_bytes()), "application/pdf")},
        headers=headers_alice,
    )
    assert res_upload.status_code == 200
    contract_id = res_upload.json()["contract_id"]

    # Alice can see it
    res_alice_list = client.get("/api/contracts", headers=headers_alice)
    assert res_alice_list.status_code == 200
    alice_ids = [c["contract_id"] for c in res_alice_list.json()]
    assert contract_id in alice_ids

    # Bob CANNOT see Alice's contract in his list
    res_bob_list = client.get("/api/contracts", headers=headers_bob)
    assert res_bob_list.status_code == 200
    bob_ids = [c["contract_id"] for c in res_bob_list.json()]
    assert contract_id not in bob_ids

    # Bob CANNOT access Alice's contract by ID (404)
    res_bob_get = client.get(f"/api/contracts/{contract_id}", headers=headers_bob)
    assert res_bob_get.status_code == 404
