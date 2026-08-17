// ═══════════════════════════════════════════════════════════════════════════
// WOHIN GEHT DIE MAIL? — EINE Auflösung für jeden Sendeweg
//
// ── DER GEMELDETE FALL ─────────────────────────────────────────────────────
// Betreiber: „Make-Routen gehen bei Tests alle durch — aber viele bekommen
// dann keine E-Mail." Ein Kunde hatte am zweiten Lead eine E-Mail-Adresse, am
// Antrag stand das Feld leer. Der Versand las die ANTRAGSZEILE, fand nichts
// und schickte `email: ""` an Make. Make antwortete brav mit 200, Brevo bekam
// eine leere Adresse, und nichts kam an. Nirgends stand ein Fehler.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Die Adresse gehört zum MENSCHEN, nicht zur Bestellzeile. Ein Mensch hat
// vier Bestellungen, drei davon Entwürfe ohne Adresse — welche davon „die"
// E-Mail ist, kann keine Bestellzeile beantworten.
//
// Rangfolge:
//   1. `fiaon_persons.primary_email`   — was der Mensch heute benutzt
//   2. der jüngste E-Mail-Alias        — was er früher benutzt hat
//   3. die Bestellzeile                — letzter Halt, wenn es keine Person
//                                        gibt (Entwürfe ohne person_id)
//
// ── UND WENN NICHTS DA IST? ────────────────────────────────────────────────
// Dann wird NICHT gesendet und es steht mit Grund im Protokoll. Eine Mail,
// die lautlos verschwindet, ist schlimmer als eine, die sichtbar scheitert:
// Bei der zweiten weiß jemand, dass er anrufen muss.
//
// Gemessen am 16.08.2026: 3 Bestellungen mit offener Rate hatten keine
// Adresse an der Bestellzeile — alle drei über die Person auflösbar. Und bei
// 99 Bestellzeilen weicht die Adresse von der der Person ab; dort entscheidet
// allein die Quelle darüber, wer die Mail bekommt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Woher die Adresse stammt — steht so im Protokoll und in der Akte. */
export type EmpfaengerQuelle = "person" | "alias" | "bestellung";

export interface Empfaenger {
  email: string;
  quelle: EmpfaengerQuelle;
  personId: number | null;
  /** Klartext für Protokoll und Oberfläche. */
  herkunft: string;
}

/** Normalisiert wie `normEmail` im Personenmodell — klein, getrimmt, plausibel. */
export function mailNormal(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || !s.includes("@") || !s.includes(".")) return null;
  // Ein Leerzeichen mitten in der Adresse ist keine Adresse, sondern ein
  // Tippfehler, der bei Brevo als „hard bounce" zurückkommt.
  if (/\s/.test(s)) return null;
  return s;
}

/**
 * Die Adresse eines Menschen.
 *
 * Eine zusammengeführte Person antwortet nicht selbst: `merged_into_person_id`
 * zeigt auf die Person, die es wirklich gibt. Wer das nicht folgt, schickt an
 * eine Karteileiche.
 */
export async function empfaengerFuerPerson(
  personId: number, lauf: Lauf = sqlPool,
): Promise<Empfaenger | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null;

  const [p] = (await lauf`
    WITH RECURSIVE ziel AS (
      SELECT id, merged_into_person_id, primary_email, 0 AS tiefe
      FROM fiaon_persons WHERE id = ${personId}
      UNION ALL
      SELECT n.id, n.merged_into_person_id, n.primary_email, z.tiefe + 1
      FROM fiaon_persons n JOIN ziel z ON n.id = z.merged_into_person_id
      -- Eine Kette, die sich im Kreis dreht, würde die Abfrage sonst nie
      -- beenden. Zehn Schritte sind mehr, als je gemergt wurde.
      WHERE z.tiefe < 10
    )
    SELECT id, primary_email FROM ziel
    WHERE merged_into_person_id IS NULL
    ORDER BY tiefe DESC LIMIT 1
  `) as any[];
  if (!p) return null;
  const echteId = Number(p.id);

  const direkt = mailNormal(p.primary_email);
  if (direkt) {
    return { email: direkt, quelle: "person", personId: echteId, herkunft: "Stammdaten der Person" };
  }

  // Der jüngste Alias. Ältere Adressen sind nicht falsch, nur unwahrscheinlicher.
  const [al] = (await lauf`
    SELECT value_norm FROM fiaon_person_aliases
    WHERE person_id = ${echteId} AND kind = 'email'
    ORDER BY created_at DESC, id DESC LIMIT 1
  `) as any[];
  const alias = mailNormal(al?.value_norm);
  if (alias) {
    return { email: alias, quelle: "alias", personId: echteId, herkunft: "früher benutzte Adresse (Alias)" };
  }

  // Letzter Halt: irgendeine Bestellung dieses Menschen.
  const [b] = (await lauf`
    SELECT COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                    NULLIF(TRIM(a.billing_email),'')) AS mail
    FROM fiaon_applications a
    WHERE a.person_id = ${echteId} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                   NULLIF(TRIM(a.billing_email),'')) IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  const bestell = mailNormal(b?.mail);
  if (bestell) {
    return { email: bestell, quelle: "bestellung", personId: echteId, herkunft: "Bestellzeile" };
  }
  return null;
}

/**
 * Die Adresse zu einer Bestellung — über die Person, wenn es eine gibt.
 *
 * Entwürfe ohne `person_id` gibt es zu Tausenden (der Trichter). Für sie ist
 * die Bestellzeile die einzige Auskunft, und das ist in Ordnung: Ein Entwurf
 * IST nur seine Zeile.
 */
export async function empfaengerFuerBestellung(
  ref: string, lauf: Lauf = sqlPool,
): Promise<Empfaenger | null> {
  const [a] = (await lauf`
    SELECT person_id,
           COALESCE(NULLIF(TRIM(email),''), NULLIF(TRIM(contact_email),''),
                    NULLIF(TRIM(billing_email),'')) AS mail
    FROM fiaon_applications WHERE ref = ${ref}
  `) as any[];
  if (!a) return null;
  if (a.person_id != null) {
    const ueberPerson = await empfaengerFuerPerson(Number(a.person_id), lauf);
    if (ueberPerson) return ueberPerson;
  }
  const direkt = mailNormal(a.mail);
  return direkt
    ? { email: direkt, quelle: "bestellung", personId: a.person_id != null ? Number(a.person_id) : null,
        herkunft: "Bestellzeile (kein Personensatz)" }
    : null;
}

/**
 * Die Auflösung, die jeder Sendeweg benutzt.
 *
 * Nimmt, was der Aufrufer weiß — Person, Bestellung, oder eine Adresse, die
 * schon in der Nutzlast stand — und liefert genau eine Antwort.
 *
 * WICHTIG: Eine bereits in der Nutzlast stehende Adresse gewinnt NICHT
 * automatisch. Genau das war der Fehler: Die Bestellzeile stand in der
 * Nutzlast, die Person wusste es besser, und niemand fragte sie.
 * Sie gilt nur, wenn weder Person noch Bestellung etwas hergeben.
 */
export async function empfaengerAufloesen(
  ein: { personId?: number | null; ref?: string | null; ausNutzlast?: unknown },
  lauf: Lauf = sqlPool,
): Promise<Empfaenger | null> {
  if (ein.personId != null) {
    const p = await empfaengerFuerPerson(Number(ein.personId), lauf);
    if (p) return p;
  }
  if (ein.ref) {
    const b = await empfaengerFuerBestellung(String(ein.ref), lauf);
    if (b) return b;
  }
  const roh = mailNormal(ein.ausNutzlast);
  return roh
    ? { email: roh, quelle: "bestellung", personId: ein.personId != null ? Number(ein.personId) : null,
        herkunft: "Adresse aus dem Aufruf" }
    : null;
}

/**
 * Hat dieser Mensch überhaupt eine zustellbare Adresse?
 *
 * Für die Warnmarke „Keine zustellbare E-Mail" auf Karte und Akte. Bewusst
 * dieselbe Rangfolge wie der Versand — eine Marke, die nach anderen Regeln
 * urteilt als der Versand, ist eine Lüge mit Rahmen.
 */
export async function hatZustellbareMail(
  personId: number, lauf: Lauf = sqlPool,
): Promise<boolean> {
  return (await empfaengerFuerPerson(personId, lauf)) !== null;
}

/**
 * Als SQL-Ausdruck, für Listen: Steht hier eine zustellbare Adresse?
 *
 * Muss dieselbe Rangfolge treffen wie `empfaengerFuerPerson`. Zwei Fassungen
 * derselben Frage sind zwei Gelegenheiten, verschieden zu antworten — deshalb
 * steht der Ausdruck hier neben der Funktion und nicht in vier Abfragen.
 *
 * `p` ist der Tabellen-Alias von `fiaon_persons`.
 */
export function zustellbarSql(p = "p"): string {
  return `(
    NULLIF(TRIM(${p}.primary_email), '') IS NOT NULL
    OR EXISTS (SELECT 1 FROM fiaon_person_aliases al
                WHERE al.person_id = ${p}.id AND al.kind = 'email'
                  AND NULLIF(TRIM(al.value_norm), '') IS NOT NULL)
    OR EXISTS (SELECT 1 FROM fiaon_applications ax
                WHERE ax.person_id = ${p}.id AND ax.merged_into IS NULL
                  AND ax.gdpr_deleted_at IS NULL
                  AND COALESCE(NULLIF(TRIM(ax.email),''), NULLIF(TRIM(ax.contact_email),''),
                               NULLIF(TRIM(ax.billing_email),'')) IS NOT NULL)
  )`;
}
