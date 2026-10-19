<script setup>
</script>

<template>
  <section class="cara-pesan-section">
    <div class="container cara-pesan-container">
      <div class="papan-header text-center">
        <h2 class="heading-display papan-title">CARA PESAN DI SIKOPI</h2>
        <p class="papan-subtitle font-mono">MUDAH, CEPAT, TANPA ANTRI &bull; TIGA LANGKAH PRAKTIS</p>
      </div>

      <div class="cards-grid">
        <!-- Card 1 -->
        <div class="step-card card-tilted-1">
          <div class="card-tape"></div>
          <span class="step-num font-mono">01</span>
          <h3 class="step-heading">PILIH MENU</h3>
          <p class="step-desc">
            Buka katalog, pilih racikan kopi specialty atau pastry hangat favoritmu, lalu tambahkan ke keranjang pesanan.
          </p>
          <div class="step-tag font-mono">KATALOG TERBUKA</div>
        </div>

        <!-- Card 2 -->
        <div class="step-card card-tilted-2">
          <div class="card-tape"></div>
          <span class="step-num font-mono">02</span>
          <h3 class="step-heading">ISI NAMA &amp; WHATSAPP</h3>
          <p class="step-desc">
            Tanpa daftar akun dan tanpa password. Cukup masukkan nama panggilan dan nomor WhatsApp aktifmu saat checkout.
          </p>
          <div class="step-tag font-mono">TANPA AKUN &bull; TANPA PASSWORD</div>
        </div>

        <!-- Card 3 -->
        <div class="step-card card-tilted-3">
          <div class="card-tape"></div>
          <span class="step-num font-mono">03</span>
          <h3 class="step-heading">BAYAR &amp; PANTAU</h3>
          <p class="step-desc">
            Selesaikan bayar di kasir atau transfer QRIS. Status pesanan dikabarkan otomatis ke WhatsApp dan layar pelacak.
          </p>
          <div class="step-tag font-mono">KABAR WHATSAPP REALTIME</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cara-pesan-section {
  background-color: var(--color-sage-soft);
  border-bottom: 2px solid var(--color-primary);
  padding: 3.5rem 0 4rem;
}

.cara-pesan-container {
  max-width: 1120px;
}

.papan-header {
  margin-bottom: 2.75rem;
}

.papan-title {
  font-size: clamp(2rem, 3.8vw, 2.8rem);
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.papan-subtitle {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--color-primary-2);
  font-weight: 800;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.step-card {
  position: relative;
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  padding: 2.25rem 1.75rem 1.75rem;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;
}

.card-tape {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 72px;
  height: 22px;
  background-color: rgba(217, 136, 106, 0.55);
  border: 1px dashed var(--color-primary);
}

.card-tilted-1 {
  transform: rotate(-1.2deg);
}

.card-tilted-2 {
  transform: rotate(0.8deg);
}

.card-tilted-3 {
  transform: rotate(-0.9deg);
}

.step-card:hover {
  transform: rotate(0deg) translateY(-4px);
  z-index: 2;
}

.step-num {
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--color-peach);
  line-height: 1;
  margin-bottom: 0.75rem;
}

.step-heading {
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  margin-bottom: 0.75rem;
}

.step-desc {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  flex: 1;
  margin-bottom: 1.5rem;
}

.step-tag {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 800;
  padding: 4px 8px;
  background-color: var(--color-sand);
  border: 1.5px solid var(--color-primary);
  align-self: flex-start;
  color: var(--color-primary);
}

@media (max-width: 900px) {
  .cards-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .step-card {
    transform: none !important;
  }
}
</style>
