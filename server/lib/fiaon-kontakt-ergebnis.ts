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
// ── E-IT-A (08.10.2026): Die DATEN der Wiedervorlage stehen nicht mehr hier,
// sondern in der einen Regel shared/fiaon-wiedervorlage.ts (naechsterVersuch):
// zahlt sofort +3 Werktage, zahlt am X → Werktag nach X, Sonstiges +3 Werktage,
// nicht erreicht/Mailbox nach Staffel (+2, +3, +5 Werktage, +7 Tage, ab dem
// 6. Fehlversuch 14 Tage Pause, ab dem 9. ruhend; Stufe A höchstens
// 3 Werktage). Die Liste unten bleibt als Begründung der ARTEN stehen; ihre
// alten Tageszahlen gelten nicht mehr.
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
import { berlinToday } from "./fiaon-time";
import {
  naechsterVersuch, nurIsoDatum, istFehlversuch, ENTPRELLUNG_MINUTEN,
  type WiedervorlageGrund,
} from "@shared/fiaon-wiedervorlage";

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE STEHT IN `shared/` (19.08.2026)
//
// Hier lag eine von FÜNF Fassungen: Server, Softphone, kunden-neu,
// kontakt-ergebnis.tsx (ohne „Sonstiges") und kunden.tsx (gelöscht). Deshalb
// kam dieselbe Meldung dreimal — jede Fassung kannte einen anderen Stand der
// Notizpflicht.
//
// Die Werte, die Beschriftungen, die Notizpflicht und ihre Prüfung stehen jetzt
// EINMAL in `shared/fiaon-kontakt-ergebnis-liste.ts`. Diese Datei behält, was
// nur der Server weiß: was ein Ergebnis für den ZUSTAND einer Person bedeutet.
//
// Die Ausfuhr bleibt bestehen — 40 Stellen importieren `ERGEBNISSE` und
// `ERGEBNIS_TEXT` von hier. Ein entfernter Export ließe Importe ins Leere
// laufen (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════
import {
  ERGEBNISSE, ERGEBNIS_TEXT, BRAUCHT_NOTIZ, NOTIZ_MINDESTLAENGE,
  brauchtDatum, istErgebnis, pruefeNotiz, type Ergebnis,
} from "../../shared/fiaon-kontakt-ergebnis-liste";

// Ein `export … from` allein reicht nicht: Die Namen kämen dann nicht in den
// LOKALEN Sichtbereich, und `ERGEBNIS_TEXT[ergebnis]` weiter unten wäre
// undefiniert. Also erst importieren, dann weiterreichen.
export {
  ERGEBNISSE, ERGEBNIS_TEXT, BRAUCHT_NOTIZ, NOTIZ_MINDESTLAENGE,
  brauchtDatum, istErgebnis, pruefeNotiz, type Ergebnis,
};

// ── DIE NOTIZPFLICHT GILT WEITER, UND ZWAR SERVERSEITIG ───────────────────
// `pruefeNotiz` wird oben aus `shared/` durchgereicht und in jeder Route
// aufgerufen, die ein Ergebnis annimmt. Die Oberfläche muss sie damit nicht
// ERZWINGEN, aber SAGEN (Zeichenzähler, Begründung) — genau so steht es in
// AGENTS.md. Der Unterschied ist nicht Bequemlichkeit: Ein direkter Aufruf der
// Route kommt sonst ohne Notiz durch.

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
  /**
   * E-IT-A (Gegenprüfung 08.10.2026): Der Tag, an dem der Versuch WIRKLICH
   * stattfand — nur der Tagesbericht-Nachtrag setzt ihn (Bericht für Montag,
   * abgegeben am Dienstag). Die Regel rechnet dann ab diesem Tag; nie später
   * als heute. Fehlt er, gilt heute.
   */
  amTag?: string | null;
}

export interface ErgebnisWirkung {
  /** Was mit der Person passiert ist — für die Rückmeldung an den Agenten. */
  wiedervorlage: string | null;
  zusage: string | null;
  gesperrt: boolean;
  /** Kurzsatz, den die Oberfläche anzeigen kann. */
  meldung: string;
  /** E-IT-A: Warum und wann wieder — aus der einen Regel (shared/fiaon-wiedervorlage.ts). */
  grund?: WiedervorlageGrund;
  /** E-IT-A: „Wieder dran am Mi 15.10. · Zahlung prüfen" */
  text?: string;
  /** E-IT-A: false, wenn derselbe Fehlversuch binnen 30 Minuten schon gezählt war. */
  gezaehlt?: boolean;
  /**
   * Was die Nicht-erreicht-Automatik zusätzlich getan hat (Terminlink-Mail,
   * Ruhe-Pool). `null`, wenn nichts geschah — der Normalfall.
   */
  automatik?: import("./fiaon-nicht-erreicht").AutomatikWirkung | null;
}

// ── DER DATUMSFEHLER BEI „ZAHLT AM" (E-IT-A, 08.10.2026) ──────────────────
// Hier stand nurDatum(new Date(…).getTime() + 86_400_000) — eine ZAHL. Daraus
// wurde kein Datum, sondern null: „Zahlt am" über Akte oder Softphone setzte
// die Wiedervorlage auf NULL (gemessen: 8 von 9 Menschen). Verdeckt hat es nur
// der Lesefilter „Zusage in der Zukunft". Die Rechnung macht jetzt die eine
// Regel; nurDatum nimmt nur noch Text („JJJJ-MM-TT" oder ein Zeitstempel).
function nurDatum(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : berlinToday(v);
  const s = String(v ?? "").trim();
  if (!s) return null;
  return nurIsoDatum(s);
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
  const heuteEcht = berlinToday();
  const amTag = nurDatum(e.amTag);
  const heute = amTag && amTag < heuteEcht ? amTag : heuteEcht;

  let zusage: string | null | undefined;   // undefined = unverändert
  let wiedervorlage: string | null | undefined;
  let gesperrt = false;
  const zaehlerHoch = istFehlversuch(ergebnis);

  // ── DER FEHLVERSUCH WIRD ZUERST GEZÄHLT (E-IT-A, 08.10.2026) ──────────────
  // Die Staffel hängt am Zählerstand NACH diesem Versuch. Gezählt wird
  // entprellt (fiaon-fehlversuch.ts): Ein zweiter Fehlversuch binnen
  // 30 Minuten — Softphone UND Akte für denselben Anruf — zählt nicht noch
  // einmal, und die Automatik läuft dann auch nicht ein zweites Mal.
  let versuche = 0;
  let gezaehlt = true;
  let stufeA = false;
  let frisch = false;
  if (personId) {
    const { fehlversuchZaehlen, wiedervorlageKontext } = await import("./fiaon-fehlversuch");
    if (zaehlerHoch) {
      const z = await fehlversuchZaehlen(personId, lauf);
      versuche = z.versuche;
      gezaehlt = z.gezaehlt;
    }
    // Stufe A und Frische für JEDES Ergebnis (Gegenprüfung 08.10.2026): Vorher
    // nur bei Fehlversuchen — „Sonstiges" mit „in 2 Wochen" ließ einen Kunden
    // auf Stufe A 14 Tage warten, weil die Regel die Stufe nicht kannte.
    const k = await wiedervorlageKontext(personId, lauf);
    stufeA = k.stufeA;
    frisch = k.frisch;
  }

  // ── DIE EINE REGEL: WANN WIEDER? ──────────────────────────────────────────
  const regel = naechsterVersuch({
    ergebnis, heute, versucheNachher: versuche, stufeA, frisch,
    zusageDatum: zusageEingabe, terminDatum: terminEingabe, gewaehlt,
  });
  wiedervorlage = regel.datum;
  let meldung = ERGEBNIS_TEXT[ergebnis];

  switch (ergebnis) {
    case "erreicht_zahlt_gleich":
      zusage = heute;
      meldung = "Zahlt sofort. Falls kein Geld kommt:";
      break;
    case "erreicht_zahlt_am":
      zusage = zusageEingabe;
      meldung = zusageEingabe ? `Zusage für den ${zusageEingabe} gespeichert.` : "Zusage gespeichert.";
      break;
    case "erreicht_abgelehnt":
      // Aus jeder Liste. Zusage und Wiedervorlage werden gelöscht, sonst käme
      // der Kunde über die Tagesliste zurück und würde erneut angerufen.
      gesperrt = true;
      zusage = null;
      wiedervorlage = null;
      meldung = "Abgelehnt — keine Anrufliste, keine Zahlungserinnerung, keine Werbung mehr.";
      break;
    case "erreicht_sonstiges":
      // Erreicht heisst: der Zaehler „nicht erreicht" wird NICHT hochgezaehlt,
      // und der Ruhe-Pool bleibt aussen vor. Es war ja ein Gespraech.
      meldung = "Gespräch festgehalten.";
      break;
    case "nicht_erreicht":
    case "mailbox":
      meldung = gezaehlt
        ? `${ergebnis === "mailbox" ? "Mailbox besprochen" : "Nicht erreicht"} (${versuche}. Versuch).`
        : `${ergebnis === "mailbox" ? "Mailbox" : "Nicht erreicht"} — derselbe Versuch war in den letzten ${ENTPRELLUNG_MINUTEN} Minuten schon gezählt, er zählt nicht doppelt.`;
      // Ruhend (ab dem 9. Fehlversuch, nicht Stufe A) setzt die Automatik unten
      // — mit Verlaufseintrag. Hier bleibt die Wiedervorlage bis dahin stehen.
      if (regel.ruhend) wiedervorlage = undefined;
      break;
    case "rueckruf_termin":
      meldung = terminEingabe ? `Rückruf am ${terminEingabe} vorgemerkt.` : "Rückruf vorgemerkt.";
      break;
    case "nummer_falsch":
      meldung = "Falsche Nummer notiert — der Kunde wird per E-Mail um seine Nummer gebeten.";
      break;
    case "nummer_blockiert":
      // Heute, nicht morgen: Der neue Betreuer soll noch am selben Tag
      // anrufen. Eine Wiedervorlage auf morgen würde den Kunden erst einmal
      // aus jeder Liste nehmen — und genau das ist bei einem Menschen, der
      // grundsätzlich rangeht, die teuerste Verzögerung.
      meldung = "Anrufer blockiert — der Kunde geht an einen Kollegen.";
      break;
  }
  // Die Meldung sagt, wann der Mensch wieder dran ist — aus derselben Regel,
  // die das Datum gesetzt hat (Justin: „Kunde zahlt → am nächsten Tag wieder
  // da" darf nie wieder eine Überraschung sein).
  if (ergebnis !== "erreicht_abgelehnt" && ergebnis !== "nummer_blockiert" && !regel.ruhend) {
    meldung = `${meldung} ${regel.text}.`;
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
    // 06.09.2026: Ein zahlender Kunde wird durch „abgelehnt" nicht gesperrt — der
    // Vermerk bleibt im Verlauf, der Kunde bleibt in den Listen (fiaon-kunde-aktiv.ts).
    if (gesperrt) {
      const { istZahlenderKunde } = await import("./fiaon-kunde-aktiv");
      if (await istZahlenderKunde(personId)) meldung = "Abgelehnt festgehalten — als zahlender Kunde bleibt er in Ihren Listen.";
      else patch.is_blocked = true;
    }
    await lauf`UPDATE fiaon_persons SET ${lauf(patch)} WHERE id = ${personId}`;
    // ── ABGELEHNT HEISST ABGELEHNT — AUCH FÜR DIE AUTOMATIK (09.09.2026, E-168, Punkt 9) ──
    // Team: „Wenn ein Kunde ausdrücklich ablehnt, werden trotzdem weiter Rechnungen
    // und Zahlungsaufforderungen versendet." Bis heute setzte „erreicht — abgelehnt"
    // nur die Vertriebssperre (is_blocked); die Erinnerungs-Engine liest die nicht,
    // sondern mahnstopp_am, und die Rückholung/Werbung liest werbung_gesperrt_am.
    // Jetzt gilt der Status systemweit: Mahnstopp auf jede offene Bestellung, Werbe-
    // sperre auf die Person, Vermerk im Verlauf. Zahlende Kunden behalten ihre Raten
    // (das ist eine Kündigung, kein „kein Interesse").
    if (gesperrt) {
      const offen = (await lauf`
        UPDATE fiaon_applications SET mahnstopp_am = COALESCE(mahnstopp_am, NOW()), updated_at = NOW()
         WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
           AND payment_status IN ('pending', 'pending_payment', 'claimed_paid', 'expired')
         RETURNING ref`) as any[];
      await lauf`UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()), updated_at = NOW() WHERE id = ${personId}`;
      const refNote = e.ref || offen[0]?.ref || null;
      if (refNote) {
        await lauf`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
          VALUES (${refNote}, ${personId}, NULL, 'System', 'system',
                  ${`Kunde hat abgelehnt: automatische Zahlungserinnerungen gestoppt (${offen.length} offene Bestellung${offen.length === 1 ? "" : "en"}), Werbung gesperrt. Kein Anruf mehr aus der Pipeline.`},
                  NOW())`.catch(() => {});
      }
    }
    // Der Zähler wurde oben schon gezählt (entprellt, fehlversuchZaehlen).

    // ── EIN NEUES ERGEBNIS BEANTWORTET DEN ALTEN RÜCKRUF (E-IT-A) ──────────
    // Rückrufe galten nur über den Kalender-Knopf als erledigt. Gemessen am
    // 07.10.2026: 22 offene überfällige Rückrufe, 20 davon mit einem SPÄTEREN
    // Ergebnis — sie hielten ihren Rang in der Arbeitsliste auf Dauer. Wer
    // nach der vereinbarten Zeit ein Ergebnis bucht, hat den Rückruf geführt
    // (oder versucht). Künftige Rückrufe bleiben unberührt.
    await lauf`
      UPDATE fiaon_contact_log SET done_at = NOW()
       WHERE outcome = 'rueckruf_termin' AND done_at IS NULL AND voided_at IS NULL
         AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
         AND (person_id = ${personId}
              OR ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = ${personId}))`;
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
  //   nicht erreicht    Zähler wurde eben erhöht → Schwellen prüfen. Die Regeln
  //                     stehen in fiaon-nicht-erreicht.ts.
  //
  // ── DOKU-DRIFT KORRIGIERT (24.08.2026) ────────────────────────────────────
  // VORHER stand hier „Mail bei 2, Ruhe bei 4". Der Code sagt seit der neuen
  // Staffel `SCHWELLE_MAIL = 6` und `SCHWELLE_RUHEND = 9`
  // (server/lib/fiaon-nicht-erreicht.ts:90/94), dazu `SCHWELLE_STRECKEN = 3`.
  // NACHHER stehen die echten Werte da — geändert wurde nur der TEXT:
  //     ab dem 3. Versuch  Wiedervorlage +3 Tage
  //     ab dem 6. Versuch  Wiedervorlage +7 Tage UND Terminlink-Mail
  //     ab dem 9. Versuch  „Ruhend" — raus aus der Tagesliste
  // GRUND: Zwei Zahlen im Kommentar, zwei andere im Code — wer hier liest,
  // sucht den Fehler danach an der falschen Stelle.
  // E-IT-A (08.10.2026): Die Abstände oben gelten nicht mehr — die Staffel
  // steht in shared/fiaon-wiedervorlage.ts (+2/+3/+5 Werktage, +7 Tage, ab 6
  // 14 Tage Pause). Mail bei 6 und Ruhe bei 9 bleiben.
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
    } else if (zaehlerHoch && gezaehlt) {
      // E-IT-A: Die Wiedervorlage hat die Regel oben gesetzt — die Automatik
      // macht nur noch Mail (ab 6), Ruhe (ab 9) und Leitung (Stufe A ab 9).
      const { automatikNachFehlversuch } = await import("./fiaon-nicht-erreicht");
      automatik = await automatikNachFehlversuch(personId, lauf, {
        wiedervorlageGesetzt: true, wiedervorlage: regel.datum, frisch,
      });
      if (automatik.ruht) wiedervorlage = null;
      else if (automatik.wiedervorlage) wiedervorlage = automatik.wiedervorlage;
      if (automatik.hinweis) meldung = `${meldung} ${automatik.hinweis}`;
    }
  }

  return {
    wiedervorlage: wiedervorlage ?? null,
    zusage: zusage ?? null,
    gesperrt,
    meldung,
    automatik,
    grund: regel.grund,
    text: regel.text,
    gezaehlt,
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
  // Wer einen Fall abschließt, verliert eine Karte. Seit 11.09.2026 (E-184)
  // holt die Arbeitsliste beim nächsten Aufbau selbst nach — sechs Plätze nach
  // Hitze aus dem Pool (poolNachschub in fiaon-office-vertrieb.ts). Der alte
  // Tages-Nachschub, der hier angestoßen wurde, ist abgeschaltet.

  return {
    wirkung,
    nummerMail,
    uebergabe,
    meldung: uebergabe
      ? (uebergabe.ok ? `Übergeben an ${uebergabe.an}. ${uebergabe.grund}` : uebergabe.grund)
      : (wirkung?.meldung || (istNotiz ? "Notiz gespeichert." : "Ergebnis festgehalten.")),
  };
}
