-- ============================================================================
-- ACCOUNTING MODULE - Company Financial Management
-- ============================================================================
-- Migration: 029_create_accounting.sql
-- Tables: accounting_balance, accounting_entries
-- SAFE: All changes use IF NOT EXISTS
-- ============================================================================

-- ============================================================================
-- 1. ACCOUNTING BALANCE TABLE (single row = company balance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounting_balance (
  id SERIAL PRIMARY KEY,
  balance_cents BIGINT NOT NULL DEFAULT 5500000,  -- 55.000 EUR in cents
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  note TEXT,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by VARCHAR
);

-- Seed initial balance row if none exists
INSERT INTO accounting_balance (balance_cents, currency, note)
SELECT 5500000, 'EUR', 'Startkontostand'
WHERE NOT EXISTS (SELECT 1 FROM accounting_balance);

-- ============================================================================
-- 2. ACCOUNTING ENTRIES TABLE (all financial transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id SERIAL PRIMARY KEY,

  -- Type: expense_recurring | expense_onetime | income | withdrawal | investment | transfer
  entry_type VARCHAR NOT NULL DEFAULT 'expense_onetime',

  -- Category
  category VARCHAR NOT NULL DEFAULT 'misc',
  -- Values: software, salary, marketing, office, legal, infrastructure, hosting,
  --         tax, insurance, consulting, misc, revenue, client_payment, investment, other

  title VARCHAR NOT NULL,
  description TEXT,

  -- Amount in cents (always positive, direction determined by entry_type)
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Date of transaction / due date
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- For recurring expenses
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  frequency VARCHAR,  -- daily | weekly | monthly | quarterly | yearly

  -- Lifecycle
  status VARCHAR NOT NULL DEFAULT 'planned',  -- planned | paid | cancelled | overdue

  -- Payment tracking
  payment_method VARCHAR,   -- bank_transfer | direct_debit | credit_card | paypal | stripe | cash
  payment_reference VARCHAR,
  vendor VARCHAR,
  invoice_number VARCHAR,

  -- Flexible metadata
  tags TEXT[],
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS accounting_entries_type_idx ON accounting_entries(entry_type);
CREATE INDEX IF NOT EXISTS accounting_entries_category_idx ON accounting_entries(category);
CREATE INDEX IF NOT EXISTS accounting_entries_date_idx ON accounting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS accounting_entries_status_idx ON accounting_entries(status);

-- ============================================================================
-- SEED: Example entries for realistic starting state
-- ============================================================================
INSERT INTO accounting_entries (entry_type, category, title, description, amount_cents, entry_date, is_recurring, frequency, status, vendor, payment_method)
SELECT 'expense_recurring', 'hosting', 'Render.com Hosting', 'Production Server', 2900, CURRENT_DATE, TRUE, 'monthly', 'paid', 'Render', 'credit_card'
WHERE NOT EXISTS (SELECT 1 FROM accounting_entries WHERE title = 'Render.com Hosting');

INSERT INTO accounting_entries (entry_type, category, title, description, amount_cents, entry_date, is_recurring, frequency, status, vendor, payment_method)
SELECT 'expense_recurring', 'software', 'OpenAI API', 'GPT-4o + Embeddings', 15000, CURRENT_DATE, TRUE, 'monthly', 'paid', 'OpenAI', 'credit_card'
WHERE NOT EXISTS (SELECT 1 FROM accounting_entries WHERE title = 'OpenAI API');

INSERT INTO accounting_entries (entry_type, category, title, description, amount_cents, entry_date, is_recurring, frequency, status, vendor, payment_method)
SELECT 'expense_recurring', 'software', 'Retell AI', 'Voice Agent Platform', 8900, CURRENT_DATE, TRUE, 'monthly', 'paid', 'Retell AI', 'credit_card'
WHERE NOT EXISTS (SELECT 1 FROM accounting_entries WHERE title = 'Retell AI');

INSERT INTO accounting_entries (entry_type, category, title, description, amount_cents, entry_date, is_recurring, frequency, status, vendor, payment_method)
SELECT 'expense_recurring', 'software', 'Gemini API', 'Google AI Services', 3500, CURRENT_DATE, TRUE, 'monthly', 'paid', 'Google', 'credit_card'
WHERE NOT EXISTS (SELECT 1 FROM accounting_entries WHERE title = 'Gemini API');

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP TABLE IF EXISTS accounting_entries;
-- DROP TABLE IF EXISTS accounting_balance;
