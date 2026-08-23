// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Leitfäden auf Abruf (23.08.2026, Justin: Stufe A/B/C)
// Kurzfassung je Stufe (kopierbar) + Langfassung für Kapitel 4. Erreichbar
// unter /agent/academy/leitfaeden. Regeln: Kunden siezen, keine Garantie, kein
// „beraten“; die erste Zahlung ist immer direkt (Überweisung mit Referenz),
// GoCardless nur für Folgeraten; Termine sofort aus der eigenen Availability.
// ═══════════════════════════════════════════════════════════════════════════
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const preis = (key: string) => eur(PAKETE.find((x) => x.key === key)?.preisCents ?? 0);
const schufa = SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";

export interface LeitfadenPhase { titel: string; ziel: string; saetze: string[]; hinweis?: string }
export interface Leitfaden { key: string; stufe: string; titel: string; wann: string; ziel: string; kurz: string[]; phasen: LeitfadenPhase[]; merke: string }

export const LEITFAEDEN: Leitfaden[] = [
  {
    key: "a", stufe: "A", titel: "Stufe A – „Ich habe bezahlt“ geklickt, kein Termin", wann: "Der Kunde hat den Antrag abgeschlossen und „Ich habe überwiesen“ geklickt. Es gibt noch keinen Termin. Das Geld ist noch nicht bankbestätigt.",
    ziel: "Willkommen heißen, den Kunden oben halten (die Karte ist sein Ziel), dann den eigentlichen Grund: Termin zur Aktivierung – sofort aus deiner Availability eintragen – und die eingeleitete Zahlung beiläufig bestätigen lassen.",
    kurz: [
      "„Hi, hier ist [Vorname] von FIAON. Ich habe gesehen, Sie, Herr [Name], sind erfolgreich akzeptiert worden – ich heiße Sie herzlich willkommen als Kunde bei FIAON.“",
      "Oben halten: „Sie haben sich wegen der Kreditkarte gemeldet – genau dafür bauen wir jetzt die Grundlage: Ihre Auskunft, jeder Eintrag erklärt, was angreifbar ist, geht raus. Über die Karte entscheidet die Bank – wir bereiten alles vor, und Sie sehen jeden Schritt in Ihrem Bereich.“",
      "Der eigentliche Grund: „Ich würde mir gerne einen Termin mit Ihnen vereinbaren, damit ich Ihr Konto aktivieren kann – wann haben Sie Zeit?“ → sofort den nächsten freien Termin aus deiner Availability nennen und eintragen.",
      "Zahlung beiläufig: „Ich habe gesehen, Sie haben die Zahlung bereits eingeleitet, richtig? Ich frage nur, weil ich dann am [Termintag] das Konto vollwertig aktivieren kann und Sie gleich loslegen können.“",
      "Abschluss: Terminbestätigung kommt per Mail; Ergebnis klicken (Termin + Zahlung gemeldet).",
    ],
    phasen: [
      { titel: "1 · Willkommen (20 Sekunden)", ziel: "Der Kunde fühlt sich angenommen, nicht kontrolliert.", saetze: ["„Hi, hier ist [Vorname] von FIAON. Ich habe gesehen, Sie, Herr [Name], sind erfolgreich akzeptiert worden – ich heiße Sie herzlich willkommen als Kunde bei FIAON.“", "„Ich bin ab jetzt Ihr persönlicher Ansprechpartner – alles, was Ihre Akte betrifft, läuft über mich.“"], hinweis: "Kein „Haben Sie schon überwiesen?“ am Anfang. Die Zahlung kommt ganz am Ende, beiläufig." },
      { titel: "2 · Oben halten – die Karte ist das Ziel (2 Minuten)", ziel: "Der Kunde erinnert sich, warum er gekommen ist, und versteht, was jetzt dafür passiert.", saetze: ["„Sie haben sich wegen der Kreditkarte gemeldet. Genau dafür bauen wir jetzt die Grundlage: Wir holen Ihre Auskunft mit Vollmacht, erklären Ihnen jeden Eintrag und greifen an, was angreifbar ist.“", "„Sobald Ihr Wert die Schwelle des Kartenpartners erreicht, bereiten wir den Kartenantrag vor – über die Karte entscheidet die Bank, das sage ich ehrlich. Aber Sie sehen in Ihrem Bereich jeden Schritt, wie weit Sie entfernt sind.“", "„Dazu kommt das Girokonto – das bekommt jeder Kunde, unabhängig von der Bonität.“"], hinweis: "Stark für die Karte, nie „garantiert“. Wenn er nach dem Limit fragt: „Das legt die Bank fest – bis 25.000 € bei guter Bonität, und dahin bauen wir.“" },
      { titel: "3 · Der eigentliche Grund: der Termin (1 Minute)", ziel: "Ein eingetragener Termin aus deiner Availability – jetzt, nicht „ich schicke einen Link“.", saetze: ["„Ich würde mir gerne einen Termin mit Ihnen vereinbaren, damit ich Ihr Konto aktivieren kann – wann haben Sie Zeit?“", "„Ich hätte morgen um 10:30 oder 15:00 – was passt Ihnen besser?“", "„Dann trage ich Dienstag 10:30 ein. Sie bekommen gleich eine Bestätigung per Mail, und am Vortag eine Erinnerung.“"], hinweis: "Calendar offen haben. Der Slot ist mit dem Eintrag wirklich blockiert. Deine Arbeitszeit soll mit Terminen voll sein – biete den nächsten freien Slot an, nicht „irgendwann nächste Woche“." },
      { titel: "4 · Die Zahlung – beiläufig (30 Sekunden)", ziel: "Bestätigung, dass die Überweisung läuft, ohne Misstrauen.", saetze: ["„Ich habe gesehen, Sie haben die Zahlung bereits eingeleitet, richtig? Ich frage nur, weil ich dann am [Termintag] das Konto vollwertig aktivieren kann und Sie gleich loslegen können.“", "Falls nicht: „Kein Problem – die Zahlungsdaten mit Ihrer Referenz stehen in Ihrem Bereich und in der Mail. Wenn die Überweisung bis [Termintag] da ist, aktiviere ich direkt im Gespräch.“"], hinweis: "Die erste Zahlung ist immer eine direkte Überweisung mit Zahlungsreferenz – nie Lastschrift. GoCardless kommt erst bei den Folgeraten." },
      { titel: "5 · Abschluss", ziel: "Verabredung, Ergebnis, Akte.", saetze: ["„Dann bis Dienstag, 10:30 – ich freue mich. Wenn vorher etwas ist: Hilfe in Ihrem Bereich oder meine Nummer.“"], hinweis: "Ergebnis klicken: Termin vereinbart · Kunde meldet Zahlung (noch nicht bankbestätigt). Beleg erbitten, falls unsicher." },
    ],
    merke: "Willkommen → Karte → Termin → Zahlung. Nie umgekehrt.",
  },
  {
    key: "b", stufe: "B", titel: "Stufe B – Antrag fertig, nicht bezahlt", wann: "Der Antrag ist abgeschlossen, die Rechnung ist offen. Der Kunde hat weder überwiesen noch einen Termin gebucht.",
    ziel: "An den Antrag anknüpfen (Kreditkarte, FIAON-Konzept), Termin sofort vereinbaren, auf die Rechnung hinweisen, Zahlungsdaten schicken.",
    kurz: [
      "„Ich grüße Sie, Herr [Name], hier ist [Vorname] von FIAON – bezüglich Ihres Antrags wegen einer Kreditkarte und zum FIAON-Konzept. Haben Sie einen Moment?“",
      "Konzept in drei Sätzen: Auskunft holen und erklären · angreifbare Einträge anschreiben · Konto und Karte vorbereiten (die Bank entscheidet). Jeder Schritt im Bereich sichtbar.",
      "Termin sofort: „Damit ich Ihr Konto aktivieren kann, brauche ich ein kurzes Startgespräch – ich hätte morgen 11:00 oder 16:30.“ → eintragen.",
      `Rechnung: „Ihr Paket [Start ${preis("start")} / Pro ${preis("pro")}] – die erste Rate überweisen Sie bitte direkt mit Ihrer Zahlungsreferenz, die Zahlungsdaten schicke ich Ihnen jetzt per Mail. Wenn die Zahlung vor dem Termin da ist, aktiviere ich direkt im Gespräch.“`,
      "Abschluss: Zahlungsdaten senden (Akte → Zahlungsdaten), Ergebnis klicken (Termin + Zahlungsdatum).",
    ],
    phasen: [
      { titel: "1 · Anknüpfen (20 Sekunden)", ziel: "Er erinnert sich an seinen Antrag – und an sein Ziel.", saetze: ["„Ich grüße Sie, Herr [Name], hier ist [Vorname] von FIAON – bezüglich Ihres Antrags wegen einer Kreditkarte und zum FIAON-Konzept. Haben Sie einen Moment?“"], hinweis: "Wenn nicht: zwei konkrete Zeiten für den Rückruf, eintragen." },
      { titel: "2 · Das Konzept (2 Minuten)", ziel: "Er versteht, was das Paket leistet – und warum es zur Karte führt.", saetze: ["„Sie wollen eine Kreditkarte – und dafür braucht es eine Auskunft, die trägt. FIAON holt Ihre Auskunft, erklärt Ihnen jeden Eintrag, und für alles, was angreifbar ist, bereiten wir die Schreiben vor und versenden sie per Einschreiben.“", "„Parallel bereiten wir Konto und Karte vor – die Bank entscheidet, aber Sie sehen in Ihrem Bereich jederzeit, wie weit Sie sind.“", "„Was hat Sie beim Antrag zögern lassen?“"], hinweis: "Einwände kommen hier: Preis, Misstrauen, „kann ich selbst“. Einwand-Trainer." },
      { titel: "3 · Termin sofort (1 Minute)", ziel: "Der Startgesprächstermin steht – aus deiner Availability.", saetze: ["„Damit ich Ihr Konto aktivieren kann, brauche ich ein kurzes Startgespräch von 15 Minuten – ich hätte morgen 11:00 oder 16:30. Was passt?“", "„Eingetragen. Bestätigung kommt per Mail.“"] },
      { titel: "4 · Rechnung und Zahlungsdaten (1 Minute)", ziel: "Er weiß, was er zahlt, wie und bis wann – und hat die Daten in der Mail.", saetze: [`„Ihr Paket ist [Start ${preis("start")} / Pro ${preis("pro")}] im Monat – zwölf Raten, kündbar formlos. Die erste Rate überweisen Sie bitte direkt, mit Ihrer Zahlungsreferenz im Verwendungszweck – die Zahlungsdaten schicke ich Ihnen jetzt per Mail, mit QR-Code.“`, "„Wenn die Zahlung vor dem Termin bei uns ist, aktiviere ich Ihr Konto direkt im Gespräch und Sie legen sofort los.“", `„Die Bonitätsauskunft allein gibt es auch für ${schufa} einmalig – falls Sie erst nur die Auskunft wollen.“`], hinweis: "Erste Zahlung immer direkt (Überweisung mit Referenz). Keine Lastschrift für die erste Rate. Preise nur aus dem Katalog." },
      { titel: "5 · Abschluss", ziel: "Verabredung, Zahlungsdaten raus, Ergebnis.", saetze: ["„Dann bis [Tag, Uhrzeit]. Die Zahlungsdaten sind in einer Minute in Ihrem Postfach.“"], hinweis: "Zahlungsdaten senden (Mail oder Text für WhatsApp). Ergebnis: Termin + „zahlt am [Datum]“." },
    ],
    merke: "Anknüpfen → Konzept → Termin → Rechnung → Zahlungsdaten. Der Termin kommt vor dem Geld.",
  },
  {
    key: "c", stufe: "C", titel: "Stufe C – nur Facebook-Lead", wann: "Ein Lead aus dem Facebook-Formular, kein Antrag. Speed-to-Lead: innerhalb von fünf Minuten, nach der Vorab-Nachricht mit deinem Namen.",
    ziel: "Daten aufnehmen, den Vertrag am Telefon abschließen (Einwilligung zur Aufnahme am Anfang, Annahmesatz am Ende, Bestätigung in Textform), Zugänge schicken, Termin vereinbaren, Rechnung vor dem Termin.",
    kurz: [
      "„Hi, hier ist [Vorname] von FIAON, ich rufe an, weil Sie sich bei uns für eine Kreditkarte registriert haben – haben Sie einen Augenblick?“",
      "Aufnahme: „Das Gespräch wird zur Dokumentation aufgezeichnet – ist das für Sie in Ordnung?“ (Antwort abwarten.)",
      "Ziel und Lage verstehen (2 Fragen), Konzept in drei Sätzen, Preis aus dem Katalog.",
      "Daten aufnehmen: Name, Geburtsdatum, Adresse, E-Mail, Telefon, Beschäftigung, Einkommen, Paket – im Office als Neukunde anlegen.",
      `Annahmesatz: „Sie beauftragen FIAON mit dem Paket [Name] zu [Preis] im Monat, zwölf Raten, kündbar formlos – und Sie haben den Vertrag und die Widerrufsbelehrung per E-Mail erhalten. Bestätigen Sie das so?“ → „Ja.“`,
      "Zugänge schicken (Mail mit Vertrag, Zugang, Zahlungsdaten mit Referenz). Termin sofort aus der Availability eintragen.",
      "„Wenn Sie vor dem Termin bitte die Rechnung begleichen, dann kann ich es gleich aktivieren.“",
    ],
    phasen: [
      { titel: "1 · Öffnen und Einwilligung (30 Sekunden)", ziel: "Er weiß, wer anruft, warum – und dass aufgezeichnet wird.", saetze: ["„Hi, hier ist [Vorname] von FIAON, ich rufe an, weil Sie sich bei uns für eine Kreditkarte registriert haben – haben Sie einen Augenblick?“", "„Kurz vorab: Das Gespräch wird zur Dokumentation aufgezeichnet – ist das für Sie in Ordnung?“"], hinweis: "Die Einwilligung zur Aufnahme kommt am Anfang, hörbar. Ohne „Ja“ keine Aufnahme." },
      { titel: "2 · Verstehen (2 Minuten)", ziel: "Sein Ziel, seine Lage, sein Eintrag.", saetze: ["„Was ist passiert – wurde Ihnen eine Karte abgelehnt, oder wollen Sie vorsorgen?“", "„Wissen Sie, welcher Eintrag das ist, oder vermuten Sie es?“", "„Was wäre in drei Monaten ein gutes Ergebnis für Sie?“"] },
      { titel: "3 · Konzept und Preis (2 Minuten)", ziel: "Er versteht FIAON in drei Sätzen und kennt den Preis.", saetze: ["„FIAON holt Ihre Auskunft mit Vollmacht, erklärt jeden Eintrag und prüft, ob er überhaupt zulässig gemeldet wurde. Für alles Angreifbare bereiten wir die Schreiben vor und versenden sie. Und wir bereiten Konto und Karte vor – die Bank entscheidet.“", `„Start kostet ${preis("start")} im Monat, Pro ${preis("pro")} – zwölf Raten, formlos kündbar. Die Bonitätsauskunft allein ${schufa} einmalig.“`], hinweis: "Keine Garantie, kein „Score verbessern“, kein „Kredit ohne SCHUFA“." },
      { titel: "4 · Daten aufnehmen (3 Minuten)", ziel: "Der Kunde ist im Office angelegt – du tippst, er diktiert.", saetze: ["„Dann nehme ich Ihre Daten auf: vollständiger Name, Geburtsdatum, Adresse, E-Mail, Telefonnummer, Beschäftigung, monatliches Einkommen – und welches Paket.“", "„Ich lese Ihnen die E-Mail-Adresse noch einmal vor: … richtig?“"], hinweis: "Neukunde im Office anlegen (Akte → Neukunde). E-Mail-Adresse buchstabieren lassen – Tippfehler erzeugen Dubletten und verlorene Zugänge." },
      { titel: "5 · Annahmesatz und Bestätigung in Textform (1 Minute)", ziel: "Der Vertrag ist am Telefon geschlossen – hörbar und schriftlich bestätigt.", saetze: [`„Zusammengefasst: Sie beauftragen FIAON mit dem Paket [Name] zu [Preis] im Monat, zwölf Raten, jederzeit formlos kündbar. Vertrag und Widerrufsbelehrung sind gerade an Ihre E-Mail gegangen. Bestätigen Sie das so?“`, "„Danke. Sie bekommen jetzt Ihren Zugang, den Vertrag und die Zahlungsdaten per Mail – bitte bestätigen Sie den Vertrag dort noch mit einem Klick.“"], hinweis: "Einwilligung am Anfang, Annahmesatz am Ende, Bestätigung in Textform (Mail/Klick). Alle drei gehören zusammen – sonst gibt es keinen Vertrag." },
      { titel: "6 · Zugänge, Termin, Rechnung (1 Minute)", ziel: "Zugang raus, Termin eingetragen, Zahlung vor dem Termin.", saetze: ["„Ihre Zugangsdaten sind unterwegs. Damit ich Ihr Konto aktivieren kann, brauche ich ein Startgespräch – ich hätte Donnerstag 9:30 oder 14:00.“", "„Wenn Sie vor dem Termin bitte die Rechnung begleichen – die Zahlungsdaten mit Ihrer Referenz sind in der Mail –, dann kann ich es gleich aktivieren.“"], hinweis: "Erste Zahlung direkt per Überweisung mit Referenz. Termin aus deiner Availability, Slot blockiert. Ergebnis klicken: Antrag gemacht, Termin, zahlt am." },
    ],
    merke: "Einwilligung → Verstehen → Konzept → Daten → Annahmesatz → Zugang, Termin, Rechnung.",
  },
];

export const leitfaden = (key: string): Leitfaden | null => LEITFAEDEN.find((l) => l.key === key) ?? null;
export const leitfadenKurzText = (l: Leitfaden): string => `${l.titel}\n\n${l.kurz.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nMerke: ${l.merke}`;
