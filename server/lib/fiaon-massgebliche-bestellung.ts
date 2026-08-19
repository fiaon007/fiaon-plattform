// ═══════════════════════════════════════════════════════════════════════════
// WELCHE BESTELLUNG GILT? — EINE AUFLÖSUNG FÜR ALLE WEGE
//
// ── DIE MELDUNG (Florentine Lombardi, 19.08.2026) ──────────────────────────
// „Er wollte ein Pro-Paket. Das High End habe ich rausgenommen. Wenn ich auf
// Rechnung senden drücke, bekommt er aber eine E-Mail für das High-End-Paket."
//
// ── DIE URSACHE, GEMESSEN ─────────────────────────────────────────────────
// `zahlungsdatenSenden` löste die Bestellung so auf:
//
//     WHERE person_id = … AND merged_into IS NULL
//       AND payment_status IN ('pending_payment','claimed_paid','expired')
//     ORDER BY created_at DESC LIMIT 1
//
// Es fehlte `archived_at IS NULL`. Die Abfrage dreißig Zeilen darunter hatte den
// Filter — diese nicht. Wer ein Paket „rausnimmt", archiviert die Bestellung;
// sie blieb damit in der Auswahl. Und weil sie später angelegt wurde als die
// gültige, gewann sie das `ORDER BY created_at DESC`.
//
// BEWIESEN an Person 4254 (Gabor Toth, betreut von Florentine):
//     lebend      02.07.2026   FIAON Pro     59,99 €   pending_payment  ← richtig
//     ARCHIVIERT  16.07.2026   FIAON Ultra   79,99 €   pending_payment  ← gewann
//     lebend      06.08.2026   FIAON Pro      0,00 €   pending
//
// GEMESSEN bestandsweit: 37 Personen, bei denen die alte Auflösung heute eine
// archivierte Bestellung wählen würde. 8 echte Fehlversände in 14 Tagen.
//
// ── DIE BETRÄGE IN DIESEM KOMMENTAR WAREN FALSCH (19.08.2026) ─────────────
// Hier stand „FIAON Pro 0,60 €", „Ultra 0,80 €" und der Satz, Josef Rohrmoser
// habe FÜNF Mails über „FIAON High End (1,00 €)" bekommen.
//
// Keine dieser Zahlen existiert. Sie sind das Ergebnis des Einheitenfehlers
// zwei Bildschirme weiter unten: `amount_due` steht in EURO, wurde aber in ein
// Feld namens `betragCents` gelegt. 59,99 € als Cent gelesen ergibt 0,60 €,
// 79,99 € ergibt 0,80 €, 99,99 € ergibt 1,00 €.
//
// GEGENGEPRÜFT im Zustellprotokoll (scripts/mess-muell-betraege.ts): Rohrmoser
// bekam zehn Mails, jede über 99,99 € — den richtigen Betrag. In 4.132
// Zahlungsmails der letzten 30 Tage steht KEIN einziger Betrag unter 5 €.
//
// Der Fehler traf nur den Bildschirm des Agenten. Der Kommentar behauptete
// einen Kundenschaden, den es nicht gab — und ein Kommentar, der mehr behauptet
// als der Code tut, ist eine Lüge (AGENTS.md). Deshalb steht er korrigiert da
// und nicht gelöscht: Sonst hält der nächste Leser die Zahlen für plausibel und
// schreibt sie wieder ab.
//
// ── WAS DAS KOSTET ────────────────────────────────────────────────────────
// Der Kunde überweist den falschen Betrag mit dem falschen Verwendungszweck.
// Der Kontoabgleich findet die Zahlung nicht, die Abo-Rate entsteht auf dem
// falschen Preis, die Provision ebenfalls. Ein Anzeigefehler wäre harmlos —
// dieser hier bewegt Geld.
//
// ── WARUM EINE DATEI UND NICHT EIN FILTER MEHR ────────────────────────────
// Der naheliegende Weg wäre, `AND archived_at IS NULL` an die eine Abfrage zu
// hängen. Das behebt den gemeldeten Fall und lässt die Ursache stehen: SECHS
// Wege lösen dieselbe Frage auf (Mail, Rechnung-PDF, Zahlungsdaten zum
// Kopieren, Verwendungszweck, EPC-QR, Ratenerzeugung), jeder mit eigener
// Abfrage. Solange das so ist, gehen sie wieder auseinander — und dann zeigt
// die Karte Pro, während die Mail High End verschickt.
//
// AGENTS.md: „Eine Definition, ein Ort. Zwei Definitionen für dasselbe Wort
// sind schlimmer als eine fehlende Zahl."
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  antragVollstaendigSql, fehlendeFelderAusdruckSql,
} from "./fiaon-antrag-vollstaendig";
import { paket, paketPreisCents } from "../../shared/fiaon-pakete";

type Lauf = typeof sqlPool;

/**
 * Der Katalogpreis, den DIESE Bestellung haben müsste — in Cent.
 *
 * ── WARUM NICHT EINFACH `paketPreisCents(pack_key)` ──────────────────────
 * GEMESSEN am 19.08.2026: Sechs Bonitätsauskünfte tragen im `pack_key` das
 * STUFENPAKET ihres Kunden (highend, pro, ultra). Der Dubletten-Merge hat es
 * dort eingetragen — `pack_key` steht in seiner Liste der gefüllten Felder.
 *
 * Wer den Preis danach am `pack_key` ausrechnet, verlangt für eine Auskunft
 * 99,99 € statt 74,00 €. Bei zwei unbezahlten Bestellungen ist genau das
 * passiert. Die KATEGORIE entscheidet also vor dem Paketschlüssel — und sie
 * steht in `type` beziehungsweise im Präfix der Referenz, so wie es
 * `fiaon-agent-anlage.ts` beim Anlegen schon prüft.
 *
 * Rückgabe `null` heißt „kein Katalogpreis bestimmbar" — dann darf niemand
 * einen Betrag ableiten und schon gar nicht einen raten.
 */
export function katalogpreisCents(
  zeile: { ref?: unknown; type?: unknown; pack_key?: unknown },
): number | null {
  const ref = String(zeile.ref ?? "");
  if (String(zeile.type ?? "") === "schufa" || ref.startsWith("FIAON-SCHUFA-")) {
    return paketPreisCents("schufa");
  }
  return paket(zeile.pack_key) ? paketPreisCents(zeile.pack_key) : null;
}

/**
 * Die maßgebliche OFFENE Bestellung einer Person.
 *
 * „Maßgeblich" heißt:
 *   · LEBEND      — nicht archiviert, nicht zusammengeführt, nicht ersetzt
 *                   (`superseded`), nicht storniert, nicht DSGVO-gelöscht
 *   · UNBEZAHLT   — es ist noch Geld offen
 *   · bei mehreren: die ZULETZT ANGELEGTE
 *
 * ── WARUM „zuletzt angelegt" UND NICHT „die einzige" ────────────────────
 * Es gibt Personen mit mehreren echten offenen Bestellungen (gemessen: 57, eine
 * davon mit zehn). Ein Fehler wäre das nicht — ein Kunde kann nachbestellen.
 * Aber es ist eine Entscheidung, und die trifft diese Funktion sichtbar an
 * einer Stelle, statt sie sechsmal stillschweigend zu treffen.
 *
 * Die Oberfläche sagt dem Agenten deshalb, dass es mehrere gibt (`weitereOffen`)
 * — eine stille Auswahl unter mehreren ist genau das, was hier schiefging.
 */
export interface MassgeblicheBestellung {
  ref: string;
  personId: number;
  paket: string | null;
  /**
   * Der Betrag in CENT.
   *
   * ── HIER STAND DER EINHEITENFEHLER (19.08.2026) ────────────────────────
   * `amount_due` ist eine EURO-Spalte (NUMERIC(10,2)) — der ganze Bestand
   * bestätigt es: 7.99, 59.99, 79.99, 99.99, 249.99. Die Zeile lautete
   *
   *     betragCents: b.amount_due != null ? Number(b.amount_due) : null
   *
   * also 79,99 € = 79,99 Cent. Der Bestätigungs-Dialog teilt anschließend
   * durch 100 und schrieb „0,80 €" — genau die Zahl aus dem Screenshot des
   * Betreibers. High End wurde zu „1,00 €", Pro zu „0,60 €".
   *
   * Jede andere Stelle im Haus rechnet richtig (`Math.round(Number(…) * 100)`,
   * neunmal). Nur diese eine, gestern neu gebaute, nicht — und weil sie die
   * einzige Quelle des neuen Dialogs ist, war der Fehler sofort auf dem
   * Bildschirm jedes Agenten.
   */
  betragCents: number | null;
  /** Was der Katalog für dieses Paket vorsieht — in Cent, `null` wenn unbekannt. */
  katalogCents: number | null;
  /** Weicht der gespeicherte Betrag vom Katalogpreis ab? (Toleranz 0) */
  betragWeichtAb: boolean;
  verwendungszweck: string | null;
  zahlungsstatus: string;
  status: string | null;
  empfaenger: string | null;
  vorname: string | null;
  nachname: string | null;
  angelegtAm: string;
  /** Wie viele weitere LEBENDE offene Bestellungen hat diese Person noch? */
  weitereOffen: number;
}

/**
 * Die Bedingung als SQL-Baustein — für Abfragen, die selbst verbinden müssen.
 *
 * Sie steht hier und nicht in `fiaon-bestand-filter.ts`, weil sie mehr ist als
 * ein Filter: Sie enthält die Rangfolge. Wer nur den Filter nimmt und die
 * Rangfolge selbst erfindet, hat wieder zwei Auflösungen.
 */
export function lebendeOffeneBestellungSql(a = "a"): string {
  return `${a}.person_id IS NOT NULL
      AND ${a}.merged_into IS NULL
      AND ${a}.archived_at IS NULL
      AND ${a}.gdpr_deleted_at IS NULL
      AND ${a}.cancelled_at IS NULL
      AND ${a}.payment_status IN ('pending_payment', 'claimed_paid', 'expired')`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DARF GESENDET WERDEN? — ALS SQL, FÜR DIE ARBEITSLISTE
//
// ── DIE MELDUNG (Florentine, 19.08.2026) ───────────────────────────────────
// „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine Mail
// schicken."
//
// ── DER STRUKTURELLE BEFUND ────────────────────────────────────────────────
// Die Karte leitete den Sperrgrund SELBST ab, aus den `buchungen`, die sie
// ohnehin hatte. Der Server entschied nach anderen Regeln. GEMESSEN bei
// Florentine: Bei 139 Kunden gab die Karte den Knopf FREI und der Server lehnte
// ab — genau das erlebt ein Agent als „ich drücke und nichts passiert".
//
// Zwei Ableitungen für dieselbe Frage. Der Kommentar in der Karte sagte sogar
// „Die WAHRHEIT bleibt der Server" — und leitete danach trotzdem selbst ab.
//
// ── DIE ANTWORT KOMMT JETZT VOM SERVER ────────────────────────────────────
// Als SQL-Ausdruck und nicht als Funktion je Kunde: Die Arbeitsliste holt 1.093
// Karten in EINER Abfrage. Ein Aufruf je Kunde wären 1.093 Abfragen, und dann
// baut jemand aus Not wieder eine Ableitung in der Oberfläche.
//
// Deckungsgleich mit dem Entscheidungsbaum in `zahlungsdatenSenden`:
//   1. lebende offene Bestellung MIT Empfänger        → frei
//   2. lebende offene Bestellung OHNE Empfänger       → keine_email
//   3. rechnungsreife Bestellung MIT Empfänger        → erste_rechnung (frei)
//   4. rechnungsreife OHNE Empfänger                  → keine_email
//   5. Bestellung da, aber Antrag im Formular         → antrag_unfertig
//   6. alles bezahlt                                  → alles_bezahlt
//   7. gar keine lebende Bestellung                    → keine_bestellung
// ═══════════════════════════════════════════════════════════════════════════

/** Die Antragszustände, in denen eine erste Rechnung gestellt werden darf. */
const REIF_SQL = "'completed','approved','submitted','documents_submitted',"
  + "'verifying','processing','pending_payment'";

// ═══════════════════════════════════════════════════════════════════════════
// DER ZUSTAND WIRD AUS DEM INHALT ABGELEITET, NICHT NUR AUS DEM LETZTEN KLICK
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Bei einigen Kunden wird angezeigt, dass sich der Antrag noch ‚im Formular'
// befindet … Das Problem ist, dass der Antrag aus meiner Sicht bereits
// vollständig ausgefüllt ist."
//
// ── DER BEFUND (scripts/mess-rechnung-blockade.ts) ─────────────────────────
// 475 Anträge standen auf `antrag_unfertig`. 25 davon tragen JEDES Pflichtfeld
// — alle drei Zusagen, E-Mail, Gehaltseingangstag, vollständige Stammdaten. Sie
// sind fertig. Ihr Zustand sagte `started` oder `contract`.
//
// Die Ursache lag in `client/src/pages/antrag.tsx` (Rückfall auf den ERSTEN
// Schritt bei Schritt 9, siehe `shared/fiaon-antrag-schritte.ts`). Sie ist
// behoben — aber ein behobener Schreibfehler räumt den Bestand nicht auf, und
// der nächste verlorene Schritt erzeugt denselben Zustand wieder.
//
// ── DESHALB ENTSCHEIDET DER INHALT MIT ────────────────────────────────────
// AGENTS.md: „Zustände, die sich ausrechnen lassen, werden AUSGERECHNET." Der
// Zustand ist ein Merker, den ein verlorenes Ereignis falsch stehen lässt — die
// Felder sind die Tatsache. Wer alle Pflichtfelder trägt, ist rechnungsreif,
// ganz gleich welcher Klick zuletzt angekommen ist.
//
// Die Liste der Pflichtfelder steht in `fiaon-antrag-vollstaendig.ts` — einmal,
// mit einer TypeScript- und einer SQL-Fassung, die ein Prüfstand gegeneinander
// hält.
// ═══════════════════════════════════════════════════════════════════════════
const REIF_ODER_VOLL = (a: string): string =>
  `(${a}.status IN (${REIF_SQL}) OR ${antragVollstaendigSql(a)})`;

/** Der Empfänger: Bestellung zuerst, Person als Rückfall. */
const EMPFAENGER_SQL = (a: string, p: string) =>
  `COALESCE(NULLIF(TRIM(${a}.email),''), NULLIF(TRIM(${a}.contact_email),''),`
  + ` NULLIF(TRIM(${a}.billing_email),''), NULLIF(TRIM(${p}.primary_email),''))`;

// ═══════════════════════════════════════════════════════════════════════════
// DER EMPFÄNGER EINER PERSON — EINE AUFLÖSUNG FÜR ANZEIGE UND VERSAND
//
// ── DIE MELDUNG (Screenshot, 19.08.2026) ───────────────────────────────────
// Der Bestätigungs-Dialog: „Das bekommt JOACHIM RECHTSTEINER — Für diesen
// Kunden ist keine E-Mail-Adresse hinterlegt." In seiner Akte steht
// euro-tec@t-online.de.
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Der Dialog hängt an `/agent/crm/kunden/:id/rechnung-vorschau`. Diese Route
// hat ZWEI Zweige. Der erste benutzt `massgeblicheBestellung` und liest die
// Adresse richtig (Bestellung, dann Person). Der zweite — „noch keine Rechnung
// gestellt" — hatte eine eigene Abfrage:
//
//     COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''),
//              NULLIF(a.billing_email,''))
//
// Ohne `p.primary_email`. Wer nur an der PERSON eine Adresse hat, war für
// diesen Zweig adressenlos. Seit Migration 059 ist die Person die gültige
// Wahrheit und die Spalten an der Bestellung sind Abschriften (AGENTS.md) —
// eine Abfrage, die nur die Abschrift liest, findet nichts, wenn die Abschrift
// vor dem Trigger entstanden ist.
//
// Und der SERVER hätte gesendet: `rechnungStellen` liest über
// `kandidatenLaden` ausdrücklich auch `p.primary_email`. Die Anzeige sagte
// „geht nicht", der Versand hätte funktioniert. Zwei Ableitungen für dieselbe
// Frage — dieselbe Fehlerklasse, die diese Datei beseitigen sollte.
//
// ── DESHALB EINE FUNKTION, KEIN FILTER MEHR ───────────────────────────────
// Wer wissen will, wohin eine Mail an diesen Menschen geht, ruft das hier auf.
// `quelle` sagt dazu, WOHER die Adresse kommt — sonst rätselt der nächste
// Leser, ob die Bestellung oder die Person gewonnen hat.
// ═══════════════════════════════════════════════════════════════════════════

export interface Empfaenger {
  adresse: string | null;
  /** „bestellung" oder „person" — leer, wenn es keine Adresse gibt. */
  quelle: "bestellung" | "person" | null;
}

export async function empfaengerFuer(
  personId: number, ref: string | null = null, lauf: Lauf = sqlPool,
): Promise<Empfaenger> {
  const [r] = (await lauf`
    SELECT
      (SELECT COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''),
                       NULLIF(TRIM(a.billing_email), ''))
         FROM fiaon_applications a
        WHERE a.person_id = ${personId}
          AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
          AND (${ref}::text IS NULL OR a.ref = ${ref}::text)
          AND COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''),
                       NULLIF(TRIM(a.billing_email), '')) IS NOT NULL
        ORDER BY a.created_at DESC LIMIT 1) AS aus_bestellung,
      (SELECT NULLIF(TRIM(p.primary_email), '') FROM fiaon_persons p
        WHERE p.id = ${personId}) AS aus_person
  `) as any[];
  const b = r?.aus_bestellung ? String(r.aus_bestellung) : null;
  const p = r?.aus_person ? String(r.aus_person) : null;
  if (b) return { adresse: b, quelle: "bestellung" };
  if (p) return { adresse: p, quelle: "person" };
  return { adresse: null, quelle: null };
}

/**
 * Der Grund-CODE als SQL-Ausdruck. Gibt `'frei'`, `'erste_rechnung'` oder einen
 * Sperrgrund zurück.
 *
 * Codes, nicht Texte: Der Text gehört in die Oberfläche, der Code in die
 * Statistik. Ein Text in einer WHERE-Bedingung bricht bei der ersten
 * Umformulierung.
 */
export function sendeGrundSql(p = "p"): string {
  const offen = `EXISTS (SELECT 1 FROM fiaon_applications a1
    WHERE a1.person_id = ${p}.id AND ${lebendeOffeneBestellungSql("a1")})`;
  const offenMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a2
    WHERE a2.person_id = ${p}.id AND ${lebendeOffeneBestellungSql("a2")}
      AND ${EMPFAENGER_SQL("a2", p)} IS NOT NULL)`;
  const reif = `EXISTS (SELECT 1 FROM fiaon_applications a3
    WHERE a3.person_id = ${p}.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
      AND a3.gdpr_deleted_at IS NULL AND a3.payment_status = 'pending'
      AND ${REIF_ODER_VOLL("a3")})`;
  const reifMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a4
    WHERE a4.person_id = ${p}.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
      AND a4.gdpr_deleted_at IS NULL AND a4.payment_status = 'pending'
      AND ${REIF_ODER_VOLL("a4")} AND ${EMPFAENGER_SQL("a4", p)} IS NOT NULL)`;
  const irgendeine = `EXISTS (SELECT 1 FROM fiaon_applications a5
    WHERE a5.person_id = ${p}.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
      AND a5.gdpr_deleted_at IS NULL)`;
  const bezahlt = `EXISTS (SELECT 1 FROM fiaon_applications a6
    WHERE a6.person_id = ${p}.id AND a6.merged_into IS NULL AND a6.archived_at IS NULL
      AND a6.gdpr_deleted_at IS NULL AND a6.payment_status = 'paid')`;
  return `CASE
    WHEN ${offenMitMail} THEN 'frei'
    WHEN ${offen} THEN 'keine_email'
    WHEN ${reifMitMail} THEN 'erste_rechnung'
    WHEN ${reif} THEN 'keine_email'
    WHEN ${bezahlt} THEN 'alles_bezahlt'
    WHEN ${irgendeine} THEN 'antrag_unfertig'
    ELSE 'keine_bestellung'
  END`;
}

/** Der Klartext zu einem Grund-Code — an EINER Stelle, für alle Oberflächen. */
export const SENDE_GRUND_TEXT: Record<string, { text: string; tat: string | null }> = {
  frei: { text: "", tat: null },
  erste_rechnung: {
    text: "Noch keine Rechnung gestellt — beim Senden wird sie erzeugt (Betrag aus dem Paket, sieben Tage Frist).",
    tat: null,
  },
  keine_email: {
    text: "Keine E-Mail-Adresse — ohne sie kann nichts rausgehen.",
    tat: "E-Mail nachtragen",
  },
  keine_bestellung: {
    text: "Keine Bestellung vorhanden — es gibt nichts zu bezahlen.",
    tat: "Produkt anlegen",
  },
  alles_bezahlt: {
    text: "Alles bezahlt. Eine Zahlungsaufforderung wäre falsch.",
    tat: null,
  },
  // ── HIER STAND EIN PAUSCHALSATZ, UND DAS WAR DER FEHLER ─────────────────
  // Wörtlich vorher: „Der Antrag steht noch im Formular — ruf an und hilf beim
  // Fertigstellen." Daniel dazu: „Es ist nicht ersichtlich, welche Information
  // noch fehlt oder an welcher Stelle der Antrag noch fertiggestellt werden
  // soll."
  //
  // Er hat recht: Der Satz nennt eine Aufgabe („hilf beim Fertigstellen") ohne
  // ihren Inhalt. Die Karte bekommt jetzt `fehlendeFelder` vom Server mit und
  // schreibt „Es fehlt: Geburtsdatum, IBAN" — dieser Text ist nur noch der
  // Rückfall, wenn die Liste leer bleibt.
  antrag_unfertig: {
    text: "Im Antrag fehlen noch Angaben — sie stehen unten. "
      + "Sobald sie da sind, lässt sich eine Rechnung stellen.",
    tat: "Fehlendes am Telefon ergänzen",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// WAS GENAU FEHLT — ALS SQL, FÜR DIE ARBEITSLISTE
//
// Ein pauschales „im Formular" schickt den Agenten auf die Suche. Diese Abfrage
// liefert die fehlenden Felder der MASSGEBLICHEN Bestellung als Text, damit die
// Karte sie benennen kann.
//
// Sie steht als SQL und nicht als Aufruf je Kunde, weil die Arbeitsliste über
// 1.000 Karten in EINER Abfrage holt (dieselbe Begründung wie bei
// `sendeGrundSql`). Die TypeScript-Fassung `fehlendeFelder` bewertet eine
// einzelne Zeile für die Akte; `scripts/pruef-antrag-vollstaendig.ts` hält
// beide gegeneinander.
// ═══════════════════════════════════════════════════════════════════════════
export function fehlendeFelderSql(p = "p"): string {
  return `(SELECT ${fehlendeFelderAusdruckSql("af")}
      FROM fiaon_applications af
     WHERE af.person_id = ${p}.id AND af.merged_into IS NULL
       AND af.archived_at IS NULL AND af.gdpr_deleted_at IS NULL
       AND af.payment_status NOT IN ('paid', 'refunded')
     ORDER BY af.created_at DESC LIMIT 1)`;
}

export async function massgeblicheBestellung(
  personId: number, lauf: Lauf = sqlPool,
): Promise<MassgeblicheBestellung | null> {
  const [b] = (await lauf.unsafe(`
    SELECT a.ref, a.person_id, a.pack_name, a.pack_key, a.type, a.amount_due,
           a.payment_reference, a.payment_status, a.status, a.created_at,
           -- ══════════════════════════════════════════════════════════════
           -- DER EMPFÄNGER STEHT AN DER PERSON, NICHT NUR AN DER BESTELLUNG
           --
           -- ── DIE MELDUNG (Florentine, 19.08.2026) ──────────────────────
           -- „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine
           -- Mail schicken."
           --
           -- GEMESSEN: Bei 21 ihrer Kunden hat die BESTELLUNG keine Adresse,
           -- die PERSON aber schon. Der Server las nur die Bestellung und
           -- antwortete „Für diesen Kunden ist keine E-Mail-Adresse
           -- hinterlegt" — während in der Karte eine stand. Genau das erlebt
           -- ein Agent als „der Knopf tut nichts".
           --
           -- Seit Migration 059 ist die Person die gültige Wahrheit und die
           -- Spalten an der Bestellung sind Abschriften (AGENTS.md). Ein
           -- Leser, der nur die Abschrift liest, findet nichts, wenn sie
           -- vor dem Trigger entstanden ist.
           -- ══════════════════════════════════════════════════════════════
           COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                    NULLIF(a.billing_email, ''), NULLIF(p.primary_email, '')) AS empfaenger,
           COALESCE(a.first_name, a.contact_name) AS vorname,
           a.last_name,
           (SELECT COUNT(*)::int - 1 FROM fiaon_applications w
             WHERE w.person_id = a.person_id AND ${lebendeOffeneBestellungSql("w")}) AS weitere
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.person_id = $1 AND ${lebendeOffeneBestellungSql("a")}
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [personId])) as any[];
  if (!b) return null;
  // amount_due ist EURO — deshalb × 100. Siehe die Begründung an `betragCents`.
  const betragCents = b.amount_due != null ? Math.round(Number(b.amount_due) * 100) : null;
  const katalogCents = katalogpreisCents(b);
  return {
    ref: String(b.ref),
    personId: Number(b.person_id),
    paket: b.pack_name ?? null,
    betragCents,
    katalogCents,
    betragWeichtAb: betragCents != null && katalogCents != null && betragCents !== katalogCents,
    verwendungszweck: b.payment_reference ?? null,
    zahlungsstatus: String(b.payment_status),
    status: b.status ?? null,
    empfaenger: b.empfaenger ?? null,
    vorname: b.vorname ?? null,
    nachname: b.last_name ?? null,
    angelegtAm: new Date(b.created_at).toISOString(),
    weitereOffen: Math.max(0, Number(b.weitere ?? 0)),
  };
}

/**
 * Eine vom Client mitgeschickte Referenz gegen die Auflösung prüfen.
 *
 * ── WARUM DAS NÖTIG IST ───────────────────────────────────────────────────
 * Die Kundenkarte hält ihren Datenstand, bis sie neu geladen wird. Wer ein Paket
 * tauscht und sofort auf „senden" drückt, schickt möglicherweise noch die ALTE
 * Referenz mit — die des gerade archivierten Pakets. Ein Server, der eine
 * mitgeschickte Referenz ungeprüft nimmt, macht den Fehler des Clients zu einem
 * Geldfehler.
 *
 * Deshalb: Zeigt die Referenz auf eine tote oder ersetzte Bestellung, wird
 * ABGELEHNT — mit dem, was jetzt gilt, im Klartext. Nicht stillschweigend
 * korrigiert: Der Agent soll sehen, dass sich etwas geändert hat, sonst
 * wundert er sich später über den Betrag.
 */
export async function bestellungPruefen(
  personId: number, refVomClient: string | null | undefined, lauf: Lauf = sqlPool,
): Promise<
  | { ok: true; bestellung: MassgeblicheBestellung }
  | { ok: false; fehler: string; gueltig: MassgeblicheBestellung | null }
> {
  const gueltig = await massgeblicheBestellung(personId, lauf);
  const ref = String(refVomClient ?? "").trim();

  if (!gueltig) {
    return {
      ok: false, gueltig: null,
      fehler: "Für diesen Kunden gibt es keine offene Bestellung mehr. "
        + "Möglich ist: bereits bezahlt, storniert oder als doppelt archiviert.",
    };
  }
  if (!ref || ref === gueltig.ref) return { ok: true, bestellung: gueltig };

  // Die mitgeschickte Referenz gehört zu einer anderen Zeile. Gehört sie
  // überhaupt zu dieser Person?
  const [fremd] = (await lauf`
    SELECT ref, pack_name, archived_at, cancelled_at, payment_status, person_id
    FROM fiaon_applications WHERE ref = ${ref}
  `) as any[];
  if (!fremd || Number(fremd.person_id) !== personId) {
    return {
      ok: false, gueltig,
      fehler: "Diese Bestellung gehört nicht zu diesem Kunden. Lade die Seite neu.",
    };
  }

  const betrag = gueltig.betragCents != null
    ? `${(gueltig.betragCents / 100).toFixed(2).replace(".", ",")} €` : "noch kein Betrag";
  const warum = fremd.archived_at ? "wurde archiviert"
    : fremd.cancelled_at ? "wurde storniert"
    : fremd.payment_status === "paid" ? "ist bereits bezahlt"
    : fremd.payment_status === "superseded" ? "wurde ersetzt"
    : "ist nicht mehr offen";
  return {
    ok: false, gueltig,
    fehler: `Diese Bestellung ${warum}. Es gilt jetzt: `
      + `${gueltig.paket ?? "ohne Paketnamen"}, ${betrag}, `
      + `Verwendungszweck ${gueltig.verwendungszweck ?? gueltig.ref}. `
      + "Lade die Seite neu und sende dann erneut.",
  };
}
