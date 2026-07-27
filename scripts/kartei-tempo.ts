/**
 * ═══════════════════════════════════════════════════════════════════
 * KARTEI-TEMPO — Diagnose mit HARTEN Grenzen (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Dieses Skript kann die Konsole nicht blockieren. Drei Schranken:
 *   · connect_timeout   5 s  — hängt die Datenbank, bricht der Aufbau ab
 *   · statement_timeout 10 s — jede einzelne Abfrage wird abgeschnitten
 *   · Gesamtabbruch    60 s  — danach beendet sich der Prozess in jedem Fall
 *
 * Es meldet fortlaufend, woran es arbeitet. Bricht etwas ab, ist das ein
 * ERGEBNIS („zu langsam"), kein Fehlschlag — genau das wollen wir wissen.
 *
 * Verwendung:  npx tsx scripts/kartei-tempo.ts
 * Besser in der Render Shell (läuft neben der Datenbank, kein Netz-Umweg).
 */
import "dotenv/config";
import postgres from "postgres";

const GESAMT_LIMIT_MS = 60_000;
const start = Date.now();

// Notbremse: beendet den Prozess auch dann, wenn die Datenbank gar nicht
// mehr antwortet. unref() sorgt dafür, dass der Timer ein früheres, normales
// Ende nicht verhindert.
const notbremse = setTimeout(() => {
  console.error(`\n⏱  Gesamtlimit ${GESAMT_LIMIT_MS / 1000} s erreicht — Abbruch.`);
  console.error("   Das ist das Ergebnis: Die Datenbank antwortet nicht rechtzeitig.");
  process.exit(2);
}, GESAMT_LIMIT_MS);
notbremse.unref();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  max: 2,
  connect_timeout: 5,
  idle_timeout: 5,
  connection: { statement_timeout: 10_000 },
  onnotice: () => {},
});

const t = () => `${((Date.now() - start) / 1000).toFixed(1)}s`;
const schritt = (s: string) => console.log(`[${t()}] ${s}`);

/** Misst eine Abfrage und fängt das Zeitlimit als Messwert ab. */
async function messen(name: string, query: string): Promise<number | null> {
  const t0 = Date.now();
  try {
    await sql.unsafe(query);
    const ms = Date.now() - t0;
    console.log(`   ${ms < 200 ? "✅" : ms < 1000 ? "⚠️ " : "❌"} ${name}: ${ms} ms`);
    return ms;
  } catch (err: any) {
    if (err?.code === "57014") {
      console.log(`   ❌ ${name}: über 10 000 ms — abgebrochen (Zeitlimit)`);
      return null;
    }
    console.log(`   ❌ ${name}: ${err?.code || "?"} ${err?.message}`);
    return null;
  }
}

const ERWARTETE_INDIZES = [
  "fiaon_apps_kartei_filter_idx",
  "fiaon_apps_agent_updated_idx",
  "fiaon_leads_kartei_filter_idx",
  "fiaon_leads_agent_updated_idx",
  "fiaon_contact_log_ref_type_idx",
  "fiaon_contact_log_sched_idx",
  "fiaon_lead_log_lead_type_idx",
  "fiaon_lead_log_sched_idx",
  "fiaon_apps_norm_email_idx",
  "fiaon_apps_norm_phone_idx",
  "fiaon_leads_norm_email_idx",
];

async function main() {
  schritt("Verbinde …");
  await sql`SELECT 1`;
  schritt("Verbindung steht.");

  // ── T1 · Mengengerüst ────────────────────────────────────────────────
  schritt("T1 · Wie viele Zeilen sind überhaupt im Spiel?");
  const [mengen] = await sql`
    SELECT
      (SELECT COUNT(*) FROM fiaon_applications WHERE merged_into IS NULL) AS antraege,
      (SELECT COUNT(*) FROM fiaon_leads)        AS leads,
      (SELECT COUNT(*) FROM fiaon_contact_log)  AS contact_log,
      (SELECT COUNT(*) FROM fiaon_lead_log)     AS lead_log
  `;
  const antraege = Number(mengen.antraege);
  const leads = Number(mengen.leads);
  console.log(`   Anträge ${antraege} · Leads ${leads} · Kontakt-Log ${mengen.contact_log} · Lead-Log ${mengen.lead_log}`);
  console.log(`   Dubletten-Prüfung ohne Index: ${leads} × ${antraege} = ${(leads * antraege / 1e6).toFixed(1)} Mio. Vergleiche`);

  // ── T2 · Existieren die Indizes wirklich? ────────────────────────────
  schritt("T2 · Welche der elf Indizes existieren tatsächlich?");
  const vorhanden = await sql<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ANY(${ERWARTETE_INDIZES})
  `;
  const da = new Set(vorhanden.map((r) => r.indexname));
  for (const name of ERWARTETE_INDIZES) {
    console.log(`   ${da.has(name) ? "✅" : "❌ FEHLT"}  ${name}`);
  }
  console.log(`   ${da.size}/${ERWARTETE_INDIZES.length} vorhanden`);

  // ── T3 · Laufzeiten ──────────────────────────────────────────────────
  schritt("T3 · Laufzeit der Bausteine (jeweils max. 10 s)");

  await messen(
    "Dubletten-Prüfung alt (NOT EXISTS je Zeile)",
    `SELECT COUNT(*) FROM fiaon_leads l
     WHERE NOT EXISTS (
       SELECT 1 FROM fiaon_applications a
       WHERE a.merged_into IS NULL AND (
         (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
         OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
             AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
               = RIGHT(COALESCE(COALESCE(
                   NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
                   NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
                 ),''), 9))
       )
     )`,
  );

  await messen(
    "Dubletten-Prüfung neu (Anti-Join über Schlüsselmengen)",
    `WITH app_email AS MATERIALIZED (
       SELECT DISTINCT LOWER(TRIM(a.email)) AS k FROM fiaon_applications a
       WHERE a.merged_into IS NULL AND a.email IS NOT NULL
     ), app_phone AS MATERIALIZED (
       SELECT DISTINCT RIGHT(COALESCE(COALESCE(
                NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
                NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
              ),''), 9) AS k
       FROM fiaon_applications a WHERE a.merged_into IS NULL
     )
     SELECT COUNT(*) FROM fiaon_leads l
     WHERE NOT (
       (COALESCE(l.email,'') <> '' AND LOWER(TRIM(l.email)) IN (SELECT k FROM app_email))
       OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
           AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9) IN (SELECT k FROM app_phone))
     )`,
  );

  // ── T4 · Sind alt und neu WIRKLICH identisch? ────────────────────────
  // Nicht die Anzahl vergleichen — die kann zufällig übereinstimmen. Die
  // Symmetrische Differenz muss null sein: kein Lead, den nur die eine
  // Fassung durchlässt.
  schritt("T4 · Liefern alte und neue Regel exakt dieselben Leads?");
  try {
    const [diff] = await sql`
      WITH alt AS (
        SELECT l.id FROM fiaon_leads l
        WHERE NOT EXISTS (
          SELECT 1 FROM fiaon_applications a
          WHERE a.merged_into IS NULL AND (
            (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
            OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
                AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
                  = RIGHT(COALESCE(COALESCE(
                      NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
                      NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
                    ),''), 9))
          )
        )
      ),
      app_email AS MATERIALIZED (
        SELECT DISTINCT LOWER(TRIM(a.email)) AS k FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.email IS NOT NULL
      ),
      app_phone AS MATERIALIZED (
        SELECT DISTINCT RIGHT(COALESCE(COALESCE(
                 NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
                 NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
               ),''), 9) AS k
        FROM fiaon_applications a WHERE a.merged_into IS NULL
      ),
      neu AS (
        SELECT l.id FROM fiaon_leads l
        WHERE NOT (
          (COALESCE(l.email,'') <> '' AND LOWER(TRIM(l.email)) IN (SELECT k FROM app_email))
          OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
              AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9) IN (SELECT k FROM app_phone))
        )
      )
      SELECT
        (SELECT COUNT(*) FROM alt) AS n_alt,
        (SELECT COUNT(*) FROM neu) AS n_neu,
        (SELECT COUNT(*) FROM (SELECT id FROM alt EXCEPT SELECT id FROM neu) x) AS nur_alt,
        (SELECT COUNT(*) FROM (SELECT id FROM neu EXCEPT SELECT id FROM alt) y) AS nur_neu
    `;
    const nurAlt = Number(diff.nur_alt);
    const nurNeu = Number(diff.nur_neu);
    console.log(`   alt ${diff.n_alt} Leads · neu ${diff.n_neu} Leads`);
    if (nurAlt === 0 && nurNeu === 0) {
      console.log("   ✅ Identisch — kein einziger Lead unterscheidet sich.");
    } else {
      console.log(`   ❌ ABWEICHUNG: nur in alt ${nurAlt}, nur in neu ${nurNeu} — NICHT ausrollen!`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    if (err?.code === "57014") {
      console.log("   ⚠️  Vergleich im Zeitlimit — die ALTE Fassung ist zu langsam für einen Direktvergleich.");
      console.log("      Genau das ist der Befund. In der Render Shell wiederholen (dort ohne Netz-Umweg).");
    } else throw err;
  }

  console.log("\n   Naechster Schritt (einmalig, kontrolliert):");
  console.log("   npx tsx scripts/kartei-normspalten.ts --anlegen");

  schritt("Fertig.");
}

main()
  .catch((err: any) => {
    if (err?.code === "57014") console.error(`\n❌ Zeitlimit (10 s) bei einer Abfrage — das ist das Ergebnis.`);
    else console.error(`\n❌ ${err?.code || ""} ${err?.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 }).catch(() => {});
    console.log(`\nGesamtlaufzeit: ${t()}`);
    process.exit(process.exitCode || 0);
  });
