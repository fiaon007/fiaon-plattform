// ═══════════════════════════════════════════════════════════════════════════
// FIAON Kontakt-Ergebnis — EINE Wahrheit für „Heute" und „Meine Kunden"
//
// DER GEMELDETE FEHLER
// Ein Agent dokumentiert in „Meine Kunden" ein Ergebnis („nicht erreicht",
// „zahlt am …"). In „Heute" steht derselbe Kunde weiter als heute fällig.
//
// DIE URSACHE
// Es gab zwei Schreibwege in zwei Tabellen:
//   „Meine Kunden" → fiaon_contact_log + fiaon_applications.promised_pay_date
//   „Heute"        → fiaon_contact_log + fiaon_persons.follow_up_date /
//                    .promised_payment_date / .is_blocked / .unreachable_count
// Die Tagesliste filtert ausschließlich auf `fiaon_persons`. Ein Ergebnis aus
// „Meine Kunden" hat diese Spalten nie angefasst — also blieb der Kunde stehen.
// Gemessen am 04.08.2026: 890 dokumentierte Ergebnisse aus 14 Tagen, bei denen
// die Person weiter in der Tagesliste hing. Das ist kein Anzeigefehler, das ist
// doppelte Arbeit für jeden Agenten, jeden Tag.
//
// DIE LÖSUNG
// Diese Datei. Beide Wege rufen `ergebnisAnwenden` auf; hier und nur hier steht,
// was ein Ergebnis für den Zustand einer Person bedeutet. Eine zweite Kopie
// dieser Regeln würde irgendwann abweichen — genau so ist der Fehler entstanden.
//
// DIE ZUORDNUNG (bewusst, nicht beliebig)
//   erreicht_zahlt_gleich  Zusage = heute, Wiedervorlage = morgen.
//                          Der Kunde sagt „ich zahle sofort" — morgen sieht man,
//                          ob Geld kam. Ohne Wiedervorlage fällt der Fall raus.
//   erreicht_zahlt_am      Zusage = genanntes Datum, Wiedervorlage = Tag danach.
//   erreicht_abgelehnt     Gesperrt. Aus jeder Anrufliste, Wiedervorlage und
//                          Zusage gelöscht. Ein „nein" muss nicht dreimal
//                          erklärt werden.
//   nicht_erreicht         Zähler +1, Wiedervorlage morgen (oder gewählt).
//   mailbox                Wie nicht erreicht — aber als Mailbox dokumentiert.
//                          Der Kunde weiß jetzt von uns; Wiedervorlage in zwei
//                          Tagen statt morgen, damit er zurückrufen kann.
//   rueckruf_termin        Wiedervorlage = Termin. Zusage bleibt unberührt: ein
//                          Rückruf ist keine Zahlungsvereinbarung.
//   nummer_falsch          Wiedervorlage +3 Tage (die Nummer-Update-Mail
//                          braucht Zeit). NICHT sperren — der Kunde will
//                          vielleicht zahlen, wir erreichen ihn nur nicht.
//   notiz                  Ändert keinen Zustand. Eine Notiz ist kein Ergebnis.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

export const ERGEBNISSE = [
  "erreicht_zahlt_gleich",
  "erreicht_zahlt_am",
  "erreicht_abgelehnt",
  "nicht_erreicht",
  "mailbox",
  "rueckruf_termin",
  "nummer_falsch",
] as const;
export type Ergebnis = (typeof ERGEBNISSE)[number];

export function istErgebnis(v: unknown): v is Ergebnis {
  return typeof v === "string" && (ERGEBNISSE as readonly string[]).includes(v);
}

/** Klartext für Oberfläche, Protokoll und Meldungen — eine Quelle für alle. */
export const ERGEBNIS_TEXT: Record<Ergebnis, string> = {
  erreicht_zahlt_gleich: "Erreicht — zahlt sofort",
  erreicht_zahlt_am: "Erreicht — zahlt am …",
  erreicht_abgelehnt: "Erreicht — abgelehnt",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Falsche Nummer",
};

/** Braucht dieses Ergebnis ein Datum? */
export function brauchtDatum(e: Ergebnis): "zusage" | "termin" | null {
  if (e === "erreicht_zahlt_am") return "zusage";
  if (e === "rueckruf_termin") return "termin";
  return null;
}

export interface ErgebnisEingabe {
  /** Bestellung, an der der Verlauf hängt. */
  ref: string | null;
  /** Person, deren Zustand sich ändert. Fehlt sie, wird sie über `ref` gesucht. */
  personId?: number | null;
  ergebnis: Ergebnis;
  /** Bei „zahlt am": das zugesagte Datum (JJJJ-MM-TT). */
  zusageDatum?: string | null;
  /** Bei „Rückruf": der vereinbarte Termin (JJJJ-MM-TT oder ISO-Zeitpunkt). */
  terminDatum?: string | null;
  /** Frei gewählte Wiedervorlage (überschreibt die Vorgabe der Regel). */
  wiedervorlage?: string | null;
}

export interface ErgebnisWirkung {
  /** Was mit der Person passiert ist — für die Rückmeldung an den Agenten. */
  wiedervorlage: string | null;
  zusage: string | null;
  gesperrt: boolean;
  /** Kurzsatz, den die Oberfläche anzeigen kann. */
  meldung: string;
}

function tagPlus(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nurDatum(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Wendet ein Kontakt-Ergebnis auf den Zustand von Person UND Bestellung an.
 *
 * Schreibt bewusst NICHT ins Kontaktprotokoll — das erledigt der jeweilige
 * Aufrufer, weil dort die Herkunft (Agent, Notiz, Zeitstempel) bekannt ist.
 * Diese Funktion beantwortet nur die Frage: „Was heißt das für die Tagesliste?"
 */
export async function ergebnisAnwenden(e: ErgebnisEingabe): Promise<ErgebnisWirkung> {
  const { ergebnis } = e;
  let personId = e.personId ?? null;
  if (!personId && e.ref) {
    const [row] = await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${e.ref}`;
    personId = row?.person_id ?? null;
  }

  const zusageEingabe = nurDatum(e.zusageDatum);
  const terminEingabe = nurDatum(e.terminDatum);
  const gewaehlt = nurDatum(e.wiedervorlage);

  let zusage: string | null | undefined;   // undefined = unverändert
  let wiedervorlage: string | null | undefined;
  let gesperrt = false;
  let zaehlerHoch = false;
  let meldung = ERGEBNIS_TEXT[ergebnis];

  switch (ergebnis) {
    case "erreicht_zahlt_gleich":
      zusage = tagPlus(0);
      wiedervorlage = gewaehlt || tagPlus(1);
      meldung = "Zahlt sofort — morgen prüfen wir den Eingang.";
      break;
    case "erreicht_zahlt_am":
      zusage = zusageEingabe;
      wiedervorlage = gewaehlt || (zusageEingabe ? nurDatum(new Date(`${zusageEingabe}T12:00:00Z`).getTime() + 86_400_000) : tagPlus(1));
      meldung = zusageEingabe ? `Zusage für den ${zusageEingabe} gespeichert.` : "Zusage gespeichert.";
      break;
    case "erreicht_abgelehnt":
      // Aus jeder Liste. Zusage und Wiedervorlage werden gelöscht, sonst käme
      // der Kunde über die Tagesliste zurück und würde erneut angerufen.
      gesperrt = true;
      zusage = null;
      wiedervorlage = null;
      meldung = "Abgelehnt — der Kunde erscheint in keiner Anrufliste mehr.";
      break;
    case "nicht_erreicht":
      zaehlerHoch = true;
      wiedervorlage = gewaehlt || tagPlus(1);
      meldung = `Nicht erreicht — morgen erneut${gewaehlt ? ` (Wiedervorlage ${gewaehlt})` : ""}.`;
      break;
    case "mailbox":
      zaehlerHoch = true;
      wiedervorlage = gewaehlt || tagPlus(2);
      meldung = "Mailbox besprochen — in zwei Tagen erneut, damit er zurückrufen kann.";
      break;
    case "rueckruf_termin":
      wiedervorlage = terminEingabe || gewaehlt || tagPlus(1);
      meldung = terminEingabe ? `Rückruf am ${terminEingabe} vorgemerkt.` : "Rückruf vorgemerkt.";
      break;
    case "nummer_falsch":
      wiedervorlage = gewaehlt || tagPlus(3);
      meldung = "Falsche Nummer notiert — der Kunde wird per E-Mail um seine Nummer gebeten.";
      break;
  }

  // ── Person: der Zustand, auf den die Tagesliste schaut ────────────────────
  // Nur die Felder anfassen, die diese Regel wirklich betrifft: `undefined`
  // heißt „unverändert", `null` heißt ausdrücklich „löschen". Ein pauschales
  // Überschreiben aller Spalten würde bei „Rückruf" die Zahlungszusage
  // stillschweigend entfernen.
  if (personId) {
    const patch: Record<string, any> = { updated_at: new Date() };
    if (zusage !== undefined) patch.promised_payment_date = zusage;
    if (wiedervorlage !== undefined) patch.follow_up_date = wiedervorlage;
    if (gesperrt) patch.is_blocked = true;
    await sqlPool`UPDATE fiaon_persons SET ${sqlPool(patch)} WHERE id = ${personId}`;
    // Der Zähler verweist auf sich selbst und geht deshalb nicht als Wert mit.
    if (zaehlerHoch) {
      await sqlPool`
        UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1 WHERE id = ${personId}
      `;
    }
  }

  // ── Bestellung: dieselbe Zusage, damit Verwaltung und Portal übereinstimmen ─
  if (e.ref && zusage !== undefined) {
    await sqlPool`
      UPDATE fiaon_applications SET promised_pay_date = ${zusage}, updated_at = NOW()
      WHERE ref = ${e.ref}
    `;
  }

  return {
    wiedervorlage: wiedervorlage ?? null,
    zusage: zusage ?? null,
    gesperrt,
    meldung,
  };
}
