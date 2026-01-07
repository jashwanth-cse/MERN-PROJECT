import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimize React refresh
      fastRefresh: true,
      // Babel optimizations
      babel: {
        plugins: []
      }
    }),
    tailwindcss()
  ],

  // Optimize build
  build: {
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Optimize dependencies
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['react-toastify']
        }
      }
    },
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    }
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'react-toastify'],
    // Force pre-bundling
    force: false
  },

  // Server configuration
  server: {
    allowedHosts: ['054bd872bf8b.ngrok-free.app', 'c53f89942f06.ngrok-free.app'],
    // Enable HTTP/2
    https: false,
    // Faster HMR
    hmr: {
      overlay: true
    },
    // CORS
    cors: true
  },

  // Preview server (production mode)
  preview: {
    port: 5173,
    strictPort: true
  },

  // CSS optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {}
  }
})
