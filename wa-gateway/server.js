/**
 * SIKopi WA Gateway — sidecar Baileys (WhatsApp Web protocol, self-hosted).
 *
 * Bukan layanan pihak ketiga: jalan di mesin/docker sendiri, login sebagai
 * "perangkat tertaut" dengan scan QR sekali dari nomor pengirim khusus.
 * Sesi tersimpan di ./auth sehingga survive restart.
 *
 * API:
 *   POST /send { to: "628...", text: "..." } -> { ok: true }
 *   GET  /status -> { connected: bool, qr: dataUrl|null }
 *   POST /logout -> hapus sesi (paksa pairing ulang)
 *
 * Keamanan: service ini hanya di-bind ke localhost / jaringan docker internal.
 * Jangan expose port 3001 ke publik tanpa autentikasi.
 */

const express = require('express')
const QRCode = require('qrcode')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const PORT = Number(process.env.WA_PORT || 3001)
const AUTH_DIR = process.env.WA_AUTH_DIR || './auth'

const app = express()
app.use(express.json({ limit: '256kb' }))

let sock = null
let connected = false
let lastQr = null

function digits(raw) {
  return String(raw || '').replace(/\D/g, '').replace(/^0/, '')
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['SIKopi Gateway', 'Chrome', '1.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      lastQr = await QRCode.toDataURL(qr, { width: 280, margin: 1 })
      connected = false
    }
    if (connection === 'open') {
      connected = true
      lastQr = null
      console.log('[wa] terhubung sebagai perangkat tertaut')
    }
    if (connection === 'close') {
      connected = false
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[wa] koneksi tertutup (code ${code})${loggedOut ? ' — sesi dihapus, perlu scan ulang' : ' — mencoba lagi...'}`)
      // loggedOut (401): hapus sesi agar QR baru muncul; selain itu reconnect otomatis.
      setTimeout(connect, loggedOut ? 1000 : 5000)
    }
  })
}

app.post('/send', async (req, res) => {
  const to = digits(req.body && req.body.to)
  const text = String((req.body && req.body.text) || '').slice(0, 4000)
  if (!to || !text) return res.status(400).json({ ok: false, error: 'to & text wajib diisi' })
  if (!sock || !connected) return res.status(503).json({ ok: false, error: 'WhatsApp belum terhubung (scan QR dulu)' })
  try {
    await sock.sendMessage(`${to}@s.whatsapp.net`, { text })
    return res.json({ ok: true })
  } catch (e) {
    console.log('[wa] kirim gagal:', e && e.message)
    return res.status(502).json({ ok: false, error: 'gagal mengirim' })
  }
})

app.get('/status', (_req, res) => {
  res.json({ connected, qr: connected ? null : lastQr })
})

app.post('/logout', async (_req, res) => {
  try {
    await sock?.logout()
  } catch { /* abaikan */ }
  connected = false
  lastQr = null
  setTimeout(connect, 1000)
  res.json({ ok: true })
})

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[wa] gateway jalan di port ${PORT}`)
  connect()
})
