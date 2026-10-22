// ═══════════════════════════════════════════════════════════════════════════
// DER SATZ DER DOKUMENTE ZUR UNTERSCHRIFT — pdf-lib, ohne Browser (22.10.2026)
//
// Setzt die Blöcke aus shared/fiaon-global-us-dokumente.ts zu einem PDF:
//   „us“  US Letter, Ränder 1 Zoll, Seite 1 oben 2,5 Zoll frei (Eingangsstempel),
//         Times 12 pt, schwarz-weiß, kein Logo, leerer Kopf, Fuß „Page X of Y“ mit
//         Doc-ID und Unterzeichner, Titel fett in GROSSBUCHSTABEN mittig, Blocksatz.
//   „ci“  FIAON-CI für interne Dokumente (Ergänzung): A4, Helvetica, Navy.
//
// WARUM pdf-lib STATT CHROMIUM: Beim Unterschreiben wird das Dokument mit der
// Unterschrift NEU gesetzt. Das muss Byte für Byte dasselbe Layout ergeben wie die
// Fassung, die der Kunde gesehen hat — ohne Abhängigkeit von einem Browser, der auf
// Render fehlen kann (Ausfall 21.08.2026). Feste Metadaten (Datum aus dem Dokument)
// machen den Satz reproduzierbar; der Prüfstand rechnet die Seitenzahl nach.
// ═══════════════════════════════════════════════════════════════════════════
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { SatzBlock, SatzDokument } from "@shared/fiaon-global-us-dokumente";

export interface Signatur { name: string; am: string; docId: string }
export interface SatzOptionen {
  /** Unterschriften je Nummer des Unterschriftsblocks. */
  signaturen?: Map<number, Signatur>;
  /** Feste Zeit für die Metadaten (Reproduzierbarkeit) — der Tag der Erzeugung. */
  erzeugtAm: Date;
  /** US-Dokumente: Seite 1 oben frei (Vorgabe true); die Zertifikatsseite braucht das nicht. */
  stempelfeld?: boolean;
}

interface Stil {
  breite: number; hoehe: number; rand: number; oben1: number; unten: number;
  groesse: number; zeile: number; farbe: RGB; leise: RGB; akzent: RGB;
  fussGroesse: number; seite: string; von: string;
}
const NAVY = rgb(0.07, 0.157, 0.29);
const SCHWARZ = rgb(0, 0, 0);

function stilFuer(d: SatzDokument, stempel: boolean): Stil {
  if (d.stil === "us") {
    return { breite: 612, hoehe: 792, rand: 72, oben1: stempel ? 180 : 72, unten: 72, groesse: 12, zeile: 16.2, farbe: SCHWARZ, leise: SCHWARZ, akzent: SCHWARZ, fussGroesse: 9, seite: "Page", von: "of" };
  }
  const en = d.sprache === "en";
  return { breite: 595.28, hoehe: 841.89, rand: 56, oben1: 56, unten: 62, groesse: 10.5, zeile: 15, farbe: rgb(0.1, 0.13, 0.2), leise: rgb(0.42, 0.46, 0.53), akzent: NAVY, fussGroesse: 7.5, seite: en ? "Page" : "Seite", von: en ? "of" : "von" };
}

// ── Zeichen, die die Standardschrift nicht kennt ─────────────────────────────
const ERSATZ: Record<string, string> = { "→": "->", "≥": ">=", "≤": "<=", "✓": "", " ": " ", " ": " ", " ": " ", "‑": "-" };
const kennt = new Map<string, boolean>();
export function sicher(font: PDFFont, s: string): string {
  return Array.from(String(s ?? "")).map((c) => {
    if (ERSATZ[c] !== undefined) return ERSATZ[c];
    const k = `${font.name}:${c}`;
    let ok = kennt.get(k);
    if (ok === undefined) { try { font.encodeText(c); ok = true; } catch { ok = false; } kennt.set(k, ok); }
    if (ok) return c;
    const ohne = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    try { font.encodeText(ohne); return ohne; } catch { return "?"; }
  }).join("");
}

interface Wort { text: string; fett: boolean }
/** „**Initial Member.** Text“ → Wörter mit Fett-Marke. */
function woerter(text: string): Wort[] {
  const out: Wort[] = [];
  const teile = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const t of teile) {
    const fett = t.startsWith("**") && t.endsWith("**");
    for (const w of (fett ? t.slice(2, -2) : t).split(/\s+/).filter(Boolean)) out.push({ text: w, fett });
  }
  return out;
}

export async function satzPdf(d: SatzDokument, o: SatzOptionen): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const st = stilFuer(d, o.stempelfeld !== false);
  const us = d.stil === "us";
  const normal = await pdf.embedFont(us ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const fett = await pdf.embedFont(us ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const kursiv = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const B = st.breite - 2 * st.rand;
  let seite: PDFPage = pdf.addPage([st.breite, st.hoehe]);
  let y = st.hoehe - st.oben1;
  const neueSeite = () => { seite = pdf.addPage([st.breite, st.hoehe]); y = st.hoehe - st.rand; };
  const platz = (h: number) => { if (y - h < st.unten) neueSeite(); };

  // CI-Kopf: Wortmarke, Titel, Linie.
  if (!us) {
    seite.drawText("FIAON Global", { x: st.rand, y, size: 9, font: fett, color: st.akzent });
    y -= 26;
    for (const zeile of umbrechen(d.titel, fett, 17, B)) { seite.drawText(sicher(fett, zeile), { x: st.rand, y, size: 17, font: fett, color: st.akzent }); y -= 22; }
    seite.drawLine({ start: { x: st.rand, y: y + 8 }, end: { x: st.rand + B, y: y + 8 }, thickness: 0.6, color: st.akzent });
    y -= 10;
  }

  /** Blocksatz: Wörter in Zeilen; jede Zeile außer der letzten auf volle Breite. */
  type AbsOpt = { x?: number; breite?: number; groesse?: number; zentriert?: boolean; farbe?: RGB; font?: PDFFont; block?: boolean };
  const umbruch = (text: string, opt: AbsOpt) => {
    const g = opt.groesse ?? st.groesse;
    const bw = opt.breite ?? B;
    const zl = g * (st.zeile / st.groesse);
    const fontVon = (w: Wort) => (w.fett ? fett : (opt.font ?? normal));
    const wb = (w: Wort) => fontVon(w).widthOfTextAtSize(sicher(fontVon(w), w.text), g);
    const leer = normal.widthOfTextAtSize(" ", g);
    // Ein Wort, das breiter ist als die Zeile (Prüfsumme, lange Adresse), wird hart getrennt — nie über den Rand.
    const ws = woerter(text).flatMap((w) => {
      const f = fontVon(w);
      if (f.widthOfTextAtSize(sicher(f, w.text), g) <= bw) return [w];
      const teile: Wort[] = []; let akt = "";
      for (const c of Array.from(w.text)) { if (f.widthOfTextAtSize(sicher(f, akt + c), g) > bw && akt) { teile.push({ text: akt, fett: w.fett }); akt = c; } else akt += c; }
      if (akt) teile.push({ text: akt, fett: w.fett });
      return teile;
    });
    const zeilen: Wort[][] = [];
    let akt: Wort[] = []; let breite = 0;
    for (const w of ws) {
      const b = wb(w);
      if (akt.length && breite + leer + b > bw) { zeilen.push(akt); akt = []; breite = 0; }
      breite += (akt.length ? leer : 0) + b; akt.push(w);
    }
    if (akt.length) zeilen.push(akt);
    return { zeilen, g, zl, bw, fontVon, wb, leer };
  };
  const hoeheVon = (text: string, opt: AbsOpt = {}) => { const u = umbruch(text, opt); return u.zeilen.length * u.zl; };
  const absatz = (text: string, opt: AbsOpt = {}) => {
    const { zeilen, g, zl, bw, fontVon, wb, leer } = umbruch(text, opt);
    const x0 = opt.x ?? st.rand;
    zeilen.forEach((z, i) => {
      platz(zl);
      const summe = z.reduce((s, w) => s + wb(w), 0);
      const letzte = i === zeilen.length - 1;
      // Zentriert (Titel in Großbuchstaben) mit etwas mehr Luft zwischen den Wörtern.
      const zLuecke = opt.zentriert && opt.font === fett ? leer * 1.5 : leer;
      const luecke = z.length > 1 && !letzte && opt.block !== false && !opt.zentriert ? (bw - summe) / (z.length - 1) : zLuecke;
      let x = opt.zentriert ? x0 + (bw - (summe + zLuecke * (z.length - 1))) / 2 : x0;
      for (const w of z) { seite.drawText(sicher(fontVon(w), w.text), { x, y: y - g, size: g, font: fontVon(w), color: opt.farbe ?? st.farbe }); x += wb(w) + luecke; }
      y -= zl;
    });
  };
  const unterschriftHoehe = (b: Extract<SatzBlock, { art: "unterschrift" }>) =>
    (b.ueber ?? "").split("\n").filter(Boolean).length * st.zeile + 46 + (b.zeilen.length + 1) * (st.zeile - 2) + (o.signaturen?.get(b.nr) ? 14 : 0) + 10;

  // Der letzte Absatz vor einer Unterschrift („IN WITNESS WHEREOF …“) bleibt mit ihr auf einer Seite — keine Unterschrift allein.
  for (let i = 0; i < d.bloecke.length; i++) {
    const b = d.bloecke[i]; const n = d.bloecke[i + 1];
    if (b.art === "absatz" && n?.art === "unterschrift") platz(hoeheVon(b.gross ? b.text.toUpperCase() : b.text) + 6 + unterschriftHoehe(n));
    await block(b);
  }

  async function block(b: SatzBlock): Promise<void> {
    switch (b.art) {
      case "titel": {
        for (const z of b.text.split("\n")) absatz(z.toUpperCase(), { font: fett, zentriert: true, groesse: us ? 13 : 13, farbe: st.akzent });
        y -= 4; return;
      }
      case "untertitel": absatz(b.text, { zentriert: us, groesse: us ? 12 : 9, farbe: us ? st.farbe : st.leise }); y -= us ? 10 : 6; return;
      case "kopf": platz(st.zeile * 3); y -= us ? 6 : 8; absatz(b.text, { font: fett, block: false, farbe: st.akzent }); y -= 2; return;
      case "absatz":
        absatz(b.gross ? b.text.toUpperCase() : b.text, { zentriert: b.zentriert, groesse: b.klein ? (us ? 10 : 8.5) : undefined, farbe: b.klein ? st.leise : undefined });
        y -= us ? 6 : 5; return;
      case "liste": {
        b.zeilen.forEach((z, i) => {
          const marke = b.nummern ? `${i + 1}.` : "•";
          platz(st.zeile);
          seite.drawText(marke, { x: st.rand + 4, y: y - st.groesse, size: st.groesse, font: normal, color: st.farbe });
          absatz(z, { x: st.rand + 24, breite: B - 24 });
          y -= us ? 4 : 3;
        });
        y -= 2; return;
      }
      case "tabelle": {
        const lb = b.klein ? (us ? 128 : 110) : (us ? 150 : 120);
        const g = b.klein ? st.groesse - 2 : st.groesse;
        for (const [k, v] of b.zeilen) {
          // Eine Zeile der Tabelle wird nie getrennt: erst Platz für den ganzen Wert, dann Beschriftung und Wert.
          platz(hoeheVon(v, { breite: B - lb, groesse: g }) + 2);
          const start = y;
          seite.drawText(sicher(fett, k), { x: st.rand, y: start - g, size: g - (us ? 1 : 0.5), font: fett, color: st.farbe });
          absatz(v, { x: st.rand + lb, breite: B - lb, block: false, groesse: g });
          y -= b.klein ? 2 : 3;
        }
        y -= 4; return;
      }
      case "abstand": y -= b.pt; return;
      case "unterschrift": {
        const ueber = (b.ueber ?? "").split("\n").filter(Boolean);
        const sig = o.signaturen?.get(b.nr);
        const hoehe = ueber.length * st.zeile + 46 + (b.zeilen.length + 1) * (st.zeile - 2) + (sig ? 14 : 0) + 10;
        platz(hoehe);
        y -= 8;
        for (const u of ueber) absatz(u, { font: u === u.toUpperCase() ? fett : normal, groesse: st.groesse - 1, block: false });
        y -= 34;
        const lb = 3.4 * 72;
        if (sig) seite.drawText(sicher(kursiv, `/s/ ${sig.name}`), { x: st.rand + 4, y: y + 6, size: 16, font: kursiv, color: us ? SCHWARZ : NAVY });
        seite.drawLine({ start: { x: st.rand, y }, end: { x: st.rand + lb, y }, thickness: 0.8, color: st.farbe });
        y -= 4;
        for (const z of b.zeilen) absatz(z, { groesse: st.groesse - 1, block: false });
        // Das Datum der Unterschrift in der Zeitzone des Hauses (Europe/Berlin); die Zeile darunter nennt den genauen Zeitpunkt in UTC.
        const datum = sig ? new Date(sig.am).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Berlin" }) : "______________________";
        absatz(`${d.sprache === "de" && !us ? "Datum" : "Date"}: ${datum}`, { groesse: st.groesse - 1, block: false });
        if (sig) absatz(`Electronically signed via FIAON on ${sig.am.slice(0, 16).replace("T", " ")} UTC · Doc-ID ${sig.docId}`, { groesse: us ? 8 : 7, farbe: us ? SCHWARZ : st.leise, block: false });
        y -= 8; return;
      }
    }
  }

  // Fuß: links Doc-ID/Unterzeichner bzw. Firmenzeile, rechts „Page X of Y“.
  const seiten = pdf.getPages();
  seiten.forEach((p, i) => {
    const rechts = `${st.seite} ${i + 1} ${st.von} ${seiten.length}`;
    const rb = normal.widthOfTextAtSize(rechts, st.fussGroesse);
    if (!us) p.drawLine({ start: { x: st.rand, y: 44 }, end: { x: st.breite - st.rand, y: 44 }, thickness: 0.4, color: rgb(0.89, 0.91, 0.93) });
    const links = kuerzen(sicher(normal, d.fuss), normal, st.fussGroesse, st.breite - 2 * st.rand - rb - 16);
    p.drawText(links, { x: st.rand, y: us ? 40 : 32, size: st.fussGroesse, font: normal, color: us ? SCHWARZ : st.leise });
    p.drawText(rechts, { x: st.breite - st.rand - rb, y: us ? 40 : 32, size: st.fussGroesse, font: normal, color: us ? SCHWARZ : st.leise });
  });
  metadaten(pdf, d.titel, o.erzeugtAm);
  return pdf.save({ useObjectStreams: false });
}

function umbrechen(text: string, font: PDFFont, g: number, breite: number): string[] {
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
export function metadaten(pdf: PDFDocument, titel: string, am: Date): void {
  pdf.setTitle(titel, { showInWindowTitleBar: true });
  pdf.setAuthor("FIAON LTD");
  pdf.setCreator("FIAON Global");
  pdf.setProducer("FIAON Global");
  pdf.setCreationDate(am);
  pdf.setModificationDate(am);
}

/** Hängt die Seiten von `anhang` an `basis` an — die Seiten der Basis bleiben unverändert. */
export async function anhaengen(basis: Uint8Array, anhang: Uint8Array, titel: string, am: Date): Promise<Uint8Array> {
  const ziel = await PDFDocument.load(basis);
  const quelle = await PDFDocument.load(anhang);
  const kopien = await ziel.copyPages(quelle, quelle.getPageIndices());
  for (const k of kopien) ziel.addPage(k);
  metadaten(ziel, titel, am);
  return ziel.save({ useObjectStreams: false });
}

/** Zählt die Seiten eines PDF (für Prüfstand und Vorschau). */
export async function seitenZahl(pdf: Uint8Array | Buffer): Promise<number> {
  return (await PDFDocument.load(pdf, { ignoreEncryption: true })).getPageCount();
}
