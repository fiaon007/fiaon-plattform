// ═══════════════════════════════════════════════════════════════════════════
// DIE FACHBEREICHE DES GLOBAL-PORTALS — Typen und Regeln (E-341, 12.10.2026)
//
// Justin: „Unternehmensberater, Rechtsanwalt, Steuerberater, einfach 100 %
//          sinnvoll mit Anträgen, Auswertungen, vieles, was er nutzen kann …
//          dass man sagt: YES, geil!"
//
// Drei Bereiche, gleich gebaut:
//   strategie — Strategie & Wachstum (KI-Sparring, Strategiebuch, Rechner)
//   recht     — Recht & Verträge (Verzeichnis, Vorlagen-Generator, KI-Fragen)
//   steuern   — Steuern & Pflichten (Formulare erklärt, Ausfüllhilfen, Check)
//
// NAMEN, DIE NICHTS VERLIEREN: „Unternehmensberatung" ist in Österreich ein
// reglementiertes Gewerbe (§ 94 Z 74 GewO); seit E-436 (27.10.2026) nennt sich FIAON trotzdem so (Justin),
// „Rechtsanwalt" und „Steuerberater" sind geschützte Berufsbezeichnungen, und
// Rechts-/Steuerdienstleistung im Einzelfall ist Anwälten und Steuerberatern
// vorbehalten (RDG, StBerG). Erlaubt und hier gebaut: allgemeine Information,
// Wissen, Rechner und ein Vertragsgenerator (BGH I ZR 113/20 „Smartlaw“, 2021).
// Für den Einzelfall: „Einzelfall prüfen lassen“ → Aufgabe an FIAON.
// ═══════════════════════════════════════════════════════════════════════════

export type FachBereich = "strategie" | "recht" | "steuern";
export const FACH_BEREICHE: FachBereich[] = ["strategie", "recht", "steuern"];

/** Ein Absatzblock eines Kapitels. */
export interface FachAbschnitt {
  titel?: string;
  absaetze: string[];
  /** Aufzählung (ohne Satzzeichen am Anfang). */
  liste?: string[];
  /** Ein hervorgehobener Merksatz. */
  merke?: string;
}

/** Ein Kapitel der Bibliothek eines Bereichs (Strategiebuch, Rechts-Verzeichnis, Steuerwissen). */
export interface FachKapitel {
  id: string;
  bereich: FachBereich;
  /** Gruppe innerhalb des Bereichs, z. B. „Gründung“, „Bank & Kredit“. */
  gruppe: string;
  titel: string;
  /** Ein Satz, worum es geht. */
  kurz: string;
  /** Lesezeit in Minuten. */
  minuten: number;
  abschnitte: FachAbschnitt[];
  /** „Jetzt umsetzen“ — konkrete Schritte für den Kunden. */
  umsetzen?: string[];
  /** Amtliche Quellen (IRS, Sunbiz, FinCEN, BMF …). */
  quellen?: { titel: string; url: string }[];
  /** z. B. „Stand: Oktober 2026“. */
  stand: string;
}

/** Ein US-Formular oder eine Pflicht, erklärt (Bereich steuern). */
export interface FachFormular {
  id: string;
  nummer: string;          // „Form 5472“, „Annual Report (Florida)“
  titel: string;           // deutscher Titel
  wer: string;             // wen es betrifft
  wann: string;            // Frist in Worten oder als Datum (keine Ziffernfrist „in 30 Tagen“)
  folgen?: string;         // was bei Versäumnis droht (amtlich belegt)
  was: string;             // worum es geht
  schritte: string[];      // so geht es
  fiaon: string;           // was FIAON dabei übernimmt / vorbereitet
  quelle: { titel: string; url: string };
  /** Gilt für Bundesstaaten (Kürzel) — leer = alle. */
  staaten?: string[];
}

/** Ein Feld einer Vorlage. `vorbelegt` holt den Wert aus dem Mandat. */
export interface FachVorlageFeld {
  key: string;
  label: string;
  typ: "text" | "langtext" | "datum" | "zahl" | "auswahl";
  optionen?: string[];
  pflicht?: boolean;
  hilfe?: string;
  vorbelegt?: "llcName" | "bundesstaatName" | "aktenzeichen" | "ein" | "inhaberName" | "inhaberAnschrift" | "usAdresse" | "registeredAgent" | "heute" | "gegruendetAm";
}

/** Eine Vertragsvorlage (Bereich recht) — Text mit {{platzhaltern}} aus `felder`. */
export interface FachVorlage {
  id: string;
  titel: string;           // deutscher Name
  dokumentTitel: string;   // Titel auf dem Dokument (meist englisch)
  sprache: "en" | "de";
  wozu: string;            // ein Satz: wofür man es braucht
  wann: string;            // ein Satz: wann man es braucht
  felder: FachVorlageFeld[];
  /** Absätze des Dokuments; Überschriften als Absatz mit führendem „## “. */
  text: string[];
  /** Unterschriftszeilen (Rolle unter der Linie). */
  unterschriften: string[];
  /** Dokumentart im Tresor (GLOBAL_DOKUMENTARTEN). */
  art: string;
}

/** Fester Hinweis unter jeder Vorlage und jeder KI-Antwort im Bereich recht/steuern. */
export const FACH_HINWEIS = {
  recht: "Allgemeine Information und Vorlagen zum Selbstausfüllen — keine Rechtsdienstleistung im Einzelfall. Für Ihren konkreten Fall: „Einzelfall prüfen lassen“.",
  steuern: "Allgemeine Information und Ausfüllhilfen — keine Steuerberatung im Einzelfall. Ihre Erklärungen unterschreibt und verantwortet Ihre Steuerkanzlei; „Einzelfall prüfen lassen“ bringt Ihre Frage zu uns.",
  strategie: "Sparring und Wissen für Ihre Entscheidungen — die Entscheidung liegt bei Ihnen, über Konto, Karte und Kredit entscheidet das jeweilige Institut.",
} as const;
