import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Generate build ID from timestamp (can be replaced with git SHA in CI)
const BUILD_ID = process.env.VITE_BUILD_ID || `build-${Date.now()}`;

// Enable sourcemaps only when explicitly requested (for debugging production issues)
const ENABLE_SOURCEMAPS = process.env.VITE_DEBUG_SOURCEMAP === 'true';

// ── DAS HAUPT-STILBLATT SPERRT DAS ERSTE BILD NICHT MEHR (24.09.2026) ─────────
// Vite schreibt `<link rel="stylesheet" href="/assets/index-….css">` (440 KB) in den Kopf.
// Solange es lädt, zeichnet der Browser NICHTS — auch nicht das Vorab-HTML, das der Server
// für Suchmaschinen in #root legt und das client/index.html inzwischen selbst gestaltet.
// Gemessen (Stilblatt 1,5 s verzögert): erstes Bild erst nach 1,6 s, davor weiß.
// Jetzt: Vorladen mit hoher Priorität, angewendet per media="print" → "all" nach dem Laden.
// React startet erst, wenn das Stilblatt da ist (client/src/main.tsx, stilblattBereit) —
// die App erscheint also nie ungestaltet. Nur für den Bau; der Dev-Server lädt CSS per JS.
function stilblattOhneSperre(): Plugin {
  return {
    name: "fiaon-stilblatt-ohne-sperre",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const neu = html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (_, href) =>
            `<link rel="preload" as="style" crossorigin href="${href}">\n    ` +
            `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'" data-fiaon-stil>`,
        );
        // Schreibt Vite den Link einmal anders, bleibt alles wie vor dem 24.09. (sperrend) — laut sagen.
        if (neu === html) console.warn("[fiaon-stilblatt-ohne-sperre] Kein Stilblatt-Link gefunden — das Haupt-Stilblatt sperrt wieder das erste Bild.");
        return neu;
      },
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    stilblattOhneSperre(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: ENABLE_SOURCEMAPS,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
