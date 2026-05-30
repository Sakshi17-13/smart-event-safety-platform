import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendPortFile = path.resolve(__dirname, '../backend/.runtime/backend-port.json')

const getBackendTarget = () => {
  if (process.env.VITE_BACKEND_TARGET) {
    return process.env.VITE_BACKEND_TARGET
  }

  try {
    const runtime = JSON.parse(fs.readFileSync(backendPortFile, 'utf8'))
    if (runtime?.url) return runtime.url
    if (runtime?.port) return `http://localhost:${runtime.port}`
  } catch {
    // Backend has not started yet; use the preferred development port.
  }

  return 'http://localhost:5001'
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: getBackendTarget(),
        router: getBackendTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: getBackendTarget(),
        router: getBackendTarget,
        ws: true,
      },
    },
  },
})
