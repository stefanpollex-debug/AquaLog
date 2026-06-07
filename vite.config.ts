import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "AquaLog",
        short_name: "AquaLog",
        description: "Pool-Wasseranalyse: Chlor, pH, Temperatur erfassen und mit KI auswerten",
        theme_color: "#0369a1",
        background_color: "#0369a1",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "de",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          // API-Calls nie cachen
          {
            urlPattern: /\/api\/anthropic/i,
            handler: "NetworkOnly",
          },
          // Wetter-API nie cachen
          {
            urlPattern: /api\.open-meteo\.com/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
