import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { alertsAPI } from '../api'
import { useSocket } from '../context/SocketContext'
import LiveActivityFeed from '../components/LiveActivityFeed'
import { AlertTriangle, Filter, Search, Plus, CheckCircle, Radio } from 'lucide-react'

const Alerts = () => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { isConnected, on, off } = useSocket()

  useEffect(() => {
    fetchAlerts()
  }, [])

  useEffect(() => {
    const insertAlert = (alert) => {
      setAlerts((current) => {
        if (current.some((item) => item._id === alert._id)) return current
        return [{ ...alert, time: 'Just now' }, ...current].slice(0, 80)
      })
    }

    const insertGeofence = (event) => insertAlert({
      _id: event._id,
      type: 'Geofence Breach',
      severity: event.severity || 'high',
      status: 'active',
      description: `${Math.round(event.distanceMeters || 0)}m from guardian safe zone`,
      location: event.zone || 'Family safety radius',
      createdAt: event.timestamp || new Date().toISOString(),
    })

    on('new-alert', insertAlert)
    on('ALERT_STREAM', insertAlert)
    on('GEOFENCE_BREACH', insertGeofence)

    return () => {
      off('new-alert', insertAlert)
      off('ALERT_STREAM', insertAlert)
      off('GEOFENCE_BREACH', insertGeofence)
    }
  }, [on, off])

  const fetchAlerts = async () => {
    try {
      const response = await alertsAPI.getAll()
      setAlerts(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (id) => {
    try {
      await alertsAPI.resolve(id)
      setAlerts(alerts.map(alert => 
        alert._id === id ? { ...alert, status: 'resolved' } : alert
      ))
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter
    const matchesSearch = alert.description?.toLowerCase().includes(search.toLowerCase()) ||
                         alert.type?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getSeverityColor = (severity) => {
    switch (String(severity || '').toLowerCase()) {
      case 'critical': return 'bg-danger/30 text-danger border-danger/60 critical-flash'
      case 'high': return 'bg-danger/20 text-danger border-danger/30'
      case 'medium': return 'bg-warning/20 text-warning border-warning/30'
      case 'low': return 'bg-success/20 text-success border-success/30'
      default: return 'bg-primary/20 text-primary border-primary/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">Alerts</h1>
          <p className="text-text-muted mt-1">Monitor and manage safety alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isConnected ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
            <Radio size={16} />
            <span className="text-sm font-medium">{isConnected ? 'Live sync' : 'Local replay'}</span>
          </span>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all shadow-neon">
            <Plus size={18} />
            New Alert
          </button>
        </div>
      </div>

      <LiveActivityFeed title="Realtime Alert Feed" compact />

      {/* Filters */}
      <div className="glass rounded-lg p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search size={18} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder-text-muted"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-text-muted" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-surfaceLight border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredAlerts.length > 0 ? (
        <div className="grid gap-4">
          <AnimatePresence initial={false}>
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert._id}
              initial={{ opacity: 0, x: -18, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18 }}
              className={`glass rounded-lg p-6 border ${getSeverityColor(alert.severity)} hover:shadow-neon transition-all`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle size={20} />
                    <h3 className="font-semibold text-text-primary">{alert.type}</h3>
                    <span className={`text-xs px-2 py-1 rounded capitalize ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    {alert.status === 'resolved' && (
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary mb-3">{alert.description}</p>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>Location: {alert.location || 'N/A'}</span>
                    <span>Time: {new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {alert.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(alert._id)}
                    className="flex items-center gap-2 px-3 py-2 bg-success/20 text-success rounded-lg hover:bg-success/30 transition-all"
                  >
                    <CheckCircle size={16} />
                    Resolve
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass rounded-lg p-12 text-center">
          <AlertTriangle size={48} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">No alerts found</p>
        </div>
      )}
    </div>
  )
}

export default Alerts
