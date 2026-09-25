import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      devOptions: {
        enabled: true
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3145728,
        // ⚠️ 2026/09/25【BR③】：/api/... へのページ遷移を Service Worker が横取りして
        //    アプリの画面（index.html）を返していたため、除外する。
        //    （例：ブラウザで /api/cron/remind を開くと、API ではなく管理画面が出ていた）
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: 'QUEST HUB Admin',
        short_name: 'QH Admin',
        description: '店舗専用管理システム',
        theme_color: '#00b900',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});