// ═══════════════════════════════════════════════════════════════════════════
// TELEFONSPERRE — „Nicht mehr anrufen“ (E-408, Vertrag § 4)
//
// Dauerhaft, Nummer UND Person, geteilt mit Maras STOPP. Eine Sperre wird nie
// gelöscht, nur aufgehoben (aufgehoben_am). Vertragliches geht dann nur noch
// schriftlich — der Wähler fragt hier VOR jedem Wählen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";

type Lauf = typeof sqlPool;

/** Die letzten neun Ziffern — dieselbe Form wie fiaon_persons.phone_key9. */
export function nummerKern(roh: string | null | undefined): string | null {
  const z = String(roh ?? "").replace(/\D/g, "");
  return z.length >= 7 ? z.slice(-9) : null;
}

export async function telefonGesperrt(nummerKern: string | null, personId?: number | null, lauf: Lauf = sqlPool): Promise<boolean> {
  await arasSchema(lauf);
  if (!nummerKern && !personId) return false;
  const [z] = (await lauf`
    SELECT 1 FROM fiaon_telefon_sperre
     WHERE aufgehoben_am IS NULL
       AND ((${nummerKern ?? null}::text IS NOT NULL AND nummer_kern = ${nummerKern ?? null})
         OR (${personId ?? null}::int IS NOT NULL AND person_id = ${personId ?? null}))
     LIMIT 1`) as any[];
  if (z) return true;
  if (personId) {
    const [p] = (await lauf`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${personId}`) as any[];
    // Eine Werbesperre aus „nicht mehr anrufen“ (Quelle aras_telefon/softphone) zählt auch ohne Zeile hier.
    if (p?.werbung_gesperrt_am) {
      const [q] = (await lauf`SELECT werbesperre_quelle FROM fiaon_persons WHERE id = ${personId}`) as any[];
      if (/telefon|softphone|anruf/i.test(String(q?.werbesperre_quelle ?? ""))) return true;
    }
  }
  return false;
}

export async function telefonSperren(
  e: { nummerKern: string | null; personId?: number | null; quelle: string; grund?: string; callId?: number },
  lauf: Lauf = sqlPool,
): Promise<void> {
  await arasSchema(lauf);
  const kern = e.nummerKern ?? (e.personId ? `p${e.personId}` : null);
  if (!kern) return;
  await lauf`
    INSERT INTO fiaon_telefon_sperre (nummer_kern, person_id, quelle, grund, call_id)
    VALUES (${kern}, ${e.personId ?? null}, ${e.quelle}, ${e.grund ?? null}, ${e.callId ?? null})
    ON CONFLICT (nummer_kern) DO UPDATE SET aufgehoben_am = NULL, aufgehoben_von = NULL, quelle = EXCLUDED.quelle,
      grund = COALESCE(EXCLUDED.grund, fiaon_telefon_sperre.grund), person_id = COALESCE(EXCLUDED.person_id, fiaon_telefon_sperre.person_id)`;
  if (e.personId) {
    await lauf`
      UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()),
             werbesperre_quelle = COALESCE(werbesperre_quelle, ${e.quelle === "aras" ? "aras_telefon" : e.quelle}), updated_at = NOW()
       WHERE id = ${e.personId}`.catch(() => {});
    await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', updated_at = NOW() WHERE person_id = ${e.personId} AND status = 'wartet'`;
  }
}

export async function telefonSperreAufheben(nummerKern: string, von: string, lauf: Lauf = sqlPool): Promise<boolean> {
  await arasSchema(lauf);
  const r = (await lauf`UPDATE fiaon_telefon_sperre SET aufgehoben_am = NOW(), aufgehoben_von = ${von} WHERE nummer_kern = ${nummerKern} AND aufgehoben_am IS NULL RETURNING id`) as any[];
  return r.length > 0;
}
