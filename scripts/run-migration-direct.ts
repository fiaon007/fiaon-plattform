// scripts/run-migration-direct.ts
// Run migration directly using db connection

import postgres from "postgres";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

async function runMigration() {
  console.log("🚀 Running business application migration directly...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set!");
    console.error("Please set DATABASE_URL in your environment variables.");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { ssl: 'require' });

  try {
    console.log("📄 Checking if business fields already exist...\n");

    // Check if columns already exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fiaon_applications' 
      AND table_schema = 'public'
      AND column_name = 'company_name'
    `;

    if (columns.length > 0) {
      console.log("✅ Migration already run - business fields exist\n");
      await sql.end();
      return;
    }

    console.log("📄 Running migration...\n");

    // Run migration
    await sql`
      ALTER TABLE fiaon_applications 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR,
      ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS established_year VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS business_type VARCHAR,
      ADD COLUMN IF NOT EXISTS industry VARCHAR,
      ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
      ADD COLUMN IF NOT EXISTS employees INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
      ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
    `;

    console.log("✅ Columns added successfully\n");

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
    `;

    console.log("✅ Index created successfully\n");

    // Verification
    console.log("🔍 Verifying migration...\n");

    const allColumns = await sql`
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
    allColumns.forEach((col: any) => {
      const isBusinessField = businessFields.includes(col.column_name);
      const marker = isBusinessField ? "🔵" : "  ";
      console.log(`${marker} ${col.column_name}`);
    });

    console.log("\n🔵 = Business-specific fields (newly added)");
    console.log("✅ Migration completed successfully!\n");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
