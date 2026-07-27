/**
 * ═══════════════════════════════════════════════════════════════════
 * KARTEI IM LIVE-BETRIEB (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 *   L1  Kartei-Stand jetzt: frei / vergeben / gesamt, je Agent
 *   L2  Die obersten 10 Karten MIT ihrer Gewichtung — damit die
 *       Rangfolge nachvollziehbar ist und nicht geglaubt werden muss
 *   L3  Zurückgegebene und aussortierte Akten: erscheinen sie korrekt?
 *
 * Verwendung: npx tsx scripts/kartei-live.ts
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require", max: 2, connection: { statement_timeout: 120000 },
});

const WEIGHTS = {
  wFresh: 40, wValue: 25, wReact: 50, wContact: 30, fairnessNth: 4,
  hoardingDays: 7, hoardingWarnDays: 2, autoReleaseMin: 30, requireFullContact: true,
};

function padL(s: any, n: number): string { return String(s).padStart(n); }
function pad(s: any, n: number): string { return String(s).padEnd(n); }

async function main(): Promise<void> {
  const mod = await import("../server/routes/fiaon-kartei");
  const cte: string = (mod as any).__karteiCteForTests(WEIGHTS);

  // ── L1: Stand ─────────────────────────────────────────────────────────────
  const rows = await sql.unsafe(`
    ${cte}
    SELECT k.card_id, k.kind, k.assigned_agent_id, k.lifecycle, k.potenzial,
           k.quelle, k.paket, k.created_at, k.rueckruf_faellig,
           k.zahlung_angekuendigt, k.nummer_korrigiert, k.hat_telefon, k.betreut
    FROM kartei k
  `);
  const frei = rows.filter((r: any) => r.assigned_agent_id === null);
  console.log("\nL1 · KARTEI-STAND NACH DER MIGRATION\n");
  console.log(`  gesamt ...... ${rows.length}`);
  console.log(`  frei ........ ${frei.length}`);
  console.log(`  vergeben .... ${rows.length - frei.length}`);

  const perAgent = new Map<number, number>();
  for (const r of rows as any[]) {
    if (r.assigned_agent_id) perAgent.set(r.assigned_agent_id, (perAgent.get(r.assigned_agent_id) || 0) + 1);
  }
  const namen = await sql`SELECT id, name FROM fiaon_agents`;
  const nameOf = new Map(namen.map((a: any) => [a.id, a.name]));
  console.log("\n  Noch vergeben je Agent (das sind die betreuten Akten):");
  for (const [id, c] of [...perAgent.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(nameOf.get(id) || `#${id}`, 24)} ${padL(c, 5)}`);
  }

  // ── L2: Top 10 mit offengelegter Gewichtung ───────────────────────────────
  // Die Formel wird hier bewusst NACHGERECHNET und aufgeschlüsselt, damit man
  // sieht, warum eine Karte oben liegt. Der Agent selbst sieht den Score nie.
  const now = Date.now();
  const scored = (frei as any[]).map((r) => {
    const alterTage = Math.max(0, (now - new Date(r.created_at).getTime()) / 86_400_000);
    const frische = WEIGHTS.wFresh * Math.exp(-alterTage / 14);
    const wert = WEIGHTS.wValue * Math.log1p(Number(r.potenzial || 0)) / Math.log1p(500);
    const reaktion = WEIGHTS.wReact * (
      (r.zahlung_angekuendigt ? 1 : 0) * 0.6 +
      (r.rueckruf_faellig ? 1 : 0) * 0.3 +
      (r.nummer_korrigiert ? 1 : 0) * 0.1
    );
    const kontakt = WEIGHTS.wContact * (r.hat_telefon ? 1 : 0);
    return { ...r, alterTage, frische, wert, reaktion, kontakt, score: frische + wert + reaktion + kontakt };
  }).sort((a, b) => b.score - a.score).slice(0, 10);

  console.log("\nL2 · DIE OBERSTEN 10 FREIEN KARTEN — mit offengelegter Gewichtung\n");
  console.log(`  ${pad("#", 3)}${pad("Karte", 22)}${padL("Score", 7)}${padL("Frische", 9)}${padL("Wert", 7)}${padL("Reaktion", 10)}${padL("Kontakt", 9)}  Grund`);
  console.log(`  ${"-".repeat(3)}${"-".repeat(22)}${"-".repeat(7)}${"-".repeat(9)}${"-".repeat(7)}${"-".repeat(10)}${"-".repeat(9)}  ${"-".repeat(30)}`);
  scored.forEach((r, i) => {
    const gruende: string[] = [];
    if (r.zahlung_angekuendigt) gruende.push("Zahlung angekündigt");
    if (r.rueckruf_faellig) gruende.push("Rückruf fällig");
    if (r.nummer_korrigiert) gruende.push("Nummer korrigiert");
    if (r.alterTage < 3) gruende.push("frisch");
    if (Number(r.potenzial) > 0) gruende.push(`${Number(r.potenzial).toFixed(2)} € offen`);
    console.log(
      `  ${pad(i + 1, 3)}${pad(r.card_id, 22)}${padL(r.score.toFixed(1), 7)}${padL(r.frische.toFixed(1), 9)}` +
      `${padL(r.wert.toFixed(1), 7)}${padL(r.reaktion.toFixed(1), 10)}${padL(r.kontakt.toFixed(1), 9)}  ${gruende.join(", ") || "—"}`,
    );
  });
  console.log("\n  Frische = Alter mit Halbwertszeit 14 Tage · Wert = offener Betrag (logarithmisch)");
  console.log("  Reaktion = Zahlung angekündigt/Rückruf/Nummer korrigiert · Kontakt = Telefon vorhanden");

  // ── L3: Rückläufer und Aussortiertes ──────────────────────────────────────
  const zurueck = await sql`
    SELECT event, COUNT(*)::int AS c FROM fiaon_kartei_events
    WHERE event IN ('release','auto_release','hoarding_release','admin_release','claim')
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY event ORDER BY c DESC
  `;
  console.log("\nL3 · BEWEGUNGEN DER LETZTEN 30 TAGE\n");
  if (zurueck.length === 0) console.log("  Noch keine Übernahmen oder Rückgaben — die Kartei ist gerade erst live.");
  for (const r of zurueck) console.log(`  ${pad(r.event, 22)} ${padL(r.c, 6)}`);

  const [aussortiert] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_leads WHERE dismissed_at IS NOT NULL) AS leads,
      (SELECT COUNT(*)::int FROM fiaon_applications WHERE dismissed_at IS NOT NULL) AS apps
  `;
  console.log(`\n  Aussortiert (liegt korrekt NICHT in der Kartei): ${aussortiert.leads} Leads, ${aussortiert.apps} Bestellungen`);

  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
