// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 4 — Das Gespräch (23.08.2026, Plan §11)
// Leitfäden (aus Onboarding-Agenda, Lead-Strecke, alter Skripte-Seite, verbessert),
// Einwand-Trainer (lokale Daten), Anruf-Simulator (Server, gpt-4.1-mini).
// Wortregeln: shared/fiaon-lead-strecke.ts VERBOTENE_WORTE.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, type Block, p, ul, merk, warn, sagen, link, frage } from "./typen";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { SUPPORT } from "@shared/fiaon-wissen";
import { LEITFAEDEN, type Leitfaden } from "./leitfaeden";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const preis = (key: string) => eur(PAKETE.find((x) => x.key === key)?.preisCents ?? 0);
const schufa = SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";
const leitfaden = (...phasen: { titel: string; ziel: string; saetze: string[]; hinweis?: string }[]): Block => ({ art: "leitfaden", phasen });
const stufe = (l: Leitfaden) => ({
  einleitung: `${l.wann} Ziel: ${l.ziel}`,
  bloecke: [
    { art: "kacheln" as const, kacheln: l.kurz.map((k, i) => ({ titel: `${i + 1}`, text: k })) },
    { art: "leitfaden" as const, phasen: l.phasen },
    merk(l.merke),
    link("/agent/academy/leitfaeden", "Alle Leitfäden auf Abruf (Kurzfassung, kopierbar)"),
  ],
});

export const KAPITEL_4: KapitelInhalt = {
  inhalte: {
    haltung: {
      einleitung: "Bevor ein Satz fällt: die Haltung. Am anderen Ende sitzt jemand, der sich überwunden hat, anzurufen oder ein Formular auszufüllen.",
      bloecke: [
        ul(
          "Ruhe schlägt Tempo. Wer langsam und klar spricht, wirkt kompetent. Wer schnell und viel spricht, wirkt wie ein Verkäufer.",
          "Zuhören, dann strukturieren. Erst der Kunde (sein Ziel, seine Angst), dann du (Weg, Schritte, Preis).",
          "Ehrlichkeit ist das Argument. „Keine Garantie – aber jeder Schritt sichtbar“ wird geglaubt. „Garantiert“ nicht.",
          "Zahlen statt Adjektive. Nicht „sehr schnell“, sondern „Einsicht etwa 24 Stunden nach Eingang der Auskunft“.",
          "Jedes Gespräch endet mit einer Verabredung: Wer tut was bis wann. Und mit einem Klick im Gesprächsblatt.",
          "Scham ist der Gegner. Nie moralisieren („Das hätten Sie früher …“). Nie „Schuldner“.",
        ),
        merk("Der Satz, der jedes Gespräch öffnet: „Erzählen Sie mir kurz, was passiert ist – dann sage ich Ihnen, was wir tun können und was nicht.“"),
        p("Was du vor jedem Anruf tust: Gesprächsblatt öffnen (fünf Sekunden: Phase, letzter Kontakt, offene Punkte). Was du nach jedem Anruf tust: Ergebnis klicken, nächsten Schritt mit Datum. Nichts dazwischen ist optional."),
      ],
    },
    "stufe-a": stufe(LEITFAEDEN[0]),
    "stufe-b": stufe(LEITFAEDEN[1]),
    "stufe-c": stufe(LEITFAEDEN[2]),
    rueckruf: {
      einleitung: "Der Rückruf: Der Kunde hat um einen Anruf gebeten oder war beim letzten Mal nicht erreichbar. Kürzer, konkreter, mit Bezug.",
      bloecke: [
        leitfaden(
          { titel: "1 · Bezug herstellen", ziel: "Er weiß sofort, worum es geht.", saetze: ["„Guten Tag, [Name] von FIAON – wir hatten [Datum] kurz gesprochen, Sie wollten sich den Antrag ansehen.“", "„Sie haben um einen Rückruf gebeten – worum geht es?“"] },
          { titel: "2 · Stand klären", ziel: "Wo hakt es? Ehrlich fragen, nicht drängen.", saetze: ["„Wo sind Sie stehen geblieben – am Antrag, an der Zahlung, an einer Frage?“", "„Was hat Sie zögern lassen?“"], hinweis: "Die häufigsten Gründe: Preis unklar, Misstrauen, keine Zeit, Partner dagegen. Jeder hat eine Antwort (Einwand-Trainer)." },
          { titel: "3 · Den einen Schritt anbieten", ziel: "Nur den nächsten Schritt, nicht den ganzen Weg.", saetze: ["„Ich schicke Ihnen die Zahlungsdaten jetzt als Nachricht – mit QR-Code, das dauert eine Minute.“", "„Wenn Sie lieber erst sprechen: Ich habe morgen 10:30 oder 16:00 – was passt?“"] },
          { titel: "4 · Abschluss", ziel: "Verabredung mit Datum, Ergebnis klicken.", saetze: ["„Dann hören wir voneinander am [Tag]. Wenn vorher etwas hakt: meine Nummer steht in der Nachricht.“"] },
        ),
        p("Rückrufe planst du im Gesprächsblatt (Datum, Uhrzeit, Grund). Das Dashboard zeigt sie dir am Tag in Reihenfolge. Ein Rückruf, der nicht im System steht, findet nicht statt."),
      ],
    },
    startgespraech: {
      einleitung: "Das Startgespräch: Pflicht, 15 Minuten, sieben Agenda-Schritte mit Notizen – hier als gesprochener Leitfaden. Die Agenda selbst steht in Kapitel 3.",
      bloecke: [
        leitfaden(
          { titel: "1 · Begrüßung & Erwartung", ziel: "Wer, wie lange, was danach.", saetze: ["„Guten Tag, [Name] von FIAON, ich bin Ihr Bonitätsmanager. Ich habe fünfzehn Minuten für Sie eingeplant. Danach ist Ihr Bereich vollständig freigeschaltet.“", "„Was erwarten Sie von uns? Was ist Ihr Ziel?“"], hinweis: "Pflichtnotiz: das Ziel in seinen Worten." },
          { titel: "2 · Plattform-Tour", ziel: "Einmal gemeinsam durchklicken.", saetze: ["„Öffnen Sie bitte Ihren Bereich – oben sehen Sie Ihren Fahrplan, links die Bereiche.“", "„Unter Unterlagen sehen Sie, was fehlt. Unter Mein Konto ändern Sie Adresse und Telefon selbst.“", "„Unter Hilfe erreichen Sie mich – das landet direkt bei mir.“"] },
          { titel: "3 · Fahrplan", ziel: "Erklären, nicht vorlesen – in seiner Reihenfolge.", saetze: ["„Bei Ihnen kommt als Erstes die Auskunft. Dafür brauche ich Ihre Vollmacht – die ist schon im Bereich hinterlegt. Etwa 24 Stunden nach Eingang sehen Sie jeden Eintrag erklärt.“", "„Danach entscheiden wir gemeinsam, welches Schreiben als Erstes rausgeht.“"], hinweis: "Ehrlich zu Zeiträumen: Auskunfteien antworten innerhalb eines Monats; Gläubiger brauchen Wochen. Keine Zusage, die von Dritten abhängt. Pflichtnotiz: Schritt und nächster Schritt." },
          { titel: "4 · Unterlagen", ziel: "Konkret, was fehlt, und wie es hochkommt.", saetze: ["„Es fehlt der Kontoauszug der letzten drei Monate. Ein Foto mit dem Handy reicht, wenn alles lesbar ist – Unterlagen, hochladen.“", "„Die Anleitung für Ihre Bank steht direkt daneben.“"] },
          { titel: "5 · Bonitätsauskunft", ziel: "Eine Auskunft, kein Rat. Er entscheidet.", saetze: [`„Die Bonitätsauskunft kostet ${schufa} einmalig, kein Abo. Der Abruf ist neutral, er verändert Ihren Score nicht. Sie sehen danach tagesaktuell, was gespeichert ist – plus einen Handlungsplan.“`, "„Möchten Sie die? Dann zeige ich Ihnen den Zahlweg – Verwendungszweck ist Pflicht.“"], hinweis: "Notiz: wollte er sie? Wenn nein, warum nicht?" },
          { titel: "6 · Abo-Klarheit", ziel: "Laufende Kosten bestätigen – der Streitfall wird hier ausgeräumt.", saetze: [`„Ihr Paket ist ein laufendes Abo: ${preis("pro")} jeden Monat, die nächste Abbuchung ist am [Datum].“`, "„Kündbar zum Ende des laufenden Monats, formlos – im Bereich unter Abo & Zahlungen oder per E-Mail. Kein Grund nötig.“", "„Ist das so für Sie in Ordnung?“"], hinweis: "Pflichtnotiz: seine Antwort wörtlich. Keine Mindestlaufzeit erfinden." },
          { titel: "7 · Nächste Schritte & Erreichbarkeit", ziel: "Verabredung statt Gruß.", saetze: ["„Zusammengefasst: Sie laden den Kontoauszug bis Freitag hoch, wir beantragen die Auskunft heute, wir hören voneinander, sobald sie da ist – spätestens am [Datum].“", `„Sie erreichen mich über Hilfe im Bereich oder unter ${SUPPORT.telefon}. Melden Sie sich, bevor etwas hakt.“`, "„Ihr Bereich ist ab jetzt vollständig freigeschaltet.“"], hinweis: "Pflichtnotiz: Was wurde verabredet? Danach Gespräch abschließen – Freischaltung läuft automatisch." },
        ),
      ],
    },
    zahlungserinnerung: {
      einleitung: "Die Reaktivierung: Ein Kunde mit überfälliger Rate – oft einer, der lange gewartet hat und einen schwierigen Start hatte. Ausdrücklich kein Inkasso-Ton: weich, mit Entschuldigung. Zwei gute Ausgänge: Er zahlt (Reaktivierungsbonus 50 % des Zahlungswerts) – oder du setzt die Rate einen Monat aus (0 €, aber du hast dich vorgestellt und den Onboarding-Termin gebucht).",
      bloecke: [
        leitfaden(
          { titel: "1 · Vorstellen und entschuldigen", ziel: "Der Kunde merkt: Das ist kein Mahnanruf, sondern ein Neuanfang.", saetze: ["„Guten Tag, mein Name ist [Vorname Name] von FIAON – ich rufe an, um mich vorzustellen: Ich bin ab jetzt Ihr persönlicher Bonitätsmanager.“", "„Ich weiß, Sie hatten einen echt schwierigen Start bei uns, und dafür möchte ich mich zuerst entschuldigen. Sie haben lange gewartet – das war nicht in Ordnung.“"], hinweis: "Die Entschuldigung ist ernst gemeint und kommt zuerst. Nicht die Rate. Viele dieser Kunden haben monatelang nichts gehört." },
          { titel: "2 · Zuhören und aufräumen", ziel: "Sein Ärger bekommt Raum – und du zeigst, dass ab jetzt jemand zuständig ist.", saetze: ["„Erzählen Sie mir kurz, wo Sie stehen – was ist bei Ihnen liegen geblieben?“", "„Ich habe Ihre Akte vor mir: [Stand nennen – Auskunft, Schreiben, was passiert ist oder eben nicht]. Das nehme ich jetzt in die Hand.“"], hinweis: "Ehrlich bleiben: Was nicht passiert ist, nicht schönreden. Konkret sagen, was du diese Woche anstößt." },
          { titel: "3 · Die offene Rate – ohne Druck", ziel: "Sachlich benennen, zwei Wege anbieten – die Entscheidung liegt beim Kunden und bei dir.", saetze: ["„Bei Ihnen ist eine Rate offen. Ich will, dass sich das für Sie wieder lohnt, bevor wir über Geld reden.“", "Weg 1 – Zahlung: „Wenn es für Sie passt: Überweisen Sie die Rate mit Ihrer Referenz, und ich lege sofort los – am [Datum] gehen wir im Gespräch alles durch.“", "Weg 2 – Aussetzen: „Wenn es gerade nicht passt, setze ich die Rate einen Monat aus. Dafür machen wir jetzt Ihren Onboarding-Termin – dann sehen Sie erst, was Sie bekommen, und die nächste Rate kommt regulär.“"], hinweis: "Aussetzen ist deine Entscheidung und dein Angebot – kein Zugeständnis, das der Kunde erkämpfen muss. Vergütung: Zahlung → 50 % des Zahlungswerts für dich; Aussetzen → 0 €, aber der Kunde bleibt und deine laufende Provision lebt wieder." },
          { titel: "4 · Onboarding-Termin – immer", ziel: "Egal welcher Weg: Das Gespräch endet mit einem eingetragenen Termin aus deiner Availability.", saetze: ["„Ich habe Donnerstag 10:00 oder Freitag 14:30 – wann passt es Ihnen?“", "„Eingetragen. Sie bekommen die Bestätigung per Mail – und mich erreichen Sie ab jetzt direkt.“"], hinweis: "Im Onboarding ist die Bonitätsauskunft das Ziel (10 € für dich, wenn er sie zahlt – außer er hat sie schon). Ergebnis klicken: zahlt am / Rate ausgesetzt + Termin." },
        ),
        warn("Nie: „Sonst melden wir Sie bei der SCHUFA“, keine Fristen-Drohung, kein Inkasso-Ton. Diese Kunden sind keine Säumigen, die man treibt – sie sind Kunden, die man zurückgewinnt. Ab Tag 30 übernimmt das Back-Office nach Regeln; dein Anruf davor ist die letzte und beste Chance, das zu verhindern."),
        merk("Entschuldigen → zuhören → aufräumen → zwei Wege → Termin. Wer zahlt, bringt dir 50 % des Zahlungswerts. Wer aussetzt, bleibt Kunde – und das ist auf zwölf Monate mehr wert."),
      ],
    },
    wortregeln: {
      einleitung: "Die Wortregeln, wie sie der Prüfstand über jede Vorlage laufen lässt – und wie du sie im Gespräch hältst.",
      bloecke: [
        sagen(
          ["„FIAON begleitet Sie“ / „zeigt Ihnen“ / „sortiert das“ / „bereitet vor“ / „versendet“ / „verfolgt die Frist“", "„Auskunft“, „Übersicht“, „Handlungsplan“, „Einschätzung“", "„Die Bank entscheidet“ / „die Auskunftei prüft“", "„Das prüfe ich und melde mich bis … Uhr.“", "„Bonitätsmanager/in“, „Ansprechpartner/in“", "„Sie“ – immer"],
          ["beraten / Beratung / Empfehlung / empfehlen", "Garantie / garantiert / sicher / auf jeden Fall / 100 %", "Score verbessern / wir verbessern Ihren …", "Kredit / Sofortkredit / Kreditkarte garantiert / Limit / ohne SCHUFA / schufafrei", "nur heute / letzte Chance / läuft ab / verfällt", "„Schuldner“, „Mahnung mit Stimme“, Drohung mit Eintrag"],
        ),
        p("Am Telefon ist die Kreditkarte das Ziel des Kunden – du darfst sie nennen und stark dafür sprechen: „Genau dafür bauen wir die Grundlage.“ Verboten bleibt das Versprechen: nie „Kreditkarte garantiert“, nie ein Limit zusagen, nie „Kredit ohne SCHUFA“. In Nachfass-Mails und Textvorlagen sind „Kredit“ und „Kreditkarte“ komplett gesperrt (Prüfstand der Lead-Strecke)."),
        p("Warum so streng: Rechts- und Finanzberatung sind erlaubnispflichtig; Kreditvermittlung ebenso. Ein einziger Satz mit „garantiert“ in einer Nachricht ist ein Beweisstück. Und Druckwörter zerstören das Einzige, was wir verkaufen: Vertrauen."),
        merk("Wenn du nicht weißt, ob ein Wort erlaubt ist: Der Wortwächter (Kapitel 1) benutzt dieselbe Liste wie der Prüfstand für unsere Mails."),
      ],
    },
    einwand: {
      einleitung: "Neunzehn Einwände, wie sie täglich fallen. Zu jedem drei Antworten – eine ist gut, eine geht, eine schadet. Wähle, dann kommt die Bewertung mit Begründung. Der Schritt gilt als abgeschlossen, wenn du alle Einwände bearbeitet hast; dein Ergebnis wird gespeichert.",
      uebung: { art: "einwand", einwaende: [
        { einwand: "„Das kann ich doch alles selbst machen – die Datenkopie ist kostenlos.“", antworten: [
          { text: "„Stimmt, die Datenkopie nach Art. 15 ist kostenlos – das sagen wir auch so. FIAON übernimmt, was danach kommt: jeden Eintrag einordnen, prüfen, ob die Meldung zulässig war, die Schreiben vorbereiten, per Einschreiben versenden und die Fristen halten. Sie sehen jeden Schritt.“", bewertung: "gut", begruendung: "Ehrlich (die Kopie ist kostenlos), dann konkret, was FIAON zusätzlich leistet. Kein Druck." },
          { text: "„Selbst machen klappt fast nie, die SCHUFA antwortet Privatleuten kaum.“", bewertung: "schlecht", begruendung: "Falsch und unfair: Auskunfteien müssen innerhalb eines Monats antworten. Wer den Kunden mit Unwahrheiten hält, verliert ihn beim ersten Ratgeber-Artikel." },
          { text: "„Klar, dann brauchen Sie uns nicht. Viel Erfolg.“", bewertung: "mittel", begruendung: "Nicht falsch, aber eine verschenkte Gelegenheit: Der Kunde wollte wissen, was wir mehr tun – nicht, dass wir ihn gehen lassen." },
        ] },
        { einwand: "„Garantieren Sie mir, dass der Eintrag weg ist?“", antworten: [
          { text: "„Ja – bei uns ist noch keiner stehen geblieben.“", bewertung: "schlecht", begruendung: "Garantie ist verboten, die Aussage ist unwahr und beweisbar. Ein Satz, der das Unternehmen gefährdet." },
          { text: "„Nein, das kann niemand garantieren – wer es tut, lügt. Wir prüfen, ob die Meldung zulässig war: zwei Mahnungen, Fristen, Hinweis, nicht bestritten. Fehlt etwas, verlangen wir die Löschung – und Sie sehen jede Antwort im Bereich.“", bewertung: "gut", begruendung: "Klar nein, dann der Mechanismus. Ehrlichkeit ist hier das stärkste Verkaufsargument." },
          { text: "„Wir haben sehr gute Erfahrungswerte.“", bewertung: "mittel", begruendung: "Keine Garantie, aber auch keine Erklärung. Der Kunde bleibt mit seiner Frage allein." },
        ] },
        { einwand: "„Das ist mir zu teuer.“", antworten: [
          { text: "„Ich gebe Ihnen 30 Prozent Rabatt, aber nur, wenn Sie heute abschließen.“", bewertung: "schlecht", begruendung: "Druckwort, erfundener Rabatt, Preise außerhalb des Katalogs. Verboten." },
          { text: `„Verstehe. Lassen Sie uns schauen, was Sie brauchen: Nur die Auskunft gibt es für ${schufa} einmalig. Wenn Schreiben und Begleitung dazu sollen, ist Start mit ${preis("start")} im Monat der Einstieg. Was ist Ihr Ziel?“`, bewertung: "gut", begruendung: "Den Einwand annehmen, dann den passenden Rahmen aus dem Katalog zeigen – und zurück zum Ziel des Kunden." },
          { text: "„Teuer ist nur Ihr Eintrag – was kostet Sie eine abgelehnte Wohnung?“", bewertung: "mittel", begruendung: "Der Gedanke stimmt, aber der Ton ist konfrontativ und kann als Druck ankommen. Als Ergänzung nach der guten Antwort brauchbar." },
        ] },
        { einwand: "„Ist das Abzocke? Ich habe schlechte Erfahrungen mit solchen Firmen.“", antworten: [
          { text: "„Nein, wir sind seriös, das sehen Sie an unserer Website.“", bewertung: "mittel", begruendung: "Eine Behauptung beantwortet kein Misstrauen. Besser: überprüfbare Fakten nennen." },
          { text: `„Die Frage ist berechtigt – in dem Feld gibt es viel Betrug. Was Sie prüfen können: ${SUPPORT.firma}, ${SUPPORT.register}; kündbar formlos; kein Kredit, keine Vorkasse für Versprechen. Und jeder Schritt steht in Ihrem Bereich, bevor Sie ihn freigeben.“`, bewertung: "gut", begruendung: "Das Misstrauen ernst nehmen, überprüfbare Fakten, Kontrolle beim Kunden lassen." },
          { text: "„Wenn Sie so denken, sind Sie bei uns falsch.“", bewertung: "schlecht", begruendung: "Beleidigt statt erklärt. Der Kunde hat nur das gesagt, was viele denken." },
        ] },
        { einwand: "„Ich habe keine Zeit, rufen Sie später an.“", antworten: [
          { text: "„Kein Problem – ich rufe irgendwann nochmal an.“", bewertung: "schlecht", begruendung: "„Irgendwann“ ist kein Termin. Der Kunde geht im Pool unter, der nächste Anruf kommt ungelegen." },
          { text: "„Gern – passt Ihnen morgen 10:30 oder 16:00? Ich trage das ein und Sie bekommen eine kurze Bestätigung.“", bewertung: "gut", begruendung: "Zwei konkrete Zeiten, eine Bestätigung, ein Eintrag im System." },
          { text: "„Nur zwei Minuten, das geht schnell …“", bewertung: "mittel", begruendung: "Manchmal klappt es – oft wirkt es wie Drängeln. Respektiere das Nein und vereinbare eine Zeit." },
        ] },
        { einwand: "„Mein Partner ist dagegen, dass ich Geld für sowas ausgebe.“", antworten: [
          { text: "„Das verstehe ich. Soll ich Ihnen den Link zum Demo-Bereich schicken, dann können Sie es gemeinsam ansehen? Und wenn Sie mögen, sprechen wir zu dritt – ich erkläre gern, was wir tun und was nicht.“", bewertung: "gut", begruendung: "Den Partner einbeziehen statt ausmanövrieren. Das Demo-Konto ist dafür gebaut." },
          { text: "„Das ist doch Ihre Entscheidung, nicht seine.“", bewertung: "schlecht", begruendung: "Mischt sich in eine Beziehung ein und erzeugt Widerstand." },
          { text: "„Dann überlegen Sie es sich und melden sich.“", bewertung: "mittel", begruendung: "Respektvoll, aber ohne Hilfe. Ein Angebot (Demo, Gespräch zu dritt) fehlt." },
        ] },
        { einwand: "„Ich brauche eigentlich nur einen Kredit. Vermitteln Sie den?“", antworten: [
          { text: "„Ja, wir haben Partner für Kredite ohne SCHUFA.“", bewertung: "schlecht", begruendung: "Kreditvermittlung und „ohne SCHUFA“ sind verboten – und genau das Geschäft, vor dem wir warnen." },
          { text: "„Nein, FIAON vermittelt keine Kredite. Was wir tun: Ihre Auskunft bereinigen, wo sie falsch ist, und Konto und Karte vorbereiten – die Bank entscheidet. Wer Ihnen heute einen Kredit trotz Eintrag verspricht, will meist Vorkasse.“", bewertung: "gut", begruendung: "Klare Grenze, ehrliche Warnung, Weg aufgezeigt." },
          { text: "„Dafür sind wir nicht zuständig.“", bewertung: "mittel", begruendung: "Richtig, aber ohne Erklärung und ohne Warnung – der Kunde landet beim nächsten Vorkasse-Anbieter." },
        ] },
        { einwand: "„Warum ein Abo? Ich will einmal zahlen und fertig.“", antworten: [
          { text: `„Weil ein Eintrag nicht an einem Tag fällt: Die Datenkopie braucht bis zu einen Monat, ein Gläubiger antwortet nach Wochen, Löschfristen laufen über Monate. Zwölf Raten sind zwölf Monate, in denen jeden Monat etwas passiert – und Sie es sehen. Wer nur die Auskunft will, nimmt die Bonitätsauskunft für ${schufa} einmalig.“`, bewertung: "gut", begruendung: "Der Grund für das Abo ist der Zeitverlauf der Arbeit – und es gibt ehrlich die Einmal-Alternative." },
          { text: "„Das Abo können Sie ja sofort nach der ersten Rate kündigen.“", bewertung: "mittel", begruendung: "Stimmt formal, klingt aber nach Trick. Besser den Nutzen erklären." },
          { text: "„Alle machen das so.“", bewertung: "schlecht", begruendung: "Keine Erklärung, kein Respekt vor der Frage." },
        ] },
        { einwand: "„Ich habe den Eintrag doch längst bezahlt – warum steht er noch da?“", antworten: [
          { text: "„Das ist meistens rechtens: Erledigte Forderungen bleiben drei Jahre taggenau ab Erledigung gespeichert. Seit 2024 gibt es aber die 100-Tage-Regel – wer innerhalb von 100 Tagen nach der Meldung zahlt, ist nach 18 Monaten raus. Wir prüfen in Ihrer Datenkopie, welches Datum gemeldet wurde und ob es stimmt.“", bewertung: "gut", begruendung: "Die Regel korrekt, die Ausnahme genannt, der nächste Schritt konkret." },
          { text: "„Das ist ein Fehler der SCHUFA, das lassen wir sofort löschen.“", bewertung: "schlecht", begruendung: "Falsch: Bezahlte Einträge bleiben regulär drei Jahre. Ein Versprechen, das scheitert." },
          { text: "„Das müssen wir uns ansehen.“", bewertung: "mittel", begruendung: "Nicht falsch, aber der Kunde lernt nichts. Die Regel gehört in den Satz." },
        ] },
        { einwand: "„Ich habe schon ein Inkasso am Hals – ist es nicht zu spät?“", antworten: [
          { text: "„Nein. Gerade jetzt lohnt sich die Prüfung: Besteht die Forderung, ist sie verjährt, wurden Mahnungen zugestellt, sind die Kosten zulässig? Seit 2021 gelten Obergrenzen für Inkassokosten. Wir schreiben dem Inkasso in Ihrem Namen – per Einschreiben.“", bewertung: "gut", begruendung: "Struktur gegen Panik: vier Prüfpunkte, ein konkretes Angebot." },
          { text: "„Zahlen Sie erst mal, dann sehen wir weiter.“", bewertung: "schlecht", begruendung: "Zahlung kann ein Anerkenntnis sein und die Verjährung neu starten – und überhöhte Kosten wären bezahlt." },
          { text: "„Zu spät ist es nie.“", bewertung: "mittel", begruendung: "Freundlich, aber leer." },
        ] },
        { einwand: "„Ich wohne in Österreich – gilt das bei mir überhaupt?“", antworten: [
          { text: "„Ja, genauso wie in Deutschland – die SCHUFA ist überall gleich.“", bewertung: "schlecht", begruendung: "Falsch: In Österreich heißen die Auskunfteien KSV1870 und CRIF, dazu die Warnliste der Banken." },
          { text: "„Ja. In Österreich sind das KSV1870 und CRIF, dazu die Warnliste der Banken. Das Auskunftsrecht nach Art. 15 DSGVO gilt auch dort; FIAON beschafft die Auskünfte mit Vollmacht und schreibt nach österreichischem Recht.“", bewertung: "gut", begruendung: "Richtige Stellen, richtige Rechtsgrundlage, keine deutsche Regel übertragen." },
          { text: "„Das muss ich prüfen und melde mich.“", bewertung: "mittel", begruendung: "Ehrlich, aber die Grundlagen sollte jeder Bonitätsmanager kennen (Kapitel 7)." },
        ] },
        { einwand: "„Ich will kündigen, bei Ihnen passiert nichts.“", antworten: [
          { text: "„Sie können nicht kündigen, Sie haben zwölf Raten unterschrieben.“", bewertung: "schlecht", begruendung: "Falsch (kündbar formlos) und feindselig. Kündigung garantiert." },
          { text: "„Das tut mir leid, dass es so ankommt. Darf ich Ihnen kurz zeigen, was in Ihrer Akte passiert ist? [Schreiben, Fristen, Antworten.] Wenn Sie danach trotzdem gehen wollen: Abo & Zahlungen im Bereich, formlos, kein Grund nötig.“", bewertung: "gut", begruendung: "Gefühl anerkennen, Fakten aus der Akte, Entscheidung beim Kunden lassen – inklusive des Kündigungswegs." },
          { text: "„Ich gebe Ihnen zwei Monate gratis.“", bewertung: "mittel", begruendung: "Kein Versprechen, das du geben darfst – und es beantwortet die Enttäuschung nicht." },
        ] },
        { einwand: "„Ich habe gerade meinen Job verloren, ich kann mir nichts leisten.“", antworten: [
          { text: "„Dann sollten Sie erst mal wieder Arbeit finden.“", bewertung: "schlecht", begruendung: "Moralisiert und lässt jemanden allein, der gerade einen der drei häufigsten Überschuldungsauslöser erlebt." },
          { text: `„Das ist eine der häufigsten Situationen, die wir sehen – Sie sind damit nicht allein. Ohne Druck: Die kostenlose Datenkopie können Sie jederzeit selbst anfordern, unser Werkzeug schreibt den Brief. Wenn Sie später Begleitung wollen, ist Start mit ${preis("start")} im Monat der Einstieg. Was wäre Ihnen jetzt am wichtigsten?“`, bewertung: "gut", begruendung: "Einordnung ohne Mitleid, ein kostenloser Weg, ein passender Rahmen, keine Verkaufsdruck." },
          { text: "„Wir haben Ratenzahlung.“", bewertung: "mittel", begruendung: "Geht am Thema vorbei – er hat kein Zahlungs-, sondern ein Lebensproblem." },
        ] },
        { einwand: "„Was ist mein Score jetzt? Sagen Sie mir die Zahl.“", antworten: [
          { text: "„Den genauen Wert sehen wir erst in Ihrer Auskunft – ich rate keine Zahl. Wichtig: Der Basisscore ist nicht das, was eine Bank sieht; Vertragspartner fragen Branchenscores ab. Wir erklären Ihnen beides, wenn die Auskunft da ist.“", bewertung: "gut", begruendung: "Keine erfundene Zahl, dafür die wichtige Unterscheidung Basisscore/Branchenscore." },
          { text: "„Bestimmt so um die 80 Prozent.“", bewertung: "schlecht", begruendung: "Geraten – und jede falsche Zahl wird gegen dich verwendet." },
          { text: "„Das darf ich nicht sagen.“", bewertung: "mittel", begruendung: "Klingt nach Geheimnis. Besser: erklären, warum du es noch nicht weißt." },
        ] },
        { einwand: "„Warum muss ich den Kontoauszug hochladen? Das ist privat.“", antworten: [
          { text: "„Ohne Kontoauszug geht gar nichts.“", bewertung: "mittel", begruendung: "Stimmt für die Finanzanalyse, erklärt aber nichts und klingt nach Zwang." },
          { text: "„Verstehe. Der Auszug der letzten drei Monate dient zwei Dingen: Wir erkennen Rücklastschriften, bevor sie zum Eintrag werden, und die Zahlen sind später die Vorqualifizierung für Konto und Karte – ohne eine Anfrage, die Ihren Wert senkt. Gespeichert verschlüsselt in der EU, nur für Ihre Akte. Sie können Beträge, die Sie nicht zeigen wollen, schwärzen – Gehalt und Fixkosten brauchen wir lesbar.“", bewertung: "gut", begruendung: "Zweck, Schutz, Kontrolle – und ein praktischer Kompromiss." },
          { text: "„Das machen alle Kunden so.“", bewertung: "schlecht", begruendung: "Sozialer Druck statt Erklärung." },
        ] },
        { einwand: "„Ich habe doch schon bezahlt – wozu brauche ich jetzt noch einen Termin?“", kontext: "Stufe A: Der Kunde hat „Ich habe überwiesen“ geklickt.", antworten: [
          { text: "„Das Startgespräch ist Pflicht, ohne geht es nicht weiter.“", bewertung: "mittel", begruendung: "Stimmt, klingt aber nach Hürde. Besser den Nutzen nennen: Aktivierung, Fahrplan, Unterlagen – und den Termin sofort anbieten." },
          { text: "„Weil ich in diesem Gespräch Ihr Konto vollwertig aktiviere: Wir gehen Ihren Fahrplan durch, klären, welche Unterlagen fehlen, und Sie wissen danach genau, was als Nächstes passiert. Fünfzehn Minuten – ich hätte morgen 10:30 oder 15:00.“", bewertung: "gut", begruendung: "Nutzen statt Pflicht, konkrete Dauer, zwei Zeiten aus der eigenen Availability – und der Termin wird sofort eingetragen." },
          { text: "„Dann brauchen Sie keinen Termin, ich schalte Sie einfach frei.“", bewertung: "schlecht", begruendung: "Ohne Startgespräch keine Freischaltung – und ohne Startgespräch beginnt der häufigste Streitfall („Ich dachte, das war einmalig“)." },
        ] },
        { einwand: "„Schicken Sie mir erst mal die Rechnung, ich überlege dann.“", kontext: "Stufe B: Antrag fertig, nicht bezahlt.", antworten: [
          { text: "„Gern – die Zahlungsdaten mit Ihrer Referenz gehen gleich raus. Damit Sie nicht ins Leere überlegen: Ich trage uns ein kurzes Startgespräch ein, Donnerstag 11:00 oder 16:30. Wenn die Überweisung bis dahin da ist, aktiviere ich direkt im Gespräch – wenn nicht, besprechen wir Ihre Fragen trotzdem.“", bewertung: "gut", begruendung: "Der Termin kommt vor dem Geld, die Zahlungsdaten gehen sofort raus, und der Kunde hat einen Grund, nicht zu verschleppen." },
          { text: "„Okay, ich schicke die Rechnung. Melden Sie sich, wenn Sie so weit sind.“", bewertung: "mittel", begruendung: "Kein Termin, kein Datum – Stufe B bleibt Stufe B. Die meisten melden sich nicht." },
          { text: "„Überlegen können Sie später – erst die Zahlung, sonst geht gar nichts.“", bewertung: "schlecht", begruendung: "Druck statt Verabredung. Der Kunde fühlt sich abgefertigt, nicht willkommen." },
        ] },
        { einwand: "„Bei Ihnen hat sich monatelang niemand gemeldet – und jetzt rufen Sie wegen Geld an?“", kontext: "Reaktivierung: überfällige Rate, Kunde mit schwierigem Start.", antworten: [
          { text: "„Sie haben völlig recht, und dafür entschuldige ich mich zuerst – Sie haben lange gewartet, das war nicht in Ordnung. Deshalb rufe ich an: Ich bin ab jetzt Ihr fester Ansprechpartner. Bevor wir über die Rate sprechen: Lassen Sie uns Ihre Akte durchgehen – und wenn es gerade nicht passt, setze ich die Rate einen Monat aus und wir starten mit Ihrem Onboarding-Termin neu.“", bewertung: "gut", begruendung: "Entschuldigung zuerst, Verantwortung übernehmen, das Aussetzen als echtes Angebot – kein Inkasso-Ton. Genau der Reaktivierungs-Leitfaden." },
          { text: "„Dafür kann ich nichts, ich bin neu. Aber die Rate ist trotzdem offen.“", bewertung: "schlecht", begruendung: "Verantwortung abgeschoben und sofort aufs Geld – der Kunde legt auf und kündigt. FIAON entschuldigt sich als Ganzes, nicht als Person." },
          { text: "„Das tut mir leid. Wollen Sie die Rate jetzt überweisen?“", bewertung: "mittel", begruendung: "Die Entschuldigung ist da, aber zu dünn – und der Sprung zum Geld kommt zu früh. Erst zuhören und aufräumen, dann die zwei Wege." },
        ] },
        { einwand: "„Können Sie mir versprechen, dass ich in drei Monaten eine Kreditkarte habe?“", antworten: [
          { text: "„Ja, drei Monate sind realistisch.“", bewertung: "schlecht", begruendung: "Ein Versprechen für etwas, das die Bank entscheidet. Verboten." },
          { text: "„Nein, das entscheidet die Bank. Was ich Ihnen zeigen kann: Ihre Karten-Readiness in Ihrem Bereich – wie weit Sie entfernt sind und welcher Schritt was bringt. Wenn der letzte angreifbare Eintrag fällt, bereiten wir den Antrag vor.“", bewertung: "gut", begruendung: "Klare Grenze, dann das Werkzeug, das die Frage ehrlich beantwortet." },
          { text: "„Das hängt von vielen Faktoren ab.“", bewertung: "mittel", begruendung: "Wahr, aber leer – ohne das Werkzeug, das die Faktoren zeigt." },
        ] },
      ] },
    },
    simulator: {
      einleitung: "Ein KI-Kunde spielt einen realen Fall – darunter Stufe A (bezahlt, kein Termin) und Stufe B (Antrag offen) – am Telefon, in kurzen Sätzen. Du schreibst, was du sagen würdest. Wenn das Gespräch am Ende ist, klickst du „Gespräch beenden“ und bekommst eine Bewertung (Note 1–5, Stärken, Schwächen, Wortregel-Verstöße). Der Schritt gilt als abgeschlossen, sobald ein Gespräch bewertet wurde – Note 3 oder besser. Du kannst jedes Szenario beliebig oft spielen.",
      uebung: { art: "simulator" },
    },
  },
  test: [
    frage("Stufe A, der Kunde hat „Ich habe überwiesen“ geklickt. Richtige Reihenfolge im Anruf?", ["Zahlung prüfen → Termin → Willkommen", "Willkommen → Karte als Ziel → Termin sofort eintragen → Zahlung beiläufig bestätigen", "Termin → Preis → Zahlung", "Nur die Zahlung bestätigen"], 1, "Willkommen, Karte, Termin, Zahlung – nie umgekehrt."),
    frage("Womit endet jedes Gespräch?", ["Mit einem Gruß", "Mit einer Verabredung (wer tut was bis wann) und einem Klick im Gesprächsblatt", "Mit der Preisliste", "Mit einem Rabatt"], 1, "Eine Verabredung, kein Gruß – und das Ergebnis im System."),
    frage("Der Kunde fragt nach einer Garantie. Richtig ist:", ["„Ja, zu 100 Prozent.“", "Klar nein, dann den Prüfmechanismus erklären (§ 31 BDSG, Löschung bei fehlenden Voraussetzungen)", "„Wir haben gute Erfahrungswerte.“", "Thema wechseln"], 1, "Ehrlichkeit ist das Argument."),
    frage("„Rufen Sie später an.“ – Beste Reaktion?", ["„Irgendwann nochmal.“", "Zwei konkrete Zeiten anbieten, eintragen, Bestätigung", "Weiterreden", "Auflegen"], 1, "Ein Rückruf ohne Termin findet nicht statt."),
    frage("Ein Kunde mit überfälliger Rate hatte einen schwierigen Start. Womit beginnt dein Anruf?", ["Mit der offenen Rate", "Mit Vorstellung und einer ehrlichen Entschuldigung für die lange Wartezeit – erst dann die zwei Wege: zahlen oder einen Monat aussetzen plus Onboarding-Termin", "Mit einer Frist", "Mit der SCHUFA"], 1, "Reaktivierung ist Rückgewinnung, kein Inkasso."),
    frage("Was sagst du am Tag 14 NICHT?", ["„Die Rate ist offen – ist etwas dazwischengekommen?“", "„Sonst melden wir Sie bei der SCHUFA.“", "„Bis Tag 30 bleibt alles offen.“", "„Wann können Sie überweisen – passt der 28.?“"], 1, "Keine Drohung mit Eintrag – weder gewollt noch ohne Weiteres erlaubt."),
    frage("Der Kunde will den Score als Zahl hören, die Auskunft liegt noch nicht vor.", ["Eine Zahl schätzen", "Keine Zahl raten; Basisscore und Branchenscores unterscheiden; auf die Auskunft verweisen", "„Das darf ich nicht sagen.“", "Ihn an die SCHUFA verweisen"], 1, "Nie raten; die Unterscheidung gehört in den Satz."),
    frage("Welche Anrede gilt im Gespräch mit Kunden?", ["Du", "Sie", "Vorname ohne Anrede", "Je nach Stimmung"], 1, "Kunden werden gesiezt."),
    frage("Ein Kunde fragt nach einem Kredit ohne SCHUFA.", ["Partner nennen", "Klare Grenze: FIAON vermittelt keine Kredite; vor Vorkasse-Angeboten warnen; Weg über Auskunft, Konto, Karte (Bank entscheidet)", "„Nicht zuständig.“", "Ultra verkaufen"], 1, "Kreditvermittlung und „ohne SCHUFA“ sind verboten."),
  ],
};
