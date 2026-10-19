// ═══════════════════════════════════════════════════════════════════════════
// NACHARBEIT NACH DEM ANRUF (E-406 C2, 19.10.2026) — TEXTPRÜFUNG UND AUFTRAG FÜR MARA
//
// Die Regel (wer, wann, welche Mail) steht in shared/fiaon-mara-nacharbeit.ts. Hier steht, was ein Kundentext dieser
// Mails NIE enthalten darf — dieselben Wände wie die Antwortprüfung des Postmeisters (fiaon-postmeister-agent.ts):
//   · die Wortwand (wandPruefen): keine Garantie, keine Beratung, kein Geld zugesagt, keine Frist, keine Bankdaten,
//     keine ungedeckte Zusage („ruft Sie an“ nur, wenn der Rückruf wirklich im Kalender steht);
//   · E-393 (kuendigungsWand): das Vertragsende hängt nie an einer Zahlung, keine Drohung;
//   · Maras Ton (tonPruefung, hart): kein Vorname eines Mitarbeiters (Nennform „Herr Stripling“), kein Limit,
//     kein ISO-Datum;
//   · E-281/E-373: kein Bank-Vorbehalt („über den Rahmen entscheidet unsere Partnerbank“) — nie im Verkauf;
//   · Sie-Form.
// Für Maras eigene Zeilen (die Zusammenfassung aus der Notiz) zusätzlich: keine Links, kein Kredit-/Kündigungs-/
// Erstattungs-/Rechtsthema, und jede Zahl muss in der Notiz stehen (nichts erfunden).
// Rein — Server und Prüfstand (scripts/pruef-mara-nacharbeit.ts) lesen dieselbe Funktion.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen, kuendigungsWand, kuendigungsBezug } from "./fiaon-wortverbote";
import { tonPruefung, BANK_SATZ_MUSTER } from "./fiaon-mara-ton";
import type { MitarbeiterEintrag } from "./fiaon-mitarbeiter-name";

export interface NacharbeitPruefOpt {
  /** Die Mitarbeiterliste (mitarbeiterListe) — mit ihr trifft ein Vorname allein hart. */
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  /** Vor- und Nachname des Kunden — heißt er selbst „Daniel“, ist das kein Mitarbeiter. */
  kundeNamen?: readonly (string | null | undefined)[];
  /** Zusagen, die wirklich gedeckt sind (Werkzeugnamen der Wortwand) — z. B. der eingetragene Rückruf. */
  gedeckt?: readonly string[];
  /** Die Notiz des Gesprächs — für den Kündigungsbezug und die Belegprüfung. */
  notiz?: string | null;
  /** Maras eigener Teil (die Zusammenfassung) — er wird zusätzlich streng geprüft. */
  kiTeil?: string | null;
}

/** Nur in Maras eigenen Zeilen — Themen, zu denen eine Zusammenfassung schweigt (ein Mensch klärt sie). */
const KI_THEMEN: { muster: RegExp; was: string }[] = [
  { muster: /\bkredit\w*|\bdarlehen\w*/i, was: "Kredit (FIAON vergibt keine Kredite — kein Wort dazu in der Zusammenfassung)" },
  { muster: /\b(?:wunsch)?limit\w*|\bkreditrahmen\b/i, was: "Limit oder Kreditrahmen" },
  { muster: /k(?:ü|ue)ndig\w*|\bstorn\w*|widerruf\w*|vertragsende/i, was: "Kündigung, Storno oder Widerruf" },
  { muster: /erstatt\w*|r(?:ü|ue)ckzahl\w*|zur(?:ü|ue)ckzahl\w*|zur(?:ü|ue)ck(?:ü|ue)berweis\w*|geld\s+zur(?:ü|ue)ck/i, was: "Erstattung oder Rückzahlung" },
  { muster: /anwalt|anw(?:ä|ae)lt\w*|gericht\w*|inkasso|mahn\w*|schufa-?eintrag|negativ(?:e|er)?\s+eintr|rechtliche\s+schritte|polizei/i, was: "Recht, Mahnung oder Inkasso" },
  { muster: /\b(?:akte|status|stufe|lead|ticket|weitergegeben|weitergeleitet|eskal\w*|intern\w*)\b/i, was: "internes Wort" },
  { muster: /https?:\/\/|\bwww\./i, was: "Link (den Knopf setzt der Server)" },
];

/** Alle Zahlen eines Textes als Zahlwerte (ohne führende Nullen). */
function zahlen(t: string): number[] {
  return Array.from(String(t || "").matchAll(/\d+/g)).map((m) => Number(m[0])).filter((n) => Number.isFinite(n));
}

/**
 * Die harte Prüfung eines Kundentexts der Nacharbeit-Mail. Leer = darf raus. Jeder Eintrag ist ein Mangel, der den
 * Versand verhindert (Mara schreibt EINMAL neu; hält auch das nicht, geht nichts raus).
 */
export function nacharbeitTextPruefen(text: string, opt: NacharbeitPruefOpt = {}): string[] {
  const t = String(text ?? "");
  const funde: string[] = [];
  for (const w of wandPruefen(t, Array.from(opt.gedeckt ?? []))) {
    if (w.art === "verboten" || w.art === "zusage") funde.push(`Wortwand: „${w.treffer}“ — ${w.hinweis}`);
  }
  for (const w of kuendigungsWand(t, { bezug: kuendigungsBezug(t, opt.notiz ?? "") })) {
    if (!funde.some((f) => f.includes(w.treffer))) funde.push(`E-393: „${w.treffer}“ — ${w.hinweis}`);
  }
  for (const b of tonPruefung(t, { kanal: "mail", mitarbeiter: opt.mitarbeiter ?? null, kundeNamen: opt.kundeNamen ?? [] })) {
    if (b.schwere === "hart") funde.push(`Ton: „${b.treffer}“ — ${b.hinweis}`);
  }
  const bank = t.match(BANK_SATZ_MUSTER);
  if (bank) funde.push(`Bank-Vorbehalt („${bank[0].slice(0, 60)}“) — nie in dieser Mail (E-281/E-373)`);
  if (/(^|[\s„"(])(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)(?=[\s.,;:!?)"“]|$)/.test(t)) funde.push("Du-Form statt Sie-Form");

  const ki = String(opt.kiTeil ?? "").trim();
  if (ki) {
    for (const th of KI_THEMEN) {
      const m = ki.match(th.muster);
      if (m) funde.push(`Zusammenfassung: „${m[0]}“ — ${th.was}`);
    }
    const belegt = new Set(zahlen(opt.notiz ?? ""));
    const frei = zahlen(ki).filter((n) => !belegt.has(n));
    if (frei.length) funde.push(`Zusammenfassung: Zahl(en) ${frei.slice(0, 3).join(", ")} stehen nicht in der Notiz — nichts erfinden`);
    if (ki.length > 900) funde.push(`Zusammenfassung zu lang (${ki.length} Zeichen) — höchstens vier kurze Sätze`);
    if (/^\s*([-•·–]|\d+[.)])\s+/m.test(ki)) funde.push("Zusammenfassung als Aufzählung — bitte ganze Sätze");
  }
  return funde;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG FÜR MARAS ZUSAMMENFASSUNG („Erreicht – Sonstiges“)
// ═══════════════════════════════════════════════════════════════════════════
export const GESPRAECH_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    senden: { type: "boolean" },
    grund: { type: "string" },
    absaetze: { type: "array", items: { type: "string" } },
  },
  required: ["senden", "grund", "absaetze"],
} as const;

export interface GespraechEin {
  notiz: string;
  /** Wer das Gespräch geführt hat — Nennform (wer?) und (mit/an wem?). */
  mitarbeiterNom: string;
  mitarbeiterDat: string;
  /** Heute, für Menschen („Montag, 19. Oktober“). */
  heute: string;
  /** Ein eingetragener künftiger Termin oder Rückruf („am Mittwoch, 22. Oktober, um 14 Uhr“) — sonst null. */
  termin: string | null;
}

/** Der feste Auftrag (Systemnachricht) — ohne Kundendaten. */
export const GESPRAECH_AUFTRAG = [
  "Du bist Mara, die digitale Assistentin von FIAON. Ein Kollege hat gerade mit einem Kunden telefoniert und dazu eine INTERNE Notiz geschrieben.",
  "Du schreibst daraus für den Kunden eine kurze, freundliche Zusammenfassung des Gesprächs: ein bis drei kurze Absätze, zusammen höchstens vier Sätze, Sie-Form, Deutsch, warm und klar.",
  "Anrede, Dank für das Gespräch und Gruß setzt der Server davor und danach — du schreibst NUR das Besprochene.",
  "HARTE REGELN (der Server prüft jede; ein Verstoß heißt: die Mail geht nicht raus):",
  "1. Nur, was in der Notiz steht. Nichts erfinden, nichts ergänzen. Keine Zahl, kein Datum, keine Uhrzeit, kein Betrag, die nicht in der Notiz stehen.",
  "2. Schreib aus Sicht von FIAON („wir“). Den Kollegen nennst du nur so, wie unten angegeben (wer: …, mit/an: …) — nie mit dem Vornamen allein.",
  "3. Keine Zusagen: nichts garantieren, nichts versprechen, keine Frist („innerhalb von …“), kein „wir melden uns“, kein „ruft Sie an“ — außer es steht unten ein eingetragener Termin, dann nenne genau diesen.",
  "4. Kein Wort zu Kredit, Limit, Rahmen, Kündigung, Storno, Widerruf, Erstattung, Anwalt, Gericht, Inkasso, Mahnung oder SCHUFA-Eintrag, und nie „die Bank entscheidet“.",
  "5. Keine internen Wörter (Akte, Status, Stufe, Lead, Ticket, weitergegeben, eskaliert) und keine Bewertung des Kunden: aus „hat kein Geld“ wird „Sie möchten die Zahlung später leisten“ — nur, wenn die Notiz es so sagt.",
  "6. Keine Links, keine Aufzählung, keine Anrede, kein Gruß, keine Ausrufezeichen-Ketten.",
  "7. Setze senden=false (mit kurzem Grund), wenn die Notiz nichts enthält, was der Kunde schriftlich braucht (nur interne Vermerke), oder wenn sie etwas Heikles berührt (Beschwerde, Streit, Gesundheit, Privates, Geldnot im Detail).",
  "Antworte nur im vorgegebenen JSON-Format: senden, grund, absaetze (Liste der Absätze).",
].join("\n");

/** Die Nutzernachricht mit den Daten dieses Gesprächs. */
export function gespraechNachricht(e: GespraechEin): string {
  return [
    `Kollege (wer?): ${e.mitarbeiterNom}`,
    `Kollege (mit/an wem?): ${e.mitarbeiterDat}`,
    `Heute: ${e.heute}`,
    `Eingetragener Termin: ${e.termin ?? "keiner"}`,
    "Notiz des Kollegen (intern, nicht an den Kunden geschrieben):",
    "<<<",
    String(e.notiz || "").slice(0, 2000),
    ">>>",
  ].join("\n");
}

/** Maras Absätze aus der Modellantwort — bereinigt (Leerzeilen, Anrede/Gruß weg), höchstens drei. */
export function absaetzeAus(roh: unknown): string[] {
  const liste = Array.isArray(roh) ? roh : [];
  return liste
    .map((a) => String(a ?? "").replace(/\s+/g, " ").trim())
    .filter((a) => a && !/^(guten\s+tag|hallo|sehr\s+geehrte|liebe[rs]?\b)/i.test(a) && !/^(viele|beste|herzliche|freundliche)\s+gr(?:ü|ue)(?:ß|ss)e|^mit\s+freundlichen/i.test(a))
    .slice(0, 3);
}

/** Text als HTML-Absatz: maskiert (kein Markup, keine {{…}}). */
export function htmlSicher(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/\{/g, "(").replace(/\}/g, ")");
}
