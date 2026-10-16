-- ═══════════════════════════════════════════════════════════════════════════
-- 112 · KOOPERATION: MODELLE „ABSCHLUSS“ UND „PLATZ“ (16.10.2026, E-390)
--
-- Energie und Telefon & Internet werden je gemeldetem Abschluss bezahlt (nicht je Übermittlung), Recht und Steuern
-- über einen festen Partnerplatz je Monat (shared/fiaon-global-angebot-koop-modelle.ts). Dafür braucht ein Kontakt:
--   anschrift          was ein Versorger für das Angebot braucht (nur Modell „abschluss“, mit Einwilligung übermittelt)
--   abschluss_am/_art  der Partner meldet den Abschluss im Partnerbereich (Sparte = Haupt- oder Zweitpreis)
--   kein_abschluss_am  der Partner meldet: kein Vertrag (nur zur Übersicht, nie berechnet)
-- Nur ADD COLUMN IF NOT EXISTS ohne Standardwert. Der Server führt die Datei nur aus, wenn eine Spalte fehlt
-- (Katalogprüfung vorher — ein ALTER nimmt auch bei vorhandener Spalte eine kurze exklusive Sperre, E-254).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE fiaon_koop_kontakte ADD COLUMN IF NOT EXISTS anschrift TEXT;
ALTER TABLE fiaon_koop_kontakte ADD COLUMN IF NOT EXISTS abschluss_am TIMESTAMPTZ;
ALTER TABLE fiaon_koop_kontakte ADD COLUMN IF NOT EXISTS abschluss_art VARCHAR(40);
ALTER TABLE fiaon_koop_kontakte ADD COLUMN IF NOT EXISTS kein_abschluss_am TIMESTAMPTZ;
