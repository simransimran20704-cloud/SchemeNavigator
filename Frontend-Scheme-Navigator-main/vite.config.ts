import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/brabble-api': {
        target: 'https://brabble.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/brabble-api/, ''),
      },
      '/parse-api': {
        target: 'https://api.parse.bot',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/parse-api/, ''),
      },
      '/mygov-rss': {
        target: 'https://www.mygov.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mygov-rss/, ''),
      },
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/brabble-api': {
        target: 'https://brabble.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/brabble-api/, ''),
      },
      '/parse-api': {
        target: 'https://api.parse.bot',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/parse-api/, ''),
      },
      '/mygov-rss': {
        target: 'https://www.mygov.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mygov-rss/, ''),
      },
    },
  },
})




