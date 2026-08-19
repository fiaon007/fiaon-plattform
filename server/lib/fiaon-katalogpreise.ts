// ═══════════════════════════════════════════════════════════════════════════
// DIE PREIS-ABSCHRIFT IN DER DATENBANK NACHZIEHEN
//
// ── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
// Die Katalogpreis-Wand (Migration 065) ist ein Trigger, und ein Trigger kann
// keine TypeScript-Datei lesen. Er braucht die Preise in einer Tabelle.
//
// Damit gibt es sie zweimal — genau die Lage, die AGENTS.md verbietet
// („Eine Definition, ein Ort"). Zulässig ist sie nur unter drei Bedingungen,
// und die stehen hier alle:
//
//   1. Die Tabelle ist ausdrücklich eine ABSCHRIFT. Die eine Quelle ist
//      shared/fiaon-pakete.ts.
//   2. Sie wird NACHGEZOGEN, nicht gepflegt — beim Serverstart, aus dem
//      Katalog.
//   3. Ein Prüfstand hält beide Seiten gegeneinander
//      (scripts/pruef-katalogpreis-wand.ts). Weicht die Abschrift ab, wird er
//      rot.
//
// Ohne die dritte Bedingung wäre das dieselbe Falle wie bei den zwei
// Preislisten, aus denen shared/fiaon-pakete.ts entstanden ist: Ein Ultra-Kunde
// kaufte für 79,99 € und bekam Rechnungen über 99,99 €.
//
// ── WARUM KEIN „DELETE WAS NICHT MEHR IM KATALOG STEHT" ────────────────────
// Ein Paket, das aus dem Katalog verschwindet, hat im Bestand noch
// Bestellungen. Verschwindet auch der Preis, prüft die Wand sie nicht mehr —
// und ein alter Preis in der Tabelle ist besser als kein Preis. Verschwundene
// Schlüssel werden deshalb GEMELDET, nicht gelöscht.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { PAKETE } from "../../shared/fiaon-pakete";

type Lauf = typeof sqlPool;

let gelaufen = false;

export interface KatalogAbgleich {
  /** Wie viele Zeilen entstanden oder wurden geändert. */
  geschrieben: number;
  /** Schlüssel in der Tabelle, die der Katalog nicht (mehr) kennt. */
  verwaist: string[];
}

/**
 * Die Preise aus dem Katalog in `fiaon_paketpreise` schreiben.
 *
 * Idempotent: Ein zweiter Aufruf ändert nichts (der Prüfstand ruft sie
 * zweimal). `lauf` ist Pflicht für Prüfstände in einer Transaktion — ohne den
 * Parameter arbeitet die Funktion am globalen Pool und sähe die Testdaten
 * nicht (AGENTS.md, dreifach gelernt).
 */
export async function katalogpreiseSyncen(lauf: Lauf = sqlPool): Promise<KatalogAbgleich> {
  let geschrieben = 0;
  for (const p of PAKETE) {
    const rows = await lauf`
      INSERT INTO fiaon_paketpreise (pack_key, preis_cents, bezeichnung, abo, aktualisiert_am)
      VALUES (${p.key}, ${p.preisCents}, ${p.label}, ${p.abo}, NOW())
      ON CONFLICT (pack_key) DO UPDATE
        SET preis_cents = EXCLUDED.preis_cents,
            bezeichnung = EXCLUDED.bezeichnung,
            abo = EXCLUDED.abo,
            aktualisiert_am = NOW()
      WHERE fiaon_paketpreise.preis_cents IS DISTINCT FROM EXCLUDED.preis_cents
         OR fiaon_paketpreise.bezeichnung IS DISTINCT FROM EXCLUDED.bezeichnung
         OR fiaon_paketpreise.abo IS DISTINCT FROM EXCLUDED.abo
      RETURNING pack_key
    `;
    geschrieben += rows.length;
  }
  const bekannt = PAKETE.map((p) => p.key);
  const verwaist = ((await lauf`
    SELECT pack_key FROM fiaon_paketpreise WHERE pack_key <> ALL(${bekannt}::text[])
  `) as any[]).map((r) => String(r.pack_key));

  if (geschrieben > 0) {
    console.log(`[KATALOG] ${geschrieben} Preis-Abschrift(en) nachgezogen.`);
  }
  if (verwaist.length > 0) {
    console.warn(`[KATALOG] ${verwaist.length} Preis(e) in der Tabelle kennt der Katalog nicht: `
      + `${verwaist.join(", ")}. Nicht gelöscht — im Bestand können Bestellungen daran hängen.`);
  }
  return { geschrieben, verwaist };
}

/** Beim Serverstart einmal. Merkt sich, dass sie gelaufen ist. */
export async function katalogpreiseEinmalSyncen(): Promise<void> {
  if (gelaufen) return;
  gelaufen = true;
  await katalogpreiseSyncen().catch((e) => {
    // Ein fehlgeschlagener Abgleich darf den Start nicht anhalten — aber er
    // darf auch nicht still bleiben: Dann prüft die Wand gegen alte Preise.
    console.error("[KATALOG] Preis-Abgleich fehlgeschlagen — die Wand prüft gegen den "
      + "Stand der Migration:", e instanceof Error ? e.message : e);
  });
}
