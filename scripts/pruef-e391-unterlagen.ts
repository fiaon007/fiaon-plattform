// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-391 (16.10.2026, Team-Meldung Florentine): „Bei Unterlagen was Falsches hochgeladen, gerade beim
// Ausweis, und ich kann es nicht entfernen.“ — die „Bisherige Unterlage“ (Bestand nur in der Spalte, id null)
// bekommt Entfernen; ein entfernter letzter Ausweis nimmt KYC-Freigabe, Sichtprüfung und Prüfurteil zurück.
//
// Teil 1 — ohne Datenbank (immer): Quelltext-Belege (Funktion, Routen mit denselben Rechten wie die
//   Schwesterrouten, Knopf im Client bei id null, Kunde ohne Knopf, Rundgang).
// Teil 2 — gegen eine LOKALE Prüfstand-Datenbank (nur 127.0.0.1/localhost), nur erfundene Personen:
//   A  Ausweis nur in der Spalte, KYC freigegeben, Sichtprüfung, Prüfurteil → bestandEntfernen
//   B  zwei Ausweis-Dateien, eine entfernen → KYC, Sichtprüfung, Urteil bleiben
//   D  zwei Bestandsfassungen (zwei Bestellungen) → beide entfernt, danach KYC zurück
//   C  Kontoauszug-Bestand über die Chefbüro-Route (HTTP) → Spalte leer, kein KYC-Eingriff
//   Office-Route ohne Anmeldung → abgewiesen (requireAgent)
//
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e391u?sslmode=require' \
//     DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e391u?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-e391-unterlagen.ts
// Ohne lokale DATABASE_URL läuft nur Teil 1. Keine Mail, keine KI: Schlüssel und Webhooks werden geleert.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const echteDb = /@(127\.0\.0\.1|localhost):\d+\//.test(String(process.env.DATABASE_URL || "")) && !/\/(x|keine)(\?|$)/.test(String(process.env.DATABASE_URL || ""));
process.env.DATABASE_URL ||= "postgresql://pruefstand@127.0.0.1:1/x";
process.env.SESSION_SECRET ||= "pruefstand-e391";
for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "BREVO_API_KEY", "MAKE_WEBHOOK_URL"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = ""): void {
  if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Der Block einer Route: vom router.post(…) bis zum nächsten router.-Aufruf. */
function routenBlock(quelle: string, kopf: string): string {
  const a = quelle.indexOf(kopf);
  if (a < 0) return "";
  const b = quelle.indexOf("\nrouter.", a + kopf.length);
  return quelle.slice(a, b < 0 ? undefined : b);
}

async function main() {
  // ═══ TEIL 1 — OFFLINE ═════════════════════════════════════════════════════
  console.log("── 1 · Die Funktion (server/lib/fiaon-unterlagen.ts)");
  const lib = lies("server/lib/fiaon-unterlagen.ts");
  const fn = lib.slice(lib.indexOf("export async function bestandEntfernen"), lib.indexOf("export async function bestandEntfernen") + 3200);
  ok(fn.length > 100, "bestandEntfernen ist exportiert");
  ok(/await bestandUebernehmen\(personId, k, lauf\)/.test(fn) && /unterlageEntfernen\(personId, Number\(z\.id\), wer, g, lauf, \{ grundArt: opt\.grundArt \}\)/.test(fn),
    "erst übernehmen (bestandUebernehmen), dann der EINE Weg unterlageEntfernen mit grundArt");
  ok(/herkunft IN \('bestand', 'fremd'\)/.test(fn), "entfernt nur die gerade übernommenen Fassungen (herkunft bestand/fremd)");
  ok(/wer\.art === "kunde"\) return \{ ok: false, status: 403/.test(fn), "Kunde: 403");
  ok(/istEntfernGrundArt\(opt\.grundArt\)/.test(fn) && /g\.length < 5/.test(fn), "Grund-Art Pflicht, Grund ≥ 5 Zeichen");
  const bestandBlock = lib.slice(lib.indexOf("// Bestand: Inhalt in der Spalte"), lib.indexOf("// E-IT-C Nachbesserung: der JÜNGSTE Upload"));
  ok(/id: null/.test(bestandBlock) && /darfEntfernen: sicht === "office"/.test(bestandBlock), "Stand: „Bisherige Unterlage“ id null, darfEntfernen nur im Office");
  const ent = lib.slice(lib.indexOf("export async function unterlageEntfernen"), lib.indexOf("export async function bestandEntfernen"));
  ok(/k === "ausweis"\s*\?\s*await ausweisFolgenNachEntfernen/.test(ent), "unterlageEntfernen: Ausweis-Folgen für BEIDE Wege (Datei und Bestand)");
  ok(/kyc_status = 'pending'/.test(ent) && !/admin_reviewed_at\s*=/.test(ent), "KYC approved → pending, admin_reviewed_at bleibt unangetastet");
  ok(/fiaon_unterlagen_sichtpruefung SET widerrufen_am = NOW\(\)/.test(ent) && /DELETE FROM fiaon_dokument_pruefungen\s+WHERE art = 'ausweis'/.test(ent),
    "Sichtprüfung über widerrufen_am (wie sichtpruefungZuruecknehmen), Ausweis-Urteil verworfen");

  console.log("── 2 · Die Routen (server/routes/fiaon-unterlagen.ts) — Rechte wie die Schwesterrouten");
  const routen = lies("server/routes/fiaon-unterlagen.ts");
  const officeSchwester = routenBlock(routen, 'router.post("/agent/unterlagen/:personId/datei/:id/entfernen"');
  const office = routenBlock(routen, 'router.post("/agent/unterlagen/:personId/:kategorie/bestand/entfernen"');
  const adminSchwester = routenBlock(routen, 'router.post("/admin/unterlagen/:ref/datei/:id/entfernen"');
  const admin = routenBlock(routen, 'router.post("/admin/unterlagen/:ref/:kategorie/bestand/entfernen"');
  ok(office.length > 0 && admin.length > 0, "Office- und Chefbüro-Route da");
  ok(/requireAgent, async/.test(office) && /const z = await officeZutritt\(req, res\);\s*if \(!z\) return;/.test(office), "Office: requireAgent + officeZutritt (Betreuer oder Leitung, darfAnKunde) wie die Schwester");
  const antwort = (b: string) => (b.match(/res\.json\(\{ ok: true, meldung: erg\.satz, stand: .*\}\);/) ?? [""])[0];
  ok(antwort(office) !== "" && antwort(office) === antwort(officeSchwester), "Office: dieselbe Antwort (meldung, stand, inhaltErlaubt, darfEndgueltig)");
  ok(/res\.status\(erg\.status\)\.json\(\{ ok: false, error: erg\.satz \}\)/.test(office) && /"Serverfehler"/.test(office), "Office: dieselben Fehlerformen");
  ok(/const personId = await adminPerson\(req, res\);\s*if \(!personId\) return;/.test(admin) && /VERWALTUNG/.test(admin), "Chefbüro: adminPerson + VERWALTUNG wie die Schwester");
  ok(antwort(admin) !== "" && antwort(admin) === antwort(adminSchwester), "Chefbüro: dieselbe Antwort wie die Schwester");
  ok(/bestandKategorieAus\(req\)/.test(office) && /bestandKategorieAus\(req\)/.test(admin) && /k && istGebunden\(k\)/.test(routen), "nur gebundene Kategorien (nicht „Weitere“)");
  const haupt = lies("server/routes.ts");
  const gate = haupt.indexOf("app.use('/api/fiaon', fiaonZugangRoutes.adminCodeGate)");
  const mount = haupt.indexOf("app.use('/api/fiaon', fiaonUnterlagen.default)");
  ok(gate > 0 && mount > gate, "Chefbüro-Route liegt unter /api/fiaon/admin hinter dem adminCodeGate (eingehängt davor)");
  ok(!/kategorieLeeren/.test(office + admin), "kein Rückgriff auf kategorieLeeren (/agent/dokumente/…/loeschen)");

  console.log("── 3 · Der Client");
  const akte = lies("client/src/components/unterlagen/UnterlagenAkte.tsx");
  ok(/`\/\$\{weg\.kategorie\}\/bestand\/entfernen`/.test(akte) && /`\/datei\/\$\{weg\.id\}\/entfernen`/.test(akte), "Entfernen wählt Bestand- oder Datei-Route; Basis wie bisher (Office /agent, Chefbüro /admin)");
  ok(/const basis = adminRef \? `\/api\/fiaon\/admin\/unterlagen\//.test(akte), "Office- vs. Chefbüro-Variante über dieselbe basis");
  ok(/d\.id != null \|\| \(d\.herkunft === "bestand" && d\.darfEntfernen\)/.test(akte) && /\{darfWeg\(d\) && <button/.test(akte), "Knopf „Entfernen“ auch bei id null (Bestand, darfEntfernen)");
  ok(/`bestand-\$\{d\.kategorie\}`/.test(akte), "Zustandsschlüssel bestand-<kategorie>");
  ok(/\{d\.id != null && <button[^>]*data-fiaon="unterlage-umordnen-knopf"/.test(akte), "Umordnen bleibt nur bei echten Dateien");
  ok(/if \(j\?\.ok\) \{ setWeg\(null\); if \(j\.stand\) setStand\(j\.stand\)/.test(akte), "danach Stand aus der Antwort (wie beim normalen Entfernen)");
  const kunde = lies("client/src/components/unterlagen/UnterlagenListe.tsx");
  ok(/d\.darfEntfernen && d\.id != null/.test(kunde) && !/bestand\/entfernen/.test(kunde), "Kundenbereich: kein Knopf für Bestand (id null)");
  const rundgang = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Auch eine „Bisherige Unterlage“ nimmst du mit „Entfernen“ heraus/.test(rundgang), "Rundgang „Unterlagen“ nachgezogen");

  // ═══ TEIL 2 — LOKALE DATENBANK ════════════════════════════════════════════
  if (!echteDb) {
    console.log("\n(Teil 2 übersprungen: keine lokale DATABASE_URL — nie gegen die Produktion.)");
  } else {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const { sqlPool } = await import("../server/lib/db-pool");
    const U = await import("../server/lib/fiaon-unterlagen");
    const lauf = sqlPool;
    const kennung = `E391${Date.now().toString(36).toUpperCase()}`;
    console.log(`\n── 4 · Datenbank (${kennung}, nur erfundene Personen)`);
    ok(await U.unterlagenBereit(), "Ablage bereit (Migration 099)");

    async function pdf(zeilen: string[]): Promise<Buffer> {
      const doc = await PDFDocument.create();
      const f = await doc.embedFont(StandardFonts.Helvetica);
      const p = doc.addPage([595, 842]);
      zeilen.forEach((z, i) => p.drawText(z, { x: 40, y: 800 - i * 14, size: 9, font: f }));
      return Buffer.from(await doc.save());
    }
    const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    const personen: number[] = [];
    const neuePerson = async (nr: string): Promise<number> => {
      const [p] = (await lauf`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email)
                              VALUES (${`${kennung}-${nr}`}, 'Erika', 'Prüfstand', ${`${kennung.toLowerCase()}-${nr}@example.invalid`}) RETURNING id`) as any[];
      personen.push(Number(p.id));
      return Number(p.id);
    };
    const neueBestellung = async (personId: number, ref: string, tageAlt = 10): Promise<void> => {
      await lauf`INSERT INTO fiaon_applications (ref, payment_reference, person_id, type, payment_status, status, first_name, last_name, email, created_at)
                 VALUES (${ref}, ${ref}, ${personId}, 'ultra', 'paid', 'completed', 'Erika', 'Prüfstand', ${`${ref.toLowerCase()}@example.invalid`}, NOW() - make_interval(days => ${tageAlt}))`;
    };
    const team = { art: "mitarbeiter" as const, name: "Prüfstand Team", agentId: null };
    const kunde = { art: "kunde" as const, name: "Kunde" };
    const verlaufTexte = async (personId: number): Promise<string[]> =>
      ((await lauf`SELECT note FROM fiaon_contact_log WHERE person_id = ${personId} ORDER BY id`) as any[]).map((r) => String(r.note));

    // ── A: Ausweis nur in der Spalte, freigegeben, von Hand geprüft, mit Prüfurteil ──
    const A = await neuePerson("A");
    const refA = `FIAON-${kennung}-A`;
    await neueBestellung(A, refA);
    const ausweisA = await pdf(["PERSONALAUSWEIS / IDENTITY CARD", `Erika Prüfstand ${kennung}`, "erfundenes Muster — kein echtes Dokument"]);
    await lauf`UPDATE fiaon_applications SET id_card_pdf = ${ausweisA}, documents_uploaded_at = NOW() - INTERVAL '20 days',
                      kyc_status = 'approved', admin_reviewed_at = NOW() - INTERVAL '5 days' WHERE ref = ${refA}`;
    const [vorA] = (await lauf`SELECT admin_reviewed_at FROM fiaon_applications WHERE ref = ${refA}`) as any[];
    await lauf`INSERT INTO fiaon_unterlagen_sichtpruefung (person_id, art, doc_hash, dokumenttyp, von) VALUES (${A}, 'ausweis', ${sha(ausweisA)}, 'personalausweis', 'Prüfstand Leitung')`;
    await lauf`INSERT INTO fiaon_dokument_pruefungen (ref, art, urteil)
               VALUES (${refA}, 'ausweis', ${lauf.json({ art: "ausweis", erkannt: true, vollstaendig: true, hinweisIntern: "Personalausweis erkannt (Prüfstand)" } as any)})`;

    let sA = await U.unterlagenStand(A, "office");
    let awA = sA.kategorien.find((k) => k.kategorie === "ausweis")!;
    ok(awA.dateien.length === 1 && awA.dateien[0].id === null && awA.dateien[0].herkunft === "bestand" && awA.dateien[0].darfEntfernen === true,
      "Office sieht „Bisherige Unterlage“ (id null) — jetzt mit darfEntfernen");
    ok(awA.geprueft === true, "vorher: Ausweis gilt als geprüft (KYC-Freigabe)");
    const kA = (await U.unterlagenStand(A, "kunde")).kategorien.find((k) => k.kategorie === "ausweis")!;
    ok(kA.dateien[0]?.darfEntfernen === false, "Kunde: Bestand ohne darfEntfernen");

    let e = await U.bestandEntfernen(A, "ausweis", kunde, "vom Kunden versucht", lauf, { grundArt: "falsche_person" });
    ok(!e.ok && e.status === 403, "Kunde darf Bestand nicht entfernen (403)");
    e = await U.bestandEntfernen(A, "ausweis", team, "falsche Person im Ausweis", lauf, { grundArt: "irgendwas" });
    ok(!e.ok && e.status === 400, "ohne gültige Grund-Art: 400");
    e = await U.bestandEntfernen(A, "ausweis", team, "kurz", lauf, { grundArt: "falsche_person" });
    ok(!e.ok && e.status === 400, "Grund unter fünf Zeichen: 400");
    const [nochDa] = (await lauf`SELECT LENGTH(id_card_pdf) AS n, kyc_status FROM fiaon_applications WHERE ref = ${refA}`) as any[];
    ok(Number(nochDa.n) > 0 && nochDa.kyc_status === "approved", "abgewiesene Versuche ändern nichts");

    e = await U.bestandEntfernen(A, "ausweis", team, "Ausweis einer anderen Person (Prüfstand)", lauf, { grundArt: "falsche_person" });
    ok(e.ok, "Team entfernt die bisherige Unterlage", e.ok ? e.satz : e.satz);
    ok(e.ok && /Bisherige Unterlage/.test(e.satz) && /kein Ausweis mehr vor/.test(e.satz), "Meldung nennt Bestand und die Ausweis-Folgen", e.satz);
    const [spA] = (await lauf`SELECT id_card_pdf IS NULL AS leer, kyc_status, admin_reviewed_at FROM fiaon_applications WHERE ref = ${refA}`) as any[];
    ok(spA.leer === true, "Spalte id_card_pdf ist NULL");
    ok(spA.kyc_status === "pending", `kyc_status approved → pending (${spA.kyc_status})`);
    ok(new Date(spA.admin_reviewed_at).getTime() === new Date(vorA.admin_reviewed_at).getTime(), "admin_reviewed_at unverändert");
    const zA = (await lauf`SELECT herkunft, entfernt_am, entfernt_von, entfernt_grund, LENGTH(inhalt) AS n, doc_hash FROM fiaon_dokumente
                           WHERE person_id = ${A} AND art = 'unterlage' AND kategorie = 'ausweis'`) as any[];
    ok(zA.length === 1 && zA[0].herkunft === "bestand" && !!zA[0].entfernt_am && zA[0].entfernt_von === "Prüfstand Team", "Bestand als Zeile übernommen und entfernt (entfernt_am, von)");
    ok(zA[0]?.doc_hash === sha(ausweisA) && Number(zA[0]?.n) === 0 && /^Falsche Person: /.test(String(zA[0]?.entfernt_grund)), "„Falsche Person“: Inhalt sofort gelöscht, Prüfsumme und Grund bleiben");
    const [siA] = (await lauf`SELECT widerrufen_am FROM fiaon_unterlagen_sichtpruefung WHERE person_id = ${A}`) as any[];
    ok(!!siA?.widerrufen_am, "Sichtprüfung widerrufen (widerrufen_am gesetzt)");
    const [urA] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokument_pruefungen WHERE ref = ${refA} AND art = 'ausweis'`) as any[];
    ok(Number(urA.n) === 0, "Ausweis-Urteil verworfen");
    const vA = await verlaufTexte(A);
    ok(vA.some((t) => /^Ausweis: Datei „bisherige-ausweis-.*“ entfernt \(von Prüfstand Team\)\. Grund: Falsche Person: /.test(t)), "Verlauf: Entfernen mit Grund");
    ok(vA.some((t) => /^Ausweis: Es liegt kein Ausweis mehr vor — KYC-Freigabe zurückgesetzt.*Sichtprüfung von Hand widerrufen \(Personalausweis.*Urteil der automatischen Ausweisprüfung verworfen: „Personalausweis erkannt \(Prüfstand\)“/.test(t)),
      "Verlauf: KYC, Sichtprüfung und Urteil zurückgenommen", vA.join(" | "));
    sA = await U.unterlagenStand(A, "office");
    awA = sA.kategorien.find((k) => k.kategorie === "ausweis")!;
    ok(awA.dateien.length === 0 && awA.entfernte?.length === 1 && awA.entfernte[0].inhaltGeloescht === true, "Akte: keine Datei mehr, unter „Entfernt“ mit „Inhalt gelöscht“");
    ok(awA.geprueft === false && awA.status !== "liegt_vor", `Akte: Ausweis nicht mehr „geprüft“ (${awA.statusText})`);
    const [akA] = (await lauf`SELECT anstoss_faellig_am, anstoss_von FROM fiaon_unterlagen_akte WHERE person_id = ${A} AND kategorie = 'ausweis'`) as any[];
    ok(!!akA?.anstoss_faellig_am && akA.anstoss_von === "mitarbeiter", "Anstoß geplant wie beim normalen Entfernen (kein „Unterlagen eingegangen“)");
    e = await U.bestandEntfernen(A, "ausweis", team, "noch einmal entfernen", lauf, { grundArt: "falsche_person" });
    ok(!e.ok && e.status === 404, "zweiter Aufruf: nichts mehr da (404)");

    // ── B: zwei Ausweis-Dateien, eine entfernen → nichts zurücknehmen ──
    const B = await neuePerson("B");
    const refB = `FIAON-${kennung}-B`;
    await neueBestellung(B, refB);
    const altB = await pdf(["REISEPASS / PASSPORT", `falsche Datei ${kennung}`, "erfundenes Muster"]);
    await lauf`UPDATE fiaon_applications SET id_card_pdf = ${altB}, documents_uploaded_at = NOW() - INTERVAL '20 days',
                      kyc_status = 'approved', admin_reviewed_at = NOW() - INTERVAL '5 days' WHERE ref = ${refB}`;
    await lauf`INSERT INTO fiaon_unterlagen_sichtpruefung (person_id, art, doc_hash, dokumenttyp, von) VALUES (${B}, 'ausweis', ${sha(altB)}, 'reisepass', 'Prüfstand Leitung')`;
    await lauf`INSERT INTO fiaon_dokument_pruefungen (ref, art, urteil) VALUES (${refB}, 'ausweis', ${lauf.json({ art: "ausweis", erkannt: true, vollstaendig: true } as any)})`;
    const neuB = await pdf(["REISEPASS / PASSPORT", `richtige Datei ${kennung}`, "P<D<<PRUEFSTAND<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<<"]);
    const h = await U.unterlageHinzufuegen({ personId: B, kategorie: "ausweis", unterart: "reisepass", datei: { buffer: neuB, name: "pass-richtig.pdf" }, wer: team, herkunft: "mitarbeiter" });
    ok(h.ok, "B: Team lädt den richtigen Ausweis hoch (Bestand wird dabei Zeile)");
    const zB = (await lauf`SELECT id, herkunft FROM fiaon_dokumente WHERE person_id = ${B} AND art = 'unterlage' AND kategorie = 'ausweis' AND entfernt_am IS NULL ORDER BY id`) as any[];
    ok(zB.length === 2 && zB[0].herkunft === "bestand", `B: zwei Ausweis-Dateien (${zB.map((z) => z.herkunft).join(", ")})`);
    e = await U.bestandEntfernen(B, "ausweis", team, "falsche Datei entfernen", lauf, { grundArt: "veraltet" });
    ok(!e.ok && e.status === 409, "B: Bestand ist schon Zeile → bestandEntfernen sagt „neu laden“ (409), entfernt nichts");
    e = await U.unterlageEntfernen(B, Number(zB[0].id), team, "falsches Dokument, richtiges liegt daneben", lauf, { grundArt: "veraltet" });
    ok(e.ok && !/kein Ausweis mehr/.test(e.ok ? e.satz : ""), "B: eine von zwei Dateien entfernt, keine Ausweis-Folgen in der Meldung");
    const [spB] = (await lauf`SELECT kyc_status, LENGTH(id_card_pdf) AS n FROM fiaon_applications WHERE ref = ${refB}`) as any[];
    ok(spB.kyc_status === "approved" && Number(spB.n) > 0, "B: KYC bleibt freigegeben, Spalte trägt die verbliebene Datei");
    const [siB] = (await lauf`SELECT widerrufen_am FROM fiaon_unterlagen_sichtpruefung WHERE person_id = ${B}`) as any[];
    const [urB] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokument_pruefungen WHERE ref = ${refB} AND art = 'ausweis'`) as any[];
    ok(siB.widerrufen_am === null && Number(urB.n) === 1, "B: Sichtprüfung und Urteil unangetastet (der Anstoß prüft neu)");
    ok(!(await verlaufTexte(B)).some((t) => /kein Ausweis mehr vor/.test(t)), "B: kein Verlaufssatz „kein Ausweis mehr“");
    const [zBalt] = (await lauf`SELECT LENGTH(inhalt) AS n, entfernt_am FROM fiaon_dokumente WHERE id = ${zB[0].id}`) as any[];
    ok(!!zBalt.entfernt_am && Number(zBalt.n) > 0, "B: „Veraltet“ hält den Inhalt im Archiv (Frist 90 Tage)");

    // ── D: zwei Bestandsfassungen an zwei Bestellungen → beide weg, dann KYC zurück ──
    const D = await neuePerson("D");
    const refD1 = `FIAON-${kennung}-D1`; const refD2 = `FIAON-${kennung}-D2`;
    await neueBestellung(D, refD1, 30);
    await neueBestellung(D, refD2, 10);
    await lauf`UPDATE fiaon_applications SET id_card_pdf = ${await pdf(["PERSONALAUSWEIS Vorderseite", kennung])}, kyc_status = 'approved', admin_reviewed_at = NOW() - INTERVAL '9 days' WHERE ref = ${refD1}`;
    await lauf`UPDATE fiaon_applications SET id_card_pdf = ${await pdf(["PERSONALAUSWEIS anderer Scan", kennung])}, kyc_status = 'approved', admin_reviewed_at = NOW() - INTERVAL '3 days' WHERE ref = ${refD2}`;
    e = await U.bestandEntfernen(D, "ausweis", team, "beide Fassungen veraltet", lauf, { grundArt: "veraltet" });
    ok(e.ok && /^2 bisherige Fassungen entfernt/.test(e.ok ? e.satz : ""), "D: zwei Bestandsfassungen in einem Schritt entfernt", e.satz);
    const spD = (await lauf`SELECT id_card_pdf IS NULL AS leer, kyc_status FROM fiaon_applications WHERE person_id = ${D}`) as any[];
    ok(spD.every((z) => z.leer === true && z.kyc_status === "pending"), "D: beide Spalten leer, beide KYC zurück auf pending");
    const zD = (await lauf`SELECT entfernt_am, LENGTH(inhalt) AS n FROM fiaon_dokumente WHERE person_id = ${D} AND art = 'unterlage' AND kategorie = 'ausweis'`) as any[];
    ok(zD.length === 2 && zD.every((z) => !!z.entfernt_am && Number(z.n) > 0), "D: beide als Zeilen entfernt, „Veraltet“ → Inhalt im Archiv");
    ok((await verlaufTexte(D)).filter((t) => /kein Ausweis mehr vor/.test(t)).length === 1, "D: genau ein Satz „kein Ausweis mehr“ (erst nach der letzten Datei)");

    // ── C: Kontoauszug-Bestand über die Chefbüro-Route (HTTP), Ausweis daneben bleibt ──
    const C = await neuePerson("C");
    const refC = `FIAON-${kennung}-C`;
    await neueBestellung(C, refC);
    const auszugC = await pdf(["Kontoauszug Girokonto IBAN DE00 0000 0000 0000 0000 00", "Buchungstag Wertstellung Betrag Saldo", "01.06.2026 Lastschrift Muster 12,34 1000,00"]);
    const ausweisC = await pdf(["PERSONALAUSWEIS / IDENTITY CARD", `bleibt ${kennung}`]);
    await lauf`UPDATE fiaon_applications SET bank_statement_pdf = ${auszugC}, id_card_pdf = ${ausweisC}, documents_uploaded_at = NOW() - INTERVAL '20 days',
                      kyc_status = 'approved', admin_reviewed_at = NOW() - INTERVAL '5 days' WHERE ref = ${refC}`;
    await lauf`INSERT INTO fiaon_unterlagen_sichtpruefung (person_id, art, doc_hash, dokumenttyp, von) VALUES (${C}, 'ausweis', ${sha(ausweisC)}, 'personalausweis', 'Prüfstand Leitung')`;

    const express = (await import("express")).default;
    const router = (await import("../server/routes/fiaon-unterlagen")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/fiaon", router);
    const server = await new Promise<import("node:http").Server>((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const port = (server.address() as import("node:net").AddressInfo).port;
    const post = async (pfad: string, body: unknown) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/fiaon${pfad}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, j: (await r.json().catch(() => null)) as any };
    };
    let r = await post(`/admin/unterlagen/${refC}/weitere/bestand/entfernen`, { grund: "kein Bestand bei Weitere", grundArt: "veraltet" });
    ok(r.status === 400 && r.j?.ok === false, "Chefbüro-Route: „Weitere“ hat keinen Bestand (400)");
    r = await post(`/admin/unterlagen/${refC}/kontoauszug/bestand/entfernen`, { grund: "x", grundArt: "veraltet" });
    ok(r.status === 400 && /begründen/.test(String(r.j?.error)), "Chefbüro-Route: Grund zu kurz → 400 mit Satz", JSON.stringify(r.j));
    r = await post(`/admin/unterlagen/${refC}/kontoauszug/bestand/entfernen`, { grund: "alter Auszug vom Juni, veraltet", grundArt: "veraltet" });
    ok(r.status === 200 && r.j?.ok === true && typeof r.j?.meldung === "string" && r.j?.stand?.darfEndgueltig === true && r.j?.stand?.inhaltErlaubt === true,
      "Chefbüro-Route: 200, { ok, meldung, stand (inhaltErlaubt, darfEndgueltig) }", JSON.stringify(r.j).slice(0, 200));
    const kaC = (r.j?.stand?.kategorien ?? []).find((k: any) => k.kategorie === "kontoauszug");
    ok(kaC && kaC.dateien.length === 0 && kaC.entfernte?.length === 1, "C: Stand in der Antwort — Kontoauszug ohne Datei, eine unter „Entfernt“");
    const [spC] = (await lauf`SELECT bank_statement_pdf IS NULL AS k_leer, LENGTH(id_card_pdf) AS a_n, kyc_status FROM fiaon_applications WHERE ref = ${refC}`) as any[];
    ok(spC.k_leer === true, "C: Spalte bank_statement_pdf ist NULL");
    ok(Number(spC.a_n) > 0 && spC.kyc_status === "approved", "C: Ausweis-Spalte und KYC unangetastet");
    const [siC] = (await lauf`SELECT widerrufen_am FROM fiaon_unterlagen_sichtpruefung WHERE person_id = ${C}`) as any[];
    ok(siC.widerrufen_am === null, "C: Sichtprüfung des Ausweises unangetastet");
    const zC = (await lauf`SELECT herkunft, entfernt_am, LENGTH(inhalt) AS n, entfernt_von FROM fiaon_dokumente WHERE person_id = ${C} AND art = 'unterlage' AND kategorie = 'kontoauszug'`) as any[];
    ok(zC.length === 1 && zC[0].herkunft === "bestand" && !!zC[0].entfernt_am && Number(zC[0].n) > 0 && zC[0].entfernt_von === "Verwaltung", "C: Zeile entfernt von „Verwaltung“, Inhalt 90 Tage im Archiv");
    ok(!(await verlaufTexte(C)).some((t) => /kein Ausweis mehr vor/.test(t)) && (await verlaufTexte(C)).some((t) => /^Kontoauszug: Datei „bisherige-kontoauszug-/.test(t)), "C: Verlauf nur zum Kontoauszug");
    const aufAusweis = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${C} AND kategorie = 'ausweis'`) as any[];
    ok(Number(aufAusweis[0].n) === 0, "C: Ausweis-Bestand wurde nicht angefasst (keine Zeile übernommen)");

    // ── Office-Route: ohne Anmeldung kein Zutritt ──
    r = await post(`/agent/unterlagen/${C}/ausweis/bestand/entfernen`, { grund: "ohne Anmeldung versucht", grundArt: "falsche_person" });
    ok(r.status === 401 || r.status === 403, `Office-Route ohne Anmeldung abgewiesen (HTTP ${r.status})`);
    const [spC2] = (await lauf`SELECT LENGTH(id_card_pdf) AS n FROM fiaon_applications WHERE ref = ${refC}`) as any[];
    ok(Number(spC2.n) > 0, "… und der Ausweis liegt noch da");
    await new Promise((fertig) => server.close(() => fertig(null)));

    // Aufräumen: nur die eigenen Prüfstand-Zeilen (die Datenbank wird danach ohnehin gelöscht)
    await lauf`DELETE FROM fiaon_dokumente WHERE person_id = ANY(${personen})`;
    await lauf`DELETE FROM fiaon_unterlagen_akte WHERE person_id = ANY(${personen})`;
    await lauf`DELETE FROM fiaon_unterlagen_sichtpruefung WHERE person_id = ANY(${personen})`;
    await lauf`DELETE FROM fiaon_contact_log WHERE ref LIKE ${`%${kennung}%`}`;
    await lauf`DELETE FROM fiaon_vermerke WHERE ref LIKE ${`%${kennung}%`}`.catch(() => {});
    await lauf`DELETE FROM fiaon_dokument_pruefungen WHERE ref LIKE ${`%${kennung}%`}`.catch(() => {});
    await lauf`DELETE FROM fiaon_app_ereignisse WHERE person_id = ANY(${personen})`.catch(() => {});
    await lauf`DELETE FROM fiaon_applications WHERE ref LIKE ${`%${kennung}%`}`;
    await lauf`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch(() => {});
    await sqlPool.end({ timeout: 5 });
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden${echteDb ? "" : " (offline)"}`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
