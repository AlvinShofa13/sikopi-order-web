import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrderStore } from '@/stores/orderStore'

const serverOrder = (over = {}) => ({
  orderId: 'SK-2K9QW4Z7',
  createdAt: '2026-01-01T10:00:00',
  channel: 'pos',
  batch: null,
  customer: { name: 'Budi Santoso', phone: '6281234567890' },
  payment: { method: 'cash', label: 'Bayar di Kasir (Tunai / EDC)', paid: false, status: 'Menunggu Pembayaran', proof: null },
  items: [{ id: 'm1', name: 'Kopi', price: 1, quantity: 1, notes: '', subtotal: 1 }],
  breakdown: { subtotal: 1, ecoFee: 0, tax: 0, total: 1 },
  orderStatus: 'Diterima & Disiapkan',
  ...over
})

vi.mock('@/services/api', () => ({
  api: {
    baseUrl: 'http://localhost:8005/api',
    fileUrl: (p) => p,
    auth: { login: vi.fn(), logout: vi.fn() },
    menu: {
      getAll: vi.fn().mockResolvedValue({
        ok: true,
        data: [{ id: 'm1', name: 'Kopi', category: 'Kopi Pilihan', description: '', price: 1, image: '', is_available: true }]
      }),
      toggle: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      uploadImage: vi.fn()
    },
    preorder: { switchMode: vi.fn(), listBatches: vi.fn(), createBatch: vi.fn(), closeBatch: vi.fn(), reopenBatch: vi.fn() },
    uploads: { proof: vi.fn() },
    wa: { getStatus: vi.fn().mockResolvedValue({ ok: false }), sendTest: vi.fn() },
    orders: {
      getAll: vi.fn().mockResolvedValue({ ok: false }),
      create: vi.fn()
    },
    settings: {
      getPublic: vi.fn().mockResolvedValue({ ok: false }),
      updateBranding: vi.fn().mockResolvedValue({ ok: false })
    }
  }
}))

const flush = () => new Promise((r) => setTimeout(r, 0))

async function seededStore() {
  const store = useOrderStore()
  await flush()
  return store
}

describe('Order Store & Flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes with menu items from backend and empty cart', async () => {
    const store = await seededStore()
    expect(store.menuItems.length).toBeGreaterThan(0)
    expect(store.cart.length).toBe(0)
    expect(store.cartCount).toBe(0)
    expect(store.subtotal).toBe(0)
  })

  it('adds item to cart and calculates subtotal and taxes correctly', async () => {
    const store = await seededStore()
    const firstItem = store.menuItems[0]

    store.addToCart(firstItem)
    expect(store.cart.length).toBe(1)
    expect(store.cartCount).toBe(1)
    expect(store.subtotal).toBe(1)
    expect(store.ecoPackagingFee).toBe(0)
    expect(store.tax).toBe(0)
    expect(store.grandTotal).toBe(1)
  })

  it('updates quantity and removes item when quantity reaches zero', async () => {
    const store = await seededStore()
    const firstItem = store.menuItems[0]

    store.addToCart(firstItem)
    store.updateQuantity(firstItem.id, 1)
    expect(store.cart[0].quantity).toBe(2)

    store.updateQuantity(firstItem.id, -2)
    expect(store.cart.length).toBe(0)
    expect(store.cartCount).toBe(0)
  })

  it('generates a transaction code matching the backend format', async () => {
    const store = await seededStore()
    expect(store.ensureOrderCode()).toMatch(/^SK-[0-9A-HJ-NP-Z]{8}$/)
    // Dipakai ulang sampai pesanan terkirim (nama file bukti mengikat ke kode ini)
    expect(store.ensureOrderCode()).toBe(store.orderCode)
  })

  it('places order using the server response and clears the cart', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({ ok: true, data: serverOrder() })
    const store = await seededStore()
    store.addToCart(store.menuItems[0])

    const orderId = await store.placeOrder(
      { name: 'Budi Santoso', phone: '081234567890' },
      { method: 'cash' }
    )

    // Order dari server = sumber kebenaran (total & harga sudah dihitung ulang backend)
    expect(orderId).toBe('SK-2K9QW4Z7')
    expect(store.getOrderById(orderId).customer.phone).toBe('6281234567890')
    expect(store.cart.length).toBe(0)
    expect(store.orderCode).toBe('')
  })

  it('derives the channel from the global active mode (customer never chooses)', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({ ok: true, data: serverOrder({ channel: 'preorder' }) })
    const store = await seededStore()
    store.activeMode = 'preorder'
    store.addToCart(store.menuItems[0])

    await store.placeOrder({ name: 'Rian', phone: '0812' }, { method: 'transfer' })

    expect(api.orders.create.mock.calls[0][0].channel).toBe('preorder')
  })

  it('sends channel, batch, and payment proof for Open PO orders', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({
      ok: true,
      data: serverOrder({
        channel: 'preorder',
        batch: { id: 3, name: 'Batch 1', pickupDate: null },
        payment: {
          method: 'transfer',
          label: 'Transfer QRIS + Bukti',
          paid: false,
          status: 'Menunggu Pembayaran',
          proof: '/uploads/proof/SK-2K9QW4Z7_abc.jpg'
        }
      })
    })
    const store = await seededStore()
    store.activeMode = 'preorder'
    store.addToCart(store.menuItems[0])

    await store.placeOrder(
      { name: 'Rian', phone: '0812' },
      { method: 'transfer', batchId: 3, paymentProof: '/uploads/proof/SK-2K9QW4Z7_abc.jpg' }
    )

    const sent = api.orders.create.mock.calls[0][0]
    expect(sent.channel).toBe('preorder')
    expect(sent.batchId).toBe(3)
    expect(sent.paymentProof).toBe('/uploads/proof/SK-2K9QW4Z7_abc.jpg')
    // Client tidak boleh menentukan harga: breakdown tidak ikut dikirim
    expect(sent.breakdown).toBeUndefined()
    expect(store.getOrderById('SK-2K9QW4Z7').channel).toBe('preorder')
  })

  it('surfaces backend errors and keeps the cart intact when the order is rejected', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({ ok: false, error: 'Pesanan belum dikirim: unggah bukti pembayaran terlebih dahulu.' })
    const store = await seededStore()
    store.addToCart(store.menuItems[0])

    await expect(
      store.placeOrder({ name: 'Budi', phone: '081234567890' }, { method: 'transfer' })
    ).rejects.toThrow('unggah bukti pembayaran')

    // Keranjang utuh supaya pelanggan bisa langsung mengunggah bukti lalu coba lagi
    expect(store.cart.length).toBe(1)
    expect(store.currentOrder).toBeNull()
  })

  it('remembers customer name and WhatsApp number without any login', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({ ok: true, data: serverOrder() })
    const store = await seededStore()

    store.setCustomer({ name: 'Rian Anggoro', phone: '0812-9999' })
    expect(store.customer.name).toBe('Rian Anggoro')
    expect(localStorage.getItem('sikopi_cust_phone')).toBe('0812-9999')

    // Nama tersimpan dipakai otomatis bila form tidak diisi ulang
    store.addToCart(store.menuItems[0])
    await store.placeOrder({}, { method: 'cash' })
    expect(api.orders.create.mock.calls[0][0].customer.name).toBe('Rian Anggoro')
  })

  it('clears the customer session immediately after the order is placed', async () => {
    const { api } = await import('@/services/api')
    api.orders.create.mockResolvedValue({ ok: true, data: serverOrder() })
    const store = await seededStore()

    store.setCustomer({ name: 'Rian Anggoro', phone: '0812-9999' })
    store.addToCart(store.menuItems[0])
    await store.placeOrder({ name: 'Rian Anggoro', phone: '0812-9999' }, { method: 'cash' })

    expect(store.customer.name).toBe('')
    expect(store.customer.phone).toBe('')
    expect(localStorage.getItem('sikopi_cust_name')).toBeNull()
    expect(localStorage.getItem('sikopi_cust_phone')).toBeNull()
  })

  it('reflects the exclusive active mode and batch from the public settings endpoint', async () => {
    const { api } = await import('@/services/api')
    api.settings.getPublic.mockResolvedValue({
      ok: true,
      data: {
        brand_name: 'Kopi Senja',
        admin_whatsapp: '628999',
        mode: 'preorder',
        batch: { id: 2, name: 'Batch 2', pickupDate: '2026-01-05T10:00:00' }
      }
    })
    const store = await seededStore()

    expect(store.brandName).toBe('Kopi Senja')
    expect(store.adminWhatsapp).toBe('628999')
    expect(store.activeMode).toBe('preorder')
    expect(store.isPreorder).toBe(true)
    expect(store.isPreorderOpen).toBe(true)
    expect(store.activeBatch.name).toBe('Batch 2')
  })

  it('treats preorder as closed when there is no open batch', async () => {
    const { api } = await import('@/services/api')
    api.settings.getPublic.mockResolvedValue({ ok: true, data: { mode: 'preorder', batch: null } })
    const store = await seededStore()
    expect(store.isPreorderOpen).toBe(false)
  })

  it('switches the global mode through the store', async () => {
    const { api } = await import('@/services/api')
    api.preorder.switchMode.mockResolvedValue({ ok: true, data: { mode: 'pos', batch: null } })
    const store = await seededStore()
    store.activeMode = 'preorder'

    await store.switchMode('pos')
    expect(api.preorder.switchMode).toHaveBeenCalledWith('pos')
    expect(store.activeMode).toBe('pos')
  })

  it('tracks WhatsApp gateway status for the admin panel', async () => {
    const { api } = await import('@/services/api')
    api.wa.getStatus.mockResolvedValue({ ok: true, data: { connected: false, reachable: true, qr: 'data:image/png;base64,xx' } })
    const store = await seededStore()

    await store.fetchWaStatus()
    expect(store.waConnected).toBe(false)
    expect(store.waQr).toContain('data:image')
  })

  it('generates dynamic QRIS payload with exact amount and recalculates valid CRC', async () => {
    const { generateDynamicQrisPayload, calculateCRC16 } = await import('@/utils/qris')
    const dynamicPayload = generateDynamicQrisPayload(undefined, 88000)

    // Tag 01 must be dynamic (010212)
    expect(dynamicPayload).toContain('010212')
    // Tag 54 must contain the amount 88000
    expect(dynamicPayload).toContain('540588000')
    // Must contain merchant name AZRIEL SABIQ GAMING GEAR
    expect(dynamicPayload).toContain('AZRIEL SABIQ GAMING GEAR')
    // Checksum verification: last 4 chars must match calculated CRC
    const payloadWithoutCrc = dynamicPayload.slice(0, -4)
    const expectedCrc = calculateCRC16(payloadWithoutCrc)
    expect(dynamicPayload.endsWith(expectedCrc)).toBe(true)
  })
})