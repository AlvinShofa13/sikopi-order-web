<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { formatRupiah } from '@/utils/format'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

// If cart is empty, redirect back to menu
if (store.cart.length === 0) {
  router.replace('/menu')
}

// Form state
const customer = ref({
  name: 'Pelanggan',
  phone: '-',
  orderType: 'Makan di Tempat',
  tableOrAddress: '-',
  specialRequest: ''
})

const selectedMethod = ref('qris') // 'qris' | 'cash'
const isSubmitting = ref(false)
const errors = ref({})

function validateForm() {
  errors.value = {}
  return true
}

async function handleProcessOrder() {
  if (!validateForm()) {
    window.scrollTo({ top: 150, behavior: 'smooth' })
    return
  }

  isSubmitting.value = true

  let paymentLabel = 'QRIS'
  let reference = `QRIS-${Math.floor(100000 + Math.random() * 900000)}`

  if (selectedMethod.value === 'cash') {
    paymentLabel = 'Bayar di Kasir (Tunai / EDC)'
    reference = `CSH-${Math.floor(100000 + Math.random() * 900000)}`
  }

  const orderNumber = await store.placeOrder({
    ...customer.value,
    name: store.customerSession.name || customer.value.name || 'Pelanggan'
  }, {
    method: selectedMethod.value,
    label: paymentLabel,
    reference
  })

  isSubmitting.value = false

  // Navigate to confirmation page to receive order number
  router.push(`/konfirmasi/${orderNumber}`)
}

function backToCart() {
  router.push('/pesanan')
}
</script>

<template>
  <div class="checkout-view">
    <div class="container">
      <!-- Minimal Stepper (NO badges) -->
      <div class="checkout-stepper">
        <div class="step-indicator completed" @click="backToCart">
          <span class="step-circle">
            <AppIcon name="check" :size="13" />
          </span>
          <span class="step-name">Daftar Pesanan</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator active">
          <span class="step-circle">2</span>
          <span class="step-name">Pembayaran</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator">
          <span class="step-circle">3</span>
          <span class="step-name">Nomor Pesanan</span>
        </div>
      </div>

      <!-- Checkout Header -->
      <div class="checkout-header">
        <h1 class="page-title">Pembayaran Pesanan</h1>
        <p class="page-subtitle">
          Pilih saluran pembayaran yang aman dan nyaman untuk menyelesaikan pesanan Anda di SIKopi.
        </p>
        <div v-if="store.customerSession.name" class="customer-session-pill">
          <AppIcon name="user" :size="15" />
          <span>Atas Nama: <strong>{{ store.customerSession.name }}</strong> (Token: <strong>{{ store.customerSession.token }}</strong>)</span>
        </div>
      </div>

      <div class="checkout-layout-grid">
        <!-- Form Section -->
        <div class="checkout-form-section">
          <!-- Step 1: Payment Method Selection -->
          <div class="form-block">
            <div class="block-header">
              <span class="block-number">1</span>
              <h2 class="block-title">Pilih Metode Pembayaran</h2>
            </div>

            <div class="block-content">
              <div class="payment-methods-grid">
                <!-- QRIS -->
                <label 
                  class="payment-option-card"
                  :class="{ selected: selectedMethod === 'qris' }"
                >
                  <input 
                    type="radio" 
                    name="payment" 
                    value="qris" 
                    v-model="selectedMethod" 
                    class="sr-only"
                  />
                  <div class="option-header">
                    <div class="option-icon-box">
                      <AppIcon name="qr-code" :size="20" />
                    </div>
                    <div class="option-text">
                      <span class="option-name">QRIS</span>
                      <span class="option-desc">Scan QRIS di meja kasir outlet saat konfirmasi pesanan</span>
                    </div>
                  </div>
                  <div class="option-radio-dot"></div>
                </label>

                <!-- Pay at Cashier -->
                <label 
                  class="payment-option-card"
                  :class="{ selected: selectedMethod === 'cash' }"
                >
                  <input 
                    type="radio" 
                    name="payment" 
                    value="cash" 
                    v-model="selectedMethod" 
                    class="sr-only"
                  />
                  <div class="option-header">
                    <div class="option-icon-box">
                      <AppIcon name="cash" :size="20" />
                    </div>
                    <div class="option-text">
                      <span class="option-name">Bayar di Kasir (Tunai / EDC)</span>
                      <span class="option-desc">Pembayaran tunai atau kartu debit langsung di kasir outlet</span>
                    </div>
                  </div>
                  <div class="option-radio-dot"></div>
                </label>
              </div>

              <!-- Payment Details Sub-panel -->
              <div v-if="selectedMethod === 'qris'" class="method-info-banner qris-info">
                <div class="info-banner-icon">
                  <AppIcon name="qr-code" :size="20" />
                </div>
                <div class="info-banner-content">
                  <h4 class="info-banner-title">Pembayaran QRIS di Meja Kasir</h4>
                  <p class="info-banner-desc">
                    Setelah pesanan dibuat, silakan menuju meja kasir. Kasir akan menampilkan QRIS sesuai total belanja Anda (<strong>{{ formatRupiah(store.grandTotal) }}</strong>) untuk Anda scan menggunakan aplikasi m-Banking atau E-Wallet.
                  </p>
                </div>
              </div>

              <div v-else-if="selectedMethod === 'cash'" class="method-info-banner cash-info">
                <div class="info-banner-icon">
                  <AppIcon name="cash" :size="20" />
                </div>
                <div class="info-banner-content">
                  <h4 class="info-banner-title">Pembayaran Tunai di Kasir Outlet</h4>
                  <p class="info-banner-desc">
                    Nomor pesanan Anda akan langsung diteruskan ke tim kasir dan dapur kami. Silakan sebutkan nomor pesanan atau nama Anda di kasir untuk membayar tunai sebesar <strong>{{ formatRupiah(store.grandTotal) }}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Order Notes for Kitchen (Optional) -->
          <div class="form-block">
            <div class="block-header">
              <span class="block-number">2</span>
              <h2 class="block-title">Catatan Tambahan untuk Dapur (Opsional)</h2>
            </div>

            <div class="block-content">
              <div class="input-field full-width">
                <label class="field-label" for="cust-notes">
                  Catatan untuk Barista / Tim Dapur SIKopi
                </label>
                <div class="input-with-icon">
                  <AppIcon name="receipt" :size="16" class="field-icon" />
                  <input
                    id="cust-notes"
                    v-model="customer.specialRequest"
                    type="text"
                    placeholder="Contoh: Kurangi es batu, tanpa gula tambahan, pisahkan saus"
                    class="text-input"
                  />
                </div>
                <span class="field-hint">Catatan ini akan otomatis tercantum pada Struk Dapur untuk barista.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Summary Sidebar -->
        <div class="checkout-summary-section">
          <div class="summary-card">
            <h2 class="summary-title">Ringkasan Pesanan</h2>

            <!-- Compact item list -->
            <div class="summary-items-list">
              <div v-for="item in store.cart" :key="item.id" class="summary-line-item">
                <div class="line-item-left">
                  <span class="line-item-qty">{{ item.quantity }}x</span>
                  <div class="line-item-text">
                    <span class="line-item-name">{{ item.name }}</span>
                    <span v-if="item.notes" class="line-item-note">"{{ item.notes }}"</span>
                  </div>
                </div>
                <span class="line-item-price">
                  {{ formatRupiah(item.price * item.quantity) }}
                </span>
              </div>
            </div>

            <div class="summary-divider"></div>

            <!-- Price Breakdown -->
            <div class="summary-breakdown">
              <div class="breakdown-row">
                <span class="lbl">Subtotal</span>
                <span class="val">{{ formatRupiah(store.subtotal) }}</span>
              </div>
              <div class="breakdown-row">
                <span class="lbl">Kemasan Ramah Lingkungan</span>
                <span class="val">{{ formatRupiah(store.ecoPackagingFee) }}</span>
              </div>
              <div class="breakdown-row">
                <span class="lbl">Pajak Restoran (PB1 10%)</span>
                <span class="val">{{ formatRupiah(store.tax) }}</span>
              </div>
              <div class="summary-divider"></div>
              <div class="breakdown-total-row">
                <span class="total-lbl">Total Pembayaran</span>
                <span class="total-val">{{ formatRupiah(store.grandTotal) }}</span>
              </div>
            </div>

            <!-- Submit Button -->
            <button 
              type="button" 
              class="btn-submit-order"
              :disabled="isSubmitting"
              @click="handleProcessOrder"
            >
              <template v-if="isSubmitting">
                <span>Memproses Pesanan...</span>
              </template>
              <template v-else>
                <span>Konfirmasi & Dapatkan Nomor Pesanan</span>
                <AppIcon name="arrow-right" :size="18" />
              </template>
            </button>

            <button type="button" class="btn-back-cart" @click="backToCart">
              Kembali ke Daftar Pesanan
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-view {
  padding: 2.5rem 0 5rem;
}

/* Minimal Stepper */
.checkout-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 500px;
  margin: 0 auto 2.5rem;
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
  cursor: pointer;
}

.step-circle {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  background-color: var(--bg-surface);
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

/* Header */
.checkout-header {
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.35rem;
}

.page-subtitle {
  font-size: 0.92rem;
  color: var(--color-text-muted);
}

.customer-session-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 0.75rem;
  padding: 6px 14px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
}

/* Layout */
.checkout-layout-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 2.5rem;
  align-items: flex-start;
}

.checkout-form-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-block {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.block-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-primary);
}

.block-number {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 700;
}

.block-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-primary);
}

.block-content {
  padding: 1.75rem 1.5rem;
}

/* Order Type Toggle */
.order-type-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 4px;
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
  margin-bottom: 1.75rem;
  border: 1px solid var(--border-light);
}

.type-tab-btn {
  padding: 10px 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  text-align: center;
}

.type-tab-btn:hover {
  color: var(--color-primary);
}

.type-tab-btn.active {
  background-color: var(--bg-surface);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Inputs */
.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.full-width {
  grid-column: span 2;
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.required {
  color: #A34848;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-subtle);
  pointer-events: none;
}

.text-input {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 38px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  outline: none;
  font-size: 0.88rem;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.text-input:focus {
  border-color: var(--color-primary);
  background-color: #FFFFFF;
}

.text-input.error {
  border-color: #B25353;
  background-color: #FDF6F6;
}

.error-msg {
  font-size: 0.78rem;
  color: #A34848;
}

.field-hint {
  font-size: 0.78rem;
  color: var(--color-text-subtle);
  margin-top: 4px;
}

/* Payment Methods */
.payment-methods-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.payment-option-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  background-color: var(--bg-surface);
  transition: all 0.2s ease;
}

.payment-option-card:hover {
  border-color: var(--border-medium);
}

.payment-option-card.selected {
  border-color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

.option-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.option-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.payment-option-card.selected .option-icon-box {
  background-color: #FFFFFF;
}

.option-text {
  display: flex;
  flex-direction: column;
}

.option-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.option-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.option-radio-dot {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border-medium);
  position: relative;
}

.payment-option-card.selected .option-radio-dot {
  border-color: var(--color-primary);
}

.payment-option-card.selected .option-radio-dot::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
}

.method-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 1.25rem 1.4rem;
  border-radius: var(--radius-md);
  margin-top: 0.5rem;
  border: 1px solid var(--border-light);
  background-color: var(--bg-primary);
}

.method-info-banner.qris-info {
  border-left: 4px solid var(--color-primary);
  background-color: var(--color-primary-soft);
}

.method-info-banner.cash-info {
  border-left: 4px solid var(--color-peach);
  background-color: var(--color-peach-soft);
}

.info-banner-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-primary);
}

.cash-info .info-banner-icon {
  color: var(--color-peach);
}

.info-banner-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin-bottom: 0.25rem;
}

.info-banner-desc {
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* Subpanels */
.method-subpanel {
  padding: 1.25rem;
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.qris-subpanel {
  padding: 1.5rem 1rem;
}

.qris-card-wrapper {
  max-width: 440px;
  margin: 0 auto;
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 1.75rem 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qris-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 1rem;
}

.qris-brand-group {
  display: flex;
  flex-direction: column;
}

.qris-logo-main {
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.04em;
  color: #1A1A1A;
  line-height: 1;
}

.qris-logo-subtitle {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
  margin-top: 2px;
}

.gpn-brand-box {
  border: 1.5px solid #A83232;
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}

.gpn-text {
  font-size: 0.78rem;
  font-weight: 800;
  color: #A83232;
  letter-spacing: 0.06em;
}

.qris-merchant-block {
  text-align: center;
  margin-bottom: 1rem;
}

.qris-merchant-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #1A1A1A;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}

.qris-merchant-nmid {
  font-size: 0.82rem;
  font-family: monospace;
  font-weight: 600;
  color: var(--color-text-muted);
}

.qris-terminal-tag {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  margin-top: 2px;
}

.qris-image-container {
  padding: 10px;
  background-color: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
}

.qris-live-image {
  width: 240px;
  height: 240px;
  object-fit: contain;
  display: block;
}

.qris-amount-lock-box {
  width: 100%;
  text-align: center;
  padding: 12px 14px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 1.25rem;
}

.amount-lock-caption {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.amount-lock-val {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.02em;
}

.amount-lock-note {
  font-size: 0.74rem;
  color: var(--color-text-subtle);
  line-height: 1.4;
  margin-top: 4px;
}

.qris-aspi-footer {
  text-align: center;
  margin-bottom: 1.25rem;
  width: 100%;
}

.aspi-motto {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-text-main);
}

.aspi-web {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.qris-print-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.68rem;
  color: var(--color-text-subtle);
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-light);
}

.qris-steps-guide {
  width: 100%;
  border-top: 1px solid var(--border-light);
  padding-top: 1rem;
}

.guide-title {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 0.6rem;
  text-align: center;
}

.guide-steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.guide-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  line-height: 1.25;
}

.step-svg {
  color: var(--color-primary);
}

.subpanel-lead {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--color-text-main);
}

.bank-selector-pills {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.bank-pill {
  padding: 6px 16px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  background-color: #FFFFFF;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.bank-pill.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.account-card {
  padding: 1rem;
  background-color: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.acc-label {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
}

.acc-number {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}

.acc-name {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.ewallet-note,
.cash-note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Summary Sidebar */
.checkout-summary-section {
  position: sticky;
  top: 96px;
}

.summary-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.75rem;
  box-shadow: var(--shadow-subtle);
}

.summary-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 1.25rem;
}

.summary-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.summary-line-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 0.85rem;
}

.line-item-left {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.line-item-qty {
  font-weight: 600;
  color: var(--color-primary);
}

.line-item-text {
  display: flex;
  flex-direction: column;
}

.line-item-name {
  color: var(--color-text-main);
  font-weight: 500;
}

.line-item-note {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  font-style: italic;
}

.line-item-price {
  font-weight: 600;
  color: var(--color-text-main);
  white-space: nowrap;
}

.summary-divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 1.25rem 0;
}

.summary-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.breakdown-row .val {
  color: var(--color-text-main);
  font-weight: 500;
}

.breakdown-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-lbl {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.total-val {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.02em;
}

.btn-submit-order {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.92rem;
  font-weight: 600;
  margin-top: 1.75rem;
  transition: all 0.2s ease;
}

.btn-submit-order:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-submit-order:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-back-cart {
  width: 100%;
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 1rem;
  padding: 6px;
}

.btn-back-cart:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

@media (max-width: 900px) {
  .checkout-layout-grid {
    grid-template-columns: 1fr;
  }

  .input-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: span 1;
  }

  .qris-preview-box {
    flex-direction: column;
    text-align: center;
  }

  .order-type-tabs {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .checkout-panel {
    padding: 1.25rem 1rem;
  }
  .summary-card {
    padding: 1.25rem 1rem;
  }
  .btn-submit-order {
    padding: 12px 16px;
    font-size: 0.88rem;
  }
}
</style>
