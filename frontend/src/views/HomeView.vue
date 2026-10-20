<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import HeroSection from '@/components/HeroSection.vue'
import CaraPesanSection from '@/components/CaraPesanSection.vue'
import MenuSection from '@/components/MenuSection.vue'

const store = useOrderStore()
const route = useRoute()

onMounted(async () => {
  await Promise.all([
    store.fetchMenuFromAPI(),
    store.fetchPublicSettings()
  ])

  // Handle hash scrolling (e.g. from /#katalog-section or /#menu)
  if (route.hash) {
    setTimeout(() => {
      const el = document.querySelector(route.hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }, 200)
  }
})
</script>

<template>
  <div class="tuku-home-view">
    <!-- 1. Hero Layar Penuh dengan Animasi Barista Interaktif -->
    <HeroSection />

    <!-- 2. Papan "Cara Pesan" Tiga Langkah Praktis -->
    <CaraPesanSection />

    <!-- 3. Katalog Inti Terbelah 50/50 + Favorit Carousel + Floating Cart Bar -->
    <MenuSection />
  </div>
</template>

<style scoped>
.tuku-home-view {
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
