// ═══════════════════════════════════════════════════════════════════════════
// GEHÖRT DIE GEWÄHLTE NUMMER ZUR VERKNÜPFTEN PERSON?
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// „Der Kundenname links passt oft nicht zum Gesprächsinhalt." Man hört eine
// Aufnahme und liest einen fremden Namen daneben.
//
// ── DIE URSACHE, UND WARUM SIE BEHOBEN UND TROTZDEM DA IST ────────────────
// Bis zum 17.08.2026 (Commit 7a91c8c) speicherte die Wähl-Route
// `req.body.personId` — also die Karte, die in der Oberfläche gerade OFFEN war.
// Wer eine Karte offen hatte und eine andere Nummer eintippte, hängte Aufnahme,
// Transkript, KI-Zusammenfassung und Verlaufseintrag an die falsche Akte.
//
// Die Route folgt seitdem der NUMMER (`anrufZuordnen`). Die alten Zeilen tragen
// aber weiter die falsche Person — ein behobener Schreibfehler räumt den Bestand
// nicht auf.
//
// ── WARUM DIE REGEL HIER STEHT UND NICHT IN DREI ABFRAGEN ─────────────────
// Sie wird an vier Stellen gebraucht: Messung, Bereinigungslauf, Prüfstand-Wand
// und die Anzeige („Zuordnung unklar"). Vier Fassungen von „passt die Nummer"
// gehen auseinander, und dann bereinigt der Lauf nach einer anderen Regel als
// die Wand prüft.
//
// ── WIE VERGLICHEN WIRD: DIE LETZTEN NEUN ZIFFERN ─────────────────────────
// Dieselbe Normalform, die `fiaon_persons.phone_key9` benutzt. Sie ist bewusst
// grob: „+49 151 23456789", „0151 23456789" und „151 23456789" sind derselbe
// Mensch, und eine Prüfung, die daran scheitert, erzeugt Fehlalarme statt Funde.
//
// Neun Ziffern sind auch die Grenze der Vorsicht: Bei weniger (Kurznummern,
// unvollständige Eingaben) wird NICHT verglichen, sondern als „nicht prüfbar"
// behandelt. Ein Vergleich über fünf Ziffern trifft zufällig zu.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Zeitpunkt, ab dem die Wähl-Route der Nummer folgt statt der offenen Karte.
 *
 * Das ist der COMMIT-Zeitpunkt (7a91c8c). Wann er in Produktion wirkte, sagt er
 * nicht — zwischen Commit und Deploy schreibt die alte Fassung weiter
 * (AGENTS.md). Der Bereinigungslauf verlässt sich deshalb NICHT auf dieses
 * Datum, sondern prüft jede Zeile einzeln. Die Angabe dient dem Bericht.
 */
export const FIX_ZEITPUNKT = "2026-08-17 09:31:13+02";

/** Die letzten neun Ziffern eines Nummern-Felds, als SQL-Ausdruck. */
export function key9Sql(ausdruck: string): string {
  return `RIGHT(REGEXP_REPLACE(COALESCE(${ausdruck}, ''), '[^0-9]', '', 'g'), 9)`;
}

/**
 * Passt die gewählte Nummer des Anrufs zur verknüpften Person?
 *
 * Geprüft wird gegen die Hauptnummer der Person UND gegen ihre Nummern-Aliase
 * (`fiaon_person_aliases`, `kind = 'phone'`) — nach einer Zusammenführung steht
 * die alte Nummer dort, und ein Anruf auf die alte Nummer ist richtig zugeordnet.
 *
 * Gibt `NULL` zurück, wenn nicht prüfbar (keine Person, keine brauchbare
 * Nummer). `NULL` ist ausdrücklich KEIN Fehler: Eine unbekannte Nummer ohne
 * Person ist der normale Fall bei einem Rückruf von außen.
 *
 * @param k Alias von `fiaon_calls`
 * @param p Alias von `fiaon_persons` (auf `k.person_id` verbunden)
 */
export function NUMMER_PASST_SQL(k = "k", p = "p"): string {
  const key = key9Sql(`${k}.nummer`);
  return `CASE
    WHEN ${k}.person_id IS NULL THEN NULL
    WHEN LENGTH(${key}) < 9 THEN NULL
    ELSE (
      ${p}.phone_key9 = ${key}
      OR ${key9Sql(`${p}.primary_phone`)} = ${key}
      OR EXISTS (
        SELECT 1 FROM fiaon_person_aliases al
         WHERE al.person_id = ${p}.id AND al.kind = 'phone'
           AND ${key9Sql("al.value_norm")} = ${key}
      )
      OR EXISTS (
        SELECT 1 FROM fiaon_applications ap
         WHERE ap.person_id = ${p}.id AND ap.merged_into IS NULL
           AND ${key9Sql("CONCAT(ap.phone_country_code, ap.phone)")} = ${key}
      )
    )
  END`;
}

/**
 * Die Bedingung „diese Zeile ist nachweislich falsch verknüpft".
 *
 * Ausdrücklich ohne die `NULL`-Fälle: Nur wo eine Person hängt UND die Nummer
 * prüfbar ist UND sie nicht passt, ist es ein Befund. Alles andere ist eine
 * Lücke, und eine Lücke wird angezeigt, nicht behauptet.
 */
export function FALSCH_VERKNUEPFT_SQL(k = "k", p = "p"): string {
  return `(${k}.person_id IS NOT NULL AND (${NUMMER_PASST_SQL(k, p)}) IS FALSE)`;
}

/**
 * Herkunftswerte der Zuordnung (Migration 066).
 *
 * `gewaehlt` und `ergebnis` sind BELEGT — die Sitzung hat gewählt bzw. das
 * Ergebnis erfasst. `zustaendigkeit` ist GERATEN: aus Inkasso-Zuständigkeit,
 * Termin, Betreuer oder „wer zuletzt sprach" abgeleitet. Das beantwortet „wer
 * sollte rangehen", nicht „wer hat gesprochen".
 */
export const HERKUNFT_BELEGT = ["gewaehlt", "ergebnis"] as const;

/**
 * Die Bedingung „dieser Anruf gehört BELEGT diesem Mitarbeiter".
 *
 * Genau das darf ein Profil-Tab zeigen. Der COALESCE leitet die Herkunft auch
 * für Altzeilen ohne die Spalte ab, damit die Ansicht nicht auf einen
 * Bestandslauf warten muss:
 *
 *   · ausgehend            → `gewaehlt` (die Sitzung hat gewählt)
 *   · eingehend mit Ergebnis → `ergebnis` (die Route lehnt fremde Anrufe ab)
 *   · eingehend ohne Ergebnis → `zustaendigkeit` (geraten, gehört in kein Profil)
 */
export function BELEGT_GEFUEHRT_SQL(k = "k"): string {
  return `(COALESCE(${k}.zuordnung_herkunft,
      CASE WHEN COALESCE(${k}.richtung, 'raus') <> 'eingehend' THEN 'gewaehlt'
           WHEN ${k}.ergebnis IS NOT NULL THEN 'ergebnis'
           ELSE 'zustaendigkeit' END) IN ('gewaehlt', 'ergebnis'))`;
}
