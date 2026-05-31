import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, Radio, Shield, Users, Watch, Zap } from 'lucide-react'
import { useSocket } from '../context/SocketContext'
import { realtimeBreathing } from '../motion/presets'

const eventMeta = {
  EVENT_CREATED: { label: 'Event created', icon: Shield, color: 'text-primary' },
  EVENT_UPDATED: { label: 'Event updated', icon: Shield, color: 'text-primary' },
  FAMILY_GROUP_CREATED: { label: 'Family channel connected', icon: Users, color: 'text-success' },
  FAMILY_GROUP_UPDATED: { label: 'Geofence activation', icon: Shield, color: 'text-primary' },
  FAMILY_GROUP_DELETED: { label: 'Family group deleted', icon: AlertTriangle, color: 'text-danger' },
  JOINED_FAMILY: { label: 'Family room connected', icon: Radio, color: 'text-success' },
  USER_JOINED_FAMILY: { label: 'Guardian connected', icon: Radio, color: 'text-success' },
  FAMILY_REGISTERED: { label: 'Family registered', icon: Users, color: 'text-success' },
  FAMILY_JOINED_EVENT: { label: 'Family joined event', icon: Users, color: 'text-success' },
  FAMILY_CREATED: { label: 'Family created', icon: Users, color: 'text-success' },
  FAMILY_MEMBER_ADDED: { label: 'Member added', icon: Users, color: 'text-primary' },
  MEMBER_ADDED: { label: 'Member added', icon: Users, color: 'text-primary' },
  DEVICE_PAIRED: { label: 'Device paired', icon: Watch, color: 'text-success' },
  DEVICE_STATUS_UPDATED: { label: 'Device connected', icon: Radio, color: 'text-accent' },
  DEVICE_DISCONNECTED: { label: 'Device offline', icon: Radio, color: 'text-danger' },
  DEVICE_RECONNECTED: { label: 'Device reconnected', icon: Radio, color: 'text-success' },
  DEVICE_LOCATION_UPDATED: { label: 'Tracking pulse', icon: Activity, color: 'text-primary' },
  GEOFENCE_ACTIVATED: { label: 'Geofence activated', icon: Shield, color: 'text-success' },
  GEOFENCE_WARNING: { label: 'Geofence warning', icon: AlertTriangle, color: 'text-warning' },
  GEOFENCE_BREACH: { label: 'Geofence breach', icon: AlertTriangle, color: 'text-danger' },
  'new-alert': { label: 'Alert inserted', icon: Zap, color: 'text-danger' },
  SOS_ALERT: { label: 'SOS emergency', icon: Zap, color: 'text-danger' },
  CROWD_HOTSPOT: { label: 'Crowd hotspot', icon: Activity, color: 'text-warning' },
  MEDICAL_INCIDENT: { label: 'Medical incident', icon: AlertTriangle, color: 'text-danger' },
  INCIDENT_CLUSTERED: { label: 'Incident clustered', icon: Activity, color: 'text-warning' },
  HOTSPOT_CREATED: { label: 'Hotspot created', icon: AlertTriangle, color: 'text-danger' },
  SEVERITY_ESCALATED: { label: 'Severity escalated', icon: Zap, color: 'text-danger' },
  CRITICAL_CROWD_SITUATION: { label: 'Critical crowd situation', icon: Zap, color: 'text-danger' },
}

const watchedEvents = Object.keys(eventMeta)

const describePayload = (event, payload = {}) => {
  if (event === 'DEVICE_LOCATION_UPDATED') {
    return `${payload.childName || payload.deviceId || 'Device'} streaming ${payload.signalStatus || 'live'} tracking`
  }
  if (event === 'DEVICE_STATUS_UPDATED') {
    return `${payload.deviceLabel || payload.deviceId || 'Device'} ${payload.status || 'connected'}`
  }
  if (event === 'DEVICE_RECONNECTED') return `${payload.deviceLabel || payload.deviceId || 'Device'} rejoined live tracking`
  if (event === 'FAMILY_GROUP_CREATED') return payload.name ? `${payload.name} ready for live monitoring` : 'Family safety channel is online'
  if (event === 'FAMILY_GROUP_DELETED') return 'Family group removed from live tracking'
  if (event === 'JOINED_FAMILY' || event === 'USER_JOINED_FAMILY') return 'Realtime family room is connected'
  if (event === 'FAMILY_GROUP_UPDATED' || event === 'GEOFENCE_ACTIVATED') {
    return payload.geofenceSettings
      ? `Guardian radius active at ${payload.geofenceSettings.safeRadiusMeters || payload.safeRadiusMeters || 'live'}m`
      : 'Guardian radius and alert rules refreshed'
  }
  if (event === 'FAMILY_REGISTERED' || event === 'FAMILY_JOINED_EVENT') return `${payload.familyCount || 1} active family groups on event`
  if (event === 'FAMILY_MEMBER_ADDED' || event === 'MEMBER_ADDED') return payload.member?.name ? `${payload.member.name} added to family roster` : 'Family roster updated'
  if (event === 'DEVICE_PAIRED') return `${payload.deviceLabel || payload.deviceId || 'Device'} linked to ${payload.childName || 'member'}`
  if (event === 'GEOFENCE_WARNING' || event === 'GEOFENCE_BREACH') return `${Math.round(payload.distanceMeters || 0)}m from guardian zone`
  if (event === 'new-alert') return payload.description || payload.type || 'New incident alert'
  if (event === 'HOTSPOT_CREATED') return `${payload.zone} cluster formed at ${payload.riskScore || 0}% risk`
  if (event === 'SEVERITY_ESCALATED') return `${payload.zone} moved ${payload.previousSeverity} -> ${payload.newSeverity}`
  if (event === 'CRITICAL_CROWD_SITUATION') return payload.description || `${payload.zone || payload.location} requires immediate response`
  if (event === 'INCIDENT_CLUSTERED') return `${payload.incidentCount || 0} incidents grouped near ${payload.zone}`
  return payload.description || payload.name || payload.title || 'Realtime platform update received'
}

const formatLiveAge = (createdAt) => {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
  if (ageSeconds < 2) return 'Live'
  if (ageSeconds < 6) return 'Just now'
  if (ageSeconds < 60) return `${ageSeconds} sec ago`
  return `${Math.floor(ageSeconds / 60)} min ago`
}

const LiveActivityFeed = ({ title = 'Live Activity', limit = 7, compact = false, includeEvent = () => true, starterEvents = [] }) => {
  const { on, off } = useSocket()
  const [items, setItems] = useState(() =>
    starterEvents.slice(0, limit).map((item, index) => ({
      id: `starter-${item.eventName || item.label}-${index}`,
      eventName: item.eventName,
      label: item.label,
      body: item.body,
      createdAt: Date.now() - index * 2500,
      meta: item.meta || eventMeta[item.eventName] || eventMeta.DEVICE_LOCATION_UPDATED,
    }))
  )
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    setItems((current) => {
      const liveItems = current.filter((item) => !String(item.id).startsWith('starter-'))
      const seeded = starterEvents.slice(0, Math.max(0, limit - liveItems.length)).map((item, index) => ({
        id: `starter-${item.eventName || item.label}-${index}`,
        eventName: item.eventName,
        label: item.label,
        body: item.body,
        createdAt: Date.now() - index * 2500,
        meta: item.meta || eventMeta[item.eventName] || eventMeta.DEVICE_LOCATION_UPDATED,
      }))
      return [...liveItems, ...seeded].slice(0, limit)
    })
  }, [limit, starterEvents])

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handlers = watchedEvents.map((eventName) => {
      const handler = (payload) => {
        if (!includeEvent(eventName, payload || {})) return
        const meta = eventMeta[eventName]
        const createdAt = Date.now()
        setItems((current) => [
          {
            id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            eventName,
            label: meta.label,
            body: describePayload(eventName, payload),
            createdAt,
            meta,
          },
          ...current,
        ].slice(0, limit))
      }
      on(eventName, handler)
      return [eventName, handler]
    })

    return () => handlers.forEach(([eventName, handler]) => off(eventName, handler))
  }, [on, off, limit, includeEvent])

  return (
    <div className={`glass rounded-xl ${compact ? 'p-4 border border-border/80' : 'p-6 border-glow'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${compact ? 'text-sm text-text-secondary' : 'text-base text-text-primary'} font-bold flex items-center gap-2`}>
          <Activity className="text-primary" size={compact ? 16 : 18} />
          {title}
        </h3>
        <span className="text-xs px-2 py-1 rounded bg-success/10 text-success flex items-center gap-1">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-success" {...realtimeBreathing} />
          Live
        </span>
      </div>
      <div className={`relative space-y-2 ${compact ? 'max-h-48' : 'max-h-80'} overflow-y-auto pr-1`}>
        {items.length > 1 && <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/50 via-accent/25 to-transparent" />}
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = item.meta.icon
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className={`relative rounded-lg bg-surfaceLight/80 border border-border ${compact ? 'p-2.5 shadow-none' : 'p-3 shadow-[0_0_18px_rgba(59,130,246,0.06)]'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative z-10 w-8 h-8 rounded-full bg-background border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon size={15} className={item.meta.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">{item.label}</p>
                      <span className="text-[11px] text-success shrink-0">{formatLiveAge(item.createdAt || nowTick)}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{item.body}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="p-4 rounded-lg bg-surfaceLight border border-border text-center text-text-muted text-sm">
            Waiting for realtime activity...
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveActivityFeed
