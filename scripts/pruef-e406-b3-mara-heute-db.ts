// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-406 B3 (19.10.2026), DATENBANK: „Mara heute“, die Ampel je Mara-Werkzeug, die Stichprobe und Maras
// Aufräum-Vorschläge — gegen eine LOKALE Prüfdatenbank, mit erfundenen Testkunden (Marke Q406). Gmail und das Modell
// sind Attrappen (fetch abgefangen), alles andere Netz ist gesperrt. Gefahren wird der ECHTE Code: mailBearbeiten
// (Weiche der Ampel), die 24-Stunden-Regel, die Karten (entscheiden, Sammelkarte), WhatsApp-Werkzeuge, der genannte
// Termin, Rückgängig (Termin absagen, Anschrift zurück, Nicht senden / Jetzt senden), zahlung_suchen, die Stichprobe.
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e406b3
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406b3?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-e406-b3-mara-heute-db.ts
// Eigene Datensätze (Personen PR-Q406-…, Bestellungen FIAON-Q406…, Mails q406-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "META_CAPI_TOKEN", "WHATSAPP_TOKEN"]) delete process.env[k];

// ── Attrappen VOR jedem Import: Modell und Gmail antworten hier, sonst kein Netz ──
import { generateKeyPairSync } from "node:crypto";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-q406";
process.env.KI_ANBIETER = "openai";
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@q406.invalid", private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.pruef.invalid/token",
});
interface Szenario { einordnung: Record<string, unknown>; antwort: Record<string, unknown>; umformuliert?: Record<string, unknown> }
let SZ: Szenario | null = null;
const GMAIL_SENDEN: string[] = [];
const GMAIL_ENTWURF: string[] = [];
const NACHRICHTEN = new Map<string, { thread: string; am: number; von: string; betreff: string; text: string }>();
const jsonAntwort = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const modellText = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
let fremd = 0;
const fremdeAdressen: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
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
    if (d && methode === "DELETE") return new Response(null, { status: 204 });
    if (/\/drafts/.test(u)) { GMAIL_ENTWURF.push(String(init?.body ?? "")); return jsonAntwort(200, { id: `entwurf-q406-${GMAIL_ENTWURF.length}`, message: { id: "x" } }); }
    if (/\/messages\?/.test(u)) return jsonAntwort(200, { messages: [], resultSizeEstimate: 0 });
    const mod = u.match(/\/messages\/([^/?]+)\/modify/);
    if (mod) return jsonAntwort(200, { id: mod[1] });
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
  fremdeAdressen.push(u.split("?")[0]);
  return new Response(`blockiert: ${u.split("?")[0]}`, { status: 599 });
}) as any;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 700)}` : ""}`); }
}

const H = 3_600_000;
const M = "Q406";
const AG = 99406;

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
  await postmeisterSchema();
  const lauf = await import("../server/lib/fiaon-postmeister-lauf");
  const F = await import("../server/lib/fiaon-postmeister-frist");
  const N = await import("../shared/fiaon-nicht-erreicht-nachfass");
  const A = await import("../server/lib/fiaon-mara-ampel");
  const HE = await import("../server/lib/fiaon-mara-heute");
  const ST = await import("../server/lib/fiaon-mara-stichprobe");
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  const AUF = await import("../server/lib/fiaon-mara-aufraeumen");
  const WA = await import("../server/lib/fiaon-whatsapp-mara");
  const G = await import("../server/lib/fiaon-mara-genannter-termin");
  const MT = await import("../server/lib/fiaon-mara-termin");
  const AN = await import("../server/lib/fiaon-mara-angaben-aendern");
  const { aktionTabellen } = await import("../server/lib/fiaon-mara-aktion");
  const R = await import("../shared/fiaon-mara-ampel");
  const { berlinWand } = await import("../shared/fiaon-genannter-termin");
  await E.entscheidungTabellen();
  await MT.protokollTabelle();
  await aktionTabellen();
  await AN.angabenTabelle();

  const EIN = ["ki_pause", "postmeister_an", "postmeister_v2", "postmeister_modus_support", "postmeister_modus_welcome", R.AMPEL_SCHALTER];
  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`) as any[];
  const setzen = async (k: string, v: string | null) => {
    await sql`DELETE FROM fiaon_settings WHERE key = ${k}`;
    if (v != null) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${k}, ${v})`;
  };
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
  await setzen("postmeister_an", "an");
  await setzen("postmeister_modus_support", "auto");
  (kp as any).kiPauseZwischenspeicherLeeren?.();
  const ampel = async (key: R.AmpelKey, stufe: R.AmpelStufe) => { await A.ampelSpeichern(key, stufe, "Prüfstand Q406"); };

  async function aufraeumen() {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PR-${M}-%`}`) as any[]).map((r) => Number(r.id));
    const refs = ((await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`) as any[]).map((r) => r.ref);
    const txns = ((await sql`SELECT id FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`) as any[]).map((r) => Number(r.id));
    await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE ${"q406-%"}`.catch(() => {});
    if (txns.length) {
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel = ANY(${txns.map((t) => `eingang:${t}`)})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_zahlung_funde WHERE bank_txn_id = ANY(${txns})`.catch(() => {});
      await sql`DELETE FROM fiaon_bank_txns WHERE id = ANY(${txns})`.catch(() => {});
    }
    if (refs.length) {
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_raten_arbeit WHERE ref = ANY(${refs})`.catch(() => {});
    }
    if (personen.length) {
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen}))`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_aktion WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_angaben WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_zahlung_funde WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_stichprobe WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_rueckgaengig WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${personen})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer LIKE ${"+4915100406%"}`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_stichprobe WHERE woche >= '2030-01-01'`.catch(() => {});
    await sql`DELETE FROM fiaon_ki_nutzung WHERE modell = 'pruef-q406'`.catch(() => {});
    await sql`DELETE FROM fiaon_termine WHERE agent_id = ${AG}`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`.catch(() => {});
    if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_agents WHERE id = ${AG}`.catch(() => {});
  }
  await aufraeumen();
  await sql`INSERT INTO fiaon_agents (id, name, email, active, commission_rate_bp) VALUES (${AG}, 'Prüf Hänger Q406', 'haenger@q406.invalid', TRUE, 2500)`;

  // ── Testkunden (erfunden) ───────────────────────────────────────────────
  type Kunde = { pid: number; ref: string; mail: string; von: string; pr: string };
  async function kunde(x: string, o: { bezahlt?: boolean; test?: boolean; status?: string; cents?: number; adresse?: { strasse: string; plz: string; ort: string }; telefon?: string } = {}): Promise<Kunde> {
    const mail = `kunde-${x.toLowerCase()}@q406.invalid`;
    const ref = `FIAON-${M}${x}`;
    // Namen nur aus Buchstaben verschieden (der Namensabgleich im Bankbuch lässt Ziffern weg): „Z1“ → „Zb“.
    const nm = x.replace(/\d/g, (d) => "abcdefghij"[Number(d)]);
    const pr = `FIAON${M}${x}1`;
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, ist_test_am, assigned_agent_id)
      VALUES (${`PR-${M}-${x}`}, ${`Vorname${nm}`}, ${`Ampelprobe${nm}`}, ${mail}, ${o.test ? new Date() : null}, 8) RETURNING id`) as any[];
    const bezahlt = o.bezahlt !== false;
    const status = o.status ?? (bezahlt ? "paid" : "pending_payment");
    const cents = o.cents ?? 5999;
    await sql`
      INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, email, first_name, last_name,
                                      person_id, created_at, completed_at, paid_at, current_step, submitted_at, agb_stand, freigeschaltet_am,
                                      street, zip, city, phone, assigned_agent_id)
      VALUES (${ref}, ${pr}, ${status}, ${bezahlt ? "payment_completed" : "payment_pending"}, 'private',
              'pro', 'FIAON Pro (Standard)', ${cents / 100}, ${mail}, ${`Vorname${nm}`}, ${`Ampelprobe${nm}`}, ${p.id}, NOW() - INTERVAL '90 days',
              ${bezahlt ? new Date(Date.now() - 60 * 86_400_000) : null}, ${bezahlt ? new Date(Date.now() - 60 * 86_400_000) : null}, 8, NOW() - INTERVAL '90 days', '2026-10-05',
              ${bezahlt ? new Date(Date.now() - 59 * 86_400_000) : null}, ${o.adresse?.strasse ?? null}, ${o.adresse?.plz ?? null}, ${o.adresse?.ort ?? null},
              ${o.telefon ?? null}, 8)`;
    return { pid: Number(p.id), ref, mail, von: `Vorname${nm} Ampelprobe${nm} <${mail}>`, pr };
  }
  let nr = 0;
  const lies = (w: unknown) => { let v: any = w; for (let i = 0; i < 3 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return null; } } return v; };
  const EIN_SAUBER = { kategorien: ["status_frage"], flags: {}, dringend: false, sprache: "de", fragen: ["Wie ist der Stand?"], zusammenfassung: "Kunde fragt nach dem Stand seines Vorgangs." };
  const schritt = { art: "erledigt", url: null, text: "" };
  const SAUBER: Szenario = {
    einordnung: EIN_SAUBER,
    antwort: { antwort: "Ihr Vorgang ist vollständig, es fehlt nichts von Ihrer Seite. Melden Sie sich gern, wenn Sie Fragen haben.", naechster_schritt: schritt, belege: [], fragen_beantwortet: ["Wie ist der Stand?"], merken: [] },
  };
  /** Eine frische Kundenmail durch den ECHTEN Postfach-Weg (Modus auto). */
  const mail = async (k: Kunde) => {
    nr++;
    const gmailId = `q406-${nr}`;
    NACHRICHTEN.set(gmailId, { thread: `q406-t${nr}`, am: Date.now() - 10 * 60_000, von: k.von, betreff: `Frage ${nr}`, text: `Guten Tag, wie ist der Stand bei mir? (Probe ${nr})` });
    SZ = SAUBER;
    const vorS = GMAIL_SENDEN.length, vorE = GMAIL_ENTWURF.length;
    await lauf.mailBearbeiten({ postfach: "support@fiaon.com", gmailId, gruss: "Freundliche Grüße\nIhr FIAON-Support", modus: "auto" });
    const [z] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[];
    return { z, gesendet: GMAIL_SENDEN.length - vorS, entwurf: GMAIL_ENTWURF.length - vorE, gmailId };
  };
  const karteZu = async (pmId: number) => ((await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE schluessel LIKE ${`postmeister:${pmId}:%`} ORDER BY id DESC`) as any[]);
  const imFenster = () => {
    const n = new Date();
    return N.imVersandfenster(n) && N.imVersandfenster(new Date(n.getTime() + 10 * 60_000)) ? n : new Date(N.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };
  /** Den Entwurf 26 Stunden altern lassen (Mail 26,2 h) — dann ist die 24-Stunden-Regel dran. */
  const altern = async (id: number) => {
    await sql`UPDATE fiaon_postmeister SET entwurf_geprueft_am = NOW() - INTERVAL '26 hours', empfangen_am = NOW() - INTERVAL '26 hours 12 minutes',
                     created_at = NOW() - INTERVAL '26 hours 12 minutes' WHERE id = ${id}`;
  };
  const fristLauf = async (ids: number[]) => {
    SZ = SAUBER;
    F.fristAbstandZuruecksetzen();
    const vorS = GMAIL_SENDEN.length;
    const e = await F.entwurfFristLauf({ immer: true, ids, jetzt: imFenster() });
    return { e, gesendet: GMAIL_SENDEN.length - vorS };
  };

  try {
    // ═════════════════════════════════════════════════════════════════════
    console.log("── 1 · Die Ampel in der Datenbank: Startwerte, Setzen, Verlauf, fest rot");
    {
      A.ampelZwischenspeicherLeeren();
      const s0 = await A.ampelStand({ frisch: true });
      ok(JSON.stringify(s0) === JSON.stringify(R.ampelVorgabe()), "ohne Eintrag: die Startwerte (= heutiges Verhalten)");
      await ampel("termin_eintragen", "gelb");
      const s1 = await A.ampelLesenMitVerlauf();
      ok(s1.stand.termin_eintragen === "gelb" && s1.verlauf[0]?.wer === "Prüfstand Q406" && s1.verlauf[0]?.von === "gruen", "gesetzt, mit Verlauf (wer, von → nach)", s1.verlauf[0]);
      ok((await A.ampelStufe("termin_eintragen")) === "gelb", "der Zwischenspeicher ist nach dem Setzen leer — die neue Stufe gilt sofort hier");
      let warf = "";
      try { await A.ampelSpeichern("erstattung", "gruen", "x"); } catch (e: any) { warf = String(e?.message ?? e); }
      ok(/nie automatisch|Fest rot/.test(warf) && (await A.ampelStufe("erstattung")) === "rot", "Erstattung lässt sich nicht lockern", warf);
      await sql`UPDATE fiaon_settings SET value = ${JSON.stringify({ stufen: { geld_buchen: "gruen", mail_antworten: "rot" } })} WHERE key = ${R.AMPEL_SCHALTER}`;
      A.ampelZwischenspeicherLeeren();
      const s2 = await A.ampelStand();
      ok(s2.geld_buchen === "rot" && s2.mail_antworten === "rot", "von Hand eingetragenes „Geld buchen: grün“ gilt nie");
      await setzen(R.AMPEL_SCHALTER, null);
      A.ampelZwischenspeicherLeeren();
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 2 · Mails beantworten: Grün sendet, Gelb wartet 24 h ohne Karte, Rot wird eine Karte");
    {
      const K1 = await kunde("M1");
      const g = await mail(K1);
      if (g.z?.aktion !== "auto_beantwortet") console.log("     (Weg:", g.z?.aktion, "—", String(g.z?.begruendung).slice(0, 200), JSON.stringify(lies(g.z?.pruefung))?.slice(0, 300), ")");
      ok(g.z?.aktion === "auto_beantwortet" && g.gesendet === 1, "Grün (Start): Mara sendet selbst — wie bisher", { aktion: g.z?.aktion, gesendet: g.gesendet });

      await ampel("mail_antworten", "gelb");
      const K2 = await kunde("M2");
      const y = await mail(K2);
      ok(y.z?.aktion === "entwurf" && y.gesendet === 0 && y.entwurf === 1, "Gelb: nichts gesendet — ein Entwurf wartet", { aktion: y.z?.aktion, gesendet: y.gesendet });
      ok(R.istAmpelGelbEntwurf(y.z?.begruendung) && /24 Stunden/.test(String(y.z?.begruendung)), "Begründung „Ampel gelb: … nach 24 Stunden …“", y.z?.begruendung);
      ok((await karteZu(Number(y.z.id))).length === 0, "Gelb: KEINE Karte für Justin");
      await E.entscheidungenSammeln({ nur: ["postmeister_entwurf"] });
      ok((await karteZu(Number(y.z.id))).length === 0, "auch der Sammler legt für den gelben Entwurf keine Karte an");
      const gelb1 = await HE.gelbListe(await A.ampelStand(), {});
      const eintrag = gelb1.find((x) => x.art === "mail_nicht_senden" && x.id === String(y.z.id));
      ok(!!eintrag && eintrag.knoepfe.map((k) => k.label).join("|") === "Jetzt senden|Nicht senden", "„Mara heute“: der Entwurf mit „Jetzt senden“ und „Nicht senden“", eintrag);
      // Nach 24 h: die 24-Stunden-Regel schreibt einmal neu und SENDET (zweiter Anlauf, ampelFrist).
      await altern(Number(y.z.id));
      const f = await fristLauf([Number(y.z.id)]);
      const y2 = ((await sql`SELECT aktion, gesendet_am, begruendung FROM fiaon_postmeister WHERE id = ${y.z.id}`) as any[])[0];
      if (y2?.aktion !== "auto_beantwortet") console.log("     (Weg nach 24 h:", y2?.aktion, "—", String(y2?.begruendung).slice(0, 200), JSON.stringify(f.e), ")");
      ok(y2?.aktion === "auto_beantwortet" && f.gesendet === 1, "Gelb: nach 24 h sendet Mara selbst (24-Stunden-Regel)", { aktion: y2?.aktion, e: f.e });

      // „Nicht senden“ und „Jetzt senden“ aus „Mara heute“.
      const K3 = await kunde("M3");
      const n3 = await mail(K3);
      const r3 = await HE.rueckgaengigMachen("mail_nicht_senden", String(n3.z.id), "Prüfstand Q406");
      const z3 = ((await sql`SELECT aktion, gesendet_am FROM fiaon_postmeister WHERE id = ${n3.z.id}`) as any[])[0];
      ok(r3.ok && z3.aktion === "geordnet" && !z3.gesendet_am, "„Nicht senden“: abgelegt, keine Mail", { r3, z3 });
      const r3b = await HE.rueckgaengigMachen("mail_nicht_senden", String(n3.z.id), "Prüfstand Q406");
      ok(!r3b.ok && r3b.status === 409, "zweimal „Nicht senden“: schon erledigt", r3b);
      const K4 = await kunde("M4");
      const n4 = await mail(K4);
      const vorS4 = GMAIL_SENDEN.length;
      const r4 = await HE.rueckgaengigMachen("mail_senden", String(n4.z.id), "Prüfstand Q406");
      const z4 = ((await sql`SELECT aktion, gesendet_am FROM fiaon_postmeister WHERE id = ${n4.z.id}`) as any[])[0];
      ok(r4.ok && !!z4.gesendet_am && GMAIL_SENDEN.length === vorS4 + 1, "„Jetzt senden“: gesendet (derselbe Weg wie die Zentrale)", { r4, z4 });
      const fremdeMail = await HE.rueckgaengigMachen("mail_nicht_senden", String(g.z.id), "x");
      ok(!fremdeMail.ok, "eine schon gesendete Mail lässt sich nicht „nicht senden“", fremdeMail);

      await ampel("mail_antworten", "rot");
      const K5 = await kunde("M5");
      const rr = await mail(K5);
      ok(rr.z?.aktion === "entwurf" && rr.gesendet === 0 && R.istAmpelRotEntwurf(rr.z?.begruendung), "Rot: nichts gesendet, Begründung „Ampel rot: …“", { aktion: rr.z?.aktion, b: rr.z?.begruendung });
      const kr = await karteZu(Number(rr.z.id));
      ok(kr.length === 1 && /Ampel rot/.test(kr[0].titel) && kr[0].empfehlung === "senden", "Rot: eine Karte „Ampel rot — Maras Antwort senden?“, Empfehlung senden", kr[0]?.titel);
      const gelbRot = await HE.gelbListe(await A.ampelStand(), {});
      ok(!gelbRot.some((x) => x.id === String(rr.z.id)), "ein roter Entwurf steht nicht in der gelben Liste");
      await altern(Number(rr.z.id));
      const fr = await fristLauf([Number(rr.z.id)]);
      const rr2 = ((await sql`SELECT aktion, gesendet_am, begruendung, frist_neu_am FROM fiaon_postmeister WHERE id = ${rr.z.id}`) as any[])[0];
      ok(rr2.aktion === "entwurf" && !rr2.gesendet_am && fr.gesendet === 0 && R.istAmpelRotEntwurf(rr2.begruendung), "Rot: auch die 24-Stunden-Regel sendet NICHT", { rr2, e: fr.e });
      const kr2 = (await karteZu(Number(rr.z.id))).filter((k) => k.status === "offen");
      const vorS5 = GMAIL_SENDEN.length;
      const ent = kr2[0] ? await E.entscheiden(Number(kr2[0].id), "senden", { von: "Prüfstand Q406" }) : null;
      ok(ent?.ok && GMAIL_SENDEN.length === vorS5 + 1, "Rot: Justins Klick „Maras Antwort senden“ sendet", ent?.error ?? ent?.karte?.ergebnis);
      await ampel("mail_antworten", "gruen");
      const K6 = await kunde("M6");
      const g6 = await mail(K6);
      ok(g6.z?.aktion === "auto_beantwortet" && g6.gesendet === 1, "zurück auf Grün: sendet wieder selbst");
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 3 · Termine: Gelb = „Termin absagen“ (24 h), Rot = nichts eintragen, Karte");
    {
      const T1 = await kunde("T1");
      let versatz = 0;
      const termin = async (k: Kunde, herkunft: string, vorStd = 0, tok = `q406-tok-${Math.random().toString(36).slice(2)}`) => {
        // Je Termin eine eigene Zeit (die Datenbank verbietet Überschneidungen beim selben Mitarbeiter).
        const beginn = new Date(Date.now() + 26 * H + (versatz++) * 45 * 60_000);
        const [t] = (await sql`
          INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, herkunft, created_at, updated_at)
          VALUES (${k.pid}, ${AG}, ${beginn}, 20, 'gebucht', 'agent_manuell', ${tok}, ${herkunft}, NOW() - make_interval(hours => ${vorStd}), NOW())
          RETURNING id`) as any[];
        return Number(t.id);
      };
      await ampel("termin_eintragen", "gruen");
      const t1 = await termin(T1, "mara_whatsapp");
      const g0 = await HE.rueckgaengigMachen("termin", String(t1), "Prüfstand Q406");
      ok(!g0.ok && /nicht auf Gelb/.test(g0.text), "Grün: kein Rückgängig (Mara macht es allein)", g0);
      await ampel("termin_eintragen", "gelb");
      const tLink = await termin(T1, "mara_whatsapp_link");
      const tAlt = await termin(T1, "mara_mail_genannt", 30);
      const liste = await HE.gelbListe(await A.ampelStand(), {});
      const e1 = liste.find((x) => x.art === "termin" && x.id === String(t1));
      ok(!!e1 && e1.knoepfe[0]?.label === "Termin absagen", "Gelb: Maras Termin steht in „Mara heute“ mit „Termin absagen“", e1);
      ok(!liste.some((x) => x.id === String(tLink)), "ein Termin, den der Kunde über Maras Link selbst gebucht hat, steht nicht da");
      ok(!liste.some((x) => x.id === String(tAlt)), "älter als 24 Stunden: nicht mehr in der Liste");
      const r1 = await HE.rueckgaengigMachen("termin", String(t1), "Prüfstand Q406");
      const [t1z] = (await sql`SELECT status, abgesagt_von FROM fiaon_termine WHERE id = ${t1}`) as any[];
      ok(r1.ok && t1z.status === "abgesagt" && t1z.abgesagt_von === "agent", "„Termin absagen“: abgesagt (der Kunde bekommt die Absage mit Link)", { r1, t1z });
      const v1 = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${T1.pid} AND note LIKE '%zurückgenommen%'`) as any[];
      ok(v1.length === 1, "Vermerk in der Akte", v1);
      const r1b = await HE.rueckgaengigMachen("termin", String(t1), "Prüfstand Q406");
      ok(!r1b.ok, "zweimal absagen geht nicht", r1b);
      const liste2 = await HE.gelbListe(await A.ampelStand(), {});
      ok(!!liste2.find((x) => x.id === String(t1))?.erledigt, "die Liste zeigt danach „erledigt“ mit Ergebnis");
      const rAlt = await HE.rueckgaengigMachen("termin", String(tAlt), "x");
      ok(!rAlt.ok && /24 Stunden/.test(rAlt.text), "nach 24 Stunden: nicht mehr mit einem Klick", rAlt);

      // Rot: WhatsApp-Rückruf
      await ampel("termin_eintragen", "rot");
      const W1 = await kunde("W1");
      const zeit = `${new Date(Date.now() + 30 * H).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })} 10:00`;
      const ctx = { personId: W1.pid, leadId: null, nummer: "+4915100406001", kunde: "Bitte rufen Sie mich morgen um 10 Uhr an." };
      const w = await WA.werkzeugAusfuehren("rueckruf_eintragen", { zeit, anliegen: "Rückruf wegen der Karte" }, ctx as any);
      const [{ n: anzW }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${W1.pid}`) as any[];
      ok(w.ergebnis.ok === false && /Ampel rot/.test(String(w.aktion.vorlegen)) && anzW === 0, "Rot (WhatsApp): kein Termin, der Wunsch kommt als Karte (vorlegen)", { e: w.ergebnis, v: w.aktion.vorlegen, anzW });
      ok(/KEINE Uhrzeit/.test(String(w.ergebnis.grund)) && (w.aktion.zeiten ?? []).length === 0, "Rot: Mara sagt keine Uhrzeit zu");
      await ampel("termin_eintragen", "gruen");
      const w2 = await WA.werkzeugAusfuehren("rueckruf_eintragen", { zeit, anliegen: "Rückruf wegen der Karte" }, ctx as any);
      ok(!/Ampel rot/.test(String(w2.aktion.vorlegen ?? "")), "Grün (Kontrolle): der Weg läuft wie bisher, ohne Ampel-Karte", w2.aktion);

      // Rot: genannter Termin (E-395) → Karte „Termin eintragen?“ → Klick trägt ein. Grün (Kontrolle) trägt selbst ein.
      // Eine Uhrzeit (Berlin) in `inMin` Minuten, auf die Viertelstunde + 5 Minuten (sicher außerhalb jedes Rasters).
      const zeitIn = (inMin: number) => {
        const zw = berlinWand(new Date(Date.now() + inMin * 60_000));
        const heute = berlinWand(new Date());
        const [hh, mm] = zw.hhmm.split(":").map(Number);
        const min = Math.min(55, Math.floor(mm / 15) * 15 + 5);
        return { tagWort: zw.t === heute.t ? "heute" : "morgen", hh, min, uhr: `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
      };
      const notiz = async (k: Kunde, z: ReturnType<typeof zeitIn>) => sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
        VALUES (${k.ref}, ${k.pid}, 8, 'Daniel Stripling', 'result', 'erreicht_sonstiges', ${`Hat Interesse an Global, telefoniert ${z.tagWort} ${z.uhr} Uhr mit Justin.`}, NOW() - INTERVAL '1 hour')`;
      const satz = (z: ReturnType<typeof zeitIn>) => `wir haben ${z.tagWort} um ${z.hh}.${String(z.min).padStart(2, "0")} uhr ein gespräch für einen firmenkredit.`;
      const zR = zeitIn(55);
      const uhr = zR.uhr;
      await ampel("termin_eintragen", "rot");
      const GR = await kunde("GR");
      await notiz(GR, zR);
      const lr = await G.genannterTerminBehandeln({ personId: GR.pid, ref: null, kundeText: satz(zR), postmeisterId: 406001 });
      const [{ n: anzG }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${GR.pid}`) as any[];
      ok(lr?.erkennung.art === "mit_uns" && lr?.eingetragen === false && /Ampel rot/.test(String(lr?.fehler)) && anzG === 0, "Rot (genannter Termin): erkannt, NICHT eingetragen", { art: lr?.erkennung.art, f: lr?.fehler, anzG });
      ok(/NICHT EINGETRAGEN/.test(String(lr?.hinweis)) && /NICHT, dass es eingetragen ist/.test(String(lr?.hinweis)), "Hinweis an Mara: nicht „eingetragen“ schreiben, gutes Gespräch wünschen");
      const [kt] = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = ${AUF.TERMIN_ROT_ART} AND person_id = ${GR.pid}`) as any[];
      ok(kt && kt.status === "offen" && kt.empfehlung === "eintragen", "Karte „Termin eintragen?“ liegt vor", kt?.titel);
      const ek = kt ? await E.entscheiden(Number(kt.id), "eintragen", { von: "Prüfstand Q406" }) : null;
      const [tg] = (await sql`SELECT agent_id, herkunft, status, beginn FROM fiaon_termine WHERE person_id = ${GR.pid}`) as any[];
      ok(ek?.ok && tg && Number(tg.agent_id) === 928 && tg.herkunft === "mara_mail_genannt" && berlinWand(new Date(tg.beginn)).hhmm === uhr, "Klick „Eintragen“: Termin steht (wie Mara ihn bei Grün eingetragen hätte)", { e: ek?.error ?? ek?.karte?.ergebnis, tg });
      const ek2 = kt ? await E.entscheiden(Number(kt.id), "eintragen", { von: "Prüfstand Q406" }) : null;
      const [{ n: anzG2 }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${GR.pid}`) as any[];
      ok(ek2?.schon === true && anzG2 === 1, "ein zweiter Klick trägt nichts doppelt ein");
      await ampel("termin_eintragen", "gruen");
      const GG = await kunde("GG");
      const zG = zeitIn(175);
      await notiz(GG, zG);
      const lg = await G.genannterTerminBehandeln({ personId: GG.pid, ref: null, kundeText: satz(zG), postmeisterId: 406002 });
      ok(lg?.eingetragen === true, "Grün (Kontrolle): Mara trägt selbst ein — wie bisher", { e: lg?.eingetragen, f: lg?.fehler });
      const [{ n: kartenGG }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_entscheidungen WHERE art = ${AUF.TERMIN_ROT_ART} AND person_id = ${GG.pid}`) as any[];
      ok(kartenGG === 0, "Grün: keine Ampel-Karte");
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 4 · Anschrift und Telefon: Gelb = „Zurück auf alt“ über den Speicherweg der Akte");
    {
      await ampel("angaben_aendern", "gelb");
      const angabe = async (k: Kunde, feld: string, vorher: string, nachher: string, edits: string[], minuten = 10) => {
        const [g] = (await sql`
          INSERT INTO fiaon_mara_angaben (person_id, ref, kanal, quelle, feld, stand, vorher, nachher, created_at, aktualisiert_am)
          VALUES (${k.pid}, ${k.ref}, 'mail', ${`Mail #q406-${feld}-${k.pid}`}, ${feld}, 'geaendert', ${vorher}, ${nachher},
                  NOW() - make_interval(mins => ${minuten}), NOW() - make_interval(mins => ${minuten})) RETURNING id`) as any[];
        for (const note of edits) {
          await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
                    VALUES (${k.ref}, NULL, 'Mara (Mail)', 'edit', ${note}, NOW() - make_interval(mins => ${minuten}))`;
        }
        return Number(g.id);
      };
      const A1 = await kunde("A1", { adresse: { strasse: "Neue Straße 7", plz: "20095", ort: "Hamburg" } });
      const g1 = await angabe(A1, "anschrift", "Alte Gasse 1, 10115 Berlin", "Neue Straße 7, 20095 Hamburg", [
        "Straße korrigiert durch Mara (Mail): Alte Gasse 1 → Neue Straße 7", "PLZ korrigiert durch Mara (Mail): 10115 → 20095", "Ort korrigiert durch Mara (Mail): Berlin → Hamburg"]);
      const liste = await HE.gelbListe(await A.ampelStand(), {});
      ok(liste.find((x) => x.art === "angaben" && x.id === String(g1))?.knoepfe[0]?.label === "Zurück auf alt", "Gelb: die Änderung steht mit „Zurück auf alt“");
      const r1 = await HE.rueckgaengigMachen("angaben", String(g1), "Prüfstand Q406");
      const [a1] = (await sql`SELECT street, zip, city FROM fiaon_applications WHERE ref = ${A1.ref}`) as any[];
      ok(r1.ok && a1.street === "Alte Gasse 1" && a1.zip === "10115" && a1.city === "Berlin", "Anschrift zurück auf den alten Stand", { r1, a1 });
      const log1 = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${A1.ref} AND type = 'edit' AND note LIKE '%korrigiert durch Chefbüro (Mara heute: zurück%'`) as any[];
      ok(log1.length === 3, "drei Verlaufszeilen „korrigiert durch Chefbüro (Mara heute: zurück …)“", log1.map((x) => x.note));
      const r1b = await HE.rueckgaengigMachen("angaben", String(g1), "Prüfstand Q406");
      ok(!r1b.ok && /Schon zurückgenommen/.test(r1b.text), "zweimal geht nicht", r1b);

      const A2 = await kunde("A2", { adresse: { strasse: "Neue Straße 9", plz: "20095", ort: "München" } });
      const g2 = await angabe(A2, "anschrift", "Alte Gasse 2, 10115 Berlin", "Neue Straße 9, 20095 Hamburg", [
        "Straße korrigiert durch Mara (Mail): Alte Gasse 2 → Neue Straße 9", "PLZ korrigiert durch Mara (Mail): 10115 → 20095", "Ort korrigiert durch Mara (Mail): Berlin → Hamburg"]);
      const r2 = await HE.rueckgaengigMachen("angaben", String(g2), "Prüfstand Q406");
      const [a2] = (await sql`SELECT street, zip, city FROM fiaon_applications WHERE ref = ${A2.ref}`) as any[];
      ok(r2.ok && a2.street === "Alte Gasse 2" && a2.city === "München" && /Ort \(inzwischen geändert\)/.test(r2.text), "was ein Mensch inzwischen geändert hat, bleibt (Ort München)", { r2, a2 });

      const A3 = await kunde("A3", { telefon: "+491701234567" });
      const g3 = await angabe(A3, "telefon", "—", "+491701234567", ["Telefon korrigiert durch Mara (Mail): — → +491701234567"]);
      const r3 = await HE.rueckgaengigMachen("angaben", String(g3), "Prüfstand Q406");
      ok(!r3.ok && /vorher leer/.test(r3.text), "Telefon ohne alten Wert: nicht auf „leer“ zurück", r3);

      const A4 = await kunde("A4", { adresse: { strasse: "Neue Straße 4", plz: "20095", ort: "Hamburg" } });
      const g4 = await angabe(A4, "anschrift", "Alte Gasse 4, 10115 Berlin", "Neue Straße 4, 20095 Hamburg", ["Straße korrigiert durch Mara (Mail): Alte Gasse 4 → Neue Straße 4"], 26 * 60);
      const r4 = await HE.rueckgaengigMachen("angaben", String(g4), "x");
      ok(!r4.ok && /24 Stunden/.test(r4.text), "älter als 24 Stunden: nicht mehr mit einem Klick", r4);
      await ampel("angaben_aendern", "gruen");
      const A5 = await kunde("A5", { adresse: { strasse: "Neue Straße 5", plz: "20095", ort: "Hamburg" } });
      const g5 = await angabe(A5, "anschrift", "Alte Gasse 5, 10115 Berlin", "Neue Straße 5, 20095 Hamburg", ["Straße korrigiert durch Mara (Mail): Alte Gasse 5 → Neue Straße 5"]);
      const r5 = await HE.rueckgaengigMachen("angaben", String(g5), "x");
      const [a5] = (await sql`SELECT street FROM fiaon_applications WHERE ref = ${A5.ref}`) as any[];
      ok(!r5.ok && a5.street === "Neue Straße 5", "Grün: kein Rückgängig", r5);
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 5 · Ratenpause: Rot = Karte „Pause setzen“, nichts verschoben; Grün (Kontrolle) verschiebt");
    {
      const RP = await kunde("RP");
      const faellig = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle) VALUES (${RP.ref}, 2, ${`${RP.pr}-2`}, 5999, ${faellig}, 'offen', 'auto')`;
      const ctx = { personId: RP.pid, leadId: null, nummer: "+4915100406002", kunde: "Können Sie meine Rate bitte verschieben?", stufe: "kunde" };
      await ampel("ratenpause", "rot");
      const r = await WA.werkzeugAusfuehren("ratenpause_setzen", { zitat: "Können Sie meine Rate bitte verschieben?" }, ctx as any);
      const [ra] = (await sql`SELECT faellig_am::date::text AS f FROM fiaon_abo_raten WHERE ref = ${RP.ref} AND rate_nr = 2`) as any[];
      ok(r.ergebnis.ok === false && r.aktion.haertefall === true && r.aktion.ohneSperreMoeglich === true && /Ampel rot/.test(String(r.aktion.intern)) && ra.f === faellig,
        "Rot: nichts verschoben, Härtefall-Karte mit „Pause trotzdem setzen“", { e: r.ergebnis, a: r.aktion, f: ra.f });
      ok(/Geschäftsführung/.test(String(r.ergebnis.grund)) && !/weitere/i.test(String(r.ergebnis.grund)), "Rot: Mara sagt nichts zu („entscheidet unsere Geschäftsführung“)");
      await ampel("ratenpause", "gruen");
      const r2 = await WA.werkzeugAusfuehren("ratenpause_setzen", { zitat: "Können Sie meine Rate bitte verschieben?" }, ctx as any);
      const [rb] = (await sql`SELECT faellig_am::date::text AS f FROM fiaon_abo_raten WHERE ref = ${RP.ref} AND rate_nr = 2`) as any[];
      ok(r2.ergebnis.ok === true && rb.f !== faellig, "Grün (Kontrolle): wie bisher verschoben", { e: r2.ergebnis, f: rb.f });
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 6 · „Mara heute“: Zählen, Hängt, KI");
    {
      const [t] = (await sql.unsafe(`SELECT date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' AS ab`)) as any[];
      const ab = new Date(t.ab), bis = () => new Date(Date.now() + 60_000);
      const vorher = await HE.handlungenZaehlen(ab, bis());
      const P = await kunde("H1");
      const PT = await kunde("HT", { test: true });
      nr++;
      await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, von, betreff, empfangen_am, text, aktion, person_id, ref, antwort, gesendet_am, entwurf_geprueft_am, handlungen, created_at)
                VALUES ('support@fiaon.com', ${`q406-${nr}`}, ${`q406-t${nr}`}, ${P.von}, 'Karte?', NOW() - INTERVAL '20 minutes', 'Wo ist meine Karte?', 'auto_beantwortet',
                        ${P.pid}, ${P.ref}, 'Ihr Link ist unterwegs.', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes',
                        ${sql.json([{ werkzeug: "karte_senden", ok: true, ergebnis: "Link geschickt" }, { werkzeug: "zahlungslink_bauen", ok: true, ergebnis: "x" }] as any)},
                        NOW() - INTERVAL '20 minutes')`;
      await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, von, status, empfangen_am, created_at)
                VALUES ('q406-wa-1', 'rein', '+4915100406003', ${P.pid}, 'text', 'Hallo, wann ruft mich jemand an?', NULL, 'gelesen', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '9 minutes')`;
      await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, von, status, gesendet_am, created_at)
                VALUES ('q406-wa-2', 'raus', '+4915100406003', ${P.pid}, 'text', 'Gern, Herr Stripling ruft Sie morgen an.', 'Mara Lindner', 'delivered', NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '8 minutes'),
                       ('q406-wa-3', 'raus', '+4915100406003', ${P.pid}, 'vorlage', NULL, 'Mara', 'delivered', NOW() - INTERVAL '7 minutes', NOW() - INTERVAL '7 minutes'),
                       ('q406-wa-4', 'raus', '+4915100406003', ${P.pid}, 'text', 'Hat es geklappt?', 'Mara Lindner (Nachfass)', 'delivered', NOW() - INTERVAL '6 minutes', NOW() - INTERVAL '6 minutes')`;
      await sql`UPDATE fiaon_whatsapp SET vorlage = 'fiaon_kk_anfrage' WHERE wa_id = 'q406-wa-3'`;
      await MT.protokollieren({ art: "termin_gebucht", personId: P.pid, text: "Rückruf eingetragen (Prüfstand)", nummer: "+4915100406003" });
      await MT.protokollieren({ art: "termin_gebucht", personId: PT.pid, text: "Testperson (zählt nicht)", nummer: "+4915100406004" });
      await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, text, gesendet_am) VALUES (${P.pid}, ${P.ref}, 'B', 1, 'gesendet', 'Ihre Aktivierung', 'Text', NOW() - INTERVAL '5 minutes')`;
      const nachher = await HE.handlungenZaehlen(ab, bis());
      const d = (art: string) => (nachher[art] ?? 0) - (vorher[art] ?? 0);
      ok(d("mail_beantwortet") === 1 && d("karte_link") === 1, "Mail beantwortet + Kartenlink aus der Postfach-Zeile (Zahlungslink zählt nicht extra)", { m: d("mail_beantwortet"), k: d("karte_link") });
      ok(d("wa_antwort") === 1 && d("nachfass_wa") === 1, "WhatsApp: eine Antwort, ein Nachfassen — die Vorlage einer Strecke zählt nicht", { a: d("wa_antwort"), n: d("nachfass_wa") });
      ok(d("termin") === 1, "Termin aus dem Protokoll — die Testperson zählt nicht", d("termin"));
      ok(d("aktion_mail") === 1, "Mara-Aktion gezählt");
      const h = await HE.handlungenLesen(ab, bis(), { mitText: true });
      const wa = h.find((x) => x.quelle === "whatsapp" && x.art === "wa_antwort" && x.personId === P.pid);
      ok(wa?.kunde === "Hallo, wann ruft mich jemand an?" && /Herr Stripling/.test(String(wa?.mara)), "mit Text: was der Kunde schrieb und was Mara antwortete", wa);
      // Hängt und KI
      await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, herkunft, created_at)
                VALUES (${P.pid}, ${AG}, NOW() - INTERVAL '2 hours', 20, 'gebucht', 'agent_manuell', 'q406-haengt', 'agent', NOW() - INTERVAL '1 day')`;
      const kiVor = await HE.kiKostenLesen();
      await sql`INSERT INTO fiaon_ki_nutzung (dienst, modell, kosten_cents, ok, created_at) VALUES ('mara-whatsapp', 'pruef-q406', 120, TRUE, NOW()), ('radar', 'pruef-q406', 80, TRUE, NOW())`;
      const kiNach = await HE.kiKostenLesen();
      ok(kiVor && kiNach && kiNach.maraCents - kiVor.maraCents === 120 && kiNach.alleCents - kiVor.alleCents === 200, "KI heute: Mara 1,20 €, alle 2,00 € (Radar zählt nur bei „alle“)", { kiVor, kiNach });
      const mh = await HE.maraHeuteLesen({ ohneGeld: true });
      ok(mh.erledigt >= 6 && mh.zeilen.some((z) => z.art === "mail_beantwortet") && mh.zeilen.every((z) => z.n > 0), "maraHeuteLesen: Kopfzahl und Zeilen", { erledigt: mh.erledigt, zeilen: mh.zeilen.map((z) => `${z.art}:${z.n}`) });
      ok(mh.haengt.some((x) => x.agentId === AG && x.termineOhneErgebnis === 1), "Hängt: der Mitarbeiter mit dem Termin ohne Ergebnis", mh.haengt);
      ok(mh.karten != null && mh.ki != null, "Karten und KI sind da");
      const mitGeld = await HE.maraHeuteLesen();
      ok(mitGeld.geld === null || typeof mitGeld.geld.heuteCents === "number", "mit Geld (Maras Bilanz, EINE Quelle): rechnet oder fehlt ehrlich", mitGeld.geld);
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 7 · Aufräumen: alte Zahlungsmeldungen als Sammelkarte — Ja sucht im Bankbuch, Nein schließt");
    {
      const tag = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
      const meldung = async (x: string, tage: number, o: { test?: boolean } = {}) => {
        const k = await kunde(x, { bezahlt: false, status: "claimed_paid", test: o.test });
        await sql`UPDATE fiaon_applications SET claimed_paid_at = NOW() - make_interval(days => ${tage}) WHERE ref = ${k.ref}`;
        return k;
      };
      const Z1 = await meldung("Z1", 20);
      const Z2 = await meldung("Z2", 30);
      const Z3 = await meldung("Z3", 80);
      const Z4 = await meldung("Z4", 20, { test: true });
      const Z5 = await meldung("Z5", 5);
      const [eZ1] = (await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, applied, note)
                               VALUES (${`AWX-${M.toLowerCase()}-z1`}, ${`${tag(-18)}T00:00:00Z`}, 5999, 'EUR', 'VORNAMEZB AMPELPROBEZB', ${`Erstzahlung ${Z1.pr}`}, NULL, NULL, 'unmatched', FALSE, 'Prüfstand E-406')
                               RETURNING id`) as any[];
      const s = await E.entscheidungenSammeln({ nur: [R.AUFRAEUM_ART_ZAHLUNG] });
      ok(!s.je[R.AUFRAEUM_ART_ZAHLUNG]?.fehler, "Detektor ohne Fehler", s.je[R.AUFRAEUM_ART_ZAHLUNG]);
      const meine = async () => ((await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = ${R.AUFRAEUM_ART_ZAHLUNG} AND person_id = ANY(${[Z1.pid, Z2.pid, Z3.pid, Z4.pid, Z5.pid]})`) as any[]);
      const k1 = await meine();
      ok(k1.length === 2 && k1.every((k) => [Z1.pid, Z2.pid].includes(Number(k.person_id)) && k.status === "offen"), "Karten nur für 14–75 Tage, keine Testperson, nichts Frisches", k1.map((k) => `${k.person_id}:${k.status}`));
      const stand = await E.entscheidungenLesen();
      const gr = stand.gruppen.find((g) => g.art === R.AUFRAEUM_ART_ZAHLUNG);
      ok(gr && gr.anzahl >= 2 && gr.nein?.key === "lassen" && gr.empfehlung === "nachsehen", "eine E-397-Sammelkarte mit „Ja, im Bankbuch nachsehen“ und „Nein, so lassen“", gr);
      const kZ1 = k1.find((k) => Number(k.person_id) === Z1.pid)!, kZ2 = k1.find((k) => Number(k.person_id) === Z2.pid)!;
      const falsch = await E.entscheidenSammel([Number(kZ2.id)], gr!.schluessel, { von: "Prüfstand Q406", option: "gibtsnicht" });
      ok(!falsch.ok && falsch.status === 400, "eine Wahl, die es nicht gibt, lehnt der Server ab", falsch);
      const nein = await E.entscheidenSammel([Number(kZ2.id)], gr!.schluessel, { von: "Prüfstand Q406", option: "lassen" });
      const [kZ2n] = (await sql`SELECT status, gewaehlt FROM fiaon_mara_entscheidungen WHERE id = ${kZ2.id}`) as any[];
      ok(nein.ok && nein.erledigt === 1 && kZ2n.status === "entschieden" && kZ2n.gewaehlt === "lassen", "„Nein, so lassen“: die angehakte Karte ist entschieden", { nein, kZ2n });
      const ja = await E.entscheiden(Number(kZ1.id), "nachsehen", { von: "Prüfstand Q406" });
      const [f1] = (await sql`SELECT * FROM fiaon_mara_zahlung_funde WHERE person_id = ${Z1.pid}`) as any[];
      const [kE] = (await sql`SELECT status, art FROM fiaon_mara_entscheidungen WHERE schluessel = ${`eingang:${eZ1.id}`}`) as any[];
      const [bk] = (await sql`SELECT applied FROM fiaon_bank_txns WHERE id = ${eZ1.id}`) as any[];
      const [ap] = (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${Z1.ref}`) as any[];
      ok(ja.ok && /Eingang gefunden/.test(String(ja.karte?.ergebnis)), "„Ja, im Bankbuch nachsehen“: Eingang gefunden", ja.karte?.ergebnis ?? ja.error);
      ok(f1?.kanal === "meldung" && kE?.status === "offen" && kE?.art === "eingang_unverbucht", "Fund mit Kanal „Meldung“, Karte „Geld eingegangen“ liegt zum Buchen bereit", { f1: f1?.kanal, kE });
      ok(bk.applied === false && ap.payment_status === "claimed_paid", "NICHTS gebucht, Status unverändert (Mara bucht nie)", { bk, ap });
      const s2 = await E.entscheidungenSammeln({ nur: [R.AUFRAEUM_ART_ZAHLUNG] });
      const k2 = await meine();
      ok(!s2.je[R.AUFRAEUM_ART_ZAHLUNG]?.fehler && k2.length === 2 && k2.every((k) => k.status === "entschieden"), "entschiedene Meldungen kommen nicht wieder", k2.map((k) => `${k.person_id}:${k.status}`));
      // Kein Fund → Vermerk
      const Z6 = await meldung("Z6", 25);
      await E.entscheidungenSammeln({ nur: [R.AUFRAEUM_ART_ZAHLUNG] });
      const [k6] = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = ${R.AUFRAEUM_ART_ZAHLUNG} AND person_id = ${Z6.pid}`) as any[];
      const j6 = k6 ? await E.entscheiden(Number(k6.id), "nachsehen", { von: "Prüfstand Q406" }) : null;
      const v6 = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${Z6.pid} AND note LIKE 'Mara hat im Bankbuch nachgesehen%'`) as any[];
      ok(j6?.ok && /Kein Eingang/.test(String(j6.karte?.ergebnis)) && v6.length === 1, "kein Eingang: ehrliches Ergebnis und ein Vermerk in der Akte", { e: j6?.karte?.ergebnis, v6 });
      // Lage geändert (inzwischen bezahlt) → nichts mehr zu tun
      const Z7 = await meldung("Z7", 22);
      await E.entscheidungenSammeln({ nur: [R.AUFRAEUM_ART_ZAHLUNG] });
      const [k7] = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = ${R.AUFRAEUM_ART_ZAHLUNG} AND person_id = ${Z7.pid}`) as any[];
      await sql`UPDATE fiaon_applications SET payment_status = 'paid' WHERE ref = ${Z7.ref}`;
      const j7 = k7 ? await E.entscheiden(Number(k7.id), "nachsehen", { von: "Prüfstand Q406" }) : null;
      ok(j7?.ok && j7.karte?.status === "erledigt_von_selbst", "inzwischen bezahlt: „nichts mehr zu tun“, kein Bankbuch-Lesen nötig", j7?.karte);
      ok((await HE.aufraeumenLesen()).every((a) => a.anzahl >= 0), "„Mara heute“ liest die offenen Aufräum-Vorschläge");
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log("── 8 · Die Stichprobe: 20 je Woche, gleichmäßig, Bewerten, Quote, Vorschlag");
    {
      const S = await kunde("S1");
      const S2 = await kunde("S2");
      const woche = "2030-01-07";
      const amVor = (tag: number, std: number) => `2030-01-0${tag}T${String(std).padStart(2, "0")}:00:00Z`;
      for (let i = 0; i < 30; i++) {
        await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, text, gesendet_am, created_at)
                  VALUES (${i % 2 ? S.pid : S2.pid}, ${S.ref}, 'B', 1, 'gesendet', ${`Aktion ${i}`}, ${`Text der Aktion ${i}`}, ${amVor(1 + (i % 5), 9 + (i % 8))}, ${amVor(1, 8)})`;
      }
      for (let i = 0; i < 3; i++) await MT.protokollieren({ art: "termin_gebucht", personId: S.pid, text: `Rückruf ${i} eingetragen`, nummer: "+4915100406005" });
      await sql`UPDATE fiaon_mara_protokoll SET am = ${amVor(3, 11)} WHERE person_id = ${S.pid}`;
      await MT.protokollieren({ art: "ratenpause", personId: S2.pid, text: "Ratenpause gesetzt", nummer: "+4915100406006" });
      await sql`UPDATE fiaon_mara_protokoll SET am = ${amVor(4, 12)} WHERE person_id = ${S2.pid} AND art = 'ratenpause'`;
      for (let i = 0; i < 5; i++) {
        await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, von, status, gesendet_am, created_at)
                  VALUES (${`q406-st-${i}`}, 'raus', '+4915100406007', ${S.pid}, 'text', ${`Antwort ${i}`}, 'Mara Lindner', 'read', ${amVor(2, 10 + i)}, ${amVor(2, 10 + i)})`;
      }
      let saat = 11;
      const zufall = () => { saat = (saat * 16807) % 2147483647; return (saat - 1) / 2147483646; };
      const jetzt = new Date("2030-01-08T09:00:00Z");
      const z1 = await ST.stichprobeZiehenWennFaellig({ jetzt, zufall });
      const faelle = await ST.stichprobeLesen(woche);
      const je = (w: string) => faelle.filter((f) => f.werkzeug === w).length;
      ok(z1.woche === woche && z1.neu === 20 && faelle.length === 20, "20 Fälle aus der Vorwoche gezogen", z1);
      ok(je("termin_eintragen") === 3 && je("ratenpause") === 1 && je("aktion_mails") <= 11, "gleichmäßig: alle 3 Termine und die Ratenpause sind dabei", { t: je("termin_eintragen"), r: je("ratenpause"), a: je("aktion_mails"), w: je("whatsapp_antworten") });
      ok(faelle.every((f) => f.urteil === null) && faelle.some((f) => f.maraText), "unbewertet, mit Maras Text");
      const z2 = await ST.stichprobeZiehenWennFaellig({ jetzt, zufall });
      ok(z2.neu === 0 && z2.gesamt === 20, "ein zweites Ziehen in derselben Woche zieht nichts", z2);
      const f0 = faelle.find((f) => f.werkzeug === "termin_eintragen")!;
      const b0 = await ST.stichprobeBewerten(f0.id, "nicht_ok", "", { name: "Diana Prüf", id: null });
      ok(!b0.ok && b0.status === 400, "„nicht ok“ ohne Grund: abgelehnt", b0);
      const b1 = await ST.stichprobeBewerten(f0.id, "nicht_ok", "Falsche Uhrzeit bestätigt", { name: "Diana Prüf", id: null });
      ok(b1.ok && b1.fall?.urteil === "nicht_ok" && b1.fall?.bewertetVon === "Diana Prüf", "„nicht ok“ mit Grund: gespeichert, mit Namen", b1.fall);
      for (const f of faelle.filter((x) => x.werkzeug === "termin_eintragen" && x.id !== f0.id)) await ST.stichprobeBewerten(f.id, "ok", "", { name: "Diana Prüf", id: null });
      const q = await ST.quotenLesen({ jetzt: new Date("2030-01-15T09:00:00Z") });
      const qt = q.quoten.find((x) => x.werkzeug === "termin_eintragen");
      ok(q.wochen[0] === woche && qt && qt.n === 3 && qt.nichtOk === 1, "Fehlerquote je Werkzeug (die Woche ist jetzt voll)", qt);
      const stand = { ...R.ampelVorgabe(), termin_eintragen: "gelb" as const };
      const as = await ST.ampelStichprobe(stand, { jetzt: new Date("2030-01-15T09:00:00Z") });
      const at = as.find((x) => x.werkzeug === "termin_eintragen");
      ok(at && !at.aufstieg.vorschlag && /1 von 4 Wochen/.test(at.aufstieg.grund), "Gelb → Grün: nach einer Woche kein Vorschlag (nie automatisch)", at);
      const [{ n: stufeGeaendert }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_settings WHERE key = ${R.AMPEL_SCHALTER} AND value LIKE '%Diana%'`) as any[];
      ok(stufeGeaendert === 0, "kein Eintrag in der Ampel von der Stichprobe");
      // Datensparsam: keine Abschrift von Kunden- oder Mara-Texten in der Stichprobe.
      const spalten = ((await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_mara_stichprobe'`) as any[]).map((r) => String(r.column_name));
      ok(!spalten.some((c) => /text|titel|antwort/.test(c)), "die Stichprobe speichert keine Texte (nur Quelle und Nummer)", spalten);
      const aktionFall = faelle.find((f) => f.quelle === "aktion")!;
      await sql`DELETE FROM fiaon_mara_aktion WHERE id = ${Number(aktionFall.quelleId)}`;
      const nachLoeschen = (await ST.stichprobeLesen(woche)).find((f) => f.id === aktionFall.id);
      ok(nachLoeschen?.maraText === "(nicht mehr vorhanden)", "ist die Quelle gelöscht, steht „nicht mehr vorhanden“ — kein Text bleibt zurück", nachLoeschen?.maraText);
    }
  } finally {
    await setzen(R.AMPEL_SCHALTER, null);
    A.ampelZwischenspeicherLeeren();
    await aufraeumen();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`;
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  const fremdOhneKalender = fremdeAdressen.filter((u) => !/googleapis\.com\/calendar/.test(u));
  ok(fremdOhneKalender.length === 0, `kein Netzaufruf außer den Attrappen (${fremdOhneKalender.length})`, fremdOhneKalender.slice(0, 5));
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
