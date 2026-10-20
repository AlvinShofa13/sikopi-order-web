import { describe, it, expect } from 'vitest'
import { api } from '@/services/api'

describe('api url helpers', () => {
  it('fileUrl passes through absolute URLs and empty', () => {
    expect(api.fileUrl('')).toBe('')
    expect(api.fileUrl('https://images.unsplash.com/x?w=700')).toBe('https://images.unsplash.com/x?w=700')
    expect(api.fileUrl('http://a/b.png')).toBe('http://a/b.png')
  })

  it('fileUrl prefixes backend origin for /uploads paths', () => {
    expect(api.fileUrl('/uploads/menu_abc.png')).toBe('http://localhost:8005/uploads/menu_abc.png')
  })

  it('wsUrl derives ws scheme from api base', () => {
    expect(api.orders.wsUrl('tok 1')).toBe('ws://localhost:8005/api/orders/ws?token=tok%201')
  })
})
