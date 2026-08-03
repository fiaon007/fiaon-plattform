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
      AND ${a}.gdpr_deleted_at IS NULL`;
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
      SELECT DISTINCT ON (person_id) person_id, rang, status, ref
      FROM bewertet
      WHERE rang > 0
      ORDER BY person_id, rang DESC, ref
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
