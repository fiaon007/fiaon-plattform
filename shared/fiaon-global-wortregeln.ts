// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE SCHÄRFEREN WORTREGELN (17.09.2026, E-188)
//
// shared/fiaon-wortverbote.ts ist die Wand für JEDEN Kundentext des Hauses. Für
// FIAON Global gelten darüber hinaus Regeln, die das Regex der Wand nicht kennt
// (Register E-188): kein „bis zu", kein Bankname, keine Frist mit Ziffer in
// Tagen/Wochen/Monaten, kein „Ziel-Limit", kein „empfohlen", kein „0 %" als
// Zahl, keine „Unternehmensberatung"/„Gruppe" als Selbstbezeichnung, kein „ohne
// Sicherheiten", kein Steuerversprechen.
//
// Bis zum 17.09. stand die Liste nur in scripts/pruef-wortwand-de.ts. Seit es
// den Bereich „Mein Auftrag" gibt, prüft ein zweiter Prüfstand dieselben Regeln
// (scripts/pruef-global-bereich.ts: Etappen, Unterlagen, Pflichtenkalender,
// Mails) — zwei Kopien derselben Liste wären die nächste 059-Kopie. Deshalb
// steht sie hier, und beide Prüfstände lesen sie.
//
// GILT FÜR: die festen Texte des Hauses (Seite, Auftrag, Vertrag, Mails,
// Etappen, Kalender). NICHT für den Satz, den die zuständige Person im laufenden
// Auftrag von Hand an den Kunden schreibt — dort muss der Name eines Instituts
// stehen dürfen („Ihr Antrag liegt beim Herausgeber …"); für diese Sätze gilt
// die Wand des Hauses.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "./fiaon-wortverbote";

export const GLOBAL_SCHAERFER: { muster: RegExp; grund: string }[] = [
  { muster: /\bbis zu\b/i, grund: "„bis zu“ ist ein Spitzenwert-Versprechen (OLG Frankfurt 6 U 25/26)" },
  { muster: /\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i, grund: "kein Bankname als Versprechen (BGH I ZR 170/08)" },
  { muster: /\b(innerhalb|binnen)\s+(von\s+)?\d+\s*(wochen|monaten|tagen|werktagen)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /\bin\s+\d+\s*(–|-|bis)\s*\d+\s*(wochen|monaten)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /ziel-?(limit|rahmen)/i, grund: "Planungsgröße statt Ziel-Limit" },
  { muster: /\bempfohlen\w*\b/i, grund: "keine Empfehlung" },
  { muster: /\b0\s?%/, grund: "kein Zinssatz als Zahl — „Einführungszeitraum ohne Sollzins“" },
  { muster: /unternehmensberat|\bberatungsgruppe\b|\bfiaon group\b/i, grund: "Selbstbezeichnung (AT § 94 Z 74 GewO, § 18 HGB)" },
  { muster: /ohne sicherheiten/i, grund: "die persönliche Haftung IST die Sicherheit — „ohne Bareinlage“" },
  { muster: /steuern sparen|steuerersparnis|steuervorteil/i, grund: "kein Steuerversprechen" },
];

export interface GlobalWortTreffer { quelle: "wand" | "e188"; treffer: string; grund: string }

/**
 * Ein deutscher Kundentext von FIAON Global gegen BEIDE Listen. `gedeckt` sind
 * die Werkzeuge, die eine Zusage der Wand decken (z. B. „aufgabe_an_betreuer",
 * wenn der Versand erst nach angelegter Aufgabe geschieht).
 */
export function globalWortPruefen(text: string, gedeckt: string[] = []): GlobalWortTreffer[] {
  const t = String(text || "");
  const funde: GlobalWortTreffer[] = wandPruefen(t, gedeckt).map((f) => ({ quelle: "wand" as const, treffer: f.treffer, grund: f.hinweis }));
  for (const r of GLOBAL_SCHAERFER) {
    const m = t.match(r.muster);
    if (m) funde.push({ quelle: "e188", treffer: m[0].slice(0, 60), grund: r.grund });
  }
  return funde;
}
