-- ═══════════════════════════════════════════════════════════════════════════
-- 091 — DER NEUE PRIVATANTRAG /antrag-neu (05.10.2026, E-282)
--
-- Justin: „bau es jetzt unter /antrag-neu … führe Statistik darüber, ich will
-- später wissen, wie der Weg performt und wie das alte".
--
-- 1. fiaon_applications bekommt eine Marke für den Weg („neu"; NULL = alter
--    Weg), die Zusatzangaben des neuen Wegs, das Prüfergebnis und die
--    persönliche FIAON-PIN (nur als Hash, mit Fehlversuch-Sperre).
-- 2. fiaon_vertragsannahmen hält jede Annahme fest: Text, Prüfsumme,
--    Unterschrift, Haken, Zeit, Gerät. Eine Zeile je Bestellung.
-- 3. fiaon_antrag_ereignisse ist die Messung je Bildschirm und Feld — ohne
--    Inhalte, ohne IP. Löschfrist 180 Tage (Lauf im Server).
--
-- Regeln dieses Repos: nur IF NOT EXISTS, keine Fremdschlüssel, ADD COLUMN
-- ohne Vorgabewert (reine Katalogänderung, keine Tabellensperre über Minuten).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS antrag_weg VARCHAR;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS antrag_neu_daten JSONB;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS antrag_neu_pruefung JSONB;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS antrag_neu_geprueft_am TIMESTAMPTZ;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kunden_pin_hash VARCHAR;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kunden_pin_gesetzt_am TIMESTAMPTZ;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kunden_pin_geaendert_am TIMESTAMPTZ;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kunden_pin_fehlversuche SMALLINT;
ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS kunden_pin_gesperrt_bis TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fiaon_applications_antrag_weg ON fiaon_applications (antrag_weg) WHERE antrag_weg IS NOT NULL;

CREATE TABLE IF NOT EXISTS fiaon_vertragsannahmen (
  id               BIGSERIAL PRIMARY KEY,
  ref              VARCHAR NOT NULL,
  person_id        INTEGER,
  weg              VARCHAR NOT NULL,
  angenommen_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip               VARCHAR,
  user_agent       TEXT,
  paket            VARCHAR NOT NULL,
  rate_cents       INTEGER NOT NULL,
  gesamt_cents     INTEGER NOT NULL,
  ziel_limit       INTEGER,
  vertrag_fassung  VARCHAR NOT NULL,
  leistung_fassung VARCHAR NOT NULL,
  agb_fassung      VARCHAR NOT NULL,
  knopf_text       VARCHAR NOT NULL,
  haken            JSONB NOT NULL,
  sofort_beginn    BOOLEAN NOT NULL,
  unterschrift_png BYTEA,
  unterschrift_getippt BOOLEAN,
  vertrag_html     TEXT NOT NULL,
  vertrag_sha256   VARCHAR NOT NULL,
  vertrag_pdf      BYTEA,
  pdf_erstellt_am  TIMESTAMPTZ,
  bestaetigung_gesendet_am TIMESTAMPTZ,
  bestaetigung_fehler TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_vertragsannahmen_ref ON fiaon_vertragsannahmen (ref);
CREATE INDEX IF NOT EXISTS fiaon_vertragsannahmen_person ON fiaon_vertragsannahmen (person_id);

CREATE TABLE IF NOT EXISTS fiaon_antrag_ereignisse (
  id        BIGSERIAL PRIMARY KEY,
  weg       VARCHAR NOT NULL,
  sitzung   VARCHAR NOT NULL,
  ref       VARCHAR,
  schritt   VARCHAR,
  ereignis  VARCHAR NOT NULL,
  detail    VARCHAR,
  geraet    VARCHAR,
  am        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_antrag_ereignisse_weg_am ON fiaon_antrag_ereignisse (weg, am);
CREATE INDEX IF NOT EXISTS fiaon_antrag_ereignisse_sitzung ON fiaon_antrag_ereignisse (sitzung);
CREATE INDEX IF NOT EXISTS fiaon_antrag_ereignisse_ref ON fiaon_antrag_ereignisse (ref) WHERE ref IS NOT NULL;
