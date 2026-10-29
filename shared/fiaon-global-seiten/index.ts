// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS REGISTER DER UNTERSEITEN (19.09.2026, E-191)
// Eine Liste, aus der Seite, Menü, SEO-Tabelle, FAQ und Prüfstände lesen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalBlock, GlobalLandingpage, GlobalSeite } from "./typen";
import { globalMenuePunkt } from "../fiaon-global-menue";
import { LEISTUNGEN } from "./leistungen";
import { PREISE_UND_ABLAUF } from "./preise";
import { KOSTEN } from "./kosten";
import { ZIELGRUPPEN } from "./zielgruppen";
import { STAATEN } from "./staaten";
import { WISSEN } from "./wissen";
import { WISSEN_GRUENDUNG } from "./wissen-gruendung";
import { WISSEN_KONTO_KARTEN } from "./wissen-konto-karten";
import { WISSEN_FINANZIERUNG } from "./wissen-finanzierung";
import { WISSEN_E439, AUS_OESTERREICH_SEITE, WAS_IST_FIAON_GLOBAL_SEITE } from "./wissen-e439";
import { PARTNER_SEITE } from "./partner";
import { PRIVAT_SEITE } from "./privat";
import { LANDINGPAGES } from "./landingpages";
import { fragenSeite, fragenSeiteEn } from "./fragen";
// 24.09.2026 (E-234): die englischen Schwestern — eine Datei je deutscher Datei, Adressen aus shared/fiaon-global-pfade.ts.
import { LEISTUNGEN_EN } from "./en/leistungen";
import { KOSTEN_EN } from "./en/kosten";
import { PREISE_UND_ABLAUF_EN } from "./en/preise";
import { ZIELGRUPPEN_EN } from "./en/zielgruppen";
import { STAATEN_EN } from "./en/staaten";
import { WISSEN_EN } from "./en/wissen";
import { WISSEN_GRUENDUNG_EN } from "./en/wissen-gruendung";
import { WISSEN_KONTO_KARTEN_EN } from "./en/wissen-konto-karten";
import { WISSEN_FINANZIERUNG_EN } from "./en/wissen-finanzierung";
import { WISSEN_E439_EN, AUS_OESTERREICH_SEITE_EN, WAS_IST_FIAON_GLOBAL_SEITE_EN } from "./en/wissen-e439";
import { PARTNER_SEITE_EN } from "./en/partner";
import { PRIVAT_SEITE_EN } from "./en/privat";

export * from "./typen";

/** Alle Unterseiten ohne die Fragen-Seite (die sammelt aus allen anderen). */
const OHNE_FRAGEN: GlobalSeite[] = [...LEISTUNGEN, WAS_IST_FIAON_GLOBAL_SEITE, ...KOSTEN, ...PREISE_UND_ABLAUF, ...ZIELGRUPPEN, AUS_OESTERREICH_SEITE, PRIVAT_SEITE, ...STAATEN, ...WISSEN, ...WISSEN_GRUENDUNG, ...WISSEN_KONTO_KARTEN, ...WISSEN_FINANZIERUNG, ...WISSEN_E439, PARTNER_SEITE];

export const GLOBAL_SEITEN: GlobalSeite[] = [...OHNE_FRAGEN, fragenSeite(OHNE_FRAGEN)];
export { LANDINGPAGES };

/**
 * Die englischen Unterseiten (24.09.2026, E-234) — eine EIGENE Liste, in derselben Reihenfolge wie die
 * deutsche. GLOBAL_SEITEN bleibt deutsch: die deutsche Wortwand, das Menü, der Firmen-Radar und die
 * deutsche Fragen-Seite lesen es. Nur die Adresssuche (globalSeite) und der Server kennen beide.
 */
const OHNE_FRAGEN_EN: GlobalSeite[] = [...LEISTUNGEN_EN, WAS_IST_FIAON_GLOBAL_SEITE_EN, ...KOSTEN_EN, ...PREISE_UND_ABLAUF_EN, ...ZIELGRUPPEN_EN, AUS_OESTERREICH_SEITE_EN, PRIVAT_SEITE_EN, ...STAATEN_EN, ...WISSEN_EN, ...WISSEN_GRUENDUNG_EN, ...WISSEN_KONTO_KARTEN_EN, ...WISSEN_FINANZIERUNG_EN, ...WISSEN_E439_EN, PARTNER_SEITE_EN]
  .filter((s): s is GlobalSeite => !!s);
export const GLOBAL_SEITEN_EN: GlobalSeite[] = OHNE_FRAGEN_EN.length ? [...OHNE_FRAGEN_EN, fragenSeiteEn(OHNE_FRAGEN_EN)] : [];

const NACH_PFAD = new Map([...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].map((s) => [s.pfad, s]));
const LP_NACH_PFAD = new Map(LANDINGPAGES.map((s) => [s.pfad, s]));

const norm = (pfad: string) => (pfad.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/").toLowerCase();

export function globalSeite(pfad: string): GlobalSeite | null {
  return NACH_PFAD.get(norm(pfad)) ?? null;
}
export function globalLandingpage(pfad: string): GlobalLandingpage | null {
  return LP_NACH_PFAD.get(norm(pfad)) ?? null;
}

export { globalMenue, GLOBAL_MENUE_GRUPPEN, globalMenuePunkt } from "../fiaon-global-menue";

/** Die Sprache einer Registerseite — aus dem Feld, zur Sicherheit auch aus der Adresse. */
export const globalSprache = (s: GlobalSeite): "de" | "en" => (s.sprache === "en" || s.pfad.startsWith("/en/") ? "en" : "de");

/**
 * Die festen Wörter der Vorlage, die auch im Korpus für Suchmaschinen stehen — EINE Quelle für
 * Seite (global-seite.tsx), Inhaltsverzeichnis und Server (fiaon-global-seo.ts). Regel 1 der SEO-Tabelle:
 * Der Korpus sagt, was der Besucher sieht.
 */
// 29.10.2026 (E-461): Die Wurzel von FIAON Global ist die Startseite von fiaon.com (/ und /en) — vorher /business.
export const GLOBAL_SEITE_WORTE = {
  de: { kurz: "Kurz beantwortet", fragen: "Häufige Fragen", wurzel: "/", wissen: "Wissen", wissenPfad: "/business/wissen", rollen: ["FIAON", "Partner", "Sie"] },
  en: { kurz: "In brief", fragen: "Frequently asked questions", wurzel: "/en", wissen: "Knowledge", wissenPfad: "/en/business/knowledge", rollen: ["FIAON", "Partners", "You"] },
} as const;

/** Die Brotkrumen unterhalb der Startseite: Business → Gruppe → Seite (deutsch oder englisch). */
export function globalKrumen(s: GlobalSeite): { name: string; pfad: string }[] {
  const w = GLOBAL_SEITE_WORTE[globalSprache(s)];
  const k: { name: string; pfad: string }[] = [{ name: "FIAON Global", pfad: w.wurzel }];
  if (s.pfad.startsWith(`${w.wissenPfad}/`)) k.push({ name: w.wissen, pfad: w.wissenPfad });
  // E-439: auch der Doppelpunkt am Ende (Redaktionsartikel „Frist für Form 941: …“) gehört nicht in die Brotkrumen.
  k.push({ name: globalMenuePunkt(s.pfad)?.titel ?? s.h1.replace(/[.?!:]$/, ""), pfad: s.pfad });
  return k;
}

/** Das Inhaltsverzeichnis einer Seite: jeder Baustein mit Überschrift. */
export function globalInhalt(s: GlobalSeite): { id: string; titel: string }[] {
  const w = GLOBAL_SEITE_WORTE[globalSprache(s)];
  const mitTitel = s.bloecke.filter((b): b is Extract<GlobalBlock, { h2: string }> => "h2" in b && !!b.h2);
  const liste: { id: string; titel: string }[] = [{ id: "kurz", titel: w.kurz }, ...mitTitel.map((b) => ({ id: b.id, titel: b.h2 }))];
  if (s.fragen.length) liste.push({ id: "fragen", titel: w.fragen });
  return liste;
}

/** Ein Baustein als Klartext — für den Korpus der Suchmaschinen (derselbe Inhalt wie sichtbar). */
export function blockAlsText(b: GlobalBlock, seitenTitel: (pfad: string) => string, sprache: "de" | "en" = "de"): {
  h2: string; text: string; punkte?: string[];
  tabelle?: { kopf: string[]; zeilen: string[][]; fuss?: string[] }; links?: { pfad: string; text: string }[];
} | null {
  const [rFiaon, rPartner, rSie] = GLOBAL_SEITE_WORTE[sprache].rollen;
  switch (b.typ) {
    case "text": return { h2: b.h2, text: [...b.absaetze, ...(b.nach ? [b.nach] : [])].join(" "), punkte: b.punkte };
    case "etappen": return { h2: b.h2, text: b.lead ?? "", punkte: b.etappen.map((e, i) => `${i + 1}. ${e.titel}${e.dauer ? ` (${e.dauer})` : ""}: ${e.text}`) };
    case "rollen": return { h2: b.h2, text: b.lead ?? "", punkte: [`${rFiaon}: ${b.fiaon.join("; ")}`, `${rPartner}: ${b.partner.join("; ")}`, `${rSie}: ${b.sie.join("; ")}`] };
    // E-439: die Tabelle bleibt eine Tabelle (punkte für Leser ohne Tabellen, z. B. llms.txt).
    case "tabelle": return { h2: b.h2, text: (b.lead ?? "").trim(), punkte: b.zeilen.map((z) => z.map((zelle, i) => (b.kopf[i] ? `${b.kopf[i]}: ${zelle}` : zelle)).join(" · ")), tabelle: { kopf: b.kopf, zeilen: b.zeilen, fuss: b.fuss } };
    case "karten": return { h2: b.h2, text: b.lead ?? "", punkte: b.karten.map((k) => `${k.tag ? `${k.tag} — ` : ""}${k.titel}: ${k.text}`), ...(b.karten.some((k) => k.pfad) ? { links: b.karten.filter((k) => k.pfad).map((k) => ({ pfad: k.pfad!, text: k.titel })) } : {}) };
    case "hinweis": return { h2: b.h2, text: b.lead ?? "", punkte: b.punkte };
    case "fragen": return { h2: b.h2, text: b.lead ?? "", punkte: b.fragen.map((f) => `${f.f} ${f.a}`) };
    case "verzeichnis": return { h2: b.h2, text: b.lead ?? "", punkte: b.eintraege.map((e) => seitenTitel(e.pfad)), links: b.eintraege.map((e) => ({ pfad: e.pfad, text: seitenTitel(e.pfad) })) };
    case "zitat": return null;
    case "html": return { h2: b.h2, text: b.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
    case "paket": case "pakete": case "standorte": case "finder": return b.h2 ? { h2: b.h2, text: b.lead ?? "" } : null;
  }
}
