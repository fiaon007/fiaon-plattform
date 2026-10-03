// ═══════════════════════════════════════════════════════════════════════════
// HAT ER SCHON GEZAHLT? — DER UNSCHARFE ABGLEICH MIT UNGEBUCHTEN EINGÄNGEN (E-276, 02.10.2026)
//
// Justin: „ALLE Mails dafür müssen noch heute raus gehen, wirklich alle die eine Zahlung
// offen haben (nicht die gesperrten) ohne Ausnahme!“ — und keiner davon, der schon
// bezahlt hat. Gemessen (Produktion, nur lesend, 02.10.2026): 37 eingegangene Zahlungen
// (2.328 €, 30 Tage) liegen NICHT gebucht in fiaon_bank_txns, die meisten, weil der
// Verwendungszweck verkürzt oder ohne Bindestrich kam: „/ROC/…//FIAONMUAYRM“ gehört zu
// FIAON-MUAYRML6-Z3BT, „FIAONMTSPAA“ zu FIAON-MTSPAART-13P2, „Fisimatenten-MADJ3S“ und
// „MADJ3S“ zu FIAON-MADJ3S (Frau H. bekam am 01.10. die Aktionsmail und zahlte am 02.10.).
// Der genaue Vergleich (matched_ref/extracted_ref) sah die meisten davon nicht.
//
// ── DIE REGEL (lieber einer zu viel ausgelassen als einem Zahler „Zahlen Sie jetzt …“) ──
// Ein Eingang zählt als „hat gezahlt“, wenn er
//   · ungebucht ist (applied = FALSE), Geld bringt (amount_cents > 0), höchstens 30 Tage
//     alt ist und nicht ausdrücklich verworfen (match_status „ignored“) — „zur Freischaltung
//     vorgemerkt“ (SETTLED) wie „UNTERWEGS“ (PENDING) gleichermaßen, und
//   · zu EINER offenen Bestellung des Menschen passt (A „claimed_paid“ oder B
//     „pending_payment“, jede Art):
//       (1) matched_ref = Bestellnummer, oder
//       (2) Zahlungsreferenz (FIAON-XXXXXX) — normalisiert: groß, nur A–Z/0–9 — gleich dem
//           erkannten Zweck (extracted_ref) oder dessen Anfang, oder ihre sechs Zeichen nach
//           „FIAON“ stehen irgendwo im Zweck („MADJ3S“, „Fisimatenten-MADJ3S“), oder
//       (3) die ersten sechs Zeichen der Bestellnummer nach „FIAON“ stehen im Zweck bzw. der
//           erkannte Zweck ist ihr Anfang („FIAONMUAYRM“ → FIAON-MUAYRML6-Z3BT), oder
//       (4) der Zahlername enthält Vor- UND Nachname (klein, ohne Umlaute/Akzente, „ae“ = „ä“).
// Sechs Zeichen aus A–Z/0–9 treffen nicht zufällig; ein Namenstreffer kann einen Namensvetter
// erwischen — dann bekommt der eine Mail weniger, nie einer zu viel.
//
// Rein und ohne Datenbank: eingangOffenSql() liefert eine Abfrage (person_id je Treffer), die
// Mara-Aktion setzt sie als Menge in ihre Schlange (kandidatenLaden) und fragt sie direkt vor
// dem Senden noch einmal je Mensch (eingangOffenFuer). eingangOffenListeSql() ist dieselbe
// Regel mit dem Beleg je Treffer — für die Liste an Justin (buchen statt anschreiben).
// Diese Datei bucht nichts und schreibt nichts (Buchung: E-277, fiaon-bank-nachholen.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/** Wie lange ein ungebuchter Eingang als „er hat gezahlt“ gilt (dieselbe Spanne wie die WA-Zentrale, E-230). */
export const EINGANG_TAGE = 30;

/** Normalform eines Verwendungszwecks in SQL: groß, nur A–Z und 0–9 („Fiaon - muayrm“ → „FIAONMUAYRM“). */
export function zweckNormSql(x: string): string {
  return `UPPER(REGEXP_REPLACE(COALESCE(${x}, ''), '[^A-Za-z0-9]', '', 'g'))`;
}

// Umlaute und Akzente — groß und klein, falls die Datenbank LOWER nur für ASCII kennt.
const VON = "äöüàáâãåèéêëìíîïòóôõùúûýÿçñşșćčšžłğıÄÖÜÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝŸÇÑŞȘĆČŠŽŁĞI";
const NACH = "aouaaaaaeeeeiiiioooouuuyycnssccszlgiaouaaaaaeeeeiiiioooouuuyycnssccszlgi";

/** Normalform eines Namens in SQL: klein, ohne Umlaute/Akzente, „ae/oe/ue“ wie „ä/ö/ü“, „ß“ = „ss“, nur a–z. */
export function nameNormSql(x: string): string {
  return `REGEXP_REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(TRANSLATE(COALESCE(${x}, ''), '${VON}', '${NACH}')), 'ß', 'ss'), 'ae', 'a'), 'oe', 'o'), 'ue', 'u'), '[^a-z]', '', 'g')`;
}

/** Normalform eines Zwecks — dieselbe Regel wie zweckNormSql, für Prüfstände. Rein. */
export function zweckNorm(x: string | null | undefined): string {
  return String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Normalform eines Namens — dieselbe Regel wie nameNormSql, für Prüfstände. Rein. */
export function nameNorm(x: string | null | undefined): string {
  let t = String(x ?? "");
  for (let i = 0; i < VON.length; i++) t = t.split(VON[i]).join(NACH[i]);
  return t.toLowerCase().replace(/ß/g, "ss").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u").replace(/[^a-z]/g, "");
}

/** Die Bestellungen, die er offen hat (A oder B), mit den Normalformen. */
function bestellungenSql(): string {
  return `
    SELECT a.person_id, a.ref, a.payment_status,
           ${zweckNormSql("a.ref")} AS rn,
           ${zweckNormSql("a.payment_reference")} AS pn,
           ${nameNormSql("SPLIT_PART(TRIM(COALESCE(NULLIF(TRIM(p.first_name), ''), a.first_name, '')), ' ', 1)")} AS vn,
           ${nameNormSql("SPLIT_PART(REPLACE(TRIM(COALESCE(NULLIF(TRIM(p.last_name), ''), a.last_name, '')), '-', ' '), ' ', 1)")} AS nn
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL
       AND a.payment_status IN ('claimed_paid', 'pending_payment')`;
}

/** Die ungebuchten Eingänge der letzten EINGANG_TAGE Tage, mit den Normalformen. */
function eingaengeSql(): string {
  return `
    SELECT t.id, t.booked_at, t.amount_cents, t.payer_name, t.reference_raw, t.extracted_ref, t.matched_ref, t.match_status, t.note,
           ${zweckNormSql("t.reference_raw")} AS zn,
           ${zweckNormSql("t.extracted_ref")} AS en,
           ${nameNormSql("t.payer_name")} AS zahler
      FROM fiaon_bank_txns t
     WHERE t.applied = FALSE AND t.amount_cents > 0
       AND t.booked_at > NOW() - INTERVAL '${EINGANG_TAGE} days'
       AND COALESCE(t.match_status, '') <> 'ignored'`;
}

/** Die vier Wege, auf denen ein Eingang zu einer Bestellung passt — als SQL-Bedingung über b (Bestellung) und t (Eingang). */
function passtSql(): string {
  return `(
         (t.matched_ref IS NOT NULL AND t.matched_ref = b.ref)
      OR (b.pn ~ '^FIAON[A-Z0-9]{6}' AND (
              (LENGTH(t.en) >= 11 AND (t.en = b.pn OR t.en LIKE b.pn || '%' OR b.pn LIKE t.en || '%'))
           OR t.zn LIKE '%' || SUBSTRING(b.pn FROM 6 FOR 6) || '%'))
      OR (b.rn ~ '^FIAON[A-Z0-9]{6}' AND b.rn NOT LIKE 'FIAONSCHUFA%' AND (
              (LENGTH(t.en) >= 11 AND b.rn LIKE t.en || '%')
           OR t.zn LIKE '%' || SUBSTRING(b.rn FROM 6 FOR 6) || '%'))
      OR (LENGTH(b.vn) >= 2 AND LENGTH(b.nn) >= 3 AND t.zahler LIKE '%' || b.vn || '%' AND t.zahler LIKE '%' || b.nn || '%')
    )`;
}

/**
 * Die Menschen, für die ein ungebuchter Eingang zu einer offenen Bestellung passt — eine Spalte person_id (nie NULL,
 * damit „NOT IN“ trägt). Rein: nur der Text der Abfrage.
 */
export function eingangOffenSql(): string {
  return `SELECT DISTINCT b.person_id FROM (${bestellungenSql()}) b JOIN (${eingaengeSql()}) t ON ${passtSql()} WHERE b.person_id IS NOT NULL`;
}

/**
 * Dieselbe Regel mit dem Beleg je Treffer (Person, Bestellung, Eingang, Weg) — für die Liste an Justin. Rein.
 */
export function eingangOffenListeSql(): string {
  return `
    SELECT b.person_id, b.ref, b.payment_status, t.id AS txn_id, t.booked_at, t.amount_cents, t.reference_raw, t.extracted_ref,
           t.matched_ref, LEFT(COALESCE(t.note, ''), 80) AS note,
           CASE WHEN t.matched_ref IS NOT NULL AND t.matched_ref = b.ref THEN 'matched_ref'
                WHEN b.pn ~ '^FIAON[A-Z0-9]{6}' AND ((LENGTH(t.en) >= 11 AND (t.en = b.pn OR t.en LIKE b.pn || '%' OR b.pn LIKE t.en || '%'))
                     OR t.zn LIKE '%' || SUBSTRING(b.pn FROM 6 FOR 6) || '%') THEN 'zahlungsreferenz'
                WHEN b.rn ~ '^FIAON[A-Z0-9]{6}' AND b.rn NOT LIKE 'FIAONSCHUFA%' AND ((LENGTH(t.en) >= 11 AND b.rn LIKE t.en || '%')
                     OR t.zn LIKE '%' || SUBSTRING(b.rn FROM 6 FOR 6) || '%') THEN 'bestellnummer'
                ELSE 'name' END AS weg
      FROM (${bestellungenSql()}) b JOIN (${eingaengeSql()}) t ON ${passtSql()}
     WHERE b.person_id IS NOT NULL
     ORDER BY t.booked_at DESC, b.person_id`;
}

/** Liegt für diesen Menschen ein passender, ungebuchter Eingang vor? Im Zweifel (Abfrage scheitert) JA — lieber nicht schreiben. */
export async function eingangOffenFuer(personId: number): Promise<boolean> {
  try {
    const z = (await sqlPool.unsafe(`SELECT 1 AS da FROM (${eingangOffenSql()}) e WHERE e.person_id = $1 LIMIT 1`, [Number(personId)])) as any[];
    return z.length > 0;
  } catch {
    return true;
  }
}
