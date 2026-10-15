// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: DIE FIAON FINANZ- UND BONITÄTSAUSWERTUNG IST DA (E-IT-D, 08.10.2026, 4b)
//
// Schreibregeln wie konto.ts: gesiezt, ein Gedanke je Absatz, ein Knopf, keine
// Zusage. OHNE Zahl, Ampel oder Finanzwert im Text — die stehen nur im PDF und
// im Bereich des Kunden (Prüfstand pruef-boni-ampel.ts, „Einsatzort Finanzauswertung").
//
// E-357 (14.10.2026, Justin): „Wenn wir die Bonitätsanalyse machen, muss der Mitarbeiter
// eine E-Mail bekommen (Die Auswertung für Ihren Kunden XY ist da) mit PDF und Link dahin,
// und der Kunde muss eine E-Mail mit PDF und Link bekommen.“ Vorher bewusst ohne Anhang
// (Brevo verlor am 01.10. eine Mail mit fünf Anhängen; Vertragsmails mit einem PDF kommen
// seit dem 05.10. an). Jetzt: das PDF hängt an, der Link bleibt; über 5 MB nur der Link.
// Versand direkt über den Motor (mailDirektSenden, wie die Vertragsbestätigung), Protokoll
// in fiaon_mail_log — server/lib/fiaon-finanzauswertung.ts.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const FINANZAUSWERTUNG_VORLAGEN: Record<string, MailBaustein> = {
  finanzauswertung_bereit: {
    // E-365 (14.10.2026): ein Name überall — „FIAON-Bonitätsauswertung“ (Kauf, Bereich, Mail); das PDF trägt weiter
    // den Deckblatt-Titel „Finanz- und Bonitätsauswertung“. Der nächste Schritt kommt vom Server (naechster_satz).
    betreff: "Ihre FIAON-Bonitätsauswertung liegt bereit, {{params.vorname}}",
    preheader: "Ihre Bonität aus Sicht einer Bank, mit Plan — als PDF und in Ihrem Bereich.",
    titel: "Ihre Bonitätsauswertung ist fertig",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre FIAON-Bonitätsauswertung ist fertig — geprüft und freigegeben von Ihrem FIAON-Team.",
      "Sie zeigt Ihnen Ihre Bonität aus Sicht einer Bank, Bereich für Bereich, wo Sie stehen, jede Ausgabe im Detail und einen Plan mit konkreten Schritten, die Sie selbst umsetzen können — jeweils mit dem, was der Schritt im Monat bewirken kann.",
      "Sie finden sie als PDF im Anhang dieser E-Mail — und jederzeit in Ihrem Bereich über den Knopf unten.",
      "{{params.naechster_satz}}",
      "Noch kein Passwort? Auf der Anmeldeseite lassen Sie sich mit einem Klick einen Anmelde-Link an diese Adresse schicken.",
    ],
    knopf: { text: "Bonitätsauswertung ansehen", url: "{{params.auswertung_url}}" },
    fussnote: "Die Bonitätsauswertung ist eine eigene Berechnung von FIAON aus Ihren Unterlagen — keine Auskunft einer Auskunftei und keine Kredit- oder Kartenzusage. Die Datei enthält vertrauliche Angaben zu Ihren Finanzen; bitte leiten Sie sie nur weiter, wenn Sie das möchten. Fragen dazu? Antworten Sie einfach auf diese E-Mail — Ihre Ansprechperson geht den Bericht gern mit Ihnen durch.",
  },
  // E-357: an den Mitarbeiter (Betreuer und, wenn ein anderer, wer sie erstellt hat), sobald der Entwurf fertig ist.
  finanzauswertung_mitarbeiter: {
    betreff: "Die Bonitätsauswertung für Ihren Kunden {{params.kunde}} ist da",
    preheader: "{{params.nummer}} — PDF im Anhang, Akte mit einem Klick.",
    titel: "Die Auswertung für Ihren Kunden ist da",
    absaetze: [
      "Hallo {{params.vorname}}, die FIAON-Bonitätsauswertung {{params.nummer}} für <b>{{params.kunde}}</b> ist fertig. Das PDF hängt an dieser E-Mail.",
      "{{params.stand_satz}}",
      "Bitte prüfen Sie das PDF kurz, bevor es an den Kunden geht. Die Übergabe machen Sie in der Akte: Überblick → Karte „FIAON Bonitätsauswertung“ → „An den Kunden übergeben“.",
    ],
    knopf: { text: "Akte öffnen", url: "{{params.akte_url}}" },
    fussnote: "Interne Mitteilung der FIAON-Plattform. Das PDF enthält vertrauliche Kundendaten — bitte nicht weiterleiten.",
  },
};
