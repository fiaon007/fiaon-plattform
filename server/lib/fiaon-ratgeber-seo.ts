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
import fs from "fs";
import path from "path";
import { sqlPool } from "./db-pool";
import { markdownZuHtml, textAusMarkdown } from "@shared/fiaon-markdown";
import { AUTORIN, KATEGORIEN } from "@shared/fiaon-ratgeber";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BASIS = "https://www.fiaon.com";

function indexHtml(): string | null {
  const kandidaten = [path.resolve(import.meta.dirname, "public", "index.html"), path.resolve(process.cwd(), "dist", "public", "index.html"), path.resolve(process.cwd(), "client", "index.html")];
  const f = kandidaten.find((k) => fs.existsSync(k));
  return f ? fs.readFileSync(f, "utf8") : null;
}

function kopfEinsetzen(html: string, kopf: { titel: string; beschreibung: string; url: string; ld: unknown[]; og?: Record<string, string> }): string {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(kopf.titel)}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(kopf.beschreibung)}" />`);
  out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${esc(kopf.url)}" />`);
  out = out.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(kopf.titel)}" />`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(kopf.titel)}" />`);
  out = out.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(kopf.beschreibung)}" />`);
  out = out.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(kopf.beschreibung)}" />`);
  if (kopf.og?.type) out = out.replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${esc(kopf.og.type)}" />`);
  const extra = [`<link rel="canonical" href="${esc(kopf.url)}" />`, `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    ...kopf.ld.map((l) => `<script type="application/ld+json">${JSON.stringify(l).replace(/</g, "\\u003c")}</script>`)].join("\n    ");
  return out.replace("</head>", `    ${extra}\n  </head>`);
}

export async function ratgeberSeitenHtml(slug: string | null): Promise<string | null> {
  const html = indexHtml(); if (!html) return null;
  if (!slug) {
    const rows = (await sqlPool`SELECT slug, titel, teaser, kategorie, published_at, updated_at FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY published_at DESC LIMIT 100`) as any[];
    const liste = rows.map((r) => `<li><a href="/ratgeber/${esc(r.slug)}"><h2>${esc(r.titel)}</h2><p>${esc(r.teaser)}</p></a></li>`).join("");
    const inhalt = `<main><h1>Ratgeber: Bonität verstehen – SCHUFA, KSV, CRIF</h1><p>Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – geprüft, ehrlich, ohne Versprechen.</p><ul>${liste}</ul></main>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "FIAON Ratgeber", url: `${BASIS}/ratgeber`, inLanguage: "de",
        hasPart: rows.map((r) => ({ "@type": "Article", headline: r.titel, url: `${BASIS}/ratgeber/${r.slug}`, datePublished: r.published_at })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${BASIS}/ratgeber` }] },
    ];
    return kopfEinsetzen(html, { titel: "Ratgeber · Bonität verstehen · FIAON", beschreibung: "SCHUFA-Eintrag löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüfte Ratgeber von FIAON, ehrlich und ohne Versprechen.", url: `${BASIS}/ratgeber`, ld })
      .replace('<div id="root"></div>', `<div id="root">${inhalt}</div>`);
  }
  const [a] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${slug} AND status = 'veroeffentlicht' LIMIT 1`) as any[];
  if (!a) return null;
  const faq = (typeof a.faq === "string" ? JSON.parse(a.faq) : a.faq) || [];
  const schlag = (typeof a.schlagworte === "string" ? JSON.parse(a.schlagworte) : a.schlagworte) || [];
  const url = `${BASIS}/ratgeber/${a.slug}`;
  const kat = (KATEGORIEN as any)[a.kategorie]?.label || "Ratgeber";
  const body = markdownZuHtml(a.inhalt);
  const faqHtml = faq.length ? `<section><h2>Häufige Fragen</h2>${faq.map((f: any) => `<h3>${esc(f.frage)}</h3><p>${esc(f.antwort)}</p>`).join("")}</section>` : "";
  const inhalt = `<main><article><p><a href="/ratgeber">Ratgeber</a> › ${esc(kat)}</p><h1>${esc(a.titel)}</h1>${a.untertitel ? `<p>${esc(a.untertitel)}</p>` : ""}<p>Von ${esc(AUTORIN.name)}, ${esc(AUTORIN.rolle)} · ${new Date(a.published_at || a.updated_at).toLocaleDateString("de-DE")} · ${a.lesezeit} Min. Lesezeit</p>${body}${faqHtml}</article></main>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: a.titel, description: a.teaser, inLanguage: "de", datePublished: a.published_at, dateModified: a.updated_at,
      author: { "@type": "Person", name: AUTORIN.name, jobTitle: AUTORIN.rolle }, publisher: { "@type": "Organization", name: "FIAON", url: BASIS, logo: { "@type": "ImageObject", url: `${BASIS}/icon-maskable-512.png` } },
      mainEntityOfPage: url, keywords: schlag.join(", "), articleSection: kat, wordCount: textAusMarkdown(a.inhalt).split(" ").length },
    faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f: any) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FIAON", item: BASIS }, { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${BASIS}/ratgeber` }, { "@type": "ListItem", position: 3, name: a.titel, item: url }] },
  ].filter(Boolean);
  return kopfEinsetzen(html, { titel: `${a.meta_titel || a.titel} · FIAON Ratgeber`, beschreibung: a.meta_beschreibung || a.teaser, url, ld, og: { type: "article" } })
    .replace('<div id="root"></div>', `<div id="root">${inhalt}</div>`);
}
