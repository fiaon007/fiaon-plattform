-- ═══════════════════════════════════════════════════════════════════════════
-- RÜCKNAHME VON 032 · CRM-UMBAU
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ACHTUNG — diese Datei liegt absichtlich NICHT in db/migrations/.
-- Der Runner (scripts/run-migrations.mjs) führt dort jede .sql-Datei bei jedem
-- Start aus. Läge die Rücknahme daneben, würde der nächste Deploy die
-- Migration wieder auflösen.
--
-- Ausführen von Hand, bewusst, mit vorliegendem Backup:
--   psql "$DATABASE_URL" -f db/rollback/032_crm_person_ownership_rollback.sql
--   DELETE FROM schema_migrations WHERE filename = '032_crm_person_ownership.sql';
--
-- WAS DIE RÜCKNAHME VERLIERT
-- Mit den Spalten verschwinden die darin gesammelten Arbeitsdaten:
-- zugesagte Zahlungsdaten, Wiedervorlagen, Nichterreicht-Zähler,
-- Rechnungszähler. Die Zuständigkeiten selbst bleiben unberührt, die hat 032
-- nie angefasst. Vor der Rücknahme also erst prüfen, ob diese Daten
-- gebraucht werden.
--
-- NICHT ZURÜCKGENOMMEN WIRD
-- `fiaon_agents.distribution_active` und `.active` für Agent #7: Beide waren
-- bereits vor 032 auf FALSE, das UPDATE in der Migration ist dort durch seine
-- WHERE-Bedingung ein Leerlauf gewesen. Es gibt nichts wiederherzustellen.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 4 · Konfiguration ──────────────────────────────────────────────────────
-- Nur die vier von 032 eingefügten Schlüssel. Andere Einträge bleiben.
DELETE FROM fiaon_settings
WHERE key IN ('kartei_enabled', 'pool_cap_tier1', 'pool_refill_threshold', 'pool_cap_tier2');


-- ── 3 · fiaon_agent_events ─────────────────────────────────────────────────
DROP INDEX IF EXISTS fiaon_agent_events_reason_idx;
DROP INDEX IF EXISTS fiaon_agent_events_to_agent_idx;

ALTER TABLE fiaon_agent_events DROP COLUMN IF EXISTS actor;
ALTER TABLE fiaon_agent_events DROP COLUMN IF EXISTS reason;
ALTER TABLE fiaon_agent_events DROP COLUMN IF EXISTS to_agent_id;
ALTER TABLE fiaon_agent_events DROP COLUMN IF EXISTS from_agent_id;


-- ── 2 · fiaon_agents ───────────────────────────────────────────────────────
ALTER TABLE fiaon_agents DROP COLUMN IF EXISTS is_test_account;


-- ── 1 · fiaon_persons ──────────────────────────────────────────────────────
DROP INDEX IF EXISTS fiaon_persons_promised_idx;
DROP INDEX IF EXISTS fiaon_persons_agent_followup_idx;
DROP INDEX IF EXISTS fiaon_persons_tier_agent_idx;

ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_tier_reason_chk;
ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_priority_tier_chk;

ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS assigned_at;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS invoice_sent_count;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS is_blocked;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS unreachable_count;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS follow_up_date;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS promised_payment_date;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS tier_reason;
ALTER TABLE fiaon_persons DROP COLUMN IF EXISTS priority_tier;
