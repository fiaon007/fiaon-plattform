// ═══════════════════════════════════════════════════════════════════════════
// /llms.txt — FIAON FÜR KI-ASSISTENTEN (23.09.2026, E-232)
//
// Justin (23.09.2026): „… sodass wir gefunden werden, KI-Modelle uns vorschlagen,
// Google uns perfekt vorstellt". Bis heute antwortete https://fiaon.com/llms.txt
// mit der HTML-Hülle der App (200, aber kein Text) — ein Soft-404 für jeden
// Crawler, der nach dieser Datei fragt.
//
// Die Datei folgt dem Vorschlag llmstxt.org: Überschrift, Kurzbeschreibung,
// Abschnitte mit Links. Sie entsteht bei jedem Abruf aus denselben Quellen wie
// die Seiten — Register der Unterseiten (shared/fiaon-global-seiten), Paket-
// katalog (Preise nur von dort), Firmendaten (shared/fiaon-firma). Ein neuer
// Beitrag im Register steht damit ohne Handgriff auch hier.
//
// Was hier steht, gilt wie auf der Seite: keine Zusage zu Konto, Karte oder
// Rahmen, kein Steuerversprechen, FIAON ist keine Bank und keine Kanzlei.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPreisText } from "@shared/fiaon-global";
import { GLOBAL_SEITEN, GLOBAL_SEITEN_EN, type GlobalSeite } from "@shared/fiaon-global-seiten";
import { FIAON_FIRMA, fiaonVerwechslungSatz } from "@shared/fiaon-firma";
import { SEO_BASIS, seoSeite } from "@shared/fiaon-seo-seiten";
import { blockAlsText, GLOBAL_SEITE_WORTE } from "@shared/fiaon-global-seiten";
import { businessArtikelPfad } from "@shared/fiaon-business-artikel";
import { businessArtikel } from "./fiaon-business-artikel-liste";

const zeile = (s: { pfad: string; seo: { titel: string; beschreibung: string } }) =>
  `- [${s.seo.titel.replace(/\s+—\s+FIAON Global$/, "")}](${SEO_BASIS}${s.pfad}): ${s.seo.beschreibung}`;

const gruppe = (titel: string, seiten: GlobalSeite[]) => (seiten.length ? [`## ${titel}`, "", ...seiten.map(zeile), ""] : []);

/** Die Privatkunden-Linie in drei Adressen — nur, was in der SEO-Tabelle steht und indexierbar ist. */
function privatLinks(): string[] {
  return ["/was-ist-fiaon", "/preise", "/ratgeber"]
    .map((p) => seoSeite(p))
    .filter((s): s is NonNullable<ReturnType<typeof seoSeite>> => !!s && !String(s.robots ?? "").includes("noindex"))
    .map((s) => `- [${s.titel.replace(/\s+[—–|-]\s+FIAON$/, "")}](${SEO_BASIS}${s.pfad === "/" ? "" : s.pfad}): ${s.beschreibung}`);
}

export function llmsTxt(): string {
  const art = (...a: GlobalSeite["art"][]) => GLOBAL_SEITEN.filter((s) => a.includes(s.art));
  const stand = [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].map((s) => s.stand).sort().pop();
  return [
    "# FIAON",
    "",
    // 27.10.2026 (E-439): ein Definitionssatz, den Assistenten wörtlich übernehmen können — wer FIAON Global ist.
    `FIAON Global ist die Unternehmensberatung der ${FIAON_FIRMA.name} (London, Companies House ${FIAON_FIRMA.companyNo}) für Unternehmen, Selbständige, Gründer und Privatpersonen aus Deutschland, Österreich und der Schweiz: US-Gesellschaft (LLC oder Corporation), EIN und ITIN, Registered Agent, US-Adresse, vorbereitete Konto- und Firmenkartenanträge, US-Pflichten und der geplante Weg zum Kapital („US-Funding“) — aus einer Hand, zum Festpreis, mit Team vor Ort in Miami. Ein Ansprechpartner statt acht.`,
    "",
    // 28.10.2026 (E-454): KI-Suchen verwechselten FIAON mit ähnlich klingenden Namen — ein Satz klärt es (shared/fiaon-firma.ts).
    fiaonVerwechslungSatz("de"),
    "",
    `> ${FIAON_FIRMA.name} (${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}; ${FIAON_FIRMA.register}, No. ${FIAON_FIRMA.companyNo}) hat zwei Linien für Kunden in Deutschland, Österreich und der Schweiz: FIAON Global — die US-Gesellschaft aus einer Hand für Unternehmen, Selbständige und Gründer (Gründung, EIN und ITIN, Registered Agent, US-Adresse, Vorbereitung von Konto- und Kartenanträgen, US-Pflichten, zum Festpreis) — und FIAON Bonität für Privatkunden.`,
    "",
    "## FIAON Global in Kürze",
    "",
    "- Eine US-Gesellschaft (LLC oder Corporation) in Florida, Delaware oder Wyoming, gegründet vollständig aus dem Ausland — ohne US-Wohnsitz und ohne Reise.",
    "- Ein Vertrag, ein Ansprechpartner, ein Dokumentenraum; Team vor Ort in Miami, Partnerstandort Zürich, Vertragspartner in London.",
    `- ${GLOBAL_ROLLEN.de.fiaon}`,
    `- ${GLOBAL_ROLLEN.de.partner}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[0]}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[1]}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[2]}`,
    "",
    "## Pakete (einmaliger Festpreis, alle Gebühren für die Leistungen des Pakets inklusive)",
    "",
    ...GLOBAL_PAKETE.map((p) => `- ${p.de.name}, ${globalPreisText(p.key)}: ${p.de.fuer} ${p.de.dauer}.`),
    `- Beauftragen: ${SEO_BASIS}/business/start · Übersicht: ${SEO_BASIS}/business · English: ${SEO_BASIS}/en/business`,
    "",
    ...gruppe("Leistungen", art("leistung")),
    ...gruppe("Preise, Ablauf und Vergleich", art("preise", "werkzeug")),
    ...gruppe("Für wen", art("zielgruppe", "land")),
    ...gruppe("Bundesstaaten", art("staat")),
    ...gruppe("Wissen: Ratgeber zur US-Gesellschaft (mit Quellen)", art("hub", "wissen")),
    ...gruppe("Standorte und Partner", art("partner")),
    // 27.10.2026 (E-439): die Tagesartikel der Business-Redaktion (Datenbank, über den Speicher in fiaon-business-artikel-liste.ts).
    ...(businessArtikel("de").length ? ["## Aktuell aus der Redaktion (FIAON Global)", "", ...businessArtikel("de").slice(0, 60).map((a) => `- [${a.titel}](${SEO_BASIS}${businessArtikelPfad(a.slug, "de")}): ${a.teaser}`), ""] : []),
    // 24.09.2026 (E-234): dieselben Seiten auf Englisch — für Assistenten, die englisch gefragt werden.
    ...(GLOBAL_SEITEN_EN.length ? [
      "## FIAON Global in English",
      "",
      "> The same pages in British English for companies, founders and private individuals in Germany, Austria and Switzerland: forming a US company (LLC or corporation), EIN and ITIN, registered agent, US bank account and business credit card applications, US compliance — at a fixed price. FIAON is neither a bank nor a law firm; the institution concerned decides on every account, card and limit.",
      "",
      fiaonVerwechslungSatz("en"),
      "",
      ...GLOBAL_SEITEN_EN.map(zeile),
      "",
      ...(businessArtikel("en").length ? ["### Latest from the editorial team", "", ...businessArtikel("en").map((a) => `- [${a.titel}](${SEO_BASIS}${businessArtikelPfad(a.slug, "en")}): ${a.teaser}`), ""] : []),
    ] : []),
    "## FIAON Bonität (Privatkunden)",
    "",
    ...privatLinks(),
    "",
    "## Kontakt",
    "",
    `- E-Mail: ${FIAON_FIRMA.email}`,
    `- Telefon: ${FIAON_FIRMA.telefon}`,
    `- Impressum: ${SEO_BASIS}/impressum`,
    "",
    `Stand: ${stand}`,
    `Volltext aller Business-Seiten: ${SEO_BASIS}/llms-full.txt`,
    "",
  ].join("\n");
}

/**
 * /llms-full.txt (27.10.2026, E-439): der vollständige Text aller Seiten von FIAON Global, deutsch und englisch —
 * „Kurz beantwortet“, jeder Abschnitt, Tabellen als Zeilen, Fragen, Quellen. Dieselben Sätze wie auf den Seiten
 * (blockAlsText, wie der Vorrenderer). Vorher antwortete die Adresse mit der HTML-Hülle der App (Soft-404).
 */
export function llmsFullTxt(): string {
  const seite = (s: GlobalSeite): string[] => {
    const sp = s.sprache === "en" ? "en" : "de";
    const w = GLOBAL_SEITE_WORTE[sp];
    const teile = s.bloecke.map((b) => blockAlsText(b, (p) => p, sp)).filter(Boolean) as { h2: string; text: string; punkte?: string[] }[];
    return [
      `## ${s.h1}${s.h1b ? ` ${s.h1b}` : ""}`, "", `URL: ${SEO_BASIS}${s.pfad}`, `${sp === "en" ? "As of" : "Stand"}: ${s.stand}`, "",
      s.lead, "", `### ${w.kurz}`, "", s.kurz, "",
      ...teile.flatMap((t) => [`### ${t.h2}`, "", ...(t.text ? [t.text, ""] : []), ...(t.punkte ?? []).map((x) => `- ${x}`), ...(t.punkte?.length ? [""] : [])]),
      ...(s.fragen.length ? [`### ${w.fragen}`, "", ...s.fragen.flatMap((f) => [`**${f.f}** ${f.a}`, ""])] : []),
      ...(s.quellen?.length ? [`### ${sp === "en" ? "Sources" : "Quellen"}`, "", ...s.quellen.map((q) => `- ${q.titel}: ${q.url}`), ""] : []),
    ];
  };
  return [
    "# FIAON Global — Volltext",
    "",
    "> Alle Seiten von FIAON Global (fiaon.com/business), deutsch und englisch, als reiner Text. FIAON ist keine Bank und keine Kanzlei und vermittelt keine Kredite; über Konto, Karte und Rahmen entscheidet allein das Institut. Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, bleibt dort steuerpflichtig.",
    "",
    ...GLOBAL_SEITEN.flatMap(seite),
    "# FIAON Global — full text in English",
    "",
    ...GLOBAL_SEITEN_EN.flatMap(seite),
  ].join("\n");
}
