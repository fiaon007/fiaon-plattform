-- 125 — FIAON Global: eigenes digitales Unterschreiben (E-SIGN) und vorausgefüllte Formulare je Mandat (22.10.2026)
-- Laufzeit-Gegenstück: ensureUnterschrift in server/lib/fiaon-global-unterschrift.ts (gleiche Anweisungen, idempotent).
ALTER TABLE fiaon_global_auftraege ADD COLUMN IF NOT EXISTS formular_angaben JSONB;
ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS formular_daten JSONB;
CREATE TABLE IF NOT EXISTS fiaon_global_unterschrift_codes (
  id BIGSERIAL PRIMARY KEY,
  ref VARCHAR NOT NULL,
  dokument_id BIGINT NOT NULL,
  ansicht_id BIGINT NOT NULL,
  ansicht_sha256 TEXT NOT NULL,
  unterzeichner_nr INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  zugang TEXT NOT NULL CHECK (zugang IN ('sitzung', 'link')),
  konto_email TEXT,
  sprache TEXT NOT NULL DEFAULT 'de' CHECK (sprache IN ('de', 'en')),
  zustimmung_fassung TEXT NOT NULL,
  zustimmung_sha256 TEXT NOT NULL,
  vorgang_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  gueltig_bis TIMESTAMPTZ NOT NULL,
  versuche INTEGER NOT NULL DEFAULT 0,
  neu_gesendet INTEGER NOT NULL DEFAULT 0,
  letzter_versand_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eingeloest_am TIMESTAMPTZ,
  verworfen_am TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_global_unterschrift_codes_dok_idx ON fiaon_global_unterschrift_codes (ref, dokument_id, created_at DESC);
