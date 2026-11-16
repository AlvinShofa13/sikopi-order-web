<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '@/services/api'

const ratings = ref([])
const average = ref(0)
const total = ref(0)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 640 : false)

let mql = null
function onViewportChange(e) {
  isMobile.value = e.matches
}

const shouldAnimate = computed(() => ratings.value.length > (isMobile.value ? 1 : 3))

const marqueeItems = computed(() => {
  if (ratings.value.length === 0) return []
  return shouldAnimate.value ? [...ratings.value, ...ratings.value] : ratings.value
})

const marqueeDuration = computed(() => {
  const count = Math.max(ratings.value.length, 1)
  return `${Math.max(18, count * 6)}s`
})

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia('(max-width: 640px)')
    isMobile.value = mql.matches
    mql.addEventListener?.('change', onViewportChange)
  }
  const res = await api.orders.getPublicRatings()
  if (res.ok && res.data && Array.isArray(res.data.ratings)) {
    ratings.value = res.data.ratings
    average.value = Number(res.data.average || 0)
    total.value = Number(res.data.total || res.data.ratings.length || 0)
  }
})

onUnmounted(() => {
  mql?.removeEventListener?.('change', onViewportChange)
})
</script>

<template>
  <section v-if="ratings.length > 0" class="rating-marquee-section" aria-label="Ulasan Pelanggan">
    <div class="container rating-head">
      <div>
        <span class="rating-eyebrow font-mono">KATA PELANGGAN</span>
        <h2 class="heading-display rating-heading">ULASAN & RATING</h2>
      </div>
      <div class="rating-summary-pill font-mono">
        <span class="summary-star">★</span>
        <strong>{{ average.toFixed(1) }}</strong>
        <span>/ 5 · {{ total }} ulasan</span>
      </div>
    </div>

    <div class="marquee-viewport" :class="{ 'is-static': !shouldAnimate }">
      <div
        class="marquee-track"
        :class="{ 'is-static': !shouldAnimate }"
        :style="shouldAnimate ? { animationDuration: marqueeDuration } : undefined"
      >
        <article
          v-for="(item, idx) in marqueeItems"
          :key="`${item.id}-${idx}`"
          class="review-card"
        >
          <div class="review-top">
            <div class="review-stars" :aria-label="`${item.rating} dari 5 bintang`">
              <span v-for="n in 5" :key="n" class="r-star" :class="{ filled: n <= item.rating }">★</span>
            </div>
            <span class="review-score font-mono">{{ item.rating }}/5</span>
          </div>

          <p class="review-comment">
            {{ item.comment ? `"${item.comment}"` : '"Pelayanan cepat dan rasanya mantap!"' }}
          </p>

          <div class="review-footer">
            <strong class="review-author font-mono">{{ item.customerName }}</strong>
            <span v-if="item.itemsSummary" class="review-items">{{ item.itemsSummary }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rating-marquee-section {
  background-color: var(--color-sand, #F4EFE6);
  border-top: 2px solid var(--color-primary, #2C4A3E);
  padding: 2.5rem 0 3rem;
  overflow: hidden;
}

.rating-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.rating-eyebrow {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--color-primary, #2C4A3E);
  margin-bottom: 0.25rem;
}

.rating-heading {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: var(--color-primary, #2C4A3E);
}

.rating-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #FFFFFF;
  border: 2px solid var(--color-primary, #2C4A3E);
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--color-primary, #2C4A3E);
}

.summary-star {
  color: #F59E0B;
  font-size: 1.05rem;
}

.marquee-viewport {
  width: 100%;
  overflow: hidden;
  padding: 4px 0;
}

.marquee-viewport.is-static {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4px 1rem;
  overflow: visible;
}

.marquee-track {
  display: flex;
  gap: 1rem;
  width: max-content;
  animation-name: rating-marquee-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.marquee-track.is-static {
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  animation: none;
}

.marquee-viewport:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes rating-marquee-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.review-card {
  width: 290px;
  flex-shrink: 0;
  background: #FFFFFF;
  border: 2px solid var(--color-primary, #2C4A3E);
  box-shadow: 3px 3px 0 var(--color-primary, #2C4A3E);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
}

.review-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.review-stars {
  display: inline-flex;
  gap: 2px;
  font-size: 1.05rem;
}

.r-star {
  color: #D6D3D1;
}

.r-star.filled {
  color: #F59E0B;
}

.review-score {
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--color-primary, #2C4A3E);
}

.review-comment {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #292524;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.review-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px dashed #D6D3D1;
  padding-top: 0.5rem;
}

.review-author {
  font-size: 0.8rem;
  color: var(--color-primary, #2C4A3E);
}

.review-items {
  font-size: 0.72rem;
  color: #78716C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
