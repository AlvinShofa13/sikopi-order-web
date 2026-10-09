<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import TheNavbar from '@/components/TheNavbar.vue'
import TheFooter from '@/components/TheFooter.vue'

const route = useRoute()
const isAdminPage = computed(() => route.path.startsWith('/admin'))
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
