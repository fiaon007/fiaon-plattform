// ═══════════════════════════════════════════════════════════════════════════
// TESTEINTRÄGE BEI KUNDEN — was wir selbst angelegt haben, ist kein Kunde
//
// DIE LAGE
// `fiaon_agents.is_test_account` gibt es seit langem. Für KUNDEN gab es nichts
// Vergleichbares: Zehn Zeilen „Justin Schwarzott" standen als echte Kunden in
// der Arbeitsliste, in der Verteilung, in der Dublettensuche und in jeder
// Kennzahl. Jemand hat sie beim Testen des Antragstrichters erzeugt.
//
// WARUM EINE PFLEGBARE LISTE UND KEINE FESTE
// Eine fest verdrahtete Liste veraltet — genau wie die „Make-Zweig fehlt"-
// Heuristik, die diesem Paket zugrunde liegt. Domains und Kennzeichen ändern
// sich, wenn ein neues Werkzeug dazukommt oder ein Mitarbeiter geht. Also
// stehen sie in den Einstellungen und sind vom Betreiber änderbar.
//
// DIE HARTE GRENZE
// Eine Bestellung, für die BEZAHLT wurde, macht die Person unantastbar. Ein
// Testeintrag mit echtem Geldeingang ist ein Widerspruch — entweder ist das
// Geld echt (dann ist es ein Kunde) oder die Buchung ist falsch (dann gehört
// sie korrigiert, nicht versteckt). Diese Regel steht im Code und ist nicht
// über die Einstellungen aushebelbar.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Vorbelegung. Änderbar in den Einstellungen unter `test_kennzeichen`. */
export const VORGABE_KENNZEICHEN = {
  /** Domains, die uns gehören. Eine Adresse dort ist nie ein Kundenkontakt. */
  domains: ["schwarzott-global.com", "aras-ai.com", "schwarzott.com", "fiaon.com"],
  /** Adress-Präfixe, die typischerweise für Proben stehen. */
  praefixe: ["demo@", "test@", "probe@", "beispiel@", "noreply@", "no-reply@"],
  /** Namen von Menschen im Haus. Wer so heißt, ist Kollege und nicht Kunde. */
  namen: ["justin schwarzott", "daniel stripling", "florentine lombardi", "lucas böhnert", "nikita boychenko"],
  /** Produktbezeichnungen, die es nur zum Ausprobieren gibt. */
  produkte: ["FIAON Test", "Testpaket", "Demo-Paket"],
};

export type Kennzeichen = typeof VORGABE_KENNZEICHEN;

export async function kennzeichenLaden(lauf: Lauf = sqlPool): Promise<Kennzeichen> {
  const [row] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'test_kennzeichen'`) as any[];
  if (!row?.value) return VORGABE_KENNZEICHEN;
  try {
    const g = JSON.parse(row.value);
    return {
      domains: Array.isArray(g.domains) ? g.domains : VORGABE_KENNZEICHEN.domains,
      praefixe: Array.isArray(g.praefixe) ? g.praefixe : VORGABE_KENNZEICHEN.praefixe,
      namen: Array.isArray(g.namen) ? g.namen : VORGABE_KENNZEICHEN.namen,
      produkte: Array.isArray(g.produkte) ? g.produkte : VORGABE_KENNZEICHEN.produkte,
    };
  } catch {
    // Kaputtes JSON ist kein Grund, die Erkennung abzuschalten.
    return VORGABE_KENNZEICHEN;
  }
}

export async function kennzeichenSpeichern(k: Kennzeichen, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at)
    VALUES ('test_kennzeichen', ${JSON.stringify(k)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export interface TestBefund {
  personId: number;
  name: string;
  email: string | null;
  telefon: string | null;
  /** Warum diese Person als Test gilt — im Klartext, für die Vorschau-CSV. */
  grund: string;
  bestellungen: number;
  bezahlt: number;
}

/**
 * Kandidaten für die Testmarkierung.
 *
 * „Sämtliche Kontaktdaten passen" heißt: JEDE hinterlegte Adresse trifft die
 * Liste. Eine Person mit einer internen und einer privaten Adresse ist
 * verdächtig, aber kein sicherer Fall — und im Zweifel ist ein übersehener
 * Testeintrag harmloser als ein versteckter Kunde.
 *
 * @param nurId Nur diese eine Person prüfen (für den Ereignisweg).
 */
export async function testKandidaten(
  lauf: Lauf = sqlPool, nurId: number | null = null,
): Promise<TestBefund[]> {
  const k = await kennzeichenLaden(lauf);
  const rows = (await lauf`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           LOWER(TRIM(COALESCE(p.first_name, ''))) AS vorname,
           LOWER(TRIM(COALESCE(p.last_name, ''))) AS nachname,
           p.primary_email, p.primary_phone, p.ist_test_am,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL) AS bestellungen,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlt,
           (SELECT ARRAY_AGG(DISTINCT LOWER(x)) FROM (
              SELECT UNNEST(ARRAY[a.email, a.contact_email, a.billing_email]) AS x
              FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
            ) q WHERE x IS NOT NULL AND TRIM(x) <> '') AS alle_mails,
           (SELECT ARRAY_AGG(DISTINCT a.pack_name) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.pack_name IS NOT NULL) AS pakete
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND (${nurId}::int IS NULL OR p.id = ${nurId}::int)
      AND p.ist_test_am IS NULL
  `) as any[];

  const befunde: TestBefund[] = [];
  for (const r of rows) {
    // ── DIE HARTE GRENZE ───────────────────────────────────────────────────
    // Bezahlt heißt echt. Punkt. Kein Kennzeichen der Welt überstimmt einen
    // Geldeingang.
    if (Number(r.bezahlt) > 0) continue;

    const mails: string[] = [
      ...(r.alle_mails || []),
      ...(r.primary_email ? [String(r.primary_email).toLowerCase()] : []),
    ].filter(Boolean);
    const gruende: string[] = [];

    // 1. Alle Adressen auf einer unserer Domains — oder Präfix einer Probe.
    if (mails.length > 0) {
      const alleIntern = mails.every((m) =>
        k.domains.some((d) => m.endsWith(`@${d.toLowerCase()}`))
        || k.praefixe.some((v) => m.startsWith(v.toLowerCase())));
      if (alleIntern) gruende.push(`alle Adressen intern (${mails.join(", ")})`);
    }

    // 2. Der Name eines Menschen aus dem Haus.
    const voll = `${r.vorname} ${r.nachname}`.trim();
    if (voll && k.namen.some((n) => n.toLowerCase() === voll)) {
      gruende.push(`Name eines Mitarbeiters (${voll})`);
    }

    // 3. Ein Produkt, das es nur zum Ausprobieren gibt.
    const pakete: string[] = (r.pakete || []).filter(Boolean);
    if (pakete.length > 0 && pakete.every((pk) =>
      k.produkte.some((tp) => String(pk).toLowerCase().includes(tp.toLowerCase())))) {
      gruende.push(`nur Testprodukte (${pakete.join(", ")})`);
    }

    if (gruende.length > 0) {
      befunde.push({
        personId: Number(r.id),
        name: String(r.name || `Person ${r.id}`),
        email: r.primary_email || mails[0] || null,
        telefon: r.primary_phone || null,
        grund: gruende.join(" · "),
        bestellungen: Number(r.bestellungen),
        bezahlt: Number(r.bezahlt),
      });
    }
  }
  return befunde;
}

/**
 * Markiert eine Person als Testeintrag. Kein Hard-Delete, kein Verstecken:
 * Die Zeile bleibt, sie fällt nur aus den Arbeitslisten.
 */
export async function alsTestMarkieren(
  personId: number, grund: string, von: string, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const [p] = (await lauf`
    SELECT (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = ${personId} AND a.payment_status = 'paid') AS bezahlt
    FROM fiaon_persons WHERE id = ${personId}
  `) as any[];
  if (!p) return false;
  // Die harte Grenze auch hier, nicht nur in der Kandidatensuche: Diese
  // Funktion ist über Routen erreichbar, und eine Regel, die nur im Vorschlag
  // steht, ist keine Regel.
  if (Number(p.bezahlt) > 0) return false;

  await lauf`
    UPDATE fiaon_persons
    SET ist_test_am = NOW(), ist_test_grund = ${grund}, ist_test_von = ${von},
        assigned_agent_id = NULL, updated_at = NOW()
    WHERE id = ${personId} AND ist_test_am IS NULL
  `;
  await lauf`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (NULL, 'kunde_als_test_markiert',
            ${JSON.stringify({ person_id: personId, grund })}, ${von}, ${grund})
  `.catch(() => {});
  return true;
}

/** Rücknahme — falls sich jemand geirrt hat. */
export async function testMarkierungAufheben(
  personId: number, von: string, lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    UPDATE fiaon_persons SET ist_test_am = NULL, ist_test_grund = NULL, ist_test_von = NULL, updated_at = NOW()
    WHERE id = ${personId}
  `;
  await lauf`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (NULL, 'kunde_test_aufgehoben', ${JSON.stringify({ person_id: personId })}, ${von},
            'Testmarkierung zurückgenommen')
  `.catch(() => {});
}

/**
 * SQL-Bedingung „ist kein Testeintrag".
 *
 * Gehört in jede Liste, jede Verteilung, jede Kennzahl und jede
 * Mail-Zielgruppe — nach demselben Muster wie `echtePersonSql`
 * (server/lib/fiaon-bestand-filter.ts).
 */
export function keinTestSql(p = "p"): string {
  return `${p}.ist_test_am IS NULL`;
}
