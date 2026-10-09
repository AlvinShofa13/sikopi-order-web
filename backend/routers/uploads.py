import os
import re
import uuid
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/uploads", tags=["Uploads"])

BASE_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
MENU_DIR = os.path.join(BASE_UPLOADS_DIR, "menu")
PROOF_DIR = os.path.join(BASE_UPLOADS_DIR, "proof")
for _d in (MENU_DIR, PROOF_DIR):
    os.makedirs(_d, exist_ok=True)

# SVG disengaja dikeluarkan: bisa berisi JavaScript (stored XSS via /uploads).
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_MENU_BYTES = 10 * 1024 * 1024
MAX_PROOF_BYTES = 2 * 1024 * 1024

# Kode transaksi yang sah (lihat routers/orders.py): SK- + 8 char tanpa
# karakter ambigu (0/O, 1/I). Satu sumber kebenaran untuk generator & validasi.
ORDER_CODE_RE = re.compile(r"^SK-[0-9A-HJ-NP-Z]{8}$")


async def save_image(file: UploadFile | None, dest_dir: str, prefix: str, max_bytes: int) -> str:
    """Validasi + simpan gambar, return path relatif URL (/uploads/...)."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="File gambar tidak boleh kosong.")
    try:
        content = await file.read(max_bytes + 1)
    finally:
        await file.close()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file melebihi batas {max_bytes // (1024 * 1024)}MB."
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Format file '{ext}' tidak didukung. Format yang diperbolehkan: JPG, PNG, WEBP, GIF."
        )

    unique_name = f"{prefix}_{uuid.uuid4().hex[:12]}{ext}"
    try:
        with open(os.path.join(dest_dir, unique_name), "wb") as buffer:
            buffer.write(content)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file gambar di backend: {e}")

    return f"/uploads/{os.path.basename(dest_dir)}/{unique_name}"


@router.post("/proof")
async def upload_payment_proof(
    code: str,
    file: UploadFile = File(...),
):
    """Upload bukti pembayaran (publik, maks 2MB). Nama file memakai kode transaksi
    agar bukti langsung terhubung ke pesanan: /uploads/proof/<kode>_<uuid>.<ext>"""
    clean_code = (code or "").strip().upper()
    if not ORDER_CODE_RE.match(clean_code):
        raise HTTPException(
            status_code=400,
            detail="Kode transaksi tidak valid. Muat ulang halaman pembayaran lalu coba lagi.",
        )
    url = await save_image(file, PROOF_DIR, clean_code, MAX_PROOF_BYTES)
    return {"url": url, "filename": url.rsplit("/", 1)[-1], "code": clean_code}