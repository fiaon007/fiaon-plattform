// ═══════════════════════════════════════════════════════════════════════════
// SPACE-SEED — dem Feed eine Vergangenheit geben
//
// ── WARUM ──────────────────────────────────────────────────────────────────
// Ein Feed, dessen ältester Beitrag von heute Morgen ist, sieht aus wie ein
// frisch aufgesetztes System. Man scrollt zweimal, ist unten, und weiß: Hier
// war noch nie jemand. Danach kommt man nicht wieder.
//
// Dieser Lauf füllt rund sechzig Tage Vergangenheit:
//   CONTENT-POSTS  aus demselben Bauplan, den die Engine täglich benutzt —
//                  rückdatiert, mit denselben Uhrzeiten.
//   EREIGNIS-POSTS aus ECHTEN Protokolldaten: die tatsächlichen Abschlüsse
//                  jedes Tages, die echten Ranglisten, die echten
//                  Wochenzahlen. Keine erfundenen Erfolge — das würde
//                  auffallen, und zwar dem, der dabei war.
//
// Ohne `--schreiben` passiert nichts: Erst die Vorschau, dann die Entscheidung.
//
//   npx tsx scripts/space-seed.ts               Vorschau
//   npx tsx scripts/space-seed.ts --schreiben   ausführen
//   npx tsx scripts/space-seed.ts --tage 90     anderer Zeitraum
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

import { sqlPool } from "../server/lib/db-pool";
import { berlinToday } from "../server/lib/fiaon-time";
import { beitragAnlegen, dichte, tagesBauplan, type Beitrag } from "../server/lib/fiaon-space-engine";

const SCHREIBEN = process.argv.includes("--schreiben");
const TAGE = (() => {
  const i = process.argv.indexOf("--tage");
  const n = i >= 0 ? Number(process.argv[i + 1]) : 60;
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.round(n) : 60;
})();

function tagMinus(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return berlinToday(d);
}

async function main(): Promise<void> {
  console.log(`\n══ Space-Seed: ${TAGE} Tage ══\n`);

  const ziel = await dichte();
  console.log(`  Dichte: ${ziel} Beiträge pro Tag (Einstellung space_dichte)\n`);

  const geplant: Beitrag[] = [];

  // ── 1. Content-Posts aus dem Bauplan der Engine ─────────────────────────
  // Derselbe Bauplan wie im Tageslauf. Eine eigene Fassung fürs Seeden hieße:
  // Die Vergangenheit sieht anders aus als die Gegenwart, und man merkt genau,
  // wo das System eingeschaltet wurde.
  for (let t = TAGE; t >= 1; t--) {
    const datum = tagMinus(t);
    for (const b of tagesBauplan(datum, ziel)) {
      geplant.push({ ...b, schluessel: `seed-${b.schluessel}` });
    }
  }

  // ── 2. Ereignis-Posts aus ECHTEN Daten ──────────────────────────────────
  const von = tagMinus(TAGE);

  // Die tatsächlichen Abschlüsse je Tag und Mensch.
  const abschluesse = (await sqlPool`
    SELECT to_char(c.created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag,
           c.agent_id,
           COALESCE(NULLIF(a.first_name, ''), a.name) AS vorname,
           COUNT(*)::int AS n,
           MAX(c.created_at) AS zuletzt
    FROM fiaon_commissions c
    JOIN fiaon_agents a ON a.id = c.agent_id
    WHERE c.status <> 'storniert' AND COALESCE(c.kind, '') <> 'stunden'
      AND NOT a.is_test_account
      AND c.created_at >= ${von}::date
    GROUP BY tag, c.agent_id, vorname
    ORDER BY tag, n DESC
  `) as any[];

  for (const a of abschluesse) {
    const n = Number(a.n);
    geplant.push({
      art: "abschluss",
      schluessel: `seed-${a.tag}-${a.agent_id}-${n}`,
      text: n === 1
        ? `${a.vorname} hat den ersten Abschluss des Tages geholt.`
        : `${a.vorname} hat heute den ${n}. Abschluss geholt.`,
      am: new Date(a.zuletzt),
    });
  }

  // Die echten Tagesranglisten.
  const tage = Array.from(new Set(abschluesse.map((a) => String(a.tag))));
  for (const tag of tage) {
    const desTages = abschluesse
      .filter((a) => String(a.tag) === tag)
      .sort((x, y) => Number(y.n) - Number(x.n))
      .slice(0, 5);
    if (desTages.length === 0) continue;
    const liste = desTages
      .map((z, i) => `${i + 1}. ${z.vorname} — ${z.n} ${Number(z.n) === 1 ? "Abschluss" : "Abschlüsse"}`)
      .join("\n");
    const gesamt = desTages.reduce((s, z) => s + Number(z.n), 0);
    geplant.push({
      art: "rangliste", schluessel: `seed-${tag}`,
      text: `Der Tag in Zahlen\n\n${liste}\n\nZusammen ${gesamt} ${gesamt === 1 ? "Abschluss" : "Abschlüsse"}. Gute Arbeit.`,
      am: new Date(`${tag}T16:00:00Z`),
    });
  }

  // Die echten Wochenzahlen, jeden Montag.
  const wochen = (await sqlPool`
    SELECT to_char(date_trunc('week', c.created_at AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') AS woche,
           COUNT(*)::int AS abschluesse,
           COALESCE(SUM(c.base_amount_cents), 0)::bigint AS umsatz,
           COUNT(DISTINCT c.agent_id)::int AS beteiligt
    FROM fiaon_commissions c
    JOIN fiaon_agents a ON a.id = c.agent_id
    WHERE c.status <> 'storniert' AND COALESCE(c.kind, '') <> 'stunden'
      AND NOT a.is_test_account AND c.created_at >= ${von}::date
    GROUP BY woche ORDER BY woche
  `) as any[];

  for (const w of wochen) {
    // Der Rückblick erscheint am MONTAG DANACH, nicht am Montag der Woche.
    const montagDanach = new Date(`${w.woche}T05:30:00Z`);
    montagDanach.setUTCDate(montagDanach.getUTCDate() + 7);
    if (montagDanach > new Date()) continue;
    geplant.push({
      art: "woche", schluessel: `seed-${montagDanach.toISOString().slice(0, 10)}`,
      text: `Die Woche in Zahlen\n\n`
        + `${w.abschluesse} ${Number(w.abschluesse) === 1 ? "Abschluss" : "Abschlüsse"} `
        + `von ${w.beteiligt} ${Number(w.beteiligt) === 1 ? "Person" : "Personen"}\n`
        + `${(Number(w.umsatz) / 100).toFixed(2).replace(".", ",")} € Umsatz\n\n`
        + "Neue Woche, neue Liste. Fangt oben an.",
      am: montagDanach,
    });
  }

  // ── Vorschau ────────────────────────────────────────────────────────────
  const jeArt: Record<string, number> = {};
  for (const b of geplant) jeArt[b.art] = (jeArt[b.art] || 0) + 1;

  console.log("  Geplant je Art:");
  for (const [art, n] of Object.entries(jeArt).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${art.padEnd(14)} ${String(n).padStart(5)}`);
  }
  console.log(`    ${"".padEnd(14)} ${"─".repeat(5)}`);
  console.log(`    ${"gesamt".padEnd(14)} ${String(geplant.length).padStart(5)}`);
  console.log(`\n  Das sind ${(geplant.length / TAGE).toFixed(1)} Beiträge pro Tag im Schnitt.`);
  console.log(`  Ereignis-Posts aus ECHTEN Daten: ${abschluesse.length} Abschlüsse, `
    + `${tage.length} Ranglisten, ${wochen.length} Wochenrückblicke.\n`);

  const [schon] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_posts WHERE auto_schluessel LIKE 'seed-%'
  `) as any[];
  if (Number(schon.n) > 0) {
    console.log(`  Hinweis: Es stehen bereits ${schon.n} Seed-Beiträge im Feed.`);
    console.log("  Der Lauf ist idempotent — vorhandene werden übersprungen.\n");
  }

  if (!SCHREIBEN) {
    console.log("  VORSCHAU. Nichts geschrieben.");
    console.log("  Zum Ausführen: npx tsx scripts/space-seed.ts --schreiben\n");
    await sqlPool.end();
    return;
  }

  // ── Schreiben ───────────────────────────────────────────────────────────
  console.log("  Schreibe …");
  let angelegt = 0;
  let uebersprungen = 0;
  // Chronologisch: Ein Feed, dessen Kennungen nicht zur Zeit passen, sortiert
  // beim Nachladen (das über die Kennung geht) durcheinander.
  geplant.sort((a, b) => a.am.getTime() - b.am.getTime());
  for (const b of geplant) {
    if (await beitragAnlegen(b)) angelegt++;
    else uebersprungen++;
  }

  console.log(`\n  ${angelegt} angelegt, ${uebersprungen} übersprungen (waren schon da).`);
  const [gesamt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_posts WHERE geloescht_at IS NULL
  `) as any[];
  console.log(`  Der Feed hat jetzt ${gesamt.n} Beiträge.\n`);
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nAbgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
