<script setup>
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { isCustomImage } from '@/utils/format'
import AppIcon from '@/components/icons/AppIcon.vue'

const store = useOrderStore()
</script>

<template>
  <footer class="footer-wrapper">
    <div class="container footer-content">
      <div class="footer-brand-col">
        <div class="footer-logo">
          <span class="logo-box">
            <img v-if="isCustomImage(store.brandIcon)" :src="api.fileUrl(store.brandIcon)" alt="Logo" class="footer-logo-img" />
            <AppIcon v-else :name="store.brandIcon || 'leaf'" :size="18" />
          </span>
          <span class="footer-name">{{ store.brandName || 'SIKopi' }}</span>
        </div>
        <p class="footer-tagline">
          Menyajikan sajian kopi terbaik dan aneka hidangan bernutrisi seimbang dari bahan segar alami untuk menemani hari produktif Anda.
        </p>
        <div class="footer-guarantee">
          <div class="guarantee-item">
            <AppIcon name="shield-check" :size="16" class="icon-muted" />
            <span>Kopi Berkualitas Pilihan</span>
          </div>
          <div class="guarantee-item">
            <AppIcon name="sparkles" :size="16" class="icon-muted" />
            <span>Diracik Segar Setiap Hari</span>
          </div>
        </div>
      </div>
<!-- 
      <div class="footer-info-col">
        <h4 class="footer-heading">Lokasi Outlet</h4>
        <div class="info-row">
          <AppIcon name="map-pin" :size="16" class="icon-muted" />
          <div>
            <p class="info-primary">sikopi Sentral</p>
            <p class="info-secondary">Indonesia</p>
          </div>
        </div>
      </div> -->
    </div>

    <div class="footer-bottom">
      <div class="container bottom-inner">
        <p class="copyright-text">
          &copy; {{ new Date().getFullYear() }} sikopi.
        </p>
        <p class="disclaimer-text">
          Transparan kalori · Kemasan ramah lingkungan
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-wrapper {
  margin-top: auto;
  background-color: #F4F1EC;
  border-top: 1px solid var(--border-light);
  padding-top: 3.5rem;
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  padding-bottom: 3rem;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.logo-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  overflow: hidden;
}

.footer-logo-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 2px;
}

.footer-name {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.footer-tagline {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  max-width: 380px;
  margin-bottom: 1.25rem;
}

.footer-guarantee {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.guarantee-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.footer-heading {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-main);
  margin-bottom: 1.25rem;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.icon-muted {
  color: var(--color-primary);
  margin-top: 2px;
}

.info-primary {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
  line-height: 1.3;
}

.info-secondary {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.footer-token-link {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footer-token-link:hover {
  color: var(--color-primary-hover);
}

.footer-bottom {
  border-top: 1px solid var(--border-light);
  padding: 1.25rem 0;
  background-color: #EFECE6;
}

.bottom-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-text-subtle);
}

@media (max-width: 768px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .bottom-inner {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>

