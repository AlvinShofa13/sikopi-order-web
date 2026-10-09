"""Self-check aturan uang, mode eksklusif & WA otomatis (jalankan: python backend/selftest.py).

Tidak butuh pytest/httpx: membuat DB SQLite in-memory, memanggil fungsi router
secara langsung. BackgroundTasks dijalankan manual via `await bg()`.
Pengiriman WA sungguhan di-mock — yang diperiksa adalah LOGIKA pemicunya
(kapan kirim, kapan tidak), bukan jaringan Baileys-nya.
"""

import asyncio
import sys

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import routers.orders as orders_mod
import routers.wa as wa_mod
import wa_client
from database import Base
from models import MenuItem, PreorderBatch
from routers.orders import create_order, new_order_code, normalize_phone, update_order_status
from routers.preorder import MODE_POS, MODE_PREORDER, get_active_mode, set_active_mode
from schemas import OrderCreate, OrderStatusUpdate
from wa_templates import order_created_text, order_receipt_text, payment_verified_text, status_text

PASSED = 0
SENT = []  # (phone, text) yang "terkirim" lewat mock


def check(label: str, condition: bool) -> None:
    global PASSED
    if not condition:
        print(f"  FAIL  {label}")
        sys.exit(1)
    PASSED += 1
    print(f"  ok    {label}")


def expect_http(fn, status: int, label: str):
    try:
        fn()
    except HTTPException as e:
        check(f"{label} -> HTTP {status}", e.status_code == status)
        return e
    check(f"{label} -> HTTP {status}", False)


def payload(**overrides):
    data = dict(
        orderId="SK-2K9QW4Z7",
        channel="pos",
        items=[dict(id="menu-kopi", name="Kopi", price=1.0, quantity=2, notes="")],
        customer=dict(name="Budi", phone="081234567890"),
        payment=dict(method="cash", label="Bayar di Kasir (Tunai / EDC)"),
    )
    data.update(overrides)
    return OrderCreate(**data)


def place(db, p):
    """Buat order + jalankan background tasks-nya (seperti FastAPI)."""
    bg = BackgroundTasks()
    order = asyncio.run(create_order(p, bg, db))
    asyncio.run(bg())
    return order


def patch(db, order_id, **fields):
    bg = BackgroundTasks()
    order = asyncio.run(update_order_status(order_id, OrderStatusUpdate(**fields), bg, db))
    asyncio.run(bg())
    return order


def run():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    db.add(MenuItem(id="menu-kopi", name="Kopi Susu", category="Kopi Pilihan", price=25000.0, is_available=True))
    batch = PreorderBatch(name="Batch 1", status="open")
    db.add(batch)
    db.commit()

    # Mock pengiriman WA: catat, jangan sentuh jaringan.
    real_send = orders_mod.send_wa_text
    orders_mod.send_wa_text = lambda phone, text: SENT.append((phone, text)) or True

    def attempt(p):
        return lambda: asyncio.run(create_order(p, BackgroundTasks(), db))

    print("\n[1] Normalisasi nomor WhatsApp")
    check("0812... -> 62812...", normalize_phone("0812-3456-7890") == "6281234567890")
    check("+62 812 -> 62812...", normalize_phone("+62 812 3456 7890") == "6281234567890")
    check("812... -> 62812...", normalize_phone("81234567890") == "6281234567890")
    check("kosong -> ''", normalize_phone("-") == "")

    print("\n[2] Harga server adalah sumber kebenaran")
    SENT.clear()
    order = place(db, payload())
    check("total memakai harga DB (25.000 x 2)", order["breakdown"]["total"] == 50000.0)
    check("harga client 1.0 diabaikan", order["items"][0]["price"] == 25000.0)
    check("nomor WA ternormalisasi", order["customer"]["phone"] == "6281234567890")
    check("kode transaksi dari client dipakai", order["orderId"] == "SK-2K9QW4Z7")
    check("channel mengikuti mode aktif", order["channel"] == MODE_POS)

    print("\n[3] WA otomatis saat pesanan dibuat")
    check("1 pesan terkirim", len(SENT) == 1)
    phone, text = SENT[0]
    check("tujuan = nomor customer", phone == "6281234567890")
    check("isi = teks pesanan-diterima", text == order_created_text(order, "SIKopi"))
    check("memuat kode transaksi", "SK-2K9QW4Z7" in text)

    print("\n[4] WA otomatis saat status berubah (dan hanya saat berubah)")
    SENT.clear()
    patch(db, "SK-2K9QW4Z7", is_paid=True)
    check("lunas -> 1 pesan verifikasi", len(SENT) == 1 and SENT[0][1] == payment_verified_text(order, "SIKopi"))
    SENT.clear()
    patch(db, "SK-2K9QW4Z7", is_paid=True)
    check("lunas yang sama -> tidak kirim ulang", len(SENT) == 0)
    updated = patch(db, "SK-2K9QW4Z7", order_status="Siap Diambil")
    check("ganti status -> 1 pesan status", len(SENT) == 1 and "SIAP DIAMBIL" in SENT[0][1])
    check("teks status cocok template", SENT[0][1] == status_text(updated, "Siap Diambil", "SIKopi"))
    SENT.clear()
    patch(db, "SK-2K9QW4Z7", order_status="Siap Diambil")
    check("status yang sama -> tidak kirim ulang", len(SENT) == 0)

    print("\n[4b] Admin bisa mengembalikan lunas -> belum bayar (koreksi manual)")
    reverted = patch(db, "SK-2K9QW4Z7", is_paid=False)
    check("kembali belum bayar", reverted["payment"]["paid"] is False)
    check("status teks ikut kembali", reverted["payment"]["status"] == "Menunggu Pembayaran")
    check("koreksi tidak mengirim WA", len(SENT) == 0)
    relunas = patch(db, "SK-2K9QW4Z7", is_paid=True)
    check("lunas lagi -> kirim WA lagi", len(SENT) == 1 and relunas["payment"]["paid"] is True)
    SENT.clear()

    print("\n[5] WA gagal tidak menggagalkan order")
    orders_mod.send_wa_text = lambda phone, text: (_ for _ in ()).throw(ConnectionError("gateway mati"))
    try:
        place(db, payload(orderId="SK-AAAAAAAA"))
        check("order tetap tercatat saat gateway mati", True)
    except Exception:
        check("order tetap tercatat saat gateway mati", False)
    orders_mod.send_wa_text = lambda phone, text: SENT.append((phone, text)) or True
    check("gateway mati tak mengirim apa-apa", len(SENT) == 0)

    print("\n[6] Gerbang bukti pembayaran Open PO")
    set_active_mode(db, MODE_PREORDER)
    db.commit()
    expect_http(attempt(payload(channel="preorder", payment={"method": "transfer"})), 422, "Open PO tanpa bukti ditolak")
    expect_http(
        attempt(payload(channel="preorder", payment={"method": "transfer"}, paymentProof="https://evil.example/x.jpg")),
        422,
        "Bukti dari luar /uploads/proof ditolak",
    )
    SENT.clear()
    po = place(
        db,
        payload(
            channel="preorder",
            payment={"method": "transfer"},
            paymentProof="/uploads/proof/SK-2K9QW4Z7_a.jpg",
        ),
    )
    check("Open PO + bukti -> tercatat", po["orderStatus"] == "Diterima & Disiapkan")
    check("batch auto-assign", po["batch"]["name"] == "Batch 1")
    check("belum lunas sebelum verifikasi kasir", po["payment"]["paid"] is False)
    check("pesan dibuat memuat batch", "Batch 1" in SENT[0][1])

    print("\n[7] Mode saling eksklusif")
    check("mode aktif = preorder", get_active_mode(db) == MODE_PREORDER)
    expect_http(attempt(payload(channel="pos")), 409, "Channel beda dengan mode aktif ditolak")
    set_active_mode(db, MODE_POS)
    db.commit()
    check("ganti mode -> pos", get_active_mode(db) == MODE_POS)
    expect_http(attempt(payload(channel="preorder", payment={"method": "transfer"}, paymentProof="/uploads/proof/x.jpg")), 409, "Preorder saat mode pos ditolak")

    print("\n[8] Batch & kode transaksi")
    batch.status = "closed"
    db.commit()
    set_active_mode(db, MODE_PREORDER)
    db.commit()
    expect_http(attempt(payload(channel="preorder", payment={"method": "transfer"}, paymentProof="/uploads/proof/x.jpg")), 409, "Batch ditutup -> Open PO ditolak")
    batch.status = "open"
    set_active_mode(db, MODE_POS)
    db.commit()
    check("kode baru != kode terpakai", new_order_code() not in ("SK-2K9QW4Z7",))
    dup = place(db, payload(orderId="SK-2K9QW4Z7"))
    check("kode bentrok -> server ganti kode baru", dup["orderId"] != "SK-2K9QW4Z7")

    print("\n[9] Menu tidak dikenal ditolak")
    expect_http(attempt(payload(items=[dict(id="menu-hantu", name="Hantu", price=1.0, quantity=1)])), 422, "Menu tidak ada -> ditolak")

    print("\n[10] wa_client tahan gateway mati")
    check("send_wa_text False saat gateway mati", wa_client.send_wa_text("62812", "halo") is False)

    print("\n[11] Nota digital manual via gateway (tanpa wa.me)")
    real_wa_send = wa_mod.send_wa_text
    wa_mod.send_wa_text = lambda phone, text: SENT.append((phone, text)) or True
    SENT.clear()
    nota = wa_mod.send_order_receipt("SK-2K9QW4Z7", db, True)
    check("nota terkirim", nota.success is True)
    check("1 pesan nota", len(SENT) == 1)
    check("tujuan = nomor customer", SENT[0][0] == "6281234567890")
    check("isi = nota digital", "Nota Digital" in SENT[0][1] and "SK-2K9QW4Z7" in SENT[0][1])
    expect_http(lambda: wa_mod.send_order_receipt("SK-TIDAKADA", db, True), 404, "Kode salah -> 404")
    wa_mod.send_wa_text = real_wa_send

    orders_mod.send_wa_text = real_send
    print(f"\nPASS {PASSED} pemeriksaan.")


if __name__ == "__main__":
    run()
