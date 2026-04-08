-- ============================================================================
-- ARAS AI Platform - Mail Inbound: Add received_at sort index
-- ============================================================================
-- Created: 2026-02-06
-- Purpose: Composite index for the primary list query (status + received_at)
-- ============================================================================

CREATE INDEX IF NOT EXISTS mail_inbound_received_at_idx
  ON mail_inbound(received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS mail_inbound_status_received_idx
  ON mail_inbound(status, received_at DESC NULLS LAST);
