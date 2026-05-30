import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSocket } from '../context/SocketContext'
import LiveActivityFeed from '../components/LiveActivityFeed'
import AnimatedNumber from '../components/AnimatedNumber'
import { Activity, AlertTriangle, MapPin, Navigation, Radio, Shield, Signal, Users, Wifi, Database, Cpu, Zap } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const initialResponders = [
  { id: 'resp-1', name: 'Unit Alpha', role: 'Medical', zone: 'Medical Bay', distance: 180, status: 'available', eta: '2 min' },
  { id: 'resp-2', name: 'Unit Beta', role: 'Security', zone: 'Main Gate', distance: 260, status: 'assigned', eta: '4 min' },
  { id: 'resp-3', name: 'Unit Gamma', role: 'Crowd Control', zone: 'Stage Front', distance: 320, status: 'available', eta: '5 min' },
  { id: 'resp-4', name: 'Unit Delta', role: 'Family Assist', zone: 'Family Zone', distance: 140, status: 'available', eta: '1 min' },
]

const nextMetricPoint = (previous = {}, overrides = {}) => ({
  time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
  alerts: overrides.alerts ?? Math.max(0, Math.round((previous.alerts || 2) + Math.random() * 4 - 1)),
  density: overrides.density ?? Math.max(15, Math.min(95, Math.round((previous.density || 52) + Math.random() * 14 - 6))),
  incidents: overrides.incidents ?? Math.max(0, Math.round((previous.incidents || 3) + Math.random() * 3 - 1)),
  breaches: overrides.breaches ?? Math.max(0, Math.round((previous.breaches || 1) + Math.random() * 2 - 0.5)),
})

const Monitoring = () => {
  const { isConnected, on, off } = useSocket()
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    network: 0,
    database: 0,
  })
  const [logs, setLogs] = useState([])
  const [socketEvents, setSocketEvents] = useState([])
  const [serverFeed, setServerFeed] = useState([])
  const [crowdZones, setCrowdZones] = useState([
    { name: 'Main Gate', density: 62, severity: 'medium' },
    { name: 'Family Zone', density: 34, severity: 'low' },
    { name: 'Medical Bay', density: 24, severity: 'low' },
    { name: 'Food Court', density: 48, severity: 'medium' },
  ])
  const [incidentStream, setIncidentStream] = useState([])
  const [escalationFeed, setEscalationFeed] = useState([])
  const [hotspotActivity, setHotspotActivity] = useState([])
  const [responders, setResponders] = useState(initialResponders)
  const [assignments, setAssignments] = useState([])
  const [chartData, setChartData] = useState(() =>
    Array.from({ length: 10 }, (_, index) => nextMetricPoint({ alerts: 2 + index, density: 42 + index, incidents: 2, breaches: 1 }))
  )

  const activeFamilies = Math.max(3, crowdZones.length + incidentStream.filter((item) => item.type?.includes('Geofence')).length)
  const connectedDevices = Math.max(4, Math.round((metrics.activeDevices || 3) + responders.filter((unit) => unit.status !== 'offline').length))
  const activeIncidents = Math.max(incidentStream.length, escalationFeed.length, 2)
  const availableResponders = responders.filter((responder) => responder.status === 'available').length

  useEffect(() => {
    const pushSocketEvent = (eventName, payload = {}) => {
      setSocketEvents((prev) => [
        {
          id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          eventName,
          payload,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 18))
    }

    const pushServerFeed = (message, tone = 'info') => {
      setServerFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          message,
          tone,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 16))
    }

    const updateMetrics = (data) => {
      setMetrics(data)
      pushSocketEvent('system-metrics', data)
      setChartData((prev) => [...prev.slice(-17), nextMetricPoint(prev[prev.length - 1], { incidents: activeIncidents })])
    }

    const addLog = (log) => {
      setLogs(prev => [log, ...prev].slice(0, 50))
      pushServerFeed(log.message, log.level)
    }

    const updateCrowd = (payload) => {
      setCrowdZones(payload.zones || [])
      pushSocketEvent('CROWD_DENSITY_UPDATE', payload)
      const averageDensity = Math.round((payload.zones || []).reduce((sum, zone) => sum + zone.density, 0) / Math.max(1, (payload.zones || []).length))
      setChartData((prev) => [...prev.slice(-17), nextMetricPoint(prev[prev.length - 1], { density: averageDensity })])
    }

    const scenarioLog = (scenario) => {
      pushSocketEvent(scenario.event || scenario.type || 'scenario-event', scenario)
      pushServerFeed(`${scenario.type} routed through command center`, ['HIGH', 'CRITICAL', 'high', 'critical'].includes(scenario.severity) ? 'error' : 'warning')
      setIncidentStream((prev) => [
        {
          id: `${scenario.type}-${Date.now()}`,
          type: scenario.type,
          severity: scenario.severity,
          location: scenario.location || scenario.zone,
          description: scenario.description,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12))
      addLog({
        level: ['HIGH', 'CRITICAL', 'high', 'critical'].includes(scenario.severity) ? 'error' : 'warning',
        timestamp: new Date().toLocaleTimeString(),
        message: scenario.description || `${scenario.type} scenario active`,
      })
      setChartData((prev) => [...prev.slice(-17), nextMetricPoint(prev[prev.length - 1], { alerts: (prev[prev.length - 1]?.alerts || 1) + 1, incidents: activeIncidents + 1 })])
    }

    const addEscalation = (payload) => {
      pushSocketEvent(payload.newSeverity ? 'SEVERITY_ESCALATED' : 'HOTSPOT_CREATED', payload)
      pushServerFeed(`${payload.zone || payload.location} escalation: ${payload.newSeverity || payload.severity}`, 'error')
      const item = {
        id: `${payload.id || payload._id}-${Date.now()}`,
        zone: payload.zone || payload.location,
        severity: payload.newSeverity || payload.severity,
        summary: payload.affectedSummary || payload.description,
        riskScore: payload.riskScore,
        timestamp: new Date().toLocaleTimeString(),
      }
      setEscalationFeed((prev) => [item, ...prev].slice(0, 10))
      setHotspotActivity((prev) => [item, ...prev].slice(0, 10))
      setChartData((prev) => [...prev.slice(-17), nextMetricPoint(prev[prev.length - 1], { alerts: (prev[prev.length - 1]?.alerts || 1) + 2, incidents: activeIncidents + 1 })])
    }

    const trackDevice = (payload) => {
      pushSocketEvent('DEVICE_STATUS_UPDATED', payload)
      pushServerFeed(`${payload.deviceId || 'Device'} ${payload.status || 'streaming'} with ${payload.signalStatus || 'live'} signal`)
    }

    const trackGeofence = (payload) => {
      pushSocketEvent('GEOFENCE_BREACH', payload)
      setChartData((prev) => [...prev.slice(-17), nextMetricPoint(prev[prev.length - 1], { breaches: (prev[prev.length - 1]?.breaches || 0) + 1 })])
    }

    on('system-metrics', updateMetrics)
    on('system-log', addLog)
    on('CROWD_DENSITY_UPDATE', updateCrowd)
    on('CROWD_HOTSPOT', scenarioLog)
    on('MEDICAL_INCIDENT', scenarioLog)
    on('SOS_ALERT', scenarioLog)
    on('HOTSPOT_CREATED', addEscalation)
    on('SEVERITY_ESCALATED', addEscalation)
    on('CRITICAL_CROWD_SITUATION', addEscalation)
    on('DEVICE_STATUS_UPDATED', trackDevice)
    on('DEVICE_LOCATION_UPDATED', trackDevice)
    on('GEOFENCE_BREACH', trackGeofence)

    return () => {
      off('system-metrics', updateMetrics)
      off('system-log', addLog)
      off('CROWD_DENSITY_UPDATE', updateCrowd)
      off('CROWD_HOTSPOT', scenarioLog)
      off('MEDICAL_INCIDENT', scenarioLog)
      off('SOS_ALERT', scenarioLog)
      off('HOTSPOT_CREATED', addEscalation)
      off('SEVERITY_ESCALATED', addEscalation)
      off('CRITICAL_CROWD_SITUATION', addEscalation)
      off('DEVICE_STATUS_UPDATED', trackDevice)
      off('DEVICE_LOCATION_UPDATED', trackDevice)
      off('GEOFENCE_BREACH', trackGeofence)
    }
  }, [on, off, activeIncidents])

  const assignNearestResponder = () => {
    const nearest = responders
      .filter((responder) => responder.status === 'available')
      .sort((a, b) => a.distance - b.distance)[0]
    const incident = incidentStream[0] || escalationFeed[0] || { type: 'Crowd Hotspot', location: 'Main Gate', severity: 'MEDIUM' }
    if (!nearest) return

    setResponders((prev) =>
      prev.map((responder) =>
        responder.id === nearest.id ? { ...responder, status: 'assigned', zone: incident.location || incident.zone, eta: 'En route' } : responder
      )
    )
    setAssignments((prev) => [
      {
        id: `assign-${Date.now()}`,
        responder: nearest.name,
        incident: incident.type || 'Escalation',
        zone: incident.location || incident.zone,
        eta: nearest.eta,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ].slice(0, 8))
    setServerFeed((prev) => [
      {
        id: `assign-log-${Date.now()}`,
        message: `${nearest.name} assigned to ${incident.location || incident.zone}`,
        tone: 'info',
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ].slice(0, 16))
  }

  const MetricCard = ({ icon: Icon, label, value, unit, color }) => (
    <motion.div layout className="glass rounded-xl p-6 border-glow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
          <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="text-3xl font-bold text-text-primary">
        <AnimatedNumber value={value} /><span className="text-lg text-text-muted ml-1">{unit}</span>
      </p>
      <div className="mt-3 h-2 bg-surfaceLight rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">System Monitoring</h1>
          <p className="text-text-muted mt-1">Real-time system performance and command-center logs</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
          <Radio size={18} />
          <span className="text-sm font-medium">{isConnected ? 'Realtime bus online' : 'Local scenario bus'}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Cpu}
          label="Socket Activity"
          value={Math.max(metrics.cpu, socketEvents.length * 4)}
          unit="%"
          color="bg-primary"
        />
        <MetricCard
          icon={Signal}
          label="Connected Devices"
          value={connectedDevices}
          unit=""
          color="bg-accent"
        />
        <MetricCard
          icon={Users}
          label="Active Families"
          value={activeFamilies}
          unit=""
          color="bg-success"
        />
        <MetricCard
          icon={Shield}
          label="Active Responders"
          value={responders.filter((unit) => unit.status !== 'offline').length}
          unit=""
          color="bg-warning"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Zap className="text-primary" size={20} />
              Realtime Operations Charts
            </h2>
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">Rolling window</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-56">
              <p className="text-sm text-text-muted mb-2">Alerts / Minute</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="time" stroke="#9ca3af" hide />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="alerts" stroke="#ef4444" fill="#ef4444" fillOpacity={0.22} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <p className="text-sm text-text-muted mb-2">Crowd Density</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="time" stroke="#9ca3af" hide />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="density" stroke="#f59e0b" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <p className="text-sm text-text-muted mb-2">Active Incidents</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="time" stroke="#9ca3af" hide />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Bar dataKey="incidents" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <p className="text-sm text-text-muted mb-2">Geofence Breaches</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="time" stroke="#9ca3af" hide />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Area type="stepAfter" dataKey="breaches" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Radio className="text-accent" size={20} />
              WebSocket Event Timeline
            </h2>
            <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent">{socketEvents.length} events</span>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {socketEvents.map((event) => (
              <motion.div key={event.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-lg bg-surfaceLight border border-border">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{event.eventName}</p>
                  <span className="text-[11px] text-text-muted">{event.timestamp}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1 truncate">{event.payload?.deviceId || event.payload?.zone || event.payload?.location || 'platform event'}</p>
              </motion.div>
            ))}
            {socketEvents.length === 0 && <div className="p-4 rounded-lg bg-surfaceLight border border-border text-text-muted text-sm">Awaiting websocket events...</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Activity className="text-warning" size={20} />
              Crowd Density Grid
            </h2>
            <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning">Scenario sensors</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crowdZones.map((zone) => (
              <motion.div layout key={zone.name} className="p-4 rounded-xl bg-surfaceLight border border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-text-primary">{zone.name}</p>
                  <AlertTriangle size={16} className={zone.density > 75 ? 'text-danger' : zone.density > 55 ? 'text-warning' : 'text-success'} />
                </div>
                <div className="h-3 bg-surface rounded-full overflow-hidden">
                  <motion.div
                    className={zone.density > 75 ? 'h-full bg-danger' : zone.density > 55 ? 'h-full bg-warning' : 'h-full bg-success'}
                    animate={{ width: `${zone.density}%` }}
                    transition={{ duration: 0.55 }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">{zone.density}% density</p>
              </motion.div>
            ))}
          </div>
        </div>
        <LiveActivityFeed title="Command Timeline" compact />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Navigation className="text-success" size={20} />
              Responder Coordination
            </h2>
            <button onClick={assignNearestResponder} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/20 text-success hover:bg-success/30 transition-all">
              <MapPin size={16} />
              Assign Nearest
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {responders.map((responder) => (
              <motion.div layout key={responder.id} className={`p-4 rounded-xl border ${responder.status === 'available' ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary">{responder.name}</p>
                    <p className="text-xs text-text-muted mt-1">{responder.role} - {responder.zone}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${responder.status === 'available' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    {responder.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-text-secondary">
                  <span>{responder.distance}m away</span>
                  <span>ETA {responder.eta}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            Incident Assignment Flow
          </h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {assignments.map((assignment) => (
              <motion.div key={assignment.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-surfaceLight border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">{assignment.responder}</p>
                  <span className="text-xs text-primary">{assignment.eta}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{assignment.incident} - {assignment.zone}</p>
                <p className="text-[11px] text-text-muted mt-2">{assignment.timestamp}</p>
              </motion.div>
            ))}
            {assignments.length === 0 && <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted text-sm">No active assignments yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangle className="text-primary" size={20} />
            Live Incident Stream
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {incidentStream.map((incident) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-surfaceLight border border-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{incident.type}</p>
                  <span className="text-xs text-warning uppercase">{incident.severity}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{incident.description}</p>
                <p className="text-[11px] text-text-muted mt-2">{incident.location} - {incident.timestamp}</p>
              </motion.div>
            ))}
            {incidentStream.length === 0 && <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted text-sm">Waiting for incident stream...</div>}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Radio className="text-danger" size={20} />
            Escalation Feed
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {escalationFeed.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-xl bg-danger/10 border border-danger/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">{item.zone}</p>
                  <span className="text-xs text-danger uppercase">{item.severity}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{item.summary}</p>
                <p className="text-[11px] text-text-muted mt-2">Risk {item.riskScore || '-'} - {item.timestamp}</p>
              </motion.div>
            ))}
            {escalationFeed.length === 0 && <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted text-sm">No active escalations.</div>}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Activity className="text-warning" size={20} />
            Hotspot Activity
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {hotspotActivity.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="p-3 rounded-xl bg-warning/10 border border-warning/30">
                <p className="text-sm font-semibold text-text-primary">{item.zone}</p>
                <p className="text-xs text-text-secondary mt-1">{item.summary}</p>
                <p className="text-[11px] text-text-muted mt-2">{item.timestamp}</p>
              </motion.div>
            ))}
            {hotspotActivity.length === 0 && <div className="p-4 rounded-xl bg-surfaceLight border border-border text-text-muted text-sm">Hotspot detector warming up.</div>}
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4">Live Logs Panel</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm font-mono ${
                    log.level === 'error' ? 'bg-danger/10 text-danger' :
                    log.level === 'warning' ? 'bg-warning/10 text-warning' :
                    'bg-surfaceLight text-text-secondary'
                  }`}
                >
                  <span className="text-text-muted">[{log.timestamp}]</span>
                  <span className="ml-2">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-text-muted">
                {isConnected ? 'Waiting for logs...' : 'Connect to view logs'}
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4">Server Activity Feed</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {serverFeed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  item.tone === 'error' ? 'bg-danger/10 text-danger' :
                  item.tone === 'warning' ? 'bg-warning/10 text-warning' :
                  'bg-surfaceLight text-text-secondary'
                }`}
              >
                <span className="text-text-muted">[{item.timestamp}]</span>
                <span className="ml-2">{item.message}</span>
              </motion.div>
            ))}
            {serverFeed.length === 0 && <div className="text-center py-8 text-text-muted">Server feed warming up...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Monitoring
