
import axios from 'axios'

// =====================================
// BACKEND URL CONFIGURATION
// =====================================

export const BACKEND_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

// =====================================
// AXIOS INSTANCE
// =====================================

const api = axios.create({
  baseURL: `${BACKEND_URL}/api/`,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let csrfToken = ''
let csrfRequest = null

// =====================================
// GET COOKIE
// =====================================

function getCookie(name) {
  const cookies = document.cookie
    ? document.cookie.split(';')
    : []

  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim()

    if (trimmedCookie.startsWith(`${name}=`)) {
      return decodeURIComponent(
        trimmedCookie.substring(name.length + 1)
      )
    }
  }

  return null
}

// =====================================
// INITIALIZE CSRF TOKEN
// =====================================

export async function initializeCSRF() {
  if (csrfRequest) {
    return csrfRequest
  }

  csrfRequest = (async () => {
    try {
      const response = await api.get('auth/csrf/')

      if (response.data?.csrfToken) {
        csrfToken = response.data.csrfToken
      } else {
        csrfToken = getCookie('csrftoken') || ''
      }

      return csrfToken
    } catch (error) {
      console.error(
        'CSRF initialization failed:',
        error.response?.data || error.message
      )

      csrfToken = getCookie('csrftoken') || ''

      throw error
    } finally {
      csrfRequest = null
    }
  })()

  return csrfRequest
}

// =====================================
// SET CSRF TOKEN
// =====================================

export function setCSRFToken(token) {
  if (token) {
    csrfToken = token
  }
}

// =====================================
// GET CURRENT CSRF TOKEN
// =====================================

export function getCSRFToken() {
  return csrfToken || getCookie('csrftoken') || ''
}

// =====================================
// RESPONSE INTERCEPTOR
// =====================================

api.interceptors.response.use(
  (response) => {
    if (response.data?.csrfToken) {
      csrfToken = response.data.csrfToken
    }

    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

// =====================================
// REQUEST INTERCEPTOR
// =====================================

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()

  const unsafeMethods = [
    'post',
    'put',
    'patch',
    'delete',
  ]

  config.headers = config.headers || {}

  // MULTIPART / FORMDATA SUPPORT

  if (
    typeof FormData !== 'undefined' &&
    config.data instanceof FormData
  ) {
    delete config.headers['Content-Type']
    delete config.headers['content-type']
  }

  // CSRF SUPPORT

  if (unsafeMethods.includes(method)) {
    if (!csrfToken) {
      csrfToken = getCookie('csrftoken') || ''
    }

    if (
      !csrfToken &&
      !config.url?.includes('auth/csrf/')
    ) {
      await initializeCSRF()
    }

    const token = getCSRFToken()

    if (token) {
      config.headers['X-CSRFToken'] = token
    }
  }

  return config
})

// =====================================
// EXPORT API
// =====================================

export default api
