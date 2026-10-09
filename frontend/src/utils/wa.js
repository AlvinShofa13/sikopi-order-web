/**
 * Pembuat pesan WhatsApp untuk SIKopi — tombol kirim-MANUAL (fallback).
 *
 * Pengiriman OTOMATIS dilakukan server (backend/wa_templates.py + wa-gateway
 * Baileys) setiap pesanan dibuat dan setiap status berubah. Fungsi-fungsi di
 * sini dipakai tombol "Kirim via WhatsApp" di halaman pelanggan & panel kasir
 * untuk keadaan gateway mati/belum pairing: `wa.me` membuka WhatsApp dengan
 * pesan sudah terisi, tinggal tekan "Kirim".
 *
 * CATATAN DUPLIKASI SADAR: teks nota & status juga ada di backend/wa_templates.py.
 * Bila mengubah salah satu, ubah keduanya (format 1:1).
 */

import { formatRupiah } from '@/utils/format'

const DEFAULT_BRAND = 'SIKopi'

export function normalizeWaPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits.slice(2)
  return digits.replace(/^0/, '')
}

/** Link "chat" WhatsApp. `''` bila nomor tidak valid. */
export function waLink(phone, text) {
  const digits = normalizeWaPhone(phone)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`
}

export function isValidWaPhone(raw) {
  const digits = normalizeWaPhone(raw)
  return digits.length >= 9 && digits.length <= 13
}

function itemLines(order = {}) {
  return (order.items || [])
    .map((it) => {
      const note = it.notes ? ` (${it.notes})` : ''
      return `- ${it.quantity}x ${it.name}${note} = ${formatRupiah(it.subtotal ?? it.price * it.quantity)}`
    })
    .join('\n')
}

/** Nota digital lengkap — dikirim setelah transaksi tercatat & lunas. */
export function orderReceiptText(order, brandName = DEFAULT_BRAND) {
  const brand = brandName || DEFAULT_BRAND
  const channel = order.channel === 'preorder' ? 'Open PO' : 'On-site'
  const lines = [
    `*${brand} — Nota Digital*`,
    '',
    `Kode Pesanan: *${order.orderId}*`,
    `Pelanggan: ${order.customer?.name || '-'}`,
    channel === 'Open PO' && order.batch?.name ? `Batch: ${order.batch.name}` : null,
    order.batch?.pickupDate ? `Siap diambil: ${new Date(order.batch.pickupDate).toLocaleString('id-ID')}` : null,
    '',
    itemLines(order),
    '',
    `Subtotal: ${formatRupiah(order.breakdown?.subtotal)}`,
    `Total: *${formatRupiah(order.breakdown?.total)}*`,
    `Bayar: ${order.payment?.paid ? 'LUNAS' : 'Belum lunas'} (${order.payment?.label || order.payment?.method})`,
    '',
    `Status: ${order.orderStatus}`,
    'Tersimpan otomatis. Simpan nota ini sebagai bukti.'
  ]
  return lines.filter((l) => l !== null).join('\n')
}

/** Pesan status pesanan yang dikirim kasir lewat WhatsApp. */
export function orderStatusText(order, status, brandName = DEFAULT_BRAND) {
  const brand = brandName || DEFAULT_BRAND
  const head = `*${brand}* — Pesanan *${order.orderId}*`
  const map = {
    'Diterima & Disiapkan': [
      head,
      '',
      'Pesanan Anda sudah kami terima dan masuk antrean dapur.',
      'Kami kabari lagi saat hidangan siap diambil.'
    ],
    'Sedang Disiapkan': [
      head,
      '',
      'Pesanan Anda sedang diracik oleh barista kami. Mohon tunggu sebentar lagi.'
    ],
    'Siap Diambil': [
      head,
      '',
      '*Pesanan Anda SIAP DIAMBIL* di outlet kami.',
      order.batch?.name ? `Batch: ${order.batch.name}` : null,
      'Silakan datang ke meja kasir dan sebutkan kode pesanan di atas. Terima kasih!'
    ],
    Selesai: [
      head,
      '',
      'Pesanan Anda sudah selesai. Terima kasih sudah maddenii di',
      `${brand}!`
    ],
    Batal: [head, '', 'Mohon maaf, pesanan Anda dibatalkan. Hubungi kasir bila ada pertanyaan.']
  }
  const body = map[status] || [head, '', `Status pesanan Anda: ${status}`]
  return body.filter((l) => l !== null).join('\n')
}

/** Buka WhatsApp di tab baru; no-op bila link kosong. */
export function openWhatsApp(phone, text) {
  const url = waLink(phone, text)
  if (!url) return false
  window.open(url, '_blank', 'noopener')
  return true
}