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

// Varian menu (mendukung format grup dan format flat lama).
// -> [{ group, required, multiple, options: [{ name, price, key }] }]
export function parseVariantGroups(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return []

  const isGrouped = arr.some((r) => r && typeof r === 'object' && ('group' in r || 'options' in r))
  if (isGrouped) {
    const seenGroups = new Set()
    const groups = []
    for (const g of arr) {
      if (!g || typeof g !== 'object') continue
      const groupName = (g.group || '').trim()
      if (!groupName || seenGroups.has(groupName)) continue
      seenGroups.add(groupName)
      const seenOpts = new Set()
      const options = (Array.isArray(g.options) ? g.options : [])
        .filter((o) => {
          const n = (o?.name || '').trim()
          if (!n || seenOpts.has(n)) return false
          seenOpts.add(n)
          return true
        })
        .map((o) => {
          const name = (o.name || '').trim()
          return {
            name,
            price: Number(o.price || 0) || 0,
            key: `${groupName}: ${name}`
          }
        })
      if (options.length > 0) {
        groups.push({
          group: groupName,
          required: Boolean(g.required),
          multiple: Boolean(g.multiple),
          options
        })
      }
    }
    return groups
  }

  const seen = new Set()
  const flatOptions = arr
    .filter((v) => v && typeof v === 'object' && (v.name || '').trim() && !seen.has((v.name || '').trim()) && seen.add((v.name || '').trim()))
    .map((v) => {
      const name = (v.name || '').trim()
      return { name, price: Number(v.price || 0) || 0, key: name }
    })
  if (flatOptions.length === 0) return []
  return [{ group: '', required: false, multiple: true, options: flatOptions }]
}

// Daftar flat varian dari grup/flat untuk perhitungan harga & cek ada tidaknya varian.
// -> [{ name, price }]
export function parseVariants(raw) {
  return parseVariantGroups(raw).flatMap((g) =>
    g.options.map((o) => ({
      name: o.key,
      price: o.price
    }))
  )
}

// Label ringkas varian untuk kartu menu.
export function variantsLabel(variantsRaw) {
  const groups = parseVariantGroups(variantsRaw)
  if (groups.length === 0) return ''
  if (groups.length === 1 && !groups[0].group) {
    return groups[0].options
      .map((v) => (v.price > 0 ? `${v.name} (+${formatRupiah(v.price)})` : `${v.name} (Gratis)`))
      .join(', ')
  }
  return groups
    .map((g) => `${g.group}${g.required ? '*' : ''} (${g.options.map((o) => o.name).join('/')})`)
    .join(' · ')
}

// Kumpulkan seluruh bagian varian untuk menu tunggal maupun paket bundel (termasuk varian tiap item di dalam paket).
// -> [{ title, sourceName, groups: [{ group, required, multiple, options: [{ name, price, key }] }] }]
export function parseMenuVariantSections(menuItem, allMenuItems = []) {
  if (!menuItem) return []
  const sections = []
  const ownGroups = parseVariantGroups(menuItem.variants)
  if (ownGroups.length > 0) {
    sections.push({
      title: menuItem.is_bundle ? `Varian Paket (${menuItem.name})` : '',
      sourceName: menuItem.name || '',
      groups: ownGroups
    })
  }
  if (menuItem.is_bundle && Array.isArray(allMenuItems) && allMenuItems.length > 0) {
    const byId = new Map(allMenuItems.map((m) => [m.id, m]))
    for (const line of parseBundleItems(menuItem.bundle_items)) {
      const comp = byId.get(line.id)
      if (!comp) continue
      const compGroups = parseVariantGroups(comp.variants)
      if (compGroups.length === 0) continue
      const prefix = `[${comp.name}] `
      sections.push({
        title: `${line.quantity}x ${comp.name}`,
        sourceName: comp.name,
        groups: compGroups.map((g) => ({
          ...g,
          options: g.options.map((o) => ({
            ...o,
            key: `${prefix}${o.key}`
          }))
        }))
      })
    }
  }
  return sections
}

// Daftar nama kelompok varian saja (untuk badge kotak pada list produk utama).
// -> [{ label, required }]
export function variantGroupTags(menuItem, allMenuItems = []) {
  const sections = parseMenuVariantSections(menuItem, allMenuItems)
  const seen = new Set()
  const tags = []
  for (const sec of sections) {
    for (const g of sec.groups) {
      const label = (g.group || '').trim() || 'Varian'
      if (seen.has(label)) continue
      seen.add(label)
      tags.push({ label, required: Boolean(g.required) })
    }
  }
  return tags
}

// Total biaya tambahan varian terpilih (harga dari daftar resmi menu & isi paket bundel).
export function variantExtras(menuItem, selectedNames = [], allMenuItems = []) {
  const sections = parseMenuVariantSections(menuItem, allMenuItems)
  const byName = new Map()
  if (sections.length > 0) {
    for (const sec of sections) {
      for (const g of sec.groups) {
        for (const o of g.options) {
          byName.set(o.key, o.price)
        }
      }
    }
  } else {
    for (const v of parseVariants(menuItem?.variants)) {
      byName.set(v.name, v.price)
    }
  }
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
