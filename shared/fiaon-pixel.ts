// ═══════════════════════════════════════════════════════════════════════════
// PIXELBREITE VON TITEL UND BESCHREIBUNG (03.09.2026, E-092)
//
// Google und Seobility messen Seitentitel und Meta-Description NICHT in
// Zeichen, sondern in Pixeln: Der Titel wird in Arial 20 px gerendert (Grenze
// 580 px), die Beschreibung in Arial 14 px (Grenze 1000 px). „SCHUFA“ ist
// darin fast doppelt so breit wie „schufa“ — deshalb reißt eine Zeichenzahl
// die Grenze nie zuverlässig.
//
// Die Tabelle unten sind die Originalbreiten der Schrift Arial/Helvetica in
// 1/1000 em (AFM-Metriken). Breite = Summe(Zeichenbreiten) / 1000 × Schriftgröße.
// Geprüft gegen die zehn Messwerte aus dem Seobility-Bericht vom 02.09.2026
// (Abweichung unter drei Prozent, siehe scripts/seo-pixel-probe.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** Arial/Helvetica, Breite je Zeichen in 1/1000 em. */
const BREITE: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  "{": 334, "|": 260, "}": 334, "~": 584,
  "€": 556, "§": 556, "°": 400, "©": 737, "®": 737, "·": 278, "–": 556, "—": 1000,
  "„": 333, "“": 333, "”": 333, "‚": 191, "‘": 191, "’": 191, "…": 1000, "×": 584,
  "Ä": 667, "Ö": 778, "Ü": 722, "ä": 556, "ö": 556, "ü": 556, "ß": 556,
  "À": 667, "Á": 667, "É": 667, "È": 667, "á": 556, "é": 556, "è": 556, "í": 278, "ó": 556, "ú": 556, "ñ": 556,
  "→": 1000, "✓": 556, "✗": 556, "•": 350, "≈": 549, "≤": 549, "≥": 549,
};
const RUECKFALL = 556;

export function pixelBreite(text: string, schriftgroesse: number): number {
  let summe = 0;
  for (const z of text) summe += BREITE[z] ?? RUECKFALL;
  return Math.round((summe / 1000) * schriftgroesse);
}

/** Seitentitel: Arial 20 px, Google schneidet ab etwa 580 px ab. */
export const titelPixel = (t: string) => pixelBreite(t, 20);
/** Meta-Description: Arial 14 px, Google schneidet ab etwa 1000 px ab. */
export const beschreibungPixel = (t: string) => pixelBreite(t, 14);

export const TITEL_MAX_PX = 580;
export const BESCHREIBUNG_MAX_PX = 1000;

/** Wortwiederholung im Titel (Keyword Stuffing) — ohne Füllwörter und Marke. */
const FUELL = new Set(["der", "die", "das", "und", "oder", "für", "mit", "von", "im", "in", "am", "zu", "the", "and", "or", "for", "with", "of", "in", "on", "a", "to", "by", "your", "de"]);
export function wortwiederholung(titel: string): string[] {
  const woerter = titel.toLowerCase().replace(/[|·—–:,.()§&]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !FUELL.has(w));
  const zaehler = new Map<string, number>();
  for (const w of woerter) zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
  return [...zaehler.entries()].filter(([, n]) => n > 1).map(([w]) => w);
}

/**
 * Kürzt eine Meta-Description auf die Pixelgrenze — an einer Satz-, Komma- oder
 * Wortgrenze, mit Auslassungszeichen. Vorher wurde nach 155 ZEICHEN gekürzt;
 * bei Texten voller Großbuchstaben ließ das bis 1247 px durch (Seobility-Bericht
 * vom 02.09.2026: zehn abgeschnittene Beschreibungen).
 */
export function beschreibungKuerzen(text: string, maxPx = BESCHREIBUNG_MAX_PX): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (beschreibungPixel(t) <= maxPx) return t;
  const platz = maxPx - beschreibungPixel("…");
  let ende = 0, breite = 0;
  for (let i = 0; i < t.length; i++) {
    breite += beschreibungPixel(t[i]);
    if (breite > platz) break;
    if (t[i] === " ") ende = i;
  }
  const kurz = t.slice(0, ende || t.length);
  const schnitt = Math.max(kurz.lastIndexOf(". "), kurz.lastIndexOf(", "), kurz.lastIndexOf(" – "));
  return (schnitt > kurz.length * 0.6 ? kurz.slice(0, schnitt) : kurz).replace(/[,–\-\s]+$/, "") + "…";
}

/**
 * Hängt „| FIAON" an einen Titel — aber nur, wenn er damit unter der Pixelgrenze
 * bleibt. Ein bereits vorhandener Markenanhang wird vorher entfernt.
 */
export function titelMitMarke(roh: string, maxPx = TITEL_MAX_PX): string {
  const t = String(roh ?? "").replace(/\s*[|·—-]\s*FIAON( Ratgeber)?\s*$/i, "").trim();
  const mitMarke = `${t} | FIAON`;
  return titelPixel(mitMarke) <= maxPx ? mitMarke : t;
}
