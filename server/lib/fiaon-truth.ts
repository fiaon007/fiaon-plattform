// ═══════════════════════════════════════════════════════════════════
// DIE EINE WAHRHEIT (Phase 2, P2-D) — zentrale Kennzahl-Definitionen.
//
// Jede Ansicht (Zahlungszentrale, Finanzen & Sales, Leads, Kunden & Anträge,
// Dashboard, Agent-Portal) nutzt AUSSCHLIESSLICH diese Definitionen — kein
// Copy-Paste-SQL mehr. Begründung siehe SYSTEM_DIAGNOSE.md (D3):
//
//   BEZAHLTER KUNDE  = payment_status='paid'
//                      AND merged_into IS NULL        (Dubletten nie mitzählen)
//                      AND payment_reference IS NOT NULL  (nachvollziehbarer Zahlungsvorgang)
//
//   ALT-BESTAND      = payment_status='paid' ohne payment_reference —
//                      importierte Alt-Kunden ohne Beleg (68 von 69 ohne Betrag).
//                      Wird SEPARAT ausgewiesen und fließt NIE in Umsatz/Funnel.
//
//   UMSATZ           = SUM(amount_due) der bezahlten Kunden.
//   ZEIT-ANKER       = completed_at (Bezahl-/Freischalt-Zeitpunkt) — niemals
//                      updated_at (das verschiebt Alt-Datensätze in den Zeitraum).
// ═══════════════════════════════════════════════════════════════════

/** WHERE-Fragment „bezahlter Kunde" (die eine Wahrheit). alias z. B. "a". */
export function paidWhere(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `${p}payment_status = 'paid' AND ${p}merged_into IS NULL AND ${p}payment_reference IS NOT NULL`;
}

/** WHERE-Fragment „Alt-Bestand" (bezahlt importiert, ohne Zahlungsreferenz). */
export function legacyPaidWhere(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `${p}payment_status = 'paid' AND ${p}merged_into IS NULL AND ${p}payment_reference IS NULL`;
}

/** Zeit-Anker einer Zahlung (nie updated_at). alias z. B. "a". */
export function paidAtSql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `COALESCE(${p}completed_at, ${p}claimed_paid_at, ${p}created_at)`;
}

/** Umsatz in Integer-Cents. alias z. B. "a". */
export function revenueCentsSql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `ROUND(COALESCE(${p}amount_due::numeric, 0) * 100)`;
}

/** Klartext-Definitionen für Tooltips (Frontend erhält sie über die APIs). */
export const KPI_DEFS = {
  bezahlt:
    "Bezahlter Kunde = Zahlungsstatus 'bezahlt', keine Dublette (merged), mit Zahlungsreferenz (nachvollziehbarer Zahlungsvorgang). Alt-Importe ohne Referenz zählen hier nicht.",
  altbestand:
    "Alt-Bestand = als bezahlt importierte Alt-Kunden OHNE Zahlungsreferenz (überwiegend ohne Betrag). Wird getrennt ausgewiesen und fließt nie in Umsatz oder Funnel ein.",
  umsatz:
    "Umsatz = Summe der Beträge (amount_due) aller bezahlten Kunden im Zeitraum. Zeit-Anker ist der Bezahl-Zeitpunkt (completed_at), nie das letzte Änderungsdatum.",
  angeschrieben:
    "Angeschrieben = Lead hat mindestens eine automatische Mail erhalten (Status nicht mehr 'neu'). Das ist KEIN persönlicher Kontakt.",
  kontaktiertEcht:
    "Kontaktiert (Agent) = ein Agent hat ein Kontakt-Ergebnis dokumentiert (Anruf/Gespräch). Massenmails zählen nicht.",
  cac: "CAC = eingetragenes Werbebudget ÷ bezahlte Kunden im Zeitraum (nur echte, referenzierte Zahlungen).",
  ltv: "LTV = Ø-Bestellwert × 12 Monate ANGENOMMENE Laufzeit. Die 12 Monate sind eine Annahme, kein Messwert.",
} as const;
