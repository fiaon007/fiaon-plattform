// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-261 (29.09.2026): DIE WHATSAPP-BREMSE
//
// 28.09., 13:36–21:46: 89 Vorlagen scheiterten mit „(#131042) Business
// eligibility payment issue" — Meta konnte nicht abbuchen, und niemand hielt an.
// Geprüft wird die Bremse aus server/lib/fiaon-wa-bremse.ts:
//
//    1  Code-Tabelle: 131042 → zahlung, Kontosperre → gesperrt, 190 → zugang, 131048 → spam,
//       Empfänger-Codes (131056, 131026, 131049, 131047 …) → keine Pause, 131050 → Nummer.
//    2  Regel-Matrix: 7 Zustände × {Werbe-Vorlage, Service-Vorlage, Text} + Faktor;
//       „Meta ODER wir sagen Werbung".
//    3  Webhook-Nachzug: failed → fiaon_whatsapp 'fehler' UND fiaon_wa_aktion ok = FALSE,
//       fehler_code, Grund „Fehler: (#…) … (Status-Webhook)".
//    4  Schwelle: 1. #131042 keine Pause, doppelter Webhook zählt nicht, 2. → Pause
//       „zahlung" mit genau EINER Aufgabe, 3. → keine zweite; nach dem Aktivieren zählt
//       neu; Takt-Abstand 5 Min. pausiert, 61 Min. nicht; #131031 sofort; 2× 131026 und
//       5× 131056 nie; synchroner Fehler beim Senden; außerhalb des Produktionsdienstes
//       nur prozesslokal (kein DB-Schreiben, kein Alarm).
//       Gegenprüfung 29.09.: später Webhook einer Sendung von VOR dem Aktivieren zählt
//       nicht; #190 → „zugang" mit eigener Aufgabe; zwei gleichzeitige pausieren() (das
//       erste Schreiben 0,8 s aufgehalten) → genau EINE Pause, EINE Aufgabe, EINE
//       PAUSIERT-Zeile; scheitert das Speichern, alarmiert der Nachtrag.
//    5  Wand in waSenden: in der Pause 0 Meta-Anfragen, keine Zeile; Text im Fenster
//       geht bei „zahlung", nicht bei „gesperrt".
//    6  Tagesplatz: in der Pause kein Eintrag; danach bekommt derselbe Mensch ihn.
//    7  Alle neun Wege in der Pause → 0 Vorlagen bei Meta; bei ROT nur Service.
//       Gegenprüfung 29.09.: bei ROT in der Zentrale nur die Gruppe Monatsrate — die
//       Termin-Vorlage an „neu" wird abgelehnt (Hand-Lauf, Automatik, Lage je Gruppe),
//       einzeln (Akte, Raum) geht sie.
//    8  Zentrale: laufender Hand-Lauf endet mit der Schlusszeile ohne „übersprungen";
//       GELB → Stundenmenge halb.
//    9  Qualität: gespeicherter Stand, älter als 15 Min. → frisch, Meta nicht
//       erreichbar → letzter Stand, Wechsel auf ROT → eine Aufgabe; Webhook-Felder.
//   9b  ROT bleibt (01.10.2026): nach ROT heben UNKNOWN und ein leeres Feld die Sperre
//       nicht auf (gespeichert ROT, metaMeldet, rotGehaltenSeit, kein Alarm), Anzeige
//       „Meta meldet gerade unbekannt — es gilt weiter ROT"; GELB/GRÜN heben auf; GRÜN →
//       UNKNOWN bremst weiter nicht; ein alter Stand „UNKNOWN" nach ROT (Verlauf) gilt
//       sofort als ROT und wird ohne zweiten Alarm berichtigt.
//   10  Aktivieren: health_status BLOCKED → Pause bleibt, AVAILABLE → aus, fehlt →
//       aus mit Hinweis, LIMITED → aus mit Warnung; Token abgelehnt (#190) → bleibt,
//       „zugang" ohne Antwort → bleibt; Routen: nur Inhaber (403 Leitung);
//       „Meta-Stand jetzt prüfen" sagt frisch = false, wenn Meta nicht antwortet.
//   11  Nachtrag-Lauf (scripts/wa-aktion-nachtrag.ts): Vorschau zählt, --schreiben
//       setzt, zweiter Lauf findet 0; Sicherung als JSON.
//   12  Quelltext-Wand.
//   14  Kontosperre: Nachrichten aus der Sperrzeit, älter als 12 Stunden (auch über
//       23,5 h), kommen als EINE Sammelaufgabe (zuAltFuerMara, Quelle „wa"); jünger
//       als 12 h nicht; zweiter Lauf nichts doppelt.
//   13  Browser (nur mit WA_BREMSE_BUILD=<vite-Ausgabe>): /chef/s/mara → Chip
//       „WhatsApp" → „WhatsApp wieder aktivieren" gedrückt → „aktiv"; rotes Band auf
//       einer anderen /chef-Seite; 380 px; Screenshots.
//
// NUR gegen den lokalen Prüfstand. Kein Netz: Meta und Make sind Attrappen, jede
// Anfrage wird mitgeschrieben — es geht keine echte WhatsApp und keine Mail raus.
// Eigene Testzeilen (Personen 926201–926299, Nummern 49159009926…), am Ende gelöscht;
// die Einstellungen wa_pause, wa_meta_stand, wa_zentrale_automatik und
// lead_whatsapp_an werden am Ende wiederhergestellt.
//
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e261?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-wa-bremse.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e261?sslmode=require";
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(process.env.DATABASE_URL!)) { console.error("NUR gegen den lokalen Prüfstand!"); process.exit(2); }
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "RESEND_API_KEY", "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── KEIN NETZ: jede Anfrage geht an die Attrappe ─────────────────────────────
process.env.MAKE_WEBHOOK_URL = "http://make.pruefstand.invalid/hook";
process.env.WHATSAPP_WABA_ID = "pruef-waba";
process.env.WHATSAPP_PHONE_ID = "pruef-nummer";
process.env.META_SYSTEM_TOKEN = "pruef-token";
process.env.META_APP_SECRET = "pruef-geheim";
process.env.META_GRAPH_URL = "http://meta.pruefstand.invalid";

import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/** Metas Kategorie je Vorlage (Attrappe). fiaon_kk_termin_morgen führt „Meta" als MARKETING — unsere Regel sagt Service. */
const KATEGORIE: Record<string, string> = {
  fiaon_kk_anfrage: "MARKETING", fiaon_kk_antrag_offen: "MARKETING", fiaon_kk_letzte: "MARKETING", fiaon_kk_tag1: "MARKETING",
  fiaon_kk_rechnung: "MARKETING", fiaon_kkb_rechnung: "MARKETING", fiaon_kk_nicht_erreicht: "MARKETING", fiaon_kkb_nicht_erreicht: "MARKETING",
  fiaon_kk_auskunft: "MARKETING", fiaon_kk_auskunft_lead: "MARKETING", fiaon_kk_rueckfrage: "MARKETING", fiaon_kkb_rueckfrage: "MARKETING",
  fiaon_kk_rate: "UTILITY", fiaon_kk_termin_morgen: "MARKETING",
};
let metaQualitaet: string | null = "GREEN";
let gesundheit: "AVAILABLE" | "LIMITED" | "BLOCKED" | "fehlt" = "AVAILABLE";
let metaStoerung = false;
let tokenUngueltig = false;
let sendeFehler: number | null = null;
const metaAnfragen: { url: string; methode: string }[] = [];
const metaSendungen: { an: string; vorlage: string }[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url ?? input);
  const methode = String(init?.method ?? "GET");
  const body = typeof init?.body === "string" ? init.body : "";
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return echtFetch(input, init);
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
  if (url.startsWith("http://make.pruefstand.invalid")) return new Response("Accepted", { status: 200 });
  if (url.startsWith("http://meta.pruefstand.invalid")) {
    metaAnfragen.push({ url, methode });
    const u = decodeURIComponent(url);
    if (metaStoerung) return json({ error: { code: 100, message: "Prüfstand: Meta gestört" } }, 400);
    if (tokenUngueltig) return json({ error: { code: 190, type: "OAuthException", message: "Error validating access token: Session has expired" } }, 401);
    if (u.includes("/message_templates")) {
      return json({ data: Object.entries(KATEGORIE).map(([name, category], i) => ({ name, status: "APPROVED", category, id: String(i + 1), components: [] })) });
    }
    if (u.includes("/messages") && methode === "POST") {
      if (sendeFehler) {
        return json({ error: { code: sendeFehler, message: "(#131042) Business eligibility payment issue", error_data: { details: "Zahlung offen: https://business.facebook.com/billing_hub/pruef" } } }, 400);
      }
      try { const j = JSON.parse(body); metaSendungen.push({ an: String(j.to), vorlage: String(j.template?.name ?? "text") }); } catch { /* */ }
      return json({ messages: [{ id: `wamid.PRUEF261.S${metaAnfragen.length}` }] });
    }
    const gesund = () => gesundheit === "fehlt" ? {} : {
      health_status: {
        can_send_message: gesundheit,
        entities: gesundheit === "BLOCKED"
          ? [{ entity_type: "WABA", id: "pruef-waba", can_send_message: "BLOCKED", errors: [{ error_code: 141000, error_description: "Zahlungsmethode fehlt", possible_solution: "Zahlungsmethode hinterlegen" }] }]
          : [{ entity_type: "PHONE_NUMBER", id: "pruef-nummer", can_send_message: gesundheit }],
      },
    };
    if (u.includes("pruef-waba") && u.includes("fields=health_status")) return json({ id: "pruef-waba", ...gesund() });
    if (u.includes("pruef-waba")) return json({ whatsapp_business_manager_messaging_limit: "TIER_2K" });
    if (u.includes("pruef-nummer") && u.includes("health_status")) return json({ ...gesund(), status: "CONNECTED", quality_rating: metaQualitaet });
    if (u.includes("pruef-nummer")) return json({ quality_rating: metaQualitaet, verified_name: "FIAON Prüfstand" });
    return json({});
  }
  throw new Error(`Prüfstand: kein Netz (${url})`);
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const b = await import("../server/lib/fiaon-wa-bremse");
const wa = await import("../server/lib/fiaon-whatsapp");
const z = await import("../server/lib/fiaon-wa-zentrale");
const kette = await import("../server/lib/fiaon-lead-whatsapp");
const tk = await import("../server/lib/fiaon-telefonkartei");
const { WERKZEUGE } = await import("../server/lib/fiaon-mara-auftrag");
const verkauf = await import("../server/lib/fiaon-auskunft-verkauf");
const metaLeads = await import("../server/lib/fiaon-meta-leads");

let ok = 0, fehl = 0;
const pruef = (name: string, bed: boolean, info: unknown = "") => {
  if (bed) { ok++; console.log(`  ✓ ${name}`); }
  else { fehl++; console.log(`  ✗ ${name}${info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const IDS = Array.from({ length: 99 }, (_, i) => 926201 + i);
const NR = (id: number) => `49159009${id}`;
const DOMAIN = "wb261.invalid";
const TAG = 86_400_000;
const vor = (ms: number) => new Date(Date.now() - ms);
const START = new Date(Date.now() - 1000);
const AKTEUR = "Prüfstand E-261";
const laufIds: string[] = [];
let testAgent = 0;
const SCHLUESSEL = ["wa_pause", "wa_meta_stand", "wa_zentrale_automatik", "lead_whatsapp_an", "wa_pause_wa_gesammelt"];
const gesichert = new Map<string, string | null>();

async function aufraeumen() {
  const spalten = (await sqlPool`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name IN ('person_id', 'ref')
       AND table_name NOT IN ('fiaon_persons', 'fiaon_applications', 'fiaon_leads')`) as any[];
  for (const s of spalten) {
    const t = String(s.table_name);
    if (s.column_name === "person_id") await sqlPool.unsafe(`DELETE FROM "${t}" WHERE person_id::text = ANY($1)`, [IDS.map(String)]).catch(() => {});
    else await sqlPool.unsafe(`DELETE FROM "${t}" WHERE ref::text LIKE 'WB261-%'`).catch(() => {});
  }
  await sqlPool`DELETE FROM fiaon_wa_aktion WHERE lauf_id = ANY(${laufIds.length ? laufIds : ["-"]}) OR wa_id LIKE 'wamid.PRUEF261%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_lauf WHERE ausgeloest_von = ${AKTEUR} OR id = ANY(${laufIds.length ? laufIds : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_kontofehler WHERE nummer LIKE '49159009926%' OR wa_id LIKE 'wamid.PRUEF261%' OR text LIKE 'Prüfstand E-261%' OR am >= ${START}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE '49159009926%' OR wa_id LIKE 'wamid.PRUEF261%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer LIKE '49159009926%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_tagesplatz WHERE schluessel LIKE 'n:49159009926%' OR schluessel LIKE 'p:9262%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND (quelle = 'wa-pause' OR schluessel LIKE 'wa-pause-%' OR schluessel LIKE 'wa-rot-%' OR schluessel LIKE 'wa-n49159009926%')`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_meta_ereignisse WHERE seite_id = 'pruef-waba'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref LIKE 'WB261-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${IDS}) OR ref LIKE 'WB261-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_leads WHERE person_id = ANY(${IDS}) OR email LIKE ${"%@" + DOMAIN}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_applications WHERE person_id = ANY(${IDS}) OR ref LIKE 'WB261-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${IDS})`.catch(() => {});
  if (testAgent) await sqlPool`DELETE FROM fiaon_admin_log WHERE agent_id = ${testAgent}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_agents WHERE email LIKE ${"%@" + DOMAIN}`.catch(() => {});
}

async function sichern() {
  for (const k of SCHLUESSEL) {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`.catch(() => [])) as any[];
    gesichert.set(k, r ? String(r.value) : null);
  }
}
async function wiederherstellen() {
  for (const [k, v] of Array.from(gesichert.entries())) {
    if (v === null) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${k}`.catch(() => {});
    else await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`.catch(() => {});
  }
}
async function setzen(k: string, v: string) {
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
}

/** Der gespeicherte Meta-Stand (wie ihn der Takt ablegt) — `alterMin` Minuten alt. */
async function stand(q: string | null, alterMin = 0) {
  metaQualitaet = q;
  await setzen("wa_meta_stand", JSON.stringify({ qualitaet: q, stufe: "TIER_2K", name: "FIAON Prüfstand", gesundheit: null, am: vor(alterMin * 60_000).toISOString(), quelle: "pruefstand", verlauf: [] }));
  b.waBremseZwischenspeicherLeeren();
}
/** Der Pausenzustand — null = aktiv (seit `aufgehobenVorMin` Minuten). */
async function pause(art: "zahlung" | "gesperrt" | "zugang" | "spam" | "hand" | null, code: number | null = null, aufgehobenVorMin = 120) {
  const jetzt = new Date().toISOString();
  const z = art
    ? { an: true, art, code, grund: b.waPauseMeldung({ art, code }), fehler: `Prüfstand E-261 (${art})`, link: null, quelle: "webhook", seit: jetzt, von: "automatisch", aufgehobenAm: null, aufgehobenVon: null, verlauf: [] }
    : { an: false, art: "zahlung", code: 131042, grund: null, fehler: null, link: null, quelle: null, seit: vor((aufgehobenVorMin + 10) * 60_000).toISOString(), von: null, aufgehobenAm: vor(aufgehobenVorMin * 60_000).toISOString(), aufgehobenVon: AKTEUR, verlauf: [] };
  await setzen("wa_pause", JSON.stringify(z));
  b.waBremseZwischenspeicherLeeren();
}
async function person(id: number, o: { alt?: number; tier?: number; vor?: string } = {}) {
  await sqlPool`
    INSERT INTO fiaon_persons (id, person_ref, first_name, last_name, primary_email, primary_phone, phone_key9, country, priority_tier, tier_reason, created_at, updated_at)
    VALUES (${id}, ${`WB261-P${id}`}, ${o.vor ?? "Test"}, ${`Bremse${id}`}, ${`p${id}@${DOMAIN}`}, ${`+${NR(id)}`}, ${NR(id).slice(-9)}, 'DE',
            ${o.tier ?? 3}, ${o.tier === 2 ? "rechnung_offen" : "nur_lead"}, ${vor(o.alt ?? TAG)}, ${vor(o.alt ?? TAG)})`;
}
async function lead(personId: number): Promise<number> {
  const [l] = (await sqlPool`
    INSERT INTO fiaon_leads (person_id, email, vorname, nachname, telefon, whatsapp_erlaubt, quelle, erstellt_am)
    VALUES (${personId}, ${`p${personId}@${DOMAIN}`}, 'Test', ${`Bremse${personId}`}, ${`+${NR(personId)}`}, TRUE, 'pruefstand', ${vor(TAG)}) RETURNING id`) as any[];
  return Number(l.id);
}
async function bestellung(id: number) {
  const ref = `WB261-${id}`;
  await sqlPool`
    INSERT INTO fiaon_applications (ref, payment_reference, type, status, current_step, pack_key, pack_name, first_name, last_name, email, country,
                                    person_id, payment_status, amount_due, created_at, updated_at)
    VALUES (${ref}, ${`FIAON-WB${String(id).slice(-4)}`}, 'privat', 'submitted', 9, 'pro', 'FIAON Pro (Standard)', 'Test', ${`Bremse${id}`},
            ${`p${id}@${DOMAIN}`}, 'DE', ${id}, 'pending_payment', 59.99, ${vor(2 * TAG)}, ${vor(2 * TAG)})`;
  return ref;
}
/** Eine unserer Vorlagen, die Meta angenommen hat — und die Zeile der Zentrale dazu. */
async function gesendet(personId: number, waId: string, o: { vorlage?: string; ok?: boolean; grund?: string | null; aktion?: boolean; vorMs?: number } = {}) {
  await sqlPool`
    INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, von, gesendet_am, created_at)
    VALUES (${waId}, 'raus', ${NR(personId)}, ${personId}, 'vorlage', 'Prüfstand', ${o.vorlage ?? "fiaon_kk_anfrage"}, 'gesendet', 'Mara', ${vor(o.vorMs ?? 3 * 60_000)}, ${vor(o.vorMs ?? 3 * 60_000)})`;
  if (o.aktion !== false) {
    await sqlPool`
      INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, wa_id, ok, grund)
      VALUES (${personId}, 'neu', ${o.vorlage ?? "fiaon_kk_anfrage"}, 'hand', 'L-PRUEF261', ${AKTEUR}, ${waId}, ${o.ok ?? true}, ${o.grund ?? null})`;
  }
}
const scheitert = async (waId: string, code: number | null, details = "") => {
  await wa.waEingang({ statuses: [{ id: waId, status: "failed", errors: [code ? { code, title: code === 131042 ? "Business eligibility payment issue" : "Prüfstand-Fehler", error_data: { details } } : { title: "Message undeliverable" }] }] });
  await wa.waEingangNachlauf();
};
const alarme = async () => (await sqlPool`SELECT id, schluessel, titel, text, prioritaet FROM fiaon_betreiber_todos WHERE quelle = 'wa-pause' AND created_at >= ${START} ORDER BY id`) as any[];
const pauseDb = async () => { const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'wa_pause'`) as any[]; return r ? JSON.parse(String(r.value)) : null; };
const aktionen = async (personId: number) => (await sqlPool`SELECT ok, grund, fehler_code, fehler_am, quelle FROM fiaon_wa_aktion WHERE person_id = ${personId} ORDER BY id`) as any[];
const vorlagenBeiMeta = () => metaSendungen.filter((s) => s.vorlage !== "text");

// ── kleine Web-App für die Routen (Akte, Raum, Steuerpult) ────────────────
async function webApp(): Promise<{ basis: string; zu: () => void }> {
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/fiaon", (await import("../server/routes/fiaon-vertrieb")).default);
  app.use("/api/fiaon", (await import("../server/routes/fiaon-mara-steuerpult")).default);
  const { raumRouten } = await import("../server/routes/fiaon-whatsapp-postfach");
  app.use("/api/fiaon/raum", raumRouten(() => ({ agentId: testAgent, name: "Prüfstand", alles: true })));
  const server = await new Promise<any>((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
  return { basis: `http://127.0.0.1:${server.address().port}/api/fiaon`, zu: () => server.close() };
}
const chefCookie = (stufe: "inhaber" | "leitung") => {
  const exp = Date.now() + 3_600_000;
  const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${testAgent}:${stufe}:${exp}`).digest("hex").slice(0, 40);
  return `fiaon_chef=${testAgent}.${stufe}.${exp}.${sig}`;
};

try {
  await sichern();
  await aufraeumen();
  await wa.waTabellen();
  await z.zentraleSchema();
  b.waPauseProduktionSimulieren(true);
  await pause(null);
  await stand("GREEN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("1  Code-Tabelle");
  // ═════════════════════════════════════════════════════════════════════════
  const r = b.pauseRegel;
  pruef("131042 → zahlung, ab dem 2. gleichen Fehler", r(131042)?.art === "zahlung" && r(131042)?.ab === 2);
  pruef("Kontosperre 131031/368/131045/133010/131005 → gesperrt, beim 1. Fehler",
    [131031, 368, 131045, 133010, 131005].every((c) => r(c)?.art === "gesperrt" && r(c)?.ab === 1));
  pruef("190 (Token abgelaufen) → eigene Art „zugang“, beim 1. Fehler — keine Kontosperre",
    r(190)?.art === "zugang" && r(190)?.ab === 1 && b.waFehlerArt(190) === "zugang" && /Zugang \(Token\)/.test(b.waPauseMeldung({ art: "zugang", code: 190 })));
  pruef("Gar nichts raus (auch kein Text) nur bei gesperrt und zugang", b.waAllesZu("gesperrt") && b.waAllesZu("zugang") && !b.waAllesZu("zahlung") && !b.waAllesZu("hand"));
  pruef("131048 → spam, ab dem 2.", r(131048)?.art === "spam" && r(131048)?.ab === 2);
  pruef("Empfänger-Codes 131056/131026/131049/131047/130429/131016/131000/132000 → keine globale Pause",
    [131056, 131026, 131049, 131047, 130429, 131016, 131000, 132000].every((c) => r(c) === null));
  pruef("131050 → Werbesperre der Nummer (keine globale Pause)", b.waFehlerArt(131050) === "nummer" && r(131050) === null);
  pruef("Unbekannter Code → keine Pause", r(999999) === null && b.waFehlerArt(999999) === "sonst");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2  Regel-Matrix");
  // ═════════════════════════════════════════════════════════════════════════
  const W = { vorlage: "fiaon_kk_anfrage" }, S = { vorlage: "fiaon_kk_rate" }, T = { text: true };
  const matrix: [string, () => Promise<void>, [boolean, number] | [boolean], [boolean, number] | [boolean], boolean, string | null][] = [
    ["unbekannt", async () => { await pause(null); await stand(null); }, [true, 1], [true, 1], true, null],
    ["GRÜN", async () => { await pause(null); await stand("GREEN"); }, [true, 1], [true, 1], true, null],
    ["GELB", async () => { await pause(null); await stand("YELLOW"); }, [true, 0.5], [true, 1], true, null],
    ["ROT", async () => { await pause(null); await stand("RED"); }, [false], [true, 1], true, "Meta-Qualität ROT"],
    ["Pause zahlung", async () => { await stand("GREEN"); await pause("zahlung", 131042); }, [false], [false], true, "WhatsApp pausiert (#131042)"],
    ["Pause gesperrt", async () => { await stand("GREEN"); await pause("gesperrt", 131031); }, [false], [false], false, "WhatsApp pausiert (#131031)"],
    ["Pause zugang", async () => { await stand("GREEN"); await pause("zugang", 190); }, [false], [false], false, "WhatsApp pausiert (#190)"],
  ];
  for (const [name, setup, werbung, service, text, grund] of matrix) {
    await setup();
    const w = await b.waBremse(W), s = await b.waBremse(S), t = await b.waBremse(T);
    const passt = w.erlaubt === werbung[0] && (werbung[1] === undefined || w.faktor === werbung[1])
      && s.erlaubt === service[0] && (service[1] === undefined || s.faktor === service[1])
      && t.erlaubt === text && (grund === null || String(w.grund).startsWith(grund));
    pruef(`${name}: Werbung ${w.erlaubt ? `ja ×${w.faktor}` : "nein"}, Service ${s.erlaubt ? `ja ×${s.faktor}` : "nein"}, Text ${t.erlaubt ? "ja" : "nein"}`,
      passt, { w, s, t });
  }
  await pause(null); await stand("RED");
  const mk = await b.waBremse({ vorlage: "fiaon_kk_termin_morgen" });
  pruef("ROT: Service-Vorlage, die Meta als MARKETING führt, gilt als Werbung („Meta ODER wir“)", !mk.erlaubt && mk.werbung, mk);
  const ohne = await b.waBremse({});
  pruef("Ohne Angabe gilt die strengste Lesart (Werbe-Vorlage)", !ohne.erlaubt && ohne.werbung);
  pruef("GELB: mitFaktor(25, 0,5) = 13", b.mitFaktor(25, b.WA_FAKTOR_GELB) === 13);
  // Gegenprüfung 29.09.: einzeln (Akte, Raum) darf die Termin-Vorlage bei ROT raus — in der Zentrale nicht (Teil 7).
  await pause(null); await stand("RED");
  const termin1 = await b.waBremse({ vorlage: "fiaon_kk_termin" });
  pruef("ROT: fiaon_kk_termin EINZELN (Akte, Raum) erlaubt", termin1.erlaubt, termin1);
  await stand("GREEN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("3  Webhook-Nachzug: fiaon_wa_aktion folgt dem Status-Webhook");
  // ═════════════════════════════════════════════════════════════════════════
  const P1 = 926201;
  await person(P1);
  await gesendet(P1, "wamid.PRUEF261.W1");
  await scheitert("wamid.PRUEF261.W1", 131026, "Unable to deliver the message");
  const [w1] = (await sqlPool`SELECT status, fehler FROM fiaon_whatsapp WHERE wa_id = 'wamid.PRUEF261.W1'`) as any[];
  const [a1] = await aktionen(P1);
  pruef(`fiaon_whatsapp: status 'fehler', „${String(w1?.fehler).slice(0, 40)}…“`, w1?.status === "fehler" && String(w1?.fehler).startsWith("(#131026)"));
  pruef(`fiaon_wa_aktion: ok = FALSE, fehler_code 131026, fehler_am gesetzt`, a1?.ok === false && Number(a1?.fehler_code) === 131026 && !!a1?.fehler_am, a1);
  pruef(`… Grund „${String(a1?.grund).slice(0, 60)}…“`, String(a1?.grund).startsWith("Fehler: (#131026)") && String(a1?.grund).includes("von Meta nicht zugestellt (Status-Webhook)"));
  const [kf1] = (await sqlPool`SELECT code, art, quelle, nummer, person_id FROM fiaon_wa_kontofehler WHERE wa_id = 'wamid.PRUEF261.W1'`) as any[];
  pruef("Kontofehler-Zeile: 131026, art empfaenger, quelle webhook, Nummer und Person", kf1?.code === 131026 && kf1?.art === "empfaenger" && kf1?.quelle === "webhook" && kf1?.nummer === NR(P1) && Number(kf1?.person_id) === P1, kf1);
  pruef("131026 pausiert nicht", !(await b.waPauseLesen(true)).an);
  await gesendet(P1, "wamid.PRUEF261.W0");
  await scheitert("wamid.PRUEF261.W0", null);
  const a0 = (await aktionen(P1))[1];
  pruef("Altes Format ohne Code: ok = FALSE, fehler_code leer", a0?.ok === false && a0?.fehler_code === null, a0);
  // Zustellt → bleibt ok
  await gesendet(P1, "wamid.PRUEF261.W9");
  await wa.waEingang({ statuses: [{ id: "wamid.PRUEF261.W9", status: "delivered" }] });
  pruef("Zugestellt: die Zeile bleibt ok", (await aktionen(P1))[2]?.ok === true);

  // ═════════════════════════════════════════════════════════════════════════
  titel("4  Schwelle: 2 gleiche Kontofehler in 60 Min., Kontosperre sofort");
  // ═════════════════════════════════════════════════════════════════════════
  const P2 = 926202;
  await person(P2);
  await pause(null);
  const alarmeVor = (await alarme()).length;
  await gesendet(P2, "wamid.PRUEF261.K1"); await gesendet(P2, "wamid.PRUEF261.K2"); await gesendet(P2, "wamid.PRUEF261.K3");
  await scheitert("wamid.PRUEF261.K1", 131042, "Zahlung offen: https://business.facebook.com/billing_hub/pruef");
  pruef("1. #131042 → keine Pause", !(await b.waPauseLesen(true)).an);
  await scheitert("wamid.PRUEF261.K1", 131042);
  const [dopp] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_kontofehler WHERE code = 131042 AND am >= ${START}`) as any[];
  pruef(`Derselbe Webhook zweimal (Meta wiederholt) zählt einmal (${dopp.n} Zeile) — keine Pause`, Number(dopp.n) === 1 && !(await b.waPauseLesen(true)).an);
  await scheitert("wamid.PRUEF261.K2", 131042, "Zahlung offen: https://business.facebook.com/billing_hub/pruef");
  const p2 = await b.waPauseLesen(true);
  pruef(`2. #131042 → Pause „${p2.art}“ (#${p2.code}, über ${p2.quelle})`, p2.an && p2.art === "zahlung" && p2.code === 131042 && p2.quelle === "webhook", p2);
  pruef(`… Link aus Metas Fehlertext: ${p2.link}`, p2.link === "https://business.facebook.com/billing_hub/pruef");
  const al1 = (await alarme()).slice(alarmeVor);
  pruef(`Genau EINE dringende Aufgabe an Justin („${al1[0]?.titel}“)`, al1.length === 1 && Number(al1[0]?.prioritaet) === 1 && String(al1[0]?.schluessel) === `wa-pause-${p2.seit}`, al1);
  pruef("… Text: Abrechnung, /chef/s/mara, „WhatsApp wieder aktivieren“, nichts als Ersatz",
    /Abrechnung/.test(al1[0]?.text) && /\/chef\/s\/mara/.test(al1[0]?.text) && /WhatsApp wieder aktivieren/.test(al1[0]?.text) && /Ersatz/.test(al1[0]?.text));
  await scheitert("wamid.PRUEF261.K3", 131042);
  pruef("3. #131042 → keine zweite Aufgabe", (await alarme()).length - alarmeVor === 1);
  // Aktivieren → späte Meldung zählt neu
  gesundheit = "AVAILABLE";
  const ak = await b.aktivieren(AKTEUR);
  pruef("Aktivieren (Meta: AVAILABLE) → aktiv", ak.ok && !ak.zustand.an);
  await gesendet(P2, "wamid.PRUEF261.K4");
  await scheitert("wamid.PRUEF261.K4", 131042);
  pruef("Nach dem Aktivieren: EINE neue #131042 pausiert nicht (gezählt wird ab dem Aktivieren)", !(await b.waPauseLesen(true)).an);
  // 61 Min. Abstand → keine Pause; 5 Min. Abstand (Automatik-Takt) → Pause
  await sqlPool`DELETE FROM fiaon_wa_kontofehler WHERE code = 131042 AND am >= ${vor(3 * 3_600_000)} AND (nummer LIKE '49159009926%' OR wa_id LIKE 'wamid.PRUEF261%')`;
  await pause(null, null, 180);
  await sqlPool`INSERT INTO fiaon_wa_kontofehler (am, code, art, quelle, wa_id, nummer, text) VALUES (${vor(61 * 60_000)}, 131042, 'zahlung', 'webhook', 'wamid.PRUEF261.T61', ${NR(P2)}, 'Prüfstand E-261 alt')`;
  await gesendet(P2, "wamid.PRUEF261.T62");
  await scheitert("wamid.PRUEF261.T62", 131042);
  pruef("Zwei #131042 im Abstand von 61 Min. → keine Pause", !(await b.waPauseLesen(true)).an);
  await sqlPool`DELETE FROM fiaon_wa_kontofehler WHERE code = 131042 AND (nummer LIKE '49159009926%' OR wa_id LIKE 'wamid.PRUEF261%')`;
  await sqlPool`INSERT INTO fiaon_wa_kontofehler (am, code, art, quelle, wa_id, nummer, text) VALUES (${vor(5 * 60_000)}, 131042, 'zahlung', 'webhook', 'wamid.PRUEF261.T5', ${NR(P2)}, 'Prüfstand E-261 Takt')`;
  await gesendet(P2, "wamid.PRUEF261.T6");
  await scheitert("wamid.PRUEF261.T6", 131042);
  pruef("Takt-Abstand 5 Min. (Automatik): die zweite #131042 pausiert", (await b.waPauseLesen(true)).an);
  // Kontosperre: sofort
  await pause(null);
  const alarmeVorSperre = (await alarme()).length;
  await gesendet(P2, "wamid.PRUEF261.G1");
  await scheitert("wamid.PRUEF261.G1", 131031);
  const pg = await b.waPauseLesen(true);
  pruef(`#131031 → sofort Pause „${pg.art}“`, pg.an && pg.art === "gesperrt" && pg.code === 131031);
  pruef("… eine Aufgabe „Konto gesperrt“", (await alarme()).length - alarmeVorSperre === 1 && /gesperrt/.test((await alarme()).at(-1)?.titel ?? ""));
  // Gegenprüfung 29.09.: #190 ist eine eigene Art — Titel und Anweisung sagen „Token erneuern", nicht „Sperre klären".
  await pause(null);
  const alarmeVorZugang = (await alarme()).length;
  await gesendet(P2, "wamid.PRUEF261.Z1");
  await scheitert("wamid.PRUEF261.Z1", 190);
  const pz = await b.waPauseLesen(true);
  const alZ = (await alarme()).slice(alarmeVorZugang);
  pruef(`#190 → sofort Pause „${pz.art}“ (nicht „gesperrt“)`, pz.an && pz.art === "zugang" && pz.code === 190, pz);
  pruef(`… eine Aufgabe „${alZ[0]?.titel}“ mit dem Weg „META_SYSTEM_TOKEN in Render“`,
    alZ.length === 1 && /Token\) abgelaufen/.test(alZ[0]?.titel ?? "") && /META_SYSTEM_TOKEN/.test(alZ[0]?.text ?? "") && !/Sperre klären/.test(alZ[0]?.text ?? ""), alZ);
  // Gegenprüfung 29.09.: später Webhook einer Sendung von VOR dem Aktivieren — vermerkt, aber nicht gezählt.
  await pause(null, null, 0); // eben aktiviert
  await gesendet(P2, "wamid.PRUEF261.S1", { vorMs: 10 * 60_000 }); // gesendet vor 10 Min., also vor dem Aktivieren
  await scheitert("wamid.PRUEF261.S1", 131031);
  const [spaet] = (await sqlPool`SELECT gesendet_am FROM fiaon_wa_kontofehler WHERE wa_id = 'wamid.PRUEF261.S1'`) as any[];
  pruef("Später Webhook (#131031) einer Sendung von vor dem Aktivieren → vermerkt (mit Sendezeit), keine Pause",
    !(await b.waPauseLesen(true)).an && !!spaet?.gesendet_am, spaet);
  await sqlPool`UPDATE fiaon_settings SET value = ${JSON.stringify({ ...(await pauseDb()), aufgehobenAm: vor(60_000).toISOString() })} WHERE key = 'wa_pause'`;
  b.waBremseZwischenspeicherLeeren(); b.waPauseProduktionSimulieren(true);
  await gesendet(P2, "wamid.PRUEF261.S2", { vorMs: 5_000 }); // gesendet NACH dem Aktivieren
  await scheitert("wamid.PRUEF261.S2", 131031);
  pruef("… dieselbe Meldung zu einer Sendung NACH dem Aktivieren pausiert sofort", (await b.waPauseLesen(true)).an);
  // Empfänger-Codes
  await pause(null);
  for (const [i, c] of [[1, 131026], [2, 131026], [3, 131056], [4, 131056], [5, 131056], [6, 131056], [7, 131056]] as const) {
    await gesendet(P2, `wamid.PRUEF261.E${i}`);
    await scheitert(`wamid.PRUEF261.E${i}`, c);
  }
  pruef("2× 131026 und 5× 131056 → keine Pause", !(await b.waPauseLesen(true)).an);
  // Synchroner Fehler beim Senden (quelle „senden") — gezählt wird ab jetzt (eben aktiviert)
  await pause(null, null, 0);
  sendeFehler = 131042;
  const s1 = await wa.waSenden(NR(P2), { vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, { personId: P2 });
  pruef(`Senden: Meta lehnt sofort ab → Ergebnis mit Code (${s1.code})`, !s1.ok && s1.code === 131042);
  pruef("… eine synchrone #131042 pausiert nicht", !(await b.waPauseLesen(true)).an);
  await wa.waSenden(NR(P2), { vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, { personId: P2 });
  const ps = await b.waPauseLesen(true);
  pruef(`… die zweite pausiert (quelle ${ps.quelle})`, ps.an && ps.art === "zahlung" && ps.quelle === "senden");
  sendeFehler = null;
  const anfragenVorDritter = metaAnfragen.length;
  const s3 = await wa.waSenden(NR(P2), { vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, { personId: P2 });
  pruef("… danach geht nichts mehr an Meta (gebremst, 0 Anfragen)", !s3.ok && s3.gebremst === "pause" && metaAnfragen.length === anfragenVorDritter);
  // Kein Produktionsdienst: nur prozesslokal
  await pause(null);
  const alarmeLokalVor = (await alarme()).length;
  const kfVor = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_kontofehler`) as any[])[0].n);
  b.waPauseProduktionSimulieren(false);
  await b.kontofehlerMelden({ code: 131031, quelle: "senden", nummer: NR(P2), text: "Prüfstand E-261 lokal" });
  const lokal = await b.waPauseLesen();
  const dbLokal = await pauseDb();
  const kfNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_kontofehler`) as any[])[0].n);
  pruef("Kein Produktionsdienst: Pause nur in diesem Prozess (nurLokal), nichts gespeichert, kein Alarm, keine Kontofehler-Zeile",
    lokal.an && lokal.nurLokal === true && dbLokal?.an === false && (await alarme()).length === alarmeLokalVor && kfNach === kfVor, { lokal, dbLokal });
  b.waBremseZwischenspeicherLeeren();
  b.waPauseProduktionSimulieren(true);
  await pause(null);
  // Gegenprüfung 29.09. (Rennen „Pause ohne Aufgabe"): Das erste Schreiben der Pause wird 0,8 s aufgehalten;
  // in der Lücke liest der Webhook-Pfad den Zustand frisch und eine zweite Meldung ruft pausieren().
  {
    const alarmeRennenVor = (await alarme()).length;
    let pausiertZeilen = 0;
    const errAlt = console.error;
    console.error = (...a: any[]) => { if (/\[WA-BREMSE\] PAUSIERT/.test(String(a[0]))) pausiertZeilen++; errAlt(...a); };
    try {
      b.waPausePruefHaken({ verzoegernEinmalMs: 800 });
      const ein = { art: "zahlung" as const, code: 131042, von: "automatisch", quelle: "webhook" as const, fehler: "(#131042) Business eligibility payment issue — Prüfstand E-261 Rennen" };
      const pA = b.pausieren(ein);
      await warte(200);
      const mitten = await b.waPauseLesen(true);
      const pB = b.pausieren(ein);
      const [rA, rB] = await Promise.all([pA, pB]);
      const db = await pauseDb();
      const al = (await alarme()).slice(alarmeRennenVor);
      pruef(`Rennen: zwei gleichzeitige pausieren() (erstes Schreiben 0,8 s aufgehalten) → A.neu ${rA.neu}, B.neu ${rB.neu}, in der Lücke gilt die Pause (${mitten.an})`,
        rA.neu && !rB.neu && mitten.an && db?.an === true && db?.art === "zahlung", { rA: rA.neu, rB: rB.neu, mitten: mitten.an, db });
      pruef(`… genau EINE Aufgabe an Justin (${al.length}) und EINE PAUSIERT-Zeile (${pausiertZeilen})`, al.length === 1 && pausiertZeilen === 1, al);
    } finally {
      console.error = errAlt;
      b.waPausePruefHaken(null);
    }
    // Scheitert das Speichern wirklich, gilt die Pause im Prozess — und wer sie beim nächsten Lesen nachträgt, alarmiert.
    await pause(null);
    const alarmeNachtragVor = (await alarme()).length;
    b.waPausePruefHaken({ fehlerEinmal: true });
    const rN = await b.pausieren({ art: "zahlung", code: 131042, von: "automatisch", quelle: "webhook", fehler: "Prüfstand E-261 Nachtrag" });
    const dbN1 = await pauseDb();
    const alN1 = (await alarme()).length - alarmeNachtragVor;
    const gilt = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
    const nachgetragen = await b.waPauseLesen(true);
    const dbN2 = await pauseDb();
    const alN2 = (await alarme()).length - alarmeNachtragVor;
    pruef(`Speichern gescheitert: Pause gilt im Prozess (${!gilt.erlaubt}), DB noch frei (${dbN1?.an === false}), noch kein Alarm (${alN1})`,
      rN.neu && !gilt.erlaubt && dbN1?.an === false && alN1 === 0);
    pruef(`… beim nächsten Lesen nachgetragen (DB an: ${dbN2?.an}) — mit genau EINER Aufgabe (${alN2})`, nachgetragen.an && dbN2?.an === true && alN2 === 1);
    b.waPausePruefHaken(null);
    await pause(null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("5  Wand in waSenden");
  // ═════════════════════════════════════════════════════════════════════════
  const P5 = 926205;
  await person(P5);
  await pause("zahlung", 131042);
  const anf5 = metaAnfragen.length;
  const zeilen5 = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp WHERE nummer = ${NR(P5)} AND richtung = 'raus'`) as any[])[0].n);
  const v5 = await wa.waSenden(NR(P5), { vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, { personId: P5 });
  pruef(`Pause: Vorlage abgelehnt „${String(v5.grund).slice(0, 50)}…“`, !v5.ok && v5.gebremst === "pause" && v5.pausiert === true && String(v5.grund).startsWith("WhatsApp pausiert"));
  pruef("… 0 Meta-Anfragen (auch keine Vorlagenliste), keine Zeile in fiaon_whatsapp", metaAnfragen.length === anf5 && (await zeilen5()) === 0);
  await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at)
                VALUES ('wamid.PRUEF261.R5', 'rein', ${NR(P5)}, ${P5}, 'text', 'Hallo, ich habe eine Frage.', 'empfangen', NOW(), NOW())`;
  const t5 = await wa.waSenden(NR(P5), { text: "Guten Tag, gern helfe ich Ihnen weiter." }, { personId: P5, von: "Mara" });
  pruef("Pause „zahlung“: Text im offenen Fenster geht raus", t5.ok && metaSendungen.at(-1)?.vorlage === "text", t5);
  await pause("gesperrt", 131031);
  const g5 = await wa.waSenden(NR(P5), { text: "Guten Tag, gern helfe ich Ihnen weiter." }, { personId: P5, von: "Mara" });
  pruef("Pause „gesperrt“: auch kein Text", !g5.ok && g5.gebremst === "pause");
  await pause("zugang", 190);
  const z5 = await wa.waSenden(NR(P5), { text: "Guten Tag, gern helfe ich Ihnen weiter." }, { personId: P5, von: "Mara" });
  pruef("Pause „zugang“ (#190): auch kein Text", !z5.ok && z5.gebremst === "pause");
  await pause(null);

  // ═════════════════════════════════════════════════════════════════════════
  titel("6  Tagesplatz");
  // ═════════════════════════════════════════════════════════════════════════
  const P6 = 926206;
  await person(P6);
  const plaetze = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_tagesplatz WHERE schluessel IN (${`p:${P6}`}, ${`n:${NR(P6)}`})`) as any[])[0].n);
  await pause("zahlung", 131042);
  const tp1 = await wa.waTagesplatz({ personId: P6, nummer: NR(P6), weg: "pruefstand", vorlage: "fiaon_kk_anfrage" });
  pruef("Pause: kein Tagesplatz verbraucht (gebremst, 0 Einträge)", !tp1.ok && (tp1 as any).gebremst === true && (await plaetze()) === 0);
  await pause(null); await stand("RED");
  const tpR = await wa.waTagesplatz({ personId: P6, nummer: NR(P6), weg: "pruefstand", vorlage: "fiaon_kk_anfrage" });
  pruef("ROT + Werbe-Vorlage: kein Tagesplatz", !tpR.ok && (await plaetze()) === 0);
  await stand("GREEN");
  const tp2 = await wa.waTagesplatz({ personId: P6, nummer: NR(P6), weg: "pruefstand", vorlage: "fiaon_kk_anfrage" });
  pruef("Nach dem Aktivieren: derselbe Mensch bekommt am selben Tag seinen Platz", tp2.ok && (await plaetze()) === 2);

  // ═════════════════════════════════════════════════════════════════════════
  titel("7  Alle neun Wege: Pause → 0 Vorlagen, ROT → nur Service");
  // ═════════════════════════════════════════════════════════════════════════
  await sqlPool`SELECT 1`;
  const { ensureAgentTables, signAgentToken, AGENT_COOKIE_NAME } = await import("../server/routes/fiaon-agent") as any;
  if (typeof ensureAgentTables === "function") await ensureAgentTables();
  const [ag] = (await sqlPool`INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
                              VALUES ('WB261 Prüfstand', ${`agent@${DOMAIN}`}, 'agent', TRUE, TRUE, NOW()) RETURNING id, COALESCE(session_epoch, 0) AS epoch`) as any[];
  testAgent = Number(ag.id);
  const agentCookie = `${AGENT_COOKIE_NAME}=${signAgentToken(testAgent, Number(ag.epoch))}`;
  const web = await webApp();
  const post = (pfad: string, body: unknown, cookie = agentCookie) =>
    echtFetch(`${web.basis}${pfad}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) })
      .then(async (x) => ({ status: x.status, j: await x.json().catch(() => null) as any }));
  const get = (pfad: string, cookie = agentCookie) =>
    echtFetch(`${web.basis}${pfad}`, { headers: { Cookie: cookie } }).then(async (x) => ({ status: x.status, j: await x.json().catch(() => null) as any }));

  const PZ = 926210, PK = 926211, PT = 926212;
  await person(PZ); await lead(PZ);
  await person(PK); const leadK = await lead(PK);
  await person(PT, { tier: 2, alt: 10 * TAG }); await bestellung(PT);
  await setzen("lead_whatsapp_an", "an");
  const autoAn = JSON.stringify({ an: true, von: "07:00", bis: "21:00", jeStunde: 30, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_anfrage" } });
  await setzen("wa_zentrale_automatik", JSON.stringify({ an: false, von: "07:00", bis: "21:00", jeStunde: 30, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_anfrage" } }));

  const tags = z.tagsueber(); // Zentrale und Verkaufstakt schreiben nachts ohnehin nicht (21–7 Uhr) — dann dort übersprungen
  if (!tags) console.log("    (Ruhezeit: Hand-Lauf, Automatik und Verkaufstakt werden hier nicht geprüft)");
  const wege = async (erwartet: string) => {
    const res: Record<string, { ok: boolean; grund: string }> = {};
    if (tags) {
      const hand = await z.laufStarten({ gruppe: "neu", vorlage: "fiaon_kk_anfrage", anzahl: 5, quelle: "hand", von: AKTEUR });
      if (hand.ok) laufIds.push(hand.lauf.id);
      res["Zentrale: Hand-Lauf"] = { ok: hand.ok, grund: hand.ok ? "gestartet" : hand.grund };
      const takt = await verkauf.whatsappMoeglich();
      const vt = await z.auskunftWhatsAppSenden(PZ, { laufId: "AV-PRUEF261", von: "Verkaufstakt" });
      res["Verkaufstakt (Auskunft)"] = { ok: vt.ok || takt.moeglich, grund: `${vt.grund ?? ""} · Stufe möglich: ${takt.moeglich} (${takt.grund ?? ""})` };
    }
    const k = await kette.whatsappKetteLaufen(10);
    res["Lead-Kette"] = { ok: k.gesendet > 0, grund: Object.keys(k.uebersprungen).join(" | ") };
    const beg = await kette.ersteWhatsAppFuerLead(leadK);
    res["Begrüßung"] = { ok: beg.ok, grund: String(beg.grund ?? "") };
    const karte = await tk.karteEinzeln(PT);
    const kt = karte ? await tk.karteiWhatsApp(karte, "rechnung", AKTEUR) : { ok: false, text: "keine Karte" } as any;
    res["Telefonkartei"] = { ok: kt.ok, grund: String(kt.text ?? "") };
    const werkzeug = WERKZEUGE.find((w) => w.name === "whatsapp_senden")!;
    const ma = await werkzeug.ausfuehren({ personId: PZ, vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, AKTEUR);
    res["Mara-Auftrag"] = { ok: ma.ok, grund: ma.text };
    const akte = await post(`/agent/kunden/${PZ}/whatsapp`, { vorlage: "fiaon_kk_anfrage", werte: ["Test"] });
    res["Akte (Route)"] = { ok: akte.status === 200, grund: `${akte.status} ${akte.j?.error ?? ""}` };
    const raum = await post("/raum/senden", { nummer: NR(PZ), vorlage: "fiaon_kk_anfrage", werte: ["Test"] }, "");
    res["Raum: Vorlage (Route)"] = { ok: raum.status === 200, grund: `${raum.status} ${raum.j?.error ?? ""}` };
    const start = await post("/raum/starten", { nummer: NR(PK), vorlage: "fiaon_kk_anfrage", personId: PK }, "");
    res["Raum: neue Vorlage (Route)"] = { ok: start.status === 200, grund: `${start.status} ${start.j?.error ?? ""}` };
    if (tags) {
      const auto = await (async () => { await setzen("wa_zentrale_automatik", autoAn); const x = await z.automatikTakt(); await setzen("wa_zentrale_automatik", JSON.stringify({ ...JSON.parse(autoAn), an: false })); return x; })();
      res["Zentrale: Automatik"] = { ok: auto.gesendet > 0, grund: String(auto.grund ?? "") };
    }
    for (const [weg, x] of Object.entries(res)) {
      pruef(`${weg}: nichts raus — „${x.grund.slice(0, 90)}“`, !x.ok && x.grund.includes(erwartet), x);
    }
  };

  await pause("zahlung", 131042); await stand("GREEN");
  const vorlagenVorPause = vorlagenBeiMeta().length;
  const aktionenVorPause = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion WHERE person_id = ANY(${IDS})`) as any[])[0].n);
  await wege("WhatsApp pausiert");
  pruef("Pause: 0 Vorlagen bei Meta über alle Wege", vorlagenBeiMeta().length === vorlagenVorPause, vorlagenBeiMeta().slice(vorlagenVorPause));
  const aktionenNachPause = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion WHERE person_id = ANY(${IDS})`) as any[])[0].n);
  pruef("Pause: keine „übersprungen“-Zeile in fiaon_wa_aktion (niemand verliert seinen Tag)", aktionenNachPause === aktionenVorPause);
  const brR = await get("/raum/bremse", "");
  pruef("Raum: GET …/whatsapp/bremse meldet die Pause", brR.status === 200 && brR.j?.bremse?.pause === true && /^WhatsApp pausiert/.test(brR.j?.bremse?.satz ?? ""), brR.j);

  await pause(null); await stand("RED");
  const vorlagenVorRot = vorlagenBeiMeta().length;
  await wege("Meta-Qualität ROT");
  pruef("ROT: 0 Werbe-Vorlagen bei Meta", vorlagenBeiMeta().length === vorlagenVorRot, vorlagenBeiMeta().slice(vorlagenVorRot));
  // Justin (29.09.): Die Begrüßung eines FRISCHEN Leads (Formular ≤ 24 h) läuft auch bei ROT — der alte Lead
  // (1 Tag, oben in wege()) bleibt gesperrt; in der Pause hält auch die frische Begrüßung an.
  {
    const PF = 926213;
    await person(PF);
    const [lf] = (await sqlPool`
      INSERT INTO fiaon_leads (person_id, email, vorname, nachname, telefon, whatsapp_erlaubt, quelle, erstellt_am)
      VALUES (${PF}, ${`p${PF}@${DOMAIN}`}, 'Test', ${`Frisch${PF}`}, ${`+${NR(PF)}`}, TRUE, 'pruefstand', NOW() - INTERVAL '5 minutes') RETURNING id`) as any[];
    const vorFrisch = vorlagenBeiMeta().length;
    const bf = await kette.ersteWhatsAppFuerLead(Number(lf.id));
    pruef(`ROT: Begrüßung eines frischen Leads (5 Min.) geht raus (${metaSendungen.at(-1)?.vorlage})`,
      bf.ok && vorlagenBeiMeta().length === vorFrisch + 1 && /^fiaon_kkb?_anfrage$/.test(String(metaSendungen.at(-1)?.vorlage)), bf);
    await pause("zahlung", 131042);
    const [lf2] = (await sqlPool`
      INSERT INTO fiaon_leads (person_id, email, vorname, nachname, telefon, whatsapp_erlaubt, quelle, erstellt_am)
      VALUES (${PF}, ${`q${PF}@${DOMAIN}`}, 'Test', ${`Frisch2${PF}`}, ${`+${NR(PF + 50)}`}, TRUE, 'pruefstand', NOW() - INTERVAL '2 minutes') RETURNING id`) as any[];
    const vorPauseFrisch = vorlagenBeiMeta().length;
    const bf2 = await kette.ersteWhatsAppFuerLead(Number(lf2.id));
    pruef(`Pause: auch die Begrüßung eines frischen Leads hält an („${String(bf2.grund ?? "").slice(0, 50)}…“)`,
      !bf2.ok && /^WhatsApp pausiert/.test(String(bf2.grund ?? "")) && vorlagenBeiMeta().length === vorPauseFrisch, bf2);
    await pause(null);
  }
  const rate = await wa.waSenden(NR(PT), { vorlage: "fiaon_kk_rate", werte: ["Herr Test", "59,99", "01.10.2026", "FIAON-WB6212-2"], knopfWert: "FIAON-WB6212-2" }, { personId: PT });
  pruef(`ROT: die Monatsrate (Service) geht raus (${metaSendungen.at(-1)?.vorlage})`, rate.ok && /^fiaon_kkb?_rate$/.test(String(metaSendungen.at(-1)?.vorlage)), rate);
  // Gegenprüfung 29.09.: In der Zentrale zählt bei ROT die GRUPPE — die Termin-Vorlage an Lead-Gruppen ist Massen-Werbung.
  const gbNeu = await z.gruppenBremse("neu", "fiaon_kk_termin", "pruefstand");
  const gbRate = await z.gruppenBremse("rate_offen", "fiaon_kk_rate", "pruefstand");
  pruef(`ROT: Zentrale-Gruppe „neu“ mit fiaon_kk_termin gesperrt („${String(gbNeu.grund).slice(0, 60)}…“), „Monatsrate“ frei`,
    !gbNeu.erlaubt && /^Meta-Qualität ROT/.test(String(gbNeu.grund)) && /Monatsrate/.test(String(gbNeu.grund)) && gbRate.erlaubt, { gbNeu, gbRate });
  const lageRot = await z.zentraleLage();
  const lg = (k: string) => (lageRot.gruppen as any[]).find((x) => x.schluessel === k);
  pruef("ROT: Zentrale-Lage liefert die Bremse je Gruppe (neu/ohne_antrag/abbrecher gesperrt, Monatsrate frei)",
    lg("neu")?.bremse?.erlaubt === false && lg("ohne_antrag")?.bremse?.erlaubt === false && lg("abbrecher")?.bremse?.erlaubt === false && lg("rate_offen")?.bremse?.erlaubt === true,
    (lageRot.gruppen as any[]).map((x) => [x.schluessel, x.bremse]));
  if (tags) {
    const vorTermin = vorlagenBeiMeta().length;
    const hTermin = await z.laufStarten({ gruppe: "neu", vorlage: "fiaon_kk_termin", anzahl: 5, quelle: "hand", von: AKTEUR });
    if (hTermin.ok) laufIds.push(hTermin.lauf.id);
    pruef(`ROT: Hand-Lauf „neu“ mit Termin-Vorlage abgelehnt („${String(!hTermin.ok && hTermin.grund).slice(0, 60)}…“)`,
      !hTermin.ok && /^Meta-Qualität ROT/.test(String(hTermin.grund)), hTermin);
    await setzen("wa_zentrale_automatik", JSON.stringify({ an: true, von: "07:00", bis: "21:00", jeStunde: 30, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_termin" } }));
    const aTermin = await z.automatikTakt();
    await setzen("wa_zentrale_automatik", JSON.stringify({ an: false, von: "07:00", bis: "21:00", jeStunde: 30, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_termin" } }));
    pruef(`ROT: Automatik mit „neu“ auf Termin-Vorlage schickt nichts („${String(aTermin.grund).slice(0, 60)}…“)`,
      aTermin.gesendet === 0 && /^Meta-Qualität ROT/.test(String(aTermin.grund)) && vorlagenBeiMeta().length === vorTermin, aTermin);
  }
  await stand("YELLOW");
  const lageGelb = await z.zentraleLage();
  const lgG = (k: string) => (lageGelb.gruppen as any[]).find((x) => x.schluessel === k);
  pruef("GELB: Faktor je Gruppe — „neu“ 0,5, Monatsrate 1 (die Seite halbiert nur Werbe-Gruppen)",
    lgG("neu")?.bremse?.faktor === 0.5 && lgG("rate_offen")?.bremse?.faktor === 1);
  await stand("GREEN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("8  Zentrale: Lauf endet mit Schlusszeile, GELB halbiert die Automatik");
  // ═════════════════════════════════════════════════════════════════════════
  const tagsueber = z.tagsueber();
  if (!tagsueber) {
    console.log("    (Ruhezeit 21–7 Uhr: Lauf und Automatik senden nachts nicht — Teil 8 übersprungen)");
  } else {
    await pause(null); await stand("GREEN");
    const LZ = [926220, 926221, 926222];
    for (const id of LZ) await person(id, { alt: 2 * 3_600_000 });
    let gezogen = false;
    z.laufPruefstand({ pauseMs: 0, happen: 1, huelle: (echt) => (async (...a: Parameters<typeof echt>) => {
      const r = await echt(...a);
      if (!gezogen) { gezogen = true; await b.pausieren({ art: "hand", fehler: "Prüfstand E-261: Pause mitten im Lauf", von: AKTEUR }); }
      return r;
    }) as typeof echt });
    const st = await z.laufStarten({ gruppe: "neu", vorlage: "fiaon_kk_anfrage", anzahl: 3, quelle: "hand", von: AKTEUR });
    if (st.ok) laufIds.push(st.lauf.id);
    let s = st.ok ? await z.laufStand(st.lauf.id) : null;
    const bis = Date.now() + 20_000;
    while (s?.laeuft && Date.now() < bis) { await warte(100); s = await z.laufStand(st.ok ? st.lauf.id : ""); }
    const zeilenLauf = st.ok ? (await sqlPool`SELECT ok, grund FROM fiaon_wa_aktion WHERE lauf_id = ${st.lauf.id}`) as any[] : [];
    pruef(`Hand-Lauf (3 geplant): Pause nach der ersten Sendung → endet „${s?.schluss}“`,
      !!st.ok && s?.zustand === "fertig" && s?.gesendet === 1 && s?.schluss === "WhatsApp pausiert — der Rest wurde nicht gesendet.", { st, s });
    pruef(`… keine „übersprungen“-Zeile für den Rest (${zeilenLauf.length} Zeile im Lauf)`, zeilenLauf.length === 1 && zeilenLauf[0].ok === true);
    z.laufPruefstand({ huelle: null, pauseMs: 1200, happen: 25 });
    await pause(null);
    // Automatik bei GELB: „30 je Stunde" darf wie „15 je Stunde" senden. Damit das Ergebnis nicht an der Uhr
    // hängt, stehen für diese Stunde schon so viele Automatik-Sendungen da, dass GELB genau noch EINE erlaubt —
    // GRÜN erlaubte mindestens zwei (sollBisMinute(30) − sollBisMinute(15) ≥ 1 zu jeder Minute).
    const LG = [926230, 926231, 926232];
    for (const id of LG) await person(id, { alt: 3 * 3_600_000 });
    await stand("YELLOW");
    await setzen("wa_zentrale_automatik", JSON.stringify({ an: true, von: "07:00", bis: "21:00", jeStunde: 30, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_anfrage" } }));
    const schonJetzt = async () => Number(((await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion WHERE quelle = 'automatik' AND ok
         AND date_trunc('hour', erstellt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('hour', NOW() AT TIME ZONE 'Europe/Berlin')`) as any[])[0].n);
    const m1 = z.berlinMinutenJetzt();
    const sollG = z.sollBisMinute(b.mitFaktor(30, b.WA_FAKTOR_GELB), m1, 420, 1260);
    const sollGr = z.sollBisMinute(30, m1, 420, 1260);
    const auffuellen = Math.max(0, sollG - 1 - (await schonJetzt()));
    for (let i = 0; i < auffuellen; i++) {
      await sqlPool`INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, ok) VALUES (${926290 + (i % 9)}, 'neu', 'fiaon_kk_anfrage', 'automatik', 'A-PRUEF261-X', 'Automatik', TRUE)`;
    }
    const schon = await schonJetzt();
    const auto = await z.automatikTakt();
    const m2 = z.berlinMinutenJetzt();
    const erlaubtGelb = new Set([sollG - schon, z.sollBisMinute(15, m2, 420, 1260) - schon]);
    pruef(`GELB: Automatik „30 je Stunde“ rechnet mit 15 — ${auto.gesendet} gesendet (GELB erlaubt noch ${sollG - schon}, GRÜN hätte ${sollGr - schon} erlaubt)`,
      erlaubtGelb.has(auto.gesendet) && auto.gesendet >= 1 && sollGr - schon > auto.gesendet, { auto, sollG, sollGr, schon });
    await setzen("wa_zentrale_automatik", JSON.stringify({ an: false, von: "07:00", bis: "21:00", jeStunde: 4, gruppen: ["neu"], vorlagen: { neu: "fiaon_kk_anfrage" } }));
    const lage = await z.zentraleLage();
    pruef(`Zentrale-Lage liefert die Bremse in Worten („${lage.bremse.satz}“, Automatik ${lage.bremse.jeStundeGelb} je Stunde)`,
      lage.bremse.qualitaet === "YELLOW" && lage.bremse.faktor === 0.5 && /GELB/.test(String(lage.bremse.satz)) && lage.bremse.jeStundeGelb === 2);
    await stand("GREEN");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("9  Qualität: gespeicherter Stand, frisch nach 15 Min., Wechsel auf ROT");
  // ═════════════════════════════════════════════════════════════════════════
  await stand("RED", 20); metaQualitaet = "GREEN";
  const f1 = await b.metaStandLesen();
  const [dbStand] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'wa_meta_stand'`) as any[];
  const dbS = JSON.parse(String(dbStand.value));
  pruef(`Stand 20 Min. alt (ROT) → frisch gelesen: ${f1.qualitaet}, gespeichert, Verlauf ROT → GRÜN`,
    f1.qualitaet === "GREEN" && dbS.qualitaet === "GREEN" && dbS.verlauf?.[0]?.von === "RED" && dbS.verlauf?.[0]?.zu === "GREEN", dbS);
  pruef(`… Kontostand gelesen (${dbS.gesundheit?.kann}), Stufe ${dbS.stufe}`, dbS.gesundheit?.kann === "AVAILABLE" && dbS.stufe === "TIER_2K");
  await stand("YELLOW", 20); metaStoerung = true;
  const f2 = await b.metaStandLesen();
  metaStoerung = false;
  pruef(`Meta nicht erreichbar → letzter Stand bleibt (${f2.qualitaet})`, f2.qualitaet === "YELLOW");
  // Rückfall: Nach einem Fehlversuch fragt das Lesen höchstens alle 2 Minuten neu (sonst wartete jede Vorlage auf Meta).
  await stand("YELLOW", 20); metaStoerung = true;
  await b.metaStandLesen();
  const anfragenNachFehl = metaAnfragen.length;
  const f2b = await b.metaStandLesen();
  metaStoerung = false;
  pruef(`… und fragt danach 2 Minuten lang nicht bei jedem Lesen neu (${metaAnfragen.length - anfragenNachFehl} neue Anfragen, Stand ${f2b.qualitaet})`,
    metaAnfragen.length === anfragenNachFehl && f2b.qualitaet === "YELLOW");
  await stand("GREEN", 20); metaQualitaet = "RED";
  const rotVor = (await alarme()).filter((a) => String(a.schluessel).startsWith("wa-rot-")).length;
  const f3 = await b.metaStandAuffrischen("takt");
  const f4 = await b.metaStandAuffrischen("takt");
  const rotNach = (await alarme()).filter((a) => String(a.schluessel).startsWith("wa-rot-")).length;
  pruef(`Takt: Wechsel GRÜN → ROT meldet „geändert“ (${f3.geaendert}), der nächste nicht (${f4.geaendert})`, f3.geaendert && !f4.geaendert);
  pruef("… genau eine Aufgabe „Meta bewertet die Nummer mit ROT“", rotNach - rotVor === 1);
  const qb = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
  pruef("… danach bremst die Zentrale-Regel sofort (Werbe-Vorlage nein)", !qb.erlaubt && qb.qualitaet === "RED");
  // Webhook-Felder
  await stand("RED", 1); metaQualitaet = "YELLOW";
  await metaLeads.meldungSpeichern({ object: "whatsapp_business_account", entry: [{ id: "pruef-waba", changes: [{ field: "phone_number_quality_update", value: { event: "UPGRADE", current_limit: "TIER_2K" } }] }] });
  await warte(300);
  const f5 = await b.metaStandLesen();
  pruef(`Webhook phone_number_quality_update → Stand sofort frisch (${f5.qualitaet})`, f5.qualitaet === "YELLOW");
  await pause(null);
  await metaLeads.meldungSpeichern({ object: "whatsapp_business_account", entry: [{ id: "pruef-waba", changes: [{ field: "account_update", value: { event: "DISABLED_UPDATE", ban_info: { waba_ban_state: "DISABLE", waba_ban_date: "2026-09-29" } } }] }] });
  const pa = await b.waPauseLesen(true);
  pruef(`Webhook account_update (ban DISABLE) → Pause „${pa.art}“`, pa.an && pa.art === "gesperrt" && pa.quelle === "webhook");
  await pause(null); await stand("GREEN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("9b ROT bleibt, bis Meta GELB oder GRÜN meldet (01.10.2026)");
  // ═════════════════════════════════════════════════════════════════════════
  // Gemessen am 29.09.: 14:48 ROT, 15:00 UNKNOWN, 15:04 ROT — in den vier Minuten galt „keine Bremse".
  {
    const rotZahl = async () => (await alarme()).filter((a) => String(a.schluessel).startsWith("wa-rot-")).length;
    const dbStand = async () => JSON.parse(String(((await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'wa_meta_stand'`) as any[])[0]?.value ?? "{}"));
    await stand("RED", 20); metaQualitaet = "UNKNOWN";
    const rotVor9b = await rotZahl();
    const u1 = await b.metaStandAuffrischen("takt");
    const d1 = await dbStand();
    pruef(`gespeichert ROT, Meta meldet UNKNOWN → wirksam bleibt ROT (gespeichert ${d1.qualitaet}, Meta ${d1.metaMeldet}, gehalten seit ${d1.rotGehaltenSeit ? "gesetzt" : "—"}), kein Wechsel`,
      u1.stand.qualitaet === "RED" && !u1.geaendert && d1.qualitaet === "RED" && d1.metaMeldet === "UNKNOWN" && !!d1.rotGehaltenSeit && (d1.verlauf ?? []).length === 0, d1);
    const w1 = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
    const s1 = await b.waBremse({ vorlage: "fiaon_kk_rate" });
    pruef("… Werbe-Vorlage weiter gesperrt (ROT-Satz), Monatsrate (Service) geht", !w1.erlaubt && w1.qualitaet === "RED" && w1.grund === b.WA_ROT_SATZ && s1.erlaubt, { w1, s1 });
    const l1 = await b.waBremseLage();
    pruef(`… Anzeige ehrlich: „${String(l1.satz).slice(0, 72)}…“`,
      l1.qualitaet === "RED" && l1.rotGehalten && l1.metaMeldet === "UNKNOWN" && l1.werbungGestoppt
      && /^Meta meldet gerade unbekannt — es gilt weiter ROT, bis Meta GELB oder GRÜN meldet\. Meta-Qualität ROT/.test(String(l1.satz)), l1);
    const zl = await z.metaStand();
    pruef(`… Zentrale (metaStand) zeigt ROT (${zl.qualitaet})`, zl.qualitaet === "RED");
    const u2 = await b.metaStandAuffrischen("takt");
    const d2 = await dbStand();
    pruef("… zweiter Takt mit UNKNOWN: „gehalten seit“ bleibt derselbe, kein Alarm", !u2.geaendert && d2.rotGehaltenSeit === d1.rotGehaltenSeit && (await rotZahl()) === rotVor9b, { d1: d1.rotGehaltenSeit, d2: d2.rotGehaltenSeit });
    metaQualitaet = null; // Meta liefert gar keine Qualität (nur die Stufe)
    const u3 = await b.metaStandAuffrischen("takt");
    pruef(`… leeres Feld: weiter ROT (${u3.stand.qualitaet}, Meta ${u3.stand.metaMeldet ?? "nichts"})`, u3.stand.qualitaet === "RED" && u3.stand.metaMeldet == null && !!u3.stand.rotGehaltenSeit && !u3.geaendert);
    metaQualitaet = "YELLOW";
    const u4 = await b.metaStandAuffrischen("takt");
    const d4 = await dbStand();
    const w4 = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
    pruef(`GELB hebt ROT auf: Wechsel gemeldet, Verlauf ROT → GELB, nicht mehr gehalten, Werbung erlaubt mit Faktor ${w4.faktor}`,
      u4.geaendert && d4.qualitaet === "YELLOW" && !d4.rotGehaltenSeit && d4.verlauf?.[0]?.von === "RED" && d4.verlauf?.[0]?.zu === "YELLOW" && w4.erlaubt && w4.faktor === 0.5, d4);
    await stand("RED", 20); metaQualitaet = "UNKNOWN";
    await b.metaStandAuffrischen("takt");
    metaQualitaet = "GREEN";
    const u5 = await b.metaStandAuffrischen("takt");
    pruef("GRÜN hebt ROT auf (auch nach einer Weile „unbekannt“)", u5.geaendert && u5.stand.qualitaet === "GREEN" && !u5.stand.rotGehaltenSeit && (await b.waBremse({ vorlage: "fiaon_kk_anfrage" })).erlaubt);
    // Ohne ROT davor wie bisher: GRÜN → UNKNOWN bremst nicht.
    await stand("GREEN", 20); metaQualitaet = "UNKNOWN";
    const u6 = await b.metaStandAuffrischen("takt");
    const w6 = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
    pruef(`Gegenprobe: GRÜN → UNKNOWN bleibt ohne Bremse (${u6.stand.qualitaet}, erlaubt ${w6.erlaubt})`, u6.stand.qualitaet === "UNKNOWN" && !u6.stand.rotGehaltenSeit && w6.erlaubt && !(await b.waBremseLage()).rotGehalten);
    // Ein ALTER Stand (vor der Regel gespeichert): „UNKNOWN", der Verlauf sagt ROT → UNKNOWN. Er gilt sofort als ROT …
    await setzen("wa_meta_stand", JSON.stringify({ qualitaet: "UNKNOWN", stufe: "TIER_2K", name: "FIAON Prüfstand", gesundheit: null, am: vor(60_000).toISOString(), quelle: "pruefstand",
      verlauf: [{ am: vor(120_000).toISOString(), von: "RED", zu: "UNKNOWN" }, { am: vor(600_000).toISOString(), von: null, zu: "RED" }] }));
    b.waBremseZwischenspeicherLeeren();
    const w7 = await b.waBremse({ vorlage: "fiaon_kk_anfrage" });
    const l7 = await b.waBremseLage();
    pruef("alter Stand „UNKNOWN“ nach ROT (Verlauf) gilt sofort als ROT — Werbung gesperrt, Anzeige „es gilt weiter ROT“",
      !w7.erlaubt && w7.qualitaet === "RED" && l7.rotGehalten && /es gilt weiter ROT/.test(String(l7.satz)), { w7, satz: l7.satz });
    // … und der nächste Takt berichtigt ihn auf ROT — ohne zweiten ROT-Alarm.
    const rotVor7 = await rotZahl();
    metaQualitaet = "UNKNOWN";
    const u7 = await b.metaStandAuffrischen("takt");
    pruef(`… der nächste Takt speichert ROT (${u7.stand.qualitaet}), kein Wechsel, kein Alarm`, u7.stand.qualitaet === "RED" && !u7.geaendert && (await rotZahl()) === rotVor7);
    // Rot-Probe der reinen Regel: ohne ROT im Verlauf bleibt UNKNOWN unbekannt.
    pruef("Rot-Probe: wirksameQualitaet(UNKNOWN, Verlauf GRÜN → UNKNOWN) = UNKNOWN, nicht ROT",
      b.wirksameQualitaet({ qualitaet: "UNKNOWN", verlauf: [{ am: "x", von: "GREEN", zu: "UNKNOWN" }] } as any).q === "UNKNOWN"
      && b.letzteBekannteQualitaet({ qualitaet: null, verlauf: [] }) === null);
    // Die Steuerpult-Routen geben den Merker mit (für die Anzeige im Chip-Aufklapper).
    const steuer = readFileSync(new URL("../server/routes/fiaon-mara-steuerpult.ts", import.meta.url), "utf8");
    pruef("Steuerpult-Routen geben rotGehalten und metaMeldet weiter (beide Stellen)", (steuer.match(/rotGehalten: lage\.rotGehalten, metaMeldet: lage\.metaMeldet/g) ?? []).length === 2);
  }
  await pause(null); await stand("GREEN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("10 Aktivieren: Probe ohne Nachricht, nur Inhaber");
  // ═════════════════════════════════════════════════════════════════════════
  const sendungenVorProbe = metaSendungen.length;
  await pause("zahlung", 131042); gesundheit = "BLOCKED";
  const x1 = await b.aktivieren(AKTEUR);
  pruef(`health_status BLOCKED → Pause bleibt („${String(x1.fehler).slice(0, 60)}…“), Verlauf „probe_gescheitert“`,
    !x1.ok && x1.zustand.an && x1.zustand.verlauf[0]?.was === "probe_gescheitert" && /Zahlungsmethode fehlt/.test(String(x1.fehler)));
  gesundheit = "AVAILABLE";
  const x2 = await b.aktivieren(AKTEUR);
  pruef("AVAILABLE → aktiv, ohne Hinweis", x2.ok && !x2.zustand.an && !x2.hinweis && x2.zustand.verlauf[0]?.was === "aktiviert");
  await pause("zahlung", 131042); gesundheit = "fehlt";
  const x3 = await b.aktivieren(AKTEUR);
  pruef(`Feld fehlt → aktiv mit Hinweis („${String(x3.hinweis).slice(0, 40)}…“)`, x3.ok && !x3.zustand.an && /^Probe unklar/.test(String(x3.hinweis)));
  await pause("zahlung", 131042); gesundheit = "LIMITED";
  const x4 = await b.aktivieren(AKTEUR);
  pruef("LIMITED → aktiv mit Warnung", x4.ok && !x4.zustand.an && /LIMITED/.test(String(x4.hinweis)));
  // Gegenprüfung 29.09.: Lehnt Meta den Token ab (#190), bleibt jede Pause; bei „zugang" nur mit echter Antwort aktiv.
  await pause("zahlung", 131042); gesundheit = "AVAILABLE"; tokenUngueltig = true;
  const x5 = await b.aktivieren(AKTEUR);
  pruef(`Meta lehnt den Token ab (#190) → Pause bleibt, auch bei „zahlung“ („${String(x5.fehler).slice(0, 50)}…“)`, !x5.ok && x5.zustand.an && /#190/.test(String(x5.fehler)));
  await pause("zugang", 190);
  const x6 = await b.aktivieren(AKTEUR);
  tokenUngueltig = false; metaStoerung = true;
  const x7 = await b.aktivieren(AKTEUR);
  metaStoerung = false;
  b.waBremseZwischenspeicherLeeren(); b.waPauseProduktionSimulieren(true);
  const x8 = await b.aktivieren(AKTEUR);
  await warte(300); // nach „zugang" stößt aktivieren Sammlung und Nachhol-Lauf im Hintergrund an
  pruef("Pause „zugang“: Token weiter abgelehnt → bleibt", !x6.ok && x6.zustand.an && /#190/.test(String(x6.fehler)));
  pruef(`… Meta antwortet nicht → bleibt („${String(x7.fehler).slice(0, 40)}…“)`, !x7.ok && x7.zustand.an && /nicht geantwortet/.test(String(x7.fehler)));
  pruef("… Meta nimmt den Token wieder an → aktiv", x8.ok && !x8.zustand.an, x8);
  gesundheit = "AVAILABLE";
  pruef("Die Probe schickt keine Nachricht", metaSendungen.length === sendungenVorProbe);
  const nicht = await b.aktivieren(AKTEUR);
  pruef("Nicht pausiert → nichts geändert", nicht.ok && /nicht pausiert/.test(String(nicht.hinweis)));
  // Routen
  await pause("zahlung", 131042);
  const lesen = await get("/chef/wa-pause", chefCookie("leitung"));
  pruef(`GET /chef/wa-pause (Leitung darf lesen): ${lesen.status}, pausiert ${lesen.j?.zustand?.an}`, lesen.status === 200 && lesen.j?.zustand?.an === true && Array.isArray(lesen.j?.kontofehler));
  const l403 = await post("/chef/wa-pause/aktivieren", {}, chefCookie("leitung"));
  pruef(`POST …/aktivieren als Leitung → ${l403.status}`, l403.status === 403 && (await b.waPauseLesen(true)).an);
  const ohneAnmeldung = await post("/chef/wa-pause/aktivieren", {}, "");
  pruef(`POST …/aktivieren ohne Anmeldung → ${ohneAnmeldung.status}`, ohneAnmeldung.status === 401);
  const inh = await post("/chef/wa-pause/aktivieren", {}, chefCookie("inhaber"));
  pruef(`POST …/aktivieren als Inhaber → ${inh.status}, aktiv`, inh.status === 200 && inh.j?.zustand?.an === false);
  const alarmeHandVor = (await alarme()).length;
  const hp = await post("/chef/wa-pause/pausieren", { grund: "Prüfstand E-261 von Hand" }, chefCookie("inhaber"));
  pruef(`POST …/pausieren als Inhaber → pausiert „${hp.j?.zustand?.art}“, keine Aufgabe (Justin weiß es)`, hp.status === 200 && hp.j?.zustand?.art === "hand" && (await alarme()).length === alarmeHandVor);
  const hpText = await b.waBremse({ text: true });
  pruef("… von Hand pausiert: Antworten im Fenster laufen weiter", hpText.erlaubt);
  const pr = await post("/chef/wa-meta-stand/pruefen", {}, chefCookie("leitung"));
  pruef(`POST …/wa-meta-stand/pruefen → ${pr.status}, Qualität ${pr.j?.stand?.qualitaet}, frisch ${pr.j?.frisch}`, pr.status === 200 && !!pr.j?.stand?.am && pr.j?.frisch === true);
  // Gegenprüfung 29.09.: Meta nicht erreichbar → nicht „frisch gelesen" melden.
  metaStoerung = true;
  const prAlt = await post("/chef/wa-meta-stand/pruefen", {}, chefCookie("leitung"));
  metaStoerung = false;
  pruef(`… Meta nicht erreichbar → frisch ${prAlt.j?.frisch}, der alte Stand kommt mit Zeit zurück`, prAlt.status === 200 && prAlt.j?.frisch === false && !!prAlt.j?.stand?.am);
  const karteQ = readFileSync(join(process.cwd(), "client/src/components/admin/ChefWaPause.tsx"), "utf8");
  pruef("… die Karte sagt dann „Meta nicht erreichbar — gezeigt wird der Stand von …“", /j\.frisch/.test(karteQ) && /Meta nicht erreichbar — gezeigt wird der Stand von/.test(karteQ));
  b.waBremseZwischenspeicherLeeren(); b.waPauseProduktionSimulieren(true);
  await pause(null);
  web.zu();

  // ═════════════════════════════════════════════════════════════════════════
  titel("11 Nachtrag-Lauf (scripts/wa-aktion-nachtrag.ts)");
  // ═════════════════════════════════════════════════════════════════════════
  const PN = 926250;
  await person(PN);
  const nach: [string, string | null, boolean, string | null][] = [
    ["wamid.PRUEF261.N1", "(#131026) Message undeliverable — Unable to deliver", true, null],
    ["wamid.PRUEF261.N2", "(#131050) Unable to deliver message — marketing messages stopped", true, null],
    ["wamid.PRUEF261.N3", "Message undeliverable", true, null],
    ["wamid.PRUEF261.N4", "(#131042) Business eligibility payment issue", false, "Fehler: (#131042) Business eligibility payment issue — von Meta nicht zugestellt (Status-Webhook); nachgetragen 29.09."],
  ];
  for (const [id, fehler, okAlt, grund] of nach) {
    await sqlPool`
      INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, fehler, von, gesendet_am, created_at)
      VALUES (${id}, 'raus', ${NR(PN)}, ${PN}, 'vorlage', 'Prüfstand', 'fiaon_kk_anfrage', 'fehler', ${fehler}, 'Mara', ${vor(2 * TAG)}, ${vor(2 * TAG)})`;
    await sqlPool`
      INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, wa_id, ok, grund, erstellt_am)
      VALUES (${PN}, 'neu', 'fiaon_kk_anfrage', 'automatik', 'A-PRUEF261-N', 'Automatik', ${id}, ${okAlt}, ${grund}, ${vor(2 * TAG)})`;
  }
  const erwartetSql = async () => {
    const [x] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE a.ok)::int AS a, COUNT(*) FILTER (WHERE NOT a.ok)::int AS b
        FROM fiaon_wa_aktion a JOIN fiaon_whatsapp w ON w.wa_id = a.wa_id
       WHERE a.wa_id IS NOT NULL AND w.status = 'fehler' AND (a.ok OR (a.fehler_code IS NULL AND w.fehler ~ '^\\(#[0-9]+\\)'))`) as any[];
    return { a: Number(x.a), b: Number(x.b) };
  };
  const erw = await erwartetSql();
  const ordner = "/private/tmp/claude-502/-Users-Justin-Desktop-FIAON/63033ccc-0f65-4f42-9ac7-2fa02a959313/scratchpad/e261/nachtrag";
  mkdirSync(ordner, { recursive: true });
  const lauf = (argumente: string[]) => execFileSync("npx", ["tsx", "scripts/wa-aktion-nachtrag.ts", ...argumente], {
    env: { PATH: process.env.PATH!, HOME: process.env.HOME!, DATABASE_URL: process.env.DATABASE_URL!, DOTENV_CONFIG_PATH: "/dev/null", NACHTRAG_ORDNER: ordner },
    encoding: "utf8", timeout: 120_000,
  });
  const zahl = (aus: string, teil: "A" | "B") => Number(new RegExp(`Teil ${teil} \\([^)]*\\):\\s+(\\d+)`).exec(aus)?.[1] ?? -1);
  const vorschau = lauf([]);
  const okVorher = (await sqlPool`SELECT COUNT(*) FILTER (WHERE ok)::int AS n FROM fiaon_wa_aktion WHERE person_id = ${PN}`) as any[];
  pruef(`Vorschau zählt Teil A ${zahl(vorschau, "A")} / Teil B ${zahl(vorschau, "B")} (SQL unabhängig: ${erw.a}/${erw.b}), schreibt nichts`,
    zahl(vorschau, "A") === erw.a && zahl(vorschau, "B") === erw.b && erw.a >= 3 && erw.b >= 1 && Number(okVorher[0].n) === 3 && /Nichts geschrieben/.test(vorschau), vorschau);
  pruef("… CSV in reports/ (hier: Prüfordner)", readdirSync(ordner).some((f) => /^wa-aktion-nachtrag-.*\.csv$/.test(f)));
  const schreib = lauf(["--schreiben"]);
  pruef(`--schreiben: „${/Geschrieben: [^\n]*/.exec(schreib)?.[0]}“`, new RegExp(`Teil A ${erw.a} Zeilen`).test(schreib) && new RegExp(`Teil B ${erw.b} Zeilen`).test(schreib), schreib);
  const nz = (await sqlPool`
    SELECT a.wa_id, a.ok, a.fehler_code, a.fehler_am, a.grund FROM fiaon_wa_aktion a WHERE a.person_id = ${PN} ORDER BY a.wa_id`) as any[];
  const nzId = (id: string) => nz.find((x) => x.wa_id === id);
  pruef("… 131026 → ok FALSE, fehler_code 131026, Grund „Fehler: (#131026) … (Status-Webhook); nachgetragen … (E-261)“",
    nzId("wamid.PRUEF261.N1")?.ok === false && Number(nzId("wamid.PRUEF261.N1")?.fehler_code) === 131026 && /^Fehler: \(#131026\).*Status-Webhook\); nachgetragen .*\(E-261\)$/.test(nzId("wamid.PRUEF261.N1")?.grund), nzId("wamid.PRUEF261.N1"));
  pruef("… Altzeile ohne Code → ok FALSE, fehler_code leer", nzId("wamid.PRUEF261.N3")?.ok === false && nzId("wamid.PRUEF261.N3")?.fehler_code === null && !!nzId("wamid.PRUEF261.N3")?.fehler_am);
  pruef("… Teil B (#131042 schon FALSE) → nur fehler_code, Grund unverändert",
    Number(nzId("wamid.PRUEF261.N4")?.fehler_code) === 131042 && String(nzId("wamid.PRUEF261.N4")?.grund).endsWith("nachgetragen 29.09."));
  const sicherung = readdirSync(ordner).filter((f) => /^wa-aktion-nachtrag-sicherung-.*\.json$/.test(f)).sort().at(-1);
  const sich = sicherung ? JSON.parse(readFileSync(join(ordner, sicherung), "utf8")) : [];
  pruef(`… Sicherung als JSON (${sich.length} Zeilen, Vorher-Stand)`, sich.length === erw.a + erw.b && sich.some((x: any) => x.ok === true));
  const zweiter = lauf([]);
  pruef(`Zweiter Lauf findet 0 (A ${zahl(zweiter, "A")} / B ${zahl(zweiter, "B")})`, zahl(zweiter, "A") === 0 && zahl(zweiter, "B") === 0);

  // ═════════════════════════════════════════════════════════════════════════
  titel("12 Quelltext-Wand");
  // ═════════════════════════════════════════════════════════════════════════
  const wurzel = process.cwd();
  const dateien: string[] = [];
  const sammeln = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) sammeln(p);
      else if (/\.tsx?$/.test(f)) dateien.push(p);
    }
  };
  sammeln(join(wurzel, "server")); sammeln(join(wurzel, "shared"));
  const rel = (p: string) => p.replace(`${wurzel}/`, "");
  const metaMessages = dateien.filter((f) => !f.endsWith("server/lib/fiaon-whatsapp.ts") && /graph\([^)]*\/messages|nummerId\}?\/messages/.test(readFileSync(f, "utf8")));
  pruef(`/messages an Meta nur in fiaon-whatsapp.ts${metaMessages.length ? `: ${metaMessages.map(rel).join(", ")}` : ""}`, metaMessages.length === 0);
  const rotEinzeln = dateien.filter((f) => !f.endsWith("server/lib/fiaon-wa-bremse.ts") && /qualitaet\s*===\s*["']RED["']|quality_rating\s*===\s*["']RED["']/.test(readFileSync(f, "utf8")));
  pruef(`Keine ROT-Einzelprüfung außerhalb fiaon-wa-bremse.ts${rotEinzeln.length ? `: ${rotEinzeln.map(rel).join(", ")}` : ""}`, rotEinzeln.length === 0);
  const AUFRUFER: Record<string, number> = {
    "server/lib/fiaon-wa-zentrale.ts": 1, "server/lib/fiaon-whatsapp-mara.ts": 1, "server/lib/fiaon-telefonkartei.ts": 1,
    "server/lib/fiaon-mara-auftrag.ts": 1, "server/lib/fiaon-lead-whatsapp.ts": 2, "server/routes/fiaon-vertrieb.ts": 1,
    "server/routes/fiaon-whatsapp-postfach.ts": 2,
    // E-IT-D (08.10.2026, Punkt 4c): „Unterlagen anfordern“ — Freitext nur im offenen 24-Stunden-Fenster, über waSenden (Bremse inklusive).
    "server/lib/fiaon-unterlagen-link.ts": 1,
  };
  const gefunden: Record<string, number> = {};
  for (const f of dateien) {
    if (f.endsWith("server/lib/fiaon-whatsapp.ts")) continue;
    // Nur Code zählt — Kommentare (z. B. „waSenden() — mit Wortwand …") nicht.
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const n = (code.match(/\bwaSenden\(/g) ?? []).length;
    if (n) gefunden[rel(f)] = n;
  }
  const unbekannt = Object.keys(gefunden).filter((f) => AUFRUFER[f] !== gefunden[f]);
  pruef(`Jeder waSenden-Aufrufer steht in der Liste (10 Aufrufe in 8 Dateien)${unbekannt.length ? ` — neu/anders: ${unbekannt.map((f) => `${f} (${gefunden[f]})`).join(", ")}` : ""}`,
    unbekannt.length === 0 && Object.keys(AUFRUFER).every((f) => gefunden[f] === AUFRUFER[f]), gefunden);
  const waQ = readFileSync(join(wurzel, "server/lib/fiaon-whatsapp.ts"), "utf8");
  const senden = waQ.slice(waQ.indexOf("export async function waSenden("), waQ.indexOf("// EMPFANGEN"));
  pruef("waSenden: die Bremse steht vor der ersten Meta-Anfrage (alleVorlagen, freigegebeneVorlagen, graph)",
    senden.indexOf("await waBremse(") > 0 && senden.indexOf("await waBremse(") < senden.indexOf("alleVorlagen()") && senden.indexOf("await waBremse(") < senden.indexOf("graph("));
  const platz = waQ.slice(waQ.indexOf("export async function waTagesplatz("), waQ.indexOf("// VORLAGEN"));
  pruef("waTagesplatz: die Bremse steht vor dem INSERT", platz.indexOf("await waBremse(") > 0 && platz.indexOf("await waBremse(") < platz.indexOf("INSERT INTO fiaon_wa_tagesplatz"));
  pruef("waEingang: failed zieht fiaon_wa_aktion nach und meldet der Bremse", /UPDATE fiaon_wa_aktion SET ok = FALSE, fehler_code/.test(waQ) && /kontofehlerMelden\(\{\s*code, quelle: "webhook"/.test(waQ));
  const routenQ = readFileSync(join(wurzel, "server/routes.ts"), "utf8");
  pruef("Takt wa_meta_stand ist angemeldet (nur Betrieb, tageslauf)", /tageslauf\('wa_meta_stand'/.test(routenQ));
  const mig = readdirSync(join(wurzel, "db/migrations"));
  pruef("Migration 086_wa_bremse.sql (und keine 085 von E-261)", mig.includes("086_wa_bremse.sql") && !mig.some((f) => /^085_.*wa/.test(f)));
  const migQ = readFileSync(join(wurzel, "db/migrations/086_wa_bremse.sql"), "utf8");
  pruef("… nur additiv (IF NOT EXISTS, kein DROP/TRUNCATE/DELETE)", /CREATE TABLE IF NOT EXISTS fiaon_wa_kontofehler/.test(migQ) && /ADD COLUMN IF NOT EXISTS fehler_code/.test(migQ) && !/\b(DROP|TRUNCATE|DELETE)\b/i.test(migQ));
  const steuer = readFileSync(join(wurzel, "server/routes/fiaon-mara-steuerpult.ts"), "utf8");
  const zQ = readFileSync(join(wurzel, "server/lib/fiaon-wa-zentrale.ts"), "utf8");
  pruef("GELB: Hand-Lauf höchstens der halbe freie Tagesraum (laufStarten: mitFaktor(raum.frei, bremse.faktor))", /mitFaktor\(raum\.frei, bremse\.faktor\)/.test(zQ));
  pruef("GELB: Automatik-Stundenmenge × Faktor (automatikTakt)", /const jeStunde = mitFaktor\(a\.jeStunde, pause\.faktor \|\| 1\)/.test(zQ));
  pruef("Aktivieren und Pausieren nur für Stufe Inhaber (wache)", /router\.post\("\/chef\/wa-pause\/aktivieren", wache/.test(steuer) && /router\.post\("\/chef\/wa-pause\/pausieren", wache/.test(steuer));
  const shell = readFileSync(join(wurzel, "client/src/components/admin/ChefShell.tsx"), "utf8");
  const mara = readFileSync(join(wurzel, "client/src/components/admin/ChefMara.tsx"), "utf8");
  pruef("Band auf jeder /chef-Seite, Chip „WhatsApp“ im Mara-Steuerpult (keine neue Seite)", /<WaPauseBand /.test(shell) && /<WaPauseKarte alsChip /.test(mara) && /<WaPauseKarte imAufklapper/.test(mara));
  const rg = readFileSync(join(wurzel, "client/src/pages/agent/rundgaenge.ts"), "utf8");
  pruef("Rundgang: Chip „WhatsApp“, Bremse in der Zentrale, Hinweis im Raum", /mara-p-wa/.test(rg) && /GELB halbiert, ROT stoppt Werbung/.test(rg) && /Steht oben „WhatsApp pausiert“/.test(rg));
  pruef("CHANGELOG und Team-Update tragen E-261", /E-261/.test(readFileSync(join(wurzel, "CHANGELOG.md"), "utf8")) && /2026-09-29-wa-bremse/.test(readFileSync(join(wurzel, "client/src/pages/agent/updates-data.ts"), "utf8")));
  const raumQ = readFileSync(join(wurzel, "client/src/components/whatsapp/WhatsAppRaum.tsx"), "utf8");
  pruef("WhatsApp-Raum liest …/bremse und zeigt den Hinweis (kein Knopf)", /\/bremse`/.test(raumQ) && /wr-bremse/.test(raumQ));
  // Gegenprüfung 29.09.
  pruef("Zentrale: Hand-Lauf, Lauf je Happen/Mensch und Automatik fragen gruppenBremse (die Gruppe, nicht den Vorlagennamen)",
    (zQ.match(/await gruppenBremse\(/g) ?? []).length >= 5 && /gruppenBremse\(opts\.gruppe, opts\.vorlage/.test(zQ) && /gruppenBremse\(g, vorlage, "zentrale_automatik"\)/.test(zQ));
  const zentraleClient = readFileSync(join(wurzel, "client/src/components/admin/ChefWhatsAppZentrale.tsx"), "utf8");
  pruef("Seite der Zentrale: ROT-Sperre und GELB-Grenze je Gruppe (g.bremse), keine Termin-Ausnahme mehr",
    !/SERVICE_VORLAGEN/.test(zentraleClient) && /g\?\.bremse && !g\.bremse\.erlaubt/.test(zentraleClient) && /gruppeFaktor/.test(zentraleClient));
  pruef("In der Pause: Statuszeile der Zentrale und Verkaufsleiste zeigen „Automatik an — pausiert“ (rot statt grün)",
    /Automatik an — pausiert/.test(zentraleClient) && /Automatik an — pausiert/.test(mara) && /ton="krit"/.test(mara));
  pruef("Rundgang der Zentrale (startet beim Öffnen) zeigt auf den Chip „WhatsApp“", (rg.match(/aria-controls=\\"mara-p-wa\\"/g) ?? []).length >= 2);
  const maraQ = readFileSync(join(wurzel, "server/lib/fiaon-whatsapp-mara.ts"), "utf8");
  const bremseQ = readFileSync(join(wurzel, "server/lib/fiaon-wa-bremse.ts"), "utf8");
  pruef("Kontosperre: Sammelaufgabe beim Aktivieren und 24 h lang im Nachhol-Takt (zuAltFuerMara, Quelle „wa“)",
    /zuAltFuerMara\(vorher\.seit, "wa"\)/.test(bremseQ) && /zuAltFuerMara\(wp\.seit, "wa"\)/.test(maraQ.slice(maraQ.indexOf("export async function nachholLauf("))));
  const nachtragQ = readFileSync(join(wurzel, "scripts/wa-aktion-nachtrag.ts"), "utf8");
  pruef("Nachtrag: --extern (DATABASE_URL_EXTERN) und Abbruch bei internem Render-Host", /--extern/.test(nachtragQ) && /DATABASE_URL_EXTERN/.test(nachtragQ) && /interner Render-Host/.test(nachtragQ));
  const intern = (() => {
    try {
      execFileSync("npx", ["tsx", "scripts/wa-aktion-nachtrag.ts"], {
        env: { PATH: process.env.PATH!, HOME: process.env.HOME!, DATABASE_URL: "postgresql://nutzer:geheim@dpg-pruef261-a/fiaon", DOTENV_CONFIG_PATH: "/dev/null" },
        encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, aus: "" };
    } catch (e: any) { return { code: Number(e?.status ?? -1), aus: `${e?.stdout ?? ""}${e?.stderr ?? ""}` }; }
  })();
  pruef(`… echter Aufruf mit internem Host bricht vor dem Verbinden ab (Exit ${intern.code}) und nennt den Aufruf mit --extern`,
    intern.code === 2 && /interner Render-Host/.test(intern.aus) && /--extern/.test(intern.aus) && !/ENOTFOUND/.test(intern.aus), intern.aus.slice(0, 300));

  // ═════════════════════════════════════════════════════════════════════════
  titel("14 Kontosperre: Nachrichten aus der Sperrzeit → EINE Sammelaufgabe");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const waMara = await import("../server/lib/fiaon-whatsapp-mara");
    const H = 3_600_000;
    const seit = vor(31 * H).toISOString();
    await setzen("wa_pause", JSON.stringify({
      an: false, art: "gesperrt", code: 131031, grund: b.waPauseMeldung({ art: "gesperrt", code: 131031 }), fehler: "Prüfstand E-261 Sperre", link: null,
      quelle: "webhook", seit, von: "automatisch", aufgehobenAm: vor(60_000).toISOString(), aufgehobenVon: AKTEUR, verlauf: [],
    }));
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'wa_pause_wa_gesammelt'`;
    b.waBremseZwischenspeicherLeeren(); b.waPauseProduktionSimulieren(true);
    const PS = [926260, 926261, 926262];
    const alter = [30 * H, 13 * H, 2 * H]; // 30 h: über 23,5 h (sieht der Nachhol-Takt nie) · 13 h: älter als 12 h · 2 h: Mara antwortet selbst
    for (const [i, id] of PS.entries()) {
      await person(id);
      await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at)
                    VALUES (${`wamid.PRUEF261.P${i}`}, 'rein', ${NR(id)}, ${id}, 'text', ${`Prüfstand E-261 Frage ${i}`}, 'empfangen', ${vor(alter[i])}, ${vor(alter[i])})`;
    }
    const aufgabenVor = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`wa-pause-wa-${seit}`}`) as any[])[0].n);
    const s1 = await waMara.zuAltFuerMara(seit, "wa");
    const [auf] = (await sqlPool`SELECT titel, text, quelle FROM fiaon_betreiber_todos WHERE schluessel = ${`wa-pause-wa-${seit}`} ORDER BY id DESC LIMIT 1`) as any[];
    const txt = String(auf?.text ?? "");
    pruef(`Sammelaufgabe „${auf?.titel}“ (${s1.anzahl} Nachrichten): 30 h und 13 h drin, 2 h nicht`,
      aufgabenVor === 0 && !!auf && auf.quelle === "wa-pause" && /Kontosperre/.test(String(auf.titel))
      && txt.includes(`…${NR(PS[0]).slice(-4)}`) && txt.includes(`…${NR(PS[1]).slice(-4)}`) && !txt.includes(`…${NR(PS[2]).slice(-4)}`), { s1, auf });
    const [p0] = (await sqlPool`SELECT id FROM fiaon_whatsapp WHERE wa_id = 'wamid.PRUEF261.P0'`) as any[];
    pruef("… die 30-h-Nachricht steht nachweislich in der Sammlung (Marke wa_pause_wa_gesammelt)", await waMara.inPauseSammlung(seit, Number(p0.id), "wa"));
    pruef("… und NICHT in der Sammlung der KI-Pause (eigene Marke)", !(await waMara.inPauseSammlung(seit, Number(p0.id), "ki")));
    const s2 = await waMara.zuAltFuerMara(seit, "wa");
    const aufgabenNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`wa-pause-wa-${seit}`}`) as any[])[0].n);
    pruef(`Zweiter Lauf: nichts doppelt (${s2.anzahl} neu, ${aufgabenNach} Aufgabe)`, s2.anzahl === 0 && aufgabenNach === 1);
    await pause(null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  if (process.env.WA_BREMSE_BUILD) {
    titel("13 Browser: Chip „WhatsApp“, Aktivieren, rotes Band, 380 px");
    await browserTeil(process.env.WA_BREMSE_BUILD);
  } else {
    console.log("\n── 13 Browser: übersprungen (WA_BREMSE_BUILD=<vite-Ausgabe> setzen) ──");
  }
} catch (e) {
  fehl++;
  console.error("\nAbbruch:", e);
} finally {
  b.waPauseProduktionSimulieren(null);
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  await wiederherstellen();
  const [rest] = (await sqlPool`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${IDS}))::int AS p, (SELECT COUNT(*) FROM fiaon_whatsapp WHERE nummer LIKE '49159009926%')::int AS w,
                                        (SELECT COUNT(*) FROM fiaon_wa_kontofehler WHERE nummer LIKE '49159009926%')::int AS k`.catch(() => [{}])) as any[];
  console.log(`\nAufgeräumt: ${rest?.p ?? "?"} Personen, ${rest?.w ?? "?"} WhatsApp, ${rest?.k ?? "?"} Kontofehler übrig; Einstellungen wiederhergestellt.`);
  console.log(`Netz: ${metaAnfragen.length} Anfragen an die Meta-Attrappe, ${metaSendungen.length} Sendungen (${vorlagenBeiMeta().length} Vorlagen) — nichts ging ins echte Netz.`);
  console.log(`E-261 WhatsApp-Bremse: ${ok} bestanden, ${fehl} nicht.`);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(fehl ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// 13 BROWSER — die fertige Oberfläche (vite build) mit gestellten Antworten
// (page.route). Kein Server, keine Datenbank, keine echte Handlung.
// ═════════════════════════════════════════════════════════════════════════════
async function browserTeil(build: string): Promise<void> {
  if (!existsSync(join(build, "index.html"))) { pruef(`Build unter ${build} vorhanden`, false); return; }
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/Users/Justin/Developer/fiaon-plattform/.playwright";
  const { chromium } = await import("playwright");
  const bilder = "/private/tmp/claude-502/-Users-Justin-Desktop-FIAON/63033ccc-0f65-4f42-9ac7-2fa02a959313/scratchpad/e261/bilder";
  mkdirSync(bilder, { recursive: true });
  let pausiert = true;
  let aktivierenGedrueckt = 0;
  const zustand = () => ({
    an: pausiert, art: pausiert ? "zahlung" : null, code: pausiert ? 131042 : null,
    grund: pausiert ? "WhatsApp pausiert (#131042) — Meta kann nicht abbuchen. Keine Vorlage geht raus; Antworten im offenen 24-Stunden-Fenster schon." : null,
    fehler: "(#131042) Business eligibility payment issue", link: null, quelle: "webhook",
    seit: new Date(Date.now() - 3_600_000).toISOString(), von: "automatisch", aufgehobenAm: pausiert ? null : new Date().toISOString(), aufgehobenVon: pausiert ? null : "Inhaber",
    verlauf: [{ am: new Date(Date.now() - 3_600_000).toISOString(), was: "pausiert", von: "automatisch", grund: "WhatsApp pausiert (#131042)" }],
  });
  const typen: Record<string, string> = { js: "text/javascript", css: "text/css", html: "text/html", svg: "image/svg+xml", png: "image/png", woff2: "font/woff2", json: "application/json", webp: "image/webp", jpg: "image/jpeg", ico: "image/x-icon" };
  const browser = await chromium.launch();
  const fehlerSeite: string[] = [];
  const oeffnen = async (breite: number, pfad: string) => {
    const kontext = await browser.newContext({ viewport: { width: breite, height: 900 } });
    // Die Rundgänge gelten als gesehen — sonst legt sich der erste Rundgang über die Knöpfe.
    await kontext.addInitScript(() => {
      for (const r of ["wa-zentrale", "mara", "whatsapp", "mail-aktion", "auskunft", "termine"]) {
        try { localStorage.setItem(`fiaon_rundgang_${r}`, "ja"); } catch { /* privates Fenster */ }
      }
    });
    const seite = await kontext.newPage();
    seite.on("pageerror", (e) => fehlerSeite.push(String(e).slice(0, 160)));
    await seite.route("http://pruef.invalid/**", async (route) => {
      const url = new URL(route.request().url());
      const p = url.pathname;
      const antwort = (x: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(x) });
      if (p.startsWith("/api/")) {
        if (p === "/api/fiaon/chef/status") return antwort({ ok: true, angemeldet: true, stufe: "inhaber", agentId: 1, name: "Prüfstand", titel: null, quelle: "chef" });
        if (p === "/api/fiaon/chef/wa-pause") {
          return antwort({ ok: true, zustand: zustand(), stand: { qualitaet: "GREEN", stufe: "TIER_2K", name: "FIAON", am: new Date().toISOString(), quelle: "takt", gesundheit: { kann: "AVAILABLE", text: null }, verlauf: [] },
            bremse: { qualitaet: "GREEN", faktor: pausiert ? 0 : 1, satz: pausiert ? zustand().grund : null, werbungGestoppt: pausiert, allesGestoppt: false },
            kontofehler: [{ code: 131042, art: "zahlung", satz: "Meta kann nicht abbuchen (Zahlungsproblem im WhatsApp-Konto)", anzahl: 2, zuletzt: new Date().toISOString() }] });
        }
        if (p === "/api/fiaon/chef/wa-pause/aktivieren") { aktivierenGedrueckt++; pausiert = false; return antwort({ ok: true, zustand: zustand(), hinweis: null }); }
        if (p === "/api/fiaon/agent/rundgaenge") return antwort({ ok: true, gesehen: ["wa-zentrale", "mara", "whatsapp", "mail-aktion", "auskunft", "termine"] });
        if (p === "/api/fiaon/chef/ki-pause") return antwort({ ok: true, zustand: { an: false, art: null, grund: null, fehler: null, dienst: null, seit: null, von: null, aufgehobenAm: null, aufgehobenVon: null, verlauf: [] }, liegen: null });
        return antwort({ ok: false, error: "Prüfstand: keine Daten" }, 200);
      }
      // Die fertige Oberfläche: Dateien aus dem Build, sonst index.html (Einzelseiten-App).
      const datei = join(build, p === "/" ? "index.html" : p);
      if (p !== "/" && existsSync(datei) && statSync(datei).isFile()) {
        return route.fulfill({ status: 200, contentType: typen[p.split(".").pop() ?? ""] ?? "application/octet-stream", body: readFileSync(datei) });
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: readFileSync(join(build, "index.html")) });
    });
    await seite.goto(`http://pruef.invalid${pfad}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    return { kontext, seite };
  };
  try {
    // Breit: Band auf einer anderen /chef-Seite
    const a = await oeffnen(1360, "/chef/register");
    const band = a.seite.locator(".wap-band");
    const bandDa = await band.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    pruef("Rotes Band „WhatsApp pausiert“ auf einer anderen /chef-Seite (/chef/register)", bandDa && /WhatsApp pausiert seit/.test(await band.innerText().catch(() => "")));
    await a.seite.screenshot({ path: join(bilder, "e261-band-register.png"), fullPage: false });
    await a.kontext.close();
    // Mara-Steuerpult: Chip → Aufklapper → aktivieren
    const m = await oeffnen(1360, "/chef/s/mara");
    const chip = m.seite.getByRole("button", { name: /^WhatsApp pausiert$/ });
    const chipDa = await chip.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    pruef("Chip „WhatsApp pausiert“ im Kopf des Mara-Steuerpults", chipDa);
    await chip.click();
    const karte = m.seite.locator("#mara-p-wa");
    await karte.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    pruef("Aufklapper zeigt Zustand, Meta-Qualität und Fehler von Meta", /WhatsApp pausiert seit/.test(await karte.innerText().catch(() => "")) && /Meta-Qualität/.test(await karte.innerText().catch(() => "")));
    await m.seite.screenshot({ path: join(bilder, "e261-mara-chip-pausiert.png"), fullPage: false });
    const knopf = karte.getByRole("button", { name: /WhatsApp wieder aktivieren/i });
    pruef("Knopf „WhatsApp wieder aktivieren“ im Aufklapper gefunden", await knopf.isVisible().catch(() => false));
    await knopf.click();
    await karte.getByRole("button", { name: /Ja, aktivieren/i }).click();
    const aktiv = await m.seite.getByRole("button", { name: /^WhatsApp aktiv$/ }).waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
    pruef(`Gedrückt (${aktivierenGedrueckt}×) → Chip „WhatsApp aktiv“`, aktivierenGedrueckt === 1 && aktiv);
    await m.seite.screenshot({ path: join(bilder, "e261-mara-chip-aktiv.png"), fullPage: false });
    await m.kontext.close();
    // 380 px
    pausiert = true;
    const h = await oeffnen(380, "/chef/s/mara");
    const chipH = h.seite.getByRole("button", { name: /^WhatsApp pausiert$/ });
    const chipHDa = await chipH.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    const breit = await h.seite.evaluate(() => document.documentElement.scrollWidth);
    pruef(`380 px: Chip sichtbar, keine waagerechte Rolle (Seitenbreite ${breit})`, chipHDa && breit <= 382);
    if (chipHDa) { await chipH.click(); await h.seite.locator("#mara-p-wa").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {}); }
    await h.seite.screenshot({ path: join(bilder, "e261-mara-380.png"), fullPage: true });
    await h.kontext.close();
    pruef(`Keine Seitenfehler im Browser${fehlerSeite.length ? `: ${fehlerSeite.slice(0, 3).join(" | ")}` : ""}`, fehlerSeite.length === 0);
    console.log(`    Bilder: ${bilder}`);
  } finally {
    await browser.close();
  }
}
