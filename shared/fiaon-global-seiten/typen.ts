// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE UNTERSEITEN: DAS DATENMODELL (19.09.2026, E-191)
//
// Justin (18.09.2026, spät): „Wir brauchen für die /global Seite und im Menü
// Business mehr Seiten, perfekt optimiert auf die Kunden und natürlich PERFEKT
// SEO und SEA optimiert!" — und nach dem Plan: „Starte mit allen und baue es
// fix fertig … ultra seriös … wie von einer Anwaltskanzlei, Unternehmens-
// berater, aber dennoch ultra modern, denke an JEDES Detail!"
//
// ── EINE QUELLE FÜR ALLES ─────────────────────────────────────────────────
// Jede Unterseite von FIAON Global ist ein Datensatz in diesem Verzeichnis.
// Aus demselben Datensatz entstehen:
//   · die sichtbare Seite (client/src/pages/site/global-seite.tsx),
//   · Kopf und lesbarer Korpus für Suchmaschinen (shared/fiaon-seo-seiten.ts
//     registriert jede Seite; server/lib/fiaon-seiten-seo.ts rendert sie),
//   · die FAQ als strukturierte Daten (FAQPage),
//   · das Business-Menü (GlassNav) und die Mobil-Navigation,
//   · die Wortprüfung (scripts/pruef-wortwand-de.ts, scripts/pruef-global-seiten.ts).
// Ein Satz, der auf der Seite steht, steht damit auch im Korpus — und nichts
// im Korpus, was der Besucher nicht sieht (Regel 1 der SEO-Tabelle).
//
// ── DIE WORTGRENZEN (E-188, E-190) ────────────────────────────────────────
// Jeder Text hier passiert shared/fiaon-wortverbote.ts und die schärferen
// Global-Regeln: kein „bis zu“ (einzige Ausnahme: die VIP-Zahl über
// globalKapital), kein Bankname, keine Frist mit Ziffer, keine Empfehlung,
// kein „Beratung/beraten“, kein Steuerversprechen, kein „ohne Sicherheiten“,
// keine Selbstbezeichnung als Unternehmensberatung oder Gruppe. Über Konto,
// Karte, Rahmen und Darlehen entscheidet immer das Institut. Zahlen Dritter
// (Gebühren, Fristen, Strafen) nur mit Quelle und Stand.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSchluessel } from "../fiaon-global";

/** Welche Art Seite — steuert Vorlage, Brotkrumen und strukturierte Daten. */
export type GlobalSeitenArt =
  | "leistung"   // eine Leistung von FIAON Global (Service + Angebot)
  | "preise"     // Kosten, Ablauf, Vergleich, Fragen
  | "werkzeug"   // Paket-Finder
  | "zielgruppe" // für wen: Branche oder Unternehmensform
  | "land"       // aus Deutschland, aus der Schweiz
  | "staat"      // US-Bundesstaat
  | "wissen"     // Ratgeber (Article)
  | "hub"        // Übersicht „Wissen“
  | "partner";   // Standorte und Partner

/** Die Spalte im Business-Menü — das Menü selbst steht in shared/fiaon-global-menue.ts. */
export type { MenueGruppe } from "../fiaon-global-menue";

export interface GlobalQuelle { titel: string; url: string }

/** Die Bausteine einer Seite — jeder mit eigener Gestaltung in global-seite.tsx. */
export type GlobalBlock =
  /** Fließtext mit optionaler Aufzählung. */
  | { typ: "text"; id: string; h2: string; absaetze: string[]; punkte?: string[]; nach?: string }
  /** Etappen mit römischer Ziffer — Reihenfolge trägt Bedeutung. */
  | { typ: "etappen"; id: string; h2: string; lead?: string; etappen: { titel: string; dauer?: string; text: string }[] }
  /** Wer was tut: FIAON, Partner, Sie. */
  | { typ: "rollen"; id: string; h2: string; lead?: string; fiaon: string[]; partner: string[]; sie: string[] }
  /** Tabelle wie in einem Bericht — Zahlen rechtsbündig, Fußnoten darunter. */
  | { typ: "tabelle"; id: string; h2: string; lead?: string; kopf: string[]; zeilen: string[][]; hervor?: number; fuss?: string[] }
  /** Karten im Raster. */
  | { typ: "karten"; id: string; h2: string; lead?: string; karten: { tag?: string; titel: string; text: string; pfad?: string }[]; spalten?: 2 | 3 }
  /** „Was Sie wissen müssen“ — die ehrlichen Grenzen, nie versteckt. */
  | { typ: "hinweis"; id: string; h2: string; lead?: string; punkte: string[] }
  /** Ein Satz, groß gesetzt. */
  | { typ: "zitat"; id: string; text: string; quelle?: string }
  /** Das eine Paket, das zu dieser Seite passt. */
  | { typ: "paket"; id: string; h2: string; lead?: string; paket: GlobalSchluessel }
  /** Alle vier Pakete kompakt. */
  | { typ: "pakete"; id: string; h2: string; lead?: string }
  /** London · Zürich · Miami. */
  | { typ: "standorte"; id: string; h2: string; lead?: string }
  /** Der Paket-Finder (Werkzeug). */
  | { typ: "finder"; id: string; h2: string; lead?: string }
  /** Verzeichnis von Seiten (Wissen, Fragen). */
  | { typ: "verzeichnis"; id: string; h2: string; lead?: string; eintraege: { pfad: string; tag?: string }[] }
  /** Fragen einer Gruppe — für die Seite „Fragen & Antworten“. */
  | { typ: "fragen"; id: string; h2: string; lead?: string; fragen: { f: string; a: string }[] };

export interface GlobalSeite {
  /** Adresse, z. B. /business/us-firmengruendung (englisch: /en/business/us-company-formation). */
  pfad: string;
  /**
   * Sprache der Seite (24.09.2026, E-234) — fehlt = Deutsch. Englische Seiten stehen in
   * shared/fiaon-global-seiten/en/, ihre Adresse kommt aus en-pfade.ts (GLOBAL_EN_PFADE),
   * die Schwester ist immer die deutsche Seite, aus der sie übersetzt ist.
   */
  sprache?: "de" | "en";
  /** Die Schwesterseite in der anderen Sprache (Pfad) — Grundlage für hreflang, Umschalter und Prüfstand. */
  schwester?: string;
  art: GlobalSeitenArt;
  /** <title> (Suchwort vorn, ≤ 60 Zeichen) und Meta-Description (120–155). */
  seo: { titel: string; beschreibung: string };
  /** Datum der letzten inhaltlichen Änderung. */
  stand: string;
  /** Tag der Erstveröffentlichung (Article: datePublished) — fehlt = 19.09.2026, Start des Registers (E-191). */
  erschienen?: string;
  /** Merkblatt-Nummer im Kopf, z. B. „FG · 01“. */
  kennung: string;
  /** Die Oberzeile über der H1. */
  auge: string;
  /** H1 — erste Zeile gerade, zweite kursiv (wie auf /business). */
  h1: string;
  h1b?: string;
  lead: string;
  /** Zwei bis drei Kennziffern unter dem Lead. */
  ziffern?: { wert: string; label: string }[];
  /** „Auf einen Blick“ — das Merkblatt rechts im Kopf. */
  blick: [string, string][];
  /** „Kurz beantwortet“ — zwei, drei Sätze, die die Suchfrage beantworten. */
  kurz: string;
  bloecke: GlobalBlock[];
  fragen: { f: string; a: string }[];
  /** Das Paket, auf das die Knöpfe zeigen (fehlt = Paketübersicht). */
  paket?: GlobalSchluessel;
  /** Die Seite spricht Privatpersonen an: Jeder Auftrags-Knopf öffnet /business/start?art=privat. */
  auftraggeber?: "privat";
  /** Weiterlesen — Pfade anderer Seiten. */
  weiter: string[];
  /** Quellen für Zahlen und Regeln Dritter. */
  quellen?: GlobalQuelle[];
  /** Schlussband. */
  schluss?: { a: string; b: string; text: string };
  /** Sitemap-Priorität (Standard nach Art). */
  prio?: number;
}

/** Eine Anzeigen-Landingpage — nicht im Index, eine Handlung. */
export interface GlobalLandingpage {
  pfad: string;
  /** Die Seite, deren Inhalt sie verdichtet (Canonical-Ziel für Nutzer, nicht für Google). */
  quelle: string;
  seo: { titel: string; beschreibung: string };
  auge: string;
  h1: string;
  h1b?: string;
  lead: string;
  vorteile: string[];
  paket: GlobalSchluessel;
  fragen: { f: string; a: string }[];
}
