// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-401 (6/6, 19.10.2026), DATENBANK: Entwürfe bleiben nicht liegen — die 24-Stunden-Regel
//
// Erfundene Testkunden (Marke F401) gegen eine LOKALE Prüfdatenbank. Gmail und das Modell sind Attrappen
// (fetch abgefangen), alles andere Netz ist gesperrt. Gefahren wird der ECHTE Code: fristZeilenLaden,
// entwurfFristLauf, entwurfAblegen, entwurfNeuSchreiben → mailBearbeiten (Einordnung, Antwort, Wand,
// E-248, E-393, Versand oder Entwurf), uebergabeSchliessen, Probelauf und Entscheidungskarte.
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e401f
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e401f?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-entwurf-frist-db.ts
// Eigene Datensätze (Personen PR-F401-…, Bestellungen FIAON-F401…, Mails f401-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "META_CAPI_TOKEN", "WHATSAPP_TOKEN"]) delete process.env[k];

// ── Attrappen VOR jedem Import: Modell und Gmail antworten hier, sonst kein Netz ──
import { generateKeyPairSync } from "node:crypto";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-f401";
process.env.KI_ANBIETER = "openai";
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@f401.invalid", private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.pruef.invalid/token",
});
interface Szenario { einordnung: Record<string, unknown>; antwort: Record<string, unknown>; umformuliert?: Record<string, unknown> }
let SZ: Szenario | null = null;
const KI: { art: string }[] = [];
const GMAIL_SENDEN: string[] = [];
const GMAIL_ENTWURF: string[] = [];
const GMAIL_LOESCHEN: string[] = [];
const GMAIL_ORDNER: string[] = [];
const NACHRICHTEN = new Map<string, { thread: string; am: number; von: string; betreff: string; text: string }>();
const jsonAntwort = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const modellText = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
let fremd = 0;
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    KI.push({ art: einordnen ? "einordnen" : "antwort" });
    if (!SZ) return jsonAntwort(500, { error: { message: "Prüfstand: kein Szenario" } });
    let aus: any;
    if (einordnen) aus = modellText(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = modellText(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else aus = modellText("fertig");
    return jsonAntwort(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return jsonAntwort(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send/.test(u)) { GMAIL_SENDEN.push(String(init?.body ?? "")); return jsonAntwort(200, { id: `gesendet-${GMAIL_SENDEN.length}`, threadId: "t" }); }
    const d = u.match(/\/drafts\/([^/?]+)/);
    if (d && methode === "DELETE") { GMAIL_LOESCHEN.push(d[1]); return new Response(null, { status: 204 }); }
    if (/\/drafts/.test(u)) { GMAIL_ENTWURF.push(String(init?.body ?? "")); return jsonAntwort(200, { id: `entwurf-neu-${GMAIL_ENTWURF.length}`, message: { id: "x" } }); }
    if (/\/messages\?/.test(u)) return jsonAntwort(200, { messages: [], resultSizeEstimate: 0 });
    const mod = u.match(/\/messages\/([^/?]+)\/modify/);
    if (mod) { GMAIL_ORDNER.push(mod[1]); return jsonAntwort(200, { id: mod[1] }); }
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return jsonAntwort(404, { error: { message: "Not Found" } });
      return jsonAntwort(200, {
        id: m[1], threadId: n.thread, labelIds: ["INBOX"], internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: { mimeType: "text/plain", headers: [
          { name: "From", value: n.von }, { name: "To", value: "support@fiaon.com" },
          { name: "Subject", value: n.betreff }, { name: "Date", value: new Date(n.am).toUTCString() },
          { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text).toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return jsonAntwort(200, methode === "POST" ? { id: `L-${Date.now()}` } : { labels: [] });
    return jsonAntwort(200, {});
  }
  fremd++;
  return new Response(`blockiert: ${u.split("?")[0]}`, { status: 599 });
}) as any;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 700)}` : ""}`); }
}

const H = 3_600_000;
const M = "F401";

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
  const lauf = await import("../server/lib/fiaon-postmeister-lauf");
  const F = await import("../server/lib/fiaon-postmeister-frist");
  const R = await import("../shared/fiaon-entwurf-frist");
  const N = await import("../shared/fiaon-nicht-erreicht-nachfass");
  const PE = await import("../server/lib/fiaon-postmeister-entscheidungen");
  const ME = await import("../server/lib/fiaon-mara-entscheidungen");
  await postmeisterSchema();

  const EIN = ["ki_pause", "postmeister_an", "postmeister_v2", "postmeister_modus_support", "postmeister_modus_welcome", R.ALTBESTAND_SCHALTER];
  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`) as any[];
  const setzen = async (k: string, v: string | null) => {
    await sql`DELETE FROM fiaon_settings WHERE key = ${k}`;
    if (v != null) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${k}, ${v})`;
  };
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
  await setzen("postmeister_an", "an");
  await setzen("postmeister_modus_support", "auto");
  (kp as any).kiPauseZwischenspeicherLeeren?.();

  async function aufraeumen() {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PR-${M}-%`}`) as any[]).map((r) => Number(r.id));
    const refs = ((await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`) as any[]).map((r) => r.ref);
    await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE ${`f401-%`}`.catch(() => {});
    if (refs.length) {
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`.catch(() => {});
    }
    if (personen.length) {
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen}))`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${personen})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel = ${PE.ALTBESTAND_KARTE}`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`.catch(() => {});
    if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch(() => {});
  }
  await aufraeumen();

  // ── Testkunden (erfunden) ───────────────────────────────────────────────
  type Kunde = { pid: number; ref: string; mail: string; von: string };
  async function kunde(x: string, o: { bezahlt?: boolean; test?: boolean; blockiert?: boolean } = {}): Promise<Kunde> {
    const mail = `kunde-${x.toLowerCase()}@f401.invalid`;
    const ref = `FIAON-${M}${x}`;
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, ist_test_am, is_blocked)
      VALUES (${`PR-${M}-${x}`}, 'Tessa', ${`Fristprobe${x}`}, ${mail}, ${o.test ? new Date() : null}, ${!!o.blockiert}) RETURNING id`) as any[];
    const bezahlt = o.bezahlt !== false;
    await sql`
      INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, email, first_name, last_name,
                                      person_id, created_at, completed_at, paid_at, current_step, submitted_at, agb_stand, freigeschaltet_am)
      VALUES (${ref}, ${`${M}${x}`.slice(0, 30)}, ${bezahlt ? "paid" : "pending_payment"}, ${bezahlt ? "payment_completed" : "payment_pending"}, 'private',
              'pro', 'FIAON Pro (Standard)', 59.99, ${mail}, 'Tessa', ${`Fristprobe${x}`}, ${p.id}, NOW() - INTERVAL '60 days',
              ${bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, ${bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, 8, NOW() - INTERVAL '60 days', '2026-10-05',
              ${bezahlt ? new Date(Date.now() - 39 * 86_400_000) : null})`;
    return { pid: Number(p.id), ref, mail, von: `Tessa Fristprobe${x} <${mail}>` };
  }

  let nr = 0;
  /** Eine Kundenmail, deren Antwort als Entwurf wartet. neu = Merker frist_ab (entstanden ab dem Einbau). */
  async function entwurf(k: Kunde | null, o: {
    neu: boolean; entwurfStd?: number; mailStd?: number; betreff?: string; text?: string;
    kategorien?: string[]; flags?: Record<string, boolean>; begruendung?: string; antwort?: string; von?: string;
  }): Promise<{ id: number; gmail: string; draft: string }> {
    nr++;
    const gmail = `f401-${nr}`;
    const mailAm = new Date(Date.now() - (o.mailStd ?? (o.entwurfStd ?? 26) + 0.2) * H);
    const entwurfAm = new Date(Date.now() - (o.entwurfStd ?? 26) * H);
    const von = o.von ?? k?.von ?? "Unbekannt <niemand@f401.invalid>";
    const text = o.text ?? `Guten Tag, wie ist der Stand bei mir? (Probe ${nr})`;
    const betreff = o.betreff ?? `Frage ${nr}`;
    NACHRICHTEN.set(gmail, { thread: `f401-t${nr}`, am: mailAm.getTime(), von, betreff, text });
    const draft = `entwurf-alt-${nr}`;
    const [z] = (await sql`
      INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, von, betreff, empfangen_am, text, aktion, person_id, ref,
                                     kategorie, kategorien, flags, begruendung, antwort, antwort_draft_id, entwurf_geprueft_am,
                                     created_at, updated_at, frist_ab, versuche, kundenlage, zusammenfassung)
      VALUES ('support@fiaon.com', ${gmail}, ${`f401-t${nr}`}, ${von}, ${betreff}, ${mailAm}, ${text}, 'entwurf', ${k?.pid ?? null}, ${k?.ref ?? null},
              ${(o.kategorien ?? ["status_frage"])[0]}, ${o.kategorien ?? ["status_frage"]}, ${sql.json((o.flags ?? {}) as any)},
              ${o.begruendung ?? "sauber, aber Entwurf (Lage oder Flag)"}, ${o.antwort ?? "Vielen Dank für Ihre Nachricht. (alter Entwurf)"}, ${draft}, ${entwurfAm},
              ${mailAm}, ${entwurfAm}, ${o.neu ? mailAm : null}, 1, 'aktiv', 'Kunde fragt nach dem Stand.')
      RETURNING id`) as any[];
    return { id: Number(z.id), gmail, draft };
  }
  /** Eine spätere Mail desselben Kunden (schon beantwortet). */
  async function spaetereMail(k: Kunde, nachStd: number, basisStd = 26, o: { begruendung?: string; aktion?: string } = {}): Promise<number> {
    nr++;
    const am = new Date(Date.now() - (basisStd + 0.2 - nachStd) * H);
    const [z] = (await sql`
      INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, von, betreff, empfangen_am, text, aktion, person_id, ref, begruendung, created_at)
      VALUES ('support@fiaon.com', ${`f401-${nr}`}, ${`f401-t${nr}`}, ${k.von}, 'Nachtrag', ${am}, 'Hallo, ich habe noch eine Frage.', ${o.aktion ?? "auto_beantwortet"},
              ${k.pid}, ${k.ref}, ${o.begruendung ?? null}, ${am}) RETURNING id`) as any[];
    return Number(z.id);
  }
  const zeile = async (id: number) => ((await sql`SELECT * FROM fiaon_postmeister WHERE id = ${id}`) as any[])[0];
  const lies = (w: unknown) => { let v: any = w; for (let i = 0; i < 3 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return null; } } return v; };

  // Ein Zeitpunkt sicher im Versandfenster (08–20 Uhr Berlin): jetzt, sonst das nächste 08:00 + 5 Min.
  const imFenster = () => {
    const n = new Date();
    return N.imVersandfenster(n) && N.imVersandfenster(new Date(n.getTime() + 10 * 60_000)) ? n : new Date(N.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };
  // Heute 22:00 Berlin (außerhalb des Fensters) — sommer-/winterzeitfest über die Stunde um 12:00 UTC.
  const heute22 = () => {
    const tag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    const h12 = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(new Date(`${tag}T12:00:00Z`)));
    return new Date(Date.parse(`${tag}T22:00:00Z`) - (h12 - 12) * H);
  };
  const lauf1 = async (ids: number[], sz: Szenario | null, jetzt: Date = imFenster()) => {
    SZ = sz;
    F.fristAbstandZuruecksetzen();
    const vorKi = KI.length, vorS = GMAIL_SENDEN.length, vorE = GMAIL_ENTWURF.length, vorL = GMAIL_LOESCHEN.length;
    const e = await F.entwurfFristLauf({ immer: true, ids, jetzt });
    return { e, ki: KI.length - vorKi, gesendet: GMAIL_SENDEN.length - vorS, entwuerfe: GMAIL_ENTWURF.length - vorE, geloescht: GMAIL_LOESCHEN.slice(vorL) };
  };
  const urteil = async (id: number, jetzt: Date = imFenster(), altbestandAblegen = false) => {
    const [z] = await F.fristZeilenLaden({ ids: [id] });
    return z ? R.fristUrteil(z.fakten, { modus: "auto", kiPausiert: false, altbestandAblegen, sperre: null }, jetzt) : null;
  };

  // Szenarien des Modells
  const EIN_SAUBER = { kategorien: ["status_frage"], flags: {}, dringend: false, sprache: "de", fragen: ["Wie ist der Stand?"], zusammenfassung: "Kunde fragt nach dem Stand seines Vorgangs." };
  const schritt = { art: "erledigt", url: null, text: "" };
  const SAUBER: Szenario = {
    einordnung: EIN_SAUBER,
    antwort: { antwort: "Ihr Vorgang ist vollständig, es fehlt nichts von Ihrer Seite. Melden Sie sich gern, wenn Sie Fragen haben.", naechster_schritt: schritt, belege: [], fragen_beantwortet: ["Wie ist der Stand?"], merken: [] },
  };
  const KOPPLUNG = "Ihre Kündigung haben wir erhalten. Sobald die offene Rate bezahlt ist, ist Ihr Vertrag beendet.";
  const E393: Szenario = {
    einordnung: { kategorien: ["kuendigung"], flags: { kuendigung: true }, dringend: false, sprache: "de", fragen: ["Wann endet mein Vertrag?"], zusammenfassung: "Kunde fragt, wann sein Vertrag endet." },
    antwort: { antwort: KOPPLUNG, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
    umformuliert: { antwort: KOPPLUNG, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
  };

  try {
    console.log("── 0 · Schema und Merker: nur NEU angelegte Zeilen tragen frist_ab");
    {
      const spalten = ((await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_postmeister' AND column_name IN ('frist_ab', 'frist_neu_am')`) as any[]).map((r) => r.column_name).sort();
      ok(spalten.join() === "frist_ab,frist_neu_am", "Spalten frist_ab + frist_neu_am angelegt", spalten);
      const K0 = await kunde("Z0");
      nr++;
      NACHRICHTEN.set(`f401-${nr}`, { thread: `f401-t${nr}`, am: Date.now() - 30 * 60_000, von: K0.von, betreff: "Frage", text: "Guten Tag, wie ist der Stand?" });
      SZ = SAUBER;
      await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: `f401-${nr}`, gruss: "Freundliche Grüße\nIhr FIAON-Support", modus: "entwurf" });
      const z0 = ((await sql`SELECT frist_ab, aktion FROM fiaon_postmeister WHERE gmail_id = ${`f401-${nr}`}`) as any[])[0];
      ok(z0?.frist_ab != null, `neue Mail über mailBearbeiten → Merker frist_ab gesetzt (${z0?.aktion})`, z0);
      // Altbestand: eine schon vorhandene Zeile (vorgeordnet, ohne Merker) bleibt ohne Merker, auch wenn sie jetzt bearbeitet wird.
      nr++;
      const altId = `f401-${nr}`;
      NACHRICHTEN.set(altId, { thread: `f401-t${nr}`, am: Date.now() - 30 * 60_000, von: K0.von, betreff: "Frage alt", text: "Hallo, noch eine Frage zum Stand bitte." });
      await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, versuche) VALUES ('support@fiaon.com', ${altId}, '', 'vorgeordnet', 0)`;
      await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId: altId, gruss: "Freundliche Grüße\nIhr FIAON-Support", modus: "entwurf" });
      const za = ((await sql`SELECT frist_ab, aktion FROM fiaon_postmeister WHERE gmail_id = ${altId}`) as any[])[0];
      ok(za && za.frist_ab == null, `vorhandene Zeile (Altbestand) bleibt ohne Merker (${za?.aktion})`, za);
    }

    console.log("── 1 · NEU, > 24 h, der Kunde hat danach geschrieben → abgelegt (keine Mail, kein Modell), Übergabe schließt");
    {
      const A = await kunde("A");
      const a = await entwurf(A, { neu: true });
      const spaeter = await spaetereMail(A, 3);
      // Die Übergabe „Kunde hat geschrieben — bitte antworten“ zu dieser Mail (nur Antwort nötig).
      await lauf.anBetreuerUebergeben({ id: a.id, personId: A.pid, ref: A.ref, postfach: "support@fiaon.com", betreff: "Frage", zusammenfassung: "Kunde fragt nach dem Stand.", grund: lauf.UEBERGABE_GRUND.zentrale, dringend: false });
      const todoVor = ((await sql`SELECT id, status FROM fiaon_betreiber_todos WHERE schluessel = ${`postmeister:antwort:${A.pid}`}`.catch(() => [])) as any[])[0];
      const r = await lauf1([a.id], null);
      const z = await zeile(a.id);
      ok(z.aktion === "geordnet" && String(z.begruendung).startsWith(R.ABLAGE_KOPF), "Zeile „geordnet“ mit Grund „Nicht mehr nötig (24-Stunden-Regel)“", { aktion: z.aktion, b: z.begruendung });
      ok(String(z.begruendung).includes(`Mail #${spaeter}`), "Grund nennt die spätere Mail", z.begruendung);
      ok(r.e.abgelegt === 1 && r.ki === 0 && r.gesendet === 0, "kein Modellaufruf, nichts gesendet", { e: r.e, ki: r.ki, gesendet: r.gesendet });
      ok(r.geloescht.includes(a.draft), "alter Gmail-Entwurf gelöscht", r.geloescht);
      ok(GMAIL_ORDNER.includes(a.gmail), "Gmail-Ordner umgehängt (Nicht mehr nötig)");
      const v = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${A.ref} AND note LIKE ${`Mara: Antwort-Entwurf zu Mail #${a.id}%`}`) as any[];
      ok(v.length === 1, "genau ein Vermerk in der Akte", v.map((x) => x.note));
      if (todoVor) {
        const t = ((await sql`SELECT status, ergebnis FROM fiaon_betreiber_todos WHERE id = ${todoVor.id}`) as any[])[0];
        ok(t?.status === "erledigt" && /Nicht mehr nötig/.test(String(t?.ergebnis)), "Übergabe „Kunde hat geschrieben“ ist erledigt", t);
      } else ok(false, "Übergabe-Aufgabe ließ sich nicht anlegen (fiaon_betreiber_todos?)");
      const r2 = await lauf1([a.id], null);
      ok(r2.e.geprueft === 0 && r2.e.abgelegt === 0, "zweiter Lauf: nichts mehr zu tun", r2.e);
      // Ein Doppel derselben Mail ist KEIN neues Schreiben.
      const A2 = await kunde("A2");
      const a2 = await entwurf(A2, { neu: true });
      await spaetereMail(A2, 1, 26, { aktion: "geordnet", begruendung: `Doppel von Mail #${a2.id} — derselbe Text noch einmal geschickt; nur eine Antwort (E-248)` });
      const u2 = await urteil(a2.id);
      ok(u2?.art === "neu_schreiben", "Doppel derselben Mail zählt nicht als „Kunde schrieb danach“", u2);
    }

    console.log("── 2 · NEU, > 24 h, Regeln erlauben es → einmal neu geschrieben und GESENDET (Attrappe)");
    {
      const C = await kunde("C");
      const c = await entwurf(C, { neu: true });
      const r = await lauf1([c.id], SAUBER);
      const z = await zeile(c.id);
      if (z.aktion !== "auto_beantwortet") console.log("     (Weg:", z.aktion, "—", String(z.begruendung).slice(0, 200), JSON.stringify(lies(z.pruefung))?.slice(0, 300), ")");
      ok(z.aktion === "auto_beantwortet" && z.gesendet_am != null && r.gesendet === 1, "neu geschrieben und gesendet", { aktion: z.aktion, gesendet: r.gesendet, e: r.e });
      ok(z.frist_neu_am != null && r.e.neuGeschrieben === 1 && r.e.gesendet === 1, "Merker frist_neu_am gesetzt, Lauf zählt 1 neu / 1 gesendet", r.e);
      ok(r.ki >= 1, "das Modell schrieb mit heutigem Stand", r.ki);
      ok(r.geloescht.includes(c.draft) && r.entwuerfe === 0, "alter Gmail-Entwurf gelöscht, kein neuer", { g: r.geloescht, e: r.entwuerfe });
      ok(/Ihr Vorgang ist vollständig/.test(String(z.antwort)), "gesendet wurde die NEUE Antwort", String(z.antwort).slice(0, 120));
      const r2 = await lauf1([c.id], SAUBER);
      ok(r2.ki === 0 && r2.gesendet === 0, "nie ein zweites Mal", r2);
    }

    console.log("── 3 · NEU, > 24 h, E-393-Sendesperre greift → nicht gesendet, genau EIN Entwurf");
    {
      const S = await kunde("S");
      await sql`UPDATE fiaon_applications SET gekuendigt_am = NOW() - INTERVAL '40 days', letzte_rate_nr = 3 WHERE ref = ${S.ref}`;
      const s = await entwurf(S, { neu: true, kategorien: ["kuendigung"], flags: { kuendigung: true }, text: "Wann endet mein Vertrag?" });
      const r = await lauf1([s.id], E393);
      const z = await zeile(s.id);
      const zeilen = Number(((await sql`SELECT COUNT(*)::int n FROM fiaon_postmeister WHERE person_id = ${S.pid} AND aktion = 'entwurf'`) as any[])[0].n);
      ok(r.gesendet === 0 && z.gesendet_am == null, "nichts gesendet", { gesendet: r.gesendet, aktion: z.aktion });
      ok(z.aktion === "entwurf" && zeilen === 1 && r.entwuerfe === 1, "genau EIN Entwurf (eine Zeile, ein neuer Gmail-Entwurf)", { aktion: z.aktion, zeilen, entwuerfe: r.entwuerfe });
      ok(r.geloescht.includes(s.draft) && z.antwort_draft_id !== s.draft, "alter Gmail-Entwurf durch den neuen ersetzt", { g: r.geloescht, neu: z.antwort_draft_id });
      ok(!/Sobald die offene Rate bezahlt ist, ist Ihr Vertrag beendet/.test(String(z.antwort)), "die Kopplung steht nicht im Entwurf (ersetzt)", String(z.antwort).slice(0, 200));
      ok(z.frist_neu_am != null, "Merker frist_neu_am gesetzt");
      const r2 = await lauf1([s.id], E393, new Date(imFenster().getTime() + 30 * H));
      ok(r2.ki === 0 && r2.gesendet === 0 && (await zeile(s.id)).aktion === "entwurf", "einen Tag später: bleibt (schon einmal neu geschrieben), kein Modell", r2.e);
      const u = await urteil(s.id, new Date(Date.now() + 30 * H));
      ok(u?.art === "bleibt" && /schon einmal neu geschrieben/.test(u.grund), "Urteil: bleibt", u);
    }

    console.log("── 4 · ALTBESTAND (ohne Merker) → nie gesendet, nie neu geschrieben; ablegen nur mit Schalter");
    {
      const B = await kunde("B");
      const b = await entwurf(B, { neu: false });
      const B2 = await kunde("B2");
      const b2 = await entwurf(B2, { neu: false });
      await spaetereMail(B2, 2);
      const r = await lauf1([b.id, b2.id], SAUBER);
      ok(r.ki === 0 && r.gesendet === 0 && r.entwuerfe === 0, "Schalter aus: kein Modell, keine Mail", r);
      ok((await zeile(b.id)).aktion === "entwurf" && (await zeile(b2.id)).aktion === "entwurf", "beide bleiben Entwurf (nichts verändert)");
      ok(r.e.probe === 1, "Probelauf im Lauf zählt 1 nicht mehr nötig", r.e);
      const st = await F.fristStand({ frisch: true });
      ok(st.altbestandAblegen === false && st.altbestand.nichtMehrNoetig >= 1 && st.altbestand.offen >= 1 && st.altbestand.jeGrund.kunde_schrieb >= 1,
        "Probelauf (fristStand): nicht mehr nötig ≥ 1, offen ≥ 1, Grund „Kunde schrieb danach“", st.altbestand);
      const karte = PE.altbestandKarte(st, R.GRUND_KURZ);
      ok(karte && karte.schluessel === PE.ALTBESTAND_KARTE && karte.optionen.map((o) => o.key).join() === "ablegen,lassen" && karte.empfehlung === "ablegen",
        "Entscheidungskarte „alte Entwürfe ablegen?“ mit zwei Knöpfen", karte);
      ok(/KEINE Mail an Kunden/.test(String(karte?.text)), "Karte sagt: keine Mail an Kunden");
      // Der Detektor legt die Karte über den echten Sammler an.
      await ME.entscheidungTabellen();
      const sammel = await ME.entscheidungenSammeln({ nur: ["postmeister_altbestand"] });
      const [k] = (await sql`SELECT id, status, titel FROM fiaon_mara_entscheidungen WHERE schluessel = ${PE.ALTBESTAND_KARTE}`) as any[];
      ok(k?.status === "offen", "Sammler: Karte liegt offen in Mara › Entscheidungen", { sammel: sammel.je.postmeister_altbestand, k });
      // Der Klick auf der Karte (derselbe Weg wie im Chefbüro): Schalter an + im Hintergrund ablegen.
      const vorS = GMAIL_SENDEN.length, vorKi = KI.length;
      SZ = SAUBER;
      const klick = await ME.entscheiden(Number(k.id), "ablegen", { von: "Prüfstand" });
      ok(klick.ok && klick.karte?.status === "entschieden" && /keine Mail an Kunden/.test(String((klick.karte as any)?.ergebnis ?? "")),
        "Klick „ablegen“ auf der Karte: entschieden, Ergebnis sagt „keine Mail an Kunden“", { ok: klick.ok, status: klick.karte?.status, e: (klick.karte as any)?.ergebnis });
      const w = (await F.altbestandLaufAktuell()) ?? { abgelegt: -1 };
      ok(w.abgelegt >= 1 && (await zeile(b2.id)).aktion === "geordnet", "… im Hintergrund: der nicht mehr nötige alte Entwurf ist abgelegt", w);
      ok((await zeile(b.id)).aktion === "entwurf" && GMAIL_SENDEN.length === vorS && KI.length === vorKi, "der offene alte bleibt — nichts gesendet, kein Modell");
      ok(await F.altbestandSchalterLesen(), "Schalter steht jetzt auf an");
      const r2 = await lauf1([b.id], SAUBER);
      ok(r2.ki === 0 && r2.gesendet === 0 && (await zeile(b.id)).aktion === "entwurf", "auch mit Schalter an: Altbestand nie gesendet, nie neu geschrieben", r2);
      const sammel2 = await ME.entscheidungenSammeln({ nur: ["postmeister_altbestand"] });
      const [k2] = (await sql`SELECT status FROM fiaon_mara_entscheidungen WHERE schluessel = ${PE.ALTBESTAND_KARTE}`) as any[];
      ok(k2?.status === "entschieden" && sammel2.je.postmeister_altbestand?.karten === 0, "Schalter an → keine neue Karte, die entschiedene bleibt entschieden", { k2, s: sammel2.je.postmeister_altbestand });
      await F.altbestandSchalterSetzen(false);
      ok(!(await F.altbestandSchalterLesen()), "Schalter wieder aus");
    }

    console.log("── 5 · Versandfenster, 24-Stunden-Grenze, Postfach aus, KI-Pause");
    {
      const D = await kunde("D");
      const d = await entwurf(D, { neu: true });
      const nacht = heute22();
      const r = await lauf1([d.id], SAUBER, nacht);
      ok(r.ki === 0 && r.gesendet === 0 && (await zeile(d.id)).aktion === "entwurf", `22:00 Uhr: wartet (kein Modell, keine Mail)`, r.e);
      ok((await urteil(d.id, nacht))?.art === "warten", "Urteil um 22:00: warten");
      const J = await kunde("J");
      const j = await entwurf(J, { neu: true, entwurfStd: 5 });
      await spaetereMail(J, 1, 5);
      const rj = await lauf1([j.id], SAUBER);
      ok(rj.e.abgelegt === 0 && rj.ki === 0 && (await zeile(j.id)).aktion === "entwurf", "jünger als 24 h: nichts (auch nicht ablegen)", rj.e);
      await setzen("postmeister_an", "aus");
      const P = await kunde("P");
      const p = await entwurf(P, { neu: true });
      await spaetereMail(P, 2);
      const rp = await lauf1([p.id], SAUBER);
      ok(rp.e.abgelegt === 0 && rp.ki === 0 && (await zeile(p.id)).aktion === "entwurf", "Not-Aus (postmeister_an = aus): nichts, auch kein Ablegen", rp.e);
      await setzen("postmeister_an", "an");
      ok(R.fristUrteil({ ...(await F.fristZeilenLaden({ ids: [d.id] }))[0].fakten }, { modus: "auto", kiPausiert: true, altbestandAblegen: false, sperre: null }, imFenster()).art === "warten",
        "KI-Pause: warten");
    }

    console.log("── 6 · Was Justin entscheidet, Global, Sperren, alte Mails → Mara schreibt nicht neu");
    {
      const W = await kunde("W");
      const w = await entwurf(W, { neu: true, begruendung: "Übergabe an den Betreuer: Widerruf", flags: { widerruf: true }, text: "Ich widerrufe den Vertrag." });
      const G = await kunde("G");
      const g = await entwurf(G, { neu: true, begruendung: "Übergabe an den Betreuer: Kunde von FIAON Global" });
      await spaetereMail(G, 2);
      const T = await kunde("T", { test: true });
      const t = await entwurf(T, { neu: true });
      const V = await kunde("V", { blockiert: true });
      const v = await entwurf(V, { neu: true });
      const O = await kunde("O");
      const o = await entwurf(O, { neu: true, mailStd: 8 * 24 });
      const r = await lauf1([w.id, g.id, t.id, v.id, o.id], SAUBER);
      ok(r.ki === 0 && r.gesendet === 0 && r.e.abgelegt === 0, "kein Modell, keine Mail, nichts abgelegt", r);
      for (const [x, was] of [[w, "Widerruf"], [g, "Global (auch mit späterer Mail)"], [t, "Testkonto"], [v, "Vertriebssperre"], [o, "Kundenmail 8 Tage alt"]] as const) {
        ok((await zeile(x.id)).aktion === "entwurf" && (await zeile(x.id)).frist_neu_am == null, `${was}: bleibt unberührt`);
      }
      ok((await urteil(g.id))?.art === "auslassen", "Global: auslassen");
      ok((await urteil(w.id))?.art === "bleibt", "Widerruf ohne neuere Mail/Storno: bleibt");
      // Widerruf: der gebuchte Storno (von einem Menschen) erledigt ihn.
      await sql`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW() - INTERVAL '2 hours', kuendigung_postmeister_id = NULL WHERE ref = ${W.ref}`;
      const uw = await urteil(w.id);
      ok(uw?.art === "ablegen" && (uw as any).wegen === "storno", "Widerruf + Storno danach gebucht → ablegen (storno)", uw);
    }

    console.log("── 7 · „Erledigt“: Kündigung, Gespräch, Zahlung — und nicht, wenn Mara sie in DIESEM Entwurf selbst buchte");
    {
      const K = await kunde("K");
      const k = await entwurf(K, { neu: true });
      await sql`UPDATE fiaon_applications SET gekuendigt_am = NOW() - INTERVAL '3 hours', kuendigung_postmeister_id = ${k.id} WHERE ref = ${K.ref}`;
      const uk = await urteil(k.id);
      ok(uk?.art === "neu_schreiben", "Kündigung, die Mara beim Schreiben DIESES Entwurfs buchte → nicht „erledigt“ (der Entwurf ist die Bestätigung)", uk);
      await sql`UPDATE fiaon_applications SET kuendigung_postmeister_id = NULL, kuendigung_quelle = 'telefon' WHERE ref = ${K.ref}`;
      const uk2 = await urteil(k.id);
      ok(uk2?.art === "ablegen" && (uk2 as any).wegen === "kuendigung", "Kündigung von einem Menschen danach gebucht → ablegen", uk2);
      const Q = await kunde("Q");
      const q = await entwurf(Q, { neu: true });
      const [ag] = (await sql`SELECT id FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];
      await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, created_at, updated_at) VALUES (${Q.pid}, ${Number(ag.id)}, NOW() - INTERVAL '4 hours', 30, 'erledigt', 'pruef', NOW(), NOW())`;
      const uq = await urteil(q.id);
      ok(uq?.art === "ablegen" && (uq as any).wegen === "gespraech", "Termin danach geführt (erledigt) → ablegen", uq);
      const Q2 = await kunde("Q2");
      const q2 = await entwurf(Q2, { neu: true });
      await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, outcome, note, created_at) VALUES (${Q2.ref}, ${Q2.pid}, 'Prüfstand', 'call', 'erreicht_sonstiges', 'erreicht', NOW() - INTERVAL '2 hours')`;
      const uq2 = await urteil(q2.id);
      ok(uq2?.art === "ablegen" && (uq2 as any).wegen === "gespraech", "Anruf danach „erreicht“ → ablegen", uq2);
      const Zk = await kunde("ZA", { bezahlt: false });
      const za = await entwurf(Zk, { neu: true, mailStd: 50, entwurfStd: 49, kategorien: ["zahlung"], flags: { zahlung_behauptet: true }, text: "Ich habe überwiesen." });
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
                VALUES (${Zk.ref}, 1, ${`${M}ZA`}, 5999, CURRENT_DATE, 'bezahlt', NOW(), 'auto', 'Prüfstand')`;
      await sql`UPDATE fiaon_applications SET payment_status = 'paid' WHERE ref = ${Zk.ref}`;
      const uz = await urteil(za.id);
      ok(uz?.art === "ablegen" && (uz as any).wegen === "zahlung", "„habe überwiesen“ + Zahlung danach gebucht → ablegen", uz);
      const Zb = await kunde("ZB", { bezahlt: false });
      const zb = await entwurf(Zb, { neu: true, mailStd: 50, entwurfStd: 49, kategorien: ["status_frage"], text: "Wann kommt meine Karte?" });
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
                VALUES (${Zb.ref}, 1, ${`${M}ZB`}, 5999, CURRENT_DATE, 'bezahlt', NOW(), 'auto', 'Prüfstand')`;
      await sql`UPDATE fiaon_applications SET payment_status = 'paid' WHERE ref = ${Zb.ref}`;
      const ub = await urteil(zb.id);
      ok(ub?.art === "neu_schreiben", "Kartenfrage + Zahlung danach → NICHT erledigt (die Frage ist offen) — neu schreiben", ub);
    }

    console.log("── 8 · Modus „entwurf“ und eine gescheiterte Neufassung");
    {
      await setzen("postmeister_modus_support", "entwurf");
      const E = await kunde("E");
      const e = await entwurf(E, { neu: true });
      const r = await lauf1([e.id], SAUBER);
      const z = await zeile(e.id);
      ok(r.gesendet === 0 && z.aktion === "entwurf" && r.entwuerfe === 1 && r.geloescht.includes(e.draft), "Postfach im Modus „entwurf“: neu geschrieben, nicht gesendet, genau ein Entwurf", { r: r.e, aktion: z.aktion });
      await setzen("postmeister_modus_support", "auto");
      const X = await kunde("X");
      const x = await entwurf(X, { neu: true, antwort: "Alte Fassung, die bleiben muss." });
      const rf = await lauf1([x.id], null); // Modell antwortet mit Fehler
      const zf = await zeile(x.id);
      ok(zf.aktion === "fehler" && zf.antwort === "Alte Fassung, die bleiben muss." && zf.antwort_draft_id === x.draft && !rf.geloescht.includes(x.draft),
        "Neufassung scheitert → „fehler“, alte Antwort und alter Gmail-Entwurf bleiben", { aktion: zf.aktion, antwort: zf.antwort, draft: zf.antwort_draft_id, g: rf.geloescht });
      await sql`UPDATE fiaon_postmeister SET naechster_versuch_am = NOW() - INTERVAL '1 minute' WHERE id = ${x.id}`;
      const rn = await lauf1([x.id], SAUBER);
      const zn = await zeile(x.id);
      ok(zn.aktion === "auto_beantwortet" && rn.gesendet === 1 && rn.geloescht.includes(x.draft), "nach dem Zeitplan nachgeholt → gesendet, alter Entwurf gelöscht", { aktion: zn.aktion, r: rn.e });
    }

    console.log("── 9 · Nie doppelt: zwei Läufe gleichzeitig, zweimal neu schreiben");
    {
      const Y = await kunde("Y");
      const y = await entwurf(Y, { neu: true });
      SZ = SAUBER;
      F.fristAbstandZuruecksetzen();
      const vorS = GMAIL_SENDEN.length;
      const [l1, l2] = await Promise.all([F.entwurfFristLauf({ immer: true, ids: [y.id], jetzt: imFenster() }), F.entwurfFristLauf({ immer: true, ids: [y.id], jetzt: imFenster() })]);
      ok([l1, l2].filter((l) => l.gelaufen).length === 1 && GMAIL_SENDEN.length - vorS === 1, "zwei Läufe gleichzeitig: einer läuft, genau eine Mail", { l1: l1.grund, l2: l2.grund });
      const nochmal = await F.entwurfNeuSchreiben({ id: y.id, postfach: "support@fiaon.com", gmailId: y.gmail }, "auto");
      ok(nochmal.aktion === "uebersprungen" && GMAIL_SENDEN.length - vorS === 1, "entwurfNeuSchreiben ein zweites Mal → übersprungen", nochmal);
    }

    console.log("── 9b · E-401 Nachbesserung (Prüfer-Funde): Doppelzustellung, KI-Pause mitten im Lauf, Neufassung ohne Ergebnis");
    {
      // Rot vorher: die Neufassung fand die Schwesterzeile („Dieselbe Mail liegt auch in …“) als Original → 'geordnet', der
      // Gmail-Entwurf gelöscht, die Kundenmail ohne Antwort.
      const Dz = await kunde("DZ");
      const dz = await entwurf(Dz, { neu: true });
      await sql`UPDATE fiaon_postmeister SET message_id = ${`<${dz.gmail}@kunde.invalid>`} WHERE id = ${dz.id}`;
      await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, von, betreff, empfangen_am, aktion, person_id, ref, begruendung, message_id, created_at)
                VALUES ('welcome@fiaon.com', ${`${dz.gmail}-w`}, ${`${dz.gmail}-tw`}, ${Dz.von}, 'Frage', NOW() - INTERVAL '26 hours', 'geordnet', ${Dz.pid}, ${Dz.ref},
                        'Dieselbe Mail liegt auch in support@fiaon.com', ${`<${dz.gmail}@kunde.invalid>`}, NOW() - INTERVAL '26 hours')`;
      const r = await lauf1([dz.id], SAUBER);
      const z = await zeile(dz.id);
      ok(z.aktion === "auto_beantwortet" && r.gesendet === 1, "Doppelzustellung: die Neufassung antwortet (nicht „geordnet“ als Doppel)", { aktion: z.aktion, begr: String(z.begruendung).slice(0, 80), e: r.e });
      const zDrei = (await sql`SELECT aktion FROM fiaon_postmeister WHERE message_id = ${`<${dz.gmail}@kunde.invalid>`} ORDER BY id`) as any[];
      ok(zDrei.length === 2 && zDrei.some((x) => x.aktion === "auto_beantwortet"), "von den zwei Zeilen derselben Mail ist eine beantwortet", zDrei.map((x) => x.aktion));

      // KI-Pause mitten im Lauf: entwurfNeuSchreiben prüft frisch — der Entwurf bleibt unberührt.
      const Kp = await kunde("KPM");
      const kpE = await entwurf(Kp, { neu: true });
      await setzen("ki_pause", JSON.stringify({ an: true, art: "hand", grund: "Prüfstand E-401", anbieter: "openai", seit: new Date().toISOString(), von: "Prüfstand" }));
      (kp as any).kiPauseZwischenspeicherLeeren?.();
      const nP = await F.entwurfNeuSchreiben({ id: kpE.id, postfach: "support@fiaon.com", gmailId: kpE.gmail }, "auto");
      const zP = await zeile(kpE.id);
      ok(nP.aktion === "uebersprungen" && zP.aktion === "entwurf" && zP.frist_neu_am == null && zP.antwort_draft_id === kpE.draft, "KI-Pause: nichts angefasst (Entwurf, kein Merker)", { nP, aktion: zP.aktion, neu: zP.frist_neu_am });
      await setzen("ki_pause", null);
      (kp as any).kiPauseZwischenspeicherLeeren?.();

      // Neufassung ohne Ergebnis (mailBearbeiten kehrt ohne Anspruch zurück — hier: ein Postfach, das Mara nicht bedient).
      // Rot vorher: die Zeile blieb 'vorgeordnet' mit frist_neu_am — unsichtbar für Postfach, Regel und Nachholen.
      const Kq = await kunde("KQO");
      const kq = await entwurf(Kq, { neu: true, begruendung: "sauber, aber Entwurf (Prüfstand alt)" });
      await sql`UPDATE fiaon_postmeister SET anhaenge = ${JSON.stringify([{ art: "agb" }])}::text::jsonb WHERE id = ${kq.id}`;
      const nQ = await F.entwurfNeuSchreiben({ id: kq.id, postfach: "js@fiaon.com", gmailId: kq.gmail }, "auto");
      const zQ = await zeile(kq.id);
      const anh = lies(zQ.anhaenge);
      ok(nQ.aktion === "uebersprungen" && zQ.aktion === "entwurf" && zQ.frist_neu_am == null && zQ.begruendung === "sauber, aber Entwurf (Prüfstand alt)"
        && zQ.antwort_draft_id === kq.draft && Array.isArray(anh) && anh[0]?.art === "agb",
        "kein Ergebnis → zurück auf den Entwurf von vorher (Begründung, Anhänge, Gmail-Entwurf), nicht als „neu geschrieben“ gezählt", { nQ, aktion: zQ.aktion, neu: zQ.frist_neu_am, b: zQ.begruendung, anh });
      const nochmalQ = await lauf1([kq.id], SAUBER);
      ok((await zeile(kq.id)).aktion === "auto_beantwortet" && nochmalQ.gesendet === 1, "… und der nächste Lauf schreibt ihn neu und sendet", nochmalQ.e);
    }

    console.log("── 10 · Der Stand im Postfach-Kopf (Probelauf) und die Woche");
    {
      const st = await F.fristStand({ frisch: true });
      ok(st.woche.neuGeschrieben >= 4 && st.woche.davonGesendet >= 3 && st.woche.abgelegt >= 2, "7 Tage: neu geschrieben, gesendet, abgelegt gezählt", st.woche);
      ok(st.neu.gesamt >= 1 && st.global >= 1, "neue Entwürfe und Global getrennt gezählt", { neu: st.neu, global: st.global });
      ok(st.letzterLauf != null, "letzter Lauf steht im Stand");
      F.fristAbstandZuruecksetzen(); // Zwischenspeicher veraltet → der Kopf rechnet (höchstens 1,5 s abgewartet)
      const t0 = Date.now();
      const schnell = await F.fristStandSchnell();
      ok(schnell != null && Date.now() - t0 < 4_000 && schnell.altbestand.gesamt === st.altbestand.gesamt, "Kopf des Postfachs: Stand kommt schnell (fristStandSchnell)", { ms: Date.now() - t0 });
    }

    ok(fremd === 0, `kein Netzaufruf außer den Attrappen (${fremd})`);
  } finally {
    await aufraeumen();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
