// ═══════════════════════════════════════════════════════════════════════════
// ADRESSVORSCHLÄGE BEIM TIPPEN (E-425, 22.10.2026)
//
// Justin: „Wenn wir eine Adresse eintippen, sollen Vorschläge kommen."
//
// Im Haus gibt es keinen Geokodier-Schlüssel (kein Google Places; GOOGLE_AI_API_KEY
// ist kein Geokodierer). Deshalb Photon (photon.komoot.io): auf OpenStreetMap,
// gebaut für Suche-beim-Tippen, ohne Schlüssel. Nominatim wäre die zweite Wahl —
// dessen Nutzungsregeln verbieten aber ausdrücklich Autovervollständigung.
//
// Fair bleiben (Nutzungsregeln der Anbieter):
//   · Ein eigener User-Agent mit Kontakt.
//   · Höchstens eine Anfrage je Sekunde für den ganzen Prozess (Warteschlange,
//     keine Parallelität); der Client wartet zusätzlich 400 ms nach dem Tippen.
//   · Zwischenspeicher 24 h (500 Einträge) — dieselbe Eingabe fragt nie zweimal.
//   · Mindestens 4 Zeichen mit Buchstaben (adressAnfrageSinnvoll).
//
// Der Anbieter steckt hinter EINER Funktion (anbieterSuchen). Wer später Smarty
// (USA) oder Google Places nimmt, tauscht nur sie aus — Antwortform bleibt
// AdressVorschlag (shared/fiaon-partner-crm.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { photonZuVorschlaegen, adressAnfrageSinnvoll, zeile, type AdressVorschlag } from "@shared/fiaon-partner-crm";

const PHOTON = process.env.ADRESS_PHOTON_URL || "https://photon.komoot.io/api/";
const USER_AGENT = "FIAON-Plattform/1.0 (Partner-CRM; +https://fiaon.com/kontakt)";
const ABSTAND_MS = 1100;
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map<string, { bis: number; wert: AdressVorschlag[] }>();
let naechsterSlot = 0;

/** Wartet auf den nächsten freien Takt (≥ 1,1 s Abstand). Zu lange Schlange → null (lieber kein Vorschlag als Stau). */
async function takt(): Promise<boolean> {
  const jetzt = Date.now();
  const slot = Math.max(jetzt, naechsterSlot);
  if (slot - jetzt > 2500) return false;
  naechsterSlot = slot + ABSTAND_MS;
  if (slot > jetzt) await new Promise((r) => setTimeout(r, slot - jetzt));
  return true;
}

/** DIE austauschbare Stelle: Anfrage an den Anbieter → Vorschläge. */
async function anbieterSuchen(q: string, sprache: string): Promise<AdressVorschlag[]> {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=8&lang=${encodeURIComponent(sprache)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Adressdienst antwortet mit HTTP ${res.status}`);
  return photonZuVorschlaegen(await res.json());
}

export async function adressVorschlaege(qRoh: unknown, spracheRoh: unknown = "de"): Promise<{ ok: true; vorschlaege: AdressVorschlag[]; hinweis: string | null } | { ok: false; status: number; error: string }> {
  const q = zeile(qRoh, 200);
  if (!adressAnfrageSinnvoll(q)) return { ok: true, vorschlaege: [], hinweis: null };
  const sprache = ["de", "en", "fr", "it"].includes(String(spracheRoh)) ? String(spracheRoh) : "de";
  const schluessel = `${sprache}|${q.toLowerCase()}`;
  const c = cache.get(schluessel);
  if (c && c.bis > Date.now()) return { ok: true, vorschlaege: c.wert, hinweis: null };
  if (!(await takt())) return { ok: true, vorschlaege: [], hinweis: "Gerade viele Anfragen — kurz weitertippen." };
  try {
    const wert = await anbieterSuchen(q, sprache);
    if (cache.size >= CACHE_MAX) { const erster = cache.keys().next().value; if (erster !== undefined) cache.delete(erster); }
    cache.set(schluessel, { bis: Date.now() + CACHE_MS, wert });
    return { ok: true, vorschlaege: wert, hinweis: wert.length ? null : "Keine passende Adresse gefunden — einfach von Hand eintragen." };
  } catch (e) {
    console.error("[ADRESSE] Vorschläge:", e instanceof Error ? e.message : e);
    return { ok: false, status: 502, error: "Der Adressdienst ist gerade nicht erreichbar — bitte von Hand eintragen." };
  }
}
