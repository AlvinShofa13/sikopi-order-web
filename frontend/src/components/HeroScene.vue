<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { HERO_HOTSPOTS } from '@/data/heroHotspots'
import { useOrderStore } from '@/stores/orderStore'

const router = useRouter()
const store = useOrderStore()

const sceneWrapperRef = ref(null)

// Barista state: standing behind counter (counter top is at y=380, barista body extends from y=230 to 380)
const baristaX = ref(240)
const targetX = ref(240)
const facing = ref('front')
const isWalking = ref(false)
const walkStep = ref(0)
const holdsCup = computed(() => baristaX.value > 780)

const todayMenuItems = computed(() => {
  if (store.menuItems && store.menuItems.length > 0) {
    return store.menuItems.slice(0, 4)
  }
  return [
    { id: '1', name: 'Kopi Americano Sirup Apel', price: 1 },
    { id: '2', name: 'Sandwich Telur', price: 1 },
    { id: '3', name: 'Sandwich Ayam', price: 1 },
    { id: '4', name: 'Brownies Tusuk', price: 1 }
  ]
})

function formatItemName(name) {
  if (!name) return ''
  const upper = name.toUpperCase()
  return upper.length > 14 ? upper.slice(0, 13) + '..' : upper
}

function formatItemPrice(price) {
  if (price === undefined || price === null) return ''
  if (price < 1000) return `Rp ${price}`
  return `${Math.round(price / 1000)}K`
}

// Opening animation
const showWelcomeBubble = ref(true)
const hasUserInteracted = ref(false)

// Deteksi layar mobile (<= 768px)
const isMobileScreen = ref(false)
const isHopping = ref(false)
let mobileHopTimer = null

function checkMobileScreen() {
  if (typeof window !== 'undefined') {
    const isMob = window.innerWidth <= 768
    const prevMob = isMobileScreen.value
    isMobileScreen.value = isMob
    if (isMob) {
      // Pada mobile: kunci di posisi tengah (x = 600) & hadap depan
      baristaX.value = 600
      targetX.value = 600
      facing.value = 'front'
      isWalking.value = false
      if (!mobileHopTimer) {
        mobileHopTimer = setTimeout(triggerMobileHop, 1800)
      }
    } else {
      if (mobileHopTimer) {
        clearTimeout(mobileHopTimer)
        mobileHopTimer = null
      }
      isHopping.value = false
      if (prevMob && !hasUserInteracted.value && !idleTimer) {
        idleTimer = setTimeout(runIdleAutoplay, 2500)
      }
    }
  }
}

function triggerMobileHop() {
  if (!isMobileScreen.value) return
  isHopping.value = true
  setTimeout(() => {
    isHopping.value = false
  }, 800)
  mobileHopTimer = setTimeout(triggerMobileHop, 3600)
}

// Active hotspot
const activeHotspotId = ref('papan-menu') // initial highlight

let animFrameId = null
let idleTimer = null
let autoPlayIndex = 0

function handleScenePointerMove(e) {
  // Pada mobile: jangan ikuti kursor/sentuhan layar (tetap di tengah)
  if (isMobileScreen.value) return

  if (!sceneWrapperRef.value) return
  const rect = sceneWrapperRef.value.getBoundingClientRect()
  if (rect.width <= 0) return

  if (!hasUserInteracted.value) {
    hasUserInteracted.value = true
    showWelcomeBubble.value = false
    if (activeHotspotId.value === 'papan-menu') {
      activeHotspotId.value = null
    }
  }

  // Calculate X in SVG 0..1200 coordinate space
  const relativeX = (e.clientX - rect.left) / rect.width
  const svgX = relativeX * 1200
  targetX.value = Math.max(160, Math.min(1040, svgX))

  startLoop()
}

function handleHotspotEnter(hotspot) {
  activeHotspotId.value = hotspot.id
}

function handleHotspotLeave(hotspot) {
  if (activeHotspotId.value === hotspot.id) {
    setTimeout(() => {
      if (activeHotspotId.value === hotspot.id) {
        activeHotspotId.value = null
      }
    }, 400)
  }
}

function handleHotspotClick(hotspot) {
  if (!hotspot.action) return
  if (hotspot.action === 'last-order') {
    const lastId = store.currentOrder?.orderId || (store.orderHistory && store.orderHistory[0]?.orderId)
    if (lastId) {
      router.push(`/konfirmasi/${lastId}`)
    } else {
      router.push('/konfirmasi/lacak')
    }
  } else if (hotspot.action.startsWith('#')) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
    const el = isMobile
      ? (document.getElementById('daftar-menu') || document.getElementById('search-box-wrap') || document.querySelector(hotspot.action))
      : (document.querySelector(hotspot.action) || document.getElementById('daftar-menu'))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

function updateBaristaPhysics() {
  const dx = targetX.value - baristaX.value

  if (Math.abs(dx) > 0.5) {
    baristaX.value += dx * 0.1
    walkStep.value += 1
    isWalking.value = true

    if (dx > 2) {
      facing.value = 'right'
    } else if (dx < -2) {
      facing.value = 'left'
    } else {
      facing.value = 'front'
    }
    animFrameId = requestAnimationFrame(updateBaristaPhysics)
  } else {
    baristaX.value = targetX.value
    isWalking.value = false
    facing.value = 'front'
    animFrameId = null
  }
}

function startLoop() {
  if (!animFrameId) {
    animFrameId = requestAnimationFrame(updateBaristaPhysics)
  }
}

function runIdleAutoplay() {
  // Hanya jalankan autoplay keliling meja di Desktop & Tablet
  if (isMobileScreen.value || hasUserInteracted.value) return
  autoPlayIndex = (autoPlayIndex + 1) % HERO_HOTSPOTS.length
  const spot = HERO_HOTSPOTS[autoPlayIndex]
  targetX.value = spot.x + spot.width / 2
  activeHotspotId.value = spot.id
  startLoop()
  idleTimer = setTimeout(runIdleAutoplay, 3500)
}

onMounted(() => {
  checkMobileScreen()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', checkMobileScreen)
  }

  if (isMobileScreen.value) {
    baristaX.value = 600
    targetX.value = 600
    facing.value = 'front'
    mobileHopTimer = setTimeout(triggerMobileHop, 2000)
  } else {
    startLoop()
    idleTimer = setTimeout(runIdleAutoplay, 3200)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', checkMobileScreen)
  }
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (idleTimer) clearTimeout(idleTimer)
  if (mobileHopTimer) clearTimeout(mobileHopTimer)
})
</script>

<template>
  <div 
    ref="sceneWrapperRef" 
    class="hero-scene-interactive" 
    @pointermove="handleScenePointerMove"
  >
    <svg 
      class="scene-svg" 
      viewBox="0 0 1200 680" 
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <!-- Counter Edge Lip Gradient -->
        <linearGradient id="counterLipGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C89666" />
          <stop offset="40%" stop-color="#9C6B41" />
          <stop offset="100%" stop-color="#4A2F17" />
        </linearGradient>
      </defs>

      <!-- 1. HOTSPOTS HITBOXES & ANIMATED OUTLINES -->
      <g class="hotspots-container">
        <g 
          v-for="spot in HERO_HOTSPOTS" 
          :key="spot.id"
          class="hotspot-item"
          :class="{ 'is-active': activeHotspotId === spot.id }"
          @mouseenter="handleHotspotEnter(spot)"
          @mouseleave="handleHotspotLeave(spot)"
          @click="handleHotspotClick(spot)"
        >
          <!-- Transparent Hitbox -->
          <rect 
            :x="spot.x" 
            :y="spot.y" 
            :width="spot.width" 
            :height="spot.height" 
            fill="rgba(255,255,255,0.01)" 
            class="hotspot-rect"
          />

          <!-- Animated White Doodle Outline -->
          <path 
            :d="spot.outlinePath" 
            class="hotspot-draw-path" 
            aria-hidden="true"
          />

          <!-- Handwritten Capital Label with Curved White Arrow -->
          <g v-if="activeHotspotId === spot.id" class="hotspot-badge-group">
            <rect 
              :x="spot.labelPos.x - 90" 
              :y="spot.labelPos.y - 18" 
              width="180" 
              height="36" 
              fill="#2C4A3E" 
              stroke="#FAF7F2" 
              stroke-width="2.5" 
            />
            <text 
              :x="spot.labelPos.x" 
              :y="spot.labelPos.y + 5" 
              fill="#FAF7F2" 
              font-family="'Permanent Marker', cursive, sans-serif" 
              font-size="14" 
              letter-spacing="1" 
              text-anchor="middle"
            >
              {{ spot.label }}
            </text>
            <!-- Curved Arrow pointing down/to object -->
            <path 
              :d="spot.arrowPath" 
              fill="none" 
              stroke="#FAF7F2" 
              stroke-width="2.5" 
              stroke-linecap="round"
            />
          </g>
        </g>
      </g>

      <!-- 1.5 DYNAMIC BLACKBOARD MENU (MENU HARI INI) -->
      <g class="blackboard-interactive" @click="handleHotspotClick(HERO_HOTSPOTS[0])" style="cursor: pointer;">
        <rect x="80" y="70" width="220" height="150" fill="#181F1C" stroke="#7A5636" stroke-width="8" />
        <text x="190" y="102" fill="#EAF2ED" font-family="'Permanent Marker', cursive, sans-serif" font-size="17" text-anchor="middle">MENU HARI INI</text>
        <line x1="95" y1="112" x2="285" y2="112" stroke="#4D6B5E" stroke-width="1.5" stroke-dasharray="4,4" />
        
        <g v-for="(item, idx) in todayMenuItems" :key="item.id || idx" :transform="`translate(96, ${133 + idx * 20})`">
          <text x="0" y="0" fill="#FAF7F2" font-family="'Space Mono', monospace" font-size="9.5" font-weight="700">
            {{ formatItemName(item.name) }}
          </text>
          <text x="188" y="0" fill="#FFE899" font-family="'Space Mono', monospace" font-size="9.5" font-weight="700" text-anchor="end">
            {{ formatItemPrice(item.price) }}
          </text>
        </g>
      </g>

      <!-- 2. BARISTA CHARACTER (Standing behind counter at y=380) -->
      <g 
        class="barista-entity"
        :transform="`translate(${baristaX}, ${230 + (!isMobileScreen && isWalking ? Math.sin(walkStep * 0.4) * 3 : 0)})`"
        aria-hidden="true"
      >
        <!-- Inner container for mobile hop animation (avoids overriding barista translate) -->
        <g :class="{ 'barista-hop-inner': isMobileScreen && isHopping }">
        <!-- Barista Head & Cap -->
        <!-- Neck -->
        <rect x="-8" y="55" width="16" height="15" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="2.5" />
        <!-- Head -->
        <circle cx="0" cy="35" r="26" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="3" />
        <!-- Ears -->
        <circle cx="-26" cy="35" r="5" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="2" />
        <circle cx="26" cy="35" r="5" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="2" />

        <!-- Barista Cap / Beanie (Peach #D9886A) -->
        <path d="M-28,30 Q0,0 28,30 Z" fill="#D9886A" stroke="#2C4A3E" stroke-width="3" />
        <rect x="-30" y="27" width="60" height="9" fill="#2C4A3E" />

        <!-- Eyes and Smile based on facing -->
        <g v-if="facing === 'left'">
          <circle cx="-12" cy="35" r="3.5" fill="#2C4A3E" />
          <path d="M-18,44 Q-12,48 -6,44" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
        </g>
        <g v-else-if="facing === 'right'">
          <circle cx="12" cy="35" r="3.5" fill="#2C4A3E" />
          <path d="M6,44 Q12,48 18,44" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
        </g>
        <g v-else>
          <!-- Front Facing Eyes -->
          <circle cx="-9" cy="35" r="3.5" fill="#2C4A3E" />
          <circle cx="9" cy="35" r="3.5" fill="#2C4A3E" />
          <!-- Friendly Hand-drawn Smile -->
          <path d="M-8,44 Q0,50 8,44" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
        </g>

        <!-- Torso & Apron (Deep Sage #2C4A3E) -->
        <path d="M-28,68 L28,68 L36,150 L-36,150 Z" fill="#2C4A3E" stroke="#FAF7F2" stroke-width="3" />
        <!-- White T-Shirt Collar -->
        <polygon points="-16,68 0,92 16,68" fill="#FAF7F2" stroke="#2C4A3E" stroke-width="2.5" />
        <!-- Apron Straps -->
        <line x1="-18" y1="68" x2="-28" y2="105" stroke="#FAF7F2" stroke-width="2.5" />
        <line x1="18" y1="68" x2="28" y2="105" stroke="#FAF7F2" stroke-width="2.5" />
        <!-- Apron Front Pocket with SIKOPI badge -->
        <rect x="-18" y="105" width="36" height="28" fill="#3D5A4C" stroke="#FAF7F2" stroke-width="2" />
        <text x="0" y="122" fill="#FAF7F2" font-family="'Space Mono', monospace" font-size="9" font-weight="800" text-anchor="middle">SIKOPI</text>

        <!-- Arms / Hands -->
        <!-- Right zone: holds steaming cup -->
        <g v-if="holdsCup && !isMobileScreen">
          <!-- Arm holding cup -->
          <path d="M25,85 Q46,92 40,118" fill="none" stroke="#F0EAE1" stroke-width="8" stroke-linecap="round" />
          <path d="M25,85 Q46,92 40,118" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
          <!-- Hand holding Cup -->
          <polygon points="32,105 52,105 48,132 36,132" fill="#FAF7F2" stroke="#2C4A3E" stroke-width="2.5" />
          <rect x="34" y="113" width="16" height="10" fill="#D9886A" />
          <!-- Steam curls -->
          <path d="M42,100 Q38,90 44,82" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" />
          <path d="M46,98 Q50,88 46,80" fill="none" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" />
        </g>
        <g v-else>
          <!-- Left Arm -->
          <path d="M-25,85 Q-42,105 -30,125" fill="none" stroke="#F0EAE1" stroke-width="7" stroke-linecap="round" />
          <path d="M-25,85 Q-42,105 -30,125" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
          <!-- Right Arm (Melambai menyapa di Mobile, istirahat di Desktop) -->
          <g v-if="isMobileScreen" class="barista-waving-arm">
            <path d="M25,85 Q46,65 40,42" fill="none" stroke="#F0EAE1" stroke-width="7" stroke-linecap="round" />
            <path d="M25,85 Q46,65 40,42" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="40" cy="38" r="6" fill="#F0EAE1" stroke="#2C4A3E" stroke-width="2" />
          </g>
          <g v-else>
            <path d="M25,85 Q42,105 30,125" fill="none" stroke="#F0EAE1" stroke-width="7" stroke-linecap="round" />
            <path d="M25,85 Q42,105 30,125" fill="none" stroke="#2C4A3E" stroke-width="2.5" stroke-linecap="round" />
          </g>
        </g>

        <!-- Speech Bubble Sapaan (Selalu menyapa di mobile & di posisi tengah simetris) -->
        <g 
          v-if="showWelcomeBubble || isMobileScreen" 
          class="speech-bubble-doodle"
          :transform="isMobileScreen ? 'translate(-90, -72)' : 'translate(30, -70)'"
        >
          <!-- White background with thick dark border -->
          <rect x="0" y="0" width="180" height="54" fill="#FAF7F2" stroke="#2C4A3E" stroke-width="3" />
          <!-- Speech tail pointing to barista mouth -->
          <polygon 
            v-if="isMobileScreen"
            points="82,54 98,54 90,70" 
            fill="#FAF7F2" 
            stroke="#2C4A3E" 
            stroke-width="3" 
          />
          <polygon 
            v-else
            points="10,54 26,54 6,72" 
            fill="#FAF7F2" 
            stroke="#2C4A3E" 
            stroke-width="3" 
          />
          <line 
            :x1="isMobileScreen ? 82 : 10" 
            y1="54" 
            :x2="isMobileScreen ? 98 : 26" 
            y2="54" 
            stroke="#FAF7F2" 
            stroke-width="4" 
          />
          <!-- Text Sapaan -->
          <text x="90" y="25" fill="#2C4A3E" font-family="'Permanent Marker', cursive, sans-serif" font-size="15" font-weight="900" text-anchor="middle">
            SELAMAT DATANG!
          </text>
          <text x="90" y="43" fill="#1C1917" font-family="'Space Mono', monospace" font-size="9" font-weight="800" letter-spacing="1" text-anchor="middle">
            SIKOPI SIAP RACIK
          </text>
        </g>
        </g>
      </g>

      <!-- 3. FOREGROUND COUNTER LIP (y=380 to 415) - Barista stands behind this! -->
      <rect x="0" y="380" width="1200" height="35" fill="url(#counterLipGrad)" stroke="#2C1F16" stroke-width="3" />
      <!-- Counter shadow -->
      <line x1="0" y1="415" x2="1200" y2="415" stroke="#120D0A" stroke-width="4" />
    </svg>
  </div>
</template>

<style scoped>
.hero-scene-interactive {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: all;
  cursor: default;
}

.scene-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.hotspot-rect {
  cursor: pointer;
  pointer-events: all;
}

/* White hand-drawn animated outline */
.hotspot-draw-path {
  fill: none;
  stroke: #FAF7F2;
  stroke-width: 3.5;
  stroke-linecap: square;
  stroke-dasharray: 600;
  stroke-dashoffset: 600;
  opacity: 0;
  transition: stroke-dashoffset 0.4s ease, opacity 0.35s ease;
  pointer-events: none;
}

.hotspot-item.is-active .hotspot-draw-path {
  stroke-dashoffset: 0;
  opacity: 1;
}

.hotspot-badge-group {
  pointer-events: none;
  animation: badgeFadeIn 0.25s forwards cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes badgeFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.barista-entity {
  will-change: transform;
  pointer-events: none;
}

.speech-bubble-doodle {
  animation: popSpeech 0.35s ease-out;
}

@keyframes popSpeech {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.barista-hop-inner {
  animation: mobileBaristaHop 0.8s ease-in-out;
}

@keyframes mobileBaristaHop {
  0%, 100% {
    transform: translateY(0);
  }
  25% {
    transform: translateY(-9px);
  }
  50% {
    transform: translateY(0);
  }
  75% {
    transform: translateY(-4px);
  }
}

.barista-waving-arm {
  transform-origin: 25px 85px;
  animation: baristaWave 2s ease-in-out infinite;
}

@keyframes baristaWave {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
  75% {
    transform: rotate(-5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hotspot-draw-path {
    stroke-dashoffset: 0 !important;
    opacity: 0.9 !important;
    transition: none !important;
  }
}
</style>
