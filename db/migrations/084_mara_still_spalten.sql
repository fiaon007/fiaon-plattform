-- ═══════════════════════════════════════════════════════════════════════════
-- MARAS SCHWEIGE-SPALTEN AB DEM START — 28.09.2026 (E-248, Nachbesserung)
--
-- still_bis_id (fiaon_whatsapp_gespraech) und auto_antwort (fiaon_whatsapp)
-- entstanden bisher erst im ersten gespraechSchema() von Mara, also bei der
-- ersten eingehenden Nachricht nach dem Deploy. Bis dahin lesen die Zähler in
-- fiaon-wa-zentrale.ts und fiaon-mara-steuerpult.ts die Spalte still_bis_id,
-- scheitern still und zeigen „0 wartend". Diese Datei legt beide Spalten beim
-- Start an (npm start → db:migrate:sql).
--
-- Wiederholbar: nur ADD COLUMN IF NOT EXISTS, und nur, wenn die Tabelle schon
-- existiert (auf einer frischen Datenbank legt der Server sie selbst an).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.fiaon_whatsapp_gespraech') IS NOT NULL THEN
    ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS still_bis_id BIGINT;
  END IF;
  IF to_regclass('public.fiaon_whatsapp') IS NOT NULL THEN
    ALTER TABLE fiaon_whatsapp ADD COLUMN IF NOT EXISTS auto_antwort BOOLEAN;
  END IF;
END $$;
