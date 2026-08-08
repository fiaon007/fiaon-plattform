-- ═══════════════════════════════════════════════════════════════════════════
-- 040 — Der Zahlungsbeleg gehört ins System, nicht in die WhatsApp-Gruppe
--
-- Heute läuft „lass dir ein Bild der Überweisung schicken" über eine
-- WhatsApp-Gruppe. Das Bild ist zehn Minuten später nicht mehr auffindbar, und
-- wer bucht, bucht auf Zuruf. Genau dieser Weg hat die Buchung ohne Nachweis
-- normalisiert.
--
-- Ablage wie bei den KYC-Unterlagen: rohe Bytes in der Datenbank (BYTEA), kein
-- externer Speicher. Das ist die bestehende Praxis (`id_card_pdf`,
-- `bank_statement_pdf`, `schufa_pdf`) und hat den Vorteil, dass ein Beleg nicht
-- ohne die Bestellung existieren kann.
--
-- `payment_proof_date` ist PFLICHT beim Upload (in der Anwendung erzwungen):
-- Ein Beleg ohne das Überweisungsdatum laut Beleg beantwortet die wichtigste
-- Frage nicht — WANN das Geld losgeschickt wurde.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS payment_proof        BYTEA,
  ADD COLUMN IF NOT EXISTS payment_proof_typ    VARCHAR,
  ADD COLUMN IF NOT EXISTS payment_proof_name   VARCHAR,
  ADD COLUMN IF NOT EXISTS payment_proof_bytes  INTEGER,
  ADD COLUMN IF NOT EXISTS payment_proof_date   DATE,
  ADD COLUMN IF NOT EXISTS payment_proof_note   TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_by     TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_by_agent_id INTEGER,
  ADD COLUMN IF NOT EXISTS payment_proof_at     TIMESTAMPTZ;

-- Teilindex: gefragt wird immer „welche Bestellung hat einen Beleg?".
CREATE INDEX IF NOT EXISTS fiaon_app_zahlungsbeleg_idx
  ON fiaon_applications (payment_proof_at)
  WHERE payment_proof_at IS NOT NULL;
