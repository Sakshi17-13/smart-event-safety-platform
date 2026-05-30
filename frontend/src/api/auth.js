import api from './axios'

export const SIGNUP_ROLES = ['FAMILY', 'EVENT_ORGANIZER', 'SUPER_ADMIN']

export const buildSignupPayload = (userData) => ({
  firstName: userData.firstName?.trim() || '',
  lastName: userData.lastName?.trim() || '',
  email: userData.email?.trim().toLowerCase() || '',
  password: userData.password || '',
  role: SIGNUP_ROLES.includes(userData.role) ? userData.role : 'FAMILY',
})

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  signup: (userData) => api.post('/auth/signup', buildSignupPayload(userData)),
  logout: () => api.post('/auth/logout'),
  verifyToken: () => api.get('/auth/verify'),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
}
