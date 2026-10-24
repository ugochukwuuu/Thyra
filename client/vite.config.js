import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API is the Supabase Edge Function in supabase/functions/api; the app calls it directly (see src/lib/supabase.js).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
