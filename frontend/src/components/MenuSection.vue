<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { formatRupiah, parseVariants, variantsLabel, bundleContentsLabel, bundleSavings } from '@/utils/format'

const router = useRouter()
const store = useOrderStore()

const searchQuery = ref('')
const selectedCategory = ref('SEMUA')
const selectedItemForCaption = ref(null)
const activeItemForNote = ref(null)
const itemNoteInput = ref('')
const itemVariantsInput = ref([])

const defaultCategories = ['SEMUA', 'KOPI', 'NON-KOPI', 'PASTRY']

const availableCategories = computed(() => {
  const set = new Set()
  store.menuItems.forEach(i => {
    if (i.category) set.add(i.category.toUpperCase())
  })
  const custom = Array.from(set)
  if (custom.length > 0) {
    return ['SEMUA', ...custom]
  }
  return defaultCategories
})

function matchesCategory(item, cat) {
  if (cat === 'SEMUA') return true
  const itemCat = (item.category || '').toUpperCase()
  return itemCat === cat
}

const filteredMenuItems = computed(() => {
  return store.menuItems.filter(item => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || 
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    
    const matchesCat = matchesCategory(item, selectedCategory.value)
    return matchesSearch && matchesCat
  })
})

const favoriteItems = computed(() => {
  return store.menuItems.slice(0, 6)
})

function getItemQty(id) {
  return store.cart.filter((i) => i.id === id).reduce((s, i) => s + i.quantity, 0)
}

function bundleSaveInfo(item) {
  return bundleSavings(item.bundle_items, store.menuItems, item.price)
}

function openNoteModal(item) {
  if (item.is_available === false) return
  activeItemForNote.value = item
  itemNoteInput.value = ''
  itemVariantsInput.value = []
}

function closeNoteModal() {
  activeItemForNote.value = null
  itemNoteInput.value = ''
  itemVariantsInput.value = []
}

function toggleModalVariant(name) {
  const idx = itemVariantsInput.value.indexOf(name)
  if (idx === -1) itemVariantsInput.value.push(name)
  else itemVariantsInput.value.splice(idx, 1)
}

function modalVariantExtra() {
  if (!activeItemForNote.value) return 0
  const byName = new Map(parseVariants(activeItemForNote.value.variants).map((v) => [v.name, v.price]))
  return itemVariantsInput.value.reduce((s, n) => s + (byName.get(n) || 0), 0)
}

function confirmAddWithNote() {
  if (!activeItemForNote.value || activeItemForNote.value.is_available === false) return
  store.addToCart(activeItemForNote.value, itemNoteInput.value, itemVariantsInput.value)
  selectedItemForCaption.value = activeItemForNote.value
  closeNoteModal()
}

function handleAdd(item) {
  if (item.is_available === false) return
  if (parseVariants(item.variants).length > 0) {
    openNoteModal(item)
    return
  }
  store.addToCart(item)
  selectedItemForCaption.value = item
}

function handleRemove(item) {
  // Hapus satu baris varian (atau baris pertama bila tanpa varian) — cukup per id.
  const line = store.cart.find((i) => i.id === item.id)
  if (line) store.removeFromCart(line.key || line.id)
}

function selectItem(item) {
  selectedItemForCaption.value = item
}

// Category visual icon mapper
function getItemType(item) {
  const n = (item.name || '').toLowerCase()
  const c = (item.category || '').toLowerCase()
  if (n.includes('sandwich') || c.includes('sandwich')) return 'sandwich'
  if (n.includes('brownies') || n.includes('roti') || n.includes('croissant') || c.includes('pastry')) return 'pastry'
  if (n.includes('es') || n.includes('dingin') || n.includes('iced')) return 'cold-coffee'
  return 'hot-coffee'
}
</script>

<template>
  <div id="katalog-section" class="catalog-page-wrapper">
    <!-- 1. Horizontal Favorit Carousel ("Berawal dari warga") -->
    <section v-if="favoriteItems.length > 0" class="favorit-section">
      <div class="container favorit-container">
        <div class="favorit-header">
          <h2 class="heading-display favorit-title">MENU FAVORIT</h2>
          <span class="favorit-hint font-mono">&lsaquo;&lsaquo; GESER UNTUK LIHAT LAINNYA &rsaquo;&rsaquo;</span>
        </div>

        <div class="favorit-carousel">
          <div 
            v-for="fav in favoriteItems" 
            :key="'fav-' + fav.id"
            class="fav-card"
            @click="selectItem(fav)"
          >
            <!-- White border cutout frame with distinct product illustration -->
            <div class="fav-img-box">
              <!-- Cold Coffee / Es Kopi Susu -->
              <svg v-if="getItemType(fav) === 'cold-coffee'" viewBox="0 0 100 100" class="fav-svg-art">
                <rect x="0" y="0" width="100" height="100" fill="#2C4A3E" />
                <!-- Ice cup -->
                <polygon points="30,22 70,22 64,82 36,82" fill="#FAF7F2" stroke="#FAF7F2" stroke-width="2" />
                <!-- Coffee layer -->
                <polygon points="32,34 68,34 66,54 34,54" fill="#5C3B1E" />
                <!-- Milk layer -->
                <polygon points="34,54 66,54 64,80 36,80" fill="#E6D7C3" />
                <!-- Straw -->
                <line x1="45" y1="12" x2="52" y2="76" stroke="#D9886A" stroke-width="3" stroke-linecap="round" />
                <!-- Ice cube -->
                <rect x="42" y="38" width="14" height="12" fill="#FFFFFF" opacity="0.6" stroke="#2C4A3E" stroke-width="1" />
              </svg>

              <!-- Sandwich -->
              <svg v-else-if="getItemType(fav) === 'sandwich'" viewBox="0 0 100 100" class="fav-svg-art">
                <rect x="0" y="0" width="100" height="100" fill="#2C4A3E" />
                <!-- Bread triangle -->
                <polygon points="18,72 82,72 50,24" fill="#D9A066" stroke="#FAF7F2" stroke-width="2" />
                <!-- Lettuce -->
                <path d="M22,66 Q35,60 48,64 Q62,60 76,66" stroke="#52B788" stroke-width="4" fill="none" stroke-linecap="round" />
                <!-- Tomato & Egg -->
                <rect x="30" y="52" width="22" height="6" fill="#E63946" />
                <circle cx="62" cy="55" r="5" fill="#FFB703" />
              </svg>

              <!-- Pastry / Brownies -->
              <svg v-else-if="getItemType(fav) === 'pastry'" viewBox="0 0 100 100" class="fav-svg-art">
                <rect x="0" y="0" width="100" height="100" fill="#2C4A3E" />
                <!-- Brownies square -->
                <rect x="25" y="34" width="50" height="40" fill="#3D2314" stroke="#FAF7F2" stroke-width="2" />
                <!-- Chocolate drizzle -->
                <path d="M28,42 Q40,36 50,42 Q62,38 72,44" stroke="#D9886A" stroke-width="3" fill="none" stroke-linecap="round" />
                <!-- Skewer / Stick -->
                <line x1="50" y1="74" x2="50" y2="92" stroke="#C89666" stroke-width="3" stroke-linecap="round" />
              </svg>

              <!-- Hot Coffee Default -->
              <svg v-else viewBox="0 0 100 100" class="fav-svg-art">
                <rect x="0" y="0" width="100" height="100" fill="#2C4A3E" />
                <!-- Cup -->
                <path d="M24,38 L76,38 L68,78 L32,78 Z" fill="#FAF7F2" stroke="#FAF7F2" stroke-width="2" />
                <ellipse cx="50" cy="38" rx="26" ry="7" fill="#4A2810" stroke="#FAF7F2" stroke-width="1.5" />
                <!-- Handle -->
                <path d="M72,44 Q86,44 86,56 Q86,68 68,68" fill="none" stroke="#FAF7F2" stroke-width="3" />
                <!-- Steam -->
                <path d="M44,28 Q40,20 44,14" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" opacity="0.8" />
                <path d="M56,26 Q60,18 56,12" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" opacity="0.8" />
              </svg>

              <span class="fav-badge name-tag-peach font-mono">FAVORIT</span>
            </div>

            <!-- Card Bottom Info -->
            <div class="fav-info">
              <h4 class="fav-name font-mono">{{ fav.name }}</h4>
              <div class="fav-bottom-row">
                <span class="fav-price font-mono">{{ formatRupiah(fav.price) }}</span>
                <button 
                  type="button" 
                  class="fav-add-btn" 
                  :disabled="fav.is_available === false"
                  @click.stop="handleAdd(fav)"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. MAIN 50/50 SPLIT CATALOG -->
    <section class="split-catalog-section">
      <!-- Left 50%: Rich Artisan Poster with "MENU KAMI" -->
      <div class="catalog-left-sticky">
        <div class="poster-inner">
          <div class="poster-badge-top">
            <span class="category-pill-tag font-mono">KATEGORI: {{ selectedCategory }}</span>
          </div>

          <h1 class="heading-display catalog-display-title">MENU KAMI</h1>

          <!-- Central Artisan Coffee Illustration -->
          <div class="poster-illustration-box">
            <svg viewBox="0 0 300 360" class="poster-art-svg">
              <!-- Frame border -->
              <rect x="10" y="10" width="280" height="340" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-dasharray="8,6" opacity="0.4" />
              
              <!-- Giant Coffee Cup Artwork -->
              <g transform="translate(60, 90)">
                <ellipse cx="90" cy="50" rx="80" ry="22" fill="#FAF7F2" opacity="0.12" />
                <path d="M15,50 Q20,180 90,180 Q160,180 165,50 Z" fill="#F0EAE1" stroke="#FAF7F2" stroke-width="3" />
                <ellipse cx="90" cy="50" rx="72" ry="18" fill="#4A2E1B" stroke="#FAF7F2" stroke-width="2.5" />
                <ellipse cx="90" cy="50" rx="50" ry="10" fill="#D9886A" opacity="0.8" />
                <!-- Handle -->
                <path d="M160,65 C200,65 200,145 155,145" fill="none" stroke="#FAF7F2" stroke-width="5" stroke-linecap="round" />
                <!-- Steam -->
                <path d="M75,25 Q65,-2 75,-25" fill="none" stroke="#FAF7F2" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />
                <path d="M100,20 Q112,-8 100,-30" fill="none" stroke="#FAF7F2" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />
              </g>

              <!-- Bottom Tag -->
              <rect x="30" y="295" width="240" height="36" fill="#FAF7F2" stroke="#2C4A3E" stroke-width="2" />
              <text x="150" y="318" fill="#2C4A3E" font-family="'Permanent Marker', cursive" font-size="14" text-anchor="middle">BIJI KOPI PILIHAN</text>
            </svg>
          </div>

          <div class="poster-footer-notes font-mono">
            <span>&bull; BIJI KOPI PILIHAN LOKAL</span>
            <span>&bull; DIRACIK FRESH SETIAP HARI</span>
          </div>
        </div>
      </div>

      <!-- Right 50%: Solid Sand Panel with Search, Segmented Tabs & 2-Col List -->
      <div class="catalog-right-panel">
        <div class="panel-inner">
          <!-- Outlined Search Box -->
          <div class="search-box-wrap">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="CARI MENU (MISAL: ES KOPI SUSU, CROISSANT)..." 
              class="tuku-search-input font-mono"
            />
          </div>

          <!-- Segmented Control Tabs (Square touching boxes) -->
          <div class="categories-tab-bar">
            <div class="segmented-tabs">
              <button 
                v-for="cat in availableCategories" 
                :key="cat"
                type="button"
                class="segmented-tab"
                :class="{ 'is-active': selectedCategory === cat }"
                @click="selectedCategory = cat"
              >
                {{ cat }}
              </button>
            </div>
          </div>

          <!-- 2-Column Internal Scrollable Menu List -->
          <div class="menu-items-scroll-area">
            <div v-if="filteredMenuItems.length === 0" class="empty-state font-mono">
              TIDAK ADA MENU YANG COCOK DENGAN PENCARIAN.
            </div>

            <div v-else class="menu-items-grid">
              <div 
                v-for="item in filteredMenuItems" 
                :key="item.id"
                class="menu-row-card"
                :class="{ 'is-unavailable': item.is_available === false }"
                @click="selectItem(item)"
              >
                <!-- Thumbnail square with category-specific icon -->
                <div class="item-thumb-box">
                  <!-- Cold coffee -->
                  <svg v-if="getItemType(item) === 'cold-coffee'" viewBox="0 0 60 60" class="item-mini-svg">
                    <rect width="60" height="60" fill="#2C4A3E" />
                    <polygon points="18,12 42,12 38,48 22,48" fill="#FAF7F2" stroke="#FAF7F2" stroke-width="1.5" />
                    <rect x="20" y="20" width="20" height="12" fill="#5C3B1E" />
                    <rect x="22" y="32" width="16" height="15" fill="#E6D7C3" />
                  </svg>
                  <!-- Sandwich -->
                  <svg v-else-if="getItemType(item) === 'sandwich'" viewBox="0 0 60 60" class="item-mini-svg">
                    <rect width="60" height="60" fill="#2C4A3E" />
                    <polygon points="12,42 48,42 30,16" fill="#D9A066" stroke="#FAF7F2" stroke-width="1.5" />
                    <line x1="14" y1="38" x2="46" y2="38" stroke="#52B788" stroke-width="2.5" />
                  </svg>
                  <!-- Pastry -->
                  <svg v-else-if="getItemType(item) === 'pastry'" viewBox="0 0 60 60" class="item-mini-svg">
                    <rect width="60" height="60" fill="#2C4A3E" />
                    <rect x="15" y="20" width="30" height="24" fill="#3D2314" stroke="#FAF7F2" stroke-width="1.5" />
                    <line x1="30" y1="44" x2="30" y2="54" stroke="#C89666" stroke-width="2" />
                  </svg>
                  <!-- Hot Coffee Default -->
                  <svg v-else viewBox="0 0 60 60" class="item-mini-svg">
                    <rect width="60" height="60" fill="#2C4A3E" />
                    <path d="M15,22 L45,22 L40,46 L20,46 Z" fill="#FAF7F2" stroke="#FAF7F2" stroke-width="1.5" />
                    <path d="M42,26 Q50,26 50,34 Q50,42 40,42" fill="none" stroke="#FAF7F2" stroke-width="2" />
                  </svg>

                  <span v-if="item.is_available === false" class="badge-habis font-mono">
                    HABIS
                  </span>
                </div>

                <!-- Info Column -->
                <div class="item-body">
                  <div class="item-header-row">
                    <span class="item-name font-mono" :class="{ 'strikethrough': item.is_available === false }">
                      {{ item.name }}
                      <span v-if="item.is_bundle" class="bundle-tag">PAKET</span>
                    </span>
                  </div>
                  <p v-if="item.is_bundle" class="item-bundle-contents">Isi: {{ bundleContentsLabel(item.bundle_items, store.menuItems) }}</p>
                  <p v-if="parseVariants(item.variants).length > 0" class="item-variants-line">Varian: {{ variantsLabel(item.variants) }}</p>
                  <div class="item-dashed-line"></div>
                  <div class="item-footer-row">
                    <span class="item-price font-mono">{{ formatRupiah(item.price) }}</span>
                    <span v-if="item.is_bundle && bundleSaveInfo(item).savings > 0" class="save-pill">Hemat {{ formatRupiah(bundleSaveInfo(item).savings) }}</span>

                    <!-- Stepper or Add button -->
                    <div class="stepper-action">
                      <div v-if="getItemQty(item.id) > 0" class="stepper-box">
                        <button 
                          type="button" 
                          class="stepper-btn" 
                          @click.stop="handleRemove(item)"
                        >
                          &minus;
                        </button>
                        <span class="stepper-qty font-mono">{{ getItemQty(item.id) }}</span>
                        <button 
                          type="button" 
                          class="stepper-btn" 
                          :disabled="item.is_available === false"
                          @click.stop="handleAdd(item)"
                        >
                          +
                        </button>
                      </div>
                      <button 
                        v-else 
                        type="button" 
                        class="btn-add-outlined" 
                        :disabled="item.is_available === false"
                        @click.stop="handleAdd(item)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Caption for Selected Menu Description -->
          <div class="panel-bottom-caption font-mono">
            <div v-if="selectedItemForCaption" class="caption-content">
              <span class="caption-label">DETAIL: {{ selectedItemForCaption.name }}</span>
              <p class="caption-desc">
                {{ selectedItemForCaption.description || 'Racikan istimewa barista dengan bahan baku segar berkualitas.' }}
              </p>
            </div>
            <div v-else class="caption-placeholder">
              PILIH MENU UNTUK MELIHAT DESKRIPSI &bull; HARGA NETT TERMASUK PAJAK
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal pilih varian (menu bervarian) -->
    <div v-if="activeItemForNote" class="variant-modal-backdrop" @click.self="closeNoteModal">
      <div class="variant-modal-card">
        <div class="variant-modal-header">
          <h3 class="variant-modal-title">{{ activeItemForNote.name }}</h3>
          <button type="button" class="variant-modal-close" @click="closeNoteModal">&times;</button>
        </div>
        <p class="variant-modal-price">{{ formatRupiah(activeItemForNote.price) }}</p>

        <div v-if="parseVariants(activeItemForNote.variants).length > 0" class="variant-modal-group">
          <label class="variant-modal-label">Varian (boleh pilih lebih dari satu)</label>
          <div class="variant-pick-list">
            <button
              v-for="v in parseVariants(activeItemForNote.variants)"
              :key="v.name"
              type="button"
              class="variant-chip"
              :class="{ active: itemVariantsInput.includes(v.name) }"
              @click="toggleModalVariant(v.name)"
            >
              <span class="variant-check">{{ itemVariantsInput.includes(v.name) ? '✓' : '' }}</span>
              <span>{{ v.name }}</span>
              <span class="variant-price">{{ v.price > 0 ? `+${formatRupiah(v.price)}` : 'Gratis' }}</span>
            </button>
          </div>
          <p v-if="modalVariantExtra() > 0" class="variant-modal-hint">
            Tambahan varian: {{ formatRupiah(modalVariantExtra()) }} per porsi.
          </p>
        </div>

        <div class="variant-modal-group">
          <label class="variant-modal-label" for="ms-note">Instruksi Khusus (Opsional)</label>
          <textarea id="ms-note" v-model="itemNoteInput" rows="2" class="variant-modal-textarea" placeholder="Misal: less ice, normal sugar..."></textarea>
        </div>

        <button type="button" class="variant-modal-submit" @click="confirmAddWithNote">
          TAMBAH KE PESANAN
        </button>
      </div>
    </div>

    <!-- 3. Floating Cart Bar at bottom -->
    <div v-if="store.cartCount > 0" class="floating-cart-bar">
      <div class="cart-bar-inner">
        <div class="cart-bar-meta font-mono">
          <span class="cart-bar-qty">{{ store.cartCount }} PORSI</span>
          <span class="cart-bar-dot">&bull;</span>
          <span class="cart-bar-total">{{ formatRupiah(store.grandTotal) }}</span>
        </div>
        <button 
          type="button" 
          class="btn-cart-cta" 
          @click="router.push('/pesanan')"
        >
          LIHAT PESANAN &rarr;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-page-wrapper {
  position: relative;
  background-color: var(--color-sand);
}

/* 1. Favorit Section */
.favorit-section {
  background-color: #FDF2EE;
  border-bottom: 2px solid var(--color-primary);
  padding: 2.5rem 0 3rem;
}

.favorit-container {
  max-width: 1200px;
}

.favorit-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 12px;
}

.favorit-title {
  font-size: clamp(1.8rem, 3.2vw, 2.4rem);
  color: var(--color-primary);
}

.favorit-hint {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--color-peach);
}

.favorit-carousel {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  scrollbar-width: thin;
}

.fav-card {
  flex: 0 0 240px;
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.fav-card:hover {
  transform: translateY(-3px);
}

.fav-img-box {
  position: relative;
  width: 100%;
  height: 160px;
  background-color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
  overflow: hidden;
}

.fav-svg-art {
  width: 100%;
  height: 100%;
  display: block;
}

.fav-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 9px;
  padding: 2px 6px;
  border: 1.5px solid var(--color-primary);
}

.fav-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fav-name {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fav-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fav-price {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
}

.fav-add-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: 2px solid var(--color-primary);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.fav-add-btn:hover:not(:disabled) {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

/* 2. 50/50 Split Layout */
.split-catalog-section {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  min-height: 85vh;
  border-bottom: 2px solid var(--color-primary);
}

/* Left Sticky Side */
.catalog-left-sticky {
  position: sticky;
  top: 54px;
  height: calc(100vh - 54px);
  background-color: #2C4A3E;
  border-right: 2px solid var(--color-primary);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.poster-inner {
  height: 100%;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.poster-badge-top {
  display: flex;
}

.category-pill-tag {
  background-color: var(--color-peach);
  color: var(--color-primary);
  border: 2px solid var(--color-cream);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.catalog-display-title {
  font-size: clamp(2.5rem, 4.2vw, 3.8rem);
  color: var(--color-cream);
  line-height: 0.95;
  margin: 0.5rem 0;
}

.poster-illustration-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 380px;
}

.poster-art-svg {
  width: 85%;
  height: 85%;
  max-width: 320px;
}

.poster-footer-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--color-sage-soft);
  opacity: 0.85;
}

/* Right Sand Panel */
.catalog-right-panel {
  background-color: var(--color-sand);
  display: flex;
  flex-direction: column;
}

.panel-inner {
  padding: 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-box-wrap {
  margin-bottom: 1.25rem;
}

.tuku-search-input {
  width: 100%;
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  padding: 12px 16px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.categories-tab-bar {
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 4px;
}

/* Internal Scroll Area for 2-column menu */
.menu-items-scroll-area {
  flex: 1;
  max-height: 60vh;
  min-height: 360px;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 1.5rem;
}

.menu-items-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.menu-row-card {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 10px;
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.menu-row-card:hover {
  background-color: #FAF7F2;
}

.menu-row-card.is-unavailable {
  opacity: 0.55;
  background-color: #EFEFEF;
}

.item-thumb-box {
  position: relative;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  border: 1.5px solid var(--color-primary);
  background-color: var(--color-primary);
  overflow: hidden;
}

.item-mini-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.badge-habis {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(217, 48, 37, 0.88);
  color: #FFFFFF;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
}

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.item-name {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.strikethrough {
  text-decoration: line-through;
}

.item-dashed-line {
  border-bottom: 1px dashed var(--color-primary-2);
  width: 100%;
}

.item-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-price {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
}

/* Stepper & Add Button */
.btn-add-outlined {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-white);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.btn-add-outlined:hover:not(:disabled) {
  background-color: var(--color-peach);
}

.stepper-box {
  display: inline-flex;
  border: 1.5px solid var(--color-primary);
}

.stepper-btn {
  width: 24px;
  height: 24px;
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: none;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover:not(:disabled) {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

.stepper-qty {
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  background-color: var(--color-white);
  color: var(--color-primary);
}

/* Panel bottom caption */
.panel-bottom-caption {
  border-top: 2px solid var(--color-primary);
  padding-top: 1rem;
  font-size: 11px;
  color: var(--color-primary-2);
}

.caption-label {
  font-weight: 800;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 4px;
}

.caption-desc {
  font-family: var(--font-family);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.caption-placeholder {
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #7A726A;
}

/* 3. Floating Cart Bar */
.floating-cart-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  width: min(92%, 520px);
}

.cart-bar-inner {
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: none;
}

.cart-bar-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-primary);
}

.cart-bar-qty {
  background-color: var(--color-peach);
  color: var(--color-primary);
  padding: 3px 8px;
  border: 1.5px solid var(--color-primary);
  font-size: 11px;
}

.btn-cart-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: 2px solid var(--color-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.btn-cart-cta:hover {
  background-color: var(--color-peach);
  color: var(--color-primary);
}

@media (max-width: 960px) {
  .split-catalog-section {
    grid-template-columns: 1fr;
  }
  .catalog-left-sticky {
    position: relative;
    top: 0;
    height: 38vh;
    border-right: none;
    border-bottom: 2px solid var(--color-primary);
  }
  .panel-inner {
    padding: 1.5rem 1rem;
  }
  .menu-items-grid {
    grid-template-columns: 1fr;
  }
}

/* Bundle & varian pada kartu menu */
.bundle-tag {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  background-color: var(--color-primary);
  border-radius: 999px;
  padding: 1px 6px;
  margin-left: 6px;
  vertical-align: middle;
}

.item-bundle-contents {
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--color-primary);
  background-color: var(--color-primary-soft, #F0EAE1);
  border-radius: 4px;
  padding: 4px 8px;
  margin: 4px 0;
}

.item-variants-line {
  font-size: 0.72rem;
  color: var(--color-primary-2, #2C4A3E);
  margin: 2px 0 6px;
  opacity: 0.85;
}

.save-pill {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  color: #FFFFFF;
  background-color: #C05621;
  border-radius: 999px;
  padding: 2px 8px;
  margin-left: 6px;
}

/* Modal pilih varian */
.variant-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 1rem;
}

.variant-modal-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.variant-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.variant-modal-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--color-primary);
  margin: 0;
}

.variant-modal-close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-primary);
}

.variant-modal-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
}

.variant-modal-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.variant-modal-label {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.variant-pick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.variant-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1.5px solid var(--color-primary);
  background: var(--color-white);
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--color-primary);
}

.variant-chip.active {
  background-color: var(--color-peach);
  font-weight: 700;
}

.variant-check {
  width: 12px;
  color: var(--color-primary);
  font-weight: 800;
}

.variant-price {
  font-size: 0.72rem;
  opacity: 0.75;
}

.variant-modal-hint {
  font-size: 0.75rem;
  color: var(--color-primary-2, #2C4A3E);
  margin: 0;
}

.variant-modal-textarea {
  width: 100%;
  border: 2px solid var(--color-primary);
  padding: 8px 10px;
  font-size: 0.85rem;
  resize: vertical;
}

.variant-modal-submit {
  background-color: var(--color-primary);
  color: var(--color-cream);
  border: 2px solid var(--color-primary);
  padding: 10px 14px;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
</style>
