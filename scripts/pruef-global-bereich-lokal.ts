// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MIT DATENBANK: FIAON GLOBAL — „MEIN AUFTRAG" (17.09.2026, E-188)
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// scripts/pruef-global-bereich.ts rechnet alles nach, was ohne Datenbank geht.
// Dieser hier fährt das, was NUR mit einer Datenbank zu sehen ist: jedes SQL des
// Bereichs (Schema, Etappen, Dokumentenraum als BYTEA, Regel-Fristen mit
// ON CONFLICT, Marken des Tageslaufs, Aufgaben über auftragFuerKunden) und die
// Routen selbst über HTTP (Token 403/410, Upload über multipart, Download-Köpfe,
// Drosseln, die Zugriffsregel im Office). Beim ersten Lauf fand er einen echten
// Fehler: JSONB über JSON.stringify + ::jsonb wird von postgres.js doppelt
// kodiert (siehe Kommentar am Helfer json() in fiaon-global-bereich.ts).
//
// ── NIE GEGEN DIE PRODUKTION ──────────────────────────────────────────────
// Der Lauf SCHREIBT (Saat, Aufträge, Dokumente, Aufgaben). Er weigert sich
// deshalb, wenn DATABASE_URL nicht auf 127.0.0.1/localhost zeigt, wenn der Name
// der Datenbank nicht mit „wegwerf" beginnt, wenn sie nicht leer ist oder wenn
// ein Mail-Schlüssel gesetzt ist. Er lädt keine .env, startet nicht den
// FIAON-Server (kein index.ts, keine Crons) und verschickt nichts: Ohne
// BREVO_API_KEY scheitert jede Mail mit Grund — genau das wird mitgeprüft.
//
// ── SO WIRD ER GEFAHREN (Wegwerf-Cluster, z. B. PostgreSQL 16 von Homebrew) ─
//   D=<leeres Verzeichnis>; B=/opt/homebrew/opt/postgresql@16/bin
//   LC_ALL=en_US.UTF-8 $B/initdb -D $D -U pruefstand --auth=trust -E UTF8
//   (cd $D && openssl req -new -x509 -days 2 -nodes -out server.crt -keyout server.key -subj /CN=localhost && chmod 600 server.key)
//   printf "listen_addresses='127.0.0.1'\nport=55461\nssl=on\nunix_socket_directories=''\n" >> $D/postgresql.conf
//   LC_ALL=en_US.UTF-8 $B/pg_ctl -D $D -l $D/log.txt -w start
//   $B/psql -h 127.0.0.1 -p 55461 -U pruefstand -d postgres -c "CREATE DATABASE wegwerf_bereich"
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgres://pruefstand@127.0.0.1:55461/wegwerf_bereich \
//     npx tsx scripts/pruef-global-bereich-lokal.ts
//   $B/pg_ctl -D $D stop && rm -rf $D
// (SSL ist nötig, weil der gemeinsame Pool ssl „require" verlangt; ein selbst
// unterschriebenes Zertifikat genügt.) Das Schema der sieben Haustabellen, die der
// Bereich nur LIEST bzw. mitbenutzt, steht in pruef-global-bereich-lokal.sql —
// Spaltennamen und Typen aus information_schema der Produktion vom 17.09.2026,
// ohne Daten. Alle übrigen Tabellen legen die ensure-Funktionen selbst an.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !ziel.pathname.replace(/^\//, "").startsWith("wegwerf")) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen eine lokale Wegwerf-Datenbank (127.0.0.1, Name beginnt mit „wegwerf“).");
  process.exit(2);
}
if (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt (BREVO_API_KEY / MAKE_WEBHOOK_URL). Bitte mit leerer Umgebung starten (env -i …)."); process.exit(2); }

const HIER = path.dirname(fileURLToPath(import.meta.url));
const { sqlPool } = await import("../server/lib/db-pool");
const [schonDa] = (await sqlPool`SELECT to_regclass('public.fiaon_applications') AS t`) as any[];
if (schonDa?.t) { console.error("ABBRUCH: Die Datenbank ist nicht leer. Bitte eine frische Wegwerf-Datenbank anlegen."); process.exit(2); }
await sqlPool.unsafe(fs.readFileSync(path.join(HIER, "pruef-global-bereich-lokal.sql"), "utf8"));

const A = await import("../server/lib/fiaon-global-auftrag");
const L = await import("../server/lib/fiaon-global-bereich");

let fehler = 0; let n = 0;
const ok = (b: boolean, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}`, zusatz !== undefined ? JSON.stringify(zusatz).slice(0, 600) : ""); } };
const titel = (t: string) => console.log(`\n── ${t}`);

// ═══ TEIL 1: DIE FUNKTIONEN DES BEREICHS ════════════════════════════════════
{
  const REF = "FIAON-E2E-0001"; const REF2 = "FIAON-E2E-0002";
  const daniel = { id: 8, name: "Daniel Stripling" };
  
  titel("Saat");
  await sqlPool`INSERT INTO fiaon_agents (id, name, email, first_name, last_name, active, rolle, is_test_account, avatar, anrede) VALUES
    (8, 'Daniel Stripling', 'daniel@gmail.example', 'Daniel', 'Stripling', TRUE, 'vertriebsleiter', FALSE, 'data:image/jpeg;base64,AAAA', 'Herr'),
    (12, 'Anna Agent', 'anna@web.example', 'Anna', 'Agent', TRUE, 'agent', FALSE, NULL, 'Frau') ON CONFLICT DO NOTHING`;
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('global_zustaendig_agent_id', '8')`;
  await A.ensureGlobalTabelle();
  for (const [ref, paket, sprache, email] of [[REF, "global_banking", "de", "m.muster@muster-gmbh.example"], [REF2, "global_struktur", "en", "j.doe@doe-ltd.example"]] as const) {
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_name, contact_email, email)
      VALUES (${ref}, 'business', 'submitted', ${paket}, ${paket}, ${"PAY-" + ref.slice(-4)}, 'pending', 5999.00, 'Muster GmbH', 'Max Muster', ${email}, ${email})`;
    await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, zustaendig_agent_id, firma_name, email)
      VALUES (${ref}, ${paket}, 'DE', ${JSON.stringify({ name: "Muster GmbH", ort: "München", land: "DE", strasse: "Weg 1", plz: "80331" })}::jsonb,
              ${JSON.stringify({ anrede: "Herr", vorname: "Max", nachname: "Muster", funktion: "Geschäftsführer", email, telefon: "+4989123456" })}::jsonb,
              '{}'::jsonb, 'v1', ${sprache}, NOW() - INTERVAL '41 days', 'offen', 8, 'Muster GmbH', ${email})`;
  }
  
  titel("Kundensicht: offen");
  let s: any = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s?.status === "offen" && s.etappe === 0 && s.zahlung.status === "offen" && s.zahlung.zahlungsseite === "/zahlung/PAY-0001", "offener Auftrag", s && { status: s.status, etappe: s.etappe, zahlung: s.zahlung });
  ok(s.etappen.length === 6 && s.etappen[0].stand === "jetzt" && s.etappen[1].stand === "offen", "Etappen offen", s.etappen.map((e: any) => e.stand));
  ok(s.unterlagen.length === 5 && s.unterlagen.every((u: any) => !u.vorhanden), "fünf Unterlagen fehlen");
  ok(s.verlauf.length === 1 && /Auftrag erteilt/.test(s.verlauf[0].text), "Verlauf: Auftrag erteilt (abgeleitet)", s.verlauf);
  ok(s.ansprechpartner?.name === "Daniel Stripling" && s.ansprechpartner.email === "welcome@fiaon.com" && s.ansprechpartner.bild?.startsWith("data:image/"), "Ansprechpartner ohne private Adresse", s.ansprechpartner);
  ok(s.vertragUrl.includes("/global/auftrag/") && s.vertragUrl.endsWith("?t=TOK"), "vertragUrl");
  ok(Array.isArray(s.dokumentArten) && s.dokumentArten.length === 8, "dokumentArten Kunde");
  ok(!("_verlaufAlles" in s) && !("intern" in s) && !("kontakt" in s), "nichts Internes in der Kundensicht");
  const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"), Buffer.alloc(200, 0x20)]);
  let e: any = await L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: PDF, originalname: "pass.pdf" } });
  ok(!e.ok && e.status === 409, "Upload vor Zahlung → 409", e);
  e = await L.globalEtappeSetzen(REF, { etappe: 2 }, daniel);
  ok(!e.ok && e.status === 409, "Etappe vor Zahlung → 409", e);
  
  titel("Zahlung + Start");
  for (const ref of [REF, REF2]) {
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid', paid_at = NOW() - INTERVAL '40 days' WHERE ref = ${ref}`;
    await sqlPool`UPDATE fiaon_global_auftraege SET status = 'gestartet', bezahlt_am = NOW() - INTERVAL '40 days', gestartet_am = NOW() - INTERVAL '40 days' WHERE ref = ${ref}`;
  }
  ok((await L.globalStartVermerken(REF)) === true, "Start vermerkt");
  ok((await L.globalStartVermerken(REF)) === false, "Start zweimal vermerkt — nur einmal wirksam");
  await L.globalStartVermerken(REF2);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.status === "gestartet" && s.etappe === 1 && s.etappen[1].stand === "jetzt" && !!s.etappen[1].seit && s.zahlung.status === "bezahlt" && !s.zahlung.zahlungsseite, "gestartet, Etappe 1", { status: s.status, etappe: s.etappe, z: s.zahlung });
  ok(s.verlauf.filter((v: any) => /gestartet/.test(v.text)).length === 1 && s.verlauf.some((v: any) => /Zahlung eingegangen/.test(v.text)), "Verlauf: Zahlung + Start je einmal", s.verlauf);
  const s2: any = await L.globalBereichKundenSicht(REF2, "TOK");
  ok(s2.sprache === "en" && s2.etappen[1].titel === "Formation and documents" && /Your order has started/.test(JSON.stringify(s2.verlauf)) && s2.paketName === "FIAON Global Structure", "englischer Auftrag", { t: s2.etappen[1].titel, v: s2.verlauf, p: s2.paketName });
  
  titel("Dokumentenraum Kunde");
  e = await L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: PDF, originalname: "../../Reisepass MÃ¼ller.pdf.exe" } });
  ok(e.ok && e.dokument.name === "Reisepass Müller.pdf" && e.dokument.von === "kunde", "PDF angenommen, Name gesäubert", e);
  const docId = e.dokument?.id;
  const e2: any = await L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: PDF, originalname: "nochmal.pdf" } });
  ok(e2.ok && e2.dokument.id === docId, "dieselbe Datei noch einmal = dasselbe Dokument", e2);
  e = await L.globalKundenDokument(REF, { art: "adressnachweis", datei: { buffer: Buffer.from("<html><script>alert(1)</script></html>" + " ".repeat(50)), originalname: "rechnung.pdf" } });
  ok(!e.ok && e.status === 400, "HTML als .pdf abgelehnt", e);
  e = await L.globalKundenDokument(REF, { art: "ein_brief", datei: { buffer: PDF, originalname: "ein.pdf" } });
  ok(!e.ok && e.status === 400, "Kunde darf keine FIAON-Art hochladen", e);
  e = await L.globalKundenDokument(REF, { art: "adressnachweis", datei: null });
  ok(!e.ok && e.status === 400, "ohne Datei", e);
  const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 16]), Buffer.from("Exif"), Buffer.alloc(100, 1)]);
  e = await L.globalKundenDokument(REF, { art: "adressnachweis", datei: { buffer: JPG, originalname: "IMG_0001.HEIC" } });
  ok(e.ok && e.dokument.name === "IMG_0001.jpg", "JPG trotz .HEIC-Name: Endung folgt dem Inhalt", e);
  let d: any = await L.globalDokumentLesen(REF, docId, "kunde");
  ok(!!d && d.mime === "application/pdf" && Buffer.compare(d.inhalt, PDF) === 0, "Kunde liest sein Dokument unverändert");
  ok((await L.globalDokumentLesen(REF2, docId, "kunde")) === null, "Dokument über FREMDE ref nicht lesbar");
  e = await L.globalKundenNachricht(REF, { text: "Alpha LLC\nBeta LLC\nGamma LLC", art: "namenswunsch" });
  ok(e.ok && e.dokument?.name.startsWith("Namenswunsch_") && e.dokument.name.endsWith(".txt"), "Namenswunsch als Text", e);
  d = await L.globalDokumentLesen(REF, e.dokument.id, "kunde");
  ok(d?.mime === "text/plain" && d.inhalt.toString("utf8").includes("Beta LLC"), "Textunterlage lesbar");
  e = await L.globalKundenNachricht(REF, { text: "x", art: "reisepass" });
  ok(!e.ok && e.status === 400, "Reisepass nicht als Text", e);
  e = await L.globalKundenNachricht(REF, { text: "Guten Tag, wann ist das Startgespräch?" });
  ok(e.ok && /Daniel|Stripling|angekommen/.test(e.meldung), "Nachricht zugestellt", e);
  e = await L.globalKundenNachricht(REF, { text: "   " });
  ok(!e.ok && e.status === 400, "leere Nachricht", e);
  e = await L.globalKundenNachricht(REF, { text: "a".repeat(2001) });
  ok(!e.ok && e.status === 400, "zu lange Nachricht", e);
  let todos = (await sqlPool`SELECT schluessel, titel, status, zustaendig_agent_id, link FROM fiaon_betreiber_todos ORDER BY id`) as any[];
  ok(todos.some((t: any) => /:eingang:/.test(t.schluessel) && Number(t.zustaendig_agent_id) === 8 && t.link === `/agent/global/${REF}`), "Aufgabe „neue Unterlagen“ bei Daniel mit Link ins Office", todos);
  ok(todos.some((t: any) => /:nachricht:/.test(t.schluessel)), "Aufgabe „Nachricht“", todos);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.unterlagen.filter((u: any) => u.vorhanden).map((u: any) => u.art).sort().join() === "adressnachweis,namenswunsch,reisepass", "Unterlagen-Stand", s.unterlagen);
  ok(s.dokumente.length === 3 && s.dokumente.every((x: any) => x.url.includes(`/mein-auftrag/${REF}/dokument/`)), "drei Dokumente in der Kundensicht", s.dokumente);
  ok(s.verlauf.some((v: any) => /Ihre Nachricht: Guten Tag/.test(v.text)) && s.verlauf.some((v: any) => /Sie haben ein Dokument hochgeladen/.test(v.text)), "Verlauf: Nachricht + Upload sichtbar");
  
  titel("Office: Etappe, Schritt, Gesellschaft, Fristen");
  e = await L.globalEtappeSetzen(REF, { etappe: 2, text: "Ich rufe Sie am Dienstag an.", mitteilen: true }, daniel);
  ok(e.ok && /NICHT raus/.test(e.meldung), "Etappe 2 gesetzt, Mail scheitert ehrlich (kein Schlüssel)", e);
  e = await L.globalEtappeSetzen(REF, { etappe: 2, text: "Wir garantieren Ihnen die Karte." }, daniel);
  ok(!e.ok && e.status === 400 && /garant/i.test(e.error), "Wand sperrt „garantieren“", e);
  e = await L.globalEtappeSetzen(REF, { etappe: 7 }, daniel);
  ok(!e.ok && e.status === 400, "Etappe 7 gibt es nicht", e);
  e = await L.globalNaechsterSchrittSetzen(REF, { text: "Bitte laden Sie die Gesellschafterliste hoch.", bis: "2026-10-01" }, daniel);
  ok(e.ok, "nächster Schritt", e);
  e = await L.globalNaechsterSchrittSetzen(REF, { text: "x", bis: "2026-02-30" }, daniel);
  ok(!e.ok && e.status === 400, "kaputtes Datum", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.etappe === 2 && s.naechsterSchritt?.text.startsWith("Bitte laden") && s.naechsterSchritt.bis === "2026-10-01", "Kunde sieht Etappe 2 + Schritt", { e: s.etappe, n: s.naechsterSchritt });
  e = await L.globalNaechsterSchrittSetzen(REF, { text: "" }, daniel);
  ok(e.ok, "Schritt leeren", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(!s.naechsterSchritt, "Schritt ist leer");
  
  e = await L.globalGesellschaftSetzen(REF, { name: "Muster Holdings LLC", form: "LLC", bundesstaat: "DE", gegruendetAm: "2026-08-20", einVorhanden: true, itinStand: "beantragt" }, daniel);
  ok(e.ok && e.fristen.neu === 3, "Delaware LLC: drei Regel-Fristen", e);
  e = await L.globalGesellschaftSetzen(REF, { name: "Muster Holdings LLC", form: "LLC", bundesstaat: "DE", gegruendetAm: "2026-08-20", einVorhanden: true, itinStand: "beantragt" }, daniel);
  ok(e.ok && e.fristen.neu === 0 && e.fristen.geaendert === 0 && e.fristen.entfernt === 0, "noch einmal gespeichert: nichts Neues", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.gesellschaft?.bundesstaat === "Delaware" && s.gesellschaft.bundesstaatCode === "DE" && s.gesellschaft.einVorhanden === true && s.gesellschaft.itinStand === "beantragt", "Kunde: Bundesstaat als Name", s.gesellschaft);
  ok(s.fristen.map((f: any) => f.faelligAm).join() === "2027-04-15,2027-06-01,2027-08-20" && s.fristen.every((f: any) => /US-CPA/.test(f.hinweis) && !("quelle" in f)), "Fristen beim Kunden", s.fristen);
  ok(/§ 138 AO/.test(s.naechsterSchritt?.text ?? ""), "Heimat-Meldung als nächster Schritt", s.naechsterSchritt);
  let o: any = await L.globalBereichOfficeSicht(REF);
  ok(o.gesellschaft?.bundesstaat === "DE" && o.gesellschaft.bundesstaatName === "Delaware", "Office: Bundesstaat als Kürzel", o.gesellschaft);
  ok(o.fristen.every((f: any) => f.quelle === "regel") && o.dokumentArten.length === 12 && o.kundenLink.includes(`/business/auftrag/${REF}?t=`), "Office-Sicht: quelle, dokumentArten, kundenLink", { q: o.fristen.map((f: any) => f.quelle), l: o.kundenLink });
  ok(o.kontakt.email === "m.muster@muster-gmbh.example" && o.firmaVoll.strasse === "Weg 1" && o.zustaendig?.id === 8 && o.intern.verlaufAlles.length > o.verlauf.length - 1, "Office-Sicht: Kontakt, Firma, intern");
  e = await L.globalGesellschaftSetzen(REF, { bundesstaat: "WY" }, daniel);
  ok(e.ok && e.fristen.neu === 1 && e.fristen.entfernt === 1, "Wechsel nach Wyoming: Delaware-Frist raus, Wyoming rein", e);
  e = await L.globalGesellschaftSetzen(REF, { bundesstaat: "Texass" }, daniel);
  ok(!e.ok && e.status === 400, "unbekannter Bundesstaat", e);
  e = await L.globalGesellschaftSetzen(REF, { bundesstaat: "NM" }, daniel);
  ok(e.ok && /New Mexico/.test(e.meldung) && e.fristen.entfernt === 1, "New Mexico: keine Staatsfrist, Hinweis ans Office", e);
  e = await L.globalGesellschaftSetzen(REF, { gegruendetAm: "2099-01-01" }, daniel);
  ok(!e.ok && e.status === 400, "Gründung in der Zukunft", e);
  
  const heuteIso = new Date().toISOString().slice(0, 10);
  const plus = (t: number) => new Date(Date.now() + t * 86_400_000).toISOString().slice(0, 10);
  e = await L.globalFristAnlegen(REF, { titel: "Jahresbericht Texas (Probe)", faelligAm: plus(5), hinweis: "Bitte mit dem CPA klären." }, daniel);
  ok(e.ok && e.id > 0, "Handfrist in 5 Tagen", e);
  const fristNah = e.id;
  e = await L.globalFristAnlegen(REF, { titel: "Lizenz verlängern", faelligAm: plus(25) }, daniel);
  const fristMonat = e.id;
  e = await L.globalFristAnlegen(REF, { titel: "ab", faelligAm: plus(25) }, daniel);
  ok(!e.ok && e.status === 400, "Titel zu kurz", e);
  e = await L.globalFristAendern(REF, fristMonat, { titel: "Lizenz verlängern (Stadt)", faelligAm: plus(26), hinweis: "" }, daniel);
  ok(e.ok, "Handfrist ändern", e);
  o = await L.globalBereichOfficeSicht(REF);
  const regelFrist = o.fristen.find((f: any) => f.quelle === "regel");
  e = await L.globalFristAendern(REF, regelFrist.id, { titel: "anders" }, daniel);
  ok(!e.ok && e.status === 409, "Regel-Frist lässt sich nicht umschreiben", e);
  e = await L.globalFristLoeschen(REF, regelFrist.id, daniel);
  ok(!e.ok && e.status === 409, "Regel-Frist lässt sich nicht löschen", e);
  e = await L.globalFristAendern(REF, regelFrist.id, { erledigt: true }, daniel);
  ok(e.ok, "Regel-Frist erledigen geht", e);
  e = await L.globalFristAendern(REF2, fristNah, { erledigt: true }, daniel);
  ok(!e.ok && e.status === 404, "Frist über fremde ref", e);
  
  titel("Office: Dokumente, Notiz, Stichtag, Zugang");
  e = await L.globalOfficeDokument(REF, { art: "ein_brief", datei: { buffer: PDF.subarray(0, 150), originalname: "EIN Muster LLC.pdf" }, sichtbarFuerKunde: true, mitteilen: true }, daniel);
  ok(e.ok && /NICHT raus/.test(e.meldung), "FIAON-Dokument sichtbar, Mail scheitert ehrlich", e);
  const einId = e.dokument.id;
  e = await L.globalOfficeDokument(REF, { art: "sonstiges", datei: { buffer: JPG, originalname: "intern.jpg" }, sichtbarFuerKunde: false, mitteilen: false }, daniel);
  ok(e.ok && /intern/.test(e.meldung), "internes Dokument", e);
  const internId = e.dokument.id;
  ok(!!(await L.globalDokumentLesen(REF, einId, "kunde")) && (await L.globalDokumentLesen(REF, internId, "kunde")) === null && !!(await L.globalDokumentLesen(REF, internId, "office")), "Kunde sieht Freigegebenes, Internes nicht");
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.dokumente.some((x: any) => x.id === einId) && !s.dokumente.some((x: any) => x.id === internId) && !JSON.stringify(s.verlauf).includes("intern"), "Kundensicht ohne internes Dokument");
  e = await L.globalDokumentEntfernen(REF, einId, daniel);
  ok(e.ok && (await L.globalDokumentLesen(REF, einId, "kunde")) === null && (await L.globalDokumentLesen(REF, einId, "office")) === null, "entferntes Dokument ist für niemanden abrufbar", e);
  e = await L.globalNotizSchreiben(REF, { text: "Kunde will Delaware, CPA ist Frau X.", sichtbar: false }, daniel);
  ok(e.ok, "interne Notiz", e);
  e = await L.globalNotizSchreiben(REF, { text: "Durchgang 2026-10 erledigt: Unterlagen besprochen.", sichtbar: true }, daniel);
  ok(e.ok, "sichtbare Notiz", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(JSON.stringify(s.verlauf).includes("Durchgang 2026-10") && !JSON.stringify(s.verlauf).includes("CPA ist Frau X"), "Kunde sieht nur die sichtbare Notiz");
  const st: any = await L.globalBereichStichtag(REF, plus(30), "Daniel Stripling", true, 8);
  ok(st.ok, "Stichtag gesetzt", st);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.stichtag === plus(30) && /Stichtag für Gesellschaft und EIN/.test(JSON.stringify(s.verlauf)), "Stichtag in Sicht und Verlauf", { st: s.stichtag });
  e = await L.globalZugangSenden(REF, daniel);
  ok(!e.ok && e.status === 502, "Zugang senden ohne Mailweg → 502 mit Grund", e);
  
  titel("Liste, Raum, Leitung");
  let liste: any[] = await L.globalBereichListe({ agentId: 8, alle: true });
  ok(liste.length === 2 && liste.find((z) => z.ref === REF)?.etappe === 2 && liste.find((z) => z.ref === REF)?.offeneUnterlagen === 2 && !!liste.find((z) => z.ref === REF)?.naechsteFrist && liste[0].zustaendig?.name === "Daniel Stripling", "Liste für die Leitung", liste);
  liste = await L.globalBereichListe({ agentId: 12, alle: false });
  ok(liste.length === 0, "Liste für fremde Mitarbeiterin leer");
  ok(JSON.stringify(await L.globalBereichRaumLage(8)) === JSON.stringify({ fuehrtAuftraege: true, istEingestellt: true }) && JSON.stringify(await L.globalBereichRaumLage(12)) === JSON.stringify({ fuehrtAuftraege: false, istEingestellt: false }), "Raum-Lage");
  ok((await L.globalBereichZustaendig(REF)) === 8 && (await L.globalBereichZustaendig("GIBTSNICHT")) === undefined, "Zuständigkeit lesen");
  try {
    const leitung: any = await A.globalAuftraegeListe();
    const z = leitung.zeilen.find((x: any) => x.ref === REF);
    ok(!!z && z.etappe === 2 && String(z.kundenLink).includes(`/business/auftrag/${REF}?t=`) && z.officeLink === `/agent/global/${REF}`, "Leitungs-Liste mit etappe + kundenLink", z && { etappe: z.etappe, kundenLink: z.kundenLink, officeLink: z.officeLink });
    const zEn = leitung.zeilen.find((x: any) => x.ref === REF2);
    ok(String(zEn?.kundenLink).includes("/en/business/auftrag/"), "englischer Kundenlink", zEn?.kundenLink);
  } catch (err) { ok(false, `Leitungs-Liste wirft: ${String(err).slice(0, 300)}`); }
  
  titel("Tageslauf");
  const nacht = new Date(`${heuteIso}T01:30:00Z`);
  let t: any = await L.globalTageslauf(nacht);
  ok(t.ruhe === true && t.fristMails === 0 && t.fristAufgaben === 0, "nachts arbeitet der Lauf nicht", t);
  const tag = new Date(`${heuteIso}T10:00:00Z`);
  t = await L.globalTageslauf(tag);
  ok(t.ruhe === false && t.fristAufgaben === 2 && t.fehler === 2 && t.durchgaenge === 1 && t.unterlagen === 2, "Tag: zwei Frist-Aufgaben (Mail scheitert → Fehler gezählt), ein Durchgang (nur Banking), Unterlagen für beide", t);
  const t2: any = await L.globalTageslauf(tag);
  ok(t2.fristAufgaben === 0 && t2.fristMails === 0 && t2.fehler === 0 && t2.durchgaenge === 0 && t2.unterlagen === 0, "zweiter Lauf am selben Tag: nichts mehr zu tun", t2);
  todos = (await sqlPool`SELECT schluessel, titel, prioritaet, faellig_am, zustaendig_agent_id FROM fiaon_betreiber_todos ORDER BY id`) as any[];
  ok(todos.some((x: any) => x.schluessel === `global:${REF}:frist:${fristNah}:7`) && todos.some((x: any) => x.schluessel === `global:${REF}:frist:${fristMonat}:30`), "Schlüssel der Frist-Aufgaben", todos.map((x: any) => x.schluessel));
  ok(todos.some((x: any) => /^global:FIAON-E2E-0001:durchgang:\d{4}-\d{2}$/.test(x.schluessel)) && !todos.some((x: any) => x.schluessel.startsWith(`global:${REF2}:durchgang`)), "Durchgang nur für Banking, nicht für Struktur");
  ok(todos.filter((x: any) => x.schluessel.endsWith(":unterlagen")).length === 2, "Unterlagen-Aufgaben");
  const marken = (await sqlPool`SELECT id, erinnert_30_am, erinnert_7_am FROM fiaon_global_fristen WHERE id IN (${fristNah}, ${fristMonat}) ORDER BY id`) as any[];
  ok(!!marken[0].erinnert_7_am && !!marken[0].erinnert_30_am && !!marken[1].erinnert_30_am && !marken[1].erinnert_7_am, "Marken gesetzt (7 setzt 30 mit)", marken);
  o = await L.globalBereichOfficeSicht(REF);
  ok(o.intern.verlaufAlles.some((v: any) => /ging NICHT raus/.test(v.text) && v.sichtbar === false), "gescheiterte Erinnerung steht intern im Verlauf");
  
  titel("Abschluss und Wiederöffnen");
  e = await L.globalAbschliessen(REF, { text: "Vielen Dank für die Zusammenarbeit.", mitteilen: false }, daniel);
  ok(e.ok, "abschließen", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.status === "abgeschlossen" && s.etappe === 5 && s.etappen.every((x: any) => x.stand === "fertig") && !s.naechsterSchritt, "abgeschlossen: alles fertig", { st: s.status, e: s.etappe });
  e = await L.globalKundenDokument(REF, { art: "sonstiges", datei: { buffer: PDF, originalname: "spaet.pdf" } });
  ok(!e.ok && e.status === 409, "Kunde lädt nach Abschluss nichts mehr hoch", e);
  const lt: any = await A.globalAuftraegeListe();
  ok(lt.zeilen.find((x: any) => x.ref === REF)?.status === "gestartet" && !!lt.zeilen.find((x: any) => x.ref === REF)?.abgeschlossenAm, "Leitungs-Liste: abgeschlossen zählt als gestartet, mit Abschlussdatum", lt.zeilen.find((x: any) => x.ref === REF)?.status);
  ok(((await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${REF}:start`}`) as any[]).length === 0, "(keine Start-Aufgabe in dieser Saat — nichts zu erledigen)");
  e = await L.globalEtappeSetzen(REF, { etappe: 3 }, daniel);
  ok(e.ok, "Etappe 3 öffnet wieder", e);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(s.status === "gestartet" && s.etappe === 3 && /weiter begleitet/.test(JSON.stringify(s.verlauf)), "wieder gestartet", { st: s.status, e: s.etappe });
  e = await L.globalEtappeSetzen(REF, { etappe: 5 }, daniel);
  s = await L.globalBereichKundenSicht(REF, "TOK");
  ok(e.ok && s.status === "abgeschlossen", "Etappe 5 über die Etappen-Route = abschließen", e);
  
  titel("Zugang anfordern (antwortet nie, arbeitet dahinter)");
  L.globalZugangAnfordern("M.Muster@muster-gmbh.example ", "203.0.113.5");
  L.globalZugangAnfordern("niemand@nirgendwo.example", "203.0.113.5");
  await new Promise((r) => setTimeout(r, 1500));
  o = await L.globalBereichOfficeSicht(REF);
  ok(o.intern.verlaufAlles.some((v: any) => v.art === "zugang" && /angefordert/.test(v.text)), "Anforderung steht intern im Verlauf", o.intern.verlaufAlles.filter((v: any) => v.art === "zugang"));
  const mailsRoh = (await sqlPool`SELECT event, status, empfaenger, payload FROM fiaon_mail_log WHERE event LIKE 'global_%' ORDER BY id`) as any[];
  const mails = mailsRoh.map((m: any) => { let p: any = m.payload; if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = {}; } } return { ...m, link: p?.mein_auftrag_url, sprache: p?.sprache }; });
  ok(mails.length >= 6 && mails.every((m: any) => m.status === "fehlgeschlagen" && m.link === "[Link zu Mein Auftrag]"), "Mailprotokoll: jede Mail protokolliert, Link geschwärzt", mails.map((m: any) => [m.event, m.status, m.link]));
  ok(mails.every((m: any) => m.empfaenger === "m.muster@muster-gmbh.example" || m.empfaenger === "j.doe@doe-ltd.example"), "Kundenmails nur an die Adresse des Auftrags", mails.map((m: any) => m.empfaenger));
  ok(mails.every((m: any) => m.sprache === "de"), "Sprache reist in der Nutzlast", mails.map((m: any) => m.sprache));
  console.log("  Mail-Ereignisse:", mails.map((m: any) => `${m.event}/${m.sprache}`).join(", "));
}

// ═══ TEIL 2: DIE ROUTEN ÜBER HTTP ═══════════════════════════════════════════
// Nur der eine Router auf einer eigenen kleinen Express-App — nicht der FIAON-Server.
{
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const { signAgentToken, AGENT_COOKIE_NAME } = await import("../server/routes/fiaon-agent");
  const router = (await import("../server/routes/fiaon-global-bereich")).default;
  const REF = "FIAON-HTTP-0001"; const FREMD = "FIAON-HTTP-0002";
  await sqlPool`UPDATE fiaon_agents SET session_epoch = 1 WHERE id IN (8, 12)`;
  await sqlPool`INSERT INTO fiaon_agents (id, name, email, first_name, last_name, active, rolle, is_test_account, session_epoch, anrede) VALUES
    (13, 'Ben Betreuer', 'ben@web.example', 'Ben', 'Betreuer', TRUE, 'agent', FALSE, 1, 'Herr')`;
  for (const [ref, zust] of [[REF, 13], [FREMD, 8]] as const) {
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_email, email, paid_at)
      VALUES (${ref}, 'business', 'submitted', 'global_kapital', 'FIAON Global Kapital', ${"PAY-" + ref.slice(-4)}, 'paid', 14999.00, 'Muster GmbH', 'm@muster.example', 'm@muster.example', NOW())`;
    await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, bezahlt_am, gestartet_am, zustaendig_agent_id, firma_name, email)
      VALUES (${ref}, 'global_kapital', 'AT', ${sqlPool.json({ name: "Muster GmbH", ort: "Wien", land: "AT" })}, ${sqlPool.json({ anrede: "Frau", vorname: "Mia", nachname: "Muster", email: "m@muster.example" })},
              '{}'::jsonb, 'v1', 'de', NOW(), 'gestartet', NOW(), NOW(), ${zust}, 'Muster GmbH', 'm@muster.example')`;
    await L.globalStartVermerken(ref);
  }
  
  const app = express();
  app.set("trust proxy", true);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/fiaon", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as any).port;
  const B = `http://127.0.0.1:${port}/api/fiaon`;
  const tok = A.globalTokenErzeugen(REF);
  const cookie = (id: number) => ({ cookie: `${AGENT_COOKIE_NAME}=${signAgentToken(id, 1)}` });
  const j = async (r: Response) => ({ status: r.status, kopf: r.headers, body: await r.json().catch(() => null) as any });
  const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n", "latin1"), Buffer.alloc(300, 0x20)]);
  const form = (teile: Record<string, string | { name: string; inhalt: Buffer; typ?: string }[]>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(teile)) {
      if (typeof v === "string") fd.append(k, v);
      else for (const d of v) fd.append(k, new Blob([d.inhalt], { type: d.typ ?? "application/pdf" }), d.name);
    }
    return fd;
  };
  
  titel("Kunde: Zutritt");
  let r = await j(await fetch(`${B}/global/mein-auftrag/${REF}`));
  ok(r.status === 403 && r.body?.code === "ungueltig" && r.kopf.get("cache-control")?.includes("no-store"), "ohne Token 403", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${FREMD}?t=${tok}`));
  ok(r.status === 403, "Token einer anderen Nummer 403", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}?t=${A.globalTokenErzeugen(REF, -5000)}`));
  ok(r.status === 410 && r.body?.code === "abgelaufen", "abgelaufenes Token 410", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}?t=${tok}`));
  ok(r.status === 200 && r.body?.ok && r.body.auftrag.ref === REF && r.body.auftrag.etappe === 1 && r.body.auftrag.status === "gestartet", "gültiges Token 200", r.body?.auftrag && { e: r.body.auftrag.etappe, s: r.body.auftrag.status });
  const sollFelder = ["ref", "status", "sprache", "paket", "paketName", "firma", "zahlung", "etappe", "etappen", "unterlagen", "dokumente", "fristen", "verlauf", "vertragUrl", "rechnungUrl"];
  ok(sollFelder.every((f) => f in (r.body?.auftrag ?? {})), "alle Pflichtfelder der Schnittstelle", sollFelder.filter((f) => !(f in (r.body?.auftrag ?? {}))));
  
  titel("Kunde: Upload über multipart");
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/dokument`, { method: "POST", body: form({ art: "reisepass", datei: [{ name: "pass.pdf", inhalt: PDF }] }) }));
  ok(r.status === 403, "Upload ohne Token: 403 vor dem Körper", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/dokument?t=${tok}`, { method: "POST", body: form({ art: "reisepass", datei: [{ name: "Reisepass Müller.pdf", inhalt: PDF }] }) }));
  ok(r.status === 200 && r.body?.dokument?.name === "Reisepass Müller.pdf" && r.body.dokument.art === "reisepass", "PDF hochgeladen, Umlaut im Namen bleibt", r.body);
  const docId = r.body?.dokument?.id;
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/dokument?t=${tok}`, { method: "POST", body: form({ art: "reisepass", datei: [{ name: "a.pdf", inhalt: PDF }, { name: "b.pdf", inhalt: PDF }] }) }));
  ok(r.status === 400 && /einzeln/.test(r.body?.error ?? ""), "zwei Dateien: deutscher Satz statt Multer-Englisch", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/dokument?t=${tok}`, { method: "POST", body: form({ art: "adressnachweis", datei: [{ name: "gross.pdf", inhalt: Buffer.concat([PDF, Buffer.alloc(15 * 1024 * 1024)]) }] }) }));
  ok(r.status === 400 && /15 MB/.test(r.body?.error ?? ""), "über 15 MB", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/dokument?t=${tok}`, { method: "POST", body: form({ art: "adressnachweis", datei: [{ name: "x.pdf", inhalt: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>" + " ".repeat(40)), typ: "application/pdf" }] }) }));
  ok(r.status === 400 && /PDF, JPG, PNG und HEIC/.test(r.body?.error ?? ""), "SVG mit PDF-Etikett abgelehnt", r.body);
  const d = await fetch(`${B}/global/mein-auftrag/${REF}/dokument/${docId}?t=${tok}`);
  const bytes = Buffer.from(await d.arrayBuffer());
  ok(d.status === 200 && d.headers.get("content-type") === "application/pdf" && d.headers.get("x-content-type-options") === "nosniff" && d.headers.get("referrer-policy") === "no-referrer" && /^inline;/.test(d.headers.get("content-disposition") ?? "") && /no-store/.test(d.headers.get("cache-control") ?? "") && Buffer.compare(bytes, PDF) === 0, "Download: inline, erkannter Typ, nosniff, no-referrer, no-store, Inhalt unverändert", Object.fromEntries(d.headers.entries()));
  ok(/filename="Reisepass_M_ller\.pdf"|filename="Reisepass_Mu_ller\.pdf"|filename="Reisepass_Müller\.pdf"/.test(d.headers.get("content-disposition") ?? "") || /filename=/.test(d.headers.get("content-disposition") ?? ""), "Dateiname im Kopf", d.headers.get("content-disposition"));
  r = await j(await fetch(`${B}/global/mein-auftrag/${FREMD}/dokument/${docId}?t=${A.globalTokenErzeugen(FREMD)}`));
  ok(r.status === 404, "fremdes Dokument mit eigenem Token: 404", r.body);
  
  titel("Kunde: Nachricht, Zugang, Drossel");
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}/nachricht?t=${tok}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Guten Tag, eine Frage zum Ablauf." }) }));
  ok(r.status === 200 && r.body?.ok, "Nachricht", r.body);
  let letzte = 0;
  for (let i = 0; i < 6; i++) letzte = (await fetch(`${B}/global/mein-auftrag/${REF}/nachricht?t=${tok}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `Nachricht ${i}` }) })).status;
  ok(letzte === 429, "Drossel Nachricht → 429", letzte);
  for (const body of [{ email: "m@muster.example" }, { email: "gibt@es.nicht" }, { email: "kaputt" }, { email: "m@muster.example", falle: "bot" }, {}]) {
    r = await j(await fetch(`${B}/global/zugang`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    ok(r.status === 200 && JSON.stringify(r.body) === '{"ok":true}', `Zugang antwortet immer gleich (${JSON.stringify(body)})`, r.body);
  }
  
  titel("Office: Zugriff");
  r = await j(await fetch(`${B}/agent/global/auftraege`));
  ok(r.status === 401, "ohne Anmeldung 401", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege`, { headers: cookie(12) }));
  ok(r.status === 403, "gewöhnliche Mitarbeiterin: Raum 403 (Leiste blendet aus)", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege`, { headers: cookie(13) }));
  ok(r.status === 200 && r.body.zeilen.length === 1 && r.body.zeilen[0].ref === REF && r.body.alle === false, "zuständiger Mitarbeiter: nur sein Auftrag", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege`, { headers: cookie(8) }));
  ok(r.status === 200 && r.body.zeilen.filter((z: any) => String(z.ref).startsWith("FIAON-HTTP-")).length === 2 && r.body.zeilen.length === 4 && r.body.alle === true, "Vertriebsleitung: alle", r.body?.zeilen?.length);
  const zeile = r.body?.zeilen?.find((z: any) => z.ref === REF) ?? {};
  ok(["ref", "firma", "ort", "land", "paket", "paketName", "status", "etappe", "offeneUnterlagen", "zustaendig", "alterTage", "betragCents"].every((f) => f in zeile) && zeile.betragCents === 1499900 && zeile.offeneUnterlagen === 4, "Listenzeile nach Schnittstelle", zeile);
  r = await j(await fetch(`${B}/agent/global/auftraege/${FREMD}`, { headers: cookie(13) }));
  ok(r.status === 403, "fremder Auftrag 403", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege/GIBT-ES-NICHT`, { headers: cookie(13) }));
  ok(r.status === 403, "unbekannte Nummer für Nicht-Leitung ebenfalls 403 (nicht erfragbar)", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege/GIBT-ES-NICHT`, { headers: cookie(8) }));
  ok(r.status === 404, "unbekannte Nummer für die Leitung 404", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege/${REF}`, { headers: cookie(13) }));
  ok(r.status === 200 && r.body.auftrag.kontakt.nachname === "Muster" && Array.isArray(r.body.auftrag.intern.verlaufAlles) && r.body.auftrag.kundenLink.includes("?t="), "Akte für die zuständige Person", r.body?.auftrag && Object.keys(r.body.auftrag));
  for (const [pfad, body] of [["etappe", { etappe: 2 }], ["notiz", { text: "Probe" }], ["naechster-schritt", { text: "x" }], ["frist", { titel: "Probe", faelligAm: "2027-01-01" }], ["gesellschaft", { name: "X" }], ["zugang-senden", {}], ["abschliessen", {}], ["stichtag", { stichtag: "2027-01-01" }]] as const) {
    r = await j(await fetch(`${B}/agent/global/auftraege/${REF}/${pfad}`, { method: "POST", headers: { ...cookie(12), "content-type": "application/json" }, body: JSON.stringify(body) }));
    ok(r.status === 403, `fremde Mitarbeiterin darf nicht: POST ${pfad}`, r.body);
  }
  
  titel("Office: Aktionen über HTTP");
  const post = async (pfad: string, body: unknown, wer = 13) => j(await fetch(`${B}/agent/global/auftraege/${REF}/${pfad}`, { method: "POST", headers: { ...cookie(wer), "content-type": "application/json" }, body: JSON.stringify(body) }));
  r = await post("etappe", { etappe: 2, mitteilen: false });
  ok(r.status === 200 && /Etappe 2/.test(r.body.meldung), "Etappe", r.body);
  r = await post("naechster-schritt", { text: "Bitte den Adressnachweis hochladen.", bis: "2026-10-15" });
  ok(r.status === 200, "nächster Schritt", r.body);
  r = await post("naechster-schritt", { text: "" });
  ok(r.status === 200 && /geleert/.test(r.body.meldung), "nächster Schritt leeren mit leerem Text", r.body);
  r = await post("gesellschaft", { name: "Muster LLC", form: "LLC", bundesstaat: "FL", gegruendetAm: "2026-09-01", einVorhanden: false, itinStand: "offen" });
  ok(r.status === 200 && r.body.fristen.neu === 3, "Gesellschaft Florida", r.body);
  r = await post("frist", { titel: "Eigene Frist", faelligAm: "2027-02-01", hinweis: "Hinweis" });
  ok(r.status === 200 && r.body.id > 0, "Frist anlegen", r.body);
  const fid = r.body.id;
  r = await post(`frist/${fid}`, { erledigt: true });
  ok(r.status === 200, "Frist erledigen", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege/${REF}/frist/${fid}`, { method: "DELETE", headers: cookie(13) }));
  ok(r.status === 200, "Frist löschen", r.body);
  r = await post("notiz", { text: "Sichtbar für den Kunden.", sichtbar: true });
  ok(r.status === 200, "Notiz", r.body);
  r = await j(await fetch(`${B}/agent/global/auftraege/${REF}/dokument`, { method: "POST", headers: cookie(13), body: form({ art: "gruendungsurkunde", sichtbarFuerKunde: "false", datei: [{ name: "Certificate of Formation.pdf", inhalt: Buffer.concat([PDF, Buffer.from("x")]) }] }) }));
  ok(r.status === 200 && r.body.dokument.sichtbarFuerKunde === false && /intern/.test(r.body.meldung), "Office-Upload, „false“ als Text = intern", r.body);
  const internId = r.body?.dokument?.id;
  r = await j(await fetch(`${B}/agent/global/auftraege/${REF}/dokument`, { method: "POST", headers: cookie(12), body: form({ art: "sonstiges", sichtbarFuerKunde: "true", datei: [{ name: "x.pdf", inhalt: PDF }] }) }));
  ok(r.status === 403, "Office-Upload durch Fremde: 403 vor dem Körper", r.body);
  let dl = await fetch(`${B}/agent/global/auftraege/${REF}/dokument/${internId}`, { headers: cookie(13) });
  ok(dl.status === 200 && dl.headers.get("content-type") === "application/pdf" && dl.headers.get("x-content-type-options") === "nosniff", "Office liest internes Dokument");
  dl = await fetch(`${B}/global/mein-auftrag/${REF}/dokument/${internId}?t=${tok}`);
  ok(dl.status === 404, "Kunde liest internes Dokument nicht", dl.status);
  r = await j(await fetch(`${B}/agent/global/auftraege/${REF}/dokument/${internId}`, { method: "DELETE", headers: cookie(13) }));
  ok(r.status === 200, "Dokument entfernen (weich)", r.body);
  r = await post("stichtag", { stichtag: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10), mitteilen: false });
  ok(r.status === 200, "Stichtag", r.body);
  r = await post("stichtag", { stichtag: "2020-01-01" });
  ok(r.status === 400, "Stichtag in der Vergangenheit 400", r.body);
  r = await post("zugang-senden", {});
  ok(r.status === 502 && /BREVO/.test(r.body.error), "Zugang senden ohne Mailweg: 502 mit Grund", r.body);
  r = await post("abschliessen", { text: "Danke." });
  ok(r.status === 200, "abschließen", r.body);
  r = await j(await fetch(`${B}/global/mein-auftrag/${REF}?t=${tok}`));
  ok(r.body.auftrag.status === "abgeschlossen" && r.body.auftrag.etappe === 5 && r.body.auftrag.gesellschaft.bundesstaat === "Florida" && r.body.auftrag.fristen.length === 3, "Kunde sieht den Abschluss, Florida, drei Fristen", r.body.auftrag && { s: r.body.auftrag.status, g: r.body.auftrag.gesellschaft, f: r.body.auftrag.fristen.length });
  dl = await fetch(`${B}/agent/global/auftraege/${REF}/vertrag.pdf`, { headers: cookie(13) });
  ok(dl.status === 404, "Vertrag: in dieser Saat liegt keiner — 404 statt Absturz", dl.status);
  server.close();
}

// ═══ TEIL 3: ZAHLUNGSEINGANG = START = ETAPPE 1 ═════════════════════════════
// Der kleine Eingriff in den Bestellweg (globalNachZahlung ruft globalStartVermerken): Etappe 1, die
// Zeile im Verlauf des Kunden, die Start-Aufgabe mit dem Link ins Office — und nichts davon doppelt.
{
  titel("Zahlungseingang → Start → Etappe 1");
  const REF = "FIAON-NZ-0001";
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_email, email, paid_at)
    VALUES (${REF}, 'business', 'submitted', 'global_struktur', 'FIAON Global Struktur', 'PAY-NZ', 'paid', 2499.00, 'Start GmbH', 's@start.example', 's@start.example', NOW())`;
  await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, zustaendig_agent_id, firma_name, email)
    VALUES (${REF}, 'global_struktur', 'DE', ${sqlPool.json({ name: "Start GmbH", ort: "Köln", land: "DE" })}, ${sqlPool.json({ anrede: "Herr", vorname: "Sam", nachname: "Start", email: "s@start.example" })},
            '{}'::jsonb, 'v1', 'de', NOW(), 'offen', 8, 'Start GmbH', 's@start.example')`;
  const erg: any = await A.globalNachZahlung(REF);
  await new Promise((r) => setTimeout(r, 500));
  const [g] = (await sqlPool`SELECT status, etappe, etappen_seit FROM fiaon_global_auftraege WHERE ref = ${REF}`) as any[];
  ok(erg?.gestartet === true && g.status === "gestartet" && Number(g.etappe) === 1 && typeof g.etappen_seit === "object" && !Array.isArray(g.etappen_seit) && !!g.etappen_seit["1"], "gestartet, Etappe 1, etappen_seit ist ein Objekt", { erg, g });
  const [aufgabe] = (await sqlPool`SELECT link, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${REF}:start`}`) as any[];
  ok(aufgabe?.link === `/agent/global/${REF}` && Number(aufgabe.zustaendig_agent_id) === 8, "Aufgabe „US-Struktur starten“ führt ins Office zum Auftrag", aufgabe);
  let s: any = await L.globalBereichKundenSicht(REF, "T");
  ok(s.etappe === 1 && s.verlauf.length === 3 && /Etappe 1 hat begonnen: Gründung und Dokumente/.test(s.verlauf[0].text), "Verlauf des Kunden: Auftrag, Zahlung, Start", s.verlauf);
  await A.globalNachZahlung(REF);
  await new Promise((r) => setTimeout(r, 300));
  s = await L.globalBereichKundenSicht(REF, "T");
  ok(s.verlauf.length === 3 && s.etappe === 1, "zweiter Aufruf (wiederholbar): nichts doppelt", s.verlauf);
}

// ═══ TEIL 4: JAHRESBETREUUNG AB DEM ZWEITEN JAHR (19.09.2026, E-196) ═════════
// Die Spalten aus ensureGlobalTabelle, die Wahl in jeder Sicht (Kunde, Office, Liste, Leitung, Bestellweg),
// die Start-Aufgabe, die Rechnung — und der Tageslauf: EINE Aufgabe rund einen Monat vor dem ersten
// Jahrestag, auch am abgeschlossenen Auftrag, nie im Pflichtenkalender des Kunden, beim zweiten Lauf nichts.
{
  titel("Jahresbetreuung: Spalten, Sichten, Start, Rechnung, Tageslauf");
  const B = await import("../shared/fiaon-global-bereich");
  const { rechnungsSpracheSetzen } = await import("../server/fiaon-invoice");
  const spalten = (await sqlPool`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'fiaon_global_auftraege' AND column_name LIKE 'jahresbetreuung%' ORDER BY column_name`) as any[];
  ok(spalten.length === 2 && spalten[0].data_type === "boolean" && spalten[0].is_nullable === "NO" && /false/i.test(String(spalten[0].column_default)) && spalten[1].data_type === "integer" && spalten[1].is_nullable === "YES",
    "Spalten jahresbetreuung (boolean, NOT NULL, DEFAULT false) und jahresbetreuung_preis_cents (integer, leer erlaubt)", spalten);
  const [alt] = (await sqlPool`SELECT jahresbetreuung, jahresbetreuung_preis_cents FROM fiaon_global_auftraege WHERE ref = 'FIAON-E2E-0001'`) as any[];
  ok(alt?.jahresbetreuung === false && alt?.jahresbetreuung_preis_cents === null, "Aufträge von vorher: nicht gebucht, kein Preis", alt);

  const heute = new Date().toISOString().slice(0, 10);
  const vorJahr = (tage: number) => B.isoPlusTage(B.isoPlusMonate(heute, -12), tage);
  // FAELLIG: gegründet so, dass der Jahrestag in 20 Tagen ist (Rechnung seit 10 Tagen dran), Auftrag abgeschlossen.
  // START: ohne Gründungstag, gestartet vor elf Monaten und zwei Wochen — gerechnet wird ab dem Start.
  // SPAETER: Jahrestag in 45 Tagen — noch keine Aufgabe. OHNE: fällig, aber nicht gebucht.
  const faelle = [
    { ref: "FIAON-JB-FAELLIG", jb: true, status: "abgeschlossen", gegruendet: vorJahr(20), gestartet: vorJahr(-20) },
    { ref: "FIAON-JB-START", jb: true, status: "gestartet", gegruendet: null, gestartet: vorJahr(14) },
    { ref: "FIAON-JB-SPAETER", jb: true, status: "gestartet", gegruendet: vorJahr(45), gestartet: vorJahr(10) },
    { ref: "FIAON-JB-OHNE", jb: false, status: "abgeschlossen", gegruendet: vorJahr(20), gestartet: vorJahr(-20) },
  ];
  for (const f of faelle) {
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_email, email, paid_at)
      VALUES (${f.ref}, 'business', 'submitted', 'global_struktur', 'FIAON Global Struktur', ${"PAY-" + f.ref.slice(-6)}, 'paid', 2499.00, 'Jahr GmbH', 'j@jahr.example', 'j@jahr.example', NOW())`;
    await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, bezahlt_am, gestartet_am,
        zustaendig_agent_id, firma_name, email, gesellschaft, jahresbetreuung, jahresbetreuung_preis_cents)
      VALUES (${f.ref}, 'global_struktur', 'DE', ${sqlPool.json({ name: "Jahr GmbH", ort: "Bonn", land: "DE" })}, ${sqlPool.json({ anrede: "Frau", vorname: "Jana", nachname: "Jahr", email: "j@jahr.example" })},
              '{}'::jsonb, 'v1', 'de', ${f.gestartet}::date, ${f.status}, ${f.gestartet}::date, ${`${f.gestartet}T10:00:00Z`}::timestamptz, 8, 'Jahr GmbH', 'j@jahr.example',
              ${f.gegruendet ? sqlPool.json({ name: "Jahr LLC", form: "LLC", bundesstaat: "WY", gegruendetAm: f.gegruendet }) : null}, ${f.jb}, ${f.jb ? 69900 : null})`;
  }

  // Die Sichten: Kunde (ohne Internes), Office (mit dem Tag der Rechnung), Liste, Leitung, Bestellweg.
  const k: any = await L.globalBereichKundenSicht("FIAON-JB-FAELLIG", "T");
  ok(k.jahresbetreuung === true && k.jahresbetreuungPreisCents === 69900 && !("jahresbetreuungRechnungAb" in k), "Kundensicht: gebucht mit Preis, ohne den internen Rechnungstag", { jb: k.jahresbetreuung, p: k.jahresbetreuungPreisCents, r: k.jahresbetreuungRechnungAb });
  const kOhne: any = await L.globalBereichKundenSicht("FIAON-JB-OHNE", "T");
  ok(kOhne.jahresbetreuung === false && kOhne.jahresbetreuungPreisCents === null, "Kundensicht ohne Haken: nicht gebucht", { jb: kOhne.jahresbetreuung });
  const erwartet = B.globalJahresbetreuungRechnungAb({ gegruendetAm: vorJahr(20) })!;
  const o: any = await L.globalBereichOfficeSicht("FIAON-JB-FAELLIG");
  ok(o.jahresbetreuung === true && o.jahresbetreuungRechnungAb === erwartet.rechnungAb && o.jahresbetreuungJahrestag === erwartet.jahrestag && o.jahresbetreuungBasis === "gruendung", "Officesicht: Rechnung ab / Jahrestag / Grundlage", { r: o.jahresbetreuungRechnungAb, j: o.jahresbetreuungJahrestag, b: o.jahresbetreuungBasis, erwartet });
  const oStart: any = await L.globalBereichOfficeSicht("FIAON-JB-START");
  ok(oStart.jahresbetreuungBasis === "start" && oStart.jahresbetreuungJahrestag === B.isoPlusMonate(vorJahr(14), 12), "Officesicht ohne Gründungstag: gerechnet ab dem Start", { b: oStart.jahresbetreuungBasis, j: oStart.jahresbetreuungJahrestag });
  const liste: any[] = await L.globalBereichListe({ agentId: 8, alle: true });
  ok(liste.find((z) => z.ref === "FIAON-JB-FAELLIG")?.jahresbetreuung === true && liste.find((z) => z.ref === "FIAON-JB-OHNE")?.jahresbetreuung === false && liste.find((z) => z.ref === "FIAON-E2E-0001")?.jahresbetreuung === false, "Office-Liste trägt die Wahl");
  const leitung: any = await A.globalAuftraegeListe();
  const lz = leitung.zeilen.find((x: any) => x.ref === "FIAON-JB-FAELLIG");
  ok(lz?.jahresbetreuung === true && lz?.jahresbetreuungPreisCents === 69900 && leitung.zeilen.find((x: any) => x.ref === "FIAON-JB-OHNE")?.jahresbetreuung === false, "Leitungs-Liste trägt Wahl und Preis", lz && { jb: lz.jahresbetreuung, p: lz.jahresbetreuungPreisCents });
  const sicht: any = await A.globalAuftragSicht("FIAON-JB-FAELLIG", "T");
  ok(sicht?.jahresbetreuung === true && sicht?.betragCents === 249900, "GET /global/auftrag/:ref: gebucht — fällig bleibt der Paketpreis", sicht && { jb: sicht.jahresbetreuung, b: sicht.betragCents });

  // Die Rechnung liest die Wahl aus der Akte (echte Abfrage) — die Zeile bekommt den Hinweis, der Betrag bleibt.
  const [zeile] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = 'FIAON-JB-FAELLIG'`) as any[];
  await rechnungsSpracheSetzen(sqlPool, zeile);
  ok(zeile.rechnung_jahresbetreuung_cents === 69900 && zeile.rechnung_sprache === undefined, "Rechnung: Hinweis-Feld gesetzt, Sprache bleibt deutsch", { c: zeile.rechnung_jahresbetreuung_cents, s: zeile.rechnung_sprache });
  const [zeileOhne] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = 'FIAON-JB-OHNE'`) as any[];
  await rechnungsSpracheSetzen(sqlPool, zeileOhne);
  ok(zeileOhne.rechnung_jahresbetreuung_cents === undefined, "Rechnung ohne Haken: kein Hinweis-Feld", zeileOhne.rechnung_jahresbetreuung_cents);

  // Tageslauf am Tag: FAELLIG (abgeschlossen, ab Gründung) und START (ab Start) bekommen je EINE Aufgabe.
  const lauf: any = await L.globalTageslauf(new Date(`${heute}T10:00:00Z`));
  ok(lauf.ruhe === false && lauf.jahresbetreuung === 2, "Tageslauf: zwei Aufgaben „Rechnung fürs zweite Jahr“ (FAELLIG, START)", lauf);
  const todos = (await sqlPool`SELECT schluessel, titel, text, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel LIKE 'global:FIAON-JB-%:jahresbetreuung:2' ORDER BY schluessel`) as any[];
  ok(todos.map((t: any) => t.schluessel).join() === "global:FIAON-JB-FAELLIG:jahresbetreuung:2,global:FIAON-JB-START:jahresbetreuung:2", "Aufgaben nur für die fälligen, gebuchten Aufträge", todos.map((t: any) => t.schluessel));
  const tf = todos.find((t: any) => t.schluessel.includes("FAELLIG"));
  ok(!!tf && tf.titel === "Jahresbetreuung: Rechnung für das zweite Betreuungsjahr stellen — Jahr GmbH" && Number(tf.zustaendig_agent_id) === 8 && /699,00 €/.test(tf.text) && tf.text.includes(B.globalTagAlsText(erwartet.jahrestag, "de")) && /der Gründung/.test(tf.text), "Aufgabe: Titel, zuständige Person, Preis, Jahrestag", tf);
  ok(/des Starts/.test(todos.find((t: any) => t.schluessel.includes("START"))?.text ?? ""), "Aufgabe ohne Gründungstag sagt, dass ab dem Start gerechnet wurde");
  const kalender = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_fristen WHERE ref LIKE 'FIAON-JB-%' AND (titel ILIKE '%Jahresbetreuung%' OR titel ILIKE '%Rechnung%')`) as any[];
  ok(Number(kalender[0].n) === 0, "die Rechnung steht NICHT im Pflichtenkalender des Kunden");
  const lauf2: any = await L.globalTageslauf(new Date(`${heute}T11:00:00Z`));
  ok(lauf2.jahresbetreuung === 0, "zweiter Lauf am selben Tag: keine zweite Aufgabe", lauf2);
  const o2: any = await L.globalBereichOfficeSicht("FIAON-JB-FAELLIG");
  const k2: any = await L.globalBereichKundenSicht("FIAON-JB-FAELLIG", "T");
  ok(o2.intern.verlaufAlles.some((v: any) => v.art === "jahresbetreuung" && v.sichtbar === false) && !JSON.stringify(k2.verlauf).includes("Jahresbetreuung"), "Verlauf: intern vermerkt, der Kunde sieht es nicht");

  // Start-Aufgabe eines gebuchten Auftrags: Punkt 4 nennt die Jahresbetreuung statt „laufende Kosten erklären“.
  const NZ = "FIAON-JB-NZ";
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, company_name, contact_email, email, paid_at)
    VALUES (${NZ}, 'business', 'submitted', 'global_struktur', 'FIAON Global Struktur', 'PAY-JBNZ', 'paid', 2499.00, 'Neu GmbH', 'n@neu.example', 'n@neu.example', NOW())`;
  await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, status, zustaendig_agent_id, firma_name, email, jahresbetreuung, jahresbetreuung_preis_cents)
    VALUES (${NZ}, 'global_struktur', 'DE', ${sqlPool.json({ name: "Neu GmbH", ort: "Kiel", land: "DE" })}, ${sqlPool.json({ anrede: "Herr", vorname: "Nils", nachname: "Neu", email: "n@neu.example" })},
            '{}'::jsonb, 'v1', 'de', NOW(), 'offen', 8, 'Neu GmbH', 'n@neu.example', TRUE, 69900)`;
  const start: any = await A.globalNachZahlung(NZ);
  const [st] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${NZ}:start`}`) as any[];
  ok(start?.gestartet === true && /JAHRESBETREUUNG gebucht \(699,00 € je Betreuungsjahr/.test(st?.text ?? "") && !/Laufende Kosten ab dem zweiten Jahr im Startgespräch erklären/.test(st?.text ?? ""), "Start-Aufgabe: Punkt 4 nennt die gebuchte Jahresbetreuung", st?.text);
}

// ═══ TEIL 5: DIE VORSCHAU ÜBER HTTP (E-196) ══════════════════════════════════
// Der Haken kommt über den Körper der Anfrage an — dieselbe Route, die /business/start und der Mustervertrag rufen.
{
  titel("Jahresbetreuung: POST /global/vertrag/vorschau");
  const express = (await import("express")).default;
  const router = (await import("../server/routes/fiaon-global")).default;
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/fiaon", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/fiaon/global/vertrag/vorschau`;
  const koerper = { paket: "global_kapital", auftraggeber: "unternehmen", firma: { land: "DE", name: "Muster GmbH", rechtsform: "GmbH", strasse: "Musterstraße 1", plz: "10115", ort: "Berlin" }, ansprechpartner: { anrede: "Herr", vorname: "Max", nachname: "Mustermann", funktion: "Geschäftsführer" }, sprache: "de" };
  const hol = async (b: unknown) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(b) }); return { status: r.status, j: await r.json().catch(() => null) as any }; };
  const mit = await hol({ ...koerper, jahresbetreuung: true });
  const ohne = await hol(koerper);
  const en = await hol({ ...koerper, sprache: "en", auftraggeber: "privat", firma: { land: "AT", strasse: "Ring 1", plz: "1010", ort: "Wien" }, ansprechpartner: { anrede: "Frau", vorname: "Erika", nachname: "Muster" }, jahresbetreuung: true });
  ok(mit.status === 200 && /Zusätzlich umfasst der Auftrag die <b>Jahresbetreuung<\/b>/.test(mit.j?.html ?? "") && /699 € je Betreuungsjahr/.test(mit.j?.html ?? ""), "Vorschau mit Haken: Ziffer 2 und 5 tragen die Jahresbetreuung", mit.status);
  ok(ohne.status === 200 && !/Jahresbetreuung/.test(ohne.j?.html ?? ""), "Vorschau ohne Haken: kein Wort davon", ohne.status);
  ok(en.status === 200 && /annual care plan/.test(en.j?.html ?? "") && /The same applies to the price of the annual care plan\./.test(en.j?.html ?? ""), "Vorschau englisch, Privatperson: Endpreis-Satz der Jahresbetreuung", en.status);
  server.close();
}

console.log(`\n── Ergebnis: ${n} Prüfungen, ${fehler} Fehler.`);
await sqlPool.end({ timeout: 2 });
process.exit(fehler ? 1 : 0);
