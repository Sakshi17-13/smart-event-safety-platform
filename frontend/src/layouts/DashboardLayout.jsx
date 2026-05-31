import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import RealtimeToasts from '../components/RealtimeToasts'
import { pageTransition } from '../motion/presets'

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()

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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="min-h-[calc(100vh-5rem)]"
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <RealtimeToasts />
    </div>
  )
}

export default DashboardLayout
