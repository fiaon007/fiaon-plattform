// Prüfstand E-401 (3/6, 19.10.2026), Datenbank-Teil: Mara sucht die gemeldete Zahlung selbst (zahlung_suchen) —
// mit erfundenen Testkunden (Marke Q401) gegen eine LOKALE Prüfdatenbank. Kein Netz (fetch gesperrt), keine Mail.
// Fährt den ECHTEN Code: Lesen, Abgleich, Fund + Trockenprobe, die Karte „Geld eingegangen“, den Vermerk — und den
// einen Klick (entscheiden → bankeingang_buchen → der eine Buchungsweg). Mara selbst bucht nie.
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e401zs
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e401zs?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-zahlung-suchen-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY",
  "GOOGLE_SA_KEY", "META_CAPI_TOKEN", "WHATSAPP_TOKEN"]) delete process.env[k];

// ── Attrappen für den Ende-zu-Ende-Lauf im Postfach (Abschnitt 10): Modell und Gmail antworten hier, sonst kein Netz ──
import { generateKeyPairSync } from "node:crypto";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401zs";
process.env.KI_ANBIETER = "openai";
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e401zs.invalid", private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.pruef.invalid/token",
});
interface Szenario { einordnung: Record<string, unknown>; werkzeuge?: { name: string; args: Record<string, unknown> }[]; antwort: Record<string, unknown>; umformuliert?: Record<string, unknown> }
let SZ: Szenario | null = null;
const OPENAI: { art: string; system: string; alles: string }[] = [];
const GMAIL_SENDEN: string[] = [];
const NACHRICHTEN = new Map<string, { thread: string; am: number; von: string; betreff: string; text: string }>();
const jsonAntwort = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const modellText = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
let blockiert = 0;
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const system = String((body.input ?? []).find((m: any) => m?.role === "system")?.content ?? "");
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    OPENAI.push({ art: einordnen ? "einordnen" : "antwort", system, alles });
    if (!SZ) return jsonAntwort(500, { error: { message: "kein Szenario" } });
    let aus: any;
    if (einordnen) aus = modellText(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = modellText(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else if (body.tools && SZ.werkzeuge?.length && !alles.includes("function_call_output")) {
      aus = { output: SZ.werkzeuge.map((w, i) => ({ type: "function_call", call_id: `c${i}`, name: w.name, arguments: JSON.stringify(w.args) })) };
    } else aus = modellText("fertig");
    return jsonAntwort(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return jsonAntwort(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send/.test(u)) { GMAIL_SENDEN.push(String(init?.body ?? "")); return jsonAntwort(200, { id: `gesendet-${GMAIL_SENDEN.length}`, threadId: "t" }); }
    if (/\/drafts/.test(u)) return jsonAntwort(200, { id: "entwurf-1", message: { id: "x" } });
    if (/\/messages\?/.test(u)) return jsonAntwort(200, { messages: [], resultSizeEstimate: 0 });
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return jsonAntwort(404, { error: { message: "Not Found" } });
      return jsonAntwort(200, {
        id: m[1], threadId: n.thread, labelIds: ["INBOX", "UNREAD"], internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: { mimeType: "text/plain", headers: [
          { name: "From", value: n.von }, { name: "To", value: "support@fiaon.com" },
          { name: "Subject", value: n.betreff }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text).toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return jsonAntwort(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return jsonAntwort(200, {});
  }
  blockiert++;
  return new Response(`blockiert: ${u.split("?")[0]}`, { status: 599 });
}) as any;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const M = "Q401";
const AG = 99401;

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const Z = await import("../server/lib/fiaon-mara-zahlung-suchen");
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  const { berlinToday, berlinDatum } = await import("../server/lib/fiaon-time");
  const heute = berlinToday();
  const tag = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

  async function aufraeumen() {
    const refs = ((await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-M${M}%`}`) as any[]).map((r) => r.ref);
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PR-${M}-%`}`) as any[]).map((r) => Number(r.id));
    const txns = ((await sql`SELECT id, txn_id FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`) as any[]);
    const rateIds = refs.length ? ((await sql`SELECT id FROM fiaon_abo_raten WHERE ref = ANY(${refs})`) as any[]).map((r) => `RATE-${r.id}`) : [];
    await sql`DELETE FROM fiaon_provision_vormerkung WHERE ref = ANY(${[...refs, ...rateIds]})`.catch(() => {});
    await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${[...refs, ...rateIds]}) OR agent_id = ${AG}`.catch(() => {});
    if (txns.length) {
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel = ANY(${txns.map((t) => `eingang:${t.id}`)})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_zahlung_funde WHERE bank_txn_id = ANY(${txns.map((t) => Number(t.id))})`.catch(() => {});
    }
    if (refs.length) {
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
      await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`;
    }
    if (personen.length) {
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`;
      await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_global_angebote WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_sperr_protokoll WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_postmeister WHERE person_id = ANY(${personen})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`;
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-M${M}%`}`;
    if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
    await sql`DELETE FROM fiaon_agents WHERE id = ${AG}`.catch(() => {});
  }

  /** Kunde mit Bestellung (bezahlt: Rate 1 bezahlt; sonst abgeschickt, erste Zahlung offen). */
  async function kunde(x: string, o: { vorname: string; nachname: string; pr: string; cents: number; bezahlt?: boolean; test?: boolean }) {
    const ref = `FIAON-M${M}${x}-TEST`;
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am)
      VALUES (${`PR-${M}-${x}`}, ${o.vorname}, ${o.nachname}, ${`kunde-${x.toLowerCase()}@q401.invalid`}, ${AG}, ${o.test ? new Date() : null}) RETURNING id`) as any[];
    const status = o.bezahlt ? "paid" : "pending_payment";
    await sql`
      INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, email, first_name, last_name,
                                      person_id, assigned_agent_id, created_at, completed_at, paid_at, current_step, submitted_at, agb_stand)
      VALUES (${ref}, ${o.pr}, ${status}, ${o.bezahlt ? "payment_completed" : "payment_pending"}, 'private',
              ${o.cents === 799 ? "start" : o.cents === 5999 ? "pro" : o.cents === 7999 ? "ultra" : "highend"}, ${`Prüf ${x}`}, ${o.cents / 100},
              ${`kunde-${x.toLowerCase()}@q401.invalid`}, ${o.vorname}, ${o.nachname}, ${p.id}, ${AG}, NOW() - INTERVAL '60 days',
              ${o.bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, ${o.bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, 8, NOW() - INTERVAL '60 days', '2026-10-05')`;
    if (o.bezahlt) {
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
                VALUES (${ref}, 1, ${o.pr}, ${o.cents}, ${tag(-40)}, 'bezahlt', ${`${tag(-40)}T12:00:00Z`}, 'auto', 'Startzahlung')`;
    }
    return { ref, personId: Number(p.id) };
  }
  const rate = async (ref: string, nr: number, zr: string, cents: number, faellig: string, bezahlt: { am: string; notiz: string } | null = null) => {
    const [r] = (await sql`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${ref}, ${nr}, ${zr}, ${cents}, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt ? `${bezahlt.am}T12:00:00Z` : null}, 'auto', ${bezahlt?.notiz ?? null})
      RETURNING id`) as any[];
    return Number(r.id);
  };
  const eingang = async (x: string, datum: string, cents: number, zweck: string, zahler: string, extra: { applied?: boolean; matchedRef?: string; note?: string } = {}) => {
    const txnId = `AWX-${M.toLowerCase()}-${x}`;
    const [r] = (await sql`
      INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, applied, note)
      VALUES (${txnId}, ${`${datum}T00:00:00Z`}, ${cents}, 'EUR', ${zahler}, ${zweck}, NULL, ${extra.matchedRef ?? null},
              ${extra.matchedRef ? "matched" : "unmatched"}, ${extra.applied ?? false}, ${extra.note ?? "Prüfstand E-401"})
      RETURNING id`) as any[];
    return { id: Number(r.id), txnId };
  };
  const fundeVon = async (personId: number) => ((await sql`SELECT * FROM fiaon_mara_zahlung_funde WHERE person_id = ${personId}`.catch(() => [])) as any[]);
  const vermerke = async (personId: number) => ((await sql`SELECT agent_name, note FROM fiaon_contact_log WHERE person_id = ${personId} AND note LIKE '%[Zahlungsfund #%'`) as any[]);
  const karte = async (txnId: number) => ((await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE schluessel = ${`eingang:${txnId}`}`.catch(() => [])) as any[])[0] ?? null;
  const bank = async (id: number) => ((await sql`SELECT applied, matched_ref, match_status FROM fiaon_bank_txns WHERE id = ${id}`) as any[])[0];

  await aufraeumen();
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp) VALUES (${AG}, 'Prüf Betreuer Q401', 'betreuer@q401.invalid', TRUE, 2500)`;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('provision_automatik', 'aus') ON CONFLICT (key) DO UPDATE SET value = 'aus'`;

  console.log("── 1 · Gefunden, nicht gebucht (Erstzahlung, Name + Betrag): Fund, Karte, Vermerk — nichts gebucht");
  const A = await kunde("A", { vorname: "Edith", nachname: "Quarzmeier", pr: `FIAON${M}A1`, cents: 5999 });
  const eA = await eingang("a", tag(-1), 5999, "Gesendet mit N26", "EDITH QUARZMEIER");
  const lA = await Z.zahlungSuchenBehandeln({ personId: A.personId, kanal: "mail", quelle: "Mail #401" });
  ok(lA?.ergebnis.art === "gefunden" && lA.ergebnis.haupt?.eingang.id === eA.id, "zahlung_suchen: gefunden (sein Eingang)", lA?.ergebnis.art);
  ok(lA?.satz === `Ich habe Ihre Überweisung über 59,99 € gefunden (bei uns eingegangen am ${de(tag(-1))}), wir ordnen sie jetzt zu.`, "Satz mit Betrag und Eingangstag", lA?.satz);
  ok(lA?.vorgelegt.includes(eA.id), "Eingang vorgelegt (Karte steht)", lA?.vorgelegt);
  const fA = await fundeVon(A.personId);
  const erwA = fA[0]?.erwartet ? (typeof fA[0].erwartet === "string" ? JSON.parse(fA[0].erwartet) : fA[0].erwartet) : null;
  ok(fA.length === 1 && fA[0].ziel === `FIAON${M}A1` && fA[0].stand === "gefunden" && fA[0].kanal === "mail" && fA[0].quelle === "Mail #401", "Fund: Ziel in DB-Schreibweise, Kanal, Quelle", fA[0]);
  ok(erwA?.regel === "erstzahlung" && /würde buchen/.test(String(fA[0]?.probe ?? "")), "Trockenprobe mit seinem Ziel: „würde buchen“ → Erwartungs-Stempel erstzahlung", { erwA, probe: fA[0]?.probe });
  const kA = await karte(eA.id);
  const optA = (typeof kA?.optionen === "string" ? JSON.parse(kA.optionen) : kA?.optionen) ?? [];
  const belA = (typeof kA?.belege === "string" ? JSON.parse(kA.belege) : kA?.belege) ?? [];
  ok(kA && kA.status === "offen" && kA.art === "eingang_unverbucht" && Number(kA.person_id) === A.personId, "Karte „Geld eingegangen“ (eingang:<id>) offen, an der Person", kA && { status: kA.status, art: kA.art, person: kA.person_id });
  ok(optA.some((o: any) => o.key === "buchen" && o.werkzeug === "bankeingang_buchen") && kA?.empfehlung === "buchen", "Karte: Buchungsknopf, empfohlen", optA.map((o: any) => o.key));
  ok(belA.some((b: any) => /Kunde meldet Zahlung \(Mail/.test(b.text)) && !optA.some((o: any) => o.key === "kein_kunde"), "Karte: Beleg „Kunde meldet Zahlung (Mail …)“, kein „Kein Kundengeld“", belA.map((b: any) => b.text));
  const vA = await vermerke(A.personId);
  ok(vA.length === 1 && vA[0].agent_name === "Postmeister" && /gemeldete Zahlung im Bankbuch gesucht/.test(vA[0].note) && /Mara-Steuerpult/.test(vA[0].note), "Akte: ein Vermerk (Postmeister) mit Fund und Ort der Karte", vA);
  const bA = await bank(eA.id);
  const [appA] = (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${A.ref}`) as any[];
  ok(bA.applied === false && appA.payment_status === "pending_payment", "NICHTS gebucht: Bankbuch offen, Bestellung offen (Mara bucht nie)", { bA, appA });
  ok(/ZAHLUNG GESUCHT/.test(lA?.hinweis ?? "") && (lA?.hinweis ?? "").includes(lA!.satz) && /Keine Aufgabe an die Zahlungsstelle/.test(lA?.hinweis ?? ""), "Hinweis an Mara: Fund, Satz, keine Aufgabe");
  ok(lA?.daten.treffer[0]?.betragPunkt === "59.99" && lA?.daten.treffer[0]?.datum === de(tag(-1)), "werkzeugDaten: 59.99 und Datum (Belegprüfung)", lA?.daten.treffer[0]);

  console.log("── 2 · Noch einmal (Nachhol-Takt): ein Fund, ein Vermerk, eine Karte");
  const lA2 = await Z.zahlungSuchenBehandeln({ personId: A.personId, kanal: "whatsapp", quelle: "WhatsApp #4011" });
  ok(lA2?.ergebnis.art === "gefunden", "wieder gefunden");
  const fA2 = await fundeVon(A.personId);
  ok(fA2.length === 1 && fA2[0].kanal === "whatsapp" && fA2[0].quelle === "WhatsApp #4011", "ein Fund (aufgefrischt: Kanal WhatsApp)", fA2.map((f) => f.kanal));
  ok((await vermerke(A.personId)).length === 1, "weiterhin genau ein Vermerk");
  ok(((await sql`SELECT COUNT(*)::int n FROM fiaon_mara_entscheidungen WHERE schluessel = ${`eingang:${eA.id}`}`) as any[])[0].n === 1, "weiterhin genau eine Karte");

  console.log("── 3 · Der Sammler hält Maras Fund auf der Karte");
  const s = await E.entscheidungenSammeln({ nur: ["eingang_unverbucht"] });
  ok(!s.je.eingang_unverbucht?.fehler, "Sammler ohne Fehler", s.je.eingang_unverbucht);
  const kA2 = await karte(eA.id);
  const belA2 = (typeof kA2?.belege === "string" ? JSON.parse(kA2.belege) : kA2?.belege) ?? [];
  ok(kA2?.status === "offen" && belA2.some((b: any) => /Kunde meldet Zahlung \(WhatsApp/.test(b.text)), "Karte nach dem Sammeln: offen, „Kunde meldet Zahlung (WhatsApp …)“", belA2.map((b: any) => b.text));

  console.log("── 4 · Der Klick (Justin): entscheiden → der eine Buchungsweg; danach sagt Mara „gebucht“");
  const knopf = (((typeof kA2.optionen === "string" ? JSON.parse(kA2.optionen) : kA2.optionen) ?? []) as any[]).find((o) => o.key === "buchen");
  const e1 = await E.entscheiden(Number(kA2.id), "buchen", { von: "Prüfstand Q401" });
  ok(e1.ok && e1.karte?.status === "entschieden", "Karte entschieden", e1.error ?? e1.karte?.ergebnis);
  const [appA2] = (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${A.ref}`) as any[];
  const bA2 = await bank(eA.id);
  ok(appA2.payment_status === "paid" && bA2.applied === true && bA2.matched_ref === A.ref, "gebucht über den einen Weg: Bestellung bezahlt, Bankbuch verbucht und zugeordnet", { appA2, bA2, knopf: knopf?.label });
  const lA3 = await Z.zahlungSuchenBehandeln({ personId: A.personId, kanal: "mail", quelle: "Mail #402" });
  ok(lA3?.ergebnis.art === "gebucht" && lA3.satz === `Ihre Zahlung über 59,99 € ist am ${de(tag(-1))} bei uns eingegangen und gebucht.`, "danach: „… eingegangen und gebucht“", lA3?.satz);

  console.log("── 5 · Schon gebucht (Rate 2, Notiz „Bankeingang …“) — Rate 3 fällig ohne Eingang; nichts geschrieben");
  const C = await kunde("C", { vorname: "Cord", nachname: "Quintus", pr: `FIAON-${M}C3`, cents: 7999, bezahlt: true });
  const eC = await eingang("c", tag(-3), 7999, `FIAON-${M}C3-2`, "CORD QUINTUS", { applied: true, matchedRef: C.ref });
  await rate(C.ref, 2, `FIAON-${M}C3-2`, 7999, tag(-4), { am: tag(-3), notiz: `Bankeingang ${eC.txnId}` });
  await rate(C.ref, 3, `FIAON-${M}C3-3`, 7999, tag(-1));
  const lC = await Z.zahlungSuchenBehandeln({ personId: C.personId, kanal: "mail", quelle: "Mail #403" });
  ok(lC?.ergebnis.art === "gebucht" && lC.ergebnis.haupt?.eingang.rateNr === 2, "gebucht, Rate 2 aus der Ratennotiz", lC?.ergebnis.haupt);
  ok(lC?.satz === `Ihre Zahlung über 79,99 € ist am ${de(tag(-3))} bei uns eingegangen und gebucht (Rate 2).`, "Satz: Datum, Betrag, Rate 2", lC?.satz);
  ok(lC?.ergebnis.ohneEingang.length === 1 && lC.ergebnis.ohneEingang[0].rateNr === 3 && /NOCH OHNE EINGANG: seine Rate 3/.test(lC.hinweis), "Rate 3 (fällig gestern) ohne Eingang — im Hinweis", lC?.ergebnis.ohneEingang);
  ok(!(await fundeVon(C.personId)).length && !(await vermerke(C.personId)).length && !(await karte(eC.id)), "gebucht: kein Fund, kein Vermerk, keine Karte");
  ok(lC?.frueher.some((f) => f.datum === tag(-40) && f.cents === 7999), "Akte: Rate 1 (vor 40 Tagen) als ältere Zahlung bekannt (für die Antwortprüfung)", lC?.frueher);

  console.log("── 6 · Rate über die Referenz (nur der Code im Zweck, fremder Zahler): Fund mit Rate und Erwartungs-Stempel");
  const I = await kunde("I", { vorname: "Ilse", nachname: "Quadflieg", pr: `FIAON-${M}I9`, cents: 5999, bezahlt: true });
  const r2I = await rate(I.ref, 2, `FIAON-${M}I9-2`, 5999, tag(-5));
  const eI = await eingang("i", tag(-1), 5999, `Monatsbeitrag ${M}I9`, "KONTO PARTNER");
  const lI = await Z.zahlungSuchenBehandeln({ personId: I.personId, kanal: "whatsapp", quelle: "WhatsApp #4019" });
  ok(lI?.ergebnis.art === "gefunden" && lI.ergebnis.haupt?.ziel?.rateNr === 2 && lI.ergebnis.haupt.wege.includes("referenz"), "gefunden: Rate 2 über die Referenz", lI?.ergebnis.haupt);
  const fI = await fundeVon(I.personId);
  const erwI = fI[0]?.erwartet ? (typeof fI[0].erwartet === "string" ? JSON.parse(fI[0].erwartet) : fI[0].erwartet) : null;
  ok(fI[0]?.ziel === `FIAON-${M}I9-2` && Number(fI[0]?.rate_nr) === 2 && erwI?.rateId === r2I && erwI?.regel === "rate", "Fund: Ziel Rate 2, Stempel mit Rate-ID", { ziel: fI[0]?.ziel, erwI, probe: fI[0]?.probe });
  ok((await vermerke(I.personId))[0]?.agent_name === "Mara", "Vermerk über WhatsApp: „Mara“");
  ok((await bank(eI.id)).applied === false, "nichts gebucht");

  console.log("── 7 · Betrag weicht ab: angekommen, Fund ohne Knopf");
  const H = await kunde("H", { vorname: "Hanna", nachname: "Quitzow", pr: `FIAON${M}H8`, cents: 5999 });
  const eH = await eingang("h", tag(-2), 5000, "Teil", "HANNA QUITZOW");
  const lH = await Z.zahlungSuchenBehandeln({ personId: H.personId, kanal: "mail", quelle: "Mail #408" });
  ok(lH?.ergebnis.art === "abweichend" && /über 50,00 € ist bei uns angekommen/.test(lH.satz), "abweichend: „über 50,00 € ist bei uns angekommen“", lH?.satz);
  const fH = await fundeVon(H.personId);
  ok(fH[0]?.stand === "abweichend" && fH[0]?.ziel == null && fH[0]?.erwartet == null, "Fund: abweichend, kein Ziel, kein Stempel", fH[0]);
  const kH = await karte(eH.id);
  const optH = ((typeof kH?.optionen === "string" ? JSON.parse(kH.optionen) : kH?.optionen) ?? []) as any[];
  ok(kH && !optH.some((o) => o.key === "buchen"), "Karte ohne Buchungsknopf (Teil-/Fehlbetrag entscheidet ein Mensch im Konto)", optH.map((o) => o.key));

  console.log("── 8 · Nichts gefunden, Testperson, unterwegs, fremd zugeordnet, Global-Kunde");
  const D = await kunde("D", { vorname: "Dora", nachname: "Quendt", pr: `FIAON${M}D4`, cents: 9999 });
  const lD = await Z.zahlungSuchenBehandeln({ personId: D.personId, kanal: "mail", quelle: "Mail #404" });
  ok(lD?.ergebnis.art === "nicht_gefunden" && /NICHTS GEFUNDEN/.test(lD.hinweis) && /noch kein Eingang zu sehen/.test(lD.satz), "nicht gefunden: Hinweis + Satz wie bisher (Beleg, nicht doppelt)", lD?.satz);
  ok(!(await fundeVon(D.personId)).length && !(await vermerke(D.personId)).length, "nichts geschrieben");
  const T = await kunde("T", { vorname: "Tilo", nachname: "Quaestor", pr: `FIAON${M}T5`, cents: 5999, test: true });
  const eT = await eingang("t", tag(-1), 5999, "x", "TILO QUAESTOR");
  const lT = await Z.zahlungSuchenBehandeln({ personId: T.personId, kanal: "mail", quelle: "Mail #405" });
  ok(lT?.ergebnis.art === "gefunden" && lT.test && !lT.vorgelegt.length, "Testperson: gerechnet, nichts vorgelegt", { art: lT?.ergebnis.art, test: lT?.test });
  ok(!(await fundeVon(T.personId)).length && !(await vermerke(T.personId)).length && !(await karte(eT.id)), "Testperson: kein Fund, kein Vermerk, keine Karte");
  const U = await kunde("U", { vorname: "Ute", nachname: "Quarlow", pr: `FIAON${M}U6`, cents: 9999 });
  const eU = await eingang("u", tag(0), 9999, `FIAON${M}U6`, "UTE QUARLOW", { note: "Airwallex: Geld ist UNTERWEGS (Prüfstand)" });
  const lU = await Z.zahlungSuchenBehandeln({ personId: U.personId, kanal: "mail", quelle: "Mail #406" });
  ok(lU?.ergebnis.art === "unterwegs" && /auf dem Weg zu uns/.test(lU.satz), "unterwegs: „auf dem Weg zu uns“", lU?.satz);
  ok(!(await fundeVon(U.personId)).length && !(await karte(eU.id)), "unterwegs: kein Fund, keine Karte (der Einleser bucht, sobald es da ist)");
  const F = await kunde("F", { vorname: "Fritz", nachname: "Quellhorst", pr: `FIAON${M}F7`, cents: 5999 });
  await eingang("f", tag(-1), 5999, "Rate", "FRITZ QUELLHORST", { matchedRef: C.ref });
  const lF = await Z.zahlungSuchenBehandeln({ personId: F.personId, kanal: "mail", quelle: "Mail #407" });
  ok(lF?.ergebnis.art === "nicht_gefunden", "Name passt, aber einer fremden Bestellung zugeordnet → nicht seiner", lF?.ergebnis.treffer);
  const G = await kunde("G", { vorname: "Gerd", nachname: "Quandel", pr: `FIAON${M}G2`, cents: 5999 });
  await eingang("g", tag(-1), 5999, "x", "GERD QUANDEL");
  await sql`INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, gueltig_bis, person_id)
            VALUES (${`IA-${M}-G`}, 'IA-PRUEF-1', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ${tag(30)}, ${G.personId})`;
  const { istGlobalKunde } = await import("../server/lib/fiaon-global-kunde");
  ok(await istGlobalKunde(G.personId), "(Gerd ist Global-Kunde: Individualangebot, kein bezahltes Stufenpaket)");
  const lG = await Z.zahlungSuchenBehandeln({ personId: G.personId, kanal: "mail", quelle: "Mail #409" });
  ok(lG === null && !(await fundeVon(G.personId)).length, "Global-Kunde: keine Suche, nichts geschrieben (E-272)", lG?.ergebnis.art);

  console.log("── 9 · Wann gesucht wird (zahlungSuchenNoetig)");
  ok(Z.zahlungSuchenNoetig({ flags: { zahlung_behauptet: true }, lage: "unbezahlt", kundeText: "" }), "Lampe zahlung_behauptet → suchen");
  ok(Z.zahlungSuchenNoetig({ flags: {}, lage: "zahlung_gemeldet", kundeText: "Wo ist meine Karte?" }), "Lage „Zahlung gemeldet“ → suchen");
  ok(Z.zahlungSuchenNoetig({ flags: {}, lage: "rate_ueberfaellig", kundeText: "Habe gestern überwiesen." }), "seine Worte „habe gestern überwiesen“ → suchen");
  ok(!Z.zahlungSuchenNoetig({ flags: {}, lage: "aktiv", kundeText: "Wann kommt meine Karte?" }), "sonst nicht");

  console.log("── 10 · Ende zu Ende im Postfach (Modell- und Gmail-Attrappe): der Server sucht VOR dem Modell, die Wand hält „gebucht“");
  {
    const kp = await import("../server/lib/fiaon-ki-pause");
    kp.kiNetzAbsichern();
    const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
    const lauf = await import("../server/lib/fiaon-postmeister-lauf");
    await postmeisterSchema();
    const EIN = ["ki_pause", "postmeister_an", "postmeister_v2"];
    const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`) as any[];
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an')`;
    (kp as any).kiPauseZwischenspeicherLeeren?.();
    let nr = 0;
    const lies = (w: unknown) => { if (w == null) return null; if (typeof w === "object") return w; try { const x = JSON.parse(String(w)); return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } };
    const mail = async (von: string, name: string, text: string, sz: Szenario) => {
      nr += 1;
      const gmailId = `e401zs-${nr}`;
      NACHRICHTEN.set(gmailId, { thread: `e401zs-t${nr}`, am: Date.now() - 10 * 60_000, von: `${name} <${von}>`, betreff: "Zahlung", text });
      SZ = sz;
      const vorKi = OPENAI.length, vorSenden = GMAIL_SENDEN.length;
      await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId, gruss: "Freundliche Grüße\nIhr FIAON Support-Team", modus: "auto" });
      const [z] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[];
      return { z, handlungen: (lies(z?.handlungen) as any[]) ?? [], pruefung: lies(z?.pruefung) as any, ki: OPENAI.slice(vorKi).filter((x) => x.art === "antwort"), gesendet: GMAIL_SENDEN.length - vorSenden };
    };
    const einordnung = { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Meldet seine Überweisung.", flags: { zahlung_behauptet: true } };
    const schritt = { art: "erledigt", url: null, text: "" };

    // K: Zahlung gemeldet (claimed_paid), Eingang da (Name + Betrag), noch nicht gebucht.
    const K = await kunde("K", { vorname: "Kai", nachname: "Quermann", pr: `FIAON${M}K1`, cents: 5999 });
    await sql`UPDATE fiaon_applications SET payment_status = 'claimed_paid', claimed_paid_at = NOW() - INTERVAL '1 day' WHERE ref = ${K.ref}`;
    const eK = await eingang("k", tag(-1), 5999, "Danke", "KAI QUERMANN");
    const satzK = `Ich habe Ihre Überweisung über 59,99 € gefunden (bei uns eingegangen am ${de(tag(-1))}), wir ordnen sie jetzt zu.`;
    const todosVorher = ((await sql`SELECT COUNT(*)::int n FROM fiaon_betreiber_todos WHERE person_id = ${K.personId}`.catch(() => [{ n: 0 }])) as any[])[0].n;
    const r1 = await mail(`kunde-k@q401.invalid`, "Kai Quermann", "Hallo, ich habe gestern die 59,99 € überwiesen. Gruß Kai", {
      einordnung,
      werkzeuge: [{ name: "aufgabe_an_betreuer", args: { titel: "Zahlungsbeleg prüfen", text: "Kunde meldet Überweisung.", kollege: "Zahlung", faellig_in_tagen: 1, dringend: false, rueckruf_am: "" } }],
      antwort: { antwort: "Vielen Dank! Ihre Zahlung ist bereits gebucht.", naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: `Vielen Dank für Ihre Überweisung! ${satzK}`, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(r1.z, "Mail verarbeitet", r1.z?.aktion);
    ok(/ZAHLUNG GESUCHT/.test(r1.ki[0]?.system ?? "") && (r1.ki[0]?.system ?? "").includes(satzK), "Maras Auftrag enthält den Fund und den Satz (vor dem Modell)");
    ok(r1.handlungen.some((h) => h.werkzeug === "zahlung_suchen" && h.ok && /ANGEKOMMEN, NOCH NICHT GEBUCHT/.test(h.ergebnis)), "Handlung zahlung_suchen steht in der Zeile", r1.handlungen.map((h) => h.werkzeug));
    const aufg = r1.handlungen.find((h) => h.werkzeug === "aufgabe_an_betreuer");
    const todosNach = ((await sql`SELECT COUNT(*)::int n FROM fiaon_betreiber_todos WHERE person_id = ${K.personId}`.catch(() => [{ n: 0 }])) as any[])[0].n;
    ok(aufg && aufg.ok === false && /Nicht nötig: zahlung_suchen/.test(aufg.ergebnis) && todosNach === todosVorher, "Keine Aufgabe an die Zahlungsstelle (Werkzeug gesperrt, kein Auftrag angelegt)", { aufg, todosVorher, todosNach });
    ok(String(r1.z?.antwort ?? "").includes(satzK) && !/bereits gebucht/.test(String(r1.z?.antwort ?? "")), "„bereits gebucht“ hielt die Wand nicht — die Antwort sagt den Fund", String(r1.z?.antwort ?? "").slice(0, 200));
    ok(!(r1.pruefung?.fehlend ?? []).some((f: string) => /gebucht|Bankbuch/.test(f)), "Nach der Umformulierung: kein Bankbuch-Mangel", r1.pruefung?.fehlend);
    ok(!!(await karte(eK.id)) && (await bank(eK.id)).applied === false, "Karte liegt vor, nichts gebucht");
    if (process.env.ZEIGEN) console.log(JSON.stringify({ antwort: r1.z?.antwort, pruefung: r1.pruefung, ki: r1.ki.length }, null, 1));
    console.log(`     (Weg der Antwort: ${r1.z?.aktion} — ${String(r1.z?.begruendung ?? "").slice(0, 120)}; gesendet ${r1.gesendet})`);

    // L: nichts auf dem Konto — Mara sagt hartnäckig „angekommen“ → bleibt Entwurf, der Mangel steht in der Prüfung.
    const L = await kunde("L", { vorname: "Lena", nachname: "Quistorp", pr: `FIAON${M}L2`, cents: 5999 });
    await sql`UPDATE fiaon_applications SET payment_status = 'claimed_paid', claimed_paid_at = NOW() - INTERVAL '1 day' WHERE ref = ${L.ref}`;
    const falsch = { antwort: "Vielen Dank, Ihre Zahlung ist bei uns angekommen.", naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] };
    const r2 = await mail(`kunde-l@q401.invalid`, "Lena Quistorp", "Guten Tag, ich habe die Rechnung bereits überwiesen.", { einordnung, antwort: falsch, umformuliert: falsch });
    ok(/NICHTS GEFUNDEN/.test(r2.ki[0]?.system ?? ""), "Auftrag: nichts gefunden");
    ok((r2.pruefung?.fehlend ?? []).some((f: string) => /kein passender Eingang/.test(f)) && r2.gesendet === 0 && r2.z?.aktion !== "auto_beantwortet",
      "„angekommen“ ohne Eingang → Mangel, nichts gesendet (Entwurf)", { aktion: r2.z?.aktion, fehlend: r2.pruefung?.fehlend });

    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    const pm = ((await sql`SELECT id FROM fiaon_postmeister WHERE gmail_id LIKE 'e401zs-%'`) as any[]).map((r) => Number(r.id));
    if (pm.length) await sql`DELETE FROM fiaon_postmeister WHERE id = ANY(${pm})`.catch(() => {});
  }

  ok(blockiert === 0, `kein Netzaufruf außer den Attrappen (${blockiert})`);
  await aufraeumen();
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
