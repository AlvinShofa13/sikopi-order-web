import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrderStore } from '@/stores/orderStore'

describe('Order Store & Flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes with healthy food items and empty cart', () => {
    const store = useOrderStore()
    expect(store.menuItems.length).toBeGreaterThan(0)
    expect(store.cart.length).toBe(0)
    expect(store.cartCount).toBe(0)
    expect(store.subtotal).toBe(0)
  })

  it('adds item to cart and calculates subtotal and taxes correctly', () => {
    const store = useOrderStore()
    const firstItem = store.menuItems[0]

    store.addToCart(firstItem)
    expect(store.cart.length).toBe(1)
    expect(store.cartCount).toBe(1)
    expect(store.subtotal).toBe(1)
    expect(store.ecoPackagingFee).toBe(0)
    expect(store.tax).toBe(0)
    expect(store.grandTotal).toBe(1)
  })

  it('updates quantity and removes item when quantity reaches zero', () => {
    const store = useOrderStore()
    const firstItem = store.menuItems[0]

    store.addToCart(firstItem)
    store.updateQuantity(firstItem.id, 1)
    expect(store.cart[0].quantity).toBe(2)

    store.updateQuantity(firstItem.id, -2)
    expect(store.cart.length).toBe(0)
    expect(store.cartCount).toBe(0)
  })

  it('places order, generates order number, and clears active cart', () => {
    const store = useOrderStore()
    store.addToCart(store.menuItems[0])

    const customerData = {
      name: 'Budi Santoso',
      phone: '08123456789',
      orderType: 'Makan di Tempat',
      tableOrAddress: 'Meja 05'
    }

    const paymentDetails = {
      method: 'qris',
      label: 'QRIS'
    }

    const orderId = store.placeOrder(customerData, paymentDetails)
    expect(orderId).toMatch(/^HYT-2026-\d{5}$/)
    expect(store.cart.length).toBe(0)
    expect(store.currentOrder).not.toBeNull()
    expect(store.currentOrder.orderId).toBe(orderId)
    expect(store.getOrderById(orderId)).not.toBeNull()
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

  it('generates a 3-digit active token and allows generating new tokens', () => {
    const store = useOrderStore()
    expect(store.activeToken).toMatch(/^\d{3}$/)
    const newToken = store.generateNewToken()
    expect(newToken).toMatch(/^\d{3}$/)
    expect(store.activeToken).toBe(newToken)
  })

  it('validates customer token and saves customer session name', () => {
    const store = useOrderStore()
    const token = store.activeToken

    // Invalid token fails
    const failRes = store.verifyAndSetCustomer('Rian', '9999')
    expect(failRes.success).toBe(false)
    expect(store.customerSession.isVerified).toBe(false)

    // Valid token succeeds
    const successRes = store.verifyAndSetCustomer('Rian Anggoro', token)
    expect(successRes.success).toBe(true)
    expect(store.customerSession.isVerified).toBe(true)
    expect(store.customerSession.name).toBe('Rian Anggoro')

    // placeOrder uses verified customer session name
    store.addToCart(store.menuItems[0])
    const orderId = store.placeOrder({}, { method: 'cash', label: 'Kasir' })
    const createdOrder = store.getOrderById(orderId)
    expect(createdOrder.customer.name).toBe('Rian Anggoro')
  })

  it('strictly enforces one-time token use: burns token upon placeOrder and prevents reuse', () => {
    const store = useOrderStore()
    const initialToken = store.activeToken

    // Customer verifies with current token
    const authResult = store.verifyAndSetCustomer('Dewi Sartika', initialToken)
    expect(authResult.success).toBe(true)
    expect(store.customerSession.isVerified).toBe(true)

    // Customer adds items and places order
    store.addToCart(store.menuItems[0])
    const orderId = store.placeOrder({}, { method: 'cash', label: 'Kasir' })
    const createdOrder = store.getOrderById(orderId)
    expect(createdOrder.customer.name).toBe('Dewi Sartika')

    // Token must be burned and marked in usedTokens
    expect(store.usedTokens).toContain(initialToken)
    expect(store.isTokenUsed(initialToken)).toBe(true)

    // Customer session must be reset for next order
    expect(store.customerSession.isVerified).toBe(false)
    expect(store.customerSession.name).toBe('')

    // A brand new active token must be generated
    expect(store.activeToken).not.toBe(initialToken)
    expect(store.activeToken).toMatch(/^\d{3}$/)

    // Attempting to reuse the burned initialToken returns isCompletedOrder and orderId for customer order page redirect
    const reuseAttempt = store.verifyAndSetCustomer('Dewi Sartika', initialToken)
    expect(reuseAttempt.success).toBe(false)
    expect(reuseAttempt.isCompletedOrder).toBe(true)
    expect(reuseAttempt.orderId).toBe(orderId)
    expect(reuseAttempt.message).toContain('sudah menyelesaikan pesanan')
  })
})

