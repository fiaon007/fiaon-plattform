// ═══════════════════════════════════════════════════════════════════════════
// ANRUFVERSUCHE JE MENSCH — eine Zählung für Reihung und Karte (29.09.2026, E-259)
//
// Justin zur Telefonkartei: „Ich brauche ganz oben immer den frischesten
// Kunden, einen Kunden, der nicht schon 10× angerufen wurde — also gib mir ganz
// oben A, dann B und dann C Kunden, die keine oder am wenigsten Anrufe bekommen
// haben — ich rufe oft 30 Kunden an, ohne dass jemand erreichbar ist."
//
// ── WAS EIN VERSUCH IST ─────────────────────────────────────────────────────
// Drei Quellen, entdoppelt:
//   · fiaon_calls, richtung = 'raus' — jeder Wählvorgang übers Softphone, auch
//     „niemand erreicht", „besetzt", „abgelehnt".
//   · fiaon_contact_log, type = 'result' — Ergebnisse aus Akte, Liste,
//     Privathandy (E-216) und Kartei; über ref → Bestellung → Person UND über
//     person_id direkt (UNION: dieselbe Zeile zählt einmal). OHNE Filter auf
//     merged_into beim Zuordnen: sonst fielen Ergebnisse an zusammengeführten
//     Bestellungen weg.
//   · fiaon_lead_log, type = 'result' — Lead-Ergebnisse (Kartei für Leads).
// Ein Softphone-Anruf mit Ergebnis steht in zwei Tabellen. Das Ergebnis zählt
// deshalb nur ZUSÄTZLICH, wenn es für denselben Menschen keinen Softphone-Anruf
// zwischen 45 Minuten davor und 5 Minuten danach gibt (gemessen im September:
// 1.414 von 2.763 Ergebnissen hingen an einem Softphone-Anruf).
//
// ── GEMESSEN (Produktion, nur lesend, 29.09.2026) ──────────────────────────
// Wer noch nie erreicht wurde, geht beim ersten Anruf zu 24,6 % ran; nach
// 1–2 Fehlversuchen in Folge zu ~15 %, nach 5 und mehr zu ~12 %. Wer beim
// letzten Mal erreicht wurde, geht zu 56 % ran. Deshalb liefert die Zählung
// beides: `versuche` (gesamt — „nicht schon 10× angerufen") und `fehl_folge`
// (Fehlversuche seit dem letzten Erreichen — die Serie ohne Erreichen).
//
// ── WAS NICHT ZÄHLT ─────────────────────────────────────────────────────────
// Justins Anrufe über `tel:` am iPhone stehen in keiner Tabelle. Sie zählen
// nur, wenn er danach einen Knopf der Kartei drückt (Ergebnis). Das Tippen auf
// „Anrufen" mitzuschreiben ist eine offene Entscheidung (E-259, Abschnitt 5.5).
// E-259 (Nachbesserung 29.09.2026) — ebenfalls nicht:
//   · Wählzeilen, die nie rausgingen (status 'gewaehlt' ohne Twilio-SID, älter
//     als 10 Minuten) — sie schoben Menschen fälschlich hinter die 10er-Grenze.
//   · ein zweiter und dritter Wählvorgang binnen 5 Minuten — das ist EIN Versuch
//     (Hausregel fiaon-telefonie.ts).
//   · Ergebnisse ohne `outcome` (Startgespräch geführt/verpasst, Onboarding
//     nachdokumentiert) — ein geführtes Startgespräch beendet aber die Serie.
// Ein Ergebnis, das an einem Softphone-Anruf hängt, zählt nicht doppelt, behält
// aber sein „erreicht" (vorher ging es mit dem Ergebnis verloren).
//
// Hier steht nur SQL-Text — die Arbeitsliste kann dieselbe Zählung übernehmen.
// Keine neue Spalte an fiaon_persons (Sperre der meistgelesenen Tabelle, tier.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** Ab so vielen Versuchen (gesamt) rutscht ein Mensch ans Ende — „nicht schon 10× angerufen". */
export const ANRUFE_ENDE = 10;
/** So alt darf das jüngste Ereignis sein, damit ein Mensch als frisch gilt (E-251: gezahlt wird binnen 3 Tagen). */
export const FRISCH_TAGE = 3;
/** Wer in diesen Stunden versucht wurde, pausiert — er steht nicht gleich wieder oben. */
export const PAUSE_STUNDEN = 20;

/**
 * Ein Versuch gilt als erreicht, wenn das Ergebnis „erreicht_…", ein vereinbarter
 * Rückruf oder ein erreichtes Ratenergebnis ist. E-259 (Nachbesserung 29.09.2026):
 * Vorher kannte die Regel die Ratenergebnisse nicht — „zahlt am" (rate_zahlt_am,
 * 124 Zeilen), Ratenpause, Beleg und Eskalation zählten als Fehlversuch, und die
 * Serie „N× in Folge nicht erreicht" lief nach echten Gesprächen weiter.
 */
const ERREICHT = (spalte: string) => `CASE WHEN ${spalte} LIKE 'erreicht%' OR ${spalte} = 'rueckruf_termin'
      OR (LEFT(${spalte}, 5) = 'rate_' AND ${spalte} NOT IN ('rate_nicht_erreicht', 'rate_nummer_blockiert')) THEN 1 ELSE 0 END`;

/**
 * Ergebnisse ohne `outcome` schreibt nur der Onboarding-Bereich
 * (fiaon-onboarding-bereich.ts): „Startgespräch geführt (…)", „Onboarding
 * nachdokumentiert (…)" — ein geführtes Gespräch — und „Startgespräch verpasst".
 * Keines davon ist ein Anrufversuch der Liste (gemessen: 194 Zeilen, 89 davon bei
 * 65 Menschen im Reiter Rate, alle als Fehlversuch gezählt). Die ersten zwei
 * beenden aber die Serie ohne Erreichen.
 */
const ERREICHT_ERGEBNIS = (outcome: string, notiz: string) => `CASE WHEN ${outcome} IS NULL
      THEN CASE WHEN ${notiz} LIKE 'Startgespräch geführt%' OR ${notiz} LIKE 'Onboarding nachdokumentiert%' THEN 1 ELSE 0 END
      ELSE ${ERREICHT(outcome)} END`;

/**
 * Eine Wählzeile, die nie rausging: POST /telefon legt sie beim Druck auf den
 * Wählknopf an (status 'gewaehlt', fiaon-telefonie.ts), Twilio hat sich nie
 * gemeldet (keine SID). Gemessen 29.09.: 159 solche Zeilen, 98 davon binnen
 * ±90 s neben einer anderen Zeile an denselben Menschen — Person 13324 hatte 14
 * in 48 Sekunden und stand mit „16 Versuche" am Ende der Liste. Die ersten zehn
 * Minuten zählt sie mit (der Anruf kann gerade laufen).
 */
const HAENGT = (c: string) => `(${c}.status = 'gewaehlt' AND ${c}.twilio_sid IS NULL AND ${c}.beginn < NOW() - INTERVAL '10 minutes')`;

/**
 * Wählvorgänge an denselben Menschen, die weniger als so viele Minuten auf den
 * vorigen folgen, sind EIN Versuch — die Hausregel aus fiaon-telefonie.ts: „Wer
 * es dreimal in fünf Minuten versucht, hat EIN Gespräch."
 */
export const WAHL_BUENDEL_MINUTEN = 5;

/**
 * Die CTE-Bausteine `anruf_roh`, `anruf`, `versuch` und `vz(person_id, versuche,
 * fehl_folge, letzter, erreicht_am)` — ohne führendes WITH, mit Komma
 * dazwischen, zum Einsetzen vor weiteren CTEs. Mit `personId` nur für diesen
 * einen Menschen (eine Karte), sonst für alle (eine Sammelabfrage, Hash-Join auf
 * die Liste).
 *
 * E-259 (Nachbesserung 29.09.2026) — `versuch` trägt zwei Merkmale:
 *   · zaehlt   1 = ein Anrufversuch. Ein Ergebnis, das an einem Softphone-Anruf
 *              hängt (−45 bis +5 Minuten), zählt 0 — der Anruf zählt schon.
 *   · erreicht 1 = der Mensch war dran. Bleibt auch an einem Ergebnis mit
 *              zaehlt 0 stehen: Vorher fiel das ganze Ergebnis weg, und ein
 *              Gespräch, das nur in der Akte stand (Softphone-Ergebnis leer),
 *              ging verloren — gemessen 74 von 896 Erreicht-Ergebnissen in 30
 *              Tagen, darunter Gespräche von 241, 694 und 1.153 Sekunden.
 */
export function anrufversucheCte(opts: { personId?: number | null } = {}): string {
  const roh = Number(opts.personId);
  const id = Number.isInteger(roh) && roh > 0 ? roh : null;
  const nur = (spalte: string) => (id ? `AND ${spalte} = ${id}` : "");
  return `anruf_roh AS (
      SELECT c.person_id, c.beginn AS am, ${ERREICHT("c.ergebnis")} AS erreicht,
             CASE WHEN LAG(c.beginn) OVER (PARTITION BY c.person_id ORDER BY c.beginn, c.id)
                       > c.beginn - INTERVAL '${WAHL_BUENDEL_MINUTEN} minutes' THEN 0 ELSE 1 END AS neu
        FROM fiaon_calls c
       WHERE c.richtung = 'raus' AND c.person_id IS NOT NULL AND NOT ${HAENGT("c")} ${nur("c.person_id")}
    ),
    anruf AS (
      SELECT person_id, MAX(am) AS am, MAX(erreicht) AS erreicht
        FROM (SELECT r.*, SUM(r.neu) OVER (PARTITION BY r.person_id ORDER BY r.am ROWS UNBOUNDED PRECEDING) AS buendel
                FROM anruf_roh r) g
       GROUP BY person_id, buendel
    ),
    versuch AS (
      SELECT person_id, am, erreicht, 1 AS zaehlt FROM anruf
      UNION ALL
      SELECT e.person_id, e.am, e.erreicht,
             CASE WHEN e.ohne_ergebnis THEN 0
                  WHEN EXISTS (
                    SELECT 1 FROM fiaon_calls c2
                     WHERE c2.person_id = e.person_id AND c2.richtung = 'raus' AND NOT ${HAENGT("c2")}
                       AND c2.beginn BETWEEN e.am - INTERVAL '45 minutes' AND e.am + INTERVAL '5 minutes') THEN 0
                  ELSE 1 END AS zaehlt
        FROM (
          SELECT cl.id, a.person_id, cl.created_at AS am, ${ERREICHT_ERGEBNIS("cl.outcome", "cl.note")} AS erreicht, (cl.outcome IS NULL) AS ohne_ergebnis
            FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
           WHERE cl.type = 'result' AND cl.voided_at IS NULL AND a.person_id IS NOT NULL ${nur("a.person_id")}
          UNION
          SELECT cl.id, cl.person_id, cl.created_at, ${ERREICHT_ERGEBNIS("cl.outcome", "cl.note")}, (cl.outcome IS NULL)
            FROM fiaon_contact_log cl
           WHERE cl.type = 'result' AND cl.voided_at IS NULL AND cl.person_id IS NOT NULL ${nur("cl.person_id")}
          UNION ALL
          SELECT -ll.id, l.person_id, ll.created_at, ${ERREICHT("ll.outcome")}, (ll.outcome IS NULL)
            FROM fiaon_lead_log ll JOIN fiaon_leads l ON l.id = ll.lead_id
           WHERE ll.type = 'result' AND l.person_id IS NOT NULL ${nur("l.person_id")}
        ) e
    ),
    vz AS (
      SELECT person_id, SUM(zaehlt)::int AS versuche,
             MAX(am) FILTER (WHERE zaehlt = 1 OR erreicht = 1) AS letzter, MAX(erreicht_am) AS erreicht_am,
             COUNT(*) FILTER (WHERE zaehlt = 1 AND (erreicht_am IS NULL OR am > erreicht_am))::int AS fehl_folge
        FROM (SELECT v.*, MAX(v.am) FILTER (WHERE v.erreicht = 1) OVER (PARTITION BY v.person_id) AS erreicht_am
                FROM versuch v) x
       GROUP BY person_id
    )`;
}
