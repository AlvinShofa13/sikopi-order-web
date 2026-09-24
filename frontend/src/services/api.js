/**
 * SIKopi Central API Client
 * Seamlessly interfaces with FastAPI backend with local fallback resilience
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005/api'

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = { ...options.headers }

  // Attach admin session token when present (backend guards admin routes).
  try {
    const token = localStorage.getItem('sikopi_admin_token')
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } catch {
    // non-browser / storage unavailable: proceed unauthenticated
  }

  // Set default Content-Type to JSON only if not sending FormData and not explicitly defined
  if (typeof FormData !== 'undefined' && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  } else if (typeof FormData === 'undefined' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const config = {
    ...options,
    headers
  }

  try {
    const res = await fetch(url, config)
    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`
      try {
        const errorData = await res.json()
        errorMsg = errorData.detail || errorData.message || errorMsg
      } catch {
        // use default error message
      }
      return { ok: false, status: res.status, error: errorMsg }
    }
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err.message || 'Gagal terhubung ke server backend FastAPI' }
  }
}

export const api = {
  baseUrl: API_BASE_URL,
  // Uploads (/uploads/...) live on the backend host, while the frontend
  // may be served elsewhere (e.g. Vercel). Prefix relative paths so
  // images keep resolving in production. Absolute URLs pass through.
  fileUrl(path) {
    if (!path) return ''
    if (/^https?:\/\//i.test(path)) return path
    const origin = API_BASE_URL.replace(/\/api\/?$/, '')
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`
  },
  // Auth
  auth: {
    async login(email, password) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
    },
    async logout() {
      return request('/auth/logout', { method: 'POST' })
    }
  },

  // Menu
  menu: {
    async getAll() {
      return request('/menu')
    },
    async getById(id) {
      return request(`/menu/${id}`)
    },
    async create(menuData) {
      return request('/menu', {
        method: 'POST',
        body: JSON.stringify(menuData)
      })
    },
    async update(id, menuData) {
      return request(`/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify(menuData)
      })
    },
    async toggle(id) {
      return request(`/menu/${id}/toggle`, {
        method: 'PATCH'
      })
    },
    async delete(id) {
      return request(`/menu/${id}`, {
        method: 'DELETE'
      })
    },
    async uploadImage(file) {
      const formData = new FormData()
      formData.append('file', file)
      return request('/menu/upload', {
        method: 'POST',
        body: formData
      })
    }
  },

  // Tokens
  tokens: {
    async getActive() {
      return request('/tokens/active')
    },
    async generate() {
      return request('/tokens/generate', {
        method: 'POST'
      })
    },
    async verify(name, token) {
      return request('/tokens/verify', {
        method: 'POST',
        body: JSON.stringify({ name, token })
      })
    },
    async getBurned() {
      return request('/tokens/burned')
    }
  },

  // Orders
  orders: {
    async getAll() {
      return request('/orders')
    },
    async getStats() {
      return request('/orders/stats')
    },
    exportUrl(format = 'xlsx') {
      return `${API_BASE_URL}/orders/export?format=${format}`
    },
    wsUrl(token = '') {
      const wsBase = API_BASE_URL.replace(/^http/, 'ws')
      return `${wsBase}/orders/ws?token=${encodeURIComponent(token || '')}`
    },
    async getById(orderId) {
      return request(`/orders/${orderId}`)
    },
    async create(orderData) {
      return request('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      })
    },
    async updateStatus(orderId, statusData) {
      return request(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(statusData)
      })
    }
  },

  // Settings & Branding
  settings: {
    async getBranding() {
      return request('/settings/branding')
    },
    async updateBranding(payload) {
      return request('/settings/branding', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    }
  }
}
