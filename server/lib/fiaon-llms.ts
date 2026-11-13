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
//
// ── 13.11.2026 (E-510, Sprachleitfaden FIAON Global, Abschnitt 9.4) ────────
// Justin (12.11.2026): „auf JEDER Seite muss das Wording geändert werden … präsentiere uns wie eine Kanzlei, wie
// internationale Unternehmensberater.“ Für diese Datei heißt das:
//   · Sie beginnt mit dem EINEN Definitionssatz (wortgleich mit dem Datenblock der Seiten, aus shared/fiaon-global-saetze.ts).
//     Er nennt keine Länder: In keiner Zeile stehen Österreich oder die Schweiz neben Konto, Karte oder Finanzierung.
//     Österreich hat seine eigene Zeile (nur Gründung und Betreuung, ohne „Unternehmensberatung“).
//   · Sie nennt die sechs Schritte, jeden mit seiner Bedingung, und das Honorar vollständig (mit Ihrem Auftrag · mit der
//     Eintragung · ab dem zweiten Jahr) — die Sätze kommen aus VERKAUF_TEXTE und den festen Sätzen, kein Betrag ist getippt.
//   · Weg sind: „(LLC oder Corporation)“ (der Vertrag nennt die LLC), „der geplante Weg zum Kapital („US-Funding“)“,
//     „aus einer Hand, mit Team vor Ort in Miami“, „Ein Ansprechpartner statt acht.“, „Partnerstandort Zürich“,
//     „(ein Produkt, ein Preis)“, die doppelte Zeile zur Jahresbetreuung, „Angebot selbst zusammenstellen“ und der Satz zur
//     Staaten-Wahl mit „besten Ruf“ und „am günstigsten“ (STAAT_WAHL_SATZ) — die Zeiten je Bundesstaat stehen jetzt als
//     Erfahrungswerte mit Stand da, dahinter der feste Satz S15. Kein Wort zur Bürgschaft.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "@shared/fiaon-global";
// E-509 (12.11.2026): der Partner-Satz ohne „Ihres Pakets“ — aus der Karte des einen Produkts.
import { EIN_PRODUKT } from "@shared/fiaon-global-seiten/ein-produkt";
import { VERKAUF_TEXTE } from "@shared/fiaon-global-verkauf";
// E-510: Definitionssatz, Österreich-Fassung, die sechs Schritte, die festen Sätze und die Beträge — geholt, nie getippt.
import { SAETZE_BETRAEGE, SCHRITTE_KOPF, satz, sechsSchritte, weitererSatz } from "@shared/fiaon-global-saetze";
import { GLOBAL_SEITEN, GLOBAL_SEITEN_EN, type GlobalSeite } from "@shared/fiaon-global-seiten";
import { STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL } from "@shared/fiaon-global-bundesstaaten";
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
  // 29.10.2026 (E-461): die Startseite der Privatkunden zuerst (/privat) — fiaon.com/ ist FIAON Global.
  return ["/privat", "/was-ist-fiaon", "/preise", "/ratgeber"]
    .map((p) => seoSeite(p))
    .filter((s): s is NonNullable<ReturnType<typeof seoSeite>> => !!s && !String(s.robots ?? "").includes("noindex"))
    .map((s) => `- [${s.titel.replace(/\s+[—–|-]\s+FIAON$/, "")}](${SEO_BASIS}${s.pfad === "/" ? "" : s.pfad}): ${s.beschreibung}`);
}

export function llmsTxt(): string {
  const art = (...a: GlobalSeite["art"][]) => GLOBAL_SEITEN.filter((s) => a.includes(s.art));
  const stand = [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].map((s) => s.stand).sort().pop();
  const V = VERKAUF_TEXTE.de;
  const B = SAETZE_BETRAEGE.de;
  return [
    "# FIAON",
    "",
    // 27.10.2026 (E-439): ein Definitionssatz, den Assistenten wörtlich übernehmen können — wer FIAON Global ist.
    // 13.11.2026 (E-510): der Definitionssatz des Sprachleitfadens (9.4) — ohne Länder, wortgleich mit dem Datenblock der Seiten.
    weitererSatz("DEFINITION", "de"),
    "",
    // 28.10.2026 (E-454): KI-Suchen verwechselten FIAON mit ähnlich klingenden Namen — ein Satz klärt es (shared/fiaon-firma.ts).
    fiaonVerwechslungSatz("de"),
    "",
    // Diese Zeile nennt die Länder — und deshalb weder Konto noch Karte noch Finanzierung (Leitfaden 5.12).
    `> ${FIAON_FIRMA.name} (${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}; ${FIAON_FIRMA.register}, No. ${FIAON_FIRMA.companyNo}) arbeitet für Klienten in Deutschland, Österreich und der Schweiz und hat zwei Linien: FIAON Global — Gründung und laufende Betreuung von US-Gesellschaften in einem Mandat — und FIAON Bonität für Privatkunden.`,
    "",
    "## FIAON Global in Kürze",
    "",
    `- Ihre US-Gesellschaft (LLC) in Delaware, Florida oder Wyoming. ${satz("S3", "de")}`,
    // E-465 (29.10.2026): die Zeiten je Bundesstaat aus shared/fiaon-global-bundesstaaten.ts. E-510: als Erfahrungswerte mit Stand,
    // dahinter der feste Satz S15 — vorher der Satz STAAT_WAHL_SATZ („besten Ruf“, „schnell und am günstigsten“).
    `- Eintragung, Erfahrungswerte (Stand ${STAATEN_STAND_TEXT.de}): ${STAATEN_ZUR_WAHL.map((b) => `${b.name} ${b.eintragungKurz.de}`).join("; ")}. ${satz("S15", "de")}`,
    `- ${V.produkt.lead}`,
    // Der Rollen-Satz (wer Recht und Steuern verantwortet) — „keine Bank, keine Kanzlei, keine Kreditvermittlung“ sagt schon der Definitionssatz.
    `- ${EIN_PRODUKT.de.partner}`,
    `- ${satz("S10", "de")}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[0]}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[1]}`,
    `- ${GLOBAL_PFLICHTHINWEIS.de[2]}`,
    // Österreich wird getrennt geführt (Leitfaden 9.4): nur Gründung und Betreuung, das weitere Vorhaben persönlich.
    `- Für Klienten mit Wohnsitz in Österreich: ${weitererSatz("POSITIONIERUNG-AT", "de")}`,
    "",
    // Die sechs Schritte in Justins Reihenfolge — Satz und Bedingung stehen nie getrennt (Leitfaden 2.1).
    `## ${SCHRITTE_KOPF.de.h2}`,
    "",
    ...sechsSchritte("de").schritte.map((x) => `${x.nr}. ${x.titel}: ${x.satz} ${x.bedingung}`),
    "",
    // E-509 (12.11.2026): EIN Mandat statt vier Pakete — Sätze aus shared/fiaon-global-verkauf.ts, Beträge aus der Preisquelle.
    // E-510 — vorher: Überschrift „… (ein Produkt, ein Preis)“, „Mit dem Auftrag …“ und die Jahresbetreuung ein zweites Mal
    // hinter produkt.preisFein (das den Mindestbetrag und die Jahresbetreuung seit E-510 selbst nennt).
    `## ${V.produkt.kurz}: Leistung und Honorar`,
    "",
    `- ${V.produkt.preisLabel} ${B.honorarAuftrag}: ${V.produkt.preisSatz}`,
    `- ${V.produkt.preisFein}`,
    `- ${V.konfig.blatt.fastTrack(B.fastTrack)}`,
    `- ${EIN_PRODUKT.de.rahmenSatz}`,
    ...V.produkt.bereiche.map((b) => `- ${b.titel}: ${b.zeile}`),
    `- ${EIN_PRODUKT.de.geldZurueck}`,
    // 29.10.2026 (E-461): Die Übersicht von FIAON Global ist die Startseite fiaon.com/ (vorher /business, leitet per 301).
    // E-510: Die Handlung heißt überall „Angebot anfordern“ (vorher „Angebot selbst zusammenstellen“); sie führt zum Honorarrechner.
    `- ${V.buehne.knopf}: ${SEO_BASIS}/business/start · Übersicht: ${SEO_BASIS}/ · English: ${SEO_BASIS}/en`,
    "",
    ...gruppe("Leistungen", art("leistung")),
    ...gruppe("Kosten, Ablauf, Vergleich und Fragen", art("preise", "werkzeug")),
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
      // E-510: der Definitionssatz auf Englisch (9.4) — ohne Länder; Österreich in seiner eigenen Zeile. Vorher: „… in Germany,
      // Austria and Switzerland: forming a US company (LLC or corporation) … in one order, at a price that is set before you order.“
      `> ${weitererSatz("DEFINITION", "en")}`,
      "",
      `For clients resident in Austria: ${weitererSatz("POSITIONIERUNG-AT", "en")}`,
      "",
      "The pages below are the British English versions of the German pages listed above.",
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
    // E-510: Kopf in drei Zeilen — vorher standen die Länder und „Konto, Karte und Rahmen“ in EINER Zeile (Leitfaden 5.12).
    "> Alle Seiten von FIAON Global (fiaon.com und fiaon.com/business/…), deutsch und englisch, als reiner Text.",
    "",
    `> ${weitererSatz("DEFINITION", "de")}`,
    "",
    `> ${satz("S10", "de")}`,
    "",
    ...GLOBAL_SEITEN.flatMap(seite),
    "# FIAON Global — full text in English",
    "",
    ...GLOBAL_SEITEN_EN.flatMap(seite),
  ].join("\n");
}
