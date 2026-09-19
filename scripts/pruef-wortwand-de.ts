// ═══════════════════════════════════════════════════════════════════════════
// WORTWAND FÜR DEUTSCHE SEITENTEXTE (17.09.2026, E-188)
//
// ── WARUM ──────────────────────────────────────────────────────────────────
// shared/fiaon-wortverbote.ts prüfte bis heute nur Mails und KI-Antworten; für
// englische Seitentexte gibt es scripts/seo-wortverbote-en.ts. Deutsche
// Seitentexte prüfte niemand — so kam „Garantiert FIAON das Limit?" in den
// Entwurf von /global (Prüfung vom 17.09.2026). Dieser Prüfstand schließt die
// Lücke für FIAON Global: Seite, Auftrag, Leistungstexte, SEO-Einträge.
//
// Zusätzlich zur Wand gelten für FIAON Global schärfere Regeln, die das Regex
// der Wand nicht kennt (Register E-188): kein „bis zu", kein Bankname, keine
// Frist mit Ziffer in Wochen/Monaten, kein „Ziel-Limit", kein „empfohlen",
// kein „0 %" als Zahl, keine „Unternehmensberatung"/„Gruppe" als
// Selbstbezeichnung, kein „ohne Sicherheiten".
//
//     npx tsx scripts/pruef-wortwand-de.ts        → Fehlercode 1 bei Treffern
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { GLOBAL_WOERTER, GLOBAL_GESPRAECH_WOERTER } from "../client/src/i18n/global";
import { GLOBAL_START_WOERTER } from "../client/src/i18n/global-start";
import { GLOBAL_AUFTRAG_WOERTER } from "../client/src/i18n/global-auftrag";
import { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_JAHRESBETREUUNG, globalKapital } from "../shared/fiaon-global";
import { GLOBAL_SCHLAGZEILEN } from "../shared/fiaon-global-schlagzeilen";
import { SEO_SEITEN } from "../shared/fiaon-seo-seiten";
// 19.09.2026 (E-191): die Unterseiten, Landingpages, das Business-Menü und die Standorte.
import { GLOBAL_SEITEN, LANDINGPAGES } from "../shared/fiaon-global-seiten";
import { GLOBAL_MENUE } from "../shared/fiaon-global-menue";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN } from "../shared/fiaon-global-partner";

const SCHAERFER: { muster: RegExp; grund: string }[] = [
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

function sammle(wert: unknown, pfad: string, aus: [string, string][]) {
  if (typeof wert === "string") { if (wert.trim()) aus.push([pfad, wert]); return; }
  if (typeof wert === "function") { try { sammle((wert as (...a: string[]) => unknown)("Muster", "Muster"), pfad + "()", aus); } catch { /* nicht aufrufbar */ } return; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => sammle(x, `${pfad}[${i}]`, aus)); return; }
  if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) sammle(v, `${pfad}.${k}`, aus);
}

const texte: [string, string][] = [];
sammle(GLOBAL_WOERTER.de, "i18n/global", texte);
sammle(GLOBAL_GESPRAECH_WOERTER.de, "i18n/global#gespraech", texte);
sammle(GLOBAL_START_WOERTER.de, "i18n/global-start", texte);
sammle(GLOBAL_AUFTRAG_WOERTER.de, "i18n/global-auftrag", texte);
for (const p of GLOBAL_PAKETE) sammle(p.de, `fiaon-global/${p.key}`, texte);
sammle(GLOBAL_PFLICHTHINWEIS.de, "fiaon-global/pflichthinweis", texte);
sammle(GLOBAL_ROLLEN.de, "fiaon-global/rollen", texte);
sammle(GLOBAL_GELD_ZURUECK.de, "fiaon-global/geld-zurueck", texte);
// E-196 (19.09.2026): Jahresbetreuung ab dem zweiten Jahr und die Nachrichtenlage (nur die deutschen Felder).
sammle(GLOBAL_JAHRESBETREUUNG.de, "fiaon-global/jahresbetreuung", texte);
sammle(GLOBAL_SCHLAGZEILEN.meldungen.map((m) => ({ de: m.de, kurzDe: m.kurzDe, quelle: m.quelle })), "schlagzeilen", texte);
for (const pfad of ["/business", "/business/start", "/business/auftrag"]) {
  const e = (SEO_SEITEN as Record<string, any>)[pfad];
  if (!e) { console.log(`FEHLER: SEO-Eintrag ${pfad} fehlt`); process.exitCode = 1; continue; }
  const { en: _en, ...deutsch } = e;
  sammle(deutsch, `seo${pfad}`, texte);
}

for (const seite of [...GLOBAL_SEITEN, ...LANDINGPAGES]) sammle(seite, `seiten${seite.pfad}`, texte);
sammle(GLOBAL_MENUE, "menue", texte);
sammle(GLOBAL_STANDORTE, "standorte", texte);
sammle(GLOBAL_VERBUNDEN, "verbunden", texte);

// E-190 (18.09.2026, Justin): „Beim VIP Pakete bis zu 1 Mio US Dollar Kapital". Die EINE erlaubte Stelle
// für „bis zu" ist der Kapitalrahmen des Pakets Global VIP — wörtlich, wie globalKapital() ihn schreibt.
// Jedes andere „bis zu" bleibt ein Treffer. (Anwalt prüft die Formulierung, Register E-190/E-191.)
const VIP_ERLAUBT = `${globalKapital("global_vip", "de").bisZu} ${globalKapital("global_vip", "de").wert}`;

let fehler = 0;
for (const [pfad, text] of texte) {
  // Felder ohne Kundentext (Pfade, Schlüssel, Datumsangaben, Adressen von Quellen) überspringen
  if (/\.(pfad|art|stand|robots|key|kennung|url|paket|typ|id|zeitzone|schluessel|quelle|auftraggeber|gruppe)$/.test(pfad) || /\.(weiter|krumen)\b/.test(pfad)) continue;
  // Zusagen „wir melden uns / Rückruf" sind auf diesen Flächen GEDECKT: Jede Anfrage und
  // jeder Auftrag legt beim Absenden eine Aufgabe für die zuständige Person an
  // (POST /api/fiaon/global/anfrage, /termine, /auftrag) — das ist das Werkzeug zur Zusage.
  for (const t of wandPruefen(text, ["aufgabe_an_betreuer"])) { fehler++; console.log(`WAND  ${pfad}: „${text.slice(0, 90)}“ → ${t.hinweis ?? JSON.stringify(t)}`); }
  const ohneVip = text.split(VIP_ERLAUBT).join("");
  for (const r of SCHAERFER) if (r.muster.test(ohneVip)) { fehler++; console.log(`E-188 ${pfad}: „${text.slice(0, 90)}“ → ${r.grund}`); }
}
console.log(`${texte.length} deutsche Texte geprüft — ${fehler} Treffer.`);
if (fehler) process.exitCode = 1;
