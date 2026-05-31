export const motionTimings = {
  instant: 0.16,
  fast: 0.24,
  base: 0.36,
  slow: 0.9,
}

export const motionEasings = {
  premium: [0.22, 1, 0.36, 1],
  soft: [0.16, 1, 0.3, 1],
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: motionTimings.base, ease: motionEasings.soft },
  },
  exit: {
    opacity: 0,
    transition: { duration: motionTimings.fast, ease: motionEasings.premium },
  },
}

export const slideUp = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: motionTimings.base, ease: motionEasings.premium },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: { duration: motionTimings.fast, ease: motionEasings.premium },
  },
}

export const pageTransition = {
  hidden: { opacity: 0, y: 14, scale: 0.992, filter: 'blur(5px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: motionTimings.base, ease: motionEasings.premium },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.996,
    filter: 'blur(4px)',
    transition: { duration: motionTimings.fast, ease: motionEasings.premium },
  },
}

export const scaleHover = {
  whileHover: {
    scale: 1.018,
    transition: { duration: motionTimings.instant, ease: motionEasings.premium },
  },
  whileTap: {
    scale: 0.985,
    transition: { duration: motionTimings.instant, ease: motionEasings.premium },
  },
}

export const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 0 rgba(59, 130, 246, 0)',
      '0 0 28px rgba(59, 130, 246, 0.28)',
      '0 0 0 rgba(59, 130, 246, 0)',
    ],
    transition: {
      duration: 2.6,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
}

export const realtimeBreathing = {
  animate: {
    scale: [1, 1.12, 1],
    opacity: [0.72, 1, 0.72],
    transition: {
      duration: 1.8,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
}
