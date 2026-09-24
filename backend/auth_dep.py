"""Admin session tokens persisted in DB (survive backend restart).

Alur: POST /api/auth/login menerbitkan token acak -> hash SHA-256-nya disimpan
di tabel admin_sessions -> frontend mengirim token asli sebagai
`Authorization: Bearer <token>` -> route admin dijaga Depends(require_admin).

- Token asli tidak pernah disimpan, hanya hash-nya (bocor DB != bocor sesi).
- Expiry 7 hari; logout menghapus baris sesi. Bersih-bersih expired oportunistik
  setiap login.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from database import get_db
from models import AdminSession

_bearer = HTTPBearer(auto_error=False)
SESSION_DAYS = 7


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
