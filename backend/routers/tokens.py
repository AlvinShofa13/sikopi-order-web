import random
from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from auth_dep import require_admin
from database import get_db
from realtime import order_manager
from models import AppSetting, TokenRecord
from schemas import TokenVerifyRequest, TokenVerifyResponse

router = APIRouter(prefix="/tokens", tags=["Token Management"])


def generate_unique_3digit_token(db: Session) -> str:
    """Generate a random 3-digit token (100-999) that has not been burned."""
    used_tokens = {t.token for t in db.query(TokenRecord).filter(TokenRecord.is_used == True).all()}
    
    attempts = 0
    while attempts < 900:
        token = str(random.randint(100, 999))
        if token not in used_tokens:
            return token
        attempts += 1
    # Fallback if almost all are used
    return str(random.randint(100, 999))


@router.get("/active")
def get_active_token(db: Session = Depends(get_db)):
    """Retrieve current active 3-digit token."""
    setting = db.query(AppSetting).filter(AppSetting.key == "active_token").first()
    if not setting:
        new_token = generate_unique_3digit_token(db)
        setting = AppSetting(key="active_token", value=new_token)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return {
        "activeToken": setting.value,
        "time": datetime.now(timezone.utc).isoformat()
    }


@router.post("/generate")
async def generate_new_active_token(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Generate and rotate to a new active 3-digit token (Admin)."""
    new_token = generate_unique_3digit_token(db)
    setting = db.query(AppSetting).filter(AppSetting.key == "active_token").first()
    if setting:
        setting.value = new_token
    else:
        setting = AppSetting(key="active_token", value=new_token)
        db.add(setting)
    db.commit()

    rotated = {"activeToken": new_token, "time": datetime.now(timezone.utc).isoformat()}
    await order_manager.broadcast("TOKEN_ROTATED", rotated)
    return rotated


@router.post("/verify", response_model=TokenVerifyResponse)
async def verify_customer_token(payload: TokenVerifyRequest, db: Session = Depends(get_db)):
    """Verify customer Name & 3-digit Token."""
    clean_name = payload.name.strip()
    clean_token = payload.token.strip()

    if not clean_name:
        return TokenVerifyResponse(
            success=False,
            message="Silakan masukkan nama lengkap atau panggilan Anda."
        )

    if not clean_token:
        return TokenVerifyResponse(
            success=False,
            message="Silakan masukkan token 3 digit."
        )

    # 1. Check if token was already used / burned
    burned = db.query(TokenRecord).filter(
        TokenRecord.token == clean_token,
        TokenRecord.is_used == True
    ).first()

    if burned:
        linked_order = burned.order_id
        return TokenVerifyResponse(
            success=False,
            isCompletedOrder=True,
            orderId=linked_order,
            message=(
                f'Token "{clean_token}" sudah menyelesaikan pesanan #{linked_order}. '
                f'Mengalihkan ke rincian pesanan Anda...'
                if linked_order else
                f'Token "{clean_token}" sudah pernah digunakan dan hangus. Silakan minta token baru ke kasir.'
            )
        )

    # 2. Check against active token
    setting = db.query(AppSetting).filter(AppSetting.key == "active_token").first()
    current_active = setting.value if setting else ""

    if clean_token != current_active:
        return TokenVerifyResponse(
            success=False,
            message=f'Token "{clean_token}" tidak cocok. Silakan minta token 3 digit aktif ke kasir/admin.'
        )

    # 3. Successful match: Immediately rotate a new active token for next customer at cashier!
    new_token = generate_unique_3digit_token(db)
    if setting:
        setting.value = new_token
    else:
        db.add(AppSetting(key="active_token", value=new_token))
    db.commit()
    await order_manager.broadcast("TOKEN_ROTATED", {
        "activeToken": new_token,
        "time": datetime.now(timezone.utc).isoformat(),
    })

    return TokenVerifyResponse(
        success=True,
        message="Verifikasi berhasil! Membuka menu...",
        newToken=new_token
    )


@router.get("/burned")
def get_burned_tokens(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Retrieve all burned tokens and their associated order info (Admin)."""
    records = db.query(TokenRecord).filter(TokenRecord.is_used == True).order_by(TokenRecord.burned_at.desc()).all()
    results = {}
    for r in records:
        results[r.token] = {
            "token": r.token,
            "orderId": r.order_id,
            "customerName": r.customer_name or "Pelanggan",
            "burnedAt": r.burned_at.isoformat() if r.burned_at else None
        }
    return results
