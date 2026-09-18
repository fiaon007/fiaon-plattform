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
import { seoZusatzEintragen, type SeoArt, type SeoSeite, type SeoAbschnitt } from "@shared/fiaon-seo-seiten";
import { GLOBAL_SEITEN, LANDINGPAGES, blockAlsText, globalKrumen, type GlobalSeitenArt } from "@shared/fiaon-global-seiten";

const seoArt = (a: GlobalSeitenArt): SeoArt => (a === "wissen" || a === "hub" ? "pfeiler" : a === "werkzeug" ? "werkzeug" : a === "land" ? "land" : "produkt");
const titelVon = (p: string) => {
  const g = GLOBAL_SEITEN.find((x) => x.pfad === p);
  return g ? `${g.h1}${g.h1b ? ` ${g.h1b}` : ""}` : p;
};

export const GLOBAL_SEO_EINTRAEGE: SeoSeite[] = [
  ...GLOBAL_SEITEN.map((g): SeoSeite => ({
    pfad: g.pfad, art: seoArt(g.art), stand: g.stand,
    prio: g.prio ?? (g.art === "leistung" ? 0.8 : g.art === "preise" || g.art === "zielgruppe" || g.art === "land" ? 0.7 : 0.6),
    titel: g.seo.titel, beschreibung: g.seo.beschreibung,
    h1: `${g.h1}${g.h1b ? ` ${g.h1b}` : ""}`, lead: g.lead,
    abschnitte: [{ h2: "Kurz beantwortet", text: g.kurz }, ...g.bloecke.map((b) => blockAlsText(b, titelVon)).filter((x): x is SeoAbschnitt => !!x)],
    weiter: g.weiter, krumen: globalKrumen(g),
    werkzeug: g.art === "werkzeug" ? "Paket-Finder FIAON Global" : undefined,
    global: g.art,
  })),
  ...LANDINGPAGES.map((lp): SeoSeite => ({
    pfad: lp.pfad, art: "intern", stand: "2026-09-19", prio: 0.1, robots: "noindex,follow",
    titel: lp.seo.titel, beschreibung: lp.seo.beschreibung, h1: `${lp.h1}${lp.h1b ? ` ${lp.h1b}` : ""}`, lead: lp.lead,
  })),
];

seoZusatzEintragen(
  GLOBAL_SEO_EINTRAEGE,
  new Map(GLOBAL_SEITEN.filter((g) => g.fragen.length).map((g) => [g.pfad, g.fragen.map((f) => ({ f: f.f, a: f.a }))])),
);
