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
  const rawStr = String(raw || '').trim()
  const digits = rawStr.replace(/\D/g, '')
  if (!digits) return ''

  // 1. Diawali '+' internasional (misal +62, +65, +1)
  if (rawStr.startsWith('+')) {
    if (digits.startsWith('62')) {
      let sub = digits.slice(2)
      if (sub.startsWith('0')) sub = sub.slice(1)
      return `62${sub}`
    }
    return digits
  }

  // 2. Diawali '62' (kode negara Indonesia tanpa '+', misal 62812... atau 620812...)
  if (digits.startsWith('62')) {
    let sub = digits.slice(2)
    if (sub.startsWith('0')) sub = sub.slice(1)
    return `62${sub}`
  }

  // 3. Diawali '00' (international direct dialing prefix)
  if (digits.startsWith('00')) {
    return digits.slice(2)
  }

  // 4. Diawali '0' (nomor lokal Indonesia umum, misal 0812...) -> ubah ke format internasional 62812...
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }

  // 5. Diawali '8' tanpa 0 dan tanpa kode negara (misal 81234567890) -> ubah ke format internasional 62812...
  if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 13) {
    return `62${digits}`
  }

  // 6. Nomor internasional lainnya yang sudah diawali kode negara
  return digits
}

/** Link "chat" WhatsApp. `''` bila nomor tidak valid. */
export function waLink(phone, text) {
  const digits = normalizeWaPhone(phone)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`
}

export function isValidWaPhone(raw) {
  const digits = normalizeWaPhone(raw)
  // Mendukung nomor lokal Indonesia maupun internasional (panjang 8 s.d. 16 digit)
  return digits.length >= 8 && digits.length <= 16
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