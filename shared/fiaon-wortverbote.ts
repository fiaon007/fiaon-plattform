// ═══════════════════════════════════════════════════════════════════════════
// EINE WAND FÜR ALLE KUNDENTEXTE (02.09.2026, E-094)
//
// Bis heute gab es drei Listen an drei Orten: `entschaerfen` in der Mail-KI
// (11 Muster), `verboteneKundenworte` im Copilot (7 Muster, ohne Wortgrenzen)
// und sechs Teilstrings im Postmeister. Die schwächste davon stand vor den
// automatischen Antworten — 'wir garantieren Ihnen die Karte' wäre
// durchgegangen. Ab hier prüft jeder Kundentext dieselbe Wand.
//
// DREI ARTEN VON TREFFERN:
//   verboten   → darf nie an einen Kunden gehen (Rechtsrisiko, Falschaussage)
//   floskel    → macht die Antwort unpersönlich; wird umformuliert
//   zusage     → verspricht eine Handlung; nur erlaubt, wenn ein Werkzeug sie
//                im selben Lauf wirklich ausgeführt hat
//
// WORTGRENZEN SIND PFLICHT: `/berat/` traf früher auch das Kundenzitat 'Sie
// hatten mir geraten…'. Jedes Muster hier steht auf \b oder auf einer Phrase.
// ═══════════════════════════════════════════════════════════════════════════

export type Verstossart = "verboten" | "floskel" | "zusage";

export interface Wortregel {
  muster: RegExp;
  art: Verstossart;
  /** Was stattdessen gesagt werden soll — geht als Hinweis zurück ans Modell. */
  hinweis: string;
  /** Nur bei art "zusage": Welches Werkzeug die Zusage decken muss. */
  gedecktDurch?: string[];
}

export const WORTREGELN: Wortregel[] = [
  // ── Rechtlich heikel oder schlicht falsch ────────────────────────────────
  { muster: /\bgarant(ie|ier\w*)\b/i, art: "verboten", hinweis: "Nichts garantieren. Sag, was FIAON tut, und dass die Bank oder die Auskunftei entscheidet." },
  { muster: /\b(zusicher\w+|wir versprechen|ich verspreche)\b/i, art: "verboten", hinweis: "Kein Versprechen. Nenne den nächsten Schritt und wer entscheidet." },
  { muster: /\bberat(ung|en|er|ung\w*)\b/i, art: "verboten", hinweis: "FIAON berät nicht. Sag 'wir erklären', 'wir bereiten vor', 'wir übernehmen'." },
  { muster: /\bempfehl\w+\b/i, art: "verboten", hinweis: "Keine Empfehlung aussprechen. Beschreibe die Möglichkeit und überlasse die Wahl." },
  { muster: /sicher\s+klappt|klappt\s+sicher|garantiert\s+gelöscht|garantierte\s+löschung/i, art: "verboten", hinweis: "Ergebnisse sind nie sicher. Beschreibe den Weg, nicht das Ergebnis." },
  { muster: /(verbessern|erhöhen|steigern)\s+(wir\s+)?(ihren|ihre)\s+(score|bonität)/i, art: "verboten", hinweis: "Der Score folgt den Daten. Sag, welche Daten sich ändern." },
  { muster: /\baffiliate\b/i, art: "verboten", hinweis: "Das Wort nie verwenden." },
  { muster: /\bkredit(vermittlung|e?\s+vermitteln)\b/i, art: "verboten", hinweis: "FIAON vermittelt keine Kredite." },
  { muster: /\b(dolmetscher|übersetzungsdienst|live-?chat|telefon-?konferenz)\b/i, art: "verboten", hinweis: "Diese Leistung gibt es bei FIAON nicht — biete stattdessen ein Telefongespräch an." },
  { muster: /\b(geldkarte|karte|pin)\b[\s\S]{0,40}?\b(versenden|zusenden|zuschicken|schicken|senden|zustellung|zustellen)\b/i, art: "verboten", hinweis: "FIAON verschickt keine Karten oder PINs. Die Bank entscheidet und versendet." },
  { muster: /\b(pending_payment|claimed_paid|karteileiche|kein_zugang|wartet_auf_onboarding)\b/i, art: "verboten", hinweis: "Kein internes Wort in einer Kundenmail. Beschreibe den Zustand in normalen Worten." },
  { muster: /innerhalb\s+von\s+\d+\s*(stunden|std|werktagen|tagen)\b/i, art: "verboten", hinweis: "Keine Frist zusagen, die niemand garantiert. Sag 'in der Regel' oder nenne einen Termin." },
  { muster: /\b(datenschutz|recht|legal|info)@fiaon\.com\b/i, art: "verboten", hinweis: "Nur support@fiaon.com und welcome@fiaon.com existieren." },
  { muster: /\bBE09\s?9058|TRWIBEB1/i, art: "verboten", hinweis: "Das ist die gesperrte Bankverbindung. Verlinke die Zahlungsseite." },
  { muster: /\bDE\d{2}[\s\d]{14,}/i, art: "verboten", hinweis: "Keine Bankdaten im Text — verlinke die Zahlungsseite, dort stehen sie immer aktuell." },

  // ── Floskeln, an denen man den Automaten erkennt ─────────────────────────
  { muster: /(stehe?n?\s+(ich|wir)\s+ihnen\s+.{0,25}zur\s+verfügung)/i, art: "floskel", hinweis: "Weglassen. Ende mit dem konkreten nächsten Schritt." },
  { muster: /zögern\s+sie\s+nicht/i, art: "floskel", hinweis: "Weglassen." },
  { muster: /gerne?\s+helfen\s+wir\s+ihnen\s+weiter/i, art: "floskel", hinweis: "Weglassen und stattdessen konkret helfen." },
  { muster: /^(vielen dank für ihre nachricht|ich habe ihre nachricht erhalten|wir haben ihre nachricht (erhalten|zur kenntnis genommen))/im, art: "floskel", hinweis: "Nicht mit einer Eingangsbestätigung beginnen. Geh sofort auf das Anliegen ein." },
  { muster: /bei\s+(weiteren\s+)?(rück)?fragen\s+(stehen|melden)/i, art: "floskel", hinweis: "Weglassen." },

  // ── Zusagen, die ein Werkzeug decken muss ───────────────────────────────
  { muster: /\b(aus\s+(dem|unserem)\s+verteiler\s+(genommen|entfernt|nehmen)|keine\s+(weiteren\s+)?(werbe|angebots)?mails?\s+mehr)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Werbesperre wirklich gesetzt wurde.", gedecktDurch: ["werbesperre_setzen"] },
  { muster: /\b(erinnerungen|mahnungen)\b.{0,30}\b(gestoppt|eingestellt|angehalten|beendet)\b/i, art: "zusage", hinweis: "Nur sagen, wenn der Mahnstopp gesetzt wurde.", gedecktDurch: ["mahnstopp_setzen"] },
  { muster: /\b(weitergeleitet|weiterleiten\s+werde|an\s+die\s+(zuständige\s+)?(abteilung|kollegin|kollegen))\b/i, art: "zusage", hinweis: "Nur sagen, wenn wirklich jemand informiert wurde.", gedecktDurch: ["notiz_an_betreuer", "eskalation_vorbereiten"] },
  { muster: /\b(ruf(t|e|en)?\s+sie(\s+\w+){0,3}\s+an\b|meldet?\s+sich\s+(telefonisch|bei\s+ihnen)|rückruf)/i, art: "zusage", hinweis: "Nur sagen, wenn ein Rückruf eingeplant wurde.", gedecktDurch: ["notiz_an_betreuer"] },
  { muster: /\b(kündigung|vertrag)\b.{0,30}\b(vorgemerkt|vermerkt|aufgenommen|bestätigt|storniert)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Kündigung im System steht.", gedecktDurch: ["kuendigung_vormerken"] },
  { muster: /\b(zugang|bereich|konto)\b.{0,25}\b(freigeschaltet|freigegeben|aktiviert)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Freischaltung ausgeführt wurde.", gedecktDurch: ["konto_freischalten"] },
  { muster: /\b(notiert|vermerkt)\b.{0,20}\b(in\s+ihrer\s+akte|im\s+system)\b/i, art: "zusage", hinweis: "Nur sagen, wenn ein Vermerk geschrieben wurde.", gedecktDurch: ["vermerk_schreiben", "notiz_an_betreuer"] },
];

export interface Wandtreffer { art: Verstossart; treffer: string; hinweis: string; gedecktDurch?: string[] }

/**
 * Prüft einen Kundentext. `ausgefuehrt` sind die Werkzeuge, die im selben Lauf
 * erfolgreich liefen — nur sie decken eine Zusage.
 */
export function wandPruefen(text: string, ausgefuehrt: string[] = []): Wandtreffer[] {
  const t = String(text || "");
  const funde: Wandtreffer[] = [];
  for (const r of WORTREGELN) {
    const m = t.match(r.muster);
    if (!m) continue;
    if (r.art === "zusage" && r.gedecktDurch?.some((w) => ausgefuehrt.includes(w))) continue;
    funde.push({ art: r.art, treffer: m[0].slice(0, 60), hinweis: r.hinweis, gedecktDurch: r.gedecktDurch });
  }
  return funde;
}

/** Harte Treffer verhindern jeden Versand; Floskeln nur den automatischen. */
export function wandUrteil(funde: Wandtreffer[]): { sendbar: boolean; automatisch: boolean } {
  const hart = funde.some((f) => f.art === "verboten" || f.art === "zusage");
  return { sendbar: !hart, automatisch: funde.length === 0 };
}
