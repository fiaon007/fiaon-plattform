// ═══════════════════════════════════════════════════════════════════════════
// DIE PRODUKTKATEGORIE — WAS DARF WAS ERSETZEN? (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Seit dem 03.08.2026 kennt das Haus zwei Kategorien (supersedeSisterOrders in
// fiaon-antrag.ts): das STUFENPAKET — ein Konto hat genau eine Stufe, eine
// neue Bestellung legt die alte offene still — und das ZUSATZPRODUKT
// Bonitätsauskunft, das daneben steht. Die Grenze fehlte einmal ganz und
// kostete 583,98 € offenen Umsatz: Eine 74-€-Zahlung tötete eine offene
// Ultra-Bestellung.
//
// Mit FIAON Global wiederholt sich die Lage, nur teurer. Ein Global-Paket ist
// kein Stufenpaket der Bonitätslinie: Ein Unternehmer kann ein laufendes
// Privatpaket haben UND für seine Firma Global Struktur bestellen. Ohne dritte
// Kategorie hätte seine neue Privatbestellung über 7,99 € die offene
// Global-Bestellung über 2.499 € stillgelegt — und umgekehrt.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
//   auskunft  type = schufa oder Referenz FIAON-SCHUFA-…  (wie bisher; die
//             Marke schlägt den Paketschlüssel, weil sechs Auskünfte im
//             pack_key das Stufenpaket ihres Kunden tragen — siehe
//             fiaon-massgebliche-bestellung.ts)
//   global    pack_key ist ein Katalogpaket mit art „global"
//   konto     alles andere: die Stufenpakete, privat wie Business-Altbestand
// Stillgelegt wird nur INNERHALB einer Kategorie. Innerhalb von „global" ist
// das richtig: Global Banking enthält Global Struktur, die offene kleinere
// Bestellung ist mit der größeren erledigt.
//
// Als Funktion UND als SQL-Ausdruck aus derselben Schlüsselliste — zwei
// Fassungen, die auseinanderlaufen können, wären die nächste Falle.
// ═══════════════════════════════════════════════════════════════════════════
import { PAKETE, paket } from "@shared/fiaon-pakete";

export type Produktkategorie = "auskunft" | "global" | "konto";

/** Wie die Kategorie im Kundenverlauf heißt. */
export const KATEGORIE_TEXT: Record<Produktkategorie, string> = {
  auskunft: "Zusatzprodukt (Bonitätsauskunft)",
  global: "Einmalpaket (FIAON Global)",
  konto: "Stufenpaket (Kontoaktivierung)",
};

export function produktkategorie(
  zeile: { type?: unknown; ref?: unknown; pack_key?: unknown },
): Produktkategorie {
  if (String(zeile.type ?? "").toLowerCase() === "schufa" || String(zeile.ref ?? "").startsWith("FIAON-SCHUFA-")) {
    return "auskunft";
  }
  return paket(zeile.pack_key)?.art === "global" ? "global" : "konto";
}

// Die Schlüssel landen als Literale in SQL — sie kommen aus dem eigenen
// Katalog, die Form wird trotzdem geprüft (wie in fiaon-kein-abo.ts).
function globalSchluesselListe(): string {
  const keys = PAKETE.filter((p) => p.art === "global").map((p) => p.key);
  const falsch = keys.filter((k) => !/^[a-z0-9_]+$/.test(k));
  if (falsch.length > 0) throw new Error(`[KATEGORIE] Paketschlüssel mit unerlaubten Zeichen: ${falsch.join(", ")}`);
  return keys.length > 0 ? keys.map((k) => `'${k}'`).join(", ") : "''";
}

/**
 * Die Kategorie als SQL-Ausdruck (Text: auskunft | global | konto).
 *
 * `alias` leer = unqualifizierte Spalten, für Abfragen ohne Tabellenalias.
 * Der Ausdruck ist nie NULL: COALESCE an jeder Spalte, ELSE-Zweig am Ende.
 */
export function produktkategorieSql(alias = ""): string {
  if (alias && !/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error(`[KATEGORIE] Ungültiger Tabellenalias: ${alias}`);
  const s = (spalte: string) => (alias ? `${alias}.${spalte}` : spalte);
  return `(CASE
    WHEN COALESCE(${s("type")}, '') = 'schufa' OR COALESCE(${s("ref")}, '') LIKE 'FIAON-SCHUFA-%' THEN 'auskunft'
    WHEN LOWER(TRIM(COALESCE(${s("pack_key")}, ''))) IN (${globalSchluesselListe()}) THEN 'global'
    ELSE 'konto' END)`;
}
