<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { formatRupiah, createToast } from '@/utils/format'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

const searchQuery = ref('')
const selectedCategory = ref('Semua')
const activeItemForNote = ref(null)
const itemNoteInput = ref('')
const { toastMessage, showToast } = createToast(2600)

onMounted(async () => {
  await store.fetchMenuFromAPI()
  // Jika pelanggan belum input nama & token, buka modal verifikasi
  if (!store.customerSession.isVerified) {
    store.openAuthModal()
  }
})

const categories = [
  'Semua',
  'Kopi Pilihan',
  'Artisan Sandwich',
  'Camilan Sehat'
]

const filteredItems = computed(() => {
  return store.menuItems.filter(item => {
    // Search query match
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))

    // Category match
    const matchesCategory = selectedCategory.value === 'Semua' || item.category === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})

function openNoteModal(item) {
  if (item.is_available === false) return
  if (!store.customerSession.isVerified) {
    store.openAuthModal()
    return
  }
  activeItemForNote.value = item
  itemNoteInput.value = ''
}

function closeNoteModal() {
  activeItemForNote.value = null
  itemNoteInput.value = ''
}

function confirmAddWithNote() {
  if (!activeItemForNote.value || activeItemForNote.value.is_available === false) return
  store.addToCart(activeItemForNote.value, itemNoteInput.value)
  showToast(`${activeItemForNote.value.name} ditambahkan ke pesanan`)
  closeNoteModal()
}

function quickAddToCart(item) {
  if (item.is_available === false) return
  if (!store.customerSession.isVerified) {
    store.openAuthModal()
    return
  }
  store.addToCart(item)
  showToast(`${item.name} berhasil ditambahkan`)
}

function goToCart() {
  router.push('/pesanan')
}
</script>

<template>
  <div class="menu-view">
    <!-- Header Section -->
    <div class="menu-header-bar">
      <div class="container">
        <div class="header-titles">
          <h1 class="page-title">Pilihan Menu Kopi & Sandwich</h1>
          
          <!-- Customer Session Status Banner -->
          <div v-if="store.customerSession.isVerified" class="customer-welcome-pill">
            <AppIcon name="user" :size="15" />
            <span>Halo, <strong>{{ store.customerSession.name }}</strong> (Token: <strong>{{ store.customerSession.token }}</strong>) — Silakan pilih hidangan favorit Anda.</span>
          </div>

          <div v-else class="customer-locked-banner">
            <div class="locked-text-wrap">
              <AppIcon name="shield-check" :size="20" class="lock-icon" />
              <div>
                <strong>Akses Menu Belum Terverifikasi</strong>
                <p>Silakan masukkan Nama Anda dan Token 3 Digit dari kasir untuk membuka pilihan menu.</p>
              </div>
            </div>
            <div class="locked-actions-wrap">
              <button type="button" class="btn-unlock-auth" @click="store.openAuthModal()">
                <AppIcon name="user" :size="15" />
                <span>Input Nama & Token</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Filter & Search Controls (Hanya jika terverifikasi) -->
        <div v-if="store.customerSession.isVerified" class="search-filter-row">
          <!-- Search Field -->
          <div class="search-box">
            <AppIcon name="search" :size="18" class="search-icon" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari menu kopi atau makanan..." 
              class="search-input"
            />
            <button 
              v-if="searchQuery" 
              class="clear-search-btn" 
              @click="searchQuery = ''"
              title="Hapus pencarian"
            >
              <AppIcon name="close" :size="14" />
            </button>
          </div>
        </div>

        <!-- Category Horizontal Tabs (Hanya jika terverifikasi) -->
        <div v-if="store.customerSession.isVerified" class="category-tabs-container">
          <div class="category-tabs">
            <button 
              v-for="cat in categories" 
              :key="cat"
              class="category-btn"
              :class="{ 'active': selectedCategory === cat }"
              @click="selectedCategory = cat"
            >
              {{ cat }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Menu List Section -->
    <div class="container menu-list-container">
      <!-- Jika BELUM verifikasi token & nama: Tampilkan Gate Akses Awal -->
      <div v-if="!store.customerSession.isVerified" class="menu-gate-card text-center">
        <div class="gate-icon-wrap">
          <AppIcon name="shield-check" :size="40" />
        </div>
        <h2 class="gate-title">Masukkan Token & Nama untuk Membuka Menu</h2>
        <p class="gate-desc">
          Untuk mulai memilih hidangan kopi dan sandwich di SIKopi, silakan masukkan Nama Anda dan Token 3 Digit yang diberikan oleh kasir di meja kasir.
        </p>
        <button type="button" class="btn-gate-open" @click="store.openAuthModal()">
          <AppIcon name="user" :size="18" />
          <span>Masukkan Nama & </span>
        </button>
      </div>

      <!-- Jika SUDAH diverifikasi: Tampilkan Menu Grid Lengkap -->
      <template v-else>
        <!-- Result stats -->
        <div class="results-meta">
          <span class="meta-count">
            Menampilkan {{ filteredItems.length }} menu
          </span>
          <span v-if="selectedCategory !== 'Semua'" class="meta-filter">
            Kategori: {{ selectedCategory }}
          </span>
        </div>

        <!-- Empty State -->
        <div v-if="filteredItems.length === 0" class="empty-state">
          <div class="empty-icon-box">
            <AppIcon name="search" :size="32" />
          </div>
          <h3 class="empty-title">Menu tidak ditemukan</h3>
          <p class="empty-text">
            Coba kata kunci lain atau pilih kategori yang berbeda.
          </p>
          <button class="btn-reset" @click="searchQuery = ''; selectedCategory = 'Semua'">
            Reset Semua Filter
          </button>
        </div>

        <!-- Menu Grid -->
        <div v-else class="menu-grid">
          <div 
            v-for="item in filteredItems" 
            :key="item.id" 
            class="menu-card"
            :class="{ 'item-out-of-stock': item.is_available === false }"
          >
            <div class="card-media">
              <img :src="api.fileUrl(item.image)" :alt="item.name" class="item-img" loading="lazy" />
              <div v-if="item.is_available === false" class="out-of-stock-overlay">
                <span class="out-of-stock-pill">Habis</span>
              </div>
            </div>

            <div class="card-content">
              <h3 class="item-title">{{ item.name }}</h3>
              <p class="item-description">{{ item.description }}</p>

              <div class="card-action-bar">
                <div class="price-box">
                  <span class="price-val">{{ formatRupiah(item.price) }}</span>
                </div>

                <div class="action-buttons">
                  <template v-if="item.is_available !== false">
                    <button 
                      class="btn-customize" 
                      title="Tambah dengan catatan khusus"
                      @click="openNoteModal(item)"
                    >
                      Catatan
                    </button>
                    <button 
                      class="btn-add" 
                      title="Tambah langsung ke pesanan"
                      @click="quickAddToCart(item)"
                    >
                      <AppIcon name="plus" :size="16" />
                      <span>Tambah</span>
                    </button>
                  </template>
                  <template v-else>
                    <button 
                      class="btn-out-of-stock"
                      disabled
                      title="Menu ini sedang tidak tersedia / habis"
                    >
                      <span>Menu Habis</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Sticky Floating Order Banner when items in cart -->
    <transition name="slide-up">
      <div v-if="store.cartCount > 0" class="floating-cart-banner">
        <div class="container banner-inner">
          <div class="banner-info">
            <span class="banner-count">{{ store.cartCount }} menu dipilih</span>
            <span class="banner-divider">·</span>
            <span class="banner-total">{{ formatRupiah(store.subtotal) }}</span>
          </div>
          <button class="btn-view-order" @click="goToCart">
            <span>Lihat Daftar Pesanan</span>
            <AppIcon name="arrow-right" :size="16" />
          </button>
        </div>
      </div>
    </transition>

    <!-- Modal for Customization / Special Note -->
    <transition name="fade">
      <div v-if="activeItemForNote" class="modal-backdrop" @click.self="closeNoteModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">Catatan Pesanan</h3>
            <button class="modal-close-btn" @click="closeNoteModal">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div class="modal-body">
            <div class="modal-item-preview">
              <p class="modal-item-name">{{ activeItemForNote.name }}</p>
              <p class="modal-item-price">{{ formatRupiah(activeItemForNote.price) }}</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="special-note">
                Instruksi Khusus Dapur (Opsional)
              </label>
              <textarea
                id="special-note"
                v-model="itemNoteInput"
                rows="3"
                class="form-textarea"
                placeholder="Contoh: Dressing salad dipisah, tanpa bawang, atau tingkat kepedasan sedang..."
              ></textarea>
              <p class="form-hint">
                Dapur kami akan berusaha sebaik mungkin menyesuaikan preferensi diet Anda.
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="closeNoteModal">
              Batal
            </button>
            <button class="btn-confirm-add" @click="confirmAddWithNote">
              Tambahkan ke Pesanan
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast Notification -->
    <transition name="toast-fade">
      <div v-if="toastMessage" class="toast-bar">
        <AppIcon name="check" :size="16" class="toast-icon" />
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.menu-view {
  padding-bottom: 7rem;
}

.menu-header-bar {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-light);
  padding: 3rem 0 0;
}

.header-titles {
  max-width: 680px;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.customer-welcome-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 1rem;
  padding: 8px 16px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.88rem;
}

.customer-locked-banner {
  margin-top: 1.25rem;
  padding: 1.1rem 1.25rem;
  background-color: #FFFDF7;
  border: 1px solid #FEEBC8;
  border-left: 4px solid #DD6B20;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.locked-text-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lock-icon {
  color: #DD6B20;
  flex-shrink: 0;
}

.locked-text-wrap strong {
  display: block;
  font-size: 0.92rem;
  color: #7B341E;
  margin-bottom: 2px;
}

.locked-text-wrap p {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.locked-actions-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-unlock-auth {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-unlock-auth:hover {
  background-color: var(--color-primary-hover);
}

.btn-link-token-page {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.search-filter-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 0 40px 0 42px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  outline: none;
  font-size: 0.9rem;
  color: var(--color-text-main);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.search-input:focus {
  background-color: #FFFFFF;
  border-color: var(--color-primary);
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.diet-filter-box {
  min-width: 180px;
}

.diet-select {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--color-text-main);
  outline: none;
  cursor: pointer;
  font-size: 0.88rem;
  transition: border-color 0.2s ease;
}

.diet-select:focus {
  border-color: var(--color-primary);
}

/* Category Tabs */
.category-tabs-container {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  margin-left: -1.5rem;
  margin-right: -1.5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.category-tabs-container::-webkit-scrollbar {
  display: none;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--border-light);
  padding: 0.75rem 0;
  min-width: max-content;
}

.category-btn {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background-color: transparent;
  transition: all 0.2s ease;
}

.category-btn:hover {
  color: var(--color-primary);
  background-color: var(--bg-primary);
}

.category-btn.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-weight: 600;
}

/* List container */
.menu-list-container {
  padding-top: 2rem;
}

.results-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.meta-count {
  font-weight: 500;
}

.meta-filter {
  color: var(--color-primary);
}

/* Menu Grid & Cards */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.75rem;
}

.menu-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.menu-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-card);
}

.card-media {
  position: relative;
  height: 210px;
  overflow: hidden;
  background-color: var(--bg-subtle);
}

.item-out-of-stock {
  opacity: 0.6;
  filter: grayscale(90%);
  background-color: #F5F3EE;
  border-color: #E2DDD5;
}

.item-out-of-stock:hover {
  box-shadow: none;
  border-color: #E2DDD5;
}

.out-of-stock-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(28, 25, 23, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.out-of-stock-pill {
  background-color: #383431;
  color: #FAF8F5;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 5px 14px;
  border-radius: var(--radius-full);
}

.btn-out-of-stock {
  padding: 8px 14px;
  background-color: #E5DFD5;
  color: #78716C;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: not-allowed;
  border: 1px solid #D6CFC4;
}

.item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.menu-card:hover .item-img {
  transform: scale(1.03);
}

.card-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* Zero badge clean nutrition text */
.nutrition-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  margin-bottom: 0.6rem;
  color: var(--color-text-muted);
}

.nutrition-diet {
  color: var(--color-primary);
  font-weight: 600;
}

.nutrition-cal {
  color: var(--color-text-subtle);
}

.item-title {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-main);
  margin-bottom: 0.5rem;
}

.item-description {
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  flex: 1;
}

.item-prep-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--color-text-subtle);
  margin-bottom: 1.25rem;
}

.clock-icon {
  color: var(--color-text-subtle);
}

.card-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.price-val {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primary);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-customize {
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background-color: transparent;
  transition: all 0.2s ease;
}

.btn-customize:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-add:hover {
  background-color: var(--color-primary-hover);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  background-color: var(--bg-surface);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  margin: 1.5rem 0;
}

.empty-icon-box {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background-color: var(--bg-subtle);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 0.5rem;
}

.empty-text {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.btn-reset {
  padding: 9px 18px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 500;
}

/* Gate Card when unauthenticated */
.menu-gate-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 3.5rem 2rem;
  max-width: 540px;
  margin: 2.5rem auto 4rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.gate-icon-wrap {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.gate-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0.75rem;
}

.gate-desc {
  font-size: 0.92rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin-bottom: 1.75rem;
}

.btn-gate-open {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: var(--color-primary);
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(47, 111, 68, 0.25);
}

.btn-gate-open:hover {
  background-color: #235434;
  transform: translateY(-1px);
}

/* Floating bottom bar */
.floating-cart-banner {
  position: fixed;
  bottom: 64px; /* Diposisikan di atas Admin Fixed Bottom Bar */
  left: 0;
  right: 0;
  z-index: 40;
  pointer-events: none;
}

.banner-inner {
  pointer-events: auto;
  max-width: 600px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  padding: 14px 20px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 25px -5px rgba(44, 74, 62, 0.4);
}

.banner-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
}

.banner-count {
  font-weight: 500;
}

.banner-divider {
  opacity: 0.6;
}

.banner-total {
  font-weight: 700;
}

.btn-view-order {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #FFFFFF;
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.btn-view-order:hover {
  background-color: var(--bg-primary);
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background-color: rgba(29, 36, 32, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 480px;
  background-color: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.modal-close-btn {
  color: var(--color-text-muted);
  padding: 4px;
}

.modal-body {
  padding: 1.5rem;
}

.modal-item-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-item-name {
  font-weight: 600;
  color: var(--color-text-main);
}

.modal-item-price {
  font-weight: 700;
  color: var(--color-primary);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  outline: none;
  font-size: 0.88rem;
  background-color: var(--bg-primary);
  resize: vertical;
  transition: border-color 0.2s ease;
}

.form-textarea:focus {
  background-color: #FFFFFF;
  border-color: var(--color-primary);
}

.form-hint {
  font-size: 0.78rem;
  color: var(--color-text-subtle);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background-color: var(--bg-subtle);
  border-top: 1px solid var(--border-light);
}

.btn-cancel {
  padding: 10px 18px;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.btn-confirm-add {
  padding: 10px 20px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.88rem;
  font-weight: 600;
}

/* Toast */
.toast-bar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99;
  background-color: var(--color-text-main);
  color: #FFFFFF;
  padding: 12px 18px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  box-shadow: var(--shadow-card);
}

.toast-icon {
  color: #A3C9A8;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

@media (max-width: 1024px) {
  .menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .menu-grid {
    grid-template-columns: 1fr;
  }
  
  .search-filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .banner-inner {
    margin: 0 1rem;
  }
}
</style>

