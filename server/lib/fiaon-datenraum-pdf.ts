// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — DIE VEREINBARUNG ALS PDF UND DER VERMERK AUF JEDER SEITE (E-489, 09.11.2026)
//
// 1. ndaPdfErzeugen: setzt die Blöcke aus shared/fiaon-datenraum-nda.ts mit
//    pdf-lib (ohne Browser — Muster fiaon-global-pdf-satz.ts): A4, Kopf mit
//    Wortmarke, Serife für Überschriften, Blocksatz, auf der letzten Seite die
//    elektronische Unterschrift (gezeichnetes Bild + getippter Name), der
//    Annahmevermerk der FIAON-Seite und der Nachweis (Fassung, Prüfsumme des
//    Wortlauts, Zeitpunkt, IP, Browser). Fuß auf jeder Seite: Fassung,
//    Kurz-Prüfsumme, „Seite x von y“. Liegt ein Siegel-Schlüssel vor, bekommt die
//    Datei das PAdES-Siegel der FIAON LTD (fiaon-global-siegel.ts) — sonst bleibt
//    die Prüfsumme der Datei der Nachweis.
// 2. drPdfVermerken: „Vertraulich · <Name> · <Datum>“ dezent am unteren Rand
//    jeder Seite, beim Ausliefern — gedreht, wo die Seite gedreht ist.
//    Verschlüsselte PDFs lassen sich nicht verändern: Die Verwaltung sieht das
//    schon beim Hochladen („ohne Vermerk“).
// ═══════════════════════════════════════════════════════════════════════════
import { PDFDocument, StandardFonts, degrees, rgb, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { MARKE_BOX, MARKE_PFAD } from "@shared/fiaon-marke";
import { NDA_FIAON, NDA_TITEL, drFesteLeerzeichen, drFettStuecke, type DrNdaBlock } from "@shared/fiaon-datenraum-nda";
import { metadaten, sicher } from "./fiaon-global-pdf-satz";
import { drBerlinZeitLang } from "./fiaon-datenraum-regeln";

const SEITE_B = 595.28;
const SEITE_H = 841.89;
const RL = 62;
const RR = 62;
const OBEN = 62;
const UNTEN = 72;
const B = SEITE_B - RL - RR;
const NAVY = rgb(0.071, 0.157, 0.29);
const TINTE = rgb(0.047, 0.102, 0.18);
const TEXT = rgb(0.184, 0.227, 0.298);
const LEISE = rgb(0.42, 0.459, 0.529);
const LINIE = rgb(0.84, 0.866, 0.902);
const GLAS = rgb(0.937, 0.957, 0.992);

export interface NdaPdfEingabe {
  bloecke: DrNdaBlock[];
  fassung: string;
  textHash: string;
  /** „Muster-Seite“ */
  seite: string;
  raumTitel: string;
  partei3: { name: string; rolle?: string; getippt: string; unterschriftPng: Buffer };
  unterzeichnetAm: Date;
  freigeschaltetAm: Date;
  ip: string;
  userAgent: string;
}

/** Ein Wort aus Teilen mit eigener Schrift — „**FIAON-Seite**,“ ist EIN Wort (fett + Komma ohne Leerraum davor). */
interface Wort { teile: { text: string; fett: boolean }[] }
interface Schriften { n: PDFFont; f: PDFFont; s: PDFFont; si: PDFFont }

/** Die Vereinbarung mit Unterschrift, Annahmevermerk und Nachweis. */
export async function ndaPdfErzeugen(e: NdaPdfEingabe): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sch: Schriften = {
    n: await pdf.embedFont(StandardFonts.Helvetica),
    f: await pdf.embedFont(StandardFonts.HelveticaBold),
    s: await pdf.embedFont(StandardFonts.TimesRoman),
    si: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };
  let seite: PDFPage = pdf.addPage([SEITE_B, SEITE_H]);
  let y = SEITE_H - OBEN;
  const kopfErste = () => {
    const h = 15; const m = MARKE_BOX.fiaon; const s = h / m.h;
    seite.drawSvgPath(MARKE_PFAD.fiaon, { x: RL - m.x * s, y: y - h + 14 * s, scale: s, color: NAVY });
    gesperrt(seite, "VERTRAULICH", SEITE_B - RR - sperrBreite("VERTRAULICH", sch.n, 7.2, 1.4), y - 11, 7.2, sch.n, LEISE, 1.4);
    y -= 24;
    seite.drawLine({ start: { x: RL, y }, end: { x: SEITE_B - RR, y }, thickness: 0.6, color: LINIE });
    y -= 20;
  };
  const neueSeite = () => {
    seite = pdf.addPage([SEITE_B, SEITE_H]);
    y = SEITE_H - OBEN;
    seite.drawText(sicher(sch.n, NDA_TITEL), { x: RL, y: y - 8, size: 7.2, font: sch.n, color: LEISE });
    gesperrt(seite, "VERTRAULICH", SEITE_B - RR - sperrBreite("VERTRAULICH", sch.n, 7.2, 1.4), y - 8, 7.2, sch.n, LEISE, 1.4);
    y -= 16;
    seite.drawLine({ start: { x: RL, y }, end: { x: SEITE_B - RR, y }, thickness: 0.4, color: LINIE });
    y -= 18;
  };
  const platz = (h: number) => { if (y - h < UNTEN) neueSeite(); };
  kopfErste();

  // ── Zeilen setzen ──
  type Opt = { x?: number; breite?: number; g?: number; zl?: number; farbe?: RGB; font?: PDFFont; fettFont?: PDFFont; block?: boolean };
  const woerter = (text: string): Wort[] => {
    const out: Wort[] = []; let offen: Wort | null = null;
    for (const st of drFettStuecke(drFesteLeerzeichen(text))) {
      // Getrennt wird nur an normalem Leerraum — das geschützte Leerzeichen (U+00A0) hält „§ 4“ zusammen.
      const teile = st.text.split(/([ \t\n]+)/);
      for (const t of teile) {
        if (!t) continue;
        if (/^[ \t\n]+$/.test(t)) { offen = null; continue; }
        if (offen) offen.teile.push({ text: t, fett: st.fett });
        else { offen = { teile: [{ text: t, fett: st.fett }] }; out.push(offen); }
      }
    }
    return out;
  };
  const umbruch = (text: string, o: Opt) => {
    const g = o.g ?? 9.2; const bw = o.breite ?? B;
    const fontVon = (fett: boolean) => (fett ? (o.fettFont ?? sch.f) : (o.font ?? sch.n));
    const tb = (t: { text: string; fett: boolean }) => fontVon(t.fett).widthOfTextAtSize(sicher(fontVon(t.fett), t.text), g);
    const wb = (w: Wort) => w.teile.reduce((s2, t) => s2 + tb(t), 0);
    const leer = (o.font ?? sch.n).widthOfTextAtSize(" ", g);
    // Ein Wort, das breiter ist als die Zeile (Prüfsumme, lange Adresse), wird hart getrennt — nie über den Rand.
    const ws = woerter(text).flatMap((w) => {
      if (wb(w) <= bw) return [w];
      const teile: Wort[] = []; let akt = ""; const fett = w.teile[0]?.fett ?? false;
      for (const c of Array.from(w.teile.map((t) => t.text).join(""))) {
        if (fontVon(fett).widthOfTextAtSize(sicher(fontVon(fett), akt + c), g) > bw && akt) { teile.push({ teile: [{ text: akt, fett }] }); akt = c; } else akt += c;
      }
      if (akt) teile.push({ teile: [{ text: akt, fett }] });
      return teile;
    });
    const zeilen: Wort[][] = []; let akt: Wort[] = []; let breite = 0;
    for (const w of ws) {
      const b = wb(w);
      if (akt.length && breite + leer + b > bw) { zeilen.push(akt); akt = []; breite = 0; }
      breite += (akt.length ? leer : 0) + b; akt.push(w);
    }
    if (akt.length) zeilen.push(akt);
    return { zeilen, g, zl: o.zl ?? g * 1.45, bw, fontVon, tb, wb, leer };
  };
  const hoehe = (text: string, o: Opt = {}) => { const u = umbruch(text, o); return u.zeilen.length * u.zl; };
  const absatz = (text: string, o: Opt = {}) => {
    const { zeilen, g, zl, bw, fontVon, tb, wb, leer } = umbruch(text, o);
    const x0 = o.x ?? RL;
    zeilen.forEach((z, i) => {
      platz(zl);
      const summe = z.reduce((s2, w) => s2 + wb(w), 0);
      const letzte = i === zeilen.length - 1;
      // Blocksatz, ausser eine Zeile würde zu weit auseinandergezogen (kurze Zeile vor einem langen Wort) — dann linksbündig.
      const voll = z.length > 1 && !letzte && o.block !== false ? (bw - summe) / (z.length - 1) : leer;
      const luecke = voll > leer * 3.2 ? leer : voll;
      let x = x0;
      for (const w of z) {
        for (const t of w.teile) { seite.drawText(sicher(fontVon(t.fett), t.text), { x, y: y - g, size: g, font: fontVon(t.fett), color: o.farbe ?? TEXT }); x += tb(t); }
        x += luecke;
      }
      y -= zl;
    });
  };
  const sperr = (text: string, x: number, g: number, farbe: RGB, font: PDFFont = sch.n) => {
    gesperrt(seite, sicher(font, text.toUpperCase()), x, y - g, g, font, farbe, 1.2);
  };

  // ── Blöcke ──
  const bl = e.bloecke;
  let linie: { seite: PDFPage | null; y: number } = { seite: null, y: 0 };
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    switch (b.art) {
      case "auge": platz(14); sperr(b.text, RL, 7.6, NAVY, sch.f); y -= 16; break;
      case "titel": {
        const g = 23; platz(g * 1.25 * 2);
        for (const z of umbrechenEinfach(b.text, sch.s, g, B)) { seite.drawText(sicher(sch.s, z), { x: RL, y: y - g, size: g, font: sch.s, color: TINTE }); y -= g * 1.2; }
        y -= 4; break;
      }
      case "unter": absatz(b.text, { g: 8.6, farbe: LEISE, block: false }); y -= 6; break;
      case "zwischen": platz(30); y -= 8; sperr(b.text, RL, 7.2, LEISE); y -= 14; break;
      case "partei": {
        const lb = 62; const tb = B - lb;
        const h = 8 + 14 + hoehe(b.text, { g: 8.6, breite: tb }) + 8;
        platz(h);
        seite.drawLine({ start: { x: RL, y }, end: { x: SEITE_B - RR, y }, thickness: 0.5, color: LINIE });
        y -= 8;
        sperr(b.nr, RL, 6.8, LEISE);
        seite.drawText(sicher(sch.s, b.name), { x: RL + lb, y: y - 11.5, size: 11.5, font: sch.s, color: TINTE });
        y -= 15;
        absatz(b.text, { x: RL + lb, breite: tb, g: 8.6, block: false });
        y -= 6;
        if (bl[i + 1]?.art !== "partei") { seite.drawLine({ start: { x: RL, y }, end: { x: SEITE_B - RR, y }, thickness: 0.5, color: LINIE }); y -= 8; }
        break;
      }
      case "text": absatz(b.text, { g: 9 }); y -= 4; break;
      case "paragraf": {
        const n = bl[i + 1];
        const folge = n && (n.art === "abs" || n.art === "punkt") ? Math.min(hoehe(n.text, { x: RL + 22, breite: B - 22 }), 3 * 13.4) : 0;
        platz(30 + folge);
        y -= 10;
        const g = 12.4;
        seite.drawText(sicher(sch.s, b.nr), { x: RL, y: y - g, size: g, font: sch.s, color: LEISE });
        const nb = sch.s.widthOfTextAtSize(sicher(sch.s, b.nr), g) + 7;
        seite.drawText(sicher(sch.s, b.titel), { x: RL + nb, y: y - g, size: g, font: sch.s, color: TINTE });
        y -= g + 6; break;
      }
      case "abs": {
        platz(13.4);
        seite.drawText(sicher(sch.n, b.z), { x: RL, y: y - 9.2, size: 9.2, font: sch.n, color: LEISE });
        absatz(b.text, { x: RL + 22, breite: B - 22 });
        y -= 3; break;
      }
      case "punkt": {
        platz(13.4);
        seite.drawText(sicher(sch.n, b.z), { x: RL + 22, y: y - 9.2, size: 9.2, font: sch.n, color: LEISE });
        absatz(b.text, { x: RL + 40, breite: B - 40 });
        y -= 1.5;
        if (bl[i + 1]?.art !== "punkt") y -= 2;
        break;
      }
      case "thema": {
        // Die Themen stehen wie in der Papierfassung an EINER Navy-Linie; sie wird je Seite gezogen.
        const x = RL + 22; const tbr = B - 22 - 30;
        const text = `**${b.titel}** – ${b.text}`;
        platz(Math.min(hoehe(text, { breite: tbr }) + 4, 4 * 13.4));
        if (bl[i - 1]?.art !== "thema" || linie.seite !== seite) linie = { seite, y: y + 1 };
        seite.drawText(sicher(sch.s, b.bu), { x: x + 11, y: y - 12, size: 12.5, font: sch.s, color: NAVY });
        absatz(text, { x: x + 30, breite: tbr });
        y -= 3;
        if (bl[i + 1]?.art !== "thema" || linie.seite !== seite) {
          if (linie.seite === seite) seite.drawLine({ start: { x, y: linie.y }, end: { x, y: y + 4 }, thickness: 1.4, color: NAVY });
        }
        break;
      }
    }
  }

  // ── Unterschriften ──
  const img = await pdf.embedPng(e.partei3.unterschriftPng);
  const spalte = (B - 26) / 2;
  const zeitU = drBerlinZeitLang(e.unterzeichnetAm);
  const zeitF = drBerlinZeitLang(e.freigeschaltetAm);
  const annahme = `Angenommen durch ${NDA_FIAON.partei1Name} und Justin Schwarzott mit der Freischaltung des Datenraums am ${zeitF} (§ 8 Abs. 1).`;
  const blockH = 22 + 12 + 64 + 8 + 16 + 3 * 11 + 10;
  platz(blockH + 24);
  y -= 14;
  seite.drawText(sicher(sch.s, "Unterschriften"), { x: RL, y: y - 13, size: 13, font: sch.s, color: TINTE });
  y -= 24;
  const oben = y;
  // Partei 3 (links)
  sperr(`Partei 3 · ${e.seite}`, RL, 6.8, NAVY, sch.f);
  const feldH = 64; const feldUnten = oben - 14 - feldH;
  const skal = Math.min((spalte - 8) / img.width, (feldH - 4) / img.height, 1);
  const iw = img.width * skal; const ih = img.height * skal;
  seite.drawImage(img, { x: RL + 4, y: feldUnten + 3, width: iw, height: ih });
  seite.drawLine({ start: { x: RL, y: feldUnten }, end: { x: RL + spalte, y: feldUnten }, thickness: 0.8, color: TINTE });
  y = feldUnten - 4;
  seite.drawText(sicher(sch.s, e.partei3.name), { x: RL, y: y - 11.5, size: 11.5, font: sch.s, color: TINTE });
  y -= 16;
  if (e.partei3.rolle) absatz(e.partei3.rolle, { x: RL, breite: spalte, g: 7.8, farbe: TEXT, block: false });
  absatz(`Elektronisch unterzeichnet am ${zeitU}. Name getippt: „${e.partei3.getippt}“.`, { x: RL, breite: spalte, g: 7.8, farbe: LEISE, block: false });
  const linksUnten = y;
  // FIAON-Seite (rechts)
  y = oben;
  const xr = RL + spalte + 26;
  sperr("Partei 1 und 2 · FIAON-Seite", xr, 6.8, NAVY, sch.f);
  const boxH = feldH - 6;
  seite.drawRectangle({ x: xr, y: feldUnten + 2, width: spalte, height: boxH, color: GLAS, borderColor: LINIE, borderWidth: 0.5 });
  y = feldUnten + 2 + boxH - 7;
  absatz(annahme, { x: xr + 9, breite: spalte - 18, g: 8.2, farbe: TEXT, block: false });
  seite.drawLine({ start: { x: xr, y: feldUnten }, end: { x: xr + spalte, y: feldUnten }, thickness: 0.8, color: TINTE });
  y = feldUnten - 4;
  seite.drawText(sicher(sch.s, "Justin Schwarzott"), { x: xr, y: y - 11.5, size: 11.5, font: sch.s, color: TINTE });
  y -= 16;
  absatz("Director, für die FIAON LTD, und persönlich", { x: xr, breite: spalte, g: 7.8, farbe: LEISE, block: false });
  y = Math.min(y, linksUnten) - 14;

  // ── Nachweis ──
  const zeilen: [string, string][] = [
    ["Vereinbarung", `${NDA_TITEL} · Fassung ${e.fassung}`],
    ["Prüfsumme des Wortlauts", `SHA-256 ${e.textHash}`],
    ["Unterzeichnet", `${zeitU} (${e.unterzeichnetAm.toISOString()})`],
    ["Unterschrift", `von Hand gezeichnet (Bild oben) und Name getippt: „${e.partei3.getippt}“ — einfache elektronische Signatur`],
    ["IP-Adresse", e.ip || "unbekannt"],
    ["Browser", (e.userAgent || "unbekannt").slice(0, 220)],
    ["Annahme FIAON-Seite", `mit der Freischaltung des Datenraums am ${zeitF}`],
    ["Datenraum", e.raumTitel],
    ["Form", "Die Parteien vereinbaren in § 10 Abs. 5, dass elektronisch unterzeichnete Exemplare als Original gelten und die Schriftform wahren."],
  ];
  const lb = 118;
  const nachweisH = 22 + zeilen.reduce((s, [, v]) => s + hoehe(v, { g: 7.8, breite: B - lb, zl: 11 }) + 3, 0);
  platz(Math.min(nachweisH, 200));
  seite.drawLine({ start: { x: RL, y }, end: { x: SEITE_B - RR, y }, thickness: 0.5, color: LINIE });
  y -= 10;
  sperr("Elektronischer Nachweis", RL, 6.8, LEISE, sch.f);
  y -= 14;
  for (const [k, v] of zeilen) {
    platz(hoehe(v, { g: 7.8, breite: B - lb, zl: 11 }));
    seite.drawText(sicher(sch.f, k), { x: RL, y: y - 7.8, size: 7.4, font: sch.f, color: TEXT });
    absatz(v, { x: RL + lb, breite: B - lb, g: 7.8, zl: 11, farbe: TEXT, block: false });
    y -= 3;
  }

  // ── Fuß ──
  const seiten = pdf.getPages();
  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RL, y: 48 }, end: { x: SEITE_B - RR, y: 48 }, thickness: 0.4, color: LINIE });
    const rechts = `Seite ${i + 1} von ${seiten.length}`;
    const rb = sch.n.widthOfTextAtSize(rechts, 7);
    const links = kuerzen(sicher(sch.n, `FIAON LTD · ${NDA_TITEL} · Fassung ${e.fassung} · ${e.textHash.slice(0, 16)}`), sch.n, 7, B - rb - 16);
    p.drawText(links, { x: RL, y: 36, size: 7, font: sch.n, color: LEISE });
    p.drawText(rechts, { x: SEITE_B - RR - rb, y: 36, size: 7, font: sch.n, color: LEISE });
  });
  metadaten(pdf, `${NDA_TITEL} — ${e.partei3.name}`, e.unterzeichnetAm);
  pdf.setCreator("FIAON Datenraum");
  pdf.setProducer("FIAON Datenraum");
  pdf.setSubject(`Fassung ${e.fassung} · SHA-256 ${e.textHash}`);
  return pdf.save({ useObjectStreams: false });
}

/** Gesperrte Kapitälchen-Zeile: Zeichenabstand (Tc) nur für diesen einen Text, danach wieder 0. */
function gesperrt(p: PDFPage, text: string, x: number, y: number, g: number, font: PDFFont, farbe: RGB, abstand: number): void {
  p.pushOperators(setCharacterSpacing(abstand));
  p.drawText(text, { x, y, size: g, font, color: farbe });
  p.pushOperators(setCharacterSpacing(0));
}
function sperrBreite(text: string, font: PDFFont, g: number, abstand: number): number {
  return font.widthOfTextAtSize(text, g) + abstand * Math.max(0, text.length - 1);
}
function umbrechenEinfach(text: string, font: PDFFont, g: number, breite: number): string[] {
  const out: string[] = []; let z = "";
  for (const w of String(text).split(/\s+/)) {
    const t = z ? `${z} ${w}` : w;
    if (font.widthOfTextAtSize(sicher(font, t), g) > breite && z) { out.push(z); z = w; } else z = t;
  }
  if (z) out.push(z);
  return out;
}
function kuerzen(s: string, font: PDFFont, g: number, max: number): string {
  if (font.widthOfTextAtSize(s, g) <= max) return s;
  let t = s;
  while (t.length > 4 && font.widthOfTextAtSize(`${t}…`, g) > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Versiegeln, wenn ein Schlüssel da ist — sonst bleibt die Datei, wie sie ist (nie ein Fehler für den Gast). */
export async function drVersiegeln(pdf: Uint8Array, am: Date): Promise<{ pdf: Buffer; siegel: string }> {
  const { siegelSchluessel, pdfVersiegeln } = await import("./fiaon-global-siegel");
  const s = siegelSchluessel();
  if ("fehlt" in s) return { pdf: Buffer.from(pdf), siegel: `ausstehend: ${s.fehlt}` };
  try {
    return { pdf: await pdfVersiegeln(pdf, s, { grund: `Elektronisch unterzeichnet im FIAON-Datenraum — ${NDA_TITEL}`, am }), siegel: "versiegelt" };
  } catch (e) {
    console.error("[DATENRAUM] Siegel fehlgeschlagen — die Prüfsumme bleibt der Nachweis:", e);
    return { pdf: Buffer.from(pdf), siegel: `ausstehend: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERMERK BEIM AUSLIEFERN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Schreibt `text` dezent an den unteren Rand jeder Seite — an den Rand, der beim Lesen unten liegt (auch bei
 * gedrehten Seiten), innerhalb des sichtbaren Ausschnitts (CropBox). Wirft bei verschlüsselten oder kaputten PDFs.
 */
export async function drPdfVermerken(roh: Uint8Array, text: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(roh, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const t = sicher(font, text);
  const g = 7.2;
  const breite = font.widthOfTextAtSize(t, g);
  const farbe = rgb(0.36, 0.4, 0.47);
  for (const p of pdf.getPages()) {
    const box = p.getCropBox();
    const r = ((p.getRotation().angle % 360) + 360) % 360;
    const rand = 13;
    if (r === 90) {
      p.drawText(t, { x: box.x + box.width - rand, y: box.y + (box.height - breite) / 2, size: g, font, color: farbe, opacity: 0.8, rotate: degrees(90) });
    } else if (r === 180) {
      p.drawText(t, { x: box.x + (box.width + breite) / 2, y: box.y + box.height - rand, size: g, font, color: farbe, opacity: 0.8, rotate: degrees(180) });
    } else if (r === 270) {
      p.drawText(t, { x: box.x + rand, y: box.y + (box.height + breite) / 2, size: g, font, color: farbe, opacity: 0.8, rotate: degrees(270) });
    } else {
      p.drawText(t, { x: box.x + (box.width - breite) / 2, y: box.y + rand - g * 0.25, size: g, font, color: farbe, opacity: 0.8 });
    }
  }
  return Buffer.from(await pdf.save());
}

/** Beim Hochladen: Seitenzahl und ob der Vermerk gesetzt werden kann (verschlüsselt/kaputt → nein). */
export async function drPdfPruefen(roh: Uint8Array): Promise<{ seiten: number | null; vermerkMoeglich: boolean; grund: string | null }> {
  let seiten: number | null = null;
  try {
    const pdf = await PDFDocument.load(roh, { ignoreEncryption: true, updateMetadata: false });
    seiten = pdf.getPageCount();
    if (pdf.isEncrypted) return { seiten, vermerkMoeglich: false, grund: "Das PDF ist verschlüsselt — es wird ohne Vermerk ausgeliefert." };
  } catch (e) {
    return { seiten, vermerkMoeglich: false, grund: `Das PDF lässt sich nicht lesen (${e instanceof Error ? e.message.slice(0, 120) : "unbekannt"}) — es wird ohne Vermerk ausgeliefert.` };
  }
  try {
    await drPdfVermerken(roh, "Vertraulich · Probe · 01.01.2026");
    return { seiten, vermerkMoeglich: true, grund: null };
  } catch (e) {
    return { seiten, vermerkMoeglich: false, grund: `Der Vermerk lässt sich nicht setzen (${e instanceof Error ? e.message.slice(0, 120) : "unbekannt"}) — es wird ohne Vermerk ausgeliefert.` };
  }
}
