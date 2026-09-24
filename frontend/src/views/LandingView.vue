<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

const featuredItems = computed(() => {
  return store.menuItems.filter(item => item.featured).slice(0, 3)
})

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

function handleAddToCart(item) {
  if (!store.customerSession.isVerified) {
    store.openAuthModal()
    return
  }
  store.addToCart(item)
}

function goToMenu() {
  if (!store.customerSession.isVerified) {
    store.openAuthModal()
    return
  }
  router.push('/menu')
}
</script>

<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container hero-grid">
        <div class="hero-text-content">
          <div v-if="store.customerSession.isVerified" class="hero-welcome-badge">
            <AppIcon name="user" :size="15" />
            <span>Halo, <strong>{{ store.customerSession.name }}</strong> (Token: <strong>{{ store.customerSession.token }}</strong>)</span>
          </div>

          <h1 class="hero-title">
            Kopi Sehat & Artisan Sandwich Alami, Diseduh Segar.
          </h1>

          <p class="hero-description">
            SIKopi menyajikan paduan kopi arabika pilihan dengan aneka hidangan bernutrisi dan seduhan segar.
            Bebas pemanis sintetis, bahan berkualitas, dan disetel Rp 1 untuk pengujian transaksi QRIS.
          </p>

          <div class="hero-cta-group">
            <button class="btn-primary" @click="goToMenu">
              <span>Pesan Menu Sekarang</span>
              <AppIcon name="arrow-right" :size="18" />
            </button>
            <RouterLink to="/token" class="btn-secondary" title="Dapatkan atau cek token 3 digit">
              <AppIcon name="shield-check" :size="16" />
              <span>Lihat Token (/token)</span>
            </RouterLink>
          </div>

          <div class="hero-commitments">
            <div class="commitment-pill">
              <AppIcon name="check" :size="15" class="accent-icon" />
              <span>100% Bahan Alami</span>
            </div>
            <div class="commitment-pill">
              <AppIcon name="check" :size="15" class="accent-icon" />
              <span>Semua Menu Rp 1</span>
            </div>
            <div class="commitment-pill">
              <AppIcon name="check" :size="15" class="accent-icon" />
              <span>QRIS Terkunci</span>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="visual-card">
            <img 
              src="https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80" 
              alt="Artisan Sourdough Sandwich dan Kopi" 
              class="hero-image"
            />
            <div class="visual-caption">
              <div class="caption-inner">
                <p class="caption-title">Avocado Egg Sourdough & Cold Brew</p>
                <p class="caption-meta">Nutrisi Segar · Rp 1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pillars / Nilai Kesehatan Section -->
    <section class="pillars-section">
      <div class="container">
        <div class="section-header text-center">
          <h2 class="section-title">Komitmen Kualitas & Cita Rasa Bersama SIKopi</h2>
          <p class="section-subtitle">
            Kualitas makanan terbaik berawal dari sumber bahan yang jujur dan teknik pengolahan yang menjaga nilai nutrisi utuh.
          </p>
        </div>

        <div class="pillars-grid">
          <div class="pillar-card">
            <div class="pillar-icon-box">
              <AppIcon name="shield-check" :size="24" />
            </div>
            <h3 class="pillar-heading">Pertanian Organik Lokal</h3>
            <p class="pillar-text">
              Bekerja sama langsung dengan petani lokal untuk memastikan sayuran dan rempah dipanen pada tingkat kesegaran tertinggi tanpa pestisida berbahaya.
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-box">
              <AppIcon name="leaf" :size="24" />
            </div>
            <h3 class="pillar-heading">Bebas Bahan Tambahan Buatan</h3>
            <p class="pillar-text">
              Kami tidak menggunakan penguat rasa sintetis, pewarna buatan, minyak jelantah, atau pemanis buatan dalam setiap menu yang kami sajikan.
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-box">
              <AppIcon name="sparkles" :size="24" />
            </div>
            <h3 class="pillar-heading">Makronutrisi Terukur</h3>
            <p class="pillar-text">
              Setiap menu dilengkapi perkiraan kalori, gram protein, dan lemak baik sehingga memudahkan Anda menjaga target kebugaran harian.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Menu Highlights -->
    <section class="featured-section">
      <div class="container">
        <div class="featured-header">
          <div>
            <h2 class="section-title">Menu Favorit Musim Ini</h2>
            <p class="section-subtitle">Pilihan terpopuler yang diracik segar oleh tim nutrisi kami.</p>
          </div>
          <RouterLink to="/menu" class="link-more">
            <span>Lihat Semua Menu</span>
            <AppIcon name="arrow-right" :size="16" />
          </RouterLink>
        </div>

        <div class="menu-grid">
          <div v-for="item in featuredItems" :key="item.id" class="food-card">
            <div class="card-image-box">
              <img :src="item.image" :alt="item.name" class="food-image" />
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span class="diet-label">{{ item.dietInfo }}</span>
                <span class="calorie-label">{{ item.calories }} kkal</span>
              </div>
              <h3 class="food-name">{{ item.name }}</h3>
              <p class="food-desc">{{ item.description }}</p>
              
              <div class="card-footer">
                <div class="food-price">{{ formatRupiah(item.price) }}</div>
                <button 
                  class="btn-add-item" 
                  @click="handleAddToCart(item)"
                  title="Tambah ke pesanan"
                >
                  <AppIcon name="plus" :size="16" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Easy 3 Steps Flow -->
    <section class="steps-section">
      <div class="container">
        <div class="section-header text-center">
          <h2 class="section-title">Alur Pemesanan Simpel & Transparan</h2>
          <p class="section-subtitle">
            Dari memilih nutrisi favorit hingga menerima nomor antrean pesanan Anda.
          </p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">01</div>
            <h3 class="step-title">Pilih Makanan Sehat</h3>
            <p class="step-desc">
              Pilih menu grain bowl, salad, atau jus ekstrak dingin sesuai kebutuhan kalori dan diet Anda.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num">02</div>
            <h3 class="step-title">Tinjau & Catat Preferensi</h3>
            <p class="step-desc">
              Atur jumlah porsi, tambahkan catatan khusus (misal: tanpa bawang atau dressing dipisah) di daftar pesanan.
            </p>
          </div>

          <div class="step-card">
            <div class="step-num">03</div>
            <h3 class="step-title">Bayar & Terima Nomor</h3>
            <p class="step-desc">
              Pilih metode bayar (QRIS, Transfer, Dompet Digital) dan dapatkan nomor pesanan resmi untuk pelacakan.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  padding-bottom: 4rem;
}

/* Hero Section */
.hero-section {
  padding: 4rem 0 3.5rem;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(180deg, rgba(250, 248, 245, 0.4) 0%, rgba(244, 241, 235, 0.7) 100%);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 3.5rem;
  align-items: center;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1.25rem;
}

.kicker-line {
  width: 24px;
  height: 2px;
  background-color: var(--color-primary);
}

.kicker-text {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}

.hero-welcome-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
}

.hero-title {
  font-size: 2.75rem;
  line-height: 1.18;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--color-primary);
  margin-bottom: 1.25rem;
}

.hero-description {
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--color-text-muted);
  margin-bottom: 2.25rem;
  max-width: 540px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 12px 22px;
  background-color: transparent;
  color: var(--color-text-main);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: #FFFFFF;
}

.hero-commitments {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.commitment-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.accent-icon {
  color: var(--color-primary);
}

.hero-visual {
  position: relative;
}

.visual-card {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-light);
  background-color: var(--bg-surface);
}

.hero-image {
  width: 100%;
  height: 380px;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.visual-caption {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.caption-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-primary);
}

.caption-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* Pillars Section */
.pillars-section {
  padding: 5rem 0;
  border-bottom: 1px solid var(--border-light);
}

.section-header {
  max-width: 620px;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 3.5rem;
}

.section-title {
  font-size: 1.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
  margin-bottom: 0.75rem;
}

.section-subtitle {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.pillar-card {
  padding: 2.25rem 1.75rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.pillar-card:hover {
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.pillar-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  margin-bottom: 1.25rem;
}

.pillar-heading {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.6rem;
}

.pillar-text {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Featured Section */
.featured-section {
  padding: 5rem 0;
  border-bottom: 1px solid var(--border-light);
}

.featured-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2.5rem;
}

.link-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
}

.link-more:hover {
  text-decoration: underline;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.food-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.25s ease;
}

.food-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-card);
}

.card-image-box {
  height: 200px;
  overflow: hidden;
  background-color: var(--bg-subtle);
}

.food-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.food-card:hover .food-image {
  transform: scale(1.03);
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* Clean text info without badges */
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.diet-label {
  color: var(--color-primary);
  font-weight: 600;
}

.calorie-label {
  color: var(--color-text-subtle);
}

.food-name {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-main);
  margin-bottom: 0.5rem;
}

.food-desc {
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.food-price {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primary);
}

.btn-add-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-add-item:hover {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

/* Steps Section */
.steps-section {
  padding: 5rem 0 2rem;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.step-card {
  padding: 2rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  position: relative;
}

.step-num {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--color-primary-soft);
  margin-bottom: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: #9FB2A5;
}

.step-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.step-desc {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  
  .hero-title {
    font-size: 2.2rem;
  }

  .pillars-grid,
  .menu-grid,
  .steps-grid {
    grid-template-columns: 1fr;
  }

  .featured-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>

