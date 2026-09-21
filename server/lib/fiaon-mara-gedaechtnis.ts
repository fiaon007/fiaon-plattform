// ═══════════════════════════════════════════════════════════════════════════
// MARAS GEDÄCHTNIS (21.09.2026, Justin)
//
// „Sie hat ein viel besseres und smarteres Gedächtnis, sodass sie wirklich den
// Verlauf, alle Logs, ALLES bis ins kleinste Detail kennt — um den Kunden so
// perfekt und so menschlich wie möglich zum Konvertieren zu bringen."
//
// Der Weg des Kunden (fiaon-kundenweg.ts) ist eine Zeitleiste — gekappt nach
// Zeichen. Was ein Kunde vor vier Wochen in einem Nebensatz schrieb („ich
// arbeite im Schichtdienst, abends bin ich erreichbar", „die Karte brauche ich
// für den Urlaub im Oktober"), fiel bei 60 Zahlungserinnerungen hinten heraus.
//
// Hier merkt sich Mara solche Dinge ausdrücklich: Nach jeder Antwort nennt sie,
// was sie Neues über den Menschen weiß, und diese Sätze stehen ab dann über
// jeder Akte, die sie liest — beim Antworten UND beim Anschreiben.
//
// Grenzen: höchstens 40 Sätze je Person (die jüngsten bleiben), keine
// besonderen Kategorien nach Art. 9 DSGVO (Gesundheit, Religion, Herkunft …) —
// die Wand unten lässt sie gar nicht erst hinein. Jeder Satz ist im Steuerpult
// sichtbar und löschbar.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export interface Merksatz { am: string; text: string; quelle: string }

const HOECHSTENS = 40;
/** Besondere Kategorien (Art. 9 DSGVO) — solche Sätze merkt sich Mara nie. */
const SENSIBEL = /\b(krank\w*|krankheit|diagnos\w*|krebs|depress\w*|psych\w*|therapie\w*|schwanger\w*|behinder\w*|operation|klinik\w*|krankenhaus|medikament\w*|religi\w*|muslim\w*|christ\w*|jüd\w*|juden|kirche|moschee|ethni\w*|herkunft|hautfarbe|sexuell\w*|homosexuell\w*|schwul|lesbisch|partei\w*|gewerkschaft\w*|vorstraf\w*|haft|gefängnis)\b/i;

/** Gehört ein Satz zu den besonderen Kategorien? Dann merkt Mara ihn sich nie. */
export function istSensibel(satz: string): boolean { return SENSIBEL.test(String(satz || "")); }

let bereit = false;
async function tabelle(): Promise<void> {
  if (bereit) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_mara_gedaechtnis (
      person_id INTEGER PRIMARY KEY,
      fakten JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  bereit = true;
}

function liste(v: unknown): Merksatz[] {
  const roh = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return []; } })() : v;
  return Array.isArray(roh) ? roh.filter((x: any) => x && typeof x.text === "string").map((x: any) => ({ am: String(x.am || ""), text: String(x.text), quelle: String(x.quelle || "") })) : [];
}

export async function gedaechtnisLesen(personId: number | null): Promise<Merksatz[]> {
  if (!personId) return [];
  await tabelle();
  const [r] = (await sqlPool`SELECT fakten FROM fiaon_mara_gedaechtnis WHERE person_id = ${personId}`) as any[];
  return liste(r?.fakten);
}

/** Für den Prompt: „12.09.: arbeitet im Schichtdienst …" — oder ein leerer Satz. */
export async function gedaechtnisText(personId: number | null): Promise<string> {
  const f = await gedaechtnisLesen(personId).catch(() => []);
  if (!f.length) return "(Noch nichts gemerkt — dies ist dein erster genauer Blick auf diesen Menschen.)";
  return f.map((x) => `· ${x.am ? `${x.am.slice(8, 10)}.${x.am.slice(5, 7)}.: ` : ""}${x.text}`).join("\n");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();

/** Neue Merksätze anhängen — doppelte und sensible fallen weg, die jüngsten 40 bleiben. */
export async function gedaechtnisMerken(personId: number | null, saetze: unknown, quelle: string): Promise<number> {
  if (!personId || !Array.isArray(saetze)) return 0;
  const neu = saetze
    .map((s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 220))
    .filter((s) => s.length >= 8 && !SENSIBEL.test(s));
  if (!neu.length) return 0;
  await tabelle();
  const alt = await gedaechtnisLesen(personId);
  const bekannt = new Set(alt.map((x) => norm(x.text)));
  const heute = new Date().toISOString().slice(0, 10);
  const dazu = neu.filter((s) => { const k = norm(s); if (bekannt.has(k)) return false; bekannt.add(k); return true; })
    .map((text) => ({ am: heute, text, quelle }));
  if (!dazu.length) return 0;
  const alle = [...alt, ...dazu].slice(-HOECHSTENS);
  await sqlPool`
    INSERT INTO fiaon_mara_gedaechtnis (person_id, fakten, updated_at) VALUES (${personId}, ${sqlPool.json(alle as any)}, NOW())
    ON CONFLICT (person_id) DO UPDATE SET fakten = EXCLUDED.fakten, updated_at = NOW()`;
  return dazu.length;
}

/** Einen Merksatz löschen (Steuerpult) — nach seiner Position in der Liste. */
export async function gedaechtnisLoeschen(personId: number, index: number): Promise<boolean> {
  const alt = await gedaechtnisLesen(personId);
  if (index < 0 || index >= alt.length) return false;
  const rest = alt.filter((_, i) => i !== index);
  await sqlPool`UPDATE fiaon_mara_gedaechtnis SET fakten = ${sqlPool.json(rest as any)}, updated_at = NOW() WHERE person_id = ${personId}`;
  return true;
}

/** Für das Modell: die Beschreibung des Feldes „merken" — an einer Stelle. */
export const MERKEN_BESCHREIBUNG =
  "Was du über diesen Menschen NEU erfahren hast und dir für spätere Gespräche merken willst — höchstens 5 kurze Sätze, "
  + "nur Tatsachen, die er selbst gesagt hat oder die aus der Akte folgen (Erreichbarkeit, Zahlungsabsicht mit Datum, Einwand, "
  + "wofür er die Karte will, Familien- oder Arbeitslage, Ton). Keine Gesundheit, Religion, Herkunft oder ähnlich Sensibles. "
  + "Nichts, was schon im Gedächtnis steht. Leer, wenn nichts Neues.";
