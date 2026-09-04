import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api is proxied to a local ResearchGateBE (`npm run dev` there, port
// 8891) unless VITE_API_BASE points somewhere else. In production the built
// bundle calls VITE_API_BASE directly — set it on Render before building.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8891', changeOrigin: true } },
  },
  build: { outDir: 'dist' },
})
