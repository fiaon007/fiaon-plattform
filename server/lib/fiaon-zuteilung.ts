// ═══════════════════════════════════════════════════════════════════════════
// EREIGNIS-ZUTEILUNG — wer heiß wird, bekommt sofort jemanden
//
// DER BELEGTE FALL
// Anas Barghouti klickt am 08.08.2026 „ich habe bezahlt". Damit ist er Stufe A
// — der heißeste Fall im Haus. Auf seiner Karte steht: „kein Agent". Niemand
// ruft an, weil er in niemandes Liste auftaucht.
//
// WARUM DAS PASSIEREN KONNTE
// Zuteilung geschah bisher nur an zwei Stellen: im Tageslauf um sechs Uhr
// morgens (`autoAssignTier1`, ausschließlich Tier 1) und im Nachschub, wenn
// ein Agent unter seine Schwelle fällt. Wer um 14 Uhr Stufe A erreicht, wartet
// im besten Fall bis zum nächsten Morgen — und ein Stufe-B-Kunde wartet, bis
// zufällig jemand Platz hat. Gemessen: 756 Personen auf Stufe A oder B ohne
// jeden Zuständigen, davon 9 auf Stufe A.
//
// DIE REGEL
// Erreicht eine Person Tier 1 oder 2 und hat keinen Zuständigen, bekommt sie
// ihn SOFORT — in derselben Transaktion, in der sich ihre Einstufung ändert.
// Es gibt keinen Grund zu warten: Der Kunde ist da, die Arbeit ist da.
//
// WAS UNANGETASTET BLEIBT
// Der Besitzschutz. Wer `betreuung_seit` trägt, wurde schon einmal
// dokumentiert betreut und gehört seinem Betreuer — auch wenn die Zuweisung
// verloren ging. Diese Funktion vergibt NUR herrenlose Personen und nimmt
// niemandem etwas weg.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/**
 * Wer bekommt den nächsten Kunden? Der aktive, verteilende Mitarbeiter mit dem
 * kleinsten offenen Bestand (Tier 1 bis 3).
 *
 * Gezählt wird der GESAMTE offene Bestand und nicht nur die betroffene Stufe:
 * Wer 30 Stufe-A-Fälle hat, ist beschäftigt, auch wenn gerade ein Stufe-B-Fall
 * zu vergeben wäre.
 */
export async function agentMitKleinsterLast(lauf: Lauf = sqlPool): Promise<number | null> {
  const [a] = (await lauf`
    SELECT a.id,
           COUNT(p.id) FILTER (WHERE p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked)::int AS last
    FROM fiaon_agents a
    LEFT JOIN fiaon_persons p
      ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    GROUP BY a.id
    ORDER BY last ASC, a.id ASC
    LIMIT 1
  `) as any[];
  return a ? Number(a.id) : null;
}

export interface ZuteilungsErgebnis {
  zugeteilt: boolean;
  agentId: number | null;
  grund: string;
}

/**
 * Teilt eine herrenlose Person sofort zu — falls sie es verdient.
 *
 * Wirft NIE. Eine Zuteilung, die eine Zahlungsmeldung scheitern lässt, wäre
 * teurer als die fehlende Zuteilung.
 *
 * @param lauf Läuft der Aufruf in einer Transaktion, MUSS sie durchgereicht
 *             werden — sonst steht die Zuteilung außerhalb des Vorgangs, der
 *             sie ausgelöst hat, und überlebt dessen Rücknahme.
 */
export async function sofortZuteilen(
  personId: number, lauf: Lauf = sqlPool,
): Promise<ZuteilungsErgebnis> {
  try {
    const [p] = (await lauf`
      SELECT id, priority_tier, assigned_agent_id, betreuung_seit, is_blocked, ist_test_am
      FROM fiaon_persons WHERE id = ${personId} AND merged_into_person_id IS NULL
    `) as any[];
    if (!p) return { zugeteilt: false, agentId: null, grund: "Person nicht gefunden" };
    if (p.assigned_agent_id) {
      return { zugeteilt: false, agentId: Number(p.assigned_agent_id), grund: "hat bereits einen Zuständigen" };
    }
    if (p.is_blocked) return { zugeteilt: false, agentId: null, grund: "gesperrt" };
    if (p.ist_test_am) return { zugeteilt: false, agentId: null, grund: "Testeintrag" };
    if (![1, 2].includes(Number(p.priority_tier))) {
      return { zugeteilt: false, agentId: null, grund: `Stufe ${p.priority_tier} — keine Zuteilung nötig` };
    }
    // BESITZSCHUTZ: Wer dokumentiert betreut wurde, gehört seinem Betreuer.
    // Die Zuweisung wiederherzustellen ist Sache eines Menschen, nicht einer
    // Automatik — sonst nimmt sie den Kunden dem Falschen.
    if (p.betreuung_seit) {
      return { zugeteilt: false, agentId: null, grund: `betreut seit ${p.betreuung_seit} — Besitzschutz` };
    }

    const agentId = await agentMitKleinsterLast(lauf);
    if (!agentId) return { zugeteilt: false, agentId: null, grund: "kein verteilender Mitarbeiter aktiv" };

    // `AND assigned_agent_id IS NULL` im UPDATE: Zwei gleichzeitige Ereignisse
    // auf derselben Person würden sonst zweimal zuteilen, und der zweite
    // überschriebe den ersten.
    const rows = (await lauf`
      UPDATE fiaon_persons
      SET assigned_agent_id = ${agentId}, assigned_at = NOW(), updated_at = NOW()
      WHERE id = ${personId} AND assigned_agent_id IS NULL
      RETURNING id
    `) as any[];
    if (rows.length === 0) {
      return { zugeteilt: false, agentId: null, grund: "wurde zeitgleich anderweitig zugeteilt" };
    }

    const [ref] = (await lauf`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (ref) {
      await lauf`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, NULL, 'System', 'system',
                ${`Neu bei dir: Der Kunde ist gerade auf Stufe ${Number(p.priority_tier) === 1 ? "A (Zahlung gemeldet)" : "B (Rechnung offen)"} gesprungen und hatte niemanden. Heute anrufen.`},
                NOW())
      `.catch(() => {});
    }
    console.log(`[ZUTEILUNG] Person ${personId} (Tier ${p.priority_tier}) → Agent ${agentId}`);
    return { zugeteilt: true, agentId, grund: "sofort zugeteilt" };
  } catch (err) {
    console.error("[ZUTEILUNG] fehlgeschlagen:", err instanceof Error ? err.message : err);
    return { zugeteilt: false, agentId: null, grund: "Fehler" };
  }
}
