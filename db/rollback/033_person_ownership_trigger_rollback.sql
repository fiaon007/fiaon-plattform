-- ═══════════════════════════════════════════════════════════════════════════
-- RÜCKNAHME 033 · Ownership-Trigger entfernen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entfernt nur die Automatik, KEINE Daten. Bereits nachgezogene Antragszeilen
-- und geschriebene Beweiszeilen bleiben, wie sie sind — sie sind das Ergebnis
-- korrekter Zuweisungen und dürfen nicht verschwinden.
--
-- Nach dieser Rücknahme müssen Schreibstellen die Antragszeilen wieder selbst
-- nachziehen. Das ist die Ausgangslage, die die 26 Zuweisungskonflikte erzeugt
-- hat — die Rücknahme ist deshalb ein Notausgang, keine Option.
--
-- Diese Datei liegt bewusst NICHT in db/migrations/: Der Runner führt dort jede
-- .sql-Datei aus und würde den Trigger bei jedem Start wieder abräumen.
--
-- Aufruf:
--   psql "$DATABASE_URL" -f db/rollback/033_person_ownership_trigger_rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS fiaon_person_owner_propagate_trg ON fiaon_persons;
DROP TRIGGER IF EXISTS fiaon_person_owner_stamp_trg ON fiaon_persons;

DROP FUNCTION IF EXISTS fiaon_person_owner_propagate();
DROP FUNCTION IF EXISTS fiaon_person_owner_stamp();

-- Der Index bleibt: Er kostet nichts und beschleunigt die Auswertung der
-- bereits vorhandenen Beweiszeilen weiterhin.
