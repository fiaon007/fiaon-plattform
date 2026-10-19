// Prüfstand E-406 B2 (19.10.2026), Datenbank-Teil: Mara fordert fehlende KYC-Unterlagen nach, Vorprüfung, wer prüft,
// alte Prüf-Aufgaben umhängen, „KYC zu prüfen“ ohne Gekündigte — mit erfundenen Testkunden gegen eine LOKALE
// Prüfdatenbank. Kein Netz: Brevo ist eine Attrappe (fetch abgefangen), alles andere außer localhost ist gesperrt,
// keine KI-Schlüssel. Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   createdb -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e406b2   (danach dropdb)
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null PGSSLMODE=require \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406b2?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-kyc-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import (Muster: pruef-mara-nicht-erreicht-db.ts) ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
const BREVO: { an: string; betreff: string; html: string; text: string }[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    BREVO.push({ an: String(b.to?.[0]?.email ?? "").toLowerCase(), betreff: String(b.subject ?? ""), html: String(b.htmlContent ?? ""), text: String(b.textContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<e406b2-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 600)}` : ""}`); }
}

async function main() {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const KYC = await import("../server/lib/fiaon-mara-kyc");
  const P = await import("../server/lib/fiaon-unterlagen-pruefer");
  const U = await import("../server/lib/fiaon-unterlagen");
  const Z = await import("../server/lib/fiaon-kundenzentrale");
  const H = await import("../server/lib/fiaon-hausputz");
  const R = await import("../shared/fiaon-kyc-nachfordern");
  const LK = await import("../server/lib/fiaon-unterlagen-link");
  const N = await import("../shared/fiaon-nicht-erreicht-nachfass");

  const stempel = Date.now().toString(36).toUpperCase();
  let nr = 0;
  const mailVon = (nn: string) => `${nn.toLowerCase()}-${stempel.toLowerCase()}@e406b2.invalid`;
  const tagMs = 86_400_000;
  // Ein Takt-Zeitpunkt sicher im Fenster: jetzt (wenn offen), sonst das nächste 08:00 (+5 Min.).
  const taktZeit = () => {
    const n = new Date();
    return N.imVersandfenster(n) && N.imVersandfenster(new Date(n.getTime() + 60_000)) ? n : new Date(N.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };

  async function pdf(zeilen: string[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([595, 842]);
    zeilen.forEach((z, i) => p.drawText(z, { x: 40, y: 800 - i * 13, size: 9, font: f }));
    return Buffer.from(await doc.save());
  }
  const auszugZeilen = (vn: string, nn: string) => {
    const z = [`Kontoauszug Girokonto · Kontoinhaber ${vn} ${nn} · Musterweg 3 · 10115 Berlin`, "IBAN DE89 3704 0044 0532 0130 00 · Umsatzanzeige",
      "Buchungstag  Wertstellung  Verwendungszweck  Betrag  Saldo"];
    const start = Date.now() - 95 * tagMs;
    for (let i = 0; i < 40; i++) {
      const d = new Date(start + i * 2.3 * tagMs);
      const t = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
      z.push(`${t}  ${t}  ${i % 5 === 0 ? "Gehalt Arbeitgeber GmbH" : "Kartenzahlung Supermarkt"}  ${i % 5 === 0 ? "2.450,00" : `-${(12 + i).toFixed(2).replace(".", ",")}`}  ${(3000 - i * 11).toFixed(2).replace(".", ",")}`);
    }
    return z;
  };

  // ── Testpersonen (erfunden) ─────────────────────────────────────────────
  const person = async (vn: string, nn: string, o: {
    test?: boolean; mail?: boolean; blockiert?: boolean; werbesperre?: boolean; bezahltVorTagen?: number;
    antrag?: Record<string, unknown> | null; kyc?: string; hochgeladen?: boolean;
  } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, ist_test_am, is_blocked, werbung_gesperrt_am)
      VALUES (${`PR-E406B2-${nn}-${stempel}`}, ${vn}, ${nn}, ${o.mail === false ? null : mailVon(nn)}, ${o.test ? new Date() : null}, ${!!o.blockiert},
              ${o.werbesperre ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    let ref: string | null = null;
    if (o.antrag !== null) {
      ref = `FIAON-E406B2-${nn.toUpperCase()}-${stempel}`.slice(0, 60);
      const bezahlt = new Date(Date.now() - (o.bezahltVorTagen ?? 10) * tagMs);
      await sql`INSERT INTO fiaon_applications ${sql({
        ref, person_id: pid, type: "private", pack_key: "pro", pack_name: "FIAON Pro (Standard)", payment_status: "paid",
        paid_at: bezahlt, created_at: new Date(bezahlt.getTime() - tagMs), first_name: vn, last_name: nn,
        email: o.mail === false ? null : mailVon(nn), payment_reference: `E406B2-${++nr}-${stempel}`.slice(0, 30),
        kyc_status: o.kyc ?? "pending", documents_uploaded_at: o.hochgeladen ? new Date() : null,
        ...(o.antrag ?? {}),
      } as any)}`;
    }
    return { pid, ref: ref!, vn, nn };
  };
  const hochladen = async (p: { pid: number; vn: string; nn: string }, kategorie: "ausweis" | "kontoauszug", inhalt?: Buffer, name = "datei.pdf") => {
    const buf = inhalt ?? (kategorie === "kontoauszug" ? await pdf(auszugZeilen(p.vn, p.nn)) : await pdf([`Personalausweis Identity Card · ${p.nn.toUpperCase()} ${p.vn.toUpperCase()}`, "Geburtstag 01.01.1980 Staatsangehörigkeit DEUTSCH Gültig bis 01.01.2030", "Anschrift Musterweg 3 Ausstellungsbehörde Berlin"]));
    const r = await U.unterlageHinzufuegen({ personId: p.pid, kategorie, datei: { buffer: buf, name }, wer: { art: "kunde", name: "Kunde" }, herkunft: "portal",
      unterart: kategorie === "ausweis" ? "personalausweis" : undefined });
    return r;
  };
  /** Kein Hintergrund-Anstoß während des Prüfstands (der 45-s-Uhr kommen wir zuvor). */
  const anstossWeg = async (pid: number) => { await sql`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NULL WHERE person_id = ${pid}`; };
  const anstossJetzt = async (pid: number, k: "ausweis" | "kontoauszug") => {
    await sql`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute' WHERE person_id = ${pid} AND kategorie = ${k}`;
    return U.anstossAusfuehren(pid, k);
  };
  const anBrevo = (nn: string) => BREVO.filter((m) => m.an === mailVon(nn));
  const protokoll = async (pid: number) => (await sql`SELECT * FROM fiaon_mara_kyc WHERE person_id = ${pid} ORDER BY id`) as any[];
  const zurueckdrehen = async (pid: number, tage: number) => {
    const iv = `${tage} days`;
    await sql`UPDATE fiaon_mara_kyc SET am = am - ${iv}::interval WHERE person_id = ${pid}`;
    await sql`UPDATE fiaon_unterlagen_anfragen SET am = am - ${iv}::interval WHERE person_id = ${pid}`;
    await sql`UPDATE fiaon_mail_log SET created_at = created_at - ${iv}::interval WHERE person_id = ${pid}`;
  };

  await KYC.kycTabelle();
  await P.vorpruefTabelle();
  console.log(`(Prüfzeit ${new Date().toISOString()}, Takt-Zeit ${taktZeit().toISOString()})`);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── 1 · KYC nachfordern: die erste Erinnerung (Mail mit Upload-Link ohne Anmeldung)");
  const A = await person("Anna", "Kycprobe");
  // Ein offener Team-Auftrag „Unterlage anfordern: Ausweis“ — Maras Bitte erledigt ihn (E-397-Motor, „Unterlage angefordert“).
  const [auftrag] = (await sql`INSERT INTO fiaon_betreiber_todos (titel, text, status, zustaendig_art, zustaendig_agent_id, zustaendig_name, art, person_id, quelle, schluessel)
    VALUES ('Unterlage anfordern: Ausweis', 'Bitte den Ausweis beim Kunden anfordern.', 'offen', 'agent', 8, 'Daniel Stripling', 'unterlage', ${A.pid}, 'system', ${`e406b2-unterlage-${stempel}`})
    RETURNING id`) as any[];
  const t1 = await KYC.kycTakt({ jetzt: taktZeit() });
  const pA = await protokoll(A.pid);
  ok(anBrevo("Kycprobe").length === 1, "genau EINE Mail an den Kunden", { brevo: anBrevo("Kycprobe").length, t1 });
  ok(pA.length === 1 && pA[0].ergebnis === "gesendet" && Number(pA[0].nummer) === 1 && (pA[0].arten ?? []).join(",") === "ausweis,kontoauszug", "Protokoll: 1. Erinnerung, Ausweis + Kontoauszug", pA);
  const mA = anBrevo("Kycprobe")[0];
  ok(mA && /Noch fehlende Unterlagen/.test(mA.betreff), "Betreff der Unterlagen-Mail (documents_change_request)", mA?.betreff);
  ok(mA && /\/unterlagen\/\d+\.\d+\.[A-Za-z0-9_-]{32}/.test(mA.html) && /ohne Anmeldung/.test(mA.html), "Upload-Link ohne Anmeldung in der Mail", mA?.html?.slice(0, 300));
  ok(mA && /Kurze Erinnerung: Diese Unterlagen fehlen uns noch/.test(mA.html), "Anlass-Satz der 1. Erinnerung");
  ok(mA && /Ausweises/.test(mA.html) && /Kontoauszüge der letzten drei Monate/.test(mA.html), "Ausweis UND Kontoauszug erbeten");
  ok(mA && !/€|Preis|Frist|letzte Erinnerung/i.test(mA.text + mA.html.replace(/<[^>]+>/g, " ")), "kein Preis, keine Frist, kein „letzte Erinnerung“");
  const [anfA] = (await sql`SELECT quelle, mail_status, von FROM fiaon_unterlagen_anfragen WHERE person_id = ${A.pid} ORDER BY id DESC LIMIT 1`) as any[];
  ok(anfA?.quelle === R.KYC_QUELLE && anfA?.mail_status === "gesendet" && anfA?.von === "Mara", "fiaon_unterlagen_anfragen: Quelle mara_kyc, von Mara", anfA);
  const [logA] = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${A.pid} AND note LIKE 'Unterlagen angefordert%' ORDER BY id DESC LIMIT 1`) as any[];
  ok(!!logA, "Verlauf in der Akte: „Unterlagen angefordert …“", logA);
  const [aufA] = (await sql`SELECT status, erledigt_art FROM fiaon_betreiber_todos WHERE id = ${auftrag.id}`) as any[];
  ok(aufA?.status === "erledigt" && aufA?.erledigt_art === "auto", "Team-Auftrag „Unterlage anfordern: Ausweis“ automatisch erledigt (E-397-Motor)", aufA);

  console.log("── 2 · Nie doppelt, Abstand 4 Tage, höchstens 2 Erinnerungen");
  await KYC.kycTakt({ jetzt: taktZeit() });
  ok(anBrevo("Kycprobe").length === 1, "sofort noch ein Takt → keine zweite Mail");
  await zurueckdrehen(A.pid, 3);
  await KYC.kycTakt({ jetzt: taktZeit() });
  ok(anBrevo("Kycprobe").length === 1, "nach 3 Tagen → noch keine zweite (Abstand 4 Tage)");
  await zurueckdrehen(A.pid, 2);
  await KYC.kycTakt({ jetzt: taktZeit() });
  const pA2 = await protokoll(A.pid);
  ok(anBrevo("Kycprobe").length === 2 && pA2.filter((z) => z.ergebnis === "gesendet").length === 2 && Number(pA2[pA2.length - 1].nummer) === 2, "nach 5 Tagen → die 2. Erinnerung", pA2);
  ok(/noch einmal kurz daran erinnern/.test(anBrevo("Kycprobe")[1]?.html ?? ""), "die 2. Erinnerung klingt anders");
  await zurueckdrehen(A.pid, 9);
  await KYC.kycTakt({ jetzt: taktZeit() });
  ok(anBrevo("Kycprobe").length === 2, "nach weiteren 9 Tagen → KEINE dritte");

  console.log("── 3 · Wann Mara NICHT schreibt");
  const B = await person("Bernd", "Gekuendigtprobe", { antrag: { gekuendigt_am: new Date() } });
  const C = await person("Carla", "Testprobe", { test: true });
  const D = await person("Dirk", "Sperrprobe", { blockiert: true });
  const E = await person("Emil", "Globalprobe");
  await sql`INSERT INTO fiaon_global_angebote ${sql({ angebot_ref: `IA-BEGLEIT-E406B2-${stempel}`, fassung: `IA-BEGLEIT-${stempel}`, kunde: {}, parameter: {}, buergin: {},
    gueltig_bis: new Date(Date.now() + 30 * tagMs), person_id: E.pid, status: "angenommen" } as any)}`;
  const G = await person("Gerda", "Vollprobe");
  await hochladen(G, "ausweis"); await hochladen(G, "kontoauszug"); await anstossWeg(G.pid);
  const I = await person("Ida", "Frischprobe", { bezahltVorTagen: 2 });
  const J = await person("Jan", "Kuendigungsantragprobe");
  await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, status, reason) VALUES (${J.ref}, 'Jan', 'Kuendigungsantragprobe', ${mailVon("Kuendigungsantragprobe")}, 'pending', 'Prüfstand')`;
  const S = await person("Sven", "Storniertprobe", { antrag: { cancelled_at: new Date() } });
  const M = await person("Mia", "Ohnemailprobe", { mail: false });
  // Nachbesserung (Prüfer-Fund): ein alter Auskunft-Kauf (bis E-240: type 'private', pack_key 'schufa', Referenz FIAON-…) und
  // ein Einmalkauf (LLC-Paket) sind kein „laufender Vertrag“ — vorher bat Mara sie um Unterlagen „für Ihren laufenden Vertrag“.
  const O = await person("Olga", "Altauskunftprobe", { antrag: { pack_key: "schufa", pack_name: "FIAON-Bonitätsauswertung" } });
  const Lc = await person("Lea", "Llcprobe", { antrag: { pack_key: "llc_paket", pack_name: "GLOBAL LLC Package" } });
  const kand = new Set(((await sql.unsafe(KYC.kycKandidatenSql())) as any[]).map((z) => Number(z.person_id)));
  ok(!kand.has(O.pid), "alte Auskunft-Zeile (type private, pack_key schufa) → kein Kandidat (Produktkategorie „auskunft“)");
  ok(!kand.has(Lc.pid), "Einmalkauf (LLC-Paket) → kein Kandidat");
  ok(kand.has(M.pid) && kand.has(I.pid), "… ein Abo-Paket (pro) bleibt Kandidat");
  await KYC.kycTakt({ jetzt: taktZeit() });
  for (const [x, was] of [[B, "gekündigt"], [C, "Testkonto"], [D, "Vertriebssperre"], [E, "FIAON Global (Begleitvertrag)"], [G, "Ausweis und Kontoauszug liegen vor"],
    [I, "bezahlt vor 2 Tagen (wartet)"], [J, "Kündigungsantrag offen"], [S, "storniert"], [M, "ohne Mail-Adresse"],
    [O, "alter Auskunft-Kauf (type private, pack_key schufa)"], [Lc, "Einmalkauf LLC-Paket"]] as const) {
    ok(anBrevo(x.nn).length === 0 && (await protokoll(x.pid)).filter((z) => z.ergebnis === "gesendet").length === 0, `${was} → keine Mail`);
  }

  console.log("── 4 · Was noch fehlt — und die Werbesperre ist keine Wand (Service)");
  const F = await person("Fritz", "Teilprobe");
  await hochladen(F, "ausweis"); await anstossWeg(F.pid);
  const Hw = await person("Hanna", "Werbesperreprobe", { werbesperre: true });
  await KYC.kycTakt({ jetzt: taktZeit() });
  const pF = await protokoll(F.pid);
  ok(anBrevo("Teilprobe").length === 1 && (pF[0]?.arten ?? []).join(",") === "kontoauszug", "Ausweis liegt vor → nur der Kontoauszug wird erbeten", pF);
  ok(!/Ausweises/.test(anBrevo("Teilprobe")[0]?.html ?? "x"), "… und die Mail nennt den Ausweis nicht");
  ok(anBrevo("Werbesperreprobe").length === 1, "Werbesperre → die Bitte um die Unterlage geht trotzdem (Service, wie versandErlaubt)");
  ok(!/Kurze Erinnerung/.test(anBrevo("Werbesperreprobe")[0]?.html ?? "Kurze Erinnerung"), "… aber nur die Bitte, ohne Anlass-Satz (die Tür lässt nichts anderes durch)");
  // Sperre nur an der ADRESSE (eine zweite Person mit derselben Mail hat „Stopp“): der zweite Versuch geht als reine Bitte.
  const Q = await person("Quirin", "Adressprobe");
  await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, werbung_gesperrt_am) VALUES (${`PR-E406B2-Q2-${stempel}`}, 'Quentin', 'Adressprobe', ${mailVon("Adressprobe")}, NOW())`;
  await KYC.kycTakt({ jetzt: taktZeit() });
  ok(anBrevo("Adressprobe").length === 1 && !/Kurze Erinnerung/.test(anBrevo("Adressprobe")[0]?.html ?? "Kurze Erinnerung"), "Werbesperre an der Adresse → reine Bitte (zweiter Versuch ohne Anlass-Satz)", (await protokoll(Q.pid)));

  console.log("── 5 · Schalter, Fenster, zwei Instanzen");
  const K = await person("Karl", "Doppelprobe");
  await KYC.kycSchalterSetzen(false);
  const aus = await KYC.kycTakt({ jetzt: taktZeit() });
  ok(aus.aus && anBrevo("Doppelprobe").length === 0, "Schalter aus → nichts", aus);
  await KYC.kycSchalterSetzen(true);
  const nacht = new Date(N.naechstesFenster(new Date(taktZeit().getTime() + 13 * 3_600_000)).getTime() - 30 * 60_000);
  const n1 = await KYC.kycTakt({ jetzt: nacht });
  ok(!n1.fenster && anBrevo("Doppelprobe").length === 0, "außerhalb 08–20 Uhr → nichts", { n1, nacht });
  const [d1, d2] = await Promise.all([KYC.kycTakt({ jetzt: taktZeit() }), KYC.kycTakt({ jetzt: taktZeit() })]);
  ok(anBrevo("Doppelprobe").length === 1, "zwei Takte gleichzeitig (zwei Instanzen) → genau EINE Mail", { d1: d1.gesendet, d2: d2.gesendet, brevo: anBrevo("Doppelprobe").length });
  const pK = await protokoll(K.pid);
  ok(pK.filter((z) => ["gesendet", "sendet", "unklar"].includes(z.ergebnis)).length === 1, "… und genau EINE Protokollzeile", pK);
  // Hängengeblieben: eine Zeile „sendet“ älter als 30 Min. wird „unklar“ und zählt als gesendet (nie doppelt).
  const L0 = await person("Lena", "Haengeprobe");
  await sql`INSERT INTO fiaon_mara_kyc (person_id, ergebnis, nummer, arten, am) VALUES (${L0.pid}, 'sendet', 1, ${["ausweis"]}, NOW() - INTERVAL '2 hours')`;
  await zurueckdrehen(L0.pid, 0);
  await KYC.kycTakt({ jetzt: taktZeit() });
  const pL0 = await protokoll(L0.pid);
  ok(pL0[0]?.ergebnis === "unklar" && pL0.length === 1 && anBrevo("Haengeprobe").length === 0, "beim Senden unterbrochen → „unklar“, keine neue Mail (Abstand gilt auch ohne Anfrage-Zeile)", pL0);

  const st = await KYC.kycStand();
  ok(st.an && st.gesendet7 >= 3 && st.fehlen >= 1 && st.nachZwei >= 1 && st.heute >= 3, "Stand fürs Chefbüro (an, gesendet, fehlen, nach 2 Erinnerungen)", st);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── 6 · Vorprüfung: Notiz an der Unterlage, Aufgabe an die prüfende Person");
  const pr = await P.prueferSetzen(10);
  ok(pr.ok, "Prüferin einstellen (Leitung, nicht Inhaber)", pr);
  ok(!(await P.prueferSetzen(928)).ok, "der Inhaber kann nicht als Prüfer eingestellt werden");
  const V = await person("Vera", "Vorpruefprobe");
  const hv = await hochladen(V, "kontoauszug");
  ok(hv.ok, "Kunde lädt einen Kontoauszug hoch", hv);
  await anstossJetzt(V.pid, "kontoauszug");
  const [vpV] = (await sql`SELECT notiz, ampel, befund FROM fiaon_unterlagen_vorpruefung WHERE person_id = ${V.pid} AND kategorie = 'kontoauszug'`) as any[];
  ok(vpV && /^Kontoauszug · erkannt · lesbar/.test(vpV.notiz) && /Name passt/.test(vpV.notiz), "Vorprüfung: „Kontoauszug · erkannt · lesbar … · Name passt“", vpV);
  const [aufV] = (await sql`SELECT id, text, zustaendig_agent_id, fuer_betreiber, sicht_agenten FROM fiaon_vermerke
                             WHERE ref = ${V.ref} AND art = 'aufgabe' AND status = 'offen' AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok(aufV && Number(aufV.zustaendig_agent_id) === 10 && aufV.fuer_betreiber === false, "Aufgabe „Unterlagen eingegangen“ liegt bei der Prüferin — nicht beim Betreiber", aufV);
  ok(aufV && (aufV.sicht_agenten ?? []).map(Number).includes(10), "… und sie sieht sie (sicht_agenten)");
  ok(aufV && /Vorprüfung: Kontoauszug · erkannt/.test(aufV.text), "die Aufgabe trägt die Vorprüfung", aufV?.text);
  const [gpV] = (await sql`SELECT COUNT(*) FILTER (WHERE geprueft_am IS NOT NULL)::int AS g FROM fiaon_dokumente WHERE person_id = ${V.pid} AND art = 'unterlage'`) as any[];
  ok(Number(gpV?.g) === 0, "Mara gibt NIE frei: geprueft_am bleibt leer (Vier-Augen)");
  const stOffice = await U.unterlagenStand(V.pid, "office");
  const stKunde = await U.unterlagenStand(V.pid, "kunde");
  ok(/Name passt/.test(stOffice.kategorien.find((k) => k.kategorie === "kontoauszug")?.vorpruefung?.notiz ?? ""), "Akte (Office) zeigt die Vorprüfung an der Unterlage");
  ok(!stKunde.kategorien.some((k) => (k as any).vorpruefung), "der Kunde sieht die Vorprüfung nie");
  const gp = await U.kategorieGeprueft(V.pid, "kontoauszug", { art: "mitarbeiter", name: "Florentine Lombardi", agentId: 10 });
  const [aufV2] = (await sql`SELECT status, erledigt_art FROM fiaon_vermerke WHERE id = ${aufV?.id ?? 0}`) as any[];
  ok(gp.ok && aufV2?.status === "erledigt" && aufV2?.erledigt_art === "auto", "die Prüferin klickt „Geprüft“ → die Aufgabe geht von selbst zu (E-397)", { gp, aufV2 });
  ok(!stOffice.kategorien.find((k) => k.kategorie === "ausweis")?.vorpruefung, "ohne Datei keine Vorprüfung (Ausweis)");

  const W = await person("Willi", "Falschprobe");
  await hochladen(W, "kontoauszug", await pdf(["Rechnung Nr. 4711", "Sehr geehrte Frau Beispielname, anbei unsere Rechnung über Ihre Bestellung.", "Lieferung frei Haus, zahlbar in 14 Tagen.", "Mit freundlichen Grüßen Ihr Versandhaus"]), "rechnung.pdf");
  await anstossJetzt(W.pid, "kontoauszug");
  const [vpW] = (await sql`SELECT notiz, ampel FROM fiaon_unterlagen_vorpruefung WHERE person_id = ${W.pid} AND kategorie = 'kontoauszug'`) as any[];
  ok(vpW && vpW.ampel === "rot" && /NICHT als Kontoauszug erkannt/.test(vpW.notiz) && /Name aus der Akte NICHT gefunden/.test(vpW.notiz), "falsches Dokument, fremder Name → rot", vpW);
  const [aufW] = (await sql`SELECT dringend, zustaendig_agent_id FROM fiaon_vermerke WHERE ref = ${W.ref} AND art = 'aufgabe' AND status = 'offen' AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok(aufW?.dringend === true && Number(aufW?.zustaendig_agent_id) === 10, "… die Aufgabe ist dringend und liegt bei der Prüferin", aufW);

  const Y = await person("Yvonne", "Fotoprobe");
  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 210, b: 220 } } }).png().toBuffer();
  const hy = await hochladen(Y, "ausweis", png, "ausweis.png");
  ok(hy.ok, "Kunde lädt ein Ausweisfoto hoch", hy);
  await anstossJetzt(Y.pid, "ausweis");
  const [vpY] = (await sql`SELECT notiz, ampel FROM fiaon_unterlagen_vorpruefung WHERE person_id = ${Y.pid} AND kategorie = 'ausweis'`) as any[];
  ok(vpY && /^Ausweis/.test(vpY.notiz) && /Foto — bitte selbst ansehen|nicht prüfbar/.test(vpY.notiz) && /Name nicht prüfbar/.test(vpY.notiz), "Ausweisfoto → „bitte selbst ansehen“, Name nicht prüfbar (keine KI)", vpY);
  ok(!FREMD.some((u) => /openai|anthropic/.test(u)), "kein Aufruf an eine KI (Ausweisbilder gehen nirgends hin)", FREMD);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── 6b · Upload über den Link aus Maras Mail → Aufgabe bei der Prüferin, mit Vorprüfung, EINE je Stapel (Prüfer-Fund)");
  {
    const X = await person("Xaver", "Linkprobe");
    const anf = await LK.unterlagenAnfrageSenden({ personId: X.pid, arten: ["ausweis", "kontoauszug"], kanaele: ["mail"], quelle: "mara_kyc",
      anlassSatz: R.kycAnlassSatz(1), akteur: { name: "Mara", agentId: null, rolle: "admin" } });
    const [lx] = (await sql`SELECT link_id FROM fiaon_unterlagen_anfragen WHERE person_id = ${X.pid} AND quelle = 'mara_kyc' ORDER BY id DESC LIMIT 1`) as any[];
    ok(anf.ok && Number(lx?.link_id) > 0, "Maras Mail mit Upload-Link ist raus", { anf: anf.meldung, lx });
    const linkId = Number(lx?.link_id ?? 0);
    const r1 = await LK.unterlageAnnehmen({ personId: X.pid, art: "kontoauszug", quelle: { art: "link", linkId },
      dateien: [{ buffer: await pdf(auszugZeilen(X.vn, X.nn)), name: "auszug.pdf", mimetype: "application/pdf" }] });
    ok(r1.ok, "Kunde lädt den Kontoauszug über den Link hoch (ohne Anmeldung)", r1);
    const aufgabenX = async () => (await sql`SELECT id, text, zustaendig_agent_id, fuer_betreiber, sicht_agenten, status FROM fiaon_vermerke
      WHERE ref = ${X.ref} AND art = 'aufgabe' AND text LIKE 'Unterlagen eingegangen%' ORDER BY id`) as any[];
    const a1 = await aufgabenX();
    ok(a1.length === 1 && Number(a1[0].zustaendig_agent_id) === 10 && a1[0].fuer_betreiber === false, "Aufgabe liegt bei der Prüferin — NICHT bei Justin (vorher: fuer_betreiber, niemand zuständig)", a1);
    ok(a1.length === 1 && (a1[0].sicht_agenten ?? []).map(Number).includes(10), "… und sie sieht sie (sicht_agenten)", a1[0]?.sicht_agenten);
    ok(a1.length === 1 && /Vorprüfung: Kontoauszug · erkannt/.test(a1[0].text), "die Aufgabe trägt die Vorprüfung", a1[0]?.text);
    const [vpX] = (await sql`SELECT notiz FROM fiaon_unterlagen_vorpruefung WHERE person_id = ${X.pid} AND kategorie = 'kontoauszug'`) as any[];
    ok(vpX && /Name passt/.test(vpX.notiz), "Vorprüfung an der Unterlage geschrieben (Name aus der Akte passt)", vpX);
    const stX = await U.unterlagenStand(X.pid, "office");
    ok(/Kontoauszug · erkannt/.test(stX.kategorien.find((k) => k.kategorie === "kontoauszug")?.vorpruefung?.notiz ?? ""), "Akte (Office) zeigt die Vorprüfung des Link-Uploads");
    const r2 = await LK.unterlageAnnehmen({ personId: X.pid, art: "ausweis", quelle: { art: "link", linkId },
      dateien: [{ buffer: await pdf([`Personalausweis Identity Card · ${X.nn.toUpperCase()} ${X.vn.toUpperCase()}`, "Geburtstag 01.01.1980 Staatsangehörigkeit DEUTSCH Gültig bis 01.01.2030", "Anschrift Musterweg 3 Ausstellungsbehörde Berlin"]), name: "ausweis.pdf", mimetype: "application/pdf" }] });
    const a2 = await aufgabenX();
    ok(r2.ok && a2.filter((z) => z.status === "offen").length === 1, "danach der Ausweis über denselben Link → weiter EINE Aufgabe (je Stapel), keine zweite", a2.map((z) => z.text));
    ok(a2.length === 1 && /Ausweis: 1 Datei/.test(a2[0].text) && /Kontoauszug: 1 Datei/.test(a2[0].text) && /Vorprüfung: Ausweis/.test(a2[0].text), "… mit beiden Unterlagen und beiden Vorprüfungen", a2[0]?.text);
    await U.kategorieGeprueft(X.pid, "kontoauszug", { art: "mitarbeiter", name: "Florentine Lombardi", agentId: 10 });
    await U.kategorieGeprueft(X.pid, "ausweis", { art: "mitarbeiter", name: "Florentine Lombardi", agentId: 10 });
    const a3 = await aufgabenX();
    ok(a3.length === 1 && a3[0].status === "erledigt", "die Prüferin setzt „Geprüft“ → die Aufgabe geht von selbst zu (E-397)", a3);
    ok(Number((await sql`SELECT COUNT(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${X.pid} AND art = 'unterlage' AND geprueft_von_agent_id IS NULL AND geprueft_am IS NOT NULL`)[0]?.n) === 0,
      "Mara gibt NIE frei (geprüft hat nur die Prüferin)");
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── 7 · Alte Prüf-Aufgaben umhängen — nur mit Schalter, Probelauf, Zurückholen");
  const altVermerk = async (p: { ref: string }) => {
    const [v] = (await sql`INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, status, autor_art, autor_name, created_at)
      VALUES ('aufgabe', ${p.ref}, 'Unterlagen eingegangen (Ausweis: 1 Datei) — bitte prüfen und in der Akte unter Dokumente „Geprüft“ setzen. Der Kunde sieht „Wird geprüft“.',
              'betreiber', TRUE, 'offen', 'system', 'System', NOW() - INTERVAL '20 days') RETURNING id`) as any[];
    return Number(v.id);
  };
  const L1 = await person("Lars", "Umhaengprobe"); await hochladen(L1, "ausweis"); await anstossWeg(L1.pid);
  const L2 = await person("Lotte", "Geprueftprobe"); await hochladen(L2, "ausweis"); await anstossWeg(L2.pid);
  await U.kategorieGeprueft(L2.pid, "ausweis", { art: "mitarbeiter", name: "Florentine Lombardi", agentId: 10 });
  const L3 = await person("Linus", "Testumhaengprobe", { test: true }); await hochladen(L3, "ausweis"); await anstossWeg(L3.pid);
  const L4 = await person("Luise", "Gekuendigtumhaengprobe", { antrag: { gekuendigt_am: new Date() } }); await hochladen(L4, "ausweis"); await anstossWeg(L4.pid);
  const v1 = await altVermerk(L1), v2 = await altVermerk(L2), v3 = await altVermerk(L3), v4 = await altVermerk(L4);
  const zeilen = await P.umhaengenZeilen();
  const passt = (id: number) => zeilen.find((z) => z.id === id)?.passt;
  ok(passt(v1) === true && passt(v2) === false && passt(v3) === false && passt(v4) === false, "Probelauf: nur die Aufgabe mit Ungeprüftem, laufendem Vertrag, kein Testkonto", { v1: passt(v1), v2: passt(v2), v3: passt(v3), v4: passt(v4) });
  const pl = await P.umhaengenProbelauf();
  ok(pl.umhaengen >= 1 && pl.beiJustin >= 4, "Probelauf-Zahl fürs Chefbüro", pl);
  const vorher = (await sql`SELECT id, zustaendig_agent_id, fuer_betreiber FROM fiaon_vermerke WHERE id = ANY(${[v1, v2, v3, v4]}::int[]) ORDER BY id`) as any[];
  const r0 = await P.umhaengenAusfuehren({ von: "Prüfstand" });
  const nach0 = (await sql`SELECT id, zustaendig_agent_id, fuer_betreiber FROM fiaon_vermerke WHERE id = ANY(${[v1, v2, v3, v4]}::int[]) ORDER BY id`) as any[];
  ok(!r0.ok && r0.grund === "Schalter aus" && JSON.stringify(vorher) === JSON.stringify(nach0), "Schalter AUS (Standard) → nichts umgehängt", r0);
  await P.umhaengenSchalterSetzen(true);
  const r1 = await P.umhaengenAusfuehren({ von: "Prüfstand" });
  const [w1] = (await sql`SELECT zustaendig_agent_id, fuer_betreiber FROM fiaon_vermerke WHERE id = ${v1}`) as any[];
  const andere = (await sql`SELECT COUNT(*) FILTER (WHERE fuer_betreiber)::int AS n FROM fiaon_vermerke WHERE id = ANY(${[v2, v3, v4]}::int[])`) as any[];
  ok(r1.ok && r1.umgehaengt >= 1 && Number(w1?.zustaendig_agent_id) === 10 && w1?.fuer_betreiber === false, "Schalter AN → die Aufgabe hängt an der Prüferin", { r1, w1 });
  ok(Number(andere[0]?.n) === 3, "geprüft, Testkonto und gekündigt bleiben (die schließt der Hausputz)");
  const [lg] = (await sql`SELECT regel, aktion, ziel_id, vorher FROM fiaon_hausputz_log WHERE lauf_id = ${r1.laufId ?? 0} AND zeile_id = ${v1}`) as any[];
  ok(lg?.regel === "unterlagen_pruefer" && lg?.aktion === "umhaengen" && Number(lg?.ziel_id) === 10 && (typeof lg?.vorher === "string" ? JSON.parse(lg.vorher) : lg?.vorher)?.fuer_betreiber === true,
    "Protokoll im Hausputz-Motor mit dem Zustand vorher", lg);
  const laeufe = await P.umhaengenLaeufe();
  ok(laeufe.some((l) => l.id === r1.laufId && l.umgehaengt >= 1), "der Lauf steht in der Liste (für „Zurückholen“)", laeufe);
  const zr = await H.hausputzZurueckholen({ laufId: r1.laufId! }, "Prüfstand");
  const [w2] = (await sql`SELECT zustaendig_agent_id, fuer_betreiber FROM fiaon_vermerke WHERE id = ${v1}`) as any[];
  ok(zr.zurueck >= 1 && w2?.zustaendig_agent_id == null && w2?.fuer_betreiber === true, "Zurückholen → wieder beim Betreiber", { zr, w2 });
  const r2 = await P.umhaengenAusfuehren({ von: "Prüfstand" });
  const [w3] = (await sql`SELECT fuer_betreiber FROM fiaon_vermerke WHERE id = ${v1}`) as any[];
  ok(w3?.fuer_betreiber === true && !(await P.umhaengenZeilen()).find((z) => z.id === v1)?.passt, "einmal zurückgeholt → hängt nie wieder um (kein Pendeln)", { r2, w3 });
  await P.umhaengenSchalterSetzen(false);

  console.log("── 7b · Der große erste Lauf bleibt erreichbar: Takt-Runden = ein Lauf je Tag, „Alle zurückholen“ (Prüfer-Fund)");
  {
    const T = await person("Theo", "Taktprobe"); await hochladen(T, "ausweis"); await anstossWeg(T.pid);
    await P.umhaengenSchalterSetzen(true);
    const vGross = await altVermerk(T);
    const gross = await P.umhaengenAusfuehren({ von: "Prüfstand" });
    ok(gross.ok && gross.umgehaengt >= 1 && !!gross.laufId, "der große erste Lauf (Chefbüro)", gross);
    const taktIds: number[] = [];
    for (let i = 0; i < 11; i++) {
      taktIds.push(await altVermerk(T));
      await P.umhaengenTakt();
    }
    const taktLaeufe = (await sql`SELECT DISTINCT lauf_id FROM fiaon_hausputz_log WHERE zeile_id = ANY(${taktIds}::int[]) AND tabelle = 'vermerk' AND regel = 'unterlagen_pruefer'`) as any[];
    ok(taktLaeufe.length === 1, "11 Takt-Runden am selben Tag → EIN Lauf (vorher: 11 Läufe)", taktLaeufe.map((z) => Number(z.lauf_id)));
    const umgehaengtT = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_vermerke WHERE id = ANY(${taktIds}::int[]) AND zustaendig_agent_id = 10 AND fuer_betreiber = FALSE`) as any[];
    ok(Number(umgehaengtT[0]?.n) === 11, "… und alle 11 Aufgaben hängen an der Prüferin", umgehaengtT[0]);
    const liste = await P.umhaengenLaeufe();
    ok(liste.some((l) => l.id === gross.laufId), "der große erste Lauf steht weiter in der Liste („Zurückholen“ erreichbar)", liste.map((l) => l.id));
    const takt1 = liste.find((l) => l.id === Number(taktLaeufe[0]?.lauf_id));
    ok(!!takt1 && takt1.umgehaengt >= 11, "der Takt-Lauf zählt alle Runden zusammen", takt1);
    const offen = typeof (P as any).umhaengenOffen === "function" ? await (P as any).umhaengenOffen() : null;
    ok(offen && offen.aufgaben >= 12 && offen.laeufe >= 2, "Zahl für „Alle zurückholen“ (jeder Lauf der 30 Tage)", offen);
    const alle = typeof (P as any).umhaengenAllesZurueck === "function" ? await (P as any).umhaengenAllesZurueck("Prüfstand") : null;
    const zurueckT = (await sql`SELECT COUNT(*) FILTER (WHERE fuer_betreiber AND zustaendig_agent_id IS NULL)::int AS n FROM fiaon_vermerke WHERE id = ANY(${[vGross, ...taktIds]}::int[])`) as any[];
    ok(!!alle && alle.zurueck >= 12 && Number(zurueckT[0]?.n) === 12, "„Alle zurückholen“ → alle 12 wieder beim Betreiber, aus beiden Läufen", { alle, zurueckT: zurueckT[0] });
    ok(!(await P.umhaengenSchalterLesen()) && (offen ? (await (P as any).umhaengenOffen()).aufgaben === 0 : false), "… der Schalter ist aus, nichts mehr offen");
    await P.umhaengenTakt();
    const [nochT] = (await sql`SELECT COUNT(*) FILTER (WHERE fuer_betreiber)::int AS n FROM fiaon_vermerke WHERE id = ANY(${[vGross, ...taktIds]}::int[])`) as any[];
    ok(Number(nochT?.n) === 12, "der Takt hängt danach nichts wieder um", nochT);
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── 8 · „KYC zu prüfen“: nur laufende Verträge, Gekündigte fallen heraus, der Status bleibt");
  const KY1 = await person("Kai", "Kyclaufprobe", { hochgeladen: true });
  const KY2 = await person("Kim", "Kycgekuendigtprobe", { hochgeladen: true, antrag: { gekuendigt_am: new Date() } });
  const KY3 = await person("Kurt", "Kycstornoprobe", { hochgeladen: true, antrag: { cancelled_at: new Date() } });
  const KY4 = await person("Kora", "Kyczurueckprobe", { hochgeladen: true, antrag: { gekuendigt_am: new Date(Date.now() - 5 * tagMs), kuendigung_zurueckgenommen_am: new Date() } });
  const ids = await Z.alleTrefferIds({ kycOffen: true } as any);
  ok(ids.includes(KY1.pid), "laufender Vertrag → in der Liste");
  ok(!ids.includes(KY2.pid), "gekündigt → nicht mehr in der Liste (E-397 übersah das)");
  ok(!ids.includes(KY3.pid), "storniert → nicht in der Liste");
  ok(ids.includes(KY4.pid), "Kündigung zurückgenommen → wieder in der Liste");
  const [kyc2] = (await sql`SELECT kyc_status FROM fiaon_applications WHERE person_id = ${KY2.pid}`) as any[];
  ok(kyc2?.kyc_status === "pending", "der kyc_status bleibt gespeichert");

  ok(FREMD.length === 0 || FREMD.every((u) => !/brevo/.test(u)), "kein Netz außer der Brevo-Attrappe", FREMD.slice(0, 5));
  console.log(`\n${gut} ✓ · ${schlecht} ✗`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
