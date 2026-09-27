// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: NACH DER KI-PAUSE — NICHTS DOPPELT, NICHTS ZUR FALSCHEN ZEIT
// (27.09.2026, E-246, Nachprüfung „kunde")
//
// Justin: „Wenn OpenAI nicht abbuchen kann, soll alles pausieren. Nichts Wirres
// oder Falsches schicken, einfach Pause, bis ich es wieder aktiviere."
// Hier geht es um die Zeit NACH dem Aktivieren:
//
//   1. HOCH  Mail in der Pause von Hand in Gmail beantwortet → Mara antwortet
//            NICHT noch einmal (SENT im Faden nach der Mail), Zeile „geordnet",
//            Übergabe geschlossen. Maras eigener Versand und frühere Antworten
//            zählen nicht; Gmail-Fehler → Fehlversuch statt Antwort.
//   2. MITTEL Nachholen dauerhaft: regulärer Takt sucht 48 h lang über die
//            Pausendauer; zurückgelegte Zeilen („KI pausiert …") werden unabhängig
//            vom Suchfenster beansprucht — atomar, nie doppelt.
//   3. MITTEL Mara WhatsApp: Verlauf mit „KUNDE (So 16:00): …", Zeithinweis ab 3 h,
//            Pause-Nachrichten über 12 h → Sammelaufgabe statt freier Antwort,
//            rueckruf_eintragen legt „heute" aus einer Pause-Nachricht nie auf
//            den Aktivierungstag.
//   4. NIEDRIG Geduld (KI_GEDULD_MIN) zählt ab max(Nachricht, Pausenende).
//   5. NIEDRIG Werkzeuge nicht doppelt: „schon erledigt" an das Modell,
//            global_zugang_senden je Mail einmal, kuendigung_vormerken sagt im
//            zweiten Anlauf nicht „lag bereits vor".
//
// NUR gegen die lokale Test-DB; KEIN Netz (OpenAI, Gmail sind Attrappen, alles
// andere wirft). Keine Mail, keine WhatsApp, kein OpenAI-Aufruf geht hinaus.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-ki-pause-nachholen.ts
// Eigene Datensätze (Mails e246n-…, Nummern 49159002461xx, Referenzen FIAON-P246N…,
// Personen PRUEF246N-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

// ── Attrappen VOR jedem Import ────────────────────────────────────────────
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e246n";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e246n.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.pruef.invalid/token",
});

const H = 3_600_000;
const KUNDE_MAIL = "pruef246n@kunde.invalid";
let szenario: "ok" | "500" = "ok";
const OPENAI: { url: string; text: string }[] = [];
const GMAIL_SENDEN: string[] = [];
const gmailSuchen: string[] = [];
const FREMD: string[] = [];
let inboxListe: string[] = [];
let sentListe: string[] = [];
let sentKaputt = false;
type Nachricht = { thread: string; labels: string[]; am: number; von?: string; betreff?: string; text?: string };
const NACHRICHTEN = new Map<string, Nachricht>();

const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const text = typeof init?.body === "string" ? init.body : "";
    OPENAI.push({ url: u, text });
    if (szenario === "500") return json(500, { error: { message: "The server had an error while processing your request.", type: "server_error" } });
    const antwort = text.includes("Du ordnest eingehende Kundenmails")
      ? JSON.stringify({ kategorien: ["status_frage"], flags: {}, dringend: false, sprache: "de", fragen: ["Wann kommt meine Karte?"], zusammenfassung: "Kunde fragt nach seiner Karte." })
      : JSON.stringify({ antwort: "Gern, ich bin Mara, die digitale Assistentin von FIAON. Wie kann ich Ihnen helfen?", gemerkt: "", mensch: false, uebergabe: "" });
    return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: antwort }] }], usage: { input_tokens: 10, output_tokens: 10 },
      choices: [{ message: { content: antwort } }] });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send|\/drafts/.test(u)) { GMAIL_SENDEN.push(u); return json(200, { id: "nie", threadId: "nie" }); }
    if (/\/messages\?/.test(u)) {
      const q = decodeURIComponent(new URL(u).searchParams.get("q") ?? "");
      gmailSuchen.push(q);
      if (q.includes("in:sent")) {
        if (sentKaputt) return json(500, { error: { message: "Backend Error" } });
        return json(200, { messages: sentListe.map((id) => ({ id })), resultSizeEstimate: sentListe.length });
      }
      return json(200, { messages: inboxListe.map((id) => ({ id })), resultSizeEstimate: inboxListe.length });
    }
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return json(404, { error: { message: "Not Found" } });
      return json(200, {
        id: m[1], threadId: n.thread, labelIds: n.labels, internalDate: String(n.am), snippet: n.text ?? "",
        payload: { mimeType: "text/plain", headers: [
          { name: "From", value: n.von ?? `Prüf Kunde <${KUNDE_MAIL}>` }, { name: "To", value: "support@fiaon.com" },
          { name: "Subject", value: n.betreff ?? "Frage zur Karte" }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text ?? "Guten Tag, wann kommt meine Karte? Viele Grüße").toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
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
kp.kiNetzAbsichern();
const lauf = await import("../server/lib/fiaon-postmeister-lauf");
const pm = await import("../server/routes/fiaon-postmeister");
const wz = await import("../server/lib/fiaon-postmeister-werkzeuge");
const wa = await import("../server/lib/fiaon-whatsapp-mara");
const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");

const START = new Date();
const EINSTELLUNGEN = ["ki_pause", "ki_pause_wa_gesammelt", "postmeister_an", "postmeister_v2", "postmeister_modus_support", "mara_wa_an"];
const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`) as any[];
const REF = "FIAON-P246NA";
const REF_K = "FIAON-P246NK";
const NUM = { alt13: "4915900246101", frisch5: "4915900246102", neu: "4915900246103", geduld: "4915900246104", vorlage: "4915900246105", einzel: "4915900246106" };
let personId = 0;

/** Den Pausenzustand direkt setzen — so, wie aktivieren() ihn speichert. */
async function pauseStand(ein: { an: boolean; seit: Date; auf: Date | null }): Promise<string> {
  const z = {
    an: ein.an, art: "abrechnung", grund: "OpenAI meldet: kein Guthaben mehr.", fehler: "HTTP 429 insufficient_quota", dienst: "pruef",
    seit: ein.seit.toISOString(), von: "automatisch", aufgehobenAm: ein.auf ? ein.auf.toISOString() : null, aufgehobenVon: ein.auf ? "Prüfstand" : null, verlauf: [],
  };
  const v = JSON.stringify(z);
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('ki_pause', ${v}) ON CONFLICT (key) DO UPDATE SET value = ${v}`;
  kp.kiPauseZwischenspeicherLeeren();
  return z.seit;
}
/** Eine Postmeister-Zeile, wie mailBearbeiten sie in der Pause zurücklegt. */
async function pauseZeile(gmailId: string, extra: { handlungen?: unknown[]; personId?: number | null; ref?: string | null } = {}): Promise<number> {
  const [r] = (await sql`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, person_id, ref, handlungen)
    VALUES ('support@fiaon.com', ${gmailId}, '', 'vorgeordnet', 'KI pausiert — wartet auf das Aktivieren', 0,
            ${extra.personId ?? null}, ${extra.ref ?? null}, ${extra.handlungen ? JSON.stringify(extra.handlungen) : null}::jsonb)
    RETURNING id`) as any[];
  return Number(r.id);
}
const zeile = async (gmailId: string) => ((await sql`SELECT id, aktion, begruendung, versuche, naechster_versuch_am FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[])[0];
const antwortAufrufe = (ab: number) => OPENAI.slice(ab).filter((o) => !o.text.includes("Du ordnest eingehende Kundenmails")).length;

try {
  await postmeisterSchema();
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an')`;
  const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PRUEF246N-A', 'Prüf', 'E246 Nachholen', ${KUNDE_MAIL}) RETURNING id`) as any[];
  personId = Number(p.id);
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email)
            VALUES (${REF}, ${personId}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', 'FIAON-P246NA-1', 'paid', 59.99, 'Prüf', 'E246 Nachholen', ${KUNDE_MAIL})`;

  // ═══ 1. HOCH — von Hand in Gmail beantwortet ══════════════════════════════
  console.log("── 1. Mail in der Pause von Hand beantwortet → keine zweite Antwort ──");
  const jetzt = Date.now();
  await pauseStand({ an: false, seit: new Date(jetzt - 8 * H), auf: new Date(jetzt - 10 * 60_000) });
  NACHRICHTEN.set("e246n-m1", { thread: "e246n-t1", labels: ["INBOX", "UNREAD"], am: jetzt - 5 * H });
  NACHRICHTEN.set("e246n-s1", { thread: "e246n-t1", labels: ["SENT"], am: jetzt - 2 * H, von: "FIAON Support <support@fiaon.com>" });
  NACHRICHTEN.set("e246n-s2", { thread: "e246n-anderer", labels: ["SENT"], am: jetzt - 2 * H, von: "FIAON Support <support@fiaon.com>" });
  NACHRICHTEN.set("e246n-s3", { thread: "e246n-t1", labels: ["SENT"], am: jetzt - 6 * H, von: "FIAON Support <support@fiaon.com>" });
  const { nachrichtLesen } = await import("../server/lib/fiaon-gmail");
  const m1 = await nachrichtLesen("support@fiaon.com", "e246n-m1");
  sentListe = ["e246n-s1"];
  gmailSuchen.length = 0;
  const f1 = await lauf.spaetereAntwortImFaden("support@fiaon.com", m1);
  ok(f1?.id === "e246n-s1", "SENT im selben Faden NACH der Mail → erkannt");
  ok(/^in:sent after:\d+ \{to:pruef246n@kunde\.invalid cc:pruef246n@kunde\.invalid\}$/.test(gmailSuchen[0] ?? ""), `Gmail-Suche nur im Gesendet-Ordner, ab dem Eingang, an den Absender („${gmailSuchen[0] ?? "—"}")`);
  sentListe = ["e246n-s2"];
  ok((await lauf.spaetereAntwortImFaden("support@fiaon.com", m1)) === null, "SENT in einem ANDEREN Faden zählt nicht");
  sentListe = ["e246n-s3"];
  ok((await lauf.spaetereAntwortImFaden("support@fiaon.com", m1)) === null, "SENT VOR der Mail (frühere Antwort) zählt nicht");
  // Maras eigener Versand im selben Faden (auto_beantwortet, ±3 Min.) ist keine Antwort eines Menschen.
  await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, gesendet_am) VALUES ('support@fiaon.com', 'e246n-mara', 'e246n-t1', 'auto_beantwortet', ${new Date(jetzt - 2 * H + 30_000)})`;
  sentListe = ["e246n-s1"];
  ok((await lauf.spaetereAntwortImFaden("support@fiaon.com", m1)) === null, "Maras eigener Auto-Versand im Faden zählt nicht als Mensch");
  await sql`DELETE FROM fiaon_postmeister WHERE gmail_id = 'e246n-mara'`;

  // Ganzer Lauf: zurückgelegte Pause-Zeile, Mensch hat in Gmail geantwortet, dazu eine offene Übergabe.
  const id1 = await pauseZeile("e246n-m1", { personId, ref: REF });
  const schl = lauf.uebergabeSchluessel({ id: id1, personId, ref: REF });
  await sql`INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, quelle, status, link)
            VALUES (${schl}, 'PRUEF246N Kunde hat geschrieben — bitte antworten',
                    ${lauf.uebergabeBlock({ id: id1, postfach: "support@fiaon.com", betreff: "Frage zur Karte", zusammenfassung: "Test", grund: lauf.UEBERGABE_GRUND.entwurf })},
                    'postmeister', 'postmeister', 'offen', '/chef/s/postmeister')`;
  const vor1 = OPENAI.length;
  const e1 = await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m1", gruss: "Gruß", modus: "auto" });
  const z1 = await zeile("e246n-m1");
  ok(e1.aktion === "geordnet" && z1?.aktion === "geordnet" && /^vom Menschen beantwortet/.test(String(z1?.begruendung)), `Zeile „geordnet“ — „${String(z1?.begruendung ?? "—").slice(0, 70)}“`);
  ok(antwortAufrufe(vor1) === 0 && GMAIL_SENDEN.length === 0, "Keine Antwort erzeugt, nichts gesendet, kein Entwurf");
  const [t1] = (await sql`SELECT status, erledigt_von FROM fiaon_betreiber_todos WHERE schluessel = ${schl}`) as any[];
  ok(t1?.status === "erledigt" && t1?.erledigt_von === "Mensch (Gmail)", `Übergabe-Aufgabe geschlossen wie beim Senden (${t1?.status}, ${t1?.erledigt_von})`);

  // Gmail nicht prüfbar → Fehlversuch mit Wiedervorlage, keine Antwort.
  NACHRICHTEN.set("e246n-m2", { thread: "e246n-t2", labels: ["INBOX"], am: jetzt - 5 * H });
  await pauseZeile("e246n-m2", { personId, ref: REF });
  sentKaputt = true;
  const vor2 = OPENAI.length;
  await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m2", gruss: "Gruß", modus: "auto" });
  sentKaputt = false;
  const z2 = await zeile("e246n-m2");
  ok(z2?.aktion === "fehler" && /Gmail-Faden nicht prüfbar/.test(String(z2?.begruendung)) && !!z2?.naechster_versuch_am, "Gmail-Faden nicht prüfbar → Fehlversuch mit Wiedervorlage");
  ok(antwortAufrufe(vor2) === 0 && GMAIL_SENDEN.length === 0, "… und keine Antwort, kein Versand");

  // Aus dem Posteingang genommen (archiviert) → von Hand erledigt, nicht einmal eingeordnet.
  NACHRICHTEN.set("e246n-m3", { thread: "e246n-t3", labels: [], am: jetzt - 5 * H });
  await pauseZeile("e246n-m3", { personId, ref: REF });
  const vor3 = OPENAI.length;
  await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m3", gruss: "Gruß", modus: "auto" });
  const z3 = await zeile("e246n-m3");
  ok(z3?.aktion === "geordnet" && /von Hand erledigt/.test(String(z3?.begruendung)) && OPENAI.length === vor3, "Pause-Mail nicht mehr im Posteingang → „von Hand erledigt“, kein KI-Aufruf");

  // Frische Mail (2 Min., erster Anlauf): KEINE zusätzliche Gmail-Suche (keine Mehrkosten im Normalbetrieb).
  NACHRICHTEN.set("e246n-m4", { thread: "e246n-t4", labels: ["INBOX"], am: Date.now() - 2 * 60_000 });
  gmailSuchen.length = 0;
  await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m4", gruss: "Gruß", modus: "entwurf" });
  ok(!gmailSuchen.some((q) => q.includes("in:sent")), "Frische Mail im Normalbetrieb: keine Faden-Prüfung");
  // Dieselbe Mail 25 Minuten alt (nachgeholt, z. B. nach einer Störung) → geprüft.
  NACHRICHTEN.set("e246n-m5", { thread: "e246n-t5", labels: ["INBOX"], am: Date.now() - 25 * 60_000 });
  NACHRICHTEN.set("e246n-s5", { thread: "e246n-t5", labels: ["SENT"], am: Date.now() - 5 * 60_000, von: "FIAON Support <support@fiaon.com>" });
  sentListe = ["e246n-s5"];
  const e5 = await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m5", gruss: "Gruß", modus: "auto" });
  ok(e5.aktion === "geordnet" && GMAIL_SENDEN.filter((u) => u.includes("/messages/send")).length === 0, "Nachgeholte Mail (25 Min.) mit Antwort eines Menschen → keine zweite Antwort");

  // ═══ 2. MITTEL — Nachholen dauerhaft ═════════════════════════════════════
  console.log("── 2. Nachholen im regulären Takt ─────────────────────────────────");
  const T0 = Date.UTC(2026, 8, 28, 7, 0); // Mo 28.09. 09:00 Berlin
  ok(pm.pauseSuchfenster({ an: false, seit: new Date(T0 - 3 * 86_400_000).toISOString(), aufgehobenAm: new Date(T0).toISOString() }, T0) === 4, "3 Tage Pause, direkt nach dem Aktivieren → 4 Tage");
  ok(pm.pauseSuchfenster({ an: false, seit: new Date(T0 - 3 * 86_400_000).toISOString(), aufgehobenAm: new Date(T0).toISOString() }, T0 + 30 * H) === 6, "30 h nach dem Aktivieren → 6 Tage (Pausenbeginn bleibt im Fenster)");
  ok(pm.pauseSuchfenster({ an: false, seit: new Date(T0 - 3 * 86_400_000).toISOString(), aufgehobenAm: new Date(T0).toISOString() }, T0 + 49 * H) === null, "Mehr als 48 h nach dem Aktivieren → wieder 2 Tage (null)");
  ok(pm.pauseSuchfenster({ an: true, seit: new Date(T0).toISOString(), aufgehobenAm: null }, T0 + H) === null, "Während der Pause → kein Sonderfenster");
  ok(pm.pauseSuchfenster({ an: false, seit: new Date(T0 - 2 * H).toISOString(), aufgehobenAm: new Date(T0).toISOString() }, T0 + H) === 2, "Kurze Pause → mindestens 2 Tage");

  await pauseStand({ an: false, seit: new Date(Date.now() - 5 * 86_400_000), auf: new Date(Date.now() - H) });
  NACHRICHTEN.set("e246n-m6", { thread: "e246n-t6", labels: ["INBOX"], am: Date.now() - 4.5 * 86_400_000 });
  NACHRICHTEN.set("e246n-s6", { thread: "e246n-t6", labels: ["SENT"], am: Date.now() - 3 * 86_400_000, von: "FIAON Support <support@fiaon.com>" });
  await pauseZeile("e246n-m6", { personId, ref: REF });
  inboxListe = []; // die Mail liegt außerhalb jedes Suchfensters, das Gmail liefert
  sentListe = ["e246n-s6"];
  gmailSuchen.length = 0;
  await pm.postmeisterLauf({ postfach: "support@fiaon.com" });
  ok(gmailSuchen.includes("in:inbox newer_than:6d"), `Regulärer Takt 1 h nach 5 Tagen Pause: „${gmailSuchen.find((q) => q.startsWith("in:inbox")) ?? "—"}“`);
  const z6 = await zeile("e246n-m6");
  ok(z6?.aktion === "geordnet", `Zurückgelegte Zeile ohne Suchtreffer trotzdem beansprucht und abgeschlossen (${z6?.aktion})`);
  // Aufhol-Lauf mit eigener Suche nimmt die Pause-Zeilen NICHT (nur der reguläre Takt).
  NACHRICHTEN.set("e246n-m7", { thread: "e246n-t7", labels: ["INBOX"], am: Date.now() - 3 * 86_400_000 });
  await pauseZeile("e246n-m7", { personId, ref: REF });
  await pm.postmeisterLauf({ postfach: "support@fiaon.com", q: "in:inbox older_than:2d newer_than:30d" });
  ok((await zeile("e246n-m7"))?.aktion === "vorgeordnet", "Aufhol-Lauf (eigene Suche) lässt Pause-Zeilen dem regulären Takt");
  // Atomar: zwei gleichzeitige Läufe → genau einer arbeitet.
  const [a, b] = await Promise.all([
    lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m7", gruss: "Gruß", modus: "auto" }),
    lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-m7", gruss: "Gruß", modus: "auto" }),
  ]);
  ok([a, b].filter((x) => x.grund === "schon bearbeitet").length === 1, `Zwei gleichzeitige Anläufe: genau einer beansprucht (${a.grund} / ${b.grund})`);
  // 49 h nach dem Aktivieren: wieder das normale Fenster.
  await pauseStand({ an: false, seit: new Date(Date.now() - 5 * 86_400_000), auf: new Date(Date.now() - 49 * H) });
  gmailSuchen.length = 0;
  await pm.postmeisterLauf({ postfach: "support@fiaon.com" });
  ok(gmailSuchen.includes("in:inbox newer_than:2d"), "49 h nach dem Aktivieren: wieder newer_than:2d");

  // ═══ 3. MITTEL — Mara WhatsApp mit Zeit ══════════════════════════════════
  console.log("── 3. Mara WhatsApp: Tag und Uhrzeit, 12-h-Grenze, kein „heute“ ────");
  const so16 = new Date("2026-09-27T14:00:00Z");
  ok(wa.kurzZeit(so16) === "So 16:00", `kurzZeit → „${wa.kurzZeit(so16)}“`);
  ok(wa.tagUndUhrzeit(so16, new Date("2026-09-28T07:00:00Z")) === "gestern (Sonntag, 27.09.) um 16:00 Uhr", `tagUndUhrzeit → „${wa.tagUndUhrzeit(so16, new Date("2026-09-28T07:00:00Z"))}“`);
  const mo09 = new Date("2026-09-28T07:00:00Z");
  const ctxPause = { nachrichtTag: "2026-09-27", kunde: "Rufen Sie mich heute um 17 Uhr an" };
  ok(!!wa.rueckrufHeuteSperre({ zeit: "2026-09-28 17:00" }, ctxPause, mo09), "Pause-Nachricht vom Sonntag „heute 17 Uhr“ → Montag 17:00 wird abgelehnt");
  ok(!!wa.rueckrufHeuteSperre({ von: "2026-09-28 12:00", bis: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-27", kunde: "nachmittags bitte" }, mo09), "Zeitfenster ohne Tag aus der Pause → nicht auf heute");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-27", kunde: "Bitte am Montag um 17 Uhr" }, mo09) === null, "Nennt er den Montag ausdrücklich → erlaubt");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-27", kunde: "Am 28.09. um 17 Uhr" }, mo09) === null, "Nennt er das Datum ausdrücklich → erlaubt");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-29 09:00" }, ctxPause, mo09) === null, "Ein anderer Tag als heute → nicht gesperrt");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-28", kunde: "heute 17 Uhr" }, mo09) === null, "Nachricht von heute → „heute“ gilt");
  // Nachbesserung 27.09. (Gegenprüfer „mittel“): nur in der Pause, Tag der NEUESTEN Nachricht, relative Wörter von DEREN Tag aus.
  const mo0010 = new Date("2026-09-27T22:10:00Z");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 10:00" }, { kunde: "Rufen Sie mich morgen um 10 an" }, mo0010) === null, "Normalbetrieb (kein nachrichtTag): So 23:05 „morgen um 10“, Antwort Mo 00:10 → Mo 10:00 erlaubt");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 10:00" }, { nachrichtTag: "2026-09-27", kunde: "Rufen Sie mich morgen um 10 an" }, mo09) === null, "Pause-Nachricht vom Sonntag „morgen um 10“ → Montag 10:00 erlaubt");
  ok(!!wa.rueckrufHeuteSperre({ zeit: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-27", kunde: "Guten Morgen, heute um 17 Uhr bitte" }, mo09), "„Guten Morgen … heute 17 Uhr“ aus der Pause → gesperrt (Gruß ist kein „morgen“)");
  ok(wa.rueckrufHeuteSperre({ zeit: "2026-09-28 09:00" }, { nachrichtTag: "2026-09-26", kunde: "übermorgen um 9" }, mo09) === null, "„übermorgen“ von vorgestern → heute erlaubt");
  ok(!!wa.rueckrufHeuteSperre({ zeit: "2026-09-28 09:00" }, { nachrichtTag: "2026-09-26", kunde: "morgen um 9" }, mo09), "„morgen“ von vorgestern (= gestern, vorbei) → gesperrt");
  ok(!!wa.rueckrufHeuteSperre({ bis: "2026-09-28 17:00" }, { nachrichtTag: "2026-09-27", kunde: "bis 17 Uhr" }, mo09), "Fenster nur mit „bis“ heute → gesperrt (vorher ungeprüft)");
  ok(wa.rueckrufHeuteSperre({ von: "2026-09-29 12:00", bis: "2026-09-29 17:00" }, ctxPause, mo09) === null, "Fenster ganz an einem späteren Tag → nicht gesperrt");
  const waQuelle = readFileSync(new URL("../server/lib/fiaon-whatsapp-mara.ts", import.meta.url), "utf8");
  ok(/nachrichtTag: kamInDerPause\(neuesteRein\.am, kp\) \? berlinTag\(new Date\(neuesteRein\.am\)\) : undefined/.test(waQuelle), "Mara setzt nachrichtTag nur für eine Pause-Nachricht und vom Tag der NEUESTEN offenen Nachricht");
  const erg = await wa.werkzeugAusfuehren("rueckruf_eintragen", { zeit: `${wa.berlinTag(new Date())} 23:50`, anliegen: "Rückruf" },
    { personId, leadId: null, nummer: NUM.frisch5, kunde: "heute 17 Uhr", nachrichtTag: "2000-01-01" });
  ok(erg.ergebnis?.ok === false && erg.aktion.ok === false && /vorbei/.test(String(erg.ergebnis?.grund)), "Werkzeug rueckruf_eintragen: Sperre greift VOR dem Kalender (nichts gebucht)");
  const kpBsp = { an: false, seit: new Date(Date.now() - 20 * H).toISOString(), aufgehobenAm: new Date(Date.now() - 5 * 60_000).toISOString() };
  ok(wa.kamInDerPause(new Date(Date.now() - 13 * H), kpBsp) && !wa.kamInDerPause(new Date(Date.now() - 60_000), kpBsp) && !wa.kamInDerPause(new Date(Date.now() - 21 * H), kpBsp), "kamInDerPause: in der Pause ja, danach und lange davor nein");

  for (const n of Object.values(NUM)) { await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`; await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {}); }
  const seitWa = await pauseStand({ an: false, seit: new Date(Date.now() - 20 * H), auf: new Date(Date.now() - 5 * 60_000) });
  const alt13 = new Date(Date.now() - 13 * H);
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.alt13}, 'text', 'Rufen Sie mich heute um 17 Uhr an', 'empfangen', ${alt13}, ${alt13})`;
  const vorW = OPENAI.length;
  const w1 = await wa.maraAntwortet(NUM.alt13);
  ok(/älter als 12 Stunden/.test(String(w1.grund)) && OPENAI.length === vorW, `Pause-Nachricht 13 h alt → keine freie Antwort, kein KI-Aufruf („${String(w1.grund).slice(0, 60)}“)`);
  const [sammel] = (await sql`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`ki-pause-wa-${seitWa}`}`) as any[];
  ok(String(sammel?.text ?? "").includes(NUM.alt13.slice(-4)) && /älter als 12 Stunden/.test(String(sammel?.text ?? "")), "… sie steht in der Sammelaufgabe der Pause (ki-pause-wa-…)");
  const [g1] = (await sql`SELECT antwort_text FROM fiaon_whatsapp_gespraech WHERE nummer = ${NUM.alt13}`) as any[];
  ok(!g1?.antwort_text, "… und es liegt keine Antwort bereit");

  const frisch5 = new Date(Date.now() - 5 * H);
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.frisch5}, 'text', 'Wann kommt meine Karte?', 'empfangen', ${frisch5}, ${frisch5})`;
  const vorW2 = OPENAI.length;
  await wa.maraAntwortet(NUM.frisch5);
  const auftrag5 = OPENAI.slice(vorW2).map((o) => o.text).join("\n");
  ok(auftrag5.includes(`KUNDE (${wa.kurzZeit(frisch5)}): Wann kommt meine Karte?`), `Verlauf trägt Tag und Uhrzeit: „KUNDE (${wa.kurzZeit(frisch5)}): …“`);
  ok(auftrag5.includes("ACHTUNG ZEIT: Seine offene Nachricht kam") && auftrag5.includes(wa.tagUndUhrzeit(frisch5).replace(/"/g, "")), "Älteste offene Nachricht > 3 h → Zeithinweis mit Tag und Uhrzeit");
  const neu = new Date(Date.now() - 10 * 60_000);
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.neu}, 'text', 'Hallo', 'empfangen', ${neu}, ${neu})`;
  const vorW3 = OPENAI.length;
  await wa.maraAntwortet(NUM.neu);
  const auftragNeu = OPENAI.slice(vorW3).map((o) => o.text).join("\n");
  ok(auftragNeu.includes(`KUNDE (${wa.kurzZeit(neu)}): Hallo`) && !auftragNeu.includes("ACHTUNG ZEIT"), "Frische Nachricht: Zeit im Verlauf, aber kein Zeithinweis");

  // Nachbesserung 27.09. (Gegenprüfer „mittel“): Eine Vorlage nach der Pause-Nachricht ist keine Antwort.
  const alt14 = new Date(Date.now() - 14 * H), vorl = new Date(Date.now() - 13 * H);
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.vorlage}, 'text', 'Ich brauche dringend einen Rückruf', 'empfangen', ${alt14}, ${alt14})`;
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, created_at) VALUES ('raus', ${NUM.vorlage}, 'template', 'Erinnerung', 'gesendet', 'fiaon_rueckholung_1', 'System', ${vorl})`;
  const [offenV] = (await sql.unsafe(`${wa.OFFENE_GESPRAECHE_SQL} AND r.nummer = '${NUM.vorlage}'`)) as any[];
  const vorWV = OPENAI.length;
  const wv = await wa.maraAntwortet(NUM.vorlage);
  const [sammelV] = (await sql`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`ki-pause-wa-${seitWa}`}`) as any[];
  ok(!!offenV && /Sammelaufgabe/.test(String(wv.grund)) && OPENAI.length === vorWV && String(sammelV?.text ?? "").includes(NUM.vorlage.slice(-4)),
    `Pause-Nachricht, danach eine Vorlage → steht trotzdem in der Sammelaufgabe (${String(wv.grund).slice(0, 50)})`);
  // Fällt eine Pause-Nachricht aus der Sammlung (hier: created_at vor dem Fenster, empfangen_am darin), bekommt sie eine eigene Aufgabe — genau einmal.
  const seitMs = new Date(seitWa).getTime();
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.einzel}, 'text', 'Bitte um Rückruf', 'empfangen', ${new Date(seitMs - 10 * 60_000)}, ${new Date(seitMs - 20 * 60_000)})`;
  const we1 = await wa.maraAntwortet(NUM.einzel);
  const we2 = await wa.maraAntwortet(NUM.einzel);
  const einzelAuf = (await sql`SELECT titel FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND schluessel LIKE ${`wa-n${NUM.einzel}-%`}`) as any[];
  const einzelProt = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_protokoll WHERE nummer = ${NUM.einzel} AND art = 'uebergabe'`.catch(() => [{ n: -1 }])) as any[];
  ok(/eigene Aufgabe/.test(String(we1.grund)) && /eigene Aufgabe/.test(String(we2.grund)) && einzelAuf.length === 1 && Number(einzelProt[0]?.n) === 1,
    `Nicht in der Sammlung → eigene Aufgabe, beim zweiten Anlauf keine weitere (${einzelAuf.length} Aufgabe, ${einzelProt[0]?.n} Übergabe)`);

  // ═══ 4. NIEDRIG — Geduld ab dem Pausenende ════════════════════════════════
  console.log("── 4. KI_GEDULD_MIN ab max(Nachricht, Pausenende) ──────────────────");
  const auf1 = new Date(Date.now() - 60_000).toISOString();
  ok(wa.geduldAb(new Date(Date.now() - 3 * H), { an: false, seit: new Date(Date.now() - 4 * H).toISOString(), aufgehobenAm: auf1 }) === new Date(auf1).getTime(), "Nachricht 3 h alt, aktiviert vor 1 Min. → Geduld ab dem Aktivieren");
  const t30 = Date.now() - 30_000;
  ok(wa.geduldAb(new Date(t30), { an: false, seit: new Date(Date.now() - 4 * H).toISOString(), aufgehobenAm: auf1 }) === t30, "Nachricht nach dem Aktivieren → Geduld ab der Nachricht");
  await pauseStand({ an: false, seit: new Date(Date.now() - 2 * H), auf: new Date(Date.now() - 60_000) });
  const geduld = new Date(Date.now() - 60 * 60_000);
  await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, empfangen_am, created_at) VALUES ('rein', ${NUM.geduld}, 'text', 'Ist meine Zahlung angekommen?', 'empfangen', ${geduld}, ${geduld})`;
  szenario = "500";
  const w4 = await wa.maraAntwortet(NUM.geduld);
  szenario = "ok";
  const [g4] = (await sql`SELECT antwort_text, ki_rueckfall_am FROM fiaon_whatsapp_gespraech WHERE nummer = ${NUM.geduld}`) as any[];
  ok(/neuer Versuch/.test(String(w4.grund)) && !g4?.antwort_text && !g4?.ki_rueckfall_am, `Störung 1 Min. nach dem Aktivieren (Nachricht 60 Min. alt) → kein Rückfallsatz („${String(w4.grund).slice(0, 60)}“)`);

  // ═══ 5. NIEDRIG — Werkzeuge nicht doppelt ═════════════════════════════════
  console.log("── 5. Werkzeuge im zweiten Anlauf ───────────────────────────────────");
  const kontext = (postmeisterId: number | null, ref: string) => ({ personId, ref, postfach: "support@fiaon.com", postmeisterId, kundenlage: "rate_ueberfaellig" as any });
  const idG = await pauseZeile("e246n-g1", { personId, ref: REF, handlungen: [{ werkzeug: "global_zugang_senden", ergebnis: "Frischer Link zu „Mein Auftrag“ an die Adresse des Auftrags geschickt.", am: new Date().toISOString() }] });
  const fremdVor = FREMD.length;
  const eg = await wz.globalZugangSendenWerkzeug.ausfuehren({}, kontext(idG, REF));
  ok(eg.ok && eg.daten?.schon_verschickt === true && FREMD.length === fremdVor, "global_zugang_senden: zweiter Aufruf zu derselben Mail verschickt keinen zweiten Link");

  await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, gekuendigt_am, letzte_rate_nr, ist_entwurf)
            VALUES (${REF_K}, ${REF_K}, ${personId}, 'paid', NOW() - INTERVAL '2 hours', 2, FALSE)`;
  await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${REF_K}, 1, ${REF_K + "-1"}, 5999, '2026-09-01', 'bezahlt'), (${REF_K}, 2, ${REF_K + "-2"}, 5999, '2026-10-15', 'offen')`;
  const erster = "Kündigung per E-Mail entgegengenommen. Die Kündigung ist vermerkt. Offen bleibt Rate 2 über 59,99 € (fällig 15.10.2026); mit dieser Zahlung endet der Vertrag.";
  const idK = await pauseZeile("e246n-k1", { personId, ref: REF_K, handlungen: [{ werkzeug: "kuendigung_vormerken", ergebnis: erster, am: new Date().toISOString() }] });
  const vermerkeVor = Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${REF_K}`) as any[])[0].n);
  const ek = await wz.kuendigungVormerken.ausfuehren({ zitat: "Hiermit kündige ich meinen Vertrag.", grund: "" }, kontext(idK, REF_K));
  ok(ek.ok && /^Die Kündigung ist vermerkt\./.test(ek.ergebnis) && !/bereits/.test(ek.ergebnis), `Zweiter Anlauf DIESER Mail: „${ek.ergebnis.slice(0, 60)}…“ (nicht „lag bereits vor“)`);
  ok(/Rate 2 über 59,99 €/.test(ek.ergebnis) && ek.daten?.in_diesem_vorgang_vorgemerkt === true, "… mit der offenen Rate von jetzt");
  const vermerkeNach = Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${REF_K}`) as any[])[0].n);
  ok(vermerkeNach === vermerkeVor, "… und kein zweiter Aktenvermerk");
  const ek2 = await wz.kuendigungVormerken.ausfuehren({ zitat: "Hiermit kündige ich meinen Vertrag.", grund: "" }, kontext(null, REF_K));
  ok(/^Die Kündigung lag bereits vor\./.test(ek2.ergebnis), "Gegenprobe: eine ANDERE Mail zur schon gekündigten Bestellung → „lag bereits vor“");

  // Die Formen aus der Produktion (27.09.: 1.054× jsonb-Text, 26× Array aus Texten, 1× echte Liste).
  const flachText = lauf.handlungenFlach(JSON.stringify([{ werkzeug: "a", ergebnis: "x" }]));
  const flachGemischt = lauf.handlungenFlach([JSON.stringify([{ werkzeug: "a" }]), JSON.stringify([{ werkzeug: "b" }]), { werkzeug: "c" }]);
  ok(flachText.length === 1 && flachGemischt.map((h) => h.werkzeug).join() === "a,b,c" && lauf.handlungenFlach("kaputt").length === 0, "handlungen: jsonb-Text, Array aus Texten und echte Liste werden alle gelesen");

  // „Schon erledigt" geht an das Modell.
  await pauseStand({ an: false, seit: new Date(Date.now() - 3 * H), auf: new Date(Date.now() - 60_000) });
  NACHRICHTEN.set("e246n-k1", { thread: "e246n-tk", labels: ["INBOX"], am: Date.now() - 2 * H, text: "Hiermit kündige ich meinen Vertrag." });
  sentListe = [];
  const vorK = OPENAI.length;
  await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: "e246n-k1", gruss: "Gruß", modus: "entwurf" });
  const kiK = OPENAI.slice(vorK).map((o) => o.text).join("\n");
  ok(kiK.includes("SCHON ERLEDIGT zu DIESER Mail") && kiK.includes("kuendigung_vormerken"), "Zweiter Anlauf: das Modell erfährt, was schon erledigt ist");
  ok(GMAIL_SENDEN.filter((u) => u.includes("/messages/send")).length === 0, "Im ganzen Prüfstand: keine Mail gesendet");
  ok(FREMD.length === 0, `Kein fremdes Netz${FREMD.length ? `: ${FREMD.join(", ")}` : ""}`);
} catch (e) {
  fehler++;
  console.error("✗ Abbruch:", e);
} finally {
  await sql`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND (schluessel LIKE 'ki-pause-%' OR schluessel LIKE 'postmeister:%' OR schluessel LIKE 'wa-n49159002461%' OR titel LIKE 'PRUEF246N%')`.catch(() => {});
  await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'e246n-%'`.catch(() => {});
  for (const n of Object.values(NUM)) {
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
  }
  await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ANY(${Object.values(NUM)})`.catch(() => {});
  await sql`DELETE FROM fiaon_contact_log WHERE ref IN (${REF}, ${REF_K})`.catch(() => {});
  await sql`DELETE FROM fiaon_abo_raten WHERE ref = ${REF_K}`.catch(() => {});
  await sql`DELETE FROM fiaon_kuendigungen WHERE ref = ${REF_K}`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref IN (${REF}, ${REF_K})`.catch(() => {});
  if (personId) await sql`DELETE FROM fiaon_persons WHERE id = ${personId}`.catch(() => {});
  await sql`DELETE FROM fiaon_ki_nutzung WHERE created_at >= ${START}`.catch(() => {});
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
  for (const z of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${z.key}, ${z.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
}
console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
