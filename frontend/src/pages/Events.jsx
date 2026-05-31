import { useEffect, useMemo, useState } from 'react'
import { eventsAPI, familyAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  Calendar,
  CheckCircle,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Radar,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'

const emptyEvent = {
  name: '',
  description: '',
  status: 'active',
  category: 'festival',
  location: '',
  latitude: '',
  longitude: '',
  capacity: 1000,
  safetyRadiusMeters: 170,
  date: new Date().toISOString().slice(0, 10),
}

const statusClass = {
  active: 'bg-success/20 text-success',
  published: 'bg-primary/20 text-primary',
  completed: 'bg-surfaceLight text-text-muted',
}

const Events = () => {
  const { user } = useAuth()
  const { emit, on, off } = useSocket()
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyEvent)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const [locationState, setLocationState] = useState({ status: 'idle', message: '' })
  const canManage = ['SUPER_ADMIN', 'EVENT_ORGANIZER'].includes(user?.role)

  const loadEvents = async () => {
    const response = canManage ? await eventsAPI.getAll() : await familyAPI.getNearbyEvents({ search })
    setEvents(response.data.data || [])
  }

  useEffect(() => {
    loadEvents()
  }, [canManage])

  useEffect(() => {
    const refresh = () => loadEvents()
    on('EVENT_CREATED', refresh)
    on('EVENT_UPDATED', refresh)
    on('EVENT_DELETED', refresh)
    on('FAMILY_REGISTERED', refresh)
    return () => {
      off('EVENT_CREATED', refresh)
      off('EVENT_UPDATED', refresh)
      off('EVENT_DELETED', refresh)
      off('FAMILY_REGISTERED', refresh)
    }
  }, [on, off, canManage])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter((event) => {
      const matches = !term || `${event.name} ${event.location} ${event.category}`.toLowerCase().includes(term)
      return canManage ? matches : matches && event.status === 'active'
    })
  }, [events, search, canManage])

  const resetForm = () => {
    setForm(emptyEvent)
    setEditingId(null)
    setLocationState({ status: 'idle', message: '' })
  }

  const geolocationErrorMessage = (error) => {
    if (error?.code === 1) return 'Location permission was denied. Enable location access and try again.'
    if (error?.code === 2) return 'Current location is unavailable. Check GPS, Wi-Fi, or network positioning.'
    if (error?.code === 3) return 'Location request timed out. Move to a clearer signal area and retry.'
    return 'Unable to fetch current location.'
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationState({ status: 'error', message: 'This browser does not support geolocation.' })
      return
    }

    setLocationState({ status: 'loading', message: 'Requesting secure location permission...' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6))
        const longitude = Number(position.coords.longitude.toFixed(6))
        setForm((current) => ({ ...current, latitude, longitude }))
        setLocationState({
          status: 'success',
          message: `Coordinates captured with ${Math.round(position.coords.accuracy || 0)}m accuracy.`,
        })
      },
      (error) => {
        setLocationState({ status: 'error', message: geolocationErrorMessage(error) })
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    )
  }

  const submitEvent = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      capacity: Number(form.capacity),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      safetyRadiusMeters: Number(form.safetyRadiusMeters),
      venue: {
        name: form.location,
        capacity: Number(form.capacity),
        location: { type: 'Point', coordinates: [Number(form.longitude), Number(form.latitude)] },
      },
    }
    if (editingId) {
      await eventsAPI.update(editingId, payload)
      setMessage('Event updated.')
    } else {
      await eventsAPI.create(payload)
      setMessage('Event created.')
    }
    resetForm()
    await loadEvents()
  }

  const editEvent = (event) => {
    setEditingId(event._id)
    setForm({
      name: event.name || '',
      description: event.description || '',
      status: event.status || 'active',
      category: event.category || 'festival',
      location: event.location || event.venue?.name || '',
      latitude: event.latitude ?? event.venue?.location?.coordinates?.[1] ?? '',
      longitude: event.longitude ?? event.venue?.location?.coordinates?.[0] ?? '',
      capacity: event.capacity || event.venue?.capacity || 1000,
      safetyRadiusMeters: event.safetyRadiusMeters || 170,
      date: event.date ? event.date.slice(0, 10) : emptyEvent.date,
    })
  }

  const deleteEvent = async (eventId) => {
    await eventsAPI.delete(eventId)
    setMessage('Event deleted.')
    await loadEvents()
  }

  const joinEvent = async (eventId) => {
    if (!eventId) {
      setMessage('Event is missing a valid MongoDB id.')
      return
    }

    const response = await familyAPI.registerEvent(eventId)
    const group = response.data.data
    const familyGroupId = group?._id || group?.groupId || group?.familyGroupId
    const familyCode = group?.code || group?.familyCode
    const joinedEventId = group?.event?._id || group?.event || eventId

    if (joinedEventId) emit('JOIN_EVENT', { eventId: joinedEventId })
    if (familyGroupId) emit('JOIN_FAMILY', { familyGroupId })

    setMessage(`Joined event. Family code: ${familyCode || 'created'}`)
    await loadEvents()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">Events</h1>
          <p className="text-text-muted mt-1">
            {canManage ? 'Create and operate smart safety events.' : 'Browse active events and join with your family group.'}
          </p>
        </div>
        <div className="glass rounded-lg px-4 py-3 flex items-center gap-2 min-w-full lg:min-w-[360px]">
          <Search size={18} className="text-text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nearby events..."
            className="w-full bg-transparent outline-none text-text-primary placeholder-text-muted"
          />
        </div>
      </div>

      {message && <div className="glass rounded-lg p-3 border border-primary/30 text-primary">{message}</div>}

      {canManage && (
        <form onSubmit={submitEvent} className="glass rounded-2xl p-6 border-glow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Plus className="text-primary" size={20} />
              {editingId ? 'Edit Event' : 'Create Event'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-text-muted hover:text-primary">
                Cancel edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <input className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Location label" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            <input type="number" className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
            <input type="number" className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Safety radius meters" value={form.safetyRadiusMeters} onChange={(e) => setForm({ ...form, safetyRadiusMeters: e.target.value })} required />
            <input type="number" step="0.000001" className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
            <input type="number" step="0.000001" className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locationState.status === 'loading'}
              className={`lg:col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                locationState.status === 'success'
                  ? 'bg-success/10 border-success/30 text-success'
                  : locationState.status === 'error'
                    ? 'bg-danger/10 border-danger/30 text-danger'
                    : 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25'
              } disabled:opacity-70 disabled:cursor-wait`}
            >
              {locationState.status === 'loading' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : locationState.status === 'success' ? (
                <CheckCircle size={18} />
              ) : (
                <MapPin size={18} />
              )}
              {locationState.status === 'loading' ? 'Fetching Location...' : 'Use Current Location'}
            </button>
            <input type="date" className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <select className="px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {locationState.message && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              locationState.status === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : locationState.status === 'error'
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : 'border-primary/30 bg-primary/10 text-primary'
            }`}>
              {locationState.message}
            </div>
          )}
          <textarea className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary" rows="2" placeholder="Event description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg shadow-neon">
            <Shield size={18} />
            {editingId ? 'Save Event' : 'Create Event'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {filteredEvents.map((event) => (
          <div key={event._id} className="glass rounded-2xl p-5 border-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary">{event.name}</h3>
                <p className="text-sm text-text-muted mt-1">{event.description || 'No description added.'}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded capitalize ${statusClass[event.status] || statusClass.active}`}>
                {event.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="p-3 rounded-xl bg-surfaceLight border border-border">
                <MapPin size={18} className="text-primary" />
                <p className="text-xs text-text-muted mt-2">Location</p>
                <p className="font-semibold text-text-primary">{event.location}</p>
              </div>
              <div className="p-3 rounded-xl bg-surfaceLight border border-border">
                <Users size={18} className="text-success" />
                <p className="text-xs text-text-muted mt-2">Families</p>
                <p className="font-semibold text-text-primary">{event.attendees || event.familyRegistrations?.length || 0} / {event.capacity}</p>
              </div>
              <div className="p-3 rounded-xl bg-surfaceLight border border-border">
                <Radar size={18} className="text-warning" />
                <p className="text-xs text-text-muted mt-2">Safety Radius</p>
                <p className="font-semibold text-text-primary">{event.safetyRadiusMeters || 170}m</p>
              </div>
              <div className="p-3 rounded-xl bg-surfaceLight border border-border">
                <Calendar size={18} className="text-accent" />
                <p className="text-xs text-text-muted mt-2">Date</p>
                <p className="font-semibold text-text-primary">{event.date ? new Date(event.date).toLocaleDateString() : '-'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {canManage ? (
                <>
                  <button onClick={() => editEvent(event)} className="flex items-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                    <Edit3 size={16} />
                    Edit
                  </button>
                  <button onClick={() => deleteEvent(event._id)} className="flex items-center gap-2 px-3 py-2 bg-danger/20 text-danger rounded-lg hover:bg-danger/30">
                    <Trash2 size={16} />
                    Delete
                  </button>
                </>
              ) : (
                <button onClick={() => joinEvent(event._id)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg">
                  <Users size={16} />
                  Join Event
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center text-text-muted">
          No events match your search.
        </div>
      )}
    </div>
  )
}

export default Events
