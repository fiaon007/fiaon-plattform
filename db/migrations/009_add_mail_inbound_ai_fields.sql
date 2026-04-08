-- ============================================================================
-- ARAS AI Platform - Mail Inbound AI Fields Migration
-- ============================================================================
-- Created: 2026-02-06
-- Purpose: Add AI triage, draft, and workflow fields to mail_inbound
-- ============================================================================

-- AI Classification Fields
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS ai_action TEXT;

-- Draft Response Fields
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_html TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS draft_text TEXT NOT NULL DEFAULT '';

-- Workflow Timestamps
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Assignment
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE mail_inbound ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- Update status enum to include new workflow states
-- Valid statuses: NEW, TRIAGED, DRAFT_READY, APPROVED, SENT, SEND_ERROR, CLOSED, ARCHIVED

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS mail_inbound_category_idx ON mail_inbound (category);
CREATE INDEX IF NOT EXISTS mail_inbound_priority_idx ON mail_inbound (priority);
CREATE INDEX IF NOT EXISTS mail_inbound_assigned_to_idx ON mail_inbound (assigned_to);
CREATE INDEX IF NOT EXISTS mail_inbound_triaged_at_idx ON mail_inbound (triaged_at);

-- ============================================================================
-- Verification Query:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'mail_inbound'
-- ORDER BY ordinal_position;
-- ============================================================================
