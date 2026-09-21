import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs on :4000. Proxying keeps requests same-origin,
// so the httpOnly session cookie works exactly as it will in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
})
