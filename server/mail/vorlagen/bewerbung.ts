// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: AN BEWERBER (2) — Absender „FIAON Team" (E-177, 11.09.2026)
//
// Bewerber sind keine Mitarbeiter und meist Kunden — sie werden GESIEZT.
// Schreibregeln wie in konto.ts. Keine Fristen, keine Aussagen über Gehalt,
// Beginn oder Dauer: Das steht im Gespräch und im Vertrag, nicht in einer
// Mail, die vor beidem rausgeht. Kein karteZiel-Block — das ist keine
// Kundenmail über das Produkt.
//
// Nutzlast (server/routes/fiaon-bewerbungen.ts, bewerbungPayload):
//   vorname, nachname, bereich, anstellung, land, ansprechpartner, email.
// Beide Mails werden NUR von Hand ausgelöst — aus der Bewerbungsliste im
// Chefbüro. Die Zusage ist keine Vertragsurkunde; der Zugangslink kommt
// getrennt mit der Mitarbeiter-Einladung (agent_invite, geduzt, weil dann
// Mitarbeiter).
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const BEWERBUNG_VORLAGEN: Record<string, MailBaustein> = {

  bewerbung_zusage: {
    betreff: "Ihre Bewerbung bei FIAON: Wir möchten mit Ihnen arbeiten",
    preheader: "Ihre Einladung in den Arbeitsbereich kommt in einer eigenen E-Mail.",
    titel: "Willkommen im Team",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, vielen Dank für Ihre Bewerbung im Bereich <b>{{params.bereich}}</b>. Wir haben uns entschieden: Wir möchten mit Ihnen arbeiten.",
      "In einer eigenen E-Mail erhalten Sie den Link, mit dem Sie Ihren Zugang zum FIAON-Arbeitsbereich einrichten. Dort beginnt Ihre Einschulung in der Academy, und dort finden Sie Ihre Ansprechperson.",
      "Alles Weitere — Beginn, Umfang, Vergütung — besprechen wir persönlich mit Ihnen. Wenn Sie vorab Fragen haben, antworten Sie einfach auf diese E-Mail.",
    ],
    daten: [
      { label: "Bereich", wert: "{{params.bereich}}" },
      { label: "Zusammenarbeit", wert: "{{params.anstellung}}" },
      { label: "Ihre Ansprechperson", wert: "{{params.ansprechpartner}}" },
    ],
    fussnote: "Diese E-Mail ist keine Vertragsurkunde — der Vertrag folgt nach dem Gespräch.",
    // Ein Mensch hat geklickt — keine „automatisch erstellt"-Zeile.
    persoenlich: true,
  },

  bewerbung_absage: {
    betreff: "Ihre Bewerbung bei FIAON",
    preheader: "Vielen Dank für Ihr Interesse — und eine ehrliche Antwort.",
    titel: "Vielen Dank für Ihre Bewerbung",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, vielen Dank für Ihre Bewerbung im Bereich <b>{{params.bereich}}</b> und für das Vertrauen, das darin steckt.",
      "Wir haben uns diesmal für einen anderen Weg entschieden. Das sagt nichts über Sie als Person — es sagt etwas darüber, was wir im Moment brauchen.",
      "FIAON wächst, und mit dem Wachstum ändern sich die Bereiche. Eine neue Bewerbung ist jederzeit möglich, und wir lesen jede.",
      "Sind Sie Kunde bei FIAON, bleiben Ihr Kundenkonto und Ihre Betreuung davon unberührt.",
    ],
    fussnote: "Ihre Bewerbungsdaten werden nicht weitergegeben.",
    persoenlich: true,
  },
};
