-- 028_add_profile_fields.sql
-- Erweiterte KYC-Profilfelder: frühere Anschriften, Reisedokument, Einkommen, Ausgaben

ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS moved_recently           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS previous_street          VARCHAR,
  ADD COLUMN IF NOT EXISTS previous_zip             VARCHAR,
  ADD COLUMN IF NOT EXISTS previous_city            VARCHAR,
  ADD COLUMN IF NOT EXISTS previous_country         VARCHAR DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS passport_number          VARCHAR,
  ADD COLUMN IF NOT EXISTS passport_expiry          DATE,
  ADD COLUMN IF NOT EXISTS has_additional_income    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS additional_income_sources TEXT,
  ADD COLUMN IF NOT EXISTS additional_income_amount INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_food            INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_transport       INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_insurance       INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_loans           INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_subscriptions   INTEGER,
  ADD COLUMN IF NOT EXISTS expenses_other           INTEGER,
  ADD COLUMN IF NOT EXISTS profile_completed_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_profile_note       TEXT,
  ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE;
