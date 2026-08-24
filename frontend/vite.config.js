import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
