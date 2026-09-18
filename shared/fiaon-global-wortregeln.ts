// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE SCHÄRFEREN WORTREGELN ALS BAUSTEIN (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Die Wortwand (shared/fiaon-wortverbote.ts) kennt die Hausregeln: nichts
// garantieren, nicht beraten, nichts empfehlen, keine Frist in Tagen. Für
// FIAON Global gelten dazu schärfere Regeln (Register E-188): kein „bis zu",
// kein Bankname als Versprechen, keine Frist mit Ziffer in Wochen oder Monaten,
// kein „0 %", kein „ohne Sicherheiten", keine „Unternehmensberatung", kein
// Steuerversprechen. Bis heute standen sie nur im Prüfstand
// scripts/pruef-wortwand-de.ts — der prüft, was im CODE steht.
//
// Im Office schreibt aber ein MENSCH an den Kunden: den Satz zur Etappe, den
// nächsten Schritt, die sichtbare Notiz. Diese Sätze stehen in keiner Datei,
// die ein Prüfstand lesen könnte. Deshalb liegen die Regeln hier, wo Server
// und Oberfläche sie beide erreichen: Das Werkzeug /agent/global zeigt die
// Treffer, WÄHREND der Mitarbeiter schreibt — bevor der Satz beim Kunden ist.
//
// ── EINE DEFINITION, EIN ORT ───────────────────────────────────────────────
// Die Liste ist wortgleich mit SCHAERFER in scripts/pruef-wortwand-de.ts.
// scripts/pruef-global-office.ts liest jenen Prüfstand als Text und schlägt an,
// sobald eine Regel hier fehlt oder dort dazukommt. Beim Zusammenführen kann
// der Prüfstand seine Liste durch einen Import von hier ersetzen.
//
// ── WAS DIE TREFFER IM OFFICE BEDEUTEN ─────────────────────────────────────
// Ein Hinweis, keine Sperre. Im laufenden Auftrag ist „Ihr Antrag liegt beim
// Institut" eine Auskunft und kein Werbeversprechen; ob ein Satz eine Zusage
// ist, entscheidet der Zusammenhang — und den kennt der Mensch. Das Werkzeug
// sagt, WORAUF er achten soll.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "./fiaon-wortverbote";

export interface GlobalWortregel { muster: RegExp; grund: string }

export const GLOBAL_SCHAERFER: GlobalWortregel[] = [
  { muster: /\bbis zu\b/i, grund: "„bis zu“ ist ein Spitzenwert-Versprechen (OLG Frankfurt 6 U 25/26)" },
  { muster: /\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i, grund: "kein Bankname als Versprechen (BGH I ZR 170/08)" },
  { muster: /\b(innerhalb|binnen)\s+(von\s+)?\d+\s*(wochen|monaten|tagen|werktagen)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /\bin\s+\d+\s*(–|-|bis)\s*\d+\s*(wochen|monaten)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /ziel-?(limit|rahmen)/i, grund: "Kapitalrahmen statt Ziel-Limit" },
  { muster: /\bempfohlen\w*\b/i, grund: "keine Empfehlung" },
  { muster: /\b0\s?%/, grund: "kein Zinssatz als Zahl — „Einführungszeitraum ohne Sollzins“" },
  { muster: /unternehmensberat|\bberatungsgruppe\b|\bfiaon group\b/i, grund: "Selbstbezeichnung (AT § 94 Z 74 GewO, § 18 HGB)" },
  { muster: /ohne sicherheiten/i, grund: "die persönliche Haftung IST die Sicherheit — „ohne Bareinlage“" },
  { muster: /steuern sparen|steuerersparnis|steuervorteil/i, grund: "kein Steuerversprechen" },
];

export interface GlobalWorthinweis {
  /** „wand" = Hausregel aus fiaon-wortverbote.ts, „global" = schärfere Regel aus E-188. */
  quelle: "wand" | "global";
  /** Die Stelle im Text, an der es hängt (gekürzt). */
  treffer: string;
  /** Was stattdessen zu sagen ist. */
  hinweis: string;
}

/**
 * Prüft einen Satz, der an einen Global-Kunden geht. `gedeckt` nennt die
 * Werkzeuge, die zur Zusage gehören (z. B. "aufgabe_an_betreuer", wenn beim
 * Absenden wirklich eine Aufgabe entsteht) — wie bei wandPruefen.
 */
export function globalWortPruefen(text: string, gedeckt: string[] = []): GlobalWorthinweis[] {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const funde: GlobalWorthinweis[] = wandPruefen(t, gedeckt).map((f) => ({ quelle: "wand" as const, treffer: f.treffer, hinweis: f.hinweis }));
  for (const r of GLOBAL_SCHAERFER) {
    const m = t.match(r.muster);
    if (m) funde.push({ quelle: "global", treffer: m[0].slice(0, 60), hinweis: r.grund });
  }
  return funde;
}
