-- ============================================================================
-- ARAS AI Platform - Mail Inbound Workflow Hardening
-- ============================================================================
-- Created: 2026-02-06
-- Purpose: Add missing workflow columns for full status machine support
-- Reversible: Yes (all additive, nullable columns)
-- ============================================================================

-- Workflow actor columns (who performed each action)
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS triaged_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS sent_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMP WITH TIME ZONE;

-- AI Classification Fields (from migration 009, ensure exist)
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_action TEXT;

-- Error handling columns
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Clarification workflow columns
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS needs_clarification BOOLEAN DEFAULT FALSE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS clarifying_questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS operator_notes TEXT NOT NULL DEFAULT '';

-- Contact link column
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS contact_id VARCHAR REFERENCES internal_contacts(id);

-- Indexes for workflow queries
CREATE INDEX IF NOT EXISTS mail_inbound_last_action_at_idx ON mail_inbound (last_action_at);
CREATE INDEX IF NOT EXISTS mail_inbound_needs_clarification_idx ON mail_inbound (needs_clarification) WHERE needs_clarification = TRUE;
CREATE INDEX IF NOT EXISTS mail_inbound_error_code_idx ON mail_inbound (error_code) WHERE error_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS mail_inbound_contact_id_idx ON mail_inbound (contact_id) WHERE contact_id IS NOT NULL;

-- ============================================================================
-- STATUS VALUES REFERENCE (for documentation):
-- NEW       - Just received, unread
-- OPEN      - Opened/viewed by operator
-- TRIAGED   - AI classification complete, draft ready
-- APPROVED  - Human approved, ready to send
-- SENDING   - Send in progress (transient)
-- SENT      - Successfully sent
-- ERROR     - Send failed, retry available
-- ARCHIVED  - Terminal state, no further action
-- ============================================================================

-- ============================================================================
-- Verification Query:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'mail_inbound'
--   AND column_name IN ('triaged_by','sent_by','archived_at','archived_by',
--                       'last_action_at','error_code','error_message',
--                       'needs_clarification','clarifying_questions','operator_notes')
-- ORDER BY column_name;
-- ============================================================================
