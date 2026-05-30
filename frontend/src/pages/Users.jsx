import { useState, useEffect } from 'react'
import { usersAPI } from '../api'
import { Users as UsersIcon, Search, UserPlus, MoreVertical } from 'lucide-react'

const Users = () => {
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
    return name.includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
  })

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary text-glow">Users</h1>
          <p className="text-text-muted mt-1">Manage platform users and permissions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all shadow-neon">
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="glass rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder-text-muted"
          />
        </div>
      </div>

      {/* Users Table */}
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
                    <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">Active</span>
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
  )
}

export default Users
