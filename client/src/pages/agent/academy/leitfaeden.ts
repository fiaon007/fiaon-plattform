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
export interface Leitfaden { key: string; stufe: string; titel: string; wann: string; ziel: string; kurz: string[]; phasen: LeitfadenPhase[]; merke: string; /** Schritt in Kapitel 4, in dem geübt wird. */ schrittKey: string }

export const LEITFAEDEN: Leitfaden[] = [
  {
    key: "a", stufe: "A", schrittKey: "stufe-a", titel: "Stufe A – „Ich habe bezahlt“ geklickt, kein Termin", wann: "Der Kunde hat den Antrag abgeschlossen und „Ich habe überwiesen“ geklickt. Es gibt noch keinen Termin. Das Geld ist noch nicht bankbestätigt.",
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
    key: "b", stufe: "B", schrittKey: "stufe-b", titel: "Stufe B – Antrag fertig, nicht bezahlt", wann: "Der Antrag ist abgeschlossen, die Rechnung ist offen. Der Kunde hat weder überwiesen noch einen Termin gebucht.",
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
    key: "c", stufe: "C", schrittKey: "stufe-c", titel: "Stufe C – nur Facebook-Lead", wann: "Ein Lead aus dem Facebook-Formular, kein Antrag. Speed-to-Lead: innerhalb von fünf Minuten, nach der Vorab-Nachricht mit deinem Namen.",
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
  {
    key: "r", stufe: "R", schrittKey: "zahlungserinnerung", titel: "Reaktivierung – der Kunde, der lange gewartet hat", wann: "Ein Kunde mit überfälliger Rate, oft mit schwierigem Start und ohne Onboarding. Ausdrücklich kein Inkasso-Ton.",
    ziel: "Vorstellen, ehrlich entschuldigen, zuhören, die Akte aufräumen – dann zwei Wege: Rate zahlen (Altbestand: Reaktivierungsbonus 50 % des Zahlungswerts) oder einen Monat aussetzen (0 €, aber vorgestellt und Onboarding-Termin gebucht).",
    kurz: [
      "„Guten Tag, mein Name ist [Vorname Name] von FIAON – ich rufe an, um mich vorzustellen: Ich bin ab jetzt Ihr persönlicher Bonitätsmanager.“",
      "„Ich weiß, Sie hatten einen echt schwierigen Start bei uns, und dafür möchte ich mich zuerst entschuldigen – Sie haben lange gewartet.“",
      "Zuhören („Wo stehen Sie, was ist liegen geblieben?“), dann konkret sagen, was du diese Woche anstößt.",
      "Zwei Wege: „Wenn es passt, überweisen Sie die Rate mit Ihrer Referenz und ich lege sofort los – oder ich setze die Rate einen Monat aus und wir starten mit Ihrem Onboarding-Termin neu.“",
      "Immer: Onboarding-Termin sofort aus deiner Availability eintragen. Keine Fristen, keine Drohungen, nie „SCHUFA“.",
    ],
    phasen: [
      { titel: "1 · Vorstellen und entschuldigen", ziel: "Kein Mahnanruf – ein Neuanfang.", saetze: ["„Guten Tag, mein Name ist [Vorname Name] von FIAON – ich rufe an, um mich vorzustellen: Ich bin ab jetzt Ihr persönlicher Bonitätsmanager.“", "„Ich weiß, Sie hatten einen echt schwierigen Start bei uns, und dafür möchte ich mich zuerst entschuldigen. Sie haben lange gewartet – das war nicht in Ordnung.“"], hinweis: "Die Entschuldigung kommt zuerst, nicht die Rate." },
      { titel: "2 · Zuhören und aufräumen", ziel: "Sein Ärger bekommt Raum; ab jetzt ist jemand zuständig.", saetze: ["„Erzählen Sie mir kurz, wo Sie stehen – was ist bei Ihnen liegen geblieben?“", "„Ich habe Ihre Akte vor mir: [Stand nennen]. Das nehme ich jetzt in die Hand.“"], hinweis: "Nichts schönreden. Konkret sagen, was diese Woche passiert." },
      { titel: "3 · Die offene Rate – zwei Wege, ohne Druck", ziel: "Zahlung oder Aussetzen – beides ist ein guter Ausgang.", saetze: ["„Bei Ihnen ist eine Rate offen. Ich will, dass sich das für Sie wieder lohnt, bevor wir über Geld reden.“", "„Wenn es für Sie passt: Überweisen Sie die Rate mit Ihrer Referenz, und ich lege sofort los.“", "„Wenn es gerade nicht passt, setze ich die Rate einen Monat aus – dafür machen wir jetzt Ihren Onboarding-Termin, und die nächste Rate kommt regulär.“"], hinweis: "Zahlung → 50 % des Zahlungswerts für dich (nur Altbestand). Aussetzen → 0 €, aber der Kunde bleibt und die laufende Provision lebt wieder." },
      { titel: "4 · Onboarding-Termin – immer", ziel: "Das Gespräch endet mit einem eingetragenen Termin.", saetze: ["„Ich habe Donnerstag 10:00 oder Freitag 14:30 – wann passt es Ihnen?“", "„Eingetragen – Sie bekommen die Bestätigung per Mail, und mich erreichen Sie ab jetzt direkt.“"], hinweis: "Im Onboarding ist die Bonitätsauskunft das Ziel (10 € bei Zahlung; entfällt bei Altkunden, die schon gezahlt haben). Ergebnis klicken." },
    ],
    merke: "Entschuldigen → zuhören → aufräumen → zwei Wege → Termin. Kein Inkasso-Ton, nie.",
  },
  // ══════════════════════════════════════════════════════════════════════════
  // NEU 24.08.2026 — Justin: „Der Kunde kommt ja mit der Erwartungshaltung
  // ‚Ich brauche eine Kreditkarte' — das müssen wir nun auch erfüllen … das
  // kann auch in die Akademie, Leitfäden und Co. kommen, damit der Ablauf klar
  // ist."
  //
  // Dies ist das Gespräch, auf das die ganze Betreuung hinarbeitet. Es ist
  // KEIN Verkaufsgespräch — der Kunde hat schon bezahlt. Es ist die Einlösung
  // des Versprechens aus Leitfaden A und B („Sie haben sich wegen der
  // Kreditkarte gemeldet"). Deshalb ist der Ton stolz, nicht werbend.
  //
  // Wortwahl bindend: KOOPERATIONSPARTNER oder Partnerbank, nie „Affiliate".
  // Die Bank darf genannt werden — ihre Leistungen SIND das Argument.
  // ══════════════════════════════════════════════════════════════════════════
  {
    key: "k", stufe: "K", schrittKey: "stufe-a",
    titel: "Konto & Karte – der Anruf, auf den alles hinauslief",
    wann: "Der Kunde erfüllt alle drei Bedingungen: Antrag vollständig, Paket und Auskunft bezahlt mit mindestens zwei gelaufenen Raten, Kontoauszug und Ausweis liegen vor. In der Akte steht „Bereit für Konto & Karte“, auf deinem Dashboard steht er in der Tagesliste.",
    ziel: "Dem Kunden sagen, dass er am Ziel ist — und ihm den Weg in der richtigen Reihenfolge erklären: erst das Girokonto, dann die Kreditkarte. Danach den Link schicken und einen Rückruf verabreden.",
    kurz: [
      "„Herr [Name], ich rufe an, weil bei Ihnen jetzt alles zusammen ist — und ich habe gute Nachrichten.“",
      "Was er geschafft hat, konkret nennen: Auskunft da, Unterlagen da, zwei Raten gelaufen. „Genau darauf haben wir hingearbeitet.“",
      "Die Reihenfolge erklären: „Zuerst eröffnen Sie ein kostenloses Girokonto bei unserem Kooperationspartner, der DKB. Aus diesem Konto heraus buchen Sie dann die Kreditkarte dazu — anders geht es bei keiner Bank.“",
      "Die Vorteile nennen (kostenlos ab 700 € Geldeingang oder unter 28, Visa Debitkarte inklusive, Echtzeitüberweisungen, aktuell bis zu 200 € Startguthaben).",
      "„Ich schicke Ihnen den Weg jetzt per Mail. Fünf Minuten, Ausweis bereithalten fürs Video-Ident — genau den, den Sie bei uns schon hinterlegt haben.“",
      "Rückruf verabreden: „Ich melde mich in drei Tagen kurz, ob alles geklappt hat.“ → Ergebnis „Rückruf vereinbart“ klicken.",
    ],
    phasen: [
      {
        titel: "1 · Die gute Nachricht (30 Sekunden)",
        ziel: "Der Kunde merkt, dass sich sein Geld gelohnt hat — bevor irgendetwas Neues kommt.",
        saetze: [
          "„Herr [Name], ich rufe an, weil bei Ihnen jetzt alles zusammen ist. Ihre Auskunft liegt vor, Ihre Unterlagen sind vollständig, und Ihre ersten Raten sind gelaufen.“",
          "„Genau darauf haben wir die letzten Monate hingearbeitet — jetzt können wir den nächsten Schritt gehen: Ihr eigenes Konto und die Karte.“",
        ],
        hinweis: "Erst die Anerkennung, dann der Weg. Wer sofort mit dem Link anfängt, macht aus einem Erfolg eine Werbemail.",
      },
      {
        titel: "2 · Warum erst das Konto (1 Minute)",
        ziel: "Die Reihenfolge sitzt — sonst versucht er es direkt bei der Karte und wird abgelehnt.",
        saetze: [
          "„Der Weg hat zwei Schritte, und der erste ist der wichtige: Sie eröffnen ein kostenloses Girokonto bei unserem Kooperationspartner, der DKB.“",
          "„Aus diesem Konto heraus buchen Sie danach die Kreditkarte dazu — mit einem Klick in Ihrem Banking. Ohne Girokonto geht das bei keiner Bank, deshalb diese Reihenfolge.“",
          "Wenn er fragt, warum nicht direkt: „Weil ein Kartenantrag ohne Konto abgelehnt wird — und jede Ablehnung steht wieder in Ihrer Auskunft. Genau das wollen wir bei Ihnen ja gerade nicht.“",
        ],
        hinweis: "Der Satz mit der Ablehnung ist der wichtigste im ganzen Gespräch: Er erklärt die Reihenfolge aus dem Interesse des Kunden heraus, nicht aus unserem.",
      },
      {
        titel: "3 · Was das Konto ihm bringt (1 Minute)",
        ziel: "Er sieht das Konto als Gewinn, nicht als Bedingung.",
        saetze: [
          "„Das Konto kostet Sie nichts, wenn monatlich 700 Euro eingehen — bei unter 28 Jahren generell nicht.“",
          "„Die Visa Debitkarte ist dabei, ohne Jahresgebühr, weltweit und mit Apple Pay oder Google Pay.“",
          "„Überweisungen kommen in zehn Sekunden an, rund um die Uhr.“",
          "„Und aktuell läuft eine Aktion mit bis zu 200 Euro Startguthaben.“",
          "Wenn er ein Konto hat: „Sie können das als Zweitkonto führen — oder mit dem Wechselservice umziehen, das dauert unter zehn Minuten und alle Ihre Vertragspartner werden automatisch informiert.“",
        ],
        hinweis: "Nie „garantiert“ und nie versprechen, dass die Bank ihn annimmt. Die Bank entscheidet — das sagst du ehrlich, wenn er fragt.",
      },
      {
        titel: "4 · Den Weg schicken (30 Sekunden)",
        ziel: "Der Link ist raus, während er noch am Telefon ist.",
        saetze: [
          "„Ich schicke Ihnen den Weg jetzt per Mail — Sie müssten ihn in einer Minute haben.“",
          "„Rechnen Sie mit fünf Minuten. Halten Sie Ihren Ausweis bereit fürs Video-Ident — genau den, den Sie bei uns schon hinterlegt haben.“",
          "„Sagen Sie mir kurz, wenn die Mail da ist?“",
        ],
        hinweis: "In der Akte unter „Sein Antrag“ → Konto & Karte → „Karte bestellen“. Der Knopf erscheint nur, wenn wirklich alle drei Bedingungen erfüllt sind. Für dich sind das 10 € — auszahlbar, sobald der Partner die Eröffnung bestätigt.",
      },
      {
        titel: "5 · Rückruf verabreden",
        ziel: "Wer beim Video-Ident hängen bleibt, bricht ab und sagt es niemandem.",
        saetze: [
          "„Ich melde mich in drei Tagen kurz und frage, ob alles geklappt hat. Wenn vorher etwas hakt, rufen Sie mich einfach an.“",
        ],
        hinweis: "Ergebnis klicken: „Rückruf vereinbart“ mit Datum. Ohne diesen Rückruf verlierst du die Hälfte der Eröffnungen an eine Frage, die niemand gestellt hat.",
      },
    ],
    merke: "Anerkennen → Reihenfolge erklären → Vorteile → Link → Rückruf. Erst das Konto, dann die Karte — immer.",
  },
];

export const leitfaden = (key: string): Leitfaden | null => LEITFAEDEN.find((l) => l.key === key) ?? null;
export const leitfadenKurzText = (l: Leitfaden): string => `${l.titel}\n\n${l.kurz.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nMerke: ${l.merke}`;
