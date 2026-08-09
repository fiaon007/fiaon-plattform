// ═══════════════════════════════════════════════════════════════════════════
// BACKFILL: Personen auf Stufe A oder B ohne Zuständigen
//
// Ab jetzt bekommt jeder sofort jemanden (server/lib/fiaon-zuteilung.ts). Der
// Bestand davor bleibt aber liegen — gemessen am 09.08.2026: 756 Personen,
// davon 9 auf Stufe A. Eine davon ist Anas Barghouti, der seit dem 08.08.
// „ich habe bezahlt" gemeldet hat und in niemandes Liste steht.
//
//   npx tsx scripts/zuteilung-backfill.ts              # Vorschau + CSV
//   npx tsx scripts/zuteilung-backfill.ts --schreiben  # ausführen
//   npx tsx scripts/zuteilung-backfill.ts --nur-a      # nur Stufe A
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { agentMitKleinsterLast } from "../server/lib/fiaon-zuteilung";

const SCHREIBEN = process.argv.includes("--schreiben");
const NUR_A = process.argv.includes("--nur-a");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  console.log("\n══ Zuteilung nachholen: Stufe A und B ohne Zuständigen ══\n");

  const agenten = (await sqlPool`
    SELECT a.id, COALESCE(NULLIF(a.first_name, ''), a.name) AS name,
           COUNT(p.id) FILTER (WHERE p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked)::int AS last
    FROM fiaon_agents a
    LEFT JOIN fiaon_persons p ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    GROUP BY a.id ORDER BY a.id
  `) as any[];
  if (agenten.length === 0) {
    console.log("  Kein verteilender Mitarbeiter aktiv. Nichts zu tun.\n");
    await sqlPool.end();
    return;
  }

  const kandidaten = (await sqlPool`
    SELECT p.id, p.priority_tier, p.tier_reason,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           p.primary_email, p.primary_phone, p.created_at
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND p.assigned_agent_id IS NULL
      AND NOT p.is_blocked
      AND p.ist_test_am IS NULL
      -- BESITZSCHUTZ: Wer dokumentiert betreut wurde, gehört seinem Betreuer.
      AND p.betreuung_seit IS NULL
      AND p.priority_tier IN (${NUR_A ? sqlPool`1` : sqlPool`1, 2`})
    -- Stufe A zuerst, dann die ältesten: Wer am längsten wartet, ist am
    -- ehesten verloren.
    ORDER BY p.priority_tier ASC, p.created_at ASC NULLS LAST, p.id ASC
  `) as any[];

  console.log(`  Verteilende Mitarbeiter: ${agenten.length} (${agenten.map((a) => `${a.name} ${a.last}`).join(", ")})`);
  console.log(`  Ohne Zuständigen:        ${kandidaten.length}`);
  console.log(`    davon Stufe A:         ${kandidaten.filter((k) => k.priority_tier === 1).length}`);
  console.log(`    davon Stufe B:         ${kandidaten.filter((k) => k.priority_tier === 2).length}\n`);

  // Reihum an den jeweils Kleinsten — wie `agentMitKleinsterLast`, aber mit
  // mitlaufender Zählung, damit nicht alle an denselben gehen.
  const stand = new Map<number, number>(agenten.map((a) => [Number(a.id), Number(a.last)]));
  const zuteilung = new Map<number, number>();
  for (const k of kandidaten) {
    let ziel = agenten[0];
    for (const a of agenten) if ((stand.get(Number(a.id)) ?? 0) < (stand.get(Number(ziel.id)) ?? 0)) ziel = a;
    zuteilung.set(Number(k.id), Number(ziel.id));
    stand.set(Number(ziel.id), (stand.get(Number(ziel.id)) ?? 0) + 1);
  }

  const name = new Map(agenten.map((a) => [Number(a.id), String(a.name)]));
  mkdirSync("reports", { recursive: true });
  const kopf = ["person_id", "name", "stufe", "grund", "email", "telefon", "angelegt", "agent"];
  const zeilen = kandidaten.map((k) => [
    k.id, k.name, k.priority_tier === 1 ? "A" : "B", k.tier_reason, k.primary_email, k.primary_phone,
    k.created_at ? new Date(k.created_at).toISOString().slice(0, 10) : "",
    name.get(zuteilung.get(Number(k.id))!),
  ].map(feld).join(";"));
  writeFileSync("reports/zuteilung-backfill.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  console.log("  Vorschau: reports/zuteilung-backfill.csv\n");

  const barghouti = kandidaten.find((k) => String(k.name).toLowerCase().includes("barghouti"));
  if (barghouti) {
    console.log(`  Der belegte Fall ist dabei: ${barghouti.name} (Person ${barghouti.id}, Stufe `
      + `${barghouti.priority_tier === 1 ? "A" : "B"}) → ${name.get(zuteilung.get(Number(barghouti.id))!)}\n`);
  }
  console.log("  Endstand je Mitarbeiter:");
  for (const a of agenten) {
    console.log(`    ${String(a.name).padEnd(14)} ${String(a.last).padStart(5)} → ${String(stand.get(Number(a.id))).padStart(5)}`);
  }

  if (kandidaten.length === 0) { console.log("\n  Nichts zu tun.\n"); await sqlPool.end(); return; }
  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Ausführen mit --schreiben (oder --nur-a für die dringenden neun).\n");
    await sqlPool.end();
    return;
  }

  let geschrieben = 0;
  const ids = kandidaten.map((k) => Number(k.id));
  for (let i = 0; i < ids.length; i += 200) {
    const welle = ids.slice(i, i + 200);
    await sqlPool.begin(async (tx) => {
      await tx`SELECT set_config('fiaon.reason', 'zuteilung_backfill', true)`;
      await tx`SELECT set_config('fiaon.actor', 'script:zuteilung-backfill', true)`;
      for (const id of welle) {
        const [r] = await tx`
          UPDATE fiaon_persons SET assigned_agent_id = ${zuteilung.get(id)!}, assigned_at = NOW()
          WHERE id = ${id} AND assigned_agent_id IS NULL AND betreuung_seit IS NULL
          RETURNING id
        `;
        if (r) geschrieben++;
      }
    });
    console.log(`  Welle ${Math.floor(i / 200) + 1}: ${Math.min(i + 200, ids.length)}/${ids.length}`);
  }
  console.log(`\n  Zugeteilt: ${geschrieben}\n`);
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nAbgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
