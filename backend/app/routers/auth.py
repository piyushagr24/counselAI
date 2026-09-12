import json
import os
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr

from app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERS_FILE = os.path.join(settings.upload_dir, "users.json")


def _load_users() -> dict:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_users(users: dict) -> None:
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _generate_token(user: dict) -> str:
    salt = hashlib.md5(user["email"].encode()).hexdigest()[:8]
    return f"counsel_tok_{user['id']}_{salt}"


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency to enforce authentication and extract the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated. Please sign in.")

    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
    else:
        token = authorization.strip()

    users = _load_users()
    for u in users.values():
        if token == _generate_token(u):
            return u

    raise HTTPException(status_code=401, detail="Session expired or invalid token. Please sign in.")


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
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    pw_hash = _hash_password(payload.password)
    if user.get("password_hash") != pw_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = _generate_token(user)
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
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    user_name = payload.name.strip() if payload.name and payload.name.strip() else email_key.split("@")[0].replace(".", " ").title()
    new_user = {
        "id": f"usr_{uuid.uuid4().hex[:10]}",
        "email": email_key,
        "name": user_name,
        "password_hash": _hash_password(payload.password),
        "role": "Legal Professional",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users[email_key] = new_user
    _save_users(users)

    token = _generate_token(new_user)
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
def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user.get("name") or current_user["email"].split("@")[0].title(),
        role=current_user.get("role", "Legal Professional"),
        created_at=current_user.get("created_at"),
    )
