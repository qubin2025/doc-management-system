import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // PWA 仅服务移动端入口(mobile.html)：injectRegister:false + 手动在 src/mobile/main.tsx 注册，
    // 桌面端 index.html 不注册 Service Worker，互不影响
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: '中航建科·工程咨询手机端',
        short_name: '工程咨询手机端',
        description: '工程现场拍照、GPS水印、自动上传归档 — 全过程工程咨询管理平台移动端',
        lang: 'zh-CN',
        start_url: './mobile.html',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3B82F6',
        background_color: '#F8FAFC',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 禁止导航回退，避免 SW 把桌面端路由劫持到缓存页面
        navigateFallback: null,
        // 仅预缓存移动端入口与图标；共享 JS/CSS chunk 由运行时缓存按需处理（文件名带hash，CacheFirst安全）
        globPatterns: ['mobile.html', 'pwa-*.png'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(js|css|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'mobile-assets', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
        },
      },
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile.html'),
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
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
