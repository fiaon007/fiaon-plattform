// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: TERMINE (6) — Absender „FIAON Welcome"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · Termin-Mails nennen Datum, Uhrzeit und Gesprächspartner im Datenkasten —
//   das ist, was der Kunde sucht, wenn er die Mail später wieder öffnet.
// · Der No-Show-Ton ist verständnisvoll, nie vorwurfsvoll: Wer sich schämt,
//   bucht nicht neu.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const TERMIN_VORLAGEN: Record<string, MailBaustein> = {

  termin_bestaetigung: {
    betreff: "Ihr Termin steht: {{params.termin_datum}}, {{params.termin_uhrzeit}} Uhr",
    preheader: "Bestätigt. {{params.agent_vorname}} ruft Sie an — Sie müssen nichts tun.",
    titel: "Ihr Termin ist gebucht",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, Ihr Termin ist fest eingetragen — hier alles auf einen Blick:",
      "<b>{{params.agent_vorname}}</b> ruft Sie zur vereinbarten Zeit an. Sie brauchen nichts vorzubereiten — halten Sie einfach Ihr Telefon bereit. {{params.hinweis_anruf}}",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr" },
      { label: "Ihr Gesprächspartner", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    fussnote: "{{params.hinweis_absage}}",
  },

  termin_erinnerung: {
    betreff: "Morgen: Ihr Gespräch um {{params.termin_uhrzeit}} Uhr",
    preheader: "Kurze Erinnerung — {{params.agent_vorname}} ruft Sie an.",
    titel: "Ihr Gespräch steht bevor",
    absaetze: [
      "Guten Tag {{params.vorname}}, nur eine kurze Erinnerung: Ihr Gespräch mit <b>{{params.agent_vorname}}</b> steht an. Wir rufen Sie an — Sie müssen nichts weiter tun.",
      "Passt die Zeit doch nicht mehr? Verschieben ist völlig in Ordnung und dauert einen Klick — das ist uns lieber als ein verpasster Anruf. {{params.hinweis_anruf}}",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr" },
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    fussnote: "{{params.hinweis_absage}}",
  },

  termin_absage: {
    betreff: "Ihr Termin am {{params.termin_datum}} wurde abgesagt",
    preheader: "Der Termin entfällt — mit einem Klick wählen Sie einen neuen.",
    titel: "Ihr Termin wurde abgesagt",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, Ihr Termin ({{params.termin_art}}) am <b>{{params.termin_datum}} um {{params.termin_uhrzeit}} Uhr</b> wurde von unserer Seite abgesagt — das tut uns leid.",
      "Ihre Akte wartet deshalb nicht: Wählen Sie einfach direkt einen neuen Termin, der Ihnen passt — der Kalender zeigt Ihnen alle freien Zeiten.",
    ],
    knopf: { text: "Neuen Termin wählen", url: "{{params.neu_buchen_link}}" },
  },

  termin_verpasst: {
    betreff: "Wir haben Sie verpasst, {{params.vorname}}",
    preheader: "Kein Problem — suchen Sie sich einfach eine neue Zeit aus.",
    titel: "Wir haben uns verpasst",
    absaetze: [
      "Guten Tag {{params.vorname}}, {{params.agent_vorname}} hat versucht, Sie zu Ihrem Termin am <b>{{params.termin_datum}} um {{params.termin_uhrzeit}} Uhr</b> zu erreichen — leider ohne Erfolg.",
      "Das passiert, kein Grund zur Sorge. Wichtig ist nur: Das Gespräch bringt Ihre Akte wirklich voran, deshalb lohnt sich ein neuer Anlauf. Suchen Sie sich einfach die nächste Zeit aus, die sicher passt.",
    ],
    knopf: { text: "Neuen Termin wählen", url: "{{params.termin_link}}" },
    fussnote: "Der Kalender zeigt nur Zeiten, die wirklich frei sind — Sie können nichts falsch machen.",
  },

  nicht_erreicht_termin: {
    betreff: "Wir erreichen Sie nicht — wählen Sie Ihre Zeit selbst",
    preheader: "Zwei Anrufe, kein Glück. Ein Klick, und der Termin gehört Ihnen.",
    titel: "Sagen Sie uns, wann es passt",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, {{params.agent_vorname}} hat zweimal versucht, Sie telefonisch zu erreichen — bisher ohne Glück.",
      "Machen wir es andersherum: Sie wählen die Zeit, wir rufen pünktlich an. Im Kalender sehen Sie alle freien Termine — ein Klick, und die Sache ist fest.",
    ],
    knopf: { text: "Meine Zeit auswählen", url: "{{params.termin_link}}" },
    fussnote: "Das Gespräch dauert etwa fünfzehn Minuten und bringt Ihre Akte den nächsten großen Schritt voran.",
    karteZiel: true,
  },

  onboarding_einladung: {
    betreff: "Ihr Startgespräch, {{params.vorname}} — wählen Sie Ihre Zeit",
    preheader: "15 Minuten, die Ihre Akte in Bewegung setzen. Jetzt Termin wählen.",
    titel: "Zeit für Ihr Startgespräch",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihr Bereich ist offen, Ihre Akte liegt bereit — jetzt fehlt nur noch das Startgespräch: fünfzehn Minuten mit Ihrem persönlichen Ansprechpartner.",
      "Darin gehen wir gemeinsam durch, was in Ihrer Auskunft steht, welche Einträge angreifbar sind und was die nächsten Schritte sind. Danach wissen Sie genau, woran Sie sind — und wir legen los.",
    ],
    knopf: { text: "Startgespräch buchen", url: "{{params.termin_link}}" },
    fussnote: "Der Kalender zeigt alle freien Zeiten. Wir rufen Sie zur gewählten Zeit an.",
    karteZiel: true,
  },
};
