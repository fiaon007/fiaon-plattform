// ═══════════════════════════════════════════════════════════════════════════
// DIE PROVISIONSAUTOMATIK — EIN SCHALTER, NICHTS GEHT VERLOREN (23.09.2026)
//
// Justin: „Stelle es einstweilen ab, dass die Provision den Mitarbeitern
// automatisch gebucht wird."
//
// Der naive Weg wäre, den Aufruf zu löschen. Dann wüsste hinterher niemand
// mehr, welche Provision in der Zwischenzeit entstanden WÄRE — und beim
// Wiedereinschalten fehlten Wochen. Deshalb:
//
//   Schalter AN  → alles wie bisher, die Provision wird gebucht.
//   Schalter AUS → die Provision wird nicht gebucht, sondern VORGEMERKT:
//                  wer, wofür, wie viel, auf welcher Grundlage. Ein Klick im
//                  Chefbüro bucht sie später nach — oder verwirft sie.
//
// Die Vormerkung ist bewusst eine eigene Tabelle und keine Zeile in
// fiaon_commissions mit Sonderstatus: Was dort steht, fließt in Abrechnungen,
// Auszahlungen und Kennzahlen. Eine Vormerkung darf das ausdrücklich NICHT.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export const SCHALTER = "provision_automatik";

let anlegen: Promise<void> | null = null;
function tabelle(): Promise<void> {
  if (!anlegen) {
    anlegen = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_provision_vormerkung (
          id BIGSERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          ref TEXT,
          payment_reference TEXT,
          pack_name TEXT,
          base_amount_cents INTEGER NOT NULL DEFAULT 0,
          rate_bp INTEGER NOT NULL DEFAULT 0,
          amount_cents INTEGER NOT NULL DEFAULT 0,
          kind TEXT NOT NULL,
          source_agent_id INTEGER,
          note TEXT,
          anlass TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'offen',
          erledigt_am TIMESTAMPTZ,
          erledigt_von TEXT,
          commission_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_provision_vormerkung_offen ON fiaon_provision_vormerkung (status, id DESC)`;
      // Zweimal dieselbe Zahlung darf nur EINE Vormerkung ergeben.
      await sqlPool`
        CREATE UNIQUE INDEX IF NOT EXISTS fiaon_provision_vormerkung_einmal
          ON fiaon_provision_vormerkung (payment_reference, agent_id, kind)
          WHERE payment_reference IS NOT NULL AND status = 'offen'`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      anlegen = null;
      throw e;
    });
  }
  return anlegen;
}

/** Läuft die Automatik? Vorgabe seit 23.09.2026: AUS. */
export async function automatikAn(): Promise<boolean> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${SCHALTER}`.catch(() => [])) as any[];
  return String(r?.value ?? "aus") === "an";
}

export async function automatikSetzen(an: boolean, von: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${SCHALTER}, ${an ? "an" : "aus"}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[PROVISION] Automatik ${an ? "AN" : "AUS"} (${von})`);
}

export interface Vormerkung {
  agentId: number;
  ref?: string | null;
  zahlungsreferenz?: string | null;
  paket?: string | null;
  basisCents: number;
  satzBp: number;
  betragCents: number;
  art: string;
  quelleAgentId?: number | null;
  notiz?: string | null;
  /** Woraus sie entstanden wäre: „erste Zahlung" oder „Rate 3" — für die Anzeige. */
  anlass: string;
}

/** Statt zu buchen: merken. Gibt zurück, ob eine neue Vormerkung entstand. */
export async function vormerken(v: Vormerkung): Promise<boolean> {
  await tabelle();
  const zeilen = (await sqlPool`
    INSERT INTO fiaon_provision_vormerkung
      (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, kind, source_agent_id, note, anlass)
    VALUES (${v.agentId}, ${v.ref ?? null}, ${v.zahlungsreferenz ?? null}, ${v.paket ?? null},
            ${Math.round(v.basisCents)}, ${Math.round(v.satzBp)}, ${Math.round(v.betragCents)},
            ${v.art}, ${v.quelleAgentId ?? null}, ${v.notiz ?? null}, ${v.anlass})
    ON CONFLICT DO NOTHING
    RETURNING id`) as any[];
  if (zeilen.length) {
    console.log(`[PROVISION] Vorgemerkt statt gebucht: ${(v.betragCents / 100).toFixed(2)} € für Agent ${v.agentId} (${v.anlass}).`);
  }
  return zeilen.length > 0;
}

/** Was offen ist — für das Chefbüro. */
export async function vormerkungen(status = "offen", hoechstens = 200): Promise<any[]> {
  await tabelle();
  return (await sqlPool`
    SELECT v.*, a.name AS agent_name, q.name AS quelle_name,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_provision_vormerkung v
      LEFT JOIN fiaon_agents a ON a.id = v.agent_id
      LEFT JOIN fiaon_agents q ON q.id = v.source_agent_id
      LEFT JOIN fiaon_applications app ON app.ref = v.ref AND app.merged_into IS NULL
      LEFT JOIN fiaon_persons p ON p.id = app.person_id
     WHERE v.status = ${status}
     ORDER BY v.id DESC LIMIT ${Math.min(Math.max(hoechstens, 1), 500)}`) as any[];
}

/** Die Zahlen für den Kopf der Seite. */
export async function vormerkungZahlen(): Promise<{ offen: number; offenEuro: number; gebucht: number; verworfen: number }> {
  await tabelle();
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'offen'), 0)::int AS offen_cents,
           COUNT(*) FILTER (WHERE status = 'gebucht')::int AS gebucht,
           COUNT(*) FILTER (WHERE status = 'verworfen')::int AS verworfen
      FROM fiaon_provision_vormerkung`) as any[];
  return {
    offen: Number(z?.offen || 0), offenEuro: Number(z?.offen_cents || 0) / 100,
    gebucht: Number(z?.gebucht || 0), verworfen: Number(z?.verworfen || 0),
  };
}

/**
 * Eine Vormerkung nachbuchen — sie wird zu einer echten Provision. Derselbe
 * Weg wie die Automatik, nur von Hand ausgelöst.
 */
export async function nachbuchen(id: number, von: string): Promise<{ ok: boolean; grund?: string; commissionId?: number }> {
  await tabelle();
  const [v] = (await sqlPool`SELECT * FROM fiaon_provision_vormerkung WHERE id = ${id} AND status = 'offen'`) as any[];
  if (!v) return { ok: false, grund: "Diese Vormerkung gibt es nicht mehr." };
  // Doppelt buchen ist ausgeschlossen: Dieselbe Zahlung, derselbe Mensch, dieselbe Art.
  const [da] = (await sqlPool`
    SELECT id FROM fiaon_commissions
     WHERE payment_reference = ${v.payment_reference} AND agent_id = ${v.agent_id} AND kind = ${v.kind}
       AND status <> 'storniert' LIMIT 1`.catch(() => [])) as any[];
  if (da) {
    await sqlPool`UPDATE fiaon_provision_vormerkung SET status = 'gebucht', erledigt_am = NOW(), erledigt_von = ${von}, commission_id = ${Number(da.id)} WHERE id = ${id}`;
    return { ok: true, commissionId: Number(da.id), grund: "Es gab sie schon — die Vormerkung ist erledigt." };
  }
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
    VALUES (${v.agent_id}, ${v.ref}, ${v.payment_reference}, ${v.pack_name}, ${v.base_amount_cents}, ${v.rate_bp}, ${v.amount_cents},
            'offen', ${v.kind}, ${v.source_agent_id}, ${`${v.note ?? ""} (von Hand gebucht am ${new Date().toLocaleDateString("de-DE")} durch ${von}, ${v.anlass})`.trim()})
    RETURNING id`) as any[];
  await sqlPool`UPDATE fiaon_provision_vormerkung SET status = 'gebucht', erledigt_am = NOW(), erledigt_von = ${von}, commission_id = ${Number(neu.id)} WHERE id = ${id}`;
  console.log(`[PROVISION] Vormerkung ${id} nachgebucht von ${von} (${(Number(v.amount_cents) / 100).toFixed(2)} €).`);
  return { ok: true, commissionId: Number(neu.id) };
}

/** Eine Vormerkung verwerfen — sie bleibt als Spur stehen. */
export async function verwerfen(id: number, von: string, grund: string): Promise<boolean> {
  await tabelle();
  const zeilen = (await sqlPool`
    UPDATE fiaon_provision_vormerkung
       SET status = 'verworfen', erledigt_am = NOW(), erledigt_von = ${von},
           note = TRIM(COALESCE(note, '') || ' · verworfen: ' || ${String(grund || "ohne Grund").slice(0, 200)})
     WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
  return zeilen.length > 0;
}
