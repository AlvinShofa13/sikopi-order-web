<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  canClose: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'verified'])

const router = useRouter()
const store = useOrderStore()

const inputName = ref('')
const inputToken = ref('')
const errorMessage = ref('')
const isSuccess = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  
  if (!inputName.value.trim()) {
    errorMessage.value = 'Silakan masukkan nama lengkap atau panggilan Anda.'
    return
  }

  if (!inputToken.value.trim()) {
    errorMessage.value = 'Silakan masukkan token 3 digit.'
    return
  }

  const result = await store.verifyCustomerTokenOnline(inputName.value, inputToken.value)

  if (!result.success) {
    if (result.isCompletedOrder && result.orderId) {
      // Token ini sudah menyelesaikan pesanan -> alihkan langsung ke rincian struk digital pesanan miliknya!
      errorMessage.value = result.message
      setTimeout(() => {
        errorMessage.value = ''
        emit('close')
        router.push(`/konfirmasi/${result.orderId}`)
      }, 1000)
      return
    }
    errorMessage.value = result.message
    return
  }

  isSuccess.value = true
  setTimeout(() => {
    isSuccess.value = false
    emit('verified', store.customerSession)
    emit('close')
    // Selalu langsung menuju ke halaman list menu (/menu) saat token baru berhasil dimasukkan
    router.push('/menu')
  }, 600)
}
</script>

<template>
  <div v-if="isOpen" class="token-modal-overlay" role="dialog" aria-modal="true">
    <div class="token-modal-card">
      <!-- Tombol silang dihilangkan: modal hanya bisa tertutup setelah verifikasi nama & token valid -->

      <div class="modal-header text-center">
        <div class="brand-badge">
          <AppIcon name="shield-check" :size="20" class="badge-icon" />
          <span>sikopi</span>
        </div>
        <h2 class="modal-title">Akses Pemesanan Pelanggan</h2>
        <p class="modal-subtitle">
          Silakan masukkan Nama Anda dan Token 3 Digit dari kasir untuk membuka pilihan menu kopi & artisan sandwich.
        </p>
      </div>

      <!-- Quick Hint Bar pointing to Cashier -->
      <div class="token-helper-bar">
        <div class="helper-text-wrap">
          <AppIcon name="receipt" :size="15" class="helper-icon" />
          <span>Belum punya token? Silakan minta token 3 digit kepada kasir/admin di meja kasir SIKopi.</span>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="form-group">
          <label class="form-label" for="auth-cust-name">
            Nama Lengkap / Panggilan <span class="required">*</span>
          </label>
          <div class="input-wrap">
            <AppIcon name="user" :size="16" class="input-icon" />
            <input 
              id="auth-cust-name"
              v-model="inputName" 
              type="text" 
              placeholder="Contoh: Budi Santoso"
              class="auth-input"
              autofocus
            />
          </div>
          <span class="input-hint">Nama ini akan dicantumkan pada struk pesanan Anda.</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="auth-cust-token">
            Token 3 Digit <span class="required">*</span>
          </label>
          <div class="input-wrap token-input-wrap">
            <AppIcon name="shield-check" :size="16" class="input-icon" />
            <input 
              id="auth-cust-token"
              v-model="inputToken" 
              type="text" 
              maxlength="3"
              placeholder="Contoh: 742"
              class="auth-input token-input font-mono"
            />
          </div>
          <span class="input-hint">Ketik 3 digit token yang Anda peroleh dari kasir (1x pakai hingga pesanan selesai).</span>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="error-banner" role="alert">
          <AppIcon name="close" :size="15" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Success Alert -->
        <div v-if="isSuccess" class="success-banner" role="status">
          <AppIcon name="check" :size="15" />
          <span>Token & Nama Berhasil Diverifikasi! Membuka menu...</span>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          class="btn-submit-auth"
          :disabled="isSuccess"
        >
          <span>{{ isSuccess ? 'Membuka Menu...' : 'Verifikasi & Mulai Pilih Menu' }}</span>
          <AppIcon name="arrow-right" :size="18" />
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.token-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background-color: rgba(23, 33, 24, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 1.5rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.token-modal-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: auto;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 2.25rem 2rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.btn-close-modal {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  color: var(--color-text-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-close-modal:hover {
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
}

.modal-header {
  margin-bottom: 1.5rem;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 0.75rem;
}

.modal-title {
  font-size: 1.65rem;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  margin-bottom: 0.35rem;
}

.modal-subtitle {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.token-helper-bar {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 1.5rem;
}

.helper-text-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.helper-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.btn-link-token {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  background: none;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.btn-link-token:hover {
  color: var(--color-primary-hover);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.required {
  color: #A34848;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--color-text-subtle);
  pointer-events: none;
}

.auth-input {
  width: 100%;
  height: 46px;
  padding: 0 14px 0 42px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.92rem;
  color: var(--color-text-main);
  outline: none;
  transition: all 0.2s ease;
}

.auth-input:focus {
  border-color: var(--color-primary);
  background-color: #FFFFFF;
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.token-input {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.input-hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background-color: #FFF5F5;
  border: 1px solid #FEB2B2;
  border-radius: var(--radius-md);
  color: #C53030;
  font-size: 0.82rem;
  font-weight: 500;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background-color: #F0FFF4;
  border: 1px solid #9AE6B4;
  border-radius: var(--radius-md);
  color: #276749;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-submit-auth {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 48px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
}

.btn-submit-auth:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-submit-auth:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .token-modal-overlay {
    padding: 1rem;
  }
  .token-modal-card {
    padding: 1.5rem 1.2rem;
    border-radius: var(--radius-md);
  }
  .modal-title {
    font-size: 1.2rem;
  }
  .modal-subtitle {
    font-size: 0.8rem;
  }
  .token-helper-bar {
    padding: 8px 10px;
    font-size: 0.78rem;
  }
  .auth-input {
    height: 44px;
    font-size: 0.9rem;
  }
  .btn-submit-auth {
    height: 44px;
    font-size: 0.9rem;
  }
}
</style>
