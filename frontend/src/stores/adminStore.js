import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'

export const useAdminStore = defineStore('admin', () => {
  // NOTE: no credentials live here. Login is verified server-side via /api/auth/login.
  const isAuthenticated = ref(false)
  const currentAdmin = ref(null)
  const authToken = ref('')

  // Cek status autentikasi dari localStorage saat awal load
  if (typeof localStorage !== 'undefined') {
    const savedAuth = localStorage.getItem('sikopi_admin_logged_in') === 'true'
    const savedEmail = localStorage.getItem('sikopi_admin_email')
    const savedToken = localStorage.getItem('sikopi_admin_token')
    if (savedAuth && savedEmail) {
      isAuthenticated.value = true
      authToken.value = savedToken || ''
      currentAdmin.value = {
        name: 'Kasir sikopi',
        email: savedEmail,
        role: 'Admin & Kasir'
      }
    }
  }

  async function login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase()
    const cleanPassword = (password || '').trim()

    if (!cleanEmail) {
      return { success: false, message: 'Silakan masukkan email admin.' }
    }
    if (!cleanPassword) {
      return { success: false, message: 'Silakan masukkan password admin.' }
    }

    const res = await api.auth.login(cleanEmail, cleanPassword)
    if (!res.ok) {
      return { success: false, message: res.error || 'Email atau password tidak sesuai.' }
    }

    isAuthenticated.value = true
    authToken.value = res.data?.token || ''
    currentAdmin.value = {
      name: res.data?.name || 'Kasir sikopi',
      email: res.data?.email || cleanEmail,
      role: res.data?.role || 'Admin & Kasir'
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sikopi_admin_logged_in', 'true')
      localStorage.setItem('sikopi_admin_email', currentAdmin.value.email)
      localStorage.setItem('sikopi_admin_token', authToken.value)
    }

    return { success: true }
  }

  function logout() {
    api.auth.logout().catch(() => {})
    isAuthenticated.value = false
    currentAdmin.value = null
    authToken.value = ''
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sikopi_admin_logged_in')
      localStorage.removeItem('sikopi_admin_email')
      localStorage.removeItem('sikopi_admin_token')
    }
  }

  return {
    isAuthenticated,
    currentAdmin,
    authToken,
    login,
    logout
  }
})
