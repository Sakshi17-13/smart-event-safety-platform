import { motion } from 'framer-motion'
import { pageTransition } from './presets'

const MotionPage = ({ children, className = 'min-h-[calc(100vh-5rem)]' }) => (
  <motion.div
    className={className}
    variants={pageTransition}
    initial="hidden"
    animate="visible"
    exit="exit"
  >
    {children}
  </motion.div>
)

export default MotionPage
