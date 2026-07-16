// ════════════════════════════════════════════════════════════════════
// PHASE 0 — Messbericht (NUR LESEND, ändert NICHTS).
//   A) Zeitzonen-Altbestand: zukünftige Rückrufe/Zusagen, Versatz einheitlich?
//   B) Strenger Lead-Filter: wie viel Bestand bleibt anrufbar? Sequenz-Check.
// Aufruf:  npx tsx scripts/phase0-report.ts        (nutzt DATABASE_URL aus .env)
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";
import { berlinOffsetMinutes, formatBerlin } from "../server/lib/fiaon-time";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });

const isAdminActor = (name: string | null, id: number | null) =>
  id == null || /^(admin|system)$/i.test((name || "").trim());

function classify(rows: { scheduled: Date; actor: string | null; actorId: number | null }[]) {
  let summer = 0, winter = 0, byAgent = 0, byAdmin = 0;
  for (const r of rows) {
    const off = berlinOffsetMinutes(r.scheduled);
    if (off === 120) summer++; else winter++;
    if (isAdminActor(r.actor, r.actorId)) byAdmin++; else byAgent++;
  }
  return { summer, winter, byAgent, byAdmin };
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`  PHASE 0 — Messbericht  ·  ${new Date().toISOString()}`);
  console.log(`  (read-only; jetzt ${formatBerlin(new Date().toISOString())} Berlin)`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  // ─────────────────────────────────────────────────────────────────
  // A) ZEITZONEN-ALTBESTAND
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n===== A) ZEITZONEN-ALTBESTAND =====`);

  // A1: Kunden-Rückrufe (contact_log.scheduled_at), offen & zukünftig.
  const custCbAll = await sql`
    SELECT COUNT(*)::int AS n
    FROM fiaon_contact_log
    WHERE scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL`;
  const custCbFuture = await sql`
    SELECT id, ref, agent_id, agent_name, scheduled_at
    FROM fiaon_contact_log
    WHERE scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL
      AND scheduled_at > NOW()
    ORDER BY scheduled_at ASC`;

  // A2: Kunden-Zahlungszusagen (applications.promised_pay_date), zukünftig.
  const promAll = await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE promised_pay_date IS NOT NULL AND merged_into IS NULL`;
  const promFuture = await sql`
    SELECT ref, assigned_agent_id, promised_pay_date
    FROM fiaon_applications
    WHERE promised_pay_date IS NOT NULL AND merged_into IS NULL AND promised_pay_date > NOW()
    ORDER BY promised_pay_date ASC`;

  // A3: Lead-Rückrufe (lead_log.scheduled_at), zukünftig (distinct je Lead = neuester offener).
  const leadCbFuture = await sql`
    SELECT DISTINCT ON (lead_id) id, lead_id, agent_id, agent_name, scheduled_at
    FROM fiaon_lead_log
    WHERE scheduled_at IS NOT NULL AND scheduled_at > NOW()
    ORDER BY lead_id, scheduled_at DESC`;

  const custRows = custCbFuture.map((r: any) => ({ scheduled: new Date(r.scheduled_at), actor: r.agent_name, actorId: r.agent_id }));
  const leadRows = leadCbFuture.map((r: any) => ({ scheduled: new Date(r.scheduled_at), actor: r.agent_name, actorId: r.agent_id }));
  const promRows = promFuture.map((r: any) => ({ scheduled: new Date(r.promised_pay_date), actor: null, actorId: r.assigned_agent_id }));

  const cCust = classify(custRows), cLead = classify(leadRows);

  console.log(`\nA1 Kunden-Rückrufe (contact_log):`);
  console.log(`   gesamt offen: ${custCbAll[0].n}  ·  davon ZUKÜNFTIG (relevant): ${custCbFuture.length}`);
  console.log(`   → Sommer(+2h): ${cCust.summer}  Winter(+1h): ${cCust.winter}  |  Quelle Agent: ${cCust.byAgent}  Admin/System: ${cCust.byAdmin}`);
  console.log(`\nA2 Zahlungs-Zusagen (applications.promised_pay_date):`);
  console.log(`   gesamt: ${promAll[0].n}  ·  davon ZUKÜNFTIG (relevant): ${promFuture.length}`);
  console.log(`\nA3 Lead-Rückrufe (lead_log, distinct je Lead):`);
  console.log(`   ZUKÜNFTIG (relevant): ${leadCbFuture.length}`);
  console.log(`   → Sommer(+2h): ${cLead.summer}  Winter(+1h): ${cLead.winter}  |  Quelle Agent: ${cLead.byAgent}  Admin/System: ${cLead.byAdmin}`);

  console.log(`\nBeispiele Kunden-Rückrufe (gespeichert → als Berlin angezeigt → so würde Korrektur aussehen):`);
  for (const r of custCbFuture.slice(0, 8)) {
    const d = new Date(r.scheduled_at);
    const off = berlinOffsetMinutes(d);
    const corrected = new Date(d.getTime() - off * 60000);
    console.log(`   #${r.id} ${r.ref} [${r.agent_name}] gespeichert=${d.toISOString()} | zeigt ${formatBerlin(d.toISOString())} | korrigiert→ ${formatBerlin(corrected.toISOString())} (−${off}min)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // B) STRENGER LEAD-FILTER
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n\n===== B) STRENGER LEAD-FILTER (Agenten-Warteschlange) =====`);

  // dismissed_at wird erst beim Deploy per ensureLeadTables() ergänzt — hier
  // defensiv prüfen, damit der Bericht auch gegen die aktuelle Prod-DB läuft.
  const [colChk] = await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'fiaon_leads' AND column_name = 'dismissed_at'`;
  const hasDismissed = colChk.n > 0;
  const notDismissed = hasDismissed ? "AND dismissed_at IS NULL" : "";
  const notDismissedL = hasDismissed ? "AND l.dismissed_at IS NULL" : "";
  console.log(`   (Spalte dismissed_at vorhanden: ${hasDismissed ? "ja" : "NEIN — wird beim Deploy ergänzt"})`);

  const open = `status IN ('neu','kontaktiert','nicht_erreichbar')`;
  const hasTel = `COALESCE(telefon,'') <> ''`;
  const hasMail = `COALESCE(email,'') <> ''`;
  const hasName = `(COALESCE(vorname,'') <> '' OR COALESCE(nachname,'') <> '')`;

  // B1: pro Agent — gesamt offen vs. anrufbar (Queue-Regel: Tel+Mail+Name).
  const perAgent = await sql.unsafe(`
    SELECT ag.id, ag.name,
      COUNT(l.id)::int AS total_open,
      COUNT(l.id) FILTER (WHERE COALESCE(l.telefon,'') <> '' AND COALESCE(l.email,'') <> '' AND (COALESCE(l.vorname,'') <> '' OR COALESCE(l.nachname,'') <> ''))::int AS anrufbar
    FROM fiaon_agents ag
    LEFT JOIN fiaon_leads l ON l.assigned_agent_id = ag.id AND l.${open} ${notDismissedL}
    GROUP BY ag.id, ag.name ORDER BY ag.id`);
  console.log(`\nB1 Pro Agent (offene Leads → anrufbar nach Queue-Regel Tel+Mail+Name):`);
  for (const r of perAgent) console.log(`   ${r.name}: ${r.total_open} → ${r.anrufbar} anrufbar`);

  // B2: Gesamtbestand offener Leads, aufgeschlüsselt nach Vollständigkeit.
  const [b2] = await sql.unsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ${hasTel} AND ${hasMail} AND ${hasName})::int AS vollstaendig,
      COUNT(*) FILTER (WHERE ${hasMail} AND NOT (${hasTel}))::int AS nur_email,
      COUNT(*) FILTER (WHERE ${hasTel} AND NOT (${hasMail}))::int AS nur_telefon,
      COUNT(*) FILTER (WHERE NOT (${hasTel}) AND NOT (${hasMail}))::int AS weder_noch,
      COUNT(*) FILTER (WHERE ${hasTel} AND ${hasMail} AND NOT (${hasName}))::int AS tel_mail_ohne_name
    FROM fiaon_leads WHERE ${open} ${notDismissed}`);
  console.log(`\nB2 Gesamtbestand offener Leads (${b2.total}):`);
  console.log(`   vollständig (Tel+Mail+Name): ${b2.vollstaendig}`);
  console.log(`   nur E-Mail (kein Tel): ${b2.nur_email}`);
  console.log(`   nur Telefon (keine Mail): ${b2.nur_telefon}`);
  console.log(`   weder noch: ${b2.weder_noch}`);
  console.log(`   Tel+Mail vorhanden, aber Name fehlt: ${b2.tel_mail_ohne_name}`);

  // B3: Bleiben "nur E-Mail"-Leads in der Nachfass-Sequenz? (Engine: email OR telefon + in_sequence)
  const [b3] = await sql.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE ${hasMail} AND NOT (${hasTel}))::int AS nur_email_total,
      COUNT(*) FILTER (WHERE ${hasMail} AND NOT (${hasTel}) AND in_sequence = TRUE)::int AS nur_email_in_seq
    FROM fiaon_leads WHERE ${open}`);
  console.log(`\nB3 Nachfass-Sequenz-Check (nur-E-Mail-Leads):`);
  console.log(`   nur-E-Mail offen: ${b3.nur_email_total}  ·  davon in_sequence=TRUE (werden angeschrieben): ${b3.nur_email_in_seq}`);

  // B4: Kampagnen, die Leads OHNE Telefon liefern (Anteil).
  const camp = await sql.unsafe(`
    SELECT COALESCE(NULLIF(kampagne,''), NULLIF(quelle,''), '(ohne)') AS kampagne,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE NOT (${hasTel}))::int AS ohne_telefon
    FROM fiaon_leads WHERE ${open}
    GROUP BY 1 HAVING COUNT(*) FILTER (WHERE NOT (${hasTel})) > 0
    ORDER BY ohne_telefon DESC LIMIT 15`);
  console.log(`\nB4 Kampagnen/Quellen mit Leads OHNE Telefon (Top 15):`);
  for (const r of camp) {
    const pct = r.total > 0 ? Math.round((r.ohne_telefon / r.total) * 100) : 0;
    console.log(`   ${r.kampagne}: ${r.ohne_telefon}/${r.total} ohne Telefon (${pct}%)`);
  }

  // B5: Merge-Rettung (Schätzung): offene Leads OHNE Telefon, deren E-Mail auf
  //     einem anderen Datensatz mit Telefon existiert → würden anrufbar.
  const [b5a] = await sql.unsafe(`
    WITH noTel AS (
      SELECT id, LOWER(TRIM(email)) AS em FROM fiaon_leads
      WHERE ${open} ${notDismissed} AND NOT (${hasTel}) AND ${hasMail}
    )
    SELECT COUNT(DISTINCT n.id)::int AS rescuable FROM noTel n
    WHERE EXISTS (
      SELECT 1 FROM fiaon_leads l2 WHERE LOWER(TRIM(l2.email)) = n.em AND COALESCE(l2.telefon,'') <> ''
    ) OR EXISTS (
      SELECT 1 FROM fiaon_applications a WHERE LOWER(TRIM(a.email)) = n.em AND COALESCE(a.phone,'') <> '' AND a.merged_into IS NULL
    )`);
  console.log(`\nB5 Merge-Rettung (Schätzung):`);
  console.log(`   offene Leads ohne Telefon, aber E-Mail existiert mit Telefon anderswo → anrufbar machbar: ${b5a.rescuable}`);

  console.log(`\n─── Ende Phase-0-Bericht (read-only) ───\n`);
  await sql.end();
}
main().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
