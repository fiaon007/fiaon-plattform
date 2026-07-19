// ════════════════════════════════════════════════════════════════════
// P1 (Prävention) — Ende-zu-Ende-Test am ECHTEN Code-Pfad
// (linkDuplicateToPaidOrActive / mergeApplications / undoMergeApplications).
// Testdaten sind KLAR markiert (E-Mail *@fiaon-systemtest.invalid, Name
// „P1 TESTKUNDE") und werden mit --cleanup restlos entfernt.
//
//   npx tsx scripts/p1-prevention-e2e.ts            → Test ausführen + Report
//   npx tsx scripts/p1-prevention-e2e.ts --cleanup  → Testdaten entfernen
//
// Getestet:
//   T1  Bezahlter Kunde + neuer Doppel-Antrag (gleiche E-Mail) → verknüpft
//   T2  GELD-SICHERHEIT: Zahlung/Referenz/Betrag des Gewinners unverändert
//   T3  Neuer Antrag ist raus aus allen Listen (merged_into gesetzt)
//   T4  Keine Provision durch die Verknüpfung entstanden
//   T5  Telefon-Treffer (keine gemeinsame E-Mail) → verknüpft
//   T6  Aktiver (unbezahlter, betreuter) Kunde als Gewinner → verknüpft
//   T7  UNSICHERHEIT: zwei BEZAHLTE Schwestern → KEIN Auto-Merge (ambiguous)
//   T8  SCHUFA (eigenes Produkt) → nie automatisch verknüpft
//   T9  Undo: Verknüpfung ist exakt umkehrbar
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";
import { linkDuplicateToPaidOrActive, undoMergeApplications } from "../server/routes/fiaon-antrag";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const CLEANUP = process.argv.includes("--cleanup");

const T = {
  emailA: "p1-testkunde-a@fiaon-systemtest.invalid",   // T1–T4 (E-Mail-Match)
  emailAmb: "p1-testkunde-amb@fiaon-systemtest.invalid", // T7 (zwei bezahlte)
  emailActive: "p1-testkunde-act@fiaon-systemtest.invalid", // T6
  phone: "17091234567",
  refPaid: "FIAON-P1PAID-E2E1",     // bezahlter Gewinner (T1–T4)
  refDup: "FIAON-P1DUP-E2E1",       // neuer Doppel-Antrag (T1–T4)
  refPhonePaid: "FIAON-P1PHP-E2E1", // bezahlt, Telefon (T5)
  refPhoneDup: "FIAON-P1PHD-E2E1",  // neuer Antrag, gleiches Telefon (T5)
  refActive: "FIAON-P1ACT-E2E1",    // aktiv/betreut (T6)
  refActDup: "FIAON-P1ACTD-E2E1",   // neuer Antrag zu aktivem Kunden (T6)
  refAmb1: "FIAON-P1AMB1-E2E1",     // bezahlt (T7)
  refAmb2: "FIAON-P1AMB2-E2E1",     // bezahlt (T7)
  refAmbDup: "FIAON-P1AMBD-E2E1",   // neuer Antrag (T7)
  refSchufa: "FIAON-SCHUFA-P1E2E1", // SCHUFA-Bestellung (T8)
  agentName: "P1 TESTAGENT (SYSTEMTEST)",
};
const ALL_REFS = [T.refPaid, T.refDup, T.refPhonePaid, T.refPhoneDup, T.refActive, T.refActDup, T.refAmb1, T.refAmb2, T.refAmbDup, T.refSchufa];

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  cond ? pass++ : fail++;
}

async function cleanup() {
  const c1 = await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${ALL_REFS}) RETURNING id`.catch(() => [] as any[]);
  const c2 = await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${ALL_REFS}) RETURNING id`.catch(() => [] as any[]);
  const c3 = await sql`DELETE FROM fiaon_merge_log WHERE loser_ref = ANY(${ALL_REFS}) OR primary_ref = ANY(${ALL_REFS}) RETURNING id`.catch(() => [] as any[]);
  const c4 = await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${ALL_REFS}) RETURNING ref`;
  const c5 = await sql`DELETE FROM fiaon_agents WHERE name = ${T.agentName} RETURNING id`.catch(() => [] as any[]);
  console.log(`CLEANUP: ${c4.length} Anträge, ${c1.length} Provisionen, ${c2.length} Log-Einträge, ${c3.length} Merge-Log, ${c5.length} Testagent(en) entfernt.`);
}

async function main() {
  if (CLEANUP) { await cleanup(); await sql.end(); return; }
  await cleanup(); // Vorreinigung

  const [agent] = await sql`
    INSERT INTO fiaon_agents (name, email, active, commission_rate_bp)
    VALUES (${T.agentName}, 'p1-agent@fiaon-systemtest.invalid', FALSE, 1500)
    RETURNING id
  `;
  const agentId = Number(agent.id);

  const mk = (ref: string, opts: {
    email?: string | null; pay?: string | null; status?: string;
    phone?: string | null; cc?: string | null; agent?: number | null; type?: string;
  }) => sql`
    INSERT INTO fiaon_applications
      (ref, type, payment_reference, email, first_name, last_name, pack_name, amount_due,
       payment_status, phone, phone_country_code, assigned_agent_id, created_at, updated_at)
    VALUES (${ref}, ${opts.type || "private"}, ${opts.pay ?? null}, ${opts.email ?? null},
            'P1', 'TESTKUNDE', 'Systemtest', 99.00, ${opts.status || "pending_payment"},
            ${opts.phone ?? null}, ${opts.cc ?? null}, ${opts.agent ?? null}, NOW(), NOW())
  `;

  // ── T1–T4: bezahlter Gewinner + neuer Doppel-Antrag (gleiche E-Mail) ──
  await mk(T.refPaid, { email: T.emailA, pay: "FIAON-P1PA1", status: "paid", agent: agentId });
  await mk(T.refDup, { email: T.emailA, status: "submitted" });
  console.log("\n═══ T1–T4: Bezahlter Kunde stellt neuen Antrag (E-Mail-Match) ═══");
  const r1 = await linkDuplicateToPaidOrActive(T.refDup);
  assert("T1 verknüpft (linked)", r1.linked === true && r1.winnerRef === T.refPaid, `winner=${r1.winnerRef}`);
  const [win] = await sql`SELECT payment_status, payment_reference, amount_due FROM fiaon_applications WHERE ref = ${T.refPaid}`;
  assert("T2 Geld-Sicherheit: Gewinner-Zahlung unverändert",
    win.payment_status === "paid" && win.payment_reference === "FIAON-P1PA1" && Number(win.amount_due) === 99,
    `status=${win.payment_status}, ref=${win.payment_reference}, amount=${win.amount_due}`);
  const [dup] = await sql`SELECT merged_into FROM fiaon_applications WHERE ref = ${T.refDup}`;
  assert("T3 Doppel-Antrag ist merged (raus aus allen Listen)", dup.merged_into === T.refPaid, `merged_into=${dup.merged_into}`);
  const [k1] = await sql`SELECT COUNT(*)::int AS c FROM fiaon_commissions WHERE ref = ANY(${[T.refPaid, T.refDup]})`;
  assert("T4 keine Provision durch die Verknüpfung", Number(k1.c) === 0, `${k1.c} Einträge`);

  // ── T5: Telefon-Treffer ohne gemeinsame E-Mail ──
  await mk(T.refPhonePaid, { email: "p1-phone-a@fiaon-systemtest.invalid", pay: "FIAON-P1PH1", status: "paid", phone: T.phone, cc: "+49" });
  await mk(T.refPhoneDup, { email: null, status: "submitted", phone: T.phone, cc: "+49" });
  console.log("\n═══ T5: Telefon-Treffer (keine gemeinsame E-Mail) ═══");
  const r5 = await linkDuplicateToPaidOrActive(T.refPhoneDup);
  assert("T5 verknüpft über Telefon", r5.linked === true && r5.winnerRef === T.refPhonePaid, `winner=${r5.winnerRef}`);

  // ── T6: aktiver (unbezahlter, betreuter) Kunde als Gewinner ──
  await mk(T.refActive, { email: T.emailActive, pay: "FIAON-P1AC1", status: "pending_payment", agent: agentId });
  await mk(T.refActDup, { email: T.emailActive, status: "submitted" });
  console.log("\n═══ T6: Aktiver betreuter Kunde als Gewinner ═══");
  const r6 = await linkDuplicateToPaidOrActive(T.refActDup);
  assert("T6 verknüpft in aktiven Kunden", r6.linked === true && r6.winnerRef === T.refActive, `winner=${r6.winnerRef}`);

  // ── T7: zwei BEZAHLTE Schwestern → KEIN Auto-Merge ──
  await mk(T.refAmb1, { email: T.emailAmb, pay: "FIAON-P1AM1", status: "paid" });
  await mk(T.refAmb2, { email: T.emailAmb, pay: "FIAON-P1AM2", status: "paid" });
  await mk(T.refAmbDup, { email: T.emailAmb, status: "submitted" });
  console.log("\n═══ T7: Unsicherheit — zwei bezahlte Schwestern ═══");
  const r7 = await linkDuplicateToPaidOrActive(T.refAmbDup);
  const [amb] = await sql`SELECT merged_into FROM fiaon_applications WHERE ref = ${T.refAmbDup}`;
  assert("T7 KEIN Auto-Merge (ambiguous)", r7.linked === false && r7.ambiguous === true && amb.merged_into === null, `linked=${r7.linked}, ambiguous=${r7.ambiguous}`);

  // ── T8: SCHUFA (eigenes Produkt) → nie verknüpfen ──
  await mk(T.refSchufa, { email: T.emailA, status: "submitted", type: "schufa" });
  console.log("\n═══ T8: SCHUFA-Bestellung wird nie automatisch verknüpft ═══");
  const r8 = await linkDuplicateToPaidOrActive(T.refSchufa);
  const [schufa] = await sql`SELECT merged_into FROM fiaon_applications WHERE ref = ${T.refSchufa}`;
  assert("T8 SCHUFA nicht verknüpft", r8.linked === false && schufa.merged_into === null, `linked=${r8.linked}`);

  // ── T9: Undo (T1-Verknüpfung exakt umkehrbar) ──
  console.log("\n═══ T9: Verknüpfung ist umkehrbar (Undo) ═══");
  const [batchRow] = await sql`SELECT batch FROM fiaon_merge_log WHERE loser_ref = ${T.refDup} AND undone_at IS NULL ORDER BY id DESC LIMIT 1`;
  if (batchRow?.batch) {
    const u = await undoMergeApplications(batchRow.batch, "P1-E2E");
    const [dup2] = await sql`SELECT merged_into FROM fiaon_applications WHERE ref = ${T.refDup}`;
    assert("T9 Undo stellt Doppel-Antrag wieder her", u.ok === true && dup2.merged_into === null, `merged_into=${dup2.merged_into}`);
  } else {
    assert("T9 Undo: Merge-Batch gefunden", false, "kein Batch im fiaon_merge_log");
  }

  console.log(`\n═══ ERGEBNIS: ${pass} PASS, ${fail} FAIL ═══`);
  console.log("Testdaten sind noch in der DB (klar markiert). Entfernen mit: npx tsx scripts/p1-prevention-e2e.ts --cleanup");
  await sql.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
