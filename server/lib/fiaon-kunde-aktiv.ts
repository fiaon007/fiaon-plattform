// ═══════════════════════════════════════════════════════════════════════════
// AKTIV ODER ARCHIV — EINE REGEL FÜR ALLE LISTEN (05.09.2026, Florentine Punkt 2)
//
// „Kunden, die gesperrt wurden oder gekündigt haben, sind weiterhin in den
// aktiven Bereichen sichtbar. Sie sollten nicht mehr in Kundenlisten,
// Onboarding, Tasks, Anruflisten auftauchen — die Akte bleibt, unter
// ‚Inaktive Kunden / Archiv' abrufbar."
//
// Inaktiv ist ein Mensch, wenn
//   · sein Konto gesperrt ist (account_status = 'suspended'), ODER
//   · er Bestellungen hat und KEINE davon mehr lebt: jede ist archiviert,
//     storniert oder ihr Vertrag ist beendet (vertrag_ende_am erreicht).
// Wer nur einen Vertrag gekündigt hat, dessen letzte Rate noch offen ist,
// bleibt AKTIV — die Forderung ist Arbeit, und der Vertrag läuft bis zur
// Zahlung (Justins Regel, E-135). Leads ohne Bestellung sind nie „inaktiv"
// — für sie gibt es die Sperre (is_blocked).
//
// Die Regel ist SQL, damit jede Liste sie als eine Bedingung anhängen kann;
// `p` ist der Alias der fiaon_persons-Zeile.
// ═══════════════════════════════════════════════════════════════════════════

export function kundeInaktivSql(p = "p"): string {
  return `(
    ${p}.account_status = 'suspended'
    OR (
      EXISTS (SELECT 1 FROM fiaon_applications kx WHERE kx.person_id = ${p}.id AND kx.merged_into IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications ky
         WHERE ky.person_id = ${p}.id AND ky.merged_into IS NULL AND ky.archived_at IS NULL
           AND (ky.vertrag_ende_am IS NULL OR ky.vertrag_ende_am > NOW())
           AND COALESCE(ky.payment_status, '') NOT IN ('cancelled', 'canceled', 'storniert', 'refunded', 'void')
      )
    )
  )`;
}

export function kundeAktivSql(p = "p"): string {
  return `NOT ${kundeInaktivSql(p)}`;
}
