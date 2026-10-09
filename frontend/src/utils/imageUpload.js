/**
 * Kompresi bukti pembayaran di browser sebelum diunggah.
 *
 * Batas server 2MB, jadi foto HP 4-8MB dikompres dulu supaya customer tidak
 * perlu memotong atauressurei fotonya sendiri. Pakai <canvas> (bawaan browser,
 * tanpa dependency) dan turunkan kualitas berulang kali bila masih terlalu besar.
 */

const MAX_DIMENSION = 1600
const QUALITY_STEPS = [0.82, 0.65, 0.5]

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('File gambar tidak dapat dibaca.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * @param {File} file
 * @param {number} maxBytes batas akhir (default 2MB)
 * @returns {Promise<File>} File JPEG baru (nama asli dipertahankan + .jpg)
 */
export async function compressImage(file, maxBytes = 2 * 1024 * 1024) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Berkas bukan gambar. Pilih foto bukti pembayaran (JPG/PNG).')
  }
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  let blob = null
  let quality = QUALITY_STEPS[0]
  for (const q of QUALITY_STEPS) {
    quality = q
    blob = await canvasToBlob(canvas, q)
    if (blob && blob.size <= maxBytes) break
  }
  // Masih lebih besar dari batas: perkecil dimensi 25% lalu coba lagi sekali.
  if (!blob || blob.size > maxBytes) {
    canvas.width = Math.round(canvas.width * 0.75)
    canvas.height = Math.round(canvas.height * 0.75)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    blob = await canvasToBlob(canvas, quality)
  }
  if (!blob) throw new Error('Gagal memproses foto bukti pembayaran.')
  if (blob.size > maxBytes) {
    throw new Error(`Ukuran foto masih ${(blob.size / 1024 / 1024).toFixed(1)}MB. Ambil foto dengan resolusi lebih kecil.`)
  }

  const baseName = (file.name || 'bukti').replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}