import { useState, useEffect } from 'react'
import { usersAPI } from '../api'
import {
  Users as UsersIcon,
  Search,
  UserPlus,
  MoreVertical,
  HeartHandshake,
  UserCheck,
  Crown,
  ShieldCheck,
} from 'lucide-react'

const MetricCard = ({ icon: Icon, label, value, tone }) => (
  <div className="glass rounded-xl p-5 border-glow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${tone}`}>
        <Icon size={22} />
      </div>
    </div>
  </div>
)

const UserFamilyManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll()
      setUsers(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const getUserName = (user) => [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown'

  const filteredUsers = users.filter(user => {
    const name = getUserName(user).toLowerCase()
    const query = search.toLowerCase()

    return name.includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
  })

  const metrics = {
    total: users.length,
    families: users.filter((user) => user.role === 'FAMILY').length,
    organizers: users.filter((user) => user.role === 'EVENT_ORGANIZER').length,
    admins: users.filter((user) => user.role === 'SUPER_ADMIN').length,
    active: users.filter((user) => user.isActive !== false).length,
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-danger/20 text-danger'
      case 'EVENT_ORGANIZER': return 'bg-warning/20 text-warning'
      case 'FAMILY': return 'bg-primary/20 text-primary'
      default: return 'bg-primary/20 text-primary'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">User & Family Management</h1>
          <p className="text-text-muted mt-1">Govern platform roles, family accounts, and organizer access</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all shadow-neon">
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard icon={UsersIcon} label="Total Users" value={metrics.total} tone="bg-primary/20 text-primary" />
        <MetricCard icon={HeartHandshake} label="Family Accounts" value={metrics.families} tone="bg-success/20 text-success" />
        <MetricCard icon={UserCheck} label="Organizers" value={metrics.organizers} tone="bg-warning/20 text-warning" />
        <MetricCard icon={Crown} label="Admins" value={metrics.admins} tone="bg-accent/20 text-accent" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="glass rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-text-muted" />
              <input
                type="text"
                placeholder="Search users, families, or roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder-text-muted"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-surfaceLight">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">User</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-surfaceLight/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                            {user.firstName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">{getUserName(user)}</p>
                            <p className="text-sm text-text-muted">{user.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded capitalize ${getRoleColor(user.role)}`}>
                          {user.role || 'FAMILY'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{user.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          user.isActive === false ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'
                        }`}>
                          {user.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 hover:bg-surfaceLight rounded-lg transition-colors">
                          <MoreVertical size={18} className="text-text-muted" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass rounded-lg p-12 text-center">
              <UsersIcon size={48} className="text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">No users found</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="glass rounded-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-success/20 text-success">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-lg font-bold text-text-primary">Access Scope</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Active accounts</span>
                <span className="text-sm font-semibold text-success">{metrics.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Family profiles</span>
                <span className="text-sm font-semibold text-text-primary">{metrics.families}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Operations roles</span>
                <span className="text-sm font-semibold text-text-primary">{metrics.organizers + metrics.admins}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-lg p-5">
            <h2 className="text-lg font-bold text-text-primary mb-4">Management Focus</h2>
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                <p className="font-medium text-text-primary">Family onboarding</p>
                <p className="text-sm text-text-muted mt-1">Track family accounts separately from organizer operations.</p>
              </div>
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
                <p className="font-medium text-text-primary">Role governance</p>
                <p className="text-sm text-text-muted mt-1">Audit organizer and admin access without entering event dashboards.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default UserFamilyManagement
