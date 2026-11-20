# SIKopi — Sistem Kasir & Pemesanan Mandiri

SIKopi adalah aplikasi kasir (POS) + pemesanan mandiri untuk kedai kopi.
Pelanggan melihat menu dan memesan langsung dari HP **tanpa akun dan tanpa
login** — cukup isi nama dan nomor WhatsApp saat pembayaran, lalu lacak
pesanan lewat kode transaksi. Kasir mengelola pesanan, pembayaran, dan struk
dari satu panel admin.

## Fitur utama

- **Pesan tanpa login** — katalog, keranjang, dan pelacakan pesanan terbuka untuk semua.
- **Dua mode jualan + Jeda Pemesanan** (saling eksklusif, dikelola dari panel admin):
  - *On-site / Hari Jualan* — pesan di outlet, bayar tunai atau QRIS di kasir.
  - *Open PO* — pesan per batch (mendukung antrean batch terjadwal, edit batch, dan keterangan pengambilan), wajib transfer + upload bukti pembayaran sebelum pesanan tercatat.
  - *Jeda Pemesanan* — menonaktifkan checkout sementara (pelanggan tetap bisa melihat-lihat katalog menu).
- **Kustomisasi varian, paket bundel, & stok terhubung** — mendukung grup varian (single/multi-select, wajib `*`, harga `+/-`, serta preset Kopi & Pandan) dan stok produk opsional yang otomatis menentukan ketersediaan paket bundel serta kembali saat pesanan dibatalkan.
- **QRIS dinamis & bukti pembayaran foto** — nominal terkunci sesuai total belanja; bukti foto dikompres otomatis di browser (±2 MB) dan diverifikasi kasir.
- **Notifikasi WhatsApp, Reminder, & Rekap Chef** — pesan otomatis (pesanan diterima, lunas, *Sedang Disiapkan*, *Siap Diambil* dengan lokasi pengambilan kustom, *Reschedule Pengambilan*, dan *Selesai* disertai tautan rating), tombol **Reminder Pengambilan**, serta **Rekap Batch** & **Rekap On-site (Belum Selesai)** yang memisahkan **Minuman** & **Makanan** (`=====`) beserta daftar pemesan untuk dikirim ke grup WA Chef.
- **Rating & ulasan tanpa login** — link rating unik per pesanan pada pesan WA status *Selesai*, serta carousel ulasan otomatis di halaman utama.
- **Struk termal Bluetooth** — struk dapur + struk pelanggan (58 mm / 80 mm).
- **Analitik & ekspor** — omzet, menu terlaris, ringkasan rating, dan ekspor Excel/CSV.

## Tech stack

| Lapis | Teknologi |
|---|---|
| Frontend | Vue 3 + Pinia + Vite (deploy: Vercel) |
| Backend | FastAPI + SQLAlchemy + SQLite (jalan always-on, mis. VPS / mini PC) |
| Notifikasi WA | Sidecar Node.js self-hosted (`wa-gateway/`, tanpa layanan pihak ketiga) |

## Struktur repo

```
├── frontend/     # Vue 3 (Vercel-ready, lihat frontend/.env.example)
├── backend/      # FastAPI (Dockerfile tersedia)
├── wa-gateway/   # Sidecar pengirim WhatsApp (Node.js)
└── docker-compose.yml
```

## Cara menjalankan (lokal, 3 terminal)

```powershell
# Terminal 1 — gateway WhatsApp
cd wa-gateway
npm install
node server.js        # :3001

# Terminal 2 — backend
cd backend
copy .env.example .env   # lalu isi kredensial admin & nomor WA admin
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8005 --reload

# Terminal 3 — frontend
cd frontend
npm install
npm run dev           # http://localhost:5173
```

Atau sekaligus via Docker: `docker compose up --build`
(backend `:8005`, gateway `:3001`).

> **Pairing WhatsApp (sekali):** buka `/admin` → kartu WhatsApp → scan QR
> dengan **nomor khusus pengirim** (bukan nomor pribadi).

## Konfigurasi

Semua rahasia dibaca dari environment, tidak pernah di-commit. Contoh nilai
ada di `backend/.env.example` dan `frontend/.env.example`:

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — login kasir & admin.
- `ADMIN_WHATSAPP` — nomor WhatsApp admin.
- `WA_GATEWAY_URL` — alamat service wa-gateway.
- `FRONTEND_URL` — alamat web frontend (dipakai untuk membuat tautan halaman rating di pesan WA status *Selesai*).
- `VITE_API_URL` — alamat backend untuk frontend.
- `VITE_GFORM_FALLBACK_URL` — link Google Form cadangan opsional bila backend tidak terjangkau.

## Verifikasi

```powershell
cd backend
python selftest.py        # self-check aturan bisnis (tanpa pytest)

cd ../frontend
npx vitest run            # unit test
npm run build             # production build
```

## Tim & lisensi

Proyek mata kuliah Kewirausahaan (KWU), Semester 7.
