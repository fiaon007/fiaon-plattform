// ═══════════════════════════════════════════════════════════════════════════
// PRAXIS-PRÜFSTAND MIT DATENBANK: E-451 — CHEFBÜRO › GLOBAL-MANDATE AUSBAU (28.10.2026)
//
// scripts/pruef-chef-global-sync.ts prüft E-451 auch ohne Datenbank (Quelltext + reine Funktionen). Dieser Lauf fährt die
// ECHTEN exportierten Server-Funktionen gegen eine LOKALE Kopie des Prüfstands — dieselben Wege wie Chefbüro-Route, Portal-
// Route, halbstündlicher Abgleich und der Knopf „Global-Akte anlegen“:
//   A  Zahl am Menüpunkt: Akten mit Neuem vom Kunden (Upload, unterschriebene Fassung, Nachricht) — ohne Test-Akte;
//      gesehen/gelesen → wieder weg; der GET schreibt nichts
//   B  Der Weg des Kunden: Chef-Sicht trägt dieselben Etappen wie das Portal — beim Begleitvertrag BEGLEIT_PORTAL
//   C  Begleit-Akte: Zahlung + Start im Verlauf (bezahlt_am/gestartet_am) — Abgleich idempotent, nur leere Felder, keine Mail;
//      eine Nicht-Begleit-Akte bleibt unberührt
//   D  Akte ↔ Angebot: Abgleich setzt auftrag_ref nur, wenn eindeutig; danach Begleitvertrag-Block + Angebotsunterlagen in
//      Portal und Chefbüro; Startgespräch für den Begleitvertrag „nicht_bereit“; Knopf „Global-Akte anlegen“ verknüpft sofort
//   E  Zuständigkeit: Chef-Sicht sagt offen, wohin was geht; Festlegen → Portal nennt die Person, offene Aufgaben wandern mit,
//      neue Aufgaben folgen ihr (Leitung = Board des Betreibers); ungültige Person → 400
//   N  Nachtrag aus den Gutachten: Etappe setzen schreibt beim Begleitvertrag SEINE Titel (keine Garantie), Startzeile je Vertrag,
//      Zahlung vor der Unterschrift → keine Zeile „Zahlung eingegangen.“, Daniel behält Hausadresse + Nummer, wartende Aufgaben
//      wandern nicht, eine über die Rechnung stornierte Akte zählt nicht im Menü
//
// ── NIE GEGEN DIE PRODUKTION ──────────────────────────────────────────────
// Der Lauf SCHREIBT (Saat, Dokumente, Aufgaben). Er weigert sich, wenn DATABASE_URL nicht auf 127.0.0.1/localhost zeigt,
// wenn die Datenbank nicht „fiaon_pruefstand_e451…“ heißt oder wenn ein Mail-/Zahl-Schlüssel gesetzt ist. Alle Daten sind
// ausgedacht; jede Runde nimmt eigene Kennungen (FIAON-E451-<Zeit>-…), nichts wird gelöscht.
//
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e451
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e451 node_modules/.bin/tsx scripts/pruef-e451-lokal.ts
//
// ROTPROBE gegen origin/main: dieselbe Datei in einen Arbeitsbaum auf origin/main kopieren und DORT starten (eigene Kopie
// der Datenbank). Fehlende Funktionen zählen als ROT (kein Absturz). Am Ende „ERGEBNIS {…}“ je Schritt; Exit 1 bei ROT.
// ═══════════════════════════════════════════════════════════════════════════

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_e451/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen die lokale Kopie fiaon_pruefstand_e451 auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");
const K: any = await import("../server/lib/fiaon-global-akte-komplett");
const O: any = await import("../server/lib/fiaon-global-angebot");
const SG: any = await import("../server/lib/fiaon-global-angebot-startgespraech");
const UL: any = await import("../server/lib/fiaon-global-angebot-unterlagen");
const { BEGLEIT_PORTAL } = await import("../shared/fiaon-global-angebot-begleit");

let gut = 0; const rot: string[] = [];
const schritte: Record<string, "grün" | "rot"> = {};
let aktuell = "";
const schritt = (nr: string, t: string) => { aktuell = nr; schritte[nr] = schritte[nr] ?? "grün"; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: boolean, text: string, fund?: unknown): void {
  if (bed) { gut++; console.log(`  ok    ${text}`); return; }
  rot.push(`${aktuell}: ${text}`); schritte[aktuell] = "rot";
  console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 700)}` : ""}`);
}
async function sicher<T>(was: string, f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch (e: any) { ok(false, `${was} warf: ${String(e?.message ?? e).slice(0, 300)}`); return null; }
}
/** Eine Funktion, die es (im alten Stand) vielleicht nicht gibt — fehlt sie, ist das ROT, kein Absturz. */
function fn(mod: any, name: string): ((...a: any[]) => Promise<any>) | null {
  if (typeof mod?.[name] === "function") return mod[name];
  ok(false, `Funktion ${name} fehlt`);
  return null;
}

// ── Saat ─────────────────────────────────────────────────────────────────────
// REF:  Begleit-Akte (Anker llc_paket, bezahlt mit paid_at), angebot_id → Begleit-Angebot ANG, auftrag_ref leer, niemand zuständig,
//       bezahlt_am und gestartet_am leer — genau der Stand der ersten echten Begleit-Akte (vor dem Nachtrag ec3b0516).
// REFT: Test-Akte mit neuem Kunden-Upload (zählt nicht im Menü).
// REFN: Nicht-Begleit-Akte, bezahlt, bezahlt_am leer (der Begleit-Abgleich fasst sie nicht an).
// ANG2: Begleit-Angebot, auf das ZWEI Akten zeigen (nicht eindeutig → keine Verknüpfung).
// ANG3: angenommenes Begleit-Angebot ohne Akte + bezahlte llc_paket-Rechnung derselben Adresse → Knopf „Global-Akte anlegen“.
const stempel = Date.now().toString(36).toUpperCase();
const REF = `FIAON-E451-${stempel}-1`;
const REFT = `FIAON-E451-${stempel}-T`;
const REFN = `FIAON-E451-${stempel}-N`;
const REF2A = `FIAON-E451-${stempel}-2A`;
const REF2B = `FIAON-E451-${stempel}-2B`;
const REF3 = `FIAON-E451-${stempel}-3`;
const REFP = `FIAON-E451-${stempel}-P`;   // Nachtrag: Begleit-Akte, Zahlung NACH der Unterschrift
const REFX = `FIAON-E451-${stempel}-X`;   // Nachtrag: Rechnung storniert (cancelled_at), Akte selbst nicht
const CHEF = { id: 928, name: "Prüf-Leitung" };   // Leitungs-Anmeldung: aktiv, Testkonto
const DANIEL = 8;                                   // aktiver Mitarbeiter, zugleich Vorgabe global_zustaendig_agent_id
const GESPERRT = 927;                               // gesperrtes Prüfkonto
const PAID_AT = "2026-09-24T12:00:00.000Z";
const MAIL = `begleit-${stempel.toLowerCase()}@pruefmuster.example`;
const MAIL3 = `begleit3-${stempel.toLowerCase()}@pruefmuster.example`;

await A.ensureGlobalTabelle();
await L.ensureGlobalBereich();
await M.ensureGlobalMandat();
await O.ensureAngebotTabellen();
await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('global_zustaendig_agent_id', ${String(DANIEL)}, NOW())
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

const angebotAnlegen = async (ref: string, mail: string) => ((await sqlPool`
  INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, status, gueltig_bis, angenommen_am, schalter)
  VALUES (${ref}, 'IA-BEGLEIT-2026-10-08-A',
    ${sqlPool.json({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", email: mail, land: "DE", strasse: "Prüfweg 1", plz: "12345", ort: "Musterstadt" } as any)},
    ${sqlPool.json({ ansprechpartner: ["justin", "daniel"] } as any)}, ${sqlPool.json({} as any)}, 'angenommen', '2026-12-31', NOW() - INTERVAL '19 days',
    ${sqlPool.json({ llc: { wunsch: "PRUEFMUSTER LLC" }, sofortBeginn: true } as any)})
  RETURNING id`) as any[])[0].id as number;
const ANG = await angebotAnlegen(`FIAON-IA-E451${stempel}1`, MAIL);
const ANG2 = await angebotAnlegen(`FIAON-IA-E451${stempel}2`, MAIL);
const ANG3 = await angebotAnlegen(`FIAON-IA-E451${stempel}3`, MAIL3);

const bestellung = async (ref: string, pack: string, mail: string, bezahlt: boolean) => sqlPool`
  INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, completed_at, amount_due, contact_name, contact_email, email, created_at)
  VALUES (${ref}, 'privat', 'submitted', ${pack}, 'Unterlagen-Paket (Prüfstand)', ${"PAY-" + ref}, ${bezahlt ? "paid" : "pending_payment"},
          ${bezahlt ? PAID_AT : null}, ${bezahlt ? PAID_AT : null}, 169.70, 'Max Prüfmann', ${mail}, ${mail}, NOW() - INTERVAL '35 days')`;
const akte = async (ref: string, o: { angebotId?: number | null; begleit: boolean; test?: boolean; paket?: string }) => sqlPool`
  INSERT INTO fiaon_global_auftraege
    (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email,
     rechnung_ust_modus, zustaendig_agent_id, gestartet_am, angebot_id, ist_test_am, created_at)
  VALUES (${ref}, ${o.paket ?? "global_individuell"}, 'DE',
    ${sqlPool.json({ art: "privat", name: "Max Prüfmann", ort: "Musterstadt", land: "DE", strasse: "Prüfweg 1", plz: "12345" } as any)},
    ${sqlPool.json({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", funktion: "", email: MAIL, telefon: "+49301234567" } as any)},
    ${sqlPool.json(o.begleit ? { annahme: "Auftrag zahlungspflichtig erteilen", begleitvertrag: true } : { annahme: "Auftrag zahlungspflichtig erteilen" } as any)},
    ${o.begleit ? "IA-BEGLEIT-2026-10-08-A" : "PRUEF"}, 'de', NOW() - INTERVAL '19 days', 'individualangebot', 'gestartet', 'Max Prüfmann', ${MAIL}, 'none', NULL,
    NULL, ${o.angebotId ?? null}, ${o.test ? new Date() : null}, NOW() - INTERVAL '6 days')`;

await bestellung(REF, "llc_paket", MAIL, true);   await akte(REF, { angebotId: ANG, begleit: true });
await bestellung(REFT, "llc_paket", MAIL, true);  await akte(REFT, { begleit: true, test: true });
await bestellung(REFN, "global_individuell", MAIL, true); await akte(REFN, { begleit: false });
await bestellung(REF2A, "llc_paket", MAIL, true); await akte(REF2A, { angebotId: ANG2, begleit: true });
await bestellung(REF2B, "llc_paket", MAIL, true); await akte(REF2B, { angebotId: ANG2, begleit: true });
await bestellung(REF3, "llc_paket", MAIL3, true);
await bestellung(REFP, "llc_paket", MAIL, true);  await akte(REFP, { begleit: true });
const PAID_P = new Date(Date.now() - 2 * 86_400_000);
await sqlPool`UPDATE fiaon_applications SET paid_at = ${PAID_P}, completed_at = ${PAID_P} WHERE ref = ${REFP}`;
await bestellung(REFX, "global_individuell", MAIL, true); await akte(REFX, { begleit: false });
await sqlPool`UPDATE fiaon_applications SET cancelled_at = NOW() WHERE ref = ${REFX}`;
for (const r of [REF, REFT, REF2A]) await M.globalMandatPortal(r, true, CHEF);
console.log(`Saat: ${REF} (Begleit, Angebot ${ANG}), ${REFT} (Test), ${REFN} (kein Begleit), ${REF2A}/${REF2B} (Angebot ${ANG2} doppelt), Rechnung ${REF3} (Angebot ${ANG3} ohne Akte)`);

async function portal(ref: string): Promise<any> {
  const s: any = await L.globalBereichKundenSicht(ref, "PRUEF-TOKEN");
  if (s && await M.globalPortalNeuFrei(ref)) Object.assign(s, await M.globalMandatKundenZusatz(ref, "PRUEF-TOKEN", s.sprache ?? "de", false));
  return s;
}
const chef = (ref: string): Promise<any> => M.globalMandatChefSicht(ref);
const akteZeile = async (ref: string) => ((await sqlPool`SELECT * FROM fiaon_global_auftraege WHERE ref = ${ref}`) as any[])[0];
const angebotZeile = async (id: number) => ((await sqlPool`SELECT id, auftrag_ref, startgespraech_termin_id FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0];
const todos = async (ref: string) => (await sqlPool`SELECT id, schluessel, status, zustaendig_art, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${ref}:%`} ORDER BY id`) as any[];
const kundenMails = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE lower(empfaenger) IN (${MAIL}, ${MAIL3})`) as any[])[0].n);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 16]), Buffer.from("Exif"), Buffer.alloc(400, 7)]);
const pdf = (x: string) => Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"), Buffer.from(`% ${x}\n`), Buffer.alloc(300, 0x20)]);
const mailsVorher = await kundenMails();

// ═══ A ZAHL AM MENÜPUNKT ═════════════════════════════════════════════════════
schritt("A", "Zahl am Menüpunkt „Global-Mandate“");
{
  const neuZahl = fn(M, "globalChefNeuZahl");
  if (neuZahl) {
    const n0 = Number((await neuZahl()).akten);
    // Test-Akte bekommt einen Upload → zählt nicht.
    await sicher("Upload Test-Akte", () => L.globalKundenDokument(REFT, { art: "reisepass", datei: { buffer: pdf("T"), originalname: "pass.pdf" } }));
    ok(Number((await neuZahl()).akten) === n0, "Upload in einer Test-Akte zählt nicht", { n0 });
    // Nachtrag (Gutachten 5): Akte, deren Rechnung storniert ist (cancelled_at) — die Liste zeigt sie als storniert, das Menü zählt sie nicht.
    await L.dokumentSpeichern({ ref: REFX, von: "kunde", art: "reisepass", dateiname: "pass.pdf", mime: "application/pdf", inhalt: pdf("X"), sichtbar: true, agentId: null });
    ok(Number((await neuZahl()).akten) === n0, "Nachtrag: Upload in einer über die Rechnung stornierten Akte zählt nicht", { n0 });
    const up: any = await sicher("Upload", () => L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: JPG, originalname: "IMG_1.jpg" } }));
    ok(!!up?.ok, "Kunden-Upload angenommen", up);
    ok(Number((await neuZahl()).akten) === n0 + 1, "Upload → eine Akte mehr", { n0 });
    const na: any = await sicher("Nachricht", () => L.globalKundenNachricht(REF, { text: "Guten Tag, ist alles angekommen?" }));
    ok(!!na?.ok, "Kunden-Nachricht angenommen", na);
    ok(Number((await neuZahl()).akten) === n0 + 1, "Nachricht in derselben Akte → weiter eine Akte (gezählt werden Akten)");
    const vorGet = Number((await neuZahl()).akten);
    await chef(REF); await chef(REF);
    ok(Number((await neuZahl()).akten) === vorGet, "Chef-Akte lesen (GET) ändert die Zahl nicht");
    await M.globalChefGesehen(REF, "alle", "Prüf-Leitung");
    ok(Number((await neuZahl()).akten) === n0 + 1, "Upload gesehen, Nachricht noch ungelesen → Akte zählt weiter");
    await M.globalMandatAnfragenGelesen(REF);
    ok(Number((await neuZahl()).akten) === n0, "gesehen + gelesen → Zahl wieder wie vorher");
    // Eine frisch digital unterschriebene Fassung ist ein Kunden-Dokument mit unterschrift_von_id — sie zählt.
    const orig: any = await L.dokumentSpeichern({ ref: REF, von: "fiaon", art: "sonstiges", dateiname: "vertrag.pdf", mime: "application/pdf", inhalt: pdf("O"), sichtbar: true, agentId: null });
    const fass: any = await L.dokumentSpeichern({ ref: REF, von: "kunde", art: "sonstiges", dateiname: "vertrag_unterschrieben.pdf", mime: "application/pdf", inhalt: pdf("U"), sichtbar: true, agentId: null });
    await sqlPool`UPDATE fiaon_global_dokumente SET unterschrift_von_id = ${orig.id}, unterschrieben_am = NOW() WHERE id = ${fass.id}`;
    ok(Number((await neuZahl()).akten) === n0 + 1, "frisch unterschriebene, ungesehene Fassung → Akte zählt");
    await M.globalChefGesehen(REF, [Number(fass.id)], "Prüf-Leitung");
    ok(Number((await neuZahl()).akten) === n0, "Fassung geöffnet → zählt nicht mehr");
  }
}

// ═══ B DER WEG DES KUNDEN ════════════════════════════════════════════════════
schritt("B", "Der Weg des Kunden: dieselben Etappen in Chef-Sicht und Portal");
{
  const c: any = await sicher("Chef-Sicht", () => chef(REF));
  const p: any = await sicher("Portal", () => portal(REF));
  const titel = (x: any) => ((x?.etappen ?? []) as any[]).map((e) => `${e.nr}:${e.titel}`);
  ok(JSON.stringify(titel(c)) === JSON.stringify(titel(p)) && titel(c).length === 6, "Chef-Sicht = Portal (sechs Etappen, gleiche Titel)", { chef: titel(c), portal: titel(p) });
  const begleit = [1, 2, 3, 4].map((n) => (BEGLEIT_PORTAL.etappen as any)[n].titel);
  ok(JSON.stringify([1, 2, 3, 4].map((n) => (c?.etappen as any[])?.find((e) => e.nr === n)?.titel)) === JSON.stringify(begleit), "Begleitvertrag: Etappen 1–4 = BEGLEIT_PORTAL", { begleit });
}

// ═══ C ZAHLUNG UND START IM VERLAUF ══════════════════════════════════════════
schritt("C", "Begleit-Akte: „Zahlung eingegangen“ und „gestartet“ im Verlauf");
{
  const vorher: any = await portal(REF);
  const zeilen = (p: any) => ((p?.verlauf ?? []) as any[]).map((v) => String(v.text));
  ok(!zeilen(vorher).includes("Zahlung eingegangen.") && !zeilen(vorher).includes("Ihr Auftrag ist gestartet."), "vorher: beide Zeilen fehlen (Ausgangslage wie die erste Begleit-Akte)", zeilen(vorher));
  const lauf = fn(K, "begleitZahlungStartAbgleich");
  if (lauf) {
    const r1: any = await sicher("Abgleich 1", () => lauf());
    ok((r1?.gestartet ?? []).includes(REF), "Abgleich übernimmt den Start", r1);
    // Nachtrag (Gutachten 2): Die Anker-Rechnung wurde VOR der Unterschrift bezahlt (Unterlagen-Paket) — keine Zahlung für den Begleitvertrag.
    ok(!(r1?.bezahlt ?? []).includes(REF), "Nachtrag: Zahlung vor der Unterschrift → kein bezahlt_am", r1);
    ok((r1?.bezahlt ?? []).includes(REFP), "Zahlung nach der Unterschrift → bezahlt_am wird übernommen", r1);
    ok(!(r1?.bezahlt ?? []).includes(REFN), "Nicht-Begleit-Akte bleibt unberührt", r1);
    const z = await akteZeile(REF);
    ok(z && z.bezahlt_am === null, "REF: bezahlt_am bleibt leer", z?.bezahlt_am);
    const zp = await akteZeile(REFP);
    ok(zp && new Date(zp.bezahlt_am).toISOString() === PAID_P.toISOString(), "REFP: bezahlt_am = paid_at der Anker-Rechnung (dieselbe Quelle wie Chefbüro/Umsatz)", zp?.bezahlt_am);
    ok(z && new Date(z.gestartet_am).getTime() === new Date(z.created_at).getTime(), "gestartet_am = Anlage der Akte", { g: z?.gestartet_am, c: z?.created_at });
    const r2: any = await sicher("Abgleich 2", () => lauf());
    ok(!(r2?.bezahlt ?? []).includes(REF) && !(r2?.gestartet ?? []).includes(REF), "zweiter Lauf: nichts mehr (idempotent)", r2);
    const nach: any = await portal(REF);
    ok(zeilen(nach).filter((t) => t === "Zahlung eingegangen.").length === 0, "Nachtrag: Portal-Verlauf REF ohne „Zahlung eingegangen.“ vor dem Vertrag", zeilen(nach));
    const nachP: any = await portal(REFP);
    ok(zeilen(nachP).filter((t) => t === "Zahlung eingegangen.").length === 1, "Portal-Verlauf REFP: „Zahlung eingegangen.“ genau einmal", zeilen(nachP));
    ok(zeilen(nach).filter((t) => t === "Ihr Auftrag ist gestartet.").length === 1, "Portal-Verlauf: „Ihr Auftrag ist gestartet.“ genau einmal");
    const c: any = await chef(REF);
    ok(c?.bezahltAm === PAID_AT, "Chefbüro „Bezahlt“ zeigt weiter den Tag der Anker-Rechnung (paid_at)", c?.bezahltAm);
    ok((await akteZeile(REFN)).bezahlt_am === null, "Nicht-Begleit-Akte: bezahlt_am bleibt leer");
  }
  // Der halbstündliche Lauf ruft den Abgleich mit.
  const ab: any = await sicher("globalAkteAbgleich", () => K.globalAkteAbgleich());
  ok(!!ab && "zahlungStart" in ab && "verknuepfung" in ab, "halbstündlicher Abgleich enthält Verknüpfung und Zahlung/Start", ab && Object.keys(ab));
}

// ═══ D AKTE ↔ ANGEBOT ════════════════════════════════════════════════════════
schritt("D", "Begleit-Akte findet ihr Angebot (auftrag_ref), nur wenn eindeutig");
{
  // (Der Abgleich in C hat schon verknüpft — deshalb hier der Stand danach, und der Knopf für ANG3.)
  const a1 = await angebotZeile(ANG);
  ok(a1?.auftrag_ref === REF, "Angebot ANG → auftrag_ref = Akte", a1);
  const a2 = await angebotZeile(ANG2);
  ok(a2?.auftrag_ref === null, "Angebot mit zwei Akten: NICHT verknüpft (nicht eindeutig)", a2);
  const verkn = fn(K, "begleitAngebotVerknuepfen");
  if (verkn) { const r: any = await sicher("Verknüpfen erneut", () => verkn()); ok((r?.verknuepft ?? []).length === 0, "zweiter Lauf: nichts mehr (idempotent)", r); }
  const up: any = await sicher("Angebotsunterlage", () => UL.unterlagenHinzufuegen(ANG, [{ buffer: pdf("Anlage"), name: "01 Anlage zum Begleitvertrag.pdf" }], "Prüfstand"));
  ok(!!up?.ok, "Angebotsunterlage am Angebot abgelegt", up);
  const p: any = await portal(REF);
  ok(p?.angebot?.art === "begleit" && p.angebot.titel === BEGLEIT_PORTAL.titel, "Portal: Begleitvertrag-Block da", p?.angebot);
  ok((p?.angebotUnterlagen ?? []).length === 1, "Portal: Angebotsunterlagen da", p?.angebotUnterlagen);
  const c: any = await chef(REF);
  ok(c?.angebot?.art === "begleit", "Chefbüro: Begleitvertrag-Block da", c?.angebot);
  const sg: any = await sicher("Startgespräch", () => SG.angebotStartgespraechBuchen(ANG, { anlass: "pruefstand" }));
  ok(sg?.status === "nicht_bereit", "Startgespräch für den Begleitvertrag: nicht_bereit (kein automatischer Termin)", sg);
  ok((await angebotZeile(ANG))?.startgespraech_termin_id === null, "kein Termin gebucht");
  // Knopf „Global-Akte anlegen“ (ANG3): Akte am Anker REF3, sofort verknüpft und mit Zahlung/Start.
  const k: any = await sicher("globalBegleitAkteAnlegen", () => K.globalBegleitAkteAnlegen(ANG3, CHEF));
  ok(!!k?.ok && k.ref === REF3, "Knopf legt die Akte am Anker an", k);
  ok((await angebotZeile(ANG3))?.auftrag_ref === REF3, "Knopf verknüpft sofort (auftrag_ref)", await angebotZeile(ANG3));
  const z3 = await akteZeile(REF3);
  ok(!z3?.bezahlt_am && !!z3?.gestartet_am, "Knopf übernimmt den Start; die Zahlung lag vor der Annahme → kein bezahlt_am (Nachtrag)", { b: z3?.bezahlt_am, g: z3?.gestartet_am });
}

// ═══ E ZUSTÄNDIGKEIT ═════════════════════════════════════════════════════════
schritt("E", "Zuständigkeit: eine Quelle für Portal, Aufgaben und Chefbüro");
{
  const c0: any = await chef(REF);
  const z0 = c0?.zustaendigkeit;
  ok(!!z0 && z0.name === null, "Chef-Sicht: niemand festgelegt", z0);
  ok(!!z0 && /Daniel/.test(String(z0.aufgabenAn)) && /Vorgabe/.test(String(z0.aufgabenAn)), "Chef-Sicht sagt: Aufgaben gehen an die Vorgabe", z0);
  ok(!!z0 && z0.portalNennt === "Justin Schwarzott", "Chef-Sicht sagt: Portal nennt den Angebots-Ansprechpartner", z0);
  // Eine offene Aufgabe bei der Vorgabe (Daniel) erzeugen.
  await L.globalKundenNachricht(REF, { text: "Noch eine Frage zur Gründung." });
  const vor = (await todos(REF)).filter((t) => t.status !== "erledigt" && /:nachricht:/.test(t.schluessel));
  ok(vor.length === 1 && vor[0].zustaendig_art === "agent" && Number(vor[0].zustaendig_agent_id) === DANIEL, "vorher: Nachricht-Aufgabe liegt bei der Vorgabe (Daniel)", vor);
  // Nachtrag (Gutachten 3): eine WARTENDE Aufgabe (offene Rückfrage) bei Daniel — sie darf beim Wechsel nicht wandern.
  const { auftragFuerKunden } = await import("../server/routes/fiaon-betreiber-todo");
  const w: any = await auftragFuerKunden({ personId: null, ref: REF, titel: "Prüfstand: wartende Aufgabe", text: "Rückfrage offen.", schluessel: `global:${REF}:pruef-wartet`,
    bereich: "konten", quelle: "global", autorName: "Prüfstand", agentId: DANIEL } as any);
  await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'wartet', frage_offen = TRUE WHERE id = ${w.id}`;
  const setzen = fn(M, "globalMandatZustaendigSetzen");
  const auswahl = fn(M, "globalZustaendigAuswahl");
  if (setzen && auswahl) {
    const liste: any[] = await auswahl(CHEF.id);
    ok(liste.some((x) => x.id === CHEF.id && /\(Leitung\)$/.test(x.name)) && liste.some((x) => x.id === DANIEL), "Auswahl: Mitarbeiter + die angemeldete Leitung", liste);
    const falsch: any = await setzen(REF, GESPERRT, CHEF);
    ok(!falsch?.ok && falsch?.status === 400, "gesperrte Person → 400", falsch);
    const e1: any = await setzen(REF, CHEF.id, CHEF);
    ok(!!e1?.ok, "Leitung festgelegt", e1);
    ok(Number((await akteZeile(REF)).zustaendig_agent_id) === CHEF.id, "Akte trägt die Leitung");
    const t1 = (await todos(REF)).find((t) => t.id === vor[0]?.id);
    ok(t1?.zustaendig_art === "betreiber" && t1?.zustaendig_agent_id === null, "offene Aufgabe wandert auf das Board der Leitung", t1);
    const tw = ((await sqlPool`SELECT status, zustaendig_art, zustaendig_agent_id, frage_offen FROM fiaon_betreiber_todos WHERE id = ${w.id}`) as any[])[0];
    ok(tw?.status === "wartet" && tw.zustaendig_art === "agent" && Number(tw.zustaendig_agent_id) === DANIEL && tw.frage_offen === true, "Nachtrag: wartende Aufgabe bleibt bei Daniel, mit ihrer Rückfrage", tw);
    const p1: any = await portal(REF);
    ok(p1?.ansprechpartner?.name === "Justin Schwarzott" && p1.ansprechpartner.email === "js@fiaon.com" && !!p1.ansprechpartner.telefon, "Portal nennt die Leitung (mit Hausadresse und Nummer)", p1?.ansprechpartner);
    const c1: any = await chef(REF);
    ok(c1?.zustaendigkeit?.name === "Justin Schwarzott" && /Board der Leitung/.test(String(c1.zustaendigkeit.aufgabenAn)) && c1.zustaendigkeit.portalNennt === "Justin Schwarzott", "Chef-Sicht: Akte, Aufgaben und Portal stimmen überein", c1?.zustaendigkeit);
    await L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: pdf("neu1"), originalname: "pass2.pdf" } });
    const tag1 = (await todos(REF)).filter((t) => /:eingang:/.test(t.schluessel) && t.status !== "erledigt");
    ok(tag1.length >= 1 && tag1.every((t) => t.zustaendig_art === "betreiber"), "neue Upload-Aufgabe folgt: Board der Leitung", tag1);
    const e2: any = await setzen(REF, DANIEL, CHEF);
    ok(!!e2?.ok, "Daniel festgelegt", e2);
    // Aufgaben auf dem Board der Leitung bleiben dort (bewusst; delegieren wandert nur, was bei einem Mitarbeiter liegt).
    await L.globalKundenNachricht(REF, { text: "Und wann geht es weiter?" });
    const t3 = (await todos(REF)).filter((t) => t.status !== "erledigt" && /:nachricht:/.test(t.schluessel));
    ok(t3.length >= 1, "Nachricht-Aufgabe offen", t3);
    const p2: any = await portal(REF);
    ok(p2?.ansprechpartner?.name === "Daniel Stripling", "Portal nennt jetzt Daniel", p2?.ansprechpartner);
    ok(p2?.ansprechpartner?.email === "daniel@fiaon.com" && !!p2.ansprechpartner.telefon, "Nachtrag: Daniel mit Hausadresse und Geschäftsnummer (nicht welcome@ ohne Telefon)", { email: p2?.ansprechpartner?.email, telefon: !!p2?.ansprechpartner?.telefon });
    const nochmal: any = await setzen(REF, DANIEL, CHEF);
    ok(!!nochmal?.ok && /bereits/.test(String(nochmal.meldung)), "dieselbe Person noch einmal: „bereits zuständig“", nochmal);
    const verlauf = (await sqlPool`SELECT text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${REF} AND art = 'zustaendig' ORDER BY id`) as any[];
    ok(verlauf.length === 2 && verlauf.every((v) => !v.sichtbar), "zwei interne Verlaufszeilen (nicht für den Kunden)", verlauf);
  }
  // Aufgaben-Ziel: die eine Regel.
  const zielFn = fn(A, "globalAufgabenZiel");
  if (zielFn) {
    ok(JSON.stringify(await zielFn(DANIEL)) === JSON.stringify({ agentId: DANIEL }), "Ziel: aktiver Mitarbeiter → er");
    ok(JSON.stringify(await zielFn(CHEF.id)) === JSON.stringify({ agentId: null, anBetreiber: true }), "Ziel: Leitung (Testkonto) → Board");
    ok(JSON.stringify(await zielFn(GESPERRT)) === JSON.stringify({ agentId: DANIEL }), "Ziel: gesperrt → Vorgabe");
    ok(JSON.stringify(await zielFn(null)) === JSON.stringify({ agentId: DANIEL }), "Ziel: leer → Vorgabe");
  }
}

// ═══ N NACHTRAG: ETAPPEN-TEXTE JE VERTRAG ═════════════════════════════════════
schritt("N", "Nachtrag: Etappe setzen und Startzeile beim Begleitvertrag mit SEINEN Worten");
{
  const e: any = await sicher("Etappe 2 setzen", () => L.globalEtappeSetzen(REF, { etappe: 2, mitteilen: false }, CHEF));
  ok(!!e?.ok && /Erste Business-Karten/.test(String(e.meldung)), "Meldung nennt „Erste Business-Karten“", e);
  const [v] = (await sqlPool`SELECT text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${REF} AND art = 'etappe' ORDER BY id DESC LIMIT 1`) as any[];
  ok(!!v && /Erste Business-Karten/.test(String(v.text)) && !/Firmenkarte|Garantie|Kartenleiter|Bürgin/.test(String(v.text)), "Verlaufszeile für den Kunden: Begleit-Titel, keine Garantie", v);
  const t2 = typeof L.etappeTextFuerAkte === "function" ? L.etappeTextFuerAkte(await akteZeile(REF), 4, "de") : null;
  ok(!!t2 && t2.titel === (BEGLEIT_PORTAL.etappen as any)[4].titel && !/Bürgin|Garantie/.test(t2.text), "Etappe 4 (Mailtext) beim Begleitvertrag: ohne Bürgin/Garantie", t2);
  const f = typeof L.etappeFussnoteFuerAkte === "function" ? L.etappeFussnoteFuerAkte(await akteZeile(REF), "de") : "Garantie";
  ok(!/Garantie/.test(String(f)), "Mail-Fußnote beim Begleitvertrag ohne Garantie", f);
  const st: any = await sicher("Start vermerken", () => L.globalStartVermerken(REFP));
  const [sv] = (await sqlPool`SELECT text FROM fiaon_global_verlauf WHERE ref = ${REFP} AND art = 'start' ORDER BY id DESC LIMIT 1`) as any[];
  ok(st === true && /Ihre LLC und Ihr Konto/.test(String(sv?.text)) && !/Gründung und Dokumente/.test(String(sv?.text)), "Startzeile beim Begleitvertrag: „Ihre LLC und Ihr Konto“", { st, sv });
}

// ═══ ENDE ════════════════════════════════════════════════════════════════════
schritt("Z", "Keine Kundenmail, kein Netz");
ok((await kundenMails()) === mailsVorher, "keine Mail an die Prüf-Kunden", { vorher: mailsVorher, nachher: await kundenMails() });
ok(netz.length === 0, "kein Aufruf ins Netz", netz);

console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) console.log(rot.map((r) => `  · ${r}`).join("\n"));
console.log(`ERGEBNIS ${JSON.stringify({ refs: [REF, REF3], schritte, ok: gut, rot: rot.length })}`);
process.exit(rot.length ? 1 : 0);
