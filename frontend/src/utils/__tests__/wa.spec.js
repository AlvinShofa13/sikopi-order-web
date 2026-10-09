import { describe, it, expect } from 'vitest'
import {
  isValidWaPhone,
  normalizeWaPhone,
  orderReceiptText,
  orderStatusText,
  waLink
} from '@/utils/wa'

const order = {
  orderId: 'SK-2K9QW4Z7',
  channel: 'preorder',
  batch: { id: 1, name: 'Batch 3', pickupDate: '2026-01-05T09:00:00' },
  customer: { name: 'Budi Santoso', phone: '6281234567890' },
  payment: { method: 'transfer', label: 'Transfer QRIS + Bukti', paid: true },
  items: [
    { name: 'Kopi Susu', quantity: 2, price: 18000, subtotal: 36000, notes: 'less sugar' },
    { name: 'Brownies', quantity: 1, price: 22000, subtotal: 22000, notes: '' }
  ],
  breakdown: { subtotal: 58000, total: 58000 },
  orderStatus: 'Siap Diambil'
}

// Intl currency(id-ID) memakai non-breaking space antara "Rp" dan angka.
const flat = (s) => s.replace(/ /g, ' ')

describe('wa.js — pembungkus pesan WhatsApp', () => {
  it('normalisasi nomor Indonesia ke format wa.me', () => {
    expect(normalizeWaPhone('0812-3456-7890')).toBe('81234567890')
    expect(normalizeWaPhone('+62 812 3456 7890')).toBe('81234567890')
    expect(normalizeWaPhone('6281234567890')).toBe('81234567890')
    expect(normalizeWaPhone('')).toBe('')
  })

  it('validasi panjang nomor WhatsApp', () => {
    expect(isValidWaPhone('0812-3456-7890')).toBe(true)
    expect(isValidWaPhone('0812')).toBe(false)
    expect(isValidWaPhone('abc')).toBe(false)
  })

  it('bentuk link wa.me dengan pesan ter-encode', () => {
    const url = waLink('0812-3456-7890', 'Halo & selamat datang')
    expect(url.startsWith('https://wa.me/81234567890?text=')).toBe(true)
    expect(url).toContain(encodeURIComponent('Halo & selamat datang'))
    // Tanpa sisa karakter: link persis sama dengan yang diharapkan
    expect(url).toBe(`https://wa.me/81234567890?text=${encodeURIComponent('Halo & selamat datang')}`)
  })

  it('link kosong bila nomor tidak valid', () => {
    expect(waLink('', 'halo')).toBe('')
  })

  it('nota digital memuat kode, rincian, dan total', () => {
    const text = flat(orderReceiptText(order, 'Kopi Senja'))
    expect(text).toContain('Kopi Senja — Nota Digital')
    expect(text).toContain('SK-2K9QW4Z7')
    expect(text).toContain('Budi Santoso')
    expect(text).toContain('Batch 3')
    expect(text).toContain('- 2x Kopi Susu (less sugar) = Rp 36.000')
    expect(text).toContain('- 1x Brownies = Rp 22.000')
    expect(text).toContain('Rp 58.000')
    expect(text).toContain('LUNAS')
  })

  it('pesan status "Siap Diambil" mengajak pelanggan untuk mengambil', () => {
    const text = orderStatusText(order, 'Siap Diambil', 'Kopi Senja')
    expect(text).toContain('SIAP DIAMBIL')
    expect(text).toContain('SK-2K9QW4Z7')
    expect(text).toContain('sebutkan kode pesanan')
  })

  it('pesan status "Sedang Disiapkan" berbeda dari "Siap Diambil"', () => {
    const cooking = orderStatusText(order, 'Sedang Disiapkan')
    expect(cooking).toContain('sedang diracik')
    expect(cooking).not.toContain('SIAP DIAMBIL')
  })

})