<script setup>
import { ref, computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'

const store = useOrderStore()
const route = useRoute()
const router = useRouter()
const isMobileMenuOpen = ref(false)

const cartCount = computed(() => store.cartCount)

function handleMenuClick(event) {
  isMobileMenuOpen.value = false
  if (route.path === '/' || route.path === '/menu') {
    event.preventDefault()
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
    const el = isMobile
      ? (document.getElementById('daftar-menu') || document.getElementById('search-box-wrap') || document.getElementById('katalog-section'))
      : (document.getElementById('katalog-section') || document.getElementById('daftar-menu'))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } else {
    router.push({ path: '/', hash: '#katalog-section' })
  }
}

function handleTrackClick() {
  isMobileMenuOpen.value = false
  const lastId = store.currentOrder?.orderId || (store.orderHistory && store.orderHistory[0]?.orderId)
  if (lastId) {
    router.push(`/konfirmasi/${lastId}`)
  } else {
    router.push('/konfirmasi/lacak')
  }
}
</script>

<template>
  <header class="tuku-header">
    <div class="header-inner-fluid">
      <!-- Left: Brand Logo & Wordmark aligned directly to the far left (red mark) -->
      <div class="brand-area">
        <RouterLink to="/" class="brand-link" title="Beranda SIKopi">
          <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <span class="brand-name">{{ store.brandName || 'SIKOPI' }}</span>
        </RouterLink>
      </div>

      <!-- Right: Desktop Navigation + Outlined Cart Pill -->
      <nav class="nav-desktop">
        <a href="#katalog-section" class="nav-item" @click="handleMenuClick">
          MENU
        </a>
        <RouterLink to="/pesanan" class="nav-item">
          PESANAN
        </RouterLink>
        <button type="button" class="nav-item nav-btn-link" @click="handleTrackClick">
          LACAK PESANAN
        </button>

        <!-- Cart Badge Outlined Box -->
        <RouterLink to="/pesanan" class="cart-box" :class="{ 'is-active': cartCount > 0 }" title="Keranjang Belanja">
          <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span class="cart-text">KERANJANG</span>
          <span class="cart-badge">{{ cartCount }}</span>
        </RouterLink>
      </nav>

      <!-- Mobile Hamburger Toggle -->
      <button 
        type="button" 
        class="mobile-toggle" 
        @click="isMobileMenuOpen = !isMobileMenuOpen" 
        aria-label="Toggle Menu"
      >
        <span class="burger-bar" :class="{ 'open-top': isMobileMenuOpen }"></span>
        <span class="burger-bar" :class="{ 'open-mid': isMobileMenuOpen }"></span>
        <span class="burger-bar" :class="{ 'open-bot': isMobileMenuOpen }"></span>
      </button>
    </div>

    <!-- Mobile Navigation Drawer -->
    <div v-if="isMobileMenuOpen" class="mobile-drawer">
      <a href="#katalog-section" class="mobile-nav-link" @click="handleMenuClick">
        MENU
      </a>
      <RouterLink to="/pesanan" class="mobile-nav-link" @click="isMobileMenuOpen = false">
        PESANAN ({{ cartCount }})
      </RouterLink>
      <button type="button" class="mobile-nav-link" @click="handleTrackClick">
        LACAK PESANAN
      </button>
    </div>
  </header>
</template>

<style scoped>
.tuku-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 54px;
  background-color: rgba(44, 74, 62, 0.96);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-bottom: 2px solid var(--color-primary);
  display: flex;
  align-items: center;
}

/* Fluid inner aligned to the viewport edges with comfortable padding */
.header-inner-fluid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 2rem;
  height: 100%;
}

.brand-area {
  display: flex;
  align-items: center;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--color-cream);
  transition: transform 0.15s ease;
}

.brand-link:hover {
  transform: scale(1.02);
}

.brand-icon {
  width: 22px;
  height: 22px;
  stroke: var(--color-cream);
}

.brand-name {
  font-family: var(--font-display);
  font-size: 1.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-cream);
  line-height: 1;
}

/* Nav Desktop */
.nav-desktop {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-item {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-cream);
  font-weight: 700;
  text-decoration: none;
  background: transparent;
  border: none;
  padding: 4px 0;
  transition: color 120ms ease;
  cursor: pointer;
}

.nav-btn-link {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-cream);
  font-weight: 700;
}

.nav-item:hover,
.nav-item.router-link-active {
  color: var(--color-peach);
}

/* Cart Outlined Box */
.cart-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border: 1.5px solid var(--color-cream);
  background-color: transparent;
  color: var(--color-cream);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}

.cart-box:hover {
  background-color: var(--color-peach);
  border-color: var(--color-peach);
  color: var(--color-primary);
}

.cart-box.is-active {
  border-color: var(--color-peach);
}

.cart-icon {
  width: 15px;
  height: 15px;
}

.cart-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-peach);
  color: var(--color-primary);
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
}

.cart-box:hover .cart-badge {
  background-color: var(--color-primary);
  color: var(--color-cream);
}

/* Mobile Toggle */
.mobile-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1.5px solid var(--color-cream);
  padding: 5px;
  cursor: pointer;
}

.burger-bar {
  display: block;
  width: 100%;
  height: 2px;
  background-color: var(--color-cream);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.mobile-drawer {
  position: absolute;
  top: 54px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary-2);
  padding: 12px 1.5rem;
  gap: 12px;
}

.mobile-nav-link {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-cream);
  font-weight: 700;
  text-decoration: none;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 0;
}

.mobile-nav-link:hover {
  color: var(--color-peach);
}

@media (max-width: 768px) {
  .header-inner-fluid {
    padding: 0 1rem;
  }
  .nav-desktop {
    display: none;
  }
  .mobile-toggle {
    display: flex;
  }
}
</style>
