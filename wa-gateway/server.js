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
const fs = require('fs')
const path = require('path')
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
let connectTimer = null

function scheduleConnect(delay) {
  // Satu jadwal reconnect saja: /logout dan handler 'close' bisa memicu
  // bersamaan, tanpa ini dua socket hidup sekaligus (satu bocor).
  if (connectTimer) clearTimeout(connectTimer)
  connectTimer = setTimeout(() => { connectTimer = null; connect() }, delay)
}

function clearAuthDir() {
  // Baileys tidak menghapus berkas sesi saat logout: tanpa ini reconnect
  // memakai sesi mati (loop 401). Sisakan .gitkeep agar folder tetap ada.
  try {
    for (const f of fs.readdirSync(AUTH_DIR)) {
      if (f === '.gitkeep') continue
      fs.rmSync(path.join(AUTH_DIR, f), { recursive: true, force: true })
    }
  } catch (e) {
    console.log('[wa] gagal membersihkan sesi:', e && e.message)
  }
}

function digits(raw) {
  return String(raw || '').replace(/\D/g, '').replace(/^0/, '')
}

const silentLogger = {
  level: 'silent',
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  child() { return this }
}

let consecutiveFails = 0
let badSessionFails = 0
let isConnecting = false
let cachedVersion = null
let heartbeatTimer = null

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function cleanupSocket() {
  stopHeartbeat()
  if (!sock) return
  try {
    sock.ev?.removeAllListeners()
  } catch { /* abaikan */ }
  try {
    sock.ws?.close?.()
  } catch { /* abaikan */ }
  try {
    sock.end?.()
  } catch { /* abaikan */ }
  sock = null
}

function startHeartbeat() {
  stopHeartbeat()
  // Watchdog ringan: andalkan ping native Baileys (keepAliveIntervalMs: 25s),
  // dan cek setiap 60 detik apakah WebSocket diam-diam sudah tertutup/setengah putus.
  heartbeatTimer = setInterval(() => {
    if (!connected || !sock) return
    const wsState = sock.ws?.readyState
    // 1 = OPEN; selain OPEN (CLOSING=2, CLOSED=3) berarti socket sudah mati diam-diam.
    if (typeof wsState === 'number' && wsState !== 1) {
      console.log(`[wa] watchdog mendeteksi socket tidak aktif (readyState=${wsState}) — reconnect...`)
      connected = false
      cleanupSocket()
      scheduleConnect(2000)
    }
  }, 60 * 1000)
}

function resetOldSession() {
  cleanupSocket()
  lastQr = null
  clearAuthDir()
}

const sentStore = new Map()
function rememberSentMessage(msg) {
  const id = msg?.key?.id
  if (!id || !msg?.message) return
  sentStore.set(id, msg.message)
  if (sentStore.size > 200) {
    const oldestKey = sentStore.keys().next().value
    sentStore.delete(oldestKey)
  }
}

async function resolveWaVersion() {
  if (cachedVersion) return cachedVersion
  try {
    const { version } = await fetchLatestBaileysVersion()
    cachedVersion = version
    return version
  } catch (err) {
    console.log('[wa] gagal fetch versi terbaru, pakai fallback default:', err && err.message)
    return [2, 3000, 1015901307]
  }
}

async function connect() {
  if (isConnecting) return
  isConnecting = true
  try {
    // Pastikan tidak pernah ada dua socket Baileys aktif bersamaan (mencegah 440/500/401).
    cleanupSocket()

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const version = await resolveWaVersion()

    const activeSock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: ['SIKopi Gateway', 'Chrome', '1.0'],
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async (key) => sentStore.get(key?.id) || undefined
    })
    sock = activeSock

    activeSock.ev.on('creds.update', saveCreds)

    activeSock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      // Abaikan event terlambat dari socket lama yang sudah diganti.
      if (sock !== activeSock) return

      if (qr) {
        lastQr = await QRCode.toDataURL(qr, { width: 280, margin: 1 })
        connected = false
      }
      if (connection === 'open') {
        connected = true
        lastQr = null
        consecutiveFails = 0
        badSessionFails = 0
        startHeartbeat()
        console.log('[wa] terhubung sebagai perangkat tertaut')
      }
      if (connection === 'close') {
        connected = false
        stopHeartbeat()
        consecutiveFails += 1
        const code = lastDisconnect?.error?.output?.statusCode

        if (code === DisconnectReason.badSession) {
          badSessionFails += 1
        } else {
          badSessionFails = 0
        }

        // Hapus sesi ./auth HANYA bila benar-benar loggedOut (401), multideviceMismatch (411),
        // atau badSession (500) berulang 5x berturut-turut. Gangguan jaringan/idle/sleep TIDAK
        // menghapus sesi sehingga reconnect otomatis tanpa scan QR ulang.
        const mustResetAuth =
          code === DisconnectReason.loggedOut ||
          code === DisconnectReason.multideviceMismatch ||
          badSessionFails >= 5

        if (mustResetAuth) {
          consecutiveFails = 0
          badSessionFails = 0
          resetOldSession()
          console.log(`[wa] sesi tidak valid (code ${code}) — sesi dibersihkan, membuat QR baru...`)
          scheduleConnect(1500)
        } else {
          const delay = code === DisconnectReason.restartRequired
            ? 1500
            : Math.min(15000, consecutiveFails * 3000)
          console.log(`[wa] koneksi terputus sementara (code ${code}) — mencoba reconnect (${delay / 1000}s)...`)
          scheduleConnect(delay)
        }
      }
    })
  } catch (err) {
    connected = false
    stopHeartbeat()
    consecutiveFails += 1
    const delay = Math.min(15000, consecutiveFails * 3000)
    console.log('[wa] gagal inisialisasi koneksi:', err && err.message)
    scheduleConnect(delay)
  } finally {
    isConnecting = false
  }
}

app.post('/send', async (req, res) => {
  const to = digits(req.body && req.body.to)
  const text = String((req.body && req.body.text) || '').slice(0, 4000)
  if (!to || !text) return res.status(400).json({ ok: false, error: 'to & text wajib diisi' })
  if (!sock || !connected) return res.status(503).json({ ok: false, error: 'WhatsApp belum terhubung (scan QR dulu)' })
  try {
    let targetJid = `${to}@s.whatsapp.net`
    try {
      const checks = await sock.onWhatsApp(targetJid)
      if (Array.isArray(checks) && checks[0]?.jid) {
        targetJid = checks[0].jid
      }
    } catch { /* fallback ke format standar */ }
    const sentMsg = await sock.sendMessage(targetJid, { text })
    rememberSentMessage(sentMsg)
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
  consecutiveFails = 0
  badSessionFails = 0
  resetOldSession()
  scheduleConnect(1500)
  res.json({ ok: true })
})

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[wa] gateway jalan di port ${PORT}`)
  connect()
})
