import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'

/**
 * Dinamis memperbarui ikon tab browser (favicon) sesuai konfigurasi admin SIKopi
 */
export function updateBrowserFavicon(icon) {
  if (typeof document === 'undefined') return

  let link = document.querySelector("link[rel*='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  // 1. Default Leaf Icon (Daun Hijau Organik SIKopi)
  if (!icon || icon === 'leaf') {
    link.type = 'image/svg+xml'
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/></svg>"
    return
  }

  // 2. Preset Cangkir Kopi
  if (icon === 'coffee') {
    link.type = 'image/svg+xml'
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 2v2'/><path d='M14 2v2'/><path d='M16 8a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z'/><path d='M6 2v2'/><path d='M17 9h1a3 3 0 0 1 0 6h-1'/><path d='M6 19h12'/></svg>"
    return
  }

  // 3. Preset Kilau / Sparkles
  if (icon === 'sparkles') {
    link.type = 'image/svg+xml'
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z'/></svg>"
    return
  }

  // 4. Preset Heart / Cinta
  if (icon === 'heart') {
    link.type = 'image/svg+xml'
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'/></svg>"
    return
  }

  // 5. Preset Shield Check
  if (icon === 'shield-check') {
    link.type = 'image/svg+xml'
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/><path d='m9 12 2 2 4-4'/></svg>"
    return
  }

  // 6. Custom Upload Image URL (SVG/PNG/JPG)
  link.type = icon.includes('.svg') ? 'image/svg+xml' : 'image/png'
  link.href = icon
}

export const useOrderStore = defineStore('order', () => {
  // Menu selalu dari backend FastAPI (tampilkan skeleton selagi memuat).
  const menuItems = ref([])

  // Load saved menu from localStorage if modified locally
  // Menu items list — 100% Single Source of Truth directly from backend FastAPI database
  async function fetchMenuFromAPI() {
    const res = await api.menu.getAll()
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      menuItems.value = res.data.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category || 'Kopi Pilihan',
        description: item.description || '',
        price: Number(item.price) || 1,
        image: item.image || '',
        is_available: item.is_available !== false
      }))
    }
  }

  async function toggleMenuAvailability(menuId) {
    const item = menuItems.value.find(m => m.id === menuId)
    if (item) {
      item.is_available = !item.is_available
    }
    // Sync with FastAPI backend
    api.menu.toggle(menuId)
    broadcastChange('MENU_UPDATED', { menuId })
  }

  async function addMenuItem(newItemData) {
    const id = newItemData.id || `menu-${Date.now()}`
    const item = {
      id,
      name: newItemData.name,
      category: newItemData.category || 'Kopi Pilihan',
      description: newItemData.description || '',
      price: Number(newItemData.price) || 1,
      image: newItemData.image || '',
      is_available: newItemData.is_available !== false
    }
    menuItems.value.push(item)

    // Sync with FastAPI
    api.menu.create(item)
    broadcastChange('MENU_UPDATED', { menuId: id })
    return item
  }

  async function updateMenuItem(id, updatedData) {
    const idx = menuItems.value.findIndex(m => m.id === id)
    if (idx !== -1) {
      menuItems.value[idx] = {
        ...menuItems.value[idx],
        ...updatedData,
        price: Number(updatedData.price) || menuItems.value[idx].price
      }
      // Sync with FastAPI
      api.menu.update(id, updatedData)
      broadcastChange('MENU_UPDATED', { menuId: id })
    }
  }

  async function deleteMenuItem(id) {
    menuItems.value = menuItems.value.filter(m => m.id !== id)
    api.menu.delete(id)
    broadcastChange('MENU_UPDATED', { menuId: id })
  }

  async function uploadMenuImage(file) {
    const res = await api.menu.uploadImage(file)
    if (!res.ok) {
      throw new Error(res.error || 'Gagal mengunggah file gambar ke server backend.')
    }
    return res.data.url
  }

  // Cart state
  const cart = ref([])

  // Load saved cart from localStorage if exists
  if (typeof localStorage !== 'undefined') {
    const savedCart = localStorage.getItem('hayati_cart')
    if (savedCart) {
      try {
        cart.value = JSON.parse(savedCart)
      } catch {
        cart.value = []
      }
    }
  }

  const persistCart = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hayati_cart', JSON.stringify(cart.value))
    }
  }

  // Cart calculations
  const cartCount = computed(() => {
    return cart.value.reduce((total, item) => total + item.quantity, 0)
  })

  const subtotal = computed(() => {
    return cart.value.reduce((total, item) => total + (item.price * item.quantity), 0)
  })

  // Mode Pengujian: Biaya kemasan dan PB1 dibebaskan sehingga harga murni Rp 1 per porsi
  const ecoPackagingFee = computed(() => 0)
  const tax = computed(() => 0)
  const grandTotal = computed(() => subtotal.value)

  // Cart Actions
  function addToCart(item, notes = '') {
    if (item.is_available === false) {
      return // item habis tidak bisa ditambahkan
    }
    const existingIndex = cart.value.findIndex(i => i.id === item.id)
    if (existingIndex > -1) {
      cart.value[existingIndex].quantity += 1
      if (notes) {
        cart.value[existingIndex].notes = notes
      }
    } else {
      cart.value.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        calories: item.calories,
        dietInfo: item.dietInfo,
        quantity: 1,
        notes: notes || ''
      })
    }
    persistCart()
  }

  function updateQuantity(id, change) {
    const item = cart.value.find(i => i.id === id)
    if (!item) return

    const newQty = item.quantity + change
    if (newQty <= 0) {
      removeFromCart(id)
    } else {
      item.quantity = newQty
      persistCart()
    }
  }

  function updateItemNotes(id, notes) {
    const item = cart.value.find(i => i.id === id)
    if (item) {
      item.notes = notes
      persistCart()
    }
  }

  function removeFromCart(id) {
    cart.value = cart.value.filter(i => i.id !== id)
    persistCart()
  }

  function clearCart() {
    cart.value = []
    persistCart()
  }

  // Order & History — 100% Single Source of Truth directly from backend FastAPI database
  const currentOrder = ref(null)
  const orderHistory = ref([])

  // 3-digit Token generation utility (100 - 999)
  function generate3DigitToken() {
    return String(Math.floor(100 + Math.random() * 900))
  }

  // Used / Burned tokens mapping (reactive state; keys = token)
  const usedTokensMap = ref({})

  function markTokenAsUsed(token, orderId = null, customerName = 'Pelanggan') {
    if (!token) return
    const clean = String(token).trim()
    usedTokensMap.value[clean] = {
      orderId: orderId || null,
      customerName: customerName || 'Pelanggan',
      burnedAt: new Date().toISOString()
    }
  }

  function isTokenUsed(token) {
    if (!token) return false
    return Boolean(usedTokensMap.value[String(token).trim()])
  }

  // Active 3-digit Token state - always initialize with a random valid 3-digit token
  const activeToken = ref(generate3DigitToken())
  const tokenGeneratedAt = ref(new Date().toISOString())

  // Customer Session state
  const customerSession = ref({
    name: '',
    token: '',
    isVerified: false
  })

  // Global Auth Modal state
  const authModalOpen = ref(false)

  function openAuthModal() {
    authModalOpen.value = true
  }

  function closeAuthModal() {
    authModalOpen.value = false
  }

  // Dynamic Branding (Icon & Name)
  const defaultBrandIcon = 'leaf'
  const defaultBrandName = 'SIKopi'

  const brandIcon = ref(defaultBrandIcon)
  const brandName = ref(defaultBrandName)

  if (typeof localStorage !== 'undefined') {
    const savedIcon = localStorage.getItem('sikopi_brand_icon')
    if (savedIcon) {
      brandIcon.value = savedIcon
      updateBrowserFavicon(savedIcon)
    } else {
      updateBrowserFavicon(defaultBrandIcon)
    }
    const savedName = localStorage.getItem('sikopi_brand_name')
    if (savedName) brandName.value = savedName
  } else {
    updateBrowserFavicon(defaultBrandIcon)
  }

  // Cross-Tab BroadcastChannel
  let syncChannel = null
  if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new window.BroadcastChannel('sikopi_realtime_sync')
      syncChannel.onmessage = (event) => {
        const { type, payload } = event.data || {}
        if (type === 'TOKEN_ROTATED' && payload?.token) {
          activeToken.value = payload.token
          tokenGeneratedAt.value = payload.time || new Date().toISOString()
        }
        if (type === 'ORDER_CREATED') {
          refreshOrdersFromDB()
        }
        if (type === 'MENU_UPDATED') {
          fetchMenuFromAPI()
        }
        if (type === 'BRANDING_UPDATED' && payload) {
          if (payload.brand_icon) {
            brandIcon.value = payload.brand_icon
            updateBrowserFavicon(payload.brand_icon)
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('sikopi_brand_icon', payload.brand_icon)
            }
          }
          if (payload.brand_name) {
            brandName.value = payload.brand_name
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('sikopi_brand_name', payload.brand_name)
            }
          }
        }
        if (type === 'ORDER_STATUS_UPDATED' && payload?.orderId) {
          const ord = orderHistory.value.find(o => o.orderId === payload.orderId)
          if (ord) {
            if (payload.orderStatus) ord.orderStatus = payload.orderStatus
            if (payload.payment) ord.payment = { ...ord.payment, ...payload.payment }
            if (payload.is_paid !== undefined && ord.payment) {
              ord.payment.paid = payload.is_paid
              if (payload.is_paid) ord.payment.status = 'Lunas'
            }
          }
          if (currentOrder.value && currentOrder.value.orderId === payload.orderId) {
            if (payload.orderStatus) currentOrder.value.orderStatus = payload.orderStatus
            if (payload.payment) currentOrder.value.payment = { ...currentOrder.value.payment, ...payload.payment }
            if (payload.is_paid !== undefined && currentOrder.value.payment) {
              currentOrder.value.payment.paid = payload.is_paid
              if (payload.is_paid) currentOrder.value.payment.status = 'Lunas'
            }
          }
        }
      }
    } catch {
      syncChannel = null
    }
  }

  function broadcastChange(type, payload) {
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type, payload })
      } catch {
        // ignore
      }
    }
  }

  function broadcastOrderStatusUpdate(orderId, patchData = {}) {
    broadcastChange('ORDER_STATUS_UPDATED', { orderId, ...patchData })
  }

  async function fetchBrandingSettings() {
    try {
      const res = await api.settings.getBranding()
      if (res.ok && res.data) {
        if (res.data.brand_icon) {
          brandIcon.value = res.data.brand_icon
          updateBrowserFavicon(res.data.brand_icon)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sikopi_brand_icon', res.data.brand_icon)
          }
        }
        if (res.data.brand_name) {
          brandName.value = res.data.brand_name
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sikopi_brand_name', res.data.brand_name)
          }
        }
      }
    } catch {
      // Fallback to local
    }
  }

  async function updateBrandingSettings({ icon, name } = {}) {
    const newIcon = icon !== undefined ? icon : brandIcon.value
    const newName = name !== undefined ? name : brandName.value

    brandIcon.value = newIcon
    brandName.value = newName
    updateBrowserFavicon(newIcon)

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sikopi_brand_icon', newIcon)
      localStorage.setItem('sikopi_brand_name', newName)
    }

    broadcastChange('BRANDING_UPDATED', { brand_icon: newIcon, brand_name: newName })

    try {
      const res = await api.settings.updateBranding({
        brand_icon: newIcon,
        brand_name: newName
      })
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function resetBrandingToDefault() {
    return await updateBrandingSettings({
      icon: defaultBrandIcon,
      name: defaultBrandName
    })
  }

  function generateNewToken() {
    let newToken = generate3DigitToken()
    let attempts = 0
    while (usedTokensMap.value[newToken] && attempts < 100) {
      newToken = generate3DigitToken()
      attempts++
    }
    activeToken.value = newToken
    tokenGeneratedAt.value = new Date().toISOString()

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sikopi_active_token', activeToken.value)
      localStorage.setItem('sikopi_token_time', tokenGeneratedAt.value)
    }
    broadcastChange('TOKEN_ROTATED', { token: activeToken.value, time: tokenGeneratedAt.value })

    // Sync with FastAPI in background
    api.tokens.generate().catch(() => {})

    return activeToken.value
  }

  async function fetchActiveToken() {
    const res = await api.tokens.getActive()
    if (res.ok && res.data?.activeToken) {
      activeToken.value = res.data.activeToken
      tokenGeneratedAt.value = res.data.time || new Date().toISOString()
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sikopi_active_token', activeToken.value)
      }
    }
  }

  // Initialize active token & customer session from localStorage if saved
  if (typeof localStorage !== 'undefined') {
    const savedToken = localStorage.getItem('sikopi_active_token')
    if (savedToken && !usedTokensMap.value[savedToken]) {
      activeToken.value = savedToken
      tokenGeneratedAt.value = localStorage.getItem('sikopi_token_time') || new Date().toISOString()
    }

    const savedName = localStorage.getItem('sikopi_cust_name')
    const savedCustToken = localStorage.getItem('sikopi_cust_token')
    const isVerified = localStorage.getItem('sikopi_cust_verified') === 'true'

    if (savedName && isVerified && savedCustToken && !usedTokensMap.value[savedCustToken]) {
      customerSession.value = {
        name: savedName,
        token: savedCustToken,
        isVerified: true
      }
    } else if (savedCustToken && usedTokensMap.value[savedCustToken]) {
      clearCustomerSession()
    }
  }

  // Verify and Set Customer: immediate check + background sync
  function verifyAndSetCustomer(name, token) {
    const cleanName = (name || '').trim()
    const cleanToken = (token || '').trim()

    if (!cleanName) {
      return { success: false, message: 'Silakan masukkan nama lengkap atau panggilan Anda.' }
    }
    if (!cleanToken) {
      return { success: false, message: 'Silakan masukkan token 3 digit.' }
    }

    // 1. Check local orderHistory
    const existingOrder = orderHistory.value.find(o => o.customer?.token === cleanToken)
    if (existingOrder) {
      return {
        success: false,
        isCompletedOrder: true,
        orderId: existingOrder.orderId,
        message: `Token "${cleanToken}" sudah menyelesaikan pesanan #${existingOrder.orderId}. Mengalihkan ke rincian pesanan Anda...`
      }
    }

    // 2. Check local burned tokens
    const burnedInfo = usedTokensMap.value[cleanToken]
    if (burnedInfo) {
      const linkedOrderId = burnedInfo?.orderId || null
      return {
        success: false,
        isCompletedOrder: Boolean(linkedOrderId),
        orderId: linkedOrderId,
        message: linkedOrderId
          ? `Token "${cleanToken}" sudah menyelesaikan pesanan #${linkedOrderId}. Mengalihkan ke rincian pesanan Anda...`
          : `Token "${cleanToken}" sudah digunakan dan hangus. Silakan minta token baru ke kasir.`
      }
    }

    if (cleanToken !== activeToken.value) {
      return {
        success: false,
        message: `Token "${cleanToken}" tidak cocok. Silakan minta token 3 digit aktif ke kasir/admin.`
      }
    }

    customerSession.value = {
      name: cleanName,
      token: cleanToken,
      isVerified: true
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sikopi_cust_name', cleanName)
      localStorage.setItem('sikopi_cust_token', cleanToken)
      localStorage.setItem('sikopi_cust_verified', 'true')
    }

    // Immediately rotate new token for next customer at cashier
    generateNewToken()

    // Server otoritatif: adopsi token hasil rotasi server agar client
    // tidak divergen (server memutar token setiap verify sukses).
    api.tokens.verify(cleanName, cleanToken).then((res) => {
      const srv = res && res.ok && res.data && res.data.newToken ? String(res.data.newToken) : ''
      if (srv && srv !== activeToken.value) {
        activeToken.value = srv
        tokenGeneratedAt.value = new Date().toISOString()
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sikopi_active_token', activeToken.value)
          localStorage.setItem('sikopi_token_time', tokenGeneratedAt.value)
        }
        broadcastChange('TOKEN_ROTATED', { token: activeToken.value, time: tokenGeneratedAt.value })
      }
    }).catch(() => {})

    return { success: true }
  }

  // Verifikasi online dengan server backend: memeriksa pesanan selesai & token aktif
  async function verifyCustomerTokenOnline(name, token) {
    const cleanName = (name || '').trim()
    const cleanToken = (token || '').trim()

    // Cek synchronous lokal dulu
    const localRes = verifyAndSetCustomer(cleanName, cleanToken)
    if (localRes.success || localRes.isCompletedOrder) {
      return localRes
    }

    // Jika tidak cocok secara lokal, periksa langsung ke server backend database
    try {
      const res = await api.tokens.verify(cleanName, cleanToken)
      if (res.ok && res.data) {
        if (res.data.isCompletedOrder && res.data.orderId) {
          return {
            success: false,
            isCompletedOrder: true,
            orderId: res.data.orderId,
            message: res.data.message || `Token "${cleanToken}" sudah menyelesaikan pesanan #${res.data.orderId}. Mengalihkan ke rincian pesanan Anda...`
          }
        }
        if (res.data.success) {
          customerSession.value = {
            name: cleanName,
            token: cleanToken,
            isVerified: true
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sikopi_cust_name', cleanName)
            localStorage.setItem('sikopi_cust_token', cleanToken)
            localStorage.setItem('sikopi_cust_verified', 'true')
          }
          if (res.data.newToken) {
            activeToken.value = String(res.data.newToken)
            tokenGeneratedAt.value = new Date().toISOString()
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('sikopi_active_token', activeToken.value)
              localStorage.setItem('sikopi_token_time', tokenGeneratedAt.value)
            }
            broadcastChange('TOKEN_ROTATED', { token: activeToken.value, time: tokenGeneratedAt.value })
          }
          return { success: true }
        } else {
          return {
            success: false,
            isCompletedOrder: res.data.isCompletedOrder || false,
            orderId: res.data.orderId || null,
            message: res.data.message || localRes.message
          }
        }
      }
    } catch {
      // offline fallback
    }

    return localRes
  }

  function clearCustomerSession() {
    customerSession.value = {
      name: '',
      token: '',
      isVerified: false
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sikopi_cust_name')
      localStorage.removeItem('sikopi_cust_token')
      localStorage.removeItem('sikopi_cust_verified')
    }
  }

  // Create an order (server authoritative: gagal simpan = gagal total,
  // cart & sesi utuh agar pelanggan bisa coba lagi)
  async function placeOrder(customerData, paymentDetails) {
    const randomSeq = Math.floor(10000 + Math.random() * 90000)
    const orderNumber = `HYT-2026-${randomSeq}`
    const orderDate = new Date().toISOString()

    const isQris = paymentDetails.method === 'qris'
    const resolvedCustomerName = customerData?.name?.trim() || customerSession.value.name?.trim() || 'Pelanggan'
    const tokenUsed = customerSession.value.token || activeToken.value

    const orderPayload = {
      orderId: orderNumber,
      createdAt: orderDate,
      customer: {
        name: resolvedCustomerName,
        phone: customerData?.phone || '-',
        token: tokenUsed,
        orderType: customerData?.orderType || 'Makan di Tempat',
        tableOrAddress: customerData?.tableOrAddress || 'Meja Reguler',
        specialRequest: customerData?.specialRequest || '-'
      },
      payment: {
        method: paymentDetails.method,
        label: paymentDetails.label || (isQris ? 'QRIS' : 'Bayar di Kasir (Tunai / EDC)'),
        reference: paymentDetails.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'Menunggu Pembayaran'
      },
      items: JSON.parse(JSON.stringify(cart.value)),
      breakdown: {
        subtotal: subtotal.value,
        ecoFee: ecoPackagingFee.value,
        tax: tax.value,
        total: grandTotal.value
      },
      orderStatus: 'Diterima & Disiapkan'
    }

    // Simpan ke backend dulu; 409 = token sudah dipakai (double-burn ditolak)
    if (import.meta.env.MODE !== 'test') {
      const res = await api.orders.create({
        customer: orderPayload.customer,
        payment: orderPayload.payment,
        items: orderPayload.items,
        breakdown: orderPayload.breakdown
      })
      if (!res.ok) throw new Error(res.error || 'Gagal menyimpan pesanan ke server.')
    }

    currentOrder.value = orderPayload
    orderHistory.value.unshift(orderPayload)

    // Burn token used
    if (tokenUsed) {
      markTokenAsUsed(tokenUsed, orderNumber, resolvedCustomerName)
    }

    broadcastChange('ORDER_CREATED', { orderId: orderNumber })
    generateNewToken()
    clearCustomerSession()
    clearCart()

    return orderNumber
  }


  function getOrderById(id) {
    if (currentOrder.value && currentOrder.value.orderId === id) {
      return currentOrder.value
    }
    return orderHistory.value.find(o => o.orderId === id) || null
  }

  async function refreshOrdersFromDB() {
    // Fetch directly from FastAPI backend database
    const apiRes = await api.orders.getAll()
    if (apiRes.ok && Array.isArray(apiRes.data)) {
      orderHistory.value = apiRes.data
    }
  }

  function handleIncomingOrder(newOrder) {
    if (!newOrder || !newOrder.orderId) return false
    const idx = orderHistory.value.findIndex(o => o.orderId === newOrder.orderId)
    if (idx === -1) {
      orderHistory.value.unshift(newOrder)
      return true
    } else {
      orderHistory.value[idx] = newOrder
      return false
    }
  }

  async function fetchBurnedTokens() {
    // Fetch burned tokens from FastAPI backend database
    const res = await api.tokens.getBurned()
    if (res.ok && res.data) {
      usedTokensMap.value = { ...usedTokensMap.value, ...res.data }
    }
  }

  // Initial loads on store setup
  fetchMenuFromAPI()
  fetchActiveToken()
  fetchBurnedTokens()
  fetchBrandingSettings()

  return {
    brandIcon,
    brandName,
    fetchBrandingSettings,
    updateBrandingSettings,
    resetBrandingToDefault,
    updateBrowserFavicon,
    menuItems,
    handleIncomingOrder,
    cart,
    cartCount,
    subtotal,
    ecoPackagingFee,
    tax,
    grandTotal,
    currentOrder,
    orderHistory,
    activeToken,
    tokenGeneratedAt,
    usedTokensMap,
    markTokenAsUsed,
    isTokenUsed,
    customerSession,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    generateNewToken,
    fetchActiveToken,
    verifyAndSetCustomer,
    verifyCustomerTokenOnline,
    clearCustomerSession,
    refreshOrdersFromDB,
    fetchMenuFromAPI,
    toggleMenuAvailability,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    uploadMenuImage,
    fetchBurnedTokens,
    addToCart,
    updateQuantity,
    updateItemNotes,
    removeFromCart,
    clearCart,
    placeOrder,
    getOrderById,
    broadcastOrderStatusUpdate
  }
})
