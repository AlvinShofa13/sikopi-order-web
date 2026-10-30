<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { formatRupiah } from '@/utils/format'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

function handleQuantityChange(id, change) {
  store.updateQuantity(id, change)
}

function handleRemoveItem(id) {
  store.removeFromCart(id)
}

function handleUpdateNotes(id, event) {
  store.updateItemNotes(id, event.target.value)
}

// Cek status pesanan lama lewat kode transaksi (tanpa login).
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
  router.push(`/konfirmasi/${res.data.orderId}`)
}

function proceedToCheckout() {
  if (store.cart.length === 0) return
  router.push('/pembayaran')
}

function continueShopping() {
  router.push('/menu')
}
</script>

<template>
  <div class="cart-view-page">
    <div class="container cart-container">
      <!-- Breadcrumb Stepper -->
      <div class="tuku-stepper font-mono">
        <span class="step-badge is-current">01. PESANANMU</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge">02. PEMBAYARAN</span>
        <span class="step-arrow">&rarr;</span>
        <span class="step-badge">03. STATUS PESANAN</span>
      </div>

      <!-- Page Header with Display Font -->
      <div class="cart-header-area">
        <h1 class="heading-display cart-page-title">PESANANMU</h1>
        <p class="cart-page-sub font-mono">
          TINJAU KEMBALI PORSI DAN CATATAN SEBELUM KE PEMBAYARAN
        </p>
      </div>

      <!-- Empty Cart State -->
      <div v-if="store.cart.length === 0" class="empty-cart-card">
        <div class="cup-line-illustration">
          <svg viewBox="0 0 100 100" class="empty-cup-svg">
            <path d="M25,35 L75,35 L68,75 L32,75 Z" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="3" />
            <path d="M75,42 Q88,42 88,54 Q88,66 71,66" fill="none" stroke="#2C4A3E" stroke-width="3" />
            <line x1="30" y1="85" x2="70" y2="85" stroke="#2C4A3E" stroke-width="4" stroke-linecap="square" />
            <!-- Steam -->
            <path d="M42,26 Q38,18 42,10" fill="none" stroke="#D9886A" stroke-width="2" stroke-linecap="round" />
            <path d="M54,24 Q58,16 54,8" fill="none" stroke="#D9886A" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <h3 class="heading-display empty-title">KERANJANG BELUM TERISI</h3>
        <p class="empty-desc font-mono">
          Kamu belum memilih racikan kopi atau pastry hari ini.
        </p>
        <button type="button" class="btn btn-primary" @click="continueShopping">
          KEMBALI KE MENU &rarr;
        </button>
      </div>

      <!-- Cart Content (Items List + Summary) -->
      <div v-else class="cart-grid">
        <!-- Left: Items list -->
        <div class="cart-items-column">
          <div 
            v-for="item in store.cart" 
            :key="item.key || item.id" 
            class="cart-item-row"
          >
            <!-- Thumbnail square -->
            <div class="cart-item-thumb">
              <img 
                :src="api.fileUrl(item.image)" 
                :alt="item.name" 
                class="thumb-img"
              />
            </div>

            <!-- Details -->
            <div class="cart-item-details">
              <div class="item-top-row">
                <span class="item-title font-mono">{{ item.name }}</span>
                <span class="item-subtotal font-mono">{{ formatRupiah(store.lineTotal(item)) }}</span>
              </div>
              <div class="item-price-single font-mono">
                {{ formatRupiah(store.lineTotal(item) / item.quantity) }} / porsi
              </div>
              <p v-if="(item.variants || []).length > 0" class="item-variants font-mono">
                Varian: {{ (item.variants || []).join(', ') }}
              </p>

              <!-- Notes Input (Handwritten placeholder) -->
              <div class="item-note-wrap">
                <input 
                  type="text" 
                  :value="item.notes || ''"
                  placeholder="Catatan khusus (misal: less ice, normal sugar)..." 
                  class="item-note-input"
                  @change="handleUpdateNotes(item.key || item.id, $event)"
                />
              </div>

              <!-- Stepper & Delete -->
              <div class="item-action-row">
                <div class="tuku-stepper-box">
                  <button 
                    type="button" 
                    class="step-btn" 
                    @click="handleQuantityChange(item.key || item.id, -1)"
                  >
                    &minus;
                  </button>
                  <span class="step-num font-mono">{{ item.quantity }}</span>
                  <button 
                    type="button" 
                    class="step-btn" 
                    @click="handleQuantityChange(item.key || item.id, 1)"
                  >
                    +
                  </button>
                </div>

                <button 
                  type="button" 
                  class="btn-delete-link font-mono" 
                  @click="handleRemoveItem(item.id)"
                >
                  HAPUS
                </button>
              </div>
            </div>
          </div>

          <div class="cart-nav-actions">
            <button type="button" class="btn btn-outline" @click="continueShopping">
              &larr; TAMBAH MENU LAIN
            </button>
          </div>
        </div>

        <!-- Right: Summary Card -->
        <div class="cart-summary-column">
          <div class="summary-card">
            <h3 class="heading-display summary-title">RINGKASAN BIAYA</h3>
            <div class="divider-line"></div>

            <div class="summary-line font-mono">
              <span>TOTAL PORSI</span>
              <span>{{ store.cartCount }} porsi</span>
            </div>
            <div class="summary-line font-mono">
              <span>SUBTOTAL HIDANGAN</span>
              <span>{{ formatRupiah(store.grandTotal) }}</span>
            </div>

            <div class="divider-line"></div>

            <div class="summary-total-line font-mono">
              <span class="total-label">TOTAL AKHIR</span>
              <span class="total-amount">{{ formatRupiah(store.grandTotal) }}</span>
            </div>

            <div class="tag-free-tax font-mono">
              HARGA NETT &bull; TANPA BIAYA TERSEMBUNYI
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-checkout-submit" 
              @click="proceedToCheckout"
            >
              LANJUT KE PEMBAYARAN &rarr;
            </button>
          </div>
        </div>
      </div>

      <!-- Cek Status Pesanan: pelanggan yang sudah punya kode transaksi -->
      <div class="lookup-card">
        <div class="lookup-icon-wrap">
          <AppIcon name="receipt" :size="28" />
        </div>
        <h3 class="lookup-title">Sudah Pernah Memesan?</h3>
        <p class="lookup-subtitle">
          Masukkan kode transaksi Anda (contoh: SK-2K9QW4Z7) untuk melihat status pesanan.
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-view-page {
  background-color: var(--color-sand);
  min-height: calc(100vh - 54px);
  padding: 2.5rem 0 4rem;
}

.cart-container {
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
.cart-header-area {
  margin-bottom: 2rem;
}

.cart-page-title {
  font-size: clamp(2.4rem, 4.2vw, 3.2rem);
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.cart-page-sub {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--color-primary-2);
  font-weight: 700;
}

/* Empty state */
.empty-cart-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 4rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.empty-cup-svg {
  width: 90px;
  height: 90px;
}

.empty-title {
  font-size: 2rem;
  color: var(--color-primary);
}

.empty-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  max-width: 400px;
}

/* Grid */
.cart-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 2rem;
  align-items: start;
}

/* Items column */
.cart-items-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cart-item-row {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.25rem;
  display: flex;
  gap: 1.25rem;
}

.cart-item-thumb {
  width: 74px;
  height: 74px;
  flex-shrink: 0;
  border: 1.5px solid var(--color-primary);
  background-color: var(--color-sand);
  overflow: hidden;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.item-top-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.item-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-primary);
}

.item-subtotal {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-primary);
}

.item-price-single {
  font-size: 11px;
  color: var(--color-text-muted);
}

.item-note-wrap {
  margin-top: 4px;
}

.item-note-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 11px;
  border: 1.5px solid var(--color-primary);
  background-color: #FAF7F2;
}

.item-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.tuku-stepper-box {
  display: inline-flex;
  border: 2px solid var(--color-primary);
}

.step-btn {
  width: 28px;
  height: 28px;
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: none;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-btn:hover {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

.step-num {
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  background-color: var(--color-white);
  color: var(--color-primary);
}

.btn-delete-link {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-status-danger);
  background: transparent;
  border: none;
  cursor: pointer;
}

.btn-delete-link:hover {
  text-decoration: underline;
}

.cart-nav-actions {
  margin-top: 1rem;
}

/* Summary Card */
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

.divider-line {
  border-bottom: 2px solid var(--color-primary);
  margin: 4px 0;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-primary);
}

.summary-total-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 16px;
  font-weight: 800;
  color: var(--color-primary);
  padding: 4px 0;
}

.total-amount {
  font-size: 1.25rem;
  color: var(--color-primary);
}

.tag-free-tax {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  background-color: var(--color-sage-soft);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
  text-align: center;
  margin: 6px 0;
}

.btn-checkout-submit {
  width: 100%;
  padding: 14px;
  font-size: 13px;
  margin-top: 6px;
}

@media (max-width: 860px) {
  .cart-grid {
    grid-template-columns: 1fr;
  }
  .cart-nav-actions {
    order: -1;
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
}

/* Varian pada baris cart */
.item-variants {
  font-size: 0.75rem;
  color: var(--color-primary);
  font-weight: 700;
  margin: 2px 0 0;
}

/* Cek status pesanan via kode transaksi */
.lookup-card {
  max-width: 480px;
  margin: 3rem auto 0;
  padding: 2.25rem 2rem;
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  text-align: center;
}

.lookup-icon-wrap {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-peach);
  color: var(--color-primary);
}

.lookup-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.lookup-subtitle {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-primary-2);
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
  border: 2px solid var(--color-primary);
  background-color: var(--color-white);
  outline: none;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.btn-lookup {
  height: 46px;
  padding: 0 20px;
  border: none;
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-size: 0.88rem;
  font-weight: 700;
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
  color: var(--color-status-danger);
  font-weight: 700;
}
</style>
