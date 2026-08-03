-- ═══════════════════════════════════════════════════════════════════════════
-- Beweis für den Ownership-Trigger aus Migration 033
--
-- Läuft vollständig in EINER Transaktion, die am Ende zurückgerollt wird.
-- Es bleibt kein verändertes Datum zurück — auch nicht die Beweiszeile, die der
-- Trigger schreibt. Der Test darf gegen die Produktionsdatenbank laufen.
--
-- Geprüft werden drei Zusagen:
--   1. Antragszeilen folgen dem Besitzer der Person, ohne dass der Aufrufer
--      sie anfasst.
--   2. Es entsteht eine Beweiszeile mit vorherigem UND neuem Besitzer.
--   3. `assigned_at` wird auf den Zeitpunkt des Wechsels gesetzt.
--
-- Aufruf:
--   psql "$DATABASE_URL" -f scripts/sql/test-033-trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL "fiaon.reason" = 'test_033';
SET LOCAL "fiaon.actor"  = 'system:test';

-- Eine Person, die Antragszeilen hat und einem Agenten gehört. Genau daran
-- lässt sich der Wechsel beobachten.
CREATE TEMP TABLE probe AS
SELECT p.id AS person_id,
       p.assigned_agent_id AS alter_agent,
       (SELECT a.id FROM fiaon_agents a
         WHERE a.id IS DISTINCT FROM p.assigned_agent_id AND a.active
         ORDER BY a.id LIMIT 1) AS neuer_agent,
       (SELECT count(*) FROM fiaon_applications ap WHERE ap.person_id = p.id) AS zeilen
FROM fiaon_persons p
WHERE p.assigned_agent_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = p.id)
ORDER BY p.id
LIMIT 1;

\echo '── Ausgangslage ─────────────────────────────────────────────────────────'
SELECT person_id, alter_agent, neuer_agent, zeilen AS antragszeilen FROM probe;

SELECT ap.ref, ap.assigned_agent_id AS agent_vorher
FROM fiaon_applications ap
WHERE ap.person_id = (SELECT person_id FROM probe)
ORDER BY ap.ref;

-- ── Der eine Schreibvorgang: NUR die Person, nichts anderes ────────────────
UPDATE fiaon_persons
   SET assigned_agent_id = (SELECT neuer_agent FROM probe)
 WHERE id = (SELECT person_id FROM probe);

\echo ''
\echo '── 1) Sind die Antragszeilen von selbst gefolgt? ────────────────────────'
SELECT ap.ref,
       ap.assigned_agent_id AS agent_nachher,
       CASE WHEN ap.assigned_agent_id = (SELECT neuer_agent FROM probe)
            THEN 'OK — gefolgt' ELSE 'FEHLER — nicht gefolgt' END AS ergebnis
FROM fiaon_applications ap
WHERE ap.person_id = (SELECT person_id FROM probe)
ORDER BY ap.ref;

\echo ''
\echo '── 2) Beweiszeile mit vorherigem und neuem Besitzer? ───────────────────'
SELECT e.type, e.from_agent_id, e.to_agent_id, e.reason, e.actor, e.meta
FROM fiaon_agent_events e
WHERE e.type = 'person_owner_changed' AND e.reason = 'test_033'
ORDER BY e.id DESC
LIMIT 1;

\echo ''
\echo '── 3) Besitzdauer gesetzt? ─────────────────────────────────────────────'
SELECT id,
       assigned_agent_id,
       assigned_at,
       CASE WHEN assigned_at > NOW() - INTERVAL '1 minute'
            THEN 'OK — auf jetzt gesetzt' ELSE 'FEHLER — nicht gesetzt' END AS ergebnis
FROM fiaon_persons
WHERE id = (SELECT person_id FROM probe);

\echo ''
\echo '── Alles zurückrollen: es bleibt nichts zurück ─────────────────────────'
ROLLBACK;

-- Gegenprobe nach dem Rollback: Die Beweiszeile darf es nicht mehr geben.
SELECT COALESCE(count(*), 0)::int AS beweiszeilen_nach_rollback
FROM fiaon_agent_events
WHERE type = 'person_owner_changed' AND reason = 'test_033';
