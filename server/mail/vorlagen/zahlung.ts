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
  bankverbindung_neu: {
    betreff: "Wichtig: Neue Bankverbindung für Ihre Zahlung an FIAON",
    preheader: "Bitte überweisen Sie ab sofort nur noch auf unser neues Konto.",
    titel: "Unsere Bankverbindung hat sich geändert",
    marke: "Wichtige Information",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben unser Geschäftskonto gewechselt. Falls Sie in den letzten Tagen eine E-Mail mit unseren Bankdaten erhalten haben: Die dort genannte Verbindung ({{params.alte_iban}}) ist ab sofort nicht mehr gültig.",
      "Bitte verwenden Sie für Ihre Überweisung ausschließlich die untenstehende neue Bankverbindung — der Verwendungszweck bleibt derselbe, daran erkennt unser System Ihre Zahlung automatisch.",
      "Haben Sie in den letzten Tagen bereits auf das alte Konto überwiesen? Dann antworten Sie bitte kurz auf diese E-Mail — wir kümmern uns persönlich darum, dass Ihre Zahlung richtig ankommt. Es geht nichts verloren.",
    ],
    daten: [
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN (neu)", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Bank", wert: "{{params.bank}}" },
      { label: "Verwendungszweck", wert: "{{params.verwendungszweck}}" },
    ],
    knopf: { text: "Zu meinem Bereich", url: "https://fiaon.com/login" },
    fussnote: "Diese Nachricht ist keine Zahlungserinnerung — sie informiert nur über die neue Bankverbindung.",
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
    knopf2: { text: "Oder per Überweisung: QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
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
    knopf2: { text: "Oder per Überweisung: QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.verwendungszweck}}" },
    fussnote: "Gerade schwierig diesen Monat? Sagen Sie es uns einfach — gemeinsam findet sich fast immer eine Lösung, bevor etwas anbrennt.",
    karteZiel: true,
  },

  claim_received: {
    betreff: "Danke — wir prüfen Ihre Zahlung",
    preheader: "Ihre Meldung ist da. Wir gleichen mit dem Konto ab.",
    titel: "Ihre Zahlungsmeldung ist da",
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben uns mitgeteilt, dass Sie <b>{{params.betrag}} €</b> für <b>{{params.paket}}</b> überwiesen haben — danke dafür.",
      "Wir gleichen Ihre Zahlung jetzt mit dem Bankkonto ab. Das dauert in der Regel einen Bankarbeitstag. Sobald das Geld zugeordnet ist, geht Ihr Bereich automatisch auf und Sie erhalten Ihre Zugangs-Mail.",
    ],
    daten: [
      { label: "Gemeldeter Betrag", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    fussnote: "Kein Verwendungszweck angegeben? Dann kann die Zuordnung länger dauern — antworten Sie in dem Fall kurz mit Datum und Betrag Ihrer Überweisung.",
  },

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
    knopf2: { text: "Oder per Überweisung: QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    karteZiel: true,
  },

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
