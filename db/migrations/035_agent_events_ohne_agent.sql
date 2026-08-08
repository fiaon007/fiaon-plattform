-- ═══════════════════════════════════════════════════════════════════════════
-- 035 — Protokolleinträge OHNE Agenten zulassen
--
-- `fiaon_agent_events` ist das Protokollbuch des Hauses. Bisher verlangte es
-- eine `agent_id` — es konnte also nur festhalten, was ein AGENT getan hat.
-- Damit war eine ganze Klasse von Entscheidungen nicht protokollierbar:
--
--   · der Betreiber im Admin-Bereich (er hat kein Agentenkonto, sondern einen
--     Zugangscode)
--   · Läufe, die eine Entscheidung ausführen (Reaktivierung, Teil 0)
--
-- Genau das war beim Reaktivierungslauf das Problem: Bei zwei gesperrten Konten
-- ließ sich nicht mehr feststellen, ob ein Mensch das entschieden hatte oder
-- eine Automatik — weil die Sperrung nirgends protokolliert werden KONNTE.
--
-- Die Spalte `actor` (Klartext, wer gehandelt hat) existiert bereits und ist ab
-- jetzt die Pflichtangabe in der Praxis. `agent_id` bleibt für alles, was
-- wirklich von einem Agenten kommt, und wird nur nullable.
--
-- Nichts wird gelöscht, nichts umbenannt; vorhandene Zeilen bleiben unverändert.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_agent_events ALTER COLUMN agent_id DROP NOT NULL;

-- Protokollsuche nach Art und Zeit — die Reaktivierungserkennung fragt genau so.
CREATE INDEX IF NOT EXISTS fiaon_agent_events_type_created_idx
  ON fiaon_agent_events (type, created_at DESC);
