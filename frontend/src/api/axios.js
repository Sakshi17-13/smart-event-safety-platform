import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const readStorage = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

const removeStorage = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

const normalizeTokens = (tokens = {}) => ({
  accessToken: tokens.accessToken || tokens.token || tokens.jwt || null,
  refreshToken: tokens.refreshToken || tokens.refresh || null,
})

const getAccessToken = () => readStorage(ACCESS_TOKEN_KEY)
const getRefreshToken = () => readStorage(REFRESH_TOKEN_KEY)

const applyAuthorizationHeader = (token = getAccessToken()) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

export const setAuthTokens = (tokens = {}) => {
  const normalized = normalizeTokens(tokens)
  if (normalized.accessToken) writeStorage(ACCESS_TOKEN_KEY, normalized.accessToken)
  if (normalized.refreshToken) writeStorage(REFRESH_TOKEN_KEY, normalized.refreshToken)
  applyAuthorizationHeader(normalized.accessToken || getAccessToken())
  return normalized
}

export const clearAuthTokens = () => {
  removeStorage(ACCESS_TOKEN_KEY)
  removeStorage(REFRESH_TOKEN_KEY)
  applyAuthorizationHeader(null)
}

export const getStoredAccessToken = getAccessToken
export const getStoredRefreshToken = getRefreshToken
export const syncAuthorizationHeader = applyAuthorizationHeader

applyAuthorizationHeader()

let refreshRequest = null

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((response) => {
        const tokens = response.data?.data?.tokens || response.data?.data
        const normalized = setAuthTokens(tokens)
        return normalized.accessToken || null
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
      api.defaults.headers.common.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/signup') || originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true

      try {
        const accessToken = await refreshAccessToken()
        if (accessToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch {
        // Fall through to session cleanup below.
      }
    }

    if (error.response?.status === 401 && !isAuthRequest) {
      clearAuthTokens()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
