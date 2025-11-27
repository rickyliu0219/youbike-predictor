// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 若你有 cloudflared 網址，填在環境變數 VITE_PUBLIC_HOST（例如 accordingly-xxx.trycloudflare.com）
// 沒有也沒關係，會自動用預設
const PUBLIC_HOST = process.env.VITE_PUBLIC_HOST || undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,              // 讓外網可連
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',   // 後端 FastAPI
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    },
    // 允許經由 cloudflared 進來的外網 Host；同時保留本機
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com'],

    // HMR 在經過反向代理（cloudflared/NGROK）時較穩定的設定
    hmr: PUBLIC_HOST
      ? {
          host: PUBLIC_HOST, // e.g. accordingly-practical-represents-loops.trycloudflare.com
          protocol: 'wss',
          clientPort: 443
        }
      : true
  }
})
