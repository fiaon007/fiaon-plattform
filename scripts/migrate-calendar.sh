#!/bin/bash

# 🚀 Calendar Migration Script
# Automatisch calendar_events Tabelle erstellen

echo "🚀 ARAS AI Calendar Migration"
echo "=============================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    echo ""
    echo "Please set DATABASE_URL environment variable:"
    echo "  export DATABASE_URL='postgresql://...'"
    echo ""
    echo "Get it from: Render Dashboard → Database → Connection String"
    exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Run migration
echo "🔧 Running migration..."
echo ""

psql "$DATABASE_URL" << 'EOF'

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR PRIMARY KEY NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT,
  date VARCHAR NOT NULL,
  time VARCHAR NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  location VARCHAR,
  attendees TEXT,
  type VARCHAR NOT NULL DEFAULT 'meeting',
  status VARCHAR NOT NULL DEFAULT 'scheduled',
  call_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_call_id ON calendar_events(call_id);

-- Extend call_logs
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
  ADD COLUMN IF NOT EXISTS processed_for_calendar BOOLEAN DEFAULT FALSE;

-- Index for unprocessed calls
CREATE INDEX IF NOT EXISTS idx_call_logs_processed 
  ON call_logs(processed_for_calendar) 
  WHERE processed_for_calendar = FALSE;

-- Verify
SELECT 
  'calendar_events' as table_name,
  COUNT(*) as row_count
FROM calendar_events
UNION ALL
SELECT 
  'call_logs_extended' as info,
  COUNT(*) as count
FROM call_logs
WHERE processed_for_calendar IS NOT NULL;

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration successful!"
    echo ""
    echo "Next steps:"
    echo "  1. Open: https://arasai.onrender.com/app/calendar"
    echo "  2. Page should load now! 🎉"
    echo "  3. Create a test event"
    echo "  4. Verify it appears in the calendar"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo ""
    echo "Try running the SQL manually:"
    echo "  psql \$DATABASE_URL < db/migrations/add_calendar_features.sql"
    echo ""
    exit 1
fi
