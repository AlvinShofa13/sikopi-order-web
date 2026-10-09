import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from auth_dep import require_admin
from database import get_db
from models import AppSetting
from routers.orders import normalize_phone

router = APIRouter(prefix="/settings", tags=["Application Settings"])


class BrandingSettingsPayload(BaseModel):
    brand_icon: Optional[str] = "leaf"
    brand_name: Optional[str] = "SIKopi"


def _get(db: Session, key: str, default: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else default


@router.get("/branding")
def get_branding_settings(db: Session = Depends(get_db)):
    """Retrieve current branding configuration (icon and name)."""
    return {
        "brand_icon": _get(db, "brand_icon", "leaf"),
        "brand_name": _get(db, "brand_name", "SIKopi"),
    }


@router.get("/public")
def get_public_settings(db: Session = Depends(get_db)):
    """Konfigurasi yang boleh dilihat customer: nama kafe, mode operasional,
    batch Open PO aktif, dan nomor WhatsApp admin (dari .env)."""
    from routers.preorder import mode_payload  # import lokal: cegah siklus import

    return {
        "brand_name": _get(db, "brand_name", "SIKopi"),
        "brand_icon": _get(db, "brand_icon", "leaf"),
        "admin_whatsapp": normalize_phone(os.getenv("ADMIN_WHATSAPP")),
        **mode_payload(db),
    }


@router.put("/branding")
def update_branding_settings(
    payload: BrandingSettingsPayload,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """Update branding configuration (Admin). Default is leaf icon."""
    target_icon = payload.brand_icon.strip() if payload.brand_icon else "leaf"
    target_name = payload.brand_name.strip() if payload.brand_name else "SIKopi"

    for key, value in (("brand_icon", target_icon), ("brand_name", target_name)):
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))

    db.commit()
    return {"brand_icon": target_icon, "brand_name": target_name}
