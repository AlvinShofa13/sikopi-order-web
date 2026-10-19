<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'

const store = useOrderStore()

const whatsappUrl = computed(() => {
  const phone = (store.adminWhatsapp || '').replace(/\D/g, '')
  if (!phone) return '#'
  const normalized = phone.startsWith('0') ? '62' + phone.slice(1) : phone
  return `https://wa.me/${normalized}?text=${encodeURIComponent('Halo Admin SIKopi, saya ingin bertanya tentang pesanan/menu.')}`
})
</script>

<template>
  <footer class="tuku-footer">
    <div class="container footer-main">
      <!-- Column 1: Brand + Line-Art SVG Illustration -->
      <div class="footer-col brand-col">
        <div class="footer-brand-title">
          <svg class="coffee-doodle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <span class="footer-brand-text">{{ store.brandName || 'SIKOPI' }}</span>
        </div>
        <p class="brand-subtext">
          Good day, start with good Brew
        </p>
        <div class="tag-row">
          <span class="name-tag">Biji Kopi Pilihan</span>
          <span class="name-tag">Ramah Lingkungan</span>
        </div>
      </div>

      <!-- Column 2: Quick Links (Menu, Pesanan, Lacak) -->
      <div class="footer-col links-col">
        <h4 class="col-title">NAVIGASI</h4>
        <ul class="nav-links-list">
          <li>
            <RouterLink to="/" class="footer-link">MENU KAMI</RouterLink>
          </li>
          <li>
            <RouterLink to="/pesanan" class="footer-link">KERANJANG PESANAN</RouterLink>
          </li>
          <li>
            <RouterLink to="/konfirmasi/lacak" class="footer-link">LACAK PESANAN</RouterLink>
          </li>
        </ul>
      </div>

      <!-- Column 3: WhatsApp Admin Contact (Outlined button with dark bar label below) -->
      <div class="footer-col contact-col">
        <h4 class="col-title">HUBUNGI KAMI</h4>
        <p class="contact-desc">
          Punya pertanyaan seputar katering, pesanan pre-order, atau saran racikan kopi?
        </p>
        <div class="tuku-action-btn-group">
          <a 
            :href="whatsappUrl" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="tuku-contact-btn"
          >
            <span class="contact-btn-text">CHAT WHATSAPP</span>
            <span class="contact-btn-number font-mono">{{ store.adminWhatsapp || '0812-XXXX-XXXX' }}</span>
          </a>
          <div class="tuku-action-subbar">
            INFORMASI LAYANAN
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom copyright row -->
    <div class="footer-bottom-bar">
      <div class="container bottom-bar-inner font-mono">
        <span>&copy; {{ new Date().getFullYear() }} SIKopi. Seluruh hak cipta dilindungi.</span>
        <span class="bottom-tagline">Transparan Kalori &bull; Tanpa Akun &bull; Tanpa Ribet</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.tuku-footer {
  margin-top: auto;
  background-color: var(--color-white);
  border-top: 2px solid var(--color-primary);
  color: var(--color-primary);
}

.footer-main {
  display: grid;
  grid-template-columns: 1.4fr 0.9fr 1.3fr;
  gap: 3rem;
  padding: 3rem 1.5rem 2.5rem;
}

.footer-col {
  display: flex;
  flex-direction: column;
}

.footer-brand-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.75rem;
}

.coffee-doodle-icon {
  width: 28px;
  height: 28px;
  stroke: var(--color-primary);
}

.footer-brand-text {
  font-family: var(--font-display);
  font-size: 1.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
  line-height: 1;
}

.brand-subtext {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.col-title {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-primary);
}

.nav-links-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-link {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 700;
  transition: color 120ms ease;
  padding: 3px 0;
  display: inline-block;
}

.footer-link:hover {
  color: var(--color-peach);
  text-decoration: underline;
}

.contact-desc {
  font-size: 0.86rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 1rem;
}

/* Outlined button with dark bar label below */
.tuku-action-btn-group {
  display: flex;
  flex-direction: column;
  max-width: 280px;
}

.tuku-contact-btn {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background-color: var(--color-white);
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  text-decoration: none;
  transition: background-color 140ms ease, color 140ms ease;
}

.tuku-contact-btn:hover {
  background-color: var(--color-peach);
}

.contact-btn-text {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.2;
}

.contact-btn-number {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tuku-action-subbar {
  background-color: var(--color-primary);
  color: var(--color-cream);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  text-align: center;
  padding: 4px 8px;
  border: 2px solid var(--color-primary);
  border-top: none;
}

/* Bottom bar */
.footer-bottom-bar {
  border-top: 2px solid var(--color-primary);
  background-color: var(--color-sand);
  padding: 12px 1.5rem;
}

.bottom-bar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 860px) {
  .footer-main {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 2rem 1.5rem;
  }

  .bottom-bar-inner {
    flex-direction: column;
    text-align: center;
  }
}
</style>
