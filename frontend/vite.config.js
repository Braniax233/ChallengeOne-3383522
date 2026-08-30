import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    proxy: {
      '/api/sasusync': {
        target: 'https://sms.sasusync.com/api/v1/send',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sasusync/, '')
      }
    }
  }
})
