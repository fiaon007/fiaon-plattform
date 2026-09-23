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
import { GLOBAL_SEITEN, type GlobalSeite } from "@shared/fiaon-global-seiten";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { SEO_BASIS, seoSeite } from "@shared/fiaon-seo-seiten";

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
  const stand = GLOBAL_SEITEN.map((s) => s.stand).sort().pop();
  return [
    "# FIAON",
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
    "",
  ].join("\n");
}
