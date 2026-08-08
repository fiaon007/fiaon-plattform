-- ═══════════════════════════════════════════════════════════════════════════
-- 038 — Der Alt-Bestand bekommt ein eigenes Merkmal
--
-- Diese Migration muss VOR dem Verwendungszweck-Backfill laufen (039).
--
-- ── Eine versteckte Bedeutung sichtbar machen ───────────────────────────────
-- `payment_reference IS NULL` war nicht nur eine Lücke, sondern ein MERKMAL:
-- `fiaon-truth.ts` unterscheidet damit Umsatz von Alt-Bestand.
--
--   Umsatz      = bezahlt, keine Dublette, MIT Referenz   → 273 Zeilen, 18 589,56 €
--   Alt-Bestand = bezahlt, keine Dublette, OHNE Referenz  →  69 Zeilen,    767,91 €
--                 (importierte Alt-Kunden ohne Beleg, fließen NIE in Umsatz)
--
-- Würden diese 69 Zeilen beim Backfill einfach eine Referenz bekommen, wären sie
-- ab sofort Umsatz: 767,91 € aus dem Nichts, und niemand könnte erklären, woher
-- der Sprung kommt. Deshalb bekommt der Alt-Bestand zuerst eine eigene Spalte.
-- Danach steht die Bedeutung dort, wo sie hingehört — und nicht mehr in der
-- Abwesenheit eines anderen Wertes.
--
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS alt_bestand BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE fiaon_applications
   SET alt_bestand = TRUE
 WHERE payment_status = 'paid'
   AND merged_into IS NULL
   AND payment_reference IS NULL
   AND alt_bestand = FALSE;

COMMENT ON COLUMN fiaon_applications.alt_bestand IS
  'Importierter Alt-Kunde ohne Zahlungsbeleg. Zaehlt NIE in Umsatz oder Funnel. '
  'Frueher daran erkannt, dass payment_reference fehlte — seit 08.08.2026 explizit.';
