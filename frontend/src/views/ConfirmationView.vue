<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { isOrderPaid, paymentLabel } from '@/utils/salesAnalytics'
import { formatRupiah } from '@/utils/format'
import { orderStatusText, openWhatsApp } from '@/utils/wa'
import AppIcon from '@/components/icons/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const store = useOrderStore()

const copied = ref(false)
const orderId = computed(() => route.params.id)

const order = computed(() => {
  return store.getOrderById(orderId.value)
})

const orderPaid = computed(() => isOrderPaid(order.value))
const isPreorder = computed(() => order.value?.channel === 'preorder')
const proofUrl = computed(() => {
  const p = order.value?.payment?.proof
  return p ? api.fileUrl(p) : ''
})

// Halaman dibuka tanpa pesanan di store (mis. bookmark lama / device lain):
// pelanggan cukup mengetik kode transaksinya.
const lookupCode = ref('')
const lookupError = ref('')
const isLookingUp = ref(false)

async function lookupOrder() {
  const code = (lookupCode.value || '').trim().toUpperCase()
  if (!code) return
  isLookingUp.value = true
  lookupError.value = ''
  const res = await api.orders.getById(code)
  isLookingUp.value = false
  if (!res.ok) {
    lookupError.value = res.error || 'Kode pesanan tidak ditemukan.'
    return
  }
  store.handleIncomingOrder(res.data)
  router.replace(`/konfirmasi/${res.data.orderId}`)
}

function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

// Status Penyiapan Dinamis
const isStep2Active = computed(() => {
  const st = order.value?.orderStatus
  return st === 'Diterima & Disiapkan' || st === 'Sedang Disiapkan' || isStep3Active.value
})

const isStep3Active = computed(() => {
  const st = order.value?.orderStatus
  return st === 'Siap Diambil' || st === 'Siap Disajikan' || st === 'Selesai'
})

const isFullyCompleted = computed(() => {
  return order.value?.orderStatus === 'Selesai'
})

const step2StatusClass = computed(() => {
  if (isStep3Active.value) return 'completed'
  if (isStep2Active.value) return 'in-progress'
  return 'pending'
})

const step3StatusClass = computed(() => {
  if (isFullyCompleted.value) return 'completed'
  if (isStep3Active.value) return 'completed ready'
  return 'pending'
})

const currentPrepLabel = computed(() => {
  if (isFullyCompleted.value) return 'Pesanan Selesai'
  if (isStep3Active.value) return 'Siap Diambil di Barista'
  return 'Sedang Disiapkan di Dapur'
})

const prepStatusClass = computed(() => {
  if (isFullyCompleted.value) return 'completed'
  if (isStep3Active.value) return 'ready'
  return ''
})

// Modal & Audio Notifikasi Siap Diambil
const showReadyModal = ref(false)
const hasNotifiedReady = ref(false)

function playReadyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
      gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.6)
    })
  } catch {
    // browser audio policy
  }
}

function checkAndTriggerReadyNotice(status) {
  if ((status === 'Siap Diambil' || status === 'Siap Disajikan') && !hasNotifiedReady.value) {
    hasNotifiedReady.value = true
    showReadyModal.value = true
    playReadyChime()
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400])
    }
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Pesanan Siap Diambil! ☕', {
          body: `Pesanan #${orderId.value} Anda telah selesai disiapkan. Silakan ambil di meja barista!`,
          icon: '/favicon.ico'
        })
      } catch {}
    }
  }
}

// Watch status order realtime
watch(() => order.value?.orderStatus, (newStatus) => {
  if (newStatus) checkAndTriggerReadyNotice(newStatus)
}, { immediate: true })

// Polling status pesanan & pembayaran
let statusPollTimer = null

async function refreshOrderStatus() {
  if (!orderId.value) {
    stopStatusPolling()
    return
  }
  const current = store.getOrderById(orderId.value)
  const isPaid = isOrderPaid(current)
  const isReadyOrDone = current?.orderStatus === 'Siap Diambil' || current?.orderStatus === 'Siap Disajikan' || current?.orderStatus === 'Selesai'

  if (isPaid && isReadyOrDone) {
    stopStatusPolling()
    return
  }

  const res = await api.orders.getById(orderId.value)
  if (res.ok && res.data) {
    store.handleIncomingOrder(res.data)
    if (res.data.orderStatus) {
      checkAndTriggerReadyNotice(res.data.orderStatus)
    }
    if (isOrderPaid(res.data) && (res.data.orderStatus === 'Siap Diambil' || res.data.orderStatus === 'Siap Disajikan' || res.data.orderStatus === 'Selesai')) {
      stopStatusPolling()
    }
  }
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer)
    statusPollTimer = null
  }
}

onMounted(async () => {
  if (!order.value) {
    const res = await api.orders.getById(orderId.value)
    if (res.ok && res.data) store.handleIncomingOrder(res.data)
  }
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch {}
  }
  const current = store.getOrderById(orderId.value)
  if (!isOrderPaid(current) || (current?.orderStatus !== 'Siap Diambil' && current?.orderStatus !== 'Siap Disajikan' && current?.orderStatus !== 'Selesai')) {
    statusPollTimer = setInterval(refreshOrderStatus, 3000)
  }
})

onUnmounted(() => {
  stopStatusPolling()
})


function formatDate(isoString) {
  if (!isoString) return new Date().toLocaleString('id-ID')
  const date = new Date(isoString)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

function copyOrderNumber() {
  if (!orderId.value) return
  navigator.clipboard.writeText(orderId.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2200)
}

// Kabar "Siap Diambil" dari modal notifikasi: wa.me membuka chat dengan
// pesan sudah terisi, tinggal tekan "Kirim" di WhatsApp.
function sendStatusUpdate() {
  if (!order.value) return
  openWhatsApp(
    order.value.customer?.phone,
    orderStatusText(order.value, order.value.orderStatus, store.brandName)
  )
}

function startNewOrder() {
  router.push('/menu')
}
</script>

<template>
  <div class="confirmation-view">
    <div class="container confirmation-container">
      <!-- Pesanan tidak ada di perangkat ini: minta kode transaksi -->
      <div v-if="!order" class="lookup-card">
        <div class="lookup-icon-wrap"><AppIcon name="receipt" :size="32" /></div>
        <h1 class="lookup-title">Cek Status Pesanan</h1>
        <p class="lookup-subtitle">
          Tidak ada akun atau password yang perlu diingat. Masukkan kode transaksi
          <span class="font-mono">{{ orderId }}</span> yang Anda terima saat memesan,
          atau ketik kode pesanan Anda yang lain.
        </p>
        <div class="lookup-form">
          <input
            v-model="lookupCode"
            type="text"
            placeholder="Contoh: SK-2K9QW4Z7"
            class="lookup-input font-mono"
            @keyup.enter="lookupOrder"
          />
          <button type="button" class="btn-lookup" :disabled="isLookingUp" @click="lookupOrder">
            {{ isLookingUp ? 'Mencari...' : 'Lihat Status' }}
          </button>
        </div>
        <span v-if="lookupError" class="lookup-error">{{ lookupError }}</span>
        <button type="button" class="btn-back-menu" @click="startNewOrder">
          Kembali ke Pilihan Menu
        </button>
      </div>

      <template v-else>
      <!-- Minimal Stepper -->
      <div class="checkout-stepper print-hide">
        <div class="step-indicator completed">
          <span class="step-circle">
            <AppIcon name="check" :size="13" />
          </span>
          <span class="step-name">Daftar Pesanan</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator completed">
          <span class="step-circle">
            <AppIcon name="check" :size="13" />
          </span>
          <span class="step-name">Pembayaran</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator active">
          <span class="step-circle">3</span>
          <span class="step-name">Pesanan Dibuat</span>
        </div>
      </div>

      <!-- Success Hero Banner -->
      <div class="success-hero-card">
        <div class="success-icon-wrap">
          <AppIcon name="check" :size="32" stroke-width="2.5" />
        </div>

        <h1 class="success-title">{{ isPreorder ? 'Pesanan Open PO Terkirim!' : 'Pesanan Berhasil Dibuat!' }}</h1>
        <p class="success-subtitle">
          <template v-if="isPreorder">
            Bukti pembayaran Anda sudah kami terima dan menunggu verifikasi kasir.
            Pesanan langsung masuk batch <strong>{{ order?.batch?.name }}</strong>.
          </template>
          <template v-else>
            Pesanan Anda sudah masuk antrean barista. Nominal akhir dihitung server
            dari harga menu terbaru, jadi struct ini yang berlaku.
          </template>
        </p>

        <!-- High Visibility Order Number Box -->
        <div class="order-number-banner">
          <span class="order-number-kicker">Kode Transaksi Pesanan Anda</span>
          <div class="number-action-row">
            <span class="order-number-val font-mono">{{ orderId }}</span>
            <button
              type="button"
              class="btn-copy-id"
              @click="copyOrderNumber"
              :title="copied ? 'Tersalin' : 'Salin Kode Pesanan'"
            >
              <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />
              <span>{{ copied ? 'Tersalin' : 'Salin' }}</span>
            </button>
          </div>
          <p class="order-number-hint">
            Simpan kode ini. Buka tautan <span class="font-mono">/konfirmasi/{{ orderId }}</span>
            kapan saja untuk melihat status, tanpa perlu login.
          </p>
        </div>
      </div>

      <!-- Info Batch Open PO -->
      <div v-if="isPreorder && order?.batch" class="batch-summary-card">
        <div class="batch-summary-row">
          <AppIcon name="receipt" :size="16" />
          <span>Batch</span>
          <strong>{{ order.batch.name }}</strong>
        </div>
        <div class="batch-summary-row">
          <AppIcon name="clock" :size="16" />
          <span>Siap diambil</span>
          <strong>{{ formatDateTime(order.batch.pickupDate) }}</strong>
        </div>
      </div>

      <!-- Bukti pembayaran yang diunggah -->
      <div v-if="proofUrl" class="proof-card">
        <div class="proof-card-head">
          <AppIcon name="shield-check" :size="18" />
          <strong>Bukti pembayaran terkirim</strong>
          <span v-if="orderPaid" class="proof-verified-badge">Terverifikasi kasir</span>
          <span v-else class="proof-pending-badge">Menunggu verifikasi kasir</span>
        </div>
        <img :src="proofUrl" alt="Bukti pembayaran" class="proof-thumb" />
      </div>

      <!-- Guidance Alert Box (Hanya tampil jika belum lunas) -->
      <div v-if="!orderPaid" class="cashier-guidance-card">
        <div class="guidance-icon-box">
          <AppIcon name="receipt" :size="24" />
        </div>
        <div class="guidance-body">
          <h3 class="guidance-title">
            {{ order?.payment?.method === 'cash' ? 'Langkah Selanjutnya di Meja Kasir' : 'Menunggu Verifikasi Pembayaran' }}
          </h3>
          <p class="guidance-text">
            <template v-if="order?.payment?.method === 'cash'">
              Silakan menuju <strong>Meja Kasir {{ store.brandName || 'SIKopi' }}</strong>.
              Sebutkan nama Anda atau kode pesanan untuk membayar sebesar
              <strong>{{ formatRupiah(order?.breakdown?.total) }}</strong> — kasir juga bisa
              menampilkan QRIS dinamis sesuai nominal. Struk resmi dicetak setelah lunas.
            </template>
            <template v-else>
              Bukti transfer Anda sudah masuk dan sedang diperiksa kasir
              <strong>{{ store.brandName || 'SIKopi' }}</strong>. Setelah terverifikasi, Anda
              menerima <strong>nota digital</strong> lewat WhatsApp dan pesanan Anda mulai diracik.
            </template>
          </p>
        </div>
      </div>

      <!-- Status Progress Tracker -->
      <div class="status-tracker-card">
        <div class="tracker-header-row">
          <h3 class="tracker-title">Status Penyiapan Hidangan</h3>
          <span class="current-prep-badge" :class="prepStatusClass">
            {{ currentPrepLabel }}
          </span>
        </div>
        
        <div class="tracker-timeline">
          <!-- Tahap 1: Pesanan Dibuat -->
          <div class="timeline-step completed">
            <div class="step-dot">
              <AppIcon name="check" :size="14" />
            </div>
            <div class="step-info">
              <span class="step-label">Pesanan Dibuat</span>
              <span class="step-sub">Tercatat di sistem</span>
            </div>
          </div>

          <div class="timeline-bar" :class="{ active: isStep2Active || isStep3Active }"></div>

          <!-- Tahap 2: Dapur & Kasir -->
          <div class="timeline-step" :class="step2StatusClass">
            <div class="step-dot">
              <AppIcon v-if="isStep3Active" name="check" :size="14" />
              <AppIcon v-else name="clock" :size="14" />
            </div>
            <div class="step-info">
              <span class="step-label">Dapur & Barista</span>
              <span class="step-sub">{{ isStep3Active ? 'Selesai diracik' : 'Sedang disiapkan' }}</span>
            </div>
          </div>

          <div class="timeline-bar" :class="{ active: isStep3Active }"></div>

          <!-- Tahap 3: Siap Disajikan / Ambil -->
          <div class="timeline-step" :class="step3StatusClass">
            <div class="step-dot">
              <AppIcon v-if="isStep3Active" name="sparkles" :size="14" />
              <span v-else class="dot-inner"></span>
            </div>
            <div class="step-info">
              <span class="step-label">Siap Disajikan</span>
              <span class="step-sub">{{ isStep3Active ? 'Ambil di meja barista' : 'Menunggu selesai' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Struk Digital Pelanggan (Read-Only) -->
      <div class="receipt-card receipt-card-customer">
        <div class="receipt-type-pill customer">
          <AppIcon name="leaf" :size="14" />
          <span>Rincian Struk Digital</span>
        </div>

        <div class="receipt-header">
          <div class="receipt-brand">
            <span class="receipt-brand-name">SIKopi</span>
          </div>
          <p class="receipt-type-tag">[ BUKTI PEMESANAN MANDIRI ]</p>
        </div>

        <div class="receipt-divider-dashed"></div>

        <!-- Meta Grid -->
        <div class="receipt-meta-grid">
          <div class="meta-item">
            <span class="meta-label">Nomor Pesanan</span>
            <span class="meta-val font-mono">{{ orderId }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Nama Pemesan</span>
            <span class="meta-val font-bold">{{ order?.customer?.name || 'Pelanggan' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Mode Pesanan</span>
            <span class="meta-val">{{ isPreorder ? `Open PO · ${order?.batch?.name || '-'}` : 'On-site / Hari Jualan' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Waktu Pemesanan</span>
            <span class="meta-val">{{ formatDate(order?.createdAt) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Metode Pembayaran</span>
            <span class="meta-val font-bold">
              {{ order?.payment?.label || (order?.payment?.method === 'cash' ? 'Bayar di Kasir' : 'Transfer QRIS + Bukti') }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status Pembayaran</span>
            <span class="meta-val payment-status-badge" :class="{ paid: orderPaid }">
              {{ paymentLabel(order) }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Nomor WhatsApp</span>
            <span class="meta-val font-mono">{{ order?.customer?.phone || '-' }}</span>
          </div>
        </div>

        <div class="receipt-divider-dashed"></div>

        <!-- Ordered Items -->
        <div class="receipt-items-section">
          <h4 class="receipt-section-heading">Rincian Hidangan</h4>

          <div v-if="order?.items && order.items.length > 0" class="receipt-items-list">
            <div v-for="item in order.items" :key="item.id || item.name" class="receipt-line">
              <div class="line-primary">
                <span class="qty-badge font-mono">{{ item.quantity }}x</span>
                <span class="name">{{ item.name }}</span>
              </div>
              <span class="price font-mono">{{ formatRupiah(item.price * item.quantity) }}</span>
              <div v-if="item.notes" class="line-note">
                Catatan: {{ item.notes }}
              </div>
            </div>
          </div>

          <div v-else class="receipt-fallback-note">
            <span>Rincian hidangan tersimpan dalam sistem kasir.</span>
          </div>
        </div>

        <div class="receipt-divider-dashed"></div>

        <!-- Financial Summary -->
        <div class="receipt-financial-rows">
          <div class="fin-row">
            <span>Subtotal</span>
            <span class="font-mono">{{ formatRupiah(order?.breakdown?.subtotal || order?.breakdown?.total || 1) }}</span>
          </div>
          <div class="fin-row">
            <span>Biaya Layanan & Pajak</span>
            <span class="font-mono">Rp 0 (Bebas Biaya)</span>
          </div>
          <div class="receipt-divider-solid"></div>
          <div class="fin-total-row">
            <span class="total-title">Total Pembayaran</span>
            <span class="total-value font-mono">{{ formatRupiah(order?.breakdown?.total || 1) }}</span>
          </div>
          <div v-if="order?.payment?.cashReceived" class="fin-row">
            <span>Uang Tunai Diterima</span>
            <span class="font-mono">{{ formatRupiah(order.payment.cashReceived) }}</span>
          </div>
          <div v-if="order?.payment?.cashReceived" class="fin-row">
            <span>Kembalian</span>
            <span class="font-mono text-sage font-bold">{{ formatRupiah(order.payment.cashChange || 0) }}</span>
          </div>
        </div>

        <div class="receipt-footer-notes">
          <p class="eco-thankyou">
            Terima kasih telah memesan di {{ store.brandName || 'SIKopi' }}!
          </p>
          <p class="clean-slogan">Simpan kode {{ orderId }} untuk cek status pesanan kapan saja.</p>
        </div>
      </div>

      <!-- Action Button: Return to Menu -->
      <div class="confirmation-actions">
        <button type="button" class="btn-new-order" @click="startNewOrder">
          <AppIcon name="bag" :size="18" />
          <span>Kembali ke Pilihan Menu</span>
          <AppIcon name="arrow-right" :size="16" />
        </button>
      </div>
      </template>
    </div>

    <!-- Modal Notifikasi Interaktif: Pesanan Siap Diambil -->
    <Transition name="fade">
      <div v-if="showReadyModal" class="ready-modal-backdrop" @click.self="showReadyModal = false">
        <div class="ready-modal-card">
          <div class="ready-icon-anim">
            <AppIcon name="sparkles" :size="38" />
          </div>
          <h2 class="ready-title">Pesanan Anda Siap Diambil! ☕</h2>
          <p class="ready-desc">
            Halo <strong>{{ order?.customer?.name || 'Pelanggan' }}</strong>, hidangan pesanan Anda (No. <strong>{{ orderId }}</strong>) telah selesai disiapkan oleh barista.
          </p>
          <div class="ready-badge-box">
            <span>Silakan menuju <strong>Meja Barista / Pick-Up Counter</strong> untuk mengambil pesanan Anda.</span>
          </div>
          <button type="button" class="btn-ready-ack" @click="showReadyModal = false">
            <span>Saya Menuju Meja Barista</span>
          </button>
          <button type="button" class="btn-ready-wa" @click="sendStatusUpdate">
            <AppIcon name="phone" :size="15" />
            <span>Kirim Kabar "Siap Diambil" ke WhatsApp Saya</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ============ Lookup kode transaksi ============ */
.lookup-card {
  max-width: 480px;
  margin: 3rem auto;
  padding: 2.25rem 2rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow-subtle);
}

.lookup-icon-wrap {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lookup-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.lookup-subtitle {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.lookup-form {
  display: flex;
  gap: 0.5rem;
}

.lookup-input {
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  outline: none;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lookup-input:focus {
  border-color: var(--color-primary);
  background-color: #FFFFFF;
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.btn-lookup {
  height: 46px;
  padding: 0 20px;
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-lookup:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lookup-error {
  display: block;
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #C53030;
}

.btn-back-menu {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.btn-back-menu:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

/* ============ Batch & bukti bayar ============ */
.batch-summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
  padding: 1.1rem 1.4rem;
  background-color: var(--color-primary-soft);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.batch-summary-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.batch-summary-row svg {
  color: var(--color-primary);
}

.batch-summary-row span {
  min-width: 110px;
}

.batch-summary-row strong {
  color: var(--color-primary);
}

.proof-card {
  margin-bottom: 1.5rem;
  padding: 1.25rem 1.4rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.proof-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.proof-verified-badge,
.proof-pending-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 10px;
  border-radius: var(--radius-full);
}

.proof-verified-badge {
  background-color: #E6F4EA;
  color: #137333;
}

.proof-pending-badge {
  background-color: #FEF7E0;
  color: #B06000;
}

.proof-thumb {
  display: block;
  max-width: 100%;
  max-height: 320px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  object-fit: contain;
  background-color: var(--bg-primary);
}

.btn-ready-wa {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 0.75rem;
  padding: 11px 16px;
  background-color: #25D366;
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-full);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-ready-wa:hover {
  background-color: #1eb355;
}
.confirmation-view {
  padding: 2.5rem 0 5rem;
}

.confirmation-container {
  max-width: 640px;
}

/* Stepper */
.checkout-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2.5rem;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-subtle);
  font-size: 0.85rem;
  font-weight: 500;
}

.step-indicator.completed {
  color: var(--color-primary);
}

.step-circle {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  border: 1px solid var(--border-medium);
}

.step-indicator.completed .step-circle {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.step-indicator.active {
  color: var(--color-primary);
  font-weight: 600;
}

.step-indicator.active .step-circle {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.step-connector {
  flex: 1;
  height: 1px;
  background-color: var(--border-light);
  margin: 0 12px;
}

/* Success Card */
.success-hero-card {
  text-align: center;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-card);
}

.success-icon-wrap {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.success-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.4rem;
}

.success-subtitle {
  font-size: 0.92rem;
  color: var(--color-text-muted);
  line-height: 1.55;
  margin-bottom: 1.5rem;
}

.order-number-banner {
  background-color: var(--bg-primary);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.order-number-kicker {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  margin-bottom: 4px;
}

.number-action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 6px;
}

.order-number-val {
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--color-charcoal);
  letter-spacing: 0.04em;
}

.btn-copy-id {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy-id:hover {
  background-color: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.order-number-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* Guidance Card */
.cashier-guidance-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background-color: var(--color-peach-soft);
  border: 1px solid #F5D3C4;
  border-left: 4px solid var(--color-peach);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.4rem;
  margin-bottom: 1.5rem;
}

.guidance-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background-color: #FFFFFF;
  color: var(--color-peach);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guidance-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #8C4028;
  margin-bottom: 0.25rem;
}

.guidance-text {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-main);
}

/* Status Tracker */
.status-tracker-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.tracker-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.tracker-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0;
}

.current-prep-badge {
  font-size: 0.76rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background-color: var(--bg-subtle);
  color: var(--color-text-muted);
}

.current-prep-badge.ready {
  background-color: #DCFCE7;
  color: #15803D;
  animation: pulseBadge 1.8s infinite;
}

.current-prep-badge.completed {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
}

@keyframes pulseBadge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.tracker-timeline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  width: 100%;
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.step-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  border: 2px solid var(--border-medium);
  background-color: var(--bg-surface);
  flex-shrink: 0;
}

.timeline-step.completed .step-dot {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.timeline-step.in-progress .step-dot {
  background-color: var(--color-peach);
  color: #FFFFFF;
  border-color: var(--color-peach);
}

.timeline-step.ready .step-dot {
  background-color: #16A34A;
  color: #FFFFFF;
  border-color: #16A34A;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.2);
}

.timeline-step.pending .step-dot {
  background-color: var(--bg-subtle);
  border-color: var(--border-medium);
}

.timeline-bar {
  flex: 1;
  height: 2px;
  background-color: var(--border-light);
  margin-top: 13px;
  margin-left: 6px;
  margin-right: 6px;
  transition: all 0.3s ease;
}

.timeline-bar.active {
  background-color: var(--color-primary);
}

.step-label {
  display: block;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-text-main);
  line-height: 1.25;
  white-space: normal;
}

.step-sub {
  display: block;
  font-size: 0.74rem;
  color: var(--color-text-subtle);
  line-height: 1.25;
  white-space: normal;
}

/* Modal Pop-up Siap Diambil */
.ready-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background-color: rgba(23, 33, 24, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.ready-modal-card {
  background-color: #FFFFFF;
  border-radius: var(--radius-lg);
  padding: 2.25rem 2rem;
  max-width: 440px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s ease;
}

.ready-icon-anim {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: #DCFCE7;
  color: #15803D;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.25rem;
  animation: pulseBadge 1.5s infinite;
}

.ready-title {
  font-size: 1.45rem;
  font-weight: 700;
  color: #15803D;
  margin-bottom: 0.5rem;
}

.ready-desc {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 1.25rem;
}

.ready-badge-box {
  background-color: #F0FDF4;
  border: 1px dashed #86EFAC;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: #166534;
  font-size: 0.84rem;
  margin-bottom: 1.5rem;
}

.btn-ready-ack {
  width: 100%;
  height: 46px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ready-ack:hover {
  background-color: var(--color-primary-hover);
}

/* Struk Digital Card */
.receipt-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-subtle);
}

.receipt-type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 1rem;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
}

.receipt-header {
  text-align: center;
  margin-bottom: 1rem;
}

.receipt-brand-name {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-primary);
}

.receipt-type-tag {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  margin-top: 2px;
}

.receipt-divider-dashed {
  border-top: 1px dashed var(--border-medium);
  margin: 1.25rem 0;
}

.receipt-divider-solid {
  border-top: 1px solid var(--border-medium);
  margin: 0.75rem 0;
}

.receipt-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem 1.25rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.meta-val {
  font-size: 0.88rem;
  color: var(--color-text-main);
}

.payment-status-badge {
  font-size: 0.8rem;
  font-weight: 600;
  color: #B45309;
}

.payment-status-badge.paid {
  color: var(--color-primary);
}

.receipt-section-heading {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0.85rem;
}

.receipt-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.receipt-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  font-size: 0.88rem;
}

.line-primary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-badge {
  font-weight: 700;
  color: var(--color-primary);
}

.line-note {
  width: 100%;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  padding-left: 24px;
  font-style: italic;
  margin-top: 2px;
}

.receipt-financial-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.fin-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.total-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primary);
}

.total-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-primary);
}

.receipt-footer-notes {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-light);
}

.eco-thankyou {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary);
}

.clean-slogan {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin-top: 2px;
}

.confirmation-actions {
  display: flex;
  justify-content: center;
}

.btn-new-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.92rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-new-order:hover {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .confirmation-view {
    padding: 1.5rem 0 3rem;
  }
  .digital-receipt-card {
    padding: 1.25rem 1rem;
    border-radius: var(--radius-md);
  }
  .receipt-header-hero {
    padding-bottom: 1.25rem;
  }
  .receipt-title {
    font-size: 1.25rem;
  }
  .token-highlight-box {
    padding: 10px 14px;
  }
  .token-val {
    font-size: 1.8rem;
  }
  .cashier-guidance-card {
    flex-direction: column;
    padding: 1rem;
    gap: 10px;
  }
  .guidance-icon-box {
    width: 36px;
    height: 36px;
  }
  .status-tracker-card {
    padding: 1.25rem 0.75rem;
  }
  .step-label {
    font-size: 0.74rem;
  }
  .step-sub {
    font-size: 0.66rem;
  }
}
</style>
