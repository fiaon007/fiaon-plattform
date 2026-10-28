// ═══════════════════════════════════════════════════════════════════════════
// DAS TEAM IN DER KACHEL „IHR TEAM“ AUF /business (E-442, 28.10.2026)
//
// Justin (28.10.): „Bei ‚Ihr Ansprechpartner‘ soll eine Animation sein, die das gesamte Team anzeigt — wechselt im
// 2-Sekunden-Takt: Daniel Stripling, dann Florentine Lombardi, dann Justin Schwarzott, dann Mag. Sarah Anderst, usw.“
// Reihenfolge wie von Justin genannt, danach das Team der Kapital-Angebote (Stand 27.10.2026, Rollen wie dort).
//
// Fotos (klein, 168 px: client/public/portraits/klein/<kuerzel>.webp):
// - Daniel und Florentine: echte Fotos. Justin: Porträt mit KI aus seinen echten Fotos (shared/fiaon-portraits.ts).
// - Alle übrigen: Symbolbilder, mit KI erstellt (08_Medien_Higgsfield, 08.10.2026) — wie in den Angeboten. Die Seite nennt
//   das in der Fußnote unter den Kacheln (KI-VO Art. 50 Abs. 4; Bildnachweis der Angebote: „Teamfotos teils Symbolbilder“).
// Recht und Steuern stehen als Partnernetz da — FIAON berät nicht selbst rechtlich oder steuerlich (so auch in den Paketen:
// „Partner-Anwalt“, „Partner-Steuerberater“).
// ═══════════════════════════════════════════════════════════════════════════

export type GlobalTeamPerson = {
  kuerzel: string;
  name: string;
  rolle: { de: string; en: string };
  /** true = Symbolbild oder mit KI erstelltes Porträt (die Fußnote nennt es). */
  ki: boolean;
};

export const GLOBAL_TEAM: readonly GlobalTeamPerson[] = [
  { kuerzel: "daniel", name: "Daniel Stripling", rolle: { de: "Gesellschafter · Leitung Vertrieb", en: "Partner · Head of Sales" }, ki: false },
  { kuerzel: "florentine", name: "Florentine Lombardi", rolle: { de: "Geschäftsführerin · Menschen & Onboarding", en: "Managing Director · People & Onboarding" }, ki: false },
  { kuerzel: "justin", name: "Justin Schwarzott", rolle: { de: "Gründer · Geschäftsführer", en: "Founder · Managing Director" }, ki: true },
  { kuerzel: "sarah-anderst", name: "Mag. Sarah Anderst", rolle: { de: "Steuern und Buchhaltung · Partnernetz", en: "Tax and accounting · Partner network" }, ki: true },
  { kuerzel: "laukermann", name: "Dr. Laukermann", rolle: { de: "Partner-Anwalt · Gesellschaftsrecht", en: "Partner lawyer · Corporate law" }, ki: true },
  { kuerzel: "matthias-hamschmidt", name: "Matthias Hamschmidt", rolle: { de: "PR und Print-Marketing", en: "PR and print marketing" }, ki: true },
  { kuerzel: "silvia-goechzahn", name: "Silvia Göchzahn", rolle: { de: "Grafik und Design", en: "Graphic design" }, ki: true },
  { kuerzel: "samuel-harison", name: "Samuel Harison", rolle: { de: "IT und Entwicklung", en: "IT and development" }, ki: true },
  { kuerzel: "lisa-lennert", name: "Lisa Lennert", rolle: { de: "Marketing und Influencer", en: "Marketing and influencers" }, ki: true },
  { kuerzel: "sascha-bauer", name: "Sascha Bauer", rolle: { de: "Projektleitung Strategie und Plan", en: "Project lead · Strategy and planning" }, ki: true },
  { kuerzel: "mary-walster", name: "Mary Walster", rolle: { de: "US-Sekretariat der Gesellschaft", en: "US secretariat for your company" }, ki: true },
  { kuerzel: "hermann-hakut", name: "Hermann Hakut", rolle: { de: "Logistik und Produktion", en: "Logistics and production" }, ki: true },
];

/** Kleines Porträt (168 × 168 px, WebP) — für Kacheln und Avatare. */
export function teamFoto(kuerzel: string): string {
  return `/portraits/klein/${kuerzel}.webp`;
}

/** Wie lange jede Person in der Kachel steht, bevor die nächste kommt (Justin: „2-Sekunden-Takt oder so“). */
export const GLOBAL_TEAM_TAKT_MS = 2400;
