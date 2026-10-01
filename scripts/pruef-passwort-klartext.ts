/**
 * Prüfstand E-242 Teil 2 (01.10.2026): Klartext-Passwörter raus — und NIEMAND wird ausgesperrt.
 *
 * Läuft NUR gegen eine lokale Kopie (127.0.0.1), nie gegen Produktion:
 *   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require' \
 *     [PRUEF_URL=http://127.0.0.1:5199] node --import tsx scripts/pruef-passwort-klartext.ts
 * PRUEF_URL = ein lokal gestarteter Server (Produktions-Bündel) auf DERSELBEN Datenbank — dann laufen Anmeldung
 * und „Passwort vergessen" zusätzlich echt über HTTP. Ohne PRUEF_URL nur die Funktions- und Datenbank-Ebene.
 * Rotprobe (ein falscher Massenlauf statt des Ausführers — muss rot werden): PRUEF_ROT=1 … dieselbe Zeile.
 *
 * Geprüft wird:
 *  A. Quelltext: Person-Modell und Personen-Merge schreiben kein Passwort mehr; das Nachhashen beim Login
 *     schickt keinen Klartext als SQL-Parameter und überschreibt die Konto-Zeile nur, wenn die Eingabe zu IHR passt.
 *  B. Vorher: Jede Anmeldung (richtig, falsch, Leerraum, zweite Zeile der Familie, gemergte Zeile, gesperrt,
 *     DSGVO-gelöscht) über die ECHTE loadLoginFamily + decideLogin — und über HTTP, wo es nichts verändert.
 *  C. Lauf: --probelauf ändert nichts; --ausfuehren hasht/leert, schreibt das Protokoll (nur Kennungen),
 *     lässt updated_at und schon gehashte Werte unberührt, legt die CHECKs an; zweiter Lauf ändert nichts.
 *  D. Nachher: dieselben Anmeldungen geben dasselbe Urteil (Funktion UND HTTP); „Passwort vergessen" setzt ein
 *     neues Passwort (neu 200, alt 401); eine neue Bestellung legt keine Passwort-Kopie an der Person an.
 *  E. Die Datenbank verweigert Klartext (Spalte, Person) und nimmt Hashes an.
 *  F. Nirgends mehr Klartext: vollständiger Daten-Dump der lokalen Kopie, gesucht wird jedes Fixture-Passwort.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { passwortHashen, istGehasht } from "../server/lib/fiaon-kunde-session";

const url = process.env.DATABASE_URL || "";
if (!/@127\.0\.0\.1:\d+\//.test(url)) {
  console.error("ABBRUCH: DATABASE_URL muss eine lokale Test-Datenbank (127.0.0.1) sein.");
  process.exit(2);
}
const ROT = process.env.PRUEF_ROT === "1";
const BASIS = (process.env.PRUEF_URL || "").replace(/\/$/, "");
const PG_DUMP = process.env.PG_DUMP || "/opt/homebrew/opt/postgresql@18/bin/pg_dump";

let fehler = 0;
const pruefe = (ok: boolean, text: string) => { console.log(`${ok ? "OK  " : "ROT "} ${text}`); if (!ok) fehler++; };
const lies = (p: string) => readFileSync(p, "utf8");

// ── A. Quelltext ────────────────────────────────────────────────────────────
console.log("\nA. Quelltext");
const modell = lies("server/fiaon-person-model.ts");
pruefe(!/password\s*=\s*COALESCE/.test(modell) && !/storedPasswordOf\(row\)/.test(modell.replace(/^export \{[^}]*\};$/m, "")),
  "Person-Modell kopiert kein Passwort an die Person (Anlegen, Ergänzen, Zusammenführen)");
pruefe(!/password\s*=\s*COALESCE/.test(lies("server/lib/fiaon-person-merge.ts")), "Personen-Merge kopiert kein Passwort");
const antrag = lies("server/routes/fiaon-antrag.ts");
const nachhash = antrag.slice(antrag.indexOf("KUNDENSITZUNG + PASSWORTHYGIENE"), antrag.indexOf("Return success with application data"));
pruefe(/account\.password === password/.test(nachhash) && !/password = \$\{account\.password\}/.test(nachhash),
  "Login-Nachhashen: nur bei passender Konto-Zeile, kein Klartext als SQL-Parameter");

// ── Fixtures ────────────────────────────────────────────────────────────────
const sql = postgres(url, { max: 1, onnotice: () => {} });
const P = "FIAON-PRUEFPW-";
const M = (n: string) => `pruef-pw-${n}@fiaon-pruefstand.invalid`;
// Nur erfundene Prüf-Passwörter. Jedes ist in der Datenbank-Kopie eindeutig wiederzufinden (Teil F).
const PW = {
  anna: "Anna-Alt-2026!", bert1: "Bert-Konto-1x", bert2: "Bert-Zweit-2x", carl: "Carl-Hash-3x", dora: " Dora Leer 4x ",
  emil: "Emil-Weg-5xx", fritz: "Fritz-Ümlaut-ß-€-6", gina: "Gina-Reset-7x", ginaNeu: "Gina-Neu-2026!", hans: "Hans-Gesperrt-8",
  ida1: "Ida-Konto-10x", ida2: "Ida-Merge-9xx",
};
const CARL_HASH = passwortHashen(PW.carl);

const { loadLoginFamily } = await import("../server/routes/fiaon-antrag");
const { decideLogin } = await import("../server/fiaon-login-logic");
const urteil = async (email: string, pw: string) => {
  const v: any = decideLogin(await loadLoginFamily(email), pw);
  return v.granted ? `granted:${v.account?.ref?.slice(P.length)}` : `${v.status}:${v.code}`;
};
const http = async (pfad: string, body: unknown) => {
  const r = await fetch(`${BASIS}/api/fiaon${pfad}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh) Pruefstand", "X-Forwarded-For": "93.184.216.34" },
    body: JSON.stringify(body),
  });
  let j: any = null; try { j = await r.json(); } catch { /* leer */ }
  return { status: r.status, j };
};
const httpLogin = async (email: string, pw: string) => {
  const r = await http("/login", { email, password: pw });
  return r.status === 200 ? `200:${String(r.j?.ref ?? "").slice(P.length)}` : `${r.status}:${r.j?.code ?? "?"}`;
};

// Paare: (Konto, E-Mail, eingegebenes Passwort, erwartetes Urteil — vorher wie nachher)
const PAARE: [string, string, string, string][] = [
  ["anna richtig", M("anna"), PW.anna, "granted:ANNA"],
  ["anna falsch", M("anna"), "Anna-Falsch", "401:AUTH-01"],
  ["bert Konto-Zeile", M("bert"), PW.bert1, "granted:BERT1"],
  ["bert zweite Zeile", M("bert"), PW.bert2, "granted:BERT1"],
  ["carl schon gehasht", M("carl"), PW.carl, "granted:CARL"],
  ["dora mit Leerraum", M("dora"), PW.dora, "granted:DORA"],
  ["dora getrimmt (war nie gültig)", M("dora"), PW.dora.trim(), "401:AUTH-01"],
  ["emil DSGVO-gelöscht", M("emil"), PW.emil, "401:AUTH-01"],
  ["fritz Unicode", M("fritz"), PW.fritz, "granted:FRITZ"],
  ["gina vor dem Reset", M("gina"), PW.gina, "granted:GINA"],
  ["hans gesperrt", M("hans"), PW.hans, "403:AUTH-04"],
  ["ida Konto-Zeile", M("ida"), PW.ida1, "granted:IDA1"],
  ["ida gemergte Zeile", M("ida"), PW.ida2, "granted:IDA1"],
];

const snapshot = async () => JSON.stringify(await sql`
  SELECT ref, password, utm::text AS utm, updated_at::text AS u FROM fiaon_applications WHERE ref LIKE ${P + "%"} ORDER BY ref`)
  + JSON.stringify(await sql`SELECT person_ref, password, updated_at::text AS u FROM fiaon_persons WHERE person_ref LIKE ${P + "%"} ORDER BY person_ref`);

const ausfuehrer = (...args: string[]) => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/passwort-klartext-raus.ts", ...args],
    { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: url } });
  return { code: r.status, text: `${r.stdout}\n${r.stderr}` };
};

const aufraeumen = async () => {
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_password_gehasht`;
  await sql`ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_utm_erlaubt`;
  await sql`ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_password_gehasht`;
  await sql`DROP TABLE IF EXISTS fiaon_passwort_klartext_protokoll`;
  await sql`DROP TABLE IF EXISTS fiaon_utm_bereinigung_protokoll`;
  await sql`DELETE FROM fiaon_contact_log WHERE ref LIKE ${P + "%"}`;
  await sql`DELETE FROM fiaon_login_log WHERE email LIKE ${"pruef-pw-%"}`.catch(() => {});
  await sql`UPDATE fiaon_applications SET person_id = NULL WHERE ref LIKE ${P + "%"}`;
  await sql`DELETE FROM fiaon_person_aliases WHERE person_id IN (SELECT id FROM fiaon_persons WHERE person_ref LIKE ${P + "%"} OR primary_email LIKE ${"pruef-pw-%"})`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${P + "%"}`;
  await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE ${P + "%"} OR primary_email LIKE ${"pruef-pw-%"}`;
};

try {
  await aufraeumen();
  // Es darf sonst nichts in der Kopie liegen, was der Lauf anfasst — sonst prüft dieser Stand fremde Zeilen mit.
  const [fremd] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE 'scrypt$%'`;
  if (fremd.n > 0) throw new Error(`Die Kopie enthält ${fremd.n} fremde Klartext-Zeilen — bitte eine frische Kopie nehmen.`);

  const person = async (name: string, pw: string | null) => {
    const [p] = await sql`INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, password, account_status, birthdate)
      VALUES (${P + "P-" + name.toUpperCase()}, 'private', ${name}, 'Pruef', ${M(name)}, ${pw}, 'active', '1980-01-02') RETURNING id`;
    return Number(p.id);
  };
  const zeile = async (suffix: string, name: string, f: Record<string, unknown>) => {
    await sql`INSERT INTO fiaon_applications ${sql({
      ref: P + suffix, payment_reference: "FIAONPW" + suffix, type: "private", status: "completed", payment_status: "paid",
      pack_key: "pro", pack_name: "FIAON Pro", account_status: "active", first_name: name, last_name: "Pruef",
      birthdate: "1980-01-02", email: M(name), current_step: 8, created_at: new Date("2026-08-10T10:00:00Z"),
      updated_at: new Date("2026-08-11T10:00:00Z"), ...f,
    } as any)}`;
  };
  const pAnna = await person("anna", PW.anna);
  const pBert = await person("bert", PW.bert1);
  await zeile("ANNA", "anna", { password: PW.anna, utm: sql.json(JSON.stringify({ password: PW.anna }) as any), person_id: pAnna });
  await zeile("BERT1", "bert", { password: PW.bert1, person_id: pBert, created_at: new Date("2026-08-20T10:00:00Z") });
  await zeile("BERT2", "bert", { password: PW.bert2, person_id: pBert, payment_status: "pending_payment", status: "submitted", created_at: new Date("2026-08-01T10:00:00Z") });
  await zeile("CARL", "carl", { password: CARL_HASH });
  await zeile("DORA", "dora", { password: PW.dora });
  await zeile("EMIL", "emil", { password: PW.emil, gdpr_deleted_at: new Date("2026-09-01T10:00:00Z") });
  await zeile("FRITZ", "fritz", { password: PW.fritz });
  await zeile("GINA", "gina", { password: PW.gina });
  await zeile("HANS", "hans", { password: PW.hans, account_status: "suspended" });
  await zeile("IDA1", "ida", { password: passwortHashen(PW.ida1) });
  await zeile("IDA2", "ida", { password: PW.ida2, merged_into: P + "IDA1", payment_status: "pending_payment", status: "submitted" });

  // ── B. Vorher ─────────────────────────────────────────────────────────────
  console.log("\nB. Vorher (echte loadLoginFamily + decideLogin)");
  const vorher: Record<string, string> = {};
  for (const [name, mail, pw, soll] of PAARE) {
    vorher[name] = await urteil(mail, pw);
    pruefe(vorher[name] === soll, `${name}: ${vorher[name]}`);
  }
  if (BASIS) {
    console.log(`\nB2. Vorher über HTTP (${BASIS}) — nur Anmeldungen, die nichts verändern dürfen`);
    // Die zweite Zeile der Familie (bert2) meldet an — die Konto-Zeile (bert1) darf dabei NICHT umgeschrieben
    // werden (alter Fehler: das Nachhashen schrieb die Eingabe in die Konto-Zeile, „Bert-Konto" ginge danach nicht mehr).
    const [b1vor] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${P + "BERT1"}`;
    pruefe((await httpLogin(M("bert"), PW.bert2)) === "200:BERT1", "bert meldet sich mit dem Passwort der zweiten Zeile an");
    const [b1nach] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${P + "BERT1"}`;
    pruefe(b1vor.password === b1nach.password, "… und die Konto-Zeile bleibt dabei unverändert (kein fremdes Nachhashen)");
    pruefe((await httpLogin(M("bert"), PW.bert1)) === "200:BERT1", "bert meldet sich danach weiter mit dem Konto-Passwort an");
    // Das gelungene Login mit bert1 hasht bert1 jetzt selbst nach (der bestehende Weg) — das muss so sein.
    const [b1h] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${P + "BERT1"}`;
    pruefe(istGehasht(b1h.password), "das Nachhashen beim Login trifft die richtige Zeile");
    pruefe((await httpLogin(M("hans"), PW.hans)) === "403:AUTH-04", "hans (gesperrt): 403 AUTH-04");
    pruefe((await httpLogin(M("emil"), PW.emil)) === "401:AUTH-01", "emil (DSGVO-gelöscht): 401");
    pruefe((await httpLogin(M("anna"), "Anna-Falsch")) === "401:AUTH-01", "anna mit falschem Passwort: 401");
  }

  // ── C. Lauf ───────────────────────────────────────────────────────────────
  console.log(`\nC. Lauf${ROT ? " (ROTPROBE: falscher Massenlauf statt Ausführer)" : ""}`);
  const vorProbe = await snapshot();
  const probe = ausfuehrer("--probelauf");
  pruefe(probe.code === 0 && /ROLLBACK, nichts geändert/.test(probe.text) && vorProbe === await snapshot(), `Probelauf: Exit ${probe.code}, nichts geändert`);
  if (probe.code !== 0) console.log(probe.text.slice(-1500));
  const geheim = Object.values(PW);
  pruefe(!geheim.some((g) => probe.text.includes(g) || probe.text.includes(g.trim())), "Ausgabe des Ausführers enthält kein Passwort");
  const [vorU] = await sql`SELECT json_object_agg(ref, updated_at::text) AS u FROM fiaon_applications WHERE ref LIKE ${P + "%"}`;

  if (ROT) {
    // Ein naheliegender, falscher Massenlauf: SHA-256 in der Datenbank — die Anmeldung kennt dieses Format nicht.
    await sql`UPDATE fiaon_applications SET password = encode(sha256(convert_to(password, 'UTF8')), 'hex')
              WHERE ref LIKE ${P + "%"} AND password IS NOT NULL AND password NOT LIKE 'scrypt$%'`;
  } else {
    const lauf = ausfuehrer("--ausfuehren");
    pruefe(lauf.code === 0 && /== COMMIT/.test(lauf.text), `Ausführung: Exit ${lauf.code}`);
    if (lauf.code !== 0) console.log(lauf.text.slice(-2500));
    pruefe(!geheim.some((g) => lauf.text.includes(g) || lauf.text.includes(g.trim())), "Ausgabe des Ausführers enthält kein Passwort");
  }

  const nach = Object.fromEntries((await sql`SELECT ref, password, updated_at::text AS u, gdpr_deleted_at IS NOT NULL AS weg
    FROM fiaon_applications WHERE ref LIKE ${P + "%"}`).map((r: any) => [r.ref.slice(P.length), r]));
  const klartextRest = Object.entries(nach).filter(([, r]: any) => r.password != null && !istGehasht(r.password)).map(([k]) => k);
  pruefe(klartextRest.length === 0, `Spalte: kein Klartext mehr (${klartextRest.join(", ") || "0 Zeilen"})`);
  pruefe(nach.EMIL?.password === null, "DSGVO-gelöschte Zeile: Passwort geleert");
  pruefe(nach.CARL?.password === CARL_HASH, "schon gehashter Wert bleibt Byte für Byte gleich");
  const bewegt = Object.keys(nach).filter((k) => nach[k].u !== (vorU.u as any)[P + k]);
  pruefe(bewegt.length === 0, `updated_at unverändert (${bewegt.join(", ") || "alle"})`);
  const pers = await sql`SELECT person_ref, password FROM fiaon_persons WHERE person_ref LIKE ${P + "%"}`;
  pruefe(pers.length === 2 && pers.every((p: any) => p.password === null), "Personen-Kopien geleert");
  const [utmA] = await sql`SELECT utm FROM fiaon_applications WHERE ref = ${P + "ANNA"}`;
  pruefe(JSON.stringify(utmA.utm) === "{}", `utm der Altzeile: ${JSON.stringify(utmA.utm)}`);

  const [protT] = await sql`SELECT to_regclass('fiaon_passwort_klartext_protokoll') AS t`;
  const prot = protT.t ? await sql`SELECT ort, ref, massnahme, war_klartext FROM fiaon_passwort_klartext_protokoll
    WHERE ref LIKE ${P + "%"} OR person_id IN (${pAnna}, ${pBert}) ORDER BY ort, ref` : [];
  const pt = (ort: string, ref: string) => (prot as any[]).find((x) => x.ort === ort && x.ref === P + ref)?.massnahme ?? "—";
  // bert1 wurde in B2 schon beim Login nachgehasht → steht nicht im Protokoll (ohne HTTP-Teil schon).
  const sollHash = ["ANNA", "BERT2", "DORA", "FRITZ", "GINA", "HANS", "IDA2", ...(BASIS ? [] : ["BERT1"])];
  pruefe(sollHash.every((r) => pt("fiaon_applications.password", r) === "gehasht") && pt("fiaon_applications.password", "EMIL") === "geleert_dsgvo_geloescht"
    && pt("fiaon_applications.password", "CARL") === "—" && pt("fiaon_applications.password", "IDA1") === "—",
    `Protokoll Spalte: ${sollHash.length} gehasht, 1 geleert, schon Gehashtes nicht protokolliert`);
  const pp = (prot as any[]).filter((x) => x.ort === "fiaon_persons.password");
  pruefe(pp.length === 2 && pp.every((x) => x.massnahme === "geleert_kopie" && x.war_klartext === true), `Protokoll Personen: ${pp.length} Kopien geleert`);
  pruefe(!geheim.some((g) => JSON.stringify(prot).includes(g)), "Protokoll enthält keinen Wert");
  const checks = await sql`SELECT conname, convalidated FROM pg_constraint WHERE conname IN
    ('fiaon_applications_password_gehasht', 'fiaon_applications_utm_erlaubt', 'fiaon_persons_password_gehasht')`;
  pruefe(checks.length === 3 && checks.every((c: any) => c.convalidated), `CHECKs angelegt und geprüft (${checks.length}/3)`);

  // ── D. Nachher ────────────────────────────────────────────────────────────
  console.log("\nD. Nachher — dieselben Anmeldungen, dasselbe Urteil");
  for (const [name, mail, pw] of PAARE) {
    const ist = await urteil(mail, pw);
    pruefe(ist === vorher[name], `${name}: ${ist}${ist === vorher[name] ? "" : ` (vorher ${vorher[name]})`}`);
  }
  if (BASIS) {
    console.log("\nD2. Nachher über HTTP");
    for (const [name, mail, pw] of PAARE) {
      const soll = vorher[name].startsWith("granted:") ? `200:${vorher[name].slice(8)}` : vorher[name];
      const ist = await httpLogin(mail, pw);
      pruefe(ist === soll, `${name}: ${ist}`);
    }
    // „Passwort vergessen": Identität (Name, E-Mail, Geburtsdatum) → neues Passwort → neu geht, alt nicht.
    const v = await http("/verify-identity", { email: M("gina"), firstName: "gina", lastName: "Pruef", birthDay: "2", birthMonth: "1", birthYear: "1980" });
    pruefe(v.status === 200 && typeof v.j?.token === "string", `Passwort vergessen: Identität bestätigt (${v.status})`);
    const r = await http("/reset-password-direct", { token: v.j?.token, newPassword: PW.ginaNeu });
    pruefe(r.status === 200 && r.j?.zugangOffen === true, `Passwort vergessen: neues Passwort gesetzt (${r.status})`);
    pruefe((await httpLogin(M("gina"), PW.ginaNeu)) === "200:GINA", "gina mit NEUEM Passwort: 200");
    pruefe((await httpLogin(M("gina"), PW.gina)) === "401:AUTH-01", "gina mit ALTEM Passwort: 401");
    const [g] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${P + "GINA"}`;
    pruefe(istGehasht(g.password), "das neue Passwort liegt gehasht (CHECK hat den Reset nicht behindert)");
  }
  // Eine neue Bestellung wird an die Person gebunden — es entsteht KEINE Passwort-Kopie.
  const { bindePersonAnAntrag } = await import("../server/fiaon-person-model");
  await zeile("NEU", "neu", { password: passwortHashen("Neu-Kunde-11x"), status: "submitted", payment_status: "pending_payment" });
  const z = await bindePersonAnAntrag(P + "NEU");
  const [pn] = z ? await sql`SELECT password FROM fiaon_persons WHERE id = ${z.personId}` : [{ password: "keine Person" }];
  pruefe(!!z && pn.password === null, `neue Bestellung → Person ${z?.angelegt ? "angelegt" : "zugeordnet"}, ohne Passwort-Kopie`);
  await sql`UPDATE fiaon_persons SET person_ref = ${P + "P-NEU"} WHERE id = ${z?.personId ?? -1}`;

  // ── E. CHECKs ─────────────────────────────────────────────────────────────
  console.log("\nE. Die Datenbank verweigert Klartext");
  const versuch = async (text: string, f: (tx: any) => Promise<unknown>, sollAbgewiesen: boolean) => {
    let abgewiesen = false;
    try { await sql.begin(async (tx) => { await f(tx); throw new Error("zurück"); }); } catch (e: any) { abgewiesen = /_gehasht|_erlaubt/.test(String(e?.constraint_name ?? e?.message)); }
    pruefe(abgewiesen === sollAbgewiesen, `${text}: ${abgewiesen ? "abgewiesen" : "angenommen"}`);
  };
  await versuch("Spalte: Klartext", (tx) => tx`UPDATE fiaon_applications SET password = 'klartext-x' WHERE ref = ${P + "CARL"}`, true);
  await versuch("Spalte: Hash", (tx) => tx`UPDATE fiaon_applications SET password = ${passwortHashen("y")} WHERE ref = ${P + "CARL"}`, false);
  await versuch("Spalte: NULL", (tx) => tx`UPDATE fiaon_applications SET password = NULL WHERE ref = ${P + "CARL"}`, false);
  await versuch("Person: Klartext", (tx) => tx`UPDATE fiaon_persons SET password = 'klartext-x' WHERE id = ${pAnna}`, true);
  await versuch("Person: Hash-Kopie (bricht nichts)", (tx) => tx`UPDATE fiaon_persons SET password = ${passwortHashen("y")} WHERE id = ${pAnna}`, false);
  await versuch("utm: Passwort", (tx) => tx`UPDATE fiaon_applications SET utm = ${tx.json({ password: "x" })} WHERE ref = ${P + "CARL"}`, true);

  const zweit = ausfuehrer("--ausfuehren");
  pruefe(zweit.code === 0 && /COMMIT: 0 Passwörter gehasht, 0 geleert/.test(zweit.text), `zweiter Lauf: Exit ${zweit.code}, ändert nichts`);

  // ── F. Nirgends mehr Klartext ─────────────────────────────────────────────
  console.log("\nF. Daten-Dump der lokalen Kopie — jedes Prüf-Passwort gesucht");
  const d = spawnSync(PG_DUMP, ["--data-only", "--no-owner", "--no-privileges", url.replace(/\?.*$/, "")],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, env: { PATH: process.env.PATH ?? "", PGSSLMODE: "require" } });
  pruefe(d.status === 0 && d.stdout.length > 0, `pg_dump --data-only: Exit ${d.status}, ${Math.round((d.stdout?.length ?? 0) / 1024)} KB`);
  const treffer = geheim.filter((g) => d.stdout.includes(g) || d.stdout.includes(g.trim()) || d.stdout.includes(JSON.stringify(g).slice(1, -1)));
  pruefe(treffer.length === 0, `kein Prüf-Passwort im Dump (${treffer.length} von ${geheim.length} gefunden)`);
} catch (e: any) {
  pruefe(false, `Abbruch: ${String(e?.message ?? e).slice(0, 300)}`);
} finally {
  await aufraeumen().catch((e) => console.log("Aufräumen:", String(e?.message ?? e).slice(0, 200)));
  await sql.end();
  const { sqlPool } = await import("../server/lib/db-pool");
  await sqlPool.end().catch(() => {});
}
console.log(fehler === 0 ? "\nGRÜN: Klartext raus, niemand ausgesperrt — Spalte, utm, Personen-Kopie, Protokoll, CHECKs, Login und Reset." : `\nROT: ${fehler} Befund(e).`);
process.exit(fehler === 0 ? 0 : 1);
