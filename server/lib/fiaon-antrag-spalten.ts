// ═══════════════════════════════════════════════════════════════════════════
// DIE SPALTENLISTE OHNE ANHÄNGE (27.08.2026)
//
// fiaon_applications trägt drei bytea-Spalten mit hochgeladenen Unterlagen:
// bank_statement_pdf, id_card_pdf, schufa_pdf. Über den Bestand sind das
// 323 MB, verteilt auf 124 von 2.656 Zeilen.
//
// Ein Stern in der Abfrage holt diese Bytes aus Frankfurt mit — auch dort, wo
// der Code sie danach wegwirft. Gemessen am 27.08.2026 an der Produktion:
//
//   · GET /admin/applications        26,5 s   — 2.656 Zeilen, 323 MB Anhänge,
//                                               die der Code Zeile für Zeile
//                                               wieder aus dem Ergebnis löscht.
//   · GET /admin/invoices/download-all        — zieht 329 MB, braucht davon
//                                               kein einziges Byte.
//   · loadLoginFamily                bei JEDEM Login. Schwerster Fall 38 MB,
//                                    Schnitt 3 MB — und zwar ausgerechnet bei
//                                    den zahlenden Kunden, denn nur die haben
//                                    Unterlagen hochgeladen. Wer nichts
//                                    hochgeladen hat, kam schnell hinein.
//
// Diese Liste nennt jede Spalte AUSSER den dreien und hängt statt der Bytes
// die Frage an, OB etwas da ist: has_bank_statement_pdf, has_id_card_pdf,
// has_schufa_pdf. Genau diese drei Felder hat die Antragsliste vorher im
// JavaScript gebaut — die Antwort an die Oberfläche bleibt also gleich.
//
// Wer die Datei selbst braucht, holt sie über ihren eigenen Weg
// (GET /admin/applications/:ref/document/:type) — eine Zeile, eine Datei.
//
// Die Liste wird EINMAL je Prozess aus dem Katalog gelesen. Neue Spalten sind
// nach dem nächsten Start dabei, und jeder Deploy startet neu.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/** Die drei schweren Spalten. Wer eine vierte einführt, trägt sie hier ein. */
export const ANHANG_SPALTEN = ["bank_statement_pdf", "id_card_pdf", "schufa_pdf"] as const;

let gemerkt: string | null = null;

/**
 * Liefert die Auswahlliste für fiaon_applications ohne die Anhang-Spalten,
 * dafür mit has_*-Kennzeichen. Einsetzbar über sqlPool.unsafe(...).
 */
export async function antragsSpaltenOhneAnhaenge(): Promise<string> {
  if (gemerkt) return gemerkt;

  const ausgeschlossen = ANHANG_SPALTEN as unknown as string[];
  const zeilen = (await sqlPool`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'fiaon_applications'
       AND column_name <> ALL (${ausgeschlossen})
     ORDER BY ordinal_position
  `) as any[];

  // Eine leere Liste würde stillschweigend zu einer kaputten Abfrage führen.
  // Lieber laut scheitern als eine Seite, die nichts mehr zeigt.
  if (!zeilen.length) {
    throw new Error("[ANTRAGS-SPALTEN] Katalog lieferte keine Spalten für fiaon_applications");
  }

  gemerkt = [
    ...zeilen.map((z) => `"${z.column_name}"`),
    ...ANHANG_SPALTEN.map((s) => `(${s} IS NOT NULL) AS has_${s}`),
  ].join(", ");
  return gemerkt;
}
