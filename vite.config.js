import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'images/FireNex Fire-Logo.png'],
      manifest: {
        name: 'FireNex | Fire Response Monitoring System',
        short_name: 'FireNex',
        description: 'IoT-based real-time fire detection, dispatch, and response monitoring system.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'images/FireNex Fire-Logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'images/FireNex Fire-Logo.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Cache all these file types, including WASM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,geojson}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Increase to 10MB to handle large map/wasm files
        // NEW: Make sure WASM files are served with the right headers
        navigateFallbackDenylist: [/^\/assets\/.*\.wasm$/], 
      }
    })
  ],
  // NEW: Ensure the wasm file is not inlined and is handled as an asset
  assetsInclude: ['**/*.wasm'],
})