// ═══════════════════════════════════════════════════════════════════
// DIE EINE WAHRHEIT (Phase 2, P2-D) — zentrale Kennzahl-Definitionen.
//
// Jede Ansicht (Zahlungszentrale, Finanzen & Sales, Leads, Kunden & Anträge,
// Dashboard, Agent-Portal) nutzt AUSSCHLIESSLICH diese Definitionen — kein
// Copy-Paste-SQL mehr. Begründung siehe SYSTEM_DIAGNOSE.md (D3):
//
//   BEZAHLTER KUNDE  = payment_status='paid'
//                      AND merged_into IS NULL        (Dubletten nie mitzählen)
//                      AND NOT alt_bestand            (kein importierter Alt-Kunde)
//
//   ALT-BESTAND      = payment_status='paid' AND alt_bestand — importierte
//                      Alt-Kunden ohne Beleg (68 von 69 ohne Betrag). Wird
//                      SEPARAT ausgewiesen und fließt NIE in Umsatz/Funnel.
//
// GEÄNDERT AM 08.08.2026: Der Alt-Bestand war vorher daran erkennbar, dass die
// `payment_reference` FEHLTE. Seit jede Bestellung bedingungslos einen
// Verwendungszweck bekommt (Trigger, db/migrations/037), gibt es diese Lücke
// nicht mehr — die Unterscheidung hätte lautlos 69 Zeilen und 767,91 € in den
// Umsatz gespült. Eine Bedeutung, die in der Abwesenheit eines anderen Wertes
// steckt, hält keine Änderung aus. Jetzt steht sie in `alt_bestand`.
//
//   UMSATZ           = E-343 (13.10.2026): NICHT mehr hier. Die alte Regel
//                      „SUM(amount_due) nach completed_at" sah keine einzige
//                      Monatsrate (Oktober 2.116,75 € statt 3.862,51 €) und
//                      kannte keine Testkonten. Umsatz kommt nur noch aus
//                      UMSATZ_QUELLE_SQL (server/lib/fiaon-umsatz-quelle.ts);
//                      revenueCentsSql/paidAtSql sind deshalb entfernt.
// ═══════════════════════════════════════════════════════════════════

/** WHERE-Fragment „bezahlter Kunde" (die eine Wahrheit). alias z. B. "a". */
export function paidWhere(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `${p}payment_status = 'paid' AND ${p}merged_into IS NULL AND NOT COALESCE(${p}alt_bestand, FALSE)`;
}

/** WHERE-Fragment „Alt-Bestand" (bezahlt importiert, ohne Zahlungsbeleg). */
export function legacyPaidWhere(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `${p}payment_status = 'paid' AND ${p}merged_into IS NULL AND COALESCE(${p}alt_bestand, FALSE)`;
}

/** Klartext-Definitionen für Tooltips (Frontend erhält sie über die APIs). */
export const KPI_DEFS = {
  bezahlt:
    "Bezahlter Kunde = Zahlungsstatus 'bezahlt', keine Dublette (merged), kein importierter Alt-Kunde. Alt-Importe ohne Zahlungsbeleg zählen hier nicht.",
  altbestand:
    "Alt-Bestand = als bezahlt importierte Alt-Kunden ohne Zahlungsbeleg (überwiegend ohne Betrag). Gekennzeichnet in der Spalte alt_bestand. Wird getrennt ausgewiesen und fließt nie in Umsatz oder Funnel ein.",
  // E-343 (13.10.2026): dieselbe Regel wie /chef/zahlen — eine Quelle (UMSATZ_QUELLE_SQL).
  umsatz:
    "Umsatz = jede gebuchte Zahlung echter Kunden im Zeitraum: bezahlte Monatsraten (Tag = Zahlungseingang, bezahlt_am) plus bezahlte Einmalkäufe ohne Ratenkette (Bonitätsauskunft, FIAON Global). Testkonten und Dubletten zählen nie. Tage in Berliner Zeit. Dieselbe Zahl wie im Chefbüro.",
  angeschrieben:
    "Angeschrieben = Lead hat mindestens eine automatische Mail erhalten (Status nicht mehr 'neu'). Das ist KEIN persönlicher Kontakt.",
  kontaktiertEcht:
    "Kontaktiert (Agent) = ein Agent hat ein Kontakt-Ergebnis dokumentiert (Anruf/Gespräch). Massenmails zählen nicht.",
  cac: "CAC = eingetragenes Werbebudget ÷ Abschlüsse im Zeitraum (Rate 1 oder Einmalkauf gebucht).",
  ltv: "LTV = Ø Abschlusswert (erste Zahlung: Rate 1 oder Einmalkauf) × 12 Monate ANGENOMMENE Laufzeit. Die 12 Monate sind eine Annahme, kein Messwert.",
} as const;
