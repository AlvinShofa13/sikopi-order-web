/**
 * Utility untuk konversi QRIS Statis ke QRIS Dinamis (EMVCo MPM Standard)
 * Data resmi bersumber dari merchant "AZRIEL SABIQ GAMING GEAR" (NMID: ID1026528966314)
 */

import qrcode from './qrcodeGenerator.js'

export const STATIC_QRIS_AZRIEL_SABIQ =
  '00020101021126610014COM.GO-JEK.WWW01189360091437660130700210G7660130700303UMI51440014ID.CO.QRIS.WWW0215ID10265289663140303UMI5204573253033605802ID5924AZRIEL SABIQ GAMING GEAR6008KARAWANG61054137162070703A016304D859'

/**
 * Menghitung Checksum CRC16 CCITT (Polynomial 0x1021, Initial 0xFFFF)
 * Standar resmi EMVCo & Bank Indonesia / ASPI
 * @param {string} data 
 * @returns {string} 4-karakter hex uppercase
 */
export function calculateCRC16(data) {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8)
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF
      } else {
        crc = (crc << 1) & 0xFFFF
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Mengubah string QRIS statis menjadi string QRIS Dinamis dengan nominal pesanan
 * @param {string} staticQris - String QRIS statis asal (default: AZRIEL SABIQ GAMING GEAR)
 * @param {number} amount - Nominal transaksi dalam Rupiah (contoh: 1, 15000, 88000)
 * @returns {string} String payload QRIS Dinamis lengkap berstandar EMVCo ASPI
 */
export function generateDynamicQrisPayload(staticQris = STATIC_QRIS_AZRIEL_SABIQ, amount = 0) {
  // 1. Potong 4 karakter CRC lama di belakang
  let base = staticQris.slice(0, -4)
  if (base.endsWith('6304')) {
    base = base.slice(0, -4)
  }

  // 2. Ubah Tag 01 dari 010211 (Statis) menjadi 010212 (Dinamis)
  let dynamicBase = base.replace('010211', '010212')

  // 3. Format Tag 54 (Transaction Amount)
  const amountStr = Math.max(1, Math.round(amount || 0)).toString()
  const tag54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`

  // 4. Sisipkan Tag 54 sebelum Tag 58 (Country Code '5802ID')
  const tag58Index = dynamicBase.indexOf('5802ID')
  const baseWithTag54 = tag58Index !== -1
    ? dynamicBase.slice(0, tag58Index) + tag54 + dynamicBase.slice(tag58Index)
    : dynamicBase + tag54

  const payloadWithoutCrc = `${baseWithTag54}6304`

  // 5. Hitung CRC-16 baru dan gabungkan
  const newCrc = calculateCRC16(payloadWithoutCrc)
  return payloadWithoutCrc + newCrc
}

/**
 * Menghasilkan Base64 Data URL (GIF/PNG) gambar QR Code secara 100% offline & client-side
 * @param {number} amount - Nominal transaksi
 * @param {string} staticQris - Base static QRIS
 * @param {number} cellSize - Ukuran pixel per module (default 8 untuk scan presisi tinggi)
 * @param {number} margin - Margin putih sekeliling QR (default 4)
 * @returns {string} data:image/... base64 string
 */
export function generateQrisDataUrl(amount, staticQris = STATIC_QRIS_AZRIEL_SABIQ, cellSize = 8, margin = 4) {
  const payload = generateDynamicQrisPayload(staticQris, amount)
  const qr = qrcode(0, 'M')
  qr.addData(payload)
  qr.make()
  return qr.createDataURL(cellSize, margin)
}

/**
 * Fallback URL gambar QR code menggunakan API online
 * @param {string} qrisPayload 
 * @param {number} size 
 * @returns {string}
 */
export function getQrisImageUrl(qrisPayload, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(qrisPayload)}`
}
