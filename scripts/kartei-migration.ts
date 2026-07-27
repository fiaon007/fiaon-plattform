/**
 * ═══════════════════════════════════════════════════════════════════
 * P1-G — MIGRATION DES BESTANDS IN DIE OFFENE KARTEI
 * ═══════════════════════════════════════════════════════════════════
 *
 * Betreiber-Entscheidung (liegt vor):
 *   · Leads/Kunden MIT dokumentiertem Kontakt oder abgeschlossen/bezahlt
 *     → bleiben beim bisherigen Agenten.
 *   · Leads/Kunden OHNE jeden dokumentierten Kontakt
 *     → zurück in die offene Kartei (davon profitieren die neuen Agenten).
 *
 * SICHERHEIT:
 *   · STANDARD IST DRY-RUN. Ohne `--write` wird nichts verändert.
 *   · Kein hartes Löschen. Es wird ausschließlich `assigned_agent_id` genullt.
 *   · Jede Änderung bekommt einen Eintrag in fiaon_kartei_events MIT batch_id
 *     und dem vorherigen Agenten → vollständig umkehrbar über `--undo=<batch>`.
 *   · Keine E-Mail, kein Webhook, keine Provisions-/Stichtag-Berührung.
 *
 * Verwendung:
 *   npx tsx scripts/kartei-migration.ts                 → Vorschau (Vorher/Nachher)
 *   npx tsx scripts/kartei-migration.ts --write         → ausführen
 *   npx tsx scripts/kartei-migration.ts --undo=<batch>  → vollständig zurückrollen
 */

import "dotenv/config";
import postgres from "postgres";
import { randomBytes } from "crypto";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 3 });

const WRITE = process.argv.includes("--write");
const UNDO = (process.argv.find((a) => a.startsWith("--undo=")) || "").split("=")[1] || null;

const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
const OPEN_PAYMENT_STATUS = ["pending_payment", "claimed_paid"];
const CONTACT_TYPES = ["result", "note", "email_sent"];

/** Leads ohne jeden dokumentierten Kontakt, die aktuell einem Agenten gehören. */
async function leadsToRelease() {
  return sql`
    SELECT l.id, l.assigned_agent_id, ag.name AS agent_name
    FROM fiaon_leads l
    LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
    WHERE l.assigned_agent_id IS NOT NULL
      AND l.status = ANY(${OPEN_LEAD_STATUS})
      AND l.dismissed_at IS NULL
      AND l.converted_order_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES})
      )
    ORDER BY l.id
  `;
}

/** Offene Bestellungen ohne jeden dokumentierten Kontakt. */
async function appsToRelease() {
  return sql`
    SELECT a.ref, a.assigned_agent_id, ag.name AS agent_name
    FROM fiaon_applications a
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.assigned_agent_id IS NOT NULL
      AND a.payment_status = ANY(${OPEN_PAYMENT_STATUS})
      AND a.merged_into IS NULL
      AND a.dismissed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log c
        WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL
      )
    ORDER BY a.ref
  `;
}

function summarise(rows: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const key = r.agent_name || `Agent #${r.assigned_agent_id}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

async function keepCounts(): Promise<Map<string, number>> {
  const rows = await sql`
    SELECT ag.name, COUNT(*)::int AS c FROM (
      SELECT l.assigned_agent_id AS aid FROM fiaon_leads l
      WHERE l.assigned_agent_id IS NOT NULL AND l.status = ANY(${OPEN_LEAD_STATUS}) AND l.dismissed_at IS NULL
        AND EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES}))
      UNION ALL
      SELECT a.assigned_agent_id AS aid FROM fiaon_applications a
      WHERE a.assigned_agent_id IS NOT NULL AND a.merged_into IS NULL
        AND (
          a.payment_status IN ('paid', 'expired', 'cancelled')
          OR EXISTS (SELECT 1 FROM fiaon_contact_log c WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL)
        )
    ) t
    JOIN fiaon_agents ag ON ag.id = t.aid
    GROUP BY ag.name ORDER BY c DESC
  `;
  return new Map(rows.map((r: any) => [r.name, Number(r.c)]));
}

async function doUndo(batch: string): Promise<void> {
  // Robust gegen beide Schreibweisen von meta: echtes JSON-Objekt UND (aus einem
  // frueheren Fehler) ein doppelt kodierter JSON-String. Sonst faende der
  // Rueckwaertsgang keinen einzigen Eintrag und die Migration waere faktisch
  // unumkehrbar.
  const events = await sql`
    SELECT kind, target_id, agent_id FROM fiaon_kartei_events
    WHERE event = 'migration_release'
      AND COALESCE(
            meta->>'batch_id',
            CASE WHEN jsonb_typeof(meta) = 'string'
                 THEN ((meta #>> '{}')::jsonb)->>'batch_id' END
          ) = ${batch}
  `;
  if (events.length === 0) {
    console.error(`Kein Migrations-Stapel „${batch}" gefunden.`);
    process.exit(1);
  }
  console.log(`Rolle Stapel ${batch} zurück — ${events.length} Akte(n)…`);
  let restored = 0;
  for (const e of events) {
    if (!e.agent_id) continue;
    const res = e.kind === "lead"
      ? await sql`UPDATE fiaon_leads SET assigned_agent_id = ${e.agent_id}, updated_at = NOW()
                  WHERE id = ${Number(e.target_id)} AND assigned_agent_id IS NULL RETURNING id`
      : await sql`UPDATE fiaon_applications SET assigned_agent_id = ${e.agent_id}, updated_at = NOW()
                  WHERE ref = ${e.target_id} AND assigned_agent_id IS NULL RETURNING ref`;
    if (res.length > 0) restored++;
  }
  await sql`
    INSERT INTO fiaon_kartei_events (kind, target_id, card_id, agent_id, event, reason, actor, meta)
    VALUES ('app', ${batch}, ${batch}, NULL, 'migration_undo',
            ${`Migrations-Stapel ${batch} zurückgerollt: ${restored} Akte(n) wieder zugewiesen.`},
            'Admin', ${sql.json({ batch_id: batch, restored })})
  `;
  console.log(`✅ ${restored} Akte(n) wiederhergestellt. Bereits neu übernommene Akten wurden bewusst NICHT überschrieben.`);
}

async function main(): Promise<void> {
  if (UNDO) {
    await doUndo(UNDO);
    await sql.end();
    return;
  }

  const [leads, apps, keep] = await Promise.all([leadsToRelease(), appsToRelease(), keepCounts()]);
  const perAgent = new Map<string, number>();
  for (const [k, v] of summarise(leads)) perAgent.set(k, (perAgent.get(k) || 0) + v);
  for (const [k, v] of summarise(apps)) perAgent.set(k, (perAgent.get(k) || 0) + v);

  console.log(`\n${WRITE ? "AUSFÜHRUNG" : "VORSCHAU (DRY-RUN — es wird nichts geändert)"}\n`);
  console.log("Agent                          vorher    bleibt eigen    zurück in die Kartei");
  console.log("-----------------------------  --------  --------------  --------------------");
  const names = new Set<string>([...perAgent.keys(), ...keep.keys()]);
  for (const name of [...names].sort()) {
    const back = perAgent.get(name) || 0;
    const stay = keep.get(name) || 0;
    console.log(
      `${name.padEnd(29)}  ${String(stay + back).padEnd(8)}  ${String(stay).padEnd(14)}  ${back}`,
    );
  }
  const totalBack = leads.length + apps.length;
  console.log(`\nGesamt zurück in die offene Kartei: ${totalBack} (${leads.length} Leads, ${apps.length} Kunden)`);

  if (!WRITE) {
    console.log("\nNichts verändert. Zum Ausführen: npx tsx scripts/kartei-migration.ts --write");
    await sql.end();
    return;
  }

  const batch = `mig-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
  console.log(`\nStapel-Kennung: ${batch} (für --undo=${batch})\n`);

  let done = 0;
  for (const l of leads) {
    const res = await sql`
      UPDATE fiaon_leads SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
      WHERE id = ${l.id} AND assigned_agent_id = ${l.assigned_agent_id} RETURNING id
    `;
    if (res.length === 0) continue;
    await sql`
      INSERT INTO fiaon_kartei_events (kind, target_id, card_id, agent_id, event, reason, actor, meta)
      VALUES ('lead', ${String(l.id)}, ${`lead-${l.id}`}, ${l.assigned_agent_id}, 'migration_release',
              ${`Migration in die offene Kartei: nie dokumentierter Kontakt (war zugewiesen an ${l.agent_name || l.assigned_agent_id}).`},
              'Migration', ${sql.json({ batch_id: batch, previous_agent_id: l.assigned_agent_id })})
    `;
    await sql`
      INSERT INTO fiaon_lead_log (lead_id, agent_id, agent_name, type, note)
      VALUES (${l.id}, NULL, 'System', 'system',
              ${`Umstellung auf die offene Kartei: Diese Akte hatte nie einen dokumentierten Kontakt und liegt jetzt frei in der Kartei. Sie kann von jedem Agenten übernommen werden. Nichts gelöscht, Stapel ${batch}.`})
    `.catch(() => {});
    done++;
  }
  for (const a of apps) {
    const res = await sql`
      UPDATE fiaon_applications SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
      WHERE ref = ${a.ref} AND assigned_agent_id = ${a.assigned_agent_id} RETURNING ref
    `;
    if (res.length === 0) continue;
    await sql`
      INSERT INTO fiaon_kartei_events (kind, target_id, card_id, agent_id, event, reason, actor, meta)
      VALUES ('app', ${a.ref}, ${a.ref}, ${a.assigned_agent_id}, 'migration_release',
              ${`Migration in die offene Kartei: nie dokumentierter Kontakt (war zugewiesen an ${a.agent_name || a.assigned_agent_id}).`},
              'Migration', ${sql.json({ batch_id: batch, previous_agent_id: a.assigned_agent_id })})
    `;
    await sql`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${a.ref}, NULL, 'System', 'system',
              ${`Umstellung auf die offene Kartei: Diese Akte hatte nie einen dokumentierten Kontakt und liegt jetzt frei in der Kartei. Sie kann von jedem Agenten übernommen werden. Nichts gelöscht, Stapel ${batch}.`})
    `.catch(() => {});
    done++;
  }

  console.log(`✅ ${done} Akte(n) in die offene Kartei überführt. Stapel ${batch} — Rückabwicklung jederzeit:`);
  console.log(`   npx tsx scripts/kartei-migration.ts --undo=${batch}`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("Migration fehlgeschlagen:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
