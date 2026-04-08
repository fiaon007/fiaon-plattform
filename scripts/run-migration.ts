// scripts/run-migration.ts
// Führt die SQL Migration sicher aus

import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

async function runMigration() {
  console.log("🚀 Starting database migration...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set!");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // SQL Datei lesen
    const migrationPath = join(__dirname, "../db/migrations/002_create_admin_tables.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Executing migration: 002_create_admin_tables.sql\n");

    // Migration ausführen
    await sql.unsafe(migrationSQL);

    console.log("✅ Migration completed successfully!\n");

    // Verification
    console.log("🔍 Verifying tables...\n");

    const notificationsCheck = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'admin_notifications'
    `;
    console.log(`   admin_notifications: ${Number(notificationsCheck[0].count) > 0 ? "✅ EXISTS" : "❌ MISSING"}`);

    const activityCheck = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'admin_activity_log'
    `;
    console.log(`   admin_activity_log: ${Number(activityCheck[0].count) > 0 ? "✅ EXISTS" : "❌ MISSING"}`);

    // Index count
    const indexCount = await sql`
      SELECT COUNT(*) as count FROM pg_indexes 
      WHERE tablename IN ('admin_notifications', 'admin_activity_log')
    `;
    console.log(`   Indexes created: ${indexCount[0].count}`);

    console.log("\n🎉 All done! Tables are ready.\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
