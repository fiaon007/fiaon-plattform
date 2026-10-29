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
  seoSeite, seoFragen, seoIndexierbar, type SeoSeite, type SeoAbschnitt, schwesterPfad } from "@shared/fiaon-seo-seiten";
import { EN_NAV, EN_FUSS, type Sprache } from "../../shared/fiaon-sprache";
import { GLOBAL_PAKETE, globalKatalog } from "@shared/fiaon-global";
import { globalMenue } from "@shared/fiaon-global-menue";
import { globalStartPfad, globalPaketePfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA, fiaonVerwechslung } from "@shared/fiaon-firma";
import { istOesterreichSeite } from "@shared/fiaon-global-wortregeln";
import { SOZIALE_PROFILE } from "@shared/fiaon-sozial";
import { markeSvg, MARKE_NAVY } from "@shared/fiaon-marke";
import { ogBusinessBild, istBusinessPfad } from "@shared/fiaon-og-business-regeln";
import { BUSINESS_START, PRIVAT_START } from "@shared/fiaon-business-grenze";
import { businessArtikelPfad } from "@shared/fiaon-business-artikel";
import { businessArtikel } from "./fiaon-business-artikel-liste";
import { begriffStand, begriffeVerlinken } from "@shared/fiaon-global-begriffe";
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
  // 27.10.2026 (E-439): Die Notizen im Quelltext von index.html (Entwicklungsgeschichte, E-Nummern, das Konto der
  // Search Console) gehen nicht an Besucher und Crawler. Nur die Platzhalter <!--FIAON-…--> bleiben stehen.
  const html = fs.readFileSync(f, "utf8").replace(/<!--(?!FIAON-[A-Z-]+-->)[\s\S]*?-->\s*/g, "");
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
    // 27.10.2026 (E-439): Alle Vorschaubilder des Hauses sind 1200×630-JPEGs; Maße und Typ stehen
    // ausdrücklich da, damit LinkedIn/WhatsApp die große Karte zeigen, ohne das Bild erst zu laden.
    setz("og:image:type", "property", "image/jpeg");
    setz("og:image:width", "property", "1200");
    setz("og:image:height", "property", "630");
    // Ohne eigenen Alternativtext bliebe der aus index.html („Betriebssystem für Bonität“) stehen — dann lieber der Titel.
    const alt = kopf.bildAlt || kopf.titel;
    setz("og:image:alt", "property", alt); setz("twitter:image:alt", "name", alt);
    setz("twitter:card", "name", "summary_large_image");
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
/**
 * 27.10.2026 (E-439): Die Business-Welt trägt ihren eigenen Namen im Kopf. Vorher standen auf jeder
 * Business-Seite die Stichwörter der Privatkunden („SCHUFA Eintrag löschen …“) und og:site_name „FIAON“.
 * Google liest meta keywords nicht, Bing wertet fremde Stichwörter als Rauschen — also weg damit.
 */
export function businessKopf(html: string): string {
  return html
    .replace(/\s*<meta name="keywords" content="[^"]*"\s*\/?>/, "")
    .replace(/<meta property="og:site_name" content="[^"]*"\s*\/?>/, '<meta property="og:site_name" content="FIAON Global" />');
}

/**
 * Optionen für den Datenblock der Organisation (28.10.2026, E-454):
 * `sprache` — Sprache der Seite (der Klärungssatz disambiguatingDescription steht deutsch oder englisch; Standard Deutsch).
 * `oesterreich` — Österreich-Seite: keine Selbstbezeichnung „Unternehmensberatung“/„business consultancy“ (AT § 94 Z 74 GewO, E-439).
 */
export interface OrganisationOptionen { sprache?: Sprache; oesterreich?: boolean }

export function organisationLd(bereich?: "business", optionen: OrganisationOptionen = {}): Record<string, unknown> {
  // 27.10.2026 (E-439): Auf Business-Seiten nennt die Organisation nur die Themen von FIAON Global — vorher trugen auch die
  // Anzeigen-Landingpages „SCHUFA“, „Inkasso“, „Kreditkarte trotz Eintrag“ im Datenblock (Google liest die Zielseite mit).
  const business = bereich === "business";
  const sp: Sprache = optionen.sprache === "en" ? "en" : "de";
  // 28.10.2026 (E-454): Auf der Österreich-Seite ohne „Unternehmensberatung“ — dieselben Leistungen, neutral beschrieben.
  const oesterreichText = sp === "en"
    ? "FIAON LTD (London) with FIAON Global: your US company from one source — formation, EIN and ITIN, registered agent, preparation of account and card applications, US compliance — for companies and private individuals in Germany, Austria and Switzerland."
    : "FIAON LTD (London) mit FIAON Global: die US-Gesellschaft aus einer Hand — Gründung, EIN und ITIN, Registered Agent, Vorbereitung von Konto- und Kartenanträgen, US-Pflichten — für Unternehmen und Privatpersonen aus Deutschland, Österreich und der Schweiz.";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASIS}/#organisation`,
    name: "FIAON",
    legalName: "FIAON LTD",
    url: BASIS,
    logo: { "@type": "ImageObject", url: `${BASIS}/icon-512.png?v=3`, width: 512, height: 512 },
    image: `${BASIS}/og-fiaon.jpg?v=2`,
    description: business && optionen.oesterreich ? oesterreichText : business
      ? "FIAON LTD (London) mit FIAON Global, der Unternehmensberatung für die US-Gesellschaft aus einer Hand: Gründung, EIN und ITIN, Registered Agent, Vorbereitung von Konto- und Kartenanträgen, US-Pflichten — für Unternehmen und Privatpersonen aus Deutschland, Österreich und der Schweiz."
      : "Das Betriebssystem für Bonität: Einsicht, Aktion, Zugang – in Deutschland, Österreich und der Schweiz. Mit FIAON Global die US-Gesellschaft aus einer Hand: Gründung, EIN und ITIN, Registered Agent, Vorbereitung von Konto- und Kartenanträgen, US-Pflichten.",
    // 23.09.2026 (E-232): die Registernummer als eindeutige Kennung — für Suchmaschinen und KI-Assistenten, die Firmen zuordnen.
    identifier: { "@type": "PropertyValue", propertyID: "Companies House (England and Wales)", value: FIAON_FIRMA.companyNo },
    // 28.10.2026 (E-454): KI-Suchen verwechselten FIAON mit FXON, Fxonet, fiona.com und FIA Global — ein Satz klärt es (shared/fiaon-firma.ts).
    disambiguatingDescription: fiaonVerwechslung(sp),
    address: { "@type": "PostalAddress", streetAddress: "128 City Road", addressLocality: "London", postalCode: "EC1V 2NX", addressCountry: "GB" },
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", telephone: "+41442449301", email: "support@fiaon.com", availableLanguage: ["de", "en"], areaServed: ["DE", "AT", "CH"] }],
    areaServed: [{ "@type": "Country", name: "Deutschland" }, { "@type": "Country", name: "Österreich" }, { "@type": "Country", name: "Schweiz" }],
    // 27.10.2026 (E-439): FIAON spricht Deutsch und Englisch (56 + 53 englische Seiten); FIAON Global ist ein eigener Knoten.
    knowsLanguage: ["de", "en"],
    // 29.10.2026 (E-461): FIAON Global ist die Startseite von fiaon.com (vorher /business).
    brand: [{ "@type": "Brand", name: "FIAON Global", url: `${BASIS}/` }],
    subOrganization: { "@id": `${BASIS}/#fiaon-global` },
    knowsAbout: [...(business ? [] : ["Bonität", "SCHUFA", "KSV1870", "CRIF", "Bonitätsauskunft", "Löschfristen", "Inkasso", "Kreditkarte trotz Eintrag"]),
      "US-LLC-Gründung", "US-Firmengründung aus Deutschland", "Employer Identification Number (EIN)", "ITIN", "Form 5472", "Registered Agent", "US-Geschäftskonto", "US-Firmenkarten"],
    // 24.09.2026 (E-234, Justin: „Profile freigeben … mach alles du"): Nur was nachweislich FIAON ist.
    // Der Registereintrag im Companies House ist die amtliche Seite der Firma. Eine LinkedIn-Firmenseite
    // gibt es noch nicht, einen Trustpilot-Eintrag auch nicht (Prüfung 23.09.: die „2.347 Bewertungen" auf /start waren
    // erfunden); die neue Facebook-Seite „FIAON" kommt dazu, sobald ihre Adresse feststeht. Nie erfinden.
    // 06.10.2026 (E-292): Instagram fiaon.ltd und die Facebook-Seite „FIAON“ — per Graph geprüft (Seite ↔ IG verbunden).
    sameAs: [
      `https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}`,
      ...SOZIALE_PROFILE.map((p) => p.href),
    ],
  };
}

/**
 * 27.10.2026 (E-439): FIAON Global als eigene Entität — für Google, Bing und KI-Assistenten, die eine Marke einem
 * Unternehmen zuordnen. Vorher kannte das Markup nur „FIAON — Das Betriebssystem für Bonität“, auch auf /en/business.
 * Justin (27.10.2026): FIAON Global ist eine Unternehmensberatung (E-439, Wortregel freigegeben) — außer auf der
 * Österreich-Seite (`oesterreich`, E-454: AT § 94 Z 74 GewO).
 * Nur wahre, prüfbare Angaben: Vertragspartner FIAON LTD (Companies House), Standorte wie auf /business/partner.
 */
export function globalOrganisationLd(sprache: Sprache = "de", optionen: Pick<OrganisationOptionen, "oesterreich"> = {}): Record<string, unknown> {
  const en = sprache === "en";
  // 28.10.2026 (E-454): Auf der Österreich-Seite heißt FIAON Global „Marke der FIAON LTD“ statt „Unternehmensberatung“, ohne alternateName.
  const at = !!optionen.oesterreich;
  const wer = en ? (at ? "a brand" : "the business consultancy") : (at ? "eine Marke" : "die Unternehmensberatung");
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${BASIS}/#fiaon-global`,
    name: "FIAON Global",
    ...(at ? {} : { alternateName: en ? ["FIAON Global business consultancy"] : ["FIAON Global Unternehmensberatung"] }),
    // 29.10.2026 (E-461): die Startseite von fiaon.com — vorher /business und /en/business (leiten per 301 hierher).
    url: `${BASIS}${en ? BUSINESS_START.en : "/"}`,
    logo: { "@type": "ImageObject", url: `${BASIS}/icon-512.png?v=3`, width: 512, height: 512 },
    image: ogBusinessBild(en ? BUSINESS_START.en : BUSINESS_START.de)?.url ?? `${BASIS}/og-global.jpg?v=2`,
    slogan: en ? "One contact instead of eight." : "Ein Ansprechpartner statt acht.",
    description: en
      ? `FIAON Global is ${wer} of FIAON LTD (London, Companies House 17318250) for companies, self-employed people, founders and private individuals in Germany, Austria and Switzerland: forming a US company (LLC or corporation), EIN and ITIN, registered agent, US address, preparation of bank account and business credit card applications, US compliance and the planned path to capital — from one source, at a fixed price, with a team on the ground in Miami. FIAON is neither a bank nor a law firm and does not broker loans; the institution concerned decides on every account, card and limit.`
      : `FIAON Global ist ${wer} der FIAON LTD (London, Companies House 17318250) für Unternehmen, Selbständige, Gründer und Privatpersonen aus Deutschland, Österreich und der Schweiz: Gründung einer US-Gesellschaft (LLC oder Corporation), EIN und ITIN, Registered Agent, US-Adresse, Vorbereitung von Konto- und Firmenkartenanträgen, US-Pflichten und der geplante Weg zum Kapital — aus einer Hand, zum Festpreis, mit Team vor Ort in Miami. FIAON ist keine Bank und keine Kanzlei und vermittelt keine Kredite; über Konto, Karte und Rahmen entscheidet allein das Institut.`,
    disambiguatingDescription: fiaonVerwechslung(en ? "en" : "de", `FIAON Global (${FIAON_FIRMA.name}, London, Companies House ${FIAON_FIRMA.companyNo})`),
    parentOrganization: { "@id": `${BASIS}/#organisation` },
    address: { "@type": "PostalAddress", streetAddress: "128 City Road", addressLocality: "London", postalCode: "EC1V 2NX", addressCountry: "GB" },
    areaServed: (en ? ["Germany", "Austria", "Switzerland"] : ["Deutschland", "Österreich", "Schweiz"]).map((name) => ({ "@type": "Country", name })),
    knowsLanguage: ["de", "en"],
    knowsAbout: en
      ? ["US company formation", "US LLC for non-residents", "Employer Identification Number (EIN)", "ITIN", "Registered agent", "Form 5472", "US business bank account", "US business credit", "US business credit cards", "US market entry", "E-2 visa (basics)"]
      : ["US-Firmengründung", "US-LLC für Ausländer", "Employer Identification Number (EIN)", "ITIN", "Registered Agent", "Form 5472", "US-Geschäftskonto", "US-Funding und Business Credit", "US-Firmenkarten", "Markteintritt USA", "E-2-Visum (Grundzüge)"],
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", telephone: "+41442449301", email: "support@fiaon.com", availableLanguage: ["de", "en"], areaServed: ["DE", "AT", "CH"] }],
    sameAs: [`https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}`],
  };
}

function breadcrumbLd(s: SeoSeite): Record<string, unknown> | null {
  // 19.09.2026 (E-192): Die Business-Welt beginnt bei FIAON Global, nicht auf der Startseite
  // der Privatkunden — wie die sichtbaren Brotkrumen (globalKrumen) und korpus() unten.
  // 29.10.2026 (E-461): FIAON Global beginnt auf fiaon.com/ (und /en), die Privat-Welt auf /privat (und /en/private).
  const business = istBusinessPfad(s.pfad);
  const sp: Sprache = s.sprache === "en" ? "en" : "de";
  const wurzel = business ? { name: "FIAON Global", pfad: BUSINESS_START[sp] } : { name: "FIAON", pfad: PRIVAT_START[sp] };
  const kette = [wurzel, ...(s.krumen ?? []).filter((k) => !(business && k.pfad === wurzel.pfad))];
  if (kette.length < 2) return null; // Die Startseite eines Bereichs braucht keine Brotkrumen.
  const items = kette.map((k, i) => ({ "@type": "ListItem", position: i + 1, name: k.name, item: `${BASIS}${k.pfad}` }));
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function strukturierteDaten(s: SeoSeite, url: string): unknown[] {
  const sp: Sprache = s.sprache === "en" ? "en" : "de";
  const oesterreich = istOesterreichSeite(s.pfad);
  const ld: unknown[] = [organisationLd(istBusinessPfad(s.pfad) ? "business" : undefined, { sprache: sp, oesterreich })];
  const fragen = seoFragen(s.pfad);
  // 29.10.2026 (E-461): Die Startseite ist FIAON Global — die Website bleibt „FIAON“ (Dach für beide Welten), mit
  // FIAON Global als zweitem Namen. Herausgeber ist die Firma (#organisation), FIAON Global ihr Unterknoten.
  if (s.pfad === "/") {
    ld.push({ "@context": "https://schema.org", "@type": "WebSite", "@id": `${BASIS}/#website`, name: "FIAON", alternateName: ["FIAON Global"], url: `${BASIS}/`, inLanguage: ["de", "en"], publisher: { "@id": `${BASIS}/#organisation` } });
  } else {
    const krumen = breadcrumbLd(s);
    if (krumen) ld.push(krumen);
  }
  const imBusiness = istBusinessPfad(s.pfad);
  if (imBusiness) ld.push(globalOrganisationLd(sp, { oesterreich }));
  const herausgeber = { "@id": `${BASIS}/${imBusiness ? "#fiaon-global" : "#organisation"}` };
  ld.push({
    "@context": "https://schema.org",
    "@type": s.art === "pfeiler" ? "Article" : "WebPage",
    "@id": `${url}#seite`,
    // 23.09.2026 (E-232): Sprache der Seite statt fest „de“ (englische Seiten trugen „de“), Erscheinungsdatum und Bild für Beiträge.
    url, name: s.titel, headline: s.h1, description: s.beschreibung, inLanguage: s.sprache === "en" ? "en" : "de",
    dateModified: s.stand, isPartOf: { "@id": `${BASIS}/#website` },
    ...(s.art === "pfeiler" ? {
      author: herausgeber, publisher: herausgeber, mainEntityOfPage: url,
      datePublished: s.erschienen ?? s.stand, image: s.bild || `${BASIS}/og-fiaon.jpg?v=2`,
    } : {}),
  });
  if (s.global === "hub") {
    const en = s.sprache === "en";
    const teile = [
      ...(s.abschnitte ?? []).flatMap((a) => a.links ?? []).map((l) => ({ url: `${BASIS}${l.pfad}`, name: l.text })),
      ...businessArtikel(en ? "en" : "de").slice(0, 80).map((a) => ({ url: `${BASIS}${businessArtikelPfad(a.slug, a.sprache)}`, name: a.titel })),
    ];
    ld.push({ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${url}#sammlung`, name: s.h1, url, inLanguage: en ? "en" : "de",
      publisher: { "@id": `${BASIS}/#fiaon-global` },
      mainEntity: { "@type": "ItemList", itemListElement: teile.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: x.url, name: x.name })) } });
  }
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
  // 29.10.2026 (E-461): die Übersicht ist die Startseite (/ und /en), nicht mehr /business.
  if (s.pfad === BUSINESS_START.de || s.pfad === BUSINESS_START.en || s.global === "leistung" || s.global === "preise" || s.global === "zielgruppe" || s.global === "land") {
    const preise = GLOBAL_PAKETE.map((p) => (globalKatalog(p.key)?.preisCents ?? 0) / 100).filter((x) => x > 0);
    // 24.09.2026 (E-234): englische Seiten tragen das englische Angebot — bis heute stand auf /en/business das deutsche.
    const en = s.sprache === "en";
    const sp = en ? "en" : "de";
    ld.push({
      "@context": "https://schema.org", "@type": "Service", "@id": `${BASIS}${en ? BUSINESS_START.en : "/"}#leistung`,
      name: "FIAON Global",
      serviceType: en ? "Formation of a US company, US tax numbers (EIN, ITIN), registered agent, preparation of account and card applications" : "Gründung einer US-Gesellschaft, US-Steuernummern (EIN, ITIN), Registered Agent, Vorbereitung von Konto- und Kartenanträgen",
      description: en ? "Your US company from one source: formation, EIN and ITIN, registered agent, US address, partner lawyer, partner tax adviser and US CPA — fixed price, one-off." : "US-Gesellschaft aus einer Hand: Gründung, EIN und ITIN, Registered Agent, US-Adresse, Partner-Anwalt, Partner-Steuerberater und US-CPA — Festpreis, einmalig.",
      provider: { "@id": `${BASIS}/#fiaon-global` }, areaServed: ["DE", "AT", "CH"], audience: { "@type": "Audience", audienceType: en ? "Companies, self-employed people, founders and private individuals" : "Unternehmen, Selbständige, Gründer und Privatpersonen" }, url, inLanguage: sp,
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
    .filter((z): z is SeoSeite => !!z && (!nurBusiness || istBusinessPfad(z.pfad)))
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
  // 29.10.2026 (E-461): Das Logo der Privat-Welt führt auf ihre Startseite /privat (fiaon.com/ ist FIAON Global).
  const kopf = `<header><nav aria-label="${en ? "Main navigation" : "Hauptnavigation"}"><a href="${en ? PRIVAT_START.en : PRIVAT_START.de}" aria-label="${en ? "FIAON home" : "FIAON Startseite"}">${markeSvg("fiaon", MARKE_NAVY, "20px")}</a><ul>${nav.map(([p, t]) => `<li>${link(ziel(p), t)}</li>`).join("")}</ul></nav></header>`;
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
export function seoRahmenBusiness(sprache: Sprache): { kopf: string; fuss: string } {
  const en = sprache === "en";
  const start = en ? BUSINESS_START.en : BUSINESS_START.de;
  // 24.09.2026 (E-234): dieselben vier Spalten in beiden Sprachen — die Fachseiten gibt es jetzt auch englisch
  // (bis heute verwies die englische Seite auf die deutschen, „in German").
  const gruppen = globalMenue(sprache).map((g) => ({ titel: g.titel, eintraege: g.eintraege.map((e) => [e.pfad, e.titel]) }));
  // 29.10.2026 (E-461): Seit fiaon.com/ FIAON Global ist, führt ein leiser Link zur Privat-Startseite (wie im Kopf des Browsers).
  const privat = link(en ? PRIVAT_START.en : PRIVAT_START.de, en ? "Personal customers" : "Privatkunden");
  const kopf = `<header><nav aria-label="FIAON Global"><a href="${start}" aria-label="FIAON Global"><strong>FIAON Global</strong></a><ul>${gruppen.flatMap((g) => g.eintraege).slice(0, 12).map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}<li>${privat}</li></ul></nav></header>`;
  const recht = en ? [["/impressum?bereich=business", "Legal notice"], ["/datenschutz?bereich=business", "Privacy policy"], ["/en/business/widerrufsbelehrung", "Withdrawal instructions"], ["/en/business/mustervertrag", "Model contract"], ["/en/is-fiaon-legit", "Is FIAON legit?"]] : [["/impressum?bereich=business", "Impressum"], ["/datenschutz?bereich=business", "Datenschutz"], ["/business/widerrufsbelehrung", "Widerrufsbelehrung"], ["/business/mustervertrag", "Mustervertrag"], ["/ist-fiaon-serioes", "Ist FIAON seriös?"]];
  const zeile = `FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom · Companies House No. 17318250 · ${en ? "Phone" : "Telefon"} ${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}`;
  const fuss = `<footer>${gruppen.map((g) => `<nav aria-label="${esc(g.titel)}"><h2>${esc(g.titel)}</h2><ul>${g.eintraege.map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}</ul></nav>`).join("")}<nav aria-label="${en ? "Legal" : "Rechtliches"}"><ul>${recht.map(([p, t]) => `<li>${link(p, t)}</li>`).join("")}</ul></nav><p>${esc(zeile)}</p></footer>`;
  return { kopf, fuss };
}

function korpus(s: SeoSeite, businessRahmen = false): string {
  const fragen = seoFragen(s.pfad);
  const en = s.sprache === "en";
  // Gemeinsame Seiten (Impressum …), aus der Business-Welt geöffnet, tragen deren Rahmen (routes.ts, ?bereich=business).
  const business = businessRahmen || istBusinessPfad(s.pfad);
  const { kopf: nav, fuss } = business ? seoRahmenBusiness(en ? "en" : "de") : seoRahmen(en ? "en" : "de");
  // 29.10.2026 (E-461): Wurzel FIAON Global = fiaon.com/ (und /en), Wurzel der Privat-Welt = /privat (und /en/private).
  const wurzelPfad = business ? BUSINESS_START[en ? "en" : "de"] : PRIVAT_START[en ? "en" : "de"];
  const wurzel = link(wurzelPfad, business ? "FIAON Global" : "FIAON");
  const krumen = s.krumen?.length ? `<nav aria-label="${en ? "Breadcrumbs" : "Brotkrumen"}"><ol><li>${wurzel}</li>${s.krumen.filter((k) => k.pfad !== wurzelPfad).map((k) => `<li>${link(k.pfad, k.name)}</li>`).join("")}</ol></nav>` : "";
  // 27.10.2026 (E-439): Tabellen als <table>, Verzeichnisse als Links, Quellen als verlinkte Liste — vorher stand
  // hier alles als flache Aufzählung, und die Quellen sah nur, wer JavaScript ausführt (KI-Crawler tun das nicht).
  const tabelleHtml = (t: NonNullable<SeoAbschnitt["tabelle"]>) =>
    `<table><thead><tr>${t.kopf.map((k) => `<th scope="col">${esc(k)}</th>`).join("")}</tr></thead><tbody>${t.zeilen.map((z) => `<tr>${z.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>${t.fuss?.length ? t.fuss.map((f) => `<p><small>${esc(f)}</small></p>`).join("") : ""}`;
  // E-439: Fachbegriffe im Fließtext der Business-Seiten verlinken (dieselbe Regel wie im Browser).
  const begriffe = istBusinessPfad(s.pfad) ? begriffStand(en ? "en" : "de", s.pfad, (p) => !!seoSeite(p) || !!globalSeite(p)) : null;
  const absatz = (text: string) => (begriffe ? begriffeVerlinken(text, begriffe).map((t) => (typeof t === "string" ? esc(t) : link(t.pfad, t.text))).join("") : esc(text));
  const abschnitte = (s.abschnitte ?? []).map((a) => {
    const unten = a.tabelle ? tabelleHtml(a.tabelle)
      : a.links?.length ? `<ul>${a.links.map((l) => `<li>${link(en && !l.pfad.startsWith("/en/") ? (schwesterPfad(l.pfad, "en") ?? l.pfad) : l.pfad, l.text)}</li>`).join("")}</ul>`
      : a.punkte?.length ? `<ul>${a.punkte.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
    return `<section><h2>${esc(a.h2)}</h2>${a.text ? `<p>${absatz(a.text)}</p>` : ""}${unten}</section>`;
  }).join("");
  // 27.10.2026 (E-439): Die Wissens-Übersicht nennt die Artikel der Redaktion als echte Links (vorher nur per JavaScript).
  const redaktion = s.global === "hub" ? businessArtikel(en ? "en" : "de") : [];
  const aktuell = redaktion.length
    ? `<section><h2>${en ? "Latest from the editorial team" : "Aktuell aus der Redaktion"}</h2><ul>${redaktion.slice(0, 80).map((a) => `<li>${link(businessArtikelPfad(a.slug, a.sprache), a.titel)} – ${esc(a.teaser)}</li>`).join("")}</ul></section>`
    : "";
  const quellen = s.quellen?.length
    ? `<section><h2>${en ? "Sources" : "Quellen"}</h2><ol>${s.quellen.map((q) => `<li><a href="${esc(q.url)}" rel="noopener">${esc(q.titel)}</a></li>`).join("")}</ol><p><small>${en ? "As of" : "Stand"} ${esc(s.stand)}</small></p></section>`
    : "";
  const werkzeuge = (s.pfad === "/werkzeuge" || s.pfad === "/en/tools") ? `<section><h2>${s.sprache === "en" ? "The twenty tools" : "Die zwanzig Werkzeuge"}</h2><ul>${(s.sprache === "en" ? SEO_WERKZEUGE_EN : SEO_WERKZEUGE).map((w) => `<li>${link(s.sprache === "en" ? (schwesterPfad(w.pfad, "en") ?? w.pfad) : w.pfad, w.name)} – ${esc(w.frage)} ${esc(w.satz)}</li>`).join("")}</ul></section>` : "";
  const glossar = (s.pfad === "/glossar-bonitaet" || s.pfad === "/en/credit-glossary") ? `<section><h2>${s.sprache === "en" ? "The terms" : "Die Begriffe"}</h2><dl>${(s.sprache === "en" ? SEO_GLOSSAR_EN : SEO_GLOSSAR).map((g) => `<dt>${esc(g.wort)}</dt><dd>${esc(g.text)}</dd>`).join("")}</dl></section>` : "";
  const faq = fragen.length ? `<section><h2>${en ? "Frequently asked questions" : "Häufige Fragen"}</h2>${fragen.map((f) => `<h3>${esc(f.f)}</h3><p>${esc(f.a)}</p>`).join("")}</section>` : "";
  // 24.09.2026: Der Korpus ist bis zum Start von React der Ladezustand der Seite — und trägt deshalb
  // ihre Farbe. Dunkel wie die Bühne (Standard), hell wo die fertige Seite hell ist: FIAON Global
  // (Kanzlei), die Rechtstexte und die alte Auskunftsseite. Die Gestaltung steht in client/index.html.
  const hell = business || s.art === "recht" || HELLE_SEITEN.has(s.pfad);
  return `<div class="${hell ? "vorab vorab-hell" : "vorab"}">${nav}<main>${krumen}<article><h1>${esc(s.h1)}</h1><p>${esc(s.lead)}</p>${abschnitte}${aktuell}${werkzeuge}${glossar}${faq}${quellen}${weiterlesen(s, business)}</article></main>${fuss}</div>`;
}

/**
 * Öffentliche Seiten mit weißem Grund außerhalb von /business und den Rechtstexten.
 * 25.09.2026 (E-241): /bonitaet ist keine helle Seite mehr — sie leitet per 301 (routes.ts, UMGEZOGEN)
 * auf die dunkle Übersicht /bonitaetsauskunft. Die Menge bleibt für künftige helle Seiten.
 */
const HELLE_SEITEN = new Set<string>([]);

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
  const ld = s.robots?.includes("noindex")
    ? [organisationLd(istBusinessPfad(s.pfad) ? "business" : undefined, { sprache: s.sprache === "en" ? "en" : "de", oesterreich: istOesterreichSeite(s.pfad) })]
    : strukturierteDaten(s, url);
  const sprache: Sprache = s.sprache === "en" ? "en" : "de";
  const absolut = (p: string) => `${BASIS}${p === "/" ? "/" : p}`;
  const alternativen = s.schwester
    ? { de: absolut(sprache === "de" ? s.pfad : s.schwester), en: absolut(sprache === "en" ? s.pfad : s.schwester) }
    : undefined;
  // 27.10.2026 (E-439): Jede Business-Adresse zeigt ihr eigenes Vorschaubild (scripts/og-business-bilder.ts);
  // fehlt es, bleibt das der Tabelle (GLOBAL_BILD). Eine Regel für Register, Übersichten und Landingpages.
  const eigenesBild = istBusinessPfad(s.pfad) ? ogBusinessBild(s.pfad) : null;
  const bild = s.bild === "" ? "" : eigenesBild?.url ?? s.bild;
  const bildAlt = eigenesBild?.alt ?? s.bildAlt ?? (s.bild === GLOBAL_BILD ? "FIAON Global – Ihre US-Gesellschaft aus einer Hand" : s.bild === GLOBAL_BILD_EN ? "FIAON Global – your US company from one source" : undefined);
  const og: Record<string, string> = { type: s.art === "pfeiler" ? "article" : "website" };
  if (s.art === "pfeiler") { og.erschienen = s.erschienen ?? s.stand; og.geaendert = s.stand; }
  let out = kopfEinsetzen(html, { titel: s.titel, beschreibung, url, ld, robots: s.robots, bild, bildAlt, og, sprache, alternativen });
  if (istBusinessPfad(s.pfad)) out = businessKopf(out);
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
  /^\/business\/angebot\/[^/]+$/,            // Individualangebot mit Token (01.10.2026, E-268)
  // E-423 (22.10.2026): der persönliche Zugang — Anmeldung, Passwort vergessen, Zugang einrichten, Übersicht.
  /^\/business\/(login|passwort-vergessen|zugang|konto)$/,
  /^\/en\/business\/(login|forgot-password|access|account)$/,
];

// 05.10.2026 (E-283): Das AGB-Archiv /agb/<Fassung>. Jede Fassung, die es gibt, steht mit noindex in der
// SEO-Tabelle (shared/fiaon-seo-seiten.ts, aus AGB_FASSUNG und AGB_FRUEHERE_FASSUNGEN) und kommt mit 200 —
// eine Vertragsadresse darf nie als 404 antworten. Jede andere Adresse dort ist keine Seite: 404 mit noindex,
// der Browser zeigt den Hinweis mit Link auf /agb (client/src/pages/agb-archiv).
const AGB_ARCHIV = /^\/agb\/[^/]+$/;

/** true = die Adresse liegt unter /business (auch /en/business) oder im AGB-Archiv und ist dort keine Seite → 404. */
export function seiteUnbekannt(pfad: string): boolean {
  const p = (pfad.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
  if (AGB_ARCHIV.test(p)) return !seoSeite(p);
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
  // E-283 (05.10.2026): Das AGB-Archiv gehört zu FIAON, nicht zu FIAON Global.
  if (!BUSINESS.test(pfad.toLowerCase())) {
    return kopfEinsetzen(html, {
      titel: "Seite nicht gefunden — FIAON",
      beschreibung: "Diese Adresse gibt es bei FIAON nicht – vielleicht ein Tippfehler oder ein veralteter Link.",
      url: `${BASIS}${pfad}`, robots: "noindex", canonical: false, sprache: "de",
    });
  }
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
