// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Typen für Inhalte (23.08.2026, Plan §11)
// Inhalte sind Daten, keine JSX-Wüsten: Jeder Schritt besteht aus Blöcken,
// Übungen tragen ihre Daten mit. Das Gerüst (Schlüssel, Mindestlesezeiten)
// kommt aus shared/fiaon-academy-lehrplan.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type Block =
  | { art: "absatz"; text: string }
  | { art: "liste"; punkte: string[]; nummeriert?: boolean }
  | { art: "merksatz"; text: string }
  | { art: "warnung"; text: string }
  | { art: "zitat"; text: string; quelle?: string }
  | { art: "tabelle"; kopf: string[]; zeilen: string[][] }
  | { art: "sagen"; sagen: string[]; nieSagen: string[] }
  | { art: "schritte"; titel?: string; schritte: { titel: string; text: string }[] }
  | { art: "drei-sichten"; kunde: string; mitarbeiter: string; hintergrund: string }
  | { art: "muster"; titel: string; text: string }
  | { art: "kacheln"; kacheln: { titel: string; text: string }[] }
  | { art: "link"; href: string; label: string }
  | { art: "quellen"; quellen: string[] }
  | { art: "leitfaden"; phasen: { titel: string; ziel: string; saetze: string[]; hinweis?: string }[] };

export interface Frage { frage: string; antworten: string[]; richtig: number; erklaerung: string }

export interface EinwandAntwort { text: string; bewertung: "gut" | "mittel" | "schlecht"; begruendung: string }
export interface Einwand { einwand: string; kontext?: string; antworten: EinwandAntwort[] }

export interface ZeitStation { tag: string; titel: string; wer: string; text: string; system?: string }
export interface RundgangStation { anker: string; titel: string; kunde: string; mitarbeiter: string }
export interface FallOption { text: string; richtig?: boolean; folge: string }
export interface Fall { situation: string; akte?: string[]; frage: string; optionen: FallOption[]; aufloesung: string; lehre: string }

export type RechnerArt = "loeschfrist" | "verjaehrung" | "inkassokosten";
export interface RechnerErgebnis { art: RechnerArt; datum?: string | null; kurz?: boolean; verjaehrt?: boolean; zulaessig?: number; differenz?: number; ueberhoeht?: boolean; titel?: string }

export type Uebung =
  | { art: "zeitleiste"; stationen: ZeitStation[] }
  | { art: "rundgang"; stationen: RundgangStation[] }
  | { art: "wortpruefer"; aufgaben: { satz: string; hinweis: string }[] }
  | { art: "einwand"; einwaende: Einwand[] }
  | { art: "simulator" }
  | { art: "rechner"; rechner: RechnerArt; aufgabe: { text: string; erwartet: string; pruefe: (e: RechnerErgebnis) => boolean } }
  | { art: "uebung"; raum: { href: string; label: string }; schritte: string[]; frage: Frage }
  | { art: "fall"; fall: Fall };

export interface SchrittInhalt { einleitung?: string; bloecke?: Block[]; uebung?: Uebung }
export interface KapitelInhalt { inhalte: Record<string, SchrittInhalt>; test: Frage[] }

// ── Kurzschreibweisen für die Kapitel-Dateien ─────────────────────────────
export const p = (text: string): Block => ({ art: "absatz", text });
export const ul = (...punkte: string[]): Block => ({ art: "liste", punkte });
export const ol = (...punkte: string[]): Block => ({ art: "liste", punkte, nummeriert: true });
export const merk = (text: string): Block => ({ art: "merksatz", text });
export const warn = (text: string): Block => ({ art: "warnung", text });
export const zitat = (text: string, quelle?: string): Block => ({ art: "zitat", text, quelle });
export const tab = (kopf: string[], ...zeilen: string[][]): Block => ({ art: "tabelle", kopf, zeilen });
export const sagen = (sagen: string[], nieSagen: string[]): Block => ({ art: "sagen", sagen, nieSagen });
export const schritte = (titel: string | undefined, ...s: [string, string][]): Block => ({ art: "schritte", titel, schritte: s.map(([titel, text]) => ({ titel, text })) });
export const sichten = (kunde: string, mitarbeiter: string, hintergrund: string): Block => ({ art: "drei-sichten", kunde, mitarbeiter, hintergrund });
export const muster = (titel: string, text: string): Block => ({ art: "muster", titel, text });
export const kacheln = (...k: [string, string][]): Block => ({ art: "kacheln", kacheln: k.map(([titel, text]) => ({ titel, text })) });
export const link = (href: string, label: string): Block => ({ art: "link", href, label });
export const quellen = (...q: string[]): Block => ({ art: "quellen", quellen: q });
export const frage = (frage: string, antworten: string[], richtig: number, erklaerung: string): Frage => ({ frage, antworten, richtig, erklaerung });
