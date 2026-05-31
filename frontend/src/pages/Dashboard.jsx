import { useEffect, useState } from 'react'
import { useSocket } from '../context/SocketContext'
import { alertsAPI, eventsAPI } from '../api'
import { demoStore } from '../services/demoStore'
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Activity,
  Shield,
  Clock,
  MapPin,
} from 'lucide-react'

const StatCard = ({ icon: Icon, label, value, trend, color }) => (
  <div className="glass rounded-xl p-6 border-glow hover:shadow-neon transition-all duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-text-muted text-sm mb-1">{label}</p>
        <p className="text-3xl font-bold text-text-primary">{value}</p>
        {trend && (
          <p className={`text-sm mt-2 ${trend > 0 ? 'text-success' : 'text-danger'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last week
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">System Overview</h1>
          <p className="text-text-muted mt-1">Platform-wide health, incident volume, and service readiness</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
          <span className="text-sm text-text-muted">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={AlertTriangle}
          label="Platform Alerts"
          value={stats.totalAlerts}
          trend={12}
          color="bg-danger"
        />
        <StatCard
          icon={Activity}
          label="Live Event Ops"
          value={stats.activeEvents}
          trend={8}
          color="bg-warning"
        />
        <StatCard
          icon={Users}
          label="Managed Users"
          value={stats.totalUsers}
          trend={5}
          color="bg-primary"
        />
        <StatCard
          icon={Shield}
          label="Platform Health"
          value={`${stats.systemHealth}%`}
          trend={2}
          color="bg-success"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Recent Alerts</h2>
            <button className="text-primary hover:text-primaryLight text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert, index) => (
                <RecentAlert key={index} alert={alert} />
              ))
            ) : (
              <div className="glass rounded-lg p-8 text-center text-text-muted">
                No recent alerts
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">System Actions</h2>
          <div className="space-y-3">
            <button className="w-full glass rounded-lg p-4 text-left hover:border-primary transition-all flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <AlertTriangle size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">System Triage</p>
                <p className="text-xs text-text-muted">Review platform incidents</p>
              </div>
            </button>
            <button className="w-full glass rounded-lg p-4 text-left hover:border-primary transition-all flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Activity size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-medium text-text-primary">Operations Analytics</p>
                <p className="text-xs text-text-muted">Inspect platform trends</p>
              </div>
            </button>
            <button className="w-full glass rounded-lg p-4 text-left hover:border-primary transition-all flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <Users size={20} className="text-success" />
              </div>
              <div>
                <p className="font-medium text-text-primary">User Governance</p>
                <p className="text-xs text-text-muted">Administer access roles</p>
              </div>
            </button>
          </div>

          {/* System Status */}
          <div className="glass rounded-lg p-4 mt-6">
            <h3 className="font-medium text-text-primary mb-3">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">API Server</span>
                <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Database</span>
                <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Socket Server</span>
                <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemOverviewDashboard
