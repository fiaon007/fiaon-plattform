// Prüfstand E-401 (4/6, 19.10.2026), Datenbank-Teil: Mara ändert Anschrift, E-Mail und Telefon selbst (angaben_aendern) —
// mit erfundenen Testkunden (Marke Q404, Nummern 4915900404xxx) gegen eine LOKALE Prüfdatenbank. Kein Netz: Brevo, Modell
// und Gmail sind Attrappen (fetch nachgebaut), alles andere wird abgewiesen.
// Fährt den ECHTEN Code: Erkennen, Absender prüfen, Speichern über updateCustomerContact, Vermerk, Hinweis-Mails, den
// Einmal-Link (GET zeigt nur den Knopf, POST ändert genau einmal — über HTTP gegen eine lokale Express-App), Postfach Ende
// zu Ende (mailBearbeiten) und WhatsApp Ende zu Ende (maraAntwortet).
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e401ag
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e401ag?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-angaben-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY",
  "GOOGLE_SA_KEY", "META_CAPI_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];
// Attrappen-Schlüssel — die Dienste beantwortet der nachgebaute fetch, nichts verlässt den Rechner.
process.env.SESSION_SECRET = "pruefstand-e401-angaben-nur-lokal";
process.env.BREVO_API_KEY = "xkeysib-pruef-lokal-e401ag";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401ag";
process.env.KI_ANBIETER = "openai";
process.env.OHNE_PDF = "1";
import { generateKeyPairSync } from "node:crypto";
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e401ag.invalid", private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.pruef.invalid/token",
});

// ── Netz: nur lokal und die Attrappen ─────────────────────────────────────
interface MailSz { einordnung: Record<string, unknown>; werkzeuge?: { name: string; args: Record<string, unknown> }[]; antwort: Record<string, unknown>; umformuliert?: Record<string, unknown> }
let MODUS: "mail" | "wa" = "mail";
let SZ: MailSz | null = null;
let WA_PLAN: { antworten: string[]; mensch?: boolean } | null = null;
const MODELL: { art: string; system: string; alles: string; zweiter?: boolean; antwort?: string }[] = [];
const MAILS: { an: string; betreff: string; text: string; html: string }[] = [];
const GMAIL_SENDEN: string[] = [];
// auth: Gmails „Authentication-Results“ (E-401 Nachbesserung) — fehlt er, setzt die Attrappe dmarc=pass zur Absender-Domain;
// null = keine Prüfung von Gmail (gefälschte Mail). antwortAn: Reply-To.
const NACHRICHTEN = new Map<string, { thread: string; am: number; von: string; betreff: string; text: string; auth?: string | null; antwortAn?: string }>();
const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const modellText = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
let blockiert = 0;
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    let body: any = {};
    try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
    MAILS.push({ an: String(body?.to?.[0]?.email ?? ""), betreff: String(body?.subject ?? ""), text: String(body?.textContent ?? ""), html: String(body?.htmlContent ?? "") });
    return json(201, { messageId: `<pruef404-${MAILS.length}@lokal>` });
  }
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const input: any[] = Array.isArray(body.input) ? body.input : [];
    const alles = JSON.stringify(input);
    const system = String(input.find((m: any) => m?.role === "system")?.content ?? "");
    if (MODUS === "wa") {
      const nutzer = input.filter((i) => i?.role === "user").map((i) => String(i.content ?? ""));
      const zweiter = nutzer.some((t) => /darf so nicht raus|noch nicht gut genug/.test(t));
      const p = WA_PLAN ?? { antworten: ["Danke!"] };
      const satz = system.match(/SO ANTWORTEST DU: Sag es ihm kurz und freundlich, sinngemäß: „([^“”]+)“/)?.[1] ?? "";
      const text = String(zweiter ? (p.antworten[1] ?? p.antworten[0]) : p.antworten[0]).replace(/\{SATZ\}/g, satz);
      MODELL.push({ art: "wa", system, alles, zweiter, antwort: text });
      return json(200, { status: "completed", ...modellText(JSON.stringify({ antwort: text, gemerkt: "", mensch: !!p.mensch, uebergabe: "" })), usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
    }
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    MODELL.push({ art: einordnen ? "einordnen" : "antwort", system, alles });
    if (!SZ) return json(500, { error: { message: "kein Szenario" } });
    let aus: any;
    if (einordnen) aus = modellText(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = modellText(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else if (body.tools && SZ.werkzeuge?.length && !alles.includes("function_call_output")) {
      aus = { output: SZ.werkzeuge.map((w, i) => ({ type: "function_call", call_id: `c${i}`, name: w.name, arguments: JSON.stringify(w.args) })) };
    } else aus = modellText("fertig");
    return json(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send/.test(u)) { GMAIL_SENDEN.push(String(init?.body ?? "")); return json(200, { id: `gesendet-${GMAIL_SENDEN.length}`, threadId: "t" }); }
    if (/\/drafts/.test(u)) return json(200, { id: "entwurf-1", message: { id: "x" } });
    if (/\/messages\?/.test(u)) return json(200, { messages: [], resultSizeEstimate: 0 });
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return json(404, { error: { message: "Not Found" } });
      return json(200, {
        id: m[1], threadId: n.thread, labelIds: ["INBOX", "UNREAD"], internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: { mimeType: "text/plain", headers: [
          ...(n.auth === null ? [] : [{ name: "Authentication-Results", value: n.auth ?? `mx.google.com; dmarc=pass (p=NONE) header.from=${(n.von.match(/@([^>\s]+)/)?.[1] ?? "")}` }]),
          ...(n.antwortAn ? [{ name: "Reply-To", value: n.antwortAn }] : []),
          { name: "From", value: n.von }, { name: "To", value: "support@fiaon.com" },
          { name: "Subject", value: n.betreff }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text).toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
  blockiert++;
  return new Response(`blockiert: ${u.split("?")[0]}`, { status: 599 });
}) as any;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const kurz = (t: unknown, n = 140) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);
const M = "Q404";

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const AG = await import("../server/lib/fiaon-mara-angaben-aendern");
  // E-401 Nachbesserung: Eine Mail gilt nur mit Gmails bestandener Absender-Prüfung als „vom hinterlegten Absender“. Die
  // bisherigen Fälle prüfen die echte Kundin — sie bekommen dmarc=pass zur Absender-Domain (wie im Posteingang).
  const echt = (absender: string | null | undefined) => ({ authErgebnis: `mx.google.com; dmarc=pass (p=NONE) header.from=${String(absender ?? "").split("@").pop()}`, antwortAn: null });
  const behandeln = (e: Parameters<typeof AG.angabenAendernBehandeln>[0]) =>
    AG.angabenAendernBehandeln(e.kanal === "mail" && !("absenderPruefung" in e) ? { ...e, absenderPruefung: echt(e.absender) } : e);
  const S = await import("../shared/fiaon-angaben-aendern");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const PERSONEN: number[] = [], NUMMERN: string[] = [];

  async function aufraeumen() {
    const alt = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PR-${M}-%`}`.catch(() => [])) as any[];
    const ids = Array.from(new Set([...PERSONEN, ...alt.map((r) => Number(r.id))]));
    const refs = ((await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-M${M}%`}`) as any[]).map((r) => r.ref);
    for (const n of NUMMERN) {
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
    }
    if (ids.length) {
      await sql`DELETE FROM fiaon_mara_angaben WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_global_angebote WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_postmeister WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_sperr_protokoll WHERE person_id = ANY(${ids})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-M${M}%`}`;
    if (ids.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`;
  }

  /** Ein zahlender Kunde mit Anschrift, Nummer und Mail — alles erfunden. */
  async function kunde(x: string, o: { land?: "DE" | "AT"; test?: boolean; bezahlt?: boolean; mail?: string; tel?: string } = {}) {
    const land = o.land ?? "DE";
    const mail = o.mail ?? `kunde-${x.toLowerCase()}@q404.invalid`;
    const tel = o.tel ?? `15900404${String(100 + PERSONEN.length).padStart(3, "0")}`;
    const e164 = `+49${tel}`;
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, primary_phone, phone_key9, street, zip, city, country, assigned_agent_id, ist_test_am)
      VALUES (${`PR-${M}-${x}`}, 'Prüf', ${`Kunde${x}`}, ${mail}, ${e164}, ${tel.slice(-9)}, 'Altweg 1', ${land === "AT" ? "1010" : "12345"}, ${land === "AT" ? "Wien" : "Altstadt"}, ${land}, 8, ${o.test ? new Date() : null})
      RETURNING id`) as any[];
    const personId = Number(p.id); PERSONEN.push(personId);
    const ref = `FIAON-M${M}${x}-TEST`;
    const bezahlt = o.bezahlt !== false;
    await sql`
      INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, email, phone, phone_country_code,
                                      street, zip, city, country, first_name, last_name, person_id, assigned_agent_id, created_at, paid_at, current_step, submitted_at, agb_stand)
      VALUES (${ref}, ${`FIAON${M}${x}`.slice(0, 11)}, ${bezahlt ? "paid" : "pending_payment"}, ${bezahlt ? "payment_completed" : "payment_pending"}, 'private', 'pro', 'Prüf', 59.99,
              ${mail}, ${tel}, '+49', 'Altweg 1', ${land === "AT" ? "1010" : "12345"}, ${land === "AT" ? "Wien" : "Altstadt"}, ${land}, 'Prüf', ${`Kunde${x}`}, ${personId}, 8,
              NOW() - INTERVAL '40 days', ${bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, 8, NOW() - INTERVAL '40 days', '2026-10-05')`;
    return { personId, ref, mail, tel: e164, waNummer: `49${tel}` };
  }
  const app = async (ref: string) => ((await sql`SELECT email, phone, phone_country_code, street, zip, city, country FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
  const person = async (id: number) => ((await sql`SELECT primary_email, primary_phone, phone_key9, street, zip, city, country FROM fiaon_persons WHERE id = ${id}`) as any[])[0];
  const zeilen = async (id: number) => ((await sql`SELECT * FROM fiaon_mara_angaben WHERE person_id = ${id} ORDER BY id`.catch(() => [])) as any[]);
  // updateCustomerContact schreibt den Verlauf je Feld an die Bestellung (ref), den Vermerk an die Person.
  const akte = async (id: number) => ((await sql`
    SELECT agent_name, type, note FROM fiaon_contact_log
     WHERE person_id = ${id} OR ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${id}) ORDER BY id`) as any[]);
  const mailsAn = (an: string) => MAILS.filter((m) => m.an === an);

  try {
    await aufraeumen();

    console.log("── 1 · Mail vom hinterlegten Absender: neue Anschrift → gespeichert, Verlauf alt → neu, Vermerk, einmal");
    {
      const K = await kunde("A");
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Guten Tag, ich bin umgezogen. Meine neue Adresse: Neuweg 2, 54321 Neustadt. Viele Grüße",
        absender: `Prüf KundeA <${K.mail.toUpperCase()}>`, quelle: "Mail #40401" });
      const a = await app(K.ref), p = await person(K.personId);
      ok(l && l.absenderOk && l.ergebnisse[0]?.stand === "geaendert" && !l.mensch, "Lage: Absender ok, Anschrift gespeichert, kein Mensch", l?.ergebnisse);
      ok(a.street === "Neuweg 2" && a.zip === "54321" && a.city === "Neustadt" && p.street === "Neuweg 2" && p.zip === "54321" && p.city === "Neustadt", "Bestellung UND Person tragen die neue Anschrift", { a, p });
      const ak = await akte(K.personId);
      ok(ak.some((r) => r.type === "edit" && /Straße korrigiert durch Mara \(Mail\): Altweg 1 → Neuweg 2/.test(r.note)) && ak.some((r) => /PLZ korrigiert durch Mara \(Mail\): 12345 → 54321/.test(r.note)),
        "Verlauf je Feld: „Straße korrigiert durch Mara (Mail): Altweg 1 → Neuweg 2“", ak.map((r) => kurz(r.note, 80)));
      ok(ak.filter((r) => r.agent_name === "Postmeister" && /\[Angaben Mail #40401\]/.test(r.note) && /Altweg 1, 12345 Altstadt → Neuweg 2, 54321 Neustadt/.test(r.note)).length === 1,
        "ein Vermerk „Mara hat einen Änderungswunsch bearbeitet … vorher → nachher“");
      ok(/Anschrift: GESPEICHERT/.test(l!.hinweis) && l!.satz === "Ich habe Ihre neue Anschrift gespeichert: Neuweg 2, 54321 Neustadt.", "Hinweis und Satz", l?.satz);
      ok((await zeilen(K.personId)).length === 1 && (await zeilen(K.personId))[0].stand === "geaendert", "eine Zeile (Mail #40401, anschrift, geaendert)");
      const l2 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Guten Tag, ich bin umgezogen. Meine neue Adresse: Neuweg 2, 54321 Neustadt.", absender: K.mail, quelle: "Mail #40401" });
      ok(l2?.wiederholt && l2.ergebnisse[0].stand === "geaendert" && (await akte(K.personId)).filter((r) => /\[Angaben/.test(r.note)).length === 1, "dieselbe Mail noch einmal: „geaendert“ von damals, nichts doppelt");
      const l3 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Nochmal: neue Adresse Neuweg 2, 54321 Neustadt — haben Sie es?", absender: K.mail, quelle: "Mail #40402" });
      ok(l3?.ergebnisse[0].stand === "geaendert" && /Altweg 1/.test(String(l3.ergebnisse[0].vorher)), "neue Mail kurz danach mit derselben Anschrift: bleibt „gespeichert“ (nicht „schon so“)", l3?.ergebnisse);
    }

    console.log("── 2 · Mail vom hinterlegten Absender: neue Telefonnummer → gespeichert, alte als Alias, Hinweis-Mail maskiert");
    {
      const K = await kunde("B", { mail: "pruef.kundeb@gmail.com" });
      const vorher = MAILS.length;
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Hallo, meine neue Handynummer ist 0170 4040123. Gruß", absender: "Pruef.KundeB+fiaon@googlemail.com", quelle: "Mail #40403" });
      const p = await person(K.personId), a = await app(K.ref);
      ok(l?.absenderOk && l.ergebnisse[0]?.stand === "geaendert", "Gmail-Grundform zählt als hinterlegter Absender; Telefon gespeichert", l?.ergebnisse);
      ok(p.primary_phone === "+491704040123" && p.phone_key9 === "704040123" && a.phone === "+491704040123", "Person (mit phone_key9) und Bestellung tragen die neue Nummer", { p, a });
      const alias = (await sql`SELECT kind, value_norm FROM fiaon_person_aliases WHERE person_id = ${K.personId}`) as any[];
      ok(alias.some((x) => x.kind === "phone" && String(x.value_norm).endsWith(K.tel.slice(-9))), "die alte Nummer bleibt als Alias (Anrufe werden weiter erkannt)", alias);
      const h = MAILS.slice(vorher).find((m) => m.an === "pruef.kundeb@gmail.com");
      ok(h && /Telefonnummer bei FIAON wurde geändert/.test(h.betreff) && /•••/.test(h.text) && !h.text.includes("1704040123") && /Waren Sie das nicht\?/.test(h.text), "Hinweis-Mail an die gespeicherte Adresse, Nummern maskiert", h ? kurz(h.text, 200) : MAILS.slice(vorher));
      const ml = (await sql`SELECT event, status, empfaenger FROM fiaon_mail_log WHERE person_id = ${K.personId}`) as any[];
      ok(ml.some((x) => x.event === "angaben_telefon_hinweis" && x.status === "versandt"), "Mail-Protokoll: angaben_telefon_hinweis versandt", ml);
    }

    console.log("── 3 · Mail vom hinterlegten Absender: neue E-Mail-Adresse → erst nach dem Klick (Einmal-Link, HTTP)");
    const express = (await import("express")).default;
    const appX = express();
    appX.use("/api/fiaon", (await import("../server/routes/fiaon-angaben")).default);
    const server = await new Promise<import("node:http").Server>((r) => { const s = appX.listen(0, "127.0.0.1", () => r(s)); });
    const port = (server.address() as any).port;
    const lokal = (link: string) => `http://127.0.0.1:${port}${new URL(link).pathname}`;
    let tokenC = "";
    {
      const K = await kunde("C");
      const vorher = MAILS.length;
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Bitte ändern Sie meine E-Mail-Adresse auf neu.kundec@q404.invalid. Danke", absender: K.mail, quelle: "Mail #40404" });
      ok(l?.ergebnisse[0]?.stand === "link_geschickt" && (await app(K.ref)).email === K.mail, "Lage link_geschickt — die Adresse ist NOCH NICHT geändert", l?.ergebnisse);
      const neu = MAILS.slice(vorher).find((m) => m.an === "neu.kundec@q404.invalid");
      const alt = MAILS.slice(vorher).find((m) => m.an === K.mail);
      const link = neu?.html.match(/https?:\/\/[^"'\s<>]+\/api\/fiaon\/angaben\/email\/[^"'\s<>]+/)?.[0] ?? "";
      ok(neu && /Bitte bestätigen Sie Ihre neue E-Mail-Adresse/.test(neu.betreff) && link, "Bestätigungsmail an die NEUE Adresse mit Knopf-Link", neu ? kurz(neu.html, 120) : MAILS.slice(vorher).map((m) => m.an));
      ok(alt && /soll geändert werden/.test(alt.betreff) && !alt.text.includes("neu.kundec@q404.invalid") && alt.text.includes(S.mailMaske("neu.kundec@q404.invalid")), "Hinweis an die BISHERIGE Adresse, neue nur maskiert", alt ? kurz(alt.text, 160) : "");
      const z = (await zeilen(K.personId))[0];
      ok(z?.stand === "link_geschickt" && z.ablauf_am && Math.abs(new Date(z.ablauf_am).getTime() - Date.now() - 48 * 3_600_000) < 120_000, "Zeile: link_geschickt, Ablauf in 48 Stunden", z);
      tokenC = link.split("/").pop() ?? "";
      const g1 = await echtFetch(lokal(link));
      const g1t = await g1.text();
      ok(g1.status === 200 && /Jetzt bestätigen/.test(g1t) && /<form method="post">/.test(g1t) && (await app(K.ref)).email === K.mail, "GET: Seite mit Knopf — ändert NICHTS (Link-Vorschau sicher)");
      const p1 = await echtFetch(lokal(link), { method: "POST" });
      const p1t = await p1.text();
      const a = await app(K.ref), p = await person(K.personId);
      ok(p1.status === 200 && /Danke — bestätigt/.test(p1t) && a.email === "neu.kundec@q404.invalid" && p.primary_email === "neu.kundec@q404.invalid", "POST: gespeichert — Bestellung (Anmeldung) und Person", { a: a.email, p: p.primary_email });
      const alias = (await sql`SELECT kind, value_norm FROM fiaon_person_aliases WHERE person_id = ${K.personId}`) as any[];
      ok(alias.some((x) => x.kind === "email" && x.value_norm === K.mail), "die alte Adresse bleibt als Alias");
      const p2 = await echtFetch(lokal(link), { method: "POST" });
      ok(/Schon bestätigt/.test(await p2.text()) && (await zeilen(K.personId))[0].stand === "bestaetigt", "zweiter Klick: „Schon bestätigt“, nichts doppelt");
      ok((await akte(K.personId)).some((r) => /\[Angaben bestätigt #\d+\]/.test(r.note) && /über den Bestätigungslink bestätigt/.test(r.note)), "Vermerk: vom Kunden bestätigt");
      const kaputt = tokenC.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
      const p3 = await echtFetch(`http://127.0.0.1:${port}/api/fiaon/angaben/email/${kaputt}`, { method: "POST" });
      ok(p3.status === 400 && /ungültig/.test(await p3.text()), "veränderter Link → ungültig (400)");
    }

    console.log("── 4 · Der Link: abgelaufen, veraltet, ersetzt, höchstens drei in 24 Stunden, Adresse vergeben");
    {
      const K = await kunde("D");
      const l1 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Meine neue E-Mail-Adresse ist eins.kunded@q404.invalid", absender: K.mail, quelle: "Mail #40405" });
      const z1 = (await zeilen(K.personId))[0];
      const t1 = AG.emailToken(Number(z1.id), K.personId, z1.nachher, new Date(z1.ablauf_am));
      const l2 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Doch lieber: meine neue E-Mail-Adresse ist zwei.kunded@q404.invalid", absender: K.mail, quelle: "Mail #40406" });
      ok(l1?.ergebnisse[0].stand === "link_geschickt" && l2?.ergebnisse[0].stand === "link_geschickt" && (await zeilen(K.personId))[0].stand === "ersetzt", "ein neuer Wunsch ersetzt den älteren Link");
      ok((await AG.emailBestaetigen(t1)).art === "veraltet" && (await app(K.ref)).email === K.mail, "der ersetzte Link ändert nichts (veraltet)");
      const z2 = (await zeilen(K.personId))[1];
      await sql`UPDATE fiaon_mara_angaben SET ablauf_am = NOW() - INTERVAL '1 minute' WHERE id = ${z2.id}`;
      const t2alt = AG.emailToken(Number(z2.id), K.personId, z2.nachher, new Date(z2.ablauf_am));
      ok((await AG.emailBestaetigen(t2alt)).art === "ungueltig", "Ablauf verschoben → die Signatur passt nicht mehr (ungültig)");
      const [z2n] = (await sql`SELECT * FROM fiaon_mara_angaben WHERE id = ${z2.id}`) as any[];
      ok((await AG.emailBestaetigen(AG.emailToken(Number(z2n.id), K.personId, z2n.nachher, new Date(z2n.ablauf_am)))).art === "abgelaufen", "abgelaufener Link → abgelaufen");
      const l3 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Meine neue E-Mail-Adresse ist drei.kunded@q404.invalid", absender: K.mail, quelle: "Mail #40407" });
      const z3 = (await zeilen(K.personId))[2];
      await sql`UPDATE fiaon_applications SET email = 'zwischendurch.kunded@q404.invalid' WHERE ref = ${K.ref}`;
      ok(l3?.ergebnisse[0].stand === "link_geschickt" && (await AG.emailBestaetigen(AG.emailToken(Number(z3.id), K.personId, z3.nachher, new Date(z3.ablauf_am)))).art === "veraltet",
        "die gespeicherte Adresse änderte sich inzwischen → veraltet (Erwartungs-Stempel)");
      await sql`UPDATE fiaon_applications SET email = ${K.mail} WHERE ref = ${K.ref}`;
      const l4 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Meine neue E-Mail-Adresse ist vier.kunded@q404.invalid", absender: K.mail, quelle: "Mail #40408" });
      ok(l4?.ergebnisse[0].stand === "mensch" && /drei Bestätigungslinks/.test(String(l4.ergebnisse[0].grund)) && l4.mensch, "der vierte Link in 24 Stunden → ein Mensch prüft", l4?.ergebnisse);
      const K2 = await kunde("E");
      const vorher = MAILS.length;
      const l5 = await behandeln({ personId: K2.personId, kanal: "mail", kundeText: `Meine neue E-Mail-Adresse ist ${K.mail}`, absender: K2.mail, quelle: "Mail #40409" });
      ok(l5?.ergebnisse[0].stand === "mensch" && /anderen Kunden/.test(String(l5.ergebnisse[0].grund)) && MAILS.length === vorher, "Adresse gehört einem anderen Kunden → ein Mensch, keine Mail", l5?.ergebnisse);
    }

    console.log("── 5 · Mail von einer NICHT hinterlegten Adresse → nichts geändert, Weg erklärt, keine Daten verraten");
    {
      const K = await kunde("F");
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Neue Adresse: Neuweg 2, 54321 Neustadt und neue E-Mail fremd.neu@q404.invalid ist meine neue E-Mail-Adresse",
        absender: "jemand@fremd.invalid", quelle: "Mail #40410" });
      const a = await app(K.ref);
      ok(l && !l.absenderOk && l.ergebnisse.every((e) => e.stand === "fremder_absender") && a.street === "Altweg 1" && a.email === K.mail, "nichts geändert (Anschrift, E-Mail)", l?.ergebnisse);
      ok(/hinterlegten E-Mail-Adresse schreiben/.test(l!.satz) && /app\/mehr\/daten/.test(l!.satz) && (l!.geheim ?? []).includes(K.mail), "Satz: hinterlegte Adresse oder Kundenbereich; gespeicherte Daten gelten als geheim");
      ok(S.angabenAntwortFunde(`Bitte schreiben Sie von ${K.mail}.`, l!).some((f) => /gespeicherte Daten/.test(f)), "eine Antwort mit der gespeicherten Adresse wäre hart");
      const lf2 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Meine neue Adresse: Altweg 1, 12345 Altstadt", absender: "jemand@fremd.invalid", quelle: "Mail #40418" });
      ok(lf2?.ergebnisse[0]?.stand === "fremder_absender" && !/schon genau so/.test(lf2.satz), "fremder Absender mit der GESPEICHERTEN Anschrift → kein „schon so hinterlegt“ (verriete die Daten)", lf2?.ergebnisse);
      ok((await akte(K.personId)).some((r) => /\[Angaben Mail #40410\]/.test(r.note) && /NICHT geändert \(nicht vom hinterlegten Absender\)/.test(r.note) && /jemand@fremd\.invalid/.test(r.note)), "Vermerk: nicht übernommen, mit dem fremden Absender");
    }

    console.log("── 5b · E-401 Nachbesserung: gefälschter Absender (From = hinterlegte Adresse, aber ohne Gmail-Prüfung / fremdes Reply-To)");
    {
      // Rot vorher: absenderOk = nur der From-Kopf → Anschrift gespeichert, E-Mail-Link an den Fremden.
      const K = await kunde("F2");
      const vorher = MAILS.length;
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Bitte ändern Sie meine E-Mail-Adresse auf angreifer@fremd.invalid. Neue Adresse: Neuweg 9, 54321 Neustadt",
        absender: K.mail, quelle: "Mail #40420", absenderPruefung: { authErgebnis: null, antwortAn: null } });
      ok(l && !l.absenderOk && l.ergebnisse.every((e) => e.stand === "fremder_absender") && (await app(K.ref)).street === "Altweg 1" && (await app(K.ref)).email === K.mail
        && !MAILS.slice(vorher).some((m) => m.an === "angreifer@fremd.invalid"), "ohne Gmail-Prüfung: nichts geändert, kein Link an die fremde Adresse", l?.ergebnisse);
      ok(/nicht allein auf eine E-Mail hin/.test(l?.satz ?? "") && /gefälscht/.test(l?.hinweis ?? "") && !(l?.satz ?? "").includes(K.mail), "Satz: Kundenbereich; Hinweis: könnte gefälscht sein; keine Daten", l?.satz);
      const l2 = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Neue Adresse: Neuweg 9, 54321 Neustadt", absender: K.mail, quelle: "Mail #40421",
        absenderPruefung: { authErgebnis: `mx.google.com; dmarc=pass header.from=${K.mail.split("@")[1]}`, antwortAn: "angreifer@fremd.invalid" } });
      ok(l2 && !l2.absenderOk && (await app(K.ref)).street === "Altweg 1", "bestandene Prüfung, aber fremdes Reply-To → nichts geändert", l2?.ergebnisse);
      const spaeter = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Meine neue Adresse ab dem 01.12.: Lindenweg 3, 54321 Neustadt", absender: K.mail, quelle: "Mail #40422" });
      ok(spaeter?.ergebnisse[0]?.stand === "mensch" && spaeter.mensch && (await app(K.ref)).street === "Altweg 1", "Anschrift ab später → ein Mensch (nichts sofort gespeichert)", spaeter?.ergebnisse);
    }

    console.log("── 5c · E-401 Nachbesserung: der Stopp-Knopf in der Hinweis-Mail an die bisherige Adresse");
    {
      const K = await kunde("S2");
      const vorher = MAILS.length;
      const l = await behandeln({ personId: K.personId, kanal: "mail", kundeText: "Bitte ändern Sie meine E-Mail-Adresse auf neu.kundes2@q404.invalid", absender: K.mail, quelle: "Mail #40423" });
      const alt = MAILS.slice(vorher).find((m) => m.an === K.mail);
      const stopp = alt?.html.match(/https?:\/\/[^"'\s<>]+\/api\/fiaon\/angaben\/email-stopp\/[^"'\s<>]+/)?.[0] ?? "";
      const neuMail = MAILS.slice(vorher).find((m) => m.an === "neu.kundes2@q404.invalid");
      const bestaetigen = neuMail?.html.match(/https?:\/\/[^"'\s<>]+\/api\/fiaon\/angaben\/email\/[^"'\s<>]+/)?.[0] ?? "";
      ok(l?.ergebnisse[0]?.stand === "link_geschickt" && stopp && /stoppen/i.test(alt?.html ?? ""), "Hinweis-Mail an die bisherige Adresse trägt den Stopp-Knopf", alt ? kurz(alt.html, 160) : MAILS.slice(vorher).map((m) => m.an));
      const g = await echtFetch(lokal(stopp));
      ok(g.status === 200 && /Änderung stoppen/.test(await g.text()) && (await zeilen(K.personId))[0].stand === "link_geschickt", "GET: nur der Knopf — stoppt nichts (Link-Vorschau sicher)");
      const p = await echtFetch(lokal(stopp), { method: "POST" });
      ok(p.status === 200 && /gestoppt/i.test(await p.text()) && (await zeilen(K.personId))[0].stand === "gestoppt", "POST: gestoppt");
      const b = await echtFetch(lokal(bestaetigen), { method: "POST" });
      ok(/gestoppt/i.test(await b.text()) && (await app(K.ref)).email === K.mail, "der Bestätigungslink ändert danach NICHTS mehr", (await app(K.ref)).email);
      ok((await akte(K.personId)).some((r) => /\[Angaben gestoppt #\d+\]/.test(r.note)), "Vermerk „gestoppt“ in der Akte");
      // Schon bestätigt, dann „Das war ich nicht“ → Alarm-Karte für Justin.
      const K2 = await kunde("S3");
      const v2 = MAILS.length;
      await behandeln({ personId: K2.personId, kanal: "mail", kundeText: "Bitte ändern Sie meine E-Mail-Adresse auf neu.kundes3@q404.invalid", absender: K2.mail, quelle: "Mail #40424" });
      const alt2 = MAILS.slice(v2).find((m) => m.an === K2.mail);
      const neu2 = MAILS.slice(v2).find((m) => m.an === "neu.kundes3@q404.invalid");
      const stopp2 = alt2?.html.match(/https?:\/\/[^"'\s<>]+\/api\/fiaon\/angaben\/email-stopp\/[^"'\s<>]+/)?.[0] ?? "";
      await echtFetch(lokal(neu2?.html.match(/https?:\/\/[^"'\s<>]+\/api\/fiaon\/angaben\/email\/[^"'\s<>]+/)?.[0] ?? ""), { method: "POST" });
      const p2 = await echtFetch(lokal(stopp2), { method: "POST" });
      const karte = ((await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE person_id = ${K2.personId} AND art = 'angaben_alarm'`.catch(() => [])) as any[])[0];
      const p2t = await p2.text();
      const akte2 = await akte(K2.personId);
      ok(/Geschäftsführung/.test(p2t) && karte?.status === "offen" && akte2.some((r) => /ALARM/.test(r.note)), "schon bestätigt + „war ich nicht“ → Alarm-Vermerk und Karte für Justin",
        { t: kurz(p2t.replace(/<[^>]+>/g, " "), 160), karte: karte?.titel, z: (await zeilen(K2.personId)).map((z) => z.stand), a: akte2.map((r) => kurz(r.note, 60)) });
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ${K2.personId}`.catch(() => {});
    }

    console.log("── 6 · WhatsApp: von der hinterlegten Nummer ändert sich etwas, von einer anderen nicht (Nummernwechsel → Leitung)");
    {
      const K = await kunde("G", { land: "AT" });
      const vorher = MAILS.length;
      const l = await behandeln({ personId: K.personId, kanal: "whatsapp", kundeText: "Hallo, neue Adresse: Hauptplatz 1, 9020 Klagenfurt und meine neue Nummer ist 0664 4040777",
        nummer: K.waNummer, quelle: "WhatsApp #40411" });
      const a = await app(K.ref), p = await person(K.personId);
      ok(l?.absenderOk && l.ergebnisse.find((e) => e.feld === "anschrift")?.stand === "geaendert" && l.ergebnisse.find((e) => e.feld === "telefon")?.stand === "geaendert", "hinterlegte Nummer: Anschrift und Telefon gespeichert", l?.ergebnisse);
      ok(a.zip === "9020" && a.city === "Klagenfurt" && p.primary_phone === "+436644040777", "AT: PLZ vierstellig (Land der Akte), 0664 → +43", { a, p: p.primary_phone });
      ok(MAILS.slice(vorher).some((m) => m.an === K.mail && /Telefonnummer/.test(m.betreff)), "Hinweis-Mail an die gespeicherte Adresse (auch auf WhatsApp)");
      const K2 = await kunde("H");
      const l2 = await behandeln({ personId: K2.personId, kanal: "whatsapp", kundeText: "Das ist meine neue Nummer 0170 4040888, bitte ändern. Neue Adresse: Neuweg 2, 54321 Neustadt",
        nummer: "4915900409999", quelle: "WhatsApp #40412" });
      const a2 = await app(K2.ref);
      ok(l2 && !l2.absenderOk && l2.ergebnisse.find((e) => e.feld === "telefon")?.stand === "mensch" && l2.ergebnisse.find((e) => e.feld === "anschrift")?.stand === "fremder_absender"
        && a2.street === "Altweg 1" && a2.phone === K2.tel.replace("+49", ""), "andere Nummer: Telefon → Leitung (mensch), Anschrift nicht geändert", l2?.ergebnisse);
      ok(l2!.mensch && /Nummernwechsel per WhatsApp/.test(String(l2!.menschGrund)) && /hinterlegten Telefonnummer schreiben/.test(l2!.satz), "Grund für Justins Karte; Satz nennt den sicheren Weg");
      const K3 = await kunde("J");
      const l3 = await behandeln({ personId: K3.personId, kanal: "whatsapp", kundeText: "Neue Adresse: Neuweg 2, 54321 Neustadt",
        nummer: `43${K3.waNummer.slice(2)}`, quelle: "WhatsApp #40417" });
      ok(l3 && !l3.absenderOk && l3.ergebnisse[0]?.stand === "fremder_absender" && (await app(K3.ref)).street === "Altweg 1",
        "gleiche Ziffern, andere Landesvorwahl (+43 statt +49) → nicht der hinterlegte Absender, nichts geändert", l3?.ergebnisse);
    }

    console.log("── 7 · Testperson, Global-Kunde, nur Verbotenes");
    {
      const T = await kunde("T", { test: true });
      const vorher = MAILS.length;
      const l = await behandeln({ personId: T.personId, kanal: "mail", kundeText: "Neue Adresse: Neuweg 2, 54321 Neustadt; meine neue E-Mail-Adresse ist test.neu@q404.invalid", absender: T.mail, quelle: "Mail #40413" });
      ok(l?.test && l.ergebnisse.every((e) => e.stand === "probe") && l.ergebnisse.some((e) => e.waere === "geaendert") && l.ergebnisse.some((e) => e.waere === "link_geschickt"), "Testperson: gerechnet (wäre gespeichert / Link)", l?.ergebnisse);
      ok((await app(T.ref)).street === "Altweg 1" && !(await zeilen(T.personId)).length && MAILS.length === vorher && !(await akte(T.personId)).length, "… aber nichts geschrieben, nichts verschickt, kein Vermerk");
      const G = await kunde("I", { bezahlt: false });
      await sql`INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, gueltig_bis, person_id)
                VALUES (${`IA-${M}-I`}, 'IA-PRUEF-1', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW() + INTERVAL '30 days', ${G.personId})`;
      const lg = await behandeln({ personId: G.personId, kanal: "mail", kundeText: "Neue Adresse: Neuweg 2, 54321 Neustadt", absender: G.mail, quelle: "Mail #40414" });
      ok(lg === null && (await app(G.ref)).street === "Altweg 1", "Global-Kunde: nichts (E-272) — alles wie bisher");
      const V = await kunde("V");
      const lv = await behandeln({ personId: V.personId, kanal: "mail", kundeText: "Ich habe geheiratet und heiße jetzt anders. Mein Geburtsdatum ist auch falsch.", absender: V.mail, quelle: "Mail #40415" });
      ok(lv && lv.verboten.includes("name") && lv.verboten.includes("geburtsdatum") && lv.mensch && !lv.ergebnisse.length && !(await zeilen(V.personId)).length, "nur Verbotenes: ein Mensch, nichts geschrieben", lv);
      ok(/aufgabe_an_betreuer, Fall 4/.test(lv!.hinweis), "Postfach-Hinweis: Aufgabe wie bisher (Fall 4)");
      ok(await behandeln({ personId: V.personId, kanal: "mail", kundeText: "Wann kommt meine Karte?", absender: V.mail, quelle: "Mail #40416" }) === null, "kein Wunsch → null");
    }

    console.log("── 8 · Postfach Ende zu Ende (Modell- und Gmail-Attrappe): der Server ändert VOR dem Modell, keine Aufgabe, die Wand hält");
    {
      MODUS = "mail";
      const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
      const lauf = await import("../server/lib/fiaon-postmeister-lauf");
      await postmeisterSchema();
      const EIN = ["ki_pause", "postmeister_an", "postmeister_v2"];
      const vorherE = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`) as any[];
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an')`;
      (kp as any).kiPauseZwischenspeicherLeeren?.();
      const lies = (w: unknown) => { if (w == null) return null; if (typeof w === "object") return w; try { const x = JSON.parse(String(w)); return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } };
      const K = await kunde("P");
      const gmailId = "e401ag-1";
      NACHRICHTEN.set(gmailId, { thread: "e401ag-t1", am: Date.now() - 10 * 60_000, von: `Prüf KundeP <${K.mail}>`, betreff: "Neue Adresse",
        text: "Guten Tag, ich bin umgezogen. Meine neue Adresse: Neuweg 7, 54321 Neustadt. Bitte ändern. Gruß" });
      const schritt = { art: "bereich", url: null, text: "" };
      const richtig = "Ich habe Ihre neue Anschrift gespeichert: Neuweg 7, 54321 Neustadt.";
      SZ = {
        einordnung: { kategorien: ["daten"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Meldet seine neue Anschrift.", flags: {} },
        werkzeuge: [{ name: "aufgabe_an_betreuer", args: { titel: "Adresse ändern", text: "Kunde meldet neue Anschrift Neuweg 7.", kollege: "", faellig_in_tagen: 1, dringend: false, rueckruf_am: "" } }],
        antwort: { antwort: "Vielen Dank, ich habe alles für Sie geändert.", naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
        umformuliert: { antwort: richtig, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
      };
      const vorKi = MODELL.length;
      const todosVorher = ((await sql`SELECT COUNT(*)::int n FROM fiaon_betreiber_todos WHERE person_id = ${K.personId}`.catch(() => [{ n: 0 }])) as any[])[0].n;
      await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId, gruss: "Freundliche Grüße\nIhr FIAON Support-Team", modus: "auto" });
      const [z] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[];
      const h = (lies(z?.handlungen) as any[]) ?? [];
      const ki = MODELL.slice(vorKi).filter((x) => x.art === "antwort");
      ok(z && /ANGABEN \(angaben_aendern ist gelaufen/.test(ki[0]?.system ?? "") && (ki[0]?.system ?? "").includes(richtig), "Maras Auftrag enthält ANGABEN und den Satz (vor dem Modell)", z?.aktion);
      ok(h.some((x) => x.werkzeug === "angaben_aendern" && x.ok && /Anschrift gespeichert/.test(x.ergebnis)), "Handlung angaben_aendern steht in der Zeile", h.map((x) => x.werkzeug));
      const aufg = h.find((x) => x.werkzeug === "aufgabe_an_betreuer");
      const todosNach = ((await sql`SELECT COUNT(*)::int n FROM fiaon_betreiber_todos WHERE person_id = ${K.personId}`.catch(() => [{ n: 0 }])) as any[])[0].n;
      ok(aufg && aufg.ok === false && /Nicht nötig: angaben_aendern/.test(aufg.ergebnis) && todosNach === todosVorher, "keine Aufgabe „Adresse ändern“ (Werkzeug gesperrt, kein Auftrag)", { aufg, todosVorher, todosNach });
      ok(String(z?.antwort ?? "").includes(richtig) && !/alles für Sie geändert/.test(String(z?.antwort ?? "")), "„alles geändert“ ohne Anschrift hielt die Wand nicht — die Antwort nennt die gespeicherte", kurz(z?.antwort, 200));
      ok((await app(K.ref)).street === "Neuweg 7", "die Anschrift ist gespeichert");
      console.log(`     (Weg der Antwort: ${z?.aktion} — ${kurz(z?.begruendung, 120)}; gesendet ${GMAIL_SENDEN.length})`);
      if (process.env.ZEIGEN) console.log(JSON.stringify({ pruefung: lies(z?.pruefung), ki: ki.map((x) => kurz(x.alles.slice(-400), 400)) }, null, 1));

      // E-401 Nachbesserung: dieselbe Mail OHNE Gmails Absender-Prüfung (gefälscht) → nichts gespeichert, keine Daten.
      const KF = await kunde("PF");
      NACHRICHTEN.set("e401ag-2", { thread: "e401ag-t2", am: Date.now() - 10 * 60_000, von: `Prüf KundePF <${KF.mail}>`, betreff: "Neue Adresse", auth: null,
        text: "Guten Tag, ich bin umgezogen. Meine neue Adresse: Neuweg 8, 54321 Neustadt. Bitte ändern. Gruß" });
      const sicher = "Aus Sicherheitsgründen ändere ich Ihre Anschrift nicht allein auf eine E-Mail hin — bitte ändern Sie sie selbst in Ihrem Kundenbereich unter fiaon.com/app/mehr/daten.";
      SZ = { ...SZ!, werkzeuge: [], antwort: { antwort: sicher, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] }, umformuliert: { antwort: sicher, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] } };
      await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e401ag-2", gruss: "Freundliche Grüße\nIhr FIAON Support-Team", modus: "entwurf" });
      const [zF] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = 'e401ag-2'`) as any[];
      const hF = (lies(zF?.handlungen) as any[]) ?? [];
      ok(hF.some((x) => x.werkzeug === "angaben_aendern" && /NICHT bestätigt/.test(x.ergebnis)) && (await app(KF.ref)).street === "Altweg 1",
        "Postfach: gefälschter Absender (keine Gmail-Prüfung) → angaben_aendern ändert NICHTS", hF.map((x) => kurz(x.ergebnis, 120)));
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
      for (const v of vorherE) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'e401ag-%'`.catch(() => {});
    }

    console.log("── 9 · WhatsApp Ende zu Ende (maraAntwortet, Modell-Attrappe): Link statt „gespeichert“, Name → Karte für Justin");
    {
      MODUS = "wa";
      const wa = await import("../server/lib/fiaon-whatsapp-mara");
      const EIN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro"];
      const vorherE = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`.catch(() => [])) as any[];
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
      kp.kiPauseZwischenspeicherLeeren();
      const gespraech = async (nummer: string, personId: number, text: string) => {
        NUMMERN.push(nummer);
        await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
        await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => {});
        const gestern = new Date(Date.now() - 20 * 3_600_000);
        await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, person_id, gesendet_am, created_at)
          VALUES ('raus', ${nummer}, 'vorlage', 'Hallo, hier ist Mara, die digitale Assistentin von FIAON.', 'read', 'fiaon_kkb_test', 'Mara', ${personId}, ${gestern}, ${gestern})`;
        const am = new Date(Date.now() - 20_000);
        await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', ${nummer}, 'text', ${text}, 'empfangen', ${personId}, ${am}, ${am})`;
      };
      const lauf = async (nummer: string, personId: number) => {
        const vorher = MODELL.length;
        const protVorher = new Date(Date.now() - 1000);
        const erg = await wa.maraAntwortet(nummer);
        const [g] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
        await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${nummer}`.catch(() => {});
        const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE (nummer = ${nummer} OR person_id = ${personId}) AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
        const karten = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE person_id = ${personId}`.catch(() => [])) as any[];
        return { erg, antwort: String(g?.antwort_text ?? ""), handlung: String(g?.antwort_handlung ?? ""), prot, karten, modell: MODELL.slice(vorher) };
      };
      const K = await kunde("W");
      const vorher = MAILS.length;
      await gespraech(K.waNummer, K.personId, "Hallo Mara, meine neue E-Mail-Adresse ist neu.kundew@q404.invalid bitte ändern");
      WA_PLAN = { antworten: ["Erledigt, Ihre neue E-Mail-Adresse ist gespeichert.", "Danke! {SATZ}"] };
      const r = await lauf(K.waNummer, K.personId);
      const s0 = r.modell[0]?.system ?? "";
      ok(/ANGABEN \(angaben_aendern ist gelaufen/.test(s0) && /NOCH NICHT GEÄNDERT/.test(s0), "Auftrag: ANGABEN — E-Mail noch nicht geändert", kurz(s0.slice(s0.indexOf("ANGABEN")), 200));
      ok(r.modell.some((x) => x.zweiter) && /Bestätigungslink/.test(r.antwort) && !/ist gespeichert/.test(r.antwort) && !r.prot.some((p: any) => p.art === "sicherer_satz"),
        `zweiter Entwurf mit dem Link geht raus: „${kurz(r.antwort, 160)}“`, r.prot.map((p: any) => p.art));
      ok((await app(K.ref)).email === K.mail && MAILS.slice(vorher).some((m) => m.an === "neu.kundew@q404.invalid") && MAILS.slice(vorher).some((m) => m.an === K.mail), "Adresse noch nicht geändert; Link an die neue, Hinweis an die alte");
      ok(r.prot.some((p: any) => p.art === "angaben") && /angaben_aendern \(WhatsApp von der hinterlegten Nummer\)/.test(r.handlung), "Protokoll „angaben“, Handlung im Aktenvermerk", { prot: r.prot.map((p: any) => p.art), h: kurz(r.handlung, 160) });
      ok(!r.karten.length, "keine Karte für Justin (Mara hat es erledigt)");

      const N = await kunde("X");
      await gespraech(N.waNummer, N.personId, "Ich habe geheiratet und heiße jetzt anders, bitte ändern Sie meinen Nachnamen.");
      WA_PLAN = { antworten: ["Danke! {SATZ}"] };
      const r2 = await lauf(N.waNummer, N.personId);
      ok(/ändere ich nicht selbst — das prüft unsere Geschäftsführung persönlich/.test(r2.antwort) && !r2.modell.some((x) => x.zweiter) && !r2.prot.some((p: any) => p.art === "sicherer_satz"),
        `erster Entwurf geht raus (kein „Abschieben“): „${kurz(r2.antwort, 140)}“`, r2.prot.map((p: any) => p.art));
      ok(r2.karten.some((k: any) => /Änderungswunsch/.test(JSON.stringify(k))), "Karte für Justin mit dem Änderungswunsch (Name)", r2.karten.map((k: any) => kurz(k.titel ?? k.schluessel, 80)));

      const Y = await kunde("Y");
      await gespraech(Y.waNummer, Y.personId, "Bin umgezogen! Neue Adresse: Bergweg 9, 65432 Bergdorf");
      WA_PLAN = { antworten: ["Alles klar, erledigt!", "Super, alles erledigt!"] };
      const r3 = await lauf(Y.waNummer, Y.personId);
      ok(r3.prot.some((p: any) => p.art === "sicherer_satz") && r3.antwort === "Ich habe Ihre neue Anschrift gespeichert: Bergweg 9, 65432 Bergdorf." && (await app(Y.ref)).street === "Bergweg 9",
        `beide Entwürfe ohne die Anschrift → der sichere Satz aus dem, was der Server tat: „${kurz(r3.antwort, 120)}“`, r3.prot.map((p: any) => p.art));
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
      for (const v of vorherE) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    }

    server.close();
    ok(blockiert === 0, `kein Netzaufruf außer den Attrappen (${blockiert})`);
  } finally {
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  }
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
