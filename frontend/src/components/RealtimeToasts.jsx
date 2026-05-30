import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Volume2, X } from 'lucide-react'
import { familyAPI } from '../api'
import { useSocket } from '../context/SocketContext'

const tone = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 680
    gain.gain.value = 0.035
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.14)
  } catch {
    // Browser audio policies can block this until the user interacts.
  }
}

const severityClass = (severity) => {
  if (severity === 'high' || severity === 'critical') return 'border-danger/60 bg-danger/15 text-danger'
  if (severity === 'medium') return 'border-warning/60 bg-warning/15 text-warning'
  return 'border-primary/60 bg-primary/15 text-primary'
}

const devicesForMember = (member) => {
  if (Array.isArray(member.devices)) return member.devices
  if (!member.wearableDeviceId) return []
  return [{ deviceId: member.wearableDeviceId }]
}

const RealtimeToasts = () => {
  const { on, off } = useSocket()
  const location = useLocation()
  const [toasts, setToasts] = useState([])
  const [familyScope, setFamilyScope] = useState({ familyIds: new Set(), childIds: new Set(), deviceIds: new Set() })
  const timers = useRef(new Map())
  const isFamilyDashboard = location.pathname.startsWith('/family')
  const isOrganizerDashboard = location.pathname.startsWith('/organizer')

  useEffect(() => {
    if (!isFamilyDashboard) return

    let active = true
    familyAPI.getMyGroups()
      .then((response) => {
        if (!active) return
        const groups = response.data.data || []
        setFamilyScope({
          familyIds: new Set(groups.map((group) => group?._id || group?.familyGroupId).filter(Boolean).map(String)),
          childIds: new Set(groups.flatMap((group) => (group?.childMembers || []).map((member) => member._id).filter(Boolean).map(String))),
          deviceIds: new Set(
            groups.flatMap((group) =>
              (group?.childMembers || []).flatMap((member) =>
                devicesForMember(member).map((device) => device.deviceId).filter(Boolean).map(String)
              )
            )
          ),
        })
      })
      .catch((error) => console.error('Failed to load family toast scope:', error))

    return () => {
      active = false
    }
  }, [isFamilyDashboard])

  useEffect(() => {
    const isOwnFamilyAlert = (alert = {}) => {
      const type = String(alert.type || alert.title || '').toLowerCase()
      const familyAlert = type.includes('geofence') || type.includes('sos') || type.includes('disconnect') || type.includes('device')
      if (!familyAlert) return false

      const familyId = alert.familyGroupId || alert.groupId || alert.familyId
      const deviceId = alert.deviceId
      const childId = alert.childMemberId || alert.childId || alert.memberId
      const familyMatches = familyId && familyScope.familyIds.has(String(familyId))
      const deviceMatches = deviceId && familyScope.deviceIds.has(String(deviceId))
      const childMatches = childId && familyScope.childIds.has(String(childId))

      if (familyId && !familyMatches) return false
      if (deviceId && !deviceMatches) return false
      if (childId && !childMatches) return false
      return Boolean(familyMatches || deviceMatches || childMatches)
    }

    const isFamilySafetyAlert = (alert = {}) => {
      const type = String(alert.type || alert.title || '').toLowerCase()
      return Boolean(alert.familyGroupId || alert.childMemberId || alert.childName || alert.deviceId) ||
        type.includes('geofence') ||
        type.includes('sos') ||
        type.includes('family')
    }

    const handleToast = (alert) => {
      if (isFamilyDashboard && !isOwnFamilyAlert(alert)) return
      const organizerFamilyAlert = isOrganizerDashboard && isFamilySafetyAlert(alert)
      const locationLabel = alert.zone || alert.location || 'Event Grounds'
      const toast = {
        id: alert._id || alert.id || `toast-${Date.now()}`,
        type: organizerFamilyAlert
          ? (String(alert.type || '').toLowerCase().includes('sos') ? 'Anonymized Family SOS' : 'Anonymized Family Safety Incident')
          : alert.type || alert.title || 'Safety Alert',
        severity: alert.severity || 'medium',
        description: organizerFamilyAlert
          ? `Family group reported a safety incident at ${locationLabel}.`
          : alert.description || alert.message || 'Realtime safety update received.',
        timestamp: alert.createdAt || new Date().toISOString(),
      }

      setToasts((prev) => [toast, ...prev.filter((item) => item.id !== toast.id)].slice(0, 4))
      if (toast.severity === 'high' || toast.severity === 'critical') tone()

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id))
        timers.current.delete(toast.id)
      }, 6500)
      timers.current.set(toast.id, timer)
    }

    on('toast-alert', handleToast)
    on('new-alert', handleToast)

    return () => {
      off('toast-alert')
      off('new-alert')
      timers.current.forEach((timer) => clearTimeout(timer))
      timers.current.clear()
    }
  }, [on, off, isFamilyDashboard, isOrganizerDashboard, familyScope])

  if (!toasts.length) return null

  return (
    <div className="fixed right-5 top-24 z-[1000] w-[min(92vw,380px)] space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass rounded-xl border p-4 shadow-neon animate-toast-in ${severityClass(toast.severity)} ${
            toast.severity === 'high' || toast.severity === 'critical' ? 'critical-flash' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-text-primary">{toast.type}</p>
                <span className="text-[11px] text-text-muted whitespace-nowrap">
                  {new Date(toast.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1">{toast.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                <Volume2 size={12} />
                <span className="capitalize">{toast.severity} alert</span>
              </div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              className="text-text-muted hover:text-text-primary"
              aria-label="Dismiss alert"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default RealtimeToasts
