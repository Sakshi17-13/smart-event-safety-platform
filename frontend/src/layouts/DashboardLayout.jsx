import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import RealtimeToasts from '../components/RealtimeToasts'

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed)

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Navbar toggleSidebar={toggleSidebar} />
        <main className="pt-20 p-6">
          <Outlet />
        </main>
      </div>
      <RealtimeToasts />
    </div>
  )
}

export default DashboardLayout
