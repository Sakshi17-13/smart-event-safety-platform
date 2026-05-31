import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
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
  { icon: LayoutDashboard, label: 'System', path: '/dashboard' },
  { icon: Radar, label: 'Organizer Ops', path: '/organizer' },
  { icon: Heart, label: 'Family', path: '/family' },
  { icon: Watch, label: 'Pair Device', path: '/device-pairing' },
  { icon: AlertTriangle, label: 'Alerts', path: '/alerts' },
  { icon: Calendar, label: 'Events', path: '/events' },
  { icon: Users, label: 'User Management', path: '/users' },
  { icon: Activity, label: 'Monitoring', path: '/monitoring' },
  { icon: Shield, label: 'Security', path: '/security' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

const MotionLink = motion(Link)

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation()

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
        {menuItems.map((item) => {
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
