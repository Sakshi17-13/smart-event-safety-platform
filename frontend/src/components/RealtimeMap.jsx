import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSocket } from '../context/SocketContext'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from 'react-leaflet'
import { Icon, DivIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation,
  Crosshair,
  Layers,
  Activity,
  AlertTriangle,
  Shield,
  Zap,
} from 'lucide-react'

// Custom marker icons
const createMarkerIcon = (color, size = 32, isPulse = false) => {
  return new DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        position: relative;
        width: ${size + 16}px;
        height: ${size + 16}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${isPulse ? `
          <div style="
            position: absolute;
            width: 100%;
            height: 100%;
            background: ${color};
            border-radius: 50%;
            animation: pulse 2s infinite;
            opacity: 0.5;
          "></div>
        ` : ''}
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      </style>
    `,
    iconSize: [size + 16, size + 16],
    iconAnchor: [(size + 16) / 2, (size + 16) / 2],
  })
}

const createIncidentIcon = (type) => {
  const colors = {
    fire: '#ef4444',
    medical: '#10b981',
    security: '#3b82f6',
    accident: '#f59e0b',
  }
  
  return new DivIcon({
    className: 'incident-marker',
    html: `
      <div style="
        position: relative;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background: ${colors[type] || colors.security};
          border-radius: 50%;
          animation: incident-pulse 1.5s infinite;
          opacity: 0.6;
        "></div>
        <div style="
          width: 36px;
          height: 36px;
          background: ${colors[type] || colors.security};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes incident-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.6; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

// Map controller component
const MapController = ({ center, zoom, autoCenter, activeEntity }) => {
  const map = useMap()
  
  useEffect(() => {
    if (autoCenter && center) {
      map.setView(center, zoom)
    }
  }, [center, zoom, autoCenter, map])
  
  useEffect(() => {
    if (activeEntity && activeEntity.position) {
      map.setView(activeEntity.position, 16)
    }
  }, [activeEntity, map])
  
  return null
}

// Mock GPS data generator
const generateMockGPSData = (basePosition, variance = 0.001) => {
  return [
    basePosition[0] + (Math.random() - 0.5) * variance,
    basePosition[1] + (Math.random() - 0.5) * variance,
  ]
}

const severityColor = (severity = 'LOW') => {
  const value = String(severity).toUpperCase()
  if (value === 'CRITICAL') return '#dc2626'
  if (value === 'HIGH') return '#ef4444'
  if (value === 'MEDIUM') return '#f59e0b'
  return '#10b981'
}

const RealtimeMap = ({
  height = '600px',
  showControls = true,
  autoCenter = true,
  onMarkerClick = null,
}) => {
  const { isConnected, on, off } = useSocket()
  const mapRef = useRef(null)
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060])
  const [mapZoom, setMapZoom] = useState(14)
  const [activeEntity, setActiveEntity] = useState(null)
  
  // Mock entities with GPS tracking
  const [entities, setEntities] = useState([
    {
      id: 1,
      name: 'Unit Alpha',
      type: 'response',
      position: [40.7128, -74.0060],
      status: 'active',
      trail: [],
      color: '#3b82f6',
    },
    {
      id: 2,
      name: 'Unit Beta',
      type: 'response',
      position: [40.7138, -74.0070],
      status: 'active',
      trail: [],
      color: '#10b981',
    },
    {
      id: 3,
      name: 'Unit Gamma',
      type: 'response',
      position: [40.7118, -74.0050],
      status: 'standby',
      trail: [],
      color: '#f59e0b',
    },
  ])
  
  // Incidents
  const [incidents, setIncidents] = useState([
    {
      id: 1,
      type: 'fire',
      position: [40.7140, -74.0080],
      severity: 'high',
      description: 'Fire reported in Building A',
    },
    {
      id: 2,
      type: 'medical',
      position: [40.7115, -74.0045],
      severity: 'medium',
      description: 'Medical emergency at Main Gate',
    },
  ])

  const [crowdZones, setCrowdZones] = useState([
    { id: 'main-gate', name: 'Main Gate density', center: [40.7134, -74.0068], radius: 140, density: 66 },
    { id: 'family-zone', name: 'Family Zone density', center: [40.7124, -74.0054], radius: 110, density: 38 },
  ])
  const [hotspots, setHotspots] = useState([])
  
  // Geofences
  const [geofences, setGeofences] = useState([
    {
      id: 1,
      name: 'Event Zone',
      center: [40.7128, -74.0060],
      radius: 500,
      color: '#3b82f6',
      active: true,
    },
    {
      id: 2,
      name: 'Restricted Area',
      center: [40.7150, -74.0090],
      radius: 200,
      color: '#ef4444',
      active: true,
    },
  ])
  
  // Simulate real-time movement
  useEffect(() => {
    const interval = setInterval(() => {
      setEntities((prev) =>
        prev.map((entity) => {
          if (entity.status === 'active') {
            const newPosition = generateMockGPSData(entity.position, 0.00028)
            const newTrail = [...entity.trail, newPosition].slice(-20) // Keep last 20 points
            return {
              ...entity,
              position: newPosition,
              trail: newTrail,
            }
          }
          return entity
        })
      )
    }, 2000) // Update every 2 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  // WebSocket integration
  useEffect(() => {
    const updateGps = (data) => {
      setEntities((prev) =>
        prev.map((entity) =>
          entity.id === data.entityId
            ? {
                ...entity,
                position: [data.lat, data.lng],
                trail: [...entity.trail, [data.lat, data.lng]].slice(-20),
              }
            : entity
        )
      )
    }
      
    const addIncident = (incident) => {
      setIncidents((prev) => [...prev, incident])
    }

    const addAlertIncident = (alert) => {
      setIncidents((prev) => [
        {
          id: alert._id || Date.now(),
          type: alert.type?.toLowerCase().includes('medical') ? 'medical' : alert.type?.toLowerCase().includes('crowd') ? 'accident' : 'security',
          position: generateMockGPSData(mapCenter, 0.003),
          severity: alert.severity || 'medium',
          description: alert.description,
        },
        ...prev,
      ].slice(0, 8))
    }

    const updateCrowd = (payload) => {
      setCrowdZones((prev) =>
        prev.map((zone, index) => ({
          ...zone,
          density: payload.zones?.[index]?.density || zone.density,
        }))
      )
    }

    const updateHotspots = (payload) => {
      setHotspots(payload.hotspots || [])
    }
      
    const resolveIncident = (incidentId) => {
      setIncidents((prev) => prev.filter((i) => i.id !== incidentId))
    }
      
    on('gps-update', updateGps)
    on('incident-created', addIncident)
    on('new-alert', addAlertIncident)
    on('CROWD_DENSITY_UPDATE', updateCrowd)
    on('HOTSPOT_ZONES_UPDATED', updateHotspots)
    on('incident-resolved', resolveIncident)

    return () => {
      off('gps-update', updateGps)
      off('incident-created', addIncident)
      off('new-alert', addAlertIncident)
      off('CROWD_DENSITY_UPDATE', updateCrowd)
      off('HOTSPOT_ZONES_UPDATED', updateHotspots)
      off('incident-resolved', resolveIncident)
    }
  }, [on, off, mapCenter])
  
  const handleMarkerClick = (entity) => {
    setActiveEntity(entity)
    if (onMarkerClick) {
      onMarkerClick(entity)
    }
  }
  
  const handleAutoCenter = () => {
    if (entities.length > 0) {
      const avgLat = entities.reduce((sum, e) => sum + e.position[0], 0) / entities.length
      const avgLng = entities.reduce((sum, e) => sum + e.position[1], 0) / entities.length
      setMapCenter([avgLat, avgLng])
      setMapZoom(15)
    }
  }
  
  const handleFitBounds = () => {
    if (mapRef.current && entities.length > 0) {
      const bounds = entities.map((e) => e.position)
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }
  
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl overflow-hidden border-glow"
        style={{ height }}
      >
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <MapController
            center={mapCenter}
            zoom={mapZoom}
            autoCenter={autoCenter}
            activeEntity={activeEntity}
          />
          
          {/* Dark theme tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Geofence circles */}
          {geofences.map((fence) => (
            fence.active && (
              <Circle
                key={fence.id}
                center={fence.center}
                radius={fence.radius}
                pathOptions={{
                  color: fence.color,
                  fillColor: fence.color,
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '10, 10',
                }}
              />
            )
          ))}

          {/* Crowd density overlays */}
          {crowdZones.map((zone) => (
            <Circle
              key={zone.id}
              center={zone.center}
              radius={zone.radius + zone.density}
              pathOptions={{
                color: zone.density > 75 ? '#ef4444' : zone.density > 55 ? '#f59e0b' : '#10b981',
                fillColor: zone.density > 75 ? '#ef4444' : zone.density > 55 ? '#f59e0b' : '#10b981',
                fillOpacity: 0.06 + zone.density / 1800,
                weight: 1,
                dashArray: '4, 8',
              }}
            />
          ))}

          {/* Escalation hotspot overlays */}
          {hotspots.map((hotspot) => (
            <Circle
              key={hotspot.id}
              center={[hotspot.center.latitude, hotspot.center.longitude]}
              radius={hotspot.radiusMeters}
              pathOptions={{
                color: severityColor(hotspot.severity),
                fillColor: severityColor(hotspot.severity),
                fillOpacity: hotspot.severity === 'CRITICAL' ? 0.24 : 0.14,
                weight: hotspot.severity === 'CRITICAL' ? 4 : 3,
                dashArray: hotspot.severity === 'CRITICAL' ? undefined : '8, 8',
              }}
            />
          ))}
          
          {/* Entity movement trails */}
          {entities.map((entity) => (
            entity.trail.length > 1 && entity.trail.slice(1).map((point, index) => (
              <Polyline
                key={`trail-${entity.id}-${index}`}
                positions={[entity.trail[index], point]}
                pathOptions={{
                  color: entity.color,
                  weight: 3,
                  opacity: 0.12 + (index / Math.max(1, entity.trail.length - 1)) * 0.5,
                  dashArray: '5, 5',
                }}
              />
            )
          ))}
          
          {/* Entity markers */}
          {entities.map((entity) => (
            <Marker
              key={entity.id}
              position={entity.position}
              icon={createMarkerIcon(entity.color, 32, entity.status === 'active')}
              eventHandlers={{
                click: () => handleMarkerClick(entity),
              }}
            >
              <Popup>
                <div className="text-text-primary">
                  <strong>{entity.name}</strong>
                  <br />
                  Status: <span className="capitalize">{entity.status}</span>
                  <br />
                  Type: {entity.type}
                  <br />
                  Lat: {entity.position[0].toFixed(6)}
                  <br />
                  Lng: {entity.position[1].toFixed(6)}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Incident markers */}
          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              position={incident.position}
              icon={createIncidentIcon(incident.type)}
            >
              <Popup>
                <div className="text-text-primary">
                  <strong className="capitalize">{incident.type} Incident</strong>
                  <br />
                  Severity: <span className="capitalize">{incident.severity}</span>
                  <br />
                  {incident.description}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Map Controls */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-row sm:flex-col gap-2 z-[1000]"
          >
            <button
              onClick={handleAutoCenter}
              className="touch-target glass rounded-lg border-glow hover:shadow-neon transition-all"
              title="Auto Center"
            >
              <Crosshair className="text-primary" size={20} />
            </button>
            <button
              onClick={handleFitBounds}
              className="touch-target glass rounded-lg border-glow hover:shadow-neon transition-all"
              title="Fit All"
            >
              <Layers className="text-primary" size={20} />
            </button>
          </motion.div>
        )}
        
        {/* Legend */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-3 left-3 glass rounded-lg p-3 sm:p-4 border-glow z-[1000] hidden sm:block"
          >
            <h4 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              Legend
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-text-secondary">Response Units</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-text-secondary">Active Units</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-text-secondary">Standby Units</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-danger" />
                <span className="text-text-secondary">Fire Incident</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-text-secondary">Medical Incident</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-primary border-dashed" />
                <span className="text-text-secondary">Geofence Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-primary border-dashed opacity-50" />
                <span className="text-text-secondary">Movement Trail</span>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Status Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 glass rounded-lg px-3 sm:px-4 py-2 border-glow z-[1000] flex items-center gap-2 sm:gap-4 max-w-[calc(100%-6rem)] overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-xs text-text-secondary">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            <span className="text-xs text-text-secondary">
              {entities.filter((e) => e.status === 'active').length} Active
            </span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-xs text-text-secondary">
              {incidents.length} Incidents
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default RealtimeMap
