import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { socketService } from '../services/socket'
import { realtimeSimulation } from '../services/realtimeSimulation'
import { useAuth } from './AuthContext'
import { getStoredAccessToken } from '../api/axios'
import { eventsAPI, familyAPI } from '../api'
import { demoModeEnabled } from '../config/runtime'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const { isAuthenticated, user } = useAuth()

  const syncRealtimeRooms = useCallback(async () => {
    if (!isAuthenticated) return
    const organizer = ['SUPER_ADMIN', 'EVENT_ORGANIZER'].includes(user?.role)

    if (organizer) {
      const eventResponse = await eventsAPI.getAll().catch(() => ({ data: { data: [] } }))
      const events = eventResponse.data.data || []
      events.forEach((event) => {
        socketService.emit('JOIN_EVENT', { eventId: event._id })
        socketService.emit('JOIN_ORGANIZER', { eventId: event._id })
      })
    }

    const familyResponse = await familyAPI.getMyGroups().catch(() => ({ data: { data: [] } }))
    const familyGroups = familyResponse.data.data || []
    if (demoModeEnabled) realtimeSimulation.configureFamilyGroups(familyGroups)

    familyGroups.filter(Boolean).forEach((group) => {
      const familyGroupId = group._id || group.familyGroupId
      if (familyGroupId) socketService.emit('JOIN_FAMILY', { familyGroupId })
      const eventId = group.event?._id || group.event || group.eventDetails?._id
      if (eventId) socketService.emit('JOIN_EVENT', { eventId })
      ;(group.childMembers || []).forEach((member) => {
        const devices = Array.isArray(member.devices)
          ? member.devices
          : member.wearableDeviceId
            ? [{ deviceId: member.wearableDeviceId }]
            : []

        devices.forEach((device) => {
          if (!device.deviceId) return
          const paired = device.connected === true || device.status === 'connected' || (member.connected !== false && ['paired', 'connected'].includes(member.deviceStatus))
          if (!paired) return
          socketService.emit('JOIN_DEVICE_ROOMS', {
            eventId,
            familyGroupId,
            deviceId: device.deviceId,
          })
        })
      })
    })
  }, [isAuthenticated, user?.role])

  useEffect(() => {
    if (isAuthenticated) {
      const token = getStoredAccessToken()
      const socket = socketService.connect(token)
      if (demoModeEnabled) realtimeSimulation.start()
      setIsConnected(socketService.isConnected())

      socket.on('connect', () => {
        setIsConnected(true)
        syncRealtimeRooms()
      })
      socket.on('disconnect', () => setIsConnected(false))
      syncRealtimeRooms()

      return () => {
        socketService.disconnect()
        if (demoModeEnabled) realtimeSimulation.stop()
        setIsConnected(false)
      }
    }
  }, [isAuthenticated, syncRealtimeRooms])

  useEffect(() => {
    if (!isAuthenticated) return undefined

    const handleRegistration = () => syncRealtimeRooms()
    const handleFamilyJoined = () => syncRealtimeRooms()
    const handleGroupCreated = () => syncRealtimeRooms()
    const handleFamilyCreated = () => syncRealtimeRooms()
    const handleMemberAdded = () => syncRealtimeRooms()
    const handleGroupDeleted = () => syncRealtimeRooms()
    const handleDevicePaired = () => syncRealtimeRooms()
    const handleMemberRemoved = () => syncRealtimeRooms()

    if (demoModeEnabled) {
      realtimeSimulation.on('FAMILY_REGISTERED', handleRegistration)
      realtimeSimulation.on('FAMILY_JOINED_EVENT', handleFamilyJoined)
      realtimeSimulation.on('FAMILY_GROUP_CREATED', handleGroupCreated)
      realtimeSimulation.on('FAMILY_CREATED', handleFamilyCreated)
      realtimeSimulation.on('MEMBER_ADDED', handleMemberAdded)
      realtimeSimulation.on('FAMILY_GROUP_DELETED', handleGroupDeleted)
      realtimeSimulation.on('DEVICE_PAIRED', handleDevicePaired)
      realtimeSimulation.on('FAMILY_MEMBER_REMOVED', handleMemberRemoved)
    }

    return () => {
      if (demoModeEnabled) {
        realtimeSimulation.off('FAMILY_REGISTERED', handleRegistration)
        realtimeSimulation.off('FAMILY_JOINED_EVENT', handleFamilyJoined)
        realtimeSimulation.off('FAMILY_GROUP_CREATED', handleGroupCreated)
        realtimeSimulation.off('FAMILY_CREATED', handleFamilyCreated)
        realtimeSimulation.off('MEMBER_ADDED', handleMemberAdded)
        realtimeSimulation.off('FAMILY_GROUP_DELETED', handleGroupDeleted)
        realtimeSimulation.off('DEVICE_PAIRED', handleDevicePaired)
        realtimeSimulation.off('FAMILY_MEMBER_REMOVED', handleMemberRemoved)
      }
    }
  }, [isAuthenticated, syncRealtimeRooms])

  const on = (event, callback) => {
    socketService.on(event, callback)
    if (demoModeEnabled) realtimeSimulation.on(event, callback)
  }

  const off = (event, callback) => {
    socketService.off(event, callback)
    if (demoModeEnabled) realtimeSimulation.off(event, callback)
  }

  const emit = (event, data) => {
    socketService.emit(event, data)
    if (demoModeEnabled) {
      realtimeSimulation.emit(event, data)
      realtimeSimulation.handleRealtimeEvent?.(event, data || {})
    }
  }

  const value = {
    isConnected,
    socket: socketService.getSocket(),
    emit,
    on,
    off,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
