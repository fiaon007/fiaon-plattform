// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-302 (27.10.2026): die drei Übernahme-Wege — echt über HTTP
//
// Läuft NUR gegen eine lokale Kopie (127.0.0.1) und einen lokal gestarteten
// Server auf DERSELBEN Datenbank (Produktions-Bündel, ohne Schlüssel):
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require' \
//     PRUEF_URL=http://127.0.0.1:5308 node_modules/.bin/tsx scripts/pruef-e302-anmeldung.ts
//
// Anders als scripts/repro-it-g.sh (08.10.) trägt das Opfer hier einen E-Mail-
// Alias an seiner Person — wie im Betrieb. Dann hängt bindePersonAnAntrag die
// untergeschobene Zeile an die Person des Opfers, und erst der Weg in ZWEI
// Schritten (anlegen ohne Passwort, dann mit dem eigenen Antrags-Cookie und
// Passwort erneut speichern) zeigt, ob die Wand auch beim Aktualisieren steht.
//
// Gegen den alten Stand (main vor E-302) gefahren, muss dieser Prüfstand ROT
// werden — das ist die Rotprobe.
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";
import { passwortHashen, istGehasht } from "../server/lib/fiaon-kunde-session";

const url = process.env.DATABASE_URL || "";
const BASIS = (process.env.PRUEF_URL || "").replace(/\/$/, "");
if (!/@127\.0\.0\.1:\d+\//.test(url) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(BASIS)) {
  console.error("ABBRUCH: DATABASE_URL und PRUEF_URL müssen lokal (127.0.0.1) sein.");
  process.exit(2);
}
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
const B = `${BASIS}/api/fiaon`;

let fehler = 0;
const pruefe = (ok: boolean, text: string) => { console.log(`${ok ? "OK  " : "ROT "} ${text}`); if (!ok) fehler++; };

// Ein Browser = ein Keksglas. Absende-Tests brauchen eine echte Adresse und einen normalen User-Agent (Roboter-Wand).
function browser(ip: string) {
  const glas = new Map<string, string>();
  const nimm = (r: Response) => {
    for (const c of (r.headers as any).getSetCookie?.() ?? []) {
      const [paar] = String(c).split(";");
      const i = paar.indexOf("=");
      const name = paar.slice(0, i).trim(); const wert = paar.slice(i + 1).trim();
      if (!wert || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) glas.delete(name); else glas.set(name, wert);
    }
  };
  const kopf = () => ({
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "X-Forwarded-For": ip,
    ...(glas.size ? { Cookie: [...glas].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
  });
  return {
    glas,
    async post(pfad: string, body: unknown) {
      const r = await fetch(`${B}${pfad}`, { method: "POST", headers: kopf(), body: JSON.stringify(body), redirect: "manual" });
      nimm(r);
      let j: any = null; try { j = await r.json(); } catch { /* kein JSON */ }
      return { status: r.status, j };
    },
    async get(pfad: string) {
      const r = await fetch(`${B}${pfad}`, { headers: kopf(), redirect: "manual" });
      nimm(r);
      let j: any = null; try { j = await r.json(); } catch { /* kein JSON */ }
      return { status: r.status, j, wohin: r.headers.get("location") };
    },
  };
}

const OPFER_MAIL = "opfer-e302@example.com";
const OPFER_PW = "Opfer-Geheim-2026";
const NEU_MAIL = "neukunde-e302@example.com";
const ANGRIFF_REF = "FIAON-ANGRIFF-E302";
const NEU_REF = "FIAON-NEUKUNDE-E302";
const OPFER_REF = "FIAON-OPFER-E302";

async function aufraeumen() {
  const refs = [OPFER_REF, ANGRIFF_REF, NEU_REF];
  await sql`DELETE FROM fiaon_login_links WHERE ref = ANY(${refs})`.catch(() => {});
  await sql`DELETE FROM fiaon_vermerke WHERE ref = ANY(${refs})`.catch(() => {});
  const pids = (await sql`SELECT id FROM fiaon_persons WHERE primary_email = ANY(${[OPFER_MAIL, NEU_MAIL]})
                          UNION SELECT person_id FROM fiaon_person_aliases WHERE value_norm = ANY(${[OPFER_MAIL, NEU_MAIL]})`).map((r: any) => Number(r.id));
  await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${refs}) OR lower(email) = ANY(${[OPFER_MAIL, NEU_MAIL]})`;
  if (pids.length) {
    await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${pids})`;
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${pids})`.catch(() => {});
  }
}

try {
  await aufraeumen();
  // ── Das Opfer: bezahltes Konto mit Passwort, Person MIT E-Mail-Alias (wie im Betrieb) ──
  const [person] = await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, birthdate)
    VALUES ('PERS-OPFER-E302', 'Olga', 'Beispiel', ${OPFER_MAIL}, '1980-05-17') RETURNING id`;
  await sql`INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
            VALUES (${person.id}, 'email', ${OPFER_MAIL}, ${OPFER_MAIL}, 'pruef-e302')`;
  await sql`
    INSERT INTO fiaon_applications (ref, type, status, email, password, person_id, birthdate, first_name, last_name, payment_status, account_status, created_at)
    VALUES (${OPFER_REF}, 'private', 'completed', ${OPFER_MAIL}, ${passwortHashen(OPFER_PW)}, ${person.id}, '1980-05-17',
            'Olga', 'Beispiel', 'paid', 'active', NOW() - INTERVAL '30 days')`;
  const opferHash = async () => String((await sql`SELECT password FROM fiaon_applications WHERE ref = ${OPFER_REF}`)[0]?.password ?? "");
  const hash0 = await opferHash();

  // ── VERDACHT 1: fremde Zeile mit der Opfer-Adresse ──────────────────────
  console.log("\nVerdacht 1 — fremde Zeile (anlegen, dann mit eigenem Cookie erneut speichern)");
  const angreifer = browser("203.0.113.9");
  const a1 = await angreifer.post("/application", {
    ref: ANGRIFF_REF, type: "private", status: "started", currentStep: 1,
    firstName: "Max", lastName: "Angreifer", email: OPFER_MAIL, phoneCountryCode: "+49", phone: "17612345678", password: "angreifer-pw-111",
  });
  const [z1] = await sql`SELECT password, person_id FROM fiaon_applications WHERE ref = ${ANGRIFF_REF}`;
  pruefe(a1.status === 200 && !!z1, `1a angelegt (${a1.status})`);
  console.log(`     Person der Fremdzeile: ${z1?.person_id === person.id ? "die des OPFERS (über den E-Mail-Alias)" : String(z1?.person_id)}`);
  pruefe(!z1?.password, "1a kein Passwort an der Fremdzeile (E-Mail trägt ein bezahltes Konto)");
  const a2 = await angreifer.post("/application", {
    ref: ANGRIFF_REF, type: "private", status: "started", currentStep: 2,
    firstName: "Max", lastName: "Angreifer", email: OPFER_MAIL, phoneCountryCode: "+49", phone: "17612345678", password: "angreifer-pw-111",
  });
  const [z2] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${ANGRIFF_REF}`;
  pruefe(a2.status === 200 && !z2?.password, `1b zweites Speichern mit eigenem Antrags-Cookie: weiter kein Passwort (${a2.status}, Cookie ${angreifer.glas.has("fiaon_antrag") ? "da" : "fehlt"})`);
  const l1 = await browser("203.0.113.9").post("/login", { email: OPFER_MAIL, password: "angreifer-pw-111" });
  pruefe(!(l1.status === 200 && l1.j?.ok), `1c Anmeldung mit Opfer-Adresse + Angreifer-Passwort abgewiesen (${l1.status} ${l1.j?.code ?? ""}${l1.j?.ref ? ` → ${l1.j.ref}` : ""})`);
  pruefe((await opferHash()) === hash0, "1d Opfer-Passwort unverändert");

  // ── VERDACHT 2: Passwort über die (bekannte) Referenz überschreiben ──────
  console.log("\nVerdacht 2 — Referenz des Opfers mit neuem Passwort speichern (ohne Cookie)");
  const v2 = await browser("203.0.113.10").post("/application", { ref: OPFER_REF, type: "private", status: "completed", email: OPFER_MAIL, password: "uebernahme-neu-222" });
  pruefe((await opferHash()) === hash0, `2a Opfer-Passwort unverändert (${v2.status})`);
  const l2 = await browser("203.0.113.10").post("/login", { email: OPFER_MAIL, password: "uebernahme-neu-222" });
  pruefe(!(l2.status === 200 && l2.j?.ok), `2b neues Fremd-Passwort öffnet nichts (${l2.status})`);
  const l2b = await browser("203.0.113.10").post("/login", { email: OPFER_MAIL, password: OPFER_PW });
  pruefe(l2b.status === 200 && l2b.j?.ok && l2b.j?.ref === OPFER_REF, `2c Opfer kommt mit seinem Passwort weiter in SEIN Konto (${l2b.status} ${l2b.j?.ref ?? ""})`);

  // ── VERDACHT 3: Zurücksetzen allein mit Wissen ───────────────────────────
  console.log("\nVerdacht 3 — „Passwort vergessen“ mit Name, E-Mail, Geburtsdatum");
  const fremd3 = browser("203.0.113.11");
  const v3 = await fremd3.post("/verify-identity", { firstName: "Olga", lastName: "Beispiel", email: OPFER_MAIL, birthDay: "17", birthMonth: "5", birthYear: "1980" });
  pruefe(v3.status === 200 && v3.j?.perMail === true && !v3.j?.token, `3a richtige Angaben: kein Token, nur „Link ist unterwegs“ (${v3.status})`);
  const v3f = await browser("203.0.113.12").post("/verify-identity", { firstName: "Olga", lastName: "Beispiel", email: OPFER_MAIL, birthDay: "1", birthMonth: "1", birthYear: "1970" });
  pruefe(v3f.status === 200 && JSON.stringify(v3f.j) === JSON.stringify(v3.j), "3b falsche Angaben: wortgleiche Antwort — verrät nicht, ob es das Konto gibt");
  const d3 = await fremd3.post("/reset-password-direct", { token: "a".repeat(64), newPassword: "reset-uebernahme-333" });
  pruefe(d3.status === 410, `3c alter Direkt-Weg stillgelegt (${d3.status})`);
  const rate = browser("203.0.113.13"); const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await rate.post("/verify-identity", { firstName: "Olga", lastName: "Beispiel", email: OPFER_MAIL, birthDay: "1", birthMonth: "1", birthYear: String(1960 + i) })).status);
  pruefe(codes.includes(429), `3d Drossel greift (${codes.join(" ")})`);
  pruefe((await opferHash()) === hash0, "3e Opfer-Passwort unverändert");
  const [log] = await sql`SELECT code, reason FROM fiaon_login_log WHERE code = 'RESET-MAIL' ORDER BY at DESC LIMIT 1`.catch(() => [] as any[]);
  pruefe(!!log, `3f Protokoll: ${log ? `${log.code} — ${log.reason}` : "kein RESET-MAIL-Eintrag"}`);

  // ── DER EHRLICHE WEG: Link aus der Mail → Passwort ohne das alte ─────────
  console.log("\nEhrlicher Kunde — Link aus der Mail, dann neues Passwort im Bereich");
  const token = randomBytes(32).toString("base64url");
  await sql`INSERT INTO fiaon_login_links (ref, token_hash, gueltig_bis) VALUES (${OPFER_REF}, ${createHash("sha256").update(token).digest("hex")}, NOW() + INTERVAL '60 minutes')`;
  const kunde = browser("198.51.100.20");
  const k1 = await kunde.get(`/app/login/link/${token}?weiter=${encodeURIComponent("/app/mehr/passwort")}`);
  pruefe(k1.status === 302 && k1.wohin === "/app/mehr/passwort" && kunde.glas.has("fiaon_kunde") && kunde.glas.has("fiaon_frisch"),
    `4a Klick auf den Link: angemeldet, frisch, weiter zu ${k1.wohin}`);
  const k2 = await kunde.get(`/kunde/${OPFER_REF}/bereich`);
  pruefe(k2.status === 200 && k2.j?.passwortFrisch === true, `4b Bereich meldet passwortFrisch (${k2.status} ${k2.j?.passwortFrisch})`);
  const ohneFrisch = browser("198.51.100.21");
  ohneFrisch.glas.set("fiaon_kunde", kunde.glas.get("fiaon_kunde")!);
  const k3 = await ohneFrisch.post(`/kunde/${OPFER_REF}/passwort`, { neu: "Ohne-Frisch-444" });
  pruefe(k3.status === 400 && (await opferHash()) === hash0, `4c nur Sitzung, ohne frischen Link: bisheriges Passwort nötig (${k3.status})`);
  const k4 = await kunde.post(`/kunde/${OPFER_REF}/passwort`, { neu: "Neu-Nach-Link-555" });
  pruefe(k4.status === 200 && k4.j?.ok === true, `4d mit frischem Link: neues Passwort ohne das alte gespeichert (${k4.status})`);
  const h4 = await opferHash();
  pruefe(istGehasht(h4) && h4 !== hash0, "4e neues Passwort liegt gehasht");
  const l4 = await browser("198.51.100.22").post("/login", { email: OPFER_MAIL, password: "Neu-Nach-Link-555" });
  pruefe(l4.status === 200 && l4.j?.ref === OPFER_REF, `4f Anmeldung mit dem neuen Passwort (${l4.status} ${l4.j?.ref ?? ""})`);
  const [vm] = await sql`SELECT text FROM fiaon_vermerke WHERE ref = ${OPFER_REF} ORDER BY id DESC LIMIT 1`.catch(() => [] as any[]);
  pruefe(/über den Anmelde-Link neu festgelegt/.test(String(vm?.text ?? "")), "4g Vermerk in der Akte");

  // ── NEUKUNDE: nichts darf sich für ehrliche Anträge ändern ───────────────
  console.log("\nNeukunde — Antrag mit neuer Adresse und Passwort");
  const neu = browser("198.51.100.30");
  await neu.post("/application", { ref: NEU_REF, type: "private", status: "started", currentStep: 1, firstName: "Nina", lastName: "Neu", email: NEU_MAIL, phoneCountryCode: "+49", phone: "17699988877", password: "Neu-Kunde-666" });
  const [n1] = await sql`SELECT password FROM fiaon_applications WHERE ref = ${NEU_REF}`;
  pruefe(istGehasht(String(n1?.password ?? "")), "5a Passwort gespeichert (gehasht)");
  await neu.post("/application", { ref: NEU_REF, type: "private", status: "started", currentStep: 2, firstName: "Nina", lastName: "Neu", email: NEU_MAIL, phoneCountryCode: "+49", phone: "17699988877", password: "Neu-Kunde-777" });
  const l5 = await browser("198.51.100.31").post("/login", { email: NEU_MAIL, password: "Neu-Kunde-777" });
  pruefe(l5.status === 200 && l5.j?.ref === NEU_REF, `5b eigenes Passwort beim zweiten Speichern geändert, Anmeldung geht (${l5.status})`);
} finally {
  await aufraeumen().catch((e) => console.error("Aufräumen:", e?.message || e));
  const [rest] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE lower(email) = ANY(${[OPFER_MAIL, NEU_MAIL]})`;
  console.log(`\nAufgeräumt: ${rest.n === 0 ? "ja" : `NEIN (${rest.n} Zeilen übrig)`}`);
  await sql.end();
}
console.log(fehler === 0 ? "\nE-302: alle Prüfungen bestanden." : `\nE-302: ${fehler} Prüfung(en) ROT.`);
process.exit(fehler === 0 ? 0 : 1);
