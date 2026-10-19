// ═══════════════════════════════════════════════════════════════════════════
// „DARAUS EINEN TERMIN MACHEN?“ — DER TERMIN AUS DER GESPRÄCHSNOTIZ (19.10.2026, E-397)
//
// Der Anlass (Person 11521): Daniel notierte am 16.10. „telefoniert am Montag 11 Uhr mit Justin“. Ein
// Kalendereintrag entstand nie — erst Mara fand den Termin drei Tage später in der Mail des Kunden (E-395).
// Die Notiz WAR der Termin; ihr fehlte nur ein Klick.
//
// Hier steht nur die ERKENNUNG — rein, ohne Datenbank, im Prüfstand geprüft (scripts/pruef-e397-hausputz.ts).
// Eintragen tut der Server (server/lib/fiaon-termin-aus-notiz.ts), und nur nach dem Klick des Mitarbeiters.
//
// Die Regeln:
//   · Tag UND Uhrzeit müssen in der Notiz stehen („Montag 11 Uhr“, „morgen 14:30“, „am 22.10. um 9“).
//   · Der Zeitpunkt liegt in der Zukunft und höchstens 14 Tage voraus. „Am Montag um 11“, am Montag nach elf
//     geschrieben, meint den nächsten Montag (wie bei Mara, shared/fiaon-genannter-termin.ts).
//   · Was schon vorbei ist („hat gestern um 10 Uhr überwiesen“), ist kein Termin.
//   · Steht für diese Zeit (±30 Min.) schon ein gebuchter Termin der Person, wird nichts angeboten.
//   · Teilnehmer: der Mitarbeiter, den die Notiz nennt („mit Justin“) — sonst der Schreiber selbst.
// ═══════════════════════════════════════════════════════════════════════════
import {
  berlinWand, mitarbeiterGenannt, tagGenannt, uhrzeitenGenannt,
  type BestehenderTerminKurz, type TerminMitarbeiter,
} from "./fiaon-genannter-termin";

export interface TerminAusNotizVorschlag {
  /** Berliner Wandzeit „YYYY-MM-DD HH:MM“. */
  wandzeit: string;
  tag: string;
  uhrzeit: string;
  /** Wer das Gespräch führt — genannt oder der Schreiber. */
  teilnehmerId: number;
  /** true = die Notiz nennt ihn („mit Justin“); false = der Schreiber selbst. */
  genannt: boolean;
}

/** Höchstens so viele Tage voraus — weiter weg ist eine Notiz selten ein fester Termin. */
export const TERMIN_AUS_NOTIZ_TAGE = 14;

function iso(j: number, m: number, t: number): string {
  return `${j}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}
function tagePlus(tag: string, plus: number): string {
  const [j, m, t] = tag.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + plus));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function minutenAbstand(wand: string, beginn: string | Date): number {
  const b = berlinWand(new Date(beginn));
  const [d, hm] = wand.split(" ");
  const [h, mi] = hm.split(":").map(Number);
  const [bh, bmi] = b.hhmm.split(":").map(Number);
  const [dj, dm, dt] = d.split("-").map(Number);
  const tage = (Date.UTC(dj, dm - 1, dt) - Date.UTC(b.j, b.m - 1, b.t)) / 86_400_000;
  return Math.abs(tage * 1440 + (h * 60 + mi) - (bh * 60 + bmi));
}

/**
 * Der Vorschlag zur Notiz — oder null (kein Tag, keine Uhrzeit, vorbei, zu weit weg, steht schon).
 * `schreiberId` = der Mitarbeiter, der die Notiz gerade gespeichert hat.
 */
export function terminAusNotiz(ein: {
  notiz: string;
  jetzt: Date;
  schreiberId: number;
  mitarbeiter: TerminMitarbeiter[];
  bestehende: BestehenderTerminKurz[];
}): TerminAusNotizVorschlag | null {
  const text = String(ein.notiz ?? "").replace(/https?:\/\/\S+/g, " ").slice(0, 1500);
  if (!text.trim()) return null;
  // Datumsangaben sind keine Uhrzeiten: „22.10.“ darf nicht als „22:10“ gelesen werden.
  const zeiten = uhrzeitenGenannt(text.replace(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g, (m, _t, mo) => (Number(mo) >= 1 && Number(mo) <= 12 ? " " : m)));
  if (!zeiten.length) return null;
  const g = tagGenannt(text, ein.jetzt);
  if (!g) return null;
  const uhrzeit = zeiten[0];
  const jetzt = berlinWand(ein.jetzt);
  const heute = iso(jetzt.j, jetzt.m, jetzt.t);
  // „Am Montag um 11“ am Montag nach elf geschrieben → nächster Montag.
  const tag = g.art === "wochentag" && g.tag === heute && uhrzeit <= jetzt.hhmm ? tagePlus(g.tag, 7) : g.tag;
  const wandzeit = `${tag} ${uhrzeit}`;
  if (wandzeit <= `${heute} ${jetzt.hhmm}`) return null;
  if (tag > tagePlus(heute, TERMIN_AUS_NOTIZ_TAGE)) return null;
  if (ein.bestehende.some((b) => b.status === "gebucht" && minutenAbstand(wandzeit, b.beginn) <= 30)) return null;
  const genannt = mitarbeiterGenannt(text, ein.mitarbeiter);
  return { wandzeit, tag, uhrzeit, teilnehmerId: genannt ?? ein.schreiberId, genannt: genannt != null };
}
