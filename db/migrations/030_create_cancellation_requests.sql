-- ============================================================================
-- CANCELLATION REQUESTS — Abo-Kündigungsanträge
-- ============================================================================
-- Stores subscription cancellation requests submitted by users.
-- Admin must confirm/reject before the cancellation takes effect.
-- SAFE: All changes use IF NOT EXISTS, backwards-compatible
-- ============================================================================

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id SERIAL PRIMARY KEY,

  -- Applicant info (from the fiaon_applications table)
  ref               VARCHAR NOT NULL,
  first_name        VARCHAR NOT NULL,
  last_name         VARCHAR NOT NULL,
  email             VARCHAR NOT NULL,
  phone             VARCHAR,
  package_name      VARCHAR,

  -- Cancellation details
  reason            TEXT,
  cancellation_date DATE,           -- desired effective date

  -- Status workflow: pending → confirmed | rejected
  status            VARCHAR NOT NULL DEFAULT 'pending',

  -- Admin processing
  admin_note        TEXT,
  processed_by      VARCHAR,
  processed_at      TIMESTAMP,

  -- Timestamps
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_ref    ON cancellation_requests(ref);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_email  ON cancellation_requests(email);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status ON cancellation_requests(status);
