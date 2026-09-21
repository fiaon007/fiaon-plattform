// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DER KONTO-WEG (15) — vom Antrag bis zur Löschung
//
// ── DIE SCHREIBREGELN (gelten für ALLE Vorlagen-Dateien) ──────────────────
// · Gesiezt. Immer.
// · Kein Erfolgsversprechen. Zur Karte spricht NUR der karteZiel-Block des
//   Gerüsts (KARTE_SATZ) — keine Vorlage formuliert eigene Karten-Sätze.
// · Der Betreff sagt, was Sache ist; er lockt nicht. Wer eine Mahnung als
//   Überraschung tarnt, wird einmal geöffnet und danach weggefiltert.
// · Ein Gedanke je Absatz, höchstens vier Absätze. Ein Knopf.
// · Zahlen und Referenzen stehen im Datenkasten, nicht im Fließtext.
// · Nur Platzhalter verwenden, die das Ereignis WIRKLICH mitschickt —
//   die Wahrheit steht in server/make-events-registry.ts (example-Blöcke).
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const KONTO_VORLAGEN: Record<string, MailBaustein> = {

  // 838 Versände/Monat — der erste Eindruck des Hauses.
  //
  // ── WARUM HIER KEINE ZAHLUNGSDATEN STEHEN (geprüft 02.09.2026) ────────────
  // Naheliegend wäre, den Zahlweg gleich in die erste Mail zu legen — ein
  // Schritt statt zwei. Die Nutzlast trägt ihn aber nicht: Von 985
  // verschickten welcome-Mails hatten 823 (83,6 %) KEINEN Betrag, weil die
  // Bestellung im Moment des Antragseingangs noch keinen Preis hat. Ein
  // GiroCode zieht seinen Betrag aus genau diesem Feld — er stünde bei vier
  // von fünf Empfängern über 0,00 €, und eine Überweisung über null Euro
  // bekommt niemand mehr eingesammelt. Der Preis entsteht mit der
  // Bestellung, und mit ihr feuert payment_details: DORT gehören QR-Code
  // und Bankdaten hin, und dort stehen sie vollständig.
  //
  // ── KEINE ZUSAGE EINER MAIL, DIE NICHT KOMMT (18.09.2026) ─────────────────
  // `welcome` geht beim E-MAIL-SCHRITT des Antrags raus (fiaon-antrag.ts), also
  // meist lange vor der Bestellung. Der Text kündigte „gleich eine separate
  // E-Mail mit Ihren Zahlungsdaten" an — laut Prüfung vom 18.09. kam sie bei
  // 65 von 195 Empfängern nie: Sie hatten den Antrag nicht abgeschlossen, und
  // payment_details feuert erst mit der Bestellung. Jetzt steht da, was in
  // beiden Fällen stimmt — die Zahlungsdaten kommen mit dem Abschluss.
  // Und diese Mail ist KEINE Zugangsmail: Die heißt zugang_link.
  welcome: {
    betreff: "Willkommen bei FIAON, {{params.vorname}}",
    preheader: "Ihr Antrag ist angelegt — das sind die nächsten Schritte.",
    titel: "Ihr Antrag ist angelegt",
    heroKarte: true,
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, schön, dass Sie da sind. Ihr Antrag für <b>{{params.paket}}</b> ist bei uns angelegt — damit ist der erste Schritt getan.",
      "So geht es weiter: <b>1.</b> Sobald Sie den Antrag abschließen, erhalten Sie eine eigene E-Mail mit Ihren Zahlungsdaten. <b>2.</b> Sobald Ihre Zahlung da ist, öffnet sich Ihr persönlicher Bereich. <b>3.</b> Ihr Ansprechpartner meldet sich zum Startgespräch — fünfzehn Minuten, in denen wir Ihre Akte gemeinsam durchgehen.",
      "Ab dann arbeiten wir für Sie: Auskunft holen, jeden Eintrag prüfen, angreifbare Einträge anschreiben. Jeden Schritt sehen Sie live in Ihrem Bereich.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    fussnote: "Antrag schon abgeschlossen? Dann haben wir Ihnen die Zahlungsdaten in einer eigenen E-Mail geschickt. Nicht gefunden? Ein Blick in den Spam-Ordner hilft — oder antworten Sie einfach hier.",
    karteZiel: true,
  },

  // ── DER WEG IN DEN BEREICH (18.09.2026, Team-Feedback Priorität 3) ────────
  // „Bei ‚Willkommen und Zugang' erhalten Kunden stattdessen eine Nachricht mit
  // ‚Ihr Antrag ist genehmigt, bitte zahlen Sie'." Gemessen: Der Knopf schickte
  // `welcome` — die Antrag-eingegangen-Mail ohne Knopf — 211-mal an 166
  // Menschen, 207-mal an Kunden mit bezahlter Bestellung (Messung 18.09.2026,
  // ohne Prüfversände). Das hier ist die
  // Zugangsmail: ein Knopf in den Bereich, ein Link zum eigenen Passwort.
  // „Zugang retten" (Vertriebsleitung) schickt sie mit einem Setz-Link, der 60
  // Minuten gilt, in beiden Feldern — die Fußnote stimmt für beide Wege.
  zugang_link: {
    betreff: "Ihr Zugang zu Ihrem Bereich, {{params.vorname}}",
    preheader: "Ein Klick zur Anmeldung — und der Weg zu Ihrem eigenen Passwort.",
    titel: "So kommen Sie in Ihren Bereich",
    absaetze: [
      "Guten Tag {{params.vorname}}, hier ist Ihr direkter Weg in Ihren persönlichen Bereich — mit Ihrem Fahrplan, Ihren Unterlagen und dem Stand jedes Schrittes.",
      "Melden Sie sich mit der E-Mail-Adresse an, an die diese Nachricht ging. Noch kein Passwort, oder ist es Ihnen entfallen? Dann nehmen Sie den Link „Passwort festlegen“ unter dem Knopf — dort vergeben Sie es in einem Schritt selbst.",
    ],
    knopf: { text: "In meinen Bereich", url: "{{params.login_url}}" },
    knopf2: { text: "Passwort festlegen", url: "{{params.passwort_url}}" },
    fussnote: "Ein Link zum Festlegen des Passworts gilt aus Sicherheitsgründen 60 Minuten. Ist er abgelaufen, fordern Sie auf der Anmeldeseite unter „Passwort vergessen“ einfach einen neuen an — oder antworten Sie auf diese E-Mail.",
  },

  // ── NACH DEM STARTGESPRÄCH (18.09.2026) ────────────────────────────────────
  // Hier ging bis heute account_activated raus: „Ihr Zugang ist wieder frei"
  // — der Text für eine ENTSPERRUNG, an Menschen, die nie gesperrt waren. Und
  // weil der Aufrufer portal_url statt login_url schickte, ohne Knopf (100
  // Versände, Messung 18.09.2026). Die erste Freischaltung hat jetzt ihre eigene Mail;
  // „wieder frei" bleibt der Entsperrung (fiaon-agent-kunden.ts).
  bereich_freigeschaltet: {
    betreff: "Ihr Bereich ist jetzt vollständig freigeschaltet, {{params.vorname}}",
    preheader: "Nach Ihrem Startgespräch steht Ihnen alles offen — Fahrplan, Unterlagen, jeder Schritt.",
    titel: "Ihr Bereich ist vollständig freigeschaltet",
    absaetze: [
      "Guten Tag {{params.vorname}}, danke für das Startgespräch. Ihr persönlicher Bereich ist jetzt vollständig freigeschaltet: Ihr Fahrplan, Ihre Unterlagen und der Stand jedes Schrittes stehen Ihnen ab sofort offen.",
      "Dort sehen Sie auch, was als Nächstes ansteht und ob wir noch etwas von Ihnen brauchen. Melden Sie sich mit der E-Mail-Adresse an, an die diese Nachricht ging.",
    ],
    knopf: { text: "In meinen Bereich", url: "{{params.login_url}}" },
    fussnote: "Noch kein Passwort? Wählen Sie beim Anmelden „Passwort vergessen“ — Sie vergeben es in einem Schritt selbst.",
  },

  payment_details: {
    betreff: "Ihre Zahlungsdaten — {{params.payment_reference}}",
    preheader: "Ein Schritt trennt Sie von Ihrem Bereich: die erste Zahlung.",
    titel: "Nur noch ein Schritt",
    absaetze: [
      "Guten Tag {{params.vorname}}, hier sind die Zahlungsdaten für <b>{{params.paket}}</b>. Sobald Ihre Überweisung eingeht, schalten wir Ihren persönlichen Bereich frei und legen mit Ihrer Akte los.",
      "Wichtig ist nur eines: der <b>Verwendungszweck</b>. An ihm erkennt unser System Ihre Zahlung automatisch — ohne ihn liegt Ihr Geld ohne Namen bei uns, und die Freischaltung verzögert sich.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
knopf: { text: "Zahlungsseite öffnen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Eine Überweisung braucht in der Regel einen Bankarbeitstag. Sobald sie da ist, geht Ihr Bereich automatisch auf.",
    karteZiel: true,
  },

  payment_confirmed: {
    betreff: "Ihr Zugang ist da, {{params.vorname}}",
    preheader: "Zahlung eingegangen — Ihr persönlicher Bereich ist geöffnet.",
    titel: "Willkommen an Bord",
    heroKarte: true,
    absaetze: [
      "Ihre Zahlung ist eingegangen — Ihr persönlicher Bereich ist ab sofort geöffnet. Ab jetzt arbeiten wir für Sie.",
      "In Ihrem Bereich finden Sie Ihren Fahrplan, Ihre Unterlagen und den Stand jedes Schrittes. Melden Sie sich mit der E-Mail-Adresse an, an die diese Nachricht ging.",
      "Als Nächstes: Ihr <b>Startgespräch</b>. Fünfzehn Minuten mit Ihrem persönlichen Ansprechpartner, in denen wir Ihre Akte durchgehen und die ersten Schritte festlegen. Den Termin wählen Sie selbst in Ihrem Bereich.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Bezahlt", wert: "{{params.betrag}} €" },
    ],
    knopf: { text: "In meinen Bereich", url: "{{params.login_url}}" },
    fussnote: "Noch kein Passwort? Wählen Sie beim Anmelden „Passwort vergessen“ — Sie vergeben es in einem Schritt selbst.",
    karteZiel: true,
  },

  antrag_erinnerung: {
    betreff: "Ihr Antrag wartet auf Sie, {{params.vorname}}",
    preheader: "Sie waren fast fertig — machen Sie genau dort weiter.",
    titel: "Da fehlt nur noch ein Stück",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben Ihren FIAON-Antrag begonnen und bei „{{params.schritt_text}}“ unterbrochen. Alles, was Sie eingegeben haben, ist gespeichert — Sie machen genau dort weiter, wo Sie aufgehört haben.",
      "Warum es sich lohnt, jetzt fertig zu machen: Je früher Ihre Akte bei uns liegt, desto früher holen wir Ihre Auskunft und sehen, welche Einträge angreifbar sind. Jede Woche Wartezeit ist eine Woche, in der sich nichts verbessert.",
    ],
    knopf: { text: "Antrag fortsetzen", url: "{{params.weiter_link}}" },
    fussnote: "Dauert keine fünf Minuten. Bei Fragen: einfach auf diese E-Mail antworten.",
    karteZiel: true,
  },

  documents_change_request: {
    betreff: "Wir brauchen ein Dokument von Ihnen, {{params.vorname}}",
    preheader: "Ein Upload fehlt oder war nicht lesbar — so reichen Sie nach.",
    titel: "Ein Dokument fehlt noch",
    absaetze: [
      "Guten Tag {{params.vorname}}, bei der Prüfung Ihrer Unterlagen ist uns etwas aufgefallen:",
      "<b>{{params.hinweis}}</b>",
      "Laden Sie das Dokument einfach in Ihrem Bereich neu hoch — als PDF, gut lesbar, alle vier Ecken im Bild. Danach prüfen wir sofort weiter.",
    ],
    knopf: { text: "Dokument hochladen", url: "{{params.login_url}}" },
    fussnote: "Solange das Dokument fehlt, liegt Ihre Akte auf Pause — je schneller es da ist, desto schneller geht es weiter.",
  },

  // E-184 (11.09.2026): Der Zustimmungs-Link aus der Akte. Vorher nahm die Route
  // documents_change_request („Ein Dokument fehlt noch"), das nur die Verwaltung
  // senden darf — zwölf Klicks des Teams, null Mails. Jetzt eine eigene, gesiezte
  // Vorlage, die sagt, was fehlt und was der Kunde tun soll.
  zustimmung_link: {
    betreff: "Ihre Bestätigung für den Vertrag, {{params.vorname}}",
    preheader: "Zwei Klicks, dann ist Ihr Vertrag vollständig.",
    titel: "Es fehlt noch Ihre Bestätigung",
    absaetze: [
      "Guten Tag {{params.vorname}}, für Ihren Vertrag{{params.paket_satz}} fehlt noch Ihre Bestätigung zu: <b>{{params.offen}}</b>.",
      "Diese Erklärungen können nur Sie selbst abgeben. Über den Knopf öffnen Sie eine Seite, auf der Sie die Punkte ankreuzen — das dauert zwei Klicks, danach geht es sofort weiter.",
    ],
    knopf: { text: "Jetzt bestätigen", url: "{{params.zustimmung_url}}" },
    fussnote: "Der Link gilt 30 Tage. Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },

  number_update_request: {
    betreff: "Stimmt Ihre Telefonnummer noch, {{params.vorname}}?",
    preheader: "Wir erreichen Sie nicht — eine korrekte Nummer genügt.",
    titel: "Wir erreichen Sie nicht",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben mehrfach versucht, Sie anzurufen — unter der hinterlegten Nummer kommen wir nicht durch.",
      "Ein Anruf ist der schnellste Weg, Ihre Akte voranzubringen: Im Gespräch klären wir in Minuten, was per E-Mail Tage dauert. Prüfen Sie kurz Ihre Nummer — ein Klick genügt.",
    ],
    knopf: { text: "Nummer prüfen und korrigieren", url: "{{params.update_url}}" },
    // 18.09.2026: Der Terminlink fuhr seit dem 24.08. in der Nutzlast mit
    // (fiaon-number-update.ts: „zwei Wege — Nummer nachtragen ODER gleich einen
    // Termin wählen") — die Vorlage zeigte ihn nie. Jetzt als leiser zweiter Weg.
    knopf2: { text: "Oder direkt einen Gesprächstermin wählen", url: "{{params.termin_link}}" },
    fussnote: "Die Nummer stimmt? Dann antworten Sie kurz mit einer Uhrzeit, zu der wir Sie gut erreichen.",
  },

  // 21.09.2026 (E-206): Justin — „viel mehr auf die Kreditkarte gepitcht", ab der
  // ersten Rate, mit dem Weg der Antragszeit (Unterlagen hochladen). Die Sätze zur
  // Karte sind dieselben wie in WhatsApp und bei Mara (shared/fiaon-karten-weg.ts).
  konto_karte_einladung: {
    betreff: "Ihr Link zur Karte ist da, {{params.vorname}}",
    preheader: "Ihr Account ist aktiviert — der Antrag bei unserer Partnerbank dauert nur wenige Minuten.",
    titel: "Ihr Weg zur Karte",
    heroKarte: true,
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre erste Zahlung ist da und Ihr Account ist aktiviert. Hier ist, wie angekündigt, Ihr fertiger Link zu unserer Partnerbank, der DKB: Girokonto mit Visa-Karte, in wenigen Minuten online beantragt — Sie brauchen nur Ihren Ausweis.",
      "Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist können Sie sie schon vorher in der App der Bank mit Apple Pay nutzen.",
      "Parallel begleiten wir Ihren Antrag mit unserer Bonitätsanalyse. Laden Sie dafür in Ihrem Bereich Ihre Kontoauszüge der letzten sechs Monate, Ihren Ausweis oder Reisepass und Ihre Bonitätsauskunft hoch — {{params.agent_vorname}} aus Ihrem Team ist für Sie da, wenn Sie Fragen haben.",
    ],
    knopf: { text: "Jetzt Konto und Karte beantragen", url: "{{params.partner_link}}" },
    knopf2: { text: "Unterlagen hochladen", url: "{{params.login_url}}" },
    fussnote: "Die Entscheidung über Konto und Karte trifft die Bank.",
  },

  account_activated: {
    betreff: "Ihr Zugang ist wieder frei, {{params.vorname}}",
    preheader: "Alles geklärt — Ihr Bereich ist wieder geöffnet.",
    titel: "Ihr Zugang ist wieder frei",
    absaetze: [
      "Guten Tag {{params.vorname}}, gute Nachricht: Ihr Zugang wurde wieder freigeschaltet. Ihr Bereich, Ihre Unterlagen und Ihr Fahrplan sind ab sofort wieder für Sie erreichbar.",
      "Ihre Akte hat in der Zwischenzeit nichts verloren — wir machen genau dort weiter, wo wir stehen geblieben sind.",
    ],
    knopf: { text: "In meinen Bereich", url: "{{params.login_url}}" },
  },

  account_suspended: {
    betreff: "Ihr Zugang wurde vorübergehend gesperrt",
    preheader: "Was das bedeutet und wie Sie es klären — in zwei Minuten gelesen.",
    titel: "Ihr Zugang ist vorübergehend gesperrt",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, wir haben Ihren Zugang vorübergehend gesperrt.",
      "Der Grund: <b>{{params.grund}}</b>",
      "Das ist kein endgültiger Zustand. Melden Sie sich bei Ihrem Ansprechpartner — in den meisten Fällen ist die Sache in einem kurzen Gespräch geklärt und der Zugang wieder offen. Ihre Akte und Ihre Unterlagen bleiben selbstverständlich erhalten.",
    ],
    fussnote: "Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an — wir klären das gemeinsam.",
  },

  profile_query: {
    betreff: "Eine kurze Rückfrage zu Ihren Angaben",
    preheader: "Damit Ihre Akte stimmt, brauchen wir eine Antwort von Ihnen.",
    titel: "Eine kurze Rückfrage",
    absaetze: [
      "Guten Tag {{params.vorname}}, bei der Arbeit an Ihrer Akte ist eine Frage aufgekommen:",
      "<b>{{params.hinweis}}</b>",
      "Am schnellsten geht es, wenn Sie die Angabe direkt in Ihrem Bereich prüfen — oder einfach auf diese E-Mail antworten.",
    ],
    knopf: { text: "Angaben prüfen", url: "{{params.login_url}}" },
  },

  gdpr_deleted: {
    betreff: "Ihre Daten wurden gelöscht",
    preheader: "Bestätigung: Ihre personenbezogenen Daten sind entfernt.",
    titel: "Ihre Daten sind gelöscht",
    absaetze: [
      "Guten Tag {{params.vorname}}, hiermit bestätigen wir: Ihre personenbezogenen Daten wurden am {{params.geloescht_am}} aus unseren Systemen gelöscht, wie von Ihnen gewünscht.",
      "Gesetzliche Aufbewahrungspflichten (etwa für Rechnungen) bleiben davon unberührt — diese Unterlagen werden nach Ablauf der Fristen ebenfalls entfernt.",
      "Danke, dass Sie bei uns waren. Wenn Sie irgendwann zurückkommen möchten, beginnen wir gern ein neues Kapitel.",
    ],
  },
};
