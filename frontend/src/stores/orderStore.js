import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'
import { compressImage } from '@/utils/imageUpload'

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
    link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232C4A3E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m12 3-1.9 5.8a1 1 0 0 1-1.3 1.3L3 12l5.8 1.9a1 1 0 0 1 1.3 1.3L12 21l1.9-5.8a1 1 0 0 1 1.3-1.3L21 12l-5.8-1.9a1 1 0 0 1-1.3-1.3Z'/></svg>"
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

// Alfabet kode transaksi: angka + huruf besar tanpa karakter ambigu (I/L/O/U),
// harus sama persis dengan routers/orders.py di backend.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function generateOrderCode() {
  const chars = Array.from({ length: 8 }, () =>
    CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length))
  )
  return `SK-${chars.join('')}`
}

export const useOrderStore = defineStore('order', () => {
  // Menu selalu dari backend FastAPI (tampilkan skeleton selagi memuat).
  const menuItems = ref([])

  async function fetchMenuFromAPI() {
    const res = await api.menu.getAll()
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      menuItems.value = res.data.map((item) => ({
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
    const item = menuItems.value.find((m) => m.id === menuId)
    if (item) {
      item.is_available = !item.is_available
    }
    api.menu.toggle(menuId)
    broadcastChange('MENU_UPDATED', { menuId })
  }

  async function addMenuItem(newItemData) {
    const item = {
      id: newItemData.id || `menu-${Date.now()}`,
      name: newItemData.name,
      category: newItemData.category || 'Kopi Pilihan',
      description: newItemData.description || '',
      price: Number(newItemData.price) || 1,
      image: newItemData.image || '',
      is_available: newItemData.is_available !== false
    }
    menuItems.value.push(item)
    api.menu.create(item)
    broadcastChange('MENU_UPDATED', { menuId: item.id })
    return item
  }

  async function updateMenuItem(id, updatedData) {
    const idx = menuItems.value.findIndex((m) => m.id === id)
    if (idx !== -1) {
      menuItems.value[idx] = {
        ...menuItems.value[idx],
        ...updatedData,
        price: Number(updatedData.price) || menuItems.value[idx].price
      }
      api.menu.update(id, updatedData)
      broadcastChange('MENU_UPDATED', { menuId: id })
    }
  }

  async function deleteMenuItem(id) {
    menuItems.value = menuItems.value.filter((m) => m.id !== id)
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

  const cartCount = computed(() => cart.value.reduce((total, item) => total + item.quantity, 0))

  const subtotal = computed(() =>
    cart.value.reduce((total, item) => total + item.price * item.quantity, 0)
  )

  // Mode Pengujian: Biaya kemasan dan PB1 dibebaskan sehingga harga murni akumulasi item.
  // Verifikasi akhir tetap dihitung server dari harga menu di database.
  const ecoPackagingFee = computed(() => 0)
  const tax = computed(() => 0)
  const grandTotal = computed(() => subtotal.value)

  function addToCart(item, notes = '') {
    if (item.is_available === false) {
      return // item habis tidak bisa ditambahkan
    }
    const existingIndex = cart.value.findIndex((i) => i.id === item.id)
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
    const item = cart.value.find((i) => i.id === id)
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
    const item = cart.value.find((i) => i.id === id)
    if (item) {
      item.notes = notes
      persistCart()
    }
  }

  function removeFromCart(id) {
    cart.value = cart.value.filter((i) => i.id !== id)
    persistCart()
  }

  function clearCart() {
    cart.value = []
    persistCart()
  }

  // Order & History — 100% Single Source of Truth langsung dari backend FastAPI
  const currentOrder = ref(null)
  const orderHistory = ref([])

  // Identitas pelanggan: TANPA akun & tanpa token. Hanya nama + nomor WhatsApp,
  // disimpan lokal agar form checkout tidak diisi ulang. Status pesanan dibaca
  // lewat kode transaksi, bukan lewat login.
  const customer = ref({ name: '', phone: '' })

  if (typeof localStorage !== 'undefined') {
    customer.value = {
      name: localStorage.getItem('sikopi_cust_name') || '',
      phone: localStorage.getItem('sikopi_cust_phone') || ''
    }
  }

  function setCustomer({ name, phone }) {
    customer.value = {
      name: (name || '').trim(),
      phone: (phone || '').trim()
    }
    if (typeof localStorage !== 'undefined') {
      if (customer.value.name) localStorage.setItem('sikopi_cust_name', customer.value.name)
      else localStorage.removeItem('sikopi_cust_name')
      if (customer.value.phone) localStorage.setItem('sikopi_cust_phone', customer.value.phone)
      else localStorage.removeItem('sikopi_cust_phone')
    }
  }

  // Kode transaksi dibuat di client agar nama file bukti bayar sudah terikat ke
  // pesanan sejak sebelum order dikirim. Backend memvalidasi format & keunikan.
  const orderCode = ref('')
  function ensureOrderCode() {
    if (!orderCode.value) orderCode.value = generateOrderCode()
    return orderCode.value
  }

  /** Kompres + unggah bukti pembayaran. Return URL dari backend. */
  async function uploadPaymentProof(file) {
    const code = ensureOrderCode()
    const compressed = await compressImage(file)
    const res = await api.uploads.proof(code, compressed)
    if (!res.ok) {
      throw new Error(res.error || 'Gagal mengunggah bukti pembayaran.')
    }
    return res.data.url
  }

  // Dynamic Branding (Icon & Name)
  const defaultBrandIcon = 'leaf'
  const defaultBrandName = 'SIKopi'

  const brandIcon = ref(defaultBrandIcon)
  const brandName = ref(defaultBrandName)
  const adminWhatsapp = ref('')

  // Satu-satunya mode operasional yang aktif (saling eksklusif).
  // Customer tidak memilih mode — channel pesanan selalu mengikuti ini.
  const activeMode = ref('pos')
  const activeBatch = ref(null)

  const isPreorder = computed(() => activeMode.value === 'preorder')
  const isPreorderOpen = computed(() => isPreorder.value && !!activeBatch.value)

  // Status gateway WhatsApp (khusus panel admin).
  const waConnected = ref(false)
  const waReachable = ref(false)
  const waQr = ref(null)

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
        if (type === 'MODE_UPDATED') {
          fetchPublicSettings()
        }
        if (type === 'ORDER_STATUS_UPDATED' && payload?.orderId) {
          const patch = (ord) => {
            if (payload.orderStatus) ord.orderStatus = payload.orderStatus
            if (payload.payment) ord.payment = { ...ord.payment, ...payload.payment }
          }
          const listed = orderHistory.value.find((o) => o.orderId === payload.orderId)
          if (listed) patch(listed)
          if (currentOrder.value && currentOrder.value.orderId === payload.orderId) {
            patch(currentOrder.value)
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

  /**
   * Satu panggilan mengambil branding + mode + batch aktif + nomor WA admin.
   * Dipakai halaman pelanggan (baca) dan dipanggil ulang setelah admin mengubah
   * mode lewat tab lain.
   */
  async function fetchPublicSettings() {
    const res = await api.settings.getPublic()
    if (!res.ok || !res.data) return res
    const d = res.data
    if (d.brand_icon) {
      brandIcon.value = d.brand_icon
      updateBrowserFavicon(d.brand_icon)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sikopi_brand_icon', d.brand_icon)
      }
    }
    if (d.brand_name) {
      brandName.value = d.brand_name
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sikopi_brand_name', d.brand_name)
      }
    }
    adminWhatsapp.value = d.admin_whatsapp || ''
    if (d.mode === 'preorder' || d.mode === 'pos') {
      activeMode.value = d.mode
    } else {
      // Kompatibilitas respons lama {pos, preorder}: salah satu
      if (d.preorder === true && d.pos !== true) activeMode.value = 'preorder'
      else activeMode.value = 'pos'
    }
    activeBatch.value = d.batch || null
    return res
  }

  async function switchMode(mode) {
    const res = await api.preorder.switchMode(mode)
    if (res.ok && res.data?.mode) {
      activeMode.value = res.data.mode
      activeBatch.value = res.data.batch || null
      broadcastChange('MODE_UPDATED', { mode: activeMode.value })
    }
    return res
  }

  async function fetchWaStatus() {
    const res = await api.wa.getStatus()
    if (res.ok && res.data) {
      waConnected.value = !!res.data.connected
      waReachable.value = res.data.reachable !== false
      waQr.value = res.data.qr || null
    } else {
      waConnected.value = false
      waReachable.value = false
      waQr.value = null
    }
    return res
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
    return await updateBrandingSettings({ icon: defaultBrandIcon, name: defaultBrandName })
  }

  /**
   * Catat pesanan. Channel selalu mengikuti mode aktif global (customer tidak
   * memilih). Server adalah sumber kebenaran: harga, total, kode transaksi,
   * dan penomoran ulang dikirim balik dari backend sehingga struk digital selalu
   * cocok dengan yang tercatat. Setelah tercatat, server otomatis mengirim
   * notifikasi WhatsApp ke nomor customer.
   * @param {object} customerData { name, phone, specialRequest }
   * @param {object} payment { method: 'transfer'|'cash', batchId, paymentProof }
   * @returns {Promise<string>} kode transaksi
   */
  async function placeOrder(customerData, payment) {
    const payload = {
      orderId: ensureOrderCode(),
      channel: activeMode.value,
      batchId: payment.batchId ?? activeBatch.value?.id ?? null,
      paymentProof: payment.paymentProof || null,
      customer: {
        name: (customerData?.name || customer.value.name || '').trim(),
        phone: (customerData?.phone || customer.value.phone || '').trim(),
        specialRequest: customerData?.specialRequest || '-'
      },
      payment: {
        method: payment.method || 'transfer',
        label: payment.method === 'cash' ? 'Bayar di Kasir (Tunai / EDC)' : 'Transfer QRIS + Bukti'
      },
      items: cart.value.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || ''
      }))
      // breakdown sengaja tidak dikirim: server menghitung total dari harga menu.
    }

    const res = await api.orders.create(payload)
    if (!res.ok || !res.data) throw new Error(res.error || 'Gagal menyimpan pesanan ke server.')

    const saved = res.data
    currentOrder.value = saved
    orderHistory.value = [saved, ...orderHistory.value.filter((o) => o.orderId !== saved.orderId)]

    // Sesi customer langsung hilang setelah pesanan tercatat: nama + nomor WA
    // tidak disimpan (localStorage ikut terhapus via setCustomer).
    setCustomer({ name: '', phone: '' })

    broadcastChange('ORDER_CREATED', { orderId: saved.orderId })
    orderCode.value = ''
    clearCart()

    return saved.orderId
  }

  function getOrderById(id) {
    if (currentOrder.value && currentOrder.value.orderId === id) {
      return currentOrder.value
    }
    return orderHistory.value.find((o) => o.orderId === id) || null
  }

  async function refreshOrdersFromDB() {
    const apiRes = await api.orders.getAll()
    if (apiRes.ok && Array.isArray(apiRes.data)) {
      orderHistory.value = apiRes.data
    }
  }

  function handleIncomingOrder(newOrder) {
    if (!newOrder || !newOrder.orderId) return false
    const idx = orderHistory.value.findIndex((o) => o.orderId === newOrder.orderId)
    if (idx === -1) {
      orderHistory.value.unshift(newOrder)
      return true
    }
    orderHistory.value[idx] = newOrder
    return false
  }

  // Initial loads on store setup
  fetchMenuFromAPI()
  fetchPublicSettings()

  return {
    brandIcon,
    brandName,
    adminWhatsapp,
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
    customer,
    setCustomer,
    orderCode,
    ensureOrderCode,
    generateOrderCode,
    uploadPaymentProof,
    activeMode,
    isPreorder,
    activeBatch,
    isPreorderOpen,
    fetchPublicSettings,
    switchMode,
    waConnected,
    waReachable,
    waQr,
    fetchWaStatus,
    refreshOrdersFromDB,
    fetchMenuFromAPI,
    toggleMenuAvailability,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    uploadMenuImage,
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