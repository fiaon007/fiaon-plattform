// ═══════════════════════════════════════════════════════════════════════════
// WELCHE POSTFÄCHER MARA BEDIENT — EINE QUELLE (09.09.2026, E-171)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Justin: „entferne js@fiaon.com bitte als Email Agent — nur für Welcome,
// support bitte und auf automatik."
//
// Warum das dringend war, steht in den Daten: js@fiaon.com ist Justins
// persönliches Postfach, und dort liegt seine Investorenpost. Am 08.09.2026 um
// 09:29 gingen in EINEM Zug sechzehn von Mara geschriebene Antworten an
// Investoren hinaus — Portage Capital, b2venture, Bayern Kapital, NRW.SeedCap,
// BMH Hessen, Innovationsstarter Hamburg, Genius VC, Impact Shakers, Invesdor,
// bmp, GLS Crowd, Wirtschaftsagentur Wien — unterschrieben mit „Justin
// Schwarzott". Umgekehrt legte sie eingehende Investorenantworten als
// „automatische Nachricht" ab und markierte sie als gelesen, darunter am
// 09.09. „Re: 550.000 € — Ihre Untergrenze schließt unsere Runde allein"
// von Freigeist Capital.
//
// Ein Agent, der für den Kundendienst gebaut ist, hat in der Investorenpost
// des Gründers nichts verloren. Deshalb steht die Liste jetzt an EINER Stelle,
// und jeder Weg in Maras Maschine fragt vorher `wirdBedient()`.
//
// ── WER DIESE LISTE ÄNDERT ────────────────────────────────────────────────
// Nur Justin, und nur wörtlich. Ein Postfach hier einzutragen heißt: Mara liest
// dort mit, ordnet, schreibt und sendet.
// ═══════════════════════════════════════════════════════════════════════════

export type Modus = "auto" | "hybrid" | "entwurf";

export const POSTFAECHER: { adresse: string; modus: Modus; gruss: string }[] = [
  { adresse: "support@fiaon.com", modus: "auto", gruss: "Freundliche Grüße\nIhr FIAON-Support\nsupport@fiaon.com · fiaon.com" },
  { adresse: "welcome@fiaon.com", modus: "auto", gruss: "Freundliche Grüße\nIhr FIAON Welcome-Team\nwelcome@fiaon.com · fiaon.com" },
  // 04.09.2026: info@fiaon.com ist bei Google kein Nutzer (invalid_grant bei jedem
  // Lauf). Justin legt es als Alias auf welcome@ — dann landet alles ohnehin hier.
  //
  // 09.09.2026 (E-171): js@fiaon.com ist RAUS — Justins persönliches Postfach mit
  // der Investorenpost. Nicht auskommentiert, sondern gestrichen: Ein Eintrag,
  // der nur durch einen Modus stillgelegt ist, wird beim nächsten Umbau wieder
  // scharf. Alte js@-Vorgänge bleiben in der Datenbank sichtbar, sind aber nicht
  // mehr sendbar (Wand in fiaon-postmeister-zentrale.ts).
];

/** Die Adressen der bedienten Postfächer. */
export function postfachAdressen(): string[] {
  return POSTFAECHER.map((p) => p.adresse);
}

/**
 * Bedient Mara dieses Postfach? DIE Wand vor jedem Lesen, Schreiben und Senden.
 * Ohne sie reichte eine alte Zeile in der Datenbank oder ein Aufruf von Hand,
 * damit sie wieder in einem fremden Postfach schreibt.
 */
export function wirdBedient(adresse: unknown): boolean {
  const a = String(adresse ?? "").trim().toLowerCase();
  return POSTFAECHER.some((p) => p.adresse.toLowerCase() === a);
}

/** Der Gruß eines Postfachs (roh, ohne Agentennamen). */
export function postfachGruss(adresse: string): string {
  return POSTFAECHER.find((p) => p.adresse === adresse)?.gruss
    ?? "Freundliche Grüße\nIhr FIAON-Team\nfiaon.com";
}
