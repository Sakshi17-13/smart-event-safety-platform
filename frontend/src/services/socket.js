import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.roomIntents = new Map()
  }

  connect(token) {
    if (this.socket?.connected) return this.socket
    if (this.socket) this.socket.disconnect()

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id)
      this.replayRoomIntents()
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => this.socket.on(event, callback))
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
      this.roomIntents.clear()
    }
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
