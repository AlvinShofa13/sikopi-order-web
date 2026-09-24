from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import AppSetting

router = APIRouter(prefix="/settings", tags=["Application Settings"])


class BrandingSettingsPayload(BaseModel):
    brand_icon: Optional[str] = "leaf"
    brand_name: Optional[str] = "SIKopi"


@router.get("/branding")
def get_branding_settings(db: Session = Depends(get_db)):
    """Retrieve current branding configuration (icon and name)."""
    icon_row = db.query(AppSetting).filter(AppSetting.key == "brand_icon").first()
    name_row = db.query(AppSetting).filter(AppSetting.key == "brand_name").first()

    return {
        "brand_icon": icon_row.value if icon_row else "leaf",
        "brand_name": name_row.value if name_row else "SIKopi"
    }


@router.put("/branding")
def update_branding_settings(payload: BrandingSettingsPayload, db: Session = Depends(get_db)):
    """Update branding configuration (Admin). Default is leaf icon."""
    target_icon = payload.brand_icon.strip() if payload.brand_icon else "leaf"
    target_name = payload.brand_name.strip() if payload.brand_name else "SIKopi"

    # Update or insert brand_icon
    icon_row = db.query(AppSetting).filter(AppSetting.key == "brand_icon").first()
    if not icon_row:
        icon_row = AppSetting(key="brand_icon", value=target_icon)
        db.add(icon_row)
    else:
        icon_row.value = target_icon

    # Update or insert brand_name
    name_row = db.query(AppSetting).filter(AppSetting.key == "brand_name").first()
    if not name_row:
        name_row = AppSetting(key="brand_name", value=target_name)
        db.add(name_row)
    else:
        name_row.value = target_name

    db.commit()
    db.refresh(icon_row)
    db.refresh(name_row)

    return {
        "brand_icon": icon_row.value,
        "brand_name": name_row.value
    }
