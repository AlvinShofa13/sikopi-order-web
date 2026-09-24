<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/orderStore'
import AppIcon from '@/components/icons/AppIcon.vue'
import { isBluetoothSupported, printReceiptViaBluetooth } from '@/utils/bluetoothPrinter'
import { generateDynamicQrisPayload, generateQrisDataUrl, getQrisImageUrl } from '@/utils/qris'

const store = useOrderStore()
const router = useRouter()

const isExpanded = ref(false)
const activeTab = ref('orders') // 'orders' | 'tokens'
const searchQuery = ref('')
const selectedOrder = ref(null) // Order for detail modal
const isPrinting = ref(false)
const printMessage = ref('')
const copiedToken = ref(false)

const activeToken = computed(() => store.activeToken)
const orderHistory = computed(() => store.orderHistory)
const usedTokensMap = computed(() => store.usedTokensMap || {})

const filteredOrders = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return orderHistory.value
  return orderHistory.value.filter(ord => {
    return ord.orderId.toLowerCase().includes(query) ||
      (ord.customer?.name || '').toLowerCase().includes(query) ||
      (ord.customer?.token || '').includes(query) ||
      (ord.payment?.label || '').toLowerCase().includes(query)
  })
})

function toggleDrawer() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    store.refreshOrdersFromDB()
  }
}

function handleGenerateNewToken() {
  const newToken = store.generateNewToken()
  showPrintToast(`Token 3 digit baru dibuat: ${newToken}`)
}

function handleCopyToken() {
  if (!activeToken.value) return
  navigator.clipboard.writeText(activeToken.value)
  copiedToken.value = true
  setTimeout(() => {
    copiedToken.value = false
  }, 2000)
}

function openOrderDetail(order) {
  selectedOrder.value = order
}

function closeOrderDetail() {
  selectedOrder.value = null
}

function goToOrderPage(orderId) {
  selectedOrder.value = null
  isExpanded.value = false
  router.push(`/konfirmasi/${orderId}`)
}

async function handleDirectPrint(order) {
  if (!isBluetoothSupported()) {
    showPrintToast('Web Bluetooth tidak didukung browser ini. Mengalihkan ke halaman cetak...', 'error')
    setTimeout(() => {
      goToOrderPage(order.orderId)
    }, 1200)
    return
  }

  isPrinting.value = true
  printMessage.value = 'Mencari printer thermal Bluetooth...'

  try {
    const result = await printReceiptViaBluetooth(order, {
      width: 32,
      mode: 'both',
      tearDelaySeconds: 7,
      onProgress: (p) => {
        printMessage.value = p.message
      }
    })
    showPrintToast(result.message || 'Struk pesanan berhasil dicetak!')
  } catch (err) {
    const isCancelled = err.message?.includes('dibatalkan') || err.name === 'NotFoundError'
    if (isCancelled) {
      showPrintToast('Pencetakan dibatalkan.')
    } else {
      showPrintToast(err.message || 'Gagal cetak Bluetooth. Membuka halaman struk...', 'error')
      setTimeout(() => {
        goToOrderPage(order.orderId)
      }, 1500)
    }
  } finally {
    isPrinting.value = false
    printMessage.value = ''
  }
}

function formatRupiah(value) {
  if (!value) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

function formatDate(isoString) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
}

const toastText = ref('')
const toastType = ref('success')
function showPrintToast(msg, type = 'success') {
  toastText.value = msg
  toastType.value = type
  setTimeout(() => {
    toastText.value = ''
  }, 3500)
}

function getOrderQrisUrl(ord) {
  if (!ord) return ''
  const total = ord.breakdown?.total || 1
  try {
    return generateQrisDataUrl(total)
  } catch {
    const payload = generateDynamicQrisPayload(undefined, total)
    return getQrisImageUrl(payload, 280)
  }
}
</script>

<template>
  <aside class="admin-bottom-wrapper" aria-label="Admin dan Kasir SIKopi">
    <!-- Main Fixed Bar -->
    <div class="admin-fixed-bar">
      <div class="bar-left">
        <div class="admin-pill">
          <span class="live-dot"></span>
          <span class="admin-title">SIKopi KASIR / ADMIN</span>
        </div>

        <!-- Token Display Section (EXCLUSIVE TO ADMIN) -->
        <div class="admin-token-cluster">
          <span class="token-caption"> Aktif:</span>
          <span class="admin-token-number font-mono">{{ activeToken }}</span>
          <button 
            type="button" 
            class="btn-bar-action" 
            @click="handleCopyToken"
            :title="copiedToken ? 'Tersalin' : 'Salin Token'"
          >
            <AppIcon :name="copiedToken ? 'check' : 'copy'" :size="13" />
            <span>{{ copiedToken ? 'Tersalin' : 'Salin' }}</span>
          </button>
          <button 
            type="button" 
            class="btn-bar-action btn-regen" 
            @click="handleGenerateNewToken"
            title="Generate Token 3 Digit Baru"
          >
            <AppIcon name="sparkles" :size="13" />
            <span>Token Baru</span>
          </button>
        </div>
      </div>

      <div class="bar-right">
        <!-- Orders Counter & Toggle Button -->
        <button 
          type="button" 
          class="btn-drawer-toggle" 
          @click="toggleDrawer"
          :class="{ active: isExpanded }"
        >
          <AppIcon name="receipt" :size="16" />
          <span class="drawer-btn-label">Daftar Pesanan & Cetak Struk</span>
          <span class="badge-count">{{ orderHistory.length }}</span>
          <AppIcon :name="isExpanded ? 'close' : 'chevron-down'" :size="14" class="toggle-icon" />
        </button>
      </div>
    </div>

    <!-- Expandable Admin Panel / Drawer -->
    <div v-if="isExpanded" class="admin-drawer">
      <div class="drawer-header-bar">
        <div class="drawer-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'orders' }"
            @click="activeTab = 'orders'"
          >
            <AppIcon name="receipt" :size="15" />
            <span>List Pesanan Masuk ({{ orderHistory.length }})</span>
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'tokens' }"
            @click="activeTab = 'tokens'"
          >
            <AppIcon name="shield-check" :size="15" />
            <span>Log Token Hangus ({{ Object.keys(usedTokensMap).length }})</span>
          </button>
        </div>

        <button 
          type="button" 
          class="btn-close-drawer" 
          @click="isExpanded = false"
          title="Tutup Panel Admin"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Tab 1: Orders List -->
      <div v-if="activeTab === 'orders'" class="drawer-body">
        <div class="search-filter-row">
          <div class="search-input-wrap">
            <AppIcon name="search" :size="15" class="search-icon" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari ID pesanan, nama pelanggan, token, atau metode..."
              class="admin-search-input"
            />
          </div>
          <span class="order-counter-text">Menampilkan {{ filteredOrders.length }} dari {{ orderHistory.length }} pesanan</span>
        </div>

        <div v-if="filteredOrders.length === 0" class="empty-orders-view">
          <AppIcon name="bag" :size="28" class="empty-icon" />
          <p>Belum ada pesanan yang sesuai.</p>
        </div>

        <div v-else class="orders-table-wrapper">
          <table class="admin-orders-table">
            <thead>
              <tr>
                <th>No. Pesanan</th>
                <th>Waktu</th>
                <th>Nama Pelanggan</th>
                <th>Token</th>
                <th>Menu & Porsi</th>
                <th>Total Nominal</th>
                <th>Metode Bayar</th>
                <th>Aksi Kasir</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ord in filteredOrders" :key="ord.orderId">
                <td class="cell-id font-mono">
                  <strong>{{ ord.orderId }}</strong>
                </td>
                <td class="cell-time">{{ formatDate(ord.createdAt) }}</td>
                <td class="cell-name">
                  <strong>{{ ord.customer?.name || '-' }}</strong>
                </td>
                <td class="cell-token">
                  <span class="badge-token font-mono">#{{ ord.customer?.token || '-' }}</span>
                </td>
                <td class="cell-items">
                  <span class="items-summary" :title="ord.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')">
                    {{ ord.items?.length || 0 }} Menu ({{ ord.items?.reduce((s, i) => s + i.quantity, 0) }} Porsi)
                  </span>
                </td>
                <td class="cell-total font-mono">{{ formatRupiah(ord.breakdown?.total) }}</td>
                <td class="cell-payment">
                  <span class="payment-badge" :class="ord.payment?.method">
                    {{ ord.payment?.label || ord.payment?.method }}
                  </span>
                </td>
                <td class="cell-actions">
                  <div class="action-buttons-group">
                    <button 
                      type="button" 
                      class="btn-act btn-detail" 
                      @click="openOrderDetail(ord)"
                      title="Lihat Detail Pesanan & QRIS"
                    >
                      <AppIcon name="qr-code" :size="13" />
                      <span>Detail & QRIS</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn-act btn-print" 
                      @click="handleDirectPrint(ord)"
                      :disabled="isPrinting"
                      title="Cetak 2 Struk (Pelanggan & Dapur) via Bluetooth"
                    >
                      <AppIcon name="printer" :size="13" />
                      <span>Cetak Struk</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn-act btn-view-full" 
                      @click="goToOrderPage(ord.orderId)"
                      title="Buka Halaman Struk Lengkap"
                    >
                      <AppIcon name="arrow-right" :size="13" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Burned Tokens Log -->
      <div v-if="activeTab === 'tokens'" class="drawer-body">
        <div class="token-tab-info">
          <p>
            Daftar token 3 digit yang telah digunakan untuk memesan dan otomatis hangus.
            Jika pelanggan memasukkan kembali token ini, sistem akan langsung menampilkan halaman pesanan mereka.
          </p>
        </div>

        <div v-if="Object.keys(usedTokensMap).length === 0" class="empty-orders-view">
          <p>Belum ada token yang hangus.</p>
        </div>

        <div v-else class="tokens-log-grid">
          <div v-for="(info, tkn) in usedTokensMap" :key="tkn" class="token-log-card">
            <div class="token-log-top">
              <span class="burned-token-badge font-mono">#{{ tkn }}</span>
              <span class="burned-tag">Hangus</span>
            </div>
            <div class="token-log-details">
              <div>Pelanggan: <strong>{{ info.customerName || 'Pelanggan' }}</strong></div>
              <div>Pesanan: <span class="font-mono text-primary">{{ info.orderId || '-' }}</span></div>
              <div class="token-log-time">{{ formatDate(info.burnedAt) }}</div>
            </div>
            <button 
              v-if="info.orderId" 
              type="button" 
              class="btn-jump-order" 
              @click="goToOrderPage(info.orderId)"
            >
              <span>Lihat Pesanan Ini</span>
              <AppIcon name="arrow-right" :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail & QRIS Modal (Admin) -->
    <div v-if="selectedOrder" class="admin-modal-overlay" @click.self="closeOrderDetail">
      <div class="admin-modal-card">
        <div class="modal-card-header">
          <div class="header-titles">
            <span class="modal-badge font-mono">{{ selectedOrder.orderId }}</span>
            <h3 class="modal-title">Rincian Pesanan & Pembayaran Kasir</h3>
          </div>
          <button type="button" class="btn-modal-close" @click="closeOrderDetail">
            <AppIcon name="close" :size="18" />
          </button>
        </div>

        <div class="modal-card-body">
          <div class="cust-info-card">
            <div>Pelanggan: <strong>{{ selectedOrder.customer?.name }}</strong></div>
            <div>Token Digunakan: <strong class="font-mono">#{{ selectedOrder.customer?.token || '-' }}</strong></div>
            <div>Waktu: <span>{{ formatDate(selectedOrder.createdAt) }}</span></div>
            <div>Tipe: <span>{{ selectedOrder.customer?.orderType || 'Makan di Tempat' }} ({{ selectedOrder.customer?.tableOrAddress }})</span></div>
          </div>

          <!-- QRIS Kasir (Jika metode QRIS) -->
          <div v-if="selectedOrder.payment?.method === 'qris'" class="admin-qris-box">
            <h4 class="qris-box-title">
              <AppIcon name="qr-code" :size="16" />
              <span>QRIS Kasir — Tunjukkan ke Pelanggan</span>
            </h4>
            <div class="qris-center">
              <img :src="getOrderQrisUrl(selectedOrder)" alt="QRIS Kasir SIKopi" class="qris-img" />
              <div class="qris-merchant-info">
                <strong>AZRIEL SABIQ GAMING GEAR</strong>
                <span>NMID: ID1026528966314</span>
                <span class="qris-amount font-mono">{{ formatRupiah(selectedOrder.breakdown?.total) }}</span>
              </div>
            </div>
          </div>

          <!-- Items List -->
          <div class="admin-items-list">
            <h4 class="section-title">Item Pesanan:</h4>
            <div v-for="it in selectedOrder.items" :key="it.id" class="item-row">
              <div class="item-name-col">
                <strong>{{ it.name }}</strong>
                <span v-if="it.notes" class="item-note">Catatan: {{ it.notes }}</span>
              </div>
              <div class="item-qty-col">x{{ it.quantity }}</div>
              <div class="item-price-col font-mono">{{ formatRupiah(it.price * it.quantity) }}</div>
            </div>
            <div class="total-row font-mono">
              <span>Total Akhir:</span>
              <span class="grand-total-val">{{ formatRupiah(selectedOrder.breakdown?.total) }}</span>
            </div>
          </div>
        </div>

        <div class="modal-card-footer">
          <button 
            type="button" 
            class="btn-modal-print" 
            @click="handleDirectPrint(selectedOrder)"
            :disabled="isPrinting"
          >
            <AppIcon name="printer" :size="16" />
            <span>{{ isPrinting ? 'Mencetak...' : 'Cetak 2 Struk Bluetooth' }}</span>
          </button>
          <button 
            type="button" 
            class="btn-modal-full" 
            @click="goToOrderPage(selectedOrder.orderId)"
          >
            <span>Buka Halaman Struk & Pembayaran</span>
            <AppIcon name="arrow-right" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div v-if="toastText" class="admin-toast" :class="toastType">
      <AppIcon :name="toastType === 'success' ? 'check' : 'alert-circle'" :size="16" />
      <span>{{ toastText }}</span>
    </div>
  </aside>
</template>

<style scoped>
.admin-bottom-wrapper {
  position: relative;
  z-index: 9999;
}

/* Fixed Bottom Bar */
.admin-fixed-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #0f172a;
  border-top: 2px solid #334155;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
  font-family: inherit;
  flex-wrap: wrap;
  gap: 12px;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.admin-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background-color: #1e293b;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid #334155;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
  100% { opacity: 1; transform: scale(1); }
}

.admin-title {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.admin-token-cluster {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.4);
  padding: 4px 10px;
  border-radius: 8px;
}

.token-caption {
  font-size: 0.78rem;
  color: #cbd5e1;
  font-weight: 500;
}

.admin-token-number {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #34d399;
  background: #064e3b;
  padding: 2px 8px;
  border-radius: 4px;
}

.btn-bar-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #1e293b;
  border: 1px solid #475569;
  color: #f1f5f9;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-bar-action:hover {
  background: #334155;
  color: #fff;
}

.btn-regen {
  background: #0284c7;
  border-color: #0284c7;
  color: #fff;
}

.btn-regen:hover {
  background: #0369a1;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-drawer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #2563eb;
  border: none;
  color: #fff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-drawer-toggle:hover {
  background: #1d4ed8;
}

.btn-drawer-toggle.active {
  background: #0f172a;
  border: 1px solid #475569;
}

.badge-count {
  background: #f59e0b;
  color: #0f172a;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 9999px;
}

/* Drawer / Panel */
.admin-drawer {
  position: fixed;
  bottom: 52px;
  left: 0;
  right: 0;
  background: #0b1120;
  border-top: 1px solid #1e293b;
  color: #f1f5f9;
  max-height: 440px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}

.drawer-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: #fff;
  background: #1e293b;
}

.tab-btn.active {
  color: #38bdf8;
  background: #1e293b;
  border-color: #334155;
}

.btn-close-drawer {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
}

.btn-close-drawer:hover {
  background: #1e293b;
  color: #fff;
}

.drawer-body {
  padding: 14px 18px;
  overflow-y: auto;
  flex: 1;
}

.search-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}

.admin-search-input {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 7px 10px 7px 32px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.admin-search-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.order-counter-text {
  font-size: 0.78rem;
  color: #64748b;
}

/* Table */
.orders-table-wrapper {
  overflow-x: auto;
}

.admin-orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.admin-orders-table th {
  text-align: left;
  background: #1e293b;
  color: #94a3b8;
  padding: 8px 10px;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
}

.admin-orders-table td {
  padding: 10px;
  border-bottom: 1px solid #1e293b;
  vertical-align: middle;
}

.admin-orders-table tr:hover {
  background: rgba(30, 41, 59, 0.4);
}

.cell-id strong {
  color: #38bdf8;
}

.badge-token {
  background: #1e293b;
  color: #10b981;
  border: 1px solid #334155;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.payment-badge {
  display: inline-block;
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 4px;
  background: #334155;
  color: #e2e8f0;
  font-weight: 600;
}

.payment-badge.qris {
  background: #831843;
  color: #fbcfe8;
}

.action-buttons-group {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-detail {
  background: #0284c7;
  color: #fff;
}
.btn-detail:hover { background: #0369a1; }

.btn-print {
  background: #10b981;
  color: #fff;
}
.btn-print:hover { background: #059669; }

.btn-view-full {
  background: #334155;
  color: #cbd5e1;
}
.btn-view-full:hover { background: #475569; color: #fff; }

.empty-orders-view {
  text-align: center;
  padding: 30px;
  color: #64748b;
}

/* Tokens Log */
.token-tab-info {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 12px;
}

.tokens-log-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.token-log-card {
  background: #1e293b;
  border: 1px solid #334155;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
}

.token-log-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.burned-token-badge {
  font-size: 1rem;
  font-weight: 800;
  color: #f43f5e;
}

.burned-tag {
  background: #881337;
  color: #fecdd3;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
}

.btn-jump-order {
  margin-top: 8px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #334155;
  color: #38bdf8;
  border: none;
  padding: 5px;
  border-radius: 4px;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-jump-order:hover {
  background: #475569;
}

/* Detail Modal */
.admin-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.admin-modal-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}

.modal-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #334155;
  background: #1e293b;
}

.modal-badge {
  display: inline-block;
  font-size: 0.75rem;
  color: #38bdf8;
  font-weight: 700;
}

.modal-title {
  margin: 2px 0 0;
  font-size: 1rem;
  color: #fff;
}

.btn-modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
}

.modal-card-body {
  padding: 16px;
  overflow-y: auto;
  font-size: 0.82rem;
  color: #cbd5e1;
}

.cust-info-card {
  background: #1e293b;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 14px;
  line-height: 1.6;
}

.admin-qris-box {
  background: #1e1b4b;
  border: 1px solid #4338ca;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 14px;
  text-align: center;
}

.qris-box-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #a5b4fc;
  margin-bottom: 10px;
}

.qris-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qris-img {
  width: 170px;
  height: 170px;
  border-radius: 8px;
  background: #fff;
  padding: 4px;
}

.qris-amount {
  display: block;
  font-size: 1.1rem;
  font-weight: 800;
  color: #34d399;
  margin-top: 4px;
}

.admin-items-list {
  background: #1e293b;
  padding: 12px;
  border-radius: 6px;
}

.section-title {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #334155;
}

.item-name-col {
  flex: 1;
}

.item-note {
  display: block;
  font-size: 0.72rem;
  color: #f59e0b;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding-top: 10px;
  font-size: 0.95rem;
  font-weight: 700;
}

.grand-total-val {
  color: #10b981;
}

.modal-card-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: #1e293b;
  border-top: 1px solid #334155;
}

.btn-modal-print {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #10b981;
  border: none;
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-modal-print:hover { background: #059669; }

.btn-modal-full {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #334155;
  border: 1px solid #475569;
  color: #f1f5f9;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
}
.btn-modal-full:hover { background: #475569; }

/* Toast */
.admin-toast {
  position: fixed;
  bottom: 60px;
  right: 20px;
  padding: 10px 16px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  animation: fadeIn 0.2s;
  z-index: 10001;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin-toast.success {
  background: #065f46;
  color: #ecfdf5;
  border: 1px solid #10b981;
}

.admin-toast.error {
  background: #881337;
  color: #fff1f2;
  border: 1px solid #f43f5e;
}
</style>

d: #881337;
  color: #fff1f2;
  border: 1px solid #f43f5e;
}
</style>

nimation: fadeIn 0.2s;
  z-index: 10001;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin-toast.success {
  background: #065f46;
  color: #ecfdf5;
  border: 1px solid #10b981;
}

.admin-toast.error {
  background: #881337;
  color: #fff1f2;
  border: 1px solid #f43f5e;
}
</style>

