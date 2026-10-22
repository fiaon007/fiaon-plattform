// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MIT DATENBANK UND BROWSER: DER PERSÖNLICHE ZUGANG (E-423, 22.10.2026)
//
// Fährt den ganzen Weg echt — gegen eine LOKALE Kopie der Prüf-Datenbank und einen
// lokalen Server (PRUEF_BASIS), nie gegen die Produktion:
//   A  Banner im Portal (Link, noch ohne Zugang) → Zugang einrichten → schwache und
//      ungleiche Passwörter abgewiesen → Code (aus dem Mailprotokoll, Klartext nur
//      lokal) → ein falscher Versuch → richtiger Code → Sitzung → Portal ohne Link.
//   B  Der alte Link führt jetzt zur Anmeldung (401 anmelden, Adresse vorbelegt),
//      auch für Vertrag/Rechnung; die Vorschau der Leitung öffnet weiterhin.
//   C  Anmeldung: unbekannte Adresse und falsches Passwort → derselbe Satz und
//      Status; Sperre nach fünf Fehlversuchen für beide gleich; „neu senden“ erst
//      nach 60 s; Code → Sitzung; Abmelden beendet die Sitzung.
//   D  „Passwort vergessen“: gleiche Antwort für jede Adresse; Link → neues
//      Passwort → Code → alte Sitzungen enden; der Link gilt danach nicht mehr.
//   E  Einladung nach der Annahme (globalKontoNachAnnahme) und von Hand
//      (Chefbüro-Route) — zweite Annahme in 24 h lädt nicht doppelt ein.
//   F  Screenshots (Desktop 1440 px und 390 px): Anmeldung, Code, Zugang einrichten,
//      Banner im Portal, angemeldetes Portal, Übersicht, Passwort vergessen,
//      Chefbüro › Kundenzugänge → PRUEF_FOTOS.
//
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<kopie> \
//     GLOBAL_KONTO_PROTOKOLL_KLARTEXT=1 APP_BASE_URL=<PRUEF_BASIS> \
//     SESSION_SECRET=<wie der Server> PRUEF_BASIS=http://127.0.0.1:5291 PRUEF_CHEF_CODE=<ADMIN_ACCESS_CODE des Servers> \
//     PRUEF_FOTOS=/private/tmp/claude-502/shots-login npx tsx scripts/pruef-global-login-lokal.ts
// Der Server läuft mit GLOBAL_KONTO_PROTOKOLL_KLARTEXT=1 und OHNE BREVO_API_KEY: Jede Mail steht mit Inhalt im
// Mailprotokoll („fehlgeschlagen: BREVO_API_KEY ist nicht gesetzt“) — verschickt wird nichts.
// Alle Testadressen enden auf .invalid (RFC 2606, gehört niemandem).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

const URL_DB = String(process.env.DATABASE_URL || "");
if (!/@(127\.0\.0\.1|localhost):\d+\//.test(URL_DB)) { console.error("ABBRUCH: nur gegen eine lokale Prüf-Datenbank (127.0.0.1)."); process.exit(2); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(2); }
const BASIS = String(process.env.PRUEF_BASIS || "http://127.0.0.1:5291");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASIS)) { console.error("ABBRUCH: PRUEF_BASIS muss ein lokaler Server sein."); process.exit(2); }
const FOTOS = process.env.PRUEF_FOTOS || "";

const { sqlPool } = await import("../server/lib/db-pool");
const A = await import("../server/lib/fiaon-global-auftrag");
const M = await import("../server/lib/fiaon-global-mandat");
const K = await import("../server/lib/fiaon-global-konto");
const { KONTO_SAETZE } = await import("../shared/fiaon-global-konto");

const START = new Date();
let fehler = 0; let n = 0;
const ok = (b: boolean, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}`, zusatz !== undefined ? JSON.stringify(zusatz).slice(0, 500) : ""); } else console.log(`  ok      ${was}`); };
const abschnitt = (t: string) => console.log(`\n── ${t}`);

// ── Saat ─────────────────────────────────────────────────────────────────────
const KUNDEN = [
  { ref: "FIAON-PRUEF-LOGIN-1", email: "max.muster@pruefstand.invalid", vorname: "Max", nachname: "Muster", anrede: "Herr", firma: "Muster Holding GmbH", paket: "global_banking" },
  { ref: "FIAON-PRUEF-LOGIN-2", email: "erika.beispiel@pruefstand.invalid", vorname: "Erika", nachname: "Beispiel", anrede: "Frau", firma: "Beispiel Ventures GmbH", paket: "global_struktur" },
  { ref: "FIAON-PRUEF-LOGIN-3", email: "jana.test@pruefstand.invalid", vorname: "Jana", nachname: "Test", anrede: "Frau", firma: "Test & Partner GmbH", paket: "global_banking" },
];
async function aufraeumen() {
  const refs = KUNDEN.map((k) => k.ref); const mails = KUNDEN.map((k) => k.email);
  await sqlPool`DELETE FROM fiaon_global_konto_sitzungen WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ANY(${mails}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_konto_codes WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ANY(${mails}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_konto_refs WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ANY(${mails}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_konto_protokoll WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ANY(${mails}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_konten WHERE email = ANY(${mails})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_auftraege WHERE ref = ANY(${refs})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${refs})`.catch(() => {});
}
await A.ensureGlobalTabelle(); await M.ensureGlobalMandat(); await K.ensureGlobalKonto();
await aufraeumen();
for (const k of KUNDEN) {
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_name, contact_email, email)
    VALUES (${k.ref}, 'business', 'submitted', ${k.paket}, ${k.paket}, ${"PAY-" + k.ref.slice(-6)}, 'paid', 4999.00, ${k.firma}, ${k.vorname + " " + k.nachname}, ${k.email}, ${k.email})`;
  await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, firma_name, email, portal_neu_am, gestartet_am, bezahlt_am)
    VALUES (${k.ref}, ${k.paket}, 'DE', ${sqlPool.json({ name: k.firma, ort: "München", land: "DE", strasse: "Weg 1", plz: "80331" } as any)},
            ${sqlPool.json({ anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, funktion: "Geschäftsführung", email: k.email, telefon: "+4989123456" } as any)},
            '{}'::jsonb, 'v1', 'de', NOW() - INTERVAL '20 days', 'gestartet', ${k.firma}, ${k.email}, NOW(), NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days')`;
}

// ── HTTP mit Keksdose ────────────────────────────────────────────────────────
type Dose = Map<string, string>;
const neueDose = (): Dose => new Map();
async function http(dose: Dose | null, methode: "GET" | "POST", pfad: string, body?: unknown): Promise<{ status: number; j: any; kekse: string[] }> {
  const r = await fetch(`${BASIS}${pfad}`, {
    method: methode, redirect: "manual",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh) Pruefstand", ...(dose && dose.size ? { Cookie: Array.from(dose.entries()).map(([k, v]) => `${k}=${v}`).join("; ") } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const kekse = (r.headers as any).getSetCookie?.() ?? [];
  if (dose) for (const c of kekse) { const [paar] = c.split(";"); const i = paar.indexOf("="); const name = paar.slice(0, i); const wert = paar.slice(i + 1); if (wert) dose.set(name, wert); else dose.delete(name); }
  const text = await r.text();
  let j: any = null; try { j = JSON.parse(text); } catch { j = { roh: text.slice(0, 200) }; }
  return { status: r.status, j, kekse };
}
async function letzterCode(email: string): Promise<string> {
  const [z] = (await sqlPool`SELECT COALESCE(payload->>'login_code', (payload #>> '{}')::jsonb ->> 'login_code') AS code FROM fiaon_mail_log WHERE event = 'global_login_code' AND empfaenger = ${email} ORDER BY id DESC LIMIT 1`) as any[];
  return String(z?.code ?? "");
}
async function letzterLink(event: string, feld: string, email: string): Promise<string> {
  const [z] = (await sqlPool.unsafe(`SELECT COALESCE(payload->>'${feld}', (payload #>> '{}')::jsonb ->> '${feld}') AS url FROM fiaon_mail_log WHERE event = $1 AND empfaenger = $2 ORDER BY id DESC LIMIT 1`, [event, email])) as any[];
  return String(z?.url ?? "");
}
const tokenAus = (url: string) => decodeURIComponent(url.split(/#[ep]=/)[1] ?? "");
const [K1, K2, K3] = KUNDEN;
const PW1 = "Morgenrot über dem Hafen 7";
const PW2 = "Abendlicht am Isarufer 42";
const link1 = A.globalTokenErzeugen(K1.ref, 864e5);
const link2 = A.globalTokenErzeugen(K2.ref, 864e5);

// ═══ A ═══════════════════════════════════════════════════════════════════════
abschnitt("A · Banner → Zugang einrichten → Code → Sitzung");
const dose1 = neueDose();
{
  let r = await http(null, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}?t=${encodeURIComponent(link1)}`);
  ok(r.status === 200 && r.j.zugangEinrichten === true && !r.j.konto, "Link ohne Zugang: Portal öffnet, Banner-Merker gesetzt", { s: r.status, z: r.j.zugangEinrichten });
  r = await http(null, "POST", "/api/fiaon/global/konto/einrichten", { ref: K1.ref, t: "1.falsch" });
  ok(r.status === 403, "Banner-Knopf mit falschem Link → 403", r.status);
  r = await http(null, "POST", "/api/fiaon/global/konto/einrichten", { ref: K1.ref, t: link1 });
  ok(r.status === 200 && /^\/business\/zugang#e=e\./.test(r.j.pfad), "Banner-Knopf → Einrichtungs-Link (Geheimnis im Anker)", r.j);
  const token = tokenAus(String(r.j.pfad));
  r = await http(null, "POST", "/api/fiaon/global/konto/link", { token });
  ok(r.j.ok && r.j.art === "einladung" && r.j.email === K1.email && r.j.name === "Max Muster" && r.j.firma === K1.firma, "Link lesen: Name, Firma, Adresse aus der Akte", r.j);
  r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token, passwort: "passwort1234", wiederholung: "passwort1234" });
  ok(r.status === 400 && r.j.error === KONTO_SAETZE.de.passwort.zu_einfach, "zu einfaches Passwort abgewiesen", r.j);
  r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token, passwort: PW1, wiederholung: PW1 + "x" });
  ok(r.status === 400 && r.j.error === KONTO_SAETZE.de.passwort.ungleich, "ungleiche Wiederholung abgewiesen", r.j);
  r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token, passwort: PW1, wiederholung: PW1, bleiben: true });
  ok(r.j.ok && /^[A-Za-z0-9_-]{43}$/.test(r.j.vorgang) && /^m•+@pruefstand\.invalid$/.test(r.j.maske), "Passwort angenommen → Vorgang, Adresse maskiert", r.j);
  const vorgang = r.j.vorgang;
  const [vorher] = (await sqlPool`SELECT status, passwort_hash FROM fiaon_global_konten WHERE email = ${K1.email}`) as any[];
  ok(vorher?.status === "eingeladen" && !vorher.passwort_hash, "VOR dem Code: kein Passwort gespeichert, Status eingeladen", vorher);
  const code = await letzterCode(K1.email);
  ok(/^\d{6}$/.test(code), "Code steht (nur lokal) im Mailprotokoll", code);
  const [ml] = (await sqlPool`SELECT status, grund, (payload #>> '{}')::jsonb ->> 'code_anlass' AS anlass FROM fiaon_mail_log WHERE event = 'global_login_code' AND empfaenger = ${K1.email} ORDER BY id DESC LIMIT 1`) as any[];
  ok(ml?.status === "uebersprungen" && /BREVO_API_KEY/.test(ml.grund) && /neuen Zugangs/.test(ml.anlass), "nichts verschickt (ohne Schlüssel), Anlass „Zugang bestätigen“", ml);
  const falsch = code === "000000" ? "111111" : "000000";
  r = await http(dose1, "POST", "/api/fiaon/global/konto/code", { vorgang, code: falsch });
  ok(r.status === 400 && r.j.error === KONTO_SAETZE.de.codeFalsch(4), "falscher Code: noch vier Versuche", r.j);
  r = await http(dose1, "POST", "/api/fiaon/global/konto/code", { vorgang, code: code.slice(0, 3) + " " + code.slice(3) });
  ok(r.j.ok && r.j.weiter === `/business/auftrag/${K1.ref}`, "richtiger Code (mit Leerzeichen) → angemeldet, direkt in den einen Auftrag", r.j);
  const keks = r.kekse.find((c) => c.startsWith("fiaon_global_sitzung="));
  ok(!!keks && /HttpOnly/i.test(keks) && /SameSite=Lax/i.test(keks) && /Max-Age=2592000/i.test(keks), "Cookie: httpOnly, Lax, 30 Tage", keks);
  r = await http(dose1, "POST", "/api/fiaon/global/konto/code", { vorgang, code });
  ok(r.status === 400 && r.j.code === "verbraucht", "derselbe Code ein zweites Mal → verbraucht", r.j);
  const [nach] = (await sqlPool`SELECT status, passwort_hash, eingerichtet_am, einladung_nonce FROM fiaon_global_konten WHERE email = ${K1.email}`) as any[];
  ok(nach?.status === "aktiv" && String(nach.passwort_hash).startsWith("scrypt$") && !!nach.eingerichtet_am && nach.einladung_nonce === null, "Konto aktiv, Passwort als scrypt, Einladung verbraucht", { ...nach, passwort_hash: "…" });
  r = await http(null, "POST", "/api/fiaon/global/konto/link", { token });
  ok(r.status === 409 && r.j.code === "schon_eingerichtet" && r.j.email === K1.email, "Einladungslink danach: „schon eingerichtet“ (Anmeldung vorbelegt)", r.j);
  r = await http(dose1, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}`);
  ok(r.status === 200 && r.j.konto?.email === K1.email && typeof r.j.sitzungZugang === "string" && !r.j.zugangEinrichten && !r.j.zugang, "mit Sitzung: Portal ohne Link, Leiste statt Banner", { s: r.status, k: r.j.konto });
  r = await http(dose1, "GET", `/api/fiaon/global/mein-auftrag/${K2.ref}`);
  ok(r.status === 403, "mit Sitzung: FREMDE Akte (ohne Zugang) bleibt zu", r.status);
  r = await http(dose1, "GET", "/api/fiaon/global/konto/ich");
  ok(r.j.ok && r.j.auftraege.length === 1 && r.j.auftraege[0].ref === K1.ref && r.j.auftraege[0].status === "gestartet", "Übersicht: genau der eigene Auftrag", r.j);
}

// ═══ B ═══════════════════════════════════════════════════════════════════════
abschnitt("B · Der alte Link führt zur Anmeldung; Vorschau der Leitung bleibt");
{
  let r = await http(null, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}?t=${encodeURIComponent(link1)}`);
  ok(r.status === 401 && r.j.code === "anmelden" && r.j.email === K1.email, "gültiger Link, Zugang eingerichtet → 401 anmelden, Adresse zum Vorbelegen", r.j);
  r = await http(null, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}?t=1.kaputt`);
  ok(r.status === 401 && r.j.code === "anmelden" && !r.j.email, "ungültiger Link → anmelden OHNE Adresse", r.j);
  r = await http(null, "GET", `/api/fiaon/global/auftrag/${K1.ref}/vertrag.pdf?t=${encodeURIComponent(link1)}`);
  ok(r.status === 401, "auch Vertrag/Rechnung: Link allein genügt nicht mehr", r.status);
  r = await http(null, "POST", "/api/fiaon/global/konto/einrichten", { ref: K1.ref, t: link1 });
  ok(r.status === 409, "Banner-Knopf bei eingerichtetem Zugang → 409", r.status);
  const chef = neueDose();
  const o = await http(chef, "POST", "/api/fiaon/zugang/oeffnen", { code: process.env.PRUEF_CHEF_CODE || "" });
  ok(o.status === 200 && chef.size > 0, "Chefbüro-Tür lokal geöffnet (Admin-Code)", o.status);
  r = await http(chef, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}?t=${encodeURIComponent(link1)}&vorschau=neu`);
  ok(r.status === 200 && r.j.auftrag?.vorschau === true && !r.j.konto && !r.j.zugangEinrichten, "Vorschau der Leitung öffnet trotz eingerichtetem Zugang", { s: r.status, v: r.j.auftrag?.vorschau });
  r = await http(null, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}?t=${encodeURIComponent(link1)}&vorschau=neu`);
  ok(r.status === 401, "„vorschau=neu“ ohne Chefbüro hilft nicht", r.status);
}

// ═══ C ═══════════════════════════════════════════════════════════════════════
abschnitt("C · Anmeldung, keine Aufzählbarkeit, Sperre, neu senden, Abmelden");
{
  const leer = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: "niemand@pruefstand.invalid", passwort: "irgendwas123" });
  const falsch = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: K1.email, passwort: "falsches-passwort-1" });
  ok(leer.status === 401 && falsch.status === 401 && leer.j.error === falsch.j.error && leer.j.error === KONTO_SAETZE.de.anmeldungFalsch && JSON.stringify(Object.keys(leer.j).sort()) === JSON.stringify(Object.keys(falsch.j).sort()),
    "unbekannte Adresse und falsches Passwort: derselbe Status, derselbe Satz, dieselben Felder", { leer: leer.j, falsch: falsch.j });
  const eingeladen = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: K2.email, passwort: "irgendwas123" });
  ok(eingeladen.status === 401 && eingeladen.j.error === KONTO_SAETZE.de.anmeldungFalsch, "Adresse ohne eingerichteten Zugang: derselbe Satz");
  let r = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: K1.email.toUpperCase(), passwort: PW1, bleiben: false });
  ok(r.j.ok && !!r.j.vorgang, "richtiges Passwort (Adresse in Großbuchstaben) → Code", r.j);
  const vorgang = r.j.vorgang;
  r = await http(null, "POST", "/api/fiaon/global/konto/code-neu", { vorgang });
  ok(r.status === 429 && r.j.code === "warten" && /Sekunden/.test(r.j.error), "„neu senden“ sofort → warten", r.j);
  const dose = neueDose();
  r = await http(dose, "POST", "/api/fiaon/global/konto/code", { vorgang, code: await letzterCode(K1.email), weiter: "https://boese.example/x" });
  const keks = r.kekse.find((c) => c.startsWith("fiaon_global_sitzung="));
  ok(r.j.ok && r.j.weiter === `/business/auftrag/${K1.ref}` && !!keks && !/Max-Age/i.test(keks), "Code → angemeldet; fremdes Ziel ignoriert; ohne „angemeldet bleiben“ nur Browsersitzung", { w: r.j.weiter, keks });
  r = await http(dose, "POST", "/api/fiaon/global/konto/abmelden", {});
  ok(r.j.ok, "abgemeldet");
  const [s] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_konto_sitzungen s JOIN fiaon_global_konten k ON k.id = s.konto_id WHERE k.email = ${K1.email} AND s.beendet_grund = 'abgemeldet'`) as any[];
  ok(Number(s?.n) >= 1, "Sitzung beendet (beendet_am, nicht gelöscht)");
  r = await http(dose, "GET", `/api/fiaon/global/mein-auftrag/${K1.ref}`);
  ok(r.status === 401 && r.j.code === "anmelden", "nach dem Abmelden: Portal verlangt Anmeldung", r.status);
  // Sperre: fünf Fehlversuche je Adresse — bekannte und unbekannte gleich.
  const ergebnisse: string[] = [];
  for (const email of [K3.email.replace("jana", "gibtsnicht"), K1.email]) {
    const st: number[] = [];
    for (let i = 0; i < 6; i++) st.push((await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email, passwort: `falsch-${i}-xxxxxx` })).status);
    ergebnisse.push(st.join(","));
  }
  ok(ergebnisse[0] === ergebnisse[1] && ergebnisse[0].endsWith("401,429"), "Sperre: unbekannte und bekannte Adresse verhalten sich gleich (… 401, dann 429)", ergebnisse);
  r = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: K1.email, passwort: PW1 });
  ok(r.status === 429 && r.j.error === KONTO_SAETZE.de.gesperrt, "gesperrt: auch das RICHTIGE Passwort wartet 15 Minuten", r.j);
  const [prot] = (await sqlPool`SELECT COUNT(*) FILTER (WHERE ereignis = 'anmeldung_falsch')::int AS falsch, COUNT(*) FILTER (WHERE ereignis = 'anmeldung')::int AS gut FROM fiaon_global_konto_protokoll p JOIN fiaon_global_konten k ON k.id = p.konto_id WHERE k.email = ${K1.email}`) as any[];
  ok(Number(prot?.falsch) >= 5 && Number(prot?.gut) >= 2, "Anmeldeprotokoll: Fehlversuche und Anmeldungen stehen drin", prot);
  // Für die Bildschirmfotos: Sperre aufheben (DB) — die Sperre im Speicher des Servers vergisst nach 15 Minuten; die Fotos nehmen K1 deshalb erst nach D.
  await sqlPool`UPDATE fiaon_global_konten SET gesperrt_bis = NULL, fehlversuche = 0 WHERE email = ${K1.email}`;
}

// ═══ D ═══════════════════════════════════════════════════════════════════════
abschnitt("D · Passwort vergessen");
let dose3 = neueDose();
{
  const a = await http(null, "POST", "/api/fiaon/global/konto/passwort-vergessen", { email: "niemand@pruefstand.invalid" });
  const b = await http(null, "POST", "/api/fiaon/global/konto/passwort-vergessen", { email: K3.email });
  // K3 hat (noch) kein Konto; K1 ist gesperrt im Speicher — für den echten Weg ein eigenes, aktiviertes Konto: K3 über die Annahme.
  ok(a.status === 200 && b.status === 200 && a.j.text === b.j.text && a.j.text === KONTO_SAETZE.de.vergessenOk, "gleiche Antwort für jede Adresse", { a: a.j, b: b.j });
  // K3: Einladung nach der Annahme (E).
  const e1 = await K.globalKontoNachAnnahme({ auftragRef: K3.ref });
  ok(e1.ergebnis === "eingeladen", "Annahme → Einladung", e1);
  const e2 = await K.globalKontoNachAnnahme({ auftragRef: K3.ref });
  ok(e2.ergebnis === "verknuepft", "zweite Annahme binnen 24 h → nur verknüpft, keine zweite Mail", e2);
  const url = await letzterLink("global_zugang_einladung", "einrichten_url", K3.email);
  ok(url.startsWith(`${BASIS}/business/zugang#e=`), "Einladungsmail trägt den Link (lokal im Klartext protokolliert)", url.slice(0, 60));
  let r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token: tokenAus(url), passwort: PW1, wiederholung: PW1 });
  r = await http(dose3, "POST", "/api/fiaon/global/konto/code", { vorgang: r.j.vorgang, code: await letzterCode(K3.email) });
  ok(r.j.ok, "K3 eingerichtet und angemeldet", r.j);
  r = await http(null, "POST", "/api/fiaon/global/konto/passwort-vergessen", { email: K3.email });
  const purl = await letzterLink("global_passwort_neu", "passwort_url", K3.email);
  ok(r.j.text === KONTO_SAETZE.de.vergessenOk && purl.includes("/business/zugang#p=p."), "Link „neues Passwort“ in der Mail", purl.slice(0, 50));
  r = await http(null, "POST", "/api/fiaon/global/konto/link", { token: tokenAus(purl) });
  ok(r.j.ok && r.j.art === "passwort", "Passwort-Link gültig", r.j);
  r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token: tokenAus(purl), passwort: PW2, wiederholung: PW2 });
  const dose4 = neueDose();
  r = await http(dose4, "POST", "/api/fiaon/global/konto/code", { vorgang: r.j.vorgang, code: await letzterCode(K3.email) });
  ok(r.j.ok, "neues Passwort bestätigt → angemeldet", r.j);
  r = await http(dose3, "GET", `/api/fiaon/global/mein-auftrag/${K3.ref}`);
  ok(r.status === 401, "neues Passwort beendet die ALTE Sitzung", r.status);
  r = await http(null, "POST", "/api/fiaon/global/konto/link", { token: tokenAus(purl) });
  ok(r.status === 400, "Passwort-Link ein zweites Mal → ungültig", r.status);
  r = await http(null, "POST", "/api/fiaon/global/konto/anmelden", { email: K3.email, passwort: PW1 });
  ok(r.status === 401, "altes Passwort gilt nicht mehr", r.status);
  dose3 = dose4;
}

// ═══ E ═══════════════════════════════════════════════════════════════════════
abschnitt("E · Chefbüro: Kundenzugänge und „Zugang einladen“");
{
  const chef = neueDose();
  await http(chef, "POST", "/api/fiaon/zugang/oeffnen", { code: process.env.PRUEF_CHEF_CODE || "" });
  let r = await http(null, "GET", "/api/fiaon/chef/global/zugaenge");
  ok(r.status === 401, "ohne Chefbüro: 401", r.status);
  r = await http(chef, "GET", "/api/fiaon/chef/global/zugaenge");
  const je = new Map<string, any>((r.j.zugaenge ?? []).map((z: any) => [z.email, z]));
  ok(je.get(K1.email)?.status === "aktiv" && je.get(K2.email)?.status === "keins" && je.get(K3.email)?.status === "aktiv" && je.get(K2.email)?.refs?.includes(K2.ref), "Liste: Stand je Kunde (K2 noch ohne Zugang, mit seiner Akte)", Array.from(je.values()).map((z) => `${z.email}:${z.status}`));
  r = await http(chef, "POST", "/api/fiaon/chef/global/zugaenge/einladen", { email: K1.email });
  ok(r.status === 409, "eingerichteter Zugang wird nicht neu eingeladen", r.j);
  r = await http(chef, "POST", "/api/fiaon/chef/global/zugaenge/einladen", { email: K2.email });
  ok(r.j.ok && /Einladung an erika\.beispiel@pruefstand\.invalid geschickt/.test(r.j.meldung), "„Einladung erneut senden“ an K2", r.j);
  const [z] = (await sqlPool`SELECT einladung_anzahl, einladung_von FROM fiaon_global_konten WHERE email = ${K2.email}`) as any[];
  ok(Number(z?.einladung_anzahl) >= 1 && String(z?.einladung_von) === "Chefbüro", "Einladung gezählt, Absender vermerkt", z);
  r = await http(chef, "POST", "/api/fiaon/chef/global/zugaenge/einladen", { email: "niemand@pruefstand.invalid" });
  ok(r.status === 404, "Adresse ohne Auftrag/Angebot: 404 mit Klartext", r.j);
  const [geheim] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event IN ('global_login_code', 'global_zugang_einladung', 'global_passwort_neu') AND payload::text LIKE '%[verborgen]%' AND created_at >= ${START}`) as any[];
  ok(Number(geheim?.n) === 0, "(lokal mit Schalter: Klartext — in der Produktion „[verborgen]“, siehe pruef-global-login.ts)");
}

// ═══ G · NUR LINK, UNBEZAHLT, BEGLEIT OHNE AKTE, KOOPERATION BLEIBT DRAUSSEN ══
abschnitt("G · „Nur Link erzeugen“ · angenommen-aber-unbezahlt · Begleitvertrag ohne Akte · Kooperation nie im Kundenzugang");
{
  const chef = neueDose();
  await http(chef, "POST", "/api/fiaon/zugang/oeffnen", { code: process.env.PRUEF_CHEF_CODE || "" });
  // Der Prüffall des Individualangebots (Teil 1 offen = angenommen, nicht bezahlt).
  const [ia] = (await sqlPool`SELECT a.angebot_ref, a.auftrag_ref, b.payment_status, LOWER(a.kunde->>'email') AS email FROM fiaon_global_angebote a JOIN fiaon_applications b ON b.ref = a.auftrag_ref
    WHERE a.status = 'angenommen' AND a.fassung LIKE 'IA-2026-%' AND b.payment_status = 'pending_payment' ORDER BY a.id LIMIT 1`) as any[];
  ok(!!ia, "Prüffall: angenommenes Individualangebot mit offener Rechnung", ia);
  if (ia) {
    await sqlPool`DELETE FROM fiaon_global_konto_refs WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ${ia.email})`;
    await sqlPool`DELETE FROM fiaon_global_konto_codes WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ${ia.email})`;
    await sqlPool`DELETE FROM fiaon_global_konto_sitzungen WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ${ia.email})`;
    await sqlPool`DELETE FROM fiaon_global_konto_protokoll WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = ${ia.email})`;
    await sqlPool`DELETE FROM fiaon_global_konten WHERE email = ${ia.email}`;
    const vorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE empfaenger = ${ia.email}`) as any[])[0].n);
    let r = await http(chef, "POST", "/api/fiaon/chef/global/zugaenge/einladen", { email: ia.email, nurLink: true });
    const nachher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE empfaenger = ${ia.email}`) as any[])[0].n);
    ok(r.j.ok && /\/business\/zugang#e=e\./.test(String(r.j.link)) && /KEINE Mail/.test(r.j.meldung), "„Nur Link erzeugen“: Link zurück, Hinweis „keine Mail“", r.j.meldung);
    ok(nachher === vorher, "„Nur Link erzeugen“: keine Zeile im Mailprotokoll (nichts verschickt)", { vorher, nachher });
    const [pr] = (await sqlPool`SELECT p.ereignis FROM fiaon_global_konto_protokoll p JOIN fiaon_global_konten k ON k.id = p.konto_id WHERE k.email = ${ia.email} ORDER BY p.id DESC LIMIT 1`) as any[];
    ok(pr?.ereignis === "einladung_link", "Anmeldeprotokoll: „einladung_link“", pr);
    const [vl] = (await sqlPool`SELECT verlauf->-1->>'was' AS was FROM fiaon_global_angebote WHERE angebot_ref = ${ia.angebot_ref}`) as any[];
    ok(/Einladungslink .* von Hand verschickt, keine Systemmail/.test(String(vl?.was)), "Verlauf des Angebots: Link erzeugt, von Hand verschickt", vl);
    const tok = tokenAus(String(r.j.link));
    r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token: tok, passwort: PW1, wiederholung: PW1 });
    const dose = neueDose();
    r = await http(dose, "POST", "/api/fiaon/global/konto/code", { vorgang: r.j.vorgang, code: await letzterCode(ia.email) });
    ok(r.j.ok && r.j.weiter === `/business/auftrag/${ia.auftrag_ref}`, "unbezahlter Kunde richtet ein und landet in seinem Auftrag", r.j);
    r = await http(dose, "GET", `/api/fiaon/global/mein-auftrag/${ia.auftrag_ref}`);
    ok(r.status === 200 && r.j.auftrag?.status === "offen", "Portal öffnet auch bei offener Rechnung (Status offen)", { s: r.status, st: r.j.auftrag?.status });
  }
  // Begleitvertrag ohne Akte + Kooperationsvertrag an DERSELBEN Adresse (wie im Bestand): Zugang nur zur Kundenseite.
  const [bg] = (await sqlPool`SELECT id, angebot_ref, LOWER(kunde->>'email') AS email FROM fiaon_global_angebote WHERE status = 'angenommen' AND fassung LIKE 'IA-BEGLEIT-%' ORDER BY id LIMIT 1`) as any[];
  const [kp] = (await sqlPool`SELECT id, angebot_ref, kunde FROM fiaon_global_angebote WHERE fassung LIKE 'IA-KOOP-%' ORDER BY id LIMIT 1`) as any[];
  ok(!!bg && !!kp, "Prüffälle: Begleitvertrag und Kooperationsvertrag vorhanden");
  if (bg && kp) {
    const kundeAlt = kp.kunde;
    await sqlPool`UPDATE fiaon_global_angebote SET kunde = jsonb_set(kunde, '{email}', to_jsonb(${bg.email}::text)), status = 'angenommen' WHERE id = ${kp.id}`;
    try {
      for (const t of ["fiaon_global_konto_refs", "fiaon_global_konto_codes", "fiaon_global_konto_sitzungen", "fiaon_global_konto_protokoll"]) await sqlPool.unsafe(`DELETE FROM ${t} WHERE konto_id IN (SELECT id FROM fiaon_global_konten WHERE email = $1)`, [bg.email]);
      await sqlPool`DELETE FROM fiaon_global_konten WHERE email = ${bg.email}`;
      let r = await http(chef, "POST", "/api/fiaon/chef/global/zugaenge/einladen", { email: bg.email, nurLink: true });
      ok(r.j.ok, "Begleit-Kunde: Link erzeugt", r.j.meldung);
      const refs = ((await sqlPool`SELECT r.art, r.ref FROM fiaon_global_konto_refs r JOIN fiaon_global_konten k ON k.id = r.konto_id WHERE k.email = ${bg.email}`) as any[]).map((x) => `${x.art}:${x.ref}`);
      ok(refs.includes(`angebot:${bg.angebot_ref}`) && !refs.includes(`angebot:${kp.angebot_ref}`), "verknüpft: der Begleitvertrag — NICHT der Kooperationsvertrag", refs);
      r = await http(null, "POST", "/api/fiaon/global/konto/passwort-setzen", { token: tokenAus(String(r.j.link)), passwort: PW1, wiederholung: PW1 });
      const dose = neueDose();
      r = await http(dose, "POST", "/api/fiaon/global/konto/code", { vorgang: r.j.vorgang, code: await letzterCode(bg.email) });
      ok(r.j.ok && r.j.weiter === "/business/konto", "Begleit ohne Akte → Übersicht", r.j);
      r = await http(dose, "GET", "/api/fiaon/global/konto/ich");
      ok(r.j.ok && r.j.angebote.length === 1 && r.j.angebote[0].ref === bg.angebot_ref && /Begleitvertrag/.test(r.j.angebote[0].titel) && r.j.auftraege.length === 0, "Übersicht: nur der Begleitvertrag, kein Partnerbereich", r.j);
      ok(!JSON.stringify(r.j).includes(kp.angebot_ref) && !/IA-KOOP|koop|partner/i.test(JSON.stringify(r.j)), "keine Spur der Kooperation in der Übersicht");
      if (r.j.angebote?.[0]?.vertragUrl) {
        const pdf = await fetch(`${BASIS}${r.j.angebote[0].vertragUrl}`, { headers: { Cookie: Array.from(dose.entries()).map(([k, v]) => `${k}=${v}`).join("; ") } });
        ok(pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf", "Vertrag (PDF) des Begleitvertrags mit Sitzung", pdf.status);
        const fremd = await fetch(`${BASIS}/api/fiaon/global/konto/angebot/${kp.id}/vertrag.pdf`, { headers: { Cookie: Array.from(dose.entries()).map(([k, v]) => `${k}=${v}`).join("; ") } });
        ok(fremd.status === 404, "Vertrag des Kooperationsvertrags: 404 (nicht verknüpft)", fremd.status);
      }
    } finally {
      await sqlPool`UPDATE fiaon_global_angebote SET kunde = ${sqlPool.json(kundeAlt)} WHERE id = ${kp.id}`;
    }
  }
}

// ═══ F · SCREENSHOTS ═════════════════════════════════════════════════════════
if (FOTOS) {
  abschnitt("F · Bildschirmfotos");
  fs.mkdirSync(FOTOS, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const groessen = [{ name: "desktop", width: 1440, height: 900 }, { name: "390", width: 390, height: 844 }];
  for (const g of groessen) {
    // Frischer Zustand je Durchgang: K2 noch ohne Zugang (Banner), K3 mit Zugang (Anmeldung, Code, Portal, Übersicht).
    const ctx = await browser.newContext({ viewport: { width: g.width, height: g.height }, deviceScaleFactor: 2, locale: "de-DE", isMobile: g.width < 500, hasTouch: g.width < 500 });
    const page = await ctx.newPage();
    const foto = async (name: string) => {
      // Erst wenn die Startbühne des Hauses (Fassade, index.html #fi-start) weg ist — sonst fotografiert man den Auftakt.
      await page.waitForFunction(() => !document.getElementById("fi-start"), undefined, { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(700); await page.screenshot({ path: `${FOTOS}/${g.name}-${name}.png`, fullPage: true }); console.log(`  Foto   ${g.name}-${name}.png`); };
    // 1 Anmeldung — vorher die Cookie-Wahl „Nur notwendige“ (datensparsam; sonst liegt der Hinweis über der Karte).
    await page.goto(`${BASIS}/business/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nur notwendige" }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('[data-fiaon="global-login"]');
    await foto("1-anmeldung");
    await page.fill('input[type="email"]', K3.email); await page.fill('input[autocomplete="current-password"]', PW2);
    await foto("2-anmeldung-ausgefuellt");
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForSelector(".gko-code input");
    const code = await letzterCode(K3.email);
    await page.keyboard.type(code.slice(0, 3));
    await foto("3-code-eingabe");
    ok(await page.locator(".gko-code input").nth(3).evaluate((el) => el === document.activeElement), `${g.name}: Fokus springt nach drei Ziffern ins vierte Feld`);
    await page.keyboard.type(code.slice(3));
    await page.waitForURL(`**/business/auftrag/${K3.ref}`, { timeout: 15_000 }).catch(() => {});
    ok(page.url().endsWith(`/business/auftrag/${K3.ref}`), `${g.name}: nach dem sechsten Ziffer direkt im Auftrag`, page.url());
    await page.waitForSelector('[data-fiaon="global-konto-leiste"]', { timeout: 15_000 }).catch(() => {});
    ok(await page.locator('[data-fiaon="global-konto-leiste"]').isVisible(), `${g.name}: Leiste „Angemeldet als …“ über dem Portal`);
    ok(!page.url().includes("?t="), `${g.name}: kein Link in der Adresszeile`);
    await page.waitForTimeout(1500);
    await foto("4-portal-angemeldet");
    await page.goto(`${BASIS}/business/konto`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-fiaon="global-konto-liste"]');
    await foto("5-uebersicht");
    // Abmelden über den Knopf.
    await page.getByRole("button", { name: "Abmelden" }).click();
    await page.waitForURL("**/business/login", { timeout: 10_000 }).catch(() => {});
    ok(page.url().endsWith("/business/login"), `${g.name}: „Abmelden“ führt zur Anmeldung`, page.url());
    // Banner (K2, Link, noch ohne Zugang) → Knopf → Zugang einrichten.
    await page.goto(`${BASIS}/business/auftrag/${K2.ref}?t=${encodeURIComponent(link2)}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-fiaon="global-konto-banner"]', { timeout: 15_000 }).catch(() => {});
    ok(await page.locator('[data-fiaon="global-konto-banner"]').isVisible(), `${g.name}: Banner „Zugang einrichten“ im Portal`);
    await page.waitForTimeout(1500);
    await foto("6-portal-banner");
    await page.getByRole("button", { name: "Zugang einrichten" }).click();
    await page.waitForSelector('[data-fiaon="global-zugang"]', { timeout: 15_000 });
    ok(!page.url().includes("#e="), `${g.name}: Einladungslink sofort aus der Adresszeile genommen`, page.url());
    await page.fill('input[autocomplete="new-password"] >> nth=0', PW1);
    await page.fill('input[autocomplete="new-password"] >> nth=1', PW1);
    await foto("7-zugang-einrichten");
    // Endet VOR dem Festlegen (Bildschirmfoto der Strecke, kein Abschluss im Browser — der Weg selbst ist oben über HTTP geprüft).
    // Passwort vergessen
    await page.goto(`${BASIS}/business/passwort-vergessen`, { waitUntil: "networkidle" });
    await foto("8-passwort-vergessen");
    await ctx.close();
  }
  // Chefbüro › Global › Kundenzugänge (Desktop)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: process.env.PRUEF_CHEF_CODE || "" } });
  await page.goto(`${BASIS}/chef/global`, { waitUntil: "networkidle" }).catch(() => {});
  const kopf = page.locator('[data-fiaon="chef-global-zugaenge"] .cgz-kopf');
  if (await kopf.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await kopf.click();
    ok(await page.getByRole("button", { name: "Einladung erneut senden" }).first().isVisible(), "Chefbüro: Knopf „Einladung erneut senden“ sichtbar (nicht gedrückt)");
    await page.locator('[data-fiaon="chef-global-zugaenge"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.locator('[data-fiaon="chef-global-zugaenge"]').screenshot({ path: `${FOTOS}/desktop-9-chef-kundenzugaenge.png` });
    console.log("  Foto   desktop-9-chef-kundenzugaenge.png");
  } else {
    await page.screenshot({ path: `${FOTOS}/desktop-9-chef-raum.png`, fullPage: false });
    ok(false, "Chefbüro: Leiste „Kundenzugänge“ nicht gefunden (Foto desktop-9-chef-raum.png)", page.url());
  }
  await ctx.close();
  await browser.close();
}

console.log(`\n${n - fehler} von ${n} Prüfungen bestanden${fehler ? ` — ${fehler} FEHLER` : ""}.`);
await sqlPool.end({ timeout: 2 });
process.exit(fehler ? 1 : 0);
