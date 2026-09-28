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
  // E-254 (28.09.2026): Dateien, die nur an der Sperrfrist scheiterten (s. unten).
  const sperrFails = [];

  for (const file of files) {
    if (applied.has(file)) {
      skipCount++;
      console.log(`[MIGRATE] ⏭  SKIP  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlText = fs.readFileSync(filePath, "utf8");

    // Safety: refuse destructive migrations
    // ── DROP COLUMN GEHÖRT DAZU (28.08.2026) ────────────────────────────
    // Die Liste kannte DROP TABLE, DROP DATABASE und TRUNCATE — aber nicht
    // DROP COLUMN. Eine gelöschte Spalte ist genauso endgültig wie eine
    // gelöschte Tabelle, nur unauffälliger: Der Deploy läuft durch, und der
    // Fehler zeigt sich erst, wenn ein Kunde einen Antrag abschickt.
    //
    // Aufgefallen beim Vorbereiten des Kontakt-Spalten-DROPs: 397 Zugriffe in
    // 62 Dateien lesen diese Spalten noch. Wäre der DROP versehentlich in eine
    // Migration geraten, hätte ihn nichts gestoppt.
    //
    // ALTER … DROP CONSTRAINT bleibt erlaubt: Eine Bedingung zu lösen ist
    // umkehrbar, Daten zu löschen nicht.
    const destructive = [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+DATABASE\b/i,
      /\bTRUNCATE\b/i,
      /\bDROP\s+COLUMN\b/i,
    ].some((re) => re.test(sqlText));

    if (destructive) {
      console.warn(
        `[MIGRATE] ⚠️  REFUSING destructive migration: ${file}\n` +
          `    → contains DROP TABLE / DROP DATABASE / TRUNCATE / DROP COLUMN. `
          + `Review manually.`
      );
      failCount++;
      continue;
    }

    console.log(`[MIGRATE] ▶  APPLY ${file} ...`);
    // ── SPERRFRIST (E-254, 28.09.2026) ─────────────────────────────────────
    // Eine Migration auf einer belebten Tabelle (ALTER TABLE, CREATE INDEX)
    // wartet sonst ohne Grenze auf ihre Sperre — und hinter ihr jede Abfrage
    // der ALTEN Instanz, die während des Deploys noch den Verkehr bedient. So
    // stand am 28.09. das Agentenportal (dort durch die Laufzeit-Prüfungen).
    // Jetzt: höchstens 5 s je Versuch, drei Versuche mit 2 s Pause. Scheitert
    // die Datei dann immer noch an der Sperre, bricht der Start am Ende mit
    // Exit 1 ab (siehe sperrFails) — andere FAILs bleiben wie bisher Exit 0.
    for (let versuch = 1; ; versuch++) {
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe("SET LOCAL lock_timeout = '5s'");
          await tx.unsafe(sqlText);
          await tx`
            INSERT INTO schema_migrations (filename) VALUES (${file})
            ON CONFLICT (filename) DO NOTHING
          `;
        });
        console.log(`[MIGRATE] ✅ OK    ${file}`);
        newCount++;
        break;
      } catch (err) {
        if (err?.code === "55P03" && versuch < 3) {
          console.warn(`[MIGRATE] ⏳ Sperre nicht frei (5s, Versuch ${versuch}/3): ${file} — neuer Versuch in 2 s`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        failCount++;
        const msg = err?.message || String(err);
        console.error(`[MIGRATE] ❌ FAIL  ${file}\n    → ${msg}`);
        if (err?.code === "55P03") sperrFails.push({ file, halter: await sperrHalter(sql, sqlText) });
        // Continue with next file — don't crash the whole deploy.
        break;
      }
    }
  }

  await sql.end();
  console.log(
    `\n[MIGRATE] Done. Applied: ${newCount}, Skipped: ${skipCount}, Failed: ${failCount}`
  );

  // ── SPERRE STATT FEHLER: DANN STARTET DER NEUE CODE NICHT (E-254, 28.09.2026) ──
  // Nachprüfung: Mit Exit 0 lief `npm start` weiter, der NEUE Code startete ohne
  // die Tabellen-Änderung seiner Migration — bis zum nächsten Deploy, ohne Alarm.
  // Bei „Wand"-Migrationen, die es nur als SQL-Datei gibt (z. B. 065), fehlt dann
  // eine Schutzregel. Vor E-254 hätte die Migration gewartet und wäre angewendet
  // worden. Jetzt: Exit 1 → `&& exec node` läuft nicht, Render bricht den Deploy
  // sichtbar als fehlgeschlagen ab, die ALTE Instanz bedient weiter — Code
  // und Tabellen passen nie auseinander. Neu deployen, sobald die genannte
  // Sitzung fertig oder beendet ist.
  // Not-Aus: MIGRATE_SPERRFEHLER=weiter → wie vorher Exit 0 (nur für den Fall,
  // dass eine Sitzung sich nicht beenden lässt und der Deploy trotzdem muss).
  if (sperrFails.length > 0) {
    for (const f of sperrFails) {
      console.error(`[MIGRATE] 🔒 ${f.file}: Tabelle besetzt — ${f.halter}`);
    }
    if (String(process.env.MIGRATE_SPERRFEHLER || "").trim().toLowerCase() === "weiter") {
      console.error(`[MIGRATE] ⚠️  ${sperrFails.length} Migration(en) an einer Sperre gescheitert — MIGRATE_SPERRFEHLER=weiter: Start läuft trotzdem.`);
      return;
    }
    console.error(
      `[MIGRATE] 🛑 ABBRUCH: ${sperrFails.length} Migration(en) an einer besetzten Tabelle gescheitert. ` +
        `Der neue Code startet NICHT ohne sie (Exit 1) — die laufende Instanz bleibt. ` +
        `Neu deployen, wenn die genannte Sitzung fertig ist.`
    );
    process.exit(1);
  }
}

/**
 * Wer hält die Tabellen einer Migration? Nur Katalog (pg_locks,
 * pg_stat_activity) — für die Abbruch-Zeile im Render-Log (E-254).
 */
async function sperrHalter(sql, sqlText) {
  try {
    const namen = Array.from(
      new Set(
        Array.from(
          sqlText.matchAll(/\b(?:ALTER\s+TABLE|INDEX\b[^;]*?\bON|TRIGGER\b[^;]*?\bON|UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?("?[A-Za-z_][\w$]*"?(?:\."?[A-Za-z_][\w$]*"?)?)/gi),
          (m) => m[1]
        )
      )
    ).slice(0, 20);
    if (namen.length === 0) return "unbekannt";
    const zeilen = await sql`
      SELECT a.pid, a.application_name AS app, a.state,
             EXTRACT(EPOCH FROM NOW() - COALESCE(a.xact_start, a.query_start))::int AS sek,
             LEFT(regexp_replace(COALESCE(a.query, ''), '[[:space:]]+', ' ', 'g'), 80) AS abfrage
        FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.relation = ANY (ARRAY(SELECT to_regclass(t) FROM unnest(${namen}::text[]) t))
         AND l.granted AND l.pid IS DISTINCT FROM pg_backend_pid()
       GROUP BY 1, 2, 3, 4, 5
       ORDER BY sek DESC NULLS LAST
       LIMIT 3`;
    return zeilen.map((x) => `pid ${x.pid} (${x.app || "?"}, ${x.state || "?"}, seit ${x.sek ?? "?"} s: ${x.abfrage || "?"})`).join("; ") || "unbekannt";
  } catch {
    return "unbekannt";
  }
}

main().catch((err) => {
  console.error("[MIGRATE] 💥 Unhandled error:", err);
  // Exit 0 so deploy continues even if migrations have issues.
  process.exit(0);
});
