-- ============================================================================
-- ARAS AI Platform - Mail Inbound Table Migration
-- ============================================================================
-- Created: 2026-02-05
-- Purpose: Add mail_inbound table for Gmail intake via n8n webhook
-- Schema: Based on shared/schema.ts definition
-- ============================================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS mail_inbound (
  id SERIAL PRIMARY KEY,
  
  -- Source identification
  source TEXT NOT NULL DEFAULT 'gmail',
  message_id TEXT NOT NULL,
  thread_id TEXT,
  mailbox TEXT,
  
  -- Sender info
  from_email TEXT NOT NULL,
  from_name TEXT,
  
  -- Recipients (JSONB arrays)
  to_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Email content
  subject TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  
  -- Timing
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Labels & status
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'NEW',
  
  -- Extensible metadata
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create unique constraint for idempotency (source + mailbox + message_id)
-- Using a unique index to handle NULL mailbox values correctly
CREATE UNIQUE INDEX IF NOT EXISTS mail_inbound_idempotent_idx 
  ON mail_inbound (source, COALESCE(mailbox, ''), message_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS mail_inbound_received_at_idx ON mail_inbound (received_at DESC);
CREATE INDEX IF NOT EXISTS mail_inbound_status_idx ON mail_inbound (status);
CREATE INDEX IF NOT EXISTS mail_inbound_from_email_idx ON mail_inbound (from_email);
CREATE INDEX IF NOT EXISTS mail_inbound_mailbox_idx ON mail_inbound (mailbox);

-- ============================================================================
-- Rollback (if needed):
-- DROP TABLE IF EXISTS mail_inbound;
-- ============================================================================

-- ============================================================================
-- Verification Query:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'mail_inbound'
-- ORDER BY ordinal_position;
-- ============================================================================
