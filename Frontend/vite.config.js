import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/generate-pdf': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/create-razorpay-order': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/verify-razorpay-payment': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('nivo')) return 'vendor-nivo';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf')) return 'vendor-jspdf';
            if (id.includes('html2canvas')) return 'vendor-html2canvas';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('date-fns')) return 'vendor-datefns';
            if (id.includes('lodash')) return 'vendor-lodash';
            return 'vendor';
          }
          // Per-page code splitting (for src/pages/*)
          if (id.includes('/src/pages/')) {
            const match = id.match(/src\/pages\/([^/]+)\//);
            if (match && match[1]) {
              return `page-${match[1]}`;
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
