// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS BUSINESS-MENÜ (19.09.2026, E-191)
//
// Eine kleine Liste, damit die Navigation (GlassNav, auf jeder Seite geladen)
// nicht den ganzen Inhalt der Unterseiten mitschleppt. Die Seiten selbst
// stehen in shared/fiaon-global-seiten; scripts/pruef-global-seiten.ts prüft,
// dass jeder Menüeintrag auf eine existierende Seite zeigt und umgekehrt jede
// Seite mit Menüeintrag hier steht.
// ═══════════════════════════════════════════════════════════════════════════

import { globalEnPfad } from "./fiaon-global-pfade";

export type MenueGruppe = "leistungen" | "fuerwen" | "preise" | "wissen";

export interface GlobalMenuePunkt {
  gruppe: MenueGruppe; pfad: string; titel: string; text: string; reihe: number;
  /** Titel und Zeile auf Englisch (24.09.2026, E-234) — der Pfad kommt aus shared/fiaon-global-pfade.ts. */
  en: { titel: string; text: string };
}

export const GLOBAL_MENUE_GRUPPEN: { gruppe: MenueGruppe; titel: string; en: string }[] = [
  { gruppe: "leistungen", titel: "Leistungen", en: "Services" },
  { gruppe: "fuerwen", titel: "Für wen", en: "Who it is for" },
  { gruppe: "preise", titel: "Preise und Ablauf", en: "Prices and process" },
  { gruppe: "wissen", titel: "Wissen", en: "Knowledge" },
];

export const GLOBAL_MENUE: GlobalMenuePunkt[] = [
  { gruppe: "leistungen", pfad: "/business/us-firmengruendung", titel: "US-Firmengründung", text: "LLC oder Corporation, mit Team vor Ort", reihe: 1, en: { titel: "US company formation", text: "LLC or corporation, with a team on the ground" } },
  { gruppe: "leistungen", pfad: "/business/ein-itin", titel: "EIN und ITIN", text: "Die US-Steuernummern für Firma und Person", reihe: 2, en: { titel: "EIN and ITIN", text: "The US tax numbers for company and person" } },
  { gruppe: "leistungen", pfad: "/business/us-geschaeftskonto", titel: "US-Geschäftskonto", text: "Antrag vollständig vorbereitet", reihe: 3, en: { titel: "US business bank account", text: "Application fully prepared" } },
  { gruppe: "leistungen", pfad: "/business/firmenkarten-kapital", titel: "Firmenkarten und Kapital", text: "Kartenleiter und Kapitalrahmen", reihe: 4, en: { titel: "Business credit and capital", text: "Card ladder and capital range" } },
  { gruppe: "leistungen", pfad: "/business/us-pflichten", titel: "US-Pflichten und Steuern", text: "Form 5472, Jahresmeldung, Registered Agent", reihe: 5, en: { titel: "US compliance and taxes", text: "Form 5472, annual report, registered agent" } },
  { gruppe: "leistungen", pfad: "/business/miami", titel: "Global VIP · Miami", text: "Der Auftakt vor Ort, Flug und Hotel inklusive", reihe: 6, en: { titel: "Global VIP · Miami", text: "The kick-off on site, flight and hotel included" } },

  { gruppe: "fuerwen", pfad: "/business/privatpersonen", titel: "Privatpersonen und Gründer", text: "Ohne eigene Firma beauftragen", reihe: 1, en: { titel: "Individuals and founders", text: "Order without a company of your own" } },
  { gruppe: "fuerwen", pfad: "/business/tochtergesellschaft-usa", titel: "Mittelstand", text: "Tochtergesellschaft in den USA", reihe: 2, en: { titel: "SMEs", text: "A subsidiary in the United States" } },
  { gruppe: "fuerwen", pfad: "/business/onlinehandel", titel: "Onlinehandel und Marken", text: "Verkaufen an Kunden in den USA", reihe: 3, en: { titel: "E-commerce and brands", text: "Selling to customers in the US" } },
  { gruppe: "fuerwen", pfad: "/business/agenturen-software", titel: "Agenturen und Software", text: "Dienstleister mit US-Kunden", reihe: 4, en: { titel: "Agencies and software", text: "Service providers with US clients" } },
  { gruppe: "fuerwen", pfad: "/business/bau-immobilien", titel: "Bau und Immobilien", text: "Projekte und Objekte in den USA", reihe: 5, en: { titel: "Construction and property", text: "Projects and properties in the US" } },
  { gruppe: "fuerwen", pfad: "/business/aus-deutschland", titel: "Aus Deutschland", text: "Steuerpflicht, § 138 AO, Typenvergleich", reihe: 6, en: { titel: "From Germany", text: "Tax liability, section 138 AO, classification" } },
  { gruppe: "fuerwen", pfad: "/business/aus-der-schweiz", titel: "Aus der Schweiz", text: "Tatsächliche Verwaltung, Partner in Zürich", reihe: 7, en: { titel: "From Switzerland", text: "Effective management, partner in Zurich" } },

  { gruppe: "preise", pfad: "/business#pakete", titel: "Pakete und Preise", text: "Vier Pakete, Festpreis, alles inklusive", reihe: 1, en: { titel: "Packages and prices", text: "Four packages, fixed price, everything included" } },
  // E-196: Preis wie GLOBAL_JAHRESBETREUUNG (shared/fiaon-global.ts) — pruef-global-seiten.ts gleicht ab.
  { gruppe: "preise", pfad: "/business#jahresbetreuung", titel: "Jahresbetreuung ab Jahr zwei", text: "699 € im Jahr, alle Gebühren inklusive", reihe: 2, en: { titel: "Annual care plan from year two", text: "€699 a year, all fees included" } },
  { gruppe: "preise", pfad: "/business/kosten", titel: "Kosten im Überblick", text: "Festpreis, Staatsgebühren, ab Jahr zwei", reihe: 3, en: { titel: "Costs at a glance", text: "Fixed price, state fees, from year two" } },
  { gruppe: "preise", pfad: "/business/ablauf", titel: "Ablauf und Dauer", text: "Vom Gespräch bis zur Kartenleiter", reihe: 4, en: { titel: "Process and timing", text: "From the first call to the card ladder" } },
  { gruppe: "preise", pfad: "/business/paket-finder", titel: "Paket-Finder", text: "Vier Fragen, ein passendes Paket", reihe: 5, en: { titel: "Package finder", text: "Four questions, one matching package" } },
  { gruppe: "preise", pfad: "/business/vergleich", titel: "Vergleich", text: "Selbst, Gründungsdienst oder FIAON Global", reihe: 6, en: { titel: "Comparison", text: "Yourself, a formation service or FIAON Global" } },
  { gruppe: "preise", pfad: "/business/fragen", titel: "Fragen und Antworten", text: "Alle Antworten an einem Ort", reihe: 7, en: { titel: "Questions and answers", text: "Every answer in one place" } },

  // 23.09.2026 (E-232): drei der zehn Praxis-Beiträge im Menü — zehn Einträge, fünf Reihen im Panel.
  { gruppe: "wissen", pfad: "/business/wissen", titel: "Alle Beiträge", text: "16 Beiträge, von der Gründung bis zur Steuer", reihe: 1, en: { titel: "All articles", text: "16 articles, from formation to tax" } },
  { gruppe: "wissen", pfad: "/business/wissen/llc-gruenden", titel: "LLC gründen: die Anleitung", text: "Zehn Schritte, aus Deutschland", reihe: 2, en: { titel: "Form a US LLC: the guide", text: "Ten steps, from Germany" } },
  { gruppe: "wissen", pfad: "/business/wissen/us-llc-steuern", titel: "Steuern, ehrlich erklärt", text: "Ist eine US-LLC ein Steuermodell?", reihe: 3, en: { titel: "Tax, explained honestly", text: "Is a US LLC a way to pay no tax?" } },
  { gruppe: "wissen", pfad: "/business/wissen/bundesstaat-waehlen", titel: "Welcher Bundesstaat?", text: "Florida, Delaware oder Wyoming", reihe: 4, en: { titel: "Which state?", text: "Florida, Delaware or Wyoming" } },
  { gruppe: "wissen", pfad: "/business/wissen/llc-oder-corporation", titel: "LLC oder Corporation", text: "Die Wahl der Rechtsform", reihe: 5, en: { titel: "LLC or corporation", text: "Choosing the legal form" } },
  { gruppe: "wissen", pfad: "/business/wissen/form-5472", titel: "Form 5472", text: "Die Meldung, die niemand vergessen darf", reihe: 6, en: { titel: "Form 5472", text: "The filing nobody can afford to forget" } },
  { gruppe: "wissen", pfad: "/business/wissen/us-bankkonto-unterlagen", titel: "US-Konto: die Unterlagen", text: "Was Institute sehen wollen", reihe: 7, en: { titel: "US account: the documents", text: "What institutions want to see" } },
  { gruppe: "wissen", pfad: "/business/wissen/us-firmenkarte-beantragen", titel: "US-Firmenkarte beantragen", text: "Wie Herausgeber entscheiden", reihe: 8, en: { titel: "US business credit card", text: "How issuers decide" } },
  { gruppe: "wissen", pfad: "/business/wissen/anbieter-pruefen", titel: "Seriöse Anbieter erkennen", text: "Die Prüfliste vor dem Auftrag", reihe: 9, en: { titel: "Spotting reputable providers", text: "The checklist before you order" } },
  { gruppe: "wissen", pfad: "/business/partner", titel: "Standorte und Partner", text: "London · Zürich · Miami", reihe: 10, en: { titel: "Locations and partners", text: "London · Zurich · Miami" } },
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
