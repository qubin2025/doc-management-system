import { defineConfig, Plugin, ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TAG = '[FRONTEND-VITE]'
const ts = () => new Date().toISOString().replace('T', ' ').replace('Z', '')
const Log = {
  info:  (m: string, d: string = '') => console.log (`${ts()} ${TAG} INFO  ${m}${d ? ' | ' + d : ''}`),
  ok:    (m: string, d: string = '') => console.log (`${ts()} ${TAG} OK    ${m}${d ? ' | ' + d : ''}`),
  warn:  (m: string, d: string = '') => console.warn(`${ts()} ${TAG} WARN  ${m}${d ? ' | ' + d : ''}`),
  error: (m: string, d: string = '') => console.error(`${ts()} ${TAG} ERROR ${m}${d ? ' | ' + d : ''}`),
  phase: (n: string)           => console.log (`\n${ts()} ${TAG} ===== PHASE ${n} =====`),
}

Log.phase('0: CONFIG FILE LOAD')
Log.info('vite.config.ts loaded', `__dirname=${__dirname}`)
Log.info('Node version', process.version)
Log.info('Platform', `${os.platform()} ${os.arch()}  hostname=${os.hostname()}`)
Log.info('CPUs', `${os.cpus().length} cores  totalMem=${Math.round(os.totalmem()/1024/1024)}MB`)
Log.info('cwd', process.cwd())

function bootLoggerPlugin(): Plugin {
  let resolved: ResolvedConfig | null = null
  return {
    name: 'vite-boot-logger',
    configResolved(cfg) {
      resolved = cfg
      Log.phase('1: CONFIG RESOLVED')
      Log.info('Vite mode', cfg.mode)
      Log.info('Root', cfg.root)
      Log.info('Base', cfg.base)
      Log.info('Public dir', cfg.publicDir || '(default: public/)')
      const plugins = cfg.plugins.map(p => p.name)
      Log.info('Plugins loaded', `${plugins.length}: ${plugins.join(', ')}`)
      const server = cfg.server
      Log.info('Server', `port=${server.port}  strictPort=${server.strictPort}  host=${JSON.stringify(server.host)}`)
      if (server.proxy) {
        Log.info('Proxy entries', Object.keys(server.proxy).join(', '))
        for (const k of Object.keys(server.proxy)) {
          const p: any = server.proxy[k]
          Log.info('  proxy', `${k} → ${p.target || p}  changeOrigin=${p.changeOrigin}`)
        }
      }
      Log.ok('Config resolved OK')
    },
    configureServer(server) {
      Log.phase('2: DEV SERVER INIT')
      Log.info('configureServer called', `httpServer=${server.httpServer ? 'exists' : 'not-yet'}`)
      server.httpServer?.on('listening', () => {
        Log.ok('HTTP server event: listening')
      })
      server.httpServer?.on('error', (err: any) => {
        if (err?.code === 'EADDRINUSE') {
          const port = resolved?.server.port
          Log.error(`PORT ${port} ALREADY IN USE (EADDRINUSE)`, '→ 请先关闭占用进程: netstat -ano | findstr ' + port)
        } else {
          Log.error('HTTP server error', `${err?.code || 'UNKNOWN'}  ${err?.message}`)
        }
      })
      server.httpServer?.on('close', () => { Log.info('HTTP server event: close') })
      server.middlewares.use((req, _res, next) => {
        if (!req.url || req.url.startsWith('/__vite_ping') || req.url.startsWith('/@')) return next()
        next()
      })
      Log.ok('Dev server configured', 'middlewares + event handlers attached')
    },
    buildStart(options) {
      Log.phase('2B: BUILD START')
      Log.info('buildStart', `input=${JSON.stringify((options as any).input)}  rollupVersion=${(options as any).rollupVersion || 'n/a'}`)
    },
    configurePreviewServer(server) {
      Log.phase('2C: PREVIEW SERVER INIT')
      server.httpServer?.on('listening', () => { Log.ok('Preview server listening') })
    },
    closeBundle() {
      const secs = Date.now() / 1000
      Log.phase(`BUNDLE CLOSE @ ${secs.toFixed(0)}s`)
    },
  }
}

export default defineConfig({
  plugins: [
    bootLoggerPlugin(),
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
          // React 核心（所有页面共用）
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          // PDF 预览（仅文档预览页）
          'pdf-vendor': ['pdfjs-dist'],
          // Excel/CSV 处理（仅导入导出页）
          'xlsx-vendor': ['xlsx', 'jszip'],
          // 图表（仅仪表盘/统计页）
          'chart-vendor': ['recharts'],
          // 知识图谱/流程图（仅图谱模块）
          'graph-vendor': ['vis-network', 'vis-data', '@xyflow/react', 'dagre'],
          // 3D 力导向图（仅3D图谱页）
          '3d-vendor': ['three', 'react-force-graph-2d', 'react-force-graph-3d'],
          // 代码/Markdown 编辑器（仅编辑页）
          'editor-vendor': ['@uiw/react-codemirror', '@codemirror/lang-markdown', '@codemirror/state', '@codemirror/view'],
          // 文档解析（DOCX等，仅文档处理页）
          'doc-parser': ['mammoth'],
          // 全文搜索（仅搜索页）
          'search-vendor': ['lunr'],
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
