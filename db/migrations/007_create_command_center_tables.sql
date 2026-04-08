-- ============================================================================
-- ARAS COMMAND CENTER - Team Collaboration Tables Migration
-- ============================================================================
-- Creates tables for Team Feed, Calendar, Todos, and Chat
-- SAFE: Uses IF NOT EXISTS for all operations
-- ============================================================================

-- ============================================================================
-- 1. TEAM FEED - Real-time activity stream
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_feed (
  id SERIAL PRIMARY KEY,
  author_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'update', 'announcement', 'system')),
  title VARCHAR,
  content TEXT NOT NULL,
  entity_type VARCHAR,
  entity_id VARCHAR,
  metadata JSONB DEFAULT '{}'::jsonb,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_feed_author_idx ON team_feed(author_user_id);
CREATE INDEX IF NOT EXISTS team_feed_type_idx ON team_feed(type);
CREATE INDEX IF NOT EXISTS team_feed_created_idx ON team_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS team_feed_pinned_idx ON team_feed(pinned) WHERE pinned = TRUE;

-- ============================================================================
-- 2. TEAM CALENDAR - Shared calendar events
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_calendar (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  all_day BOOLEAN DEFAULT FALSE,
  location VARCHAR,
  type VARCHAR DEFAULT 'meeting' CHECK (type IN ('meeting', 'call', 'deadline', 'reminder', 'other')),
  attendee_user_ids JSONB DEFAULT '[]'::jsonb,
  created_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color VARCHAR DEFAULT '#FE9100',
  recurring VARCHAR CHECK (recurring IN ('daily', 'weekly', 'monthly', 'yearly')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_calendar_start_idx ON team_calendar(start_time);
CREATE INDEX IF NOT EXISTS team_calendar_created_by_idx ON team_calendar(created_by_user_id);
CREATE INDEX IF NOT EXISTS team_calendar_type_idx ON team_calendar(type);

-- ============================================================================
-- 3. TEAM TODOS - Shared task management
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_todos (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  priority VARCHAR DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP,
  assigned_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP,
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_todos_status_idx ON team_todos(status);
CREATE INDEX IF NOT EXISTS team_todos_assigned_idx ON team_todos(assigned_user_id);
CREATE INDEX IF NOT EXISTS team_todos_created_by_idx ON team_todos(created_by_user_id);
CREATE INDEX IF NOT EXISTS team_todos_due_date_idx ON team_todos(due_date);
CREATE INDEX IF NOT EXISTS team_todos_priority_idx ON team_todos(priority);

-- ============================================================================
-- 4. TEAM CHAT CHANNELS - Chat rooms/channels
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_chat_channels (
  id VARCHAR PRIMARY KEY NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  type VARCHAR DEFAULT 'public' CHECK (type IN ('public', 'private', 'dm')),
  created_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_chat_channels_type_idx ON team_chat_channels(type);
CREATE INDEX IF NOT EXISTS team_chat_channels_created_idx ON team_chat_channels(created_at);

-- ============================================================================
-- 5. TEAM CHAT MESSAGES - Chat messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR NOT NULL REFERENCES team_chat_channels(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id INTEGER REFERENCES team_chat_messages(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  reactions JSONB DEFAULT '{}'::jsonb,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_chat_messages_channel_idx ON team_chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS team_chat_messages_user_idx ON team_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS team_chat_messages_created_idx ON team_chat_messages(created_at DESC);

-- ============================================================================
-- 6. TEAM CHAT CHANNEL MEMBERS - Channel membership
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_chat_channel_members (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR NOT NULL REFERENCES team_chat_channels(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  last_read_at TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_chat_members_channel_idx ON team_chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS team_chat_members_user_idx ON team_chat_channel_members(user_id);

-- ============================================================================
-- 7. CREATE DEFAULT GENERAL CHANNEL
-- ============================================================================
INSERT INTO team_chat_channels (id, name, description, type, created_at, updated_at)
VALUES ('channel_general', 'General', 'Team-wide announcements and discussions', 'public', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All Command Center tables created safely
-- Run with: npx tsx scripts/run-command-center-migration.ts
-- ============================================================================
