#!/usr/bin/env node

/**
 * 🚀 ARAS AI Calendar Migration Script
 * Automatically creates calendar_events table
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

console.log('🚀 ARAS AI Calendar Migration');
console.log('==============================\n');

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is not set!\n');
  console.log('Please set DATABASE_URL in your .env file:');
  console.log('  DATABASE_URL=postgresql://...\n');
  console.log('Get it from: Render Dashboard → Database → Connection String\n');
  process.exit(1);
}

console.log('✅ DATABASE_URL found');
console.log('🔧 Running migration...\n');

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: 'require'
});

async function migrate() {
  try {
    // Create calendar_events table
    await sql`
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
      )
    `;
    console.log('✅ calendar_events table created');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id 
      ON calendar_events(user_id)
    `;
    console.log('✅ Index on user_id created');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_date 
      ON calendar_events(date)
    `;
    console.log('✅ Index on date created');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_call_id 
      ON calendar_events(call_id)
    `;
    console.log('✅ Index on call_id created');

    // Extend call_logs table
    try {
      await sql`
        ALTER TABLE call_logs 
        ADD COLUMN IF NOT EXISTS contact_name VARCHAR
      `;
      console.log('✅ call_logs.contact_name added');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  call_logs.contact_name already exists');
      } else {
        throw err;
      }
    }

    try {
      await sql`
        ALTER TABLE call_logs 
        ADD COLUMN IF NOT EXISTS processed_for_calendar BOOLEAN DEFAULT FALSE
      `;
      console.log('✅ call_logs.processed_for_calendar added');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  call_logs.processed_for_calendar already exists');
      } else {
        throw err;
      }
    }

    // Create index on processed_for_calendar
    await sql`
      CREATE INDEX IF NOT EXISTS idx_call_logs_processed 
      ON call_logs(processed_for_calendar) 
      WHERE processed_for_calendar = FALSE
    `;
    console.log('✅ Index on processed_for_calendar created');

    // Verify
    const eventCount = await sql`
      SELECT COUNT(*) as count FROM calendar_events
    `;
    console.log(`\n📊 calendar_events: ${eventCount[0].count} rows`);

    const callsExtended = await sql`
      SELECT COUNT(*) as count 
      FROM call_logs 
      WHERE processed_for_calendar IS NOT NULL
    `;
    console.log(`📊 call_logs extended: ${callsExtended[0].count} rows`);

    console.log('\n✅ Migration successful!\n');
    console.log('Next steps:');
    console.log('  1. Open: https://arasai.onrender.com/app/calendar');
    console.log('  2. Page should load now! 🎉');
    console.log('  3. Create a test event');
    console.log('  4. Verify it appears in the calendar\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nPlease check:');
    console.error('  1. DATABASE_URL is correct');
    console.error('  2. Database is accessible');
    console.error('  3. User has CREATE TABLE permissions\n');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
