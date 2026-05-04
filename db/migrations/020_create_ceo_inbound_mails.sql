-- ============================================================================
-- CEO MIND-OS "STARK EDITION" — Shadow Inbox (E-Mail Inbound Processing)
-- Migration: 020_create_ceo_inbound_mails.sql
-- Purpose:
--   Speichert alle eingehenden E-Mails für proaktive KI-Verarbeitung:
--     - Absender, Betreff, Content-Summary
--     - AI-Action (Rechnung/Lead/Info/Todo-Erstellung)
--     - Status (new/processed/archived)
--     - Verknüpfung zu erstellten Strategien/Todos
-- ============================================================================

CREATE TABLE IF NOT EXISTS ceo_inbound_mails (
  id                VARCHAR PRIMARY KEY,
  sender            VARCHAR NOT NULL,
  sender_email      VARCHAR,
  subject           VARCHAR NOT NULL,
  content_summary   TEXT,
  full_body         TEXT,
  ai_action_taken   VARCHAR CHECK (ai_action_taken IN ('invoice','lead','info','todo_created','strategy_created','archived')),
  priority_level    VARCHAR DEFAULT 'normal' CHECK (priority_level IN ('low','normal','high','critical')),
  status            VARCHAR NOT NULL DEFAULT 'new' CHECK (status IN ('new','processing','processed','archived')),
  linked_strategy_id VARCHAR REFERENCES ceo_strategies(id) ON DELETE SET NULL,
  linked_todo_id    VARCHAR,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ceo_inbound_mails_status_idx       ON ceo_inbound_mails(status);
CREATE INDEX IF NOT EXISTS ceo_inbound_mails_priority_idx     ON ceo_inbound_mails(priority_level);
CREATE INDEX IF NOT EXISTS ceo_inbound_mails_action_idx       ON ceo_inbound_mails(ai_action_taken);
CREATE INDEX IF NOT EXISTS ceo_inbound_mails_created_at_idx   ON ceo_inbound_mails(created_at DESC);
CREATE INDEX IF NOT EXISTS ceo_inbound_mails_sender_email_idx ON ceo_inbound_mails(sender_email);
