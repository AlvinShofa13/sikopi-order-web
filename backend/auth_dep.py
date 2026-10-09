"""Admin session tokens persisted in DB (survive backend restart).

Alur: POST /api/auth/login menerbitkan token acak -> hash SHA-256-nya disimpan
di tabel admin_sessions -> frontend mengirim token asli sebagai
`Authorization: Bearer <token>` -> route admin dijaga Depends(require_admin).

- Token asli tidak pernah disimpan, hanya hash-nya (bocor DB != bocor sesi).
- Expiry 7 hari; logout menghapus baris sesi. Bersih-bersih expired oportunistik
  setiap login.

Modul ini juga pemilik rate limiter in-memory yang dipakai bersama oleh login
admin dan pembacaan detail pesanan publik.
"""

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from database import get_db
from models import AdminSession

_bearer = HTTPBearer(auto_error=False)
SESSION_DAYS = 7

# Rate limit in-memory per proses (cukup untuk 1 instance kasir).
# Login: maks 15x gagal per akun / 5 menit, 60x per IP (vite proxy membuat
# semua dev terlihat dari 127.0.0.1 -> kunci per akun mencegah satu pelaku
# mengunci admin yang sah).
# Detail pesanan: reader publik berbasis kode, batasi 60x/IP per 5 menit.
FAILS: dict[str, list[float]] = {}
WINDOW_SEC = 300


def client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


def prune_fails(key: str) -> int:
    """Buang entri di luar jendela waktu, return jumlah Percobaan terkini."""
    now = time.monotonic()
    for k in (key,):
        FAILS[k] = [t for t in FAILS.get(k, []) if now - t < WINDOW_SEC]
    return len(FAILS[key])


def record_fail(key: str) -> None:
    FAILS.setdefault(key, []).append(time.monotonic())


def clear_fails(key: str) -> None:
    FAILS.pop(key, None)


def _utcnow_naive() -> datetime:
    # SQLite mengembalikan DateTime naive; bandingkan selalu naive-UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash(token: str) -> str:
    return hashlib.sha256((token or "").encode()).hexdigest()


def issue_admin_token(db: Session, email: str = "") -> str:
    token = f"sikopi_adm_{secrets.token_hex(16)}"
    db.add(AdminSession(
        token_hash=_hash(token),
        email=email or None,
        expires_at=_utcnow_naive() + timedelta(days=SESSION_DAYS),
    ))
    db.query(AdminSession).filter(AdminSession.expires_at < _utcnow_naive()).delete()
    db.commit()
    return token


def revoke_admin_token(db: Session, token: str) -> None:
    db.query(AdminSession).filter(AdminSession.token_hash == _hash(token)).delete()
    db.commit()


def _lookup(db: Session, token: str):
    row = db.query(AdminSession).filter(AdminSession.token_hash == _hash(token)).first()
    if not row:
        return None
    if row.expires_at is None or row.expires_at < _utcnow_naive():
        db.delete(row)
        db.commit()
        return None
    return row


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
):
    if not creds or not _lookup(db, creds.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Butuh login admin.",
        )
    return True


def is_valid_admin_token(db: Session, token: str | None) -> bool:
    return _lookup(db, token or "") is not None
