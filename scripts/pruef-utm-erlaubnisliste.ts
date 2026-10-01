/**
 * Prüfstand E-242 (25.09.2026): In fiaon_applications.utm stehen nie wieder Passwörter.
 *
 * Läuft NUR gegen eine lokale Struktur-Kopie (127.0.0.1) — nie gegen Produktion. Aufbau siehe
 * Gedächtnis „fiaon-lokaler-pruefstand" (pg_dump --schema-only, eigene Instanz, ssl = on), dann:
 *   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require' \
 *     node --import tsx scripts/pruef-utm-erlaubnisliste.ts
 * Rotprobe (alter Leser + alter Schreibausdruck, muss rot werden): PRUEF_ROT=1 … dieselbe Zeile.
 *
 * Geprüft wird:
 *  A. utmErlaubt() auf jeder Form, die utm in der Produktion hat (Objekt, JSON-Text, Array aus Texten
 *     und Objekten, doppelt verpackt, Zahl, kaputter Text) — nie ein Passwort, erlaubte Schlüssel bleiben.
 *  B. Quelltext: Leser „herkunft" gefiltert, kein Klartext-Passwort-Schreibweg, derselbe Schreibausdruck an
 *     allen drei Passwort-Setz-Stellen, storedPasswordOf liest kein utm, der Ausführer nimmt die Erlaubnisliste
 *     aus UTM_SCHLUESSEL (eine Quelle), das alte SQL ist weg (ein Weg).
 *  C. Datenbank: die historischen Schreibfehler WÖRTLICH nachgestellt (8518e421, 00fb0137), dann die echten
 *     Funktionen passwortSetzen/einmalPasswortSetzen, dann scripts/passwort-klartext-raus.ts als Probelauf
 *     (ROLLBACK) und als Ausführung, danach der CHECK gegen verbotene Schreibversuche.
 *
 * 01.10.2026 (E-242, Teil 2): scripts/sql/utm-bereinigung.sql ist in scripts/passwort-klartext-raus.ts
 * aufgegangen (dieselbe Rechnung, wörtlich, jetzt in EINER Transaktion mit Spalte und Personen-Kopie).
 */
import postgres from "postgres";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL || "";
if (!/@127\.0\.0\.1:\d+\//.test(url)) {
  console.error("ABBRUCH: DATABASE_URL muss eine lokale Test-Datenbank (127.0.0.1) sein.");
  process.exit(2);
}
const ROT = process.env.PRUEF_ROT === "1";

let fehler = 0;
const pruefe = (ok: boolean, text: string) => { console.log(`${ok ? "OK  " : "ROT "} ${text}`); if (!ok) fehler++; };
const hatPasswort = (x: unknown) => /pass(word|wort)?|kennwort/i.test(JSON.stringify(x ?? null));

const { utmErlaubt, UTM_SCHLUESSEL } = await import("../server/lib/fiaon-utm");
const leser = ROT ? (x: unknown) => x : utmErlaubt;

// ── A. utmErlaubt ────────────────────────────────────────────────────────────
console.log("\nA. utmErlaubt()");
const faelle: [string, unknown, unknown][] = [
  ["null", null, null],
  ["Objekt nur password", { password: "Geheim1!" }, null],
  ["Objekt gemischt", { utm_source: "meta", fremd: "x", password: "p", gclid: 123 }, { utm_source: "meta", gclid: "123" }],
  ["JSON-Text (8518e421)", JSON.stringify({ password: "p" }), null],
  ["JSON-Text leer", "{}", null],
  ["doppelt verpackt", JSON.stringify(JSON.stringify({ utm_campaign: "herbst", password: "p" })), { utm_campaign: "herbst" }],
  ["Array [Text, Text] (00fb0137)", [JSON.stringify({ password: "a" }), JSON.stringify({ password: "b" })], null],
  ["Array [{}, Text]", [{}, JSON.stringify({ password: "a" })], null],
  ["Array spätere Schicht gewinnt", [JSON.stringify({ utm_source: "alt" }), { utm_source: "neu", password: "x" }], { utm_source: "neu" }],
  ["Zahl", 7, null],
  ["kaputter Text", "{nicht json", null],
  ["Leerwerte fallen weg", { utm_source: "  ", utm_medium: "" }, null],
  ["Länge gekappt", { landing: "x".repeat(900) }, { landing: "x".repeat(500) }],
];
for (const [name, ein, soll] of faelle) {
  const ist = leser(ein);
  pruefe(JSON.stringify(ist) === JSON.stringify(soll) && !hatPasswort(ist), `${name}: ${JSON.stringify(ist)?.slice(0, 80)}`);
}

// ── B. Quelltext ─────────────────────────────────────────────────────────────
console.log("\nB. Quelltext");
const lies = (p: string) => readFileSync(p, "utf8");
function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.tsx?$/.test(n) && !/\.backup/.test(n) ? [p] : [];
  });
}
const server = dateien("server").map((p) => [p, lies(p)] as const);
const agentKunden = lies("server/routes/fiaon-agent-kunden.ts");
pruefe(agentKunden.includes("herkunft: utmErlaubt(ant.utm)") && !/herkunft:\s*ant\.utm\b/.test(agentKunden),
  "GET /agent/crm/kunden/:personId gibt nur die Erlaubnisliste als „herkunft“ heraus");
const klartext = server.filter(([, s]) => /JSON\.stringify\(\{\s*password\b/.test(s)).map(([p]) => p);
pruefe(klartext.length === 0, `kein „JSON.stringify({ password …“ mehr im Server (${klartext.join(", ") || "0 Stellen"})`);
const altCase = server.filter(([, s]) => s.includes("THEN utm - 'password' ELSE")).map(([p]) => p);
pruefe(altCase.length === 0, `alter Schreibausdruck (nur Objekte geputzt) nirgends mehr (${altCase.join(", ") || "0 Stellen"})`);
const NEU = "utm = CASE WHEN utm IS NULL THEN NULL WHEN jsonb_typeof(utm) = 'object' THEN (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(utm) AS u(k, v) WHERE k = ANY(${UTM_SCHLUESSEL_LISTE}::text[])) ELSE '{}'::jsonb END,";
const flach = (s: string) => s.replace(/\s+/g, " ");
for (const [datei, soll] of [["server/routes/fiaon-antrag.ts", 1], ["server/lib/fiaon-zugang.ts", 2]] as const) {
  const n = flach(lies(datei)).split(NEU).length - 1;
  pruefe(n === soll, `${datei}: ${n}× Erlaubnislisten-Ausdruck beim Passwort-Setzen (Soll ${soll})`);
}
const login = lies("server/fiaon-login-logic.ts");
const spo = login.slice(login.indexOf("export function storedPasswordOf"), login.indexOf("}", login.indexOf("export function storedPasswordOf")) + 1);
pruefe(!/utm/.test(spo), "storedPasswordOf liest nur noch die Spalte password");
const ausfuehrer = lies("scripts/passwort-klartext-raus.ts");
pruefe(/const ERLAUBT: string\[\] = \[\.\.\.UTM_SCHLUESSEL\]/.test(ausfuehrer) && !/'utm_source'|"utm_source"/.test(ausfuehrer),
  `Ausführer nimmt die Erlaubnisliste aus UTM_SCHLUESSEL (${UTM_SCHLUESSEL.length} Schlüssel), keine eigene Liste`);
let altesSql = true; try { lies("scripts/sql/utm-bereinigung.sql"); } catch { altesSql = false; }
pruefe(!altesSql, "scripts/sql/utm-bereinigung.sql ist weg — es gibt EINEN Weg für die Bereinigung");

// ── C. Datenbank ─────────────────────────────────────────────────────────────
console.log("\nC. Datenbank (lokale Struktur-Kopie)");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const P = "pruef-utm-";
const MAIL = "pruef-utm@fiaon-pruefstand.invalid";
// Der Ausführer läuft wie im Ernstfall als eigener Prozess — ohne .env, nur mit dieser lokalen DATABASE_URL.
const ausfuehren = (...args: string[]) => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/passwort-klartext-raus.ts", ...args],
    { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: url } });
  return { code: r.status, text: `${r.stdout}\n${r.stderr}` };
};
try {
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_utm_erlaubt`;
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_password_gehasht`;
  await sql`ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_password_gehasht`;
  await sql`DROP TABLE IF EXISTS fiaon_utm_bereinigung_protokoll`;
  await sql`DROP TABLE IF EXISTS fiaon_passwort_klartext_protokoll`;
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${P + "%"}`;
  const neu = async (ref: string, email: string | null = null) =>
    sql`INSERT INTO fiaon_applications (ref, payment_reference, email, updated_at) VALUES (${P + ref}, ${"FIAON-" + ref.toUpperCase()}, ${email}, '2026-08-01T10:00:00Z')`;
  // Die historischen Schreibwege WÖRTLICH (Parameter über postgres.js wie im Server — daher die Doppel-Serialisierung):
  const w8518 = (ref: string, password?: string) => sql`UPDATE fiaon_applications SET utm = ${JSON.stringify({ password })}::jsonb WHERE ref = ${P + ref}`;
  const w00fb = (ref: string, password: string) => sql`UPDATE fiaon_applications SET utm = COALESCE(utm, '{}'::jsonb) || ${JSON.stringify({ password })}::jsonb WHERE ref = ${P + ref}`;

  await neu("text-pw"); await w8518("text-pw", "GeheimText1!");
  await neu("text-leer"); await w8518("text-leer");
  await neu("array-2"); await w8518("array-2", "GeheimAlt1!"); await w00fb("array-2", "GeheimAlt1!");
  await neu("array-leer-obj"); await w00fb("array-leer-obj", "GeheimNull1!");
  await neu("array-3"); await w8518("array-3", "GeheimA1!"); await w00fb("array-3", "GeheimB1!"); await w00fb("array-3", "GeheimC1!");
  await neu("objekt-gemischt"); await sql`UPDATE fiaon_applications SET utm = ${sql.json({ utm_source: "meta", fremd: "y", password: "GeheimObj1!" })} WHERE ref = ${P + "objekt-gemischt"}`;
  await neu("objekt-leer"); await sql`UPDATE fiaon_applications SET utm = '{}'::jsonb WHERE ref = ${P + "objekt-leer"}`;
  await neu("null");
  await neu("zahl"); await sql`UPDATE fiaon_applications SET utm = '7'::jsonb WHERE ref = ${P + "zahl"}`;
  await neu("text-kaputt"); await sql`UPDATE fiaon_applications SET utm = to_jsonb('abc'::text) WHERE ref = ${P + "text-kaputt"}`;
  await neu("array-erlaubt"); await sql`UPDATE fiaon_applications SET utm = jsonb_build_array(${JSON.stringify({ utm_source: "google", password: "GeheimG1!" })}::text, jsonb_build_object('gclid', 'g-1')) WHERE ref = ${P + "array-erlaubt"}`;
  // Eine Familie für passwortSetzen (Array-Altform) und eine Zeile für einmalPasswortSetzen (Text-Altform)
  await neu("fam-a", MAIL); await w8518("fam-a", "GeheimFam1!"); await w00fb("fam-a", "GeheimFam1!");
  await neu("fam-b", MAIL); await sql`UPDATE fiaon_applications SET utm = ${sql.json({ utm_campaign: "herbst", password: "GeheimFam1!" })} WHERE ref = ${P + "fam-b"}`;
  await neu("einmal", "pruef-utm-einmal@fiaon-pruefstand.invalid"); await w8518("einmal", "GeheimEinmal1!");

  const formen = Object.fromEntries((await sql`SELECT ref, jsonb_typeof(utm) AS f FROM fiaon_applications WHERE ref LIKE ${P + "%"}`).map((r) => [r.ref.slice(P.length), r.f]));
  pruefe(formen["text-pw"] === "string" && formen["array-2"] === "array" && formen["array-leer-obj"] === "array" && formen["array-3"] === "array",
    `Vorher wie in Produktion: Text ${formen["text-pw"]}, Array ${formen["array-2"]}/${formen["array-leer-obj"]}/${formen["array-3"]}`);
  const [e152] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE ${P + "%"} AND utm ? 'password'`;
  const [echt] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE ${P + "%"} AND utm::text ~* 'password'`;
  pruefe(e152.n === 2 && echt.n === 9, `E-152-Zählweise „utm ? 'password'“ sieht ${e152.n} von ${echt.n} Passwort-Zeilen (die Falle, die den Altbestand verbarg)`);

  // Leser: so wie GET /agent/crm/kunden/:personId die Zeile bekommt (postgres.js parst jsonb)
  const roh = await sql`SELECT ref, utm FROM fiaon_applications WHERE ref LIKE ${P + "%"} ORDER BY ref`;
  const lecks = roh.filter((r) => hatPasswort(leser(r.utm))).map((r) => r.ref.slice(P.length));
  pruefe(lecks.length === 0, `„herkunft“ zeigt in keiner Zeile ein Passwort (${lecks.join(", ") || "0 Zeilen"})`);

  // Schreibwege über die ECHTEN Funktionen (fiaon-zugang.ts nutzt db-pool mit dieser DATABASE_URL)
  const { passwortSetzen, einmalPasswortSetzen } = await import("../server/lib/fiaon-zugang");
  if (ROT) {
    await sql`UPDATE fiaon_applications SET utm = CASE WHEN jsonb_typeof(utm) = 'object' THEN utm - 'password' ELSE COALESCE(utm, '{}'::jsonb) END WHERE email = ${MAIL}`;
  } else {
    const r = await passwortSetzen(P + "fam-a", "NeuesPasswort-2026");
    pruefe(r.ok === true, `passwortSetzen auf Array-Altform: ${r.ok ? "ok" : r.grund}`);
    const e = await einmalPasswortSetzen(P + "einmal", "pruefstand", "E-242");
    pruefe((e as any).ok === true, `einmalPasswortSetzen auf Text-Altform: ${(e as any).ok ? "ok" : (e as any).grund}`);
  }
  const fam = Object.fromEntries((await sql`SELECT ref, utm, password FROM fiaon_applications WHERE ref IN (${P + "fam-a"}, ${P + "fam-b"}, ${P + "einmal"})`).map((r) => [r.ref.slice(P.length), r]));
  pruefe(JSON.stringify(fam["fam-a"]?.utm) === "{}" && String(fam["fam-a"]?.password ?? "").startsWith("scrypt$"),
    `fam-a nach Passwort setzen: utm ${JSON.stringify(fam["fam-a"]?.utm)}, Spalte gehasht`);
  pruefe(JSON.stringify(fam["fam-b"]?.utm) === JSON.stringify({ utm_campaign: "herbst" }), `fam-b (Objekt, gleiche Familie): utm ${JSON.stringify(fam["fam-b"]?.utm)}`);
  pruefe(JSON.stringify(fam["einmal"]?.utm) === "{}", `einmal nach Einmalpasswort: utm ${JSON.stringify(fam["einmal"]?.utm)}`);

  // Bereinigung: erst Probelauf, dann Ausführung (scripts/passwort-klartext-raus.ts)
  const vorher = await sql`SELECT ref, utm::text AS t, updated_at FROM fiaon_applications WHERE ref LIKE ${P + "%"} ORDER BY ref`;
  const probe = ausfuehren("--probelauf");
  const nachProbe = await sql`SELECT ref, utm::text AS t, updated_at FROM fiaon_applications WHERE ref LIKE ${P + "%"} ORDER BY ref`;
  const [prot0] = await sql`SELECT to_regclass('fiaon_utm_bereinigung_protokoll') AS t`;
  pruefe(probe.code === 0 && /ROLLBACK, nichts geändert/.test(probe.text) && JSON.stringify(vorher) === JSON.stringify(nachProbe) && prot0.t === null,
    `Probelauf endet mit ROLLBACK, nichts geändert (Exit ${probe.code})`);
  if (probe.code !== 0) console.log(probe.text.slice(-1500));

  const lauf = ausfuehren("--ausfuehren");
  pruefe(lauf.code === 0 && /== COMMIT/.test(lauf.text), `Ausführung mit --ausfuehren (Exit ${lauf.code})`);
  if (lauf.code !== 0) console.log(lauf.text.slice(-1500));
  const nach = Object.fromEntries((await sql`SELECT ref, utm, updated_at FROM fiaon_applications WHERE ref LIKE ${P + "%"}`).map((r) => [r.ref.slice(P.length), r]));
  const soll: Record<string, unknown> = {
    "text-pw": {}, "text-leer": {}, "array-2": {}, "array-leer-obj": {}, "array-3": {},
    "objekt-gemischt": { utm_source: "meta" }, "objekt-leer": {}, "null": null, "zahl": {}, "text-kaputt": {},
    "array-erlaubt": { utm_source: "google", gclid: "g-1" }, "fam-a": {}, "fam-b": { utm_campaign: "herbst" }, "einmal": {},
  };
  // jsonb sortiert Schlüssel (kürzere zuerst) — verglichen wird deshalb sortiert.
  const kanon = (x: unknown) => JSON.stringify(x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort()) : x ?? null);
  for (const [ref, s] of Object.entries(soll)) pruefe(kanon(nach[ref]?.utm) === kanon(s), `${ref}: ${JSON.stringify(nach[ref]?.utm ?? null)}`);
  const alt = Object.fromEntries(vorher.map((r) => [r.ref.slice(P.length), String(r.updated_at)]));
  const bewegt = Object.keys(soll).filter((r) => String(nach[r]?.updated_at) !== alt[r]);
  pruefe(bewegt.length === 0, `updated_at unverändert (${bewegt.join(", ") || "alle"})`);

  const prot = await sql`SELECT * FROM fiaon_utm_bereinigung_protokoll WHERE ref LIKE ${P + "%"} ORDER BY ref`;
  const protText = JSON.stringify(prot);
  pruefe(prot.length === 9 && !/Geheim/.test(protText), `Protokoll: ${prot.length} Zeilen (Soll 9), kein Passwort-Wert darin`);
  const a3 = prot.find((r) => r.ref === P + "array-3");
  pruefe(a3?.passwort_eintraege === 3 && JSON.stringify(a3?.alte_schluessel) === '["password"]', `array-3: ${a3?.passwort_eintraege} Passwort-Einträge, Schlüssel ${JSON.stringify(a3?.alte_schluessel)}`);

  // CHECK: verbotene Formen werden abgewiesen, erlaubte angenommen
  const [chk] = await sql`SELECT convalidated FROM pg_constraint WHERE conname = 'fiaon_applications_utm_erlaubt'`;
  pruefe(chk?.convalidated === true, "CHECK fiaon_applications_utm_erlaubt angelegt und geprüft");
  const versuch = async (text: string, f: (tx: any) => Promise<unknown>, sollAbgewiesen: boolean) => {
    let abgewiesen = false;
    try { await sql.begin(async (tx) => { await f(tx); throw new Error("zurück"); }); } catch (e: any) { abgewiesen = /utm_erlaubt/.test(String(e?.message)); }
    pruefe(abgewiesen === sollAbgewiesen, `${text}: ${abgewiesen ? "abgewiesen" : "angenommen"}`);
  };
  const ziel = P + "objekt-leer";
  await versuch("alter Weg 8518e421 (JSON-Text)", (tx) => tx`UPDATE fiaon_applications SET utm = ${JSON.stringify({ password: "x" })}::jsonb WHERE ref = ${ziel}`, true);
  await versuch("Objekt mit password", (tx) => tx`UPDATE fiaon_applications SET utm = ${tx.json({ password: "x" })} WHERE ref = ${ziel}`, true);
  await versuch("Array", (tx) => tx`UPDATE fiaon_applications SET utm = '[{}]'::jsonb WHERE ref = ${ziel}`, true);
  await versuch("erlaubtes Objekt", (tx) => tx`UPDATE fiaon_applications SET utm = ${tx.json({ utm_source: "meta", fbclid: "f" })} WHERE ref = ${ziel}`, false);
  await versuch("NULL", (tx) => tx`UPDATE fiaon_applications SET utm = NULL WHERE ref = ${ziel}`, false);
  if (!ROT) {
    const r = await passwortSetzen(P + "fam-b", "NochEinPasswort-2026");
    pruefe(r.ok === true, `passwortSetzen mit CHECK aktiv: ${r.ok ? "ok" : r.grund}`);
  }

  const zweit = ausfuehren("--ausfuehren");
  pruefe(zweit.code === 0 && !/ABBRUCH/.test(zweit.text), `zweiter Lauf läuft sauber durch (Exit ${zweit.code})`);
  const [prot2] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_utm_bereinigung_protokoll WHERE ref LIKE ${P + "%"}`;
  pruefe(prot2.n === 9, `zweiter Lauf ändert nichts mehr (Protokoll weiter ${prot2.n})`);
} finally {
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_utm_erlaubt`.catch(() => {});
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_password_gehasht`.catch(() => {});
  await sql`ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_password_gehasht`.catch(() => {});
  await sql`DROP TABLE IF EXISTS fiaon_passwort_klartext_protokoll`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${P + "%"}`.catch(() => {});
  await sql`DELETE FROM fiaon_contact_log WHERE ref LIKE ${P + "%"}`.catch(() => {});
  await sql`DELETE FROM fiaon_agent_events WHERE actor = 'pruefstand'`.catch(() => {});
  await sql`DROP TABLE IF EXISTS fiaon_utm_bereinigung_protokoll`.catch(() => {});
  await sql.end();
  const { sqlPool } = await import("../server/lib/db-pool");
  await sqlPool.end().catch(() => {});
}
console.log(fehler === 0 ? "\nGRÜN: utm trägt nur noch die Erlaubnisliste — Leser, Schreibwege, Bereinigung und CHECK." : `\nROT: ${fehler} Befund(e).`);
process.exit(fehler === 0 ? 0 : 1);
