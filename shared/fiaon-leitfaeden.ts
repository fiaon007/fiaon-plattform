// ═══════════════════════════════════════════════════════════════════════════
// DIE LEITFÄDEN — eine Quelle für Client und Server (02.09.2026)
//
// VORHER lebten Justins Leitfäden (Stufe A/B/C, Reaktivierung, Erstanruf,
// Rückruf, Startgespräch, Zahlungserinnerung) in der Gesprächs-Seite
// client/src/pages/agent/tools/gespraech.tsx. Der Copilot (Werkzeug
// anruf_vorbereiten) braucht dieselben Texte auf dem Server — ein zweiter
// Satz Leitfäden wäre die zweite Wahrheit, die AGENTS.md verbietet. Deshalb
// stehen sie jetzt hier; die Gesprächs-Seite und die Pipeline lesen sie von
// hier (Re-Export in gespraech.tsx, damit bestehende Importe halten).
//
// Diese Datei ist bewusst REIN (keine Abhängigkeiten).
//
// Regeln in den Texten (Justin, 23.08.2026, Plan §13): erste Zahlung IMMER
// direkt per Überweisung, nie Lastschrift; Karte und Konto sind Ziel, nie
// Zusage; keine Garantie, keine Beratung.
// ═══════════════════════════════════════════════════════════════════════════

export type Art = "stufe_a" | "stufe_b" | "stufe_c" | "reaktivierung" | "erstanruf" | "rueckruf" | "startgespraech" | "zahlung";
export interface Schritt { titel: string; text?: string; satz?: string }
export interface Einwand { frage: string; antwort: string }

export const ARTEN: { key: Art; label: string; kurz: string; schritte: Schritt[]; einwaende: Einwand[] }[] = [
  // ── Justins Leitfäden je Stufe (23.08.2026, Plan §13) – erste Zahlung IMMER direkt, nie Lastschrift ──
  {
    key: "stufe_a", label: "Stufe A · bezahlt, kein Termin", kurz: "Kunde hat „bezahlt“ geklickt – willkommen heißen, Karte pitchen, Termin sofort vergeben",
    schritte: [
      { titel: "Willkommen als Kunde", text: "Name, FIAON, Akzeptanz bestätigen. Der Kunde ist schon drin – Ton: Glückwunsch, nicht Verkauf.", satz: "Hi, hier ist … von FIAON. Ich habe gesehen, Sie, Herr …, sind bei uns erfolgreich akzeptiert worden – ich heiße Sie herzlich willkommen als Kunde bei FIAON." },
      { titel: "Karte und Ziel oben halten", text: "Stark Kreditkarten-pitchend: Was die Karte für ihn bedeutet, was als Nächstes passiert. Kunde emotional oben halten.", satz: "Damit sind Sie auf dem Weg zu Ihrer Karte – wir bereiten jetzt Konto und Karte vor, und Sie sehen jeden Schritt in Ihrem Bereich." },
      { titel: "Der eigentliche Grund: Termin", text: "Sofort den nächsten freien Termin aus deiner Availability nennen und im Calendar eintragen – der Slot ist dann wirklich blockiert.", satz: "Ich würde mir gerne einen Termin mit Ihnen vereinbaren, damit ich Ihr Konto aktivieren kann – wann haben Sie Zeit? Ich hätte … um … Uhr frei." },
      { titel: "Zahlung bestätigen lassen", text: "Erste Zahlung ist immer die Überweisung mit Referenz. Nicht nachbohren – nur bestätigen lassen und den Nutzen des Termins daran hängen.", satz: "Ich habe gesehen, Sie haben die Zahlung bereits eingeleitet, richtig? Ich frage nur, weil ich dann am … das Konto vollwertig aktivieren kann und Sie gleich loslegen können." },
      { titel: "Ergebnis festhalten", text: "Termin gebucht, Zahlung eingeleitet ja/nein – in der Akte buchen.", satz: "Dann sehen wir uns am … um … Uhr – Sie bekommen die Bestätigung per E-Mail." },
    ],
    einwaende: [
      { frage: "„Ich habe noch nicht überwiesen.“", antwort: "Kein Problem – ich schicke Ihnen die Zahlungsdaten gleich noch einmal. Wenn die erste Rate vor unserem Termin eingeht, aktiviere ich am Termin sofort vollwertig." },
      { frage: "„Wann bekomme ich die Karte?“", antwort: "Über Karte und Rahmen entscheidet die Bank – wir bereiten alles so vor, dass Ihre Unterlagen sauber sind. Den Stand sehen Sie jederzeit in Ihrem Bereich." },
      { frage: "„Brauche ich den Termin wirklich?“", antwort: "Ja – im Termin aktiviere ich Ihr Konto vollwertig, prüfe Ihre Angaben und starte den ersten Schritt. Das dauert 15 Minuten und spart Ihnen Wochen." },
    ],
  },
  {
    key: "stufe_b", label: "Stufe B · Antrag, nicht bezahlt", kurz: "Antrag liegt vor, keine Zahlung – Bezug auf Karte und Konzept, Termin, Zahlungsdaten",
    schritte: [
      { titel: "Anlass nennen", text: "Bezug auf den Antrag, Kreditkarte und das FIAON-Konzept. Kurz fragen, ob es passt.", satz: "Ich grüße Sie, Herr …, hier ist … von FIAON – bezüglich Ihres Antrags wegen einer Kreditkarte und zum FIAON-Konzept. Haben Sie einen Moment?" },
      { titel: "Konzept in drei Sätzen", text: "Auskunft beschaffen und erklären, Schreiben versenden und verfolgen, Konto und Karte vorbereiten. Über die Karte entscheidet die Bank.", satz: "FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben in Ihrem Namen und bereitet Konto und Karte vor." },
      { titel: "Termin vereinbaren", text: "Nächsten freien Termin aus deiner Availability nennen und eintragen.", satz: "Ich würde gerne einen Termin mit Ihnen vereinbaren, in dem ich Ihr Konto aktiviere – wann passt es Ihnen, … um … Uhr?" },
      { titel: "Rechnung ansprechen, Zahlungsdaten senden", text: "Erste Zahlung immer per Überweisung mit Referenz. Zahlungsdaten aus der Akte senden (E-Mail), Verwendungszweck vorlesen.", satz: "Ich schicke Ihnen jetzt die Zahlungsdaten. Wenn die erste Rate vor dem Termin eingeht, aktiviere ich Ihr Konto direkt im Gespräch." },
      { titel: "Ergebnis festhalten", text: "Termin, zahlt am …, Rückruf – in der Akte buchen.", satz: "Dann bis … – die Bestätigung und die Zahlungsdaten sind gleich in Ihrem Postfach." },
    ],
    einwaende: [
      { frage: "„Was kostet das?“", antwort: "Das Paket … kostet … € im Monat, zwölf Raten – die erste per Überweisung, danach entscheiden Sie, ob Sie bleiben." },
      { frage: "„Ich überlege noch.“", antwort: "Verstehe. Lassen Sie uns den Termin trotzdem festhalten – dann haben Sie bis dahin alles in Ihrem Bereich gesehen und entscheiden mit vollem Bild." },
      { frage: "„Schicken Sie mir das per Mail.“", antwort: "Mache ich sofort – Zahlungsdaten und Übersicht. Und damit es nicht liegen bleibt: Passt Ihnen … um … Uhr für das Aktivierungsgespräch?" },
    ],
  },
  {
    key: "stufe_c", label: "Stufe C · Facebook-Lead", kurz: "Nur registriert – Daten aufnehmen, Vertrag am Telefon, Zugänge senden, Termin",
    schritte: [
      { titel: "Anlass nennen", text: "Bezug auf die Registrierung. Kurz fragen, ob es passt. Aufnahme-Einwilligung einholen, bevor es um den Vertrag geht.", satz: "Hi, hier ist … von FIAON – ich rufe an, weil Sie sich bei uns für eine Kreditkarte registriert haben. Haben Sie einen Augenblick?" },
      { titel: "Daten aufnehmen", text: "Name, Geburtsdatum, Adresse mit Hausnummer, E-Mail, Telefon, Ziel, Einträge bekannt? – Antrag für den Kunden ausfüllen.", satz: "Ich nehme kurz Ihre Daten auf, damit ich Ihren Antrag für Sie anlegen kann – Ihre vollständige Adresse bitte?" },
      { titel: "Paket und Vertrag", text: "Paketfinder nutzen. Annahmesatz vorlesen, hörbare Bestätigung (Gespräch wird aufgezeichnet). Bestätigung in Textform folgt per E-Mail.", satz: "Für Ihre Lage passt das Paket … zu … € im Monat. Nehmen Sie das Paket so an? – Danke, ich habe Ihr Ja festgehalten; die Bestätigung kommt per E-Mail." },
      { titel: "Zugänge senden", text: "Zugangsdaten-Mail auslösen (Akte), damit der Kunde sofort in seinen Bereich kommt.", satz: "Sie bekommen jetzt eine E-Mail mit Ihrem Zugang – damit sehen Sie alles, was wir gerade besprochen haben." },
      { titel: "Termin und Rechnung", text: "Termin aus deiner Availability vergeben. Erste Zahlung immer per Überweisung mit Referenz.", satz: "Wenn Sie vor dem Termin bitte die Rechnung begleichen, dann kann ich Ihr Konto im Gespräch gleich aktivieren – passt Ihnen … um … Uhr?" },
      { titel: "Ergebnis festhalten", text: "Vertrag angenommen, Zugänge gesendet, Termin, zahlt am … – alles in der Akte.", satz: "Dann bis … – Zugang und Zahlungsdaten sind in Ihrem Postfach." },
    ],
    einwaende: [
      { frage: "„Ich wollte nur mal schauen.“", antwort: "Genau dafür ist das Gespräch da: In zwei Minuten wissen Sie, ob FIAON für Sie passt. Was wäre Ihnen am wichtigsten – Karte, Kredit oder erst mal Klarheit über Ihre Einträge?" },
      { frage: "„Das klingt nach Abzocke.“", antwort: "Verstehe ich – deshalb läuft alles transparent in Ihrem Bereich: Sie sehen jeden Schritt, jede Rate, jedes Schreiben. Die erste Rate überweisen Sie selbst, niemand bucht etwas ab." },
      { frage: "„Ich habe kein Geld dafür.“", antwort: "Dann schauen wir auf den Einstieg mit FIAON Start – die Auskunft erklärt und die Schreiben zum Selbstversand. Und wir legen die erste Rate auf ein Datum, das für Sie passt." },
    ],
  },
  {
    key: "reaktivierung", label: "Reaktivierung · Rate überfällig", kurz: "Altbestand weich zurückholen – vorstellen, entschuldigen, Zahlung oder 1 Monat aussetzen (E-042a: 50 % nur Altbestand)",
    schritte: [
      { titel: "Vorstellen, nicht mahnen", text: "Kein Inkasso-Ton. Du stellst dich als neuer Ansprechpartner vor – der Kunde hat lange gewartet.", satz: "Guten Tag, mein Name ist … von FIAON – ich rufe an, um mich bei Ihnen vorzustellen. Ich weiß, Sie hatten einen echt schwierigen Start bei uns …" },
      { titel: "Entschuldigen und zuhören", text: "Ehrlich entschuldigen, dann zuhören. Was ist beim Kunden passiert? Nichts rechtfertigen.", satz: "Dafür möchte ich mich zuerst entschuldigen – das war nicht die Betreuung, die Sie verdienen. Ab heute bin ich persönlich für Sie da. Wie ist es Ihnen zwischenzeitlich ergangen?" },
      { titel: "Neustart anbieten", text: "Der Plan: Konto wieder aktiv, ein fester Termin, ab jetzt ein Ansprechpartner.", satz: "Mein Vorschlag: Wir machen einen sauberen Neustart – ich aktiviere Ihre Betreuung wieder und wir gehen Ihre Lage gemeinsam durch." },
      { titel: "Weg A: Zahlung", text: "Wenn der Kunde kann: offene Rate per Überweisung (Referenz vorlesen). Dein Bonus (nur Altbestand): 50 % dieser Zahlung.", satz: "Die offene Rate sind … € – wenn Sie die in den nächsten Tagen überweisen, läuft ab dann wieder alles für Sie. Ich schicke Ihnen die Zahlungsdaten gleich per E-Mail." },
      { titel: "Weg B: 1 Monat aussetzen", text: "Wenn der Kunde gerade nicht kann: Rate einen Monat aussetzen (in der Akte festhalten). Keine Vergütung – aber Beziehung gerettet.", satz: "Wenn es diesen Monat eng ist, setze ich Ihre Rate einen Monat aus – ohne Kosten, ohne Haken. Dann starten wir im … frisch." },
      { titel: "Onboarding-Termin buchen", text: "Immer, egal ob A oder B: Termin aus deiner Availability vergeben und eintragen.", satz: "Damit wir sauber starten: Wann passt Ihnen ein kurzes Gespräch, in dem ich alles mit Ihnen durchgehe – … um … Uhr?" },
      { titel: "Ergebnis festhalten", text: "„Zahlt am …“ mit Bonusvermerk oder „ausgesetzt bis …“ + Termin – in der Akte buchen.", satz: "Danke für das Gespräch – Sie hören von mir, und alles Besprochene steht in Ihrem Bereich." },
    ],
    einwaende: [
      { frage: "„Bei euch hat sich monatelang niemand gemeldet.“", antwort: "Sie haben recht, und genau deshalb rufe ich an. Das war unser Fehler, nicht Ihrer. Ab heute haben Sie mit mir einen festen Ansprechpartner – und ich zeige Ihnen im Gespräch, was in Ihrem Bereich schon alles vorbereitet ist." },
      { frage: "„Ich will kündigen.“", antwort: "Das können Sie jederzeit – aber bevor Sie entscheiden: Lassen Sie mich Ihnen in 15 Minuten zeigen, wo Sie gerade stehen und was schon bezahlt ist. Danach entscheiden Sie mit vollem Bild. Wann passt es Ihnen?" },
      { frage: "„Ich kann gerade nicht zahlen.“", antwort: "Dann setze ich Ihre Rate einen Monat aus – ohne Kosten. Wichtig ist mir nur, dass wir im Gespräch bleiben und Ihren Neustart planen." },
    ],
  },
  {
    key: "erstanruf", label: "Erstanruf", kurz: "Lead oder abgebrochener Antrag – Interesse prüfen, zum Antrag führen",
    schritte: [
      { titel: "Begrüßung und Anlass", text: "Name, FIAON, Bezug auf den Antrag oder die Anfrage. Kurz fragen, ob es gerade passt.", satz: "Guten Tag, hier ist … von FIAON. Sie haben bei uns eine Anfrage gestellt – passt es Ihnen gerade für zwei Minuten?" },
      { titel: "Ziel des Kunden", text: "Kreditkarte, Kredit, Wohnung, Unternehmen? Das Ziel bestimmt das Paket.", satz: "Was möchten Sie mit FIAON erreichen – geht es um eine Karte, einen Kredit oder eine Wohnung?" },
      { titel: "Lage klären", text: "Negativeinträge? Inkasso? Fristen? Was hat der Kunde schon versucht?", satz: "Gibt es Einträge, von denen Sie wissen – Mahnungen, Inkasso, ein Titel?" },
      { titel: "FIAON in drei Sätzen", text: "Auskunft beschaffen und erklären, Schreiben versenden und verfolgen, Konto und Karte vorbereiten. Über Karte und Rahmen entscheidet die Bank.", satz: "FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben in Ihrem Namen und bereitet Konto und Karte vor – über die Karte entscheidet die Bank." },
      { titel: "Paket und Rate nennen", text: "Paketfinder nutzen. Rate, zwölf Raten, danach entscheidet der Kunde.", satz: "Für Ihre Lage passt das Paket … – das sind … € im Monat, zwölf Raten, danach entscheiden Sie, ob Sie bleiben." },
      { titel: "Abschluss", text: "Zahlungsdaten senden oder Zahlungsdatum vereinbaren. Ergebnis in der Akte festhalten.", satz: "Dann schicke ich Ihnen jetzt die Zahlungsdaten. Mit der ersten Rate ist Ihr Bereich aktiv, und wir buchen Ihr Startgespräch." },
    ],
    einwaende: [
      { frage: "„Das kann ich doch selbst machen.“", antwort: "Ja – die Auskunft ist kostenlos. Der Unterschied liegt danach: Wer schreibt die Gläubiger an, wer verfolgt Fristen, wer bewertet die Antworten? Das übernimmt FIAON, und Sie sehen alles in Ihrem Bereich." },
      { frage: "„Das ist mir zu teuer.“", antwort: "Verstehe ich. Rechnen wir kurz: Ein einziger erledigter Eintrag entscheidet über Karte oder Absage. Es gibt auch den Einstieg mit FIAON Start – die Auskunft erklärt, die Schreiben zum Selbstversand." },
      { frage: "„Bringt das überhaupt etwas?“", antwort: "Das hängt von Ihren Einträgen ab – deshalb beginnt alles mit der Auskunft. Was angreifbar ist, greifen wir an; was berechtigt ist, sortieren wir mit Ihnen. Versprechen kann ich nichts, zeigen kann ich Ihnen alles." },
      { frage: "„Ich muss erst mit meinem Partner sprechen.“", antwort: "Gern. Darf ich Ihnen die Zahlungsdaten und die Übersicht per Mail schicken, damit Sie beides gemeinsam ansehen? Wann darf ich mich melden – morgen oder übermorgen?" },
      { frage: "„Ich habe gerade keine Zeit.“", antwort: "Kein Problem. Wann passt es Ihnen besser – heute Nachmittag oder morgen früh? Ich trage den Rückruf ein." },
    ],
  },
  {
    key: "rueckruf", label: "Rückruf", kurz: "Vereinbarter Rückruf oder Zahlungszusage – anknüpfen, abschließen",
    schritte: [
      { titel: "Anknüpfen", text: "Bezug auf das letzte Gespräch (Verlauf in der Akte lesen).", satz: "Guten Tag, hier ist … von FIAON. Wir hatten vereinbart, dass ich mich heute melde – passt es gerade?" },
      { titel: "Stand abfragen", text: "Überwiesen? Entschieden? Was fehlt noch?", satz: "Konnten Sie die erste Rate schon überweisen – oder ist noch etwas offen, das wir klären sollten?" },
      { titel: "Hindernis lösen", text: "Fehlende E-Mail, falsche Nummer, Paketwechsel – direkt in der Akte erledigen.", satz: "Das bekommen wir sofort hin – ich ändere das gleich für Sie." },
      { titel: "Verbindlich werden", text: "Zahlungsdatum oder Zahlungsdaten erneut senden. Beleg erbitten, wenn überwiesen.", satz: "Wann überweisen Sie – heute oder morgen? Dann trage ich das ein und wir sprechen direkt nach dem Eingang." },
      { titel: "Ergebnis festhalten", text: "In der Akte: zahlt am …, Rückruf, nicht erreicht. Keine Notiz ohne Ergebnis.", satz: "Danke Ihnen – ich halte das fest, und Sie hören von mir, sobald der Eingang da ist." },
    ],
    einwaende: [
      { frage: "„Ich habe es noch nicht geschafft.“", antwort: "Das passiert. Soll ich Ihnen die Zahlungsdaten jetzt noch einmal per WhatsApp schicken? Dann ist es in zwei Minuten erledigt, und ich rufe morgen kurz an." },
      { frage: "„Ich habe überwiesen, aber es ist nichts passiert.“", antwort: "Danke – dann prüfen wir den Eingang. Schicken Sie mir bitte ein Foto der Überweisung; ich hinterlege es direkt bei der Zahlungsprüfung." },
      { frage: "„Ich habe es mir anders überlegt.“", antwort: "Darf ich fragen, was Sie zögern lässt? Oft ist es die Rate oder die Frage, ob es sich lohnt – beides lässt sich lösen: ein kleineres Paket oder erst einmal nur die Auskunft." },
    ],
  },
  {
    key: "startgespraech", label: "Startgespräch", kurz: "Bezahlter Kunde – 15 Minuten, Fahrplan, Vollmacht, Unterlagen",
    schritte: [
      { titel: "Willkommen und Rahmen", text: "15 Minuten, Fahrplan erklären, feste Ansprechpartnerin nennen.", satz: "Willkommen bei FIAON. Wir haben jetzt eine Viertelstunde: Ich zeige Ihnen den Fahrplan, und Sie sagen mir, was Ihnen am wichtigsten ist." },
      { titel: "Ziel und Lage", text: "Ziel bestätigen, bekannte Einträge, Briefe, Fristen.", satz: "Was ist Ihr wichtigstes Ziel in den nächsten drei Monaten?" },
      { titel: "Vollmacht und Auskunft", text: "Auskunft wird beantragt, Einsicht etwa 24 Stunden nach Eingang. Zustimmungen gibt nur der Kunde selbst – Link schicken.", satz: "Mit Ihrer Vollmacht beantragen wir die Auskunft; etwa einen Tag nach Eingang sehen Sie jeden Eintrag erklärt in Ihrem Bereich." },
      { titel: "Unterlagen", text: "Kontoauszug der letzten drei Monate, Ausweis – Handyfoto genügt.", satz: "Laden Sie bitte den Kontoauszug der letzten drei Monate und Ihren Ausweis hoch – ein Handyfoto reicht." },
      { titel: "Nächste Schritte und Termin", text: "Was passiert wann; nächsten Kontakt vereinbaren.", satz: "Sobald die Auskunft da ist, melde ich mich – dann gehen wir Eintrag für Eintrag durch." },
    ],
    einwaende: [
      { frage: "„Wie lange dauert das alles?“", antwort: "Die Auskunft kommt meist innerhalb weniger Tage; Schreiben an Gläubiger haben Fristen von zwei bis vier Wochen. Sie sehen jeden Schritt mit Datum in Ihrem Bereich." },
      { frage: "„Bekomme ich danach sicher eine Karte?“", antwort: "Über die Karte entscheidet die Bank – das kann niemand versprechen. FIAON sorgt dafür, dass Ihre Auskunft sauber ist und der Antrag vorbereitet liegt, sobald die Schwelle erreicht ist." },
      { frage: "„Muss ich die Unterlagen wirklich hochladen?“", antwort: "Für die Finanzauswertung ja – sie zeigt Einnahmen, Fixkosten und Spielraum. Ohne Kontoauszug fehlt der wichtigste Teil des Bildes." },
    ],
  },
  {
    key: "zahlung", label: "Zahlungserinnerung", kurz: "Rechnung offen oder Frist abgelaufen – freundlich, klar, verbindlich",
    schritte: [
      { titel: "Freundlich anknüpfen", text: "Kein Vorwurf. Bezug auf Antrag und Paket.", satz: "Guten Tag, hier ist … von FIAON. Sie haben bei uns das Paket … beantragt – ich rufe an, weil die erste Rate noch nicht bei uns eingegangen ist." },
      { titel: "Grund erfragen", text: "Vergessen? Zahlungsdaten nicht erhalten? Zweifel? Geld fehlt?", satz: "Haben Sie die Zahlungsdaten erhalten – oder ist etwas dazwischengekommen?" },
      { titel: "Weg freimachen", text: "Zahlungsdaten per Mail oder WhatsApp erneut senden, Verwendungszweck vorlesen.", satz: "Ich schicke Ihnen die Zahlungsdaten gleich noch einmal – der Verwendungszweck lautet … Damit ordnen wir Ihre Zahlung sofort zu." },
      { titel: "Datum vereinbaren", text: "Konkretes Zahlungsdatum festhalten („zahlt am“).", satz: "Bis wann können Sie überweisen? Dann trage ich das Datum ein, und Ihr Bereich ist mit dem Eingang aktiv." },
      { titel: "Ergebnis festhalten", text: "Zahlt sofort / zahlt am … / abgelehnt – in der Akte buchen.", satz: "Vielen Dank – ich halte das fest und melde mich, sobald die Zahlung da ist." },
    ],
    einwaende: [
      { frage: "„Ich habe keine Zahlungsdaten bekommen.“", antwort: "Dann holen wir das sofort nach. Stimmt Ihre E-Mail-Adresse …? Ich schicke die Daten jetzt – oder gleich per WhatsApp, wenn Ihnen das lieber ist." },
      { frage: "„Ich habe gerade kein Geld.“", antwort: "Verstehe ich. Wann ist Ihr nächster Gehaltseingang? Dann tragen wir genau dieses Datum ein, und Sie müssen an nichts mehr denken." },
      { frage: "„Ich will das Paket doch nicht mehr.“", antwort: "Darf ich fragen, was sich geändert hat? Wenn die Rate das Problem ist, gibt es den Einstieg mit FIAON Start. Wenn es die Zweifel sind: Wir beginnen ohnehin mit der Auskunft – die zeigt, ob es sich lohnt." },
      { frage: "„Warum ruft ihr schon wieder an?“", antwort: "Weil Ihr Antrag bei uns offen liegt und ich nicht möchte, dass er einfach verfällt. Wenn Sie es nicht mehr möchten, sage ich das so in die Akte – und Sie hören nichts mehr von uns." },
    ],
  },
];

/** Welche Lage (KundenSituation.art aus server/routes/fiaon-office-vertrieb.ts)
 *  welchen Leitfaden bekommt. Der HEUTIGE Termin schlägt die Lage (Florentine,
 *  25.08.2026: „Ich führe ein Onboarding-Gespräch, bekomme aber einen Leitfaden,
 *  der zu einem Zahlungsrückstand gehört.") — dieselbe Regel wie in der
 *  Pipeline (sitLeitfaden). Abweichung von der Pipeline, mit Grund: Für
 *  „Rückruf fällig" und „Zusage gebrochen" nimmt die Pipeline Stufe A; der
 *  Leitfaden „Rückruf" ist aber genau für „vereinbarter Rückruf oder
 *  Zahlungszusage" geschrieben und passt besser. */
export function leitfadenFuerLage(lage: string | null | undefined, terminHeuteQuelle?: string | null): Art {
  if (terminHeuteQuelle === "onboarding_call") return "startgespraech";
  if (terminHeuteQuelle === "inkasso_call") return "reaktivierung";
  switch (lage) {
    case "rate_ueberfaellig": return "reaktivierung";
    case "zusage_gebrochen":
    case "rueckruf_faellig": return "rueckruf";
    case "rechnung_offen": return "stufe_b";
    case "lead_ohne_antrag": return "stufe_c";
    case "termin_heute":
    case "alles_gut": return "startgespraech";
    default: return "stufe_a"; // bezahlt_ohne_termin, zahlung_gemeldet
  }
}

export function leitfadenVonKey(key: Art) {
  return ARTEN.find((a) => a.key === key) ?? ARTEN[0];
}
