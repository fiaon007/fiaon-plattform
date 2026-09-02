import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Generate build ID from timestamp (can be replaced with git SHA in CI)
const BUILD_ID = process.env.VITE_BUILD_ID || `build-${Date.now()}`;

// Enable sourcemaps only when explicitly requested (for debugging production issues)
const ENABLE_SOURCEMAPS = process.env.VITE_DEBUG_SOURCEMAP === 'true';

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
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
    // 03.09.2026 (E-092): Das Hauptbündel lag bei 1,86 MB — der Seobility-Bericht
    // vom 02.09. nannte es als einzigen technischen Fehler („Große Dateigröße",
    // Grenze 0,5 MB). Ursache: alle Fremdbibliotheken lagen in einer Datei, die
    // jede Seite lädt, auch die Startseite. Die Aufteilung trennt, was selten
    // gebraucht wird (3D, Diagramme, Editor), von dem, was immer nötig ist.
    // Der Browser lädt dadurch beim ersten Besuch deutlich weniger.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            // Eigener Code, den viele Seiten teilen: eigene Bündel statt Eintragsdatei.
            if (id.includes("/client/src/components/ui/")) return "a-bausteine";
            if (id.includes("/client/src/components/home3d/")) return "a-szenen";
            if (id.includes("/client/src/components/site/")) return "a-buehne";
            return;
          }
          const teil = (name: string) => id.includes(`node_modules/${name}`);
          // three.js: Kern und Zusätze getrennt — der Kern allein bliebe sonst
          // knapp über der 0,5-MB-Marke, die Seobility für Dateien ansetzt.
          if (id.includes("three/examples/") || id.includes("three-stdlib") || teil("@react-three/drei")) return "v-3d-zusatz";
          if (teil("three") || teil("@react-three")) return "v-3d";
          if (teil("recharts") || teil("d3-") || teil("victory")) return "v-diagramme";
          if (teil("framer-motion") || teil("motion-dom") || teil("motion-utils")) return "v-bewegung";
          if (teil("@radix-ui") || teil("cmdk") || teil("vaul") || teil("embla-carousel")) return "v-bausteine";
          if (teil("react-dom") || teil("scheduler")) return "v-react-dom";
          if (teil("react/") || teil("react-is") || teil("wouter") || teil("@tanstack")) return "v-react";
          if (teil("lucide-react") || teil("react-icons")) return "v-symbole";
          if (teil("date-fns") || teil("zod") || teil("clsx") || teil("tailwind-merge") || teil("class-variance-authority")) return "v-werkzeuge";
          return "v-rest";
        },
      },
    },
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
