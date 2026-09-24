import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'

vi.mock('@/services/api', () => ({
  api: {
    baseUrl: 'http://localhost:8005/api',
    auth: { login: vi.fn(), logout: vi.fn() },
    menu: { getAll: vi.fn().mockResolvedValue({ ok: false }) },
    tokens: {
      getActive: vi.fn().mockResolvedValue({ ok: false }),
      generate: vi.fn().mockResolvedValue({ ok: false }),
      verify: vi.fn(),
      getBurned: vi.fn().mockResolvedValue({ ok: false })
    },
    orders: { getAll: vi.fn().mockResolvedValue({ ok: false }) }
  }
}))

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('Token client-server sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('mengadopsi newToken server setelah verify sukses', async () => {
    api.tokens.verify.mockResolvedValueOnce({ ok: true, data: { success: true, newToken: '777' } })
    const store = useOrderStore()
    const before = store.activeToken
    const res = store.verifyAndSetCustomer('Sinta', before)
    expect(res.success).toBe(true)
    await flush()
    expect(store.activeToken).toBe('777')
    expect(localStorage.getItem('sikopi_active_token')).toBe('777')
  })

  it('tetap pakai token lokal bila server tak terjangkau', async () => {
    api.tokens.verify.mockResolvedValueOnce({ ok: false })
    const store = useOrderStore()
    const before = store.activeToken
    store.verifyAndSetCustomer('Sinta', before)
    await flush()
    expect(store.activeToken).not.toBe('777')
  })
})
