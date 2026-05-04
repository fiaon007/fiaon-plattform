-- Migration: Add briefing cache to prevent rate limits
-- Description: Cache morning briefings for 60 minutes to avoid Groq rate limits

-- Add briefing cache columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_briefing TEXT,
  ADD COLUMN IF NOT EXISTS briefing_timestamp TIMESTAMP;

-- Add index for timestamp queries
CREATE INDEX IF NOT EXISTS users_briefing_timestamp_idx 
  ON users(briefing_timestamp DESC);

-- Add comment for documentation
COMMENT ON COLUMN users.last_briefing IS 'Cached morning briefing content (JSON)';
COMMENT ON COLUMN users.briefing_timestamp IS 'Timestamp of last briefing generation';
