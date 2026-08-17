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
//   nummer_blockiert       Der Kunde hat DIESE Nummer blockiert. Kein Sperren,
//                          keine Wiedervorlage beim bisherigen Agenten: Der
//                          Kunde wechselt den Betreuer (siehe fiaon-uebergabe).
//                          Für den neuen Betreuer steht die Wiedervorlage auf
//                          heute — er soll gleich anrufen, solange der Fall
//                          frisch ist. Gemeldet 06.08.2026: „manche Kunden
//                          blockieren die Nummer eines Agenten, heben beim
//                          anderen aber ab."
//   notiz                  Ändert keinen Zustand. Eine Notiz ist kein Ergebnis.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinPlusTage } from "./fiaon-time";

export const ERGEBNISSE = [
  "erreicht_zahlt_gleich",
  "erreicht_zahlt_am",
  "erreicht_abgelehnt",
  // ══════════════════════════════════════════════════════════════════════════
  // ERREICHT, ABER OHNE KLARES ERGEBNIS
  //
  // Ein Agent (11.08.2026): „Mir fehlt ein Status fuer Kunden, die ich erreicht
  // habe, bei denen aber noch kein klares Ergebnis wie ‚Zahlt sofort', ‚Zahlt
  // am …', ‚Rueckruf' oder ‚Abgelehnt' vorliegt. Es gibt zwar bereits die
  // Notizfunktion, aber wenn ich nur eine Notiz hinterlege, zaehlt der Kunde
  // nicht als angerufen/bearbeitet, obwohl ein Gespraech stattgefunden hat."
  //
  // Er hat recht: Eine Notiz ist ein Vermerk, kein Ergebnis. Der Zaehler
  // „heute bearbeitet" sah sie nicht, und der Kunde stand morgen wieder oben.
  //
  // Dieses Ergebnis zaehlt als Gespraech, setzt aber KEINE Zusage und KEINE
  // Sperre — nur eine Wiedervorlage in drei Tagen. Wer ein Gespraech ohne
  // Ergebnis hatte, braucht Zeit, aber er darf nicht vergessen werden.
  // ══════════════════════════════════════════════════════════════════════════
  "erreicht_sonstiges",
  "nicht_erreicht",
  "mailbox",
  "rueckruf_termin",
  "nummer_falsch",
  "nummer_blockiert",
] as const;
export type Ergebnis = (typeof ERGEBNISSE)[number];

export function istErgebnis(v: unknown): v is Ergebnis {
  return typeof v === "string" && (ERGEBNISSE as readonly string[]).includes(v);
}

// ═══════════════════════════════════════════════════════════════════════════
// WELCHE ERGEBNISSE EINE NOTIZ BRAUCHEN — UND ZWAR SERVERSEITIG
//
// ── DER BEFUND (24.08.2026) ────────────────────────────────────────────────
// „Erreicht — Sonstiges" heißt wörtlich: „Ich habe mit ihm gesprochen, aber es
// passt in keine Schublade." Ohne Notiz ist das kein Ergebnis, sondern ein
// verlorenes Gespräch — der nächste Anrufer fängt bei Null an.
//
// Die Pflicht stand in der OBERFLÄCHE, und zwar an zwei von drei Stellen:
//   client/src/components/Softphone.tsx        notizPflicht: true   ✔
//   client/src/pages/agent/kunden-neu.tsx      braucht: "notiz"     ✔
//   client/src/pages/agent/kunden.tsx          — nichts —           ✘
//
// Der Listen-Weg kam also ohne Notiz durch. Und jeder direkte Aufruf der Route
// ebenfalls.
//
// ── DIE REGEL AUS AGENTS.MD ────────────────────────────────────────────────
// „Die Grenze steht in der WHERE-Bedingung, nicht in der Oberfläche." Eine
// Pflicht, die drei Oberflächen einzeln kennen müssen, wird an der vierten
// vergessen. Sie steht jetzt HIER, einmal — und die Oberflächen lesen sie.
// ═══════════════════════════════════════════════════════════════════════════

/** Mindestlänge einer Pflichtnotiz. Kürzer ist keine Auskunft, sondern ein Haken. */
export const NOTIZ_MINDESTLAENGE = 10;

/**
 * Ergebnisse, die ohne Notiz nichts aussagen.
 *
 * Bewusst KURZ gehalten: Jede weitere Pflicht ist eine Hürde, und Hürden
 * erzeugen Ausweichverhalten (dann klickt jemand „nicht erreicht", weil das
 * schneller geht — und die Statistik ist verdorben).
 */
export const BRAUCHT_NOTIZ: ReadonlySet<Ergebnis> = new Set<Ergebnis>([
  "erreicht_sonstiges",
]);

/**
 * Prüft die Notizpflicht. Gibt `null` zurück, wenn alles in Ordnung ist,
 * sonst den Satz, der dem Mitarbeiter angezeigt wird.
 */
export function pruefeNotiz(ergebnis: string, notiz: unknown): string | null {
  if (!BRAUCHT_NOTIZ.has(ergebnis as Ergebnis)) return null;
  const text = String(notiz ?? "").trim();
  if (text.length >= NOTIZ_MINDESTLAENGE) return null;
  return `Für „${ERGEBNIS_TEXT[ergebnis as Ergebnis] ?? ergebnis}" braucht es eine Notiz `
    + `(mindestens ${NOTIZ_MINDESTLAENGE} Zeichen). Ohne sie ist das Gespräch verloren — `
    + "der nächste Anrufer fängt bei Null an.";
}

/** Klartext für Oberfläche, Protokoll und Meldungen — eine Quelle für alle. */
export const ERGEBNIS_TEXT: Record<Ergebnis, string> = {
  erreicht_zahlt_gleich: "Erreicht — zahlt sofort",
  erreicht_zahlt_am: "Erreicht — zahlt am …",
  erreicht_abgelehnt: "Erreicht — abgelehnt",
  erreicht_sonstiges: "Erreicht — Sonstiges",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Falsche Nummer",
  nummer_blockiert: "Anrufer blockiert",
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
  /**
   * Was die Nicht-erreicht-Automatik zusätzlich getan hat (Terminlink-Mail,
   * Ruhe-Pool). `null`, wenn nichts geschah — der Normalfall.
   */
  automatik?: import("./fiaon-nicht-erreicht").AutomatikWirkung | null;
}

// Die Rechnung selbst steht seit dem 10.08.2026 in fiaon-time.ts — dem Ort,
// an dem laut Hausregel alle Berlin-Zeit-Arithmetik wohnt. Hier bleibt nur der
// kurze Name, den die Regeln unten benutzen.
const tagPlus = (n: number): string => berlinPlusTage(n);

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
export async function ergebnisAnwenden(
  e: ErgebnisEingabe,
  /**
   * Verbindung oder Transaktion.
   *
   * Bis zum 10.08.2026 schrieb diese Funktion fest gegen `sqlPool`. Das machte
   * sie als einzige Schreibstelle im Haus UNPRÜFBAR: Ein Prüfstand, der seine
   * Testdaten in einer zurückgerollten Transaktion anlegt, konnte sie nicht
   * aufrufen — die Person existierte aus ihrer Sicht gar nicht, jedes UPDATE
   * traf null Zeilen, und der Prüfstand meldete stillschweigend „Zähler nicht
   * gestiegen". Genau so ist es passiert.
   *
   * Der Vorgabewert hält alle bestehenden Aufrufer unverändert.
   */
  lauf: any = sqlPool,
): Promise<ErgebnisWirkung> {
  const { ergebnis } = e;
  let personId = e.personId ?? null;
  if (!personId && e.ref) {
    const [row] = await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${e.ref}`;
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
    case "erreicht_sonstiges":
      // Erreicht heisst: der Zaehler „nicht erreicht" wird NICHT hochgezaehlt,
      // und der Ruhe-Pool bleibt aussen vor. Es war ja ein Gespraech.
      //
      // Drei Tage Wiedervorlage: Zwei waeren zu hektisch fuer ein Gespraech
      // ohne Ergebnis, eine Woche zu lang, um den Faden zu halten.
      wiedervorlage = gewaehlt || tagPlus(3);
      meldung = "Gespraech festgehalten — in drei Tagen wieder auf der Liste.";
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
    case "nummer_blockiert":
      // Heute, nicht morgen: Der neue Betreuer soll noch am selben Tag
      // anrufen. Eine Wiedervorlage auf morgen würde den Kunden erst einmal
      // aus jeder Liste nehmen — und genau das ist bei einem Menschen, der
      // grundsätzlich rangeht, die teuerste Verzögerung.
      wiedervorlage = gewaehlt || tagPlus(0);
      meldung = "Anrufer blockiert — der Kunde geht an einen Kollegen.";
      break;
  }

  // ── BESITZSCHUTZ: Betreuung festhalten ────────────────────────────────────
  // Ein dokumentiertes Ergebnis ist der Nachweis, dass dieser Kunde betreut
  // wird. Ab hier darf ihn keine Automatik mehr umverteilen. Der Zeitpunkt wird
  // nur beim ERSTEN Mal gesetzt (COALESCE) — er markiert den Beginn, nicht den
  // letzten Anruf.
  if (personId) {
    const { betreuungMerken } = await import("./tier");
    await betreuungMerken(lauf, { personId });
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
    await lauf`UPDATE fiaon_persons SET ${lauf(patch)} WHERE id = ${personId}`;
    // Der Zähler verweist auf sich selbst und geht deshalb nicht als Wert mit.
    if (zaehlerHoch) {
      await lauf`
        UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1 WHERE id = ${personId}
      `;
    }
  }

  // ── Bestellung: dieselbe Zusage, damit Verwaltung und Portal übereinstimmen ─
  if (e.ref && zusage !== undefined) {
    await lauf`
      UPDATE fiaon_applications SET promised_pay_date = ${zusage}, updated_at = NOW()
      WHERE ref = ${e.ref}
    `;
  }

  // ── Nicht-erreicht-Automatik ──────────────────────────────────────────────
  // Zwei Richtungen, beide hier, weil hier JEDES Ergebnis vorbeikommt:
  //   erreicht_*        Der Kunde hat sich gemeldet → Zähler und Ruhe zurück.
  //   nicht erreicht    Zähler wurde eben erhöht → Schwellen prüfen (Mail bei 2,
  //                     Ruhe bei 4). Die Regeln stehen in fiaon-nicht-erreicht.ts.
  //
  // „Abgelehnt" setzt den Zähler ebenfalls zurück: Der Mensch war am Apparat,
  // er hat nur nein gesagt. Er ist gesperrt, nicht unerreichbar — und wenn er
  // später doch bestellt, soll er nicht mit einer Altlast von vier
  // Fehlversuchen starten.
  let automatik: import("./fiaon-nicht-erreicht").AutomatikWirkung | null = null;
  if (personId) {
    const istErreicht = ergebnis.startsWith("erreicht_");
    if (istErreicht) {
      const { erreichtZuruecksetzen } = await import("./fiaon-nicht-erreicht");
      await erreichtZuruecksetzen(personId, lauf);
    } else if (zaehlerHoch) {
      const { automatikNachFehlversuch } = await import("./fiaon-nicht-erreicht");
      automatik = await automatikNachFehlversuch(personId, lauf);
      if (automatik.wiedervorlage) wiedervorlage = automatik.wiedervorlage;
      if (automatik.hinweis) meldung = `${meldung} ${automatik.hinweis}`;
    }
  }

  return {
    wiedervorlage: wiedervorlage ?? null,
    zusage: zusage ?? null,
    gesperrt,
    meldung,
    automatik,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VOLLSTÄNDIGE NACHBEREITUNG — ein Ergebnis ist mehr als ein Zustand
//
// ── DER BEFUND (16.08.2026) ────────────────────────────────────────────────
// Team: „‚Nicht erreicht' aus dem Telefon-Panel wirkt nicht auf die
// Kundenliste; über die Liste direkt schon."
//
// Vermutet war, das Panel rufe `ergebnisAnwenden` nicht auf. Es RUFT es auf.
// Der Unterschied liegt woanders: Die Listenroute tut FÜNF Dinge, das Panel
// nur eines.
//
//   1. Verlaufseintrag in `fiaon_contact_log`          ← fehlte im Panel
//   2. `ergebnisAnwenden` (Zähler, Wiedervorlage)      ← hatte das Panel
//   3. „Falsche Nummer" → Nummern-Mail an den Kunden   ← fehlte im Panel
//   4. „Blockiert" → Übergabe an den nächsten Betreuer ← fehlte im Panel
//   5. Nachschub für die Liste des Agenten             ← fehlte im Panel
//
// `ergebnisAnwenden` schreibt bewusst KEINEN Verlaufseintrag — das taten die
// Listenrouten selbst. Genau daran ist es auseinandergelaufen.
//
// GEMESSEN: 554 von 842 Anrufen mit festgehaltenem Ergebnis haben KEINEN
// Verlaufseintrag beim Kunden. Der Agent hat dokumentiert, die Akte weiß
// nichts davon. Am teuersten sind die Rückrufe: Ohne Verlaufseintrag mit
// `scheduled_at` erscheint ein vereinbarter Rückruf NIE im Kalender und NIE
// in der Erinnerungsleiste — er ist verloren. Drei solche Fälle gemessen.
//
// Ab hier gibt es EINE Kette, und beide Wege gehen sie.
// ═══════════════════════════════════════════════════════════════════════════

export interface NachbereitungEingabe {
  ref: string;
  personId: number;
  /** null = reine Notiz, ändert keinen Zustand. */
  ergebnis: Ergebnis | null;
  notiz?: string | null;
  zusageDatum?: string | null;
  /** Voller Zeitpunkt „JJJJ-MM-TTTHH:MM:SS" — Berliner Wandzeit. */
  terminZeitpunkt?: string | null;
  wiedervorlage?: string | null;
  akteur: { id: number | null; name: string };
  /** Woher der Klick kam — steht im Verlauf, damit man beide Wege unterscheiden kann. */
  herkunft?: "liste" | "telefon" | "vertrieb";
}

export interface NachbereitungErgebnis {
  wirkung: ErgebnisWirkung | null;
  nummerMail?: { sent: boolean; reason?: string };
  uebergabe?: { ok: boolean; an: string | null; grund: string };
  meldung: string;
}

/**
 * Die ganze Kette: Verlauf, Zustand, Nummern-Mail, Übergabe, Nachschub.
 *
 * Wirft nie für die Nebenwirkungen — ein klemmender Nachschub darf ein
 * dokumentiertes Ergebnis nicht zurücknehmen.
 */
export async function ergebnisNachbereiten(
  ein: NachbereitungEingabe,
): Promise<NachbereitungErgebnis> {
  const { parseBerlinInput } = await import("./fiaon-time");
  const istNotiz = ein.ergebnis == null;

  // ── 1. DER VERLAUFSEINTRAG ────────────────────────────────────────────
  // Er ist das, was ein Mensch später liest. Ohne ihn hat der Kunde in der
  // Akte kein Ergebnis, und ein Rückruf bekommt keinen Kalendereintrag.
  await sqlPool`
    INSERT INTO fiaon_contact_log
      (ref, agent_id, agent_name, type, outcome, note, promised_date, scheduled_at, created_at)
    VALUES (${ein.ref}, ${ein.akteur.id}, ${ein.akteur.name},
            ${istNotiz ? "note" : "result"}, ${ein.ergebnis},
            ${ein.notiz ? String(ein.notiz).slice(0, 4000) : null},
            ${parseBerlinInput(ein.zusageDatum ?? null)},
            ${parseBerlinInput(ein.terminZeitpunkt ?? null)}, NOW())
  `;

  // ── 2. DER ZUSTAND ────────────────────────────────────────────────────
  let wirkung: ErgebnisWirkung | null = null;
  if (ein.ergebnis) {
    wirkung = await ergebnisAnwenden({
      ref: ein.ref, personId: ein.personId, ergebnis: ein.ergebnis,
      zusageDatum: ein.zusageDatum ?? null,
      terminDatum: ein.terminZeitpunkt ?? null,
      wiedervorlage: ein.wiedervorlage ?? null,
    });
  } else if (ein.wiedervorlage) {
    await sqlPool`
      UPDATE fiaon_persons SET follow_up_date = ${ein.wiedervorlage}::date, updated_at = NOW()
      WHERE id = ${ein.personId}
    `;
  }

  // ── 3. „FALSCHE NUMMER" BITTET DEN KUNDEN UM SEINE NUMMER ─────────────
  let nummerMail: { sent: boolean; reason?: string } | undefined;
  if (ein.ergebnis === "nummer_falsch") {
    try {
      const [c] = (await sqlPool`
        SELECT COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email,
               COALESCE(first_name, contact_name) AS first_name
        FROM fiaon_applications WHERE ref = ${ein.ref}
      `) as any[];
      const { maybeSendNumberUpdateMail } = await import("../fiaon-number-update");
      nummerMail = await maybeSendNumberUpdateMail("app", ein.ref, {
        email: c?.email, firstName: c?.first_name,
      });
      // ── DER WARTEZUSTAND ───────────────────────────────────────────────
      // Ging die Bitte raus, wartet der Fall auf den KUNDEN. GEMESSEN: 185
      // verschickte Anfragen ohne Antwort standen weiter jeden Tag in der
      // Arbeitsliste, 120 davon länger als sieben Tage. Eine Karte, bei der
      // man nichts tun kann, lehrt das Überblättern.
      if (nummerMail?.sent) {
        const { wartenAufKunde } = await import("./fiaon-warten");
        await wartenAufKunde(ein.personId, "nummer");
      }
    } catch (e) {
      console.error("[ERGEBNIS] Nummern-Mail:", e);
    }
  }

  // ── 4. „BLOCKIERT" GIBT DEN KUNDEN WEITER ─────────────────────────────
  let uebergabe: { ok: boolean; an: string | null; grund: string } | undefined;
  if (ein.ergebnis === "nummer_blockiert" && ein.akteur.id) {
    try {
      const { uebergabeAnNaechsten } = await import("./fiaon-uebergabe");
      const u = await uebergabeAnNaechsten(ein.personId, ein.akteur.id, ein.akteur.name);
      uebergabe = { ok: u.ok, an: u.neuerAgentName, grund: u.grund };
    } catch (e) {
      console.error("[ERGEBNIS] Übergabe:", e);
    }
  }

  // ── 5. NACHSCHUB ──────────────────────────────────────────────────────
  // Wer einen Fall abschließt, verliert eine Karte. Ohne Nachschub bestraft
  // die Ehrlichkeit den Fleißigen mit einer kürzeren Liste.
  if (ein.akteur.id && (uebergabe?.ok
      || ein.ergebnis === "erreicht_abgelehnt"
      || ein.ergebnis === "erreicht_zahlt_gleich"
      || ein.ergebnis === "erreicht_zahlt_am")) {
    void import("../routes/fiaon-followup")
      .then((m) => m.nachschub(ein.akteur.id!))
      .catch((e) => console.error("[ERGEBNIS] Nachschub:", e));
  }

  return {
    wirkung,
    nummerMail,
    uebergabe,
    meldung: uebergabe
      ? (uebergabe.ok ? `Übergeben an ${uebergabe.an}. ${uebergabe.grund}` : uebergabe.grund)
      : (wirkung?.meldung || (istNotiz ? "Notiz gespeichert." : "Ergebnis festgehalten.")),
  };
}
