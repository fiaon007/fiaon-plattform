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
//     lebend      02.07.2026   FIAON Pro     0,60 €   pending_payment  ← richtig
//     ARCHIVIERT  16.07.2026   FIAON Ultra   0,80 €   pending_payment  ← gewann
//     lebend      06.08.2026   FIAON Pro     0,00 €   pending
//
// Und im Zustellprotokoll: Josef Rohrmoser bekam am 18. und 19.08. FÜNF Mails
// über „FIAON High End (1,00 €)", während seine gültige Bestellung Pro war —
// alle fünf von Florentine ausgelöst. Genau ihre Meldung.
//
// GEMESSEN bestandsweit: 37 Personen, bei denen die alte Auflösung heute eine
// archivierte Bestellung wählen würde. 8 echte Fehlversände in 14 Tagen.
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

type Lauf = typeof sqlPool;

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
  betragCents: number | null;
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

export async function massgeblicheBestellung(
  personId: number, lauf: Lauf = sqlPool,
): Promise<MassgeblicheBestellung | null> {
  const [b] = (await lauf.unsafe(`
    SELECT a.ref, a.person_id, a.pack_name, a.amount_due, a.payment_reference,
           a.payment_status, a.status, a.created_at,
           COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                    NULLIF(a.billing_email, '')) AS empfaenger,
           COALESCE(a.first_name, a.contact_name) AS vorname,
           a.last_name,
           (SELECT COUNT(*)::int - 1 FROM fiaon_applications w
             WHERE w.person_id = a.person_id AND ${lebendeOffeneBestellungSql("w")}) AS weitere
    FROM fiaon_applications a
    WHERE a.person_id = $1 AND ${lebendeOffeneBestellungSql("a")}
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [personId])) as any[];
  if (!b) return null;
  return {
    ref: String(b.ref),
    personId: Number(b.person_id),
    paket: b.pack_name ?? null,
    betragCents: b.amount_due != null ? Number(b.amount_due) : null,
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
