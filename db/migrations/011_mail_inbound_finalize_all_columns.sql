-- ============================================================================
-- ARAS AI Platform - Mail Inbound: Finalize All Columns
-- ============================================================================
-- Created: 2026-02-06
-- Purpose: Ensure EVERY column from shared/schema.ts exists in prod DB.
--          Migrations 009/010 may have partially failed; this is the catch-all.
--          100% additive, 100% safe (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- === AI Classification ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_confidence REAL;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_action TEXT;

-- === Draft Response ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_html TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_text TEXT NOT NULL DEFAULT '';

-- === Workflow Timestamps & Actors ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS triaged_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS sent_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMP WITH TIME ZONE;

-- === Error Handling ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS error_message TEXT;

-- === Clarification Workflow ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS needs_clarification BOOLEAN DEFAULT FALSE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS clarifying_questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS operator_notes TEXT NOT NULL DEFAULT '';

-- === Assignment & Notes ===
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- === Contact Link ===
-- contact_id is VARCHAR to match internal_contacts.id (varchar PK)
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS contact_id VARCHAR;

-- FK constraint only if internal_contacts table exists and constraint not yet present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='internal_contacts')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'mail_inbound_contact_fk'
     )
  THEN
    ALTER TABLE mail_inbound
      ADD CONSTRAINT mail_inbound_contact_fk
      FOREIGN KEY (contact_id) REFERENCES internal_contacts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- === Indexes (all IF NOT EXISTS) ===
CREATE INDEX IF NOT EXISTS mail_inbound_status_idx ON mail_inbound(status);
CREATE INDEX IF NOT EXISTS mail_inbound_from_email_idx ON mail_inbound(from_email);
CREATE INDEX IF NOT EXISTS mail_inbound_thread_idx ON mail_inbound(thread_id);
CREATE INDEX IF NOT EXISTS mail_inbound_contact_id_idx ON mail_inbound(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mail_inbound_last_action_at_idx ON mail_inbound(last_action_at);
CREATE INDEX IF NOT EXISTS mail_inbound_category_idx ON mail_inbound(category);
CREATE INDEX IF NOT EXISTS mail_inbound_priority_idx ON mail_inbound(priority);
CREATE INDEX IF NOT EXISTS mail_inbound_error_code_idx ON mail_inbound(error_code) WHERE error_code IS NOT NULL;

-- === Unique index for message_id idempotency ===
CREATE UNIQUE INDEX IF NOT EXISTS mail_inbound_message_id_uq ON mail_inbound(message_id);

-- ============================================================================
-- Verification:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mail_inbound'
-- ORDER BY ordinal_position;
-- ============================================================================
