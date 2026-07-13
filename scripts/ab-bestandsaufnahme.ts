// PAKET AB — Bestandsaufnahme (read-only): Dubletten-Zahlen + Engine-Überblick.
// Aufruf: npx tsx scripts/ab-bestandsaufnahme.ts   (braucht DATABASE_URL)
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2, connect_timeout: 15 });
const hardExit = setTimeout(() => { console.error("TIMEOUT nach 45s"); process.exit(2); }, 45_000);

async function main() {
  const [tot] = await sql`SELECT COUNT(*)::int c FROM fiaon_applications`;
  const [act] = await sql`SELECT COUNT(*)::int c FROM fiaon_applications WHERE merged_into IS NULL`;
  const st = await sql`SELECT COALESCE(payment_status,'(null)') s, COUNT(*)::int c FROM fiaon_applications WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC`;
  const dup = await sql`
    SELECT LOWER(TRIM(email)) em, COUNT(*)::int n,
           COUNT(*) FILTER (WHERE payment_status='paid')::int paid_n,
           COUNT(*) FILTER (WHERE payment_status IN ('pending_payment','claimed_paid'))::int open_n
    FROM fiaon_applications
    WHERE merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY 1 HAVING COUNT(*) > 1`;
  const withPaid = dup.filter((d: any) => d.paid_n > 0);
  const paidAndOpen = dup.filter((d: any) => d.paid_n > 0 && d.open_n > 0);
  const openInPaidGroups = paidAndOpen.reduce((s: number, d: any) => s + d.open_n, 0);
  const [agents] = await sql`SELECT COUNT(*) FILTER (WHERE active)::int a, COUNT(*)::int t FROM fiaon_agents`;
  const [comm] = await sql`SELECT COUNT(*)::int c, COALESCE(SUM(amount_cents),0)::bigint s FROM fiaon_commissions`;

  console.log("=== PAKET AB — Ist-Zustand ===");
  console.log(`Zeilen gesamt: ${tot.c} | aktiv (merged_into IS NULL): ${act.c}`);
  console.log(`payment_status: ${st.map((r: any) => `${r.s}=${r.c}`).join(", ")}`);
  console.log(`Dubletten-Gruppen (gleiche E-Mail, >1 Antrag): ${dup.length}`);
  console.log(`  davon mit mind. 1 paid: ${withPaid.length}`);
  console.log(`  davon paid UND offene Schwestern: ${paidAndOpen.length} → betroffene OFFENE Bestellungen (Kandidaten für 'superseded'): ${openInPaidGroups}`);
  console.log(`Agents: aktiv=${agents.a} / gesamt=${agents.t}`);
  console.log(`Provisionseinträge: ${comm.c} | Summe: ${(Number(comm.s) / 100).toFixed(2)} €`);
  clearTimeout(hardExit);
  await sql.end({ timeout: 3 });
  process.exit(0);
}
main().catch((e) => { console.error("FEHLER:", e?.message || e); process.exit(1); });
