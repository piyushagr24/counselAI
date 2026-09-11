import json
import os
import hashlib
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

from app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERS_FILE = os.path.join(settings.upload_dir, "users.json")

# In-memory fallback and seed users
DEFAULT_USERS = {
    "jane.doe@legalcorp.com": {
        "id": "usr_demo_1",
        "email": "jane.doe@legalcorp.com",
        "name": "Jane Doe",
        "password_hash": hashlib.sha256("counsel123".encode()).hexdigest(),
        "role": "Senior Legal Counsel",
        "created_at": "2026-01-15T10:00:00Z",
    }
}


def _load_users() -> dict:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_USERS.copy()
    return DEFAULT_USERS.copy()


def _save_users(users: dict) -> None:
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: Optional[str] = "Legal Analyst"
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    email_key = payload.email.lower().strip()
    users = _load_users()

    user = users.get(email_key)
    pw_hash = _hash_password(payload.password)

    # If user doesn't exist yet, we can either reject or auto-register for a friendly dev experience.
    # We authenticate against stored password if user exists:
    if user:
        if user["password_hash"] != pw_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    else:
        # Create user account automatically if it's the first time
        user_name = email_key.split("@")[0].replace(".", " ").title()
        user = {
            "id": f"usr_{uuid.uuid4().hex[:8]}",
            "email": email_key,
            "name": user_name,
            "password_hash": pw_hash,
            "role": "Legal Professional",
            "created_at": "2026-09-12T00:00:00Z",
        }
        users[email_key] = user
        _save_users(users)

    token = f"counsel_tok_{user['id']}_{hashlib.md5(user['email'].encode()).hexdigest()[:8]}"
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name") or user["email"].split("@")[0].title(),
            role=user.get("role", "Legal Professional"),
            created_at=user.get("created_at"),
        ),
    )


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest):
    email_key = payload.email.lower().strip()
    users = _load_users()

    if email_key in users:
        # If already exists, verify password and log in
        return login(LoginRequest(email=payload.email, password=payload.password))

    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    user_name = payload.name.strip() if payload.name and payload.name.strip() else email_key.split("@")[0].replace(".", " ").title()
    new_user = {
        "id": f"usr_{uuid.uuid4().hex[:8]}",
        "email": email_key,
        "name": user_name,
        "password_hash": _hash_password(payload.password),
        "role": "Legal Professional",
        "created_at": "2026-09-12T00:00:00Z",
    }
    users[email_key] = new_user
    _save_users(users)

    token = f"counsel_tok_{new_user['id']}_{hashlib.md5(new_user['email'].encode()).hexdigest()[:8]}"
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=new_user["id"],
            email=new_user["email"],
            name=new_user["name"],
            role=new_user["role"],
            created_at=new_user["created_at"],
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        # Return default demo user if not provided
        users = _load_users()
        demo = users.get("jane.doe@legalcorp.com", DEFAULT_USERS["jane.doe@legalcorp.com"])
        return UserResponse(
            id=demo["id"],
            email=demo["email"],
            name=demo["name"],
            role=demo.get("role"),
            created_at=demo.get("created_at"),
        )

    token = authorization.replace("Bearer ", "").strip()
    users = _load_users()
    for u in users.values():
        expected_token = f"counsel_tok_{u['id']}_{hashlib.md5(u['email'].encode()).hexdigest()[:8]}"
        if token == expected_token:
            return UserResponse(
                id=u["id"],
                email=u["email"],
                name=u["name"],
                role=u.get("role"),
                created_at=u.get("created_at"),
            )

    # Fallback to demo user
    demo = users.get("jane.doe@legalcorp.com", DEFAULT_USERS["jane.doe@legalcorp.com"])
    return UserResponse(
        id=demo["id"],
        email=demo["email"],
        name=demo["name"],
        role=demo.get("role"),
        created_at=demo.get("created_at"),
    )
