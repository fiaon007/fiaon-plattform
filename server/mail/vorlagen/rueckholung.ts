// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DIE RÜCKHOLUNG (5) — offene Anträge, ein letztes Mal richtig
//
// Schreibregeln: siehe konto.ts. Diese Datei folgt ihnen unverändert.
//
// ── WARUM ES DIESE FÜNF GIBT UND NICHT EINE MAHNKETTE ─────────────────────
// Auszählung vom 01./02.09.2026 über den gesamten offenen Bestand
// (2.001 Anträge, 96.840 € Auftragswert). Nichts hier ist geschätzt:
//
// · MAHNEN WIRKT NICHT MEHR. Aus 188 frühen Erinnerungen (Stufe 1–3) kamen
//   75 Zahler; aus 12.260 Mails ab Stufe 16 kamen 5. Ab der sechsten
//   Erinnerung ist die Ausbeute null — die Kette kostet nur noch Zustellung.
// · TELEFONIEREN AUF DEN ALTBESTAND WIRKT NICHT. 1.387 offene Fälle
//   angerufen, danach 15 Zahlungen (1,1 %); erreicht 1,43 %, gar nicht
//   angerufen 0,90 %. Der Unterschied trägt keine Woche Arbeitszeit.
// · DER TERMIN IST DAS EINZIGE, WAS WIRKT: 9,88 % gegen 1,66 % ohne Termin,
//   Faktor 6,0, p = 0,0002. Und es wirkt die BUCHUNG, nicht das Gespräch —
//   ein verpasster Termin bringt fast so viel wie ein wahrgenommener.
//   DESHALB: Der Handlungsaufruf jeder dieser fünf Mails ist ein Termin.
//   Keine dieser Vorlagen sagt „jetzt bezahlen“, keine nennt Bankdaten.
//   Wer Bankdaten druckt, bietet die Handlung an, die gemessen nichts
//   bringt, und verdrängt damit die, die um den Faktor 6 wirkt.
// · ALTER SORTIERT NICHT. 70 % aller Zahlungen fallen in die ersten drei
//   Tage nach Antragstellung (Median 3,1 Tage); ab Tag 7 ist ein Antrag
//   konstant rund 0,2 % je vier Tage wert. Ein 14 Tage alter Fall ist genau
//   so viel wert wie ein 90 Tage alter — die Segmente unten sortieren nach
//   LAGE, nicht nach Datum.
//
// ── DIE ZUSTELLUNG IST DIE KNAPPE RESSOURCE ───────────────────────────────
// Der Blockquote steigt wöchentlich: 9,5 → 11,9 → 15,7 %. Gmail blockt
// 16,9 % und bewertet domainweit — jede überflüssige Mail verteuert alle
// folgenden. Deshalb ist jedes Segment auf EINEN Versand ausgelegt.
// Die Frequenzbremse (server/lib/fiaon-mail-frequenz.ts, darfAnEmpfaenger)
// hängt bereits an sendMakeWebhookMitGrund und greift automatisch;
// diese Datei baut KEINE zweite Bremse und KEINEN zweiten Versandweg.
//
// ── ZWEI BEDINGUNGEN, DIE VOR DEM ERSTEN VERSAND ERFÜLLT SEIN MÜSSEN ──────
// 1. BUCHUNGSLAUF ZUERST. 61 Zahlungseingänge über 7.302 € liegen unverbucht
//    (applied = false), acht davon mit Namenstreffer bei den Behauptern aus
//    S2. Ohne vorherigen Buchungslauf schreibt rueckhol_s1/s2 an Menschen,
//    deren Geld längst da ist — der teuerste denkbare Fehler.
// 2. MAHNUNG AUS. 296 der 305 Behaupter wurden NACH ihrer Zahlungsmeldung
//    weitergemahnt, im Schnitt 29,4-mal, 295 davon in den letzten drei Tagen.
//    rueckhol_s2 sagt wörtlich, dass diese Erinnerungen gestoppt sind. Der
//    Satz muss beim Versand wahr sein, sonst ist er die nächste Lüge.
//
// ── PLATZHALTER ───────────────────────────────────────────────────────────
// Nur diese sechs, mehr liefert der Lauf nicht: vorname, paket, betrag,
// payment_reference, termin_link, antrag_id. Ein leerer Platzhalter wird
// weggelassen — ein erfundener bleibt für immer leer.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const RUECKHOLUNG_VORLAGEN: Record<string, MailBaustein> = {

  // ── S1 · FRISCHE ZAHLUNGSMELDUNG (jünger als 3 Tage) ─────────────────────
  // Der stärkste Einzelhebel im ganzen Bestand: 9,52 % gegen 0,49 % Grund-
  // quote, Faktor 19,3. Nach 4–10 Tagen sind es 0,93 %, danach 0,33 % —
  // eine Zahlungsbehauptung ist 72 Stunden lang bares Geld.
  // DESHALB kein Misstrauen im Ton: Dieser Mensch hat mit hoher
  // Wahrscheinlichkeit wirklich überwiesen, und das Geld ist unterwegs oder
  // liegt ohne Verwendungszweck bei uns. Wer ihn hier wie einen Schuldner
  // anspricht, verbrennt den wertvollsten Fall, den das Haus hat.
  // Kein karteZiel-Block: Das ist eine Klärung, keine Werbebotschaft —
  // wie bei claim_received in zahlung.ts.
  rueckhol_s1: {
    betreff: "Kurzer Zwischenstand zu Ihrer Zahlung, {{params.vorname}}",
    preheader: "Auf unserem Konto noch nicht sichtbar — meist hat das einen harmlosen Grund.",
    titel: "Wir haben Ihre Zahlung noch nicht gefunden",
    marke: "Zwischenstand",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben uns mitgeteilt, dass Sie für <b>{{params.paket}}</b> überwiesen haben — danke dafür. Auf unserem Konto ist der Betrag bisher nicht aufgetaucht, deshalb dieser kurze Zwischenstand.",
      "Das ist zunächst nichts Ungewöhnliches. Eine Überweisung braucht ein bis drei Bankarbeitstage, aus Österreich und der Schweiz gelegentlich länger. Und wenn der Verwendungszweck fehlt oder abgewandelt wurde, liegt Ihr Geld zwar bei uns — aber ohne Ihren Namen daran.",
      "Am schnellsten lösen wir das gemeinsam auf: Wählen Sie unten einen Termin, dann rufen wir Sie an und gehen Ihre Überweisung Punkt für Punkt durch — Datum, Betrag, Verwendungszweck. In den meisten Fällen ist die Sache in fünf Minuten geklärt und Ihr Bereich geht auf.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Betrag laut Bestellung", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    knopf: { text: "Termin zur Klärung wählen", url: "{{params.termin_link}}" },
    fussnote: "Sie haben den Überweisungsbeleg zur Hand? Hängen Sie ihn gern an eine Antwort auf diese E-Mail — dann prüfen wir ihn sofort, auch ohne Gespräch.",
  },

  // ── S2 · BEHAUPTET BEZAHLT, ABER LÄNGER HER ──────────────────────────────
  // 305 offene Anträge, 22.765 €, 299 Personen. Historisch haben 317 von 672
  // Behauptern am Ende doch bezahlt — 47,2 %. Diese Gruppe ist die wertvollste
  // Warteschlange des Hauses und wurde bisher wie die lästigste behandelt:
  // 296 von 305 bekamen nach ihrer Zahlungsmeldung weitere Mahnungen,
  // im Schnitt 29,4, im Extremfall 50.
  // DESHALB steht die Entschuldigung im ERSTEN Absatz, vor der Sachfrage.
  // Wer erst nach dem Geld fragt und danach um Verzeihung bittet, hat schon
  // verloren. Der Satz „Wir haben diese Erinnerungen gestoppt“ ist eine
  // Tatsachenbehauptung — sie muss beim Versand stimmen (siehe Kopf).
  rueckhol_s2: {
    betreff: "Zu Ihrer Zahlung — und zu unseren Erinnerungen",
    preheader: "Ihre Zahlung ist bei uns nie angekommen. Die Mahnungen danach waren unser Fehler.",
    titel: "Zwei Dinge, die wir klären möchten",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie hatten uns mitgeteilt, dass Sie für <b>{{params.paket}}</b> bezahlt haben. Diese Zahlung konnten wir bis heute keinem Eingang auf unserem Konto zuordnen — und trotzdem sind bei Ihnen weiter Zahlungserinnerungen eingegangen. Das hätte nicht passieren dürfen. Wir haben diese Erinnerungen gestoppt und bitten um Entschuldigung.",
      "Bleibt die eigentliche Frage: Wo ist die Zahlung? Erfahrungsgemäß gibt es dafür drei Erklärungen. Sie wurde ohne Verwendungszweck überwiesen und liegt bei uns ohne Namen. Sie ist von der Bank zurückgelaufen. Oder sie ist im Alltag doch untergegangen. Keine davon ist ein Vorwurf, und alle drei lassen sich in einem Gespräch auflösen.",
      "Deshalb unsere Bitte: Wählen Sie unten einen Termin. Wir gehen Ihren Fall in Ruhe durch — liegt Ihr Geld bei uns, finden wir es; ist es nie angekommen, sagen wir Ihnen offen, wie es weitergeht. Ihre Akte liegt unverändert bereit, verloren ist nichts.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Betrag laut Bestellung", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    knopf: { text: "Klärungstermin wählen", url: "{{params.termin_link}}" },
    fussnote: "Sie haben noch einen Beleg oder einen Kontoauszug von damals? Hängen Sie ihn an eine Antwort auf diese E-Mail — dann liegt er uns schon vor dem Gespräch vor.",
    karteZiel: true,
  },

  // ── S3 · PREIS FEHLT — UNSER TECHNISCHER BRUCH ───────────────────────────
  // 1.211 Anträge haben eine payment_reference, aber kein amount_due; 728
  // davon sind offen. Von allen 1.211 hat NIE einer bezahlt oder auch nur
  // eine Zahlung gemeldet — 0 von 1.211. Das ist keine kalte Zielgruppe,
  // das ist eine Bestellung, die nie eine wurde: Ohne Betrag hat das System
  // nie eine Rechnung erzeugt, also hat der Mensch nie erfahren, was er
  // zahlen soll. Über pack_key wären es 303 High End, 212 Pro, 111 Ultra,
  // 73 Starter — 52.577 € Listenwert, die nie jemand angefragt hat.
  // DESHALB steht hier KEIN Betrag in der Mail: Wir kennen ihn im Vorgang
  // nicht, und einen nachträglich hineingerechneten Preis per E-Mail zu
  // behaupten wäre genau der zweite Fehler nach dem ersten. Der Preis
  // gehört ins Gespräch — was den Termin hier zum ehrlichen nächsten
  // Schritt macht statt zu einem Umweg.
  rueckhol_s3: {
    betreff: "Ein Fehler auf unserer Seite — Ihr Antrag blieb liegen",
    preheader: "Sie haben nie eine Zahlungsaufforderung von uns bekommen. Das lag an uns.",
    titel: "Das haben wir versäumt",
    marke: "In eigener Sache",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben bei uns einen Antrag für <b>{{params.paket}}</b> gestellt — und danach nie erfahren, was er kostet und wohin Sie überweisen sollen. Der Grund liegt bei uns: In Ihrem Vorgang fehlt der hinterlegte Preis, und ohne ihn hat unser System nie eine Rechnung erzeugt.",
      "Das ist unser Fehler, nicht Ihrer. Sie haben nichts versäumt und schulden uns nichts — es ist schlicht nie eine Zahlungsaufforderung bei Ihnen angekommen.",
      "Wenn Sie möchten, holen wir das jetzt nach. Wählen Sie unten einen Termin: Im Gespräch sehen wir, ob Ihr Anliegen von damals noch aktuell ist, was in Ihrem Fall sinnvoll wäre und was es genau kostet. Erst danach entscheiden Sie — vorher passiert nichts.",
      "Und wenn sich die Sache für Sie erledigt hat, ist das ebenso in Ordnung: Antworten Sie kurz auf diese E-Mail, dann schließen wir den Vorgang.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    knopf: { text: "Beratungstermin wählen", url: "{{params.termin_link}}" },
    fussnote: "Der Termin ist unverbindlich und kostet nichts. Fünfzehn Minuten, in denen Sie fragen können, was offen ist.",
    karteZiel: true,
  },

  // ── S4 · ANTRAG UND BETRAG DA, ABER NIE GEMAHNT ──────────────────────────
  // 104 Anträge, 8.205 €. Der einzige Teil des Bestands, in dem die Botschaft
  // wirklich neu ist — hier sind die 70 % aus den ersten drei Tagen noch
  // nicht verbrannt. DESHALB darf diese Mail unter keinen Umständen wie eine
  // Erinnerung klingen: Es gibt nichts zu erinnern, wir haben uns nie
  // gemeldet. Der Preis steht offen im Datenkasten, aber ohne Bankdaten —
  // dies ist ein Erstkontakt, keine Rechnung.
  rueckhol_s4: {
    betreff: "Ihr Antrag liegt bei uns — so geht es weiter",
    preheader: "Was wir für Sie tun, was es kostet und wie Sie in Ruhe anfangen.",
    titel: "Ihr Antrag liegt bei uns",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben bei uns einen Antrag für <b>{{params.paket}}</b> gestellt. Er ist vollständig bei uns eingegangen — und wir haben uns dazu bisher nicht bei Ihnen gemeldet. Das holen wir hiermit nach.",
      "Was passiert, sobald es losgeht: Wir holen Ihre Auskunft ein, prüfen jeden einzelnen Eintrag und schreiben die an, die angreifbar sind. Jeden Schritt sehen Sie in Ihrem persönlichen Bereich, und ein fester Ansprechpartner begleitet Sie dabei.",
      "Bevor etwas Verbindliches geschieht, sollten wir aber miteinander gesprochen haben. Wählen Sie unten einen Termin — fünfzehn Minuten, in denen wir Ihre Lage ansehen und Sie uns alles fragen, was offen ist. Was danach kommt, entscheiden Sie.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Preis laut Antrag", wert: "{{params.betrag}} €" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    knopf: { text: "Gesprächstermin wählen", url: "{{params.termin_link}}" },
    fussnote: "Das Gespräch ist unverbindlich. Passt es gerade nicht? Antworten Sie kurz mit „später“ — dann melden wir uns in einigen Wochen noch einmal, sonst nicht.",
    karteZiel: true,
  },

  // ── S5 · ALTBESTAND — DIE LETZTE MAIL ────────────────────────────────────
  // Diese Menschen haben die volle Kette bekommen: Ab der sechsten Erinnerung
  // ist die Ausbeute null, bei 16 und mehr Mails standen 5 Zahler gegen
  // 12.260 Versände. Weiterschreiben verdient hier kein Geld mehr, es
  // verbrennt nur die Domain-Reputation für alle anderen Mails des Hauses
  // (Blockquote 9,5 → 11,9 → 15,7 % in drei Wochen).
  // DESHALB genau ein Versand, und dann Ruhe. Eine Mail, die das offen sagt
  // und einen echten Ausstieg anbietet, wird überdurchschnittlich beantwortet
  // — weil sie den Menschen ernst nimmt statt ihn zu bedrängen.
  // ACHTUNG BETRIEB: Das Wort „Stopp“ ist ein Versprechen. Es braucht einen
  // Menschen oder eine Regel, die eingehende Stopp-Antworten auch wirklich
  // austrägt; sonst ist dieser Absatz die nächste gebrochene Zusage.
  // Kein Betrag im Datenkasten: Eine Abschiedsmail mit Preisschild ist eine
  // Mahnung im Trauerflor.
  rueckhol_s5: {
    betreff: "Unsere letzte Nachricht an Sie, {{params.vorname}}",
    preheader: "Wir hören auf zu schreiben. Eine Frage stellen wir noch, dann ist Ruhe.",
    titel: "Wir hören auf zu schreiben",
    marke: "Letzte Nachricht",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben vor einiger Zeit einen Antrag für <b>{{params.paket}}</b> begonnen und seitdem eine ganze Reihe E-Mails von uns bekommen. Wenn Sie darauf nicht geantwortet haben, hatten Sie vermutlich gute Gründe — und die respektieren wir.",
      "Deshalb ist dies die letzte Nachricht zu diesem Vorgang. Danach schreiben wir Ihnen nicht mehr, es sei denn, Sie melden sich von sich aus.",
      "Eines möchten wir vorher noch sagen: Ihre Akte liegt weiterhin bereit. Wenn sich Ihre Lage seit damals verändert hat, ist der Weg für Sie kurz — fünfzehn Minuten genügen, um zu sehen, ob sich das für Sie überhaupt lohnt. Den Termin wählen Sie selbst, unten, ohne Verpflichtung.",
      "Und wenn nicht: Antworten Sie einfach mit dem Wort <b>Stopp</b>. Dann nehmen wir Sie aus allen Verteilern zu diesem Vorgang, und die Sache ist für Sie erledigt. Sie können auch gar nichts tun — dann hören Sie ebenfalls nichts mehr von uns.",
    ],
    daten: [
      { label: "Ihr Antrag von damals", wert: "{{params.paket}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    knopf: { text: "Ich möchte ein Gespräch", url: "{{params.termin_link}}" },
    fussnote: "Kein Haken, keine Frist, kein Nachfassen. Diese Mail ist das Ende der Kette — die Entscheidung liegt jetzt ganz bei Ihnen.",
    karteZiel: true,
  },
};
