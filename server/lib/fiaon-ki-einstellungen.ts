// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN DES KI-RAUMS (E-409, 19.10.2026)
//
// Liest die Werte ALLER Register-Schlüssel (shared/fiaon-ki-schalter.ts) in
// einem Rutsch — aus fiaon_settings, mit ENV-Ersatz, wo ein Schlüssel heute
// noch aus der Umgebung kommt (postmeister_tag_euro ← POSTMEISTER_TAG_EURO) —
// und schreibt die Schlüssel, die keinen anderen Setzer haben (KI_SCHLUESSEL).
// Jeder andere Register-Schlüssel hat seinen Setzer; die Route sagt dann
// 409 „Setzer ist <route>“ — kein zweiter Schreibweg, keine zweite Wahrheit.
// ARAS-Schlüssel gehen über die Anbindung an einstellungSetzen (Team 1).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { REGISTER, KI_SCHLUESSEL, ARAS_SCHLUESSEL, registerEintrag, wertPruefen, wertAnzeige, type RegisterEintrag } from "@shared/fiaon-ki-schalter";
import { aras, arasVerbunden, NICHT_VERBUNDEN } from "./fiaon-ki-aras-anbindung";

/** Schlüssel, die bis zum Eintrag in fiaon_settings aus der Umgebung kommen. */
const ENV_ERSATZ: Record<string, string> = { postmeister_tag_euro: "POSTMEISTER_TAG_EURO" };

export interface EinstellungenSicht {
  register: (Omit<RegisterEintrag, "jsonPruefen" | "muss"> & { muss?: string })[];
  werte: Record<string, string>;
  /** Welche Werte wirklich gespeichert sind (sonst gilt die Vorgabe). */
  gesetzt: Record<string, boolean>;
  arasVerbunden: boolean;
}

export async function einstellungenLesen(): Promise<EinstellungenSicht> {
  const schluessel = REGISTER.map((e) => e.schluessel);
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`.catch(() => [])) as any[];
  const roh = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const werte: Record<string, string> = {};
  const gesetzt: Record<string, boolean> = {};
  for (const e of REGISTER) {
    let w = roh.get(e.schluessel);
    if ((w == null || w === "") && ENV_ERSATZ[e.schluessel] && process.env[ENV_ERSATZ[e.schluessel]]) w = String(process.env[ENV_ERSATZ[e.schluessel]]);
    gesetzt[e.schluessel] = roh.has(e.schluessel);
    werte[e.schluessel] = w == null ? e.vorgabe : wertAnzeige(e, w);
  }
  return {
    register: REGISTER.map(({ jsonPruefen: _j, muss, ...rest }) => ({ ...rest, ...(muss ? { muss: muss.source } : {}) })),
    werte, gesetzt, arasVerbunden: arasVerbunden(),
  };
}

export type SetzErgebnis = { ok: true; schluessel: string; wert: string } | { ok: false; status: 400 | 404 | 409; fehler: string };

/**
 * Einen Schlüssel setzen — nur KI_SCHLUESSEL hier, ARAS über die Anbindung; alles andere → sein Setzer.
 * Die Grenze ist `wertPruefen` aus dem Register (dieselbe wie in der Oberfläche).
 */
export async function einstellungSetzen(schluessel: string, wert: unknown, von: string): Promise<SetzErgebnis> {
  const e = registerEintrag(schluessel);
  if (!e) return { ok: false, status: 404, fehler: "Diesen Schalter gibt es nicht im Register." };
  const p = wertPruefen(e, wert);
  if (!p.ok) return { ok: false, status: 400, fehler: p.fehler };
  if (ARAS_SCHLUESSEL.includes(schluessel)) {
    const a = aras();
    if (!a?.plan?.einstellungSetzen) return { ok: false, status: 404, fehler: NICHT_VERBUNDEN };
    try {
      await a.plan.einstellungSetzen(schluessel, p.wert, von);
    } catch (err) {
      return { ok: false, status: 400, fehler: String((err as Error)?.message ?? err).slice(0, 200) };
    }
    console.log(`[KI-EINSTELLUNG] ${schluessel} = ${p.wert.slice(0, 60)} (${von}, über Aras)`);
    return { ok: true, schluessel, wert: p.wert };
  }
  if (!KI_SCHLUESSEL.includes(schluessel)) return { ok: false, status: 409, fehler: `Setzer ist ${e.setzer.route}` };
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${p.wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[KI-EINSTELLUNG] ${schluessel} = ${p.wert.slice(0, 60)} (${von})`);
  return { ok: true, schluessel, wert: p.wert };
}

/** Einen Zahlenwert lesen, mit Vorgabe und Grenze des Registers — für Leser wie den Prüf-Takt. */
export async function registerZahl(schluessel: string): Promise<number> {
  const e = registerEintrag(schluessel);
  const vorgabe = Number(e?.vorgabe ?? 0) || 0;
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel}`) as any[];
    const n = Number(z?.value);
    if (!Number.isFinite(n)) return vorgabe;
    return Math.max(e?.min ?? -Infinity, Math.min(e?.max ?? Infinity, n));
  } catch { return vorgabe; }
}

/** Einen Textwert lesen (Vorgabe aus dem Register). */
export async function registerWert(schluessel: string): Promise<string> {
  const e = registerEintrag(schluessel);
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel}`) as any[];
    const w = z?.value == null ? "" : String(z.value);
    return w === "" ? (e?.vorgabe ?? "") : (e ? wertAnzeige(e, w) : w);
  } catch { return e?.vorgabe ?? ""; }
}

/**
 * NOT-AUS MARA (Heute-Seite): Mail-Aktion, WhatsApp-Antworten und Postfach in einem Zug anhalten
 * — über dieselben Schlüssel, die die drei Läufe lesen. „start“ stellt an. Jeder Schritt im Log.
 */
export async function maraNotaus(an: boolean, von: string): Promise<{ aktion: string; whatsapp: string; postfach: string }> {
  const wert = an ? "aus" : "an";
  const { einstellungSetzen: aktionSetzen } = await import("./fiaon-mara-aktion");
  await aktionSetzen("mara_aktion_an", wert);
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('mara_wa_an', ${wert}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('postmeister_an', ${wert}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[KI-EINSTELLUNG] Mara ${an ? "NOT-AUS" : "wieder an"} (${von}): Aktion, WhatsApp, Postfach = ${wert}`);
  return { aktion: wert, whatsapp: wert, postfach: wert };
}
