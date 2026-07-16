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
