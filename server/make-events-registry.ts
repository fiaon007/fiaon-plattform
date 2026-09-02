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
    label: "Willkommen (Antrag eingegangen)",
    description: "Feuert genau einmal, sobald ein Antrag mit gültiger E-Mail-Adresse abgeschlossen wurde.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE },
  },
  {
    type: "payment_details",
    label: "Zahlungsdaten (Bestellung angelegt)",
    description: "Feuert genau einmal beim Übergang zu pending_payment (Bestellung/Reaktivierung) — enthält Bankdaten-Kontext und Rechnungs-Link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE },
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
      faellig_am_text: "03.09.2026",
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
  // ══════════════════════════════════════════════════════════════════════════
  // TEXTVORSCHLAG „sepa_einrichten" (Sie-Form, sachlich, kein Druck):
  //
  //   Betreff: Ihre Folgeraten bequem per Lastschrift
  //
  //   Guten Tag {{vorname}},
  //
  //   Ihre erste Zahlung haben Sie bereits überwiesen — vielen Dank dafür.
  //   Damit Sie an die kommenden Raten nicht mehr denken müssen, können Sie
  //   die Lastschrift in Ihrem Kundenbereich in einer Minute einrichten:
  //
  //   {{kundenbereich_link}}
  //
  //   Sie behalten dabei jederzeit die Kontrolle und können die Lastschrift
  //   selbst wieder beenden. Wenn Sie lieber weiter überweisen, ist das
  //   ebenfalls in Ordnung — sagen Sie uns einfach kurz Bescheid.
  //
  //   Ihr Team von FIAON
  //
  // WICHTIG fuer die Vorlage: Die ERSTE Zahlung ist IMMER eine Ueberweisung.
  // Die Lastschrift betrifft ausschliesslich die Folgeraten — ein Text, der
  // das vermischt, erzeugt Rueckfragen und Rueckbuchungen.
  // ══════════════════════════════════════════════════════════════════════════
  {
    type: "sepa_einrichten",
    label: "Lastschrift einrichten (Kunde)",
    description:
      "Wird vom Mitarbeiter im Bestand-Raum ausgelöst, wenn ein Kunde noch keine Lastschrift für die Folgeraten hinterlegt hat. Kein Automatiklauf — immer ein bewusster Klick auf der Kundenkarte. Vorgesetzten-TODO: Make-Zweig 'sepa_einrichten' + Brevo-Vorlage in Sie-Form anlegen (Variablen: vorname, kundenbereich_link, agent_vorname). Textvorschlag: siehe Kommentar über diesem Eintrag.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      agent_vorname: "Daniel",
      kundenbereich_link: "https://www.fiaon.com/kundenbereich",
    },
  },
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
      "Wird vom Mitarbeiter in der Akte ausgeloest, sobald ein Kunde alle drei Bedingungen erfuellt: Antrag vollstaendig, Paket und Auskunft bezahlt mit mindestens zwei gelaufenen Raten, Kontoauszug und Ausweis vorhanden. Kein Automatiklauf - immer ein bewusster Klick, und der Server prueft die Bedingungen selbst noch einmal. Vorgesetzten-TODO: Make-Zweig 'konto_karte_einladung' + Brevo-Vorlage in Sie-Form anlegen (Variablen: vorname, partner_link, agent_vorname). Textvorschlag: siehe Kommentar ueber diesem Eintrag. Das Wort 'Affiliate' darf in der Vorlage NICHT vorkommen.",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      agent_vorname: "Daniel",
      partner_link: "https://www.awin1.com/cread.php?awinmid=11329&awinaffid=3050049&clickref=FIAON-P12345&clickref2=A928",
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
    description: "Feuert genau einmal, wenn der Kunde auf „Ich habe die Überweisung getätigt“ klickt — dankt und nennt das Freischalt-Zeitfenster (werktags bis 18:00 Uhr).",
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
      antrag_url: "https://www.fiaon.com/antrag?lead=1234",
      // 28.08.2026: Der echte Lauf liefert den Abmeldelink immer mit — eine
      // Werbe-Mail ohne Abmeldung waere bei 2 Mails am Tag ein Spam-Magnet.
      abmelde_url: "https://www.fiaon.com/leads/abmelden/1234/beispielschluessel",
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
      antrag_url: "https://www.fiaon.com/antrag?lead=1234",
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
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Bitte laden Sie einen aktuellen Kontoauszug (letzte 3 Monate) hoch." },
  },
  {
    type: "schufa_approved",
    label: "SCHUFA/Bonität genehmigt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine SCHUFA-/Bonitätsprüfung genehmigt wird. Vorgesetzten-TODO: Make-Zweig 'schufa_approved' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "schufa_rejected",
    label: "SCHUFA/Bonität abgelehnt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine SCHUFA-/Bonitätsprüfung abgelehnt wird. Vorgesetzten-TODO: Make-Zweig 'schufa_rejected' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Eingereichtes Dokument nicht lesbar" },
  },
  {
    type: "schufa_requested",
    label: "Neues SCHUFA-Dokument angefordert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein neues SCHUFA-/Bonitätsdokument angefordert wird. Vorgesetzten-TODO: Make-Zweig 'schufa_requested' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    // 28.08.2026 (Justin): WIR holen die Auskunft ein und laden sie hoch —
    // der Kunde tut nichts. Der alte Beispiel-Hinweis beschrieb den falschen Weg.
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Wir holen Ihre Auskunft für Sie ein — Sie müssen nichts tun." },
  },
  {
    type: "account_activated",
    label: "Konto aktiviert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Konto vom Admin aktiviert wird (account_status='active'). Hinweis: Bei Zahlung läuft bereits 'payment_confirmed' — dieses Event ist für manuelle Aktivierungen ohne Zahlungstrigger. Vorgesetzten-TODO: Make-Zweig 'account_activated' + Brevo-Template.",
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
];

export function getEventDef(type: string): MakeEventDef | undefined {
  return MAKE_EVENT_REGISTRY.find((e) => e.type === type);
}
