<script setup>
import { onMounted, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import TheNavbar from '@/components/TheNavbar.vue'
import TheFooter from '@/components/TheFooter.vue'
import TokenAuthModal from '@/components/TokenAuthModal.vue'

const store = useOrderStore()
const route = useRoute()

const isAdminPage = computed(() => route.path.startsWith('/admin'))

onMounted(() => {
  // Buka modal saat akses awal web pelanggan jika belum memasukkan nama & token,
  // kecuali pada panel admin atau halaman rincian konfirmasi/struk digital pesanan selesai
  if (
    !store.customerSession.isVerified && 
    !route.path.startsWith('/admin') && 
    !route.path.startsWith('/konfirmasi') && 
    route.path !== '/token'
  ) {
    store.openAuthModal()
  }
})
</script>

<template>
  <div class="app-layout" :class="{ 'is-admin-page': isAdminPage }">
    <!-- Navbar hanya untuk pelanggan -->
    <TheNavbar v-if="!isAdminPage" />

    <main class="main-content">
      <RouterView />
    </main>

    <!-- Footer hanya untuk pelanggan -->
    <TheFooter v-if="!isAdminPage" />

    <!-- Modal Input Token & Nama (Hanya untuk pelanggan) -->
    <TokenAuthModal 
      v-if="!isAdminPage"
      :is-open="store.authModalOpen" 
      :can-close="false"
      @close="store.closeAuthModal" 
    />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding-top: 72px; /* Offset for fixed navbar height */
}

/* Remove padding offset for admin page since admin has its own navbar */
.is-admin-page .main-content {
  padding-top: 0;
}
</style>
