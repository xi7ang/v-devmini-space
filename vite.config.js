import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

// MPA 多页入口：每页一个 html，页面间用 query 传参，不引 vue-router
const pages = ['index', 'category', 'resource', 'search', 'admin', 'disclaimer']
const input = {}
for (const p of pages) {
  input[p] = resolve(__dirname, `${p}.html`)
}

export default defineConfig({
  base: '/', // 自定义域名 v.devmini.space 根部署
  plugins: [vue()],
  build: {
    outDir: 'dist',
    rollupOptions: { input },
    minify: 'esbuild',
    sourcemap: false,
  },
})