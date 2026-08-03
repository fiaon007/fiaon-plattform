/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ABNAHME: Was sieht ein echter Agent nach der Umschaltung?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Prüft mit einer gültigen Sitzung eines ECHTEN Agenten (nicht Testkonto), dass
 *   1. das Dashboard Zahlen liefert,
 *   2. die Listen wirkliche Kunden mit Name, Telefon und Handlungshinweis zeigen,
 *   3. die abgeschalteten Kartei-Endpunkte mit 410 antworten.
 *
 * Telefonnummern werden maskiert ausgegeben — ein Abnahmeprotokoll braucht den
 * Nachweis, dass eine Nummer DA ist, nicht die Nummer selbst.
 *
 * Aufruf bei laufendem Server:
 *   AGENT=8 npx tsx scripts/pruef-agentansicht.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { signAgentToken, AGENT_COOKIE_NAME } from "../server/routes/fiaon-agent";

const BASIS = process.env.BASIS || "http://localhost:5055/api/fiaon";
const AGENT_ID = Number(process.env.AGENT || 8);

const maske = (s: string | null) =>
  s ? s.slice(0, Math.max(0, s.length - 4)).replace(/\d/g, "•") + s.slice(-4) : "keine Nummer";

async function main() {
  const [a] = (await sqlPool`
    SELECT id, name, session_epoch, is_test_account FROM fiaon_agents WHERE id = ${AGENT_ID}
  `) as any[];
  if (!a) throw new Error(`Agent ${AGENT_ID} nicht gefunden`);

  const cookie = `${AGENT_COOKIE_NAME}=${signAgentToken(a.id, a.session_epoch ?? 0)}`;
  const hol = async (p: string) => {
    const r = await fetch(BASIS + p, { headers: { Cookie: cookie } });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  console.log("");
  console.log(`=== ANSICHT VON ${a.name} (Agent #${a.id}, Testkonto: ${a.is_test_account}) ===`);
  console.log("");

  const d = await hol("/agent/crm/dashboard");
  const z = d.json?.zahlen ?? {};
  console.log(`  Dashboard HTTP ${d.status} · Willkommens-Tour gesehen: ${d.json?.tourGesehen}`);
  console.log(`  heute fällig ${z.heuteFaellig} · Zahlung gemeldet ${z.ohneDatum} · überfällig ${z.ueberfaellig} · liegengeblieben ${z.eskalation}`);
  console.log(`  Kategorien: Zahlung gemeldet ${z.tier1} · Antrag & Rechnung ${z.tier2} · Neue Leads ${z.tier3} · gesamt ${z.gesamt}`);
  console.log("");

  const listen: [string, string][] = [
    ["Zahlung gemeldet (Tier 1)", "/agent/crm/kunden?tier=1"],
    ["Überfällig", "/agent/crm/kunden?state=ueberfaellig"],
    ["Antrag & Rechnung (Tier 2)", "/agent/crm/kunden?tier=2"],
  ];
  for (const [titel, pfad] of listen) {
    const r = await hol(pfad);
    console.log(`  ${titel} — HTTP ${r.status}, ${r.json?.anzahl ?? 0} Kunden`);
    for (const k of (r.json?.kunden ?? []).slice(0, 3)) {
      console.log(`    - ${k.name}  |  ${maske(k.telefon)}  |  ${k.titel}`);
      console.log(`      Hinweis: ${String(k.hinweis).slice(0, 100)}`);
    }
    console.log("");
  }

  console.log("  === ABGESCHALTETE KARTEI (410 erwartet) ===");
  for (const p of ["/agent/kartei/status", "/agent/kartei/meine", "/agent/kartei/segmente"]) {
    const r = await hol(p);
    const ok = r.status === 410 ? "OK" : "ABWEICHUNG";
    console.log(`    ${ok}  ${p}  →  HTTP ${r.status}  ${r.json?.ersetztDurch ?? ""}`);
  }
  console.log("");

  await sqlPool.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[PRUEF-AGENTANSICHT]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
