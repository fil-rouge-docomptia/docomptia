import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDirectory = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: webDirectory,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(webDirectory, 'src'),
    },
  },
  build: {
    outDir: resolve(webDirectory, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4311,
    proxy: {
      '/api': 'http://127.0.0.1:4310',
    },
  },
})
