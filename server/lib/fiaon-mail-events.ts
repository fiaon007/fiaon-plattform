// ═══════════════════════════════════════════════════════════════════════════
// MAIL-EREIGNISSE — die eine Wahrheit über jede Mail im Haus
//
// DER FEHLER, DEN DAS ABSTELLT
// Auf /admin/events stand bei rund zehn Ereignissen „MAKE-ZWEIG FEHLT". Diese
// Behauptung kam aus einer einzigen Zeile:
//
//     makeBranchReady: !/Vorgesetzten-TODO/i.test(e.description)
//
// Die Plattform hat also geprüft, ob in UNSERER EIGENEN Beschreibung das Wort
// „Vorgesetzten-TODO" steht — ein Notizzettel, den frühere Pakete hinterlassen
// haben — und daraus eine Aussage über die Einrichtung des Vorgesetzten
// gemacht. 23 von 33 Beschreibungen enthalten den String. In Wahrheit waren
// alle 21 Zweige aktiv. Die Plattform hat den Vorgesetzten zu Unrecht
// beschuldigt, und er hat es geglaubt, weil es dastand.
//
// AB HIER GILT: Die Plattform BEHAUPTET nichts über Zustellung. Sie WEISS es
// (ein Testversand kam nachweislich bei Brevo an) oder sie sagt „noch nicht
// geprüft" — eine Aussage über den eigenen Kenntnisstand, nicht über jemand
// anderen.
//
// WARUM DIESE DATEI DIE VORHANDENE REGISTRY BENUTZT
// `server/make-events-registry.ts` trägt seit Monaten Label, Beschreibung und
// Beispiel-Payload je Ereignis. Eine zweite Liste mit denselben 33 Einträgen
// wäre die dritte Kopie derselben Wahrheit — und in vier Wochen die falsche.
// Diese Datei ERGÄNZT deshalb: Gruppe, Zielgruppe, Rechte, Zustandsregeln,
// und sie verbindet alles mit dem, was die Datenbank über Vorlage und
// Verifikation weiß.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { MAKE_EVENT_REGISTRY, type MakeEventDef } from "../make-events-registry";
import type { MakeEventType } from "../make-webhook";

type Lauf = typeof sqlPool;

export type Zielgruppe = "kunde" | "mitarbeiter";
export type Gruppe = "zahlung" | "termin" | "konto" | "dokumente" | "team" | "lead";
/** Wer darf dieses Ereignis von Hand auslösen? */
// ── „inkasso" GEHÖRT DAZU (11.08.2026) ─────────────────────────────────────
// Der Vorgesetzte: „Wenn der Inkasso-Mitarbeiter auf ‚senden' klickt … es geht
// nicht!" Nach dem Beheben der Rollenprüfung öffnete sich das Menü — LEER.
// Kein einziges Ereignis war für diese Rolle freigegeben.
//
// Ein Sende-Menü ohne Auswahl ist so nutzlos wie ein verschlossenes.
export type Rolle = "admin" | "vertriebsleiter" | "agent" | "onboarding" | "inkasso";

export interface EventZusatz {
  gruppe: Gruppe;
  zielgruppe: Zielgruppe;
  rollen: Rolle[];
  /**
   * Kurzsatz für das Sende-Menü: WAS geht WANN an WEN raus. Der Vorgesetzte und
   * das Team lesen das im Zweifel unter Zeitdruck am Telefon.
   */
  klartext: string;
  /**
   * 18.09.2026: `false` = die Mail braucht Angaben, die nur ihr eigener Auslöser
   * kennt (Termin, Grund, Auftragsakte, Löschdatum …). Sie steht dann NICHT im
   * allgemeinen Sende-Menü, und die Menü-Routen lehnen sie ab. Gemessen: Die
   * Menüs boten Terminbestätigungen ohne Termin, Sperrmails ohne Grund und
   * Löschbestätigungen an Kunden an, die nie gelöscht wurden.
   */
  vonHand?: false;
  /**
   * Felder, ohne die die Mail keinen Sinn ergibt. `mailSenden` lehnt ab, wenn
   * eines davon nach dem Zusammenbau leer ist — auf JEDEM Weg, nicht nur im Menü.
   */
  pflichtFelder?: string[];
  /**
   * Im allgemeinen Sende-Menü nur für diese Rollen. Alle anderen senden über den
   * eigenen Knopf der Mail (z. B. Konto & Karte: der prüft die drei
   * Bedingungen und merkt den Versand für die 10 € vor).
   */
  menueNur?: Rolle[];
}

/**
 * Was die Registry an fachlicher Einordnung NICHT trägt.
 *
 * Ereignisse ohne Eintrag sind Mitarbeiter-Mails der Gruppe „team", die nur
 * der Vorgesetzte auslöst — die sichere Vorgabe.
 */
const ZUSATZ: Partial<Record<MakeEventType, EventZusatz>> = {
  // 06.09.2026 — Kundenbereich /app (Scheibe 6): Kundenmails, keine Team-Mails.
  app_login_link: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Anmelde-Link ohne Passwort — geht automatisch, wenn der Kunde ihn unter /app/login anfordert (60 Minuten, einmalig). Von Hand nur, wenn der Kunde am Telefon nicht hineinkommt.",
  },
  app_monatsbericht: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Der Monatsbericht aus dem Kundenbereich — am Monatsanfang für den Vormonat, nur wenn fiaon_settings.app_bericht_mail auf 'an' steht.",
    // 18.09.2026: Monat und Bericht kennt nur der Monatslauf (fiaon-monatsbericht.ts).
    vonHand: false, pflichtFelder: ["monat_text", "bericht_url"],
  },
  // ── „WILLKOMMEN" IST NICHT „ZUGANG" (18.09.2026) ──────────────────────────
  // VORHER: rollen admin, vertriebsleiter, agent, onboarding und der Satz
  //   „Begrüßung mit dem Weg ins Konto. Geht automatisch nach der
  //   Zahlungsbuchung". Beides falsch: Die Mail geht beim E-Mail-Schritt des
  //   Antrags raus, und sie hat keinen Knopf. Wer sie einem zahlenden Kunden
  //   „mit dem Zugang" schickte, schickte „Sie erhalten gleich Ihre
  //   Zahlungsdaten".
  // NACHHER: nur noch die Verwaltung, nur an Kunden ohne Zahlung
  //   (fiaon-versand.ts). Der Zugang ist zugang_link.
  welcome: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Antrag eingegangen — geht automatisch beim E-Mail-Schritt des Antrags. Kein Zugang, keine Zahlungsdaten. Von Hand nur an Kunden, die noch nicht bezahlt haben; für den Weg in den Bereich gibt es „Zugang zum Bereich“.",
  },
  zugang_link: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding", "inkasso"],
    klartext: "Der Weg in den Kundenbereich: Knopf zur Anmeldung und Link „Passwort festlegen“. Nur an bezahlte Kunden — wenn der Kunde nicht hineinkommt.",
  },
  bereich_freigeschaltet: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Nach dem geführten Startgespräch: Der Bereich ist vollständig freigeschaltet, mit Knopf hinein. Geht automatisch, wenn das Onboarding das Gespräch abschließt.",
    vonHand: false,
  },
  payment_details: {
    // Das Forderungsmanagement braucht genau diese Mail am häufigsten:
    // „Ich schicke Ihnen die Daten gleich noch zu."
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "agent", "inkasso"],
    klartext: "Bankverbindung, Betrag und Verwendungszweck. Geht nach dem Antrag automatisch raus.",
  },
  antrag_erinnerung: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Antrag begonnen, nicht beendet — Erinnerung mit Link genau an den abgebrochenen Schritt (E-023).",
  },
  abo_verlaengerung_frage: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "inkasso"],
    klartext: "Zwölfte Rate bezahlt — möchten Sie bleiben? Ohne Antwort endet das Abo (E-024).",
  },
  payment_reminder: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Erinnerung an eine offene Zahlung, gestuft nach Alter der Rechnung.",
  },
  claim_received: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung, dass die Zahlungsmeldung angekommen ist — noch keine Freischaltung.",
  },
  payment_confirmed: {
    // Wer die Zahlung einholt, darf ihren Eingang auch bestätigen.
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "inkasso"],
    klartext: "Das Geld ist da, das Konto ist offen. Geht bei der Buchung automatisch raus — von Hand nur an Kunden mit gebuchter Zahlung.",
  },
  abo_payment_reminder: {
    // ── DIE WICHTIGSTE MAIL DES FORDERUNGSMANAGEMENTS ────────────────────
    // Sie war nur für „admin" freigegeben — also für niemanden, der
    // tatsächlich anruft. Der Mensch, dessen ganze Arbeit darin besteht,
    // offene Raten einzuholen, konnte die Rate-Erinnerung nicht verschicken.
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "inkasso"],
    klartext: "Monatliche Rate fällig oder überfällig, in drei Mahnstufen. "
      + "Enthält Betrag, Bankdaten und den Verwendungszweck der Rate.",
  },
  nicht_erreicht_termin: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent"],
    klartext: "Terminlink nach zwei erfolglosen Anrufen — der Kunde wählt selbst eine Uhrzeit.",
  },
  termin_bestaetigung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung nach einer Buchung, mit Storno-Link.",
    // 18.09.2026: Datum, Uhrzeit und Storno-Link kennt nur die Buchung selbst.
    vonHand: false, pflichtFelder: ["termin_datum", "termin_uhrzeit", "storno_link"],
  },
  // E-188 (17.09.2026): Die Bestätigung gehört zu einer Buchung — von Hand
  // sendet sie nur die Verwaltung (Prüfversand aus dem Mailwerk).
  global_termin: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung für das Erstgespräch zu FIAON Global — an das Unternehmen, mit Kalenderdatei und Storno-Link.",
    vonHand: false, pflichtFelder: ["termin_datum", "termin_uhrzeit", "storno_link", "kalender_url"],
  },
  termin_absage: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Absage durch den Mitarbeiter — der Kunde erfaehrt es sofort, mit Link auf eine neue Zeit.",
    vonHand: false, pflichtFelder: ["termin_datum", "termin_uhrzeit", "neu_buchen_link"],
  },
  termin_erinnerung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "24 Stunden vor dem Gespräch.",
    vonHand: false, pflichtFelder: ["termin_datum", "termin_uhrzeit", "storno_link"],
  },
  // ── NEU 24.08.2026 ────────────────────────────────────────────────────
  // VORHER: Es gab dieses Ereignis nicht. Wer „Nicht erschienen" meldete,
  //   hatte keine Mail, die er dem Kunden schicken konnte — auch nicht von
  //   Hand.
  // NACHHER: Steht im Sende-Menü. Die Rolle „onboarding" darf sie auslösen,
  //   weil genau diese Rolle den No-Show meldet.
  // GRUND: Auftrag des Inhabers vom 24.08.2026.
  // 18.09.2026: „agent" dazu. Der Kalender meldet „Termin kam nicht zustande"
  // für JEDEN Mitarbeiter (fiaon-termin.ts) und schickt dabei genau diese Mail
  // bzw. bei „abgesagt" die Einladung — für die Rolle agent lehnte mailSenden
  // beide ab, und der Kunde bekam nichts. Das Versandzentrum bot beide dem
  // Vertrieb längst an (artenFuerRolle); zwei Rechte-Listen für dieselbe Mail.
  // Datum und Uhrzeit sind Pflicht: 67 von 76 verschickten gingen mit
  // „am  um  Uhr" raus (Messung 18.09.2026).
  termin_verpasst: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Der Termin ist nicht zustande gekommen — der Kunde wählt selbst eine neue Uhrzeit. Nennt Datum und Uhrzeit des verpassten Termins.",
    pflichtFelder: ["termin_datum", "termin_uhrzeit"],
  },
  onboarding_einladung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Einladung zum 15-minütigen Startgespräch für bezahlte Kunden.",
  },
  // 19.09.2026 (E-194): „sepa_einrichten" ist weg — GoCardless ist beendet, jede Rate wird überwiesen.
  // NEU 24.08.2026: Der Weg zum Girokonto bei unserem Kooperationspartner —
  // Voraussetzung für die Kreditkarte. Geht NUR, wenn alle drei Bedingungen
  // erfüllt sind (fiaon-konto-karte.ts); der Server prüft das noch einmal
  // selbst, nicht nur die Oberfläche. Bewusst „Kooperationspartner", nie
  // „Affiliate" — Justins ausdrückliche Vorgabe.
  // 18.09.2026: Aus dem allgemeinen Sende-Menü ging sie an der Prüfung der
  // drei Bedingungen (kartenStand().bereit) und an der Vormerkung für die 10 €
  // vorbei. Das Team sendet über den eigenen Knopf in der Akte; im allgemeinen
  // Menü steht sie nur noch für die Verwaltung (Nachversand, 05.09.).
  konto_karte_einladung: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Der Weg zum kostenlosen Girokonto bei unserem Kooperationspartner — Voraussetzung für die Kreditkarte.",
    menueNur: ["admin"],
  },
  // 18.09.2026: „onboarding" dazu — das Versandzentrum bot die Bitte dieser
  // Rolle an, das Sende-Menü lehnte sie ab.
  number_update_request: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Bitte an den Kunden, seine Rufnummer selbst zu berichtigen — mit Link zum Formular und zu einem Termin.",
  },
  // E-184 (11.09.2026): Zustimmungen gibt nur der Kunde — der Betreuer schickt den Weg dorthin.
  zustimmung_link: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Bitte an den Kunden, AGB/Datenschutz, Bonitätsprüfung und Vertrag selbst zu bestätigen — mit dem Link auf die Zustimmungsseite (30 Tage gültig).",
  },
  // E-188 (17.09.2026): FIAON Global. Alle drei entstehen aus der Auftragsakte und gehen
  // automatisch bzw. aus /chef/s/global-auftraege — von Hand aus einer Kundenakte wären sie
  // ohne Vertrag, Rechnung und Stichtag unvollständig. Deshalb nur die Verwaltung (Prüfversand).
  global_auftrag: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "FIAON Global: Auftrag unterschrieben — Vertrag und Rechnung als PDF, Knopf zur Zahlungsseite. Geht automatisch nach der Unterschrift.",
    vonHand: false, pflichtFelder: ["anrede_zeile", "zahlungsseite_url"],
  },
  global_start: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "FIAON Global: Zahlung eingegangen — Ansprechpartner, Unterlagenliste, Startgespräch. Geht automatisch nach der Buchung, sobald die Start-Aufgabe vergeben ist.",
    vonHand: false, pflichtFelder: ["anrede_zeile", "ansprechpartner"],
  },
  global_stichtag: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "FIAON Global: der im Startgespräch vereinbarte Stichtag für Gesellschaft und EIN, in Textform.",
    vonHand: false, pflichtFelder: ["anrede_zeile", "stichtag_text"],
  },
  // E-188 „Mein Auftrag": Alle vier entstehen aus der Auftragsakte und tragen einen signierten Link —
  // ausgelöst werden sie im Auftrag selbst (/agent/global/<ref>) bzw. vom Tageslauf, nicht aus dem Sende-Menü.
  global_etappe: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    vonHand: false,
    klartext: "FIAON Global: eine neue Etappe im Auftrag, mit dem nächsten Schritt. Geht aus dem Auftrag, wenn „dem Kunden mitteilen“ gesetzt ist.",
  },
  global_frist: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    vonHand: false,
    klartext: "FIAON Global: Erinnerung aus dem Pflichtenkalender, rund einen Monat und rund eine Woche vor dem Termin. Geht automatisch.",
  },
  global_dokument: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    vonHand: false,
    klartext: "FIAON Global: FIAON hat ein Dokument im Dokumentenraum bereitgestellt. Das Dokument reist nie als Anhang.",
  },
  // Querschnitt 17.09.2026: Beide entstehen aus der Auftragsakte (Token, Sprache, zuständige Person) —
  // von Hand aus einer Kundenakte fehlte ihnen der Link. Der Zugang geht über den Knopf im Office bzw.
  // die Leitungs-Seite raus, die Erinnerung über den Lauf global_zahlung_takt.
  global_zahlung_erinnerung: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    vonHand: false, pflichtFelder: ["anrede_zeile", "zahlungsseite_url"],
    klartext: "FIAON Global: ruhige Erinnerung an die offene Überweisung — am 3. und 7. Tag nach dem Auftrag, je einmal. Knopf zur Zahlungsseite, keine Bankdaten im Text.",
  },
  global_zugang: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    vonHand: false,
    klartext: "FIAON Global: frischer Link zu „Mein Auftrag“ (30 Tage) — Firmenkunden haben kein Passwort.",
  },
  lead_followup: {
    gruppe: "lead", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Nachfassen bei einem Lead, der noch keinen Antrag gestellt hat.",
  },
  lead_application_link: {
    gruppe: "lead", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent"],
    klartext: "Direktlink zum Antrag für einen Lead am Telefon.",
  },
  // 18.09.2026: Der Knopf „Anfordern" an den Unterlagen (fiaon-telefonie.ts)
  // schickt diese Mail — für jeden, der den Kunden betreut. Mit „admin" allein
  // lehnte mailSenden jeden Klick des Teams ab (gemessen: 1 Versand in 30 Tagen).
  // Den Hinweis, WAS fehlt, kennt nur dieser Auslöser — im Menü steht sie nicht.
  documents_change_request: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding", "inkasso"],
    klartext: "Bitte, ein Dokument im Bereich hochzuladen — mit dem Hinweis, was fehlt. Geht über „Anfordern“ an den Unterlagen.",
    vonHand: false, pflichtFelder: ["hinweis"],
  },
  // ── DIE BONITÄTSAUSKUNFT (24.09.2026, E-240) ──────────────────────────────
  // Alle drei entstehen jetzt im Liefer-Weg (server/lib/fiaon-auskunft-lieferung.ts)
  // und tragen, was nur er kennt: Unterschriftslink, Auskunfteien des Landes,
  // die antwortende Auskunftei. Aus dem Sende-Menü wären sie ohne Knopf bzw.
  // ohne Namen — deshalb vonHand: false. Die klartext-Sätze stimmen jetzt mit
  // dem überein, was die Mail sagt (vorher: „Bitte um die Bonitätsauskunft").
  schufa_requested: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Nach der Zahlung einer Auskunft: Die Anfragen an die Auskunfteien des Landes sind angelegt — bitte Vollmacht und Anfragen unterschreiben (Vollmacht-Weg). Im Einkauf (E-241): die Bitte, den Beschaffungsauftrag kurz zu bestätigen. Geht automatisch, einmal je Bestellung.",
    vonHand: false, pflichtFelder: ["anrede", "unterschrift_url", "unterschrift_satz", "auskunfteien"],
  },
  schufa_approved: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Die Datenkopie einer Auskunftei ist eingegangen — die Auswertung beginnt. Geht automatisch, wenn im Vorgang „Selbstauskunft“ das Ergebnis eingetragen wird.",
    vonHand: false, pflichtFelder: ["anrede", "auskunftei"],
  },
  schufa_rejected: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Eine Auskunftei hat eine Rückfrage — mit dem Satz des Mitarbeiters. Geht automatisch mit dem Ergebnis „abgelehnt“ im Vorgang „Selbstauskunft“.",
    vonHand: false, pflichtFelder: ["anrede", "grund", "auskunftei"],
  },
  // WERBUNG (E-240): Das Angebot der Bonitätsauskunft. Rollen: das System (Takt)
  // und jeder Mitarbeiter mit Kundenkontakt — nach einem Gespräch, in dem der
  // Kunde es wollte. Nicht im allgemeinen Menü: Preis, Kauflink und Abmeldelink
  // baut auskunftAngebotNutzlast; der Aufrufer gibt sie als `zusatz` mit. Die Tür
  // (make-webhook.ts) lehnt bei Werbesperre auch den Handversand ab.
  auskunft_angebot: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding", "inkasso"],
    klartext: "Werbung: das Angebot der Bonitätsauskunft (Preis je Paketstand, Auskunfteien je Land, Knopf zum Beauftragen). Nie an Käufer, nie bei Werbe- oder Vertriebssperre oder Kündigung; automatisch nur an Kunden ab dem 02.09.2026 (§ 7 Abs. 3 UWG).",
    vonHand: false, pflichtFelder: ["kauf_url", "upload_url", "abmelde_url", "preis_text"],
  },
  // 18.09.2026: Das ist die ENTSPERRUNG („Ihr Zugang ist wieder frei") — sie
  // geht beim Freischalten in der Akte. Aus dem Menü an einen Kunden, der nie
  // gesperrt war, wäre sie falsch; die erste Freischaltung ist bereich_freigeschaltet.
  account_activated: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Das gesperrte Konto ist wieder freigeschaltet. Geht beim Entsperren in der Akte.",
    vonHand: false,
  },
  account_suspended: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Das Konto ist gesperrt — mit Grund.",
    vonHand: false, pflichtFelder: ["grund"],
  },
  payment_cancelled: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Die Bestellung wurde storniert.",
    vonHand: false, pflichtFelder: ["grund"],
  },
  payment_reactivated: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Eine abgelaufene Bestellung bekommt eine neue Frist.",
    vonHand: false, pflichtFelder: ["faellig_am"],
  },
  profile_query: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Rückfrage zu den Profilangaben.",
    vonHand: false, pflichtFelder: ["hinweis"],
  },
  gdpr_deleted: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung einer Löschung nach DSGVO.",
    vonHand: false, pflichtFelder: ["geloescht_am"],
  },
  // ── Bewerbungen (E-177, 11.09.2026) ──────────────────────────────────────
  // Zielgruppe „kunde": ein Mensch von draußen, gesiezt. Rolle nur „admin":
  // Die Knöpfe liegen in der Bewerbungsliste des Chefbüros, nicht im
  // Sende-Menü der Akte — dort hätte die Mail keine Bewerbung, aus der sie
  // ihren Inhalt nimmt.
  bewerbung_zusage: {
    gruppe: "team", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Zusage an einen Bewerber — von Hand aus der Bewerbungsliste; der Zugangslink folgt mit der Mitarbeiter-Einladung.",
    vonHand: false, pflichtFelder: ["bereich"],
  },
  bewerbung_absage: {
    gruppe: "team", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Absage an einen Bewerber — von Hand aus der Bewerbungsliste, freundlich und ohne Fristen.",
    vonHand: false, pflichtFelder: ["bereich"],
  },
};

const VORGABE_ZUSATZ: EventZusatz = {
  gruppe: "team", zielgruppe: "mitarbeiter", rollen: ["admin"],
  klartext: "Interne Mail an einen Mitarbeiter.",
};

export interface Parameter {
  name: string;
  beispiel: unknown;
}

export interface MailEvent extends MakeEventDef, EventZusatz {
  parameter: Parameter[];
  /** Was die Datenbank weiß — nicht, was wir vermuten. */
  brevoTemplateId: number | null;
  brevoTemplateName: string | null;
  verifiziertAm: string | null;
  geprueftAm: string | null;
  pruefErgebnis: string | null;
  /**
   * Der EINZIGE Verifikationsstatus im Haus.
   *   bestaetigt      Ein Testversand kam nachweislich bei Brevo an.
   *   nicht_bestaetigt Geprüft, aber nichts angekommen.
   *   ungeprueft      Wir wissen es nicht — und sagen das auch so.
   */
  verifikation: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
}

/** Alle Ereignisse mit allem, was wir über sie wissen. */
export async function mailEvents(lauf: Lauf = sqlPool): Promise<MailEvent[]> {
  const stand = new Map<string, any>();
  const rows = (await lauf`SELECT * FROM fiaon_mail_events`) as any[];
  for (const r of rows) stand.set(String(r.event), r);

  return MAKE_EVENT_REGISTRY.map((e) => {
    const z = ZUSATZ[e.type] ?? VORGABE_ZUSATZ;
    const s = stand.get(e.type);
    const verifiziertAm = s?.verifiziert_am ?? null;
    const geprueftAm = s?.geprueft_am ?? null;
    return {
      ...e,
      ...z,
      parameter: Object.entries(e.example).map(([name, beispiel]) => ({ name, beispiel })),
      brevoTemplateId: s?.brevo_template_id ?? null,
      brevoTemplateName: s?.brevo_template_name ?? null,
      verifiziertAm: verifiziertAm ? new Date(verifiziertAm).toISOString() : null,
      geprueftAm: geprueftAm ? new Date(geprueftAm).toISOString() : null,
      pruefErgebnis: s?.pruef_ergebnis ?? null,
      verifikation: verifiziertAm ? "bestaetigt" : geprueftAm ? "nicht_bestaetigt" : "ungeprueft",
    };
  });
}

/** Ein einzelnes Ereignis. */
export async function mailEvent(event: string, lauf: Lauf = sqlPool): Promise<MailEvent | null> {
  return (await mailEvents(lauf)).find((e) => e.type === event) ?? null;
}

/** Ereignisse, die diese Rolle von Hand auslösen darf. */
export async function eventsFuerRolle(rolle: Rolle, lauf: Lauf = sqlPool): Promise<MailEvent[]> {
  return (await mailEvents(lauf)).filter((e) => !e.deprecated && e.rollen.includes(rolle));
}

/**
 * Darf diese Rolle das Ereignis aus dem ALLGEMEINEN Sende-Menü schicken?
 * (18.09.2026)
 *
 * Eine Regel für Anzeige UND Versand: Das Menü (GET /agent/mail/:personId)
 * filtert damit, die Menü-Routen lehnen damit ab. Sonst zeigt das Menü, was
 * die Route ablehnt — oder schickt, was es nicht zeigt. Die eigenen Auslöser
 * einer Mail (Terminbuchung, Entsperren, „Anfordern", Konto-&-Karte-Knopf)
 * rufen mailSenden direkt und sind davon nicht betroffen.
 */
export function imMenue(
  e: Pick<MailEvent, "label" | "vonHand" | "menueNur">, rolle: string,
): { ja: boolean; grund: string | null } {
  if (e.vonHand === false) {
    return { ja: false, grund: `„${e.label}“ braucht Angaben, die nur ihr eigener Auslöser kennt — aus dem Sende-Menü geht sie nicht.` };
  }
  if (e.menueNur && !e.menueNur.includes(rolle as Rolle)) {
    return { ja: false, grund: `„${e.label}“ geht über ihren eigenen Knopf in der Akte — dort werden die Voraussetzungen geprüft.` };
  }
  return { ja: true, grund: null };
}

/** Brevo-Vorlage zuordnen. */
export async function templateZuordnen(
  event: string, templateId: number | null, templateName: string | null, lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_mail_events (event, brevo_template_id, brevo_template_name, updated_at)
    VALUES (${event}, ${templateId}, ${templateName}, NOW())
    ON CONFLICT (event) DO UPDATE
      SET brevo_template_id = EXCLUDED.brevo_template_id,
          brevo_template_name = EXCLUDED.brevo_template_name,
          updated_at = NOW()
  `;
}

/**
 * Das Ergebnis einer Zweig-Prüfung festhalten.
 *
 * `verifiziert_am` wird bei einem Misserfolg NICHT gelöscht: Ein Zweig, der
 * gestern nachweislich funktioniert hat, ist heute nicht plötzlich weg, nur
 * weil eine einzelne Prüfung ins Leere lief (Brevo braucht manchmal länger als
 * unser Fenster). Der Misserfolg steht als `pruef_ergebnis` daneben.
 */
export async function verifikationSpeichern(
  event: string, bestaetigt: boolean, ergebnis: string, lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_mail_events (event, verifiziert_am, geprueft_am, pruef_ergebnis, updated_at)
    VALUES (${event}, ${bestaetigt ? new Date() : null}, NOW(), ${ergebnis}, NOW())
    ON CONFLICT (event) DO UPDATE
      SET verifiziert_am = ${bestaetigt ? new Date() : sqlPool`fiaon_mail_events.verifiziert_am`},
          geprueft_am = NOW(),
          pruef_ergebnis = EXCLUDED.pruef_ergebnis,
          updated_at = NOW()
  `;
}

/**
 * Der Klartext zum Verifikationsstatus.
 *
 * Bei „nicht bestätigt" werden BEIDE möglichen Ursachen genannt. Genau das
 * hat gefehlt: Die alte Meldung behauptete „Make-Zweig fehlt" und schickte den
 * Vorgesetzter in die falsche Richtung, während in Wahrheit die Brevo-Vorlage
 * nicht aktiv war.
 */
export function verifikationsText(e: MailEvent): string {
  if (e.verifikation === "bestaetigt") {
    return `Zweig bestätigt am ${new Date(e.verifiziertAm!).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })} Uhr — ein Testversand ist nachweislich bei Brevo angekommen.`;
  }
  if (e.verifikation === "nicht_bestaetigt") {
    return "Nicht bestätigt — die Testmail kam bei Brevo nie an. Zwei mögliche Ursachen: "
      + "der Make-Zweig für dieses Ereignis fehlt oder ist inaktiv, ODER das Brevo-Template "
      + "ist nicht aktiv beziehungsweise nicht zugeordnet. Beides sieht von hier aus gleich aus.";
  }
  return "Noch nicht geprüft. Mit „Zweig prüfen“ geht ein Testversand raus, und wir sehen bei Brevo nach, ob er ankommt.";
}
