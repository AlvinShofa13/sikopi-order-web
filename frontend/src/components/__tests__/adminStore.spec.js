import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminStore } from '@/stores/adminStore'
import { api } from '@/services/api'

vi.mock('@/services/api', () => ({
  api: {
    auth: { login: vi.fn(), logout: vi.fn().mockResolvedValue({ ok: true }) }
  }
}))

describe('Admin Store & Auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes unauthenticated without embedded credentials', () => {
    const store = useAdminStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store).not.toHaveProperty('defaultCredentials')
  })

  it('rejects empty email or password without calling backend', async () => {
    const store = useAdminStore()
    expect((await store.login('', 'x')).success).toBe(false)
    expect((await store.login('a@b.c', '')).success).toBe(false)
    expect(api.auth.login).not.toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(false)
  })

  it('rejects invalid credentials reported by backend', async () => {
    api.auth.login.mockResolvedValueOnce({ ok: false, error: 'Email atau password tidak sesuai.' })
    const store = useAdminStore()
    const res = await store.login('wrong@sikopi.com', 'wrongpassword')
    expect(res.success).toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })

  it('logs in successfully via backend and logs out', async () => {
    api.auth.login.mockResolvedValueOnce({
      ok: true,
      data: { token: 'tok-123', email: 'admin@sikopi.com', name: 'Kasir sikopi', role: 'Admin & Kasir' }
    })
    const store = useAdminStore()
    const loginRes = await store.login('admin@sikopi.com', 'admin123')
    expect(loginRes.success).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(store.currentAdmin.email).toBe('admin@sikopi.com')

    store.logout()
    expect(store.isAuthenticated).toBe(false)
    expect(store.currentAdmin).toBeNull()
  })
})
