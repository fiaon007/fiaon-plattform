// ═══════════════════════════════════════════════════════════════════════════
// EINSTIEG IN DEN ANTRAG NACH THEMA (15.10.2026, E-381)
//
// Justin (15.10.2026): „wenn jemand über den Ratgeber wegen Bonitätsauszügen oder
// so kommt, kann er ja nicht eine Kreditkarte sehen im Antragsprozess … der
// Kreditkarten-Pitch ist nach wie vor unser stärkster und muss bleiben, aber was
// machen wir mit den Leuten aus den Ratgebern?" — und zum Vorschlag: „Ja, bau es so".
//
// Die Lösung: EIN Antrag, die Karte bleibt das Ziel und im Bild — nur die
// Erzählung beginnt dort, wo der Leser steht: „Erst Ihre Bonität. Dann Ihre Karte."
// Jedes Paket enthält ohnehin die Bonitätsauswertung und die Auswertung der
// Datenkopie (shared/fiaon-antrag-neu.ts, ANTRAG_NEU_PAKETE) — genau das, wofür
// jemand den Ratgeber liest.
//
//   · Der Ratgeber verlinkt /antrag?thema=<kategorie>&artikel=<slug> (über die
//     Weiche — sie reicht die Adresse an /antrag-neu weiter).
//   · Der erste Bildschirm zeigt die passende Überschrift; Preise, Limits und der
//     Kartensatz bleiben unverändert.
//   · Ohne thema (/start, Anzeigen, Direktaufruf) ändert sich NICHTS.
// ═══════════════════════════════════════════════════════════════════════════

export type AntragEinstieg = "bonitaet" | "eintraege";

/** Ratgeber-Kategorie → Einstieg. Karte/Kredit behalten den Karten-Einstieg (null), Firmen gehen zu FIAON Global. */
const THEMA_ZU_EINSTIEG: Record<string, AntragEinstieg | null> = {
  score: "bonitaet", auskunft: "bonitaet", grundlagen: "bonitaet", at: "bonitaet", ch: "bonitaet",
  eintraege: "eintraege", inkasso: "eintraege",
  karte: null, kredit: null, firmen: null,
};

export function einstiegAusThema(thema: unknown): AntragEinstieg | null {
  const t = String(thema ?? "").trim().toLowerCase();
  return THEMA_ZU_EINSTIEG[t] ?? null;
}

/** Nur Ratgeber-Kategorien und Slugs (Kleinbuchstaben, Ziffern, Bindestrich) — nie freier Text aus der Adresse. */
export function themaSauber(v: unknown): string {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[a-z]{2,20}$/.test(t) && t in THEMA_ZU_EINSTIEG ? t : "";
}
export function artikelSauber(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{3,120}$/.test(s) ? s : "";
}

export interface EinstiegText {
  /** Erster Bildschirm des Antrags (statt „Ihre Karte. Ihr Name."). */
  titel: string;
  lead: string;
  /** Knopf im Ratgeber (statt „Konto eröffnen"). */
  knopf: string;
}

export const EINSTIEG_TEXT: Record<AntragEinstieg, EinstiegText> = {
  bonitaet: {
    titel: "Erst Ihre Bonität. Dann Ihre Karte.",
    lead: "Wir prüfen jeden Eintrag Ihrer Datenkopie – und bringen Sie zur eigenen Visa-Kreditkarte.",
    knopf: "Meine Bonität prüfen lassen",
  },
  eintraege: {
    titel: "Erst Ihre Einträge klären. Dann Ihre Karte.",
    lead: "Wir prüfen jeden Eintrag Ihrer Datenkopie – und bringen Sie zur eigenen Visa-Kreditkarte.",
    knopf: "Meine Einträge prüfen lassen",
  },
};

/** Die kleine Zeile unter dem Ratgeber-Knopf. */
export const EINSTIEG_KNOPF_ZUSATZ = "inklusive Weg zur eigenen Visa-Kreditkarte";

/** Wohin der Ratgeber-Knopf führt (über die Weiche /antrag). Ohne passenden Einstieg: wie bisher. */
export function antragLinkAusRatgeber(kategorie: unknown, slug: unknown): string {
  const t = themaSauber(kategorie);
  const s = artikelSauber(slug);
  if (!t) return "/antrag";
  const q = new URLSearchParams({ thema: t });
  if (s) q.set("artikel", s);
  return `/antrag?${q.toString()}`;
}

/** Die Paket-Zeile für Ratgeber-Leser: woher sie kamen und was davon im Paket steckt. */
export function einstiegPaketZeile(artikelTitel: string | null | undefined): string {
  const t = String(artikelTitel ?? "").trim();
  return t
    ? `Sie kamen über „${t.length > 90 ? `${t.slice(0, 88)}…` : t}“ – genau das steckt in Ihrer Auswertung.`
    : "Sie kamen über unseren Ratgeber – genau das steckt in Ihrer Auswertung.";
}

/** Leistungen eines Pakets: für Ratgeber-Leser die Bonitäts-Punkte zuerst, die Karte als Ziel danach. Sonst unverändert. */
export function leistungenFuerEinstieg(leistungen: readonly string[], einstieg: AntragEinstieg | null): string[] {
  if (!einstieg) return [...leistungen];
  const bonitaet = (l: string) => /Bonitätsauswertung|Bonitätsauskunft|Datenkopie/.test(l);
  return [...leistungen.filter(bonitaet), ...leistungen.filter((l) => !bonitaet(l))];
}
