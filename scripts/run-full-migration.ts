/**
 * ============================================================================
 * ARAS COMMAND CENTER - FULL IDEMPOTENT MIGRATION
 * ============================================================================
 * Handles ALL missing tables and columns for Command Center + Chat
 * Safe to run multiple times - uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
 * 
 * Run with: npx tsx scripts/run-full-migration.ts
 * ============================================================================
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigration() {
  console.log('🚀 ARAS Command Center - Full Migration\n');
  console.log('=' .repeat(60));

  try {
    // ========================================================================
    // 1. TEAM FEED TABLE - Fix author_user_id column
    // ========================================================================
    console.log('\n📋 1. TEAM FEED TABLE');
    console.log('-'.repeat(40));
    
    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS public.team_feed (
        id SERIAL PRIMARY KEY,
        author_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR NOT NULL DEFAULT 'note',
        message TEXT,
        category VARCHAR,
        target_type VARCHAR,
        target_id VARCHAR,
        target_name VARCHAR,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✓ team_feed table ensured');

    // Add missing columns with compatibility
    const feedColumns = [
      { name: 'author_user_id', type: 'VARCHAR REFERENCES users(id) ON DELETE CASCADE' },
      { name: 'message', type: 'TEXT' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'target_type', type: 'VARCHAR' },
      { name: 'target_id', type: 'VARCHAR' },
      { name: 'target_name', type: 'VARCHAR' },
      { name: 'metadata', type: "JSONB DEFAULT '{}'::jsonb" },
    ];

    for (const col of feedColumns) {
      try {
        await sql.unsafe(`
          ALTER TABLE public.team_feed 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✓ Column ${col.name} ensured`);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.log(`  ⚠ Column ${col.name}: ${e.message}`);
        }
      }
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS team_feed_author_idx ON public.team_feed(author_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS team_feed_created_idx ON public.team_feed(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS team_feed_type_idx ON public.team_feed(type)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 2. TEAM CALENDAR TABLE
    // ========================================================================
    console.log('\n📋 2. TEAM CALENDAR TABLE');
    console.log('-'.repeat(40));

    await sql`
      CREATE TABLE IF NOT EXISTS public.team_calendar (
        id SERIAL PRIMARY KEY,
        title VARCHAR NOT NULL,
        description TEXT,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        all_day BOOLEAN DEFAULT false,
        location VARCHAR,
        event_type VARCHAR DEFAULT 'meeting',
        attendee_ids JSONB DEFAULT '[]'::jsonb,
        color VARCHAR DEFAULT '#FE9100',
        created_by_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✓ team_calendar table ensured');

    await sql`CREATE INDEX IF NOT EXISTS team_calendar_starts_idx ON public.team_calendar(starts_at)`;
    await sql`CREATE INDEX IF NOT EXISTS team_calendar_created_by_idx ON public.team_calendar(created_by_user_id)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 3. TEAM TODOS TABLE
    // ========================================================================
    console.log('\n📋 3. TEAM TODOS TABLE');
    console.log('-'.repeat(40));

    await sql`
      CREATE TABLE IF NOT EXISTS public.team_todos (
        id SERIAL PRIMARY KEY,
        title VARCHAR NOT NULL,
        description TEXT,
        status VARCHAR DEFAULT 'pending' NOT NULL,
        priority VARCHAR DEFAULT 'medium',
        due_at TIMESTAMPTZ,
        assigned_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_by_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ,
        tags JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✓ team_todos table ensured');

    await sql`CREATE INDEX IF NOT EXISTS team_todos_status_idx ON public.team_todos(status)`;
    await sql`CREATE INDEX IF NOT EXISTS team_todos_assigned_idx ON public.team_todos(assigned_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS team_todos_due_idx ON public.team_todos(due_at)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 4. TEAM CHAT CHANNELS TABLE
    // ========================================================================
    console.log('\n📋 4. TEAM CHAT CHANNELS TABLE');
    console.log('-'.repeat(40));

    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_channels (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR NOT NULL,
        slug VARCHAR,
        description TEXT,
        type VARCHAR DEFAULT 'public',
        is_private BOOLEAN DEFAULT false,
        created_by VARCHAR,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✓ team_chat_channels table ensured');

    // Add missing columns
    const chatChannelColumns = [
      { name: 'slug', type: 'VARCHAR' },
      { name: 'description', type: 'TEXT' },
      { name: 'type', type: "VARCHAR DEFAULT 'public'" },
      { name: 'is_private', type: 'BOOLEAN DEFAULT false' },
      { name: 'created_by', type: 'VARCHAR' },
      { name: 'meta', type: "JSONB DEFAULT '{}'::jsonb" },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT now()' },
    ];

    for (const col of chatChannelColumns) {
      try {
        await sql.unsafe(`
          ALTER TABLE public.team_chat_channels 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✓ Column ${col.name} ensured`);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.log(`  ⚠ Column ${col.name}: ${e.message}`);
        }
      }
    }

    await sql`CREATE INDEX IF NOT EXISTS team_chat_channels_type_idx ON public.team_chat_channels(type)`;
    await sql`CREATE INDEX IF NOT EXISTS team_chat_channels_slug_idx ON public.team_chat_channels(slug)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 5. TEAM CHAT MESSAGES TABLE
    // ========================================================================
    console.log('\n📋 5. TEAM CHAT MESSAGES TABLE');
    console.log('-'.repeat(40));

    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_messages (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR DEFAULT 'text',
        reply_to_id INTEGER,
        attachments JSONB DEFAULT '[]'::jsonb,
        reactions JSONB DEFAULT '{}'::jsonb,
        meta JSONB DEFAULT '{}'::jsonb,
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;
    console.log('  ✓ team_chat_messages table ensured');

    // Add missing columns
    const chatMsgColumns = [
      { name: 'message_type', type: "VARCHAR DEFAULT 'text'" },
      { name: 'reply_to_id', type: 'INTEGER' },
      { name: 'attachments', type: "JSONB DEFAULT '[]'::jsonb" },
      { name: 'reactions', type: "JSONB DEFAULT '{}'::jsonb" },
      { name: 'meta', type: "JSONB DEFAULT '{}'::jsonb" },
      { name: 'edited_at', type: 'TIMESTAMPTZ' },
      { name: 'deleted_at', type: 'TIMESTAMPTZ' },
    ];

    for (const col of chatMsgColumns) {
      try {
        await sql.unsafe(`
          ALTER TABLE public.team_chat_messages 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✓ Column ${col.name} ensured`);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.log(`  ⚠ Column ${col.name}: ${e.message}`);
        }
      }
    }

    await sql`CREATE INDEX IF NOT EXISTS team_chat_messages_channel_idx ON public.team_chat_messages(channel_id)`;
    await sql`CREATE INDEX IF NOT EXISTS team_chat_messages_user_idx ON public.team_chat_messages(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS team_chat_messages_created_idx ON public.team_chat_messages(created_at DESC)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 6. TEAM CHAT CHANNEL MEMBERS TABLE
    // ========================================================================
    console.log('\n📋 6. TEAM CHAT CHANNEL MEMBERS TABLE');
    console.log('-'.repeat(40));

    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_channel_members (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        role VARCHAR DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        last_read_at TIMESTAMPTZ,
        UNIQUE(channel_id, user_id)
      )
    `;
    console.log('  ✓ team_chat_channel_members table ensured');

    await sql`CREATE INDEX IF NOT EXISTS team_chat_members_channel_idx ON public.team_chat_channel_members(channel_id)`;
    await sql`CREATE INDEX IF NOT EXISTS team_chat_members_user_idx ON public.team_chat_channel_members(user_id)`;
    console.log('  ✓ Indexes ensured');

    // ========================================================================
    // 7. ENSURE DEFAULT GENERAL CHANNEL EXISTS
    // ========================================================================
    console.log('\n📋 7. DEFAULT GENERAL CHANNEL');
    console.log('-'.repeat(40));

    const existing = await sql`
      SELECT id FROM public.team_chat_channels WHERE name = 'General' LIMIT 1
    `;

    if (existing.length === 0) {
      await sql`
        INSERT INTO public.team_chat_channels (id, name, slug, description, type, is_private)
        VALUES ('channel_general', 'General', 'general', 'Allgemeiner Team-Chat', 'public', false)
      `;
      console.log('  ✓ Created default General channel');
    } else {
      console.log('  ✓ General channel already exists');
    }

    // ========================================================================
    // 8. VERIFICATION
    // ========================================================================
    console.log('\n📋 8. VERIFICATION');
    console.log('-'.repeat(40));

    const tables = ['team_feed', 'team_calendar', 'team_todos', 'team_chat_channels', 'team_chat_messages', 'team_chat_channel_members'];
    
    for (const table of tables) {
      const cols = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = ${table} AND table_schema = 'public'
      `;
      console.log(`  ✓ ${table}: ${cols.length} columns`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
