import { io } from 'socket.io-client'
import { clearAuthTokens, getStoredAccessToken, onAuthTokensChanged, refreshStoredAuthToken } from '../api/axios'

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || window.location.origin).trim().replace(/\/+$/, '')

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.roomIntents = new Map()
    this.unsubscribeAuthTokens = null
    this.refreshingSocketToken = false
  }

  connect(token = getStoredAccessToken()) {
    if (this.socket?.connected) return this.socket
    if (this.socket) this.socket.disconnect()

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 8,
      reconnectionDelayMax: 10000,
    })

    this.unsubscribeAuthTokens?.()
    this.unsubscribeAuthTokens = onAuthTokensChanged(({ accessToken }) => {
      if (!this.socket) return
      this.socket.auth = { ...this.socket.auth, token: accessToken }
    })

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id)
      this.refreshingSocketToken = false
      this.replayRoomIntents()
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    this.socket.on('connect_error', async (error) => {
      const code = error?.data?.code
      if (code !== 'TOKEN_EXPIRED' && code !== 'AUTH_FAILED') return

      this.socket.io.opts.reconnection = false
      if (this.refreshingSocketToken) return
      this.refreshingSocketToken = true

      try {
        const accessToken = await refreshStoredAuthToken()
        if (!accessToken || !this.socket) {
          this.expireSession()
          return
        }

        this.socket.auth = { ...this.socket.auth, token: accessToken }
        this.socket.io.opts.reconnection = true
        this.socket.connect()
      } catch {
        this.expireSession()
      } finally {
        this.refreshingSocketToken = false
      }
    })

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => this.socket.on(event, callback))
    })

    return this.socket
  }

  expireSession() {
    clearAuthTokens()
    this.disconnect()
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
      this.roomIntents.clear()
    }
    this.unsubscribeAuthTokens?.()
    this.unsubscribeAuthTokens = null
    this.refreshingSocketToken = false
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(callback)
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event, callback) {
    if (callback) this.listeners.get(event)?.delete(callback)
    else this.listeners.delete(event)
    if (this.socket) {
      if (callback) this.socket.off(event, callback)
      else this.socket.off(event)
    }
  }

  emit(event, data) {
    this.rememberRoomIntent(event, data)
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  rememberRoomIntent(event, data = {}) {
    const key = this.roomIntentKey(event, data)
    if (key) this.roomIntents.set(key, { event, data })
  }

  roomIntentKey(event, data = {}) {
    if (event === 'JOIN_EVENT' && data.eventId) return `JOIN_EVENT:${data.eventId}`
    if (event === 'JOIN_ORGANIZER' && data.eventId) return `JOIN_ORGANIZER:${data.eventId}`
    if (event === 'JOIN_FAMILY' && data.familyGroupId) return `JOIN_FAMILY:${data.familyGroupId}`
    if (event === 'JOIN_DEVICE_ROOMS') {
      return `JOIN_DEVICE_ROOMS:${data.eventId || 'none'}:${data.familyGroupId || 'none'}:${data.deviceId || 'none'}`
    }
    return null
  }

  replayRoomIntents() {
    if (!this.socket?.connected) return
    this.roomIntents.forEach(({ event, data }) => {
      this.socket.emit(event, data)
    })
  }

  getSocket() {
    return this.socket
  }

  isConnected() {
    return this.socket?.connected || false
  }
}

export const socketService = new SocketService()
