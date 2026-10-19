// ═══════════════════════════════════════════════════════════════════════════
// DIE AMPEL JE MARA-WERKZEUG — LESEN, SETZEN, PRÜFEN (E-406 B3, 19.10.2026)
//
// Die Regeln stehen rein in shared/fiaon-mara-ampel.ts. Hier: der gespeicherte Wert (fiaon_settings.mara_ampel,
// JSON { stufen, verlauf }), 60 Sekunden zwischengespeichert, und die kleinen Fragen, die die Wege stellen:
//   · fiaon-postmeister-lauf.ts     — mailDarfAuto (Mails beantworten: grün / gelb / rot)
//   · fiaon-mara-genannter-termin.ts, fiaon-whatsapp-mara.ts (rueckruf_eintragen), fiaon-postmeister-werkzeuge.ts
//     (aufgabe_an_betreuer mit rueckruf_am) — ampelRot("termin_eintragen")
//   · fiaon-whatsapp-mara.ts (ratenpause_setzen) — ampelRot("ratenpause")
// Ein Lesefehler gibt die Startwerte zurück — das ist das heutige Verhalten, nie etwas Lockereres.
// Wer etwas verschärft oder lockert, ist Justin: POST /chef/mara/ampel (Stufe Inhaber), jeder Klick im Verlauf.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  AMPEL_SCHALTER, ampelLesen, ampelSetzen, ampelVerlaufLesen,
  type AmpelKey, type AmpelStufe, type AmpelStand, type AmpelVerlauf,
} from "@shared/fiaon-mara-ampel";

type Lauf = typeof sqlPool;

/** Höchstens so lange gilt ein gelesener Stand (mehrere Server-Instanzen: ein Umschalten wirkt spätestens nach einer Minute). */
export const AMPEL_HALTEN_MS = 60_000;
let zwischen: { am: number; roh: unknown } | null = null;

/** Für den Prüfstand und nach dem Setzen: den Zwischenspeicher leeren. */
export function ampelZwischenspeicherLeeren(): void { zwischen = null; }

async function rohLesen(lauf: Lauf): Promise<unknown> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${AMPEL_SCHALTER}`) as any[];
  return z?.value ?? null;
}

/** Der Stand je Werkzeug. Lesefehler: die Startwerte (= heutiges Verhalten). */
export async function ampelStand(o: { frisch?: boolean; lauf?: Lauf } = {}): Promise<AmpelStand> {
  if (!o.frisch && !o.lauf && zwischen && Date.now() - zwischen.am < AMPEL_HALTEN_MS) return ampelLesen(zwischen.roh);
  try {
    const roh = await rohLesen(o.lauf ?? sqlPool);
    if (!o.lauf) zwischen = { am: Date.now(), roh };
    return ampelLesen(roh);
  } catch (e) {
    console.error("[MARA-AMPEL] nicht lesbar — es gelten die Startwerte:", String((e as Error)?.message ?? e).slice(0, 160));
    return ampelLesen(null);
  }
}

/** Die Stufe EINES Werkzeugs. */
export async function ampelStufe(key: AmpelKey, lauf?: Lauf): Promise<AmpelStufe> {
  return (await ampelStand(lauf ? { lauf } : {}))[key];
}

/** Steht das Werkzeug auf Rot (nur als Entscheidungskarte)? */
export async function ampelRot(key: AmpelKey, lauf?: Lauf): Promise<boolean> {
  return (await ampelStufe(key, lauf)) === "rot";
}

/** Stand und Verlauf für die Anzeige (frisch gelesen). */
export async function ampelLesenMitVerlauf(lauf: Lauf = sqlPool): Promise<{ stand: AmpelStand; verlauf: AmpelVerlauf[]; geaendertAm: string | null }> {
  const [z] = (await lauf`SELECT value, updated_at FROM fiaon_settings WHERE key = ${AMPEL_SCHALTER}`.catch(() => [])) as any[];
  return { stand: ampelLesen(z?.value ?? null), verlauf: ampelVerlaufLesen(z?.value ?? null), geaendertAm: z?.updated_at ? new Date(z.updated_at).toISOString() : null };
}

/**
 * Eine Stufe setzen (Prüfung in ampelSetzen — wirft bei einer Stufe, die das Werkzeug nicht kennt oder die fest ist).
 * In EINER Transaktion mit Zeilensperre: zwei gleichzeitige Klicks verlieren keinen Verlauf.
 */
export async function ampelSpeichern(key: AmpelKey, stufe: AmpelStufe, wer: string, lauf: Lauf = sqlPool): Promise<{ stand: AmpelStand; verlauf: AmpelVerlauf[] }> {
  const neu = await lauf.begin(async (tx: any) => {
    await tx`INSERT INTO fiaon_settings (key, value) VALUES (${AMPEL_SCHALTER}, ${JSON.stringify({ stufen: {}, verlauf: [] })}) ON CONFLICT (key) DO NOTHING`;
    const [z] = (await tx`SELECT value FROM fiaon_settings WHERE key = ${AMPEL_SCHALTER} FOR UPDATE`) as any[];
    const wert = ampelSetzen(z?.value ?? null, key, stufe, wer);
    await tx`UPDATE fiaon_settings SET value = ${JSON.stringify(wert)}, updated_at = NOW() WHERE key = ${AMPEL_SCHALTER}`;
    return wert;
  });
  ampelZwischenspeicherLeeren();
  return { stand: ampelLesen(neu), verlauf: neu.verlauf };
}
