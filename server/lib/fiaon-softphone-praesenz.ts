// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE-HERZSCHLAG (E-408, Vertrag § 4)
//
// Das Softphone meldet alle 60 s „ich bin da“ (POST /telefon/herzschlag, Team 2
// baut den Aufruf). ARAS verbindet nur zu einem Menschen, dessen Softphone in
// den letzten zwei Minuten geschlagen hat — sonst klingelt es ins Leere, und
// der Kunde hängt in der Warteschleife.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";

type Lauf = typeof sqlPool;

export async function praesenzMelden(agentId: number, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  await lauf`INSERT INTO fiaon_softphone_praesenz (agent_id, zuletzt_am) VALUES (${agentId}, NOW())
             ON CONFLICT (agent_id) DO UPDATE SET zuletzt_am = NOW()`;
}

export async function praesent(agentId: number, maxSek = 120, lauf: Lauf = sqlPool): Promise<boolean> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT 1 FROM fiaon_softphone_praesenz WHERE agent_id = ${agentId} AND zuletzt_am > NOW() - make_interval(secs => ${maxSek})`) as any[];
  return !!z;
}

/** Alle Mitarbeiter mit frischem Herzschlag — für die Übergabe-Wahl. */
export async function praesenteAgenten(maxSek = 120, lauf: Lauf = sqlPool): Promise<number[]> {
  await arasSchema(lauf);
  const z = (await lauf`SELECT agent_id FROM fiaon_softphone_praesenz WHERE zuletzt_am > NOW() - make_interval(secs => ${maxSek})`) as any[];
  return z.map((r) => Number(r.agent_id));
}
