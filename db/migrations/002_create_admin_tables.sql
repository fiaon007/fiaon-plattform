-- =====================================================
-- ARAS Admin Dashboard - Neue Tabellen
-- Migration: 002_create_admin_tables.sql
-- Datum: 2026-01-26
-- SICHER: Verwendet IF NOT EXISTS überall
-- =====================================================

-- =====================================================
-- 1. ADMIN NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  recipient_id TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  icon TEXT,
  color TEXT,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indizes für admin_notifications
CREATE INDEX IF NOT EXISTS admin_notifications_recipient_idx 
  ON admin_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS admin_notifications_read_idx 
  ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS admin_notifications_created_idx 
  ON admin_notifications(created_at DESC);

-- =====================================================
-- 2. ADMIN ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id SERIAL PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  actor_avatar TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  action_category TEXT NOT NULL,
  action_icon TEXT,
  action_color TEXT,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  target_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  ai_insight TEXT,
  ai_priority TEXT,
  ai_suggestion TEXT,
  ai_processed_at TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  geo_location TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indizes für admin_activity_log
CREATE INDEX IF NOT EXISTS admin_activity_log_actor_idx 
  ON admin_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS admin_activity_log_category_idx 
  ON admin_activity_log(action_category);
CREATE INDEX IF NOT EXISTS admin_activity_log_created_idx 
  ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_log_target_idx 
  ON admin_activity_log(target_type, target_id);

-- =====================================================
-- 3. VERIFICATION QUERIES
-- =====================================================
-- Nach dem Ausführen sollten diese Queries funktionieren:
-- SELECT COUNT(*) FROM admin_notifications;
-- SELECT COUNT(*) FROM admin_activity_log;

-- =====================================================
-- DONE
-- =====================================================
