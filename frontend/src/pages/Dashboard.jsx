import { useEffect, useState } from 'react'
import { useSocket } from '../context/SocketContext'
import { alertsAPI, eventsAPI } from '../api'
import { demoStore } from '../services/demoStore'
import AnimatedNumber from '../components/AnimatedNumber'
import {
  AlertTriangle,
  Users,
  Activity,
  Shield,
  Clock,
  MapPin,
  Cpu,
  Database,
  Radio,
  Server,
  Wifi,
  Zap,
} from 'lucide-react'

const InfraMetric = ({ icon: Icon, label, value, status, color }) => (
  <div className="glass rounded-xl p-5 border-glow">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color}/20`}>
        <Icon size={22} className={color.replace('bg-', 'text-')} />
      </div>
      <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">{status}</span>
    </div>
    <p className="text-sm text-text-muted">{label}</p>
    <p className="mt-1 text-3xl font-bold text-text-primary">{value}</p>
  </div>
)

const statusTone = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary/10 text-primary',
}

const StatusRail = ({ label, value, tone = 'success' }) => (
  <div className="flex items-center justify-between rounded-lg bg-surfaceLight/70 border border-border px-3 py-2">
    <span className="text-sm text-text-secondary">{label}</span>
    <span className={`text-xs px-2 py-1 rounded ${statusTone[tone] || statusTone.success}`}>{value}</span>
  </div>
)

const ExecutiveKpi = ({ label, value, icon: Icon, subtitle }) => (
  <div className="rounded-xl bg-surfaceLight/70 border border-border p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
        <p className="mt-2 text-3xl font-black text-text-primary">{value}</p>
        <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="p-3 rounded-lg bg-primary/15 text-primary">
        <Icon size={24} />
      </div>
    </div>
  </div>
)

const RecentAlert = ({ alert }) => (
  <div className="glass rounded-lg p-4 border border-border hover:border-primary transition-all cursor-pointer">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className={alert.severity === 'high' ? 'text-danger' : 'text-warning'} />
        <span className="font-medium text-text-primary">{alert.type}</span>
      </div>
      <span className="text-xs text-text-muted">{alert.time}</span>
    </div>
    <p className="text-sm text-text-secondary mb-2">{alert.description}</p>
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <MapPin size={14} />
      <span>{alert.location}</span>
    </div>
  </div>
)

const SystemOverviewDashboard = () => {
  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeEvents: 0,
    totalUsers: 0,
    systemHealth: 0,
  })
  const [recentAlerts, setRecentAlerts] = useState([])
  const { isConnected, on, off } = useSocket()
  const uptimeScore = Math.max(98.2, Number(stats.systemHealth || 0) + 1.4).toFixed(2)

  useEffect(() => {
    fetchDashboardData()
    const unsubscribe = demoStore.subscribe(fetchDashboardData)
    return unsubscribe
  }, [])

  useEffect(() => {
    on('new-alert', fetchDashboardData)
    on('EVENT_CREATED', fetchDashboardData)
    on('EVENT_UPDATED', fetchDashboardData)
    on('EVENT_DELETED', fetchDashboardData)
    on('FAMILY_REGISTERED', fetchDashboardData)
    on('DEVICE_PAIRED', fetchDashboardData)
    return () => {
      off('new-alert')
      off('EVENT_CREATED')
      off('EVENT_UPDATED')
      off('EVENT_DELETED')
      off('FAMILY_REGISTERED')
      off('DEVICE_PAIRED')
    }
  }, [on, off])

  const fetchDashboardData = async () => {
    try {
      const [alertsRes, eventsRes] = await Promise.all([
        alertsAPI.getAll({ limit: 5, sort: '-createdAt' }),
        eventsAPI.getStats(),
      ])
      
      const alerts = alertsRes.data.data || []
      const eventStats = eventsRes.data.data || {}
      setRecentAlerts(alerts)
      setStats({
        totalAlerts: eventStats.totalAlerts || demoStore.getStats().totalAlerts || alerts.length,
        activeEvents: eventStats.active || 0,
        totalUsers: demoStore.getStats().totalUsers,
        systemHealth: demoStore.getStats().systemHealth,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Executive Command</p>
          <h1 className="text-3xl font-bold text-text-primary text-glow">System Overview</h1>
          <p className="text-text-muted mt-1">Infrastructure health, platform uptime, and cross-event risk posture</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isConnected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
          <Radio size={18} />
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
          <span className="text-sm font-medium">{isConnected ? 'Realtime bus online' : 'Realtime degraded'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <InfraMetric icon={Server} label="API Gateway" value="Online" status="200 OK" color="bg-success" />
        <InfraMetric icon={Database} label="MongoDB Atlas" value="Synced" status="Healthy" color="bg-primary" />
        <InfraMetric icon={Wifi} label="Socket Fabric" value={isConnected ? 'Live' : 'Offline'} status={isConnected ? 'Connected' : 'Retrying'} color="bg-accent" />
        <InfraMetric icon={Cpu} label="Platform Health" value={`${stats.systemHealth}%`} status={`${uptimeScore}% uptime`} color="bg-warning" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Shield className="text-primary" size={20} />
              Executive Platform Snapshot
            </h2>
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">Rolling 24h</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ExecutiveKpi icon={Activity} label="Total Events" value={<AnimatedNumber value={stats.activeEvents} />} subtitle="active operations" />
            <ExecutiveKpi icon={AlertTriangle} label="Incidents" value={<AnimatedNumber value={stats.totalAlerts} />} subtitle="triage queue" />
            <ExecutiveKpi icon={Users} label="Users" value={<AnimatedNumber value={stats.totalUsers} />} subtitle="managed identities" />
          </div>
          <div className="mt-6 rounded-xl bg-surfaceLight/60 border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-text-primary">Uptime Analytics</p>
              <span className="text-success text-sm">{uptimeScore}% SLA</span>
            </div>
            <div className="h-3 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary via-success to-accent" style={{ width: `${Math.min(100, Number(uptimeScore))}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-text-muted">
              <span>API latency stable</span>
              <span>Socket reconnect guarded</span>
              <span>Atlas writes healthy</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Zap className="text-warning" size={20} />
            Service Readiness
          </h2>
          <div className="space-y-3">
            <StatusRail label="REST API" value="Operational" />
            <StatusRail label="Authentication" value="JWT Validated" />
            <StatusRail label="Realtime Rooms" value={isConnected ? 'Subscribed' : 'Recovering'} tone={isConnected ? 'success' : 'warning'} />
            <StatusRail label="Database Replication" value="Primary ready" />
            <StatusRail label="Deployment Target" value="Render + Vercel" tone="primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <h2 className="text-xl font-bold text-text-primary mb-4">Incident Intake</h2>
          <div className="space-y-3">
            {recentAlerts.length > 0 ? recentAlerts.map((alert, index) => <RecentAlert key={alert._id || index} alert={alert} />) : (
              <div className="p-6 rounded-xl bg-surfaceLight border border-border text-center text-text-muted">No recent alerts</div>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-6 border-glow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Clock className="text-accent" size={20} />
              Infrastructure Timeline
            </h2>
            <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent">System events</span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Vercel frontend edge active', 'Render backend bound to 0.0.0.0', 'MongoDB Atlas connection ready', 'Socket rooms accepting joins'].map((item, index) => (
              <div key={item} className="rounded-xl bg-surfaceLight border border-border p-4">
                <p className="text-sm font-semibold text-text-primary">{item}</p>
                <p className="text-xs text-text-muted mt-2">{index + 1}m ago - production stability monitor</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemOverviewDashboard
