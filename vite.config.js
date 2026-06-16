import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: './', // Use relative paths for assets
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'icons/*', 'audio/alphabet/*', 'fa/webfonts/*', 'words.json', 'grammar.json'],
    manifest: {
      name: 'LezgiMez',
      short_name: 'LezgiMez',
      description: 'Интерактивный помощник для изучения лезгинского языка.',
      theme_color: '#064e3b',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: 'icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,png,svg,ico,woff2,ttf,wav}'],
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB to allow words.json
    },
  }), cloudflare()],
});