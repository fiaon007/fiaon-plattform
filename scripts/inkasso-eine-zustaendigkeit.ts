// ═══════════════════════════════════════════════════════════════════════════
// EIN MENSCH, EIN FORDERUNGSMANAGER — den Bestand nachziehen
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Ein Kunde steht bei Hans UND bei Diana."
//
// ── DIE URSACHE ────────────────────────────────────────────────────────────
// Die Zuteilung verteilte pro RATE an den mit der kleinsten Last. Ein Kunde mit
// mehreren offenen Raten wurde dadurch auf zwei Menschen aufgeteilt. Die Regel
// ist seit dem 30.08.2026 in `server/lib/fiaon-inkasso.ts` auf PERSONEN-Ebene
// umgestellt — dieser Lauf räumt auf, was die alte Regel hinterlassen hat.
//
// ── WER GEWINNT ────────────────────────────────────────────────────────────
// Je Person der Zuständige mit den MEISTEN offenen Raten; bei Gleichstand der
// mit der ÄLTESTEN. Begründung: Wer den größten Teil der Forderung bearbeitet,
// kennt den Fall; und die älteste Rate ist der Anfang des Gesprächs.
//
// ── SICHERHEITEN ───────────────────────────────────────────────────────────
//   1. Ohne `--schreiben` passiert nichts. Vorschau als CSV in `reports/`.
//   2. Alles in EINER Transaktion — bricht etwas, ist nichts passiert.
//   3. Zählprobe: Danach müssen 0 Personen mehr als einen Zuständigen haben.
//      Stimmt das nicht, wird zurückgerollt.
//   4. Keine Rate wird freigegeben, keine gelöscht — nur umgehängt.
//
//   npx tsx scripts/inkasso-eine-zustaendigkeit.ts              → Vorschau
//   npx tsx scripts/inkasso-eine-zustaendigkeit.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const AKTEUR = "Bestandslauf „ein Mensch, ein Forderungsmanager“ (30.08.2026)";

const log = (s = "") => console.log(s);
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Personen mit offenen Raten bei mehr als einem Zuständigen. */
const GESPALTEN = (lauf: any) => lauf`
  WITH je AS (
    SELECT a.person_id, r.inkasso_agent_id,
           COUNT(*)::int AS raten, MIN(r.faellig_am) AS aelteste
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
      AND r.inkasso_agent_id IS NOT NULL AND a.person_id IS NOT NULL
    GROUP BY a.person_id, r.inkasso_agent_id
  )
  SELECT person_id, COUNT(*)::int AS zustaendige
  FROM je GROUP BY person_id HAVING COUNT(*) > 1
`;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  log("\n══ Ein Mensch, ein Forderungsmanager ══\n");

  // ── MESSEN ───────────────────────────────────────────────────────────────
  const gespalten = (await GESPALTEN(sqlPool)) as any[];
  log(`  Personen mit offenen Raten bei mehr als einem Zuständigen: ${gespalten.length}`);
  if (gespalten.length === 0) {
    log("\n  Nichts zu tun. Der Bestand ist sauber.\n");
    await sqlPool.end();
    return;
  }

  const ids = gespalten.map((g) => Number(g.person_id));
  const zeilen = (await sqlPool`
    SELECT a.person_id,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS kunde,
           r.inkasso_agent_id, ag.name AS agent_name, ag.active AS agent_aktiv,
           COUNT(*)::int AS raten, MIN(r.faellig_am) AS aelteste,
           SUM(r.betrag_cents)::bigint AS summe_cents
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = r.inkasso_agent_id
    WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
      AND r.inkasso_agent_id IS NOT NULL AND a.person_id = ANY(${ids}::int[])
    GROUP BY a.person_id, kunde, r.inkasso_agent_id, ag.name, ag.active
    ORDER BY a.person_id, raten DESC, aelteste ASC
  `) as any[];

  interface Wahl {
    personId: number; kunde: string;
    gewinnerId: number; gewinnerName: string; gewinnerRaten: number;
    verliert: { id: number; name: string; raten: number }[];
  }
  const jePerson = new Map<number, any[]>();
  for (const z of zeilen) {
    const pid = Number(z.person_id);
    jePerson.set(pid, [...(jePerson.get(pid) ?? []), z]);
  }

  const wahlen: Wahl[] = [];
  for (const [pid, kandidaten] of Array.from(jePerson.entries())) {
    // Meiste Raten; bei Gleichstand die älteste Rate; ein AKTIVES Konto schlägt
    // ein stillgelegtes (eine Forderung darf nicht an einem Konto hängen, das
    // niemand mehr öffnet).
    const sortiert = kandidaten.slice().sort((a, b) =>
      (b.agent_aktiv ? 1 : 0) - (a.agent_aktiv ? 1 : 0)
      || Number(b.raten) - Number(a.raten)
      || new Date(a.aelteste).getTime() - new Date(b.aelteste).getTime()
      || Number(a.inkasso_agent_id) - Number(b.inkasso_agent_id));
    const g = sortiert[0];
    wahlen.push({
      personId: pid,
      kunde: String(kandidaten[0].kunde ?? "").trim() || `Person ${pid}`,
      gewinnerId: Number(g.inkasso_agent_id),
      gewinnerName: String(g.agent_name ?? g.inkasso_agent_id),
      gewinnerRaten: Number(g.raten),
      verliert: sortiert.slice(1).map((x) => ({
        id: Number(x.inkasso_agent_id), name: String(x.agent_name ?? x.inkasso_agent_id), raten: Number(x.raten),
      })),
    });
  }

  const kopf = ["person_id", "kunde", "bleibt_bei_id", "bleibt_bei", "raten_dort",
    "wandert_von", "raten_wandern"];
  const csv = wahlen.map((w) => [
    w.personId, w.kunde, w.gewinnerId, w.gewinnerName, w.gewinnerRaten,
    w.verliert.map((v) => v.name).join(" / "),
    w.verliert.reduce((s, v) => s + v.raten, 0),
  ].map(feld).join(";"));
  writeFileSync("reports/inkasso-eine-zustaendigkeit.csv", `${kopf.join(";")}\n${csv.join("\n")}\n`, "utf8");

  log("");
  for (const w of wahlen) {
    log(`  Person ${String(w.personId).padStart(5)}  ${w.kunde.slice(0, 26).padEnd(28)} `
      + `bleibt bei ${w.gewinnerName} (${w.gewinnerRaten} Raten)`);
    for (const v of w.verliert) log(`${" ".repeat(42)}← ${v.raten} Rate(n) von ${v.name}`);
  }
  const wandern = wahlen.reduce((s, w) => s + w.verliert.reduce((t, v) => t + v.raten, 0), 0);
  log("");
  log(`  ${wahlen.length} Personen, ${wandern} Raten wandern.`);
  log(`  Vorschau: reports/inkasso-eine-zustaendigkeit.csv`);

  if (!SCHREIBEN) {
    log("\n  Nur Vorschau — es wurde nichts geändert. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // ── SCHREIBEN ────────────────────────────────────────────────────────────
  class Zurueck extends Error {}
  let umgehaengt = 0;
  try {
    await sqlPool.begin(async (tx) => {
      for (const w of wahlen) {
        const r = await tx`
          UPDATE fiaon_abo_raten r
          SET inkasso_agent_id = ${w.gewinnerId}, updated_at = NOW()
          WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
            AND r.inkasso_agent_id IS NOT NULL
            AND r.inkasso_agent_id <> ${w.gewinnerId}
            AND r.ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${w.personId})
          RETURNING r.id
        `;
        umgehaengt += (r as any[]).length;

        // Der Verlaufseintrag gehört an eine Bestellung der Person — sonst
        // erklärt niemand dem abgebenden Kollegen, warum sein Fall weg ist.
        const [best] = (await tx`
          SELECT ref FROM fiaon_applications WHERE person_id = ${w.personId}
          ORDER BY created_at DESC LIMIT 1
        `) as any[];
        if (best?.ref) {
          await tx`
            INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
            VALUES (${best.ref}, ${w.gewinnerId}, ${AKTEUR}, 'system', 'inkasso_zustaendigkeit',
                    ${`Forderungsmanagement zusammengeführt: alle offenen Raten dieses Menschen liegen `
                      + `jetzt bei ${w.gewinnerName}. Vorher geteilt mit `
                      + `${w.verliert.map((v) => v.name).join(", ")}. `
                      + `Grund: ein Mensch hat einen Zuständigen — zwei Mahnanrufe von zwei Fremden `
                      + `sind für den Kunden nicht erklärbar.`})
          `;
        }
      }

      // ── ZÄHLPROBE: 0 Personen mit mehr als einem Zuständigen ─────────────
      const uebrig = (await GESPALTEN(tx)) as any[];
      if (uebrig.length > 0) {
        log(`\n  !! Zählprobe fehlgeschlagen: noch ${uebrig.length} Personen mit zwei Zuständigen.`);
        log("     Es wurde nichts geändert.\n");
        throw new Zurueck();
      }
      log(`\n  Zählprobe: 0 Personen mit mehr als einem Zuständigen. ✓`);
    });
    log(`  ${umgehaengt} Raten umgehängt, ${wahlen.length} Akten mit Verlaufseintrag.\n`);
  } catch (e) {
    if (!(e instanceof Zurueck)) throw e;
    process.exitCode = 1;
  }
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
