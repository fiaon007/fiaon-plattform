// ═══════════════════════════════════════════════════════════════════════════
// WANN WILL DER KUNDE ANGERUFEN WERDEN? — EINE QUELLE (11.09.2026, E-184)
//
// Der Antrag fragt seit P18 (28.08.2026) in Schritt 1: „Wann erreichen wir Sie
// am besten?" Fünf Chips, die Antwort steht wörtlich in
// fiaon_applications.erreichbarkeit. Team-Feedback vom 11.09.: „Kunde gibt
// 08–12 an → wird nur in diesem Zeitraum angezeigt; 18–20 → erst ab 18 Uhr;
// flexibel → den ganzen Tag." Dafür brauchen Formular, Server-Reihung und
// Karte dieselbe Tabelle — sonst tippt einer „8-12" und der andere prüft
// „8–12" (Gedankenstrich U+2013, so steht es in 87 Bestandsdatensätzen).
//
// Regel: keine Angabe oder „Flexibel" = immer erreichbar. Ein Fenster gilt
// von <von> bis ausschließlich <bis> Uhr Berliner Zeit.
// ═══════════════════════════════════════════════════════════════════════════

export const ERREICHBARKEIT_FENSTER = [
  { wert: "Vormittags (8–12)", kurz: "8–12 Uhr", von: 8, bis: 12 },
  { wert: "Mittags (12–15)", kurz: "12–15 Uhr", von: 12, bis: 15 },
  { wert: "Nachmittags (15–18)", kurz: "15–18 Uhr", von: 15, bis: 18 },
  { wert: "Abends (18–20)", kurz: "18–20 Uhr", von: 18, bis: 20 },
  { wert: "Flexibel", kurz: "flexibel", von: null, bis: null },
] as const;

export type ErreichbarkeitWert = (typeof ERREICHBARKEIT_FENSTER)[number]["wert"];

/** Die Chip-Beschriftungen des Antrags, in dieser Reihenfolge. */
export const ERREICHBARKEIT_WERTE: readonly string[] = ERREICHBARKEIT_FENSTER.map((f) => f.wert);

function fenster(wert: string | null | undefined) {
  const w = String(wert ?? "").trim();
  return ERREICHBARKEIT_FENSTER.find((f) => f.wert === w) ?? null;
}

/** „8–12 Uhr" für die Karte; leer, wenn keine Angabe. */
export function kurzFenster(wert: string | null | undefined): string {
  return fenster(wert)?.kurz ?? "";
}

/** Liegt die Berliner Stunde im Wunschfenster? Unbekannt/leer/Flexibel = ja. */
export function jetztErreichbar(wert: string | null | undefined, stundeBerlin: number): boolean {
  const f = fenster(wert);
  if (!f || f.von == null || f.bis == null) return true;
  return stundeBerlin >= f.von && stundeBerlin < f.bis;
}

/**
 * Derselbe Test als SQL-Ausdruck (boolean). `angabeSql` liefert den Text aus
 * dem Antrag, `stundeSql` die Berliner Stunde als Ganzzahl. Wer die Tabelle
 * oben ändert, ändert damit auch die Reihung der Arbeitsliste.
 */
export function jetztErreichbarSql(angabeSql: string, stundeSql: string): string {
  const zweige = ERREICHBARKEIT_FENSTER
    .filter((f) => f.von != null && f.bis != null)
    .map((f) => `WHEN '${f.wert}' THEN (${stundeSql} >= ${f.von} AND ${stundeSql} < ${f.bis})`)
    .join(" ");
  return `(CASE ${angabeSql} ${zweige} ELSE TRUE END)`;
}
