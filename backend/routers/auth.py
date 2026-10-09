import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from auth_dep import (
    clear_fails,
    client_ip,
    issue_admin_token,
    prune_fails,
    record_fail,
    revoke_admin_token,
)
from database import get_db
from schemas import AdminLoginRequest, AdminLoginResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILS_PER_ACCOUNT = 15
MAX_FAILS_PER_IP = 60


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    req_email = payload.email.strip().lower()
    ip = client_ip(request)
    key = f"{ip}|{req_email}"
    if prune_fails(key) >= MAX_FAILS_PER_IP or prune_fails(f"acct:{req_email}") >= MAX_FAILS_PER_ACCOUNT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak percobaan login. Coba lagi dalam 5 menit."
        )

    # Fail closed: credentials must come from environment, never hardcoded.
    admin_email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    admin_password = (os.getenv("ADMIN_PASSWORD") or "").strip()
    if not admin_email or not admin_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server belum dikonfigurasi (ADMIN_EMAIL / ADMIN_PASSWORD kosong)."
        )

    req_password = payload.password.strip()

    if req_email == admin_email and req_password == admin_password:
        clear_fails(key)
        clear_fails(f"acct:{req_email}")
        clear_fails(f"ip:{ip}")
        return AdminLoginResponse(
            success=True,
            message="Autentikasi admin berhasil.",
            token=issue_admin_token(db, admin_email),
            email=admin_email,
            name="Kasir & Admin sikopi",
            role="Admin & Kasir"
        )

    record_fail(key)
    record_fail(f"acct:{req_email}")
    record_fail(f"ip:{ip}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email atau password admin salah."
    )


@router.post("/logout")
def admin_logout(request: Request, db: Session = Depends(get_db)):
    auth = (request.headers.get("authorization") or "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    revoke_admin_token(db, token)
    return {"success": True}
