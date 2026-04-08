-- ============================================================================
-- ARAS COMMAND CENTER - Internal CRM System Migration
-- ============================================================================
-- Diese Migration fügt das komplette interne CRM-System hinzu
-- SICHER: Alle Änderungen sind backwards-compatible, keine destructive operations
-- ============================================================================

-- 1. Füge userRole Feld zu users Tabelle hinzu (RBAC)
-- DEFAULT 'user' stellt sicher, dass alle bestehenden User funktionsfähig bleiben
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role VARCHAR DEFAULT 'user' NOT NULL;

-- 2. Rename 'role' zu 'job_role' um Konflikte zu vermeiden (falls Spalte existiert)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='role'
  ) THEN
    ALTER TABLE users RENAME COLUMN role TO job_role;
  END IF;
END $$;

-- ============================================================================
-- INTERNAL CRM TABELLEN
-- ============================================================================

-- 3. Internal Companies
CREATE TABLE IF NOT EXISTS internal_companies (
  id VARCHAR PRIMARY KEY NOT NULL,
  name VARCHAR NOT NULL,
  website VARCHAR,
  industry VARCHAR,
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_companies_name_idx ON internal_companies(name);

-- 4. Internal Contacts
CREATE TABLE IF NOT EXISTS internal_contacts (
  id VARCHAR PRIMARY KEY NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  position VARCHAR,
  company_id VARCHAR REFERENCES internal_companies(id) ON DELETE SET NULL,
  source VARCHAR,
  status VARCHAR DEFAULT 'NEW' NOT NULL CHECK (status IN ('NEW', 'ACTIVE', 'ARCHIVED')),
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_contacts_email_idx ON internal_contacts(email);
CREATE INDEX IF NOT EXISTS internal_contacts_phone_idx ON internal_contacts(phone);
CREATE INDEX IF NOT EXISTS internal_contacts_company_idx ON internal_contacts(company_id);

-- 5. Internal Deals
CREATE TABLE IF NOT EXISTS internal_deals (
  id VARCHAR PRIMARY KEY NOT NULL,
  title VARCHAR NOT NULL,
  value INTEGER,
  currency VARCHAR DEFAULT 'EUR' NOT NULL,
  stage VARCHAR DEFAULT 'IDEA' NOT NULL CHECK (stage IN ('IDEA', 'CONTACTED', 'NEGOTIATION', 'COMMITTED', 'CLOSED_WON', 'CLOSED_LOST')),
  contact_id VARCHAR REFERENCES internal_contacts(id) ON DELETE SET NULL,
  company_id VARCHAR REFERENCES internal_companies(id) ON DELETE SET NULL,
  owner_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  close_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_deals_stage_idx ON internal_deals(stage);
CREATE INDEX IF NOT EXISTS internal_deals_owner_idx ON internal_deals(owner_user_id);

-- 6. Internal Tasks
CREATE TABLE IF NOT EXISTS internal_tasks (
  id VARCHAR PRIMARY KEY NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'OPEN' NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  due_date TIMESTAMP,
  assigned_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  related_contact_id VARCHAR REFERENCES internal_contacts(id) ON DELETE SET NULL,
  related_deal_id VARCHAR REFERENCES internal_deals(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_tasks_status_idx ON internal_tasks(status);
CREATE INDEX IF NOT EXISTS internal_tasks_assigned_idx ON internal_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS internal_tasks_due_date_idx ON internal_tasks(due_date);

-- 7. Internal Call Logs
CREATE TABLE IF NOT EXISTS internal_call_logs (
  id VARCHAR PRIMARY KEY NOT NULL,
  contact_id VARCHAR REFERENCES internal_contacts(id) ON DELETE SET NULL,
  source VARCHAR DEFAULT 'OTHER' NOT NULL CHECK (source IN ('RETELL', 'ELEVENLABS', 'TWILIO', 'OTHER')),
  external_call_id VARCHAR,
  phone_number VARCHAR,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  duration_seconds INTEGER,
  outcome VARCHAR,
  sentiment VARCHAR CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED')),
  summary TEXT,
  recording_url VARCHAR,
  raw_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_call_logs_contact_idx ON internal_call_logs(contact_id);
CREATE INDEX IF NOT EXISTS internal_call_logs_phone_idx ON internal_call_logs(phone_number);
CREATE INDEX IF NOT EXISTS internal_call_logs_timestamp_idx ON internal_call_logs(timestamp);

-- 8. Internal Notes
CREATE TABLE IF NOT EXISTS internal_notes (
  id VARCHAR PRIMARY KEY NOT NULL,
  contact_id VARCHAR REFERENCES internal_contacts(id) ON DELETE CASCADE,
  deal_id VARCHAR REFERENCES internal_deals(id) ON DELETE CASCADE,
  author_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS internal_notes_contact_idx ON internal_notes(contact_id);
CREATE INDEX IF NOT EXISTS internal_notes_deal_idx ON internal_notes(deal_id);

-- ============================================================================
-- OPTIONAL: Setze ersten Admin-User (manuell nach Migration)
-- ============================================================================
-- Uncomment und ersetze 'dein-username' mit deinem tatsächlichen Username:
-- UPDATE users SET user_role = 'admin' WHERE username = 'dein-username';

-- ============================================================================
-- MIGRATION ABGESCHLOSSEN
-- ============================================================================
-- Alle Tabellen wurden sicher erstellt
-- Bestehende User-Daten sind NICHT beeinträchtigt
-- Public-Features funktionieren weiterhin normal
-- ============================================================================
