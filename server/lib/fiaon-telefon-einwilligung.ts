// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-EINWILLIGUNG — der § 7a-UWG-Nachweis (E-408, Vertrag § 2.2 / § 4)
//
// Jede Werbe-Spielart (termin, lead, zuruf, stufe_b, rueckholung) braucht eine
// gültige Zeile hier — sonst wählt der Takt nicht. Fünf Jahre, nie gelöscht,
// nur widerrufen. Keine Art entsteht per Stimme: ARAS holt nie eine Werbe-
// Einwilligung am Telefon ein (dafür bräuchte es ein Voicefile).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { nummerKern } from "./fiaon-aras-sperre";
import { EINWILLIGUNG_ARTEN, EINWILLIGUNG_JAHRE, type EinwilligungArt } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

export interface EinwilligungEin {
  personId?: number | null; leadId?: number | null;
  nummer: string;
  art: EinwilligungArt;
  wortlaut: string;
  quelleArt?: string | null; quelleId?: string | null;
  beleg?: Record<string, unknown> | null;
  erteiltAm?: Date | string | null;
}

export async function einwilligungMerken(e: EinwilligungEin, lauf: Lauf = sqlPool): Promise<{ id: number }> {
  await arasSchema(lauf);
  if (!(EINWILLIGUNG_ARTEN as readonly string[]).includes(e.art)) throw new Error(`Einwilligungs-Art „${e.art}“ gibt es nicht.`);
  const kern = nummerKern(e.nummer);
  if (!kern) throw new Error("Einwilligung ohne brauchbare Nummer.");
  const [z] = (await lauf`
    INSERT INTO fiaon_telefon_einwilligung (person_id, lead_id, nummer, nummer_kern, art, wortlaut, quelle_art, quelle_id, beleg, erteilt_am)
    VALUES (${e.personId ?? null}, ${e.leadId ?? null}, ${e.nummer}, ${kern}, ${e.art}, ${e.wortlaut.slice(0, 2000)},
            ${e.quelleArt ?? null}, ${e.quelleId ?? null}, ${e.beleg ? lauf.json(e.beleg as any) : null},
            ${e.erteiltAm ? new Date(e.erteiltAm) : new Date()})
    RETURNING id`) as any[];
  return { id: Number(z.id) };
}

/** Die jüngste gültige Einwilligung zu Nummer oder Person — oder null. Gültig = nicht widerrufen, jünger als 5 Jahre. */
export async function einwilligungGueltig(nummerKernRoh: string | null, personId?: number | null, lauf: Lauf = sqlPool): Promise<{ id: number; art: string; erteiltAm: string } | null> {
  await arasSchema(lauf);
  if (!nummerKernRoh && !personId) return null;
  const [z] = (await lauf`
    SELECT id, art, erteilt_am FROM fiaon_telefon_einwilligung
     WHERE widerrufen_am IS NULL
       AND erteilt_am > NOW() - make_interval(years => ${EINWILLIGUNG_JAHRE})
       AND ((${nummerKernRoh ?? null}::text IS NOT NULL AND nummer_kern = ${nummerKernRoh ?? null})
         OR (${personId ?? null}::int IS NOT NULL AND person_id = ${personId ?? null}))
     ORDER BY erteilt_am DESC LIMIT 1`) as any[];
  return z ? { id: Number(z.id), art: String(z.art), erteiltAm: new Date(z.erteilt_am).toISOString() } : null;
}

export async function einwilligungWiderrufen(e: { nummerKern?: string | null; personId?: number | null; quelle: string }, lauf: Lauf = sqlPool): Promise<number> {
  await arasSchema(lauf);
  const r = (await lauf`
    UPDATE fiaon_telefon_einwilligung SET widerrufen_am = NOW(), widerruf_quelle = ${e.quelle}
     WHERE widerrufen_am IS NULL
       AND ((${e.nummerKern ?? null}::text IS NOT NULL AND nummer_kern = ${e.nummerKern ?? null})
         OR (${e.personId ?? null}::int IS NOT NULL AND person_id = ${e.personId ?? null}))
     RETURNING id`) as any[];
  return r.length;
}
