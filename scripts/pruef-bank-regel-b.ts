// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Bankabgleich E-235 + Regel B + Provisionsschalter (01.10.2026)
//
// NUR gegen das lokale Postgres 127.0.0.1:54329 (eigene Kopie, z. B.
// createdb -T fiaon_pruefstand_e263 fiaon_go0110_geld). Jeder Netzaufruf ist
// abgeklemmt (fetch-Stub), Mails landen als „fehlgeschlagen" im Mail-Log.
//
//   DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_go0110_geld \
//     npx tsx scripts/pruef-bank-regel-b.ts
//
// Fährt den ECHTEN Code (liveVerbuchen → alsBezahltBuchen / rateBezahltBuchen →
// onCustomerPaid / onRatePaid / praemieBuchen, nachbuchen) mit erfundenen
// Datensätzen (Marke G0110) und prüft, was in Bankbuch, Raten, Bestellungen,
// Vormerkungen und Provisionen ankommt. Räumt vorher und nachher auf.
//
// Gegenprüfung 01.10.2026 (Fälle P–S): Kündigung BEANTRAGT (Formular, Aufgabe,
// Postfach) sperrt Regel B; Zugangsmail fällt auf die Adresse der Person zurück;
// Trockenprobe und Buchen über server/lib/fiaon-bank-nachholen.ts (der Weg des
// Bankbuchs) samt Hinweis „Kunde nennt Rate 3" und Aufgabe an den Betreuer.
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";

const URL = String(process.env.DATABASE_URL || "");
if (!/@127\.0\.0\.1:54329\//.test(URL)) throw new Error("Nur gegen den lokalen Prüfstand 127.0.0.1:54329!");
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "META_CAPI_TOKEN", "AIRWALLEX_API_KEY"]) delete process.env[k];

const sql = postgres(URL, { ssl: "require", max: 2, onnotice: () => {} });
const M = "G0110"; // Marke aller Prüfdatensätze
const AG = { betreuer: 99101, werber: 99102, inkasso: 99103 };

// Kein Netz: alles, was hinaus will, wird abgewiesen und gezählt.
let blockiert = 0;
globalThis.fetch = (async (url: any) => {
  blockiert++;
  return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 });
}) as any;

let fehler = 0;
const ok = (name: string, bed: boolean, info: unknown = "") => {
  if (!bed) fehler++;
  console.log(`${bed ? "  ok  " : "  ROT "} ${name}${info !== "" ? `  — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
};
const tag = (versatz: number) => {
  const d = new Date(Date.now() + versatz * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function bis<T>(frage: () => Promise<T>, fertig: (x: T) => boolean, ms = 15_000): Promise<T> {
  const ende = Date.now() + ms;
  let x = await frage();
  while (!fertig(x) && Date.now() < ende) { await warte(250); x = await frage(); }
  return x;
}

async function aufraeumen() {
  const refs = (await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`).map((r: any) => r.ref);
  const raten = refs.length ? (await sql`SELECT id FROM fiaon_abo_raten WHERE ref = ANY(${refs})`).map((r: any) => Number(r.id)) : [];
  const ratenRefs = raten.map((id) => `RATE-${id}`);
  await sql`DELETE FROM fiaon_provision_vormerkung WHERE ref = ANY(${[...refs, ...ratenRefs]}) OR agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso})`.catch(() => {});
  await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${[...refs, ...ratenRefs]}) OR agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso})`;
  if (raten.length) await sql`DELETE FROM fiaon_raten_arbeit WHERE rate_id = ANY(${raten})`;
  if (refs.length) {
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`;
  }
  await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE ${`%-${M.toLowerCase()}-%`}`;
  // Fälle P und R: beantragte Kündigungen und Aufgaben
  await sql`DELETE FROM cancellation_requests WHERE ref LIKE ${`FIAON-${M}%`}`.catch(() => {});
  await sql`DELETE FROM fiaon_postmeister WHERE ref LIKE ${`FIAON-${M}%`} OR gmail_id LIKE ${`pruef-${M.toLowerCase()}-%`}`.catch(() => {});
  const todos = (await sql`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`%${M}%`} OR link LIKE ${`%${M}%`} OR schluessel LIKE ${`bank-nachholen:%-${M.toLowerCase()}-%`}`.catch(() => [])).map((r: any) => Number(r.id));
  if (todos.length) {
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${todos})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todos})`.catch(() => {});
  }
  const personen = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PRUEF-${M}-%`}`).map((r: any) => Number(r.id));
  if (personen.length) {
    await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`;
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`;
  }
  await sql`DELETE FROM fiaon_mail_log WHERE empfaenger LIKE ${`%@${M.toLowerCase()}.invalid`}`;
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`;
  if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
  await sql`DELETE FROM fiaon_agent_events WHERE agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso})`.catch(() => {});
  await sql`DELETE FROM fiaon_agents WHERE id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso})`;
}

async function agenten() {
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp) VALUES (${AG.werber}, 'Prüf Werber', 'werber@g0110.invalid', TRUE, 2500)`;
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp, recruited_by) VALUES (${AG.betreuer}, 'Prüf Betreuer', 'betreuer@g0110.invalid', TRUE, 2500, ${AG.werber})`;
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp, inkasso_praemie_art, inkasso_praemie_wert, verguetung_bestaetigt_am)
            VALUES (${AG.inkasso}, 'Prüf Inkasso', 'inkasso@g0110.invalid', TRUE, 2500, 'euro', 200, NOW())`;
}

/** Ein Kunde mit Bestellung; `bezahlt` legt Rate 1 (bezahlt am `rate1Am`) an. */
async function kunde(x: string, o: {
  pr: string; cents: number; bezahlt: boolean; rate1Am?: string; gekuendigt?: boolean; mitKontakt?: boolean;
  /** Bestellung ohne E-Mail (Fall 7914: Adresse steht nur an der Person). */
  ohneMail?: boolean;
}) {
  const ref = `FIAON-${M}${x}-TEST`;
  const [p] = await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id)
    VALUES (${`PRUEF-${M}-${x}`}, 'Prüf', ${`Kunde ${x}`}, ${`kunde-${x.toLowerCase()}@g0110.invalid`}, ${AG.betreuer}) RETURNING id`;
  await sql`
    INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due,
                                    email, first_name, last_name, person_id, assigned_agent_id, created_at, completed_at, gekuendigt_am)
    VALUES (${ref}, ${o.pr}, ${o.bezahlt ? "paid" : "pending_payment"}, ${o.bezahlt ? "payment_completed" : "payment_pending"}, 'private',
            ${o.cents === 799 ? "start" : o.cents === 5999 ? "pro" : "highend"}, ${`Prüf ${x}`}, ${o.cents / 100},
            ${o.ohneMail ? null : `kunde-${x.toLowerCase()}@g0110.invalid`}, 'Prüf', ${`Kunde ${x}`}, ${p.id}, ${AG.betreuer},
            NOW() - INTERVAL '90 days', ${o.bezahlt ? `${o.rate1Am}T12:00:00Z` : null}, ${o.gekuendigt ? new Date() : null})`;
  if (o.mitKontakt !== false) {
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
              VALUES (${ref}, ${p.id}, ${AG.betreuer}, 'Prüf Betreuer', 'result', 'interessiert', 'Prüfstand: Gespräch geführt', NOW() - INTERVAL '2 days')`;
  }
  if (o.bezahlt) {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
              VALUES (${ref}, 1, ${o.pr}, ${o.cents}, ${o.rate1Am!}, 'bezahlt', ${`${o.rate1Am}T12:00:00Z`}, 'auto', 'Startzahlung')`;
  }
  return { ref, personId: Number(p.id) };
}
const rate = async (ref: string, nr: number, zr: string, cents: number, faellig: string, bezahlt = false) => {
  const [r] = await sql`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle)
    VALUES (${ref}, ${nr}, ${zr}, ${cents}, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt ? `${faellig}T12:00:00Z` : null}, 'auto')
    RETURNING id`;
  return Number(r.id);
};
/** Ein Eingang im Bankbuch — so, wie ihn der Einleser anlegt. */
const eingang = async (x: string, datum: string, cents: number, zweck: string, refErkennen: (t: string) => string | null, extra: { applied?: boolean; matchedRef?: string } = {}) => {
  const txnId = `AWX-${M.toLowerCase()}-${x}`;
  await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, applied, note)
            VALUES (${txnId}, ${`${datum}T00:00:00Z`}, ${cents}, 'EUR', 'Prüf Zahler', ${zweck}, ${refErkennen(zweck)}, ${extra.matchedRef ?? null},
                    ${extra.matchedRef ? "matched" : "unmatched"}, ${extra.applied ?? false}, 'Prüfstand')`;
  return txnId;
};
const vorm = (ref: string) => sql`SELECT agent_id, kind, amount_cents, status, payment_reference FROM fiaon_provision_vormerkung WHERE ref = ${ref} OR ref LIKE 'RATE-%' AND payment_reference LIKE ${`%${M}%`} ORDER BY id` as Promise<any[]>;
const komm = (ref: string) => sql`SELECT agent_id, kind, amount_cents, status FROM fiaon_commissions WHERE ref = ${ref} ORDER BY id` as Promise<any[]>;

async function main() {
  await aufraeumen();
  await agenten();
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('provision_automatik', 'aus') ON CONFLICT (key) DO UPDATE SET value = 'aus'`;

  const { liveVerbuchen, refErkennen } = await import("../server/routes/fiaon-wise");
  const { nachbuchen, automatikSetzen } = await import("../server/lib/fiaon-provision-automatik");
  const { praemieBuchen } = await import("../server/lib/fiaon-inkasso");
  const heute = tag(0);

  // ── A: E-235 — Erstzahlung, Referenz ohne Strich, Automatik ──────────────
  console.log("\nA  Erstzahlung FIAONG0110A (ohne Strich), centgenau, Schalter AUS");
  const A = await kunde("A", { pr: `FIAON${M}A`.slice(0, 11), cents: 799, bezahlt: false });
  const prA = `FIAON${M}A`.slice(0, 11);
  const tA = await eingang("a", heute, 799, `Überweisung ${prA}`, refErkennen);
  const eA = await liveVerbuchen(tA, refErkennen(`Überweisung ${prA}`), 799, heute);
  ok("A gebucht (Erstzahlung)", eA.gebucht && eA.regel === "erstzahlung", eA.grund);
  const [aA] = await sql`SELECT payment_status, account_status, confirmed_email_sent_at FROM fiaon_applications WHERE ref = ${A.ref}`;
  ok("A Bestellung paid + Konto aktiv", aA.payment_status === "paid" && aA.account_status === "active");
  ok("A Bestätigungsmail beansprucht (confirmed_email_sent_at)", !!aA.confirmed_email_sent_at);
  const vA = await bis(() => vorm(A.ref), (v) => v.length >= 2);
  ok("A Vormerkung own 2,00 € für den Betreuer", vA.some((v) => v.kind === "own" && Number(v.agent_id) === AG.betreuer && Number(v.amount_cents) === 200), vA);
  ok("A Vormerkung override 0,40 € für den Werber (neu seit 01.10.)", vA.some((v) => v.kind === "override" && Number(v.agent_id) === AG.werber && Number(v.amount_cents) === 40));
  ok("A KEINE Provision gebucht", (await komm(A.ref)).length === 0);
  const [bA] = await sql`SELECT applied, matched_ref, match_status FROM fiaon_bank_txns WHERE txn_id = ${tA}`;
  ok("A Bankbuch: applied + matched_ref = Bestellung", bA.applied === true && bA.matched_ref === A.ref && bA.match_status === "matched", bA);
  const rA = await bis(() => sql`SELECT rate_nr, status FROM fiaon_abo_raten WHERE ref = ${A.ref} ORDER BY rate_nr` as Promise<any[]>, (r) => r.length >= 1);
  ok("A Ratenkette angelegt (Rate 1 bezahlt)", rA.some((r) => r.rate_nr === 1 && r.status === "bezahlt"), rA);
  const eA2 = await liveVerbuchen(tA, refErkennen(`Überweisung ${prA}`), 799, heute);
  ok("A zweiter Lauf desselben Eingangs bucht nichts", !eA2.gebucht && /schon verbucht/.test(eA2.grund), eA2.grund);

  // ── B: Erstzahlung mit 1 Cent zu viel ───────────────────────────────────
  console.log("\nB  Erstzahlung 100,00 € auf 99,99 €");
  const B = await kunde("B", { pr: `FIAON-${M}B`.slice(0, 12), cents: 9999, bezahlt: false });
  const prB = `FIAON-${M}B`.slice(0, 12);
  const tB = await eingang("b", heute, 10000, prB, refErkennen);
  const eB1 = await liveVerbuchen(tB, refErkennen(prB), 10000, heute);
  ok("B Automatik (ohne Toleranz) bucht NICHT", !eB1.gebucht && eB1.grund === "Betrag weicht ab", eB1.grund);
  await sql`UPDATE fiaon_bank_txns SET applied = FALSE WHERE txn_id = ${tB}`;
  const eB0 = await liveVerbuchen(tB, refErkennen(prB), 10000, heute, { trocken: true, ueberzahlungBisCents: 100 });
  ok("B Nachhol-Vorschau mit Toleranz: würde buchen", eB0.grund.startsWith("würde buchen: Erstzahlung") && /Überzahlung 0.01/.test(eB0.grund), eB0.grund);
  const eB2 = await liveVerbuchen(tB, refErkennen(prB), 10000, heute, { ueberzahlungBisCents: 100, anlass: "Nachhol-Lauf" });
  ok("B Nachhol-Lauf bucht", eB2.gebucht, eB2.grund);
  const eB3 = await liveVerbuchen("AWX-g0110-unter", refErkennen("FIAONG0110Z"), 9998, heute, { trocken: true, ueberzahlungBisCents: 100 });
  ok("B' unbekannte Referenz → keine Bestellung", !eB3.gebucht && /keine Bestellung/.test(eB3.grund), eB3.grund);

  // ── C: Regel B, Startzahlung mit Bankeingang belegt, Inkasso-Arbeit ──────
  console.log("\nC  Regel B: „FIAON G0110C 2“ ohne -N, Rate 1 mit Bankbeleg, Inkasso hat gearbeitet");
  const prC = `FIAON-${M}C`.slice(0, 12);
  const C = await kunde("C", { pr: prC, cents: 5999, bezahlt: true, rate1Am: tag(-40) });
  await eingang("c0", tag(-40), 5999, prC, refErkennen, { applied: true, matchedRef: C.ref });
  const r2C = await rate(C.ref, 2, `${prC}-2`, 5999, tag(-10));
  await sql`INSERT INTO fiaon_raten_arbeit (rate_id, ref, agent_id, agent_name, ergebnis) VALUES (${r2C}, ${C.ref}, ${AG.inkasso}, 'Prüf Inkasso', 'zahlt_am')`;
  const zweckC = `Gesendet von Bank. ${prC.replace("-", " ")} 2 Max Muster`;
  const tC = await eingang("c", heute, 5999, zweckC, refErkennen);
  const tro = await liveVerbuchen(tC, refErkennen(zweckC), 5999, heute, { trocken: true });
  ok("C trocken: würde Rate 2 buchen (Regel B)", tro.regel === "regel_b" && tro.rateId === r2C && tro.grund.startsWith("würde buchen"), tro.grund);
  ok("C trocken schreibt nichts", (await sql`SELECT applied, note FROM fiaon_bank_txns WHERE txn_id = ${tC}`)[0].note === "Prüfstand");
  const eC = await liveVerbuchen(tC, refErkennen(zweckC), 5999, heute);
  ok("C gebucht (Regel B)", eC.gebucht && eC.regel === "regel_b", eC.grund);
  const rC = await sql`SELECT rate_nr, status, notiz FROM fiaon_abo_raten WHERE ref = ${C.ref} ORDER BY rate_nr`;
  ok("C Rate 2 bezahlt mit „Bankeingang <txn>“ in der Notiz", rC.some((r: any) => r.rate_nr === 2 && r.status === "bezahlt" && String(r.notiz).includes(`Bankeingang ${tC}`)));
  ok("C Rate 3 neu angelegt (offen)", rC.some((r: any) => r.rate_nr === 3 && r.status === "offen"), rC.map((r: any) => `${r.rate_nr}:${r.status}`));
  const vC = await bis(() => vorm(C.ref), (v) => v.length >= 2);
  ok("C Vormerkung own 15,00 € (Betreuer)", vC.some((v) => v.kind === "own" && Number(v.amount_cents) === 1500 && Number(v.agent_id) === AG.betreuer), vC);
  ok("C Vormerkung override 3,00 € (Werber)", vC.some((v) => v.kind === "override" && Number(v.amount_cents) === 300 && Number(v.agent_id) === AG.werber));
  const vCi = await sql`SELECT agent_id, kind, amount_cents, ref FROM fiaon_provision_vormerkung WHERE ref = ${`RATE-${r2C}`}`;
  ok("C Inkasso-Prämie 2,00 € VORGEMERKT statt gebucht (neu seit 01.10.)", vCi.length === 1 && vCi[0].kind === "inkasso" && Number(vCi[0].amount_cents) === 200, vCi);
  ok("C KEINE Provision und KEINE Prämie gebucht", (await komm(C.ref)).length === 0 && (await komm(`RATE-${r2C}`)).length === 0);
  const eC2 = await liveVerbuchen(tC, refErkennen(zweckC), 5999, heute);
  ok("C zweiter Lauf: nichts doppelt", !eC2.gebucht, eC2.grund);
  // Derselbe Eingang, Bankbuch-Haken künstlich weg — die Ratennotiz hält ihn trotzdem fest.
  await sql`UPDATE fiaon_bank_txns SET applied = FALSE WHERE txn_id = ${tC}`;
  const eC3 = await liveVerbuchen(tC, refErkennen(zweckC), 5999, heute);
  ok("C ohne Bankbuch-Haken: „schon verbraucht“ über die Ratennotiz (AWX-Schutz)", !eC3.gebucht && /verbraucht/.test(eC3.grund), eC3.grund);

  // ── D: Regel B, Deckung unklar ──────────────────────────────────────────
  console.log("\nD  Regel B: Rate 1 vor 3 Tagen ohne Bankbeleg bezahlt, kein früherer Eingang");
  const prD = `FIAON${M}D`.slice(0, 11);
  const D = await kunde("D", { pr: prD, cents: 799, bezahlt: true, rate1Am: tag(-3) });
  await rate(D.ref, 2, `${prD}-2`, 799, tag(3));
  const tD = await eingang("d", heute, 799, prD, refErkennen);
  const eD = await liveVerbuchen(tD, refErkennen(prD), 799, heute);
  ok("D NICHT gebucht — Deckung unklar", !eD.gebucht && /Deckung unklar/.test(eD.grund), eD.grund);
  ok("D Vermerk im Bankbuch, Rate 2 offen", (await sql`SELECT status FROM fiaon_abo_raten WHERE ref = ${D.ref} AND rate_nr = 2`)[0].status === "offen");

  // ── E: Regel B, Startzahlung lange vor dem Bankbuch (Stripe-Zeit) ────────
  console.log("\nE  Regel B: Rate 1 vor 60 Tagen ohne Bankbeleg, Rate 2 seit 30 Tagen fällig");
  const prE = `FIAON${M}E`.slice(0, 11);
  const E = await kunde("E", { pr: prE, cents: 799, bezahlt: true, rate1Am: tag(-60) });
  await rate(E.ref, 2, `${prE}-2`, 799, tag(-30));
  const tE = await eingang("e", heute, 799, `${prE} Rate`, refErkennen);
  const eE = await liveVerbuchen(tE, refErkennen(`${prE} Rate`), 799, heute);
  ok("E gebucht — Rest vor über 35 Tagen ohne Bankbeleg", eE.gebucht && /über 35 Tagen/.test(String(eE.deckung?.text)), eE.deckung?.text);

  // ── F: gekündigt ─────────────────────────────────────────────────────────
  console.log("\nF  Regel B: Vertrag gekündigt");
  const prF = `FIAON${M}F`.slice(0, 11);
  const F = await kunde("F", { pr: prF, cents: 799, bezahlt: true, rate1Am: tag(-40), gekuendigt: true });
  await rate(F.ref, 2, `${prF}-2`, 799, tag(-10));
  const tF = await eingang("f", heute, 799, prF, refErkennen);
  const eF = await liveVerbuchen(tF, refErkennen(prF), 799, heute);
  ok("F NICHT gebucht — gekündigt", !eF.gebucht && /gekündigt/.test(eF.grund), eF.grund);

  // ── G: Betrag ±1 € ───────────────────────────────────────────────────────
  console.log("\nG  Regel B: Betrag 61,50 € (zu weit) / 60,50 € (in der Toleranz)");
  const prG = `FIAON${M}G`.slice(0, 11);
  const G = await kunde("G", { pr: prG, cents: 5999, bezahlt: true, rate1Am: tag(-40) });
  await eingang("g0", tag(-40), 5999, prG, refErkennen, { applied: true, matchedRef: G.ref });
  await rate(G.ref, 2, `${prG}-2`, 5999, tag(-10));
  const tG1 = await eingang("g1", heute, 6150, prG, refErkennen);
  const eG1 = await liveVerbuchen(tG1, refErkennen(prG), 6150, heute);
  ok("G 61,50 € NICHT gebucht", !eG1.gebucht && /passt nicht/.test(eG1.grund), eG1.grund);
  const tG2 = await eingang("g2", heute, 6050, prG, refErkennen);
  const eG2 = await liveVerbuchen(tG2, refErkennen(prG), 6050, heute);
  ok("G 60,50 € gebucht, Abweichung vermerkt", eG2.gebucht && /Abweichung/.test(String((await sql`SELECT notiz FROM fiaon_abo_raten WHERE ref = ${G.ref} AND rate_nr = 2`)[0].notiz)), eG2.grund);

  // ── H: Lücke in der Kette ────────────────────────────────────────────────
  console.log("\nH  Regel B: Rate 2 offen, Rate 3 schon bezahlt");
  const prH = `FIAON${M}H`.slice(0, 11);
  const H = await kunde("H", { pr: prH, cents: 799, bezahlt: true, rate1Am: tag(-70) });
  await rate(H.ref, 2, `${prH}-2`, 799, tag(-40));
  await rate(H.ref, 3, `${prH}-3`, 799, tag(-10), true);
  const tH = await eingang("h", heute, 799, prH, refErkennen);
  const eH = await liveVerbuchen(tH, refErkennen(prH), 799, heute);
  ok("H NICHT gebucht — Lücke", !eH.gebucht && /Lücke/.test(eH.grund), eH.grund);

  // ── I: Vorauszahlung ─────────────────────────────────────────────────────
  console.log("\nI  Regel B: älteste offene Rate erst in 20 Tagen fällig");
  const prI = `FIAON${M}I`.slice(0, 11);
  const I = await kunde("I", { pr: prI, cents: 799, bezahlt: true, rate1Am: tag(-10) });
  await eingang("i0", tag(-10), 799, prI, refErkennen, { applied: true, matchedRef: I.ref });
  await rate(I.ref, 2, `${prI}-2`, 799, tag(20));
  const tI = await eingang("i", heute, 799, prI, refErkennen);
  const eI = await liveVerbuchen(tI, refErkennen(prI), 799, heute);
  ok("I NICHT gebucht — Vorauszahlung", !eI.gebucht && /Vorauszahlung/.test(eI.grund), eI.grund);

  // ── K: E-235 Rate mit Nummer, ohne Strich ────────────────────────────────
  console.log("\nK  Rate „VZ. FIAONG0110K-2“ (E-235) + Doppelzahlung derselben Rate");
  const prK = `FIAON${M}K`.slice(0, 11);
  const K = await kunde("K", { pr: prK, cents: 9999, bezahlt: true, rate1Am: tag(-35) });
  await rate(K.ref, 2, `${prK}-2`, 9999, tag(-5));
  const tK = await eingang("k", heute, 9999, `VZ. ${prK}-2`, refErkennen);
  const eK = await liveVerbuchen(tK, refErkennen(`VZ. ${prK}-2`), 9999, heute);
  ok("K Rate 2 gebucht (Ratenzweig)", eK.gebucht && eK.regel === "rate", eK.grund);
  const tK2 = await eingang("k2", heute, 9999, `${prK}-2`, refErkennen);
  const eK2 = await liveVerbuchen(tK2, refErkennen(`${prK}-2`), 9999, heute);
  ok("K zweite Zahlung derselben Rate: „Doppelzahlung?“, nicht gebucht", !eK2.gebucht && eK2.grund === "Rate schon bezahlt", eK2.grund);

  // ── P: Kündigung BEANTRAGT, noch nicht gesetzt (Gegenprüfung 01.10.) ─────
  console.log("\nP  Regel B: Kündigung beantragt — Formular, Aufgabe, Postfach — Mensch entscheidet");
  const { kuendigungOffen } = await import("../server/routes/fiaon-wise");
  const prP = `FIAON${M}P`.slice(0, 11);
  const P = await kunde("P", { pr: prP, cents: 799, bezahlt: true, rate1Am: tag(-40) });
  await eingang("p0", tag(-40), 799, prP, refErkennen, { applied: true, matchedRef: P.ref });
  await rate(P.ref, 2, `${prP}-2`, 799, tag(-10));
  const tP = await eingang("p", heute, 799, prP, refErkennen);
  ok("P ohne Kündigung: nichts offen", (await kuendigungOffen(P.ref, P.personId)) === null);
  // 1) Formular
  await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status) VALUES (${P.ref}, 'Prüf', 'Kunde P', 'kunde-p@g0110.invalid', 'Prüfstand', 'pending')`;
  const eP1 = await liveVerbuchen(tP, refErkennen(prP), 799, heute);
  ok("P Formular offen → NICHT gebucht, „Kündigung beantragt – Mensch entscheidet“", !eP1.gebucht && /Kündigung beantragt – Mensch entscheidet/.test(eP1.grund), eP1.grund);
  ok("P Bankbuch-Vermerk nennt den Grund", /Kündigung beantragt/.test(String((await sql`SELECT note FROM fiaon_bank_txns WHERE txn_id = ${tP}`)[0].note)));
  await sql`UPDATE cancellation_requests SET status = 'processed' WHERE ref = ${P.ref}`;
  ok("P Formular erledigt → nichts mehr offen", (await kuendigungOffen(P.ref, P.personId)) === null);
  // 2) Aufgabe mit Kündigungs-Schlüssel
  await sql`INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, link, quelle, status)
            VALUES (${`postmeister:kuendigung:${P.ref}`}, 'Kündigung prüfen', 'Prüfstand', 'konten', 1, ${`/admin/kunde/${P.ref}`}, 'postmeister', 'offen')`;
  ok("P offene Kündigungs-Aufgabe → gesperrt", (await kuendigungOffen(P.ref, P.personId)) === "Kündigungs-Aufgabe offen", await kuendigungOffen(P.ref, P.personId));
  const eP2 = await liveVerbuchen(tP, refErkennen(prP), 799, heute);
  ok("P Aufgabe offen → NICHT gebucht", !eP2.gebucht && /Kündigung beantragt/.test(eP2.grund), eP2.grund);
  await sql`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE schluessel = ${`postmeister:kuendigung:${P.ref}`}`;
  ok("P Aufgabe erledigt → frei", (await kuendigungOffen(P.ref, P.personId)) === null);
  // 3) Postfach: unbeantwortete Kündigungsmail
  await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, von, betreff, empfangen_am, kategorie, person_id, ref, aktion)
            VALUES ('info@fiaon.com', ${`pruef-${M.toLowerCase()}-p`}, ${`pruef-${M.toLowerCase()}-p`}, 'kunde-p@g0110.invalid', 'Kündigung', NOW(), 'kuendigung', ${P.personId}, ${P.ref}, 'in_arbeit')`;
  ok("P Kündigungsmail unbeantwortet → gesperrt", (await kuendigungOffen(P.ref, P.personId)) === "Kündigungsmail im Postfach unbeantwortet");
  const eP3 = await liveVerbuchen(tP, refErkennen(prP), 799, heute);
  ok("P Postfach offen → NICHT gebucht", !eP3.gebucht && /Kündigung beantragt/.test(eP3.grund), eP3.grund);
  await sql`UPDATE fiaon_postmeister SET aktion = 'gesendet', gesendet_am = NOW() WHERE gmail_id = ${`pruef-${M.toLowerCase()}-p`}`;
  ok("P Mail beantwortet → frei", (await kuendigungOffen(P.ref, P.personId)) === null);
  const eP4 = await liveVerbuchen(tP, refErkennen(prP), 799, heute);
  ok("P ohne offene Kündigung: Regel B bucht wie gehabt", eP4.gebucht && eP4.regel === "regel_b", eP4.grund);

  // ── Q: Zugangsmail fällt auf die Adresse der Person zurück (Fall 7914/2811) ──
  console.log("\nQ  Erstzahlung, Bestellung OHNE E-Mail, Person hat eine → Zugangsmail geht an die Person");
  const prQ = `FIAON${M}Q`.slice(0, 11);
  const Q = await kunde("Q", { pr: prQ, cents: 799, bezahlt: false, ohneMail: true });
  const tQ = await eingang("q", heute, 799, prQ, refErkennen);
  const eQ = await liveVerbuchen(tQ, refErkennen(prQ), 799, heute);
  ok("Q gebucht (Erstzahlung)", eQ.gebucht, eQ.grund);
  const [aQ] = await sql`SELECT email, confirmed_email_sent_at FROM fiaon_applications WHERE ref = ${Q.ref}`;
  ok("Q Bestellung hat keine Adresse, Anspruch trotzdem beansprucht", aQ.email == null && !!aQ.confirmed_email_sent_at, aQ);
  const mQ = await bis(() => sql`SELECT event, empfaenger FROM fiaon_mail_log WHERE person_id = ${Q.personId} AND event = 'payment_confirmed'` as Promise<any[]>, (m) => m.length >= 1, 8000);
  ok("Q payment_confirmed an die Adresse der Person", mQ.length >= 1 && String(mQ[0].empfaenger || "").includes("kunde-q@g0110.invalid"), mQ);

  // ── R: Der Weg des Bankbuchs — Trockenprobe, Hinweis „Kunde nennt Rate 3“, Buchen, Aufgabe ──
  console.log("\nR  Bankbuch: Trockenprobe + Buchen über fiaon-bank-nachholen, Zweck „FIAON G0110R 3“ bucht Rate 2");
  const nach = await import("../server/lib/fiaon-bank-nachholen");
  ok("R genannteRate liest die Ratennummer des Kunden",
    nach.genannteRate("FIAON J8UU3U 3") === 3 && nach.genannteRate("VZ. FIAONMSYOCC. 2.Rate") === 2
    && nach.genannteRate("Rate 3 FIAON-596FE4") === 3 && nach.genannteRate("FIAON-596FE4") === null
    && nach.genannteRate("FIAON-596FE4 59,99 EUR") === null && nach.genannteRate("FIAONMT0AF9B9") === null,
    [nach.genannteRate("FIAON J8UU3U 3"), nach.genannteRate("VZ. FIAONMSYOCC. 2.Rate"), nach.genannteRate("FIAON-596FE4 59,99 EUR")]);
  const prR = `FIAON-${M}R`.slice(0, 12);
  const R = await kunde("R", { pr: prR, cents: 5999, bezahlt: true, rate1Am: tag(-40) });
  await eingang("r0", tag(-40), 5999, prR, refErkennen, { applied: true, matchedRef: R.ref });
  const r2R = await rate(R.ref, 2, `${prR}-2`, 5999, tag(-10));
  const zweckR = `${prR.replace("-", " ")} 3`;
  const tR = await eingang("r", heute, 5999, zweckR, refErkennen);
  const [idR] = await sql`SELECT id FROM fiaon_bank_txns WHERE txn_id = ${tR}`;
  const probeR = await nach.bankeingangTrockenprobe(Number(idR.id), {});
  ok("R Trockenprobe: buchbar, Regel B, Rate 2", probeR.ok && probeR.zeile?.buchen === true && probeR.zeile.regel === "regel_b" && probeR.zeile.rateId === r2R, probeR.zeile?.ergebnis);
  ok("R Trockenprobe nennt Provision (own + override, vorgemerkt)", (probeR.zeile?.provision || []).some((p) => /own/.test(p) && /vorgemerkt/.test(p)) && (probeR.zeile?.provision || []).some((p) => /override/.test(p)), probeR.zeile?.provision);
  ok("R Hinweis: Kunde nennt Rate 3, gebucht wird Rate 2, Rate 3 bleibt offen", probeR.zeile?.genannteRate === 3 && (probeR.zeile?.hinweise || []).some((h) => /Kunde nennt Rate 3, gebucht wird die älteste offene Rate 2; Rate 3 bleibt offen/.test(h)), probeR.zeile?.hinweise);
  ok("R Trockenprobe schreibt nichts", (await sql`SELECT applied, note FROM fiaon_bank_txns WHERE txn_id = ${tR}`)[0].note === "Prüfstand");
  const falsch = await nach.bankeingangBuchen(Number(idR.id), { wer: "Prüfstand", erwartet: { regel: "regel_b", ziel: `${prR}-3`, rateId: 999 } });
  ok("R Buchen mit abweichender Erwartung → 409, nichts gebucht", !falsch.ok && falsch.status === 409 && (await sql`SELECT status FROM fiaon_abo_raten WHERE id = ${r2R}`)[0].status === "offen", falsch.error);
  const buchR = await nach.bankeingangBuchen(Number(idR.id), { wer: "Prüfstand js@fiaon.com", erwartet: { regel: "regel_b", ziel: `${prR}-2`, rateId: r2R } });
  ok("R Buchen über den Bankbuch-Weg: gebucht", buchR.ok && buchR.ergebnis?.gebucht === true, buchR.error ?? buchR.ergebnis?.grund);
  const rR = await sql`SELECT rate_nr, status, notiz FROM fiaon_abo_raten WHERE ref = ${R.ref} ORDER BY rate_nr`;
  ok("R Rate 2 bezahlt (Notiz nennt Bankeingang + Nachhol-Lauf), Rate 3 offen", rR.some((r: any) => r.rate_nr === 2 && r.status === "bezahlt" && /Nachhol-Lauf \(Prüfstand js@fiaon.com\)/.test(String(r.notiz))) && rR.some((r: any) => r.rate_nr === 3 && r.status === "offen"), rR.map((r: any) => `${r.rate_nr}:${r.status}`));
  const [todoR] = await sql`SELECT id, titel, zustaendig_agent_id, status, link FROM fiaon_betreiber_todos WHERE schluessel = ${`bank-nachholen:andere-rate:${tR}`}`;
  ok("R Aufgabe an den Betreuer: „Kunde nennt Rate 3, gebucht ist Rate 2“", !!todoR && /Kunde nennt Rate 3, gebucht ist Rate 2/.test(String(todoR.titel)) && Number(todoR.zustaendig_agent_id) === AG.betreuer && todoR.status !== "erledigt", todoR ? { titel: todoR.titel, an: todoR.zustaendig_agent_id, meldung: buchR.aufgabe } : "keine Aufgabe");
  const nochmal = await nach.bankeingangBuchen(Number(idR.id), { wer: "Prüfstand" });
  ok("R zweiter Klick: 409 schon verbucht", !nochmal.ok && nochmal.status === 409 && /schon verbucht/.test(String(nochmal.error)), nochmal.error);
  ok("R Vormerkung own 15,00 € für die Rate", (await vorm(R.ref)).some((v) => v.kind === "own" && Number(v.amount_cents) === 1500));

  // ── S: Die Liste des Bankbuchs ───────────────────────────────────────────
  console.log("\nS  nachholListe: nur unverbuchte, nicht unterwegs; Handarbeit bleibt mit Grund");
  const prS = `FIAON${M}S`.slice(0, 11);
  const S = await kunde("S", { pr: prS, cents: 799, bezahlt: false });
  const tS = await eingang("s", heute, 9303, prS, refErkennen);
  const tS2 = await eingang("s2", heute, 799, prS, refErkennen);
  await sql`UPDATE fiaon_bank_txns SET note = 'Airwallex: Geld ist UNTERWEGS' WHERE txn_id = ${tS2}`;
  const listeS = await nach.nachholListe({ seit: heute });
  const zS = listeS.find((z) => z.txnId === tS);
  ok("S Fehlbetrag in der Liste, nicht buchbar, mit Grund", !!zS && zS.buchen === false && zS.unklar === "Betrag weicht ab", zS?.ergebnis);
  ok("S Eingang „unterwegs“ nicht in der Liste", !listeS.some((z) => z.txnId === tS2));
  ok("S gebuchte Eingänge nicht in der Liste", !listeS.some((z) => z.txnId === tR));
  void S;

  // ── N: Nachbuchen am 05.10. ──────────────────────────────────────────────
  console.log("\nN  Nachbuchen aller Prüf-Vormerkungen (der Knopf „Alle buchen“)");
  const offen = await sql`SELECT id, kind FROM fiaon_provision_vormerkung WHERE status = 'offen' AND agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso}) ORDER BY id`;
  let gebucht = 0;
  for (const v of offen) if ((await nachbuchen(Number(v.id), "Prüfstand")).ok) gebucht++;
  ok("N alle Vormerkungen nachgebucht", gebucht === offen.length && offen.length >= 8, `${gebucht}/${offen.length}`);
  const kN = await sql`SELECT kind, status, COUNT(*)::int n, SUM(amount_cents)::int c FROM fiaon_commissions WHERE agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso}) GROUP BY 1, 2 ORDER BY 1`;
  ok("N Nachgebuchtes steht auf 'bestaetigt' (auszahlbar), nie 'offen'", kN.every((k: any) => k.status === "bestaetigt"), kN);
  ok("N Arten own + override + inkasso vorhanden", ["own", "override", "inkasso"].every((k) => kN.some((x: any) => x.kind === k)));
  const pN = await praemieBuchen(r2C);
  ok("N Inkasso-Prämie nach dem Nachbuchen nicht doppelt", !pN.gebucht && /schon gebucht/.test(pN.grund), pN.grund);
  const zweit = await sql`SELECT COUNT(*)::int n FROM fiaon_provision_vormerkung WHERE status = 'offen' AND agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso})`;
  ok("N keine offene Prüf-Vormerkung mehr", zweit[0].n === 0);

  // ── M: Schalter AN (Regression: es wird gebucht, nicht vorgemerkt) ──────
  console.log("\nM  Schalter AN — Regel B bucht Provision, Override und Prämie direkt");
  await automatikSetzen(true, "Prüfstand");
  const prM = `FIAON${M}M`.slice(0, 11);
  const Mk = await kunde("M", { pr: prM, cents: 5999, bezahlt: true, rate1Am: tag(-40) });
  await eingang("m0", tag(-40), 5999, prM, refErkennen, { applied: true, matchedRef: Mk.ref });
  const r2M = await rate(Mk.ref, 2, `${prM}-2`, 5999, tag(-10));
  await sql`INSERT INTO fiaon_raten_arbeit (rate_id, ref, agent_id, agent_name, ergebnis) VALUES (${r2M}, ${Mk.ref}, ${AG.inkasso}, 'Prüf Inkasso', 'zahlt_am')`;
  const tM = await eingang("m", heute, 5999, prM, refErkennen);
  const eM = await liveVerbuchen(tM, refErkennen(prM), 5999, heute);
  ok("M gebucht (Regel B)", eM.gebucht, eM.grund);
  const kM = await bis(() => komm(Mk.ref), (k) => k.length >= 2);
  ok("M own 15,00 € + override 3,00 € GEBUCHT", kM.some((k) => k.kind === "own" && Number(k.amount_cents) === 1500) && kM.some((k) => k.kind === "override" && Number(k.amount_cents) === 300), kM);
  ok("M Inkasso-Prämie GEBUCHT", (await komm(`RATE-${r2M}`)).some((k) => k.kind === "inkasso" && k.status === "bestaetigt"));
  ok("M keine Vormerkung", (await vorm(Mk.ref)).filter((v) => v.payment_reference?.startsWith(prM)).length === 0);
  await automatikSetzen(false, "Prüfstand");

  // ── Mails: was wäre an Kunden gegangen? ─────────────────────────────────
  const mails = await sql`
    SELECT m.event, m.status, LEFT(COALESCE(m.grund, ''), 70) AS grund, p.person_ref
      FROM fiaon_mail_log m JOIN fiaon_persons p ON p.id = m.person_id
     WHERE p.person_ref LIKE ${`PRUEF-${M}-%`} ORDER BY m.id`;
  console.log("\nMail-Log (Versand abgeklemmt — zeigt, WAS rausgegangen wäre):");
  for (const m of mails) console.log(`   ${m.person_ref.slice(-1)}: ${m.event} [${m.status}] ${m.grund}`);
  ok("Mails nur an die Erstzahler (A, B, Q) — Ratenbuchungen schicken keine", mails.every((m: any) => ["A", "B", "Q"].includes(m.person_ref.slice(-1))), mails.map((m: any) => `${m.person_ref.slice(-1)}:${m.event}`));
  ok("Kein Netzaufruf ist durchgekommen (alle abgeklemmt)", true, `${blockiert} blockiert`);

  await aufraeumen();
  const [rest] = await sql`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`})::int
         + (SELECT COUNT(*) FROM fiaon_bank_txns WHERE txn_id LIKE ${`%-${M.toLowerCase()}-%`})::int
         + (SELECT COUNT(*) FROM fiaon_commissions WHERE agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso}))::int
         + (SELECT COUNT(*) FROM fiaon_provision_vormerkung WHERE agent_id IN (${AG.betreuer}, ${AG.werber}, ${AG.inkasso}))::int AS n`;
  ok("Aufgeräumt", rest.n === 0, rest.n);
  console.log(fehler === 0 ? "\nAlles grün." : `\n${fehler} Prüfung(en) ROT.`);
  await sql.end();
  process.exit(fehler === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error("FEHLER:", e?.stack || e); await sql.end().catch(() => {}); process.exit(1); });
