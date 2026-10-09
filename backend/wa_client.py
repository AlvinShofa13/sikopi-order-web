"""Klien HTTP ke service wa-gateway (Baileys, self-hosted, tanpa pihak ketiga).

Sengaja memakai urllib stdlib — tidak ada dependency baru. Semua pengiriman
bersifat fire-and-forget dari sisi order flow: gagal kirim TIDAK PERNAH
menggagalkan pencatatan/pembaruan pesanan (lihat routers/orders.py).
"""

import json
import logging
import os
import urllib.request

log = logging.getLogger("sikopi.wa")

TIMEOUT_SEC = 8


def gateway_url() -> str:
    return (os.getenv("WA_GATEWAY_URL") or "http://localhost:3001").rstrip("/")


def _post(path: str, payload: dict):
    try:
        req = urllib.request.Request(
            gateway_url() + path,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except Exception as e:  # gateway mati / belum pairing / timeout
        log.warning("wa-gateway %s gagal: %s", path, e)
        return 0, {}


def _get(path: str):
    try:
        with urllib.request.urlopen(gateway_url() + path, timeout=TIMEOUT_SEC) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except Exception as e:
        log.warning("wa-gateway %s gagal: %s", path, e)
        return 0, {}


def send_wa_text(phone: str, text: str) -> bool:
    """Kirim teks ke nomor WA (format 62…, tanpa '+'). True bila diterima gateway."""
    if not phone or not text:
        return False
    status, _ = _post("/send", {"to": phone, "text": text})
    return status == 200


def wa_gateway_status() -> dict:
    """Status koneksi Baileys untuk panel admin. {} bila gateway tak terjangkau."""
    status, data = _get("/status")
    if status != 200:
        return {"connected": False, "reachable": False}
    return {"connected": bool(data.get("connected")), "reachable": True, "qr": data.get("qr")}
