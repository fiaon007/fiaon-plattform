// ═══════════════════════════════════════════════════════════════════════════
// BILDER BEREINIGEN — Typ am Inhalt erkennen, Metadaten entfernen (07.10.2026, E-301)
//
// Bilder eines persönlichen Angebots liegen in der Datenbank am Angebot (fiaon_global_angebot_bilder) und
// gehen nur hinter dem Angebots-Link raus. Beim Import (scripts/angebot-firma-anlegen.ts --bilder) läuft
// jedes Bild hier durch:
//   · Der Typ zählt nach dem INHALT (Signatur), nicht nach der Endung — und Endung und Inhalt müssen passen.
//     Erlaubt sind nur WebP, PNG und JPEG (kein SVG: das wäre ein Dokument mit Skript).
//   · Metadaten fallen heraus, ohne das Bild neu zu kodieren (kein Qualitätsverlust):
//       WebP: Blöcke „EXIF“ und „XMP “ (und die Merker im VP8X-Kopf)
//       PNG:  eXIf, tEXt, zTXt, iTXt, tIME
//       JPEG: APP1 (Exif, XMP), APP13 (IPTC/Photoshop), COM (Kommentar)
//     Das Farbprofil (ICC) bleibt — es ist keine Angabe über Personen, und ohne es kippen die Farben.
//   · Ein kaputtes Bild (Längen passen nicht) wird abgelehnt statt halb übernommen.
//
// Rein (nur Buffer hinein, Buffer heraus) — der Prüfstand scripts/pruef-angebot-firma.ts spielt jeden Weg durch.
// ═══════════════════════════════════════════════════════════════════════════

export type BildTyp = "image/webp" | "image/png" | "image/jpeg";
export const BILD_TYPEN: readonly BildTyp[] = ["image/webp", "image/png", "image/jpeg"];
/** Höchstens so groß darf ein einzelnes Bild sein (nach dem Bereinigen). */
export const BILD_HOECHST_BYTES = 4 * 1024 * 1024;

const ENDUNG: Record<string, BildTyp> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/** Der Typ nach der Signatur — oder null (dann ist es kein erlaubtes Bild). */
export function bildTypAusInhalt(b: Buffer): BildTyp | null {
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}
/** Der Typ nach der Endung des Namens — oder null. */
export function bildTypAusName(name: string): BildTyp | null {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? ENDUNG[m[1]] ?? null : null;
}

export interface BereinigtesBild { daten: Buffer; typ: BildTyp; entfernt: string[] }

/** Bild prüfen und ohne Metadaten zurückgeben. Wirft mit einem lesbaren Satz, wenn es kein erlaubtes oder ein kaputtes Bild ist. */
export function bildOhneMetadaten(roh: Buffer, name: string): BereinigtesBild {
  const typ = bildTypAusInhalt(roh);
  if (!typ) throw new Error(`${name}: kein WebP-, PNG- oder JPEG-Bild (Signatur fehlt).`);
  const erwartet = bildTypAusName(name);
  if (erwartet !== typ) throw new Error(`${name}: Endung und Inhalt passen nicht (Inhalt ${typ}).`);
  const erg = typ === "image/webp" ? webpOhne(roh, name) : typ === "image/png" ? pngOhne(roh, name) : jpegOhne(roh, name);
  if (erg.daten.length > BILD_HOECHST_BYTES) throw new Error(`${name}: größer als ${Math.round(BILD_HOECHST_BYTES / 1024 / 1024)} MB.`);
  return { ...erg, typ };
}

// ── WebP (RIFF) ───────────────────────────────────────────────────────────────
function webpOhne(b: Buffer, name: string): { daten: Buffer; entfernt: string[] } {
  const groesse = b.readUInt32LE(4);
  if (groesse + 8 !== b.length) throw new Error(`${name}: WebP-Länge passt nicht zum Inhalt.`);
  const bloecke: Buffer[] = []; const entfernt: string[] = [];
  let i = 12;
  while (i < b.length) {
    if (i + 8 > b.length) throw new Error(`${name}: WebP-Block abgeschnitten.`);
    const art = b.toString("latin1", i, i + 4);
    const len = b.readUInt32LE(i + 4);
    const ende = i + 8 + len + (len % 2);
    if (i + 8 + len > b.length) throw new Error(`${name}: WebP-Block „${art}“ länger als die Datei.`);
    if (art === "EXIF" || art === "XMP ") entfernt.push(art.trim());
    else bloecke.push(Buffer.from(b.subarray(i, Math.min(ende, b.length))));
    i = ende;
  }
  if (!entfernt.length) return { daten: b, entfernt };
  // Die Merker im VP8X-Kopf zurücksetzen (Bit 3 = EXIF, Bit 2 = XMP), sonst sucht ein Leser die Blöcke.
  for (const k of bloecke) if (k.toString("latin1", 0, 4) === "VP8X" && k.length > 8) k[8] &= ~0x0c;
  const rumpf = Buffer.concat(bloecke);
  const kopf = Buffer.alloc(12); kopf.write("RIFF", 0, "latin1"); kopf.writeUInt32LE(4 + rumpf.length, 4); kopf.write("WEBP", 8, "latin1");
  return { daten: Buffer.concat([kopf, rumpf]), entfernt };
}

// ── PNG ───────────────────────────────────────────────────────────────────────
const PNG_WEG = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
function pngOhne(b: Buffer, name: string): { daten: Buffer; entfernt: string[] } {
  const teile: Buffer[] = [b.subarray(0, 8)]; const entfernt: string[] = [];
  let i = 8; let ende = false;
  while (i < b.length && !ende) {
    if (i + 12 > b.length) throw new Error(`${name}: PNG-Block abgeschnitten.`);
    const len = b.readUInt32BE(i);
    const art = b.toString("latin1", i + 4, i + 8);
    const bis = i + 12 + len;
    if (bis > b.length) throw new Error(`${name}: PNG-Block „${art}“ länger als die Datei.`);
    if (PNG_WEG.has(art)) entfernt.push(art); else teile.push(b.subarray(i, bis));
    if (art === "IEND") ende = true;
    i = bis;
  }
  if (!ende) throw new Error(`${name}: PNG ohne Ende (IEND).`);
  return { daten: entfernt.length ? Buffer.concat(teile) : b, entfernt };
}

// ── JPEG ──────────────────────────────────────────────────────────────────────
const JPEG_WEG: Record<number, string> = { 0xe1: "APP1 (Exif/XMP)", 0xed: "APP13 (IPTC)", 0xfe: "COM" };
function jpegOhne(b: Buffer, name: string): { daten: Buffer; entfernt: string[] } {
  const teile: Buffer[] = [b.subarray(0, 2)]; const entfernt: string[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error(`${name}: JPEG-Segment ohne Marke.`);
    while (b[i + 1] === 0xff) i++; // Füllbytes
    const marke = b[i + 1];
    if (marke === undefined) throw new Error(`${name}: JPEG abgeschnitten.`);
    if (marke === 0xd9) { teile.push(b.subarray(i)); return { daten: entfernt.length ? Buffer.concat(teile) : b, entfernt }; }
    if (marke >= 0xd0 && marke <= 0xd7) { teile.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > b.length) throw new Error(`${name}: JPEG-Segment abgeschnitten.`);
    const len = b.readUInt16BE(i + 2);
    const bis = i + 2 + len;
    if (len < 2 || bis > b.length) throw new Error(`${name}: JPEG-Segment länger als die Datei.`);
    // Ab dem Bildbeginn (SOS) folgen nur noch Bilddaten — sie werden unverändert übernommen.
    if (marke === 0xda) { teile.push(b.subarray(i)); return { daten: entfernt.length ? Buffer.concat(teile) : b, entfernt }; }
    if (JPEG_WEG[marke]) entfernt.push(JPEG_WEG[marke]); else teile.push(b.subarray(i, bis));
    i = bis;
  }
  throw new Error(`${name}: JPEG ohne Bilddaten.`);
}
