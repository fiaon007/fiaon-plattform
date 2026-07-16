// Ticket #13 — Bestandsschaden MESSEN (read-only, korrigiert NICHTS).
//
// Vor dem Fix wurden naive datetime-local-Eingaben über `new Date(...)` auf einem
// UTC-Server als UTC gespeichert (statt als Berlin-Zeit). Dieser Report zählt die
// betroffenen ZUKÜNFTIGEN Termine/Zusagen und zeigt Beispiele — als Grundlage für
// eine spätere, ausdrücklich freizugebende Einmal-Korrektur. Es wird NICHTS geändert.
//
// Aufruf:  DATABASE_URL=... npx tsx scripts/measure-callback-offset.ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });

async function main() {
  // Alle offenen, zukünftigen Rückruf-Termine + Zahlungs-Zusagen ab jetzt.
  const rows = await sql`
    SELECT id, ref, agent_name, outcome, scheduled_at, promised_date, created_at
    FROM fiaon_contact_log
    WHERE (scheduled_at IS NOT NULL OR promised_date IS NOT NULL)
      AND done_at IS NULL AND voided_at IS NULL
      AND COALESCE(scheduled_at, promised_date) >= NOW()
    ORDER BY COALESCE(scheduled_at, promised_date) ASC
  `;
  const leadRows = await sql`
    SELECT id, lead_id, agent_name, outcome, scheduled_at, created_at
    FROM fiaon_lead_log
    WHERE scheduled_at IS NOT NULL AND scheduled_at >= NOW()
    ORDER BY scheduled_at ASC
  `;

  const fmt = (d: any) => d ? new Date(d).toISOString() : "—";
  const berlin = (d: any) => d ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "—";

  console.log(`\n=== Kunden-Kontaktlog: ${rows.length} offene, zukünftige Termine/Zusagen ===`);
  for (const r of rows.slice(0, 20)) {
    console.log(`  #${r.id} ${r.ref} ${r.outcome || ""} | scheduled=${fmt(r.scheduled_at)} (Berlin ${berlin(r.scheduled_at)}) | promised=${fmt(r.promised_date)}`);
  }
  if (rows.length > 20) console.log(`  … und ${rows.length - 20} weitere`);

  console.log(`\n=== Lead-Kontaktlog: ${leadRows.length} offene, zukünftige Rückruf-Termine ===`);
  for (const r of leadRows.slice(0, 20)) {
    console.log(`  #${r.id} lead=${r.lead_id} ${r.outcome || ""} | scheduled=${fmt(r.scheduled_at)} (Berlin ${berlin(r.scheduled_at)})`);
  }
  if (leadRows.length > 20) console.log(`  … und ${leadRows.length - 20} weitere`);

  console.log(`\nHINWEIS: Der Versatz ist NICHT einheitlich (Agenten-Eingaben waren +1/+2 h,`);
  console.log(`Admin-Eingaben je nach Browser-Standort korrekt). Daher KEINE pauschale`);
  console.log(`Korrektur. Empfehlung: neue Termine sind ab dem Fix korrekt; Alt-Termine`);
  console.log(`nur nach ausdrücklicher Freigabe des Betreibers einzeln prüfen/korrigieren.`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
