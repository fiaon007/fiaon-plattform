// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DER KONTO-WEG (12) — vom Antrag bis zur Löschung
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
  welcome: {
    betreff: "Willkommen bei FIAON, {{params.vorname}}",
    preheader: "Ihr Antrag ist da — das sind die drei nächsten Schritte.",
    titel: "Ihr Antrag ist angekommen",
    heroKarte: true,
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, schön, dass Sie da sind. Ihr Antrag für <b>{{params.paket}}</b> liegt uns vor — damit ist der erste Schritt getan.",
      "So geht es jetzt weiter: <b>1.</b> Sie erhalten gleich eine separate E-Mail mit Ihren Zahlungsdaten. <b>2.</b> Sobald Ihre Zahlung da ist, öffnet sich Ihr persönlicher Bereich. <b>3.</b> Ihr Ansprechpartner meldet sich zum Startgespräch — fünfzehn Minuten, in denen wir Ihre Akte gemeinsam durchgehen.",
      "Ab dann arbeiten wir für Sie: Auskunft holen, jeden Eintrag prüfen, angreifbare Einträge anschreiben. Jeden Schritt sehen Sie live in Ihrem Bereich.",
    ],
    daten: [
      { label: "Ihr Paket", wert: "{{params.paket}}" },
      { label: "Ihr Aktenzeichen", wert: "{{params.antrag_id}}" },
    ],
    fussnote: "Die E-Mail mit den Zahlungsdaten kommt in wenigen Minuten. Nichts erhalten? Ein Blick in den Spam-Ordner hilft — oder antworten Sie einfach hier.",
    karteZiel: true,
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
    knopf: { text: "Jetzt bezahlen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
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

  number_update_request: {
    betreff: "Stimmt Ihre Telefonnummer noch, {{params.vorname}}?",
    preheader: "Wir erreichen Sie nicht — eine korrekte Nummer genügt.",
    titel: "Wir erreichen Sie nicht",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben mehrfach versucht, Sie anzurufen — unter der hinterlegten Nummer kommen wir nicht durch.",
      "Ein Anruf ist der schnellste Weg, Ihre Akte voranzubringen: Im Gespräch klären wir in Minuten, was per E-Mail Tage dauert. Prüfen Sie kurz Ihre Nummer — ein Klick genügt.",
    ],
    knopf: { text: "Nummer prüfen und korrigieren", url: "{{params.update_url}}" },
    fussnote: "Die Nummer stimmt? Dann antworten Sie kurz mit einer Uhrzeit, zu der wir Sie gut erreichen.",
  },

  // ── DER KNOPF FÜHRT IN DIE STRECKE, NICHT INS DASHBOARD (01.09.2026) ──────
  // Bis hierhin zeigte er auf /kundenbereich. Von 23 verschickten Mails wurden
  // fünf geklickt und trotzdem kein einziges Mandat erteilt: Wer klickte, kam
  // auf der Anmeldung heraus und musste den Knopf im Bereich erst suchen.
  // `sepa_link` ist ein signierter Direktlink (fiaon-lastschrift.ts) — ein
  // Klick, dann steht der Kunde bei GoCardless. Fehlt der Parameter, fällt die
  // Vorlage auf den Kundenbereich zurück, statt einen toten Knopf zu zeigen.
  sepa_einrichten: {
    betreff: "Eine Sorge weniger: Ihre Raten per Bankeinzug",
    preheader: "Nie mehr an die Rate denken — einmal einrichten, fertig.",
    titel: "Ihre Raten, automatisch pünktlich",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre erste Zahlung ist bei uns eingegangen — vielen Dank. Damit ist Ihre Akte in Arbeit.",
      "Für die weiteren Monatsraten gibt es einen bequemeren Weg als die Überweisung: den Bankeinzug. Ihre Rate wird dann automatisch und immer pünktlich abgebucht. Kein Verwendungszweck, keine vergessene Rate. Das ist mehr als Bequemlichkeit — eine lückenlose Zahlungshistorie ist genau das, woran später jede Bank Ihre Zuverlässigkeit abliest.",
      // Steht nur da, wenn wirklich etwas offen ist: Der Motor lässt leere
      // Platzhalter weg. Verschweigen wäre der teuerste Fehler — wer von der
      // ersten Abbuchung überrascht wird, widerruft das Mandat sofort.
      "{{params.offene_rate_hinweis}}",
      "Ein Klick auf den Knopf, dann geben Sie Ihre Bankverbindung einmal sicher bei unserem Zahlungspartner GoCardless ein. Wir sehen Ihre Kontonummer nie. Das dauert zwei Minuten und lässt sich jederzeit widerrufen.",
    ],
    knopf: { text: "Bankeinzug einrichten", url: "{{params.sepa_link}}" },
    fussnote: "Sie zahlen lieber weiterhin per Überweisung? Dann müssen Sie nichts tun — Ihre Raten bleiben wie gewohnt mit Verwendungszweck fällig.",
    karteZiel: true,
  },

  konto_karte_einladung: {
    betreff: "Der nächste Baustein Ihrer Bonität, {{params.vorname}}",
    preheader: "Ein Girokonto mit Karte — von uns vorbereitet, von Ihnen eröffnet.",
    titel: "Ihr nächster Baustein",
    heroKarte: true,
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre Akte ist so weit: {{params.agent_vorname}} aus Ihrem Team hat den nächsten Baustein für Sie freigeschaltet — ein Girokonto mit Karte bei unserer Partnerbank.",
      "Warum das zählt: Ein aktiv geführtes Konto mit eigener Karte ist einer der stärksten Bausteine einer gesunden Bonität. Sie eröffnen es in wenigen Minuten online; alles, was Sie brauchen, ist Ihr Ausweis.",
    ],
    knopf: { text: "Konto ansehen und eröffnen", url: "{{params.partner_link}}" },
    fussnote: "Die Kontoeröffnung ist freiwillig und die Entscheidung über die Eröffnung trifft die Bank. Fragen dazu klärt Ihr Ansprechpartner gern im Gespräch.",
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
