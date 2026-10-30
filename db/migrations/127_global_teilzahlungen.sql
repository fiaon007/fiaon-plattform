-- 127 — FIAON Global: Teilzahlungen einer Rechnung (E-469, 30.10.2026)
-- Laufzeit-Gegenstück: ensureTeilzahlungen in server/lib/fiaon-teilzahlung.ts (gleiche Anweisungen, idempotent).
-- Eine Zeile je Bankeingang, der als Teil einer Global-Rechnung gebucht wurde. Ein Eingang zählt nie zweimal
-- (UNIQUE bank_txn_id und txn_id); höchstens eine Zeile je Rechnung schließt sie ab (Teil-Index).
CREATE TABLE IF NOT EXISTS fiaon_teilzahlungen (
  id BIGSERIAL PRIMARY KEY,
  ref VARCHAR NOT NULL,
  payment_reference VARCHAR,
  rechnungsnummer VARCHAR,
  bank_txn_id INTEGER NOT NULL UNIQUE,
  txn_id VARCHAR NOT NULL UNIQUE,
  betrag_cents INTEGER NOT NULL CHECK (betrag_cents > 0),
  eingang_am DATE NOT NULL,
  soll_cents INTEGER NOT NULL CHECK (soll_cents > 0),
  summe_nachher_cents INTEGER NOT NULL,
  schliesst_ab BOOLEAN NOT NULL DEFAULT FALSE,
  gebucht_von TEXT NOT NULL,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (summe_nachher_cents <= soll_cents)
);
CREATE INDEX IF NOT EXISTS fiaon_teilzahlungen_ref_idx ON fiaon_teilzahlungen (ref);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_teilzahlungen_ein_abschluss ON fiaon_teilzahlungen (ref) WHERE schliesst_ab;
-- E-469 Nachtrag: Storno MIT Erstattung — die Teilzahlung zählt ab da nicht mehr als Umsatz.
ALTER TABLE fiaon_teilzahlungen ADD COLUMN IF NOT EXISTS erstattung_am TIMESTAMPTZ;
