// Setzt die Rolle „Vertriebsleiter" für die beiden Menschen, die den Vertrieb
// führen. Läuft absichtlich über den ADMIN-ENDPUNKT und nicht per UPDATE: So
// wird derselbe Weg benutzt, den der Vorgesetzte im Team-Bereich klickt, und der
// Rollenwechsel landet im Protokoll.
//
// Aufruf: npx tsx scripts/vertriebsleitung-setzen.ts [--zuruecknehmen]
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const NAMEN = ["Daniel Stripling", "Florentine Lombardi"];
const zurueck = process.argv.includes("--zuruecknehmen");

(async () => {
  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  });
  const cookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  for (const name of NAMEN) {
    const [a] = await sqlPool`
      SELECT id, name, COALESCE(rolle,'agent') AS rolle FROM fiaon_agents
      WHERE name = ${name} AND active AND COALESCE(is_test_account, FALSE) = FALSE
    `;
    if (!a) { console.log(`  ⚠ ${name} nicht gefunden — übersprungen`); continue; }
    const res = await fetch(`${BASIS}/api/fiaon/admin/agents/${a.id}/rolle`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ rolle: zurueck ? "agent" : "vertriebsleiter" }),
    });
    const j = await res.json().catch(() => null) as any;
    console.log(`  ${res.ok ? "✓" : "✗"} ${name} (#${a.id}): ${a.rolle} → ${j?.agent?.rolle || j?.error}`);
  }

  const alle = await sqlPool`
    SELECT id, name, COALESCE(rolle,'agent') AS rolle FROM fiaon_agents
    WHERE active AND COALESCE(is_test_account, FALSE) = FALSE ORDER BY id
  `;
  console.log("\nRollen im Team:");
  for (const a of alle as any[]) console.log(`  #${a.id} ${a.name}: ${a.rolle}`);
  await sqlPool.end?.();
})();
