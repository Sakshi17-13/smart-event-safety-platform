import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { familyAPI } from '../api'
import { GUARDIAN, SAFE_RADIUS_METERS, SIMULATION_MODE } from '../services/realtimeSimulation'
import LiveActivityFeed from '../components/LiveActivityFeed'
import AnimatedNumber from '../components/AnimatedNumber'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet'
import { DivIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  Navigation,
  Shield,
  AlertTriangle,
  Phone,
  MessageCircle,
  User,
  Users,
  Clock,
  Route,
  Settings,
  Bell,
  CheckCircle,
  XCircle,
  Zap,
  Watch,
  Battery,
  Signal,
  Radio,
  QrCode,
  Smartphone,
  Wifi,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react'

// Custom marker icons
const createCustomIcon = (color, isPulse = false, variant = 'member') => {
  const isGuardian = variant === 'guardian'
  return new DivIcon({
    className: 'custom-marker family-live-marker',
    html: `
      <div class="family-marker-shell ${isPulse ? 'is-live' : ''} ${isGuardian ? 'is-guardian' : ''}" style="--marker-color: ${color};">
        ${isPulse ? `
          <div class="family-marker-pulse"></div>
          <div class="family-marker-ring"></div>
        ` : ''}
        <div class="family-marker-core"></div>
        <div class="family-marker-dot"></div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
  })
}

const formatRelativeTime = (timestamp, fallback = 'Not Connected') => {
  if (!timestamp) return fallback
  const time = new Date(timestamp).getTime()
  if (!Number.isFinite(time)) return fallback
  const ageSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (ageSeconds < 2) return 'Live'
  if (ageSeconds < 6) return 'Just now'
  if (ageSeconds < 60) return `${ageSeconds} sec ago`
  return `${Math.floor(ageSeconds / 60)} min ago`
}

const hasActiveTrackingLocation = (child) =>
  Boolean(
    child?.isPaired &&
    child?.position?.every(Number.isFinite) &&
    !child?.trackingPaused &&
    child?.trackingState !== 'outside_event_zone'
  )

const formatTrackingDistance = (child) => {
  if (!hasActiveTrackingLocation(child)) return 'Location unavailable'
  if (Number.isFinite(child.distanceMeters)) return `${Math.round(child.distanceMeters)}m away`
  return 'Awaiting live location'
}

const hasRealDeviceCoordinates = (member) => {
  const coordinates = member?.lastLocation?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false
  const [longitude, latitude] = coordinates.map(Number)
  if (![longitude, latitude].every(Number.isFinite)) return false
  if (longitude === 0 && latitude === 0) return false
  return true
}

const ChildCard = ({ child, onSelect, onSOS }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, scale: 1.012 }}
    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    className={`glass rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all relative overflow-hidden shadow-[0_14px_42px_rgba(0,0,0,0.14)] ${
      child.selected ? 'border-primary shadow-[0_0_28px_rgba(59,130,246,0.2)]' : 'border-border hover:border-primary/35 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]'
    }`}
    onClick={() => onSelect(child)}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    <div className={`absolute -right-16 -top-16 h-32 w-32 rounded-full blur-3xl ${
      child.status === 'safe' ? 'bg-success/10' : child.status === 'warning' ? 'bg-warning/10' : child.status === 'danger' ? 'bg-danger/10' : 'bg-primary/10'
    }`} />
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-[0_0_22px_rgba(59,130,246,0.28)] ${
          child.status === 'safe' ? 'ring-2 ring-success/40' : child.status === 'warning' ? 'ring-2 ring-warning/50' : child.status === 'danger' ? 'ring-2 ring-danger/60' : ''
        }`}>
          {child.name.charAt(0)}
          {child.isPaired && (
            <span className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2 border-background shadow-[0_0_18px_currentColor] ${
              child.status === 'safe' ? 'bg-success' : child.status === 'warning' ? 'bg-warning' : child.status === 'danger' ? 'bg-danger' : 'bg-text-muted'
            } animate-pulse`} />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-text-primary leading-tight truncate">{child.name}</h3>
          <p className="text-xs text-text-muted mt-1">
            {child.age} years old - {child.memberRole}
          </p>
          <p className="text-[11px] text-primary mt-1 uppercase tracking-[0.18em]">{child.connectionStatus}</p>
        </div>
      </div>
      <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
        child.status === 'safe' ? 'bg-success/20 text-success' :
        child.status === 'warning' ? 'bg-warning/20 text-warning' :
        child.status === 'danger' ? 'bg-danger/20 text-danger' :
        'bg-surfaceLight text-text-muted'
      }`}>
        {child.status === 'safe' && <CheckCircle size={12} />}
        {child.status === 'warning' && <AlertTriangle size={12} />}
        {child.status === 'danger' && <XCircle size={12} />}
        {child.status === 'offline' && <XCircle size={12} />}
        <span className="capitalize">{child.status === 'offline' ? 'Offline' : child.status}</span>
      </div>
    </div>

    <div className={`mb-3 px-3 py-3 rounded-xl border ${child.deviceState.panel}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Watch size={16} className="text-primary shrink-0" />
            <span className="truncate">{child.deviceLabel}</span>
          </div>
          <p className="text-xs text-text-muted mt-1 capitalize">
            {child.deviceType} - {child.connectionStatus}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-medium ${child.deviceState.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${child.deviceState.dot}`} />
          {child.deviceState.label}
        </span>
      </div>
      <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${trackingBoundaryClass(child.trackingState)}`}>
        <Shield size={12} />
        {trackingBoundaryLabel(child.trackingState)}
      </div>
      {child.trackingState === 'outside_event_zone' && (
        <p className="mt-2 text-xs text-danger/90">
          Event-scoped tracking is paused until this device returns inside the active festival radius.
        </p>
      )}
    </div>

    {child.isPaired && child.position && (
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 rounded-lg bg-surfaceLight/70 px-2 py-2 text-sm text-text-secondary">
          <MapPin size={14} />
          <span>{formatTrackingDistance(child)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surfaceLight/70 px-2 py-2 text-sm text-text-secondary">
          <Clock size={14} />
          <span>{child.lastSeen}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surfaceLight/70 px-2 py-2 text-sm text-text-secondary">
          <Battery size={14} />
          <span>{child.batteryLevel ?? '-'}%</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surfaceLight/70 px-2 py-2 text-sm text-text-secondary">
          <Signal size={14} />
          <span className="capitalize">{child.signalStatus || 'standby'}</span>
        </div>
      </div>
    )}

    {child.isPaired && !child.position && (
      <div className="mb-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
        Awaiting live location
      </div>
    )}

    {child.isPaired && child.position && (
      <div className={`mb-3 px-3 py-2 rounded-lg text-xs border ${
        child.geofenceState === 'breach'
          ? 'bg-danger/10 text-danger border-danger/30'
          : child.geofenceState === 'warning'
            ? 'bg-warning/10 text-warning border-warning/30'
            : 'bg-success/10 text-success border-success/30'
      }`}>
        {child.zone || 'Safe radius'} - {child.geofenceState || 'safe'}
      </div>
    )}

    <div className="grid grid-cols-3 gap-2">
      <button className="touch-target flex items-center justify-center gap-2 px-2 sm:px-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors text-sm">
        <Phone size={14} />
        <span className="hidden sm:inline">Call</span>
      </button>
      <button className="touch-target flex items-center justify-center gap-2 px-2 sm:px-3 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm">
        <MessageCircle size={14} />
        <span className="hidden sm:inline">Message</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSOS(child)
        }}
        className="touch-target flex items-center justify-center gap-2 px-2 sm:px-3 bg-danger/20 text-danger rounded-lg hover:bg-danger/30 transition-colors text-sm"
      >
        <Zap size={14} />
        SOS
      </button>
    </div>
  </motion.div>
)

const GeofencePanel = ({ geofences, onAdd, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="glass rounded-2xl p-6 border-glow"
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
        <Shield className="text-primary" size={20} />
        Geofence Zones
      </h3>
      <button
        onClick={onAdd}
        className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
      >
        <Settings size={18} />
      </button>
    </div>

    <div className="space-y-3">
      {geofences.map((fence, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-surfaceLight border border-border"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium text-text-primary">{fence.name}</h4>
              <p className="text-xs text-text-muted mt-1">{fence.address}</p>
            </div>
            <button
              onClick={() => onRemove(index)}
              className="p-1 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
            >
              <XCircle size={16} />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Radius: {fence.radius}m</span>
            <span className={`px-2 py-1 rounded ${fence.active ? 'bg-success/20 text-success' : 'bg-surface text-text-muted'}`}>
              {fence.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
)

const SOSButton = ({ onPress, isActive }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onPress}
    className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center shadow-lg ${
      isActive ? 'bg-danger animate-pulse' : 'bg-gradient-to-br from-danger to-red-600'
    }`}
  >
    <Zap size={32} className="text-white" />
  </motion.button>
)

const BatteryMeter = ({ value }) => {
  const level = Math.max(0, Math.min(100, Number(value) || 0))
  const tone = level > 60 ? 'bg-success' : level > 25 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="flex items-center gap-2">
      <Battery size={14} className="text-text-muted" />
      <div className="h-2 w-14 rounded-full bg-background border border-border overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${level}%` }} />
      </div>
      <span>{Number.isFinite(Number(value)) ? `${Math.round(level)}%` : '-%'}</span>
    </div>
  )
}

const SignalBars = ({ status }) => {
  const normalized = String(status || '').toLowerCase()
  const bars = normalized.includes('strong') || normalized.includes('live') || normalized.includes('connected') ? 4 : normalized.includes('weak') ? 2 : normalized.includes('offline') ? 1 : 3

  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-1 rounded-full ${bar <= bars ? 'bg-primary' : 'bg-border'}`}
          style={{ height: `${bar * 3 + 3}px` }}
        />
      ))}
    </div>
  )
}

const metersBetween = (a, b) => {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const devicesForMember = (member) => {
  if (Array.isArray(member.devices)) return member.devices
  if (!member.wearableDeviceId) return []
  const connected = member.connected === true || ['paired', 'connected'].includes(member.deviceStatus)
  return [
    {
      deviceId: member.wearableDeviceId,
      deviceType: member.deviceType || 'watch',
      label: member.deviceLabel || member.wearableDeviceId,
      status: connected ? 'connected' : member.deviceStatus || 'disconnected',
      paired: member.paired === true || connected,
      connected,
      batteryLevel: member.batteryLevel,
      signalStatus: member.signalStatus || 'standby',
      lastSeenAt: member.lastSeenAt,
      lastLocation: member.lastLocation,
    },
  ]
}

const hasPairedDevice = (member) =>
  devicesForMember(member).some(
    (device) => device.deviceId && (device.connected === true || device.status === 'connected')
  )

const geofenceStateFromDistance = (distanceMeters, geofenceStatus, warningRadiusMeters = 130, safeRadiusMeters = SAFE_RADIUS_METERS) => {
  if (geofenceStatus === 'outside') return 'breach'
  if (!Number.isFinite(distanceMeters)) return undefined
  if (distanceMeters > Number(safeRadiusMeters || SAFE_RADIUS_METERS)) return 'breach'
  if (distanceMeters > Number(warningRadiusMeters || 130)) return 'warning'
  return 'safe'
}

const zoneFromGeofenceState = (geofenceState) =>
  geofenceState === 'breach'
    ? 'Outside safe radius'
    : geofenceState === 'warning'
      ? 'Warning ring'
      : geofenceState === 'safe'
        ? 'Safe radius'
        : undefined

const trackingBoundaryLabel = (state) =>
  state === 'outside_event_zone'
    ? 'Outside Event Zone'
    : state === 'near_boundary'
      ? 'Near Boundary'
      : 'Tracking Active'

const trackingBoundaryClass = (state) =>
  state === 'outside_event_zone'
    ? 'bg-danger/15 text-danger border-danger/35'
    : state === 'near_boundary'
      ? 'bg-warning/15 text-warning border-warning/35'
      : 'bg-success/15 text-success border-success/35'

const displayNameForUser = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Primary Guardian'

const formatLastSeen = (timestamp) => formatRelativeTime(timestamp)

const deviceStateFor = ({ device, member, child }) => {
  const trackingState = child?.trackingState || member?.trackingState || device?.trackingState
  if (trackingState === 'outside_event_zone' || child?.trackingPaused || member?.trackingPaused || device?.trackingPaused) {
    return {
      key: 'outside-event-zone',
      label: 'Outside Event Zone',
      dot: 'bg-danger',
      badge: 'bg-danger/15 text-danger border-danger/30',
      panel: 'border-danger/30 bg-danger/5',
      glow: '',
    }
  }

  if (!device?.deviceId) {
    return {
      key: 'pairing-required',
      label: 'Pairing Required',
      dot: 'bg-warning',
      badge: 'bg-warning/15 text-warning border-warning/30',
      panel: 'border-warning/30 bg-warning/5',
      glow: '',
    }
  }

  const connected = device.connected === true || device.status === 'connected' || (member?.connected !== false && ['paired', 'connected'].includes(member?.deviceStatus))
  const hasLiveLocation = Boolean(device.lastLocation || member?.lastLocation || child?.position)

  if (connected && hasLiveLocation) {
    if (trackingState === 'near_boundary') {
      return {
        key: 'near-boundary',
        label: 'Near Boundary',
        dot: 'bg-warning animate-pulse',
        badge: 'bg-warning/15 text-warning border-warning/35',
        panel: 'border-warning/35 bg-warning/5 shadow-[0_0_22px_rgba(245,158,11,0.14)]',
        glow: '',
      }
    }

    return {
      key: 'tracking-live',
      label: 'Tracking Live',
      dot: 'bg-success animate-pulse',
      badge: 'bg-success/20 text-success border-success/40',
      panel: 'border-success/50 bg-success/5 shadow-[0_0_26px_rgba(16,185,129,0.16)]',
      glow: 'tracking-live-glow',
    }
  }

  if (connected) {
    return {
      key: 'connected',
      label: 'Connected',
      dot: 'bg-primary animate-pulse',
      badge: 'bg-primary/20 text-primary border-primary/35',
      panel: 'border-primary/35 bg-primary/5',
      glow: '',
    }
  }

  return {
    key: 'offline',
    label: 'Offline',
    dot: 'bg-danger',
    badge: 'bg-danger/15 text-danger border-danger/30',
    panel: 'border-danger/30 bg-danger/5',
    glow: '',
  }
}

const familyTimelineEvents = new Set([
  'FAMILY_GROUP_CREATED',
  'FAMILY_GROUP_UPDATED',
  'FAMILY_GROUP_DELETED',
  'JOINED_FAMILY',
  'USER_JOINED_FAMILY',
  'FAMILY_REGISTERED',
  'FAMILY_MEMBER_ADDED',
  'FAMILY_MEMBER_UPDATED',
  'FAMILY_MEMBER_REMOVED',
  'DEVICE_PAIRED',
  'DEVICE_STATUS_UPDATED',
  'DEVICE_DISCONNECTED',
  'DEVICE_TRACKING_PAUSED',
  'DEVICE_RECONNECTED',
  'DEVICE_LOCATION_UPDATED',
  'TRACKING_PRIVACY_BOUNDARY',
  'GEOFENCE_ACTIVATED',
  'GEOFENCE_WARNING',
  'GEOFENCE_BREACH',
  'new-alert',
  'SOS_ALERT',
])

const FamilyDashboard = () => {
  const { isConnected, emit, on, off } = useSocket()
  const { user, loading: authLoading } = useAuth()
  const breachedChildren = useRef(new Set())
  const createFamilyRequestRef = useRef(null)
  const pairingExpiryTimerRef = useRef(null)
  const [selectedChild, setSelectedChild] = useState(null)
  const [sosActive, setSOSActive] = useState(false)
  const [showGeofencePanel, setShowGeofencePanel] = useState(false)
  const [familyGroups, setFamilyGroups] = useState([])
  const [isLoadingFamilyGroups, setIsLoadingFamilyGroups] = useState(true)
  const [isCreatingFamilyGroup, setIsCreatingFamilyGroup] = useState(false)
  const [deletingChildId, setDeletingChildId] = useState(null)
  const [deletingGuardianId, setDeletingGuardianId] = useState(null)
  const [isDeletingFamilyGroup, setIsDeletingFamilyGroup] = useState(false)
  const [familyActionMessage, setFamilyActionMessage] = useState(null)
  const [pairing, setPairing] = useState(null)
  const [children, setChildren] = useState([])
  const [liveClock, setLiveClock] = useState(Date.now())
  const [childForm, setChildForm] = useState({ name: '', age: '', relationship: 'child', deviceLabel: '' })
  const [guardianForm, setGuardianForm] = useState({ name: '', relationship: 'guardian', phone: '' })
  const [editingChildId, setEditingChildId] = useState(null)
  const [editingGuardianId, setEditingGuardianId] = useState(null)
  const [geofenceForm, setGeofenceForm] = useState({ warningRadiusMeters: 130, safeRadiusMeters: 170 })
  const [browserGuardianLocation, setBrowserGuardianLocation] = useState(null)

  const [geofences, setGeofences] = useState([
    { name: 'Guardian Radius', address: 'Family safe zone', radius: SAFE_RADIUS_METERS, active: true, center: [GUARDIAN.latitude, GUARDIAN.longitude] },
    { name: 'Event Family Zone', address: 'Central Grounds', radius: 260, active: true, center: [19.076, 72.8777] },
  ])

  const [mapCenter] = useState([GUARDIAN.latitude, GUARDIAN.longitude])
  const activeFamilyGroup = familyGroups[0]
  const currentUserId = user?.userId || user?._id || 'local-family'
  const familyCreationSessionKey = `family-group-created:${currentUserId}`
  const activeFamilyGroupId = activeFamilyGroup?._id || activeFamilyGroup?.familyGroupId
  const eventIdForGroup = (group = {}) => {
    const safeGroup = group || {}
    return safeGroup.event?._id || safeGroup.event || safeGroup.eventDetails?._id
  }
  const configuredGeofence = activeFamilyGroup?.geofenceSettings || {
    guardianLocation: { latitude: GUARDIAN.latitude, longitude: GUARDIAN.longitude },
    warningRadiusMeters: 130,
    safeRadiusMeters: SAFE_RADIUS_METERS,
  }
  const activeGeofence = {
    ...configuredGeofence,
    guardianLocation: browserGuardianLocation || configuredGeofence.guardianLocation,
  }
  const guardianLocation = activeGeofence.guardianLocation || { latitude: GUARDIAN.latitude, longitude: GUARDIAN.longitude }
  const guardianCenter = [guardianLocation.latitude, guardianLocation.longitude]
  const guardianRows = activeFamilyGroup
    ? ((activeFamilyGroup.guardians?.length ? activeFamilyGroup.guardians : activeFamilyGroup.members) || []).map((guardian, index) => {
        const isCurrentUser = String(guardian.user || guardian._id || '') === String(currentUserId)
        const role = guardian.role || (index === 0 ? 'leader' : 'guardian')
        return {
          _id: guardian._id || guardian.user || `guardian-${index}`,
          name: guardian.name || guardian.fullName || (isCurrentUser ? displayNameForUser(user) : 'Guardian'),
          relationship: guardian.relationship && guardian.relationship !== 'other' ? guardian.relationship : 'guardian',
          phone: guardian.phone || '',
          role,
        }
      })
    : []

  const childToViewModel = (child, group, index) => {
    const devices = devicesForMember(child)
    const primaryDevice = devices[0]
    const isPaired = hasPairedDevice(child)
    const position = isPaired && hasRealDeviceCoordinates(child)
      ? [child.lastLocation.coordinates[1], child.lastLocation.coordinates[0]]
      : null
    const deviceState = deviceStateFor({ device: primaryDevice, member: child, child: { ...child, position } })
    return {
      id: child._id || index + 1,
      name: child.name || 'Child Member',
      age: child.age || 10,
      memberRole: child.relationship || child.role || 'child',
      status: isPaired ? (child.sosActive ? 'danger' : child.geofenceState === 'breach' ? 'danger' : child.geofenceState === 'warning' ? 'warning' : 'safe') : 'offline',
      lastSeen: isPaired && child.lastSeenAt ? formatLastSeen(child.lastSeenAt) : 'Not Connected',
      lastSeenAt: child.lastSeenAt,
      position,
      targetPosition: position,
      trail: position ? [position] : [],
      deviceStatus: isPaired ? child.deviceStatus : 'Not Connected',
      deviceLabel: primaryDevice?.label || child.deviceLabel || 'Not assigned',
      deviceType: primaryDevice?.deviceType || 'Not assigned',
      connectionStatus: deviceState.label,
      deviceState,
      devices,
      isPaired,
      batteryLevel: child.batteryLevel,
      signalStatus: child.signalStatus,
      geofenceStatus: isPaired ? child.geofenceStatus : undefined,
      geofenceState: isPaired ? child.geofenceState : undefined,
      trackingState: child.trackingState || child.privacyBoundary?.state || (child.connected === false && isPaired ? 'outside_event_zone' : 'tracking_active'),
      trackingLabel: child.trackingLabel || child.privacyBoundary?.label,
      trackingPaused: Boolean(child.trackingPaused || child.sessionStatus === 'inactive'),
      privacyBoundary: child.privacyBoundary,
      sessionStatus: child.sessionStatus,
      distanceMeters: isPaired && Number.isFinite(child.distanceMeters)
        ? child.distanceMeters
        : isPaired && Number.isFinite(child.privacyBoundary?.distanceMeters)
          ? child.privacyBoundary.distanceMeters
          : null,
      zone: isPaired ? child.zone : undefined,
      groupId: group?._id || group?.familyGroupId,
    }
  }

  const deviceRows = activeFamilyGroup
    ? children.map((child) => {
        const device = child.devices?.[0] || {}
        const state = deviceStateFor({ device, child })
        return {
          ...device,
          batteryLevel: child.batteryLevel ?? device.batteryLevel,
          signalStatus: child.signalStatus || device.signalStatus,
          lastSeenAt: child.lastSeenAt || device.lastSeenAt,
          deviceType: child.deviceType || device.deviceType || 'Not assigned',
          label: child.deviceLabel || device.label || 'No device label',
          status: state.label,
          childName: child.name,
          childMemberId: child.id,
          state,
        }
      })
    : []
  const linkedDeviceCount = deviceRows.filter((device) => device.deviceId).length
  const displayChildren = useMemo(
    () =>
      children.map((child) => ({
        ...child,
        lastSeen: child.lastSeenAt ? formatRelativeTime(child.lastSeenAt) : child.lastSeen,
      })),
    [children, liveClock]
  )
  const liveTrackedCount = displayChildren.filter((child) => child.isPaired && child.position).length
  const safeCount = displayChildren.filter((child) => child.status === 'safe').length
  const warningCount = displayChildren.filter((child) => child.status === 'warning').length
  const breachCount = displayChildren.filter((child) => child.status === 'danger').length
  const starterTimelineEvents = useMemo(
    () => [
      {
        eventName: 'FAMILY_REGISTERED',
        label: 'Family joined event',
        body: activeFamilyGroup ? `${activeFamilyGroup.name || 'Family'} joined live safety monitoring` : 'Family channel standing by',
      },
      {
        eventName: 'DEVICE_PAIRED',
        label: 'Device paired',
        body: linkedDeviceCount ? `${linkedDeviceCount} wearable ${linkedDeviceCount === 1 ? 'device' : 'devices'} linked` : 'Wearable pairing channel ready',
      },
      {
        eventName: 'DEVICE_LOCATION_UPDATED',
        label: 'Tracking started',
        body: liveTrackedCount ? `${liveTrackedCount} member ${liveTrackedCount === 1 ? 'is' : 'are'} streaming location` : 'Realtime tracking engine armed',
      },
      {
        eventName: 'GEOFENCE_ACTIVATED',
        label: 'Geofence active',
        body: `Guardian radius active at ${activeGeofence.safeRadiusMeters || SAFE_RADIUS_METERS}m`,
      },
    ],
    [activeFamilyGroup, activeGeofence.safeRadiusMeters, linkedDeviceCount, liveTrackedCount]
  )

  const familyScope = useMemo(() => {
    const loadedGroups = familyGroups.filter(Boolean)
    const familyIds = new Set(loadedGroups.map((group) => group._id || group.familyGroupId).filter(Boolean).map(String))
    const childIds = new Set(
      loadedGroups.flatMap((group) => (group.childMembers || []).map((member) => member._id).filter(Boolean).map(String))
    )
    const deviceIds = new Set(
      loadedGroups.flatMap((group) =>
        (group.childMembers || []).flatMap((member) =>
          devicesForMember(member).map((device) => device.deviceId).filter(Boolean).map(String)
        )
      )
    )

    return { familyIds, childIds, deviceIds }
  }, [familyGroups])

  const isOwnFamilyPayload = useCallback((payload = {}, { requireDevice = false } = {}) => {
    if (isLoadingFamilyGroups || !familyGroups.length) return false
    const familyId = payload.familyGroupId || payload.groupId || payload.familyId || (payload.code ? payload._id : undefined)
    const deviceId = payload.deviceId
    const childId = payload.childMemberId || payload.childId || payload.memberId
    const familyMatches = familyId && familyScope.familyIds.has(String(familyId))
    const deviceMatches = deviceId && familyScope.deviceIds.has(String(deviceId))
    const childMatches = childId && familyScope.childIds.has(String(childId))

    if (requireDevice) return Boolean(familyMatches && (deviceMatches || childMatches))
    if (familyId && !familyMatches) return false
    if (deviceId && !deviceMatches) return false
    if (childId && !childMatches) return false
    return Boolean(familyMatches || deviceMatches || childMatches)
  }, [familyGroups.length, familyScope, isLoadingFamilyGroups])

  const includeFamilyTimelineEvent = useCallback((eventName, payload = {}) => {
    if (!familyTimelineEvents.has(eventName)) return false
    if ((eventName === 'FAMILY_GROUP_CREATED' || eventName === 'FAMILY_REGISTERED') && !familyGroups.length) {
      return !payload.leader || String(payload.leader) === String(currentUserId)
    }
    if (eventName === 'new-alert' || eventName === 'SOS_ALERT') {
      const type = String(payload.type || payload.title || eventName).toLowerCase()
      const familyAlert = type.includes('geofence') || type.includes('sos') || type.includes('disconnect') || type.includes('device')
      return familyAlert && isOwnFamilyPayload(payload)
    }
    if (eventName.startsWith('DEVICE_') || eventName.startsWith('GEOFENCE_')) {
      return isOwnFamilyPayload(payload, { requireDevice: Boolean(payload.deviceId) })
    }
    return isOwnFamilyPayload(payload)
  }, [currentUserId, familyGroups.length, isOwnFamilyPayload])

  const applySimulatedGeofenceEvent = useCallback((data = {}) => {
    if (!data.simulationMode || !isOwnFamilyPayload(data)) return
    const childId = data.childMemberId || data.childId || data.memberId
    const target = data.childLocation
      ? [data.childLocation.latitude, data.childLocation.longitude]
      : data.location
        ? [data.location.latitude, data.location.longitude]
        : null
    if (!childId || !target?.every(Number.isFinite)) return

    setChildren((prev) =>
      prev.map((child) => {
        if (String(child.id) !== String(childId)) return child
        const geofenceState = data.status || data.geofenceState || (data.type === 'GEOFENCE_BREACH' ? 'breach' : 'warning')
        const timestamp = data.timestamp || new Date().toISOString()
        const primaryDevice = child.devices?.[0] || {}
        const liveDevice = {
          ...primaryDevice,
          deviceId: data.deviceId || primaryDevice.deviceId,
          status: 'connected',
          connected: true,
          paired: primaryDevice.paired ?? false,
          signalStatus: 'simulated',
          lastSeenAt: timestamp,
          lastLocation: { type: 'Point', coordinates: [target[1], target[0]] },
        }
        return {
          ...child,
          isPaired: true,
          connectionStatus: 'Simulation Mode',
          position: target,
          targetPosition: target,
          trail: [...(child.trail || (child.position ? [child.position] : [])), target].slice(-14),
          lastSeen: formatLastSeen(timestamp),
          lastSeenAt: timestamp,
          signalStatus: 'simulated',
          geofenceStatus: geofenceState === 'breach' ? 'outside' : 'inside',
          geofenceState,
          distanceMeters: data.distanceMeters,
          zone: data.zone || zoneFromGeofenceState(geofenceState),
          devices: [liveDevice],
          deviceState: deviceStateFor({ device: liveDevice, child: { ...child, position: target } }),
          status: geofenceState === 'breach' ? 'danger' : 'warning',
        }
      })
    )
  }, [isOwnFamilyPayload])

  useEffect(() => {
    if (authLoading) return
    loadFamilyGroups()
  }, [authLoading])

  useEffect(() => {
    const interval = setInterval(() => setLiveClock(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isLoadingFamilyGroups || !activeFamilyGroup) return undefined
    if (!navigator.geolocation) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setBrowserGuardianLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAt: new Date().toISOString(),
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [activeFamilyGroup, isLoadingFamilyGroups])

  const loadFamilyGroups = async () => {
    setIsLoadingFamilyGroups(true)
    try {
      const response = await familyAPI.getMyGroups()
      const groups = (response.data.data || []).map((group) => ({
        ...group,
        eventDetails: typeof group.event === 'object' ? group.event : group.eventDetails,
        event: group.event?._id || group.event,
      }))
      setFamilyGroups(groups)
      if (groups[0]?._id) {
        sessionStorage.setItem(familyCreationSessionKey, groups[0]._id)
      }
      if (groups[0]?.geofenceSettings) {
        setGeofenceForm({
          warningRadiusMeters: groups[0].geofenceSettings.warningRadiusMeters || 130,
          safeRadiusMeters: groups[0].geofenceSettings.safeRadiusMeters || SAFE_RADIUS_METERS,
        })
      }
      setChildren(groups.flatMap((group) => (group.childMembers || []).map((child, index) => childToViewModel(child, group, index))))
    } catch (error) {
      console.error('Failed to load family groups:', error)
      setFamilyGroups([])
      setChildren([])
    } finally {
      setIsLoadingFamilyGroups(false)
    }
  }

  useEffect(() => {
    if (isLoadingFamilyGroups) return undefined
    const reloadFamilyGroups = () => loadFamilyGroups()
    const reloadIfOwnFamily = (payload) => {
      if (payload?.simulationMode) return
      if (isOwnFamilyPayload(payload)) loadFamilyGroups()
    }
    const reloadIfOwnDevice = (payload) => {
      if (payload?.simulationMode) return
      if (isOwnFamilyPayload(payload, { requireDevice: Boolean(payload?.deviceId) })) loadFamilyGroups()
    }

    on('FAMILY_GROUP_CREATED', reloadFamilyGroups)
    on('FAMILY_GROUP_DELETED', reloadIfOwnFamily)
    on('FAMILY_GROUP_UPDATED', reloadIfOwnFamily)
    on('FAMILY_REGISTERED', reloadFamilyGroups)
    on('FAMILY_MEMBER_ADDED', reloadIfOwnFamily)
    on('FAMILY_MEMBER_UPDATED', reloadIfOwnFamily)
    on('FAMILY_MEMBER_REMOVED', reloadIfOwnFamily)
    on('FAMILY_GUARDIAN_REMOVED', reloadIfOwnFamily)
    on('DEVICE_PAIRED', reloadIfOwnDevice)
    on('DEVICE_LOCATION_UPDATED', reloadIfOwnDevice)
    on('DEVICE_STATUS_UPDATED', reloadIfOwnDevice)
    on('DEVICE_DISCONNECTED', reloadIfOwnDevice)
    on('DEVICE_TRACKING_PAUSED', reloadIfOwnDevice)
    on('TRACKING_PRIVACY_BOUNDARY', reloadIfOwnDevice)
    on('DEVICE_RECONNECTED', reloadIfOwnDevice)
    on('GEOFENCE_WARNING', reloadIfOwnDevice)
    on('GEOFENCE_BREACH', reloadIfOwnDevice)
    on('GEOFENCE_WARNING', applySimulatedGeofenceEvent)
    on('GEOFENCE_BREACH', applySimulatedGeofenceEvent)
    return () => {
      off('FAMILY_GROUP_CREATED', reloadFamilyGroups)
      off('FAMILY_GROUP_DELETED', reloadIfOwnFamily)
      off('FAMILY_GROUP_UPDATED', reloadIfOwnFamily)
      off('FAMILY_REGISTERED', reloadFamilyGroups)
      off('FAMILY_MEMBER_ADDED', reloadIfOwnFamily)
      off('FAMILY_MEMBER_UPDATED', reloadIfOwnFamily)
      off('FAMILY_MEMBER_REMOVED', reloadIfOwnFamily)
      off('FAMILY_GUARDIAN_REMOVED', reloadIfOwnFamily)
      off('DEVICE_PAIRED', reloadIfOwnDevice)
      off('DEVICE_LOCATION_UPDATED', reloadIfOwnDevice)
      off('DEVICE_STATUS_UPDATED', reloadIfOwnDevice)
      off('DEVICE_DISCONNECTED', reloadIfOwnDevice)
      off('DEVICE_TRACKING_PAUSED', reloadIfOwnDevice)
      off('TRACKING_PRIVACY_BOUNDARY', reloadIfOwnDevice)
      off('DEVICE_RECONNECTED', reloadIfOwnDevice)
      off('GEOFENCE_WARNING', reloadIfOwnDevice)
      off('GEOFENCE_BREACH', reloadIfOwnDevice)
      off('GEOFENCE_WARNING', applySimulatedGeofenceEvent)
      off('GEOFENCE_BREACH', applySimulatedGeofenceEvent)
    }
  }, [on, off, isOwnFamilyPayload, isLoadingFamilyGroups, applySimulatedGeofenceEvent])

  useEffect(() => {
    if (isLoadingFamilyGroups || !activeFamilyGroup) return undefined

    if (isConnected) {
      familyGroups.filter(Boolean).forEach((group) => {
        const familyGroupId = group._id || group.familyGroupId
        if (!familyGroupId) return
        const eventId = eventIdForGroup(group)
        emit('JOIN_FAMILY', { familyGroupId })
        if (eventId) emit('JOIN_EVENT', { eventId })
        ;(group.childMembers || []).forEach((member) => {
          if (!hasPairedDevice(member)) return
          devicesForMember(member).forEach((device) => {
            if (!device.deviceId) return
            emit('JOIN_DEVICE_ROOMS', {
              eventId,
              familyGroupId,
              deviceId: device.deviceId,
            })
          })
        })
      })
    }

    const updateChildLocation = (data) => {
      if (!isOwnFamilyPayload(data)) return
      const target = [data.latitude ?? data.lat, data.longitude ?? data.lng]
      if (!target.every(Number.isFinite)) return
      setChildren((prev) =>
        prev.map((child) =>
          child.id === data.childId
            ? !child.isPaired && !data.deviceSession?.sessionId
              ? child
              : (() => {
                  const distanceMeters = Number.isFinite(data.distanceMeters)
                    ? data.distanceMeters
                    : Number.isFinite(data.privacyBoundary?.distanceMeters)
                      ? data.privacyBoundary.distanceMeters
                    : metersBetween(guardianCenter, target)
                  const geofenceState = data.geofenceState || geofenceStateFromDistance(distanceMeters, data.geofenceStatus)
                  const trackingState = data.trackingState || data.privacyBoundary?.state || 'tracking_active'
                  const trackingPaused = Boolean(data.trackingPaused || data.sessionStatus === 'inactive' || trackingState === 'outside_event_zone')
                  const nextDevices = (child.devices || []).map((device, index) =>
                    index === 0
                      ? {
                          ...device,
                          status: trackingPaused ? 'disconnected' : 'connected',
                          connected: !trackingPaused,
                          batteryLevel: data.batteryLevel ?? data.battery,
                          signalStatus: data.signalStatus || data.signal || device.signalStatus,
                          trackingState,
                          trackingPaused,
                          lastSeenAt: data.timestamp || new Date().toISOString(),
                          lastLocation: { type: 'Point', coordinates: [target[1], target[0]] },
                        }
                      : device
                  )
                  const liveDevices = nextDevices.length
                    ? nextDevices
                    : data.deviceId
                      ? [{
                          deviceId: data.deviceId,
                          status: trackingPaused ? 'disconnected' : 'connected',
                          connected: !trackingPaused,
                          paired: true,
                          batteryLevel: data.batteryLevel ?? data.battery,
                          signalStatus: data.signalStatus || data.signal || child.signalStatus,
                          trackingState,
                          trackingPaused,
                          lastSeenAt: data.timestamp || new Date().toISOString(),
                          lastLocation: { type: 'Point', coordinates: [target[1], target[0]] },
                        }]
                      : child.devices
                  const activityTimestamp = data.timestamp
                  if (!activityTimestamp) return child
                  return {
                  ...child,
                  isPaired: true,
                  connectionStatus: trackingBoundaryLabel(trackingState),
                  targetPosition: target,
                  trail: [...(child.trail || (child.position ? [child.position] : [])), target].slice(-12),
                  lastSeen: formatLastSeen(activityTimestamp),
                  lastSeenAt: activityTimestamp,
                  batteryLevel: data.batteryLevel ?? data.battery,
                  signalStatus: data.signalStatus || data.signal || child.signalStatus,
                  geofenceStatus: data.geofenceStatus,
                  geofenceState,
                  trackingState,
                  trackingLabel: data.trackingLabel || trackingBoundaryLabel(trackingState),
                  trackingPaused,
                  privacyBoundary: data.privacyBoundary,
                  sessionStatus: data.sessionStatus,
                  distanceMeters,
                  zone: data.zone || zoneFromGeofenceState(geofenceState),
                  devices: liveDevices,
                  deviceState: deviceStateFor({ device: liveDevices?.[0], child: { ...child, position: target, trackingState, trackingPaused } }),
                  status: trackingPaused ? 'danger' : geofenceState === 'breach' ? 'danger' : geofenceState === 'warning' ? 'warning' : 'safe',
                  }
                })()
            : child
        )
      )
    }

    const updateDeviceLocation = (data) => {
      if (!isOwnFamilyPayload(data, { requireDevice: Boolean(data.deviceId) })) return
      const target = [data.location?.latitude ?? data.latitude, data.location?.longitude ?? data.longitude]
      if (!target.every(Number.isFinite)) return
      const distanceMeters = Number.isFinite(data.distanceMeters)
        ? data.distanceMeters
        : Number.isFinite(data.privacyBoundary?.distanceMeters)
          ? data.privacyBoundary.distanceMeters
        : metersBetween(guardianCenter, target)

      setChildren((prev) =>
        prev.map((child) =>
          child.id === data.childMemberId
            ? !child.isPaired && !data.deviceSession?.sessionId
              ? child
              : (() => {
                  const geofenceState = data.geofenceState || geofenceStateFromDistance(distanceMeters, data.geofenceStatus)
                  const trackingState = data.trackingState || data.privacyBoundary?.state || 'tracking_active'
                  const trackingPaused = Boolean(data.trackingPaused || data.sessionStatus === 'inactive' || trackingState === 'outside_event_zone')
                  const lastSeenAt = data.timestamp
                  if (!lastSeenAt) return child
                  const nextDevices = (child.devices || []).map((device) =>
                    device.deviceId === data.deviceId || !device.deviceId
                      ? {
                          ...device,
                          deviceId: data.deviceId || device.deviceId,
                          status: trackingPaused ? 'disconnected' : 'connected',
                          connected: !trackingPaused,
                          paired: true,
                          batteryLevel: data.batteryLevel ?? data.battery,
                          signalStatus: data.signalStatus || data.signal || device.signalStatus,
                          trackingState,
                          trackingPaused,
                          lastSeenAt,
                          lastLocation: { type: 'Point', coordinates: [target[1], target[0]] },
                        }
                      : device
                  )
                  const liveDevices = nextDevices.length
                    ? nextDevices
                    : [{
                        deviceId: data.deviceId,
                        status: trackingPaused ? 'disconnected' : 'connected',
                        connected: !trackingPaused,
                        paired: true,
                        batteryLevel: data.batteryLevel ?? data.battery,
                        signalStatus: data.signalStatus || data.signal || child.signalStatus,
                        trackingState,
                        trackingPaused,
                        lastSeenAt,
                        lastLocation: { type: 'Point', coordinates: [target[1], target[0]] },
                      }]
                  return {
                  ...child,
                  isPaired: true,
                  connectionStatus: trackingBoundaryLabel(trackingState),
                  targetPosition: target,
                  trail: [...(child.trail || (child.position ? [child.position] : [])), target].slice(-14),
                  lastSeen: formatLastSeen(lastSeenAt),
                  lastSeenAt,
                  batteryLevel: data.batteryLevel ?? data.battery,
                  signalStatus: data.signalStatus || data.signal || child.signalStatus,
                  geofenceStatus: data.geofenceStatus,
                  geofenceState,
                  trackingState,
                  trackingLabel: data.trackingLabel || trackingBoundaryLabel(trackingState),
                  trackingPaused,
                  privacyBoundary: data.privacyBoundary,
                  sessionStatus: data.sessionStatus,
                  distanceMeters,
                  zone: data.zone || zoneFromGeofenceState(geofenceState),
                  devices: liveDevices,
                  deviceState: deviceStateFor({ device: liveDevices[0], child: { ...child, position: target, trackingState, trackingPaused } }),
                  status: data.sosActive || trackingPaused ? 'danger' : geofenceState === 'breach' ? 'danger' : geofenceState === 'warning' ? 'warning' : 'safe',
                  }
                })()
            : child
        )
      )
    }

    const updateChildStatus = (data) => {
      if (!isOwnFamilyPayload(data)) return
      setChildren((prev) =>
        prev.map((child) =>
          child.id === data.childId ? (child.isPaired ? { ...child, status: data.status } : child) : child
        )
      )
    }

    const applyDevicePaired = (data = {}) => {
      if (!isOwnFamilyPayload(data, { requireDevice: Boolean(data.deviceId) })) return
      const childId = data.childMemberId || data.childId || data.memberId
      const activityTimestamp = data.lastSeenAt || data.timestamp || new Date().toISOString()
      setChildren((prev) =>
        prev.map((child) => {
          if (String(child.id) !== String(childId)) return child
          const primaryDevice = child.devices?.[0] || {}
          const liveDevice = {
            ...primaryDevice,
            deviceId: data.deviceId || primaryDevice.deviceId,
            label: data.deviceLabel || primaryDevice.label || child.deviceLabel || data.deviceId,
            deviceType: data.deviceType || primaryDevice.deviceType || child.deviceType || 'watch',
            status: 'connected',
            connected: true,
            paired: true,
            batteryLevel: data.batteryLevel ?? child.batteryLevel ?? primaryDevice.batteryLevel,
            signalStatus: data.signalStatus || 'strong',
            lastSeenAt: activityTimestamp,
            trackingState: data.trackingState || 'tracking_active',
            trackingPaused: false,
          }
          const nextChild = {
            ...child,
            isPaired: true,
            deviceStatus: 'paired',
            deviceLabel: liveDevice.label,
            deviceType: liveDevice.deviceType,
            connectionStatus: 'Connected',
            lastSeen: formatLastSeen(activityTimestamp),
            lastSeenAt: activityTimestamp,
            batteryLevel: liveDevice.batteryLevel,
            signalStatus: liveDevice.signalStatus,
            trackingState: data.trackingState || 'tracking_active',
            trackingLabel: data.trackingLabel || 'Tracking Active',
            trackingPaused: false,
            sessionStatus: 'active',
            privacyBoundary: data.eventBoundary || data.privacyBoundary || child.privacyBoundary,
            devices: [liveDevice],
          }
          return {
            ...nextChild,
            deviceState: deviceStateFor({ device: liveDevice, child: nextChild }),
          }
        })
      )
    }

    const updateDeviceActivity = (data) => {
      if (!isOwnFamilyPayload(data, { requireDevice: Boolean(data.deviceId) })) return
      const activityTimestamp = data.lastSeenAt || data.timestamp
      if (!activityTimestamp) return

      setChildren((prev) =>
        prev.map((child) => {
          const matchesChild = child.id === data.childMemberId || child.devices?.some((device) => device.deviceId === data.deviceId)
          if (!matchesChild) return child
          const nextDevices = (child.devices || []).map((device) =>
            device.deviceId === data.deviceId || (!device.deviceId && data.deviceId)
              ? {
                  ...device,
                  deviceId: data.deviceId || device.deviceId,
                  status: 'connected',
                  connected: true,
                  paired: true,
                  batteryLevel: data.batteryLevel ?? device.batteryLevel,
                  signalStatus: data.signalStatus || device.signalStatus,
                  lastSeenAt: activityTimestamp,
                }
              : device
          )
          const liveDevices = nextDevices.length
            ? nextDevices
            : [{
                deviceId: data.deviceId,
                status: 'connected',
                connected: true,
                paired: true,
                batteryLevel: data.batteryLevel,
                signalStatus: data.signalStatus || child.signalStatus,
                lastSeenAt: activityTimestamp,
              }]

          return {
            ...child,
            isPaired: true,
            lastSeen: formatLastSeen(activityTimestamp),
            lastSeenAt: activityTimestamp,
            batteryLevel: data.batteryLevel ?? child.batteryLevel,
            signalStatus: data.signalStatus || child.signalStatus,
            devices: liveDevices,
            connectionStatus: child.position ? 'Tracking Live' : 'Connected',
            deviceState: deviceStateFor({ device: liveDevices[0], child }),
          }
        })
      )
    }

    const logGeofence = (data) => {
      if (!isOwnFamilyPayload(data)) return
      console.log('Geofence alert:', data)
    }

    on('child-location-update', updateChildLocation)
    on('DEVICE_PAIRED', applyDevicePaired)
    on('DEVICE_LOCATION_UPDATED', updateDeviceLocation)
    on('TRACKING_PRIVACY_BOUNDARY', updateDeviceLocation)
    on('DEVICE_TRACKING_PAUSED', updateDeviceLocation)
    on('DEVICE_STATUS_UPDATED', updateDeviceActivity)
    on('DEVICE_RECONNECTED', updateDeviceActivity)
    on('child-status-change', updateChildStatus)
    on('geofence-alert', logGeofence)

    return () => {
      off('child-location-update', updateChildLocation)
      off('DEVICE_PAIRED', applyDevicePaired)
      off('DEVICE_LOCATION_UPDATED', updateDeviceLocation)
      off('TRACKING_PRIVACY_BOUNDARY', updateDeviceLocation)
      off('DEVICE_TRACKING_PAUSED', updateDeviceLocation)
      off('DEVICE_STATUS_UPDATED', updateDeviceActivity)
      off('DEVICE_RECONNECTED', updateDeviceActivity)
      off('child-status-change', updateChildStatus)
      off('geofence-alert', logGeofence)
    }
  }, [isConnected, emit, on, off, familyGroups, activeFamilyGroup, isOwnFamilyPayload, isLoadingFamilyGroups])

  useEffect(() => {
    if (isLoadingFamilyGroups || !activeFamilyGroup) return undefined
    const interval = setInterval(() => {
      setChildren((prev) =>
        prev.map((child) => {
          if (!child.isPaired || !child.targetPosition) return child
          if (!child.position) return child
          const [lat, lng] = child.position
          const [targetLat, targetLng] = child.targetPosition
          return {
            ...child,
            position: [
              lat + (targetLat - lat) * 0.28,
              lng + (targetLng - lng) * 0.28,
            ],
          }
        })
      )
    }, 180)

    return () => clearInterval(interval)
  }, [activeFamilyGroup, isLoadingFamilyGroups])

  const handleSOS = (child) => {
    if (!child) return
    const familyGroupId = child.groupId || activeFamilyGroup?._id || activeFamilyGroup?.familyGroupId
    if (!familyGroupId) return
    setSOSActive(true)
    if (isConnected) {
      const primaryDevice = child.devices?.[0]
      emit('SOS_ALERT', {
        eventId: eventIdForGroup(activeFamilyGroup),
        familyGroupId,
        childMemberId: child.id,
        childName: child.name,
        deviceId: primaryDevice?.deviceId,
        type: 'SOS Alert',
        severity: 'CRITICAL',
        description: `${child.name} triggered SOS.`,
        location: child.zone || 'Family safety radius',
        coordinates: child.position ? { latitude: child.position[0], longitude: child.position[1] } : undefined,
        timestamp: new Date().toISOString(),
      })
    }
    setTimeout(() => setSOSActive(false), 5000)
  }

  const createFamilyGroup = async () => {
    if (createFamilyRequestRef.current) return createFamilyRequestRef.current
    if (activeFamilyGroup?._id) {
      sessionStorage.setItem(familyCreationSessionKey, activeFamilyGroup._id)
      return activeFamilyGroup
    }

    const existingSessionGroupId = sessionStorage.getItem(familyCreationSessionKey)
    if (existingSessionGroupId) {
      await loadFamilyGroups()
      return null
    }

    setIsCreatingFamilyGroup(true)
    const request = (async () => {
    try {
      const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Primary Guardian'
      const response = await familyAPI.createGroup({
        name: `${user?.firstName || 'My'} Family`,
        leader: currentUserId,
        userId: currentUserId,
        guardianName: displayName,
        guardians: [
          {
            _id: `guardian-${currentUserId}`,
            user: currentUserId,
            name: displayName,
            relationship: 'guardian',
            role: 'leader',
            emergencyContact: true,
          },
        ],
        childMembers: [],
      })
      const group = response.data.data
      if (group?._id) sessionStorage.setItem(familyCreationSessionKey, group._id)
      const familyGroupId = group?._id || group?.familyGroupId
      if (familyGroupId) emit('JOIN_FAMILY', { familyGroupId })
      const eventId = eventIdForGroup(group)
      if (eventId) emit('JOIN_EVENT', { eventId })
      await loadFamilyGroups()
      return group
    } catch (error) {
      console.error('Failed to create family group:', error)
      return null
    } finally {
      setIsCreatingFamilyGroup(false)
      createFamilyRequestRef.current = null
    }
    })()
    createFamilyRequestRef.current = request
    return request
  }

  const submitGuardian = async (event) => {
    event.preventDefault()
    if (!activeFamilyGroup) return
    if (editingGuardianId) {
      await familyAPI.updateGuardian(activeFamilyGroup._id, editingGuardianId, guardianForm)
      setEditingGuardianId(null)
    } else {
      await familyAPI.addGuardian(activeFamilyGroup._id, guardianForm)
    }
    setGuardianForm({ name: '', relationship: 'guardian', phone: '' })
    await loadFamilyGroups()
  }

  const submitChild = async (event) => {
    event.preventDefault()
    if (!activeFamilyGroup) return
    const payload = { ...childForm, age: Number(childForm.age || 0) }
    if (editingChildId) {
      await familyAPI.updateChild(activeFamilyGroup._id, editingChildId, payload)
      setEditingChildId(null)
    } else {
      await familyAPI.addChild(activeFamilyGroup._id, payload)
    }
    setChildForm({ name: '', age: '', relationship: 'child', deviceLabel: '' })
    await loadFamilyGroups()
  }

  const editGuardian = (guardian) => {
    setEditingGuardianId(guardian._id)
    setGuardianForm({ name: guardian.name || '', relationship: guardian.relationship || 'guardian', phone: guardian.phone || '' })
  }

  const editChild = (child) => {
    setEditingChildId(child.id)
    setChildForm({ name: child.name || '', age: child.age || '', relationship: 'child', deviceLabel: child.deviceLabel || '' })
  }

  const removeGuardian = async (guardianId) => {
    if (!activeFamilyGroupId || !guardianId) return
    setDeletingGuardianId(guardianId)
    setFamilyActionMessage(null)
    const previousGroups = familyGroups
    setFamilyGroups((groups) =>
      groups.map((group) =>
        (group._id || group.familyGroupId) === activeFamilyGroupId
          ? { ...group, guardians: (group.guardians || []).filter((guardian) => String(guardian._id) !== String(guardianId)) }
          : group
      )
    )
    try {
      await familyAPI.removeGuardian(activeFamilyGroupId, guardianId)
      emit('FAMILY_GUARDIAN_REMOVED', { familyGroupId: activeFamilyGroupId, guardianId, timestamp: new Date().toISOString() })
      setFamilyActionMessage({ type: 'success', text: 'Guardian removed from family group.' })
      await loadFamilyGroups()
    } catch (error) {
      setFamilyGroups(previousGroups)
      setFamilyActionMessage({ type: 'error', text: error.response?.data?.message || 'Failed to remove guardian.' })
    } finally {
      setDeletingGuardianId(null)
    }
  }

  const removeChild = async (childId) => {
    if (!activeFamilyGroupId || !childId) return
    setDeletingChildId(childId)
    setFamilyActionMessage(null)
    const removedChild = children.find((child) => String(child.id) === String(childId))
    const previousChildren = children
    const previousGroups = familyGroups
    setChildren((current) => current.filter((child) => String(child.id) !== String(childId)))
    setFamilyGroups((groups) =>
      groups.map((group) =>
        (group._id || group.familyGroupId) === activeFamilyGroupId
          ? { ...group, childMembers: (group.childMembers || []).filter((child) => String(child._id) !== String(childId)) }
          : group
      )
    )
    if (selectedChild?.id === childId) setSelectedChild(null)
    try {
      await familyAPI.removeChild(activeFamilyGroupId, childId)
      emit('FAMILY_MEMBER_REMOVED', {
        familyGroupId: activeFamilyGroupId,
        childMemberId: childId,
        deviceId: removedChild?.devices?.[0]?.deviceId,
        timestamp: new Date().toISOString(),
      })
      setFamilyActionMessage({ type: 'success', text: 'Family member removed.' })
      await loadFamilyGroups()
    } catch (error) {
      setChildren(previousChildren)
      setFamilyGroups(previousGroups)
      setFamilyActionMessage({ type: 'error', text: error.response?.data?.message || 'Failed to remove family member.' })
    } finally {
      setDeletingChildId(null)
    }
  }

  const deleteFamilyGroup = async () => {
    if (!activeFamilyGroupId) return
    setIsDeletingFamilyGroup(true)
    setFamilyActionMessage(null)
    const previousGroups = familyGroups
    const previousChildren = children
    setFamilyGroups((groups) => groups.filter((group) => String(group._id || group.familyGroupId) !== String(activeFamilyGroupId)))
    setChildren([])
    setSelectedChild(null)
    try {
      await familyAPI.deleteGroup(activeFamilyGroupId)
      emit('LEAVE_FAMILY', { familyGroupId: activeFamilyGroupId })
      emit('FAMILY_GROUP_DELETED', { familyGroupId: activeFamilyGroupId, timestamp: new Date().toISOString() })
      sessionStorage.removeItem(familyCreationSessionKey)
      setFamilyActionMessage({ type: 'success', text: 'Family group deleted.' })
      await loadFamilyGroups()
    } catch (error) {
      setFamilyGroups(previousGroups)
      setChildren(previousChildren)
      setFamilyActionMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete family group.' })
    } finally {
      setIsDeletingFamilyGroup(false)
    }
  }

  const saveGeofenceSettings = async (event) => {
    event.preventDefault()
    if (!activeFamilyGroup) return
    const warningRadiusMeters = Math.max(10, Number(geofenceForm.warningRadiusMeters || 0))
    const safeRadiusMeters = Math.max(warningRadiusMeters + 1, Number(geofenceForm.safeRadiusMeters || warningRadiusMeters + 1))
    await familyAPI.updateGroup(activeFamilyGroup._id, {
      geofenceSettings: {
        ...(activeFamilyGroup.geofenceSettings || {}),
        warningRadiusMeters,
        safeRadiusMeters,
      },
    })
    emit('GEOFENCE_ACTIVATED', {
      familyGroupId: activeFamilyGroup._id,
      geofenceSettings: { warningRadiusMeters, safeRadiusMeters },
      timestamp: new Date().toISOString(),
    })
    await loadFamilyGroups()
  }

  const generatePairing = async (child) => {
    try {
      const groupId = child.groupId || activeFamilyGroup?._id || activeFamilyGroup?.familyGroupId
      if (!groupId) return
      const response = await familyAPI.generatePairingCode(groupId, child.id)
      const pairingData = response.data.data
      setPairing(pairingData)
      setFamilyActionMessage({
        type: 'success',
        text: `Pair code created for ${child.name}. It expires in 5 minutes.`,
      })
      const params = new URLSearchParams({
        familyCode: pairingData.familyCode || activeFamilyGroup?.code || '',
        pairCode: pairingData.pairingCode || '',
        childId: pairingData.childId || pairingData.childMemberId || child.id,
      })
      window.open(`/pair-device?${params.toString()}`, '_blank', 'noopener,noreferrer')
      await loadFamilyGroups()
    } catch (error) {
      console.error('Failed to generate pairing code:', error)
      setFamilyActionMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create pair code.' })
    }
  }

  useEffect(() => {
    clearTimeout(pairingExpiryTimerRef.current)
    if (!pairing?.expiresAt) return undefined

    const delay = new Date(pairing.expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      setPairing((current) => (current?.pairingCode === pairing.pairingCode ? { ...current, expired: true } : current))
      return undefined
    }

    pairingExpiryTimerRef.current = setTimeout(() => {
      setPairing((current) => (current?.pairingCode === pairing.pairingCode ? { ...current, expired: true } : current))
      loadFamilyGroups()
    }, delay)

    return () => clearTimeout(pairingExpiryTimerRef.current)
  }, [pairing?.pairingCode, pairing?.expiresAt])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary text-glow">Family Dashboard</h1>
          <p className="text-text-muted mt-1">Real-time family safety tracking</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {familyGroups.length === 0 && (
            <button
              onClick={createFamilyGroup}
              disabled={isCreatingFamilyGroup}
              className="touch-target shrink-0 px-4 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreatingFamilyGroup ? 'Creating...' : 'Create Family Group'}
            </button>
          )}
          <div className={`touch-target shrink-0 flex items-center gap-2 px-4 rounded-lg ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-sm font-medium">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          {SIMULATION_MODE && (
            <div className="touch-target shrink-0 flex items-center gap-2 px-4 rounded-lg bg-warning/15 text-warning border border-warning/30">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <span className="text-sm font-medium">Realtime Simulation Active</span>
            </div>
          )}
          <button
            onClick={() => setShowGeofencePanel(!showGeofencePanel)}
            className="touch-target shrink-0 rounded-lg bg-surfaceLight border border-border hover:border-primary transition-colors"
          >
            <Shield className="text-text-secondary" size={20} />
          </button>
        </div>
      </motion.div>

      {familyActionMessage && (
        <div className={`glass rounded-xl px-4 py-3 border text-sm ${
          familyActionMessage.type === 'success'
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-danger/40 bg-danger/10 text-danger'
        }`}>
          {familyActionMessage.text}
        </div>
      )}

      {isLoadingFamilyGroups && (
        <div className="glass rounded-2xl p-8 border-glow flex items-center justify-center min-h-[360px]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-text-primary font-semibold">Loading family safety state</p>
            <p className="text-sm text-text-muted mt-1">Restoring authenticated family data...</p>
          </div>
        </div>
      )}

      {!isLoadingFamilyGroups && (
      <>
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div layout className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <Users size={24} className="text-primary" />
            </div>
            <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="text-text-muted text-sm mb-1">Family Members</p>
          <p className="text-3xl font-bold text-text-primary"><AnimatedNumber value={displayChildren.length} /></p>
        </motion.div>
        <motion.div layout className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-success/20">
              <CheckCircle size={24} className="text-success" />
            </div>
            <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">Safe</span>
          </div>
          <p className="text-text-muted text-sm mb-1">Safe Members</p>
          <p className="text-3xl font-bold text-text-primary"><AnimatedNumber value={safeCount} /></p>
        </motion.div>
        <motion.div layout className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-warning/20">
              <AlertTriangle size={24} className="text-warning" />
            </div>
            <span className="text-xs px-2 py-1 rounded bg-warning/20 text-warning">{warningCount + breachCount} active</span>
          </div>
          <p className="text-text-muted text-sm mb-1">Alerts</p>
          <p className="text-3xl font-bold text-text-primary"><AnimatedNumber value={warningCount + breachCount} /></p>
        </motion.div>
        <motion.div layout className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-accent/20">
              <Navigation size={24} className="text-accent" />
            </div>
            <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">Streaming</span>
          </div>
          <p className="text-text-muted text-sm mb-1">Tracking Streams</p>
          <p className="text-3xl font-bold text-text-primary"><AnimatedNumber value={liveTrackedCount} /></p>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
        {/* Map Section */}
        <div className="min-w-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`glass rounded-xl overflow-hidden border-glow h-[560px] sm:h-[680px] xl:h-[760px] relative ${
              displayChildren.some((child) => child.isPaired && child.geofenceState === 'breach')
                ? 'ring-1 ring-danger shadow-[0_0_28px_rgba(239,68,68,0.24)]'
                : displayChildren.some((child) => child.isPaired && child.geofenceState === 'warning')
                  ? 'ring-1 ring-warning shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                  : ''
            }`}
          >
            <div className="absolute inset-x-0 top-0 z-[500] p-5 sm:p-7 pointer-events-none">
              <div className="flex flex-col gap-3 max-w-4xl">
                <div className="w-fit rounded-2xl border border-primary/20 bg-background/75 px-5 py-4 shadow-[0_0_28px_rgba(59,130,246,0.12)] backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.25em] text-primary">Live Tracking Map</p>
                  <p className="text-2xl sm:text-4xl font-black text-text-primary">Family Command Radius</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-background/65 px-3 py-1.5 text-xs font-bold text-success tracking-wide backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    LIVE
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/65 px-3 py-1.5 text-xs font-bold text-primary tracking-wide backdrop-blur-xl">
                    <Navigation size={13} />
                    TRACKING {liveTrackedCount}
                  </span>
                </div>
                {SIMULATION_MODE && (
                  <div className="w-fit rounded-full border border-warning/25 bg-background/65 px-3 py-1.5 text-xs font-bold text-warning backdrop-blur-xl">
                    Realtime Simulation Active
                  </div>
                )}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[500] p-5 sm:p-7 pointer-events-none">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-w-4xl">
                <div className="rounded-2xl border border-success/25 bg-background/70 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Live</p>
                  <p className="text-lg font-black text-success flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    Online
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/25 bg-background/70 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Tracking</p>
                  <p className="text-lg font-black text-primary">{liveTrackedCount} streams</p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 backdrop-blur-xl bg-background/70 ${
                  breachCount > 0 ? 'border-danger/35' : warningCount > 0 ? 'border-warning/35' : 'border-success/25'
                }`}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Geofence</p>
                  <p className={`text-lg font-black ${breachCount > 0 ? 'text-danger' : warningCount > 0 ? 'text-warning' : 'text-success'}`}>
                    {breachCount > 0 ? 'Breach' : warningCount > 0 ? 'Warning' : 'Secure'}
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/25 bg-background/70 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Active Members</p>
                  <p className="text-lg font-black text-text-primary">{displayChildren.length}</p>
                </div>
              </div>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              <Circle
                className="family-geofence-circle family-geofence-safe"
                center={guardianCenter}
                radius={Number(activeGeofence.safeRadiusMeters || SAFE_RADIUS_METERS)}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.08,
                  weight: 2,
                }}
              />
              <Circle
                className="family-geofence-circle family-geofence-warning"
                center={guardianCenter}
                radius={Number(activeGeofence.warningRadiusMeters || 130)}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '8 8',
                }}
              />

              <Marker position={guardianCenter} icon={createCustomIcon('#3b82f6', true, 'guardian')}>
                <Popup>
                  <div className="text-text-primary">
                    <strong>Guardian</strong>
                    <br />
                    Warning: {activeGeofence.warningRadiusMeters}m
                    <br />
                    Safe: {activeGeofence.safeRadiusMeters}m
                  </div>
                </Popup>
              </Marker>

              {displayChildren.filter((child) => child.isPaired && child.position).map((child) => (
                child.trail?.length > 1 && child.trail.slice(1).map((point, index) => (
                  <Fragment key={`${child.id}-trail-segment-${index}`}>
                  <Polyline
                    key={`${child.id}-trail-glow-${index}`}
                    positions={[child.trail[index], point]}
                    className="family-trail-glow"
                    pathOptions={{
                      color: child.status === 'safe' ? '#10b981' : child.status === 'warning' ? '#f59e0b' : '#ef4444',
                      weight: 9,
                      opacity: 0.12 + (index / Math.max(1, child.trail.length - 1)) * 0.18,
                    }}
                  />
                  <Polyline
                    key={`${child.id}-trail-${index}`}
                    positions={[child.trail[index], point]}
                    className="family-trail-line"
                    pathOptions={{
                      color: child.status === 'safe' ? '#10b981' : child.status === 'warning' ? '#f59e0b' : '#ef4444',
                      weight: 4,
                      opacity: 0.18 + (index / Math.max(1, child.trail.length - 1)) * 0.62,
                    }}
                  />
                  </Fragment>
                ))
              ))}

              {/* Child markers */}
              {displayChildren.filter((child) => child.isPaired && child.position).map((child) => (
                <Marker
                  key={child.id}
                  position={child.position}
                  icon={createCustomIcon(
                    child.status === 'safe' ? '#10b981' :
                    child.status === 'warning' ? '#f59e0b' : '#ef4444',
                    true
                  )}
                  eventHandlers={{
                    click: () => setSelectedChild(child),
                  }}
                >
                  <Popup>
                    <div className="text-text-primary">
                      <strong>{child.name}</strong>
                      <br />
                      Status: <span className="capitalize">{child.status}</span>
                      <br />
                      Last seen: {child.lastSeen}
                      <br />
                      Distance: {formatTrackingDistance(child)}
                      <br />
                      Zone: {child.zone || 'Unknown'}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Route line if child selected */}
              {selectedChild?.isPaired && selectedChild.position && (
                <Polyline
                  positions={[guardianCenter, selectedChild.position]}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 3,
                    dashArray: '10, 10',
                  }}
                />
              )}
            </MapContainer>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <LiveActivityFeed title="Family Realtime Timeline" limit={4} compact includeEvent={includeFamilyTimelineEvent} starterEvents={starterTimelineEvents} />
          </div>
          <div>
            <LiveActivityFeed title="Realtime Alerts" limit={4} compact includeEvent={includeFamilyTimelineEvent} starterEvents={starterTimelineEvents} />
          </div>
        </div>
      </div>

      {/* Lower Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start auto-rows-min">

          {activeFamilyGroup && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-5 border-glow xl:col-span-4 xl:order-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-text-secondary flex items-center gap-2">
                  <Shield className="text-primary" size={20} />
                  Family Code
                  </h3>
                  <p className="text-2xl font-bold text-primary tracking-widest mt-3">{activeFamilyGroup.code}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Session active
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${pairing && !pairing.expired ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                      <Watch size={12} />
                      {pairing && !pairing.expired ? 'Pairing open' : 'Pairing standby'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-primary/25 bg-background/70 p-2 shadow-[0_0_20px_rgba(59,130,246,0.12)]">
                  <QrCode size={54} className="text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-xs text-text-muted">Use with a fresh pair code on the wearable pairing page.</p>
                <button
                  onClick={deleteFamilyGroup}
                  disabled={isDeletingFamilyGroup}
                  className="px-3 py-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-60 text-xs font-medium transition-colors"
                >
                  {isDeletingFamilyGroup ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          )}

          {activeFamilyGroup && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 border-glow space-y-3 xl:col-span-4 xl:order-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-text-secondary flex items-center gap-2">
                  <Shield className="text-primary" size={20} />
                  Geofence Engine
                </h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                  breachCount > 0 ? 'bg-danger/10 text-danger' : warningCount > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${breachCount > 0 ? 'bg-danger' : warningCount > 0 ? 'bg-warning' : 'bg-success'} animate-pulse`} />
                  {breachCount > 0 ? 'Breach' : warningCount > 0 ? 'Watching' : 'Secure'}
                </span>
              </div>
              <div className="relative mx-auto my-2 h-36 w-36 rounded-full border border-primary/20 bg-primary/5 overflow-hidden">
                <motion.div
                  className="absolute inset-3 rounded-full border border-success/30"
                  animate={{ scale: [0.92, 1.04, 0.92], opacity: [0.45, 0.95, 0.45] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-8 rounded-full border border-warning/35"
                  animate={{ scale: [1.08, 0.96, 1.08], opacity: [0.35, 0.8, 0.35] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute left-1/2 top-1/2 h-1 w-16 origin-left rounded-full bg-gradient-to-r from-primary to-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_rgba(59,130,246,0.7)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_38%,rgba(59,130,246,0.12)_39%,transparent_40%)]" />
              </div>
              <form onSubmit={saveGeofenceSettings} className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Warning radius</label>
                  <input
                    type="number"
                    value={geofenceForm.warningRadiusMeters}
                    onChange={(event) => setGeofenceForm({ ...geofenceForm, warningRadiusMeters: event.target.value })}
                    className="w-full px-3 py-2 bg-surfaceLight/70 border border-border rounded-lg text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Safe radius</label>
                  <input
                    type="number"
                    value={geofenceForm.safeRadiusMeters}
                    onChange={(event) => setGeofenceForm({ ...geofenceForm, safeRadiusMeters: event.target.value })}
                    className="w-full px-3 py-2 bg-surfaceLight/70 border border-border rounded-lg text-text-primary"
                  />
                </div>
                <button className="col-span-2 px-3 py-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25">
                  Save Geofence
                </button>
              </form>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-lg font-bold text-warning">{activeGeofence.warningRadiusMeters}m</p>
                  <p className="text-xs text-text-muted">Warning</p>
                </div>
                <div className="p-2 rounded-xl bg-success/5 border border-success/20">
                  <p className="text-lg font-bold text-success">{activeGeofence.safeRadiusMeters}m</p>
                  <p className="text-xs text-text-muted">Safe</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeFamilyGroup && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 border-glow space-y-3 xl:col-span-4 xl:order-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-secondary flex items-center gap-2">
                  <Radio className="text-primary" size={20} />
                  Device Management
                </h3>
                <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">{linkedDeviceCount} linked</span>
              </div>
              <div className="space-y-2">
                {deviceRows.map((device) => {
                  return (
                    <div key={device.deviceId || device.childMemberId} className={`p-3 rounded-xl bg-surfaceLight/70 border transition-all ${device.state.panel}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                            {String(device.deviceType || '').toLowerCase().includes('phone') ? <Smartphone size={18} className="text-primary" /> : <Watch size={18} className="text-primary" />}
                            <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${device.state.dot} shadow-[0_0_12px_currentColor]`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">{device.label || device.deviceId}</p>
                            <p className="text-xs text-text-muted mt-1 capitalize">{device.deviceType || 'device'} assigned to {device.childName}</p>
                            <p className="text-xs text-text-muted mt-1">ID: {device.deviceId || 'Awaiting pairing'}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${device.state.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${device.state.dot}`} />
                          {device.state.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <BatteryMeter value={device.batteryLevel} />
                        </div>
                        <div className="flex items-center gap-1 text-text-secondary">
                          <SignalBars status={device.signalStatus || device.state.label} />
                          <span className="capitalize">{device.signalStatus || 'standby'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Wifi size={13} className={device.state.key === 'offline' ? 'text-danger' : 'text-success'} />
                          <span>{formatRelativeTime(device.lastSeenAt, '-')}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {deviceRows.length === 0 && (
                  <div className="p-5 rounded-xl bg-surfaceLight border border-border text-center text-text-muted">
                    No linked devices yet. Generate a pair code for a child member.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeFamilyGroup && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 border-glow space-y-3 xl:col-span-4 xl:order-3"
            >
              <h3 className="text-sm font-bold text-text-secondary flex items-center gap-2">
                <Users className="text-primary" size={20} />
                Guardians
              </h3>
              <div className="space-y-2">
                {guardianRows.map((guardian) => (
                  <div key={guardian._id || guardian.user} className="p-3 rounded-xl bg-surfaceLight/70 border border-border flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text-primary">{guardian.name || 'Guardian'}</p>
                      <p className="text-xs text-text-muted">
                        {guardian.role || 'guardian'} - {guardian.relationship || 'guardian'}{guardian.phone ? ` - ${guardian.phone}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => editGuardian(guardian)} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => removeGuardian(guardian._id)}
                        disabled={deletingGuardianId === guardian._id || guardian.role === 'leader'}
                        className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingGuardianId === guardian._id ? <span className="block h-[15px] w-[15px] rounded-full border border-danger/40 border-t-danger animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={submitGuardian} className="grid grid-cols-1 gap-2">
                <input value={guardianForm.name} onChange={(event) => setGuardianForm({ ...guardianForm, name: event.target.value })} className="px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Guardian name" required />
                <div className="grid grid-cols-2 gap-2">
                  <input value={guardianForm.relationship} onChange={(event) => setGuardianForm({ ...guardianForm, relationship: event.target.value })} className="px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Relationship" />
                  <input value={guardianForm.phone} onChange={(event) => setGuardianForm({ ...guardianForm, phone: event.target.value })} className="px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Phone" />
                </div>
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                  <Plus size={16} />
                  {editingGuardianId ? 'Save Guardian' : 'Add Guardian'}
                </button>
              </form>
            </motion.div>
          )}

          {/* Children List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4 xl:col-span-8 xl:order-1"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
              <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
                <User className="text-primary" size={22} />
                Child Tracking
              </h3>
              <span className="w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                Tactical roster - {liveTrackedCount} streaming
              </span>
            </div>
            {activeFamilyGroup && (
              <form onSubmit={submitChild} className="glass rounded-xl p-6 border-glow grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_110px_150px_auto] gap-3 items-center">
                <input value={childForm.name} onChange={(event) => setChildForm({ ...childForm, name: event.target.value })} className="w-full px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Child member name" required />
                <input type="number" value={childForm.age} onChange={(event) => setChildForm({ ...childForm, age: event.target.value })} className="px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Age" />
                <input value={childForm.deviceLabel} onChange={(event) => setChildForm({ ...childForm, deviceLabel: event.target.value })} className="px-3 py-2 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Device label" />
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-success/20 text-success rounded-lg hover:bg-success/30">
                  <Plus size={16} />
                  {editingChildId ? 'Save Member' : 'Add Child Member'}
                </button>
              </form>
            )}
            <div className="grid grid-cols-1 gap-3">
              {displayChildren.map((child) => (
                <div key={child.id} className="space-y-2">
                  <ChildCard
                    child={{ ...child, selected: selectedChild?.id === child.id }}
                    onSelect={setSelectedChild}
                    onSOS={handleSOS}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => generatePairing(child)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-surfaceLight border border-border text-text-secondary hover:text-primary hover:border-primary rounded-lg transition-colors text-sm"
                    >
                      <Watch size={16} />
                      Pair
                    </button>
                    <button
                      onClick={() => editChild(child)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg transition-colors text-sm"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => removeChild(child.id)}
                      disabled={deletingChildId === child.id}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-danger/20 text-danger rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingChildId === child.id ? <span className="h-4 w-4 rounded-full border border-danger/40 border-t-danger animate-spin" /> : <Trash2 size={16} />}
                      {deletingChildId === child.id ? 'Removing' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {displayChildren.length === 0 && (
              <div className="glass rounded-2xl p-6 border-glow text-center text-text-muted">
                Join an event or add members to start family tracking.
              </div>
            )}
          </motion.div>

          {pairing && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 border-glow xl:col-span-4 xl:order-7"
            >
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                <Watch className="text-primary" size={20} />
                Temporary Pair Code
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 rounded-xl bg-surfaceLight border border-border">
                  <p className="text-xs text-text-muted">Family Code</p>
                  <p className="text-2xl font-bold text-text-primary tracking-widest">{pairing.familyCode || activeFamilyGroup?.code}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <p className="text-xs text-primary">Pair Code</p>
                  <p className={`text-4xl font-bold tracking-widest ${pairing.expired ? 'text-danger' : 'text-primary'}`}>
                    {pairing.pairingCode}
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-muted mt-3">
                {pairing.expired
                  ? 'This pair code has expired. Generate a fresh code for this child member.'
                  : `Expires at ${pairing.expiresAt ? new Date(pairing.expiresAt).toLocaleTimeString() : 'soon'} and can be used once.`}
              </p>
              <p className="text-sm text-text-muted mt-1">Open /device-pairing in a separate browser or device session and enter both codes.</p>
            </motion.div>
          )}

          {/* Geofence Panel */}
          <AnimatePresence>
            {showGeofencePanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="xl:col-span-4 xl:order-8"
              >
                <GeofencePanel
                  geofences={geofences}
                  onAdd={() => console.log('Add geofence')}
                  onRemove={(index) => setGeofences(geofences.filter((_, i) => i !== index))}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {activeFamilyGroup && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 border-glow xl:col-span-4 xl:order-9"
            >
              <h3 className="text-sm font-bold text-text-secondary mb-3 flex items-center gap-2">
                <AlertTriangle className="text-warning" size={20} />
                Breach History
              </h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {(activeFamilyGroup.geofenceHistory || []).map((item) => (
                  <div
                    key={item._id}
                    className={`p-3 rounded-xl border ${
                      item.status === 'breach'
                        ? 'bg-danger/10 border-danger/30'
                        : 'bg-warning/10 border-warning/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-semibold text-sm ${item.status === 'breach' ? 'text-danger' : 'text-warning'}`}>
                        {item.status === 'breach' ? 'Breach' : 'Warning'}
                      </p>
                      <span className="text-xs text-success">{formatRelativeTime(item.timestamp, 'Just now')}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {Math.round(item.distanceMeters)}m from guardian - {item.zone}
                    </p>
                  </div>
                ))}
                {(activeFamilyGroup.geofenceHistory || []).length === 0 && (
                  <div className="p-4 rounded-xl bg-surfaceLight border border-border text-center text-text-muted">
                    No warnings or breaches recorded.
                  </div>
                )}
              </div>
            </motion.div>
          )}
      </div>
      </>
      )}

      {/* SOS Button */}
      {!isLoadingFamilyGroups && <SOSButton onPress={() => handleSOS(children[0])} isActive={sosActive} />}
    </div>
  )
}

export default FamilyDashboard
