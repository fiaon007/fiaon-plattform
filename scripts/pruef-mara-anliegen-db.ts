// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-406 C1 (19.10.2026), DATENBANK: Mara beantwortet Anliegen aus dem Kundenbereich
//
// Erfundene Testkunden (Marke A406, Adressen …@a406.invalid) gegen eine LOKALE Prüfdatenbank. Das Modell ist eine
// Attrappe (fetch abgefangen), alles andere Netz ist gesperrt. Gefahren wird der ECHTE Code: anliegenTakt →
// anliegenBearbeiten → einordnenMitMerker → antwortErzeugen (Kanal „anliegen“) → Prüfung, menschNoetig, E-393 →
// anliegenAntwortSpeichern (Anliegen, Akte, Benachrichtigung).
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e406
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-anliegen-db.ts
// Eigene Datensätze (Personen PR-A406-…, Bestellungen FIAON-A406…, Anliegen dazu) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
process.env.CRONS = "aus";
process.env.NODE_ENV = "development";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "META_CAPI_TOKEN", "WHATSAPP_TOKEN", "VAPID_PRIVATE_KEY", "VAPID_PUBLIC_KEY", "ANLIEGEN_TAG_EURO"]) delete process.env[k];

// ── Attrappen VOR jedem Import: nur das Modell antwortet, sonst kein Netz ──
process.env.OPENAI_API_KEY = "sk-pruef-lokal-a406";
process.env.KI_ANBIETER = "openai";
interface Szenario {
  einordnung: Record<string, unknown>;
  antwort: Record<string, unknown>;
  umformuliert?: Record<string, unknown>;
  werkzeuge?: { name: string; args: Record<string, unknown> }[];
  /** Der Antwort-Aufruf scheitert mit „kein Guthaben“ (429 insufficient_quota) — die KI-Pause mitten im Lauf. */
  guthabenLeer?: boolean;
}
let SZ: Szenario | null = null;
const KI: { art: string; alles: string }[] = [];
let fremd = 0;
const jsonAntwort = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const modellText = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    KI.push({ art: einordnen ? "einordnen" : "antwort", alles });
    if (!SZ) return jsonAntwort(500, { error: { message: "Prüfstand: kein Szenario" } });
    if (!einordnen && SZ.guthabenLeer) return jsonAntwort(429, { error: { message: "You exceeded your current quota.", type: "insufficient_quota", code: "insufficient_quota" } });
    let aus: any;
    if (einordnen) aus = modellText(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = modellText(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else if (body.tools && SZ.werkzeuge?.length && !alles.includes("function_call_output")) {
      aus = { output: SZ.werkzeuge.map((w, i) => ({ type: "function_call", call_id: `c${i}`, name: w.name, arguments: JSON.stringify(w.args) })) };
    } else aus = modellText("fertig");
    return jsonAntwort(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  fremd++;
  return new Response(`blockiert: ${u.split("?")[0]}`, { status: 599 });
}) as any;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const kurz = (t: unknown, n = 160) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);
const M = "A406";

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const A = await import("../server/lib/fiaon-mara-anliegen");
  const N = await import("../shared/fiaon-nicht-erreicht-nachfass");
  const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
  await postmeisterSchema();
  await A.anliegenSchema();

  const EIN = ["ki_pause", "mara_anliegen"];
  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIN})`) as any[];
  const setzen = async (k: string, v: string | null) => {
    await sql`DELETE FROM fiaon_settings WHERE key = ${k}`;
    if (v != null) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${k}, ${v})`;
    kp.kiPauseZwischenspeicherLeeren();
  };
  await setzen("ki_pause", null);
  await setzen("mara_anliegen", null);

  async function aufraeumen() {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PR-${M}-%`}`) as any[]).map((r) => Number(r.id));
    const refs = ((await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`) as any[]).map((r) => r.ref);
    if (refs.length) {
      await sql`DELETE FROM fiaon_tickets WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM cancellation_requests WHERE ref = ANY(${refs})`.catch(() => {});
    }
    if (personen.length) {
      await sql`DELETE FROM fiaon_tickets WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen}))`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_vermerke WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${personen})`.catch(() => {});
      await sql`DELETE FROM fiaon_global_angebote WHERE person_id = ANY(${personen})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`.catch(() => {});
    if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_ki_nutzung WHERE dienst = 'mara-anliegen' AND created_at > NOW() - INTERVAL '2 hours'`.catch(() => {});
  }
  await aufraeumen();

  // ── Testkunden (erfunden) ───────────────────────────────────────────────
  type Kunde = { pid: number; ref: string; mail: string };
  async function kunde(x: string, o: { bezahlt?: boolean; test?: boolean; global?: boolean } = {}): Promise<Kunde> {
    const mail = `kunde-${x.toLowerCase()}@a406.invalid`;
    const ref = `FIAON-${M}${x}`;
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, ist_test_am)
      VALUES (${`PR-${M}-${x}`}, 'Tessa', ${`Anliegenprobe${x}`}, ${mail}, ${o.test ? new Date() : null}) RETURNING id`) as any[];
    const bezahlt = o.bezahlt !== false && !o.global;
    await sql`
      INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due, email, first_name, last_name,
                                      person_id, created_at, completed_at, paid_at, current_step, submitted_at, agb_stand, freigeschaltet_am)
      VALUES (${ref}, ${`${M}${x}`.slice(0, 30)}, ${bezahlt ? "paid" : "pending_payment"}, ${bezahlt ? "payment_completed" : "payment_pending"}, 'private',
              'pro', 'FIAON Pro (Standard)', 59.99, ${mail}, 'Tessa', ${`Anliegenprobe${x}`}, ${p.id}, NOW() - INTERVAL '60 days',
              ${bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, ${bezahlt ? new Date(Date.now() - 40 * 86_400_000) : null}, 8, NOW() - INTERVAL '60 days', '2026-10-05',
              ${bezahlt ? new Date(Date.now() - 39 * 86_400_000) : null})`;
    if (o.global) {
      await sql`INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, status, gueltig_bis)
                VALUES (${`FIAON-IA-${M}-${x}`}, ${p.id}, 'pruefstand', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'offen', CURRENT_DATE + 14)`;
    }
    return { pid: Number(p.id), ref, mail };
  }
  /** Ein Anliegen — wie POST /kunde/:ref/tickets (Anliegen + Akte). */
  async function anliegen(k: Kunde, betreff: string, text: string, vorStd = 0.2): Promise<number> {
    const am = new Date(Date.now() - vorStd * 3_600_000);
    const [t] = (await sql`INSERT INTO fiaon_tickets (ref, person_id, agent_id, betreff, text, created_at, updated_at)
      VALUES (${k.ref}, ${k.pid}, NULL, ${betreff}, ${text}, ${am}, ${am}) RETURNING id`) as any[];
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${k.ref}, ${k.pid}, NULL, 'Kunde', 'kunde_anliegen', ${`Anliegen #${t.id}: ${betreff}\n${text}`}, ${am})`;
    return Number(t.id);
  }
  const ticket = async (id: number) => ((await sql`SELECT * FROM fiaon_tickets WHERE id = ${id}`) as any[])[0];
  const antwortLog = async (k: Kunde) => ((await sql`SELECT agent_name, note FROM fiaon_contact_log WHERE ref = ${k.ref} AND type = 'kunde_anliegen_antwort' ORDER BY id`) as any[]);
  // Ein Zeitpunkt sicher im Versandfenster (08–20 Uhr Berlin): jetzt, sonst das nächste 08:00 + 5 Min.
  const imFenster = () => {
    const n = new Date();
    return N.imVersandfenster(n) && N.imVersandfenster(new Date(n.getTime() + 10 * 60_000)) ? n : new Date(N.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };
  const heute22 = () => {
    const tag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    const h12 = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(new Date(`${tag}T12:00:00Z`)));
    return new Date(Date.parse(`${tag}T22:00:00Z`) - (h12 - 12) * 3_600_000);
  };
  /** Ein Takt nur für bestimmte Anliegen: die übrigen (fremde Zeilen der Vorlage) bleiben unberührt. */
  const takt = async (sz: Szenario | null, jetzt: Date = imFenster()) => {
    SZ = sz;
    const vorKi = KI.length;
    const e = await A.anliegenTakt({ jetzt, deckel: 10 });
    return { e, ki: KI.slice(vorKi) };
  };

  // Szenarien des Modells
  const schritt = { art: "erledigt", url: null, text: "" };
  const EIN_FRAGE = { kategorien: ["status_frage"], flags: {}, dringend: false, sprache: "de", fragen: ["Wann kommt meine Karte?"], zusammenfassung: "Kunde fragt nach seiner Karte." };
  const SAUBER: Szenario = {
    einordnung: EIN_FRAGE,
    antwort: { antwort: "Ihr Vorgang ist vollständig, es fehlt nichts von Ihrer Seite. Melden Sie sich gern, wenn Sie Fragen haben.", naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
  };
  const KOPPLUNG = "Ihre Kündigung haben wir erhalten. Sobald die offene Rate bezahlt ist, ist Ihr Vertrag beendet.";
  const E393: Szenario = {
    einordnung: EIN_FRAGE,
    antwort: { antwort: KOPPLUNG, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
    umformuliert: { antwort: KOPPLUNG, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
  };
  const GARANTIE = "Ich garantiere Ihnen, dass Sie Ihre Karte in drei Tagen sicher bekommen.";
  const WAND: Szenario = {
    einordnung: EIN_FRAGE,
    antwort: { antwort: GARANTIE, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
    umformuliert: { antwort: GARANTIE, naechster_schritt: schritt, belege: [], fragen_beantwortet: [], merken: [] },
  };

  try {
    console.log("── 0 · Schema: Maras Spalten an fiaon_tickets, Schalter Standard AN");
    {
      const spalten = ((await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_tickets' AND column_name LIKE ANY(ARRAY['mara_%', 'antwort_knopf', 'beantwortet_durch'])`) as any[]).map((r) => r.column_name).sort();
      ok(["antwort_knopf", "beantwortet_durch", "mara_am", "mara_einordnung", "mara_entwurf", "mara_grund", "mara_heikel", "mara_in_arbeit_seit", "mara_stand", "mara_versuche"].every((s) => spalten.includes(s)), "alle Spalten da", spalten);
      ok(await A.anliegenSchalterLesen() === true, "Schalter fehlt → AN");
    }

    console.log("── 1 · Einfaches Anliegen → Mara antwortet: Antwort gespeichert, Status „beantwortet“, Akte, eigener KI-Dienst");
    const K1 = await kunde("A");
    const t1 = await anliegen(K1, "Meine Karte", "Guten Tag, wann bekomme ich meine Karte? Ich habe alles bezahlt.");
    {
      const r = await takt(SAUBER);
      const z = await ticket(t1);
      if (z.status !== "beantwortet") console.log("     (Weg:", z.mara_stand, "—", kurz(z.mara_grund, 300), ")");
      console.log("     Antwort im Kundenbereich:", JSON.stringify(String(z.antwort ?? "")));
      ok(r.e.beantwortet === 1 && z.status === "beantwortet" && z.beantwortet_durch === "mara" && z.mara_stand === "beantwortet", "Status beantwortet, durch Mara", { e: r.e, status: z.status, stand: z.mara_stand });
      ok(/^Guten Tag/.test(String(z.antwort)) && /Ihr Vorgang ist vollständig/.test(String(z.antwort)) && /Mara Lindner\nDigitale Assistentin · FIAON-Team$/.test(String(z.antwort)), "Antwort: Anrede, Text, Gruß mit Mara und „Digitale Assistentin“", kurz(z.antwort, 220));
      ok(!/&amp;|<br|<p>/.test(String(z.antwort)), "reiner Text (kein HTML)");
      ok(z.beantwortet_am != null && z.beantwortet_von == null, "beantwortet_am gesetzt, kein Mitarbeiter als Absender");
      const log = await antwortLog(K1);
      ok(log.length === 1 && /^Antwort auf Anliegen #\d+ \(Meine Karte\):/.test(log[0].note) && /Mara/.test(String(log[0].agent_name)), "Akte: kunde_anliegen_antwort — wie bei einer Menschen-Antwort", log.map((l) => [l.agent_name, kurz(l.note, 60)]));
      ok(r.ki.filter((k) => k.art === "einordnen").length === 1 && r.ki.some((k) => k.art === "antwort"), "Modell: einmal einordnen, dann antworten", r.ki.map((k) => k.art));
      const auftrag = r.ki.find((k) => k.art === "antwort")?.alles ?? "";
      ok(/DIESE ANTWORT IST KEINE E-MAIL/.test(auftrag) && /NEUES ANLIEGEN \(Kundenbereich/.test(auftrag), "Auftrag: Kanal Anliegen (Kundenbereich, keine Mail)");
      ok(!/\\"name\\":\\"kuendigung_vormerken\\"|"name":"kuendigung_vormerken"/.test(auftrag), "kein Kündigungs-Werkzeug im Werkzeugkasten");
      const nutz = (await sql`SELECT dienst, COUNT(*)::int AS n FROM fiaon_ki_nutzung WHERE created_at > NOW() - INTERVAL '10 minutes' AND dienst IN ('mara-anliegen','postmeister-antwort') GROUP BY 1`) as any[];
      ok(nutz.some((x) => x.dienst === "mara-anliegen" && x.n >= 1) && !nutz.some((x) => x.dienst === "postmeister-antwort"), "KI-Kosten unter „mara-anliegen“ — nicht unter dem Postfach", nutz);
      const merker = await ticket(t1);
      ok(merker.mara_einordnung != null, "Einordnung gemerkt (einmal je Text)");
      const r2 = await takt(SAUBER);
      ok(r2.e.geprueft === 0 && r2.ki.length === 0 && (await antwortLog(K1)).length === 1, "zweiter Takt: nichts mehr zu tun, keine zweite Antwort", r2.e);
    }

    console.log("── 2 · Heikel am Text (Kündigung) → keine Antwort, kein Modell, Hinweis beim Anliegen");
    const K2 = await kunde("B");
    const t2 = await anliegen(K2, "Kündigung", "Hallo. Bitte die Kündigung sofort einleiten!");
    {
      const r = await takt(SAUBER);
      const z = await ticket(t2);
      ok(z.status === "offen" && z.antwort == null && z.mara_stand === "mensch" && z.mara_heikel === "kuendigung", "offen, ohne Antwort, Stand „mensch“, heikel Kündigung", { s: z.status, st: z.mara_stand, h: z.mara_heikel });
      ok(r.ki.length === 0, "kein Modellaufruf (vor jeder KI erkannt)", r.ki.length);
      ok((await antwortLog(K2)).length === 0, "keine Antwort in der Akte");
      ok(/Kündigung/.test(String(z.mara_grund)), "Hinweis nennt den Grund", z.mara_grund);
      const kr = (await sql`SELECT COUNT(*)::int AS n FROM cancellation_requests WHERE ref = ${K2.ref}`.catch(() => [{ n: 0 }])) as any[];
      ok(Number(kr[0]?.n ?? 0) === 0, "keine Kündigung gebucht (das macht ein Mensch)");
      // Ein späteres, harmloses Anliegen desselben Menschen bleibt ebenfalls beim Menschen (er antwortet auf beide).
      const t2b = await anliegen(K2, "Frage", "Und wann kommt eigentlich meine Karte?", 0.1);
      const r2 = await takt(SAUBER);
      const z2 = await ticket(t2b);
      ok(z2.antwort == null && z2.mara_stand === "mensch" && r2.ki.length === 0, "späteres Anliegen bei offener Kündigung → auch beim Menschen", { st: z2.mara_stand, g: z2.mara_grund });
    }

    console.log("── 3 · Heikel erst in der Einordnung (Beschwerde) → keine Antwort, kein Antwort-Modell");
    const K3 = await kunde("C");
    const t3 = await anliegen(K3, "Ihr Service", "Niemand ruft mich zurück, ich warte seit Tagen. So geht das nicht weiter.");
    {
      const r = await takt({ ...SAUBER, einordnung: { ...EIN_FRAGE, kategorien: ["beschwerde"], flags: { beschwerde: true } } });
      const z = await ticket(t3);
      ok(z.antwort == null && z.status === "offen" && z.mara_stand === "mensch" && z.mara_heikel === "beschwerde", "beim Menschen, heikel Beschwerde", { st: z.mara_stand, h: z.mara_heikel });
      ok(r.ki.length === 1 && r.ki[0].art === "einordnen", "nur die Einordnung lief — kein Werkzeug, keine Antwort", r.ki.map((k) => k.art));
    }

    console.log("── 4 · FIAON Global → nichts (kein Modell, keine Zeile)");
    const KG = await kunde("G", { global: true });
    const tg = await anliegen(KG, "Frage", "Wie ist der Stand bei meinem Firmenauftrag?");
    {
      const r = await takt(SAUBER);
      const z = await ticket(tg);
      ok(z.antwort == null && z.status === "offen" && z.mara_stand == null && z.mara_in_arbeit_seit == null && z.mara_am == null, "Takt fasst es nicht an", { st: z.mara_stand });
      ok(r.ki.length === 0, "kein Modellaufruf");
      const d = await A.anliegenBearbeiten(tg, { jetzt: imFenster() });
      const z2 = await ticket(tg);
      ok(d.art === "nie" && z2.mara_stand == null && z2.mara_grund == null && z2.antwort == null, "auch direkt: „nie“, nichts geschrieben", { d, st: z2.mara_stand });
    }

    console.log("── 5 · Testperson → nichts");
    const KT = await kunde("T", { test: true });
    const tt = await anliegen(KT, "Frage", "Wann kommt meine Karte bitte?");
    {
      const r = await takt(SAUBER);
      const z = await ticket(tt);
      ok(z.antwort == null && z.mara_stand == null && r.ki.length === 0, "Takt fasst es nicht an, kein Modell", { st: z.mara_stand, ki: r.ki.length });
      const d = await A.anliegenBearbeiten(tt, { jetzt: imFenster() });
      const z2 = await ticket(tt);
      ok(d.art === "nie" && z2.mara_stand == null && z2.antwort == null, "auch direkt: „nie“, nichts geschrieben", d);
    }

    console.log("── 6 · ROT-PROBE E-393: die Antwort knüpft das Vertragsende an eine Zahlung → nie im Kundenbereich");
    const K6 = await kunde("D");
    const t6 = await anliegen(K6, "Frage zum Vertrag", "Guten Tag, ich habe eine Frage zu meinem Paket und wie es weitergeht.");
    {
      const r = await takt(E393);
      const z = await ticket(t6);
      console.log("     Vorschlag:", JSON.stringify(String(z.mara_entwurf ?? "")), "· Grund:", kurz(z.mara_grund, 200));
      ok(z.antwort == null && z.status === "offen" && z.mara_stand === "entwurf", "keine Antwort beim Kunden — Vorschlag für den Menschen", { st: z.mara_stand, g: kurz(z.mara_grund, 200) });
      ok(r.ki.some((k) => k.art === "antwort"), "das Modell hat geschrieben (die Wand hat gehalten, nicht das Fehlen eines Texts)");
      ok(!String(z.mara_entwurf ?? "").includes("Sobald die offene Rate bezahlt ist, ist Ihr Vertrag beendet"), "der Kopplungssatz steht auch im Vorschlag nicht mehr (Server hat ersetzt)", kurz(z.mara_entwurf, 200));
      ok((await antwortLog(K6)).length === 0, "keine Antwort in der Akte");
    }

    console.log("── 7 · ROT-PROBE Wortwand: „Ich garantiere …“ → nie im Kundenbereich");
    const K7 = await kunde("E");
    const t7 = await anliegen(K7, "Karte", "Wann kommt meine Karte genau?");
    {
      await takt(WAND);
      const z = await ticket(t7);
      ok(z.antwort == null && z.mara_stand === "entwurf" && /garantiere/.test(String(z.mara_entwurf ?? "")), "Vorschlag bleibt beim Menschen, Antwort nicht gespeichert", { st: z.mara_stand, g: kurz(z.mara_grund, 160) });
      const v = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${K7.ref} AND type = 'system' AND note LIKE ${`Mara: Vorschlag zu Anliegen #${t7}%`}`) as any[];
      ok(v.length === 1, "ein Vermerk in der Akte: Vorschlag liegt auf /agent/anliegen", v.map((x) => kurz(x.note, 100)));
    }

    console.log("── 8 · Werkzeug-Wand: das Modell ruft kuendigung_vormerken → läuft im Anliegen nie");
    const K8 = await kunde("F");
    const t8 = await anliegen(K8, "Frage", "Wie lange gilt mein Paket noch?");
    {
      const r = await takt({ ...SAUBER, werkzeuge: [{ name: "kuendigung_vormerken", args: { grund: "Kunde will kündigen", zitat: "Wie lange gilt mein Paket noch?" } }] });
      const z = await ticket(t8);
      const kr = (await sql`SELECT COUNT(*)::int AS n FROM cancellation_requests WHERE ref = ${K8.ref}`.catch(() => [{ n: 0 }])) as any[];
      const app = ((await sql`SELECT status, payment_status FROM fiaon_applications WHERE ref = ${K8.ref}`) as any[])[0];
      ok(Number(kr[0]?.n ?? 0) === 0 && app.status === "payment_completed", "keine Kündigung gebucht, Bestellung unverändert", { kr: kr[0], app });
      const zweite = r.ki.filter((k) => k.art === "antwort").map((k) => k.alles).join(" ");
      ok(/Unbekanntes Werkzeug/.test(zweite), "Rückmeldung ans Modell: „Unbekanntes Werkzeug.“");
      ok(z.status === "beantwortet", "die Antwort selbst geht trotzdem (sauber) raus", { st: z.status, g: kurz(z.mara_grund, 160) });
    }

    console.log("── 9 · KI-Pause: Anliegen warten — und werden danach nachgeholt");
    const K9 = await kunde("H");
    const t9 = await anliegen(K9, "Zahlung", "Guten Tag, wie ist der Stand meiner Bestellung?");
    {
      await setzen("ki_pause", JSON.stringify({ an: true, art: "hand", grund: "Prüfstand", seit: new Date().toISOString(), von: "Prüfstand", verlauf: [] }));
      const r = await takt(SAUBER);
      const z = await ticket(t9);
      ok(r.e.grund === "KI pausiert" && r.ki.length === 0 && z.antwort == null && z.mara_stand == null, "pausiert: nichts angefasst, kein Modell", { e: r.e, st: z.mara_stand });
      const d = await A.anliegenBearbeiten(t9, { jetzt: imFenster() });
      ok(d.art === "warten" && (await ticket(t9)).mara_stand == null, "auch direkt: „warten“ (kein Fehlversuch, keine Zeile)", d);
      await setzen("ki_pause", JSON.stringify({ an: false, art: null, verlauf: [] }));
      const r2 = await takt(SAUBER);
      const z2 = await ticket(t9);
      ok(r2.e.beantwortet >= 1 && z2.status === "beantwortet" && z2.beantwortet_durch === "mara", "nach dem Aktivieren nachgeholt und beantwortet", { e: r2.e, st: z2.status });
    }

    console.log("── 10 · KI-Pause MITTEN im Lauf (kein Guthaben beim Antworten) → zurückgelegt, kein Fehlversuch, später nachgeholt");
    const K10 = await kunde("I");
    const t10 = await anliegen(K10, "Frage", "Wie geht es bei mir weiter?");
    {
      const r = await takt({ ...SAUBER, guthabenLeer: true });
      const z = await ticket(t10);
      ok(z.antwort == null && z.mara_stand == null && Number(z.mara_versuche) === 0 && z.mara_in_arbeit_seit == null, "zurückgelegt: kein Stand, kein Versuch, kein Anspruch", { st: z.mara_stand, v: z.mara_versuche, e: r.e });
      ok(r.e.warten >= 1, "Takt meldet „warten“", r.e);
      kp.kiPauseZwischenspeicherLeeren();
      await setzen("ki_pause", null);
      const r2 = await takt(SAUBER);
      const z2 = await ticket(t10);
      ok(z2.status === "beantwortet" && r2.ki.filter((k) => k.art === "einordnen").length === 0, "nachgeholt — die Einordnung kam aus dem Merker (kein zweites Einordnen)", { st: z2.status, ki: r2.ki.map((k) => k.art) });
    }

    console.log("── 11 · Bündel: zwei offene Anliegen eines Menschen → EINE Antwort, das ältere verweist darauf");
    const K11 = await kunde("J");
    const t11a = await anliegen(K11, "Erste Frage", "Wann geht es weiter mit meinem Antrag?", 3);
    const t11b = await anliegen(K11, "Nachtrag", "Und wie lange dauert es ungefähr?", 0.2);
    {
      const r = await takt(SAUBER);
      const a = await ticket(t11a), b = await ticket(t11b);
      ok(r.ki.filter((k) => k.art === "antwort").length >= 1 && r.ki.filter((k) => k.art === "einordnen").length === 1, "ein Durchgang (eine Einordnung)", r.ki.map((k) => k.art));
      ok(b.status === "beantwortet" && /Ihr Vorgang ist vollständig/.test(String(b.antwort)), "das jüngste trägt die Antwort", kurz(b.antwort, 80));
      ok(a.status === "beantwortet" && /mit beantwortet/.test(String(a.antwort)) && /Nachtrag/.test(String(a.antwort)), "das ältere verweist darauf", kurz(a.antwort, 160));
      ok((await antwortLog(K11)).length === 1, "eine Antwort in der Akte (keine doppelte Benachrichtigung)");
      const auftrag = r.ki.find((k) => k.art === "antwort")?.alles ?? "";
      ok(/Erste Frage/.test(auftrag) && /noch offen/.test(auftrag), "Mara sah das ältere Anliegen im Verlauf");
    }

    console.log("── 11b · Bündel mit Beschwerde im ÄLTEREN Anliegen → beide beim Menschen (die Einordnung sieht alle Texte)");
    const K11b = await kunde("JB");
    const t11c = await anliegen(K11b, "Service", "Ich bin wirklich enttäuscht, niemand meldet sich bei mir.", 3);
    const t11d = await anliegen(K11b, "Karte", "Wann kommt meine Karte?", 0.2);
    {
      const r = await takt(SAUBER);
      const c = await ticket(t11c), d = await ticket(t11d);
      ok(c.antwort == null && d.antwort == null && c.mara_stand === "mensch" && d.mara_stand === "mensch", "keine Antwort — beide beim Menschen", { c: c.mara_stand, d: d.mara_stand, g: kurz(d.mara_grund, 120) });
      ok(r.ki.filter((k) => k.art === "antwort").length === 0, "kein Antwort-Modell");
      ok(/enttäuscht/.test(r.ki.find((k) => k.art === "einordnen")?.alles ?? ""), "die Einordnung sah auch das ältere Anliegen");
    }

    console.log("── 12 · Ein Mensch war schneller → Mara speichert nichts");
    const K12 = await kunde("K");
    const t12 = await anliegen(K12, "Frage", "Wie ist der Stand bitte?");
    {
      const m = await A.anliegenAntwortSpeichern({ id: t12, antwort: "Guten Tag, alles läuft. Freundliche Grüße", von: { agentId: null, agentName: "Prüf Mensch", nennName: "Frau Prüf", durch: "mensch" } });
      ok(!!m, "Menschen-Antwort über dieselbe Stelle gespeichert");
      const d = await A.anliegenBearbeiten(t12, { jetzt: imFenster() });
      const z = await ticket(t12);
      ok(d.art === "weg" && z.beantwortet_durch === "mensch" && /alles läuft/.test(String(z.antwort)), "Mara: „weg“, die Menschen-Antwort bleibt", { d, durch: z.beantwortet_durch });
      const nur = await A.anliegenAntwortSpeichern({ id: t12, antwort: "Mara-Text", nurWennOffen: true, von: { agentId: null, agentName: "Mara", nennName: "Mara", durch: "mara" } });
      ok(nur === null && /alles läuft/.test(String((await ticket(t12)).antwort)), "nurWennOffen überschreibt nie eine vorhandene Antwort");
    }

    console.log("── 13 · Schalter aus, Nacht, Kostendeckel → nichts");
    const K13 = await kunde("L");
    const t13 = await anliegen(K13, "Frage", "Wann kommt meine Karte?");
    {
      await setzen("mara_anliegen", "aus");
      const r = await takt(SAUBER);
      ok(r.e.grund === "Schalter aus" && r.ki.length === 0 && (await ticket(t13)).mara_stand == null, "Schalter aus → nichts", r.e);
      await setzen("mara_anliegen", "an");
      const r2 = await takt(SAUBER, heute22());
      ok(/außerhalb/.test(String(r2.e.grund)) && r2.ki.length === 0 && (await ticket(t13)).mara_stand == null, "22:00 Berlin → nichts (ab 8 Uhr)", r2.e);
      process.env.ANLIEGEN_TAG_EURO = "0";
      const r3 = await takt(SAUBER);
      ok(/Kostendeckel/.test(String(r3.e.grund)) && r3.ki.length === 0 && (await ticket(t13)).mara_stand == null, "Deckel 0 € (Kosten heute > 0) → nichts", r3.e);
      delete process.env.ANLIEGEN_TAG_EURO;
      const st = await A.anliegenStand();
      ok(st.an === true && st.heute >= 3 && st.deckelEuro === 10 && typeof st.kostenHeuteEuro === "number", "Stand fürs Steuerpult: an, heute beantwortet, Deckel 10 €", { an: st.an, heute: st.heute, d: st.deckelEuro });
      ok(st.gruende.some((g) => /Kündigung/.test(g.grund)), "Gründe beim Team: Kündigung", st.gruende);
    }

    console.log("── 14 · Kein Netz außer der Attrappe");
    ok(fremd === 0, `kein Netzaufruf außer den Attrappen (${fremd})`);
  } finally {
    await aufraeumen();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EIN})`.catch(() => {});
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value})`.catch(() => {});
    await sql.end({ timeout: 5 }).catch(() => {});
  }
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  console.log(schlecht ? `✗ ${gut}/${gut + schlecht} Prüfungen bestanden (mit DB)` : `✓ ${gut}/${gut} Prüfungen bestanden (mit DB)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
