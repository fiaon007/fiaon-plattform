/**
 * ═══════════════════════════════════════════════════════════════════
 * BETREUUNGS-NACHWEIS JE AGENT (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Zählt je Agent die Akten mit DOKUMENTIERTEM KONTAKT sowie die
 * abgeschlossenen/bezahlten Fälle — also genau das, was die Migration
 * NICHT anfassen darf.
 *
 * Vor und nach der Migration ausführen und vergleichen:
 *   npx tsx scripts/kartei-betreuung.ts > /tmp/betreuung-vorher.json
 *   npx tsx scripts/kartei-betreuung.ts > /tmp/betreuung-nachher.json
 *   diff /tmp/betreuung-vorher.json /tmp/betreuung-nachher.json
 *
 * Ein leerer diff ist der Beleg: niemandem wurde Betreuung weggenommen.
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require", max: 2, connection: { statement_timeout: 120000 },
});

const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
const CONTACT_TYPES = ["result", "note", "email_sent"];

async function main(): Promise<void> {
  const rows = await sql`
    SELECT ag.name,
           COUNT(*) FILTER (WHERE t.art = 'lead_betreut')::int  AS leads_betreut,
           COUNT(*) FILTER (WHERE t.art = 'app_betreut')::int   AS bestellungen_betreut,
           COUNT(*) FILTER (WHERE t.art = 'app_abgeschlossen')::int AS abgeschlossen
    FROM (
      SELECT l.assigned_agent_id AS aid, 'lead_betreut' AS art
      FROM fiaon_leads l
      WHERE l.assigned_agent_id IS NOT NULL
        AND l.status = ANY(${OPEN_LEAD_STATUS}) AND l.dismissed_at IS NULL
        AND EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES}))
      UNION ALL
      SELECT a.assigned_agent_id, 'app_betreut'
      FROM fiaon_applications a
      WHERE a.assigned_agent_id IS NOT NULL AND a.merged_into IS NULL
        AND a.payment_status NOT IN ('paid','expired','cancelled')
        AND EXISTS (SELECT 1 FROM fiaon_contact_log c WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL)
      UNION ALL
      SELECT a.assigned_agent_id, 'app_abgeschlossen'
      FROM fiaon_applications a
      WHERE a.assigned_agent_id IS NOT NULL AND a.merged_into IS NULL
        AND a.payment_status IN ('paid','expired','cancelled')
    ) t
    JOIN fiaon_agents ag ON ag.id = t.aid
    GROUP BY ag.name
    ORDER BY ag.name
  `;

  // Zusätzlich: die Nachfass-Menge, die sich ebenfalls nicht ändern darf.
  const [seq] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_leads l
    WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar')
      AND l.in_sequence = TRUE
      AND COALESCE(NULLIF(l.email,''), NULLIF(l.telefon,'')) IS NOT NULL
  `;

  console.log(JSON.stringify({
    agenten: rows.map((r: any) => ({
      name: r.name,
      leads_betreut: r.leads_betreut,
      bestellungen_betreut: r.bestellungen_betreut,
      abgeschlossen: r.abgeschlossen,
    })),
    nachfass_menge: seq.c,
  }, null, 2));
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
