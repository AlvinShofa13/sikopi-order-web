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
from sqlalchemy.orm import Session, joinedload

from auth_dep import require_admin
from database import get_db
from models import AppSetting, MenuItem, Order, PreorderBatch
from schemas import ModeSwitchRequest, PauseOrderingRequest, PreorderBatchCreate, PreorderBatchUpdate

router = APIRouter(prefix="/preorder", tags=["Preorder & Mode"])

ACTIVE_MODE_KEY = "active_mode"
MODE_POS = "pos"
MODE_PREORDER = "preorder"
ORDERING_PAUSED_KEY = "ordering_paused"
PAUSE_MESSAGE_KEY = "pause_message"
DEFAULT_PAUSE_MESSAGE = "Pemesanan sedang dijeda sementara. Anda masih dapat melihat-lihat menu."


def is_ordering_paused(db: Session) -> bool:
    row = db.query(AppSetting).filter(AppSetting.key == ORDERING_PAUSED_KEY).first()
    return bool(row and str(row.value).strip().lower() in ("1", "true", "yes", "on"))


def get_pause_message(db: Session) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == PAUSE_MESSAGE_KEY).first()
    msg = (row.value or "").strip() if row else ""
    return msg or DEFAULT_PAUSE_MESSAGE


def set_ordering_pause(db: Session, paused: bool, message: Optional[str] = None) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == ORDERING_PAUSED_KEY).first()
    val = "true" if paused else "false"
    if row:
        row.value = val
    else:
        db.add(AppSetting(key=ORDERING_PAUSED_KEY, value=val))
    if message is not None:
        clean_msg = message.strip()
        msg_row = db.query(AppSetting).filter(AppSetting.key == PAUSE_MESSAGE_KEY).first()
        if msg_row:
            msg_row.value = clean_msg
        else:
            db.add(AppSetting(key=PAUSE_MESSAGE_KEY, value=clean_msg))


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
        "paused": is_ordering_paused(db),
        "pause_message": get_pause_message(db),
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


@router.put("/pause")
def update_pause_state(payload: PauseOrderingRequest, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Jeda atau lanjutkan pemesanan pelanggan (mode lihat-lihat saja) (Admin)."""
    set_ordering_pause(db, payload.paused, payload.message)
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


def _classify_recap_group(category: str, name: str) -> str:
    txt = f"{category} {name}".lower()
    drink_keys = ("kopi", "minuman", "drink", "beverage", "tea", "teh", "matcha", "latte", "espresso", "americano", "coklat", "chocolate", "susu")
    if any(k in txt for k in drink_keys):
        return "minuman"
    return "makanan"


def _build_recap_payload(
    db: Session,
    orders: list[Order],
    *,
    batch: Optional[PreorderBatch] = None,
    title: str = "",
) -> dict[str, Any]:
    """Susun payload rekap pesanan (dipakai bersama oleh rekap per batch dan rekap On-site)."""
    loc_row = db.query(AppSetting).filter(AppSetting.key == "pickup_location").first()
    global_pickup_loc = (loc_row.value if loc_row and loc_row.value else "").strip()
    menu_rows = db.query(MenuItem.id, MenuItem.name, MenuItem.category).all()
    cat_by_id = {m.id: (m.category or "") for m in menu_rows}
    cat_by_name = {m.name: (m.category or "") for m in menu_rows}

    active_orders = [o for o in orders if (o.order_status or "") not in ("Batal", "Dibatalkan")]
    cancelled_count = len(orders) - len(active_orders)
    paid_orders = sum(1 for o in active_orders if o.is_paid)
    unpaid_orders = len(active_orders) - paid_orders
    total_revenue = sum(float(o.total or 0.0) for o in active_orders)
    paid_revenue = sum(float(o.total or 0.0) for o in active_orders if o.is_paid)

    item_map: dict[str, dict[str, Any]] = {}
    for ord in active_orders:
        for it in ord.items:
            cat = cat_by_id.get(it.menu_item_id) or cat_by_name.get(it.name) or ""
            grp = _classify_recap_group(cat, it.name)
            entry = item_map.setdefault(
                it.name,
                {"name": it.name, "category": cat, "group": grp, "total_qty": 0, "total_revenue": 0.0, "variants_map": {}},
            )
            qty = int(it.quantity or 0)
            entry["total_qty"] += qty
            entry["total_revenue"] += float(it.subtotal or 0.0)
            note_key = (it.notes or "").strip() or "Standar (tanpa varian/catatan)"
            entry["variants_map"][note_key] = entry["variants_map"].get(note_key, 0) + qty

    items_summary = []
    for entry in sorted(item_map.values(), key=lambda x: (-x["total_qty"], x["name"])):
        breakdown = [
            {"label": lbl, "qty": q}
            for lbl, q in sorted(entry["variants_map"].items(), key=lambda kv: (-kv[1], kv[0]))
        ]
        items_summary.append({
            "name": entry["name"],
            "category": entry["category"],
            "group": entry["group"],
            "total_qty": entry["total_qty"],
            "total_revenue": entry["total_revenue"],
            "variants_breakdown": breakdown,
        })

    orders_brief = [
        {
            "orderId": o.order_id,
            "createdAt": _utc_iso(o.created_at) or "",
            "customerName": o.customer_name,
            "customerPhone": o.customer_phone,
            "paymentMethod": o.payment_method,
            "paymentStatus": o.payment_status,
            "isPaid": bool(o.is_paid),
            "orderStatus": o.order_status,
            "total": float(o.total or 0.0),
            "items": [
                {
                    "name": it.name,
                    "group": _classify_recap_group(
                        cat_by_id.get(it.menu_item_id) or cat_by_name.get(it.name) or "",
                        it.name,
                    ),
                    "quantity": int(it.quantity or 0),
                    "notes": it.notes or "",
                    "subtotal": float(it.subtotal or 0.0),
                }
                for it in o.items
            ],
        }
        for o in orders
    ]

    batch_data = serialize_batch(batch) if batch else {"id": None, "name": title or "On-site (Belum Selesai)"}
    pickup_loc = ((batch.notes or "").strip() if batch else "") or global_pickup_loc

    return {
        "batch": batch_data,
        "pickup_location": pickup_loc,
        "summary": {
            "total_orders": len(active_orders),
            "cancelled_orders": cancelled_count,
            "paid_orders": paid_orders,
            "unpaid_orders": unpaid_orders,
            "total_revenue": total_revenue,
            "paid_revenue": paid_revenue,
            "total_items_qty": sum(i["total_qty"] for i in items_summary),
        },
        "items_summary": items_summary,
        "orders": orders_brief,
    }


@router.get("/batches/{batch_id}/recap")
def get_batch_recap(batch_id: int, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Rekap pesanan khusus batch Open PO yang dipilih (Admin)."""
    batch = db.query(PreorderBatch).filter(PreorderBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan.")

    orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.batch_id == batch_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return _build_recap_payload(db, orders, batch=batch)


@router.get("/recap/onsite")
def get_onsite_recap(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Rekap pesanan On-site / POS yang statusnya belum Selesai (dan tidak batal) (Admin)."""
    orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(
            Order.channel == MODE_POS,
            Order.order_status.notin_(["Selesai", "Batal", "Dibatalkan"]),
        )
        .order_by(Order.created_at.desc())
        .all()
    )
    return _build_recap_payload(db, orders, batch=None, title="On-site (Belum Selesai)")