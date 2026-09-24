<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import AppIcon from '@/components/icons/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const store = useOrderStore()

const copied = ref(false)
const orderId = computed(() => route.params.id)

const order = computed(() => {
  return store.getOrderById(orderId.value)
})

onMounted(async () => {
  if (!order.value) {
    // Ambil satu pesanan milik sendiri (endpoint publik); jangan tarik seluruh daftar.
    const res = await api.orders.getById(orderId.value)
    if (res.ok && res.data) {
      store.handleIncomingOrder(res.data)
    } else {
      await store.refreshOrdersFromDB()
    }
  }
})

function formatRupiah(value) {
  if (!value) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

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

function startNewOrder() {
  store.clearCustomerSession()
  router.push('/menu')
}
</script>

<template>
  <div class="confirmation-view">
    <div class="container confirmation-container">
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

        <h1 class="success-title">Pesanan Berhasil Dibuat!</h1>
        <p class="success-subtitle">
          Proses pemesanan Anda telah selesai dan langsung diteruskan ke tim kasir & barista SIKopi.
        </p>

        <!-- High Visibility Order Number Box -->
        <div class="order-number-banner">
          <span class="order-number-kicker">Nomor Resmi Pesanan Anda</span>
          <div class="number-action-row">
            <span class="order-number-val font-mono">{{ orderId }}</span>
            <button 
              type="button"
              class="btn-copy-id" 
              @click="copyOrderNumber"
              :title="copied ? 'Tersalin' : 'Salin Nomor Pesanan'"
            >
              <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />
              <span>{{ copied ? 'Tersalin' : 'Salin' }}</span>
            </button>
          </div>
          <p class="order-number-hint">
            Tunjukkan nomor pesanan ini kepada kasir saat melakukan pembayaran dan pengambilan menu.
          </p>
        </div>
      </div>

      <!-- Guidance Alert Box to Cashier -->
      <div class="cashier-guidance-card">
        <div class="guidance-icon-box">
          <AppIcon name="receipt" :size="24" />
        </div>
        <div class="guidance-body">
          <h3 class="guidance-title">Langkah Selanjutnya di Meja Kasir</h3>
          <p class="guidance-text">
            Silakan menuju <strong>Meja Kasir SIKopi</strong>. 
            <template v-if="order?.payment?.method === 'qris'">
              Kasir akan menampilkan <strong>QRIS</strong> pada layar admin kasir untuk Anda scan langsung menggunakan m-Banking atau E-Wallet.
            </template>
            <template v-else>
              Sebutkan nomor pesanan atau nama Anda untuk melakukan pembayaran tunai.
            </template>
            Struk cetak resmi akan disiapkan dan diserahkan oleh staf kasir kami.
          </p>
        </div>
      </div>

      <!-- Status Progress Tracker -->
      <div class="status-tracker-card">
        <h3 class="tracker-title">Status Penyiapan Hidangan</h3>
        
        <div class="tracker-timeline">
          <div class="timeline-step completed">
            <div class="step-dot">
              <AppIcon name="check" :size="14" />
            </div>
            <div class="step-info">
              <span class="step-label">Pesanan Dibuat</span>
              <span class="step-sub">Tercatat di sistem</span>
            </div>
          </div>

          <div class="timeline-bar active"></div>

          <div class="timeline-step in-progress">
            <div class="step-dot">
              <AppIcon name="clock" :size="14" />
            </div>
            <div class="step-info">
              <span class="step-label">Dapur & Kasir</span>
              <span class="step-sub">Menunggu verifikasi kasir</span>
            </div>
          </div>

          <div class="timeline-bar"></div>

          <div class="timeline-step pending">
            <div class="step-dot">
              <span class="dot-inner"></span>
            </div>
            <div class="step-info">
              <span class="step-label">Siap Disajikan</span>
              <span class="step-sub">Ambil di meja barista</span>
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
            <span class="meta-label">Waktu Pemesanan</span>
            <span class="meta-val">{{ formatDate(order?.createdAt) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Metode Pembayaran</span>
            <span class="meta-val font-bold">
              {{ order?.payment?.label || (order?.payment?.method === 'qris' ? 'QRIS' : 'Bayar di Kasir') }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status Pembayaran</span>
            <span class="meta-val payment-status-badge">
              {{ order?.payment?.status || 'Menunggu Pembayaran di Kasir' }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Jenis Layanan</span>
            <span class="meta-val">{{ order?.customer?.orderType || 'Makan di Tempat' }}</span>
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
        </div>

        <div class="receipt-footer-notes">
          <p class="eco-thankyou">
            Terima kasih telah memesan di SIKopi!
          </p>
          <p class="clean-slogan">Instagram: @sikopi.jkt · Sehat Alami Tanpa Pemanis Buatan</p>
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
    </div>
  </div>
</template>

<style scoped>
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

.tracker-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 1.25rem;
}

.tracker-timeline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  flex: 1;
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

.timeline-step.pending .step-dot {
  background-color: var(--bg-subtle);
  border-color: var(--border-medium);
}

.timeline-bar {
  flex: 1;
  height: 2px;
  background-color: var(--border-light);
  margin: 0 4px 20px;
}

.timeline-bar.active {
  background-color: var(--color-primary);
}

.step-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.step-sub {
  font-size: 0.74rem;
  color: var(--color-text-subtle);
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
    font-size: 0.68rem;
  }
}
</style>
