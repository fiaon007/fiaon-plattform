// ═══════════════════════════════════════════════════════════════════
// PHASE-0-FORENSIK: „Verschwundene Kunden" (Agent-Feedback 14.07.26)
// NUR LESEND — keine Schreiboperationen. Ausgabe für AGENT_REVAMPT_AUDIT.md.
// Aufruf: npx tsx scripts/forensik-verschwundene-kunden.ts
// ═══════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });

const NAMES = [
  ["Gökay", "Terzi"],
  ["Götkan", "Terzi"],
  ["Samura", "Jusic"],
  ["Ilijana", "Weber"],
  ["Martin", "Dambok"],
];

async function main() {
  for (const [first, last] of NAMES) {
    console.log(`\n═══════════ ${first} ${last} ═══════════`);

    // Kunden (fiaon_applications) — tolerant: Teilstring auf Vor- ODER Nachname
    const apps = await sql`
      SELECT ref, first_name, last_name, contact_name, email, phone, payment_status, status,
             account_status, assigned_agent_id, merged_into, superseded_by, amount_due,
             claimed_paid_at, promised_pay_date, completed_at, reminder_count, last_reminder_at,
             confirmed_email_sent_at, created_at, updated_at
      FROM fiaon_applications
      WHERE (first_name ILIKE ${"%" + first + "%"} AND last_name ILIKE ${"%" + last + "%"})
         OR last_name ILIKE ${"%" + last + "%"}
         OR contact_name ILIKE ${"%" + first + "%" + last + "%"}
      ORDER BY created_at ASC
    `;
    console.log(`— fiaon_applications: ${apps.length} Treffer`);
    for (const a of apps) {
      console.log(JSON.stringify(a, null, 1));
      const agent = a.assigned_agent_id
        ? await sql`SELECT id, name, email, active FROM fiaon_agents WHERE id = ${a.assigned_agent_id}`
        : [];
      if (agent.length) console.log(`   → zugewiesener Agent: #${agent[0].id} ${agent[0].name} (active=${agent[0].active})`);
      const log = await sql`
        SELECT type, outcome, note, agent_name, created_at FROM fiaon_contact_log
        WHERE ref = ${a.ref} ORDER BY created_at DESC LIMIT 8
      `;
      console.log(`   → letzte Kontakt-Log-Einträge (${log.length}):`);
      for (const l of log) console.log(`     ${l.created_at?.toISOString?.() || l.created_at} [${l.type}/${l.outcome || "-"}] ${l.agent_name}: ${(l.note || "").slice(0, 120)}`);
      // Bank-Abgleich?
      const txns = await sql`SELECT id, txn_id, amount_cents, applied, applied_at, match_status FROM fiaon_bank_txns WHERE matched_ref = ${a.ref}`;
      for (const t of txns) console.log(`   → Bank-Txn #${t.id} ${t.amount_cents / 100}€ applied=${t.applied} (${t.match_status})`);
      // Provision?
      const comm = await sql`SELECT id, agent_id, amount_cents, status, kind, created_at FROM fiaon_commissions WHERE ref = ${a.ref}`;
      console.log(`   → Provisionen: ${comm.length ? comm.map((c: any) => `#${c.id} Agent ${c.agent_id} ${c.amount_cents / 100}€ ${c.status}/${c.kind}`).join("; ") : "KEINE"}`);
    }

    // Leads (fiaon_leads)
    const leads = await sql`
      SELECT id, vorname, nachname, email, telefon, status, assigned_agent_id, converted_order_id,
             konvertiert_am, in_sequence, lead_reminder_count, erstellt_am, updated_at
      FROM fiaon_leads
      WHERE (vorname ILIKE ${"%" + first + "%"} AND nachname ILIKE ${"%" + last + "%"})
         OR nachname ILIKE ${"%" + last + "%"}
      ORDER BY erstellt_am ASC
    `;
    console.log(`— fiaon_leads: ${leads.length} Treffer`);
    for (const l of leads) {
      console.log(JSON.stringify(l, null, 1));
      const log = await sql`SELECT type, outcome, note, agent_name, created_at FROM fiaon_lead_log WHERE lead_id = ${l.id} ORDER BY created_at DESC LIMIT 8`;
      for (const e of log) console.log(`   ${e.created_at?.toISOString?.() || e.created_at} [${e.type}/${e.outcome || "-"}] ${e.agent_name}: ${(e.note || "").slice(0, 120)}`);
    }
  }

  // Agenten Daniel Stripling + Florentine Lombardi (für Zuordnungs-Check)
  console.log(`\n═══════════ Agenten ═══════════`);
  const agents = await sql`SELECT id, name, email, active FROM fiaon_agents WHERE name ILIKE '%stripling%' OR name ILIKE '%lombardi%'`;
  for (const a of agents) console.log(JSON.stringify(a));

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
