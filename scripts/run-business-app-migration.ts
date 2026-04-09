// scripts/run-business-app-migration.ts
// Führt die Business Application Fields Migration sicher aus

import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  console.log("🚀 Starting business application fields migration...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set!");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // SQL Datei lesen
    const migrationPath = join(__dirname, "../db/migrations/013_add_business_application_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Executing migration: 013_add_business_application_fields.sql\n");

    // Migration ausführen
    await sql.unsafe(migrationSQL);

    console.log("✅ Migration completed successfully!\n");

    // Verification
    console.log("🔍 Verifying business fields in fiaon_applications table...\n");

    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fiaon_applications' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    const businessFields = [
      'company_name', 'legal_form', 'tax_id', 'established_year',
      'contact_name', 'contact_email', 'contact_phone',
      'business_type', 'industry', 'annual_revenue',
      'employees', 'monthly_expenses', 'billing_email'
    ];

    console.log("📋 All columns in fiaon_applications:");
    columns.forEach((col: any) => {
      const isBusinessField = businessFields.includes(col.column_name);
      const marker = isBusinessField ? "🔵" : "  ";
      console.log(`${marker} ${col.column_name}`);
    });

    console.log("\n🔵 = Business-specific fields (newly added)");
    console.log("✅ Business application migration completed successfully!\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
