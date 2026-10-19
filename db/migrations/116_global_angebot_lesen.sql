-- ═══════════════════════════════════════════════════════════════════════════
-- 116 · WAS HAT DER KUNDE IM ANGEBOT WIE LANGE GELESEN? (19.10.2026, E-406)
--
-- Der Server legt die Tabelle beim ersten Gebrauch selbst an (dieselbe DDL in
-- server/lib/fiaon-global-angebot-lesen.ts, ensureLeseTabelle). Diese Datei ist die Beschreibung dazu.
-- Je Kundenbesuch EINE Zeile: Summen je Abschnitt (abschnitte = {schluessel: {t: Titel, o: Reihenfolge, s: Sekunden}}),
-- aktive Sekunden gesamt, tiefster Abschnitt. Löschung wie die Aufrufe (Migration 088): 90 Tage nach Abschluss.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_global_angebot_lesen (
  id BIGSERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL,
  besuch VARCHAR(40) NOT NULL,
  beginn TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zuletzt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sekunden INTEGER NOT NULL DEFAULT 0,
  abschnitte JSONB NOT NULL DEFAULT '{}'::jsonb,
  tiefste SMALLINT,
  anzahl SMALLINT,
  geraet TEXT,
  land VARCHAR(2),
  region TEXT,
  stadt TEXT,
  intern BOOLEAN NOT NULL DEFAULT FALSE,
  roboter BOOLEAN NOT NULL DEFAULT FALSE,
  gemeldet_sek INTEGER NOT NULL DEFAULT 0,
  gemeldet_am TIMESTAMPTZ,
  meldung_ergebnis TEXT,
  UNIQUE (angebot_id, besuch)
);
CREATE INDEX IF NOT EXISTS fiaon_global_angebot_lesen_offen_idx ON fiaon_global_angebot_lesen (zuletzt) WHERE NOT intern AND NOT roboter;
