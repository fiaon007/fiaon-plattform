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

// ═══════════════════════════════════════════════════════════════════════════
// DIESELBEN GRENZEN AUF ENGLISCH (24.09.2026, E-234)
// Für die englischen Unterseiten (/en/business/…). Wortgleich mit SCHAERFER_EN in
// scripts/pruef-global-querschnitt.ts (Mails), dazu die Hausverbote aus
// scripts/seo-wortverbote-en.ts (guarantee, advice — nur verneint erlaubt —,
// recommend, affiliate, „improve your score") und die drei Geld-Zusagen der
// deutschen Wand (E-225) sinngemäß. Die EINE erlaubte Stelle für „up to" ist die
// VIP-Zahl, wie globalKapital("global_vip", "en") sie schreibt.
// ═══════════════════════════════════════════════════════════════════════════
export const GLOBAL_SCHAERFER_EN: GlobalWortregel[] = [
  { muster: /\bup to\b/i, grund: "“up to” is a peak-value promise (only the VIP figure may use it)" },
  { muster: /\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i, grund: "no bank names (and no “chase”/“ramp” as verbs — say “follow up”, “increase”)" },
  { muster: /\b(within|in)\s+\d+\s*(–|-|to)?\s*\d*\s*(working\s+|business\s+|calendar\s+)?(hours?|days?|weeks?|months?)\b/i, grund: "no deadline with digits (write the number as a word or give a date)" },
  { muster: /\btarget[- ]?(limit|credit line|credit limit)\b|\bfunding[- ]limit\b/i, grund: "capital range — never a target or funding limit" },
  { muster: /\b0\s?%|\b(0|zero)\s?per\s?cent\b/i, grund: "no interest rate as a number — “introductory period without debit interest”" },
  { muster: /\brecommend\w*\b/i, grund: "no recommendation" },
  { muster: /\b(without|no|zero)\s+(any\s+)?collateral\b|\bcollateral[- ]free\b|\bunsecured\b/i, grund: "the personal guarantee IS the security — “no cash deposit”" },
  { muster: /\bconsult(ing|ancy|ant|ants)\b|\badvisory\s+(firm|group|company)\b|\bfiaon group\b/i, grund: "self-description (not a consultancy, not a group)" },
  { muster: /\b(save|saves|saving)\s+(on\s+)?tax(es)?\b|\btax[- ](saving|savings|advantage|advantages|benefit|benefits|break|breaks)\b|(?<![“"‘])\btax[- ]free\b/i, grund: "no tax promise (“tax-free” only as a quoted myth)" },
  { muster: /\baffiliate/i, grund: "banned word" },
  { muster: /\bimprove(s|d)? (your|the|his|her|their) (score|credit score|credit rating)\b/i, grund: "the score follows the data — say which data change" },
  { muster: /\b(credit|loan)[- ]?brok(er|ers|erage|ing)\b|\bwe\s+(broker|arrange)\s+(loans?|credit|financing)\b/i, grund: "FIAON does not broker credit" },
  { muster: /\b(we|i)\s+(promise|assure)\b/i, grund: "no promise — name the next step and who decides" },
  { muster: /\b(funds|money|amount|loan|credit|capital)\b[\s\S]{0,40}?\b(is|are|will be|becomes?)\b[\s\S]{0,20}?\b(available|paid out|disbursed|ready)\b/i, grund: "no money promise — the institution decides" },
  { muster: /\b(your|the) (limit|credit line|credit limit)\b[\s\S]{0,30}?\b(is|will be) (approved|confirmed|secured|guaranteed)\b/i, grund: "the institution decides on every limit" },
  { muster: /\byou (will )?(get|receive)\b[\s\S]{0,25}?\b(the |a )?(card|credit card)\b(?![\s\S]{0,40}\b(approv|decid|decision|issuer|bank|institution)\w*)/i, grund: "the card is not promised — describe the route: after the issuer's approval" },
];

/** „guarantee"/„advice" nur verneint oder als Warnung (wie scripts/seo-wortverbote-en.ts). */
const EN_SATZ_ERLAUBT = /\b(no|not|never|nobody|no one|cannot|can't|neither|nor|without|instead|beware|promis\w*|dubious|replace[sd]?)\b/i;

/** Prüft einen englischen Text der Business-Welt. `ohneVip` entfernt vorher die eine erlaubte VIP-Zahl. */
export function globalWortPruefenEn(text: string, ohneVip = ""): { treffer: string; hinweis: string }[] {
  const t = ohneVip ? String(text ?? "").split(ohneVip).join("") : String(text ?? "");
  if (!t.trim()) return [];
  const funde: { treffer: string; hinweis: string }[] = [];
  for (const r of GLOBAL_SCHAERFER_EN) {
    const m = t.match(r.muster);
    if (m) funde.push({ treffer: m[0].slice(0, 60), hinweis: r.grund });
  }
  for (const m of Array.from(t.matchAll(/\b(guarantee[sd]?|guaranteeing|advice|advise[sd]?|advising)\b/gi))) {
    const a = Math.max(t.lastIndexOf(". ", m.index!), t.lastIndexOf("\n", m.index!), t.lastIndexOf("? ", m.index!), 0);
    const ende = [t.indexOf(". ", m.index!), t.indexOf("\n", m.index!), t.indexOf("? ", m.index!)].filter((x) => x >= 0);
    const satz = t.slice(a, ende.length ? Math.min(...ende) + 1 : t.length);
    // „personal guarantee" ist der Fachbegriff für die persönliche Haftung — kein Versprechen von FIAON.
    if (/personal guarantee/i.test(m.input!.slice(Math.max(0, m.index! - 9), m.index! + m[0].length))) continue;
    if (!EN_SATZ_ERLAUBT.test(satz)) funde.push({ treffer: m[0], hinweis: `“${m[0]}” only when negated or as a warning: ${satz.trim().slice(0, 90)}` });
  }
  return funde;
}
