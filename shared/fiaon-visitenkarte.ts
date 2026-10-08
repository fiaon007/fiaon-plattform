/**
 * Öffentliche Visitenkarten (E-309, Justin 08.10.2026: „Daniel Stripling, E-Mail, Nummer, Bild — einladend, verdammt hochwertig“).
 *
 * Nur Menschen, deren Porträt, E-Mail und Nummer ohnehin öffentlich auf /team stehen (Team.tsx liest Mail und Nummer von hier —
 * eine Quelle). Wer hier fehlt, erscheint auf Terminseiten weiter nur mit Vornamen und Monogramm: Ein Profilbild aus dem
 * Mitarbeiterbereich gehört ohne ausdrückliche Freigabe nicht auf eine öffentliche Seite.
 * Der Server gibt zur zuständigen Person nur das Kürzel heraus (fiaon-global-termin.ts); alles Weitere steht hier.
 */
export type Visitenkarte = {
  agentId: number;
  kuerzel: string;
  name: string;
  vorname: string;
  rolle: { de: string; en: string };
  email: string;
  telefon: string;
};

export const VISITENKARTEN = {
  justin: {
    agentId: 928, kuerzel: "justin", name: "Justin Schwarzott", vorname: "Justin",
    rolle: { de: "Gründer · Geschäftsführer", en: "Founder · Managing Director" },
    email: "js@fiaon.com", telefon: "+41 77 288 4902",
  },
  florentine: {
    agentId: 10, kuerzel: "florentine", name: "Florentine Lombardi", vorname: "Florentine",
    rolle: { de: "Geschäftsführerin · Menschen & Onboarding", en: "Managing Director · People & Onboarding" },
    email: "florentine@fiaon.com", telefon: "+41 77 202 84 49",
  },
  daniel: {
    agentId: 8, kuerzel: "daniel", name: "Daniel Stripling", vorname: "Daniel",
    rolle: { de: "Gesellschafter · Leitung Vertrieb", en: "Partner · Head of Sales" },
    email: "daniel@fiaon.com", telefon: "+41 77 281 18 34",
  },
} as const satisfies Record<string, Visitenkarte>;

export type VisitenkartenKuerzel = keyof typeof VISITENKARTEN;

export function visitenkarteFuerAgent(agentId: number | null | undefined): Visitenkarte | null {
  if (!agentId) return null;
  return Object.values(VISITENKARTEN).find((k) => k.agentId === Number(agentId)) ?? null;
}

export function visitenkarte(kuerzel: string | null | undefined): Visitenkarte | null {
  if (!kuerzel) return null;
  return (VISITENKARTEN as Record<string, Visitenkarte>)[kuerzel] ?? null;
}

/** tel:-Link ohne Leerzeichen („+41 77 281 18 34“ → „tel:+41772811834“). */
export function telefonLink(telefon: string): string {
  return `tel:${telefon.replace(/[^\d+]/g, "")}`;
}
