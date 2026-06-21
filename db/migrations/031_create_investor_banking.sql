-- ============================================================================
-- SCHWARZOTT GROUP — INVESTOR BANKING
-- ============================================================================
-- Migration: 031_create_investor_banking.sql
-- Tables: investors, investor_investments, investor_transactions, investor_documents
-- SAFE: All changes use IF NOT EXISTS (idempotent, additive only).
-- ============================================================================

-- ============================================================================
-- 1. INVESTORS — account holders of the Schwarzott Group Banking portal
-- ============================================================================
CREATE TABLE IF NOT EXISTS investors (
  id              VARCHAR PRIMARY KEY,
  email           VARCHAR NOT NULL UNIQUE,
  password_hash   VARCHAR NOT NULL,                 -- scrypt: <hashHex>.<saltHex>

  salutation      VARCHAR,                          -- Herr | Frau | Divers
  first_name      VARCHAR NOT NULL,
  last_name       VARCHAR NOT NULL,
  phone           VARCHAR,
  company         VARCHAR,

  investor_type   VARCHAR NOT NULL DEFAULT 'private', -- private | institutional
  status          VARCHAR NOT NULL DEFAULT 'active',  -- active | inactive | pending

  -- Address
  street          VARCHAR,
  zip             VARCHAR,
  city            VARCHAR,
  country         VARCHAR DEFAULT 'Deutschland',

  -- Banking / tax
  iban            VARCHAR,
  tax_id          VARCHAR,

  -- Admin-only
  notes           TEXT,

  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investors_email_idx   ON investors(email);
CREATE INDEX IF NOT EXISTS investors_status_idx  ON investors(status);
CREATE INDEX IF NOT EXISTS investors_created_idx  ON investors(created_at DESC);

-- ============================================================================
-- 2. INVESTOR_INVESTMENTS — individual holdings / positions
-- ============================================================================
CREATE TABLE IF NOT EXISTS investor_investments (
  id                  SERIAL PRIMARY KEY,
  investor_id         VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  name                VARCHAR NOT NULL,             -- e.g. "FIAON Wachstums-Fonds I"
  investment_type     VARCHAR NOT NULL DEFAULT 'fund', -- equity | bond | loan | fund | real_estate | other

  principal_cents     BIGINT NOT NULL DEFAULT 0,   -- invested capital
  current_value_cents BIGINT,                       -- current valuation (NULL = use principal)
  currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',

  interest_rate       REAL,                          -- annual yield in % (Rendite p.a.)
  status              VARCHAR NOT NULL DEFAULT 'active', -- active | matured | pending | cancelled

  start_date          DATE,
  maturity_date       DATE,
  payout_frequency    VARCHAR DEFAULT 'yearly',     -- monthly | quarterly | yearly | on_maturity

  description         TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investor_investments_investor_idx ON investor_investments(investor_id);
CREATE INDEX IF NOT EXISTS investor_investments_status_idx   ON investor_investments(status);

-- ============================================================================
-- 3. INVESTOR_TRANSACTIONS — returns, payouts, deposits, fees (Rendite-Historie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS investor_transactions (
  id                SERIAL PRIMARY KEY,
  investor_id       VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  investment_id     INTEGER REFERENCES investor_investments(id) ON DELETE SET NULL,

  transaction_type  VARCHAR NOT NULL DEFAULT 'interest', -- deposit | payout | interest | fee | withdrawal
  amount_cents      BIGINT NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'EUR',

  description       VARCHAR,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  status            VARCHAR NOT NULL DEFAULT 'completed', -- completed | pending | scheduled

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investor_transactions_investor_idx ON investor_transactions(investor_id);
CREATE INDEX IF NOT EXISTS investor_transactions_invest_idx   ON investor_transactions(investment_id);
CREATE INDEX IF NOT EXISTS investor_transactions_date_idx     ON investor_transactions(transaction_date DESC);

-- ============================================================================
-- 4. INVESTOR_DOCUMENTS — contracts, statements, tax docs (Verträge & co.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS investor_documents (
  id              SERIAL PRIMARY KEY,
  investor_id     VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  investment_id   INTEGER REFERENCES investor_investments(id) ON DELETE SET NULL,

  title           VARCHAR NOT NULL,
  document_type   VARCHAR NOT NULL DEFAULT 'contract', -- contract | statement | tax | report | other

  file_name       VARCHAR,
  mime_type       VARCHAR,
  file_size       INTEGER,
  file_data       BYTEA,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investor_documents_investor_idx ON investor_documents(investor_id);

-- ============================================================================
-- ROLLBACK (manual only)
-- ============================================================================
-- DROP TABLE IF EXISTS investor_documents;
-- DROP TABLE IF EXISTS investor_transactions;
-- DROP TABLE IF EXISTS investor_investments;
-- DROP TABLE IF EXISTS investors;
