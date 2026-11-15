"""Satu-satunya mode operasional yang aktif (saling eksklusif):
- `pos`      : on-site / hari jualan, pesan lalu bayar di kasir.
- `preorder` : Open PO per batch, wajib bayar & upload bukti sebelum pesanan tercatat.

Customer tidak memilih mode — channel pesanan selalu mengikuti mode aktif
global. Hanya boleh ada satu batch Open PO berstatus `open` pada satu waktu;
pesanan preorder otomatis masuk ke batch aktif tersebut.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_dep import require_admin
from database import get_db
from models import AppSetting, PreorderBatch
from schemas import ModeSwitchRequest, PreorderBatchCreate, PreorderBatchUpdate

router = APIRouter(prefix="/preorder", tags=["Preorder & Mode"])

ACTIVE_MODE_KEY = "active_mode"
MODE_POS = "pos"
MODE_PREORDER = "preorder"


def get_active_mode(db: Session) -> str:
    """Mode aktif global. Inferensi sekali dari flag lama bila key baru belum ada."""
    row = db.query(AppSetting).filter(AppSetting.key == ACTIVE_MODE_KEY).first()
    if row and str(row.value).strip().lower() in (MODE_POS, MODE_PREORDER):
        return str(row.value).strip().lower()
    legacy_pre = db.query(AppSetting).filter(AppSetting.key == "preorder_mode_enabled").first()
    legacy_pos = db.query(AppSetting).filter(AppSetting.key == "pos_mode_enabled").first()
    pre_on = legacy_pre is None or str(legacy_pre.value).strip().lower() in ("1", "true", "yes", "on")
    pos_on = legacy_pos is None or str(legacy_pos.value).strip().lower() in ("1", "true", "yes", "on")
    inferred = MODE_PREORDER if (pre_on and not pos_on) else MODE_POS
    set_active_mode(db, inferred)
    return inferred


def set_active_mode(db: Session, mode: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == ACTIVE_MODE_KEY).first()
    if row:
        row.value = mode
    else:
        db.add(AppSetting(key=ACTIVE_MODE_KEY, value=mode))


def active_batch(db: Session) -> Optional[PreorderBatch]:
    return (
        db.query(PreorderBatch)
        .filter(PreorderBatch.status == "open")
        .order_by(PreorderBatch.id.desc())
        .first()
    )


def _to_utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Konversi datetime (aware/naive) ke UTC naive untuk penyimpanan database."""
    if not dt:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Pastikan ISO string menyertakan offset UTC (+00:00) agar browser mengonversi ke zona lokal."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def serialize_batch(batch: Optional[PreorderBatch]) -> Optional[dict[str, Any]]:
    if not batch:
        return None
    return {
        "id": batch.id,
        "name": batch.name,
        "status": batch.status,
        "notes": batch.notes or "",
        "orderDeadline": _utc_iso(batch.order_deadline),
        "pickupDate": _utc_iso(batch.pickup_date),
        "createdAt": _utc_iso(batch.created_at),
    }


def mode_payload(db: Session) -> dict[str, Any]:
    return {
        "mode": get_active_mode(db),
        "batch": serialize_batch(active_batch(db)),
    }


class BatchCreateResponse(BaseModel):
    success: bool
    message: str
    batch: dict[str, Any]


@router.get("/modes")
def get_modes(db: Session = Depends(get_db)):
    """Mode aktif + batch Open PO aktif (publik, dipakai halaman menu & checkout)."""
    return mode_payload(db)


@router.put("/modes")
def update_modes(payload: ModeSwitchRequest, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Ganti mode operasional global (Admin). Hanya satu yang aktif."""
    mode = (payload.mode or "").strip().lower()
    if mode not in (MODE_POS, MODE_PREORDER):
        raise HTTPException(status_code=422, detail="Mode tidak dikenal. Pilih 'pos' atau 'preorder'.")
    set_active_mode(db, mode)
    db.commit()
    return mode_payload(db)


@router.get("/batches")
def list_batches(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Semua batch Open PO beserta statusnya (Admin)."""
    rows = db.query(PreorderBatch).order_by(PreorderBatch.id.desc()).all()
    return [serialize_batch(b) for b in rows]


@router.post("/batches", response_model=BatchCreateResponse, status_code=status.HTTP_201_CREATED)
def create_batch(payload: PreorderBatchCreate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Buat batch Open PO baru. Jika activate_now=False, batch masuk antrean ('scheduled') tanpa menutup batch aktif."""
    clean_name = (payload.name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=422, detail="Nama batch wajib diisi.")

    target_status = "open" if payload.activate_now else "scheduled"
    if payload.activate_now:
        previous = active_batch(db)
        if previous:
            previous.status = "closed"

    batch = PreorderBatch(
        name=clean_name,
        notes=(payload.notes or "").strip() or None,
        order_deadline=_to_utc_naive(payload.order_deadline),
        pickup_date=_to_utc_naive(payload.pickup_date),
        status=target_status,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    msg = (
        "Batch Open PO dibuka. Customer masuk otomatis ke batch ini."
        if target_status == "open"
        else "Batch ditambahkan ke daftar antrean tanpa menutup batch yang sedang aktif."
    )
    return BatchCreateResponse(
        success=True,
        message=msg,
        batch=serialize_batch(batch),
    )


@router.put("/batches/{batch_id}")
def update_batch(batch_id: int, payload: PreorderBatchUpdate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Perbarui data batch Open PO yang sudah dibuat (Admin)."""
    batch = db.query(PreorderBatch).filter(PreorderBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        clean_name = (data["name"] or "").strip()
        if not clean_name:
            raise HTTPException(status_code=422, detail="Nama batch wajib diisi.")
        batch.name = clean_name
    if "order_deadline" in data:
        batch.order_deadline = _to_utc_naive(data["order_deadline"])
    if "pickup_date" in data:
        batch.pickup_date = _to_utc_naive(data["pickup_date"])
    if "notes" in data:
        batch.notes = (data["notes"] or "").strip() or None

    db.commit()
    db.refresh(batch)
    return {"success": True, "batch": serialize_batch(batch)}


@router.patch("/batches/{batch_id}/close")
def close_batch(batch_id: int, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Tutup batch -> customer tidak bisa memesan Open PO lagi (Admin)."""
    batch = db.query(PreorderBatch).filter(PreorderBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan.")
    batch.status = "closed"
    db.commit()
    db.refresh(batch)
    return {"success": True, "batch": serialize_batch(batch)}


@router.patch("/batches/{batch_id}/reopen")
def reopen_batch(batch_id: int, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Buka kembali batch yang ditutup (Admin)."""
    batch = db.query(PreorderBatch).filter(PreorderBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan.")
    other = active_batch(db)
    if other and other.id != batch.id:
        other.status = "closed"
    batch.status = "open"
    db.commit()
    db.refresh(batch)
    return {"success": True, "batch": serialize_batch(batch)}