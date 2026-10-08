/**
 * ═══════════════════════════════════════════════════════════════════════════
 * E-IT-E (08.10.2026) — EINMAL-BEREINIGUNG zu Punkt 5/10 (Akte & Dubletten)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der Code ist repariert (server/lib/fiaon-akte-aufloesen.ts,
 * shared/fiaon-betreuer-lage.ts, server/lib/fiaon-person-merge.ts). Zwei
 * Altlasten im BESTAND bleiben, und dieses Skript räumt sie auf:
 *
 *   A · „Agent 0“: Personen mit assigned_agent_id = 0 (gemessen am 08.10.2026:
 *       genau eine, Person 13458 — Merge vom 05.10.2026). Sie stehen weder im
 *       Pool (IS NULL) noch bei einem Mitarbeiter. → NULL, die Person kommt in
 *       den Pool. Der Besitzer-Trigger (033) protokolliert den Wechsel als
 *       person_owner_changed mit Grund „it_e_agent0“.
 *       Danach: CHECK fiaon_persons_agent_echt (NULL oder > 0), dieselbe Wand
 *       wie Migration 101 — wer zuerst läuft, setzt sie.
 *
 *   B · Verlorene Werbesperren: Der Merge übertrug werbung_gesperrt_am des
 *       Verlierers nicht (UWG § 7, DSGVO Art. 21). Gemessen am 08.10.2026:
 *       8 Kettenköpfe ohne Sperre, deren Verlierer eine trägt, und 2 Köpfe mit
 *       einer SPÄTEREN Sperre. → Der Kopf bekommt die frühere Sperre. Seit
 *       E-IT-E überträgt der Merge sie selbst; das hier holt den Altbestand nach.
 *
 * SICHERUNG: Jede geänderte Zelle steht vorher in fiaon_it_e_sicherung
 * (Tabelle, Zeile, Spalte, alter Wert, neuer Wert, Lauf). RÜCKWEG: das SQL,
 * das dieses Skript am Ende ausgibt (je Lauf-Kennung).
 *
 * AUFRUF (aus dem Arbeitsbaum):
 *   Trockenlauf, nur lesend (Standard):
 *     DATABASE_URL=… node_modules/.bin/tsx scripts/it-e-einmal.ts
 *   Ausführen — EINE Transaktion, Kontrolle, COMMIT:
 *     DATABASE_URL=… node_modules/.bin/tsx scripts/it-e-einmal.ts --ausfuehren
 *   Gegen eine NICHT lokale Datenbank zusätzlich --produktion — nur mit Justins Go.
 *
 * SPERRARM: Es sind Einzelzeilen über den Primärschlüssel; lock_timeout 3 s,
 * statement_timeout 30 s. Der CHECK wird NOT VALID gesetzt (kurze Sperre) und
 * danach VALIDATE (liest ~6.800 Zeilen, ohne Schreibsperre). Scheitert der
 * CHECK an einer Sperre, bleibt die Reparatur gültig (eigene Transaktion) —
 * dann einfach erneut laufen lassen oder Migration 101.
 *
 * Exit: 0 sauber · 1 Kontrolle fehlgeschlagen (ROLLBACK, nichts geändert) ·
 *       2 Aufruf falsch · 3 Sperre/Zeitlimit (ROLLBACK, später wiederholen)
 */
import postgres from "postgres";

const argumente = new Set(process.argv.slice(2));
const AUSFUEHREN = argumente.has("--ausfuehren");
const unbekannt = [...argumente].filter((a) => !["--ausfuehren", "--produktion"].includes(a));
const url = process.env.DATABASE_URL || "";
const LOKAL = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

if (!url || unbekannt.length > 0) {
  console.error(`Aufruf: DATABASE_URL=… tsx scripts/it-e-einmal.ts [--ausfuehren] [--produktion]${unbekannt.length ? ` (unbekannt: ${unbekannt.join(" ")})` : ""}`);
  process.exit(2);
}
if (AUSFUEHREN && !LOKAL && !argumente.has("--produktion")) {
  console.error("ABBRUCH: Die Datenbank ist nicht lokal. Schreiben in Produktion nur mit Justins Go und zusätzlich --produktion.");
  process.exit(2);
}

const sql = postgres(url, {
  ssl: /sslmode=disable/.test(url) ? false : "require",
  max: 1,
  onnotice: () => {},
  connection: {
    application_name: "it-e-einmal",
    statement_timeout: 30000,
    lock_timeout: 3000,
    idle_in_transaction_session_timeout: 120000,
  },
});

class Abbruch extends Error { constructor(text: string, readonly code = 1) { super(text); } }
const fehlerText = (e: any) => `${String(e?.message ?? e).slice(0, 300)}${e?.code ? ` [${e.code}]` : ""}`;
const istSperre = (e: any) => ["55P03", "57014", "40P01", "40001"].includes(String(e?.code ?? ""));
type Lauf = typeof sql | postgres.TransactionSql;

/** Lauf-Kennung — steht in jeder Sicherungszeile und im Rückweg-SQL. */
const LAUF = `it-e-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

// ── Was ist zu tun? (nur lesend) ───────────────────────────────────────────
async function agentNull(t: Lauf): Promise<{ id: number; agent: number }[]> {
  const z = (await t`
    SELECT id, assigned_agent_id FROM fiaon_persons
    WHERE assigned_agent_id IS NOT NULL AND assigned_agent_id <= 0
    ORDER BY id`) as any[];
  return z.map((r) => ({ id: Number(r.id), agent: Number(r.assigned_agent_id) }));
}

/** Werbesperren an Verlierern, die ihr Kettenkopf nicht (oder später) trägt. */
async function werbesperren(t: Lauf): Promise<{ verlierer: number; kopf: number; sperre: Date; kopfSperre: Date | null }[]> {
  const z = (await t`
    WITH RECURSIVE kette AS (
      SELECT p.id AS start, p.id AS aktuell, p.merged_into_person_id AS naechste, 0 AS tiefe, ARRAY[p.id] AS pfad
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NOT NULL AND p.werbung_gesperrt_am IS NOT NULL
      UNION ALL
      SELECT k.start, q.id, q.merged_into_person_id, k.tiefe + 1, k.pfad || q.id
      FROM kette k JOIN fiaon_persons q ON q.id = k.naechste
      WHERE k.tiefe < 10 AND NOT (q.id = ANY(k.pfad))
    ), koepfe AS (
      SELECT DISTINCT ON (start) start, aktuell AS kopf
      FROM kette WHERE naechste IS NULL
      ORDER BY start, tiefe DESC
    )
    SELECT v.id AS verlierer, k.kopf, v.werbung_gesperrt_am AS sperre, h.werbung_gesperrt_am AS kopf_sperre
    FROM koepfe k
    JOIN fiaon_persons v ON v.id = k.start
    JOIN fiaon_persons h ON h.id = k.kopf
    WHERE h.werbung_gesperrt_am IS NULL OR h.werbung_gesperrt_am > v.werbung_gesperrt_am
    ORDER BY k.kopf, v.werbung_gesperrt_am`) as any[];
  return z.map((r) => ({ verlierer: Number(r.verlierer), kopf: Number(r.kopf), sperre: r.sperre, kopfSperre: r.kopf_sperre ?? null }));
}

/** Je Kopf die früheste Sperre aller Verlierer. */
function jeKopf(liste: { kopf: number; sperre: Date; kopfSperre: Date | null }[]): Map<number, { sperre: Date; alt: Date | null }> {
  const m = new Map<number, { sperre: Date; alt: Date | null }>();
  for (const z of liste) {
    const bisher = m.get(z.kopf);
    if (!bisher || new Date(z.sperre).getTime() < new Date(bisher.sperre).getTime()) {
      m.set(z.kopf, { sperre: z.sperre, alt: z.kopfSperre });
    }
  }
  return m;
}

async function checkDa(t: Lauf): Promise<{ da: boolean; gueltig: boolean }> {
  const [c] = (await t`SELECT convalidated FROM pg_constraint WHERE conname = 'fiaon_persons_agent_echt'`) as any[];
  return { da: !!c, gueltig: c?.convalidated === true };
}

function rueckwegSql(lauf: string = LAUF): string {
  return [
    "-- Rückweg für den Lauf " + lauf + " (E-IT-E). In EINER Transaktion ausführen.",
    "-- Ein Agent-0-Rückweg verletzt den CHECK — er wird deshalb zuerst gelöst",
    "-- (danach scripts/it-e-einmal.ts oder Migration 101 erneut, wenn die Wand wieder stehen soll).",
    "BEGIN;",
    "ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_agent_echt;",
    "SELECT set_config('fiaon.reason', 'it_e_rueckweg', true);",
    `UPDATE fiaon_persons p SET assigned_agent_id = s.alt_wert::int, updated_at = NOW()`,
    `  FROM fiaon_it_e_sicherung s`,
    `  WHERE s.lauf = '${lauf}' AND s.tabelle = 'fiaon_persons' AND s.spalte = 'assigned_agent_id' AND p.id = s.zeile_id;`,
    `UPDATE fiaon_persons p SET werbung_gesperrt_am = s.alt_wert::timestamptz, updated_at = NOW()`,
    `  FROM fiaon_it_e_sicherung s`,
    `  WHERE s.lauf = '${lauf}' AND s.tabelle = 'fiaon_persons' AND s.spalte = 'werbung_gesperrt_am' AND p.id = s.zeile_id;`,
    "COMMIT;",
  ].join("\n");
}

async function main(): Promise<void> {
  console.log(`\n══ E-IT-E Einmal-Bereinigung · ${AUSFUEHREN ? "AUSFÜHREN" : "TROCKENLAUF (nur lesend)"} · ${LOKAL ? "lokale Datenbank" : "NICHT lokal"} ══\n`);

  const null0 = await agentNull(sql);
  const sperren = await werbesperren(sql);
  const koepfe = jeKopf(sperren);
  const check = await checkDa(sql);

  console.log(`A · „Agent 0“: ${null0.length} Person(en)${null0.length ? ` — ${null0.map((z) => `${z.id} (Agent ${z.agent})`).join(", ")}` : ""}`);
  console.log(`B · Werbesperre nachtragen: ${koepfe.size} Kettenkopf/-köpfe aus ${sperren.length} Verlierer(n)`);
  for (const [kopf, w] of koepfe) {
    console.log(`    Kopf ${kopf}: ${w.alt ? `Sperre ${new Date(w.alt).toISOString()} → früher` : "ohne Sperre →"} ${new Date(w.sperre).toISOString()}`);
  }
  console.log(`C · CHECK fiaon_persons_agent_echt: ${check.da ? (check.gueltig ? "gesetzt und geprüft" : "gesetzt, NICHT geprüft") : "fehlt"}`);

  if (!AUSFUEHREN) {
    console.log("\nTrockenlauf — nichts geändert. Ausführen mit --ausfuehren (nicht lokal zusätzlich --produktion, nur mit Justins Go).");
    console.log("Das Rückweg-SQL gibt der echte Lauf mit seiner Lauf-Kennung aus; Vorlage:\n\n" + rueckwegSql("<LAUF-KENNUNG>"));
    return;
  }

  // ── Ausführen: EINE Transaktion für A und B ──────────────────────────────
  await sql.begin(async (tx) => {
    await tx`
      CREATE TABLE IF NOT EXISTS fiaon_it_e_sicherung (
        id SERIAL PRIMARY KEY,
        lauf TEXT NOT NULL,
        tabelle TEXT NOT NULL,
        zeile_id INTEGER NOT NULL,
        spalte TEXT NOT NULL,
        alt_wert TEXT,
        neu_wert TEXT,
        gesichert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`SELECT set_config('fiaon.reason', 'it_e_agent0', true)`;
    await tx`SELECT set_config('fiaon.actor', 'skript:it-e-einmal', true)`;

    // Innerhalb der Transaktion neu lesen — der Stand von oben kann veraltet sein.
    const a = await agentNull(tx);
    for (const z of a) {
      await tx`
        INSERT INTO fiaon_it_e_sicherung (lauf, tabelle, zeile_id, spalte, alt_wert, neu_wert)
        VALUES (${LAUF}, 'fiaon_persons', ${z.id}, 'assigned_agent_id', ${String(z.agent)}, NULL)`;
      const r = (await tx`
        UPDATE fiaon_persons SET assigned_agent_id = NULL, updated_at = NOW()
        WHERE id = ${z.id} AND assigned_agent_id = ${z.agent}
        RETURNING id`) as any[];
      if (r.length !== 1) throw new Abbruch(`Person ${z.id}: Agent-0-Reparatur traf ${r.length} Zeilen.`);
    }
    // Bestellungen mit 0 (gemessen: keine) — zieht der Trigger nach; Rest von Hand.
    const appNull = (await tx`
      UPDATE fiaon_applications SET assigned_agent_id = NULL, updated_at = NOW()
      WHERE assigned_agent_id IS NOT NULL AND assigned_agent_id <= 0
      RETURNING ref`) as any[];

    const b = jeKopf(await werbesperren(tx));
    for (const [kopf, w] of b) {
      await tx`
        INSERT INTO fiaon_it_e_sicherung (lauf, tabelle, zeile_id, spalte, alt_wert, neu_wert)
        VALUES (${LAUF}, 'fiaon_persons', ${kopf}, 'werbung_gesperrt_am',
                ${w.alt ? new Date(w.alt).toISOString() : null}, ${new Date(w.sperre).toISOString()})`;
      const r = (await tx`
        UPDATE fiaon_persons SET werbung_gesperrt_am = ${w.sperre}::timestamptz, updated_at = NOW()
        WHERE id = ${kopf} AND (werbung_gesperrt_am IS NULL OR werbung_gesperrt_am > ${w.sperre}::timestamptz)
        RETURNING id`) as any[];
      if (r.length !== 1) throw new Abbruch(`Kopf ${kopf}: Werbesperre traf ${r.length} Zeilen.`);
    }

    // ── Kontrolle in derselben Transaktion ──────────────────────────────
    const restA = await agentNull(tx);
    const restB = await werbesperren(tx);
    if (restA.length > 0) throw new Abbruch(`Kontrolle: noch ${restA.length} Person(en) mit Agent <= 0.`);
    if (restB.length > 0) throw new Abbruch(`Kontrolle: noch ${restB.length} Verlierer mit fehlender Sperre am Kopf.`);
    console.log(`\nA erledigt: ${a.length} Person(en) in den Pool, ${appNull.length} Bestellung(en) direkt.`);
    console.log(`B erledigt: ${b.size} Kettenkopf/-köpfe tragen jetzt die frühere Werbesperre.`);
  });

  // ── C · Die Wand (eigene Schritte, kurze Sperren) ────────────────────────
  try {
    const c = await checkDa(sql);
    if (!c.da) {
      await sql`ALTER TABLE fiaon_persons ADD CONSTRAINT fiaon_persons_agent_echt CHECK (assigned_agent_id IS NULL OR assigned_agent_id > 0) NOT VALID`;
    }
    if (!(await checkDa(sql)).gueltig) {
      await sql`ALTER TABLE fiaon_persons VALIDATE CONSTRAINT fiaon_persons_agent_echt`;
    }
    console.log("C erledigt: CHECK fiaon_persons_agent_echt gesetzt und geprüft.");
  } catch (e) {
    console.error(`C nicht erledigt (Reparatur bleibt gültig): ${fehlerText(e)} — später erneut laufen lassen oder Migration 101.`);
    process.exitCode = istSperre(e) ? 3 : 1;
  }

  console.log(`\nLauf-Kennung: ${LAUF}\n\n${rueckwegSql()}\n`);
}

main()
  .catch((e) => {
    if (e instanceof Abbruch) { console.error(`\nABBRUCH (ROLLBACK, nichts geändert): ${e.message}`); process.exitCode = e.code; }
    else if (istSperre(e)) { console.error(`\nSPERRE/ZEITLIMIT (ROLLBACK, nichts geändert): ${fehlerText(e)}`); process.exitCode = 3; }
    else { console.error(`\nFEHLER (ROLLBACK, nichts geändert): ${fehlerText(e)}`); process.exitCode = 1; }
  })
  .finally(async () => { await sql.end({ timeout: 5 }); });
