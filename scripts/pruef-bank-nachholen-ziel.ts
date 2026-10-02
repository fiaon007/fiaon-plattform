// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-277 (02.10.2026): Handfälle im Bankbuch — Vorschlag, Ziel vom
// Menschen, Sammelzahlung, „Nur zuordnen", Aufgabe.
//
// Justin: „Ok buche alle Zahlungen den Kunden richtig zu die gerade nicht
// gebucht wurden, erkenne sie anhand des Namens, Verwendungszweck oder was auch
// immer, buche alle und lass kein über."
//
// NUR gegen das lokale Postgres 127.0.0.1:54329 (eigene Kopie):
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_e277
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null CRONS=aus \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e277 npx tsx scripts/pruef-bank-nachholen-ziel.ts
//
// Fährt den ECHTEN Code (fiaon-bank-nachholen → liveVerbuchen → alsBezahltBuchen /
// rateBezahltBuchen) mit erfundenen Datensätzen (Marke Q277). Jeder Netzaufruf ist
// abgeklemmt. Räumt vorher und nachher auf.
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";

const URL = String(process.env.DATABASE_URL || "");
if (!/@127\.0\.0\.1:54329\//.test(URL)) throw new Error("Nur gegen den lokalen Prüfstand 127.0.0.1:54329!");
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "META_CAPI_TOKEN", "AIRWALLEX_API_KEY"]) delete process.env[k];

const sql = postgres(URL, { ssl: "require", max: 2, onnotice: () => {} });
const M = "Q277";
const AG = { betreuer: 99271, werber: 99272 };

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
const tag = (versatz: number) => new Date(Date.now() + versatz * 86_400_000).toISOString().slice(0, 10);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function bis<T>(frage: () => Promise<T>, fertig: (x: T) => boolean, ms = 12_000): Promise<T> {
  const ende = Date.now() + ms;
  let x = await frage();
  while (!fertig(x) && Date.now() < ende) { await warte(250); x = await frage(); }
  return x;
}

async function aufraeumen() {
  const refs = (await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`).map((r: any) => r.ref);
  const raten = refs.length ? (await sql`SELECT id FROM fiaon_abo_raten WHERE ref = ANY(${refs})`).map((r: any) => Number(r.id)) : [];
  const ratenRefs = raten.map((id) => `RATE-${id}`);
  await sql`DELETE FROM fiaon_provision_vormerkung WHERE ref = ANY(${[...refs, ...ratenRefs]}) OR agent_id IN (${AG.betreuer}, ${AG.werber})`.catch(() => {});
  await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${[...refs, ...ratenRefs]}) OR agent_id IN (${AG.betreuer}, ${AG.werber})`.catch(() => {});
  if (refs.length) {
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`;
  }
  await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`;
  const todos = (await sql`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`%awx-${M.toLowerCase()}-%`} OR link LIKE ${`%${M}%`}`.catch(() => [])).map((r: any) => Number(r.id));
  if (todos.length) {
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${todos})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todos})`.catch(() => {});
  }
  const personen = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PRUEF-${M}-%`}`).map((r: any) => Number(r.id));
  if (personen.length) {
    await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`;
  }
  await sql`DELETE FROM fiaon_mail_log WHERE empfaenger LIKE ${`%@${M.toLowerCase()}.invalid`}`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`;
  if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
  await sql`DELETE FROM fiaon_agent_events WHERE agent_id IN (${AG.betreuer}, ${AG.werber})`.catch(() => {});
  await sql`DELETE FROM fiaon_agents WHERE id IN (${AG.betreuer}, ${AG.werber})`;
}

async function agenten() {
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp) VALUES (${AG.werber}, 'Prüf Werber E277', 'werber@q277.invalid', TRUE, 2500)`;
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp, recruited_by) VALUES (${AG.betreuer}, 'Prüf Betreuer E277', 'betreuer@q277.invalid', TRUE, 2500, ${AG.werber})`;
}

/** Kunde mit Bestellung. pr = Zahlungsreferenz; status = payment_status; rate1Am: Rate 1 bezahlt (Startzahlung, OHNE Bankbeleg). */
async function kunde(x: string, o: {
  pr: string; cents: number; vorname: string; nachname: string; status?: string; rate1Am?: string; belegNotiz?: string; belegTag?: string;
}) {
  const ref = `FIAON-${M}${x}-TEST`;
  const status = o.status ?? (o.rate1Am ? "paid" : "pending_payment");
  const [p] = await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id)
    VALUES (${`PRUEF-${M}-${x}`}, ${o.vorname}, ${o.nachname}, ${`kunde-${x.toLowerCase()}@q277.invalid`}, ${AG.betreuer}) RETURNING id`;
  await sql`
    INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due,
                                    email, first_name, last_name, person_id, assigned_agent_id, created_at, completed_at,
                                    payment_proof_note, payment_proof_date)
    VALUES (${ref}, ${o.pr}, ${status}, ${status === "paid" ? "payment_completed" : "payment_pending"}, 'private',
            ${o.cents === 799 ? "start" : o.cents === 5999 ? "pro" : o.cents === 7999 ? "ultra" : "highend"}, ${`Prüf ${x}`}, ${o.cents / 100},
            ${`kunde-${x.toLowerCase()}@q277.invalid`}, ${o.vorname}, ${o.nachname}, ${p.id}, ${AG.betreuer},
            NOW() - INTERVAL '90 days', ${o.rate1Am ? `${o.rate1Am}T12:00:00Z` : null},
            ${o.belegNotiz ?? null}, ${o.belegTag ?? null})`;
  await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
            VALUES (${ref}, ${p.id}, ${AG.betreuer}, 'Prüf Betreuer E277', 'result', 'interessiert', 'Prüfstand E-277: Gespräch geführt', NOW() - INTERVAL '2 days')`;
  if (o.rate1Am) {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
              VALUES (${ref}, 1, ${o.pr}, ${o.cents}, ${o.rate1Am}, 'bezahlt', ${`${o.rate1Am}T12:00:00Z`}, 'auto', 'Startzahlung')`;
  }
  return { ref, personId: Number(p.id) };
}
const rate = async (ref: string, nr: number, zr: string, cents: number, faellig: string, bezahlt = false, notiz: string | null = null) => {
  const [r] = await sql`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
    VALUES (${ref}, ${nr}, ${zr}, ${cents}, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt ? `${faellig}T12:00:00Z` : null}, 'auto', ${notiz})
    RETURNING id`;
  return Number(r.id);
};
/** Ein Eingang im Bankbuch — wie der Einleser ihn anlegt. Liefert { id, txnId }. */
const eingang = async (x: string, datum: string, cents: number, zweck: string, zahler: string, extra: { applied?: boolean; matchedRef?: string; note?: string } = {}) => {
  const txnId = `AWX-${M.toLowerCase()}-${x}`;
  const [r] = await sql`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, applied, note)
    VALUES (${txnId}, ${`${datum}T00:00:00Z`}, ${cents}, 'EUR', ${zahler}, ${zweck}, NULL, ${extra.matchedRef ?? null},
            ${extra.matchedRef ? "matched" : "unmatched"}, ${extra.applied ?? false}, ${extra.note ?? "Prüfstand E-277"})
    RETURNING id`;
  return { id: Number(r.id), txnId };
};
const bank = async (id: number) => (await sql`SELECT applied, matched_ref, match_status, note FROM fiaon_bank_txns WHERE id = ${id}`)[0] as any;
const raten = async (ref: string) => (await sql`SELECT id, rate_nr, status, bezahlt_am, notiz FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[];

async function main() {
  await aufraeumen();
  await agenten();
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('provision_automatik', 'aus') ON CONFLICT (key) DO UPDATE SET value = 'aus'`;
  const nach = await import("../server/lib/fiaon-bank-nachholen");
  const { liveVerbuchen } = await import("../server/routes/fiaon-wise");
  const heute = tag(0);
  const kontext = async () => { const k = await nach.kontextLaden(); return k; };
  const vorschlag = async (id: number) => {
    const p = await nach.bankeingangTrockenprobe(id, { mitVorschlag: true });
    return p.zeile?.vorschlag ?? null;
  };

  // ── A: Erstzahlung über bestätigtes Ziel (Zweck ohne Referenz) ───────────
  console.log("\nA  Erstzahlung: „Gesendet mit N26“, Name + Betrag → Vorschlag, Buchung mit Ziel");
  const prA = `FIAON${M}A1`;
  const A = await kunde("A", { pr: prA, cents: 5999, vorname: "Edith", nachname: "Quarzmeier" });
  const eA = await eingang("a", heute, 5999, "Gesendet mit N26", "EDITH QUARZMEIER");
  const pA0 = await nach.bankeingangTrockenprobe(eA.id, { mitVorschlag: true });
  ok("A ohne Ziel nicht buchbar (keine Referenz)", pA0.ok && pA0.zeile?.buchen === false, pA0.zeile?.ergebnis);
  const vA = pA0.zeile?.vorschlag;
  ok("A Vorschlag: Erstzahlung, So buchen, Ziel = Bestellung, sicher", vA?.art === "erstzahlung" && vA.aktion === "buchen" && vA.ziel === prA && vA.mitZiel && vA.sicherheit === "sicher", vA);
  ok("A Vorschlag nennt Gründe (Name + Betrag)", (vA?.gruende || []).some((g) => /Name/.test(g)) && (vA?.gruende || []).some((g) => /Betrag/.test(g)), vA?.gruende);
  const pA = await nach.bankeingangTrockenprobe(eA.id, { ziel: prA });
  ok("A Trockenprobe mit Ziel: würde buchen (Erstzahlung)", pA.ok && pA.zeile?.buchen === true && pA.zeile.regel === "erstzahlung", pA.zeile?.ergebnis);
  ok("A Trockenprobe schreibt nichts", (await bank(eA.id)).note === "Prüfstand E-277" && (await bank(eA.id)).applied === false);
  const bA = await nach.bankeingangBuchen(eA.id, { wer: "Prüfstand", ziel: prA, erwartet: { regel: "erstzahlung", ziel: prA, rateId: null } });
  ok("A gebucht über den einen Weg", bA.ok && bA.ergebnis?.gebucht === true, bA.error ?? bA.ergebnis?.grund);
  const [aA] = await sql`SELECT payment_status, account_status FROM fiaon_applications WHERE ref = ${A.ref}`;
  ok("A Bestellung paid + Konto aktiv", aA.payment_status === "paid" && aA.account_status === "active", aA);
  const kA = await bank(eA.id);
  ok("A Bankbuch: applied + matched_ref", kA.applied === true && kA.matched_ref === A.ref, kA);
  const rA = await bis(() => raten(A.ref), (r) => r.length >= 1);
  ok("A Ratenkette angelegt (Rate 1 bezahlt)", rA.some((r) => r.rate_nr === 1 && r.status === "bezahlt"), rA.map((r) => `${r.rate_nr}:${r.status}`));

  // ── B: Rate über Ziel (Zahlung ohne Referenz, Name + Betrag + fällig) ─────
  console.log("\nB  Rate: Zahlung ohne Zweck, älteste offene Rate fällig → Vorschlag Rate 2, So buchen");
  const prB = `FIAON-${M}B1`;
  const B = await kunde("B", { pr: prB, cents: 5999, vorname: "Max", nachname: "Quellsigl", rate1Am: tag(-40) });
  await eingang("b0", tag(-40), 5999, prB, "MAX QUELLSIGL", { applied: true, matchedRef: B.ref });
  const r2B = await rate(B.ref, 2, `${prB}-2`, 5999, tag(-10));
  const eB = await eingang("b", heute, 5999, "/ROC/WUIBCB-2026//Letzte Beitragszahlung", "MAX QUELLSIGL");
  const vB = await vorschlag(eB.id);
  ok("B Vorschlag: Rate 2, So buchen, sicher", vB?.art === "rate" && vB.aktion === "buchen" && vB.ziel === `${prB}-2` && vB.rateId === r2B && vB.sicherheit === "sicher", vB);
  ok("B Grund nennt Fälligkeit", (vB?.gruende || []).some((g) => /fällig/.test(g)), vB?.gruende);
  const pB = await nach.bankeingangTrockenprobe(eB.id, { ziel: vB?.ziel ?? "" });
  ok("B Erwartung des Vorschlags = Trockenprobe (für „Alle sicheren ausführen“)", !!vB?.erwartet && pB.zeile?.regel === vB.erwartet.regel && pB.zeile?.ziel === vB.erwartet.ziel && pB.zeile?.rateId === vB.erwartet.rateId, { v: vB?.erwartet, p: [pB.zeile?.regel, pB.zeile?.ziel, pB.zeile?.rateId] });
  const bB = await nach.bankeingangBuchen(eB.id, { wer: "Prüfstand", ziel: `${prB}-2`, erwartet: { regel: "rate", ziel: `${prB}-2`, rateId: r2B } });
  ok("B Rate 2 gebucht", bB.ok && bB.ergebnis?.gebucht === true, bB.error ?? bB.ergebnis?.grund);
  const rB = await raten(B.ref);
  ok("B Rate 2 bezahlt mit „Bankeingang <txn>“, Rate 3 neu", rB.some((r) => r.rate_nr === 2 && r.status === "bezahlt" && String(r.notiz).includes(`Bankeingang ${eB.txnId}`)) && rB.some((r) => r.rate_nr === 3 && r.status === "offen"), rB.map((r) => `${r.rate_nr}:${r.status}`));
  const vmB = await bis(() => sql`SELECT kind, amount_cents FROM fiaon_provision_vormerkung WHERE ref = ${`RATE-${r2B}`} OR (payment_reference = ${`${prB}-2`})` as Promise<any[]>, (v) => v.length >= 1, 6000);
  ok("B Provision nur vorgemerkt (Schalter AUS), nichts gebucht", vmB.length >= 1 && (await sql`SELECT COUNT(*)::int n FROM fiaon_commissions WHERE payment_reference = ${`${prB}-2`}`)[0].n === 0, vmB);

  // ── C: Überzahlung bis 1 € (Rate) ───────────────────────────────────────
  console.log("\nC  Überzahlung: 80,00 € auf 79,99 € (Rate, Ziel) bucht; 81,50 € nicht");
  const prC = `FIAON-${M}C1`;
  const Cc = await kunde("C", { pr: prC, cents: 7999, vorname: "Momo", nachname: "Quandtovic", rate1Am: tag(-35) });
  await eingang("c0", tag(-35), 7999, prC, "MOMO QUANDTOVIC", { applied: true, matchedRef: Cc.ref });
  const r2C = await rate(Cc.ref, 2, `${prC}-2`, 7999, tag(-3));
  const eC1 = await eingang("c1", heute, 8150, "Rate", "MOMO QUANDTOVIC");
  const pC1 = await nach.bankeingangTrockenprobe(eC1.id, { ziel: `${prC}-2` });
  ok("C 81,50 € → Betrag weicht ab, nicht buchbar", pC1.ok && pC1.zeile?.buchen === false && /weicht ab/.test(String(pC1.zeile?.ergebnis)), pC1.zeile?.ergebnis);
  const eC = await eingang("c", heute, 8000, "/ROC/BAT//FIAONQ277C1 2", "MOMO QUANDTOVIC");
  const pC = await nach.bankeingangTrockenprobe(eC.id, { ziel: `${prC}-2` });
  ok("C 80,00 € → würde buchen (Überzahlung 0.01 €)", pC.ok && pC.zeile?.buchen === true && /Überzahlung 0.01/.test(String(pC.zeile?.ergebnis)), pC.zeile?.ergebnis);
  const aC2 = await liveVerbuchen(eC.txnId, `${prC}-2`, 8000, heute, { trocken: true, ueberzahlungBisCents: 100 });
  ok("C Automatik (Referenz aus dem Zweck, kein Mensch) bleibt beim Ratenzweig centgenau", !aC2.gebucht && aC2.grund === "Betrag weicht ab", aC2.grund);
  const bC = await nach.bankeingangBuchen(eC.id, { wer: "Prüfstand", ziel: `${prC}-2`, erwartet: { regel: "rate", ziel: `${prC}-2`, rateId: r2C } });
  ok("C gebucht, Ratennotiz nennt die Überzahlung", bC.ok && bC.ergebnis?.gebucht === true && /Überzahlung 0.01/.test(String((await raten(Cc.ref)).find((r) => r.rate_nr === 2)?.notiz)), bC.ergebnis?.grund);

  // ── D: Unterzahlung — nie gebucht, Aufgabe ───────────────────────────────
  console.log("\nD  Unterzahlung: 93,03 € auf 99,99 € → Teilzahlung, nicht gebucht, Aufgabe an den Betreuer");
  const prD = `FIAON-${M}D1`;
  const D = await kunde("D", { pr: prD, cents: 9999, vorname: "Goekmen", nachname: "Quilmaz", status: "claimed_paid" });
  const eD = await eingang("d", heute, 9303, prD, "Gokmen Quilmaz und Aysegul Quilmaz");
  const pD0 = await nach.bankeingangTrockenprobe(eD.id, { mitVorschlag: true });
  ok("D ohne Ziel: Betrag weicht ab", pD0.zeile?.buchen === false && /weicht ab/.test(String(pD0.zeile?.ergebnis)), pD0.zeile?.ergebnis);
  ok("D Vorschlag: Teilzahlung → Aufgabe", pD0.zeile?.vorschlag?.art === "teilzahlung" && pD0.zeile.vorschlag.aktion === "aufgabe", pD0.zeile?.vorschlag);
  const pD = await nach.bankeingangTrockenprobe(eD.id, { ziel: prD });
  ok("D mit Ziel: „Teilzahlung … wird nicht gebucht“", pD.zeile?.buchen === false && /^Teilzahlung/.test(String(pD.zeile?.ergebnis)), pD.zeile?.ergebnis);
  const bD = await nach.bankeingangBuchen(eD.id, { wer: "Prüfstand", ziel: prD });
  ok("D Buchen → 409, Bestellung bleibt offen", !bD.ok && bD.status === 409 && (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${D.ref}`)[0].payment_status === "claimed_paid", bD.error);
  const aufD = await nach.bankeingangAufgabe(eD.id, { wer: "Prüfstand js@fiaon.com" });
  const [todoD] = await sql`SELECT titel, zustaendig_agent_id, status FROM fiaon_betreiber_todos WHERE schluessel = ${`bank-nachholen:teilzahlung:${eD.txnId}`}`;
  ok("D Aufgabe „Teilzahlung“ beim Betreuer", aufD.ok && !!todoD && /Teilzahlung/.test(String(todoD.titel)) && Number(todoD.zustaendig_agent_id) === AG.betreuer, todoD ?? aufD.error);
  const kD = await bank(eD.id);
  ok("D Eingang bleibt unverbucht, Vermerk „Aufgabe … angelegt“", kD.applied === false && /Aufgabe „Teilzahlung“ angelegt/.test(String(kD.note)), kD.note);
  const prD2 = `FIAON-${M}D2`;
  const D2 = await kunde("D2", { pr: prD2, cents: 5999, vorname: "Ida", nachname: "Quastler", rate1Am: tag(-35) });
  await eingang("d20", tag(-35), 5999, prD2, "IDA QUASTLER", { applied: true, matchedRef: D2.ref });
  await rate(D2.ref, 2, `${prD2}-2`, 5999, tag(-5));
  const eD2 = await eingang("d2", heute, 5900, "SXPYDEHH", "IDA QUASTLER");
  const pD2 = await nach.bankeingangTrockenprobe(eD2.id, { ziel: `${prD2}-2` });
  ok("D' Rate mit 59,00 € auf 59,99 € über Ziel → Teilzahlung, nicht gebucht", pD2.zeile?.buchen === false && /^Teilzahlung/.test(String(pD2.zeile?.ergebnis)), pD2.zeile?.ergebnis);

  // ── E: Schon bezahlt ─────────────────────────────────────────────────────
  console.log("\nE  Ziel ist schon bezahlt → abgewiesen");
  const pE = await nach.bankeingangTrockenprobe(eC1.id, { ziel: `${prC}-2` });
  ok("E Rate 2 (bezahlt) als Ziel → „Rate schon bezahlt“", pE.zeile?.buchen === false && pE.zeile?.ergebnis === "Rate schon bezahlt", pE.zeile?.ergebnis);
  const bE = await nach.bankeingangBuchen(eC1.id, { wer: "Prüfstand", ziel: `${prC}-2` });
  ok("E Buchen → 409, nichts doppelt", !bE.ok && bE.status === 409 && (await raten(Cc.ref)).filter((r) => r.rate_nr === 2 && r.status === "bezahlt").length === 1, bE.error);
  const pE2 = await nach.bankeingangTrockenprobe(eC1.id, { ziel: "FIAON-ZZZZZ" });
  ok("E kaputtes Ziel → 400", !pE2.ok && pE2.status === 400, pE2.error);

  // ── F: Nur zuordnen ──────────────────────────────────────────────────────
  console.log("\nF  Nur zuordnen: Startzahlung per mark-paid gebucht, Bankzeile ohne Haken");
  const prF = `FIAON-${M}F1`;
  const F = await kunde("F", { pr: prF, cents: 5999, vorname: "Christian", nachname: "Quammerhofer", rate1Am: tag(-31) });
  await rate(F.ref, 2, `${prF}-2`, 5999, tag(-1));
  const eF = await eingang("f", tag(-31), 5999, prF, "Christian Quammerhofer");
  const vF = await vorschlag(eF.id);
  ok("F Vorschlag: nur zuordnen Rate 1, sicher", vF?.art === "nur_zuordnen" && vF.aktion === "zuordnen" && vF.ziel === prF && vF.rateNr === 1 && vF.sicherheit === "sicher", vF);
  const zF0 = await nach.zuordnenPruefen(eF.id, prF);
  ok("F Prüfung: zuordenbar, schreibt nichts", zF0.ok && zF0.zeile?.zuordenbar === true && (await bank(eF.id)).applied === false, zF0.error ?? zF0.zeile?.ergebnis);
  const vorher = await raten(F.ref);
  const kommVorher = (await sql`SELECT COUNT(*)::int n FROM fiaon_commissions WHERE ref = ${F.ref}`)[0].n;
  const vmVorher = (await sql`SELECT COUNT(*)::int n FROM fiaon_provision_vormerkung WHERE ref = ${F.ref}`.catch(() => [{ n: 0 }]))[0].n;
  const zF = await nach.bankeingangZuordnen(eF.id, { ziel: prF, wer: "Prüfstand js@fiaon.com", erwartet: { ziel: prF, rateId: vorher[0].id } });
  ok("F zugeordnet", zF.ok, zF.error);
  const kF = await bank(eF.id);
  ok("F Bankbuch: applied + matched_ref + Vermerk", kF.applied === true && kF.matched_ref === F.ref && /Nur zugeordnet/.test(String(kF.note)), kF);
  const nachF = await raten(F.ref);
  ok("F Rate 1: Beleg in der Notiz, Status und Datum unverändert", String(nachF[0].notiz).includes(`Bankeingang ${eF.txnId} — nur zugeordnet`) && nachF[0].status === "bezahlt" && String(nachF[0].bezahlt_am) === String(vorher[0].bezahlt_am));
  ok("F keine neue Rate, Rate 2 weiter offen", nachF.length === vorher.length && nachF.find((r) => r.rate_nr === 2)?.status === "offen", nachF.map((r) => `${r.rate_nr}:${r.status}`));
  await warte(800);
  ok("F keine Provision, keine Vormerkung", (await sql`SELECT COUNT(*)::int n FROM fiaon_commissions WHERE ref = ${F.ref}`)[0].n === kommVorher
    && (await sql`SELECT COUNT(*)::int n FROM fiaon_provision_vormerkung WHERE ref = ${F.ref}`.catch(() => [{ n: 0 }]))[0].n === vmVorher);
  ok("F Satz in der Akte", (await sql`SELECT COUNT(*)::int n FROM fiaon_contact_log WHERE ref = ${F.ref} AND note LIKE ${`Bankeingang ${eF.txnId}%zugeordnet%`}`)[0].n === 1);
  const zF2 = await nach.bankeingangZuordnen(eF.id, { ziel: prF, wer: "Prüfstand" });
  ok("F zweiter Klick → 409 schon verbucht", !zF2.ok && zF2.status === 409 && /schon verbucht/.test(String(zF2.error)), zF2.error);
  const eF2 = await eingang("f2", tag(-30), 5999, prF, "Christian Quammerhofer");
  const zF3 = await nach.zuordnenPruefen(eF2.id, prF);
  ok("F zweite Zahlung gleichen Betrags → keine Zuordnung (Deckung: Doppelzahlung)", !zF3.ok && /schon gedeckt|Doppel/.test(String(zF3.error)), zF3.error);
  const zF4 = await nach.zuordnenPruefen(eF2.id, `${prF}-2`);
  ok("F offene Rate als Ziel → „nicht als bezahlt gebucht … So buchen“", !zF4.ok && /nicht als bezahlt gebucht/.test(String(zF4.error)), zF4.error);
  const vF2 = await vorschlag(eF2.id);
  ok("F zweite Zahlung: Vorschlag Doppel-/Überzahlung (Aufgabe), keine Zuordnung", vF2?.aktion !== "zuordnen" && (vF2?.art === "ueberzahlung" || vF2?.art === "rate"), vF2);

  // ── G: Doppelklick ───────────────────────────────────────────────────────
  console.log("\nG  Doppelklick: zwei gleichzeitige Buchungen desselben Eingangs, zwei gleichzeitige Zuordnungen");
  const prG = `FIAON-${M}G1`;
  const G = await kunde("G", { pr: prG, cents: 799, vorname: "Kerstin", nachname: "Quedel", rate1Am: tag(-32) });
  await eingang("g0", tag(-32), 799, prG, "Kerstin Quedel", { applied: true, matchedRef: G.ref });
  const r2G = await rate(G.ref, 2, `${prG}-2`, 799, tag(-2));
  const eG = await eingang("g", heute, 799, "Danke", "Kerstin Quedel");
  const [g1, g2] = await Promise.all([
    nach.bankeingangBuchen(eG.id, { wer: "Prüfstand 1", ziel: `${prG}-2`, erwartet: { regel: "rate", ziel: `${prG}-2`, rateId: r2G } }),
    nach.bankeingangBuchen(eG.id, { wer: "Prüfstand 2", ziel: `${prG}-2`, erwartet: { regel: "rate", ziel: `${prG}-2`, rateId: r2G } }),
  ]);
  const gebuchtG = [g1, g2].filter((g) => g.ok && g.ergebnis?.gebucht).length;
  ok("G genau EINE Buchung", gebuchtG === 1, [g1.error ?? g1.ergebnis?.grund, g2.error ?? g2.ergebnis?.grund]);
  const rG = await raten(G.ref);
  ok("G Rate 2 einmal bezahlt, genau eine Rate 3", rG.filter((r) => r.rate_nr === 2 && r.status === "bezahlt").length === 1 && rG.filter((r) => r.rate_nr === 3).length === 1, rG.map((r) => `${r.rate_nr}:${r.status}`));
  const prG2 = `FIAON-${M}G2`;
  const G2 = await kunde("G2", { pr: prG2, cents: 7400, vorname: "Balint", nachname: "Qudai", status: "paid" });
  const eG2 = await eingang("g2", heute, 7400, prG2, "Balint Qudai");
  const [z1, z2] = await Promise.all([
    nach.bankeingangZuordnen(eG2.id, { ziel: prG2, wer: "Prüfstand 1" }),
    nach.bankeingangZuordnen(eG2.id, { ziel: prG2, wer: "Prüfstand 2" }),
  ]);
  ok("G' Bestellung ohne Raten (Auskunft 74 €): genau EINE Zuordnung", [z1, z2].filter((z) => z.ok).length === 1, [z1.error ?? "ok", z2.error ?? "ok"]);
  ok("G' ein Satz in der Akte", (await sql`SELECT COUNT(*)::int n FROM fiaon_contact_log WHERE ref = ${G2.ref} AND note LIKE ${`Bankeingang ${eG2.txnId}%`}`)[0].n === 1);

  // ── H: Sammelzahlung ─────────────────────────────────────────────────────
  console.log("\nH  Sammelzahlung: „Fisimatenten-…“ 99,96 € + „…“ 1,00 € auf 99,99 €");
  const prH = `FIAON-${M}H1`;
  const H = await kunde("H", { pr: prH, cents: 9999, vorname: "Andrea", nachname: "Quöfer", status: "claimed_paid" });
  const eH1 = await eingang("h1", heute, 9996, `Fisimatenten-${M}H1`, "Andrea Quöfer");
  const eH2 = await eingang("h2", heute, 100, `${M}H1`, "Andrea Quofer");
  const vH1 = await vorschlag(eH1.id);
  const vH2 = await vorschlag(eH2.id);
  ok("H Vorschlag Haupt-Eingang: So buchen mit dazu = [Rest]", vH1?.aktion === "buchen" && vH1.ziel === prH && JSON.stringify(vH1.dazu) === JSON.stringify([eH2.id]), vH1);
  ok("H Vorschlag Rest-Eingang: kein eigener Knopf, „wird mit #… gebucht“", vH2?.aktion === null && new RegExp(`#${eH1.id}`).test(String(vH2?.text)), vH2);
  const fremd = await eingang("h3", heute, 100, "Danke", "Jemand Anderes");
  const pHf = await nach.bankeingangTrockenprobe(eH1.id, { ziel: prH, dazu: [fremd.id] });
  ok("H fremder Zahler in der Sammelzahlung → 409", !pHf.ok && pHf.status === 409 && /anderen Zahler/.test(String(pHf.error)), pHf.error);
  const pH = await nach.bankeingangTrockenprobe(eH1.id, { ziel: prH, dazu: [eH2.id] });
  ok("H Trockenprobe Summe 100,96 €, würde buchen (Überzahlung 0.97 €)", pH.ok && pH.zeile?.summeCents === 10096 && pH.zeile.buchen && /Überzahlung 0.97/.test(String(pH.zeile.ergebnis)), pH.zeile?.ergebnis);
  const bH = await nach.bankeingangBuchen(eH1.id, { wer: "Prüfstand", ziel: prH, dazu: [eH2.id], erwartet: { regel: "erstzahlung", ziel: prH, rateId: null } });
  ok("H gebucht", bH.ok && bH.ergebnis?.gebucht === true, bH.error ?? bH.ergebnis?.grund);
  const kH2 = await bank(eH2.id);
  ok("H Rest-Eingang verbucht, derselben Bestellung zugeordnet, Vermerk", kH2.applied === true && kH2.matched_ref === H.ref && /Teil der Sammelzahlung/.test(String(kH2.note)), kH2);
  ok("H Bestellung bezahlt (einmal)", (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${H.ref}`)[0].payment_status === "paid");
  const bH2 = await nach.bankeingangBuchen(eH2.id, { wer: "Prüfstand", ziel: prH });
  ok("H Rest-Eingang allein nochmal → 409 schon verbucht", !bH2.ok && bH2.status === 409, bH2.error);

  // ── I: Abgelaufene Bestellung ────────────────────────────────────────────
  console.log("\nI  Bestellung „expired“, Kunde zahlt: Automatik nicht, mit Ziel ja");
  const prI = `FIAON-${M}I1`;
  const I = await kunde("I", { pr: prI, cents: 799, vorname: "Dalibor", nachname: "Quantonic", status: "expired" });
  const eI = await eingang("i", heute, 799, prI, "Dalibor Quantonic");
  const aI = await liveVerbuchen(eI.txnId, prI, 799, heute, { trocken: true });
  ok("I Automatik: „Status expired“", !aI.gebucht && aI.grund === "Status expired", aI.grund);
  const vI = await vorschlag(eI.id);
  ok("I Vorschlag: Erstzahlung, Hinweis abgelaufen", vI?.art === "erstzahlung" && vI.aktion === "buchen" && vI.hinweise.some((h) => /abgelaufen/.test(h)), vI);
  const bI = await nach.bankeingangBuchen(eI.id, { wer: "Prüfstand", ziel: prI, erwartet: { regel: "erstzahlung", ziel: prI, rateId: null } });
  ok("I mit Ziel gebucht, Bestellung paid", bI.ok && bI.ergebnis?.gebucht && (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${I.ref}`)[0].payment_status === "paid", bI.error ?? bI.ergebnis?.grund);

  // ── J: Eingang steht schon in der Rate („verbraucht“), nur der Haken fehlt ─
  console.log("\nJ  Ratennotiz nennt den Eingang schon → nur zuordnen, Notiz nicht doppelt");
  const prJ = `FIAON-${M}J1`;
  const J = await kunde("J", { pr: prJ, cents: 7999, vorname: "Renate", nachname: "Quomberg", rate1Am: tag(-48) });
  await eingang("j0", tag(-48), 7999, prJ, "Renate Quomberg", { applied: true, matchedRef: J.ref });
  const eJ = await eingang("j", tag(-31), 7999, prJ, "Renate Quomberg");
  const r2J = await rate(J.ref, 2, `${prJ}-2`, 7999, tag(-31), true, `Bankeingang ${eJ.txnId} (Auszug 01.09.)`);
  const vJ = await vorschlag(eJ.id);
  ok("J Vorschlag: nur zuordnen Rate 2, sicher", vJ?.art === "nur_zuordnen" && vJ.ziel === `${prJ}-2` && vJ.rateId === r2J && vJ.sicherheit === "sicher", vJ);
  const zJ = await nach.bankeingangZuordnen(eJ.id, { ziel: `${prJ}-2`, wer: "Prüfstand", erwartet: { ziel: `${prJ}-2`, rateId: r2J } });
  const nJ = (await raten(J.ref)).find((r) => r.rate_nr === 2);
  ok("J zugeordnet, „Bankeingang“ steht genau einmal in der Notiz", zJ.ok && String(nJ?.notiz).split(`Bankeingang ${eJ.txnId}`).length === 2, zJ.error ?? nJ?.notiz);

  // ── K: Zwei Eingänge, eine Rate ohne Beleg (Fall Pettauer 28.08./02.10.) ─
  console.log("\nK  Startzahlung ohne Beleg + zwei Eingänge: der passende nimmt Rate 1, der spätere Rate 2");
  const prK = `FIAON-${M}K1`;
  const Kk = await kunde("K", { pr: prK, cents: 5999, vorname: "Marcel", nachname: "Quettauer", rate1Am: tag(-35) });
  const r2K = await rate(Kk.ref, 2, `${prK}-2`, 5999, tag(-4));
  const eK1 = await eingang("k1", tag(-35), 5999, prK, "MARCEL QUETTAUER");
  const eK2 = await eingang("k2", heute, 5999, `${M}K1-2`, "MARCEL QUETTAUER");
  const kK = await kontext();
  const tK1 = (await nach.bankeingangTrockenprobe(eK1.id, {})).zeile!;
  const tK2 = (await nach.bankeingangTrockenprobe(eK2.id, {})).zeile!;
  const vK1 = await nach.vorschlagErmitteln(tK1, kK);
  const vK2 = await nach.vorschlagErmitteln(tK2, kK);
  ok("K früher Eingang: nur zuordnen Rate 1", vK1?.art === "nur_zuordnen" && vK1.rateNr === 1, vK1);
  ok("K späterer Eingang „…-2“: Rate 2 buchen", vK2?.art === "rate" && vK2.rateId === r2K && vK2.aktion === "buchen", vK2);

  // ── L: Tippfehler in der Referenz ────────────────────────────────────────
  console.log("\nL  Referenz mit Tippfehler „FIAON Q277L5“ statt Q277LS, anderer Zahlername");
  const prL = `FIAON${M}LS`;
  const L = await kunde("L", { pr: prL, cents: 5999, vorname: "Angelika", nachname: "Quaud" });
  const eL = await eingang("l", heute, 6000, `/RFS/FIAON ${M}L5`, "Hans Fremdzahler");
  const vL = await vorschlag(eL.id);
  ok("L Vorschlag: Erstzahlung der Bestellung mit ähnlicher Referenz", vL?.art === "erstzahlung" && vL.ziel === prL && (vL.gruende || []).some((g) => /Tippfehler/.test(g)), vL);
  void L;

  // ── M: Belegnotiz nennt den Absender (Fall Paul Furter) ──────────────────
  console.log("\nM  Fremder Zahler, Belegnotiz des Betreuers nennt ihn → nur zuordnen");
  const prMm = `FIAON-${M}M1`;
  const Mm = await kunde("M", { pr: prMm, cents: 5999, vorname: "Beate", nachname: "Quetz", rate1Am: tag(-36), belegNotiz: "Hat von einem anderen Konto überwiesen. (Paul Qurter)", belegTag: tag(-36) });
  await rate(Mm.ref, 2, `${prMm}-2`, 5999, tag(-6));
  const eM = await eingang("m", tag(-36), 6000, "Received money from Paul Qurter with reference", "Paul Qurter");
  const vM = await vorschlag(eM.id);
  ok("M Vorschlag: nur zuordnen Rate 1, Grund „Zahlungsbeleg nennt den Absender“, sicher", vM?.art === "nur_zuordnen" && vM.rateNr === 1 && (vM.gruende || []).some((g) => /Zahlungsbeleg nennt/.test(g)) && vM.sicherheit === "sicher", vM);

  // ── O: Rest einer Rate (79,90 € + 0,09 €) ────────────────────────────────
  console.log("\nO  79,90 € (Regel B bucht) + 0,09 € Rest → erst buchen, dann nur zuordnen");
  const prO = `FIAON-${M}O1`;
  const O = await kunde("O", { pr: prO, cents: 7999, vorname: "Mario", nachname: "Quubert", rate1Am: tag(-33) });
  await eingang("o0", tag(-33), 7999, prO, "Mario Quubert", { applied: true, matchedRef: O.ref });
  const r2O = await rate(O.ref, 2, `${prO}-2`, 7999, tag(-2));
  const eO1 = await eingang("o1", heute, 7990, prO, "Mario Quubert");
  const eO2 = await eingang("o2", heute, 9, `${prO} SecureGo plus`, "Mario Quubert");
  const listeO = await nach.nachholListe({ ids: [eO1.id, eO2.id] });
  const lO1 = listeO.find((z) => z.id === eO1.id);
  const lO2 = listeO.find((z) => z.id === eO2.id);
  ok("O 79,90 € buchbar (Regel B, −0,09 €), Vorschlag ohne Ziel", lO1?.buchen === true && lO1.vorschlag?.aktion === "buchen" && lO1.vorschlag.mitZiel === false, lO1?.ergebnis);
  ok("O 0,09 € vorher: „Rest zu Eingang … erst buchen“, kein Knopf", lO2?.vorschlag?.aktion === null && /Rest zu Eingang/.test(String(lO2?.vorschlag?.text)), lO2?.vorschlag);
  const bO = await nach.bankeingangBuchen(eO1.id, { wer: "Prüfstand", erwartet: { regel: "regel_b", ziel: `${prO}-2`, rateId: r2O } });
  ok("O 79,90 € gebucht", bO.ok && bO.ergebnis?.gebucht === true, bO.error ?? bO.ergebnis?.grund);
  const vO2 = await vorschlag(eO2.id);
  ok("O 0,09 € danach: nur zuordnen Rate 2 (Rest)", vO2?.art === "nur_zuordnen" && vO2.aktion === "zuordnen" && vO2.rateId === r2O, vO2);
  const zO = await nach.bankeingangZuordnen(eO2.id, { ziel: `${prO}-2`, wer: "Prüfstand" });
  ok("O 0,09 € zugeordnet", zO.ok, zO.error);

  // ── P: Erwartung weicht ab ───────────────────────────────────────────────
  console.log("\nP  Erwartung weicht vom Stand ab → 409, nichts gebucht");
  const prP = `FIAON-${M}P1`;
  const P = await kunde("P", { pr: prP, cents: 5999, vorname: "Ulrike", nachname: "Quelberherr" });
  const eP = await eingang("p", heute, 5999, "Gesendet", "Ulrike Quelberherr");
  const bP = await nach.bankeingangBuchen(eP.id, { wer: "Prüfstand", ziel: prP, erwartet: { regel: "rate", ziel: prP, rateId: 1 } });
  ok("P 409, Bestellung bleibt offen", !bP.ok && bP.status === 409 && (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${P.ref}`)[0].payment_status === "pending_payment", bP.error);
  const zP = await nach.bankeingangZuordnen(eP.id, { ziel: prP, wer: "Prüfstand" });
  ok("P „Nur zuordnen“ auf unbezahlte Bestellung → abgewiesen", !zP.ok && /nicht als bezahlt gebucht/.test(String(zP.error)), zP.error);

  // ── Q: Stornierte Bestellung, Geld kam → Rückzahlung ─────────────────────
  console.log("\nQ  Stornierte Bestellung ohne bezahlte Rate → Rückzahlung nötig (Aufgabe an die Zahlungsstelle)");
  const prQ = `FIAON-${M}Q1`;
  const Q = await kunde("Q", { pr: prQ, cents: 9999, vorname: "Daniela", nachname: "Quobiban", status: "cancelled" });
  const eQ = await eingang("q", heute, 10000, `Circul Bank Sa-${prQ}`, "DANIELA QUOBIBAN");
  const vQ = await vorschlag(eQ.id);
  ok("Q Vorschlag: Rückzahlung nötig → Aufgabe", vQ?.art === "rueckzahlung_noetig" && vQ.aktion === "aufgabe", vQ);
  const aQ = await nach.bankeingangAufgabe(eQ.id, { wer: "Prüfstand" });
  const [tQ] = await sql`SELECT zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel = ${`bank-nachholen:rueckzahlung_noetig:${eQ.txnId}`}`;
  ok("Q Aufgabe bei der Zahlungsstelle (kein Betreuer)", aQ.ok && !!tQ && tQ.zustaendig_agent_id == null, tQ ?? aQ.error);
  void Q;

  // ── R: Rate mit bis 1 € zu wenig → Regel B über die Bestellreferenz ──────
  console.log("\nR  99,00 € auf eine Rate über 99,99 € → Vorschlag über Regel B (±1 €), Erwartung passt zur Trockenprobe");
  const prR = `FIAON-${M}R1`;
  const Rr = await kunde("R", { pr: prR, cents: 9999, vorname: "Idris", nachname: "Quaslah", rate1Am: tag(-33) });
  await eingang("r0", tag(-33), 9999, prR, "IDRIS QUASLAH", { applied: true, matchedRef: Rr.ref });
  const r2R = await rate(Rr.ref, 2, `${prR}-2`, 9999, tag(-3));
  const eR = await eingang("r", heute, 9900, "SXPYDEHH", "Idris Quaslah");
  const vR = await vorschlag(eR.id);
  ok("R Vorschlag: Rate 2, Ziel = Bestellreferenz, Erwartung regel_b + Rate 2", vR?.art === "rate" && vR.aktion === "buchen" && vR.ziel === prR
    && vR.erwartet?.regel === "regel_b" && vR.erwartet.ziel === `${prR}-2` && vR.erwartet.rateId === r2R, vR);
  const pR = await nach.bankeingangTrockenprobe(eR.id, { ziel: prR });
  ok("R Trockenprobe sagt genau, was der Vorschlag erwartet", pR.zeile?.buchen === true && pR.zeile.regel === "regel_b" && pR.zeile.ziel === vR?.erwartet?.ziel && pR.zeile.rateId === vR?.erwartet?.rateId, pR.zeile?.ergebnis);
  const bR = await nach.bankeingangBuchen(eR.id, { wer: "Prüfstand", ziel: prR, erwartet: vR?.erwartet ?? null });
  ok("R gebucht, Ratennotiz nennt die Abweichung −0,99 €", bR.ok && bR.ergebnis?.gebucht && /Abweichung -0.99/.test(String((await raten(Rr.ref)).find((r) => r.rate_nr === 2)?.notiz)), bR.error ?? bR.ergebnis?.grund);
  const pB2 = await nach.bankeingangTrockenprobe(eA.id, { ziel: prA });
  ok("R' Erstzahlung bleibt ohne Unter-Toleranz (verbuchter Eingang → 409)", !pB2.ok && pB2.status === 409, pB2.error);

  // ── T: Falsche Referenz derselben Person (Fall Topirceanu 08.09.) ────────
  console.log("\nT  Zweck nennt die bezahlte Auskunft, das Geld passt zur am selben Tag gebuchten Rate derselben Person");
  const prT1 = `FIAON-${M}T1`;
  const prT2 = `FIAON-${M}T2`;
  const T1 = await kunde("T1", { pr: prT1, cents: 7400, vorname: "Florin", nachname: "Quopirceanu", status: "paid" });
  const [pT] = await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${T1.ref}`;
  await eingang("t0", tag(-4), 7400, prT1, "Quopirceanu Florin", { applied: true, matchedRef: T1.ref });
  const refT2 = `FIAON-${M}T2-TEST`;
  await sql`INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, amount_due, email, first_name, last_name, person_id, assigned_agent_id, completed_at)
            VALUES (${refT2}, ${prT2}, 'paid', 'payment_completed', 'private', 'highend', 99.99, 'kunde-t2@q277.invalid', 'Florin', 'Quopirceanu', ${pT.person_id}, ${AG.betreuer}, ${`${tag(-35)}T12:00:00Z`})`;
  await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz) VALUES (${refT2}, 1, ${prT2}, 9999, ${tag(-35)}, 'bezahlt', ${`${tag(-35)}T12:00:00Z`}, 'auto', 'Startzahlung')`;
  await eingang("t1", tag(-35), 10000, "Einzahlung", "Quopirceanu Florin", { applied: true, matchedRef: refT2 });
  const r2T = await rate(refT2, 2, `${prT2}-2`, 9999, tag(0), true, "Fälligkeit korrigiert · Bankeingang TRANSFER-99 · Rueckbuchung 27.08.2026: Der Bankeingang war bereits für die Paketzahlung verbraucht");
  const eT = await eingang("t", heute, 10000, prT1, "Topirceanu Florin");
  await sql`UPDATE fiaon_bank_txns SET payer_name = 'Quopirceanu Florin' WHERE id = ${eT.id}`;
  const vT = await vorschlag(eT.id);
  ok("T Vorschlag: nur zuordnen Rate 2 der anderen Bestellung, wahrscheinlich, Hinweis auf den Zweck", vT?.art === "nur_zuordnen" && vT.rateId === r2T && vT.sicherheit === "wahrscheinlich" && vT.hinweise.some((h) => /Der Zweck nennt/.test(h)), vT);
  ok("T Rückbuchungs-Verweis in der Notiz zählt nicht als Beleg", nach.belegeAusNotiz("a · Bankeingang TRANSFER-1 · Rueckbuchung 27.08.2026: x · Bankeingang AWX-2 — y").join(",") === "AWX-2");

  // ── S: Unbekanntes Geld ──────────────────────────────────────────────────
  console.log("\nS  Kartenumsatz ohne Namen → kein Vorschlag, bleibt mit Grund stehen");
  const eS = await eingang("s", heute, 136684, "Card transaction of 1,366.84 EUR issued by Vienna Airport Wien", "");
  const vS = await vorschlag(eS.id);
  ok("S unbekannt, unklar, kein Knopf", vS?.art === "unbekannt" && vS.sicherheit === "unklar" && vS.aktion === null, vS);

  console.log(`\nNetzaufrufe abgeklemmt: ${blockiert}`);
  await aufraeumen();
  const [rest] = await sql`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`})::int
         + (SELECT COUNT(*) FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`})::int
         + (SELECT COUNT(*) FROM fiaon_commissions WHERE agent_id IN (${AG.betreuer}, ${AG.werber}))::int AS n`;
  ok("Aufgeräumt", rest.n === 0, rest.n);
  console.log(fehler === 0 ? "\nAlles grün." : `\n${fehler} Prüfung(en) ROT.`);
  await sql.end();
  process.exit(fehler === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error("FEHLER:", e?.stack || e); await sql.end().catch(() => {}); process.exit(1); });
