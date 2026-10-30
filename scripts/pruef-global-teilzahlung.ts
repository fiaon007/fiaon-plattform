// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-469 (30.10.2026): Teilzahlungen auf FIAON-Global-Rechnungen.
//
// NUR gegen das lokale Postgres 127.0.0.1:54329 (eigene Kopie, Schema wie Produktion):
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_wo fiaon_pruefstand_e469
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null CRONS=aus \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e469 node_modules/.bin/tsx scripts/pruef-global-teilzahlung.ts
//
// Fährt den ECHTEN Code (fiaon-teilzahlung → alsBezahltBuchen; liveVerbuchen; Zahlungsauftrag; Umsatz-Quelle; Mail-Nutzlast)
// mit erfundenen Datensätzen (Marke Q469, Adressen *.invalid). Jeder Netzaufruf und jeder Mailweg ist abgeklemmt.
//   A  Individualangebot 3.900 €: 1.500 € (Tippfehler im Zweck) → Vorschlag „Teilzahlung“, gebucht, offen 2.400 €
//      · Zahlungsseite/GiroCode nur Rest · Mail nennt Rest + Frist · Rechnung trägt die Teilzahlung · Chefbüro-Ziele
//      · derselbe Eingang zweimal → abgewiesen (Code UND Datenbank) · Überzahlung → Aufgabe, nichts gebucht
//      · Automatik: falscher Rest bucht nicht, voller Betrag bucht nicht · Rest 2.400 € (Referenz im Zweck) → genau einmal bezahlt
//      · Umsatz zählt genau 3.900 € (2 Zeilen am Eingangstag, Abschluss auf der letzten), nie die Bestellung dazu
//   B  Global-Paket mit Akte: 2.000 + 2.999 € über das Chefbüro → normaler Start genau einmal, Abschluss nachholen idempotent
//   K  Partner-Provision: Fast-Track-Abzug wirkt über zwei Teile genau einmal
//   M  Keine Mail an echte Adressen (Versand abgeklemmt)
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";

const URL = String(process.env.DATABASE_URL || "");
if (!/@127\.0\.0\.1:54329\/fiaon_pruefstand_/.test(URL)) throw new Error("Nur gegen den lokalen Prüfstand 127.0.0.1:54329/fiaon_pruefstand_…!");
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "META_CAPI_TOKEN", "AIRWALLEX_API_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];

const sql = postgres(URL, { ssl: "require", max: 2, onnotice: () => {} });
const M = "Q469";
const AG = 99469;

let blockiert = 0;
globalThis.fetch = (async (url: any) => { blockiert++; return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 }); }) as any;
// „Als bezahlt markiert“ zählen — der normale Bezahlt-Weg darf je Rechnung genau einmal laufen.
const bezahltLog: string[] = [];
const logOrig = console.log.bind(console);
console.log = (...a: unknown[]) => { const t = a.map(String).join(" "); if (t.includes("[FIAON-PAYMENT] Als bezahlt markiert:")) bezahltLog.push(t); logOrig(...a); };

let fehler = 0;
const ok = (name: string, bed: boolean, info: unknown = "") => {
  if (!bed) fehler++;
  logOrig(`${bed ? "  ok  " : "  ROT "} ${name}${info !== "" ? `  — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
};
const tag = (versatz: number) => new Date(Date.now() + versatz * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function bis<T>(frage: () => Promise<T>, fertig: (x: T) => boolean, ms = 12_000): Promise<T> {
  const ende = Date.now() + ms;
  let x = await frage();
  while (!fertig(x) && Date.now() < ende) { await warte(250); x = await frage(); }
  return x;
}

async function aufraeumen() {
  const refs = (await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`).map((r: any) => r.ref);
  await sql`DELETE FROM fiaon_teilzahlungen WHERE ref = ANY(${refs})`.catch(() => {});
  if (refs.length) {
    await sql`DELETE FROM fiaon_provision_vormerkung WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_global_verlauf WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_global_auftraege WHERE ref = ANY(${refs})`.catch(() => {});
  }
  await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`;
  const todos = (await sql`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`%awx-${M.toLowerCase()}-%`} OR schluessel LIKE ${`%FIAON-${M}%`} OR link LIKE ${`%${M}%`}`.catch(() => [])).map((r: any) => Number(r.id));
  if (todos.length) {
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${todos})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todos})`.catch(() => {});
  }
  const personen = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PRUEF-${M}-%`}`).map((r: any) => Number(r.id));
  await sql`DELETE FROM fiaon_mail_log WHERE empfaenger LIKE ${`%@${M.toLowerCase()}.invalid`}`.catch(() => {});
  if (personen.length) await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`;
  if (personen.length) {
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
  }
  const ang = (await sql`SELECT id FROM fiaon_global_angebote WHERE angebot_ref LIKE ${`IA-${M}-%`}`.catch(() => [])).map((r: any) => Number(r.id));
  if (ang.length) {
    await sql`DELETE FROM fiaon_global_angebot_teile WHERE angebot_id = ANY(${ang})`;
    await sql`DELETE FROM fiaon_global_angebote WHERE id = ANY(${ang})`;
  }
  await sql`DELETE FROM fiaon_agents WHERE id = ${AG}`;
}

async function kunde(x: string, o: { pr: string; cents: number; pack: string; vorname: string; nachname: string; faellig: string }) {
  const ref = `FIAON-${M}${x}XXX-TEST`;
  const [p] = await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id)
    VALUES (${`PRUEF-${M}-${x}`}, ${o.vorname}, ${o.nachname}, ${`kunde-${x.toLowerCase()}@${M.toLowerCase()}.invalid`}, ${AG}) RETURNING id`;
  if (o.pack === "global_individuell") {
    // Ein Individualangebot misst sich am angenommenen Teil (Datenbank-Wand fiaon_katalogpreis_wand) — also erst Angebot und Teil.
    const [g] = await sql`
      INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, status, gueltig_bis, auftrag_ref)
      VALUES (${`IA-${M}-${x}`}, 'IA-2026-10-01-KG', ${sql.json({ vorname: o.vorname, nachname: o.nachname, email: `kunde-${x.toLowerCase()}@${M.toLowerCase()}.invalid` })},
              ${sql.json({})}, ${sql.json({ name: "Prüf Bürgin" })}, 'angenommen', ${tag(30)}, ${ref}) RETURNING id`;
    await sql`INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, bestell_ref)
              VALUES (${g.id}, 1, 'Gründung', ${o.cents}, 'sofort', 0, ${ref})`;
  }
  await sql`
    INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, invoice_number,
                                    email, first_name, last_name, company_name, person_id, assigned_agent_id, created_at, payment_due_date)
    VALUES (${ref}, ${o.pr}, 'pending_payment', 'submitted', 'business', ${o.pack}, ${`FIAON Global – Prüf ${x}, Teil 1: Gründung`}, ${o.cents / 100},
            ${`FIAON-INV-${M}-${x}`}, ${`kunde-${x.toLowerCase()}@${M.toLowerCase()}.invalid`}, ${o.vorname}, ${o.nachname}, ${`Prüf ${x} GmbH`},
            ${p.id}, ${AG}, NOW() - INTERVAL '20 days', (${o.faellig}::date + INTERVAL '1 day' - INTERVAL '1 second') AT TIME ZONE 'Europe/Berlin')`;
  return { ref, personId: Number(p.id) };
}
const eingang = async (x: string, datum: string, cents: number, zweck: string, zahler: string) => {
  const txnId = `AWX-${M.toLowerCase()}-${x}`;
  const [r] = await sql`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, match_status, applied, note)
    VALUES (${txnId}, ${`${datum}T00:00:00Z`}, ${cents}, 'EUR', ${zahler}, ${zweck}, NULL, 'unmatched', FALSE, 'Prüfstand E-469')
    RETURNING id`;
  return { id: Number(r.id), txnId };
};
const bank = async (id: number) => (await sql`SELECT applied, matched_ref, match_status, note FROM fiaon_bank_txns WHERE id = ${id}`)[0] as any;
const app = async (ref: string) => (await sql`SELECT payment_status, status, paid_at, completed_at FROM fiaon_applications WHERE ref = ${ref}`)[0] as any;

async function main() {
  const T = await import("../server/lib/fiaon-teilzahlung");
  await T.ensureTeilzahlungen();
  await aufraeumen();
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp) VALUES (${AG}, 'Prüf Betreuer E469', 'betreuer@q469.invalid', TRUE, 2500)`;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('provision_automatik', 'aus') ON CONFLICT (key) DO UPDATE SET value = 'aus'`;
  const nach = await import("../server/lib/fiaon-bank-nachholen");
  const { liveVerbuchen } = await import("../server/routes/fiaon-wise");
  const { zahlungsauftragFinden, zahlungsauftragQrNutzlast } = await import("../server/lib/fiaon-zahlungsauftrag");
  const { UMSATZ_QUELLE_SQL } = await import("../server/lib/fiaon-umsatz-quelle");
  const GA = await import("../server/lib/fiaon-global-auftrag");
  const { mailRendern } = await import("../server/mail/motor");
  const faellig = tag(7);
  const tagDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const umsatz = async (ref: string) => (await sql.unsafe(`WITH q AS (${UMSATZ_QUELLE_SQL}) SELECT cents, art, erste, teil_vorher_cents, to_char(am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag FROM q WHERE ref = $1 ORDER BY am`, [ref])) as any[];

  // ═══ A ═════════════════════════════════════════════════════════════════════
  logOrig("\nA  Individualangebot 3.900 €: Teilzahlung 1.500 € mit Tippfehler im Zweck");
  const prA = `FIAON-${M}A1`;
  const A = await kunde("A", { pr: prA, cents: 390000, pack: "global_individuell", vorname: "Edith", nachname: "Quarzhuber", faellig });
  const e1 = await eingang("a1", tag(-2), 150000, `FIAON-${M}A7 Gruendung`, "EDITH QUARZHUBER");
  const auto1 = await liveVerbuchen(e1.txnId, `FIAON-${M}A7`, 150000, tag(-2), {});
  ok("A Automatik bucht den Tippfehler nicht", auto1.gebucht === false, auto1.grund);
  const v1 = (await nach.bankeingangTrockenprobe(e1.id, { mitVorschlag: true })).zeile?.vorschlag;
  ok("A Vorschlag: Teilzahlung, Knopf „Als Teilzahlung“, Ziel = Verwendungszweck", v1?.art === "teilzahlung" && v1.aktion === "teilzahlung" && v1.ziel === prA && v1.mitZiel, v1);
  const ziele0 = await nach.zubuchenZiele(A.personId);
  ok("A Chefbüro-Ziele: Rechnung „teilzahlbar“", ziele0.ziele.some((z) => z.ziel === prA && z.teilzahlbar === true && z.aktion === "buchen"), ziele0.ziele);
  const p1 = await T.teilzahlungPruefen(e1.id, A.ref);
  const t1 = p1.zeile?.teilzahlung;
  ok("A Prüfung über die Bestellnummer: buchbar, bisher 0, offen 2.400 €, kein Abschluss", p1.ok && p1.zeile?.buchen === true && t1?.bisherCents === 0 && t1?.offenCents === 240000 && !t1.abschluss && !t1.ueberzahlung, p1.zeile?.ergebnis);
  ok("A Prüfung schreibt nichts", (await bank(e1.id)).applied === false && (await T.teilSummeCents(A.ref)) === 0);
  const b1 = await T.teilzahlungBuchen(e1.id, { ziel: prA, wer: "Prüfstand", erwartet: { ziel: prA, bisherCents: 0 } });
  ok("A Teilzahlung gebucht", b1.ok && b1.abschluss === false, b1.error ?? b1.zeile?.ergebnis);
  const k1 = await bank(e1.id);
  ok("A Bankbuch: applied, matched_ref = Bestellung, Vermerk", k1.applied === true && k1.matched_ref === A.ref && k1.match_status === "matched" && /Teilzahlung/.test(k1.note), k1);
  const a1 = await app(A.ref);
  ok("A Bestellung bleibt offen (pending_payment), nicht bezahlt", a1.payment_status === "pending_payment" && !a1.paid_at, a1);
  ok("A Summe der Teilzahlungen = 1.500 €", (await T.teilSummeCents(A.ref)) === 150000);

  logOrig("\nA  Anzeige: Zahlungsseite, GiroCode, Mail, Rechnung, Chefbüro");
  const z1 = await zahlungsauftragFinden(prA);
  ok("A Zahlungsseite: Betrag = Rest 2.400,00", z1?.amountDue === "2400.00" && z1?.status === "pending_payment", z1?.amountDue);
  ok("A Zahlungsseite: Rechnungsbetrag / bezahlt / offen", z1?.teilzahlung?.rechnungsbetrag === "3900.00" && z1.teilzahlung.bezahlt === "1500.00" && z1.teilzahlung.offen === "2400.00", z1?.teilzahlung);
  const qr = z1 ? zahlungsauftragQrNutzlast(z1) : "";
  ok("A GiroCode trägt den Rest (EUR2400.00), nicht 3900", /EUR2400\.00/.test(qr) && !/EUR3900/.test(qr), qr.split("\n").find((l) => l.startsWith("EUR")));
  const bA = await GA.globalBestellungLesen(A.ref);
  ok("A Bestellung lesen: teil_bezahlt_cents = 150000", Number(bA?.teil_bezahlt_cents) === 150000, bA?.teil_bezahlt_cents);
  const nutz = GA.globalMailNutzlast({ ref: A.ref, paket_key: "global_individuell", email: `kunde-a@${M.toLowerCase()}.invalid` }, bA, { ansprechpartner: "Prüf", token: "x" });
  ok("A Mail-Nutzlast: Betrag = Rest, Label „Noch offen“", nutz.betrag_text === "2.400,00 €" && nutz.betrag_label === "Noch offen", [nutz.betrag_text, nutz.betrag_label]);
  ok("A Mail-Nutzlast: Satz nennt Teilzahlung, Rest und Frist", /1\.500,00 €/.test(nutz.zahlung_stand_satz) && /2\.400,00 €/.test(nutz.zahlung_stand_satz) && nutz.zahlung_stand_satz.includes(tagDe(faellig)), nutz.zahlung_stand_satz);
  const mail = mailRendern("global_zahlung_erinnerung", { ...nutz, anlass: "Prüf." });
  ok("A Erinnerungsmail: Rest drin, voller Betrag nicht, kein „nicht verbucht“", !!mail && mail.html.includes("2.400,00 €") && !mail.html.includes("3.900,00 €") && !/nicht verbucht/.test(mail.html) && !mail.fehlend.includes("betrag_label"), mail?.fehlend);
  const nutz0 = GA.globalMailNutzlast({ ref: A.ref, paket_key: "global_individuell" }, { ...bA, teil_bezahlt_cents: 0 }, { ansprechpartner: "Prüf" });
  ok("A ohne Teilzahlung: wie bisher (voller Betrag, „Betrag, einmalig“, „nicht verbucht“)", nutz0.betrag_text === "3.900,00 €" && nutz0.betrag_label === "Betrag, einmalig" && /nicht verbucht/.test(nutz0.zahlung_stand_satz));
  const zeile: any = { ref: A.ref, pack_key: "global_individuell", payment_status: "pending_payment" };
  await T.rechnungTeilzahlungenSetzen(zeile);
  ok("A Rechnung (PDF-Zeile): Teilzahlung angehängt", zeile.teil_bezahlt_cents === 150000 && zeile.teilzahlungen?.length === 1, zeile.teil_bezahlt_cents);
  const { rechnungAlsPdf } = await import("../server/lib/fiaon-rechnung-pdf");
  const pdf = await rechnungAlsPdf(prA).catch((e: unknown) => { logOrig(String(e)); return null; });
  ok("A Rechnungs-PDF lässt sich zeichnen", !!pdf && pdf.pdf.length > 1000, pdf?.pdf.length);
  const ziele1 = await nach.zubuchenZiele(A.personId);
  const zz = ziele1.ziele.find((z) => z.ziel === prA);
  ok("A Chefbüro-Ziele: Teilzahlung 1.500 €, offen 2.400 €", zz?.teilBezahltCents === 150000 && zz?.offenCents === 240000, zz);

  logOrig("\nA  Doppelt, Überzahlung, Automatik mit falschem Betrag");
  const d1 = await T.teilzahlungPruefen(e1.id, prA);
  ok("A derselbe Eingang nochmal (Prüfung) → abgewiesen", !d1.ok && /schon verbucht/.test(String(d1.error)), d1.error);
  const d2 = await T.teilzahlungBuchen(e1.id, { ziel: prA, wer: "Prüfstand" });
  ok("A derselbe Eingang nochmal (Buchung) → abgewiesen", !d2.ok, d2.error);
  const dbDoppelt = await sql`INSERT INTO fiaon_teilzahlungen (ref, bank_txn_id, txn_id, betrag_cents, eingang_am, soll_cents, summe_nachher_cents, gebucht_von)
                             VALUES (${A.ref}, ${e1.id}, ${e1.txnId}, 1, CURRENT_DATE, 390000, 150001, 'Rotprobe')`.then(() => "eingefügt").catch((e: any) => String(e.message));
  ok("A Datenbank verweigert denselben Eingang zweimal (UNIQUE)", /duplicate|unique/i.test(dbDoppelt), dbDoppelt);
  const dbUeber = await sql`INSERT INTO fiaon_teilzahlungen (ref, bank_txn_id, txn_id, betrag_cents, eingang_am, soll_cents, summe_nachher_cents, gebucht_von)
                           VALUES (${A.ref}, -1, 'AWX-rotprobe', 1, CURRENT_DATE, 100, 101, 'Rotprobe')`.then(() => "eingefügt").catch((e: any) => String(e.message));
  ok("A Datenbank verweigert eine Summe über dem Rechnungsbetrag (CHECK)", /check/i.test(dbUeber), dbUeber);
  await sql`DELETE FROM fiaon_teilzahlungen WHERE gebucht_von = 'Rotprobe'`;
  const e3 = await eingang("a3", tag(-1), 300000, "Rest Gruendung", "EDITH QUARZHUBER");
  const u1 = await T.teilzahlungPruefen(e3.id, prA);
  ok("A Überzahlung (3.000 € auf offen 2.400 €): Prüfung sagt Überzahlung, nicht buchbar", u1.ok && u1.zeile?.buchen === false && u1.zeile?.teilzahlung?.ueberzahlung === true, u1.zeile?.ergebnis);
  const u2 = await T.teilzahlungBuchen(e3.id, { ziel: prA, wer: "Prüfstand" });
  const [uTodo] = await sql`SELECT id, status FROM fiaon_betreiber_todos WHERE schluessel = ${`bank-nachholen:ueberzahlung:${e3.txnId}`}`;
  ok("A Überzahlung: nicht gebucht, Aufgabe an die Zahlungsstelle", !u2.ok && !!uTodo && (await bank(e3.id)).applied === false && (await T.teilSummeCents(A.ref)) === 150000, u2.error);
  const e4 = await eingang("a4", tag(-1), 200000, `${prA}`, "EDITH QUARZHUBER");
  const auto4 = await liveVerbuchen(e4.txnId, prA, 200000, tag(-1), {});
  ok("A Automatik: 2.000 € mit Referenz (Rest wäre 2.400 €) bucht NICHT", auto4.gebucht === false && /Weitere Teilzahlung/.test(auto4.grund) && (await app(A.ref)).payment_status === "pending_payment", auto4.grund);
  const e5 = await eingang("a5", tag(-1), 390000, `${prA}`, "EDITH QUARZHUBER");
  const auto5 = await liveVerbuchen(e5.txnId, prA, 390000, tag(-1), {});
  ok("A Automatik: voller Rechnungsbetrag nach Teilzahlung bucht NICHT (Überzahlung)", auto5.gebucht === false && /Überzahlung/.test(auto5.grund) && (await app(A.ref)).payment_status === "pending_payment", auto5.grund);

  logOrig("\nA  Restzahlung 2.400 € mit Referenz im Zweck → Automatik schließt ab, genau einmal");
  const e2 = await eingang("a2", tag(0), 240000, `${prA} Rest`, "EDITH QUARZHUBER");
  const tr2 = await nach.bankeingangTrockenprobe(e2.id, {});
  ok("A Trockenprobe: „würde buchen: Restzahlung“", tr2.zeile?.buchen === true && /Restzahlung/.test(String(tr2.zeile?.ergebnis)), tr2.zeile?.ergebnis);
  const vorher = bezahltLog.filter((t) => t.includes(prA)).length;
  const auto2 = await liveVerbuchen(e2.txnId, prA, 240000, tag(0), {});
  ok("A Restzahlung gebucht", auto2.gebucht === true, auto2.grund);
  const a2 = await app(A.ref);
  ok("A Bestellung bezahlt, paid_at = Tag der letzten Zahlung", a2.payment_status === "paid" && new Date(a2.paid_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) === tag(0), a2);
  ok("A normaler Bezahlt-Weg genau einmal", bezahltLog.filter((t) => t.includes(prA)).length - vorher === 1, bezahltLog.filter((t) => t.includes(prA)));
  const [abschl] = await sql`SELECT COUNT(*) FILTER (WHERE schliesst_ab)::int AS ab, COUNT(*)::int AS n, SUM(betrag_cents)::int AS s FROM fiaon_teilzahlungen WHERE ref = ${A.ref}`;
  ok("A zwei Teilzahlungen, eine schließt ab, Summe 3.900 €", abschl.n === 2 && abschl.ab === 1 && abschl.s === 390000, abschl);
  const e6 = await eingang("a6", tag(0), 1000, `${prA}`, "EDITH QUARZHUBER");
  const n6 = await T.teilzahlungPruefen(e6.id, prA);
  ok("A nach der Vollzahlung: keine weitere Teilzahlung (Rechnung bezahlt)", !n6.ok && /paid/.test(String(n6.error)), n6.error);
  const nochmal = await T.teilzahlungAbschliessen(A.ref, "Prüfstand");
  ok("A Abschluss nochmal → nichts doppelt", nochmal.ok && bezahltLog.filter((t) => t.includes(prA)).length - vorher === 1);
  const z2 = await zahlungsauftragFinden(prA);
  ok("A Zahlungsseite nach Vollzahlung: bezahlt, voller Betrag, keine Teilzahlungs-Zeile", z2?.status === "paid" && z2.amountDue === "3900.00" && !z2.teilzahlung, z2?.amountDue);

  logOrig("\nA  Umsatz: genau 3.900 €, am Eingangstag, nie doppelt");
  const uA = await umsatz(A.ref);
  const summeA = uA.reduce((s, r) => s + Number(r.cents), 0);
  ok("A Umsatz-Quelle: Summe genau 3.900 €", summeA === 390000, uA);
  ok("A Umsatz: zwei Zeilen (1.500 € am Tag 1, 2.400 € heute), Bestellung nicht zusätzlich", uA.length === 2 && Number(uA[0].cents) === 150000 && uA[0].tag === tag(-2) && Number(uA[1].cents) === 240000 && uA[1].tag === tag(0), uA);
  ok("A Abschluss (erste) nur auf der letzten Zeile; teil_vorher_cents 0 / 150000", uA[0]?.erste === false && uA[1]?.erste === true && Number(uA[0]?.teil_vorher_cents) === 0 && Number(uA[1]?.teil_vorher_cents) === 150000, uA);

  // ═══ B ═════════════════════════════════════════════════════════════════════
  logOrig("\nB  Global-Paket mit Akte: 2.000 + 2.999 € über das Chefbüro → Start genau einmal");
  await GA.ensureGlobalTabelle();
  const prB = `FIAON-${M}B1`;
  const B = await kunde("B", { pr: prB, cents: 499900, pack: "global_banking", vorname: "Bruno", nachname: "Quellbach", faellig });
  await sql`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, status, firma_name, email, zustaendig_agent_id, created_at)
            VALUES (${B.ref}, 'global_banking', 'DE', ${sql.json({ name: "Prüf B GmbH", ort: "Prüfstadt", art: "unternehmen" })}, ${sql.json({ anrede: "Herr", vorname: "Bruno", nachname: "Quellbach", email: `kunde-b@${M.toLowerCase()}.invalid` })},
                    ${sql.json({ agb: true, sofortBeginn: true })}, 'pruef', 'de', 'offen', 'Prüf B GmbH', ${`kunde-b@${M.toLowerCase()}.invalid`}, ${AG}, NOW() - INTERVAL '20 days')`;
  const eb1 = await eingang("b1", tag(-1), 200000, "Anzahlung Bruno", "BRUNO QUELLBACH");
  const bb1 = await T.teilzahlungBuchen(eb1.id, { ziel: prB, wer: "Prüfstand" });
  ok("B erste Teilzahlung 2.000 € gebucht", bb1.ok && !bb1.abschluss, bb1.error);
  const sicht = await GA.globalAuftragSicht(B.ref, "t");
  ok("B Mein Auftrag: offen 2.999 €, GiroCode da", (sicht as any)?.offenCents === 299900 && (sicht as any)?.teilBezahltCents === 200000 && !!(sicht as any)?.zahlung?.qrDatenUrl, [(sicht as any)?.offenCents, (sicht as any)?.teilBezahltCents]);
  const liste = await GA.globalAuftraegeListe();
  const lb = liste.zeilen.find((z: any) => z.ref === B.ref) as any;
  ok("B Chefbüro Global-Aufträge: bezahlt 2.000 €, offen 2.999 €", lb?.teilBezahltCents === 200000 && lb?.offenCents === 299900 && lb?.teilzahlungen?.length === 1, lb && [lb.teilBezahltCents, lb.offenCents]);
  const vorB = bezahltLog.filter((t) => t.includes(prB)).length;
  const eb2 = await eingang("b2", tag(0), 299900, "Rest Bruno", "BRUNO QUELLBACH");
  const pb2 = await T.teilzahlungPruefen(eb2.id, prB);
  ok("B Prüfung: diese Zahlung schließt ab", pb2.zeile?.teilzahlung?.abschluss === true && pb2.zeile?.buchen === true, pb2.zeile?.ergebnis);
  const bb2 = await T.teilzahlungBuchen(eb2.id, { ziel: prB, wer: "Prüfstand", erwartet: { ziel: prB, bisherCents: 200000 } });
  ok("B Restzahlung gebucht, Abschluss über den Bezahlt-Weg", bb2.ok && bb2.abschluss === true && bb2.bezahlt?.ok === true, bb2.error ?? bb2.bezahlt);
  const akteB = await bis(async () => (await sql`SELECT status, bezahlt_am, start_mail_am, start_mail_fehler FROM fiaon_global_auftraege WHERE ref = ${B.ref}`)[0] as any, (x) => x?.status === "gestartet" || !!x?.start_mail_fehler, 15_000);
  ok("B Auftrag gestartet (normaler Start nach der Zahlung)", akteB?.status === "gestartet", akteB);
  const [startTodos] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${B.ref}:start`}`;
  ok("B Start-Aufgabe genau einmal", startTodos.n === 1, startTodos);
  await T.teilzahlungAbschliessen(B.ref, "Prüfstand");
  await warte(1500);
  const [startTodos2] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${B.ref}:start`}`;
  ok("B Bezahlt-Weg genau einmal, auch nach „Abschluss nachholen“", bezahltLog.filter((t) => t.includes(prB)).length - vorB === 1 && startTodos2.n === 1, bezahltLog.filter((t) => t.includes(prB)));
  const uB = await umsatz(B.ref);
  ok("B Umsatz genau 4.999 € in zwei Zeilen", uB.reduce((s, r) => s + Number(r.cents), 0) === 499900 && uB.length === 2, uB);

  // ═══ K ═════════════════════════════════════════════════════════════════════
  logOrig("\nK  Partner-Provision: Fast-Track-Abzug über Teilzahlungen genau einmal");
  const { KOOP_DURCHLAUF_ABZUG_SQL } = await import("../shared/fiaon-koop-empfehlung");
  const abzug = await sql.begin(async (tx: any) => {
    await tx.unsafe(`CREATE TEMP TABLE fiaon_global_angebote (auftrag_ref TEXT, fassung TEXT, parameter JSONB) ON COMMIT DROP`);
    await tx.unsafe(`INSERT INTO fiaon_global_angebote VALUES ($1, 'IA-KAPITAL-2026-10-01-C', '{"fastTrackCents": 200000}')`, [A.ref]);
    return tx.unsafe(`WITH q AS (${UMSATZ_QUELLE_SQL}) SELECT q.cents, (${KOOP_DURCHLAUF_ABZUG_SQL})::int AS abzug FROM q WHERE q.ref = $1 ORDER BY q.am`, [A.ref]);
  }) as any[];
  const abzugSumme = abzug.reduce((s: number, r: any) => s + Number(r.abzug), 0);
  ok("K Fast-Track 2.000 € über 1.500 + 2.400 € → abgezogen 1.500 + 500 = 2.000 € (einmal)", abzugSumme === 200000 && Number(abzug[0]?.abzug) === 150000 && Number(abzug[1]?.abzug) === 50000, abzug);

  // ═══ M ═════════════════════════════════════════════════════════════════════
  logOrig("\nM  Keine Mail an echte Adressen");
  const mails = await sql`SELECT event, empfaenger, status FROM fiaon_mail_log WHERE person_id = ANY(${[A.personId, B.personId]}) OR empfaenger LIKE ${`%@${M.toLowerCase()}.invalid`}`.catch(() => []) as any[];
  ok("M kein Versand (alle Mails nur protokolliert: fehlgeschlagen/übersprungen, Adressen *.invalid)", mails.every((m: any) => m.status !== "versandt" && String(m.empfaenger ?? "").endsWith(".invalid")), mails);
  ok("M jeder Netzaufruf blockiert", true, `${blockiert} blockiert`);

  await aufraeumen();
  logOrig(`\n${fehler ? `ROT: ${fehler} Prüfung(en) fehlgeschlagen` : "GRÜN: alle Prüfungen bestanden"}`);
}

main().catch((e) => { fehler++; logOrig("ABBRUCH:", e); }).finally(async () => {
  await warte(500);
  await sql.end({ timeout: 5 }).catch(() => {});
  const { sqlPool } = await import("../server/lib/db-pool").catch(() => ({ sqlPool: null as any }));
  await sqlPool?.end?.({ timeout: 5 }).catch(() => {});
  process.exit(fehler ? 1 : 0);
});
