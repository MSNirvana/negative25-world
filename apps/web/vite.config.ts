import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Keep the Web client aligned with the monorepo root .env.example.
  envDir: '../..',
  plugins: [vue(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['robots.txt'], manifest: { name: 'negative25 photography archive', short_name: 'negative25', description: "Don't just dream it, live it. Find your negative 25.", theme_color: '#0f0f10', background_color: '#0f0f10', display: 'standalone', start_url: '/', scope: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }, workbox: { runtimeCaching: [{ urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'photo-thumbnails', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } } }] } })],
});
