// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: DIE FIAON FINANZ- UND BONITÄTSAUSWERTUNG IST DA (E-IT-D, 08.10.2026, 4b)
//
// Schreibregeln wie konto.ts: gesiezt, ein Gedanke je Absatz, ein Knopf, keine
// Zusage. Bewusst OHNE Anhang (Brevo verliert Mails mit Anhang still, und die
// Auswertung ist sensibel) und OHNE Zahl, Ampel oder Finanzwert — die stehen
// nur im Bereich des Kunden (Prüfstand pruef-boni-ampel.ts, Abschnitt
// „Einsatzort Finanzauswertung"). Die Mail sagt nur, DASS sie bereitliegt.
// Geht nach der Freigabe in der Akte (server/lib/fiaon-finanzauswertung.ts) über
// mailSenden — Pflichtmail-Weg wie die Vertragsbestätigung, nur über den Motor.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const FINANZAUSWERTUNG_VORLAGEN: Record<string, MailBaustein> = {
  finanzauswertung_bereit: {
    betreff: "Ihre Finanz- und Bonitätsauswertung liegt bereit, {{params.vorname}}",
    preheader: "Ihre persönliche Auswertung mit Plan — sicher in Ihrem Bereich.",
    titel: "Ihre Auswertung ist fertig",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre FIAON Finanz- und Bonitätsauswertung liegt in Ihrem Bereich für Sie bereit.",
      "Sie zeigt Ihnen Bereich für Bereich, wo Sie stehen, und einen Plan mit konkreten Schritten, die Sie selbst umsetzen können — jeweils mit dem, was der Schritt im Monat bewirken kann.",
      "Aus Datenschutzgründen schicken wir die Auswertung nicht als Anhang. Sie öffnen sie über den Knopf in Ihrem Bereich und können sie dort als PDF speichern.",
      "Noch kein Passwort? Auf der Anmeldeseite lassen Sie sich mit einem Klick einen Anmelde-Link an diese Adresse schicken.",
    ],
    knopf: { text: "Auswertung ansehen", url: "{{params.auswertung_url}}" },
    fussnote: "Die Auswertung ist eine eigene Berechnung von FIAON aus Ihren Unterlagen — keine Bonitätsauskunft einer Auskunftei und keine Kredit- oder Kartenzusage. Fragen dazu? Antworten Sie einfach auf diese E-Mail.",
  },
};
