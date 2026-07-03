// ============================================================================
// EPC-QR-Code (GiroCode) — Payload nach EPC069-12 Standard
// Version 002 · Zeichensatz UTF-8 · Service Tag BCD · Identification SCT
// ============================================================================

export interface EpcQrData {
  recipient: string; // Name des Zahlungsempfängers
  iban: string; // ohne Leerzeichen
  bic: string;
  amount: number; // in EUR
  remittance: string; // Verwendungszweck (unstructured)
}

/**
 * Erzeugt den EPC-QR-Payload (Zeilen mit \n getrennt).
 * Reihenfolge lt. Standard:
 *  1 Service Tag        BCD
 *  2 Version            002
 *  3 Zeichensatz        1 (UTF-8)
 *  4 Identification     SCT
 *  5 BIC
 *  6 Name Empfänger
 *  7 IBAN
 *  8 Betrag             EUR#.##
 *  9 Purpose            (leer)
 * 10 Remittance (strukturiert, leer)
 * 11 Remittance (unstrukturiert) = Verwendungszweck
 * 12 Beneficiary-to-originator info (leer)
 */
export function buildEpcQrPayload(d: EpcQrData): string {
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
