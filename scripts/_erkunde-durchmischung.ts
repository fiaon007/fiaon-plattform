import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });
const heute = (() => { const d = new Date(); d.setHours(12,0,0,0); return d.toISOString().slice(0,10); })();
(async () => {
  console.log(`Berlin heute: ${heute}\n`);

  console.log("=== 1) BEZAHLTE Kunden, die noch in einer Anrufliste stehen ===");
  const bezahltDrin = await sql`
    SELECT p.id, p.assigned_agent_id, ag.name AS agent, p.priority_tier, p.tier_reason,
           p.follow_up_date, p.promised_payment_date, p.is_blocked,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)),''), p.company_name, p.primary_email) AS name
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.assigned_agent_id IS NOT NULL
      AND (p.promised_payment_date <= ${heute}::date OR (p.follow_up_date IS NOT NULL AND p.follow_up_date <= ${heute}::date))
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id=p.id AND a.merged_into IS NULL AND a.payment_status='paid')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id=p.id AND a.merged_into IS NULL
                        AND a.payment_status IN ('pending_payment','claimed_paid'))`;
  console.log(`  ${bezahltDrin.length} Personen: alles bezahlt, stehen aber heute/überfällig in der Liste`);
  for (const r of bezahltDrin.slice(0, 8)) console.log(`    ${String(r.name).slice(0,26).padEnd(28)} Agent ${r.agent} · Tier ${r.priority_tier} (${r.tier_reason}) WV=${r.follow_up_date ? String(r.follow_up_date).slice(0,10) : "-"} Zusage=${r.promised_payment_date ? String(r.promised_payment_date).slice(0,10):"-"}`);

  console.log("\n=== 2) Person bei Agent A, aber bezahlt/betreut von Agent B ===");
  const kreuz = await sql`
    SELECT p.id, pa.name AS person_agent, aa.name AS bestell_agent,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)),''), p.company_name) AS name,
           a.payment_status, a.ref
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
    LEFT JOIN fiaon_agents pa ON pa.id = p.assigned_agent_id
    LEFT JOIN fiaon_agents aa ON aa.id = a.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND a.assigned_agent_id IS NOT NULL AND a.assigned_agent_id <> p.assigned_agent_id`;
  console.log(`  ${kreuz.length} Fälle, in denen Person und Bestellung verschiedenen Agenten gehören`);
  for (const r of kreuz.slice(0, 8)) console.log(`    ${String(r.name).slice(0,24).padEnd(26)} Person→${r.person_agent} · Bestellung→${r.bestell_agent} (${r.payment_status})`);

  console.log("\n=== 3) Letztes Ergebnis „abgelehnt“, aber NICHT gesperrt ===");
  const abgelehnt = await sql`
    SELECT p.id, ag.name AS agent, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)),''), p.company_name) AS name,
           (SELECT c.outcome FROM fiaon_contact_log c JOIN fiaon_applications ap ON ap.ref=c.ref
             WHERE ap.person_id=p.id AND c.type='result' AND c.voided_at IS NULL
             ORDER BY c.created_at DESC LIMIT 1) AS letztes
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id=p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked`;
  const nurAbgelehnt = abgelehnt.filter((r: any) => r.letztes === "erreicht_abgelehnt");
  console.log(`  ${nurAbgelehnt.length} Personen: letztes Ergebnis „abgelehnt“, trotzdem nicht gesperrt`);
  for (const r of nurAbgelehnt.slice(0, 6)) console.log(`    ${String(r.name).slice(0,26).padEnd(28)} Agent ${r.agent} WV=${r.follow_up_date ? String(r.follow_up_date).slice(0,10):"-"}`);

  console.log("\n=== 4) Was macht onCustomerPaid mit der Person? ===");
  const [zuletztBezahlt] = await sql`
    SELECT a.ref, a.person_id, a.completed_at, p.priority_tier, p.tier_reason, p.follow_up_date, p.promised_payment_date, p.is_blocked, p.assigned_agent_id
    FROM fiaon_applications a JOIN fiaon_persons p ON p.id=a.person_id
    WHERE a.payment_status='paid' AND a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT 1`;
  console.log(`  Letzte Zahlung ${zuletztBezahlt.ref} (${String(zuletztBezahlt.completed_at).slice(0,21)})`);
  console.log(`  Person danach: Tier ${zuletztBezahlt.priority_tier} (${zuletztBezahlt.tier_reason}) · WV ${zuletztBezahlt.follow_up_date ? String(zuletztBezahlt.follow_up_date).slice(0,10):"-"} · Zusage ${zuletztBezahlt.promised_payment_date ? String(zuletztBezahlt.promised_payment_date).slice(0,10):"-"} · gesperrt ${zuletztBezahlt.is_blocked}`);

  console.log("\n=== 5) Mail-Ereignisse der Agenten: kommen sie an? ===");
  const [ev] = await sql`SELECT value FROM fiaon_settings WHERE key='make_last_events'`;
  console.log("  Letzte erfolgreiche Make-Events:", ev?.value ? JSON.stringify(JSON.parse(ev.value)).slice(0, 400) : "keine");
  const [mails] = await sql`
    SELECT COUNT(*) FILTER (WHERE type='email_sent')::int gesendet,
           MAX(created_at) FILTER (WHERE type='email_sent') AS letzte
    FROM fiaon_contact_log WHERE created_at > NOW() - INTERVAL '7 days'`;
  console.log(`  Agenten-Mails im Verlauf (7 Tage): ${mails.gesendet}, letzte ${mails.letzte || "-"}`);
  await sql.end();
})();
