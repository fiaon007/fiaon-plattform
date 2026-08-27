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
  antragVollstaendigSql, fehlendeFelderAusdruckSql, fehlendeZustimmungenAusdruckSql,
  FORMULAR_SCHRITTE_SQL,
} from "./fiaon-antrag-vollstaendig";
import { PAKETE, paket, paketPreisCents } from "../../shared/fiaon-pakete";

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
// ═══════════════════════════════════════════════════════════════════════════
// ZWEI BEGRIFFE, DIE NICHTS MITEINANDER ZU TUN HABEN (21.08.2026)
//
// ── DIE MELDUNG (Screenshot Hans Neumann, Betrieb) ────────────────────────
// „Antrag fertig — Rechnung offen", FIAON Ultra 79,99 €, Verwendungszweck
// FIAON-QQZAYT — und daneben „Zahlungsdaten: gesperrt", weil E-Mail, Tag des
// Gehaltseingangs, IBAN, AGB-, SCHUFA- und Vertragszustimmung fehlen.
//
// ── WAS DARAN FALSCH WAR ──────────────────────────────────────────────────
// Der Zweig „noch keine Rechnung gestellt" verlangte `REIF_ODER_VOLL`: einen
// Antragszustand aus einer Liste ODER ALLE NEUNZEHN Pflichtfelder. Damit hing
// eine ZAHLUNGSAUFFORDERUNG an Angaben, die zum VERTRAG gehören und nicht zur
// Rechnung.
//
// Eine Rechnung braucht vier Dinge, und drei davon hat Hans Neumann:
//   · eine lebende unbezahlte Bestellung   ✓
//   · einen Betrag aus dem Katalog          ✓ (Ultra, 79,99 €)
//   · einen Verwendungszweck                ✓ (FIAON-QQZAYT)
//   · eine zustellbare Adresse              ✗
//
// Der Gehaltseingangstag sagt nichts darüber, wohin eine Rechnung geht. Die
// IBAN erst recht nicht — wer überweist, braucht UNSERE Bankverbindung, nicht
// umgekehrt. Und die drei Zustimmungen sind Willenserklärungen des Kunden: Sie
// gehören zum Vertrag, den er schließt, nicht zu der Forderung, die wir
// stellen.
//
// ── GEMESSEN (scripts/mess-rechnungsreif.ts, 21.08.2026) ──────────────────
// 388 Personen trugen den Sperrgrund `antrag_unfertig`. Davon haben 137 eine
// lebende unbezahlte Bestellung UND eine zustellbare Adresse — sie sind nach
// der Regel oben sendbar und wurden es nicht. 250 haben wirklich keine
// Adresse; sie bleiben gesperrt, aber mit EINEM Grund statt sechs, und die
// Karte hat für genau diesen Fall ein Eingabefeld.
//
// ── DIE TRENNUNG, DIE JETZT GILT ──────────────────────────────────────────
//   RECHNUNGSREIF  = lebende unbezahlte Bestellung + Katalogpreis + Empfänger
//                    → das und NUR das entscheidet über den Sende-Knopf.
//   VERTRAGSREIF   = die neunzehn Pflichtfelder aus `fiaon-antrag-vollstaendig`
//                    → das steht als Hinweis daneben und sperrt NICHTS.
//
// Der Antragszustand entscheidet gar nicht mehr mit. Er ist ein Merker, den ein
// verlorenes Ereignis falsch stehen lässt (der Rückfall auf `started` bei
// Schritt 9 hat 24 fertige Anträge als „nie begonnen" markiert) — und eine
// Rechnung an einem Merker aufzuhängen war schon beim letzten Mal die Ursache.
//
// Deckungsgleich mit dem Entscheidungsbaum in `zahlungsdatenSenden`:
//   1. lebende offene Bestellung MIT Empfänger        → frei
//   2. lebende offene Bestellung OHNE Empfänger       → keine_email
//   3. unbezahlte Bestellung MIT Empfänger + Preis    → erste_rechnung (frei)
//   4. unbezahlte Bestellung OHNE Empfänger           → keine_email
//   5. unbezahlte Bestellung OHNE Katalogpreis        → kein_preis
//   6. alles bezahlt                                  → alles_bezahlt
//   7. gar keine lebende Bestellung                   → keine_bestellung
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hat diese Bestellung einen Katalogpreis? — dieselbe Reihenfolge wie
 * `katalogpreisCents`: erst die Kategorie, dann der Paketschlüssel.
 *
 * Die Schlüssel kommen aus `shared/fiaon-pakete.ts` und werden hier NICHT
 * abgeschrieben. Eine zweite Liste hätte beim nächsten Paket gefehlt — und der
 * Knopf wäre frei, während `rechnungStellen` „kein Preis hinterlegt" antwortet.
 * Genau diese Klasse (Karte gibt frei, Server lehnt ab) soll diese Datei
 * beseitigen.
 *
 * GEMESSEN am 21.08.2026: 7 von 1.509 unbezahlten Bestellungen haben keinen
 * Katalogpreis (1× pack_key „standard", 6× Firmenantrag ohne Paket).
 */
export function katalogpreisVorhandenSql(a = "a"): string {
  const keys = PAKETE.map((p) => `'${p.key}'`).join(", ");
  return `(${a}.type = 'schufa' OR ${a}.ref LIKE 'FIAON-SCHUFA-%'
      OR LOWER(TRIM(COALESCE(${a}.pack_key, ''))) IN (${keys}))`;
}

/** Unbezahlt heißt: es ist noch Geld offen. „superseded" gehört nicht dazu. */
const UNBEZAHLT_SQL = (a: string): string =>
  `${a}.payment_status NOT IN ('paid', 'refunded', 'superseded')`;

// ═══════════════════════════════════════════════════════════════════════════
// EIN LIEGENGEBLIEBENER ENTWURF IST KEINE FORDERUNG
//
// ── DER BEFUND BEIM MESSEN (21.08.2026) ───────────────────────────────────
// Der erste Entwurf dieser Regel hat den Antragszustand VOLLSTÄNDIG
// weggelassen. Das befreite die 137 Kunden, um die es geht — und nebenbei 48
// weitere, die bereits BEZAHLT hatten.
//
// Nachgesehen, was das für Menschen sind: Person 3471 hat eine bezahlte
// Bestellung und SECHS unbezahlte Zeilen vom selben Tag, alle in
// Formularschritten („started", „contract", „completed"). Person 3345: ein
// Entwurf vom 1. Mai, bezahlt am 2. Mai. Das sind keine Nachbestellungen, das
// sind abgebrochene Anläufe desselben Kaufs — der Trichter, nicht der Bestand.
//
// 48 zahlende Kunden hätten eine Rechnung über 99,99 € für ein Paket bekommen,
// das sie schon haben. Das wäre schlimmer gewesen als die Sperre, die ich
// beheben sollte.
//
// ── DESHALB EIN SCHMALER SCHNITT, KEIN BREITER ────────────────────────────
// Der Antragszustand entscheidet NICHT mehr, ob eine Rechnung gestellt werden
// darf. Er entscheidet nur noch EINES: ob eine unbezahlte Zeile ein ENTWURF
// ist. Und gegen Entwürfe — und nur gegen die — gilt weiter: Wer schon bezahlt
// hat, bekommt keine Rechnung.
//
// GEMESSEN mit dieser Fassung: 137 befreit, 0 Kunden neu gesperrt, die es
// heute nicht schon sind.
//
// Die Liste der Formularschritte steht in `fiaon-antrag-vollstaendig.ts` —
// dieselbe, die der Nachzieh-Lauf benutzt. Zwei Listen wären zwei Begriffe von
// „im Formular".
// ═══════════════════════════════════════════════════════════════════════════
const ENTWURF_SQL = (a: string): string =>
  `${a}.status IN (${FORMULAR_SCHRITTE_SQL})`;

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
  /** Eine lebende Bestellung, auf die noch Geld offen ist — egal in welchem
   *  Formularschritt der Antrag steckt. Der Schritt gehört zum Vertrag. */
  const lebendUnbezahlt = (a: string) => `${a}.person_id = ${p}.id
      AND ${a}.merged_into IS NULL AND ${a}.archived_at IS NULL
      AND ${a}.gdpr_deleted_at IS NULL AND ${a}.cancelled_at IS NULL
      AND ${UNBEZAHLT_SQL(a)}`;

  const offen = `EXISTS (SELECT 1 FROM fiaon_applications a1
    WHERE a1.person_id = ${p}.id AND ${lebendeOffeneBestellungSql("a1")})`;
  const offenMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a2
    WHERE a2.person_id = ${p}.id AND ${lebendeOffeneBestellungSql("a2")}
      AND ${EMPFAENGER_SQL("a2", p)} IS NOT NULL)`;
  // Noch keine Rechnung gestellt: Sie entsteht beim Senden. Dafür braucht es
  // einen Betrag — und der kommt aus dem Katalog, nicht aus `amount_due`.
  // GESTELLT heißt: kein Formularschritt mehr. Diese Zeile ist eine
  // Bestellung, egal was sonst bezahlt ist.
  const gestellt = `EXISTS (SELECT 1 FROM fiaon_applications a3
    WHERE ${lebendUnbezahlt("a3")} AND ${katalogpreisVorhandenSql("a3")}
      AND NOT (${ENTWURF_SQL("a3")}))`;
  const gestelltMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a4
    WHERE ${lebendUnbezahlt("a4")} AND ${katalogpreisVorhandenSql("a4")}
      AND NOT (${ENTWURF_SQL("a4")}) AND ${EMPFAENGER_SQL("a4", p)} IS NOT NULL)`;
  // ENTWURF: steht noch im Formular. Auch daraus wird eine Rechnung — der
  // Mitarbeiter hat den Menschen ja am Telefon. Nur nicht, wenn schon bezahlt
  // wurde (Begründung bei `ENTWURF_SQL`).
  const entwurf = `EXISTS (SELECT 1 FROM fiaon_applications a5
    WHERE ${lebendUnbezahlt("a5")} AND ${katalogpreisVorhandenSql("a5")})`;
  const entwurfMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a6
    WHERE ${lebendUnbezahlt("a6")} AND ${katalogpreisVorhandenSql("a6")}
      AND ${EMPFAENGER_SQL("a6", p)} IS NOT NULL)`;
  const unbezahltOhnePreis = `EXISTS (SELECT 1 FROM fiaon_applications a7
    WHERE ${lebendUnbezahlt("a7")})`;
  const bezahlt = `EXISTS (SELECT 1 FROM fiaon_applications a8
    WHERE a8.person_id = ${p}.id AND a8.merged_into IS NULL AND a8.archived_at IS NULL
      AND a8.gdpr_deleted_at IS NULL AND a8.payment_status = 'paid')`;
  return `CASE
    WHEN ${offenMitMail} THEN 'frei'
    WHEN ${offen} THEN 'keine_email'
    WHEN ${gestelltMitMail} THEN 'erste_rechnung'
    WHEN ${gestellt} THEN 'keine_email'
    WHEN ${bezahlt} THEN 'alles_bezahlt'
    WHEN ${entwurfMitMail} THEN 'erste_rechnung'
    WHEN ${entwurf} THEN 'keine_email'
    WHEN ${unbezahltOhnePreis} THEN 'kein_preis'
    ELSE 'keine_bestellung'
  END`;
}

/**
 * Ist der VERTRAG vollständig? — die neunzehn Pflichtfelder.
 *
 * Diese Frage sperrt NICHTS. Sie steht als grauer Hinweis unter dem
 * Sende-Knopf: „Für den Vertrag fehlen noch: …". Wer sie mit
 * `sendeGrundSql` vermischt, baut den Fehler vom 21.08.2026 neu.
 */
export function vertragsreifSql(p = "p"): string {
  return `NOT EXISTS (SELECT 1 FROM fiaon_applications av
      WHERE av.person_id = ${p}.id AND av.merged_into IS NULL
        AND av.archived_at IS NULL AND av.gdpr_deleted_at IS NULL
        AND av.payment_status NOT IN ('paid', 'refunded')
        AND NOT (${antragVollstaendigSql("av")}))`;
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
  // ── DER EINZIGE NEUE SPERRGRUND (21.08.2026) ────────────────────────────
  // Er entstand aus der Trennung: Wenn nicht mehr der Antragszustand sperrt,
  // muss das fehlen, was eine Rechnung WIRKLICH braucht — ein Betrag. Ohne
  // Katalogpreis würde `rechnungStellen` ablehnen, und die Karte hätte den
  // Knopf freigegeben. Genau diese Klasse beseitigt diese Datei.
  kein_preis: {
    text: "Für das gebuchte Paket ist kein Katalogpreis hinterlegt — "
      + "ohne Betrag wäre die Rechnung eine Bitte um Überweisung von irgendetwas.",
    tat: "Produkt aus dem Katalog anlegen",
  },
  // ── DIESER GRUND WIRD NICHT MEHR ERZEUGT (21.08.2026) ───────────────────
  // Er steht noch im Wörterbuch, weil im Browser eines Mitarbeiters eine
  // ältere Fassung der Oberfläche liegen kann, bis sie hart neu lädt — und ein
  // fehlender Eintrag ergäbe dort einen leeren Sperrhinweis.
  //
  // Der Satz ist trotzdem korrigiert: Ein unfertiger Antrag SPERRT die
  // Rechnung nicht mehr. Was fehlt, gehört zum Vertrag und steht als grauer
  // Hinweis unter dem Knopf.
  antrag_unfertig: {
    text: "Im Antrag fehlen noch Angaben für den VERTRAG — die Rechnung geht "
      + "davon unabhängig raus. Bitte die Seite hart neu laden (Strg+Umschalt+R).",
    tat: null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// WAS FÜR DEN VERTRAG FEHLT — GETRENNT VOM SPERRGRUND
//
// Zwei Listen, weil es zwei Fragen sind:
//   `fehlendeFelderSql`      ALLE neunzehn — was der Antrag noch braucht.
//   `zustimmungFehltSql`     nur die drei Willenserklärungen — was NUR der
//                            Kunde selbst geben darf.
//
// Die zweite Liste entscheidet in der Karte, ob der Knopf „Zustimmungs-Link an
// den Kunden senden" erscheint. Ein Mitarbeiter darf eine Zustimmung nicht
// setzen — rechtlich muss der Kunde selbst zustimmen. Deshalb gibt es dafür
// kein Eingabefeld, sondern einen Link.
// ═══════════════════════════════════════════════════════════════════════════
export function zustimmungFehltSql(p = "p"): string {
  return `(SELECT ${fehlendeZustimmungenAusdruckSql("az")}
      FROM fiaon_applications az
     WHERE az.person_id = ${p}.id AND az.merged_into IS NULL
       AND az.archived_at IS NULL AND az.gdpr_deleted_at IS NULL
       AND az.payment_status NOT IN ('paid', 'refunded')
     ORDER BY az.created_at DESC LIMIT 1)`;
}

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
  // Die PERSON wird mitgelesen (27.08.2026): Ihre Angaben sind seit Migration
  // 059 die gültige Wahrheit, die Spalten an der Bestellung sind Abschriften.
  // Wer nur die Abschrift liest, verlangt vom Mitarbeiter, Daten zu erfragen,
  // die zwei Reiter weiter längst dastehen — genau das hat Justin am
  // 27.08. an der Akte von Godwin Uche gezeigt.
  return `(SELECT ${fehlendeFelderAusdruckSql("af", p)}
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
