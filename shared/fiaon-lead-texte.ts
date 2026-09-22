// ═══════════════════════════════════════════════════════════════════════════
// DIE FESTEN TEXTE DES LEAD-MOTORS (22.09.2026, E-210) — ENTWÜRFE ZUR FREIGABE
//
// Eine Quelle für: das Einwilligungs-Kästchen im Meta-Formular und die
// WhatsApp-Vorlagen (Phase 2). Das Steuerpult zeigt sie als Vorschau, der
// Prüfstand (scripts/pruef-lead-motor.ts) prüft jeden Satz gegen die
// Wortwand, die Wörter der Lead-Strecke, die Sie-Wand und die Emoji-Wand.
//
// ── REGELN, DIE HIER GELTEN ────────────────────────────────────────────────
// · Sie, immer. Keine Emojis, keine Sternchen (Justin 21.09.).
// · Mara gibt sich in der ERSTEN Nachricht als digitale Assistentin zu
//   erkennen (KI-Verordnung Art. 50, gilt seit 02.08.2026) und nennt den Weg
//   zum Menschen (WhatsApp-Richtlinie: Eskalation Pflicht).
// · Nie Mahnung, nie Inkasso über WhatsApp (Richtlinie: „debt collection").
// · Karte nur als Ziel — der eine Satz KARTE_SATZ (server/mail/geruest.ts).
// · Meta verbietet eine Variable am Anfang oder Ende des Textes → „Hallo {{1}},"
//   und der Text endet mit Worten. {{1}} ist der Name aus anredeChat ohne
//   „Hallo" („Maria Muster", „Frau Muster") — ohne brauchbaren Namen
//   „und willkommen" („Hallo und willkommen, …").
// · Knopftexte höchstens 25 Zeichen (Meta).
// ═══════════════════════════════════════════════════════════════════════════

/** Der Text für das Pflicht-Kästchen („Benutzerdefinierter Haftungsausschluss") im Meta-Formular. */
export const EINWILLIGUNG_KAESTCHEN =
  "Ja, die FIAON LTD darf mich zu meiner Anfrage und meinem Antrag – auch mit Erinnerungen – per WhatsApp, SMS, E-Mail und Telefon kontaktieren. "
  + "Ich kann das jederzeit widerrufen, z. B. mit „STOPP“ auf WhatsApp oder über den Abmeldelink.";

/** Der Name für {{1}} — ohne brauchbaren Namen „und willkommen". */
export function vorlagenName(anredeChatZeile: string): string {
  const rest = anredeChatZeile.replace(/^Hallo\s*/, "").replace(/,\s*$/, "").trim();
  return rest || "und willkommen";
}

export type WaKnopf =
  | { typ: "URL"; text: string; url: string; beispiel: string }
  | { typ: "QUICK_REPLY"; text: string };

export interface WaVorlage {
  /** Name bei Meta (klein, Unterstriche). */
  name: string;
  kategorie: "UTILITY" | "MARKETING";
  /** Wofür — für das Steuerpult. */
  zweck: string;
  /** Wann sie rausgeht. */
  wann: string;
  text: string;
  /** Beispielwerte für {{1}}, {{2}} … (Meta verlangt sie bei der Einreichung). */
  beispiele: string[];
  knoepfe: WaKnopf[];
}

const LINK: WaKnopf = { typ: "URL", text: "Antrag öffnen", url: "https://fiaon.com/a/{{1}}", beispiel: "https://fiaon.com/a/Ab3dEf7hJk/w" };
const WEITER: WaKnopf = { typ: "URL", text: "Antrag fortsetzen", url: "https://fiaon.com/a/{{1}}", beispiel: "https://fiaon.com/a/Ab3dEf7hJk/w" };
const RUECKRUF: WaKnopf = { typ: "QUICK_REPLY", text: "Bitte rufen Sie mich an" };
const FRAGE: WaKnopf = { typ: "QUICK_REPLY", text: "Ich habe eine Frage" };
const STOPP: WaKnopf = { typ: "QUICK_REPLY", text: "Keine Nachrichten mehr" };

export const WA_VORLAGEN: WaVorlage[] = [
  {
    name: "fiaon_anfrage_eingang",
    kategorie: "UTILITY",
    zweck: "Die erste Nachricht nach dem Formular — mit KI-Hinweis und dem Weg zum Menschen.",
    wann: "Sekunden nach dem Formular (nur mit WhatsApp-Einwilligung).",
    text: "Hallo {{1}}, hier ist Mara, die digitale Assistentin von FIAON. Ihre Anfrage ist angekommen, und Ihr Antrag ist schon vorbereitet – Ihre Angaben sind eingetragen. "
      + "Über den Knopf geht es direkt weiter. Fragen beantworte ich Ihnen hier jederzeit, und auf Wunsch spricht ein Mensch aus unserem Team mit Ihnen.",
    beispiele: ["Maria Muster"],
    knoepfe: [LINK, RUECKRUF, FRAGE],
  },
  {
    name: "fiaon_erinnerung_abend",
    kategorie: "MARKETING",
    zweck: "Erste Erinnerung, am Abend nach dem Formular.",
    wann: "Tag 1, 19 Uhr — wenn noch kein Antrag begonnen ist.",
    text: "Hallo {{1}}, hier ist noch einmal Mara von FIAON. Ihr Antrag ist weiterhin vorbereitet, es fehlen nur noch wenige Angaben. "
      + "Viele erledigen das in einer ruhigen Minute am Abend. Wenn etwas unklar ist, schreiben Sie mir einfach hier.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, RUECKRUF, STOPP],
  },
  {
    name: "fiaon_erinnerung_ablauf",
    kategorie: "MARKETING",
    zweck: "Erklärt, was nach dem Antrag passiert — mit dem einen Karten-Satz.",
    wann: "Tag 3.",
    text: "Hallo {{1}}, eine Frage, die uns oft gestellt wird: Was passiert nach dem Antrag? Wir holen Ihre Bonitätsauskunft, erklären jeden Eintrag in verständlichen Worten "
      + "und übernehmen die Schreiben an die Auskunfteien – mit einer festen Ansprechperson. "
      + "Ihr Ziel bleibt die eigene Karte: Wir bereiten Ihre Bonität Schritt für Schritt vor – die Entscheidung über eine Karte trifft am Ende immer die Bank.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_erinnerung_gespraech",
    kategorie: "MARKETING",
    zweck: "Bietet ein Gespräch an — der Tipp auf einen Zeitraum legt die Rückruf-Aufgabe an.",
    wann: "Tag 7.",
    text: "Hallo {{1}}, manche Fragen klärt ein kurzes Gespräch schneller als jede Nachricht. Wann passt es Ihnen? "
      + "Tippen Sie auf einen Zeitraum, dann ruft Sie eine Person aus unserem Team in diesem Zeitraum an.",
    beispiele: ["Maria Muster"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }, STOPP],
  },
  {
    name: "fiaon_erinnerung_offen",
    kategorie: "MARKETING",
    zweck: "Die letzte WhatsApp — danach nur noch E-Mail.",
    wann: "Tag 14.",
    text: "Hallo {{1}}, ich möchte Sie nicht mit Nachrichten stören. Soll Ihre Anfrage offenbleiben? "
      + "Dann bleibt Ihr Antrag vorbereitet, und Sie können jederzeit über den Knopf weitermachen.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, { typ: "QUICK_REPLY", text: "Ja, bitte offenlassen" }, STOPP],
  },
  {
    name: "fiaon_antrag_weiter",
    kategorie: "MARKETING",
    zweck: "Antrag begonnen, aber nicht beendet — zurück an dieselbe Stelle.",
    wann: "30 Minuten nach dem Abbruch (zusätzlich zur Mail-Kette E-023).",
    text: "Hallo {{1}}, Sie waren kurz vor dem Ziel – Ihr Antrag ist gespeichert. "
      + "Über den Knopf geht es genau an der Stelle weiter, an der Sie aufgehört haben.",
    beispiele: ["Maria Muster"],
    knoepfe: [WEITER, FRAGE, STOPP],
  },
  {
    name: "fiaon_rueckruf_verpasst",
    kategorie: "UTILITY",
    zweck: "Nach einem Anrufversuch, der niemanden erreichte.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, wir haben eben versucht, Sie zu erreichen – leider ohne Erfolg. Wann passt es Ihnen besser? "
      + "Tippen Sie auf einen Zeitraum, dann rufen wir Sie in diesem Zeitraum wieder an.",
    beispiele: ["Maria Muster"],
    knoepfe: [{ typ: "QUICK_REPLY", text: "Vormittags" }, { typ: "QUICK_REPLY", text: "Nachmittags" }, { typ: "QUICK_REPLY", text: "Abends" }],
  },
  {
    name: "fiaon_kontakt",
    kategorie: "UTILITY",
    zweck: "Öffnet das Gespräch neu, wenn das 24-Stunden-Fenster geschlossen ist.",
    wann: "Vom Mitarbeiter per Knopf in der Akte.",
    text: "Hallo {{1}}, hier ist {{2}} von FIAON. Ich habe eine kurze Rückfrage zu Ihrem Antrag – antworten Sie einfach auf diese Nachricht.",
    beispiele: ["Maria Muster", "Daniel Stripling"],
    knoepfe: [],
  },
];
