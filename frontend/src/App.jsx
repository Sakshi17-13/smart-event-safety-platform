import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SystemOverviewDashboard from './pages/Dashboard'
import OrganizerDashboard from './pages/OrganizerDashboard'
import FamilyDashboard from './pages/FamilyDashboard'
import Alerts from './pages/Alerts'
import Events from './pages/Events'
import UserFamilyManagement from './pages/Users'
import Monitoring from './pages/Monitoring'
import Security from './pages/Security'
import Settings from './pages/Settings'
import DevicePairing from './pages/DevicePairing'
import MotionPage from './motion/MotionPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route path="/device-pairing" element={<MotionPage className="min-h-screen"><DevicePairing /></MotionPage>} />

            {/* Protected Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<SystemOverviewDashboard />} />
              <Route
                path="/organizer"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'EVENT_ORGANIZER']}>
                    <OrganizerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/family"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY']}>
                    <FamilyDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/events" element={<Events />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <UserFamilyManagement />
                  </ProtectedRoute>
                }
              />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/security" element={<Security />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
