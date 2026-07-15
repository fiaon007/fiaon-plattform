// ════════════════════════════════════════════════════════════════════
// PHASE 2B (V4) — Ende-zu-Ende-Test der Geldlogik am ECHTEN Code-Pfad.
// Testdaten sind KLAR markiert (E-Mail *@fiaon-systemtest.invalid, Name
// „P2B TESTKUNDE") und werden mit --cleanup restlos entfernt.
//
//   npx tsx scripts/phase2b-e2e.ts            → Test ausführen + Report
//   npx tsx scripts/phase2b-e2e.ts --cleanup  → Testdaten entfernen
//
// Getestet wird über applyTxn (Kontoabgleich-Verbuchung = „bezahlt"-Button):
//   T1 Direktzahler: Zahlung ohne dokumentierte Betreuung → paid, KEINE Provision
//   T2 Dubletten-Stopp: Schwester-Bestellung wird superseded
//   T3 payment_confirmed genau 1× (confirmed_email_sent_at-Claim)
//   T4 Idempotenz: zweites Verbuchen bucht nichts doppelt
//   T5 Betreut: dokumentiertes Kontakt-Ergebnis (Testagent) → Provision gebucht
//   T6 Dubletten-Attribution: Kontakt auf Schwester-ref zählt für die bezahlte ref
// Hinweis: Der Make-Webhook feuert real; die Empfänger-Domain .invalid ist
// nicht zustellbar — es geht KEINE Mail an echte Kunden.
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";
import { applyTxn } from "../server/routes/fiaon-reconcile";
import { onCustomerPaid } from "../server/routes/fiaon-agent";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const CLEANUP = process.argv.includes("--cleanup");

const T = {
  email: "p2b-testkunde@fiaon-systemtest.invalid",
  email2: "p2b-testkunde-b@fiaon-systemtest.invalid",
  refA: "FIAON-P2BTESTA-E2E1",   // Hauptbestellung (Direktzahler-Test)
  refB: "FIAON-P2BTESTB-E2E1",   // Schwester (Dubletten-Stopp)
  refC: "FIAON-P2BTESTC-E2E1",   // Betreut-Test (T5)
  refD: "FIAON-P2BTESTD-E2E1",   // Dubletten-Attribution (T6, Schwester von C — Kontakt liegt hier)
  payA: "FIAON-P2BTA1",
  payC: "FIAON-P2BTC1",
  txnA: "P2B-E2E-BANK-A",
  txnC: "P2B-E2E-BANK-C",
  agentName: "P2B TESTAGENT (SYSTEMTEST)",
};

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  cond ? pass++ : fail++;
}

async function cleanup() {
  const refs = [T.refA, T.refB, T.refC, T.refD];
  const c1 = await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${refs}) RETURNING id`;
  const c2 = await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs}) RETURNING id`;
  const c3 = await sql`DELETE FROM fiaon_bank_txns WHERE txn_id IN (${T.txnA}, ${T.txnC}) RETURNING id`;
  const c4 = await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${refs}) RETURNING ref`;
  const c5 = await sql`DELETE FROM fiaon_agent_events WHERE agent_id IN (SELECT id FROM fiaon_agents WHERE name = ${T.agentName}) RETURNING id`.catch(() => [] as any[]);
  const c6 = await sql`DELETE FROM fiaon_agents WHERE name = ${T.agentName} RETURNING id`;
  console.log(`CLEANUP: ${c4.length} Anträge, ${c3.length} Bank-Txns, ${c1.length} Provisionen, ${c2.length} Log-Einträge, ${c6.length} Testagent(en), ${c5.length} Agent-Events entfernt.`);
}

async function main() {
  if (CLEANUP) { await cleanup(); await sql.end(); return; }

  // Vorreinigung, falls ein früherer Lauf abbrach
  await cleanup();

  // ── Setup: Testagent (inaktiv → nie in Verteilung/Team-Rotation) ──
  const [agent] = await sql`
    INSERT INTO fiaon_agents (name, email, active, commission_rate_bp)
    VALUES (${T.agentName}, 'p2b-agent@fiaon-systemtest.invalid', FALSE, 1500)
    RETURNING id
  `;
  const agentId = Number(agent.id);

  // ── Setup: Bestellungen (klar markierte Testdaten) ──
  const mkApp = (ref: string, pay: string | null, email: string) => sql`
    INSERT INTO fiaon_applications (ref, payment_reference, email, first_name, last_name, pack_name, amount_due, payment_status, created_at, updated_at)
    VALUES (${ref}, ${pay}, ${email}, 'P2B', 'TESTKUNDE', 'Systemtest', 99.00, 'pending_payment', NOW(), NOW())
  `;
  await mkApp(T.refA, T.payA, T.email);
  await mkApp(T.refB, null, T.email);           // Schwester von A (gleiche E-Mail)
  await mkApp(T.refC, T.payC, T.email2);
  await mkApp(T.refD, null, T.email2);          // Schwester von C — hier liegt der Kontakt (T6)

  // T5/T6-Vorbereitung: dokumentiertes Kontakt-Ergebnis des Testagenten auf refD
  // (der SCHWESTER von C) — die Attribution muss über die Dublette hinweg greifen.
  await sql`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
    VALUES (${T.refD}, ${agentId}, ${T.agentName}, 'result', 'erreicht_interesse', 'E2E-Test: dokumentierter Kontakt (Systemtest)')
  `;

  // ── Bank-Eingänge (Fake, klar markiert) ──
  const [txnA] = await sql`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok)
    VALUES (${T.txnA}, NOW(), 9900, 'EUR', 'P2B TESTKUNDE', ${"Systemtest " + T.payA}, ${T.payA}, ${T.refA}, 'matched', TRUE)
    RETURNING id
  `;
  const [txnC] = await sql`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok)
    VALUES (${T.txnC}, NOW(), 9900, 'EUR', 'P2B TESTKUNDE', ${"Systemtest " + T.payC}, ${T.payC}, ${T.refC}, 'matched', TRUE)
    RETURNING id
  `;

  console.log("\n═══ T1–T4: Direktzahler-Pfad (refA, keine Betreuung dokumentiert) ═══");
  const r1 = await applyTxn(Number(txnA.id), false);
  assert("T0 applyTxn läuft durch", r1.ok === true, r1.error || "");

  const [a] = await sql`SELECT payment_status, commission_basis, confirmed_email_sent_at, assigned_agent_id FROM fiaon_applications WHERE ref = ${T.refA}`;
  assert("T1a Status = paid (Freischaltung)", a.payment_status === "paid");
  // refA ist UNZUGEWIESEN → auch im Altmodell (Stichtag leer) kein Anspruch → Direktzahler
  assert("T1b Direktzahler markiert", a.commission_basis === "direktzahler", `basis=${a.commission_basis}`);
  const [k1] = await sql`SELECT COUNT(*)::int AS c FROM fiaon_commissions WHERE ref = ${T.refA}`;
  assert("T1c KEINE Provision gebucht", Number(k1.c) === 0, `${k1.c} Einträge`);

  const [b] = await sql`SELECT payment_status, superseded_by FROM fiaon_applications WHERE ref = ${T.refB}`;
  assert("T2 Schwester-Dublette superseded (Erinnerungs-Stopp)", b.payment_status === "superseded", `status=${b.payment_status}`);

  assert("T3a payment_confirmed-Claim gesetzt (Mail 1×)", a.confirmed_email_sent_at != null);
  const claimBefore = a.confirmed_email_sent_at;
  // T4: zweites Verbuchen — nichts darf doppelt passieren
  await sql`UPDATE fiaon_bank_txns SET applied = FALSE WHERE id = ${txnA.id}`; // Re-Apply erzwingen
  const r2 = await applyTxn(Number(txnA.id), false);
  const [a2] = await sql`SELECT confirmed_email_sent_at FROM fiaon_applications WHERE ref = ${T.refA}`;
  const [k2] = await sql`SELECT COUNT(*)::int AS c FROM fiaon_commissions WHERE ref = ${T.refA}`;
  assert("T4a Idempotent: Mail-Claim unverändert (keine 2. Mail)", String(a2.confirmed_email_sent_at) === String(claimBefore));
  assert("T4b Idempotent: weiterhin keine Provision", Number(k2.c) === 0 && r2.ok);

  console.log("\n═══ T5–T6: Betreut-Pfad (refC; Kontakt liegt auf Schwester refD) ═══");
  const r3 = await applyTxn(Number(txnC.id), false);
  assert("T5a applyTxn läuft durch", r3.ok === true, r3.error || "");
  const [c] = await sql`SELECT payment_status, commission_basis, commission_basis_note, assigned_agent_id FROM fiaon_applications WHERE ref = ${T.refC}`;
  assert("T6a Dubletten-Attribution: Kontakt auf Schwester-ref zählt", c.commission_basis === "betreut", `basis=${c.commission_basis}`);
  assert("T6b Attribution folgt Betreuung (Agent gesetzt)", Number(c.assigned_agent_id) === agentId, `agent=${c.assigned_agent_id}`);
  const [k3] = await sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_cents),0)::int AS cents FROM fiaon_commissions WHERE ref = ${T.refC} AND agent_id = ${agentId} AND kind = 'own'`;
  assert("T5b Provision gebucht (15 % von 99 € = 14,85 €)", Number(k3.c) === 1 && Number(k3.cents) === 1485, `${k3.c} Eintrag, ${(Number(k3.cents) / 100).toFixed(2)} €`);

  console.log(`\n═══ ERGEBNIS: ${pass} PASS, ${fail} FAIL ═══`);
  console.log("Testdaten sind noch in der DB (klar markiert). Entfernen mit: npx tsx scripts/phase2b-e2e.ts --cleanup");
  await sql.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
