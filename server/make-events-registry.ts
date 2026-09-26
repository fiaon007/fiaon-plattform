// ═══════════════════════════════════════════════════════════════════
// Make-Event-Registry (Paket T) — zentrale, im Code gepflegte Liste
// ALLER Make-Event-Typen mit Beschreibung, Payload-Schema und
// realistischen Beispielwerten.
//
// REGEL: Jedes neue Event, das über sendMakeWebhook() verschickt wird,
// MUSS hier eingetragen werden. Die Event-Test-Konsole /admin/events
// liest ausschließlich diese Registry — nur so kann Make.com die
// Payload-Struktur eines neuen Events lernen, BEVOR der echte
// Workflow existiert.
// ═══════════════════════════════════════════════════════════════════

import type { MakeEventType } from "./make-webhook";
import { BANK, BANK_ALT_GESPERRT } from "@shared/fiaon-bank";
// E-240 (Gegenlesen 24.09.2026): Preise und Auskunfteien der Auskunft nur aus der einen Quelle —
// eine Zahl im Beschreibungstext wäre die nächste, die beim Preiswechsel stehen bleibt.
import { AUSKUNFT_PREISE_CENTS, auskunftLeistung, auskunfteienText, euroText } from "@shared/fiaon-auskunft";
// E-241 (25.09.2026): Die Sätze von schufa_requested je Lieferweg — das Beispiel zeigt den Vollmacht-Weg.
import { schufaRequestedSaetze } from "./mail/vorlagen/auskunft-lead";

export interface MakeEventDef {
  type: MakeEventType;
  label: string;
  /** 1 Satz: wann feuert dieses Event im echten Betrieb. */
  description: string;
  /** true = Payload lässt sich aus einer echten Bestellung (fiaon_applications) bauen → „Für echten Kunden senden“ erlaubt. */
  customerBound: boolean;
  /** deprecated = wird nicht mehr automatisch gefeuert (nur noch Test/Migration). */
  deprecated?: boolean;
  /** true = im Code wird KEIN automatischer Versand ausgelöst — nur registriert,
   *  damit der Vorgesetzte das Event testen und den Make-Zweig anlegen kann. */
  recommendationOnly?: boolean;
  /** Vollständiges Payload-Beispiel mit realistischen Werten (email wird beim Test durch die Test-Adresse ersetzt). */
  example: Record<string, unknown>;
}

const CUSTOMER_EXAMPLE = {
  email: "max.mustermann@example.com",
  vorname: "Max",
  nachname: "Mustermann",
  antrag_id: "FIAON-MB2XK4LQ-7T9A",
  payment_reference: "FIAON-A1B2C3",
  betrag: "59.99",
  paket: "FIAON Pro (Standard)",
};

const INVOICE_URL_EXAMPLE =
  "https://www.fiaon.com/api/fiaon/invoice/FIAON-A1B2C3.pdf?exp=1799999999&sig=0f3a9b7c2e4d";

export const MAKE_EVENT_REGISTRY: MakeEventDef[] = [
  {
    type: "welcome",
    // 18.09.2026: Die Beschreibung sagte „sobald ein Antrag … abgeschlossen
    // wurde" — der Code (fiaon-antrag.ts) feuert beim E-MAIL-SCHRITT, also
    // meist vor der Bestellung. Und diese Mail ist keine Zugangsmail; wer sie
    // von Hand als „Willkommen und Zugang" schickte, schickte die falsche.
    label: "Antrag eingegangen (Willkommen)",
    description: "Feuert genau einmal beim E-Mail-Schritt des Antrags (erste Speicherung mit gültiger E-Mail-Adresse) — meist vor der Bestellung. Enthält weder Zugang noch Zahlungsdaten. Von Hand nur durch die Verwaltung und nur an Kunden, die noch nicht bezahlt haben; die Zugangsmail heißt zugang_link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE },
  },
  // ── 18.09.2026 (Team-Feedback, Priorität 3): die Zugangsmail ──────────────
  {
    type: "zugang_link",
    label: "Zugang zum Bereich (Kunde)",
    description: "Von Hand aus Versandzentrum und Sende-Menü, wenn ein BEZAHLTER Kunde nicht in seinen Bereich kommt: Knopf zur Anmeldung (login_url) und Link „Passwort festlegen“ (passwort_url). „Zugang retten“ (Vertriebsleitung) schickt dieselbe Mail mit einem Setz-Link, der 60 Minuten gilt. Ersetzt den Handversand von welcome, der die Antrag-eingegangen-Mail ohne Knopf verschickte. Pflichtmail — die Frequenzbremse greift nicht.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", passwort_url: "https://www.fiaon.com/passwort-vergessen" },
  },
  {
    type: "bereich_freigeschaltet",
    label: "Bereich freigeschaltet nach dem Startgespräch (Kunde)",
    description: "Feuert automatisch, wenn das Onboarding ein Startgespräch als erledigt markiert und das Konto damit voll freigeschaltet wird (fiaon-onboarding-bereich.ts) — mit Knopf in den Bereich (login_url). Bis zum 18.09.2026 ging dort account_activated raus: der Entsperrungs-Text „Ihr Zugang ist wieder frei“, ohne Knopf.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", freigeschaltet_am_text: "18.09.2026" },
  },
  {
    type: "payment_details",
    label: "Zahlungsdaten (Bestellung angelegt)",
    description: "Feuert genau einmal beim Übergang zu pending_payment (Bestellung/Reaktivierung) — enthält Bankdaten-Kontext und Rechnungs-Link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "kuendigung_bestaetigt",
    label: "Kündigung bestätigt (letzte Rate offen)",
    description: "E-092: Bestätigt die Kündigung und nennt die letzte, noch offene Rate mit Zahlungsseite. Pflichtmail (Vertragspost), einmalig je Bestellung.",
    customerBound: true,
    // 18.09.2026: verwendungszweck (Knopf zur Zahlungsseite) und portal_url fehlten —
    // Galerie und Prüfversand zeigten die Mail ohne ihren Knopf (pruef-mail-knoepfe.ts).
    example: { ...CUSTOMER_EXAMPLE, rate_nr: "3", faellig_am_text: "15.09.2026", verwendungszweck: "FIAON-A1B2C3-3", portal_url: "https://www.fiaon.com/login" },
  },
  {
    type: "vertrag_beendet",
    label: "Vertrag beendet (letzte Rate bezahlt)",
    description: "E-092: Die letzte Rate ist eingegangen, der Vertrag ist aus. Unterlagen bleiben 90 Tage einsehbar. Pflichtmail, ausgelöst im Buchungsweg.",
    customerBound: true,
    // 18.09.2026: portal_url (Knopf „Zu meinen Unterlagen“) fehlte im Beispiel.
    example: { ...CUSTOMER_EXAMPLE, rate_nr: "3", portal_url: "https://www.fiaon.com/login" },
  },
  {
    type: "bankverbindung_neu",
    label: "Neue Bankverbindung (Kontowechsel)",
    description: "NOTFALL 02.09.2026: Wise-Konto gesperrt. Geht einmalig an jede Adresse, die in den letzten 24 h Bankdaten bekam — Verwendungszweck bleibt. Auslöser: POST /admin/bankwechsel/informieren. Pflichtmail (Frequenzbremse greift nicht).",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, alte_iban: BANK_ALT_GESPERRT.ibanDisplay, bank: BANK.bank },
  },
  {
    type: "followup_48h",
    label: "Follow-up 48h (VERALTET)",
    // ── GEMESSEN AM 19.08.2026 ─────────────────────────────────────────
    // Dieses Ereignis wurde NIE gefeuert: null Zeilen in fiaon_mail_log, seit
    // es das Protokoll gibt. Es gibt auch keine Stelle im Quelltext, die es
    // auslöst — nur einen Kommentar in fiaon-antrag.ts, der auf seine
    // Ablösung hinweist. Der Zweig in Make ist also toter Ballast.
    //
    // Das steht hier so deutlich, weil „VERALTET" allein den Betreiber rätseln
    // ließ, ob er den Zweig noch braucht. Er braucht ihn nicht.
    description: "VERALTET — wird NIE MEHR gefeuert. Gemessen am 19.08.2026: null Versände, "
      + "und es gibt keine Stelle im Quelltext, die es auslöst. Der Zweig in Make kann GELÖSCHT werden. "
      + "Abgelöst durch das tägliche payment_reminder; die Brevo-Vorlage kann bleiben, falls sie dort weiterverwendet wird.",
    customerBound: false,
    deprecated: true,
    example: { ...CUSTOMER_EXAMPLE },
  },
  {
    type: "payment_reminder",
    label: "Zahlungserinnerung (täglich)",
    description: "Feuert für jede unbezahlte Bestellung (pending_payment/claimed_paid) einmal pro Tag im Versandfenster, ab 24h nach Bestellung, bis MAX_REMINDERS erreicht ist — auch vom Bulk-Versand genutzt.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE, reminder_number: 1 },
  },
  {
    type: "abo_payment_reminder",
    label: "Abo-Rate fällig (monatliche Paketrate)",
    description:
      "Feuert für eine offene Monatsrate des Pakets: Stufe 1 am Fälligkeitstag, Stufe 2 sieben Tage später, Stufe 3 nach vierzehn Tagen. Danach keine weitere Mail, sondern ein Punkt „Entscheidung nötig“ in der Zahlungszentrale. Enthält Bankdaten UND den Verwendungszweck (Ratenreferenz) — ohne ihn lässt sich die Überweisung nicht zuordnen. Der Bonitäts-Check (74 €) ist kein Abo und löst dieses Event nie aus. Vorgesetzten-TODO: Make-Zweig 'abo_payment_reminder' + Brevo-Template anlegen (Variablen: betrag, faellig_am_text, rate_nr, mahnstufe_text, empfaenger, iban, bic, verwendungszweck, portal_url).",
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      // Die Ratenreferenz steht bewusst in payment_reference: bestehende
      // Vorlagen drucken dieses Feld als Verwendungszweck.
      payment_reference: "FIAON-A1B2C3-2",
      betrag: "59.99",
      rate_nr: 2,
      faellig_am: "2026-09-03",
      faellig_am_text: "02.09.2026",
      tage_ueberfaellig: 0,
      mahnstufe: 1,
      mahnstufe_text: "Freundliche Erinnerung — heute ist Ihre Monatsrate fällig.",
      empfaenger: BANK.empfaenger,
      iban: BANK.ibanDisplay,
      bic: BANK.bic,
      verwendungszweck: "FIAON-A1B2C3-2",
      portal_url: "https://www.fiaon.com/login",
    },
  },
  {
    type: "aufgabe_zugewiesen",
    label: "Aufgabe zugewiesen (Mitarbeiter)",
    description:
      "Feuert, wenn der Vorgesetzte einem Mitarbeiter eine Aufgabe an einem Kunden zuweist. Ohne diese Mail fällt eine Aufgabe erst beim nächsten Portal-Besuch auf — bei einer Frist von morgen ist das zu spät. Der Mitarbeiter erledigt sie unter „Aufgaben“ in seinem Portal. Vorgesetzten-TODO: Make-Zweig 'aufgabe_zugewiesen' + Brevo-Template anlegen (Variablen: vorname, aufgabe, kunde, faellig_am_text, dringend, portal_url).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      aufgabe: "Unterlagen prüfen und Kunden zurückrufen",
      kunde: "Max Mustermann",
      faellig_am: "2026-08-08",
      faellig_am_text: "08.08.2026",
      dringend: false,
      portal_url: "https://www.fiaon.com/agent/aufgaben",
    },
  },
  {
    type: "onboarding_einladung",
    label: "Einladung zum Startgespräch (Kunde)",
    description:
      "Feuert 48 Stunden nachdem ein bezahlter Kunde das Startgespräch-Gate im Portal übersprungen hat — genau einmal. Löst der Onboarding-Bereich sie von Hand erneut aus, ist das dieselbe Vorlage. Vorgesetzten-TODO: Make-Zweig 'onboarding_einladung' + Brevo-Template anlegen (Variablen: vorname, termin_link).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      termin_link: "https://www.fiaon.com/termin/7f3a…?art=start",
    },
  },
  {
    type: "nicht_erreicht_termin",
    label: "Nicht erreicht — Terminlink an den Kunden",
    // ── DOKU-DRIFT KORRIGIERT (24.08.2026) ──────────────────────────────────
    // VORHER: „nach dem ZWEITEN erfolglosen Anrufversuch". Der Code sagt seit
    // der neuen Staffel `SCHWELLE_MAIL = 6` (server/lib/fiaon-nicht-erreicht.ts).
    // NACHHER steht die echte Zahl da — die SCHWELLE bleibt unverändert. GRUND:
    // Ein Text, der eine andere Zahl nennt als der Code, kostet beim nächsten
    // „warum kommt die Mail nicht?" einen halben Tag Suche an der falschen
    // Stelle.
    description:
      "Feuert automatisch nach dem SECHSTEN erfolglosen Anrufversuch (nicht erreicht oder Mailbox), genau einmal je Kunde in 30 Tagen. Der Kunde bekommt einen persönlichen Buchungslink auf die Slots SEINES Betreuers und wählt selbst eine Uhrzeit. Ohne diese Mail folgt der siebte, achte und neunte Anruf ins Leere. Vorgesetzten-TODO: Make-Zweig 'nicht_erreicht_termin' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_link).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_link: "https://www.fiaon.com/termin/7f3a…",
    },
  },
  {
    type: "termin_bestaetigung",
    label: "Terminbestätigung (Kunde)",
    description:
      "Feuert sofort nach einer Buchung — egal ob im Antrag, über den Terminlink oder vom Agenten angelegt. Enthält den Storno-Link; Umbuchen ist Absagen plus neu buchen auf derselben Seite. Vorgesetzten-TODO: Make-Zweig 'termin_bestaetigung' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_datum, termin_uhrzeit, storno_link, hinweis_anruf, hinweis_absage, termin_art). SEIT 30.08.2026 faehrt termin_art mit (Onboarding / Vertrieb / Rueckruf) — bitte als {{params.termin_art}} einsetzen. SEIT 19.08.2026 faehrt hinweis_anruf mit — bitte in der Vorlage als {{params.hinweis_anruf}} einsetzen, damit niemand einen Meeting-Link erwartet.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_datum: "12.08.2026",
      termin_uhrzeit: "14:20",
      // ── NEU 30.08.2026: die Terminart ─────────────────────────────────
      // „Man sieht nicht, was fuer ein Termin das ist." Der Wert kommt aus
      // shared/fiaon-termin-art.ts — derselben Ableitung wie die Marke in
      // der Oberflaeche. Betreiber-TODO: als {{params.termin_art}} einsetzen.
      termin_art: "Onboarding",
      storno_link: "https://www.fiaon.com/termin/absagen/9b2c…",
      // ── NEU 19.08.2026: der fertige „Wir rufen an"-Satz ──────────────
      // Der Kunde, der einen Videokonferenz-Link erwartet, wartet vor seinem
      // Rechner, während das Telefon klingelt. Der Satz kommt AUSFORMULIERT
      // mit, damit die Brevo-Vorlage ihn nur einsetzen muss.
      hinweis_anruf: "Daniel ruft dich zur vereinbarten Zeit an — halte dein Telefon bereit.",
      hinweis_absage: "Passt es doch nicht? Über den Link in der Bestätigungs-E-Mail kannst du jederzeit absagen oder eine andere Zeit wählen.",
    },
  },
  {
    type: "termin_absage",
    label: "Termin abgesagt (durch uns)",
    customerBound: true,
    description:
      "Feuert, wenn ein MITARBEITER einen gebuchten Termin absagt (Kundenabsagen loesen keine Mail aus — der Kunde weiss es selbst). Vorgesetzten-TODO: Make-Zweig 'termin_absage' + Brevo-Vorlage anlegen (Variablen: vorname, nachname, termin_datum, termin_uhrzeit, termin_art, neu_buchen_link). Ton ruhig und entschuldigend: welcher Termin betroffen war, dass WIR abgesagt haben, und ein Klick fuehrt direkt zur Wahl einer neuen Zeit ({{params.neu_buchen_link}}).",
    example: {
      vorname: "Max", nachname: "Muster", termin_datum: "Donnerstag, 28. August",
      termin_uhrzeit: "14:20", termin_art: "Startgespräch",
      neu_buchen_link: "https://fiaon.com/termin/abc123",
    },
  },
  // ══════════════════════════════════════════════════════════════════════════
  // NEU AM 24.08.2026 — „Leider nicht erschienen … hier neuen Termin buchen"
  //
  // VORHER: Ein Mitarbeiter klickte im Onboarding auf „Nicht erschienen", und
  //   beim Kunden passierte NICHTS. Die Kette danach: unreachable_count + 1,
  //   die Automatik aus fiaon-nicht-erreicht.ts (schreibt erst ab dem sechsten
  //   erfolglosen Versuch UND ist gesperrt, solange ein Termin existiert — beim
  //   No-Show existiert er) und der 48-Stunden-Lauf, der irgendwann die
  //   generische `onboarding_einladung` schickt. Zwei Tage Funkstille, dann ein
  //   Text, der so klingt, als hätte es nie einen Termin gegeben.
  // NACHHER: Dieses Ereignis geht SOFORT raus, wenn der Termin als verpasst
  //   gemeldet wird — einmal je Termin (fiaon_termine.verpasst_mail_am).
  // GRUND: Auftrag des Inhabers vom 24.08.2026.
  //
  // ── TEXTVORSCHLAG FÜR DIE BREVO-VORLAGE (Kunde wird GESIEZT) ─────────────
  //   Betreff:  Ihr Termin bei FIAON — wir haben Sie nicht erreicht
  //   Vorschau: Kein Problem — hier wählen Sie einen neuen Termin.
  //
  //   Guten Tag {{ params.vorname }},
  //
  //   wir haben Sie zum vereinbarten Termin am {{ params.termin_datum }} um
  //   {{ params.termin_uhrzeit }} Uhr leider nicht erreicht.
  //
  //   Das ist kein Problem. Wählen Sie einfach einen neuen Termin, der Ihnen
  //   passt — {{ params.agent_vorname }} nimmt sich die Zeit dafür.
  //
  //   [ Neuen Termin wählen ]  → {{ params.termin_link }}
  //
  //   Sollte etwas dazwischengekommen sein oder eine andere Rufnummer besser
  //   passen, sagen Sie uns bitte kurz Bescheid.
  //
  //   Ihr Team von FIAON
  //
  // Kein Vorwurf, keine Schuldzuweisung, kein Versprechen. Die ausgearbeitete
  // HTML-Fassung liegt unter docs/brevo-templates/termin_verpasst.html.
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: "termin_verpasst",
    label: "Termin nicht zustande gekommen (Kunde)",
    description:
      "Feuert SOFORT, wenn ein Startgespräch im Onboarding-Bereich als „verpasst“ gemeldet wird — einmal je Termin (fiaon_termine.verpasst_mail_am). Ruhiger Ton, kein Vorwurf, mit dem Link auf einen neuen Termin. Lässt sich aus der Akte von Hand nachsenden. Vorgesetzten-TODO: Make-Zweig 'termin_verpasst' + Brevo-Template in Sie-Form anlegen (Variablen: vorname, agent_vorname, termin_datum, termin_uhrzeit, termin_link). Textvorschlag: siehe Kommentar über diesem Eintrag und docs/brevo-templates/termin_verpasst.html.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      agent_vorname: "Daniel",
      termin_datum: "24.08.2026",
      termin_uhrzeit: "14:20",
      termin_link: "https://www.fiaon.com/termin/7f3a…",
    },
  },
  // 19.09.2026 (E-194): Der Eintrag „sepa_einrichten" (Lastschrift einrichten) ist weg —
  // GoCardless ist beendet. Den Make-Zweig und die Brevo-Vorlage dazu löscht Justin.
  // ══════════════════════════════════════════════════════════════════════════
  // TEXTVORSCHLAG "konto_karte_einladung" (Sie-Form, hochwertig, kein Druck)
  //
  //   Betreff: Ihr naechster Schritt: kostenloses Girokonto und Kreditkarte
  //
  //   Guten Tag {{vorname}},
  //
  //   Sie sind bei uns an dem Punkt, auf den Sie hingearbeitet haben: Ihre
  //   Unterlagen liegen vollstaendig vor, Ihre Auskunft ist da und Ihre
  //   ersten Raten sind gelaufen. Damit ist der Weg frei fuer das, weshalb
  //   die meisten Menschen zu uns kommen - eine eigene Karte.
  //
  //   Wir arbeiten dafuer mit der DKB als Kooperationspartner zusammen. Der
  //   Weg besteht aus zwei Schritten, und der erste ist der wichtige:
  //
  //   1. Girokonto eroeffnen - kostenlos ab 700 EUR Geldeingang im Monat
  //      oder generell fuer alle unter 28 Jahren. Die Visa Debitkarte ist
  //      dabei, Echtzeitueberweisungen ebenfalls. Aktuell gibt es zusaetzlich
  //      bis zu 200 EUR Startguthaben.
  //   2. Kreditkarte dazubuchen - direkt aus Ihrem neuen Banking heraus.
  //      Ohne Girokonto geht das nicht, deshalb diese Reihenfolge.
  //
  //   Hier geht es zur Eroeffnung:
  //   {{partner_link}}
  //
  //   Sie brauchen dafuer rund fuenf Minuten und Ihren Ausweis fuer das
  //   Video-Ident - denselben, den Sie bei uns schon hinterlegt haben.
  //
  //   Wenn etwas unklar ist, rufen Sie einfach {{agent_vorname}} an.
  //
  //   Ihr Team von FIAON
  //
  // WICHTIG fuer die Vorlage:
  //  - Das Wort "Affiliate" darf NIRGENDS vorkommen. Es heisst
  //    Kooperationspartner oder Partnerbank. Ausdrueckliche Vorgabe des
  //    Inhabers vom 24.08.2026.
  //  - Die Reihenfolge Konto -> Karte ist keine Empfehlung, sondern die Regel
  //    der Bank. Ein Text, der direkt die Kreditkarte anpreist, schickt den
  //    Kunden in eine Ablehnung, die er UNS zuschreibt.
  //  - {{partner_link}} traegt eine Kennung mit Kunden- und Mitarbeiternummer.
  //    Sie darf nicht gekuerzt oder ersetzt werden, sonst laesst sich die
  //    Eroeffnung niemandem zuordnen und die Provision nicht abrechnen.
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: "konto_karte_einladung",
    label: "Konto & Karte beim Kooperationspartner (Kunde)",
    description:
      "Seit 21.09.2026 (E-206): geht AUTOMATISCH raus, sobald die erste Zahlung gebucht ist (Antrag vollstaendig vorausgesetzt) - Lauf 'karten_einladungen' alle fuenf Minuten, hoechstens 40 je Lauf; der Knopf in der Akte bleibt fuer den Nachversand. Die 10 EUR je bestaetigter Eroeffnung gehen an den Betreuer. Text in server/mail/vorlagen/konto.ts (Versandweg direkt), Kartensaetze aus shared/fiaon-karten-weg.ts. Das Wort 'Affiliate' darf in der Vorlage NICHT vorkommen.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      agent_vorname: "Daniel",
      partner_link: "https://www.awin1.com/cread.php?awinmid=11329&awinaffid=3050049&clickref=FIAON-P12345&clickref2=A928",
      login_url: "https://www.fiaon.com/login",
    },
  },
  {
    type: "antrag_erinnerung",
    label: "Antrag abgebrochen — Erinnerung mit Wiedereinstiegs-Link",
    description:
      "Feuert nach E-023: 10 Minuten nach dem letzten Schritt, dann in den Tagesfenstern 16:30 und 19:00 Uhr, am Folgetag 07:30, 15:00, 16:30 und 19:00 Uhr (Europe/Berlin) — bis zu sieben Mails, solange der Kunde nicht weitermacht und keine Zahlungsbestellung existiert. Vorgesetzten-TODO: Make-Zweig 'antrag_erinnerung' + Brevo-Template in Sie-Form (Variablen: vorname, paket, schritt_text, weiter_link, erinnerung_nr). Der weiter_link führt genau an den abgebrochenen Schritt (14 Tage gültig).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com", vorname: "Max", nachname: "Mustermann", antrag_id: "FIAON-ABC123-XY9Z",
      paket: "FIAON Pro (Standard)", pack_key: "pro", schritt: 2, schritt_text: "Schritt 2 von 5 — Beruf & Finanzen",
      weiter_link: "https://www.fiaon.com/antrag?weiter=FIAON-ABC123-XY9Z.1756...abcd", erinnerung_nr: 1,
      portal_url: "https://www.fiaon.com/antrag",
    },
  },
  {
    type: "abo_verlaengerung_frage",
    label: "12. Rate bezahlt — möchten Sie bleiben?",
    description:
      "Feuert nach E-024 mit der Buchung der zwölften Rate: Das Abo endet, wenn der Kunde nichts tut; mit einem Klick im Kundenbereich läuft es weitere zwölf Raten. Vorgesetzten-TODO: Make-Zweig 'abo_verlaengerung_frage' + Brevo-Template in Sie-Form (Variablen: vorname, paket, betrag, portal_url).",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, paket: "FIAON Pro (Standard)", betrag: "59.99", portal_url: "https://www.fiaon.com/dashboard#abo" },
  },
  {
    type: "termin_erinnerung",
    label: "Terminerinnerung 24 h vorher (Kunde)",
    description:
      "Feuert im Tageslauf 24 Stunden vor dem Termin, einmalig je Termin (die Spalte erinnert_am verhindert Doppelversand bei einem Neustart). Vorgesetzten-TODO: Make-Zweig 'termin_erinnerung' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_datum, termin_uhrzeit, storno_link, hinweis_anruf, hinweis_absage, termin_art). SEIT 30.08.2026 faehrt termin_art mit (Onboarding / Vertrieb / Rueckruf) — bitte als {{params.termin_art}} einsetzen. SEIT 19.08.2026 faehrt hinweis_anruf mit — bitte in der Vorlage als {{params.hinweis_anruf}} einsetzen, damit niemand einen Meeting-Link erwartet.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_datum: "12.08.2026",
      termin_uhrzeit: "14:20",
      // ── NEU 30.08.2026: die Terminart ─────────────────────────────────
      // „Man sieht nicht, was fuer ein Termin das ist." Der Wert kommt aus
      // shared/fiaon-termin-art.ts — derselben Ableitung wie die Marke in
      // der Oberflaeche. Betreiber-TODO: als {{params.termin_art}} einsetzen.
      termin_art: "Onboarding",
      storno_link: "https://www.fiaon.com/termin/absagen/9b2c…",
      // ── NEU 19.08.2026: der fertige „Wir rufen an"-Satz ──────────────
      // Der Kunde, der einen Videokonferenz-Link erwartet, wartet vor seinem
      // Rechner, während das Telefon klingelt. Der Satz kommt AUSFORMULIERT
      // mit, damit die Brevo-Vorlage ihn nur einsetzen muss.
      hinweis_anruf: "Daniel ruft dich zur vereinbarten Zeit an — halte dein Telefon bereit.",
      hinweis_absage: "Passt es doch nicht? Über den Link in der Bestätigungs-E-Mail kannst du jederzeit absagen oder eine andere Zeit wählen.",
    },
  },
  {
    type: "claim_received",
    label: "Überweisung angekündigt (Danke)",
    description: "Feuert genau einmal, wenn der Kunde auf „Ich habe die Überweisung getätigt“ klickt — dankt und nennt das Freischalt-Zeitfenster (werktags bis 18:00 Uhr). Bei einer Bonitätsauskunft (seit 26.09.2026, E-243) die eigene Fassung ohne „Bereich geht auf / Zugangs-Mail“ (AUSKUNFT_ZAHLUNG_GEMELDET_VORLAGE, nur über den Motor).",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "payment_confirmed",
    label: "Zahlung bestätigt (Konto aktiv + Login)",
    description: "Feuert genau einmal, wenn der Admin eine Zahlung als bezahlt markiert — ersetzt die frühere direkte Plattform-Freischaltmail und enthält den Login-Link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "agent_payment_reminder",
    label: "Zahlungsdaten-Mail durch Mitarbeiter",
    description: "Feuert, wenn ein Mitarbeiter im Kundendetail die Ein-Klick-Mail „Wie soeben besprochen“ auslöst (10-Minuten-Sperre pro Kunde).",
    customerBound: false,
    example: { ...CUSTOMER_EXAMPLE, agent_name: "Anna Schmidt", invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "agent_invite",
    label: "Mitarbeiter-Einladung",
    description: "Feuert, wenn der Admin einen neuen Mitarbeiter anlegt oder die Einladung erneut sendet (Setup-Link 48h gültig).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      nachname: "Schmidt",
      invite_url: "https://www.fiaon.com/agent/setup/4f8a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
      admin_name: "FIAON Admin",
    },
  },
  // ── Bewerbungen (E-177, 11.09.2026) ──────────────────────────────────────
  // Beide gehen an BEWERBER (gesiezt), nicht an Mitarbeiter. Ausgelöst nur von
  // Hand aus der Bewerbungsliste (/chef/s/bewerbungen); die Zusage mündet in
  // die Mitarbeiter-Einladung (agent_invite), die den Zugangslink trägt.
  {
    type: "bewerbung_zusage",
    label: "Bewerbung: Zusage (Bewerber)",
    description: "Feuert, wenn die Leitung in der Bewerbungsliste „Zusagen“ klickt. Der Zugangslink kommt getrennt über agent_invite, sobald die Einladung ausgefüllt ist. Keine Fristen, keine Vergütungsaussagen — das gehört ins Gespräch.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      nachname: "Schmidt",
      bereich: "Onboarding & Kundenbetreuung",
      anstellung: "Freie Mitarbeit",
      land: "Österreich",
      ansprechpartner: "Florentine Lombardi",
    },
  },
  {
    type: "bewerbung_absage",
    label: "Bewerbung: Absage (Bewerber)",
    description: "Feuert, wenn die Leitung in der Bewerbungsliste „Absagen“ klickt — freundlich, ohne Begründungspflicht, ohne Fristen. Ein Kundenkonto des Bewerbers bleibt unberührt.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      nachname: "Schmidt",
      bereich: "Vertrieb",
      anstellung: "Festanstellung",
      land: "Deutschland",
      ansprechpartner: "Florentine Lombardi",
    },
  },
  {
    type: "agent_password_reset",
    label: "Mitarbeiter Passwort-Reset",
    description: "Feuert bei „Passwort vergessen“ eines Mitarbeiters oder beim Force-Reset durch den Admin (Reset-Link 60 Min gültig).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      reset_url: "https://www.fiaon.com/agent/passwort?token=4f8a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
    },
  },
  {
    type: "agent_payout_done",
    label: "Auszahlung ausgeführt (Mitarbeiter)",
    description: "Feuert, wenn der Admin eine Provisions-Auszahlung als ausgezahlt markiert.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag: "125.50",
    },
  },
  {
    type: "agent_payout_rejected",
    label: "Auszahlung abgelehnt (Mitarbeiter)",
    description: "Feuert, wenn der Admin eine Provisions-Auszahlung ablehnt — mit Begründung.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag: "125.50",
      grund: "Bankdaten unvollständig — bitte IBAN im Profil prüfen",
    },
  },
  {
    type: "agent_bank_reminder",
    label: "Bankdaten fehlen (Mitarbeiter)",
    description: "Der Betreiber loest sie im Reiter Verguetung & Stunden aus, wenn keine "
      + "IBAN hinterlegt ist — ohne sie kann keine Auszahlung ueberwiesen werden.",
    customerBound: false,
    // Der Make-Zweig muss noch angelegt werden. Solange er fehlt, meldet der
    // Versand einen Fehler im Klartext — er scheitert nicht stillschweigend.
    recommendationOnly: true,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
    },
  },
  {
    type: "agent_callback_reminder",
    label: "Rückruf-Erinnerung (Mitarbeiter)",
    description: "Feuert 15 Minuten vor einem geplanten Rückruf-Termin an den zuständigen Mitarbeiter.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      agent_email: "anna.schmidt@example.com",
      vorname: "Anna",
      kunde_name: "Max Mustermann",
      referenz: "FIAON-MB2XK4LQ-7T9A",
      termin_zeit: "2026-07-06T14:30:00.000Z",
    },
  },
  {
    type: "lead_followup",
    label: "Lead-Nachfass (automatisiert)",
    description: "Feuert für nicht-konvertierte Leads (neu/kontaktiert) nach dem Nachfass-Plan im Versandfenster — auch vom Bulk-Versand genutzt. Vorgesetzten-TODO: Make-Zweig lead_followup + Brevo-Template (+ optional WhatsApp/Superchat).",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      nachname: "Beispiel",
      telefon: "+491701234567",
      lead_id: 1234,
      followup_number: 1,
      quelle: "facebook_lead_ads",
      // E-210 (22.09.2026): die Anrede aus shared/fiaon-anrede.ts und der persönliche Link /a/<code>/m.
      anrede: "Guten Tag Lena Beispiel,",
      antrag_url: "https://fiaon.com/a/Ab3dEf7hJk/m",
      // 28.08.2026: Der echte Lauf liefert den Abmeldelink immer mit — eine
      // Werbe-Mail ohne Abmeldung waere bei 2 Mails am Tag ein Spam-Magnet.
      abmelde_url: "https://www.fiaon.com/abmelden/beispielschluessel",
    },
  },
  {
    type: "lead_willkommen",
    label: "Lead-Begrüßung (sofort nach dem Formular)",
    description: "E-210: Feuert einmal, sobald ein neuer Lead eingeht (Meta direkt, Make, nachgeholt) — die Antwort auf sein Formular mit dem persönlichen, vorausgefüllten Antragslink. Direktversand über den Mail-Motor; Schalter lead_willkommen_an im Lead-Motor (/chef/s/lead-motor).",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      nachname: "Beispiel",
      lead_id: 1234,
      anrede: "Guten Tag Lena Beispiel,",
      betreff: "Lena, Ihr Antrag bei FIAON ist vorbereitet",
      einstieg: "Ihre Anfrage ist bei uns angekommen, und Ihr Antrag ist schon vorbereitet: Ihren Namen, Ihre E-Mail-Adresse und Ihre Telefonnummer haben wir für Sie eingetragen.",
      antrag_url: "https://fiaon.com/a/Ab3dEf7hJk/m",
      abmelde_url: "https://www.fiaon.com/abmelden/beispielschluessel",
    },
  },
  {
    type: "lead_application_link",
    label: "Antrags-Link an Lead (Ein-Klick durch Mitarbeiter)",
    description: "Feuert, wenn ein Mitarbeiter im Lead-Detail „Zum Antrag bewegen“ auslöst — schickt dem Interessenten den vorbereiteten Antrags-Link. Vorgesetzten-TODO: Make-Zweig lead_application_link + Brevo-Template.",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      telefon: "+491701234567",
      lead_id: 1234,
      agent_name: "Anna Schmidt",
      anrede: "Guten Tag Lena Beispiel,",
      antrag_url: "https://fiaon.com/a/Ab3dEf7hJk/a",
    },
  },
  {
    type: "agent_feedback_rewarded",
    label: "Feedback-Bonus gutgeschrieben (Mitarbeiter)",
    description: "Feuert, wenn der Admin ein Agent-Feedback mit einer einmaligen Provisions-Gutschrift honoriert. Vorgesetzten-TODO: Make-Zweig + Brevo-Template anlegen.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag_eur: "25.00",
      feedback_titel: "Kalender: Wochenansicht auf Mobile verbessern",
    },
  },
  {
    type: "agent_feedback_reply",
    label: "Antwort auf Feedback-Ticket (Mitarbeiter)",
    description: "Feuert, wenn der Vorgesetzte im Feedback-Thread eines Mitarbeiters antwortet — der Agent wird per Mail informiert und antwortet im selben Ticket (kein neues Ticket). Vorgesetzten-TODO: Make-Zweig 'agent_feedback_reply' + Brevo-Template mit Link zu portal_url anlegen.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      feedback_id: 11,
      feedback_titel: "Kalender: Wochenansicht auf Mobile verbessern",
      antwort: "Danke für den Hinweis — wir haben die Wochenansicht angepasst, schau sie dir gern an.",
      portal_url: "https://www.fiaon.com/agent/feedback",
    },
  },
  {
    type: "number_update_request",
    label: "Telefonnummer aktualisieren (Kunde/Lead)",
    description: "Feuert, wenn ein Mitarbeiter das Kontakt-Ergebnis „Falsche Nummer“ wählt UND eine E-Mail hinterlegt ist — schickt dem Kunden/Lead einen Button „Nummer aktualisieren“ zu einem schlanken Formular. Neue Nummer landet direkt im Datensatz (Audit „vom Kunden selbst aktualisiert“), der Lead/Kunde wird wieder anrufbar. Max. 1× pro Tag/Person. Vorgesetzten-TODO: Make-Zweig 'number_update_request' + Brevo-Template mit Button zu update_url anlegen.",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      update_url: "https://www.fiaon.com/nummer-aktualisieren?token=YXBwOkZJQU9OLi4u.0f3a9b7c2e4d",
      // 18.09.2026: Die Vorlage zeigt den Terminlink jetzt als zweiten Weg.
      termin_link: "https://www.fiaon.com/termin/7f3a…?von=nummer_korrektur",
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // EMPFEHLUNGEN (Teil 1.3) — registriert, damit der Vorgesetzte sie auf
  // /admin/events testen und den Make-Zweig bauen kann. Es ist bewusst NOCH
  // KEIN automatischer Versand im Code verdrahtet (recommendationOnly). Sobald
  // Template + Make-Zweig stehen, kann der Versand auf Wunsch aktiviert werden.
  // ════════════════════════════════════════════════════════════════════
  {
    type: "payment_cancelled",
    label: "Bestellung storniert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine Bestellung storniert wird (/admin/payments/:ref/cancel). Der Vorgesetzte vermisst hier ausdrücklich ein testbares Event. Vorgesetzten-TODO: Make-Zweig 'payment_cancelled' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Auf Kundenwunsch storniert" },
  },
  {
    type: "payment_reactivated",
    label: "Bestellung reaktiviert — neue Zahlungsfrist (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine abgelaufene Bestellung reaktiviert wird (neue 7-Tage-Frist). Hinweis: Beim Reaktivieren wird bereits 'payment_details' erneut versendet — ein eigenes Event ist optional. Vorgesetzten-TODO: Make-Zweig 'payment_reactivated' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE, faellig_am: "2026-07-26" },
  },
  {
    type: "documents_change_request",
    label: "Dokumente-Änderung angefordert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn der Admin eine Dokumenten-Nachbesserung anfordert (changes_requested). Vorgesetzten-TODO: Make-Zweig 'documents_change_request' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    // E-240 (24.09.2026): Knopftexte und -ziele bringt der Auslöser mit (Anfordern an den Unterlagen) —
    // hier der Fall ohne Auskunft-Angebot: Hochladen als Hauptweg, das eigene Passwort daneben.
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Ihre Kontoauszüge der letzten drei Monate.",
      knopf_text: "Jetzt hochladen", knopf_url: "https://www.fiaon.com/login",
      knopf2_text: "Noch kein Passwort? Hier festlegen", knopf2_url: "https://www.fiaon.com/passwort-vergessen",
      unterlagen_arten: "kontoauszug" },
  },
  {
    type: "zustimmung_link",
    label: "Zustimmungs-Link (Kunde)",
    description: "E-184 (11.09.2026): Der Betreuer schickt aus der Akte den Link, über den der Kunde AGB/Datenschutz, Bonitätsprüfung und Vertragsannahme selbst bestätigt (30 Tage gültig). Vorher lief das über documents_change_request, das nur die Verwaltung senden darf — die Mail ging nie raus.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, zustimmung_url: "https://www.fiaon.com/zustimmung/FIAON-BEISPIEL.1760000000.0123456789abcdef0123456789abcdef", offen: "Zustimmung zu den AGB, SCHUFA-Einwilligung, Zustimmung zum Vertrag", paket: "FIAON Ultra", paket_satz: " über FIAON Ultra" },
  },
  // ── FIAON Global (E-188, 17.09.2026) ────────────────────────────────────
  // customerBound: false — die Nutzlast entsteht aus der Auftragsakte
  // (fiaon_global_auftraege), nicht aus einer Bestellzeile allein, und
  // `global_auftrag` braucht die beiden PDF-Anhänge. „Für echten Kunden senden"
  // würde eine Mail ohne Vertrag und Rechnung verschicken.
  {
    type: "global_auftrag",
    label: "FIAON Global: Auftrag eingegangen — Vertrag + Rechnung (Firmenkunde)",
    description: "Geht automatisch direkt nach der Unterschrift auf /business/start, mit dem unterschriebenen Auftrag und der Rechnung als PDF. Immer Direktversand über den Motor — Make trägt keine Anhänge.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      betrag_text: "2.499,00 €", antrag_id: "FIAON-MB2XK4LQ-7T9A", payment_reference: "FIAON-A1B2C3", faellig_am_text: "24.09.2026",
      zahlungsseite_url: "https://www.fiaon.com/zahlung/FIAON-A1B2C3", ansprechpartner: "Herr Beispiel",
    },
  },
  {
    type: "global_start",
    label: "FIAON Global: Zahlung eingegangen — wir starten (Firmenkunde)",
    description: "Geht automatisch nach der Zahlungsbuchung eines Global-Auftrags — erst, wenn die Aufgabe „US-Struktur starten“ bei der zuständigen Person liegt. Ersetzt für Global die Privatkunden-Mail payment_confirmed.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      betrag_text: "2.499,00 €", antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
    },
  },
  {
    type: "global_stichtag",
    label: "FIAON Global: Stichtag für Gesellschaft und EIN (Firmenkunde)",
    description: "Von Hand aus /chef/s/global-auftraege, wenn der im Startgespräch vereinbarte Stichtag gesetzt wird — die Mitteilung in Textform, die der Auftrag zusagt.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", stichtag_text: "30.10.2026", ansprechpartner: "Herr Beispiel",
    },
  },
  // ── „Mein Auftrag" (E-188, 17.09.2026) — der Bereich des Firmenkunden nach dem Kauf.
  // customerBound: false wie oben: Die Nutzlast entsteht aus der Auftragsakte, und der Link
  // trägt ein frisches, an die Antragsnummer gebundenes Token. Englische Fassung je Ereignis
  // über `sprache: "en"` in der Nutzlast.
  {
    type: "global_zugang",
    label: "FIAON Global: Zugang zu „Mein Auftrag“ (Firmenkunde)",
    description: "Frischer Link zu „Mein Auftrag“ (30 Tage). Geht raus, wenn der Kunde ihn auf der Seite mit seiner E-Mail-Adresse anfordert (POST /global/zugang) oder wenn die zuständige Person im Office „Zugang senden“ drückt. Immer Direktversand über den Motor.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
    },
  },
  {
    type: "global_etappe",
    label: "FIAON Global: neue Etappe im Auftrag (Firmenkunde)",
    description: "Von Hand aus dem Office (/agent/global/<ref>, „Etappe setzen“ mit Haken „dem Kunden mitteilen“) und beim Abschluss. Etappentitel und -text kommen aus shared/fiaon-global-bereich.ts; der dritte Absatz ist der persönliche Satz der zuständigen Person bzw. der nächste Schritt.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
      etappe_marke: "Etappe 2", etappe_titel: "Die erste Firmenkarte",
      etappe_text: "Mit vollständigen Dokumenten stellen Sie den ersten Antrag bei einem US-Herausgeber. Wir bereiten den Antrag vor; der Herausgeber entscheidet.",
      etappe_weiter: "Ihr nächster Schritt: Bitte laden Sie den aktuellen Adressnachweis hoch.",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
    },
  },
  {
    type: "global_frist",
    label: "FIAON Global: Erinnerung aus dem Pflichtenkalender (Firmenkunde)",
    description: "Geht automatisch aus dem Tageslauf global_tageslauf: rund einen Monat und rund eine Woche vor einem Termin des Pflichtenkalenders, je Marke genau einmal. Information ohne Beträge und Steuersätze; der Hinweis endet mit dem Satz, dass Steuerberater bzw. US-CPA die geltenden Fristen bestätigen.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Banking",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
      frist_titel: "Jahressteuer des Bundesstaats Delaware", frist_datum: "01.06.2027", frist_abstand: "in rund einem Monat",
      frist_hinweis: "Delaware erhebt die Jahressteuer für das Vorjahr; einen Jahresbericht reichen LLCs dort nicht ein. Ihr Steuerberater bzw. US-CPA bestätigt die für Sie geltenden Fristen.",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
    },
  },
  {
    type: "global_dokument",
    label: "FIAON Global: neues Dokument im Dokumentenraum (Firmenkunde)",
    description: "Geht raus, wenn die zuständige Person im Office ein Dokument für den Kunden sichtbar ablegt und „dem Kunden mitteilen“ gesetzt ist (höchstens eine Mail je Auftrag in zehn Minuten). Das Dokument selbst reist nie als Anhang.",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
      dokument_art: "EIN-Bestätigung der US-Steuerbehörde", dokument_name: "EIN_Muster_LLC.pdf",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
    },
  },
  {
    type: "global_zahlung_erinnerung",
    label: "FIAON Global: Zahlung steht noch aus — ruhige Erinnerung (Firmenkunde)",
    description: "Geht automatisch am dritten und am siebten Tag nach dem Auftrag, je Stufe genau einmal und nur solange der Auftrag offen ist (Lauf global_zahlung_takt, Berlin 8–20 Uhr, Mo–Sa). Ein Satz Anlass, Knopf zur Zahlungsseite, Vertrag und Rechnung über „Mein Auftrag“ — keine Mahnstufe, keine Bankdaten im Text. Am zehnten Tag folgt keine Mail, sondern eine dringende Aufgabe an die zuständige Person. Englische Fassung über sprache: \"en\".",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      betrag_text: "2.499,00 €", antrag_id: "FIAON-MB2XK4LQ-7T9A", payment_reference: "FIAON-A1B2C3",
      zahlungsseite_url: "https://www.fiaon.com/zahlung/FIAON-A1B2C3",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
      ansprechpartner: "Herr Beispiel", anlass: "Deshalb erinnern wir Sie kurz daran.",
    },
  },
  {
    type: "global_zugang",
    label: "FIAON Global: Link zu „Mein Auftrag“ (Firmenkunde)",
    description: "Ein frischer, signierter Link je Auftrag (30 Tage). Geht raus, wenn der Kunde ihn selbst anfordert (abgelaufener Link, POST /global/zugang), wenn ein Firmenkunde es am Privatkunden-Login oder über „Passwort vergessen“ versucht, oder wenn die zuständige Person ihn aus dem Office schickt. Firmenaufträge haben kein Passwort. Englische Fassung über sprache: \"en\".",
    customerBound: false,
    example: {
      email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
      antrag_id: "FIAON-MB2XK4LQ-7T9A", ansprechpartner: "Herr Beispiel",
      mein_auftrag_url: "https://www.fiaon.com/business/auftrag/FIAON-MB2XK4LQ-7T9A?t=1760000000000.0123456789abcdef0123456789abcdef",
    },
  },
  {
    type: "global_termin",
    label: "FIAON Global: Erstgespräch bestätigt (Unternehmen)",
    description: "E-188 (17.09.2026): Feuert sofort, wenn ein Unternehmen über den Gesprächskalender auf /business ein Erstgespräch zu FIAON Global bucht (server/lib/fiaon-global-termin.ts). Gesiezt, mit Firma und Paketwunsch im Datenkasten, Kalenderdatei als Link (kalender_url) und Storno-Link. Eigene Vorlage, weil termin_bestaetigung einen Privatkunden anspricht. Kein Make-Zweig nötig — die Vorlage liegt im Quelltext (server/mail/vorlagen/termin.ts).",
    // Die Nutzlast kommt aus der Buchung, nicht aus einer Bestellung — „für echten Kunden senden" gibt es hier nicht.
    customerBound: false,
    example: {
      email: "m.beispiel@beispiel-gmbh.de",
      name: "Maria Beispiel",
      firma: "Beispiel GmbH",
      telefon: "+49 30 1234567",
      paket: "Global Banking (4.999 €)",
      agent_vorname: "Nikita Boychenko",
      termin_datum: "22.09.2026",
      termin_uhrzeit: "10:30",
      termin_art: "FIAON Global – Erstgespräch",
      termin_dauer: "30",
      storno_link: "https://www.fiaon.com/termin/absagen/9b2c…?anrede=sie",
      kalender_url: "https://www.fiaon.com/api/fiaon/global/termine/kalender/9b2c….ics",
    },
  },
  // ── DIE BONITÄTSAUSKUNFT (24.09.2026, E-240) ─────────────────────────────
  // Bis heute standen alle drei als „EMPFEHLUNG (noch kein Auto-Versand)" hier,
  // und geliefert wurde nichts: 59 von 66 Käufern ohne Dokument. Jetzt feuert
  // das System sie selbst aus dem Liefer-Weg (server/lib/fiaon-auskunft-lieferung.ts)
  // — Direktversand über den Motor, Vorlagen in server/mail/vorlagen/auskunft-lead.ts.
  {
    type: "schufa_approved",
    label: "Datenkopie eingegangen (Kunde)",
    description: "Feuert automatisch, wenn ein Mitarbeiter im Vorgang „Selbstauskunft“ das Ergebnis „Datenkopie eingegangen“ (bewilligt) einträgt — eine Mail je Auskunftei, mit dem Hinweis, wer noch aussteht. Pflichtmail (Statusnachricht zu SEINEM Auftrag).",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, anrede: "Guten Tag Max Mustermann,", login_url: "https://www.fiaon.com/app/vorgaenge", auskunftei: "SCHUFA", rest_satz: "Von CRIF und Creditreform Boniversum steht die Antwort noch aus — sobald sie da ist, sagen wir Ihnen Bescheid." },
  },
  {
    type: "schufa_rejected",
    label: "Rückfrage einer Auskunftei (Kunde)",
    description: "Feuert automatisch, wenn ein Mitarbeiter im Vorgang „Selbstauskunft“ das Ergebnis „abgelehnt“ einträgt — die Auskunftei hat eine Rückfrage (frühere Anschrift, Identitätsnachweis). Der Grund ist der Satz des Mitarbeiters (Wortwand geprüft). Gleichzeitig entsteht die Aufgabe „Ablehnung besprechen“.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, anrede: "Guten Tag Max Mustermann,", login_url: "https://www.fiaon.com/app/vorgaenge", auskunftei: "CRIF", grund: "Die Auskunftei bittet um Ihre frühere Anschrift, um Sie eindeutig zuzuordnen." },
  },
  {
    type: "schufa_requested",
    label: "Auskunft beauftragt: bitte unterschreiben (Kunde)",
    description: "Feuert automatisch nach der Zahlung einer Bonitätsauskunft (onCustomerPaid → lieferungStarten), genau einmal je Bestellung: Die Anfragen an die Auskunfteien des Landes sind angelegt, der Kunde unterschreibt Vollmacht und Anfragen über unterschrift_url (/app/unterschrift). Im Einkauf (E-241) nur, wenn für die Bestellung keine Einwilligung dokumentiert ist — dann als Bitte um die Auftragsbestätigung (eigene Vorlage AUSKUNFT_AUFTRAG_BESTAETIGEN, Knopf „Auftrag bestätigen“ → /api/fiaon/auskunft/auftrag/:token; auch von Hand aus dem Chefbüro, Auskunft-Beschaffung, „Auftragsbestätigung senden“). Pflichtmail — er hat bezahlt.",
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      antrag_id: "FIAON-SCHUFA-MB2XK4LQ-7T9A",
      paket: "Bonitätsauskunft inkl. Handlungsplan",
      anrede: "Guten Tag Max Mustermann,",
      auskunfteien: auskunfteienText("DE"),
      ...schufaRequestedSaetze("vollmacht"),
      unterschrift_satz: "Damit wir das dürfen, unterschreiben Sie bitte einmal die Vollmacht zur Übermittlung und gleich danach Ihre drei Anfragen — nacheinander auf einer Seite, mit dem Finger am Bildschirm.",
      unterschrift_url: "https://www.fiaon.com/app/unterschrift/123.1799999999000.0f3a9b7c2e4d0f3a9b7c2e4d0f3a9b7c",
      login_url: "https://www.fiaon.com/app/vorgaenge",
    },
  },
  {
    type: "auskunft_angebot",
    // Gegenlesen 25.09.2026 (E-241): Beschreibung auf die drei Segmente und den Kreis des Verkaufstakts nachgezogen.
    // 26.09.2026 (E-243): vier Segmente (neu: abbrecher), neue Winkel je Fassung, zwei Betreffs je Stufe, Paketweg.
    label: "Angebot Bonitätsauskunft (Werbung)",
    description: `WERBUNG an Menschen ohne Auskunft — je nach Kreis des Verkaufstakts (auskunft_verkauf_kreis): „uwg“ nur zahlende Kunden nach dem 02.09.2026 12:35 (§ 7 Abs. 3 UWG), „alle“ dazu fertige, unbezahlte Anträge, Leads und Abbrecher (Antrag begonnen, nicht fertig). Texte: segment kunde | antrag | lead | abbrecher × fassung a („Abgelehnt — und keiner sagt Ihnen, warum?“) | b („Vorsicht bei ‚Kredit ohne SCHUFA‘“ — AT „ohne KSV“, CH „ohne Bonitätsprüfung“ — mit der ehrlichen Antwort zur kostenlosen Datenkopie) | c („Wissen, was die Bank sieht — bevor sie entscheidet“, kurz, ohne Druck), jeweils mit eigenen Firmen-Sätzen und zwei Betreffzeilen im Wechsel (betreff_variante 1 | 2, ohne Angabe aus der Person). Inhalt: was wir tun, bei welchen Auskunfteien (je Land, AT/CH nie „SCHUFA“), Preis (Kunde mit Paket ${euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo)}, sonst ${euroText(AUSKUNFT_PREISE_CENTS.privat.einzeln)}; Firma ${euroText(AUSKUNFT_PREISE_CENTS.firma.mitAbo)} / ${euroText(AUSKUNFT_PREISE_CENTS.firma.einzeln)}; beim Antrag mit Hinweis auf den Paketpreis, paket_preis_hinweis), Knopf „Auskunft für … beauftragen“ (kauf_url) und darunter entweder „Schon eine aktuelle Auskunft? Hier hochladen“ (upload_url, nur Kunde und Antrag) oder — bei Lead und Abbrecher, privat — der Paketweg „Lieber gleich mit FIAON-Paket? Dann ${euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo)} für die Auskunft“ (paket_url, sonst /antrag?src=auskunft&auskunft=1 — dort steht der Zusatz „Auskunft zum Kundenpreis dazubestellen“ aufgeklappt, nie vorangekreuzt, fällig erst nach der ersten Paketzahlung; paket_weg=false schaltet ihn aus). Abmeldelink und Widerspruchs-Hinweis Pflicht; die Tür lehnt ab bei Werbesperre (auch von Hand), Vertriebssperre, gekaufter oder vorliegender Auskunft, Kündigung und — im Kreis „uwg“ automatisch — ohne Grundlage nach § 7 Abs. 3 UWG (Regel: sperrUrteil in fiaon-mail-frequenz.ts). Nutzlast und Vorprüfung: auskunftAngebotNutzlast / auskunftAngebotSperre (server/lib/fiaon-auskunft-lieferung.ts), für den Takt angebotNutzlast (server/lib/fiaon-auskunft-verkauf.ts).`,
    customerBound: false,
    example: {
      email: "max.mustermann@example.com",
      person_id: 4711,
      vorname: "Max",
      nachname: "Mustermann",
      anrede: "Guten Tag Max Mustermann,",
      preis_text: euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo),
      mit_abo: true,
      land: "DE",
      art: "privat",
      auskunfteien: auskunfteienText("DE"),
      leistung: auskunftLeistung("privat", "DE"),
      // E-241 (25.09.2026): Segment (kunde | antrag | lead, seit E-243 auch abbrecher) und Fassung (a | b | c)
      // wählen den Text (server/mail/vorlagen/auskunft-verkauf.ts). paket_preis_hinweis nennt beim Antrag
      // den Preis mit aktivem Paket (ohne Angabe: nur im Segment „antrag"); beim Kunden nie.
      // E-243 (26.09.2026): betreff_variante 1 | 2 — ohne Angabe im Wechsel aus der Person.
      segment: "kunde",
      fassung: "a",
      betreff_variante: 1,
      kauf_url: "https://www.fiaon.com/api/fiaon/auskunft/bestellen?p=4711&art=privat&exp=1799999999000&sig=0f3a9b7c2e4d",
      upload_url: "https://www.fiaon.com/app/unterlagen",
      abmelde_url: "https://www.fiaon.com/api/fiaon/abmelden/p/4711.0f3a9b7c2e4d",
    },
  },
  // ── DER KUNDENPREIS-LINK (26.09.2026, E-243) ─────────────────────────────
  {
    type: "auskunft_kundenpreis",
    label: "Kundenpreis-Link Bonitätsauskunft (Kunde)",
    description: `Feuert automatisch, wenn jemand auf /bonitaet-antrag „Kundenpreis-Link anfordern“ klickt (POST /api/fiaon/auskunft/kundenpreis, server/routes/fiaon-auskunft-kauf.ts) und zur Adresse eine Person mit laufendem, bezahltem Paket gehört — die Seite antwortet immer gleich, die Mail geht nur an die Adresse der Person. Inhalt: Kundenpreis vom Server (${euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo)}, Firma ${euroText(AUSKUNFT_PREISE_CENTS.firma.mitAbo)}), Auskunfteien je Land, ein Knopf: der signierte Kauflink (Bestätigungsseite mit Beschaffungsauftrag, dann Zahlungsseite) oder die Zahlungsseite einer schon offenen Auskunft. Keine Werbung (selbst angefordert, in PFLICHTMAILS); nicht an Gelöschte, Gekündigte, gesperrte Konten, Vertriebssperre, bezahlte oder gemeldete Auskünfte. Bremse: 3 je Adresse, 20 je IP und Stunde, dazu höchstens 5 je Person in 24 Stunden (Mail-Protokoll).`,
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      anrede: "Guten Tag Max Mustermann,",
      was: "Ihre Bonitätsauskunft",
      preis_text: euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo),
      auskunfteien: auskunfteienText("DE"),
      leistung_satz: `Das bekommen Sie: Wir holen Ihre Auskunft bei ${auskunfteienText("DE")} ein, erklären jeden Eintrag in klaren Worten, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.`,
      weg_satz: "Mit dem Knopf öffnen Sie Ihre Bestellung. Ihre Angaben kennen wir aus Ihrem Konto: Sie sehen Leistung und Preis, bestätigen den Auftrag und kommen danach direkt zur Zahlungsseite.",
      knopf_text: `Auskunft für ${euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo)} beauftragen`,
      kauf_url: "https://www.fiaon.com/api/fiaon/auskunft/bestellen?p=4711&art=privat&exp=1799999999000&sig=0f3a9b7c2e4d0f3a9b7c2e4d0f3a9b7c",
      gueltig_tage: "14",
      auskunft_art: "privat",
      auskunft_land: "DE",
    },
  },
  {
    type: "account_activated",
    label: "Konto wieder freigeschaltet (Kunde)",
    // 18.09.2026: Die Beschreibung sprach von einer Empfehlung ohne Versand —
    // gesendet wird sie seit dem 28.08. beim Entsperren in der Akte, und bis
    // heute auch nach dem Startgespräch (dort jetzt bereich_freigeschaltet).
    description: "Die Entsperrungs-Mail „Ihr Zugang ist wieder frei“: feuert, wenn ein gesperrtes Konto in der Akte wieder freigeschaltet wird (fiaon-agent-kunden.ts), mit login_url. Die erste Freischaltung nach dem Startgespräch ist bereich_freigeschaltet. Bei Zahlung läuft payment_confirmed.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "account_suspended",
    label: "Konto gesperrt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Konto vom Admin gesperrt wird (account_status='suspended'). Vorgesetzten-TODO: Make-Zweig 'account_suspended' + Brevo-Template. Sensibel — Text sorgfältig wählen.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Rückfrage zu den eingereichten Unterlagen" },
  },
  {
    type: "profile_query",
    label: "Profil-Rückfrage (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn der Admin eine Profil-Rückfrage stellt (profile_changes_requested). Vorgesetzten-TODO: Make-Zweig 'profile_query' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Bitte ergänzen Sie Ihre monatlichen Ausgaben im Profil." },
  },
  {
    type: "gdpr_deleted",
    label: "Löschbestätigung DSGVO (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Kunde per DSGVO gelöscht/anonymisiert wird — Bestätigung der Löschung. Achtung: Nach der Anonymisierung ist die E-Mail-Adresse ggf. nicht mehr verfügbar; ggf. VOR der Anonymisierung senden. Vorgesetzten-TODO: Make-Zweig 'gdpr_deleted' + Brevo-Template.",
    customerBound: false,
    recommendationOnly: true,
    example: { email: "max.mustermann@example.com", vorname: "Max", geloescht_am: "2026-07-19" },
  },
  {
    type: "contract_signed",
    label: "Vertrag signiert (Mitarbeiter)",
    description: "Feuert, wenn ein Agent den Handelsvertretervertrag digital signiert. Vorgesetzten-TODO: Make-Zweig 'contract_signed' + Brevo-Template (Vertrags-PDF-Kopie an den Agenten).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      agent_name: "Anna Schmidt",
      contract_version: 1,
      signed_at_text: "Mi, 15.07.2026 um 12:30 Uhr",
      doc_hash: "9f2c…",
      download_url: "/api/fiaon/agent/documents/contract/1.pdf",
    },
  },
  {
    type: "commission_statement_issued",
    label: "Provisions-Abrechnung erstellt (Mitarbeiter)",
    description: "Feuert bei jeder bestätigten Auszahlung, sobald die Provisions-Abrechnung/Gutschrift (PDF) erzeugt wurde. Vorgesetzten-TODO: Make-Zweig 'commission_statement_issued' + Brevo-Template.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      statement_no: "FIAON-COM-2026-0001",
      betrag: "125.50",
      doc_hash: "a1b2…",
    },
  },
  // ── /app Scheibe 6, Modul C (06.09.2026): Anmelde-Link ohne Passwort ──────
  // Feuert, wenn der Kunde unter /app/login seine Adresse eingibt und zu ihr ein
  // Konto gehört (Auswahlregel wie der Passwort-Login). Der Link ist ein
  // Geheimnis: 60 Minuten, einmal nutzbar. Quelltext-Vorlage: mail/vorlagen/app.ts.
  {
    type: "app_login_link",
    label: "Anmelde-Link Mein FIAON (Kunde)",
    description: "Feuert auf Anforderung des Kunden unter /app/login (E-Mail ohne Passwort) — nur, wenn zu der Adresse ein Konto gehört; Link gilt 60 Minuten und genau einmal.",
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      // Die API-Route selbst (antwortet mit 302) — eine Client-Route gibt es nicht.
      login_link_url: "https://www.fiaon.com/api/fiaon/app/login/link/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo",
      login_url: "https://www.fiaon.com/app/login",
      gueltig_minuten: "60",
    },
  },
  // ── /app Scheibe 6, Modul A (06.09.2026): Monatsbericht ───────────────────
  // Der Typ steht noch nicht in MakeEventType (server/make-webhook.ts) — die
  {
    type: "app_monatsbericht",
    label: "Monatsbericht Mein FIAON (Kunde)",
    description: "Scheibe 6, Modul A: Am 1. bis 3. eines Monats erzeugt monatsberichtLauf (server/lib/fiaon-monatsbericht.ts) für jede Person mit bezahlter Bestellung den Bericht des Vormonats — ein Beleg, der nie neu gerechnet wird. Die Mail geht NUR bei fiaon_settings.app_bericht_mail = 'an' (Standard aus; Justin/TFO schalten); ohne Schalter steht der Bericht nur in der App unter Geld → Bericht.",
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      monat_text: "August 2026",
      grosse_zahl_text: "Im August für Sie geholt: 597,42 € im Monat.",
      betrag_text: "597,42 €",
      bericht_url: "https://www.fiaon.com/app/geld/bericht/2026-08",
    },
  },
];

export function getEventDef(type: string): MakeEventDef | undefined {
  return MAKE_EVENT_REGISTRY.find((e) => e.type === type);
}
