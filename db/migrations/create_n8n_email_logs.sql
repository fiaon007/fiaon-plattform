-- ============================================================================
-- ARAS AI Platform - N8N Email Logs Table Migration
-- ============================================================================
-- Created: 2026-01-26
-- Purpose: Add n8n_email_logs table for tracking automated email sends
-- Schema: Based on shared/schema.ts definition
-- ============================================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS n8n_email_logs (
  id SERIAL PRIMARY KEY,
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  workflow_id TEXT,
  workflow_name TEXT,
  execution_id TEXT,
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS n8n_email_logs_recipient_idx ON n8n_email_logs(recipient);
CREATE INDEX IF NOT EXISTS n8n_email_logs_workflow_idx ON n8n_email_logs(workflow_id);
CREATE INDEX IF NOT EXISTS n8n_email_logs_status_idx ON n8n_email_logs(status);
CREATE INDEX IF NOT EXISTS n8n_email_logs_sent_at_idx ON n8n_email_logs(sent_at DESC);

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the table was created successfully:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'n8n_email_logs'
-- ORDER BY ordinal_position;
-- ============================================================================
