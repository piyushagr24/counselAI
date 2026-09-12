import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.services.rag import answer_question

client = TestClient(app)


def _auth_headers(email: str = "tester_qa@example.com", password: str = "password123") -> dict:
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": email, "password": password, "name": "QA Tester"},
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


def test_ask_general_endpoint():
    """Verify general questions can be sent to /api/contracts/ask without a contract ID."""
    headers = _auth_headers()
    response = client.post(
        "/api/contracts/ask",
        json={"question": "What is a Non-Disclosure Agreement (NDA)?"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 10
    # Must not reject with the fallback sentence
    assert "I could not find this information in the uploaded contract" not in data["answer"]


def test_ask_general_contract_id_route():
    """Verify route /api/contracts/general/ask also handles general legal inquiries."""
    headers = _auth_headers()
    response = client.post(
        "/api/contracts/general/ask",
        json={"question": "What is an indemnification clause in contract law?"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 10
    assert "I could not find this information in the uploaded contract" not in data["answer"]


def test_ask_empty_question_rejected():
    """Verify whitespace or empty questions return HTTP 400."""
    headers = _auth_headers()
    response = client.post(
        "/api/contracts/ask",
        json={"question": "   "},
        headers=headers,
    )
    assert response.status_code == 400
    assert "Question must not be empty" in response.json()["detail"]


def test_conversational_memory_followup_without_contract():
    """Verify multi-turn memory works for follow-up explanations."""
    history = [
        {"role": "user", "content": "What does force majeure mean?"},
        {
            "role": "assistant",
            "content": "Force majeure excuses performance due to extraordinary events beyond party control.",
        },
    ]
    res = answer_question(
        contract_id="general",
        question="Can you give an example of that?",
        history=history,
    )
    assert "answer" in res
    assert len(res["answer"]) > 10
    assert "I could not find this information in the uploaded contract" not in res["answer"]
