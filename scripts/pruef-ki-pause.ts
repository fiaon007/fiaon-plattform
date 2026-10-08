// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KI-PAUSE BEI OPENAI-ABRECHNUNGSFEHLER (27.09.2026, E-246)
//
// Justin: „Wenn OpenAI nicht abbuchen kann, dann soll alles, was über OpenAI
// läuft, pausieren. Nichts Wirres oder Falsches schicken, sondern einfach
// Pause, bis ich es wieder aktiviere." Regel: server/lib/fiaon-ki-pause.ts.
//
//   A. Erkennung: insufficient_quota & Co. = Abrechnung; 401/403 = Zugang;
//      Ratenlimit, slow_down, 5xx, model_not_found = KEINE Pause.
//   B. Ratenlimit / 500 / fremder Schlüssel über openaiFetch → keine Pause.
//   C. Erster Abrechnungsfehler (Mara WhatsApp): Zustand pausiert, genau EIN
//      Alarm (Betreiber-Brett, Prio 1), kein zweiter Netzversuch, KEIN Versand,
//      kein Rückfallsatz, keine Aufgabe je Nachricht.
//   D. Pausiert → kein weiterer Netzaufruf, über alle Wege (Mara WA, Nachholen,
//      Postmeister, Mara-Aktion, Daueraufträge, Kontoauszug, Transkript,
//      Ratgeber, Radar, Netz unter allem). Nichts Falsches gespeichert
//      (kein „unlesbar", kein „fehlgeschlagen", Dauerauftrag nicht verbraucht).
//   E. Erster Fehler mitten im Postmeister: Mail zurückgelegt, kein Fehlversuch,
//      kein Aktenvermerk, keine Aufgabe, keine Gmail-Sendung.
//   F. Erster Fehler in der Mara-Aktion: keine „abgelehnt"-Zeile (keine 24 h Ruhe).
//   G. Aktivieren: Probe scheitert → Pause bleibt; Probe ok → aktiv, die Läufe
//      arbeiten nach (Kontoauszug, Transkript, WhatsApp, Dauerauftrag, Postfach-Fenster).
//   H. Quelltext-Wand: keine OpenAI-URL und kein OpenAI-SDK außerhalb des Helfers.
//   I. Nachprüfung 27.09. (Befunde „technik"): automatische Pause nur im
//      Produktionsdienst (sonst prozesslokal, kein DB-Schreiben, kein Alarm),
//      Fingerabdruck des Schlüssels, Nachholen nebenläufig sicher (Laufsperre +
//      Prozesssperre + Anspruch), SCHUFA-Leichen abgehakt, Datenschutz bei
//      Widerspruch gegen die Aufzeichnung, fetch(Request, init), „Neu auswerten"
//      in der Pause ohne neue Zeile, Dokumentprüfung nachgeholt, LAUF_FOLGEN,
//      Band zählt nur Pause-bezogen, Alarmtext mit Mail-Hinweis.
//
// Die Produktionsbedingung (Render) wird hier simuliert: kiPauseProduktionSimulieren(true).
//
// NUR gegen die lokale Test-DB; KEIN Netz (fetch ist vollständig nachgebaut,
// OpenAI, Gmail und Twilio sind Attrappen, alles andere wirft).
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-ki-pause.ts
// Die eigenen Datensätze (Nummer 49159002460xx, Referenzen FIAON-P246…, Personen PRUEF246-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";

// ── Attrappen VOR jedem Import ────────────────────────────────────────────
const HAUS_SCHLUESSEL = "sk-pruef-lokal-e246";
process.env.OPENAI_API_KEY = HAUS_SCHLUESSEL;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e246.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.pruef.invalid/token",
});

type Szenario = "quota" | "rate" | "500" | "zugang" | "modell" | "ok";
let szenario: Szenario = "ok";
const OPENAI: { url: string; body: any; methode?: string }[] = [];
const GMAIL: { methode: string; url: string }[] = [];
const GMAIL_SENDEN: string[] = [];
const FREMD: string[] = [];
let gmailListe: string[] = [];
const gmailSuchen: string[] = [];
const MAIL_ID = "e246-mail-1";
/** Was die Attrappe auf /responses antwortet, wenn alles gut ist — je Aufrufer gewählt. */
/** Haken mitten im Netzaufruf (Nachbesserung 27.09.): läuft einmal, bevor die Attrappe antwortet; eine Zahl = mit diesem HTTP-Status scheitern. */
const netzHaken: { whisper?: () => Promise<number | void>; chat?: () => Promise<number | void> } = {};
const hakenZiehen = async (art: "whisper" | "chat") => { const h = netzHaken[art]; netzHaken[art] = undefined; return h ? await h() : undefined; };
let responsesText = (_body: any): string => JSON.stringify({ antwort: "Gern, ich bin Mara, die digitale Assistentin von FIAON. Wie kann ich Ihnen helfen?", gemerkt: "", mensch: false, uebergabe: "" });

const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    // Wie das native fetch: bei einem Request-Objekt kommen Methode und Körper aus dem Objekt, init hat Vorrang.
    const istReq = typeof Request !== "undefined" && eingabe instanceof Request;
    const rohBody = typeof init?.body === "string" ? init.body : istReq && init?.body === undefined ? await eingabe.clone().text().catch(() => "") : null;
    let body: any = null; try { body = rohBody ? JSON.parse(rohBody) : null; } catch { body = null; }
    const methode = String(init?.method ?? (istReq ? eingabe.method : "GET")).toUpperCase();
    OPENAI.push({ url: u, body, methode });
    const auth = String(init?.headers?.Authorization ?? init?.headers?.authorization ?? (istReq ? eingabe.headers.get("authorization") : "") ?? "");
    if (szenario === "quota") return json(429, { error: { message: "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.", type: "insufficient_quota", param: null, code: "insufficient_quota" } });
    if (szenario === "rate") return json(429, { error: { message: "Rate limit reached for requests", type: "requests", param: null, code: "rate_limit_exceeded" } });
    if (szenario === "500") return json(500, { error: { message: "The server had an error while processing your request.", type: "server_error" } });
    if (szenario === "zugang") return json(401, { error: { message: "Incorrect API key provided.", type: "invalid_request_error", code: "invalid_api_key" } });
    if (szenario === "modell") return json(403, { error: { message: "Project does not have access to model gpt-9", type: "invalid_request_error", code: "model_not_found" } });
    void auth;
    if (u.endsWith("/audio/transcriptions")) { const st = await hakenZiehen("whisper"); if (st) return json(st, { error: { message: "Prüf-Störung", type: "server_error" } }); }
    if (u.endsWith("/chat/completions")) { const st = await hakenZiehen("chat"); if (st) return json(st, { error: { message: "Prüf-Störung", type: "server_error" } }); }
    if (u.endsWith("/audio/transcriptions")) return json(200, { text: "Guten Tag, hier ist FIAON. Wir haben über Ihren Antrag gesprochen und vereinbart, dass Sie die Unterlagen morgen schicken." });
    if (u.endsWith("/chat/completions")) {
      const name = body?.response_format?.json_schema?.name;
      if (name === "kontoauszug_kopf") return json(200, { choices: [{ message: { content: JSON.stringify({ ist_kontoauszug: false, dokument_art: "rechnung", bank: null, zeitraum_von: null, zeitraum_bis: null, saldo_anfang_cents: null, saldo_ende_cents: null }) } }], usage: {} });
      return json(200, { choices: [{ message: { content: "Es ging um den Antrag; vereinbart ist, dass die Unterlagen morgen kommen." } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
    }
    if (u.endsWith("/responses")) {
      const istOcr = Array.isArray(body?.input) && JSON.stringify(body.input).includes("input_file");
      const text = istOcr ? "=== Seite 1 ===\nRechnung Nr. 4711 über 12,00 EUR" : responsesText(body);
      return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }], usage: { input_tokens: 10, output_tokens: 10 } });
    }
    return json(404, { error: { message: "unbekannt" } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    GMAIL.push({ methode, url: u });
    if (/\/messages\/send|\/drafts/.test(u)) { GMAIL_SENDEN.push(u); return json(200, { id: "nie" }); }
    if (/\/messages\?/.test(u)) { gmailSuchen.push(decodeURIComponent(new URL(u).searchParams.get("q") ?? "")); return json(200, { messages: gmailListe.map((id) => ({ id })), resultSizeEstimate: gmailListe.length }); }
    if (u.includes(`/messages/${MAIL_ID}?format=full`)) {
      return json(200, {
        id: MAIL_ID, threadId: "e246-faden", labelIds: ["INBOX", "UNREAD"], internalDate: String(Date.now() - 60_000), snippet: "Wann kommt meine Karte?",
        payload: { mimeType: "text/plain", headers: [{ name: "From", value: "Prüf Kunde <pruef246@kunde.invalid>" }, { name: "To", value: "support@fiaon.com" }, { name: "Subject", value: "Frage zur Karte" }, { name: "Message-ID", value: "<e246@kunde.invalid>" }],
          body: { data: Buffer.from("Guten Tag, wann kommt meine Karte? Viele Grüße").toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
  if (u.startsWith("https://api.twilio.pruef.invalid/")) return new Response(new Uint8Array(4096), { status: 200 });
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}

const { sqlPool: sql } = await import("../server/lib/db-pool");
const kp = await import("../server/lib/fiaon-ki-pause");
// Das Netz unter allem — nach der Attrappe, damit __kiRohFetch die Attrappe ist (wie in server/index.ts vor den Routen).
kp.kiNetzAbsichern();
// Automatisch pausiert nur der Produktionsdienst (Render) — hier simuliert; Teil I prüft das Gegenteil.
kp.kiPauseProduktionSimulieren(true);

const START = new Date();
const [vorherRoh] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'ki_pause'`) as any[];
const EINSTELLUNGEN = ["ki_pause", "ki_pause_wa_gesammelt", "mara_aktion_an", "mara_aktion_stufen", "mara_aktion_je_stunde", "mara_aktion_tag_euro", "mara_aktion_start", "postmeister_an", "mara_wa_an"];
const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`) as any[];
await sql`DELETE FROM fiaon_settings WHERE key = 'ki_pause'`;
kp.kiPauseZwischenspeicherLeeren();

const NUMMER = "4915900246001";
const NUMMER_ALT = "4915900246002";
const NUMMER_ALT2 = "4915900246003";
const REF = "FIAON-P246KA";
const REF_B = "FIAON-P246MB";
const REF_S = "FIAON-P246SA";   // Auskunft liegt an der Bestellung
const REF_S2 = "FIAON-P246SB";  // dieselbe Person, Bestellung OHNE Auskunft (Leiche)
const NUMMER_ALT3 = "4915900246004";
const NACHHOL_TAKTE = ["kontoauszug_nachholen", "schufa_nachholen", "transkript_nachholen"];
let personId = 0, personB = 0, personS = 0, callId = 0, dauerId = 0;
const extraCalls: number[] = [];

const alarme = async () => (await sql`SELECT id, schluessel, titel, text, prioritaet, status FROM fiaon_betreiber_todos WHERE quelle = 'ki-pause' AND created_at >= ${START} AND schluessel LIKE 'ki-pause-2%'`) as any[];
const zustand = () => kp.kiPauseLesen(true);
const aktivierenOhneNachholen = async () => { await kp.aktivieren("Prüfstand", { probe: false, nachholen: false }); kp.kiPauseZwischenspeicherLeeren(); };

try {
  // Alte, hängende Laufsperren der Nachhol-Takte (nur lokale Test-DB) würden nachDerPause hier blockieren.
  await sql`UPDATE fiaon_lauf_historie SET ergebnis = 'abgebrochen', beendet = NOW() WHERE name = ANY(${NACHHOL_TAKTE}) AND ergebnis = 'laeuft'`.catch(() => {});
  // ── Testdaten ──────────────────────────────────────────────────────────
  const { PDFDocument } = await import("pdf-lib");
  const leer = await PDFDocument.create(); leer.addPage([595, 842]);
  const leerPdf = Buffer.from(await leer.save());
  const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PRUEF246-A', 'Prüf', 'E246 Auszug', 'pruef246a@kunde.invalid') RETURNING id`) as any[];
  personId = Number(p.id);
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, bank_statement_pdf, documents_uploaded_at)
            VALUES (${REF}, ${personId}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', 'FIAON-P246KA-1', 'paid', 59.99, 'Prüf', 'E246 Auszug', 'pruef246a@kunde.invalid', ${leerPdf}, NOW())`;
  const [pb] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PRUEF246-B', 'Prüf', 'E246 Aktion', 'pruef246b@kunde.invalid') RETURNING id`) as any[];
  personB = Number(pb.id);
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email)
            VALUES (${REF_B}, ${personB}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', 'FIAON-P246MB-1', 'pending_payment', 59.99, 'Prüf', 'E246 Aktion', 'pruef246b@kunde.invalid')`;
  for (const n of [NUMMER, NUMMER_ALT, NUMMER_ALT2]) {
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`;
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
  }
  // Frische Frage (vor 10 Minuten) und eine alte aus der Pause (vor 25 Stunden) — beide ohne Antwort.
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUMMER}, 'text', 'Hallo, wann kommt meine Karte?', 'empfangen', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes')`;
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUMMER_ALT}, 'text', 'Bitte um Rückruf wegen meiner Rate', 'empfangen', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours')`;
  const [c] = (await sql`INSERT INTO fiaon_calls (agent_id, nummer, richtung, beginn, status, transkript_status, recording_url, person_id, ref)
            VALUES (9001, '4915900246099', 'ausgehend', NOW() - INTERVAL '20 minutes', 'beendet', 'offen', 'https://api.twilio.pruef.invalid/rec.mp3', ${personId}, ${REF}) RETURNING id`) as any[];
  callId = Number(c.id);
  const { auftragTabellen } = await import("../server/lib/fiaon-mara-auftrag");
  await auftragTabellen();
  const [d] = (await sql`INSERT INTO fiaon_mara_dauerauftrag (befehl, takt, uhrzeit, an, von) VALUES ('Prüfstand E246: Zeig mir die offenen Rückrufe', 'taeglich', '00:00', TRUE, 'Prüfstand') RETURNING id`) as any[];
  dauerId = Number(d.id);

  // ═══ A. Erkennung ═══════════════════════════════════════════════════════
  console.log("── A. Erkennung (abrechnungsFehler) ─────────────────────────────");
  const quotaBody = { error: { message: "You have no credits remaining. Add credits …", type: "insufficient_quota", code: "insufficient_quota" } };
  ok(kp.abrechnungsFehler(429, quotaBody) === "abrechnung", "429 insufficient_quota (gemessen 24.09.) → Abrechnung");
  ok(kp.abrechnungsFehler(429, JSON.stringify(quotaBody)) === "abrechnung", "… auch als Text");
  for (const code of ["credit_balance_exhausted", "organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded", "billing_hard_limit_reached"]) {
    ok(kp.abrechnungsFehler(429, { error: { message: "x", type: "requests", code } }) === "abrechnung", `429 ${code} → Abrechnung`);
  }
  ok(kp.abrechnungsFehler(429, { error: { message: "You exceeded your current quota, please check your plan and billing details.", type: "requests", code: null } }) === "abrechnung", "429 „exceeded your current quota“ (nur Text) → Abrechnung");
  ok(kp.abrechnungsFehler(429, { error: { message: "Rate limit reached for requests", type: "requests", code: "rate_limit_exceeded" } }) === null, "429 rate_limit_exceeded → KEINE Pause");
  ok(kp.abrechnungsFehler(429, { error: { message: "Please slow down", type: "requests", code: "slow_down" } }) === null, "429 slow_down → KEINE Pause");
  ok(kp.abrechnungsFehler(500, { error: { message: "server error" } }) === null, "500 → KEINE Pause");
  ok(kp.abrechnungsFehler(503, { error: { message: "Unable to verify model access", code: "server_is_overloaded" } }) === null, "503 → KEINE Pause");
  ok(kp.abrechnungsFehler(400, { error: { message: "invalid_file", code: "invalid_file" } }) === null, "400 → KEINE Pause");
  ok(kp.abrechnungsFehler(401, { error: { message: "Incorrect API key provided", code: "invalid_api_key" } }) === "zugang", "401 falscher Schlüssel → Zugang (Pause)");
  ok(kp.abrechnungsFehler(401, { error: { message: "account_deactivated", code: "account_deactivated" } }) === "zugang", "401 Konto deaktiviert → Zugang (Pause)");
  ok(kp.abrechnungsFehler(403, { error: { message: "Project does not have access to model gpt-9", code: "model_not_found" } }) === null, "403 model_not_found → KEINE Pause (nur ein Dienst)");
  // Nachprüfung 27.09.: Ratenlimit mit Billing-Link (kleine Konto-Stufen) ist KEINE Abrechnung.
  const rateBilling = "Rate limit reached for gpt-4.1-mini in organization org-x on requests per day (RPD): Limit 200, Used 200. Please try again in 7m12s. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.";
  ok(kp.abrechnungsFehler(429, { error: { message: rateBilling, type: "requests", code: "rate_limit_exceeded" } }) === null, "429 rate_limit_exceeded MIT Billing-Link → KEINE Pause");
  ok(kp.abrechnungsFehler(429, { error: { message: rateBilling, type: "requests", code: null } }) === null, "429 Ratenlimit-Text mit Billing-Link, ohne Code → KEINE Pause");
  ok(kp.abrechnungsFehler(429, JSON.stringify({ error: { message: "Rate limit reached", type: "tokens", code: "rate_limit_exceeded" }, hinweis: "billing" })) === null, "Rohtext außerhalb von err.message zählt nicht");
  ok(kp.abrechnungsFehler(429, "<html><title>429 Too Many Requests</title>billing</html>") === null, "429 als HTML (Rand/Proxy) → KEINE Pause");
  ok(kp.abrechnungsFehler(402, { error: { message: "Payment required", type: "billing", code: null } }) === "abrechnung", "402 mit Fehlerobjekt → Abrechnung");
  // 401/403 nur mit Schlüssel-/Konto-Merkmal.
  ok(kp.abrechnungsFehler(403, "<!DOCTYPE html><title>Attention Required! | Cloudflare</title>") === null, "403 Cloudflare-HTML → KEINE Pause");
  ok(kp.abrechnungsFehler(401, "Unauthorized") === null, "401 ohne OpenAI-JSON → KEINE Pause");
  ok(kp.abrechnungsFehler(401, { error: { message: "OpenAI-Organization header should match organization for API key", type: "invalid_request_error", code: "mismatched_organization" } }) === null, "401 mismatched_organization → KEINE Pause (Kopf eines Aufrufs)");
  ok(kp.abrechnungsFehler(401, { error: { message: "You have insufficient permissions for this operation. Missing scopes: api.responses.write.", type: "invalid_request_error", code: null } }) === null, "401 fehlende Schlüsselrechte → KEINE Pause (nur ein Dienst)");
  ok(kp.abrechnungsFehler(401, { error: { message: "Incorrect API key provided: sk-proj-****abcd.", type: "invalid_request_error", code: null } }) === "zugang", "401 „Incorrect API key“ ohne Code → Zugang");
  ok(kp.abrechnungsFehler(403, { error: { message: "Country, region, or territory not supported", type: "request_forbidden", code: "unsupported_country_region_territory" } }) === "zugang", "403 Land gesperrt → Zugang");
  ok(kp.abrechnungsFehler(401, { error: { message: "billing not active", type: "invalid_request_error", code: "billing_not_active" } }) === "abrechnung", "401 billing_not_active → Abrechnung");
  ok(kp.istKiPause(new kp.KiPausiertFehler("x")) && kp.istKiPause("KI pausiert — …") && !kp.istKiPause(new Error("HTTP 429")), "istKiPause erkennt Fehler und Text");
  ok(kp.istKiPause(Object.assign(new Error("Connection error."), { cause: new kp.KiPausiertFehler("sdk") })), "istKiPause erkennt die SDK-Hülle (cause)");

  // ═══ B. Keine Pause bei vorübergehenden Fehlern ═════════════════════════
  console.log("── B. Ratenlimit / 500 / Modellrechte / fremder Schlüssel ─────────");
  const probeRuf = (schluessel = HAUS_SCHLUESSEL) => kp.openaiFetch("pruef", "/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" }, body: "{}" });
  szenario = "rate"; const r1 = await probeRuf();
  ok(r1.status === 429 && !(await zustand()).an, "429 rate_limit_exceeded: Antwort kommt durch, keine Pause");
  szenario = "500"; const r2 = await probeRuf();
  ok(r2.status === 500 && !(await zustand()).an, "500: Antwort kommt durch, keine Pause");
  szenario = "modell"; const r3 = await probeRuf();
  ok(r3.status === 403 && !(await zustand()).an, "403 model_not_found: keine Pause");
  szenario = "quota"; const r4 = await probeRuf("sk-fremdes-konto");
  ok(r4.status === 429 && !(await zustand()).an, "Abrechnungsfehler mit FREMDEM Schlüssel (z. B. ASSISTENT_API_KEY): keine Pause des Hauskontos");
  ok((await alarme()).length === 0, "Kein Alarm aus B");

  // ═══ C. Erster Abrechnungsfehler: Mara WhatsApp ═════════════════════════
  console.log("── C. Erster Abrechnungsfehler (Mara WhatsApp) ────────────────────");
  const wa = await import("../server/lib/fiaon-whatsapp-mara");
  szenario = "quota";
  const netzVorC = OPENAI.length;
  const todosVorC = Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos`) as any[])[0].n);
  const erg = await wa.maraAntwortet(NUMMER);
  const zC = await zustand();
  ok(erg.gesendet === false && /KI pausiert/.test(String(erg.grund)), `maraAntwortet → „${erg.grund}“`);
  ok(OPENAI.length - netzVorC === 1, `genau EIN Netzaufruf (kein zweiter Versuch): ${OPENAI.length - netzVorC}`);
  ok(zC.an && zC.art === "abrechnung" && zC.dienst === "mara-whatsapp" && zC.von === "automatisch", `Zustand pausiert (art ${zC.art}, dienst ${zC.dienst})`);
  ok(/kein Guthaben/.test(String(zC.grund)), `Grund in Klartext: „${zC.grund}“`);
  const [gC] = (await sql`SELECT antwort_text, ki_rueckfall_auf_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${NUMMER}`) as any[];
  ok(!gC?.antwort_text, "Keine Antwort vorbereitet (kein Rückfallsatz)");
  ok(!gC?.ki_rueckfall_auf_id, "Kein „Rückfall offen“-Vermerk");
  const [rausC] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp WHERE nummer = ${NUMMER} AND richtung = 'raus'`) as any[];
  ok(Number(rausC.n) === 0, "Keine ausgehende WhatsApp");
  const aC = await alarme();
  ok(aC.length === 1, `Genau EIN Alarm: ${aC.length}`);
  ok(aC[0] && Number(aC[0].prioritaet) === 1 && aC[0].schluessel === `ki-pause-${zC.seit}`, "Alarm mit Priorität 1 und Schlüssel je Pause");
  ok(aC[0] && String(aC[0].text).startsWith(kp.KI_PAUSE_ALARM_TEXT), "Alarmtext: „OpenAI konnte nicht abbuchen — alle KI-Funktionen pausiert. Nach dem Aufladen … ‚KI wieder aktivieren‘ drücken.“");
  const fp = kp.schluesselFingerabdruck(HAUS_SCHLUESSEL);
  ok(fp === `…${HAUS_SCHLUESSEL.slice(-6)}` && zC.schluessel === fp, `I/1 Fingerabdruck des Schlüssels im Zustand: ${zC.schluessel}`);
  ok(aC[0] && String(aC[0].text).includes(`Schlüssel ${fp}`) && !String(aC[0].text).includes(HAUS_SCHLUESSEL), "I/1 Fingerabdruck im Alarm (nie der ganze Schlüssel)");
  ok(aC[0] && String(aC[0].text).includes(kp.KI_PAUSE_MAIL_HINWEIS), "I/6 Alarm: „Mails an support@/welcome@ … von Hand beantworten UND in Gmail archivieren oder liegen lassen — Mara holt nach.“");
  const [neuTodosC] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos`) as any[];
  ok(Number(neuTodosC.n) - todosVorC === 1, `Keine Aufgabe je Nachricht (nur der Alarm): ${Number(neuTodosC.n) - todosVorC} neu`);
  const [kiZeile] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_ki_nutzung WHERE dienst = 'ki-pause' AND created_at >= ${START}`) as any[];
  ok(Number(kiZeile.n) === 1, "Eine Zeile „ki-pause“ im Kostenprotokoll");
  // Ein zweiter Abrechnungsfehler (zweiter Prozess, gleicher Moment) → kein zweiter Alarm.
  const zweit = await kp.pausieren({ art: "abrechnung", fehler: "HTTP 429 insufficient_quota", dienst: "radar", von: "automatisch" });
  ok(zweit.neu === false && (await alarme()).length === 1, "Zweiter Fehler: keine neue Pause, kein zweiter Alarm");

  // ═══ D. Pausiert → kein Netz, nichts Falsches ═══════════════════════════
  console.log("── D. Pausiert: kein Netzaufruf, nichts an Kunden, nichts Falsches ──");
  const netzD = OPENAI.length;
  const { kiAufruf } = await import("../server/lib/fiaon-postmeister-agent");
  let fD: unknown = null; try { await kiAufruf({ dienst: "pruef", modell: "gpt-5.5", nachrichten: [{ role: "user", content: "x" }] }); } catch (e) { fD = e; }
  ok(kp.istKiPause(fD), "kiAufruf → KiPausiertFehler");
  let fNetz: unknown = null; try { await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${HAUS_SCHLUESSEL}` }, body: "{}" }); } catch (e) { fNetz = e; }
  ok(kp.istKiPause(fNetz), "Netz unter allem: ein roher fetch an api.openai.com wird angehalten");
  const e2 = await wa.maraAntwortet(NUMMER);
  ok(/KI pausiert/.test(String(e2.grund)), "Mara WhatsApp antwortet nicht (KI pausiert)");
  ok((await wa.nachholLauf()).angestossen === 0, "WhatsApp-Nachholen stößt nichts an");
  // Postmeister: pausiert = keine Mail angefasst, keine Gmail-Abfrage
  gmailListe = [MAIL_ID];
  const pm = await import("../server/routes/fiaon-postmeister");
  const gmailVorD = GMAIL.length;
  const lauf = await pm.postmeisterLauf({});
  ok(lauf.verarbeitet === 0 && lauf.aktionen.ki_pausiert === 1, "Postmeister-Lauf: nichts verarbeitet, „ki_pausiert“");
  ok(GMAIL.length === gmailVorD, "Postmeister-Lauf: kein Gmail-Zugriff (Mails bleiben ungelesen)");
  const { mailBearbeiten } = await import("../server/lib/fiaon-postmeister-lauf");
  const mb = await mailBearbeiten({ postfach: "support@fiaon.com", gmailId: MAIL_ID, gruss: "Gruß", modus: "auto" });
  const [pmZeile] = (await sql`SELECT id FROM fiaon_postmeister WHERE gmail_id = ${MAIL_ID}`) as any[];
  ok(mb.grund === "KI pausiert" && !pmZeile, "mailBearbeiten: nicht beansprucht, keine Zeile");
  // Mara-Aktion
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_aktion_an', 'an') ON CONFLICT (key) DO UPDATE SET value = 'an'`;
  const { maraAktionLauf } = await import("../server/lib/fiaon-mara-aktion");
  const ma = await maraAktionLauf();
  ok(ma.grund === "KI pausiert" && ma.gesendet === 0, "Mara-Aktion: kein Durchgang (KI pausiert)");
  // Daueraufträge
  const { dauerauftraegeLaufen } = await import("../server/lib/fiaon-mara-auftrag");
  await dauerauftraegeLaufen();
  const [dD] = (await sql`SELECT letzter_lauf FROM fiaon_mara_dauerauftrag WHERE id = ${dauerId}`) as any[];
  const [aD] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_auftrag WHERE dauerauftrag_id = ${dauerId}`) as any[];
  ok(!dD.letzter_lauf && Number(aD.n) === 0, "Dauerauftrag: nicht verbraucht, kein Auftrag mit „Rückfrage“");
  // Kontoauszug (Foto-PDF → Texterkennung) — erst NACH der Seitenprüfung ohne Modell
  const ka = await import("../server/lib/fiaon-kontoauszug-analyse");
  const an = await ka.kontoauszugAnalysieren(REF, { erzwingen: true });
  const [kaz] = (await sql`SELECT status, fehler FROM fiaon_kontoauszug_analysen WHERE ref = ${REF} ORDER BY created_at DESC LIMIT 1`) as any[];
  ok(kaz?.status === "fehler" && /^KI pausiert/.test(String(kaz?.fehler)), `Kontoauszug: „fehler / KI pausiert“, NICHT „unlesbar“ (${kaz?.status})`);
  ok(an?.status !== "unlesbar", "Kunde bekommt keine Bitte um eine neue Datei");
  const [vermerk] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${REF} AND note ILIKE '%nicht lesbar%'`) as any[];
  ok(Number(vermerk.n) === 0, "Kein Aktenvermerk „nicht lesbar“");
  ok((await ka.auszuegeNachholen(4)).gestartet === 0, "Kontoauszug-Nachholen tut in der Pause nichts");
  // Transkript
  const tr = await import("../server/lib/fiaon-transkript");
  const t1 = await tr.anrufNachbereiten(callId);
  const [cD] = (await sql`SELECT transkript_status, transkript_grund FROM fiaon_calls WHERE id = ${callId}`) as any[];
  ok(!t1.ok && cD.transkript_status === "offen" && /^KI pausiert/.test(String(cD.transkript_grund)), `Transkript bleibt „offen“ (nicht „fehlgeschlagen“): ${cD.transkript_status}`);
  ok((await tr.transkriptLauf()) === 0, "Transkript-Lauf tut in der Pause nichts");
  // Ratgeber, Radar
  const rg = await import("../server/routes/fiaon-ratgeber");
  await rg.ratgeberTageslauf();
  const radar = await import("../server/lib/fiaon-radar");
  const rt = await radar.radarTageslauf(new Date(new Date().setHours(10, 0, 0, 0)));
  ok(rt.fehler === "KI pausiert" || rt.ruhe, "Firmen-Radar: Tageslauf ruht");
  // Mail-KI (Entwurfshilfe) und Assistent-Satz
  const mk = await import("../server/lib/fiaon-mail-ki");
  const ent = await mk.kiEntwurf("entwurf", "Kunde fragt, wann seine Karte kommt").catch((e: any) => ({ ok: false, grund: String(e?.message) }));
  ok(!ent.ok && /^KI pausiert/.test(String((ent as any).grund)), `Mail-KI zeigt „KI pausiert“: ${String((ent as any).grund).slice(0, 60)}`);
  ok(OPENAI.length === netzD, `KEIN einziger OpenAI-Aufruf in der Pause: ${OPENAI.length - netzD}`);
  ok(FREMD.length === 0, `Kein fremdes Netz: ${FREMD.join(", ") || "—"}`);
  ok(GMAIL_SENDEN.length === 0, "Keine Mail gesendet oder entworfen");
  ok((await alarme()).length === 1, "Immer noch genau EIN Alarm");

  // ═══ E. Erster Fehler mitten im Postmeister ═════════════════════════════
  console.log("── E. Erster Abrechnungsfehler im Postmeister ─────────────────────");
  await aktivierenOhneNachholen();
  ok(!(await zustand()).an, "Aktiviert (ohne Probe) für die nächste Folge");
  szenario = "quota";
  const netzE = OPENAI.length;
  const mbE = await mailBearbeiten({ postfach: "support@fiaon.com", gmailId: MAIL_ID, gruss: "Gruß", modus: "auto" });
  const [pmE] = (await sql`SELECT aktion, versuche, naechster_versuch_am, begruendung, person_id, ref FROM fiaon_postmeister WHERE gmail_id = ${MAIL_ID}`) as any[];
  const zE = await zustand();
  ok(OPENAI.length - netzE === 1, "Ein Netzaufruf (Einordnen), dann Schluss");
  ok(zE.an && zE.dienst === "postmeister-einordnen", `Pausiert durch den Postmeister (${zE.dienst})`);
  ok(mbE.grund === "KI pausiert", `mailBearbeiten → „${mbE.grund}“`);
  ok(pmE?.aktion === "vorgeordnet" && Number(pmE?.versuche) === 0 && !pmE?.naechster_versuch_am, `Mail zurückgelegt: ${pmE?.aktion}, Versuche ${pmE?.versuche}`);
  const [vmE] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE note ILIKE '%Antwort NICHT erzeugt%' AND created_at >= ${START}`) as any[];
  ok(Number(vmE.n) === 0, "Kein Aktenvermerk „Antwort NICHT erzeugt“");
  const [tE] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE quelle IN ('postmeister') AND created_at >= ${START}`) as any[];
  ok(Number(tE.n) === 0, "Keine Aufgabe aus dem Postfach");
  ok(GMAIL_SENDEN.length === 0, "Keine Gmail-Sendung");
  ok((await alarme()).filter((a) => a.schluessel === `ki-pause-${zE.seit}`).length === 1, "Neue Pause → genau ihr eigener Alarm");

  // ═══ F. Erster Fehler in der Mara-Aktion ═══════════════════════════════
  console.log("── F. Erster Abrechnungsfehler in der Mara-Aktion ─────────────────");
  await aktivierenOhneNachholen();
  szenario = "quota";
  const ms = await import("../server/lib/fiaon-mara-aktion");
  const e = await ms.einstellungenLesen();
  const k = { personId: personB, ref: REF_B, stufe: "B", schritt: 1, email: "pruef246b@kunde.invalid", vorname: "Prüf", nachname: "E246 Aktion", paket: "FIAON Pro", betragEuro: 59.99, wunschlimit: null, zahlungsreferenz: "FIAON-P246MB-1", ereignisAm: new Date().toISOString(), zuletztAm: null } as any;
  let fF: unknown = null; try { await ms.mailSchreiben(k, e); } catch (x) { fF = x; }
  ok(kp.istKiPause(fF), "mailSchreiben wirft den Pausenfehler weiter (statt „abgelehnt“)");
  ok((await zustand()).an, "Pausiert");
  const quelleAktion = readFileSync(new URL("../server/lib/fiaon-mara-aktion.ts", import.meta.url), "utf8");
  ok(/if \(istKiPause\(err\)\) \{ pausiert = true; break; \}/.test(quelleAktion), "Durchgang bricht bei der Pause ab — ohne „abgelehnt“-Zeile (keine 24 h Ruhe)");
  const [abgF] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_aktion WHERE person_id = ${personB}`) as any[];
  ok(Number(abgF.n) === 0, "Keine Zeile in fiaon_mara_aktion für diesen Menschen");

  // ═══ G. Aktivieren und Nachholen ═══════════════════════════════════════
  console.log("── G. Aktivieren (Probe) und Nachholen ────────────────────────────");
  szenario = "quota";
  const netzG = OPENAI.length;
  const akt1 = await kp.aktivieren("Prüfstand", { nachholen: false });
  kp.kiPauseZwischenspeicherLeeren();
  ok(!akt1.ok && (await zustand()).an, `Probe scheitert (kein Guthaben) → Pause bleibt: „${String(akt1.fehler).slice(0, 60)}…“`);
  ok(OPENAI.length - netzG === 1 && OPENAI[OPENAI.length - 1].body?.max_tokens === 1, "Probe = ein winziger Aufruf (max_tokens 1)");
  ok((await zustand()).verlauf[0]?.was === "probe_gescheitert", "Verlauf: „Aktivieren abgelehnt (Probe)“");
  const pauseVorG = await zustand();
  szenario = "ok";
  const akt2 = await kp.aktivieren("Prüfstand", { nachholen: false });
  kp.kiPauseZwischenspeicherLeeren();
  const zG = await zustand();
  ok(akt2.ok && !zG.an && zG.aufgehobenVon === "Prüfstand", "Probe ok → KI aktiv, „aufgehoben von“ steht da");
  ok(zG.verlauf.some((v) => v.was === "aktiviert") && zG.verlauf.some((v) => v.was === "pausiert"), "Verlauf trägt Pause und Aktivierung");
  // Nachprüfung 27.09.: „Aktivieren" bei aktiver KI ändert nichts — auch nicht bei gescheiterter Probe.
  szenario = "quota";
  const netzAkt3 = OPENAI.length;
  const akt3 = await kp.aktivieren("Prüfstand", { nachholen: false });
  kp.kiPauseZwischenspeicherLeeren();
  const zAkt3 = await zustand();
  ok(akt3.ok && !zAkt3.an && OPENAI.length === netzAkt3 && zAkt3.verlauf.length === zG.verlauf.length, "Aktivieren ohne Pause: nichts geändert, keine Probe, keine Pause ohne Alarm");
  szenario = "ok";
  // Postfach: das Fenster umfasst die Pausendauer (+1 Tag)
  gmailListe = [];
  gmailSuchen.length = 0;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an') ON CONFLICT (key) DO UPDATE SET value = 'an'`;
  await pm.postmeisterNachDerPause(new Date(Date.now() - 3 * 86_400_000).toISOString());
  ok(gmailSuchen.some((q) => /newer_than:4d/.test(q)), `Postfach nach 3 Tagen Pause: Suche über 4 Tage (${gmailSuchen[0] ?? "—"})`);
  const [pmG] = (await sql`SELECT aktion, versuche FROM fiaon_postmeister WHERE gmail_id = ${MAIL_ID}`) as any[];
  ok(pmG?.aktion === "vorgeordnet", "Die zurückgelegte Mail ist für das Sieb weiter beanspruchbar (vorgeordnet)");
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'aus') ON CONFLICT (key) DO UPDATE SET value = 'aus'`;
  // Dauerauftrag: die Attrappe antwortet mit einer Rückfrage (dann läuft kein Werkzeug)
  const maraText = responsesText;
  responsesText = (body: any) => !body?.instructions
    ? maraText(body) // Mara WhatsApp (kiAufruf mit Schema „antwort")
    : String(body.instructions).includes("Eigennamen")
      ? JSON.stringify({ namen: [], absicht: "offene Rückrufe zeigen" })
      : JSON.stringify({ absicht: "offene Rückrufe", zusammenfassung: "Rückfrage", rueckfrage: "Für welchen Zeitraum?", schritte: [] });
  const netzVorNach = OPENAI.length;
  await kp.nachDerPause(pauseVorG);
  ok(OPENAI.length > netzVorNach, `Nach dem Aktivieren arbeiten die Läufe wieder (${OPENAI.length - netzVorNach} Aufrufe)`);
  const [kaG] = (await sql`SELECT status, fehler FROM fiaon_kontoauszug_analysen WHERE ref = ${REF} ORDER BY created_at DESC LIMIT 1`) as any[];
  ok(kaG && !/^KI pausiert/.test(String(kaG.fehler ?? "")), `Kontoauszug neu ausgewertet (jetzt ${kaG?.status})`);
  const [cG] = (await sql`SELECT transkript_status, zusammenfassung FROM fiaon_calls WHERE id = ${callId}`) as any[];
  ok(cG.transkript_status === "fertig" && !!cG.zusammenfassung, `Transkript nachgeholt: ${cG.transkript_status}`);
  // Nachprüfung 27.09.: Anspruch atomar — ein laufender Anruf wird nicht ein zweites Mal gegriffen.
  await sql`UPDATE fiaon_calls SET transkript_status = 'laeuft', updated_at = NOW() WHERE id = ${callId}`;
  const netzDoppel = OPENAI.length;
  const tDoppel = await tr.anrufNachbereiten(callId);
  ok(!tDoppel.ok && /gerade schon/.test(tDoppel.grund ?? "") && OPENAI.length === netzDoppel, "Läuft ein Anruf schon, greift ihn kein zweiter Lauf (kein zweites Whisper)");
  await sql`UPDATE fiaon_calls SET transkript_status = 'fertig' WHERE id = ${callId}`;
  const [gG] = (await sql`SELECT antwort_text FROM fiaon_whatsapp_gespraech WHERE nummer = ${NUMMER}`) as any[];
  ok(/Wie kann ich Ihnen helfen\?/.test(String(gG?.antwort_text ?? "")), `WhatsApp: Mara hat die offene Frage richtig beantwortet (vorbereitet, kein Rückfallsatz): „${String(gG?.antwort_text ?? "—").slice(0, 70)}“`);
  const [sammel] = (await sql`SELECT titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`ki-pause-wa-${pauseVorG.seit}`}`) as any[];
  ok(!sammel, "Keine Sammelaufgabe, wenn in der Pause keine alte Nachricht kam");
  const seit26 = new Date(Date.now() - 26 * 3_600_000).toISOString();
  await wa.zuAltFuerMara(seit26);
  const [sammel2] = (await sql`SELECT titel, text, prioritaet FROM fiaon_betreiber_todos WHERE schluessel LIKE 'ki-pause-wa-%' AND created_at >= ${START} ORDER BY id DESC LIMIT 1`) as any[];
  ok(!!sammel2 && String(sammel2.text).includes(NUMMER_ALT.slice(-4)) && !String(sammel2.text).includes(NUMMER.slice(-4)), "Nachrichten älter als 23,5 h aus der Pause → EINE Sammelaufgabe (nur die alte Nummer)");
  const zweiterGang = await wa.zuAltFuerMara(seit26);
  ok(zweiterGang.anzahl === 0, "Zweiter Gang derselben Pause: nichts doppelt (Marke ki_pause_wa_gesammelt)");
  // Nachprüfung 27.09.: Eine Nachricht, die erst NACH dem Aktivieren über die 23,5-h-Grenze rutscht
  // (nachts übersprungen), sammelt der Nachhol-Takt in den 24 h nach dem Aktivieren ein.
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUMMER_ALT2}, 'text', 'Ist meine Zahlung angekommen?', 'empfangen', NOW() - INTERVAL '24 hours', NOW() - INTERVAL '24 hours')`;
  const zNach = { ...(await zustand()), an: false, seit: seit26, aufgehobenAm: new Date().toISOString() };
  await sql`UPDATE fiaon_settings SET value = ${JSON.stringify(zNach)} WHERE key = 'ki_pause'`;
  kp.kiPauseZwischenspeicherLeeren();
  await wa.nachholLauf();
  const [sammel3] = (await sql`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`ki-pause-wa-${seit26}`}`) as any[];
  const t3 = String(sammel3?.text ?? "");
  ok(t3.includes(NUMMER_ALT2.slice(-4)) && t3.split(NUMMER_ALT.slice(-4)).length === 2, "Nachhol-Takt nach dem Aktivieren: neue zu alte Nachricht hängt sich an DIESELBE Aufgabe, die alte steht nur einmal drin");
  const zAlt = { ...zNach, aufgehobenAm: new Date(Date.now() - 25 * 3_600_000).toISOString() };
  await sql`UPDATE fiaon_settings SET value = ${JSON.stringify(zAlt)} WHERE key = 'ki_pause'`;
  await sql`DELETE FROM fiaon_settings WHERE key = 'ki_pause_wa_gesammelt'`;
  kp.kiPauseZwischenspeicherLeeren();
  await wa.nachholLauf();
  const [sammel4] = (await sql`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`ki-pause-wa-${seit26}`}`) as any[];
  ok(String(sammel4?.text ?? "") === t3, "Mehr als 24 h nach dem Aktivieren sammelt der Takt nicht mehr");
  await sql`UPDATE fiaon_settings SET value = ${JSON.stringify(zG)} WHERE key = 'ki_pause'`;
  kp.kiPauseZwischenspeicherLeeren();
  // Dauerauftrag im nächsten Takt
  await dauerauftraegeLaufen();
  const [dG] = (await sql`SELECT letzter_lauf, letzte_meldung FROM fiaon_mara_dauerauftrag WHERE id = ${dauerId}`) as any[];
  ok(!!dG.letzter_lauf, `Dauerauftrag lief nach dem Aktivieren: „${dG.letzte_meldung}“`);
  ok(FREMD.length === 0 && GMAIL_SENDEN.length === 0, "Auch beim Nachholen: kein fremdes Netz, keine Mail");
  const [rausG] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp WHERE nummer IN (${NUMMER}, ${NUMMER_ALT}) AND richtung = 'raus'`) as any[];
  ok(Number(rausG.n) === 0, "Keine WhatsApp ging raus (der Versandtakt läuft im Prüfstand nicht)");

  // Von Hand pausieren: ohne Alarm
  const alarmVorH = (await alarme()).length;
  const hand = await kp.pausieren({ art: "hand", fehler: "Von Hand im Chefbüro angehalten.", dienst: "chefbuero", von: "Prüfstand" });
  ok(hand.neu && hand.zustand.art === "hand" && (await alarme()).length === alarmVorH, "„KI jetzt pausieren“: Pause ohne Alarm");
  await aktivierenOhneNachholen();


  // ═══ I. Nachprüfung 27.09. (Befunde „technik") ══════════════════════════
  console.log("── I. Nachprüfung 27.09.: Produktion, Nebenläufigkeit, Datenschutz ──");
  // I/1 — automatisch pausiert nur der Produktionsdienst
  const dbWert = async () => String(((await sql`SELECT value FROM fiaon_settings WHERE key = 'ki_pause'`) as any[])[0]?.value ?? "");
  const alarmVorI = (await alarme()).length;
  const dbVorI = await dbWert();
  kp.kiPauseProduktionSimulieren(false);
  szenario = "quota";
  let fI1: unknown = null; try { await probeRuf(); } catch (x) { fI1 = x; }
  const zI1 = await zustand();
  ok(kp.istKiPause(fI1) && zI1.an && zI1.nurLokal === true, "I/1 Kein Produktionsdienst: Abrechnungsfehler hält DIESEN Prozess an (nurLokal)");
  ok((await dbWert()) === dbVorI && !JSON.parse(dbVorI || "{}").an, "I/1 … aber nichts in fiaon_settings.ki_pause geschrieben");
  ok((await alarme()).length === alarmVorI, "I/1 … und kein Alarm an Justin");
  const netzI1 = OPENAI.length;
  let fI1b: unknown = null; try { await probeRuf(); } catch (x) { fI1b = x; }
  ok(kp.istKiPause(fI1b) && OPENAI.length === netzI1, "I/1 Lokal pausiert: kein weiterer Netzaufruf");
  const aktI1 = await kp.aktivieren("Prüfstand", { nachholen: false });
  ok(aktI1.ok && /Nur in diesem Prozess/.test(String(aktI1.hinweis)) && !(await zustand()).an && (await dbWert()) === dbVorI, "I/1 Aktivieren hebt die lokale Pause auf, ohne die DB anzufassen");
  kp.kiPauseProduktionSimulieren(null);
  const envVorher = { NODE_ENV: process.env.NODE_ENV, RENDER: process.env.RENDER, RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID };
  const ohneRender = !kp.istProduktionsdienst();
  Object.assign(process.env, { NODE_ENV: "production", RENDER: "true", RENDER_SERVICE_ID: "srv-pruef246" });
  const mitRender = kp.istProduktionsdienst();
  delete process.env.RENDER_SERVICE_ID;
  const ohneId = !kp.istProduktionsdienst();
  for (const [k, v] of Object.entries(envVorher)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  ok(ohneRender && mitRender && ohneId, "I/1 Produktionsdienst = NODE_ENV=production + RENDER=true + RENDER_SERVICE_ID (sonst nicht)");
  kp.kiPauseProduktionSimulieren(true);
  kp.kiPauseZwischenspeicherLeeren();
  szenario = "ok";

  // I/5 — fetch(Request, init) an api.openai.com: Methode, Körper, Kopf aus dem Request
  const netzReq = OPENAI.length;
  const resReq = await fetch(new Request("https://api.openai.com/v1/chat/completions", {
    method: "POST", body: JSON.stringify({ probe: "request" }), headers: { Authorization: `Bearer ${HAUS_SCHLUESSEL}`, "Content-Type": "application/json" },
  }), { signal: AbortSignal.timeout(5000) });
  const letzterReq = OPENAI[OPENAI.length - 1];
  ok(resReq.ok && OPENAI.length === netzReq + 1 && letzterReq.methode === "POST" && letzterReq.body?.probe === "request", `I/5 fetch(Request, init): ${letzterReq?.methode} mit Körper (vorher: leerer GET)`);
  szenario = "quota";
  let fReq: unknown = null; try { await fetch(new Request("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}", headers: { Authorization: `Bearer ${HAUS_SCHLUESSEL}` } }), { signal: AbortSignal.timeout(5000) }); } catch (x) { fReq = x; }
  ok(kp.istKiPause(fReq) && (await zustand()).an, "I/5 … und ein Abrechnungsfehler auf diesem Weg pausiert (Schlüssel aus dem Request-Kopf)");
  await aktivierenOhneNachholen();
  szenario = "ok";

  // Testdaten für I/2–I/5
  const [ps] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PRUEF246-S', 'Prüf', 'E246 Auskunft', 'pruef246s@kunde.invalid') RETURNING id`) as any[];
  personS = Number(ps.id);
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, schufa_pdf, id_card_pdf, documents_uploaded_at, created_at)
            VALUES (${REF_S}, ${personS}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', 'FIAON-P246SA-1', 'paid', 59.99, 'Prüf', 'E246 Auskunft', 'pruef246s@kunde.invalid', ${leerPdf}, ${leerPdf}, NOW(), NOW())`;
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, created_at)
            VALUES (${REF_S2}, ${personS}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', 'FIAON-P246SB-1', 'pending_payment', 59.99, 'Prüf', 'E246 Auskunft', 'pruef246s@kunde.invalid', NOW() - INTERVAL '1 day')`;
  const neuerAnruf = async (felder: { status: string; grund?: string | null; widerspruch?: boolean; aktualisiertVorMin?: number }) => {
    const [x] = (await sql`INSERT INTO fiaon_calls (agent_id, nummer, richtung, beginn, status, transkript_status, transkript_grund, recording_url, person_id, ref, ohne_aufzeichnung_am, updated_at)
      VALUES (9001, '4915900246098', 'ausgehend', NOW() - INTERVAL '40 minutes', 'beendet', ${felder.status}, ${felder.grund ?? null}, 'https://api.twilio.pruef.invalid/rec2.mp3', ${personS}, ${REF_S},
              ${felder.widerspruch ? new Date() : null}, NOW() - (${felder.aktualisiertVorMin ?? 0} || ' minutes')::interval) RETURNING id`) as any[];
    extraCalls.push(Number(x.id));
    return Number(x.id);
  };
  const callW = await neuerAnruf({ status: "entfaellt", grund: "Der Kunde hat der Aufzeichnung widersprochen.", widerspruch: true });
  const callW2 = await neuerAnruf({ status: "offen", grund: "KI pausiert — Altlast", widerspruch: true, aktualisiertVorMin: 30 });
  const callL = await neuerAnruf({ status: "laeuft", aktualisiertVorMin: 20 });

  // In die Pause (von Hand — dieselbe Wirkung für alle Läufe)
  await kp.pausieren({ art: "hand", fehler: "Prüfstand I", dienst: "chefbuero", von: "Prüfstand" });
  kp.kiPauseZwischenspeicherLeeren();
  const pauseI = await zustand();
  const netzI = OPENAI.length;

  // I/5 — „Neu auswerten" in der Pause: keine neue Zeile über der fertigen Auswertung
  const anzahlKa = async (ref: string) => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_kontoauszug_analysen WHERE ref = ${ref}`) as any[])[0].n);
  const [kaFertig] = (await sql`SELECT id, status FROM fiaon_kontoauszug_analysen WHERE ref = ${REF} ORDER BY created_at DESC LIMIT 1`) as any[];
  const kaVor = await anzahlKa(REF);
  const kaNeu = await ka.kontoauszugAnalysieren(REF, { erzwingen: true });
  ok(kaNeu?.id === Number(kaFertig.id) && /^KI pausiert/.test(String(kaNeu?.kiPause)) && (await anzahlKa(REF)) === kaVor,
    `I/5 „Neu auswerten“ in der Pause: bestehende Auswertung (${kaFertig.status}) bleibt sichtbar, keine neue Zeile, meldet „KI pausiert“`);
  // Eine NEUE Datei bekommt dagegen ihre Pause-Zeile (die holt auszuegeNachholen).
  // (eine andere Datei — die Texterkennung merkt sich gelesene Dateien je Inhalt)
  const zweiSeiten = await PDFDocument.create(); zweiSeiten.addPage([595, 842]); zweiSeiten.addPage([595, 842]);
  await sql`UPDATE fiaon_applications SET bank_statement_pdf = ${Buffer.from(await zweiSeiten.save())}, documents_uploaded_at = NOW() WHERE ref = ${REF}`;
  await ka.kontoauszugAnalysieren(REF, { erzwingen: true });
  const [kaPause] = (await sql`SELECT id, status, fehler FROM fiaon_kontoauszug_analysen WHERE ref = ${REF} ORDER BY created_at DESC LIMIT 1`) as any[];
  ok(kaPause.status === "fehler" && /^KI pausiert/.test(String(kaPause.fehler)), "I/5 Neue Datei in der Pause: Pause-Zeile zum Nachholen");

  // SCHUFA: eine echte Pause-Zeile (REF_S) und eine Leiche (REF_S2, Bestellung ohne Auskunft)
  const { schufaAnalysieren, schufaNachholen } = await import("../server/lib/fiaon-schufa-analyse");
  await schufaAnalysieren(REF_S, { erzwingen: true });
  await sql`INSERT INTO fiaon_schufa_analysen (ref, person_id, status, fehler, created_at) VALUES (${REF_S2}, ${personS}, 'fehler', 'KI pausiert — Prüfstand-Leiche', NOW() - INTERVAL '1 hour')`;
  const [sPause] = (await sql`SELECT id, status, fehler FROM fiaon_schufa_analysen WHERE ref = ${REF_S} ORDER BY created_at DESC LIMIT 1`) as any[];
  ok(sPause?.status === "fehler" && /^KI pausiert/.test(String(sPause?.fehler)), "SCHUFA in der Pause: „fehler / KI pausiert“");

  // I/4 — Datenschutz in der Pause: Widerspruch bleibt Widerspruch
  const tW = await tr.anrufNachbereiten(callW);
  const [cW] = (await sql`SELECT transkript_status, transkript_grund FROM fiaon_calls WHERE id = ${callW}`) as any[];
  ok(!tW.ok && cW.transkript_status === "entfaellt" && !/KI pausiert/.test(String(cW.transkript_grund)), `I/4 Pause: 'entfaellt' wird nicht mit 'offen'/„KI pausiert“ überschrieben (${cW.transkript_status})`);

  // I/5 — Dokumentprüfung in der Pause: markiert, Hinweis „wird nach dem Aktivieren automatisch geprüft"
  // E-IT-C (08.10.2026): Ausweisbilder gehen an KEINE KI mehr (Entscheidung Justin) — ein Ausweis-Foto
  // wartet deshalb nicht auf die Pause, sondern bekommt sofort die feste Regel („von Hand"). Die
  // Pause-Markierung prüft jetzt die Auskunft, die weiter über die Texterkennung gelesen wird.
  const dp = await import("../server/lib/fiaon-dokument-pruefung");
  const netzVorI5 = OPENAI.length;
  const uP = await dp.pruefungAnstossen(REF_S, "schufa", leerPdf, 10_000);
  await new Promise((r) => setTimeout(r, 400));
  const [uRow] = (await sql`SELECT urteil FROM fiaon_dokument_pruefungen WHERE ref = ${REF_S} AND art = 'schufa'`) as any[];
  ok(uP?.kiPause === true && /automatisch geprüft/.test(String(uP?.hinweisIntern)) && !/neu hochladen/.test(String(uP?.hinweisIntern)), `I/5 Pause-Urteil markiert: „${String(uP?.hinweisIntern).slice(0, 90)}“`);
  ok(uRow?.urteil?.kiPause === true, "I/5 … und so gespeichert");
  const uA = await dp.pruefungAnstossen(REF_S, "ausweis", leerPdf, 10_000);
  await new Promise((r) => setTimeout(r, 400));
  ok(!uA?.kiPause && /von Hand/.test(String(uA?.hinweisIntern)) && OPENAI.length === netzVorI5, `I/5 Ausweis-Foto in der Pause: feste Regel, keine Pause-Markierung, kein KI-Aufruf („${String(uA?.hinweisIntern).slice(0, 70)}“)`);

  // I/5 — Band: „liegen geblieben" zählt nur Pause-bezogen
  const { liegenGeblieben } = await import("../server/routes/fiaon-mara-steuerpult");
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUMMER_ALT3}, 'text', 'Vor der Pause gefragt', 'empfangen', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours')`;
  const lgJetzt = await liegenGeblieben(pauseI.seit);
  const lgFrueher = await liegenGeblieben(new Date(Date.now() - 4 * 3_600_000).toISOString());
  ok(lgFrueher.whatsapp === lgJetzt.whatsapp + 1, `I/5 Band: WhatsApp nur seit Pausenbeginn (${lgJetzt.whatsapp}; mit 4 h früherem Beginn ${lgFrueher.whatsapp})`);
  ok(lgJetzt.auswertungen >= 2, `I/5 Band: Auswertungen nur mit Datei an der Bestellung (${lgJetzt.auswertungen}; die Leiche ohne Auskunft zählt nicht)`);
  const [leicheZaehlt] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref = ${REF_S2} AND schufa_pdf IS NOT NULL`) as any[];
  ok(Number(leicheZaehlt.n) === 0, "I/5 (die Leiche hat wirklich keine Auskunft)");
  const [tAlle] = (await sql`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE ohne_aufzeichnung_am IS NOT NULL)::int AS w FROM fiaon_calls WHERE transkript_status = 'offen' AND transkript_grund LIKE 'KI pausiert%'`) as any[];
  ok(Number(tAlle.w) >= 1 && lgJetzt.transkripte === Number(tAlle.n) - Number(tAlle.w), `I/5 Band: Transkripte mit Widerspruch zählen nicht (${lgJetzt.transkripte} von ${tAlle.n})`);
  ok(OPENAI.length === netzI, `I In der Pause: kein OpenAI-Aufruf (${OPENAI.length - netzI})`);

  // ── Aktivieren (ohne Hintergrund-Nachholen) ─────────────────────────────
  await aktivierenOhneNachholen();
  szenario = "ok";

  // I/2 — nachDerPause nimmt die Laufsperre des Takts: läuft der Takt (Zeile 'laeuft'), tut dieser Schritt nichts
  for (const n of NACHHOL_TAKTE) await sql`INSERT INTO fiaon_lauf_historie (name, ergebnis) VALUES (${n}, 'laeuft')`;
  await kp.nachDerPause(pauseI);
  const [kaNachSperre] = (await sql`SELECT id FROM fiaon_kontoauszug_analysen WHERE ref = ${REF} ORDER BY created_at DESC LIMIT 1`) as any[];
  const [sNachSperre] = (await sql`SELECT id FROM fiaon_schufa_analysen WHERE ref = ${REF_S} ORDER BY created_at DESC LIMIT 1`) as any[];
  const [lNachSperre] = (await sql`SELECT transkript_status FROM fiaon_calls WHERE id = ${callL}`) as any[];
  ok(Number(kaNachSperre.id) === Number(kaPause.id) && Number(sNachSperre.id) === Number(sPause.id) && lNachSperre.transkript_status === "laeuft",
    "I/2 Takt läuft gerade (Laufsperre): nachDerPause lässt Kontoauszug, SCHUFA und Transkript ihm");
  await sql`DELETE FROM fiaon_lauf_historie WHERE name = ANY(${NACHHOL_TAKTE}) AND ergebnis = 'laeuft' AND begonnen >= ${START}`;

  // I/2 + I/3 — SCHUFA: zwei gleichzeitige Läufe, genau eine Auswertung; Leiche abgehakt; kein Endlos-Nachholen
  const anzahlS = async (ref: string) => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_schufa_analysen WHERE ref = ${ref}`) as any[])[0].n);
  const sVor = await anzahlS(REF_S);
  const [sn1, sn2] = await Promise.all([schufaNachholen(10), schufaNachholen(10)]);
  ok((await anzahlS(REF_S)) === sVor + 1 && sn1.gestartet + sn2.gestartet >= 1 && Math.min(sn1.gestartet, sn2.gestartet) === 0,
    `I/2 SCHUFA: zwei gleichzeitige Nachhol-Läufe → genau EINE neue Auswertung (${(await anzahlS(REF_S)) - sVor})`);
  const [sAlt] = (await sql`SELECT fehler FROM fiaon_schufa_analysen WHERE id = ${sPause.id}`) as any[];
  ok(!/^KI pausiert/.test(String(sAlt.fehler)), `I/3 Die Pause-Zeile ist abgehakt: „${String(sAlt.fehler).slice(0, 60)}“`);
  const [leiche] = (await sql`SELECT fehler FROM fiaon_schufa_analysen WHERE ref = ${REF_S2} ORDER BY created_at DESC LIMIT 1`) as any[];
  ok(!/^KI pausiert/.test(String(leiche.fehler)) && (await anzahlS(REF_S2)) === 1, "I/3 Leiche (Bestellung ohne Auskunft) ohne Auswertung abgehakt");
  const netzS3 = OPENAI.length;
  const sn3 = await schufaNachholen(10);
  ok(sn3.gestartet === 0 && OPENAI.length === netzS3, "I/3 Zweiter Takt: nichts mehr offen, keine OpenAI-Kosten (keine Endlosschleife)");
  // I/5 — die Dokumentprüfung aus der Pause ist nachgeholt (hängt am SCHUFA-Takt)
  // E-IT-C: die in der Pause markierte Prüfung ist die der Auskunft (Ausweise warten nicht mehr auf die KI).
  const [uNach] = (await sql`SELECT urteil FROM fiaon_dokument_pruefungen WHERE ref = ${REF_S} AND art = 'schufa'`) as any[];
  ok(uNach?.urteil && uNach.urteil.kiPause !== true && !/wartet, weil die KI pausiert/.test(String(uNach.urteil.hinweisIntern)), `I/5 Dokumentprüfung nach dem Aktivieren neu: „${String(uNach?.urteil?.hinweisIntern).slice(0, 70)}“`);

  // I/2 — Kontoauszug: zwei gleichzeitige Läufe, genau eine Auswertung, höchstens ein Aktenvermerk
  const vermerke = async () => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${REF} AND note LIKE 'Kontoauszug ausgewertet%'`) as any[])[0].n);
  const kaVor2 = await anzahlKa(REF), vmVor = await vermerke();
  const [kn1, kn2] = await Promise.all([ka.auszuegeNachholen(10), ka.auszuegeNachholen(10)]);
  ok((await anzahlKa(REF)) === kaVor2 + 1 && Math.min(kn1.gestartet, kn2.gestartet) === 0 && (await vermerke()) - vmVor <= 1,
    `I/2 Kontoauszug: zwei gleichzeitige Nachhol-Läufe → eine neue Auswertung (${(await anzahlKa(REF)) - kaVor2}), ${(await vermerke()) - vmVor} Aktenvermerk`);

  // I/4 — Transkript-Takt: liegen gebliebenes 'laeuft' (> 15 Min.) wird aufgenommen, Widerspruch nie
  const netzT = OPENAI.length;
  await tr.transkriptLauf(10);
  const [cL] = (await sql`SELECT transkript_status, zusammenfassung FROM fiaon_calls WHERE id = ${callL}`) as any[];
  ok(cL.transkript_status === "fertig" && !!cL.zusammenfassung, `I/4 'laeuft' seit 20 Min. (Neustart mitten im Lauf) vom Takt aufgenommen: ${cL.transkript_status}`);
  const [cW2] = (await sql`SELECT transkript_status, transkript, zusammenfassung FROM fiaon_calls WHERE id = ${callW2}`) as any[];
  const [cW3] = (await sql`SELECT transkript_status, transkript FROM fiaon_calls WHERE id = ${callW}`) as any[];
  ok(!cW2.transkript && !cW2.zusammenfassung && cW3.transkript_status === "entfaellt" && !cW3.transkript, "I/4 Anrufe mit Widerspruch: vom Takt nie abgeschrieben");
  const tW4 = await tr.anrufNachbereiten(callW2);
  ok(!tW4.ok && tW4.grund === tr.WIDERSPRUCH_GRUND, "I/4 Auch direkt (Aufnahme-Rückruf/Knopf): kein Transkript bei Widerspruch");
  const whisper = OPENAI.slice(netzT).filter((o) => o.url.endsWith("/audio/transcriptions")).length;
  ok(whisper === 1, `I/4 Genau ein Whisper-Aufruf (nur der liegen gebliebene Anruf): ${whisper}`);
  const tDoppelFertig = await tr.transkriptLauf(10);
  ok(tDoppelFertig === 0, "I/2 Ein fertiger Anruf wird vom Takt nicht noch einmal gegriffen");

  // I/4 Nachbesserung 27.09. (Gegenprüfer „hoch“): Widerspruch MITTEN in der Nachbereitung.
  const widersprechen = (id: number) => async () => {
    await sql`UPDATE fiaon_calls SET ohne_aufzeichnung_am = NOW(), transkript_status = 'entfaellt', transkript_grund = 'Der Kunde hat der Aufzeichnung widersprochen.' WHERE id = ${id}`;
  };
  const zusammenfassungsVermerke = async () => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${REF_S} AND note LIKE 'Anruf-Zusammenfassung%'`) as any[])[0].n);
  const callR = await neuerAnruf({ status: "offen" });
  const vmR = await zusammenfassungsVermerke(), netzR = OPENAI.length;
  netzHaken.whisper = widersprechen(callR);
  const tR = await tr.anrufNachbereiten(callR);
  const [cR] = (await sql`SELECT transkript_status, transkript, zusammenfassung FROM fiaon_calls WHERE id = ${callR}`) as any[];
  const whisperR = OPENAI.slice(netzR).filter((o) => o.url.endsWith("/audio/transcriptions")).length;
  const chatR = OPENAI.slice(netzR).filter((o) => o.url.endsWith("/chat/completions")).length;
  ok(!tR.ok && tR.grund === tr.WIDERSPRUCH_GRUND && whisperR === 1 && chatR === 0, `I/4 Widerspruch WÄHREND Whisper: Text geht nicht zur Zusammenfassung an OpenAI (whisper=${whisperR}, chat=${chatR})`);
  ok(cR.transkript_status === "entfaellt" && !cR.transkript && !cR.zusammenfassung && (await zusammenfassungsVermerke()) === vmR,
    `I/4 … Transkript NICHT gespeichert, Status bleibt 'entfaellt', kein Aktenvermerk (${cR.transkript_status}, transkript=${!!cR.transkript})`);
  const callR2 = await neuerAnruf({ status: "offen" });
  netzHaken.chat = async () => { await widersprechen(callR2)(); return 500; };
  await tr.anrufNachbereiten(callR2);
  const [cR2] = (await sql`SELECT transkript_status, zusammenfassung FROM fiaon_calls WHERE id = ${callR2}`) as any[];
  ok(cR2.transkript_status === "entfaellt" && !cR2.zusammenfassung, `I/4 Widerspruch während der Zusammenfassung, die dann scheitert: 'fehlgeschlagen' überschreibt 'entfaellt' nicht (${cR2.transkript_status})`);
  const callR3 = await neuerAnruf({ status: "offen" });
  netzHaken.whisper = async () => { await widersprechen(callR3)(); return 500; };
  await tr.anrufNachbereiten(callR3);
  const [cR3] = (await sql`SELECT transkript_status FROM fiaon_calls WHERE id = ${callR3}`) as any[];
  ok(cR3.transkript_status === "entfaellt", `I/4 Widerspruch während Whisper, das dann scheitert: bleibt 'entfaellt' (${cR3.transkript_status})`);
  const tel = readFileSync(new URL("../server/routes/fiaon-telefonie.ts", import.meta.url), "utf8");
  const route = tel.slice(tel.indexOf('router.post("/telefon/:id/ohne-aufzeichnung"'), tel.indexOf('router.post("/admin/telefon/aufnahmen-aufraeumen"'));
  const vermerkAt = route.indexOf("transkript_status = 'entfaellt'"), stopAt = route.indexOf("Status=stopped");
  ok(vermerkAt > 0 && stopAt > vermerkAt, "I/4 Route ohne-aufzeichnung: Vermerk steht VOR dem Twilio-Stopp (der Aufnahme-Rückruf kommt erst danach)");
  ok(/transkript = NULL,\s*zusammenfassung = NULL/.test(route.slice(0, stopAt)), "I/4 … und leert ein schon geschriebenes Transkript und die Zusammenfassung");
  ok(kp.KI_PAUSE_MAIL_HINWEIS.includes("direkt im Postfach support@/welcome@") && /anderen Postfach, per Telefon oder WhatsApp/.test(kp.KI_PAUSE_MAIL_HINWEIS), "I/6 Alarm: nur direkt im Postfach antworten, sonst archivieren (Gegenprüfer „niedrig“)");

  // I/5 — LAUF_FOLGEN kennt die Nachhol-Takte; kiPauseLesen merkt sich im DB-Fehlerpfad den Stand
  const { LAUF_FOLGEN } = await import("../server/lib/fiaon-crons");
  ok(NACHHOL_TAKTE.every((n) => !!LAUF_FOLGEN[n]?.folge), "I/5 LAUF_FOLGEN: kontoauszug_nachholen, schufa_nachholen, transkript_nachholen");
  const qPause = readFileSync(new URL("../server/lib/fiaon-ki-pause.ts", import.meta.url), "utf8");
  const fangZweig = qPause.slice(qPause.indexOf('console.error("[KI-PAUSE] Zustand nicht lesbar:"'), qPause.indexOf("export async function kiPausiert"));
  ok(/zwischen = \{ wert, bis: Date\.now\(\) \+ 10_000 \}/.test(fangZweig), "I/5 kiPauseLesen: im DB-Fehlerpfad 10 s zwischengespeichert (kein Abfragesturm)");
  ok(/if \(neu && alarmOffen && z\.art !== "hand"\) await alarm\(z\)/.test(qPause), "I/5 Pause, die erst beim Nachtragen gespeichert wird, holt ihren Alarm nach");
  ok(FREMD.length === 0 && GMAIL_SENDEN.length === 0, "I Kein fremdes Netz, keine Mail");

  // ═══ H. Quelltext-Wand ═══════════════════════════════════════════════════
  console.log("── H. Quelltext-Wand ───────────────────────────────────────────────");
  const wurzel = new URL("..", import.meta.url).pathname;
  const dateien: string[] = [];
  const gehen = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const pfad = join(dir, n);
      if (statSync(pfad).isDirectory()) { if (n !== "node_modules") gehen(pfad); }
      else if (/\.(ts|tsx|js|mjs)$/.test(n)) dateien.push(pfad);
    }
  };
  for (const d of ["server", "shared"]) gehen(join(wurzel, d));
  const helfer = join(wurzel, "server/lib/fiaon-ki-pause.ts");
  const urlFunde = dateien.filter((f) => f !== helfer && readFileSync(f, "utf8").includes("api.openai.com"));
  ok(urlFunde.length === 0, `Keine OpenAI-URL außerhalb des Helfers${urlFunde.length ? `: ${urlFunde.map((f) => f.replace(wurzel, "")).join(", ")}` : ""}`);
  const sdkFunde = dateien.filter((f) => { const t = readFileSync(f, "utf8"); return /new OpenAI\(/.test(t) && !/new OpenAI\(\{[^}]*fetch: sdkFetch\(/.test(t); });
  ok(sdkFunde.length === 0, `Jedes OpenAI-SDK läuft über sdkFetch${sdkFunde.length ? `: ${sdkFunde.map((f) => f.replace(wurzel, "")).join(", ")}` : ""}`);
  const index = readFileSync(join(wurzel, "server/index.ts"), "utf8");
  ok(index.indexOf("kiNetzAbsichern();") > 0 && index.indexOf("kiNetzAbsichern();") < index.indexOf("const app = express();"), "Das Netz unter allem steht in server/index.ts vor den Routen");
  const wa2 = readFileSync(join(wurzel, "server/lib/fiaon-whatsapp-mara.ts"), "utf8");
  ok(!/kiGuthabenAlarm\(/.test(wa2), "Der alte tägliche Guthaben-Alarm aus Mara WhatsApp ist weg (ein Alarm, eine Stelle)");
  ok(/if \(istKiPause\(e\.kiFehler\)\) \{[\s\S]{0,2400}?return \{ gesendet: false, grund: "KI pausiert/.test(wa2) && wa2.indexOf("istKiPause(e.kiFehler)") < wa2.indexOf("rueckfallSatz(lage."), "Mara WhatsApp: Pause VOR dem Rückfallsatz"); // E-265: rueckfallSatz(lage.anruferN) — Nennform
  const steuer = readFileSync(join(wurzel, "server/routes/fiaon-mara-steuerpult.ts"), "utf8");
  ok(/router\.post\("\/chef\/ki-pause\/aktivieren", wache/.test(steuer) && /router\.post\("\/chef\/ki-pause\/pausieren", wache/.test(steuer), "Aktivieren und Pausieren nur für Stufe Inhaber (wache)");
  const takte = readFileSync(join(wurzel, "server/routes.ts"), "utf8");
  ok(/tageslauf\('schufa_nachholen'/.test(takte) && /tageslauf\('transkript_nachholen'/.test(takte), "Takte für SCHUFA- und Transkript-Nachholen stehen");
} catch (e) {
  fehler++;
  console.error("✗ Abbruch:", e);
} finally {
  // ── Aufräumen (nur eigene Datensätze der lokalen Test-DB) ─────────────────
  await sql`DELETE FROM fiaon_whatsapp WHERE nummer IN (${NUMMER}, ${NUMMER_ALT}, ${NUMMER_ALT2}, ${NUMMER_ALT3})`.catch(() => {});
  await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer IN (${NUMMER}, ${NUMMER_ALT}, ${NUMMER_ALT2}, ${NUMMER_ALT3})`.catch(() => {});
  await sql`DELETE FROM fiaon_schufa_analysen WHERE ref IN (${REF_S}, ${REF_S2})`.catch(() => {});
  await sql`DELETE FROM fiaon_dokument_pruefungen WHERE ref IN (${REF}, ${REF_S}, ${REF_S2})`.catch(() => {});
  await sql`DELETE FROM fiaon_contact_log WHERE ref IN (${REF_S}, ${REF_S2})`.catch(() => {});
  if (extraCalls.length) await sql`DELETE FROM fiaon_calls WHERE id = ANY(${extraCalls})`.catch(() => {});
  await sql`DELETE FROM fiaon_lauf_historie WHERE name = ANY(${NACHHOL_TAKTE}) AND begonnen >= ${START}`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref IN (${REF_S}, ${REF_S2})`.catch(() => {});
  if (personS) await sql`DELETE FROM fiaon_persons WHERE id = ${personS}`.catch(() => {});
  await sql`DELETE FROM fiaon_postmeister WHERE gmail_id = ${MAIL_ID}`.catch(() => {});
  await sql`DELETE FROM fiaon_kontoauszug_analysen WHERE ref IN (${REF}, ${REF_B})`.catch(() => {});
  await sql`DELETE FROM fiaon_contact_log WHERE ref IN (${REF}, ${REF_B})`.catch(() => {});
  if (callId) await sql`DELETE FROM fiaon_calls WHERE id = ${callId}`.catch(() => {});
  if (dauerId) { await sql`DELETE FROM fiaon_mara_auftrag WHERE dauerauftrag_id = ${dauerId}`.catch(() => {}); await sql`DELETE FROM fiaon_mara_dauerauftrag WHERE id = ${dauerId}`.catch(() => {}); }
  await sql`DELETE FROM fiaon_mara_aktion WHERE ref IN (${REF}, ${REF_B})`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref IN (${REF}, ${REF_B})`.catch(() => {});
  if (personId || personB) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${[personId, personB].filter(Boolean)})`.catch(() => {});
  await sql`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND (quelle = 'ki-pause' OR schluessel LIKE 'ki-pause-%' OR schluessel LIKE 'wa-n49159002460%')`.catch(() => {});
  await sql`DELETE FROM fiaon_ki_nutzung WHERE created_at >= ${START}`.catch(() => {});
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
  for (const z of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${z.key}, ${z.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
  void vorherRoh;
}
console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
