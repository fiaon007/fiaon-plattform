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
import { AUTORIN, KATEGORIEN } from "@shared/fiaon-ratgeber";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// 25.08.2026: Hier stand "https://www.fiaon.com". GEMESSEN: www antwortet mit
// 301 auf die Adresse ohne www — jede Sitemap-Zeile und jedes Canonical
// schickte Google also erst durch eine Umleitung. Eine Adresse, eine Wahrheit.
import { BASIS, beschreibungKuerzen, organisationLd, indexHtml, kopfEinsetzen, seoRahmen, VORAB_STIL } from "./fiaon-seiten-seo";
import { SEO_SEITEN } from "@shared/fiaon-seo-seiten";

// Titel für die Trefferliste: höchstens 60 Zeichen. Der Report vom 02.09.
// fand 20 Artikel „zu lang" — jeder trug „· FIAON Ratgeber" (17 Zeichen)
// hinter einem ohnehin 50–65 Zeichen langen Titel. Jetzt: die Marke nur,
// wenn sie noch hineinpasst; ein bereits enthaltenes „| FIAON" wird nicht
// verdoppelt.
export function ratgeberTitel(roh: string): string {
  const t = String(roh ?? "").replace(/\s*[|·—-]\s*FIAON( Ratgeber)?\s*$/i, "").trim();
  return t.length <= 51 ? `${t} | FIAON` : t;
}

export async function ratgeberSeitenHtml(slug: string | null): Promise<string | null> {
  const html = indexHtml(); if (!html) return null;
  if (!slug) {
    const rows = (await sqlPool`SELECT slug, titel, teaser, kategorie, published_at, updated_at FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY published_at DESC LIMIT 100`) as any[];
    const liste = rows.map((r) => `<li><a href="/ratgeber/${esc(r.slug)}"><h3>${esc(r.titel)}</h3></a><p>${esc(r.teaser)}</p></li>`).join("");
    const inhalt = `<main><article><h1>Ratgeber: Bonität verstehen – SCHUFA, KSV, CRIF</h1><p>Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – geprüft, ehrlich, ohne Versprechen. Für Deutschland, Österreich und die Schweiz.</p><section><h2>Alle Artikel</h2><ul>${liste}</ul></section>${pfeilerLinks()}</article></main>`;
    const ld = [
      organisationLd(),
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "FIAON Ratgeber", url: `${BASIS}/ratgeber`, inLanguage: "de",
        hasPart: rows.map((r) => ({ "@type": "Article", headline: r.titel, url: `${BASIS}/ratgeber/${r.slug}`, datePublished: r.published_at })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${BASIS}/ratgeber` }] },
    ];
    return kopfEinsetzen(html.replace("</head>", `    ${VORAB_STIL}\n  </head>`), { titel: "Ratgeber: SCHUFA, Bonität, Inkasso erklärt | FIAON", beschreibung: "SCHUFA-Eintrag löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüfte Ratgeber von FIAON, ehrlich und ohne Versprechen.", url: `${BASIS}/ratgeber`, ld })
      .replace('<div id="root"></div>', `<div id="root"><div class="vorab">${seoRahmen().kopf}${inhalt}${seoRahmen().fuss}</div></div>`);
  }
  const [a] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${slug} AND status = 'veroeffentlicht' LIMIT 1`) as any[];
  if (!a) return null;
  const faq = (typeof a.faq === "string" ? JSON.parse(a.faq) : a.faq) || [];
  const schlag = (typeof a.schlagworte === "string" ? JSON.parse(a.schlagworte) : a.schlagworte) || [];
  const url = `${BASIS}/ratgeber/${a.slug}`;
  const kat = (KATEGORIEN as any)[a.kategorie]?.label || "Ratgeber";
  const body = markdownZuHtml(a.inhalt);
  const faqHtml = faq.length ? `<section><h2>Häufige Fragen</h2>${faq.map((f: any) => `<h3>${esc(f.frage)}</h3><p>${esc(f.antwort)}</p>`).join("")}</section>` : "";
  const inhalt = `<main><article><p><a href="/">FIAON</a> › <a href="/ratgeber">Ratgeber</a> › ${esc(kat)}</p><h1>${esc(a.titel)}</h1>${a.untertitel ? `<p>${esc(a.untertitel)}</p>` : ""}<p>Von ${esc(AUTORIN.name)}, ${esc(AUTORIN.rolle)} · ${new Date(a.published_at || a.updated_at).toLocaleDateString("de-DE")} · ${a.lesezeit} Min. Lesezeit</p>${body}${faqHtml}${pfeilerLinks(a.kategorie)}</article></main>`;
  const ld = [
    organisationLd(),
    { "@context": "https://schema.org", "@type": "Article", headline: a.titel, description: a.teaser, inLanguage: "de", datePublished: a.published_at, dateModified: a.updated_at,
      author: { "@type": "Person", name: AUTORIN.name, jobTitle: AUTORIN.rolle }, publisher: { "@id": `${BASIS}/#organisation` },
      mainEntityOfPage: url, keywords: schlag.join(", "), articleSection: kat, wordCount: textAusMarkdown(a.inhalt).split(" ").length },
    faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${BASIS}/ratgeber` }, { "@type": "ListItem", position: 3, name: a.titel, item: url }] },
  ].filter(Boolean);
  return kopfEinsetzen(html.replace("</head>", `    ${VORAB_STIL}\n  </head>`), { titel: ratgeberTitel(a.meta_titel || a.titel), beschreibung: beschreibungKuerzen(a.meta_beschreibung || a.teaser), url, ld, og: { type: "article" } })
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
};
const PFEILER_STANDARD = ["/schufa-eintrag-loeschen", "/bonitaet-verbessern", "/werkzeuge", "/glossar-bonitaet"];

function pfeilerLinks(kategorie?: string): string {
  const pfade = PFEILER_JE_KATEGORIE[kategorie ?? ""] ?? PFEILER_STANDARD;
  const eintraege = pfade.map((p) => SEO_SEITEN[p]).filter(Boolean)
    .map((s) => `<li><a href="${esc(s.pfad)}">${esc(s.h1)}</a> – ${esc(s.beschreibung)}</li>`).join("");
  return `<nav aria-label="Weiterlesen"><h2>Weiterlesen</h2><ul>${eintraege}</ul></nav>`;
}
