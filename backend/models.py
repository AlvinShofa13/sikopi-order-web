from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, default="Kopi Pilihan")
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=1.0)
    image = Column(Text, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    
    # Customer Details
    customer_name = Column(String(150), nullable=False)
    customer_phone = Column(String(50), default="-")
    customer_token = Column(String(10), nullable=True, index=True)
    order_type = Column(String(50), default="Makan di Tempat")
    table_or_address = Column(String(100), default="Meja Reguler")
    special_request = Column(Text, default="-")

    # Payment Details
    payment_method = Column(String(50), nullable=False, default="qris")  # 'qris' or 'cash'
    payment_label = Column(String(100), default="QRIS")
    payment_reference = Column(String(100), nullable=True)
    payment_status = Column(String(50), default="Menunggu Pembayaran")
    is_paid = Column(Boolean, default=False, nullable=False)
    cash_received = Column(Float, default=0.0)
    cash_change = Column(Float, default=0.0)

    # Financial Breakdown
    subtotal = Column(Float, default=0.0)
    eco_fee = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    # Order Lifecycle Status
    order_status = Column(String(50), default="Diterima & Disiapkan")

    # Relations
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    notes = Column(Text, default="")
    subtotal = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")


class TokenRecord(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    token = Column(String(10), unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    customer_name = Column(String(150), nullable=True)
    order_id = Column(String(50), nullable=True)
    burned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(50), primary_key=True)
    value = Column(Text, nullable=False)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    # SHA-256 hex dari token (token asli tidak pernah disimpan).
    token_hash = Column(String(64), primary_key=True)
    email = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    expires_at = Column(DateTime, nullable=False)
