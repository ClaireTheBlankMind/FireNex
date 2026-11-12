
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.svg',
        'images/FireNex Fire-Logo.png'
      ],

      manifest: {
        name: 'FireNex | Fire Response Monitoring System',
        short_name: 'FireNex',
        description:
          'IoT-based real-time fire detection, dispatch, and response monitoring system.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'images/FireNex Fire-Logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'images/FireNex Fire-Logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,geojson,wasm,webp,woff,woff2}'
        ],

        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,

        // Serve the React application when navigating offline.
        navigateFallback: '/index.html',

        // Activate and control pages with the updated service worker.
        clientsClaim: true,
        skipWaiting: true,

        // Remove outdated Workbox caches.
        cleanupOutdatedCaches: true
      }
    })
  ],

  assetsInclude: ['**/*.wasm']
})
