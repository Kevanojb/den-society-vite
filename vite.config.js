import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/den-society-vite/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Den Society League",
        short_name: "Den League",
        start_url: "/den-society-vite/index.html",
        scope: "/den-society-vite/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#10b981",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable any" }
        ]
      }
    })
  ],
});
