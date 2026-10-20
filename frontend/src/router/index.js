import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/menu',
      name: 'menu',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/pesanan',
      name: 'pesanan',
      component: () => import('@/views/CartView.vue')
    },
    {
      path: '/pembayaran',
      name: 'pembayaran',
      component: () => import('@/views/CheckoutView.vue')
    },
    {
      path: '/konfirmasi/:id',
      name: 'konfirmasi',
      component: () => import('@/views/ConfirmationView.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue')
    },
    {
      // Catch-all route redirecting to home
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
