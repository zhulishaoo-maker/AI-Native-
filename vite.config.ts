import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    host: '0.0.0.0',
    proxy: {
      '/api/images': {
        target: 'http://llm-gw.jd.local',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/images/, '/v1/images'),
      },
    },
  },
})
