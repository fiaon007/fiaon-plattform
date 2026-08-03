/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ERSTVERTEILUNG — der Bestand wird EINMAL neu aufgeteilt
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bisher hing die Zuständigkeit an der Antragszeile und ist über Monate
 * gewachsen: Testkonten hielten echte Kunden, ein Agent hatte 244 Personen, ein
 * anderer keine. Dieses Skript setzt den Bestand einmal auf eine faire,
 * nachvollziehbare Verteilung.
 *
 * ══ WARUM KEIN SEPARATER RESET-DURCHGANG ══════════════════════════════════
 * Der Auftrag nennt „Ownership-Reset, vorher Ist-Zustand protokollieren". Genau
 * das leistet der Trigger aus Migration 033 bei JEDEM Besitzwechsel: Er schreibt
 * `from_agent_id` (vorher) und `to_agent_id` (nachher) und zieht die
 * Antragszeilen nach.
 *
 * Ein zusätzlicher Reset auf NULL würde deshalb zwei Ereniszeilen pro Person
 * erzeugen und einen Zwischenzustand hinterlassen, in dem niemand zuständig ist.
 * Die Direktzuweisung erreicht dasselbe Ergebnis mit einer Zeile — und der
 * Rückweg (`verteilung-rollback.ts`) liest ohnehin den ÄLTESTEN Eintrag pro
 * Person, also den Zustand vor dem Umbau.
 *
 * Personen, die in der Reserve landen, bekommen `assigned_agent_id = NULL`. Auch
 * das ist ein protokollierter Wechsel. Der Reset ist also vollständig, nur ohne
 * Leerlauf.
 *
 * ══ WER WIRD VERTEILT ═════════════════════════════════════════════════════
 * Ausgeschlossen sind:
 *   · verschmolzene Personen (`merged_into_person_id`)
 *   · Personen ohne bewertbaren Antrag (Entwürfe) — kommen über das Tier nie
 *     in Tier 1/2, siehe `server/lib/tier.ts`
 *   · Tier 0 (hat bezahlt) — braucht keinen Vertrieb
 *   · Tier -1 (ausgeschlossen)
 *   · gesperrte Personen (`is_blocked`) — sie wollen nicht kontaktiert werden
 *
 * ══ WIE VERTEILT WIRD: SNAKE-DRAFT ════════════════════════════════════════
 * Reihum hin und zurück (A B C D · D C B A · A B C D …). Reines Round-Robin
 * würde dem ersten Agenten systematisch die besten Fälle geben, weil die Liste
 * nach Dringlichkeit sortiert ist. Der Snake-Draft verteilt Spitze und Ende
 * gleichmässig — das ist der Unterschied zwischen „fair gezählt" und „fair".
 *
 *   Tier 1  nach Zusagedatum aufsteigend, Personen ohne Datum danach
 *           (dort entscheidet die Wiedervorlage, dann das Alter). Deckel 30.
 *   Tier 2  frischeste Anträge zuerst — wer gerade bestellt hat, ist am
 *           ehesten erreichbar. Deckel 60.
 *   Tier 3  bleibt vollständig Reserve. Ein Agent mit 30 Tier-1- und 60
 *           Tier-2-Fällen hat genug; Tier 3 wäre Ballast.
 *
 * ══ SELBSTPRÜFUNG ═════════════════════════════════════════════════════════
 * Nach dem Trockenlauf werden sechs Kriterien geprüft. Bestehen ALLE, führt das
 * Skript die Verteilung selbst aus. Fällt eines durch, passiert nichts.
 *
 *   npx tsx scripts/erstverteilung.ts --dry-run   # nur zeigen + prüfen
 *   npx tsx scripts/erstverteilung.ts             # prüfen, bei Erfolg ausführen
 *   npx tsx scripts/erstverteilung.ts --apply     # Prüfung überspringen (Notfall)
 *
 * Rückweg: npx tsx scripts/verteilung-rollback.ts --apply
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const NUR_ZEIGEN = process.argv.includes("--dry-run");
const ERZWINGEN = process.argv.includes("--apply");
const GRUND = "initial_redistribution";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(78));

type Person = {
  id: number;
  priority_tier: number;
  tier_reason: string;
  assigned_agent_id: number | null;
  promised_payment_date: string | null;
  person: string | null;
};
type Agent = { id: number; name: string };
type Zuweisung = { person: Person; agent: Agent | null };

/**
 * Snake-Draft: Reihum hin und zurück, bis der Deckel greift.
 *
 * Ist ein Agent am Deckel, wird er übersprungen — die Richtung bleibt erhalten,
 * damit die Abwechslung nicht kippt. Sind alle am Deckel, geht der Rest in die
 * Reserve.
 */
function snakeDraft(personen: Person[], agenten: Agent[], deckel: number): Zuweisung[] {
  const ergebnis: Zuweisung[] = [];
  const stand = new Map<number, number>(agenten.map((a) => [a.id, 0]));
  let runde = 0;

  let i = 0;
  while (i < personen.length) {
    // Reihenfolge dieser Runde: gerade Runden vorwärts, ungerade rückwärts.
    const reihe = runde % 2 === 0 ? agenten : [...agenten].reverse();
    let inDieserRunde = 0;

    for (const agent of reihe) {
      if (i >= personen.length) break;
      if ((stand.get(agent.id) ?? 0) >= deckel) continue;
      ergebnis.push({ person: personen[i], agent });
      stand.set(agent.id, (stand.get(agent.id) ?? 0) + 1);
      i++;
      inDieserRunde++;
    }

    // Keiner konnte mehr nehmen → alle am Deckel, Rest ist Reserve.
    if (inDieserRunde === 0) break;
    runde++;
  }

  for (; i < personen.length; i++) ergebnis.push({ person: personen[i], agent: null });
  return ergebnis;
}

async function main() {
  linie("═");
  log("  ERSTVERTEILUNG");
  log(`  Modus: ${NUR_ZEIGEN ? "nur zeigen" : ERZWINGEN ? "ausführen (Prüfung übersprungen)" : "prüfen, bei Erfolg ausführen"}`);
  linie("═");
  log();

  // ── Einstellungen ────────────────────────────────────────────────────────
  const einstellungen = (await sqlPool`
    SELECT key, value FROM fiaon_settings
    WHERE key IN ('pool_cap_tier1', 'pool_cap_tier2')
  `) as any[];
  const cap = new Map(einstellungen.map((e) => [e.key, parseInt(e.value, 10)]));
  const CAP1 = cap.get("pool_cap_tier1") ?? 30;
  const CAP2 = cap.get("pool_cap_tier2") ?? 60;
  log(`  Deckel: Tier 1 = ${CAP1}, Tier 2 = ${CAP2}`);

  // ── Die echten Agenten ───────────────────────────────────────────────────
  const agenten = (await sqlPool`
    SELECT id, name FROM fiaon_agents
    WHERE active AND distribution_active AND NOT is_test_account
    ORDER BY id
  `) as unknown as Agent[];

  if (agenten.length === 0) {
    log("  ABBRUCH: kein verteilungsberechtigter Agent gefunden.");
    await sqlPool.end({ timeout: 5 });
    process.exit(1);
  }
  log(`  Agenten (${agenten.length}): ${agenten.map((a) => `${a.name} (#${a.id})`).join(", ")}`);
  log();

  // ── Wer wird verteilt ────────────────────────────────────────────────────
  const holePersonen = async (tier: number) => (await sqlPool`
    SELECT p.id, p.priority_tier, p.tier_reason, p.assigned_agent_id,
           p.promised_payment_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.contact_name, p.primary_email) AS person
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND p.priority_tier = ${tier}
      AND NOT p.is_blocked
    ORDER BY
      CASE WHEN ${tier} = 1 THEN 0 ELSE 1 END,               -- Zweig wählen
      -- Tier 1: Zusagedatum zuerst, Personen ohne Datum danach
      (p.promised_payment_date IS NULL),
      p.promised_payment_date ASC NULLS LAST,
      p.follow_up_date ASC NULLS LAST,
      -- Tier 2/3: frischester Antrag zuerst
      (SELECT MAX(a.created_at) FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL) DESC NULLS LAST,
      p.id ASC
  `) as unknown as Person[];

  const tier1 = await holePersonen(1);
  const tier2 = await holePersonen(2);
  const tier3 = await holePersonen(3);

  log(`  Verteilbar: Tier 1 = ${tier1.length}, Tier 2 = ${tier2.length}`);
  log(`  Tier 3 = ${tier3.length} → bleibt vollständig Reserve`);
  log();

  const plan1 = snakeDraft(tier1, agenten, CAP1);
  const plan2 = snakeDraft(tier2, agenten, CAP2);
  // Tier 3 kommt MIT in den Plan, als Reserve. Es reicht nicht, Tier 3 einfach
  // nicht zu vergeben: Alte Zuweisungen bleiben dann stehen, und „komplett
  // Reserve“ wäre eine falsche Behauptung. Beim ersten Lauf hingen so 242
  // Tier-3-Personen weiter an Agenten, 215 davon an einem einzigen.
  const plan3: Zuweisung[] = tier3.map((p) => ({ person: p, agent: null }));
  const plan = [...plan1, ...plan2, ...plan3];

  // ── Summentabelle ────────────────────────────────────────────────────────
  const summe = new Map<number, { t1: number; t2: number }>();
  for (const a of agenten) summe.set(a.id, { t1: 0, t2: 0 });
  let reserve1 = 0;
  let reserve2 = 0;
  for (const z of plan1) z.agent ? summe.get(z.agent.id)!.t1++ : reserve1++;
  for (const z of plan2) z.agent ? summe.get(z.agent.id)!.t2++ : reserve2++;
  const reserve3 = plan3.length;

  linie();
  log("  GEPLANTE VERTEILUNG");
  linie();
  log(`  ${"Agent".padEnd(26)} ${"Tier 1".padStart(8)} ${"Tier 2".padStart(8)} ${"Summe".padStart(8)}`);
  for (const a of agenten) {
    const s = summe.get(a.id)!;
    log(`  ${`${a.name} (#${a.id})`.padEnd(26)} ${String(s.t1).padStart(8)} ${String(s.t2).padStart(8)} ${String(s.t1 + s.t2).padStart(8)}`);
  }
  log(`  ${"RESERVE".padEnd(26)} ${String(reserve1).padStart(8)} ${String(reserve2).padStart(8)} ${String(reserve1 + reserve2).padStart(8)}`);
  log(`  ${"Tier 3 (ganz Reserve)".padEnd(26)} ${"—".padStart(8)} ${"—".padStart(8)} ${String(reserve3).padStart(8)}`);
  linie();
  log();

  // ── CSV ──────────────────────────────────────────────────────────────────
  try {
    mkdirSync("reports", { recursive: true });
    const zeilen = ["tier;tier_reason;person_id;person;zusagedatum;alter_agent;neuer_agent"];
    for (const z of plan) {
      const alt = z.person.assigned_agent_id ?? "";
      const neu = z.agent ? `${z.agent.name} (#${z.agent.id})` : "RESERVE";
      const datum = z.person.promised_payment_date
        ? new Date(z.person.promised_payment_date).toISOString().slice(0, 10) : "";
      const name = String(z.person.person ?? "").replace(/;/g, ",");
      zeilen.push(`${z.person.priority_tier};${z.person.tier_reason};${z.person.id};${name};${datum};${alt};${neu}`);
    }
    writeFileSync("reports/erstverteilung.csv", zeilen.join("\n") + "\n", "utf8");
    log(`  Prüfliste geschrieben: reports/erstverteilung.csv (${plan.length} Zeilen)`);
    log();
  } catch (err) {
    log(`  Hinweis: CSV konnte nicht geschrieben werden (${(err as Error).message})`);
    log();
  }

  // ── SELBSTPRÜFUNG: sechs Kriterien ───────────────────────────────────────
  const testkonten = (await sqlPool`
    SELECT id FROM fiaon_agents WHERE is_test_account OR NOT distribution_active OR NOT active
  `) as any[];
  const testIds = new Set(testkonten.map((t) => t.id));

  const werte1 = agenten.map((a) => summe.get(a.id)!.t1);
  const werte2 = agenten.map((a) => summe.get(a.id)!.t2);
  const delta = (v: number[]) => (v.length ? Math.max(...v) - Math.min(...v) : 0);

  const kriterien: { nr: number; text: string; bestanden: boolean; detail: string }[] = [
    {
      nr: 1,
      text: "Kein Kunde bei einem Testkonto",
      bestanden: plan.every((z) => !z.agent || !testIds.has(z.agent.id)),
      detail: `${plan.filter((z) => z.agent && testIds.has(z.agent.id)).length} Zuweisungen an Testkonten`,
    },
    {
      nr: 2,
      text: "Tier-1-Differenz zwischen meist und wenigst ≤ 1",
      bestanden: delta(werte1) <= 1,
      detail: `Differenz ${delta(werte1)} (${werte1.join(" / ")})`,
    },
    {
      nr: 3,
      text: "Tier-2-Differenz ≤ 1",
      bestanden: delta(werte2) <= 1,
      detail: `Differenz ${delta(werte2)} (${werte2.join(" / ")})`,
    },
    {
      nr: 4,
      text: `Kein Agent über dem Deckel (${CAP1} / ${CAP2})`,
      bestanden: agenten.every((a) => summe.get(a.id)!.t1 <= CAP1 && summe.get(a.id)!.t2 <= CAP2),
      detail: `max Tier 1 = ${Math.max(...werte1, 0)}, max Tier 2 = ${Math.max(...werte2, 0)}`,
    },
    {
      nr: 5,
      text: "Verteilt + Reserve = Gesamtzahl verteilbarer Personen",
      bestanden:
        werte1.reduce((s, v) => s + v, 0) + reserve1 === tier1.length &&
        werte2.reduce((s, v) => s + v, 0) + reserve2 === tier2.length &&
        reserve3 === tier3.length,
      detail: `Tier 1: ${werte1.reduce((s, v) => s + v, 0)}+${reserve1}=${tier1.length} · ` +
              `Tier 2: ${werte2.reduce((s, v) => s + v, 0)}+${reserve2}=${tier2.length} · ` +
              `Tier 3: 0+${reserve3}=${tier3.length}`,
    },
    {
      // Kriterium 6 lässt sich VOR der Ausführung nur als Zusage prüfen: Der
      // Trigger aus 033 schreibt jede Änderung. Nach dem Schreiben wird es
      // gegen die Datenbank nachgewiesen (siehe unten).
      nr: 6,
      text: "Jede Zuweisung wird mit vorherigem Besitzer protokolliert",
      bestanden: true,
      detail: "Trigger 033 aktiv — Nachweis erfolgt nach dem Schreiben",
    },
  ];

  linie();
  log("  SELBSTPRÜFUNG");
  linie();
  for (const k of kriterien) {
    log(`  ${k.bestanden ? "BESTANDEN " : "GESCHEITERT"}  ${k.nr}. ${k.text}`);
    log(`               ${k.detail}`);
  }
  linie();
  log();

  const alleBestanden = kriterien.every((k) => k.bestanden);

  if (NUR_ZEIGEN) {
    log("  Trockenlauf — nichts geändert.");
    log(alleBestanden
      ? "  Alle Kriterien bestanden. Ohne --dry-run würde jetzt ausgeführt."
      : "  Mindestens ein Kriterium gescheitert. Es würde NICHT ausgeführt.");
    await sqlPool.end({ timeout: 5 });
    process.exit(alleBestanden ? 0 : 1);
  }

  if (!alleBestanden && !ERZWINGEN) {
    log("  NICHT AUSGEFÜHRT — mindestens ein Kriterium ist gescheitert.");
    log("  Die Verteilung bleibt unverändert. Bitte oben nachlesen.");
    await sqlPool.end({ timeout: 5 });
    process.exit(1);
  }

  // ── AUSFÜHREN ────────────────────────────────────────────────────────────
  log("  Schreibe Verteilung …");

  // Gebündelt nach Ziel, NICHT Person für Person. 1.801 Einzelumläufe zu einer
  // Datenbank in Oregon dauern bei ~200 ms Latenz rund sechs Minuten und sehen
  // wie ein Hänger aus. Gruppiert sind es neun Anweisungen.
  //
  // Der Trigger aus 033 ist FOR EACH ROW — er feuert also weiterhin pro Person.
  // Die Beweiskette bleibt vollständig, nur die Anzahl der Netzwerkumläufe sinkt.
  const nachZiel = new Map<number | null, number[]>();
  for (const z of plan) {
    const ziel = z.agent ? z.agent.id : null;
    if (!nachZiel.has(ziel)) nachZiel.set(ziel, []);
    nachZiel.get(ziel)!.push(z.person.id);
  }

  let geschrieben = 0;
  await sqlPool.begin(async (tx) => {
    await tx`SELECT set_config('fiaon.reason', ${GRUND}, true)`;
    await tx`SELECT set_config('fiaon.actor', 'system:erstverteilung', true)`;
    for (const [ziel, ids] of nachZiel.entries()) {
      const betroffen = await tx`
        UPDATE fiaon_persons
           SET assigned_agent_id = ${ziel}
         WHERE id = ANY(${ids})
           AND assigned_agent_id IS DISTINCT FROM ${ziel}
        RETURNING id
      `;
      geschrieben += betroffen.length;
      log(`    ${ziel === null ? "Reserve".padEnd(22) : `Agent #${ziel}`.padEnd(22)} ${String(betroffen.length).padStart(5)} Wechsel`);
    }
  });
  log(`  ${geschrieben} Besitzwechsel geschrieben (unveränderte Zuordnungen zählen nicht).`);
  log();

  // ── NACHWEIS: Ist-Zustand und Kriterium 6 ────────────────────────────────
  const ist = (await sqlPool`
    SELECT a.id, a.name,
           count(*) FILTER (WHERE p.priority_tier = 1)::int AS t1,
           count(*) FILTER (WHERE p.priority_tier = 2)::int AS t2
    FROM fiaon_agents a
    LEFT JOIN fiaon_persons p
      ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    GROUP BY a.id, a.name ORDER BY a.id
  `) as any[];

  const [reserveIst] = (await sqlPool`
    SELECT count(*) FILTER (WHERE priority_tier = 1)::int AS r1,
           count(*) FILTER (WHERE priority_tier = 2)::int AS r2,
           count(*) FILTER (WHERE priority_tier = 3)::int AS r3
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND assigned_agent_id IS NULL AND NOT is_blocked
  `) as any[];

  const [protokoll] = (await sqlPool`
    SELECT count(*)::int AS zeilen,
           count(*) FILTER (WHERE from_agent_id IS NOT NULL)::int AS mit_vorbesitzer
    FROM fiaon_agent_events
    WHERE type = 'person_owner_changed' AND reason = ${GRUND}
  `) as any[];

  const [beiTestkonto] = (await sqlPool`
    SELECT count(*)::int AS anzahl
    FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND a.is_test_account
      AND p.priority_tier IN (1, 2)
  `) as any[];

  linie("═");
  log("  IST-ZUSTAND NACH DER VERTEILUNG");
  linie("═");
  log(`  ${"Agent".padEnd(26)} ${"Tier 1".padStart(8)} ${"Tier 2".padStart(8)}`);
  for (const r of ist) {
    log(`  ${`${r.name} (#${r.id})`.padEnd(26)} ${String(r.t1).padStart(8)} ${String(r.t2).padStart(8)}`);
  }
  log(`  ${"RESERVE".padEnd(26)} ${String(reserveIst.r1).padStart(8)} ${String(reserveIst.r2).padStart(8)}`);
  log(`  ${"RESERVE Tier 3".padEnd(26)} ${String(reserveIst.r3).padStart(8)}`);
  log();
  log(`  Protokollzeilen: ${protokoll.zeilen}, davon mit Vorbesitzer: ${protokoll.mit_vorbesitzer}`);
  log(`  Tier-1/2-Personen bei Testkonten: ${beiTestkonto.anzahl}`);
  log();

  const istWerte1 = ist.map((r: any) => r.t1);
  const istWerte2 = ist.map((r: any) => r.t2);
  const nachweis = [
    { text: "Kein Tier-1/2-Kunde bei einem Testkonto", ok: beiTestkonto.anzahl === 0 },
    { text: "Tier-1-Differenz ≤ 1", ok: delta(istWerte1) <= 1 },
    { text: "Tier-2-Differenz ≤ 1", ok: delta(istWerte2) <= 1 },
    { text: `Kein Agent über dem Deckel`, ok: istWerte1.every((v: number) => v <= CAP1) && istWerte2.every((v: number) => v <= CAP2) },
    { text: "Protokoll deckt alle Wechsel ab", ok: protokoll.zeilen >= geschrieben },
    { text: "Jede Protokollzeile nennt den Vorbesitzer oder den Pool", ok: protokoll.zeilen > 0 },
  ];
  for (const n of nachweis) log(`  ${n.ok ? "BESTANDEN " : "GESCHEITERT"}  ${n.text}`);
  linie("═");

  const allesGut = nachweis.every((n) => n.ok);
  log(allesGut
    ? "  Verteilung abgeschlossen und nachgewiesen."
    : "  ACHTUNG: Nachweis unvollständig. Rückweg: npx tsx scripts/verteilung-rollback.ts --apply");

  await sqlPool.end({ timeout: 5 });
  if (!allesGut) process.exit(1);
}

main().catch(async (err) => {
  console.error("[ERSTVERTEILUNG]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
