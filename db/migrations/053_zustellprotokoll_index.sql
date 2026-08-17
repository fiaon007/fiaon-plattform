-- ═══════════════════════════════════════════════════════════════════════════
-- DAS ZUSTELLPROTOKOLL MUSS SCHNELL SEIN
--
-- Die Dashboard-Karte „Zustellung heute" und das Protokoll unter
-- /admin/events fragen: „Was ging in den letzten Tagen raus, was nicht?"
-- Ohne Index war das ein Tabellendurchlauf über 9.500 Zeilen — GEMESSEN
-- 3,8 Sekunden. Eine Seite, die vier Sekunden braucht, öffnet niemand
-- zweimal, und dann sieht auch niemand die fehlgeschlagenen Mails.
--
-- Eigene Datei und nicht an 052 angehängt: Der Migrationslauf merkt sich
-- Dateinamen. Eine bereits angewendete Datei wird übersprungen — was man
-- hinten anfügt, läuft nie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS fiaon_mail_log_zeit_idx
  ON fiaon_mail_log (created_at DESC);
CREATE INDEX IF NOT EXISTS fiaon_mail_log_fehler_idx
  ON fiaon_mail_log (created_at DESC) WHERE status = 'fehlgeschlagen';
