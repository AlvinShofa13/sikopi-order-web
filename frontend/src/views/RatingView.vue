<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/services/api'

const route = useRoute()
const router = useRouter()

const orderId = String(route.params.id || '')
const token = String(route.query.token || '')

const loading = ref(true)
const errorMsg = ref('')
const orderInfo = ref(null)

const selectedRating = ref(5)
const hoverRating = ref(0)
const comment = ref('')
const submitting = ref(false)
const submitted = ref(false)

onMounted(async () => {
  if (!orderId || !token) {
    errorMsg.value = 'Tautan rating tidak lengkap atau tidak valid.'
    loading.value = false
    return
  }
  const res = await api.orders.getRatingInfo(orderId, token)
  loading.value = false
  if (!res.ok) {
    errorMsg.value = res.error || 'Tautan rating tidak valid atau pesanan tidak ditemukan.'
    return
  }
  orderInfo.value = res.data
  if (res.data?.alreadyRated) {
    submitted.value = true
    selectedRating.value = res.data.existingRating?.rating || 5
    comment.value = res.data.existingRating?.comment || ''
  }
})

async function handleSubmit() {
  if (submitting.value || submitted.value) return
  submitting.value = true
  errorMsg.value = ''
  const res = await api.orders.submitRating(orderId, {
    token,
    rating: selectedRating.value,
    comment: comment.value.trim()
  })
  submitting.value = false
  if (!res.ok) {
    errorMsg.value = res.error || 'Gagal mengirim rating. Silakan coba lagi.'
    return
  }
  submitted.value = true
}
</script>

<template>
  <div class="rating-page">
    <div class="rating-card">
      <div v-if="loading" class="rating-state">Memuat detail pesanan...</div>

      <div v-else-if="errorMsg && !orderInfo" class="rating-state error">
        <h2>Tautan Tidak Valid</h2>
        <p>{{ errorMsg }}</p>
        <button type="button" class="btn-back" @click="router.push('/')">Kembali ke Beranda</button>
      </div>

      <template v-else-if="orderInfo">
        <div class="rating-badge font-mono">ULASAN PELANGGAN</div>
        <h1 class="rating-title">Bagaimana pesanan Anda?</h1>
        <p class="rating-subtitle">
          Halo <strong>{{ orderInfo.customerName }}</strong> ({{ orderInfo.orderId }})
        </p>

        <div v-if="(orderInfo.items || []).length > 0" class="rating-items-box">
          <span class="items-label font-mono">Pesanan Anda:</span>
          <ul>
            <li v-for="(it, idx) in orderInfo.items" :key="idx">
              {{ it.quantity }}x {{ it.name }}
            </li>
          </ul>
        </div>

        <div v-if="submitted" class="rating-done-box">
          <div class="done-stars">
            <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= selectedRating }">★</span>
          </div>
          <h3>Terima Kasih atas Ulasannya!</h3>
          <p v-if="comment" class="done-comment">"{{ comment }}"</p>
          <p class="done-note">Masukan Anda sangat berarti untuk meningkatkan pelayanan kami.</p>
          <button type="button" class="btn-back" @click="router.push('/')">Kembali ke Beranda</button>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="rating-form">
          <div class="star-picker-wrap">
            <span class="picker-label">Pilih Rating Bintang (1 - 5)</span>
            <div class="star-row" role="radiogroup" aria-label="Rating bintang">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                class="star-btn"
                :class="{ active: n <= (hoverRating || selectedRating) }"
                @mouseenter="hoverRating = n"
                @mouseleave="hoverRating = 0"
                @click="selectedRating = n"
                :aria-label="`${n} bintang`"
              >
                ★
              </button>
            </div>
            <span class="star-caption font-mono">{{ selectedRating }} / 5 Bintang</span>
          </div>

          <div class="comment-group">
            <label for="rating-comment" class="picker-label">Pesan / Ulasan (Opsional)</label>
            <textarea
              id="rating-comment"
              v-model="comment"
              rows="3"
              maxlength="400"
              class="rating-textarea"
              placeholder="Ceritakan pengalaman rasa kopi, snack, atau pelayanan kami..."
            ></textarea>
          </div>

          <p v-if="errorMsg" class="submit-err">{{ errorMsg }}</p>

          <button type="submit" class="btn-submit-rating" :disabled="submitting">
            {{ submitting ? 'Mengirim...' : 'Kirim Rating & Ulasan' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rating-page {
  min-height: calc(100vh - 70px);
  background-color: var(--color-sand, #F4EFE6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.rating-card {
  width: 100%;
  max-width: 480px;
  background-color: #FFFFFF;
  border: 2px solid var(--color-primary, #2C4A3E);
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 4px 4px 0 var(--color-primary, #2C4A3E);
}

.rating-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  background-color: var(--color-peach, #F7D9C4);
  color: var(--color-primary, #2C4A3E);
  padding: 3px 10px;
  border-radius: 4px;
  margin-bottom: 0.65rem;
}

.rating-title {
  margin: 0 0 0.25rem;
  font-size: 1.45rem;
  color: var(--color-primary, #2C4A3E);
}

.rating-subtitle {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  color: #57534E;
}

.rating-items-box {
  background: #FAF8F5;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  margin-bottom: 1.15rem;
  font-size: 0.85rem;
}

.items-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #78716C;
  margin-bottom: 0.25rem;
}

.rating-items-box ul {
  margin: 0;
  padding-left: 1.1rem;
}

.star-picker-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.9rem;
  background: #FAF8F5;
  border-radius: 10px;
  margin-bottom: 1rem;
}

.picker-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary, #2C4A3E);
}

.star-row {
  display: flex;
  gap: 0.4rem;
}

.star-btn {
  border: none;
  background: transparent;
  font-size: 2.2rem;
  line-height: 1;
  cursor: pointer;
  color: #D6D3D1;
  transition: transform 0.12s ease, color 0.12s ease;
}

.star-btn.active {
  color: #F59E0B;
  transform: scale(1.08);
}

.star-caption {
  font-size: 0.8rem;
  font-weight: 700;
  color: #57534E;
}

.comment-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.rating-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid var(--color-primary, #2C4A3E);
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  font-size: 0.9rem;
  resize: vertical;
}

.btn-submit-rating,
.btn-back {
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  border: 2px solid var(--color-primary, #2C4A3E);
  background-color: var(--color-primary, #2C4A3E);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-submit-rating:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.rating-done-box {
  text-align: center;
  padding: 1rem 0 0.25rem;
}

.done-stars {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.done-stars .star {
  color: #D6D3D1;
}

.done-stars .star.active {
  color: #F59E0B;
}

.done-comment {
  font-style: italic;
  color: #44403C;
  background: #FAF8F5;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  margin: 0.6rem 0;
}

.done-note {
  font-size: 0.85rem;
  color: #57534E;
  margin-bottom: 1rem;
}

.submit-err {
  color: #DC2626;
  font-size: 0.84rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.rating-state {
  text-align: center;
  padding: 1.5rem 0;
}
</style>
