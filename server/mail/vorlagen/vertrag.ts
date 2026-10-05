// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DIE VERTRAGSBESTÄTIGUNG DES NEUEN ANTRAGS (05.10.2026, E-282)
//
// Nach „Zahlungspflichtig annehmen“ auf /antrag-neu bekommt der Kunde seinen
// Vertrag auf einem dauerhaften Datenträger (§ 312f Abs. 2 BGB): diese Mail mit
// dem Vertrags-PDF als Anhang (Leistungsbeschreibung, Widerrufsbelehrung,
// Muster-Widerrufsformular, Nachweis der Annahme). Versand und PDF:
// server/lib/fiaon-antrag-neu-bestaetigung.ts — immer direkt über den Motor,
// weil Make keine Anhänge trägt.
//
// Schreibregeln: siehe konto.ts. Dazu für diese Mail:
// · Kein Versprechen einer Karte oder eines Limits. Das Ziel-Limit steht im
//   Datenkasten als das, was es ist: die Angabe des Kunden (Vertrag § 2 Abs. 2).
// · Die AGB stehen NICHT im Anhang (es gibt im Haus keine druckbare Fassung,
//   nur die Seite fiaon.com/agb). Der Vertrag sagt in Anlage 3, dass sie der
//   Bestätigungsmail als Link beiliegen — genau das tut Absatz 2.
// · Seit 05.10.2026 (E-283) führt der Link auf die Fassung DIESES Vertrags
//   (fiaon.com/agb/<agb_fassung der Annahme>), nicht auf die jeweils neueste:
//   Wer die Mail in einem Jahr öffnet, liest die Bedingungen, die er angenommen
//   hat. Die Adresse baut agbAdresse (shared/fiaon-vertrag-paket.ts).
// · Der Beginn hängt am Wunsch nach sofortigem Beginn (Vertrag § 6). Mit ihm
//   beginnt alles mit der ersten Rate, und bei einem Widerruf ist Wertersatz
//   fällig. Ohne ihn öffnet sich das Konto (Kundenbereich) zwar mit der ersten
//   Rate, die Leistungen des Pakets beginnen aber erst nach Ablauf der
//   Widerrufsfrist. Beide Sätze stehen unten in VERTRAG_BEGINN_SATZ; die
//   Nutzlast bringt den passenden mit. Ändert sich § 6, ändern sie sich mit.
// · Nur Platzhalter, die die Nutzlast WIRKLICH mitschickt (Beispiel in
//   server/make-events-registry.ts, Bau in bestaetigungNutzlast).
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

/**
 * Der Satz zum Beginn — je nachdem, ob der Kunde den sofortigen Beginn verlangt hat.
 * Sinngleich mit § 6 des Vertrags (shared/fiaon-antrag-neu-vertrag.ts, Vertragsfassung PV-2026-10-05).
 */
export const VERTRAG_BEGINN_SATZ = {
  sofort: "Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen. Ihr Konto wird deshalb mit Eingang der ersten Monatsrate aktiv; widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag.",
  nachFrist: "Ihr Konto wird mit Eingang der ersten Monatsrate aktiv. Mit den Leistungen Ihres Pakets beginnen wir nach Ablauf der Widerrufsfrist.",
} as const;

export const VERTRAG_VORLAGEN: Record<string, MailBaustein> = {
  vertrag_bestaetigung: {
    betreff: "Ihr FIAON-Vertrag – Bestätigung und Unterlagen",
    preheader: "Ihr Vertrag vom {{params.angenommen_datum}} als PDF – mit Leistungsbeschreibung und Widerrufsbelehrung.",
    // Nicht „Ihr Vertrag ist bestätigt“: Die Wortwand (shared/fiaon-wortverbote.ts) liest „Vertrag … bestätigt“
    // als Zusage einer Handlung. Der Titel benennt, was die Mail IST.
    titel: "Ihre Vertragsbestätigung",
    marke: "Vertragspost",
    absaetze: [
      "{{params.anrede_zeile}}, vielen Dank für Ihr Vertrauen. Hiermit bestätigen wir Ihren Vertrag über <b>{{params.paket}}</b>, den Sie am {{params.angenommen_datum}} um {{params.angenommen_uhrzeit}} Uhr angenommen haben.",
      "Im Anhang finden Sie Ihren Vertrag mit Leistungsbeschreibung, der Widerrufsbelehrung und dem Muster-Widerrufsformular. Ergänzend gelten unsere Allgemeinen Geschäftsbedingungen in der Fassung vom {{params.agb_fassung_text}}; Sie können sie unter <a href=\"https://{{params.agb_adresse}}\" style=\"color:#1d4ed8;\">{{params.agb_adresse}}</a> jederzeit abrufen und speichern.",
      "Sie können den Vertrag binnen 14 Tagen ohne Angabe von Gründen widerrufen – eine E-Mail an {{params.widerruf_email}} genügt. Die Einzelheiten stehen in der Widerrufsbelehrung im Anhang.",
      "{{params.beginn_satz}} Die Zahlungsdaten erhalten Sie in einer separaten E-Mail.",
    ],
    daten: [
      { label: "Vertragsnummer", wert: "{{params.antrag_id}}" },
      { label: "Paket", wert: "{{params.paket}}" },
      { label: "Ihr Ziel-Limit", wert: "{{params.ziel_limit_text}}" },
      { label: "Monatliche Rate", wert: "{{params.rate_text}}" },
      { label: "Erstlaufzeit", wert: "12 Monate, gesamt {{params.gesamt_text}}" },
    ],
    fussnote: "Bitte bewahren Sie diese E-Mail und das PDF im Anhang auf – es ist Ihre Ausfertigung des Vertrags.",
  },
};
