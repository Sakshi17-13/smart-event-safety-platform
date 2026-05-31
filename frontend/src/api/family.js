import api from './axios'
import { demoStore } from '../services/demoStore'
import { demoModeEnabled } from '../config/runtime'
import { normalizeEvent } from './events'

const shouldUseLocalFallback = (error) =>
  demoModeEnabled && (!error.response || [404, 503].includes(error.response.status))

const withLocalFallback = async (request, fallback) => {
  try {
    return await request()
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error
    return fallback()
  }
}

let createGroupRequest = null

export const familyAPI = {
  getNearbyEvents: (params) =>
    api.get('/family/events/nearby', { params }).then((response) => ({
      ...response,
      data: {
        ...response.data,
        data: (response.data.data || []).map(normalizeEvent),
      },
    })),
  registerEvent: (eventId) =>
    api.post(`/family/events/${eventId}/register`),
  createGroup: (data) => {
    if (!createGroupRequest) {
      createGroupRequest = withLocalFallback(
        () => api.post('/family/groups', data),
        () => demoStore.apiResponse(demoStore.createFamilyGroup(data), 'Family group created in local development state')
      ).finally(() => {
        createGroupRequest = null
      })
    }
    return createGroupRequest
  },
  updateGroup: (groupId, data) =>
    withLocalFallback(
      () => api.patch(`/family/groups/${groupId}`, data),
      () => demoStore.apiResponse(demoStore.updateFamilyGroup(groupId, data), 'Family group updated locally')
    ),
  deleteGroup: (groupId) => api.delete(`/family/groups/${groupId}`),
  getMyGroups: () => api.get('/family/groups/mine'),
  addChild: (groupId, data) =>
    withLocalFallback(
      () => api.post(`/family/groups/${groupId}/children`, data),
      () => {
        demoStore.addMember(groupId, data)
        return demoStore.apiResponse(demoStore.getState().familyGroups.find((group) => group._id === groupId), 'Child member added locally')
      }
    ),
  updateChild: (groupId, childMemberId, data) =>
    withLocalFallback(
      () => api.patch(`/family/groups/${groupId}/children/${childMemberId}`, data),
      () => {
        demoStore.updateMember(groupId, childMemberId, data)
        return demoStore.apiResponse(demoStore.getState().familyGroups.find((group) => group._id === groupId), 'Child member updated locally')
      }
    ),
  removeChild: (groupId, childMemberId) =>
    api.delete(`/family/groups/${groupId}/children/${childMemberId}`),
  addGuardian: (groupId, data) =>
    withLocalFallback(
      () => api.post(`/family/groups/${groupId}/guardians`, data),
      () => demoStore.apiResponse(demoStore.addGuardian(groupId, data), 'Guardian added locally')
    ),
  updateGuardian: (groupId, guardianId, data) =>
    withLocalFallback(
      () => api.patch(`/family/groups/${groupId}/guardians/${guardianId}`, data),
      () => {
        demoStore.updateGuardian(groupId, guardianId, data)
        return demoStore.apiResponse({ groupId, guardianId }, 'Guardian updated locally')
      }
    ),
  removeGuardian: (groupId, guardianId) =>
    api.delete(`/family/groups/${groupId}/guardians/${guardianId}`),
  generatePairingCode: (groupId, childMemberId) =>
    withLocalFallback(
      () => api.post(`/family/groups/${groupId}/children/${childMemberId}/pairing-code`),
      () => demoStore.apiResponse(demoStore.generatePairCode(groupId, childMemberId), 'Pairing code generated locally')
    ),
  confirmPairing: (data) =>
    withLocalFallback(
      () => api.post('/family/devices/confirm-pairing', data),
      () => {
        const result = demoStore.confirmPairCode(data)
        if (!result) {
          const error = new Error('Pairing code not found, expired, or already used')
          error.response = { data: { message: error.message } }
          throw error
        }
        return demoStore.apiResponse(result, 'Device paired locally')
      }
    ),
  updateDeviceLocation: (deviceId, data) =>
    withLocalFallback(
      () => api.post(`/family/devices/${deviceId}/location`, data),
      () => demoStore.apiResponse(demoStore.updateDeviceLocation(deviceId, data), 'Device location updated locally')
    ),
  disconnectDevice: (deviceId) =>
    withLocalFallback(
      () => api.post(`/family/devices/${deviceId}/disconnect`),
      () => demoStore.apiResponse(demoStore.disconnectDevice(deviceId), 'Device disconnected locally')
    ),
  getDevices: (groupId) =>
    withLocalFallback(
      () => api.get(`/family/groups/${groupId}/devices`),
      () => demoStore.apiResponse(demoStore.getDevices(groupId), 'Devices retrieved locally')
    ),
  getOrganizerFamilySummary: (eventId, emergency = false) =>
    eventId
      ? api.get(`/family/organizer/events/${eventId}/family-summary`, { params: { emergency } })
      : Promise.resolve({ data: { success: true, message: 'No active event selected', data: [] } }),
}
