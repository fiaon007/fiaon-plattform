-- E-421 (22.10.2026): Monatsbericht an den Kooperationspartner — einmal je Partner und Monat.
-- Dieselbe DDL steht in server/lib/fiaon-koop-empfehlung.ts (ensureMonatsberichtTabelle). Additiv.
CREATE TABLE IF NOT EXISTS fiaon_koop_monatsberichte (
  id BIGSERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL,
  monat VARCHAR(7) NOT NULL,
  versuche INTEGER NOT NULL DEFAULT 1,
  gesendet_am TIMESTAMPTZ,
  ergebnis TEXT,
  gutschrift_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (angebot_id, monat)
);
