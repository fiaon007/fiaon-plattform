// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WAS DER GESPRÄCHSKALENDER DEM UNTERNEHMEN SAGT (17.09.2026, E-188)
//
// Jeder Satz, den die Routen unter /api/fiaon/global an die Seite zurückgeben,
// steht hier — deutsch in Sie-Form, englisch in britischem Englisch. Nicht im
// Quelltext der Route verstreut, aus einem Grund: Das Prüfskript
// (scripts/pruef-global-termin.ts) schickt JEDEN dieser Sätze durch die
// Wortwand (shared/fiaon-wortverbote.ts). Ein Satz, der in einer Route steht,
// wird beim nächsten Umformulieren nicht mehr geprüft.
//
// WORTWAHL: Auf der Website heißt es „Gespräch vereinbaren" — das Wort, das
// Justin im Auftrag benutzt hat, ist für Kundentexte gesperrt (FIAON berät
// nicht). Keine Frist mit Ziffer, kein Versprechen über den Ausgang.
//
// „WIR RUFEN SIE AN" ist für die Wortwand eine ZUSAGE, die ein Werkzeug decken
// muss. Hier deckt sie der Auftrag an die zuständige Person, den Buchung und
// Anfrage im selben Lauf anlegen (auftragFuerKunden) — das Prüfskript prüft
// deshalb mit der Deckung „aufgabe_an_betreuer".
// ═══════════════════════════════════════════════════════════════════════════

export interface GlobalTerminTexte {
  fehlerLaden: string;
  fehlerServer: string;
  fehlerZuSchnell: string;
  fehlerZeitWaehlen: string;
  fehlerName: string;
  fehlerFirma: string;
  fehlerEmail: string;
  fehlerTelefon: string;
  zeitVergeben: string;
  zeitVergebenKeineWeitere: string;
  keinAngebot: string;
  /** Platzhalter: {datum}, {uhrzeit}. */
  schonGebucht: string;
  /** Antwort auf die Anfrage. Platzhalter: {name} — die Person, bei der der Auftrag liegt. */
  anfrageDanke: string;
  /** Dieselbe Antwort, wenn der Auftrag (noch) bei niemandem mit Namen liegt. */
  anfrageDankeOhneName: string;
}

export const GLOBAL_TEXTE: { de: GlobalTerminTexte; en: GlobalTerminTexte } = {
  de: {
    fehlerLaden: "Die freien Zeiten konnten nicht geladen werden. Bitte laden Sie die Seite neu.",
    fehlerServer: "Da ist bei uns etwas schiefgelaufen — nicht bei Ihnen. Bitte versuchen Sie es noch einmal.",
    fehlerZuSchnell: "Bitte versuchen Sie es in einer Minute noch einmal.",
    fehlerZeitWaehlen: "Bitte wählen Sie zuerst eine Zeit.",
    fehlerName: "Bitte geben Sie Ihren Namen an.",
    fehlerFirma: "Bitte geben Sie Ihr Unternehmen an.",
    fehlerEmail: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
    fehlerTelefon: "Bitte geben Sie eine Telefonnummer an — wir rufen Sie an.",
    zeitVergeben: "Diese Zeit ist gerade vergeben worden — bitte wählen Sie eine andere.",
    zeitVergebenKeineWeitere: "Diese Zeit ist gerade vergeben worden, und im Moment ist keine weitere frei. Bitte senden Sie uns Ihre Anfrage — wir rufen Sie an.",
    keinAngebot: "Im Moment ist keine Zeit frei. Bitte senden Sie uns Ihre Anfrage — wir rufen Sie an.",
    schonGebucht: "Sie haben bereits ein Gespräch am {datum} um {uhrzeit} Uhr. Zum Verschieben nutzen Sie bitte den Link in Ihrer Bestätigungs-E-Mail.",
    anfrageDanke: "Danke — Ihre Anfrage ist angekommen. {name} ruft Sie an.",
    anfrageDankeOhneName: "Danke — Ihre Anfrage ist angekommen. Wir rufen Sie an.",
  },
  en: {
    fehlerLaden: "The available times could not be loaded. Please reload the page.",
    fehlerServer: "Something went wrong on our side — not yours. Please try again.",
    fehlerZuSchnell: "Please try again in a minute.",
    fehlerZeitWaehlen: "Please choose a time first.",
    fehlerName: "Please enter your name.",
    fehlerFirma: "Please enter your company.",
    fehlerEmail: "Please enter a valid email address.",
    fehlerTelefon: "Please enter a phone number — we will call you.",
    zeitVergeben: "This time has just been taken — please choose another.",
    zeitVergebenKeineWeitere: "This time has just been taken and no other time is free at the moment. Please send us your request and we will call you.",
    keinAngebot: "No time is free at the moment. Please send us your request and we will call you.",
    schonGebucht: "You already have a call booked on {datum} at {uhrzeit} (German time). To reschedule, please use the link in your confirmation email.",
    anfrageDanke: "Thank you — your request has arrived. {name} will call you.",
    anfrageDankeOhneName: "Thank you — your request has arrived. We will call you.",
  },
};

/** Setzt {platzhalter} ein. Ein fehlender Wert bleibt sichtbar leer, nie „undefined". */
export function globalText(satz: string, werte: Record<string, string | null | undefined> = {}): string {
  return satz.replace(/\{([a-z_]+)\}/g, (_, k: string) => String(werte[k] ?? ""));
}
