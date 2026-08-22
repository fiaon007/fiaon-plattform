// ═══════════════════════════════════════════════════════════════════════════
// ÜBERGABE AN DEN NÄCHSTEN VERTRIEBLER
//
// Gemeldet am 06.08.2026: „Manche Kunden blockieren die Nummer eines Agenten,
// heben beim anderen aber ab."
//
// Bis jetzt gab es dafür nur zwei schlechte Wege: Der Agent ruft ewig weiter an
// (und dokumentiert „nicht erreicht", bis der Kunde in der Liste nach unten
// rutscht), oder er fragt beim Vorgesetzten nach einer Umzuweisung. Beides kostet
// einen Abschluss, den ein Kollege mit einer anderen Nummer sofort hätte machen
// können.
//
// DIESE DATEI IST DIE AUSNAHME VOM BESITZSCHUTZ — und zwar eine kontrollierte:
// Betreute Kunden werden nie AUTOMATISCH umverteilt. Hier verteilt aber keine
// Automatik, sondern der Betreuer selbst gibt ab. Das ist eine menschliche
// Entscheidung, sie wird protokolliert, und sie hat einen belegten Grund im
// Kontaktprotokoll (`outcome = 'nummer_blockiert'`).
//
// WER BEKOMMT DEN KUNDEN
//   1. Nur aktive, echte Mitarbeiter, die an der Verteilung teilnehmen.
//   2. NIEMAND, der bei diesem Kunden schon selbst blockiert wurde. Sonst
//      wandert der Kunde im Kreis und landet wieder bei einer toten Nummer.
//   3. Von den verbliebenen der mit dem kleinsten offenen Bestand. Wer ohnehin
//      am meisten trägt, bekommt nicht auch noch die schwierigen Fälle.
//
// WAS MIT DER PROVISION PASSIERT
// Der Anspruch folgt dem zuletzt dokumentierten Kontakt (siehe
// `ermittleProvisionsAnspruch`). Wer den Kunden übernimmt und den Abschluss
// dokumentiert, bekommt die Provision. Das ist die einzige Regel, die hier
// funktioniert: Ein Agent, den der Kunde blockiert hat, kann den Abschluss
// nicht machen — und der Kollege, der ihn macht, soll ihn nicht abgeben müssen.
// Der Übergebende sieht diesen Satz vor dem Klick, damit niemand später sagen
// kann, er habe es nicht gewusst.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export interface UebergabeErgebnis {
  /** Hat es geklappt? Wenn nicht, steht im `grund`, was der Mensch tun muss. */
  ok: boolean;
  neuerAgentId: number | null;
  neuerAgentName: string | null;
  grund: string;
}

/**
 * Gibt eine Person an den nächsten geeigneten Vertriebler weiter.
 *
 * @param personId   Wer übergeben wird.
 * @param akteurId   Wer den Knopf gedrückt hat (Agent oder Vertriebsleitung).
 * @param akteurName Für Protokoll und Rückmeldung.
 */
export async function uebergabeAnNaechsten(
  personId: number,
  akteurId: number,
  akteurName: string,
): Promise<UebergabeErgebnis> {
  const [person] = await sqlPool`
    SELECT id, assigned_agent_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                    company_name, primary_email, CONCAT('Person ', id)) AS name
    FROM fiaon_persons WHERE id = ${personId} AND merged_into_person_id IS NULL
  `;
  if (!person) return { ok: false, neuerAgentId: null, neuerAgentName: null, grund: "Kunde nicht gefunden." };

  const bisher = person.assigned_agent_id == null ? null : Number(person.assigned_agent_id);

  // Wer wurde bei diesem Kunden schon blockiert? Dieselbe Nummer ein zweites
  // Mal zu probieren ist kein Vertrieb, das ist Beschäftigungstherapie.
  const blockiert = await sqlPool`
    SELECT DISTINCT cl.agent_id
    FROM fiaon_contact_log cl
    JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${personId}
      AND cl.outcome = 'nummer_blockiert' AND cl.voided_at IS NULL
      AND cl.agent_id IS NOT NULL
  `;
  const gesperrteIds = new Set((blockiert as any[]).map((r) => Number(r.agent_id)));
  if (bisher) gesperrteIds.add(bisher);
  gesperrteIds.add(akteurId);

  const kandidaten = await sqlPool`
    SELECT a.id, a.name,
           (SELECT COUNT(*) FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
               AND p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked)::int AS offen
    FROM fiaon_agents a
    WHERE a.active
      AND COALESCE(a.is_test_account, FALSE) = FALSE
      AND COALESCE(a.distribution_active, TRUE) = TRUE
      -- Nur Vertrieb: Ein Kunde, der einen Agenten blockiert hat, wird an
      -- einen anderen VERKÄUFER übergeben — nicht an das Forderungsmanagement.
      AND COALESCE(a.rolle, 'agent') IN ('agent', 'vertriebsleiter')
      AND a.password_hash IS NOT NULL
    ORDER BY offen ASC, a.id ASC
  `;
  const frei = (kandidaten as any[]).filter((a) => !gesperrteIds.has(Number(a.id)));

  if (frei.length === 0) {
    // Kein Ausweg mehr: Jeder verfügbare Kollege wurde bei diesem Kunden schon
    // blockiert. Das ist kein technischer Fehler, sondern eine Nachricht — der
    // Kunde will offenbar nicht angerufen werden. Wir ändern nichts und sagen
    // es deutlich, statt den Kunden still im Kreis zu schicken.
    return {
      ok: false, neuerAgentId: null, neuerAgentName: null,
      grund: (kandidaten as any[]).length <= 1
        ? "Es gibt derzeit keinen zweiten Mitarbeiter, an den übergeben werden könnte."
        : "Bei diesem Kunden wurde bereits jeder Kollege blockiert. Der Vermerk ist gespeichert — bitte mit der Vertriebsleitung klären.",
    };
  }

  const ziel = frei[0];

  await sqlPool.begin(async (tx) => {
    // Grund und Akteur für den Protokoll-Trigger (Migration 033).
    await tx`SELECT set_config('fiaon.reason', 'anrufer_blockiert', true)`;
    await tx`SELECT set_config('fiaon.actor', ${`agent:${akteurId}`}, true)`;
    await tx`
      UPDATE fiaon_persons
         SET assigned_agent_id = ${ziel.id}, follow_up_date = CURRENT_DATE, updated_at = NOW()
       WHERE id = ${personId}
    `;
    // Die Bestellungen ziehen mit. Liefen sie auseinander, wäre der Kunde für
    // den einen sichtbar und für den anderen nicht — und das Altmodell der
    // Provision läse weiter den alten Namen.
    await tx`
      UPDATE fiaon_applications SET assigned_agent_id = ${ziel.id}, updated_at = NOW()
      WHERE person_id = ${personId} AND merged_into IS NULL
    `;
  });

  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, from_agent_id, to_agent_id)
    VALUES (${ziel.id}, 'uebergabe_blockiert',
            ${JSON.stringify({
              person_id: personId, kunde: person.name,
              von: bisher, an: Number(ziel.id), akteur: akteurName,
              schon_blockiert: Array.from(gesperrteIds),
            })},
            ${`agent:${akteurId}`}, ${bisher}, ${Number(ziel.id)})
  `.catch((e) => console.error("[UEBERGABE] Protokoll:", e));

  console.log(`[UEBERGABE] ${person.name} (Person ${personId}): ${bisher ?? "niemand"} → ${ziel.name} (blockiert, durch ${akteurName})`);

  return {
    ok: true,
    neuerAgentId: Number(ziel.id),
    neuerAgentName: String(ziel.name),
    grund: `${String(ziel.name).split(" ")[0]} übernimmt und ruft von einer anderen Nummer an.`,
  };
}
