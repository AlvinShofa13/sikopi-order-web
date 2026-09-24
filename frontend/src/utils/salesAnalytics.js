/**
 * salesAnalytics — pure helpers for the admin analytics dashboard.
 * Input: orders in serialized shape (orderId, items[], payment{}, breakdown{}).
 * Used as client-side fallback when GET /orders/stats is unreachable.
 */

export function topMenus(orders = [], limit = 10) {
  const acc = new Map()
  for (const ord of orders || []) {
    for (const it of ord.items || []) {
      const name = it.name || '-'
      const cur = acc.get(name) || { name, qty: 0, revenue: 0, orders: 0 }
      cur.qty += it.quantity || 1
      cur.revenue += it.subtotal ?? (it.price || 0) * (it.quantity || 1)
      cur.orders += 1
      acc.set(name, cur)
    }
  }
  return [...acc.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

export function paymentBreakdown(orders = []) {
  const total = (orders || []).length
  const acc = new Map()
  for (const ord of orders || []) {
    const raw = (ord.payment?.method || 'unknown').toLowerCase()
    const label = raw === 'qris' ? 'QRIS' : raw === 'cash' || raw === 'tunai' ? 'Tunai di Kasir' : raw
    const cur = acc.get(raw) || { method: raw, label, count: 0, pct: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += ord.breakdown?.total || 0
    acc.set(raw, cur)
  }
  for (const v of acc.values()) v.pct = total ? Math.round((v.count / total) * 1000) / 10 : 0
  return [...acc.values()].sort((a, b) => b.count - a.count)
}

export function salesSummary(orders = []) {
  return {
    total_orders: (orders || []).length,
    total_revenue: (orders || []).reduce((s, o) => s + (o.breakdown?.total || 0), 0),
    total_portions: (orders || []).reduce(
      (s, o) => s + (o.items || []).reduce((a, i) => a + (i.quantity || 1), 0),
      0
    )
  }
}

export function downloadFromUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename || ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// Client-side CSV fallback (same columns as GET /orders/export?format=csv).
export function ordersToCsv(orders = []) {
  const header = ['No Pesanan', 'Waktu', 'Pelanggan', 'Telepon', 'Token', 'Tipe Layanan', 'Menu', 'Qty', 'Total Order', 'Metode Bayar', 'Status Bayar']
  const lines = [header.map(csvCell).join(',')]
  for (const ord of orders || []) {
    const base = [ord.orderId, ord.createdAt, ord.customer?.name, ord.customer?.phone, ord.customer?.token || '-', ord.customer?.orderType]
    if (ord.items?.length) {
      for (const it of ord.items) {
        lines.push([...base, it.name, it.quantity, ord.breakdown?.total || 0, ord.payment?.label || ord.payment?.method, ord.payment?.status].map(csvCell).join(','))
      }
    } else {
      lines.push([...base, '-', 0, ord.breakdown?.total || 0, ord.payment?.label || ord.payment?.method, ord.payment?.status].map(csvCell).join(','))
    }
  }
  return '\uFEFF' + lines.join('\r\n')
}
