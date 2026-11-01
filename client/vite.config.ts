import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        // Mise en cache exclusive des assets statiques de l'application (HTML, JS, CSS, SVG)
        // AUCUN contenu d'API, aucun message Matrix, aucun secret n'est mis en cache !
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_matrix/, /^\/_synapse/],
      },
      manifest: {
        name: 'SovereignMsg - Messagerie Souveraine de l\'État',
        short_name: 'SovereignMsg',
        description: 'Messagerie instantanée hautement sécurisée pour l\'administration burkinabè',
        theme_color: '#006633',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  build: {
    target: 'esnext'
  }
});

