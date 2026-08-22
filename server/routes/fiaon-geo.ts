// ═══════════════════════════════════════════════════════════════════════════
// WOHER KOMMT DER BESUCHER? (22.08.2026, Justins Kundentest)
//
// „Wenn meine IP aus Österreich kommt, sollten die österreichischen
// Vorauswahlen getroffen werden." Bisher stand +49 hart im Antrag, das Land
// war leer. Reihenfolge: Header eines vorgeschalteten Netzes (Cloudflare,
// Vercel) → ip-api.com (frei, 45 Anfragen/Minute, nur das Land) → unbekannt.
// Der Client fällt dann auf Sprache/Zeitzone des Geräts zurück. Eine
// Vorbelegung ist ein Vorschlag; der Kunde kann sie jederzeit ändern.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";

const router = Router();
const cache = new Map<string, { land: string | null; bis: number }>();
const DACH = new Set(["DE", "AT", "CH"]);

function ipVon(req: Request): string {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
}

router.get("/geo", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, max-age=3600");
  const kopf = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || req.headers["x-country-code"] || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(kopf)) return res.json({ ok: true, land: kopf, dach: DACH.has(kopf), quelle: "header" });

  const ip = ipVon(req);
  if (!ip || /^(10\.|192\.168\.|127\.|::1|fc|fd)/.test(ip)) return res.json({ ok: true, land: null, dach: false, quelle: "privat" });
  const c = cache.get(ip);
  if (c && c.bis > Date.now()) return res.json({ ok: true, land: c.land, dach: !!c.land && DACH.has(c.land), quelle: "cache" });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, { signal: ctrl.signal });
    clearTimeout(t);
    const j: any = await r.json().catch(() => null);
    const land = j?.status === "success" && /^[A-Z]{2}$/.test(String(j.countryCode)) ? String(j.countryCode) : null;
    cache.set(ip, { land, bis: Date.now() + 6 * 60 * 60 * 1000 });
    if (cache.size > 5000) cache.clear();
    return res.json({ ok: true, land, dach: !!land && DACH.has(land), quelle: "ip" });
  } catch {
    return res.json({ ok: true, land: null, dach: false, quelle: "fehler" });
  }
});

export default router;
