import os
import time
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from auth_dep import issue_admin_token, revoke_admin_token
from database import get_db
from schemas import AdminLoginRequest, AdminLoginResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Rate limit login: max 15x gagal per 5 menit per akun, plus 60x per IP
# (vite proxy membuat semua dev terlihat dari 127.0.0.1 — kunci per akun
# mencegah satu pelaku mengunci admin yang sah).
# ponytail: in-memory per proses; cukup untuk 1 instance kasir.
_FAILS: dict[str, list[float]] = {}
MAX_FAILS_PER_ACCOUNT = 15
MAX_FAILS_PER_IP = 60
WINDOW_SEC = 300


def _client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


def _prune(ip: str, key: str) -> int:
    now = time.monotonic()
    for k in (ip, key):
        _FAILS[k] = [t for t in _FAILS.get(k, []) if now - t < WINDOW_SEC]
    return max(len(_FAILS[ip]), len(_FAILS[key]))


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    req_email = payload.email.strip().lower()
    ip = _client_ip(request)
    key = f"{ip}|{req_email}"
    if _prune(ip, key) >= MAX_FAILS_PER_IP or len(_FAILS[key]) >= MAX_FAILS_PER_ACCOUNT:
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

    req_email = payload.email.strip().lower()
    req_password = payload.password.strip()

    if req_email == admin_email and req_password == admin_password:
        _FAILS.pop(ip, None)
        _FAILS.pop(key, None)
        return AdminLoginResponse(
            success=True,
            message="Autentikasi admin berhasil.",
            token=issue_admin_token(db, admin_email),
            email=admin_email,
            name="Kasir & Admin sikopi",
            role="Admin & Kasir"
        )

    now = time.monotonic()
    _FAILS.setdefault(ip, []).append(now)
    _FAILS.setdefault(key, []).append(now)
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
