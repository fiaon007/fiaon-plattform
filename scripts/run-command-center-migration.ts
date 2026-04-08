// scripts/run-command-center-migration.ts
// Runs the Command Center tables migration safely

import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

async function runMigration() {
  console.log("🚀 Starting Command Center database migration...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set!");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { ssl: 'require' });

  try {
    // Read SQL file
    const migrationPath = join(__dirname, "../db/migrations/007_create_command_center_tables.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Executing migration: 007_create_command_center_tables.sql\n");

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log("✅ Migration completed successfully!\n");

    // Verification
    console.log("🔍 Verifying tables...\n");

    const tables = ['team_feed', 'team_calendar', 'team_todos', 'team_chat_channels', 'team_chat_messages', 'team_chat_channel_members'];
    
    for (const table of tables) {
      const check = await sql`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      const exists = Number(check[0].count) > 0;
      console.log(`   ${table}: ${exists ? "✅ EXISTS" : "❌ MISSING"}`);
    }

    // Check default channel
    const channelCheck = await sql`
      SELECT COUNT(*) as count FROM team_chat_channels WHERE id = 'channel_general'
    `;
    console.log(`   General channel: ${Number(channelCheck[0].count) > 0 ? "✅ EXISTS" : "❌ MISSING"}`);

    console.log("\n🎉 All Command Center tables are ready!\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
