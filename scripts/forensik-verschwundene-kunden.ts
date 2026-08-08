// ═══════════════════════════════════════════════════════════════════
// PHASE-0-FORENSIK: „Dubletten & verschwundene Kunden" — die konkret
// gemeldeten Agent-Tickets (#18–#27). NUR LESEND — keine Schreiboperationen.
// Ausgabe für SYSTEM_DIAGNOSE.md (D5). Aufruf (kein Heredoc):
//   npx tsx scripts/forensik-verschwundene-kunden.ts
//
// Beantwortet je Person: alle Datensätze, Status, payment_status,
// merged_into/superseded_by, zugewiesener Agent, Provision, bezahlt ja/nein —
// und die Kernfrage: Altfall oder NACH der Prävention entstanden?
// ═══════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });

// Die real gemeldeten Namen aus den offenen Tickets #18–#27.
const NAMES = [
  ["Samira", "Jusic"],       // #25/#26 — nach Juli-Merge wieder aufgetaucht?
  ["Veronika", "Szekula"],   // #24
  ["Erwin", "Brunauer"],
  ["icoana", "gerne"],
  ["Erika", "Becker"],       // #25
  ["Reinhold", "Müller"],    // #26
  ["Anna", "Weber"],         // #19 (Referenz FIAON-NURC9W)
  ["Momir", "Jovanovic"],    // #27 — zahlte über Konto der Mutter
  ["Alan", "Imsirovic"],     // #18 — bezahlt 30.06.
  ["Ilija", "Dzankic"],      // #20 — Ultra-Paket zeigt 250 €
];

// Direkte Referenz-Lookups (falls der Name mehrdeutig/anders geschrieben ist).
const REFS = ["FIAON-NURC9W"];

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

  // Direkte Referenz-Lookups (z. B. Anna Weber #19 → FIAON-NURC9W).
  for (const refPart of REFS) {
    console.log(`\n═══════════ Referenz ${refPart} ═══════════`);
    const apps = await sql`
      SELECT ref, first_name, last_name, contact_name, email, phone, payment_status, status,
             assigned_agent_id, merged_into, superseded_by, amount_due, pack_name,
             claimed_paid_at, completed_at, created_at, updated_at
      FROM fiaon_applications
      WHERE ref ILIKE ${"%" + refPart + "%"} OR payment_reference ILIKE ${"%" + refPart + "%"}
      ORDER BY created_at ASC
    `;
    console.log(`— Treffer: ${apps.length}`);
    for (const a of apps) console.log(JSON.stringify(a, null, 1));
  }

  // Agenten Daniel Stripling + Florentine Lombardi (für Zuordnungs-Check)
  console.log(`\n═══════════ Agenten ═══════════`);
  const agents = await sql`SELECT id, name, email, active FROM fiaon_agents WHERE name ILIKE '%stripling%' OR name ILIKE '%lombardi%'`;
  for (const a of agents) console.log(JSON.stringify(a));

  // ── KERNFRAGE: Entstehen Dubletten NACH der Prävention? ──────────────
  // Datensätze, die in einen BEZAHLTEN/aktiven Schwester-Datensatz hätten
  // verknüpft werden müssen, aber (noch) eigenständig als Kunde sichtbar sind.
  console.log(`\n═══════════ Bezahlte Doppelzahler (E-Mail) ═══════════`);
  const dblEmail = await sql`
    SELECT LOWER(TRIM(email)) AS email, COUNT(*)::int AS n, array_agg(ref) AS refs,
           SUM(amount_due)::numeric AS summe
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
      AND ref NOT LIKE 'FIAON-SCHUFA-%'
    GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  console.log(`Gruppen mit >1 bezahltem Datensatz (ohne SCHUFA): ${dblEmail.length}`);
  for (const g of dblEmail) console.log(`  ${g.email}: ${g.n}× — ${g.refs.join(", ")} (Summe ${Number(g.summe).toFixed(2)}€)`);

  console.log(`\n═══════════ Sichtbare offene Anträge, die eine BEZAHLTE Schwester haben (E-Mail) ═══════════`);
  const reappear = await sql`
    SELECT o.ref AS offen_ref, o.payment_status, o.assigned_agent_id, o.created_at,
           p.ref AS bezahlt_ref, LOWER(TRIM(o.email)) AS email
    FROM fiaon_applications o
    JOIN fiaon_applications p
      ON LOWER(TRIM(p.email)) = LOWER(TRIM(o.email))
     AND p.payment_status = 'paid' AND p.merged_into IS NULL AND p.ref <> o.ref
    WHERE o.merged_into IS NULL
      AND o.payment_status IN ('pending_payment','claimed_paid','expired')
      AND o.email IS NOT NULL AND TRIM(o.email) <> ''
      AND o.ref NOT LIKE 'FIAON-SCHUFA-%' AND p.ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY o.created_at DESC
  `;
  console.log(`Offene Anträge trotz bezahlter Schwester (= landen wieder in Agenten-Ansicht): ${reappear.length}`);
  for (const r of reappear.slice(0, 40))
    console.log(`  offen ${r.offen_ref} (${r.payment_status}, Agent ${r.assigned_agent_id ?? "—"}, ${new Date(r.created_at).toISOString().slice(0,10)}) ↔ bezahlt ${r.bezahlt_ref} [${r.email}]`);

  console.log(`\n═══════════ EINE WAHRHEIT (bezahlt + Umsatz) ═══════════`);
  const [t] = await sql`
    SELECT COUNT(*)::int AS bezahlt,
           COALESCE(SUM(ROUND(COALESCE(amount_due::numeric,0)*100)),0)::bigint AS umsatz_cents
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND NOT COALESCE(alt_bestand, FALSE)
  `;
  console.log(`bezahlt: ${t.bezahlt} · Umsatz: ${(Number(t.umsatz_cents)/100).toFixed(2)} €`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
