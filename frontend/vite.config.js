import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/adventures(\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-adventures',
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 }
            }
          }
        ]
      }
    })
  ],
  define: {
    'process.env.REACT_APP_GIT_COMMIT': JSON.stringify(process.env.REACT_APP_GIT_COMMIT || 'unknown'),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
    terserOptions: {
      compress: {
        dead_code: false,
        drop_console: false
      },
      mangle: false
    },
    rollupOptions: {
      treeshake: false
    }
  }
})
