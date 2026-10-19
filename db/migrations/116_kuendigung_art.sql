-- ═══════════════════════════════════════════════════════════════════════════
-- 116 · KÜNDIGUNG: ART UND KULANZ-RATE (19.10.2026, E-396)
--
-- Der Jahresvertrag läuft nach der Kündigung bis zum Laufzeitende; vorzeitig raus nur aus Kulanz, nach Zahlung der
-- offenen Rechnung (server/lib/fiaon-kuendigung.ts, shared/fiaon-jahresvertrag.ts). Dafür braucht eine Bestellung:
--   kuendigung_art   laufzeit (läuft bis zum Ende, Kulanz-Angebot steht) | kulanz (aus Kulanz beendet) |
--                    sofort_recht (Widerruf/wichtiger Grund, Leitung mit Grund); leer = Kündigung vor E-396
--   kulanz_rate_nr   die Rate, deren Zahlung den Vertrag aus Kulanz beendet (die offene Rechnung bei der Kündigung)
-- Dieselben Spalten legt kuendigungSpalten() zur Laufzeit an — die Migration sorgt dafür, dass sie schon beim Start da
-- sind (Akte, Mara, Kundenbereich lesen sie). Nur ADD COLUMN IF NOT EXISTS ohne Standardwert.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kuendigung_art TEXT;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kulanz_rate_nr INTEGER;
