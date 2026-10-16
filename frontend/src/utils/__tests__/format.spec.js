import { describe, it, expect } from 'vitest'
import { parseBundleItems, bundleContentsLabel, bundleSavings, parseVariants, variantsLabel, variantExtras } from '@/utils/format'

describe('bundle helpers', () => {
  it('parseBundleItems menerima JSON string backend', () => {
    expect(parseBundleItems('[{"id": "menu-a", "quantity": 2}]')).toEqual([
      { id: 'menu-a', quantity: 2 }
    ])
  })

  it('parseBundleItems menerima array langsung', () => {
    expect(parseBundleItems([{ id: 'menu-a', qty: 3 }])).toEqual([
      { id: 'menu-a', quantity: 3 }
    ])
  })

  it('parseBundleItems menolak input rusak / kosong', () => {
    expect(parseBundleItems('')).toEqual([])
    expect(parseBundleItems(null)).toEqual([])
    expect(parseBundleItems('bukan-json')).toEqual([])
    expect(parseBundleItems('{}')).toEqual([])
    expect(parseBundleItems([{ quantity: 2 }])).toEqual([])
  })

  it('bundleContentsLabel merangkai "2x Kopi, 1x Roti"', () => {
    const menus = [
      { id: 'menu-a', name: 'Kopi Susu' },
      { id: 'menu-b', name: 'Roti Bakar' }
    ]
    expect(
      bundleContentsLabel('[{"id": "menu-a", "quantity": 2}, {"id": "menu-b", "quantity": 1}]', menus)
    ).toBe('2x Kopi Susu, 1x Roti Bakar')
  })

  it('bundleContentsLabel memakai id bila nama tak dikenal', () => {
    expect(bundleContentsLabel('[{"id": "menu-x", "quantity": 1}]', [])).toBe('1x menu-x')
    expect(bundleContentsLabel('', [])).toBe('')
  })

  it('bundleSavings menghitung hemat dari total satuan', () => {
    const menus = [
      { id: 'menu-a', name: 'Kopi Susu', price: 25000 },
      { id: 'menu-b', name: 'Roti Bakar', price: 10000 }
    ]
    // Isi: 1x25000 + 2x10000 = 45000; paket 30000 -> hemat 15000.
    expect(
      bundleSavings('[{"id": "menu-a", "quantity": 1}, {"id": "menu-b", "quantity": 2}]', menus, 30000)
    ).toEqual({ sum: 45000, savings: 15000 })
  })

  it('bundleSavings 0 bila harga paket >= total satuan', () => {
    const menus = [{ id: 'menu-a', name: 'Kopi Susu', price: 25000 }]
    expect(
      bundleSavings('[{"id": "menu-a", "quantity": 1}]', menus, 25000)
    ).toEqual({ sum: 25000, savings: 0 })
    expect(bundleSavings(' Rusak ', menus, 1000)).toEqual({ sum: 0, savings: 0 })
  })
})

describe('variant helpers', () => {
  it('parseVariants menerima JSON string & array', () => {
    expect(parseVariants('[{"name": "Es", "price": 0}]')).toEqual([{ name: 'Es', price: 0 }])
    expect(parseVariants([{ name: 'Extra Shot', price: 5000 }])).toEqual([{ name: 'Extra Shot', price: 5000 }])
  })

  it('parseVariants menolak input rusak & duplikat', () => {
    expect(parseVariants('')).toEqual([])
    expect(parseVariants(null)).toEqual([])
    expect(parseVariants('bukan-json')).toEqual([])
    expect(parseVariants([{ price: 100 }])).toEqual([])
    expect(parseVariants([{ name: 'Es', price: 0 }, { name: 'Es', price: 0 }])).toEqual([{ name: 'Es', price: 0 }])
  })

  it('variantsLabel menandai gratis vs berbayar', () => {
    // Intl id-ID menyisipkan spasi non-breaking (U+00A0) setelah "Rp".
    const label = variantsLabel('[{"name": "Es", "price": 0}, {"name": "Extra Shot", "price": 5000}]')
    expect(label.replace(/ /g, ' ')).toBe('Es (Gratis), Extra Shot (+Rp 5.000)')
    expect(variantsLabel('')).toBe('')
  })

  it('variantExtras menjumlah biaya varian terpilih', () => {
    const menu = { variants: '[{"name": "Es", "price": 0}, {"name": "Extra Shot", "price": 5000}]' }
    expect(variantExtras(menu, ['Es', 'Extra Shot'])).toBe(5000)
    expect(variantExtras(menu, [])).toBe(0)
    expect(variantExtras(menu, ['Tak Ada'])).toBe(0)
    expect(variantExtras({}, ['Es'])).toBe(0)
  })
})
