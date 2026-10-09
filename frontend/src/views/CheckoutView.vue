<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { formatRupiah, createToast } from '@/utils/format'
import { generateQrisDataUrl } from '@/utils/qris'
import { isValidWaPhone } from '@/utils/wa'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

// If cart is empty, redirect back to menu
if (store.cart.length === 0) {
  router.replace('/menu')
}

const customer = ref({
  name: store.customer.name || '',
  phone: store.customer.phone || '',
  specialRequest: ''
})

const { toastMessage, toastType, showToast } = createToast(3200)

// Mode mengikuti pengaturan kasir (saling eksklusif) — customer tidak memilih.
const isPreorder = computed(() => store.activeMode === 'preorder')
const paymentMethod = ref(isPreorder.value ? 'transfer' : 'cash')

const errors = ref({})
const isSubmitting = ref(false)
const proofFile = ref(null)
const proofPreview = ref('')
const proofUploading = ref(false)
const proofError = ref('')

const orderCode = computed(() => store.ensureOrderCode())
const qrisImage = computed(() => generateQrisDataUrl(store.grandTotal))
const needsProof = computed(() => paymentMethod.value === 'transfer')

function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function validateForm() {
  const e = {}
  if (!customer.value.name.trim()) {
    e.name = 'Nama pemesan wajib diisi agar kasir mudah mengenali pesanan Anda.'
  }
  if (!isValidWaPhone(customer.value.phone)) {
    e.phone = 'Nomor WhatsApp wajib diisi, minimal 9 digit. Contoh: 0812-3456-7890.'
  }
  if (needsProof.value && !proofFile.value) {
    e.proof = 'Pesanan diproses setelah bukti pembayaran diunggah. Unggah foto bukti transfer Anda.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleProofSelected(event) {
  proofError.value = ''
  errors.value.proof = ''
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    proofError.value = 'Berkas bukan gambar. Pilih foto bukti pembayaran (JPG/PNG).'
    return
  }
  proofFile.value = file
  proofPreview.value = URL.createObjectURL(file)
  showToast('Bukti pembayaran dipilih. Foto dikompres otomatis saat dikirim.', 'success')
}

function clearProof() {
  if (proofPreview.value) URL.revokeObjectURL(proofPreview.value)
  proofFile.value = null
  proofPreview.value = ''
  proofError.value = ''
  errors.value.proof = ''
}

async function handleProcessOrder() {
  if (!validateForm()) {
    window.scrollTo({ top: 120, behavior: 'smooth' })
    return
  }

  isSubmitting.value = true
  errors.value = {}

  try {
    let proofUrl = null
    if (needsProof.value) {
      proofUploading.value = true
      // Foto dikompresi di browser (<=2MB) lalu diunggah bernama kode transaksi.
      proofUrl = await store.uploadPaymentProof(proofFile.value)
      proofUploading.value = false
    }

    const orderNumber = await store.placeOrder({ ...customer.value }, {
      method: paymentMethod.value,
      batchId: store.activeBatch?.id || null,
      paymentProof: proofUrl
    })

    clearProof()
    router.push(`/konfirmasi/${orderNumber}`)
  } catch (err) {
    isSubmitting.value = false
    proofUploading.value = false
    errors.value = { submit: err.message || 'Gagal membuat pesanan. Coba lagi.' }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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
          <span class="step-name">Status Pesanan</span>
        </div>
      </div>

      <!-- Checkout Header -->
      <div class="checkout-header">
        <h1 class="page-title">Pembayaran Pesanan</h1>
        <p class="page-subtitle">
          Tanpa akun dan tanpa password. Isi nama & nomor WhatsApp, lalu pesanan Anda dilacak lewat kode transaksi.
        </p>
        <div class="code-pill">
          <AppIcon name="receipt" :size="15" />
          <span>Kode pesanan Anda: <strong class="font-mono">{{ orderCode }}</strong></span>
        </div>
      </div>

      <div class="checkout-layout-grid">
        <!-- Form Section -->
        <div class="checkout-form-section">
          <!-- Block 1: Data Pemesan -->
          <div class="form-block">
            <div class="block-header">
              <span class="block-number">1</span>
              <h2 class="block-title">Data Pemesan</h2>
            </div>

            <div class="block-content">
              <div class="input-grid">
                <div class="input-field">
                  <label class="field-label" for="cust-name">
                    Nama <span class="required">*</span>
                  </label>
                  <div class="input-with-icon">
                    <AppIcon name="user" :size="16" class="field-icon" />
                    <input
                      id="cust-name"
                      v-model="customer.name"
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      class="text-input"
                      :class="{ error: errors.name }"
                      @input="errors.name = ''"
                    />
                  </div>
                  <span v-if="errors.name" class="error-msg">{{ errors.name }}</span>
                  <span v-else class="field-hint">Nama ini dipakai barista saat menyiapkan pesanan.</span>
                </div>

                <div class="input-field">
                  <label class="field-label" for="cust-phone">
                    Nomor WhatsApp <span class="required">*</span>
                  </label>
                  <div class="input-with-icon">
                    <AppIcon name="phone" :size="16" class="field-icon" />
                    <input
                      id="cust-phone"
                      v-model="customer.phone"
                      type="tel"
                      inputmode="numeric"
                      placeholder="0812-3456-7890"
                      class="text-input"
                      :class="{ error: errors.phone }"
                      @input="errors.phone = ''"
                    />
                  </div>
                  <span v-if="errors.phone" class="error-msg">{{ errors.phone }}</span>
                  <span v-else class="field-hint">
                    Nota digital & kabar status pesanan dikirim ke nomor ini.
                  </span>
                </div>
              </div>

              <!-- Mode pemesanan: info saja, mengikuti pengaturan kasir -->
          <div class="method-info-banner" :class="isPreorder ? 'qris-info' : 'cash-info'">
            <div class="info-banner-icon">
              <AppIcon :name="isPreorder ? 'clock' : 'coffee'" :size="20" />
            </div>
            <div class="info-banner-content">
              <h4 class="info-banner-title">
                {{ isPreorder ? 'Mode Open PO (Pre-Order)' : 'Mode On-site / Hari Jualan' }}
              </h4>
              <p class="info-banner-desc">
                <template v-if="isPreorder">
                  Pesan dari jauh, bayar dulu + unggah bukti, lalu ambil sesuai jadwal batch di bawah.
                </template>
                <template v-else>
                  Pesan sekarang. Bisa bayar langsung di kasir, atau transfer + unggah bukti seperti Open PO.
                </template>
              </p>
            </div>
          </div>

          <!-- Detail batch Open PO -->
          <div v-if="isPreorder && store.activeBatch" class="batch-info-box">
            <div class="batch-info-row">
              <AppIcon name="receipt" :size="15" />
              <span>Batch: <strong>{{ store.activeBatch.name }}</strong></span>
            </div>
            <div class="batch-info-row">
              <AppIcon name="clock" :size="15" />
              <span>Batas akhir pesan: <strong>{{ formatDateTime(store.activeBatch.orderDeadline) }}</strong></span>
            </div>
            <div class="batch-info-row">
              <AppIcon name="map-pin" :size="15" />
              <span>Siap diambil: <strong>{{ formatDateTime(store.activeBatch.pickupDate) }}</strong></span>
            </div>
          </div>

          <div v-if="isPreorder && !store.activeBatch" class="error-banner" role="alert">
            <AppIcon name="close" :size="16" />
            <span>Belum ada batch Open PO yang dibuka. Hubungi kasir untuk info jadwal pemesanan.</span>
          </div>
        </div>
      </div>

      <!-- Block 2: Pembayaran -->
          <div class="form-block">
            <div class="block-header">
              <span class="block-number">2</span>
              <h2 class="block-title">Pembayaran</h2>
            </div>

            <div class="block-content">
              <div v-if="!isPreorder" class="payment-methods-grid">
                <label class="payment-option-card" :class="{ selected: paymentMethod === 'cash' }">
                  <input type="radio" name="payment" value="cash" v-model="paymentMethod" class="sr-only" />
                  <div class="option-header">
                    <div class="option-icon-box"><AppIcon name="cash" :size="20" /></div>
                    <div class="option-text">
                      <span class="option-name">Bayar di Kasir</span>
                      <span class="option-desc">Tunai atau QRIS dinamis di meja kasir.</span>
                    </div>
                  </div>
                  <div class="option-radio-dot"></div>
                </label>

                <label class="payment-option-card" :class="{ selected: paymentMethod === 'transfer' }">
                  <input type="radio" name="payment" value="transfer" v-model="paymentMethod" class="sr-only" />
                  <div class="option-header">
                    <div class="option-icon-box"><AppIcon name="qr-code" :size="20" /></div>
                    <div class="option-text">
                      <span class="option-name">Transfer Sekarang</span>
                      <span class="option-desc">Bayar via QRIS, lalu upload bukti seperti Open PO.</span>
                    </div>
                  </div>
                  <div class="option-radio-dot"></div>
                </label>
              </div>

              <!-- QRIS dinamis + bukti pembayaran -->
              <template v-if="needsProof">
                <div class="method-info-banner qris-info">
                  <div class="info-banner-icon"><AppIcon name="qr-code" :size="20" /></div>
                  <div class="info-banner-content">
                    <h4 class="info-banner-title">
                      {{ isPreorder ? 'Open PO wajib bayar sebelum pesanan dicatat' : 'Transfer & Unggah Bukti' }}
                    </h4>
                    <p class="info-banner-desc">
                      Pesanan <strong>belum masuk daftar transaksi</strong> sampai bukti pembayaran Anda diunggah.
                      Total yang harus dibayar: <strong>{{ formatRupiah(store.grandTotal) }}</strong>.
                    </p>
                  </div>
                </div>

                <div class="qris-card-wrapper mt-block">
                  <div class="qris-header-row">
                    <div class="qris-brand-group">
                      <span class="qris-logo-main">QRIS</span>
                      <span class="qris-logo-subtitle">Quick Response Code Indonesian Standard</span>
                    </div>
                    <div class="gpn-brand-box"><span class="gpn-text">GPN</span></div>
                  </div>

                  <div class="qris-merchant-block">
                    <div class="qris-merchant-title">AZRIEL SABIQ GAMING GEAR</div>
                    <div class="qris-merchant-nmid">ID1026528966314</div>
                    <span class="qris-terminal-tag">QRIS Dinamis — nominal terkunci</span>
                  </div>

                  <div class="qris-image-container">
                    <img :src="qrisImage" alt="QRIS pembayaran dinamis" class="qris-live-image" />
                  </div>

                  <div class="qris-amount-lock-box">
                    <span class="amount-lock-caption">Total yang dibayar</span>
                    <span class="amount-lock-val">{{ formatRupiah(store.grandTotal) }}</span>
                    <span class="amount-lock-note">Nominal sudah terkunci otomatis, jadi tidak perlu mengetik jumlah transfer.</span>
                  </div>

                  <div class="qris-steps-guide">
                    <span class="guide-title">Cara membayar</span>
                    <div class="guide-steps-grid">
                      <div class="guide-step">
                        <AppIcon name="qr-code" :size="18" class="step-svg" />
                        <span>Buka app m-Banking / e-Wallet</span>
                      </div>
                      <div class="guide-step">
                        <AppIcon name="bank" :size="18" class="step-svg" />
                        <span>Pindai QR di atas</span>
                      </div>
                      <div class="guide-step">
                        <AppIcon name="check-circle" :size="18" class="step-svg" />
                        <span>Screenshot / foto bukti</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Upload bukti -->
                <div class="input-field mt-block">
                  <label class="field-label">
                    Bukti Pembayaran <span class="required">*</span>
                  </label>

                  <div v-if="proofPreview" class="proof-preview">
                    <img :src="proofPreview" alt="Pratinjau bukti pembayaran" class="proof-preview-img" />
                    <div class="proof-preview-meta">
                      <strong>Bukti siap dikirim</strong>
                      <span>Foto otomatis dikompres hingga maksimal 2MB.</span>
                    </div>
                    <button type="button" class="proof-remove-btn" @click="clearProof">
                      <AppIcon name="close" :size="14" />
                      <span>Ganti foto</span>
                    </button>
                  </div>

                  <label v-else class="proof-dropzone" :class="{ error: errors.proof }">
                    <input
                      type="file"
                      accept="image/*"
                      class="sr-only"
                      @change="handleProofSelected"
                    />
                    <div class="proof-dropzone-icon"><AppIcon name="camera" :size="26" /></div>
                    <strong>Ketuk untuk pilih foto bukti transfer</strong>
                    <span>JPG/PNG, otomatis dikompres ke maksimal 2MB.</span>
                  </label>

                  <span v-if="errors.proof" class="error-msg">{{ errors.proof }}</span>
                  <span v-else-if="proofError" class="error-msg">{{ proofError }}</span>
                  <span v-else class="field-hint">
                    Bukti disimpan terpisah dan hanya dilihat kasir untuk verifikasi pembayaran.
                  </span>
                </div>
              </template>

              <div v-else class="method-info-banner cash-info">
                <div class="info-banner-icon"><AppIcon name="cash" :size="20" /></div>
                <div class="info-banner-content">
                  <h4 class="info-banner-title">Bayar Langsung di Kasir</h4>
                  <p class="info-banner-desc">
                    Pesanan langsung tercatat sebesar <strong>{{ formatRupiah(store.grandTotal) }}</strong>.
                    Datang ke meja kasir, sebutkan nama atau kode pesanan
                    <strong class="font-mono">{{ orderCode }}</strong>. Kasir yang mengonfirmasi pembayaran
                    dan mencetak struk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Block 3: Catatan Dapur -->
          <div class="form-block">
            <div class="block-header">
              <span class="block-number">3</span>
              <h2 class="block-title">Catatan Tambahan untuk Dapur (Opsional)</h2>
            </div>

            <div class="block-content">
              <div class="input-field full-width">
                <label class="field-label" for="cust-notes">Catatan untuk Barista</label>
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
                <span class="field-hint">Catatan ini otomatis tercantum pada struk dapur.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Summary Sidebar -->
        <div class="checkout-summary-section">
          <div class="summary-card">
            <h2 class="summary-title">Ringkasan Pesanan</h2>

            <div class="summary-items-list">
              <div v-for="item in store.cart" :key="item.id" class="summary-line-item">
                <div class="line-item-left">
                  <span class="line-item-qty">{{ item.quantity }}x</span>
                  <div class="line-item-text">
                    <span class="line-item-name">{{ item.name }}</span>
                    <span v-if="item.notes" class="line-item-note">"{{ item.notes }}"</span>
                  </div>
                </div>
                <span class="line-item-price">{{ formatRupiah(item.price * item.quantity) }}</span>
              </div>
            </div>

            <div class="summary-divider"></div>

            <div class="summary-breakdown">
              <div class="breakdown-row">
                <span class="lbl">Subtotal</span>
                <span class="val">{{ formatRupiah(store.subtotal) }}</span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-total-row">
                <span class="total-lbl">Total Pembayaran</span>
                <span class="total-val">{{ formatRupiah(store.grandTotal) }}</span>
              </div>
            </div>

            <p v-if="errors.submit" class="error-msg" role="alert">{{ errors.submit }}</p>

            <button
              type="button"
              class="btn-submit-order"
              :disabled="isSubmitting || proofUploading"
              @click="handleProcessOrder"
            >
              <template v-if="proofUploading">
                <span>Mengunggah bukti...</span>
              </template>
              <template v-else-if="isSubmitting">
                <span>Memproses Pesanan...</span>
              </template>
              <template v-else>
                <span>{{ needsProof ? 'Kirim Pesanan + Bukti Bayar' : 'Kirim Pesanan' }}</span>
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

    <div v-if="toastMessage" class="toast-popup" :class="`toast-${toastType}`">{{ toastMessage }}</div>
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

.code-pill {
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

.font-mono {
  font-family: Consolas, Monaco, monospace;
  letter-spacing: 0.04em;
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

.mt-block {
  margin-top: 1.25rem;
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

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 1.5rem;
  background-color: #FFF5F5;
  border: 1px solid #FEB2B2;
  border-radius: var(--radius-md);
  color: #C53030;
  font-size: 0.85rem;
}

/* Payment Methods */
.payment-methods-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  flex-shrink: 0;
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

/* Batch info */
.batch-info-box {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.batch-info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.batch-info-row strong {
  color: var(--color-text-main);
}

/* QRIS Card */
.qris-card-wrapper {
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

/* Proof upload */
.proof-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 1.75rem 1.25rem;
  border: 2px dashed var(--border-medium);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.proof-dropzone:hover {
  border-color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

.proof-dropzone.error {
  border-color: #B25353;
  background-color: #FDF6F6;
}

.proof-dropzone strong {
  font-size: 0.88rem;
  color: var(--color-text-main);
}

.proof-dropzone span {
  font-size: 0.78rem;
  color: var(--color-text-subtle);
}

.proof-dropzone-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.proof-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
}

.proof-preview-img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.proof-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.proof-preview-meta strong {
  font-size: 0.88rem;
  color: var(--color-text-main);
}

.proof-preview-meta span {
  font-size: 0.76rem;
  color: var(--color-text-subtle);
}

.proof-remove-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  background-color: var(--bg-surface);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.proof-remove-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
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

.summary-total-row {
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

.toast-popup {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 1200;
}

.toast-error {
  background-color: #C53030;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
}

@media (max-width: 640px) {
  .summary-card {
    padding: 1.25rem 1rem;
  }
  .qris-live-image {
    width: 200px;
    height: 200px;
  }
  .btn-submit-order {
    padding: 12px 16px;
    font-size: 0.88rem;
  }
  .proof-preview {
    flex-wrap: wrap;
  }
}
</style>