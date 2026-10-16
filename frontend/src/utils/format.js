import { ref } from 'vue'

export function formatRupiah(value) {
  if (!value) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

export function isCustomImage(val) {
  if (!val) return false
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:') || val.startsWith('/')
}

// Isi paket bundling: dinormalisasi dari JSON string / array backend
// '[{"id": "menu-x", "quantity": 2}]' -> [{ id, quantity }].
export function parseBundleItems(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((l) => l && typeof l === 'object' && l.id)
    .map((l) => ({ id: l.id, quantity: Number(l.quantity || l.qty || 1) || 1 }))
}

// Label ringkas isi paket: "2x Kopi Susu, 1x Roti" (nama diambil dari daftar menu).
export function bundleContentsLabel(bundleRaw, menuList = []) {
  const byId = new Map((menuList || []).map((m) => [m.id, m.name || m.id]))
  return parseBundleItems(bundleRaw)
    .map((l) => `${l.quantity}x ${byId.get(l.id) || l.id}`)
    .join(', ')
}

// Hemat paket: total harga satuan isi vs harga paket.
// -> { sum, savings }; savings 0 bila harga paket >= total satuan.
export function bundleSavings(bundleRaw, menuList = [], bundlePrice = 0) {
  const byId = new Map((menuList || []).map((m) => [m.id, Number(m.price) || 0]))
  const sum = parseBundleItems(bundleRaw)
    .reduce((s, l) => s + (byId.get(l.id) || 0) * l.quantity, 0)
  const savings = sum - Number(bundlePrice || 0)
  return { sum, savings: savings > 0 ? savings : 0 }
}

// Varian menu: dinormalisasi dari JSON string / array backend
// '[{"name": "Es", "price": 0}]' -> [{ name, price }].
export function parseVariants(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr
    .filter((v) => v && typeof v === 'object' && (v.name || '').trim() && !seen.has((v.name || '').trim()) && seen.add((v.name || '').trim()))
    .map((v) => ({ name: (v.name || '').trim(), price: Number(v.price || 0) || 0 }))
}

// Label varian: "Es (Gratis), Extra Shot (+Rp5.000)".
export function variantsLabel(variantsRaw) {
  return parseVariants(variantsRaw)
    .map((v) => (v.price > 0 ? `${v.name} (+${formatRupiah(v.price)})` : `${v.name} (Gratis)`))
    .join(', ')
}

// Total biaya tambahan varian terpilih (harga dari daftar resmi menu).
export function variantExtras(menuItem, selectedNames = []) {
  const byName = new Map(parseVariants(menuItem?.variants).map((v) => [v.name, v.price]))
  return (selectedNames || []).reduce((sum, n) => sum + (byName.get(n) || 0), 0)
}

// Toast stateful: const { toastMessage, toastType, showToast } = createToast(2600)
export function createToast(duration = 3500) {
  const toastMessage = ref('')
  const toastType = ref('success')
  let timer = null
  function showToast(msg, type = 'success') {
    toastMessage.value = msg
    toastType.value = type
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      toastMessage.value = ''
    }, duration)
  }
  return { toastMessage, toastType, showToast }
}
