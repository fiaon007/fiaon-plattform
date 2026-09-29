// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE KALENDERDATEI (.ics) — RFC 5545 (29.09.2026, E-263)
//
// Justin: „wenn ich so ne Email bekomme von FIAON (Termin-Mail) dann muss ich
// die auch mit 1 Klick in mein Google oder Apple Kalender hinzufügen können."
//
// Bis heute gab es zwei Generatoren, jeder etwas anders:
//   · fiaon-global-zeiten.ts — sauber, aber die Faltung schnitt an UTF-16-
//     Einheiten und konnte ein Emoji oder ein 𝔸 in zwei Hälften teilen,
//   · fiaon-telefonkartei.ts (rueckrufIcs) — ohne Faltung: Eine lange
//     SUMMARY/DESCRIPTION ergab eine Datei, die nach RFC 5545 ungültig ist.
// Jetzt stehen Zeit, Maskierung und Faltung GENAU HIER; beide Altstellen, das
// Kalender-Abo und die Einzeltermine (fiaon-kalender-abo.ts) nehmen diese Datei.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
// · Zeilenende CRLF, auch nach der letzten Zeile.
// · Zeiten IMMER in UTC („Z") aus dem timestamptz der Datenbank. Sommer- und
//   Winterzeit stimmen damit ohne eigene Umrechnung — die Falle „Berlin-Stunde"
//   (Zeit-Falle 04.09.2026) kann hier nicht zuschnappen. Bewusst KEIN
//   VTIMEZONE-Block: RFC 5545 verlangt ihn nur für eine verwendete TZID, und
//   eine eigene Zeitzonen-Tabelle wäre eine zweite Umrechnung mit Fehlerquelle.
//   X-WR-TIMEZONE sagt Google und Apple nur die Anzeigezone.
// · Text maskiert: Backslash, Semikolon, Komma, Zeilenumbruch als \n.
// · Zeilen über 75 Oktette werden gefaltet; die Fortsetzung beginnt mit einem
//   Leerzeichen (es zählt zu den 75). Geschnitten wird NUR an Codepoint-Grenzen
//   (Array.from) — ein 4-Byte-Zeichen bleibt ganz.
// · DTSTAMP ist die Zeit der ZEILE, nie „jetzt": Sonst ändert sich ein Abo bei
//   jedem Abruf, und kein Kalender bekäme je ein „304 — nichts Neues".
// · METHOD NUR bei CANCEL (Gegenprüfung 29.09.2026): Mit METHOD bedeutet DTSTAMP
//   nach RFC 5545 §3.8.7.2 „wann die Nachricht entstand", und PUBLISH verlangt
//   nach RFC 5546 §3.2.1 je Termin einen ORGANIZER. Ohne METHOD ist DTSTAMP die
//   letzte Änderung (= unsere Zeilenzeit) — genau, was ein Abo und eine
//   Einzeldatei meinen. METHOD:CANCEL trägt seinen ORGANIZER weiter.
// · Steuerzeichen (U+0000–U+001F außer Umbruch, U+007F) fliegen aus jedem Text
//   — RFC 5545 §3.3.11 verbietet sie; ein Name aus einem Formular kann sie tragen.
// ═══════════════════════════════════════════════════════════════════════════

/** 2026-10-25T09:00:00.000Z → „20261025T090000Z". */
export function icsZeit(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Text für SUMMARY/DESCRIPTION/LOCATION: maskiert, ohne Wagenrücklauf und ohne Steuerzeichen. */
export function icsText(s: unknown): string {
  return String(s ?? "")
    .replace(/\r/g, "")
    // eslint-disable-next-line no-control-regex -- genau diese Zeichen sollen weg (RFC 5545 §3.3.11)
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Faltet eine Zeile nach 75 Oktetten. Die erste Zeile trägt bis zu 75, jede
 * Fortsetzung ein Leerzeichen plus bis zu 74. Geschnitten wird zwischen zwei
 * Codepoints, nie mitten in einem UTF-8-Zeichen.
 */
export function icsFalten(zeile: string): string {
  if (Buffer.byteLength(zeile, "utf8") <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = "";
  let bytes = 0;
  let grenze = 75;
  for (const zeichen of Array.from(zeile)) {
    const b = Buffer.byteLength(zeichen, "utf8");
    if (bytes + b > grenze && aktuell) {
      teile.push(aktuell);
      aktuell = "";
      bytes = 0;
      grenze = 74; // das führende Leerzeichen der Fortsetzung zählt mit
    }
    aktuell += zeichen;
    bytes += b;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

export interface IcsAlarm {
  /** Minuten VOR dem Beginn; 0 = zur Startzeit. */
  minutenVorher: number;
  text: string;
}

export interface IcsEreignis {
  /** Feste Kennung — über sie erkennt jeder Kalender „derselbe Termin, geändert". */
  uid: string;
  /** DTSTAMP: Zeit der Zeile (nie „jetzt", siehe oben). */
  stempel: Date;
  beginn: Date;
  ende: Date;
  titel: string;
  beschreibung?: string | null;
  ort?: string | null;
  url?: string | null;
  /** SEQUENCE: zählt jede Änderung (fiaon_termine.kal_sequenz). */
  sequenz?: number | null;
  erstellt?: Date | null;
  geaendert?: Date | null;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  /** Nur bei METHOD:CANCEL — iTIP verlangt dort einen Veranstalter. */
  veranstalter?: { name: string; mail: string } | null;
  alarme?: IcsAlarm[];
}

export interface IcsKalender {
  /** PRODID; Vorgabe „-//FIAON//Termine//DE". */
  prodid?: string;
  /** Nur „CANCEL" schreibt eine METHOD-Zeile (siehe oben); ohne Angabe steht keine. */
  methode?: "CANCEL" | null;
  /**
   * Nur für ein ABO: Name, Beschreibung, Anzeigezone und Abrufabstand. Eine
   * Einzeldatei trägt das bewusst nicht — manche Programme legen beim Import
   * einer Datei mit X-WR-CALNAME einen eigenen, neuen Kalender an.
   */
  abo?: {
    name: string; beschreibung: string;
    /** Abrufabstand als Dauer (Vorgabe „PT15M"); der leere Kalender eines toten Links fragt nur täglich. */
    abruf?: string;
  } | null;
  ereignisse: IcsEreignis[];
}

function alarmTrigger(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m === 0 ? "PT0M" : `-PT${m}M`;
}

/** Die ganze Datei — CRLF, gefaltet, Zeiten in UTC. */
export function icsKalender(k: IcsKalender): string {
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${k.prodid ?? "-//FIAON//Termine//DE"}`,
    "CALSCALE:GREGORIAN",
  ];
  if (k.methode === "CANCEL") zeilen.push("METHOD:CANCEL");
  if (k.abo) {
    zeilen.push(
      `X-WR-CALNAME:${icsText(k.abo.name)}`,
      `X-WR-CALDESC:${icsText(k.abo.beschreibung)}`,
      "X-WR-TIMEZONE:Europe/Berlin",
      `REFRESH-INTERVAL;VALUE=DURATION:${k.abo.abruf ?? "PT15M"}`,
      `X-PUBLISHED-TTL:${k.abo.abruf ?? "PT15M"}`,
    );
  }
  for (const e of k.ereignisse) {
    zeilen.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${icsZeit(e.stempel)}`);
    if (e.erstellt) zeilen.push(`CREATED:${icsZeit(e.erstellt)}`);
    if (e.geaendert) zeilen.push(`LAST-MODIFIED:${icsZeit(e.geaendert)}`);
    if (e.sequenz != null) zeilen.push(`SEQUENCE:${Math.max(0, Math.round(Number(e.sequenz) || 0))}`);
    zeilen.push(`DTSTART:${icsZeit(e.beginn)}`, `DTEND:${icsZeit(e.ende)}`, `SUMMARY:${icsText(e.titel)}`);
    if (e.beschreibung) zeilen.push(`DESCRIPTION:${icsText(e.beschreibung)}`);
    if (e.ort) zeilen.push(`LOCATION:${icsText(e.ort)}`);
    if (e.url) zeilen.push(`URL:${e.url}`);
    if (e.veranstalter) zeilen.push(`ORGANIZER;CN=${icsText(e.veranstalter.name)}:mailto:${e.veranstalter.mail}`);
    zeilen.push(`STATUS:${e.status ?? "CONFIRMED"}`);
    for (const a of e.alarme ?? []) {
      zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(a.text)}`, `TRIGGER:${alarmTrigger(a.minutenVorher)}`, "END:VALARM");
    }
    zeilen.push("END:VEVENT");
  }
  zeilen.push("END:VCALENDAR");
  return zeilen.map(icsFalten).join("\r\n") + "\r\n";
}

/**
 * Der Google-Vorlagenlink „Termin speichern" — ein Klick, Google öffnet den
 * Termin zum Speichern. Nur erlaubte Parameter; die Zeiten sind dieselben
 * UTC-Stempel wie in der .ics-Datei (ctz sagt Google nur die Anzeigezone).
 *
 * Google führt NICHT zusammen: Zweimal klicken ergibt zwei Einträge. Und was
 * hier steht, landet in Googles Protokollen und im Browserverlauf — deshalb
 * gehört kein Kundenname in `text` (Aufrufer: fiaon-kalender-abo.ts).
 */
export function googleKalenderLink(ein: { text: string; beginn: Date; ende: Date; details?: string | null; ort?: string | null }): string {
  const p = new URLSearchParams();
  p.set("action", "TEMPLATE");
  p.set("text", ein.text);
  p.set("dates", `${icsZeit(ein.beginn)}/${icsZeit(ein.ende)}`);
  if (ein.details) p.set("details", ein.details);
  if (ein.ort) p.set("location", ein.ort);
  p.set("ctz", "Europe/Berlin");
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Die erlaubten Parameter des Google-Links — für den Prüfstand. */
export const GOOGLE_LINK_PARAMETER = ["action", "text", "dates", "details", "location", "ctz"] as const;
