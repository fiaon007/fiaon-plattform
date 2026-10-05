/**
 * Die Social-Profile von FIAON (E-292) — EINE Liste für Fußzeilen, strukturierte Daten (sameAs) und das Social-Studio.
 * Nur Profile, die nachweislich FIAON gehören (06.10.2026 per Graph geprüft: Seite „FIAON“ ↔ Instagram fiaon.ltd).
 * LinkedIn, TikTok und YouTube kommen dazu, sobald die Konten stehen. Nie erfinden.
 */
export interface SozialesProfil {
  kanal: "instagram" | "facebook";
  name: string;
  handle: string;
  href: string;
}

export const SOZIALE_PROFILE: SozialesProfil[] = [
  { kanal: "instagram", name: "Instagram", handle: "@fiaon.ltd", href: "https://www.instagram.com/fiaon.ltd/" },
  { kanal: "facebook", name: "Facebook", handle: "FIAON", href: "https://www.facebook.com/1324522150745032" },
];
