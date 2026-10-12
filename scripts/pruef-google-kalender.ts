// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-342 (12.10.2026): TERMINE DIREKT IN DEN GOOGLE-KALENDER
//
// Justin: „die Termine müssen sich immer in meinen Kalender synchronisieren,
//          wenn der Termin bei mir gebucht wird."
// Regeln: server/lib/fiaon-google-kalender.ts (+ termineFuerGoogle, Abo-Ausnahme
// in fiaon-kalender-abo.ts). Google ist eine ATTRAPPE (fetch abgefangen) — kein Netz.
//
//   1  Ereignis-ID base32hex, fest je Termin; Inhalt = Abo-Inhalt (Titel, Zeit, Erinnerung, Akte)
//   2  Freigabe fehlt (unauthorized_client) → nichts geschrieben, Stand „fehlt", Abo zeigt den Termin
//   3  Freigabe da → Termin steht in Google, Zeile in fiaon_google_kalender, Abo lässt ihn weg
//   4  Zweiter Lauf → kein einziger Schreibaufruf (nichts doppelt)
//   5  Verschieben → SEQUENCE +1 → Google-Eintrag hat die neue Zeit
//   6  Absage → aus Google gelöscht
//   7  Übergabe an einen anderen Mitarbeiter → aus Justins Google gelöscht
//   8  Google-Fehler 500 → Zeile mit Fehler, Abo zeigt den Termin wieder (Rückfall), ab dem 3. Versuch Pause
//   9  Schalter aus → kein Aufruf
//  10  409 (zweite Instanz war schneller) → Update statt Fehler
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e263?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-google-kalender.ts
// Eigene Datensätze (PRUEF342-…) und die Einstellungen werden am Ende zurückgesetzt.
// ═══════════════════════════════════════════════════════════════════════════
import { generateKeyPairSync, randomBytes } from "node:crypto";

if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";

// ── Dienstkonto zum Wegwerfen + Google-Attrappe VOR jedem Import ────────────
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@fiaon-pruef.iam.gserviceaccount.com", client_id: "000000000000000000000",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.googleapis.com/token",
});
const GOOGLE = { freigabe: false, fehler500: false, ereignisse: new Map<string, any>(), schreib: 0, fremd: 0 };
const echtesFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = String(url);
  const antwort = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u === "https://oauth2.googleapis.com/token") {
    return GOOGLE.freigabe ? antwort(200, { access_token: "attrappe", expires_in: 3600 }) : antwort(401, { error: "unauthorized_client", error_description: "attrappe" });
  }
  const m = u.match(/^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/primary\/events(?:\/([^?]+))?/);
  if (m) {
    const methode = String(init.method || "GET").toUpperCase();
    const id = m[1];
    if (methode !== "GET") GOOGLE.schreib++;
    if (GOOGLE.fehler500 && methode !== "DELETE") return antwort(500, { error: { message: "Attrappe: Backend Error" } });
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (methode === "PUT") {
      if (!GOOGLE.ereignisse.has(id!)) return antwort(404, { error: { message: "Not Found" } });
      GOOGLE.ereignisse.set(id!, body); return antwort(200, body);
    }
    if (methode === "POST") {
      if (GOOGLE.ereignisse.has(body.id)) return antwort(409, { error: { message: "The requested identifier already exists." } });
      GOOGLE.ereignisse.set(body.id, body); return antwort(200, body);
    }
    if (methode === "DELETE") {
      if (!GOOGLE.ereignisse.has(id!)) return antwort(410, { error: { message: "Resource has been deleted" } });
      GOOGLE.ereignisse.delete(id!); return new Response(null, { status: 204 });
    }
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)) return echtesFetch(url, init);
  GOOGLE.fremd++;
  throw new Error(`Prüfstand: fremder Netzaufruf gesperrt (${u.slice(0, 60)})`);
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const G = await import("../server/lib/fiaon-google-kalender");
const ABO = await import("../server/lib/fiaon-kalender-abo");

let gruen = 0, rot = 0;
const ok = (titel: string, bed: boolean, info = "") => { if (bed) { gruen++; console.log(`  PASS  ${titel}`); } else { rot++; console.log(`  FAIL  ${titel}${info ? ` — ${info}` : ""}`); } };
const titel = (t: string) => console.log(`\n── ${t}`);

const JUSTIN = 928, ANDERER = 8, MARKE = `PRUEF342-${randomBytes(3).toString("hex")}`;
const personen: number[] = [];
const termine: number[] = [];
const alteEinstellungen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key IN ('google_kalender_agent_ids', 'google_kalender_an', 'google_kalender_stand')`) as any[];

async function setzen(key: string, value: string | null) {
  if (value === null) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${key}`;
  else await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}
async function person(): Promise<number> {
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason, primary_email, primary_phone)
    VALUES (${`${MARKE}-${personen.length + 1}`}, 'Prüf', ${`Kalender${personen.length + 1}`}, ${ANDERER}, 2, 'nur_lead', ${`${MARKE.toLowerCase()}-${personen.length + 1}@example.invalid`}, '+49 151 34200000')
    RETURNING id`) as any[];
  personen.push(Number(p.id)); return Number(p.id);
}
/** Ein freier Platz bei Justin: weit vorn, ungerade Minute, ohne Überschneidung. */
async function freierBeginn(tageVoraus: number): Promise<Date> {
  for (let v = 0; v < 200; v++) {
    const b = new Date(Date.now() + tageVoraus * 86_400_000 + v * 47 * 60_000);
    b.setUTCSeconds(0, 0);
    const [x] = (await sqlPool`SELECT 1 AS da FROM fiaon_termine WHERE agent_id IN (${JUSTIN}, ${ANDERER}) AND status IN ('gebucht','erledigt','verpasst')
      AND beginn < ${new Date(b.getTime() + 40 * 60_000)} AND beginn + make_interval(mins => COALESCE(dauer_min, 20)) > ${new Date(b.getTime() - 10 * 60_000)} LIMIT 1`) as any[];
    if (!x) return b;
  }
  throw new Error("kein freier Platz");
}
async function termin(personId: number, beginn: Date): Promise<number> {
  const [t] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, herkunft)
    VALUES (${personId}, ${JUSTIN}, ${beginn}, 30, 'gebucht', 'gruender', ${randomBytes(16).toString("hex")}, 'gruender_seite')
    RETURNING id`) as any[];
  termine.push(Number(t.id)); return Number(t.id);
}
async function eigenesAbo() {
  const z = await ABO.aboHolen(JUSTIN, "eigene", "pruef342");
  if (!z) throw new Error("kein Abo für 928");
  ABO.zwischenspeicherVergessen();
  return (await ABO.aboFeed(z)).ics;
}
const zeile = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_google_kalender WHERE termin_id = ${id}`) as any[])[0];

try {
  await setzen("google_kalender_agent_ids", String(JUSTIN));
  await setzen("google_kalender_an", null);
  await setzen("google_kalender_stand", null);

  titel("1 · Ereignis-ID und Inhalt");
  ok("ID fest und base32hex", G.ereignisId(4711) === "fiaontermin4711" && /^[0-9a-v]{5,1024}$/.test(G.ereignisId(4711)));
  const p1 = await person();
  const b1 = await freierBeginn(30);
  const t1 = await termin(p1, b1);
  const soll = await ABO.termineFuerGoogle([JUSTIN]);
  const g1 = soll.find((x) => x.id === t1);
  ok("termineFuerGoogle findet den Termin", !!g1);
  const body = g1 ? G.googleEreignis(g1) as any : {};
  ok("Zeit stimmt (UTC → ISO), Zone Berlin", body.start?.dateTime === b1.toISOString() && body.end?.dateTime === new Date(b1.getTime() + 30 * 60_000).toISOString() && body.start?.timeZone === "Europe/Berlin");
  ok("Titel = Abo-Titel mit Namen", typeof body.summary === "string" && body.summary.includes("Prüf Kalender1"), body.summary);
  ok("Erinnerung 10 Minuten, Akte als Quelle", body.reminders?.overrides?.[0]?.minutes === 10 && /^https?:\/\//.test(body.source?.url ?? ""));

  titel("2 · Freigabe fehlt");
  GOOGLE.freigabe = false;
  const r2 = await G.googleKalenderAbgleich();
  ok("Abgleich meldet nichts getan", r2 === false);
  ok("nichts in Google", GOOGLE.ereignisse.size === 0 && GOOGLE.schreib === 0);
  ok("Stand: Freigabe fehlt", (await G.googleKalenderStand()).freigabe === "fehlt");
  ok("Abo zeigt den Termin (Rückfall)", (await eigenesAbo()).includes(`termin-${t1}@fiaon.com`));

  titel("3 · Freigabe da → Termin in Google, Abo ohne Doppelten");
  GOOGLE.freigabe = true;
  const r3 = await G.googleKalenderAbgleich();
  ok("Abgleich meldet getan", r3 === true);
  ok("Termin steht in Google", GOOGLE.ereignisse.has(`fiaontermin${t1}`));
  const z3 = await zeile(t1);
  ok("Zeile ohne Fehler, Sequenz gemerkt", !!z3 && !z3.fehler && z3.geloescht_am == null && z3.email === "js@fiaon.com");
  ok("Abo lässt ihn weg", !(await eigenesAbo()).includes(`termin-${t1}@fiaon.com`));
  const st3 = await G.googleKalenderStand();
  ok("Stand: ok, eingetragen ≥ 1", st3.freigabe === "ok" && st3.eingetragen >= 1, JSON.stringify(st3).slice(0, 160));

  titel("4 · Zweiter Lauf schreibt nichts");
  const vorher4 = GOOGLE.schreib;
  await G.googleKalenderAbgleich();
  ok("kein Schreibaufruf", GOOGLE.schreib === vorher4, `${GOOGLE.schreib - vorher4} Aufrufe`);

  titel("5 · Verschieben");
  const b5 = await freierBeginn(33);
  await sqlPool`UPDATE fiaon_termine SET beginn = ${b5} WHERE id = ${t1}`;
  await G.googleKalenderAbgleich();
  ok("Google hat die neue Zeit", GOOGLE.ereignisse.get(`fiaontermin${t1}`)?.start?.dateTime === b5.toISOString());

  titel("6 · Absage");
  await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW(), abgesagt_von = 'kunde' WHERE id = ${t1}`;
  await G.googleKalenderAbgleich();
  ok("aus Google gelöscht", !GOOGLE.ereignisse.has(`fiaontermin${t1}`));
  ok("Zeile gelöscht markiert", (await zeile(t1))?.geloescht_am != null);

  titel("7 · Übergabe an einen anderen Mitarbeiter");
  const p7 = await person();
  const t7 = await termin(p7, await freierBeginn(36));
  await G.googleKalenderAbgleich();
  ok("zuerst bei Justin in Google", GOOGLE.ereignisse.has(`fiaontermin${t7}`));
  await sqlPool`UPDATE fiaon_termine SET agent_id = ${ANDERER} WHERE id = ${t7}`;
  await G.googleKalenderAbgleich();
  ok("nach der Übergabe nicht mehr in Justins Google", !GOOGLE.ereignisse.has(`fiaontermin${t7}`));

  titel("8 · Google-Fehler → Rückfall aufs Abo, dann Pause");
  const p8 = await person();
  const t8 = await termin(p8, await freierBeginn(39));
  GOOGLE.fehler500 = true;
  await G.googleKalenderAbgleich();
  const z8 = await zeile(t8);
  ok("Zeile trägt den Fehler", !!z8?.fehler && Number(z8.versuche) === 1, JSON.stringify(z8));
  ok("Abo zeigt den Termin wieder", (await eigenesAbo()).includes(`termin-${t8}@fiaon.com`));
  ok("Stand: Fehler", (await G.googleKalenderStand()).freigabe === "fehler");
  await G.googleKalenderAbgleich(); await G.googleKalenderAbgleich();
  const vorher8 = GOOGLE.schreib;
  await G.googleKalenderAbgleich();
  ok("ab dem 3. Versuch Pause (kein Aufruf)", GOOGLE.schreib === vorher8 && Number((await zeile(t8))?.versuche) === 3, `versuche ${(await zeile(t8))?.versuche}, Aufrufe ${GOOGLE.schreib - vorher8}`);
  GOOGLE.fehler500 = false;
  await sqlPool`UPDATE fiaon_google_kalender SET geaendert_am = NOW() - INTERVAL '31 minutes' WHERE termin_id = ${t8}`;
  await G.googleKalenderAbgleich();
  ok("nach der Pause klappt es", GOOGLE.ereignisse.has(`fiaontermin${t8}`) && !(await zeile(t8))?.fehler);

  titel("9 · Schalter aus");
  await G.googleKalenderSchalten(false);
  const p9 = await person();
  const t9 = await termin(p9, await freierBeginn(42));
  const vorher9 = GOOGLE.schreib;
  ok("Abgleich tut nichts", (await G.googleKalenderAbgleich()) === false && GOOGLE.schreib === vorher9);
  ok("Stand: aus", (await G.googleKalenderStand()).freigabe === "aus");
  await G.googleKalenderSchalten(true);

  titel("10 · 409: eine zweite Instanz war schneller");
  GOOGLE.ereignisse.set(`fiaontermin${t9}`, { id: `fiaontermin${t9}`, summary: "alt" });
  await sqlPool`UPDATE fiaon_google_kalender SET fehler = NULL WHERE termin_id = ${t9}`;
  await G.googleKalenderAbgleich();
  ok("Eintrag aktualisiert statt Fehler", GOOGLE.ereignisse.get(`fiaontermin${t9}`)?.summary !== "alt" && !(await zeile(t9))?.fehler);

  ok("Kein fremder Netzaufruf", GOOGLE.fremd === 0);
} catch (e) {
  rot++; console.error("ABBRUCH:", e);
} finally {
  if (termine.length) {
    await sqlPool`DELETE FROM fiaon_google_kalender WHERE termin_id = ANY(${termine})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_termine WHERE id = ANY(${termine})`.catch((e) => console.error("Aufräumen Termine:", e));
  }
  if (personen.length) await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch((e) => console.error("Aufräumen Personen:", e));
  for (const k of ["google_kalender_agent_ids", "google_kalender_an", "google_kalender_stand"]) {
    const alt = alteEinstellungen.find((z) => z.key === k);
    await setzen(k, alt ? String(alt.value) : null).catch(() => {});
  }
  console.log(`\n══ E-342 Google-Kalender: ${gruen} grün, ${rot} rot`);
  await sqlPool.end?.({ timeout: 2 }).catch?.(() => {});
  process.exit(rot ? 1 : 0);
}
