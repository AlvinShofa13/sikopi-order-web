/**
 * Utilitas Web Bluetooth untuk Printer Thermal ESC/POS
 * sikopi POS System
 */

// Kumpulan UUID Layanan BLE GATT umum pada printer thermal portabel (58mm / 80mm)
export const KNOWN_PRINTER_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Paling umum (HM-10 / POS-58 / Goojprt / Panda)
  '49535343-fe7d-4ae5-8b93-f2378465b4d4', // ISSC Microchip BLE UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Pos-Thermal custom
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Zjiang / Generic POS
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic BLE UART
  '0000fee7-0000-1000-8000-00805f9b34fb', // Wechat / IoT Printer
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb'
]

// Perintah Dasar Standar ESC/POS
export const ESC_POS = {
  INIT: [0x1b, 0x40], // Inisialisasi printer
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  FONT_NORMAL: [0x1d, 0x21, 0x00],
  FONT_DOUBLE_HEIGHT: [0x1d, 0x21, 0x01],
  FONT_DOUBLE_WIDTH: [0x1d, 0x21, 0x10],
  FONT_DOUBLE_SIZE: [0x1d, 0x21, 0x11], // 2x lebar & tinggi
  FEED_LINES: (n = 3) => [0x1b, 0x64, n],
  CUT_PAPER: [0x1d, 0x56, 0x42, 0x00], // Partial cut
  BEEP: (times = 2) => [0x1b, 0x42, times, 0x02], // ESC B n t (Bunyikan buzzer printer)
  BELL: [0x07] // ASCII Bell
}

/**
 * Cek apakah browser mendukung Web Bluetooth API
 */
export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof navigator.bluetooth.requestDevice === 'function'
}

/**
 * Format mata uang Rupiah sederhana untuk struk teks ESC/POS
 */
export function formatRupiahSimple(val) {
  const num = Number(val) || 0
  return 'Rp ' + num.toLocaleString('id-ID')
}

/**
 * Format teks 2 kolom (kiri & kanan) sesuai lebar kertas thermal (default 32 char untuk 58mm)
 */
export function formatTwoColumns(leftText, rightText, lineWidth = 32) {
  const left = String(leftText || '').trim()
  const right = String(rightText || '').trim()
  const availableSpace = lineWidth - left.length - right.length

  if (availableSpace > 0) {
    return left + ' '.repeat(availableSpace) + right
  }

  // Jika terlalu panjang, potong teks kiri sedikit
  if (left.length + right.length > lineWidth) {
    const maxLeft = lineWidth - right.length - 1
    if (maxLeft > 4) {
      return left.substring(0, maxLeft) + ' ' + right
    }
  }

  return left + ' ' + right
}

/**
 * Menghasilkan representasi plain text struk dapur / internal
 * Desain Minimalis SIKopi:
 * - Hanya SIKopi dan tanda [ STRUK DAPUR ]
 * - Tanpa nama pemesan, kontak, atau jenis layanan
 * - Tanpa status bayar lunas di total akhir
 */
export function generateKitchenReceiptText(order, width = 32) {
  if (!order) return ''

  const dividerSingle = '-'.repeat(width)
  const dividerDouble = '='.repeat(width)
  const lines = []

  // 1. Header (Hanya SIKopi dan Tanda Struk Dapur)
  lines.push('SIKopi'.padStart((width + 6) / 2))
  lines.push('[ STRUK DAPUR ]'.padStart((width + 15) / 2))
  lines.push(dividerDouble)

  // 2. Metadata Pesanan (No. Pesanan, Pelanggan, dan Waktu)
  lines.push(formatTwoColumns('No. Pesanan:', order.id || '-', width))
  lines.push(formatTwoColumns('Pelanggan:', order.customer?.name || 'Pelanggan', width))
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')
  lines.push(formatTwoColumns('Waktu:', orderDate, width))

  lines.push(dividerSingle)
  lines.push('DAFTAR PESANAN DAPUR:')

  let totalQty = 0
  if (order.items && order.items.length > 0) {
    order.items.forEach((item) => {
      const q = item.quantity || 1
      totalQty += q
      lines.push(`[ ] ${q}x ${item.name}`)
      if (item.notes) {
        lines.push(`    * Catatan: ${item.notes}`)
      }
    })
  }

  lines.push(dividerSingle)
  lines.push(formatTwoColumns('Total Menu:', `${order.items?.length || 0} item (${totalQty} porsi)`, width))
  const totalAmount = order.breakdown?.total || 0
  lines.push(formatTwoColumns('Total Nilai:', formatRupiahSimple(totalAmount), width))
  lines.push(dividerSingle)

  lines.push('Paraf Barista / Dapur:'.padStart((width + 22) / 2))
  lines.push('')
  lines.push('(_________________________)'.padStart((width + 27) / 2))

  return lines.join('\n')
}

/**
 * Menghasilkan representasi plain text struk pelanggan
 * Desain Minimalis SIKopi:
 * - Hanya SIKopi dan tanda [ STRUK PELANGGAN ]
 * - Termasuk Nama Pemesan
 * - Tanpa kontak atau jenis layanan
 * - Tanpa status bayar lunas di total akhir
 */
export function generateCustomerReceiptText(order, width = 32) {
  if (!order) return ''

  const dividerSingle = '-'.repeat(width)
  const dividerDouble = '='.repeat(width)
  const lines = []

  // 1. Header (Hanya SIKopi dan Tanda Struk Pelanggan)
  lines.push('SIKopi'.padStart((width + 6) / 2))
  lines.push('[ STRUK PELANGGAN ]'.padStart((width + 19) / 2))
  lines.push(dividerSingle)

  // 2. Metadata Pesanan (No. Pesanan, Nama, Waktu, Pembayaran)
  lines.push(formatTwoColumns('No. Pesanan:', order.id || '-', width))
  lines.push(formatTwoColumns('Nama:', order.customer?.name || 'Pelanggan', width))
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')
  lines.push(formatTwoColumns('Waktu:', orderDate, width))

  if (order.payment?.label) {
    lines.push(formatTwoColumns('Pembayaran:', order.payment.label, width))
  }

  lines.push(dividerSingle)
  lines.push('RINCIAN PESANAN:')

  // Rincian Menu
  if (order.items && order.items.length > 0) {
    order.items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}`)
      const subtotalItem = (item.price || 0) * (item.quantity || 1)
      const detailQty = `   ${item.quantity}x @${(item.price || 0).toLocaleString('id-ID')}`
      lines.push(formatTwoColumns(detailQty, formatRupiahSimple(subtotalItem), width))
      if (item.notes) {
        lines.push(`   * ${item.notes}`)
      }
    })
  }

  lines.push(dividerSingle)

  // Rincian Biaya
  const breakdown = order.breakdown || {}
  lines.push(formatTwoColumns('Subtotal:', formatRupiahSimple(breakdown.subtotal || 0), width))

  if (breakdown.ecoFee) {
    lines.push(formatTwoColumns('Kemasan:', formatRupiahSimple(breakdown.ecoFee), width))
  }
  if (breakdown.tax) {
    lines.push(formatTwoColumns('PB1 Restoran (10%):', formatRupiahSimple(breakdown.tax), width))
  }

  lines.push(dividerDouble)
  lines.push(formatTwoColumns('TOTAL AKHIR:', formatRupiahSimple(breakdown.total || 0), width))
  lines.push(dividerSingle)

  // Footer
  lines.push('Terima kasih atas pesanan Anda!'.padStart((width + 31) / 2))
  lines.push('Instagram: @sikopi.jkt'.padStart((width + 22) / 2))

  return lines.join('\n')
}

/**
 * Menghasilkan representasi plain text struk pemesanan (dapur, pelanggan, atau keduanya)
 * @param {Object} order Objek pesanan
 * @param {number} width Lebar kolom (32 atau 48)
 * @param {'both'|'kitchen'|'customer'} mode Mode struk
 */
export function generateReceiptPlainText(order, width = 32, mode = 'both') {
  if (!order) return ''

  if (mode === 'kitchen') {
    return generateKitchenReceiptText(order, width)
  }

  if (mode === 'customer') {
    return generateCustomerReceiptText(order, width)
  }

  // Mode 'both': tampilkan kedua struk dengan pemisah jelas
  const blockDivider = '='.repeat(width)
  const headerDapur = '=== 1. STRUK DAPUR ==='
  const headerPelanggan = '=== 2. STRUK PELANGGAN ==='

  return [
    blockDivider,
    headerDapur.padStart((width + headerDapur.length) / 2).substring(0, width),
    blockDivider,
    generateKitchenReceiptText(order, width),
    '\n' + blockDivider,
    headerPelanggan.padStart((width + headerPelanggan.length) / 2).substring(0, width),
    blockDivider,
    generateCustomerReceiptText(order, width)
  ].join('\n')
}

/**
 * Membangun buffer byte ESC/POS untuk Struk Dapur
 */
export function buildKitchenEscPosBuffer(order, width = 32) {
  const encoder = new TextEncoder()
  const byteArrays = []

  function pushBytes(arr) {
    byteArrays.push(new Uint8Array(arr))
  }

  function pushText(text) {
    const normalized = (text || '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/[•]/g, '*')
    byteArrays.push(encoder.encode(normalized + '\n'))
  }

  // 1. Inisialisasi
  pushBytes(ESC_POS.INIT)

  // 2. Header (Hanya SIKopi dan Tanda Struk Dapur)
  pushBytes(ESC_POS.ALIGN_CENTER)
  pushBytes(ESC_POS.FONT_DOUBLE_SIZE)
  pushBytes(ESC_POS.BOLD_ON)
  pushText('SIKopi')

  pushBytes(ESC_POS.FONT_NORMAL)
  pushBytes(ESC_POS.BOLD_OFF)
  pushText('[ STRUK DAPUR ]')

  // 3. Garis pembatas
  const dividerSingle = '-'.repeat(width)
  const dividerDouble = '='.repeat(width)
  pushText(dividerDouble)

  // 4. Metadata Pesanan (No. Pesanan, Pelanggan, dan Waktu)
  pushBytes(ESC_POS.ALIGN_LEFT)
  pushBytes(ESC_POS.BOLD_ON)
  pushText(formatTwoColumns('No. Pesanan:', order.id || '-', width))
  pushText(formatTwoColumns('Pelanggan:', order.customer?.name || 'Pelanggan', width))
  pushBytes(ESC_POS.BOLD_OFF)

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')
  pushText(formatTwoColumns('Waktu:', orderDate, width))

  pushText(dividerSingle)

  // 5. Rincian Item Dapur
  pushBytes(ESC_POS.BOLD_ON)
  pushText('DAFTAR PESANAN DAPUR:')
  pushBytes(ESC_POS.BOLD_OFF)

  let totalQty = 0
  if (order.items && order.items.length > 0) {
    order.items.forEach((item) => {
      const q = item.quantity || 1
      totalQty += q

      pushBytes(ESC_POS.BOLD_ON)
      pushBytes(ESC_POS.FONT_DOUBLE_HEIGHT)
      pushText(`[ ] ${q}x ${item.name}`)
      pushBytes(ESC_POS.FONT_NORMAL)
      pushBytes(ESC_POS.BOLD_OFF)

      if (item.notes) {
        pushText(`    * Catatan: ${item.notes}`)
      }
    })
  }

  pushText(dividerSingle)
  pushText(formatTwoColumns('Total Menu:', `${order.items?.length || 0} item (${totalQty} porsi)`, width))
  const totalAmount = order.breakdown?.total || 0
  pushBytes(ESC_POS.BOLD_ON)
  pushText(formatTwoColumns('Total Nilai:', formatRupiahSimple(totalAmount), width))
  pushBytes(ESC_POS.BOLD_OFF)
  pushText(dividerSingle)

  // 6. Tanda Tangan Barista / Dapur
  pushBytes(ESC_POS.ALIGN_CENTER)
  pushText('Paraf Barista / Dapur:')
  pushText('')
  pushText('(_________________________)')

  // 7. Feed Kertas (5 baris) agar melewati gerigi sobek kertas & potong
  pushBytes(ESC_POS.FEED_LINES(5))
  pushBytes(ESC_POS.CUT_PAPER)
  pushBytes(ESC_POS.BEEP(2))
  pushBytes(ESC_POS.BELL)

  return mergeByteArrays(byteArrays)
}

/**
 * Membangun buffer byte ESC/POS untuk Struk Pelanggan
 */
export function buildCustomerEscPosBuffer(order, width = 32) {
  const encoder = new TextEncoder()
  const byteArrays = []

  function pushBytes(arr) {
    byteArrays.push(new Uint8Array(arr))
  }

  function pushText(text) {
    const normalized = (text || '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/[•]/g, '*')
    byteArrays.push(encoder.encode(normalized + '\n'))
  }

  // 1. Inisialisasi
  pushBytes(ESC_POS.INIT)

  // 2. Header (Hanya SIKopi dan Tanda Struk Pelanggan)
  pushBytes(ESC_POS.ALIGN_CENTER)
  pushBytes(ESC_POS.FONT_DOUBLE_SIZE)
  pushBytes(ESC_POS.BOLD_ON)
  pushText('SIKopi')

  pushBytes(ESC_POS.FONT_NORMAL)
  pushBytes(ESC_POS.BOLD_OFF)
  pushText('[ STRUK PELANGGAN ]')

  // 3. Garis pembatas
  const dividerSingle = '-'.repeat(width)
  const dividerDouble = '='.repeat(width)
  pushText(dividerSingle)

  // 4. Metadata Pesanan (No. Pesanan, Nama, Waktu, Pembayaran)
  pushBytes(ESC_POS.ALIGN_LEFT)
  pushBytes(ESC_POS.BOLD_ON)
  pushText(formatTwoColumns('No. Pesanan:', order.id || '-', width))
  pushText(formatTwoColumns('Nama:', order.customer?.name || 'Pelanggan', width))
  pushBytes(ESC_POS.BOLD_OFF)

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')
  pushText(formatTwoColumns('Waktu:', orderDate, width))

  if (order.payment?.label) {
    pushText(formatTwoColumns('Pembayaran:', order.payment.label, width))
  }

  pushText(dividerSingle)

  // 5. Rincian Item Hidangan
  pushBytes(ESC_POS.BOLD_ON)
  pushText('RINCIAN PESANAN:')
  pushBytes(ESC_POS.BOLD_OFF)

  if (order.items && order.items.length > 0) {
    order.items.forEach((item, index) => {
      pushBytes(ESC_POS.BOLD_ON)
      pushText(`${index + 1}. ${item.name}`)
      pushBytes(ESC_POS.BOLD_OFF)

      const subtotalItem = (item.price || 0) * (item.quantity || 1)
      const detailQty = `   ${item.quantity}x @${(item.price || 0).toLocaleString('id-ID')}`
      pushText(formatTwoColumns(detailQty, formatRupiahSimple(subtotalItem), width))

      if (item.notes) {
        pushText(`   * Catatan: ${item.notes}`)
      }
    })
  }

  pushText(dividerSingle)

  // 6. Rincian Keuangan
  const breakdown = order.breakdown || {}
  pushText(formatTwoColumns('Subtotal', formatRupiahSimple(breakdown.subtotal || 0), width))

  if (breakdown.ecoFee) {
    pushText(formatTwoColumns('Kemasan', formatRupiahSimple(breakdown.ecoFee), width))
  }
  if (breakdown.tax) {
    pushText(formatTwoColumns('PB1 Restoran (10%)', formatRupiahSimple(breakdown.tax), width))
  }

  pushText(dividerDouble)

  // Total Akhir (Tebal) - Tanpa Status Bayar Lunas
  pushBytes(ESC_POS.BOLD_ON)
  pushText(formatTwoColumns('TOTAL PEMBAYARAN', formatRupiahSimple(breakdown.total || 0), width))
  pushBytes(ESC_POS.BOLD_OFF)

  pushText(dividerSingle)

  // 7. Footer
  pushBytes(ESC_POS.ALIGN_CENTER)
  pushText('Terima kasih atas pesanan Anda!')
  pushText('Instagram: @sikopi.jkt')

  // 8. Feed Kertas (5 baris) & Potong
  pushBytes(ESC_POS.FEED_LINES(5))
  pushBytes(ESC_POS.CUT_PAPER)
  pushBytes(ESC_POS.BEEP(1))
  pushBytes(ESC_POS.BELL)

  return mergeByteArrays(byteArrays)
}

/**
 * Menggabungkan daftar Uint8Array menjadi satu buffer
 */
function mergeByteArrays(byteArrays) {
  const totalLength = byteArrays.reduce((acc, curr) => acc + curr.length, 0)
  const mergedBuffer = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of byteArrays) {
    mergedBuffer.set(arr, offset)
    offset += arr.length
  }
  return mergedBuffer
}

/**
 * Menyusun buffer byte ESC/POS lengkap dari data order
 * @param {Object} order Objek pesanan
 * @param {number} width Lebar kertas thermal (32 atau 48 kolom)
 * @param {'both'|'kitchen'|'customer'} mode Pilihan struk yang dicetak (default 'both': dua struk)
 */
export function buildEscPosBuffer(order, width = 32, mode = 'both') {
  if (mode === 'kitchen') {
    return buildKitchenEscPosBuffer(order, width)
  }

  if (mode === 'customer') {
    return buildCustomerEscPosBuffer(order, width)
  }

  // Default 'both': Cetak Struk Dapur lalu Struk Pelanggan (terpisah potong kertas)
  const kitchenBuffer = buildKitchenEscPosBuffer(order, width)
  const customerBuffer = buildCustomerEscPosBuffer(order, width)

  return mergeByteArrays([kitchenBuffer, customerBuffer])
}

/**
 * Mencari karakteristik GATT yang mendukung operasi Write pada printer Bluetooth
 */
async function findWritableCharacteristic(server) {
  // Cek daftar service yang sudah diketahui
  for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid)
      const characteristics = await service.getCharacteristics()
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          return char
        }
      }
    } catch {
      // Service tidak ada pada perangkat ini, lanjut cek yang berikutnya
    }
  }

  // Jika tidak ditemukan di daftar spesifik, coba jelajahi seluruh primary service yang tersedia
  if (server.getPrimaryServices) {
    try {
      const allServices = await server.getPrimaryServices()
      for (const service of allServices) {
        try {
          const characteristics = await service.getCharacteristics()
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              return char
            }
          }
        } catch {
          // Lanjut
        }
      }
    } catch {
      // Abaikan jika tidak diizinkan
    }
  }

  return null
}

/**
 * Mengirim data buffer ke printer Bluetooth dalam potongan (chunk) kecil
 * agar tidak melebihi batas MTU BLE (Bluetooth Low Energy)
 */
async function sendDataInChunks(characteristic, data, chunkSize = 64) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    if (characteristic.writeValueWithResponse) {
      try {
        await characteristic.writeValueWithResponse(chunk)
      } catch {
        if (characteristic.writeValueWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk)
        } else if (characteristic.writeValue) {
          await characteristic.writeValue(chunk)
        }
      }
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk)
    } else if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk)
    }

    // Jeda singkat antar chunk untuk memberikan waktu buffer thermal printer memproses byte
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}

// Device cache in-memory untuk reconnect otomatis tanpa popup
let cachedPrinterDevice = null

/**
 * Mendapatkan nama printer Bluetooth yang sedang tersimpan/pernah terhubung
 */
export function getSavedPrinterName() {
  if (cachedPrinterDevice && cachedPrinterDevice.name) {
    return cachedPrinterDevice.name
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('sikopi_saved_printer_name') || ''
  }
  return ''
}

/**
 * Menghapus memori printer tersimpan agar kasir dapat memilih printer baru
 */
export function forgetBluetoothPrinter() {
  if (cachedPrinterDevice && cachedPrinterDevice.gatt && cachedPrinterDevice.gatt.connected) {
    try {
      cachedPrinterDevice.gatt.disconnect()
    } catch {
      // Abaikan
    }
  }
  cachedPrinterDevice = null
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sikopi_saved_printer_id')
    localStorage.removeItem('sikopi_saved_printer_name')
  }
}

export const resetCachedBluetoothDevice = forgetBluetoothPrinter

/**
 * Helper koneksi GATT dengan batas waktu timeout
 */
async function connectGattWithTimeout(device, timeoutMs = 4000) {
  if (!device || !device.gatt) {
    throw new Error('Perangkat GATT tidak valid.')
  }
  return Promise.race([
    device.gatt.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi printer timeout (printer mati atau di luar jangkauan)')), timeoutMs)
    )
  ])
}

/**
 * Fungsi Utama: Menghubungkan langsung ke Printer Bluetooth dan mencetak struk pemesanan.
 * Mengingat printer sebelumnya secara otomatis (auto-reconnect tanpa prompt pemilih).
 * Membuka prompt pemilihan HANYA jika belum pernah terhubung atau printer mati/tidak aktif.
 * 
 * @param {Object} order Objek pesanan
 * @param {Object} options Opsi (width: 32|48, mode: 'both'|'kitchen'|'customer', tearDelaySeconds: number, onWaitTear: Function, onProgress: Function)
 * @returns {Promise<{ success: boolean, deviceName: string, message: string }>}
 */
export async function printReceiptViaBluetooth(order, options = {}) {
  const { 
    width = 32, 
    mode = 'both', 
    tearDelaySeconds = 7, 
    onWaitTear = null,
    onProgress = () => {} 
  } = options

  if (!isBluetoothSupported()) {
    throw new Error('Browser Anda tidak mendukung Web Bluetooth API. Gunakan Google Chrome atau Microsoft Edge terbaru pada perangkat dengan Bluetooth aktif.')
  }

  let device = null
  let server = null

  // 1. Coba gunakan printer yang tersimpan di memori (auto-reconnect langsung tanpa dialog pemilih)
  if (cachedPrinterDevice) {
    if (cachedPrinterDevice.gatt && cachedPrinterDevice.gatt.connected) {
      device = cachedPrinterDevice
      server = cachedPrinterDevice.gatt
      onProgress({ status: 'connected', message: `Terhubung langsung ke ${device.name || 'Printer Bluetooth'}...` })
    } else if (cachedPrinterDevice.gatt) {
      onProgress({ status: 'reconnecting', message: `Menyambungkan kembali ke ${cachedPrinterDevice.name || 'Printer Bluetooth'}...` })
      try {
        server = await connectGattWithTimeout(cachedPrinterDevice, 4000)
        device = cachedPrinterDevice
      } catch (reconnectErr) {
        console.warn('Gagal reconnect ke printer memori (printer mungkin mati):', reconnectErr)
        cachedPrinterDevice = null
        device = null
        server = null
      }
    }
  }

  // 2. Jika belum ada di memori, coba periksa daftar izin getDevices() (Web Bluetooth persistent devices)
  if (!device && typeof navigator !== 'undefined' && navigator.bluetooth && typeof navigator.bluetooth.getDevices === 'function') {
    try {
      const pairedDevices = await navigator.bluetooth.getDevices()
      if (pairedDevices && pairedDevices.length > 0) {
        const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('sikopi_saved_printer_id') : null
        const targetDevice = pairedDevices.find(d => d.id === savedId) || pairedDevices[0]

        if (targetDevice && targetDevice.gatt) {
          onProgress({ status: 'reconnecting', message: `Menyambungkan ke ${targetDevice.name || 'Printer Bluetooth'}...` })
          try {
            server = await connectGattWithTimeout(targetDevice, 4000)
            device = targetDevice
            cachedPrinterDevice = targetDevice
          } catch (pairedErr) {
            console.warn('Printer tersimpan tidak dapat dihubungi (mati / di luar jangkauan):', pairedErr)
            device = null
            server = null
          }
        }
      }
    } catch (getDevErr) {
      console.warn('Tidak dapat membaca getDevices():', getDevErr)
    }
  }

  // 3. Jika belum pernah terhubung atau printer mati/tidak merespons, buka dialog pemilihan Bluetooth
  if (!device || !server) {
    onProgress({ status: 'requesting_device', message: 'Mencari printer Bluetooth thermal SIKopi...' })

    try {
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES
      })
    } catch (err) {
      if (err.name === 'NotFoundError') {
        throw new Error('Pemilihan printer Bluetooth dibatalkan.', { cause: err })
      }
      throw new Error(`Gagal memilih printer: ${err.message}`, { cause: err })
    }

    if (!device) {
      throw new Error('Tidak ada perangkat printer Bluetooth yang dipilih.')
    }

    const deviceName = device.name || 'Printer Bluetooth'
    onProgress({ status: 'connecting', message: `Menghubungkan ke ${deviceName}...` })
    server = await device.gatt.connect()
    cachedPrinterDevice = device

    // Simpan identitas printer untuk auto-reconnect berikutnya
    if (typeof localStorage !== 'undefined') {
      if (device.id) localStorage.setItem('sikopi_saved_printer_id', device.id)
      if (device.name) localStorage.setItem('sikopi_saved_printer_name', device.name)
    }
  }

  const deviceName = device.name || 'Printer Bluetooth'

  try {
    onProgress({ status: 'discovering', message: 'Mencari jalur data printer...' })
    const writeCharacteristic = await findWritableCharacteristic(server)

    if (!writeCharacteristic) {
      throw new Error(`Perangkat "${deviceName}" terhubung, namun tidak ditemukan layanan pencetakan ESC/POS yang kompatibel. Pastikan perangkat adalah printer thermal Bluetooth.`)
    }

    if (mode === 'both') {
      // Langkah 1: Cetak Struk 1 (Salinan Dapur / Internal)
      onProgress({ 
        status: 'printing_first', 
        step: 1, 
        totalSteps: 2, 
        message: 'Mencetak Struk 1 (Dapur)...' 
      })
      const kitchenData = buildKitchenEscPosBuffer(order, width)
      await sendDataInChunks(writeCharacteristic, kitchenData, 64)

      // Beri jeda singkat agar buffer motor printer tuntas mengeluarkan kertas
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Langkah 2: Jeda waktu (default 7 detik) agar kasir menyobek kertas struk pertama
      onProgress({ 
        status: 'waiting_tear', 
        step: 1, 
        totalSteps: 2, 
        countdown: tearDelaySeconds,
        message: 'Struk 1 selesai! Silakan sobek struk dapur...' 
      })

      if (typeof onWaitTear === 'function') {
        await onWaitTear({
          delaySeconds: tearDelaySeconds,
          order,
          deviceName
        })
      } else if (tearDelaySeconds > 0) {
        for (let sec = tearDelaySeconds; sec > 0; sec--) {
          onProgress({ 
            status: 'waiting_tear', 
            step: 1, 
            totalSteps: 2, 
            countdown: sec,
            message: `Struk 1 keluar! Silakan sobek struk... Struk 2 dicetak dalam ${sec} dtk` 
          })
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      // Langkah 3: Cetak Struk 2 (Struk Pelanggan) secara otomatis
      onProgress({ 
        status: 'printing_second', 
        step: 2, 
        totalSteps: 2, 
        message: 'Mencetak Struk 2 (Pelanggan)...' 
      })
      const customerData = buildCustomerEscPosBuffer(order, width)
      await sendDataInChunks(writeCharacteristic, customerData, 64)

    } else {
      const printModeLabel = mode === 'kitchen' 
        ? 'Struk Dapur' 
        : 'Struk Pelanggan'

      onProgress({ status: 'printing', message: `Mengirim ${printModeLabel} ke printer...` })
      const singleData = buildEscPosBuffer(order, width, mode)
      await sendDataInChunks(writeCharacteristic, singleData, 64)
    }

    onProgress({ status: 'completed', message: 'Struk berhasil dicetak!' })

    // Beri jeda sejenak sebelum memutuskan GATT channel agar buffer printer bersih
    // Tetap pertahankan cachedPrinterDevice untuk auto-reconnect cetak selanjutnya tanpa prompt
    setTimeout(() => {
      try {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect()
        }
      } catch {
        // Abaikan error saat disconnect
      }
    }, 1500)

    const successMessage = mode === 'both'
      ? `2 Struk (Struk Dapur & Struk Pelanggan) berhasil dicetak ke ${deviceName}.`
      : `Struk berhasil dicetak ke ${deviceName}.`

    return {
      success: true,
      deviceName,
      message: successMessage
    }
  } catch (err) {
    if (device && device.gatt && device.gatt.connected) {
      try {
        device.gatt.disconnect()
      } catch {
        // Abaikan
      }
    }
    throw err
  }
}
