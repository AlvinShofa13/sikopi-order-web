<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { isCustomImage } from '@/utils/format'
import AppIcon from '@/components/icons/AppIcon.vue'

const store = useOrderStore()
const route = useRoute()

const isMobileMenuOpen = ref(false)
const cartCount = computed(() => store.cartCount)
const isCurrent = (path) => route.path === path

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

function handleClearSession() {
  store.clearCustomerSession()
  closeMobileMenu()
}

function handleOpenAuth() {
  store.openAuthModal()
  closeMobileMenu()
}

// Tutup menu otomatis setiap rute berpindah
watch(() => route.fullPath, () => {
  isMobileMenuOpen.value = false
})

// Kunci scroll body saat menu mobile aktif agar rapi
watch(isMobileMenuOpen, (isOpen) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
})

function handleResize() {
  if (typeof window !== 'undefined' && window.innerWidth > 768 && isMobileMenuOpen.value) {
    isMobileMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <header class="navbar-wrapper">
    <div class="container navbar-inner">
      <!-- Brand Logo -->
      <RouterLink to="/menu" class="brand-link" @click="closeMobileMenu">
        <span class="brand-icon-box">
          <img v-if="isCustomImage(store.brandIcon)" :src="api.fileUrl(store.brandIcon)" alt="Logo" class="brand-icon-img" />
          <AppIcon v-else :name="store.brandIcon || 'leaf'" :size="20" stroke-width="2" />
        </span>
        <div class="brand-text">
          <span class="brand-name">{{ store.brandName || 'SIKopi' }}</span>
        </div>
      </RouterLink>

      <!-- Center Navigation Links (Desktop Only) -->
      <nav class="nav-links desktop-only">
        <RouterLink 
          to="/menu" 
          class="nav-link"
          :class="{ 'is-active': isCurrent('/menu') }"
        >
          Pilihan Menu
        </RouterLink>
        <RouterLink 
          to="/pesanan" 
          class="nav-link"
          :class="{ 'is-active': isCurrent('/pesanan') }"
        >
          Daftar Pesanan
        </RouterLink>
      </nav>

      <!-- Right Action: User Status, Cart, & Mobile Hamburger -->
      <div class="nav-actions">
        <!-- Desktop Customer Session Chip -->
        <div v-if="store.customerSession.isVerified" class="nav-user-chip desktop-only" title="Pelanggan Terverifikasi">
          <AppIcon name="user" :size="14" />
          <span class="user-chip-name">{{ store.customerSession.name }}</span>
          <span class="user-chip-tag">#{{ store.customerSession.token }}</span>
          <button 
            type="button" 
            class="btn-chip-clear" 
            @click="handleClearSession"
            title="Ganti nama atau token"
            aria-label="Ganti pengguna"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>

        <!-- Desktop Auth Trigger Button -->
        <button 
          v-else 
          type="button" 
          class="btn-nav-auth desktop-only" 
          @click="handleOpenAuth"
          title="Masukkan nama dan token 3 digit"
        >
          <AppIcon name="user" :size="15" />
          <span>Masuk / Token</span>
        </button>

        <!-- Mobile Quick Token Pill (Mobile Only - Ringkas & Rapi) -->
        <div 
          v-if="store.customerSession.isVerified" 
          class="mobile-token-pill mobile-only" 
          @click="toggleMobileMenu"
          title="Klik untuk info sesi pelanggan"
        >
          <AppIcon name="user" :size="13" />
          <span class="mobile-token-text">#{{ store.customerSession.token }}</span>
        </div>

        <!-- Mobile Auth Trigger (Mobile Only) -->
        <button 
          v-else 
          type="button" 
          class="mobile-btn-auth mobile-only" 
          @click="handleOpenAuth"
          title="Masukkan token 3 digit"
        >
          <AppIcon name="user" :size="13" />
          <span>Token</span>
        </button>

        <!-- Cart Button -->
        <RouterLink to="/pesanan" class="cart-button" title="Lihat Keranjang Pesanan" @click="closeMobileMenu">
          <AppIcon name="bag" :size="19" stroke-width="1.8" />
          <span class="cart-label desktop-only">Pesanan</span>
          <span v-if="cartCount > 0" class="cart-counter">
            {{ cartCount }}
          </span>
        </RouterLink>

        <!-- Mobile Hamburger Toggle Button (Mobile Only) -->
        <button 
          type="button" 
          class="btn-hamburger mobile-only" 
          :class="{ 'is-open': isMobileMenuOpen }"
          @click="toggleMobileMenu" 
          :aria-expanded="isMobileMenuOpen"
          aria-label="Buka navigasi menu"
        >
          <AppIcon :name="isMobileMenuOpen ? 'close' : 'menu'" :size="20" />
        </button>
      </div>
    </div>
  </header>

  <!-- Teleport ke body untuk menghindari stacking-context backdrop-filter navbar -->
  <Teleport to="body">
    <Transition name="fade-slide">
      <div v-if="isMobileMenuOpen" class="mobile-menu-portal">
        <div class="mobile-menu-backdrop" @click="closeMobileMenu"></div>
        <div class="mobile-menu-sheet">
          <!-- Customer Session Status Card -->
          <div v-if="store.customerSession.isVerified" class="mobile-user-card">
            <div class="user-card-header">
              <div class="user-avatar-circle">
                <AppIcon name="user" :size="18" />
              </div>
              <div class="user-info-text">
                <span class="user-greeting">Pelanggan Terverifikasi</span>
                <strong class="user-fullname">{{ store.customerSession.name }}</strong>
              </div>
              <span class="user-token-badge">Token: #{{ store.customerSession.token }}</span>
            </div>
            <button 
              type="button" 
              class="btn-mobile-reset-session" 
              @click="handleClearSession"
            >
              <AppIcon name="close" :size="13" />
              <span>Ganti Nama / Token Pelanggan</span>
            </button>
          </div>

          <div v-else class="mobile-user-card guest-card">
            <div class="guest-card-body">
              <div class="guest-badge-row">
                <span class="guest-status-dot"></span>
                <span class="guest-title">Belum Memasukkan Token</span>
              </div>
              <p class="guest-desc">Masukkan nama dan token 3 digit yang diberikan oleh kasir untuk mulai memesan hidangan.</p>
              <button type="button" class="btn-mobile-auth" @click="handleOpenAuth">
                <AppIcon name="user" :size="14" />
                <span>Masukkan Nama & Token</span>
              </button>
            </div>
          </div>

          <!-- Navigation Links List -->
          <nav class="mobile-nav-list">
            <RouterLink 
              to="/menu" 
              class="mobile-nav-link" 
              :class="{ 'is-active': isCurrent('/menu') }"
              @click="closeMobileMenu"
            >
              <span class="nav-icon-wrap">
                <AppIcon name="leaf" :size="18" />
              </span>
              <div class="nav-text-col">
                <span class="nav-title">Pilihan Menu Hidangan</span>
                <span class="nav-sub">Kopi arabika & santapan bernutrisi</span>
              </div>
              <AppIcon name="arrow-right" :size="16" class="nav-arrow" />
            </RouterLink>

            <RouterLink 
              to="/pesanan" 
              class="mobile-nav-link" 
              :class="{ 'is-active': isCurrent('/pesanan') }"
              @click="closeMobileMenu"
            >
              <span class="nav-icon-wrap">
                <AppIcon name="bag" :size="18" />
              </span>
              <div class="nav-text-col">
                <span class="nav-title">Keranjang & Status Pesanan</span>
                <span class="nav-sub">Periksa pesanan & lanjut ke kasir</span>
              </div>
              <span v-if="cartCount > 0" class="mobile-cart-badge">
                {{ cartCount }} item
              </span>
              <AppIcon v-else name="arrow-right" :size="16" class="nav-arrow" />
            </RouterLink>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.navbar-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 1000;
  background-color: rgba(250, 248, 245, 0.96);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border-light);
  transition: background-color 0.2s ease;
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}

/* Brand */
.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-primary);
  text-decoration: none;
  flex-shrink: 0;
}

.brand-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  overflow: hidden;
}

.brand-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--color-primary);
}

/* Desktop Navigation Links */
.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-link {
  position: relative;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: 6px 0;
  transition: color 0.2s ease;
  text-decoration: none;
}

.nav-link:hover {
  color: var(--color-primary);
}

.nav-link.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.nav-link.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
}

/* Actions Section */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Desktop Cart Button */
.cart-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  color: var(--color-primary);
  font-size: 0.88rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.cart-button:hover {
  background-color: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.cart-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background-color: var(--color-primary);
  color: var(--bg-surface);
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius-full);
}

/* Desktop User Session Chip */
.nav-user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
}

.user-chip-name {
  max-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-chip-tag {
  font-family: monospace;
  font-size: 0.75rem;
  background-color: #FFFFFF;
  color: var(--color-primary);
  padding: 1px 5px;
  border-radius: 4px;
}

.btn-chip-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background-color: transparent;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 2px;
}

.btn-chip-clear:hover {
  background-color: rgba(44, 62, 45, 0.15);
}

/* Desktop Auth Button */
.btn-nav-auth {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  background-color: transparent;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-nav-auth:hover {
  border-color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

/* Mobile-Only Elements Visibility (Hidden on Desktop) */
.mobile-only {
  display: none !important;
}

.desktop-only {
  display: inline-flex;
}
nav.desktop-only {
  display: flex;
}

/* ================= MOBILE RESPONSIVE STYLES ================= */
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: inline-flex !important;
  }

  .navbar-inner {
    height: 60px;
    padding: 0 1rem;
  }

  .brand-icon-box {
    width: 32px;
    height: 32px;
  }

  .brand-name {
    font-size: 1.1rem;
  }

  .nav-actions {
    gap: 0.5rem;
  }

  /* Compact Mobile Token Pill */
  .mobile-token-pill {
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background-color: var(--color-primary-soft);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid rgba(44, 62, 45, 0.1);
  }

  .mobile-btn-auth {
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background-color: transparent;
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-full);
    color: var(--color-primary);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  /* Compact Cart Button on Mobile */
  .cart-button {
    padding: 6px 10px;
    min-width: 36px;
    height: 36px;
    justify-content: center;
    border-radius: var(--radius-full);
  }

  .cart-counter {
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    font-size: 0.7rem;
  }

  /* Mobile Hamburger Button */
  .btn-hamburger {
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-full);
    color: var(--color-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-hamburger:hover, .btn-hamburger.is-open {
    background-color: var(--color-primary-soft);
    border-color: var(--color-primary);
  }
}

/* ================= TELEPORTED MOBILE MENU PORTAL ================= */
.mobile-menu-portal {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

@media (min-width: 769px) {
  .mobile-menu-portal {
    display: none !important;
  }
}

.mobile-menu-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(18, 25, 19, 0.45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.mobile-menu-sheet {
  position: relative;
  z-index: 2;
  background-color: #FFFFFF;
  border-bottom: 2px solid var(--border-medium);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16);
  padding: 1.25rem 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: calc(100vh - 75px);
  overflow-y: auto;
}

/* Customer Card in Drawer */
.mobile-user-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-greeting {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.user-fullname {
  font-size: 0.92rem;
  color: var(--color-charcoal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-token-badge {
  font-family: monospace;
  font-size: 0.8rem;
  font-weight: 700;
  background-color: var(--color-primary);
  color: #FFFFFF;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.btn-mobile-reset-session {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-mobile-reset-session:hover {
  border-color: #EF4444;
  color: #EF4444;
}

/* Guest Card */
.guest-card {
  background-color: #F8FAF9;
  border: 1px dashed var(--border-medium);
}

.guest-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.guest-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.guest-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #F59E0B;
}

.guest-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.guest-desc {
  font-size: 0.74rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.btn-mobile-auth {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

/* Mobile Nav Links */
.mobile-nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background-color: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.2s ease;
}

.mobile-nav-link:hover {
  background-color: var(--color-primary-soft);
}

.mobile-nav-link.is-active {
  background-color: var(--color-primary-soft);
  border-color: rgba(44, 62, 45, 0.15);
}

.nav-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background-color: #FFFFFF;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.mobile-nav-link.is-active .nav-icon-wrap {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.nav-text-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nav-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-charcoal);
}

.mobile-nav-link.is-active .nav-title {
  color: var(--color-primary);
}

.nav-sub {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.nav-arrow {
  color: var(--border-medium);
}

.mobile-nav-link.is-active .nav-arrow {
  color: var(--color-primary);
}

.mobile-cart-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
}

.mobile-drawer-footer {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: center;
}

.mobile-admin-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background-color: var(--bg-surface);
  transition: all 0.2s;
}

.mobile-admin-link:hover {
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
