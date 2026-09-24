/**
 * SIKopi Native IndexedDB Database Service
 * Provides permanent, transactional browser-level database storage
 * with synchronous localStorage mirroring for resilient performance and testing.
 */

const DB_NAME = 'SIKopi_Database'
const DB_VERSION = 1

function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}


function openDatabase() {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Object Store: Orders
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'orderId' })
          orderStore.createIndex('token', 'customer.token', { unique: false })
          orderStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Object Store: Used Tokens (One-time use burned tokens mapped to orders)
        if (!db.objectStoreNames.contains('used_tokens')) {
          db.createObjectStore('used_tokens', { keyPath: 'token' })
        }

        // Object Store: Settings & Active Tokens
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export const dbService = {
  /**
   * Save a newly placed order to IndexedDB & sync to localStorage
   */
  async saveOrder(order) {
    if (!order || !order.orderId) return null

    // Mirror to localStorage for immediate resilience
    if (typeof localStorage !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem('sikopi_orders') || '[]')
        const filtered = existing.filter(o => o.orderId !== order.orderId)
        filtered.unshift(order)
        localStorage.setItem('sikopi_orders', JSON.stringify(filtered))
      } catch {
        // storage quota or parsing error ignored
      }
    }

    const db = await openDatabase()
    if (!db) return order

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['orders', 'used_tokens'], 'readwrite')
        tx.objectStore('orders').put(order)

        const custToken = order.customer?.token
        if (custToken) {
          tx.objectStore('used_tokens').put({
            token: String(custToken).trim(),
            orderId: order.orderId,
            customerName: order.customer.name,
            burnedAt: new Date().toISOString()
          })
        }

        tx.oncomplete = () => resolve(order)
        tx.onerror = () => resolve(order)
      } catch {
        resolve(order)
      }
    })
  },

  /**
   * Get all orders from IndexedDB or localStorage fallback
   */
  async getAllOrders() {
    const db = await openDatabase()
    if (!db) {
      if (typeof localStorage !== 'undefined') {
        try {
          return JSON.parse(localStorage.getItem('sikopi_orders') || '[]')
        } catch {
          return []
        }
      }
      return []
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('orders', 'readonly')
        const request = tx.objectStore('orders').getAll()
        request.onsuccess = () => {
          const results = request.result || []
          // Sort newest first
          results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          resolve(results)
        }
        request.onerror = () => {
          if (typeof localStorage !== 'undefined') {
            resolve(JSON.parse(localStorage.getItem('sikopi_orders') || '[]'))
          } else {
            resolve([])
          }
        }
      } catch {
        resolve([])
      }
    })
  },

  /**
   * Get order by orderId
   */
  async getOrderByOrderId(orderId) {
    if (!orderId) return null
    const db = await openDatabase()
    if (!db) {
      if (typeof localStorage !== 'undefined') {
        const orders = JSON.parse(localStorage.getItem('sikopi_orders') || '[]')
        return orders.find(o => o.orderId === orderId) || null
      }
      return null
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('orders', 'readonly')
        const request = tx.objectStore('orders').get(orderId)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  },

  /**
   * Mark token as burned and link to orderId
   */
  async markTokenAsUsed(token, orderId, customerName) {
    if (!token) return
    const cleanToken = String(token).trim()

    // Mirror to localStorage mapping
    if (typeof localStorage !== 'undefined') {
      try {
        const map = JSON.parse(localStorage.getItem('sikopi_used_tokens_map') || '{}')
        map[cleanToken] = {
          orderId: orderId || null,
          customerName: customerName || 'Pelanggan',
          burnedAt: new Date().toISOString()
        }
        localStorage.setItem('sikopi_used_tokens_map', JSON.stringify(map))

        // Also update array format for backward compatibility
        const list = JSON.parse(localStorage.getItem('sikopi_used_tokens') || '[]')
        if (!list.includes(cleanToken)) {
          list.push(cleanToken)
          localStorage.setItem('sikopi_used_tokens', JSON.stringify(list))
        }
      } catch {
        // Ignore localStorage error
      }
    }

    const db = await openDatabase()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('used_tokens', 'readwrite')
        tx.objectStore('used_tokens').put({
          token: cleanToken,
          orderId: orderId || null,
          customerName: customerName || 'Pelanggan',
          burnedAt: new Date().toISOString()
        })
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  },

  /**
   * Check if token is burned and retrieve associated order details
   */
  async getUsedTokenInfo(token) {
    if (!token) return null
    const cleanToken = String(token).trim()

    // Check localStorage first
    if (typeof localStorage !== 'undefined') {
      try {
        const map = JSON.parse(localStorage.getItem('sikopi_used_tokens_map') || '{}')
        if (map[cleanToken]) {
          return map[cleanToken]
        }
      } catch {
        // continue to IndexedDB
      }
    }

    const db = await openDatabase()
    if (!db) return null

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('used_tokens', 'readonly')
        const request = tx.objectStore('used_tokens').get(cleanToken)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
}

