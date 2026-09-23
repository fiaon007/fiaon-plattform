// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS BUSINESS-MENÜ (19.09.2026, E-191)
//
// Eine kleine Liste, damit die Navigation (GlassNav, auf jeder Seite geladen)
// nicht den ganzen Inhalt der Unterseiten mitschleppt. Die Seiten selbst
// stehen in shared/fiaon-global-seiten; scripts/pruef-global-seiten.ts prüft,
// dass jeder Menüeintrag auf eine existierende Seite zeigt und umgekehrt jede
// Seite mit Menüeintrag hier steht.
// ═══════════════════════════════════════════════════════════════════════════

export type MenueGruppe = "leistungen" | "fuerwen" | "preise" | "wissen";

export interface GlobalMenuePunkt { gruppe: MenueGruppe; pfad: string; titel: string; text: string; reihe: number }

export const GLOBAL_MENUE_GRUPPEN: { gruppe: MenueGruppe; titel: string }[] = [
  { gruppe: "leistungen", titel: "Leistungen" },
  { gruppe: "fuerwen", titel: "Für wen" },
  { gruppe: "preise", titel: "Preise und Ablauf" },
  { gruppe: "wissen", titel: "Wissen" },
];

export const GLOBAL_MENUE: GlobalMenuePunkt[] = [
  { gruppe: "leistungen", pfad: "/business/us-firmengruendung", titel: "US-Firmengründung", text: "LLC oder Corporation, mit Team vor Ort", reihe: 1 },
  { gruppe: "leistungen", pfad: "/business/ein-itin", titel: "EIN und ITIN", text: "Die US-Steuernummern für Firma und Person", reihe: 2 },
  { gruppe: "leistungen", pfad: "/business/us-geschaeftskonto", titel: "US-Geschäftskonto", text: "Antrag vollständig vorbereitet", reihe: 3 },
  { gruppe: "leistungen", pfad: "/business/firmenkarten-kapital", titel: "Firmenkarten und Kapital", text: "Kartenleiter und Kapitalrahmen", reihe: 4 },
  { gruppe: "leistungen", pfad: "/business/us-pflichten", titel: "US-Pflichten und Steuern", text: "Form 5472, Jahresmeldung, Registered Agent", reihe: 5 },
  { gruppe: "leistungen", pfad: "/business/miami", titel: "Global VIP · Miami", text: "Der Auftakt vor Ort, Flug und Hotel inklusive", reihe: 6 },

  { gruppe: "fuerwen", pfad: "/business/privatpersonen", titel: "Privatpersonen und Gründer", text: "Ohne eigene Firma beauftragen", reihe: 1 },
  { gruppe: "fuerwen", pfad: "/business/tochtergesellschaft-usa", titel: "Mittelstand", text: "Tochtergesellschaft in den USA", reihe: 2 },
  { gruppe: "fuerwen", pfad: "/business/onlinehandel", titel: "Onlinehandel und Marken", text: "Verkaufen an Kunden in den USA", reihe: 3 },
  { gruppe: "fuerwen", pfad: "/business/agenturen-software", titel: "Agenturen und Software", text: "Dienstleister mit US-Kunden", reihe: 4 },
  { gruppe: "fuerwen", pfad: "/business/bau-immobilien", titel: "Bau und Immobilien", text: "Projekte und Objekte in den USA", reihe: 5 },
  { gruppe: "fuerwen", pfad: "/business/aus-deutschland", titel: "Aus Deutschland", text: "Steuerpflicht, § 138 AO, Typenvergleich", reihe: 6 },
  { gruppe: "fuerwen", pfad: "/business/aus-der-schweiz", titel: "Aus der Schweiz", text: "Tatsächliche Verwaltung, Partner in Zürich", reihe: 7 },

  { gruppe: "preise", pfad: "/business#pakete", titel: "Pakete und Preise", text: "Vier Pakete, Festpreis, alles inklusive", reihe: 1 },
  // E-196: Preis wie GLOBAL_JAHRESBETREUUNG (shared/fiaon-global.ts) — pruef-global-seiten.ts gleicht ab.
  { gruppe: "preise", pfad: "/business#jahresbetreuung", titel: "Jahresbetreuung ab Jahr zwei", text: "699 € im Jahr, alle Gebühren inklusive", reihe: 2 },
  { gruppe: "preise", pfad: "/business/kosten", titel: "Kosten im Überblick", text: "Festpreis, Staatsgebühren, ab Jahr zwei", reihe: 3 },
  { gruppe: "preise", pfad: "/business/ablauf", titel: "Ablauf und Dauer", text: "Vom Gespräch bis zur Kartenleiter", reihe: 4 },
  { gruppe: "preise", pfad: "/business/paket-finder", titel: "Paket-Finder", text: "Vier Fragen, ein passendes Paket", reihe: 5 },
  { gruppe: "preise", pfad: "/business/vergleich", titel: "Vergleich", text: "Selbst, Gründungsdienst oder FIAON Global", reihe: 6 },
  { gruppe: "preise", pfad: "/business/fragen", titel: "Fragen und Antworten", text: "Alle Antworten an einem Ort", reihe: 7 },

  // 23.09.2026 (E-232): drei der zehn Praxis-Beiträge im Menü — zehn Einträge, fünf Reihen im Panel.
  { gruppe: "wissen", pfad: "/business/wissen", titel: "Alle Beiträge", text: "16 Beiträge, von der Gründung bis zur Steuer", reihe: 1 },
  { gruppe: "wissen", pfad: "/business/wissen/llc-gruenden", titel: "LLC gründen: die Anleitung", text: "Zehn Schritte, aus Deutschland", reihe: 2 },
  { gruppe: "wissen", pfad: "/business/wissen/us-llc-steuern", titel: "Steuern, ehrlich erklärt", text: "Ist eine US-LLC ein Steuermodell?", reihe: 3 },
  { gruppe: "wissen", pfad: "/business/wissen/bundesstaat-waehlen", titel: "Welcher Bundesstaat?", text: "Florida, Delaware oder Wyoming", reihe: 4 },
  { gruppe: "wissen", pfad: "/business/wissen/llc-oder-corporation", titel: "LLC oder Corporation", text: "Die Wahl der Rechtsform", reihe: 5 },
  { gruppe: "wissen", pfad: "/business/wissen/form-5472", titel: "Form 5472", text: "Die Meldung, die niemand vergessen darf", reihe: 6 },
  { gruppe: "wissen", pfad: "/business/wissen/us-bankkonto-unterlagen", titel: "US-Konto: die Unterlagen", text: "Was Institute sehen wollen", reihe: 7 },
  { gruppe: "wissen", pfad: "/business/wissen/us-firmenkarte-beantragen", titel: "US-Firmenkarte beantragen", text: "Wie Herausgeber entscheiden", reihe: 8 },
  { gruppe: "wissen", pfad: "/business/wissen/anbieter-pruefen", titel: "Seriöse Anbieter erkennen", text: "Die Prüfliste vor dem Auftrag", reihe: 9 },
  { gruppe: "wissen", pfad: "/business/partner", titel: "Standorte und Partner", text: "London · Zürich · Miami", reihe: 10 },
];

const NACH_PFAD = new Map(GLOBAL_MENUE.map((m) => [m.pfad, m]));

export function globalMenuePunkt(pfad: string): GlobalMenuePunkt | null {
  return NACH_PFAD.get(pfad) ?? null;
}

/** Das Menü in vier Spalten, sortiert. */
export function globalMenue(): { gruppe: MenueGruppe; titel: string; eintraege: GlobalMenuePunkt[] }[] {
  return GLOBAL_MENUE_GRUPPEN.map((g) => ({ ...g, eintraege: GLOBAL_MENUE.filter((m) => m.gruppe === g.gruppe).sort((a, b) => a.reihe - b.reihe) }));
}
