// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DER ZAHLUNGS-WEG (6) — Absender „FIAON Accounting"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · Eine Mahnung droht nicht, sie erinnert — der Kunde WILL das Ergebnis
//   (seine Bonität), die Rate ist sein eigenes Projekt. Die Eskalation
//   liegt in der Mahnstufe (abo_payment_reminder), nicht im Ton.
// · Jede Zahlungs-Mail nennt den Verwendungszweck im Datenkasten.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const ZAHLUNG_VORLAGEN: Record<string, MailBaustein> = {

  // NOTFALL 02.09.2026: Das bisherige Konto wurde gesperrt — jeder, der in
  // den letzten 24 Stunden Bankdaten von uns bekam, erfährt sofort die neue
  // Verbindung. Ehrlich, ruhig, ohne Drama; mit seinem Verwendungszweck.
  //
  // ── WARUM HIER AUCH DIE ZAHLWEGE STEHEN (02.09.2026, zweite Fassung) ──────
  // Die Mail sagte „ab sofort auf das neue Konto" — und schickte den Leser
  // dann mit dem Knopf „Zu meinem Bereich" auf die Anmeldung, wo überhaupt
  // keine Bankdaten stehen. Wer zahlen wollte, musste die neue IBAN von Hand
  // abtippen: genau der Weg, auf dem der Zahlendreher entsteht, den diese
  // Mail verhindern soll. QR-Code, Sofortzahlung und Zahlungsseite ziehen
  // ihre Bankdaten aus derselben einen Quelle (shared/fiaon-bank.ts) — sie
  // können gar nicht auf das gesperrte Konto zeigen.
  //
  // ZWEI FEINHEITEN, die aus der Nutzlast folgen (ausgezählt über die 1.484
  // bereits verschickten Mails dieses Ereignisses):
  // · Der Datenkasten zeigt `verwendungszweck` — der Versender setzt dort
  //   notfalls einen Ersatztext ein. QR und Zahlungsseite brauchen dagegen
  //   `payment_reference`, eine ECHTE Referenz, sonst findet der
  //   Zahlungsauftrag nichts. Alle 1.484 hatten sie; fehlt sie doch einmal,
  //   lässt der Motor den Knopf von selbst weg.
  // · Der Betrag steht ohne „€" im Wert und mit „(EUR)" im Label: Fünf der
  //   1.484 hatten keinen hinterlegten Betrag, und ein einsames „ €" ohne
  //   Zahl ist die eine Peinlichkeit, die eine Notfallmail nicht verträgt.
  bankverbindung_neu: {
    betreff: "Wichtig: Neue Bankverbindung für Ihre Zahlung an FIAON",
    preheader: "Bitte überweisen Sie ab sofort nur noch auf unser neues Konto.",
    titel: "Unsere Bankverbindung hat sich geändert",
    marke: "Wichtige Information",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben unser Geschäftskonto gewechselt. Falls Sie in den letzten Tagen eine E-Mail mit unseren Bankdaten erhalten haben: Die dort genannte Verbindung ({{params.alte_iban}}) ist ab sofort nicht mehr gültig.",
      // Die Rückfrage steht VOR dem Zahlweg. Wer schon überwiesen hat, soll
      // das zuerst lesen — sonst zahlt er auf unsere Einladung hin doppelt.
      "Haben Sie in den letzten Tagen bereits auf das alte Konto überwiesen? Dann antworten Sie bitte kurz auf diese E-Mail — wir kümmern uns persönlich darum, dass Ihre Zahlung richtig ankommt. Es geht nichts verloren, und Sie zahlen nichts doppelt.",
      "Ist Ihre Zahlung dagegen noch offen, verwenden Sie bitte ausschließlich die neue Bankverbindung unten. Ihr Verwendungszweck bleibt derselbe — daran erkennt unser System Ihre Zahlung automatisch.",
      "Am einfachsten geht es ganz ohne Abtippen: Der QR-Code unten trägt die neue Verbindung, Ihren Betrag und Ihren Verwendungszweck fertig in Ihre Banking-App ein. Dasselbe gilt für die Knöpfe darunter — beide führen immer auf das aktuelle Konto.",
    ],
    daten: [
      { label: "Betrag (EUR)", wert: "{{params.betrag}}" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN (neu)", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Bank", wert: "{{params.bank}}" },
      { label: "Verwendungszweck", wert: "{{params.verwendungszweck}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode mit der neuen Bankverbindung — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Die neue Verbindung, Ihr Betrag und Ihr Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Sofort per Bank-App bezahlen — in einer Minute gebucht", url: "{{params.sofort_url}}" },
    knopf2: { text: "Zahlungsseite ansehen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Diese Nachricht ist keine Zahlungserinnerung — sie ändert nur das Konto, auf das Ihre Zahlung geht. Betrag und Verwendungszweck bleiben unverändert.",
  },

  // 8.344 Versände/Monat — die häufigste Mail des Hauses (Startzahlung offen).
  payment_reminder: {
    betreff: "Ihre Zahlung steht noch aus — {{params.payment_reference}}",
    preheader: "Ihre Akte ist startklar und wartet nur auf die Zahlung.",
    titel: "Ihre Akte wartet auf den Start",
    marke: "Erinnerung {{params.reminder_number}}",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre erste Zahlung für <b>{{params.paket}}</b> ist noch nicht bei uns eingegangen — und solange können wir für Sie nicht loslegen.",
      "Das passiert leicht: Eine Überweisung braucht ein bis zwei Bankarbeitstage, und manchmal geht sie im Alltag unter. Sobald das Geld da ist, öffnet sich Ihr Bereich automatisch und wir holen Ihre Auskunft.",
      "Haben Sie bereits überwiesen? Dann ist diese Nachricht schon überholt — oder antworten Sie kurz, wir sehen sofort nach.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
knopf: { text: "Sofort per Bank-App bezahlen — in einer Minute gebucht", url: "{{params.sofort_url}}" },
    knopf2: { text: "Zahlungsseite ansehen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Der Verwendungszweck ist wichtig: An ihm erkennt unser System Ihre Zahlung automatisch.",
    karteZiel: true,
  },

  // Monatsrate fällig/überfällig, mit Mahnstufe und Ratenleiste.
  abo_payment_reminder: {
    betreff: "Ihre Monatsrate {{params.rate_nr}} — {{params.verwendungszweck}}",
    preheader: "Ihre Rate ist fällig. Betrag und Bankdaten stehen hier bereit.",
    titel: "Ihre Monatsrate ist fällig",
    marke: "{{params.mahnstufe_text}}",
    ratenLeiste: { nr: "{{params.rate_nr}}", von: 12 },
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre Monatsrate für <b>{{params.paket}}</b> war am <b>{{params.faellig_am_text}}</b> fällig.",
      "Jede pünktliche Rate zahlt doppelt ein: Sie hält Ihre Betreuung am Laufen — und sie baut genau die Zahlungshistorie auf, die am Ende über Ihre Bonität entscheidet.",
      "Schon überwiesen? Dann hat sich diese Nachricht mit Ihrer Zahlung überschnitten — Sie müssen nichts weiter tun.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.verwendungszweck}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.verwendungszweck}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Rate sofort per Bank-App bezahlen — in einer Minute gebucht", url: "{{params.sofort_url}}" },
    knopf2: { text: "Zahlungsseite ansehen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.verwendungszweck}}" },
    fussnote: "Gerade schwierig diesen Monat? Sagen Sie es uns einfach — gemeinsam findet sich fast immer eine Lösung, bevor etwas anbrennt.",
    karteZiel: true,
  },

  // ── HIER STEHT BEWUSST KEIN ZAHLKNOPF UND KEIN QR-CODE ───────────────────
  // Dieser Mensch hat gerade gemeldet, dass er überwiesen HAT. Gemessen ist
  // das meistens wahr: Aus frischen Zahlungsmeldungen (jünger als drei Tage)
  // werden 9,52 % zugeordnete Zahlungen gegen 0,49 % Grundquote — das Geld
  // ist in aller Regel unterwegs oder liegt ohne Verwendungszweck bei uns.
  // Ein Knopf „Jetzt bezahlen" auf einer Mail, die mit „Danke" beginnt, lädt
  // deshalb nicht zur Zahlung ein, sondern zur ZWEITEN Zahlung — und die
  // kostet Rückerstattung, Vertrauen und Betreuungszeit für einen Fehler, den
  // wir selbst ausgelöst hätten.
  //
  // WAS ER STATTDESSEN BRAUCHT: die Möglichkeit, seine eigene Überweisung zu
  // PRÜFEN. Der häufigste Grund für eine Zahlung, die wir nicht finden, ist
  // ein abgewandelter Verwendungszweck oder eine veraltete Empfängerangabe
  // (das gesperrte Konto vom 02.09. steht noch in älteren Mails und in
  // manchem Dauerauftrag). Deshalb nennt der Datenkasten jetzt die volle
  // Bankverbindung aus der einen Quelle — zum Abgleichen, nicht zum
  // Nachzahlen; und der Text sagt ausdrücklich, dass niemand zweimal zahlen
  // soll. Dass diese Mail Bankdaten trägt, ist im Kontowechsel-Lauf ohnehin
  // schon angenommen: claim_received steht dort in BANK_EREIGNISSE.
  claim_received: {
    betreff: "Danke — wir prüfen Ihre Zahlung",
    preheader: "Ihre Meldung ist da. Wir gleichen mit dem Konto ab.",
    titel: "Ihre Zahlungsmeldung ist da",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben uns mitgeteilt, dass Sie <b>{{params.betrag}} €</b> für <b>{{params.paket}}</b> überwiesen haben — danke dafür.",
      "Wir gleichen Ihre Zahlung jetzt mit dem Bankkonto ab. Das dauert in der Regel einen Bankarbeitstag. Sobald das Geld zugeordnet ist, geht Ihr Bereich automatisch auf und Sie erhalten Ihre Zugangs-Mail.",
      "Eine Bitte, damit das glattgeht: Sehen Sie kurz nach, ob Sie den Verwendungszweck unten mitgeschickt haben — daran finden wir Ihre Zahlung. Haben Sie noch auf unsere frühere Bankverbindung überwiesen, ist das ebenso in Ordnung: Wir haben am 2. September das Konto gewechselt, und was auf dem alten Weg ankommt, ordnen wir Ihnen genauso zu. Überweisen Sie bitte auf keinen Fall ein zweites Mal — wir melden uns, sobald Ihre Zahlung zugeordnet ist.",
    ],
    daten: [
      { label: "Gemeldeter Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    fussnote: "Kein Verwendungszweck angegeben? Dann kann die Zuordnung länger dauern — antworten Sie in dem Fall kurz mit Datum und Betrag Ihrer Überweisung.",
  },

  // Kein Zahlweg, mit Absicht: Diese Bestellung ist storniert, es gibt nichts
  // zu zahlen. Ein QR-Code auf einer Stornobestätigung wäre eine Forderung,
  // die wir gerade zurückgenommen haben. Wer weitermachen will, antwortet —
  // dann wird reaktiviert, und payment_reactivated bringt den vollen Zahlweg.
  payment_cancelled: {
    betreff: "Ihre Bestellung wurde storniert",
    preheader: "Bestätigung der Stornierung — und was das jetzt bedeutet.",
    titel: "Ihre Bestellung ist storniert",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, wir bestätigen: Ihre Bestellung <b>{{params.paket}}</b> wurde storniert.",
      "Der Grund: <b>{{params.grund}}</b>",
      "Falls das ein Missverständnis ist oder Sie es sich anders überlegen: Antworten Sie einfach auf diese E-Mail — Ihre Akte lässt sich mit einem Handgriff wieder aktivieren, ohne dass Sie von vorn beginnen.",
    ],
    daten: [
      { label: "Bestellung", wert: "{{params.payment_reference}}" },
    ],
  },

  payment_reactivated: {
    betreff: "Willkommen zurück, {{params.vorname}} — es geht weiter",
    preheader: "Ihre Bestellung ist wieder aktiv. Hier sind die Zahlungsdaten.",
    titel: "Ihre Akte ist wieder aktiv",
    absaetze: [
      "Guten Tag {{params.vorname}}, schön, dass Sie weitermachen: Ihre Bestellung <b>{{params.paket}}</b> ist wieder aktiv, Ihre Akte liegt bereit — nichts ist verloren gegangen.",
      "Damit es losgeht, fehlt nur die Zahlung. Alle Daten stehen unten; fällig ist sie zum <b>{{params.faellig_am}}</b>.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
knopf: { text: "Sofort per Bank-App bezahlen — in einer Minute gebucht", url: "{{params.sofort_url}}" },
    knopf2: { text: "Zahlungsseite ansehen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    karteZiel: true,
  },

  // Kein Zahlweg, mit Absicht: Hier ist noch nichts fällig und nichts
  // entschieden — es gibt weder einen Betrag noch eine Referenz für ein
  // zweites Jahr. Zahlungsdaten würden die Verlängerung als beschlossen
  // ausgeben; die Vorlage sagt in der Fußnote das Gegenteil.
  abo_verlaengerung_frage: {
    betreff: "Wie soll es weitergehen, {{params.vorname}}?",
    preheader: "Ihr Jahr ist fast um — eine kurze Entscheidung von Ihnen.",
    titel: "Ihr Jahr bei FIAON ist fast um",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihr Betreuungsjahr für <b>{{params.paket}}</b> nähert sich dem Ende — Zeit für eine kurze Entscheidung: Wie soll es weitergehen?",
      "In Ihrem Bereich sehen Sie, was in diesem Jahr passiert ist: jede geprüfte Auskunft, jedes Schreiben, jede Veränderung. Auf dieser Grundlage entscheiden Sie am besten — und Ihr Ansprechpartner bespricht die Möglichkeiten gern mit Ihnen.",
    ],
    knopf: { text: "Meinen Verlauf ansehen", url: "{{params.portal_url}}" },
    fussnote: "Nichts passiert ohne Ihr Zutun — diese Nachricht ist eine Frage, keine Verlängerung.",
  },
};
