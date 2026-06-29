import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// HermesOps 前端构建配置
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Monaco Editor: 用 CDN worker，避免本地 worker bundling 复杂性
  define: {
    'process.env.MONACO_WORKER_PATH': JSON.stringify('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'),
  },
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.api'],
  },
  server: {
    port: 5173,
    open: true,
    host: true,
    proxy: {
      // 前端 /api/* → Node 桥接服务（src/server/server.mjs）
      // 端口由 hermesops 启动脚本通过 HERMESOPS_BRIDGE_PORT 注入，默认 3001
      '/api': {
        target: `http://127.0.0.1:${process.env.HERMESOPS_BRIDGE_PORT || 3001}`,
        changeOrigin: true,
      },
      // WebSocket 终端 /ws/terminal → 同一后端
      '/ws': {
        target: `ws://127.0.0.1:${process.env.HERMESOPS_BRIDGE_PORT || 3001}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
})
