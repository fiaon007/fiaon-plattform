// ═══════════════════════════════════════════════════════════════════════════
// WAS HAT DIESER KUNDE GEBUCHT?
//
// ── DER BEFUND (11.08.2026) ────────────────────────────────────────────────
// Ein Agent, über Shahed Mohammad: „Ursprünglich war er wegen seines Pakets
// bei mir hinterlegt. Jetzt ist das Paket bei mir komplett verschwunden und er
// taucht nur noch wegen der Schufa auf. In meinem Kundenbereich sehe ich weder
// das Paket noch, dass überhaupt eines gebucht wurde."
//
// Gemessen — Person #5144 hat ZWEI Bestellungen:
//
//   FIAON-MRY05QXX-T912   ultra, 79,99 €   23.07.  claimed_paid
//   FIAON-SCHUFA-…-RXFX   Bonität, 74 €    31.07.  expired
//
// Die Kundenkarte holte das Paket mit
// `ORDER BY a.created_at DESC LIMIT 1` — also die NEUESTE. Das ist seit dem
// 31.07. die Bonitätsauskunft; das Paket verschwand aus seinem Blickfeld,
// obwohl es offen ist.
//
// ── EIN KUNDE HAT BUCHUNGEN, NICHT EINE BESTELLUNG ─────────────────────────
// Das ist der eigentliche Denkfehler. Wer ein Paket bucht und später eine
// Bonitätsauskunft dazu, hat zwei Vorgänge — beide können offen oder bezahlt
// sein, unabhängig voneinander.
//
// Derselbe Fehler steckt hinter drei weiteren Meldungen:
//
//   „Unter Bezahlt befinden sich Kunden, bei denen das Paket bezahlt, die
//    Schufa aber noch offen ist."                        → zwei Vorgänge
//   „Bei vielen Kunden in Rechnung offen gibt es keine offene Zahlung."
//                                                        → falscher Vorgang
//   „Es wäre wichtig, dass jeder Mitarbeiter sieht, welches Paket gebucht
//    wurde, welche Zusatzleistungen, was bezahlt bzw. offen ist."
//                                                        → alle Vorgänge
//
// Deshalb diese Datei: EINE Antwort auf „was hat er gebucht", für die
// Kundenkarte, die Akte, das Telefon und das Forderungsmanagement.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { PAKET_PREIS_CENTS } from "./fiaon-abo-pflicht";

type Lauf = typeof sqlPool;

export type BuchungsArt = "paket" | "bonitaet" | "sonstiges";

export interface Buchung {
  ref: string;
  art: BuchungsArt;
  /** „FIAON Ultra" oder „Bonitätsauskunft" — einzeilig, für die Anzeige. */
  bezeichnung: string;
  packKey: string | null;
  betragCents: number | null;
  /** Was der Kunde selbst gemeldet hat. */
  zahlungsstand: string | null;
  /** In Worten, ohne Feldnamen. */
  zahlungText: string;
  bezahlt: boolean;
  offen: boolean;
  /** Wann wurde bestellt? */
  gestelltAm: string | null;
  /** Bis wann sollte gezahlt werden? */
  faelligAm: string | null;
  /** Der Verwendungszweck — ohne ihn lässt sich kein Geld zuordnen. */
  verwendungszweck: string | null;
  status: string | null;
  /** Zurückgezogen, storniert oder abgelaufen? */
  erledigt: boolean;
}

/**
 * Die Bonitätsauskunft ist ein Einzelprodukt, kein Paket.
 *
 * ── DIE FRAGE DES AGENTEN ──────────────────────────────────────────────────
 * „Wie konnte er die Bonitätsauskunft beantragen, obwohl das Paket noch nicht
 * bezahlt wurde — ich dachte, der Zugang wird erst nach Zahlung freigeschaltet?"
 *
 * Gemessen: Sein Konto steht auf `account_status = pending`, er war also NIE
 * freigeschaltet. Die Bonitätsauskunft (74 €) wird über ein eigenes,
 * öffentliches Formular bestellt — sie ist ein Einmalprodukt und setzt kein
 * Konto voraus. Das ist so gewollt und keine Lücke.
 *
 * Was fehlte, war die Sichtbarkeit: Der Agent sah nur einen der beiden
 * Vorgänge und musste raten, was mit dem anderen ist.
 */
export function artVon(ref: string, packKey: unknown, packName: unknown, betrag: unknown): BuchungsArt {
  if (String(ref).includes("SCHUFA")) return "bonitaet";
  if (Number(betrag) === 74) return "bonitaet";
  const n = String(packName ?? "").toLowerCase();
  if (n.includes("onitäts") || n.includes("onitaets")) return "bonitaet";
  if (packKey) return "paket";
  return "sonstiges";
}

/** Zahlungsstände in Worten. Ein Agent soll keine Feldnamen entziffern. */
export const ZAHLUNG_TEXT: Record<string, string> = {
  paid: "bezahlt",
  // „pending" heißt: Der Antrag steht, aber es wurde nie eine Rechnung
  // geschickt. Gemessen am 11.08.2026 stand in der Karte das nackte Wort
  // „pending" — ein Agent kann damit nichts anfangen.
  pending: "Rechnung noch nicht gestellt",
  pending_payment: "offen",
  claimed_paid: "Zahlung gemeldet, noch nicht eingegangen",
  expired: "Zahlungsfrist abgelaufen",
  cancelled: "storniert",
  refunded: "erstattet",
  failed: "fehlgeschlagen",
};

/**
 * Alle Buchungen eines Kunden — offene und bezahlte, Paket und Zusatz.
 *
 * ── WARUM AUCH DIE BEZAHLTEN ───────────────────────────────────────────────
 * „Was hat er schon bezahlt" ist die zweite Frage in jedem Gespräch über eine
 * offene Rechnung. Wer sie nicht beantworten kann, klingt wie jemand, der die
 * Akte nicht kennt.
 *
 * ── WARUM NICHT DIE ARCHIVIERTEN ───────────────────────────────────────────
 * Ein archivierter Vorgang ist bewusst aus dem Blick genommen worden. Ihn
 * wieder einzublenden würde die Entscheidung rückgängig machen, die jemand
 * getroffen hat.
 */
export async function buchungenVon(
  personId: number, lauf: Lauf = sqlPool,
): Promise<Buchung[]> {
  const rows = (await lauf`
    SELECT a.ref, a.pack_key, a.pack_name, a.amount_due, a.payment_status,
           a.status, a.created_at, a.payment_due_date, a.payment_reference,
           a.cancelled_at, a.refunded_at
    FROM fiaon_applications a
    WHERE a.person_id = ${personId}
      AND a.merged_into IS NULL
      AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL
    ORDER BY a.created_at
  `) as any[];

  return rows.map((r) => {
    const zahlung = String(r.payment_status ?? "");
    const bezahlt = zahlung === "paid";
    const erledigt = !!r.cancelled_at || !!r.refunded_at
      || zahlung === "cancelled" || zahlung === "refunded";
    return {
      ref: String(r.ref),
      art: artVon(r.ref, r.pack_key, r.pack_name, r.amount_due),
      // Der Paketname trägt im Bestand einen Zeilenumbruch mit Zusatztext
      // („FIAON Ultra\n(Elite Konto)"). Für eine Zeile in der Karte ist nur
      // der erste Teil brauchbar.
      bezeichnung: String(r.pack_name ?? "").split("\n")[0].trim()
        || (String(r.ref).includes("SCHUFA") ? "Bonitätsauskunft" : "Ohne Bezeichnung"),
      packKey: r.pack_key ?? null,
      // ── DER BETRAG KOMMT AUS DEM PAKET, WENN ER FEHLT ─────────────────
      // Gemessen: Von 1.140 Bestellungen mit fertigem Antrag hatten ZWEI einen
      // `amount_due`. Die Karte zeigte deshalb „Offen insgesamt: 0,00 €",
      // obwohl 59,99 € offen sind — eine Zahl, die schlimmer ist als keine.
      //
      // Der Paketpreis ist dieselbe Quelle, aus der `rechnungStellen` den
      // Betrag setzt (server/lib/fiaon-rechnung-stellen.ts). Zwei Wege zum
      // selben Wert wären zwei Gelegenheiten, sich zu widersprechen.
      betragCents: r.amount_due != null && Number(r.amount_due) > 0
        ? Math.round(Number(r.amount_due) * 100)
        : (r.pack_key ? PAKET_PREIS_CENTS[String(r.pack_key)] ?? null : null),
      zahlungsstand: zahlung || null,
      zahlungText: ZAHLUNG_TEXT[zahlung] ?? (zahlung || "unbekannt"),
      bezahlt,
      offen: !bezahlt && !erledigt,
      gestelltAm: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null,
      faelligAm: r.payment_due_date
        ? new Date(r.payment_due_date).toISOString().slice(0, 10) : null,
      verwendungszweck: r.payment_reference ?? null,
      status: r.status ?? null,
      erledigt,
    };
  });
}

/**
 * Die Kurzfassung für eine Kundenkarte.
 *
 * ── WAS EIN AGENT IN EINER ZEILE WISSEN MUSS ───────────────────────────────
 * „Ultra offen (79,99 €) · Bonität offen (74 €)" sagt in acht Wörtern, worum
 * es geht. Eine Liste aus zwei Kacheln braucht dafür halbe Bildschirmhöhe.
 */
export function buchungsZeile(b: Buchung[]): string {
  if (b.length === 0) return "Keine Buchung hinterlegt";
  const eur = (c: number | null) => c != null
    ? `${(c / 100).toFixed(2).replace(".", ",")} €` : "Betrag offen";
  return b
    .filter((x) => !x.erledigt)
    .map((x) => `${x.bezeichnung} ${x.bezahlt ? "bezahlt" : "offen"} (${eur(x.betragCents)})`)
    .join(" · ") || "Alle Buchungen storniert";
}

/**
 * Ist dieser Kunde WIRKLICH fertig — oder ist noch etwas offen?
 *
 * ── DER BEFUND ─────────────────────────────────────────────────────────────
 * Ein Agent: „Unter Bezahlt befinden sich Kunden, bei denen das Paket bezahlt,
 * die Schufa aber noch offen ist. Links steht Bezahlt, gleichzeitig steht
 * rechts Zusage seit 7 Tagen überfällig."
 *
 * Beides stimmte — nur bezog es sich auf verschiedene Vorgänge. Die Einstufung
 * sah die neueste Bestellung, die Zusage hing an der anderen.
 *
 * Diese Funktion beantwortet die Frage für den GANZEN Kunden.
 */
export function alleBezahlt(b: Buchung[]): boolean {
  const zaehlt = b.filter((x) => !x.erledigt);
  return zaehlt.length > 0 && zaehlt.every((x) => x.bezahlt);
}

export function offeneBuchungen(b: Buchung[]): Buchung[] {
  return b.filter((x) => x.offen);
}

/** Summe dessen, was noch aussteht. */
export function offenCents(b: Buchung[]): number {
  return offeneBuchungen(b).reduce((s, x) => s + (x.betragCents ?? 0), 0);
}

/**
 * Rohdaten aus einer JSON_AGG-Spalte in Buchungen wandeln.
 *
 * ── WARUM NICHT EINE ABFRAGE JE KUNDE ──────────────────────────────────────
 * Eine Arbeitsliste hat bis zu zweihundert Zeilen. Zweihundert Abfragen nach
 * Oregon wären vierzig Sekunden. Die Liste holt die Rohdaten deshalb in einem
 * Rutsch mit; diese Funktion macht daraus dieselben Buchungen wie
 * `buchungenVon` — ohne eine zweite Definition.
 */
export function aufbereiten(roh: unknown): Buchung[] {
  const zeilen = Array.isArray(roh) ? roh : [];
  return zeilen.map((r: any) => {
    const zahlung = String(r.payment_status ?? "");
    const bezahlt = zahlung === "paid";
    const erledigt = !!r.cancelled_at || !!r.refunded_at
      || zahlung === "cancelled" || zahlung === "refunded";
    return {
      ref: String(r.ref),
      art: artVon(r.ref, r.pack_key, r.pack_name, r.amount_due),
      bezeichnung: String(r.pack_name ?? "").split("\n")[0].trim()
        || (String(r.ref).includes("SCHUFA") ? "Bonitätsauskunft" : "Ohne Bezeichnung"),
      packKey: r.pack_key ?? null,
      // ── DER BETRAG KOMMT AUS DEM PAKET, WENN ER FEHLT ─────────────────
      // Gemessen: Von 1.140 Bestellungen mit fertigem Antrag hatten ZWEI einen
      // `amount_due`. Die Karte zeigte deshalb „Offen insgesamt: 0,00 €",
      // obwohl 59,99 € offen sind — eine Zahl, die schlimmer ist als keine.
      //
      // Der Paketpreis ist dieselbe Quelle, aus der `rechnungStellen` den
      // Betrag setzt (server/lib/fiaon-rechnung-stellen.ts). Zwei Wege zum
      // selben Wert wären zwei Gelegenheiten, sich zu widersprechen.
      betragCents: r.amount_due != null && Number(r.amount_due) > 0
        ? Math.round(Number(r.amount_due) * 100)
        : (r.pack_key ? PAKET_PREIS_CENTS[String(r.pack_key)] ?? null : null),
      zahlungsstand: zahlung || null,
      zahlungText: ZAHLUNG_TEXT[zahlung] ?? (zahlung || "unbekannt"),
      bezahlt,
      offen: !bezahlt && !erledigt,
      gestelltAm: r.created_at ? String(r.created_at).slice(0, 10) : null,
      faelligAm: r.payment_due_date ? String(r.payment_due_date).slice(0, 10) : null,
      verwendungszweck: r.payment_reference ?? null,
      status: r.status ?? null,
      erledigt,
    };
  });
}
