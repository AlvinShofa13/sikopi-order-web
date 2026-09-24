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
    token: Optional[str] = None
    orderType: Optional[str] = "Makan di Tempat"
    tableOrAddress: Optional[str] = "Meja Reguler"
    specialRequest: Optional[str] = "-"


class PaymentPayload(BaseModel):
    method: str = "qris"  # 'qris' or 'cash'
    label: Optional[str] = "QRIS"
    reference: Optional[str] = None
    status: Optional[str] = "Menunggu Pembayaran"


class BreakdownPayload(BaseModel):
    subtotal: float = 0.0
    ecoFee: float = 0.0
    tax: float = 0.0
    total: float = 0.0


class OrderCreate(BaseModel):
    customer: CustomerPayload
    payment: PaymentPayload
    items: List[OrderItemPayload]
    breakdown: Optional[BreakdownPayload] = None


class OrderStatusUpdate(BaseModel):
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    is_paid: Optional[bool] = None


# --- Token Schemas ---
class TokenVerifyRequest(BaseModel):
    name: str
    token: str


class TokenVerifyResponse(BaseModel):
    success: bool
    message: str
    isCompletedOrder: Optional[bool] = False
    orderId: Optional[str] = None
    newToken: Optional[str] = None
