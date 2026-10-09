# SIKopi — Sistem Kasir & Pemesanan Mandiri

SIKopi adalah aplikasi kasir (POS) + pemesanan mandiri untuk kedai kopi.
Pelanggan melihat menu dan memesan langsung dari HP **tanpa akun dan tanpa
login** — cukup isi nama dan nomor WhatsApp saat pembayaran, lalu lacak
pesanan lewat kode transaksi. Kasir mengelola pesanan, pembayaran, dan struk
dari satu panel admin.

## Fitur utama

- **Pesan tanpa login** — katalog, keranjang, dan pelacakan pesanan terbuka untuk semua.
- **Dua mode jualan** (saling eksklusif, diganti dari panel admin):
  - *On-site / Hari Jualan* — pesan di outlet, bayar tunai atau QRIS di kasir.
  - *Open PO* — pesan dari jauh per batch, wajib transfer + upload bukti pembayaran sebelum pesanan tercatat.
- **QRIS dinamis** — nominal terkunci otomatis sesuai total belanja.
- **Bukti pembayaran foto** — dikompres otomatis di browser (±2 MB), diverifikasi kasir sebelum lunas.
- **Notifikasi WhatsApp otomatis** — kabar pesanan diterima, pembayaran lunas, dan setiap perubahan status (termasuk "Siap Diambil") terkirim langsung ke nomor customer.
- **Struk termal Bluetooth** — struk dapur + struk pelanggan (58 mm / 80 mm).
- **Analitik & ekspor** — omzet, menu terlaris, rekap Excel/CSV.

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
- `VITE_API_URL` — alamat backend untuk frontend.

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
Dokumen spesifikasi internal (`PRD.md`) tidak dipublikasikan — lihat `.gitignore`.
