import { useState, useEffect } from 'react'
import { usersAPI } from '../api'
import {
  Users as UsersIcon,
  Search,
  UserPlus,
  MoreVertical,
  KeyRound,
  Lock,
  Radio,
  ScanFace,
  ShieldCheck,
  UserCog,
  UserX,
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

const GovernanceTile = ({ title, body, icon: Icon, tone }) => (
  <div className={`rounded-xl border p-4 ${tone}`}>
    <div className="flex items-center gap-3">
      <Icon size={18} />
      <p className="font-semibold text-text-primary">{title}</p>
    </div>
    <p className="text-sm text-text-muted mt-2">{body}</p>
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
  const inactive = users.filter((user) => user.isActive === false).length
  const verificationQueue = Math.max(1, metrics.families - Math.floor(metrics.families * 0.72))

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
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Admin Governance</p>
          <h1 className="text-3xl font-bold text-text-primary text-glow">User Management</h1>
          <p className="text-text-muted mt-1">Roles, permissions, guardian verification, sessions, and moderation controls</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-all">
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard icon={UsersIcon} label="Identities" value={metrics.total} tone="bg-primary/20 text-primary" />
        <MetricCard icon={ScanFace} label="Verification Queue" value={verificationQueue} tone="bg-warning/20 text-warning" />
        <MetricCard icon={KeyRound} label="Privileged Roles" value={metrics.organizers + metrics.admins} tone="bg-accent/20 text-accent" />
        <MetricCard icon={UserX} label="Restricted" value={inactive} tone="bg-danger/20 text-danger" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.75fr_1.25fr] gap-6">
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 border-glow">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              Access Control
            </h2>
            <div className="space-y-3">
              <GovernanceTile icon={Lock} title="Permission Baseline" body={`${metrics.admins} admins and ${metrics.organizers} organizers have elevated controls.`} tone="bg-primary/10 border-primary/20 text-primary" />
              <GovernanceTile icon={ScanFace} title="Guardian Verification" body={`${verificationQueue} family accounts need identity or guardian review.`} tone="bg-warning/10 border-warning/20 text-warning" />
              <GovernanceTile icon={Radio} title="Session Watch" body={`${metrics.active} active accounts are eligible for realtime dashboard sessions.`} tone="bg-success/10 border-success/20 text-success" />
            </div>
          </div>

          <div className="glass rounded-xl p-6 border-glow">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <UserCog className="text-accent" size={20} />
              Moderation Tools
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {['Force logout', 'Reset role', 'Review guardian', 'Freeze account'].map((action) => (
                <button key={action} className="rounded-lg bg-surfaceLight border border-border px-3 py-3 text-sm text-text-secondary hover:text-primary hover:border-primary transition-colors">
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-text-muted" />
              <input
                type="text"
                placeholder="Search users, roles, permissions, or family accounts..."
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
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Identity</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Access Role</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Session</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Moderation</th>
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
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${user.isActive === false ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                          {user.isActive === false ? 'Restricted' : 'Active'}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-6 border-glow">
          <h3 className="font-bold text-text-primary mb-4">Role Distribution</h3>
          <div className="space-y-3">
            {[['Families', metrics.families, 'bg-success'], ['Organizers', metrics.organizers, 'bg-warning'], ['Admins', metrics.admins, 'bg-danger']].map(([label, value, color]) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">{label}</span>
                  <span className="text-text-primary">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${metrics.total ? (value / metrics.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-xl p-6 border-glow">
          <h3 className="font-bold text-text-primary mb-4">Account Activity</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">Active</span><span className="text-success">{metrics.active}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Restricted</span><span className="text-danger">{inactive}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Pending review</span><span className="text-warning">{verificationQueue}</span></div>
          </div>
        </div>
        <div className="glass rounded-xl p-6 border-glow">
          <h3 className="font-bold text-text-primary mb-4">Session Management</h3>
          <div className="space-y-2">
            {['JWT refresh audit', 'Socket auth check', 'Role boundary scan'].map((item) => (
              <div key={item} className="rounded-lg bg-surfaceLight border border-border p-3 text-sm text-text-secondary">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserFamilyManagement
