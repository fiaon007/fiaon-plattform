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
  SEO_BASIS, SEO_NAV, SEO_FUSS, SEO_WERKZEUGE, SEO_WERKZEUGE_EN, SEO_GLOSSAR, SEO_GLOSSAR_EN, GLOBAL_BILD, GLOBAL_BILD_EN,
  seoSeite, seoFragen, seoIndexierbar, type SeoSeite, schwesterPfad } from "@shared/fiaon-seo-seiten";
import { EN_NAV, EN_FUSS, type Sprache } from "../../shared/fiaon-sprache";
import { GLOBAL_PAKETE, globalKatalog } from "@shared/fiaon-global";
import { globalMenue } from "@shared/fiaon-global-menue";
import { globalStartPfad, globalPaketePfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
// Trägt die Unterseiten von FIAON Global in die SEO-Tabelle ein — VOR jeder Abfrage.
import "./fiaon-global-seo";
import { globalSeite, globalLandingpage } from "@shared/fiaon-global-seiten";

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
  /** Alternativtext zum Vorschaubild (23.09.2026) — sonst bliebe der aus index.html („Betriebssystem für Bonität“). */
  bildAlt?: string;
  /** Sprache der Seite (02.09.2026) — setzt html lang, meta language, og:locale. Fehlt = Deutsch. */
  sprache?: Sprache;
  /** hreflang-Paar: deutsche und englische Adresse derselben Seite (absolut). x-default zeigt auf Deutsch. */
  alternativen?: { de: string; en: string };
  /** false = kein rel=canonical (19.09.2026, Nicht-gefunden-Seite: eine 404-Adresse ist für nichts maßgeblich). Fehlt = mit. */
  canonical?: boolean;
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
  // 23.09.2026 (E-232): Beiträge tragen Erscheinungs- und Änderungsdatum auch im Open-Graph-Kopf.
  if (kopf.og?.erschienen) setz("article:published_time", "property", kopf.og.erschienen);
  if (kopf.og?.geaendert) setz("article:modified_time", "property", kopf.og.geaendert);
  if (kopf.bild) {
    setz("og:image", "property", kopf.bild);
    setz("og:image:secure_url", "property", kopf.bild);
    setz("twitter:image", "name", kopf.bild);
    if (kopf.bildAlt) { setz("og:image:alt", "property", kopf.bildAlt); setz("twitter:image:alt", "name", kopf.bildAlt); }
  } else if (kopf.bild === "") {
    // 04.09.2026: Ein leeres `bild` heisst ausdruecklich „kein Vorschaubild".
    // Ohne das erbt jede Seite das Werbebild aus index.html — auch der
    // Datenraum fuer den Anteilskaufvertrag. Wer dort den Link per Mail oder
    // Nachricht teilt, schickt eine Kachel mit „Das Betriebssystem fuer
    // Bonitaet" mit; neben einem Vertrag ueber 14 Mio EUR ist das keine
    // Kleinigkeit, sondern eine falsche Auskunft ueber den Absender.
    for (const [n, a] of [["og:image", "property"], ["og:image:secure_url", "property"],
                          ["og:image:type", "property"], ["og:image:width", "property"],
                          ["og:image:height", "property"], ["twitter:image", "name"]] as const) {
      out = out.replace(new RegExp(`\\s*<meta ${a}="${n}" content="[^"]*"\\s*/?>`), "");
    }
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
    ...(kopf.canonical === false ? [] : [`<link rel="canonical" href="${esc(kopf.url)}" />`]),
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
    description: "Das Betriebssystem für Bonität: Einsicht, Aktion, Zugang – in Deutschland, Österreich und der Schweiz. Mit FIAON Global die US-Gesellschaft aus einer Hand: Gründung, EIN und ITIN, Registered Agent, Vorbereitung von Konto- und Kartenanträgen, US-Pflichten.",
    // 23.09.2026 (E-232): die Registernummer als eindeutige Kennung — für Suchmaschinen und KI-Assistenten, die Firmen zuordnen.
    identifier: { "@type": "PropertyValue", propertyID: "Companies House (England and Wales)", value: FIAON_FIRMA.companyNo },
    address: { "@type": "PostalAddress", streetAddress: "128 City Road", addressLocality: "London", postalCode: "EC1V 2NX", addressCountry: "GB" },
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", telephone: "+41442449301", email: "support@fiaon.com", availableLanguage: ["de"], areaServed: ["DE", "AT", "CH"] }],
    areaServed: [{ "@type": "Country", name: "Deutschland" }, { "@type": "Country", name: "Österreich" }, { "@type": "Country", name: "Schweiz" }],
    knowsLanguage: "de",
    knowsAbout: ["Bonität", "SCHUFA", "KSV1870", "CRIF", "Bonitätsauskunft", "Löschfristen", "Inkasso", "Kreditkarte trotz Eintrag",
      "US-LLC-Gründung", "US-Firmengründung aus Deutschland", "Employer Identification Number (EIN)", "ITIN", "Form 5472", "Registered Agent", "US-Geschäftskonto", "US-Firmenkarten"],
    // 24.09.2026 (E-234, Justin: „Profile freigeben … mach alles du"): Nur was nachweislich FIAON ist.
    // Der Registereintrag im Companies House ist die amtliche Seite der Firma. Eine LinkedIn-Firmenseite
    // gibt es noch nicht, einen Trustpilot-Eintrag auch nicht (Prüfung 23.09.: die „2.347 Bewertungen" auf /start waren
    // erfunden); die neue Facebook-Seite „FIAON" kommt dazu, sobald ihre Adresse feststeht. Nie erfinden.
    sameAs: [`https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}`],
  };
}

function breadcrumbLd(s: SeoSeite): Record<string, unknown> | null {
  // 19.09.2026 (E-192): Die Business-Welt beginnt bei FIAON Global, nicht auf der Startseite
  // der Privatkunden — wie die sichtbaren Brotkrumen (globalKrumen) und korpus() unten.
  const business = /^\/(en\/)?business(\/|$)/.test(s.pfad);
  const wurzel = business ? { name: "FIAON Global", pfad: s.sprache === "en" ? "/en/business" : "/business" } : { name: "FIAON", pfad: "/" };
  const kette = [wurzel, ...(s.krumen ?? []).filter((k) => !(business && k.pfad === wurzel.pfad))];
  if (kette.length < 2) return null; // Die Startseite eines Bereichs braucht keine Brotkrumen.
  const items = kette.map((k, i) => ({ "@type": "ListItem", position: i + 1, name: k.name, item: `${BASIS}${k.pfad}` }));
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function strukturierteDaten(s: SeoSeite, url: string): unknown[] {
  const ld: unknown[] = [organisationLd()];
  const fragen = seoFragen(s.pfad);
  if (s.pfad === "/") {
    ld.push({ "@context": "https://schema.org", "@type": "WebSite", "@id": `${BASIS}/#website`, name: "FIAON", url: BASIS, inLanguage: "de", publisher: { "@id": `${BASIS}/#organisation` } });
  } else {
    const krumen = breadcrumbLd(s);
    if (krumen) ld.push(krumen);
  }
  ld.push({
    "@context": "https://schema.org",
    "@type": s.art === "pfeiler" ? "Article" : "WebPage",
    "@id": `${url}#seite`,
    // 23.09.2026 (E-232): Sprache der Seite statt fest „de“ (englische Seiten trugen „de“), Erscheinungsdatum und Bild für Beiträge.
    url, name: s.titel, headline: s.h1, description: s.beschreibung, inLanguage: s.sprache === "en" ? "en" : "de",
    dateModified: s.stand, isPartOf: { "@id": `${BASIS}/#website` },
    ...(s.art === "pfeiler" ? {
      author: { "@id": `${BASIS}/#organisation` }, publisher: { "@id": `${BASIS}/#organisation` }, mainEntityOfPage: url,
      datePublished: s.erschienen ?? s.stand, image: s.bild || `${BASIS}/og-fiaon.jpg`,
    } : {}),
  });
  if (fragen.length) {
    ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: fragen.map((f) => ({ "@type": "Question", name: f.f, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  }
  if (s.werkzeug) {
    ld.push({ "@context": "https://schema.org", "@type": "WebApplication", name: s.werkzeug, url, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: s.sprache === "en" ? "en" : "de", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, provider: { "@id": `${BASIS}/#organisation` } });
  }
  if ((s.pfad === "/werkzeuge" || s.pfad === "/en/tools")) {
    ld.push({ "@context": "https://schema.org", "@type": "ItemList", name: s.sprache === "en" ? "Free FIAON tools" : "Kostenlose FIAON-Werkzeuge", itemListElement: (s.sprache === "en" ? SEO_WERKZEUGE_EN : SEO_WERKZEUGE).map((w, i) => ({ "@type": "ListItem", position: i + 1, name: w.name, url: `${BASIS}${s.sprache === "en" ? (schwesterPfad(w.pfad, "en") ?? w.pfad) : w.pfad}` })) });
  }
  if ((s.pfad === "/glossar-bonitaet" || s.pfad === "/en/credit-glossary")) {
    ld.push({ "@context": "https://schema.org", "@type": "DefinedTermSet", "@id": `${url}#glossar`, name: s.sprache === "en" ? "Credit glossary" : "Bonitäts-Glossar", inLanguage: s.sprache === "en" ? "en" : "de", hasDefinedTerm: (s.sprache === "en" ? SEO_GLOSSAR_EN : SEO_GLOSSAR).map((g) => ({ "@type": "DefinedTerm", name: g.wort, description: g.text, inDefinedTermSet: `${url}#glossar` })) });
  }
  if (s.pfad === "/preise" || s.pfad === "/privatkunden") {
    // Die Preise stehen in shared/fiaon-pakete.ts — hier nur die Spanne, damit
    // nie zwei Zahlen auseinanderlaufen. Zwölf Raten, monatlich.
    ld.push({ "@context": "https://schema.org", "@type": "Service", name: "FIAON Bonitäts-Programm", serviceType: "Bonitätsauskunft, Bereinigung von Auskunftei-Einträgen, Kontovorbereitung", provider: { "@id": `${BASIS}/#organisation` }, areaServed: ["DE", "AT", "CH"], url,
      offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: "7.99", highPrice: "99.99", offerCount: 4, url: `${BASIS}/preise` } });
  }
  // 19.09.2026 (E-191): /business trug bis hier das Markup des eingestellten Abos
  // „FIAON Business" (49,99–249,99 € im Monat). FIAON Global verkauft vier Pakete
  // zu Einmalpreisen — die Zahlen kommen aus dem Katalog, nie von Hand.
  if (s.pfad === "/business" || s.pfad === "/en/business" || s.global === "leistung" || s.global === "preise" || s.global === "zielgruppe" || s.global === "land") {
    const preise = GLOBAL_PAKETE.map((p) => (globalKatalog(p.key)?.preisCents ?? 0) / 100).filter((x) => x > 0);
    // 24.09.2026 (E-234): englische Seiten tragen das englische Angebot — bis heute stand auf /en/business das deutsche.
    const en = s.sprache === "en";
    const sp = en ? "en" : "de";
    ld.push({
      "@context": "https://schema.org", "@type": "Service", "@id": `${BASIS}${en ? "/en/business" : "/business"}#leistung`,
      name: "FIAON Global",
      serviceType: en ? "Formation of a US company, US tax numbers (EIN, ITIN), registered agent, preparation of account and card applications" : "Gründung einer US-Gesellschaft, US-Steuernummern (EIN, ITIN), Registered Agent, Vorbereitung von Konto- und Kartenanträgen",
      description: en ? "Your US company from one source: formation, EIN and ITIN, registered agent, US address, partner lawyer, partner tax adviser and US CPA — fixed price, one-off." : "US-Gesellschaft aus einer Hand: Gründung, EIN und ITIN, Registered Agent, US-Adresse, Partner-Anwalt, Partner-Steuerberater und US-CPA — Festpreis, einmalig.",
      provider: { "@id": `${BASIS}/#organisation` }, areaServed: ["DE", "AT", "CH"], audience: { "@type": "Audience", audienceType: en ? "Companies, self-employed people, founders and private individuals" : "Unternehmen, Selbständige, Gründer und Privatpersonen" }, url, inLanguage: sp,
      offers: {
        "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: Math.min(...preise).toFixed(2), highPrice: Math.max(...preise).toFixed(2), offerCount: preise.length, url: `${BASIS}${globalPaketePfad(sp)}`,
        offers: GLOBAL_PAKETE.map((p) => ({ "@type": "Offer", name: `FIAON ${p[sp].name}`, price: ((globalKatalog(p.key)?.preisCents ?? 0) / 100).toFixed(2), priceCurrency: "EUR", url: `${BASIS}${globalStartPfad(p.key, sp)}`, availability: "https://schema.org/InStock" })),
      },
    });
  }
  return ld;
}

// ── Der lesbare Korpus in #root ──────────────────────────────────────────────
function link(pfad: string, text: string): string { return `<a href="${esc(pfad)}">${esc(text)}</a>`; }

function weiterlesen(s: SeoSeite, nurBusiness = false): string {
  const en = s.sprache === "en";
  // Englische Seiten verweisen auf die englische Schwester des Ziels, wo es sie gibt.
  // Im Business-Rahmen nur Ziele der Business-Welt — das Impressum verweist sonst auf AGB und Kontakt der Privatkunden.
  const ziele = (s.weiter ?? []).map((p) => seoSeite(en ? (schwesterPfad(p, "en") ?? p) : p))
    .filter((z): z is SeoSeite => !!z && (!nurBusiness || /^\/(en\/)?business(\/|$)/.test(z.pfad)))
    // 24.09.2026 (E-234): Eine englische Business-Seite verweist nie auf eine deutsche (fehlende Schwester = kein Eintrag).
    .filter((z) => !(en && nurBusiness) || z.sprache === "en");
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

/**
 * 19.09.2026: Die Business-Welt hat ihren eigenen Rahmen (client: GlobalNav/GlobalFuss) — auch im
 * vorgerenderten Korpus. Eine Seite unter /business verlinkt dort FIAON Global, nicht die
 * Privatkunden-Themen: gleiche Botschaft für Leser und Suchmaschine.
 */
function seoRahmenBusiness(sprache: Sprache): { kopf: string; fuss: string } {
  const en = sprache === "en";
  const start = en ? "/en/business" : "/business";
  // 24.09.2026 (E-234): dieselben vier Spalten in beiden Sprachen — die Fachseiten gibt es jetzt auch englisch
  // (bis heute verwies die englische Seite auf die deutschen, „in German").
  const gruppen = globalMenue(sprache).map((g) => ({ titel: g.titel, eintraege: g.eintraege.map((e) => [e.pfad, e.titel]) }));
  const kopf = `<header><nav aria-label="FIAON Global"><a href="${start}" aria-label="FIAON Global"><strong>FIAON Global</strong></a><ul>${gruppen.flatMap((g) => g.eintraege).slice(0, 12).map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}</ul></nav></header>`;
  const recht = en ? [["/impressum?bereich=business", "Legal notice"], ["/datenschutz?bereich=business", "Privacy policy"], ["/en/business/widerrufsbelehrung", "Withdrawal instructions"], ["/en/business/mustervertrag", "Model contract"]] : [["/impressum?bereich=business", "Impressum"], ["/datenschutz?bereich=business", "Datenschutz"], ["/business/widerrufsbelehrung", "Widerrufsbelehrung"], ["/business/mustervertrag", "Mustervertrag"]];
  const zeile = `FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom · Companies House No. 17318250 · ${en ? "Phone" : "Telefon"} ${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}`;
  const fuss = `<footer>${gruppen.map((g) => `<nav aria-label="${esc(g.titel)}"><h2>${esc(g.titel)}</h2><ul>${g.eintraege.map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}</ul></nav>`).join("")}<nav aria-label="${en ? "Legal" : "Rechtliches"}"><ul>${recht.map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}</ul></nav><p>${esc(zeile)}</p></footer>`;
  return { kopf, fuss };
}

function korpus(s: SeoSeite, businessRahmen = false): string {
  const fragen = seoFragen(s.pfad);
  const en = s.sprache === "en";
  // Gemeinsame Seiten (Impressum …), aus der Business-Welt geöffnet, tragen deren Rahmen (routes.ts, ?bereich=business).
  const business = businessRahmen || /^\/(en\/)?business(\/|$)/.test(s.pfad);
  const { kopf: nav, fuss } = business ? seoRahmenBusiness(en ? "en" : "de") : seoRahmen(en ? "en" : "de");
  const wurzel = business ? link(en ? "/en/business" : "/business", "FIAON Global") : link(en ? "/en" : "/", "FIAON");
  const krumen = s.krumen?.length ? `<nav aria-label="${en ? "Breadcrumbs" : "Brotkrumen"}"><ol><li>${wurzel}</li>${s.krumen.filter((k) => !(business && k.pfad === (en ? "/en/business" : "/business"))).map((k) => `<li>${link(k.pfad, k.name)}</li>`).join("")}</ol></nav>` : "";
  const abschnitte = (s.abschnitte ?? []).map((a) => `<section><h2>${esc(a.h2)}</h2><p>${esc(a.text)}</p>${a.punkte?.length ? `<ul>${a.punkte.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</section>`).join("");
  const werkzeuge = (s.pfad === "/werkzeuge" || s.pfad === "/en/tools") ? `<section><h2>${s.sprache === "en" ? "The twenty tools" : "Die zwanzig Werkzeuge"}</h2><ul>${(s.sprache === "en" ? SEO_WERKZEUGE_EN : SEO_WERKZEUGE).map((w) => `<li>${link(s.sprache === "en" ? (schwesterPfad(w.pfad, "en") ?? w.pfad) : w.pfad, w.name)} – ${esc(w.frage)} ${esc(w.satz)}</li>`).join("")}</ul></section>` : "";
  const glossar = (s.pfad === "/glossar-bonitaet" || s.pfad === "/en/credit-glossary") ? `<section><h2>${s.sprache === "en" ? "The terms" : "Die Begriffe"}</h2><dl>${(s.sprache === "en" ? SEO_GLOSSAR_EN : SEO_GLOSSAR).map((g) => `<dt>${esc(g.wort)}</dt><dd>${esc(g.text)}</dd>`).join("")}</dl></section>` : "";
  const faq = fragen.length ? `<section><h2>${en ? "Frequently asked questions" : "Häufige Fragen"}</h2>${fragen.map((f) => `<h3>${esc(f.f)}</h3><p>${esc(f.a)}</p>`).join("")}</section>` : "";
  // 24.09.2026: Der Korpus ist bis zum Start von React der Ladezustand der Seite — und trägt deshalb
  // ihre Farbe. Dunkel wie die Bühne (Standard), hell wo die fertige Seite hell ist: FIAON Global
  // (Kanzlei), die Rechtstexte und die alte Auskunftsseite. Die Gestaltung steht in client/index.html.
  const hell = business || s.art === "recht" || HELLE_SEITEN.has(s.pfad);
  return `<div class="${hell ? "vorab vorab-hell" : "vorab"}">${nav}<main>${krumen}<article><h1>${esc(s.h1)}</h1><p>${esc(s.lead)}</p>${abschnitte}${werkzeuge}${glossar}${faq}${weiterlesen(s, business)}</article></main>${fuss}</div>`;
}

/** Öffentliche Seiten mit weißem Grund außerhalb von /business und den Rechtstexten (pages/bonitaet.tsx). */
const HELLE_SEITEN = new Set(["/bonitaet"]);

// ── WO DIE GESTALTUNG DES KORPUS WOHNT (24.09.2026) ───────────────────────────
// Hier stand VORAB_STIL: ein <style> vor </head> — weißer Grund, blaue Links
// (#1d4ed8). Genau das sah man die ersten Sekunden, bevor die dunkle Bühne kam
// (Justin: „ein komischer weißer Bildschirm"). Die Gestaltung steht jetzt in
// client/index.html, damit sie auf JEDER ausgelieferten Seite dieselbe ist
// (auch im Ratgeber) und ohne das 440-KB-Stilblatt greift. Weiterhin gilt:
// nichts wird versteckt (display:none wäre Cloaking).

/**
 * Fertiges HTML für eine öffentliche Seite — oder null, wenn sie nicht geführt wird.
 * `bereich: "business"`: eine gemeinsame Seite, aus der Business-Welt geöffnet — der Korpus bekommt
 * Kopf und Fuß von FIAON Global (19.09.2026, E-192). Kopf, canonical und strukturierte Daten bleiben gleich.
 */
export function seitenHtml(pfad: string, optionen: { bereich?: "business" } = {}): string | null {
  // „Mein Auftrag" aus der Mail (/business/auftrag/<Ref>?t=…) trägt den Kopf der Seite /business/auftrag —
  // vorher stand dort der Standardkopf „FIAON – Das Betriebssystem für Bonität", im Tab und in jeder Linkvorschau.
  const s = seoSeite(pfad) ?? seoSeite(pfad.replace(/^(\/(?:en\/)?business\/auftrag)\/[^/]+\/?$/, "$1"));
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
  const bildAlt = s.bild === GLOBAL_BILD ? "FIAON Global – Ihre US-Gesellschaft aus einer Hand" : s.bild === GLOBAL_BILD_EN ? "FIAON Global – your US company from one source" : undefined;
  const og: Record<string, string> = { type: s.art === "pfeiler" ? "article" : "website" };
  if (s.art === "pfeiler") { og.erschienen = s.erschienen ?? s.stand; og.geaendert = s.stand; }
  let out = kopfEinsetzen(html, { titel: s.titel, beschreibung, url, ld, robots: s.robots, bild: s.bild, bildAlt, og, sprache, alternativen });
  // Der Korpus nur für indexierbare Seiten — ein Login-Formular braucht
  // keinen Vorab-Text, und interne Wege sollen nichts preisgeben.
  if (!s.robots?.includes("noindex")) {
    out = out.replace('<div id="root"></div>', `<div id="root">${korpus(s, optionen.bereich === "business")}</div>`);
  }
  return out;
}

// ── Unbekannte Adressen unter /business: echtes 404 statt Soft-404 ───────────
// (19.09.2026)
// Befund, live geprüft: https://fiaon.com/business/gibt-es-nicht antwortete
// mit 200, dem Standardkopf „FIAON – Das Betriebssystem für Bonität“ und
// index,follow. Der Client zeigt dort „Diese Seite existiert nicht“ — für
// Google ein Soft-404: Jede Müll-Adresse darf in den Index.
//
// Für die ganze Website lässt sich das nicht entscheiden: Konto, Portal und
// Formulare stehen in keiner Tabelle. Unter /business aber kennt der Server
// JEDE gültige Adresse — das Register (shared/fiaon-global-seiten), die
// SEO-Tabelle und die App-Wege unten. Alles andere dort bekommt 404 mit
// noindex. Ausgeliefert wird weiterhin die SPA: Der Besucher sieht dieselbe
// Nicht-gefunden-Ansicht wie bisher, nur Status und Kopf stimmen jetzt.
//
// Neue Seite unter /business → Eintrag im Register oder in der SEO-Tabelle.
// Ein Weg ohne Eintrag (Formular, Kundenkonto) gehört in BUSINESS_APP_WEGE,
// sonst antwortet er mit 404. scripts/pruef-global-seiten.ts hält jede
// /business-Route aus client/src/App.tsx dagegen.
const BUSINESS = /^\/(en\/)?business(\/|$)/;
const BUSINESS_APP_WEGE = [
  /^\/(en\/)?business$/,                    // Übersicht
  /^\/(en\/)?business\/start$/,             // Auftrag erteilen
  /^\/(en\/)?business\/auftrag(\/[^/]+)?$/, // Mein Auftrag, auch mit Referenz
];

/** true = die Adresse liegt unter /business (auch /en/business) und ist dort keine Seite → 404. */
export function seiteUnbekannt(pfad: string): boolean {
  const p = (pfad.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
  if (!BUSINESS.test(p) || BUSINESS_APP_WEGE.some((w) => w.test(p))) return false;
  return !seoSeite(p) && !globalSeite(p) && !globalLandingpage(p);
}

/** Die Nicht-gefunden-Antwort: die SPA mit eigenem Titel, noindex und ohne canonical. Den Status 404 setzt der Aufrufer. */
export function nichtGefundenHtml(pfad: string): string | null {
  const html = indexHtml();
  if (!html) return null;
  // Wie die Nicht-gefunden-Ansicht des Clients (client/src/pages/not-found.tsx): unter /business die von
  // FIAON Global, unter /en englisch (19.09.2026, E-192).
  const en = /^\/en(\/|$)/.test(pfad);
  return kopfEinsetzen(html, {
    titel: en ? "Page not found — FIAON Global" : "Seite nicht gefunden — FIAON Global",
    beschreibung: en ? "This address does not exist at FIAON Global — perhaps a typo or an outdated link." : "Diese Adresse gibt es bei FIAON Global nicht – vielleicht ein Tippfehler oder ein veralteter Link.",
    url: `${BASIS}${pfad}`, robots: "noindex", canonical: false, sprache: en ? "en" : "de",
  });
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
