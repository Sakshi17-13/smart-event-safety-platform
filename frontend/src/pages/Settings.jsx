import { User, Bell, Palette, Globe, Save } from 'lucide-react'

const Settings = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary text-glow">Settings</h1>
        <p className="text-text-muted mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Settings */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <User className="text-primary" />
          Profile Settings
        </h2>
        <div className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">First Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Last Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Enter your last name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
            <input
              type="email"
              className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Bio</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              placeholder="Tell us about yourself"
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Bell className="text-primary" />
          Notification Preferences
        </h2>
        <div className="space-y-4">
          {[
            { label: 'Email notifications', enabled: true },
            { label: 'Push notifications', enabled: true },
            { label: 'SMS alerts', enabled: false },
            { label: 'Weekly digest', enabled: true },
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

      {/* Appearance */}
      <div className="glass rounded-xl p-6 border-glow">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Palette className="text-primary" />
          Appearance
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Theme</label>
            <select className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="dark">Dark (Default)</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Language</label>
            <select className="w-full px-4 py-3 bg-surfaceLight border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:opacity-90 transition-all shadow-neon">
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  )
}

export default Settings
