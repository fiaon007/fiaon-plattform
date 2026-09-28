// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-254 (28.09.2026): KEIN STAU MEHR DURCH TABELLEN-PRÜFUNGEN
//
// Anlass: Am 28.09. stand das Agentenportal von 14:53 bis 15:20 (Florentine:
// „Bei Nikita und mir geht nichts mehr"). Eine lange Lesung hielt die Tabellen,
// der neue Server schickte beim Deploy seine `ALTER TABLE … ADD COLUMN IF NOT
// EXISTS` hinterher (Sperre AUCH bei vorhandener Spalte), und hinter denen
// stand jede weitere Abfrage an. Geprüft wird die DDL-Wache (server/lib/
// ddl-wache.ts), die um sqlPool und den drizzle-client liegt:
//
//   A  ohne Datenbank: Zerleger/Prüfplan an Sonderfällen und an ALLEN
//      DDL-Texten des Servers (≥ 470 ohne Sperre entscheidbar); jede NEUE nicht
//      entscheidbare DDL auf einer heißen Tabelle macht den Prüfstand rot.
//      Nachprüfung E-254: Datenänderung (INSERT/UPDATE/DELETE/MERGE, FOR
//      UPDATE, Advisory) geht nie über die Wache — auch nicht mit „ALTER
//      TABLE" im Kommentar, als Mischtext oder hinter verschachteltem
//      Kommentar; über ALLE Server-Texte (alle Tabellen): kein bewachter Text
//      ändert Daten, kein Text mischt Tabellen-Anweisung und Datenänderung.
//   B  Verträglichkeit: Tagged Template, Fragment im Template, sql('x'),
//      sql([..]), sql(obj, …), .values(), unsafe (mit/ohne Parameter, mit
//      Optionen), json, begin (DDL im tx geht unbewacht durch), reserve,
//      drizzle db.execute(DO $$…$$) und drizzle-Abfragen, DDL_WACHE=aus.
//      Nachprüfung: DDL liefert die echte postgres.js-Query (DDL als Fragment,
//      .simple() mehrteilig, count/command wie postgres.js, forEach/cursor,
//      cancel).
//   C  Stau: Verbindung A hält eine Lesesperre (BEGIN; SELECT …) offen.
//      C1 OHNE Wache (roher Client wie vor E-254): SELECT/UPDATE stauen sich.
//      C2 MIT Wache, Spalte da: Anweisung sofort zurück, kein Stau.
//      C3 echte Schema-Funktionen unter Halter: ensureAgentTables auf
//         fiaon_agents (der 28.09.), ensureSperrProtokoll auf fiaon_persons.
//      C4 MIT Wache, Spalte wirklich neu, 20 gleichzeitig: zurück nach ≤ ~3 s
//         mit „[DB] DDL wartete zu lange auf Sperre — später erneut: …",
//         SELECT/UPDATE daneben < 1 s, Pool frei, Log nennt den Halter.
//      C5 Abkühlzeit: sofortiger neuer Aufruf ohne Sperrversuch.
//      C6 nach Freigabe von A: nächster Versuch läuft durch; eine verschluckte
//         (`.catch(() => {})`) Anweisung holt die Wache selbst nach.
//      C7 Abkühlzeit mit der VORGABE (60 s), an den Halter gekoppelt: Halter
//         4 s (Fall der Nachprüfung: vorher 63 s Fehler) und 10 s (solange er
//         hält, kein neuer Sperrversuch; danach sofort durch).
//      C8 Buchungs-Texte hinter einer Zeilensperre warten wie vor E-254.
//   M  Migration hinter besetzter Tabelle: Exit 1 mit Halter im Log (der neue
//      Code startet nicht ohne sie), MIGRATE_SPERRFEHLER=weiter → Exit 0,
//      andere FAILs → Exit 0 wie bisher.
//   S  SIGTERM: der Startbefehl aus package.json (npm run start über sh, bash,
//      dash) → node bekommt SIGTERM; der alte Befehl unter bash nicht.
//   D  (nur mit --server <dist/index.js>) echter Server gegen den Prüfstand:
//      Halter auf fiaon_agents/contact_log/applications/whatsapp, Server mit
//      DDL_WACHE=aus (Stau wie am 28.09.) und mit Wache (kein Stau), dazu die
//      Gegenprobe mit gelöschter Spalte — mit der VORGABE-Abkühlzeit (60 s):
//      das Portal läuft weiter (kein 500), die Spalte kommt nach Freigabe.
//
// NUR gegen den lokalen Prüfstand (bricht sonst ab). Legt die Tabellen
// e254_stau und e254_simpel an und löscht sie am Ende; fasst sonst nur Katalog,
// die eine Spalte fiaon_agents.anrede (Gegenprobe D, wird wieder angelegt) und
// eine Zeile in schema_migrations (M, wird wieder gelöscht) an.
//
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e248?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//     npx tsx scripts/pruef-ddl-ohne-stau.ts [--server dist/index.js]
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import postgres from "postgres";

const URL_DB = process.env.DATABASE_URL || "";
if (!/@127\.0\.0\.1:54329\//.test(URL_DB)) {
  console.error("NUR gegen den lokalen Prüfstand (127.0.0.1:54329)! DATABASE_URL =", URL_DB ? URL_DB.replace(/:[^:@/]+@/, ":***@") : "(leer)");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "META_SYSTEM_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
// Kürzere Abkühlzeit NUR hier (Produktion: 60 s). Sperrfenster und Versuchsfrist
// bleiben auf den Produktionswerten (3 s / 0,5 s).
process.env.DDL_ABKUEHLEN_S = "4";
delete process.env.DDL_WACHE;
delete process.env.DDL_LOCK_TIMEOUT;
delete process.env.DDL_LOCK_VERSUCH;

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argServer = process.argv.indexOf("--server");
const SERVER_JS = argServer > 0 ? path.resolve(process.argv[argServer + 1] || "dist/index.js") : null;

// ── Log der Wache mitschreiben ───────────────────────────────────────────────
const logs: string[] = [];
const origLog = console.log.bind(console);
console.log = (...a: any[]) => {
  const z = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  if (z.startsWith("[DDL-WACHE]") || z.startsWith("[DB]") || z.startsWith("[SPERR-PROTOKOLL]")) { logs.push(z); origLog("      │ " + z); return; }
  origLog(...a);
};

let fehler = 0;
const ergebnisse: string[] = [];
function ok(b: boolean, t: string) {
  origLog((b ? "  ✔ " : "  ✘ ") + t);
  if (!b) { fehler++; ergebnisse.push("✘ " + t); }
}
const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const opt = { ssl: "require" as const, onnotice: () => {} };

// ═══════════════════════════════════════════════════════════════════════════
// A — OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
const { zerlege, pruefplan, istDdl, planen, ddlWache, ddlWacheStand, ddlWacheVergessen } = await import("../server/lib/ddl-wache");

origLog("A) Zerleger und Prüfplan (ohne Datenbank)");
{
  const p1 = pruefplan(zerlege(`ALTER TABLE fiaon_agents
      ADD COLUMN IF NOT EXISTS a TEXT, -- Kommentar, mit Komma
      ADD COLUMN IF NOT EXISTS b INT /* x, y */,
      ADD COLUMN IF NOT EXISTS c BOOLEAN NOT NULL DEFAULT FALSE`)[0]);
  ok(JSON.stringify(p1?.map((p) => p.name)) === '["a","b","c"]', "Kommentare in ADD-Listen (ensureAgentTables)");
  const p2 = pruefplan(zerlege(`ALTER TABLE team_todos ADD COLUMN IF NOT EXISTS client_package VARCHAR CHECK (client_package IN ('Starter', 'Pro', 'High End')), ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100)`)[0]);
  ok(p2?.length === 2 && p2[1].name === "urgency_score", "CHECK mit Kommas (team_todos)");
  const p3 = pruefplan(zerlege(`ALTER TABLE team_todos ADD COLUMN IF NOT EXISTS assigned_director_id VARCHAR REFERENCES users(id) ON DELETE SET NULL`)[0]);
  ok(p3?.[0].art === "spalte" && p3[0].name === "assigned_director_id", "REFERENCES");
  const p4 = pruefplan(`ALTER TABLE "Foo" ADD COLUMN IF NOT EXISTS "Bar" int`);
  ok(p4?.[0].tabelle === '"Foo"' && p4[0].name === "Bar", "\"Quoted\"-Namen");
  const d = zerlege(`DO $$ BEGIN ALTER TABLE x ADD COLUMN y int; EXCEPTION WHEN others THEN NULL; END $$`);
  ok(d.length === 1 && pruefplan(d[0]) === null && istDdl(d[0]), "$$-Körper bleibt eine Anweisung, nicht entscheidbar, aber bewacht");
  const m = planen(`CREATE TABLE IF NOT EXISTS t1 (a int, b text); CREATE INDEX IF NOT EXISTS t1_a ON t1 (a);`);
  ok(m?.pruefungen?.length === 2 && m.merkbar === true, "mehrteiliger unsafe-Text: beide entscheidbar, merkbar");
  const v = pruefplan(`ALTER TABLE t ALTER COLUMN c SET DEFAULT ''`);
  ok(v?.[0].art === "vorgabe" && v[0].wert === "''", "SET DEFAULT mit ''");
  ok(pruefplan(`ALTER TABLE fiaon_agents ALTER COLUMN password_hash DROP NOT NULL`)?.[0].art === "nullbar", "DROP NOT NULL (die Anweisung vom 28.09.)");
  ok(pruefplan(`DROP TRIGGER IF EXISTS trg ON fiaon_persons`)?.[0].art === "kein_trigger", "DROP TRIGGER IF EXISTS");
  ok(!istDdl("SELECT 1") && !istDdl("WITH basis AS (SELECT 1) SELECT * FROM basis") && !istDdl("INSERT INTO x VALUES (1)"), "Abfragen sind keine DDL");
  ok(istDdl("  -- Kommentar\n  /* noch einer */ ALTER TABLE x ADD COLUMN IF NOT EXISTS y int"), "führende Kommentare");
  ok(planen("CREATE INDEX CONCURRENTLY IF NOT EXISTS i ON t (a)") === null, "CONCURRENTLY wird durchgereicht (darf in keine Transaktion)");
  ok(planen("BEGIN; ALTER TABLE t ADD COLUMN IF NOT EXISTS y int; COMMIT") === null, "Text mit eigener Transaktion wird durchgereicht");
  ok(planen("DO $$ BEGIN ALTER TABLE t ADD COLUMN y int; COMMIT; END $$") === null, "DO-Block mit COMMIT wird durchgereicht");
  const k = planen("ALTER TABLE t ADD CONSTRAINT c CHECK (a > 0)");
  ok(!!k && k.pruefungen === null && !k.merkbar, "ADD CONSTRAINT: nicht entscheidbar → mit Frist, ohne Gedächtnis");
  ok(planen("LOCK TABLE t IN ACCESS EXCLUSIVE MODE") === null && planen("CREATE OR REPLACE FUNCTION f() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql") === null, "LOCK TABLE / CREATE FUNCTION unverändert");
  // Nachprüfung E-254: Datenänderung geht nie über die Wache.
  ok(planen("DO $$ BEGIN\n  -- früher: ALTER TABLE t ADD COLUMN y int\n  UPDATE t SET a = a + 100 WHERE id = 2;\nEND $$") === null, "DO-Block mit Buchung, „ALTER TABLE“ nur im Kommentar → durchgereicht");
  ok(planen("DO $$ BEGIN RAISE NOTICE 'kein CREATE INDEX nötig'; UPDATE t SET a = 1; END $$") === null, "DO-Block mit Buchung, „CREATE INDEX“ nur im Text → durchgereicht");
  ok(planen("DO $$ BEGIN ALTER TABLE t ADD COLUMN IF NOT EXISTS y int; UPDATE t SET y = 1; END $$") === null && planen("DO $$ BEGIN ALTER TABLE t ADD COLUMN IF NOT EXISTS y int; EXECUTE 'UPDATE t SET y = 1'; END $$") === null, "DO-Block mit Tabellen-Anweisung UND Buchung (auch per EXECUTE) → durchgereicht");
  ok(planen("CREATE TABLE IF NOT EXISTS t (a int); UPDATE t SET a = a + 1000 WHERE id = 2") === null && planen("CREATE TABLE IF NOT EXISTS t (a int); INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING") === null, "Mischtext CREATE TABLE …; UPDATE/INSERT … → durchgereicht");
  ok(!istDdl("/* a /* b */ ALTER TABLE t ADD COLUMN y int */ SELECT * FROM t FOR UPDATE") && planen("/* a /* b */ ALTER TABLE t ADD COLUMN y int */ SELECT * FROM t FOR UPDATE") === null, "verschachtelter Kommentar vor SELECT … FOR UPDATE → keine DDL");
  ok(planen("/* a /* b */ c */ ALTER TABLE t ADD COLUMN IF NOT EXISTS y int")?.merkbar === true, "verschachtelter Kommentar vor echter DDL → bewacht");
  ok(planen("DO $$ BEGIN PERFORM pg_advisory_xact_lock(7); ALTER TABLE t ADD COLUMN IF NOT EXISTS y int; END $$") === null, "Advisory-Lock im DO-Block → durchgereicht");
  const dd = planen("DO $$\n BEGIN\n  -- Spalten\n  ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255);\n END $$;");
  ok(!!dd && JSON.stringify(dd.tabellen) === '["users"]', "DO-Block nur mit DDL (index.ts: users) bleibt bewacht, Tabelle erkannt");
  ok(!!planen("ALTER TABLE t ADD COLUMN IF NOT EXISTS op TEXT CHECK (op IN ('INSERT','UPDATE','DELETE'))")?.merkbar
    && !!planen("ALTER TABLE team_todos ADD COLUMN IF NOT EXISTS d VARCHAR REFERENCES users(id) ON UPDATE SET NULL ON DELETE SET NULL")?.merkbar
    && !!planen("CREATE TRIGGER tr AFTER INSERT OR UPDATE OF a ON t FOR EACH ROW EXECUTE FUNCTION f()"), "INSERT/UPDATE/DELETE als Wert, FK-Regel oder Trigger-Ereignis bleibt DDL");
  ok(pruefplan(zerlege("ALTER TABLE t ALTER COLUMN c SET DEFAULT 'a  b'")[0])?.[0].wert === "'a  b'", "Vorgabewert behält seine Leerzeichen");
}

// ── Alle DDL-Texte des Servers ───────────────────────────────────────────────
{
  const HEISS = /\b(fiaon_applications|fiaon_agents|fiaon_persons|fiaon_contact_log|fiaon_whatsapp|fiaon_leads|fiaon_abo_raten)\b/i;
  // Bewusst erlaubt (nicht entscheidbar, aber abgesichert):
  const ERLAUBT: [RegExp, string][] = [
    [/^CREATE OR REPLACE TRIGGER fiaon_sperr_protokoll_aud/i, "läuft nur, wenn pg_trigger ihn nicht (richtig) kennt"],
    [/^ALTER TABLE fiaon_persons ENABLE TRIGGER fiaon_sperr_protokoll_aud/i, "läuft nur, wenn der Trigger abgeschaltet war"],
  ];
  function walk(d: string, out: string[] = []) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "scripts" && e.name !== "node_modules") walk(p, out); } else if (/\.ts$/.test(p)) out.push(p);
    }
    return out;
  }
  // Unabhängig von der Wache (E-254-Nachprüfung): Was wird ausgeführt, und ändert
  // es Daten? Kommentare (auch verschachtelte) und '…' fallen weg, "Namen" werden
  // x, ein DO-Körper bleibt lesbar, ein FUNCTION-Körper fällt weg (läuft beim
  // Anlegen nicht).
  function ausfuehrbar(t: string): string {
    let aus = "";
    for (let i = 0; i < t.length; i++) {
      const c = t[i], d = t[i + 1];
      if (c === "-" && d === "-") { while (i < t.length && t[i] !== "\n") i++; aus += " "; continue; }
      if (c === "/" && d === "*") {
        let tiefe = 1; i += 2;
        while (i < t.length && tiefe > 0) { if (t[i] === "/" && t[i + 1] === "*") { tiefe++; i += 2; } else if (t[i] === "*" && t[i + 1] === "/") { tiefe--; i += 2; } else i++; }
        i--; aus += " "; continue;
      }
      if (c === "'") { let j = i + 1; while (j < t.length) { if (t[j] === "'") { if (t[j + 1] === "'") { j += 2; continue; } break; } j++; } aus += "''"; i = j; continue; }
      if (c === '"') { let j = i + 1; while (j < t.length && t[j] !== '"') j++; aus += "x"; i = j; continue; }
      const m = c === "$" ? t.slice(i, i + 64).match(/^\$([A-Za-z_]\w*)?\$/) : null;
      if (m) {
        const stueck = aus.slice(aus.lastIndexOf(";") + 1);
        if (/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\b/i.test(stueck)) {
          const ende = t.indexOf(m[0], i + m[0].length);
          i = (ende < 0 ? t.length : ende + m[0].length) - 1; aus += " ''"; continue;
        }
        i += m[0].length - 1; aus += " "; continue; // DO: nur die Hülle weg
      }
      aus += c;
    }
    return aus;
  }
  const AENDERT = /\b(?:INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO)\b|\bUPDATE\s+\S+(?:\s+(?:AS\s+)?\w+)?\s+SET\b|\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b|\bFOR\s+(?:KEY\s+)?SHARE\b|\bpg_(?:try_)?advisory|(?:^|;)\s*(?:INSERT|UPDATE|DELETE|MERGE|CALL|COPY|WITH)\b/i;
  let n = 0, entscheidbar = 0, interp = 0, imTx = 0, bewachtGeprueft = 0;
  const rest: string[] = [];
  const rot: string[] = [];
  const rotDml: string[] = [];
  const rotMisch: string[] = [];
  for (const f of walk(path.join(WURZEL, "server"))) {
    const s = fs.readFileSync(f, "utf8");
    const re = /`((?:[^`\\]|\\.)*)`|"((?:CREATE|ALTER|DROP)[^"\\]*(?:\\.[^"\\]*)*)"/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(s))) {
      const body = mm[1] ?? mm[2];
      if (!body || !istDdl(body)) continue;
      // Backticks in Kommentaren zählen nicht.
      const zeilenAnfang = s.lastIndexOf("\n", mm.index) + 1;
      if (/^\s*(\/\/|\*|\/\*)/.test(s.slice(zeilenAnfang, mm.index))) continue;
      const vor = s.slice(Math.max(0, mm.index - 30), mm.index);
      const wo = `${path.relative(WURZEL, f)}:${s.slice(0, mm.index).split("\n").length}`;
      n++;
      // Datenänderung? Über ALLE Tabellen, auch zur Laufzeit zusammengesetzte Texte.
      const text = body.replace(/\$\{[^}]*\}/g, "x");
      const aendert = AENDERT.test(ausfuehrbar(text));
      if (planen(text)) { bewachtGeprueft++; if (aendert) rotDml.push(`${text.replace(/\s+/g, " ").slice(0, 90)} ← ${wo}`); }
      if (aendert && !/\btx\s*$|\btx\.unsafe\(\s*$/.test(vor)) rotMisch.push(`${text.replace(/\s+/g, " ").slice(0, 90)} ← ${wo}`);
      if (/\$\{/.test(body)) { interp++; continue; }
      const tx = /\btx\s*$|\btx\.unsafe\(\s*$/.test(vor);
      if (tx) imTx++;
      const anw = zerlege(body);
      const plaene = anw.map(pruefplan);
      if (plaene.every(Boolean)) { entscheidbar++; continue; }
      anw.forEach((a, i) => {
        if (plaene[i]) return;
        rest.push(`${a.slice(0, 70)} ← ${wo}${tx ? " (im tx, eigene Frist)" : ""}`);
        if (!tx && HEISS.test(a) && !ERLAUBT.some(([r]) => r.test(a))) rot.push(`${a.slice(0, 90)} ← ${wo}`);
      });
    }
  }
  origLog(`   DDL-Texte ${n} · ohne Sperre entscheidbar ${entscheidbar} · zur Laufzeit zusammengesetzt ${interp} · davon in fremden tx ${imTx} · nicht entscheidbar ${n - entscheidbar - interp}`);
  for (const r of rest) origLog("     · " + r);
  ok(entscheidbar >= 470 && entscheidbar / (n - interp) >= 0.96, `≥ 470 und ≥ 96 % der DDL-Texte ohne Sperre entscheidbar (${entscheidbar}/${n - interp})`);
  ok(rot.length === 0, `keine neue nicht entscheidbare DDL auf heißen Tabellen${rot.length ? ": " + rot.join(" | ") : ""}`);
  ok(rotDml.length === 0 && bewachtGeprueft >= 470, `kein bewachter Server-Text ändert Daten (${bewachtGeprueft} bewachte Texte, alle Tabellen)${rotDml.length ? ": " + rotDml.join(" | ") : ""}`);
  ok(rotMisch.length === 0, `kein Server-Text mischt Tabellen-Anweisung und Datenänderung (liefe ohne Frist)${rotMisch.length ? ": " + rotMisch.join(" | ") : ""}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// B — VERTRÄGLICHKEIT
// ═══════════════════════════════════════════════════════════════════════════
const { sqlPool } = await import("../server/lib/db-pool");
const { db, client } = await import("../server/db");
const { sql: dsql } = await import("drizzle-orm");
const { users } = await import("../shared/schema");

const roh = postgres(URL_DB, { ...opt, max: 2, connection: { application_name: "e254-roh" } });
// Genau wie sqlPool vor E-254 (gleiche Optionen, ohne Wache) — die Vergleichsmessung.
const unbewacht = postgres(URL_DB, { ...opt, max: 12, idle_timeout: 30, connect_timeout: 15, connection: { statement_timeout: 90_000, application_name: "e254-unbewacht" } });
const halterDb = postgres(URL_DB, { ...opt, max: 2, connection: { application_name: "e254-halter-lange-lesung" } });
const zweit = postgres(URL_DB, { ...opt, max: 4, connection: { application_name: "e254-zweite-sitzung" } });

await roh.unsafe(`DROP TABLE IF EXISTS e254_stau; DROP TABLE IF EXISTS e254_simpel; CREATE TABLE e254_stau (id int PRIMARY KEY, a int, b text, pw text NOT NULL DEFAULT 'x');
  INSERT INTO e254_stau SELECT g, g, 'x' FROM generate_series(1, 2000) g; CREATE INDEX e254_stau_a_idx ON e254_stau (a);`);
const spalteDa = async (t: string, s: string) =>
  (await roh`SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid = to_regclass(${t}) AND attname = ${s} AND NOT attisdropped`)[0].n === 1;
const stand = () => ddlWacheStand().pool;

origLog("B) Verträglichkeit (sqlPool und drizzle-client mit Wache)");
{
  const vor = stand();
  ok((await sqlPool`SELECT 1 AS x`)[0].x === 1, "Tagged Template normal");
  const w = sqlPool`WHERE id = ${5}`;
  ok((await sqlPool`SELECT id FROM e254_stau ${w}`)[0].id === 5, "Fragment in anderem Template");
  ok((await sqlPool`SELECT ${sqlPool("a")} FROM e254_stau WHERE id = 7`)[0].a === 7, "Bezeichner sql('a')");
  ok((await sqlPool`SELECT count(*)::int AS n FROM e254_stau WHERE id IN ${sqlPool([1, 2, 3])}`)[0].n === 3, "Liste sql([..])");
  await sqlPool`INSERT INTO e254_stau ${sqlPool({ id: 9001, a: 1, b: "y" }, "id", "a", "b")}`;
  ok((await sqlPool`SELECT b FROM e254_stau WHERE id = 9001`)[0].b === "y", "Insert-Helfer sql(obj, …)");
  ok(JSON.stringify(await sqlPool`SELECT 1 AS x, 2 AS y`.values()) === "[[1,2]]", ".values() an normaler Abfrage");
  ok((await sqlPool.unsafe("SELECT $1::int AS x", [5]))[0].x === 5, "unsafe mit Parametern");
  ok((await sqlPool.unsafe("SELECT 1 AS x", [], { prepare: false }))[0].x === 1, "unsafe mit Optionen");
  ok((await sqlPool.unsafe("SELECT 2 AS x"))[0].x === 2, "unsafe ohne Parameter (keine DDL)");
  ok((await sqlPool`SELECT ${sqlPool.json({ a: 1 })}::jsonb->>'a' AS a`)[0].a === "1", "sql.json");
  const r = await sqlPool.begin(async (tx: any) => {
    await tx`SET LOCAL lock_timeout = '2s'`;
    await tx`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS im_tx int`;
    return (await tx`SELECT 1 AS x`)[0].x;
  });
  ok(r === 1 && (await spalteDa("e254_stau", "im_tx")), "begin: DDL im tx geht unbewacht durch (eigene Frist)");
  const res = await sqlPool.reserve();
  ok((await res`SELECT 3 AS x`)[0].x === 3, "reserve()");
  res.release();
  ok(typeof sqlPool === "function" && !!(sqlPool as any).options && typeof sqlPool.end === "function" && typeof sqlPool.array === "function", "typeof/options/end/array");
  const nach = stand();
  ok(nach.geprueft === vor.geprueft && nach.ausgefuehrt === vor.ausgefuehrt, "normale Abfragen und tx-DDL laufen an der Wache vorbei (Zähler unverändert)");

  const q = sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS d int`;
  ok(q instanceof Promise && typeof (q as any).execute === "function", "DDL-Objekt ist ein Promise mit .execute()");
  ok((q as any).constructor?.name === "Query" && ["simple", "values", "raw", "cursor", "forEach", "describe", "cancel", "readable", "writable"].every((m) => typeof (q as any)[m] === "function"),
    "DDL-Objekt ist die echte postgres.js-Query (alle Methoden da)");
  await schlafen(200);
  ok(!(await spalteDa("e254_stau", "d")), "DDL ist faul (läuft erst bei await)");
  await q;
  await sqlPool.unsafe(`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS e int; CREATE INDEX IF NOT EXISTS e254_stau_e_idx ON e254_stau (e)`).catch(() => {});
  ok((await spalteDa("e254_stau", "d")) && (await spalteDa("e254_stau", "e")), "DDL (Tagged + mehrteiliges unsafe mit .catch) ausgeführt");
  const r2 = await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS d int`;
  const r2roh = await roh`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS d int`;
  ok(Array.isArray(r2) && r2.length === 0 && (r2 as any).count === (r2roh as any).count && (r2 as any).command === (r2roh as any).command && JSON.stringify((r2 as any).columns) === JSON.stringify((r2roh as any).columns),
    `übersprungene DDL liefert dasselbe wie postgres.js (count ${(r2 as any).count}, command ${(r2 as any).command})`);
  const u2 = await sqlPool.unsafe(`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS e int; CREATE INDEX IF NOT EXISTS e254_stau_e_idx ON e254_stau (e)`);
  const u2roh = await roh.unsafe(`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS e int; CREATE INDEX IF NOT EXISTS e254_stau_e_idx ON e254_stau (e)`);
  ok((u2 as any).count === (u2roh as any).count && (u2 as any).command === (u2roh as any).command && (u2 as any).columns === (u2roh as any).columns,
    `übersprungene mehrteilige unsafe-DDL wie postgres.js (command ${(u2 as any).command})`);

  // Nachprüfung E-254: was ein eigenes Promise-Objekt nicht konnte.
  await sqlPool`${sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS frag int`}`;
  ok(await spalteDa("e254_stau", "frag"), "DDL als Fragment in einem anderen Template läuft (wie postgres.js)");
  const s1 = await sqlPool`CREATE TABLE IF NOT EXISTS e254_simpel (id int); CREATE INDEX IF NOT EXISTS e254_simpel_i ON e254_simpel (id)`.simple();
  const s2 = await sqlPool`CREATE TABLE IF NOT EXISTS e254_simpel (id int); CREATE INDEX IF NOT EXISTS e254_simpel_i ON e254_simpel (id)`.simple();
  ok((s1 as any).command === "CREATE INDEX" && (s2 as any).command === "CREATE INDEX" && (s2 as any).count === null, ".simple() mit mehrteiliger DDL: neu angelegt und danach übersprungen (command CREATE INDEX)");
  await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS fe int`.forEach(() => {});
  ok(await spalteDa("e254_stau", "fe"), ".forEach() an DDL läuft (ungebremst wie vor E-254)");
  for await (const _ of sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS cu int`.cursor()) { /* keine Zeilen */ }
  await schlafen(200); // postgres.js meldet den Cursor fertig, bevor das Sync (= Commit) durch ist — auch roh
  ok(await spalteDa("e254_stau", "cu"), ".cursor() an DDL läuft (ungebremst wie vor E-254)");
  const qc = sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS ca int`;
  qc.cancel();
  const ec = await qc.then(() => "ok", (e: any) => e?.code);
  ok(ec === "57014" && !(await spalteDa("e254_stau", "ca")), "cancel() vor dem Start: 57014 wie postgres.js, nichts ausgeführt");

  // drizzle über den eingewickelten client
  await db.execute(dsql`DO $$ BEGIN ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS dz int; END $$`);
  ok(await spalteDa("e254_stau", "dz"), "drizzle db.execute(DO $$ … $$) läuft (bewacht)");
  const dr = await db.execute(dsql`SELECT ${5}::int AS x`);
  ok((dr as any)[0]?.x === 5, "drizzle db.execute mit Parameter");
  const du = await db.select({ id: users.id }).from(users).limit(1);
  ok(Array.isArray(du), "drizzle select (…).from(users) über .values()");
  ok((await client`SELECT 4 AS x`)[0].x === 4, "db.ts-client Tagged Template");
  ok(ddlWacheStand().drizzle.ausgefuehrt >= 1, "drizzle-client hat eine eigene Wache");

  // Not-Aus
  process.env.DDL_WACHE = "aus";
  const leer = postgres(URL_DB, { ...opt, max: 1 });
  ok(ddlWache(leer, "aus-probe") === leer, "DDL_WACHE=aus liefert den rohen Client");
  delete process.env.DDL_WACHE;
  await leer.end();
}

// ═══════════════════════════════════════════════════════════════════════════
// C — STAU-SIMULATION
// ═══════════════════════════════════════════════════════════════════════════
/** Verbindung A: BEGIN; SELECT … FROM <tabellen> — hält die Lesesperre bis freigeben(). */
async function halten(tabellen: string[]) {
  let loslassen!: () => void;
  const los = new Promise<void>((r) => (loslassen = r));
  let bereit!: () => void;
  const b = new Promise<void>((r) => (bereit = r));
  const fertig = halterDb.begin(async (t: any) => {
    await t.unsafe(`SELECT count(*) FROM ${tabellen.join(", ")} WHERE false`);
    bereit();
    await los;
  }).catch((e: any) => origLog("   Halter:", e?.message));
  await b;
  return async () => { loslassen(); await fertig; };
}

type Messung = { max: number; median: number; n: number; fehler: number };
/** SELECT und UPDATE auf der Tabelle alle 100 ms über sqlPool, bis stopp(). */
function dauerlast(tabelle: string, spalte: string, idSpalte = "id") {
  const sel: number[] = [], upd: number[] = [];
  let laeuft = true, fehlerN = 0;
  const schleife = (async () => {
    while (laeuft) {
      const t0 = Date.now();
      const s = sqlPool.unsafe(`SELECT count(*) FROM ${tabelle}`).then(() => sel.push(Date.now() - t0), () => { fehlerN++; sel.push(Date.now() - t0); });
      const u = sqlPool.unsafe(`UPDATE ${tabelle} SET ${spalte} = ${spalte} WHERE ${idSpalte} = (SELECT min(${idSpalte}) FROM ${tabelle})`).then(() => upd.push(Date.now() - t0), () => { fehlerN++; upd.push(Date.now() - t0); });
      await Promise.all([s, u]);
      await schlafen(100);
    }
  })();
  const auswerten = (l: number[]): Messung => {
    const s = [...l].sort((a, b) => a - b);
    return { max: s.at(-1) ?? 0, median: s[s.length >> 1] ?? 0, n: s.length, fehler: fehlerN };
  };
  return async () => { laeuft = false; await schleife; return { select: auswerten(sel), update: auswerten(upd) }; };
}
const nichtGewaehrt = async () => (await zweit`SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`)[0].n;
const fmt = (m: { select: Messung; update: Messung }) => `SELECT max ${m.select.max} ms (Median ${m.select.median}, n=${m.select.n}), UPDATE max ${m.update.max} ms (n=${m.update.n})`;
const messwerte: Record<string, string> = {};

origLog("C) Stau-Simulation (Verbindung A hält BEGIN; SELECT … offen)");

// C1 — OHNE Wache
{
  const frei = await halten(["e254_stau"]);
  const stopp = dauerlast("e254_stau", "b");
  await schlafen(300);
  const t0 = Date.now();
  const ddl = unbewacht`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS a int`.then(() => Date.now() - t0);
  await schlafen(1500);
  const wartend = await nichtGewaehrt();
  await schlafen(4500);
  await frei(); // nach 6 s gibt A frei
  const dauer = await ddl;
  await schlafen(300);
  const m = await stopp();
  messwerte["C1 ohne Wache, Spalte da, A hält 6 s"] = `ALTER ${dauer} ms · ${fmt(m)} · wartende Sperren ${wartend}`;
  origLog("   " + messwerte["C1 ohne Wache, Spalte da, A hält 6 s"]);
  ok(m.select.max > 4000 && m.update.max > 4000 && wartend > 0, `OHNE Wache: SELECT/UPDATE stauen sich hinter dem ALTER (${m.select.max} / ${m.update.max} ms) — Vergleich`);
}

// C2 — MIT Wache, Spalte schon da (der Normalfall bei jedem Deploy)
{
  ddlWacheVergessen();
  const frei = await halten(["e254_stau"]);
  const stopp = dauerlast("e254_stau", "b");
  await schlafen(300);
  const t0 = Date.now();
  let flagge = false;
  async function ensureE254() {
    if (flagge) return;
    await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS a int, ADD COLUMN IF NOT EXISTS b text`;
    await sqlPool`ALTER TABLE e254_stau ALTER COLUMN b DROP NOT NULL`;
    await sqlPool`CREATE INDEX IF NOT EXISTS e254_stau_a_idx ON e254_stau (a)`;
    await sqlPool.unsafe(`CREATE TABLE IF NOT EXISTS e254_stau (id int PRIMARY KEY)`);
    flagge = true;
  }
  await Promise.all(Array.from({ length: 20 }, ensureE254));
  const dauer = Date.now() - t0;
  const wartend = await nichtGewaehrt();
  await schlafen(1500);
  const m = await stopp();
  await frei();
  messwerte["C2 mit Wache, Spalte da, 20× ensure"] = `Schema-Funktion ${dauer} ms · ${fmt(m)} · wartende Sperren ${wartend}`;
  origLog("   " + messwerte["C2 mit Wache, Spalte da, 20× ensure"]);
  ok(dauer < 1000 && wartend === 0, `MIT Wache: 20 gleichzeitige Schema-Funktionen fertig in ${dauer} ms, keine wartende Sperre`);
  ok(m.select.max < 1000 && m.update.max < 1000 && m.select.fehler === 0, `MIT Wache: SELECT/UPDATE ohne Stau (${m.select.max} / ${m.update.max} ms)`);
}

// C3 — echte Schema-Funktionen unter Halter
{
  // Vorlauf in einem eigenen Prozess: bringt die Prüfstand-Kopie auf den Stand
  // (wie die Produktion, in der alles schon da ist). Danach ruft DIESER Prozess
  // die Funktionen zum ersten Mal auf — ihre Flagge ist noch false.
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    `const a = await import("./server/routes/fiaon-agent.ts"); await a.ensureAgentTables();
     const k = await import("./server/lib/fiaon-kunde-aktiv.ts"); await k.ensureSperrProtokoll(); process.exit(0);`],
    { cwd: WURZEL, env: process.env, stdio: ["ignore", "ignore", "inherit"], timeout: 180_000 });
  ddlWacheVergessen();
  const { ensureAgentTables } = await import("../server/routes/fiaon-agent");
  const { ensureSperrProtokoll } = await import("../server/lib/fiaon-kunde-aktiv");

  // Vergleich ohne Wache: genau die Anweisung vom 28.09.
  let frei = await halten(["fiaon_agents"]);
  let stopp = dauerlast("fiaon_agents", "name");
  await schlafen(300);
  const t1 = Date.now();
  const alt = unbewacht`ALTER TABLE fiaon_agents ALTER COLUMN password_hash DROP NOT NULL`.then(() => Date.now() - t1);
  await schlafen(4000);
  await frei();
  const altDauer = await alt;
  let m = await stopp();
  messwerte["C3 ohne Wache: ALTER fiaon_agents … DROP NOT NULL, A hält 4 s"] = `ALTER ${altDauer} ms · ${fmt(m)}`;
  origLog("   " + messwerte["C3 ohne Wache: ALTER fiaon_agents … DROP NOT NULL, A hält 4 s"]);
  ok(m.select.max > 3000, `OHNE Wache: Lesungen auf fiaon_agents stauen sich (${m.select.max} ms) — so am 28.09.`);

  frei = await halten(["fiaon_agents", "fiaon_persons"]);
  stopp = dauerlast("fiaon_agents", "name");
  const stoppP = dauerlast("fiaon_persons", "is_blocked");
  await schlafen(300);
  const t2 = Date.now();
  await Promise.all(Array.from({ length: 20 }, () => ensureAgentTables()));
  const dA = Date.now() - t2;
  const t3 = Date.now();
  await ensureSperrProtokoll();
  const dP = Date.now() - t3;
  const wartend = await nichtGewaehrt();
  await schlafen(1000);
  m = await stopp();
  const mp = await stoppP();
  await frei();
  messwerte["C3 mit Wache: 20× ensureAgentTables + ensureSperrProtokoll unter Halter"] = `ensureAgentTables ${dA} ms, ensureSperrProtokoll ${dP} ms · fiaon_agents ${fmt(m)} · fiaon_persons ${fmt(mp)} · wartende Sperren ${wartend}`;
  origLog("   " + messwerte["C3 mit Wache: 20× ensureAgentTables + ensureSperrProtokoll unter Halter"]);
  ok(dA < 2000 && dP < 1000 && wartend === 0, `MIT Wache: echte Schema-Funktionen unter Halter fertig (${dA} / ${dP} ms), keine wartende Sperre`);
  ok(m.select.max < 1000 && mp.select.max < 1000 && m.update.max < 1000 && mp.update.max < 1000, "MIT Wache: fiaon_agents/fiaon_persons lesen und schreiben ohne Stau");
  ok(!logs.some((z) => /ausgeführt in .*fiaon_(agents|persons)/.test(z)), "keine Sperre auf fiaon_agents/fiaon_persons angefordert (nichts ausgeführt)");
}

// C4 — MIT Wache, Spalte wirklich neu, 20 gleichzeitig
{
  ddlWacheVergessen();
  const frei = await halten(["e254_stau"]);

  // C6a — verschluckter Fehler (Flaggen-Muster mit .catch(() => {})): zuerst,
  // damit sein Nachholen im Hintergrund später sicher VOR dem Ende läuft.
  let geschluckt = false;
  await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_y int`.catch(() => { geschluckt = true; });
  ok(geschluckt && !(await spalteDa("e254_stau", "neu_y")), "verschluckte DDL unter Halter: Fehler geschluckt, Spalte fehlt noch");

  const stopp = dauerlast("e254_stau", "b");
  await schlafen(300);
  const vor = stand();
  const t0 = Date.now();
  const alle = Array.from({ length: 20 }, () => sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x int`.then(() => "ok", (e: any) => e?.code || "?"));
  // Pool-Probe: 12 andere Abfragen, während die Wache wartet
  await schlafen(500);
  const tp = Date.now();
  await Promise.all(Array.from({ length: 12 }, () => sqlPool`SELECT pg_sleep(0.05)`));
  const poolMs = Date.now() - tp;
  const erg = await Promise.all(alle);
  const tFehler = Date.now();
  const dauer = tFehler - t0;
  await schlafen(300);
  const m = await stopp();
  const nach = stand();
  messwerte["C4 mit Wache, Spalte neu, 20× gleichzeitig, A hält"] = `zurück nach ${dauer} ms (${[...new Set(erg)].join(",")}) · ${fmt(m)} · Pool 12 Abfragen in ${poolMs} ms · Sperrversuche ${nach.sperrVersuche - vor.sperrVersuche}, Einmal-Flug ${nach.einmalFlug - vor.einmalFlug}`;
  origLog("   " + messwerte["C4 mit Wache, Spalte neu, 20× gleichzeitig, A hält"]);
  ok(erg.every((e) => e === "55P03") && dauer <= 3600, `Sperre nicht frei: alle 20 kommen nach ${dauer} ms (≤ ~3 s) mit 55P03 zurück statt zu warten`);
  ok(logs.some((z) => z === "[DB] DDL wartete zu lange auf Sperre — später erneut: ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x int"), "Log-Zeile „[DB] DDL wartete zu lange auf Sperre — später erneut: …“");
  ok(logs.some((z) => z.includes("e254-halter-lange-lesung") && z.includes("SELECT count(*) FROM e254_stau")), "Log nennt den Halter (application_name und Abfrage)");
  ok(m.select.max < 1000 && m.update.max < 1000, `SELECT/UPDATE daneben < 1 s (${m.select.max} / ${m.update.max} ms)`);
  ok(poolMs < 1500, `Pool bleibt frei (12 Abfragen in ${poolMs} ms)`);
  ok(nach.einmalFlug - vor.einmalFlug === 19 && nach.aufgegeben - vor.aufgegeben === 1, "Einmal-Flug: 1 Sperr-Serie statt 20");

  // C5 — Abkühlzeit
  const t1 = Date.now();
  const e5 = await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x int`.then(() => "ok", (e: any) => e?.code);
  const d5 = Date.now() - t1;
  ok(e5 === "55P03" && d5 < 50 && stand().sperrVersuche === nach.sperrVersuche, `Abkühlzeit: sofort zurück (${d5} ms), kein neuer Sperrversuch`);
  messwerte["C5 Abkühlzeit"] = `${d5} ms, kein Sperrversuch`;

  // C5b — nach der ersten Pause (3 s) hält A noch: die Wache sieht im Katalog
  // nach und weist weiter ab — ohne neuen Sperrversuch (E-254-Nachprüfung).
  await schlafen(Math.max(0, tFehler + 3300 - Date.now()));
  const v5b = stand().sperrVersuche;
  const t5b = Date.now();
  const e5b = await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x int`.then(() => "ok", (e: any) => e?.code);
  const d5b = Date.now() - t5b;
  ok(e5b === "55P03" && d5b < 200 && stand().sperrVersuche === v5b, `Abkühlzeit nach der ersten Pause: Halter noch da → abgewiesen in ${d5b} ms, ohne Sperrversuch`);

  // C6 — A gibt frei; der nächste Aufruf (nach dem 1-s-Takt des Nachsehens)
  // läuft durch — oder das Nachholen im Hintergrund war schneller.
  const nachgeholtVor = stand().nachgeholt;
  await frei();
  await schlafen(1100);
  const t2 = Date.now();
  await sqlPool`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x int`;
  const d6 = Date.now() - t2;
  ok((await spalteDa("e254_stau", "neu_x")) && (logs.some((z) => /: ausgeführt in \d+ ms: ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS neu_x/.test(z)) || stand().nachgeholt > nachgeholtVor),
    `nach Freigabe von A: der nächste Aufruf selbst legt neu_x an (${d6} ms${stand().nachgeholt > nachgeholtVor ? ", Hintergrund war schneller" : ""})`);
  let nachgeholt = false;
  for (let i = 0; i < 40 && !nachgeholt; i++) { nachgeholt = await spalteDa("e254_stau", "neu_y"); if (!nachgeholt) await schlafen(250); }
  ok(nachgeholt && logs.some((z) => z.includes("nachgeholt in") && z.includes("neu_y")), "verschluckte DDL: die Wache holt sie im Hintergrund selbst nach (keine Spalte fehlt bis zum Neustart)");
  messwerte["C6 nach Freigabe"] = `nächster Aufruf ${d6} ms durch; neu_y ohne Aufruf im Hintergrund nachgeholt: ${nachgeholt}`;
}

// C7 — Abkühlzeit mit der VORGABE (60 s), an den Halter gekoppelt. Nachprüfung
// E-254: vorher wies die Wache 60 s nach der Uhr ab — Halter 4 s → 60 Fehlaufrufe,
// erster Erfolg nach 63.227 ms. Aufruf 1× je Sekunde wie ensureAgentTables je Anfrage.
for (const halteMs of [4000, 10_000]) {
  const merk: string | undefined = process.env.DDL_ABKUEHLEN_S;
  delete process.env.DDL_ABKUEHLEN_S;
  const w7: any = ddlWache(postgres(URL_DB, { ...opt, max: 6, connection: { application_name: "e254-c7" } }), `c7-${halteMs}`, { log: (z) => logs.push(z) });
  process.env.DDL_ABKUEHLEN_S = merk;
  const spalte = `neu_c7_${halteMs}`;
  const frei = await halten(["e254_stau"]);
  const t0 = Date.now();
  let freiNach = -1;
  const loslassen = schlafen(halteMs).then(async () => { await frei(); freiNach = Date.now() - t0; });
  let erster = -1, fehl = 0, langsam = 0;
  const verlauf: string[] = [];
  let versucheBeiFreigabe = -1;
  while (Date.now() - t0 < 75_000 && erster < 0) {
    const a = Date.now();
    try { await w7.unsafe(`ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS ${spalte} int`); erster = Date.now() - t0; verlauf.push(`t=${a - t0} ok`); }
    catch (e: any) { fehl++; if (Date.now() - a > 200) langsam++; verlauf.push(`t=${a - t0} ${e?.code} ${Date.now() - a}ms`); }
    if (freiNach < 0) versucheBeiFreigabe = ddlWacheStand()[`c7-${halteMs}`].sperrVersuche;
    await schlafen(1000);
  }
  await loslassen;
  const st = ddlWacheStand()[`c7-${halteMs}`];
  await w7.end({ timeout: 2 });
  const label = `C7 Vorgabe 60 s, Halter ${halteMs / 1000} s, 1 Aufruf/s`;
  messwerte[label] = `Halter frei nach ${freiNach} ms · erster Erfolg nach ${erster} ms (${erster - freiNach} ms nach Freigabe) · Fehlaufrufe ${fehl}, davon mit Sperr-Serie ${langsam} · Sperrversuche ${st.sperrVersuche} · ${verlauf.slice(0, 3).join(" | ")} … ${verlauf.slice(-2).join(" | ")}`;
  origLog("   " + label + ": " + messwerte[label]);
  ok(erster > 0 && erster - freiNach <= 3500, `${label}: erster Erfolg ${erster - freiNach} ms nach Freigabe (vorher 59 s danach)`);
  ok(langsam === 1 && versucheBeiFreigabe >= 1 && versucheBeiFreigabe <= 6, `${label}: nur EINE Sperr-Serie, solange der Halter hält (${versucheBeiFreigabe} Versuche; Fehlaufrufe ${fehl}, davon ${langsam} mit Wartezeit)`);
}

// C8 — Buchungs-Texte gehen an der Wache vorbei (E-254-Nachprüfung): hinter einer
// Zeilensperre (2,5 s) warten sie und laufen durch — wie vor E-254 — statt nach
// 3 s mit 55P03 zu scheitern und 60 s lang denselben Fehler zu bekommen.
{
  const vor = stand();
  let gesperrt!: () => void;
  const zeileGesperrt = new Promise<void>((r) => (gesperrt = r));
  const halter8 = halterDb.begin(async (t: any) => { await t`SELECT * FROM e254_stau WHERE id = 1 FOR UPDATE`; gesperrt(); await schlafen(2500); });
  await zeileGesperrt;
  const t0 = Date.now();
  const DO_TEXT = `DO $$ BEGIN\n  -- früher stand hier ein ALTER TABLE; heute nur noch die Buchung\n  UPDATE e254_stau SET a = a WHERE id = 1;\nEND $$`;
  const MISCH = `CREATE TABLE IF NOT EXISTS e254_stau (id int PRIMARY KEY); UPDATE e254_stau SET a = a WHERE id = 1`;
  const [e1, e2] = await Promise.all([
    sqlPool.unsafe(DO_TEXT).then(() => Date.now() - t0, (e: any) => `FEHLER ${e?.code}`),
    sqlPool.unsafe(MISCH).then(() => Date.now() - t0, (e: any) => `FEHLER ${e?.code}`),
  ]);
  await halter8;
  const nochmal = await sqlPool.unsafe(DO_TEXT).then(() => "ok", (e: any) => `FEHLER ${e?.code}`);
  const nach = stand();
  messwerte["C8 Buchung hinter Zeilensperre 2,5 s"] = `DO-Block (ALTER TABLE nur im Kommentar): ${e1} ms · Mischtext: ${e2} ms · sofort erneut: ${nochmal}`;
  origLog("   " + messwerte["C8 Buchung hinter Zeilensperre 2,5 s"]);
  ok(typeof e1 === "number" && typeof e2 === "number" && e1 >= 2000 && e2 >= 2000 && nochmal === "ok", `Buchungs-Texte warten hinter der Zeilensperre und laufen durch (${e1} / ${e2} ms), danach sofort erneut: ${nochmal}`);
  ok(nach.geprueft === vor.geprueft && nach.ausgefuehrt === vor.ausgefuehrt && nach.aufgegeben === vor.aufgegeben && nach.abkuehlung === vor.abkuehlung, "… und laufen an der Wache vorbei (Zähler unverändert)");
}

// ═══════════════════════════════════════════════════════════════════════════
// S — SIGTERM ÜBER DEN STARTBEFEHL
// ═══════════════════════════════════════════════════════════════════════════
origLog("S) SIGTERM: npm run start → Shell → node");
{
  const pkg = JSON.parse(fs.readFileSync(path.join(WURZEL, "package.json"), "utf8"));
  const START = String(pkg.scripts.start);
  const ALT = `npm run db:migrate:sql && PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright" NODE_ENV=production node dist/index.js`;
  ok(/&& exec node dist\/index\.js$/.test(START) && START.startsWith("npm run db:migrate:sql && "), "package.json start: Migration davor, node per exec");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e254-sig-"));
  fs.mkdirSync(path.join(dir, "dist"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "e254-sig", private: true, scripts: { "db:migrate:sql": "node mig.js", start: START, start_alt: ALT } }));
  fs.writeFileSync(path.join(dir, "mig.js"), `console.log("[MIGRATE] ok"); process.exit(Number(process.env.MIG_EXIT || 0));`);
  fs.writeFileSync(path.join(dir, "dist", "index.js"), `console.log("[APP] pid=" + process.pid + " ppid=" + process.ppid + " NODE_ENV=" + process.env.NODE_ENV + " PW=" + (process.env.PLAYWRIGHT_BROWSERS_PATH ? "gesetzt" : "fehlt"));
process.once("SIGTERM", () => { console.log("[HERUNTERFAHREN] SIGTERM angekommen"); setTimeout(() => process.exit(0), 100); });
setInterval(() => {}, 1000);`);
  async function probe(skript: string, shell: string, migExit = 0) {
    const kind = spawn("npm", ["run", skript, `--script-shell=${shell}`], { cwd: dir, detached: true, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, MIG_EXIT: String(migExit) } });
    let aus = "";
    kind.stdout.on("data", (d) => (aus += d));
    kind.stderr.on("data", (d) => (aus += d));
    const ende = new Promise<number | null>((r) => kind.on("exit", (c) => r(c)));
    for (let i = 0; i < 100 && !aus.includes("[APP]") && kind.exitCode === null; i++) await schlafen(100);
    const gestartet = aus.includes("[APP]");
    if (gestartet) process.kill(kind.pid!, "SIGTERM");
    for (let i = 0; i < 30 && !aus.includes("[HERUNTERFAHREN]"); i++) await schlafen(100);
    try { process.kill(-kind.pid!, "SIGKILL"); } catch { /* schon weg */ }
    const code = await Promise.race([ende, schlafen(2000).then(() => null)]);
    return { gestartet, angekommen: aus.includes("[HERUNTERFAHREN]"), env: /NODE_ENV=production PW=gesetzt/.test(aus), code };
  }
  const shells = ["/bin/sh", "/bin/bash", "/bin/dash"].filter((s) => fs.existsSync(s));
  for (const sh of shells) {
    const neu = await probe("start", sh);
    ok(neu.gestartet && neu.angekommen && neu.env, `neuer Startbefehl unter ${sh}: node bekommt SIGTERM, NODE_ENV/PLAYWRIGHT gesetzt`);
    const kaputt = await probe("start", sh, 1);
    ok(!kaputt.gestartet && kaputt.code !== 0, `neuer Startbefehl unter ${sh}: Migration mit Fehlercode → node startet nicht`);
    const alt = await probe("start_alt", sh);
    origLog(`   alter Befehl unter ${sh}: SIGTERM ${alt.angekommen ? "kommt an" : "kommt NICHT an"}`);
    messwerte[`S alt/neu unter ${sh}`] = `alt: ${alt.angekommen ? "kommt an" : "kommt NICHT an"} · neu: ${neu.angekommen ? "kommt an" : "kommt NICHT an"}`;
    if (sh === "/bin/bash") ok(!alt.angekommen, "Vergleich: alter Befehl unter bash — SIGTERM kommt NICHT an");
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// M — MIGRATION HINTER BESETZTER TABELLE (E-254-Nachprüfung)
// Vorher: nach drei Sperr-Versuchen „FAIL" und Exit 0 → der neue Code startete
// ohne die Tabellen-Änderung. Jetzt: Exit 1 mit Halter im Log. Echter Runner
// (Kopie von scripts/run-migrations.mjs) mit zwei Prüf-Dateien in einem
// eigenen Ordner: 998 hat einen Syntaxfehler (FAIL wie bisher → Exit 0), 999
// braucht die Sperre auf e254_stau.
// ═══════════════════════════════════════════════════════════════════════════
origLog("M) Migration hinter besetzter Tabelle");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e254-mig-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.mkdirSync(path.join(dir, "db", "migrations"), { recursive: true });
  fs.copyFileSync(path.join(WURZEL, "scripts", "run-migrations.mjs"), path.join(dir, "scripts", "run-migrations.mjs"));
  fs.symlinkSync(path.join(WURZEL, "node_modules"), path.join(dir, "node_modules"));
  const KAPUTT = "998_e254_pruef_kaputt.sql", SPERRE = "999_e254_pruef_sperre.sql";
  fs.writeFileSync(path.join(dir, "db", "migrations", KAPUTT), "SELEC 1;\n");
  fs.writeFileSync(path.join(dir, "db", "migrations", SPERRE), "ALTER TABLE e254_stau ADD COLUMN IF NOT EXISTS mig_neu int;\n");
  async function migrieren(extra: Record<string, string> = {}) {
    const t0 = Date.now();
    const kind = spawn(process.execPath, ["scripts/run-migrations.mjs"], {
      cwd: dir, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, DATABASE_URL: URL_DB, DOTENV_CONFIG_PATH: "/dev/null", ...extra },
    });
    let aus = "";
    kind.stdout.on("data", (d) => (aus += d));
    kind.stderr.on("data", (d) => (aus += d));
    const code = await new Promise<number | null>((r) => kind.on("exit", (c) => r(c)));
    return { code, aus, ms: Date.now() - t0 };
  }
  const zeile = (aus: string, re: RegExp) => aus.split("\n").find((z) => re.test(z)) ?? "";

  let frei = await halten(["e254_stau"]);
  const m1 = await migrieren();
  await frei();
  origLog(`   Halter da: Exit ${m1.code} nach ${m1.ms} ms · ${zeile(m1.aus, /Done\./).trim()}`);
  origLog(`     │ ${zeile(m1.aus, /🔒/).trim().slice(0, 220)}`);
  ok(m1.code === 1 && /🛑 ABBRUCH/.test(m1.aus) && /🔒 999_e254_pruef_sperre\.sql: Tabelle besetzt — pid \d+ \(e254-halter-lange-lesung/.test(m1.aus) && !(await spalteDa("e254_stau", "mig_neu")),
    `Migration hinter besetzter Tabelle: Exit 1 (node startet nicht), Log nennt Datei und Halter (${m1.ms} ms)`);
  messwerte["M Migration hinter Halter"] = `Exit ${m1.code} nach ${m1.ms} ms`;

  frei = await halten(["e254_stau"]);
  const m2 = await migrieren({ MIGRATE_SPERRFEHLER: "weiter" });
  await frei();
  ok(m2.code === 0 && /MIGRATE_SPERRFEHLER=weiter/.test(m2.aus), `Not-Aus MIGRATE_SPERRFEHLER=weiter: Exit 0 wie vor E-254 (${m2.ms} ms)`);

  const m3 = await migrieren();
  origLog(`   ohne Halter: Exit ${m3.code} nach ${m3.ms} ms · ${zeile(m3.aus, /Done\./).trim()}`);
  ok(m3.code === 0 && /Applied: 1, Skipped: \d+, Failed: 1/.test(m3.aus) && (await spalteDa("e254_stau", "mig_neu")),
    "ohne Halter: angewendet; der Syntaxfehler bleibt FAIL mit Exit 0 wie bisher");
  await roh`DELETE FROM schema_migrations WHERE filename IN (${KAPUTT}, ${SPERRE})`;
  fs.rmSync(dir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// D — ECHTER SERVER (nur mit --server)
// ═══════════════════════════════════════════════════════════════════════════
if (SERVER_JS) {
  origLog(`D) Echter Server gegen den Prüfstand (${path.relative(WURZEL, SERVER_JS)})`);
  const PORT = 5254;
  const [agent] = await roh`SELECT id, session_epoch FROM fiaon_agents WHERE active AND zugang_gesperrt_am IS NULL ORDER BY id LIMIT 1`;
  const exp = Date.now() + 3600_000;
  const nutzlast = `${agent.id}.${Number(agent.session_epoch)}.${exp}`;
  const sig = createHmac("sha256", process.env.SESSION_SECRET || "fiaon-dev-agent-secret").update(`agent2:${nutzlast}`).digest("hex").slice(0, 40);
  const COOKIE = `fiaon_agent_token=${nutzlast}.${sig}`;

  function serverStarten(extra: Record<string, string>) {
    const env: Record<string, string> = {
      PATH: process.env.PATH!, HOME: process.env.HOME!, DATABASE_URL: URL_DB,
      SESSION_SECRET: process.env.SESSION_SECRET || "pruefstand-nur-lokal", DOTENV_CONFIG_PATH: "/dev/null",
      NODE_ENV: "production", PORT: String(PORT), CRONS: "aus", ...extra,
    };
    const kind = spawn(process.execPath, [SERVER_JS!], { cwd: WURZEL, env, detached: true });
    const zeilen: string[] = [];
    const lesen = (d: Buffer) => zeilen.push(...String(d).split("\n").filter(Boolean));
    kind.stdout!.on("data", lesen);
    kind.stderr!.on("data", lesen);
    return { kind, zeilen };
  }
  async function stoppen(k: ChildProcess) {
    try { process.kill(k.pid!, "SIGTERM"); } catch { /* weg */ }
    for (let i = 0; i < 50 && k.exitCode === null && k.signalCode === null; i++) await schlafen(100);
    try { process.kill(-k.pid!, "SIGKILL"); } catch { /* weg */ }
    await schlafen(300);
    // Ein Backend, das auf eine Sperre wartet, merkt das Ende seines Clients
    // nicht — Reste des Servers in DIESER Prüfstand-Kopie beenden.
    await roh`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'postgres.js' AND pid <> pg_backend_pid()`;
    for (let i = 0; i < 20 && (await nichtGewaehrt()) > 0; i++) await schlafen(250);
  }
  async function holen(pfad: string, mitCookie: boolean, frist = 20_000) {
    const t0 = Date.now();
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${pfad}`, { headers: mitCookie ? { cookie: COOKIE } : {}, signal: AbortSignal.timeout(frist) });
      await r.arrayBuffer();
      return { status: r.status, ms: Date.now() - t0 };
    } catch { return { status: 0, ms: Date.now() - t0 }; }
  }
  async function bereit(sek: number) {
    for (let i = 0; i < sek * 4; i++) { if ((await holen("/healthz", false, 1000)).status === 200) return true; await schlafen(250); }
    return false;
  }
  async function messenServer(label: string, sek: number) {
    const health: number[] = [], agentMs: number[] = [], leseMs: number[] = [];
    const agentStatus: Record<string, number> = {};
    let maxWartend = 0;
    const ende = Date.now() + sek * 1000;
    const herde = Promise.all(Array.from({ length: 20 }, () => holen("/api/fiaon/agent/me", true, sek * 1000)));
    const direkt = (async () => {
      while (Date.now() < ende) {
        const t0 = Date.now();
        await zweit.begin(async (t: any) => { await t`SET LOCAL statement_timeout = '15s'`; await t`SELECT count(*) FROM fiaon_agents`; }).catch(() => {});
        leseMs.push(Date.now() - t0);
        await schlafen(500);
      }
    })();
    while (Date.now() < ende) {
      const [h, a] = await Promise.all([holen("/healthz", false, 5000), holen("/api/fiaon/agent/me", true, 5000)]);
      health.push(h.status === 200 ? h.ms : 99_999);
      agentMs.push(a.status === 200 ? a.ms : 99_999);
      agentStatus[a.status] = (agentStatus[a.status] || 0) + 1;
      maxWartend = Math.max(maxWartend, (await zweit`SELECT count(*)::int AS n FROM pg_locks l WHERE NOT l.granted AND l.relation = ANY (ARRAY[to_regclass('fiaon_agents'), to_regclass('fiaon_contact_log'), to_regclass('fiaon_applications'), to_regclass('fiaon_whatsapp')])`)[0].n);
      await schlafen(500);
    }
    const h20 = await herde;
    await direkt;
    const max = (l: number[]) => Math.max(0, ...l);
    const herdeOk = h20.filter((x) => x.status === 200);
    const zeile = `/healthz max ${max(health)} ms · /agent/me max ${max(agentMs)} ms (Status ${JSON.stringify(agentStatus)}) · 20er-Herde: ${herdeOk.length}× 200, max ${max(h20.map((x) => x.ms))} ms (Status ${[...new Set(h20.map((x) => x.status))].join(",")}) · direkte Lesung fiaon_agents max ${max(leseMs)} ms · wartende Sperren max ${maxWartend}`;
    messwerte[label] = zeile;
    origLog("   " + label + ": " + zeile);
    return { health: max(health), agent: max(agentMs), herdeOk: herdeOk.length, herdeMax: max(h20.map((x) => x.ms)), lesen: max(leseMs), wartend: maxWartend, agentStatus };
  }
  const HALTE = ["fiaon_agents", "fiaon_contact_log", "fiaon_applications", "fiaon_whatsapp"];

  // D0 — Vorlauf ohne Halter: Startlog sauber, /healthz 200
  {
    const s = serverStarten({});
    const da = await bereit(120);
    await schlafen(5000);
    const a = await holen("/api/fiaon/agent/me", true);
    await stoppen(s.kind);
    // Ausnahme: Der lokale Prüfstand hat kein pgvector — „extension vector is not
    // available" (JARVIS/knowledge_base, ARAS-Altlast) kommt hier bei JEDEM Start,
    // auch ohne E-254; in der Produktion ist die Erweiterung da.
    const ddlFehler = s.zeilen.filter((z) => /\[DB\] DDL wartete|Nachholen gescheitert|AUFGEGEBEN|migration error|lock timeout/i.test(z)
      && !/extension "vector" is not available/.test(z));
    const ausgefuehrt = s.zeilen.filter((z) => z.includes("[DDL-WACHE]") && z.includes("ausgeführt in"));
    origLog(`   Vorlauf: /healthz ${da ? 200 : "—"}, /agent/me ${a.status}, [DDL-WACHE] ausgeführt ${ausgefuehrt.length}, DDL-Fehler ${ddlFehler.length}`);
    for (const z of ddlFehler) origLog("     ! " + z.slice(0, 200));
    const sonstige = s.zeilen.filter((z) => /error|fehler|❌|⚠️/i.test(z) && !ddlFehler.includes(z));
    origLog(`   weitere Fehler-/Warnzeilen im Startlog (zur Sicht, nicht DDL-Sperren): ${sonstige.length}`);
    for (const z of sonstige.slice(0, 25)) origLog("     ? " + z.slice(0, 180));
    ok(da && a.status === 200, "Serverstart gegen die Prüfstand-Kopie: /healthz 200, Agenten-Route 200");
    ok(ddlFehler.length === 0, "keine DDL-Fehler im Startlog");
    ok(s.zeilen.some((z) => z.includes("[HERUNTERFAHREN] SIGTERM")), "SIGTERM an node: „[HERUNTERFAHREN]“ im Log");
    ok(s.zeilen.some((z) => z.startsWith("[START] pid")), "Startzeile mit Elternprozess im Log");
  }

  // D1 — Halter + Server OHNE Wache (DDL_WACHE=aus): der 28.09.
  {
    const frei = await halten(HALTE);
    const s = serverStarten({ DDL_WACHE: "aus" });
    const da = await bereit(40);
    const m = await messenServer("D1 Server mit DDL_WACHE=aus, Halter auf 4 Tabellen, 40 s", 40);
    await stoppen(s.kind);
    await frei();
    ok(!da || m.herdeOk === 0 || m.lesen > 5000 || m.wartend > 0, `OHNE Wache staut sich der Server wie am 28.09. (/healthz ${da ? "da" : "nie bereit"}, Herde ${m.herdeOk}/20 ok, wartende Sperren ${m.wartend})`);
  }

  // D2 — Halter + Server MIT Wache
  {
    const frei = await halten(HALTE);
    const s = serverStarten({});
    const da = await bereit(60);
    const m = await messenServer("D2 Server mit Wache, Halter auf 4 Tabellen, 40 s", 40);
    const zusammen = s.zeilen.filter((z) => z.includes("[DDL-WACHE]") || z.startsWith("[DB]"));
    await stoppen(s.kind);
    await frei();
    for (const z of zusammen.slice(0, 12)) origLog("     │ " + z.slice(0, 220));
    ok(da && m.herdeOk === 20 && m.agent < 1000 && m.health < 200 && m.lesen < 1000 && m.wartend === 0,
      `MIT Wache: kein Stau (Herde 20/20, /agent/me max ${m.agent} ms, /healthz max ${m.health} ms, Lesung max ${m.lesen} ms, wartende Sperren ${m.wartend})`);
    ok(!zusammen.some((z) => /fiaon_(agents|contact_log|applications|whatsapp)/.test(z) && z.includes("ausgeführt in")), "keine Sperre auf den gehaltenen Tabellen angefordert");
  }

  // D3 — Gegenprobe: Spalte wirklich neu (anrede gelöscht), mit der VORGABE-
  // Abkühlzeit (60 s, E-254-Nachprüfung: vorher lief D3 mit 10 s und zeigte den
  // 60-s-Ausfall nicht). Erwartet: das Portal läuft weiter (ensureAgentTables fängt
  // 55P03 je Anweisung ab — vorher 500 für jede Agenten-Route), die Spalte fehlt,
  // solange der Halter hält, und ist kurz nach der Freigabe da.
  {
    await roh`ALTER TABLE fiaon_agents DROP COLUMN IF EXISTS anrede`;
    const frei = await halten(HALTE);
    const s = serverStarten({});
    const da = await bereit(60);
    const m = await messenServer("D3 Gegenprobe: anrede fehlt, Halter hält, 20 s (Vorgabe 60 s)", 20);
    const fehltWaehrend = !(await spalteDa("fiaon_agents", "anrede"));
    await frei();
    const t0 = Date.now();
    let spalteNach = -1;
    const status: Record<string, number> = {};
    while (spalteNach < 0 && Date.now() - t0 < 70_000) {
      const a = await holen("/api/fiaon/agent/me", true, 5000);
      status[a.status] = (status[a.status] || 0) + 1;
      if (await spalteDa("fiaon_agents", "anrede")) spalteNach = Date.now() - t0;
      else await schlafen(250);
    }
    await stoppen(s.kind);
    const aufgegeben = s.zeilen.filter((z) => z.startsWith("[DB] DDL wartete zu lange auf Sperre"));
    const hinweis = s.zeilen.filter((z) => z.includes("[FIAON-AGENT]") && z.includes("besetzte Tabelle"));
    const authFehler = s.zeilen.filter((z) => z.includes("[FIAON-AGENT] auth:"));
    origLog(`     │ ${aufgegeben[0] ?? "(keine Aufgeben-Zeile)"}`);
    origLog(`     │ ${hinweis[0] ?? "(kein Hinweis aus ensureAgentTables)"}`);
    for (const z of s.zeilen.filter((z) => z.includes("[DDL-WACHE]") && /nachgeholt in|ausgeführt in/.test(z) && z.includes("fiaon_agents")).slice(0, 3)) origLog("     │ " + z.slice(0, 200));
    ok(da && m.health < 200 && m.lesen < 5000, `Gegenprobe: /healthz und direkte Lesungen laufen weiter (/healthz max ${m.health} ms, Lesung max ${m.lesen} ms)`);
    ok((m.agentStatus["500"] || 0) === 0 && (m.agentStatus["200"] || 0) > 0 && m.herdeOk === 20 && authFehler.length === 0,
      `Gegenprobe: Portal läuft weiter, obwohl die Spalte fehlt (/agent/me ${JSON.stringify(m.agentStatus)}, Herde ${m.herdeOk}/20, max ${m.herdeMax} ms, „auth:“-Fehler ${authFehler.length})`);
    ok(fehltWaehrend && aufgegeben.length > 0 && hinweis.length > 0 && s.zeilen.some((z) => z.includes("e254-halter")), "Gegenprobe: Spalte fehlt, solange der Halter hält; Log nennt die Sperre, den Halter und den Hinweis aus ensureAgentTables");
    ok(spalteNach >= 0 && spalteNach <= 5000 && (status["500"] || 0) === 0, `Gegenprobe: nach Freigabe legt die Wache die Spalte an — nach ${spalteNach} ms (vorher mit 60 s Abkühlzeit ≥ 57 s), /agent/me dabei ${JSON.stringify(status)}`);
    messwerte["D3 Spalte nach Freigabe da nach"] = `${spalteNach} ms · /agent/me währenddessen ${JSON.stringify(status)}`;
    await roh`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS anrede VARCHAR`;
  }
}

// ── Aufräumen ────────────────────────────────────────────────────────────────
await roh`DROP TABLE IF EXISTS e254_stau`;
await roh`DROP TABLE IF EXISTS e254_simpel`;
origLog("\nMesswerte:");
for (const [k, v] of Object.entries(messwerte)) origLog(`  ${k}: ${v}`);
origLog("  Zähler der Wache:", JSON.stringify(ddlWacheStand()));
await Promise.all([roh.end(), unbewacht.end(), halterDb.end(), zweit.end(), sqlPool.end({ timeout: 2 }), client.end({ timeout: 2 })]).catch(() => {});
origLog(fehler ? `\nFEHLER: ${fehler}\n${ergebnisse.join("\n")}` : "\nALLES GRÜN");
process.exit(fehler ? 1 : 0);
