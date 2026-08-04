// ═══════════════════════════════════════════════════════════════════════════
// Reparatur: aussortierte Kunden, die weiter in der Anrufliste stehen
//
// Gemeldet: „Im Register Heute habe ich Kundenkontakte, die ich in Meine Kunden
// gar nicht finde." Ursache: Aussortieren („100 % abgelehnt", „kein Interesse")
// betraf nur die BESTELLUNG. Die PERSON blieb in der Tagesliste. Der Agent
// bekam den Kunden am nächsten Morgen wieder vorgelegt — und konnte ihn nirgends
// öffnen, weil die Bestellung aus seiner Liste verschwunden war.
//
// Der Weg ist ab jetzt dicht (siehe /agent/customers/:ref/dismiss). Dieses
// Skript holt den Altbestand nach.
//
// Regel — bewusst nur dort, wo ALLE Bestellungen der Person aussortiert sind:
// Hat die Person noch eine offene Bestellung, gehört sie weiter in die Liste.
//   abgelehnt / kein_interesse  → gesperrt, keine Wiedervorlage
//   keine_nummer / ungueltig    → Wiedervorlage in 3 Tagen (nicht sperren)
//
// Vorschau ist Standard; erst `--schreiben` ändert etwas.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");

(async () => {
  const faelle = await sqlPool`
    SELECT p.id, p.assigned_agent_id, p.follow_up_date, p.promised_payment_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.primary_email) AS name,
           (SELECT a.dismissed_reason FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NOT NULL
             ORDER BY a.dismissed_at DESC LIMIT 1) AS grund
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND NOT p.is_blocked
      AND p.assigned_agent_id IS NOT NULL
      -- steht heute oder früher in der Anrufliste
      AND (p.promised_payment_date <= CURRENT_DATE
           OR (p.follow_up_date IS NOT NULL AND p.follow_up_date <= CURRENT_DATE))
      -- hat mindestens eine aussortierte Bestellung …
      AND EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NOT NULL)
      -- … und KEINE, die noch offen und nicht aussortiert ist
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a
                        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NULL
                          AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired'))
  `;

  console.log(`${faelle.length} Person(en) stehen in der Anrufliste, obwohl alle Bestellungen aussortiert sind\n`);
  let gesperrt = 0;
  let verschoben = 0;

  for (const f of faelle as any[]) {
    const grund = String(f.grund || "");
    const sperren = grund === "abgelehnt" || grund === "kein_interesse";
    console.log(`  ${String(f.name || `Person ${f.id}`).slice(0, 34).padEnd(36)} Grund: ${grund.padEnd(18)} → ${sperren ? "gesperrt" : "Wiedervorlage +3 Tage"}`);
    if (!SCHREIBEN) continue;
    if (sperren) {
      await sqlPool`
        UPDATE fiaon_persons SET is_blocked = TRUE, follow_up_date = NULL, updated_at = NOW()
        WHERE id = ${f.id}
      `;
      gesperrt++;
    } else {
      await sqlPool`
        UPDATE fiaon_persons SET follow_up_date = CURRENT_DATE + 3, updated_at = NOW()
        WHERE id = ${f.id}
      `;
      verschoben++;
    }
  }

  console.log(SCHREIBEN
    ? `\nGeschrieben: ${gesperrt} gesperrt, ${verschoben} verschoben.`
    : "\nNur Vorschau — mit --schreiben ausführen.");
  await sqlPool.end();
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
