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
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
