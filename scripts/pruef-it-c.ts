// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-C (08.10.2026): Unterlagen (Punkt 3) + Erkennung (Punkt 13)
//
// Teil 1 — ohne Datenbank (immer):
//   Eingangsprüfung je Format (PDF Text/Bild, JPEG mit EXIF-Drehung, PNG, HEIC,
//   WEBP, TIFF, Passwort-PDF, Rechteschutz-PDF, kaputt, leer, zu groß, falsches
//   Format), qpdf-Entschlüsseln, Bindung mit Rechteschutz-PDF, die Ausweis-Regel,
//   MRZ-Arten, KI-Zusammenführung (Heuristik wird nie überstimmt), Status je
//   Kategorie, Monatsleiste, Entfernen-Regel, Auszugsregel, OCR-Wand für Ausweise,
//   Schlüssel des tragenden Anbieters, Sätze durch die Hauswand (Sie-Form).
//
// Teil 2 — gegen eine LOKALE Prüfstand-Datenbank (nur 127.0.0.1/localhost):
//   Hinzufügen statt Ersetzen mit Bestand, Bindung, Doppelte, Entfernen durch den
//   Kunden, Geprüft-Sperre, Ausweis-Regel über mehrere Dateien, Aufenthaltstitel,
//   Weitere Unterlagen, Passwort-Abweisung samt Protokoll, Grenze 20 Dateien,
//   Alles ersetzen mit Archiv, beschaffte Auskunft, fremd geänderte Fassung,
//   Kategorie leeren, Anstoß (eine Aufgabe je Stapel), Neu-Anforderung zurück,
//   0-Byte-Spalte, Personen-Zusammenführung (zurückgerollt).
//
//   env -i HOME=… PATH=… DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_it_c?sslmode=require \
//     node_modules/.bin/tsx scripts/pruef-it-c.ts
// Ohne lokale DATABASE_URL läuft nur Teil 1.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const echteDb = /@(127\.0\.0\.1|localhost):\d+\//.test(String(process.env.DATABASE_URL || "")) && !/:1\/x$/.test(String(process.env.DATABASE_URL || ""));
process.env.DATABASE_URL ||= "postgresql://pruefstand@127.0.0.1:1/x";
process.env.SESSION_SECRET ||= "pruefstand-it-c";
// Keine Schlüssel: nichts darf an eine KI gehen (die OCR-Wand wird mit Platzhaltern geprüft, ohne Netz).
delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.BREVO_API_KEY;

let fehler = 0; let gut = 0;
function ok(bedingung: unknown, text: string): void {
  if (bedingung) { gut++; console.log(`  ok    ${text}`); } else { fehler++; console.log(`  FEHLER ${text}`); }
}

// Auflösung wie im Server (server/lib) — dort liegen die neuen Abhängigkeiten auch im Arbeitsbaum ohne neues npm install.
const require_ = (await import("node:module")).createRequire(new URL("../server/lib/fiaon-datei-eingang.ts", import.meta.url));
const sharp = (await import("sharp")).default;
const { PDFDocument, StandardFonts } = await import("pdf-lib");
const eingang = await import("../server/lib/fiaon-datei-eingang");
const binden = await import("../server/lib/fiaon-pdf-binden");
const shared = await import("../shared/fiaon-unterlagen");
const lese = await import("../shared/fiaon-lesefehler");
const pruefung = await import("../server/lib/fiaon-dokument-pruefung");
const pdfLesen = await import("../server/lib/fiaon-pdf-lesen");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pruef-it-c-"));

// ── Muster bauen ─────────────────────────────────────────────────────────────
async function textPdf(zeilen: string[], seiten = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (let s = 0; s < seiten; s++) {
    const p = doc.addPage([595, 842]);
    zeilen.forEach((z, i) => p.drawText(z, { x: 40, y: 800 - i * 14, size: 9, font: f }));
  }
  return Buffer.from(await doc.save());
}
async function bildPdf(): Promise<Buffer> {
  const jpg = await sharp({ create: { width: 800, height: 1100, channels: 3, background: { r: 230, g: 230, b: 230 } } }).jpeg().toBuffer();
  const doc = await PDFDocument.create();
  const b = await doc.embedJpg(jpg);
  const p = doc.addPage([b.width, b.height]); p.drawImage(b, { x: 0, y: 0, width: b.width, height: b.height });
  return Buffer.from(await doc.save());
}
const auszugZeilen = (monat: number, tage = 28) => [
  "Kontoauszug Girokonto IBAN DE00 0000 0000 0000 0000 00", "Buchungstag Wertstellung Verwendungszweck Betrag Saldo",
  ...Array.from({ length: tage }, (_, i) => `${String(i + 1).padStart(2, "0")}.${String(monat).padStart(2, "0")}.2026 Lastschrift Stadtwerke ${(i + 3) * 7},45 ${1000 + i},12`),
];
async function qpdfModul(): Promise<any> {
  const mod = require_("@neslinesli93/qpdf-wasm");
  const wasm = require_.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm");
  return (mod.default || mod)({ locateFile: () => wasm, noInitialRun: true });
}
async function verschluesseln(pdf: Buffer, nutzer: string): Promise<Buffer> {
  const q = await qpdfModul();
  const vorher = process.exitCode;
  q.FS.writeFile("/e.pdf", new Uint8Array(pdf));
  q.callMain(["--encrypt", nutzer, "besitzer-pruefstand", "256", "--", "/e.pdf", "/a.pdf"]);
  process.exitCode = vorher;
  return Buffer.from(q.FS.readFile("/a.pdf"));
}

console.log("\n1 · Eingangsprüfung — Typ am Inhalt, Fotos, PDFs");
const tPdf = await textPdf(auszugZeilen(7));
const bPdf = await bildPdf();
const jpgExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 120, b: 80 } } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
const png = await sharp({ create: { width: 500, height: 400, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toBuffer();
const webp = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 1, g: 2, b: 3 } } }).webp().toBuffer();
const tiff = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 1, g: 2, b: 3 } } }).tiff().toBuffer();
const nutzerPdf = await verschluesseln(tPdf, "geheim");
const besitzerPdf = await verschluesseln(tPdf, "");

ok(eingang.typAmInhalt(tPdf) === "pdf", "PDF am Inhalt erkannt");
ok(eingang.typAmInhalt(Buffer.concat([Buffer.from("xx\n"), tPdf])) === "pdf", "PDF mit Vorspann (%PDF in den ersten 1024 Bytes)");
// Nachbesserung: harte Signaturen zuerst — ein JPEG, dessen EXIF/XMP „%PDF" enthält, bleibt ein JPEG.
ok(eingang.typAmInhalt(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40]), Buffer.from("Exif\u0000\u0000 Beschreibung: %PDF-Vorlage "), Buffer.alloc(200, 0x20)])) === "jpg",
  "JPEG mit „%PDF“ im EXIF bleibt JPEG (Signatur an Byte 0 vor %PDF-Suche)");
ok(eingang.typAmInhalt(jpgExif) === "jpg" && eingang.typAmInhalt(png) === "png", "JPEG und PNG erkannt");
ok(eingang.typAmInhalt(webp) === "webp" && eingang.typAmInhalt(tiff) === "tiff", "WEBP und TIFF erkannt");
ok(eingang.typAmInhalt(Buffer.from("PK\u0003\u0004 docx")) === null, "Word-Datei (ZIP) ist kein erlaubtes Format");

const eT = await eingang.dateiEingang(tPdf, "juli.pdf");
ok(eT.ok && eT.datei.befund.textseiten === 1 && eT.datei.befund.fotoseiten === 0 && eT.datei.typ === "pdf", "Text-PDF: 1 Textseite, angenommen, unverändert");
const eB = await eingang.dateiEingang(bPdf, "scan.pdf");
ok(eB.ok && eB.datei.befund.fotoseiten === 1 && eB.datei.befund.textseiten === 0, "Bild-PDF: als Fotoseite erkannt");
const eJ = await eingang.dateiEingang(jpgExif, "IMG_0001.JPG");
const mJ = eJ.ok ? await sharp(eJ.datei.buffer).metadata() : null;
ok(eJ.ok && mJ && mJ.width === 1600 && mJ.height === 2400, `JPEG mit EXIF 6: gedreht und auf 2.400 px (${mJ?.width}×${mJ?.height})`);
ok(eJ.ok && mJ && !mJ.exif && !mJ.orientation, "Foto ohne Metadaten gespeichert (kein EXIF, kein GPS)");
ok(eJ.ok && eJ.datei.buffer.length < jpgExif.length && eJ.datei.name === "IMG_0001.jpg", "Foto kleiner als vorher, Endung passt zum Inhalt");
const eP = await eingang.dateiEingang(png, "screenshot.png");
ok(eP.ok && eP.datei.typ === "jpg" && eP.datei.befund.ausTyp === "png", "PNG → JPEG (Transparenz auf Weiß)");
const eW = await eingang.dateiEingang(webp, "bild.webp");
const eTi = await eingang.dateiEingang(tiff, "scan.tif");
ok(eW.ok && eW.datei.typ === "jpg" && eTi.ok && eTi.datei.typ === "jpg", "WEBP und TIFF → JPEG");
let heic: Buffer | null = null;
try {
  const ein = path.join(tmp, "probe.jpg"); const aus = path.join(tmp, "probe.heic");
  fs.writeFileSync(ein, await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 90, g: 140, b: 200 } } }).jpeg().toBuffer());
  execFileSync("sips", ["-s", "format", "heic", ein, "--out", aus], { stdio: "ignore" });
  heic = fs.readFileSync(aus);
} catch { heic = null; }
if (heic) {
  ok(eingang.typAmInhalt(heic) === "heic", "iPhone-HEIC am Inhalt erkannt");
  const eH = await eingang.dateiEingang(heic, "IMG_4711.HEIC");
  ok(eH.ok && eH.datei.typ === "jpg" && eH.datei.befund.ausTyp === "heic" && eH.datei.name === "IMG_4711.jpg", "HEIC → JPEG gewandelt (heic-convert)");
} else console.log("  (HEIC-Probe übersprungen: kein sips auf diesem Rechner)");
const eNutzer = await eingang.dateiEingang(nutzerPdf, "auszug-mit-passwort.pdf");
ok(!eNutzer.ok && eNutzer.klasse === "passwort", "PDF mit Öffnungspasswort → Klasse „passwort“, nicht gespeichert");
const eBes = await eingang.dateiEingang(besitzerPdf, "bank.pdf");
ok(eBes.ok && eBes.datei.befund.geschuetzt === true && eBes.datei.befund.textseiten === 1, "Rechteschutz ohne Öffnungspasswort → angenommen, als geschützt vermerkt");
const eKaputt = await eingang.dateiEingang(Buffer.from("%PDF-1.4\n1 0 obj << /Kaputt >>\nquatsch"), "kaputt.pdf");
ok(!eKaputt.ok && (eKaputt.klasse === "beschaedigt" || eKaputt.klasse === "leer"), `Kaputte PDF → ${!eKaputt.ok ? eKaputt.klasse : "angenommen"}`);
const eLeer = await eingang.dateiEingang(Buffer.alloc(0), "leer.pdf");
ok(!eLeer.ok && eLeer.klasse === "leer", "0-Byte-Datei → leer");
const eGross = await eingang.dateiEingang(Buffer.alloc(50 * 1024 * 1024 + 1), "riesig.pdf");
ok(!eGross.ok && eGross.klasse === "zu_gross", "Über 50 MB → zu_gross");
const eFormat = await eingang.dateiEingang(Buffer.from("PK\u0003\u0004 docx-Inhalt"), "brief.docx");
ok(!eFormat.ok && eFormat.klasse === "format", "Word-Datei → format");

console.log("\n2 · qpdf — nur Rechteschutz lösen, nie raten");
const offen = await eingang.pdfEntschluesseln(besitzerPdf);
ok(!!offen && !eingang.pdfVerschluesselt(offen), "Rechteschutz gelöst (kein /Encrypt mehr)");
ok((await eingang.pdfEntschluesseln(nutzerPdf)) === null, "Öffnungspasswort bleibt zu (null)");
ok((await eingang.pdfEntschluesseln(tPdf)) === tPdf, "Unverschlüsselte PDF kommt unverändert zurück");
ok(process.exitCode === undefined || process.exitCode === 0, "qpdf hinterlässt keinen Exit-Code im Prozess");
const gebunden = await binden.zuEinerPdf([{ buffer: offen!, name: "bank.pdf" }, { buffer: tPdf, name: "juli.pdf" }]);
ok((await pdfLesen.pdfSeiten(gebunden)) === 2 && (await pdfLesen.pdfText(gebunden)).includes("Stadtwerke"), "Entschlüsselte Bank-PDF lässt sich mit anderen binden — mit Text");
let verschlFehler = false;
try { await binden.zuEinerPdf([{ buffer: besitzerPdf, name: "bank.pdf" }, { buffer: tPdf, name: "juli.pdf" }]); } catch (e) { verschlFehler = e instanceof binden.BindeFehler && e.grund === "verschluesselt"; }
ok(verschlFehler, "Ohne Lösen bleibt die Wand: verschlüsselt wird nie still leer gebunden");

console.log("\n3 · Ausweis — die feste Regel (keine Ausweisbilder an eine KI)");
const ab = shared.ausweisBewerten;
let r = ab({ erklaert: ["reisepass"], text: null, seiten: 1 });
// Nachbesserung: Die Wahl allein liefert nie „erkannt"/„vollständig" — ein Mensch sieht hin.
ok(r.erkannt === null && r.vollstaendig === null && !r.hinweisKunde && r.art === "reisepass" && /von Hand/.test(r.hinweisIntern),
  "Reisepass nur gewählt, ein Foto → von Hand (nicht „vollständig“), kein Kundensatz");
r = ab({ erklaert: ["reisepass"], text: { pass: false, vorne: true, hinten: true, aufenthaltstitel: true }, seiten: 1 });
ok(r.vollstaendig !== true && r.erkannt !== true, "Aufenthaltstitel (Text) unter „Reisepass hinzufügen“ → nicht vollständig");
r = ab({ erklaert: ["personalausweis"], text: { pass: false, vorne: true, hinten: true, aufenthaltstitel: true }, seiten: 2 });
ok(r.vollstaendig === false && r.hinweisKunde === shared.AUSWEIS_SAETZE.aufenthaltstitel && r.art === "aufenthaltstitel",
  "eAT mit Textschicht + Wahl „Personalausweis“ → Reisepass fehlt (der erkannte Titel schlägt die Wahl)");
r = ab({ erklaert: ["reisepass"], text: { pass: true, vorne: false, hinten: false, aufenthaltstitel: false }, seiten: 1 });
ok(r.vollstaendig === true && r.erkannt === true, "Reisepass durch Text/MRZ bestätigt → vollständig");
r = ab({ erklaert: ["personalausweis"], text: null, seiten: 1 });
ok(r.vollstaendig === null && r.hinweisKunde === shared.AUSWEIS_SAETZE.einSeiteFoto, "Personalausweis, ein Foto → weicher Hinweis, kein „unvollständig“");
r = ab({ erklaert: ["personalausweis", "personalausweis"], text: null, seiten: 2 });
ok(r.vollstaendig === null && r.hinweisKunde === null, "Personalausweis, zwei Fotos → kein Rückseiten-Hinweis (von Hand)");
r = ab({ erklaert: [], text: { pass: false, vorne: true, hinten: false, aufenthaltstitel: false }, seiten: 1 });
ok(r.vollstaendig === false && r.hinweisKunde === shared.AUSWEIS_SAETZE.rueckseite, "Text: nur Vorderseite → Rückseite fehlt (sicher)");
r = ab({ erklaert: [], text: { pass: false, vorne: true, hinten: true, aufenthaltstitel: false }, seiten: 2 });
ok(r.vollstaendig === true, "Text: Vorder- und Rückseite (auch über zwei Dateien) → vollständig");
r = ab({ erklaert: [], text: { pass: false, vorne: false, hinten: true, aufenthaltstitel: false }, seiten: 1 });
ok(r.vollstaendig === false && r.hinweisKunde === shared.AUSWEIS_SAETZE.vorderseite, "Text: nur Rückseite → Vorderseite fehlt");
r = ab({ erklaert: [], text: { pass: false, vorne: false, hinten: false, aufenthaltstitel: true }, seiten: 1 });
ok(r.vollstaendig === false && r.hinweisKunde === shared.AUSWEIS_SAETZE.aufenthaltstitel && r.art === "aufenthaltstitel", "Aufenthaltstitel allein → gilt nicht, Reisepass verlangt");
r = ab({ erklaert: ["reisepass"], text: { pass: true, vorne: false, hinten: false, aufenthaltstitel: true }, seiten: 2 });
ok(r.vollstaendig === true, "Aufenthaltstitel + Reisepass (Text) → vollständig");
r = ab({ erklaert: [null], text: null, seiten: 1 });
ok(r.vollstaendig === null && r.hinweisKunde === null && r.erkannt === null, "Altbestand-Foto ohne Wahl → von Hand, kein Satz");
const atb = pruefung.ausweisTextBefund;
ok(atb("REISEPASS PASSPORT\nP<DEUMUSTERMANN<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<\nC01X00T478D<<6408125F2702283<<<<<<<<<<<<<<<4").pass, "MRZ „P<“ → Reisepass");
const hinten = atb("Anschrift: Musterstraße 1\nIDD<<T220001293<<<<<<<<<<<<<<<\n6408125<2010315D<<<<<<<<<<<<<4\nMUSTERMANN<<ERIKA<<<<<<<<<<<<<");
ok(hinten.hinten && !hinten.pass, "MRZ „IDD<<“ (Rückseite des Personalausweises) → hinten, kein Pass");
const eat = atb("AUFENTHALTSTITEL RESIDENCE PERMIT\nARD<<X123456789<<<<<<<<<<<<<<<\n8001014M3101012SYR<<<<<<<<<<<0");
ok(eat.aufenthaltstitel && !eat.pass, "eAT (Aufenthaltstitel, MRZ „AR“) → Aufenthaltstitel, NICHT „vollständig wegen MRZ“");
const vorne = atb("PERSONALAUSWEIS IDENTITY CARD Name Mustermann Geburtstag 12.08.1964 Staatsangehörigkeit DEUTSCH gültig bis 01.01.2030");
ok(vorne.vorne && !vorne.hinten, "Vorderseite aus Wortliste erkannt");

console.log("\n4 · KI-Urteil: die Heuristik wird nie ins Falsche überstimmt");
const basisU = (x: Partial<import("../server/lib/fiaon-dokument-pruefung").DokumentUrteil>) => ({
  art: "ausweis" as const, pruefbar: true, erkannt: true, vollstaendig: true, fehlt: [], seiten: 1, hinweisKunde: null, hinweisIntern: "Reisepass — Datenseite genügt.", quelle: "heuristik" as const, eindeutig: true, ...x,
});
let u = pruefung.kiUrteilZusammenfuehren("ausweis", basisU({}), { erkannt: false }, 1);
ok(u.erkannt === true && u.vollstaendig === true && u.hinweisKunde === null, "Eindeutiger Reisepass + KI „nein“ → bleibt erkannt und vollständig");
u = pruefung.kiUrteilZusammenfuehren("ausweis", basisU({ erkannt: false, vollstaendig: false, eindeutig: false, hinweisKunde: "Diese Datei konnten wir nicht als Ausweisdokument erkennen." }), { erkannt: true }, 2);
ok(u.erkannt === true && u.vollstaendig === null && u.hinweisKunde === null, "Heuristik unsicher, KI „ja“ → erkannt, Seiten von Hand, kein Kundensatz");
u = pruefung.kiUrteilZusammenfuehren("ausweis", basisU({ vollstaendig: false, hinweisKunde: shared.AUSWEIS_SAETZE.rueckseite, eindeutig: true }), { erkannt: true }, 1);
ok(u.hinweisKunde === shared.AUSWEIS_SAETZE.rueckseite && u.vollstaendig === false, "KI ändert weder Vollständigkeit noch Kundensatz");
u = pruefung.kiUrteilZusammenfuehren("schufa", { ...basisU({ eindeutig: false }), art: "schufa" }, { erkannt: false }, 1);
ok(u.erkannt === false, "Auskunft ohne eindeutige Heuristik: KI sagt „keine Auskunft“ → nicht erkannt (E-175)");
ok(!pruefung.kiGefragt("ausweis", basisU({})) && pruefung.kiGefragt("ausweis", basisU({ erkannt: false })), "KI beim Ausweis nur zur Rettung eines „nicht erkannt“");
ok(!pruefung.kiGefragt("kontoauszug", basisU({ art: "kontoauszug" } as any)), "Kontoauszug: nie das KI-Urteil (eigene Analyse)");

console.log("\n5 · Prüfung der Akte-Fassung (ohne KI, ohne Schlüssel)");
const dreiMonate = await PDFDocument.create();
for (const m of [7, 8, 9]) (await dreiMonate.copyPages(await PDFDocument.load(await textPdf(auszugZeilen(m, 28))), [0])).forEach((p) => dreiMonate.addPage(p));
const pAuszug = await pruefung.dokumentPruefen("kontoauszug", Buffer.from(await dreiMonate.save()));
ok(pAuszug.erkannt === true && pAuszug.vollstaendig === true, `Kontoauszug Juli–Sept. → erkannt, vollständig (${pAuszug.zeitraumVon}…${pAuszug.zeitraumBis})`);
const zahlen = ["Kontoauszug", ...Array.from({ length: 40 }, (_, i) => `${String((i % 28) + 1).padStart(2, "0")}.07.2026 ${1000 + i},45 -${i + 1},99 ${2000 + i},12`)].join("\n");
ok(pdfLesen.textBrauchbarFuer("kontoauszug", zahlen) && !pdfLesen.pdfTextBrauchbar(zahlen), "Zahlenlastiger Auszug: Auszugsregel ja, Vokalregel nein — Prüfung nimmt die Auszugsregel");
const pZahl = await pruefung.dokumentPruefen("kontoauszug", await textPdf(zahlen.split("\n").slice(0, 45)));
ok(pZahl.pruefbar === true, "Zahlenlastiger Auszug ist für die Prüfung lesbar (vorher „nicht lesbar“)");
const pFotoAusweis = await pruefung.dokumentPruefen("ausweis", bPdf, { erklaert: ["personalausweis"] });
ok(pFotoAusweis.vollstaendig === null && pFotoAusweis.klasse === "von_hand" && pFotoAusweis.hinweisKunde === shared.AUSWEIS_SAETZE.einSeiteFoto, "Ausweis-Foto: keine KI, feste Regel, weicher Hinweis");
const pPass = await pruefung.dokumentPruefen("ausweis", await textPdf(["REISEPASS / PASSPORT / PASSEPORT", "Name / Surname MUSTERMANN", "P<DEUMUSTERMANN<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<"]));
ok(pPass.erkannt === true && pPass.vollstaendig === true && pPass.eindeutig === true, "Reisepass als Text-PDF → vollständig, eindeutig");
const pTitel = await pruefung.dokumentPruefen("ausweis", await textPdf(["AUFENTHALTSTITEL / RESIDENCE PERMIT", "Name MUSTERMANN", "ARD<<X123456789<<<<<<<<<<<<<<<<"]));
ok(pTitel.vollstaendig === false && pTitel.hinweisKunde === shared.AUSWEIS_SAETZE.aufenthaltstitel, "Aufenthaltstitel als Text-PDF → Reisepass verlangt");
{
  // Nachbesserung: je Seite gewertet — der Titel auf Seite 1 verdeckt den Reisepass auf Seite 2 nicht mehr.
  const zwei = await PDFDocument.create();
  for (const zeilen of [["AUFENTHALTSTITEL / RESIDENCE PERMIT", "ARD<<X123456789<<<<<<<<<<<<<<<<"], ["REISEPASS / PASSPORT", "Name MUSTERMANN"]]) {
    (await zwei.copyPages(await PDFDocument.load(await textPdf(zeilen)), [0])).forEach((pg) => zwei.addPage(pg));
  }
  const pZwei = await pruefung.dokumentPruefen("ausweis", Buffer.from(await zwei.save()), { erklaert: [null, "reisepass"] });
  ok(pZwei.vollstaendig === true && /Reisepass/.test(String(pZwei.hinweisIntern)), `Akte-Fassung Aufenthaltstitel (S. 1) + Reisepass (S. 2) → vollständig (${pZwei.hinweisIntern})`);
}
const pPw = await pruefung.dokumentPruefen("kontoauszug", nutzerPdf);
ok(pPw.klasse === "passwort" && pPw.hinweisKunde === lese.lesefehlerSatz("passwort", "sie"), "Passwort-PDF in der Prüfung → Klasse „passwort“ (vorher „Prüfung fehlgeschlagen“)");
const pFalsch = await pruefung.dokumentPruefen("ausweis", tPdf);
ok(pFalsch.erkannt === false && /Kontoauszug/.test(String(pFalsch.hinweisKunde)), "Kontoauszug als Ausweis hochgeladen → „sieht aus wie ein Kontoauszug“");

console.log("\n6 · Texterkennung: Wand für Ausweise, Schlüssel des tragenden Anbieters");
const { ocrLesen } = await import("../server/lib/fiaon-ocr");
const { kiLesenMoeglich } = await import("../server/lib/fiaon-ki-pause");
process.env.KI_ANBIETER = "claude"; process.env.ANTHROPIC_API_KEY = "sk-ant-pruefstand-nie-gesendet";
let netz = 0; (globalThis as any).__kiRohFetch = async () => { netz++; throw new Error("kein Netz im Prüfstand"); };
ok(kiLesenMoeglich() === true, "Claude trägt, nur ANTHROPIC_API_KEY gesetzt → KI kann lesen (vorher: OCR still aus)");
ok((await ocrLesen(bPdf, "ausweis")) === null && netz === 0, "ocrLesen(…, „ausweis“) → null, kein einziger Netzaufruf");
let zerlegKlasse: string | null = null;
try { await ocrLesen(Buffer.from("%PDF-1.4\n1 0 obj << /Kaputt >>\nquatsch"), "kontoauszug"); } catch (e) { zerlegKlasse = (e as any)?.klasse ?? "?"; }
ok(zerlegKlasse === "technisch" && netz === 0, `PDF, die sich zum Lesen nicht zerlegen lässt → „technisch“ (wird wiederholt), nicht „beschädigt“ beim Kunden (${zerlegKlasse})`);
process.env.KI_ANBIETER = "openai"; delete process.env.ANTHROPIC_API_KEY;
ok(kiLesenMoeglich() === false, "OpenAI trägt ohne OPENAI_API_KEY → kein Lesen (statt Fehler beim Kunden)");
delete process.env.KI_ANBIETER; delete (globalThis as any).__kiRohFetch;

console.log("\n7 · Stand je Kategorie, Monatsleiste, Entfernen-Regel");
const st = shared.kategorieStatus;
ok(st({ kategorie: "kontoauszug", dateien: 0, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false }).status === "fehlt", "nichts da → fehlt");
ok(st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: true, liestGerade: false, verwaltungGeprueft: false }).status === "bitte_neu", "erneut angefordert → bitte neu");
ok(st({ kategorie: "kontoauszug", dateien: 2, erneutAngefordert: false, liestGerade: true, verwaltungGeprueft: false }).status === "wird_geprueft", "liest gerade → wird geprüft");
let s7 = st({ kategorie: "kontoauszug", dateien: 2, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "fertig", tage: 60 }, fehlendeMonate: ["September"] });
ok(s7.status === "bitte_neu" && /September/.test(String(s7.satzKunde)) && /bisherigen Dateien bleiben/.test(String(s7.satzKunde)), "Analyse: nur 60 Tage → bitte neu, mit fehlendem Monat und „Dateien bleiben“");
ok(st({ kategorie: "kontoauszug", dateien: 3, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "fertig", tage: 88 }, pruefung: { erkannt: false, vollstaendig: false, hinweisKunde: "x", hinweisIntern: "x" } }).status === "liegt_vor",
  "Analyse fertig (88 Tage) schlägt ein altes „nicht erkannt“ der Prüfung");
s7 = st({ kategorie: "kontoauszug", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "fehler", fehlerIntern: "Zeitgrenze" } });
ok(s7.status === "wird_geprueft" && !/unscharf/.test(String(s7.satzKunde)), "Technischer Fehler der Analyse → „wird geprüft“, nie „unscharf“ beim Kunden");
ok(st({ kategorie: "schufa", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "unlesbar", fehlerKunde: "Diese Datei ist keine Bonitätsauskunft." } }).satzKunde === "Diese Datei ist keine Bonitätsauskunft.", "Analyse unlesbar → Kundensatz der Analyse");
s7 = st({ kategorie: "kontoauszug", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "fehler" }, pruefung: { erkannt: true, vollstaendig: false, hinweisKunde: "Es fehlen zwei Monate.", hinweisIntern: "nur ~30 Tage" } });
ok(s7.status === "bitte_neu" && s7.satzKunde === "Es fehlen zwei Monate.", "Analyse technisch gescheitert → die Prüfung (ohne KI) sagt dem Kunden trotzdem, was fehlt");
s7 = st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: false, liestGerade: true, verwaltungGeprueft: false, pruefungSicher: true, pruefung: { erkannt: true, vollstaendig: false, hinweisKunde: shared.AUSWEIS_SAETZE.aufenthaltstitel, hinweisIntern: "x" } });
ok(s7.status === "bitte_neu" && s7.satzKunde === shared.AUSWEIS_SAETZE.aufenthaltstitel, "Sicherer Regel-Befund steht sofort da, auch während noch gelesen wird (P9)");
ok(st({ kategorie: "weitere", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false }).status === "liegt_vor", "Weitere Unterlagen: liegt vor, ohne Prüfung");
ok(st({ kategorie: "ausweis", dateien: 0, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, nurAufenthaltstitel: true }).satzKunde === shared.AUSWEIS_SAETZE.aufenthaltstitel, "Nur Aufenthaltstitel unter „Weitere“ → Ausweis fehlt, mit Reisepass-Satz");
ok(st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: true, dateiSaetze: ["x"] }).status === "liegt_vor", "Von der Verwaltung geprüft → liegt vor");
// Nachbesserung: Bestand ohne sicheren Befund bleibt für den Kunden „liegt vor“ — das Office liest den Auftrag zum Hinsehen.
s7 = st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, nurBestand: true, pruefungSicher: true,
  pruefung: { erkannt: null, vollstaendig: null, hinweisKunde: null, hinweisIntern: "Ausweisdokument als Foto (1 Seite) — Art nicht gewählt, bitte von Hand ansehen." } });
ok(s7.status === "liegt_vor" && s7.satzKunde === null && String(s7.satzOffice).startsWith(shared.BESTAND_OFFICE_SATZ), "Bestand-Ausweis (Foto, ohne Wahl) → Kunde „liegt vor“, Office: einmal ansehen und „Geprüft“");
s7 = st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, nurBestand: true, pruefungSicher: true,
  pruefung: { erkannt: true, vollstaendig: false, hinweisKunde: shared.AUSWEIS_SAETZE.rueckseite, hinweisIntern: "nur vorn" } });
ok(s7.status === "bitte_neu", "Bestand mit SICHEREM Befund (Text: nur Vorderseite) → weiter „bitte neu“");
ok(st({ kategorie: "ausweis", dateien: 1, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, pruefungSicher: true,
  pruefung: { erkannt: null, vollstaendig: null, hinweisKunde: null, hinweisIntern: "x" } }).status === "wird_geprueft", "Neuer Upload ohne Befund → weiter „wird geprüft“ (nur Bestand ist ausgenommen)");
const leiste = shared.monateLeiste([{ von: "2026-07-03", bis: "2026-08-20" }], "2026-10-08");
ok(leiste.map((m) => `${m.label}:${m.da}`).join(",") === "Juli:true,August:true,September:false", `Monatsleiste Jul–Sep: ${leiste.map((m) => `${m.label}:${m.da}`).join(",")}`);
ok(shared.monateLeiste([{ von: "2026-07-01", bis: "2026-07-10" }], "2026-10-08")[0].da === false, "Zehn Tage machen keinen Monat (mindestens 14)");
const dk = shared.darfKundeEntfernen;
const jetzt = new Date().toISOString();
ok(dk({ quelle: "kunde", herkunft: "portal", geprueftAm: null, hochgeladenAm: jetzt }), "Eigene, ungeprüfte Datei → Kunde darf entfernen");
ok(!dk({ quelle: "kunde", herkunft: "portal", geprueftAm: jetzt, hochgeladenAm: jetzt }), "Geprüft → nicht mehr");
ok(!dk({ quelle: "mitarbeiter", herkunft: "mitarbeiter", geprueftAm: null, hochgeladenAm: jetzt }), "Vom Team → nie");
ok(!dk({ quelle: "kunde", herkunft: "beschaffung", geprueftAm: null, hochgeladenAm: jetzt }), "Beschaffte Auskunft → nie");
ok(!dk({ quelle: "kunde", herkunft: "bestand", geprueftAm: null, hochgeladenAm: "2026-09-01T10:00:00Z" }), "Bestand (vor dem 08.10., auch vom Team) → nie selbst entfernen");
ok(!dk({ quelle: "kunde", herkunft: "fremd", geprueftAm: null, hochgeladenAm: jetzt }), "Außerhalb geänderte Fassung → nie selbst entfernen");
ok(!dk({ quelle: "kunde", herkunft: "portal", geprueftAm: null, hochgeladenAm: "2026-10-01T10:00:00Z", verwaltungGeprueftAm: "2026-10-02T10:00:00Z" }), "Verwaltung prüfte nach dem Upload → nicht mehr");
ok(dk({ quelle: "kunde", herkunft: "portal", geprueftAm: null, hochgeladenAm: "2026-10-03T10:00:00Z", verwaltungGeprueftAm: "2026-10-02T10:00:00Z" }), "Verwaltung prüfte VOR dem Upload → neue Datei darf weg");

console.log("\n8 · Sätze: Hauswand, Sie-Form, technische Klassen nie beim Kunden");
const kundenTexte: string[] = [
  ...lese.alleKundenSaetze(), ...Object.values(shared.UNTERLAGEN_TEXTE), ...Object.values(shared.AUSWEIS_SAETZE),
  ...shared.UNTERLAGEN_KATEGORIEN.flatMap((k) => [k.titel, k.hinweisKunde]),
  st({ kategorie: "kontoauszug", dateien: 2, erneutAngefordert: false, liestGerade: false, verwaltungGeprueft: false, analyse: { status: "fertig", tage: 40 }, fehlendeMonate: ["August", "September"] }).satzKunde!,
  lese.lesefehlerSatz("falsche_art", "sie", { erkannt: "ein Kontoauszug", kategorie: "Ausweis", selbstEntfernen: false }),
  lese.lesefehlerSatz("falsche_art", "sie", { erkannt: "ein Kontoauszug", kategorie: "Ausweis", selbstEntfernen: true }),
];
// Nachbesserung: „selbst entfernen“ nur, wo der Knopf da ist.
ok(/Ansprechpartner/.test(lese.lesefehlerSatz("falsche_art", "sie", { selbstEntfernen: false })) && !/selbst entfernen/.test(lese.lesefehlerSatz("falsche_art", "sie", { selbstEntfernen: false }))
  && /selbst entfernen/.test(lese.lesefehlerSatz("falsche_art", "sie", { selbstEntfernen: true })), "Falsche Art: „selbst entfernen“ nur bei eigener, ungeprüfter Datei — sonst Weg zum Ansprechpartner");
ok(/keine Gesundheitsunterlagen/.test(shared.kategorieInfo("weitere").hinweisKunde) && !/alles, was wir zusätzlich sehen sollen/.test(shared.kategorieInfo("weitere").hinweisKunde),
  "„Weitere Unterlagen“: keine Einladung zu Gesundheitsdaten (Art. 9 DSGVO)");
ok(/gelöscht/.test(shared.UNTERLAGEN_TEXTE.entfernenFrage) && !/bewahren/.test(shared.UNTERLAGEN_TEXTE.entfernenFrage), "Entfernen-Frage sagt, dass die eigene Datei gelöscht wird");
{
  const { wissenFakten } = await import("../shared/fiaon-wissen");
  const w = wissenFakten();
  const sharedDateien = fs.readdirSync(path.resolve("shared")).filter((f) => f.endsWith(".ts")).map((f) => fs.readFileSync(path.resolve("shared", f), "utf8"));
  ok(!/ersetzt den vorigen/.test(w) && sharedDateien.every((t) => !/ersetzt den vorigen/.test(t)) && /HINZUGEFÜGT/.test(w) && w.includes(`${shared.UNTERLAGEN_GRENZEN.mbJeDatei} MB`),
    "KI-Assistent (fiaon-wissen): Hinzufügen statt Ersetzen, 50 MB aus shared — „ersetzt den vorigen“ steht nirgends mehr in shared/");
  const lies = (d: string) => fs.readFileSync(path.resolve(d), "utf8");
  ok(/useState<string>\(""\)/.test(lies("client/src/components/unterlagen/UnterlagenListe.tsx")) && /\{ ausweis: "", weitere: "" \}/.test(lies("client/src/components/unterlagen/UnterlagenAkte.tsx")),
    "Keine Vorbelegung der Art (Weitere: „Aufenthaltstitel“, Akte: „Personalausweis“) — Hochladen erst nach der Wahl");
  // Nachbesserung (Abschluss): Die Notiz des Teams sieht der Kunde nicht (alsDatei) — das Feld in der Akte darf nichts anderes sagen.
  ok(!/sieht der Kunde\)/.test(lies("client/src/components/unterlagen/UnterlagenAkte.tsx")) && /der Kunde sieht sie nicht/.test(lies("client/src/components/unterlagen/UnterlagenAkte.tsx"))
    && !/die Notiz dort sieht der Kunde/.test(lies("client/src/pages/agent/rundgaenge.ts")),
    "Akte und Rundgang: Notiz des Teams ist intern — „der Kunde sieht sie nicht“ (wie die Kundensicht)");
  const routen = lies("server/routes/fiaon-unterlagen.ts");
  ok(/merged_into_person_id/.test(routen) && /nurAktiv: true/.test(routen), "Office: zusammengeführte Person → 409; Kunde öffnet nur aktive Dateien");
  ok(/art <> 'unterlage' AND art NOT LIKE 'frueher/.test(lies("server/routes/fiaon-app.ts")), "/kunde/:ref/app/dokument/:id liefert keine Unterlagen und keine Archivfassungen");
  ok(/kycOhneSitzungDrossel/.test(lies("server/routes/fiaon-antrag.ts")), "/upload-kyc ohne Sitzung gedrosselt");
}
let wand = 0; let duForm = 0;
for (const t of kundenTexte) {
  for (const w of wandPruefen(t, ["aufgabe_an_betreuer"])) { wand++; console.log(`        Wand: „${t.slice(0, 80)}“ → ${w.hinweis}`); }
  if (/\b(du|dein|deine|dich|dir)\b/i.test(t)) { duForm++; console.log(`        du-Form: „${t.slice(0, 80)}“`); }
}
ok(wand === 0, `${kundenTexte.length} Kundentexte durch die Hauswand — ${wand} Treffer`);
ok(duForm === 0, "Kundentexte durchgehend Sie-Form");
ok(["technisch", "ki_pause", "zu_gross_fuer_ki"].every((k) => lese.istTechnisch(k) && !/unscharf|Schuld|falsch/.test(lese.lesefehlerSatz(k as any, "sie"))), "Technische Klassen: beim Kunden nur „wird geprüft“");
ok(lese.lesefehlerSatz("technisch", "du", { versuch: 3 }).includes("von Hand"), "Office sieht nach dem dritten Versuch „bitte von Hand ansehen“");

// ═════════════════════════════════════════════════════════════════════════════
// TEIL 2 — LOKALE DATENBANK
// ═════════════════════════════════════════════════════════════════════════════
if (!echteDb) {
  console.log("\n(Teil 2 übersprungen: keine lokale DATABASE_URL — nie gegen die Produktion.)");
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  const U = await import("../server/lib/fiaon-unterlagen");
  const lauf = sqlPool;
  const kennung = `ITC${Date.now().toString(36).toUpperCase()}`;
  const ok2 = ok;
  console.log(`\n9 · Datenbank (${kennung})`);
  ok2(await U.unterlagenBereit(), "Spalten aus Migration 099 bereit");
  const neuePerson = async (nr: string): Promise<number> => {
    const [p] = (await lauf`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`${kennung}-${nr}`}, 'Erika', 'Prüfstand', ${`${kennung.toLowerCase()}-${nr}@example.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  };
  const neueBestellung = async (personId: number, ref: string, bezahlt: boolean, typ = "ultra"): Promise<void> => {
    await lauf`INSERT INTO fiaon_applications (ref, payment_reference, person_id, type, payment_status, status, first_name, last_name, email, created_at)
               VALUES (${ref}, ${ref}, ${personId}, ${typ}, ${bezahlt ? "paid" : "pending_payment"}, 'completed', 'Erika', 'Prüfstand', ${`${ref.toLowerCase()}@example.invalid`}, NOW() - INTERVAL '10 days')`;
  };
  const person = await neuePerson("A");
  const paket = `FIAON-${kennung}-P`; const schufaRef = `FIAON-SCHUFA-${kennung}`;
  await neueBestellung(person, paket, true);
  await neueBestellung(person, schufaRef, true, "schufa");
  // Bestand: ein Juni-Auszug lag schon vor dem 08.10. in der Spalte — an der SCHUFA-Bestellung (Kundenweg schrieb an die Sitzungs-ref).
  const juni = await textPdf(auszugZeilen(6));
  await lauf`UPDATE fiaon_applications SET bank_statement_pdf = ${juni}, documents_uploaded_at = NOW() - INTERVAL '30 days', reupload_bank_statement = TRUE, kyc_status = 'changes_requested' WHERE ref = ${schufaRef}`;
  ok2((await U.traegerRef(person)) === paket, "Träger ist die bezahlte Paketbestellung, nicht die Auskunfts-Bestellung");

  const kunde = { art: "kunde" as const, name: "Kunde" };
  const team = { art: "mitarbeiter" as const, name: "Prüfstand Team", agentId: null };
  let e = await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(7)), name: "juli.pdf" }, wer: kunde, herkunft: "portal" });
  ok2(e.ok, "Juli hinzugefügt");
  let zeilen = (await lauf`SELECT herkunft, dateiname, zeitraum_von FROM fiaon_dokumente WHERE person_id = ${person} AND art = 'unterlage' AND kategorie = 'kontoauszug' AND entfernt_am IS NULL ORDER BY id`) as any[];
  ok2(zeilen.length === 2 && zeilen[0].herkunft === "bestand", `Bestand (Juni) als Datei übernommen, Juli angehängt (${zeilen.map((z) => z.herkunft).join(", ")})`);
  let [spalten] = (await lauf`SELECT (SELECT LENGTH(bank_statement_pdf) FROM fiaon_applications WHERE ref = ${paket}) AS p, (SELECT bank_statement_pdf IS NULL FROM fiaon_applications WHERE ref = ${schufaRef}) AS s_leer`) as any[];
  ok2(Number(spalten.p) > 0 && spalten.s_leer === true, "Akte-Fassung an der Paketbestellung, die Schwester ist leer (keine gespaltene Fassung)");
  let akte = (await lauf`SELECT bank_statement_pdf AS b FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  ok2((await pdfLesen.pdfSeiten(Buffer.from(akte[0].b))) === 2, "Gebundene Akte-Fassung hat Juni + Juli (2 Seiten)");
  const [flags] = (await lauf`SELECT bool_or(reupload_bank_statement) AS re, (SELECT kyc_status FROM fiaon_applications WHERE ref = ${schufaRef}) AS kyc FROM fiaon_applications WHERE person_id = ${person}`) as any[];
  ok2(flags.re === false && flags.kyc === "pending", "Neu-Anforderung zurückgesetzt, kyc_status changes_requested → pending (wie /upload-kyc)");
  e = await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(8)), name: "august.pdf" }, wer: kunde, herkunft: "portal" });
  const sept = await textPdf(auszugZeilen(9));
  e = await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: sept, name: "september.pdf" }, wer: kunde, herkunft: "portal" });
  const doppelt = await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: sept, name: "september-nochmal.pdf" }, wer: kunde, herkunft: "portal" });
  ok2(doppelt.ok && doppelt.doppelt === true, "Dieselbe Datei zweimal → „liegt schon vor“, keine zweite Zeile");
  // Nachbesserung: Die erste Datei eines Stapels bindet sofort, die weiteren bindet der Anstoß EINMAL (keine 1+2+…+n Bindungen).
  akte = (await lauf`SELECT bank_statement_pdf AS b FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  ok2((await pdfLesen.pdfSeiten(Buffer.from(akte[0].b))) === 2, "Stapel: August und September binden nicht je einzeln (Fassung noch Juni + Juli)");
  ok2((await U.akteFassungBinden(person, "kontoauszug")).ok, "Bindung am Ende des Stapels");
  akte = (await lauf`SELECT bank_statement_pdf AS b FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  const seitenText = await pdfLesen.pdfTextJeSeite(Buffer.from(akte[0].b));
  ok2(seitenText.length === 4 && /\.06\.2026/.test(seitenText[0]) && /\.09\.2026/.test(seitenText[3]), "Akte-Fassung sortiert nach erkanntem Zeitraum: Juni … September");
  let stand = await U.unterlagenStand(person, "kunde");
  let ka = stand.kategorien.find((k) => k.kategorie === "kontoauszug")!;
  ok2(ka.dateien.length === 4 && ka.liestGerade && ka.status === "wird_geprueft", `Kunde sieht 4 Dateien, „${ka.statusText}“`);
  ok2(ka.monate?.filter((m) => m.da).length === 3, `Monatsleiste 3/3 (${ka.monate?.map((m) => `${m.label}:${m.da}`).join(", ")})`);
  const ev = (await lauf`SELECT count(*)::int AS n FROM fiaon_contact_log WHERE ref = ${paket} AND note LIKE 'Kunde hat hochgeladen:%'`) as any[];
  ok2(Number(ev[0].n) === 3, "Verlauf mit ref: eine Zeile je angenommener Datei");

  // Entfernen durch den Kunden
  const juli = ka.dateien.find((d) => d.name === "juli.pdf")!;
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NULL, anstoss_von = 'kunde' WHERE person_id = ${person} AND kategorie = 'kontoauszug'`;
  let ent = await U.unterlageEntfernen(person, juli.id!, kunde, "vom Kunden entfernt");
  const [nachEnt] = (await lauf`SELECT anstoss_von FROM fiaon_unterlagen_akte WHERE person_id = ${person} AND kategorie = 'kontoauszug'`) as any[];
  ok2(nachEnt?.anstoss_von === "kunde_entfernt", `Entfernen ist kein Eingang: anstoss_von „${nachEnt?.anstoss_von}“ (keine neue Aufgabe „Unterlagen eingegangen“)`);
  ok2(ent.ok, "Kunde entfernt seine ungeprüfte Datei");
  akte = (await lauf`SELECT bank_statement_pdf AS b FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  ok2((await pdfLesen.pdfSeiten(Buffer.from(akte[0].b))) === 3, "Akte-Fassung neu gebunden (3 Seiten)");
  const [weg] = (await lauf`SELECT entfernt_am IS NOT NULL AS e, LENGTH(inhalt) AS n, dateiname, doc_hash FROM fiaon_dokumente WHERE id = ${juli.id}`) as any[];
  // Nachbesserung (Art. 5 DSGVO): Was der Kunde selbst entfernt, ist gelöscht — nur der Vermerk bleibt.
  ok2(weg.e && Number(weg.n) === 0 && weg.dateiname === "juli.pdf" && !!weg.doc_hash, "Vom Kunden entfernt → Inhalt gelöscht, Vermerk (Name, Prüfsumme) bleibt");
  ok2((await U.dateiLesen(person, juli.id!)) === null, "Office öffnet die vom Kunden gelöschte Datei nicht mehr (kein leeres PDF)");
  const entfStand = (await U.unterlagenStand(person, "office")).kategorien.find((k) => k.kategorie === "kontoauszug")!;
  ok2(entfStand.entfernte?.some((d) => d.id === juli.id && d.inhaltGeloescht === true), "Office sieht „Inhalt gelöscht (vom Kunden entfernt)“");
  ok2((await U.kategorieGeprueft(person, "kontoauszug", team)).ok, "Team setzt „Geprüft“");
  stand = await U.unterlagenStand(person, "kunde");
  ka = stand.kategorien.find((k) => k.kategorie === "kontoauszug")!;
  ent = await U.unterlageEntfernen(person, ka.dateien[0].id!, kunde, "x");
  ok2(!ent.ok && ent.status === 403 && ka.dateien.every((d) => !d.darfEntfernen), "Nach „Geprüft“ entfernt der Kunde nichts mehr");
  ok2(ka.status === "liegt_vor", `Geprüft → „${ka.statusText}“`);
  ok2(ka.monate === undefined, "Liegt vor → keine Monatsleiste mit „– fehlt“ darunter (eine Botschaft)");
  ok2(ka.dateien.some((d) => d.herkunft === "bestand") && ka.dateien.filter((d) => d.herkunft === "bestand").every((d) => !d.darfEntfernen), "Bestand-Datei entfernt der Kunde nie selbst");

  // Ausweis: Foto + gewählte Art; zweites Foto; Spalte immer PDF
  const foto = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 200, g: 200, b: 210 } } }).jpeg().toBuffer();
  e = await U.unterlageHinzufuegen({ personId: person, kategorie: "ausweis", unterart: "personalausweis", datei: { buffer: foto, name: "vorne.jpg" }, wer: kunde, herkunft: "portal" });
  stand = await U.unterlagenStand(person, "office");
  let aw = stand.kategorien.find((k) => k.kategorie === "ausweis")!;
  ok2(aw.ausweis?.hinweisKunde === shared.AUSWEIS_SAETZE.einSeiteFoto, "Personalausweis als ein Foto → weicher Hinweis aus der Regel");
  const [spA] = (await lauf`SELECT substring(id_card_pdf from 1 for 4) AS k FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  ok2(Buffer.from(spA.k).toString("latin1") === "%PDF", "Ein Einzelfoto liegt als PDF in der Spalte (vorher roh als JPEG)");
  const foto2 = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 180, g: 190, b: 200 } } }).jpeg().toBuffer();
  e = await U.unterlageHinzufuegen({ personId: person, kategorie: "ausweis", unterart: "personalausweis", datei: { buffer: foto2, name: "hinten.jpg" }, wer: kunde, herkunft: "portal" });
  stand = await U.unterlagenStand(person, "kunde");
  aw = stand.kategorien.find((k) => k.kategorie === "ausweis")!;
  ok2(aw.dateien.length === 2 && !/Rückseite/.test(String(aw.satz)), `Rückseite angehängt, Vorderseite bleibt, kein Rückseiten-Hinweis mehr („${aw.satz}“)`);

  // Aufenthaltstitel (Person B)
  const personB = await neuePerson("B");
  const paketB = `FIAON-${kennung}-B`;
  await neueBestellung(personB, paketB, true);
  await U.unterlageHinzufuegen({ personId: personB, kategorie: "ausweis", datei: { buffer: await textPdf(["AUFENTHALTSTITEL / RESIDENCE PERMIT", "ARD<<X123456789<<<<<<<<<<<<<<<<"]), name: "titel.pdf" }, wer: kunde, herkunft: "portal" });
  let sB = await U.unterlagenStand(personB, "kunde");
  ok2(sB.kategorien.find((k) => k.kategorie === "ausweis")!.satz === shared.AUSWEIS_SAETZE.aufenthaltstitel, "Aufenthaltstitel allein → Kunde liest: Reisepass dazu");
  await U.unterlageHinzufuegen({ personId: personB, kategorie: "ausweis", unterart: "reisepass", datei: { buffer: await textPdf(["REISEPASS / PASSPORT", "P<DEUMUSTERMANN<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<"]), name: "pass.pdf" }, wer: kunde, herkunft: "portal" });
  sB = await U.unterlagenStand(personB, "office");
  ok2(sB.kategorien.find((k) => k.kategorie === "ausweis")!.ausweis?.vollstaendig === true, "Mit Reisepass → vollständig");
  // Weitere Unterlagen
  const w = await U.unterlageHinzufuegen({ personId: personB, kategorie: "weitere", unterart: "einkommensnachweis", notiz: "Lohnzettel September", datei: { buffer: await textPdf(["Lohnabrechnung September 2026", "Netto 2.100,00"]), name: "lohn.pdf" }, wer: kunde, herkunft: "portal" });
  sB = await U.unterlagenStand(personB, "kunde");
  const wk = sB.kategorien.find((k) => k.kategorie === "weitere")!;
  ok2(w.ok && wk.dateien[0]?.unterartLabel === "Einkommensnachweis" && wk.dateien[0]?.notiz === "Lohnzettel September" && wk.status === "liegt_vor", "Weitere Unterlage mit Art und Notiz");
  const [kein] = (await lauf`SELECT bank_statement_pdf IS NULL AS a, schufa_pdf IS NULL AS b FROM fiaon_applications WHERE ref = ${paketB}`) as any[];
  ok2(kein.a && kein.b, "„Weitere“ schreibt in keine Spalte");
  // Passwort-PDF → abgewiesen, protokolliert
  const pw = await U.unterlageHinzufuegen({ personId: personB, kategorie: "kontoauszug", datei: { buffer: nutzerPdf, name: "geschuetzt.pdf" }, wer: kunde, herkunft: "portal" });
  const [proto] = (await lauf`SELECT count(*)::int AS n FROM fiaon_app_ereignisse WHERE person_id = ${personB} AND ereignis LIKE 'abgewiesen:passwort:%'`) as any[];
  ok2(!pw.ok && pw.klasse === "passwort" && Number(proto.n) === 1, "Passwort-PDF abgewiesen (Satz mit Weg), Abweisung messbar in fiaon_app_ereignisse");
  // Grenze 20 Dateien
  for (let i = 0; i < 20; i++) await U.unterlageHinzufuegen({ personId: personB, kategorie: "weitere", unterart: "sonstiges", datei: { buffer: await textPdf([`Beleg ${i}`, "Sonstiges"]), name: `b${i}.pdf` }, wer: kunde, herkunft: "portal" });
  const viel = await U.unterlageHinzufuegen({ personId: personB, kategorie: "weitere", datei: { buffer: await textPdf(["Beleg 99"]), name: "b99.pdf" }, wer: kunde, herkunft: "portal" });
  ok2(!viel.ok && viel.klasse === "zu_viele", "21. Datei einer Kategorie → „zu viele“");
  // Nachbesserung: Was das Team entfernt (z. B. „falsche Person“), öffnet der Kunde nicht mehr — das Office schon.
  const [b0] = (await lauf`SELECT id FROM fiaon_dokumente WHERE person_id = ${personB} AND dateiname = 'b0.pdf' AND entfernt_am IS NULL`) as any[];
  const teamWeg = await U.unterlageEntfernen(personB, Number(b0.id), team, "falsche Person — gehört nicht hierher");
  ok2(teamWeg.ok && (await U.dateiLesen(personB, Number(b0.id), lauf, { nurAktiv: true })) === null && (await U.dateiLesen(personB, Number(b0.id)))?.inhalt.length! > 0,
    "Vom Team entfernt: Kunde öffnet sie nicht mehr (404), Office schon (Archiv)");
  await U.unterlageHinzufuegen({ personId: person, kategorie: "weitere", unterart: "bescheinigung", notiz: "intern: Bescheid wirkt bearbeitet", datei: { buffer: await textPdf(["Bescheid", "Seite 1"]), name: "bescheid.pdf" }, wer: team, herkunft: "mitarbeiter" });
  const notizKunde = (await U.unterlagenStand(person, "kunde")).kategorien.find((k) => k.kategorie === "weitere")!.dateien[0];
  const notizOffice = (await U.unterlagenStand(person, "office")).kategorien.find((k) => k.kategorie === "weitere")!.dateien[0];
  ok2(notizKunde?.notiz === null && notizOffice?.notiz === "intern: Bescheid wirkt bearbeitet", "Notiz des Teams sieht der Kunde nicht (seine eigene schon)");

  // Alles ersetzen (Team) mit Archiv
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NULL WHERE person_id = ${person}`;
  const ers = await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(10, 5)), name: "neu.pdf" }, wer: team, herkunft: "mitarbeiter", ersetzen: { grund: "falscher Auszug, Kunde schickte das richtige Konto" } });
  const [nachE] = (await lauf`SELECT count(*) FILTER (WHERE entfernt_am IS NULL)::int AS aktiv, count(*) FILTER (WHERE entfernt_grund LIKE 'ersetzt:%')::int AS ersetzt FROM fiaon_dokumente WHERE person_id = ${person} AND art = 'unterlage' AND kategorie = 'kontoauszug'`) as any[];
  const [arch] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${person} AND art = 'frueher_kontoauszug'`) as any[];
  ok2(ers.ok && nachE.aktiv === 1 && nachE.ersetzt >= 3 && Number(arch.n) >= 1, `Alles ersetzen: 1 aktiv, ${nachE.ersetzt} mit Grund ersetzt, Fassung im Archiv (${arch.n})`);

  // Beschaffte Auskunft + Kunde darf dort nichts hinzufügen
  const auskunft = await textPdf(["SCHUFA Holding AG Datenkopie nach Art. 15 DSGVO", "Basisscore 97,5 %", "Seite 1 von 1"]);
  await lauf`UPDATE fiaon_applications SET schufa_pdf = ${auskunft} WHERE ref = ${paket}`;
  await U.akteFassungUebernehmen(person, "schufa", { herkunft: "beschaffung", name: "Chefbüro", agentId: null });
  stand = await U.unterlagenStand(person, "kunde");
  const sch = stand.kategorien.find((k) => k.kategorie === "schufa")!;
  ok2(sch.dateien.length === 1 && sch.dateien[0].herkunft === "beschaffung" && sch.dateien[0].darfEntfernen === false && !sch.darfHinzufuegen, "Beschaffte Auskunft: eine Datei, nicht entfernbar, Kunde lädt dort nicht hinzu");
  const kundeAusk = await U.unterlageHinzufuegen({ personId: person, kategorie: "schufa", datei: { buffer: await textPdf(["SCHUFA Bonitätsauskunft eigene"]), name: "eigene.pdf" }, wer: kunde, herkunft: "portal" });
  ok2(!kundeAusk.ok && kundeAusk.klasse === "beschafft", "Kunden-Upload in die beschaffte Auskunft → Satz mit Weg „Weitere Unterlagen“");
  const teamAusk = await U.unterlageHinzufuegen({ personId: person, kategorie: "schufa", datei: { buffer: await textPdf(["CRIF Bürgel Selbstauskunft", "Score", "Seite 1 von 1"]), name: "crif.pdf" }, wer: team, herkunft: "mitarbeiter" });
  akte = (await lauf`SELECT schufa_pdf AS b FROM fiaon_applications WHERE ref = ${paket}`) as any[];
  const auskText = await pdfLesen.pdfText(Buffer.from(akte[0].b));
  ok2(teamAusk.ok && /SCHUFA Holding/.test(auskText) && /CRIF/.test(auskText), "Team hängt an die beschaffte Auskunft an — sie wird nicht überschrieben");

  // Fremd geänderte Fassung (z. B. Zusammenführung füllt die Spalte)
  await lauf`UPDATE fiaon_applications SET bank_statement_pdf = ${await textPdf(auszugZeilen(5))} WHERE ref = ${paket}`;
  await U.unterlageHinzufuegen({ personId: person, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(11, 3)), name: "nov.pdf" }, wer: team, herkunft: "mitarbeiter" });
  const fremd = (await lauf`SELECT herkunft FROM fiaon_dokumente WHERE person_id = ${person} AND art = 'unterlage' AND kategorie = 'kontoauszug' AND entfernt_am IS NULL ORDER BY id`) as any[];
  ok2(fremd.some((f) => f.herkunft === "fremd") && fremd.length === 2, `Außerhalb geänderte Fassung als eine Datei übernommen (${fremd.map((f) => f.herkunft).join(", ")})`);

  // Anstoß: eine Aufgabe je Stapel, keine zweite
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute', anstoss_von = 'kunde' WHERE person_id = ${personB} AND kategorie = 'ausweis'`;
  ok2(await U.anstossAusfuehren(personB, "ausweis"), "Anstoß läuft (beansprucht)");
  ok2(!(await U.anstossAusfuehren(personB, "ausweis")), "Zweiter Anstoß ohne neue Fälligkeit tut nichts");
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute', anstoss_von = 'kunde' WHERE person_id = ${personB} AND kategorie = 'ausweis'`;
  await U.anstossAusfuehren(personB, "ausweis");
  const [aufg] = (await lauf`SELECT count(*)::int AS n FROM fiaon_vermerke WHERE ref = ${paketB} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  const [urt] = (await lauf`SELECT urteil FROM fiaon_dokument_pruefungen WHERE ref = ${paketB} AND art = 'ausweis'`) as any[];
  ok2(Number(aufg.n) === 1, "EINE Verwaltungs-Aufgabe je Stapel (keine zweite, solange eine offen ist)");
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute', anstoss_von = 'kunde' WHERE person_id = ${personB} AND kategorie = 'weitere'`;
  await U.anstossAusfuehren(personB, "weitere");
  const [aufg2] = (await lauf`SELECT count(*)::int AS n, max(text) AS t FROM fiaon_vermerke WHERE ref = ${paketB} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok2(Number(aufg2.n) === 1 && /Ausweis/.test(String(aufg2.t)) && /Weitere Unterlagen/.test(String(aufg2.t)), `Zweite Kategorie im selben Stapel ergänzt die offene Aufgabe („${String(aufg2.t).slice(0, 90)}…“)`);
  ok2(urt?.urteil?.vollstaendig === true && /Reisepass/.test(String(urt?.urteil?.hinweisIntern)), `Prüfung der Akte-Fassung: Reisepass + Aufenthaltstitel → vollständig (${String(urt?.urteil?.hinweisIntern ?? "kein Urteil").slice(0, 120)})`);

  // Kategorie leeren (alter Knopf „Löschen“)
  const leer = await U.kategorieLeeren(personB, "ausweis", team, "falsche Person, Kunde schickt neu");
  const [nachL] = (await lauf`SELECT id_card_pdf IS NULL AS leer FROM fiaon_applications WHERE ref = ${paketB}`) as any[];
  const [archL] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personB} AND art = 'frueher_ausweis'`) as any[];
  ok2(leer.ok && nachL.leer && Number(archL.n) === 1, "Löschen: Spalte leer, Fassung im Archiv, Dateien mit Grund entfernt");

  // 0-Byte-Spalte zählt nicht als „liegt vor“
  const personC = await neuePerson("C");
  const paketC = `FIAON-${kennung}-C`;
  await neueBestellung(personC, paketC, true);
  await lauf`UPDATE fiaon_applications SET id_card_pdf = '\\x'::bytea WHERE ref = ${paketC}`;
  const sC = await U.unterlagenStand(personC, "kunde");
  ok2(sC.kategorien.find((k) => k.kategorie === "ausweis")!.status === "fehlt", "0-Byte-Spalte → „Fehlt“ (wie die Akte)");

  // Personen-Zusammenführung (zurückgerollt): Dateien wandern zum Gewinner
  const { personenZusammenfuehren } = await import("../server/lib/fiaon-person-merge");
  let gewandert = false;
  try {
    await lauf.begin(async (tx: any) => {
      await personenZusammenfuehren(personB, personC, {}, { name: "Prüfstand" }, { tx });
      const [n] = (await tx`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personC} AND art = 'unterlage'`) as any[];
      const [m] = (await tx`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personB}`) as any[];
      gewandert = Number(n.n) > 0 && Number(m.n) === 0;
      throw new Error("zurückrollen");
    });
  } catch (e) { if (String((e as Error).message) !== "zurückrollen") console.log("        Zusammenführung:", String((e as Error).message).slice(0, 160)); }
  ok2(gewandert, "Personen-Zusammenführung nimmt Dateien und Archiv mit (zurückgerollt)");

  // ── Nachbesserung: Freigabe vor dem Nachladen eines ÄLTEREN Monats (letzter Upload ≠ letzter der Anzeige) ──
  const personD = await neuePerson("D");
  const paketD = `FIAON-${kennung}-D`;
  await neueBestellung(personD, paketD, true);
  await U.unterlageHinzufuegen({ personId: personD, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(9)), name: "sept.pdf" }, wer: kunde, herkunft: "portal" });
  await lauf`UPDATE fiaon_applications SET kyc_status = 'approved', admin_reviewed_at = NOW() WHERE ref = ${paketD}`;
  await new Promise((w) => setTimeout(w, 30));
  await U.unterlageHinzufuegen({ personId: personD, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(7)), name: "juli.pdf" }, wer: kunde, herkunft: "portal" });
  const kD = (await U.unterlagenStand(personD, "office")).kategorien.find((k) => k.kategorie === "kontoauszug")!;
  const kDk = (await U.unterlagenStand(personD, "kunde")).kategorien.find((k) => k.kategorie === "kontoauszug")!;
  ok2(kD.dateien[0]?.name === "juli.pdf" && !kD.geprueft && kD.satz !== "von der Verwaltung geprüft" && kDk.dateien.find((d) => d.name === "juli.pdf")?.darfEntfernen === true,
    "Juli NACH der Freigabe nachgeladen (steht vor September): nicht „von der Verwaltung geprüft“, „Geprüft“ bleibt sichtbar");

  // ── Nachbesserung: geprüfte/ausgewertete Auskunft — Kunde hängt nichts an, kein automatisches Neu-Rechnen ──
  const { ensureSchufaTabelle } = await import("../server/lib/fiaon-schufa-analyse");
  await ensureSchufaTabelle();
  await U.unterlageHinzufuegen({ personId: personD, kategorie: "schufa", datei: { buffer: await textPdf(["SCHUFA Holding AG Datenkopie", "Seite 1 von 1"]), name: "auskunft.pdf" }, wer: team, herkunft: "mitarbeiter" });
  await lauf`INSERT INTO fiaon_schufa_analysen (ref, person_id, status) VALUES (${paketD}, ${personD}, 'fertig')`;
  const ausgew = await U.unterlageHinzufuegen({ personId: personD, kategorie: "schufa", datei: { buffer: await textPdf(["Score-Anzeige 97 %"]), name: "score.pdf" }, wer: kunde, herkunft: "portal" });
  const sD = (await U.unterlagenStand(personD, "kunde")).kategorien.find((k) => k.kategorie === "schufa")!;
  ok2(!ausgew.ok && ausgew.klasse === "ausgewertet" && !sD.darfHinzufuegen && sD.sperrSatz === lese.lesefehlerSatz("ausgewertet", "sie"),
    "Ausgewertete Auskunft: Kunde hängt nichts an (Satz mit Weg „Weitere Unterlagen“)");
  await U.unterlageHinzufuegen({ personId: personD, kategorie: "schufa", datei: { buffer: await textPdf(["CRIF Bürgel Auskunft", "Seite 1 von 1"]), name: "crif.pdf" }, wer: team, herkunft: "mitarbeiter" });
  const [vorA] = (await lauf`SELECT count(*)::int AS n FROM fiaon_schufa_analysen WHERE ref = ${paketD}`) as any[];
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute', anstoss_von = 'mitarbeiter' WHERE person_id = ${personD} AND kategorie = 'schufa'`;
  await U.anstossAusfuehren(personD, "schufa");
  const [nachA] = (await lauf`SELECT count(*)::int AS n FROM fiaon_schufa_analysen WHERE ref = ${paketD}`) as any[];
  ok2(Number(nachA.n) === Number(vorA.n), "Team hängt an eine ausgewertete Auskunft an → keine automatische Neu-Auswertung (nur „Neu lesen“)");

  // ── Nachbesserung: Stapel — der Anstoß bindet die weiteren Dateien EINMAL; „Neu lesen“ legt keine Aufgabe an ──
  const personE = await neuePerson("E");
  const paketE = `FIAON-${kennung}-E`;
  await neueBestellung(personE, paketE, true);
  const fotoE = async (r: number) => sharp({ create: { width: 1200, height: 800, channels: 3, background: { r, g: 100, b: 100 } } }).jpeg().toBuffer();
  await U.unterlageHinzufuegen({ personId: personE, kategorie: "ausweis", unterart: "personalausweis", datei: { buffer: await fotoE(10), name: "vorne.jpg" }, wer: kunde, herkunft: "portal" });
  await U.unterlageHinzufuegen({ personId: personE, kategorie: "ausweis", unterart: "personalausweis", datei: { buffer: await fotoE(20), name: "hinten.jpg" }, wer: kunde, herkunft: "portal" });
  const seitenE = async () => { const [z] = (await lauf`SELECT id_card_pdf AS b FROM fiaon_applications WHERE ref = ${paketE}`) as any[]; return z?.b ? pdfLesen.pdfSeiten(Buffer.from(z.b)) : 0; };
  ok2((await seitenE()) === 1, "Erste Datei des Stapels sofort gebunden, die zweite wartet auf den Anstoß");
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute' WHERE person_id = ${personE} AND kategorie = 'ausweis'`;
  await U.anstossAusfuehren(personE, "ausweis");
  const [aufgE] = (await lauf`SELECT count(*)::int AS n, max(text) AS t FROM fiaon_vermerke WHERE ref = ${paketE} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok2((await seitenE()) === 2 && Number(aufgE.n) === 1, "Anstoß bindet den Stapel (2 Seiten) und legt EINE Aufgabe an");
  await U.sofortLesen(personE, "ausweis", team);
  const [vonE] = (await lauf`SELECT anstoss_von FROM fiaon_unterlagen_akte WHERE person_id = ${personE} AND kategorie = 'ausweis'`) as any[];
  await lauf`UPDATE fiaon_vermerke SET status = 'erledigt' WHERE ref = ${paketE} AND text LIKE 'Unterlagen eingegangen%'`;
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NOW() - INTERVAL '1 minute' WHERE person_id = ${personE} AND kategorie = 'ausweis'`;
  await U.anstossAusfuehren(personE, "ausweis");
  const [aufgE2] = (await lauf`SELECT count(*)::int AS n FROM fiaon_vermerke WHERE ref = ${paketE} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok2(vonE?.anstoss_von === "neu_lesen" && Number(aufgE2.n) === 1, "„Neu lesen“ nach erledigter Aufgabe → keine neue Aufgabe „Unterlagen eingegangen“");

  // ── Nachbesserung: Personen-Zusammenführung zerlegt die Akte nicht (P1) und verliert keinen Altbestand (P1b/P7) ──
  const mergeFall = async (nr: string, gewinnerVorbereiten: (pid: number, ref: string) => Promise<void>) => {
    const g = await neuePerson(`G${nr}`); const v = await neuePerson(`V${nr}`);
    const gRef = `FIAON-${kennung}-G${nr}`; const vRef = `FIAON-${kennung}-V${nr}`;
    await neueBestellung(g, gRef, true); await neueBestellung(v, vRef, true);
    await gewinnerVorbereiten(g, gRef);
    for (const m of [8, 9]) await U.unterlageHinzufuegen({ personId: v, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(m)), name: `v${m}.pdf` }, wer: kunde, herkunft: "portal" });
    await U.akteFassungBinden(v, "kontoauszug");
    return { g, v, gRef, vRef };
  };
  const zusammen = async (f: { g: number; v: number }, pruefen: (tx: any) => Promise<void>): Promise<string | null> => {
    try {
      await lauf.begin(async (tx: any) => {
        await personenZusammenfuehren(f.v, f.g, { betreuer: "gewinner" }, { name: "Prüfstand" }, { tx });
        await pruefen(tx);
        throw new Error("zurückrollen");
      });
    } catch (e) { if (String((e as Error).message) !== "zurückrollen") return String((e as Error).message).slice(0, 200); }
    return null;
  };
  const aktivKa = async (tx: any, pid: number) => (await tx`SELECT id, herkunft, dateiname, entfernt_grund, LENGTH(inhalt) AS n FROM fiaon_dokumente
      WHERE person_id = ${pid} AND art = 'unterlage' AND kategorie = 'kontoauszug' AND entfernt_am IS NULL ORDER BY id`) as any[];
  const seitenAn = async (tx: any, pid: number) => {
    const z = (await tx`SELECT bank_statement_pdf AS b FROM fiaon_applications WHERE person_id = ${pid} AND LENGTH(bank_statement_pdf) > 0`) as any[];
    return { fassungen: z.length, seiten: z.length ? await pdfLesen.pdfSeiten(Buffer.from(z[0].b)) : 0, text: z.length ? await pdfLesen.pdfText(Buffer.from(z[0].b)) : "" };
  };
  // P1: Gewinner hat g1 (gebunden), Verlierer v1 + v2 (gebunden).
  const f1 = await mergeFall("1", async (g) => { await U.unterlageHinzufuegen({ personId: g, kategorie: "kontoauszug", datei: { buffer: await textPdf(auszugZeilen(7)), name: "g7.pdf" }, wer: kunde, herkunft: "portal" }); });
  let p1 = { aktiv: 0, entfernt: 0, fassungen: 0, seiten: 0, neu: -1 };
  const f1Fehler = await zusammen(f1, async (tx) => {
    const a = await aktivKa(tx, f1.g);
    const [weg] = (await tx`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${f1.g} AND art = 'unterlage' AND entfernt_grund LIKE '%außerhalb geänderten%'`) as any[];
    const s1 = await seitenAn(tx, f1.g);
    p1 = { aktiv: a.length, entfernt: Number(weg.n), fassungen: s1.fassungen, seiten: s1.seiten, neu: await U.bestandUebernehmen(f1.g, "kontoauszug", tx) };
  });
  ok2(!f1Fehler && p1.aktiv === 3 && p1.entfernt === 0 && p1.fassungen === 1 && p1.seiten === 3 && p1.neu === 0,
    `Zusammenführung P1: g1 + v1 + v2 aktiv, nichts „aufgegangen“, EINE Fassung mit 3 Seiten, kein „fremd“ danach (${f1Fehler ?? JSON.stringify(p1)})`);
  // P1b/P7: Gewinner hat nur Altbestand in der Spalte (keine Zeile), Verlierer v1 + v2; danach wird v1 entfernt.
  const f2 = await mergeFall("2", async (_g, gRef) => { await lauf`UPDATE fiaon_applications SET bank_statement_pdf = ${await textPdf(auszugZeilen(6))} WHERE ref = ${gRef}`; });
  let p7 = { aktiv: 0, seiten: 0, nachEntfernen: 0, juniDa: false, bestandInhalt: 0 };
  const f2Fehler = await zusammen(f2, async (tx) => {
    const a = await aktivKa(tx, f2.g);
    const s2 = await seitenAn(tx, f2.g);
    const v8 = a.find((z: any) => z.dateiname === "v8.pdf");
    const ent2 = await U.unterlageEntfernen(f2.g, Number(v8.id), team, "falscher Monat, Kunde schickt neu", tx);
    const nach = await seitenAn(tx, f2.g);
    const best = (await aktivKa(tx, f2.g)).find((z: any) => z.herkunft === "bestand");
    p7 = { aktiv: a.length, seiten: s2.seiten, nachEntfernen: ent2.ok ? nach.seiten : -1, juniDa: /\.06\.2026/.test(nach.text), bestandInhalt: Number(best?.n ?? 0) };
  });
  ok2(!f2Fehler && p7.aktiv === 3 && p7.seiten === 3, `Zusammenführung P1b: Altbestand + v1 + v2, keine doppelten Seiten (${f2Fehler ?? `${p7.aktiv} Dateien, ${p7.seiten} Seiten`})`);
  ok2(!f2Fehler && p7.nachEntfernen === 2 && p7.juniDa && p7.bestandInhalt > 0, `P7: nach dem Entfernen bleibt der Altbestand (Juni) in Zeile und Fassung (${JSON.stringify(p7)})`);

  // ── Nachbesserung: Nachlieferung der beschafften Auskunft nach einem Trägerwechsel hängt sich an (nicht ersetzen) ──
  const { ensureBeschaffungTabelle, beschaffungHochladen } = await import("../server/lib/fiaon-auskunft-lieferung");
  await ensureBeschaffungTabelle();
  const personF = await neuePerson("F");
  const auskRefF = `FIAON-SCHUFA-${kennung}-F`;
  await neueBestellung(personF, auskRefF, true, "schufa");
  const [bF] = (await lauf`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, status, faellig_ab)
                            VALUES (${auskRefF}, ${personF}, 'DE', 'privat', 'in_arbeit', CURRENT_DATE) RETURNING id`) as any[];
  const still = { analyse: async () => null, pruefung: async () => null };
  const werF = { name: "Prüfstand", agentId: null };
  const l1 = await beschaffungHochladen(Number(bF.id), { dateien: [{ buffer: await textPdf(["SCHUFA Holding AG Datenkopie nach Art. 15 DSGVO", "Seite 1 von 1"]), name: "schufa.pdf" }], auskunfteien: ["schufa"], wer: werF, mail: false }, still);
  // Danach kauft der Kunde ein Paket — die Akte trägt ab jetzt die Paketbestellung.
  const paketF = `FIAON-${kennung}-F`;
  await neueBestellung(personF, paketF, true);
  const l2 = await beschaffungHochladen(Number(bF.id), { dateien: [{ buffer: await textPdf(["CRIF GmbH Selbstauskunft", "Seite 1 von 1"]), name: "crif.pdf" }], auskunfteien: ["crif-de"], wer: werF, mail: false }, still);
  const [akF] = (await lauf`SELECT schufa_pdf AS b FROM fiaon_applications WHERE ref = ${paketF}`) as any[];
  const textF = akF?.b ? await pdfLesen.pdfText(Buffer.from(akF.b)) : "";
  const aktivF = (await lauf`SELECT herkunft FROM fiaon_dokumente WHERE person_id = ${personF} AND art = 'unterlage' AND kategorie = 'schufa' AND entfernt_am IS NULL`) as any[];
  ok2(l1.ok && l2.ok && /SCHUFA Holding/.test(textF) && /CRIF GmbH/.test(textF) && aktivF.length === 1 && aktivF[0].herkunft === "beschaffung",
    `Nachlieferung nach Trägerwechsel hängt sich an die frühere Lieferung an — SCHUFA + CRIF in der Akte (${l1.ok ? "" : l1.text}${l2.ok ? "" : l2.text}${aktivF.length} aktiv)`);

  // Aufräumen: nur die eigenen Prüfstand-Zeilen
  const personen = [person, personB, personC, personD, personE, personF, f1.g, f1.v, f2.g, f2.v];
  await lauf`DELETE FROM fiaon_auskunft_beschaffung WHERE ref LIKE ${`%${kennung}%`}`;
  await lauf`DELETE FROM fiaon_dokumente WHERE person_id = ANY(${personen})`;
  await lauf`DELETE FROM fiaon_unterlagen_akte WHERE person_id = ANY(${personen})`;
  await lauf`DELETE FROM fiaon_app_ereignisse WHERE person_id = ANY(${personen})`;
  await lauf`DELETE FROM fiaon_contact_log WHERE ref LIKE ${`%${kennung}%`}`;
  await lauf`DELETE FROM fiaon_vermerke WHERE ref LIKE ${`%${kennung}%`}`;
  await lauf`DELETE FROM fiaon_dokument_pruefungen WHERE ref LIKE ${`%${kennung}%`}`.catch(() => {});
  await lauf`DELETE FROM fiaon_kontoauszug_analysen WHERE ref LIKE ${`%${kennung}%`}`.catch(() => {});
  await lauf`DELETE FROM fiaon_schufa_analysen WHERE ref LIKE ${`%${kennung}%`}`.catch(() => {});
  await lauf`DELETE FROM fiaon_applications WHERE ref LIKE ${`%${kennung}%`}`;
  await lauf`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
  const [rest] = (await lauf`SELECT (SELECT count(*) FROM fiaon_applications WHERE ref LIKE ${`%${kennung}%`})::int + (SELECT count(*) FROM fiaon_dokumente WHERE person_id = ANY(${personen}))::int AS n`) as any[];
  ok2(Number(rest.n) === 0, "Aufgeräumt — keine Prüfstand-Zeilen mehr");
  await sqlPool.end({ timeout: 5 });
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${gut} ok, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
