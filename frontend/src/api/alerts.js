import api from './axios'
import { demoStore } from '../services/demoStore'

const withLocalFallback = async (request, fallback) => {
  try {
    return await request()
  } catch (error) {
    if (error.response?.status && ![404, 503].includes(error.response.status)) throw error
    return fallback()
  }
}

export const alertsAPI = {
  getAll: (params) =>
    demoStore.apiResponse(demoStore.getState().alerts, 'Alerts retrieved from local development state'),
  getById: (id) => api.get(`/alerts/${id}`),
  create: (data) =>
    withLocalFallback(
      () => api.post('/alerts', data),
      () => demoStore.apiResponse(demoStore.addAlert(data), 'Alert created in local development state')
    ),
  update: (id, data) => api.put(`/alerts/${id}`, data),
  delete: (id) => api.delete(`/alerts/${id}`),
  resolve: (id) =>
    withLocalFallback(
      () => api.patch(`/alerts/${id}/resolve`),
      () => {
        demoStore.resolveAlert(id)
        return demoStore.apiResponse({ alertId: id }, 'Alert resolved in local development state')
      }
    ),
}
