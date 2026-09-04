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
      -- 04.09.2026 (E-120): Nur, wer Zeiten hinterlegt hat — sonst landet der
      -- Kunde bei jemandem, bei dem er nie einen Termin bekommt (Florentine).
      AND EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id AND COALESCE(v.aktiv, TRUE))
      -- ══════════════════════════════════════════════════════════════════
      -- NUR VERTRIEB BEKOMMT VERTRIEBSKUNDEN
      --
      -- ── DER BEFUND (11.08.2026) ───────────────────────────────────────
      -- Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden
      -- drinnen, die die Agenten abgelehnt haben oder auf nicht erreicht.
      -- Das ist falsch!"
      --
      -- Gemessen: Beide Inkasso-Mitarbeiter hatten je 11 Vertriebskunden —
      -- 22 insgesamt, mit Stufen wie „zahlungsfrist_abgelaufen" und
      -- „antrag_abgeschlossen". Sie kamen von Nikita Boychenko (9), Daniel
      -- Stripling (8) und Lucas Böhnert (3).
      --
      -- Die Ursache stand HIER: Diese Abfrage prüfte „distribution_active“
      -- und „active“, aber NICHT die Rolle. Ein neu angelegtes
      -- Inkasso-Konto ist aktiv und hat null Kunden — also war es immer
      -- „der Agent mit der kleinsten Last" und bekam jeden neuen Lead.
      --
      -- Ohne diese Zeile wären es morgen wieder mehr. Die Bereinigung der
      -- 22 bestehenden Fälle ist der zweite Schritt; dieser hier ist der
      -- erste, sonst schöpft man aus einem laufenden Hahn.
      -- ══════════════════════════════════════════════════════════════════
      AND COALESCE(a.rolle, 'agent') IN ('agent', 'vertriebsleiter')
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
    // ── STUFE 0 GEHÖRT DAZU (30.08.2026) ────────────────────────────────
    // Hier stand `![1, 2]`. Die Begründung war: Ein Bestandskunde ist aus dem
    // Vertrieb heraus, also braucht er keine Zuteilung.
    //
    // Das Team meldete: „Bezahlte Kunden haben keinen Betreuer." GEMESSEN
    // (scripts/mess-stufen-betreuer.ts): 88 bezahlte oder gemeldete Personen
    // ohne Zuständigen — und nur EINE davon hatte einen Agenten an der
    // Bestellung. Es fehlte also wirklich, es war nicht bloß falsch angezeigt.
    //
    // Der Weg dorthin: Wer als Stufe 1 oder 2 zugeteilt WÄRE, ist beim Bezahlen
    // schon zugeteilt. Übrig bleiben die, die OHNE vorherige Stufe bezahlt haben
    // — Direktzahler. Für die griff die Zuteilung nie, und danach nie wieder:
    // Stufe 0 war ausgeschlossen.
    //
    // Ein bezahlter Kunde ohne Zuständigen hat niemanden, der sein Startgespräch
    // führt, seine Rückfrage beantwortet oder seine Unterlagen anmahnt. „Aus dem
    // Vertrieb heraus" heißt nicht „niemandem zugeordnet".
    //
    // Stufe 3 bleibt ausgeschlossen: Ein reiner Lead wird über die
    // Lead-Verteilung vergeben, nicht hier. Zwei Verteilungen auf dieselbe
    // Menge wären zwei Wahrheiten.
    if (![0, 1, 2].includes(Number(p.priority_tier))) {
      return { zugeteilt: false, agentId: null, grund: `Stufe ${p.priority_tier} — keine Zuteilung nötig` };
    }
    // ── BESITZSCHUTZ ────────────────────────────────────────────────────
    // Wer dokumentiert betreut wurde, gehört seinem Betreuer. Die Zuweisung
    // wiederherzustellen ist Sache eines Menschen, nicht einer Automatik —
    // sonst nimmt sie den Kunden dem Falschen.
    //
    // ABER: Ein Schutz braucht jemanden, den er schützt. Sandra Ulke-Züllich
    // (Person 4310) wurde am 04.07.2026 dokumentiert betreut — von Agent 7,
    // einem TESTKONTO. Seither hatte sie einen Monat lang niemanden: Der
    // Besitzschutz hielt sie aus jeder Verteilung heraus, zugunsten eines
    // „Betreuers", hinter dem kein Mensch sitzt.
    //
    // Deshalb greift der Schutz nur, wenn der dokumentierte Betreuer ein
    // ECHTER, aktiver Mitarbeiter ist.
    if (p.betreuung_seit) {
      // ── DER SCHUTZ MUSS DEN BETREUER AUCH EINTRAGEN (30.08.2026) ──────
      // Hier wurde nur ABGELEHNT: „betreut seit … — Besitzschutz". Weil diese
      // Stelle aber erst erreicht wird, wenn `assigned_agent_id` LEER ist,
      // blieb die Person danach bei NIEMANDEM — geschützt für einen Betreuer,
      // der nirgends eingetragen war.
      //
      // GEMESSEN am 30.08.2026: Von 88 bezahlten Personen ohne Zuständigen
      // liefen 28 genau in diesen Zweig. Der Schutz hat sie aus der Verteilung
      // gehalten und ihnen dabei den Menschen nicht gegeben, für den er sie
      // hielt.
      //
      // Der Betreuer ist ABLEITBAR: `betreuerVon` liefert den Agenten mit dem
      // jüngsten dokumentierten Kontakt — dieselbe Quelle, aus der auch die
      // Provisionsfrage beantwortet wird. Also wird er eingetragen, nicht
      // erfunden: Das ist keine Umverteilung, sondern das Nachtragen dessen,
      // was der Verlauf ohnehin sagt.
      //
      // ── UND ZWAR NUR EIN VERTRIEBS-BETREUER ──────────────────────────
      // Erster Entwurf fragte nur „aktiv und kein Testkonto". Ergebnis beim
      // ersten Lauf: 28 bezahlte Kunden wurden Hans-Jürgen Gerhold und Diana
      // Zeller zugeschrieben — dem FORDERUNGSMANAGEMENT. `betreuerVon` liest
      // jeden dokumentierten Kontakt, und wer eine Rate eingetrieben hat, steht
      // eben auch im Verlauf.
      //
      // Das wäre genau die Rollenverwechslung, die dieser Auftrag beseitigt —
      // und sie widerspricht einer Regel, die seit dem 11.08.2026 weiter unten
      // in dieser Datei steht: „Das Forderungsmanagement hat NUR die Kunden,
      // die ihr Abo nicht bezahlt haben."
      //
      // Dieselbe Rollen-Bedingung wie in `agentMitKleinsterLast`. Ist der
      // dokumentierte Kontakt kein Vertriebsmensch, gilt der Besitzschutz nicht
      // — dann greift die normale Verteilung darunter.
      const { betreuerVon } = await import("./tier");
      const dokumentiert = await betreuerVon(lauf, personId).catch(() => null);
      if (dokumentiert) {
        const [ag] = (await lauf`
          SELECT id, name FROM fiaon_agents
          WHERE id = ${dokumentiert.agentId} AND active AND NOT is_test_account
            AND COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter')
        `) as any[];
        if (ag) {
          const rows = (await lauf`
            UPDATE fiaon_persons
            SET assigned_agent_id = ${Number(ag.id)}, assigned_at = NOW(), betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
            WHERE id = ${personId} AND assigned_agent_id IS NULL
            RETURNING id
          `) as any[];
          if (rows.length > 0) {
            console.log(`[ZUTEILUNG] Person ${personId}: dokumentierter Betreuer ${ag.name} nachgetragen (Besitzschutz).`);
            return {
              zugeteilt: true, agentId: Number(ag.id),
              grund: `dokumentierter Betreuer nachgetragen (betreut seit ${p.betreuung_seit})`,
            };
          }
        }
      }
      // Kein ableitbarer, echter Betreuer: Dann schützt der Schutz niemanden.
      // Sandra Ulke-Züllich (Person 4310) lag so einen Monat lang brach —
      // dokumentiert betreut von einem TESTKONTO.
      console.log(`[ZUTEILUNG] Person ${personId}: betreuung_seit gesetzt, aber kein echter Betreuer — wird verteilt.`);
    }

    const agentId = await agentMitKleinsterLast(lauf);
    if (!agentId) return { zugeteilt: false, agentId: null, grund: "kein verteilender Mitarbeiter aktiv" };

    // `AND assigned_agent_id IS NULL` im UPDATE: Zwei gleichzeitige Ereignisse
    // auf derselben Person würden sonst zweimal zuteilen, und der zweite
    // überschriebe den ersten.
    const rows = (await lauf`
      UPDATE fiaon_persons
      SET assigned_agent_id = ${agentId}, assigned_at = NOW(), betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
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
                ${Number(p.priority_tier) === 0
                  ? "Neu bei dir: Der Kunde hat BEZAHLT und hatte niemanden. Kein Verkaufsgespräch — "
                    + "er braucht sein Startgespräch und einen Ansprechpartner für Rückfragen."
                  : `Neu bei dir: Der Kunde ist gerade auf Stufe ${Number(p.priority_tier) === 1 ? "A (Zahlung gemeldet)" : "B (Rechnung offen)"} gesprungen und hatte niemanden. Heute anrufen.`},
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

// ═══════════════════════════════════════════════════════════════════════════
// BEREINIGUNG: VERTRIEBSKUNDEN BEI SONDERROLLEN
//
// ── DER BEFUND (11.08.2026) ────────────────────────────────────────────────
// Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden drinnen, die
// die Agenten abgelehnt haben oder auf nicht erreicht. Das ist falsch! Das
// Forderungsmanagement hat NUR ausschließlich die Kunden, die ihr Abo nicht
// bezahlt haben."
//
// Gemessen: Beide Inkasso-Mitarbeiter hatten je 11 Vertriebskunden. Die
// Ursache war die fehlende Rollenprüfung in `agentMitKleinsterLast` — ein neu
// angelegtes Inkasso-Konto hat null Kunden und war damit immer „der Agent mit
// der kleinsten Last".
//
// Der Hahn ist zugedreht. Diese Funktion räumt auf, was schon durchgelaufen
// ist.
//
// ── WOHIN GEHEN DIE KUNDEN? ────────────────────────────────────────────────
// Zurück an den, der sie vorher hatte — das steht im Protokoll
// (`person_owner_changed`). Wer keinen vorherigen Betreuer hat, geht in die
// normale Verteilung. Beides ist nachvollziehbar; ein pauschales „alle an
// Daniel" wäre es nicht.
// ═══════════════════════════════════════════════════════════════════════════

export interface BereinigungZeile {
  personId: number;
  name: string;
  stufe: number;
  grund: string | null;
  vonAgentId: number;
  vonName: string;
  anAgentId: number | null;
  anName: string;
}

/**
 * Vertriebskunden bei Sonderrollen finden und zurückgeben.
 *
 * Ohne `schreiben` passiert nichts — dieselbe Regel wie bei jedem Lauf, der
 * fremde Arbeit anfasst.
 */
export async function sonderrollenBereinigen(
  opts: { schreiben?: boolean } = {}, lauf: Lauf = sqlPool,
): Promise<{ zeilen: BereinigungZeile[]; verschoben: number; hinweis: string }> {
  const betroffen = (await lauf`
    SELECT p.id AS person_id, p.priority_tier, p.tier_reason,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS name,
           p.assigned_agent_id AS von_id, a.name AS von_name,
           -- Der letzte Betreuer VOR der Sonderrolle. Das Protokoll weiß es.
           (SELECT e.from_agent_id FROM fiaon_agent_events e
             WHERE e.type = 'person_owner_changed'
               -- Das Feld heisst „person_id", nicht „personId" — nachgesehen
               -- in echten Zeilen, nicht geraten. Und meta ist text, nicht
               -- jsonb. Mit dem falschen Namen fand die Abfrage NIEMANDEN, und
               -- alle 22 Kunden waeren an denselben Menschen gegangen.
               AND (e.meta::jsonb->>'person_id')::int = p.id
               AND e.from_agent_id IS NOT NULL
               AND e.from_agent_id <> p.assigned_agent_id
             ORDER BY e.created_at DESC LIMIT 1) AS vorher_id
    FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE a.active
      AND COALESCE(a.rolle, 'agent') IN ('inkasso', 'onboarding')
      AND p.merged_into_person_id IS NULL
      AND p.priority_tier BETWEEN 1 AND 3
      AND NOT p.is_blocked
    ORDER BY a.name, p.id
  `) as any[];

  if (betroffen.length === 0) {
    return { zeilen: [], verschoben: 0,
      hinweis: "Keine Sonderrolle hat Vertriebskunden. So soll es sein." };
  }

  // Für jeden Kunden das Ziel bestimmen.
  const zeilen: BereinigungZeile[] = [];
  // Wie viele hat jeder in DIESEM Lauf schon dazubekommen? Ohne diese Zahl
  // bekommt der mit der kleinsten Last alle.
  const geplant = new Map<number, number>();
  for (const b of betroffen) {
    let anId: number | null = b.vorher_id ? Number(b.vorher_id) : null;
    let anName = "";
    if (anId) {
      const [a] = (await lauf`
        SELECT name, rolle, active FROM fiaon_agents WHERE id = ${anId}
      `) as any[];
      // Der frühere Betreuer muss noch da UND im Vertrieb sein. Sonst wäre es
      // eine Rückgabe an jemanden, der selbst nicht zuständig ist.
      if (!a?.active || !["agent", "vertriebsleiter"].includes(String(a.rolle ?? "agent"))) {
        anId = null;
      } else anName = String(a.name);
    }
    if (!anId) {
      // ── LASTGERECHT, NICHT ZWANZIGMAL DERSELBE ────────────────────────
      // `agentMitKleinsterLast()` fragt die Datenbank — und die weiss nichts
      // von den Zuteilungen, die in DIESER Schleife erst geplant werden. Beim
      // ersten Entwurf gingen deshalb alle 22 Kunden an Lucas Böhnert: Er
      // hatte die kleinste Last, und die Zahl aenderte sich waehrend der
      // Vorschau nicht.
      //
      // `geplant` zaehlt mit. Nach jeder Zuteilung ist ein anderer dran.
      const kandidaten = (await lauf`
        SELECT a.id, a.name,
               COUNT(p.id) FILTER (WHERE p.priority_tier BETWEEN 1 AND 3
                                   AND NOT p.is_blocked)::int AS last
        FROM fiaon_agents a
        LEFT JOIN fiaon_persons p
          ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
        WHERE a.active AND a.distribution_active AND NOT a.is_test_account
      -- 04.09.2026 (E-120): Nur, wer Zeiten hinterlegt hat — sonst landet der
      -- Kunde bei jemandem, bei dem er nie einen Termin bekommt (Florentine).
      AND EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id AND COALESCE(v.aktiv, TRUE))
          AND COALESCE(a.rolle, 'agent') IN ('agent', 'vertriebsleiter')
        GROUP BY a.id, a.name
      `) as any[];
      const beste = kandidaten
        .map((k) => ({ id: Number(k.id), name: String(k.name),
                       last: Number(k.last) + (geplant.get(Number(k.id)) ?? 0) }))
        .sort((x, y) => x.last - y.last || x.id - y.id)[0];
      if (beste) { anId = beste.id; anName = beste.name; }
    }
    if (anId) geplant.set(anId, (geplant.get(anId) ?? 0) + 1);
    zeilen.push({
      personId: Number(b.person_id),
      name: String(b.name),
      stufe: Number(b.priority_tier),
      grund: b.tier_reason ?? null,
      vonAgentId: Number(b.von_id),
      vonName: String(b.von_name),
      anAgentId: anId,
      anName: anName || "niemand (kein freier Agent)",
    });
  }

  if (!opts.schreiben) {
    return { zeilen, verschoben: 0,
      hinweis: `${zeilen.length} Vertriebskunden liegen bei Sonderrollen. `
        + "Das ist die Vorschau — es wurde nichts geändert." };
  }

  let verschoben = 0;
  for (const z of zeilen) {
    if (!z.anAgentId) continue;
    await lauf`
      UPDATE fiaon_persons
      SET assigned_agent_id = ${z.anAgentId}, assigned_at = NOW(), betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
      WHERE id = ${z.personId} AND assigned_agent_id = ${z.vonAgentId}
    `;
    await lauf`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, from_agent_id, to_agent_id, actor, reason)
      VALUES (NULL, 'person_owner_changed',
              ${JSON.stringify({ personId: z.personId, grund: "sonderrolle_bereinigt" })},
              ${z.vonAgentId}, ${z.anAgentId}, 'Vorgesetzter',
              ${`Zurueck in den Vertrieb: ${z.vonName} traegt eine Sonderrolle und bearbeitet keine Vertriebskunden.`})
    `.catch(() => {});
    verschoben++;
  }

  console.log(`[ZUTEILUNG] ${verschoben} Vertriebskunden von Sonderrollen zurueckgegeben.`);
  return { zeilen, verschoben,
    hinweis: `${verschoben} Kunden zurueck in den Vertrieb. Die Sonderrollen bekommen ab jetzt `
      + "keine neuen mehr — die Zuteilung prueft die Rolle." };
}
