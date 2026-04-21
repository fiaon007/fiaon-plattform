#!/usr/bin/env node
/**
 * Raw SQL Migration Runner (plain ESM JavaScript, no tsx required)
 * ------------------------------------------------------------------
 * Idempotent runner for all *.sql files in db/migrations/.
 *
 * - Sorts files alphabetically/numerically.
 * - Tracks applied migrations in schema_migrations (filename, applied_at).
 * - Runs each NEW file wrapped in a transaction.
 * - Files are expected to be additive (CREATE TABLE IF NOT EXISTS,
 *   ADD COLUMN IF NOT EXISTS, etc.) — NEVER destructive.
 * - Refuses to run anything containing DROP TABLE / DROP DATABASE / TRUNCATE.
 * - Safe to re-run at any time.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/run-migrations.mjs
 *   or:  npm run db:migrate:sql
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "db", "migrations");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[MIGRATE] ❌ DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  // SSL required for Render/Neon/managed PG, disabled for local dev.
  const requireSsl = !/localhost|127\.0\.0\.1/.test(dbUrl);
  const sql = postgres(dbUrl, {
    ssl: requireSsl ? "require" : false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    onnotice: () => {},
  });

  console.log(`[MIGRATE] Connecting to database (ssl=${requireSsl})...`);

  // 1. Ensure tracker table
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 2. List .sql files, sort deterministically
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[MIGRATE] ❌ Migrations dir not found: ${MIGRATIONS_DIR}`);
    await sql.end();
    process.exit(1);
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  if (files.length === 0) {
    console.log("[MIGRATE] No .sql files found. Nothing to do.");
    await sql.end();
    return;
  }

  // 3. Load already-applied set
  const appliedRows = await sql`SELECT filename FROM schema_migrations`;
  const applied = new Set(appliedRows.map((r) => r.filename));

  let newCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      skipCount++;
      console.log(`[MIGRATE] ⏭  SKIP  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlText = fs.readFileSync(filePath, "utf8");

    // Safety: refuse destructive migrations
    const destructive = [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+DATABASE\b/i,
      /\bTRUNCATE\b/i,
    ].some((re) => re.test(sqlText));

    if (destructive) {
      console.warn(
        `[MIGRATE] ⚠️  REFUSING destructive migration: ${file}\n` +
          `    → contains DROP TABLE / DROP DATABASE / TRUNCATE. Review manually.`
      );
      failCount++;
      continue;
    }

    console.log(`[MIGRATE] ▶  APPLY ${file} ...`);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(sqlText);
        await tx`
          INSERT INTO schema_migrations (filename) VALUES (${file})
          ON CONFLICT (filename) DO NOTHING
        `;
      });
      console.log(`[MIGRATE] ✅ OK    ${file}`);
      newCount++;
    } catch (err) {
      failCount++;
      const msg = err?.message || String(err);
      console.error(`[MIGRATE] ❌ FAIL  ${file}\n    → ${msg}`);
      // Continue with next file — don't crash the whole deploy.
    }
  }

  await sql.end();
  console.log(
    `\n[MIGRATE] Done. Applied: ${newCount}, Skipped: ${skipCount}, Failed: ${failCount}`
  );
}

main().catch((err) => {
  console.error("[MIGRATE] 💥 Unhandled error:", err);
  // Exit 0 so deploy continues even if migrations have issues.
  process.exit(0);
});
