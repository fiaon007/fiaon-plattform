/**
 * ═══════════════════════════════════════════════════════════════════
 * VORBERECHNETE NORMALISIERUNG ANLEGEN — einmalig, kontrolliert
 * ═══════════════════════════════════════════════════════════════════
 *
 * WARUM NICHT AUTOMATISCH BEIM SERVERSTART?
 * `ADD COLUMN ... GENERATED ALWAYS AS ... STORED` schreibt die Tabelle neu und
 * nimmt dafür eine EXKLUSIVE Sperre. Wartet diese Sperre, reihen sich alle
 * anderen Abfragen auf fiaon_applications dahinter auf — die halbe Plattform
 * stünde. Deshalb: bewusst von Hand, zu einem Zeitpunkt deiner Wahl.
 *
 * SCHUTZ:
 *   · lock_timeout 5 s — bekommt es die Sperre nicht sofort, bricht es ab,
 *     statt den Betrieb aufzuhalten. Einfach später erneut versuchen.
 *   · statement_timeout 120 s — genug für die Umschreibung.
 *   · Gesamtabbruch nach 300 s.
 *
 * UMKEHRBAR:  npx tsx scripts/kartei-normspalten.ts --zurueck
 * Die Spalten sind reine Ableitungen — Löschen verliert KEINE Daten.
 *
 * Am besten in der Render Shell ausführen (läuft neben der Datenbank):
 *   Dashboard → fiaon-plattform → Shell
 *   npx tsx scripts/kartei-normspalten.ts --anlegen
 */
import "dotenv/config";
import postgres from "postgres";

const GESAMT_LIMIT_MS = 300_000;
const start = Date.now();
const notbremse = setTimeout(() => {
  console.error(`\n⏱  Gesamtlimit erreicht — Abbruch.`);
  process.exit(2);
}, GESAMT_LIMIT_MS);
notbremse.unref();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  max: 1,
  connect_timeout: 10,
  // lock_timeout ist der eigentliche Schutz: lieber abbrechen als blockieren.
  connection: { statement_timeout: 120_000, lock_timeout: 5_000 },
  onnotice: () => {},
});

const t = () => `${((Date.now() - start) / 1000).toFixed(1)}s`;
const schritt = (s: string) => console.log(`[${t()}] ${s}`);

const APP_PHONE_ROH = `
  COALESCE(
    NULLIF(regexp_replace(COALESCE(phone_country_code,'') || COALESCE(phone,''), '\\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(contact_phone,''), '\\D', '', 'g'), '')
  )`;

async function zaehleSpalten(): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      (table_name = 'fiaon_applications' AND column_name IN ('kartei_norm_email','kartei_norm_phone9'))
      OR (table_name = 'fiaon_leads' AND column_name IN ('kartei_norm_email','kartei_norm_phone'))
    )`;
  return Number(n);
}

async function anlegen() {
  schritt(`Vorher: ${await zaehleSpalten()}/4 Spalten vorhanden.`);

  schritt("Schreibe fiaon_applications um (exklusive Sperre, kurz) …");
  let t0 = Date.now();
  await sql.unsafe(`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS kartei_norm_email TEXT
        GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
      ADD COLUMN IF NOT EXISTS kartei_norm_phone9 TEXT
        GENERATED ALWAYS AS (RIGHT(COALESCE(${APP_PHONE_ROH},''), 9)) STORED
  `);
  console.log(`   ✅ ${Date.now() - t0} ms`);

  schritt("Schreibe fiaon_leads um …");
  t0 = Date.now();
  await sql.unsafe(`
    ALTER TABLE fiaon_leads
      ADD COLUMN IF NOT EXISTS kartei_norm_email TEXT
        GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
      ADD COLUMN IF NOT EXISTS kartei_norm_phone TEXT
        GENERATED ALWAYS AS (regexp_replace(COALESCE(telefon,''),'\\D','','g')) STORED
  `);
  console.log(`   ✅ ${Date.now() - t0} ms`);

  schritt("Lege die zugehörigen Indizes an …");
  for (const [name, stmt] of [
    ["fiaon_apps_kne_idx", `CREATE INDEX IF NOT EXISTS fiaon_apps_kne_idx ON fiaon_applications (kartei_norm_email) WHERE merged_into IS NULL`],
    ["fiaon_apps_knp_idx", `CREATE INDEX IF NOT EXISTS fiaon_apps_knp_idx ON fiaon_applications (kartei_norm_phone9) WHERE merged_into IS NULL`],
    ["fiaon_leads_kne_idx", `CREATE INDEX IF NOT EXISTS fiaon_leads_kne_idx ON fiaon_leads (kartei_norm_email)`],
    ["fiaon_leads_knp_idx", `CREATE INDEX IF NOT EXISTS fiaon_leads_knp_idx ON fiaon_leads (kartei_norm_phone)`],
  ] as [string, string][]) {
    try {
      await sql.unsafe(stmt);
      console.log(`   ✅ ${name}`);
    } catch (err: any) {
      console.log(`   ⚠️  ${name}: ${err?.code} ${err?.message}`);
    }
  }

  const n = await zaehleSpalten();
  schritt(`Nachher: ${n}/4 Spalten vorhanden.`);
  if (n !== 4) {
    console.error("❌ Nicht alle Spalten angelegt — der Server bleibt bei der Laufzeit-Berechnung.");
    process.exitCode = 1;
    return;
  }

  // ── Gleichheitsnachweis: alte Rechnung vs. gespeicherte Spalten ──────
  schritt("Prüfe: liefern beide Wege exakt dieselben Leads?");
  const [g] = await sql`
    WITH ae_alt AS MATERIALIZED (
      SELECT DISTINCT LOWER(TRIM(a.email)) AS k FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.email IS NOT NULL
    ), ap_alt AS MATERIALIZED (
      SELECT DISTINCT RIGHT(COALESCE(COALESCE(
               NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
               NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
             ),''), 9) AS k
      FROM fiaon_applications a WHERE a.merged_into IS NULL
    ), alt AS (
      SELECT l.id FROM fiaon_leads l
      WHERE NOT (
        (COALESCE(l.email,'') <> '' AND LOWER(TRIM(l.email)) IN (SELECT k FROM ae_alt))
        OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
            AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9) IN (SELECT k FROM ap_alt))
      )
    ), ae_neu AS MATERIALIZED (
      SELECT DISTINCT a.kartei_norm_email AS k FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.email IS NOT NULL
    ), ap_neu AS MATERIALIZED (
      SELECT DISTINCT a.kartei_norm_phone9 AS k FROM fiaon_applications a
      WHERE a.merged_into IS NULL
    ), neu AS (
      SELECT l.id FROM fiaon_leads l
      WHERE NOT (
        (COALESCE(l.email,'') <> '' AND l.kartei_norm_email IN (SELECT k FROM ae_neu))
        OR (LENGTH(l.kartei_norm_phone) >= 7 AND RIGHT(l.kartei_norm_phone, 9) IN (SELECT k FROM ap_neu))
      )
    )
    SELECT
      (SELECT COUNT(*) FROM alt) AS n_alt,
      (SELECT COUNT(*) FROM neu) AS n_neu,
      (SELECT COUNT(*) FROM (SELECT id FROM alt EXCEPT SELECT id FROM neu) x) AS nur_alt,
      (SELECT COUNT(*) FROM (SELECT id FROM neu EXCEPT SELECT id FROM alt) y) AS nur_neu
  `;
  console.log(`   Laufzeit-Berechnung ${g.n_alt} Leads · gespeicherte Spalten ${g.n_neu} Leads`);
  if (Number(g.nur_alt) === 0 && Number(g.nur_neu) === 0) {
    console.log("   ✅ Identisch — kein einziger Lead unterscheidet sich.");
  } else {
    console.log(`   ❌ ABWEICHUNG: nur alt ${g.nur_alt}, nur neu ${g.nur_neu}`);
    console.log("      Mit --zurueck rückgängig machen und melden.");
    process.exitCode = 1;
    return;
  }

  // ── Messung ──────────────────────────────────────────────────────────
  schritt("Messe die Dubletten-Prüfung mit gespeicherten Spalten …");
  t0 = Date.now();
  await sql`
    WITH ae AS MATERIALIZED (
      SELECT DISTINCT a.kartei_norm_email AS k FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.email IS NOT NULL
    ), ap AS MATERIALIZED (
      SELECT DISTINCT a.kartei_norm_phone9 AS k FROM fiaon_applications a
      WHERE a.merged_into IS NULL
    )
    SELECT COUNT(*) FROM fiaon_leads l
    WHERE NOT (
      (COALESCE(l.email,'') <> '' AND l.kartei_norm_email IN (SELECT k FROM ae))
      OR (LENGTH(l.kartei_norm_phone) >= 7 AND RIGHT(l.kartei_norm_phone, 9) IN (SELECT k FROM ap))
    )`;
  const ms = Date.now() - t0;
  console.log(`   ${ms < 200 ? "✅" : "⚠️ "} ${ms} ms`);

  console.log("\n✅ Fertig. Der Server erkennt die Spalten beim nächsten Start von selbst.");
}

async function zurueck() {
  schritt("Entferne die abgeleiteten Spalten (kein Datenverlust) …");
  await sql.unsafe(`ALTER TABLE fiaon_applications
    DROP COLUMN IF EXISTS kartei_norm_email, DROP COLUMN IF EXISTS kartei_norm_phone9`);
  await sql.unsafe(`ALTER TABLE fiaon_leads
    DROP COLUMN IF EXISTS kartei_norm_email, DROP COLUMN IF EXISTS kartei_norm_phone`);
  schritt(`Nachher: ${await zaehleSpalten()}/4 Spalten vorhanden.`);
  console.log("✅ Zurückgenommen. Der Server rechnet wieder zur Laufzeit.");
}

async function main() {
  if (process.argv.includes("--zurueck")) return zurueck();
  if (process.argv.includes("--anlegen")) return anlegen();
  console.log("Verwendung:");
  console.log("  npx tsx scripts/kartei-normspalten.ts --anlegen   (anlegen + prüfen + messen)");
  console.log("  npx tsx scripts/kartei-normspalten.ts --zurueck   (rückgängig)");
  console.log(`\nStand: ${await zaehleSpalten()}/4 Spalten vorhanden.`);
}

main()
  .catch((err: any) => {
    if (err?.code === "55P03" || err?.code === "57014") {
      console.error(`\n❌ Sperre nicht bekommen bzw. Zeitlimit (${err.code}).`);
      console.error("   Die Tabelle ist gerade in Benutzung. Nichts wurde verändert — später erneut versuchen.");
    } else {
      console.error(`\n❌ ${err?.code || ""} ${err?.message || err}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 }).catch(() => {});
    console.log(`\nGesamtlaufzeit: ${t()}`);
    process.exit(process.exitCode || 0);
  });
