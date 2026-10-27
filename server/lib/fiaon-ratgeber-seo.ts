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
import { BASIS, beschreibungKuerzen, organisationLd, globalOrganisationLd, indexHtml, kopfEinsetzen, seoRahmen, seoRahmenBusiness, businessKopf } from "./fiaon-seiten-seo";
import { businessArtikelPfad } from "@shared/fiaon-business-artikel";
import { titelPixel, TITEL_MAX_PX } from "@shared/fiaon-pixel";
import { ogBusinessArtikelBild } from "@shared/fiaon-og-business-regeln";
import { SEO_SEITEN } from "@shared/fiaon-seo-seiten";
import { globalSeite } from "@shared/fiaon-global-seiten";
import { ensureRatgeberTabelle } from "./fiaon-ratgeber-redaktion";

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
  await ensureRatgeberTabelle();
  if (!slug) {
    // E-379: Die Privat-Seite zeigt nur Privat-Artikel auf Deutsch — Business steht auf /business/wissen (dieselbe Regel wie der Client).
    const rows = (await sqlPool`SELECT slug, titel, teaser, kategorie, published_at, updated_at FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' AND bereich = 'privat' AND sprache = 'de' ORDER BY published_at DESC LIMIT 100`) as any[];
    const liste = rows.map((r) => `<li><a href="/ratgeber/${esc(r.slug)}"><h3>${esc(r.titel)}</h3></a><p>${esc(r.teaser)}</p></li>`).join("");
    const inhalt = `<main><article><h1>Ratgeber: Bonität verstehen – SCHUFA, KSV, CRIF</h1><p>Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – geprüft, ehrlich, ohne Versprechen. Für Deutschland, Österreich und die Schweiz.</p><section><h2>Alle Artikel</h2><ul>${liste}</ul></section>${pfeilerLinks()}</article></main>`;
    const ld = [
      organisationLd(),
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "FIAON Ratgeber", url: `${BASIS}/ratgeber`, inLanguage: "de",
        hasPart: rows.map((r) => ({ "@type": "Article", headline: r.titel, url: `${BASIS}/ratgeber/${r.slug}`, datePublished: r.published_at })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${BASIS}/ratgeber` }] },
    ];
    return kopfEinsetzen(html, { titel: "Ratgeber: SCHUFA, Bonität, Inkasso erklärt | FIAON", beschreibung: "SCHUFA-Eintrag löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüfte Ratgeber von FIAON, ehrlich und ohne Versprechen.", url: `${BASIS}/ratgeber`, ld })
      .replace('<div id="root"></div>', `<div id="root"><div class="vorab">${seoRahmen().kopf}${inhalt}${seoRahmen().fuss}</div></div>`);
  }
  const [a] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${slug} AND status = 'veroeffentlicht' LIMIT 1`) as any[];
  if (!a) return null;
  const faq = (typeof a.faq === "string" ? JSON.parse(a.faq) : a.faq) || [];
  const schlag = (typeof a.schlagworte === "string" ? JSON.parse(a.schlagworte) : a.schlagworte) || [];
  const url = `${BASIS}/ratgeber/${a.slug}`;
  const kat = (KATEGORIEN as any)[a.kategorie]?.label || "Ratgeber";
  // E-379: Business-Artikel hängen in der Business-Welt — Brotkrumen FIAON Global › Wissen.
  const business = a.bereich === "business";
  const krume1 = business ? { name: "FIAON Global", pfad: "/business" } : { name: "FIAON", pfad: "/" };
  const krume2 = business ? { name: "Wissen", pfad: "/business/wissen" } : { name: "Ratgeber", pfad: "/ratgeber" };
  const body = markdownZuHtml(a.inhalt);
  const faqHtml = faq.length ? `<section><h2>Häufige Fragen</h2>${faq.map((f: any) => `<h3>${esc(f.frage)}</h3><p>${esc(f.antwort)}</p>`).join("")}</section>` : "";
  const inhalt = `<main><article><p><a href="${krume1.pfad}">${krume1.name}</a> › <a href="${krume2.pfad}">${krume2.name}</a> › ${esc(kat)}</p><h1>${esc(a.titel)}</h1>${a.untertitel ? `<p>${esc(a.untertitel)}</p>` : ""}<p>Von ${esc(AUTORIN.name)}, ${esc(AUTORIN.rolle)} · ${new Date(a.published_at || a.updated_at).toLocaleDateString("de-DE")} · ${a.lesezeit} Min. Lesezeit</p>${body}${faqHtml}${pfeilerLinks(a.kategorie)}</article></main>`;
  const ld = [
    organisationLd(),
    { "@context": "https://schema.org", "@type": "Article", headline: a.titel, description: a.teaser, inLanguage: "de", datePublished: a.published_at, dateModified: a.updated_at,
      author: { "@type": "Person", name: AUTORIN.name, jobTitle: AUTORIN.rolle }, publisher: { "@id": `${BASIS}/#organisation` },
      mainEntityOfPage: url, keywords: schlag.join(", "), articleSection: kat, wordCount: textAusMarkdown(a.inhalt).split(" ").length },
    faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: krume1.name, item: `${BASIS}${krume1.pfad === "/" ? "" : krume1.pfad}` }, { "@type": "ListItem", position: 2, name: krume2.name, item: `${BASIS}${krume2.pfad}` }, { "@type": "ListItem", position: 3, name: a.titel, item: url }] },
  ].filter(Boolean);
  // 27.10.2026 (E-436): Business-Artikel tragen ein Bild der Business-Welt (eigenes oder das Redaktionsbild) —
  // vorher erbten sie das Bonitäts-Bild aus index.html, auch wenn man sie auf LinkedIn teilte.
  const bild = business ? ogBusinessArtikelBild(a.slug, a.sprache === "en" ? "en" : "de") : null;
  return kopfEinsetzen(html, { titel: ratgeberTitel(a.meta_titel || a.titel), beschreibung: beschreibungKuerzen(a.meta_beschreibung || a.teaser), url, ld, og: { type: "article" }, ...(bild ? { bild: bild.url, bildAlt: bild.alt } : {}) })
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
// E-379: Business-Artikel verweisen in die Business-Welt (FIAON Global), nie auf die Privat-Seiten.
const PFEILER_BUSINESS = ["/business/wissen", "/business/us-firmengruendung", "/business/firmenkarten-kapital", "/business/kosten"];

function pfeilerLinks(kategorie?: string): string {
  if (kategorie === "firmen") {
    const eintraege = PFEILER_BUSINESS.map((p) => globalSeite(p)).filter(Boolean)
      .map((s) => `<li><a href="${esc(s!.pfad)}">${esc(`${s!.h1}${s!.h1b ? ` ${s!.h1b}` : ""}`)}</a> – ${esc(s!.seo.beschreibung)}</li>`).join("");
    return `<nav aria-label="Weiterlesen"><h2>Weiterlesen</h2><ul>${eintraege}</ul></nav>`;
  }
  const pfade = PFEILER_JE_KATEGORIE[kategorie ?? ""] ?? PFEILER_STANDARD;
  const eintraege = pfade.map((p) => SEO_SEITEN[p]).filter(Boolean)
    .map((s) => `<li><a href="${esc(s.pfad)}">${esc(s.h1)}</a> – ${esc(s.beschreibung)}</li>`).join("");
  return `<nav aria-label="Weiterlesen"><h2>Weiterlesen</h2><ul>${eintraege}</ul></nav>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS-ARTIKEL IN DER BUSINESS-WELT (27.10.2026, E-436)
// Die Tagesartikel für Unternehmer (bereich business) hingen unter /ratgeber/<slug> im Rahmen der Privatkunden,
// mit Bonitäts-Bild, deutscher Sprache auch für englische Texte und einer Verbraucher-Redakteurin als Autorin.
// Jetzt: eigene Adresse (shared/fiaon-business-artikel.ts), Kopf und Fuß von FIAON Global, Sprache des Artikels,
// Autor und Herausgeber „FIAON Global“ (#fiaon-global), eigenes Vorschaubild. /ratgeber/<slug> leitet 301 hierher.
// ═══════════════════════════════════════════════════════════════════════════
const PFEILER_BUSINESS_EN = ["/en/business/knowledge", "/en/business/us-company-formation", "/en/business/us-business-credit-cards", "/en/business/costs"];

/** „Titel — FIAON Global“, solange es unter die Pixelgrenze passt; sonst der Titel allein. */
export function businessTitel(roh: string): string {
  const t = String(roh ?? "").replace(/\s*[|·—-]\s*FIAON( Global| Ratgeber)?\s*$/i, "").trim();
  const mit = `${t} — FIAON Global`;
  return titelPixel(mit) <= TITEL_MAX_PX ? mit : t;
}

/** Wohin gehört ein Artikel? Business-Artikel → ihre Business-Adresse, sonst null (bleibt unter /ratgeber). */
export async function businessArtikelZiel(slug: string): Promise<string | null> {
  await ensureRatgeberTabelle();
  const [a] = (await sqlPool`SELECT bereich, sprache, status FROM fiaon_ratgeber WHERE slug = ${slug} LIMIT 1`) as any[];
  if (!a || a.status !== "veroeffentlicht" || a.bereich !== "business") return null;
  return businessArtikelPfad(slug, a.sprache);
}

/** Vorab-HTML eines Business-Artikels — oder eine Umleitung, wenn die Sprache der Adresse nicht passt. */
export async function businessArtikelHtml(slug: string, sprache: "de" | "en"): Promise<{ html: string } | { umleiten: string } | null> {
  const html = indexHtml(); if (!html) return null;
  await ensureRatgeberTabelle();
  const [a] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${slug} AND status = 'veroeffentlicht' LIMIT 1`) as any[];
  if (!a || a.bereich !== "business") return null;
  const sp: "de" | "en" = a.sprache === "en" ? "en" : "de";
  if (sp !== sprache) return { umleiten: businessArtikelPfad(slug, sp) };
  const en = sp === "en";
  const pfad = businessArtikelPfad(slug, sp);
  const url = `${BASIS}${pfad}`;
  const wurzel = en ? "/en/business" : "/business";
  const hub = en ? "/en/business/knowledge" : "/business/wissen";
  const faq = (typeof a.faq === "string" ? JSON.parse(a.faq) : a.faq) || [];
  const schlag = (typeof a.schlagworte === "string" ? JSON.parse(a.schlagworte) : a.schlagworte) || [];
  const kat = (KATEGORIEN as any)[a.kategorie]?.label || (en ? "Knowledge" : "Wissen");
  const datum = new Date(a.published_at || a.updated_at).toLocaleDateString(en ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric" });
  const byline = en ? `FIAON Global editorial team · ${datum} · ${a.lesezeit} min read` : `Redaktion FIAON Global · ${datum} · ${a.lesezeit} Min. Lesezeit`;
  const weiterPfade = en ? PFEILER_BUSINESS_EN : PFEILER_BUSINESS;
  const weiter = weiterPfade.map((p) => globalSeite(p)).filter(Boolean)
    .map((s) => `<li><a href="${esc(s!.pfad)}">${esc(`${s!.h1}${s!.h1b ? ` ${s!.h1b}` : ""}`)}</a> – ${esc(s!.seo.beschreibung)}</li>`).join("");
  const faqHtml = faq.length ? `<section><h2>${en ? "Frequently asked questions" : "Häufige Fragen"}</h2>${faq.map((f: any) => `<h3>${esc(f.frage)}</h3><p>${esc(f.antwort)}</p>`).join("")}</section>` : "";
  const inhalt = `<main><nav aria-label="${en ? "Breadcrumbs" : "Brotkrumen"}"><ol><li><a href="${wurzel}">FIAON Global</a></li><li><a href="${hub}">${en ? "Knowledge" : "Wissen"}</a></li></ol></nav><article><h1>${esc(a.titel)}</h1>${a.untertitel ? `<p>${esc(a.untertitel)}</p>` : ""}<p>${esc(byline)}</p>${markdownZuHtml(a.inhalt)}${faqHtml}<nav aria-label="${en ? "Read on" : "Weiterlesen"}"><h2>${en ? "Read on" : "Weiterlesen"}</h2><ul>${weiter}</ul></nav></article></main>`;
  const bild = ogBusinessArtikelBild(slug, sp);
  const ld = [
    organisationLd(), globalOrganisationLd(sp),
    { "@context": "https://schema.org", "@type": "Article", "@id": `${url}#seite`, headline: a.titel, description: a.teaser, inLanguage: sp, datePublished: a.published_at, dateModified: a.updated_at,
      author: { "@id": `${BASIS}/#fiaon-global` }, publisher: { "@id": `${BASIS}/#fiaon-global` }, mainEntityOfPage: url, image: bild?.url,
      keywords: schlag.join(", "), articleSection: kat, wordCount: textAusMarkdown(a.inhalt).split(" ").length },
    faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "FIAON Global", item: `${BASIS}${wurzel}` },
      { "@type": "ListItem", position: 2, name: en ? "Knowledge" : "Wissen", item: `${BASIS}${hub}` },
      { "@type": "ListItem", position: 3, name: a.titel, item: url }] },
  ].filter(Boolean);
  const erschienen = new Date(a.published_at || a.updated_at).toISOString();
  const { kopf, fuss } = seoRahmenBusiness(sp);
  const out = businessKopf(kopfEinsetzen(html, {
    titel: businessTitel(a.meta_titel || a.titel), beschreibung: beschreibungKuerzen(a.meta_beschreibung || a.teaser), url, ld,
    og: { type: "article", erschienen, geaendert: new Date(a.updated_at).toISOString() }, sprache: sp,
    ...(bild ? { bild: bild.url, bildAlt: bild.alt } : {}),
  }));
  return { html: out.replace('<div id="root"></div>', `<div id="root"><div class="vorab vorab-hell">${kopf}${inhalt}${fuss}</div></div>`) };
}
