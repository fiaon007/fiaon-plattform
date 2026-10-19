-- ═══════════════════════════════════════════════════════════════════════════
-- 115 · GROSSER HAUSPUTZ DER AUFGABEN (19.10.2026, E-397)
--
-- Der Server legt alles beim ersten Gebrauch selbst an (dieselbe DDL in
-- server/lib/fiaon-system-alarme.ts, server/lib/fiaon-hausputz.ts und
-- server/lib/fiaon-auftraege.ts — die DDL-Wache prüft vorher im Katalog, E-254).
-- Diese Datei ist die Beschreibung dazu. 113/114 sind von anderen Strängen belegt.
--
--   fiaon_system_alarme   EINE Zeile je System-Alarm (fester Schlüssel), geht von
--                         selbst aus — statt eines Auftrags je Anschlag.
--   fiaon_hausputz_laeufe Probelauf (nur Zahlen) und der eine Lauf je Freigabe.
--   fiaon_hausputz_log    jede Änderung des Laufs mit dem Zustand vorher —
--                         30 Tage rückholbar.
--   fiaon_vermerke        erledigt_art / erledigt_grund: Grund jeder Schließung.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_system_alarme (
  schluessel TEXT PRIMARY KEY,
  quelle VARCHAR(40) NOT NULL,
  titel TEXT NOT NULL,
  text TEXT,
  stufe VARCHAR(10) NOT NULL DEFAULT 'rot',
  link TEXT,
  erstmals_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zuletzt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anzahl INTEGER NOT NULL DEFAULT 1,
  episoden INTEGER NOT NULL DEFAULT 1,
  endet_nach_stunden INTEGER,
  vorbei_am TIMESTAMPTZ,
  vorbei_grund TEXT
);

CREATE TABLE IF NOT EXISTS fiaon_hausputz_laeufe (
  id SERIAL PRIMARY KEY,
  art VARCHAR(20) NOT NULL,
  freigabe TEXT,
  gestartet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fertig_am TIMESTAMPTZ,
  zahlen JSONB,
  fehler TEXT
);

CREATE TABLE IF NOT EXISTS fiaon_hausputz_log (
  id BIGSERIAL PRIMARY KEY,
  lauf_id INTEGER NOT NULL,
  tabelle VARCHAR(20) NOT NULL,
  zeile_id INTEGER NOT NULL,
  regel VARCHAR(40) NOT NULL,
  aktion VARCHAR(20) NOT NULL,
  ziel_id INTEGER,
  vorher JSONB,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zurueck_am TIMESTAMPTZ,
  zurueck_von TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_hausputz_log_lauf_idx ON fiaon_hausputz_log (lauf_id, regel);
CREATE INDEX IF NOT EXISTS fiaon_hausputz_log_zeile_idx ON fiaon_hausputz_log (tabelle, zeile_id);

ALTER TABLE fiaon_vermerke ADD COLUMN IF NOT EXISTS erledigt_art VARCHAR;
ALTER TABLE fiaon_vermerke ADD COLUMN IF NOT EXISTS erledigt_grund TEXT;
