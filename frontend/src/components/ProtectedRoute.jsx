import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const defaultRouteForRole = (role) => {
  if (role === 'FAMILY') return '/family'
  if (role === 'EVENT_ORGANIZER') return '/organizer'
  return '/dashboard'
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles?.length && !allowedRoles.includes(user?.role)) {
    return <Navigate to={defaultRouteForRole(user?.role)} replace />
  }

  return children
}

export default ProtectedRoute
