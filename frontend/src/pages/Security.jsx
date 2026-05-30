import { Shield, Lock, Key, Eye, Bell, ShieldAlert } from 'lucide-react'

const Security = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary text-glow">Security Settings</h1>
        <p className="text-text-muted mt-1">Manage your security preferences</p>
      </div>

      {/* Security Overview */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Shield className="text-primary" />
          Security Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surfaceLight rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="text-success" size={20} />
              <span className="font-medium text-text-primary">Password</span>
            </div>
            <p className="text-sm text-text-muted">Last changed 30 days ago</p>
          </div>
          <div className="bg-surfaceLight rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Key className="text-primary" size={20} />
              <span className="font-medium text-text-primary">2FA</span>
            </div>
            <p className="text-sm text-success">Enabled</p>
          </div>
          <div className="bg-surfaceLight rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="text-warning" size={20} />
              <span className="font-medium text-text-primary">Login Alerts</span>
            </div>
            <p className="text-sm text-success">Active</p>
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Lock className="text-primary" />
          Change Password
        </h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Current Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">New Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Confirm New Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Confirm new password"
            />
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all shadow-neon">
            Update Password
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Bell className="text-primary" />
          Security Notifications
        </h2>
        <div className="space-y-4">
          {[
            { label: 'Email alerts for login attempts', enabled: true },
            { label: 'Push notifications for security events', enabled: true },
            { label: 'Weekly security reports', enabled: false },
            { label: 'Alert for password changes', enabled: true },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-surfaceLight rounded-lg">
              <span className="text-text-primary">{item.label}</span>
              <button
                className={`w-12 h-6 rounded-full transition-colors ${
                  item.enabled ? 'bg-primary' : 'bg-surface'
                } relative`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    item.enabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Security
