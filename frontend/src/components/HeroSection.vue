<script setup>
import { computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import HeroScene from '@/components/HeroScene.vue'

const store = useOrderStore()

const isPreorder = computed(() => store.activeMode === 'preorder')
const batch = computed(() => store.activeBatch)

function formatDateTime(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function scrollToCatalog() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  // Prioritaskan daftar menu / area pencarian (melewati menu favorit)
  const el = isMobile
    ? (document.getElementById('daftar-menu') || document.getElementById('search-box-wrap') || document.getElementById('katalog-section'))
    : (document.getElementById('katalog-section') || document.getElementById('daftar-menu'))
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <section class="tuku-hero-section">
    <!-- 1. Atmospheric Cafe Outlet Background -->
    <div class="hero-bg-media">
      <img 
        src="/hero-outlet.svg" 
        alt="Suasana Kedai SIKopi" 
        class="outlet-photo"
      />
      <div class="hero-dark-overlay"></div>
    </div>

    <!-- 2. Interactive Cursor-Driven Barista & Hotspots Scene (z-index: 5) -->
    <HeroScene />

    <!-- 3. Foreground UI: Signboards, Center Button, and Mode Banner -->
    <div class="hero-foreground-ui">
      <!-- Fixed Signboards matching Tuku: PESAN DI SINI (left) & AMBIL DI SINI (right) -->
      <div class="signboard signboard-left">
        <span class="sign-text">PESAN DI SINI</span>
      </div>
      <div class="signboard signboard-right">
        <span class="sign-text">AMBIL DI SINI</span>
      </div>

      <!-- Center CTA Button: LIHAT MENU -->
      <div class="hero-center-cta">
        <button 
          type="button" 
          class="btn-lihat-menu font-mono" 
          @click="scrollToCatalog"
        >
          LIHAT MENU &darr;
        </button>
      </div>

      <!-- Mode Banner (Read-only Info) -->
      <div class="hero-mode-banner">
        <!-- Pre-order Mode -->
        <div v-if="isPreorder && batch" class="mode-info-tag font-mono">
          <span class="mode-title-tag">MODE: OPEN PO</span>
          <span class="mode-detail">BATCH: {{ batch.name }}</span>
          <span v-if="formatDateTime(batch.orderDeadline)" class="mode-detail">
            BATAS: {{ formatDateTime(batch.orderDeadline) }}
          </span>
          <span v-if="formatDateTime(batch.pickupDate)" class="mode-detail">
            AMBIL: {{ formatDateTime(batch.pickupDate) }}
          </span>
        </div>
        <div v-else-if="isPreorder && !batch" class="mode-info-tag font-mono">
          <span class="mode-title-tag">MODE: OPEN PO</span>
          <span class="mode-detail">Open PO belum dibuka</span>
        </div>

        <!-- On-Site / POS Mode -->
        <div v-else class="mode-info-tag font-mono">
          <span class="mode-title-tag">MODE: HARI JUALAN</span>
          <span class="mode-detail">KEDAI MELAYANI LANGSUNG DI MEJA BARISTA &bull; KABAR SELESAI VIA WHATSAPP</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tuku-hero-section {
  position: relative;
  width: 100%;
  height: clamp(520px, 75vh, 740px);
  overflow: hidden;
  border-bottom: 2px solid var(--color-primary);
  background-color: #1A1512;
}

.hero-bg-media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.outlet-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-dark-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(28, 45, 37, 0.3);
  pointer-events: none;
}

/* Foreground UI elements */
.hero-foreground-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem 2rem 1.25rem;
}

/* Signboards: solid black box with white text */
.signboard {
  position: absolute;
  top: 24px;
  background-color: var(--color-primary);
  border: 2px solid var(--color-cream);
  padding: 6px 14px;
  box-shadow: none;
  pointer-events: all;
}

.signboard-left {
  left: 2rem;
}

.signboard-right {
  right: 2rem;
}

.sign-text {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-cream);
  font-weight: 800;
  line-height: 1;
}

/* Center CTA */
.hero-center-cta {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: all;
}

.btn-lihat-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background-color: var(--color-cream);
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 140ms ease;
}

.btn-lihat-menu:hover {
  background-color: var(--color-peach);
  color: var(--color-primary);
  transform: translateY(-2px);
}

/* Mode Banner Info at bottom */
.hero-mode-banner {
  position: absolute;
  bottom: 14px;
  left: 2rem;
  right: 2rem;
  display: flex;
  justify-content: center;
  pointer-events: all;
}

.mode-info-tag {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background-color: var(--color-sand);
  border: 2px solid var(--color-primary);
  padding: 5px 12px;
  font-size: 11px;
  color: var(--color-primary);
}

.mode-title-tag {
  background-color: var(--color-primary);
  color: var(--color-cream);
  padding: 2px 6px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.mode-detail {
  font-weight: 700;
}

@media (max-width: 768px) {
  .tuku-hero-section {
    height: 60vh;
    min-height: 480px;
  }
  .signboard {
    top: 14px;
    padding: 4px 8px;
  }
  .signboard-left {
    left: 1rem;
  }
  .signboard-right {
    right: 1rem;
  }
  .hero-center-cta {
    bottom: 78px;
  }
  .btn-lihat-menu {
    padding: 10px 22px;
    font-size: 12px;
    animation: ctaBounceMobile 1.6s ease-in-out infinite;
  }
  .hero-mode-banner {
    bottom: 12px;
    left: 0.75rem;
    right: 0.75rem;
  }
  .mode-info-tag {
    font-size: 10px;
    padding: 4px 8px;
    justify-content: center;
  }
}

@keyframes ctaBounceMobile {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
</style>
