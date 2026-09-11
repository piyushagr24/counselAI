import io
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pymupdf
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _real_pdf_bytes() -> bytes:
    pdf = pymupdf.open()
    pdf.new_page().insert_text((72, 72), "Sample contract text.")
    data = pdf.tobytes()
    pdf.close()
    return data


def test_upload_valid_pdf():
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("demo.pdf", io.BytesIO(_real_pdf_bytes()), "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "demo.pdf"
    assert body["status"] == "uploaded"


def test_upload_rejects_bad_extension():
    fake_file = io.BytesIO(b"not a contract")
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("notes.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400


def test_upload_rejects_empty_file():
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/contracts/upload",
        files={"file": ("empty.pdf", empty_file, "application/pdf")},
    )
    assert response.status_code == 400
