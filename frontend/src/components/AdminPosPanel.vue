<script setup>
import { ref, computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { api } from '@/services/api'
import { formatRupiah, bundleContentsLabel, bundleSavings, parseVariants, variantExtras } from '@/utils/format'
import { generateQrisDataUrl } from '@/utils/qris'
import { isBluetoothSupported, printReceiptViaBluetooth } from '@/utils/bluetoothPrinter'
import AppIcon from '@/components/icons/AppIcon.vue'

const props = defineProps({
  showToast: { type: Function, default: () => {} }
})

const store = useOrderStore()

// Keranjang kasir: state lokal (JANGAN pakai cart pelanggan di orderStore —
// cart itu tersimpan di localStorage 'hayati_cart' dan milik halaman web).
const searchQuery = ref('')
const cartLines = ref([]) // [{ id, name, price, qty, notes }]
const customerName = ref('')
const customerPhone = ref('')
const cashReceived = ref(null)
const payMethod = ref('tunai') // 'tunai' | 'qris'
const isSubmitting = ref(false)

// Order QRIS yang menunggu scan pelanggan & order lunas terakhir (untuk cetak).
const pendingQris = ref(null)
const lastPaid = ref(null)
const qrSize = ref(260)
const isConfirmingPaid = ref(false)
const isPrintingReceipt = ref(false)

const availableMenus = computed(() =>
  (store.menuItems || []).filter(m => m.is_available !== false)
)

const filteredMenus = computed(() => {
  const q = (searchQuery.value || '').trim().toLowerCase()
  if (!q) return availableMenus.value
  return availableMenus.value.filter(m => (m.name || '').toLowerCase().includes(q))
})

const cartTotal = computed(() =>
  cartLines.value.reduce((sum, l) => sum + posLineTotal(l), 0)
)

function posMenuOf(line) {
  return (store.menuItems || []).find(m => m.id === line.id)
}

function posLineExtras(line) {
  const menu = posMenuOf(line)
  return menu ? variantExtras(menu, line.variants) : 0
}

function posLineTotal(line) {
  return (Number(line.price || 0) + posLineExtras(line)) * Number(line.qty || 0)
}

function togglePosVariant(line, name) {
  const idx = line.variants.indexOf(name)
  if (idx === -1) line.variants.push(name)
  else line.variants.splice(idx, 1)
}

const receivedNumber = computed(() => Number(cashReceived.value || 0))
const cashChange = computed(() => Math.max(0, receivedNumber.value - cartTotal.value))
const isCashEnough = computed(() => cartLines.value.length > 0 && receivedNumber.value >= cartTotal.value)
const canSubmitQris = computed(() => cartLines.value.length > 0 && !isSubmitting.value)

const qrisImage = computed(() =>
  pendingQris.value ? generateQrisDataUrl(Number(pendingQris.value.breakdown?.total || 0)) : ''
)

function bundleSaveInfo(menu) {
  return bundleSavings(menu.bundle_items, store.menuItems, menu.price)
}

function addToPosCart(menu) {
  const line = cartLines.value.find(l => l.id === menu.id)
  if (line) {
    line.qty += 1
  } else {
    cartLines.value.push({ id: menu.id, name: menu.name, price: Number(menu.price || 0), qty: 1, notes: '', variants: [] })
  }
}

function changeQty(id, delta) {
  const idx = cartLines.value.findIndex(l => l.id === id)
  if (idx === -1) return
  cartLines.value[idx].qty += delta
  if (cartLines.value[idx].qty <= 0) cartLines.value.splice(idx, 1)
}

function removeLine(id) {
  cartLines.value = cartLines.value.filter(l => l.id !== id)
}

function resetPosForm() {
  cartLines.value = []
  customerName.value = ''
  customerPhone.value = ''
  cashReceived.value = null
}

function posPayload() {
  return {
    customer: { name: (customerName.value || '').trim() || 'Pelanggan', phone: (customerPhone.value || '').trim() || '-' },
    items: cartLines.value.map(l => ({ id: l.id, name: l.name, price: l.price, quantity: l.qty, notes: l.notes || '', variants: l.variants || [] }))
  }
}

async function submitCashOrder() {
  if (cartLines.value.length === 0) {
    props.showToast('Keranjang kasir masih kosong.', 'error')
    return
  }
  if (!isCashEnough.value) {
    props.showToast(`Uang tunai kurang ${formatRupiah(cartTotal.value - receivedNumber.value)}!`, 'error')
    return
  }
  isSubmitting.value = true
  try {
    const res = await api.orders.createPos({ ...posPayload(), paymentMethod: 'cash', cashReceived: receivedNumber.value })
    if (!res.ok) throw new Error(res.error || 'Gagal mencatat pesanan.')
    lastPaid.value = res.data || null
    pendingQris.value = null
    props.showToast(
      `Pesanan ${res.data?.orderId || ''} tercatat & LUNAS. Kembalian: ${formatRupiah(res.data?.payment?.cashChange ?? 0)}`,
      'success'
    )
    resetPosForm()
  } catch (err) {
    props.showToast(err.message || 'Gagal mencatat pesanan.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function submitQrisOrder() {
  if (cartLines.value.length === 0) {
    props.showToast('Keranjang kasir masih kosong.', 'error')
    return
  }
  isSubmitting.value = true
  try {
    const res = await api.orders.createPos({ ...posPayload(), paymentMethod: 'qris', cashReceived: 0 })
    if (!res.ok) throw new Error(res.error || 'Gagal mencatat pesanan.')
    pendingQris.value = res.data || null
    lastPaid.value = null
    qrSize.value = 260
    props.showToast(`Pesanan ${res.data?.orderId || ''} tercatat. Tunjukkan QR ke pelanggan.`, 'success')
    resetPosForm()
  } catch (err) {
    props.showToast(err.message || 'Gagal mencatat pesanan.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function confirmQrisPaid() {
  const ord = pendingQris.value
  if (!ord || isConfirmingPaid.value) return
  isConfirmingPaid.value = true
  try {
    const res = await api.orders.updateStatus(ord.orderId, { is_paid: true, payment_status: 'Lunas' })
    if (!res.ok) throw new Error(res.error || 'Gagal menandai lunas.')
    lastPaid.value = res.data || { ...ord, payment: { ...ord.payment, paid: true, status: 'Lunas' } }
    pendingQris.value = null
    props.showToast(`Pesanan #${ord.orderId} lunas via QRIS.`, 'success')
  } catch (err) {
    props.showToast(err.message || 'Gagal menandai lunas.', 'error')
  } finally {
    isConfirmingPaid.value = false
  }
}

function dismissPendingQris() {
  pendingQris.value = null
  props.showToast('Pesanan tersimpan (belum lunas) — bisa diselesaikan di tab Pesanan Masuk.', 'success')
}

async function printPosReceipt(order) {
  if (!order || isPrintingReceipt.value) return
  if (!isBluetoothSupported()) {
    window.print()
    return
  }
  isPrintingReceipt.value = true
  try {
    const result = await printReceiptViaBluetooth(order, { brandName: store.brandName || 'SIKopi' })
    props.showToast(result.message || 'Struk pesanan berhasil dicetak!', 'success')
  } catch (err) {
    props.showToast(err.message || 'Gagal mencetak struk.', 'error')
  } finally {
    isPrintingReceipt.value = false
  }
}

function startNewOrder() {
  lastPaid.value = null
}
</script>

<template>
  <div class="pos-panel">
    <div class="pos-menu-col">
      <div class="pos-search-row">
        <AppIcon name="search" :size="16" class="pos-search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari menu…"
          class="pos-search-input"
        />
      </div>
      <div v-if="filteredMenus.length === 0" class="pos-empty">
        Tidak ada menu tersedia.
      </div>
      <div v-else class="pos-menu-grid">
        <button
          v-for="m in filteredMenus"
          :key="m.id"
          type="button"
          class="pos-menu-card"
          @click="addToPosCart(m)"
          :title="`Tambah ${m.name}`"
        >
          <img v-if="m.image" :src="api.fileUrl(m.image)" :alt="m.name" class="pos-menu-img" />
          <span class="pos-menu-name">
            {{ m.name }}
            <span v-if="m.is_bundle" class="pos-bundle-tag">PAKET</span>
          </span>
          <span v-if="m.is_bundle" class="pos-bundle-contents">{{ bundleContentsLabel(m.bundle_items, store.menuItems) }}</span>
          <span class="pos-menu-price font-mono">{{ formatRupiah(m.price) }}</span>
          <template v-if="m.is_bundle && bundleSaveInfo(m).savings > 0">
            <span class="pos-price-was font-mono">{{ formatRupiah(bundleSaveInfo(m).sum) }}</span>
            <span class="pos-save-pill">Hemat {{ formatRupiah(bundleSaveInfo(m).savings) }}</span>
          </template>
        </button>
      </div>
    </div>

    <div class="pos-order-col">
      <!-- QRIS menunggu pembayaran -->
      <div v-if="pendingQris" class="pos-qris-panel">
        <h3 class="pos-order-title">
          <AppIcon name="qr-code" :size="18" />
          <span>QRIS — {{ pendingQris.orderId }}</span>
        </h3>
        <p class="pos-qr-total">
          Total: <strong class="font-mono">{{ formatRupiah(pendingQris.breakdown?.total) }}</strong>
        </p>
        <div class="pos-qr-box">
          <img :src="qrisImage" alt="QRIS pembayaran" class="pos-qr-img" :style="{ width: qrSize + 'px', height: qrSize + 'px' }" />
        </div>
        <div class="pos-zoom-row">
          <button type="button" class="pos-zoom-btn" @click="qrSize = Math.max(160, qrSize - 40)" title="Perkecil QR">−</button>
          <span class="pos-zoom-label">Ukuran QR</span>
          <button type="button" class="pos-zoom-btn" @click="qrSize = Math.min(420, qrSize + 40)" title="Perbesar QR">+</button>
        </div>
        <button
          type="button"
          class="pos-submit-btn"
          :disabled="isConfirmingPaid"
          @click="confirmQrisPaid"
        >
          <AppIcon name="check" :size="18" />
          <span>{{ isConfirmingPaid ? 'Menyimpan…' : 'Konfirmasi Sudah Dibayar' }}</span>
        </button>
        <button type="button" class="pos-ghost-btn" @click="dismissPendingQris">
          <span>Nanti saja (tetap tersimpan belum lunas)</span>
        </button>
      </div>

      <!-- Order lunas: cetak struk / order baru -->
      <div v-else-if="lastPaid" class="pos-done-panel">
        <div class="pos-done-icon"><AppIcon name="check" :size="28" /></div>
        <h3 class="pos-order-title pos-done-title">Lunas — {{ lastPaid.orderId }}</h3>
        <p class="pos-done-total">Total: <strong class="font-mono">{{ formatRupiah(lastPaid.breakdown?.total) }}</strong></p>
        <button
          type="button"
          class="pos-submit-btn"
          :disabled="isPrintingReceipt"
          @click="printPosReceipt(lastPaid)"
        >
          <AppIcon name="printer" :size="18" />
          <span>{{ isPrintingReceipt ? 'Mencetak…' : 'Cetak Struk' }}</span>
        </button>
        <button type="button" class="pos-ghost-btn" @click="startNewOrder">
          <span>Buat Pesanan Baru</span>
        </button>
      </div>

      <!-- Form pesanan -->
      <div v-else>
        <h3 class="pos-order-title">
          <AppIcon name="receipt" :size="18" />
          <span>Pesanan Kasir</span>
        </h3>

        <div class="pos-pay-seg" role="tablist" aria-label="Metode bayar POS">
          <button
            type="button"
            role="tab"
            class="pos-pay-btn"
            :class="{ active: payMethod === 'tunai' }"
            @click="payMethod = 'tunai'"
          >
            <AppIcon name="cash" :size="15" />
            <span>Tunai</span>
          </button>
          <button
            type="button"
            role="tab"
            class="pos-pay-btn"
            :class="{ active: payMethod === 'qris' }"
            @click="payMethod = 'qris'"
          >
            <AppIcon name="qr-code" :size="15" />
            <span>QRIS</span>
          </button>
        </div>

        <div v-if="cartLines.length === 0" class="pos-cart-empty">
          Ketuk menu untuk menambah ke pesanan.
        </div>
        <div v-else class="pos-cart-lines">
          <div v-for="l in cartLines" :key="l.id" class="pos-cart-line">
            <div class="pos-line-top">
              <strong class="pos-line-name">{{ l.name }}</strong>
              <button type="button" class="pos-line-remove" @click="removeLine(l.id)" title="Hapus">
                <AppIcon name="trash" :size="14" />
              </button>
            </div>
            <div class="pos-line-bottom">
              <div class="pos-qty-ctrl">
                <button type="button" class="pos-qty-btn" @click="changeQty(l.id, -1)">−</button>
                <span class="pos-qty-num">{{ l.qty }}</span>
                <button type="button" class="pos-qty-btn" @click="changeQty(l.id, 1)">+</button>
              </div>
              <span class="pos-line-subtotal font-mono">{{ formatRupiah(posLineTotal(l)) }}</span>
            </div>
            <div v-if="posMenuOf(l) && parseVariants(posMenuOf(l).variants).length > 0" class="pos-variant-row">
              <button
                v-for="v in parseVariants(posMenuOf(l).variants)"
                :key="v.name"
                type="button"
                class="pos-variant-chip"
                :class="{ active: l.variants.includes(v.name) }"
                @click="togglePosVariant(l, v.name)"
              >
                {{ v.name }}{{ v.price > 0 ? ` +${formatRupiah(v.price)}` : '' }}
              </button>
            </div>
            <input
              v-model="l.notes"
              type="text"
              placeholder="Catatan (mis. tanpa gula)"
              class="pos-line-note"
            />
          </div>
        </div>

        <div class="pos-cust-row">
          <input v-model="customerName" type="text" placeholder="Nama pelanggan (opsional)" class="pos-text-input" />
          <input v-model="customerPhone" type="tel" inputmode="numeric" placeholder="No. WA (opsional, untuk nota)" class="pos-text-input font-mono" />
        </div>

        <div class="pos-total-row">
          <span>Total Tagihan</span>
          <strong class="font-mono">{{ formatRupiah(cartTotal) }}</strong>
        </div>

        <template v-if="payMethod === 'tunai'">
          <label class="pos-cash-label" for="pos-cash-input">Uang Tunai Diterima <span class="required">*</span></label>
          <div class="pos-cash-wrap">
            <span class="pos-cash-prefix">Rp</span>
            <input
              id="pos-cash-input"
              v-model.number="cashReceived"
              type="number"
              min="0"
              step="500"
              placeholder="Nominal uang"
              class="pos-cash-input font-mono"
            />
          </div>
          <div class="pos-change-row" :class="{ enough: isCashEnough, short: !isCashEnough && receivedNumber > 0 }">
            <span>Kembalian: <strong class="font-mono">{{ formatRupiah(cashChange) }}</strong></span>
            <span v-if="!isCashEnough && receivedNumber > 0" class="pos-short-note">
              Kurang {{ formatRupiah(cartTotal - receivedNumber) }}
            </span>
          </div>

          <button
            type="button"
            class="pos-submit-btn"
            :disabled="!isCashEnough || isSubmitting"
            @click="submitCashOrder"
          >
            <AppIcon name="cash" :size="18" />
            <span>{{ isSubmitting ? 'Mencatat…' : 'Buat Pesanan & Lunas' }}</span>
          </button>
          <p class="pos-hint">Pesanan langsung tercatat sebagai Lunas tunai & masuk daftar Pesanan Masuk.</p>
        </template>

        <template v-else>
          <button
            type="button"
            class="pos-submit-btn"
            :disabled="!canSubmitQris"
            @click="submitQrisOrder"
          >
            <AppIcon name="qr-code" :size="18" />
            <span>{{ isSubmitting ? 'Mencatat…' : 'Buat Pesanan & Tampilkan QR' }}</span>
          </button>
          <p class="pos-hint">Pesanan tercatat belum lunas. Tunjukkan QR ke pelanggan, lalu tekan Konfirmasi Sudah Dibayar.</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-panel {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.25rem;
}
.pos-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 0 12px;
  margin-bottom: 1rem;
}
.pos-search-icon { color: var(--color-text-subtle); flex-shrink: 0; }
.pos-search-input {
  flex: 1;
  height: 42px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 0.9rem;
}
.pos-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
}
.pos-menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  max-height: 560px;
  overflow-y: auto;
  padding-right: 2px;
}
.pos-menu-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, transform 0.1s ease;
}
.pos-menu-card:hover { border-color: var(--color-primary); }
.pos-menu-card:active { transform: scale(0.98); }
.pos-menu-img {
  width: 100%;
  height: 84px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background-color: var(--bg-surface);
}
.pos-menu-name { font-size: 0.85rem; font-weight: 600; color: var(--color-text-main); }
.pos-bundle-tag {
  font-size: 0.62rem;
  font-weight: 800;
  color: #FFFFFF;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
  padding: 1px 7px;
  margin-left: 4px;
  vertical-align: middle;
}
.pos-bundle-contents {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}
.pos-menu-price { font-size: 0.8rem; color: var(--color-primary); font-weight: 700; }
.pos-price-was {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
  text-decoration: line-through;
}
.pos-save-pill {
  align-self: flex-start;
  font-size: 0.68rem;
  font-weight: 800;
  color: #FFFFFF;
  background-color: #C05621;
  border-radius: var(--radius-full);
  padding: 1px 8px;
}
.pos-order-col {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  padding: 1.1rem 1.15rem;
  align-self: start;
  position: sticky;
  top: 12px;
}
.pos-order-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  margin: 0 0 0.9rem;
  color: var(--color-text-main);
}
.pos-pay-seg {
  display: flex;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 4px;
  gap: 4px;
  margin-bottom: 0.9rem;
}
.pos-pay-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.pos-pay-btn.active {
  background-color: var(--color-primary);
  color: #FFFFFF;
}
.pos-cart-empty {
  padding: 1.4rem 0.8rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  margin-bottom: 0.9rem;
}
.pos-cart-lines {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 0.9rem;
}
.pos-cart-line {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.65rem;
  background-color: var(--bg-surface);
}
.pos-line-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pos-line-name { font-size: 0.86rem; }
.pos-line-remove {
  border: 0;
  background: transparent;
  color: #B25353;
  cursor: pointer;
  padding: 2px;
}
.pos-line-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}
.pos-qty-ctrl { display: flex; align-items: center; gap: 8px; }
.pos-qty-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-medium);
  background-color: #fff;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.pos-line-subtotal { font-size: 0.85rem; font-weight: 700; }
.pos-variant-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.pos-variant-chip {
  padding: 4px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  background-color: #fff;
  font-size: 0.72rem;
  cursor: pointer;
}
.pos-variant-chip.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary-soft);
  font-weight: 700;
}
.pos-line-note {
  width: 100%;
  margin-top: 6px;
  height: 32px;
  padding: 0 10px;
  font-size: 0.78rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  outline: none;
  background-color: #fff;
}
.pos-cust-row { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.9rem; }
.pos-text-input {
  height: 40px;
  padding: 0 12px;
  font-size: 0.85rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  outline: none;
  background-color: #fff;
}
.pos-text-input:focus { border-color: var(--color-primary); }
.pos-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--border-light);
}
.pos-cash-label { font-size: 0.82rem; font-weight: 600; }
.pos-cash-label .required { color: #B25353; }
.pos-cash-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background-color: #fff;
  padding: 0 12px;
  margin-top: 4px;
}
.pos-cash-prefix { color: var(--color-text-subtle); font-size: 0.85rem; }
.pos-cash-input {
  flex: 1;
  height: 42px;
  border: 0;
  outline: none;
  font-size: 1rem;
  background: transparent;
}
.pos-change-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  margin: 0.5rem 0 0.9rem;
  color: var(--color-text-muted);
}
.pos-change-row.enough { color: var(--color-primary); font-weight: 700; }
.pos-short-note { color: #B25353; font-weight: 600; }
.pos-submit-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 0;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: #fff;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
}
.pos-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pos-hint { font-size: 0.75rem; color: var(--color-text-subtle); margin: 0.6rem 0 0; text-align: center; }
.pos-ghost-btn {
  width: 100%;
  margin-top: 0.6rem;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
}
.pos-qris-panel, .pos-done-panel { text-align: center; }
.pos-qr-total, .pos-done-total { font-size: 0.95rem; margin: 0 0 0.8rem; }
.pos-qr-box {
  display: flex;
  justify-content: center;
  background-color: #fff;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 0.7rem;
}
.pos-qr-img { max-width: 100%; height: auto; }
.pos-zoom-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 0.9rem;
}
.pos-zoom-label { font-size: 0.8rem; color: var(--color-text-muted); }
.pos-zoom-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-medium);
  background-color: #fff;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}
.pos-done-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 0.7rem;
  border-radius: 50%;
  background-color: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pos-done-title { justify-content: center; }

@media (max-width: 900px) {
  .pos-panel { grid-template-columns: 1fr; }
  .pos-order-col { position: static; }
}
</style>
