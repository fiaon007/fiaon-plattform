// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE UNTERSEITEN IN DER SEO-TABELLE (19.09.2026, E-191)
//
// Der Server trägt die Unterseiten von FIAON Global beim Start in die
// gemeinsame SEO-Tabelle ein — mit Titel, Beschreibung, H1, Einleitung und
// einem Korpus aus „Kurz beantwortet" und allen Bausteinen der Seite: Wort
// für Wort, was der Besucher liest (Regel 1 der Tabelle). Die Fragen gehen
// als FAQPage mit. Die Landingpages für Anzeigen stehen mit noindex darin.
// Warum hier und nicht in shared/fiaon-seo-seiten.ts: siehe dort
// („Einträge, die der SERVER ergänzt").
// ═══════════════════════════════════════════════════════════════════════════
import { seoZusatzEintragen, GLOBAL_BILD, GLOBAL_BILD_EN, type SeoArt, type SeoSeite, type SeoAbschnitt } from "@shared/fiaon-seo-seiten";
import {
  GLOBAL_SEITEN, GLOBAL_SEITEN_EN, LANDINGPAGES, blockAlsText, globalKrumen, globalSeite, globalSprache, GLOBAL_SEITE_WORTE,
  type GlobalSeite, type GlobalSeitenArt,
} from "@shared/fiaon-global-seiten";

const seoArt = (a: GlobalSeitenArt): SeoArt => (a === "wissen" || a === "hub" ? "pfeiler" : a === "werkzeug" ? "werkzeug" : a === "land" ? "land" : "produkt");
const h1Von = (g: GlobalSeite) => `${g.h1}${g.h1b ? ` ${g.h1b}` : ""}`;
const titelVon = (p: string) => { const g = globalSeite(p); return g ? h1Von(g) : p; };
const prioVon = (g: GlobalSeite) => g.prio ?? (g.art === "leistung" ? 0.8 : g.art === "preise" || g.art === "zielgruppe" || g.art === "land" ? 0.7 : 0.6);

// 24.09.2026 (E-234): Deutsche und englische Seite nennen einander (schwester) — BEIDE Seiten, sonst
// ignoriert Google das hreflang-Paar. Das Paar kommt aus dem Register (englische Seite → schwester).
const EN_VON_DE = new Map(GLOBAL_SEITEN_EN.map((e) => [e.schwester ?? "", e]));

function eintrag(g: GlobalSeite): SeoSeite {
  const sp = globalSprache(g);
  const en = sp === "en";
  const schwester = en ? g.schwester : EN_VON_DE.get(g.pfad)?.pfad;
  return {
    pfad: g.pfad, art: seoArt(g.art), stand: g.stand, erschienen: g.erschienen ?? "2026-09-19", bild: en ? GLOBAL_BILD_EN : GLOBAL_BILD,
    // Englisch eine Stufe unter Deutsch — dieselbe Regel wie für alle anderen englischen Seiten (fiaon-seo-seiten.ts).
    prio: en ? Math.max(0.1, Math.round((prioVon(g) - 0.1) * 10) / 10) : prioVon(g),
    titel: g.seo.titel, beschreibung: g.seo.beschreibung,
    h1: h1Von(g), lead: g.lead,
    abschnitte: [{ h2: GLOBAL_SEITE_WORTE[sp].kurz, text: g.kurz }, ...g.bloecke.map((b) => blockAlsText(b, titelVon, sp)).filter((x): x is SeoAbschnitt => !!x)],
    weiter: g.weiter, krumen: globalKrumen(g),
    werkzeug: g.art === "werkzeug" ? (en ? "FIAON Global package finder" : "Paket-Finder FIAON Global") : undefined,
    global: g.art,
    ...(schwester ? { sprache: sp, schwester } : {}),
  };
}

export const GLOBAL_SEO_EINTRAEGE: SeoSeite[] = [
  ...GLOBAL_SEITEN.map(eintrag),
  ...GLOBAL_SEITEN_EN.map(eintrag),
  ...LANDINGPAGES.map((lp): SeoSeite => ({
    pfad: lp.pfad, art: "intern", stand: "2026-09-19", prio: 0.1, robots: "noindex,follow", bild: GLOBAL_BILD,
    titel: lp.seo.titel, beschreibung: lp.seo.beschreibung, h1: `${lp.h1}${lp.h1b ? ` ${lp.h1b}` : ""}`, lead: lp.lead,
  })),
];

seoZusatzEintragen(
  GLOBAL_SEO_EINTRAEGE,
  new Map([...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].filter((g) => g.fragen.length).map((g) => [g.pfad, g.fragen.map((f) => ({ f: f.f, a: f.a }))])),
);
