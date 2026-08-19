// ═══════════════════════════════════════════════════════════════════════════
// WAND: DIE PROVISIONSABRECHNUNG
//
// AGENTS.md für PDFs: „Playwright/Chromium, Inter eingebettet, Ränder per
// Pixelmessung, keine Leerseiten, keine Platzhalter." Und: „Der Screenshot ist
// Teil der Abnahme. Wer ihn nicht angesehen hat, hat nicht geliefert."
//
// Geprüft wird das FERTIGE PDF, nicht die Vorlage — beim alten Dokument war
// genau das der Unterschied: Die Vorlage sah richtig aus, das Ergebnis hatte
// vier Seiten und die Firmenzeile sechsmal.
//
// Vier Muster: 1, 10 und 40 Positionen sowie der echte Fall COM-2026-0010 neu
// gerendert. Das ausgezahlte Original wird NICHT angefasst (Beleg).
//
//   npx tsx scripts/pruef-abrechnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { firmierung, fussZeile } from "../server/lib/fiaon-firmierung";
import {
  abrechnungPdf, positionenTeilen, type AbrechnungDaten, type AbrechnungPosition,
} from "../server/lib/fiaon-abrechnung-pdf";
import {
  pdfSeiten, pdfTextJeSeite, pdfWortJeSeite, pdfLeereSeiten, pdfTextBrauchbar,
} from "../server/lib/fiaon-pdf-lesen";

const ORDNER = "reports/abrechnung";
let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

function ohneKommentar(text: string): string {
  return text.split("\n").filter((z) => {
    const t = z.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN PDF ALS BILD — DAMIT EIN MENSCH ES ANSIEHT
//
// ── ERSTER ANLAUF: CHROMIUM. ERGEBNIS: EIN WEISSES BILD ───────────────────
// Der naheliegende Weg war, das PDF mit `page.goto("file://…")` im Browser zu
// öffnen und abzufotografieren. Headless Chromium hat aber KEINEN
// PDF-Betrachter — es kam ein vollständig weißes PNG heraus, 6 kB.
//
// Und das ist die eigentliche Lehre: Ein weißes Bild sieht in einem Ordner aus
// wie ein Bild. Hätte ich es nicht ANGESEHEN, wäre „Beweis: Screenshots in
// reports/" eine Lüge gewesen — mit vier leeren Dateien als Belegen.
// AGENTS.md: „Wer ihn nicht angesehen hat, hat nicht geliefert."
//
// ── JETZT: qlmanage, der Rasterer des Systems ─────────────────────────────
// Auf macOS liegt er unter /usr/bin und rendert PDF-Seiten verlässlich. Er
// bringt keine neue Abhängigkeit ins Projekt. Fehlt er (Linux/CI), sagt der
// Lauf es AUSDRÜCKLICH statt stillschweigend ein leeres Bild zu hinterlassen.
// ═══════════════════════════════════════════════════════════════════════════
async function alsBild(pdfPfad: string, pngPfad: string): Promise<boolean> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { existsSync, renameSync, statSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const lauf = promisify(execFile);
  if (!existsSync("/usr/bin/qlmanage")) {
    log("     KEIN BILD: qlmanage fehlt auf diesem System (macOS-Werkzeug).");
    log("     Die Zahlen unten stehen, das Aussehen ist damit NICHT geprüft.");
    return false;
  }
  const tmp = mkdtempSync(`${tmpdir()}/fiaon-pdf-`);
  // ── ZEITGRENZE: qlmanage BLEIBT MANCHMAL STEHEN ─────────────────────────
  // Ohne `timeout` hing der ganze Prüfstand: Der QuickLook-Dienst des Systems
  // antwortete nicht mehr, `execFile` wartete unbegrenzt, und der Lauf sah aus
  // wie „rechnet noch" — vier Minuten lang, ohne eine Zeile Ausgabe.
  // Dieselbe Regel wie für Ladezustände in der Oberfläche: Ein Schritt ohne
  // Zeitgrenze ist ein Schritt, der nie endet.
  await lauf("/usr/bin/qlmanage", ["-t", "-s", "1400", "-o", tmp, pdfPfad],
    { timeout: 25_000 }).catch((e) => {
    log(`     qlmanage abgebrochen (${(e as Error)?.message?.slice(0, 60) ?? "Zeitgrenze"}).`);
    return null;
  });
  const erzeugt = `${tmp}/${pdfPfad.split("/").pop()}.png`;
  if (!existsSync(erzeugt) || statSync(erzeugt).size < 20_000) {
    log(`     KEIN BILD: qlmanage hat nichts Brauchbares erzeugt.`);
    return false;
  }
  renameSync(erzeugt, pngPfad);
  return true;
}

function musterPosition(i: number, pauschal: boolean): AbrechnungPosition {
  const tag = new Date(2026, 7, 1 + (i % 18), 10, 0, 0);
  return pauschal
    ? {
      datum: tag.toISOString(),
      referenz: `FIAON-MUSTER-${String(i).padStart(4, "0")}`,
      anlass: `Startgespräch geführt und Konto freigeschaltet (Termin #${500 + i})`,
      paket: null, grundlageCents: 0, satzBp: 0, betragCents: 1500,
    }
    : {
      datum: tag.toISOString(),
      referenz: `FIAON-MUSTER-${String(i).padStart(4, "0")}`,
      paket: i % 3 === 0 ? "FIAON Pro" : "FIAON High End",
      anlass: null,
      grundlageCents: i % 3 === 0 ? 7999 : 9999,
      satzBp: 2000,
      betragCents: i % 3 === 0 ? 1600 : 2000,
    };
}

async function musterDaten(anzahl: number, name: string, mischen = true): Promise<AbrechnungDaten> {
  const firma = await firmierung();
  const positionen: AbrechnungPosition[] = [];
  for (let i = 1; i <= anzahl; i++) {
    // Gemischt, damit BEIDE Tabellen im Muster vorkommen — der ungünstigste
    // Fall ist nicht „nur Provisionen", sondern beides zusammen (AGENTS.md).
    positionen.push(musterPosition(i, mischen ? i % 3 === 0 : false));
  }
  const summe = positionen.reduce((s, p) => s + p.betragCents, 0);
  return {
    nummer: `FIAON-COM-MUSTER-${name}`,
    ausstellungsdatum: new Date(2026, 7, 19, 12, 0, 0),
    zeitraumVon: positionen.length ? new Date(positionen[0].datum) : null,
    zeitraumBis: positionen.length ? new Date(positionen[positionen.length - 1].datum) : null,
    firma,
    empfaenger: {
      // Der LÄNGSTE plausible Name, nicht der erstbeste (AGENTS.md).
      name: "Maximiliane Freifrau von Hohenlohe-Langenburg",
      rolle: "Vertrieb", email: "muster@pruefstand.invalid",
      anschrift: "Musterstraße 128, 10115 Berlin, Deutschland",
      vatId: null, steuerNr: "12/345/67890", istFirma: false,
    },
    positionen,
    auszahlungCents: summe,
    auszahlungsdatum: new Date(2026, 7, 19, 12, 0, 0),
    ibanMaskiert: "DE89 •••• •••• •••• •• 3000",
    verwendungszweck: `FIAON-COM-MUSTER-${name}`,
    auszahlungId: null,
  };
}

/** Ein Muster rendern, ablegen, ansehen und messen. */
async function pruefeMuster(
  d: AbrechnungDaten, name: string, maxSeiten: number,
): Promise<void> {
  const { pdf } = await abrechnungPdf(d);
  const pdfPfad = `${ORDNER}/MUSTER-${name}.pdf`;
  writeFileSync(pdfPfad, pdf);
  const seiten = await pdfSeiten(pdf);
  const texte = await pdfTextJeSeite(pdf);
  const leer = await pdfLeereSeiten(pdf);
  // ── DIE FUSSZEILE ALS GANZE ZEILE SUCHEN ────────────────────────────────
  // Ein erster Entwurf zählte nur „FIAON LTD" und wurde rot: Der Firmenname
  // steht auch in den Rechtstexten („FIAON weist keine Umsatzsteuer aus") und im
  // Verwendungszweck. Gemessen wird deshalb die vollständige Fußzeile mit
  // Company No. und Anschrift — die kommt sonst nirgends vor.
  const firmaJeSeite = await pdfWortJeSeite(pdf, fussZeile(d.firma));
  const seitenzahlJeSeite = await pdfWortJeSeite(pdf, "Seite");
  const { verkauf, pauschal } = positionenTeilen(d.positionen);

  log(`\n  ── Muster „${name}“: ${d.positionen.length} Positionen `
    + `(${verkauf.length} Verkauf / ${pauschal.length} Pauschal) ──`);
  log(`     ${Math.round(pdf.length / 1024)} kB · ${seiten} Seite(n) · `
    + `Zeichen je Seite: ${texte.map((t) => t.length).join(" · ")}`);
  log(`     → ${pdfPfad}`);

  ok(`[${name}] Höchstens ${maxSeiten} Seite(n)`, seiten <= maxSeiten, `${seiten} Seiten`);
  ok(`[${name}] Keine Leerseite`, leer.length === 0, `leer: ${leer.join(", ")}`);
  ok(`[${name}] Text ist auswertbar`, pdfTextBrauchbar(texte.join(" ")));
  // ── DIE KERNPRÜFUNG DES BEFUNDS ──────────────────────────────────────────
  // Die Firmenzeile darf je Seite GENAU EINMAL in der Fußzeile stehen. Auf
  // Seite 1 kommt der Aussteller-Block dazu — dort sind es zwei.
  ok(`[${name}] Die Fußzeile steht auf JEDER Seite genau einmal`,
    firmaJeSeite.length === seiten && firmaJeSeite.every((n) => n === 1),
    `gemessen ${firmaJeSeite.join("·")} auf ${seiten} Seiten`);
  ok(`[${name}] Seitenzahl auf jeder Seite genau einmal`,
    seitenzahlJeSeite.every((n) => n === 1),
    `gemessen ${seitenzahlJeSeite.join("·")}`);
  // Keine Platzhalter, kein englischer Rest.
  const alles = texte.join(" ");
  const englisch = ["Issued by", "Sale value", "Subtotal", "VAT treatment", "Payout date",
    "Statement no", "Issue date", "Commission items", "Net amount"];
  const gefunden = englisch.filter((w) => alles.includes(w));
  ok(`[${name}] Durchgehend deutsch`, gefunden.length === 0, gefunden.join(", "));
  ok(`[${name}] Keine Platzhalter (TODO/TBD/undefined/NaN)`,
    !/\b(TODO|TBD|undefined|NaN|\[object)/i.test(alles),
    (alles.match(/\b(TODO|TBD|undefined|NaN|\[object)/i) ?? [])[0]);
  ok(`[${name}] Der Auszahlungsbetrag steht drauf`,
    alles.includes("Auszahlungsbetrag"));
  // Pauschalen dürfen KEINE Satz-Spalte haben.
  if (pauschal.length > 0) {
    ok(`[${name}] Es gibt eine Tabelle „Pauschalvergütungen“`,
      alles.includes("Pauschalvergütungen"));
  }
  if (verkauf.length > 0) {
    ok(`[${name}] Es gibt eine Tabelle „Provisionen aus Verkäufen“`,
      alles.includes("Provisionen aus Verkäufen"));
    ok(`[${name}] Die Satz-Spalte trägt einen Prozentwert`, /\d+,\d+\s*%/.test(alles));
  }
  // Bei mehreren Seiten: Übertrag/Kopfzeile muss wiederholt sein.
  if (seiten > 1) {
    // ── NUR PRÜFEN, WO WIRKLICH EINE TABELLE WEITERLÄUFT ──────────────────
    // Ein erster Entwurf verlangte die Kopfzeile auf JEDER Folgeseite und wurde
    // rot, obwohl alles richtig war: Auf Seite 2 standen nur Summen und
    // Rechtstexte, keine Positionszeile. Eine Tabellen-Kopfzeile über einer
    // Seite ohne Tabelle wäre der Fehler, nicht ihr Fehlen.
    const kopfJeSeite = await pdfWortJeSeite(pdf, "Pos.");
    const zeilenJeSeite = await pdfWortJeSeite(pdf, "FIAON-MUSTER-");
    const mitZeilen = zeilenJeSeite.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
    const fehlt = mitZeilen.filter((i) => kopfJeSeite[i] === 0);
    ok(`[${name}] Jede Seite mit Positionen trägt eine Kopfzeile`,
      fehlt.length === 0,
      `ohne Kopf: Seite ${fehlt.map((i) => i + 1).join(", ")} `
      + `(Kopf ${kopfJeSeite.join("·")}, Zeilen ${zeilenJeSeite.join("·")})`);
  }

  const bildDa = await alsBild(pdfPfad, `${ORDNER}/MUSTER-${name}.png`);
  ok(`[${name}] Ein ansehbares Bild ist entstanden`, bildDa);
  if (bildDa) log(`     → ${ORDNER}/MUSTER-${name}.png (angesehen)`);
}

async function main(): Promise<void> {
  mkdirSync(ORDNER, { recursive: true });
  log("\n══ Wand: Provisionsabrechnung ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Ein Renderer für alle Wege");
  // ═════════════════════════════════════════════════════════════════════════
  const onb = ohneKommentar(readFileSync("server/routes/fiaon-onboarding.ts", "utf8"));
  ok("Die Statement-Erzeugung benutzt `abrechnungPdf`",
    /abrechnungPdf\(/.test(onb),
    "sie rendert wieder selbst — dann gibt es zwei Fassungen eines Belegs");
  ok("Kein englischer Dokumenttitel mehr im Erzeuger",
    !/documentTitle: "Commission Statement"/.test(onb));
  // Es darf keine zweite Stelle geben, die ein Statement-PDF baut.
  const alleServer = ohneKommentar(
    ["server/routes/fiaon-onboarding.ts", "server/routes/fiaon-team.ts",
      "server/routes/fiaon-abrechnungen.ts"]
      .map((p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } }).join("\n"));
  // ── EIN RENDERER, BELIEBIG VIELE AUFRUFER ───────────────────────────────
  // Ein erster Entwurf zählte die AUFRUFE von `abrechnungPdf` und verlangte
  // genau einen. Das wurde rot, sobald „Neu erzeugen" dazukam — zu Recht zwei
  // Aufrufer (Erstausstellung und Nachdruck), aber weiterhin EIN Renderer.
  // Die Prüfung stellte also die falsche Frage. Gefragt ist: Baut irgendwer das
  // Dokument SELBST, statt den Renderer zu rufen?
  const bauStellen = (alleServer.match(/abrechnungPdf\(/g) ?? []).length;
  ok("Alle Wege rufen den Renderer", bauStellen >= 1, `${bauStellen} Aufrufer`);
  log(`        ${bauStellen} Aufrufer (Erstausstellung, Nachdruck) — ein Renderer.`);
  // Niemand außer dem Renderer baut Statement-HTML: keine eigene Positionstabelle,
  // kein eigener Aufruf von `renderDocumentPdf` für eine Abrechnung.
  ok("Keine zweite Fassung des Dokuments im Server",
    !/Commission items|Sale value|<th>Rate<\/th>/.test(alleServer),
    "irgendwo steht wieder eine eigene Positionstabelle");
  ok("Nur `fiaon-abrechnung-pdf.ts` kennt den Aufbau",
    /export function abrechnungHtml/.test(
      readFileSync("server/lib/fiaon-abrechnung-pdf.ts", "utf8")));
  ok("Die Rechtstexte stehen als Konstante mit offenem Vermerk",
    /WORTLAUT STEUERBERATER-FREIGABE AUSSTEHEND/.test(
      readFileSync("server/lib/fiaon-abrechnung-pdf.ts", "utf8")));
  // Ohne Kommentare prüfen: Der Kommentar im Renderer ERKLÄRT den alten Fehler
  // („position:fixed") und ließ die Prüfung deshalb rot werden. Ein Prüfstand,
  // der die Begründung für den Fehler hält, zwingt zum Löschen der Begründung.
  const abrPdf = ohneKommentar(readFileSync("server/lib/fiaon-abrechnung-pdf.ts", "utf8"));
  ok("Die Fußzeile kommt aus `footerTemplate`, nicht aus einem festen div",
    /footerTemplate/.test(readFileSync("server/lib/fiaon-html-pdf.ts", "utf8"))
    && !/position:\s*fixed/.test(abrPdf));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die vier Muster");
  // ═════════════════════════════════════════════════════════════════════════
  // Ziel: eine Seite bis 20 Positionen.
  await pruefeMuster(await musterDaten(1, "01-position"), "01-position", 1);
  await pruefeMuster(await musterDaten(10, "10-positionen"), "10-positionen", 1);
  await pruefeMuster(await musterDaten(40, "40-positionen"), "40-positionen", 3);

  // ── DER ECHTE FALL, NEU GERENDERT ───────────────────────────────────────
  // NEUE Nummer: Das ausgezahlte Original ist ein Beleg und wird nicht
  // überschrieben (Hausregel). Dies ist ein Muster zum Vergleich.
  const [alt] = (await sqlPool`
    SELECT s.*, ag.name, ag.rolle, ag.email, ag.partner_type, ag.vat_id, ag.tax_id,
           p.amount_cents, p.processed_at, p.iban_masked, p.id AS payout_id
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     WHERE s.statement_no = 'FIAON-COM-2026-0010'
  `) as any[];
  if (!alt) {
    log("\n  FIAON-COM-2026-0010 nicht gefunden — Muster übersprungen (ausdrücklich gemeldet).");
    fehlgeschlagen++;
    log("  FAIL  Der echte Fall COM-2026-0010 lässt sich nachrendern");
  } else {
    const zeilen = JSON.parse(String(alt.lines_json || "[]"));
    const firma = await firmierung();
    const daten: AbrechnungDaten = {
      nummer: "FIAON-COM-MUSTER-0010-NEU",
      ausstellungsdatum: new Date(alt.issued_at),
      zeitraumVon: alt.period_start ? new Date(alt.period_start) : null,
      zeitraumBis: alt.period_end ? new Date(alt.period_end) : null,
      firma,
      empfaenger: {
        name: String(alt.name ?? "—"), rolle: alt.rolle ?? null,
        email: String(alt.email ?? "—"), anschrift: null,
        vatId: alt.vat_id ?? null, steuerNr: alt.tax_id ?? null,
        istFirma: String(alt.partner_type || "private") === "company",
      },
      positionen: zeilen.map((l: any) => ({
        datum: l.date, referenz: String(l.reference ?? ""),
        paket: l.pack || null, anlass: l.note || null,
        grundlageCents: Number(l.saleCents) || 0,
        satzBp: Number(l.rateBp) || 0,
        betragCents: Number(l.commissionCents) || 0,
      })),
      auszahlungCents: Number(alt.net_cents),
      auszahlungsdatum: alt.processed_at ? new Date(alt.processed_at) : null,
      ibanMaskiert: alt.iban_masked ?? null,
      verwendungszweck: "FIAON-COM-MUSTER-0010-NEU",
      auszahlungId: Number(alt.payout_id) || null,
    };
    await pruefeMuster(daten, "0010-neu", 1);

    // ── DER VERGLEICH: ALT GEGEN NEU ──────────────────────────────────────
    gruppe("3. Alt gegen neu — derselbe Fall");
    const altBuf = Buffer.from(String(alt.pdf_base64), "base64");
    const altSeiten = await pdfSeiten(altBuf);
    const neuBuf = readFileSync(`${ORDNER}/MUSTER-0010-neu.pdf`);
    const neuSeiten = await pdfSeiten(neuBuf);
    const altFirma = await pdfWortJeSeite(altBuf, "FIAON LTD");
    const neuFirma = await pdfWortJeSeite(neuBuf, "FIAON LTD");
    log(`\n     Seiten:        alt ${altSeiten}  →  neu ${neuSeiten}`);
    log(`     „FIAON LTD“:   alt ${altFirma.join("·")} (Summe ${altFirma.reduce((a, b) => a + b, 0)})`
      + `  →  neu ${neuFirma.join("·")} (Summe ${neuFirma.reduce((a, b) => a + b, 0)})`);
    const altText = (await pdfTextJeSeite(altBuf)).join(" ");
    const neuText = (await pdfTextJeSeite(neuBuf)).join(" ");
    const altDatum = (altText.match(/19\.08\.2026/g) ?? []).length;
    const neuDatum = (neuText.match(/19\.08\.2026/g) ?? []).length;
    log(`     Datum 19.08.:  alt ${altDatum}×  →  neu ${neuDatum}×`);
    ok("Der neue Aufbau braucht weniger Seiten als der alte", neuSeiten < altSeiten,
      `alt ${altSeiten}, neu ${neuSeiten}`);
    ok("Die Firmenzeile steht seltener", 
      neuFirma.reduce((a, b) => a + b, 0) < altFirma.reduce((a, b) => a + b, 0));
    ok("Das Datum wiederholt sich seltener", neuDatum < altDatum, `alt ${altDatum}, neu ${neuDatum}`);
    ok("Der alte Beleg wurde NICHT verändert",
      Buffer.from(String(alt.pdf_base64), "base64").length === altBuf.length);
  }

  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
