// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND DATENRAUM FÜR INVESTOREN (E-489, 09.11.2026)
//
//   Teil A — rein, ohne Datenbank und ohne Netz:
//     npx tsx scripts/pruef-datenraum.ts
//     Codes, Prüfung der Angaben, Vereinbarung mit Platzhaltern (Grammatik, Themen, Zusätze, Prüfsumme,
//     Fassungswand), Namensvergleich, die EINE Zugriffsregel, Dateitypen und -namen, Sitzungs-Plätzchen,
//     Unterschriftsbild, NDA-PDF (Text gelesen mit pdfjs) und der Vermerk auf jeder Seite (auch gedreht).
//     Mit PRUEF_NDA_QUELLE=<Papierfassung als HTML> zusätzlich: Kein Name, kein Projekt und keine Anschrift
//     des ersten Falls steht in einer Datei dieses Baus (das Repo ist öffentlich).
//
//   Teil B — gegen den lokalen Prüfstand (Postgres 18, 127.0.0.1:54329), eigene Datenbank fiaon_datenraum_test,
//   die der Lauf jedes Mal NEU anlegt; nur erfundene Testdaten, keine Mail (DATENRAUM_MAILS=aus, kein Brevo):
//     env -i PATH="$PATH" HOME="$HOME" npx tsx scripts/pruef-datenraum.ts --db
//     Die Routen laufen in einem eigenen Express auf einem freien Port — echtes HTTP mit Plätzchen:
//     falscher Code, Bremse, Eintritt, vor der Vereinbarung kein Dokument (403), Angaben, Unterschrift
//     (Prüfsumme, Häkchen, Zeichnung, Name, Roboter-Wand), danach Zugriff mit Vermerk, unsichtbar/fremd/
//     unbekannt gesperrt, Protokoll, PDF, Tagesmeldung gebündelt, Mails mit Anhang (Attrappe), Nachtrag für
//     ein neues Thema, Sperren, neuer Code, Verwaltung mit Stufen, Hochladen, und scripts/datenraum.ts
//     (Vorschau schreibt nichts, Wiederholung legt nichts doppelt an, Produktionsschutz).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { deflateSync } from "node:zlib";
import { execFileSync, spawnSync } from "node:child_process";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import {
  NDA_FASSUNG, drNdaBloecke, drNdaKanonisch, drGastAngabenPruefen, drNamePasst, drCodeNormal, drCodeAnzeige, drCodeForm,
  drSeiteName, DR_CODE_ALPHABET, type DrGastAngaben, type DrNdaEingabe,
} from "../shared/fiaon-datenraum-nda";
import {
  drCodeErzeugen, drCodeHash, drDateiTyp, drDateiname, drDispositionKopf, drPngTintePruefen, drPngAusDataUrl, drSha256,
  drTokenBauen, drTokenPruefen, drZugriff, drVermerkText, type DrZugriffLage,
} from "../server/lib/fiaon-datenraum-regeln";
import { ndaPdfErzeugen, drPdfVermerken, drPdfPruefen } from "../server/lib/fiaon-datenraum-pdf";

// ── Ergebnis ──────────────────────────────────────────────────────────────
const gruen: string[] = []; const rot: string[] = [];
function ok(name: string, bedingung: boolean, info = ""): void {
  (bedingung ? gruen : rot).push(name);
  console.log(`${bedingung ? "\x1b[32mok  \x1b[0m" : "\x1b[31mROT \x1b[0m"} ${name}${info ? ` — ${info}` : ""}`);
}
async function abschnitt(titel: string, f: () => Promise<void> | void): Promise<void> {
  console.log(`\n── ${titel}`);
  try { await f(); } catch (e) { ok(`${titel}: lief ohne Ausnahme durch`, false, e instanceof Error ? `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}` : String(e)); }
}
const ohneLeer = (s: string) => s.replace(/\s+/g, "");

// ── Hilfen: PNG, PDF, Text ────────────────────────────────────────────────
function crc32(b: Buffer): number { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t: string, d: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, "latin1"), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
/** RGBA-PNG wie ein Canvas — mit einer Sinuslinie als „Unterschrift“ (oder leer). */
function pngBild(w: number, h: number, tinte = true): Buffer {
  const roh = Buffer.alloc((w * 4 + 1) * h);
  if (tinte) for (let x = 0; x < w; x++) { const y = Math.round(h / 2 + Math.sin(x / 15) * h / 3); for (let d = -1; d <= 1; d++) { const yy = y + d; if (yy < 0 || yy >= h) continue; const o = yy * (w * 4 + 1) + 1 + x * 4; roh[o] = 18; roh[o + 1] = 40; roh[o + 2] = 74; roh[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(roh)), chunk("IEND", Buffer.alloc(0))]);
}
const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
async function probePdf(text: string, gedreht = false): Promise<Buffer> {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  const p1 = d.addPage([595, 842]); p1.drawText(`${text} Seite 1`, { x: 60, y: 760, size: 14, font: f });
  const p2 = d.addPage([595, 842]); p2.drawText(`${text} Seite 2`, { x: 60, y: 760, size: 14, font: f });
  if (gedreht) p2.setRotation(degrees(90));
  return Buffer.from(await d.save({ useObjectStreams: false }));
}
/** Ein „verschlüsseltes“ PDF: Verweis auf /Encrypt im Trailer — pdf-lib verweigert dann das Verändern. */
function verschluesselt(pdf: Buffer): Buffer {
  const s = pdf.toString("latin1");
  const i = s.lastIndexOf("trailer");
  const j = s.indexOf("<<", i);
  return Buffer.from(`${s.slice(0, j + 2)}\n/Encrypt 1 0 R${s.slice(j + 2)}`, "latin1");
}
async function pdfText(buf: Uint8Array): Promise<string[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const seiten: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); seiten.push(c.items.map((x: any) => x.str).join(" ")); }
  await task.destroy();
  return seiten;
}
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("\u0014\u0000\u0000\u0000[Content_Types].xml<Types/>PK\u0003\u0004word/document.xml<w:document/>".padEnd(300, " "), "latin1")]);
const DOCM = Buffer.concat([DOCX, Buffer.from("word/vbaProject.bin", "latin1")]);

// ── Erfundene Testdaten ────────────────────────────────────────────────────
const GAST: DrGastAngaben = { anrede: "herr", vorname: "Max", nachname: "Mustermann", firma: "Muster Beteiligungen AG", funktion: "Verwaltungsrat", strasse: "Musterweg 1", plz: "8000", ort: "Zürich", land: "Schweiz", email: "max.mustermann@example.invalid", telefon: "+41 44 000 00 00", weitergabe: "" };
const PROJEKTE = [
  { buchstabe: "A", titel: "Projekt Alpha", text: "eine mögliche Finanzierung eines erfundenen Vorhabens, insbesondere durch ein Darlehen;", geschuetzt: null },
  { buchstabe: "B", titel: "Projekt Beta", text: "der mögliche Erwerb aller Anteile an einer erfundenen Gesellschaft (die „Beta-Gesellschaft“).", geschuetzt: "die Beta-Gesellschaft" },
  { buchstabe: "C", titel: "Projekt Gamma", text: "eine mögliche Beteiligung an einer erfundenen Plattform", geschuetzt: null },
];
const EINGABE: DrNdaEingabe = { gast: GAST, projekte: PROJEKTE, raum: { vorgestellt: "zuletzt mit E-Mail vom 9. November 2026", zweck: "einer erfundenen Finanzierung (A) oder Beteiligung zu B", vorab: "die E-Mail vom 9. November 2026 samt Anlage", partei2Zusatz: null, zusatz4: "Als Geschäft mit der Beta-Gesellschaft gilt auch jeder Erwerb ihrer Anteile." } };
/**
 * Die Fassungswand: Prüfsumme der Blöcke für das feste Muster oben. Ändert jemand den Wortlaut in
 * shared/fiaon-datenraum-nda.ts, wird diese Prüfung rot — dann NDA_FASSUNG erhöhen und hier die neue Summe eintragen.
 */
const NDA_MUSTER = { fassung: "2026-11-09.1", hash: "171aaa740eb6191ac5f6d59a31ade93b58fc83004a14c3755f83ee0addd417e1" };

const nurDb = process.argv.includes("--db");
const ALLE_MEINE_DATEIEN = [
  "shared/fiaon-datenraum-nda.ts", "server/lib/fiaon-datenraum.ts", "server/lib/fiaon-datenraum-regeln.ts", "server/lib/fiaon-datenraum-pdf.ts",
  "server/routes/fiaon-datenraum.ts", "client/src/pages/datenraum-zugang.tsx", "client/src/components/admin/ChefDatenraum.tsx",
  "client/src/styles/datenraum-gast.css", "client/src/styles/chef-datenraum.css", "scripts/datenraum.ts", "scripts/pruef-datenraum.ts",
  "client/src/pages/agent/rundgaenge.ts", "client/src/pages/site/datenraum.tsx", "CHANGELOG.md",
];

// ═══════════════════════════════════════════════════════════════════════════
// TEIL A
// ═══════════════════════════════════════════════════════════════════════════
async function teilA(): Promise<void> {
  console.log("\n════ TEIL A — rein ════");
  await abschnitt("A1 Einladungscodes", () => {
    const c = drCodeErzeugen();
    ok("Code hat die Form DR-XXXX-XXXX-XXXX", /^DR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c.code), c.code.replace(/[A-Z2-9]{4}$/, "····"));
    ok("Code nur aus dem Alphabet ohne I, L, O, 0, 1", [...c.normal.slice(2)].every((x) => DR_CODE_ALPHABET.includes(x)) && !/[ILO01]/.test(c.normal.slice(2)));
    ok("Prüfsumme 64 Hex-Zeichen, Code steht nicht darin", /^[0-9a-f]{64}$/.test(c.hash) && !c.hash.includes(c.normal.toLowerCase()));
    ok("Hinweis = letzte vier Zeichen", c.hinweis === c.normal.slice(-4));
    const k = c.normal.slice(2);
    const varianten = [c.code, c.code.toLowerCase(), `DR–${k.slice(0, 4)}–${k.slice(4, 8)}–${k.slice(8)}`, `  ${k.slice(0, 4)} ${k.slice(4, 8)} ${k.slice(8)} `, k, `dr${k}`];
    ok("Schreibweisen (klein, Gedankenstrich, Leerzeichen, ohne DR) ergeben denselben Code", varianten.every((v) => drCodeNormal(v) === c.normal));
    ok("Verwechselbare Zeichen und falsche Länge → kein Code", drCodeNormal("DR-AAAA-AAAA-AAA0") === null && drCodeNormal("DR-AAAA-AAAA-AAAI") === null && drCodeNormal("DR-AAAA-AAAA") === null && drCodeNormal("") === null);
    ok("Gleiche Codes → gleiche Prüfsumme, andere → andere", drCodeHash(c.normal) === c.hash && drCodeHash(drCodeErzeugen().normal) !== c.hash);
    ok("Anzeigeform zurück", drCodeAnzeige(c.normal) === c.code);
    const form = drCodeForm(c.code.replace(/.$/, "X"));
    ok("Protokollform verrät den Code nicht", !form.includes(k.slice(0, 4)) && /Zeichen/.test(form), form);
  });

  await abschnitt("A2 Angaben für die Vereinbarung", () => {
    const g = drGastAngabenPruefen(GAST);
    ok("Vollständige Angaben gültig", g.ok);
    const leer = drGastAngabenPruefen({});
    ok("Leer: jedes Pflichtfeld mit eigenem Satz", !leer.ok && ["vorname", "nachname", "strasse", "plz", "ort", "land", "email", "telefon"].every((k) => !!(leer as any).fehler[k]));
    const ohneFirma = drGastAngabenPruefen({ ...GAST, firma: "", funktion: "" });
    ok("Firma und Funktion sind freiwillig", ohneFirma.ok);
    ok("E-Mail ohne Domain abgelehnt", !drGastAngabenPruefen({ ...GAST, email: "max@" }).ok);
    ok("Telefon mit zu wenigen Ziffern abgelehnt", !drGastAngabenPruefen({ ...GAST, telefon: "12345" }).ok);
    ok("Postleitzahl mit Sonderzeichen abgelehnt", !drGastAngabenPruefen({ ...GAST, plz: "8000!" }).ok);
    ok("Britische Postleitzahl angenommen", drGastAngabenPruefen({ ...GAST, plz: "EC1V 2NX" }).ok);
    const sauber = drGastAngabenPruefen({ ...GAST, vorname: "  Max​ ", anrede: "hacker", email: " MAX.Mustermann@Example.invalid " });
    ok("Säubert Leerraum/unsichtbare Zeichen, unbekannte Anrede → keine", sauber.ok && (sauber as any).wert.vorname === "Max" && (sauber as any).wert.anrede === "" && (sauber as any).wert.email === "max.mustermann@example.invalid");
  });

  await abschnitt("A3 Die Vereinbarung mit Platzhaltern", () => {
    const b = drNdaBloecke(EINGABE);
    const alles = b.map((x) => Object.values(x).join(" ")).join("\n");
    const text = (e: DrNdaEingabe) => drNdaBloecke(e).map((x) => Object.values(x).join(" ")).join("\n");
    ok("FIAON-Seite fest: FIAON LTD, 128 City Road, Companies House 17318250, Director", /FIAON LTD/.test(alles) && /128 City Road, London EC1V 2NX/.test(alles) && /17318250/.test(alles) && /vertreten durch ihren Director Justin Schwarzott/.test(alles));
    ok("Partei 2 mit allgemeinem Satz und „Anschrift wie Partei 1“", alles.includes("persönlich, auch wegen einer möglichen persönlichen Beteiligung an einem der Themen; geschäftsansässig c/o FIAON LTD, Anschrift wie Partei 1"));
    const p3 = b.find((x) => x.art === "partei" && x.nr === "Partei 3") as any;
    ok("Partei 3: Anrede und Name", p3?.name === "Herr Max Mustermann", p3?.name);
    ok("Partei 3: Anschrift, Funktion, Firma, benannte Gesellschaften", p3?.text === "Musterweg 1, 8000 Zürich, Schweiz, handelnd im eigenen Namen sowie als Verwaltungsrat für Muster Beteiligungen AG und für die Gesellschaften, die er der FIAON-Seite per E-Mail benennt", p3?.text);
    ok("Seiten wie in der Papierfassung (auch für später beitretende)", alles.includes("Partei 3 mit Muster Beteiligungen AG und den von ihm benannten Gesellschaften die **Mustermann-Seite**. Was diese Vereinbarung einer Seite erlaubt oder auferlegt, gilt für jede ihrer Parteien, auch für später beitretende.") && drSeiteName({ nachname: "von Muster" }) === "von-Muster-Seite");
    const themen = b.filter((x) => x.art === "thema") as any[];
    ok("Drei Themen A, B, C in § 1 — Titel und Text, Schlusszeichen ; ; .", themen.length === 3 && themen.map((t) => t.bu).join("") === "ABC" && themen[0].text.endsWith("Darlehen;") && themen[1].text.endsWith("(die „Beta-Gesellschaft“);") && themen[2].text.endsWith("Plattform."));
    ok("§ 1 Abs. 1 mit Anrede, Zahlwort und Zusatz des Raums", alles.includes("Herr Schwarzott hat Herrn Mustermann drei Themen vorgestellt, zuletzt mit E-Mail vom 9. November 2026 (die „Themen“):"));
    ok("§ 1 Abs. 2 mit dem Zweck des Raums", alles.includes("zur Prüfung einer möglichen Zusammenarbeit der Seiten zu den Themen genutzt werden, also einer erfundenen Finanzierung (A) oder Beteiligung zu B (der „Zweck“)."));
    ok("Kopfzeile nennt die Themen", (b[0] as any).text === "Gegenseitige Vereinbarung (NDA) · Themen A, B und C");
    ok("§ 2 Abs. 1: Projektkontakte nur zum Thema mit Gesellschaft (B), vorab überlassene Unterlagen", alles.includes("die die Mustermann-Seite zu B von Projektkontakten (§ 4 Abs. 1) erhält") && alles.includes("insbesondere die E-Mail vom 9. November 2026 samt Anlage, sowie Tatsache und Inhalt der Gespräche"));
    ok("§ 4 Abs. 1 nennt die Gesellschaft des Projekts als Projektkontakte", alles.includes("Geschützte Kontakte der FIAON-Seite sind ausserdem stets die Beta-Gesellschaft, jeweils mit ihren Organen") && alles.includes("(die „Projektkontakte“); welche Gesellschaften Beta-Gesellschaft sind, bestimmt die Benennung"));
    ok("§ 4 Abs. 2/3: „nur für Geschäfte zu B“, Zusatzsatz des Raums, Ausnahmen b) und c)", alles.includes("gilt dies nur für Geschäfte zu B. Als Geschäft mit der Beta-Gesellschaft gilt auch jeder Erwerb ihrer Anteile. Wird eine Seite") && alles.includes("Die Ausnahmen b) und c) gelten nicht für Geschäfte zu B mit Projektkontakten."));
    ok("§ 5: CHF 50’000 je Fall bei Umgehung oder Vertraulichkeitsbruch, Projektkontakte zu B ein Kontakt, Solidarität (Art. 150 OR)", alles.includes("Verletzt eine Partei § 4 oder die Vertraulichkeit (§§ 2, 3 und 7) –") && alles.includes("**CHF 50’000**") && alles.includes("die Projektkontakte zu B gelten als ein Kontakt") && alles.includes("Bei der Vertraulichkeit ist jede unbefugte Weitergabe oder Nutzung gegenüber demselben Empfänger zum selben Thema ein Fall.") && alles.includes("Art. 150 OR"));
    ok("§ 5 Abs. 4 mit Herr/er/seine", alles.includes("Handlungen und Verschulden der Unternehmen, die Herr Mustermann beherrscht oder für die er im Zusammenhang mit den Themen handelt, gelten als seine eigenen; er haftet dafür"));
    ok("§ 8: Annahme durch Freischaltung, Vertraulichkeit drei Jahre, Berichte zu B", alles.includes("durch die Freischaltung des Datenraums für Partei 3 angenommen hat; die Freischaltung gilt als Unterzeichnung durch die Parteien 1 und 2") && alles.includes("Die Vertraulichkeit gilt drei Jahre") && alles.includes("Analysen und Berichte zu B gilt sie, solange") && alles.includes("weitergegeben zu haben."));
    ok("§ 9 mit der E-Mail des Gastes, nur per E-Mail", alles.includes("für die FIAON-Seite an und durch Herrn Schwarzott (js@fiaon.com), für die Mustermann-Seite an und durch Herrn Mustermann (max.mustermann@example.invalid); andere Absender und Kanäle"));
    ok("§ 10: schweizerisches Recht, Gerichtsstand Zürich, Datenraum als Unterschriftsweg", alles.includes("untersteht schweizerischem Recht") && alles.includes("Ausschliesslicher Gerichtsstand ist Zürich") && alles.includes("im Online-Datenraum der FIAON-Seite elektronisch unterzeichnete Exemplare gelten als Original"));
    ok("Schweizer Schreibweise: kein ß im festen Wortlaut", !/ß/.test(drNdaBloecke({ ...EINGABE, gast: { ...GAST, strasse: "Musterweg 1" } }).filter((x) => x.art !== "partei").map((x) => Object.values(x).join(" ")).join(" ")));
    ok("Kein offener Platzhalter, kein undefined/null", !/\{\{|undefined|\bnull\b|NaN|\$\{/.test(alles));
    const frau = text({ ...EINGABE, gast: { ...GAST, anrede: "frau", vorname: "Erika", firma: "", funktion: "" } });
    ok("Frau: „Frau Erika Mustermann“, „die sie … benennt“, „von ihr benannten“, § 5 „sie/ihre“", frau.includes("Frau Erika Mustermann") && frau.includes("sowie für die Gesellschaften, die sie der FIAON-Seite per E-Mail benennt") && frau.includes("Partei 3 mit den von ihr benannten Gesellschaften") && frau.includes("die Frau Mustermann beherrscht oder für die sie im Zusammenhang mit den Themen handelt, gelten als ihre eigenen; sie haftet") && frau.includes("hat Frau Mustermann drei Themen"));
    const neutral = text({ ...EINGABE, gast: { ...GAST, anrede: "" } });
    ok("Ohne Anrede: neutral über „Partei 3“ und den vollen Namen", neutral.includes("die Gesellschaften, die Partei 3 der FIAON-Seite per E-Mail benennt") && neutral.includes("den von Partei 3 benannten Gesellschaften") && neutral.includes("die Partei 3 beherrscht oder für die Partei 3 im Zusammenhang mit den Themen handelt, gelten als ihre eigenen; Partei 3 haftet") && neutral.includes("hat Max Mustermann drei Themen") && !neutral.includes("Herr Max") && !neutral.includes("Herrn Mustermann"));
    const eins = text({ ...EINGABE, projekte: [{ ...PROJEKTE[0], geschuetzt: null }], raum: {} });
    ok("Ein Thema, ohne Zusätze: „folgendes Thema“, allgemeine Projektkontakte, „zu den Themen“", eins.includes("Herr Schwarzott hat Herrn Mustermann folgendes Thema vorgestellt (die „Themen“):") && eins.includes("Thema A") && eins.includes("stets die in § 1 beschriebenen Gesellschaften, jeweils mit ihren Organen") && eins.includes("welche Gesellschaften gemeint sind") && eins.includes("nur für Geschäfte zu den Themen.") && eins.includes("die Projektkontakte eines Themas gelten jeweils als ein Kontakt") && eins.includes("genutzt werden (der „Zweck“).") && !eins.includes("samt Anlage"));
    const zwei = text({ ...EINGABE, projekte: [PROJEKTE[0], { ...PROJEKTE[1], geschuetzt: "die Betagesellschaft" }, { ...PROJEKTE[2], geschuetzt: "die Gamma-Gesellschaft" }] });
    ok("Zwei Gesellschaften: Ergänzungsstrich und „B oder C“ / „B und C“", zwei.includes("stets die Betagesellschaft und die Gamma-Gesellschaft, jeweils") && zwei.includes("welche Gesellschaften Beta- und Gamma-Gesellschaft sind") && zwei.includes("nur für Geschäfte zu B oder C.") && zwei.includes("die Projektkontakte zu B und die zu C gelten jeweils als ein Kontakt") && zwei.includes("Analysen und Berichte zu B und C"));
    const zus = text({ ...EINGABE, raum: { partei2Zusatz: "auch wegen einer erfundenen Beteiligung" } });
    ok("Zusatz für Partei 2 ersetzt den allgemeinen Satz", zus.includes("persönlich, auch wegen einer erfundenen Beteiligung; geschäftsansässig c/o FIAON LTD, Anschrift wie Partei 1"));
    const weiter = text({ ...EINGABE, gast: { ...GAST, weitergabe: "Erika Beispiel (Beispiel AG)" } });
    ok("§ 8 Abs. 1: frühere Weitergabe des Gastes steht darin", weiter.includes("weitergegeben zu haben, ausser an: Erika Beispiel (Beispiel AG); diese gelten als ihre Empfänger nach § 3."));
    const h1 = drSha256(drNdaKanonisch(b));
    ok("Gleiche Eingabe → gleiche Prüfsumme", h1 === drSha256(drNdaKanonisch(drNdaBloecke(EINGABE))));
    ok("Andere Anschrift → andere Prüfsumme", h1 !== drSha256(drNdaKanonisch(drNdaBloecke({ ...EINGABE, gast: { ...GAST, ort: "Basel" } }))));
    ok(`Fassungswand: Wortlaut passt zu Fassung ${NDA_FASSUNG}`, NDA_FASSUNG === NDA_MUSTER.fassung && h1 === NDA_MUSTER.hash, `Muster-Prüfsumme ${h1}`);
  });

  await abschnitt("A4 Name der Unterschrift", () => {
    ok("Voller Name passt (auch klein)", drNamePasst("Max Mustermann", GAST) && drNamePasst("max mustermann", GAST) && drNamePasst("Dr. Max Mustermann", GAST));
    ok("Nur Nachname / Initiale passt nicht", !drNamePasst("Mustermann", GAST) && !drNamePasst("M. Mustermann", GAST) && !drNamePasst("Maxi Mustermann", GAST));
    ok("Akzente und ß", drNamePasst("Jurgen Strasser", { vorname: "Jürgen", nachname: "Straßer" }));
  });

  await abschnitt("A5 Die EINE Zugriffsregel", () => {
    const basis: DrZugriffLage = { angemeldet: true, gastRaumId: 1, gastGesperrt: false, raumArchiviert: false, ndaProjektIds: [10, 11], dokument: { raumId: 1, projektId: 10, sichtbar: true, entfernt: false, projektEntfernt: false } };
    const z = (p: Partial<DrZugriffLage>, d: Partial<NonNullable<DrZugriffLage["dokument"]>> = {}) => drZugriff({ ...basis, ...p, dokument: p.dokument === null ? null : { ...basis.dokument!, ...d } });
    const s = (r: ReturnType<typeof drZugriff>) => (r.erlaubt ? 200 : `${r.status}/${r.grund}`);
    ok("Mit Vereinbarung, sichtbar, eigenes Thema → erlaubt", s(z({})) === 200);
    ok("Ohne Sitzung → 401", s(z({ angemeldet: false })) === "401/anmeldung");
    ok("Gesperrt → 403", s(z({ gastGesperrt: true })) === "403/gesperrt");
    ok("Raum archiviert → 403", s(z({ raumArchiviert: true })) === "403/gesperrt");
    ok("Fremder Raum → 404", s(z({}, { raumId: 2 })) === "404/unbekannt");
    ok("Unsichtbar → 404", s(z({}, { sichtbar: false })) === "404/unbekannt");
    ok("Entfernt → 404", s(z({}, { entfernt: true })) === "404/unbekannt");
    ok("Projekt entfernt → 404", s(z({}, { projektEntfernt: true })) === "404/unbekannt");
    ok("Unbekanntes Dokument → 404", s(z({ dokument: null })) === "404/unbekannt");
    ok("Vor der Vereinbarung → 403 (nda)", s(z({ ndaProjektIds: null })) === "403/nda");
    ok("Thema nicht in der Vereinbarung → 403 (nachtrag)", s(z({ ndaProjektIds: [11] })) === "403/nachtrag");
    ok("Fremdes Dokument vor der Vereinbarung bleibt 404 (verrät nichts)", s(z({ ndaProjektIds: null }, { raumId: 2 })) === "404/unbekannt");
  });

  await abschnitt("A6 Dateitypen und Dateinamen", async () => {
    const pdf = await probePdf("Probe");
    const typ = (b: Buffer) => { const t = drDateiTyp(b); return "fehler" in t ? `FEHLER: ${t.fehler}` : `${t.art}/${t.endung}`; };
    ok("PDF erkannt", typ(pdf) === "pdf/pdf");
    ok("PNG erkannt", typ(pngBild(120, 40)) === "bild/png");
    ok("JPG erkannt", typ(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)])) === "bild/jpg");
    ok("Word (OOXML) erkannt", typ(DOCX) === "office/docx", typ(DOCX));
    ok("Office mit Makros abgelehnt", typ(DOCM).startsWith("FEHLER") && /Makros/.test(typ(DOCM)));
    ok("HTML mit PDF-Namen abgelehnt", typ(Buffer.from("<html><script>alert(1)</script></html>".padEnd(64, " "))).startsWith("FEHLER"));
    ok("SVG abgelehnt", typ(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>".padEnd(64, " "))).startsWith("FEHLER"));
    ok("Altes Office (OLE) abgelehnt", typ(Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64)])).startsWith("FEHLER"));
    ok("ZIP ohne Office-Inhalt abgelehnt", typ(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)])).startsWith("FEHLER"));
    ok("Über 25 MB abgelehnt", typ(Buffer.concat([pdf, Buffer.alloc(25 * 1024 * 1024)])).startsWith("FEHLER"));
    ok("Dateiname ohne Pfad, Endung vom Inhalt", drDateiname("../../etc/Bilanz 2025.exe", "pdf") === "Bilanz 2025.pdf", drDateiname("../../etc/Bilanz 2025.exe", "pdf"));
    ok("Steuer- und Richtungszeichen entfernt", !/[‮\u0000]/.test(drDateiname("rechnung‮fdp.exe\u0000", "pdf")));
    const kopf = drDispositionKopf("attachment", "Übersicht „A“.pdf");
    ok("Antwortkopf: ASCII-Name plus UTF-8-Form, keine Anführungszeichen im Namen", /^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''/.test(kopf) && !/".*".*"/.test(kopf.split(";")[1]), kopf);
  });

  await abschnitt("A7 Sitzungs-Plätzchen", () => {
    const t = drTokenBauen(7, 3, "geheim-a", 1_000_000);
    ok("Gültig mit gleichem Geheimnis", JSON.stringify(drTokenPruefen(t, "geheim-a", 1_000_001)) === JSON.stringify({ gastId: 7, version: 3 }));
    ok("Anderes Geheimnis → ungültig", drTokenPruefen(t, "geheim-b", 1_000_001) === null);
    ok("Abgelaufen → ungültig", drTokenPruefen(t, "geheim-a", 1_000_000 + 8 * 24 * 3600_000) === null);
    const teile = t.split(".");
    ok("Andere Gast-Kennung mit alter Signatur → ungültig", drTokenPruefen([8, ...teile.slice(1)].join("."), "geheim-a", 1_000_001) === null);
    ok("Unsinn → ungültig", drTokenPruefen("1.1.1", "geheim-a") === null && drTokenPruefen(undefined, "geheim-a") === null && drTokenPruefen("x".repeat(500), "geheim-a") === null);
  });

  await abschnitt("A8 Unterschriftsbild", () => {
    ok("Bild mit Tinte gültig", drPngTintePruefen(pngBild(300, 90)) === null);
    ok("Leeres Bild abgelehnt", drPngTintePruefen(pngBild(300, 90, false)) !== null);
    ok("Kein PNG abgelehnt", drPngTintePruefen(Buffer.from("kein bild".padEnd(300, "x"))) !== null && drPngTintePruefen(null) !== null);
    ok("Data-URL gelesen, andere Formate nicht", !!drPngAusDataUrl(dataUrl(pngBild(80, 30))) && drPngAusDataUrl("data:image/svg+xml;base64,PHN2Zz4=") === null);
  });

  await abschnitt("A9 Vereinbarung als PDF und der Vermerk", async () => {
    const b = drNdaBloecke(EINGABE);
    const hash = drSha256(drNdaKanonisch(b));
    const am = new Date("2026-11-09T14:42:00Z");
    const pdf = Buffer.from(await ndaPdfErzeugen({ bloecke: b, fassung: NDA_FASSUNG, textHash: hash, seite: drSeiteName(GAST), raumTitel: "Muster-Raum", partei3: { name: "Max Mustermann", getippt: "Max Mustermann", unterschriftPng: pngBild(420, 120) }, unterzeichnetAm: am, freigeschaltetAm: am, ip: "203.0.113.9", userAgent: "Mozilla/5.0 Probe" }));
    const seiten = await pdfText(pdf);
    const t = ohneLeer(seiten.join(" "));
    ok("PDF mit mehreren Seiten", seiten.length >= 3, `${seiten.length} Seiten`);
    ok("Partei 3, Themen und § 10 stehen im PDF", t.includes(ohneLeer("Herr Max Mustermann")) && t.includes("ProjektBeta") && t.includes(ohneLeer("Ausschliesslicher Gerichtsstand ist Zürich")));
    ok("Annahmevermerk der FIAON-Seite mit Zeitpunkt", t.includes(ohneLeer("Angenommen durch FIAON LTD und Justin Schwarzott mit der Freischaltung des Datenraums am 9. November 2026 um 15:42 Uhr")));
    ok("Nachweis: Prüfsumme, IP, getippter Name, einfache elektronische Signatur", t.includes(hash) && t.includes("203.0.113.9") && t.includes(ohneLeer("Name getippt: „Max Mustermann“")) && t.includes(ohneLeer("einfache elektronische Signatur")));
    ok("Fuß „Seite x von y“ und Fassung auf jeder Seite", seiten.every((s, i) => ohneLeer(s).includes(`Seite${i + 1}von${seiten.length}`) && ohneLeer(s).includes(`Fassung${NDA_FASSUNG}`)));
    const probe = await probePdf("Probedokument", true);
    const vermerk = drVermerkText("Max Mustermann", am);
    ok("Vermerktext", vermerk === "Vertraulich · Max Mustermann · 09.11.2026", vermerk);
    const mit = await drPdfVermerken(probe, vermerk);
    const mitText = await pdfText(mit);
    ok("Vermerk auf jeder Seite (auch der gedrehten)", mitText.length === 2 && mitText.every((s) => ohneLeer(s).includes(ohneLeer(vermerk))), mitText.map((s) => s.slice(-60)).join(" | "));
    ok("Inhalt der Seiten bleibt", ohneLeer(mitText[0]).includes("ProbedokumentSeite1"));
    const pr = await drPdfPruefen(probe);
    ok("Normales PDF: Vermerk möglich, Seiten gezählt", pr.vermerkMoeglich && pr.seiten === 2);
    const zu = verschluesselt(probe);
    const prz = await drPdfPruefen(zu);
    ok("Verschlüsseltes PDF: ohne Vermerk, mit Grund", !prz.vermerkMoeglich && /verschlüsselt/.test(String(prz.grund)), String(prz.grund));
    let warf = false; try { await drPdfVermerken(zu, vermerk); } catch { warf = true; }
    ok("Vermerk auf verschlüsseltem PDF wirft (Auslieferung nimmt dann das Original und protokolliert)", warf);
  });

  await abschnitt("A10 Kein Inhalt des ersten Falls im Repo", () => {
    const quelle = process.env.PRUEF_NDA_QUELLE;
    if (!quelle || !fs.existsSync(quelle)) { console.log("   übersprungen — PRUEF_NDA_QUELLE (Papierfassung als HTML) nicht gesetzt."); return; }
    const html = fs.readFileSync(quelle, "utf8").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&shy;|­/g, "");
    const ohneTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const nadeln = new Set<string>();
    const p3 = /Partei 3<\/p>\s*<p class="p-name">([\s\S]*?)<\/p>\s*<p class="p-text">([\s\S]*?)<\/p>/.exec(html);
    if (p3) {
      const name = ohneTags(p3[1]).replace(/^(Herr|Frau)\s+/, "").trim();
      const text = ohneTags(p3[2]);
      nadeln.add(name); nadeln.add(name.split(/\s+/).pop()!);
      const teile = text.split(",").map((x) => x.trim());
      if (teile[0]) nadeln.add(teile[0]);
      const ort = /\d{4,5}\s+([^\s,]+)/.exec(text); if (ort) nadeln.add(ort[1]);
      const firma = /sowie für (.+?) und (?:für )?die/.exec(text); if (firma) nadeln.add(firma[1].trim());
    }
    for (const m of html.matchAll(/<i>([\s\S]*?)<\/i>/g)) { const t = ohneTags(m[1]); nadeln.add(t); const w = t.split(/\s+/); if (w[0] === "Projekt" && w[1]) nadeln.add(w[1]); }
    for (const m of html.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) if (!/@fiaon\.com$/i.test(m[0])) nadeln.add(m[0]);
    const liste = [...nadeln].filter((n) => n.length >= 4);
    ok("Aus der Papierfassung gelesen: Name, Anschrift, Firma, Projekte, E-Mail", liste.length >= 6, `${liste.length} Begriffe`);
    const funde: string[] = [];
    for (const f of ALLE_MEINE_DATEIEN) {
      const p = path.join(process.cwd(), f);
      if (!fs.existsSync(p)) continue;
      const inhalt = fs.readFileSync(p, "utf8").toLowerCase();
      for (const n of liste) if (inhalt.includes(n.toLowerCase())) funde.push(`${f}: ${n.slice(0, 2)}…`);
    }
    ok("Kein Begriff des ersten Falls in den Dateien dieses Baus", funde.length === 0, funde.join(", "));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL B — lokaler Prüfstand
// ═══════════════════════════════════════════════════════════════════════════
const PG = "/opt/homebrew/opt/postgresql@18/bin";
const DB_NAME = "fiaon_datenraum_test";
const DB_URL = `postgresql://fiaon@127.0.0.1:54329/${DB_NAME}?sslmode=require`;
const SECRET = "pruefstand-datenraum-geheim";

async function teilB(): Promise<void> {
  console.log("\n════ TEIL B — lokaler Prüfstand (127.0.0.1:54329) ════");
  // Nur die eigene Prüfdatenbank — sie wird jedes Mal neu angelegt.
  const pgEnv = { ...process.env, PGSSLMODE: "require" };
  execFileSync(`${PG}/dropdb`, ["-h", "127.0.0.1", "-p", "54329", "-U", "fiaon", "--if-exists", DB_NAME], { env: pgEnv, stdio: "pipe" });
  execFileSync(`${PG}/createdb`, ["-h", "127.0.0.1", "-p", "54329", "-U", "fiaon", DB_NAME], { env: pgEnv, stdio: "pipe" });
  process.env.DATABASE_URL = DB_URL;
  process.env.SESSION_SECRET = SECRET;
  process.env.DATENRAUM_MAILS = "aus";
  process.env.APP_BASE_URL = "https://www.fiaon.com";
  delete process.env.BREVO_API_KEY; delete process.env.MAKE_WEBHOOK_URL;
  (process.env as any).NODE_ENV = "test";

  const { sqlPool } = await import("../server/lib/db-pool");
  // Eine schmale fiaon_agents, damit die Chef-Wand ihr Protokoll schreiben kann (wie in der Produktion).
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_agents (id SERIAL PRIMARY KEY, name TEXT)`;
  await sqlPool`INSERT INTO fiaon_agents (name) VALUES ('Prüfstand Geschäftsführung'), ('Prüfstand Leitung')`;
  const L = await import("../server/lib/fiaon-datenraum");
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const router = (await import("../server/routes/fiaon-datenraum")).default;
  await L.drSchema();
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use("/api/fiaon", router);
  const server = await new Promise<import("node:http").Server>((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = (server.address() as any).port as number;
  const BASIS = `http://127.0.0.1:${port}/api/fiaon`;
  const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

  class Sitzung {
    kekse = new Map<string, string>(); letzteSetCookie: string[] = [];
    constructor(public ip: string | null = "203.0.113.10", public ua = BROWSER) {}
    async ruf(pfad: string, koerper?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; j: any; roh: Buffer; kopf: Headers }> {
      const res = await fetch(`${BASIS}${pfad}`, {
        method: koerper === undefined ? "GET" : "POST",
        headers: { "User-Agent": this.ua, ...(this.ip ? { "X-Forwarded-For": this.ip } : {}), ...(koerper !== undefined && !(koerper instanceof FormData) ? { "Content-Type": "application/json" } : {}), Cookie: [...this.kekse].map(([k, v]) => `${k}=${v}`).join("; "), ...extra },
        body: koerper === undefined ? undefined : koerper instanceof FormData ? koerper : JSON.stringify(koerper),
      });
      this.letzteSetCookie = res.headers.getSetCookie?.() ?? [];
      for (const c of this.letzteSetCookie) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); const wert = v.join("="); if (!wert || /Expires=Thu, 01 Jan 1970/i.test(c)) this.kekse.delete(k.trim()); else this.kekse.set(k.trim(), wert); }
      const roh = Buffer.from(await res.arrayBuffer());
      let j: any = null; try { j = JSON.parse(roh.toString("utf8")); } catch { j = null; }
      return { status: res.status, j, roh, kopf: res.headers };
    }
  }
  const chefKeks = (agentId: number, stufe: string) => {
    const exp = Date.now() + 3600_000;
    const sig = createHmac("sha256", SECRET).update(`chefzugang:${agentId}:${stufe}:${exp}`).digest("hex").slice(0, 40);
    return `${agentId}.${stufe}.${exp}.${sig}`;
  };
  const anzahl = async (art: string, gastId?: number) => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_protokoll WHERE art = ${art} AND (${gastId ?? null}::bigint IS NULL OR gast_id = ${gastId ?? null}::bigint)`) as any[])[0].n);

  // ── Aufbau mit erfundenen Daten ──
  const WER = "Prüfstand";
  const raum = await L.drRaumAnlegen({ titel: "Prüfraum PRUEFSTAND", nda: { vorgestellt: "zuletzt mit E-Mail vom 9. November 2026" }, projekte: PROJEKTE.map((p, i) => ({ schluessel: ["alpha", "beta", "gamma"][i], titel: p.titel, beschreibung: `Ordner ${p.titel}`, ndaText: p.text, geschuetzt: p.geschuetzt ?? "" })) }, WER) as any;
  const fremd = await L.drRaumAnlegen({ titel: "Fremder Raum PRUEFSTAND", projekte: [{ schluessel: "x", titel: "Projekt Fremd" }] }, WER) as any;
  const akte0: any = await L.drRaumAkte(raum.id);
  const [pA, pB, pC] = akte0.projekte;
  const docA1 = await L.drDokumentAblegen({ projektId: pA.id, buffer: await probePdf("Unterlage A1", true), dateiname: "A1 Uebersicht.pdf", titel: "A1 Übersicht", beschreibung: "Ein Satz.", nr: 1 }, WER) as any;
  const docA2 = await L.drDokumentAblegen({ projektId: pA.id, buffer: await probePdf("Unterlage A2"), dateiname: "A2 intern.pdf", titel: "A2 intern", sichtbar: false, nr: 2 }, WER) as any;
  const docB1 = await L.drDokumentAblegen({ projektId: pB.id, buffer: pngBild(200, 120), dateiname: "Lageplan.png", titel: "B1 Plan", nr: 1 }, WER) as any;
  const docC1 = await L.drDokumentAblegen({ projektId: pC.id, buffer: DOCX, dateiname: "Gamma.docx", titel: "C1 Word", nr: 1 }, WER) as any;
  const akteF: any = await L.drRaumAkte(fremd.id);
  const docF = await L.drDokumentAblegen({ projektId: akteF.projekte[0].id, buffer: await probePdf("Fremd"), dateiname: "Fremd.pdf", titel: "Fremd" }, WER) as any;
  const einladung = await L.drGastEinladen(raum.id, { anrede: "herr", vorname: "Max", nachname: "Mustermann", email: GAST.email, firma: "Muster Beteiligungen AG" }, WER) as any;

  await abschnitt("B0 Aufbau", async () => {
    ok("Raum, Projekte A–C, fremder Raum angelegt", raum.ok && fremd.ok && [pA, pB, pC].map((p: any) => p.buchstabe).join("") === "ABC");
    ok("Dokumente abgelegt (PDF, unsichtbares PDF, PNG, Word)", docA1.ok && docA2.ok && docB1.ok && docC1.ok && docF.ok && docA1.vermerkMoeglich === true);
    ok("Gleicher Inhalt zweimal → keine zweite Zeile", (await L.drDokumentAblegen({ projektId: pA.id, buffer: await probePdf("Unterlage A1", true), dateiname: "A1.pdf", titel: "A1 Übersicht", nr: 1 }, WER) as any).neu === false);
    ok("Gast eingeladen, Code und Link einmal", einladung.ok && /^DR-/.test(einladung.code) && einladung.link === `https://www.fiaon.com/datenraum/zugang?c=${encodeURIComponent(einladung.code)}`);
    const [g] = (await sqlPool`SELECT code_hash, code_hinweis FROM fiaon_dr_gaeste WHERE id = ${einladung.id}`) as any[];
    ok("In der Datenbank nur die Prüfsumme des Codes", g.code_hash === drCodeHash(drCodeNormal(einladung.code)!) && !JSON.stringify(g).includes(einladung.code.slice(3, 12)));
  });

  const gast = new Sitzung("203.0.113.10");
  let gastId = 0; let ndaHash = "";
  await abschnitt("B1 Eintritt und Bremse", async () => {
    const falsch = await gast.ruf("/datenraum/eintreten", { code: "DR-AAAA-BBBB-CCCC" });
    ok("Falscher Code → 403", falsch.status === 403 && /stimmt nicht/.test(falsch.j?.error ?? ""));
    const bremse = new Sitzung("198.51.100.7");
    for (let i = 0; i < 5; i++) await bremse.ruf("/datenraum/eintreten", { code: `DR-AAAA-BBBB-CCC${"DEFGH"[i]}` });
    const gebremst = await bremse.ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Nach 5 Fehlversuchen je Anschluss → 429, auch mit richtigem Code", gebremst.status === 429, String(gebremst.status));
    ok("Fehlversuche stehen im Protokoll — ohne den eingegebenen Code", (await anzahl("code_falsch")) === 6 && !((await sqlPool`SELECT string_agg(detail, ' ') AS d FROM fiaon_dr_protokoll WHERE art = 'code_falsch'`) as any[])[0].d.includes("AAAA"));
    const rein = await gast.ruf("/datenraum/eintreten", { code: einladung.code.toLowerCase().replace(/-/g, " ") });
    ok("Richtiger Code (klein, mit Leerzeichen) → eingetreten", rein.status === 200 && rein.j?.angemeldet === true && rein.j?.schritt === "angaben", JSON.stringify(rein.j)?.slice(0, 120));
    const keks = gast.letzteSetCookie.find((c) => c.startsWith("fiaon_dr=")) ?? "";
    ok("Plätzchen: httpOnly, SameSite=Strict, Pfad /api/fiaon/datenraum", /HttpOnly/i.test(keks) && /SameSite=Strict/i.test(keks) && /Path=\/api\/fiaon\/datenraum/i.test(keks), keks.replace(/=[^;]+/, "=…"));
    ok("Vorbefüllt mit dem Hinterlegten, Projekte ohne Dokumente", rein.j?.gast?.vorname === "Max" && rein.j?.gast?.firma === "Muster Beteiligungen AG" && rein.j?.projekte?.length === 3 && rein.j.projekte.every((p: any) => p.dokumente.length === 0 && p.anzahl === null));
    ok("Antwort ohne Speicher (no-store) und noindex", /no-store/.test(rein.kopf.get("cache-control") ?? "") && /noindex/.test(rein.kopf.get("x-robots-tag") ?? ""));
    gastId = einladung.id;
  });

  await abschnitt("B2 Vor der Vereinbarung kein Dokument", async () => {
    const d = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("Dokument vor der Vereinbarung → 403", d.status === 403 && d.j?.code === "NDA", `${d.status} ${d.j?.code}`);
    const n = await gast.ruf("/datenraum/nda");
    ok("Vereinbarung erst nach den Angaben (409)", n.status === 409);
    const ohne = await new Sitzung().ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("Ohne Sitzung → 401", ohne.status === 401);
  });

  await abschnitt("B3 Angaben", async () => {
    const schlecht = await gast.ruf("/datenraum/angaben", { angaben: { ...GAST, plz: "", email: "kaputt" } });
    ok("Fehlende/falsche Felder → 400 mit Satz je Feld", schlecht.status === 400 && !!schlecht.j?.fehler?.plz && !!schlecht.j?.fehler?.email);
    const gut = await gast.ruf("/datenraum/angaben", { angaben: GAST });
    ok("Gültige Angaben → Vereinbarung mit Prüfsumme", gut.status === 200 && Array.isArray(gut.j?.nda?.bloecke) && /^[0-9a-f]{64}$/.test(gut.j?.nda?.hash ?? ""));
    const text = JSON.stringify(gut.j?.nda?.bloecke ?? []);
    ok("Vereinbarung nennt den Gast und die drei Projekte", text.includes("Herr Max Mustermann") && text.includes("Projekt Alpha") && text.includes("Projekt Gamma") && text.includes("zuletzt mit E-Mail vom 9. November 2026"));
    ok("Antwort ohne interne Kennungen", !("projektIds" in (gut.j?.nda ?? {})) && !("eingabe" in (gut.j?.nda ?? {})));
    ndaHash = gut.j?.nda?.hash ?? "";
    const st = await gast.ruf("/datenraum/stand");
    ok("Stand jetzt „vereinbarung“", st.j?.schritt === "vereinbarung");
  });

  await abschnitt("B4 Unterschrift", async () => {
    const sig = dataUrl(pngBild(360, 110));
    const basis = { textHash: ndaHash, gelesen: true, name: "Max Mustermann", png: sig };
    const r1 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, textHash: "0".repeat(64) });
    ok("Falsche Prüfsumme → 409 GEAENDERT", r1.status === 409 && r1.j?.code === "GEAENDERT");
    const r2 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, gelesen: false });
    ok("Ohne Häkchen → 400", r2.status === 400 && r2.j?.code === "GELESEN");
    const r3 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, png: dataUrl(pngBild(360, 110, false)) });
    ok("Leeres Zeichenfeld → 400", r3.status === 400 && r3.j?.code === "ZEICHNUNG");
    const r4 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, name: "M. Mustermann" });
    ok("Name passt nicht → 400 mit dem erwarteten Namen", r4.status === 400 && r4.j?.code === "NAME" && /Max Mustermann/.test(r4.j?.error ?? ""));
    const roboter = new Sitzung(null); roboter.kekse = new Map(gast.kekse);
    const r5 = await roboter.ruf("/datenraum/unterzeichnen", basis);
    ok("Von der Maschine selbst (127.0.0.1) → 403 (Roboter-Wand)", r5.status === 403 && r5.j?.code === "ROBOTER");
    const kopflos = new Sitzung("203.0.113.10", "Mozilla/5.0 HeadlessChrome/120"); kopflos.kekse = new Map(gast.kekse);
    const r6 = await kopflos.ruf("/datenraum/unterzeichnen", basis);
    ok("Automatisierter Browser → 403", r6.status === 403 && r6.j?.code === "ROBOTER");
    ok("Bis hier keine Vereinbarung gespeichert", Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda`) as any[])[0].n) === 0);
    const r7 = await gast.ruf("/datenraum/unterzeichnen", basis);
    ok("Unterzeichnet → sofort der Raum", r7.status === 200 && r7.j?.schritt === "raum" && !!r7.j?.nda?.unterzeichnetAm, `${r7.status} ${JSON.stringify(r7.j)?.slice(0, 160)}`);
    const sichtbar = (r7.j?.projekte ?? []).flatMap((p: any) => p.dokumente.map((d: any) => d.titel));
    ok("Nur sichtbare Dokumente in der Liste (A1, B1, C1 — nicht A2)", sichtbar.sort().join(",") === "A1 Übersicht,B1 Plan,C1 Word", sichtbar.join(","));
    ok("Word nur zum Herunterladen, PDF/Bild auch ansehen", (r7.j?.projekte ?? []).flatMap((p: any) => p.dokumente).every((d: any) => d.ansehen === (d.typ !== "Word")));
    const r8 = await gast.ruf("/datenraum/unterzeichnen", basis);
    const [n] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Doppelter Klick → keine zweite Vereinbarung", r8.status === 200 && r8.j?.schon === true && Number(n.n) === 1);
    const [z] = (await sqlPool`SELECT fassung, text_hash, ip, user_agent, unterschrift_name, length(unterschrift_png) AS png, length(pdf) AS pdf, pdf_sha256, sha256(pdf) AS echt, angenommen_am = unterzeichnet_am AS gleich, projekt_ids FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Gespeichert: Fassung, Prüfsumme, IP, Browser, Name, Bild, PDF", z.fassung === NDA_FASSUNG && z.text_hash === ndaHash && z.ip === "203.0.113.10" && /Safari/.test(z.user_agent) && z.unterschrift_name === "Max Mustermann" && Number(z.png) > 200 && Number(z.pdf) > 5000);
    ok("PDF-Prüfsumme stimmt, Annahme = Freischaltung", z.pdf_sha256 === Buffer.from(z.echt).toString("hex") && z.gleich === true && (z.projekt_ids as any[]).length === 3);
  });

  await abschnitt("B5 Zugriff nach der Vereinbarung", async () => {
    const d = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("PDF ansehen → 200 inline", d.status === 200 && d.kopf.get("content-type") === "application/pdf" && /^inline;/.test(d.kopf.get("content-disposition") ?? ""));
    ok("Kein Speicher, nosniff, noindex", /no-store/.test(d.kopf.get("cache-control") ?? "") && d.kopf.get("x-content-type-options") === "nosniff" && /noindex/.test(d.kopf.get("x-robots-tag") ?? ""));
    const t = await pdfText(d.roh);
    const heute = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    ok("Vermerk „Vertraulich · Name · Datum“ auf jeder Seite (auch gedreht)", t.length === 2 && t.every((s) => ohneLeer(s).includes(ohneLeer(`Vertraulich · Max Mustermann · ${heute}`))), t.map((s) => s.slice(-50)).join(" | "));
    const l = await gast.ruf(`/datenraum/dokument/${docA1.kennung}?laden=1`);
    ok("Herunterladen → attachment mit Dateiname", l.status === 200 && /^attachment; filename="A1_Uebersicht.pdf"/.test(l.kopf.get("content-disposition") ?? ""), l.kopf.get("content-disposition") ?? "");
    const bild = await gast.ruf(`/datenraum/dokument/${docB1.kennung}`);
    ok("Bild inline als image/png (ohne Vermerk, unverändert)", bild.status === 200 && bild.kopf.get("content-type") === "image/png" && bild.roh.equals(pngBild(200, 120)));
    const word = await gast.ruf(`/datenraum/dokument/${docC1.kennung}`);
    ok("Word immer als Download", word.status === 200 && /^attachment;/.test(word.kopf.get("content-disposition") ?? "") && /wordprocessingml/.test(word.kopf.get("content-type") ?? ""));
    const unsichtbar = await gast.ruf(`/datenraum/dokument/${docA2.kennung}`);
    ok("Unsichtbares Dokument → 404", unsichtbar.status === 404);
    const fremdDok = await gast.ruf(`/datenraum/dokument/${docF.kennung}`);
    ok("Dokument eines fremden Raums → 404", fremdDok.status === 404);
    const unbekannt = await gast.ruf("/datenraum/dokument/AAAAAAAAAAAAAAAAAAAAAA");
    const kaputt = await gast.ruf("/datenraum/dokument/..%2F..%2Fetc");
    ok("Unbekannte oder kaputte Kennung → 404", unbekannt.status === 404 && kaputt.status === 404);
    ok("Jede Ansicht im Protokoll (2 PDF-Ansichten/Downloads, Bild, Word)", (await anzahl("dokument_angesehen", gastId)) === 3 && (await anzahl("dokument_geladen", gastId)) === 1);
    ok("Verweigerte Zugriffe im Protokoll", (await anzahl("zugriff_verweigert", gastId)) >= 4);
    const eigen = await gast.ruf("/datenraum/nda.pdf");
    const et = ohneLeer((await pdfText(eigen.roh)).join(" "));
    ok("Eigenes Exemplar als PDF mit Name, Prüfsumme und Annahme", eigen.status === 200 && et.includes(ohneLeer("Herr Max Mustermann")) && et.includes(ndaHash) && et.includes(ohneLeer("Angenommen durch FIAON LTD und Justin Schwarzott")));
  });

  await abschnitt("B6 Meldungen — gebündelt, mit Anhang, ohne echte Mail", async () => {
    const [m] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_tagesmeldung WHERE gast_id = ${gastId}`) as any[];
    ok("Mehrere Ansichten → genau EINE Tagesmeldung", Number(m.n) === 1);
    const post: any[] = [];
    const attrappe: any = async (x: any) => { post.push(x); return { ok: true, messageId: `pruef-${post.length}` }; };
    const [n0] = (await sqlPool`SELECT id, mail_gast_am, mail_gast_fehler FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Nach der Unterschrift: Mails abgeschaltet (DATENRAUM_MAILS=aus) → Fehler notiert, nichts gesendet", !n0.mail_gast_am && /abgeschaltet/.test(String(n0.mail_gast_fehler)));
    await L.drMailsNachUnterschrift(Number(n0.id), attrappe);
    const anGast = post.find((p) => p.an === GAST.email); const anJustin = post.find((p) => p.an === "js@fiaon.com");
    ok("Kopie an den Gast: Sie-Anrede, PDF im Anhang, Antwort an Justin, Link zum Raum", !!anGast && anGast.anrede === "Sehr geehrter Herr Mustermann," && anGast.anhaenge?.[0]?.inhalt.subarray(0, 5).toString() === "%PDF-" && anGast.antwortAn?.email === "js@fiaon.com" && /datenraum\/raum/.test(anGast.text));
    ok("Meldung an Justin: „hat die NDA unterschrieben“ mit PDF", !!anJustin && anJustin.betreff === "Max Mustermann hat die NDA unterschrieben" && anJustin.anhaenge?.length === 1);
    const [n1] = (await sqlPool`SELECT mail_gast_am, mail_justin_am FROM fiaon_dr_nda WHERE id = ${n0.id}`) as any[];
    ok("Versand vermerkt", !!n1.mail_gast_am && !!n1.mail_justin_am);
    post.length = 0;
    await L.drMailsNachUnterschrift(Number(n0.id), attrappe);
    ok("Kein zweiter Versand", post.length === 0);
    const etwas = await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 0 });
    const tages = post.find((p) => /liest/.test(p.betreff));
    ok("Tagesmeldung an Justin mit allen geöffneten Unterlagen", etwas && !!tages && tages.an === "js@fiaon.com" && /A · A1 Übersicht/.test(tages.text) && /B · B1 Plan/.test(tages.text) && /3 Unterlagen/.test(tages.betreff), tages?.betreff);
    post.length = 0;
    await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 0 });
    ok("Am selben Tag keine zweite Tagesmeldung", post.length === 0);
  });

  await abschnitt("B7 Nachtrag für ein neues Thema", async () => {
    const pD = await L.drProjektSpeichern(raum.id, { schluessel: "delta", titel: "Projekt Delta", ndaText: "ein erfundenes viertes Vorhaben" }, WER) as any;
    const st0 = await gast.ruf("/datenraum/stand");
    ok("Neues Projekt ohne Unterlagen → noch kein Nachtrag", st0.j?.nachtrag === false && pD.buchstabe === "D");
    const docD = await L.drDokumentAblegen({ projektId: pD.id, buffer: await probePdf("Delta"), dateiname: "Delta.pdf", titel: "D1 Delta" }, WER) as any;
    const st = await gast.ruf("/datenraum/stand");
    ok("Mit Unterlagen → Nachtrag angezeigt, Ordner D noch ohne Dokumente", st.j?.nachtrag === true && st.j.projekte.find((p: any) => p.buchstabe === "D")?.abgedeckt === false);
    const zu = await gast.ruf(`/datenraum/dokument/${docD.kennung}`);
    ok("Dokument des neuen Themas → 403 (Nachtrag)", zu.status === 403 && zu.j?.code === "NACHTRAG");
    const n = await gast.ruf("/datenraum/nda");
    ok("Ergänzte Vereinbarung nennt vier Themen (neue Prüfsumme)", n.j?.nda?.hash !== ndaHash && JSON.stringify(n.j?.nda?.bloecke).includes("vier Themen") && JSON.stringify(n.j?.nda?.bloecke).includes("Projekt Delta"));
    const u = await gast.ruf("/datenraum/unterzeichnen", { textHash: n.j.nda.hash, gelesen: true, name: "Max Mustermann", png: dataUrl(pngBild(300, 100)) });
    ok("Ergänzung unterzeichnet → kein Nachtrag mehr", u.status === 200 && u.j?.nachtrag === false);
    const auf = await gast.ruf(`/datenraum/dokument/${docD.kennung}`);
    ok("Danach Zugriff auf das neue Thema", auf.status === 200);
    const [c] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Zwei Vereinbarungen im Bestand (keine überschrieben)", Number(c.n) === 2);
  });

  await abschnitt("B8 Sperren und neuer Code", async () => {
    await L.drGastSperren(gastId, true, "Prüfstand", WER);
    const st = await gast.ruf("/datenraum/stand");
    ok("Gesperrt → Sitzung sofort ungültig", st.j?.angemeldet === false);
    const d = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("Gesperrt → Dokument 401", d.status === 401);
    const wieder = await new Sitzung("203.0.113.11").ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Gesperrt → Eintritt 403 mit Hinweis", wieder.status === 403 && wieder.j?.code === "GESPERRT");
    await L.drGastSperren(gastId, false, null, WER);
    const neu = new Sitzung("203.0.113.12");
    const rein = await neu.ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Entsperrt → wieder eintreten, direkt im Raum", rein.status === 200 && rein.j?.schritt === "raum");
    const c2 = await L.drGastCodeNeu(gastId, WER) as any;
    const alt = await new Sitzung("203.0.113.13").ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Neuer Code → alter Code 403", c2.ok && alt.status === 403);
    const st2 = await neu.ruf("/datenraum/stand");
    ok("Neuer Code → offene Sitzung beendet", st2.j?.angemeldet === false);
    const jetzt = await new Sitzung("203.0.113.14").ruf("/datenraum/eintreten", { code: c2.code });
    ok("Neuer Code → eintreten", jetzt.status === 200);
  });

  await abschnitt("B9 Verwaltung im Chefbüro (Stufen, Hochladen, Sichtbarkeit)", async () => {
    const ohne = await new Sitzung().ruf("/chef/datenraum");
    ok("Ohne Chef-Anmeldung → 401", ohne.status === 401);
    const leitung = new Sitzung(); leitung.kekse.set("fiaon_chef", chefKeks(2, "leitung"));
    const l = await leitung.ruf("/chef/datenraum");
    ok("Leitung → 403 (nur Inhaber/Geschäftsführung)", l.status === 403 && l.j?.code === "STUFE_ZU_NIEDRIG");
    const gf = new Sitzung(); gf.kekse.set("fiaon_chef", chefKeks(1, "geschaeftsfuehrung"));
    const liste = await gf.ruf("/chef/datenraum");
    ok("Geschäftsführung → Liste", liste.status === 200 && liste.j?.raeume?.length >= 2);
    const zuordnen = await gf.ruf(`/chef/datenraum/raum/${raum.id}`, { firmaId: 4711 });
    const proPartner = await gf.ruf("/chef/datenraum?firma=4711");
    ok("Raum einem Partner zuordnen → erscheint beim Partner, der fremde bleibt „ohne Partner“", zuordnen.j?.ok && proPartner.j?.raeume?.some((r: any) => r.id === raum.id) && proPartner.j?.ohnePartner?.some((r: any) => r.id === fremd.id));
    const akte = await gf.ruf(`/chef/datenraum/raum/${raum.id}`);
    const g = akte.j?.gaeste?.find((x: any) => x.id === gastId);
    ok("Akte: Gast „NDA unterschrieben“ mit zwei Fassungen, Protokoll gefüllt", g?.status === "unterzeichnet" && g?.ndas?.length === 2 && akte.j?.protokoll?.length > 10);
    ok("Akte verrät keinen Code", !JSON.stringify(akte.j).includes(einladung.code) && /^…[A-Z2-9]{4}$/.test(g?.codeHinweis ?? ""));
    const fd = new FormData();
    fd.append("titel", "B2 Hochgeladen"); fd.append("beschreibung", "Über die Verwaltung."); fd.append("sichtbar", "0");
    fd.append("datei", new Blob([await probePdf("Hochgeladen")], { type: "application/pdf" }), "hochgeladen.pdf");
    const up = await gf.ruf(`/chef/datenraum/projekt/${pB.id}/dokument`, fd);
    ok("Hochladen über die Verwaltung (unsichtbar)", up.status === 200 && up.j?.neu === true && up.j?.vermerkMoeglich === true);
    const html = new FormData(); html.append("datei", new Blob(["<html><script>x</script></html>".padEnd(80, " ")], { type: "application/pdf" }), "boese.pdf");
    const boese = await gf.ruf(`/chef/datenraum/projekt/${pB.id}/dokument`, html);
    ok("HTML mit PDF-Etikett → 400", boese.status === 400);
    const vorher = await new Sitzung("203.0.113.14").ruf("/datenraum/stand");
    ok("Unsichtbar hochgeladen → Gast sieht es (noch) nicht", vorher.status === 200);
    const an = await gf.ruf(`/chef/datenraum/dokument/${up.j.id}`, { sichtbar: true });
    ok("Sichtbarkeit umschalten", an.j?.ok && /sichtbar/.test(an.j?.meldung ?? ""));
    const pdfChef = await gf.ruf(`/chef/datenraum/nda/${g.ndas[0].id}`);
    ok("NDA-PDF für die Verwaltung", pdfChef.status === 200 && pdfChef.roh.subarray(0, 5).toString() === "%PDF-");
    const orig = await gf.ruf(`/chef/datenraum/dokument/${docA2.id}`);
    ok("Original ansehen (auch unsichtbar) für die Verwaltung", orig.status === 200 && orig.kopf.get("content-type") === "application/pdf");
    ok("Verwaltungsschritte im Protokoll (Hochladen, Sichtbar, Einladung)", (await anzahl("dokument_hochgeladen")) >= 6 && (await anzahl("dokument_sichtbar")) === 1 && (await anzahl("gast_eingeladen")) === 1);
  });

  await abschnitt("B10 scripts/datenraum.ts", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dr-pruef-"));
    try {
      const lauf = (args: string[], url = DB_URL) => spawnSync(path.join(process.cwd(), "node_modules/.bin/tsx"), ["scripts/datenraum.ts", ...args], {
        cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: url, SESSION_SECRET: SECRET, APP_BASE_URL: "https://www.fiaon.com" }, timeout: 120_000,
      });
      const schutz = lauf(["liste"], "postgresql://x@db.example.invalid:5432/x?sslmode=require");
      ok("Fremde Datenbank ohne --produktion → Abbruch (Code 2)", schutz.status === 2 && /--produktion/.test(schutz.stderr), schutz.stderr.trim().slice(0, 120));
      fs.writeFileSync(path.join(tmp, "raum.json"), JSON.stringify({ titel: "Skript-Raum PRUEFSTAND", nda: { vorgestellt: "zuletzt am 9. November 2026" }, projekte: [{ schluessel: "eins", titel: "Projekt Eins", beschreibung: "Erstes" }, { schluessel: "zwei", titel: "Projekt Zwei", beschreibung: "Zweites" }] }));
      const raeumeVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume`) as any[])[0].n);
      const vorschau = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json")]);
      ok("Vorschau schreibt nichts", vorschau.status === 0 && Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume`) as any[])[0].n) === raeumeVorher && /Vorschau/.test(vorschau.stdout));
      const a = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--schreiben"]);
      const b = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--schreiben"]);
      const [sr] = (await sqlPool`SELECT id FROM fiaon_dr_raeume WHERE titel = 'Skript-Raum PRUEFSTAND'`) as any[];
      const nRaeume = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume WHERE titel = 'Skript-Raum PRUEFSTAND'`) as any[])[0].n);
      ok("raum-anlegen legt an, zweiter Lauf gleicht ab (kein zweiter Raum)", a.status === 0 && b.status === 0 && nRaeume === 1 && /abgeglichen/.test(b.stdout), (a.stderr + b.stderr).slice(0, 200));
      for (const [ordner, docs] of [["A_eins", [["1.pdf", "Erste Unterlage", true]]], ["zwei", [["z.pdf", "Zweite Unterlage", false], ["bild.png", "Ein Bild", true]]]] as const) {
        fs.mkdirSync(path.join(tmp, "ordner", ordner), { recursive: true });
        const manifest = [];
        for (const [i, [datei, titel, sichtbar]] of docs.entries()) {
          fs.writeFileSync(path.join(tmp, "ordner", ordner, datei), datei.endsWith(".png") ? pngBild(150, 80) : await probePdf(`${titel}`));
          manifest.push({ nr: i + 1, titel, beschreibung: `${titel} — ein Satz.`, datei, sichtbar_standard: sichtbar });
        }
        fs.writeFileSync(path.join(tmp, "ordner", ordner, "manifest.json"), JSON.stringify(manifest));
      }
      const h1 = lauf(["hochladen", "--raum", String(sr.id), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const h2 = lauf(["hochladen", "--raum", String(sr.id), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const docs = (await sqlPool`SELECT titel, sichtbar FROM fiaon_dr_dokumente WHERE raum_id = ${sr.id} AND entfernt_am IS NULL ORDER BY titel`) as any[];
      ok("hochladen: Ordner → Projekt (Buchstabe oder Schlüssel), Sichtbarkeit aus dem Manifest", h1.status === 0 && docs.length === 3 && docs.find((d: any) => d.titel === "Zweite Unterlage")?.sichtbar === false, (h1.stderr || h1.stdout).slice(-200));
      ok("hochladen zweimal → nichts doppelt (SHA-256)", h2.status === 0 && /0 neu, 0 ersetzt, 3 unverändert/.test(h2.stdout), h2.stdout.slice(-120));
      fs.writeFileSync(path.join(tmp, "ordner", "A_eins", "1.pdf"), await probePdf("Erste Unterlage, neue Fassung"));
      const h3 = lauf(["hochladen", "--raum", String(sr.id), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const [ersetzt] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_dokumente WHERE raum_id = ${sr.id} AND entfernt_am IS NOT NULL AND ersetzt_durch IS NOT NULL`) as any[];
      ok("Neue Fassung derselben Datei ersetzt die alte (alte bleibt in der Datenbank)", h3.status === 0 && /1 ersetzt/.test(h3.stdout) && Number(ersetzt.n) === 1);
      const g1 = lauf(["gast-anlegen", "--raum", String(sr.id), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--anrede", "frau", "--schreiben"]);
      const code = /Code:\s+(DR-[A-Z2-9-]+)/.exec(g1.stdout)?.[1] ?? "";
      ok("gast-anlegen gibt Code und Link einmal aus", g1.status === 0 && !!code && /Link:\s+https:\/\/www\.fiaon\.com\/datenraum\/zugang\?c=DR-/.test(g1.stdout));
      const g2 = lauf(["gast-anlegen", "--raum", String(sr.id), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--schreiben"]);
      ok("Gleicher Gast noch einmal → Abbruch mit Hinweis auf --neuer-code", g2.status === 2 && /--neuer-code/.test(g2.stderr));
      const rein = await new Sitzung("203.0.113.20").ruf("/datenraum/eintreten", { code });
      ok("Der Code aus dem Skript öffnet den Skript-Raum", rein.status === 200 && rein.j?.raum?.titel === "Skript-Raum PRUEFSTAND");
      const s1 = lauf(["sichtbar", "--raum", String(sr.id), "--alle", "--aus", "--schreiben"]);
      const [unsicht] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_dokumente WHERE raum_id = ${sr.id} AND entfernt_am IS NULL AND sichtbar`) as any[];
      ok("sichtbar --alle --aus schaltet alle Unterlagen des Raums unsichtbar", s1.status === 0 && Number(unsicht.n) === 0);
      const li = lauf(["liste", "--raum", String(sr.id)]);
      ok("liste zeigt Projekte, Unterlagen und Gäste — ohne Code", li.status === 0 && /Projekt Eins/.test(li.stdout) && /Erika Musterfrau/.test(li.stdout) && !li.stdout.includes(code));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  await new Promise((r) => server.close(() => r(null)));
  await sqlPool.end({ timeout: 5 });
}

// ═══════════════════════════════════════════════════════════════════════════
await teilA();
if (nurDb) {
  try { await teilB(); } catch (e) { ok("Teil B lief ohne Ausnahme durch", false, e instanceof Error ? `${e.message}\n${e.stack}` : String(e)); }
} else console.log("\nTeil B übersprungen — mit --db gegen den lokalen Prüfstand.");
console.log(`\n${rot.length ? "\x1b[31m" : "\x1b[32m"}${gruen.length} grün, ${rot.length} rot\x1b[0m`);
if (rot.length) { console.log("ROT:\n  " + rot.join("\n  ")); process.exit(1); }
process.exit(0);
