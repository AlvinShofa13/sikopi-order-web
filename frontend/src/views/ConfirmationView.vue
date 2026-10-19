<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { isOrderPaid, paymentLabel } from '@/utils/salesAnalytics'
import { formatRupiah } from '@/utils/format'
import { orderStatusText, openWhatsApp } from '@/utils/wa'

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

function copyOrderCode() {
  if (!order.value?.orderId) return
  navigator.clipboard?.writeText(order.value.orderId)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function startNewOrder() {
  router.push('/menu')
}

// 4 Steps Logic
const steps = [
  { id: 1, label: 'Diterima & Disiapkan' },
  { id: 2, label: 'Sedang Disiapkan' },
  { id: 3, label: 'Siap Diambil' },
  { id: 4, label: 'Selesai' }
]

const currentStepIndex = computed(() => {
  const st = order.value?.orderStatus
  if (st === 'Selesai') return 3
  if (st === 'Siap Diambil' || st === 'Siap Disajikan') return 2
  if (st === 'Sedang Disiapkan') return 1
  return 0
})

const isReadyForPickup = computed(() => {
  const st = order.value?.orderStatus
  return st === 'Siap Diambil' || st === 'Siap Disajikan'
})

// Web Audio chime & Vibration
function triggerReadyAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15) // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {}

  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400])
  }
}

watch(() => order.value?.orderStatus, (newVal, oldVal) => {
  if (newVal === 'Siap Diambil' && oldVal !== 'Siap Diambil') {
    triggerReadyAlert()
  }
})

onMounted(() => {
  if (order.value?.orderStatus === 'Siap Diambil') {
    triggerReadyAlert()
  }
})
</script>

<template>
  <div class="confirmation-view-page">
    <div class="container confirmation-container">
      <!-- Stepper breadcrumb -->
      <div class="tuku-stepper font-mono">
        <span class="step-badge">01. PESANANMU</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge">02. PEMBAYARAN</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge is-current">03. STATUS PESANAN</span>
      </div>

      <!-- If Order Not Found on Device: Search Form -->
      <div v-if="!order" class="order-not-found-card">
        <h2 class="heading-display not-found-title">CARI KODE PESANAN</h2>
        <p class="not-found-desc font-mono">
          Pesanan tidak ditemukan di perangkat ini. Masukkan kode pesanan (contoh: SK-2K9QW4Z7) untuk melihat status.
        </p>

        <form @submit.prevent="lookupOrder" class="lookup-form">
          <input 
            v-model="lookupCode" 
            type="text" 
            placeholder="SK-XXXXXXXX" 
            class="tuku-input font-mono input-code"
          />
          <button type="submit" class="btn btn-primary" :disabled="isLookingUp">
            {{ isLookingUp ? 'MENCARI...' : 'LIHAT STATUS' }}
          </button>
        </form>

        <span v-if="lookupError" class="lookup-error-msg font-mono">{{ lookupError }}</span>

        <button type="button" class="btn btn-outline" @click="startNewOrder">
          KEMBALI KE MENU
        </button>
      </div>

      <!-- Order Details Found -->
      <div v-else class="order-found-content">
        <!-- Ready for Pickup Doodle Speech Bubble Pop-up -->
        <div v-if="isReadyForPickup" class="ready-speech-bubble">
          <div class="bubble-tail"></div>
          <div class="bubble-inner">
            <span class="bubble-kicker font-mono">PANGGILAN BARISTA</span>
            <h2 class="heading-display bubble-headline">PESANAN ANDA SIAP DIAMBIL DI MEJA BARISTA!</h2>
            <p class="bubble-sub font-mono">
              Silakan tunjukkan kode <strong class="badge-code">{{ order.orderId }}</strong> saat mengambil kopi Anda.
            </p>
          </div>
        </div>

        <!-- Main Confirmation Grid -->
        <div class="confirm-grid">
          <!-- Left Column: Status Timeline & Details -->
          <div class="confirm-main-col">
            <!-- Order Header Card with Code Name Tag -->
            <div class="confirm-header-card">
              <div class="code-nametag-wrap">
                <span class="code-nametag font-mono">KODE: {{ order.orderId }}</span>
                <button type="button" class="btn-copy-tag font-mono" @click="copyOrderCode">
                  {{ copied ? 'TERSALIN!' : 'SALIN KODE' }}
                </button>
              </div>

              <div class="status-badge-row">
                <!-- Payment Status Tag -->
                <span 
                  class="payment-status-badge font-mono" 
                  :class="{ 
                    'is-paid': orderPaid, 
                    'is-waiting': !orderPaid 
                  }"
                >
                  {{ orderPaid ? 'LUNAS' : 'MENUNGGU VERIFIKASI' }}
                </span>

                <span class="channel-badge font-mono">
                  {{ isPreorder ? 'OPEN PRE-ORDER' : 'HARI JUALAN (ON-SITE)' }}
                </span>
              </div>
            </div>

            <!-- 4-Steps Horizontal Stepper -->
            <div class="timeline-stepper-card">
              <h3 class="heading-display stepper-title">TIMELINE PENYIAPAN</h3>
              <div class="divider-line"></div>

              <div class="steps-horizontal">
                <div 
                  v-for="(st, idx) in steps" 
                  :key="st.id"
                  class="step-item"
                  :class="{ 
                    'is-done': currentStepIndex > idx,
                    'is-current': currentStepIndex === idx,
                    'is-future': currentStepIndex < idx
                  }"
                >
                  <div class="step-node">
                    <span class="node-num font-mono">{{ idx + 1 }}</span>
                  </div>
                  <span class="step-node-label font-mono">{{ st.label }}</span>
                </div>
              </div>
            </div>

            <!-- Customer & Pre-order Batch Details Card -->
            <div class="details-card">
              <h3 class="heading-display details-title">DATA PENGAMBILAN</h3>
              <div class="divider-line"></div>

              <div class="details-row font-mono">
                <span class="d-label">NAMA PEMESAN</span>
                <span class="d-val">{{ order.customer?.name || '-' }}</span>
              </div>
              <div class="details-row font-mono">
                <span class="d-label">NOMOR WHATSAPP</span>
                <span class="d-val">{{ order.customer?.phone || '-' }}</span>
              </div>

              <div v-if="order.specialRequest" class="details-row font-mono">
                <span class="d-label">CATATAN KHUSUS</span>
                <span class="d-val">{{ order.specialRequest }}</span>
              </div>

              <div v-if="proofUrl" class="proof-card-inner">
                <span class="d-label font-mono">BUKTI PEMBAYARAN</span>
                <div class="proof-img-box">
                  <img :src="proofUrl" alt="Bukti Transfer" class="proof-img" />
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Digital Receipt Breakdown -->
          <div class="confirm-receipt-col">
            <div class="receipt-card">
              <div class="receipt-header text-center">
                <span class="receipt-brand-name">SIKOPI SPECIALTY COFFEE</span>
                <span class="receipt-subtitle font-mono">STRUK DIGITAL ELEKTRONIK</span>
                <span class="receipt-time font-mono">{{ order.orderId }} &bull; {{ new Date().toLocaleDateString('id-ID') }}</span>
              </div>

              <div class="divider-dashed"></div>

              <!-- Item rows -->
              <div class="receipt-items-list font-mono">
                <div 
                  v-for="item in (order.items || [])" 
                  :key="item.id" 
                  class="receipt-item-row"
                >
                  <div class="receipt-item-main">
                    <span>{{ item.quantity }}x {{ item.name }}</span>
                    <span>{{ formatRupiah(item.price * item.quantity) }}</span>
                  </div>
                  <div v-if="item.notes" class="receipt-item-note">
                    * {{ item.notes }}
                  </div>
                </div>
              </div>

              <div class="divider-dashed"></div>

              <!-- Total rows -->
              <div class="receipt-totals font-mono">
                <div class="total-row">
                  <span>METODE BAYAR</span>
                  <span>{{ paymentLabel(order.payment?.method) }}</span>
                </div>
                <div class="total-row total-highlight">
                  <span>TOTAL PEMBAYARAN</span>
                  <span>{{ formatRupiah(order.payment?.amount || 0) }}</span>
                </div>
              </div>

              <div class="divider-dashed"></div>

              <div class="receipt-actions">
                <button type="button" class="btn btn-outline btn-full" @click="startNewOrder">
                  PESAN MENU LAIN &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirmation-view-page {
  background-color: var(--color-sand);
  min-height: calc(100vh - 54px);
  padding: 2.5rem 0 4rem;
}

.confirmation-container {
  max-width: 1080px;
}

/* Stepper breadcrumb */
.tuku-stepper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.step-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  background-color: var(--color-white);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
}

.step-badge.is-current {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

.step-arrow {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-primary);
}

/* Search lookup if order not found */
.order-not-found-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.not-found-title {
  font-size: 2.2rem;
  color: var(--color-primary);
}

.not-found-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  max-width: 480px;
}

.lookup-form {
  display: flex;
  gap: 10px;
  max-width: 420px;
  width: 100%;
}

.input-code {
  flex: 1;
  text-transform: uppercase;
}

.lookup-error-msg {
  font-size: 11px;
  color: var(--color-status-danger);
  font-weight: 700;
}

/* Speech bubble for "Siap Diambil" */
.ready-speech-bubble {
  position: relative;
  background-color: var(--color-white);
  border: 2.5px solid var(--color-primary);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
  animation: bounceBubble 0.3s ease-out;
}

.bubble-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--color-peach);
}

.bubble-headline {
  font-size: clamp(1.6rem, 3.2vw, 2.2rem);
  color: var(--color-primary);
  line-height: 1;
}

.bubble-sub {
  font-size: 12px;
  color: var(--color-text-main);
}

.badge-code {
  background-color: var(--color-peach);
  color: var(--color-primary);
  padding: 2px 6px;
}

/* Confirmation Grid */
.confirm-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
  align-items: start;
}

.confirm-main-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header Card */
.confirm-header-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.code-nametag-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.code-nametag {
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  background-color: var(--color-sand);
  border: 2px solid var(--color-primary);
  padding: 6px 14px;
  color: var(--color-primary);
}

.btn-copy-tag {
  font-size: 11px;
  font-weight: 800;
  padding: 6px 12px;
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: 2px solid var(--color-primary);
  cursor: pointer;
}

.btn-copy-tag:hover {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

.status-badge-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.payment-status-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  border: 1.5px solid var(--color-primary);
}

.payment-status-badge.is-paid {
  background-color: var(--color-status-success-bg);
  color: var(--color-status-success);
}

.payment-status-badge.is-waiting {
  background-color: var(--color-status-pending-bg);
  color: var(--color-status-pending);
}

.channel-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  background-color: var(--color-sand);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
}

/* Timeline card */
.timeline-stepper-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.5rem;
}

.stepper-title {
  font-size: 1.45rem;
  color: var(--color-primary);
}

.divider-line {
  border-bottom: 2px solid var(--color-primary);
  margin: 1rem 0 1.25rem;
}

.steps-horizontal {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.step-node {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-primary);
  background-color: var(--color-white);
  color: var(--color-primary);
}

.step-item.is-current .step-node {
  background-color: var(--color-peach);
  color: var(--color-primary);
  font-weight: 800;
}

.step-item.is-done .step-node {
  background-color: var(--color-primary);
  color: var(--color-cream);
}

.step-item.is-future .step-node {
  opacity: 0.45;
}

.step-node-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-primary);
  line-height: 1.3;
}

/* Details Card */
.details-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.5rem;
}

.details-title {
  font-size: 1.45rem;
  color: var(--color-primary);
}

.details-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 11px;
}

.d-label {
  font-weight: 700;
  color: var(--color-text-muted);
}

.d-val {
  font-weight: 800;
  color: var(--color-primary);
}

.proof-card-inner {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.proof-img-box {
  width: 120px;
  height: 120px;
  border: 2px solid var(--color-primary);
  overflow: hidden;
}

.proof-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Receipt Card */
.receipt-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.receipt-brand-name {
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  display: block;
}

.receipt-subtitle {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  display: block;
}

.receipt-time {
  font-size: 10px;
  color: var(--color-text-muted);
}

.divider-dashed {
  border-bottom: 1px dashed var(--color-primary);
  margin: 6px 0;
}

.receipt-items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.receipt-item-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}

.receipt-item-main {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
}

.receipt-item-note {
  font-size: 10px;
  color: var(--color-text-muted);
}

.receipt-totals {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.total-row {
  display: flex;
  justify-content: space-between;
}

.total-highlight {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-primary);
  margin-top: 4px;
}

.btn-full {
  width: 100%;
}

@media (max-width: 860px) {
  .confirm-grid {
    grid-template-columns: 1fr;
  }
  .steps-horizontal {
    grid-template-columns: 1fr;
    gap: 12px;
    align-items: flex-start;
  }
  .step-item {
    flex-direction: row;
    text-align: left;
  }
}
</style>
