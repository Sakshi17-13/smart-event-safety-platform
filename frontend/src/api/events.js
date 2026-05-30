import api from './axios'

export const normalizeEvent = (event = {}) => {
  const startDate = event.schedule?.startDate || event.date
  const capacity = event.venue?.capacity ?? event.capacity ?? 0
  const attendeeCount = event.statistics?.totalAttendees ?? (Array.isArray(event.attendees) ? event.attendees.length : event.attendees) ?? 0

  return {
    ...event,
    _id: event._id || event.id,
    location: event.location || event.venue?.name || '',
    latitude: event.latitude ?? event.venue?.location?.coordinates?.[1],
    longitude: event.longitude ?? event.venue?.location?.coordinates?.[0],
    capacity,
    date: startDate,
    attendees: attendeeCount,
    checkedIn: event.statistics?.checkedIn ?? event.checkedIn ?? 0,
  }
}

const normalizeResponseData = (response) => {
  const data = response.data?.data
  const normalizedData = Array.isArray(data) ? data.map(normalizeEvent) : normalizeEvent(data)

  return {
    ...response,
    data: {
      ...response.data,
      data: normalizedData,
    },
  }
}

export const buildEventPayload = (event = {}) => {
  const startDate = new Date(event.schedule?.startDate || event.date || Date.now())
  const endDate = new Date(event.schedule?.endDate || startDate.getTime() + 8 * 60 * 60 * 1000)
  const latitude = Number(event.latitude ?? event.venue?.location?.coordinates?.[1] ?? 19.076)
  const longitude = Number(event.longitude ?? event.venue?.location?.coordinates?.[0] ?? 72.8777)
  const capacity = Number(event.capacity ?? event.venue?.capacity ?? 1)
  const location = event.location || event.venue?.name || 'Event Venue'

  return {
    name: event.name,
    description: event.description || '',
    status: event.status || 'draft',
    category: event.category || 'other',
    venue: {
      name: location,
      capacity,
      address: {
        city: event.city || event.venue?.address?.city || location,
        country: event.country || event.venue?.address?.country || 'India',
      },
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    },
    schedule: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone: event.timezone || event.schedule?.timezone || 'Asia/Kolkata',
    },
  }
}

export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }).then(normalizeResponseData),
  getById: (id) => api.get(`/events/${id}`).then(normalizeResponseData),
  create: (data) => api.post('/events', buildEventPayload(data)).then(normalizeResponseData),
  update: (id, data) => api.put(`/events/${id}`, buildEventPayload(data)).then(normalizeResponseData),
  delete: (id) => api.delete(`/events/${id}`),
  register: (id) => api.post(`/events/${id}/register`).then(normalizeResponseData),
  getStats: () => api.get('/events/stats'),
}
