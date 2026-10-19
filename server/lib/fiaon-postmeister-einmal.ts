// ═══════════════════════════════════════════════════════════════════════════
// EINE MAIL — EINE EINORDNUNG, EIN AKTENVERMERK (19.10.2026, E-401 Baustein 1)
//
// Die Regeln stehen rein in shared/fiaon-postmeister-merker.ts. Hier schreibt der SERVER die beiden Merker an
// die Postmeister-Zeile (Spalten aus postmeisterSchema):
//   · einordnung_merker (JSONB)     — die rohe Einordnung des Modells mit Fingerabdruck; der nächste Anlauf
//                                     derselben Mail nimmt sie statt eines neuen KI-Aufrufs;
//   · akte_vermerk_am (TIMESTAMPTZ) — der Aktenvermerk „E-Mail an …“ steht; nie ein zweiter.
// Vorher entstand beides in JEDEM Anlauf neu (Bündeln, Nachhol-Runden nach der KI-Pause, Rückstands-Takt):
// Mail #7110 hatte 21 Vermerke in zwei Minuten, eine alte Mail 36 bis 45 am Tag.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { akteVermerkKopf, akteVermerkText, altenVermerkSuchen, type EinordnungMerker } from "@shared/fiaon-postmeister-merker";

/**
 * Den Merker der Einordnung an die Zeile schreiben. Scheitert es, ordnet der nächste Anlauf eben neu ein — nie werfen.
 * Als echtes JSON-Objekt (sqlPool.json) — `${JSON.stringify(x)}::jsonb` legte einen Text-Skalar ab (JSONB-Falle, E-238).
 */
export async function einordnungMerken(postmeisterId: number, merker: EinordnungMerker): Promise<boolean> {
  try {
    const r = (await sqlPool`
      UPDATE fiaon_postmeister SET einordnung_merker = ${sqlPool.json(merker as any)} WHERE id = ${postmeisterId} RETURNING id
    `) as any[];
    return r.length > 0;
  } catch (e) {
    console.error("[POSTMEISTER] Einordnung merken:", String((e as any)?.message || e).slice(0, 160));
    return false;
  }
}

export type VermerkErgebnis = "geschrieben" | "schon_da" | "alt_gefunden" | "ohne_ref";

/**
 * Der Aktenvermerk zu einer Kundenmail — GENAU EINMAL je Postmeister-Zeile.
 *
 * Merker und Vermerk entstehen in EINER Anweisung (UPDATE … RETURNING → INSERT): Setzt der Merker, steht auch
 * der Vermerk; setzt er nicht (ein anderer Anlauf war schneller), entsteht keiner. Für den Altbestand von vor
 * E-401 (Zeile kam schon einmal bis zum Vermerk, trägt aber keinen Merker — dazu zählt die Mail aus der KI-Pause,
 * E-246) sucht der Server zuerst den alten Vermerk seit Anlage der Zeile und setzt dann nur den Merker.
 * Ohne Referenz kein Vermerk (wie seit E-094) — und kein Merker: Wird er später erkannt, folgt der Vermerk dann.
 */
export async function akteVermerkEinmal(ein: {
  postmeisterId: number; ref: string | null; personId: number | null;
  postfach: string; betreff: string; zusammenfassung: string;
  /** Stand beim Beanspruchen dieser Zeile (RETURNING des Anspruchs). */
  neuAngelegt: boolean; vermerkMerker: unknown; einordnungMerker: unknown;
  /** Anlage der Zeile — ab da wird ein alter Vermerk gesucht. */
  zeileSeit: Date;
}): Promise<VermerkErgebnis> {
  if (!ein.ref) return "ohne_ref";
  if (ein.vermerkMerker) return "schon_da";
  try {
    if (altenVermerkSuchen(ein)) {
      const kopf = akteVermerkKopf(ein.postfach, ein.betreff);
      const [alt] = (await sqlPool`
        SELECT 1 AS ja FROM fiaon_contact_log
         WHERE ref = ${ein.ref} AND agent_name = 'Postmeister' AND created_at >= ${ein.zeileSeit}
           AND LEFT(note, ${kopf.length}) = ${kopf}
         LIMIT 1`) as any[];
      if (alt) {
        await sqlPool`UPDATE fiaon_postmeister SET akte_vermerk_am = NOW() WHERE id = ${ein.postmeisterId} AND akte_vermerk_am IS NULL`;
        return "alt_gefunden";
      }
    }
    const note = akteVermerkText(ein.postfach, ein.betreff, ein.zusammenfassung);
    const r = (await sqlPool`
      WITH merker AS (
        UPDATE fiaon_postmeister SET akte_vermerk_am = NOW()
         WHERE id = ${ein.postmeisterId} AND akte_vermerk_am IS NULL
        RETURNING id
      )
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ${ein.ref}::text, ${ein.personId}::int, NULL::int, 'Postmeister', 'system', ${note}::text FROM merker
      RETURNING id`) as any[];
    return r.length ? "geschrieben" : "schon_da";
  } catch (e) {
    // Wie seit E-094: nie eine Mail am Vermerk scheitern lassen.
    console.error("[POSTMEISTER] Aktenvermerk:", String((e as any)?.message || e).slice(0, 160));
    return "schon_da";
  }
}
