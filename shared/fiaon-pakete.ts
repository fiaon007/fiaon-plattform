// ═══════════════════════════════════════════════════════════════════════════
// DER PAKETKATALOG — EINE Quelle für Preise
//
// ── WARUM DIESE DATEI ENTSTANDEN IST ───────────────────────────────────────
// Es gab zwei Preislisten, und sie widersprachen sich:
//
//   server/routes/fiaon-antrag.ts   ultra 79,99   highend 99,99
//   server/lib/fiaon-abo-pflicht.ts ultra 99,99   highend 79,99
//
// Die erste bestimmte, was ein Kunde beim Kauf zahlt. Die zweite bestimmte,
// was ihm als Monatsrate in Rechnung gestellt wurde. Ein Ultra-Kunde kaufte
// also für 79,99 € und bekam Rechnungen über 99,99 €.
//
// Gemessen am 16.08.2026: 40 offene Ultra-Bestellungen standen auf 99,99 €,
// 124 offene High-End-Bestellungen auf 79,99 €. Bei den offenen Raten: 18
// Ultra über 99,99 € und 33 High End über 79,99 €.
//
// Die Entscheidung des Betreibers (16.08.2026): **Ultra 79,99 €, High End
// 99,99 €.** Der Kommentar in fiaon-abo-pflicht.ts behauptete das Gegenteil
// und berief sich auf eine Häufigkeitsauszählung des Kontoauszugs — die zählt
// aber nur, welche BETRÄGE vorkommen, nicht, zu welchem Paket sie gehören.
// Eine Häufigkeit ist keine Zuordnung.
//
// ── REGEL ──────────────────────────────────────────────────────────────────
// Kein Betrag steht mehr irgendwo sonst im Quelltext. Wer einen Paketpreis
// braucht, holt ihn hier. In `shared/`, weil ihn Server und Oberfläche
// gleichermaßen brauchen — und weil zwei Kopien genau das Problem waren.
// ═══════════════════════════════════════════════════════════════════════════

export interface Paket {
  /** Der Schlüssel in `fiaon_applications.pack_key`. */
  key: string;
  /** Wie es dem Kunden gegenüber heißt. */
  label: string;
  /**
   * Der Preis in CENT. Ganzzahlig, damit nichts gerundet wird.
   * Bei `abo: true` ist es der MONATSPREIS, bei `abo: false` der EINMALPREIS.
   */
  preisCents: number;
  /**
   * Privatkunde, Geschäftskunde der alten Bonitätslinie oder FIAON Global
   * (17.09.2026, E-188: die US-Struktur für Unternehmen — sie ersetzt die
   * Business-Abos im Verkauf).
   */
  art: "privat" | "business" | "global";
  /** Ist das ein Abonnement? Die Bonitätsauskunft und FIAON Global sind es nicht. */
  abo: boolean;
  /**
   * Wird nicht mehr verkauft. Der Eintrag bleibt, weil Bestandskunden ihn in
   * `pack_key` tragen und ihre Raten weiter den Katalogpreis brauchen. Keine
   * Preisliste, kein Auswahlfeld und kein Antrag bietet ihn mehr an.
   */
  eingestellt?: boolean;
}

export const PAKETE: Paket[] = [
  { key: "start",               label: "FIAON Start",               preisCents:   799, art: "privat",   abo: true },
  { key: "pro",                 label: "FIAON Pro (Standard)",      preisCents:  5999, art: "privat",   abo: true },
  { key: "ultra",               label: "FIAON Ultra",               preisCents:  7999, art: "privat",   abo: true },
  { key: "highend",             label: "FIAON High-End",            preisCents:  9999, art: "privat",   abo: true },
  // ── EINGESTELLT (17.09.2026, E-188) ──────────────────────────────────────
  // Die vier Business-Abos werden nicht mehr verkauft: /business ist seit
  // E-188 FIAON Global. Sie bleiben hier, damit die Raten der Bestandskunden
  // ihren Preis behalten.
  { key: "business_starter",    label: "FIAON Business Starter",    preisCents:  4999, art: "business", abo: true, eingestellt: true },
  { key: "business_pro",        label: "FIAON Business Pro",        preisCents:  9999, art: "business", abo: true, eingestellt: true },
  { key: "business_ultra",      label: "FIAON Business Ultra",      preisCents: 14999, art: "business", abo: true, eingestellt: true },
  { key: "business_enterprise", label: "FIAON Business Enterprise", preisCents: 24999, art: "business", abo: true, eingestellt: true },
  // ── KEIN ABO ─────────────────────────────────────────────────────────────
  // Die Bonitätsauskunft ist ein Einmalkauf. Sie steht hier, damit sie einen
  // Preis hat — und mit `abo: false`, damit sie NIE eine Rate erzeugt.
  { key: "schufa",              label: "Bonitätsauskunft",          preisCents:  7400, art: "privat",   abo: false },
  // ── FIAON GLOBAL (17.09.2026, E-188) — EINMALPREISE, KEIN ABO ────────────
  // Justin: „3 Pakete und 1 VIP Paket — die Preise so wie sie sind sind gut."
  // Was ein Paket enthält, steht in shared/fiaon-global.ts. `abo: false` ist
  // hier lebenswichtig: Ein Global-Paket darf NIE zwölf Monatsraten erzeugen.
  // Der Abo-Motor fragt deshalb `istAboPaket()` und nicht mehr das Wort
  // „schufa" (siehe fiaon-abo.ts).
  { key: "global_struktur",     label: "FIAON Global Struktur",     preisCents:  249900, art: "global", abo: false },
  { key: "global_banking",      label: "FIAON Global Banking",      preisCents:  499900, art: "global", abo: false },
  { key: "global_kapital",      label: "FIAON Global Kapital",      preisCents:  699900, art: "global", abo: false },
  { key: "global_vip",          label: "FIAON Global VIP",          preisCents: 3599900, art: "global", abo: false },
];

const NACH_KEY = new Map(PAKETE.map((p) => [p.key, p]));

export function paket(key: unknown): Paket | null {
  return NACH_KEY.get(String(key ?? "").trim().toLowerCase()) ?? null;
}

/** Der Katalogpreis in Cent (Monat bei Abo, sonst einmalig) — 0, wenn das Paket unbekannt ist. */
export function paketPreisCents(key: unknown): number {
  return paket(key)?.preisCents ?? 0;
}

/** Der Preis in Euro, wie ihn `fiaon_applications.amount_due` speichert. */
export function paketPreisEuro(key: unknown): number {
  return paketPreisCents(key) / 100;
}

/** Erzeugt dieses Paket eine monatliche Rate? */
export function istAboPaket(key: unknown): boolean {
  return paket(key)?.abo === true;
}

/** Gehört dieses Paket zu FIAON Global (Einmalpreis, US-Struktur)? */
export function istGlobalPaket(key: unknown): boolean {
  return paket(key)?.art === "global";
}

/** Was heute verkauft wird — eingestellte Pakete fehlen. */
export function verkaufbarePakete(art?: Paket["art"]): Paket[] {
  return PAKETE.filter((p) => !p.eingestellt && (!art || p.art === art));
}

/** Schlüssel aller Pakete, die KEINE Rate erzeugen dürfen — für SQL-Filter des Abo-Motors. */
export const NICHT_ABO_SCHLUESSEL: string[] = PAKETE.filter((p) => !p.abo).map((p) => p.key);

/** Die Preisliste in Euro — für Stellen, die historisch mit Euro rechnen. */
export const PAKET_PREISE_EURO: Record<string, number> = Object.fromEntries(
  PAKETE.filter((p) => p.key !== "schufa").map((p) => [p.key, p.preisCents / 100]),
);

/** Die Preisliste in Cent — für alles, was Geld ausrechnet. */
export const PAKET_PREISE_CENTS: Record<string, number> = Object.fromEntries(
  PAKETE.map((p) => [p.key, p.preisCents]),
);

export const SCHUFA_PREIS_EURO = paketPreisEuro("schufa");
