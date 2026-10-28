// ═══════════════════════════════════════════════════════════════════════════
// PRAXIS-PRÜFSTAND MIT DATENBANK: E-443 — CHEFBÜRO › GLOBAL-MANDATE SYNCHRON MIT DEM PORTAL (28.10.2026)
//
// scripts/pruef-chef-global-sync.ts prüft E-443 ohne Datenbank (Quelltext + reine Funktionen). Dieser Lauf fährt die
// ECHTEN exportierten Server-Funktionen (per await import) gegen eine LOKALE Kopie des Prüfstands — dieselben Wege,
// die Portal-Route und Chefbüro-Route aufrufen:
//   1  Kunde lädt ein Passfoto (art reisepass) hoch → Aufgabe mit Link /chef/global?mandat=…, Text ohne „von 5“
//   2  Chef-Akte lesen → Dokument neu = true; fiaon_gesehen_am bleibt NULL (der GET schreibt nichts)   ← Rotprobe
//   3  Chef lehnt das Foto ab (Grund) → Portal: Reisepass fehlt MIT Grund, Verlaufszeile, KEINE Mail
//   4  Kunde lädt einen PDF-Scan nach → Portal: nichts offen; Chef: altes Dokument „ersetzt“, neues neu = true
//   5  „Alle als gesehen“ → neu = false, Upload-Aufgaben DIESER Akte erledigt, die der zweiten Akte unberührt
//   6  Art ändern bei einem „sonstiges“-Upload → zulässige Art klappt, unzulässige wird abgelehnt
//   7  Bezahlt: Chef-Sicht trägt das Datum aus paid_at (Akte ohne bezahlt_am), Portal „bezahlt“ — gleich
//   8  Nachricht des Kunden → Aufgabe; Chef markiert gelesen → Aufgabe erledigt
//
// ── NIE GEGEN DIE PRODUKTION ──────────────────────────────────────────────
// Der Lauf SCHREIBT (Saat, Dokumente, Aufgaben). Er weigert sich, wenn DATABASE_URL nicht auf 127.0.0.1/localhost zeigt,
// wenn die Datenbank nicht „fiaon_pruefstand_e443…“ heißt oder wenn ein Mail-/Zahl-Schlüssel gesetzt ist. Alle Daten sind
// ausgedacht; jede Runde nimmt eigene Kennungen (FIAON-E443-<Zeit>-1/-2), nichts wird gelöscht.
//
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e443
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e443 node_modules/.bin/tsx scripts/pruef-e443-lokal.ts
//
// ROTPROBE=1: nur Saat + Schritte 1, 2 und 7 (die gibt es auch im alten Code) — für den Lauf gegen origin/main in einem
// zweiten Arbeitsbaum (Datei dorthin kopieren und DORT starten, sonst lösen @shared-Pfade in den neuen Arbeitsbaum auf).
// Am Ende eine Zeile „ERGEBNIS {…}“ je Schritt grün/rot; Exit 1 bei ROT.
// ═══════════════════════════════════════════════════════════════════════════

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_e443/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen die lokale Kopie fiaon_pruefstand_e443 auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const ROT = process.env.ROTPROBE === "1";
const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");

let gut = 0; const rot: string[] = [];
const schritte: Record<string, "grün" | "rot"> = {};
let aktuell = "";
const schritt = (nr: string, t: string) => { aktuell = nr; schritte[nr] = "grün"; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: boolean, text: string, fund?: unknown): void {
  if (bed) { gut++; console.log(`  ok    ${text}`); return; }
  rot.push(`${aktuell}: ${text}`); schritte[aktuell] = "rot";
  console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 700)}` : ""}`);
}
async function sicher<T>(was: string, f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch (e: any) { ok(false, `${was} warf: ${String(e?.message ?? e).slice(0, 300)}`); return null; }
}

// ── Saat: zwei ausgedachte Begleit-Akten ─────────────────────────────────────
const stempel = Date.now().toString(36).toUpperCase();
const REF = `FIAON-E443-${stempel}-1`;
const REF2 = `FIAON-E443-${stempel}-2`;
const CHEF = { id: 928, name: "Prüf-Leitung" };
const ZUST = 927;
const PAID_AT = "2026-10-20T09:15:00.000Z";
const GRUND = "Foto statt Scan — bitte als PDF-Scan";
const chefPfad = (r: string) => `/chef/global?mandat=${encodeURIComponent(r)}`;

await A.ensureGlobalTabelle();
await L.ensureGlobalBereich();
await M.ensureGlobalMandat();
for (const [ref, firma, mail] of [[REF, "Prüfmuster Eins GmbH", "eins@pruefmuster.example"], [REF2, "Prüfmuster Zwei GmbH", "zwei@pruefmuster.example"]] as const) {
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, amount_due, company_name, contact_name, contact_email, email)
    VALUES (${ref}, 'business', 'submitted', 'global_individuell', 'Begleitvertrag (Prüfstand)', ${"PAY-" + ref}, 'paid', ${PAID_AT}, 2900.00, ${firma}, 'Max Prüfmann', ${mail}, ${mail})`;
  await sqlPool`INSERT INTO fiaon_global_auftraege
      (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email,
       rechnung_ust_modus, zustaendig_agent_id, gestartet_am)
    VALUES (${ref}, 'global_individuell', 'DE',
      ${sqlPool.json({ name: firma, ort: "Musterstadt", land: "DE", strasse: "Prüfweg 1", plz: "12345" } as any)},
      ${sqlPool.json({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", funktion: "Geschäftsführer", email: mail, telefon: "+49301234567" } as any)},
      ${sqlPool.json({ annahme: "Auftrag zahlungspflichtig erteilen", begleitvertrag: true } as any)},
      'IA-BEGLEIT-PRUEF', 'de', NOW() - INTERVAL '8 days', 'individualangebot', 'gestartet', ${firma}, ${mail}, 'none', ${ZUST}, NOW() - INTERVAL '8 days')`;
  await M.globalMandatPortal(ref, true, CHEF);
}
console.log(`Saat: ${REF}, ${REF2} (paket global_individuell, Begleitvertrag, Bestellung bezahlt mit paid_at, bezahlt_am leer)`);

/** Die Portal-Sicht genau wie GET /global/mein-auftrag/:ref (Kundensicht + Zusatz des neuen Portals, wenn frei). */
async function portal(ref: string): Promise<any> {
  const s: any = await L.globalBereichKundenSicht(ref, "PRUEF-TOKEN");
  if (s && await M.globalPortalNeuFrei(ref)) Object.assign(s, await M.globalMandatKundenZusatz(ref, "PRUEF-TOKEN", s.sprache ?? "de", false));
  return s;
}
const chef = (ref: string): Promise<any> => M.globalMandatChefSicht(ref);
const todos = async (ref: string) => (await sqlPool`SELECT id, schluessel, status, link, text FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${ref}:%`} ORDER BY id`) as any[];
const mailZahl = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log`) as any[])[0].n);
const dokZeile = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_global_dokumente WHERE id = ${id}`) as any[])[0];
// „Für Sie zu tun“ im Portal: fehlende Unterlagen + Nachreichen (client/src/pages/global-portal.tsx, darfHochladen).
const offen = (p: any) => [...(p.unterlagen ?? []).filter((u: any) => !u.vorhanden), ...(p.nachreichen ?? [])];

// Ausgedachte Dateien: ein JPG-„Handyfoto“, zwei verschiedene PDF-Scans.
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 16]), Buffer.from("Exif"), Buffer.alloc(400, 7)]);
const pdf = (x: string) => Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"), Buffer.from(`% ${x}\n`), Buffer.alloc(300, 0x20)]);

let fotoId = 0; let scanId = 0;
const mailVorher = await mailZahl();

// ═══ 1 UPLOAD PASSFOTO ═══════════════════════════════════════════════════════
schritt("1", "Kunde lädt ein Passfoto (reisepass) hoch");
{
  const e: any = await sicher("globalKundenDokument", () => L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: JPG, originalname: "IMG_4711.jpg" } }));
  ok(!!e?.ok && e.dokument?.art === "reisepass", "Upload über die Portal-Funktion angenommen", e);
  fotoId = Number(e?.dokument?.id ?? 0);
  const t = (await todos(REF)).filter((x) => /:eingang:/.test(x.schluessel));
  ok(t.length === 1 && t[0].status === "offen", "Upload-Aufgabe angelegt (offen)", t);
  ok(t[0]?.link === chefPfad(REF), `Link der Aufgabe = ${chefPfad(REF)}`, t[0]?.link);
  ok(!!t[0] && !/von 5/.test(String(t[0].text)), "Aufgabentext OHNE „von 5“", t[0]?.text);
  ok(!!t[0] && /verlangte Unterlage/.test(String(t[0].text)), "Aufgabentext spricht von der EINEN verlangten Unterlage (Begleitvertrag)", t[0]?.text);
}

// ═══ 2 CHEF-AKTE LESEN SCHREIBT NICHTS ════════════════════════════════════════
schritt("2", "Chef-Akte lesen → neu = true, fiaon_gesehen_am bleibt NULL");
{
  const c1: any = await sicher("globalMandatChefSicht", () => chef(REF));
  const c2: any = await sicher("globalMandatChefSicht (2. Mal)", () => chef(REF));
  const d = (c2?.dokumente ?? []).find((x: any) => Number(x.id) === fotoId);
  ok(!!c1 && !!d, "Passfoto steht in der Chef-Akte", c2?.dokumente);
  ok(d?.neu === true, "Dokument trägt neu = true (auch nach zweimal Lesen)", d);
  const z = await dokZeile(fotoId);
  ok(!!z && z.fiaon_gesehen_am == null, "DB: fiaon_gesehen_am ist weiterhin NULL", z && { fiaon_gesehen_am: z.fiaon_gesehen_am });
  const t = (await todos(REF)).filter((x) => /:eingang:/.test(x.schluessel));
  ok(t.every((x) => x.status === "offen"), "Upload-Aufgabe bleibt offen (Lesen erledigt nichts)", t.map((x) => x.status));
  const liste: any = await sicher("globalMandateListe", () => M.globalMandateListe());
  const zeile = ((liste?.mandate ?? liste?.liste ?? []) as any[]).find((x: any) => x.ref === REF);
  ok(zeile?.uploadsNeu === 1, "Chef-Liste: Kachel zählt 1 neuen Upload", zeile && { uploadsNeu: zeile.uploadsNeu });
}

if (!ROT) {
  // ═══ 3 ABLEHNEN ═════════════════════════════════════════════════════════════
  schritt("3", "Chef lehnt das Passfoto ab → Portal zeigt Reisepass fehlend MIT Grund");
  {
    const vorP: any = await portal(REF);
    ok(offen(vorP).length === 0, "vorher: Portal hält das Foto für den Reisepass (nichts offen) — der Anlass von E-443", offen(vorP));
    const m0 = await mailZahl();
    const e: any = await sicher("globalMandatDokumentAendern(ablehnen)", () => M.globalMandatDokumentAendern(REF, fotoId, { ablehnen: GRUND }, CHEF));
    ok(!!e?.ok, "Ablehnen angenommen", e);
    const p: any = await portal(REF);
    const u = (p?.unterlagen ?? []).find((x: any) => x.art === "reisepass");
    ok(!!u && u.vorhanden === false, "Portal: Reisepass fehlt", p?.unterlagen);
    ok(u?.abgelehnt?.grund === GRUND, "Portal: der Grund steht an der Unterlage", u);
    ok(offen(p).length === 1, "Portal „Für Sie zu tun“: genau eine Unterlage offen", offen(p));
    const dk = (p?.dokumente ?? []).find((x: any) => Number(x.id) === fotoId);
    ok(dk?.abgelehnt?.grund === GRUND, "Portal-Tresor: das Foto trägt die Marke „bitte neu“ mit Grund", dk);
    const v = (p?.verlauf ?? []).filter((x: any) => x.text === `Bitte reichen Sie „Reisepass“ neu ein: ${GRUND}`);
    ok(v.length === 1, "Verlaufszeile für den Kunden vorhanden", p?.verlauf?.slice(0, 4));
    ok((await mailZahl()) === m0, "keine Mail im fiaon_mail_log durch das Ablehnen", { vorher: m0, nachher: await mailZahl() });
    const e2: any = await M.globalMandatDokumentAendern(REF, fotoId, { ablehnen: GRUND }, CHEF);
    const p2: any = await portal(REF);
    ok(!!e2?.ok && p2.verlauf.filter((x: any) => /neu ein:/.test(x.text)).length === 1, "Doppelklick: gleiche Ablehnung schreibt keine zweite Kundenzeile", e2);
    const e3: any = await L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: JPG, originalname: "IMG_4711.jpg" } });
    ok(e3?.ok === false && e3.status === 409, "dieselbe abgelehnte Datei noch einmal → 409 mit Kundentext", e3);
    const e4: any = await M.globalMandatDokumentAendern(REF, fotoId, { ablehnen: "kurz" }, CHEF);
    ok(e4?.ok === false && e4.status === 400, "zu kurzer Grund wird abgewiesen", e4);
    const c: any = await chef(REF);
    const cd = (c?.dokumente ?? []).find((x: any) => Number(x.id) === fotoId);
    ok(cd?.abgelehnt?.grund === GRUND && !cd.abgelehnt.erledigt && cd.neu === false, "Chef: Foto abgelehnt (offen), gilt durch das Ablehnen als gesehen", cd);
    const cu = (c?.unterlagen ?? []).find((x: any) => x.art === "reisepass");
    ok(cu?.vorhanden === false && cu.abgelehnt?.grund === GRUND, "Chef-Akte: dieselbe Unterlagen-Rechnung (Reisepass fehlt, mit Grund)", cu);
    const ol: any[] = await L.globalBereichListe({ agentId: CHEF.id, alle: true });
    ok(ol.find((x: any) => x.ref === REF)?.offeneUnterlagen === 1, "Office-Liste: 1 offene Unterlage (nicht „von 5“)", ol.find((x: any) => x.ref === REF));
  }

  // ═══ 4 PDF-SCAN NACH ═══════════════════════════════════════════════════════
  schritt("4", "Kunde lädt einen PDF-Scan als Reisepass hoch");
  {
    const e: any = await sicher("globalKundenDokument(pdf)", () => L.globalKundenDokument(REF, { art: "reisepass", datei: { buffer: pdf("Reisepass-Scan"), originalname: "Reisepass_Scan.pdf" } }));
    ok(!!e?.ok, "PDF-Scan angenommen", e);
    scanId = Number(e?.dokument?.id ?? 0);
    const p: any = await portal(REF);
    ok(offen(p).length === 0, "Portal: nichts mehr offen", offen(p));
    ok((p?.dokumente ?? []).every((x: any) => !x.abgelehnt), "Portal: keine Marke „bitte neu“ mehr", (p?.dokumente ?? []).map((x: any) => ({ id: x.id, ab: x.abgelehnt })));
    const c: any = await chef(REF);
    const alt = (c?.dokumente ?? []).find((x: any) => Number(x.id) === fotoId);
    const neu = (c?.dokumente ?? []).find((x: any) => Number(x.id) === scanId);
    ok(alt?.abgelehnt?.erledigt === true, "Chef: altes Foto „ersetzt“ (abgelehnt.erledigt = true)", alt);
    ok(neu?.neu === true && !neu.abgelehnt, "Chef: neuer Scan neu = true", neu);
    const t = (await todos(REF)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(t.some((x) => x.status !== "erledigt"), "Upload-Aufgabe ist (wieder) offen — der Nachreich-Upload meldet sich beim Team", t.map((x) => ({ s: x.status })));
  }

  // ═══ 5 ALLE GESEHEN ════════════════════════════════════════════════════════
  schritt("5", "Chef markiert „alle gesehen“ — nur diese Akte");
  {
    const e2: any = await L.globalKundenDokument(REF2, { art: "reisepass", datei: { buffer: pdf("Akte zwei"), originalname: "Pass_zwei.pdf" } });
    ok(!!e2?.ok, "zweite Akte: Upload angenommen", e2);
    const vor2 = (await todos(REF2)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(vor2.length === 1 && vor2[0].status === "offen", "zweite Akte: Upload-Aufgabe offen", vor2);
    const n: any = await sicher("globalChefGesehen", () => M.globalChefGesehen(REF, "alle", CHEF.name));
    ok(Number(n) === 1, `globalChefGesehen meldet genau 1 Dokument (den Scan; das Foto galt durch das Ablehnen schon als gesehen) — ${n}`, n);
    const c: any = await chef(REF);
    ok((c?.dokumente ?? []).filter((x: any) => x.von === "kunde").every((x: any) => x.neu === false), "Chef: kein Kunden-Dokument mehr neu", (c?.dokumente ?? []).map((x: any) => ({ id: x.id, neu: x.neu })));
    const t = (await todos(REF)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(t.length > 0 && t.every((x) => x.status === "erledigt"), "Upload-Aufgabe(n) dieser Akte erledigt", t.map((x) => x.status));
    const t2 = (await todos(REF2)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(t2.length === 1 && t2[0].status === "offen", "Aufgabe der zweiten Akte unberührt (offen)", t2.map((x) => x.status));
    const z2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_dokumente WHERE ref = ${REF2} AND fiaon_gesehen_am IS NOT NULL`) as any[];
    ok(Number(z2[0].n) === 0, "Dokumente der zweiten Akte nicht als gesehen markiert", z2[0]);
    const c2: any = await chef(REF2);
    ok((c2?.dokumente ?? []).some((x: any) => x.neu === true), "Chef-Akte zwei: Dokument weiter neu", c2?.dokumente);
  }

  // ═══ 6 ART ÄNDERN ══════════════════════════════════════════════════════════
  schritt("6", "Art ändern bei einem „sonstiges“-Upload");
  {
    const e: any = await sicher("globalKundenDokument(sonstiges)", () => L.globalKundenDokument(REF, { art: "sonstiges", datei: { buffer: pdf("Sonstiges"), originalname: "Stromrechnung.pdf" } }));
    ok(!!e?.ok && e.dokument?.art === "sonstiges", "„sonstiges“ hochgeladen", e);
    const id = Number(e?.dokument?.id ?? 0);
    const schlecht: any = await M.globalMandatDokumentAendern(REF, id, { art: "ein_brief" }, CHEF);
    ok(schlecht?.ok === false && schlecht.status === 400, "unzulässige Art (ein_brief, legt nur FIAON ab) → 400", schlecht);
    const quatsch: any = await M.globalMandatDokumentAendern(REF, id, { art: "gibtsnicht" }, CHEF);
    ok(quatsch?.ok === false && quatsch.status === 400, "unbekannte Art → 400", quatsch);
    const post: any = await M.globalMandatDokumentAendern(REF, id, { art: "post" }, CHEF);
    ok(post?.ok === false && post.status === 400, "Art „post“ → 400", post);
    ok((await dokZeile(id))?.art === "sonstiges", "nach den Ablehnungen steht weiter „sonstiges“ in der DB");
    const gutE: any = await M.globalMandatDokumentAendern(REF, id, { art: "adressnachweis" }, CHEF);
    ok(!!gutE?.ok, "zulässige Art (adressnachweis) angenommen", gutE);
    ok((await dokZeile(id))?.art === "adressnachweis", "DB: art = adressnachweis");
    const c: any = await chef(REF);
    const d = (c?.dokumente ?? []).find((x: any) => Number(x.id) === id);
    ok(d?.art === "adressnachweis" && d.neu === false, "Chef-Akte zeigt die neue Art; Art-Korrektur gilt als gesehen", d);
    const fremd: any = await M.globalMandatDokumentAendern(REF2, id, { art: "reisepass" }, CHEF);
    ok(fremd?.ok === false && fremd.status === 404, "Dokument über FREMDE Akte nicht änderbar (404)", fremd);
  }
}

// ═══ 7 BEZAHLT ═══════════════════════════════════════════════════════════════
schritt("7", "Bezahlt-Anzeige: Chef und Portal aus derselben Quelle");
{
  const c: any = await sicher("globalMandatChefSicht", () => chef(REF));
  const p: any = await sicher("Portal-Sicht", () => portal(REF));
  ok(c?.bezahltAm === PAID_AT, `Chef-Sicht bezahltAm = paid_at (${PAID_AT})`, c?.bezahltAm);
  ok(p?.zahlung?.status === "bezahlt", "Portal: zahlung.status = bezahlt", p?.zahlung);
  ok(!!c?.bezahltAm === (p?.zahlung?.status === "bezahlt"), "beide sagen dasselbe");
  const a = ((await sqlPool`SELECT bezahlt_am FROM fiaon_global_auftraege WHERE ref = ${REF}`) as any[])[0];
  ok(a?.bezahlt_am == null, "Akte selbst hat weiterhin kein bezahlt_am (Lesen schreibt nichts)", a);
}

if (!ROT) {
  // ═══ 8 NACHRICHT ═══════════════════════════════════════════════════════════
  schritt("8", "Nachricht des Kunden → Aufgabe; gelesen → erledigt");
  {
    const e: any = await sicher("globalKundenNachricht", () => L.globalKundenNachricht(REF, { text: "Guten Tag, reicht der Scan so? Viele Grüße" }));
    ok(!!e?.ok, "Nachricht angenommen", e);
    const t = (await todos(REF)).filter((x) => /:nachricht:/.test(x.schluessel));
    ok(t.length === 1 && t[0].status === "offen" && t[0].link === chefPfad(REF), "Nachrichten-Aufgabe offen, Link ins Chefbüro", t);
    const c: any = await chef(REF);
    ok((c?.nachrichten ?? []).some((x: any) => /reicht der Scan/.test(String(x.text))), "Nachricht steht im Faden der Chef-Akte", c?.nachrichten);
    const t2 = (await todos(REF2)).filter((x) => /:eingang:/.test(x.schluessel));
    await sicher("globalMandatAnfragenGelesen", () => M.globalMandatAnfragenGelesen(REF));
    const t3 = (await todos(REF)).filter((x) => /:nachricht:/.test(x.schluessel));
    ok(t3.length === 1 && t3[0].status === "erledigt", "nach „gelesen“: Nachrichten-Aufgabe erledigt", t3.map((x) => x.status));
    const g = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_nachrichten WHERE ref = ${REF} AND von = 'kunde' AND gelesen_fiaon_am IS NULL`) as any[];
    ok(Number(g[0].n) === 0, "DB: Kundennachricht gelesen_fiaon_am gesetzt", g[0]);
    const t4 = (await todos(REF2)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(JSON.stringify(t2.map((x) => x.status)) === JSON.stringify(t4.map((x) => x.status)), "Aufgaben der zweiten Akte unberührt");
  }

  // ═══ 9 EINZELN GESEHEN, ERSETZT, ZURÜCKNEHMEN (Gegenprüfung des Praxistests) ═══
  schritt("9", "Einzeln öffnen = gesehen; ersetztes Dokument nicht mehr ablehnbar; „bitte neu“ zurücknehmen");
  {
    const vz = async (r: string) => ((await portal(r))?.verlauf ?? []).length;
    const v0 = await vz(REF);
    const e1: any = await M.globalMandatDokumentAendern(REF, fotoId, { ablehnen: "Bitte noch einmal anders scannen" }, CHEF);
    ok(e1?.ok === false && e1.status === 409, "ersetztes Foto: neues „bitte neu“ → 409", e1);
    const e2: any = await M.globalMandatDokumentAendern(REF, fotoId, { ablehnungZurueck: true }, CHEF);
    ok(e2?.ok === false && e2.status === 409, "ersetztes Foto: Rücknahme → 409", e2);
    ok((await vz(REF)) === v0, "keine neue Kunden-Verlaufszeile durch die abgewiesenen Versuche", { vorher: v0, nachher: await vz(REF) });
    const [z] = (await sqlPool`SELECT id FROM fiaon_global_dokumente WHERE ref = ${REF2} AND von = 'kunde' AND geloescht_am IS NULL ORDER BY id DESC LIMIT 1`) as any[];
    const id2 = Number(z?.id ?? 0);
    const n1: any = await sicher("globalChefGesehen([id])", () => M.globalChefGesehen(REF2, [id2], CHEF.name));
    const n2: any = await M.globalChefGesehen(REF2, [id2], CHEF.name);
    ok(Number(n1) === 1 && Number(n2) === 0, "Dokument einzeln geöffnet: einmal 1, beim zweiten Mal 0", { n1, n2 });
    const c2: any = await chef(REF2);
    ok((c2?.dokumente ?? []).find((x: any) => Number(x.id) === id2)?.neu === false, "Chef-Akte zwei: Dokument nicht mehr neu");
    const t5 = (await todos(REF2)).filter((x) => /:eingang:/.test(x.schluessel));
    ok(t5.length === 1 && t5[0].status === "erledigt", "Upload-Aufgabe der zweiten Akte erledigt", t5.map((x) => x.status));
    const ab: any = await M.globalMandatDokumentAendern(REF2, id2, { ablehnen: GRUND }, CHEF);
    ok(!!ab?.ok && offen(await portal(REF2)).length === 1, "zweite Akte: „bitte neu“ → Portal zeigt 1 offene Unterlage", ab);
    const zu: any = await M.globalMandatDokumentAendern(REF2, id2, { ablehnungZurueck: true }, CHEF);
    const p2: any = await portal(REF2);
    ok(!!zu?.ok && offen(p2).length === 0, "Rücknahme → Portal: nichts mehr offen", { zu, offen: offen(p2) });
    ok((p2?.verlauf ?? []).some((x: any) => /in Ordnung/.test(String(x.text))), "Kunde liest „… ist in Ordnung“ im Verlauf", p2?.verlauf?.slice(0, 3));
    const zu2: any = await M.globalMandatDokumentAendern(REF2, id2, { ablehnungZurueck: true }, CHEF);
    ok(zu2?.ok === true && /Nichts geändert/.test(String(zu2.meldung)), "zweite Rücknahme: „Nichts geändert.“", zu2);
  }
}

// ═══ Querschnitt ═════════════════════════════════════════════════════════════
schritt("Q", "Querschnitt: keine Netz-Aufrufe");
ok(netz.length === 0, "kein Aufruf ins Netz", netz);
console.log(`\nMails im fiaon_mail_log während des Laufs: ${(await mailZahl()) - mailVorher} (ohne BREVO_API_KEY landen Versuche dort als „fehlgeschlagen“)`);

console.log(`\n${gut} ok, ${rot.length} rot${ROT ? " (ROTPROBE: nur Schritte 1, 2, 7)" : ""}`);
for (const r of rot) console.log(`  ROT: ${r}`);
console.log(`ERGEBNIS ${JSON.stringify({ refs: [REF, REF2], schritte, ok: gut, rot: rot.length })}`);
await sqlPool.end({ timeout: 2 }).catch(() => {});
process.exit(rot.length ? 1 : 0);
