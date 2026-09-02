// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DIE RÜCKHOLUNG (4 + 4) — offene Anträge, bis Kunde oder Stopp
//
// Schreibregeln: siehe konto.ts. Diese Datei folgt ihnen unverändert.
//
// ── WARUM ES DIESE VORLAGEN GIBT UND NICHT EINE MAHNKETTE ─────────────────
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
//   DESHALB: Der Handlungsaufruf JEDER Mail hier ist und bleibt der Termin.
//   Keine Vorlage sagt „jetzt bezahlen“, und in keiner steht die IBAN im
//   Datenkasten. Wer Bankdaten in den Kasten druckt, stellt die Handlung
//   groß, die gemessen nichts bringt, und verdrängt damit die, die um den
//   Faktor 6 wirkt.
// · ALTER SORTIERT NICHT. 70 % aller Zahlungen fallen in die ersten drei
//   Tage nach Antragstellung (Median 3,1 Tage); ab Tag 7 ist ein Antrag
//   konstant rund 0,2 % je vier Tage wert. Ein 14 Tage alter Fall ist genau
//   so viel wert wie ein 90 Tage alter — die Segmente unten sortieren nach
//   LAGE, nicht nach Datum.
//
// ── DER ZWEITE WEG: ZAHLEN, WENN DER MENSCH ES WILL (02.09.2026) ──────────
// Justins Auftrag: „so einfach wie möglich für den Kunden … überall wo es um
// die Zahlung geht.“ Das trifft S1, S2 und S4 — dort ist Geld das Thema, und
// wer beim Lesen beschließt zu zahlen, stand bisher vor gar nichts: kein
// Betrag zum Scannen, kein Link, nur die Bitte um einen Anruf.
// DIE AUFLÖSUNG, OHNE DEN BELEG ZU VERLETZEN: Der Termin bleibt `knopf` —
// der blaue Knopf, den man sieht. Der Zahlweg kommt als GiroCode-Bild und
// als leiser `knopf2` auf die Zahlungsseite dazu, nie an seiner Stelle, und
// nie als Aufforderung: In S1 und S2 hängt der Satz ausdrücklich an der
// Bedingung, dass der Mensch beim Nachsehen feststellt, dass NICHT gezahlt
// wurde. Diese Menschen sagen, sie hätten bezahlt — eine zweite Überweisung
// wäre der teuerste Ausgang dieser Mail, teurer als gar keine Zahlung.
// Die IBAN steht deshalb weiter in KEINEM Datenkasten dieser Datei: Sie
// steckt im QR-Code und auf der Zahlungsseite, wo sie niemand abtippen muss.
// S3 UND DIE DAUERPFLEGE bleiben außen vor: Dort fehlt der Preis (738 offene
// Anträge mit amount_due = 0), und ein GiroCode über 0,00 € wäre der zweite
// Fehler nach dem ersten.
//
// ── WARUM DAUERPFLEGE STATT „LETZTER MAIL“ (Justin, 02.09.2026, wörtlich) ─
// „Es soll NIEMALS ein Kunde deaktiviert, ausgeschlossen werden — er
// bekommt so lange Marketing bis er Kunde wird! AGRESSIV.“
// Die Messung trägt das: Ein offener Antrag ist ab Tag 7 KONSTANT ~0,2 % je
// vier Tage wert — er verfällt nicht, er wird nur nicht schlechter. Wer den
// Kontakt einstellt, verschenkt diese 0,2 % jede Woche neu; wer den Termin
// anbietet, hat den einzigen belegten Hebel in der Hand. Deshalb gibt es
// keine Abschiedsmail mehr, sondern vier ROTIERENDE Wiedereinstiegs-Mails
// (rueckhol_s5, s5b, s5c, s5d), jede aus einem anderen Blickwinkel, jede mit
// Termin-Aufruf — bis der Mensch Kunde ist oder Stopp sagt.
//
// WARUM 28 TAGE ABSTAND: Ab Stufe 6 bringt Mahnen null, und der Blockquote
// steigt mit jeder überflüssigen Mail (9,5 → 11,9 → 15,7 % in drei Wochen;
// Gmail bewertet DOMAINWEIT). Eine Mail im Monat je Empfänger bleibt unter
// jeder Spam-Schwelle, bleibt in Erinnerung — und verdient über ein Jahr
// dieselben 0,2 % je Kontakt, die eine Mahnwelle in drei Tagen verbrennt.
// Der Abstand ist einstellbar (rueckhol_dauerpflege_abstand_tage), aber nie
// unter 14 Tagen — darunter beginnt die Kette, die gemessen nichts bringt.
//
// WARUM STOPP ABSOLUT IST: „Aggressiv“ endet am Gesetz. Wer Stopp sagt,
// widerspricht (UWG § 7, DSGVO Art. 21) — die Werbesperre an
// fiaon_persons.werbung_gesperrt_am nimmt ihn aus der Grundmenge UND die
// Frequenzbremse blockt ihn an der einen Tür. Deshalb steht der Stopp-Satz
// in JEDER der vier Varianten, wörtlich und ohne Ausnahme. Gebouncte
// Adressen bekommen ebenfalls nie wieder Post — dort kommt nichts an, und
// jeder Versuch beschädigt die Zustellbarkeit aller anderen Mails.
//
// ── DIE ZUSTELLUNG IST DIE KNAPPE RESSOURCE ───────────────────────────────
// S1–S4 sind auf höchstens ZWEI Versände je Person ausgelegt, die Dauer-
// pflege auf EINEN je Abstand. Die Frequenzbremse (server/lib/
// fiaon-mail-frequenz.ts, darfAnEmpfaenger) hängt bereits an
// sendMakeWebhookMitGrund und greift automatisch (2/Tag, 4/Woche, 8/Monat
// je Empfänger); diese Datei baut KEINE zweite Bremse und KEINEN zweiten
// Versandweg.
//
// ── ZWEI BEDINGUNGEN, DIE VOR JEDEM VERSAND ERFÜLLT SEIN MÜSSEN ───────────
// 1. BUCHUNGSLAUF ZUERST. 61 Zahlungseingänge über 7.302 € lagen am 02.09.
//    unverbucht (applied = false), acht davon mit Namenstreffer bei den
//    Behauptern aus S2. Ohne vorherigen Buchungslauf schreibt rueckhol_s1/s2
//    an Menschen, deren Geld längst da ist — der teuerste denkbare Fehler.
// 2. MAHNUNG AUS. 296 der 305 Behaupter wurden NACH ihrer Zahlungsmeldung
//    weitergemahnt, im Schnitt 29,4-mal. rueckhol_s2 sagt wörtlich, dass
//    diese Erinnerungen gestoppt sind. Der Satz muss beim Versand wahr sein,
//    sonst ist er die nächste Lüge.
//
// ── PLATZHALTER ───────────────────────────────────────────────────────────
// Nur diese sechs, mehr liefert der Lauf nicht: vorname, paket, betrag,
// payment_reference, termin_link, antrag_id. Ein leerer Platzhalter wird
// weggelassen — ein erfundener bleibt für immer leer.
// Die Dauerpflege-Varianten nutzen NUR vorname, paket, antrag_id und
// termin_link: Sie schreiben an Menschen aus ALLEN Lagen, und die Lage
// „Preis fehlt“ (S3, 736 Anträge) hat weder Betrag noch verlässliche
// Referenz — ein „ €“ ohne Zahl wäre die nächste Peinlichkeit.
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
  // Der Zahlweg steht bewusst UNTER der Bedingung „falls doch nicht heraus“:
  // Wer hier zum zweiten Mal überweist, hat am Ende zweimal gezahlt, und
  // zurückholen müssten wir es dann auch noch. Kein `sofort_url` — der Lauf
  // liefert es nicht; der QR-Code und die Zahlungsseite tun dasselbe leiser.
  rueckhol_s1: {
    betreff: "Kurzer Zwischenstand zu Ihrer Zahlung, {{params.vorname}}",
    preheader: "Auf unserem Konto noch nicht sichtbar — meist hat das einen harmlosen Grund.",
    titel: "Wir haben Ihre Zahlung noch nicht gefunden",
    marke: "Zwischenstand",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben uns mitgeteilt, dass Sie für <b>{{params.paket}}</b> überwiesen haben — danke dafür. Auf unserem Konto ist der Betrag bisher nicht aufgetaucht, deshalb dieser kurze Zwischenstand.",
      "Das ist zunächst nichts Ungewöhnliches. Eine Überweisung braucht ein bis drei Bankarbeitstage, aus Österreich und der Schweiz gelegentlich länger. Und wenn der Verwendungszweck fehlt oder abgewandelt wurde, liegt Ihr Geld zwar bei uns — aber ohne Ihren Namen daran.",
      "Am schnellsten lösen wir das gemeinsam auf: Wählen Sie unten einen Termin, dann rufen wir Sie an und gehen Ihre Überweisung Punkt für Punkt durch — Datum, Betrag, Verwendungszweck. In den meisten Fällen ist die Sache in fünf Minuten geklärt und Ihr Bereich geht auf.",
      "Und falls sich beim Nachsehen zeigt, dass die Überweisung doch nicht herausgegangen ist: Der QR-Code unten füllt sie in Ihrer Banking-App fertig aus, ganz unten finden Sie den Link „Zahlungsseite ansehen“. Das ist ein Angebot, keine Aufforderung — schauen Sie bitte zuerst auf Ihren Kontoauszug, denn zweimal zahlen soll niemand.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Betrag laut Bestellung", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    knopf: { text: "Termin zur Klärung wählen", url: "{{params.termin_link}}" },
    knopf2: { text: "Zahlungsseite ansehen: Betrag, Bankdaten, Verwendungszweck", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
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
  // Der Zahlweg im vierten Absatz ist bei dieser Gruppe die heikelste Zeile
  // der ganzen Datei: 47,2 % dieser Menschen haben historisch am Ende doch
  // bezahlt, ein Teil davon hat es längst getan. Deshalb steht die Bitte
  // „zuerst nachsehen“ VOR dem Angebot und nicht als Fußnote dahinter — und
  // deshalb ist der Zahlweg ein Bild plus ein Textlink, kein zweiter Knopf.
  rueckhol_s2: {
    betreff: "Zu Ihrer Zahlung — und zu unseren Erinnerungen",
    preheader: "Ihre Zahlung ist bei uns nie angekommen. Die Mahnungen danach waren unser Fehler.",
    titel: "Zwei Dinge, die wir klären möchten",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie hatten uns mitgeteilt, dass Sie für <b>{{params.paket}}</b> bezahlt haben. Diese Zahlung konnten wir bis heute keinem Eingang auf unserem Konto zuordnen — und trotzdem sind bei Ihnen weiter Zahlungserinnerungen eingegangen. Das hätte nicht passieren dürfen. Wir haben diese Erinnerungen gestoppt und bitten um Entschuldigung.",
      "Bleibt die eigentliche Frage: Wo ist die Zahlung? Erfahrungsgemäß gibt es dafür drei Erklärungen. Sie wurde ohne Verwendungszweck überwiesen und liegt bei uns ohne Namen. Sie ist von der Bank zurückgelaufen. Oder sie ist im Alltag doch untergegangen. Keine davon ist ein Vorwurf, und alle drei lassen sich in einem Gespräch auflösen.",
      "Deshalb unsere Bitte: Wählen Sie unten einen Termin. Wir gehen Ihren Fall in Ruhe durch — liegt Ihr Geld bei uns, finden wir es; ist es nie angekommen, sagen wir Ihnen offen, wie es weitergeht. Ihre Akte liegt unverändert bereit, verloren ist nichts.",
      "Sollte sich dabei herausstellen, dass die Zahlung damals nie ausgeführt oder von der Bank zurückgebucht wurde, finden Sie den Weg dorthin schon hier: Der QR-Code unten füllt die Überweisung in Ihrer Banking-App fertig aus, ganz unten steht der Link „Zahlungsseite ansehen“. Bitte sehen Sie aber zuerst nach — liegt Ihr Geld doch bei uns, wäre eine zweite Überweisung genau das Falsche.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Betrag laut Bestellung", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — nur für den Fall, dass die Zahlung damals nie ausgeführt wurde", unterschrift: "Nur für den Fall, dass die Zahlung damals nie ausgeführt wurde: scannen — Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Klärungstermin wählen", url: "{{params.termin_link}}" },
    knopf2: { text: "Zahlungsseite ansehen: Betrag, Bankdaten, Verwendungszweck", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
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
  // gemeldet. Der Preis steht offen im Datenkasten, die IBAN bewusst nicht —
  // dies ist ein Erstkontakt, keine Rechnung.
  // NEU 02.09.2026: Der Verwendungszweck steht jetzt dabei, und wer sofort
  // anfangen will, kann es. Bisher endete diese Mail für den entschlossenen
  // Leser im Nichts: Er kannte den Preis, aber keinen einzigen Weg, ihn zu
  // bezahlen — der Termin war die einzige Tür, auch für den, der sie gar
  // nicht brauchte. QR-Code und Zahlungsseite sind der zweite Weg; der
  // Termin bleibt der Knopf, weil er der gemessen wirksame ist.
  rueckhol_s4: {
    betreff: "Ihr Antrag liegt bei uns — so geht es weiter",
    preheader: "Was wir für Sie tun, was es kostet und wie Sie in Ruhe anfangen.",
    titel: "Ihr Antrag liegt bei uns",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben bei uns einen Antrag für <b>{{params.paket}}</b> gestellt. Er ist vollständig bei uns eingegangen — und wir haben uns dazu bisher nicht bei Ihnen gemeldet. Das holen wir hiermit nach.",
      "Was passiert, sobald es losgeht: Wir holen Ihre Auskunft ein, prüfen jeden einzelnen Eintrag und schreiben die an, die angreifbar sind. Jeden Schritt sehen Sie in Ihrem persönlichen Bereich, und ein fester Ansprechpartner begleitet Sie dabei.",
      "Bevor etwas Verbindliches geschieht, sollten wir aber miteinander gesprochen haben. Wählen Sie unten einen Termin — fünfzehn Minuten, in denen wir Ihre Lage ansehen und Sie uns alles fragen, was offen ist. Was danach kommt, entscheiden Sie.",
      "Sie möchten lieber gleich beginnen, ohne auf ein Gespräch zu warten? Dann geht das auch: Der QR-Code unten enthält Ihre fertige Überweisung, ganz unten steht der Link „Zahlungsseite ansehen“. Ihr Ansprechpartner meldet sich danach genauso bei Ihnen.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Preis laut Antrag", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Falls Sie ohne Umweg anfangen möchten: Mit der Banking-App scannen — Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Gesprächstermin wählen", url: "{{params.termin_link}}" },
    knopf2: { text: "Zahlungsseite ansehen: Betrag, Bankdaten, Verwendungszweck", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Das Gespräch ist unverbindlich. Passt es gerade nicht? Antworten Sie kurz mit „später“ — dann melden wir uns in einigen Wochen noch einmal, sonst nicht.",
    karteZiel: true,
  },

  // ═════════════════════════════════════════════════════════════════════════
  // S5 · DIE DAUERPFLEGE — vier Blickwinkel, die sich alle 28 Tage abwechseln
  //
  // Wer hier landet, ist in keinem anderen Segment mehr versandfertig:
  // Altbestand nach der vollen Mahnkette, oder S1–S4 ausgeschöpft. Die alte
  // „letzte Mail“ hätte ihn abgeschrieben — gegen Justins Grundsatz und
  // gegen die Messung (ab Tag 7 konstant ~0,2 % je vier Tage, egal wie alt).
  // Die Rotation (Anzahl bisheriger Dauerpflege-Mails modulo 4, siehe
  // fiaon-rueckholung.ts) sorgt dafür, dass niemand zweimal hintereinander
  // dieselbe Mail liest — vier Blickwinkel, ein Aufruf: der Termin.
  //
  // Was ALLE vier gemeinsam haben, ohne Ausnahme:
  // · gesiezt, ein Gedanke, ein Knopf auf den Termin-Link
  // · kein Rabatt, keine erfundene Frist, kein „letzte Nachricht“ mehr
  // · kein Erfolgsversprechen zur Karte (nur der karteZiel-Block des Gerüsts)
  // · kein Betrag, keine Referenz (Lage S3 hat beides nicht)
  // · der Stopp-Satz, wörtlich: „Antworten Sie mit Stopp, dann schreiben wir
  //   Ihnen nicht mehr.“ Das ist das Versprechen, das die Werbesperre einlöst.
  // ═════════════════════════════════════════════════════════════════════════

  // ── S5 (a) · „IHRE AKTE LIEGT WEITER BEREIT“ ─────────────────────────────
  // Der ruhige Einstieg: keine Neuigkeit, kein Anlass — nur die Zusicherung,
  // dass nichts verloren ist, und die Erinnerung, was wir für ihn täten.
  // Gemessen wirkt die Buchung, nicht das Argument; die Mail braucht also
  // keinen Grund, nur den Weg.
  rueckhol_s5: {
    betreff: "Ihre Akte liegt weiter bereit, {{params.vorname}}",
    preheader: "Kein Druck, keine Frist — nur der Hinweis, dass wir für Sie anfangen könnten, sobald Sie möchten.",
    titel: "Ihre Akte liegt weiter bereit",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihr Antrag für <b>{{params.paket}}</b> ist bei uns offen geblieben. Wir haben ihn nicht geschlossen — Ihre Akte liegt unverändert bereit, und das bleibt so, bis Sie sich entscheiden.",
      "Was wir täten, sobald Sie möchten: Ihre Auskunft einholen, jeden Eintrag einzeln prüfen und die anschreiben, die angreifbar sind. Ein fester Ansprechpartner begleitet Sie dabei, und jeden Schritt sehen Sie in Ihrem persönlichen Bereich.",
      "Nach fünfzehn Minuten wissen Sie drei Dinge: was in Ihrem Fall der nächste Schritt wäre, was er kostet und ob er sich für Sie lohnt — und wenn nicht, sagen wir Ihnen das genauso offen. Den Termin wählen Sie unten selbst; wir rufen Sie dann an.",
      "Möchten Sie keine Nachrichten mehr von uns: Antworten Sie mit <b>Stopp</b> oder nutzen Sie den Abmeldelink am Ende — dann schreiben wir Ihnen nicht mehr.",
    ],
    knopf: { text: "Termin wählen — 15 Minuten, kostenlos", url: "{{params.termin_link}}" },
    fussnote: "Es gibt keine Frist und nichts, was Sie versäumen könnten. Wir melden uns nur gelegentlich, damit Sie wissen, dass der Weg offen ist.",
    abmeldeUrl: "{{params.abmelde_url}}",
    karteZiel: true,
  },

  // ── S5 (b) · „WAS SICH SEIT IHREM ANTRAG GEÄNDERT HAT“ ───────────────────
  // Der Anlass-Einstieg: drei echte Neuerungen seit Sommer 2026 — Lastschrift
  // für die Raten (E-072), Sofortzahlung per GiroCode in der Banking-App
  // (02.09.), Online-Terminwahl mit Rückruf. Alle drei sitzen genau an den
  // Stellen, an denen der Antragsweg gemessen bricht (Ratentreue 12,8 %,
  // Überweisung ohne Verwendungszweck, Telefon-Warteschleife). Nichts davon
  // ist ein Versprechen, alles davon ist gebaut.
  rueckhol_s5b: {
    betreff: "Was sich seit Ihrem Antrag geändert hat",
    preheader: "Drei Dinge sind einfacher geworden: Bezahlen per Banking-App, Bankeinzug für die Raten, ein Gespräch von fünfzehn Minuten.",
    titel: "Drei Dinge sind einfacher geworden",
    absaetze: [
      "Guten Tag {{params.vorname}}, seit Ihrem Antrag für <b>{{params.paket}}</b> hat sich bei uns einiges getan. Drei Dinge davon betreffen genau die Stellen, an denen es damals vielleicht gehakt hat.",
      "<b>Bezahlen per Banking-App:</b> Ein Knopf in der Zahlungsmail, Sie wählen Ihre Bank, bestätigen in der App — Betrag und Verwendungszweck sind schon eingetragen, nichts abzutippen. <b>Bankeinzug für die Raten:</b> Nach der ersten Zahlung können Sie die Monatsraten einmal per Lastschrift einrichten; den Link dazu schicken wir Ihnen. <b>Ein Gespräch von fünfzehn Minuten:</b> Sie wählen online eine Zeit, wir rufen Sie dann an — ohne Warteschleife.",
      "Nach fünfzehn Minuten wissen Sie drei Dinge: was in Ihrem Fall der nächste Schritt wäre, was er kostet und ob er sich für Sie lohnt — und wenn nicht, sagen wir Ihnen das genauso offen. Den Termin wählen Sie unten selbst; wir rufen Sie dann an.",
      "Möchten Sie keine Nachrichten mehr von uns: Antworten Sie mit <b>Stopp</b> oder nutzen Sie den Abmeldelink am Ende — dann schreiben wir Ihnen nicht mehr.",
    ],
    knopf: { text: "Termin wählen — 15 Minuten, kostenlos", url: "{{params.termin_link}}" },
    fussnote: "Nichts davon setzt eine Zahlung voraus. Erst das Gespräch, dann Ihre Entscheidung.",
    abmeldeUrl: "{{params.abmelde_url}}",
    karteZiel: true,
  },

  // ── S5 (c) · „EINE FRAGE, KEIN VERKAUF“ ──────────────────────────────────
  // Der Frage-Einstieg: die kürzeste der vier. Sie bittet um eine Zeile
  // Antwort — was hat damals abgehalten? — und bietet den Termin nur als
  // Alternative an. Eine Mail, die den Menschen ernst nimmt statt zu
  // bedrängen, wird überdurchschnittlich beantwortet; und jede Antwort ist
  // ein Datum, das dem Haus fehlt (der Antragsweg bricht, aber niemand hat
  // die Abbrecher je gefragt, warum).
  // KEIN karteZiel-Block: Wer „kein Verkauf“ schreibt und darunter ein
  // Kartenbild setzt, hat gelogen.
  rueckhol_s5c: {
    betreff: "Eine kurze Frage, {{params.vorname}} — kein Verkauf",
    preheader: "Was hat damals gefehlt? Eine Zeile als Antwort genügt uns.",
    titel: "Eine Frage, kein Verkauf",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihr Antrag für <b>{{params.paket}}</b> ist bei uns offen geblieben — und wir möchten nur eines verstehen: Was hat damals gefehlt, oder was ist dazwischengekommen?",
      "War es der Preis, der Zeitpunkt, eine offene Frage, ein Zweifel an uns — oder etwas, das bei uns hakte? Eine Zeile als Antwort auf diese E-Mail genügt. Sie hilft uns, besser zu werden — und wenn es etwas ist, das sich klären lässt, sagen wir Ihnen ehrlich, ob und wie.",
      "Lieber im Gespräch als schriftlich? Nach fünfzehn Minuten wissen Sie, was in Ihrem Fall der nächste Schritt wäre, was er kostet und ob er sich lohnt — den Termin wählen Sie unten, wir rufen Sie an.",
      "Möchten Sie keine Nachrichten mehr von uns: Antworten Sie mit <b>Stopp</b> oder nutzen Sie den Abmeldelink am Ende — dann schreiben wir Ihnen nicht mehr.",
    ],
    knopf: { text: "Lieber kurz sprechen — 15 Minuten, kostenlos", url: "{{params.termin_link}}" },
    fussnote: "Es gibt keine falsche Antwort. Auch „kein Interesse mehr“ ist eine, die uns weiterhilft.",
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  // ── S5 (d) · „EIN EINTRAG WENIGER“ ───────────────────────────────────────
  // Der Nutzen-Einstieg: was ein einziger gelöschter Eintrag konkret bewirkt
  // — ohne Zusage. Die Fußzeile des Gerüsts sagt es ohnehin („verspricht
  // keine Löschung berechtigter Einträge“); der Text wiederholt es aktiv,
  // damit kein Leser einen Erfolg herausliest, den niemand zugesagt hat.
  rueckhol_s5d: {
    betreff: "Zu Ihrem Antrag: Warum oft ein einziger Eintrag entscheidet",
    preheader: "Was ein gelöschter Eintrag für Ihren Antrag auf {{params.paket}} konkret bedeuten würde.",
    titel: "Ein Eintrag weniger",
    absaetze: [
      "Guten Tag {{params.vorname}}, zu Ihrem Antrag für <b>{{params.paket}}</b> ein Gedanke, der vielen Menschen fehlt: Bei der Bonität denken die meisten an eine lange Liste, die sich nie ganz aufräumen lässt. In der Praxis ist es oft anders — ein einziger Eintrag entscheidet, und fällt er weg, sieht die Lage anders aus.",
      "Ein Negativeintrag — etwa eine längst bezahlte Forderung, die trotzdem noch gemeldet wird — ist für die meisten Banken kein Detail, sondern in aller Regel ein Ausschlusskriterium. Fällt er weg, prüft die Bank Ihren Antrag wieder nach Ihren heutigen Verhältnissen. Versprechen können wir das vorher nicht; prüfen können wir es.",
      "Jeder Monat, den ein angreifbarer Eintrag stehen bleibt, ist ein Monat zu schlechteren Bedingungen. Genau diese Prüfung wäre der erste Schritt bei Ihrem Antrag. " + "Nach fünfzehn Minuten wissen Sie, ob Ihre Einträge dazugehören, was der nächste Schritt kostet und ob er sich lohnt — den Termin wählen Sie unten, wir rufen Sie an.",
      "Möchten Sie keine Nachrichten mehr von uns: Antworten Sie mit <b>Stopp</b> oder nutzen Sie den Abmeldelink am Ende — dann schreiben wir Ihnen nicht mehr.",
    ],
    knopf: { text: "Termin wählen — 15 Minuten, kostenlos", url: "{{params.termin_link}}" },
    fussnote: "Berechtigte Einträge löscht niemand — auch wir nicht. Angreifbar sind falsche, veraltete oder formal fehlerhafte Einträge; ob Ihre dazugehören, zeigt erst die Prüfung.",
    abmeldeUrl: "{{params.abmelde_url}}",
    karteZiel: true,
  },
};
