// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 2 — Die Plattform, Raum für Raum (23.08.2026, Plan §11)
// Quellen: shared/fiaon-wissen.ts, shared/fiaon-pakete.ts (Preise nur von dort),
// client/src/pages/antrag.tsx, mein-bereich.tsx, demo-kundenbereich.tsx,
// OfficeShell.tsx (Räume), Plan §4/§7/§10.4.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, ol, merk, warn, tab, sichten, kacheln, link, frage } from "./typen";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { SUPPORT } from "@shared/fiaon-wissen";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const PRIVAT = PAKETE.filter((x) => x.abo && x.art === "privat");
const BUSINESS = PAKETE.filter((x) => x.abo && x.art === "business");
const preis = (key: string) => eur(PAKETE.find((x) => x.key === key)?.preisCents ?? 0);
const schufa = SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";

export const KAPITEL_2: KapitelInhalt = {
  inhalte: {
    antrag: {
      einleitung: "fiaon.com/antrag: etwa zwei Minuten, neun Schritte, und am Ende ist der Kunde eingeloggt. Du musst wissen, was er dort sieht – weil du am Telefon oft daneben sitzt.",
      bloecke: [
        tab(["Schritt", "Was der Kunde sieht", "Was im System steht"],
          ["0 · Start", "Paketwahl (von /privatkunden oder direkt), Hinweis auf zwei Minuten", "Antrag angelegt: Zustand „started“"],
          ["1 · Persönliches", "E-Mail, Name, Geburtsdatum, Telefon", "„personal_data“ – ab hier kann die Abbruch-Erinnerung greifen"],
          ["2 · Finanzen", "Beschäftigung, Einkommen, Wunschlimit", "„finances“"],
          ["3 · Konfiguration", "Adresse (füllt sich beim Tippen über Photon aus), Paket prüfen, Upgrade dezent", "„config“"],
          ["4 · Prüfung", "Zusammenfassung, Zusagen (drei Häkchen)", "„verifying“"],
          ["5 · Freigabe", "Vertrag lesen", "„approved“"],
          ["6 · Vertrag", "Vertrag annehmen", "„contract“"],
          ["7/8 · Abschluss", "Bestätigung, Weiterleitung in den Bereich", "„processing“ / „completed“"],
          ["9 · Passwort", "Passwort festlegen – der Kunde ist sofort eingeloggt", "„submitted“ – der Antrag ist abgeschickt, eine Rechnung kann gestellt werden"],
        ),
        p("Direkt nach dem Vertrag stehen zwei Karten, und keine lässt sich wegklicken: „Jetzt aktivieren“ (Zahlungsdaten mit QR-Code, Kopieren-Knopf, Lastschrift-Mandat) oder „Zuerst sprechen“ (Termin mit dir). Wer „Zuerst sprechen“ wählt, braucht später kein zweites Startgespräch – derselbe Termin wird zum Startgespräch."),
        p("Abbruch-Erinnerungen: Wer den Antrag nach Schritt 1 liegen lässt, bekommt drei Stufen Erinnerung (nach 10 Minuten, dann in Tages-Slots). Seit dem Office-Umbau enthalten sie einen Terminlink statt einer Zahlungsaufforderung – ein Gespräch mit dir schließt mehr ab als eine Mahnung."),
        merk("Der Antrag ist kein Formular, das du erklärst. Er ist die Strecke, an deren Ende dein Kunde steht. Geh sie selbst einmal durch: fiaon.com/antrag – und brich vor der Zahlung ab."),
        link("/antrag", "Antragsstrecke öffnen"),
      ],
    },
    pakete: {
      einleitung: "Preise kommen aus dem Paketkatalog – nie aus dem Kopf. Diese Tabelle wird aus demselben Katalog erzeugt, den der Antrag und die Rechnung benutzen.",
      bloecke: [
        tab(["Paket (Privat)", "Monat", "Deine Provision je Rate (25 %)"], ...PRIVAT.map((x) => [x.label, eur(x.preisCents), eur(Math.round(x.preisCents * 0.25))])),
        tab(["Paket (Geschäft)", "Monat", "Deine Provision je Rate (25 %)"], ...BUSINESS.map((x) => [x.label, eur(x.preisCents), eur(Math.round(x.preisCents * 0.25))])),
        p(`Ohne Paket, einmalig: Bonitätsauskunft ${schufa} – kein Abo, erzeugt nie eine Rate. Sie wird im Kundenbereich angeboten, sobald das Paket bezahlt ist. Im Startgespräch erklärst du sie als Auskunft, nicht als Rat; der Kunde entscheidet selbst.`),
        ul(
          "Zwölf Raten: erste Rate per Überweisung (QR-Code im Bereich) oder Lastschrift, weitere Raten per SEPA-Lastschrift (GoCardless) – Geld landet direkt auf dem FIAON-Konto bei Wise.",
          "Nach der zwölften Rate entscheidet der Kunde, ob er bleibt. Deine Provision läuft auch in der Verlängerung.",
          "Paketwechsel ist im Antrag und im Startgespräch möglich. Ein Upgrade wird dezent angeboten, nie gedrückt.",
          `Der Provisionssatz ist eine Einstellung der Geschäftsführung (Standard 25 %); Zertifizierte Bonitätsmanager erhalten 5 Prozentpunkte mehr.`,
        ),
        warn(`Ein Fehler, der Geld und Vertrauen gekostet hat: Zwei Preislisten im Code widersprachen sich (Ultra ${preis("ultra")} im Antrag, ein anderer Wert in der Rechnung). Seit dem 16.08.2026 gibt es genau eine Quelle. Wenn du einen Preis nennst, nimm ihn aus dem Office – nie aus der Erinnerung.`),
      ],
    },
    kundenbereich: {
      einleitung: "fiaon.com/login → „Mein Bereich“. Drei Gruppen, wie die drei Schichten: Einsicht, Aktion, Zugang – dazu das Konto.",
      bloecke: [
        tab(["Bereich", "Gruppe", "Was der Kunde dort tut"],
          ["Übersicht mit Fahrplan", "–", "Etappen: Startgespräch, Unterlagen, Bonitätsauskunft, Analyse, Schreiben, Girokonto, Kreditkarte. Was sich seit dem letzten Besuch getan hat. Ansprechpartner mit Namen."],
          ["Meine Bonität", "Einsicht", "Die Auskunft als Einträge, jeder erklärt: Gläubiger, Betrag, Meldedatum, Bewertung, Stand."],
          ["Konto verbinden", "Einsicht", "Kontoanbindung (wird freigeschaltet) – bis dahin Kontoauszug als Datei unter Unterlagen."],
          ["Meine Finanzen", "Einsicht", "Auswertung des Kontoauszugs: Einnahmen, Fixkosten, Spielraum."],
          ["Meine Schreiben", "Aktion", "Jedes Schreiben mit Datum, Empfänger, Weg (Einschreiben), Frist, Stand. Freigabe per Klick."],
          ["Unterlagen", "Aktion", "Kontoauszug der letzten drei Monate, Ausweis – Handyfoto genügt. Das Fehlen ist der häufigste Grund, warum es nicht weitergeht."],
          ["Meine Vorteile", "Zugang", "Girokonto, Karte, Partnerangebote – vorbereitet, die Bank entscheidet."],
          ["Mein Konto", "Konto", "Daten, Passwort & Sicherheit."],
          ["Abo & Zahlungen", "Konto", "Raten, Zahlungskalender, Lastschrift einrichten, Abo kündigen."],
          ["Hilfe", "Konto", "Anliegen an die Ansprechpartnerin – als Datensatz mit Zustand, landet bei dir unter Tickets."],
        ),
        p("Bis zum bezahlten Paket und zum geführten Startgespräch bleibt der Bereich geschlossen: Der Kunde sieht die zwei Karten (aktivieren / sprechen) und danach die Terminbuchung. Das ist gewollt – ein Bereich ohne Gespräch erzeugt Fragen, die niemand beantwortet."),
        sichten(
          "Einen Fahrplan mit Etappen, seine Einträge erklärt, seine Schreiben mit Fristen, seine Raten – und einen Menschen mit Namen.",
          "Dieselbe Akte von der anderen Seite: Pipeline → Akte. Dazu das, was der Kunde nicht sieht: Verlauf, Ergebnisse, Rückrufe, Provision.",
          "Abo-Motor (Raten), Mahnstufen, Mail-Log (fiaon_mail_log), Kontaktprotokoll (fiaon_contact_log), Tickets an das Back-Office.",
        ),
        merk("Wenn ein Kunde etwas nicht findet: Du öffnest das Demo-Konto und gehst mit ihm durch. Nie raten, was er sieht."),
        link("/login", "Kundenlogin öffnen"),
      ],
    },
    rundgang: {
      einleitung: "FIAON-DEMO ist ein festes Demo-Konto ohne Datenbank – Max Mustermann, Platzhalterdaten, 15 Stationen. Geh sie alle durch. Das Fenster unten zeigt das echte Demo; jede Station springt an die passende Stelle.",
      uebung: { art: "rundgang", stationen: [
        { anker: "kb-kopf", titel: "Ankunft", kunde: "Sieht beim Eintreten, was sich seit dem letzten Besuch getan hat – und seine Ansprechpartnerin mit Namen.", mitarbeiter: "Das bist du. Dein Name steht hier. Jede Nachricht, die du schreibst, landet in diesem Verlauf." },
        { anker: "kb-ziel", titel: "Das Ziel: Karten-Readiness", kunde: "Wie weit er von der Karte entfernt ist – in Prozent, mit Meilensteinen.", mitarbeiter: "Das Ziel ist die Karte, nicht „bessere Bonität“. Wer den Balken steigen sieht, kündigt nicht." },
        { anker: "kb-verlauf", titel: "Der Verlauf", kunde: "Eine Kurve mit Gründen: Eintrag gelöscht, Kontoanbindung aktiv.", mitarbeiter: "Jeden Monat ein Beweis – das ist das Abo-Argument im Startgespräch." },
        { anker: "kb-eintraege", titel: "Die Akte", kunde: "Einträge als Daten: falsch, verjährt, bezahlt-aber-nicht-gelöscht, angreifbar, berechtigt – mit Erfolgsaussicht.", mitarbeiter: "Du prüfst die Einschätzung, bevor der Kunde sie sieht. Aus tausend Akten lernt FIAON, welche Gläubiger löschen." },
        { anker: "kb-schreiben", titel: "Die Schreiben", kunde: "Briefe aus geprüften Vorlagen, per Einschreiben, mit Frist und Antwort.", mitarbeiter: "Du beauftragst das Schreiben als Ticket an das Back-Office; der Stand kommt in die Akte zurück." },
        { anker: "kb-freigabe", titel: "Ein Klick", kunde: "Der nächste Schritt liegt bereit – Beschwerde bei der Datenschutzbehörde, wartet auf Freigabe.", mitarbeiter: "Die Hürde war nie das Recht, sondern der Aufwand. Das ist der Satz für skeptische Kunden." },
        { anker: "kb-finanzen", titel: "Die Finanzen", kunde: "Gehalt, Fixkosten, Spielraum – 525 € im Monat – und Warnung vor Rücklastschriften.", mitarbeiter: "Dieselben Zahlen sind später die Vorqualifizierung für Karte und Finanzierung, ohne Anfrage, die den Wert senkt." },
        { anker: "kb-einigung", titel: "Die Einigung", kunde: "Ratenvereinbarungen und Vergleiche für berechtigte Forderungen – aus dem Bereich heraus.", mitarbeiter: "Nicht jeder Eintrag ist angreifbar. Der Erledigungsvermerk ist das Ziel – und die 100-Tage-Regel die Uhr." },
        { anker: "kb-nachrichten", titel: "Der Mensch", kunde: "Jede Frage landet bei der Person, die die Akte kennt – im Bereich und per WhatsApp.", mitarbeiter: "WhatsApp in der Akte kommt über Twilio (Plan §10.4). Bis dahin: Tickets und Telefon." },
        { anker: "kb-tresor", titel: "Der Tresor", kunde: "Auskunft, Datenkopie, Rückscheine, Antworten, Verträge – verschlüsselt in der EU.", mitarbeiter: "Eine fotografierte Mahnung wird erkannt und dem Eintrag zugeordnet. Bitte Kunden um Fotos, nicht um Beschreibungen." },
        { anker: "kb-zugang", titel: "Die Tür", kunde: "Konto eröffnet, Karte mit Termin, Finanzierung wartet – vorqualifiziert.", mitarbeiter: "Hier verdient FIAON das zweite Mal (Partnerprovision) – und der Kunde bekommt, weswegen er kam. Die Bank entscheidet." },
        { anker: "kb-simulator", titel: "Der Simulator", kunde: "Was passiert, wenn … – Hebel umlegen, Wirkung sehen.", mitarbeiter: "Aus Ratlosigkeit wird ein Plan. Zeig ihn im Startgespräch, wenn der Kunde fragt, „was bringt das?“." },
        { anker: "kb-wissen", titel: "Der Burggraben", kunde: "Worauf seine Erfolgsaussicht beruht: anonymisiertes Wissen aus allen Akten.", mitarbeiter: "Das ist die Investoren-Geschichte: Jede Akte macht die nächste besser." },
        { anker: "kb-abo", titel: "Warum das trägt", kunde: `${preis("pro")} im Monat per Lastschrift – und in jedem Monat steht, was dafür passiert ist.`, mitarbeiter: "Nach der zwölften Rate fragt FIAON, ob er bleibt. Die Kurve beantwortet das – und deine Provision läuft weiter." },
        { anker: "kb-stufen", titel: "Der Plan", kunde: "Drei Stufen, zehn Funktionen, zwölf Monate – priorisiert.", mitarbeiter: "Was du dem Kunden zeigst, ist teils Plan (Stufe 2/3). Sag ehrlich, was heute live ist und was kommt." },
      ] },
    },
    ratgeber: {
      einleitung: "fiaon.com/ratgeber und fiaon.com/werkzeuge: kostenlose Werkzeuge, die Interessenten zu uns bringen – und die du im Gespräch benutzt.",
      bloecke: [
        kacheln(
          ["Eintrag prüfen", "/werkzeuge/eintrag-pruefen – fünf Fragen → Einschätzung, ob ein Eintrag angreifbar ist (§ 31 BDSG)."],
          ["Selbstauskunft", "/werkzeuge/selbstauskunft – fertiger Brief für die kostenlose Datenkopie (SCHUFA, KSV1870, CRIF, Intrum)."],
          ["Löschfrist", "/werkzeuge/loeschfrist – taggenaues Löschdatum, 100-Tage-Regel, Restschuldbefreiung."],
          ["Inkassokosten", "/werkzeuge/inkassokosten – zulässige Gebühren nach RVG/§ 13e RDG, Formulierung zur Zurückweisung."],
          ["Verjährung", "/werkzeuge/verjaehrung – Datum nach BGB, Einrede zum Kopieren."],
          ["Karten-Check", "/werkzeuge/karten-check – welche Karte realistisch ist."],
          ["Spielraum", "/werkzeuge/spielraum – Einnahmen, Fixkosten, Richtwert Kartenrahmen."],
          ["Ratgeber", "/ratgeber – Artikel zu Einträgen, Datenkopie, Score, Inkasso, Basiskonto, Österreich, Schweiz. Autorin: Johanna Brecht (Redaktion)."],
        ),
        p("Die Rechner für Löschfrist, Verjährung und Inkassokosten findest du in Kapitel 5 noch einmal – eingebettet, damit du sie im Gespräch benutzen kannst. Sie rechnen deutsche Regeln; für Österreich und die Schweiz gelten andere Fristen (Kapitel 7 und 8)."),
        merk("Ein Werkzeug-Link ist ein gutes Gesprächsende für Interessenten, die noch nicht kaufen: „Rechnen Sie es in Ruhe nach – und wenn Sie wollen, dass wir es übernehmen, wissen Sie, wo wir sind.“"),
      ],
    },
    kontakt: {
      einleitung: "fiaon.com/kontakt: Telefon, E-Mail, ein KI-Assistent, der die Plattform kennt – und „Dringend melden“.",
      bloecke: [
        ul(
          `Support: ${SUPPORT.telefon} · ${SUPPORT.email}. Die Nummer steht auch im Kundenbereich.`,
          "KI-Assistent: Antwortet Interessenten und Kunden auf Fragen zu FIAON und Bonität – mit demselben Wissen, das dieser Academy zugrunde liegt (shared/fiaon-wissen.ts). Er hat keinen Zugriff auf Kundendaten und sagt das auch.",
          "„Dringend melden“: Erzeugt sofort eine Aufgabe mit Priorität „heute“ in der Liste der Geschäftsführung – oder, wenn der Kunde eingeloggt ist und „Ansprechpartner“ wählt, direkt bei dir unter Tasks.",
          "Anliegen aus dem Kundenbereich (Hilfe) landen unter Tickets – eigene Kunden zuerst, dann der Pool.",
        ),
        merk("Wenn ein Kunde dich nicht erreicht, erreicht er FIAON trotzdem. Deine Aufgabe: das, was ankommt, am selben Tag beantworten."),
      ],
    },
    office: {
      einleitung: "Dein Arbeitsplatz: das FIAON Office. Englische Raumnamen, deutsche Inhalte, per Du. Drei Gruppen: Workspace · Team · Me.",
      bloecke: [
        tab(["Raum", "Was drin ist", "Womit du arbeitest"],
          ["Dashboard", "Heute: Termine, Rückrufe, offene Raten deiner Kunden, Aufgaben, Leads seit gestern; Tagesziel; Live-Uhr", "Ein-Klick-Anruf, Akte, „Nächster Kunde“"],
          ["Pipeline", "Alle deine Kunden nach Phase: Interessent · wartet auf Zahlung · Startgespräch · aktiv · Rate offen · Karte beantragt · pausiert", "Filter, Suche, Akte (Verlauf, Auskunft, Raten, Schreiben), KI-Erklärer"],
          ["Calendar", "Deine Termine (Startgespräche, Rückrufe) in Europe/Berlin", "Buchen nach Verfügbarkeit, Erinnerungen 24 h und 1 h laufen automatisch"],
          ["Tasks", "Aufgaben von der Geschäftsführung und aus „Dringend melden“", "Übernehmen, erledigen, zurückmelden"],
          ["Inbox", "Mails deiner Kunden", "Antworten mit Vorlagen"],
          ["Tickets", "Anliegen der Kunden aus „Hilfe“ und deine Aufträge an das Back-Office", "Status, Antwort, Übergabe"],
          ["Collections", "Offene Raten im eigenen Stamm, Mahnstufen", "Zahlungsvereinbarung, Ergebnis klicken"],
          ["Team", "Wer ist Online / Pause / Offline, Stand-up, Ansagen", "Status setzen, Kurznachricht"],
          ["Feed", "Plattform-Updates, Erfolge, Kundenstimmen, Ansagen", "Lesebestätigung"],
          ["Academy", "Diese Ausbildung", "Kapitel, Übungen, Prüfung, Urkunde"],
          ["Wallet", "Dein Verdienst live: je Rate, Boni, nächste Auszahlung", "Nur bankbestätigte Eingänge"],
          ["Earnings", "Gehaltsrechner: Abschlüsse pro Tag → Monat 1 bis 12", "Paketmix, Haltequote"],
          ["Availability", "Dein Wochenplan (Pflicht, mindestens 15 h)", "Ohne Plan keine Leads und Termine; Erinnerung alle 5 Minuten"],
        ),
        ul(
          "Status in der Kopfzeile: Online oder Pause. Abgemeldet = Offline. Nach vier Minuten ohne Bewegung fragt das Office „Bist du noch da?“ (60-Sekunden-Ring); ohne Antwort → Pause, keine Anrufe, keine neuen Kunden.",
          "Am Handy: Räume in der Schublade (Menü oben links). Alles ist handytauglich – viele arbeiten unterwegs.",
        ),
        merk("Das Office ist für Arbeit gebaut: wenig Text, große Zahlen, ein Klick. Wenn du etwas nicht findest, ist das ein Fehler im Office – melde ihn über Feedback."),
      ],
    },
    hintergrund: {
      einleitung: "Was läuft, während du telefonierst: die Maschine hinter FIAON. Du musst sie nicht bedienen – aber kennen, um dem Kunden zu erklären, warum etwas passiert.",
      bloecke: [
        tab(["Baustein", "Aufgabe", "Was du davon merkst"],
          ["Make + Brevo", "Alle E-Mail- und Nachrichten-Events: Antrag-Erinnerungen, Zahlungsbestätigung, Terminbestätigung/-erinnerung, Raten-Erinnerungen, Mahnungen, Zugangslinks", "Mail-Log in der Akte: was wann an den Kunden ging"],
          ["Facebook → Make „FIAON Lead #1“", "Lead landet per POST /api/leads/intake bei uns; Vorab-Nachricht mit deinem Namen, Foto und Buchungslink", "Neuer Lead im Dashboard, Speed-to-Lead ≤ 5 Minuten"],
          ["Twilio", "Telefonie (DE/AT-Nummern, Aufzeichnung), SMS, künftig WhatsApp in der Akte", "Softphone im Office, Gesprächsblatt, KI-Zusammenfassung"],
          ["Wise + GoCardless", "Überweisungen (QR/EPC) und SEPA-Lastschriften; kein Stripe mehr (E-037)", "Zahlungsdaten im Bereich; „bezahlt“ erst nach Kontoabgleich"],
          ["Kontoabgleich", "Täglich durch das Back-Office: Wise-Auszug einspielen, Zuordnungen bestätigen", "Status springt von „Kunde meldet Zahlung“ auf „Bezahlt“; deine Provision entsteht"],
          ["Abo-Motor + Mahnstufen", "Erzeugt jede Rate, erinnert Tag 0/3/7, mahnt Tag 14/21, wiederholt Lastschriften", "Collections zeigt dir, wer an Tag 14 deinen Anruf braucht"],
          ["OpenAI (gpt-4.1-mini)", "KI-Assistent auf /kontakt, KI-Erklärer in der Akte, Gesprächszusammenfassung, dieser Simulator", "Erklärungen in drei Sätzen – prüfen, nicht blind weitergeben"],
          ["Datenbank (Render, Frankfurt)", "Alles, was Kunden betrifft – Produktion, verschlüsselt, EU", "Jeder Klick ist ein Datensatz. Nichts „mal eben“ ändern."],
        ),
        warn("Zahlungen werden nie geglaubt, nur bestätigt. Ein Screenshot ist ein Hinweis, der Kontoabgleich ist die Wahrheit."),
      ],
    },
  },
  test: [
    frage("Was sieht der Kunde direkt nach dem Vertrag im Antrag?", ["Die Startseite", "Zwei Karten: „Jetzt aktivieren“ oder „Zuerst sprechen“", "Die Bonitätsauskunft", "Ein Kreditangebot"], 1, "Zahlung oder Termin – keine der Karten lässt sich wegklicken."),
    frage(`Was kostet FIAON Start im Monat?`, [preis("start"), preis("pro"), preis("ultra"), preis("highend")], 0, "Preise kommen aus dem Paketkatalog."),
    frage("Die Bonitätsauskunft ohne Paket …", ["ist ein Abo", `kostet ${schufa} einmalig und erzeugt nie eine Rate`, "ist kostenlos", "gibt es nur für Geschäftskunden"], 1, "Einmalkauf, kein Abo."),
    frage("Welche Unterlagen braucht der Kunde im Bereich?", ["Steuerbescheid", "Kontoauszug der letzten drei Monate und Ausweis – Handyfoto genügt", "Arbeitsvertrag", "Mietvertrag"], 1, "Fehlende Unterlagen sind der häufigste Grund, warum es nicht weitergeht."),
    frage("Wo landet ein Anliegen aus „Hilfe“ im Kundenbereich?", ["In deiner privaten Mail", "Unter Tickets im Office – eigene Kunden zuerst", "Bei der SCHUFA", "Nirgends"], 1, "Anliegen sind Datensätze mit Zustand, keine Mails ins Nirgendwo."),
    frage("Was ist FIAON-DEMO?", ["Ein echter Kunde", "Ein Prüfkonto mit echten Zahlungen", "Ein festes Demo-Konto mit Platzhalterdaten – nie ein Datensatz", "Die Admin-Ansicht"], 2, "Feste Referenz ohne Datenbank, für Präsentationen und diesen Rundgang."),
    frage("Welche Zahlungswege gibt es seit E-037?", ["Stripe", "Überweisung (Wise, QR/EPC) und SEPA-Lastschrift (GoCardless)", "PayPal", "Kreditkarte über FIAON"], 1, "Stripe ist komplett entfernt."),
    frage("Was passiert nach vier Minuten ohne Maus oder Tastatur im Office?", ["Nichts", "„Bist du noch da?“ mit 60-Sekunden-Ring – ohne Antwort Pause", "Automatische Abmeldung", "Der Kunde wird angerufen"], 1, "Pause heißt: keine Anrufe, keine neuen Kunden."),
  ],
};
