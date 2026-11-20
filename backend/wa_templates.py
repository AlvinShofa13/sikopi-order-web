"""Template pesan WhatsApp otomatis (sumber kebenaran sisi server).

CATATAN DUPLIKASI SADAR: teks yang sama juga ada di frontend/src/utils/wa.js
untuk tombol kirim-manual (fallback bila gateway mati). Bila mengubah salah
satu, ubah keduanya — formatnya sengaja dibuat 1:1 agar mudah dibandingkan.
"""

BRAND_FALLBACK = "SIKopi"


def _rupiah(amount) -> str:
    try:
        return "Rp {:,.0f}".format(float(amount or 0)).replace(",", ".")
    except (TypeError, ValueError):
        return "Rp 0"


def _item_lines(items) -> str:
    rows = []
    for it in items or []:
        qty = it.get("quantity") or 1
        note = f" ({it.get('notes')})" if it.get("notes") else ""
        price = it.get("price") or 0
        rows.append(f"- {qty}x {it.get('name')}{note} = {_rupiah(price * qty)}")
    return "\n".join(rows)


def _resolve_pickup_location(order: dict, pickup_location: str = "") -> str:
    batch = order.get("batch") or {}
    batch_loc = (batch.get("notes") or "").strip()
    global_loc = (pickup_location or "").strip()
    return batch_loc or global_loc


def order_created_text(order: dict, brand: str = BRAND_FALLBACK, pickup_location: str = "") -> str:
    """Dikirim otomatis tepat setelah pesanan tercatat."""
    brand = brand or BRAND_FALLBACK
    channel = order.get("channel") or "pos"
    batch = order.get("batch") or {}
    pay = order.get("payment") or {}
    cust = order.get("customer") or {}
    total = (order.get("breakdown") or {}).get("total") or 0
    loc = _resolve_pickup_location(order, pickup_location)

    lines = [
        f"*{brand} — Pesanan Diterima*",
        "",
        f"Kode Pesanan: *{order.get('orderId')}*",
        f"Pelanggan: {cust.get('name') or '-'}",
    ]
    if channel == "preorder" and batch.get("name"):
        lines.append(f"Batch: {batch['name']}")
    lines += ["", _item_lines(order.get("items")), "", f"Total: *{_rupiah(total)}*"]

    if pay.get("method") == "cash":
        lines += [
            "",
            "Silakan bayar di meja kasir dengan menyebutkan nama atau kode pesanan di atas.",
        ]
    else:
        lines += ["", "Bukti pembayaran Anda sedang diperiksa kasir. Kami kabari lagi setelah terverifikasi."]
    if channel == "preorder" and batch.get("pickupDate"):
        lines += ["", f"Siap diambil: {batch['pickupDate']}"]
    if loc:
        lines += [f"Lokasi pengambilan: *{loc}*"]
    lines += ["", "Simpan pesan ini — kode pesanan dipakai untuk cek status."]
    return "\n".join(lines)


def payment_verified_text(order: dict, brand: str = BRAND_FALLBACK) -> str:
    """Dikirim otomatis saat kasir menandai lunas."""
    brand = brand or BRAND_FALLBACK
    total = (order.get("breakdown") or {}).get("total") or 0
    return "\n".join(
        [
            f"*{brand}* — Pesanan *{order.get('orderId')}*",
            "",
            f"Pembayaran {_rupiah(total)} *LUNAS* dan terverifikasi kasir.",
            "Pesanan Anda masuk antrean dapur dan mulai disiapkan.",
        ]
    )


def order_receipt_text(order: dict, brand: str = BRAND_FALLBACK) -> str:
    """Nota digital lengkap — dikirim lewat tombol kasir maupun otomatis."""
    brand = brand or BRAND_FALLBACK
    channel = order.get("channel") or "pos"
    batch = order.get("batch") or {}
    pay = order.get("payment") or {}
    cust = order.get("customer") or {}
    subtotal = (order.get("breakdown") or {}).get("subtotal") or 0
    total = (order.get("breakdown") or {}).get("total") or 0

    lines = [f"*{brand} — Nota Digital*", "", f"Kode Pesanan: *{order.get('orderId')}*"]
    lines.append(f"Pelanggan: {cust.get('name') or '-'}")
    if channel == "preorder" and batch.get("name"):
        lines.append(f"Batch: {batch['name']}")
    if batch.get("pickupDate"):
        lines.append(f"Siap diambil: {batch['pickupDate']}")
    lines += ["", _item_lines(order.get("items")), ""]
    lines.append(f"Subtotal: {_rupiah(subtotal)}")
    lines.append(f"Total: *{_rupiah(total)}*")
    paid_label = "LUNAS" if pay.get("paid") else "Belum lunas"
    lines.append(f"Bayar: {paid_label} ({pay.get('label') or pay.get('method') or '-'})")
    lines += ["", f"Status: {order.get('orderStatus') or '-'}"]
    lines += ["", "Tersimpan otomatis. Simpan nota ini sebagai bukti."]
    return "\n".join(lines)


def status_text(order: dict, status: str, brand: str = BRAND_FALLBACK, pickup_location: str = "") -> str:
    """Dikirim otomatis setiap status penyiapan berubah."""
    brand = brand or BRAND_FALLBACK
    head = f"*{brand}* — Pesanan *{order.get('orderId')}*"
    batch = order.get("batch") or {}
    loc = _resolve_pickup_location(order, pickup_location)
    ready_line = (
        f"Silakan ambil pesanan Anda di *{loc}* dan sebutkan kode pesanan di atas. Terima kasih!"
        if loc
        else "Silakan datang ke meja kasir dan sebutkan kode pesanan di atas. Terima kasih!"
    )
    mapping = {
        "Diterima & Disiapkan": [
            head,
            "",
            "Pesanan Anda sudah kami terima dan masuk antrean dapur.",
            "Kami kabari lagi saat hidangan siap diambil.",
        ],
        "Sedang Disiapkan": [
            head,
            "",
            "Pesanan Anda sedang diracik oleh barista kami. Mohon tunggu sebentar lagi.",
        ],
        "Siap Diambil": [
            head,
            "",
            "*Pesanan Anda SIAP DIAMBIL*.",
            f"Batch: {batch['name']}" if batch.get("name") else None,
            f"Lokasi: *{loc}*" if loc else None,
            ready_line,
        ],
        "Reschedule Pengambilan": [
            head,
            "",
            "*Pengambilan pesanan Anda DIJADWAL ULANG (Reschedule Pengambilan).*",
            f"Batch: {batch['name']}" if batch.get("name") else None,
            "Mohon hubungi kasir/admin untuk konfirmasi jadwal pengambilan terbaru. Terima kasih!",
        ],
        "Selesai": [
            head,
            "",
            f"Pesanan Anda sudah selesai. Terima kasih sudah berkunjung di {brand}!",
            "",
            f"Beri rating & ulasan pesanan Anda di sini:\n{order['ratingUrl']}" if order.get("ratingUrl") else None,
        ],
        "Batal": [
            head,
            "",
            "Pesanan Anda telah dibatalkan oleh pihak kedai. Mohon hubungi kasir/admin bila ada pertanyaan atau kendala.",
        ],
        "Dibatalkan": [
            head,
            "",
            "Pesanan Anda telah dibatalkan oleh pihak kedai. Mohon hubungi kasir/admin bila ada pertanyaan atau kendala.",
        ],
    }
    body = mapping.get(status, [head, "", f"Status pesanan Anda: {status}"])
    return "\n".join(line for line in body if line is not None)


def pickup_reminder_text(order: dict, brand: str = BRAND_FALLBACK, pickup_location: str = "") -> str:
    """Pesan pengingat pengambilan pesanan untuk pelanggan."""
    brand = brand or BRAND_FALLBACK
    cust = order.get("customer") or {}
    batch = order.get("batch") or {}
    loc = _resolve_pickup_location(order, pickup_location)
    lines = [
        f"*{brand} — Pengingat Pengambilan Pesanan*",
        "",
        f"Halo *{cust.get('name') or 'Pelanggan'}*, pesanan Anda dengan kode *{order.get('orderId')}* sudah siap untuk diambil.",
        f"Batch: {batch['name']}" if batch.get("name") else None,
        f"Jadwal ambil: {batch['pickupDate']}" if batch.get("pickupDate") else None,
        f"Lokasi pengambilan: *{loc}*" if loc else "Silakan datang ke outlet kami.",
        "",
        "Tunjukkan kode pesanan di atas saat pengambilan. Terima kasih!",
    ]
    return "\n".join(line for line in lines if line is not None)
