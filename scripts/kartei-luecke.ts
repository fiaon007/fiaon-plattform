/**
 * Klärt die Restmenge der Prognose: Leads, die vollständige Kontaktdaten haben
 * und trotzdem nicht als Karte erscheinen. Nur lesend, einmalige Abfrage.
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require", max: 2, connection: { statement_timeout: 120000 },
});

const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
const CONTACT_TYPES = ["result", "note", "email_sent"];

async function main(): Promise<void> {
  const [r] = await sql`
    WITH freigabe AS (
      SELECT l.*
      FROM fiaon_leads l
      WHERE l.assigned_agent_id IS NOT NULL
        AND l.status = ANY(${OPEN_LEAD_STATUS})
        AND l.dismissed_at IS NULL
        AND l.converted_order_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES})
        )
    ),
    voll AS (
      SELECT * FROM freigabe l
      WHERE COALESCE(l.telefon,'') <> '' AND COALESCE(l.email,'') <> ''
        AND (COALESCE(l.vorname,'') <> '' OR COALESCE(l.nachname,'') <> '')
    )
    SELECT
      (SELECT COUNT(*)::int FROM voll) AS voll_gesamt,
      (SELECT COUNT(*)::int FROM voll l WHERE l.requeue_at IS NOT NULL AND l.requeue_at > NOW()) AS wartet_requeue,
      (SELECT COUNT(*)::int FROM voll l WHERE EXISTS (
          SELECT 1 FROM fiaon_applications a
          WHERE a.merged_into IS NULL AND (
            (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
            OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
                AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
                  = RIGHT(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''),'\\D','','g'), 9))
          )
        )) AS dublette_zu_bestellung
  `;
  console.log("\nLeads mit VOLLSTÄNDIGEN Kontaktdaten aus der Freigabemenge:", r.voll_gesamt);
  console.log("  davon wartet auf requeue_at (Wiedervorlage) ....", r.wartet_requeue);
  console.log("  davon Dublette zu einer Bestellung .............", r.dublette_zu_bestellung);
  console.log("\n(Beide erscheinen bewusst NICHT als eigene Karte:");
  console.log(" Wiedervorlagen sind terminiert, Dubletten laufen als Bestellungs-Karte.)\n");
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
