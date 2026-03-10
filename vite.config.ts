import { defineConfig, loadEnv, type PluginOption, type TerserOptions } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'
import terser from './terser.config'
import visualizer from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 显式加载环境变量（兼容自定义 mode：dev/qa/prd）
  const env = loadEnv(mode, process.cwd(), '')

  if (!env.VITE_API_BASE_URL) {
    // 仅启动时提示一次，便于排查“读不到 env”
    console.warn(`[vite] VITE_API_BASE_URL is empty for mode=${mode}`)
  }

  return {
    server: {
      port: 5555,
    },
    plugins: [
      react(),
      vue({
        script: {
          defineModel: true,
          propsDestructure: true,
        },
      }),
      tailwindcss(),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      visualizer({
        open: true,
        filename: 'bundle-analysis.html'
      })
    ].flat() as PluginOption[],
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
    build: {
      minify: 'terser',
      terserOptions: terser as TerserOptions,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return

            if (/node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
              return 'vendor-react'
            }

            if (/node_modules[\\/]@tiptap[\\/]/.test(id)) {
              return 'vendor-tiptap'
            }

            if (id.includes('markdown-it') || id.includes('highlight.js')) {
              return 'vendor-markdown'
            }

            if (id.includes('mermaid')) {
              return 'vendor-mermaid'
            }

            if (
              id.includes('cytoscape') ||
              id.includes('cose-bilkent') ||
              id.includes('dagre') ||
              id.includes('@xyflow')
            ) {
              return 'vendor-graph'
            }

            if (id.includes('katex')) {
              return 'vendor-katex'
            }
          },
        },
      },
    }
  }
})
