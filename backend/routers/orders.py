import csv
import io
import json
import random
import re
import secrets
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from auth_dep import client_ip, is_valid_admin_token, prune_fails, record_fail, require_admin
from database import get_db
from models import AppSetting, MenuItem, Order, OrderItem, PreorderBatch
from realtime import order_manager
from routers.preorder import MODE_POS, MODE_PREORDER, active_batch, get_active_mode
from routers.uploads import ORDER_CODE_RE
from schemas import OrderCreate, OrderStatusUpdate, PosOrderCreate
from wa_client import send_wa_text
from wa_templates import order_created_text, payment_verified_text, status_text

router = APIRouter(prefix="/orders", tags=["Orders Management"])

# Alfabet kode transaksi: angka + huruf besar tanpa karakter ambigu
# (I, L, O, U dihilangkan) supaya mudah dibaca/dibacakan pelanggan di kasir.
CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CHANNEL_POS = MODE_POS
CHANNEL_PREORDER = MODE_PREORDER

PAYMENT_LABELS = {
    "transfer": "Transfer QRIS + Bukti",
    "qris": "QRIS",  # legacy
    "cash": "Bayar di Kasir (Tunai / EDC)",
}
MAX_ORDER_LOOKUPS_PER_IP = 60


def _brand_name(db: Session) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == "brand_name").first()
    return (row.value if row and row.value else "SIKopi").strip() or "SIKopi"


def _notify_customer(phone: str, text: str) -> None:
    """Pengiriman WA otomatis (BackgroundTasks). Gagal kirim = log saja,
    tidak pernah menggagalkan alur pesanan."""
    try:
        if phone and text:
            send_wa_text(phone, text)
    except Exception:  # sabuk + suspender: wa_client sudah catch, tapi jangan pernah bocor
        pass


def new_order_code() -> str:
    """Kode transaksi acak 8 char (32^8 kombinasi), mis. SK-7F3K9Q2M."""
    return "SK-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def normalize_phone(raw: str | None) -> str:
    """Normalisasi nomor telepon (Indonesia & Internasional) ke format wa.me / Baileys.

    - Indonesia: '0812...' / '+62 812...' / '812...' -> '62812...'
    - Internasional: '+1 555 123 4567' -> '15551234567'
    - Internasional: '+65 9123 4567' -> '6591234567'
    - Internasional: '+60 12 345 6789' -> '60123456789'
    """
    raw_str = (raw or "").strip()
    digits = re.sub(r"\D", "", raw_str)
    if not digits:
        return ""

    # 1. Jika diawali tanda '+' eksplisit
    if raw_str.startswith("+"):
        if digits.startswith("62"):
            sub = digits[2:]
            if sub.startswith("0"):
                sub = sub[1:]
            return f"62{sub}"
        return digits

    # 2. Jika diawali 62 (misal 62812... atau 620812...)
    if digits.startswith("62"):
        sub = digits[2:]
        if sub.startswith("0"):
            sub = sub[1:]
        return f"62{sub}"

    # 3. Jika diawali 00 (international direct dialing prefix)
    if digits.startswith("00"):
        return digits[2:]

    # 4. Jika nomor Indonesia lokal (diawali 0...)
    if digits.startswith("0"):
        return f"62{digits[1:]}"

    # 5. Jika diawali 8 (kebiasaan input orang Indonesia tanpa 0/62, misal 81234567890)
    if digits.startswith("8") and 9 <= len(digits) <= 13:
        return f"62{digits}"

    # 6. Nomor internasional lainnya yang sudah diawali kode negara
    return digits


@router.websocket("/ws")
async def websocket_orders_endpoint(
    websocket: WebSocket,
    token: str = "",
    db: Session = Depends(get_db),
):
    # Kasir realtime: tolak koneksi tanpa token admin yang valid.
    if not is_valid_admin_token(db, token):
        await websocket.close(code=4401)
        return
    await order_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        order_manager.disconnect(websocket)
    except Exception:
        order_manager.disconnect(websocket)


def serialize_order(ord: Order) -> Dict[str, Any]:
    return {
        "orderId": ord.order_id,
        "createdAt": ord.created_at.isoformat() if ord.created_at else "",
        "channel": ord.channel or CHANNEL_POS,
        "batch": (
            {"id": ord.batch.id, "name": ord.batch.name, "pickupDate": ord.batch.pickup_date.isoformat() if ord.batch.pickup_date else None}
            if ord.batch else None
        ),
        "customer": {
            "name": ord.customer_name,
            "phone": ord.customer_phone,
            "orderType": ord.order_type,
            "tableOrAddress": ord.table_or_address,
            "specialRequest": ord.special_request,
        },
        "payment": {
            "method": ord.payment_method,
            "label": ord.payment_label,
            "reference": ord.payment_reference,
            "status": ord.payment_status,
            "paid": bool(ord.is_paid),
            "proof": ord.payment_proof or None,
            "cashReceived": float(getattr(ord, "cash_received", 0.0) or 0.0),
            "cashChange": float(getattr(ord, "cash_change", 0.0) or 0.0),
        },
        "items": [
            {
                "id": it.menu_item_id or str(it.id),
                "name": it.name,
                "price": it.price,
                "quantity": it.quantity,
                "notes": it.notes or "",
                "subtotal": it.subtotal,
            }
            for it in ord.items
        ],
        "breakdown": {
            "subtotal": ord.subtotal,
            "ecoFee": ord.eco_fee,
            "tax": ord.tax,
            "total": ord.total,
        },
        "orderStatus": ord.order_status,
    }


@router.get("")
def get_all_orders(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Retrieve all orders sorted by createdAt descending (Admin)."""
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [serialize_order(o) for o in orders]


EXPORT_COLUMNS = [
    "No Pesanan", "Waktu", "Channel", "Batch", "Pelanggan", "Telepon",
    "Menu", "Qty", "Harga Satuan",
    "Subtotal Item", "Total Order", "Metode Bayar", "Status Bayar", "Status Order",
]


def _export_rows(db: Session):
    """One row per order item (orders without items yield one row with empty menu)."""
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    rows = []
    for ord in orders:
        base = [
            ord.order_id,
            ord.created_at.isoformat() if ord.created_at else "",
            "Open PO" if ord.channel == CHANNEL_PREORDER else "On-site",
            ord.batch.name if ord.batch else "-",
            ord.customer_name,
            ord.customer_phone,
            "", 0, 0.0, 0.0,
            ord.total,
            ord.payment_label or ord.payment_method,
            ord.payment_status,
            ord.order_status,
        ]
        if ord.items:
            for it in ord.items:
                r = list(base)
                r[6] = it.name
                r[7] = it.quantity
                r[8] = it.price
                r[9] = it.subtotal
                rows.append(r)
        else:
            rows.append(base)
    return rows


@router.get("/stats")
def get_sales_stats(db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Aggregated sales analytics (Admin)."""
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    total_revenue = db.query(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0
    total_portions = db.query(func.coalesce(func.sum(OrderItem.quantity), 0)).scalar() or 0

    top_menus_q = (
        db.query(
            OrderItem.name.label("name"),
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.subtotal).label("revenue"),
            func.count(func.distinct(OrderItem.order_id)).label("orders"),
        )
        .group_by(OrderItem.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
        .all()
    )
    top_menus = [
        {"name": r.name, "qty": int(r.qty or 0), "revenue": float(r.revenue or 0.0), "orders": int(r.orders or 0)}
        for r in top_menus_q
    ]

    pay_q = (
        db.query(
            Order.payment_method.label("method"),
            func.count(Order.id).label("count"),
            func.coalesce(func.sum(Order.total), 0.0).label("revenue"),
        )
        .group_by(Order.payment_method)
        .all()
    )
    payment_methods = []
    for r in pay_q:
        method = (r.method or "unknown").lower()
        label = PAYMENT_LABELS.get(method, r.method or "-")
        count = int(r.count or 0)
        payment_methods.append({
            "method": method,
            "label": label,
            "count": count,
            "pct": round(count / total_orders * 100, 1) if total_orders else 0.0,
            "revenue": float(r.revenue or 0.0),
        })
    payment_methods.sort(key=lambda x: x["count"], reverse=True)

    chan_q = (
        db.query(Order.channel.label("channel"), func.count(Order.id).label("count"))
        .group_by(Order.channel)
        .all()
    )
    channels = [
        {
            "channel": (r.channel or CHANNEL_POS),
            "label": "Open PO" if r.channel == CHANNEL_PREORDER else "On-site",
            "count": int(r.count or 0),
        }
        for r in chan_q
    ]
    channels.sort(key=lambda x: x["count"], reverse=True)

    return {
        "summary": {
            "total_orders": total_orders,
            "total_revenue": float(total_revenue),
            "total_portions": int(total_portions),
        },
        "top_menus": top_menus,
        "payment_methods": payment_methods,
        "channels": channels,
    }


@router.get("/export")
def export_sales_data(format: str = Query(default="xlsx", pattern="^(xlsx|csv)$"), db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Export sales data (Admin). ?format=xlsx (default) or ?format=csv. One row per item."""
    rows = _export_rows(db)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")

    if format == "csv":
        buf = io.StringIO()
        buf.write("\ufeff")  # BOM so Excel opens Indonesian text correctly
        writer = csv.writer(buf)
        writer.writerow(EXPORT_COLUMNS)
        writer.writerows(rows)
        data = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(data),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=penjualan-sikopi-{stamp}.csv"},
        )

    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "Penjualan"
    ws.append(EXPORT_COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for r in rows:
        ws.append(r)
    widths = [12, 20, 10, 22, 18, 14, 28, 6, 12, 13, 12, 22, 18, 18]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=penjualan-sikopi-{stamp}.xlsx"},
    )


@router.get("/{order_id}")
def get_order_by_id(order_id: str, request: Request, db: Session = Depends(get_db)):
    """Rincian satu pesanan untuk halaman status digital pelanggan.

    Akses publik berbasis kode transaksi 8 karakter acak (~1 triliun kombinasi),
    jadi tebakan tidak realistis; rate limit per IP tetap berjaga sebagai pengaman
    kedua. Endpoint yang sama juga dipakai panel kasir.
    """
    ip_key = f"order:{client_ip(request)}"
    if prune_fails(ip_key) >= MAX_ORDER_LOOKUPS_PER_IP:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak permintaan. Coba lagi dalam 5 menit.",
        )

    ord = db.query(Order).filter(Order.order_id == (order_id or "").strip().upper()).first()
    if not ord:
        record_fail(ip_key)  # hanya kode yang salah dihitung; kode valid dihapus tak perlu
        raise HTTPException(status_code=404, detail="Kode pesanan tidak ditemukan. Periksa kembali kode transaksi Anda.")
    return serialize_order(ord)


def _code_taken(db: Session, order_id: str) -> bool:
    return db.query(Order.id).filter(Order.order_id == order_id).first() is not None


def _resolve_batch(db: Session, batch_id: int | None) -> PreorderBatch:
    """Ambil batch Open PO yang masih terbuka (id opsional = auto-assign)."""
    batch = None
    if batch_id is not None:
        batch = db.query(PreorderBatch).filter(PreorderBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=422, detail="Batch Open PO tidak ditemukan.")
        if batch.status != "open":
            raise HTTPException(status_code=422, detail=f"Batch '{batch.name}' sudah ditutup. Pilih batch yang sedang dibuka.")
    else:
        batch = active_batch(db)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Belum ada batch Open PO yang dibuka. Hubungi kasir untuk info jadwal pemesanan.",
        )
    return batch


def _bundle_contents_label(db: Session, menu_item) -> str:
    """Label isi paket bundling ('2x Kopi Susu, 1x Roti') dari data menu saat ini.

    Dipakai sebagai snapshot pada catatan baris order agar dapur/kasir tahu
    isi paket walau komposisi paket diubah/dihapus kemudian. '' bila bukan paket.
    """
    if not getattr(menu_item, "is_bundle", False):
        return ""
    try:
        lines = json.loads(menu_item.bundle_items or "[]")
    except (ValueError, TypeError):
        return ""
    if not isinstance(lines, list):
        return ""
    parts = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        comp_id = (line.get("id") or "").strip()
        qty = int(line.get("quantity") or 0)
        if not comp_id or qty <= 0:
            continue
        comp = db.query(MenuItem).filter(MenuItem.id == comp_id).first()
        parts.append(f"{qty}x {comp.name if comp else comp_id}")
    return ", ".join(parts)


def _parse_menu_variants(menu_item) -> list:
    """Daftar varian resmi menu: [{"name": ..., "price": ...}]. [] bila tak ada."""
    try:
        rows = json.loads(getattr(menu_item, "variants", None) or "[]")
    except (ValueError, TypeError):
        return []
    return rows if isinstance(rows, list) else []


def _resolve_variant_extras(menu_item, wanted) -> tuple:
    """Cocokkan varian pilihan dengan daftar resmi menu (harga dari server).

    Mengembalikan (names, extra_per_porsi). Melempar 422 bila ada varian tak dikenal.
    """
    official = _parse_menu_variants(menu_item)
    names = [str(v).strip() for v in (wanted or []) if str(v).strip()]
    if not names:
        return [], 0.0
    if not official:
        raise HTTPException(
            status_code=422,
            detail=f"Menu '{menu_item.name}' tidak punya varian. Muat ulang halaman menu.",
        )
    by_name = {}
    for row in official:
        if isinstance(row, dict) and (row.get("name") or "").strip():
            by_name.setdefault((row.get("name") or "").strip(), float(row.get("price") or 0.0))
    resolved = []
    extra = 0.0
    for name in names:
        if name not in by_name:
            raise HTTPException(
                status_code=422,
                detail=f"Varian '{name}' tidak dikenal pada menu '{menu_item.name}'.",
            )
        if name not in resolved:
            resolved.append(name)
            extra += by_name[name]
    return resolved, extra


def _rp(amount: float) -> str:
    """Format rupiah ringkas gaya Indonesia untuk snapshot catatan (Rp5.000)."""
    return "Rp" + f"{float(amount or 0.0):,.0f}".replace(",", ".")


def _price_with_breakdown(db: Session, items) -> tuple:
    """Hitung ulang harga dari `menu_items` (abaikan price client).

    Mengembalikan (items_data, subtotal, total). Melempar 422 bila ada menu tak dikenal.
    """
    items_data = []
    subtotal = 0.0
    for it in items:
        menu_item = db.query(MenuItem).filter(MenuItem.id == (it.id or "").strip()).first()
        if not menu_item:
            raise HTTPException(
                status_code=422,
                detail=f"Menu '{it.name}' sudah tidak tersedia. Muat ulang halaman menu.",
            )
        line_total = float(menu_item.price) * int(it.quantity)
        subtotal += line_total
        # Snapshot isi paket pada catatan baris (dapur/kasir tahu komposisi
        # paket walau paket diubah/dihapus kemudian).
        bundle_label = _bundle_contents_label(db, menu_item)
        # Varian: harga ekstra selalu dari server (abaikan harga client).
        variant_names, variant_extra = _resolve_variant_extras(menu_item, it.variants)
        if variant_extra:
            line_total += variant_extra * int(it.quantity)
            subtotal += variant_extra * int(it.quantity)
        note = (it.notes or "").strip()
        if variant_names:
            extra_tag = f" (+{_rp(variant_extra)})" if variant_extra else ""
            variant_tag = f"[Varian: {', '.join(variant_names)}{extra_tag}]"
            note = f"{note} {variant_tag}".strip() if note else variant_tag
        if bundle_label:
            note = f"{note} [Isi paket: {bundle_label}]".strip() if note else f"[Isi paket: {bundle_label}]"
        items_data.append({
            "menu_item_id": menu_item.id,
            "name": menu_item.name,
            "price": float(menu_item.price) + variant_extra,
            "quantity": int(it.quantity),
            "notes": note,
            "subtotal": line_total,
        })

    eco_fee = 0.0   # mode uji: biaya kemasan 0
    tax = 0.0       # mode uji: PB1 0
    return items_data, subtotal, subtotal + eco_fee + tax


def _new_unique_order_code(db: Session) -> str:
    """Kode transaksi baru yang dijamin belum dipakai."""
    order_id = new_order_code()
    for _ in range(5):
        if not _code_taken(db, order_id):
            break
        order_id = new_order_code()
    return order_id


async def _persist_new_order(
    db: Session,
    background: BackgroundTasks,
    *,
    items_data,
    subtotal: float,
    total: float,
    customer_name: str,
    phone: str,
    special_request: str,
    channel: str,
    batch_id,
    method: str,
    payment_reference: str,
    proof_url,
    order_id: str,
    is_paid: bool,
    payment_status: str,
    cash_received=None,
    cash_change=None,
) -> Dict[str, Any]:
    """Satu jalur pencatatan order (publik & kasir): simpan, broadcast
    realtime, dan jadwalkan WA otomatis (hanya bila nomor HP terisi)."""
    new_order = Order(
        order_id=order_id,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        customer_name=customer_name,
        customer_phone=phone,
        customer_token=None,  # sistem token dihapus
        special_request=special_request,
        channel=channel,
        batch_id=batch_id,
        payment_method=method,
        payment_label=PAYMENT_LABELS[method],
        payment_reference=payment_reference,
        payment_status=payment_status,
        payment_proof=proof_url,
        is_paid=is_paid,
        cash_received=cash_received,
        cash_change=cash_change,
        subtotal=subtotal,
        eco_fee=0.0,
        tax=0.0,
        total=total,
        order_status="Diterima & Disiapkan",
    )
    db.add(new_order)
    db.flush()

    for item_dict in items_data:
        db.add(OrderItem(order_id=order_id, **item_dict))

    db.commit()
    db.refresh(new_order)
    serialized = serialize_order(new_order)
    await order_manager.broadcast("NEW_ORDER", serialized)
    # Notifikasi WhatsApp otomatis (fire-and-forget; gagal kirim tak menggagalkan order)
    if phone:
        background.add_task(_notify_customer, phone, order_created_text(serialized, _brand_name(db)))
    return serialized


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Catat pesanan baru, lalu kirim notifikasi WhatsApp otomatis.

    Gerbang bisnis (server = sumber kebenaran):
    - Channel selalu mengikuti mode aktif global (customer tidak memilih).
    - Harga & total dihitung ulang dari `menu_items`, tidak pernah dari client.
    - Channel `preorder` wajib punya batch terbuka DAN bukti pembayaran terupload.
    - Kode transaksi dari client dipakai agar nama file bukti sudah terikat ke
      pesanan sejak awal; divalidasi format + keunikan.
    """
    if not payload.items:
        raise HTTPException(status_code=422, detail="Keranjang pesanan kosong.")

    # 1. Channel = mode aktif global (saling eksklusif, customer tidak memilih)
    active_mode = get_active_mode(db)
    channel = (payload.channel or active_mode).strip().lower()
    if channel != active_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Mode pemesanan saat ini adalah '{active_mode}'. Muat ulang halaman pembayaran.",
        )

    batch = None
    if channel == CHANNEL_PREORDER:
        batch = _resolve_batch(db, payload.batchId)

    # 2. Metode pembayaran + bukti
    method = (payload.payment.method or "transfer").strip().lower()
    method = "qris" if method == "qris" else ("cash" if method == "cash" else "transfer")
    proof_url = (payload.paymentProof or "").strip() or None
    if method == "transfer" and not proof_url:
        raise HTTPException(
            status_code=422,
            detail="Pesanan belum dikirim: unggah bukti pembayaran terlebih dahulu.",
        )
    if proof_url and not proof_url.startswith("/uploads/proof/"):
        raise HTTPException(status_code=422, detail="Bukti pembayaran tidak valid.")

    # 3. Harga dari database (abaikan price & breakdown dari client)
    items_data, subtotal, total = _price_with_breakdown(db, payload.items)

    # 4. Identitas & kontak pelanggan
    customer_name = (payload.customer.name or "").strip() or "Pelanggan"
    phone = normalize_phone(payload.customer.phone)
    if len(phone) < 8 or len(phone) > 16:
        raise HTTPException(
            status_code=422,
            detail="Nomor WhatsApp tidak valid (minimal 8 digit angka, gunakan awalan 08 atau kode negara internasional misal +65, +1).",
        )

    # 5. Kode transaksi (dari client, divalidasi & dicek unik)
    raw_code = (payload.orderId or "").strip().upper()
    if ORDER_CODE_RE.match(raw_code) and not _code_taken(db, raw_code):
        order_id = raw_code
    else:
        order_id = _new_unique_order_code(db)

    return await _persist_new_order(
        db,
        background,
        items_data=items_data,
        subtotal=subtotal,
        total=total,
        customer_name=customer_name,
        phone=phone,
        special_request=payload.customer.specialRequest or "-",
        channel=channel,
        batch_id=batch.id if batch else None,
        method=method,
        payment_reference=payload.payment.reference or f"REF-{random.randint(100000, 999000)}",
        proof_url=proof_url,
        order_id=order_id,
        is_paid=False,
        payment_status="Menunggu Pembayaran",
    )


@router.post("/pos", status_code=status.HTTP_201_CREATED)
async def create_pos_order(
    payload: PosOrderCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """Pesanan langsung dari kasir (tab POS panel admin).

    Aturan khusus kasir (berbeda dari jalur publik):
    - Channel selalu `pos`, apa pun mode aktif global (tanpa batch, tanpa gerbang bukti).
    - Nomor WA opsional: kosong = order tetap tercatat, WA dilewati.
    - `cash`: tunai & lunas seketika — `cashReceived` wajib >= total, kembalian
      dihitung server (otoritas uang tetap di server).
    - `qris`: QRIS dinamis — order tercatat belum lunas; kasir menampilkan QR
      ke pelanggan lalu menandai lunas setelah pembayaran terkonfirmasi.
    """
    if not payload.items:
        raise HTTPException(status_code=422, detail="Keranjang pesanan kosong.")

    method = (payload.paymentMethod or "cash").strip().lower()
    method = "qris" if method == "qris" else "cash"

    items_data, subtotal, total = _price_with_breakdown(db, payload.items)

    customer_name = ((payload.customer.name if payload.customer else "") or "").strip() or "Pelanggan"
    phone = normalize_phone(payload.customer.phone if payload.customer else "")
    order_id = _new_unique_order_code(db)

    if method == "qris":
        return await _persist_new_order(
            db,
            background,
            items_data=items_data,
            subtotal=subtotal,
            total=total,
            customer_name=customer_name,
            phone=phone,
            special_request=(payload.customer.specialRequest if payload.customer else None) or "-",
            channel=CHANNEL_POS,
            batch_id=None,
            method="qris",
            payment_reference=f"QRIS-{order_id}",
            proof_url=None,
            order_id=order_id,
            is_paid=False,
            payment_status="Menunggu Pembayaran",
            cash_received=0.0,
            cash_change=0.0,
        )

    received = float(payload.cashReceived or 0.0)
    if received < total:
        raise HTTPException(
            status_code=422,
            detail=f"Uang tunai kurang {total - received:,.0f}. Terima minimal sebesar total tagihan.",
        )

    return await _persist_new_order(
        db,
        background,
        items_data=items_data,
        subtotal=subtotal,
        total=total,
        customer_name=customer_name,
        phone=phone,
        special_request=(payload.customer.specialRequest if payload.customer else None) or "-",
        channel=CHANNEL_POS,
        batch_id=None,
        method="cash",
        payment_reference=f"TUNAI-{order_id}",
        proof_url=None,
        order_id=order_id,
        is_paid=True,
        payment_status="Lunas",
        cash_received=received,
        cash_change=received - total,
    )


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """Update status pembayaran/penyiapan (Admin). Setiap perubahan nyata
    (lunas, ganti status) otomatis dikirim ke WhatsApp customer."""
    ord = db.query(Order).filter(Order.order_id == order_id).first()
    if not ord:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan.")

    was_paid = bool(ord.is_paid)
    prev_status = ord.order_status

    if payload.order_status:
        ord.order_status = payload.order_status
    if payload.cash_received is not None:
        ord.cash_received = payload.cash_received
    if payload.cash_change is not None:
        ord.cash_change = payload.cash_change
    if payload.is_paid is not None:
        ord.is_paid = payload.is_paid
        ord.payment_status = "Lunas" if payload.is_paid else "Menunggu Pembayaran"
    elif payload.payment_status:
        ord.payment_status = payload.payment_status
        if "lunas" in payload.payment_status.lower():
            ord.is_paid = True

    db.commit()
    db.refresh(ord)
    serialized = serialize_order(ord)
    await order_manager.broadcast("STATUS_UPDATED", serialized)

    # Notifikasi WhatsApp otomatis, hanya untuk perubahan nyata
    # (is_paid dihitung dari hasil akhir agar jalur payment_status "Lunas" ikut tercakup)
    brand = _brand_name(db)
    phone = ord.customer_phone or ""
    if bool(ord.is_paid) and not was_paid:
        background.add_task(_notify_customer, phone, payment_verified_text(serialized, brand))
    if payload.order_status and payload.order_status != prev_status:
        background.add_task(_notify_customer, phone, status_text(serialized, ord.order_status, brand))
    return serialized


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: str, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Delete an order (Admin)."""
    ord = db.query(Order).filter(Order.order_id == order_id).first()
    if not ord:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan.")

    db.delete(ord)
    db.commit()
    return None
