import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSocket } from '../context/SocketContext'
import { alertsAPI, eventsAPI, familyAPI } from '../api'
import { demoStore } from '../services/demoStore'
import { SIMULATION_MODE } from '../services/realtimeSimulation'
import LiveActivityFeed from '../components/LiveActivityFeed'
import AnimatedNumber from '../components/AnimatedNumber'
import {
  AlertTriangle,
  Activity,
  Users,
  MapPin,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  Thermometer,
  Droplets,
  Wind,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'

const AnalyticsCard = ({ icon: Icon, label, value, trend, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="glass rounded-2xl p-6 border-glow hover:shadow-neon transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      <div className={`text-sm px-2 py-1 rounded ${trend > 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
        {trend > 0 ? '+' : ''}{trend}%
      </div>
    </div>
    <p className="text-text-muted text-sm mb-1">{label}</p>
    <p className="text-3xl font-bold text-text-primary">
      {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
    </p>
  </motion.div>
)

const normalizeSeverity = (severity = 'low') => String(severity || 'low').toLowerCase()

const anonymizedFamilyLabel = (familyGroupId) =>
  familyGroupId ? `Family ${String(familyGroupId).slice(-4)}` : 'Family group'

const eventContextFor = (alert, events = []) => {
  const eventId = alert.event || alert.eventId
  const event = events.find((item) => item._id === eventId)
  return event?.name || alert.eventName || alert.eventContext || (eventId ? 'Event safety operation' : 'Event-wide')
}

const isFamilySafetyAlert = (alert = {}) => {
  const type = String(alert.type || alert.title || alert.event || '').toLowerCase()
  return Boolean(alert.familyGroupId || alert.childMemberId || alert.deviceId) ||
    type.includes('geofence') ||
    type.includes('sos') ||
    type.includes('family')
}

const isOrganizerVisibleAlert = (alert = {}) => {
  const type = String(alert.type || alert.title || alert.event || '').toLowerCase()
  const scopes = alert.scopes || []
  return (
    !alert.familyGroupId ||
    scopes.includes('organizer') ||
    type.includes('hotspot') ||
    type.includes('crowd') ||
    type.includes('incident') ||
    type.includes('escalat') ||
    type.includes('geofence') ||
    type.includes('sos')
  )
}

const toOrganizerAlert = (alert, events = []) => {
  const severity = normalizeSeverity(alert.severity)
  const location = alert.zone || alert.location || 'Event Grounds'
  const eventContext = eventContextFor(alert, events)

  if (isFamilySafetyAlert(alert)) {
    const familyLabel = anonymizedFamilyLabel(alert.familyGroupId || alert.groupId)
    const type = String(alert.type || alert.title || '').toLowerCase()
    const title = type.includes('sos')
      ? 'Anonymized Family SOS'
      : type.includes('disconnect') || type.includes('device')
        ? 'Anonymized Device Incident'
        : 'Anonymized Family Safety Incident'
    const distance = Number.isFinite(Number(alert.distanceMeters))
      ? ` Device reported ${Math.round(Number(alert.distanceMeters))}m from configured safety zone.`
      : ''

    return {
      ...alert,
      childMemberId: undefined,
      childName: undefined,
      guardianName: undefined,
      guardian: undefined,
      deviceId: undefined,
      type: title,
      title,
      severity,
      location,
      eventContext,
      familyGroupLabel: familyLabel,
      description: `${familyLabel} reported ${title.toLowerCase()} at ${location}.${distance}`,
    }
  }

  return {
    ...alert,
    severity,
    location,
    eventContext,
    description: alert.description || `${alert.type || 'Event-wide alert'} at ${location}.`,
  }
}

const toOrganizerIncident = (alert, events = []) => {
  const safeAlert = toOrganizerAlert(alert, events)
  return {
    id: safeAlert._id || safeAlert.id,
    title: safeAlert.title || safeAlert.type,
    description: `${safeAlert.location} - ${safeAlert.eventContext}`,
    status: 'active',
    duration: safeAlert.time || 'Live',
    responders: normalizeSeverity(safeAlert.severity) === 'high' || normalizeSeverity(safeAlert.severity) === 'critical' ? 6 : 3,
    severity: safeAlert.severity,
    location: safeAlert.location,
    eventContext: safeAlert.eventContext,
  }
}

const toOrganizerGeofenceEvent = (event) => ({
  ...event,
  childMemberId: undefined,
  childName: undefined,
  deviceId: undefined,
  familyGroupLabel: anonymizedFamilyLabel(event.familyGroupId || event.groupId),
  zone: event.zone || event.location || 'Family safety zone',
})

const includeOrganizerTimelineEvent = (eventName, payload = {}) => {
  if (payload.familyGroupId || payload.childMemberId || payload.childName || payload.deviceId) {
    return ['ORGANIZER_GEOFENCE_EVENT', 'HOTSPOT_CREATED', 'SEVERITY_ESCALATED', 'CRITICAL_CROWD_SITUATION'].includes(eventName)
  }
  return !['DEVICE_LOCATION_UPDATED', 'DEVICE_STATUS_UPDATED', 'DEVICE_DISCONNECTED', 'DEVICE_RECONNECTED', 'GEOFENCE_WARNING', 'GEOFENCE_BREACH', 'SOS_ALERT'].includes(eventName)
}

const AlertFeed = ({ alerts }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className="glass rounded-2xl p-6 border-glow h-full"
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
        <AlertTriangle className="text-warning" size={20} />
        Real-time Alerts
      </h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs text-text-muted">Live</span>
      </div>
    </div>
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {alerts.map((alert, index) => (
        <motion.div
          key={alert.id || index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className={`p-4 rounded-xl border ${
            alert.severity === 'high' || alert.severity === 'critical'
              ? 'bg-danger/10 border-danger/30'
              : alert.severity === 'medium'
              ? 'bg-warning/10 border-warning/30'
              : 'bg-success/10 border-success/30'
          } hover:shadow-neon transition-all cursor-pointer`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={16}
                className={
                  alert.severity === 'high' || alert.severity === 'critical'
                    ? 'text-danger'
                    : alert.severity === 'medium'
                    ? 'text-warning'
                    : 'text-success'
                }
              />
              <span className="font-medium text-text-primary text-sm">{alert.type}</span>
            </div>
            <span className="text-xs text-text-muted">{alert.time}</span>
          </div>
          <p className="text-text-secondary text-sm mb-2">{alert.description}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {alert.location}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface border border-border uppercase">{alert.severity}</span>
            <span>{alert.eventContext}</span>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
)

const IncidentPanel = ({ incidents }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="glass rounded-2xl p-6 border-glow h-full"
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
        <Activity className="text-primary" size={20} />
        Live Incidents
      </h3>
      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
        {incidents.length} Active
      </span>
    </div>
    <div className="space-y-3">
      {incidents.map((incident, index) => (
        <motion.div
          key={incident.id || index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="p-4 rounded-xl bg-surfaceLight border border-border hover:border-primary transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium text-text-primary text-sm">{incident.title}</h4>
              <p className="text-xs text-text-muted mt-1">{incident.description}</p>
            </div>
            <div className={`w-2 h-2 rounded-full ${
              incident.status === 'active' ? 'bg-danger animate-pulse' : 'bg-warning'
            }`} />
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted mt-3">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{incident.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{incident.responders} responders</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
)

const HeatmapSection = ({ data }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.4 }}
    className="glass rounded-2xl p-6 border-glow"
  >
    <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
      <MapPin className="text-accent" size={20} />
      Incident Heatmap
    </h3>
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="x" stroke="#9ca3af" />
        <YAxis dataKey="y" stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          itemStyle={{ color: '#f9fafb' }}
        />
        <Scatter fill="#3b82f6">
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.severity === 'high'
                  ? '#ef4444'
                  : entry.severity === 'medium'
                  ? '#f59e0b'
                  : '#10b981'
              }
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  </motion.div>
)

const TrendChart = ({ data }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.5 }}
    className="glass rounded-2xl p-6 border-glow"
  >
    <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
      <TrendingUp className="text-success" size={20} />
      Alert Trends
    </h3>
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          itemStyle={{ color: '#f9fafb' }}
        />
        <Area
          type="monotone"
          dataKey="alerts"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorPrimary)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </motion.div>
)

const EnvironmentalStats = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.6 }}
    className="glass rounded-2xl p-6 border-glow"
  >
    <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
      <Shield className="text-primary" size={20} />
      Environmental Monitoring
    </h3>
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-surfaceLight border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Thermometer className="text-warning" size={18} />
          <span className="text-text-muted text-sm">Temperature</span>
        </div>
        <p className="text-2xl font-bold text-text-primary">24°C</p>
      </div>
      <div className="p-4 rounded-xl bg-surfaceLight border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="text-primary" size={18} />
          <span className="text-text-muted text-sm">Humidity</span>
        </div>
        <p className="text-2xl font-bold text-text-primary">65%</p>
      </div>
      <div className="p-4 rounded-xl bg-surfaceLight border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Wind className="text-accent" size={18} />
          <span className="text-text-muted text-sm">Air Quality</span>
        </div>
        <p className="text-2xl font-bold text-text-primary">Good</p>
      </div>
      <div className="p-4 rounded-xl bg-surfaceLight border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="text-success" size={18} />
          <span className="text-text-muted text-sm">Power</span>
        </div>
        <p className="text-2xl font-bold text-text-primary">98%</p>
      </div>
    </div>
  </motion.div>
)

const OrganizerDashboard = () => {
  const { isConnected, on, off } = useSocket()
  const [alerts, setAlerts] = useState([])
  const [incidents, setIncidents] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [familySummary, setFamilySummary] = useState([])
  const [stats, setStats] = useState(demoStore.getStats())
  const [organizerEvents, setOrganizerEvents] = useState([])
  const [geofenceEvents, setGeofenceEvents] = useState([])
  const [crowdZones, setCrowdZones] = useState([])
  const [hotspotZones, setHotspotZones] = useState([])
  const [escalationTimeline, setEscalationTimeline] = useState([])

  const applySnapshot = async () => {
    try {
      const state = demoStore.getState()
      const requestTimestamp = Date.now()
      const [alertResponse, eventResponse, eventStatsResponse] = await Promise.all([
        alertsAPI.getAll(),
        eventsAPI.getAll({ _ts: requestTimestamp }),
        eventsAPI.getStats({ _ts: requestTimestamp }),
      ])
      const events = eventResponse.data.data || []
      setOrganizerEvents(events)
      const eventStats = eventStatsResponse.data.data || {}
      const nextAlerts = (alertResponse.data.data || [])
        .filter(isOrganizerVisibleAlert)
        .map((alert) => toOrganizerAlert(alert, events))
      const activeEventId = events.find((event) => ['active', 'ongoing', 'published'].includes(event.status))?._id || events[0]?._id
      const response = await familyAPI.getOrganizerFamilySummary(activeEventId)
      const familyData = response.data.data || {}
      const familyGroups = Array.isArray(familyData) ? familyData : familyData.groups || []
      const familyMetrics = Array.isArray(familyData) ? null : familyData.metrics
      setFamilySummary(
        familyGroups.map((group) => ({
          ...group,
          label: anonymizedFamilyLabel(group.groupId),
        }))
      )
      setAlerts(nextAlerts)
      setStats((currentStats) => ({
        ...currentStats,
        activeEvents: eventStats.active || 0,
        totalEvents: eventStats.total || 0,
        eventCapacity: eventStats.capacity || 0,
        activeAlerts: nextAlerts.filter((alert) => alert.status !== 'resolved').length,
        totalAlerts: nextAlerts.length,
        familyGroups: familyMetrics?.familyCount ?? familyGroups.length,
        activeFamilies: familyMetrics?.activeFamilies ?? familyGroups.length,
        linkedDevices: familyMetrics?.linkedDevices ?? familyGroups.reduce((total, group) => total + Number(group.linkedDevices || 0), 0),
        totalUsers: familyMetrics?.memberCount ?? familyGroups.reduce((total, group) => total + Number(group.memberCount || 0), 0),
        totalAttendees: eventStats.totalAttendees || familyMetrics?.attendeeCount || 0,
      }))
      setIncidents(
        nextAlerts
          .filter((alert) => alert.status !== 'resolved')
          .slice(0, 6)
          .map((alert) => toOrganizerIncident(alert, events))
      )
      setHeatmapData(
        state.familyGroups.flatMap((group, groupIndex) =>
          group.childMembers
            .filter((member) => member.lastLocation?.coordinates)
            .map((member, memberIndex) => ({
              x: 20 + groupIndex * 18 + memberIndex * 8,
              y: member.geofenceStatus === 'outside' ? 80 : 35 + memberIndex * 10,
              severity: member.geofenceStatus === 'outside' ? 'high' : 'low',
            }))
        )
      )
      setGeofenceEvents(
        state.familyGroups
          .flatMap((group) =>
            (group.geofenceHistory || []).map((item) => toOrganizerGeofenceEvent({
              ...item,
              familyGroupId: item.familyGroupId || group._id,
            }))
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 8)
      )
      const buckets = Array.from({ length: 6 }, (_, index) => ({ time: `${index * 4}:00`, alerts: 0 }))
      nextAlerts.forEach((alert) => {
        const hour = new Date(alert.createdAt || Date.now()).getHours()
        buckets[Math.min(5, Math.floor(hour / 4))].alerts += 1
      })
      setTrendData(buckets)
    } catch (error) {
      console.error('Failed to load organizer dashboard:', error)
    }
  }

  useEffect(() => {
    applySnapshot()
    return demoStore.subscribe(() => applySnapshot())
  }, [])

  useEffect(() => {
    const addAlert = (alert) => {
      if (!isOrganizerVisibleAlert(alert)) return
      setAlerts((prev) => [{ ...toOrganizerAlert(alert, organizerEvents), time: 'Just now' }, ...prev].slice(0, 10))
    }
    const addGeofenceEvent = (event) => {
      setGeofenceEvents((prev) => [toOrganizerGeofenceEvent(event), ...prev].slice(0, 8))
    }
    const updateCrowd = (payload) => setCrowdZones(payload.zones || [])
    const updateHotspots = (payload) => setHotspotZones(payload.hotspots || [])
    const addEscalation = (event) => {
      setEscalationTimeline((prev) => [
        {
          id: `${event.id || event._id}-${Date.now()}`,
          zone: event.zone || event.location,
          severity: event.newSeverity || event.severity,
          previousSeverity: event.previousSeverity,
          riskScore: event.riskScore,
          summary: event.affectedSummary || event.description,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 10))
    }
    const updateIncident = (incident) => {
      const safeIncident = isFamilySafetyAlert(incident)
        ? toOrganizerIncident({
            ...incident,
            _id: incident.id,
            type: incident.title || incident.type,
            severity: incident.severity,
            location: incident.zone || incident.location,
            familyGroupId: incident.familyGroupId,
          }, organizerEvents)
        : {
            ...incident,
            title: incident.title || incident.type || 'Event Incident',
            description: `${incident.zone || incident.location || 'Event Grounds'} - ${incident.eventContext || 'Event-wide'}`,
            location: incident.zone || incident.location || 'Event Grounds',
            eventContext: incident.eventContext || 'Event-wide',
          }
      setIncidents((prev) => {
        const index = prev.findIndex((i) => i.id === safeIncident.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = safeIncident
          return updated
        }
        return [...prev, safeIncident]
      })
    }

    on('new-alert', addAlert)
    on('EVENT_CREATED', applySnapshot)
    on('EVENT_UPDATED', applySnapshot)
    on('EVENT_DELETED', applySnapshot)
    on('FAMILY_GROUP_CREATED', applySnapshot)
    on('FAMILY_GROUP_DELETED', applySnapshot)
    on('FAMILY_REGISTERED', applySnapshot)
    on('FAMILY_JOINED_EVENT', applySnapshot)
    on('FAMILY_CREATED', applySnapshot)
    on('ORGANIZER_FAMILY_REGISTERED', applySnapshot)
    on('FAMILY_MEMBER_ADDED', applySnapshot)
    on('MEMBER_ADDED', applySnapshot)
    on('FAMILY_MEMBER_REMOVED', applySnapshot)
    on('FAMILY_GUARDIAN_REMOVED', applySnapshot)
    on('DEVICE_PAIRED', applySnapshot)
    on('DEVICE_LOCATION_UPDATED', applySnapshot)
    on('DEVICE_STATUS_UPDATED', applySnapshot)
    on('DEVICE_DISCONNECTED', applySnapshot)
    on('DEVICE_RECONNECTED', applySnapshot)
    on('GEOFENCE_WARNING', applySnapshot)
    on('GEOFENCE_BREACH', applySnapshot)
    on('ORGANIZER_GEOFENCE_EVENT', addGeofenceEvent)
    on('CROWD_DENSITY_UPDATE', updateCrowd)
    on('HOTSPOT_ZONES_UPDATED', updateHotspots)
    on('HOTSPOT_CREATED', addEscalation)
    on('SEVERITY_ESCALATED', addEscalation)
    on('CRITICAL_CROWD_SITUATION', addEscalation)
    on('incident-update', updateIncident)

    return () => {
      off('new-alert', addAlert)
      off('EVENT_CREATED', applySnapshot)
      off('EVENT_UPDATED', applySnapshot)
      off('EVENT_DELETED', applySnapshot)
      off('FAMILY_GROUP_CREATED', applySnapshot)
      off('FAMILY_GROUP_DELETED', applySnapshot)
      off('FAMILY_REGISTERED', applySnapshot)
      off('FAMILY_JOINED_EVENT', applySnapshot)
      off('FAMILY_CREATED', applySnapshot)
      off('ORGANIZER_FAMILY_REGISTERED', applySnapshot)
      off('FAMILY_MEMBER_ADDED', applySnapshot)
      off('MEMBER_ADDED', applySnapshot)
      off('FAMILY_MEMBER_REMOVED', applySnapshot)
      off('FAMILY_GUARDIAN_REMOVED', applySnapshot)
      off('DEVICE_PAIRED', applySnapshot)
      off('DEVICE_LOCATION_UPDATED', applySnapshot)
      off('DEVICE_STATUS_UPDATED', applySnapshot)
      off('DEVICE_DISCONNECTED', applySnapshot)
      off('DEVICE_RECONNECTED', applySnapshot)
      off('GEOFENCE_WARNING', applySnapshot)
      off('GEOFENCE_BREACH', applySnapshot)
      off('ORGANIZER_GEOFENCE_EVENT', addGeofenceEvent)
      off('CROWD_DENSITY_UPDATE', updateCrowd)
      off('HOTSPOT_ZONES_UPDATED', updateHotspots)
      off('HOTSPOT_CREATED', addEscalation)
      off('SEVERITY_ESCALATED', addEscalation)
      off('CRITICAL_CROWD_SITUATION', addEscalation)
      off('incident-update', updateIncident)
    }
  }, [on, off, organizerEvents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-warning">Incident Command</p>
          <h1 className="text-3xl font-bold text-text-primary text-glow">Organizer Ops Center</h1>
          <p className="text-text-muted mt-1">Active event coordination, responder dispatch, zone monitoring, and emergency workflow</p>
        </div>
        <div className="flex items-center gap-4">
          {SIMULATION_MODE && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/15 text-warning border border-warning/30">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <span className="text-sm font-medium">Simulation Mode Active</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-sm font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </motion.div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={stats.activeAlerts}
          trend={15}
          color="bg-danger"
          delay={0}
        />
        <AnalyticsCard
          icon={Activity}
          label="Live Incidents"
          value={incidents.filter((i) => i.status === 'active').length}
          trend={8}
          color="bg-warning"
          delay={0.1}
        />
        <AnalyticsCard
          icon={Users}
          label="Families"
          value={stats.familyGroups}
          trend={12}
          color="bg-primary"
          delay={0.2}
        />
        <AnalyticsCard
          icon={Shield}
          label="Linked Devices"
          value={stats.linkedDevices}
          trend={5}
          color="bg-success"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <div className="glass rounded-2xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <MapPin className="text-warning" size={20} />
              Active Event Coordination
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning">Command workflow</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              ['Detect', stats.activeAlerts, 'bg-danger/10 border-danger/30 text-danger'],
              ['Assess', hotspotZones.length || 2, 'bg-warning/10 border-warning/30 text-warning'],
              ['Dispatch', incidents.filter((i) => i.status === 'active').length, 'bg-primary/10 border-primary/30 text-primary'],
              ['Resolve', stats.activeFamilies || stats.familyGroups, 'bg-success/10 border-success/30 text-success'],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl border p-4 ${tone}`}>
                <p className="text-xs uppercase tracking-[0.18em] opacity-80">{label}</p>
                <p className="mt-2 text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border-glow">
          <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <Zap className="text-danger" size={20} />
            Emergency Workflow
          </h3>
          <div className="space-y-3">
            {['Nearest responder standby', 'Family incident anonymization active', 'Escalation channel armed'].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-xl bg-surfaceLight border border-border p-3">
                <span className="text-sm text-text-secondary">{item}</span>
                <span className={`text-xs px-2 py-1 rounded ${index === 0 ? 'bg-success/10 text-success' : index === 1 ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>Ready</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <LiveActivityFeed title="Realtime Event Feed" includeEvent={includeOrganizerTimelineEvent} />
        <div className="glass rounded-2xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Activity className="text-warning" size={20} />
              Crowd Hotspots
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">Live density</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(crowdZones.length ? crowdZones : [
              { name: 'Main Gate', density: 64 },
              { name: 'Family Zone', density: 32 },
              { name: 'Food Court', density: 51 },
              { name: 'Medical Bay', density: 22 },
            ]).map((zone) => (
              <div key={zone.name} className="p-4 rounded-xl bg-surfaceLight border border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-text-primary">{zone.name}</p>
                  <span className={zone.density > 75 ? 'text-danger text-sm' : zone.density > 55 ? 'text-warning text-sm' : 'text-success text-sm'}>
                    {zone.density}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className={zone.density > 75 ? 'h-full bg-danger' : zone.density > 55 ? 'h-full bg-warning' : 'h-full bg-success'}
                    animate={{ width: `${zone.density}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="glass rounded-2xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <AlertTriangle className="text-danger" size={20} />
              Hotspot Zones
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-danger/10 text-danger">Escalation clusters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(hotspotZones.length ? hotspotZones : [
              { id: 'standby-stage', zone: 'Stage Front', displaySeverity: 'medium', incidentCount: 2, riskScore: 58, affectedSummary: 'Awaiting live cluster data' },
              { id: 'standby-family', zone: 'Family Zone', displaySeverity: 'low', incidentCount: 1, riskScore: 34, affectedSummary: 'Normal family traffic' },
            ]).map((hotspot) => {
              const severity = hotspot.displaySeverity || String(hotspot.severity || 'LOW').toLowerCase()
              return (
                <motion.div
                  layout
                  key={hotspot.id}
                  className={`p-4 rounded-xl border ${
                    severity === 'critical'
                      ? 'bg-danger/20 border-danger/60 critical-flash'
                      : severity === 'high'
                        ? 'bg-danger/10 border-danger/30'
                        : severity === 'medium'
                          ? 'bg-warning/10 border-warning/30'
                          : 'bg-success/10 border-success/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-text-primary">{hotspot.zone}</p>
                      <p className="text-xs text-text-secondary mt-1">{hotspot.affectedSummary}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded uppercase ${
                      severity === 'critical' || severity === 'high' ? 'bg-danger/20 text-danger' : severity === 'medium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                    }`}>
                      {severity}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-bold text-text-primary">{hotspot.incidentCount}</p>
                      <p className="text-xs text-text-muted">Incidents</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-warning">{hotspot.riskScore}</p>
                      <p className="text-xs text-text-muted">Risk</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-primary">{hotspot.radiusMeters || 0}m</p>
                      <p className="text-xs text-text-muted">Radius</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border-glow">
          <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <Zap className="text-danger" size={20} />
            Escalation Timeline
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {escalationTimeline.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-surfaceLight border border-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{item.zone}</p>
                  <span className="text-xs uppercase text-danger">{item.severity}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{item.summary}</p>
                <p className="text-[11px] text-text-muted mt-2">{new Date(item.timestamp).toLocaleTimeString()}</p>
              </motion.div>
            ))}
            {escalationTimeline.length === 0 && (
              <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted text-sm">
                Awaiting hotspot creation or severity escalation.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Feed */}
        <div className="lg:col-span-1">
          <AlertFeed alerts={alerts} />
        </div>

        {/* Incident Panel */}
        <div className="lg:col-span-1">
          <IncidentPanel incidents={incidents} />
        </div>

        {/* Environmental Stats */}
        <div className="lg:col-span-1">
          <EnvironmentalStats />
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border-glow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Users className="text-primary" size={20} />
            Family Groups
          </h3>
          <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">Anonymized</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {familySummary.map((group) => (
            <div key={group.groupId} className="p-4 rounded-xl bg-surfaceLight border border-border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-text-primary">{group.label}</h4>
                <span className={`text-xs px-2 py-1 rounded ${group.status === 'attention' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                  {group.status || 'normal'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-text-primary">{group.memberCount}</p>
                  <p className="text-xs text-text-muted">Members</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{group.linkedDevices}</p>
                  <p className="text-xs text-text-muted">Devices</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-warning">{group.geofenceBreaches}</p>
                  <p className="text-xs text-text-muted">Breaches</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border-glow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <MapPin className="text-warning" size={20} />
            Geofence Zone Events
          </h3>
          <span className="text-xs px-2 py-1 rounded bg-warning/20 text-warning">Anonymized</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <AnimatePresence initial={false}>
          {geofenceEvents.map((event) => (
            <motion.div
              key={event._id || `${event.familyGroupId}-${event.timestamp}`}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              className={`p-4 rounded-xl border ${
                event.status === 'breach' ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-text-primary">{event.familyGroupLabel}</p>
                <span className={`text-xs px-2 py-1 rounded ${event.status === 'breach' ? 'text-danger bg-danger/10' : 'text-warning bg-warning/10'}`}>
                  {event.status}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{event.zone}</p>
              <p className="text-xs text-text-muted mt-2">
                {Math.round(event.distanceMeters || 0)}m from guardian zone
              </p>
            </motion.div>
          ))}
          </AnimatePresence>
          {geofenceEvents.length === 0 && (
            <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted">
              No geofence warnings or breaches yet.
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatmapSection data={heatmapData} />
        <TrendChart data={trendData} />
      </div>
    </div>
  )
}

export default OrganizerDashboard
