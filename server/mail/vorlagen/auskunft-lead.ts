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

  // Justins Korrektur 28.08.: WIR holen die Auskunft für den Kunden ein und
  // laden sie in seinen Bereich — der Kunde muss NICHTS hochladen. Die alte
  // Fassung ("Bitte laden Sie hoch") beschrieb den falschen Weg.
  schufa_requested: {
    betreff: "Wir holen jetzt Ihre Bonitätsauskunft ein",
    preheader: "Sie müssen nichts tun — wir erledigen das für Sie.",
    titel: "Ihre Auskunft ist beauftragt",
    absaetze: [
      "Guten Tag {{params.vorname}}, wir haben Ihre Bonitätsauskunft für Sie beauftragt — damit beginnt der wichtigste Teil der Arbeit: schwarz auf weiß sehen, was über Sie gespeichert ist.",
      "Das Beste daran: <b>Sie müssen nichts tun.</b> Wir holen die Auskunft für Sie ein. Sobald sie da ist, laden wir sie direkt in Ihren Bereich hoch — und Sie bekommen sie zusätzlich per E-Mail, mit einer genauen Anleitung, was jeder Eintrag bedeutet und was wir als Nächstes damit tun.",
      "Danach prüfen wir jeden einzelnen Eintrag: Stimmt er? Ist er verjährt? Ist er angreifbar? Das Ergebnis bespricht Ihr Ansprechpartner Schritt für Schritt mit Ihnen.",
    ],
    daten: [
      { label: "Was Sie jetzt tun müssen", wert: "Nichts — wir melden uns" },
      { label: "Dauer in der Regel", wert: "wenige Werktage" },
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
  // E-210 (22.09.2026): Anrede aus shared/fiaon-anrede.ts statt „Guten Tag {{params.vorname}}" —
  // der Rohwert stand als „Guten Tag max," und bei leerem Vornamen als „Guten Tag , …" in der Mail.
  lead_followup: {
    betreff: "Ihre Bonität wartet nicht von allein",
    preheader: "Wenige Minuten Antrag, dann übernimmt Ihr persönliches Team.",
    titel: "Der erste Schritt ist der kleinste",
    heroKarte: true,
    absaetze: [
      "{{params.anrede}} Sie haben sich bei FIAON umgesehen — und dann kam vermutlich der Alltag dazwischen. Völlig normal. Nur: Von allein verbessert sich eine Bonität nicht.",
      "Was wir für Sie tun, sobald Ihr Antrag da ist: Auskunft holen, jeden Eintrag prüfen, angreifbare Einträge anschreiben — mit einem persönlichen Ansprechpartner, der Sie durch jeden Schritt führt. Sie sehen alles live in Ihrem eigenen Bereich.",
      "Der Antrag dauert nur wenige Minuten, und Ihre Angaben aus der Anfrage sind schon eingetragen. Alles Weitere übernehmen wir.",
    ],
    knopf: { text: "Jetzt Antrag starten", url: "{{params.antrag_url}}" },
    fussnote: "Lieber erst sprechen? Antworten Sie auf diese E-Mail — wir rufen Sie zurück.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  // E-210 (22.09.2026): Die Antwort auf das eben abgeschickte Werbeformular — EINE Mail statt
  // der zwei aus Make (Gmail + Brevo-Vorlage 9, beide mit Wortverstößen und fest „Schönen guten
  // Abend"). Sie trägt den persönlichen Link: Was der Mensch uns gegeben hat, steht im Antrag
  // schon drin. Anrede, Betreff und Einstieg baut der Server (server/lib/fiaon-lead-willkommen.ts),
  // damit ein unbrauchbarer Name nie in der Mail steht und nachgeholte Leads ehrlich begrüßt werden.
  lead_willkommen: {
    betreff: "{{params.betreff}}",
    preheader: "Ihre Angaben sind schon eingetragen — der Rest dauert nur wenige Minuten.",
    titel: "Ihr Antrag ist vorbereitet",
    heroKarte: true,
    absaetze: [
      "{{params.anrede}} {{params.einstieg}}",
      "So geht es weiter: Sie wählen Ihr Paket und ergänzen ein paar Angaben — das dauert nur wenige Minuten. Danach holen wir Ihre Bonitätsauskunft, erklären jeden Eintrag in verständlichen Worten und übernehmen die Schreiben an die Auskunfteien. Eine feste Ansprechperson begleitet Sie, angefangen mit einem kurzen Startgespräch am Telefon.",
    ],
    knopf: { text: "Antrag fortsetzen", url: "{{params.antrag_url}}" },
    fussnote: "Lieber erst sprechen? Antworten Sie einfach auf diese E-Mail. Der Link ist persönlich für Sie erstellt — bitte nicht weitergeben.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  lead_application_link: {
    betreff: "Ihr persönlicher Antrags-Link",
    preheader: "Wie besprochen: Ihr direkter Weg zum Antrag.",
    titel: "Wie besprochen: Ihr Link",
    absaetze: [
      "{{params.anrede}} wie im Gespräch mit {{params.agent_name}} vereinbart, kommt hier Ihr persönlicher Antrags-Link.",
      "Er führt Sie direkt in den Antrag, Ihre Angaben sind schon eingetragen — nur wenige Minuten, und Ihre Akte ist bei uns. Danach übernehmen wir: Auskunft, Prüfung, nächste Schritte.",
    ],
    knopf: { text: "Antrag jetzt ausfüllen", url: "{{params.antrag_url}}" },
    fussnote: "Der Link ist persönlich für Sie erstellt — bitte nicht weitergeben.",
    karteZiel: true,
  },
};
