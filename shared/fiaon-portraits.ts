/**
 * Porträts unter client/public/portraits/<kuerzel>.jpg (E-288).
 *
 * - Stand je Bild: Die Dateien liegen 30 Tage im Browser-Speicher (server/vite.ts) — ein neues Bild
 *   unter altem Namen bekommt deshalb ?v=<Stand>, sonst sähen Besucher noch wochenlang das alte.
 * - KI-Kennzeichnung (Art. 50 Abs. 4 KI-VO): Ein realistisches, mit KI erzeugtes Bild einer echten
 *   Person trägt am Bild den Hinweis „Porträt mit KI erstellt“.
 *
 * 05.10.2026: Justins neues Website-Porträt („Charakter-Nahaufnahme“, aus seinen echten Fotos mit KI
 * erzeugt, von ihm ausgewählt) ersetzt das alte Büro-Foto vollständig.
 */
const STAND: Record<string, string> = { justin: "2026-10-05" };
const KI: Record<string, true> = { justin: true };
const ALT: Record<string, { de: string; en: string }> = {
  justin: { de: "Justin Schwarzott, Gründer von FIAON", en: "Justin Schwarzott, founder of FIAON" },
};

export const KI_PORTRAIT_HINWEIS = { de: "Porträt mit KI erstellt", en: "Portrait created with AI" } as const;

export function portraitUrl(kuerzel: string): string {
  const v = STAND[kuerzel];
  return `/portraits/${kuerzel}.jpg${v ? `?v=${v}` : ""}`;
}

export function portraitMitKi(kuerzel: string): boolean {
  return KI[kuerzel] === true;
}

export function portraitAlt(kuerzel: string, name: string, sprache: "de" | "en" = "de"): string {
  return ALT[kuerzel]?.[sprache] ?? name;
}
