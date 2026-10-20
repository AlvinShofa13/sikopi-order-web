<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { formatRupiah, createToast } from '@/utils/format'
import { generateQrisDataUrl } from '@/utils/qris'
import { isValidWaPhone } from '@/utils/wa'

const router = useRouter()
const store = useOrderStore()

if (store.cart.length === 0) {
  router.replace('/menu')
}

const customer = ref({
  name: store.customer.name || '',
  phone: store.customer.phone || '',
  specialRequest: ''
})

const { toastMessage, toastType, showToast } = createToast(3200)

const isPreorder = computed(() => store.activeMode === 'preorder')
const paymentMethod = ref(isPreorder.value ? 'transfer' : 'cash')

const errors = ref({})
const isSubmitting = ref(false)
const proofFile = ref(null)
const proofPreview = ref('')
const proofUploading = ref(false)
const proofError = ref('')
const serverErrorMessage = ref('')

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
    e.phone = 'Nomor WhatsApp wajib diisi (minimal 9 digit angka).'
  }
  if (needsProof.value && !proofFile.value) {
    e.proof = 'Pesanan transfer wajib mengunggah bukti pembayaran.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleProofSelected(event) {
  proofError.value = ''
  errors.value.proof = ''
  serverErrorMessage.value = ''
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    proofError.value = 'Berkas bukan gambar. Pilih foto JPG atau PNG.'
    return
  }
  proofFile.value = file
  proofPreview.value = URL.createObjectURL(file)
  showToast('Bukti pembayaran dipilih.', 'success')
}

function removeProof() {
  proofFile.value = null
  proofPreview.value = ''
  proofError.value = ''
}

async function handleSubmitOrder() {
  serverErrorMessage.value = ''
  if (!validateForm()) {
    showToast('Mohon lengkapi formulir pembayaran.', 'error')
    return
  }

  isSubmitting.value = true

  const payload = {
    paymentMethod: paymentMethod.value,
    proofFile: proofFile.value,
    customerData: {
      name: customer.value.name.trim(),
      phone: customer.value.phone.trim()
    },
    specialRequest: customer.value.specialRequest?.trim() || ''
  }

  const result = await store.submitOrder(payload)
  isSubmitting.value = false

  if (result.ok) {
    router.replace(`/konfirmasi/${result.orderId}`)
  } else {
    serverErrorMessage.value = result.error || 'Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.'
    showToast(serverErrorMessage.value, 'error')
  }
}
</script>

<template>
  <div class="checkout-view-page">
    <div class="container checkout-container">
      <!-- Stepper breadcrumb -->
      <div class="tuku-stepper font-mono">
        <span class="step-badge">01. PESANANMU</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge is-current">02. PEMBAYARAN</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge">03. STATUS PESANAN</span>
      </div>

      <!-- Page Header -->
      <div class="checkout-header-area">
        <div class="header-top-row">
          <h1 class="heading-display checkout-page-title">PEMBAYARAN</h1>
          <span class="name-tag-peach font-mono">KODE: {{ orderCode }}</span>
        </div>
        <p class="checkout-page-sub font-mono">
          ISI DATA DIRI &bull; PILIH METODE BAYAR &bull; PESANAN LANGSUNG MASUK DAPUR
        </p>
      </div>

      <form @submit.prevent="handleSubmitOrder" class="checkout-form-grid">
        <div class="checkout-blocks-col">
          <!-- BLOK 1: DATA PEMESAN -->
          <div class="checkout-block-card">
            <div class="block-header">
              <span class="block-num font-mono">01</span>
              <h2 class="heading-display block-title">DATA PEMESAN</h2>
            </div>
            <div class="divider-line"></div>

            <div class="block-body">
              <div class="form-group">
                <label class="form-label font-mono">NAMA LENGKAP / PANGGILAN *</label>
                <input 
                  v-model="customer.name" 
                  type="text" 
                  placeholder="Contoh: Budi, Sarah, dll."
                  class="tuku-input"
                  :class="{ 'has-error': errors.name }"
                />
                <span v-if="errors.name" class="field-error font-mono">{{ errors.name }}</span>
              </div>

              <div class="form-group">
                <label class="form-label font-mono">NOMOR WHATSAPP AKTIF *</label>
                <input 
                  v-model="customer.phone" 
                  type="tel" 
                  placeholder="Contoh: 081234567890"
                  class="tuku-input font-mono"
                  :class="{ 'has-error': errors.phone }"
                />
                <span v-if="errors.phone" class="field-error font-mono">{{ errors.phone }}</span>
                <span class="input-hint font-mono">
                  Nomor ini digunakan untuk mengirim struk &amp; notifikasi saat pesanan siap diambil.
                </span>
              </div>

              <!-- Read-only Mode & Batch Info Tag -->
              <div class="mode-info-box font-mono">
                <div v-if="isPreorder && store.activeBatch" class="mode-badge-row">
                  <span class="name-tag name-tag-peach">MODE: PRE-ORDER</span>
                  <span class="name-tag">BATCH: {{ store.activeBatch.name }}</span>
                  <span v-if="store.activeBatch.pickupDate" class="name-tag">
                    SIAP: {{ formatDateTime(store.activeBatch.pickupDate) }}
                  </span>
                </div>
                <div v-else class="mode-badge-row">
                  <span class="name-tag name-tag-primary">MODE: HARI JUALAN (ON-SITE)</span>
                  <span class="name-tag">LANGSUNG DIRACIK DI KEDAI</span>
                </div>
              </div>
            </div>
          </div>

          <!-- BLOK 2: PEMBAYARAN -->
          <div class="checkout-block-card">
            <div class="block-header">
              <span class="block-num font-mono">02</span>
              <h2 class="heading-display block-title">METODE PEMBAYARAN</h2>
            </div>
            <div class="divider-line"></div>

            <div class="block-body">
              <!-- Segmented Payment Tabs -->
              <div class="payment-tabs-bar">
                <div class="segmented-tabs payment-segmented">
                  <button 
                    v-if="!isPreorder"
                    type="button" 
                    class="segmented-tab" 
                    :class="{ 'is-active': paymentMethod === 'cash' }"
                    @click="paymentMethod = 'cash'"
                  >
                    BAYAR DI KASIR
                  </button>
                  <button 
                    type="button" 
                    class="segmented-tab" 
                    :class="{ 'is-active': paymentMethod === 'transfer' }"
                    @click="paymentMethod = 'transfer'"
                  >
                    TRANSFER SEKARANG (QRIS)
                  </button>
                </div>
              </div>

              <!-- Opsi Cash di Kasir -->
              <div v-if="paymentMethod === 'cash'" class="payment-info-panel">
                <div class="info-alert-box font-mono">
                  <strong>BAYAR DI KASIR KEDAI:</strong> Tunjukkan kode pesananmu ke kasir saat tiba di outlet. Kasir menerima uang tunai atau QRIS dinamis.
                </div>
              </div>

              <!-- Opsi Transfer QRIS Dinamis + Upload Bukti -->
              <div v-if="paymentMethod === 'transfer'" class="payment-transfer-panel">
                <div class="qris-frame-box">
                  <span class="qris-box-title font-mono">SCAN QRIS DINAMIS</span>
                  <div class="qris-img-wrap">
                    <img :src="qrisImage" alt="QRIS Dinamis SIKopi" class="qris-qr-img" />
                  </div>
                  <div class="qris-nominal-box font-mono">
                    <span class="nominal-label">NOMINAL PAS:</span>
                    <span class="nominal-value">{{ formatRupiah(store.grandTotal) }}</span>
                  </div>
                </div>

                <!-- Dropzone Upload Bukti -->
                <div class="proof-dropzone-box">
                  <label class="form-label font-mono">UNGGAH BUKTI PEMBAYARAN *</label>

                  <div v-if="!proofPreview" class="dropzone-area">
                    <input 
                      type="file" 
                      accept="image/*" 
                      class="dropzone-file-input" 
                      @change="handleProofSelected"
                    />
                    <div class="dropzone-content font-mono">
                      <span class="dropzone-icon">&uarr;</span>
                      <span class="dropzone-text">KLIK ATAU TARIK FOTO BUKTI TRANSFER KE SINI</span>
                      <span class="dropzone-format">FORMAT JPG / PNG &bull; MAKS 2MB</span>
                    </div>
                  </div>

                  <!-- Preview Selected Proof -->
                  <div v-else class="proof-preview-card">
                    <img :src="proofPreview" alt="Pratinjau Bukti" class="preview-img" />
                    <div class="preview-actions">
                      <span class="preview-filename font-mono">{{ proofFile?.name }}</span>
                      <button type="button" class="btn-remove-proof font-mono" @click="removeProof">
                        GANTI FOTO
                      </button>
                    </div>
                  </div>

                  <span v-if="errors.proof" class="field-error font-mono">{{ errors.proof }}</span>
                  <span v-if="proofError" class="field-error font-mono">{{ proofError }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- BLOK 3: CATATAN DAPUR -->
          <div class="checkout-block-card">
            <div class="block-header">
              <span class="block-num font-mono">03</span>
              <h2 class="heading-display block-title">CATATAN DAPUR</h2>
            </div>
            <div class="divider-line"></div>

            <div class="block-body">
              <div class="form-group">
                <label class="form-label font-mono">PESAN KHUSUS UNTUK BARISTA (OPSIONAL)</label>
                <textarea 
                  v-model="customer.specialRequest" 
                  rows="3" 
                  placeholder="Misal: bungkus terpisah, sedotan ramah lingkungan, atau instruksi waktu tiba..."
                  class="tuku-textarea font-mono"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: SUMMARY & SUBMIT -->
        <div class="checkout-sidebar-col">
          <div class="summary-card">
            <h3 class="heading-display summary-title">PESANAN ANDA</h3>
            <div class="divider-line"></div>

            <div class="order-items-mini-list font-mono">
              <div 
                v-for="item in store.cart" 
                :key="item.id" 
                class="mini-item-row"
              >
                <span class="mini-item-name">{{ item.quantity }}x {{ item.name }}</span>
                <span class="mini-item-price">{{ formatRupiah(item.price * item.quantity) }}</span>
              </div>
            </div>

            <div class="divider-line"></div>

            <div class="summary-total-line font-mono">
              <span>TOTAL BAYAR</span>
              <span class="total-amount">{{ formatRupiah(store.grandTotal) }}</span>
            </div>

            <!-- Server Error Box if any -->
            <div v-if="serverErrorMessage" class="server-error-box font-mono">
              <strong>GAGAL:</strong> {{ serverErrorMessage }}
            </div>

            <button 
              type="submit" 
              class="btn btn-primary btn-checkout-submit" 
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'MEMPROSES PESANAN...' : 'KIRIM PESANAN SEKARANG &rarr;' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.checkout-view-page {
  background-color: var(--color-sand);
  min-height: calc(100vh - 54px);
  padding: 2.5rem 0 4rem;
}

.checkout-container {
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

/* Header */
.checkout-header-area {
  margin-bottom: 2rem;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.checkout-page-title {
  font-size: clamp(2.4rem, 4.2vw, 3.2rem);
  color: var(--color-primary);
  line-height: 1;
}

.checkout-page-sub {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--color-primary-2);
  font-weight: 700;
  margin-top: 6px;
}

/* Layout */
.checkout-form-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 2rem;
  align-items: start;
}

.checkout-blocks-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.checkout-block-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.75rem;
}

.block-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.block-num {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-peach);
  line-height: 1;
}

.block-title {
  font-size: 1.45rem;
  color: var(--color-primary);
}

.divider-line {
  border-bottom: 2px solid var(--color-primary);
  margin: 1rem 0 1.25rem;
}

.block-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}

.tuku-input, .tuku-textarea {
  width: 100%;
  border: 2px solid var(--color-primary);
  background-color: var(--color-white);
  padding: 10px 14px;
  font-size: 12px;
}

.tuku-input.has-error {
  border-color: var(--color-status-danger);
}

.field-error {
  font-size: 11px;
  color: var(--color-status-danger);
  font-weight: 700;
}

.input-hint {
  font-size: 10px;
  color: var(--color-text-muted);
}

.mode-info-box {
  background-color: var(--color-sand);
  border: 1.5px solid var(--color-primary);
  padding: 8px 12px;
}

.mode-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Payment Tabs */
.payment-tabs-bar {
  margin-bottom: 0.5rem;
}

.payment-segmented {
  width: 100%;
}

.payment-segmented .segmented-tab {
  flex: 1;
}

.info-alert-box {
  background-color: var(--color-sage-soft);
  border: 2px solid var(--color-primary);
  padding: 1rem;
  font-size: 11px;
  line-height: 1.6;
}

/* QRIS Frame Box */
.payment-transfer-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.qris-frame-box {
  border: 2px solid var(--color-primary);
  background-color: var(--color-white);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qris-box-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}

.qris-img-wrap {
  width: 220px;
  height: 220px;
  border: 2px solid var(--color-primary);
  padding: 6px;
  background-color: #FFFFFF;
}

.qris-qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qris-nominal-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--color-sand);
  border: 1.5px solid var(--color-primary);
  padding: 6px 14px;
}

.nominal-label {
  font-size: 11px;
  font-weight: 700;
}

.nominal-value {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-primary);
}

/* Dropzone */
.proof-dropzone-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dropzone-area {
  position: relative;
  border: 2px dashed var(--color-primary);
  background-color: #FAF7F2;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dropzone-area:hover {
  background-color: #F0EAE1;
}

.dropzone-file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dropzone-icon {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-peach);
}

.dropzone-text {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--color-primary);
}

.dropzone-format {
  font-size: 10px;
  color: var(--color-text-muted);
}

.proof-preview-card {
  border: 2px solid var(--color-primary);
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--color-white);
}

.preview-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border: 1px solid var(--color-primary);
}

.preview-actions {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-filename {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-remove-proof {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-status-danger);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}

/* Sidebar */
.checkout-sidebar-col {
  position: sticky;
  top: 70px;
}

.summary-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-title {
  font-size: 1.6rem;
  color: var(--color-primary);
}

.order-items-mini-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.mini-item-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-primary);
}

.summary-total-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-primary);
}

.total-amount {
  font-size: 1.3rem;
  color: var(--color-primary);
}

.server-error-box {
  background-color: var(--color-status-danger-bg);
  border: 2px solid var(--color-status-danger);
  padding: 10px 14px;
  font-size: 11px;
  color: var(--color-status-danger);
  font-weight: 700;
}

.btn-checkout-submit {
  width: 100%;
  padding: 14px;
  font-size: 12px;
  margin-top: 6px;
}

@media (max-width: 860px) {
  .checkout-form-grid {
    grid-template-columns: 1fr;
  }
  .checkout-sidebar-col {
    position: static;
  }
}
</style>
