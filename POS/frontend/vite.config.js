import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone POS app. Runs on its own port and talks only to the POS backend
// (POS/backend, default http://localhost:5100).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
})
