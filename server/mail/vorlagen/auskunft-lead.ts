// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: BONITÄTSAUSKUNFT & LEADS (5) — Absender „FIAON Welcome"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · lead_followup ist mit 9.392 Versänden/Monat die größte Mail des Hauses
//   und geht an Menschen OHNE Vertrag → Abmeldelink ist Pflicht (abmeldeUrl).
// · schufa_rejected überbringt eine Absage: erst die Nachricht, dann der Weg
//   nach vorn — nie umgekehrt.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const AUSKUNFT_LEAD_VORLAGEN: Record<string, MailBaustein> = {

  schufa_requested: {
    betreff: "Ihre Bonitätsauskunft ist beauftragt",
    preheader: "Der wichtigste Schritt läuft — so geht es jetzt weiter.",
    titel: "Ihre Auskunft ist unterwegs",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben Ihre Bonitätsauskunft beauftragt — damit beginnt der wichtigste Teil der Arbeit: schwarz auf weiß sehen, was über Sie gespeichert ist.",
      "{{params.hinweis}}",
      "Sobald die Auskunft vorliegt, prüfen wir jeden einzelnen Eintrag: Stimmt er? Ist er verjährt? Ist er angreifbar? Das Ergebnis sehen Sie in Ihrem Bereich, und Ihr Ansprechpartner geht es mit Ihnen durch.",
    ],
    knopf: { text: "Zu meinem Bereich", url: "{{params.login_url}}" },
    karteZiel: true,
  },

  schufa_approved: {
    betreff: "Ihre Auskunft ist da, {{params.vorname}}",
    preheader: "Geprüft und in Ihrem Bereich — sehen Sie selbst hinein.",
    titel: "Ihre Auskunft liegt vor",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre Bonitätsauskunft ist eingetroffen und liegt jetzt in Ihrem Bereich — geprüft und für Sie aufbereitet.",
      "Was jetzt zählt: Jeder Eintrag wurde von uns bewertet. Was angreifbar ist, gehen wir an; was korrekt ist, benennen wir ehrlich. Ihr Ansprechpartner bespricht das Ergebnis gern Schritt für Schritt mit Ihnen.",
    ],
    knopf: { text: "Auskunft ansehen", url: "{{params.login_url}}" },
    karteZiel: true,
  },

  schufa_rejected: {
    betreff: "Ihre Auskunft: Es gibt eine Verzögerung",
    preheader: "Die Bestellung ging nicht durch — so lösen wir das gemeinsam.",
    titel: "Es gibt eine Verzögerung",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, bei der Bestellung Ihrer Bonitätsauskunft ist etwas dazwischengekommen:",
      "<b>{{params.grund}}</b>",
      "Das ist ärgerlich, aber lösbar — in den meisten Fällen liegt es an einer kleinen Abweichung bei Name oder Adresse. Ihr Ansprechpartner meldet sich dazu bei Ihnen; wenn Sie schneller sein wollen, antworten Sie einfach auf diese E-Mail.",
    ],
  },

  // 9.392 Versände/Monat — die größte Mail des Hauses. Geht an Interessenten
  // OHNE Antrag; ihr einziger Auftrag ist der Klick auf den Antrag.
  lead_followup: {
    betreff: "{{params.vorname}}, Ihre Bonität wartet nicht von allein",
    preheader: "3 Minuten Antrag, dann übernimmt Ihr persönliches Team.",
    titel: "Der erste Schritt ist der kleinste",
    heroKarte: true,
    absaetze: [
      "Guten Tag {{params.vorname}}, Sie haben sich bei FIAON umgesehen — und dann kam vermutlich der Alltag dazwischen. Völlig normal. Nur: Von allein verbessert sich eine Bonität nicht.",
      "Was wir für Sie tun, sobald Ihr Antrag da ist: Auskunft holen, jeden Eintrag prüfen, angreifbare Einträge anschreiben — mit einem persönlichen Ansprechpartner, der Sie durch jeden Schritt führt. Sie sehen alles live in Ihrem eigenen Bereich.",
      "Der Antrag dauert keine drei Minuten. Alles Weitere übernehmen wir.",
    ],
    knopf: { text: "Jetzt Antrag starten", url: "{{params.antrag_url}}" },
    fussnote: "Lieber erst sprechen? Antworten Sie auf diese E-Mail — wir rufen Sie zurück.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  lead_application_link: {
    betreff: "Ihr persönlicher Antrags-Link, {{params.vorname}}",
    preheader: "Wie besprochen: Ihr direkter Weg zum Antrag.",
    titel: "Wie besprochen: Ihr Link",
    absaetze: [
      "Guten Tag {{params.vorname}}, wie im Gespräch mit {{params.agent_name}} vereinbart, kommt hier Ihr persönlicher Antrags-Link.",
      "Er führt Sie direkt in den Antrag — keine drei Minuten, und Ihre Akte ist bei uns. Danach übernehmen wir: Auskunft, Prüfung, nächste Schritte.",
    ],
    knopf: { text: "Antrag jetzt ausfüllen", url: "{{params.antrag_url}}" },
    fussnote: "Der Link ist persönlich für Sie erstellt — bitte nicht weitergeben.",
    karteZiel: true,
  },
};
