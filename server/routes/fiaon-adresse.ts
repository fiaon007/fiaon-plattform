// ═══════════════════════════════════════════════════════════════════════════
// ADRESS-VORSCHLÄGE FÜR DEN ANTRAG (23.08.2026)
//
// Justin: „Wenn man die Adresse eingibt, soll sie sich von Sekunde 1 an selbst
// ausfüllen … dann braucht er keine PLZ mehr, und wir haben korrekte Daten."
//
// Quelle: Photon (photon.komoot.io) — OpenStreetMap-Daten, kein Schlüssel,
// keine Kosten, Hausnummern für Deutschland, Österreich und die Schweiz. Der
// Browser fragt NICHT direkt dort an, sondern hier: so bleibt die Adresse des
// Kunden bei uns, Antworten werden zehn Minuten zwischengespeichert, und ein
// hängender Dienst blockiert den Antrag höchstens zwei Sekunden — dann tippt
// der Kunde einfach selbst weiter. Ein Google-Places-Schlüssel lässt sich hier
// später als zweite Quelle einhängen, ohne dass der Antrag sich ändert.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";

const router = Router();

export interface AdressVorschlag {
  strasse: string;      // „Musterstraße 12" — Straße mit Hausnummer, wenn vorhanden
  plz: string;
  ort: string;
  land: "DE" | "AT" | "CH";
  vollstaendig: boolean; // Hausnummer vorhanden?
}

const ERLAUBT = new Set(["DE", "AT", "CH"]);
const MITTE: Record<string, { lat: number; lon: number }> = { DE: { lat: 51.1, lon: 10.4 }, AT: { lat: 47.6, lon: 14.1 }, CH: { lat: 46.9, lon: 8.2 } };

// Zwischenspeicher: Schlüssel land|frage → Antwort, zehn Minuten, höchstens 2.000 Einträge.
const CACHE = new Map<string, { bis: number; liste: AdressVorschlag[] }>();
const TTL = 10 * 60 * 1000;
function ausCache(k: string): AdressVorschlag[] | null {
  const e = CACHE.get(k); if (!e) return null;
  if (e.bis < Date.now()) { CACHE.delete(k); return null; }
  return e.liste;
}
function inCache(k: string, liste: AdressVorschlag[]) {
  if (CACHE.size > 2000) { const erster = CACHE.keys().next().value; if (erster) CACHE.delete(erster); }
  CACHE.set(k, { bis: Date.now() + TTL, liste });
}

function photonZuVorschlag(f: any): AdressVorschlag | null {
  const p = f?.properties || {};
  const cc = String(p.countrycode || "").toUpperCase();
  if (!ERLAUBT.has(cc)) return null;
  const strasse = String(p.street || (p.osm_key === "highway" ? p.name : "") || "").trim();
  if (!strasse) return null;
  const haus = String(p.housenumber || "").trim();
  const ort = String(p.city || p.town || p.village || p.municipality || p.locality || "").trim();
  const plz = String(p.postcode || "").trim();
  if (!ort) return null;
  return { strasse: haus ? `${strasse} ${haus}` : strasse, plz, ort, land: cc as AdressVorschlag["land"], vollstaendig: !!haus };
}

/** GET /adresse?q=Musterstr 1&land=DE → { ok, vorschlaege[] } */
router.get("/adresse", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const land = String(req.query.land || "DE").toUpperCase();
  const mitte = MITTE[land] || MITTE.DE;
  if (q.length < 3) return res.json({ ok: true, vorschlaege: [] });
  const key = `${land}|${q.toLowerCase()}`;
  const cached = ausCache(key);
  if (cached) return res.json({ ok: true, vorschlaege: cached, cache: true });

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=10&lat=${mitte.lat}&lon=${mitte.lon}&location_bias_scale=0.6&layer=house&layer=street`;
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), 2200);
  try {
    const r = await fetch(url, { signal: ab.signal, headers: { "User-Agent": "FIAON-Antrag/1.0 (https://www.fiaon.com)" } });
    if (!r.ok) throw new Error(`Photon ${r.status}`);
    const j: any = await r.json();
    const gesehen = new Set<string>();
    const liste: AdressVorschlag[] = [];
    for (const f of (j?.features || [])) {
      const v = photonZuVorschlag(f); if (!v) continue;
      const k = `${v.strasse}|${v.plz}|${v.ort}|${v.land}`.toLowerCase();
      if (gesehen.has(k)) continue; gesehen.add(k);
      liste.push(v);
      if (liste.length >= 6) break;
    }
    // Das Land des Kunden zuerst, vollständige Adressen (mit Hausnummer) vor Straßen.
    liste.sort((a, b) => (a.land === land ? 0 : 1) - (b.land === land ? 0 : 1) || (a.vollstaendig ? 0 : 1) - (b.vollstaendig ? 0 : 1));
    inCache(key, liste);
    res.json({ ok: true, vorschlaege: liste });
  } catch (err: any) {
    // Kein Drama: Der Antrag funktioniert ohne Vorschläge weiter.
    if (err?.name !== "AbortError") console.error("[ADRESSE] Vorschläge:", err?.message || err);
    res.json({ ok: true, vorschlaege: [], fehler: "keine Vorschläge" });
  } finally {
    clearTimeout(t);
  }
});

export default router;
