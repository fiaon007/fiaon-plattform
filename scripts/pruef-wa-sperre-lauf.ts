// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-253 (28.09.2026): SPERRE, LAUF, DU-FORM DER WHATSAPP-ZENTRALE
//
// Justin (28.09., Screenshot /chef/s/mara → WhatsApp): „Das steht seit 5
// Minuten. Warum? Warum steht da, dass wir nicht schreiben dürfen? JEDER LEAD
// IM SYSTEM HAT UNS SEINE ZUSTIMMUNG GEGEBEN." Geprüft wird, was dahinter lag:
//
//   1  Sperre: EINE Lesart (menschSperre) — Vertriebssperre nur am Kopf, die
//      Wegweiser-Marke einer Dublette zählt nie; Werbesperre, Kündigung und
//      STOPP über die Familie (auch Geschwister und Ketten); eine echte Sperre
//      überlebt das Zusammenführen (echter Merge, zurückgerollt).
//   2  Dieselbe Lesart in der Lead-Strecke (stoppGrund) und in immerSperre.
//   3  „Gekündigt/Vertrag beendet" in SQL (Gruppen) = in JavaScript (Tür).
//   4  Du-Form: Name aus der Akte ist kein „du" (…ğdu, Partikel „du"); echte
//      Du-Form in freiem Text und frei getippten Platzhaltern sperrt weiter.
//   5  Gruppe = Tür: Wer gezählt wird, wird nicht übersprungen.
//   6  Lauf in der Datenbank: normaler Lauf, Stand nach „Neustart" (Speicher
//      leer), Übernahme ohne Doppelversand (Reservierung, Fencing), SIGTERM-
//      Übergabe, Anhalten von jeder Instanz, 409, Tageswechsel, „entfallen".
//   7  Quelltext-Wand und der lesende Wächter (drei Zähler, Soll 0).
//
// Nachtrag nach der Gegenprüfung (E-253, 28.09.2026):
//   1b „Stopp" aus dem Postfach (Postmeister-Merkmal, als JSON-Text und als
//      Objekt) und WhatsApp-„STOPP" an einer Dublette sperren Tür, BASIS und
//      immerSperre — über die ganze Familie.
//   4b Ein Name, der nur ein Funktionswort ist („von"), versteckt keine Regel.
//   6b Tagesplatz: genau ein Weg bekommt ihn (gleichzeitig), ein anderer Weg
//      mitten im Happen → der Lauf sendet nicht noch einmal; der Minutentakt
//      übernimmt nie den eigenen, noch lebenden Lauf; der stille Takt schreibt
//      nur eine Historienzeile, wenn er etwas getan hat.
//
// NUR gegen den lokalen Prüfstand. Kein Netz: jeder fetch geht an eine
// Attrappe (Meta, Make) und wird mitgeschrieben — es geht keine echte WhatsApp
// und keine Mail raus. Eigene Testzeilen (Personen 925301–925389, Nummern
// 49159009925…), am Ende wieder gelöscht.
//
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-wa-sperre-lauf.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require";
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(process.env.DATABASE_URL!)) { console.error("NUR gegen den lokalen Prüfstand!"); process.exit(2); }
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "RESEND_API_KEY", "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}

// ── KEIN NETZ: jede Anfrage geht an die Attrappe ─────────────────────────────
process.env.MAKE_WEBHOOK_URL = "http://make.pruefstand.invalid/hook";
process.env.WHATSAPP_WABA_ID = "pruef-waba";
process.env.WHATSAPP_PHONE_ID = "pruef-nummer";
process.env.META_SYSTEM_TOKEN = "pruef-token";
process.env.META_APP_SECRET = "pruef-geheim";
process.env.META_GRAPH_URL = "http://meta.pruefstand.invalid";

const FREI = ["fiaon_kk_antrag_offen", "fiaon_kk_letzte", "fiaon_kk_anfrage", "fiaon_kk_rate", "fiaon_kk_termin_morgen", "fiaon_kk_tag1"];
const aufrufe: { url: string; methode: string; body: string }[] = [];
/** Jede Vorlage, die bei „Meta" ankam: an welche Nummer, welche Vorlage. */
const metaSendungen: { an: string; vorlage: string }[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url ?? input);
  const methode = String(init?.method ?? "GET");
  const body = typeof init?.body === "string" ? init.body : "";
  aufrufe.push({ url, methode, body });
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
  if (url.startsWith("http://make.pruefstand.invalid")) return new Response("Accepted", { status: 200 });
  if (url.startsWith("http://meta.pruefstand.invalid")) {
    if (url.includes("/message_templates")) return json({ data: FREI.map((name, i) => ({ name, status: "APPROVED", category: "MARKETING", id: String(i + 1), components: [] })) });
    if (url.includes("/messages")) {
      try { const j = JSON.parse(body); metaSendungen.push({ an: String(j.to), vorlage: String(j.template?.name ?? "text") }); } catch { /* */ }
      return json({ messages: [{ id: `wamid.PRUEF253.${aufrufe.length}` }] });
    }
    if (url.includes("pruef-nummer")) return json({ messaging_limit_tier: "TIER_2K", quality_rating: "GREEN", verified_name: "FIAON Prüfstand" });
    return json({});
  }
  throw new Error(`Prüfstand: kein Netz (${url})`);
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const wa = await import("../server/lib/fiaon-whatsapp");
const mf = await import("../server/lib/fiaon-mail-frequenz");
const strecke = await import("../server/lib/fiaon-lead-strecke");
const verkauf = await import("../server/lib/fiaon-auskunft-verkauf");
const z = await import("../server/lib/fiaon-wa-zentrale");
const { personenZusammenfuehren } = await import("../server/lib/fiaon-person-merge");
const { WA_VORLAGEN } = await import("../shared/fiaon-lead-texte");
const { readFileSync } = await import("node:fs");

let ok = 0, fehl = 0;
const pruef = (name: string, bed: boolean, info: unknown = "") => {
  if (bed) { ok++; console.log(`  ✓ ${name}`); }
  else { fehl++; console.log(`  ✗ ${name}${info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const IDS = Array.from({ length: 89 }, (_, i) => 925301 + i);
const NR = (id: number) => `49159009${id}`;
const DOMAIN = "wa-sperre-lauf.invalid";
const M = (id: number) => `p${id}@${DOMAIN}`;
const TAG = 86_400_000;
const vor = (tage: number) => new Date(Date.now() - tage * TAG);
const laufIds: string[] = [];

async function aufraeumen() {
  await sqlPool`DELETE FROM fiaon_wa_aktion WHERE person_id = ANY(${IDS}) OR lauf_id = ANY(${laufIds.length ? laufIds : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_tagesplatz WHERE person_id = ANY(${IDS}) OR schluessel LIKE 'n:49159009925%' OR schluessel LIKE 'p:9253%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'WS253-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_lauf_historie WHERE name LIKE 'pruef_still_e253%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_lauf WHERE id = ANY(${laufIds.length ? laufIds : ["-"]}) OR ausgeloest_von = 'Prüfstand E-253'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${IDS}) OR nummer LIKE '49159009925%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${IDS}) OR ref LIKE 'WS253-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_leads WHERE person_id = ANY(${IDS}) OR email LIKE ${"%@" + DOMAIN}`;
  await sqlPool`DELETE FROM fiaon_applications WHERE person_id = ANY(${IDS}) OR ref LIKE 'WS253-%'`;
  await sqlPool`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${IDS})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_sperr_protokoll WHERE person_id = ANY(${IDS})`.catch(() => {});
  await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = NULL WHERE id = ANY(${IDS})`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${IDS})`;
}

async function person(id: number, o: { vor?: string; nach?: string; blocked?: boolean; werbesperre?: boolean; test?: boolean; merged?: number; telefon?: boolean } = {}) {
  const nr = o.telefon === false ? null : NR(id);
  await sqlPool`
    INSERT INTO fiaon_persons (id, person_ref, first_name, last_name, primary_email, primary_phone, phone_key9, country,
                               werbung_gesperrt_am, ist_test_am, is_blocked, merged_into_person_id, created_at, updated_at)
    VALUES (${id}, ${`WS253-P${id}`}, ${o.vor ?? "Test"}, ${o.nach ?? `Sperre${id}`}, ${M(id)}, ${nr ? `+${nr}` : null}, ${nr ? nr.slice(-9) : null}, 'DE',
            ${o.werbesperre ? vor(1) : null}, ${o.test ? vor(1) : null}, ${!!o.blocked}, ${o.merged ?? null}, ${vor(10)}, ${vor(10)})`;
}
async function antrag(ref: string, personId: number, o: {
  status?: string; zahlung?: string; schritt?: number; angelegt: Date; gekuendigt?: Date | null; ende?: Date | null; paket?: string;
}) {
  await sqlPool`
    INSERT INTO fiaon_applications (ref, payment_reference, type, status, current_step, pack_key, pack_name, first_name, last_name, email, country, person_id,
                                    payment_status, amount_due, gekuendigt_am, vertrag_ende_am, paid_at, created_at, updated_at)
    VALUES (${ref}, ${ref.replace(/-/g, "")}, 'privat', ${o.status ?? "started"}, ${o.schritt ?? 2}, ${o.paket ?? "pro"}, 'FIAON Pro (Standard)', 'Test', ${`Sperre${personId}`},
            ${M(personId)}, 'DE', ${personId}, ${o.zahlung ?? "pending"}, 59.99, ${o.gekuendigt ?? null}, ${o.ende ?? null},
            ${o.zahlung === "paid" ? o.angelegt : null}, ${o.angelegt}, ${o.angelegt})`;
}
async function lead(personId: number | null, email: string): Promise<number> {
  const [l] = (await sqlPool`
    INSERT INTO fiaon_leads (person_id, email, vorname, nachname, erstellt_am)
    VALUES (${personId}, ${email}, 'Test', 'Sperre', ${vor(2)}) RETURNING id`) as any[];
  return Number(l.id);
}
/** Eine Antwort ans Postfach, die der Postmeister mit „stopp" markiert hat — als JSON-Text (so steht es meist) oder als Objekt. */
async function postfachStopp(personId: number, form: "text" | "objekt") {
  const json = JSON.stringify({ kuendigung: false, stopp: true });
  await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, kategorie, aktion, flags, empfangen_am)
    VALUES ('pruefstand', ${`WS253-G${personId}`}, ${`WS253-T${personId}`}, ${personId}, 'abmeldung', 'erledigt',
            CASE WHEN ${form} = 'text' THEN to_jsonb(${json}::text) ELSE (${json}::text)::jsonb END, ${vor(5)})`;
}
/** Warten, bis der Lauf nicht mehr läuft (höchstens `ms`). */
async function bisFertig(id: string, ms = 20_000) {
  const bis = Date.now() + ms;
  let s = await z.laufStand(id);
  while (s?.laeuft && Date.now() < bis) { await warte(100); s = await z.laufStand(id); }
  return s;
}
async function zeilenJePerson(laufId: string): Promise<Map<number, { n: number; gruende: string[] }>> {
  const rows = (await sqlPool`SELECT person_id, ok, grund FROM fiaon_wa_aktion WHERE lauf_id = ${laufId}`) as any[];
  const m = new Map<number, { n: number; gruende: string[] }>();
  for (const r of rows) {
    const e = m.get(Number(r.person_id)) ?? { n: 0, gruende: [] };
    e.n++; e.gruende.push(r.ok ? "ok" : String(r.grund));
    m.set(Number(r.person_id), e);
  }
  return m;
}
const sendungenAn = (id: number) => metaSendungen.filter((s) => s.an === NR(id)).length;

try {
  await aufraeumen();
  await z.zentraleSchema();

  // ── Menschen ────────────────────────────────────────────────────────────
  // 1: Kopf frei + Dublette nur mit Marke (der Fall aus dem Screenshot)
  await person(925301); await person(925302, { blocked: true, merged: 925301 });
  // 2: Kopf selbst gesperrt + Dublette mit Marke
  await person(925303, { blocked: true }); await person(925304, { blocked: true, merged: 925303 });
  // 3: Kopf frei + Dublette mit Werbesperre
  await person(925305); await person(925306, { blocked: true, werbesperre: true, merged: 925305 });
  // 4: Kette L → M → Kopf, nur Marken
  await person(925309); await person(925308, { blocked: true, merged: 925309 }); await person(925307, { blocked: true, merged: 925308 });
  // 5: Geschwister-Dubletten: A mit Werbesperre, B nur Marke
  await person(925311); await person(925312, { blocked: true, werbesperre: true, merged: 925311 }); await person(925313, { blocked: true, merged: 925311 });
  // 6: gekündigt (bezahltes Paket, Kündigung ohne neuen Antrag)
  await person(925315); await antrag("WS253-G1", 925315, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(40), gekuendigt: vor(2) });
  // 7: echter Merge — der Verlierer hat „kein Interesse" (echte Sperre), der Gewinner nicht
  await person(925317, { blocked: true }); await person(925318);
  // 8: Kette L2 → M2 → Kopf, Werbesperre ganz unten
  await person(925319); await person(925320, { blocked: true, merged: 925319 }); await person(925321, { blocked: true, werbesperre: true, merged: 925320 });
  // 9 (Nachtrag): Stopp aus dem Postfach am Kopf (flags als JSON-Text in jsonb, wie in der Produktion)
  await person(925314); await postfachStopp(925314, "text");
  // 10 (Nachtrag): Stopp aus dem Postfach an der Dublette (flags als Objekt), Kopf frei
  await person(925316); await person(925329, { blocked: true, merged: 925316 }); await postfachStopp(925329, "objekt");
  // 11 (Nachtrag): WhatsApp-„STOPP" an der Dublette (fiaon_whatsapp wird beim Merge nicht umgehängt)
  await person(925338); await person(925339, { blocked: true, merged: 925338 });
  await sqlPool`INSERT INTO fiaon_whatsapp (nummer, richtung, person_id, typ, text, status, empfangen_am, created_at)
                VALUES (${NR(925339)}, 'rein', 925339, 'text', 'STOPP', 'empfangen', ${vor(4)}, ${vor(4)})`;

  // ═══════════════════════════════════════════════════════════════════════
  titel("1. Die Tür (waVorlagenSperre) — eine Lesart über menschSperre");
  const tuer = (id: number, vorlage = "fiaon_kk_letzte") => wa.waVorlagenSperre(vorlage, NR(id), { personId: id });
  const p302 = await mf.personSperre(925302);
  pruef("(Falle) Die Dublette trägt die Wegweiser-Marke is_blocked", p302?.vertriebssperre === true, p302);
  pruef("Kopf frei, Dublette nur Marke → werbliche Vorlage geht (der Fall aus dem Screenshot)", (await tuer(925301)) === null, await tuer(925301));
  pruef("… auch beim Aufruf mit der Dubletten-ID", (await tuer(925302)) === null, await tuer(925302));
  const m302 = await mf.menschSperre(925302);
  pruef("menschSperre(Dublette) = der Kopf, ohne Vertriebssperre", m302?.personId === 925301 && m302.vertriebssperre === false, m302);
  pruef("Kopf selbst gesperrt → „Vertriebssperre\"", /^Vertriebssperre/.test(String(await tuer(925303))), await tuer(925303));
  pruef("… auch über seine Dublette", /^Vertriebssperre/.test(String(await tuer(925304))), await tuer(925304));
  pruef("Werbesperre an der Dublette → „Werbesperre\" (Kopf)", /^Werbesperre/.test(String(await tuer(925305))), await tuer(925305));
  pruef("… und über die Dublette selbst", /^Werbesperre/.test(String(await tuer(925306))), await tuer(925306));
  pruef("Kette L→M→Kopf nur mit Marken → frei (vom Kopf)", (await tuer(925309)) === null, await tuer(925309));
  pruef("… und vom untersten Glied", (await tuer(925307)) === null, await tuer(925307));
  pruef("menschSperre folgt der Kette bis zum Kopf", (await mf.menschSperre(925307))?.personId === 925309);
  pruef("Kette mit Werbesperre ganz unten → gesperrt (vom Kopf)", /^Werbesperre/.test(String(await tuer(925319))), await tuer(925319));
  pruef("Geschwister: Werbesperre an Dublette A sperrt auch über Dublette B", /^Werbesperre/.test(String(await tuer(925313))), await tuer(925313));
  pruef("Gekündigt ohne laufendes Paket → „gekündigt oder Vertrag beendet\"", /gekündigt/.test(String(await tuer(925315))), await tuer(925315));
  pruef("Service-Vorlage (Monatsrate) an Vertriebssperre → erlaubt", (await tuer(925303, "fiaon_kk_rate")) === null);
  // Nachtrag nach der Gegenprüfung: das Stopp aus dem Postfach und das „STOPP" an einer Dublette
  const [pmForm] = (await sqlPool`SELECT flags::text AS t FROM fiaon_postmeister WHERE person_id = 925314`) as any[];
  const [pmObj] = (await sqlPool`SELECT flags::text AS t FROM fiaon_postmeister WHERE person_id = 925329`) as any[];
  pruef("(Voraussetzung) Postfach-Merkmal einmal als JSON-Text in jsonb (wie in der Produktion), einmal als Objekt",
    /^"\{\\"kuendigung\\":false,\\"stopp\\":true\}"$/.test(String(pmForm?.t)) && /^\{"stopp": true, "kuendigung": false\}$/.test(String(pmObj?.t)), [pmForm, pmObj]);
  pruef("Postfach-Stopp am Kopf → „Stopp\" an der Tür", /^„Stopp“/.test(String(await tuer(925314))), await tuer(925314));
  pruef("menschSperre kennt das Postfach-Stopp (Feld stopp)", (await mf.menschSperre(925314))?.stopp === true);
  pruef("Postfach-Stopp an der Dublette (Objekt-Form) → Kopf gesperrt", /^„Stopp“/.test(String(await tuer(925316))), await tuer(925316));
  pruef("WhatsApp-„STOPP\" an der Dublette → Kopf gesperrt (vorher sah es nur immerSperre)", /^„Stopp“/.test(String(await tuer(925338))), await tuer(925338));
  pruef("… auch beim Aufruf mit der Dubletten-ID", /^„Stopp“/.test(String(await tuer(925339))), await tuer(925339));
  pruef("Stopp sperrt keine Service-Vorlage (Monatsrate)", (await tuer(925314, "fiaon_kk_rate")) === null);
  pruef("personSperre (eine Person, Mail-Weg) bleibt ohne Stopp-Feld", (await mf.personSperre(925314))?.stopp === undefined);
  // Die echte Sperre des Verlierers überlebt das Zusammenführen (ODER in fiaon-person-merge.ts) — zurückgerollt.
  class Zurueck extends Error {}
  try {
    await sqlPool.begin(async (tx: any) => {
      await personenZusammenfuehren(925317, 925318, {}, { name: "Prüfstand E-253" }, { tx });
      const k = await mf.menschSperre(925318, tx);
      pruef("Echter Merge: Sperre des Verlierers steht am Gewinner (ODER) → Vertriebssperre", k?.vertriebssperre === true, k);
      const t1 = await wa.waVorlagenSperre("fiaon_kk_letzte", NR(925318), { personId: 925318 }, tx);
      const t2 = await wa.waVorlagenSperre("fiaon_kk_letzte", NR(925317), { personId: 925317 }, tx);
      pruef("… die Tür sperrt über Gewinner UND Verlierer", /^Vertriebssperre/.test(String(t1)) && /^Vertriebssperre/.test(String(t2)), { t1, t2 });
      throw new Zurueck();
    });
  } catch (e) { if (!(e instanceof Zurueck)) { pruef("Echter Merge lief", false, String((e as Error)?.message || e)); } }
  const [nachMerge] = (await sqlPool`SELECT merged_into_person_id AS m FROM fiaon_persons WHERE id = 925317`) as any[];
  pruef("Merge zurückgerollt", nachMerge?.m == null, nachMerge);

  // ═══════════════════════════════════════════════════════════════════════
  titel("2. Dieselbe Lesart in Lead-Strecke und immerSperre");
  const L = {
    kopfFrei: await lead(925301, M(925301)), kopfGesperrt: await lead(925303, M(925303)), werbesperreDublette: await lead(925305, M(925305)),
    anDubletteDerKette: await lead(925307, "kette@" + DOMAIN), ketteWerbesperre: await lead(925321, "kette2@" + DOMAIN),
  };
  const g = async (id: number) => (await strecke.stoppGrund(id)).stopp;
  pruef("stoppGrund: Kopf frei, Dublette mit Marke → läuft (kein dauerhafter „hand\"-Stopp)", (await g(L.kopfFrei)) === null, await g(L.kopfFrei));
  pruef("stoppGrund: Kopf gesperrt → „hand\"", (await g(L.kopfGesperrt)) === "hand", await g(L.kopfGesperrt));
  pruef("stoppGrund: Werbesperre an der Dublette → „werbesperre\"", (await g(L.werbesperreDublette)) === "werbesperre", await g(L.werbesperreDublette));
  pruef("stoppGrund: Lead an einer Dublette der Kette (nur Marken) → läuft", (await g(L.anDubletteDerKette)) === null, await g(L.anDubletteDerKette));
  pruef("stoppGrund: Werbesperre zwei Ebenen tief → „werbesperre\"", (await g(L.ketteWerbesperre)) === "werbesperre", await g(L.ketteWerbesperre));
  const is = (id: number) => verkauf.immerSperre(id);
  pruef("immerSperre: Kopf frei / Dublette mit Marke → frei", (await is(925301)) === null && (await is(925302)) === null, [await is(925301), await is(925302)]);
  pruef("immerSperre: Kopf gesperrt, auch über die Dublette → Vertriebssperre", /^Vertriebssperre/.test(String(await is(925303))) && /^Vertriebssperre/.test(String(await is(925304))));
  pruef("immerSperre: Geschwister-Dublette → Werbesperre (vorher nicht gesehen)", /Werbesperre/.test(String(await is(925313))), await is(925313));
  pruef("immerSperre: Werbesperre zwei Ebenen tief, vom Kopf → Werbesperre (vorher nicht gesehen)", /Werbesperre/.test(String(await is(925319))), await is(925319));
  pruef("immerSperre: Kette nur mit Marken → frei", (await is(925307)) === null && (await is(925309)) === null);
  await sqlPool`INSERT INTO fiaon_whatsapp (nummer, richtung, person_id, typ, text, status, empfangen_am, created_at)
                VALUES (${NR(925302)}, 'rein', 925302, 'text', 'STOPP', 'empfangen', ${vor(3)}, ${vor(3)})`;
  pruef("immerSperre: „STOPP\" an der Dublette sperrt den Menschen", /STOPP/.test(String(await is(925301))), await is(925301));
  pruef("Tür: „STOPP\" an der Dublette sperrt auch die werbliche Vorlage", /^„Stopp“/.test(String(await tuer(925301))), await tuer(925301));
  pruef("immerSperre: Postfach-Stopp am Kopf → Sperre", /Postfach/.test(String(await is(925314))), await is(925314));
  pruef("immerSperre: Postfach-Stopp an der Dublette → Sperre (vom Kopf)", /Postfach/.test(String(await is(925316))), await is(925316));
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE person_id = 925302`;

  // ═══════════════════════════════════════════════════════════════════════
  titel("3. „Gekündigt oder Vertrag beendet\" — SQL (Gruppen) = JavaScript (Tür)");
  await person(925322); // gekündigt, danach neu beantragt → neues Interesse
  await antrag("WS253-K2a", 925322, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(40), gekuendigt: vor(20) });
  await antrag("WS253-K2b", 925322, { angelegt: vor(5) });
  await person(925323); // Vertragsende erreicht, nichts läuft
  await antrag("WS253-K3", 925323, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(400), ende: vor(10) });
  await person(925324); // läuft ungekündigt + ein anderer Antrag gekündigt
  await antrag("WS253-K4a", 925324, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(60) });
  await antrag("WS253-K4b", 925324, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(90), gekuendigt: vor(30) });
  await person(925325); // ohne Antrag
  await person(925326); // läuft, aber selbst gekündigt (bis zum Ende)
  await antrag("WS253-K6", 925326, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(50), gekuendigt: vor(3), ende: new Date(Date.now() + 200 * TAG) });
  await person(925327); // Ende erreicht, danach neu beantragt
  await antrag("WS253-K7a", 925327, { status: "submitted", schritt: 8, zahlung: "paid", angelegt: vor(400), ende: vor(30) });
  await antrag("WS253-K7b", 925327, { angelegt: vor(4) });
  for (const id of [925315, 925322, 925323, 925324, 925325, 925326, 925327]) {
    const s = await mf.menschSperre(id);
    const js = !!s && !s.laufendUngekuendigt && (s.gekuendigt || s.vertragVorbei);
    const [r] = (await sqlPool.unsafe(`SELECT ${mf.OHNE_VERTRAG_SQL("$1::int")} AS x`, [id])) as any[];
    pruef(`Person ${id}: SQL ${!!r?.x} = JS ${js}`, !!r?.x === js, { sql: r?.x, js, s });
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("4. Du-Form: ein Name aus der Akte ist kein „du\"");
  const P = wa.sendePruefung;
  const du = (f: string[]) => f.some((x) => /Du-Form/.test(x));
  pruef("„…ğdu\" im Nachnamen → keine Du-Form (Unicode-Grenze, auch ohne Namen)", !du(P("Hallo Ahmet Probeoğdu, Sie waren fast durch.")), P("Hallo Ahmet Probeoğdu, Sie waren fast durch."));
  pruef("Partikel „du\" im Nachnamen OHNE Namen → Du-Form (so war es)", du(P("Hallo Marie du Pruef, Sie waren fast durch.")));
  const namen = ["Marie", "du Pruef", "Marie du Pruef"];
  pruef("Partikel „du\" MIT den Namen aus der Akte → frei", P("Hallo Marie du Pruef, Sie waren fast durch.", { namen }).length === 0, P("Hallo Marie du Pruef, Sie waren fast durch.", { namen }));
  pruef("Echtes „du\" neben dem maskierten Namen → Du-Form", du(P("Hallo Marie du Pruef, kannst du mir kurz schreiben?", { namen })));
  pruef("„Du bekommst morgen Post.\" → Du-Form", du(P("Du bekommst morgen Post.")));
  pruef("„deinen Ausweis\" → Du-Form (fehlte bisher)", du(P("Bitte lade deinen Ausweis hoch.")));
  pruef("„euer Antrag\" → Du-Form (fehlte bisher)", du(P("Euer Antrag ist da.")));
  pruef("Französisch „du soutien\" bleibt frei (E-230)", P("Merci, vous recevrez du soutien pour votre demande.").length === 0, P("Merci, vous recevrez du soutien pour votre demande."));
  pruef("Nachname „Mahnke\" ohne Namen → Inkasso-Wand", P("Hallo Tina Mahnke, Ihr Antrag ist da.").some((f) => /Mahnung/.test(f)));
  pruef("Nachname „Mahnke\" mit Namen → frei", P("Hallo Tina Mahnke, Ihr Antrag ist da.", { namen: ["Tina", "Mahnke"] }).length === 0);
  pruef("Ein Name, der nur „Du\" ist, wird nie maskiert (sonst verschwände ein echtes „du\")", du(P("Hallo Du, schön dich zu lesen.", { namen: ["Du"] })));
  // Nachtrag nach der Gegenprüfung: Ein Name aus Funktionswörtern versteckt keine Regel (Vorname exakt „von" in der Produktion).
  const frist = "Guten Tag, wir melden uns innerhalb von 24 Stunden bei Ihnen.";
  pruef("Vorname „von\" + „innerhalb von 24 Stunden\" → bleibt verboten (Frist-Regel)",
    P(frist, { namen: ["von", "Probe", "von Probe"] }).some((f) => /Verbotenes Wort/.test(f)), P(frist, { namen: ["von", "Probe", "von Probe"] }));
  pruef("… „von Probe\" als Ganzes wird weiter maskiert", wa.namenMaskieren("Hallo von Probe, schön.", ["von", "von Probe"]) === "Hallo Muster, schön.");
  pruef("Namen unter drei Buchstaben und reine Partikel („de la\") werden nie maskiert",
    wa.namenMaskieren("Li de la Tour", ["Li", "de la"]) === "Li de la Tour");
  pruef("Länger als 1.024 Zeichen bleibt ein Befund (am echten Text)", P(`Hallo ${"Muster ".repeat(200)}`, { namen: ["Muster"] }).some((f) => /1\.024/.test(f)));
  const antragOffen = WA_VORLAGEN.find((v) => v.name === "fiaon_kk_antrag_offen")!;
  pruef("Vorlage fiaon_kk_antrag_offen mit „…ğdu\" → frei", wa.vorlageWandFunde(antragOffen.text, ["Ahmet Probeoğdu"]).length === 0);
  pruef("Vorlage mit Partikel-Namen + Namen aus der Akte → frei", wa.vorlageWandFunde(antragOffen.text, ["Marie du Pruef"], { namen }).length === 0);
  pruef("Vorlage mit frei getipptem {{1}} = „du\" (nicht aus der Akte) → Du-Form", du(wa.vorlageWandFunde(antragOffen.text, ["du"], { namen })));
  pruef("Platzhalter mit KI-Wert „dir fehlt noch …\" → Du-Form", du(wa.vorlageWandFunde("Hallo {{1}}, {{2}}", ["Maria Muster", "dir fehlt noch der Ausweis"])));
  pruef("Inkasso-Ausnahme gilt nur, wo sie benannt ist", wa.vorlageWandFunde("Hallo {{1}}, die Mahnung", ["Maria Muster"], { inkassoOk: true }).length === 0
    && wa.vorlageWandFunde("Hallo {{1}}, die Mahnung", ["Maria Muster"]).length === 1);
  // Der echte Sendeweg (Attrappe): Namen kommen aus der Akte (empfaengerNamen).
  await person(925328, { vor: "Marie", nach: "du Pruef" });
  pruef("empfaengerNamen liest Vor-, Nach- und vollen Namen", (await wa.empfaengerNamen({ personId: 925328 })).includes("Marie du Pruef"));
  const vorher = metaSendungen.length;
  const w1 = await wa.waSenden(NR(925328), { vorlage: "fiaon_kk_letzte", werte: ["Marie du Pruef"] }, { personId: 925328 });
  pruef("waSenden: Vorlage an „Marie du Pruef\" geht raus (Attrappe)", w1.ok && metaSendungen.length === vorher + 1, w1);
  await sqlPool`INSERT INTO fiaon_whatsapp (nummer, richtung, person_id, typ, text, status, empfangen_am, created_at)
                VALUES (${NR(925328)}, 'rein', 925328, 'text', 'Hallo?', 'empfangen', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes')`;
  const w2 = await wa.waSenden(NR(925328), { text: "Hallo Marie du Pruef, kannst du mir kurz schreiben?" }, { personId: 925328 });
  pruef("waSenden: freier Text mit echtem „du\" → Du-Form, nichts an Meta", !w2.ok && /Du-Form/.test(String(w2.grund)) && metaSendungen.length === vorher + 1, w2);
  const w3 = await wa.waSenden(NR(925328), { text: "Guten Tag Marie du Pruef, Ihre Karte ist unterwegs." }, { personId: 925328 });
  pruef("waSenden: freier Text mit dem Namen, gesiezt → geht", w3.ok, w3);

  // ═══════════════════════════════════════════════════════════════════════
  titel("5. Gruppe = Tür: wer gezählt wird, wird nicht übersprungen");
  const abbruch = async (id: number) => antrag(`WS253-A${id}`, id, { angelegt: vor(3) });
  await person(925330); await abbruch(925330);                                                   // frei
  await person(925331); await person(925332, { blocked: true, merged: 925331 }); await abbruch(925331); // Marke an der Dublette
  await person(925333); await person(925334, { blocked: true, werbesperre: true, merged: 925333 }); await abbruch(925333); // Werbesperre an der Dublette
  await person(925335);                                                                          // gekündigt (unbezahlt), kein neuer Antrag danach
  await antrag("WS253-A925335", 925335, { angelegt: vor(10) });
  await antrag("WS253-B925335", 925335, { angelegt: vor(20), gekuendigt: vor(5) });
  await person(925336, { vor: "Lea", nach: "du Probe" }); await abbruch(925336);                  // Partikel „du" (Du-Fehlalarm)
  await person(925337, { blocked: true }); await abbruch(925337);                                  // selbst gesperrt
  await abbruch(925314); await abbruch(925316); await abbruch(925338);                             // Nachtrag: Postfach-Stopp (Kopf/Dublette), WA-STOPP an Dublette
  const gruppe = await z.kandidatenIds("abbrecher", 500);
  const soll = [925330, 925331, 925336];
  pruef("Abbrecher-Gruppe = genau die drei, die senden dürfen", gruppe.length === 3 && soll.every((x) => gruppe.includes(x)), gruppe);
  pruef("… die Marke an der Dublette schließt NICHT aus", gruppe.includes(925331));
  pruef("… Werbesperre an der Dublette, Kündigung, eigene Sperre schließen aus", ![925333, 925335, 925337].some((x) => gruppe.includes(x)), gruppe);
  pruef("… Postfach-Stopp (Kopf und Dublette) und WhatsApp-„STOPP\" an der Dublette schließen aus (BASIS)",
    ![925314, 925316, 925338].some((x) => gruppe.includes(x)), gruppe);
  pruef("Gruppenzahl stimmt mit der Liste", (await z.gruppenZahlen()).abbrecher === 3);
  let alleTuerFrei = true;
  for (const gg of z.GRUPPEN_REIHE) {
    if (gg === "rate_offen") continue;
    for (const id of await z.kandidatenIds(gg, 500)) {
      const t = await wa.waVorlagenSperre("fiaon_kk_letzte", NR(id), { personId: id });
      if (t) { alleTuerFrei = false; console.log(`    Tür sagt nein: Gruppe ${gg}, Person ${id}: ${t}`); }
    }
  }
  pruef("Für JEDEN Kandidaten jeder werblichen Gruppe sagt die Tür ja", alleTuerFrei);

  // ═══════════════════════════════════════════════════════════════════════
  titel("6. Der Lauf steht in der Datenbank");
  if (!z.tagsueber()) {
    console.log("  (Ruhezeit 21–7 Uhr: Die Lauf-Prüfungen brauchen den Tag — bitte zwischen 7 und 21 Uhr laufen lassen.)");
    fehl++;
  } else {
    z.laufPruefstand({ instanz: "pruef:A", pauseMs: 20, herunterfahren: false, huelle: null, happen: 25 });
    const start = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    pruef("Lauf startet, die erste Antwort nennt schon die Gesamtzahl (3)", start.ok && start.lauf.gesamt === 3, start);
    if (start.ok) {
      laufIds.push(start.lauf.id);
      const s = await bisFertig(start.lauf.id);
      const zeilen = await zeilenJePerson(start.lauf.id);
      pruef("Normaler Lauf: fertig, 3 gesendet, 0 übersprungen", s?.zustand === "fertig" && s.gesendet === 3 && s.uebersprungen === 0 && s.erledigt === 3, s);
      pruef("… keine Zeile „Vertriebssperre\" oder „Du-Form\"", Array.from(zeilen.values()).every((e) => e.gruende.every((x) => x === "ok")), Array.from(zeilen.entries()));
      pruef("… jede Person genau einmal bei Meta", soll.every((id) => sendungenAn(id) === 1), soll.map(sendungenAn));
      const ohneId = await z.laufStand();
      pruef("laufStand() ohne id liefert diesen Lauf (jüngster der letzten 12 h)", ohneId?.id === start.lauf.id && ohneId.zustand === "fertig");
      z.laufPruefstand({ instanz: "pruef:neustart" }); // neuer „Server": anderer Name, leerer Speicher
      const nachNeustart = await z.laufStand(start.lauf.id);
      pruef("Nach einem „Neustart\" (Speicher leer) liefert /lauf?id= den Endstand aus der DB", nachNeustart?.zustand === "fertig" && nachNeustart.gesendet === 3 && nachNeustart.laeuft === false, nachNeustart);
      const leer = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
      pruef("Zweiter Start derselben Gruppe: heute niemand mehr dran (ein Versuch je Person und Tag)", !leer.ok && /niemand dran/.test(leer.grund), leer);
    }

    // ── Übernahme ohne Doppelversand ──────────────────────────────────────
    const neuePersonen = async (ab: number, n: number) => {
      const ids = Array.from({ length: n }, (_, i) => ab + i);
      for (const id of ids) { await person(id); await abbruch(id); }
      return ids;
    };
    const crash = await neuePersonen(925340, 6);
    const aufrufeJe = new Map<string, number>();
    let tor: (() => void) | null = null;
    let totAntwort = false;
    let hängtBei: number | null = null;
    z.laufPruefstand({
      instanz: "pruef:A", huelle: (echt) => {
        const wer = `huelle${aufrufeJe.size}`;
        aufrufeJe.set(wer, 0);
        return async (gr, v, k, q, id, von, frei) => {
          aufrufeJe.set(wer, (aufrufeJe.get(wer) ?? 0) + 1);
          if (wer === "huelle0" && k.personId === crash[2]) {
            hängtBei = k.personId;
            await new Promise<void>((r) => { tor = r; });              // der alte Prozess hängt mitten im Senden …
            if (totAntwort) return { ok: false, grund: "Prüfstand: alter Prozess" }; // … und wacht nach der Übernahme auf
          }
          return echt(gr, v, k, q, id, von, frei);
        };
      },
    });
    const c = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (c.ok) {
      laufIds.push(c.lauf.id);
      for (let i = 0; i < 100 && hängtBei == null; i++) await warte(50);
      pruef("(Voraussetzung) Der alte Prozess hängt beim dritten Menschen", hängtBei === crash[2], hängtBei);
      z.laufPruefstand({ instanz: "pruef:B", huelle: null });
      const frisch = await z.laufFortsetzen();
      pruef("Frischer Herzschlag: eine andere Instanz übernimmt NICHT", frisch.id === null, frisch);
      // E-253 (Nachtrag): HERZSCHLAG_ALT_S ist 180 s — 200 s alt gilt als tot.
      await sqlPool`UPDATE fiaon_wa_lauf SET herzschlag = NOW() - INTERVAL '200 seconds' WHERE id = ${c.lauf.id}`;
      const zwei = await Promise.all([z.laufFortsetzen(), z.laufFortsetzen()]);
      pruef("Zwei gleichzeitige Übernahmen: genau eine gewinnt", zwei.filter((x) => x.id === c.lauf.id).length === 1, zwei);
      const s = await bisFertig(c.lauf.id);
      const zeilen = await zeilenJePerson(c.lauf.id);
      pruef("Übernommen und fertig, einmal fortgesetzt", s?.zustand === "fertig" && s.fortsetzungen === 1 && s.erledigt === 6, s);
      pruef("Jede Person hat GENAU EINE Zeile in diesem Lauf", crash.every((id) => zeilen.get(id)?.n === 1), Array.from(zeilen.entries()));
      pruef("Die Person mitten im Senden: „Neustart während des Sendens\", kein zweiter Versuch",
        /^Neustart während des Sendens/.test(String(zeilen.get(crash[2])?.gruende[0])) && sendungenAn(crash[2]) === 0, zeilen.get(crash[2]));
      pruef("Kein Mensch bekam zwei Nachrichten", crash.every((id) => sendungenAn(id) <= 1), crash.map(sendungenAn));
      // Fencing: Der alte Prozess wacht auf — sein nächstes UPDATE findet 0 Zeilen, er hört auf.
      const vorherAufrufe = aufrufeJe.get("huelle0") ?? 0;
      const vorherSend = metaSendungen.length;
      const vorherZeilen = Array.from((await zeilenJePerson(c.lauf.id)).values()).reduce((a, e) => a + e.n, 0);
      totAntwort = true; tor?.();
      await warte(500);
      const nachZeilen = Array.from((await zeilenJePerson(c.lauf.id)).values()).reduce((a, e) => a + e.n, 0);
      pruef("Fencing: Der aufgewachte alte Prozess sendet nichts mehr und schreibt nichts mehr",
        (aufrufeJe.get("huelle0") ?? 0) === vorherAufrufe && metaSendungen.length === vorherSend && nachZeilen === vorherZeilen,
        { aufrufe: aufrufeJe.get("huelle0"), vorherAufrufe, zeilen: [vorherZeilen, nachZeilen] });
    } else pruef("Übernahme-Lauf startet", false, c);

    // ── SIGTERM: übergeben, dann sofort fortsetzen ─────────────────────────
    const sig = await neuePersonen(925350, 4);
    let gesendetSig = 0;
    z.laufPruefstand({ instanz: "pruef:C", herunterfahren: false, huelle: (echt) => async (...a) => { await warte(150); const r = await echt(...a); gesendetSig++; return r; } });
    const d = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (d.ok) {
      laufIds.push(d.lauf.id);
      for (let i = 0; i < 100 && gesendetSig < 1; i++) await warte(30);
      const t0 = Date.now();
      const u = await z.laufUebergeben(5000);
      const nach = await z.laufStand(d.lauf.id);
      const [roh] = (await sqlPool`SELECT in_arbeit FROM fiaon_wa_lauf WHERE id = ${d.lauf.id}`) as any[];
      pruef("SIGTERM: laufende Nachricht zu Ende, dann „unterbrochen\" (schnell, ohne Reservierung)",
        u.uebergeben === 1 && nach?.zustand === "unterbrochen" && roh?.in_arbeit == null && Date.now() - t0 < 2000, { u, nach: nach?.zustand, roh, ms: Date.now() - t0 });
      pruef("Während des Herunterfahrens startet kein neuer Lauf", !(await z.laufStarten({ gruppe: "neu", vorlage: "fiaon_kk_anfrage", anzahl: 1, quelle: "hand", von: "Prüfstand E-253" })).ok);
      z.laufPruefstand({ instanz: "pruef:D", herunterfahren: false, huelle: null });
      const f = await z.laufFortsetzen();
      pruef("Der Takt der neuen Instanz übernimmt sofort (status unterbrochen)", f.id === d.lauf.id, f);
      const s = await bisFertig(d.lauf.id);
      const zeilen = await zeilenJePerson(d.lauf.id);
      pruef("… und macht fertig: 4 gesendet, jede Person genau einmal", s?.zustand === "fertig" && s.gesendet === 4 && sig.every((id) => zeilen.get(id)?.n === 1 && sendungenAn(id) === 1), { s, z: Array.from(zeilen.entries()) });
    } else pruef("SIGTERM-Lauf startet", false, d);

    // ── Anhalten wirkt auf jeder Instanz, ehrlich ──────────────────────────
    const halt = await neuePersonen(925355, 5);
    let n5 = 0;
    z.laufPruefstand({ instanz: "pruef:E", huelle: (echt) => async (...a) => { await warte(200); n5++; return echt(...a); } });
    const e = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (e.ok) {
      laufIds.push(e.lauf.id);
      const doppelt = await z.laufStarten({ gruppe: "neu", vorlage: "fiaon_kk_anfrage", anzahl: 1, quelle: "hand", von: "Prüfstand E-253" });
      pruef("Zweiter Start während eines Laufs → „Es läuft schon ein Versand\"", !doppelt.ok && /läuft schon/.test(doppelt.grund), doppelt);
      let einzigartig = false;
      try {
        await sqlPool`INSERT INTO fiaon_wa_lauf (id, quelle, gruppe, vorlage, ausgeloest_von, plan) VALUES ('Lpruef253x', 'hand', 'neu', 'fiaon_kk_anfrage', 'Prüfstand E-253', '{1}')`;
      } catch (x) { einzigartig = String((x as any)?.code) === "23505"; }
      pruef("Der eindeutige Index lässt keinen zweiten laufenden Lauf zu (23505)", einzigartig);
      for (let i = 0; i < 100 && n5 < 1; i++) await warte(30);
      const a1 = await z.laufAbbrechen("Prüfstand E-253");
      pruef("Anhalten: der Server sagt, dass es etwas gab", a1.angehalten && a1.id === e.lauf.id, a1);
      const s = await bisFertig(e.lauf.id);
      pruef("… der Lauf steht nach der laufenden Nachricht auf „angehalten\", der Rest bleibt offen", s?.zustand === "angehalten" && s.erledigt < 5 && s.abgebrochen, s);
      const a2 = await z.laufAbbrechen("Prüfstand E-253");
      pruef("Zweites Anhalten: ehrlich „nichts anzuhalten\"", a2.angehalten === false, a2);
    } else pruef("Anhalte-Lauf startet", false, e);
    void halt;

    const halt2 = await neuePersonen(925361, 2);
    z.laufPruefstand({ instanz: "pruef:F", huelle: (echt) => async (...a) => { await warte(150); return echt(...a); } });
    const f2 = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (f2.ok) {
      laufIds.push(f2.lauf.id);
      await z.laufUebergeben(3000);
      const a = await z.laufAbbrechen("Prüfstand E-253");
      const s = await z.laufStand(f2.lauf.id);
      pruef("Ein unterbrochener Lauf ist beim Anhalten sofort „angehalten\"", a.angehalten && a.zustand === "angehalten" && s?.zustand === "angehalten", { a, s: s?.zustand });
      z.laufPruefstand({ instanz: "pruef:G", herunterfahren: false, huelle: null });
    } else pruef("Unterbrechen+Anhalten-Lauf startet", false, f2);
    void halt2;

    // ── entfallen: wer inzwischen schrieb, wird nicht angeschrieben ────────
    const ent = await neuePersonen(925364, 4);
    let tor2: (() => void) | null = null;
    let erster = true;
    z.laufPruefstand({ instanz: "pruef:H", happen: 2, huelle: (echt) => async (...a) => {
      if (erster) { erster = false; await new Promise<void>((r) => { tor2 = r; }); }
      return echt(...a);
    } });
    const h = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (h.ok) {
      laufIds.push(h.lauf.id);
      for (let i = 0; i < 100 && !tor2; i++) await warte(30);
      const letzter = (await sqlPool`SELECT plan[4] AS p FROM fiaon_wa_lauf WHERE id = ${h.lauf.id}`) as any[];
      const spaet = Number(letzter[0]?.p);
      await sqlPool`INSERT INTO fiaon_whatsapp (nummer, richtung, person_id, typ, text, status, empfangen_am, created_at)
                    VALUES (${NR(spaet)}, 'rein', ${spaet}, 'text', 'Ich melde mich selbst.', 'empfangen', NOW(), NOW())`;
      (tor2 as unknown as () => void)();
      const s = await bisFertig(h.lauf.id);
      pruef("Wer seit dem Start geschrieben hat: „entfallen\", nicht angeschrieben, keine Zeile",
        // (Im Plan stehen auch die Übriggebliebenen der Anhalte-Prüfungen — gezählt wird relativ zum Plan.)
        s?.zustand === "fertig" && s.entfallen === 1 && s.gesendet === s.gesamt - 1 && sendungenAn(spaet) === 0 && !(await zeilenJePerson(h.lauf.id)).has(spaet), { s, spaet });
    } else pruef("Entfallen-Lauf startet", false, h);
    void ent;
    z.laufPruefstand({ instanz: "pruef:I", happen: 25, huelle: null });

    // ── Nachtrag: Tagesplatz — genau ein Weg bekommt ihn ─────────────────
    const [tp1, tp2] = await Promise.all([
      wa.waTagesplatz({ personId: 925369, nummer: NR(925369), weg: "pruef_a" }),
      wa.waTagesplatz({ personId: 925369, nummer: NR(925369), weg: "pruef_b" }),
    ]);
    pruef("Tagesplatz: zwei Wege in derselben Sekunde → genau einer bekommt ihn", [tp1, tp2].filter((x) => x.ok).length === 1, [tp1, tp2]);
    const tp3 = await wa.waTagesplatz({ personId: null, nummer: NR(925369), weg: "pruef_c" });
    pruef("… auch über die Nummer allein (Begrüßung ohne Person)", !tp3.ok, tp3);

    // ── Nachtrag: ein anderer Weg schreibt mitten im Happen ───────────────
    const race = await neuePersonen(925370, 4);
    let tor3: (() => void) | null = null;
    let n3 = 0;
    z.laufPruefstand({ instanz: "pruef:J", happen: 25, huelle: (echt) => async (...a) => {
      n3++;
      if (n3 === 2) await new Promise<void>((r) => { tor3 = r; }); // der Lauf steht zwischen Person 1 und 2
      return echt(...a);
    } });
    const r3 = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (r3.ok) {
      laufIds.push(r3.lauf.id);
      for (let i = 0; i < 100 && !tor3; i++) await warte(30);
      const [pl3] = (await sqlPool`SELECT plan FROM fiaon_wa_lauf WHERE id = ${r3.lauf.id}`) as any[];
      const plan3: number[] = (pl3?.plan ?? []).map(Number);
      pruef("(Voraussetzung) Plan = die vier neuen Menschen", plan3.length === 4 && race.every((id) => plan3.includes(id)), plan3);
      const dritter = plan3[2];
      const vierter = plan3[3];
      // Person 3: ein Weg MIT Tagesplatz (wie Verkaufstakt, Automatik, Begrüßung) nimmt ihn und sendet.
      const platz3 = await wa.waTagesplatz({ personId: dritter, nummer: NR(dritter), weg: "pruef_verkaufstakt" });
      const w3 = await wa.waSenden(NR(dritter), { vorlage: "fiaon_kk_antrag_offen", werte: ["Test"] }, { personId: dritter, von: "Mara" });
      // Person 4: ein Weg OHNE Tagesplatz (wie Raum oder Akte) sendet — der Blick in fiaon_whatsapp hält den Lauf auf.
      const w4 = await wa.waSenden(NR(vierter), { vorlage: "fiaon_kk_antrag_offen", werte: ["Test"] }, { personId: vierter, von: "Mara" });
      pruef("(Voraussetzung) Beide anderen Wege haben gesendet", platz3.ok && w3.ok && w4.ok, { platz3, w3, w4 });
      (tor3 as unknown as () => void)();
      const s = await bisFertig(r3.lauf.id);
      const zeilen = await zeilenJePerson(r3.lauf.id);
      pruef("Anderer Weg mitten im Happen: der Lauf sendet NICHT noch einmal — je Mensch genau eine Nachricht bei Meta",
        plan3.every((id) => sendungenAn(id) === 1), plan3.map((id) => [id, sendungenAn(id)]));
      pruef("… beide stehen mit ehrlichem Grund als übersprungen da",
        zeilen.get(dritter)?.gruende[0] === wa.TAGESPLATZ_BELEGT && zeilen.get(vierter)?.gruende[0] === wa.TAGESPLATZ_BELEGT, Array.from(zeilen.entries()));
      pruef("… der Lauf ist fertig: 2 gesendet, 2 übersprungen", s?.zustand === "fertig" && s.gesendet === 2 && s.uebersprungen === 2, s);
    } else pruef("Tagesplatz-Lauf startet", false, r3);

    // ── Nachtrag: der Minutentakt übernimmt nie den eigenen, lebenden Lauf ─
    const selbst = await neuePersonen(925380, 3);
    let tor4: (() => void) | null = null;
    let n4 = 0;
    z.laufPruefstand({ instanz: "pruef:K", huelle: (echt) => async (...a) => {
      n4++;
      if (n4 === 1) await new Promise<void>((r) => { tor4 = r; }); // eine lange Sendung (Meta hängt)
      return echt(...a);
    } });
    const r4 = await z.laufStarten({ gruppe: "abbrecher", vorlage: "fiaon_kk_antrag_offen", anzahl: 50, quelle: "hand", von: "Prüfstand E-253" });
    if (r4.ok) {
      laufIds.push(r4.lauf.id);
      for (let i = 0; i < 100 && !tor4; i++) await warte(30);
      await sqlPool`UPDATE fiaon_wa_lauf SET herzschlag = NOW() - INTERVAL '200 seconds' WHERE id = ${r4.lauf.id}`;
      const eigen = await z.laufFortsetzen(); // derselbe Prozess, dieselbe Instanz — wie auf Render
      pruef("Herzschlag alt, aber derselbe Prozess trägt den Lauf → der Minutentakt übernimmt NICHT", eigen.id === null, eigen);
      (tor4 as unknown as () => void)();
      const s = await bisFertig(r4.lauf.id);
      const zeilen = await zeilenJePerson(r4.lauf.id);
      pruef("… der Lauf läuft zu Ende: 3 gesendet, nicht fortgesetzt, jede Person genau eine Zeile und eine Sendung",
        s?.zustand === "fertig" && s.gesendet === 3 && s.fortsetzungen === 0 && s.erledigt === 3
          && selbst.every((id) => zeilen.get(id)?.n === 1 && sendungenAn(id) === 1), { s, z: Array.from(zeilen.entries()) });
    } else pruef("Selbstübernahme-Lauf startet", false, r4);
    z.laufPruefstand({ instanz: "pruef:L", happen: 25, huelle: null });

    // ── Tageswechsel ──────────────────────────────────────────────────────
    await sqlPool`INSERT INTO fiaon_wa_lauf (id, quelle, gruppe, vorlage, ausgeloest_von, plan, status, seit, herzschlag)
                  VALUES ('Lpruef253g', 'hand', 'abbrecher', 'fiaon_kk_antrag_offen', 'Prüfstand E-253', '{925301}', 'unterbrochen',
                          NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`;
    laufIds.push("Lpruef253g");
    const tw = await z.laufFortsetzen();
    const gestern = await z.laufStand("Lpruef253g");
    pruef("Ein Lauf von gestern wird nicht fortgesetzt, sondern „verfallen\"", tw.id === null && gestern?.zustand === "verfallen" && /Tageswechsel/.test(String(gestern.schluss)), { tw, gestern });
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("7. Quelltext-Wand und Wächter");
  const q = (p: string) => readFileSync(p, "utf8");
  // Nachtrag: der stille Minutentakt (wa_zentrale_fortsetzen) — Historie nur, wenn etwas getan wurde oder etwas scheiterte.
  const crons = await import("../server/lib/fiaon-crons");
  await crons.stillerLauf("pruef_still_e253", async () => false);
  await crons.stillerLauf("pruef_still_e253", async () => true);
  await crons.stillerLauf("pruef_still_e253", async () => { throw new Error("Prüfstand: gewollter Fehler"); });
  const [hz] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE ergebnis = 'erfolg')::int AS e, COUNT(*) FILTER (WHERE ergebnis = 'fehler')::int AS f
      FROM fiaon_lauf_historie WHERE name = 'pruef_still_e253'`) as any[];
  pruef("Stiller Takt: keine Zeile für „nichts zu tun\", je eine für „etwas getan\" und den Fehler", hz?.n === 2 && hz.e === 1 && hz.f === 1, hz);
  pruef("wa_zentrale_fortsetzen läuft still (nurMitErgebnis) und meldet nur eine Übernahme",
    /tageslauf\('wa_zentrale_fortsetzen', async \(\) => !!\(await[^;]*laufFortsetzen\(\)\)\.id,[^;]*nurMitErgebnis: true/.test(q("server/routes.ts")));
  const leadWa = q("server/lib/fiaon-lead-whatsapp.ts");
  pruef("Tagesplatz an allen unaufgeforderten Wegen: Zentrale, Lead-Kette, Lead-Begrüßung",
    // E-261 (29.09.2026): Der Aufruf nennt jetzt auch die Vorlage (für die Bremse vor dem Tagesplatz).
    /waTagesplatz\(\{ personId: k\.personId, nummer, weg: `zentrale_\$\{quelle\}`(, vorlage)? \}\)/.test(q("server/lib/fiaon-wa-zentrale.ts"))
      && /weg: "lead_kette"/.test(leadWa) && /weg: "lead_begruessung"/.test(leadWa));
  pruef("Lead-Kette liest das Stopp über die Familie (STOPP_KOEPFE_SQL)", /NOT IN \$\{sqlPool\.unsafe\(STOPP_KOEPFE_SQL\)\}/.test(leadWa));
  pruef("Verkaufstakt wartet während eines Laufs (waLaufOffen vor jeder WhatsApp)", /zentrale\.waLaufOffen\(\)/.test(q("server/lib/fiaon-auskunft-verkauf.ts")));
  pruef("Mara liest den MENSCHEN: kein personSperre mehr in fiaon-whatsapp-mara.ts", !/\bpersonSperre\(/.test(q("server/lib/fiaon-whatsapp-mara.ts")));
  const familienLeser = ["server/lib/fiaon-whatsapp.ts", "server/lib/fiaon-lead-strecke.ts", "server/lib/fiaon-auskunft-verkauf.ts", "server/lib/fiaon-wa-zentrale.ts"]
    .filter((f) => /merged_into_person_id = COALESCE\([^)]*\)[\s\S]{0,300}is_blocked/.test(q(f)));
  pruef("Keine Familienlesart von is_blocked mehr (merged_into_person_id = COALESCE(…) + is_blocked)", familienLeser.length === 0, familienLeser);
  pruef("Tür: menschSperre statt personSperren über die Familie", /menschSperre\(personId, lauf\)/.test(q("server/lib/fiaon-whatsapp.ts")) && !/personSperren\(ids\)/.test(q("server/lib/fiaon-whatsapp.ts")));
  pruef("Zentrale: kein Lauf im Arbeitsspeicher mehr", !/let aktuellerLauf/.test(q("server/lib/fiaon-wa-zentrale.ts")));
  pruef("Zentrale: bis 500, an Metas freien Raum gekoppelt", z.LAUF_HOECHSTENS === 500 && /Math\.min\(LAUF_HOECHSTENS, raum\.frei,/.test(q("server/lib/fiaon-wa-zentrale.ts")));
  const seite = q("client/src/components/admin/ChefWhatsAppZentrale.tsx");
  pruef("Seite: keine 200er-Grenze, Grenze vom Server, Abfrage mit ?id=", !/Math\.min\(200/.test(seite) && /d\??\.laufHoechstens/.test(seite) && /\/chef\/wa-zentrale\/lauf\?id=/.test(seite));
  pruef("Seite: „kein Lauf\" friert nicht ein (Hinweis + Ende des Abfragens)", /nicht mehr abrufbar/.test(seite) && /window\.clearInterval\(t\)/.test(seite));
  pruef("Server: SIGTERM übergibt den Lauf", /process\.once\("SIGTERM"/.test(q("server/index.ts")) && /laufUebergeben/.test(q("server/index.ts")));
  pruef("Takt wa_zentrale_fortsetzen ist angemeldet (nur im Betrieb, tageslauf)", /tageslauf\('wa_zentrale_fortsetzen'/.test(q("server/routes.ts")));
  pruef("Rundgang nennt die 500 und den Neustart", /Bis zu 500 je Versand/.test(q("client/src/pages/agent/rundgaenge.ts")) && /Kurz unterbrochen/.test(q("client/src/pages/agent/rundgaenge.ts")));
  // Der Wächter (lesend, Soll 0) — ohne die eigenen Testzeilen. In der Produktion: scratchpad e253/waechter-sperre.sql.
  const [w] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons p WHERE p.merged_into_person_id IS NOT NULL AND COALESCE(p.is_blocked, FALSE)
              AND p.id <> ALL(${IDS})
              AND NOT EXISTS (SELECT 1 FROM fiaon_agent_events e WHERE e.type = 'person_merge'
                                AND (e.meta::jsonb ->> 'verliererId')::text = p.id::text))::int AS ohne_merge_ereignis,
           (SELECT COUNT(*) FROM fiaon_whatsapp w JOIN fiaon_persons p ON p.id = w.person_id
             WHERE p.merged_into_person_id IS NOT NULL AND p.id <> ALL(${IDS}))::int AS wa_an_dubletten`.catch(() => [{ ohne_merge_ereignis: -1, wa_an_dubletten: -1 }])) as any[];
  console.log(`    Wächter lokal (ohne Testzeilen): gesperrte Dubletten ohne Merge-Ereignis ${w?.ohne_merge_ereignis}, WhatsApp an Dubletten ${w?.wa_an_dubletten}`);
} finally {
  z.laufPruefstand({ herunterfahren: false, huelle: null, happen: 25 });
  await warte(300);
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  const [rest] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${IDS}))::int AS p,
           (SELECT COUNT(*) FROM fiaon_wa_aktion WHERE person_id = ANY(${IDS}))::int AS a,
           (SELECT COUNT(*) FROM fiaon_wa_lauf WHERE ausgeloest_von = 'Prüfstand E-253')::int AS l,
           (SELECT COUNT(*) FROM fiaon_whatsapp WHERE nummer LIKE '49159009925%')::int AS w,
           (SELECT COUNT(*) FROM fiaon_postmeister WHERE gmail_id LIKE 'WS253-%')::int AS pm,
           (SELECT COUNT(*) FROM fiaon_wa_tagesplatz WHERE person_id = ANY(${IDS}) OR schluessel LIKE 'n:49159009925%')::int AS tp`
    .catch(() => [{ p: -1, a: -1, l: -1, w: -1, pm: -1, tp: -1 }])) as any[];
  console.log(`\nAufgeräumt: ${rest.p} Personen, ${rest.a} Aktionen, ${rest.l} Läufe, ${rest.w} WhatsApp, ${rest.pm} Postfach-Zeilen, ${rest.tp} Tagesplätze übrig.`);
  const fremd = aufrufe.filter((a) => !/^http:\/\/(make|meta)\.pruefstand\.invalid/.test(a.url));
  console.log(`Netz: ${aufrufe.length} Anfragen, alle an Attrappen${fremd.length ? ` — ABER ${fremd.length} fremde: ${fremd.map((f) => f.url).join(", ")}` : ""}; ${metaSendungen.length} Vorlagen/Texte bei der Meta-Attrappe.`);
  console.log(`E-253 Sperre/Lauf/Du-Form: ${ok} bestanden, ${fehl} nicht.`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(fehl ? 1 : 0);
}
