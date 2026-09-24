<script setup>
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

function handleQuantityChange(id, change) {
  store.updateQuantity(id, change)
}

function handleRemoveItem(id) {
  store.removeFromCart(id)
}

function handleUpdateNotes(id, event) {
  store.updateItemNotes(id, event.target.value)
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
  <div class="cart-view">
    <div class="container">
      <!-- Breadcrumb / Minimal Stepper (NO badges) -->
      <div class="checkout-stepper">
        <div class="step-indicator active">
          <span class="step-circle">1</span>
          <span class="step-name">Daftar Pesanan</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator">
          <span class="step-circle">2</span>
          <span class="step-name">Pembayaran</span>
        </div>
        <div class="step-connector"></div>
        <div class="step-indicator">
          <span class="step-circle">3</span>
          <span class="step-name">Nomor Pesanan</span>
        </div>
      </div>

      <!-- Page Header -->
      <div class="cart-header">
        <h1 class="page-title">Daftar Pesanan Anda</h1>
        <p class="page-subtitle">
          Tinjau kembali porsi dan instruksi khusus sebelum melanjutkan ke pembayaran.
        </p>
      </div>

      <!-- Empty Cart State -->
      <div v-if="store.cart.length === 0" class="empty-cart-card">
        <div class="empty-icon-wrap">
          <AppIcon name="bag" :size="36" />
        </div>
        <h2 class="empty-headline">Belum Ada Hidangan di Pesanan</h2>
        <p class="empty-sub">
          Jelajahi menu sehat organik kami untuk memulai gaya hidup seimbang hari ini.
        </p>
        <button class="btn-primary" @click="continueShopping">
          <AppIcon name="arrow-left" :size="16" />
          <span>Eksplor Pilihan Menu</span>
        </button>
      </div>

      <!-- Active Cart Layout -->
      <div v-else class="cart-layout-grid">
        <!-- Left: Items List -->
        <div class="cart-items-section">
          <div class="items-header">
            <span class="items-count-text">{{ store.cartCount }} porsi hidangan</span>
            <button class="btn-clear-cart" @click="store.clearCart" title="Kosongkan semua pesanan">
              <span>Kosongkan</span>
            </button>
          </div>

          <div class="items-list">
            <div v-for="item in store.cart" :key="item.id" class="cart-item-card">
              <div class="item-visual">
                <img :src="item.image" :alt="item.name" class="item-thumbnail" />
              </div>

              <div class="item-details">
                <div class="item-headline-row">
                  <div>
                    <h3 class="item-name">{{ item.name }}</h3>
                    <p class="item-meta">{{ item.dietInfo }} · {{ item.calories }} kkal</p>
                  </div>
                  <button 
                    class="btn-trash" 
                    title="Hapus menu ini"
                    @click="handleRemoveItem(item.id)"
                  >
                    <AppIcon name="trash" :size="16" />
                  </button>
                </div>

                <!-- Notes field -->
                <div class="item-note-row">
                  <input
                    type="text"
                    :value="item.notes"
                    placeholder="Tambah catatan (opsional, misal: dressing dipisah)..."
                    class="item-note-input"
                    @input="handleUpdateNotes(item.id, $event)"
                  />
                </div>

                <!-- Quantity & Price Row -->
                <div class="item-pricing-row">
                  <div class="quantity-controller">
                    <button 
                      class="qty-btn" 
                      title="Kurangi"
                      @click="handleQuantityChange(item.id, -1)"
                    >
                      <AppIcon name="minus" :size="14" />
                    </button>
                    <span class="qty-number">{{ item.quantity }}</span>
                    <button 
                      class="qty-btn" 
                      title="Tambah"
                      @click="handleQuantityChange(item.id, 1)"
                    >
                      <AppIcon name="plus" :size="14" />
                    </button>
                  </div>

                  <div class="price-wrap">
                    <span class="unit-price" v-if="item.quantity > 1">
                      {{ formatRupiah(item.price) }} / porsi
                    </span>
                    <span class="total-line-price">
                      {{ formatRupiah(item.price * item.quantity) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Add more items action -->
          <div class="add-more-box">
            <button class="btn-add-more" @click="continueShopping">
              <AppIcon name="plus" :size="16" />
              <span>Tambah Menu Lainnya</span>
            </button>
          </div>
        </div>

        <!-- Right: Order Summary -->
        <div class="cart-summary-section">
          <div class="summary-card">
            <h2 class="summary-title">Ringkasan Biaya</h2>

            <div class="summary-breakdown">
              <div class="breakdown-row">
                <span class="label">Subtotal Makanan</span>
                <span class="val">{{ formatRupiah(store.subtotal) }}</span>
              </div>

              <div class="breakdown-row">
                <span class="label">
                  Kemasan Ramah Lingkungan
                  <span class="sub-label">Serat bambu & kertas daur ulang</span>
                </span>
                <span class="val">{{ formatRupiah(store.ecoPackagingFee) }}</span>
              </div>

              <div class="breakdown-row">
                <span class="label">Pajak Restoran (PB1 10%)</span>
                <span class="val">{{ formatRupiah(store.tax) }}</span>
              </div>

              <div class="summary-divider"></div>

              <div class="breakdown-total-row">
                <span class="total-label">Total Pesanan</span>
                <span class="total-amount">{{ formatRupiah(store.grandTotal) }}</span>
              </div>
            </div>
            
            <!-- Checkout CTA -->
            <button class="btn-checkout" @click="proceedToCheckout">
              <span>Lanjut ke Pembayaran</span>
              <AppIcon name="arrow-right" :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-view {
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

/* Page Header */
.cart-header {
  margin-bottom: 2rem;
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

/* Empty Cart State */
.empty-cart-card {
  text-align: center;
  padding: 5rem 1.5rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  max-width: 560px;
  margin: 2rem auto;
}

.empty-icon-wrap {
  width: 68px;
  height: 68px;
  border-radius: var(--radius-full);
  background-color: var(--bg-subtle);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.empty-headline {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.5rem;
}

.empty-sub {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.92rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

/* Cart Grid */
.cart-layout-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2.5rem;
  align-items: flex-start;
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.items-count-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.btn-clear-cart {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  padding: 4px;
}

.btn-clear-cart:hover {
  color: #8C4040;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cart-item-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  gap: 1.25rem;
  transition: border-color 0.2s ease;
}

.cart-item-card:hover {
  border-color: var(--border-medium);
}

.item-visual {
  width: 90px;
  height: 90px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--bg-subtle);
}

.item-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-headline-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.item-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-main);
  line-height: 1.3;
}

.item-meta {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.btn-trash {
  color: var(--color-text-subtle);
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.btn-trash:hover {
  color: #A34848;
}

.item-note-row {
  margin-bottom: 0.85rem;
}

.item-note-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.82rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  outline: none;
  transition: border-color 0.2s ease;
}

.item-note-input:focus {
  border-color: var(--color-primary);
  background-color: #FFFFFF;
}

.item-pricing-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.quantity-controller {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  background-color: var(--bg-primary);
  padding: 2px 4px;
}

.qty-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-main);
  border-radius: var(--radius-full);
  transition: background-color 0.15s ease;
}

.qty-btn:hover {
  background-color: #FFFFFF;
}

.qty-number {
  min-width: 24px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.price-wrap {
  text-align: right;
}

.unit-price {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.total-line-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary);
}

.add-more-box {
  margin-top: 1rem;
}

.btn-add-more {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-primary);
  background-color: transparent;
  width: 100%;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-add-more:hover {
  background-color: var(--bg-surface);
  border-color: var(--color-primary);
}

/* Summary Card */
.summary-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.75rem;
  box-shadow: var(--shadow-subtle);
}

.summary-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 1.5rem;
}

.summary-breakdown {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 0.9rem;
}

.label {
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
}

.sub-label {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin-top: 2px;
}

.val {
  font-weight: 500;
  color: var(--color-text-main);
}

.summary-divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 0.5rem 0;
}

.breakdown-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.25rem;
}

.total-label {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-main);
}

.total-amount {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.02em;
}

.summary-eco-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  margin-bottom: 1.75rem;
}

.eco-icon {
  color: var(--color-primary);
  margin-top: 2px;
}

.eco-text {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.btn-checkout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  font-weight: 600;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

.btn-checkout:hover {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .cart-layout-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 640px) {
  .cart-header-title {
    font-size: 1.5rem;
  }
  .cart-layout-grid {
    gap: 1.25rem;
  }
  .cart-item-card {
    padding: 0.85rem;
  }
}
</style>

