"""Proxy admin ke wa-gateway: status koneksi + QR pairing + pesan uji + nota manual."""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_dep import require_admin
from database import get_db
from models import AppSetting, Order
from routers.orders import normalize_phone, serialize_order
from wa_client import send_wa_text, wa_gateway_status
from wa_templates import order_receipt_text

router = APIRouter(prefix="/wa", tags=["WhatsApp Gateway"])


class TestMessageResponse(BaseModel):
    success: bool
    message: str


@router.get("/status")
def get_wa_status(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Status koneksi Baileys (+ QR bila belum pairing) untuk panel admin."""
    return wa_gateway_status()


@router.post("/test", response_model=TestMessageResponse)
def send_wa_test(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Kirim pesan uji ke nomor admin dari .env (Admin)."""
    admin_phone = normalize_phone(os.getenv("ADMIN_WHATSAPP"))
    if not admin_phone:
        return TestMessageResponse(success=False, message="ADMIN_WHATSAPP belum diisi di .env backend.")
    ok = send_wa_text(admin_phone, "Tes gateway WhatsApp SIKopi: koneksi berfungsi.")
    return TestMessageResponse(
        success=ok,
        message="Pesan uji terkirim. Periksa WhatsApp nomor admin."
        if ok
        else "Gateway tidak terjangkau / belum pairing. Periksa service wa-gateway dan scan QR.",
    )


@router.post("/order/{order_id}/receipt", response_model=TestMessageResponse)
def send_order_receipt(order_id: str, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Kirim nota digital order langsung via gateway (Admin).

    Dipakai tombol "Kirim Nota Digital" di modal kasir: tidak membuka wa.me,
    pesan terkirim otomatis ke nomor WhatsApp customer.
    """
    ord = db.query(Order).filter(Order.order_id == (order_id or "").strip().upper()).first()
    if not ord:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan.")
    phone = ord.customer_phone or ""
    if not phone or phone == "-":
        return TestMessageResponse(success=False, message="Nomor WhatsApp customer kosong pada pesanan ini.")
    brand_row = db.query(AppSetting).filter(AppSetting.key == "brand_name").first()
    brand = (brand_row.value if brand_row and brand_row.value else "SIKopi").strip() or "SIKopi"
    ok = send_wa_text(phone, order_receipt_text(serialize_order(ord), brand))
    return TestMessageResponse(
        success=ok,
        message=f"Nota digital {ord.order_id} terkirim ke WhatsApp customer."
        if ok
        else "Gateway tidak terjangkau / belum pairing. Periksa service wa-gateway dan scan QR.",
    )
