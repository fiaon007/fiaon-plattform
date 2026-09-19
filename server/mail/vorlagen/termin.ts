// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: TERMINE (7) — Absender „FIAON Welcome"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · Termin-Mails nennen Datum, Uhrzeit und Gesprächspartner im Datenkasten —
//   das ist, was der Kunde sucht, wenn er die Mail später wieder öffnet.
// · Der No-Show-Ton ist verständnisvoll, nie vorwurfsvoll: Wer sich schämt,
//   bucht nicht neu.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

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

  // ── E-188 (17.09.2026): DIE BESTÄTIGUNG FÜR DAS ERSTGESPRÄCH ZU FIAON GLOBAL ──
  // Eine eigene Vorlage und nicht `termin_bestaetigung`: Die spricht einen
  // Privatkunden an („Ihre Akte", Vor- und Nachname aus der Person). Hier liest
  // ein Unternehmen, das über ein Paket ab 2.499 € sprechen will — es sieht
  // Firma und Paketwunsch im Datenkasten und erfährt in einem Satz, worum es in
  // den 30 Minuten geht. Zwei Grenzen der Wortwahl stehen im Text selbst:
  // FIAON „bespricht" und „erklärt" (das Wort aus Justins Auftrag ist für
  // Kundentexte gesperrt), und über Konto, Karte und Rahmen entscheidet das
  // Institut. Der zweite Knopf trägt die Kalenderdatei — als LINK, weil die
  // Vorlagen-Mails des Hauses keine Anhänge tragen (mailDirektSenden).
  //
  // Querschnitt 17.09.2026: Kopf- und Rechtssatz der Global-Linie. Bis dahin trug
  // diese Mail den Privatkunden-Rahmen — „Bonität ist machbar." im Kopf und im Fuß
  // „… verspricht keine Löschung berechtigter Einträge": beides falsch gegenüber
  // einem Unternehmen, das über eine US-Gesellschaft sprechen will. Die englische
  // Fassung steht unten (GLOBAL_TERMIN_EN); der Motor nimmt sie, wenn die Nutzlast
  // `sprache: "en"` trägt (wer auf /en/business bucht).
  global_termin: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
    betreff: "Ihr Gespräch zu FIAON Global: {{params.termin_datum}}, {{params.termin_uhrzeit}} Uhr",
    preheader: "Bestätigt. {{params.agent_vorname}} ruft Sie an — Sie müssen nichts vorbereiten.",
    titel: "Ihr Gespräch ist eingetragen",
    absaetze: [
      "Guten Tag {{params.name}}, Ihr Erstgespräch zu FIAON Global ist fest eingetragen — hier alles auf einen Blick:",
      "<b>{{params.agent_vorname}}</b> ruft Sie zur vereinbarten Zeit unter {{params.telefon}} an. Das Gespräch dauert rund {{params.termin_dauer}} Minuten; Sie brauchen nichts vorzubereiten.",
      "Wir besprechen, wo Ihr Unternehmen heute steht, welchen Rahmen Sie anstreben und welches Paket dazu passt — und was wir dafür übernehmen. Über Konto, Karte und Rahmen entscheidet das jeweilige Institut.",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr (deutsche Zeit)" },
      { label: "Unternehmen", wert: "{{params.firma}}" },
      { label: "Paketwunsch", wert: "{{params.paket}}" },
      { label: "Ihr Gesprächspartner", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "In den Kalender eintragen", url: "{{params.kalender_url}}" },
    knopf2: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    fussnote: "Passt es doch nicht? Über „Termin verschieben oder absagen“ sagen Sie jederzeit ab und wählen auf fiaon.com/business eine neue Zeit.",
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

// ── E-188, Querschnitt: die englische Bestätigung des Erstgesprächs ──────────
// Gleicher Aufbau, gleiche Platzhalter, gleiche Knöpfe wie `global_termin` oben —
// britisches Englisch, dieselben Grenzen (das Institut entscheidet; FIAON
// „discusses" und „explains"). scripts/pruef-global-querschnitt.ts vergleicht das Paar.
// Die Seite hinter „Reschedule or cancel" und die Kalenderdatei sind noch deutsch.
export const GLOBAL_TERMIN_EN: Record<string, MailBaustein> = {
  global_termin: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
    betreff: "Your call about FIAON Global: {{params.termin_datum}}, {{params.termin_uhrzeit}}",
    preheader: "Confirmed. {{params.agent_vorname}} will call you — there is nothing to prepare.",
    titel: "Your call is booked",
    absaetze: [
      "Dear {{params.name}}, your first call about FIAON Global is firmly booked — here is everything at a glance:",
      "<b>{{params.agent_vorname}}</b> will call you at the agreed time on {{params.telefon}}. The call takes around {{params.termin_dauer}} minutes; there is nothing you need to prepare.",
      "We discuss where your company stands today, which limit you are aiming for and which package fits — and what we take on for it. The institution decides on the account, the card and the limit.",
    ],
    daten: [
      { label: "Call", wert: "{{params.termin_art}}" },
      { label: "Date", wert: "{{params.termin_datum}}" },
      { label: "Time", wert: "{{params.termin_uhrzeit}} (German time)" },
      { label: "Company", wert: "{{params.firma}}" },
      { label: "Package of interest", wert: "{{params.paket}}" },
      { label: "Your contact", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "Add to calendar", url: "{{params.kalender_url}}" },
    knopf2: { text: "Reschedule or cancel", url: "{{params.storno_link}}" },
    fussnote: "Does the time no longer suit you? Use “Reschedule or cancel” at any time and choose a new slot at fiaon.com/en/business.",
  },
};
