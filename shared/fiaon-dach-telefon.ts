// ═══════════════════════════════════════════════════════════════════════════
// TELEFONNUMMERN NUR AUS DEUTSCHLAND, ÖSTERREICH, SCHWEIZ — EINE PRÜFUNG
// (17.09.2026, E-188)
//
// ── WOHER SIE KOMMT ───────────────────────────────────────────────────────
// Die Regel stammt vom 07.09.2026 (Daniel, Feedback 3, E-160): Anträge nur mit
// DE/AT/CH-Nummern. Sie stand als Block mitten in POST /application
// (server/routes/fiaon-antrag.ts). Der Bestellweg von FIAON Global braucht
// dieselbe Wand — zwei Kopien wären zwei Gelegenheiten, verschieden zu
// urteilen. Deshalb steht sie jetzt hier, und beide Stellen rufen sie.
//
// ── ZWEI STRENGEN, EINE REGEL ─────────────────────────────────────────────
//   · `istAuslandsnummer()` — die bisherige Prüfung des Privatantrags,
//     unverändert: Abgelehnt wird nur, was ERKENNBAR aus einem anderen Land
//     kommt (internationale Schreibweise mit fremder Vorwahl). Eine Nummer
//     ohne Vorwahl geht durch — so war es, so bleibt es.
//   · `dachNummer()` — für den Firmenauftrag: macht aus der Eingabe eine
//     Nummer in internationaler Schreibweise oder gibt `null` zurück. Eine
//     nationale Nummer („0171 …") bekommt die Vorwahl des Firmenlandes.
// ═══════════════════════════════════════════════════════════════════════════

export type DachLand = "DE" | "AT" | "CH";

export const DACH_VORWAHL: Record<DachLand, string> = { DE: "+49", AT: "+43", CH: "+41" };

export const NUR_DACH_MELDUNG =
  "Aktuell nehmen wir Anträge nur aus Deutschland, Österreich und der Schweiz an. "
  + "Mit einer Telefonnummer aus einem anderen Land ist ein Antrag derzeit leider nicht möglich.";

/** Vorwahl + Nummer in die Form, an der die Prüfung misst (wie bisher in POST /application). */
export function telefonE164(vorwahlRoh: unknown, nummerRoh: unknown): string {
  const vorwahl = String(vorwahlRoh || "").replace(/\s/g, "");
  const nummer = String(nummerRoh || "").replace(/[\s\-()./]/g, "");
  return nummer.startsWith("+") ? nummer : nummer.startsWith("00") ? "+" + nummer.slice(2) : vorwahl + nummer.replace(/^0/, "");
}

/** Ist das erkennbar eine Nummer von außerhalb DE/AT/CH? Leere Eingaben und Nummern ohne Vorwahl: nein. */
export function istAuslandsnummer(vorwahlRoh: unknown, nummerRoh: unknown): boolean {
  const nummer = String(nummerRoh || "").replace(/[\s\-()./]/g, "");
  const e164 = telefonE164(vorwahlRoh, nummerRoh);
  return !!nummer && e164.startsWith("+") && !/^\+(49|43|41)\d/.test(e164);
}

/**
 * Die Nummer eines Firmen-Ansprechpartners in internationaler Schreibweise —
 * oder `null`, wenn sie nicht aus DE/AT/CH stammt oder keine Nummer ist.
 */
export function dachNummer(telefonRoh: unknown, land: DachLand): string | null {
  const roh = String(telefonRoh || "").trim();
  if (!roh) return null;
  const e164 = telefonE164(DACH_VORWAHL[land] ?? "", roh);
  return /^\+(49|43|41)[1-9]\d{5,13}$/.test(e164) ? e164 : null;
}
