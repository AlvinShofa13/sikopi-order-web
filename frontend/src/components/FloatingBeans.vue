<template>
  <div class="floating-beans-layer" aria-hidden="true">
    <!-- Bean 1: Top Left with Cyan Shadow -->
    <div class="floating-bean bean-1 shadow-cyan">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#58311A" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#6F3F22" />
        <path d="M22 6C20 18 28 26 23 38C19 47 26 55 24 58" stroke="#2B1408" stroke-width="3" stroke-linecap="round" />
        <path d="M12 16C15 12 20 10 24 10" stroke="#A86638" stroke-width="2" stroke-linecap="round" opacity="0.6" />
      </svg>
    </div>

    <!-- Bean 2: Top Center with Blue Shadow -->
    <div class="floating-bean bean-2 shadow-blue">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#4A2612" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#663A1D" />
        <path d="M25 6C22 18 30 28 25 40C20 48 26 56 25 58" stroke="#1F0E05" stroke-width="3" stroke-linecap="round" />
        <path d="M14 14C17 10 22 8 26 8" stroke="#9E5F33" stroke-width="2" stroke-linecap="round" opacity="0.5" />
      </svg>
    </div>

    <!-- Bean 3: Top Right with Pink Shadow -->
    <div class="floating-bean bean-3 shadow-pink">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#58311A" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#784425" />
        <path d="M23 6C21 17 29 27 24 39C20 48 25 56 24 58" stroke="#2B1408" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Bean 4: Mid Left with Green Shadow -->
    <div class="floating-bean bean-4 shadow-green">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#58311A" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#6F3F22" />
        <path d="M22 6C20 18 28 26 23 38C19 47 26 55 24 58" stroke="#2B1408" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Bean 5: Bottom Center with Terracotta Shadow -->
    <div class="floating-bean bean-5 shadow-terracotta">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#4A2612" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#663A1D" />
        <path d="M25 6C22 18 30 28 25 40C20 48 26 56 25 58" stroke="#1F0E05" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Bean 6: Bottom Right with Orange Shadow -->
    <div class="floating-bean bean-6 shadow-blue">
      <svg viewBox="0 0 48 64" fill="none" class="bean-svg">
        <path d="M24 2C36 2 46 16 46 32C46 48 36 62 24 62C12 62 2 48 2 32C2 16 12 2 24 2Z" fill="#58311A" />
        <path d="M22 6C32 6 42 18 42 32C42 46 32 58 22 58C16 58 8 46 8 32C8 18 16 6 22 6Z" fill="#784425" />
        <path d="M23 6C21 17 29 27 24 39C20 48 25 56 24 58" stroke="#2B1408" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.floating-beans-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.floating-bean {
  position: absolute;
  width: 32px;
  height: 44px;
  animation: float-gentle 6s infinite ease-in-out;
  transition: transform 0.3s ease;
}

.bean-svg {
  width: 100%;
  height: 100%;
}

/* Distinctive Pop Art Drop Shadows matching reference screens */
.shadow-cyan {
  filter: drop-shadow(4px 4px 0 #2A9D8F);
}

.shadow-blue {
  filter: drop-shadow(4px 4px 0 #3A86FF);
}

.shadow-pink {
  filter: drop-shadow(4px 4px 0 #E63946);
}

.shadow-green {
  filter: drop-shadow(4px 4px 0 #588157);
}

.shadow-terracotta {
  filter: drop-shadow(4px 4px 0 #E76F51);
}

/* Positioning across the hero canvas */
.bean-1 {
  top: 12%;
  left: 22%;
  transform: rotate(-25deg);
  animation-delay: 0s;
}

.bean-2 {
  top: 5%;
  left: 38%;
  transform: rotate(15deg);
  animation-delay: 1.5s;
}

.bean-3 {
  top: 18%;
  right: 6%;
  transform: rotate(45deg);
  animation-delay: 0.8s;
}

.bean-4 {
  top: 60%;
  left: 3%;
  transform: rotate(-60deg);
  animation-delay: 2.2s;
}

.bean-5 {
  bottom: 8%;
  left: 36%;
  transform: rotate(10deg);
  animation-delay: 3s;
}

.bean-6 {
  bottom: 16%;
  right: 5%;
  transform: rotate(-35deg);
  animation-delay: 1.8s;
}

@keyframes float-gentle {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(4deg);
  }
}

@media (max-width: 768px) {
  .bean-2, .bean-5 {
    display: none;
  }
}
</style>
