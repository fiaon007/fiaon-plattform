// ═══════════════════════════════════════════════════════════════════════════
// FEIERTAGE DE / AT / CH — rein, ohne Datenbank (E-408, 19.10.2026)
//
// ARAS wählt nie an einem Sonn- oder Feiertag (ENTWURF § 4). Die Liste ist
// bewusst „großzügig“: Ein Tag, der nur in manchen Regionen frei ist, zählt
// trotzdem als Feiertag — ein Anruf zu viel ausgelassen kostet nichts, ein
// Anruf an einem Feiertag kostet Vertrauen.
// ═══════════════════════════════════════════════════════════════════════════

export type FeiertagLand = "DE" | "AT" | "CH";

/** Ostersonntag nach Gauß (gregorianisch) als „JJJJ-MM-TT“. */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(jahr, monat, tag);
}

function iso(j: number, m: number, t: number): string {
  return `${j}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}

function plusTage(datumISO: string, n: number): string {
  const [j, m, t] = datumISO.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Alle Feiertage eines Jahres für ein Land — Menge von „JJJJ-MM-TT“. */
export function feiertage(land: FeiertagLand, jahr: number): Set<string> {
  const o = ostersonntag(jahr);
  const fest = new Set<string>([
    iso(jahr, 1, 1),                 // Neujahr
    plusTage(o, -2),                 // Karfreitag (DE, CH weit verbreitet; AT bei vielen frei)
    plusTage(o, 1),                  // Ostermontag
    plusTage(o, 39),                 // Christi Himmelfahrt / Auffahrt
    plusTage(o, 50),                 // Pfingstmontag
    iso(jahr, 12, 25), iso(jahr, 12, 26),
  ]);
  if (land === "DE") {
    fest.add(iso(jahr, 5, 1)); fest.add(iso(jahr, 10, 3));
    fest.add(plusTage(o, 60));       // Fronleichnam (Süden/Westen)
    fest.add(iso(jahr, 10, 31)); fest.add(iso(jahr, 11, 1)); // Reformationstag / Allerheiligen (regional)
    fest.add(iso(jahr, 1, 6)); fest.add(iso(jahr, 8, 15));   // Heilige Drei Könige / Mariä Himmelfahrt (regional)
  }
  if (land === "AT") {
    fest.add(iso(jahr, 1, 6)); fest.add(iso(jahr, 5, 1)); fest.add(plusTage(o, 60));
    fest.add(iso(jahr, 8, 15)); fest.add(iso(jahr, 10, 26)); fest.add(iso(jahr, 11, 1));
    fest.add(iso(jahr, 12, 8)); fest.add(iso(jahr, 12, 24)); fest.add(iso(jahr, 12, 31));
  }
  if (land === "CH") {
    fest.add(iso(jahr, 1, 2)); fest.add(iso(jahr, 5, 1)); fest.add(plusTage(o, 60));
    fest.add(iso(jahr, 8, 1)); fest.add(iso(jahr, 8, 15)); fest.add(iso(jahr, 11, 1));
    fest.add(iso(jahr, 12, 24)); fest.add(iso(jahr, 12, 31));
  }
  return fest;
}

/** Ist dieser Tag („JJJJ-MM-TT“, Berliner Kalender) im Land ein Feiertag? */
export function istFeiertag(land: FeiertagLand, datumISO: string): boolean {
  const jahr = Number(datumISO.slice(0, 4));
  if (!Number.isFinite(jahr)) return false;
  return feiertage(land, jahr).has(datumISO);
}
