// ═══════════════════════════════════════════════════════════════════════════
// ZEIT BLOCKIEREN — DIE REINEN REGELN (E-498, 12.11.2026)
//
// ── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
// Die Buchungsseiten kannten nur Plattform-Termine. Was jemand von Hand
// vereinbart (Zoom, Treffen vor Ort), sperrte nichts — zweimal in zwei Tagen
// drohte eine Doppelbuchung. Eine SPERRZEIT ist ein Zeitraum (von – bis) einer
// Person, der für jedes Angebot als belegt zählt.
//
// ── REIN, MIT ABSICHT ──────────────────────────────────────────────────────
// Kein Datenbank-Import, keine Uhr (`jetzt` kommt als Parameter), kein Netz:
// Das Prüfskript (scripts/pruef-sperrzeit-e498.ts) rechnet jede Regel nach —
// auch Ränder und Zeitumstellung. Das Lesen und Schreiben steht in
// fiaon-sperrzeit.ts; dort wohnt der Datenbank-Pool.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
//   · Eine Sperrzeit ist ein halboffenes Fenster [von, bis). Ein Slot ist
//     gesperrt, sobald [Beginn, Beginn + Dauer) sich mit ihr überschneidet — auch
//     am Rand. Beispiel Sperre 16:00–18:30, 30-Minuten-Slots: 15:50 (endet 16:20)
//     und 18:20 (beginnt vor 18:30) fallen weg; 15:30 (endet genau 16:00) und
//     18:30 (beginnt genau zum Ende) bleiben frei.
//   · Sie zählt auf KEINEN Tagesdeckel und ändert den Vorlauf nicht: Sie sperrt
//     nur ihre Zeit (wie ein Termin, der den Platz nicht verbraucht).
//   · Mindestens 5 Minuten, höchstens 62 Tage (ein Tippfehler im Jahr soll nicht
//     den ganzen Kalender sperren), nicht in der Vergangenheit, höchstens ein Jahr voraus.
//   · Die Notiz ist freiwillig, höchstens 200 Zeichen, ohne Steuerzeichen.
//   · Eingaben ohne Zeitzone gelten als Berliner Wandzeit (wie bei Terminen).
// ═══════════════════════════════════════════════════════════════════════════

import { parseBerlinInput } from "./fiaon-time";
import type { GlobalBelegung } from "./fiaon-global-zeiten";

export const SPERRZEIT_MIN_MINUTEN = 5;
export const SPERRZEIT_MAX_TAGE = 62;
export const SPERRZEIT_HORIZONT_TAGE = 366;
export const SPERRZEIT_GRUND_MAX = 200;
/** Höchstens so viele offene (nicht vorbeigegangene) Sperrzeiten je Person — gegen ein Skript, das die Tabelle füllt. */
export const SPERRZEIT_MAX_OFFEN = 200;

export type SperrzeitFehlerCode =
  | "beginn_fehlt" | "ende_fehlt" | "ende_vor_beginn" | "zu_kurz" | "zu_lang" | "vorbei" | "zu_weit";

export type SperrzeitPruefung =
  | { ok: true; beginn: Date; ende: Date; grund: string | null }
  | { ok: false; code: SperrzeitFehlerCode; error: string };

/** Die Sätze, die der Mensch vor dem Bildschirm liest — eine Stelle, damit Route und Prüfstand dieselben kennen. */
export const SPERRZEIT_TEXT: Record<SperrzeitFehlerCode, string> = {
  beginn_fehlt: "Bitte Beginn der gesperrten Zeit angeben.",
  ende_fehlt: "Bitte das Ende der gesperrten Zeit angeben.",
  ende_vor_beginn: "Das Ende liegt vor dem Beginn. Bitte die Zeiten prüfen.",
  zu_kurz: `Eine gesperrte Zeit dauert mindestens ${SPERRZEIT_MIN_MINUTEN} Minuten.`,
  zu_lang: `Eine gesperrte Zeit dauert höchstens ${SPERRZEIT_MAX_TAGE} Tage. Für längere Pausen mehrere Zeiträume anlegen.`,
  vorbei: "Diese Zeit ist schon vorbei.",
  zu_weit: "Das liegt mehr als ein Jahr in der Zukunft. Bitte das Datum prüfen.",
};

const MIN_MS = 60_000;

/** Auf die volle Minute abschneiden — Sekunden aus einem Eingabefeld sind nie gewollt. */
const minute = (d: Date) => new Date(Math.floor(d.getTime() / MIN_MS) * MIN_MS);

/** Die Notiz: zusammengezogene Leerzeichen, keine Steuerzeichen, höchstens 200 Zeichen; leer = null. */
export function sperrzeitGrund(roh: unknown): string | null {
  if (roh == null) return null;
  const s = String(roh)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SPERRZEIT_GRUND_MAX)
    .trim();
  return s || null;
}

/** Prüft und normalisiert eine Eingabe. Wirft nie. */
export function sperrzeitPruefen(
  ein: { beginn?: unknown; ende?: unknown; grund?: unknown },
  jetzt: Date = new Date(),
): SperrzeitPruefung {
  const roh = (v: unknown) => (typeof v === "string" ? parseBerlinInput(v) : v instanceof Date && Number.isFinite(v.getTime()) ? v : null);
  const b0 = roh(ein.beginn);
  if (!b0) return { ok: false, code: "beginn_fehlt", error: SPERRZEIT_TEXT.beginn_fehlt };
  const e0 = roh(ein.ende);
  if (!e0) return { ok: false, code: "ende_fehlt", error: SPERRZEIT_TEXT.ende_fehlt };
  const beginn = minute(b0);
  const ende = minute(e0);
  if (ende.getTime() <= beginn.getTime()) {
    return { ok: false, code: "ende_vor_beginn", error: SPERRZEIT_TEXT.ende_vor_beginn };
  }
  const dauer = ende.getTime() - beginn.getTime();
  if (dauer < SPERRZEIT_MIN_MINUTEN * MIN_MS) return { ok: false, code: "zu_kurz", error: SPERRZEIT_TEXT.zu_kurz };
  if (dauer > SPERRZEIT_MAX_TAGE * 86_400_000) return { ok: false, code: "zu_lang", error: SPERRZEIT_TEXT.zu_lang };
  if (ende.getTime() <= jetzt.getTime()) return { ok: false, code: "vorbei", error: SPERRZEIT_TEXT.vorbei };
  if (beginn.getTime() > jetzt.getTime() + SPERRZEIT_HORIZONT_TAGE * 86_400_000) {
    return { ok: false, code: "zu_weit", error: SPERRZEIT_TEXT.zu_weit };
  }
  return { ok: true, beginn, ende, grund: sperrzeitGrund(ein.grund) };
}

export interface SperrFenster { beginn: Date | string; ende: Date | string }

/** Das Zeitfenster in Millisekunden; null bei kaputtem Zeitstempel (eine kaputte Zeile sperrt nichts). */
export function sperrFensterMs(s: SperrFenster): { von: number; bis: number } | null {
  const von = new Date(s.beginn).getTime();
  const bis = new Date(s.ende).getTime();
  return Number.isFinite(von) && Number.isFinite(bis) && bis > von ? { von, bis } : null;
}

/**
 * Überschneidet [beginnMs, beginnMs + dauerMin) irgendein Sperrfenster?
 * Halboffen auf beiden Seiten: Ein Slot, der genau beginnt, wenn die Sperre endet
 * (oder genau endet, wenn sie beginnt), ist frei.
 */
export function sperrzeitUeberlappt(
  sperren: { von: number; bis: number }[] | null | undefined, beginnMs: number, dauerMin: number,
): boolean {
  if (!sperren || sperren.length === 0) return false;
  const ende = beginnMs + dauerMin * MIN_MS;
  return sperren.some((s) => beginnMs < s.bis && ende > s.von);
}

/**
 * Eine Sperrzeit als Belegung für `globalZeitenRechnen` (die Rechnung des Global-Gesprächskalenders und des
 * Startgesprächs): ihre echte Dauer sperrt die Zeit, `zaehltAlsGlobal: false` — sie verbraucht keinen Tagesplatz.
 */
export function sperrzeitAlsBelegung(s: SperrFenster): GlobalBelegung | null {
  const f = sperrFensterMs(s);
  if (!f) return null;
  return { beginn: new Date(f.von), dauerMin: Math.max(SPERRZEIT_MIN_MINUTEN, Math.ceil((f.bis - f.von) / MIN_MS)), zaehltAlsGlobal: false };
}

const TAG_FORMAT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" });
const ZEIT_FORMAT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
// „Mi., 18.11.“ → „Mi 18.11.“ — aus den Teilen gebaut, nicht per Textersatz (kein Unicode-Flag: das Projektziel erlaubt es nicht).
const tagTeil = (d: Date, typ: string) => TAG_FORMAT.formatToParts(d).filter((x) => x.type === typ).map((x) => x.value).join("");
const tagKurz = (d: Date) => `${tagTeil(d, "weekday").replace(/\.$/, "")} ${tagTeil(d, "day")}.${tagTeil(d, "month")}.`;

/** Ein einzelner Zeitpunkt für Meldungen, Berliner Zeit: „Mi 18.11., 17:00 Uhr“. Kaputt → leer. */
export function zeitpunktKurz(wann: Date | string): string {
  const d = new Date(wann);
  return Number.isFinite(d.getTime()) ? `${tagKurz(d)}, ${ZEIT_FORMAT.format(d)} Uhr` : "";
}

/** Berliner Kurztext für Listen und Meldungen: „Mi 18.11., 16:00–18:30 Uhr“ bzw. über Mitternacht „Mi 18.11. 16:00 – Fr 20.11. 12:00 Uhr“. */
export function sperrzeitKurz(beginn: Date | string, ende: Date | string): string {
  const b = new Date(beginn);
  const e = new Date(ende);
  if (!Number.isFinite(b.getTime()) || !Number.isFinite(e.getTime())) return "";
  return TAG_FORMAT.format(b) === TAG_FORMAT.format(e)
    ? `${tagKurz(b)}, ${ZEIT_FORMAT.format(b)}–${ZEIT_FORMAT.format(e)} Uhr`
    : `${tagKurz(b)} ${ZEIT_FORMAT.format(b)} – ${tagKurz(e)} ${ZEIT_FORMAT.format(e)} Uhr`;
}
