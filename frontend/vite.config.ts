import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/gateway': 'http://localhost:8000',
      '/scenarios': 'http://localhost:8000',
      '/policies': 'http://localhost:8000',
      '/audit': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/demo': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/approvals': 'http://localhost:8000',
      '/threat-timeline': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
