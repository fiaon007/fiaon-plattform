// ═══════════════════════════════════════════════════════════════════════════
// Ratgeber für Suchmaschinen: index.html mit fertigem Kopf und Inhalt (23.08.2026)
//
// Justin: „SEO muss 100 % erfüllt sein, indexiert, wir müssen durch die Decke."
// Eine reine Single-Page-App liefert Google zuerst eine leere Seite; der Text
// kommt erst per JavaScript. Hier bekommt jeder Aufruf von /ratgeber und
// /ratgeber/:slug die index.html MIT Titel, Beschreibung, Canonical, Open Graph,
// JSON-LD (Article, FAQPage, BreadcrumbList) und dem vollständigen Artikel-HTML
// im #root — der Crawler liest den Text sofort, React übernimmt danach.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { markdownZuHtml, textAusMarkdown } from "@shared/fiaon-markdown";
import { AUTORIN, KATEGORIEN, ratgeberPfad, ratgeberHubPfad, type RatgeberSprache } from "@shared/fiaon-ratgeber";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// 25.08.2026: Hier stand "https://www.fiaon.com". GEMESSEN: www antwortet mit
// 301 auf die Adresse ohne www — jede Sitemap-Zeile und jedes Canonical
// schickte Google also erst durch eine Umleitung. Eine Adresse, eine Wahrheit.
import { BASIS, beschreibungKuerzen, organisationLd, indexHtml, kopfEinsetzen, seoRahmen, VORAB_STIL } from "./fiaon-seiten-seo";
import { SEO_SEITEN } from "@shared/fiaon-seo-seiten";
import { titelMitMarke } from "@shared/fiaon-pixel";

// Titel für die Trefferliste: höchstens 60 Zeichen. Der Report vom 02.09.
// fand 20 Artikel „zu lang" — jeder trug „· FIAON Ratgeber" (17 Zeichen)
// hinter einem ohnehin 50–65 Zeichen langen Titel. Jetzt: die Marke nur,
// wenn sie noch hineinpasst; ein bereits enthaltenes „| FIAON" wird nicht
// verdoppelt.
/** Titel für die Trefferliste: Marke nur, wenn sie in die Pixelbreite passt. */
export const ratgeberTitel = (roh: string) => titelMitMarke(roh);

// 09.09.2026 (E-100): Feste Texte des Rahmens je Sprache. Der Artikeltext selbst
// kommt aus der Datenbank und ist schon in der jeweiligen Sprache verfasst.
const RAHMEN = {
  de: {
    hubH1: "Ratgeber: Bonität verstehen – SCHUFA, KSV, CRIF",
    hubLead: "Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – geprüft, ehrlich, ohne Versprechen. Für Deutschland, Österreich und die Schweiz.",
    alle: "Alle Artikel", fragen: "Häufige Fragen", ratgeber: "Ratgeber", von: "Von", lesezeit: "Min. Lesezeit",
    sammlung: "FIAON Ratgeber", gebiet: "de-DE",
  },
  en: {
    hubH1: "Guide: understanding credit standing – SCHUFA, KSV, CRIF",
    hubLead: "Which entries can be challenged, how the free copy of your data works, what is realistic despite an entry – checked, honest, without promises. For Germany, Austria and Switzerland.",
    alle: "All articles", fragen: "Common questions", ratgeber: "Guide", von: "By", lesezeit: "min read",
    sammlung: "FIAON Guide", gebiet: "en-GB",
  },
} as const;

/** hreflang-Paar der Übersichtsseiten. Beide existieren immer. */
function hubAlternativen() {
  return { de: `${BASIS}/ratgeber`, en: `${BASIS}/en/guide` };
}

/** hreflang-Paar eines Artikels — nur, wenn es die Schwesterfassung wirklich gibt.
 *  Ein hreflang auf eine Adresse ohne Artikel wäre ein Fehler in der Search Console. */
function artikelAlternativen(a: any) {
  if (!a.schwester_slug) return undefined;
  const eigen = ratgeberPfad(a.slug, a.sprache === "en" ? "en" : "de");
  const schwester = ratgeberPfad(a.schwester_slug, a.sprache === "en" ? "de" : "en");
  return a.sprache === "en"
    ? { de: `${BASIS}${schwester}`, en: `${BASIS}${eigen}` }
    : { de: `${BASIS}${eigen}`, en: `${BASIS}${schwester}` };
}

export async function ratgeberSeitenHtml(slug: string | null, sprache: RatgeberSprache = "de"): Promise<string | null> {
  const html = indexHtml(); if (!html) return null;
  const spr: RatgeberSprache = sprache === "en" ? "en" : "de";
  const T = RAHMEN[spr];
  if (!slug) {
    const rows = (await sqlPool`SELECT slug, titel, teaser, kategorie, published_at, updated_at FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' AND sprache = ${spr} ORDER BY published_at DESC LIMIT 100`) as any[];
    const liste = rows.map((r) => `<li><a href="${esc(ratgeberPfad(r.slug, spr))}"><h3>${esc(r.titel)}</h3></a><p>${esc(r.teaser)}</p></li>`).join("");
    const inhalt = `<main><article><h1>${esc(T.hubH1)}</h1><p>${esc(T.hubLead)}</p><section><h2>${esc(T.alle)}</h2><ul>${liste}</ul></section>${pfeilerLinks()}</article></main>`;
    const ld = [
      organisationLd(),
      { "@context": "https://schema.org", "@type": "CollectionPage", name: T.sammlung, url: `${BASIS}${ratgeberHubPfad(spr)}`, inLanguage: spr,
        hasPart: rows.map((r) => ({ "@type": "Article", headline: r.titel, url: `${BASIS}${ratgeberPfad(r.slug, spr)}`, datePublished: r.published_at })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: T.ratgeber, item: `${BASIS}${ratgeberHubPfad(spr)}` }] },
    ];
    // 03.09.2026 (E-092): Titel und Beschreibung kommen aus der SEO-Tabelle,
    // nicht aus fest verdrahteten Zeichenketten hier. Vorher standen zwei
    // Fassungen nebeneinander — die hiesige war 1002 px breit und wurde in der
    // Suche abgeschnitten, die in der Tabelle nicht. Zwei Quellen für dieselbe
    // Angabe heißt: eine davon wird nie mitgepflegt.
    // 09.09.2026 (E-100): Derselbe Grundsatz, jetzt je Sprache — die englische
    // Übersichtsseite hat ihren eigenen Eintrag unter /en/guide.
    const hub = SEO_SEITEN[ratgeberHubPfad(spr)];
    return kopfEinsetzen(html.replace("</head>", `    ${VORAB_STIL}\n  </head>`), { titel: ratgeberTitel(hub.titel), beschreibung: beschreibungKuerzen(hub.beschreibung), url: `${BASIS}${ratgeberHubPfad(spr)}`, ld, sprache: spr, alternativen: hubAlternativen() })
      .replace('<div id="root"></div>', `<div id="root"><div class="vorab">${seoRahmen().kopf}${inhalt}${seoRahmen().fuss}</div></div>`);
  }
  const [a] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${slug} AND sprache = ${spr} AND status = 'veroeffentlicht' LIMIT 1`) as any[];
  if (!a) return null;
  const faq = (typeof a.faq === "string" ? JSON.parse(a.faq) : a.faq) || [];
  const schlag = (typeof a.schlagworte === "string" ? JSON.parse(a.schlagworte) : a.schlagworte) || [];
  const url = `${BASIS}${ratgeberPfad(a.slug, spr)}`;
  const kat = (KATEGORIEN as any)[a.kategorie]?.label || "Ratgeber";
  const body = markdownZuHtml(a.inhalt);
  const faqHtml = faq.length ? `<section><h2>${esc(T.fragen)}</h2>${faq.map((f: any) => `<h3>${esc(f.frage)}</h3><p>${esc(f.antwort)}</p>`).join("")}</section>` : "";
  const inhalt = `<main><article><p><a href="/">FIAON</a> › <a href="${esc(ratgeberHubPfad(spr))}">${esc(T.ratgeber)}</a> › ${esc(kat)}</p><h1>${esc(a.titel)}</h1>${a.untertitel ? `<p>${esc(a.untertitel)}</p>` : ""}<p>${esc(T.von)} ${esc(AUTORIN.name)}, ${esc(AUTORIN.rolle)} · ${new Date(a.published_at || a.updated_at).toLocaleDateString(T.gebiet)} · ${a.lesezeit} ${esc(T.lesezeit)}</p>${body}${faqHtml}${pfeilerLinks(a.kategorie)}</article></main>`;
  const ld = [
    organisationLd(),
    { "@context": "https://schema.org", "@type": "Article", headline: a.titel, description: a.teaser, inLanguage: spr, datePublished: a.published_at, dateModified: a.updated_at,
      author: { "@type": "Person", name: AUTORIN.name, jobTitle: AUTORIN.rolle }, publisher: { "@id": `${BASIS}/#organisation` },
      mainEntityOfPage: url, keywords: schlag.join(", "), articleSection: kat, wordCount: textAusMarkdown(a.inhalt).split(" ").length },
    faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: T.ratgeber, item: `${BASIS}${ratgeberHubPfad(spr)}` }, { "@type": "ListItem", position: 3, name: a.titel, item: url }] },
  ].filter(Boolean);
  return kopfEinsetzen(html.replace("</head>", `    ${VORAB_STIL}\n  </head>`), { titel: ratgeberTitel(a.meta_titel || a.titel), beschreibung: beschreibungKuerzen(a.meta_beschreibung || a.teaser), url, ld, og: { type: "article" }, sprache: spr, alternativen: artikelAlternativen(a) })
    .replace('<div id="root"></div>', `<div id="root"><div class="vorab">${seoRahmen().kopf}${inhalt}${seoRahmen().fuss}</div></div>`);
}

// ── Weiterlesen: von jedem Artikel zu den Pfeilern und Werkzeugen ────────────
// Der Report vom 02.09. zählte 90 Seiten mit „sehr wenigen internen Links".
// 46 Artikel, die auf die Pfeilerseiten zeigen, sind die stärkste interne
// Verlinkung, die dieses Haus hat — und sie kostet nichts.
const PFEILER_JE_KATEGORIE: Record<string, string[]> = {
  eintraege: ["/schufa-eintrag-loeschen", "/eintrag-verjaehrung", "/werkzeuge/eintrag-pruefen", "/werkzeuge/loeschfrist"],
  auskunft: ["/bonitaetsauskunft-beantragen", "/selbstauskunft-checkliste", "/werkzeuge/selbstauskunft", "/auskunfteien"],
  score: ["/schufa-score-verstehen", "/bonitaet-verbessern", "/schufa-neutral-anfragen", "/ratenzahlung-und-bonitaet"],
  inkasso: ["/inkasso-brief-erhalten", "/werkzeuge/inkassokosten", "/werkzeuge/verjaehrung", "/eintrag-verjaehrung"],
  kredit: ["/kredit-ohne-schufa", "/werkzeuge/kreditrechner", "/werkzeuge/umschuldung", "/schufa-neutral-anfragen"],
  karte: ["/kreditkarte", "/girokonto-trotz-negativer-bonitaet", "/werkzeuge/karten-check", "/privatkunden"],
  grundlagen: ["/schufa-score-verstehen", "/auskunfteien", "/glossar-bonitaet", "/werkzeuge"],
  at: ["/oesterreich", "/auskunfteien", "/werkzeuge/selbstauskunft", "/werkzeuge/eintrag-pruefen"],
  ch: ["/schweiz", "/auskunfteien", "/werkzeuge/selbstauskunft", "/werkzeuge/verjaehrung"],
  // 09.09.2026 (E-099): Rubrik Firmenkunden. Die vier Ziele deployen mit
  // demselben Merge wie die Artikel — sie können also nicht ins Leere zeigen.
  firmen: ["/business", "/werkzeuge/bonitaetsindex", "/werkzeuge/firmenauskunft", "/werkzeuge/verzugszinsen"],
};
const PFEILER_STANDARD = ["/schufa-eintrag-loeschen", "/bonitaet-verbessern", "/werkzeuge", "/glossar-bonitaet"];

function pfeilerLinks(kategorie?: string): string {
  const pfade = PFEILER_JE_KATEGORIE[kategorie ?? ""] ?? PFEILER_STANDARD;
  const eintraege = pfade.map((p) => SEO_SEITEN[p]).filter(Boolean)
    .map((s) => `<li><a href="${esc(s.pfad)}">${esc(s.h1)}</a></li>`).join("");   // 03.09.2026 (E-092): ohne Beschreibung — sie stand sonst wortgleich unter jedem Ratgeber.
  return `<nav aria-label="Weiterlesen"><h2>Weiterlesen</h2><ul>${eintraege}</ul></nav>`;
}
