<script setup>
import { computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'

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
</script>

<template>
  <div class="ordering-banner-area">
    <div class="container">
      <!-- Open PO Active State -->
      <div v-if="isPreorder && batch" class="craft-mode-pill mode-preorder">
        <div class="pill-indicator">
          <AppIcon name="clock" :size="16" />
        </div>
        <div class="pill-details">
          <span class="mode-sticker">OPEN PRE-ORDER</span>
          <span class="batch-name">{{ batch.name }}</span>
          <span v-if="formatDateTime(batch.pickupDate)" class="time-meta">
            · Ambil: {{ formatDateTime(batch.pickupDate) }}
          </span>
          <span v-if="formatDateTime(batch.orderDeadline)" class="time-meta">
            · Batas: {{ formatDateTime(batch.orderDeadline) }}
          </span>
        </div>
      </div>

      <!-- Open PO Waiting State -->
      <div v-else-if="isPreorder && !batch" class="craft-mode-pill mode-waiting">
        <div class="pill-indicator">
          <AppIcon name="clock" :size="16" />
        </div>
        <div class="pill-details">
          <span class="mode-sticker">PRE-ORDER</span>
          <span class="batch-name">Batch Baru Segera Hadir</span>
        </div>
      </div>

      <!-- On-Site / POS Active State -->
      <div v-else class="craft-mode-pill mode-pos">
        <div class="pill-indicator">
          <span class="craft-pulse-dot"></span>
        </div>
        <div class="pill-details">
          <span class="mode-sticker">ON-SITE ACTIVE</span>
          <span class="batch-name">KEDAI MELAYANI LANGSUNG DI MEJA BARISTA</span>
          <span class="time-meta">· Tanpa antre, kabar selesai via WhatsApp</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ordering-banner-area {
  background-color: var(--color-cream);
  padding: 0 0 2.5rem;
}

.craft-mode-pill {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  max-width: 680px;
  margin: 0 auto;
  border: 2px solid var(--color-charcoal);
  box-shadow: 3px 3px 0 var(--color-charcoal);
  font-family: var(--font-mono);
  font-size: 0.82rem;
  transition: all 0.2s ease;
}

.mode-pos {
  background-color: var(--color-white);
  color: var(--color-charcoal);
}

.mode-preorder {
  background-color: #FEF3C7;
  color: #92400E;
}

.mode-waiting {
  background-color: var(--color-sand);
  color: var(--color-text-muted);
}

.pill-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.craft-pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background-color: #25D366;
  border: 1.5px solid var(--color-charcoal);
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.25);
  animation: craft-pulse 2s infinite ease-in-out;
}

@keyframes craft-pulse {
  0% { transform: scale(0.9); }
  50% { transform: scale(1.2); }
  100% { transform: scale(0.9); }
}

.pill-details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-sticker {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-charcoal);
  color: #FFFFFF;
}

.mode-preorder .mode-sticker {
  background-color: #D97706;
}

.batch-name {
  font-weight: 800;
  color: var(--color-charcoal);
}

.time-meta {
  color: #6C665F;
}

@media (max-width: 600px) {
  .craft-mode-pill {
    border-radius: 14px;
    padding: 10px 14px;
    align-items: flex-start;
  }
}
</style>
