// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS BUSINESS-MENÜ (19.09.2026, E-191)
//
// Eine kleine Liste, damit die Navigation (GlassNav, auf jeder Seite geladen)
// nicht den ganzen Inhalt der Unterseiten mitschleppt. Die Seiten selbst
// stehen in shared/fiaon-global-seiten; scripts/pruef-global-seiten.ts prüft,
// dass jeder Menüeintrag auf eine existierende Seite zeigt und umgekehrt jede
// Seite mit Menüeintrag hier steht.
//
// 13.11.2026 (E-510, Sprachleitfaden FIAON Global, Abschnitt 10 Zeile 31): Das Menü steht auf jeder Seite — auch auf
// den Länderseiten. Deshalb: Honorar statt Preis, „Angebot anfordern“ (wortgleich mit HANDLUNGEN.angebot in
// shared/fiaon-global-saetze.ts — hier getippt, damit das Menü klein bleibt), Finanzierung statt „Kapital“, kein Ort
// und keine Rolle der Partnergesellschaft, keine Tätigkeit eines Partners. Jede Zeile nennt nur unsere eigene Arbeit
// oder den Inhalt der Seite. Grenzen des Panels: Titel höchstens 30, Zeile höchstens 52 Zeichen (pruef-global-seiten.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { globalEnPfad } from "./fiaon-global-pfade";
// E-509: der eine Preis der Jahresbetreuung — aus dem Blatt ohne Importe (hält das Menü klein).
import { VERKAUF_PREISE, verkaufEur } from "./fiaon-global-verkauf-preise";

export type MenueGruppe = "leistungen" | "fuerwen" | "preise" | "wissen";

export interface GlobalMenuePunkt {
  gruppe: MenueGruppe; pfad: string; titel: string; text: string; reihe: number;
  /** Titel und Zeile auf Englisch (24.09.2026, E-234) — der Pfad kommt aus shared/fiaon-global-pfade.ts. */
  en: { titel: string; text: string };
}

export const GLOBAL_MENUE_GRUPPEN: { gruppe: MenueGruppe; titel: string; en: string }[] = [
  { gruppe: "leistungen", titel: "Leistungen", en: "Services" },
  { gruppe: "fuerwen", titel: "Für wen", en: "Who it is for" },
  { gruppe: "preise", titel: "Honorar und Ablauf", en: "Fees and process" },
  { gruppe: "wissen", titel: "Wissen", en: "Knowledge" },
];

export const GLOBAL_MENUE: GlobalMenuePunkt[] = [
  { gruppe: "leistungen", pfad: "/business/us-firmengruendung", titel: "US-Firmengründung", text: "LLC in Delaware, Florida oder Wyoming", reihe: 1, en: { titel: "US company formation", text: "LLC in Delaware, Florida or Wyoming" } },
  { gruppe: "leistungen", pfad: "/business/ein-itin", titel: "EIN und ITIN", text: "Die US-Steuernummern für Firma und Person", reihe: 2, en: { titel: "EIN and ITIN", text: "The US tax numbers for company and person" } },
  { gruppe: "leistungen", pfad: "/business/us-geschaeftskonto", titel: "US-Geschäftskonto", text: "Antrag vollständig vorbereitet", reihe: 3, en: { titel: "US business bank account", text: "Application fully prepared" } },
  { gruppe: "leistungen", pfad: "/business/firmenkarten-kapital", titel: "Finanzierung und Kreditkarten", text: "Anträge, Begleitung, Karten auf Wunsch", reihe: 4, en: { titel: "Financing and credit cards", text: "Applications, support, cards on request" } },
  { gruppe: "leistungen", pfad: "/business/us-pflichten", titel: "US-Pflichten und Steuern", text: "Form 5472, Jahresmeldung, Registered Agent", reihe: 5, en: { titel: "US compliance and taxes", text: "Form 5472, annual report, registered agent" } },
  { gruppe: "leistungen", pfad: "/business/miami", titel: "Persönlich in Miami", text: "Ab 1 Mio. US-Dollar persönlich in Miami", reihe: 6, en: { titel: "In person in Miami", text: "From US$1 million, in person in Miami" } },

  { gruppe: "fuerwen", pfad: "/business/privatpersonen", titel: "Privatpersonen und Gründer", text: "Ohne eigene Firma beauftragen", reihe: 1, en: { titel: "Individuals and founders", text: "Instruct us without a company of your own" } },
  { gruppe: "fuerwen", pfad: "/business/tochtergesellschaft-usa", titel: "Mittelstand", text: "Tochtergesellschaft in den USA", reihe: 2, en: { titel: "SMEs", text: "A subsidiary in the United States" } },
  { gruppe: "fuerwen", pfad: "/business/onlinehandel", titel: "Onlinehandel und Marken", text: "Verkaufen an Kunden in den USA", reihe: 3, en: { titel: "E-commerce and brands", text: "Selling to customers in the US" } },
  { gruppe: "fuerwen", pfad: "/business/agenturen-software", titel: "Agenturen und Software", text: "Dienstleister mit US-Kunden", reihe: 4, en: { titel: "Agencies and software", text: "Service providers with US clients" } },
  { gruppe: "fuerwen", pfad: "/business/bau-immobilien", titel: "Bau und Immobilien", text: "Projekte und Objekte in den USA", reihe: 5, en: { titel: "Construction and property", text: "Projects and properties in the US" } },
  { gruppe: "fuerwen", pfad: "/business/aus-deutschland", titel: "Aus Deutschland", text: "Steuerpflicht, § 138 AO, Typenvergleich", reihe: 6, en: { titel: "From Germany", text: "Tax liability, section 138 AO, classification" } },
  { gruppe: "fuerwen", pfad: "/business/aus-der-schweiz", titel: "Aus der Schweiz", text: "Tatsächliche Verwaltung, Steuerpflicht", reihe: 7, en: { titel: "From Switzerland", text: "Effective management, tax liability" } },
  // 27.10.2026 (E-439): die dritte Länderseite.
  { gruppe: "fuerwen", pfad: "/business/aus-oesterreich", titel: "Aus Österreich", text: "Geschäftsleitung, Meldungen, Partner-Steuerberater", reihe: 8, en: { titel: "From Austria", text: "Place of management, reporting, partner tax adviser" } },

  // 29.10.2026 (E-461): die Übersicht steht auf der Startseite fiaon.com/ (vorher /business).
  // E-509 (12.11.2026): EIN Produkt statt vier Pakete — „Leistung und Honorar“ zeigt auf das Produkt der Startseite (#produkt),
  // „Angebot anfordern“ auf den Honorarrechner (/business/start; bis E-509: Paket-Finder).
  { gruppe: "preise", pfad: "/#produkt", titel: "Leistung und Honorar", text: "Ein Mandat, acht Bereiche", reihe: 1, en: { titel: "Services and fees", text: "One engagement, eight areas" } },
  // E-196: Betrag wie GLOBAL_JAHRESBETREUUNG (shared/fiaon-global.ts) — pruef-global-seiten.ts gleicht ab. Der Betrag kommt
  // aus der einen Preisquelle (VERKAUF_PREISE.jahresCents).
  // E-510 (13.11.2026): Der Anker #jahresbetreuung steht nicht mehr auf der Startseite. Der Eintrag führt deshalb auf die
  // Kostenseite, Abschnitt „Laufende Kosten ab dem zweiten Jahr“ (id „laufend“, deutsch und englisch gleich).
  { gruppe: "preise", pfad: "/business/kosten#laufend", titel: "Jahresbetreuung", text: `Ab dem zweiten Jahr, auf Wunsch: ${verkaufEur(VERKAUF_PREISE.jahresCents, "de")} im Jahr`, reihe: 2, en: { titel: "Annual administration", text: `From the second year, on request: ${verkaufEur(VERKAUF_PREISE.jahresCents, "en")} a year` } },
  { gruppe: "preise", pfad: "/business/kosten", titel: "Kosten im Überblick", text: "Honorar, Staatsgebühren, ab dem zweiten Jahr", reihe: 3, en: { titel: "Costs at a glance", text: "Fees, state fees, from the second year" } },
  { gruppe: "preise", pfad: "/business/ablauf", titel: "Ablauf und Dauer", text: "Sechs Schritte, jeder mit seiner Bedingung", reihe: 4, en: { titel: "Process and timing", text: "Six steps, each with its condition" } },
  { gruppe: "preise", pfad: "/business/start", titel: "Angebot anfordern", text: "Ihre Honorarübersicht vorab", reihe: 5, en: { titel: "Request your proposal", text: "Your schedule of fees in advance" } },
  { gruppe: "preise", pfad: "/business/vergleich", titel: "Vergleich", text: "Selbst, Gründungsdienst oder FIAON Global", reihe: 6, en: { titel: "Comparison", text: "Yourself, a formation service or FIAON Global" } },
  { gruppe: "preise", pfad: "/business/fragen", titel: "Fragen und Antworten", text: "Alle Antworten an einem Ort", reihe: 7, en: { titel: "Questions and answers", text: "Every answer in one place" } },
  // 27.10.2026 (E-439): die Konzeptseite — wer FIAON Global ist, in einem Satz und einer Tabelle.
  { gruppe: "preise", pfad: "/business/was-ist-fiaon-global", titel: "Was ist FIAON Global?", text: "Die Unternehmensberatung, kurz erklärt", reihe: 8, en: { titel: "What is FIAON Global?", text: "The business consultancy, briefly explained" } },

  // 23.09.2026 (E-232): drei der zehn Praxis-Beiträge im Menü — zehn Einträge, fünf Reihen im Panel.
  { gruppe: "wissen", pfad: "/business/wissen", titel: "Alle Beiträge", text: "28 Beiträge, von der Gründung bis zur Finanzierung", reihe: 1, en: { titel: "All articles", text: "28 articles, from formation to financing" } },
  { gruppe: "wissen", pfad: "/business/wissen/llc-gruenden", titel: "LLC gründen: die Anleitung", text: "Zehn Schritte, aus Deutschland", reihe: 2, en: { titel: "Form a US LLC: the guide", text: "Ten steps, from Germany" } },
  { gruppe: "wissen", pfad: "/business/wissen/us-llc-steuern", titel: "Steuern, mit Quellen", text: "Eine US-LLC ist kein Steuermodell", reihe: 3, en: { titel: "Tax, with sources", text: "A US LLC is not a tax scheme" } },
  { gruppe: "wissen", pfad: "/business/wissen/bundesstaat-waehlen", titel: "Bundesstaat wählen", text: "Delaware, Florida, Wyoming im Vergleich", reihe: 4, en: { titel: "Choosing a state", text: "Delaware, Florida and Wyoming compared" } },
  // E-510: Der Leitfaden (Abschnitt 10 Zeile 31) nennt hier „US Funding, mit Quellen“. Die Wortwand lässt das Wort aber nur
  // auf der Seite des Artikels selbst zu (Titel, H1, erster Absatz) — das Menü steht auf jeder Seite. Deshalb deutsch
  // „US-Finanzierung“; englisch bleibt “US funding” (dort ist nur “funding programme” gesperrt).
  { gruppe: "wissen", pfad: "/business/wissen/us-funding", titel: "US-Finanzierung, mit Quellen", text: "Drei Ebenen, und woran Sie Seriöses erkennen", reihe: 5, en: { titel: "US funding, with sources", text: "Three levels, and how to spot what is sound" } },
  { gruppe: "wissen", pfad: "/business/wissen/form-5472", titel: "Form 5472", text: "Die Meldung, die niemand vergessen darf", reihe: 6, en: { titel: "Form 5472", text: "The filing nobody can afford to forget" } },
  { gruppe: "wissen", pfad: "/business/wissen/markteintritt-usa", titel: "Markteintritt USA", text: "Der Ablauf, Schritt für Schritt", reihe: 7, en: { titel: "US market entry", text: "The process, step by step" } },
  { gruppe: "wissen", pfad: "/business/wissen/us-firmenkarte-beantragen", titel: "US-Firmenkarte beantragen", text: "Wie Herausgeber entscheiden", reihe: 8, en: { titel: "US business credit card", text: "How issuers decide" } },
  { gruppe: "wissen", pfad: "/business/wissen/anbieter-pruefen", titel: "Seriöse Anbieter erkennen", text: "Die Prüfliste vor dem Auftrag", reihe: 9, en: { titel: "Spotting reputable providers", text: "The checklist before you instruct a provider" } },
  // E-510: ohne Städte-Zeile — der Ort der verbundenen Gesellschaft steht öffentlich nicht (Leitfaden, Leitplanke 7).
  { gruppe: "wissen", pfad: "/business/partner", titel: "Vertragspartner und Partner", text: "FIAON LTD, London · Partnernetz", reihe: 10, en: { titel: "Contracting party and partners", text: "FIAON LTD, London · partner network" } },
];

const NACH_PFAD = new Map(GLOBAL_MENUE.map((m) => [m.pfad, m]));

/** Ein Menüpunkt in der Sprache der Adresse: deutsche Pfade wie bisher, englische mit englischem Titel und Pfad. */
function inSprache(m: GlobalMenuePunkt, sprache: "de" | "en"): GlobalMenuePunkt {
  return sprache === "en" ? { ...m, pfad: globalEnPfad(m.pfad), titel: m.en.titel, text: m.en.text } : m;
}
const NACH_EN_PFAD = new Map(GLOBAL_MENUE.map((m) => [globalEnPfad(m.pfad), inSprache(m, "en")]));

/** Der Menüpunkt zu einer Adresse — deutsch oder englisch (24.09.2026, E-234). */
export function globalMenuePunkt(pfad: string): GlobalMenuePunkt | null {
  return NACH_PFAD.get(pfad) ?? NACH_EN_PFAD.get(pfad) ?? null;
}

/** Das Menü in vier Spalten, sortiert — auf Englisch mit englischen Titeln und Pfaden. */
export function globalMenue(sprache: "de" | "en" = "de"): { gruppe: MenueGruppe; titel: string; eintraege: GlobalMenuePunkt[] }[] {
  return GLOBAL_MENUE_GRUPPEN.map((g) => ({
    gruppe: g.gruppe, titel: sprache === "en" ? g.en : g.titel,
    eintraege: GLOBAL_MENUE.filter((m) => m.gruppe === g.gruppe).sort((a, b) => a.reihe - b.reihe).map((m) => inSprache(m, sprache)),
  }));
}
