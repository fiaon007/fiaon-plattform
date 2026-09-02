// ═══════════════════════════════════════════════════════════════════════════
// EPC-QR („GiroCode") — EINE Quelle für Zahlungsseite UND Mail-QR (02.09.2026)
//
// Der Standard des European Payments Council: Banking-Apps lesen Empfänger,
// IBAN, BIC, Betrag und Verwendungszweck aus dem Code und füllen die
// Überweisung vollständig aus. Vorher stand die Logik nur im Client
// (client/src/lib/epc-qr.ts); seit die Zahlungsmails den Code als Bild tragen,
// braucht der Server dieselbe Nutzlast — deshalb hier, geteilt.
// ═══════════════════════════════════════════════════════════════════════════

export interface EpcQrDaten {
  /** Name des Zahlungsempfängers. */
  recipient: string;
  /** IBAN — Leerzeichen werden entfernt. */
  iban: string;
  bic: string;
  /** Betrag in Euro. */
  amount: number;
  /** Verwendungszweck (unstrukturiert) — bei uns die Zahlungs- oder Ratenreferenz. */
  remittance: string;
}

export function epcQrNutzlast(d: EpcQrDaten): string {
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    d.bic,
    d.recipient,
    d.iban.replace(/\s+/g, ""),
    `EUR${d.amount.toFixed(2)}`,
    "",
    "",
    d.remittance,
    "",
  ].join("\n");
}
