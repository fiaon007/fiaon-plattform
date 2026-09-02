// ═══════════════════════════════════════════════════════════════════════════
// EIN EIGENER KOPF UND EIN LESBARER KORPUS FÜR JEDE ÖFFENTLICHE SEITE
// (25.08.2026, erweitert 02.09.2026 — E-079)
//
// ── DER BEFUND VOM 25.08. ─────────────────────────────────────────────────
// Gemessen an der laufenden Seite: /, /preise, /privatkunden, /bonitaet und
// /werkzeuge/verjaehrung liefern ALLE denselben Titel und dieselbe
// Beschreibung. Nur /ratgeber hatte einen eigenen Vorrenderer.
//
// ── DER BEFUND VOM 02.09. (Onpage-Report, 100 Seiten) ─────────────────────
// Der Kopf allein reichte nicht. 18 Seiten fehlten in der Tabelle (die vom
// 26.–30.08. gebauten Werkzeuge und Pfeiler), und auf 44 Seiten fand der
// Crawler „keinen auswertbaren Text", auf 45 keine H1, auf 90 „sehr wenige
// interne Links" — weil im HTML nur <div id="root"></div> stand.
//
// ── WAS SEIT E-079 PASSIERT ───────────────────────────────────────────────
// Die Tabelle wohnt jetzt in shared/fiaon-seo-seiten.ts (eine Quelle für
// Server und Client). Für jede Seite dort wird in #root ein lesbarer Korpus
// gerendert: Navigation, H1, Einleitung, Abschnitte mit H2, die sichtbaren
// FAQ, Weiterlesen-Links und die Fußzeile. React räumt das beim Start weg
// (createRoot ersetzt den Inhalt) — genau so, wie es der Ratgeber seit dem
// 23.08. tut. Der Crawler liest Text; der Besucher sieht die Bühne.
//
// Der Korpus ist KEIN zweiter Inhalt: H1, Einleitung, Abschnitte und FAQ
// sind dieselben, die die gerenderte Seite zeigt (Regel 1 der Tabelle).
//
// ── EINE MECHANIK, NICHT ZWEI ─────────────────────────────────────────────
// `kopfEinsetzen` wird von fiaon-ratgeber-seo.ts mitbenutzt. Zwei Fassungen
// desselben Kopfbaus liefen unweigerlich auseinander.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import {
  SEO_BASIS, SEO_NAV, SEO_FUSS, SEO_WERKZEUGE, SEO_GLOSSAR,
  seoSeite, seoFragen, seoIndexierbar, type SeoSeite, schwesterPfad } from "@shared/fiaon-seo-seiten";
import { EN_NAV, EN_FUSS, type Sprache } from "../../shared/fiaon-sprache";

export const BASIS = SEO_BASIS;

const esc = (s: string) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let indexCache: { html: string; zeit: number } | null = null;

export function indexHtml(): string | null {
  // Die Datei ändert sich nur mit einem Deploy; 60 Sekunden Cache sparen
  // pro Aufruf einen Dateizugriff, ohne dass ein Deploy je alt aussieht.
  if (indexCache && Date.now() - indexCache.zeit < 60_000) return indexCache.html;
  const kandidaten = [
    path.resolve(import.meta.dirname, "public", "index.html"),
    path.resolve(process.cwd(), "dist", "public", "index.html"),
    path.resolve(process.cwd(), "client", "index.html"),
  ];
  const f = kandidaten.find((k) => fs.existsSync(k));
  if (!f) return null;
  const html = fs.readFileSync(f, "utf8");
  indexCache = { html, zeit: Date.now() };
  return html;
}

/** Meta-Description auf Google-Länge kürzen — am Wortende, ohne Satzfetzen. */
export function beschreibungKuerzen(text: string, max = 155): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const kurz = t.slice(0, max - 1);
  const schnitt = Math.max(kurz.lastIndexOf(". "), kurz.lastIndexOf(", "), kurz.lastIndexOf(" – "), kurz.lastIndexOf(" "));
  return (schnitt > max * 0.6 ? kurz.slice(0, schnitt) : kurz).replace(/[,–\-\s]+$/, "") + "…";
}

export function kopfEinsetzen(html: string, kopf: {
  titel: string; beschreibung: string; url: string; ld?: unknown[];
  og?: Record<string, string>; robots?: string; bild?: string;
  /** Sprache der Seite (02.09.2026) — setzt html lang, meta language, og:locale. Fehlt = Deutsch. */
  sprache?: Sprache;
  /** hreflang-Paar: deutsche und englische Adresse derselben Seite (absolut). x-default zeigt auf Deutsch. */
  alternativen?: { de: string; en: string };
}): string {
  const sprache: Sprache = kopf.sprache ?? "de";
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(kopf.titel)}</title>`);
  out = out.replace(/<html lang="[a-z-]+">/, `<html lang="${sprache}">`);
  const setz = (name: string, attr: "name" | "property", wert: string) => {
    const re = new RegExp(`<meta ${attr}="${name}" content="[^"]*"\\s*/?>`);
    const neu = `<meta ${attr}="${name}" content="${esc(wert)}" />`;
    out = re.test(out) ? out.replace(re, neu) : out.replace("</head>", `    ${neu}\n  </head>`);
  };
  setz("title", "name", kopf.titel);
  setz("description", "name", kopf.beschreibung);
  setz("og:title", "property", kopf.titel);
  setz("og:description", "property", kopf.beschreibung);
  setz("og:url", "property", kopf.url);
  setz("twitter:title", "name", kopf.titel);
  setz("twitter:description", "name", kopf.beschreibung);
  if (kopf.og?.type) setz("og:type", "property", kopf.og.type);
  if (kopf.bild) {
    setz("og:image", "property", kopf.bild);
    setz("og:image:secure_url", "property", kopf.bild);
    setz("twitter:image", "name", kopf.bild);
  }
  // 25.08.2026: `robots` wird ERSETZT, nicht angehängt. Zwei Angaben
  // nebeneinander sind nach Googles Regel „die strengste gewinnt"
  // ungefährlich — andere Crawler halten sich daran aber nicht.
  setz("robots", "name", kopf.robots || "index,follow,max-image-preview:large,max-snippet:-1");
  setz("language", "name", sprache);
  setz("og:locale", "property", sprache === "en" ? "en_GB" : "de_DE");
  // 02.09.2026: Ein etwaiges Organization-Markup aus client/index.html wird
  // entfernt und durch das vollständige aus dem Korpus ersetzt. Vorher
  // standen ZWEI Organization-Blöcke auf jeder Seite — mit zwei
  // verschiedenen URLs (www und ohne).
  out = out.replace(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "Organization"[\s\S]*?<\/script>/, "");
  // hreflang (02.09.2026): beide Sprachen verweisen aufeinander, x-default auf
  // Deutsch. Ohne dieses Paar wäre /en/pricing für Google eine Dublette von /preise.
  const hreflang = kopf.alternativen ? [
    `<link rel="alternate" hreflang="de" href="${esc(kopf.alternativen.de)}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(kopf.alternativen.en)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(kopf.alternativen.de)}" />`,
  ] : [];
  const extra = [
    `<link rel="canonical" href="${esc(kopf.url)}" />`,
    ...hreflang,
    ...(kopf.ld ?? []).map((l) => `<script type="application/ld+json">${JSON.stringify(l).replace(/</g, "\\u003c")}</script>`),
  ].join("\n    ");
  return out.replace("</head>", `    ${extra}\n  </head>`);
}

// ── Das Unternehmen, einmal vollständig — auf jeder Seite dasselbe. ──────────
export function organisationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASIS}/#organisation`,
    name: "FIAON",
    legalName: "FIAON LTD",
    url: BASIS,
    logo: { "@type": "ImageObject", url: `${BASIS}/icon-maskable-512.png`, width: 512, height: 512 },
    image: `${BASIS}/og-fiaon.jpg`,
    description: "Das Betriebssystem für Bonität: Einsicht, Aktion, Zugang – in Deutschland, Österreich und der Schweiz.",
    address: { "@type": "PostalAddress", streetAddress: "128 City Road", addressLocality: "London", postalCode: "EC1V 2NX", addressCountry: "GB" },
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", telephone: "+41442449301", email: "support@fiaon.com", availableLanguage: ["de"], areaServed: ["DE", "AT", "CH"] }],
    areaServed: [{ "@type": "Country", name: "Deutschland" }, { "@type": "Country", name: "Österreich" }, { "@type": "Country", name: "Schweiz" }],
    knowsLanguage: "de",
    knowsAbout: ["Bonität", "SCHUFA", "KSV1870", "CRIF", "Bonitätsauskunft", "Löschfristen", "Inkasso", "Kreditkarte trotz Eintrag"],
    // sameAs bleibt leer, bis Justin die Profile freigibt (LinkedIn, Trustpilot,
    // ProvenExpert …). Ein leeres Feld ist besser als ein erfundenes.
  };
}

function breadcrumbLd(s: SeoSeite): Record<string, unknown> {
  const items = [{ "@type": "ListItem", position: 1, name: "FIAON", item: `${BASIS}/` }];
  (s.krumen ?? []).forEach((k, i) => items.push({ "@type": "ListItem", position: i + 2, name: k.name, item: `${BASIS}${k.pfad}` }));
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function strukturierteDaten(s: SeoSeite, url: string): unknown[] {
  const ld: unknown[] = [organisationLd()];
  const fragen = seoFragen(s.pfad);
  if (s.pfad === "/") {
    ld.push({ "@context": "https://schema.org", "@type": "WebSite", "@id": `${BASIS}/#website`, name: "FIAON", url: BASIS, inLanguage: "de", publisher: { "@id": `${BASIS}/#organisation` } });
  } else {
    ld.push(breadcrumbLd(s));
  }
  ld.push({
    "@context": "https://schema.org",
    "@type": s.art === "pfeiler" ? "Article" : "WebPage",
    "@id": `${url}#seite`,
    url, name: s.titel, headline: s.h1, description: s.beschreibung, inLanguage: "de",
    dateModified: s.stand, isPartOf: { "@id": `${BASIS}/#website` },
    ...(s.art === "pfeiler" ? { author: { "@id": `${BASIS}/#organisation` }, publisher: { "@id": `${BASIS}/#organisation` }, mainEntityOfPage: url } : {}),
  });
  if (fragen.length) {
    ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fragen.map((f) => ({ "@type": "Question", name: f.f, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  }
  if (s.werkzeug) {
    ld.push({ "@context": "https://schema.org", "@type": "WebApplication", name: s.werkzeug, url, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: "de", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, provider: { "@id": `${BASIS}/#organisation` } });
  }
  if (s.pfad === "/werkzeuge") {
    ld.push({ "@context": "https://schema.org", "@type": "ItemList", name: "Kostenlose FIAON-Werkzeuge", itemListElement: SEO_WERKZEUGE.map((w, i) => ({ "@type": "ListItem", position: i + 1, name: w.name, url: `${BASIS}${w.pfad}` })) });
  }
  if (s.pfad === "/glossar-bonitaet") {
    ld.push({ "@context": "https://schema.org", "@type": "DefinedTermSet", "@id": `${url}#glossar`, name: "Bonitäts-Glossar", inLanguage: "de", hasDefinedTerm: SEO_GLOSSAR.map((g) => ({ "@type": "DefinedTerm", name: g.wort, description: g.text, inDefinedTermSet: `${url}#glossar` })) });
  }
  if (s.pfad === "/preise" || s.pfad === "/privatkunden" || s.pfad === "/business") {
    // Die Preise stehen in shared/fiaon-pakete.ts — hier nur die Spanne, damit
    // nie zwei Zahlen auseinanderlaufen. Zwölf Raten, monatlich.
    ld.push({ "@context": "https://schema.org", "@type": "Service", name: s.pfad === "/business" ? "FIAON Business" : "FIAON Bonitäts-Programm", serviceType: "Bonitätsauskunft, Bereinigung von Auskunftei-Einträgen, Kontovorbereitung", provider: { "@id": `${BASIS}/#organisation` }, areaServed: ["DE", "AT", "CH"], url,
      offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: s.pfad === "/business" ? "49.99" : "7.99", highPrice: s.pfad === "/business" ? "249.99" : "99.99", offerCount: 4, url: `${BASIS}/preise` } });
  }
  return ld;
}

// ── Der lesbare Korpus in #root ──────────────────────────────────────────────
function link(pfad: string, text: string): string { return `<a href="${esc(pfad)}">${esc(text)}</a>`; }

function weiterlesen(s: SeoSeite): string {
  const en = s.sprache === "en";
  // Englische Seiten verweisen auf die englische Schwester des Ziels, wo es sie gibt.
  const ziele = (s.weiter ?? []).map((p) => seoSeite(en ? (schwesterPfad(p, "en") ?? p) : p)).filter((z): z is SeoSeite => !!z);
  if (!ziele.length) return "";
  const titel = en ? "Read on" : "Weiterlesen";
  return `<nav aria-label="${titel}"><h2>${titel}</h2><ul>${ziele.map((z) => `<li>${link(z.pfad, z.h1.replace(/\s+/g, " "))} – ${esc(z.beschreibung)}</li>`).join("")}</ul></nav>`;
}

/** Navigation und Fußzeile, wie sie auf jeder gerenderten Seite stehen — auch für den Ratgeber. */
export function seoRahmen(sprache: Sprache = "de"): { kopf: string; fuss: string } {
  const en = sprache === "en";
  // Englische Seiten verlinken die englische Schwester, wo es sie gibt — sonst die deutsche Seite.
  const ziel = (p: string) => (en ? (schwesterPfad(p, "en") ?? p) : p);
  const nav = en ? EN_NAV : SEO_NAV;
  const fussGruppen = en ? EN_FUSS : SEO_FUSS;
  const kopf = `<header><nav aria-label="${en ? "Main navigation" : "Hauptnavigation"}"><a href="${en ? "/en" : "/"}" aria-label="${en ? "FIAON home" : "FIAON Startseite"}"><strong>FIAON</strong></a><ul>${nav.map(([p, t]) => `<li>${link(ziel(p), t)}</li>`).join("")}</ul></nav></header>`;
  const zeile = en
    ? "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom · Customers in Germany, Austria and Switzerland · Support +41 44 244 93 01 · support@fiaon.com · The German version of all legal texts is binding."
    : "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom · Kunden in Deutschland, Österreich und der Schweiz · Support +41 44 244 93 01 · support@fiaon.com";
  const fuss = `<footer>${fussGruppen.map((g) => `<nav aria-label="${esc(g.titel)}"><h2>${esc(g.titel)}</h2><ul>${g.links.map(([p, t]) => `<li>${link(ziel(p), t)}</li>`).join("")}</ul></nav>`).join("")}<p>${esc(zeile)}</p></footer>`;
  return { kopf, fuss };
}

function korpus(s: SeoSeite): string {
  const fragen = seoFragen(s.pfad);
  const en = s.sprache === "en";
  const { kopf: nav, fuss } = seoRahmen(en ? "en" : "de");
  const krumen = s.krumen?.length ? `<nav aria-label="${en ? "Breadcrumbs" : "Brotkrumen"}"><ol><li>${link(en ? "/en" : "/", "FIAON")}</li>${s.krumen.map((k) => `<li>${link(k.pfad, k.name)}</li>`).join("")}</ol></nav>` : "";
  const abschnitte = (s.abschnitte ?? []).map((a) => `<section><h2>${esc(a.h2)}</h2><p>${esc(a.text)}</p>${a.punkte?.length ? `<ul>${a.punkte.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</section>`).join("");
  const werkzeuge = s.pfad === "/werkzeuge" ? `<section><h2>Die zehn Werkzeuge</h2><ul>${SEO_WERKZEUGE.map((w) => `<li>${link(w.pfad, w.name)} – ${esc(w.frage)} ${esc(w.satz)}</li>`).join("")}</ul></section>` : "";
  const glossar = s.pfad === "/glossar-bonitaet" ? `<section><h2>Die Begriffe</h2><dl>${SEO_GLOSSAR.map((g) => `<dt>${esc(g.wort)}</dt><dd>${esc(g.text)}</dd>`).join("")}</dl></section>` : "";
  const faq = fragen.length ? `<section><h2>${en ? "Frequently asked questions" : "Häufige Fragen"}</h2>${fragen.map((f) => `<h3>${esc(f.f)}</h3><p>${esc(f.a)}</p>`).join("")}</section>` : "";
  return `<div class="vorab">${nav}<main>${krumen}<article><h1>${esc(s.h1)}</h1><p>${esc(s.lead)}</p>${abschnitte}${werkzeuge}${glossar}${faq}${weiterlesen(s)}</article></main>${fuss}</div>`;
}

// Der Korpus ist für die Sekunde vor React da — und für Crawler. Ein wenig
// Schrift und Abstand, damit die Sekunde nicht wie ein Fehler aussieht.
// Bewusst NICHT versteckt (display:none wäre Cloaking).
export const VORAB_STIL = `<style>.vorab{max-width:760px;margin:0 auto;padding:24px 20px;font:16px/1.6 Inter,system-ui,sans-serif;color:#0f172a}.vorab h1{font-size:2rem;line-height:1.2;margin:16px 0}.vorab h2{font-size:1.25rem;margin:28px 0 8px}.vorab h3{font-size:1.05rem;margin:18px 0 4px}.vorab ul,.vorab ol{padding-left:20px}.vorab nav ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 16px}.vorab a{color:#1d4ed8}.vorab footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:14px}.vorab dt{font-weight:600;margin-top:12px}</style>`;

/** Fertiges HTML für eine öffentliche Seite — oder null, wenn sie nicht geführt wird. */
export function seitenHtml(pfad: string): string | null {
  const s = seoSeite(pfad);
  // /ratgeber hat seinen eigenen Vorrenderer (Artikel aus der Datenbank).
  if (!s || s.eigenerVorrenderer) return null;
  const html = indexHtml();
  if (!html) return null;
  const url = `${BASIS}${s.canonical ?? (s.pfad === "/" ? "/" : s.pfad)}`;
  const beschreibung = beschreibungKuerzen(s.beschreibung);
  const ld = s.robots?.includes("noindex") ? [organisationLd()] : strukturierteDaten(s, url);
  const sprache: Sprache = s.sprache === "en" ? "en" : "de";
  const absolut = (p: string) => `${BASIS}${p === "/" ? "/" : p}`;
  const alternativen = s.schwester
    ? { de: absolut(sprache === "de" ? s.pfad : s.schwester), en: absolut(sprache === "en" ? s.pfad : s.schwester) }
    : undefined;
  let out = kopfEinsetzen(html, { titel: s.titel, beschreibung, url, ld, robots: s.robots, bild: s.bild, og: { type: s.art === "pfeiler" ? "article" : "website" }, sprache, alternativen });
  // Der Korpus nur für indexierbare Seiten — ein Login-Formular braucht
  // keinen Vorab-Text, und interne Wege sollen nichts preisgeben.
  if (!s.robots?.includes("noindex")) {
    out = out.replace("</head>", `    ${VORAB_STIL}\n  </head>`).replace('<div id="root"></div>', `<div id="root">${korpus(s)}</div>`);
  }
  return out;
}

/** Die Sitemap-Einträge aller indexierbaren Seiten (ohne Ratgeber — der hängt sich selbst an). */
export function sitemapEintraege(): string {
  return seoIndexierbar()
    .sort((a, b) => b.prio - a.prio || a.pfad.localeCompare(b.pfad))
    .map((s) => `  <url><loc>${esc(`${BASIS}${s.pfad === "/" ? "/" : s.pfad}`)}</loc><lastmod>${s.stand}</lastmod><changefreq>${s.prio >= 0.9 ? "weekly" : "monthly"}</changefreq><priority>${s.prio.toFixed(1)}</priority></url>`)
    .join("\n");
}

/** Alle Pfade, die der Server vorrendert — für Prüfungen und die Sitemap. */
export function vorgerendertePfade(): string[] {
  return seoIndexierbar().map((s) => s.pfad);
}
