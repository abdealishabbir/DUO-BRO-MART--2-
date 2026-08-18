import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "Duo Bro Mart",
        short_name: "Duo Bro Mart",
        description:
          "Pakistan's multi-vendor marketplace — electronics, fashion, home goods and more, with Cash on Delivery.",
        theme_color: "#9A4A1D",
        background_color: "#FDF6EE",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML/fonts/images from the build
        // output) so the SPA can launch and render with zero network —
        // this is what actually makes "offline cart access" meaningful,
        // since CartContext already reads/writes localStorage and never
        // needed the network in the first place. The one thing this must
        // NOT do is cache API responses: this is a real-money marketplace
        // where a stale price, stock count, or order status could
        // mislead a customer. lib/api.js already sets cache:"no-store"
        // on every request for the same reason — deliberately not adding
        // any runtimeCaching rule for /api/ here keeps that intact, so
        // API calls always hit the network and simply fail while
        // offline (correct) instead of silently serving old data.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  // Vitest reads its config from this same `test` key — no separate
  // vitest.config.js needed, and it automatically inherits the same
  // @vitejs/plugin-react setup the dev/build server uses (JSX transform,
  // Fast Refresh disabled in test mode automatically).
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: false, // Tailwind's CSS import isn't relevant to jsdom assertions and only slows startup
    globals: false, // deliberate — explicit `import { describe, it, expect } from "vitest"` per file, not magic globals
  },
});
