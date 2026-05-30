const EVENT_ID = 'demo-event-1'
const FAMILY_GROUP_ID = 'demo-family-group-1'
const GUARDIAN = { latitude: 19.076, longitude: 72.8777 }
const SAFE_RADIUS_METERS = 170
const WARNING_RADIUS_METERS = 130
const SIMULATION_MODE = true

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const HOTSPOT_RADIUS_METERS = 220
const INCIDENT_WINDOW_MS = 90 * 1000
const NOTIFICATION_COOLDOWN_MS = 18 * 1000
const INCIDENT_DEDUPE_MS = 30 * 1000
const GEOFENCE_ALERT_COOLDOWN_MS = 75 * 1000
const HOTSPOT_COOLDOWN_MS = 45 * 1000
const ESCALATION_COOLDOWN_MS = 35 * 1000
const CLUSTER_UPDATE_COOLDOWN_MS = 12 * 1000

const zoneCenters = {
  'Main Gate': { latitude: 19.0772, longitude: 72.8772 },
  'Family Zone': { latitude: 19.0762, longitude: 72.8784 },
  'Family Zone East': { latitude: 19.07655, longitude: 72.87915 },
  'Medical Bay': { latitude: 19.07545, longitude: 72.87665 },
  'Vendor Aisle 3': { latitude: 19.0753, longitude: 72.8769 },
  'Food Court': { latitude: 19.0748, longitude: 72.8785 },
  'South Lawn': { latitude: 19.07465, longitude: 72.8797 },
  'Stage Front': { latitude: 19.07785, longitude: 72.8781 },
  'Family safety radius': { latitude: 19.0771, longitude: 72.879 },
}

const nowLabel = () => new Date().toLocaleTimeString()

const metersBetween = (a, b) => {
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

const paths = [
  [
    [19.076, 72.8777],
    [19.07625, 72.878],
    [19.07655, 72.8783],
    [19.07685, 72.87855],
    [19.07715, 72.87885],
    [19.07755, 72.8792],
    [19.0779, 72.8795],
    [19.07735, 72.87895],
    [19.0769, 72.87845],
    [19.07645, 72.878],
  ],
  [
    [19.0757, 72.8773],
    [19.07595, 72.87695],
    [19.07625, 72.87665],
    [19.07655, 72.8764],
    [19.07695, 72.87615],
    [19.07735, 72.87585],
    [19.07765, 72.87555],
    [19.077, 72.87615],
    [19.07645, 72.87675],
    [19.07595, 72.8771],
  ],
  [
    [19.0764, 72.8771],
    [19.07615, 72.87755],
    [19.0759, 72.878],
    [19.07555, 72.87845],
    [19.07525, 72.8789],
    [19.07495, 72.8793],
    [19.07465, 72.8797],
    [19.0752, 72.8791],
    [19.07575, 72.8784],
    [19.0761, 72.8778],
  ],
]

const devices = [
  { childMemberId: 'demo-child-1', childName: 'Emma', deviceId: 'WATCH-DEMO-001', pathIndex: 0, cursor: 0, batteryLevel: 84, signalStatus: 'strong', online: false, paired: false, connected: false },
  { childMemberId: 'demo-child-2', childName: 'Liam', deviceId: 'WATCH-DEMO-002', pathIndex: 1, cursor: 0, batteryLevel: 78, signalStatus: 'strong', online: false, paired: false, connected: false },
  { childMemberId: 'demo-child-3', childName: 'Sophia', deviceId: 'WATCH-DEMO-003', pathIndex: 2, cursor: 0, batteryLevel: 91, signalStatus: 'strong', online: false, paired: false, connected: false },
]

const severityWeight = (severity = 'LOW') => Math.max(0, SEVERITY_ORDER.indexOf(String(severity).toUpperCase()))
const severityFromWeight = (weight) => SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, Math.max(0, weight))]
const normalizeSeverity = (severity = 'LOW') => String(severity).toUpperCase()
const displaySeverity = (severity = 'LOW') => normalizeSeverity(severity).toLowerCase()

const locationFor = (zone) => {
  const base = zoneCenters[zone] || GUARDIAN
  return {
    latitude: base.latitude,
    longitude: base.longitude,
  }
}

class RealtimeSimulation {
  constructor() {
    this.listeners = new Map()
    this.started = false
    this.moveTimer = null
    this.metricTimer = null
    this.incidentEvents = []
    this.hotspots = []
    this.lastDensities = new Map()
    this.cooldowns = new Map()
    this.incidentCooldowns = new Map()
    this.windowHandlers = new Map()
    this.familyScopes = new Map()
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(callback)
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return
    if (callback) this.listeners.get(event).delete(callback)
    else this.listeners.delete(event)
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((callback) => callback(payload))
  }

  cooldownReady(key, duration = NOTIFICATION_COOLDOWN_MS) {
    const now = Date.now()
    const last = this.cooldowns.get(key) || 0
    if (now - last < duration) return false
    this.cooldowns.set(key, now)
    return true
  }

  incidentReady(key, duration = INCIDENT_DEDUPE_MS) {
    const now = Date.now()
    const last = this.incidentCooldowns.get(key) || 0
    if (now - last < duration) return false
    this.incidentCooldowns.set(key, now)
    return true
  }

  alertCooldownFor(alert) {
    const type = String(alert.type || '').toLowerCase()
    if (type.includes('geofence')) return GEOFENCE_ALERT_COOLDOWN_MS
    if (type.includes('hotspot')) return HOTSPOT_COOLDOWN_MS
    if (type.includes('escalat')) return ESCALATION_COOLDOWN_MS
    return NOTIFICATION_COOLDOWN_MS
  }

  alertKeyFor(alert) {
    return [
      'alert',
      String(alert.type || 'Safety Alert').toLowerCase(),
      alert.familyGroupId || alert.groupId || 'event-wide',
      alert.deviceId || alert.childMemberId || alert.location || alert.zone || 'event-grounds',
      normalizeSeverity(alert.severity || 'LOW'),
    ].join(':')
  }

  incidentKeyFor(incident) {
    return [
      'incident',
      String(incident.event || incident.type || 'INCIDENT_REPORTED').toLowerCase(),
      incident.familyGroupId || incident.groupId || 'event-wide',
      incident.deviceId || incident.childMemberId || incident.location || 'event-grounds',
      normalizeSeverity(incident.severity || 'LOW'),
    ].join(':')
  }

  emitAlert(alert) {
    const familyRelated = Boolean(alert.familyGroupId) || alert.type?.toLowerCase().includes('geofence') || alert.type?.toLowerCase().includes('sos')
    const audience = alert.audience || (familyRelated ? 'family' : 'organizer')
    const normalized = {
      _id: alert._id || `sim-alert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      id: alert.id || alert._id || Date.now(),
      event: EVENT_ID,
      status: 'active',
      createdAt: alert.createdAt || new Date().toISOString(),
      time: alert.time || nowLabel(),
      familyGroupId: alert.familyGroupId || (familyRelated ? FAMILY_GROUP_ID : undefined),
      audience,
      scopes: alert.scopes || (familyRelated ? ['family', 'organizer'] : ['organizer', 'monitoring']),
      ...alert,
      severity: displaySeverity(alert.severity),
    }

    const key = this.alertKeyFor(normalized)
    if (!this.cooldownReady(key, this.alertCooldownFor(normalized))) return null

    this.emit('new-alert', normalized)
    this.emit('ALERT_STREAM', normalized)
    this.emit('toast-alert', normalized)

    if (!normalized.suppressTypedEvent && normalized.type?.toLowerCase().includes('geofence')) {
      this.emit('GEOFENCE_BREACH_ALERT', normalized)
      this.emit('ORGANIZER_GEOFENCE_BREACH', normalized)
    }

    if (!normalized.suppressTypedEvent && normalized.type?.toLowerCase().includes('sos')) {
      this.emit('SOS_ALERT', normalized)
      this.emit('ORGANIZER_SOS_ALERT', normalized)
    }

    return normalized
  }

  start() {
    if (this.started) return
    this.started = true

    const bridgeEvents = [
      'EVENT_CREATED',
      'EVENT_UPDATED',
      'EVENT_DELETED',
      'FAMILY_REGISTERED',
      'ORGANIZER_FAMILY_REGISTERED',
      'FAMILY_GROUP_CREATED',
      'FAMILY_GROUP_UPDATED',
      'FAMILY_MEMBER_ADDED',
      'FAMILY_MEMBER_UPDATED',
      'FAMILY_MEMBER_REMOVED',
      'PAIR_CODE_GENERATED',
      'PAIR_CODE_EXPIRED',
      'DEVICE_PAIRED',
      'DEVICE_LOCATION_UPDATED',
      'DEVICE_STATUS_UPDATED',
      'DEVICE_DISCONNECTED',
      'GEOFENCE_WARNING',
      'GEOFENCE_BREACH',
      'ORGANIZER_GEOFENCE_EVENT',
      'DEVICE_RECONNECTED',
      'SEPARATION_SCENARIO',
      'SOS_ALERT',
      'CROWD_HOTSPOT',
      'MEDICAL_INCIDENT',
      'CROWD_DENSITY_UPDATE',
      'INCIDENT_CLUSTERED',
      'HOTSPOT_CREATED',
      'HOTSPOT_ZONES_UPDATED',
      'SEVERITY_ESCALATED',
      'CRITICAL_CROWD_SITUATION',
      'new-alert',
      'ALERT_STREAM',
      'DEMO_STORE_UPDATED',
    ]

    bridgeEvents.forEach((eventName) => {
      const handler = (event) => {
        this.emit(eventName, event.detail)
        this.handleRealtimeEvent(eventName, event.detail || {})
      }
      this.windowHandlers.set(eventName, handler)
      window.addEventListener(`smart-event-realtime:${eventName}`, handler)
    })

    this.moveTimer = setInterval(() => {
      devices.forEach((device) => this.moveDevice(device))
    }, 2600)

    this.metricTimer = setInterval(() => {
      const activeDevices = devices.filter((device) => device.online).length
      this.emit('system-metrics', {
        cpu: 38 + Math.round(Math.random() * 28),
        memory: 48 + Math.round(Math.random() * 24),
        network: 58 + Math.round(Math.random() * 32),
        database: 18 + Math.round(Math.random() * 22),
        activeDevices,
      })
      this.emit('system-log', {
        level: Math.random() > 0.82 ? 'warning' : 'info',
        timestamp: nowLabel(),
        message: `${activeDevices}/${devices.length} devices streaming through realtime rooms`,
      })
    }, 4200)
  }

  configureFamilyGroups(groups = []) {
    groups.filter(Boolean).forEach((group, groupIndex) => {
      const familyGroupId = group._id || group.familyGroupId
      if (!familyGroupId) return

      const eventId = group.event?._id || group.event || group.eventDetails?._id || EVENT_ID
      const geofenceSettings = group.geofenceSettings || {}
      this.familyScopes.set(String(familyGroupId), {
        familyGroupId,
        eventId,
        guardianLocation: {
          latitude: geofenceSettings.guardianLocation?.latitude || GUARDIAN.latitude,
          longitude: geofenceSettings.guardianLocation?.longitude || GUARDIAN.longitude,
        },
        warningRadiusMeters: Number(geofenceSettings.warningRadiusMeters || WARNING_RADIUS_METERS),
        safeRadiusMeters: Number(geofenceSettings.safeRadiusMeters || SAFE_RADIUS_METERS),
      })

      ;(group.childMembers || []).forEach((member, memberIndex) => {
        const deviceId = member.wearableDeviceId || `SIM-${String(familyGroupId).slice(-4)}-${String(member._id || memberIndex).slice(-4)}`
        let target = devices.find((device) => device.childMemberId === member._id || device.deviceId === deviceId)
        if (!target) {
          target = {
            childMemberId: member._id,
            childName: member.name || `Child ${memberIndex + 1}`,
            deviceId,
            pathIndex: (groupIndex + memberIndex) % paths.length,
            cursor: memberIndex % paths[(groupIndex + memberIndex) % paths.length].length,
            batteryLevel: member.batteryLevel || 82,
            signalStatus: member.signalStatus || 'simulated',
          }
          devices.push(target)
        }

        Object.assign(target, {
          childMemberId: member._id,
          childName: member.name || target.childName || 'Child',
          deviceId,
          eventId,
          familyGroupId,
          paired: member.paired === true || member.deviceStatus === 'paired',
          connected: member.connected === true || member.deviceStatus === 'paired',
          online: member.connected === true,
          simulationMode: true,
          guardianLocation: this.familyScopes.get(String(familyGroupId)).guardianLocation,
          warningRadiusMeters: this.familyScopes.get(String(familyGroupId)).warningRadiusMeters,
          safeRadiusMeters: this.familyScopes.get(String(familyGroupId)).safeRadiusMeters,
          sessionId: member.deviceSessionId || target.sessionId || `sim-session-${deviceId}`,
        })
      })
    })
  }

  stop() {
    clearInterval(this.moveTimer)
    clearInterval(this.metricTimer)
    this.windowHandlers.forEach((handler, eventName) => {
      window.removeEventListener(`smart-event-realtime:${eventName}`, handler)
    })
    this.windowHandlers.clear()
    this.started = false
  }

  handleRealtimeEvent(eventName, payload) {
    if (eventName === 'DEVICE_PAIRED') {
      this.activatePairedDevice(payload)
    }

    if (eventName === 'DEVICE_DISCONNECTED') {
      this.deactivateDevice(payload)
    }

    if (eventName === 'DEVICE_STATUS_UPDATED' && payload?.status && payload.status !== 'connected') {
      this.deactivateDevice(payload)
    }

    if (eventName === 'SOS_ALERT') {
      const incident = this.recordIncident({
        ...payload,
        type: payload.type || 'SOS Alert',
        event: 'SOS_ALERT',
        severity: payload.severity || 'CRITICAL',
        source: 'sos',
        location: payload.location || 'Family safety radius',
        familyGroupId: payload.familyGroupId,
      })
      if (incident) this.emitAlert({
        ...payload,
        type: payload.type || 'SOS Alert',
        severity: payload.severity || 'CRITICAL',
        description: payload.description || 'SOS was triggered by a family member.',
        location: payload.location || 'Family safety radius',
        familyGroupId: payload.familyGroupId,
        audience: 'family',
        suppressTypedEvent: true,
      })
    }

    if (eventName === 'CROWD_HOTSPOT' || eventName === 'MEDICAL_INCIDENT') {
      this.recordIncident({
        ...payload,
        event: eventName,
        type: payload.type || (eventName === 'CROWD_HOTSPOT' ? 'Crowd Hotspot' : 'Medical Incident'),
        severity: payload.severity || 'HIGH',
        source: payload.source || 'external',
      })
    }

    if (eventName === 'CROWD_DENSITY_UPDATE') {
      ;(payload.zones || []).forEach((zone) => this.evaluateCrowdDensity(zone))
    }
  }

  activatePairedDevice(payload = {}) {
    if (!payload.deviceId || !payload.childMemberId || !payload.paired || !payload.connected || !payload.deviceSession?.sessionId) return

    const existing = devices.find((device) => device.deviceId === payload.deviceId || device.childMemberId === payload.childMemberId)
    const target = existing || {
      pathIndex: devices.length % paths.length,
      cursor: 0,
      batteryLevel: 84,
      signalStatus: 'strong',
    }

    Object.assign(target, {
      childMemberId: payload.childMemberId,
      childName: payload.childName || target.childName || 'Child',
      deviceId: payload.deviceId,
      eventId: payload.eventId || EVENT_ID,
      familyGroupId: payload.groupId || payload.familyGroupId || FAMILY_GROUP_ID,
      paired: true,
      connected: true,
      online: true,
      sessionId: payload.deviceSession.sessionId,
    })

    if (!existing) devices.push(target)
  }

  deactivateDevice(payload = {}) {
    const target = devices.find((device) => device.deviceId === payload.deviceId || device.childMemberId === payload.childMemberId)
    if (!target) return
    Object.assign(target, {
      connected: false,
      online: false,
      sessionId: null,
    })
  }

  moveDevice(device) {
    if (!SIMULATION_MODE && (!device.online || !device.paired || !device.connected || !device.sessionId)) return
    const path = paths[device.pathIndex]
    device.cursor = (device.cursor + 1) % path.length
    const [latitude, longitude] = path[device.cursor]
    device.batteryLevel = Math.max(12, device.batteryLevel - (Math.random() > 0.72 ? 1 : 0))
    device.signalStatus = Math.random() > 0.82 ? 'weak' : 'strong'
    const location = { latitude, longitude }
    const guardianLocation = device.guardianLocation || GUARDIAN
    const warningRadiusMeters = Number(device.warningRadiusMeters || WARNING_RADIUS_METERS)
    const safeRadiusMeters = Number(device.safeRadiusMeters || SAFE_RADIUS_METERS)
    const distanceMeters = metersBetween(guardianLocation, location)
    const geofenceState =
      distanceMeters > safeRadiusMeters
        ? 'breach'
        : distanceMeters > warningRadiusMeters
          ? 'warning'
          : 'safe'
    const breached = geofenceState === 'breach'

    const payload = {
      eventId: device.eventId || EVENT_ID,
      familyGroupId: device.familyGroupId || FAMILY_GROUP_ID,
      childMemberId: device.childMemberId,
      childName: device.childName,
      deviceId: device.deviceId,
      guardianLocation,
      safeRadiusMeters,
      warningRadiusMeters,
      distanceMeters,
      location,
      batteryLevel: device.batteryLevel,
      signalStatus: device.signalStatus,
      geofenceStatus: breached ? 'outside' : 'inside',
      geofenceState,
      sosActive: false,
      timestamp: new Date().toISOString(),
      deviceSession: { sessionId: device.sessionId },
      simulationMode: true,
    }

    this.emit('DEVICE_LOCATION_UPDATED', payload)
    this.emit('child-location-update', {
      childId: device.childMemberId,
      lat: latitude,
      lng: longitude,
      batteryLevel: payload.batteryLevel,
      geofenceStatus: payload.geofenceStatus,
      geofenceState,
      distanceMeters,
      zone: geofenceState === 'breach' ? 'Outside safe radius' : geofenceState === 'warning' ? 'Warning ring' : 'Safe radius',
      signalStatus: payload.signalStatus,
      timestamp: payload.timestamp,
      familyGroupId: payload.familyGroupId,
      deviceId: payload.deviceId,
      simulationMode: true,
    })

    this.emit('DEVICE_STATUS_UPDATED', {
      deviceId: device.deviceId,
      childMemberId: device.childMemberId,
      status: 'connected',
      batteryLevel: device.batteryLevel,
      signalStatus: device.signalStatus,
      lastSeenAt: payload.timestamp,
    })

    if ((geofenceState === 'warning' || geofenceState === 'breach') && device.lastGeofenceState !== geofenceState) {
      device.lastGeofenceState = geofenceState
      if (!this.cooldownReady(`geofence:${device.familyGroupId || FAMILY_GROUP_ID}:${device.deviceId}:${geofenceState}`, GEOFENCE_ALERT_COOLDOWN_MS)) return
      const eventName = geofenceState === 'breach' ? 'GEOFENCE_BREACH' : 'GEOFENCE_WARNING'
      const severity = geofenceState === 'breach' ? 'HIGH' : 'MEDIUM'
      const zone = geofenceState === 'breach' ? 'Outside safe radius' : 'Warning ring'
      const geofenceEvent = {
        _id: `sim-geofence-${geofenceState}-${Date.now()}`,
        eventId: device.eventId || EVENT_ID,
        familyGroupId: device.familyGroupId || FAMILY_GROUP_ID,
        childMemberId: device.childMemberId,
        deviceId: device.deviceId,
        type: eventName,
        status: geofenceState,
        severity,
        distanceMeters,
        safeRadiusMeters,
        warningRadiusMeters,
        guardianLocation,
        childLocation: location,
        zone,
        timestamp: new Date().toISOString(),
        simulationMode: true,
      }
      this.recordIncident({
        type: geofenceState === 'breach' ? 'Geofence Breach' : 'Geofence Warning',
        event: eventName,
        severity,
        description: `${device.childName} ${geofenceState === 'breach' ? 'breached' : 'entered'} the guardian radius ${geofenceState === 'breach' ? 'boundary' : 'warning ring'}.`,
        location: 'Family safety radius',
        coordinates: location,
        source: 'geofence',
        familyGroupId: device.familyGroupId || FAMILY_GROUP_ID,
      })
      this.emit(eventName, geofenceEvent)
      this.emit('ORGANIZER_GEOFENCE_EVENT', {
        ...geofenceEvent,
        childMemberId: undefined,
        deviceId: undefined,
        familyGroupLabel: `Family ${String(device.familyGroupId || FAMILY_GROUP_ID).slice(-4)}`,
      })
      this.emitAlert({
        type: geofenceState === 'breach' ? 'Geofence Breach' : 'Geofence Warning',
        severity,
        description: `${device.childName} moved ${Math.round(distanceMeters)}m from guardian safe zone.`,
        location: 'Family safety radius',
        familyGroupId: device.familyGroupId || FAMILY_GROUP_ID,
        audience: 'family',
      })
    }

    if (geofenceState === 'safe') device.lastGeofenceState = 'safe'
  }

  recordIncident(rawIncident) {
    const incidentKey = this.incidentKeyFor(rawIncident)
    if (!this.incidentReady(incidentKey)) return null

    const coordinates = rawIncident.coordinates || locationFor(rawIncident.location)
    const incident = {
      _id: rawIncident._id || `incident-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: rawIncident.id || rawIncident._id || `incident-${Date.now()}`,
      event: rawIncident.event || 'INCIDENT_REPORTED',
      type: rawIncident.type || 'Safety Incident',
      severity: normalizeSeverity(rawIncident.severity || 'LOW'),
      status: 'active',
      description: rawIncident.description || 'Realtime incident reported.',
      location: rawIncident.location || 'Event Grounds',
      coordinates,
      source: rawIncident.source || 'scenario',
      familyGroupId: rawIncident.familyGroupId,
      audience: rawIncident.audience,
      intensity: rawIncident.intensity || 50,
      timestamp: rawIncident.timestamp || new Date().toISOString(),
      createdAt: rawIncident.createdAt || new Date().toISOString(),
    }

    this.incidentEvents = [
      incident,
      ...this.incidentEvents.filter((item) => Date.now() - new Date(item.timestamp).getTime() < INCIDENT_WINDOW_MS),
    ].slice(0, 80)

    this.emit('incident-update', {
      id: incident.id,
      title: incident.type,
      description: incident.description,
      status: 'active',
      duration: 'Live',
      responders: severityWeight(incident.severity) + 3,
      severity: displaySeverity(incident.severity),
      zone: incident.location,
    })
    this.evaluateHotspots()
    return incident
  }

  evaluateCrowdDensity(zone) {
    const previous = this.lastDensities.get(zone.name) || zone.density
    this.lastDensities.set(zone.name, zone.density)
    const delta = zone.density - previous
    if (zone.density >= 86 || delta >= 18) {
      if (!this.cooldownReady(`crowd-density:${zone.name}`, 30 * 1000)) return
      const incident = this.recordIncident({
        event: 'CROWD_HOTSPOT',
        type: zone.density >= 88 ? 'Critical Crowd Situation' : 'Crowd Hotspot',
        severity: zone.density >= 88 ? 'CRITICAL' : 'HIGH',
        description: `${zone.name} density ${delta >= 0 ? 'rose' : 'shifted'} to ${zone.density}%.`,
        location: zone.name,
        source: 'crowd-density',
        intensity: zone.density,
      })
      if (incident?.severity === 'CRITICAL') {
        this.emit('CRITICAL_CROWD_SITUATION', incident)
        this.emitAlert({
          ...incident,
          type: 'Critical Crowd Situation',
          severity: 'CRITICAL',
          audience: 'organizer',
          scopes: ['organizer', 'monitoring'],
        })
      }
    }
  }

  evaluateHotspots() {
    const active = this.incidentEvents.filter((incident) => Date.now() - new Date(incident.timestamp).getTime() < INCIDENT_WINDOW_MS)
    const clusters = []

    active.forEach((incident) => {
      let cluster = clusters.find((item) => metersBetween(item.center, incident.coordinates) <= HOTSPOT_RADIUS_METERS)
      if (!cluster) {
        cluster = {
          id: `hotspot-${clusters.length + 1}-${incident.location.replace(/\s+/g, '-').toLowerCase()}`,
          zone: incident.location,
          center: { ...incident.coordinates },
          incidents: [],
          createdAt: new Date().toISOString(),
        }
        clusters.push(cluster)
      }
      cluster.incidents.push(incident)
      cluster.center = {
        latitude: cluster.incidents.reduce((sum, item) => sum + item.coordinates.latitude, 0) / cluster.incidents.length,
        longitude: cluster.incidents.reduce((sum, item) => sum + item.coordinates.longitude, 0) / cluster.incidents.length,
      }
    })

    const hotspots = clusters
      .filter((cluster) => cluster.incidents.length >= 2)
      .map((cluster) => {
        const geofenceCount = cluster.incidents.filter((item) => item.type.toLowerCase().includes('geofence')).length
        const sosCount = cluster.incidents.filter((item) => item.type.toLowerCase().includes('sos')).length
        const crowdCount = cluster.incidents.filter((item) => item.type.toLowerCase().includes('crowd') || item.source === 'crowd-density').length
        const maxSeverity = Math.max(...cluster.incidents.map((item) => severityWeight(item.severity)))
        const escalationWeight =
          maxSeverity +
          (cluster.incidents.length >= 3 ? 1 : 0) +
          (geofenceCount >= 2 ? 1 : 0) +
          (sosCount >= 2 ? 1 : 0) +
          (crowdCount >= 2 ? 1 : 0)
        const severity = severityFromWeight(escalationWeight)
        return {
          ...cluster,
          _id: cluster.id,
          severity,
          displaySeverity: displaySeverity(severity),
          incidentCount: cluster.incidents.length,
          geofenceCount,
          sosCount,
          crowdCount,
          radiusMeters: HOTSPOT_RADIUS_METERS + cluster.incidents.length * 45,
          riskScore: Math.min(100, 35 + cluster.incidents.length * 14 + severityWeight(severity) * 12),
          affectedSummary: `${cluster.incidents.length} incidents, ${sosCount} SOS, ${geofenceCount} geofence, ${crowdCount} crowd signals`,
          latestAt: cluster.incidents[0]?.timestamp,
          timeline: cluster.incidents.slice(0, 5).map((item) => ({
            id: item.id,
            type: item.type,
            severity: item.severity,
            timestamp: item.timestamp,
            location: item.location,
          })),
        }
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6)

    hotspots.forEach((hotspot) => {
      const existing = this.hotspots.find((item) => item.id === hotspot.id)
      const hotspotSeverityWeight = severityWeight(hotspot.severity)
      if (!existing) {
        hotspot.hotspotNotified = false
        hotspot.notifiedSeverityWeight = 0
      } else {
        hotspot.createdAt = existing.createdAt
        hotspot.hotspotNotified = Boolean(existing.hotspotNotified)
        hotspot.notifiedSeverityWeight = existing.notifiedSeverityWeight ?? severityWeight(existing.severity)
      }

      if (!hotspot.hotspotNotified && this.cooldownReady(`hotspot-created:${hotspot.id}`, HOTSPOT_COOLDOWN_MS)) {
        hotspot.hotspotNotified = true
        hotspot.notifiedSeverityWeight = Math.max(hotspot.notifiedSeverityWeight, hotspotSeverityWeight)
        this.emit('HOTSPOT_CREATED', hotspot)
        this.emitAlert({
          _id: `alert-${hotspot.id}-${Date.now()}`,
          type: 'Hotspot Created',
          severity: hotspot.severity,
          description: `${hotspot.zone} formed an escalation cluster: ${hotspot.affectedSummary}.`,
          location: hotspot.zone,
          audience: 'organizer',
          scopes: ['organizer', 'monitoring'],
        })
      }

      if (existing && hotspotSeverityWeight > hotspot.notifiedSeverityWeight) {
        if (!this.cooldownReady(`severity-escalated:${hotspot.id}:${hotspot.severity}`, ESCALATION_COOLDOWN_MS)) return
        const escalation = {
          ...hotspot,
          previousSeverity: existing.severity,
          newSeverity: hotspot.severity,
        }
        hotspot.notifiedSeverityWeight = hotspotSeverityWeight
        this.emit('SEVERITY_ESCALATED', escalation)
        this.emitAlert({
          _id: `alert-escalation-${hotspot.id}-${Date.now()}`,
          type: 'Severity Escalated',
          severity: hotspot.severity,
          description: `${hotspot.zone} escalated from ${existing.severity} to ${hotspot.severity}.`,
          location: hotspot.zone,
          audience: 'organizer',
          scopes: ['organizer', 'monitoring'],
        })
        if (hotspot.severity === 'CRITICAL') {
          this.emit('CRITICAL_CROWD_SITUATION', escalation)
        }
      }

      if (this.cooldownReady(`cluster-update:${hotspot.id}:${hotspot.incidentCount}:${hotspot.severity}`, CLUSTER_UPDATE_COOLDOWN_MS)) {
        this.emit('INCIDENT_CLUSTERED', hotspot)
      }
    })

    this.hotspots = hotspots
    this.emit('HOTSPOT_ZONES_UPDATED', {
      hotspots,
      timestamp: new Date().toISOString(),
    })
  }
}

export const realtimeSimulation = new RealtimeSimulation()
export { GUARDIAN, SAFE_RADIUS_METERS, WARNING_RADIUS_METERS, SIMULATION_MODE }
