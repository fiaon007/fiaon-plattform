import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Die laufende Vite-Instanz im Entwicklungsbetrieb — damit auch die
 * serverseitig gerenderten SEO-Seiten (fiaon-seiten-seo.ts) durch
 * transformIndexHtml laufen. Ohne das fehlte dort der React-Refresh-Vorspann:
 * „@vitejs/plugin-react can't detect preamble", weiße Seite (05.09.2026,
 * Befund der Berater-Sitzung auf /app/demo). Im Betrieb bleibt sie null.
 */
export let viteInstanz: Awaited<ReturnType<typeof createViteServer>> | null = null;

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  viteInstanz = vite;
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // CRITICAL: Never serve index.html for /api/* routes - they must return JSON 404
    if (url.startsWith("/api")) {
      return res.status(404).json({
        ok: false,
        error: "API endpoint not found",
        path: url,
      });
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Gehashte Bauartefakte dürfen lange im Browser bleiben; index.html NIE — sonst
  // lädt ein Handy nach einem Deploy noch tagelang das alte Bündel (23.08.2026).
  app.use(express.static(distPath, {
    maxAge: "30d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache, must-revalidate");
      else if (/\/assets\//.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));

  // fall through to index.html if the file doesn't exist
  // CRITICAL: Never serve index.html for /api/* routes - they must return JSON 404
  app.use("*", (req, res) => {
    // 06.10.2026 (E-291): Eine fehlende Bau-Datei (/assets/…) bekommt ein echtes 404 — NIE die index.html.
    // Vorher antwortete der Server mit 200 + HTML; Safari verwarf das Stilblatt still und die App startete
    // ungestaltet (Justin, iPhone, 00:33 — eine Minute nach dem Deploy, als alte und neue Instanz parallel liefen).
    // Mit 404 meldet der Browser einen Fehler, und client/src/main.tsx lädt die Seite frisch.
    // Dasselbe für jede andere fehlende Datei mit Dateiendung (z. B. /favicon.ico vor E-292: HTML statt Symbol).
    const pfadOhneQuery = req.originalUrl.split("?")[0];
    if (req.originalUrl.startsWith("/assets/") || /\.(ico|png|jpe?g|gif|svg|webp|avif|css|m?js|map|woff2?|ttf|otf|mp4|webm|webmanifest)$/i.test(pfadOhneQuery)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).type("text/plain").send("Nicht gefunden");
    }
    if (req.originalUrl.startsWith("/api")) {
      return res.status(404).json({
        ok: false,
        error: "API endpoint not found",
        path: req.originalUrl,
      });
    }
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
