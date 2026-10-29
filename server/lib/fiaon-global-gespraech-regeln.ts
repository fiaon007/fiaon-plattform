// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WANN ERINNERN, WANN NACH DEM ERGEBNIS FRAGEN (29.10.2026, E-458 Nr. 11)
//
// Die reine Rechnung zu server/lib/fiaon-global-gespraech.ts: keine Datenbank,
// kein Netz, keine Uhr — `jetzt` kommt immer als Parameter. Deshalb prüft
// scripts/pruef-global-gespraech-e458.ts jede Kante (Zeitumstellung, Wochenende,
// späte Buchung) heute und nicht erst, wenn sie im Betrieb vorkommt.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
//   Vortag      Die Mail „Morgen um … Uhr“ geht 24 Stunden vor dem Gespräch —
//               aber nur, wenn „morgen“ dann stimmt (Berliner Kalendertag), nicht
//               nach 21 Uhr und nie, wenn erst am Vortag oder am Gesprächstag
//               gebucht wurde: Dann liegt die Bestätigung frisch im Postfach.
//   Kurz davor  Eine Stunde vorher — und nie, wenn weniger als zehn Minuten
//               bleiben oder erst anderthalb Stunden vorher gebucht wurde.
//   Ergebnis    Eine halbe Stunde nach dem Ende fragt das System die zuständige
//               Person nach dem Ergebnis (stattgefunden / nicht erreicht /
//               verschoben). Vorher setzte ein Lauf das Gespräch nach zwölf
//               Stunden still auf „verpasst“ — niemand wusste, ob gesprochen wurde.
//   Leitung     Steht am nächsten Werktag um 9 Uhr noch kein Ergebnis da,
//               bekommt die Leitung eine Erinnerung.
// ═══════════════════════════════════════════════════════════════════════════
import { berlinDatum, berlinWochentag, berlinZeitpunkt } from "./fiaon-time";

/** Die kurze Erinnerung: so viele Minuten vor dem Gespräch. */
export const GESPRAECH_KURZ_MIN = 60;
/** Bleiben weniger Minuten, geht keine kurze Erinnerung mehr. */
export const GESPRAECH_KURZ_SPAETESTENS_MIN = 10;
/** Wer so kurz vorher gebucht hat, bekommt keine kurze Erinnerung (die Bestätigung ist frisch). */
export const GESPRAECH_KURZ_GEBUCHT_MIN = 90;
/** Die Vortags-Mail geht nie ab dieser Berliner Stunde. */
export const GESPRAECH_VORTAG_BIS_STUNDE = 21;
/** So lange nach dem Ende des Gesprächs fragt das System nach dem Ergebnis. */
export const ERGEBNIS_NACH_MIN = 30;
/** Am nächsten Werktag um diese Uhrzeit (Minuten ab Mitternacht, Berlin) erfährt es die Leitung. */
export const LEITUNG_UM_MIN = 9 * 60;

export type Faellig = "senden" | "warten" | "verfallen";

/** Minuten seit Mitternacht in Berlin — nur über formatToParts (Zeit-Falle 01.09.2026). „24“ als Stunde zählt als 0. */
export function berlinMinutenVon(d: Date): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (art: string) => Number(teile.find((p) => p.type === art)?.value ?? "0");
  return (w("hour") === 24 ? 0 : w("hour")) * 60 + w("minute");
}

/** Kalendertag ± n als JJJJ-MM-TT — mittags in UTC gerechnet, über jede Zeitumstellung hinweg derselbe Tag. */
export function tagPlus(tag: string, n: number): string {
  const [y, m, d] = tag.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

/** Der nächste Werktag (Montag bis Freitag) NACH diesem Tag. Feiertage kennt die Rechnung nicht. */
export function naechsterWerktag(tag: string): string {
  let t = tagPlus(tag, 1);
  while (berlinWochentag(t) >= 6) t = tagPlus(t, 1);
  return t;
}

export interface GespraechZeit {
  jetzt: Date;
  beginn: Date;
  /** Wann gebucht wurde (fiaon_termine.created_at). */
  gebuchtAm: Date;
}

/** Die Mail am Vortag („Morgen um … Uhr“). */
export function vortagFaellig(e: GespraechZeit): Faellig {
  const vortag = tagPlus(berlinDatum(e.beginn), -1);
  if (berlinDatum(e.gebuchtAm) >= vortag) return "verfallen";
  if (e.jetzt.getTime() < e.beginn.getTime() - 24 * 3_600_000) return "warten";
  if (berlinDatum(e.jetzt) !== vortag) return "verfallen";
  if (berlinMinutenVon(e.jetzt) >= GESPRAECH_VORTAG_BIS_STUNDE * 60) return "verfallen";
  return "senden";
}

/** Die kurze Mail eine Stunde vorher. */
export function kurzFaellig(e: GespraechZeit): Faellig {
  const bleibt = e.beginn.getTime() - e.jetzt.getTime();
  if (bleibt > GESPRAECH_KURZ_MIN * 60_000) return "warten";
  if (bleibt < GESPRAECH_KURZ_SPAETESTENS_MIN * 60_000) return "verfallen";
  if (e.beginn.getTime() - e.gebuchtAm.getTime() < GESPRAECH_KURZ_GEBUCHT_MIN * 60_000) return "verfallen";
  return "senden";
}

/** Ist es Zeit, nach dem Ergebnis zu fragen? Eine halbe Stunde nach dem Ende. */
export function ergebnisFaellig(e: { jetzt: Date; beginn: Date; dauerMin: number }): boolean {
  const dauer = Number.isFinite(e.dauerMin) && e.dauerMin > 0 ? e.dauerMin : 30;
  return e.jetzt.getTime() >= e.beginn.getTime() + (dauer + ERGEBNIS_NACH_MIN) * 60_000;
}

/** Ab wann die Leitung erinnert wird: am nächsten Werktag nach dem Gesprächstag um 9 Uhr (Berlin). */
export function leitungAb(beginn: Date): Date {
  return berlinZeitpunkt(naechsterWerktag(berlinDatum(beginn)), LEITUNG_UM_MIN);
}

// ───────────────────────────────────────────────────────────────────────────
// Die Wörter der Mails, die sich nach Person und Tag richten
// ───────────────────────────────────────────────────────────────────────────

export type GespraechSprache = "de" | "en";

/** „Guten Tag Herr Muster“ / „Dear Mr Muster“ — ohne gepflegte Anrede der volle Name. Ohne Komma. */
export function gespraechAnrede(p: { anrede?: string | null; vorname?: string | null; nachname?: string | null }, sprache: GespraechSprache): string {
  const nach = String(p.nachname || "").trim();
  const voll = [p.vorname, p.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const herrFrau = p.anrede === "Herr" || p.anrede === "Frau";
  if (sprache === "en") {
    if (herrFrau && nach) return `Dear ${p.anrede === "Herr" ? "Mr" : "Ms"} ${nach}`;
    return voll ? `Dear ${voll}` : "Good day";
  }
  if (herrFrau && nach) return `Guten Tag ${p.anrede} ${nach}`;
  return voll ? `Guten Tag ${voll}` : "Guten Tag";
}

/** Das Datum im Zahlenbild der Sprache, in Berliner Zeit: „30.10.2026“ / „30 October 2026“. */
export function gespraechDatum(d: Date, sprache: GespraechSprache): string {
  return sprache === "en"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

/** Die Uhrzeit in Berliner Zeit: „10:30“. */
export function gespraechUhrzeit(d: Date): string {
  const min = berlinMinutenVon(d);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Wann das verpasste Gespräch war — als Satzanfang nach der Anrede-Zeile. Der freigegebene Text sagt „heute um …“;
 * trägt jemand das Ergebnis erst am nächsten Tag ein, stimmte „heute“ nicht mehr. Dann steht das Datum da.
 */
export function nichtErreichtWann(beginn: Date, jetzt: Date, sprache: GespraechSprache): { satz: string; kurz: string } {
  const heute = berlinDatum(beginn) === berlinDatum(jetzt);
  const uhr = gespraechUhrzeit(beginn);
  if (sprache === "en") {
    return heute
      ? { satz: `today at ${uhr} (German time)`, kurz: "today" }
      : { satz: `on ${gespraechDatum(beginn, "en")} at ${uhr} (German time)`, kurz: `on ${gespraechDatum(beginn, "en")}` };
  }
  return heute
    ? { satz: `heute um ${uhr} Uhr`, kurz: "heute" }
    : { satz: `am ${gespraechDatum(beginn, "de")} um ${uhr} Uhr`, kurz: `am ${gespraechDatum(beginn, "de")}` };
}
