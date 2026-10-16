import { describe, it, expect } from 'vitest'
import { api } from '@/services/api'

describe('api url helpers', () => {
  it('fileUrl passes through absolute URLs and empty', () => {
    expect(api.fileUrl('')).toBe('')
    expect(api.fileUrl('https://images.unsplash.com/x?w=700')).toBe('https://images.unsplash.com/x?w=700')
    expect(api.fileUrl('http://a/b.png')).toBe('http://a/b.png')
  })

  it('fileUrl prefixes backend origin for /uploads paths', () => {
    const origin = api.baseUrl.replace(/\/api\/?$/, '')
    expect(api.fileUrl('/uploads/menu_abc.png')).toBe(`${origin}/uploads/menu_abc.png`)
  })

  it('wsUrl derives ws scheme from api base', () => {
    const wsBase = api.baseUrl.replace(/^http/, 'ws')
    expect(api.orders.wsUrl('tok 1')).toBe(`${wsBase}/orders/ws?token=tok%201`)
  })
})
