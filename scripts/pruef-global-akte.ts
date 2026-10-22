// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE VOLLSTÄNDIGE AKTE EINES GLOBAL-KUNDEN (22.10.2026)
//
// Ohne Argument rein — keine Datenbank, kein Netz. Prüft:
//   1  RECHNUNGEN  welche Bestellzeile dazugehört (Global ja, Einzelrechnungen ja, Privat-Linie und Kooperation nie),
//                  Status offen/bezahlt/storniert, Titel
//   2  UNTERSCHRIFT Formulare SS-4/8821 ab Gründung, weitere Dokumente, Stand (fehlt · vorbereitet · wartet ·
//                  unterschrieben), Vollständigkeit
//   3  ZIP         Dateinamen ASCII, ohne Pfad, eindeutig
//   4  VERDRAHTUNG Routen mit Zutritt (Token/Chef/Office), Bindung an das Mandat, Migration 124,
//                  Portal und Chefbüro zeigen alles
//   5  GEGENPROBE
//
// Mit `--lokal <REF>` zusätzlich NUR LESEND gegen eine lokale Datenbank (DATABASE_URL muss auf 127.0.0.1 zeigen):
// Rechnungen, Verträge und Pflichtstand eines Mandats, und das ZIP als Vorschau (kein Verlaufseintrag).
//
//   env -i HOME=$HOME PATH=$PATH npx tsx scripts/pruef-global-akte.ts
//   env -i HOME=$HOME PATH=$PATH PGSSLMODE=require DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<db> npx tsx scripts/pruef-global-akte.ts --lokal FIAON-…
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
const lokal = process.argv.indexOf("--lokal");
const LOKAL_REF = lokal > 0 ? String(process.argv[lokal + 1] ?? "") : "";
if (LOKAL_REF) {
  if (!/@127\.0\.0\.1:|@localhost:/.test(String(process.env.DATABASE_URL ?? ""))) { console.error("ABBRUCH: --lokal nur gegen eine lokale Datenbank."); process.exit(3); }
} else process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const A = await import("../shared/fiaon-global-akte");
const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

// ═══ 1 RECHNUNGEN ═════════════════════════════════════════════════════════════
abschnitt("1 Rechnungen");
for (const k of ["global_struktur", "global_vip", "global_individuell", "global_zusatz_domain", "llc_fasttrack", "llc_gruendung", "llc_gruendung_halb", "llc_paket"]) ok(A.globalAkteRechnungGehoertDazu(k), `gehört dazu: ${k}`);
for (const k of ["start", "pro", "ultra", "highend", "schufa", "auskunft_privat", "business_pro", "koop_kontakte", "", "gibtsnicht"]) ok(!A.globalAkteRechnungGehoertDazu(k), `nie in der Global-Akte: ${k || "(leer)"}`);
gleich(["global_kapital", "global_individuell", "global_zusatz_website", "llc_fasttrack"].map(A.globalAkteRechnungArt), ["paket", "angebot", "zusatz", "einzel"], "Art je Zeile");
gleich([A.globalAkteRechnungStatus("paid"), A.globalAkteRechnungStatus("pending_payment"), A.globalAkteRechnungStatus("claimed_paid"), A.globalAkteRechnungStatus("cancelled"), A.globalAkteRechnungStatus("paid", null, "2026-10-01"), A.globalAkteRechnungStatus("pending_payment", "2026-10-01")],
  ["bezahlt", "offen", "offen", "storniert", "storniert", "storniert"], "Status: gemeldet bleibt offen, erstattet/storniert = storniert");
gleich(A.globalAkteRechnungTitel("global_zusatz_domain", "x", "de"), "Ihre Domain & E-Mail", "Titel Zusatzdienst aus dem Katalog");
gleich(A.globalAkteRechnungTitel("llc_fasttrack", "x"), "Fast-Track Gründung US-Gesellschaft", "Titel Einzelrechnung aus dem Katalog");
gleich(A.globalAkteRechnungTitel("global_individuell", "FIAON Global – Firmenangebot"), "FIAON Global – Firmenangebot", "Angebot: Name an der Zeile");

// ═══ 2 DOKUMENTE ZUR UNTERSCHRIFT ═════════════════════════════════════════════
abschnitt("2 Dokumente zur Unterschrift");
gleich(A.GLOBAL_PFLICHT_UNTERLAGEN.map((p) => p.key), ["irs_ss4", "irs_8821"], "Formulare: IRS SS-4 und IRS 8821 — keine eigene Vollmacht (rechtliche Prüfung)");
ok(!JSON.stringify(A.GLOBAL_PFLICHT_UNTERLAGEN).toLowerCase().includes("umfassende vollmacht"), "keine „Umfassende Vollmacht“ mehr");
ok(A.GLOBAL_PFLICHT_UNTERLAGEN.every((p) => p.abGruendung), "beide Formulare erst nach der Gründung");
gleich(A.globalPflichtFuer(null, { gegruendet: false, bereit: [] }).length, 0, "vor der Gründung: nichts");
gleich(A.globalPflichtFuer(null, { gegruendet: true, bereit: [] }).map((p) => p.key), ["irs_ss4", "irs_8821"], "nach der Gründung: beide");
gleich(A.globalPflichtFuer(null, { gegruendet: false, bereit: ["irs_8821"] }).map((p) => p.key), ["irs_8821"], "vor der Gründung, aber vom Team abgelegt: dieses");
const L = A.GLOBAL_PFLICHT_UNTERLAGEN;
const st = (doks: Parameters<typeof A.globalPflichtStand>[1]) => A.globalPflichtStand(L, doks);
gleich(st([]).eintraege.map((e) => e.stand), ["fehlt", "fehlt"], "nichts da: alles fehlt");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: false, sichtbar: true }]).eintraege[1].stand, "wartet", "zur Unterschrift: wartet");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: false, unterschrieben: false, sichtbar: false }]).eintraege[1].stand, "vorbereitet", "intern abgelegt: vorbereitet");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: true, sichtbar: true }]).eintraege[1], { key: "irs_8821", stand: "unterschrieben", dokumentId: 1 }, "Original unterschrieben");
gleich(st([{ id: 9, pflichtKey: "irs_8821", unterschriftGefordert: false, unterschrieben: true, sichtbar: true, vonId: 1 }]).eintraege[1].stand, "fehlt", "die unterschriebene KOPIE zählt nicht als Original");
const weitere = st([{ id: 5, pflichtKey: null, unterschriftGefordert: true, unterschrieben: false, sichtbar: true, titel: "Bankformular" }]);
gleich(weitere.eintraege[2], { key: "dok-5", stand: "wartet", dokumentId: 5, titel: "Bankformular" }, "jedes andere Dokument „zur Unterschrift“ kommt dazu");
const alle = L.map((p, i) => ({ id: i + 1, pflichtKey: p.key, unterschriftGefordert: true, unterschrieben: true, sichtbar: true }));
gleich([st(alle).vollstaendig, st(alle).offen], [true, 0], "alles unterschrieben: vollständig (grün)");
gleich(A.globalPflichtStand([], []).vollstaendig, false, "nichts zu unterschreiben ist nie „vollständig“");

// ═══ 2b VON HAND UNTERSCHREIBEN (SS-4, 8821) ══════════════════════════════════
abschnitt("2b Von Hand unterschreiben");
ok(A.GLOBAL_PFLICHT_UNTERLAGEN.every((p) => p.modus === "handschriftlich"), "IRS SS-4 und 8821: immer von Hand (Tinte, Registered Agent)");
gleich([A.unterschriftModus("irs_ss4", "digital"), A.unterschriftModus(null, "handschriftlich"), A.unterschriftModus(null, null), A.unterschriftModus(null, "quatsch")], ["handschriftlich", "handschriftlich", "digital", "digital"], "Modus: Formular gewinnt immer, sonst gespeichert, Vorgabe digital");
const pdfKopf = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
ok(A.istPdfInhalt(pdfKopf) && !A.istPdfInhalt([0xff, 0xd8, 0xff, 0xe0, 0, 0]) && !A.istPdfInhalt([]) && !A.istPdfInhalt(null), "nur ein PDF-Kopf (%PDF-) zählt");
ok(A.istBildInhalt([0xff, 0xd8, 0xff, 0xe0]) && A.istBildInhalt([0x89, 0x50, 0x4e, 0x47]) && A.istBildInhalt([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]) && !A.istBildInhalt(pdfKopf), "JPEG, PNG, HEIC als Foto erkannt");
for (const sp of ["de", "en"] as const) {
  const W = A.HANDSCHRIFT_WOERTER[sp];
  ok(W.schritte.length === 4, `${sp}: vier Schritte`);
  ok(sp === "de" ? W.nurPdf === "Bitte als PDF scannen – Fotos werden nicht angenommen." : /PDF/.test(W.nurPdf), `${sp}: der Satz für Fotos`);
}
{
  const { wandPruefen } = await import("../shared/fiaon-wortverbote");
  const { GLOBAL_SCHAERFER, globalWortPruefenEn } = await import("../shared/fiaon-global-wortregeln");
  const sammeln = (o: unknown, aus: string[]) => { if (typeof o === "string") aus.push(o); else if (typeof o === "function") aus.push(String((o as (x: string) => string)("Formular"))); else if (o && typeof o === "object") Object.values(o).forEach((x) => sammeln(x, aus)); };
  const de: string[] = []; const en: string[] = []; sammeln(A.HANDSCHRIFT_WOERTER.de, de); sammeln(A.HANDSCHRIFT_WOERTER.en, en);
  for (const t of de) { const f = [...wandPruefen(t, ["aufgabe_an_betreuer"]).map((x) => x.hinweis), ...GLOBAL_SCHAERFER.filter((r) => r.muster.test(t)).map((r) => r.grund)]; ok(f.length === 0, `Wortwahl de: „${t.slice(0, 50)}“`, f.join("; ")); ok(!/\b(du|dein|dich|dir)\b/i.test(t), `Sie-Form: „${t.slice(0, 40)}“`); }
  for (const t of en) { const f = globalWortPruefenEn(t); ok(f.length === 0, `Wortwahl en: „${t.slice(0, 50)}“`, f.map((x) => x.hinweis).join("; ")); }
  ok(/^https:\/\/support\.apple\.com\//.test(A.HANDSCHRIFT_SCAN_HILFE.iphone) && /^https:\/\/www\.howtogeek\.com\//.test(A.HANDSCHRIFT_SCAN_HILFE.android), "Scan-Hilfe: Apple und Android");
}

// ═══ 2c BEGLEIT-AKTE UND ANGEBOTS-NAMEN ════════════════════════════════════════
abschnitt("2c Begleit-Akte, Angebots-Namen");
const kz = (ref: string, packKey: string, createdAt: string, extra: Partial<Parameters<typeof A.begleitAkteAnker>[0][number]> = {}) => ({ ref, packKey, createdAt, paymentStatus: "pending_payment", cancelled: false, merged: false, archived: false, ...extra });
gleich(A.begleitAkteAnker([kz("B", "llc_gruendung_halb", "2026-10-09T10:00:00Z"), kz("A", "llc_paket", "2026-10-08T10:00:00Z"), kz("C", "llc_fasttrack", "2026-10-22T10:00:00Z")]), "A", "Anker: die älteste Einzelrechnung");
gleich(A.begleitAkteAnker([kz("A", "llc_paket", "2026-10-08T10:00:00Z", { cancelled: true }), kz("B", "llc_gruendung_halb", "2026-10-09T10:00:00Z", { paymentStatus: "superseded" }), kz("C", "llc_fasttrack", "2026-10-22T10:00:00Z")]), "C", "stornierte/abgelöste Zeilen sind kein Anker");
gleich(A.begleitAkteAnker([kz("P", "pro", "2026-01-01T00:00:00Z"), kz("G", "global_struktur", "2026-01-02T00:00:00Z"), kz("K", "koop_kontakte", "2026-01-03T00:00:00Z")]), null, "Privat-Abo, Paket und Kooperation sind nie Anker");
gleich(A.begleitAkteAnker([kz("A", "llc_paket", "2026-10-08T10:00:00Z", { merged: true }), kz("B", "llc_paket", "2026-10-08T10:00:00Z", { archived: true })]), null, "zusammengeführt/archiviert: kein Anker");
{
  const d = A.begleitAkteDaten({ fassung: "IA-BEGLEIT-2026-10", kunde: { art: "privat", anrede: "Herr", vorname: "Max", nachname: "Muster", email: " M@Example.com ", strasse: "Weg 1", plz: "8000", ort: "Zürich", land: "ch", telefon: "+41 79" }, parameter: { bundesstaat: "Florida" }, schalter: { llc: { wunsch: "MUSTER LLC" } } });
  gleich([d.name, d.email, d.land, (d.firma as any).art, (d.ansprechpartner as any).nachname, d.gesellschaft], ["Max Muster", "m@example.com", "CH", "privat", "Muster", { name: "MUSTER LLC", bundesstaat: "FL", geprueft: false }], "Akte-Daten aus dem Begleit-Angebot (Privatperson, Wunschname, Staat)");
  gleich(A.begleitAkteDaten({ fassung: "x", kunde: {}, parameter: {}, schalter: {} }).gesellschaft, null, "ohne Wunschname keine Gesellschaft");
}
{
  const M = await import("../shared/fiaon-global-mandat");
  gleich(M.globalAngebotKundeAnzeige({ art: "firma", firma: { name: "Muster Agentur GmbH", marke: "Muster" }, vertretung: { vorname: "Erika", nachname: "Muster" } }), { name: "Erika Muster", firma: "Muster Agentur GmbH" }, "Firmenangebot: Person + Firma (kein [object Object])");
  gleich(M.globalAngebotKundeAnzeige(JSON.stringify(JSON.stringify({ vorname: "Max", nachname: "Beispiel" }))), { name: "Max Beispiel", firma: null }, "doppelt kodierter Text wird gelesen");
  gleich(M.globalAngebotKundeAnzeige({ firma: "Partner AG", vorname: "", nachname: "" }), { name: "Partner AG", firma: "Partner AG" }, "nur Firma: Firma als Name");
  gleich(M.globalAngebotKundeAnzeige(null), { name: "—", firma: null }, "leer: Gedankenstrich");
  ok(!/\[object Object\]/.test(JSON.stringify(M.globalAngebotKundeAnzeige({ firma: { foo: 1 }, name: { x: 1 } }))), "nie „[object Object]“");
}

// ═══ 3 ZIP ═══════════════════════════════════════════════════════════════════
abschnitt("3 ZIP");
gleich(A.akteDateiname("FIAON Global – Gründung Ä/ö:x?.pdf"), "FIAON Global - Gruendung Ae_oe_x_.pdf", "Dateiname: ASCII, Umlaute ausgeschrieben, keine Pfadzeichen");
gleich(A.akteDateiname("../../etc/passwd"), "_.._etc_passwd", "kein Pfad aus dem ZIP heraus");
gleich(A.akteDateiname(""), "Dokument", "leer → Ersatzname");
ok(A.akteDateiname("x".repeat(500)).length <= 120, "höchstens 120 Zeichen");
{ const set = new Set<string>(); gleich([A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "b")], ["a.pdf", "a (2).pdf", "a (3).pdf", "b"], "gleiche Namen werden durchnummeriert"); }

// ═══ 4 VERDRAHTUNG ═══════════════════════════════════════════════════════════
abschnitt("4 Verdrahtung");
const lib = datei("server/lib/fiaon-global-akte-komplett.ts");
const bereich = datei("server/routes/fiaon-global-bereich.ts");
const chef = datei("server/routes/fiaon-chef-global.ts");
const chefQuelle = () => chef;
ok(/globalAkteRechnungGehoertDazu\(z\.pack_key\)/.test(lib) && /merged_into IS NULL AND archived_at IS NULL/.test(lib), "Rechnungen: Regel aus shared, keine zusammengeführten/archivierten Zeilen");
ok(/person_id = \$\{m\.personId\}::int/.test(lib) && /lower\(trim\(email\)\) = \$\{m\.email\}::text/.test(lib), "Rechnungen der Person: person_id, sonst E-Mail");
const pdf = lib.slice(lib.indexOf("export async function globalAkteRechnungPdf"), lib.indexOf("// ── 2 VERTRÄGE"));
ok(/\(await rechnungenRoh\(m\)\)\.find\(\(x\) => x\.bestellRef === bestellRef\)/.test(pdf), "Rechnungs-PDF nur, wenn sie zur Liste DIESES Mandats gehört");
ok(/!\/\^IA-KOOP\/i\.test/.test(lib), "Kooperationsverträge gehören nicht in die Kundenakte (E-423)");
ok(!/globalVollmacht|vollmacht-freigabe/.test(lib + chefQuelle()), "keine Vollmacht-Vorlage und kein Freigabe-Schalter mehr");
ok(/gegruendet: m\.gegruendet/.test(lib) && /fuer === "team" \|\| d\.sichtbar_fuer_kunde/.test(lib), "Formulare ab Gründung; Kunde sieht nur sichtbare Dokumente");
ok(/unterschrift_nachweis JSONB/.test(lib), "Datenmodell: leerer Nachweis für die spätere E-SIGN-Scheibe");
ok(/fuer === "kunde" && !d\.sichtbar_fuer_kunde && d\.von !== "kunde"/.test(lib), "Kunden-ZIP: nur, was der Kunde sieht");
ok(/new ZipArchive\(/.test(lib) && /zip\.pipe\(res\)/.test(lib) && /00 Inhaltsverzeichnis\.pdf/.test(lib), "ZIP gestreamt mit Inhaltsverzeichnis");
ok(/art: "akte_zip"/.test(lib) && /if \(!wer\.vorschau\)/.test(lib), "jeder ZIP-Abruf steht intern im Verlauf (Vorschau nicht)");
for (const r of ["/global/mein-auftrag/:ref/rechnung/:bestell", "/global/mein-auftrag/:ref/vertrag/:id", "/global/mein-auftrag/:ref/akte.zip"]) {
  const block = bereich.slice(bereich.indexOf(`router.get("${r}"`));
  ok(bereich.includes(`router.get("${r}"`) && block.indexOf("akteZutritt(req, res)") > 0 && block.indexOf("akteZutritt(req, res)") < 200, `Kunde ${r}: Token-Zutritt zuerst`);
}
ok(/zipJeRef\(ref\)/.test(bereich), "Kunden-ZIP gedrosselt");
ok(/"\/agent\/global\/auftraege\/:ref\/akte\.zip", requireAgent/.test(bereich) && /await office\(req, res, false\)/.test(bereich.slice(bereich.indexOf('"/agent/global/auftraege/:ref/akte.zip"'))), "Office-ZIP: Zuständigkeit wie die Akte");
for (const r of ["/akte\"", "/akte.zip\"", "/dokument/:id/pflicht\"", "/rechnung/:bestell\"", "/vertrag/:id\""]) ok(chef.includes(`"/chef/global/mandate/:ref${r}, requireChef("leitung")`), `Chef-Route ${r.replace(/"/g, "")}`);
ok(/if \(b\.pflichtKey && !pflicht\) return res\.status\(400\)/.test(chef), "unbekanntes Formular beim Hochladen abgelehnt");
const mig = datei("db/migrations/124_global_pflicht_unterlagen.sql");
ok(/ADD COLUMN IF NOT EXISTS pflicht_key TEXT/.test(mig) && /ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB/.test(mig) && /pflicht_key TEXT, ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB/.test(lib), "Migration 124 = Laufzeit");
const portal = datei("client/src/pages/global-portal.tsx");
ok(/data-fiaon="portal-rechnungen"/.test(portal) && /data-fiaon="portal-vertraege"/.test(portal) && /data-fiaon="portal-pflicht"/.test(portal) && /data-fiaon="portal-zip"/.test(portal) && /data-fiaon="portal-einzelleistungen"/.test(portal), "Portal: Rechnungen, Verträge, Vollmachten, ZIP, weitere Leistungen");
ok(/w\.pflichtTun\(p\.titel\)/.test(portal) && /setDialog\(d\)/.test(portal), "Portal: Pflichtunterlage unter „Für Sie zu tun“ → Unterschrift im Dialog");
const cg = datei("client/src/components/admin/ChefGlobal.tsx");
ok(/key: "akte", titel: "Akte komplett"/.test(cg) && /reiter === "akte" && <AkteKomplett/.test(cg) && /data-fiaon="chef-akte-zip"/.test(cg), "Chefbüro: Reiter „Akte komplett“ mit ZIP");
ok(/data-fiaon="office-akte-zip"/.test(datei("client/src/pages/agent/global-akte.tsx")), "Office: „Akte als ZIP“");
ok(!/vollmacht-freigabe/.test(datei("client/src/components/admin/ChefGlobalEinstellungen.tsx")), "Chefbüro: kein Vollmacht-Schalter");

{
  const mlib = datei("server/lib/fiaon-global-mandat.ts");
  const kunde = mlib.slice(mlib.indexOf("export async function globalKundeUnterschreibt"));
  ok(kunde.indexOf("=== \"handschriftlich\") return nein(409") > 0 && kunde.indexOf("=== \"handschriftlich\") return nein(409") < kunde.indexOf("PDFDocument.load"), "Zeichenfeld-Weg lehnt von Hand zu unterschreibende Formulare ab");
  const scan = lib.slice(lib.indexOf("export async function globalScanHochladen"));
  ok(scan.indexOf("!== \"handschriftlich\"") > 0 && scan.indexOf("istPdfInhalt(") > 0 && scan.indexOf("istPdfInhalt(") < scan.indexOf("dokumentSpeichern("), "Scan: nur handschriftliche Dokumente, nur PDF — geprüft VOR dem Speichern");
  ok(/SS-4 unterschrieben – an den Registered Agent \(Ablageteam\) per E-Mail zurücksenden/.test(scan) && /unterschrift_nachweis = \$\{sqlPool\.json\(nachweis/.test(scan), "Scan: Aufgabe SS-4 an das Ablageteam, Nachweis gespeichert");
  const r = bereich.slice(bereich.indexOf('router.post("/global/mein-auftrag/:ref/unterschrift/:id/scan"'));
  ok(r.indexOf("zutritt(req, res)") > 0 && r.indexOf("zutritt(req, res)") < r.indexOf("istVorschau(req)") && r.indexOf("istVorschau(req)") < r.indexOf("uploadJeRef(ref)") && r.indexOf("uploadJeRef(ref)") < r.indexOf("dateiAnnehmen"), "Kunden-Scan: Token → Vorschau → Drossel → Körper");
  ok(bereich.includes('"/agent/global/auftraege/:ref/dokument/:id/scan", requireAgent') && chef.includes('"/chef/global/mandate/:ref/dokument/:id/scan", requireChef("leitung")'), "Team lädt den Scan im Namen des Kunden hoch (Chefbüro, Office)");
  ok(chef.includes('"/chef/global/angebote/:id/akte", requireChef("leitung")') && /globalBegleitAkteAnlegen/.test(lib), "Chef-Knopf „Global-Akte anlegen“ (Begleit)");
  const anlegen = lib.slice(lib.indexOf("export async function globalBegleitAkteAnlegen"));
  ok(anlegen.indexOf("WHERE angebot_id = ${angebotId}") > 0 && anlegen.indexOf("WHERE angebot_id = ${angebotId}") < anlegen.indexOf("INSERT INTO fiaon_global_auftraege") && /ON CONFLICT \(ref\) DO NOTHING/.test(anlegen), "Begleit-Akte wiederholbar (erst prüfen, ON CONFLICT)");
  ok(!/UPDATE fiaon_global_angebote SET auftrag_ref/.test(anlegen), "auftrag_ref am Begleit-Angebot bleibt leer (kein Stundenlauf/Startgespräch des Individualangebots)");
  ok(/NOT EXISTS \(SELECT 1 FROM fiaon_global_auftraege g WHERE g\.angebot_id = a\.id\)/.test(mlib), "mit Akte steht das Angebot nicht mehr unter „Angebote in Arbeit“");
  const portalQ = datei("client/src/pages/global-portal.tsx");
  ok(/dialog\.unterschrift\?\.modus === "handschriftlich" && \(\s*<HandschriftDialog/.test(portalQ) && /dialog\.unterschrift\?\.modus !== "handschriftlich" && \(\s*<UnterschriftDialog/.test(portalQ), "Portal: von Hand → vier Schritte, nie das Zeichenfeld");
  const hd = datei("client/src/pages/global-portal-handschrift.tsx");
  ok(/accept="application\/pdf,\.pdf"/.test(hd) && /istPdfInhalt\(kopf\)/.test(hd) && !/canvas|Zeichenfeld/.test(hd.replace(/\/\/.*$/gm, "")), "Fenster: nur PDF, Kopf geprüft, kein Zeichenfeld");
}

// ═══ 4b LOKAL (nur lesend) ═══════════════════════════════════════════════════
if (LOKAL_REF) {
  abschnitt(`4b Lokal: ${LOKAL_REF}`);
  const K = await import("../server/lib/fiaon-global-akte-komplett");
  const r = await K.globalAkteRechnungen(LOKAL_REF, (b) => `/x/${b}`);
  ok(r.length > 0, "Rechnungen gefunden", String(r.length));
  console.log(r.map((x: any) => `    ${x.nummer ?? x.bestellRef} · ${x.titel} · ${x.betragCents} · ${x.status}`).join("\n"));
  ok(!r.some((x: any) => /FIAON Pro|Kooperation/.test(String(x.titel))), "keine Privat-Linie, keine Kooperation");
  const pf = await K.globalPflichtSicht(LOKAL_REF, "kunde");
  ok(!!pf && Array.isArray(pf.eintraege), "Pflichtstand gelesen");
  let bytes = 0; const kopf: Record<string, string> = {};
  const fake = Object.assign(new Writable({ write(c, _e, cb) { bytes += c.length; cb(); } }), {
    setHeader: (k: string, v: string) => { kopf[k.toLowerCase()] = v; }, status: () => fake, json: () => fake, headersSent: false,
  }) as any;
  await K.globalAkteZip(LOKAL_REF, "kunde", fake, { name: "Prüfstand", agentId: null, vorschau: true });
  await new Promise((res) => setTimeout(res, 300));
  ok(kopf["content-type"] === "application/zip" && bytes > 1000, "ZIP gestreamt", `${bytes} Bytes`);
}

// ═══ 5 GEGENPROBE ════════════════════════════════════════════════════════════
abschnitt("5 Gegenprobe");
ok(!A.globalAkteRechnungGehoertDazu("pro"), "Gegenprobe: ein Privat-Abo kommt nie in die Global-Akte");
ok(A.globalPflichtStand(L, [{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: false, sichtbar: true }]).vollstaendig === false, "Gegenprobe: eine wartende Unterschrift ist nicht vollständig");
ok(A.globalPflichtFuer(null).length === 0, "Gegenprobe: ohne Gründung erscheint kein Formular");
if (!LOKAL_REF) ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
if (LOKAL_REF) { const { sqlPool } = await import("../server/lib/db-pool"); await (sqlPool as any).end?.({ timeout: 2 }); }
