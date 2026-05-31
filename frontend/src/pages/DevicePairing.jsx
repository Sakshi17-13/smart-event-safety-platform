import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { familyAPI } from '../api'
import { Activity, Battery, CheckCircle, Link, MapPin, Maximize2, Radio, Shield, Signal, Smartphone, Tablet, Watch, Zap } from 'lucide-react'

const DEVICE_KEY = 'smartEventDeviceIdentity'
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || window.location.origin).trim().replace(/\/+$/, '')

const deviceTypes = [
  { value: 'watch', label: 'Smart Watch', prefix: 'WATCH', icon: Watch },
  { value: 'phone', label: 'Phone', prefix: 'PHONE', icon: Smartphone },
  { value: 'tablet', label: 'Tablet', prefix: 'TAB', icon: Tablet },
]

const randomDeviceId = (type = 'watch') => {
  const option = deviceTypes.find((item) => item.value === type) || deviceTypes[0]
  return `${option.prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const boundaryLabels = {
  tracking_active: 'Tracking Active',
  near_boundary: 'Near Boundary',
  outside_event_zone: 'Outside Event Zone',
}

const metersBetween = (a = {}, b = {}) => {
  const lat1 = Number(a.latitude)
  const lon1 = Number(a.longitude)
  const lat2 = Number(b.latitude)
  const lon2 = Number(b.longitude)
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null
  const toRad = (value) => (value * Math.PI) / 180
  const earthRadiusMeters = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const resolveBoundaryState = (pairingData, location) => {
  const boundary = pairingData?.eventBoundary
  const center = boundary?.center
  const radiusMeters = Number(boundary?.radiusMeters)
  if (!center || !Number.isFinite(radiusMeters)) {
    return { state: 'tracking_active', label: boundaryLabels.tracking_active, sessionActive: true }
  }
  const distanceMeters = metersBetween(center, location)
  const threshold = Number(boundary.nearBoundaryThreshold || 0.85)
  const sessionActive = boundary.sessionActive !== false
  const outside = !sessionActive || (Number.isFinite(distanceMeters) && distanceMeters > radiusMeters)
  const near = Number.isFinite(distanceMeters) && distanceMeters >= radiusMeters * threshold
  const state = outside ? 'outside_event_zone' : near ? 'near_boundary' : 'tracking_active'
  return {
    ...boundary,
    distanceMeters,
    state,
    label: boundaryLabels[state],
    sessionActive: !outside,
    reason: outside ? 'outside_event_radius' : near ? 'near_event_boundary' : 'inside_event_radius',
  }
}

const loadIdentity = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY))
    if (saved?.deviceId) {
      return {
        ...saved,
        identities: {
          ...(saved.identities || {}),
          [saved.deviceType || 'watch']: {
            deviceType: saved.deviceType || 'watch',
            deviceId: saved.deviceId,
            deviceLabel: saved.deviceLabel || 'Device',
          },
        },
      }
    }
  } catch {
    // Ignore malformed device identity and create a fresh one.
  }
  const firstIdentity = { deviceType: 'watch', deviceId: randomDeviceId('watch'), deviceLabel: 'Child Watch' }
  return { ...firstIdentity, identities: { watch: firstIdentity } }
}

const DevicePairing = () => {
  const socketRef = useRef(null)
  const batteryRef = useRef(84)
  const signalRef = useRef('standby')
  const heartbeatRef = useRef(null)
  const geoWatchRef = useRef(null)
  const gpsPublishRef = useRef(null)
  const latestCoordsRef = useRef(null)
  const hasConnectedRef = useRef(false)
  const initialGeoRequestRef = useRef(false)
  const initialPairingParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [familyCode, setFamilyCode] = useState(initialPairingParams.get('familyCode') || '')
  const [pairCode, setPairCode] = useState(initialPairingParams.get('pairCode') || '')
  const [identity, setIdentity] = useState(loadIdentity)
  const [paired, setPaired] = useState(null)
  const [status, setStatus] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [signalStatus, setSignalStatus] = useState('standby')
  const [batteryLevel, setBatteryLevel] = useState(84)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [geolocationStatus, setGeolocationStatus] = useState('idle')
  const [boundaryState, setBoundaryState] = useState({ state: 'tracking_active', label: 'Tracking Active' })
  const [childMode, setChildMode] = useState(false)

  const selectedType = deviceTypes.find((item) => item.value === identity.deviceType) || deviceTypes[0]
  const SelectedIcon = selectedType.icon
  const gpsBlocked = geolocationStatus === 'denied' || geolocationStatus === 'unavailable'

  useEffect(() => {
    const currentIdentity = {
      deviceType: identity.deviceType,
      deviceId: identity.deviceId,
      deviceLabel: identity.deviceLabel,
    }
    localStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({
        ...currentIdentity,
        identities: {
          ...(identity.identities || {}),
          [identity.deviceType]: currentIdentity,
        },
      })
    )
  }, [identity])

  useEffect(() => {
    batteryRef.current = batteryLevel
  }, [batteryLevel])

  useEffect(() => {
    signalRef.current = signalStatus
  }, [signalStatus])

  useEffect(() => {
    const disconnect = () => {
      clearInterval(heartbeatRef.current)
      clearInterval(gpsPublishRef.current)
      if (geoWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
      socketRef.current?.disconnect()
      if (paired?.deviceId) familyAPI.disconnectDevice(paired.deviceId)
    }

    window.addEventListener('beforeunload', disconnect)
    return () => {
      window.removeEventListener('beforeunload', disconnect)
      disconnect()
    }
  }, [paired])

  const connectDeviceSocket = (pairingData) => {
    if (!pairingData?.paired || !pairingData?.connected || !pairingData?.deviceSession?.sessionId) return
    socketRef.current?.disconnect()
    clearInterval(heartbeatRef.current)
    setConnectionStatus('connecting')

    const emitHeartbeat = (socket, reconnected = false) => {
      socket.emit('DEVICE_HEARTBEAT', {
        deviceId: pairingData.deviceId,
        eventId: pairingData.eventId,
        familyGroupId: pairingData.groupId,
        childMemberId: pairingData.childMemberId,
        batteryLevel: batteryRef.current,
        signalStatus: signalRef.current,
        deviceSession: pairingData.deviceSession,
        reconnected,
      })
    }

    const socket = io(SOCKET_URL, {
      auth: {
        deviceId: pairingData.deviceId,
        familyCode: pairingData.familyCode,
      },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 8,
      reconnectionDelayMax: 10000,
    })

    socket.on('connect', () => {
      setConnectionStatus('connected')
      setSignalStatus('strong')
      const reconnected = hasConnectedRef.current || Boolean(socket.recovered)
      hasConnectedRef.current = true
      socket.emit('JOIN_DEVICE_ROOMS', {
        deviceId: pairingData.deviceId,
        eventId: pairingData.eventId,
        familyGroupId: pairingData.groupId,
        deviceSession: pairingData.deviceSession,
      })
      emitHeartbeat(socket, reconnected)
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => emitHeartbeat(socket), 15000)
    })

    socket.on('connect_error', () => {
      setConnectionStatus('local')
      setSignalStatus('strong')
      setStatus('Device paired. Local realtime stream is active while socket server is unavailable.')
    })

    socket.on('disconnect', () => {
      clearInterval(heartbeatRef.current)
      setConnectionStatus('idle')
      setSignalStatus('lost')
    })

    socket.on('JOINED_DEVICE_ROOMS', () => {
      setStatus('Device paired. Realtime rooms joined and live updates started.')
    })

    socketRef.current = socket
  }

  const stopGpsTracking = () => {
    if (geoWatchRef.current !== null) {
      navigator.geolocation?.clearWatch(geoWatchRef.current)
      geoWatchRef.current = null
    }
    clearInterval(gpsPublishRef.current)
    gpsPublishRef.current = null
    latestCoordsRef.current = null
    setSharing(false)
  }

  const publishLocation = async (pairingData, coords) => {
    if (!coords) return
    const nextBattery = Math.max(8, Math.min(100, batteryRef.current - Math.floor(Math.random() * 2)))
    const nextSignal = Math.random() > 0.85 ? 'weak' : 'strong'
    const location = { latitude: coords.latitude, longitude: coords.longitude }
    const timestamp = new Date().toISOString()
    const privacyBoundary = resolveBoundaryState(pairingData, location)
    setBoundaryState(privacyBoundary)
    const payload = {
      latitude: location.latitude,
      longitude: location.longitude,
      battery: nextBattery,
      signal: nextSignal,
      batteryLevel: nextBattery,
      signalStatus: nextSignal,
      trackingState: privacyBoundary.state,
      trackingLabel: privacyBoundary.label,
      privacyBoundary,
      sessionStatus: privacyBoundary.sessionActive ? 'active' : 'inactive',
      trackingPaused: !privacyBoundary.sessionActive,
      deviceType: identity.deviceType,
      deviceLabel: identity.deviceLabel,
      deviceSessionId: pairingData.deviceSession.sessionId,
      timestamp,
    }

    const response = await familyAPI.updateDeviceLocation(pairingData.deviceId, payload)
    const serverState = response?.data?.data
    const effectiveBoundary = serverState?.privacyBoundary || privacyBoundary
    const trackingPaused = Boolean(serverState?.trackingPaused || payload.trackingPaused)
    setBoundaryState(effectiveBoundary)
    if (trackingPaused) {
      stopGpsTracking()
      clearInterval(heartbeatRef.current)
      setConnectionStatus('idle')
      setSignalStatus('lost')
      setPaired((current) =>
        current
          ? {
              ...current,
              connected: false,
              status: 'inactive',
              eventBoundary: effectiveBoundary,
              deviceSession: { ...current.deviceSession, status: 'inactive' },
            }
          : current
      )
      socketRef.current?.emit('DEVICE_TRACKING_PAUSED', {
        deviceId: pairingData.deviceId,
        eventId: pairingData.eventId,
        familyGroupId: pairingData.groupId,
        childMemberId: pairingData.childMemberId,
        location,
        trackingState: effectiveBoundary.state,
        trackingLabel: effectiveBoundary.label,
        privacyBoundary: effectiveBoundary,
        sessionStatus: 'inactive',
        trackingPaused: true,
        timestamp,
      })
      setStatus('Outside Event Zone. Privacy-aware tracking paused and location streaming stopped.')
      return
    }
    socketRef.current?.emit('DEVICE_LOCATION_UPDATE', {
      deviceId: pairingData.deviceId,
      eventId: pairingData.eventId,
      familyGroupId: pairingData.groupId,
      memberId: pairingData.childMemberId,
      childMemberId: pairingData.childMemberId,
      latitude: location.latitude,
      longitude: location.longitude,
      location,
      battery: payload.battery,
      signal: payload.signal,
      batteryLevel: payload.batteryLevel,
      signalStatus: payload.signalStatus,
      trackingState: effectiveBoundary.state,
      trackingLabel: effectiveBoundary.label,
      privacyBoundary: effectiveBoundary,
      sessionStatus: 'active',
      trackingPaused: false,
      deviceSession: pairingData.deviceSession,
      timestamp,
    })

    setBatteryLevel(nextBattery)
    setSignalStatus(nextSignal)
    setLastUpdate(new Date().toLocaleTimeString())
    if (effectiveBoundary.state === 'near_boundary') {
      setStatus('Near Boundary. Temporary event tracking is still active inside the festival radius.')
    } else {
      setStatus('Tracking Active. Location sharing is limited to this active event zone.')
    }
  }

  const startGpsTracking = (pairingData) => {
    if (!pairingData?.deviceId || !pairingData?.paired || !pairingData?.connected || !pairingData?.deviceSession?.sessionId) return
    if (!navigator.geolocation) {
      stopGpsTracking()
      setGeolocationStatus('unavailable')
      setSignalStatus('lost')
      setStatus('Browser GPS is unavailable. Realtime tracking is disabled for this device.')
      return
    }

    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current)
      geoWatchRef.current = null
    }
    clearInterval(gpsPublishRef.current)
    gpsPublishRef.current = null
    latestCoordsRef.current = null

    setGeolocationStatus('requesting')
    setStatus('Requesting browser GPS permission for realtime tracking...')
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestCoordsRef.current = position.coords
        setGeolocationStatus('granted')
        setSharing(true)
        setStatus('GPS permission granted. Realtime tracking is active.')
        if (!gpsPublishRef.current) {
          publishLocation(pairingData, latestCoordsRef.current).catch(() => {
            setStatus('Unable to publish GPS update. Retrying on next location tick.')
          })
          gpsPublishRef.current = setInterval(() => {
            publishLocation(pairingData, latestCoordsRef.current).catch(() => {
              setStatus('Unable to publish GPS update. Retrying on next location tick.')
            })
          }, 2500)
        }
      },
      (error) => {
        stopGpsTracking()
        setSignalStatus('lost')
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationStatus('denied')
          setStatus('Location permission denied. Realtime tracking is disabled until browser GPS access is allowed.')
          return
        }
        setGeolocationStatus('unavailable')
        setStatus('Device GPS is unavailable. Realtime tracking is disabled until location is available.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (initialGeoRequestRef.current) return undefined
    initialGeoRequestRef.current = true

    if (!navigator.geolocation) {
      setGeolocationStatus('unavailable')
      setSignalStatus('lost')
      setStatus('Browser GPS is unavailable. Realtime tracking is disabled for this device.')
      return undefined
    }

    setGeolocationStatus('requesting')
    setStatus('Requesting browser GPS permission for realtime tracking...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latestCoordsRef.current = position.coords
        setGeolocationStatus('granted')
        setStatus(paired ? 'GPS permission granted. Realtime tracking is active.' : 'GPS permission granted. Pair device to start realtime tracking.')
        if (paired) startGpsTracking(paired)
      },
      (error) => {
        setSignalStatus('lost')
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationStatus('denied')
          setStatus('Location permission denied. Realtime tracking is disabled until browser GPS access is allowed.')
          return
        }
        setGeolocationStatus('unavailable')
        setStatus('Device GPS is unavailable. Realtime tracking is disabled until location is available.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )

    return undefined
  }, [])

  useEffect(() => () => {
    clearInterval(heartbeatRef.current)
    clearInterval(gpsPublishRef.current)
    if (geoWatchRef.current !== null) navigator.geolocation?.clearWatch(geoWatchRef.current)
  }, [])

  const canPair = useMemo(
    () => familyCode.trim().length >= 4 && pairCode.trim().length >= 4 && identity.deviceId.trim().length >= 4,
    [familyCode, pairCode, identity.deviceId]
  )

  const updateDeviceType = (deviceType) => {
    const type = deviceTypes.find((item) => item.value === deviceType) || deviceTypes[0]
    const savedForType = identity.identities?.[deviceType]
    const nextIdentity = savedForType || {
      deviceType,
      deviceId: randomDeviceId(deviceType),
      deviceLabel: type.label,
    }
    setIdentity({
      ...nextIdentity,
      identities: {
        ...(identity.identities || {}),
        [identity.deviceType]: {
          deviceType: identity.deviceType,
          deviceId: identity.deviceId,
          deviceLabel: identity.deviceLabel,
        },
        [deviceType]: nextIdentity,
      },
    })
    setPaired(null)
    setBoundaryState({ state: 'tracking_active', label: 'Tracking Active' })
    stopGpsTracking()
    setGeolocationStatus('idle')
    setConnectionStatus('idle')
    setSignalStatus('standby')
  }

  const confirmPairing = async () => {
    setStatus('')
    try {
      const response = await familyAPI.confirmPairing({
        familyCode: familyCode.trim().toUpperCase(),
        pairCode: pairCode.trim().toUpperCase(),
        deviceId: identity.deviceId,
        deviceType: identity.deviceType,
        deviceLabel: identity.deviceLabel,
      })
      const pairingData = response.data.data
      if (!pairingData?.paired || !pairingData?.connected || !pairingData?.deviceSession?.sessionId) {
        throw new Error('Device session was not created. Recheck the pair code and try again.')
      }
      setPaired(pairingData)
      setBoundaryState(pairingData.eventBoundary || { state: 'tracking_active', label: 'Tracking Active' })
      setConnectionStatus('local')
      connectDeviceSocket(pairingData)
      startGpsTracking(pairingData)
    } catch (error) {
      setStatus(error.response?.data?.message || error.message || 'Pairing failed')
      setConnectionStatus('idle')
    }
  }

  const triggerSOS = async () => {
    if (!paired?.deviceId || !paired?.paired || !paired?.connected || !paired?.deviceSession?.sessionId) return
    if (!navigator.geolocation) {
      setStatus('Browser GPS is unavailable. SOS needs device geolocation.')
      return
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude }
    const payload = {
      latitude: location.latitude,
      longitude: location.longitude,
      batteryLevel,
      geofenceStatus: 'outside',
      geofenceState: 'breach',
      zone: 'Outside safe radius',
      signalStatus,
      sosActive: true,
      deviceType: identity.deviceType,
      deviceLabel: identity.deviceLabel,
      deviceSessionId: paired.deviceSession.sessionId,
    }
    await familyAPI.updateDeviceLocation(paired.deviceId, payload)
    socketRef.current?.emit('DEVICE_LOCATION_UPDATE', {
      deviceId: paired.deviceId,
      eventId: paired.eventId,
      familyGroupId: paired.groupId,
      childMemberId: paired.childMemberId,
      location,
      batteryLevel,
      signalStatus,
      geofenceStatus: 'outside',
      geofenceState: 'breach',
      zone: payload.zone,
      sosActive: true,
      deviceSession: paired.deviceSession,
    })
    setStatus('SOS signal sent from simulated device.')
    }, () => setStatus('Waiting for device GPS before sending SOS.'), { enableHighAccuracy: true, timeout: 3000 })
  }

  const toggleSharing = () => {
    if (sharing) {
      stopGpsTracking()
      if (paired?.deviceId) familyAPI.disconnectDevice(paired.deviceId)
      setConnectionStatus('idle')
      setSignalStatus('lost')
      setStatus('Realtime GPS tracking paused.')
    } else if (paired) {
      if (geolocationStatus === 'denied' || geolocationStatus === 'unavailable') {
        setStatus('Realtime tracking is disabled until browser GPS permission is available.')
        return
      }
      startGpsTracking(paired)
      setConnectionStatus(socketRef.current?.connected ? 'connected' : 'local')
      setSignalStatus('strong')
    }
  }

  const connectionLabel =
    geolocationStatus === 'denied'
      ? 'GPS Denied'
      : geolocationStatus === 'unavailable'
        ? 'GPS Blocked'
        : geolocationStatus === 'requesting'
          ? 'GPS Permission'
          :
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'local'
        ? 'Local Live'
        : connectionStatus === 'connecting'
          ? 'Pairing'
          : 'Disconnected'
  const signalColor = signalStatus === 'strong' ? 'text-success' : signalStatus === 'weak' ? 'text-warning' : 'text-danger'
  const boundaryStyle =
    boundaryState.state === 'outside_event_zone'
      ? 'bg-danger/10 border-danger/35 text-danger'
      : boundaryState.state === 'near_boundary'
        ? 'bg-warning/10 border-warning/35 text-warning'
        : 'bg-success/10 border-success/35 text-success'

  if (childMode) {
    return (
      <div className="min-h-screen bg-background cyber-grid p-3 sm:p-6 wearable-shell">
        <div className="mx-auto max-w-md min-h-[calc(100vh-1.5rem)] flex flex-col justify-between gap-4">
          <div className="glass rounded-2xl p-4 border-glow">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${sharing ? 'bg-success/20 text-success' : 'bg-surfaceLight text-text-muted'}`}>
                  <SelectedIcon size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-muted">Child Device</p>
                  <h1 className="text-xl font-bold text-text-primary truncate">{paired?.childName || identity.deviceLabel}</h1>
                </div>
              </div>
              <button
                onClick={() => setChildMode(false)}
                className="touch-target rounded-xl bg-surfaceLight border border-border text-text-secondary"
                title="Exit child mode"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>

          <div className="glass rounded-[28px] p-5 border-glow text-center wearable-card">
            <button
              onClick={triggerSOS}
              disabled={!paired || gpsBlocked}
              className={`mx-auto w-48 h-48 max-[380px]:w-36 max-[380px]:h-36 rounded-full flex flex-col items-center justify-center gap-3 text-white shadow-lg transition-all ${
                paired && !gpsBlocked ? 'bg-gradient-to-br from-danger to-red-700 critical-flash active:scale-95' : 'bg-surfaceLight text-text-muted'
              }`}
            >
              <Zap size={52} />
              <span className="text-3xl max-[380px]:text-2xl font-black tracking-wide">SOS</span>
            </button>
            <p className="mt-5 text-sm text-text-secondary">
              {paired ? (gpsBlocked ? 'GPS permission required' : sharing ? 'Tracking active' : 'Tracking paused') : 'Pair device before SOS'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-3 border-glow text-center">
              <Battery className={batteryLevel > 25 ? 'text-success mx-auto' : 'text-warning mx-auto'} size={22} />
              <p className="text-lg font-bold text-text-primary mt-2">{batteryLevel}%</p>
              <p className="text-[11px] text-text-muted">Battery</p>
            </div>
            <div className="glass rounded-2xl p-3 border-glow text-center">
              <Signal className={`${signalColor} mx-auto`} size={22} />
              <p className="text-lg font-bold text-text-primary mt-2 capitalize">{signalStatus}</p>
              <p className="text-[11px] text-text-muted">Signal</p>
            </div>
            <div className="glass rounded-2xl p-3 border-glow text-center">
              <Shield className={sharing ? 'text-success mx-auto' : 'text-text-muted mx-auto'} size={22} />
              <p className="text-lg font-bold text-text-primary mt-2">{gpsBlocked ? 'Blocked' : sharing ? 'On' : 'Off'}</p>
              <p className="text-[11px] text-text-muted">GPS</p>
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-center ${boundaryStyle}`}>
            <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Event Privacy Boundary</p>
            <p className="text-lg font-black mt-1">{boundaryState.label || boundaryLabels[boundaryState.state] || 'Tracking Active'}</p>
            <p className="text-xs mt-1 opacity-80">
              {Number.isFinite(boundaryState.distanceMeters) && Number.isFinite(boundaryState.radiusMeters)
                ? `${Math.round(boundaryState.distanceMeters)}m of ${Math.round(boundaryState.radiusMeters)}m event radius`
                : 'Temporary tracking only runs inside the active event zone'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-2">
            <button
              onClick={toggleSharing}
              disabled={!paired || gpsBlocked}
              className="touch-target rounded-2xl bg-primary/20 text-primary border border-primary/30 disabled:opacity-50"
            >
              {sharing ? 'Pause' : 'Track'}
            </button>
            <div className={`touch-target rounded-2xl border flex items-center justify-center gap-2 ${['connected', 'local'].includes(connectionStatus) ? 'bg-success/10 border-success/40 text-success' : 'bg-surfaceLight border-border text-text-secondary'}`}>
              <Radio size={16} />
              <span className="text-sm font-medium">{connectionLabel}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background cyber-grid p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary text-glow">Device Pairing</h1>
            <p className="text-text-muted mt-1">Link this browser session as a persistent device and begin realtime tracking.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setChildMode(true)}
              className="touch-target rounded-xl bg-danger/15 border border-danger/30 text-danger flex items-center gap-2 px-4"
            >
              <Zap size={17} />
              Child Mode
            </button>
            <div className={`touch-target px-4 rounded-xl border flex items-center gap-2 ${['connected', 'local'].includes(connectionStatus) ? 'bg-success/10 border-success/40 text-success' : 'bg-surfaceLight border-border text-text-secondary'}`}>
              <Radio size={18} />
              <span className="text-sm font-medium">{connectionLabel}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="glass rounded-2xl p-4 sm:p-6 border-glow space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <SelectedIcon className="text-primary" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">Device Link Console</h2>
                <p className="text-sm text-text-muted">Family code is permanent. Pair code expires in 5 minutes and works once.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {deviceTypes.map((type) => {
                const TypeIcon = type.icon
                const active = identity.deviceType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateDeviceType(type.value)}
                    className={`touch-target flex-col sm:flex-row sm:justify-start gap-2 sm:gap-3 px-2 sm:px-4 rounded-xl border transition-all ${active ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-surfaceLight border-border text-text-secondary hover:border-primary'}`}
                  >
                    <TypeIcon size={18} />
                    <span className="font-medium text-xs sm:text-base text-center">{type.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Family Code</label>
                <input
                  value={familyCode}
                  onChange={(event) => setFamilyCode(event.target.value.toUpperCase())}
                  className="w-full min-h-[48px] px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="FAM12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Pair Code</label>
                <input
                  value={pairCode}
                  onChange={(event) => setPairCode(event.target.value.toUpperCase())}
                  className="w-full min-h-[48px] px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="6-digit code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Device ID</label>
                <input
                  value={identity.deviceId}
                  readOnly
                  className="w-full min-h-[48px] px-4 py-3 bg-surface border border-border rounded-lg text-text-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Device Label</label>
                <input
                  value={identity.deviceLabel}
                  onChange={(event) =>
                    setIdentity((current) => ({
                      ...current,
                      deviceLabel: event.target.value,
                      identities: {
                        ...(current.identities || {}),
                        [current.deviceType]: {
                          deviceType: current.deviceType,
                          deviceId: current.deviceId,
                          deviceLabel: event.target.value,
                        },
                      },
                    }))
                  }
                  className="w-full min-h-[48px] px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                  placeholder="Child watch"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={confirmPairing}
                disabled={!canPair}
                className="touch-target justify-center gap-2 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-lg disabled:opacity-50"
              >
                <Link size={18} />
                Confirm Pairing
              </button>
              <button
                onClick={toggleSharing}
                disabled={!paired || gpsBlocked}
                className="touch-target justify-center gap-2 px-4 bg-surfaceLight border border-border text-text-primary rounded-lg disabled:opacity-50"
              >
                <Activity size={18} />
                {sharing ? 'Pause Stream' : 'Resume Stream'}
              </button>
              <button
                onClick={triggerSOS}
                disabled={!paired || gpsBlocked}
                className="touch-target justify-center gap-2 px-4 bg-danger/20 text-danger rounded-lg disabled:opacity-50"
              >
                <Zap size={18} />
                SOS
              </button>
            </div>

            {status && <div className="p-3 rounded-lg bg-primary/10 text-primary border border-primary/30">{status}</div>}
            <div className={`p-3 rounded-lg border ${boundaryStyle}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-80">Event Privacy Boundary</p>
                  <p className="font-bold">{boundaryState.label || boundaryLabels[boundaryState.state] || 'Tracking Active'}</p>
                </div>
                <Shield size={20} />
              </div>
              <p className="text-xs mt-2 opacity-80">
                {Number.isFinite(boundaryState.distanceMeters) && Number.isFinite(boundaryState.radiusMeters)
                  ? `${Math.round(boundaryState.distanceMeters)}m from event center / ${Math.round(boundaryState.radiusMeters)}m allowed`
                  : 'Location sharing is temporary and event-scoped.'}
              </p>
            </div>
            {gpsBlocked && (
              <div className="p-3 rounded-lg bg-danger/10 text-danger border border-danger/30">
                Browser location access is required for realtime tracking. Allow location permission for this site, then pair or reload the device session.
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4 sm:p-6 border-glow space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">Linked Identity</h2>
              <CheckCircle className={paired ? 'text-success' : 'text-text-muted'} size={24} />
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-surfaceLight border border-border">
                <p className="text-xs text-text-muted">Linked Family</p>
                <p className="text-lg font-semibold text-text-primary">{paired?.familyName || 'Not paired'}</p>
                <p className="text-xs text-primary mt-1">{paired?.familyCode || 'Awaiting family code'}</p>
              </div>
              <div className="p-4 rounded-xl bg-surfaceLight border border-border">
                <p className="text-xs text-text-muted">Linked Event</p>
                <p className="text-lg font-semibold text-text-primary">{paired?.eventId || 'No event linked'}</p>
              </div>
              <div className="p-4 rounded-xl bg-surfaceLight border border-border">
                <p className="text-xs text-text-muted">Assigned Member</p>
                <p className="text-lg font-semibold text-text-primary">{paired?.childName || 'Pending confirmation'}</p>
                <p className="text-xs text-text-muted mt-1">{paired?.deviceLabel || identity.deviceLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass rounded-xl p-5 border-glow">
            <Battery className={batteryLevel > 25 ? 'text-success' : 'text-warning'} />
            <p className="text-sm text-text-muted mt-3">Battery</p>
            <p className="text-xl font-bold text-text-primary">{batteryLevel}%</p>
          </div>
          <div className="glass rounded-xl p-5 border-glow">
            <Signal className={signalColor} />
            <p className="text-sm text-text-muted mt-3">Signal</p>
            <p className="text-xl font-bold text-text-primary capitalize">{signalStatus}</p>
          </div>
          <div className="glass rounded-xl p-5 border-glow">
            <MapPin className="text-primary" />
            <p className="text-sm text-text-muted mt-3">Last Update</p>
            <p className="text-xl font-bold text-text-primary">{lastUpdate || '-'}</p>
          </div>
          <div className="glass rounded-xl p-5 border-glow">
            <Shield className={sharing ? 'text-success' : 'text-text-muted'} />
            <p className="text-sm text-text-muted mt-3">Geolocation</p>
            <p className="text-xl font-bold text-text-primary">{sharing ? 'Streaming' : 'Paused'}</p>
          </div>
          <div className={`glass rounded-xl p-5 border ${boundaryStyle}`}>
            <Shield />
            <p className="text-sm mt-3 opacity-80">Privacy Boundary</p>
            <p className="text-xl font-bold">{boundaryState.label || boundaryLabels[boundaryState.state] || 'Tracking Active'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevicePairing
