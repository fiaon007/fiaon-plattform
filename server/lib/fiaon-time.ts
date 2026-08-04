// ─────────────────────────────────────────────────────────────────────────────
// FIAON-Zeit — EINE Geschäftszeitzone für alles: Europe/Berlin.
//
// Warum: `datetime-local`-Eingaben („2026-07-15T12:30") tragen KEINE Zeitzone.
// `new Date("2026-07-15T12:30")` deutet sie als *lokale* Zeit des Servers —
// und der Server (Render) läuft auf UTC. Dadurch wurde 12:30 als 12:30 UTC
// gespeichert und in Deutschland als 14:30 angezeigt (Ticket #13).
//
// Regel: Eingaben werden explizit als Berlin-Wandzeit interpretiert, als
// echter UTC-Zeitpunkt (timestamptz) gespeichert und überall als Berlin-Zeit
// angezeigt — unabhängig von Server-Zeitzone oder Standort des Betrachters.
// ─────────────────────────────────────────────────────────────────────────────

/** Offset (in Minuten) von Europe/Berlin gegenüber UTC zum gegebenen Zeitpunkt (DST-sicher). */
export function berlinOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "0" : p.hour;
  const asBerlin = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return Math.round((asBerlin - at.getTime()) / 60000);
}

/**
 * Interpretiert eine Eingabe als Europe/Berlin-Wandzeit und liefert den
 * korrekten UTC-Zeitpunkt als `Date`.
 *  - Naives `datetime-local` („2026-07-15T12:30" / mit :ss)  → als Berlin-Zeit gedeutet.
 *  - Reines Datum („2026-07-15")                              → 00:00 Uhr Berlin.
 *  - Enthält bereits eine Zeitzone (endet auf Z oder ±hh:mm)  → unverändert als
 *    absoluter Zeitpunkt übernommen (bereits eindeutig).
 *  - Unlesbar/leer                                            → null.
 */
export function parseBerlinInput(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Bereits mit Zeitzone → eindeutiger absoluter Zeitpunkt.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  const [, Y, Mo, D, H = "0", Mi = "0", S = "0"] = m;
  // Wandzeit zunächst als UTC annehmen …
  const wall = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S);
  // … und um den Berlin-Offset zum gemeinten Zeitpunkt korrigieren (Zwei-Pass für DST-Ränder).
  const off1 = berlinOffsetMinutes(new Date(wall));
  let utc = wall - off1 * 60000;
  const off2 = berlinOffsetMinutes(new Date(utc));
  if (off2 !== off1) utc = wall - off2 * 60000;
  const d = new Date(utc);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Ein Rueckruf-Termin ist eine WIEDERVORLAGE. Liegt er in der Vergangenheit,
 * kann er nie faellig werden — der Rueckruf verschwindet lautlos, und niemand
 * merkt es. Genau das ist passiert: Am 27.07. um 21:34 gespeichert, Termin
 * stand auf dem 12.07. um 21:34 — exakt 15 Tage zurueck. Weder Oberflaeche
 * noch Server haben widersprochen.
 *
 * Fuenf Minuten Nachlauf, damit ein Termin „in zwei Minuten" oder eine
 * langsame Eingabe nicht unnoetig abgelehnt wird.
 *
 * @returns Fehlertext (Klartext, mit der erkannten Zeit) oder null, wenn i. O.
 */
export function pruefeTerminZukunft(outcome: string, scheduledAt: string | null | undefined): string | null {
  if (outcome !== "rueckruf_termin" || !scheduledAt) return null;
  const termin = parseBerlinInput(scheduledAt);
  if (!termin) return "Der Rückruf-Termin ist unlesbar. Bitte Datum und Uhrzeit erneut wählen.";
  if (termin.getTime() >= Date.now() - 5 * 60_000) return null;
  const wann = termin.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const tage = Math.round((Date.now() - termin.getTime()) / 86_400_000);
  return `Der Rückruf-Termin liegt in der Vergangenheit (${wann} Uhr${tage >= 1 ? `, ${tage} Tag${tage === 1 ? "" : "e"} zurück` : ""}). Ein vergangener Termin wird nie fällig — bitte einen Zeitpunkt in der Zukunft wählen.`;
}


/**
 * Der heutige Geschäftstag als „YYYY-MM-DD" in Berliner Zeit.
 *
 * Gebraucht für Tageskennzahlen: Der Server läuft auf UTC, `CURRENT_DATE` in SQL
 * ist also im Sommer bis 02:00 Uhr noch der Vortag. Eine Zahlung um 01:30 fiel
 * damit in die Statistik von gestern. Diese Funktion ist die eine Tagesgrenze,
 * gegen die alle Kennzahlen rechnen.
 */
export function berlinToday(at: Date = new Date()): string {
  // en-CA liefert das ISO-Format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/** Klartext-Anzeige eines Zeitpunkts in Berlin-Zeit, z. B. „Mi, 15.07.2026 um 12:30 Uhr". */
export function formatBerlin(at: Date | string | null | undefined, withTime = true): string {
  if (!at) return "—";
  const d = typeof at === "string" ? new Date(at) : at;
  if (isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  if (!withTime) return date;
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} um ${time} Uhr`;
}
