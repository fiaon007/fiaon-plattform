// ═══════════════════════════════════════════════════════════════════════════
// „NEU FÜR SIE" — DIE DATEN DES FENSTERS IM GLOBAL-PORTAL (E-456, 29.10.2026)
//
// Liest, was die reine Funktion globalNeuigkeitenBauen (shared/fiaon-global-neuigkeiten.ts) braucht — alles aus
// Tabellen, die das Portal ohnehin liest — und vermerkt, bis wann der Kunde die Neuigkeiten gesehen hat
// (fiaon_global_auftraege.neuigkeiten_gesehen_am, angelegt in ensureGlobalBereich).
//
//   · LESEN schreibt nie. Die Vorschau der Leitung liest dieselbe Liste wie der Kunde.
//   · GESEHEN setzt die Route nur für den Kunden (nie in der Vorschau). Der Zeitpunkt kommt von der Seite: der
//     Stand, mit dem sie das Fenster gezeigt hat (`stand`). Was danach geschah, bleibt neu — auch wenn der Kunde
//     erst Minuten später „Verstanden" drückt. Er geht nie zurück und nie über „jetzt" hinaus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { ensureGlobalBereich } from "./fiaon-global-bereich";
import { globalAblehnungOffen, type BereichSprache, type GlobalDokumentStand } from "@shared/fiaon-global-bereich";
import { globalPlusFuerKunde } from "@shared/fiaon-global-stationen";
import { globalNeuigkeitenBauen, globalNeuigkeitenGrenze, type GlobalNeuigkeit, type NeuigkeitenQuelle } from "@shared/fiaon-global-neuigkeiten";

const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object") return v as T;
  try { return (JSON.parse(String(v ?? "")) as T) ?? leer; } catch { return leer; }
}

export interface NeuigkeitenSicht { liste: GlobalNeuigkeit[]; weitere: number; stand: string; seit: string }

/** Die Neuigkeiten des Kunden seit seinem letzten „Gesehen" — für GET /global/mein-auftrag/:ref (neues Portal). */
export async function globalNeuigkeitenKunde(ref: string, sprache: BereichSprache, jetzt: Date = new Date()): Promise<NeuigkeitenSicht | null> {
  await ensureGlobalBereich();
  const { ensureGlobalMandat } = await import("./fiaon-global-mandat");
  await ensureGlobalMandat();
  const [akte] = (await sqlPool`
    SELECT neuigkeiten_gesehen_am, created_at, gesellschaft_plus FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!akte) return null;
  const stand = jetzt.toISOString();
  const seit = globalNeuigkeitenGrenze({ gesehenAm: iso(akte.neuigkeiten_gesehen_am), akteSeit: iso(akte.created_at), jetzt: stand });
  const erg = globalNeuigkeitenBauen(await globalNeuigkeitenQuelleLesen(ref, seit, akte.gesellschaft_plus), sprache);
  return { ...erg, stand, seit };
}

/**
 * Die Quelle des Fensters ab `seit` — EINE Lesestelle für das Fenster im Portal und die Neuigkeiten-Mail (E-467,
 * server/lib/fiaon-global-neuigkeiten-mail.ts). Liest nur; `gesellschaftPlus` ist die Spalte der Akte.
 */
export async function globalNeuigkeitenQuelleLesen(ref: string, seit: string, gesellschaftPlus: unknown): Promise<NeuigkeitenQuelle> {
  const [verlauf, dokumente, nachrichten] = await Promise.all([
    sqlPool`SELECT id, art, text, created_at FROM fiaon_global_verlauf
             WHERE ref = ${ref} AND sichtbar = TRUE AND created_at > ${seit} ORDER BY created_at DESC, id DESC LIMIT 200` as Promise<any[]>,
    // Alle Dokumente der Akte (ohne Inhalt): „bitte neu" ist nur offen, solange nichts Gleichartiges nachkam (globalAblehnungOffen).
    sqlPool`SELECT id, von, art, titel, created_at, sichtbar_fuer_kunde, kunde_gelesen_am, unterschrift_gefordert, unterschrieben_am, abgelehnt_am, abgelehnt_grund
              FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL ORDER BY created_at DESC, id DESC LIMIT 500` as Promise<any[]>,
    sqlPool`SELECT id, von, created_at, gelesen_kunde_am FROM fiaon_global_nachrichten
             WHERE ref = ${ref} AND von = 'fiaon' AND created_at > ${seit} ORDER BY created_at DESC LIMIT 100` as Promise<any[]>,
  ]);
  const stand443: GlobalDokumentStand[] = dokumente.map((d) => ({ id: Number(d.id), art: String(d.art), am: iso(d.created_at), abgelehntAm: iso(d.abgelehnt_am), abgelehntGrund: d.abgelehnt_grund ?? null }));
  return {
    grenze: seit,
    verlauf: verlauf.map((v) => ({ id: Number(v.id), art: String(v.art), text: String(v.text), am: iso(v.created_at)! })),
    dokumente: dokumente.map((d, i) => ({
      id: Number(d.id), von: d.von === "kunde" ? "kunde" as const : "fiaon" as const, art: String(d.art), titel: d.titel ?? null, am: iso(d.created_at)!,
      sichtbar: d.von === "kunde" || !!d.sichtbar_fuer_kunde, gelesen: !!d.kunde_gelesen_am,
      unterschriftGefordert: !!d.unterschrift_gefordert, unterschrieben: !!d.unterschrieben_am,
      abgelehntAm: iso(d.abgelehnt_am), abgelehntGrund: d.abgelehnt_grund ?? null, ablehnungOffen: d.abgelehnt_am ? globalAblehnungOffen(stand443[i], stand443) : false,
    })),
    nachrichten: nachrichten.map((n) => ({ id: Number(n.id), von: "fiaon" as const, am: iso(n.created_at)!, gelesen: !!n.gelesen_kunde_am })),
    plus: globalPlusFuerKunde(json(gesellschaftPlus, {})),
  };
}

/**
 * „Verstanden" oder ein Klick auf „Ansehen": Die Neuigkeiten bis `bis` (der Stand, mit dem die Seite das Fenster
 * zeigte) gelten als gesehen. Nie zurück, nie in die Zukunft. Die Vorschau ruft das nie auf (Route).
 */
export async function globalNeuigkeitenGesehen(ref: string, bisRoh: unknown): Promise<boolean> {
  await ensureGlobalBereich();
  const bisMs = Date.parse(String(bisRoh ?? ""));
  const bis = new Date(Math.min(Number.isFinite(bisMs) ? bisMs : Date.now(), Date.now())).toISOString();
  const z = (await sqlPool`
    UPDATE fiaon_global_auftraege
       SET neuigkeiten_gesehen_am = GREATEST(COALESCE(neuigkeiten_gesehen_am, '-infinity'::timestamptz), ${bis}::timestamptz)
     WHERE ref = ${ref} RETURNING ref`) as any[];
  return z.length > 0;
}
