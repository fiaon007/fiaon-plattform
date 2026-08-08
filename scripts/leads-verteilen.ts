// ═══════════════════════════════════════════════════════════════════════════
// LEADS VERTEILEN — Stufe C bekommt zum ersten Mal einen Besitzer
//
// DIE LAGE (gemessen 08.08.2026)
// 2.518 Personen stehen auf Stufe C. Davon sind NULL einem Agenten zugeteilt.
// Der Filter „Leads" in der Kundenliste zeigt seit seiner Einführung eine
// leere Liste, und niemandem ist es aufgefallen — weil `nachschub()` nur
// Tier 1 und Tier 2 auffüllte. Ein Vorrat, den keine Automatik anfasst und
// keine Liste zeigt, ist kein Vorrat, sondern ein Datenfriedhof.
//
// WAS DIESER LAUF TUT
// Er verteilt die unberührten Stufe-C-Personen reihum auf die verteilenden
// Agenten. Reihum (nicht blockweise), damit niemand die alten und jemand
// anders die frischen bekommt.
//
// WAS ER NICHT TUT
//   · Betreute Personen anfassen. `betreuung_seit IS NOT NULL` heißt: Da hat
//     schon jemand mit dem Menschen gesprochen. Der Besitzschutz gilt hier
//     genauso wie in Nachschub und Erstverteilung.
//   · Etwas wegnehmen. Wer schon zugeteilt ist, bleibt, wo er ist.
//   · Testkonten beliefern.
//
// UMKEHRBAR: Eine Zuteilung allein setzt KEIN `betreuung_seit`. Solange
// niemand den Lead angerufen hat, kann die Verteilung folgenlos zurückgenommen
// werden (--zuruecknehmen).
//
//   npx tsx scripts/leads-verteilen.ts                 # Vorschau + CSV
//   npx tsx scripts/leads-verteilen.ts --schreiben     # ausführen
//   npx tsx scripts/leads-verteilen.ts --zuruecknehmen # diesen Lauf rückgängig
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const ZURUECK = process.argv.includes("--zuruecknehmen");
const GRUND = "leads_verteilen_08082026";

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  console.log("\n══ Leads verteilen: Stufe C bekommt einen Besitzer ══\n");

  if (ZURUECK) {
    const weg = await sqlPool`
      UPDATE fiaon_persons SET assigned_agent_id = NULL, assigned_at = NULL
      WHERE assigned_at IS NOT NULL AND priority_tier = 3 AND betreuung_seit IS NULL
        AND EXISTS (
          SELECT 1 FROM fiaon_agent_events e
          WHERE e.type = ${GRUND} AND e.meta::jsonb->>'person_id' = fiaon_persons.id::text
        )
      RETURNING id
    `;
    console.log(`  ${weg.length} Zuteilungen zurückgenommen (nur unberührte).\n`);
    await sqlPool.end();
    return;
  }

  const agenten = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS name,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
               AND p.priority_tier = 3) AS hat_schon
    FROM fiaon_agents a
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    ORDER BY a.id
  `) as any[];
  if (agenten.length === 0) {
    console.log("  Kein verteilender Agent gefunden. Nichts zu tun.\n");
    await sqlPool.end();
    return;
  }

  const kandidaten = (await sqlPool`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           p.primary_email, p.primary_phone, p.tier_reason, p.created_at
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND p.priority_tier = 3
      AND p.assigned_agent_id IS NULL
      AND NOT p.is_blocked
      -- BESITZSCHUTZ: Wer schon einmal dokumentiert betreut wurde, bleibt bei
      -- seinem Betreuer — auch wenn die Zuweisung verloren ging. Dieselbe
      -- Bedingung wie in nachschub() und erstverteilung.ts.
      AND p.betreuung_seit IS NULL
    -- Die frischesten zuerst: Ein Lead von gestern ist um Größenordnungen
    -- wertvoller als einer von vor acht Monaten.
    ORDER BY p.created_at DESC NULLS LAST, p.id ASC
  `) as any[];

  console.log(`  Verteilende Agenten:  ${agenten.length} (${agenten.map((a) => a.name).join(", ")})`);
  console.log(`  Leads ohne Besitzer:  ${kandidaten.length}`);
  console.log(`  Pro Kopf:             rund ${Math.ceil(kandidaten.length / agenten.length)}\n`);

  // Reihum zuteilen. Wer schon Stufe-C-Kunden hat, startet mit Vorsprung —
  // ausgeglichen wird der Endstand, nicht die Zuteilung.
  const stand = new Map<number, number>(agenten.map((a) => [Number(a.id), Number(a.hat_schon)]));
  const zuteilung = new Map<number, number>();
  for (const k of kandidaten) {
    let ziel = agenten[0];
    for (const a of agenten) if ((stand.get(Number(a.id)) ?? 0) < (stand.get(Number(ziel.id)) ?? 0)) ziel = a;
    zuteilung.set(Number(k.id), Number(ziel.id));
    stand.set(Number(ziel.id), (stand.get(Number(ziel.id)) ?? 0) + 1);
  }

  const name = new Map(agenten.map((a) => [Number(a.id), String(a.name)]));
  mkdirSync("reports", { recursive: true });
  const kopf = ["person_id", "name", "email", "telefon", "grund", "angelegt", "agent_id", "agent"];
  const zeilen = kandidaten.map((k) => [
    k.id, k.name, k.primary_email, k.primary_phone, k.tier_reason,
    k.created_at ? new Date(k.created_at).toISOString().slice(0, 10) : "",
    zuteilung.get(Number(k.id)), name.get(zuteilung.get(Number(k.id))!),
  ].map(feld).join(";"));
  writeFileSync("reports/leads-verteilen.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  console.log("  Vorschau: reports/leads-verteilen.csv\n");
  console.log("  Endstand je Agent (Stufe C):");
  for (const a of agenten) {
    console.log(`    ${String(a.name).padEnd(14)} ${String(a.hat_schon).padStart(5)} → ${String(stand.get(Number(a.id))).padStart(5)}`);
  }

  if (kandidaten.length === 0) {
    console.log("\n  Nichts zu tun.\n");
    await sqlPool.end();
    return;
  }
  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // In Wellen zu 200, damit ein Abbruch nicht alles offenlässt.
  const ids = kandidaten.map((k) => Number(k.id));
  let geschrieben = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const welle = ids.slice(i, i + 200);
    await sqlPool.begin(async (tx) => {
      await tx`SELECT set_config('fiaon.reason', ${GRUND}, true)`;
      await tx`SELECT set_config('fiaon.actor', 'script:leads-verteilen', true)`;
      for (const id of welle) {
        const [r] = await tx`
          UPDATE fiaon_persons SET assigned_agent_id = ${zuteilung.get(id)!}, assigned_at = NOW()
          WHERE id = ${id} AND assigned_agent_id IS NULL AND betreuung_seit IS NULL
          RETURNING id
        `;
        if (r) {
          geschrieben++;
          await tx`
            INSERT INTO fiaon_agent_events (agent_id, type, meta, to_agent_id, reason, actor, created_at)
            VALUES (NULL, ${GRUND}, ${JSON.stringify({ person_id: id, agent_id: zuteilung.get(id) })},
                    ${zuteilung.get(id)!}, 'Stufe-C-Erstverteilung 08.08.2026', 'script:leads-verteilen', NOW())
          `.catch(() => {});
        }
      }
    });
    console.log(`  Welle ${Math.floor(i / 200) + 1}: ${Math.min(i + 200, ids.length)}/${ids.length}`);
  }

  const [nach] = await sqlPool`
    SELECT COUNT(*) FILTER (WHERE priority_tier = 3 AND assigned_agent_id IS NOT NULL)::int AS zugeteilt,
           COUNT(*) FILTER (WHERE priority_tier = 3 AND assigned_agent_id IS NULL)::int AS offen
    FROM fiaon_persons WHERE merged_into_person_id IS NULL
  `;
  console.log(`\n  Zugeteilt: ${geschrieben}`);
  console.log(`  Stufe C jetzt: ${nach.zugeteilt} mit Besitzer, ${nach.offen} in der Reserve.`);
  console.log(`  Rücknahme (solange unberührt): npx tsx scripts/leads-verteilen.ts --zuruecknehmen\n`);
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nAbgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
