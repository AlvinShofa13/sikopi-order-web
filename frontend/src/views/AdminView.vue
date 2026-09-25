<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import { useAdminStore } from '@/stores/adminStore'
import AppIcon from '@/components/icons/AppIcon.vue'
import { api } from '@/services/api'
import { formatRupiah, isCustomImage, createToast } from '@/utils/format'
import { topMenus, paymentBreakdown, ordersToCsv, downloadFromUrl } from '@/utils/salesAnalytics'
import { isBluetoothSupported, printReceiptViaBluetooth, getSavedPrinterName, forgetBluetoothPrinter } from '@/utils/bluetoothPrinter'
import { generateDynamicQrisPayload, generateQrisDataUrl, getQrisImageUrl } from '@/utils/qris'

const router = useRouter()
const store = useOrderStore()
const adminStore = useAdminStore()

// Login form state (never prefill credentials)
const inputEmail = ref('')
const inputPassword = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)

// Dashboard state
const searchQuery = ref('')
const selectedOrder = ref(null)
const isPrinting = ref(false)
const printMessage = ref('')
const { toastMessage, toastType, showToast } = createToast()
const copied = ref(false)
const activeTab = ref('orders') // 'orders' | 'menus' | 'tokens' | 'analisis' | 'branding'

// Bluetooth printing & paper configuration
const paperWidth = ref(32) // 32 = 58mm, 48 = 80mm
const tearDelaySeconds = ref(7) // Jeda 7 detik antara struk dapur & struk pelanggan
const isWaitingTear = ref(false)
const tearCountdown = ref(7)
const savedPrinterName = ref('')
let tearResolveFn = null

// Menu management form modal state
const showMenuModal = ref(false)
const isEditingMenu = ref(false)
const isUploadingImage = ref(false)
const imageFileInputRef = ref(null)
const showUrlInput = ref(false)
const menuForm = ref({
  id: '',
  name: '',
  category: 'Kopi Pilihan',
  description: '',
  price: 1,
  image: '',
  is_available: true
})

// Realtime Synchronization & Audio Chime
const isRealtimeActive = ref(false)
let wsClient = null
let wsReconnectTimer = null
let pollTimer = null
let prevOrderCount = 0

function playNewOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    
    // First tone (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.28)

    // Second tone (A5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.12)
    gain2.gain.setValueAtTime(0.25, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.5)
  } catch {
    // Browser audio autoplay restrictions caught safely
  }
}

function connectWebSocket() {
  try {
    if (wsClient) {
      wsClient.close()
      wsClient = null
    }

    const wsToken = adminStore.authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('sikopi_admin_token') : '') || ''
    const wsUrl = api.orders.wsUrl(wsToken)

    wsClient = new WebSocket(wsUrl)

    wsClient.onopen = () => {
      isRealtimeActive.value = true
    }

    wsClient.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'NEW_ORDER' && data.order) {
          const isNew = store.handleIncomingOrder(data.order)
          if (isNew) {
            playNewOrderChime()
            showToast(`🔔 Pesanan Baru Masuk! #${data.order.orderId} (${data.order.customer?.name || 'Pelanggan'})`, 'success')
          }
        } else if (data.event === 'STATUS_UPDATED' && data.order) {
          const idx = store.orderHistory.findIndex(o => o.orderId === data.order.orderId)
          if (idx !== -1) {
            store.orderHistory[idx] = data.order
          }
          if (selectedOrder.value && selectedOrder.value.orderId === data.order.orderId) {
            selectedOrder.value = data.order
          }
        }
      } catch {
        // ignore non-json messages
      }
    }

    wsClient.onclose = (event) => {
      isRealtimeActive.value = false
      // 4401 = sesi admin tidak valid: jangan reconnect membabi-buta.
      if (event && event.code === 4401) {
        showToast('Sesi admin berakhir. Silakan login ulang.', 'error')
        return
      }
      if (adminStore.isAuthenticated) {
        wsReconnectTimer = setTimeout(connectWebSocket, 3000)
      }
    }

    wsClient.onerror = () => {
      isRealtimeActive.value = false
    }
  } catch {
    isRealtimeActive.value = false
  }
}

async function syncRealtimeOrders() {
  await store.refreshOrdersFromDB()
  const newCount = store.orderHistory.length
  if (prevOrderCount > 0 && newCount > prevOrderCount) {
    playNewOrderChime()
    showToast('🔔 Pesanan Baru Masuk!', 'success')
  }
  prevOrderCount = newCount
}

function startRealtimeSync() {
  connectWebSocket()
  syncRealtimeOrders()
  // 3-second heartbeat polling fallback for guaranteed sync
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(syncRealtimeOrders, 3000)
}

function stopRealtimeSync() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  if (pollTimer) clearInterval(pollTimer)
  if (wsClient) {
    wsClient.close()
    wsClient = null
  }
  isRealtimeActive.value = false
}

onMounted(() => {
  savedPrinterName.value = getSavedPrinterName()
  if (adminStore.isAuthenticated) {
    store.fetchMenuFromAPI()
    store.fetchActiveToken()
    store.fetchBurnedTokens()
    startRealtimeSync()
  }
})

onUnmounted(() => {
  stopRealtimeSync()
})

// Data Computeds
const activeToken = computed(() => store.activeToken)
const orderHistory = computed(() => store.orderHistory)
const menuItems = computed(() => store.menuItems)
const usedTokensMap = computed(() => store.usedTokensMap || {})

// ---- Sales analytics (server stats preferred, local fallback) ----
// Visual murni CSS (rank bars + legend); tanpa chart lib.
const salesStats = ref(null)
const statsLoading = ref(false)
const isExporting = ref(false)

const analyticsTopMenus = computed(() => {
  if (salesStats.value?.top_menus?.length) return salesStats.value.top_menus
  return topMenus(orderHistory.value, 10)
})

const analyticsPayments = computed(() => {
  if (salesStats.value?.payment_methods?.length) return salesStats.value.payment_methods
  return paymentBreakdown(orderHistory.value)
})

const topMenuMaxQty = computed(() => Math.max(1, ...analyticsTopMenus.value.map(m => m.qty || 0)))

async function fetchSalesStats() {
  statsLoading.value = true
  try {
    const res = await api.orders.getStats()
    if (res.ok) salesStats.value = res.data
  } catch {
    // fallback lokal via computed
  } finally {
    statsLoading.value = false
  }
}

function openAnalyticsTab() {
  activeTab.value = 'analisis'
  fetchSalesStats()
}

async function handleExport(format) {
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `penjualan-sikopi-${stamp}.${format}`
  isExporting.value = true
  try {
    const res = await fetch(api.orders.exportUrl(format))
    if (!res.ok) throw new Error(`Server ${res.status}`)
    downloadFromUrl(URL.createObjectURL(await res.blob()), filename)
    showToast(`File ${filename} berhasil diunduh.`)
  } catch {
    if (format === 'csv') {
      // Fallback lokal: rakit CSV dari data yang sudah ada
      downloadFromUrl(URL.createObjectURL(new Blob([ordersToCsv(filteredOrders.value)], { type: 'text/csv;charset=utf-8' })), filename)
      showToast('Server tidak terjangkau, CSV dirakit dari data lokal.')
    } else {
      showToast('Gagal mengunduh Excel dari server. Pastikan backend berjalan.', 'error')
    }
  } finally {
    isExporting.value = false
  }
}

const totalRevenue = computed(() => {
  return orderHistory.value.reduce((sum, ord) => sum + (ord.breakdown?.total || 0), 0)
})

const totalPortionsSold = computed(() => {
  return orderHistory.value.reduce((sum, ord) => {
    return sum + (ord.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 0)
  }, 0)
})

const filteredOrders = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return orderHistory.value
  return orderHistory.value.filter(ord => {
    return ord.orderId.toLowerCase().includes(query) ||
      (ord.customer?.name || '').toLowerCase().includes(query) ||
      (ord.customer?.token || '').includes(query) ||
      (ord.payment?.label || '').toLowerCase().includes(query)
  })
})

async function handleLogin() {
  loginError.value = ''
  isLoggingIn.value = true

  const res = await adminStore.login(inputEmail.value, inputPassword.value)
  isLoggingIn.value = false

  if (!res.success) {
    loginError.value = res.message
    return
  }

  store.fetchMenuFromAPI()
  store.fetchActiveToken()
  startRealtimeSync()
  showToast('Selamat datang di Panel Admin & Kasir SIKopi!')
}

function handleLogout() {
  stopRealtimeSync()
  adminStore.logout()
  showToast('Anda telah keluar dari sesi admin.')
}

async function handleGenerateNewToken() {
  const newToken = await store.generateNewToken()
  showToast(`Token 3 digit baru berhasil dibuat: ${newToken}`)
}

function handleCopyToken() {
  if (!activeToken.value) return
  navigator.clipboard.writeText(activeToken.value)
  copied.value = true
  showToast(`Token ${activeToken.value} berhasil disalin`)
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function openOrderDetail(order) {
  selectedOrder.value = order
  savedPrinterName.value = getSavedPrinterName()
}

function closeOrderDetail() {
  selectedOrder.value = null
}

function goToCustomerMenu() {
  router.push('/menu')
}

// Menu Management Actions & Image Upload
function triggerFileInput() {
  if (imageFileInputRef.value) {
    imageFileInputRef.value.click()
  }
}

async function handleFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  // Batas ukuran 10MB
  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran file gambar maksimal 10MB.', 'error')
    event.target.value = ''
    return
  }

  isUploadingImage.value = true
  try {
    const uploadedUrl = await store.uploadMenuImage(file)
    menuForm.value.image = uploadedUrl
    showToast('File gambar berhasil diunggah dan disimpan di backend!')
  } catch (err) {
    showToast(err.message || 'Gagal mengunggah file gambar ke backend.', 'error')
  } finally {
    isUploadingImage.value = false
    event.target.value = ''
  }
}

function removeMenuImage() {
  menuForm.value.image = ''
}

function openAddMenuModal() {
  isEditingMenu.value = false
  isUploadingImage.value = false
  showUrlInput.value = false
  menuForm.value = {
    id: `menu-${Date.now()}`,
    name: '',
    category: 'Kopi Pilihan',
    description: '',
    price: 1,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&auto=format&fit=crop&q=80',
    is_available: true
  }
  showMenuModal.value = true
}

function openEditMenuModal(item) {
  isEditingMenu.value = true
  isUploadingImage.value = false
  showUrlInput.value = !!(item.image && item.image.startsWith('http'))
  menuForm.value = {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    price: item.price,
    image: item.image,
    is_available: item.is_available !== false
  }
  showMenuModal.value = true
}

async function saveMenuForm() {
  if (!menuForm.value.name.trim()) {
    showToast('Nama menu wajib diisi.', 'error')
    return
  }

  if (isEditingMenu.value) {
    await store.updateMenuItem(menuForm.value.id, menuForm.value)
    showToast(`Menu "${menuForm.value.name}" berhasil diperbarui.`)
  } else {
    await store.addMenuItem(menuForm.value)
    showToast(`Menu "${menuForm.value.name}" berhasil ditambahkan.`)
  }

  showMenuModal.value = false
}

async function handleToggleAvailability(menuId, currentStatus) {
  await store.toggleMenuAvailability(menuId)
  const newStatus = !currentStatus
  showToast(`Status menu diubah menjadi: ${newStatus ? 'Tersedia' : 'Habis'}`)
}

async function handleDeleteMenu(item) {
  if (confirm(`Apakah Anda yakin ingin menghapus menu "${item.name}"?`)) {
    await store.deleteMenuItem(item.id)
    showToast(`Menu "${item.name}" berhasil dihapus.`)
  }
}

// Payment Status Update (persist ke backend; realtime via WS STATUS_UPDATED)
async function markOrderAsPaid(order) {
  if (!order || order.payment?.paid) return
  try {
    const res = await api.orders.updateStatus(order.orderId, { is_paid: true })
    if (!res.ok) throw new Error(res.error || 'Gagal menyimpan status.')
    order.payment.paid = true
    order.payment.status = 'Lunas'
    showToast(`Pesanan #${order.orderId} lunas. Struk bisa dicetak.`)
  } catch (err) {
    showToast(err.message || 'Gagal menandai lunas.', 'error')
  }
}

// Preparation Status Update (Dapur & Barista)
function normalizePrepStatus(status) {
  if (status === 'Siap Diambil' || status === 'Siap Disajikan') return 'Siap Diambil'
  if (status === 'Selesai') return 'Selesai'
  return 'Sedang Disiapkan'
}

function getPrepClass(status) {
  const s = normalizePrepStatus(status)
  if (s === 'Siap Diambil') return 'prep-ready'
  if (s === 'Selesai') return 'prep-done'
  return 'prep-cooking'
}

async function handleUpdatePrepStatus(order, newStatus) {
  if (!order) return
  const prevStatus = order.orderStatus
  try {
    order.orderStatus = newStatus
    if (selectedOrder.value?.orderId === order.orderId) {
      selectedOrder.value.orderStatus = newStatus
    }
    const res = await api.orders.updateStatus(order.orderId, { order_status: newStatus })
    if (!res.ok) throw new Error(res.error || 'Gagal memperbarui status penyiapan.')
    
    if (store.broadcastOrderStatusUpdate) {
      store.broadcastOrderStatusUpdate(order.orderId, { orderStatus: newStatus })
    }
    showToast(`Status penyiapan #${order.orderId} diubah ke "${newStatus}".`)
  } catch (err) {
    order.orderStatus = prevStatus
    if (selectedOrder.value?.orderId === order.orderId) {
      selectedOrder.value.orderStatus = prevStatus
    }
    showToast(err.message || 'Gagal memperbarui status.', 'error')
  }
}

// Pembatalan pesanan (Admin saja, permanen)
async function handleCancelOrder(order) {
  if (!order) return
  if (!confirm(`Batalkan pesanan #${order.orderId} (${order.customer?.name || 'Pelanggan'})? Data dihapus permanen.`)) return
  try {
    const res = await api.orders.remove(order.orderId)
    if (!res.ok) throw new Error(res.error || 'Gagal membatalkan.')
    store.orderHistory = store.orderHistory.filter(o => o.orderId !== order.orderId)
    if (selectedOrder.value?.orderId === order.orderId) selectedOrder.value = null
    showToast(`Pesanan #${order.orderId} dibatalkan & dihapus.`)
  } catch (err) {
    showToast(err.message || 'Gagal membatalkan pesanan.', 'error')
  }
}

// Bluetooth Thermal Printing
function handleChangePrinter() {
  forgetBluetoothPrinter()
  savedPrinterName.value = ''
  showToast('Memori printer Bluetooth direset. Silakan pilih printer baru saat mencetak.')
}

function confirmTearAndContinue() {
  if (tearResolveFn) {
    tearResolveFn()
    tearResolveFn = null
  }
  isWaitingTear.value = false
}

async function handlePrintReceipt(order, mode = 'both') {
  if (!isBluetoothSupported()) {
    // Fallback to browser print
    window.print()
    return
  }

  isPrinting.value = true
  const rememberedName = getSavedPrinterName()
  printMessage.value = rememberedName 
    ? `Menyambungkan ke ${rememberedName}...` 
    : 'Mencari printer thermal Bluetooth...'
  isWaitingTear.value = false
  tearResolveFn = null

  try {
    const result = await printReceiptViaBluetooth(order, {
      width: paperWidth.value,
      mode: mode,
      brandName: store.brandName || 'SIKopi',
      tearDelaySeconds: tearDelaySeconds.value,
      onProgress: (p) => {
        printMessage.value = p.message
      },
      onWaitTear: ({ delaySeconds }) => {
        return new Promise((resolve) => {
          isWaitingTear.value = true
          tearCountdown.value = delaySeconds
          tearResolveFn = resolve

          if (delaySeconds <= 0) return

          const timer = setInterval(() => {
            tearCountdown.value--
            if (tearCountdown.value <= 0) {
              clearInterval(timer)
              if (isWaitingTear.value) {
                isWaitingTear.value = false
                tearResolveFn = null
                resolve()
              }
            }
          }, 1000)
        })
      }
    })
    savedPrinterName.value = getSavedPrinterName() || result.deviceName
    showToast(result.message || 'Struk pesanan berhasil dicetak!')
  } catch (err) {
    const isCancelled = err.message?.includes('dibatalkan') || err.name === 'NotFoundError'
    if (isCancelled) {
      showToast('Pencetakan dibatalkan.')
    } else {
      showToast(err.message || 'Gagal cetak Bluetooth. Membuka dialog printer browser...', 'error')
      setTimeout(() => {
        window.print()
      }, 1000)
    }
  } finally {
    isPrinting.value = false
    printMessage.value = ''
    isWaitingTear.value = false
    tearResolveFn = null
  }
}

function printViaBrowser() {
  window.print()
}

function formatDate(isoString) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

function getOrderQrisUrl(ord) {
  if (!ord) return ''
  const total = ord.breakdown?.total || 1
  try {
    return generateQrisDataUrl(total)
  } catch {
    const payload = generateDynamicQrisPayload(undefined, total)
    return getQrisImageUrl(payload, 340)
  }
}

// ================= BRANDING & DYNAMIC ICON MANAGEMENT =================
const brandingForm = ref({
  icon: store.brandIcon || 'leaf',
  name: store.brandName || 'SIKopi'
})
const isSavingBranding = ref(false)
const isUploadingBrandLogo = ref(false)
const brandLogoFileInputRef = ref(null)
const customIconUrlInput = ref('')

const presetIcons = [
  { id: 'leaf', label: 'Daun Organik (Default)', desc: 'Ikon resmi SIKopi, mencerminkan konsep ramah lingkungan dan alami.', isDefault: true },
  { id: 'coffee', label: 'Cangkir Kopi', desc: 'Cocok untuk kedai kopi hangat & barista autentik.' },
  { id: 'sparkles', label: 'Kilau / Spesial', desc: 'Memberikan sentuhan modern, premium, dan inovatif.' },
  { id: 'heart', label: 'Cinta & Peduli', desc: 'Nuansa ramah, penuh perhatian terhadap kesehatan.' },
  { id: 'shield-check', label: 'Kualitas Teruji', desc: 'Menjamin standar higienis dan kebersihan tertinggi.' }
]

watch([() => store.brandIcon, () => store.brandName], ([newIcon, newName]) => {
  brandingForm.value.icon = newIcon || 'leaf'
  brandingForm.value.name = newName || 'SIKopi'
}, { immediate: true })

function selectPresetIcon(iconId) {
  brandingForm.value.icon = iconId
  customIconUrlInput.value = ''
}

function applyCustomIconUrl() {
  const url = customIconUrlInput.value.trim()
  if (!url) return
  brandingForm.value.icon = url
  showToast('URL gambar ikon berhasil disetel!')
}

function triggerBrandLogoFileInput() {
  if (brandLogoFileInputRef.value) {
    brandLogoFileInputRef.value.click()
  }
}

async function handleBrandLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    showToast('Silakan pilih file gambar (PNG, JPG, SVG, WebP).', 'error')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file maksimal 5MB.', 'error')
    return
  }

  isUploadingBrandLogo.value = true
  try {
    const uploadedUrl = await store.uploadMenuImage(file)
    brandingForm.value.icon = uploadedUrl
    customIconUrlInput.value = ''
    showToast('File logo berhasil diunggah ke backend!')
  } catch (err) {
    showToast(err.message || 'Gagal mengunggah gambar logo.', 'error')
  } finally {
    isUploadingBrandLogo.value = false
    if (event.target) event.target.value = ''
  }
}

function removeCustomIcon() {
  brandingForm.value.icon = 'leaf'
  customIconUrlInput.value = ''
  showToast('Logo kustom dihapus, kembali ke default Daun Organik.')
}

async function handleSaveBranding() {
  isSavingBranding.value = true
  try {
    const res = await store.updateBrandingSettings({
      icon: brandingForm.value.icon || 'leaf',
      name: (brandingForm.value.name || 'SIKopi').trim()
    })
    if (res && res.ok !== false) {
      showToast('Ikon & Branding berhasil disimpan dan aktif di seluruh tab!')
    } else {
      showToast(res?.error || 'Gagal menyimpan konfigurasi branding ke server.', 'error')
    }
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan branding.', 'error')
  } finally {
    isSavingBranding.value = false
  }
}

async function handleResetBranding() {
  if (!confirm('Kembalikan ikon ke Daun Organik (Default) dan nama brand ke SIKopi?')) return

  isSavingBranding.value = true
  try {
    const res = await store.resetBrandingToDefault()
    if (res && res.ok !== false) {
      brandingForm.value.icon = 'leaf'
      brandingForm.value.name = 'SIKopi'
      customIconUrlInput.value = ''
      showToast('Ikon dan brand berhasil dikembalikan ke default!')
    } else {
      showToast(res?.error || 'Gagal mengembalikan ke default.', 'error')
    }
  } catch (err) {
    showToast(err.message || 'Gagal mengembalikan default.', 'error')
  } finally {
    isSavingBranding.value = false
  }
}
</script>

<template>
  <div class="admin-page-view">
    <!-- ================= LOGIN STATE ================= -->
    <div v-if="!adminStore.isAuthenticated" class="admin-login-wrapper">
      <div class="login-card">
        <div class="login-brand text-center">
          <div class="brand-shield-box">
            <img v-if="isCustomImage(store.brandIcon)" :src="api.fileUrl(store.brandIcon)" alt="Logo" class="brand-icon-img" />
            <AppIcon v-else :name="store.brandIcon || 'leaf'" :size="28" />
          </div>
          <h1 class="brand-heading">{{ store.brandName || 'SIKopi' }} Admin & Kasir</h1>
          <p class="brand-sub">Masuk untuk mengelola pesanan, daftar menu, dan pencetakan struk.</p>
        </div>
        
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email Kasir / Admin</label>
            <div class="input-wrap">
              <AppIcon name="user" :size="16" class="input-icon" />
              <input 
                id="login-email"
                v-model="inputEmail" 
                type="email" 
                placeholder="user@domain.com"
                class="admin-input"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password Admin</label>
            <div class="input-wrap">
              <AppIcon name="shield-check" :size="16" class="input-icon" />
              <input 
                id="login-password"
                v-model="inputPassword" 
                type="password" 
                placeholder="••••••••"
                class="admin-input"
                required
              />
            </div>
          </div>

          <div v-if="loginError" class="login-error-alert" role="alert">
            <AppIcon name="close" :size="15" />
            <span>{{ loginError }}</span>
          </div>

          <button 
            type="submit" 
            class="btn-login-submit"
            :disabled="isLoggingIn"
          >
            <span>{{ isLoggingIn ? 'Memverifikasi...' : 'Masuk ke Panel Kasir' }}</span>
            <AppIcon name="arrow-right" :size="18" />
          </button>

          <div class="login-alt-actions text-center">
            <button type="button" class="btn-link-menu" @click="goToCustomerMenu">
              <AppIcon name="bag" :size="14" />
              <span>Buka Tampilan Pelanggan (/menu)</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ================= DASHBOARD STATE ================= -->
    <div v-else class="admin-dashboard-container">
      <!-- Admin Top Navigation -->
      <header class="admin-navbar">
        <div class="admin-nav-inner container">
          <div class="nav-brand-group">
            <div class="brand-icon-box">
              <img v-if="isCustomImage(store.brandIcon)" :src="api.fileUrl(store.brandIcon)" alt="Logo" class="brand-icon-img" />
              <AppIcon v-else :name="store.brandIcon || 'leaf'" :size="20" stroke-width="2" />
            </div>
            <span class="nav-brand-title">{{ store.brandName || 'SIKopi' }} Kasir</span>
          </div>

          <!-- Navigation Tabs (tanpa ikon, hanya teks) -->
          <nav class="admin-nav-tabs">
            <button 
              type="button" 
              class="nav-tab-btn" 
              :class="{ active: activeTab === 'orders' }"
              @click="activeTab = 'orders'"
            >
              <span>Pesanan Masuk</span>
              <span class="tab-badge" v-if="orderHistory.length > 0">{{ orderHistory.length }}</span>
            </button>
            <button 
              type="button" 
              class="nav-tab-btn" 
              :class="{ active: activeTab === 'menus' }"
              @click="activeTab = 'menus'"
            >
              <span>Kelola Menu</span>
              <span class="tab-badge">{{ menuItems.length }}</span>
            </button>
            <button 
              type="button" 
              class="nav-tab-btn" 
              :class="{ active: activeTab === 'tokens' }"
              @click="activeTab = 'tokens'"
            >
              <span>Token Hangus</span>
            </button>
            <button 
              type="button" 
              class="nav-tab-btn" 
              :class="{ active: activeTab === 'analisis' }"
              @click="openAnalyticsTab"
            >
              <span>Analisis</span>
            </button>
            <button 
              type="button" 
              class="nav-tab-btn" 
              :class="{ active: activeTab === 'branding' }"
              @click="activeTab = 'branding'"
            >
              <span>Ikon & Brand</span>
            </button>
          </nav>

          <div class="nav-user-actions">
            <button type="button" class="btn-nav-customer" @click="goToCustomerMenu" title="Buka Halaman Menu Pelanggan">
              <AppIcon name="bag" :size="15" />
              <span>Lihat Menu Pelanggan</span>
            </button>
            <button type="button" class="btn-nav-logout" @click="handleLogout" title="Keluar dari Panel Admin">
              <AppIcon name="close" :size="14" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main class="container admin-main-content">
        <!-- 1. HERO TOKEN MANAGEMENT CARD -->
        <section class="token-hero-card">
          <div class="token-hero-header">
            <div class="pill-live">
              <span class="dot-pulse"></span>
              <span>TOKEN AKTIF UNTUK PELANGGAN</span>
            </div>
            <span class="token-notice">Berikan token ini ke pelanggan yang baru datang</span>
          </div>

          <div class="token-hero-body">
            <div class="token-number-box">
              <span class="token-main-digits font-mono">{{ activeToken }}</span>
            </div>

            <div class="token-hero-actions">
              <button type="button" class="btn-token-copy" @click="handleCopyToken">
                <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />
                <span>{{ copied ? 'Tersalin!' : 'Salin Token' }}</span>
              </button>

              <button type="button" class="btn-token-regen" @click="handleGenerateNewToken">
                <AppIcon name="sparkles" :size="17" />
                <span>Generate Token Baru</span>
              </button>
            </div>
          </div>

          <p class="token-hero-hint">
            <strong>Alur Kerja:</strong> Pelanggan memasukkan <strong>Nama</strong> dan token <strong>{{ activeToken }}</strong> pada pop-up di halaman menu. Begitu berhasil verifikasi, token otomatis hangus dan kasir otomatis mendapatkan token baru berikutnya.
          </p>
        </section>

        <!-- 2. QUICK STATS ROW -->
        <section class="admin-stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrap bg-sage">
              <AppIcon name="receipt" :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Pesanan Masuk</span>
              <strong class="stat-val font-mono">{{ orderHistory.length }}</strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrap bg-peach">
              <AppIcon name="cash" :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Omset Transaksi</span>
              <strong class="stat-val font-mono">{{ formatRupiah(totalRevenue) }}</strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrap bg-charcoal">
              <AppIcon name="bag" :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Porsi Terjual</span>
              <strong class="stat-val font-mono">{{ totalPortionsSold }} Porsi</strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrap bg-sage">
              <AppIcon name="shield-check" :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">Token Hangus</span>
              <strong class="stat-val font-mono">{{ Object.keys(usedTokensMap).length }}</strong>
            </div>
          </div>
        </section>

        <!-- ================= TAB 1: ORDERS LIST ================= -->
        <section v-if="activeTab === 'orders'" class="content-section-card">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <h2 class="section-title">Daftar Pesanan Masuk Pelanggan</h2>
              <span class="section-subtitle">Pantau pesanan, tampilkan QRIS pembayaran, dan cetak struk</span>
            </div>

            <div class="header-actions">
              <button
                type="button"
                class="btn-export"
                :disabled="isExporting || filteredOrders.length === 0"
                @click="handleExport('csv')"
                title="Unduh data penjualan sebagai CSV (dibuka di Excel)"
              >
                <AppIcon name="receipt" :size="14" />
                <span>{{ isExporting ? 'Mengunduh...' : 'Export CSV' }}</span>
              </button>

              <button
                type="button"
                class="btn-export btn-export-primary"
                :disabled="isExporting || filteredOrders.length === 0"
                @click="handleExport('xlsx')"
                title="Unduh data penjualan sebagai Excel (.xlsx)"
              >
                <AppIcon name="receipt" :size="14" />
                <span>{{ isExporting ? 'Mengunduh...' : 'Export Excel' }}</span>
              </button>

              <button 
                type="button" 
                class="btn-refresh" 
                @click="store.refreshOrdersFromDB(); showToast('Data pesanan diperbarui dari database.')"
                title="Refresh Data dari Database"
              >
                <AppIcon name="sparkles" :size="14" />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          <div class="table-search-row">
            <div class="search-wrap">
              <AppIcon name="search" :size="16" class="search-icon" />
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Cari nomor pesanan, nama pelanggan, token, atau metode..."
                class="search-input"
              />
            </div>
            <span class="search-meta">Menampilkan {{ filteredOrders.length }} pesanan</span>
          </div>

          <div v-if="filteredOrders.length === 0" class="empty-state text-center">
            <AppIcon name="bag" :size="36" class="empty-icon" />
            <p>Belum ada data pesanan yang masuk.</p>
          </div>

          <div v-else class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>No. Pesanan</th>
                  <th>Waktu</th>
                  <th>Pelanggan</th>
                  <th>Token</th>
                  <th>Menu Pesanan</th>
                  <th>Total Biaya</th>
                  <th>Metode Bayar</th>
                  <th>Status Bayar</th>
                  <th>Penyiapan</th>
                  <th>Aksi Kasir</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ord in filteredOrders" :key="ord.orderId">
                  <td class="col-id font-mono">
                    <strong>{{ ord.orderId }}</strong>
                  </td>
                  <td class="col-time">{{ formatDate(ord.createdAt) }}</td>
                  <td class="col-name">
                    <strong>{{ ord.customer?.name || '-' }}</strong>
                  </td>
                  <td class="col-token">
                    <span class="badge-token font-mono">#{{ ord.customer?.token || '-' }}</span>
                  </td>
                  <td class="col-items">
                    <div class="items-summary" :title="ord.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')">
                      {{ ord.items?.length || 0 }} Menu ({{ ord.items?.reduce((s, i) => s + (i.quantity || 1), 0) }} Porsi)
                    </div>
                  </td>
                  <td class="col-total font-mono font-bold">{{ formatRupiah(ord.breakdown?.total) }}</td>
                  <td class="col-payment">
                    <span class="badge-payment" :class="ord.payment?.method">
                      {{ ord.payment?.method === 'qris' ? 'QRIS' : 'Tunai di Kasir' }}
                    </span>
                  </td>
                  <td class="col-status">
                    <span 
                      class="badge-pay-status"
                      :class="{ 'paid': ord.payment?.paid }"
                    >
                      {{ ord.payment?.paid ? 'Lunas' : 'Menunggu Pembayaran' }}
                    </span>
                  </td>
                  <td class="col-prep-status">
                    <select 
                      class="select-prep-status"
                      :class="getPrepClass(ord.orderStatus)"
                      :value="normalizePrepStatus(ord.orderStatus)"
                      @change="handleUpdatePrepStatus(ord, $event.target.value)"
                      title="Ubah status penyiapan (mengirim notifikasi ke pelanggan jika Siap Diambil)"
                    >
                      <option value="Sedang Disiapkan">Sedang Disiapkan</option>
                      <option value="Siap Diambil">Siap Diambil</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </td>
                  <td class="col-actions">
                    <div class="actions-row">
                      <button 
                        type="button" 
                        class="btn-act btn-detail" 
                        @click="openOrderDetail(ord)"
                        title="Buka QRIS & Detail Pembayaran"
                      >
                        <AppIcon name="qr-code" :size="14" />
                        <span>Detail</span>
                      </button>

                      <button 
                        type="button" 
                        class="btn-act btn-print" 
                        @click="handlePrintReceipt(ord, 'both')"
                        :disabled="isPrinting || !ord.payment?.paid"
                        :title="ord.payment?.paid ? 'Cetak 2 Struk Thermal (Dapur & Pelanggan)' : 'Aktif setelah pembayaran lunas'"
                      >
                        <AppIcon name="printer" :size="14" />
                        <span>Cetak Struk</span>
                      </button>

                      <button 
                        type="button" 
                        class="btn-act btn-cancel-order" 
                        @click="handleCancelOrder(ord)"
                        title="Batalkan & hapus pesanan (Admin)"
                      >
                        <AppIcon name="trash" :size="14" />
                        <span>Batal</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ================= TAB 2: MENU MANAGEMENT ================= -->
        <section v-if="activeTab === 'menus'" class="content-section-card">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <h2 class="section-title">Kelola Daftar Menu & Status Stok</h2>
              <span class="section-subtitle">Edit harga, tambah menu baru, atau ubah status Tersedia / Habis</span>
            </div>

            <button type="button" class="btn-primary-action" @click="openAddMenuModal">
              <AppIcon name="plus" :size="16" />
              <span>Tambah Menu Baru</span>
            </button>
          </div>

          <div class="menu-admin-grid">
            <div 
              v-for="item in menuItems" 
              :key="item.id" 
              class="menu-admin-card"
              :class="{ 'is-out-of-stock': item.is_available === false }"
            >
              <div class="card-thumb">
                <img :src="api.fileUrl(item.image)" :alt="item.name" class="thumb-img" />
                <span 
                  class="stock-status-pill"
                  :class="item.is_available !== false ? 'available' : 'empty'"
                >
                  {{ item.is_available !== false ? 'Tersedia' : 'Habis' }}
                </span>
              </div>

              <div class="card-details">
                <div class="menu-cat-tag">{{ item.category }}</div>
                <h3 class="menu-item-name">{{ item.name }}</h3>
                <p class="menu-item-desc">{{ item.description }}</p>
                <div class="menu-price-tag font-mono">{{ formatRupiah(item.price) }}</div>

                <!-- Availability Toggle Switch (ON / OFF) -->
                <div class="toggle-availability-row">
                  <span class="toggle-label">Status Ketersediaan:</span>
                  <button 
                    type="button" 
                    class="btn-switch-toggle"
                    :class="item.is_available !== false ? 'switch-on' : 'switch-off'"
                    :title="item.is_available !== false ? 'Status ON (Tersedia) — Klik untuk ubah ke OFF' : 'Status OFF (Habis) — Klik untuk ubah ke ON'"
                    @click="handleToggleAvailability(item.id, item.is_available)"
                  >
                    <span class="switch-ball"></span>
                    <span class="switch-label-text">{{ item.is_available !== false ? '' : '' }}</span>
                  </button>
                </div>

                <div class="card-admin-actions">
                  <button type="button" class="btn-edit-item" @click="openEditMenuModal(item)">
                    <AppIcon name="sparkles" :size="13" />
                    <span>Edit Menu</span>
                  </button>
                  <button type="button" class="btn-delete-item" @click="handleDeleteMenu(item)">
                    <AppIcon name="close" :size="13" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= TAB 3: TOKENS LOG ================= -->
        <section v-if="activeTab === 'tokens'" class="content-section-card">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <h2 class="section-title">Log Token Sekali Pakai & Keamanan</h2>
              <span class="section-subtitle">Daftar token yang telah hangus karena sudah menyelesaikan transaksi</span>
            </div>
          </div>

          <div class="tokens-intro-banner">
            <AppIcon name="shield-check" :size="18" />
            <span>Setiap token bersifat <strong>sekali pakai (one-time use)</strong>. Jika pelanggan memasukkan kembali token yang telah hangus, sistem otomatis menampilkan struk digital pesanan yang telah mereka buat sebelumnya.</span>
          </div>

          <div v-if="Object.keys(usedTokensMap).length === 0" class="empty-state text-center">
            <p>Belum ada token yang hangus.</p>
          </div>

          <div v-else class="tokens-grid">
            <div v-for="(info, tkn) in usedTokensMap" :key="tkn" class="token-history-card">
              <div class="history-top">
                <span class="history-token font-mono">#{{ tkn }}</span>
                <span class="history-status-tag">Hangus</span>
              </div>
              <div class="history-meta">
                <div>Pelanggan: <strong>{{ info.customerName || 'Pelanggan' }}</strong></div>
                <div>No. Pesanan: <strong class="font-mono text-sage">{{ info.orderId || '-' }}</strong></div>
                <div class="history-time">{{ formatDate(info.burnedAt) }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= TAB 4: ANALISIS PENJUALAN ================= -->
        <section v-if="activeTab === 'analisis'" class="content-section-card">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <h2 class="section-title">Analisis Penjualan</h2>
              <span class="section-subtitle">Menu paling laris & metode pembayaran favorit (seluruh data)</span>
            </div>

            <button
              type="button"
              class="btn-refresh"
              :disabled="statsLoading"
              @click="fetchSalesStats"
              title="Muat ulang analisis"
            >
              <AppIcon name="sparkles" :size="14" />
              <span>{{ statsLoading ? 'Memuat...' : 'Muat Ulang' }}</span>
            </button>
          </div>

          <div v-if="analyticsTopMenus.length === 0 && analyticsPayments.length === 0" class="empty-state text-center">
            <AppIcon name="chart" :size="36" class="empty-icon" />
            <p>Belum ada data penjualan untuk dianalisis.</p>
          </div>

          <div v-else class="analytics-grid">
            <!-- Menu paling banyak dibeli -->
            <div class="analytics-card">
              <h3 class="analytics-card-title">
                <AppIcon name="bag" :size="16" />
                <span>Menu Paling Laris</span>
              </h3>
              <ol class="rank-list">
                <li v-for="(m, idx) in analyticsTopMenus.slice(0, 5)" :key="m.name" class="rank-row">
                  <span class="rank-num font-mono">{{ idx + 1 }}</span>
                  <div class="rank-info">
                    <div class="rank-name-row">
                      <strong>{{ m.name }}</strong>
                      <span class="font-mono">{{ m.qty }} porsi</span>
                    </div>
                    <div class="rank-bar">
                      <div class="rank-bar-fill" :style="{ width: ((m.qty / topMenuMaxQty) * 100).toFixed(1) + '%' }"></div>
                    </div>
                    <div class="rank-sub font-mono">{{ formatRupiah(m.revenue) }} · {{ m.orders }} pesanan</div>
                  </div>
                </li>
              </ol>
            </div>

            <!-- Metode pembayaran paling dipilih -->
            <div class="analytics-card">
              <h3 class="analytics-card-title">
                <AppIcon name="cash" :size="16" />
                <span>Metode Pembayaran Favorit</span>
              </h3>
              <ul class="pay-list">
                <li v-for="p in analyticsPayments" :key="p.method" class="pay-row">
                  <strong>{{ p.label }}</strong>
                  <span class="font-mono">{{ p.count }}x ({{ p.pct }}%)</span>
                </li>
              </ul>
              <p v-if="analyticsPayments.length" class="pay-winner">
                Paling dipilih: <strong>{{ analyticsPayments[0].label }}</strong>
                ({{ analyticsPayments[0].count }} transaksi, {{ analyticsPayments[0].pct }}%)
              </p>
            </div>
          </div>
        </section>

        <!-- ================= TAB 5: PENGATURAN IKON & BRANDING ================= -->
        <section v-if="activeTab === 'branding'" class="content-section-card branding-section-card">
          <div class="section-top-bar">
            <div class="section-title-wrap">
              <h2 class="section-title">Pengaturan Ikon & Branding</h2>
              <span class="section-subtitle">
                Atur ikon logo navbar, favicon tab browser, dan nama brand secara dinamis. Default resmi adalah <strong>Daun Organik (leaf)</strong>.
              </span>
            </div>

            <div class="branding-top-actions">
              <button
                type="button"
                class="btn-reset-default"
                :disabled="isSavingBranding"
                @click="handleResetBranding"
                title="Kembalikan ikon & brand ke default sistem"
              >
                <AppIcon name="rotate-ccw" :size="14" />
                <span>Kembalikan Default</span>
              </button>
              <button
                type="button"
                class="btn-primary-action"
                :disabled="isSavingBranding"
                @click="handleSaveBranding"
              >
                <AppIcon :name="isSavingBranding ? 'sparkles' : 'shield-check'" :size="16" />
                <span>{{ isSavingBranding ? 'Menyimpan...' : 'Simpan Ikon & Brand' }}</span>
              </button>
            </div>
          </div>

          <!-- Live Visual Simulation Preview -->
          <div class="branding-preview-deck">
            <div class="preview-deck-header">
              <h3 class="preview-deck-title">
                <AppIcon name="sparkles" :size="16" />
                <span>Pratinjau Langsung (Realtime Live Preview)</span>
              </h3>
              <span class="preview-live-indicator">
                <span class="live-dot-pulse"></span>
                <span>Sinkronisasi Otomatis</span>
              </span>
            </div>

            <div class="preview-cards-grid">
              <!-- Preview 1: Browser Tab Favicon Simulation -->
              <div class="preview-card">
                <div class="preview-card-header">
                  <span class="preview-label">Ikon Tab Browser (Favicon)</span>
                  <span class="preview-status-pill">Tab Browser Pelanggan & Admin</span>
                </div>
                <div class="browser-window-mockup">
                  <div class="browser-tab-bar">
                    <div class="browser-tab active-tab-mock">
                      <span class="mock-favicon-wrap">
                        <img v-if="isCustomImage(brandingForm.icon)" :src="api.fileUrl(brandingForm.icon)" alt="Favicon" class="mock-favicon-img" />
                        <AppIcon v-else :name="brandingForm.icon || 'leaf'" :size="14" />
                      </span>
                      <span class="mock-tab-title">{{ (brandingForm.name || 'sikopi').toLowerCase() }} | Kopi Pilihan & Santapan Bernutrisi</span>
                      <span class="mock-tab-close">&times;</span>
                    </div>
                    <div class="mock-new-tab">+</div>
                  </div>
                  <div class="browser-address-bar">
                    <span class="mock-lock">🔒</span>
                    <span class="mock-url">https://sikopi.local/menu</span>
                  </div>
                </div>
              </div>

              <!-- Preview 2: Navbar Brand Simulation -->
              <div class="preview-card">
                <div class="preview-card-header">
                  <span class="preview-label">Logo Navbar Aplikasi</span>
                  <span class="preview-status-pill">Header Navigasi Mobile & Desktop</span>
                </div>
                <div class="navbar-preview-mockup">
                  <div class="navbar-mock-left">
                    <div class="mock-brand-box">
                      <img v-if="isCustomImage(brandingForm.icon)" :src="api.fileUrl(brandingForm.icon)" alt="Brand Logo" class="mock-brand-img" />
                      <AppIcon v-else :name="brandingForm.icon || 'leaf'" :size="20" stroke-width="2" />
                    </div>
                    <div class="mock-brand-texts">
                      <span class="mock-brand-name">{{ brandingForm.name || 'SIKopi' }}</span>
                      <span class="mock-brand-caption">Menu Hidangan Sehat</span>
                    </div>
                  </div>
                  <div class="navbar-mock-right">
                    <span class="mock-nav-pill">Pilihan Menu</span>
                    <span class="mock-nav-pill">Daftar Pesanan</span>
                    <span class="mock-nav-cart">🛒 0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Configuration Form Grid -->
          <div class="branding-config-grid">
            <!-- 1. Preset Icons Section -->
            <div class="config-panel">
              <div class="panel-header">
                <h3 class="panel-title">1. Pilih Ikon Bawaan (Preset)</h3>
                <span class="panel-sub">Pilih salah satu ikon vektor siap pakai tanpa perlu mengunggah berkas</span>
              </div>

              <div class="preset-icons-grid">
                <button
                  v-for="item in presetIcons"
                  :key="item.id"
                  type="button"
                  class="preset-icon-card"
                  :class="{ selected: brandingForm.icon === item.id }"
                  @click="selectPresetIcon(item.id)"
                >
                  <div class="preset-icon-box">
                    <AppIcon :name="item.id" :size="24" />
                  </div>
                  <div class="preset-info">
                    <div class="preset-title-row">
                      <span class="preset-label">{{ item.label }}</span>
                      <span v-if="item.isDefault" class="preset-badge-default">Default</span>
                      <span v-if="brandingForm.icon === item.id" class="preset-badge-active">Dipilih</span>
                    </div>
                    <p class="preset-desc">{{ item.desc }}</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- 2. Custom Logo Upload & External URL -->
            <div class="config-panel">
              <div class="panel-header">
                <h3 class="panel-title">2. Unggah Logo Kustom atau URL Gambar</h3>
                <span class="panel-sub">Gunakan file logo milik sendiri (PNG, SVG, JPG, WebP)</span>
              </div>

              <!-- Upload Dropzone -->
              <div class="custom-logo-zone">
                <input
                  ref="brandLogoFileInputRef"
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  style="display: none"
                  @change="handleBrandLogoUpload"
                />

                <div 
                  class="upload-dropzone-box" 
                  @click="triggerBrandLogoFileInput"
                  :class="{ 'is-uploading': isUploadingBrandLogo }"
                >
                  <div v-if="isCustomImage(brandingForm.icon)" class="custom-logo-active-preview">
                    <img :src="api.fileUrl(brandingForm.icon)" alt="Logo Kustom" class="active-logo-thumb" />
                    <div class="active-logo-info">
                      <strong>Logo Kustom Sedang Aktif</strong>
                      <span>Klik area ini untuk mengganti dengan gambar lain</span>
                    </div>
                    <button
                      type="button"
                      class="btn-remove-custom"
                      @click.stop="removeCustomIcon"
                      title="Hapus logo kustom dan kembali ke default"
                    >
                      <AppIcon name="close" :size="14" />
                      <span>Hapus</span>
                    </button>
                  </div>

                  <div v-else class="upload-dropzone-content">
                    <div class="upload-icon-circle">
                      <AppIcon :name="isUploadingBrandLogo ? 'sparkles' : 'bag'" :size="22" />
                    </div>
                    <div class="upload-texts">
                      <strong>{{ isUploadingBrandLogo ? 'Sedang Mengunggah...' : 'Klik untuk Unggah Gambar Logo' }}</strong>
                      <span>Format PNG transparan, SVG, atau JPG (Maks. 5MB)</span>
                    </div>
                  </div>
                </div>

                <!-- External Image URL Option -->
                <div class="url-input-block">
                  <label class="config-label" for="brand-url-input">Atau Masukkan URL Gambar Eksternal:</label>
                  <div class="url-input-row">
                    <input
                      id="brand-url-input"
                      v-model="customIconUrlInput"
                      type="url"
                      placeholder="https://contoh.com/logo-sikopi.png"
                      class="admin-input"
                      @keyup.enter="applyCustomIconUrl"
                    />
                    <button
                      type="button"
                      class="btn-apply-url"
                      @click="applyCustomIconUrl"
                      :disabled="!customIconUrlInput.trim()"
                    >
                      Terapkan URL
                    </button>
                  </div>
                </div>

                <!-- Brand Name Configuration -->
                <div class="brand-name-block">
                  <label class="config-label" for="brand-name-input">Nama Brand / Kedai (Tampil di Navbar):</label>
                  <input
                    id="brand-name-input"
                    v-model="brandingForm.name"
                    type="text"
                    placeholder="SIKopi"
                    maxlength="30"
                    class="admin-input"
                  />
                  <span class="field-hint">Default resmi: <strong>SIKopi</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Bar -->
          <div class="branding-footer-bar">
            <div class="footer-status-text">
              <span class="status-indicator-dot"></span>
              <span>
                Status aktif: 
                <strong>{{ isCustomImage(brandingForm.icon) ? 'Logo Gambar Kustom' : brandingForm.icon === 'leaf' ? 'Daun Organik (Default)' : brandingForm.icon }}</strong>
                — Brand: <strong>{{ brandingForm.name || 'SIKopi' }}</strong>
              </span>
            </div>
            <div class="footer-action-buttons">
              <button
                type="button"
                class="btn-reset-default"
                :disabled="isSavingBranding"
                @click="handleResetBranding"
              >
                <AppIcon name="rotate-ccw" :size="14" />
                <span>Kembalikan Default</span>
              </button>
              <button
                type="button"
                class="btn-primary-action"
                :disabled="isSavingBranding"
                @click="handleSaveBranding"
              >
                <AppIcon :name="isSavingBranding ? 'sparkles' : 'shield-check'" :size="16" />
                <span>{{ isSavingBranding ? 'Menyimpan...' : 'Simpan Ikon & Brand' }}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <!-- ================= MODAL: DETAIL & QRIS & CETAK STRUK ================= -->
      <div v-if="selectedOrder" class="modal-backdrop" @click.self="closeOrderDetail">
        <div class="admin-detail-card">
          <div class="detail-header">
            <div>
              <span class="detail-badge font-mono">{{ selectedOrder.orderId }}</span>
              <h3 class="detail-title">Detail Pesanan & Kasir SIKopi</h3>
            </div>
            <button type="button" class="btn-detail-close" @click="closeOrderDetail">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div class="detail-body">
            <!-- Customer & Order Meta -->
            <div class="detail-cust-box">
              <div class="meta-line">
                <span class="lbl">Nama Pelanggan:</span>
                <strong>{{ selectedOrder.customer?.name }}</strong>
              </div>
              <div class="meta-line">
                <span class="lbl">Token Digunakan:</span>
                <strong class="font-mono">#{{ selectedOrder.customer?.token || '-' }}</strong>
              </div>
              <div class="meta-line">
                <span class="lbl">Waktu Pemesanan:</span>
                <span>{{ formatDate(selectedOrder.createdAt) }}</span>
              </div>
              <div class="meta-line">
                <span class="lbl">Jenis Layanan:</span>
                <span>{{ selectedOrder.customer?.orderType }} ({{ selectedOrder.customer?.tableOrAddress }})</span>
              </div>
              <div v-if="selectedOrder.customer?.specialRequest && selectedOrder.customer.specialRequest !== '-'" class="meta-line">
                <span class="lbl">Catatan Pelanggan:</span>
                <span class="text-peach font-bold">{{ selectedOrder.customer.specialRequest }}</span>
              </div>
              <div class="meta-line">
                <span class="lbl">Metode Pembayaran:</span>
                <strong class="text-sage">{{ selectedOrder.payment?.method === 'qris' ? 'QRIS' : 'Tunai di Kasir' }}</strong>
              </div>
            </div>

            <!-- Dynamic QRIS Kasir (Tampilkan jika metode QRIS) -->
            <div v-if="selectedOrder.payment?.method === 'qris'" class="qris-cashier-card">
              <div class="qris-cashier-header">
                <div class="qris-title-group">
                  <AppIcon name="qr-code" :size="22" class="qris-icon" />
                  <div>
                    <h4 class="qris-title">QRIS — Scan untuk Bayar</h4>
                    <p class="qris-subtitle">BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, Dana, LinkAja</p>
                  </div>
                </div>
                <div class="qris-merchant-pill">
                  <span class="merchant-name-text">AZRIEL SABIQ GAMING GEAR</span>
                  <span class="nmid-mini-text font-mono">NMID: ID1026528966314 · A01</span>
                </div>
              </div>

              <!-- BIG DYNAMIC QR CODE DISPLAY -->
              <div class="qris-large-scan-wrapper">
                <div class="qris-large-qr-box">
                  <img 
                    :src="getOrderQrisUrl(selectedOrder)" 
                    :alt="`QRIS - ${formatRupiah(selectedOrder.breakdown?.total)}`" 
                    class="qris-large-img" 
                  />
                  <div class="qris-scan-hint">
                    <span class="hint-dot"></span>
                    <span>Arahkan kamera aplikasi bank / e-wallet ke QR code</span>
                  </div>
                </div>

                <div class="qris-nominal-banner">
                  <span class="nom-banner-label">TOTAL TAGIHAN</span>
                  <span class="nom-banner-value font-mono">{{ formatRupiah(selectedOrder.breakdown?.total) }}</span>
                  <span class="nom-banner-desc">Nominal otomatis terkunci di aplikasi pelanggan saat di-scan</span>
                </div>
              </div>

              <!-- Button to mark order as paid -->
              <div class="qris-pay-action-row">
                <button 
                  type="button" 
                  class="btn-mark-paid"
                  :disabled="selectedOrder.payment?.paid"
                  @click="markOrderAsPaid(selectedOrder)"
                >
                  <AppIcon name="check" :size="18" />
                  <span>{{ selectedOrder.payment?.paid ? 'Pembayaran Telah Lunas' : 'Konfirmasi Sudah Dibayar' }}</span>
                </button>
              </div>
            </div>

            <!-- Preparation Status Controls (Dapur & Barista) -->
            <div class="detail-prep-control-card">
              <div class="prep-control-head">
                <div class="prep-title-group">
                  <AppIcon name="clock" :size="16" />
                  <span class="prep-control-title">Status Penyiapan Hidangan:</span>
                </div>
                <span class="prep-status-badge" :class="getPrepClass(selectedOrder.orderStatus)">
                  {{ normalizePrepStatus(selectedOrder.orderStatus) }}
                </span>
              </div>
              <p class="prep-control-sub">
                Mengubah ke status <strong>"Siap Diambil"</strong> akan otomatis mengirimkan bunyi lonceng & notifikasi ke perangkat pelanggan.
              </p>
              <div class="prep-pill-group">
                <button 
                  type="button" 
                  class="btn-prep-opt"
                  :class="{ active: normalizePrepStatus(selectedOrder.orderStatus) === 'Sedang Disiapkan' }"
                  @click="handleUpdatePrepStatus(selectedOrder, 'Sedang Disiapkan')"
                >
                  <AppIcon name="clock" :size="14" />
                  <span>Sedang Disiapkan</span>
                </button>

                <button 
                  type="button" 
                  class="btn-prep-opt opt-ready"
                  :class="{ active: normalizePrepStatus(selectedOrder.orderStatus) === 'Siap Diambil' }"
                  @click="handleUpdatePrepStatus(selectedOrder, 'Siap Diambil')"
                >
                  <AppIcon name="sparkles" :size="14" />
                  <span>Siap Diambil (Kirim Notif)</span>
                </button>

                <button 
                  type="button" 
                  class="btn-prep-opt opt-done"
                  :class="{ active: normalizePrepStatus(selectedOrder.orderStatus) === 'Selesai' }"
                  @click="handleUpdatePrepStatus(selectedOrder, 'Selesai')"
                >
                  <AppIcon name="check" :size="14" />
                  <span>Selesai</span>
                </button>
              </div>
            </div>

            <!-- Items list -->
            <div class="detail-items-box">
              <h4 class="items-head">Daftar Menu yang Dipesan:</h4>
              <div v-for="it in selectedOrder.items" :key="it.id || it.name" class="detail-item-row">
                <div class="item-name-col">
                  <strong>{{ it.name }}</strong>
                  <span v-if="it.notes" class="item-notes">Catatan: {{ it.notes }}</span>
                </div>
                <div class="item-qty-col font-mono">x{{ it.quantity }}</div>
                <div class="item-price-col font-mono">{{ formatRupiah(it.price * it.quantity) }}</div>
              </div>
              <div class="detail-total-row font-mono">
                <span>Total Biaya:</span>
                <span class="grand-total-text">{{ formatRupiah(selectedOrder.breakdown?.total) }}</span>
              </div>
            </div>

            <!-- Print Actions Section -->
            <div class="detail-print-section">
              <div class="print-head-row">
                <h4 class="print-head">
                  <AppIcon name="printer" :size="16" />
                  <span>Pencetakan Struk Kasir</span>
                </h4>

                <!-- Status Printer Bluetooth Tersimpan -->
                <div v-if="savedPrinterName" class="saved-printer-badge">
                  <span class="printer-dot-live"></span>
                  <span class="printer-name-text">{{ savedPrinterName }}</span>
                  <button type="button" class="btn-change-dev" @click="handleChangePrinter" title="Ganti printer Bluetooth">
                    Ganti
                  </button>
                </div>
              </div>

              <div class="paper-width-switch-row">
                <span class="switch-lbl">Lebar Kertas Printer Thermal:</span>
                <div class="switch-buttons">
                  <button 
                    type="button" 
                    class="btn-paper-opt" 
                    :class="{ active: paperWidth === 32 }"
                    @click="paperWidth = 32"
                  >
                    58mm (Standar)
                  </button>
                  <button 
                    type="button" 
                    class="btn-paper-opt" 
                    :class="{ active: paperWidth === 48 }"
                    @click="paperWidth = 48"
                  >
                    80mm
                  </button>
                </div>
              </div>

              <!-- Tear Countdown Alert -->
              <div v-if="isWaitingTear" class="tear-alert-card" role="dialog">
                <div class="tear-text-wrap">
                  <strong>Struk 1 (Dapur/Internal) Selesai Dicetak!</strong>
                  <p>Silakan sobek kertas struk dapur. Struk 2 (Pelanggan) akan dicetak dalam {{ tearCountdown }}s.</p>
                </div>
                <button type="button" class="btn-tear-now" @click="confirmTearAndContinue">
                  <span>Sudah Disobek · Cetak Struk Pelanggan Sekarang</span>
                </button>
              </div>

              <!-- Print Buttons (aktif hanya setelah lunas) -->
              <div class="print-buttons-row">
                <p v-if="!selectedOrder.payment?.paid" class="print-locked-hint">
                  Tombol cetak aktif setelah pembayaran dikonfirmasi lunas.
                </p>
                <button 
                  type="button" 
                  class="btn-print-action btn-print-both" 
                  @click="handlePrintReceipt(selectedOrder, 'both')"
                  :disabled="isPrinting || !selectedOrder.payment?.paid"
                >
                  <AppIcon name="printer" :size="16" />
                  <span>Cetak 2 Struk (Dapur + Pelanggan)</span>
                </button>

                <button 
                  type="button" 
                  class="btn-print-action btn-print-customer" 
                  @click="handlePrintReceipt(selectedOrder, 'customer')"
                  :disabled="isPrinting || !selectedOrder.payment?.paid"
                >
                  <span>Struk Pelanggan Saja</span>
                </button>

                <button 
                  type="button" 
                  class="btn-print-action btn-print-kitchen" 
                  @click="handlePrintReceipt(selectedOrder, 'kitchen')"
                  :disabled="isPrinting || !selectedOrder.payment?.paid"
                >
                  <span>Struk Dapur Saja</span>
                </button>

                <button 
                  type="button" 
                  class="btn-print-action btn-print-browser" 
                  @click="printViaBrowser"
                  :disabled="!selectedOrder.payment?.paid"
                >
                  <AppIcon name="receipt" :size="16" />
                  <span>Cetak Browser / PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: TAMBAH / EDIT MENU ================= -->
      <div v-if="showMenuModal" class="modal-backdrop" @click.self="showMenuModal = false">
        <div class="menu-form-card">
          <div class="modal-header">
            <h3 class="modal-title">{{ isEditingMenu ? 'Edit Menu Hidangan' : 'Tambah Menu Baru' }}</h3>
            <button type="button" class="btn-detail-close" @click="showMenuModal = false">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <form @submit.prevent="saveMenuForm" class="menu-edit-form">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="menu-name">Nama Hidangan *</label>
                <input id="menu-name" v-model="menuForm.name" type="text" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="menu-category">Kategori Menu *</label>
                <select id="menu-category" v-model="menuForm.category" class="form-select">
                  <option value="Kopi Pilihan">Kopi Pilihan</option>
                  <option value="Artisan Sandwich">Artisan Sandwich</option>
                  <option value="Camilan Sehat">Camilan Sehat</option>
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="menu-price">Harga (Rp) *</label>
                <input id="menu-price" v-model.number="menuForm.price" type="number" min="0" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="menu-status">Status Stok Menu</label>
                <select id="menu-status" v-model="menuForm.is_available" class="form-select">
                  <option :value="true">Tersedia (Bisa Dipesan)</option>
                  <option :value="false">Habis (Abu-abu / Tidak Bisa Diklik)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="menu-desc">Deskripsi Bahan & Rasa</label>
              <textarea id="menu-desc" v-model="menuForm.description" rows="2" class="form-textarea"></textarea>
            </div>

            <!-- Input Gambar: Bisa upload file ke backend & bisa input URL -->
            <div class="form-group image-uploader-container">
              <div class="uploader-label-row">
                <label class="form-label" style="margin-bottom: 0;">Foto / Gambar Menu</label>
                <span v-if="menuForm.image && menuForm.image.startsWith('/uploads')" class="backend-stored-tag">
                  <AppIcon name="check" :size="12" />
                  <span>Tersimpan di Backend</span>
                </span>
              </div>

              <!-- Input File Tersembunyi -->
              <input 
                ref="imageFileInputRef" 
                type="file" 
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" 
                class="hidden-file-input" 
                @change="handleFileSelected" 
              />

              <!-- Kotak Dropzone / Preview -->
              <div class="image-uploader-card" :class="{ 'has-preview': !!menuForm.image }">
                <div v-if="menuForm.image" class="preview-wrap">
                  <img :src="api.fileUrl(menuForm.image)" alt="Preview Gambar Menu" class="preview-image" />
                  <div class="preview-actions">
                    <button 
                      type="button" 
                      class="btn-preview-action btn-change" 
                      @click="triggerFileInput"
                      :disabled="isUploadingImage"
                    >
                      <AppIcon name="camera" :size="13" />
                      <span>Ganti File</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn-preview-action btn-remove" 
                      @click="removeMenuImage"
                      title="Hapus gambar"
                    >
                      <AppIcon name="close" :size="13" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>

                <div v-else class="upload-dropzone" @click="triggerFileInput">
                  <div class="dropzone-inner">
                    <div class="upload-icon-circle">
                      <AppIcon name="camera" :size="22" />
                    </div>
                    <span class="upload-title">Pilih / Unggah File Gambar</span>
                    <span class="upload-hint">Format JPG, PNG, WEBP (Disimpan di Backend)</span>
                  </div>
                </div>

                <!-- Overlay Loading saat Mengunggah -->
                <div v-if="isUploadingImage" class="uploading-overlay">
                  <div class="spinner-small"></div>
                  <span>Mengunggah gambar ke server...</span>
                </div>
              </div>

              <!-- Bar Aksi Tambahan & Toggle URL Manual -->
              <div class="image-uploader-sub-bar">
                <button 
                  type="button" 
                  class="btn-action-text" 
                  @click="triggerFileInput" 
                  :disabled="isUploadingImage"
                >
                  <AppIcon name="plus" :size="13" />
                  <span>{{ menuForm.image ? 'Unggah File Gambar Lain' : 'Pilih File dari Perangkat' }}</span>
                </button>

                <button 
                  type="button" 
                  class="btn-action-text text-muted" 
                  @click="showUrlInput = !showUrlInput"
                >
                  <span>{{ showUrlInput ? 'Sembunyikan URL' : 'Atau Input URL Manual' }}</span>
                </button>
              </div>

              <!-- Input URL Manual Opsional -->
              <div v-if="showUrlInput" class="manual-url-box">
                <input 
                  id="menu-img" 
                  v-model="menuForm.image" 
                  type="text" 
                  class="form-input" 
                  placeholder="https://... atau /uploads/menu_..." 
                />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" @click="showMenuModal = false">Batal</button>
              <button type="submit" class="btn-submit-menu">
                <span>{{ isEditingMenu ? 'Simpan Perubahan' : 'Tambahkan Menu' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Toast Notification -->
      <div v-if="toastMessage" class="toast-popup" :class="toastType">
        <AppIcon :name="toastType === 'success' ? 'check' : 'close'" :size="16" />
        <span>{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page-view {
  min-height: 100vh;
  background-color: var(--bg-primary);
  color: var(--color-text-main);
  font-family: inherit;
}

/* ================= LOGIN STYLES ================= */
.admin-login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: var(--shadow-card);
}

.brand-shield-box {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.brand-heading {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 0.4rem;
}

.brand-sub {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.demo-credentials-banner {
  background: var(--bg-subtle);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 1.5rem;
  font-size: 0.8rem;
}

.cred-title {
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 4px;
}

.cred-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cred-row:last-child { margin-bottom: 0; }
.cred-label { color: var(--color-text-muted); }
.cred-code {
  color: var(--color-primary);
  background: #FFFFFF;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid var(--border-light);
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 6px;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-subtle);
}

.admin-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  color: var(--color-text-main);
  padding: 10px 14px 10px 38px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  transition: all 0.2s;
}

.admin-input:focus {
  outline: none;
  background-color: #FFFFFF;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.login-error-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFF5F5;
  color: #C53030;
  border: 1px solid #FEB2B2;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  margin-bottom: 1.25rem;
}

.btn-login-submit {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 11px 18px;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-login-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.login-alt-actions {
  margin-top: 1.5rem;
}

.btn-link-menu {
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-link-menu:hover {
  text-decoration: underline;
}

/* ================= DASHBOARD NAVBAR ================= */
.admin-navbar {
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  z-index: 40;
}

.admin-nav-inner {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 0;
}

.nav-brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: start;
}

.brand-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-brand-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-primary);
  display: block;
  line-height: 1.1;
}

.nav-brand-tag {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-transform: uppercase;
}

.admin-nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  min-width: 0;
  justify-self: center;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px;
}

.admin-nav-tabs::-webkit-scrollbar {
  display: none;
}

.nav-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.nav-tab-btn:hover {
  background-color: var(--bg-primary);
  color: var(--color-primary);
}

.nav-tab-btn.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.tab-badge {
  font-size: 0.72rem;
  background-color: rgba(255, 255, 255, 0.25);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

.nav-tab-btn:not(.active) .tab-badge {
  background-color: var(--bg-subtle);
  color: var(--color-text-muted);
}

.nav-user-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}


.realtime-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 600;
  background-color: rgba(224, 122, 95, 0.12);
  color: var(--color-peach);
  border: 1px solid rgba(224, 122, 95, 0.3);
  transition: all 0.25s ease;
}

.realtime-status-pill.is-live {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: rgba(61, 90, 76, 0.25);
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-peach);
  display: inline-block;
  transition: background-color 0.25s ease;
}

.realtime-status-pill.is-live .pulse-indicator {
  background-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(61, 90, 76, 0.2);
  animation: pulseLive 2s infinite;
}

@keyframes pulseLive {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.btn-nav-customer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
}

.btn-nav-customer:hover {
  background-color: var(--color-primary-soft);
}

.btn-nav-logout {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  background-color: var(--color-peach-soft);
  color: var(--color-peach);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
}

.btn-nav-logout:hover {
  background-color: #F8D9CE;
}

/* ================= MAIN CONTENT ================= */
.admin-main-content {
  padding: 2rem 1.5rem 5rem;
}

/* Token Hero Card */
.token-hero-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1.75rem 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-subtle);
}

.token-hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.pill-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  background-color: var(--color-primary-soft);
  padding: 4px 10px;
  border-radius: var(--radius-full);
}

.dot-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.token-notice {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.token-hero-body {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.token-number-box {
  background-color: var(--bg-primary);
  border: 2px dashed var(--color-primary);
  border-radius: var(--radius-md);
  padding: 0.75rem 2rem;
}

.token-main-digits {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--color-charcoal);
  letter-spacing: 0.15em;
}

.token-hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-token-copy, .btn-token-regen {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  font-size: 0.88rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-token-copy {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.btn-token-copy:hover {
  background-color: var(--color-primary-hover);
}

.btn-token-regen {
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  color: var(--color-charcoal);
}

.btn-token-regen:hover {
  background-color: var(--bg-subtle);
}

.token-hero-hint {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Stats Grid */
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-sage { background-color: var(--color-primary-soft); color: var(--color-primary); }
.bg-peach { background-color: var(--color-peach-soft); color: var(--color-peach); }
.bg-charcoal { background-color: #EAE8E4; color: var(--color-charcoal); }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.76rem;
  color: var(--color-text-subtle);
}

.stat-val {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

/* Content Section Card */
.content-section-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  box-shadow: var(--shadow-card);
}

.section-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 2px;
}

.section-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.btn-primary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-main);
  background: var(--bg-surface);
  cursor: pointer;
}

.btn-export-primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.btn-export:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ================= ANALYTICS ================= */
.analytics-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.25rem;
}

.analytics-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.analytics-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 1rem;
}

.rank-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rank-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.rank-num {
  min-width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.rank-info {
  flex: 1;
}

.rank-name-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.rank-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  overflow: hidden;
}

.rank-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

.rank-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 3px;
}

.pay-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 1rem;
}

.pay-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.85rem;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
}

.pay-winner {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.table-search-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.search-wrap {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-wrap .search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-subtle);
}

.search-wrap .search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  outline: none;
}

.search-meta {
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

/* Data Table */
.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  text-align: left;
}

.data-table th {
  padding: 10px 12px;
  background-color: var(--bg-primary);
  border-bottom: 2px solid var(--border-medium);
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.badge-token {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-payment {
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-payment.qris {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge-payment.cash {
  background-color: var(--color-peach-soft);
  color: var(--color-peach);
}

.badge-pay-status {
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  background-color: #FEF3C7;
  color: #92400E;
}

.badge-pay-status.paid {
  background-color: #D1FAE5;
  color: #065F46;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-act.btn-detail {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
}

.btn-act.btn-detail:hover {
  background-color: #DCE7DF;
}

.btn-act.btn-print {
  background-color: var(--color-charcoal);
  color: #FFFFFF;
}

.btn-act.btn-print:hover {
  background-color: #292524;
}

.btn-act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-act.btn-cancel-order {
  background-color: transparent;
  color: #C53030;
  border: 1px solid #FEB2B2;
}

.btn-act.btn-cancel-order:hover {
  background-color: #FFF5F5;
}

/* ================= MENU MANAGEMENT GRID ================= */
.menu-admin-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.menu-admin-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.2s;
}

.menu-admin-card.is-out-of-stock {
  opacity: 0.65;
  filter: grayscale(80%);
  background-color: #F1EFEA;
}

.card-thumb {
  position: relative;
  height: 160px;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stock-status-pill {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.stock-status-pill.available {
  background-color: #D1FAE5;
  color: #065F46;
}

.stock-status-pill.empty {
  background-color: #44403C;
  color: #FFFFFF;
}

.card-details {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.menu-cat-tag {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  margin-bottom: 2px;
}

.menu-item-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 4px;
}

.menu-item-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 0.75rem;
  flex: 1;
}

.menu-price-tag {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 1rem;
}

/* Availability Toggle */
.toggle-availability-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.toggle-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.btn-switch-toggle {
  display: inline-flex;
  align-items: center;
  position: relative;
  width: 66px;
  height: 28px;
  border-radius: var(--radius-full);
  padding: 3px 6px;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.btn-switch-toggle.switch-on {
  background-color: var(--color-primary);
  color: #FFFFFF;
  justify-content: flex-start;
}

.btn-switch-toggle.switch-off {
  background-color: #D6D3D1;
  color: #57534E;
  justify-content: flex-end;
}

.switch-ball {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.25s ease;
}

.btn-switch-toggle.switch-on .switch-ball {
  order: 2;
  margin-left: auto;
}

.btn-switch-toggle.switch-on .switch-label-text {
  order: 1;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding-left: 5px;
}

.btn-switch-toggle.switch-off .switch-ball {
  order: 1;
  margin-right: auto;
}

.btn-switch-toggle.switch-off .switch-label-text {
  order: 2;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding-right: 5px;
}

.card-admin-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-edit-item, .btn-delete-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-edit-item {
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  color: var(--color-charcoal);
}

.btn-delete-item {
  background-color: #FEE2E2;
  color: #991B1B;
}

/* ================= TOKENS LOG ================= */
.tokens-intro-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: var(--color-primary-soft);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.token-history-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.history-token {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.history-status-tag {
  font-size: 0.7rem;
  font-weight: 700;
  background-color: #E7E5E4;
  color: #78716C;
  padding: 2px 6px;
  border-radius: 4px;
}

.history-meta {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.history-time {
  font-size: 0.72rem;
  color: var(--color-text-subtle);
  margin-top: 4px;
}

/* ================= MODAL DETAIL & QRIS ================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(28, 25, 23, 0.65);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
}

.admin-detail-card, .menu-form-card {
  background-color: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 620px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 1.75rem 2rem;
  box-shadow: var(--shadow-card);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
}

.detail-badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.detail-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.btn-detail-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.detail-cust-box {
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  font-size: 0.82rem;
  margin-bottom: 1.25rem;
}

.meta-line {
  display: flex;
  flex-direction: column;
}

.meta-line .lbl {
  font-size: 0.72rem;
  color: var(--color-text-subtle);
}

/* Prominent Cashier QRIS Card */
.qris-cashier-card {
  background-color: var(--color-primary-soft);
  border: 1px solid rgba(61, 90, 76, 0.2);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.qris-cashier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(61, 90, 76, 0.15);
  margin-bottom: 1rem;
}

.qris-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qris-cashier-header .qris-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.qris-title {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--color-primary);
}

.qris-subtitle {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.qris-merchant-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.merchant-name-text {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.nmid-mini-text {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
}

/* BIG DYNAMIC QR CODE DISPLAY */
.qris-large-scan-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 0.5rem;
  background-color: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(61, 90, 76, 0.12);
  margin-bottom: 1rem;
}

.qris-large-qr-box {
  background: #FFFFFF;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
}

.qris-large-img {
  width: 290px;
  height: 290px;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 4px;
}

.qris-scan-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
}

.hint-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--color-peach);
  animation: pulseLive 2s infinite;
}

.qris-nominal-banner {
  width: 100%;
  max-width: 380px;
  text-align: center;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
}

.nom-banner-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  letter-spacing: 0.06em;
}

.nom-banner-value {
  display: block;
  font-size: 1.65rem;
  font-weight: 800;
  color: var(--color-primary);
  margin: 2px 0;
}

.nom-banner-desc {
  display: block;
  font-size: 0.74rem;
  color: var(--color-peach);
  font-weight: 600;
}

.btn-mark-paid {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: center;
  padding: 9px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 700;
}

.btn-mark-paid:disabled {
  background-color: #A3BFB0;
  cursor: default;
}

/* Preparation Status Controls in Modal */
.detail-prep-control-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1rem 1.15rem;
  margin-bottom: 1.5rem;
}

.prep-control-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.prep-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-primary);
}

.prep-control-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.prep-control-sub {
  font-size: 0.76rem;
  color: var(--color-text-subtle);
  margin-bottom: 0.85rem;
  line-height: 1.35;
}

.prep-status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
}

.prep-status-badge.prep-cooking {
  background-color: var(--color-peach-soft);
  color: var(--color-peach);
  border: 1px solid #F5D3C4;
}

.prep-status-badge.prep-ready {
  background-color: #DCFCE7;
  color: #15803D;
  border: 1px solid #86EFAC;
}

.prep-status-badge.prep-done {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border: 1px solid var(--border-medium);
}

.prep-pill-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.btn-prep-opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  background-color: #FFFFFF;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-prep-opt:hover {
  background-color: var(--bg-subtle);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-prep-opt.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
  box-shadow: 0 2px 6px rgba(45, 90, 61, 0.2);
}

.btn-prep-opt.opt-ready.active {
  background-color: #16A34A;
  border-color: #16A34A;
  box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);
}

.btn-prep-opt.opt-done.active {
  background-color: #475569;
  border-color: #475569;
}

/* Preparation Select in Orders Table */
.col-prep-status {
  text-align: center;
}

.select-prep-status {
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.select-prep-status.prep-cooking {
  background-color: var(--color-peach-soft);
  color: var(--color-peach);
  border-color: #F5D3C4;
}

.select-prep-status.prep-ready {
  background-color: #DCFCE7;
  color: #15803D;
  border-color: #86EFAC;
  font-weight: 700;
}

.select-prep-status.prep-done {
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: var(--border-medium);
}

/* Detail Items Box */
.detail-items-box {
  margin-bottom: 1.5rem;
}

.items-head {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 0.75rem;
}

.detail-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-light);
  font-size: 0.85rem;
}

.item-name-col {
  flex: 1;
}

.item-notes {
  display: block;
  font-size: 0.75rem;
  color: var(--color-peach);
}

.detail-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  font-size: 0.95rem;
  font-weight: 700;
}

.grand-total-text {
  font-size: 1.2rem;
  color: var(--color-primary);
}

/* Detail Print Section */
.detail-print-section {
  border-top: 1px solid var(--border-light);
  padding-top: 1.25rem;
}

.print-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 0.75rem;
}

.paper-width-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.switch-buttons {
  display: flex;
  gap: 6px;
}

.btn-paper-opt {
  padding: 4px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 600;
}

.btn-paper-opt.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.tear-alert-card {
  background-color: #FEF3C7;
  border: 1px solid #FCD34D;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 1rem;
  font-size: 0.8rem;
}

.btn-tear-now {
  margin-top: 6px;
  padding: 6px 12px;
  background-color: #B45309;
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.76rem;
  font-weight: 700;
}

.print-buttons-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.print-locked-hint {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background: var(--bg-subtle);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  text-align: center;
}

.btn-print-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-print-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-print-both {
  grid-column: span 2;
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.btn-print-both:hover {
  background-color: var(--color-primary-hover);
}

.btn-print-customer, .btn-print-kitchen {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-medium);
  color: var(--color-charcoal);
}

.btn-print-browser {
  grid-column: span 2;
  background-color: #FFFFFF;
  border: 1px dashed var(--border-medium);
  color: var(--color-text-muted);
}

/* Print Head Row & Saved Printer Badge */
.print-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0.75rem;
}

.saved-printer-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(67, 104, 81, 0.1);
  border: 1px solid rgba(67, 104, 81, 0.25);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.74rem;
  color: var(--color-primary);
}

.printer-dot-live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10B981;
  box-shadow: 0 0 6px #10B981;
}

.printer-name-text {
  font-weight: 600;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-change-dev {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 2px;
}

.btn-change-dev:hover {
  color: var(--color-primary-hover);
}

/* Menu Modal Form */
.menu-edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Image Uploader & Backend Storage */
.hidden-file-input {
  display: none;
}

.image-uploader-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uploader-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.backend-stored-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #059669;
  background-color: #ECFDF5;
  border: 1px solid #A7F3D0;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.image-uploader-card {
  position: relative;
  width: 100%;
  min-height: 120px;
  border: 2px dashed var(--border-medium);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.image-uploader-card:hover {
  border-color: var(--color-primary);
}

.image-uploader-card.has-preview {
  border-style: solid;
  border-color: var(--border-medium);
  background-color: #1a1a1a;
  height: 180px;
}

.upload-dropzone {
  width: 100%;
  height: 100%;
  padding: 1.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropzone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.upload-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: rgba(67, 104, 81, 0.08);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-charcoal);
}

.upload-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.preview-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 2;
}

.btn-preview-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
  border: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

.btn-preview-action.btn-change {
  background-color: rgba(255, 255, 255, 0.92);
  color: #1F2937;
}

.btn-preview-action.btn-change:hover {
  background-color: #FFFFFF;
}

.btn-preview-action.btn-remove {
  background-color: rgba(239, 68, 68, 0.9);
  color: #FFFFFF;
}

.btn-preview-action.btn-remove:hover {
  background-color: #DC2626;
}

.uploading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  z-index: 5;
}

.image-uploader-sub-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.btn-action-text {
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
}

.btn-action-text.text-muted {
  color: var(--color-text-muted);
  font-weight: 500;
  text-decoration: underline;
}

.manual-url-box {
  margin-top: 4px;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  outline: none;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--color-primary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 1rem;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
}

.btn-submit-menu {
  padding: 8px 20px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
}

/* Toast */
.toast-popup {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-card);
  z-index: 200;
}

.toast-popup.success {
  background-color: var(--color-primary);
  color: #FFFFFF;
}

.toast-popup.error {
  background-color: #B91C1C;
  color: #FFFFFF;
}

/* ================= TAB 5: PENGATURAN IKON & BRANDING STYLES ================= */
.branding-section-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.branding-top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-reset-default {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--border-medium);
  padding: 8px 14px;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-reset-default:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.04);
  color: var(--color-charcoal);
  border-color: var(--color-charcoal);
}

.btn-reset-default:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Pratinjau Deck */
.branding-preview-deck {
  background: linear-gradient(135deg, #FAF8F5 0%, #F3EFEA 100%);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.5rem;
}

.preview-deck-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.preview-deck-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.preview-live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(44, 74, 62, 0.08);
  padding: 3px 10px;
  border-radius: var(--radius-full);
}

.live-dot-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #22C55E;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

.preview-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.preview-card {
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.preview-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.preview-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.preview-status-pill {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  background: #F4F1EC;
  padding: 2px 8px;
  border-radius: 4px;
}

/* Browser Window Simulation */
.browser-window-mockup {
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  overflow: hidden;
  background-color: #F9FAFB;
}

.browser-tab-bar {
  display: flex;
  align-items: center;
  background-color: #E5E7EB;
  padding: 6px 8px 0;
  gap: 4px;
}

.browser-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  background: #FFFFFF;
  padding: 6px 12px;
  border-radius: 6px 6px 0 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: #1F2937;
  max-width: 240px;
}

.mock-favicon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.mock-favicon-img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.mock-tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.mock-tab-close {
  color: #9CA3AF;
  font-size: 0.85rem;
  cursor: pointer;
}

.mock-new-tab {
  font-size: 0.9rem;
  color: #6B7280;
  padding: 0 6px;
}

.browser-address-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #FFFFFF;
  border-top: 1px solid #E5E7EB;
  padding: 5px 10px;
  font-size: 0.72rem;
  color: #4B5563;
}

.mock-lock {
  font-size: 0.7rem;
}

.mock-url {
  font-family: monospace;
}

/* Navbar Preview Simulation */
.navbar-preview-mockup {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FAF8F5;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  padding: 8px 14px;
}

.navbar-mock-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mock-brand-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: rgba(44, 74, 62, 0.1);
  color: var(--color-primary);
  overflow: hidden;
}

.mock-brand-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.mock-brand-texts {
  display: flex;
  flex-direction: column;
}

.mock-brand-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.1;
}

.mock-brand-caption {
  font-size: 0.68rem;
  color: var(--color-text-muted);
}

.navbar-mock-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mock-nav-pill {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
}

.mock-nav-cart {
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--color-primary);
  color: #FFFFFF;
  padding: 4px 8px;
  border-radius: var(--radius-full);
}

/* Configuration Panels */
.branding-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.config-panel {
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
}

.panel-header {
  margin-bottom: 1.25rem;
}

.panel-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-charcoal);
  margin-bottom: 3px;
}

.panel-sub {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* Preset Icons Grid */
.preset-icons-grid {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.preset-icon-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #FFFFFF;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
}

.preset-icon-card:hover {
  border-color: var(--border-medium);
  background: #FAF8F5;
}

.preset-icon-card.selected {
  border-color: var(--color-primary);
  background: rgba(44, 74, 62, 0.04);
  box-shadow: 0 0 0 2px rgba(44, 74, 62, 0.15);
}

.preset-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: rgba(44, 74, 62, 0.08);
  color: var(--color-primary);
  flex-shrink: 0;
}

.preset-info {
  flex: 1;
}

.preset-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.preset-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-charcoal);
}

.preset-badge-default {
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(44, 74, 62, 0.1);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: 4px;
}

.preset-badge-active {
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--color-primary);
  color: #FFFFFF;
  padding: 1px 6px;
  border-radius: 4px;
}

.preset-desc {
  font-size: 0.74rem;
  color: var(--color-text-muted);
  line-height: 1.35;
  margin: 0;
}

/* Custom Upload Zone */
.custom-logo-zone {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.upload-dropzone-box {
  border: 2px dashed var(--border-medium);
  border-radius: var(--radius-md);
  padding: 1.5rem 1rem;
  text-align: center;
  cursor: pointer;
  background: #FAF8F5;
  transition: all 0.2s ease;
}

.upload-dropzone-box:hover {
  border-color: var(--color-primary);
  background: #F4EFEB;
}

.upload-dropzone-box.is-uploading {
  opacity: 0.7;
  pointer-events: none;
}

.custom-logo-active-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.active-logo-thumb {
  width: 52px;
  height: 52px;
  object-fit: contain;
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 4px;
}

.active-logo-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.active-logo-info strong {
  font-size: 0.85rem;
  color: var(--color-primary);
}

.active-logo-info span {
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.btn-remove-custom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #FEE2E2;
  color: #DC2626;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-remove-custom:hover {
  background: #FECACA;
}

.upload-dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(44, 74, 62, 0.08);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-texts strong {
  display: block;
  font-size: 0.85rem;
  color: var(--color-charcoal);
  margin-bottom: 2px;
}

.upload-texts span {
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.url-input-block, .brand-name-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-charcoal);
}

.url-input-row {
  display: flex;
  gap: 8px;
}

.btn-apply-url {
  background: var(--color-charcoal);
  color: #FFFFFF;
  border: none;
  padding: 0 14px;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-apply-url:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

/* Bottom Bar */
.branding-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-light);
  padding-top: 1.25rem;
  margin-top: 0.5rem;
}

.footer-status-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.status-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-primary);
}

.footer-action-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 4px;
}

/* ================= RESPONSIVE: TABLET & MOBILE ADMIN ================= */

@media (max-width: 1024px) {
  .admin-stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .admin-main {
    padding: 1.25rem 1rem;
  }
  .menu-admin-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .admin-header-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 0.85rem;
    height: auto;
    padding: 0.85rem 1rem;
  }
  .admin-nav-inner {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 6px 0;
    min-height: auto;
    gap: 6px;
  }
  .admin-nav-tabs {
    justify-self: unset;
  }
  .nav-user-actions {
    justify-self: unset;
  }
  .header-actions,
  .nav-user-actions {
    justify-content: space-between;
    width: 100%;
    flex-wrap: wrap;
    gap: 6px;
  }
  .admin-tabs,
  .admin-nav-tabs {
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    justify-content: flex-start;
    gap: 4px;
  }
  .tab-btn,
  .nav-tab-btn {
    white-space: nowrap;
    padding: 6px 10px;
    font-size: 0.78rem;
    flex-shrink: 0;
  }
  .nav-brand-title {
    font-size: 0.95rem;
  }
  .menu-admin-grid {
    grid-template-columns: 1fr;
  }
  .tokens-grid {
    grid-template-columns: 1fr;
  }
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  /* Modal QRIS Vertikal & Responsif */
  .qris-large-img {
    width: min(260px, 68vw);
    height: auto;
  }
  .qris-merchant-pill {
    align-items: flex-start;
    text-align: left;
    margin-top: 4px;
  }
  .qris-cashier-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .admin-detail-card {
    padding: 1.25rem 1rem;
    max-height: 90vh;
    overflow-y: auto;
    width: 95%;
    max-width: 520px;
  }
  .print-actions-grid {
    grid-template-columns: 1fr;
  }
  .btn-print-both, .btn-print-browser {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .admin-stats-grid {
    grid-template-columns: 1fr;
  }
  .section-top-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .btn-primary-action {
    width: 100%;
    justify-content: center;
  }
  .form-row-2 {
    grid-template-columns: 1fr;
  }
  .table-responsive {
    -webkit-overflow-scrolling: touch;
  }
  .data-table {
    min-width: 760px;
  }
  .data-table th, .data-table td {
    padding: 8px 10px;
    font-size: 0.8rem;
  }
}
</style>
