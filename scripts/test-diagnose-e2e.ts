// Testplan P5 (Punkte 3,4,6): Ring-Puffer-Grenze, Aggregation (100 identisch),
// Persistenz + Maskierung durch den echten Code-Pfad. Räumt am Ende auf.
// Aufruf: npx tsx scripts/test-diagnose-e2e.ts
import "dotenv/config";
import postgres from "postgres";
import {
  logDiagnostic, pushRaw, getRawTail, purgeDiagnostics, DIAGNOSTICS_CONFIG,
} from "../server/lib/fiaon-diagnostics";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`  ${cond ? "PASS" : "FAIL"}  ${n}${extra ? ` — ${extra}` : ""}`); };

const TEST_CODE = "e2e_test_marker";

async function main() {
  console.log("── P5 Diagnose E2E (echte DB, markierte Testdaten) ──────────");

  // 1) Ring-Puffer: harte Grenze (Zeilen). Über das Limit hinaus pushen.
  const over = DIAGNOSTICS_CONFIG.RAW_MAX_LINES + 250;
  for (let i = 0; i < over; i++) pushRaw("info", `ringtest zeile ${i}`);
  const tail = getRawTail({ limit: DIAGNOSTICS_CONFIG.RAW_MAX_LINES });
  ok("Ring-Puffer hält Zeilen-Grenze ein", tail.totalLines <= DIAGNOSTICS_CONFIG.RAW_MAX_LINES, `${tail.totalLines}/${DIAGNOSTICS_CONFIG.RAW_MAX_LINES}`);
  ok("Ring-Puffer hält Byte-Grenze ein", tail.totalBytes <= DIAGNOSTICS_CONFIG.RAW_MAX_BYTES, `${tail.totalBytes}/${DIAGNOSTICS_CONFIG.RAW_MAX_BYTES}`);
  ok("Ring-Puffer neueste zuerst", tail.lines[0]?.text.includes(`${over - 1}`));

  // 2) Rohdaten werden maskiert abgelegt (Secret darf nicht im Puffer landen).
  pushRaw("error", "leak-check sk-shouldnotappear123456 im rohlog");
  const leakTail = getRawTail({ q: "leak-check" });
  ok("Rohdaten maskiert (kein Secret im Puffer)", !JSON.stringify(leakTail.lines).includes("sk-shouldnotappear123456"));

  // 3) Aggregation: 100 identische Fehler → EIN Fingerprint.
  for (let i = 0; i < 100; i++) {
    logDiagnostic({ severity: "warnung", category: "system", code: TEST_CODE, message: "Wiederkehrender Testfehler Nr X" });
  }
  // 4) Persistenz + Maskierung durch den echten Log-Pfad.
  logDiagnostic({ severity: "kritisch", category: "email_make", code: TEST_CODE, message: "Testmail an leak@gmail.com mit sk-persistleak99887766 gescheitert" });

  // Non-blocking Inserts abwarten (Polling bis alle 101 gelandet sind, max 15 s).
  let totalInserted = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const [c] = await sql`SELECT COUNT(*)::int AS c FROM fiaon_diagnostics WHERE code = ${TEST_CODE}`;
    totalInserted = Number(c.c);
    if (totalInserted >= 101) break;
  }

  const rows = await sql`SELECT fingerprint, COUNT(*)::int AS c FROM fiaon_diagnostics WHERE code = ${TEST_CODE} GROUP BY fingerprint`;
  const warnGroup = rows.find((r) => Number(r.c) >= 100);
  // Aggregation ist erfüllt, wenn die 100 identischen Warnungen zu EINEM Fingerprint fallen.
  ok("100 identische Fehler → 1 Fingerprint (Aggregation)", !!warnGroup, `Fingerprint-Gruppen: ${rows.length}, Zeilen gesamt: ${totalInserted}`);

  const [leakRow] = await sql`SELECT message FROM fiaon_diagnostics WHERE code = ${TEST_CODE} AND severity = 'kritisch' ORDER BY id DESC LIMIT 1`;
  ok("Persistierte Nachricht ist maskiert", !!leakRow && !leakRow.message.includes("sk-persistleak99887766") && !leakRow.message.includes("leak@gmail.com"), leakRow?.message);

  // Aufräumen: nur die Testmarker.
  const del = await sql`DELETE FROM fiaon_diagnostics WHERE code = ${TEST_CODE} RETURNING id`;
  ok("Testdaten entfernt", del.length >= 101, `${del.length} gelöscht`);

  console.log("─────────────────────────────────────────────────────────────");
  console.log(`Ergebnis: ${pass} PASS, ${fail} FAIL`);
  console.log(`Retention: ${DIAGNOSTICS_CONFIG.RETENTION_DAYS} Tage · Ring-Puffer: ${DIAGNOSTICS_CONFIG.RAW_MAX_LINES} Zeilen / ${(DIAGNOSTICS_CONFIG.RAW_MAX_BYTES / 1024 / 1024).toFixed(0)} MB`);
  await sql.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
