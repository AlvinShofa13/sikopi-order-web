import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      redirect: '/menu'
    },
    {
      path: '/menu',
      name: 'menu',
      component: () => import('@/views/MenuView.vue')
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
      // Catch-all route redirecting directly to menu
      path: '/:pathMatch(.*)*',
      redirect: '/menu'
    }
  ]
})

export default router
