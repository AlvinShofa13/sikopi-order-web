<template>
  <section class="testimonial-section">
    <!-- Top Organic Wave Divider matching DESK.pdf -->
    <div class="wave-divider-top" aria-hidden="true">
      <svg viewBox="0 0 1440 70" fill="none" preserveAspectRatio="none" class="wave-svg">
        <path 
          d="M0,0 C320,55 640,75 960,40 C1140,20 1320,50 1440,25 L1440,70 L0,70 Z" 
          fill="#1C1917" 
        />
      </svg>
    </div>

    <div class="testimonial-content">
      <div class="container">
        <!-- Section Heading strictly from DESK.pdf -->
        <div class="testimonial-header">
          <h2 class="section-title">APA KATA MEREKA?</h2>
        </div>

        <!-- 3 Cards Grid strictly matching DESK.pdf -->
        <div class="testimonial-grid">
          <!-- Card 1: White Card -->
          <div class="testimonial-card card-white">
            <div class="stars-row stars-terracotta">
              <span v-for="s in 5" :key="s">★</span>
            </div>
            <p class="review-body">
              I am a huge fan of what these guys are doing. The quality of their beans is consistently outstanding and the freshness is unbeatable. I've explored their full variety, and although I've...
            </p>
            <div class="author-row">
              <span class="author-name">BAHLIL</span>
            </div>
          </div>

          <!-- Card 2: Featured Terracotta Card matching DESK.pdf -->
          <div class="testimonial-card card-terracotta">
            <div class="stars-row stars-white">
              <span v-for="s in 5" :key="s">★</span>
            </div>
            <p class="review-body text-white">
              I am a huge fan of what these guys are doing. The quality of their beans is consistently outstanding and the freshness is unbeatable. I've explored their full variety, and although I've...
            </p>
            <div class="author-row author-row-white">
              <span class="author-name text-white">BAHLIL</span>
            </div>
          </div>

          <!-- Card 3: White Card -->
          <div class="testimonial-card card-white">
            <div class="stars-row stars-terracotta">
              <span v-for="s in 5" :key="s">★</span>
            </div>
            <p class="review-body">
              I am a huge fan of what these guys are doing. The quality of their beans is consistently outstanding and the freshness is unbeatable. I've explored their full variety, and although I've...
            </p>
            <div class="author-row">
              <span class="author-name">BAHLIL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.testimonial-section {
  position: relative;
  background-color: #1C1917;
  color: #FAF7F2;
  overflow: hidden;
}

.wave-divider-top {
  position: relative;
  top: -1px;
  width: 100%;
  line-height: 0;
  overflow: hidden;
  background-color: var(--color-cream);
}

.wave-svg {
  display: block;
  width: 100%;
  height: 60px;
}

.testimonial-content {
  padding: 3rem 0 5.5rem;
}

.testimonial-header {
  text-align: center;
  margin-bottom: 3.5rem;
}

/* Heading strictly matching DESK.pdf */
.section-title {
  font-family: var(--font-display);
  font-size: clamp(3rem, 6vw, 4.8rem);
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  text-transform: uppercase;
  line-height: 1;
}

/* 3 Cards Grid strictly matching DESK.pdf */
.testimonial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  align-items: stretch;
}

.testimonial-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2rem 1.75rem;
  border-radius: 20px;
  border: 2px solid #000000;
  box-shadow: 5px 5px 0 #000000;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.testimonial-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 7px 7px 0 #000000;
}

/* Card 1 & 3: White */
.card-white {
  background-color: #FAF7F2;
  color: #1C1917;
}

/* Card 2: Featured Terracotta matching DESK.pdf */
.card-terracotta {
  background-color: var(--color-terracotta);
  color: #FFFFFF;
}

.stars-row {
  display: flex;
  gap: 4px;
  margin-bottom: 1.25rem;
  font-size: 1.25rem;
  line-height: 1;
}

.stars-terracotta {
  color: var(--color-terracotta);
}

.stars-white {
  color: #FFFFFF;
}

.review-body {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.65;
  color: #383431;
  margin-bottom: 1.75rem;
  flex-grow: 1;
}

.text-white {
  color: #FFFFFF !important;
}

.author-row {
  border-top: 1.5px dashed rgba(28, 25, 23, 0.25);
  padding-top: 1rem;
}

.author-row-white {
  border-top-color: rgba(255, 255, 255, 0.35);
}

.author-name {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #1C1917;
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .testimonial-grid {
    grid-template-columns: 1fr;
    max-width: 520px;
    margin: 0 auto;
  }
}
</style>
