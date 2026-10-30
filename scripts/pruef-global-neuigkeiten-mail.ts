// ═══════════════════════════════════════════════════════════════════════════
// PRAXIS-PRÜFSTAND MIT DATENBANK: E-467 — „NEU FÜR SIE" AUCH PER MAIL (30.10.2026)
//
// Fährt die ECHTEN Server-Funktionen gegen eine LOKALE Kopie des Prüfstands — dieselben Wege wie Chefbüro (Station
// speichern, Dokument ablegen, Antwort), Portal („Verstanden") und der Lauf global_neuigkeiten_mail. Der Versand ist
// ABGEKLEMMT: fetch ist ersetzt — Anfragen an die Brevo-Adresse werden nur mitgeschrieben (Betreff, HTML, Empfänger),
// jede andere Netzanfrage wirft. Es verlässt keine Mail den Rechner.
//
//   1  Bündelung: drei neue Dinge kurz nacheinander → „Ruhe" → nach 10 Minuten EINE Mail mit drei Punkten
//   2  keine Doppelmail: gleich danach nichts neu; neues Dokument → „Abstand" (1 Stunde) → danach nur das Neue
//   3  gesehen → keine Mail (Fenster im Portal geschlossen)
//   4  eigene Mail deckt: Dokument mit „Kunde informieren", Antwort mit Mail → keine zweite; Antwort ohne Mail → Mail
//   5  Start nach Zahlung (eigene Startmail) und interne Zeilen → keine Mail; sichtbare Notiz → nur der Titel
//   6  Test-Auftrag, stornierter Auftrag → nie; Auftrag ohne Adresse → nicht gesendet, im Verlauf, kein zweiter Versuch
//   7  Sprache: englischer Auftrag → englische Mail mit /en/-Link
//   8  erster Deploy: Altes vor dem Zählbeginn wird nie gemailt; Schalter aus/an; Sendefenster
//   9  zwei Läufe gleichzeitig → genau eine Mail
//
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e467
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e467 node_modules/.bin/tsx scripts/pruef-global-neuigkeiten-mail.ts
//
// NIE GEGEN DIE PRODUKTION: weigert sich ohne 127.0.0.1/„fiaon_pruefstand_e467…“ und mit gesetzten Mail-/Zahl-Schlüsseln.
// ═══════════════════════════════════════════════════════════════════════════

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_e467/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen die lokale Kopie fiaon_pruefstand_e467 auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN", "GOOGLE_SERVICE_ACCOUNT_JSON"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
// Der abgeklemmte Mailweg: der Motor sieht einen Schlüssel, die Anfrage landet hier in der Liste.
type Versand = { an: string; betreff: string; html: string; text: string; event: string };
const versand: Versand[] = [];
globalThis.fetch = (async (adresse: unknown, init?: { body?: string }) => {
  if (String(adresse) === "https://api.brevo.com/v3/smtp/email") {
    const b = JSON.parse(String(init?.body ?? "{}"));
    versand.push({ an: b.to?.[0]?.email, betreff: b.subject, html: b.htmlContent, text: b.textContent, event: b.tags?.[0] });
    return new Response(JSON.stringify({ messageId: `<pruef-${versand.length}@pruefstand>` }), { status: 201, headers: { "content-type": "application/json" } });
  }
  throw new Error(`Prüfstand: kein Netz (${String(adresse).slice(0, 60)})`);
}) as typeof fetch;
process.env.BREVO_API_KEY = "pruefstand-attrappe-ohne-netz";

const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");
const N: any = await import("../server/lib/fiaon-global-neuigkeiten");
const NM: any = await import("../server/lib/fiaon-global-neuigkeiten-mail");
const R: any = await import("../shared/fiaon-global-neuigkeiten-mail");

let gut = 0; const rot: string[] = [];
let aktuell = "";
const schritt = (nr: string, t: string) => { aktuell = nr; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: boolean, text: string, fund?: unknown): void {
  if (bed) { gut++; console.log(`  ok    ${text}`); return; }
  rot.push(`${aktuell}: ${text}`);
  console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 700)}` : ""}`);
}

const stempel = Date.now().toString(36).toUpperCase();
const CHEF = { id: 928, name: "Prüf-Leitung" };
const pdf = (x: string) => Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"), Buffer.from(`% ${x}\n`), Buffer.alloc(300, 0x20)]);
const SEIT = new Date(Date.now() - 30 * 86_400_000).toISOString(); // Zählbeginn weit vorn — die Akten sind jünger

await A.ensureGlobalTabelle();
await L.ensureGlobalBereich();
await M.ensureGlobalMandat();
// Pflicht: frische Kopie ohne Zählbeginn — der erste Lauf soll ihn setzen (Schritt 8).
await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('global_neuigkeiten_mail', 'global_neuigkeiten_mail_seit')`;

async function akte(ref: string, o: { sprache?: "de" | "en"; mail?: string | null; alterTage?: number } = {}): Promise<void> {
  const mail = o.mail === null ? "" : (o.mail ?? `${ref.toLowerCase()}@pruefmuster.example`);
  const alter = `${o.alterTage ?? 8} days`;
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, amount_due, company_name, contact_name, contact_email, email)
    VALUES (${ref}, 'business', 'submitted', 'global_individuell', 'Begleitvertrag (Prüfstand)', ${"PAY-" + ref}, 'paid', NOW() - INTERVAL '7 days', 2900.00, 'Prüfmuster GmbH', 'Max Prüfmann', ${mail}, ${mail})`;
  await sqlPool`INSERT INTO fiaon_global_auftraege
      (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email,
       rechnung_ust_modus, zustaendig_agent_id, gestartet_am, created_at)
    VALUES (${ref}, 'global_individuell', 'DE',
      ${sqlPool.json({ name: "Prüfmuster GmbH", ort: "Musterstadt", land: "DE", strasse: "Prüfweg 1", plz: "12345" } as any)},
      ${sqlPool.json({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", funktion: "Geschäftsführer", email: mail, telefon: "+49301234567" } as any)},
      ${sqlPool.json({ annahme: "Auftrag zahlungspflichtig erteilen", begleitvertrag: true } as any)},
      'IA-BEGLEIT-PRUEF', ${o.sprache ?? "de"}, NOW() - ${alter}::interval, 'individualangebot', 'gestartet', 'Prüfmuster GmbH', ${mail}, 'none', 927,
      NOW() - ${alter}::interval, NOW() - ${alter}::interval)`;
}
/** Die Zeit vergeht: alle Zeilen der Akte rücken um `min` Minuten zurück (Verlauf, Dokumente, Antworten, Mailprotokoll). */
async function zurueck(ref: string, min: number): Promise<void> {
  const iv = `${min} minutes`;
  await sqlPool`UPDATE fiaon_global_verlauf SET created_at = created_at - ${iv}::interval WHERE ref = ${ref}`;
  await sqlPool`UPDATE fiaon_global_dokumente SET created_at = created_at - ${iv}::interval, abgelehnt_am = abgelehnt_am - ${iv}::interval WHERE ref = ${ref}`;
  await sqlPool`UPDATE fiaon_global_nachrichten SET created_at = created_at - ${iv}::interval WHERE ref = ${ref}`;
  await sqlPool`UPDATE fiaon_global_auftraege SET neuigkeiten_mail_am = neuigkeiten_mail_am - ${iv}::interval, neuigkeiten_gesehen_am = neuigkeiten_gesehen_am - ${iv}::interval WHERE ref = ${ref}`;
  await sqlPool`UPDATE fiaon_mail_log SET created_at = created_at - ${iv}::interval
                 WHERE COALESCE(payload->>'antrag_id', CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ->> 'antrag_id' END) = ${ref}`;
}
const pruefen = (ref: string, imFenster = true) => NM.globalNeuigkeitenMailPruefen(ref, { seit: SEIT, imFenster });
const mailAm = async (ref: string) => ((await sqlPool`SELECT neuigkeiten_mail_am FROM fiaon_global_auftraege WHERE ref = ${ref}`) as any[])[0]?.neuigkeiten_mail_am ?? null;
const zeilen = async (ref: string) => (await sqlPool`SELECT text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${ref} AND art = 'mail_neuigkeiten' ORDER BY id`) as any[];
const fuer = (ref: string) => versand.filter((v) => v.an === `${ref.toLowerCase()}@pruefmuster.example`);
const telefon = (ref: string) => M.globalStationSpeichern(ref, { schluessel: "adresse", status: "erledigt", werte: { usTelefon: "+1 307 555 0148" } }, CHEF);
const ein = (ref: string) => M.globalStationSpeichern(ref, { schluessel: "ein", status: "erledigt", werte: { ein: "12-3456789" } }, CHEF);
const dok = (ref: string, art: string, mitteilen = false, extra: Record<string, unknown> = {}) =>
  M.globalMandatDokument(ref, { art, datei: { buffer: pdf(`${art} ${ref} ${Math.random()}`), originalname: `${art}.pdf` }, sichtbar: true, mitteilen, unterschrift: false, ...extra }, CHEF);

// ═══ 1 ═══
const REF = `FIAON-E467-${stempel}-1`;
await akte(REF);
console.log(`Saat: ${REF}`);
schritt("1", "Bündelung: drei Dinge → Ruhe → EINE Mail mit drei Punkten");
{
  ok((await pruefen(REF)).grund === "nichts_neu", "frische Akte: nichts neu");
  ok(!!(await telefon(REF))?.ok && !!(await ein(REF))?.ok && !!(await dok(REF, "gruendungsurkunde"))?.ok, "US-Nummer, EIN, Gründungsurkunde (echte Wege des Chefbüros)");
  const r1 = await pruefen(REF);
  ok(r1.was === "uebersprungen" && r1.grund === "ruhe", "gleich danach: wartet (Ruhe 10 Minuten)", r1);
  await zurueck(REF, 4);
  ok((await pruefen(REF)).grund === "ruhe", "nach 4 Minuten: wartet weiter");
  ok((await pruefen(REF, false)).grund === "ruhe" || (await pruefen(REF, false)).grund === "sendefenster", "außerhalb des Sendefensters: nie senden");
  ok((await pruefen(REF, false)).was !== "gesendet", "außerhalb des Sendefensters: keine Mail");
  await zurueck(REF, 7);
  ok((await pruefen(REF, false)).grund === "sendefenster", "nach 11 Minuten, aber außerhalb des Fensters: wartet aufs Fenster");
  const r2 = await pruefen(REF);
  ok(r2.was === "gesendet" && r2.punkte.length === 3, "nach 11 Minuten im Fenster: gesendet, drei Punkte", r2);
  const m = fuer(REF);
  ok(m.length === 1 && m[0].event === "global_neuigkeiten", "genau EINE Mail (global_neuigkeiten)", m.map((x) => x.event));
  ok(/^Neu in Ihrem Portal: /.test(m[0]?.betreff ?? ""), "Betreff „Neu in Ihrem Portal: …“", m[0]?.betreff);
  ok(new RegExp(`/business/auftrag/${REF}\\?t=`).test(m[0]?.html ?? "") && /Portal öffnen/.test(m[0]?.html ?? ""), "Knopf „Portal öffnen“ mit gültigem Kundenlink");
  ok(["Ihre US-Telefonnummer ist da", "Ihre EIN ist da", "Ihre Gründungsurkunde liegt bereit"].every((t) => m[0]?.html.includes(t)), "die drei Titel des Fensters stehen in der Mail");
  ok(!m[0]?.html.includes("12-3456789") && !m[0]?.html.includes("555 0148") && !m[0]?.text.includes("12-3456789"), "keine Werte in der Mail (EIN, Nummer)");
  ok(/Guten Tag Herr Prüfmann|Sehr geehrter Herr Prüfmann/.test(m[0]?.text ?? "") && !/\b(du|dein|dir)\b/i.test(m[0]?.text ?? ""), "gesiezt, mit Anrede", m[0]?.text.slice(0, 120));
  const z = await zeilen(REF);
  ok(z.length === 1 && z[0].sichtbar === false && /^Neuigkeiten-Mail an den Kunden gesendet \(3 Punkte\)/.test(z[0].text), "Chefbüro: interne Verlaufszeile „Neuigkeiten-Mail … gesendet“", z);
  const [log] = (await sqlPool`SELECT status, ausgeloest_von FROM fiaon_mail_log WHERE event = 'global_neuigkeiten' ORDER BY id DESC LIMIT 1`) as any[];
  ok(log?.status === "versandt" && /^System/.test(String(log?.ausgeloest_von)), "Mailprotokoll: versandt, ausgelöst vom System", log);
  ok(!!(await mailAm(REF)), "Merker neuigkeiten_mail_am gesetzt");
}

// ═══ 2 ═══
schritt("2", "keine Doppelmail; Abstand eine Stunde; danach nur das Neue");
{
  ok((await pruefen(REF)).grund === "nichts_neu", "gleich danach: nichts neu");
  ok(fuer(REF).length === 1, "weiterhin genau eine Mail");
  ok(!!(await dok(REF, "post", false, { postAbsender: "Secretary of State" }))?.ok, "Post für die Gesellschaft abgelegt");
  await zurueck(REF, 11);
  ok((await pruefen(REF)).grund === "abstand", "11 Minuten später: wartet (höchstens eine Mail je Stunde)");
  await zurueck(REF, 50);
  const r = await pruefen(REF);
  ok(r.was === "gesendet" && r.punkte.length === 1 && /Post/.test(r.punkte[0]), "nach über einer Stunde: gesendet — nur die Post", r);
  ok(fuer(REF).length === 2, "zwei Mails insgesamt");
}

// ═══ 3 ═══
schritt("3", "gesehen → keine Mail");
{
  await zurueck(REF, 120);
  ok(!!(await M.globalStationSpeichern(REF, { schluessel: "duns", status: "erledigt", werte: { duns: "123456789" } }, CHEF))?.ok, "D-U-N-S eingetragen");
  await zurueck(REF, 11);
  const fenster = await N.globalNeuigkeitenKunde(REF, "de");
  // Die Mail vermerkt nichts als gesehen — das Fenster zeigt weiter alles seit dem letzten „Verstanden“ (Mail UND Popup).
  ok(fenster?.liste.some((x: any) => x.art === "duns") && fenster.liste.some((x: any) => x.art === "ein"), "das Fenster zeigt die D-U-N-S — und weiter das schon Gemailte", fenster?.liste.map((x: any) => x.art));
  ok(await N.globalNeuigkeitenGesehen(REF, fenster.stand), "Kunde drückt „Verstanden“");
  ok((await pruefen(REF)).grund === "nichts_neu", "danach: keine Mail");
  ok(fuer(REF).length === 2, "weiterhin zwei Mails");
}

// ═══ 4 ═══
schritt("4", "eigene Mail deckt: Dokument und Antwort mit Mail → keine zweite");
{
  const R4 = `FIAON-E467-${stempel}-4`;
  await akte(R4);
  ok(!!(await dok(R4, "operating_agreement", true))?.ok, "Dokument mit „Kunde informieren“");
  ok(fuer(R4).length === 1 && fuer(R4)[0].event === "global_dokument", "die eigene Dokument-Mail ging (global_dokument)", fuer(R4).map((x) => x.event));
  ok(!!(await M.globalMandatAntwort(R4, { text: "Wir haben alles erhalten.", mitteilen: true }, CHEF))?.ok, "Antwort mit Mail");
  ok(fuer(R4).length === 2 && fuer(R4)[1].event === "global_nachricht", "die eigene Antwort-Mail ging (global_nachricht)");
  await zurueck(R4, 15);
  const r = await pruefen(R4);
  ok(r.grund === "nichts_neu", "Neuigkeiten-Mail: nichts (beides schon gemailt)", r);
  ok(fuer(R4).length === 2, "keine dritte Mail");
  ok(!!(await M.globalMandatAntwort(R4, { text: "Kurze Rückfrage zu Ihrer Adresse.", mitteilen: false }, CHEF))?.ok, "Antwort OHNE Mail");
  await zurueck(R4, 11);
  const r2 = await pruefen(R4);
  ok(r2.was === "gesendet" && r2.punkte.length === 1 && /Antwort/.test(r2.punkte[0]), "Antwort ohne eigene Mail → Neuigkeiten-Mail", r2);
  ok(!fuer(R4)[2]?.html.includes("Kurze Rückfrage"), "der Text der Antwort steht nicht in der Mail");
}

// ═══ 5 ═══
schritt("5", "Start nach Zahlung und interne Zeilen → nichts; sichtbare Notiz → nur der Titel");
{
  const R5 = `FIAON-E467-${stempel}-5`;
  await akte(R5);
  await L.verlaufSchreiben(R5, { art: "start", text: "Ihr Auftrag hat begonnen. Etappe 1: Vorbereitung.", sichtbar: true });
  await L.verlaufSchreiben(R5, { art: "notiz", text: "Intern: Kunde zurückrufen.", sichtbar: false, agentId: 928 });
  await L.verlaufSchreiben(R5, { art: "station", text: "US-Telefonnummer intern vorgemerkt.", sichtbar: false, agentId: 928 });
  await zurueck(R5, 11);
  ok((await pruefen(R5)).grund === "nichts_neu", "Start (eigene Startmail) und interne Zeilen: keine Mail");
  await L.verlaufSchreiben(R5, { art: "notiz", text: "Ihre Bankunterlagen sind vollständig — wir melden uns zum Termin.", sichtbar: true, agentId: 928 });
  await zurueck(R5, 11);
  const r = await pruefen(R5);
  ok(r.was === "gesendet" && r.punkte[0] === "Eine Mitteilung für Sie", "sichtbare Notiz → Mail „Eine Mitteilung für Sie“", r);
  ok(!fuer(R5)[0]?.html.includes("Bankunterlagen"), "der Text der Notiz bleibt im Portal");
}

// ═══ 6 ═══
schritt("6", "Test, Storno → nie; ohne Adresse → nicht gesendet, vermerkt, kein zweiter Versuch");
{
  const RT = `FIAON-E467-${stempel}-TEST`; const RS = `FIAON-E467-${stempel}-STORNO`; const RO = `FIAON-E467-${stempel}-OHNE`;
  await akte(RT); await akte(RS); await akte(RO, { mail: null });
  await M.globalMandatTest(RT, true, CHEF);
  await sqlPool`UPDATE fiaon_applications SET cancelled_at = NOW() WHERE ref = ${RS}`;
  for (const r of [RT, RS, RO]) await telefon(r);
  for (const r of [RT, RS, RO]) await zurueck(r, 11);
  ok((await pruefen(RT)).grund === "test", "Test-Auftrag: übersprungen");
  ok((await pruefen(RS)).grund === "storniert", "stornierter Auftrag: übersprungen");
  const vorher = versand.length;
  const ro = await pruefen(RO);
  ok(ro.was === "nicht_gesendet" && /keine E-Mail-Adresse/.test(ro.grund), "ohne Adresse: nicht gesendet", ro);
  ok((await zeilen(RO)).some((z: any) => /NICHT gesendet \(keine E-Mail-Adresse/.test(z.text)), "Chefbüro: Grund steht im Verlauf");
  ok((await pruefen(RO)).grund === "nichts_neu", "kein zweiter Versuch für dieselben Neuigkeiten");
  ok(versand.length === vorher, "kein Versand an Test, Storno oder ohne Adresse");
}

// ═══ 7 ═══
schritt("7", "Sprache: englischer Auftrag → englische Mail");
{
  const RE = `FIAON-E467-${stempel}-EN`;
  await akte(RE, { sprache: "en" });
  await telefon(RE);
  await zurueck(RE, 11);
  const r = await pruefen(RE);
  ok(r.was === "gesendet", "gesendet", r);
  const m = fuer(RE)[0];
  ok(m?.betreff === "New in your portal: Your US phone number is ready", "englischer Betreff", m?.betreff);
  ok(new RegExp(`/en/business/auftrag/${RE}\\?t=`).test(m?.html ?? "") && /Open portal/.test(m?.html ?? ""), "englischer Knopf mit /en/-Link");
  ok(/Dear Mr Prüfmann/.test(m?.text ?? "") && !/\b(Ihre?|Sie)\b/.test(m?.text ?? ""), "englische Anrede, kein Deutsch", m?.text.slice(0, 160));
}

// ═══ 8 ═══
schritt("8", "erster Deploy: Zählbeginn, nie Altes; Schalter; Sendefenster");
{
  // Der Zählbeginn fehlt (oben gelöscht) — der erste Lauf setzt ihn auf „jetzt".
  const RB = `FIAON-E467-${stempel}-BESTAND`;
  await akte(RB, { alterTage: 20 });
  await telefon(RB);
  await zurueck(RB, 120); // die Nummer kam vor zwei Stunden — vor dem Deploy
  const vor = versand.length;
  const l1 = await NM.globalNeuigkeitenMailLauf({ imFenster: true });
  const e1 = await NM.globalNeuigkeitenMailEinstellung();
  ok(Math.abs(Date.parse(e1.seit) - Date.now()) < 120_000 && e1.an === true, "erster Lauf: Zählbeginn = jetzt, Schalter an (Vorgabe)", e1);
  ok(!fuer(RB).length, "Bestandsakte: die Nummer von vor dem Deploy wird NICHT gemailt", l1);
  const e2 = await NM.globalNeuigkeitenMailEinstellung(new Date(Date.now() + 86_400_000));
  ok(e2.seit === e1.seit, "der Zählbeginn bleibt (wird nicht bei jedem Lauf neu gesetzt)");
  // Neues NACH dem Zählbeginn wird gemailt: Zählbeginn 30 Minuten zurück, EIN vor 15 Minuten.
  await sqlPool`UPDATE fiaon_settings SET value = ${new Date(Date.now() - 30 * 60_000).toISOString()} WHERE key = 'global_neuigkeiten_mail_seit'`;
  await ein(RB);
  await sqlPool`UPDATE fiaon_global_verlauf SET created_at = NOW() - INTERVAL '15 minutes' WHERE ref = ${RB} AND created_at > NOW() - INTERVAL '1 minute'`;
  const l2 = await NM.globalNeuigkeitenMailLauf({ imFenster: false });
  ok(!fuer(RB).length && l2.kandidaten === 0, "außerhalb des Sendefensters: der Lauf entscheidet nichts", l2);
  const l3 = await NM.globalNeuigkeitenMailLauf({ imFenster: true });
  const mb = fuer(RB);
  ok(mb.length === 1 && mb[0].html.includes("Ihre EIN ist da") && !mb[0].html.includes("US-Telefonnummer"), "nach dem Zählbeginn: nur die EIN, nicht die alte Nummer", { l3, betreff: mb[0]?.betreff });
  // Schalter
  const aus = await NM.globalNeuigkeitenMailSchalten(false, "Prüf-Leitung");
  ok(aus.an === false && (await NM.globalNeuigkeitenMailLauf({ imFenster: true })).aus === true, "Schalter aus: der Lauf tut nichts");
  const an = await NM.globalNeuigkeitenMailSchalten(true, "Prüf-Leitung");
  ok(an.an === true && Date.parse(an.seit) > Date.parse(e1.seit) - 1 && Math.abs(Date.parse(an.seit) - Date.now()) < 60_000, "wieder an: Zählbeginn = jetzt (nichts aus der Aus-Zeit wird nachgemailt)", an);
  ok(versand.length - vor === 1, "insgesamt in Schritt 8 genau eine Mail");
}

// ═══ 9 ═══
schritt("9", "zwei gleichzeitig → genau eine Mail");
{
  const RG = `FIAON-E467-${stempel}-GLEICH`;
  await akte(RG);
  await telefon(RG); await ein(RG);
  await zurueck(RG, 11);
  const [a, b] = await Promise.all([pruefen(RG), pruefen(RG)]);
  const gesendet = [a, b].filter((x: any) => x.was === "gesendet").length;
  ok(gesendet === 1 && fuer(RG).length === 1, "genau eine gesendet, eine übersprungen", [a, b]);
}

// ═══ Reine Regeln am Rand ═══
schritt("R", "reine Regeln: Grenze, Hoechstwarten");
{
  const j = Date.now();
  const t = (min: number) => new Date(j - min * 60_000).toISOString();
  ok(R.globalNeuigkeitenMailEntscheid({ liste: [{ am: t(65) }, { am: t(2) }], jetzt: new Date(j).toISOString(), imFenster: true }).senden, "Ruhe hält nicht ewig: älteste wartet 65 Min → senden");
  ok(R.globalNeuigkeitenMailGrenze({ gesehenAm: t(5), mailAm: t(10), seit: t(100), akteSeit: t(1000) }) === t(5), "Grenze = das Späteste");
  ok(R.GLOBAL_NEUIGKEITEN_MAIL.ruheMinuten === 10 && R.GLOBAL_NEUIGKEITEN_MAIL.abstandMinuten === 60, "Zahlen in EINER Konstante");
}

console.log(`\nVERSAND (abgeklemmt): ${versand.length} Mails — ${versand.map((v) => v.event).join(", ")}`);
console.log(`\nERGEBNIS: ${gut} grün, ${rot.length} rot`);
if (rot.length) console.log(rot.map((x) => `  - ${x}`).join("\n"));
await sqlPool.end?.({ timeout: 2 }).catch?.(() => {});
process.exit(rot.length ? 1 : 0);
