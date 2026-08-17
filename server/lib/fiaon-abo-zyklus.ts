// ═══════════════════════════════════════════════════════════════════════════
// DER ABO-ZYKLUS — EINE Rechnung, die alle benutzen
//
// ── DIE GESCHÄFTSREGEL, WÖRTLICH ───────────────────────────────────────────
// „Jeder Kunde mit einem PAKET hat ein Abo. Anker ist der Tag der
//  bankbestätigten Buchung. Zahlung gebucht am 05.07. → am 05.08. bekommt er
//  automatisch seine Monatsrechnung. Ist die Rate am 06.08. nicht gebucht,
//  steht er im Forderungsmanagement."
//
// Also: MONATLICHER JAHRESTAG des Buchungstags. Nicht „alle 30 Tage".
//
// ── WARUM DAS KEIN HAARSPALTEN IST ─────────────────────────────────────────
// Bis heute rechnete der Motor mit `+30 Tage`. Zwölf Monate zu je 30 Tagen
// sind 360 — der Termin wandert jedes Jahr fünf Tage nach vorn. Gemessen am
// 16.08.2026: von 289 offenen Raten bezahlter Kunden lagen **266** NICHT auf
// dem Jahrestag ihrer Buchung. Ein Kunde, der am 5. bezahlt, bekam seine
// Rechnung am 4., dann am 2., dann am 31. des Vormonats. Wer so etwas auf dem
// Kontoauszug wiederfinden soll, findet es nicht.
//
// ── DER 31. ────────────────────────────────────────────────────────────────
// Nicht jeder Monat hat den Tag des Ankers. Wer am 31.01. bucht, ist im
// Februar am 28. (im Schaltjahr am 29.) fällig — und im MÄRZ WIEDER AM 31.
// Deshalb wird jede Fälligkeit frisch aus dem Ankertag berechnet und nur für
// den jeweiligen Monat gekappt. Wer stattdessen von Fälligkeit zu Fälligkeit
// weiterrechnet, verliert den 31. nach dem ersten Februar für immer.
//
// ── REINE FUNKTIONEN ───────────────────────────────────────────────────────
// Keine Datenbank, keine Uhr, keine Einstellungen. Motor, Anzeige und
// Prüfstand rufen dieselben Funktionen mit denselben Argumenten und bekommen
// dieselbe Antwort. Genau das war vorher nicht so: Der Motor rechnete +30,
// die Kundenakte zeigte etwas anderes, und der Prüfstand rechnete nach.
// ═══════════════════════════════════════════════════════════════════════════

import { berlinToday } from "./fiaon-time";

/** Ein Kalendertag als „JJJJ-MM-TT". Absichtlich ein eigener Name: In diesem
 *  Modul gibt es keine Zeitpunkte, nur Tage. */
export type Tag = string;

const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/;

function zerlegen(tag: Tag): { jahr: number; monat: number; tag: number } {
  if (!TAG_MUSTER.test(tag)) throw new Error(`Kein Tag im Format JJJJ-MM-TT: ${tag}`);
  return { jahr: +tag.slice(0, 4), monat: +tag.slice(5, 7), tag: +tag.slice(8, 10) };
}

function fuegen(jahr: number, monat: number, tag: number): Tag {
  return `${String(jahr).padStart(4, "0")}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/** Wie viele Tage hat dieser Monat? (1-basierter Monat) */
export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

/**
 * Der Ankertag aus einem Buchungszeitpunkt — in Berliner Zeit.
 *
 * Der Server läuft auf UTC. Eine Buchung um 01:30 Uhr Berliner Sommerzeit ist
 * dort noch der Vortag. Wer den Anker aus `toISOString().slice(0,10)` zieht,
 * verschiebt jeden Kunden, der nachts bezahlt hat, um einen Tag — und danach
 * jede seiner Rechnungen.
 */
export function ankerTag(buchung: Date | string | null | undefined): Tag | null {
  if (!buchung) return null;
  if (typeof buchung === "string" && TAG_MUSTER.test(buchung)) return buchung;
  const d = typeof buchung === "string" ? new Date(buchung) : buchung;
  if (isNaN(d.getTime())) return null;
  return berlinToday(d);
}

/**
 * Die n-te Fälligkeit nach dem Anker. `n = 1` ist die erste Monatsrechnung.
 *
 *   ankerTag 2026-07-05, n = 1  →  2026-08-05
 *   ankerTag 2026-07-05, n = 2  →  2026-09-05
 *   ankerTag 2026-01-31, n = 1  →  2026-02-28   (2026 ist kein Schaltjahr)
 *   ankerTag 2026-01-31, n = 2  →  2026-03-31   (der Anker bleibt der 31.)
 */
export function faelligkeit(anker: Tag, n: number): Tag {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Ratennummer muss >= 1 sein: ${n}`);
  const a = zerlegen(anker);
  const gesamt = (a.jahr * 12 + (a.monat - 1)) + n;
  const jahr = Math.floor(gesamt / 12);
  const monat = (gesamt % 12) + 1;
  return fuegen(jahr, monat, Math.min(a.tag, tageImMonat(jahr, monat)));
}

/**
 * Die wievielte Fälligkeit fällt auf diesen Tag — oder liegt zuletzt davor?
 *
 * Rückgabe 0 heißt: Der Tag liegt vor der ersten Fälligkeit; es ist noch
 * nichts fällig geworden.
 */
export function zyklenBis(anker: Tag, bis: Tag): number {
  const a = zerlegen(anker);
  const b = zerlegen(bis);
  let n = (b.jahr * 12 + b.monat) - (a.jahr * 12 + a.monat);
  // Im Zielmonat ist der Termin erst ab dem Anker-Tag erreicht. Der gekappte
  // Vergleich (Anker 31., Februar) muss dieselbe Kappung benutzen wie
  // `faelligkeit`, sonst zählt der 28.02. nicht als erreicht.
  if (n >= 1 && b.tag < Math.min(a.tag, tageImMonat(b.jahr, b.monat))) n -= 1;
  return Math.max(0, n);
}

/** Die nächste Fälligkeit STRIKT nach dem angegebenen Tag. */
export function naechsteFaelligkeit(anker: Tag, nach: Tag = berlinToday()): Tag {
  return faelligkeit(anker, zyklenBis(anker, nach) + 1);
}

/** Alle Fälligkeiten von der ersten bis einschließlich `bis`. */
export function faelligkeitenBis(anker: Tag, bis: Tag = berlinToday()): Tag[] {
  const anzahl = zyklenBis(anker, bis);
  const out: Tag[] = [];
  for (let i = 1; i <= anzahl; i++) out.push(faelligkeit(anker, i));
  return out;
}

/** Ein Tag, n Tage früher — für die Vorab-Erinnerung. */
export function tagMinus(tag: Tag, tage: number): Tag {
  const { jahr, monat, tag: t } = zerlegen(tag);
  const d = new Date(Date.UTC(jahr, monat - 1, t));
  d.setUTCDate(d.getUTCDate() - tage);
  return d.toISOString().slice(0, 10);
}

/** Wie viele Tage liegen zwischen zwei Tagen? (bis − von) */
export function tageZwischen(von: Tag, bis: Tag): number {
  const a = zerlegen(von), b = zerlegen(bis);
  return Math.round(
    (Date.UTC(b.jahr, b.monat - 1, b.tag) - Date.UTC(a.jahr, a.monat - 1, a.tag)) / 86_400_000,
  );
}

/** „05.07." — Tag und Monat, wie der Betreiber es schreibt. */
export function kurzTag(tag: Tag): string {
  const { monat, tag: t } = zerlegen(tag);
  return `${String(t).padStart(2, "0")}.${String(monat).padStart(2, "0")}.`;
}

/**
 * Der Zyklus in Klartext — die eine Formulierung für Akte, Inkasso-Karte und
 * Zahlungszentrale.
 *
 * „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch raus"
 *
 * Bewusst hier und nicht in der Oberfläche: Drei Seiten, die denselben Satz
 * selbst zusammensetzen, sind drei Sätze, die auseinanderlaufen.
 */
export function zyklusText(
  anker: Tag | null,
  opts: { heute?: Tag; gestoppt?: boolean; automatik?: boolean } = {},
): string {
  if (!anker) return "Kein Abo-Anker hinterlegt — die Fälligkeit ist nicht berechenbar.";
  const heute = opts.heute ?? berlinToday();
  const seit = `Abo aktiv seit ${kurzTag(anker)}`;
  if (opts.gestoppt) return `${seit} · Abo gestoppt — es geht keine Rechnung mehr raus`;
  const naechste = naechsteFaelligkeit(anker, heute);
  const versand = opts.automatik === false
    ? "Rechnungsversand ist abgeschaltet"
    : "Rechnung geht automatisch raus";
  return `${seit} · nächste Rate ${kurzTag(naechste)} · ${versand}`;
}
