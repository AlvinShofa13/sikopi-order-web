from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# --- Auth Schemas ---
class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None


# --- Menu Schemas ---
class MenuItemBase(BaseModel):
    name: str
    category: str = "Kopi Pilihan"
    description: Optional[str] = ""
    price: float = 1.0
    image: Optional[str] = ""
    is_available: bool = True


class MenuItemCreate(MenuItemBase):
    id: Optional[str] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    is_available: Optional[bool] = None


class MenuItemResponse(MenuItemBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Order Schemas ---
class OrderItemPayload(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    quantity: int = 1
    notes: Optional[str] = ""


class CustomerPayload(BaseModel):
    name: str
    phone: Optional[str] = "-"
    specialRequest: Optional[str] = "-"


class PaymentPayload(BaseModel):
    method: str = "transfer"  # 'transfer' (transfer + upload bukti) or 'cash' (bayar di kasir)
    label: Optional[str] = "Transfer (QRIS)"
    reference: Optional[str] = None
    status: Optional[str] = "Menunggu Pembayaran"


class BreakdownPayload(BaseModel):
    # Tidak dipakai sebagai sumber kebenaran: server menghitung ulang dari
    # harga menu di database. Field dipertahankan agar payload client lama
    # tidak gagal validasi.
    subtotal: float = 0.0
    ecoFee: float = 0.0
    tax: float = 0.0
    total: float = 0.0


class OrderCreate(BaseModel):
    orderId: Optional[str] = None  # kode transaksi dari client (dipakai juga pada nama file bukti)
    channel: str = "pos"  # 'pos' | 'preorder'
    batchId: Optional[int] = None
    paymentProof: Optional[str] = None
    customer: CustomerPayload
    payment: PaymentPayload
    items: List[OrderItemPayload]
    breakdown: Optional[BreakdownPayload] = None


class OrderStatusUpdate(BaseModel):
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    is_paid: Optional[bool] = None
    cash_received: Optional[float] = None
    cash_change: Optional[float] = None


# --- Preorder / Mode Schemas ---
class ModeSwitchRequest(BaseModel):
    mode: str  # 'pos' (on-site) | 'preorder' (open PO); keduanya tidak bisa aktif bersamaan


class PreorderBatchCreate(BaseModel):
    name: str
    order_deadline: Optional[datetime] = None
    pickup_date: Optional[datetime] = None
