import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BASE_URL = process.env.BASE_URL || '/';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: BASE_URL,
        name: 'Lock In',
        short_name: 'Lock In',
        description:
          'Commit to a goal, lock its deadline, and ship against it. Local-first weekly planning that works fully offline. No account, no tracking.',
        categories: ['productivity', 'utilities'],
        lang: 'en',
        dir: 'ltr',
        theme_color: '#6d28d9',
        background_color: '#6d28d9',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        launch_handler: {
          client_mode: ['navigate-existing', 'auto'],
        },
        orientation: 'portrait',
        start_url: BASE_URL,
        scope: BASE_URL,
        prefer_related_applications: false,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: 'screenshots/screenshot-goal.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'A locked goal with its deadline countdown and progress',
          },
          {
            src: 'screenshots/screenshot-week.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'The weekly plan showing this week at a glance',
          },
          {
            src: 'screenshots/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'The rolling weeks table with status dots per day',
          },
        ],
        shortcuts: [
          {
            name: 'This week',
            short_name: 'Week',
            description: 'Jump to the weekly plan',
            url: `${BASE_URL}?tab=weeks`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'New goal',
            short_name: 'Goals',
            description: 'Open your goals',
            url: `${BASE_URL}?tab=goals`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'History',
            short_name: 'History',
            description: 'Review your audit log and settings',
            url: `${BASE_URL}?tab=history`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // includeAssets already precaches the icons/favicons — exclude the large
        // share assets (OG image, install screenshots) from the offline cache.
        globIgnores: [
          'apple-touch-icon.png',
          'favicon.svg',
          'favicon.ico',
          'favicon-*.png',
          'icons/*.png',
          'og-image.png',
          'screenshots/*.png',
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
