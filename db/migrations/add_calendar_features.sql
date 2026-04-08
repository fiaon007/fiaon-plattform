-- Migration: Add Calendar Events and Call Processing Features
-- Created: 2024-12-04

-- 1. Add calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR PRIMARY KEY NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  date VARCHAR NOT NULL, -- Format: YYYY-MM-DD
  time VARCHAR NOT NULL, -- Format: HH:MM
  duration INTEGER NOT NULL DEFAULT 60, -- in minutes
  location VARCHAR,
  attendees TEXT,
  type VARCHAR NOT NULL DEFAULT 'meeting', -- call, meeting, reminder, other
  status VARCHAR NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  call_id VARCHAR, -- Reference to call_logs.id if created from call
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_call_id ON calendar_events(call_id);

-- 2. Add new fields to call_logs table
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
  ADD COLUMN IF NOT EXISTS processed_for_calendar BOOLEAN DEFAULT FALSE;

-- Index for unprocessed calls
CREATE INDEX IF NOT EXISTS idx_call_logs_processed ON call_logs(processed_for_calendar) WHERE processed_for_calendar = FALSE;

-- Grant permissions
GRANT ALL ON calendar_events TO postgres;

-- Done!
