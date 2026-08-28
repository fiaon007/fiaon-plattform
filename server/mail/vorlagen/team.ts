// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: AN DAS TEAM (12) — Absender „FIAON Team"
//
// Schreibregeln: siehe konto.ts — mit EINEM Unterschied: Mitarbeiter werden
// geduzt (so spricht das Haus intern), Kunden IMMER gesiezt. Der karteZiel-
// Block bleibt Kundenmails vorbehalten.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const TEAM_VORLAGEN: Record<string, MailBaustein> = {

  agent_invite: {
    betreff: "Willkommen im FIAON-Team, {{params.vorname}}",
    preheader: "Dein Zugang ist bereit — richte ihn jetzt ein.",
    titel: "Willkommen im Team",
    absaetze: [
      "Hallo {{params.vorname}}, schön, dass du dabei bist! {{params.admin_name}} hat dir deinen Zugang zum FIAON-Arbeitsbereich angelegt.",
      "Über den Knopf legst du dein Passwort fest und landest direkt in deinem Bereich — dort findest du deine Arbeitsliste, deine Leitfäden und die Academy.",
    ],
    knopf: { text: "Zugang einrichten", url: "{{params.invite_url}}" },
    fussnote: "Der Link ist nur für dich bestimmt und zeitlich begrenzt gültig.",
  },

  agent_password_reset: {
    betreff: "Dein neues Passwort für das FIAON-Portal",
    preheader: "Ein Klick, neues Passwort, fertig.",
    titel: "Passwort zurücksetzen",
    absaetze: [
      "Hallo {{params.vorname}}, du (oder jemand anderes) hat ein neues Passwort für dein FIAON-Portal angefordert.",
      "Warst du das nicht, kannst du diese Mail einfach ignorieren — dein Zugang bleibt unverändert.",
    ],
    knopf: { text: "Neues Passwort festlegen", url: "{{params.reset_url}}" },
    fussnote: "Der Link ist aus Sicherheitsgründen nur kurze Zeit gültig.",
  },

  agent_payment_reminder: {
    betreff: "Dein Kunde {{params.vorname}} {{params.nachname}} hat noch nicht gezahlt",
    preheader: "Offene Startzahlung in deiner Betreuung — ein Anruf wirkt.",
    titel: "Offene Zahlung in deiner Betreuung",
    absaetze: [
      "Hallo {{params.agent_name}}, bei deinem Kunden <b>{{params.vorname}} {{params.nachname}}</b> steht die Startzahlung für {{params.paket}} weiter aus.",
      "Erfahrungswert: Ein kurzer, freundlicher Anruf löst das in den meisten Fällen — oft ist es nur eine offene Frage oder eine vergessene Überweisung.",
    ],
    daten: [
      { label: "Kunde", wert: "{{params.vorname}} {{params.nachname}}" },
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
  },

  agent_payout_done: {
    betreff: "Deine Auszahlung ist unterwegs: {{params.betrag}} €",
    preheader: "Freigegeben und überwiesen — gut gemacht.",
    titel: "Deine Auszahlung ist raus",
    absaetze: [
      "Hallo {{params.vorname}}, deine Auszahlung über <b>{{params.betrag}} €</b> wurde freigegeben und überwiesen. Je nach Bank ist das Geld in ein bis zwei Arbeitstagen bei dir.",
      "Danke für deine Arbeit — weiter so!",
    ],
  },

  agent_payout_rejected: {
    betreff: "Rückfrage zu deiner Auszahlung",
    preheader: "Deine Anforderung braucht noch eine Klärung — hier steht warum.",
    titel: "Deine Auszahlung braucht eine Klärung",
    absaetze: [
      "Hallo {{params.vorname}}, deine Auszahlungsanforderung über <b>{{params.betrag}} €</b> konnte so noch nicht freigegeben werden.",
      "Der Grund: <b>{{params.grund}}</b>",
      "Melde dich kurz bei der Leitung oder antworte auf diese Mail — meistens ist es schnell geklärt.",
    ],
  },

  agent_bank_reminder: {
    betreff: "Deine Bankdaten fehlen noch, {{params.vorname}}",
    preheader: "Ohne IBAN keine Auszahlung — dauert nur eine Minute.",
    titel: "Deine Bankdaten fehlen",
    absaetze: [
      "Hallo {{params.vorname}}, in deinem Profil fehlt noch deine Bankverbindung — und ohne IBAN können wir dir nichts auszahlen.",
      "Trag sie kurz in deinem Portal unter „Profil“ ein, dann steht deiner nächsten Auszahlung nichts im Weg.",
    ],
  },

  agent_callback_reminder: {
    betreff: "Erinnerung: Rückruf {{params.kunde_name}} um {{params.termin_zeit}}",
    preheader: "Dein selbst gesetzter Rückruftermin steht an.",
    titel: "Dein Rückruf steht an",
    absaetze: [
      "Hallo {{params.vorname}}, kurze Erinnerung an deinen eigenen Rückruftermin:",
    ],
    daten: [
      { label: "Kunde", wert: "{{params.kunde_name}}" },
      { label: "Referenz", wert: "{{params.referenz}}" },
      { label: "Zeit", wert: "{{params.termin_zeit}}" },
    ],
    fussnote: "Der Kunde erwartet deinen Anruf — du hast den Termin mit ihm vereinbart.",
  },

  agent_feedback_rewarded: {
    betreff: "Dein Feedback wurde belohnt: {{params.betrag_eur}} €",
    preheader: "Danke — dein Hinweis hat es besser gemacht.",
    titel: "Dein Feedback zahlt sich aus",
    absaetze: [
      "Hallo {{params.vorname}}, dein Feedback „<b>{{params.feedback_titel}}</b>“ wurde geprüft und belohnt: <b>{{params.betrag_eur}} €</b> gehen mit deiner nächsten Auszahlung an dich.",
      "Genau solche Hinweise machen die Plattform jeden Tag besser — danke dir!",
    ],
  },

  agent_feedback_reply: {
    betreff: "Antwort auf dein Feedback „{{params.feedback_titel}}“",
    preheader: "Die Leitung hat geantwortet — lies hier weiter.",
    titel: "Antwort auf dein Feedback",
    absaetze: [
      "Hallo {{params.vorname}}, zu deinem Feedback „<b>{{params.feedback_titel}}</b>“ gibt es eine Antwort:",
      "{{params.antwort}}",
    ],
    knopf: { text: "Im Portal ansehen", url: "{{params.portal_url}}" },
  },

  aufgabe_zugewiesen: {
    betreff: "Neuer Auftrag für dich: {{params.aufgabe}}",
    preheader: "Aus dem TODO-Board — mit Fälligkeit und allen Details.",
    titel: "Du hast einen neuen Auftrag",
    absaetze: [
      "Hallo {{params.vorname}}, dir wurde ein Auftrag übergeben:",
      "<b>{{params.aufgabe}}</b>",
    ],
    daten: [
      { label: "Kunde/Bezug", wert: "{{params.kunde}}" },
      { label: "Fällig", wert: "{{params.faellig_am_text}}" },
    ],
    knopf: { text: "Auftrag öffnen", url: "{{params.portal_url}}" },
  },

  contract_signed: {
    betreff: "Dein Vertrag ist unterschrieben und hinterlegt",
    preheader: "Version {{params.contract_version}} — dein Exemplar zum Abruf.",
    titel: "Vertrag erfolgreich unterschrieben",
    absaetze: [
      "Hallo {{params.vorname}}, dein Vertrag (Version {{params.contract_version}}) wurde am {{params.signed_at_text}} unterschrieben und sicher hinterlegt.",
      "Dein Exemplar kannst du jederzeit über den Knopf abrufen. Die Prüfsumme unten belegt, dass das Dokument seit der Unterschrift unverändert ist.",
    ],
    daten: [
      { label: "Version", wert: "{{params.contract_version}}" },
      { label: "Unterschrieben am", wert: "{{params.signed_at_text}}" },
      { label: "Prüfsumme", wert: "{{params.doc_hash}}" },
    ],
    knopf: { text: "Vertrag herunterladen", url: "{{params.download_url}}" },
  },

  commission_statement_issued: {
    betreff: "Deine Abrechnung {{params.statement_no}} ist da",
    preheader: "{{params.betrag}} € — deine Abrechnung liegt im Portal.",
    titel: "Deine Abrechnung ist fertig",
    absaetze: [
      "Hallo {{params.vorname}}, deine Provisionsabrechnung <b>{{params.statement_no}}</b> über <b>{{params.betrag}} €</b> ist erstellt und liegt in deinem Portal.",
      "Prüfe sie kurz — stimmt alles, musst du nichts weiter tun. Bei Fragen antworte einfach auf diese Mail.",
    ],
    daten: [
      { label: "Abrechnung", wert: "{{params.statement_no}}" },
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Prüfsumme", wert: "{{params.doc_hash}}" },
    ],
  },
};
