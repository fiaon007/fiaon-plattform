/**
 * ============================================================================
 * IDEMPOTENT CHAT TABLES MIGRATION
 * ============================================================================
 * Adds missing columns to team_chat_channels and ensures all chat tables exist.
 * Safe to run multiple times - uses ADD COLUMN IF NOT EXISTS.
 * 
 * Run with: npx tsx scripts/run-chat-migration.ts
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
  console.log('🚀 Starting idempotent chat tables migration...\n');

  try {
    // ========================================================================
    // 1. Ensure team_chat_channels table exists with all columns
    // ========================================================================
    console.log('📋 Ensuring team_chat_channels table and columns...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_channels (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT false NOT NULL,
        created_by TEXT,
        meta JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;

    // Add missing columns if table already existed without them
    const columnsToAdd = [
      { name: 'description', type: 'TEXT' },
      { name: 'is_private', type: 'BOOLEAN DEFAULT false NOT NULL' },
      { name: 'created_by', type: 'TEXT' },
      { name: 'meta', type: "JSONB DEFAULT '{}'::jsonb NOT NULL" },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT now() NOT NULL' },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT now() NOT NULL' },
    ];

    for (const col of columnsToAdd) {
      try {
        await sql.unsafe(`
          ALTER TABLE public.team_chat_channels 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`  ✓ Column ${col.name} ensured`);
      } catch (e: any) {
        // Column might already exist with different constraints
        if (!e.message?.includes('already exists')) {
          console.log(`  ⚠ Column ${col.name}: ${e.message}`);
        }
      }
    }

    // ========================================================================
    // 2. Ensure team_chat_messages table exists with all columns
    // ========================================================================
    console.log('\n📋 Ensuring team_chat_messages table and columns...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' NOT NULL,
        reply_to_id TEXT,
        reactions JSONB DEFAULT '{}'::jsonb NOT NULL,
        meta JSONB DEFAULT '{}'::jsonb NOT NULL,
        is_edited BOOLEAN DEFAULT false NOT NULL,
        is_deleted BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      )
    `;

    const msgColumnsToAdd = [
      { name: 'message_type', type: "TEXT DEFAULT 'text' NOT NULL" },
      { name: 'reply_to_id', type: 'TEXT' },
      { name: 'reactions', type: "JSONB DEFAULT '{}'::jsonb NOT NULL" },
      { name: 'meta', type: "JSONB DEFAULT '{}'::jsonb NOT NULL" },
      { name: 'is_edited', type: 'BOOLEAN DEFAULT false NOT NULL' },
      { name: 'is_deleted', type: 'BOOLEAN DEFAULT false NOT NULL' },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT now() NOT NULL' },
    ];

    for (const col of msgColumnsToAdd) {
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

    // ========================================================================
    // 3. Ensure team_chat_channel_members table exists
    // ========================================================================
    console.log('\n📋 Ensuring team_chat_channel_members table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS public.team_chat_channel_members (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member' NOT NULL,
        joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        last_read_at TIMESTAMPTZ,
        UNIQUE(channel_id, user_id)
      )
    `;
    console.log('  ✓ team_chat_channel_members table ensured');

    // ========================================================================
    // 4. Create indexes if they don't exist
    // ========================================================================
    console.log('\n📋 Ensuring indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_team_chat_channels_created_at ON public.team_chat_channels(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_channels_created_by ON public.team_chat_channels(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_messages_channel_id ON public.team_chat_messages(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_messages_user_id ON public.team_chat_messages(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_messages_created_at ON public.team_chat_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_channel_members_channel ON public.team_chat_channel_members(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_team_chat_channel_members_user ON public.team_chat_channel_members(user_id)',
    ];

    for (const idx of indexes) {
      try {
        await sql.unsafe(idx);
        const idxName = idx.match(/idx_\w+/)?.[0] || 'index';
        console.log(`  ✓ ${idxName}`);
      } catch (e: any) {
        console.log(`  ⚠ Index: ${e.message}`);
      }
    }

    // ========================================================================
    // 5. Ensure default "General" channel exists
    // ========================================================================
    console.log('\n📋 Ensuring default General channel...');
    
    const existing = await sql`
      SELECT id FROM public.team_chat_channels WHERE name = 'General' LIMIT 1
    `;
    
    if (existing.length === 0) {
      await sql`
        INSERT INTO public.team_chat_channels (name, description, is_private, created_by)
        VALUES ('General', 'Allgemeiner Team-Chat', false, 'system')
      `;
      console.log('  ✓ Created default General channel');
    } else {
      console.log('  ✓ General channel already exists');
    }

    // ========================================================================
    // 6. Verify migration
    // ========================================================================
    console.log('\n📋 Verifying migration...');
    
    const channelCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'team_chat_channels' AND table_schema = 'public'
    `;
    console.log(`  ✓ team_chat_channels has ${channelCols.length} columns:`, 
      channelCols.map(c => c.column_name).join(', '));

    const msgCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'team_chat_messages' AND table_schema = 'public'
    `;
    console.log(`  ✓ team_chat_messages has ${msgCols.length} columns:`,
      msgCols.map(c => c.column_name).join(', '));

    console.log('\n✅ Chat migration completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
