import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // 开放局域网访问
    hmr: {
      protocol: 'ws',
      host: '0.0.0.0',
      port: 5173,
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/temp-images': 'http://localhost:3000',
      '/drawio-proxy': {
        target: 'https://embed.diagrams.net',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/drawio-proxy/, ''),
      },
    },
  },
})
