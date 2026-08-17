// ═══════════════════════════════════════════════════════════════════════════
// WEM GEHÖRT DIESE NUMMER? — die eine Zuordnung für Anrufe
//
// ── DER VORFALL ────────────────────────────────────────────────────────────
// Team, 16.08.2026: „Mehrfach steht ‚Diana — Mailbox gesprochen', aber die
// Aufnahme gehört zu einer komplett anderen Person."
//
// ── DIE URSACHE, GEMESSEN ──────────────────────────────────────────────────
// `POST /telefon/ausweis` nahm die `personId` aus dem REQUEST-BODY. Die
// Oberfläche schickt dort, was gerade als Kundenkarte offen ist:
//
//     body: JSON.stringify({ nummer, personId: kunde?.personId ?? null })
//
// Wer eine Karte offen hatte und dann eine ANDERE Nummer in die Wähltastatur
// tippte, bekam einen Anrufdatensatz an der offenen Karte — mit Aufnahme,
// Transkript und KI-Notiz eines fremden Menschen. Der Kartenkontext gewann
// über die tatsächlich gewählte Nummer.
//
// Im Bestand ist der Schaden klein (5 von 1.002 Anrufen, davon 1 mit
// Aufnahme). Der Weg dorthin stand aber jederzeit offen, und es geht um
// Gesprächsaufzeichnungen — da ist ein kleiner Bestand kein Argument.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Ein Anruf gehört zu der Person, deren NUMMER gewählt wurde. Punkt.
//   · Nummer gehört einer anderen Person → der Anruf hängt an DIESER Person.
//   · Nummer gehört niemandem            → der Anruf hängt an NIEMANDEM, und
//                                          im Ergebnis-Schritt ist die
//                                          Zuordnung Pflicht.
// Der Kartenkontext ist nur noch ein Hinweis, den der Server prüft und
// gegebenenfalls überstimmt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { nummerKern } from "./fiaon-anruf-eingehend";

type Lauf = typeof sqlPool;

export interface NummernPerson {
  personId: number;
  name: string;
  /** Die jüngste, nicht zusammengeführte Bestellung — für den Verlaufseintrag. */
  ref: string | null;
  /** Woran die Nummer erkannt wurde: Stammdaten, Alias, Bestellung oder Lead. */
  quelle: "person" | "alias" | "bestellung" | "lead";
}

export interface Zuordnung {
  /** Wem der Anruf gehört. Null heißt: unbekannte Nummer, kein Personenbezug. */
  person: NummernPerson | null;
  /** Mehrere Personen tragen dieselbe Nummer — fast immer eine Dublette. */
  mehrdeutig: boolean;
  /** Alle Treffer, wenn es mehr als einen gibt. */
  kandidaten: NummernPerson[];
  /** Klartext für das Panel: „Du rufst Peter Zußner an." */
  anzeige: string;
}

/**
 * Wem gehört diese Nummer?
 *
 * Sucht über vier Wege, in dieser Rangfolge:
 *   1. `fiaon_persons.phone_key9`  — die indexierte Hauptnummer
 *   2. `fiaon_person_aliases`      — früher benutzte Nummern
 *   3. `fiaon_applications`        — Nummer aus der Bestellung
 *   4. `fiaon_leads`               — Nummer aus dem Lead
 *
 * Die Rangfolge entscheidet NICHT über den Treffer, nur über die Benennung
 * der Quelle: Gefunden wird über alle vier gleichzeitig, damit ein Kunde, der
 * seine Nummer geändert hat, unter beiden Nummern erkannt wird.
 */
export async function personZurNummer(
  roh: string, lauf: Lauf = sqlPool,
): Promise<Zuordnung> {
  const leer: Zuordnung = {
    person: null, mehrdeutig: false, kandidaten: [],
    anzeige: "Unbekannte Nummer — der Anruf wird keiner Akte zugeordnet.",
  };
  const kern = nummerKern(roh);
  if (!kern) return leer;

  const treffer = (await lauf`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS name,
           p.updated_at,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref,
           CASE
             WHEN p.phone_key9 = ${kern} THEN 'person'
             WHEN EXISTS (SELECT 1 FROM fiaon_person_aliases al
                           WHERE al.person_id = p.id AND al.kind = 'phone'
                             AND RIGHT(REGEXP_REPLACE(al.value_norm, '[^0-9]', '', 'g'), 9) = ${kern})
               THEN 'alias'
             WHEN EXISTS (SELECT 1 FROM fiaon_applications a2
                           WHERE a2.person_id = p.id AND a2.merged_into IS NULL
                             AND a2.gdpr_deleted_at IS NULL
                             AND (RIGHT(REGEXP_REPLACE(COALESCE(a2.phone, ''), '[^0-9]', '', 'g'), 9) = ${kern}
                               OR RIGHT(REGEXP_REPLACE(COALESCE(a2.contact_phone, ''), '[^0-9]', '', 'g'), 9) = ${kern}))
               THEN 'bestellung'
             ELSE 'lead'
           END AS quelle
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND (
        p.phone_key9 = ${kern}
        OR EXISTS (SELECT 1 FROM fiaon_person_aliases al
                    WHERE al.person_id = p.id AND al.kind = 'phone'
                      AND RIGHT(REGEXP_REPLACE(al.value_norm, '[^0-9]', '', 'g'), 9) = ${kern})
        OR EXISTS (SELECT 1 FROM fiaon_applications a3
                    WHERE a3.person_id = p.id AND a3.merged_into IS NULL
                      AND a3.gdpr_deleted_at IS NULL
                      AND (RIGHT(REGEXP_REPLACE(COALESCE(a3.phone, ''), '[^0-9]', '', 'g'), 9) = ${kern}
                        OR RIGHT(REGEXP_REPLACE(COALESCE(a3.contact_phone, ''), '[^0-9]', '', 'g'), 9) = ${kern}))
        OR EXISTS (SELECT 1 FROM fiaon_leads l
                    WHERE l.person_id = p.id
                      AND RIGHT(REGEXP_REPLACE(COALESCE(l.telefon, ''), '[^0-9]', '', 'g'), 9) = ${kern})
      )
    ORDER BY p.updated_at DESC NULLS LAST, p.id ASC
    LIMIT 5
  `) as any[];

  if (treffer.length === 0) return leer;

  const kandidaten: NummernPerson[] = treffer.map((t) => ({
    personId: Number(t.id),
    name: String(t.name),
    ref: t.ref ?? null,
    quelle: String(t.quelle) as NummernPerson["quelle"],
  }));
  const person = kandidaten[0];
  const mehrdeutig = kandidaten.length > 1;
  return {
    person,
    mehrdeutig,
    kandidaten,
    anzeige: mehrdeutig
      ? `Du rufst ${person.name} an — Achtung: ${kandidaten.length} Personen tragen diese Nummer.`
      : `Du rufst ${person.name} an.`,
  };
}

/**
 * Die Zuordnung für einen ausgehenden Anruf — inklusive Widerspruch.
 *
 * `gemeint` ist das, was die Oberfläche für richtig hält (die offene Karte).
 * Diese Funktion sagt, was WIRKLICH gilt, und ob beides auseinandergeht.
 * Der Widerspruch wird protokolliert: Er ist kein Fehler des Menschen,
 * sondern eine Auskunft darüber, wie oft nebenher gewählt wird.
 */
export async function anrufZuordnen(
  nummer: string, gemeint: number | null, lauf: Lauf = sqlPool,
): Promise<Zuordnung & { widerspruch: boolean; gemeint: number | null }> {
  const z = await personZurNummer(nummer, lauf);
  const widerspruch = gemeint != null && z.person != null && z.person.personId !== gemeint;
  return { ...z, widerspruch, gemeint };
}
