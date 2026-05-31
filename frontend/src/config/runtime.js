export const demoModeEnabled =
  import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false')
