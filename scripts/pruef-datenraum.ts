// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND DATENRAUM FÜR INVESTOREN (E-489, 09.11.2026; Nachbesserung nach drei Gutachten am selben Tag)
//
//   Teil A — rein, ohne Datenbank und ohne Netz:
//     npx tsx scripts/pruef-datenraum.ts
//     Codes (HMAC), Prüfung der Angaben (nur Namenszeichen, kein §/*/;/:, lateinische Schrift, Telefon freiwillig,
//     Anlage-1-Liste), Vereinbarung mit Platzhaltern (§ 8 fest, Anlage 1, Fassungswand), Namensvergleich (gleich,
//     nicht „enthält“), die EINE Zugriffsregel, Dateitypen und -namen, Sitzungs-Plätzchen, Geheimnis in der
//     Produktion, Unterschriftsbild (auch eine „Bombe“), IP hinter Cloudflare, Warteschlange, NDA-PDF (Nachweis,
//     Anlage, Entwurf) und der Vermerk mit Vorgangsnummer, Vergleich mit einer Papierfassung, Messung aus auf den
//     Seiten des Datenraums (Einwilligungs-Hinweis, Kopfzeilen, robots.txt).
//     Raumtour: Bühnen-Schema (Prüfung, Grenzen, Säubern), keine Bühne ohne Vereinbarung (dieselbe Regel wie
//     Dokumente), Anfragen (Vertragsentwurf, Frage) nur aus einer Sitzung mit Vereinbarung, Eingabe und Bremse.
//     Mit PRUEF_NDA_QUELLE=<Papierfassung als HTML> zusätzlich: (1) Fallsätze aus der Papierfassung lesen, die Vorlage
//     damit setzen und Abschnitt für Abschnitt vergleichen — nur § 8 Abs. 1, § 10 Abs. 5 und Anlage 1 dürfen
//     abweichen; (2) kein Name, kein Projekt und keine Anschrift des ersten Falls steht in einer Datei dieses Baus.
//
//   Teil B — gegen den lokalen Prüfstand (Postgres 18, 127.0.0.1:54329), eigene Datenbank fiaon_datenraum_test,
//   die der Lauf jedes Mal NEU anlegt; nur erfundene Testdaten, keine Mail (DATENRAUM_MAILS=aus, Attrappen):
//     env -i PATH="$PATH" HOME="$HOME" npx tsx scripts/pruef-datenraum.ts --db
//     Die Routen laufen in einem eigenen Express auf einem freien Port — echtes HTTP mit Plätzchen, der Gast kommt
//     „über Cloudflare“ (cf-connecting-ip + X-Forwarded-For „Gast, Rand“): falscher Code, Bremse je Anschluss,
//     viele falsche Codes sperren niemanden (Alarm), Eintritt, vor der Vereinbarung kein Dokument (403) und keine
//     Ordnerbeschreibung, Angaben (Namensberichtigung, neue E-Mail mit Code), Unterschrift (Prüfsumme, Häkchen,
//     Zeichnung, Bombe, Name, Roboter-Wand, Bremse), gespeicherter Nachweis (IP des Gastes, Kette, Wortlaut, Zustimmung),
//     Angaben danach fest (409), Zugriff mit Vermerk und Vorgangsnummer, HEAD zählt nicht, Abruf-Bremse,
//     unsichtbar/fremd/unbekannt gesperrt, Protokoll mit Kette (Manipulation wird erkannt), PDF und Entwurf, Tagesmeldung,
//     Mails mit vollen Prüfsummen, Nachtrag (neues und geändertes Thema, erst nach Freigabe), Sperren, neuer Code,
//     Verwaltung nur Inhaber (Ansichten im Protokoll, Vorschau, Freigabe, Einladung erst nach Freigabe, Entwurf in js@,
//     CSV), Wiedervorlage in der Partner-Akte, und scripts/datenraum.ts.
//     Raumtour über HTTP (B13): Bühnen aus raum.json, Einladung erst nach der Freigabe, 401/403 vor Sitzung/Vereinbarung,
//     nur abgedeckte Themen, Vertragsentwurf und Frage mit Protokoll (Kette), Doppelklick-Schutz, Meldung an Justin mit
//     Antwort an den Gast (Attrappe), Bremse 429, geändertes Thema → Bühne zu bis zum Nachtrag (wie die Dokumente).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { deflateSync } from "node:zlib";
import { execFileSync, spawnSync } from "node:child_process";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import {
  NDA_FASSUNG, DR_PFLICHT, drNdaBloecke, drNdaKanonisch, drGastAngabenPruefen, drNamePasst, drCodeNormal, drCodeAnzeige, drCodeForm,
  drSeiteName, drWeitergabeListe, DR_CODE_ALPHABET, type DrGastAngaben, type DrNdaEingabe, type DrNdaBlock,
} from "../shared/fiaon-datenraum-nda";
import {
  drCodeErzeugen, drCodeHash, drDateiTyp, drDateiname, drDispositionKopf, drPngTintePruefen, drPngAusDataUrl, drSha256, drGeheimnis,
  drTokenBauen, drTokenPruefen, drZugriff, drVermerkText, drClientIp, drIstCloudflare, drAnschluss, drWarteschlange, type DrZugriffLage,
} from "../server/lib/fiaon-datenraum-regeln";
import { ndaPdfErzeugen, drPdfVermerken, drPdfPruefen } from "../server/lib/fiaon-datenraum-pdf";
import { drPapierBloecke, drVorlageTextBloecke, drVergleichen, drAusPapier, drWortDiff } from "../server/lib/fiaon-datenraum-vergleich";
import { drAnfragePruefen, drBuehneKurz, drBuehnePruefen } from "../shared/fiaon-datenraum-buehne";
import { drAnfrageGebremst, drAnfrageZugriff, drBuehnenFreigeben, type DrTourLage } from "../server/lib/fiaon-datenraum-tour-regeln";

// ── Ergebnis ──────────────────────────────────────────────────────────────
const gruen: string[] = []; const rot: string[] = [];
function ok(name: string, bedingung: boolean, info = ""): void {
  (bedingung ? gruen : rot).push(name);
  console.log(`${bedingung ? "\x1b[32mok  \x1b[0m" : "\x1b[31mROT \x1b[0m"} ${name}${info ? ` — ${info}` : ""}`);
}
async function abschnitt(titel: string, f: () => Promise<void> | void): Promise<void> {
  console.log(`\n── ${titel}`);
  try { await f(); } catch (e) { ok(`${titel}: lief ohne Ausnahme durch`, false, e instanceof Error ? `${e.message}\n${stapel(e)}` : String(e)); }
}
/** Die ersten Stellen der Stack-Spur — eigene Dateien zuerst (die Zeilen aus node_modules sagen selten, wo es klemmt). */
function stapel(e: Error): string {
  const rahmen = (e.stack ?? "").split("\n").slice(1);
  const eigen = rahmen.filter((z) => !z.includes("node_modules"));
  return (eigen.length ? eigen : rahmen).slice(0, 4).join("\n");
}
const ohneLeer = (s: string) => s.replace(/\s+/g, "");

// ── Hilfen: PNG, PDF, Text ────────────────────────────────────────────────
function crc32(b: Buffer): number { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t: string, d: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, "latin1"), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
/** RGBA-PNG wie ein Canvas — mit einer Sinuslinie als „Unterschrift“ (oder leer). */
function pngBild(w: number, h: number, tinte = true, verschachtelt = false): Buffer {
  const roh = Buffer.alloc((w * 4 + 1) * h);
  if (tinte) for (let x = 0; x < w; x++) { const y = Math.round(h / 2 + Math.sin(x / 15) * h / 3); for (let d = -1; d <= 1; d++) { const yy = y + d; if (yy < 0 || yy >= h) continue; const o = yy * (w * 4 + 1) + 1 + x * 4; roh[o] = 18; roh[o + 1] = 40; roh[o + 2] = 74; roh[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[12] = verschachtelt ? 1 : 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(roh)), chunk("IEND", Buffer.alloc(0))]);
}
/** Eine „Bombe“: Kopf sagt 2000 × 1000, der gepackte Inhalt entpackt sich aber zu 60 MB Nullen (+ etwas Tinte vorn). */
function pngBombe(): Buffer {
  const w = 2000; const h = 1000;
  const roh = Buffer.alloc(60 * 1024 * 1024);
  for (let x = 1; x < 4000; x++) roh[x] = 200;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(roh, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
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

/** Eine Papierfassung im Aufbau der Hausvorlage — aus den Blöcken gesetzt, mit dem Papier-Wortlaut in § 8 Abs. 1 und § 10 Abs. 5. */
function papierAusBloecken(bl: DrNdaBlock[], rolle: string): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(§|Abs\.|Nr\.) (\d)/g, "$1&nbsp;$2");
  let html = "<html><head><style>.x{}</style></head><body><main class=\"blatt\"><header class=\"kopfzeile\"><span>FIAON</span></header>";
  let para = ""; let inParteien = false; let inThemen = false; let inListe = false;
  const zu = () => { if (inParteien) { html += "</div>"; inParteien = false; } if (inThemen) { html += "</ul>"; inThemen = false; } if (inListe) { html += "</ul>"; inListe = false; } };
  for (const b of bl) {
    if (b.art !== "partei") { if (inParteien) { html += "</div>"; inParteien = false; } }
    if (b.art !== "thema" && inThemen) { html += "</ul>"; inThemen = false; }
    if (b.art !== "punkt" && inListe) { html += "</ul>"; inListe = false; }
    switch (b.art) {
      case "auge": html += `<p class="auge">${e(b.text)}</p>`; break;
      case "titel": html += `<h1>${e(b.text)}</h1>`; break;
      case "unter": html += `<p class="unter">${e(b.text)}</p>`; break;
      case "zwischen": html += `<p class="zwischen">${e(b.text)}</p>`; break;
      case "partei": if (!inParteien) { html += "<div class=\"parteien\">"; inParteien = true; } html += `<div class="partei"><p class="p-nr">${b.nr}</p><p class="p-name">${e(b.name)}</p><p class="p-text">${e(b.text)}</p></div>`; break;
      case "text": html += `<p class="seiten">${e(b.text)}</p>`; break;
      case "paragraf": para = b.nr; html += `<section class="para"><h2><span class="nr">${b.nr}</span> ${e(b.titel)}</h2>`; break;
      case "abs": {
        let t = b.text;
        if (para === "§ 8" && b.z === "(1)") t = "Diese Vereinbarung tritt mit den drei Unterschriften unten in Kraft und gilt auch für zuvor ausgetauschte Informationen (§ 2 Abs. 1). Jede Seite bestätigt, vor Unterzeichnung erhaltene Informationen nur an Personen nach § 3 Abs. 2 weitergegeben zu haben, ausser an: (sonst: keine); diese gelten als ihre Empfänger nach § 3.";
        if (para === "§ 10" && b.z === "(5)") t = "Diese Vereinbarung und ihre Änderungen können in Gegenstücken unterzeichnet werden. Eingescannte oder über eine gängige Signaturplattform elektronisch unterzeichnete Exemplare gelten als Original und wahren die Schriftform.";
        html += b.z ? `<p class="abs"><span class="z">${b.z} </span>${e(t)}</p>` : para === "§ 4" ? `<p class="nach">${e(t)}</p>` : `<p>${e(t)}</p>`;
        break;
      }
      case "punkt": if (!inListe) { html += "<ul class=\"liste\">"; inListe = true; } html += `<li><span class="z">${b.z} </span>${e(b.text)}</li>`; break;
      case "thema": if (!inThemen) { html += "<ul class=\"themen\">"; inThemen = true; } html += `<li><span class="bu">${b.bu} </span><i>${e(b.titel)}</i> – ${e(b.text)}</li>`; break;
      case "anlage": break;
    }
  }
  zu();
  html += `<section class="unterschriften"><h2>Unterschriften</h2><div class="u-feld"><p class="u-wer">Partei 3 · X</p><p class="u-rolle">${e(rolle)}</p></div></section></main></body></html>`;
  return html;
}

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
const NDA_MUSTER = { fassung: "2026-11-09.2", hash: "c73ce82ef9438de908786fe91f5a9a784f53c72599bdd4670c172de17004ff1d" };
/** Eine erfundene Bühne (Raumtour) — jede Zahl und jeder Satz ausgedacht. */
const BUEHNE_MUSTER = {
  hauptprojekt: true,
  kicker: "Hauptprojekt · Muster",
  claim: "Ein erfundenes Vorhaben, ruhig und klar erzählt.",
  untertitel: "Alle Werte dieses Musters sind ausgedacht — sie prüfen nur die Darstellung.",
  kennzahlen: [
    { wert: "€ 4,2 Mio.", label: "Musterwert A" },
    { wert: "1.250", label: "Musterwert B", hinweis: "ausgedacht" },
    { wert: "36 Monate", label: "Musterwert C" },
  ],
  kurve: {
    titel: "Erfundene Entwicklung", einheit: "Mio. €", fussnote: "Beispielkurve für den Prüfstand.",
    reihen: [
      { name: "Plan", punkte: [{ x: 2026, y: 1.2 }, { x: 2027, y: 2.1 }, { x: 2028, y: 3.4 }, { x: 2029, y: 4.2 }] },
      { name: "Vorsichtig", punkte: [{ x: 2026, y: 1.1 }, { x: 2027, y: 1.7 }, { x: 2028, y: 2.6 }, { x: 2029, y: 3.1 }] },
    ],
  },
  kapitel: [
    { titel: "Das Vorhaben", text: "Ein erfundener Absatz.\nUnd noch einer.", dokumente: [1, 1, 2] },
    { titel: "Der Ablauf", text: "Ein zweiter erfundener Absatz." },
  ],
  abschluss: { knopf: "Vertragsentwurf anfordern", satz: "Unverbindlich — ein erfundener Satz." },
  hinweis: "Alle Angaben dieses Musters sind erfunden.",
};

const nurDb = process.argv.includes("--db");
const ALLE_MEINE_DATEIEN = [
  "shared/fiaon-datenraum-nda.ts", "server/lib/fiaon-datenraum.ts", "server/lib/fiaon-datenraum-regeln.ts", "server/lib/fiaon-datenraum-pdf.ts",
  "server/lib/fiaon-datenraum-vergleich.ts", "server/routes/fiaon-datenraum.ts", "client/src/pages/datenraum-zugang.tsx",
  "client/src/components/admin/ChefDatenraum.tsx", "client/src/styles/datenraum-gast.css", "client/src/styles/chef-datenraum.css", "scripts/datenraum.ts",
  "scripts/pruef-datenraum.ts", "client/src/pages/agent/rundgaenge.ts", "client/src/pages/site/datenraum.tsx", "client/src/pages/privacy.tsx",
  "client/src/components/site/EinwilligungsHinweis.tsx", "client/public/robots.txt", "CHANGELOG.md",
  "shared/fiaon-datenraum-buehne.ts", "server/lib/fiaon-datenraum-tour.ts", "server/lib/fiaon-datenraum-tour-regeln.ts",
  "client/src/components/datenraum/Raumtour.tsx", "client/src/styles/datenraum-tour.css",
];

// ═══════════════════════════════════════════════════════════════════════════
// TEIL A
// ═══════════════════════════════════════════════════════════════════════════
async function teilA(): Promise<void> {
  console.log("\n════ TEIL A — rein ════");
  await abschnitt("A1 Einladungscodes", () => {
    const c = drCodeErzeugen("geheim-a");
    ok("Code hat die Form DR-XXXX-XXXX-XXXX", /^DR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c.code), c.code.replace(/[A-Z2-9]{4}$/, "····"));
    ok("Code nur aus dem Alphabet ohne I, L, O, 0, 1", [...c.normal.slice(2)].every((x) => DR_CODE_ALPHABET.includes(x)) && !/[ILO01]/.test(c.normal.slice(2)));
    ok("Prüfsumme 64 Hex-Zeichen, Code steht nicht darin", /^[0-9a-f]{64}$/.test(c.hash) && !c.hash.includes(c.normal.toLowerCase()));
    ok("Prüfsumme ist ein HMAC: anderes Geheimnis → andere Summe, reine SHA-256 ist es nicht", drCodeHash(c.normal, "geheim-b") !== c.hash && drSha256(`fiaon-dr-code.v1:${c.normal}`) !== c.hash && drCodeHash(c.normal, "geheim-a") === c.hash);
    ok("Hinweis = nur noch die letzten ZWEI Zeichen", c.hinweis === c.normal.slice(-2) && c.hinweis.length === 2);
    const k = c.normal.slice(2);
    const varianten = [c.code, c.code.toLowerCase(), `DR–${k.slice(0, 4)}–${k.slice(4, 8)}–${k.slice(8)}`, `  ${k.slice(0, 4)} ${k.slice(4, 8)} ${k.slice(8)} `, k, `dr${k}`];
    ok("Schreibweisen (klein, Gedankenstrich, Leerzeichen, ohne DR) ergeben denselben Code", varianten.every((v) => drCodeNormal(v) === c.normal));
    ok("Verwechselbare Zeichen und falsche Länge → kein Code", drCodeNormal("DR-AAAA-AAAA-AAA0") === null && drCodeNormal("DR-AAAA-AAAA-AAAI") === null && drCodeNormal("DR-AAAA-AAAA") === null && drCodeNormal("") === null);
    ok("Anzeigeform zurück", drCodeAnzeige(c.normal) === c.code);
    const form = drCodeForm(c.code.replace(/.$/, "X"));
    ok("Protokollform verrät den Code nicht", !form.includes(k.slice(0, 4)) && /Zeichen/.test(form), form);
  });

  await abschnitt("A2 Angaben für die Vereinbarung", () => {
    const g = drGastAngabenPruefen(GAST);
    ok("Vollständige Angaben gültig", g.ok);
    const leer = drGastAngabenPruefen({});
    ok("Leer: jedes Pflichtfeld mit eigenem Satz", !leer.ok && ["vorname", "nachname", "strasse", "plz", "ort", "land", "email"].every((k) => !!(leer as any).fehler[k]));
    ok("Telefon ist freiwillig (steht nicht in der Vereinbarung)", !DR_PFLICHT.includes("telefon") && drGastAngabenPruefen({ ...GAST, telefon: "" }).ok);
    ok("Angegebenes Telefon mit zu wenigen Ziffern abgelehnt", !drGastAngabenPruefen({ ...GAST, telefon: "12345" }).ok);
    ok("Firma und Funktion sind freiwillig", drGastAngabenPruefen({ ...GAST, firma: "", funktion: "" }).ok);
    ok("E-Mail ohne Domain abgelehnt", !drGastAngabenPruefen({ ...GAST, email: "max@" }).ok);
    ok("Postleitzahl mit Sonderzeichen abgelehnt", !drGastAngabenPruefen({ ...GAST, plz: "8000!" }).ok);
    ok("Britische Postleitzahl angenommen", drGastAngabenPruefen({ ...GAST, plz: "EC1V 2NX" }).ok);
    const sauber = drGastAngabenPruefen({ ...GAST, vorname: "  Max​ ", anrede: "hacker", email: " MAX.Mustermann@Example.invalid " });
    ok("Säubert Leerraum/unsichtbare Zeichen, unbekannte Anrede → keine", sauber.ok && (sauber as any).wert.vorname === "Max" && (sauber as any).wert.anrede === "" && (sauber as any).wert.email === "max.mustermann@example.invalid");
    // Gutachten (b): Namen nur aus Buchstaben — kein Vertragstext über das Namensfeld.
    ok("Nachname mit Klammern/§ abgelehnt („Muster (ohne Haftung nach § 5)“)", !drGastAngabenPruefen({ ...GAST, nachname: "Muster (ohne Haftung nach § 5)" }).ok);
    ok("Ein-Buchstaben-Nachname abgelehnt, „von Muster“, „O’Neil“, „Müller-Lüdenscheidt“ angenommen", !drGastAngabenPruefen({ ...GAST, nachname: "M" }).ok && drGastAngabenPruefen({ ...GAST, nachname: "von Muster" }).ok && drGastAngabenPruefen({ ...GAST, nachname: "O’Neil" }).ok && drGastAngabenPruefen({ ...GAST, nachname: "Müller-Lüdenscheidt" }).ok);
    ok("Firma/Funktion ohne §, *, ;, : und Anführungszeichen", !drGastAngabenPruefen({ ...GAST, firma: "Muster AG; abweichend von § 5" }).ok && !drGastAngabenPruefen({ ...GAST, firma: "**Muster AG**" }).ok && !drGastAngabenPruefen({ ...GAST, funktion: "Verwaltungsrat: ohne Haftung" }).ok);
    ok("Firma mit & und Gedankenstrich angenommen („Muster & Partner – Beratung & Bewertung“)", drGastAngabenPruefen({ ...GAST, firma: "Muster & Partner – Beratung & Bewertung" }).ok);
    ok("Straße mit Hausnummernbereich und Apostroph angenommen", drGastAngabenPruefen({ ...GAST, strasse: "Rue de l’Église 12/3" }).ok && !drGastAngabenPruefen({ ...GAST, strasse: "Musterweg 1; § 5 gilt nicht" }).ok);
    ok("Nur lateinische Schrift (die PDF-Schrift kann anderes nicht)", !drGastAngabenPruefen({ ...GAST, vorname: "Иван" }).ok && drGastAngabenPruefen({ ...GAST, vorname: "Łukasz", nachname: "Wójcik" }).ok);
    // Gutachten (a): Anlage 1 nimmt nur Namen.
    const liste = drGastAngabenPruefen({ ...GAST, weitergabe: "Erika Beispiel; Beispiel AG\nMax Probe" });
    ok("Weitergabe: Liste von Namen, getrennt mit ; oder Zeilen", liste.ok && (liste as any).wert.weitergabe === "Erika Beispiel; Beispiel AG; Max Probe", (liste as any).wert?.weitergabe);
    ok("Weitergabe mit Vertragstext abgelehnt („niemanden; abweichend von § 5 …“, auch ohne Sonderzeichen)", !drGastAngabenPruefen({ ...GAST, weitergabe: "niemanden: abweichend von § 5 Abs. 1 schuldet Partei 3 keine Konventionalstrafe" }).ok && !drGastAngabenPruefen({ ...GAST, weitergabe: "niemanden; abweichend von Paragraph 5 Absatz 1 schuldet Partei 3 keine Strafe" }).ok && !drGastAngabenPruefen({ ...GAST, weitergabe: "Erika Beispiel und alle weiteren Personen die ich noch nennen werde" }).ok);
    ok("Firma/Funktion ohne Vertragsworte („Muster AG ohne Haftung“, „Verwaltungsrat unter Vorbehalt“)", !drGastAngabenPruefen({ ...GAST, firma: "Muster AG ohne Haftung" }).ok && !drGastAngabenPruefen({ ...GAST, funktion: "Verwaltungsrat unter Vorbehalt" }).ok);
    ok("Weitergabe: höchstens zehn Namen, je 120 Zeichen", !drGastAngabenPruefen({ ...GAST, weitergabe: Array.from({ length: 11 }, (_, i) => `Name ${String.fromCharCode(65 + i)}`).join("; ") }).ok && !drGastAngabenPruefen({ ...GAST, weitergabe: "A".repeat(130) }).ok);
    ok("drWeitergabeListe säubert und begrenzt", JSON.stringify(drWeitergabeListe(" Erika ;; Max. \n")) === JSON.stringify(["Erika", "Max"]));
  });

  await abschnitt("A3 Die Vereinbarung mit Platzhaltern", () => {
    const b = drNdaBloecke(EINGABE);
    const alles = b.map((x) => Object.values(x).flat().join(" ")).join("\n");
    const text = (e: DrNdaEingabe) => drNdaBloecke(e).map((x) => Object.values(x).flat().join(" ")).join("\n");
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
    ok("§ 8 Abs. 1 FEST formuliert: Annahme durch Freischaltung, Empfänger nur über Anlage 1", alles.includes("durch die Freischaltung des Datenraums für Partei 3 angenommen hat; die Freischaltung gilt als Unterzeichnung durch die Parteien 1 und 2") && alles.includes("weitergegeben zu haben, ausser an die in Anlage 1 genannten Empfänger; diese gelten als ihre Empfänger nach § 3."));
    ok("§ 8 Abs. 2: Vertraulichkeit drei Jahre, Berichte zu B", alles.includes("Die Vertraulichkeit gilt drei Jahre") && alles.includes("Analysen und Berichte zu B gilt sie, solange"));
    ok("§ 9 mit der E-Mail des Gastes, nur per E-Mail", alles.includes("für die FIAON-Seite an und durch Herrn Schwarzott (js@fiaon.com), für die Mustermann-Seite an und durch Herrn Mustermann (max.mustermann@example.invalid); andere Absender und Kanäle"));
    ok("§ 10: schweizerisches Recht, Gerichtsstand Zürich, Datenraum als Unterschriftsweg", alles.includes("untersteht schweizerischem Recht") && alles.includes("Ausschliesslicher Gerichtsstand ist Zürich") && alles.includes("im Online-Datenraum der FIAON-Seite elektronisch unterzeichnete Exemplare gelten als Original"));
    const anlage = b.find((x) => x.art === "anlage") as any;
    ok("Anlage 1 am Ende: ohne Angabe „nennt keine“", b[b.length - 1] === anlage && anlage?.nr === "Anlage 1" && anlage.zeilen[0] === "Die Mustermann-Seite nennt keine.", anlage?.zeilen?.[0]);
    ok("Schweizer Schreibweise: kein ß im festen Wortlaut", !/ß/.test(drNdaBloecke({ ...EINGABE, gast: { ...GAST, strasse: "Musterweg 1" } }).filter((x) => x.art !== "partei").map((x) => Object.values(x).flat().join(" ")).join(" ")));
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
    const weiter = drNdaBloecke({ ...EINGABE, gast: { ...GAST, weitergabe: "Erika Beispiel; Beispiel AG" } });
    const w8 = weiter.find((x) => x.art === "abs" && x.text.startsWith("Diese Vereinbarung tritt in Kraft")) as any;
    ok("Frühere Empfänger stehen NUR als Liste in Anlage 1 — § 8 bleibt Wort für Wort gleich", (weiter[weiter.length - 1] as any).zeilen[0] === "Die Mustermann-Seite nennt: Erika Beispiel; Beispiel AG." && w8.text === (b.find((x) => x.art === "abs" && x.text.startsWith("Diese Vereinbarung tritt in Kraft")) as any).text);
    const h1 = drSha256(drNdaKanonisch(b));
    ok("Gleiche Eingabe → gleiche Prüfsumme", h1 === drSha256(drNdaKanonisch(drNdaBloecke(EINGABE))));
    ok("Andere Anschrift → andere Prüfsumme", h1 !== drSha256(drNdaKanonisch(drNdaBloecke({ ...EINGABE, gast: { ...GAST, ort: "Basel" } }))));
    ok(`Fassungswand: Wortlaut passt zu Fassung ${NDA_FASSUNG}`, NDA_FASSUNG === NDA_MUSTER.fassung && h1 === NDA_MUSTER.hash, `Muster-Prüfsumme ${h1}`);
  });

  await abschnitt("A4 Name der Unterschrift (gleich, nicht „enthält“)", () => {
    ok("Voller Name passt (auch klein, mit Akzenten, ß)", drNamePasst("Max Mustermann", GAST) && drNamePasst("max  mustermann", GAST) && drNamePasst("Jurgen Strasser", { vorname: "Jürgen", nachname: "Straßer" }));
    ok("Zusätze passen NICHT („… unter Vorbehalt meines Anwalts“, „Dr. …“)", !drNamePasst("Max Mustermann unter Vorbehalt meines Anwalts", GAST) && !drNamePasst("Dr. Max Mustermann", GAST));
    ok("Nur Nachname / Initiale / anderer Vorname passt nicht", !drNamePasst("Mustermann", GAST) && !drNamePasst("M. Mustermann", GAST) && !drNamePasst("Maxi Mustermann", GAST));
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
    ok("Thema nicht (mehr) in der Vereinbarung → 403 (nachtrag)", s(z({ ndaProjektIds: [11] })) === "403/nachtrag");
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

  await abschnitt("A7 Sitzungs-Plätzchen und Geheimnis", () => {
    const t = drTokenBauen(7, 3, "geheim-a", 1_000_000);
    ok("Gültig mit gleichem Geheimnis", JSON.stringify(drTokenPruefen(t, "geheim-a", 1_000_001)) === JSON.stringify({ gastId: 7, version: 3 }));
    ok("Anderes Geheimnis → ungültig", drTokenPruefen(t, "geheim-b", 1_000_001) === null);
    ok("Abgelaufen → ungültig", drTokenPruefen(t, "geheim-a", 1_000_000 + 8 * 24 * 3600_000) === null);
    const teile = t.split(".");
    ok("Andere Gast-Kennung mit alter Signatur → ungültig", drTokenPruefen([8, ...teile.slice(1)].join("."), "geheim-a", 1_000_001) === null);
    ok("Unsinn → ungültig", drTokenPruefen("1.1.1", "geheim-a") === null && drTokenPruefen(undefined, "geheim-a") === null && drTokenPruefen("x".repeat(500), "geheim-a") === null);
    let warf = false; try { drGeheimnis({ NODE_ENV: "production" } as any); } catch { warf = true; }
    ok("Produktion ohne SESSION_SECRET → Fehler statt Ersatzschlüssel aus dem Repo", warf);
    ok("Mit SESSION_SECRET → dieses; lokal ohne → nur-lokal-Schlüssel", drGeheimnis({ NODE_ENV: "production", SESSION_SECRET: "s" } as any) === "s" && /nur-lokal/.test(drGeheimnis({ NODE_ENV: "development" } as any)));
  });

  await abschnitt("A8 Unterschriftsbild (auch eine Bombe)", () => {
    ok("Bild mit Tinte gültig", drPngTintePruefen(pngBild(300, 90)) === null);
    ok("Leeres Bild abgelehnt", drPngTintePruefen(pngBild(300, 90, false)) !== null);
    ok("Kein PNG abgelehnt", drPngTintePruefen(Buffer.from("kein bild".padEnd(300, "x"))) !== null && drPngTintePruefen(null) !== null);
    ok("Verschachteltes PNG (Interlace) abgelehnt", drPngTintePruefen(pngBild(300, 90, true, true)) !== null);
    ok("Zu große Maße abgelehnt (über 2400 × 1000)", drPngTintePruefen(pngBild(2500, 100)) !== null && drPngTintePruefen(pngBild(400, 1100)) !== null);
    const bombe = pngBombe();
    const vorher = process.memoryUsage().rss;
    const t0 = Date.now(); const r = drPngTintePruefen(bombe); const dauer = Date.now() - t0;
    const mehr = (process.memoryUsage().rss - vorher) / 1024 / 1024;
    ok("Bombe (kleine Datei, 60 MB Inhalt) abgelehnt — schnell und ohne den Speicher zu füllen", bombe.length < 300_000 && r !== null && dauer < 2000 && mehr < 40, `${Math.round(bombe.length / 1024)} KB, ${r}, ${dauer} ms, +${mehr.toFixed(1)} MB`);
    ok("Data-URL gelesen, andere Formate und Übergrößen nicht", !!drPngAusDataUrl(dataUrl(pngBild(80, 30))) && drPngAusDataUrl("data:image/svg+xml;base64,PHN2Zz4=") === null && drPngAusDataUrl(`data:image/png;base64,${"A".repeat(430_000)}`) === null);
  });

  await abschnitt("A9 IP hinter Cloudflare und Bremsen-Schlüssel", () => {
    ok("Cloudflare-Netze erkannt (v4 und v6), andere nicht", drIstCloudflare("172.70.10.10") && drIstCloudflare("162.158.1.2") && drIstCloudflare("2a06:98c1::1") && !drIstCloudflare("203.0.113.9") && !drIstCloudflare("10.0.0.1"));
    const ueberCf = drClientIp({ "cf-connecting-ip": "203.0.113.77", "x-forwarded-for": "203.0.113.77, 172.70.10.10" }, "172.70.10.10");
    ok("Über Cloudflare: cf-connecting-ip ist die IP des Gastes, die Kette steht im Nachweis", ueberCf.ip === "203.0.113.77" && /cf=203\.0\.113\.77/.test(ueberCf.kette) && /peer=172\.70\.10\.10/.test(ueberCf.kette));
    const direkt = drClientIp({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "1.2.3.4, 198.51.100.9" }, "198.51.100.9");
    ok("Direkt (nicht über Cloudflare): ein mitgeschickter cf-Kopf zählt nicht — die Adresse, die Render sieht", direkt.ip === "198.51.100.9");
    ok("IPv6: Bremse je /64, IPv4 je Adresse", drAnschluss("2001:db8:1:2:aaaa::1") === drAnschluss("2001:db8:1:2:bbbb::9") && drAnschluss("203.0.113.1") !== drAnschluss("203.0.113.2"));
  });

  await abschnitt("A10 Warteschlange für Vermerke", async () => {
    const q = drWarteschlange(2, 300);
    let gleichzeitig = 0; let hoechstens = 0;
    const arbeit = () => new Promise<number>((r) => { gleichzeitig++; hoechstens = Math.max(hoechstens, gleichzeitig); setTimeout(() => { gleichzeitig--; r(1); }, 60); });
    const erg = await Promise.all(Array.from({ length: 5 }, () => q(arbeit)));
    ok("Höchstens zwei gleichzeitig, alle fünf erledigt", hoechstens === 2 && erg.every((e) => e.ok));
    const lang = drWarteschlange(1, 50);
    const [a, b2] = await Promise.all([lang(() => new Promise((r) => setTimeout(() => r(1), 200))), lang(async () => 2)]);
    ok("Wer zu lange wartet, bekommt eine Absage (kein Stau im Speicher)", a.ok && !b2.ok);
  });

  await abschnitt("A11 Vereinbarung als PDF, Entwurf und Vermerk mit Vorgangsnummer", async () => {
    const b = drNdaBloecke({ ...EINGABE, gast: { ...GAST, weitergabe: "Erika Beispiel" } });
    const hash = drSha256(drNdaKanonisch(b));
    const am = new Date("2026-11-09T14:42:00Z");
    const pdf = Buffer.from(await ndaPdfErzeugen({
      bloecke: b, fassung: NDA_FASSUNG, textHash: hash, seite: drSeiteName(GAST), raumTitel: "Muster-Raum",
      partei3: { name: "Max Mustermann", getippt: "Max Mustermann", unterschriftPng: pngBild(420, 120) }, unterzeichnetAm: am, freigeschaltetAm: am,
      ip: "203.0.113.9", userAgent: "Mozilla/5.0 Probe",
      nachweis: [["Zustimmung", "„Ich habe die Vereinbarung gelesen und bin einverstanden.“ — Häkchen gesetzt"], ["Zugang", "persönlicher Einladungscode …XY (Sitzungsstand 1)"], ["E-Mail-Adresse (§ 9)", "max@example.invalid — wie in der Einladung"]],
    }));
    const seiten = await pdfText(pdf);
    const t = ohneLeer(seiten.join(" "));
    ok("PDF mit mehreren Seiten", seiten.length >= 3, `${seiten.length} Seiten`);
    ok("Partei 3, Themen, § 10 und Anlage 1 stehen im PDF", t.includes(ohneLeer("Herr Max Mustermann")) && t.includes("ProjektBeta") && t.includes(ohneLeer("Ausschliesslicher Gerichtsstand ist Zürich")) && t.includes(ohneLeer("Anlage 1")) && t.includes(ohneLeer("nennt: Erika Beispiel")));
    ok("Annahmevermerk der FIAON-Seite mit Zeitpunkt", t.includes(ohneLeer("Angenommen durch FIAON LTD und Justin Schwarzott mit der Freischaltung des Datenraums am 9. November 2026 um 15:42 Uhr")));
    ok("Nachweis: Prüfsumme, IP, getippter Name, Zustimmung, Zugang, E-Mail", t.includes(hash) && t.includes("203.0.113.9") && t.includes(ohneLeer("Name getippt: „Max Mustermann“")) && t.includes(ohneLeer("Häkchen gesetzt")) && t.includes(ohneLeer("Einladungscode …XY")) && t.includes(ohneLeer("wie in der Einladung")));
    ok("Fuß „Seite x von y“ und Fassung auf jeder Seite", seiten.every((s, i) => ohneLeer(s).includes(`Seite${i + 1}von${seiten.length}`) && ohneLeer(s).includes(`Fassung${NDA_FASSUNG}`)));
    const umschrift = await pdfText(Buffer.from(await ndaPdfErzeugen({ bloecke: drNdaBloecke({ ...EINGABE, gast: { ...GAST, vorname: "Łukasz" } }), fassung: NDA_FASSUNG, textHash: hash, seite: "X-Seite", raumTitel: "R", partei3: { name: "Łukasz Mustermann", getippt: "Łukasz Mustermann", unterschriftPng: pngBild(300, 90) }, unterzeichnetAm: am, freigeschaltetAm: am, ip: "1", userAgent: "u" })));
    ok("Buchstaben ohne Platz in der PDF-Schrift (Ł) → ohne Akzent und mit Satz im Nachweis", ohneLeer(umschrift.join(" ")).includes("LukaszMustermann") && ohneLeer(umschrift.join(" ")).includes(ohneLeer("stehen ohne Akzent")));
    const entwurf = await pdfText(Buffer.from(await ndaPdfErzeugen({ entwurf: true, bloecke: b, fassung: NDA_FASSUNG, textHash: hash, seite: drSeiteName(GAST), raumTitel: "Muster-Raum" })));
    const et = ohneLeer(entwurf.join(" "));
    ok("Entwurf: auf jeder Seite „Entwurf“, ohne Unterschrift und ohne Annahmevermerk", entwurf.every((s) => /ENTWURF/.test(s)) && !et.includes(ohneLeer("Angenommen durch")) && !et.includes(ohneLeer("Elektronischer Nachweis")) && et.includes(ohneLeer("nicht unterzeichnet")));
    const probe = await probePdf("Probedokument", true);
    const vermerk = drVermerkText("Max Mustermann", am, "DR-4711");
    ok("Vermerktext mit Vorgangsnummer", vermerk === "Vertraulich · Max Mustermann · 09.11.2026 · DR-4711", vermerk);
    const mit = await drPdfVermerken(probe, vermerk, "DR-4711");
    const mitText = await pdfText(mit);
    ok("Vermerk auf jeder Seite (auch der gedrehten)", mitText.length === 2 && mitText.every((s) => ohneLeer(s).includes(ohneLeer(vermerk))), mitText.map((s) => s.slice(-60)).join(" | "));
    ok("Vorgangsnummer auch in den Stichwörtern der Datei", ((await PDFDocument.load(mit)).getKeywords() ?? "").includes("DR-4711"));
    ok("Inhalt der Seiten bleibt", ohneLeer(mitText[0]).includes("ProbedokumentSeite1"));
    const pr = await drPdfPruefen(probe);
    ok("Normales PDF: Vermerk möglich, Seiten gezählt", pr.vermerkMoeglich && pr.seiten === 2);
    const zu = verschluesselt(probe);
    const prz = await drPdfPruefen(zu);
    ok("Verschlüsseltes PDF: ohne Vermerk, mit Grund", !prz.vermerkMoeglich && /verschlüsselt/.test(String(prz.grund)), String(prz.grund));
    let warf = false; try { await drPdfVermerken(zu, vermerk); } catch { warf = true; }
    ok("Vermerk auf verschlüsseltem PDF wirft (Auslieferung nimmt dann das Original und protokolliert)", warf);
  });

  await abschnitt("A12 Vergleich mit einer Papierfassung (Aufbau der Hausvorlage, erfundene Daten)", () => {
    const b = drNdaBloecke(EINGABE);
    const html = papierAusBloecken(b, "persönlich, für Muster Beteiligungen AG und die von ihm benannten Gesellschaften");
    const papier = drPapierBloecke(html);
    ok("Papier gelesen: Parteien, Paragrafen, Themen, Liste, Rolle", papier.some((x) => x.schluessel === "Partei 3 Text") && papier.some((x) => x.schluessel === "§ 1 Thema B") && papier.some((x) => x.schluessel === "§ 4 c)") && papier.some((x) => x.schluessel === "§ 4 nach") && papier.some((x) => x.schluessel === "§ 9") && papier.some((x) => x.schluessel === "Rolle Partei 3"));
    const v = drVergleichen(papier, drVorlageTextBloecke(b, GAST));
    ok("Gegen die eigene Vorlage: nur § 8 Abs. 1, § 10 Abs. 5 und Anlage 1 anders → grün", v.gruen && v.anders.map((a) => a.schluessel).sort().join(",") === "§ 10 (5),§ 8 (1)" && v.nurVorlage.join(",") === "Anlage 1", JSON.stringify({ anders: v.anders.map((a) => a.schluessel), nurV: v.nurVorlage, nurP: v.nurPapier }));
    const a = drAusPapier(papier);
    ok("Fallsätze aus dem Papier gelesen (Zusätze, geschützte Gesellschaft, Partei 3)", !a.fehler.length && a.raum.nda.zusatz4 === EINGABE.raum.zusatz4 && a.raum.nda.vorab === EINGABE.raum.vorab && a.raum.projekte[1].geschuetzt === "die Beta-Gesellschaft" && a.gast.firma === GAST.firma && a.gast.funktion === GAST.funktion && a.gast.email === GAST.email, a.fehler.join(" · "));
    const falsch = drVergleichen(papier, drVorlageTextBloecke(drNdaBloecke({ ...EINGABE, raum: { ...EINGABE.raum, zusatz4: null } }), GAST));
    ok("Fehlt ein Fallsatz (§ 4-Zusatz), wird der Vergleich rot und zeigt die Stelle", !falsch.gruen && falsch.anders.some((x) => x.schluessel === "§ 4 (2)" && /\[-Als Geschäft/.test(x.diff)));
    ok("Wort-Unterschied lesbar", drWortDiff("a b c d", "a x c d") === "a [-b-] {+x+} c d", drWortDiff("a b c d", "a x c d"));
  });

  await abschnitt("A13 Keine Messung auf den Seiten des Datenraums", () => {
    const hinweis = fs.readFileSync(path.join(process.cwd(), "client/src/components/site/EinwilligungsHinweis.tsx"), "utf8");
    const roh = /const OHNE_MESSUNG = \/(.+)\/;/.exec(hinweis)?.[1] ?? "";
    const re = new RegExp(roh);
    ok("OHNE_MESSUNG trifft /datenraum/zugang und /datenraum/raum (kein Clarity, kein Pixel, kein Hinweis)", !!roh && re.test("/datenraum/zugang") && re.test("/datenraum/raum") && re.test("/business/angebot/x") && !re.test("/datenraum") && !re.test("/datenraumx"));
    const routes = fs.readFileSync(path.join(process.cwd(), "server/routes.ts"), "utf8");
    ok("Kopfzeilen noindex, no-referrer, no-store für beide Seiten", /'\/datenraum\/zugang', '\/datenraum\/zugang\/\*', '\/datenraum\/raum', '\/datenraum\/raum\/\*'\][\s\S]{0,200}noindex[\s\S]{0,120}no-referrer[\s\S]{0,120}no-store/.test(routes));
    const robots = fs.readFileSync(path.join(process.cwd(), "client/public/robots.txt"), "utf8");
    ok("robots.txt sperrt beide Seiten", /Disallow: \/datenraum\/zugang/.test(robots) && /Disallow: \/datenraum\/raum/.test(robots));
    const seo = fs.readFileSync(path.join(process.cwd(), "shared/fiaon-seo-seiten.ts"), "utf8");
    ok("Nicht in der SEO-Tabelle — nie vorgerendert, nie öffentlich zwischengespeichert (wie /zugang/uebergabe)", !seo.includes('"/datenraum/zugang"') && !seo.includes('"/datenraum/raum"'));
  });

  await abschnitt("A14 Papierfassung des ersten Falls (PRUEF_NDA_QUELLE): Wortlaut abgleichen, nichts davon im Repo", () => {
    const quelle = process.env.PRUEF_NDA_QUELLE;
    if (!quelle || !fs.existsSync(quelle)) { console.log("   übersprungen — PRUEF_NDA_QUELLE (Papierfassung als HTML) nicht gesetzt."); return; }
    const rohHtml = fs.readFileSync(quelle, "utf8");
    // (1) Der Wortlaut: Fallsätze aus der Papierfassung lesen, die Vorlage damit setzen, Abschnitt für Abschnitt vergleichen.
    const papier = drPapierBloecke(rohHtml);
    const a = drAusPapier(papier);
    const bl = drNdaBloecke({ gast: a.gast, projekte: a.raum.projekte.map((p, i) => ({ buchstabe: String.fromCharCode(65 + i), titel: p.titel, text: p.ndaText, geschuetzt: p.geschuetzt || null })), raum: a.raum.nda });
    const v = drVergleichen(papier, drVorlageTextBloecke(bl, a.gast));
    ok("Papierfassung gelesen, Fallsätze erkannt", !a.fehler.length && papier.length > 40, a.fehler.join(" · "));
    ok("Wortlaut der Vorlage = Papierfassung bis auf § 8 Abs. 1, § 10 Abs. 5 und Anlage 1", v.gruen, `${v.gleich.length} gleich; anders: ${v.anders.filter((x) => !x.erwartet).map((x) => `${x.schluessel}: ${x.diff.slice(0, 300)}`).join(" | ")}; nur Papier: ${v.nurPapier.join(",")}; nur elektronisch: ${v.nurVorlage.join(",")}`);
    ok("Die Angaben von Partei 3 aus der Papierfassung bestehen die Prüfung der Seite", drGastAngabenPruefen(a.gast).ok);
    // (2) Die Wand: kein Name, keine Anschrift, kein Projekt des ersten Falls in einer Datei dieses Baus.
    const html = rohHtml.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&shy;|­/g, "");
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
    for (const n of [a.raum.nda.zusatz4, a.raum.nda.vorab, a.raum.nda.partei2Zusatz, a.raum.nda.zweck]) if (n && n.length > 30) nadeln.add(n.slice(0, 40));
    const liste = [...nadeln].filter((n) => n.length >= 4);
    ok("Aus der Papierfassung gelesen: Name, Anschrift, Firma, Projekte, E-Mail, Fallsätze", liste.length >= 8, `${liste.length} Begriffe`);
    const funde: string[] = [];
    for (const f of ALLE_MEINE_DATEIEN) {
      const p = path.join(process.cwd(), f);
      if (!fs.existsSync(p)) continue;
      const inhalt = fs.readFileSync(p, "utf8").toLowerCase();
      for (const n of liste) if (inhalt.includes(n.toLowerCase())) funde.push(`${f}: ${n.slice(0, 2)}…`);
    }
    ok("Kein Begriff des ersten Falls in den Dateien dieses Baus", funde.length === 0, funde.join(", "));
  });

  await abschnitt("A15 Raumtour: das Bühnen-Schema", () => {
    const m = drBuehnePruefen(BUEHNE_MUSTER);
    ok("Erfundenes Muster gültig, alles übernommen", m.ok && !!m.wert && m.wert.hauptprojekt === true && m.wert.kennzahlen.length === 3 && m.wert.kurve?.reihen.length === 2 && m.wert.kapitel.length === 2 && m.wert.abschluss?.knopf === "Vertragsentwurf anfordern" && m.warnungen.length === 0, m.ok ? "" : m.fehler.join(" | "));
    ok("Kurzform für Listen", m.ok && drBuehneKurz(m.wert) === "Hauptprojekt · 3 Kennzahlen · Kurve (2 Reihen) · 2 Kapitel", m.ok ? drBuehneKurz(m.wert) : "");
    ok("Dokument-Nummern im Kapitel ohne Dubletten", m.ok && JSON.stringify(m.wert?.kapitel[0].dokumente) === "[1,2]");
    const leer = [null, undefined, ""].map((x) => drBuehnePruefen(x));
    ok("null / undefined / leer = keine Bühne (gültig)", leer.every((x) => x.ok && x.wert === null));
    const text = drBuehnePruefen(JSON.stringify(JSON.stringify(BUEHNE_MUSTER)));
    ok("Als JSON-Text gespeichert (auch doppelt verpackt) → gelesen", text.ok && text.wert?.claim === BUEHNE_MUSTER.claim);
    const sauber = drBuehnePruefen({ claim: "  Ein\u0007 Satz\u202e mit   Lücken  ", kicker: "Augen\u200bzeile" });
    ok("Säubert Steuer- und Richtungszeichen, Leerraum", sauber.ok && sauber.wert?.claim === "Ein Satz mit Lücken" && !/[\u200b\u202e\u0007]/.test(JSON.stringify(sauber.wert)), sauber.ok ? sauber.wert?.claim : "");
    const html = drBuehnePruefen({ claim: "<b>fett</b> & <script>x</script>" });
    ok("Reiner Text: HTML bleibt wörtlicher Text (React setzt nie HTML)", html.ok && html.wert?.claim === "<b>fett</b> & <script>x</script>");
    const fehler = (b: unknown, wort: RegExp) => { const r = drBuehnePruefen(b); return !r.ok && r.fehler.some((f) => wort.test(f)); };
    ok("Kein Objekt (Liste, Zahl, kaputtes JSON) → Fehler", fehler([1, 2], /Objekt/) && fehler(42, /Objekt/) && fehler("{kaputt", /JSON/));
    ok("Ohne claim → Fehler", fehler({ kicker: "x" }, /^claim: fehlt/));
    ok("claim zu lang → Fehler mit Grenze", fehler({ claim: "x".repeat(141) }, /claim: höchstens 140/));
    ok("Sieben Kennzahlen → Fehler", fehler({ claim: "Satz", kennzahlen: Array.from({ length: 7 }, () => ({ wert: "1", label: "x" })) }, /kennzahlen: höchstens 6/));
    ok("Kennzahl ohne Label / Wert zu lang → Fehler", fehler({ claim: "Satz", kennzahlen: [{ wert: "1" }] }, /label: fehlt/) && fehler({ claim: "Satz", kennzahlen: [{ wert: "x".repeat(25), label: "y" }] }, /wert: höchstens 24/));
    const kurve = (k: unknown) => ({ claim: "Satz", kurve: k });
    ok("Kurve mit einem Punkt → Fehler", fehler(kurve({ titel: "K", reihen: [{ name: "R", punkte: [{ x: 1, y: 1 }] }] }), /mindestens 2/));
    ok("Kurve: y als Text / x gemischt / x doppelt / vier Reihen → Fehler",
      fehler(kurve({ titel: "K", reihen: [{ name: "R", punkte: [{ x: 1, y: "2" }, { x: 2, y: 3 }] }] }), /y: muss eine Zahl/)
      && fehler(kurve({ titel: "K", reihen: [{ name: "R", punkte: [{ x: 1, y: 1 }, { x: "Q2", y: 2 }] }] }), /entweder überall Zahlen/)
      && fehler(kurve({ titel: "K", reihen: [{ name: "R", punkte: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }] }), /doppelt/)
      && fehler(kurve({ titel: "K", reihen: Array.from({ length: 4 }, (_, i) => ({ name: `R${i}`, punkte: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })) }), /reihen: höchstens 3/));
    ok("Kurve mit Text-Achse (Quartale) gültig", drBuehnePruefen(kurve({ titel: "K", einheit: "%", reihen: [{ name: "R", punkte: [{ x: "Q1", y: 1 }, { x: "Q2", y: 2.5 }] }] })).ok);
    ok("Kapitel: Dokument-Nummer 0, 1,5 oder Text → Fehler", fehler({ claim: "Satz", kapitel: [{ titel: "T", text: "x", dokumente: [0] }] }, /dokumente/) && fehler({ claim: "Satz", kapitel: [{ titel: "T", text: "x", dokumente: [1.5] }] }, /dokumente/) && fehler({ claim: "Satz", kapitel: [{ titel: "T", text: "x", dokumente: ["1"] }] }, /dokumente/));
    ok("hauptprojekt nur true/false", fehler({ claim: "Satz", hauptprojekt: "ja" }, /hauptprojekt/));
    const tipp = drBuehnePruefen({ claim: "Satz", kennzahl: [] });
    ok("Unbekanntes Feld (Tippfehler) → Warnung, nicht gezeigt", tipp.ok && tipp.warnungen.some((w) => w.includes("kennzahl")) && !("kennzahl" in (tipp.wert ?? {})));
  });

  await abschnitt("A16 Raumtour: ohne Vereinbarung keine Bühne", () => {
    const lage: DrTourLage = { angemeldet: true, gastRaumId: 1, gastGesperrt: false, raumArchiviert: false, ndaProjektIds: [10, 11] };
    const projekte = [
      { id: 10, raumId: 1, buchstabe: "A", buehne: BUEHNE_MUSTER },
      { id: 11, raumId: 1, buchstabe: "B", buehne: { claim: "Ein zweiter, erfundener Raum." } },
      { id: 12, raumId: 1, buchstabe: "C", buehne: { claim: "Ein dritter, erfundener Raum." } },
      { id: 20, raumId: 2, buchstabe: "X", buehne: { claim: "Ein fremder Raum." } },
    ];
    const f = (l: Partial<DrTourLage>) => Object.keys(drBuehnenFreigeben({ ...lage, ...l }, projekte).buehnen).join(",");
    ok("Vereinbarung nennt A und B → genau A und B (C nicht genannt, X fremd)", f({}) === "A,B", f({}));
    ok("Ohne Vereinbarung → keine einzige Bühne", f({ ndaProjektIds: null }) === "");
    ok("Ohne Sitzung → keine", f({ angemeldet: false }) === "" && f({ gastRaumId: null }) === "");
    ok("Gesperrt oder Raum archiviert → keine", f({ gastGesperrt: true }) === "" && f({ raumArchiviert: true }) === "");
    ok("Fremder Raum bleibt zu, auch wenn seine Kennung in der Liste stünde", f({ ndaProjektIds: [10, 11, 20] }) === "A,B");
    const kaputt = drBuehnenFreigeben(lage, [{ id: 10, raumId: 1, buchstabe: "A", buehne: { claim: "" } }]);
    ok("Gespeicherte, ungültige Bühne → nicht gezeigt, aber gemeldet", Object.keys(kaputt.buehnen).length === 0 && kaputt.verworfen.join() === "A");
    ok("Projekt ohne Bühne → kein Eintrag (der Raum zeigt Titel und Unterlagen)", Object.keys(drBuehnenFreigeben(lage, [{ id: 10, raumId: 1, buchstabe: "A", buehne: null }]).buehnen).length === 0);
  });

  await abschnitt("A17 Raumtour: Anfragen nur aus einer Sitzung mit Vereinbarung", () => {
    const lage: DrTourLage = { angemeldet: true, gastRaumId: 1, gastGesperrt: false, raumArchiviert: false, ndaProjektIds: [10, 11] };
    const pA = { id: 10, raumId: 1, buchstabe: "A" }; const pC = { id: 12, raumId: 1, buchstabe: "C" };
    const z = (l: Partial<DrTourLage>, p: typeof pA | null | "unbekannt") => { const r = drAnfrageZugriff({ ...lage, ...l }, p); return r.erlaubt ? 200 : `${r.status}/${r.grund}`; };
    ok("Ohne Sitzung → 401 (Vertragsentwurf und Frage)", z({ angemeldet: false }, pA) === "401/anmeldung" && z({ angemeldet: false }, null) === "401/anmeldung" && z({ gastRaumId: null }, null) === "401/anmeldung");
    ok("Gesperrt / Raum archiviert → 403", z({ gastGesperrt: true }, pA) === "403/gesperrt" && z({ raumArchiviert: true }, null) === "403/gesperrt");
    ok("Vor der Vereinbarung → 403 (Vertragsentwurf und Frage)", z({ ndaProjektIds: null }, pA) === "403/nda" && z({ ndaProjektIds: null }, null) === "403/nda");
    ok("Projekt nicht in der Vereinbarung → 403 (Nachtrag)", z({}, pC) === "403/nachtrag");
    ok("Unbekanntes Projekt → 404 (ohne Sitzung trotzdem 401)", z({}, "unbekannt") === "404/unbekannt" && z({ angemeldet: false }, "unbekannt") === "401/anmeldung");
    ok("Mit Vereinbarung: Vertragsentwurf zu A und Frage ohne Thema erlaubt", z({}, pA) === 200 && z({}, null) === 200);
    const e = (b: unknown) => { const r = drAnfragePruefen(b); return r.ok ? `${r.wert.art}:${r.wert.projekt ?? "-"}:${r.wert.text.length}` : "FEHLER"; };
    ok("Vertragsentwurf braucht ein Projekt (Buchstabe wird groß)", e({ art: "vertrag", projekt: "a" }) === "vertrag:A:0" && e({ art: "vertrag" }) === "FEHLER");
    ok("Frage braucht Text: mindestens 5, höchstens 2000 Zeichen", e({ art: "frage", text: "Wie?" }) === "FEHLER" && e({ art: "frage", text: "Wie läuft die Prüfung?" }).startsWith("frage:-:") && e({ art: "frage", text: "x".repeat(2001) }) === "FEHLER");
    ok("Unbekannte Art, kaputtes Projekt, kein Objekt → Fehler", e({ art: "kaufen", projekt: "A" }) === "FEHLER" && e({ art: "vertrag", projekt: "A; DROP" }) === "FEHLER" && e(null) === "FEHLER" && e([]) === "FEHLER");
    const st = drAnfragePruefen({ art: "frage", text: "Eine\u0000 Frage\u202e mit Zeichen" });
    ok("Steuer- und Richtungszeichen im Text werden entfernt", st.ok && !/[\u0000\u202e]/.test(st.wert.text));
    ok("Bremse: je Gast ab 8 in der Stunde oder 30 am Tag, insgesamt ab 60 in 10 Minuten",
      !drAnfrageGebremst({ gastStunde: 7, gastTag: 29, alleZehnMinuten: 59 }) && drAnfrageGebremst({ gastStunde: 8, gastTag: 8, alleZehnMinuten: 8 })
      && drAnfrageGebremst({ gastStunde: 0, gastTag: 30, alleZehnMinuten: 0 }) && drAnfrageGebremst({ gastStunde: 0, gastTag: 0, alleZehnMinuten: 60 }));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL B — lokaler Prüfstand
// ═══════════════════════════════════════════════════════════════════════════
const PG = "/opt/homebrew/opt/postgresql@18/bin";
// PRUEF_DR_DB: eigener Name, wenn zwei Sitzungen gleichzeitig prüfen (nur fiaon_datenraum_*, nie eine andere Datenbank).
const DB_NAME = /^fiaon_datenraum_[a-z0-9_]{1,40}$/.test(process.env.PRUEF_DR_DB ?? "") ? String(process.env.PRUEF_DR_DB) : "fiaon_datenraum_test";
const DB_URL = `postgresql://fiaon@127.0.0.1:54329/${DB_NAME}?sslmode=require`;
const SECRET = "pruefstand-datenraum-geheim";
const CF_RAND = "172.70.10.10";

async function teilB(): Promise<void> {
  console.log("\n════ TEIL B — lokaler Prüfstand (127.0.0.1:54329) ════");
  // Nur die eigene Prüfdatenbank — sie wird jedes Mal neu angelegt.
  const pgEnv = { ...process.env, PGSSLMODE: "require" };
  execFileSync(`${PG}/dropdb`, ["-h", "127.0.0.1", "-p", "54329", "-U", "fiaon", "--if-exists", DB_NAME], { env: pgEnv, stdio: "pipe" });
  execFileSync(`${PG}/createdb`, ["-h", "127.0.0.1", "-p", "54329", "-U", "fiaon", DB_NAME], { env: pgEnv, stdio: "pipe" });
  process.env.DATABASE_URL = DB_URL;
  process.env.SESSION_SECRET = SECRET;
  process.env.DATENRAUM_MAILS = "aus";
  process.env.APP_BASE_URL = "https://fiaon.com";
  delete process.env.BREVO_API_KEY; delete process.env.MAKE_WEBHOOK_URL; delete process.env.GOOGLE_SA_KEY;
  delete process.env.FIAON_SIGN_CERT_PEM; delete process.env.FIAON_SIGN_KEY_PEM;
  (process.env as any).NODE_ENV = "test";

  const { sqlPool } = await import("../server/lib/db-pool");
  // Eine schmale fiaon_agents, damit die Chef-Wand ihr Protokoll schreiben kann (wie in der Produktion).
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_agents (id SERIAL PRIMARY KEY, name TEXT)`;
  await sqlPool`INSERT INTO fiaon_agents (name) VALUES ('Prüfstand Inhaber'), ('Prüfstand Geschäftsführung')`;
  const L = await import("../server/lib/fiaon-datenraum");
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const router = (await import("../server/routes/fiaon-datenraum")).default;
  await L.drSchema();
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());
  app.use("/api/fiaon", router);
  const server = await new Promise<import("node:http").Server>((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = (server.address() as any).port as number;
  const BASIS = `http://127.0.0.1:${port}/api/fiaon`;
  const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

  class Sitzung {
    kekse = new Map<string, string>(); letzteSetCookie: string[] = [];
    /** cloudflare: wie in der Produktion — cf-connecting-ip + X-Forwarded-For „Gast, Rand von Cloudflare“. */
    constructor(public ip: string | null = "203.0.113.10", public ua = BROWSER, public cloudflare = false) {}
    async ruf(pfad: string, koerper?: unknown, extra: Record<string, string> = {}, methode?: string): Promise<{ status: number; j: any; roh: Buffer; kopf: Headers }> {
      const ipKopf: Record<string, string> = !this.ip ? {} : this.cloudflare ? { "cf-connecting-ip": this.ip, "X-Forwarded-For": `${this.ip}, ${CF_RAND}` } : { "X-Forwarded-For": this.ip };
      const res = await fetch(`${BASIS}${pfad}`, {
        method: methode ?? (koerper === undefined ? "GET" : "POST"),
        headers: { "User-Agent": this.ua, ...ipKopf, ...(koerper !== undefined && !(koerper instanceof FormData) ? { "Content-Type": "application/json" } : {}), Cookie: [...this.kekse].map(([k, v]) => `${k}=${v}`).join("; "), ...extra },
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
  const post: any[] = [];
  const attrappe: any = async (x: any) => { post.push(x); return { ok: true, messageId: `pruef-${post.length}` }; };

  // ── Aufbau mit erfundenen Daten ──
  const WER = "Prüfstand";
  const raum = await L.drRaumAnlegen({ titel: "Prüfraum PRUEFSTAND", nda: { vorgestellt: "zuletzt mit E-Mail vom 9. November 2026" }, projekte: PROJEKTE.map((p, i) => ({ schluessel: ["alpha", "beta", "gamma"][i], titel: p.titel, beschreibung: `Ordner ${p.titel} — Beschreibung nur nach der Unterschrift`, ndaText: p.text, geschuetzt: p.geschuetzt ?? "" })) }, WER) as any;
  const fremd = await L.drRaumAnlegen({ titel: "Fremder Raum PRUEFSTAND", projekte: [{ schluessel: "x", titel: "Projekt Fremd" }] }, WER) as any;
  const akte0: any = await L.drRaumAkte(raum.id);
  const [pA, pB, pC] = akte0.projekte;
  // EIN Puffer für A1 — pdf-lib schreibt die Uhrzeit in jede neue Datei; zwei Aufrufe in verschiedenen Sekunden wären zwei Inhalte.
  const pdfA1 = await probePdf("Unterlage A1", true);
  const docA1 = await L.drDokumentAblegen({ projektId: pA.id, buffer: pdfA1, dateiname: "A1 Uebersicht.pdf", titel: "A1 Übersicht", beschreibung: "Ein Satz.", nr: 1 }, WER) as any;
  const docA2 = await L.drDokumentAblegen({ projektId: pA.id, buffer: await probePdf("Unterlage A2"), dateiname: "A2 intern.pdf", titel: "A2 intern", sichtbar: false, nr: 2 }, WER) as any;
  const docB1 = await L.drDokumentAblegen({ projektId: pB.id, buffer: pngBild(200, 120), dateiname: "Lageplan.png", titel: "B1 Plan", nr: 1 }, WER) as any;
  const docC1 = await L.drDokumentAblegen({ projektId: pC.id, buffer: DOCX, dateiname: "Gamma.docx", titel: "C1 Word", nr: 1 }, WER) as any;
  const akteF: any = await L.drRaumAkte(fremd.id);
  const docF = await L.drDokumentAblegen({ projektId: akteF.projekte[0].id, buffer: await probePdf("Fremd"), dateiname: "Fremd.pdf", titel: "Fremd" }, WER) as any;
  const ohneFreigabe = await L.drGastEinladen(raum.id, { vorname: "Zu", nachname: "Frueh", email: "zu.frueh@example.invalid" }, WER) as any;
  const freigabe = await L.drNdaFreigeben(raum.id, WER) as any;
  await L.drNdaFreigeben(fremd.id, WER);
  const einladung = await L.drGastEinladen(raum.id, { anrede: "herr", vorname: "Max", nachname: "Mustermann", email: GAST.email, firma: "Muster Beteiligungen AG" }, WER) as any;

  await abschnitt("B0 Aufbau und Freigabe", async () => {
    ok("Raum, Projekte A–C, fremder Raum angelegt", raum.ok && fremd.ok && [pA, pB, pC].map((p: any) => p.buchstabe).join("") === "ABC");
    ok("Dokumente abgelegt (PDF, unsichtbares PDF, PNG, Word)", docA1.ok && docA2.ok && docB1.ok && docC1.ok && docF.ok && docA1.vermerkMoeglich === true);
    ok("Gleicher Inhalt zweimal → keine zweite Zeile", (await L.drDokumentAblegen({ projektId: pA.id, buffer: pdfA1, dateiname: "A1.pdf", titel: "A1 Übersicht", nr: 1 }, WER) as any).neu === false);
    ok("Einladen vor der Freigabe der Vereinbarung → 409 FREIGABE", !ohneFreigabe.ok && ohneFreigabe.code === "FREIGABE");
    ok("Freigabe gespeichert", freigabe.ok && /^[0-9a-f]{64}$/.test(freigabe.hash));
    ok("Gast eingeladen, Code und Link einmal — der Code steht im ANKER (#c=), nie in der Abfrage", einladung.ok && /^DR-/.test(einladung.code) && einladung.link === `https://fiaon.com/datenraum/zugang#c=${encodeURIComponent(einladung.code)}`, einladung.link);
    const [g] = (await sqlPool`SELECT code_hash, code_hinweis, einladung, einladung_email FROM fiaon_dr_gaeste WHERE id = ${einladung.id}`) as any[];
    ok("In der Datenbank nur der HMAC des Codes, Hinweis zwei Zeichen, Einladungsdaten getrennt", g.code_hash === drCodeHash(drCodeNormal(einladung.code)!, SECRET) && g.code_hinweis.length === 2 && !JSON.stringify(g).includes(einladung.code.slice(3, 12)) && g.einladung_email === GAST.email && JSON.parse(JSON.stringify(g.einladung)).vorname === "Max");
  });

  const gast = new Sitzung("203.0.113.10", BROWSER, true);
  let gastId = 0; let ndaHash = "";
  await abschnitt("B1 Eintritt, Bremse je Anschluss, Alarm statt Gesamtsperre", async () => {
    const falsch = await gast.ruf("/datenraum/eintreten", { code: "DR-AAAA-BBBB-CCCC" });
    ok("Falscher Code → 403", falsch.status === 403 && /stimmt nicht/.test(falsch.j?.error ?? ""));
    const [fp] = (await sqlPool`SELECT ip, anschluss FROM fiaon_dr_protokoll WHERE art = 'code_falsch' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Über Cloudflare: die IP des Gastes im Protokoll (nicht der Rand von Cloudflare)", fp.ip === "203.0.113.10" && fp.anschluss === "203.0.113.10", `${fp.ip}/${fp.anschluss}`);
    const bremse = new Sitzung("198.51.100.7", BROWSER, true);
    for (let i = 0; i < 5; i++) await bremse.ruf("/datenraum/eintreten", { code: `DR-AAAA-BBBB-CCC${"DEFGH"[i]}` });
    const gebremst = await bremse.ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Nach 5 Fehlversuchen je Anschluss → 429, auch mit richtigem Code", gebremst.status === 429, String(gebremst.status));
    const nachbar = new Sitzung("198.51.100.8", BROWSER, true);
    ok("Ein anderer Gast am selben Rand von Cloudflare ist NICHT gebremst", (await nachbar.ruf("/datenraum/eintreten", { code: "DR-AAAA-BBBB-CCCJ" })).status === 403);
    ok("Fehlversuche stehen im Protokoll — ohne den eingegebenen Code", (await anzahl("code_falsch")) === 7 && !((await sqlPool`SELECT string_agg(detail, ' ') AS d FROM fiaon_dr_protokoll WHERE art = 'code_falsch'`) as any[])[0].d.includes("AAAA"));
    // Viele falsche Codes von vielen Anschlüssen: niemand wird gesperrt, Justin bekommt EINEN Alarm.
    for (let i = 0; i < 300; i++) await L.drProtokoll({ art: "code_falsch", detail: "Prüfstand" }, { ip: `192.0.2.${i % 250}`, ua: "x", anschluss: `192.0.2.${i % 250}` });
    const rein = await gast.ruf("/datenraum/eintreten", { code: einladung.code.toLowerCase().replace(/-/g, " ") });
    ok("Nach über 300 falschen Codes insgesamt: richtiger Code → eingetreten (keine Gesamtsperre)", rein.status === 200 && rein.j?.angemeldet === true && rein.j?.schritt === "angaben", JSON.stringify(rein.j)?.slice(0, 120));
    post.length = 0;
    await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 999 });
    await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 999 });
    ok("Alarm an Justin genau einmal je Stunde", post.filter((p) => /falsche Codes/.test(p.betreff)).length === 1 && (await anzahl("alarm_bremse")) === 1);
    const keks = gast.letzteSetCookie.find((c) => c.startsWith("fiaon_dr=")) ?? "";
    ok("Plätzchen: httpOnly, SameSite=Strict, Pfad /api/fiaon/datenraum", /HttpOnly/i.test(keks) && /SameSite=Strict/i.test(keks) && /Path=\/api\/fiaon\/datenraum/i.test(keks), keks.replace(/=[^;]+/, "=…"));
    ok("Vorbefüllt mit dem Hinterlegten; Projekte nur mit Buchstabe und Titel (ohne Beschreibung, ohne Dokumente)", rein.j?.gast?.vorname === "Max" && rein.j?.gast?.firma === "Muster Beteiligungen AG" && rein.j?.projekte?.length === 3 && rein.j.projekte.every((p: any) => p.dokumente.length === 0 && p.anzahl === null && p.beschreibung === "" && !!p.titel));
    ok("Antwort ohne Speicher (no-store), noindex, no-referrer", /no-store/.test(rein.kopf.get("cache-control") ?? "") && /noindex/.test(rein.kopf.get("x-robots-tag") ?? "") && rein.kopf.get("referrer-policy") === "no-referrer");
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

  await abschnitt("B3 Angaben (Berichtigung, neue E-Mail mit Code)", async () => {
    const schlecht = await gast.ruf("/datenraum/angaben", { angaben: { ...GAST, plz: "", email: "kaputt" } });
    ok("Fehlende/falsche Felder → 400 mit Satz je Feld", schlecht.status === 400 && !!schlecht.j?.fehler?.plz && !!schlecht.j?.fehler?.email);
    const tipp = await gast.ruf("/datenraum/angaben", { angaben: { ...GAST, nachname: "Musterman" } });
    ok("Angaben mit Tippfehler gespeichert, Antwort trägt die gespeicherten Angaben", tipp.status === 200 && tipp.j?.gast?.nachname === "Musterman" && JSON.stringify(tipp.j?.nda?.bloecke).includes("Herr Max Musterman"));
    const gut = await gast.ruf("/datenraum/angaben", { angaben: GAST });
    ok("Berichtigt → Vereinbarung mit dem NEUEN Namen und Prüfsumme", gut.status === 200 && gut.j?.gast?.nachname === "Mustermann" && /^[0-9a-f]{64}$/.test(gut.j?.nda?.hash ?? "") && JSON.stringify(gut.j?.nda?.bloecke).includes("Herr Max Mustermann"));
    const [pz] = (await sqlPool`SELECT detail FROM fiaon_dr_protokoll WHERE gast_id = ${gastId} AND art = 'angaben' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Protokoll hält Vorher→Nachher fest", /nachname: Musterman → Mustermann/.test(pz.detail), pz.detail);
    // Neue E-Mail: erst ein Code an genau diese Adresse.
    L.drPruefHaken({ sender: attrappe }); post.length = 0;
    const neueMail = { ...GAST, email: "max.privat@example.invalid" };
    const c1 = await gast.ruf("/datenraum/angaben", { angaben: neueMail });
    const codeMail = post.find((p) => p.an === "max.privat@example.invalid");
    const code = /Ihr Bestätigungscode lautet: (\d{6})/.exec(codeMail?.text ?? "")?.[1] ?? "";
    ok("Andere E-Mail als in der Einladung → 409 EMAIL_CODE, Code an die neue Adresse", c1.status === 409 && c1.j?.code === "EMAIL_CODE" && /^\d{6}$/.test(code));
    const c2 = await gast.ruf("/datenraum/angaben", { angaben: neueMail, emailCode: code === "000000" ? "111111" : "000000" });
    ok("Falscher Code → 400", c2.status === 400 && c2.j?.code === "EMAIL_CODE_FALSCH");
    const c3 = await gast.ruf("/datenraum/angaben", { angaben: neueMail, emailCode: code });
    const [gb] = (await sqlPool`SELECT email, email_bestaetigt FROM fiaon_dr_gaeste WHERE id = ${gastId}`) as any[];
    ok("Richtiger Code → gespeichert und bestätigt", c3.status === 200 && gb.email === "max.privat@example.invalid" && gb.email_bestaetigt === "max.privat@example.invalid");
    const zurueck = await gast.ruf("/datenraum/angaben", { angaben: GAST });
    L.drPruefHaken({ sender: null });
    ok("Zurück zur E-Mail der Einladung → ohne Code", zurueck.status === 200);
    ndaHash = zurueck.j?.nda?.hash ?? "";
    ok("Antwort ohne interne Kennungen", !("projektIds" in (zurueck.j?.nda ?? {})) && !("eingabe" in (zurueck.j?.nda ?? {})) && !("kanon" in (zurueck.j?.nda ?? {})));
    const st = await gast.ruf("/datenraum/stand");
    ok("Stand jetzt „vereinbarung“, Beschreibungen weiter verborgen", st.j?.schritt === "vereinbarung" && st.j.projekte.every((p: any) => p.beschreibung === ""));
    const entwurf = await gast.ruf("/datenraum/nda-entwurf.pdf");
    ok("Vereinbarung als Entwurf (PDF) zum Gegenlesen", entwurf.status === 200 && entwurf.kopf.get("content-type") === "application/pdf" && /ENTWURF/.test((await pdfText(entwurf.roh)).join(" ")));
  });

  await abschnitt("B4 Unterschrift und Nachweis", async () => {
    const sig = dataUrl(pngBild(360, 110));
    const basis = { textHash: ndaHash, gelesen: true, name: "Max Mustermann", png: sig };
    const r1 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, textHash: "0".repeat(64) });
    ok("Falsche Prüfsumme → 409 GEAENDERT", r1.status === 409 && r1.j?.code === "GEAENDERT");
    const r2 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, gelesen: false });
    ok("Ohne Häkchen → 400", r2.status === 400 && r2.j?.code === "GELESEN");
    const r3 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, png: dataUrl(pngBild(360, 110, false)) });
    ok("Leeres Zeichenfeld → 400", r3.status === 400 && r3.j?.code === "ZEICHNUNG");
    const r3b = await gast.ruf("/datenraum/unterzeichnen", { ...basis, png: dataUrl(pngBombe()) });
    ok("Bombe als Unterschrift → 400 ZEICHNUNG (nichts entpackt)", r3b.status === 400 && r3b.j?.code === "ZEICHNUNG");
    const r4 = await gast.ruf("/datenraum/unterzeichnen", { ...basis, name: "Max Mustermann unter Vorbehalt" });
    ok("Name mit Zusatz → 400 mit dem erwarteten Namen", r4.status === 400 && r4.j?.code === "NAME" && /Max Mustermann/.test(r4.j?.error ?? ""));
    const roboter = new Sitzung(null); roboter.kekse = new Map(gast.kekse);
    const r5 = await roboter.ruf("/datenraum/unterzeichnen", basis);
    ok("Von der Maschine selbst (127.0.0.1) → 403 (Roboter-Wand)", r5.status === 403 && r5.j?.code === "ROBOTER");
    const kopflos = new Sitzung("203.0.113.10", "Mozilla/5.0 HeadlessChrome/120", true); kopflos.kekse = new Map(gast.kekse);
    const r6 = await kopflos.ruf("/datenraum/unterzeichnen", basis);
    ok("Automatisierter Browser → 403", r6.status === 403 && r6.j?.code === "ROBOTER");
    ok("Bis hier keine Vereinbarung gespeichert", Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda`) as any[])[0].n) === 0);
    const r7 = await gast.ruf("/datenraum/unterzeichnen", basis);
    ok("Unterzeichnet → sofort der Raum", r7.status === 200 && r7.j?.schritt === "raum" && !!r7.j?.nda?.unterzeichnetAm, `${r7.status} ${JSON.stringify(r7.j)?.slice(0, 160)}`);
    const sichtbar = (r7.j?.projekte ?? []).flatMap((p: any) => p.dokumente.map((d: any) => d.titel));
    ok("Nur sichtbare Dokumente in der Liste (A1, B1, C1 — nicht A2), jetzt mit Ordnerbeschreibung", sichtbar.sort().join(",") === "A1 Übersicht,B1 Plan,C1 Word" && r7.j.projekte.every((p: any) => /^Ordner /.test(p.beschreibung)), sichtbar.join(","));
    ok("Word nur zum Herunterladen, PDF/Bild auch ansehen", (r7.j?.projekte ?? []).flatMap((p: any) => p.dokumente).every((d: any) => d.ansehen === (d.typ !== "Word")));
    const r8 = await gast.ruf("/datenraum/unterzeichnen", basis);
    const [n] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Doppelter Klick → keine zweite Vereinbarung", r8.status === 200 && r8.j?.schon === true && Number(n.n) === 1);
    const [z] = (await sqlPool`
      SELECT fassung, text_hash, text_kanonisch, zustimmung_text, nda_angezeigt_am, ip, ip_kette, user_agent, unterschrift_name, code_hinweis, sitzung_version,
             email, email_herkunft, length(unterschrift_png) AS png, length(pdf) AS pdf, pdf AS pdf_daten, pdf_sha256, sha256(pdf) AS echt, angenommen_am = unterzeichnet_am AS gleich,
             projekt_ids, projekt_hashes FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Gespeichert: Fassung, Prüfsumme, Name, Bild, PDF, Browser", z.fassung === NDA_FASSUNG && z.text_hash === ndaHash && /Safari/.test(z.user_agent) && z.unterschrift_name === "Max Mustermann" && Number(z.png) > 200 && Number(z.pdf) > 5000);
    ok("IP des Gastes (cf-connecting-ip), rohe Kette mit dem Rand von Cloudflare", z.ip === "203.0.113.10" && /cf=203\.0\.113\.10/.test(z.ip_kette) && new RegExp(`peer=${CF_RAND.replace(/\./g, "\\.")}`).test(z.ip_kette), `${z.ip} · ${z.ip_kette}`);
    ok("Wortlaut gespeichert, Prüfsumme nachrechenbar (sha256(text_kanonisch) = text_hash)", drSha256(String(z.text_kanonisch)) === z.text_hash);
    ok("Zustimmung, angezeigt am, Zugang (Code-Hinweis, Sitzungsstand), E-Mail mit Herkunft", z.zustimmung_text === "Ich habe die Vereinbarung gelesen und bin einverstanden." && !!z.nda_angezeigt_am && String(z.code_hinweis).length === 2 && Number(z.sitzung_version) === 1 && z.email === GAST.email && z.email_herkunft === "wie in der Einladung");
    ok("PDF-Prüfsumme stimmt, Annahme = Freischaltung, Projekt-Prüfsummen je Thema", z.pdf_sha256 === Buffer.from(z.echt).toString("hex") && z.gleich === true && (z.projekt_ids as any[]).length === 3 && Object.keys(JSON.parse(JSON.stringify(z.projekt_hashes))).length === 3);
    const pt = ohneLeer((await pdfText(Buffer.from(z.pdf_daten))).join(" "));
    ok("Im PDF: IP des Gastes, Häkchen, Code-Hinweis, E-Mail aus der Einladung", pt.includes("203.0.113.10") && pt.includes(ohneLeer("Häkchen gesetzt")) && pt.includes(ohneLeer(`Einladungscode …${z.code_hinweis}`)) && pt.includes(ohneLeer("wie in der Einladung")));
    const fest = await gast.ruf("/datenraum/angaben", { angaben: { ...GAST, vorname: "Moritz" } });
    ok("Angaben nach der Unterschrift → 409 (festgeschrieben), Antwort ohne Liste anderer Gäste", fest.status === 409 && fest.j?.code === "ANGABEN_FEST" && /js@fiaon\.com/.test(fest.j?.error ?? ""));
    // Bremse auf /unterzeichnen: ein zweiter Gast, zehn Fehlversuche, dann 429 — vor jeder teuren Prüfung.
    const g2 = await L.drGastEinladen(raum.id, { vorname: "Erika", nachname: "Probe", email: "erika.probe@example.invalid" }, WER) as any;
    const s2 = new Sitzung("203.0.113.30", BROWSER, true);
    await s2.ruf("/datenraum/eintreten", { code: g2.code });
    const v2 = await s2.ruf("/datenraum/angaben", { angaben: { ...GAST, anrede: "frau", vorname: "Erika", nachname: "Probe", email: "erika.probe@example.invalid", firma: "", funktion: "" } });
    for (let i = 0; i < 10; i++) await s2.ruf("/datenraum/unterzeichnen", { textHash: v2.j?.nda?.hash, gelesen: false, name: "x", png: "" });
    const zuViel = await s2.ruf("/datenraum/unterzeichnen", { textHash: v2.j?.nda?.hash, gelesen: true, name: "Erika Probe", png: sig });
    ok("Zehn Fehlversuche → elfter Versuch 429 (auch richtig ausgefüllt)", zuViel.status === 429 && zuViel.j?.code === "GEBREMST");
  });

  await abschnitt("B5 Zugriff nach der Vereinbarung: Vermerk mit Vorgangsnummer, Protokoll vorher, HEAD, Bremse", async () => {
    const d = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("PDF ansehen → 200 inline", d.status === 200 && d.kopf.get("content-type") === "application/pdf" && /^inline;/.test(d.kopf.get("content-disposition") ?? ""));
    ok("Kein Speicher, nosniff, noindex", /no-store/.test(d.kopf.get("cache-control") ?? "") && d.kopf.get("x-content-type-options") === "nosniff" && /noindex/.test(d.kopf.get("x-robots-tag") ?? ""));
    const vorgang = d.kopf.get("x-datenraum-vorgang") ?? "";
    const [pz] = (await sqlPool`SELECT id, art, ip FROM fiaon_dr_protokoll WHERE gast_id = ${gastId} AND art = 'dokument_angesehen' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Vorgangsnummer = Kennung der Protokollzeile, IP des Gastes", vorgang === `DR-${pz.id}` && pz.ip === "203.0.113.10", `${vorgang} / DR-${pz?.id}`);
    const t = await pdfText(d.roh);
    const heute = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    ok("Vermerk „Vertraulich · Name · Datum · DR-…“ auf jeder Seite (auch gedreht)", t.length === 2 && t.every((s) => ohneLeer(s).includes(ohneLeer(`Vertraulich · Max Mustermann · ${heute} · ${vorgang}`))), t.map((s) => s.slice(-60)).join(" | "));
    const vorHead = await anzahl("dokument_angesehen", gastId);
    const head = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`, undefined, {}, "HEAD");
    ok("HEAD → 405 und keine Protokollzeile", head.status === 405 && (await anzahl("dokument_angesehen", gastId)) === vorHead);
    const l = await gast.ruf(`/datenraum/dokument/${docA1.kennung}?laden=1`);
    ok("Herunterladen → attachment mit Dateiname", l.status === 200 && /^attachment; filename="A1_Uebersicht.pdf"/.test(l.kopf.get("content-disposition") ?? ""), l.kopf.get("content-disposition") ?? "");
    const bild = await gast.ruf(`/datenraum/dokument/${docB1.kennung}`);
    ok("Bild inline als image/png (ohne Vermerk, unverändert)", bild.status === 200 && bild.kopf.get("content-type") === "image/png" && bild.roh.equals(pngBild(200, 120)));
    const word = await gast.ruf(`/datenraum/dokument/${docC1.kennung}`);
    ok("Word immer als Download", word.status === 200 && /^attachment;/.test(word.kopf.get("content-disposition") ?? "") && /wordprocessingml/.test(word.kopf.get("content-type") ?? ""));
    ok("Unsichtbares Dokument → 404", (await gast.ruf(`/datenraum/dokument/${docA2.kennung}`)).status === 404);
    ok("Dokument eines fremden Raums → 404", (await gast.ruf(`/datenraum/dokument/${docF.kennung}`)).status === 404);
    const unbekannt = await gast.ruf("/datenraum/dokument/AAAAAAAAAAAAAAAAAAAAAA");
    const kaputt = await gast.ruf("/datenraum/dokument/..%2F..%2Fetc");
    ok("Unbekannte oder kaputte Kennung → 404", unbekannt.status === 404 && kaputt.status === 404);
    ok("Jede Auslieferung im Protokoll (2 PDF-Ansichten/Downloads, Bild, Word)", (await anzahl("dokument_angesehen", gastId)) === 3 && (await anzahl("dokument_geladen", gastId)) === 1);
    ok("Verweigerte Zugriffe im Protokoll", (await anzahl("zugriff_verweigert", gastId)) >= 4);
    const eigen = await gast.ruf("/datenraum/nda.pdf");
    const et = ohneLeer((await pdfText(eigen.roh)).join(" "));
    ok("Eigenes Exemplar als PDF mit Name, Prüfsumme und Annahme", eigen.status === 200 && et.includes(ohneLeer("Herr Max Mustermann")) && et.includes(ndaHash) && et.includes(ohneLeer("Angenommen durch FIAON LTD und Justin Schwarzott")));
    // Abruf-Bremse: 60 Auslieferungen in 10 Minuten — die 61. wartet.
    // (Zeilen ohne Kettenglied, danach in die Vergangenheit geschoben — die Kette und die späteren Abschnitte bleiben unberührt.)
    await sqlPool`INSERT INTO fiaon_dr_protokoll (raum_id, gast_id, dokument_id, art, detail) SELECT ${raum.id}, ${gastId}, ${docA1.id}, 'dokument_angesehen', 'Prüfstand-Bremse' FROM generate_series(1, 56)`;
    const zuViel = await gast.ruf(`/datenraum/dokument/${docA1.kennung}`);
    ok("Über 60 Abrufe in 10 Minuten → 429 (der Inhalt wird gar nicht erst geladen)", zuViel.status === 429 && zuViel.j?.code === "GEBREMST");
    await sqlPool`UPDATE fiaon_dr_protokoll SET created_at = NOW() - INTERVAL '2 hours' WHERE detail = 'Prüfstand-Bremse'`;
  });

  await abschnitt("B6 Meldungen — gebündelt, mit Anhang und vollen Prüfsummen, ohne echte Mail", async () => {
    const [m] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_tagesmeldung WHERE gast_id = ${gastId}`) as any[];
    ok("Mehrere Ansichten → genau EINE Tagesmeldung", Number(m.n) === 1);
    post.length = 0;
    const [n0] = (await sqlPool`SELECT id, mail_gast_am, mail_gast_fehler, text_hash, pdf_sha256 FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Nach der Unterschrift: Mails abgeschaltet (DATENRAUM_MAILS=aus) → Fehler notiert, nichts gesendet", !n0.mail_gast_am && /abgeschaltet/.test(String(n0.mail_gast_fehler)));
    await L.drMailsNachUnterschrift(Number(n0.id), attrappe);
    const anGast = post.find((p) => p.an === GAST.email); const anJustin = post.find((p) => p.an === "js@fiaon.com");
    ok("Kopie an den Gast: Sie-Anrede, PDF im Anhang, Antwort an Justin, Link zum Raum", !!anGast && anGast.anrede === "Sehr geehrter Herr Mustermann," && anGast.anhaenge?.[0]?.inhalt.subarray(0, 5).toString() === "%PDF-" && anGast.antwortAn?.email === "js@fiaon.com" && /datenraum\/raum/.test(anGast.text));
    ok("Beide Mails tragen die VOLLEN Prüfsummen von Wortlaut und Datei", anGast.text.includes(n0.text_hash) && anGast.text.includes(n0.pdf_sha256) && anJustin.text.includes(n0.text_hash) && anJustin.text.includes(n0.pdf_sha256));
    ok("Meldung an Justin: „hat die NDA unterschrieben“, mit PDF, „Der Gast sieht ab jetzt …“", !!anJustin && anJustin.betreff === "Max Mustermann hat die NDA unterschrieben" && anJustin.anhaenge?.length === 1 && /Der Gast sieht ab jetzt alle sichtbaren Unterlagen/.test(anJustin.text));
    const [n1] = (await sqlPool`SELECT mail_gast_am, mail_justin_am FROM fiaon_dr_nda WHERE id = ${n0.id}`) as any[];
    ok("Versand vermerkt", !!n1.mail_gast_am && !!n1.mail_justin_am);
    post.length = 0;
    await L.drMailsNachUnterschrift(Number(n0.id), attrappe);
    ok("Kein zweiter Versand", post.length === 0);
    const etwas = await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 0 });
    const tages = post.find((p) => /liest/.test(p.betreff));
    ok("Tagesmeldung an Justin mit allen geöffneten Unterlagen und Vorgangsnummern, Titel „Dein Gast liest“", etwas && !!tages && tages.an === "js@fiaon.com" && /A · A1 Übersicht/.test(tages.text) && /B · B1 Plan/.test(tages.text) && /DR-\d+/.test(tages.text) && /3 Unterlagen/.test(tages.betreff) && tages.baustein?.titel === "Dein Gast liest", tages?.betreff);
    post.length = 0;
    await L.drMeldungenLauf({ sender: attrappe, wartenMinuten: 0 });
    ok("Am selben Tag keine zweite Tagesmeldung", post.filter((p) => /liest/.test(p.betreff)).length === 0);
  });

  await abschnitt("B7 Nachtrag: neues Thema, geändertes Thema — erst nach Freigabe, mit festgeschriebenen Angaben", async () => {
    const pD = await L.drProjektSpeichern(raum.id, { schluessel: "delta", titel: "Projekt Delta", ndaText: "ein erfundenes viertes Vorhaben" }, WER) as any;
    const docD = await L.drDokumentAblegen({ projektId: pD.id, buffer: await probePdf("Delta"), dateiname: "Delta.pdf", titel: "D1 Delta", nr: 1 }, WER) as any;
    const st0 = await gast.ruf("/datenraum/stand");
    const n0 = await gast.ruf("/datenraum/nda");
    ok("Neues Projekt mit Unterlagen, aber noch nicht freigegeben → kein Nachtrag, keine Vereinbarung (409)", st0.j?.nachtrag === false && n0.status === 409 && pD.buchstabe === "D");
    ok("Die bisherigen Unterlagen bleiben erreichbar", (await gast.ruf(`/datenraum/dokument/${docA1.kennung}`)).status === 200);
    await L.drNdaFreigeben(raum.id, WER);
    const st = await gast.ruf("/datenraum/stand");
    ok("Nach der Freigabe → Nachtrag angezeigt, Ordner D noch ohne Dokumente", st.j?.nachtrag === true && st.j.projekte.find((p: any) => p.buchstabe === "D")?.abgedeckt === false);
    const zu = await gast.ruf(`/datenraum/dokument/${docD.kennung}`);
    ok("Dokument des neuen Themas → 403 (Nachtrag)", zu.status === 403 && zu.j?.code === "NACHTRAG");
    const n = await gast.ruf("/datenraum/nda");
    ok("Ergänzte Vereinbarung nennt vier Themen, mit den festgeschriebenen Angaben", n.j?.nda?.hash !== ndaHash && JSON.stringify(n.j?.nda?.bloecke).includes("vier Themen") && JSON.stringify(n.j?.nda?.bloecke).includes("Projekt Delta") && JSON.stringify(n.j?.nda?.bloecke).includes("Herr Max Mustermann"));
    const u = await gast.ruf("/datenraum/unterzeichnen", { textHash: n.j.nda.hash, gelesen: true, name: "Max Mustermann", png: dataUrl(pngBild(300, 100)) });
    ok("Ergänzung unterzeichnet → kein Nachtrag mehr, Zugriff auf das neue Thema", u.status === 200 && u.j?.nachtrag === false && (await gast.ruf(`/datenraum/dokument/${docD.kennung}`)).status === 200);
    // Ein Projekt wird umgewidmet: § 1 von B ändert sich — die alte Unterschrift deckt B nicht mehr.
    const aend = await L.drProjektSpeichern(raum.id, { schluessel: "beta", titel: "Projekt Beta", ndaText: "der mögliche Erwerb eines erfundenen Gebäudes", geschuetzt: "die Beta-Gesellschaft" }, WER) as any;
    ok("Änderung am Wortlaut eines unterschriebenen Projekts: Hinweis „neu freigeben“ und betroffene Gäste", aend.ok && /neu freigeben/.test(aend.meldung) && /1 Gast/.test(aend.meldung), aend.meldung);
    await L.drNdaFreigeben(raum.id, WER);
    const b1 = await gast.ruf(`/datenraum/dokument/${docB1.kennung}`);
    const stB = await gast.ruf("/datenraum/stand");
    ok("Unterlagen des geänderten Projekts → 403 Nachtrag, Ordner B zu, Nachtrag angezeigt", b1.status === 403 && b1.j?.code === "NACHTRAG" && stB.j?.nachtrag === true && stB.j.projekte.find((p: any) => p.buchstabe === "B")?.abgedeckt === false);
    const nB = await gast.ruf("/datenraum/nda");
    const uB = await gast.ruf("/datenraum/unterzeichnen", { textHash: nB.j.nda.hash, gelesen: true, name: "Max Mustermann", png: dataUrl(pngBild(300, 100)) });
    ok("Ergänzte Fassung unterschrieben → B wieder offen", uB.status === 200 && (await gast.ruf(`/datenraum/dokument/${docB1.kennung}`)).status === 200);
    const uC = await gast.ruf("/datenraum/unterzeichnen", { textHash: nB.j.nda.hash, gelesen: true, name: "Max Mustermann", png: dataUrl(pngBild(300, 100)) });
    const [c] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_nda WHERE gast_id = ${gastId}`) as any[];
    ok("Ohne neuen Anlass keine weitere Vereinbarung; drei im Bestand (keine überschrieben)", uC.j?.schon === true && Number(c.n) === 3);
  });

  await abschnitt("B8 Sperren und neuer Code", async () => {
    await L.drGastSperren(gastId, true, "Prüfstand", WER);
    const st = await gast.ruf("/datenraum/stand");
    ok("Gesperrt → Sitzung sofort ungültig", st.j?.angemeldet === false);
    ok("Gesperrt → Dokument 401", (await gast.ruf(`/datenraum/dokument/${docA1.kennung}`)).status === 401);
    const wieder = await new Sitzung("203.0.113.11", BROWSER, true).ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Gesperrt → Eintritt 403 mit Hinweis", wieder.status === 403 && wieder.j?.code === "GESPERRT");
    await L.drGastSperren(gastId, false, null, WER);
    const neu = new Sitzung("203.0.113.12", BROWSER, true);
    const rein = await neu.ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Entsperrt → wieder eintreten, direkt im Raum", rein.status === 200 && rein.j?.schritt === "raum");
    const c2 = await L.drGastCodeNeu(gastId, WER) as any;
    const alt = await new Sitzung("203.0.113.13", BROWSER, true).ruf("/datenraum/eintreten", { code: einladung.code });
    ok("Neuer Code → alter Code 403, Link mit Anker", c2.ok && alt.status === 403 && /#c=DR-/.test(c2.link));
    ok("Neuer Code → offene Sitzung beendet", (await neu.ruf("/datenraum/stand")).j?.angemeldet === false);
    ok("Neuer Code → eintreten", (await new Sitzung("203.0.113.14", BROWSER, true).ruf("/datenraum/eintreten", { code: c2.code })).status === 200);
  });

  await abschnitt("B9 Verwaltung im Chefbüro — nur Inhaber, Ansichten im Protokoll, Vorschau, Freigabe, Entwurf, CSV", async () => {
    ok("Ohne Chef-Anmeldung → 401", (await new Sitzung().ruf("/chef/datenraum")).status === 401);
    const gfS = new Sitzung(); gfS.kekse.set("fiaon_chef", chefKeks(2, "geschaeftsfuehrung"));
    const gf = await gfS.ruf("/chef/datenraum");
    ok("Geschäftsführung → 403 (nur der Inhaber)", gf.status === 403 && gf.j?.code === "STUFE_ZU_NIEDRIG");
    const inh = new Sitzung(); inh.kekse.set("fiaon_chef", chefKeks(1, "inhaber"));
    const liste = await inh.ruf("/chef/datenraum");
    ok("Inhaber → Liste", liste.status === 200 && liste.j?.raeume?.length >= 2);
    const zuordnen = await inh.ruf(`/chef/datenraum/raum/${raum.id}`, { firmaId: 4711 });
    const proPartner = await inh.ruf("/chef/datenraum?firma=4711");
    ok("Raum einem Partner zuordnen → erscheint beim Partner, der fremde bleibt „ohne Partner“", zuordnen.j?.ok && proPartner.j?.raeume?.some((r: any) => r.id === raum.id) && proPartner.j?.ohnePartner?.some((r: any) => r.id === fremd.id));
    const akte = await inh.ruf(`/chef/datenraum/raum/${raum.id}`);
    const g = akte.j?.gaeste?.find((x: any) => x.id === gastId);
    ok("Akte: Gast „NDA unterschrieben“ mit drei Fassungen, Freigabe, Kette geprüft", g?.status === "unterzeichnet" && g?.ndas?.length === 3 && akte.j?.raum?.freigegeben === true && akte.j?.kette?.ok === true && akte.j?.protokoll?.length > 10);
    ok("Akte verrät keinen Code", !JSON.stringify(akte.j).includes(einladung.code) && /^…[A-Z2-9]{2}$/.test(g?.codeHinweis ?? ""));
    const fd = new FormData();
    fd.append("titel", "B2 Hochgeladen"); fd.append("beschreibung", "Über die Verwaltung."); fd.append("sichtbar", "0"); fd.append("quelle", "hochgeladen.pdf");
    fd.append("datei", new Blob([await probePdf("Hochgeladen")], { type: "application/pdf" }), "hochgeladen.pdf");
    const up = await inh.ruf(`/chef/datenraum/projekt/${pB.id}/dokument`, fd);
    ok("Hochladen über die Verwaltung (unsichtbar, mit Quelle)", up.status === 200 && up.j?.neu === true && up.j?.vermerkMoeglich === true);
    const html = new FormData(); html.append("datei", new Blob(["<html><script>x</script></html>".padEnd(80, " ")], { type: "application/pdf" }), "boese.pdf");
    ok("HTML mit PDF-Etikett → 400", (await inh.ruf(`/chef/datenraum/projekt/${pB.id}/dokument`, html)).status === 400);
    const an = await inh.ruf(`/chef/datenraum/dokument/${up.j.id}`, { sichtbar: true, titel: "B2 Hochgeladen (neu)", nr: 7 });
    ok("Sichtbarkeit, Titel und Nummer ändern", an.j?.ok && /sichtbar/.test(an.j?.meldung ?? ""));
    const vorChef = await anzahl("chef_nda");
    const pdfChef = await inh.ruf(`/chef/datenraum/nda/${g.ndas[2].id}`);
    ok("Jede unterschriebene Fassung als PDF — und die Ansicht steht mit Namen im Protokoll", pdfChef.status === 200 && pdfChef.roh.subarray(0, 5).toString() === "%PDF-" && (await anzahl("chef_nda")) === vorChef + 1);
    const orig = await inh.ruf(`/chef/datenraum/dokument/${docA2.id}`);
    const [ca] = (await sqlPool`SELECT wer, art FROM fiaon_dr_protokoll WHERE art = 'chef_angesehen' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Original ansehen (auch unsichtbar) — im Protokoll mit Namen", orig.status === 200 && orig.kopf.get("content-type") === "application/pdf" && ca?.wer === "Prüfstand Inhaber");
    // Vorschau und Freigabe
    const neuRaum = await inh.ruf("/chef/datenraum/raum", { titel: "Zweiter Raum PRUEFSTAND", firmaId: 4711, projekte: [{ titel: "Projekt Eins", ndaText: "ein erfundenes Vorhaben" }] });
    const ohne = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/gast`, { vorname: "Ohne", nachname: "Freigabe", email: "ohne@example.invalid" });
    ok("Einladen ohne Freigabe → 409 FREIGABE", ohne.status === 409 && ohne.j?.code === "FREIGABE");
    const vor = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/vorschau`);
    const vorPdf = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/vorschau.pdf`);
    ok("Vorschau: Blöcke mit Platzhaltern und Entwurf als PDF", vor.j?.ok && JSON.stringify(vor.j.bloecke).includes("‹Nachname›") && vor.j.freigegeben === false && vorPdf.status === 200 && /ENTWURF/.test((await pdfText(vorPdf.roh)).join(" ")));
    const alt = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/freigeben`, { hash: "0".repeat(64) });
    ok("Freigabe mit veralteter Prüfsumme → 409", alt.status === 409);
    const fr = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/freigeben`, { hash: vor.j.raumHash });
    const ein = await inh.ruf(`/chef/datenraum/raum/${neuRaum.j.id}/gast`, { anrede: "frau", vorname: "Erika", nachname: "Muster", email: "erika.muster@example.invalid" });
    ok("Nach der Freigabe: einladen → Code und Link (Anker)", fr.j?.ok && ein.status === 200 && /#c=DR-/.test(ein.j?.link ?? ""));
    // Einladung als Entwurf in js@ (Attrappe statt Gmail)
    const entwuerfe: any[] = [];
    L.drPruefHaken({ entwurf: async (m) => { entwuerfe.push(m); return "entwurf-pruef-1"; } });
    const falschCode = await inh.ruf(`/chef/datenraum/gast/${ein.j.id}/entwurf`, { code: "DR-AAAA-AAAA-AAAA" });
    const rechtCode = await inh.ruf(`/chef/datenraum/gast/${ein.j.id}/entwurf`, { code: ein.j.code });
    L.drPruefHaken({ entwurf: null });
    const e0 = entwuerfe[0];
    ok("Entwurf nur mit dem echten Code; Sie-Text mit Link und Code an die Gast-Adresse, nichts gesendet", falschCode.status === 400 && rechtCode.j?.ok && entwuerfe.length === 1 && e0.an === "erika.muster@example.invalid" && e0.text.startsWith("Sehr geehrte Frau Muster,") && e0.text.includes(ein.j.code) && e0.text.includes(ein.j.link) && /Senden/.test(rechtCode.j?.meldung ?? ""));
    const csv = await inh.ruf(`/chef/datenraum/gast/${gastId}/protokoll.csv`);
    const csvText = csv.roh.toString("utf8");
    ok("Protokoll je Gast als CSV (Vorgang, Zeit, Dokument mit Prüfsumme, IP, Kette)", csv.status === 200 && /text\/csv/.test(csv.kopf.get("content-type") ?? "") && csvText.includes("Vorgang;Zeit (Berlin);Zeit (UTC)") && csvText.includes("Ausgeliefert (Ansicht)") && csvText.includes("203.0.113.10") && /;[0-9a-f]{64}\n/.test(csvText));
  });

  await abschnitt("B10 Wiedervorlage in der Partner-Akte (Regel Nr. 1)", async () => {
    const crm = await import("../server/lib/fiaon-partner-crm");
    const firma = await crm.firmaAnlegen({ name: "Prüfstand Partner GmbH" }, WER) as any;
    const r = await L.drRaumAnlegen({ titel: "Partner-Raum PRUEFSTAND", firmaId: firma.id, projekte: [{ titel: "Projekt Partner", ndaText: "ein erfundenes Vorhaben" }] }, WER) as any;
    await L.drNdaFreigeben(r.id, WER);
    const e = await L.drGastEinladen(r.id, { anrede: "herr", vorname: "Paul", nachname: "Partner", email: "paul.partner@example.invalid" }, WER) as any;
    const [a] = (await sqlPool`SELECT id, titel, faellig_am::text AS f, erledigt_am FROM fiaon_partner_aufgaben WHERE firma_id = ${firma.id}`) as any[];
    const { werktagPlus } = await import("../shared/fiaon-global-lead-texte");
    const { istFeiertag } = await import("../shared/fiaon-feiertage");
    const { berlinToday } = await import("../server/lib/fiaon-time");
    ok("Einladung → Aufgabe „Unterschrift nachfassen“ in drei Werktagen, Eintrag im Verlauf", e.ok && a?.titel === "Datenraum: Unterschrift von Paul Partner nachfassen" && a.f === werktagPlus(berlinToday(), 3, (t) => istFeiertag("DE", t)) && !a.erledigt_am && /Wiedervorlage/.test(e.meldung));
    const s = new Sitzung("203.0.113.40", BROWSER, true);
    await s.ruf("/datenraum/eintreten", { code: e.code });
    const v = await s.ruf("/datenraum/angaben", { angaben: { ...GAST, vorname: "Paul", nachname: "Partner", email: "paul.partner@example.invalid", firma: "", funktion: "" } });
    const u = await s.ruf("/datenraum/unterzeichnen", { textHash: v.j?.nda?.hash, gelesen: true, name: "Paul Partner", png: dataUrl(pngBild(300, 100)) });
    const [a2] = (await sqlPool`SELECT erledigt_am FROM fiaon_partner_aufgaben WHERE id = ${a.id}`) as any[];
    const verlauf = (await sqlPool`SELECT titel FROM fiaon_partner_verlauf WHERE firma_id = ${firma.id} ORDER BY id`) as any[];
    ok("Unterschrift → Aufgabe erledigt, Verlauf „eingeladen“, „Erledigt: …“, „NDA unterschrieben“", u.status === 200 && !!a2.erledigt_am && verlauf.some((x) => /eingeladen/.test(x.titel)) && verlauf.some((x) => /^Erledigt: Datenraum/.test(x.titel)) && verlauf.some((x) => /NDA unterschrieben — Paul Partner/.test(x.titel)), verlauf.map((x) => x.titel).join(" | "));
  });

  await abschnitt("B11 Protokoll-Kette erkennt Manipulation", async () => {
    const k1 = await L.drProtokollKette();
    ok("Kette über alle Zeilen geprüft und heil", k1.ok && k1.zeilen > 50, `${k1.zeilen} Zeilen`);
    const [z] = (await sqlPool`SELECT id, detail FROM fiaon_dr_protokoll WHERE art = 'nda_unterzeichnet' ORDER BY id LIMIT 1`) as any[];
    await sqlPool`UPDATE fiaon_dr_protokoll SET detail = 'nachträglich geändert' WHERE id = ${z.id}`;
    const k2 = await L.drProtokollKette();
    await sqlPool`UPDATE fiaon_dr_protokoll SET detail = ${z.detail} WHERE id = ${z.id}`;
    ok("Eine nachträglich geänderte Zeile bricht die Kette genau dort", !k2.ok && k2.bruchBei === Number(z.id));
    ok("Zurückgesetzt → wieder heil", (await L.drProtokollKette()).ok);
  });

  await abschnitt("B12 scripts/datenraum.ts", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dr-pruef-"));
    try {
      const lauf = (args: string[], url = DB_URL) => spawnSync(path.join(process.cwd(), "node_modules/.bin/tsx"), ["scripts/datenraum.ts", ...args], {
        cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: url, SESSION_SECRET: SECRET, APP_BASE_URL: "https://fiaon.com" }, timeout: 120_000,
      });
      const schutz = lauf(["liste"], "postgresql://x@db.example.invalid:5432/x?sslmode=require");
      ok("Fremde Datenbank ohne --produktion → Abbruch (Code 2)", schutz.status === 2 && /--produktion/.test(schutz.stderr), schutz.stderr.trim().slice(0, 120));
      const codeProd = lauf(["gast-anlegen", "--raum", "1", "--vorname", "A", "--nachname", "Be", "--email", "a@example.invalid", "--produktion"], "postgresql://x@db.example.invalid:5432/x?sslmode=require");
      ok("Gegen die Produktion: gast-anlegen nur mit --code-datei (nie in den Sitzungsverlauf)", codeProd.status === 2 && /--code-datei/.test(codeProd.stderr));
      const ohneGeheimnis = spawnSync(path.join(process.cwd(), "node_modules/.bin/tsx"), ["scripts/datenraum.ts", "gast-anlegen", "--raum", "1", "--vorname", "A", "--nachname", "Be", "--email", "a@example.invalid", "--code-datei", path.join(tmp, "c.txt"), "--produktion"], { cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: "postgresql://x@db.example.invalid:5432/x?sslmode=require" }, timeout: 60_000 });
      ok("Gegen die Produktion: gast-anlegen nur mit dem SESSION_SECRET der Produktion (sonst passt der Code nie)", ohneGeheimnis.status === 2 && /SESSION_SECRET/.test(ohneGeheimnis.stderr));
      fs.writeFileSync(path.join(tmp, "raum.json"), JSON.stringify({ titel: "Skript-Raum PRUEFSTAND", nda: { vorgestellt: "zuletzt am 9. November 2026" }, projekte: [{ schluessel: "eins", titel: "Projekt Eins", beschreibung: "Erstes" }, { schluessel: "zwei", titel: "Projekt Zwei", beschreibung: "Zweites" }] }));
      const raeumeVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume`) as any[])[0].n);
      const vorschau = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json")]);
      ok("Vorschau schreibt nichts", vorschau.status === 0 && Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume`) as any[])[0].n) === raeumeVorher && /Vorschau/.test(vorschau.stdout));
      const a = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--schreiben"]);
      const b = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--partner", "4712", "--schreiben"]);
      const sr = ((await sqlPool`SELECT id, partner_firma_id FROM fiaon_dr_raeume WHERE titel = 'Skript-Raum PRUEFSTAND'`) as any[]);
      ok("raum-anlegen gleicht nur über den Titel ab: zweiter Lauf mit --partner → derselbe Raum, Partner zugeordnet", a.status === 0 && b.status === 0 && sr.length === 1 && Number(sr[0].partner_firma_id) === 4712 && /abgeglichen/.test(b.stdout), (a.stderr + b.stderr).slice(0, 200));
      const c = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--partner", "4713", "--schreiben"]);
      ok("Anderer Partner für denselben Titel → Abbruch mit Hinweis auf --raum", c.status === 2 && /--raum/.test(c.stderr));
      const raumId = Number(sr[0].id);
      const g0 = lauf(["gast-anlegen", "--raum", String(raumId), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--schreiben"]);
      ok("gast-anlegen ohne Freigabe → Fehler mit Hinweis", g0.status === 1 && /freigeben/i.test(g0.stderr));
      const nv = lauf(["nda-vorschau", "--raum", String(raumId), "--freigeben", "--schreiben"]);
      ok("nda-vorschau --raum --freigeben --schreiben gibt frei", nv.status === 0 && /FREIGEGEBEN/.test(nv.stdout), (nv.stdout + nv.stderr).slice(-200));
      for (const [ordner, docs] of [["A_eins", [["1.pdf", "Erste Unterlage", true]]], ["zwei", [["z.pdf", "Zweite Unterlage", false], ["bild.png", "Ein Bild", true]]]] as const) {
        fs.mkdirSync(path.join(tmp, "ordner", ordner), { recursive: true });
        const manifest = [];
        for (const [i, [datei, titel, sichtbar]] of docs.entries()) {
          fs.writeFileSync(path.join(tmp, "ordner", ordner, datei), datei.endsWith(".png") ? pngBild(150, 80) : await probePdf(`${titel}`));
          manifest.push({ nr: `0${i}`, titel, beschreibung: `${titel} — ein Satz.`, datei, sichtbar_standard: sichtbar });
        }
        fs.writeFileSync(path.join(tmp, "ordner", ordner, "manifest.json"), JSON.stringify(manifest));
      }
      const h1 = lauf(["hochladen", "--raum", String(raumId), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const h2 = lauf(["hochladen", "--raum", String(raumId), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const docs = (await sqlPool`SELECT titel, sichtbar, nr FROM fiaon_dr_dokumente WHERE raum_id = ${raumId} AND entfernt_am IS NULL ORDER BY titel`) as any[];
      ok("hochladen: Ordner → Projekt (Buchstabe oder Schlüssel), Sichtbarkeit und Nummer („00“) aus dem Manifest", h1.status === 0 && docs.length === 3 && docs.find((d: any) => d.titel === "Zweite Unterlage")?.sichtbar === false && docs.find((d: any) => d.titel === "Erste Unterlage")?.nr === 0, (h1.stderr || h1.stdout).slice(-200));
      ok("hochladen zweimal → nichts doppelt (SHA-256)", h2.status === 0 && /0 neu, 0 ersetzt, 3 unverändert/.test(h2.stdout), h2.stdout.slice(-120));
      fs.writeFileSync(path.join(tmp, "ordner", "A_eins", "1.pdf"), await probePdf("Erste Unterlage, neue Fassung"));
      const h3 = lauf(["hochladen", "--raum", String(raumId), "--ordner", path.join(tmp, "ordner"), "--schreiben"]);
      const [ersetzt] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_dokumente WHERE raum_id = ${raumId} AND entfernt_am IS NOT NULL AND ersetzt_durch IS NOT NULL`) as any[];
      ok("Neue Fassung derselben Datei ersetzt die alte (alte bleibt in der Datenbank)", h3.status === 0 && /1 ersetzt/.test(h3.stdout) && Number(ersetzt.n) === 1);
      const g1 = lauf(["gast-anlegen", "--raum", String(raumId), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--anrede", "frau", "--schreiben"]);
      const code = /Code:\s+(DR-[A-Z2-9-]+)/.exec(g1.stdout)?.[1] ?? "";
      ok("gast-anlegen (lokal) gibt Code und Link einmal aus — Link mit Anker", g1.status === 0 && !!code && /Link:\s+https:\/\/fiaon\.com\/datenraum\/zugang#c=DR-/.test(g1.stdout));
      const g2 = lauf(["gast-anlegen", "--raum", String(raumId), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--schreiben"]);
      ok("Gleicher Gast noch einmal → Abbruch mit Hinweis auf --neuer-code", g2.status === 2 && /--neuer-code/.test(g2.stderr));
      const g3 = lauf(["gast-anlegen", "--raum", String(raumId), "--vorname", "Erika", "--nachname", "Musterfrau", "--email", "erika@example.invalid", "--neuer-code", "--code-datei", path.join(tmp, "code.txt"), "--schreiben"]);
      const datei = fs.existsSync(path.join(tmp, "code.txt")) ? fs.readFileSync(path.join(tmp, "code.txt"), "utf8") : "";
      ok("--code-datei: Code und Link nur in der Datei (Rechte 600), nicht auf dem Bildschirm", g3.status === 0 && /Code: DR-/.test(datei) && !/Code:\s+DR-/.test(g3.stdout) && (fs.statSync(path.join(tmp, "code.txt")).mode & 0o777) === 0o600);
      const neuerCode = /Code: (DR-[A-Z2-9-]+)/.exec(datei)?.[1] ?? "";
      const rein = await new Sitzung("203.0.113.20", BROWSER, true).ruf("/datenraum/eintreten", { code: neuerCode });
      ok("Der Code aus der Datei öffnet den Skript-Raum", rein.status === 200 && rein.j?.raum?.titel === "Skript-Raum PRUEFSTAND");
      const s1 = lauf(["sichtbar", "--raum", String(raumId), "--alle", "--aus", "--schreiben"]);
      const [unsicht] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_dokumente WHERE raum_id = ${raumId} AND entfernt_am IS NULL AND sichtbar`) as any[];
      ok("sichtbar --alle --aus schaltet alle Unterlagen des Raums unsichtbar", s1.status === 0 && Number(unsicht.n) === 0);
      const li = lauf(["liste", "--raum", String(raumId)]);
      ok("liste zeigt Projekte, Unterlagen, Gäste und Freigabe — ohne Code", li.status === 0 && /Projekt Eins/.test(li.stdout) && /Erika Musterfrau/.test(li.stdout) && /freigegeben/.test(li.stdout) && !li.stdout.includes(code) && !li.stdout.includes(neuerCode));
      // Ohne Datenbank: nda-vorschau mit einer Papierfassung im Aufbau der Hausvorlage
      const bl = drNdaBloecke({ gast: { ...GAST }, projekte: [{ buchstabe: "A", titel: "Projekt Eins", text: "ein erfundenes Vorhaben" }], raum: { vorgestellt: "zuletzt am 9. November 2026" } });
      fs.writeFileSync(path.join(tmp, "papier.html"), papierAusBloecken(bl, "persönlich, für Muster Beteiligungen AG und die von ihm benannten Gesellschaften"));
      fs.writeFileSync(path.join(tmp, "r.json"), JSON.stringify({ titel: "X", nda: { vorgestellt: "zuletzt am 9. November 2026" }, projekte: [{ schluessel: "a", titel: "Projekt Eins", ndaText: "ein erfundenes Vorhaben" }] }));
      fs.writeFileSync(path.join(tmp, "g.json"), JSON.stringify(GAST));
      const offlineGruen = lauf(["nda-vorschau", "--datei", path.join(tmp, "r.json"), "--gast-datei", path.join(tmp, "g.json"), "--vergleich", path.join(tmp, "papier.html")], "");
      fs.writeFileSync(path.join(tmp, "r2.json"), JSON.stringify({ titel: "X", nda: {}, projekte: [{ schluessel: "a", titel: "Projekt Eins", ndaText: "ein erfundenes Vorhaben" }] }));
      const offlineRot = lauf(["nda-vorschau", "--datei", path.join(tmp, "r2.json"), "--gast-datei", path.join(tmp, "g.json"), "--vergleich", path.join(tmp, "papier.html")], "");
      ok("nda-vorschau ohne Datenbank: grün bei passenden Fallsätzen, rot (Ende 1) wenn einer fehlt", offlineGruen.status === 0 && /GRÜN/.test(offlineGruen.stdout) && offlineRot.status === 1 && /ROT/.test(offlineRot.stdout) && /§ 1 \(1\)/.test(offlineRot.stdout), (offlineGruen.stdout + offlineRot.stdout).slice(-300));
      const ap = lauf(["nda-aus-papier", "--html", path.join(tmp, "papier.html"), "--raum-datei", path.join(process.cwd(), "scripts", "raum.json"), "--gast-datei", path.join(tmp, "g2.json")], "");
      ok("nda-aus-papier schreibt nie ins Repo", ap.status === 2 && /nie im Repo/.test(ap.stderr) && !fs.existsSync(path.join(process.cwd(), "scripts", "raum.json")));
      const ap2 = lauf(["nda-aus-papier", "--html", path.join(tmp, "papier.html"), "--raum-datei", path.join(tmp, "r3.json"), "--gast-datei", path.join(tmp, "g3.json")], "");
      const r3 = JSON.parse(fs.readFileSync(path.join(tmp, "r3.json"), "utf8"));
      ok("nda-aus-papier liest die Fallsätze und vergleicht → grün", ap2.status === 0 && r3.nda.vorgestellt === "zuletzt am 9. November 2026" && r3.projekte[0].ndaText === "ein erfundenes Vorhaben" && /GRÜN/.test(ap2.stdout), (ap2.stdout + ap2.stderr).slice(-300));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  await abschnitt("B13 Raumtour über HTTP: Bühnen nach der Vereinbarung, Vertragsentwurf und Frage, Nachtrag", async () => {
    const T = await import("../server/lib/fiaon-datenraum-tour");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dr-tour-"));
    try {
      const lauf = (args: string[]) => spawnSync(path.join(process.cwd(), "node_modules/.bin/tsx"), ["scripts/datenraum.ts", ...args], {
        cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: DB_URL, SESSION_SECRET: SECRET, APP_BASE_URL: "https://www.fiaon.com" }, timeout: 120_000,
      });
      const TITEL = "Tour-Raum PRUEFSTAND";
      const raeume = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_raeume WHERE titel = ${TITEL}`) as any[])[0].n);
      const projekteJson = [
        { schluessel: "alpha", titel: "Projekt Alpha", beschreibung: "Erfunden.", buehne: BUEHNE_MUSTER },
        { schluessel: "beta", titel: "Projekt Beta", beschreibung: "Erfunden.", buehne: { claim: "Ein zweiter, erfundener Raum.", kennzahlen: [{ wert: "12", label: "Musterzahl" }] } },
        { schluessel: "gamma", titel: "Projekt Gamma", beschreibung: "Ohne Bühne." },
      ];
      fs.writeFileSync(path.join(tmp, "schlecht.json"), JSON.stringify({ titel: TITEL, projekte: [{ schluessel: "alpha", titel: "Projekt Alpha", buehne: { kicker: "ohne Satz" } }] }));
      const schlecht = lauf(["raum-anlegen", "--datei", path.join(tmp, "schlecht.json"), "--schreiben"]);
      ok("Ungültige Bühne in raum.json → Abbruch (Code 2) vor dem Schreiben", schlecht.status === 2 && /claim: fehlt/.test(schlecht.stderr) && (await raeume()) === 0, schlecht.stderr.trim().slice(0, 160));
      fs.writeFileSync(path.join(tmp, "raum.json"), JSON.stringify({ titel: TITEL, projekte: projekteJson }));
      const vorschau = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json")]);
      ok("Vorschau nennt die Bühnen und schreibt nichts", vorschau.status === 0 && /Bühne: Hauptprojekt · 3 Kennzahlen · Kurve \(2 Reihen\) · 2 Kapitel/.test(vorschau.stdout) && (await raeume()) === 0, vorschau.stdout.slice(-240));
      const an = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--schreiben"]);
      const [tr] = (await sqlPool`SELECT id FROM fiaon_dr_raeume WHERE titel = ${TITEL}`) as any[];
      const zeilen = tr ? (await sqlPool`SELECT id, buchstabe, buehne FROM fiaon_dr_projekte WHERE raum_id = ${tr.id} ORDER BY buchstabe`) as any[] : [];
      const bj = (z: any) => (z?.buehne == null ? null : typeof z.buehne === "string" ? JSON.parse(z.buehne) : z.buehne);
      ok("raum-anlegen speichert die Bühnen (A Hauptprojekt, B kurz, C ohne)", an.status === 0 && zeilen.length === 3 && bj(zeilen[0])?.hauptprojekt === true && bj(zeilen[1])?.claim === "Ein zweiter, erfundener Raum." && bj(zeilen[2]) === null, (an.stderr || an.stdout).slice(-200));
      const nochmal = lauf(["raum-anlegen", "--datei", path.join(tmp, "raum.json"), "--schreiben"]);
      ok("Zweiter Lauf gleicht ab — kein zweiter Raum, Bühnen bleiben", nochmal.status === 0 && (await raeume()) === 1 && /Bühne für A · Projekt Alpha gespeichert/.test(nochmal.stdout));
      const li = lauf(["liste", "--raum", String(tr?.id ?? 0)]);
      ok("liste nennt die Bühne je Projekt", li.status === 0 && /Bühne: Hauptprojekt/.test(li.stdout) && /Bühne: keine Bühne/.test(li.stdout));
      await L.drDokumentAblegen({ projektId: Number(zeilen[0].id), buffer: await probePdf("Tour A1"), dateiname: "TourA1.pdf", titel: "A1 Tour", nr: 1 }, WER);
      // Wie in jedem Raum (Nachbesserung): erst die Vereinbarung freigeben, dann einladen.
      const zuFrueh = await L.drGastEinladen(Number(tr.id), { vorname: "Zu", nachname: "Frueh", email: "tour.frueh@example.invalid" }, WER) as any;
      const frei = await L.drNdaFreigeben(Number(tr.id), WER) as any;
      const ein = await L.drGastEinladen(Number(tr.id), { anrede: "frau", vorname: "Erika", nachname: "Beispiel", email: "erika.beispiel@example.invalid" }, WER) as any;
      ok("Tour-Raum: einladen erst nach der Freigabe der Vereinbarung (vorher 409 FREIGABE), dann Code", !zuFrueh.ok && zuFrueh.code === "FREIGABE" && frei.ok && ein.ok && /^DR-/.test(ein.code ?? ""), `${zuFrueh.code ?? ""} · ${ein.error ?? ""}`);
      if (!ein.ok) throw new Error(`Einladung in den Tour-Raum fehlgeschlagen: ${ein.error}`);
      const ohne = new Sitzung("203.0.113.30");
      const o1 = await ohne.ruf("/datenraum/buehnen"); const o2 = await ohne.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "A" });
      ok("Ohne Sitzung: Bühnen 401, Anfrage 401", o1.status === 401 && o2.status === 401);
      const g = new Sitzung("203.0.113.31");
      const rein = await g.ruf("/datenraum/eintreten", { code: ein.code });
      const b0 = await g.ruf("/datenraum/buehnen");
      ok("Vor der Vereinbarung: Bühnen 403 (NDA), kein Satz der Bühne in Antwort oder Stand", rein.status === 200 && b0.status === 403 && b0.j?.code === "NDA" && !JSON.stringify(b0.j).includes("erfundenes Vorhaben") && !JSON.stringify(rein.j).includes("erfundenes Vorhaben"));
      const a0 = await g.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "A" });
      ok("Vor der Vereinbarung: Vertragsentwurf 403", a0.status === 403 && a0.j?.code === "NDA");
      const erika = { ...GAST, anrede: "frau" as const, vorname: "Erika", nachname: "Beispiel", email: "erika.beispiel@example.invalid" };
      const ang = await g.ruf("/datenraum/angaben", { angaben: erika });
      const un = await g.ruf("/datenraum/unterzeichnen", { textHash: ang.j?.nda?.hash, gelesen: true, name: "Erika Beispiel", png: dataUrl(pngBild(320, 100)) });
      ok("Angaben (mit Vereinbarung) und Unterschrift", ang.status === 200 && /^[0-9a-f]{64}$/.test(ang.j?.nda?.hash ?? "") && un.status === 200 && un.j?.schritt === "raum", `${ang.status} ${ang.j?.error ?? ang.j?.hinweis ?? ""} · ${un.status} ${un.j?.error ?? ""}`);
      const b1 = await g.ruf("/datenraum/buehnen");
      ok("Nach der Vereinbarung: Bühnen von A und B (C hat keine)", b1.status === 200 && Object.keys(b1.j?.buehnen ?? {}).sort().join() === "A,B" && b1.j.buehnen.A.hauptprojekt === true && b1.j.buehnen.A.kennzahlen.length === 3 && b1.j.buehnen.A.kurve.reihen.length === 2);
      ok("Antwort ohne Speicher (no-store), noindex", /no-store/.test(b1.kopf.get("cache-control") ?? "") && /noindex/.test(b1.kopf.get("x-robots-tag") ?? ""));
      await g.ruf("/datenraum/buehnen");
      ok("„Rundgang geöffnet“ steht einmal am Tag im Protokoll", (await anzahl("tour", ein.id)) === 1);
      const v1 = await g.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "a" });
      ok("Vertragsentwurf zu A → 200 mit Bestätigung für den Gast", v1.status === 200 && /Ihre Anforderung zu Projekt Alpha ist bei uns/.test(v1.j?.meldung ?? ""), v1.j?.meldung ?? v1.j?.error);
      const v2 = await g.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "A" });
      ok("Gleich noch einmal → „liegt bereits vor“, keine zweite Zeile", v2.status === 200 && v2.j?.schon === true && (await anzahl("vertrag_angefordert", ein.id)) === 1);
      await new Promise((r) => setTimeout(r, 500));
      const [m] = (await sqlPool`SELECT detail FROM fiaon_dr_protokoll WHERE gast_id = ${ein.id} AND art = 'mail_anfrage' ORDER BY id DESC LIMIT 1`) as any[];
      ok("Mailweg abgeklemmt (DATENRAUM_MAILS=aus) → nichts gesendet, im Protokoll vermerkt", /nicht gesendet: .*abgeschaltet/.test(m?.detail ?? ""), m?.detail);
      const unbekannt = await g.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "Z" });
      const kurz = await g.ruf("/datenraum/anfrage", { art: "frage", text: "Wie?" });
      ok("Unbekanntes Projekt → 404, zu kurze Frage → 400", unbekannt.status === 404 && kurz.status === 400);
      const f1 = await g.ruf("/datenraum/anfrage", { art: "frage", projekt: "B", text: "Wie sieht der erfundene Zeitplan aus?" });
      const [fz] = (await sqlPool`SELECT detail FROM fiaon_dr_protokoll WHERE gast_id = ${ein.id} AND art = 'frage_gestellt' ORDER BY id DESC LIMIT 1`) as any[];
      ok("Frage zu B → 200, Frage im Wortlaut im Protokoll", f1.status === 200 && /antwortet Ihnen persönlich/.test(f1.j?.meldung ?? "") && /^B · Projekt Beta · Wie sieht der erfundene Zeitplan aus\?/.test(fz?.detail ?? ""), fz?.detail);
      const post: any[] = [];
      const attrappe: any = async (x: any) => { post.push(x); return { ok: true, messageId: "pruef-tour" }; };
      const gz = await L.drSitzungGast({ gastId: ein.id, version: 1 });
      const r = await T.drAnfrage(gz!, { art: "vertrag", projekt: "B", text: "Bitte mit erfundener Anmerkung." }, { ip: "203.0.113.31", ua: BROWSER }, { sender: attrappe, mailsSofort: true });
      const mail = post[0];
      ok("Meldung an Justin: „<Name> möchte den Vertragsentwurf zu <Projekt>“, Antwort an den Gast, Anmerkung im Text",
        r.ok && mail?.an === "js@fiaon.com" && mail?.betreff === "Erika Beispiel möchte den Vertragsentwurf zu Projekt Beta" && mail?.antwortAn?.email === "erika.beispiel@example.invalid" && /Bitte mit erfundener Anmerkung/.test(mail?.text ?? "") && /Tour-Raum PRUEFSTAND/.test(mail?.text ?? ""), mail?.betreff);
      let letzte = 0;
      for (let i = 0; i < 6; i++) letzte = (await g.ruf("/datenraum/anfrage", { art: "frage", text: `Erfundene Frage Nummer ${i + 1}?` })).status;
      ok("Bremse: die neunte Anfrage in einer Stunde → 429 (und im Protokoll)", letzte === 429 && (await anzahl("anfrage_gebremst", ein.id)) === 1, String(letzte));
      // Ein Thema ändert sich nach der Unterschrift (neue §-1-Fassung von B, neu freigegeben): Die Bühne von B ist zu, bis
      // der Gast den Nachtrag unterschreibt — dieselbe Abdeckung wie bei den Dokumenten (Projekt-Nr. + Prüfsumme der Fassung).
      const aend = await L.drProjektSpeichern(Number(tr.id), { schluessel: "beta", titel: "Projekt Beta", beschreibung: "Erfunden.", ndaText: "ein erfundenes, umgewidmetes Vorhaben" }, WER) as any;
      await L.drNdaFreigeben(Number(tr.id), WER);
      const b2 = await g.ruf("/datenraum/buehnen");
      const vB = await g.ruf("/datenraum/anfrage", { art: "vertrag", projekt: "B" });
      ok("Geändertes Thema B (Nachtrag offen): keine Bühne von B mehr, Vertragsentwurf zu B → 403 NACHTRAG, A bleibt",
        aend.ok && b2.status === 200 && Object.keys(b2.j?.buehnen ?? {}).join() === "A" && vB.status === 403 && vB.j?.code === "NACHTRAG", `${Object.keys(b2.j?.buehnen ?? {}).join()} · ${vB.status} ${vB.j?.code ?? ""}`);
      const nB = await g.ruf("/datenraum/nda");
      const uB = await g.ruf("/datenraum/unterzeichnen", { textHash: nB.j?.nda?.hash, gelesen: true, name: "Erika Beispiel", png: dataUrl(pngBild(320, 100)) });
      const b3 = await g.ruf("/datenraum/buehnen");
      ok("Nachtrag unterschrieben → Bühne von B wieder da", uB.status === 200 && uB.j?.nachtrag === false && Object.keys(b3.j?.buehnen ?? {}).sort().join() === "A,B", `${uB.status} ${uB.j?.error ?? ""} · ${Object.keys(b3.j?.buehnen ?? {}).join()}`);
      const akte: any = await L.drRaumAkte(Number(tr.id));
      ok("Akte im Chefbüro zeigt die neuen Zeilen mit Klartext", akte.protokoll.some((p: any) => p.artText === "Vertragsentwurf angefordert") && akte.protokoll.some((p: any) => p.artText === "Rundgang geöffnet"));
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
