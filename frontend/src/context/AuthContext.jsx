import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api'
import { clearAuthTokens, getStoredAccessToken, getStoredRefreshToken, setAuthTokens, syncAuthorizationHeader } from '../api/axios'

const AuthContext = createContext(null)

const getAuthPayload = (response) => {
  const data = response.data?.data || {}
  const tokens = data.tokens || {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }

  return {
    user: data.user || data,
    tokens,
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = getStoredAccessToken()
    const refreshToken = getStoredRefreshToken()

    if (token || refreshToken) {
      try {
        syncAuthorizationHeader(token)
        let response
        try {
          response = token ? await authAPI.verifyToken() : await authAPI.refreshToken(refreshToken)
        } catch (error) {
          if (!refreshToken || error.response?.status !== 401) throw error
          response = await authAPI.refreshToken(refreshToken)
        }
        const { user, tokens } = getAuthPayload(response)
        setAuthTokens(tokens)
        setUser(user)
        setIsAuthenticated(true)
      } catch (error) {
        clearAuthTokens()
        setUser(null)
        setIsAuthenticated(false)
      }
    }
    setLoading(false)
  }

  const login = async (credentials) => {
    const response = await authAPI.login(credentials)
    const { user, tokens } = getAuthPayload(response)
    setAuthTokens(tokens)
    setUser(user)
    setIsAuthenticated(true)
    return user
  }

  const signup = async (userData) => {
    const response = await authAPI.signup(userData)
    const { user, tokens } = getAuthPayload(response)
    setAuthTokens(tokens)
    setUser(user)
    setIsAuthenticated(true)
    return user
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuthTokens()
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  const updateUser = (userData) => {
    setUser(userData)
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
