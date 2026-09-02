// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICHE KENNZAHLEN — für /transparenz und /fiaon-erfahrungen (02.09.2026)
//
// Dieselbe Zähl-Definition wie das Chefbüro (fiaon-chef-lage.ts / -zahlen.ts):
// zahlende Kunden = Personen mit bankbestätigter Zahlung (payment_status
// 'paid'), ohne Testkonten, ohne zusammengeführte Dubletten; Raten = Zeilen
// mit status 'bezahlt'. Abgerundet auf Zehner, damit die Seite nie eine Zahl
// zeigt, die sich stündlich ändert — und nie mehr verspricht, als da ist.
//
// Ohne Anmeldung erreichbar, deshalb: nur Summen, keine Namen, keine Umsätze
// (die stehen im Datenraum), eine Stunde Zwischenspeicher im Prozess.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { SEO_WERKZEUGE } from "@shared/fiaon-seo-seiten";

const router = Router();
const ECHT = "p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL";

type Kennzahlen = {
  stand: string;               // ISO-Datum des Zählens
  kunden: number;              // zahlende Kunden, abgerundet auf Zehner
  kundenGenau: number;
  raten: number;               // bezahlte Monatsraten, abgerundet auf Zehner
  ratenGenau: number;
  laender: { DE: number; AT: number; CH: number; weitere: number };
  werkzeuge: number;
  ratgeber: number;
};

let cache: { wert: Kennzahlen; bis: number } | null = null;
const zehner = (n: number) => Math.floor(n / 10) * 10;

async function zaehlen(): Promise<Kennzahlen> {
  const [k] = (await sqlPool.unsafe(`
    SELECT
      (SELECT COUNT(DISTINCT a.person_id) FROM fiaon_applications a
         JOIN fiaon_persons p ON p.id = a.person_id
        WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND ${ECHT})::int AS kunden,
      (SELECT COUNT(*) FROM fiaon_abo_raten r
         JOIN fiaon_applications a ON a.ref = r.ref
         LEFT JOIN fiaon_persons p ON p.id = a.person_id
        WHERE r.status = 'bezahlt' AND a.merged_into IS NULL AND ${ECHT})::int AS raten,
      (SELECT COUNT(*) FROM fiaon_ratgeber WHERE status = 'veroeffentlicht')::int AS ratgeber
  `)) as any[];
  const laender = (await sqlPool.unsafe(`
    SELECT UPPER(COALESCE(NULLIF(TRIM(p.country), ''), '?')) AS land, COUNT(DISTINCT a.person_id)::int AS n
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND ${ECHT}
     GROUP BY 1
  `)) as any[];
  const je: Record<string, number> = {};
  for (const z of laender) je[String(z.land)] = Number(z.n) || 0;
  const DE = je.DE || 0, AT = je.AT || 0, CH = je.CH || 0;
  const weitere = laender.reduce((s, z) => s + (Number(z.n) || 0), 0) - DE - AT - CH;
  return {
    stand: new Date().toISOString().slice(0, 10),
    kunden: zehner(Number(k?.kunden) || 0), kundenGenau: Number(k?.kunden) || 0,
    raten: zehner(Number(k?.raten) || 0), ratenGenau: Number(k?.raten) || 0,
    laender: { DE, AT, CH, weitere: Math.max(0, weitere) },
    werkzeuge: SEO_WERKZEUGE.length,
    ratgeber: Number(k?.ratgeber) || 0,
  };
}

/** GET /api/fiaon/oeffentlich/kennzahlen — ohne Anmeldung, 1 h Zwischenspeicher. */
router.get("/oeffentlich/kennzahlen", async (_req: Request, res: Response) => {
  try {
    if (!cache || Date.now() > cache.bis) {
      cache = { wert: await zaehlen(), bis: Date.now() + 60 * 60 * 1000 };
    }
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ ok: true, ...cache.wert });
  } catch (e: any) {
    console.error("[OEFFENTLICH] Kennzahlen:", String(e?.message || e).slice(0, 200));
    // Lieber die letzte bekannte Zahl als gar keine — die Seite hat eigene Stand-Werte als Rückfall.
    if (cache) return res.json({ ok: true, ...cache.wert, veraltet: true });
    res.status(503).json({ ok: false, error: "Kennzahlen gerade nicht verfügbar" });
  }
});

export default router;
