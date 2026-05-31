import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../utils/cn'
import { glowPulse, scaleHover } from '../motion/presets'
import {
  LayoutDashboard,
  AlertTriangle,
  Calendar,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Radar,
  Heart,
  Watch,
} from 'lucide-react'

const menuItems = [
  { icon: LayoutDashboard, label: 'System', path: '/dashboard', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER'] },
  { icon: Radar, label: 'Organizer Ops', path: '/organizer', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER'] },
  { icon: Heart, label: 'Family', path: '/family', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'] },
  { icon: Watch, label: 'Pair Device', path: '/device-pairing', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'] },
  { icon: AlertTriangle, label: 'Alerts', path: '/alerts', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER'] },
  { icon: Calendar, label: 'Events', path: '/events', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'] },
  { icon: Users, label: 'User Management', path: '/users', roles: ['SUPER_ADMIN'] },
  { icon: Activity, label: 'Monitoring', path: '/monitoring', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER'] },
  { icon: Shield, label: 'Security', path: '/security', roles: ['SUPER_ADMIN'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['SUPER_ADMIN', 'EVENT_ORGANIZER', 'FAMILY'] },
]

const MotionLink = motion(Link)

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation()
  const { user } = useAuth()
  const visibleItems = menuItems.filter((item) => !item.roles || item.roles.includes(user?.role))

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-surface border-r border-border transition-all duration-300 z-50',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-text-primary text-glow">
              SafeCity
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-surfaceLight text-text-secondary hover:text-primary transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path

          return (
            <MotionLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary/20 text-primary border-glow'
                  : 'text-text-secondary hover:bg-surfaceLight hover:text-primary'
              )}
              {...scaleHover}
              {...(isActive ? glowPulse : {})}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </MotionLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
