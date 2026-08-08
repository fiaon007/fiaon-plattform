// ═══════════════════════════════════════════════════════════════════════════
// VERWENDUNGSZWECK — eine Bestellung ohne Referenz gibt es nicht mehr
//
// Der Verwendungszweck (`payment_reference`, Format `FIAON-XXXXXX`) ist das
// einzige, was einen Bankeingang mit einem Menschen verbindet. Fehlt er, ist das
// Geld anonym: Die Buchhaltung sieht einen Betrag ohne Kunden, der Agent hört
// „ich habe doch überwiesen", und am Ende streiten zwei Kollegen über eine
// Provision, die niemand zuordnen kann. Dreimal an einem Tag gemeldet.
//
// Vorher entstand er erst beim Aufruf von `/payment-order` — also erst, wenn ein
// Kunde die Zahlungsseite erreichte. Ein Kunde ohne E-Mail kam dort nie an.
//
// DIE ERZEUGUNG LIEGT IN DER DATENBANK, nicht hier: `fiaon_verwendungszweck_neu()`
// (db/migrations/037). Zwei Gründe:
//   1. Ein BEFORE-INSERT-Trigger benutzt dieselbe Funktion. Damit bekommt AUCH
//      ein Import, ein Skript oder ein `INSERT` von Hand eine Referenz — ohne
//      dass jemand daran denken muss.
//   2. Die Eindeutigkeitsprüfung sitzt neben dem eindeutigen Index. Zwei
//      gleichzeitige Anlagen können sich nicht dieselbe Referenz greifen.
//
// Diese Datei ist die EINE Tür aus dem Anwendungscode dorthin.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Ein freier Verwendungszweck. Kollisionen werden in der Datenbank neu gewürfelt. */
export async function neuerVerwendungszweck(lauf: Lauf = sqlPool): Promise<string> {
  const [row] = await lauf`SELECT fiaon_verwendungszweck_neu() AS zweck`;
  const zweck = String(row?.zweck ?? "").trim();
  if (!/^FIAON-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(zweck)) {
    throw new Error(`Verwendungszweck sieht falsch aus: ${zweck}`);
  }
  return zweck;
}

/**
 * Stellt sicher, dass eine Bestellung einen Verwendungszweck hat.
 *
 * Idempotent und ohne Nebenwirkung: Wer schon einen hat, behält ihn. Gedacht als
 * Sicherheitsnetz für Wege, die es vor dem Trigger gab (und für den Prüfstand).
 */
export async function verwendungszweckSichern(ref: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const [vorher] = await lauf`
    SELECT payment_reference FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!vorher) return null;
  if (vorher.payment_reference && String(vorher.payment_reference).trim()) {
    return String(vorher.payment_reference);
  }
  const [row] = await lauf`
    UPDATE fiaon_applications
    SET payment_reference = fiaon_verwendungszweck_neu(), updated_at = NOW()
    WHERE ref = ${ref} AND (payment_reference IS NULL OR btrim(payment_reference) = '')
    RETURNING payment_reference
  `;
  return row ? String(row.payment_reference) : String(vorher.payment_reference ?? "") || null;
}

/**
 * Die Bankverbindung, die der Kunde braucht — an EINER Stelle.
 *
 * Sie steht bewusst nicht in der Oberfläche: Der Agent liest sie aus derselben
 * Quelle, aus der die Rechnung sie nimmt. Eine zweite, abgeschriebene IBAN im
 * Frontend wäre irgendwann die falsche.
 */
export interface Zahlungsdaten {
  empfaenger: string;
  iban: string;
  ibanAnzeige: string;
  bic: string;
  verwendungszweck: string;
  betragCent: number | null;
}

/** Klartext zum direkten Einfügen in WhatsApp — kurz, ohne Zierrat. */
export function zahlungstext(z: Zahlungsdaten): string {
  const betrag = z.betragCent != null
    ? `${(z.betragCent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : null;
  return [
    "Zahlungsdaten FIAON",
    `Empfänger: ${z.empfaenger}`,
    `IBAN: ${z.ibanAnzeige}`,
    `BIC: ${z.bic}`,
    betrag ? `Betrag: ${betrag}` : null,
    `Verwendungszweck: ${z.verwendungszweck}`,
    "",
    "Bitte den Verwendungszweck genau so angeben — daran erkennen wir Ihre Zahlung.",
  ].filter(Boolean).join("\n");
}
