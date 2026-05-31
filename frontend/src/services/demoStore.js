const STORAGE_KEY = 'smartEventSafetyDemoState'
const STORE_EVENT = 'smart-event-demo-store-updated'
const ALERT_DEDUPE_MS = 30 * 1000

const randomId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const randomCode = (prefix, length = 6) => `${prefix}${Math.random().toString(36).slice(2, 2 + length).toUpperCase()}`
const nowIso = () => new Date().toISOString()
const normalizeCode = (value) => String(value || '').trim().toUpperCase()
const alertDedupeKey = (alert) => [
  String(alert.type || alert.title || 'Safety Alert').toLowerCase(),
  alert.familyGroupId || alert.groupId || 'event-wide',
  alert.deviceId || alert.childMemberId || alert.location || alert.zone || 'event-grounds',
  String(alert.severity || 'medium').toLowerCase(),
].join(':')

const baseState = {
  events: [],
  familyGroups: [],
  alerts: [],
  registrations: [],
}

const DEFAULT_GEOFENCE = {
  guardianLocation: { latitude: 19.076, longitude: 72.8777 },
  safeRadiusMeters: 170,
  warningRadiusMeters: 130,
}

const response = (data, message = 'OK') => Promise.resolve({ data: { success: true, message, data } })
const eventFamilyCount = (state, eventId) =>
  state.familyGroups.filter((group) => group.event === eventId).length ||
  state.registrations.filter((registration) => registration.eventId === eventId).length

const emitRealtime = (event, payload) => {
  window.dispatchEvent(new CustomEvent(`smart-event-realtime:${event}`, { detail: payload }))
}

const haversineDistanceMeters = (a, b) => {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const normalizeEvent = (event) => ({
  _id: event._id || randomId('event'),
  name: event.name || 'Untitled Event',
  description: event.description || '',
  status: event.status || 'active',
  category: event.category || 'festival',
  location: event.location || event.venue?.name || 'Event Grounds',
  latitude: Number(event.latitude || event.venue?.location?.coordinates?.[1] || 19.076),
  longitude: Number(event.longitude || event.venue?.location?.coordinates?.[0] || 72.8777),
  date: event.date || nowIso(),
  capacity: Number(event.capacity || event.venue?.capacity || 1000),
  safetyRadiusMeters: Number(event.safetyRadiusMeters || event.safety?.defaultRadiusMeters || 170),
  attendees: Number(event.attendees || event.familyCount || 0),
  familyRegistrations: event.familyRegistrations || [],
  createdAt: event.createdAt || nowIso(),
  updatedAt: nowIso(),
})

const normalizeGroup = (group) => {
  const leader = group.leader || group.userId || 'local-family'
  const fallbackGuardian = {
    _id: group.guardianId || randomId('guardian'),
    user: leader,
    name: group.guardianName || group.leaderName || 'Primary Guardian',
    relationship: 'guardian',
    phone: group.guardianPhone || '',
    role: 'leader',
    emergencyContact: true,
  }
  const guardians = group.guardians || [fallbackGuardian]
  const members = group.members || guardians

  return {
    _id: group._id || randomId('family-group'),
    name: group.name || 'Family Group',
    code: group.code,
    event: group.event || group.eventId || null,
    leader,
    guardians,
    members,
    childMembers: group.childMembers || [],
    devicePairings: group.devicePairings || [],
    geofenceSettings: {
      ...DEFAULT_GEOFENCE,
      ...(group.geofenceSettings || {}),
      guardianLocation: {
        ...DEFAULT_GEOFENCE.guardianLocation,
        ...(group.geofenceSettings?.guardianLocation || {}),
      },
    },
    geofenceHistory: group.geofenceHistory || [],
    createdAt: group.createdAt || nowIso(),
    updatedAt: nowIso(),
  }
}

const devicesForMember = (member) => {
  if (Array.isArray(member.devices)) return member.devices
  if (!member.wearableDeviceId) return []
  return [
    {
      deviceId: member.wearableDeviceId,
      deviceType: 'watch',
      label: member.deviceLabel || member.wearableDeviceId,
      status: ['paired', 'connected'].includes(member.deviceStatus) ? 'connected' : member.deviceStatus || 'disconnected',
      paired: ['paired', 'connected'].includes(member.deviceStatus),
      connected: ['paired', 'connected'].includes(member.deviceStatus),
      batteryLevel: member.batteryLevel ?? null,
      signalStatus: member.signalStatus || 'standby',
      lastSeenAt: member.lastSeenAt || null,
      lastLocation: member.lastLocation || null,
      connectedAt: member.lastSeenAt || null,
    },
  ]
}

const createDeviceSession = ({ groupId, childMemberId, deviceId }) => ({
  sessionId: `SESSION-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
  groupId,
  childMemberId,
  deviceId,
  startedAt: nowIso(),
  status: 'active',
})

const normalizeChildMember = (member) => {
  const devices = devicesForMember(member)
  const primaryDevice = devices[0]
  return {
    _id: member._id || randomId('member'),
    name: member.name || 'Child Member',
    age: Number(member.age || 10),
    relationship: member.relationship || 'child',
    wearableDeviceId: member.wearableDeviceId || primaryDevice?.deviceId || null,
    deviceLabel: member.deviceLabel || primaryDevice?.label || '',
    devices,
    deviceStatus: devices.some((device) => device.status === 'connected')
      ? 'connected'
      : devices.length
        ? 'disconnected'
        : member.deviceStatus || 'unpaired',
    geofenceStatus: member.geofenceStatus || 'unknown',
    geofenceState: member.geofenceState || member.geofenceStatus || 'unknown',
    distanceMeters: member.distanceMeters ?? null,
    zone: member.zone || 'unknown',
    batteryLevel: member.batteryLevel ?? primaryDevice?.batteryLevel ?? null,
    signalStatus: member.signalStatus || primaryDevice?.signalStatus || 'standby',
    lastSeenAt: member.lastSeenAt || primaryDevice?.lastSeenAt || null,
    lastLocation: member.lastLocation || primaryDevice?.lastLocation || null,
    pairingCode: member.pairingCode,
    pairingCodeExpiresAt: member.pairingCodeExpiresAt,
  }
}

export const demoStore = {
  getState() {
    try {
      return { ...baseState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }
    } catch {
      return { ...baseState }
    }
  },

  save(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: nextState }))
    emitRealtime('DEMO_STORE_UPDATED', nextState)
    return nextState
  },

  subscribe(callback) {
    const handler = (event) => callback(event.detail || this.getState())
    window.addEventListener(STORE_EVENT, handler)
    return () => window.removeEventListener(STORE_EVENT, handler)
  },

  upsertEvent(event) {
    const state = this.getState()
    const normalized = normalizeEvent(event)
    const existingIndex = state.events.findIndex((item) => item._id === normalized._id)
    const events =
      existingIndex >= 0
        ? state.events.map((item) => (item._id === normalized._id ? { ...item, ...normalized } : item))
        : [normalized, ...state.events]
    this.save({ ...state, events })
    emitRealtime(existingIndex >= 0 ? 'EVENT_UPDATED' : 'EVENT_CREATED', normalized)
    return normalized
  },

  deleteEvent(eventId) {
    const state = this.getState()
    const nextState = {
      ...state,
      events: state.events.filter((event) => event._id !== eventId),
      registrations: state.registrations.filter((registration) => registration.eventId !== eventId),
      familyGroups: state.familyGroups.filter((group) => group.event !== eventId),
    }
    this.save(nextState)
    emitRealtime('EVENT_DELETED', { eventId })
  },

  registerFamilyForEvent(eventId, userId = 'local-family', groupId = null) {
    const state = this.getState()
    const group = state.familyGroups.find((item) => item._id === groupId)
    const event = state.events.find((item) => item._id === eventId)
    const exists = state.registrations.some((registration) => registration.eventId === eventId && registration.userId === userId)
    const registrations = exists
      ? state.registrations.map((registration) =>
          registration.eventId === eventId && registration.userId === userId
            ? { ...registration, groupId: registration.groupId || groupId, updatedAt: nowIso() }
            : registration
        )
      : [{ _id: randomId('registration'), eventId, userId, groupId, createdAt: nowIso() }, ...state.registrations]
    const events = state.events.map((event) =>
      event._id === eventId
        ? {
            ...event,
            attendees: Math.max(Number(event.attendees || 0), eventFamilyCount({ ...state, registrations }, eventId)),
            familyRegistrations: Array.from(new Set([...(event.familyRegistrations || []), userId])),
            updatedAt: nowIso(),
          }
        : event
    )
    const nextState = { ...state, events, registrations }
    this.save(nextState)
    const payload = {
      eventId,
      eventName: event?.name,
      userId,
      groupId,
      familyGroupId: groupId,
      familyCode: group?.code,
      familyGroupLabel: groupId ? `Family ${String(groupId).slice(-4)}` : 'Family group',
      familyCount: eventFamilyCount(nextState, eventId),
      timestamp: nowIso(),
    }
    emitRealtime('FAMILY_REGISTERED', payload)
    emitRealtime('FAMILY_JOINED_EVENT', payload)
    emitRealtime('ORGANIZER_FAMILY_REGISTERED', {
      ...payload,
      userId: undefined,
    })
    return payload
  },

  joinEvent(eventId, user = {}) {
    const state = this.getState()
    const existingGroup = state.familyGroups.find((group) => group.event === eventId && group.leader === (user.userId || 'local-family'))
    if (existingGroup) {
      this.registerFamilyForEvent(eventId, existingGroup.leader, existingGroup._id)
      return existingGroup
    }

    const event = state.events.find((item) => item._id === eventId)
    return this.createFamilyGroup({
      name: `${user.firstName || 'My'} Family`,
      event: eventId,
      leader: user.userId || 'local-family',
      guardians: [
        {
          _id: randomId('guardian'),
          name: `${user.firstName || 'Primary'} ${user.lastName || 'Guardian'}`.trim(),
          relationship: 'guardian',
          phone: '',
        },
      ],
      childMembers: [],
      eventName: event?.name,
    })
  },

  createFamilyGroup(group) {
    const state = this.getState()
    const leaderId = group.leader || group.userId || 'local-family'
    const existingGroup = state.familyGroups.find((item) => {
      const sameLeader = String(item.leader) === String(leaderId) || (item.members || []).some((member) => String(member.user) === String(leaderId))
      const sameEvent = group.event || group.eventId ? String(item.event) === String(group.event || group.eventId) : true
      return sameLeader && sameEvent
    })
    if (existingGroup) {
      return existingGroup
    }

    let code = group.code
    do {
      code = group.code && !state.familyGroups.some((item) => item.code === group.code)
        ? group.code
        : randomCode('FAM', 5)
    } while (state.familyGroups.some((item) => item.code === code))
    const normalized = normalizeGroup({
      ...group,
      code,
      childMembers: (group.childMembers || []).map(normalizeChildMember),
    })
    const nextState = { ...state, familyGroups: [normalized, ...state.familyGroups] }
    this.save(nextState)
    const payload = {
      ...normalized,
      groupId: normalized._id,
      familyGroupId: normalized._id,
      eventId: normalized.event,
      familyCode: normalized.code,
      timestamp: nowIso(),
    }
    emitRealtime('FAMILY_GROUP_CREATED', payload)
    emitRealtime('FAMILY_CREATED', payload)
    if (normalized.event) this.registerFamilyForEvent(normalized.event, normalized.leader, normalized._id)
    return normalized
  },

  addGuardian(groupId, guardian) {
    const state = this.getState()
    let added = null
    const familyGroups = state.familyGroups.map((group) => {
      if (group._id !== groupId) return group
      added = {
        _id: randomId('guardian'),
        name: guardian.name || 'Guardian',
        relationship: guardian.relationship || 'guardian',
        phone: guardian.phone || '',
      }
      return { ...group, guardians: [...(group.guardians || []), added], members: [...(group.members || []), added], updatedAt: nowIso() }
    })
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_ADDED', { groupId, member: added, memberType: 'guardian' })
    emitRealtime('MEMBER_ADDED', { groupId, member: added, memberType: 'guardian' })
    return added
  },

  updateGuardian(groupId, guardianId, patch) {
    const state = this.getState()
    const familyGroups = state.familyGroups.map((group) =>
      group._id === groupId
        ? {
            ...group,
            guardians: (group.guardians || []).map((guardian) => (guardian._id === guardianId ? { ...guardian, ...patch } : guardian)),
            members: (group.members || []).map((member) => (member._id === guardianId ? { ...member, ...patch } : member)),
            updatedAt: nowIso(),
          }
        : group
    )
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_UPDATED', { groupId, memberId: guardianId, patch, memberType: 'guardian' })
  },

  removeGuardian(groupId, guardianId) {
    const state = this.getState()
    const familyGroups = state.familyGroups.map((group) =>
      group._id === groupId
        ? {
            ...group,
            guardians: (group.guardians || []).filter((guardian) => guardian._id !== guardianId),
            members: (group.members || []).filter((member) => member._id !== guardianId),
            updatedAt: nowIso(),
          }
        : group
    )
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_REMOVED', { groupId, memberId: guardianId, memberType: 'guardian' })
  },

  updateFamilyGroup(groupId, patch) {
    const state = this.getState()
    let updated = null
    const familyGroups = state.familyGroups.map((group) => {
      if (group._id !== groupId) return group
      updated = {
        ...group,
        ...patch,
        geofenceSettings: patch.geofenceSettings
          ? {
              ...(group.geofenceSettings || DEFAULT_GEOFENCE),
              ...patch.geofenceSettings,
              guardianLocation: {
                ...((group.geofenceSettings || DEFAULT_GEOFENCE).guardianLocation || DEFAULT_GEOFENCE.guardianLocation),
                ...(patch.geofenceSettings.guardianLocation || {}),
              },
            }
          : group.geofenceSettings,
        updatedAt: nowIso(),
      }
      return updated
    })
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_GROUP_UPDATED', updated)
    return updated
  },

  addMember(groupId, member) {
    const state = this.getState()
    let added = null
    const familyGroups = state.familyGroups.map((group) => {
      if (group._id !== groupId) return group
      added = {
        ...normalizeChildMember(member),
        _id: randomId('member'),
      }
      return { ...group, childMembers: [...group.childMembers, added], updatedAt: nowIso() }
    })
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_ADDED', { groupId, member: added })
    emitRealtime('MEMBER_ADDED', { groupId, member: added })
    return added
  },

  updateMember(groupId, memberId, patch) {
    const state = this.getState()
    const familyGroups = state.familyGroups.map((group) =>
      group._id === groupId
        ? {
            ...group,
            childMembers: group.childMembers.map((member) => (member._id === memberId ? { ...member, ...patch } : member)),
            updatedAt: nowIso(),
          }
        : group
    )
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_UPDATED', { groupId, memberId, patch })
  },

  removeMember(groupId, memberId) {
    const state = this.getState()
    const familyGroups = state.familyGroups.map((group) =>
      group._id === groupId
        ? {
            ...group,
            childMembers: group.childMembers.filter((member) => member._id !== memberId),
            devicePairings: group.devicePairings.filter((pairing) => pairing.childMemberId !== memberId),
            updatedAt: nowIso(),
          }
        : group
    )
    this.save({ ...state, familyGroups })
    emitRealtime('FAMILY_MEMBER_REMOVED', { groupId, memberId })
  },

  generatePairCode(groupId, memberId) {
    const state = this.getState()
    const pairCode = randomCode('', 6)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    let result = null
    const familyGroups = state.familyGroups.map((group) => {
      if (group._id !== groupId) return group
      const child = group.childMembers.find((member) => member._id === memberId)
      result = { groupId, childMemberId: memberId, childName: child?.name, familyCode: group.code, pairingCode: pairCode, expiresAt }
      return {
        ...group,
        childMembers: group.childMembers.map((member) =>
          member._id === memberId ? { ...member, deviceStatus: 'pending', paired: false, connected: false, pairingCode: pairCode, pairingCodeExpiresAt: expiresAt } : member
        ),
        devicePairings: [
          ...group.devicePairings.map((pairing) =>
            pairing.childMemberId === memberId && pairing.status === 'pending'
              ? { ...pairing, status: 'expired', expiredAt: nowIso() }
              : pairing
          ),
          { childMemberId: memberId, code: pairCode, status: 'pending', expiresAt, createdAt: nowIso() },
        ],
        updatedAt: nowIso(),
      }
    })
    this.save({ ...state, familyGroups })
    emitRealtime('PAIR_CODE_GENERATED', result)
    return result
  },

  confirmPairCode({ familyCode, pairCode, deviceId, deviceType = 'watch', deviceLabel }) {
    const state = this.getState()
    let result = null
    let expiredCode = null
    const normalizedFamilyCode = normalizeCode(familyCode)
    const normalizedPairCode = normalizeCode(pairCode)
    const familyGroups = state.familyGroups.map((group) => {
      if (normalizeCode(group.code) !== normalizedFamilyCode) return group
      const pairing = group.devicePairings.find((item) => normalizeCode(item.code) === normalizedPairCode)
      if (!pairing || pairing.status !== 'pending') return group
      if (new Date(pairing.expiresAt) < new Date()) {
        expiredCode = pairing.code
        return {
          ...group,
          childMembers: group.childMembers.map((member) =>
            member._id === pairing.childMemberId && member.deviceStatus === 'pending'
              ? { ...member, deviceStatus: 'unpaired', pairingCode: undefined, pairingCodeExpiresAt: undefined }
              : member
          ),
          devicePairings: group.devicePairings.map((item) =>
            normalizeCode(item.code) === normalizedPairCode ? { ...item, status: 'expired', expiredAt: nowIso() } : item
          ),
        }
      }
      const child = group.childMembers.find((member) => member._id === pairing.childMemberId)
      const label = deviceLabel || `${String(deviceType).replace('-', ' ')} ${deviceId}`.trim()
      const nextDevice = {
        deviceId,
        deviceType,
        label,
        status: 'connected',
        paired: true,
        connected: true,
        batteryLevel: null,
        signalStatus: 'strong',
        connectedAt: nowIso(),
        lastSeenAt: null,
        lastLocation: null,
      }
      const deviceSession = createDeviceSession({ groupId: group._id, childMemberId: pairing.childMemberId, deviceId })
      result = {
        groupId: group._id,
        childMemberId: pairing.childMemberId,
        childName: child?.name,
        familyCode: group.code,
        familyName: group.name,
        eventId: group.event,
        deviceId,
        deviceType,
        deviceLabel: label,
        device: nextDevice,
        deviceSession,
        paired: true,
        connected: true,
        status: 'connected',
      }
      return {
        ...group,
        childMembers: group.childMembers.map((member) => {
          if (member._id !== pairing.childMemberId) return normalizeChildMember(member)
          const existingDevices = devicesForMember(member).filter((device) => device.deviceId !== deviceId)
          return normalizeChildMember({
            ...member,
            wearableDeviceId: member.wearableDeviceId || deviceId,
            deviceLabel: member.deviceLabel || label,
            devices: [...existingDevices, nextDevice],
            deviceStatus: 'connected',
            signalStatus: 'strong',
          })
        }),
        devicePairings: group.devicePairings.map((item) =>
          normalizeCode(item.code) === normalizedPairCode ? { ...item, status: 'confirmed', deviceId, deviceType, deviceLabel: label, confirmedAt: nowIso(), deviceSession } : item
        ),
        updatedAt: nowIso(),
      }
    })
    this.save({ ...state, familyGroups })
    if (result) emitRealtime('DEVICE_PAIRED', result)
    if (expiredCode) emitRealtime('PAIR_CODE_EXPIRED', { familyCode: normalizedFamilyCode, pairCode: expiredCode })
    return result
  },

  updateDeviceLocation(deviceId, data) {
    if (!data.deviceSessionId) return null
    const state = this.getState()
    let result = null
    let geofenceEvent = null
    const familyGroups = state.familyGroups.map((group) => {
      const geofenceSettings = { ...DEFAULT_GEOFENCE, ...(group.geofenceSettings || {}) }
      const guardianLocation = geofenceSettings.guardianLocation || DEFAULT_GEOFENCE.guardianLocation
      return {
      ...group,
      childMembers: group.childMembers.map((member) => {
        const devices = devicesForMember(member)
        const deviceIndex = devices.findIndex((device) => device.deviceId === deviceId)
        if (member.wearableDeviceId !== deviceId && deviceIndex < 0) return normalizeChildMember(member)
        const matchedDevice = devices[deviceIndex]
        const isPairedSession =
          matchedDevice?.connected === true ||
          matchedDevice?.status === 'connected' ||
          ['paired', 'connected'].includes(member.deviceStatus)
        if (!isPairedSession) return normalizeChildMember(member)
        const lastLocation = { type: 'Point', coordinates: [data.longitude, data.latitude] }
        const childLocation = { latitude: Number(data.latitude), longitude: Number(data.longitude) }
        const distanceMeters = haversineDistanceMeters(guardianLocation, childLocation)
        const geofenceState =
          distanceMeters > Number(geofenceSettings.safeRadiusMeters)
            ? 'breach'
            : distanceMeters > Number(geofenceSettings.warningRadiusMeters)
              ? 'warning'
              : 'safe'
        const previousState = member.geofenceState || member.geofenceStatus || 'unknown'
        const zone =
          geofenceState === 'breach'
            ? 'Outside safe radius'
            : geofenceState === 'warning'
              ? 'Warning ring'
              : 'Safe radius'
        const updatedDevices =
          deviceIndex >= 0
            ? devices.map((device) =>
                device.deviceId === deviceId
                  ? {
                      ...device,
                      status: 'connected',
                      paired: true,
                      connected: true,
                      batteryLevel: data.batteryLevel,
                      signalStatus: data.signalStatus || 'strong',
                      lastSeenAt: nowIso(),
                      lastLocation,
                    }
                  : device
              )
            : [
                ...devices,
                {
                  deviceId,
                  deviceType: data.deviceType || 'watch',
                  label: data.deviceLabel || deviceId,
                  status: 'connected',
                  paired: true,
                  connected: true,
                  batteryLevel: data.batteryLevel,
                  signalStatus: data.signalStatus || 'strong',
                  lastSeenAt: nowIso(),
                  lastLocation,
                },
              ]
        const updated = {
          ...member,
          devices: updatedDevices,
          wearableDeviceId: member.wearableDeviceId || deviceId,
          lastLocation,
          lastSeenAt: nowIso(),
          batteryLevel: data.batteryLevel,
          signalStatus: data.signalStatus || 'strong',
          geofenceStatus: geofenceState === 'breach' ? 'outside' : 'inside',
          geofenceState,
          distanceMeters,
          zone,
          deviceStatus: 'connected',
        }
        result = { groupId: group._id, childMemberId: member._id, deviceId, child: normalizeChildMember(updated) }
        if (geofenceState !== 'safe' && geofenceState !== previousState) {
          geofenceEvent = {
            _id: randomId(`geofence-${geofenceState}`),
            eventId: group.event,
            familyGroupId: group._id,
            childMemberId: member._id,
            deviceId,
            type: geofenceState === 'breach' ? 'GEOFENCE_BREACH' : 'GEOFENCE_WARNING',
            severity: geofenceState === 'breach' ? 'high' : 'medium',
            status: geofenceState,
            distanceMeters,
            safeRadiusMeters: geofenceSettings.safeRadiusMeters,
            warningRadiusMeters: geofenceSettings.warningRadiusMeters,
            guardianLocation,
            childLocation,
            zone,
            timestamp: nowIso(),
          }
        }
        return normalizeChildMember(updated)
      }),
      geofenceHistory: geofenceEvent?.familyGroupId === group._id ? [geofenceEvent, ...(group.geofenceHistory || [])].slice(0, 40) : group.geofenceHistory || [],
      }
    })
    this.save({ ...state, familyGroups })
    if (result) {
      const activityTimestamp = nowIso()
      emitRealtime('DEVICE_LOCATION_UPDATED', {
        eventId: state.familyGroups.find((group) => group._id === result.groupId)?.event,
        familyGroupId: result.groupId,
        memberId: result.childMemberId,
        childMemberId: result.childMemberId,
        childName: result.child.name,
        deviceId,
        latitude: data.latitude,
        longitude: data.longitude,
        location: { latitude: data.latitude, longitude: data.longitude },
        battery: data.battery ?? data.batteryLevel,
        signal: data.signal || data.signalStatus,
        batteryLevel: data.batteryLevel ?? data.battery,
        signalStatus: data.signalStatus || data.signal,
        geofenceStatus: result.child.geofenceStatus,
        geofenceState: result.child.geofenceState,
        distanceMeters: result.child.distanceMeters,
        zone: result.child.zone,
        sosActive: Boolean(data.sosActive),
        timestamp: activityTimestamp,
      })
      emitRealtime('DEVICE_STATUS_UPDATED', {
        groupId: result.groupId,
        childMemberId: result.childMemberId,
        deviceId,
        status: 'connected',
        batteryLevel: data.batteryLevel,
        signalStatus: data.signalStatus || 'strong',
        lastSeenAt: activityTimestamp,
        timestamp: activityTimestamp,
      })
      if (geofenceEvent) {
        emitRealtime(geofenceEvent.type, geofenceEvent)
        emitRealtime('ORGANIZER_GEOFENCE_EVENT', {
          ...geofenceEvent,
          childMemberId: undefined,
          deviceId: undefined,
          familyGroupLabel: `Family ${String(geofenceEvent.familyGroupId).slice(-4)}`,
        })
        this.addAlert({
          _id: geofenceEvent._id,
          event: geofenceEvent.eventId,
          type: geofenceEvent.type === 'GEOFENCE_BREACH' ? 'Geofence Breach' : 'Geofence Warning',
          title: geofenceEvent.type === 'GEOFENCE_BREACH' ? 'Geofence Breach' : 'Geofence Warning',
          severity: geofenceEvent.severity,
          description: `Anonymized family device is ${Math.round(geofenceEvent.distanceMeters)}m from guardian point.`,
          location: geofenceEvent.zone,
          zone: geofenceEvent.zone,
          familyGroupId: geofenceEvent.familyGroupId,
          childMemberId: geofenceEvent.childMemberId,
          deviceId: geofenceEvent.deviceId,
          createdAt: geofenceEvent.timestamp,
          time: 'Just now',
        })
      }
    }
    return result
  },

  disconnectDevice(deviceId) {
    const state = this.getState()
    let result = null
    const familyGroups = state.familyGroups.map((group) => ({
      ...group,
      childMembers: group.childMembers.map((member) => {
        const devices = devicesForMember(member)
        if (!devices.some((device) => device.deviceId === deviceId)) return normalizeChildMember(member)
        const updatedDevices = devices.map((device) =>
          device.deviceId === deviceId ? { ...device, status: 'disconnected', connected: false, disconnectedAt: nowIso() } : device
        )
        const updated = normalizeChildMember({
          ...member,
          devices: updatedDevices,
          deviceStatus: updatedDevices.some((device) => device.status === 'connected') ? 'connected' : 'disconnected',
        })
        result = { groupId: group._id, childMemberId: member._id, deviceId, child: updated }
        return updated
      }),
    }))
    this.save({ ...state, familyGroups })
    if (result) {
      emitRealtime('DEVICE_DISCONNECTED', { ...result, status: 'disconnected', timestamp: nowIso() })
      emitRealtime('DEVICE_STATUS_UPDATED', { ...result, status: 'disconnected', timestamp: nowIso() })
    }
    return result
  },

  getDevices(groupId = null) {
    const state = this.getState()
    return state.familyGroups
      .filter((group) => !groupId || group._id === groupId)
      .flatMap((group) =>
        group.childMembers.flatMap((member) =>
          devicesForMember(member).map((device) => ({
            ...device,
            groupId: group._id,
            familyCode: group.code,
            childMemberId: member._id,
            childName: member.name,
            eventId: group.event,
          }))
        )
      )
  },

  addAlert(alert) {
    const state = this.getState()
    const incomingKey = alertDedupeKey(alert)
    const duplicate = state.alerts.find((item) => {
      if (alert._id && item._id === alert._id) return true
      if (alertDedupeKey(item) !== incomingKey) return false
      return Date.now() - new Date(item.createdAt || 0).getTime() < ALERT_DEDUPE_MS
    })
    if (duplicate) return duplicate

    const normalized = {
      _id: alert._id || randomId('alert'),
      type: alert.type || 'Safety Alert',
      title: alert.title || alert.type || 'Safety Alert',
      severity: alert.severity || 'medium',
      status: alert.status || 'active',
      description: alert.description || '',
      location: alert.location || 'Event Grounds',
      event: alert.event || state.events[0]?._id || null,
      familyGroupId: alert.familyGroupId,
      childMemberId: alert.childMemberId,
      deviceId: alert.deviceId,
      audience: alert.audience,
      scopes: alert.scopes,
      createdAt: alert.createdAt || nowIso(),
      time: alert.time || new Date().toLocaleTimeString(),
    }
    this.save({ ...state, alerts: [normalized, ...state.alerts].slice(0, 60) })
    emitRealtime('new-alert', {
      audience: normalized.familyGroupId ? 'family' : 'organizer',
      scopes: normalized.familyGroupId ? ['family', 'organizer'] : ['organizer', 'monitoring'],
      ...normalized,
    })
    emitRealtime('ALERT_STREAM', {
      audience: normalized.familyGroupId ? 'family' : 'organizer',
      scopes: normalized.familyGroupId ? ['family', 'organizer'] : ['organizer', 'monitoring'],
      ...normalized,
    })
    return normalized
  },

  resolveAlert(alertId) {
    const state = this.getState()
    this.save({ ...state, alerts: state.alerts.map((alert) => (alert._id === alertId ? { ...alert, status: 'resolved' } : alert)) })
  },

  getStats() {
    const state = this.getState()
    return {
      activeEvents: state.events.filter((event) => event.status === 'active').length,
      totalAlerts: state.alerts.length,
      activeAlerts: state.alerts.filter((alert) => alert.status !== 'resolved').length,
      totalUsers: state.familyGroups.reduce((count, group) => count + group.childMembers.length + (group.guardians || group.members || []).length, 0),
      familyGroups: state.familyGroups.length,
      linkedDevices: state.familyGroups.reduce(
        (count, group) => count + group.childMembers.reduce((deviceCount, member) => deviceCount + devicesForMember(member).length, 0),
        0
      ),
      geofenceBreaches: state.familyGroups.reduce(
        (count, group) => count + group.childMembers.filter((member) => member.geofenceStatus === 'outside').length,
        0
      ),
      systemHealth: 98,
    }
  },

  getEventStats() {
    const state = this.getState()
    return {
      total: state.events.length,
      active: state.events.filter((event) => event.status === 'active').length,
      upcoming: state.events.filter((event) => event.status === 'published').length,
      completed: state.events.filter((event) => event.status === 'completed').length,
      checkedIn: state.registrations.length,
      capacity: state.events.reduce((sum, event) => sum + Number(event.capacity || 0), 0),
    }
  },

  getOrganizerFamilySummary(eventId) {
    const state = this.getState()
    return state.familyGroups
      .filter((group) => !eventId || group.event === eventId)
      .map((group, index) => ({
        groupId: group._id,
        label: group.name || `Family Group ${index + 1}`,
        familyCode: group.code,
        eventId: group.event,
        guardianCount: (group.guardians || group.members || []).length,
        childCount: group.childMembers.length,
        memberCount: group.childMembers.length + (group.guardians || group.members || []).length,
        linkedDevices: group.childMembers.reduce((count, member) => count + devicesForMember(member).length, 0),
        geofenceBreaches: group.childMembers.filter((member) => member.geofenceStatus === 'outside').length,
        warningCount: group.childMembers.filter((member) => member.geofenceState === 'warning').length,
        locationZones: (group.geofenceHistory || []).slice(0, 5).map((item) => ({
          status: item.status,
          zone: item.zone,
          distanceMeters: item.distanceMeters,
          timestamp: item.timestamp,
        })),
        status: group.childMembers.some((member) => member.geofenceStatus === 'outside') ? 'attention' : 'normal',
      }))
  },

  haversineDistanceMeters,
  apiResponse: response,
}
