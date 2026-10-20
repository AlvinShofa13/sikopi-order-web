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
