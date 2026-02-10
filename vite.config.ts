import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 显式加载环境变量（兼容自定义 mode：dev/qa/prd）
  const env = loadEnv(mode, process.cwd(), '')

  if (!env.VITE_API_BASE_URL) {
    // 仅启动时提示一次，便于排查“读不到 env”
    // eslint-disable-next-line no-console
    console.warn(`[vite] VITE_API_BASE_URL is empty for mode=${mode}`)
  }

  return {
    server: {
      port: 5555,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // 兜底：把 API 地址注入成编译期常量，避免 import.meta.env 注入异常
    define: {
      __API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL ?? ''),
      __VITE_MODE__: JSON.stringify(mode),
    },
  }
})
