// ═══════════════════════════════════════════════════════════════════
// P3-REPORT — konsolidierte Read-only-Diagnose (ändert NICHTS).
// Beantwortet in einem Lauf:
//  1. Lösch-Forensik: verwaiste Verweise (Hinweis auf früheres Hard-Delete)
//  2. Phase-0 Zeitzonen: betroffene zukünftige Termine, Versatz einheitlich?
//  3. Lead-Filter: anrufbarer Bestand je Agent + nur-E-Mail in Sequenz?
//  4. Doppelzahler: gleiche Person mit >1 bezahlten Bestellung
//  5. „Eine Wahrheit": bezahlt + Umsatz
//  6. Anrufbarkeits-Gewinn durch Telefon-Merge
//  7. Daten-Präsenz: Investoren / Buchhaltung / Ledger (P3-B-Entscheidung)
//
// Aufruf:  npx tsx scripts/p3-report.ts
// ═══════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });

function h(t: string) { console.log(`\n═══════════ ${t} ═══════════`); }

async function tableExists(name: string): Promise<boolean> {
  const [r] = await sql`SELECT to_regclass(${"public." + name}) AS t`;
  return !!r.t;
}
async function count(name: string): Promise<number | null> {
  if (!(await tableExists(name))) return null;
  const [r] = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM ${name}`);
  return Number(r.c);
}

async function main() {
  // 1) LÖSCH-FORENSIK ────────────────────────────────────────────────
  h("1) Lösch-Forensik (verwaiste Verweise = Hinweis auf früheres Hard-Delete)");
  const [orphanLogs] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_contact_log cl
    WHERE cl.ref IS NOT NULL AND cl.ref <> 'SYSTEM'
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = cl.ref)
  `;
  const [orphanComm] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_commissions c
    WHERE NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = c.ref)
  `;
  const [orphanLeads] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_leads l
    WHERE l.converted_order_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = l.converted_order_id)
  `;
  console.log(`Verwaiste Kontakt-Logs (ref ohne Antrag):   ${orphanLogs.c}`);
  console.log(`Verwaiste Provisionen (ref ohne Antrag):     ${orphanComm.c}`);
  console.log(`Leads mit converted_order_id ohne Antrag:    ${orphanLeads.c}`);
  console.log(`→ Alle 0 = kein Antrag wurde je hart gelöscht. >0 = Datensätze wurden über den alten /merge-Endpoint entfernt (Verweise blieben verwaist).`);
  if (await tableExists("fiaon_merge_log")) {
    const [ml] = await sql`SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE undone_at IS NULL)::int AS aktiv FROM fiaon_merge_log`;
    console.log(`fiaon_merge_log: ${ml.c} Merges protokolliert (${ml.aktiv} aktiv) — neue Soft-Merges ab jetzt.`);
  } else {
    console.log(`fiaon_merge_log: existiert noch nicht (bisher kein Soft-Merge ausgeführt).`);
  }

  // 2) ZEITZONEN ──────────────────────────────────────────────────────
  h("2) Phase-0 Zeitzonen — zukünftige Termine/Zusagen");
  const cbCust = await sql`
    SELECT id, ref, scheduled_at, promised_date FROM fiaon_contact_log
    WHERE (scheduled_at IS NOT NULL OR promised_date IS NOT NULL)
      AND done_at IS NULL AND voided_at IS NULL
      AND COALESCE(scheduled_at, promised_date) >= NOW()
    ORDER BY COALESCE(scheduled_at, promised_date) ASC
  `;
  const cbLead = await sql`
    SELECT id, scheduled_at FROM fiaon_lead_log
    WHERE scheduled_at IS NOT NULL AND scheduled_at >= NOW() ORDER BY scheduled_at ASC
  `;
  // Versatz-Analyse: Stunde (Berlin) der Uhrzeit — Häufung auf „krummen" Minuten deutet auf einheitlichen Offset.
  const minuteDist = new Map<number, number>();
  for (const r of [...cbCust, ...cbLead]) {
    const d = r.scheduled_at || (r as any).promised_date;
    if (!d) continue;
    const m = new Date(d).getUTCMinutes();
    minuteDist.set(m, (minuteDist.get(m) || 0) + 1);
  }
  console.log(`Kunden-Termine (zukünftig, offen): ${cbCust.length}`);
  console.log(`Lead-Rückrufe (zukünftig):         ${cbLead.length}`);
  console.log(`Minuten-Verteilung (UTC): ${JSON.stringify(Object.fromEntries(minuteDist))}`);
  const berlin = (d: any) => d ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "—";
  for (const r of cbCust.slice(0, 12)) console.log(`  #${r.id} ${r.ref} → Berlin ${berlin(r.scheduled_at || r.promised_date)} (UTC ${new Date(r.scheduled_at || r.promised_date).toISOString()})`);

  // 3) LEAD-FILTER je Agent ───────────────────────────────────────────
  h("3) Lead-Filter — anrufbarer Bestand je Agent");
  // dismissed_at kann in älteren DBs fehlen (Migration läuft erst zur Laufzeit).
  const [dc] = await sql`SELECT COUNT(*)::int AS c FROM information_schema.columns WHERE table_name='fiaon_leads' AND column_name='dismissed_at'`;
  const notDismissed = dc.c > 0 ? "AND l.dismissed_at IS NULL" : "";
  const notDismissed2 = dc.c > 0 ? "AND dismissed_at IS NULL" : "";
  const perAgent = await sql.unsafe(`
    SELECT a.id, a.name,
      COUNT(*) FILTER (WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar') ${notDismissed})::int AS offen,
      COUNT(*) FILTER (WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar') ${notDismissed}
                        AND l.telefon IS NOT NULL AND TRIM(l.telefon) <> '')::int AS anrufbar
    FROM fiaon_agents a
    LEFT JOIN fiaon_leads l ON l.assigned_agent_id = a.id
    WHERE a.active = TRUE
    GROUP BY a.id, a.name
    HAVING COUNT(l.id) > 0
    ORDER BY 3 DESC
  `);
  for (const a of perAgent) console.log(`  ${a.name}: ${a.offen} offen → ${a.anrufbar} anrufbar (${a.offen - a.anrufbar} ohne Nummer)`);
  const [seq] = await sql.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE (telefon IS NULL OR TRIM(telefon)='') AND email IS NOT NULL AND TRIM(email)<>'' AND in_sequence = TRUE AND status IN ('neu','kontaktiert','nicht_erreichbar') ${notDismissed2})::int AS nur_email_in_seq,
      COUNT(*) FILTER (WHERE (telefon IS NULL OR TRIM(telefon)='') AND email IS NOT NULL AND TRIM(email)<>'' AND status IN ('neu','kontaktiert','nicht_erreichbar') ${notDismissed2})::int AS nur_email_total
    FROM fiaon_leads
  `);
  console.log(`Nur-E-Mail-Leads (offen): ${seq.nur_email_total} — davon in Nachfass-Sequenz: ${seq.nur_email_in_seq}`);
  console.log(`→ Sind beide Zahlen gleich, landen alle nur-E-Mail-Leads korrekt im Mailing.`);

  // 4) DOPPELZAHLER ───────────────────────────────────────────────────
  h("4) Doppelzahler — gleiche Person mit >1 bezahlten Bestellung");
  const dblEmail = await sql`
    SELECT LOWER(TRIM(email)) AS email, COUNT(*)::int AS n, SUM(amount_due)::numeric AS summe, array_agg(ref) AS refs
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  console.log(`Bezahlte Dubletten-Gruppen (per E-Mail): ${dblEmail.length}`);
  for (const g of dblEmail) console.log(`  ${g.email}: ${g.n}× bezahlt, Summe ${Number(g.summe).toFixed(2)}€ — refs: ${g.refs.join(", ")}`);

  // 5) EINE WAHRHEIT ──────────────────────────────────────────────────
  h("5) Eine Wahrheit — bezahlt + Umsatz");
  const [t] = await sql`
    SELECT COUNT(*)::int AS bezahlt,
           COALESCE(SUM(ROUND(COALESCE(amount_due::numeric,0)*100)),0)::bigint AS umsatz_cents
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND NOT COALESCE(alt_bestand, FALSE)
  `;
  console.log(`bezahlt: ${t.bezahlt} · Umsatz: ${(Number(t.umsatz_cents)/100).toFixed(2)} €`);

  // 6) ANRUFBARKEITS-GEWINN durch Telefon-Merge ───────────────────────
  h("6) Anrufbarkeits-Gewinn — nicht-anrufbare Leads, die per Merge eine Nummer bekämen");
  const [gain] = await sql.unsafe(`
    WITH ohne_nr AS (
      SELECT id, LOWER(TRIM(email)) AS email FROM fiaon_leads
      WHERE (telefon IS NULL OR TRIM(telefon)='') AND email IS NOT NULL AND TRIM(email)<>''
        AND status IN ('neu','kontaktiert','nicht_erreichbar') ${notDismissed2}
    ),
    mit_nr AS (
      SELECT DISTINCT LOWER(TRIM(email)) AS email FROM fiaon_applications
      WHERE merged_into IS NULL AND phone IS NOT NULL AND TRIM(phone)<>'' AND email IS NOT NULL
      UNION
      SELECT DISTINCT LOWER(TRIM(email)) FROM fiaon_leads WHERE telefon IS NOT NULL AND TRIM(telefon)<>'' AND email IS NOT NULL
    )
    SELECT COUNT(*)::int AS c FROM ohne_nr o WHERE EXISTS (SELECT 1 FROM mit_nr m WHERE m.email = o.email)
  `);
  console.log(`Nicht-anrufbare Leads, die per E-Mail-Merge eine Telefonnummer erben könnten: ${gain.c}`);

  // 7) DATEN-PRÄSENZ (P3-B) ───────────────────────────────────────────
  h("7) Daten-Präsenz — Investoren / Buchhaltung / Ledger (P3-B-Entscheidung)");
  for (const tbl of ["investors", "investor_investments", "investor_requests", "investor_transactions",
                     "accounting_entries", "accounting_balance", "accounting_ledger", "accounting_config"]) {
    const c = await count(tbl);
    console.log(`  ${tbl.padEnd(24)}: ${c === null ? "— (Tabelle existiert nicht)" : c + " Zeilen"}`);
  }
  console.log(`→ 0 Zeilen / nicht vorhanden = entfernen. Echte FIAON-Daten = behalten bzw. mit /admin/verbuchungen zusammenführen.`);

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
