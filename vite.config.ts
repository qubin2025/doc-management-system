import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
  },
  server: {
    port: 5300,
    strictPort: true,
    host: '0.0.0.0', // 开放局域网访问
    hmr: {
      protocol: 'ws',
      host: '0.0.0.0',
      port: 5300,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/drawio-proxy': {
        target: 'https://embed.diagrams.net',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/drawio-proxy/, ''),
      },
    },
  },
})
