import { Bell, Search, Menu, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth()
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User'

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 lg:left-20 h-16 bg-surface/80 backdrop-blur-lg border-b border-border z-40">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-surfaceLight text-text-secondary"
          >
            <Menu size={24} />
          </button>
          
          {/* Search */}
          <div className="hidden sm:flex items-center gap-2 bg-surfaceLight rounded-lg px-4 py-2 w-96 border border-border">
            <Search size={18} className="text-text-muted" />
            <input
              type="text"
              placeholder="Search alerts, events, users..."
              className="bg-transparent border-none outline-none text-text-primary placeholder-text-muted w-full"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-surfaceLight text-text-secondary hover:text-primary transition-colors">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full animate-pulse"></span>
          </button>

          {/* User menu */}
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-text-primary">{displayName}</p>
              <p className="text-xs text-text-muted">{user?.role || 'FAMILY'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
              {user?.firstName?.charAt(0) || 'U'}
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-surfaceLight text-text-secondary hover:text-danger transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
