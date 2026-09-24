<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const store = useOrderStore()

const copied = ref(false)
const notification = ref(null)

const currentToken = computed(() => store.activeToken)

const formattedTime = computed(() => {
  if (!store.tokenGeneratedAt) return new Date().toLocaleTimeString('id-ID')
  const date = new Date(store.tokenGeneratedAt)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WIB'
})

function handleGenerateNew() {
  const newToken = store.generateNewToken()
  showNotification('Token 3 digit baru berhasil dibuat: ' + newToken)
}

function handleCopy() {
  if (!currentToken.value) return
  navigator.clipboard.writeText(currentToken.value)
  copied.value = true
  showNotification('Token ' + currentToken.value + ' berhasil disalin ke clipboard')
  setTimeout(() => {
    copied.value = false
  }, 2200)
}

function handleUseAndOrder() {
  router.push('/menu')
}

function showNotification(msg) {
  notification.value = msg
  setTimeout(() => {
    if (notification.value === msg) {
      notification.value = null
    }
  }, 3000)
}
</script>

<template>
  <div class="token-view">
    <div class="container token-container">
      <!-- Header -->
      <div class="token-header text-center">
        <div class="token-kicker">
          <AppIcon name="shield-check" :size="16" class="kicker-icon" />
          <span>SISTEM AKSES PELANGGAN SIKOPI</span>
        </div>
        <h1 class="token-title">Token Akses Pemesanan</h1>
        <p class="token-subtitle">
          Token 3 digit otomatis ini hanya berlaku 1 kali pakai hingga pesanan selesai dibuat. Setelah pesanan selesai, token otomatis hangus dan tidak dapat digunakan lagi.
        </p>
      </div>

      <!-- Main Token Display Card -->
      <div class="token-display-card">
        <div class="token-card-top">
          <div class="token-status-pill">
            <span class="live-dot"></span>
            <span>Token Aktif Resmi</span>
          </div>
          <span class="token-length-badge">3 Digit · 1x Pakai</span>
        </div>

        <div class="token-digits-wrap">
          <span class="token-digits">{{ currentToken }}</span>
        </div>

        <div class="token-meta-row">
          <span class="meta-label">Waktu Pembuatan:</span>
          <span class="meta-val">{{ formattedTime }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="token-actions-grid">
          <button 
            type="button" 
            class="btn-copy-token" 
            @click="handleCopy"
            :title="copied ? 'Tersalin' : 'Salin Token 3 Digit'"
          >
            <AppIcon :name="copied ? 'check' : 'copy'" :size="18" />
            <span>{{ copied ? 'Token Tersalin!' : 'Salin Token' }}</span>
          </button>

          <button 
            type="button" 
            class="btn-regen-token" 
            @click="handleGenerateNew"
            title="Buat token 3 digit acak baru"
          >
            <AppIcon name="sparkles" :size="18" />
            <span>Generate Token Baru</span>
          </button>
        </div>

        <!-- Direct Order Shortcut -->
        <div class="token-order-shortcut">
          <button 
            type="button" 
            class="btn-start-order" 
            @click="handleUseAndOrder"
          >
            <span>Gunakan Token & Mulai Pilih Menu</span>
            <AppIcon name="arrow-right" :size="18" />
          </button>
        </div>
      </div>

      <!-- Quick Notification Toast -->
      <div v-if="notification" class="token-toast" role="status">
        <AppIcon name="check-circle" :size="16" />
        <span>{{ notification }}</span>
      </div>

      <!-- Instruction / Workflow Guide -->
      <div class="token-guide-card">
        <h3 class="guide-title">
          <AppIcon name="receipt" :size="18" />
          <span>Cara Menggunakan Token 3 Digit:</span>
        </h3>
        
        <div class="guide-steps">
          <div class="guide-step-item">
            <div class="step-num-box">1</div>
            <div class="step-body">
              <strong>Lihat atau Salin Token</strong>
              <p>Salin 3 digit nomor token aktif yang tertera di kartu di atas (contoh: <code>{{ currentToken }}</code>).</p>
            </div>
          </div>

          <div class="guide-step-item">
            <div class="step-num-box">2</div>
            <div class="step-body">
              <strong>Masukkan Nama & Token di Awal Web</strong>
              <p>Buka halaman menu atau beranda SIKopi, lalu masukkan Nama Anda dan Token 3 digit tersebut.</p>
            </div>
          </div>

          <div class="guide-step-item">
            <div class="step-num-box">3</div>
            <div class="step-body">
              <strong>Pilih Menu & Selesaikan Pesanan (Otomatis Hangus)</strong>
              <p>Pilih menu favorit Anda dan selesaikan pesanan. Setelah pesanan selesai, token ini langsung hangus dan sistem otomatis menerbitkan token baru untuk pesanan berikutnya.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.token-view {
  padding: 3rem 0 5rem;
}

.token-container {
  max-width: 580px;
}

.token-header {
  margin-bottom: 2rem;
}

.token-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 1rem;
}

.token-title {
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.token-subtitle {
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Display Card */
.token-display-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 2.25rem 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
  text-align: center;
}

.token-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.token-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #2F6F44;
  background-color: #E8F5E9;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #2F6F44;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.token-length-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
}

.token-digits-wrap {
  padding: 1.5rem 0;
  background: linear-gradient(180deg, var(--bg-primary) 0%, rgba(250, 248, 245, 0.5) 100%);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.token-digits {
  font-family: monospace;
  font-size: 4.5rem;
  font-weight: 800;
  letter-spacing: 0.25em;
  color: var(--color-primary);
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.token-meta-row {
  display: flex;
  justify-content: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--color-text-subtle);
  margin-bottom: 1.75rem;
}

.meta-val {
  font-weight: 600;
  color: var(--color-text-main);
}

/* Actions Grid */
.token-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}

.btn-copy-token,
.btn-regen-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-copy-token {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border: 1px solid transparent;
}

.btn-copy-token:hover {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.btn-regen-token {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-medium);
  color: var(--color-text-main);
}

.btn-regen-token:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--bg-primary);
}

/* Start Order Shortcut */
.btn-start-order {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 20px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.btn-start-order:hover {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

/* Notification Toast */
.token-toast {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Guide Card */
.token-guide-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.guide-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 1.25rem;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.guide-step-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.step-num-box {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-body {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.step-body strong {
  display: block;
  color: var(--color-text-main);
  margin-bottom: 2px;
}

.step-body code {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary);
}

@media (max-width: 540px) {
  .token-actions-grid {
    grid-template-columns: 1fr;
  }

  .token-digits {
    font-size: 3.5rem;
    letter-spacing: 0.2em;
  }
}
</style>

