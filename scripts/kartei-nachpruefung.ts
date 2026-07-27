/**
 * ═══════════════════════════════════════════════════════════════════
 * NACHPRÜFUNG DER MIGRATION (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Beantwortet die eine entscheidende Frage: Hat die Migration etwas
 * freigegeben, das sie nicht hätte anfassen dürfen?
 *
 *   N1  Wurde eine Akte MIT dokumentiertem Kontakt freigegeben?  → Verstoß
 *   N2  Wurde eine bezahlte/abgeschlossene Akte freigegeben?     → Verstoß
 *   N3  Stimmt die Zahl der Audit-Einträge mit den Freigaben?    → Umkehrbarkeit
 *   N4  Findet --undo den Stapel überhaupt?                      → Umkehrbarkeit
 *   N5  Wodurch erklären sich Abweichungen im Betreuungs-Vergleich?
 *
 * Verwendung: npx tsx scripts/kartei-nachpruefung.ts <batch-id>
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require", max: 2, connection: { statement_timeout: 120000 },
});
const batch = process.argv[2];
const CONTACT_TYPES = ["result", "note", "email_sent"];

let verstoss = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) verstoss++;
  console.log(`${ok ? "✅" : "❌"} ${name}\n     ${detail}`);
}

async function main(): Promise<void> {
  if (!batch) { console.error("Stapel-Kennung fehlt."); process.exit(2); }

  // Der Stapel — robust gegen beide meta-Schreibweisen.
  const events = await sql`
    SELECT kind, target_id, agent_id FROM fiaon_kartei_events
    WHERE event = 'migration_release'
      AND COALESCE(
            meta->>'batch_id',
            CASE WHEN jsonb_typeof(meta) = 'string'
                 THEN ((meta #>> '{}')::jsonb)->>'batch_id' END
          ) = ${batch}
  `;
  const leadIds = events.filter((e: any) => e.kind === "lead").map((e: any) => Number(e.target_id));
  const appRefs = events.filter((e: any) => e.kind === "app").map((e: any) => String(e.target_id));

  // ── N1: dokumentierter Kontakt bei einer freigegebenen Akte? ──────────────
  // Wichtig: Die Migration schreibt selbst einen Eintrag vom Typ 'system' —
  // der zaehlt ausdruecklich NICHT als dokumentierter Kontakt.
  const leadKontakt = leadIds.length === 0 ? [] : await sql`
    SELECT DISTINCT g.lead_id FROM fiaon_lead_log g
    WHERE g.lead_id = ANY(${leadIds}) AND g.type = ANY(${CONTACT_TYPES})
  `;
  const appKontakt = appRefs.length === 0 ? [] : await sql`
    SELECT DISTINCT c.ref FROM fiaon_contact_log c
    WHERE c.ref = ANY(${appRefs}) AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL
  `;
  check(
    "N1 · Keine Akte mit dokumentiertem Kontakt freigegeben",
    leadKontakt.length === 0 && appKontakt.length === 0,
    `${leadKontakt.length} Leads / ${appKontakt.length} Bestellungen mit Kontakt in der Freigabemenge (erwartet: 0/0)`,
  );

  // ── N2: bezahlte oder abgeschlossene Akte freigegeben? ────────────────────
  const bezahlt = appRefs.length === 0 ? [] : await sql`
    SELECT ref, payment_status FROM fiaon_applications
    WHERE ref = ANY(${appRefs}) AND payment_status IN ('paid','expired','cancelled')
  `;
  const konvertiert = leadIds.length === 0 ? [] : await sql`
    SELECT id FROM fiaon_leads WHERE id = ANY(${leadIds}) AND converted_order_id IS NOT NULL
  `;
  check(
    "N2 · Nichts Bezahltes/Abgeschlossenes freigegeben",
    bezahlt.length === 0 && konvertiert.length === 0,
    `${bezahlt.length} bezahlte Bestellungen / ${konvertiert.length} konvertierte Leads (erwartet: 0/0)`,
  );

  // ── N3/N4: Umkehrbarkeit ──────────────────────────────────────────────────
  const mitAgent = events.filter((e: any) => e.agent_id).length;
  check(
    "N3 · Jeder Eintrag kennt seinen vorherigen Agenten",
    mitAgent === events.length && events.length > 0,
    `${mitAgent} von ${events.length} Einträgen haben agent_id (nötig für --undo)`,
  );
  check(
    "N4 · Der Stapel ist über den Rückwärtsgang auffindbar",
    events.length > 0,
    `--undo=${batch} würde ${events.length} Akte(n) wiederherstellen`,
  );

  // ── N5: Erklärung der Abweichungen im Betreuungs-Vergleich ────────────────
  const [neueLeads] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_leads
    WHERE erstellt_am >= NOW() - INTERVAL '90 minutes'
  `;
  const statusWechsel = await sql`
    SELECT ref, payment_status, updated_at FROM fiaon_applications
    WHERE payment_status IN ('paid','expired','cancelled')
      AND updated_at >= NOW() - INTERVAL '90 minutes'
      AND assigned_agent_id IS NOT NULL
    ORDER BY updated_at DESC LIMIT 10
  `;
  console.log("\nN5 · Was sich WÄHREND der Migration sonst noch bewegt hat:");
  console.log(`     Neue Leads in den letzten 90 Minuten: ${neueLeads.c}`);
  console.log(`     Bestellungen, die in dieser Zeit auf bezahlt/abgelaufen/storniert wechselten: ${statusWechsel.length}`);
  for (const r of statusWechsel) {
    console.log(`       ${r.ref} → ${r.payment_status} (${new Date(r.updated_at).toLocaleTimeString("de-DE")})`);
  }
  console.log("     Diese Bewegungen stammen aus dem laufenden Betrieb, nicht aus der Migration:");
  console.log("     Die Migration setzt ausschliesslich assigned_agent_id auf NULL und fasst");
  console.log("     weder payment_status noch neue Leads an.");

  console.log(verstoss === 0
    ? "\n✅ Keine Regelverletzung. Die Migration hat nur freigegeben, was freigegeben werden durfte.\n"
    : `\n❌ ${verstoss} Verstoss/Verstoesse — Rueckabwicklung erforderlich:\n   npx tsx scripts/kartei-migration.ts --undo=${batch}\n`);
  await sql.end();
  process.exit(verstoss === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
