/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TIER-BERECHNUNG — EINZIGE WAHRHEIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Das Tier hängt an der PERSON, nicht am Antrag. Eine Person mit acht
 * Bestellungen hat ein Tier, nicht acht. Berechnet wird es als MAX über alle
 * bewertbaren Anträge der Person.
 *
 * ══ WORAUS DAS TIER BERECHNET WIRD ════════════════════════════════════════
 * AUSSCHLIESSLICH aus `payment_status`. Die Spalte `status` dient genau einem
 * Zweck: innerhalb von `payment_status = 'pending'` die echten Abbrecher von
 * abgeschlossenen Anträgen zu trennen.
 *
 * Der Grund ist fachlich und wichtig: Ein Kunde kann Dokumente erst hochladen,
 * NACHDEM der Admin die Zahlung manuell freigegeben hat. `status` mit Werten
 * wie `documents_submitted`, `approved` oder `completed` bedeutet daher
 * ZWINGEND, dass bereits bezahlt wurde. Wer `status` als Fortschritt liest und
 * daraus ein Vertriebs-Tier ableitet, wirft bezahlte Bestandskunden zurück in
 * den Vertrieb und lässt sie zur Zahlung auffordern. Das ist Kundenschaden.
 *
 * ══ RANGFOLGE ═════════════════════════════════════════════════════════════
 * Höherer Rang gewinnt beim MAX über die Anträge einer Person.
 *
 *   60  paid              → Tier 0  Bestandskunde, raus aus dem Vertrieb
 *   50  claimed_paid      → Tier 1  Zahlung angekündigt
 *   40  pending_payment   → Tier 2  Rechnung offen
 *   35  expired           → Tier 2  Zahlungsfrist abgelaufen
 *   30  pending, nicht abgebrochen → Tier 2  Antrag abgeschlossen
 *   20  pending, abgebrochen       → Tier 3  Antrag abgebrochen
 *   10  refunded/cancelled → Tier -1 ausgeschlossen
 *    0  kein bewertbarer Antrag    → Tier 3  nur Lead
 *
 * Zur Reihenfolge innerhalb von Tier 2: `pending_payment` steht über
 * `expired`, weil eine aktuell offene Rechnung der handlungsleitende Zustand
 * ist; `expired` steht über `pending`, weil dort schon eine Rechnung
 * existierte. `expired` wird NICHT abgewertet — diese Leute waren vollständig
 * durch den Antrag und sind qualitativ Tier-2-Material.
 *
 * Zur Reihenfolge von `refunded`/`cancelled`: Rang 10 liegt UNTER Tier 3.
 * Dadurch wird eine Person nur dann ausgeschlossen, wenn sie keinen einzigen
 * anderen bewertbaren Antrag hat. Wer nach einer Erstattung neu bestellt,
 * bleibt also im Vertrieb — sonst wäre der Rückkehrer für immer unsichtbar.
 */

/**
 * Abbruchstellen innerhalb von `payment_status = 'pending'`. Wer hier steht,
 * hat den Antrag nie abgeschickt.
 */
export const ABBRECHER_STATUS = ["started", "config", "personal_data"] as const;

/** Als SQL-Liste, für die Verwendung in den Ausdrücken unten. */
const ABBRECHER_SQL = ABBRECHER_STATUS.map((s) => `'${s}'`).join(", ");

/**
 * Welche Anträge überhaupt in die Bewertung eingehen.
 *
 *   · `ist_entwurf`            Funnel-Abbrecher ohne Kontaktmöglichkeit,
 *                              kommen nie in den Vertrieb.
 *   · `merged_into IS NOT NULL` Dublette, die auf einen anderen Antrag zeigt.
 *   · `payment_status = 'superseded'` Dublette; das Person-MAX regelt den Fall
 *                              ohnehin über die überlebende Bestellung.
 *   · `gdpr_deleted_at`        gelöschte Datensätze bleiben draußen.
 *
 * @param a Tabellen-Alias von `fiaon_applications`
 */
export function antragBasisSql(a = "a"): string {
  return `${a}.person_id IS NOT NULL
      AND NOT ${a}.ist_entwurf
      AND ${a}.merged_into IS NULL
      AND ${a}.payment_status <> 'superseded'
      AND ${a}.gdpr_deleted_at IS NULL
      -- Archivierte Bestellungen bestimmen keine Einstufung mehr. Sonst würde
      -- ein als Testeintrag archivierter Antrag den Kunden weiter in Tier 2
      -- halten — und die Arbeitsliste bliebe voll mit etwas, das es fachlich
      -- nicht gibt (Teil 3).
      AND ${a}.archived_at IS NULL`;
}

/**
 * Rang eines einzelnen Antrags.
 *
 * `COALESCE(status, '')` ist Absicht: Ein `pending`-Antrag ohne `status` wird
 * als abgeschlossen gewertet (Rang 30), nicht als Abbrecher. Das ist die
 * ungefährliche Richtung — ein abgeschlossener Antrag, der als Abbrecher
 * behandelt wird, bekommt das falsche Gesprächsskript; umgekehrt bekommt ein
 * Abbrecher nur einen etwas unpassenden, aber harmlosen Hinweis.
 *
 * @param a Tabellen-Alias von `fiaon_applications`
 */
export function rangSql(a = "a"): string {
  return `CASE
      WHEN ${a}.payment_status = 'paid'            THEN 60
      WHEN ${a}.payment_status = 'claimed_paid'    THEN 50
      WHEN ${a}.payment_status = 'pending_payment' THEN 40
      WHEN ${a}.payment_status = 'expired'         THEN 35
      WHEN ${a}.payment_status = 'pending'
           AND COALESCE(${a}.status, '') NOT IN (${ABBRECHER_SQL}) THEN 30
      WHEN ${a}.payment_status = 'pending'
           AND COALESCE(${a}.status, '') IN (${ABBRECHER_SQL})     THEN 20
      WHEN ${a}.payment_status IN ('refunded', 'cancelled')        THEN 10
      ELSE 0
    END`;
}

/** Rang → `priority_tier`. */
export function tierSql(rang = "rang"): string {
  return `CASE ${rang}
      WHEN 60 THEN 0
      WHEN 50 THEN 1
      WHEN 40 THEN 2
      WHEN 35 THEN 2
      WHEN 30 THEN 2
      WHEN 20 THEN 3
      WHEN 10 THEN -1
      ELSE 3
    END`;
}

/** Rang → `tier_reason`. Werte entsprechen `TierGrund` in tier-hinweise.ts. */
export function grundSql(rang = "rang"): string {
  return `CASE ${rang}
      WHEN 60 THEN 'bezahlt'
      WHEN 50 THEN 'zahlung_angekuendigt'
      WHEN 40 THEN 'rechnung_offen'
      WHEN 35 THEN 'zahlungsfrist_abgelaufen'
      WHEN 30 THEN 'antrag_abgeschlossen'
      WHEN 20 THEN 'antrag_abgebrochen'
      WHEN 10 THEN 'ausgeschlossen'
      ELSE 'nur_lead'
    END`;
}

/**
 * Tier je lebender Person, inklusive des Antrags, der den Rang bestimmt.
 *
 * `DISTINCT ON` statt `max()`, weil neben dem Rang auch `status` und `ref` des
 * ausschlaggebenden Antrags gebraucht werden: `status` für den Platzhalter im
 * Hinweis „Antrag abgebrochen bei: …", `ref` für die Nachvollziehbarkeit.
 *
 * Personen ohne bewertbaren Antrag erscheinen mit Rang 0 → Tier 3, `nur_lead`.
 * Gemergte Personen (`merged_into_person_id`) bleiben draußen.
 */
export function personTierSql(): string {
  return `
    WITH bewertet AS (
      SELECT a.person_id,
             ${rangSql("a")} AS rang,
             a.status,
             a.ref
      FROM fiaon_applications a
      WHERE ${antragBasisSql("a")}
    ),
    gewinner AS (
      -- ══════════════════════════════════════════════════════════════════════
      -- WER NOCH ETWAS OFFEN HAT, IST NICHT FERTIG
      --
      -- ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
      -- Ein Agent: „Unter Bezahlt befinden sich Kunden, bei denen das Paket
      -- bezahlt, die Schufa aber noch offen ist. Links steht Bezahlt,
      -- gleichzeitig steht rechts Zusage seit 7 Tagen überfällig."
      --
      -- Beides stimmte — es bezog sich nur auf verschiedene Vorgänge. Hier
      -- stand „ORDER BY rang DESC": der HÖCHSTE Rang gewann. Ein bezahltes
      -- Paket (60) schlug damit eine offene Bonitätsauskunft (40), und der
      -- Kunde landete unter „Bezahlt" — mit einer offenen Rechnung.
      --
      -- ── DIE RICHTIGE REGEL ────────────────────────────────────────────────
      -- „Bezahlt" heißt: ALLES bezahlt. Solange ein Vorgang offen ist, ist der
      -- Kunde Arbeitsvorrat, und der OFFENE Vorgang bestimmt, warum.
      --
      -- Also: Gibt es eine offene Buchung, gewinnt die dringlichste davon
      -- (kleinster Rang unter 60 = weiteste Entfernung vom Abschluss). Gibt es
      -- keine, bleibt es bei „bezahlt".
      --
      -- Gemessen am 11.08.2026: 410 Kunden haben mehr als eine offene Buchung.
      -- ══════════════════════════════════════════════════════════════════════
      SELECT DISTINCT ON (person_id) person_id, rang, status, ref
      FROM bewertet
      WHERE rang > 0
      ORDER BY person_id,
        -- ── NUR EINE OFFENE RECHNUNG SCHLÄGT „BEZAHLT" ────────────────────
        -- Der erste Entwurf ließ JEDEN offenen Vorgang gewinnen. Gemessen:
        -- 134 bezahlte Kunden wären zurück in den Vertrieb gewandert — die
        -- meisten wegen eines ALTEN, ABGEBROCHENEN Antrags ohne
        -- Zahlungsaufforderung. Das wäre schlimmer als der Fehler: Ein Kunde,
        -- der bezahlt hat, gehört nicht in die Anrufliste.
        --
        -- Eine offene RECHNUNG ist etwas anderes als ein liegengebliebener
        -- Antrag:
        --   50  Zahlung angekündigt, Geld fehlt  → echte offene Rechnung
        --   40  Rechnung offen                   → echte offene Rechnung
        --   35  Zahlungsfrist abgelaufen         → echte offene Rechnung
        --   30  Antrag abgeschlossen             → nie eine Rechnung gestellt
        --   20  Antrag abgebrochen               → nie eine Rechnung gestellt
        --
        -- Nur die ersten drei verdecken ein „bezahlt".
        (rang = 60 AND NOT EXISTS (
          SELECT 1 FROM bewertet b2
          WHERE b2.person_id = bewertet.person_id AND b2.rang BETWEEN 35 AND 50
        )) DESC,
        (rang BETWEEN 35 AND 50) DESC,
        -- Unter den offenen Rechnungen die dringlichste. „Zahlung angekündigt"
        -- (50) ist näher am Abschluss als „Frist abgelaufen" (35) — der höhere
        -- Rang beschreibt den Zustand, in dem der Kunde wirklich ist.
        rang DESC,
        ref
    )
    SELECT p.id                        AS person_id,
           COALESCE(g.rang, 0)         AS rang,
           ${tierSql("COALESCE(g.rang, 0)")}  AS priority_tier,
           ${grundSql("COALESCE(g.rang, 0)")} AS tier_reason,
           g.status                    AS abbruch_status,
           g.ref                       AS quell_ref
    FROM fiaon_persons p
    LEFT JOIN gewinner g ON g.person_id = p.id
    WHERE p.merged_into_person_id IS NULL`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BESITZSCHUTZ — die eigentliche Ursache der Durchmischung
//
// Gemeldet am 05.08.2026:
//   Florentine: „Der Bereich Heute sorgt für doppelte Arbeit. Teilweise werden
//               Kunden anderer Mitarbeiter angezeigt."
//   Daniel:     „Axel Conrad zahlt heute, wurde von mir betreut, weiß nicht bei
//               wem er jetzt zugeteilt ist."
//
// Es war KEIN Datenleck. Es war die Automatik: Erstverteilung, Nachschub und
// Auto-Assign holen Personen aus der Reserve — und in der Reserve landeten auch
// Kunden, die längst jemand betreute. Gemessen an Axel Conrad (Person 4492):
// acht dokumentierte Kontakte, alle von Daniel; am 03.08. um 17:04 nahm ihn eine
// Erstverteilung Daniel weg (from 8 → null) und gab ihn niemandem. In sieben
// Tagen: 686 solche Umverteilungen.
//
// DIE REGEL: Wer einmal dokumentiert betreut wurde, wird NIEMALS automatisch
// umverteilt. `betreuung_seit` hält den Zeitpunkt des ersten dokumentierten
// Kontakts fest und wird nie wieder geleert. Umziehen kann eine betreute Person
// nur ein Mensch — Admin oder Vertriebsleiter, und das steht im Protokoll.
//
// Warum eine eigene Spalte und nicht „hat einen Log-Eintrag"? Weil die Prüfung
// in JEDER Verteil-Abfrage steht. Ein `EXISTS` über zwei Protokolltabellen je
// Kandidat wäre teuer und würde irgendwann aus einer Abfrage vergessen. Eine
// Spalte ist billig, unübersehbar und indexierbar.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Spalte anlegen (idempotent) — EINMAL pro Prozess.
 *
 * Die Merkung ist nicht Kosmetik. `ALTER TABLE` und `CREATE INDEX` nehmen sich
 * eine ACCESS-EXCLUSIVE-Sperre auf fiaon_persons. Beim ersten Bau stand dieser
 * Aufruf am Anfang JEDER Listenabfrage — gemessen: 30 Sekunden pro Aufruf, und
 * bei gleichzeitigen Anfragen eine Sperrschlange bis in die Minuten. Für den
 * Agenten sah das aus wie „die Kundenliste lädt nicht".
 *
 * Ein gemerktes Promise (nicht bloß ein Bool) verhindert außerdem, dass zwei
 * gleichzeitige erste Anfragen die DDL doppelt starten.
 */
let betreuungBereit: Promise<void> | null = null;
export function ensureBetreuungSpalte(sql: any): Promise<void> {
  if (!betreuungBereit) {
    betreuungBereit = (async () => {
      await sql`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS betreuung_seit TIMESTAMPTZ`;
      await sql`
        CREATE INDEX IF NOT EXISTS fiaon_persons_betreuung_idx
        ON fiaon_persons (betreuung_seit) WHERE betreuung_seit IS NULL
      `;
    })().catch((e) => {
      betreuungBereit = null; // nächster Aufruf versucht es erneut
      throw e;
    });
  }
  return betreuungBereit;
}

/**
 * Markiert eine Person als betreut. Aufgerufen, sobald ein Agent ein Ergebnis
 * dokumentiert. `COALESCE` sorgt dafür, dass der ERSTE Kontakt gewinnt: Der
 * Zeitpunkt ist der Beginn der Betreuung, nicht der letzte Anruf.
 */
export async function betreuungMerken(sql: any, opts: { personId?: number | null; ref?: string | null }): Promise<void> {
  let personId = opts.personId ?? null;
  if (!personId && opts.ref) {
    const [row] = await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${opts.ref}`;
    personId = row?.person_id ?? null;
  }
  if (!personId) return;
  await sql`
    UPDATE fiaon_persons SET betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
    WHERE id = ${personId}
  `;
}

/**
 * Der Betreuer einer Person: der Agent des jüngsten dokumentierten Ergebnisses.
 *
 * Dieselbe Definition wie beim Provisionsanspruch — es gibt nur einen Begriff
 * von „betreut", sonst behauptet die Zuweisung etwas anderes als die Abrechnung.
 * Kontakte zählen über ALLE Bestellungen der Person und über das Lead-Protokoll.
 */
export async function betreuerVon(sql: any, personId: number): Promise<{ agentId: number; am: Date } | null> {
  const [row] = await sql`
    SELECT agent_id, created_at FROM (
      SELECT cl.agent_id, cl.created_at
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      WHERE a.person_id = ${personId} AND cl.type = 'result'
        AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
      UNION ALL
      SELECT ll.agent_id, ll.created_at
      FROM fiaon_lead_log ll
      JOIN fiaon_leads l ON l.id = ll.lead_id
      WHERE ll.type = 'result' AND ll.agent_id IS NOT NULL
        AND l.converted_order_id IN (
          SELECT ref FROM fiaon_applications WHERE person_id = ${personId}
        )
    ) k
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return row ? { agentId: Number(row.agent_id), am: row.created_at } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE-AKTUALISIERUNG — der Fehler, der die Listen durchmischt hat
//
// Das Tier war fachlich richtig berechnet, wurde aber NUR von einem Handskript
// (scripts/tier-backfill.ts) in die Tabelle geschrieben. Zwischen zwei Läufen
// lebte die Person mit einem veralteten Tier weiter. Die Folgen, gemessen am
// 05.08.2026:
//
//   · Ein Kunde zahlt um 12:00 → seine Person steht weiter auf Tier 1
//     („Zahlung angekündigt") mit Wiedervorlage auf morgen. Er erscheint am
//     nächsten Tag wieder in der Anrufliste, obwohl er bezahlt hat.
//   · 10 vollständig bezahlte Personen standen in Anruflisten.
//   · Die Verteilung greift ausschließlich Tier 1 und 2 — ein bezahlter Kunde
//     mit veraltetem Tier 1 wurde also an den NÄCHSTEN freien Agenten vergeben.
//     So landeten Daniels bezahlte Kunden bei Florentine.
//
// Deshalb: Nach jeder Zustandsänderung einer Bestellung wird das Tier der
// betroffenen Person sofort neu geschrieben. Berechnet wird es weiter mit
// derselben Abfrage (`personTierSql`) — es gibt keine zweite Regel, nur einen
// zusätzlichen Auslöser.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schreibt Tier und Grund EINER Person neu und räumt dabei die Anruflisten auf.
 *
 * Tier 0 (bezahlt) und Tier -1 (erstattet/storniert) bedeuten: raus aus dem
 * Vertrieb. Dann werden Zusagedatum und Wiedervorlage gelöscht — sonst bliebe
 * der Kunde über die Tagesliste sichtbar, obwohl er nichts mehr schuldet. Der
 * Zähler `unreachable_count` und die Sperre bleiben unangetastet: Sie sind
 * Historie und keine Arbeitsliste.
 *
 * @param sql   Verbindung oder Transaktion (damit der Aufrufer die Klammer setzt)
 * @param ref   Antragsreferenz — die Person wird daraus ermittelt
 */
export async function personTierAktualisieren(
  sql: any,
  opts: { personId?: number | null; ref?: string | null },
): Promise<{ personId: number; tier: number; grund: string } | null> {
  let personId = opts.personId ?? null;
  if (!personId && opts.ref) {
    const [row] = await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${opts.ref}`;
    personId = row?.person_id ?? null;
  }
  if (!personId) return null;

  const [neu] = await sql.unsafe(
    `${personTierSql()} AND p.id = $1`,
    [personId],
  );
  if (!neu) return null;

  await sql`
    UPDATE fiaon_persons SET
      priority_tier = ${Number(neu.priority_tier)},
      tier_reason = ${String(neu.tier_reason)},
      updated_at = NOW()
    WHERE id = ${personId}
  `;
  // Zwei Schritte statt einer verschachtelten Bedingung: Das Löschen der
  // Arbeitsdaten ist eine eigene Entscheidung und soll auch so lesbar sein.
  if (Number(neu.priority_tier) <= 0) {
    await sql`
      UPDATE fiaon_persons SET promised_payment_date = NULL, follow_up_date = NULL, updated_at = NOW()
      WHERE id = ${personId}
    `;
  }

  // ── SOFORT ZUTEILEN ─────────────────────────────────────────────────────
  // Wer gerade auf Stufe A oder B gesprungen ist und niemanden hat, bekommt
  // JETZT jemanden — nicht morgen früh um sechs. Anas Barghouti klickte am
  // 08.08.2026 „ich habe bezahlt" und stand danach mit „kein Agent" da; die
  // einzige Zuteilung lief im Tageslauf und nur für Tier 1.
  //
  // Bewusst hier und nicht in den Aufrufern: Diese Funktion ist die eine
  // Stelle, an der sich eine Einstufung ändert. Wer sie umgeht, umgeht auch
  // die Zuteilung — und das fiele sofort auf.
  //
  // Der dynamische Import hält den Kreis auf: fiaon-zuteilung liest keine
  // Einstufung, aber tier.ts wird von halb Haus importiert.
  // Stufe 0 ist seit dem 30.08.2026 dabei: Wer ohne vorherige Stufe bezahlt
  // (Direktzahler), wurde vorher NIE zugeteilt und danach nie wieder — gemessen
  // 88 bezahlte Personen ohne Zuständigen. Die Entscheidung, wer davon eine
  // Zuteilung verdient, steht in `sofortZuteilen`; hier steht nur, wann gefragt
  // wird. Zwei Filter für dieselbe Frage wären zwei Wahrheiten.
  if ([0, 1, 2].includes(Number(neu.priority_tier))) {
    const { sofortZuteilen } = await import("./fiaon-zuteilung");
    await sofortZuteilen(personId, sql);
  }

  return { personId, tier: Number(neu.priority_tier), grund: String(neu.tier_reason) };
}

/**
 * Alle Personen auf den berechneten Stand bringen — das Sicherheitsnetz.
 *
 * Die Einzelaktualisierung oben deckt die Wege ab, die wir kennen. Dieser Lauf
 * fängt alles andere ein: eine Zahlung, die per Skript gebucht wurde, ein
 * Storno, eine abgelaufene Frist. Er läuft im Tageslauf mit und schreibt nur
 * tatsächlich abweichende Zeilen — dieselbe Abfrage wie scripts/tier-backfill.ts,
 * damit es keine zweite Wahrheit gibt.
 */
export async function alleTierAktualisieren(sql: any): Promise<{ geaendert: number }> {
  const erg = await sql.unsafe(`
    WITH t AS (${personTierSql()})
    UPDATE fiaon_persons p
    SET priority_tier = t.priority_tier,
        tier_reason   = t.tier_reason,
        updated_at    = NOW()
    FROM t
    WHERE t.person_id = p.id
      AND (p.priority_tier IS DISTINCT FROM t.priority_tier
        OR p.tier_reason   IS DISTINCT FROM t.tier_reason)`);
  const geaendert = Number((erg as any)?.count ?? 0);
  // Wer den Vertrieb verlassen hat, darf keine Arbeitsdaten mehr tragen.
  await sql`
    UPDATE fiaon_persons
    SET promised_payment_date = NULL, follow_up_date = NULL, updated_at = NOW()
    WHERE merged_into_person_id IS NULL AND priority_tier <= 0
      AND (promised_payment_date IS NOT NULL OR follow_up_date IS NOT NULL)
  `;
  if (geaendert > 0) console.log(`[FIAON-TIER] Tageslauf: ${geaendert} Person(en) neu eingestuft`);
  return { geaendert };
}

/**
 * Zuständigkeit einer Person nachziehen — DER BETREUER HAT VORRANG.
 *
 * ══ KORREKTUR NOCH AM SELBEN TAG (05.08.2026) ══════════════════════════════
 * Die erste Fassung hieß „Die Person folgt der Bestellung" und begründete das
 * damit, dass die Bestellung den Provisionsanspruch trägt. Das war falsch, und
 * der Fehler war teuer: Um 12:46 hat dieser Aufruf im Reparaturlauf Kunden von
 * ihren Betreuern weggezogen. Roberto De Luca wurde um 11:56 von Lucas betreut
 * und stand fünfzig Minuten später bei Florentine — weil die Bestellung
 * Florentine gehörte.
 *
 * Der Denkfehler: Den Anspruch trägt seit dem Stichtag NICHT die Zuweisung,
 * sondern der dokumentierte Kontakt (siehe `ermittleProvisionsAnspruch`). Wer
 * telefoniert hat, hat den Kunden — die Zuweisung ist nur die Ansicht darauf.
 *
 * DIE RANGFOLGE gilt jetzt in dieser Reihenfolge:
 *   0. Der EINGETRAGENE Betreuer, sobald er selbst im Verlauf steht. Seit dem
 *      03.09.2026 — eine Vertretung darf ihn nicht verdrängen (siehe unten).
 *   1. Der dokumentierte Betreuer (jüngstes Ergebnis im Verlauf), sofern er
 *      aus dem Vertrieb kommt. Er ist die geleistete Arbeit und der
 *      Provisionsanspruch in einer Person.
 *   2. Nur wenn NIEMAND dokumentiert hat: der Agent der jüngsten lebenden
 *      Bestellung. Dann ist die Zuweisung die einzige Spur, die existiert.
 *
 * Ohne all das wird NICHTS geändert: Eine bestehende Zuweisung darf nicht wegen
 * einer herrenlosen Bestellung verloren gehen.
 */
export async function personAgentSynchronisieren(
  sql: any,
  opts: { personId?: number | null; ref?: string | null },
): Promise<{ personId: number; agentId: number } | null> {
  let personId = opts.personId ?? null;
  if (!personId && opts.ref) {
    const [row] = await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${opts.ref}`;
    personId = row?.person_id ?? null;
  }
  if (!personId) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // EINE VERTRETUNG IST KEINE ÜBERNAHME (03.09.2026)
  //
  // Aus dem Gruppenchat vom 02.09., 17:24 Uhr:
  //   Hans-Jürgen: „Kunde hat für 18 Uhr gebucht, komme aber nicht in die
  //                 Akte bzw. steht Kunde nicht in deinem Bestand"
  //   Florentine:  „Der ist eigentlich bei mir. Wie kommt er zu dir?"
  //   Hans-Jürgen: „Keine Ahnung, vor 1 Stunde stand noch gar nichts."
  //   Hans-Jürgen: „Ich kann ihn anrufen, sag ich halt, ich rufe in Vertretung an."
  //
  // Genau dieser Vertretungsanruf hat den Kunden übernommen. Denn `betreuerVon`
  // liefert den JÜNGSTEN dokumentierten Kontakt, und die Zeile darunter schrieb
  // ihn über den bestehenden Betreuer. Wer zuletzt anruft, bekommt den Kunden —
  // auch, wenn er nur aushilft. Der Kunde Balde ist so binnen eines Tages von
  // Florentine über Hans-Jürgen bei Daniel gelandet, mit Mandat seit dem 20.07.
  //
  // GEMESSEN am 03.09.: 1.784 Personen haben dokumentierten Kontakt, bei 221
  // ist der erste ein anderer als der letzte — 97 davon mit Mandat. Da an der
  // Betreuung die Provision hängt, ist das nicht nur eine Anzeigefrage.
  //
  // ZWEI SCHUTZWÄNDE, beide nur hier:
  //   A) BESTANDSSCHUTZ — hat die Person bereits einen Betreuer, und hat DIESER
  //      selbst dokumentierten Kontakt, bleibt er. Ein späterer Anruf eines
  //      anderen ändert nichts mehr. Eine bewusste Übergabe läuft weiter über
  //      die Übergabe-Route im Team-Bereich, die `assigned_agent_id` direkt
  //      setzt — und der neue Betreuer hält sie beim ersten eigenen Kontakt.
  //   B) NUR VERTRIEB — das Forderungsmanagement (Hans-Jürgen, Diana) ruft
  //      offene Raten hinterher und steht dadurch im Verlauf. Betreuer wird es
  //      dadurch nicht. Dieselbe Rollen-Bedingung steht seit dem 30.08. in
  //      fiaon-zuteilung.ts; hier fehlte sie — das war die zweite Hälfte des
  //      Fehlers.
  // ═══════════════════════════════════════════════════════════════════════
  const betreuer = await betreuerVon(sql, personId);
  if (betreuer) {
    const [jetzt] = (await sql`
      SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${personId} LIMIT 1
    `) as any[];
    const bisher = Number(jetzt?.assigned_agent_id || 0);

    // A) Der eingetragene Betreuer hält, sobald er selbst im Verlauf steht.
    if (bisher && bisher !== betreuer.agentId) {
      const [eigener] = (await sql`
        SELECT 1 FROM fiaon_contact_log cl
        JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE a.person_id = ${personId} AND cl.type = 'result'
          AND cl.voided_at IS NULL AND cl.agent_id = ${bisher}
        LIMIT 1
      `) as any[];
      if (eigener) {
        console.log(`[FIAON-TIER] Person ${personId} bleibt bei Agent ${bisher} — Kontakt von Agent ${betreuer.agentId} war eine Vertretung.`);
        return { personId, agentId: bisher };
      }
    }

    // B) Wer eine Rate eintreibt, wird dadurch nicht Betreuer.
    const [rolleOk] = (await sql`
      SELECT 1 FROM fiaon_agents
      WHERE id = ${betreuer.agentId} AND active AND NOT is_test_account
        AND COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter')
      LIMIT 1
    `) as any[];
    if (!rolleOk) {
      if (bisher) return { personId, agentId: bisher };
    } else {
      const rows = await sql`
        UPDATE fiaon_persons
        SET assigned_agent_id = ${betreuer.agentId},
            betreuung_seit = COALESCE(betreuung_seit, ${betreuer.am}),
            updated_at = NOW()
        WHERE id = ${personId} AND COALESCE(assigned_agent_id, 0) <> ${betreuer.agentId}
        RETURNING id
      `;
      if (rows.length > 0) {
        console.log(`[FIAON-TIER] Person ${personId} bleibt bei ihrem Betreuer → Agent ${betreuer.agentId}`);
      }
      return { personId, agentId: betreuer.agentId };
    }
  }

  // 2. Niemand hat dokumentiert — dann entscheidet die Bestellung.
  const [ziel] = await sql`
    SELECT a.assigned_agent_id AS agent_id
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL
      AND a.assigned_agent_id IS NOT NULL
      AND a.payment_status <> 'superseded'
    ORDER BY
      CASE a.payment_status
        WHEN 'claimed_paid' THEN 0
        WHEN 'pending_payment' THEN 1
        WHEN 'expired' THEN 2
        WHEN 'paid' THEN 3
        ELSE 4
      END,
      a.created_at DESC
    LIMIT 1
  `;
  if (!ziel?.agent_id) return null;

  const rows = await sql`
    UPDATE fiaon_persons SET assigned_agent_id = ${ziel.agent_id}, updated_at = NOW()
    WHERE id = ${personId} AND COALESCE(assigned_agent_id, 0) <> ${ziel.agent_id}
    RETURNING id
  `;
  if (rows.length > 0) {
    console.log(`[FIAON-TIER] Person ${personId} folgt ihrer Bestellung → Agent ${ziel.agent_id}`);
  }
  return { personId, agentId: Number(ziel.agent_id) };
}

/** Dieselbe Abbildung in JavaScript, für Auswertungen außerhalb der Datenbank. */
export function tierAusRang(rang: number): { tier: number; grund: string } {
  switch (rang) {
    case 60: return { tier: 0, grund: "bezahlt" };
    case 50: return { tier: 1, grund: "zahlung_angekuendigt" };
    case 40: return { tier: 2, grund: "rechnung_offen" };
    case 35: return { tier: 2, grund: "zahlungsfrist_abgelaufen" };
    case 30: return { tier: 2, grund: "antrag_abgeschlossen" };
    case 20: return { tier: 3, grund: "antrag_abgebrochen" };
    case 10: return { tier: -1, grund: "ausgeschlossen" };
    default: return { tier: 3, grund: "nur_lead" };
  }
}
