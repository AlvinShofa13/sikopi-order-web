import { describe, it, expect } from 'vitest'
import { topMenus, paymentBreakdown, ordersToCsv, isOrderPaid, paymentLabel } from '@/utils/salesAnalytics'

const orders = [
  {
    orderId: 'HYT-1', createdAt: '2026-01-01',
    customer: { name: 'A', phone: '-', token: '111', orderType: 'Makan di Tempat' },
    payment: { method: 'qris', label: 'QRIS', status: 'Sudah Lunas' },
    items: [
      { name: 'Kopi', price: 1, quantity: 3, subtotal: 3 },
      { name: 'Roti', price: 1, quantity: 1, subtotal: 1 }
    ],
    breakdown: { total: 4 }
  },
  {
    orderId: 'HYT-2', createdAt: '2026-01-02',
    customer: { name: 'B', phone: '-', token: '222', orderType: 'Bawa Pulang' },
    payment: { method: 'cash', label: 'Tunai di Kasir', status: 'Menunggu Pembayaran' },
    items: [{ name: 'Kopi', price: 1, quantity: 2, subtotal: 2 }],
    breakdown: { total: 2 }
  }
]

describe('salesAnalytics', () => {
  it('ranks top menus by qty', () => {
    const top = topMenus(orders)
    expect(top[0]).toMatchObject({ name: 'Kopi', qty: 5, revenue: 5 })
    expect(top[1]).toMatchObject({ name: 'Roti', qty: 1 })
  })

  it('breaks down payment methods with pct', () => {
    const pay = paymentBreakdown(orders)
    expect(pay).toHaveLength(2)
    expect(pay.find((p) => p.method === 'qris')).toMatchObject({ count: 1, pct: 50 })
  })

  it('builds Excel-ready CSV with BOM', () => {
    const csv = ordersToCsv(orders)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Kopi')
    expect(csv.split('\r\n')).toHaveLength(4) // header + 3 item rows
  })

  it('handles empty orders', () => {
    expect(topMenus([])).toEqual([])
    expect(paymentBreakdown([])).toEqual([])
  })

  it('reads paid boolean with legacy string fallback', () => {
    expect(isOrderPaid({ payment: { paid: true } })).toBe(true)
    expect(isOrderPaid({ payment: { paid: false } })).toBe(false)
    expect(isOrderPaid({ payment: { status: 'Sudah Lunas' } })).toBe(true)
    expect(isOrderPaid({ payment: { status: 'Menunggu Pembayaran' } })).toBe(false)
    expect(isOrderPaid(null)).toBe(false)
    expect(paymentLabel({ payment: { paid: true } })).toBe('Lunas')
    expect(paymentLabel({ payment: { paid: false } })).toBe('Menunggu Pembayaran')
  })
})
