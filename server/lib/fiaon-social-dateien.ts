// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO — DER EINE WEG ZU DEN DATEIEN (06.10.2026, E-294)
//
// Alle Lese- und Schreibzugriffe auf fiaon_social_dateien laufen über dieses
// Modul. Heute liegt der Inhalt als BYTEA in Postgres (Hausweg wie
// fiaon_dokumente, 080; Space-Bilder, 047): Render hat flüchtigen Speicher,
// eine Render-Disk verhindert Zero-Downtime-Deploys (E-291: alte und neue
// Instanz laufen parallel), und das Repo ist öffentlich — unveröffentlichte
// Posts gehören nie nach client/public. Ein späterer Umzug in einen
// Objektspeicher (Schwellen: Tabelle > 3 GB, Website-Medien > 50 GB/Monat oder
// Videos > 100 MB) ist dann ein Wechsel dieses Moduls plus Umfüllen; die
// Spalten ablage/extern_schluessel sind schon da.
//
// Regeln:
//   • Der Typ kommt aus den BYTES (JPEG, PNG, PDF, MP4/MOV über „ftyp"), nie
//     aus Dateiname oder Browser-Angabe. Bei MP4 zusätzlich: liegt „moov" vor
//     „mdat"? (Meta-Pflicht für Reels, Phase 2 — heute ein Hinweis.)
//   • Breite/Höhe liest der Server selbst (JPEG-SOF, PNG-IHDR, MP4-tkhd) —
//     es gibt im Repo kein sharp als eigene Abhängigkeit.
//   • Listen lesen NIE die Spalte inhalt. Teilstücke (Range, Safari-Video)
//     kommen per substring auf der EXTERNAL-Spalte, ohne die ganze Datei zu laden.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "crypto";
import fs from "fs";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { sqlPool } from "./db-pool";
import type { SocialRolle } from "@shared/fiaon-social";

export type SocialMime = "image/jpeg" | "image/png" | "application/pdf" | "video/mp4" | "video/quicktime";

export interface DateiAnalyse {
  mime: SocialMime;
  endung: "jpg" | "png" | "pdf" | "mp4" | "mov";
  breite: number | null;
  hoehe: number | null;
  sekunden: number | null;
  /** Nur bei Video: steht „moov" vor „mdat" (Meta verlangt das)? */
  moovVorne: boolean | null;
}

export const sha256Hex = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

// E-294 (06.10.2026, Prüfung): Werte aus Dateiköpfen und Manifest begrenzen — ein
// PNG-IHDR kann 4,29 Mrd. melden, ein mvhd 1e7 Sekunden. Ungeprüft liefe das in
// INTEGER/NUMERIC(6,2) über und endete als 500 statt als Satz. Außerhalb: null.
export const MASS_MAX = 20000;
export const SEKUNDEN_MAX = 3600;
export const massOderNull = (n: number | null | undefined): number | null =>
  n != null && Number.isFinite(n) && n >= 1 && n <= MASS_MAX ? Math.round(n) : null;
export const sekundenOderNull = (n: number | null | undefined): number | null =>
  n != null && Number.isFinite(n) && n >= 0 && n <= SEKUNDEN_MAX ? Math.round(n * 100) / 100 : null;

// ── Typ aus den Bytes ──────────────────────────────────────────────────────
export function dateiTypAusBytes(b: Buffer): DateiAnalyse | null {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const m = jpegMasse(b);
    return { mime: "image/jpeg", endung: "jpg", breite: massOderNull(m?.breite), hoehe: massOderNull(m?.hoehe), sekunden: null, moovVorne: null };
  }
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const ihdr = b.length >= 24 && b.toString("ascii", 12, 16) === "IHDR";
    return { mime: "image/png", endung: "png", breite: ihdr ? massOderNull(b.readUInt32BE(16)) : null, hoehe: ihdr ? massOderNull(b.readUInt32BE(20)) : null, sekunden: null, moovVorne: null };
  }
  if (b.toString("ascii", 0, 5) === "%PDF-") {
    return { mime: "application/pdf", endung: "pdf", breite: null, hoehe: null, sekunden: null, moovVorne: null };
  }
  if (b.toString("ascii", 4, 8) === "ftyp") {
    const marke = b.toString("ascii", 8, 12);
    const mov = marke === "qt  ";
    const erlaubt = mov || /^(isom|iso[2-9]|mp41|mp42|avc1|M4V |mp4v|dash|MSNV)$/.test(marke);
    if (!erlaubt) return null;
    const v = mp4Analyse(b);
    return { mime: mov ? "video/quicktime" : "video/mp4", endung: mov ? "mov" : "mp4", breite: massOderNull(v.breite), hoehe: massOderNull(v.hoehe), sekunden: sekundenOderNull(v.sekunden), moovVorne: v.moovVorne };
  }
  return null;
}

/** Passt der erkannte Typ zur Rolle aus dem Manifest? Liefert einen deutschen Satz oder null. */
export function rolleTypFehler(rolle: SocialRolle, a: DateiAnalyse, name: string): string | null {
  const bild = a.mime === "image/jpeg" || a.mime === "image/png";
  const video = a.mime === "video/mp4" || a.mime === "video/quicktime";
  if ((rolle === "bild" || rolle === "cover" || rolle === "story") && !bild) return `„${name}“ hat die Rolle „${rolle}“, ist aber kein JPEG- oder PNG-Bild.`;
  if (rolle === "video" && !video) return `„${name}“ hat die Rolle „video“, ist aber kein MP4/MOV.`;
  if (rolle === "dokument" && a.mime !== "application/pdf") return `„${name}“ hat die Rolle „dokument“, ist aber kein PDF.`;
  return null;
}

/** Hinweise für die spätere Meta-Strecke (sperren heute nichts). */
export function metaHinweise(rolle: SocialRolle, a: DateiAnalyse, bytes: number, name: string): string[] {
  const h: string[] = [];
  if ((rolle === "bild" || rolle === "cover") && a.mime !== "image/jpeg") h.push(`„${name}“ ist kein JPEG — die Meta-Schnittstelle nimmt nur JPEG.`);
  if ((rolle === "bild" || rolle === "cover") && bytes > 8 * 1024 * 1024) h.push(`„${name}“ ist größer als 8 MB — zu groß für die Meta-Schnittstelle.`);
  if (rolle === "video" && a.moovVorne === false) h.push(`„${name}“: Der moov-Block liegt hinten — Meta verlangt ihn vorne (faststart).`);
  return h;
}

function jpegMasse(b: Buffer): { breite: number; hoehe: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xff) { i++; continue; }
    const len = b.readUInt16BE(i + 2);
    // SOF0–SOF15 ohne DHT (C4), JPG (C8), DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { hoehe: b.readUInt16BE(i + 5), breite: b.readUInt16BE(i + 7) };
    }
    if (m === 0xda) return null; // Bilddaten beginnen, kein SOF gefunden
    i += 2 + len;
  }
  return null;
}

/** Kleiner Box-Leser für MP4/MOV: Reihenfolge moov/mdat, Maße aus tkhd, Dauer aus mvhd. */
function mp4Analyse(b: Buffer): { breite: number | null; hoehe: number | null; sekunden: number | null; moovVorne: boolean | null } {
  let moovPos = -1, mdatPos = -1;
  let breite: number | null = null, hoehe: number | null = null, sekunden: number | null = null;
  const boxen = (start: number, ende: number, tiefe: number) => {
    let i = start;
    while (i + 8 <= ende) {
      let groesse = b.readUInt32BE(i);
      const typ = b.toString("ascii", i + 4, i + 8);
      let kopf = 8;
      if (groesse === 1) {
        if (i + 16 > ende) return;
        groesse = Number(b.readBigUInt64BE(i + 8));
        kopf = 16;
      } else if (groesse === 0) groesse = ende - i;
      if (groesse < kopf) return;
      // Abgeschnittene Box (außer mdat, das darf bis zum Ende reichen): nicht weiterlesen.
      if (i + groesse > ende && typ !== "mdat") return;
      if (tiefe === 0) {
        if (typ === "moov" && moovPos < 0) moovPos = i;
        if (typ === "mdat" && mdatPos < 0) mdatPos = i;
      }
      const inhaltStart = i + kopf;
      const inhaltEnde = Math.min(i + groesse, ende);
      if (typ === "moov" || typ === "trak") boxen(inhaltStart, inhaltEnde, tiefe + 1);
      else if (typ === "mvhd" && inhaltStart + 32 <= inhaltEnde) {
        const v = b[inhaltStart];
        if (v === 1) { const ts = b.readUInt32BE(inhaltStart + 20); const d = Number(b.readBigUInt64BE(inhaltStart + 24)); if (ts > 0) sekunden = Math.round((d / ts) * 100) / 100; }
        else { const ts = b.readUInt32BE(inhaltStart + 12); const d = b.readUInt32BE(inhaltStart + 16); if (ts > 0) sekunden = Math.round((d / ts) * 100) / 100; }
      } else if (typ === "tkhd" && (breite == null || breite === 0)) {
        const v = b[inhaltStart];
        const off = v === 1 ? inhaltStart + 4 + 8 + 8 + 4 + 4 + 8 + 8 + 2 + 2 + 2 + 2 + 36 : inhaltStart + 4 + 4 + 4 + 4 + 4 + 4 + 8 + 2 + 2 + 2 + 2 + 36;
        if (off + 8 <= inhaltEnde) {
          const w = b.readUInt32BE(off) / 65536, h = b.readUInt32BE(off + 4) / 65536;
          if (w > 0 && h > 0) { breite = Math.round(w); hoehe = Math.round(h); }
        }
      }
      if (groesse <= 0) return;
      i += groesse;
    }
  };
  try { boxen(0, b.length, 0); } catch { /* kaputte Box — Maße bleiben leer */ }
  return { breite, hoehe, sekunden, moovVorne: moovPos >= 0 && mdatPos >= 0 ? moovPos < mdatPos : moovPos >= 0 ? true : null };
}

// ── Lesen und Schreiben ────────────────────────────────────────────────────
export interface DateiKopf {
  id: number;
  post_id: number | null;
  pos: number;
  rolle: SocialRolle;
  dateiname: string;
  mime: string;
  bytes: number;
  sha256: string;
  breite: number | null;
  hoehe: number | null;
  sekunden: number | null;
  ablage: "db" | "extern";
  geleert: boolean;
}

const kopfAus = (r: any): DateiKopf => ({
  id: Number(r.id), post_id: r.post_id == null ? null : Number(r.post_id), pos: Number(r.pos), rolle: r.rolle,
  dateiname: r.dateiname, mime: r.mime, bytes: Number(r.bytes), sha256: String(r.sha256).trim(),
  breite: r.breite == null ? null : Number(r.breite), hoehe: r.hoehe == null ? null : Number(r.hoehe),
  sekunden: r.sekunden == null ? null : Number(r.sekunden), ablage: r.ablage, geleert: !!r.inhalt_geleert_am,
});

/** Kopf einer Datei (ohne Inhalt). */
export async function dateiKopf(id: number): Promise<DateiKopf | null> {
  const r = (await sqlPool`
    SELECT id, post_id, pos, rolle, dateiname, mime, bytes, sha256, breite, hoehe, sekunden, ablage, inhalt_geleert_am
      FROM fiaon_social_dateien WHERE id = ${id} AND geloescht_am IS NULL`) as any[];
  return r[0] ? kopfAus(r[0]) : null;
}

/** Köpfe mehrerer Dateien (ohne Inhalt). */
export async function dateiKoepfe(ids: number[]): Promise<Map<number, DateiKopf>> {
  const m = new Map<number, DateiKopf>();
  if (!ids.length) return m;
  const r = (await sqlPool`
    SELECT id, post_id, pos, rolle, dateiname, mime, bytes, sha256, breite, hoehe, sekunden, ablage, inhalt_geleert_am
      FROM fiaon_social_dateien WHERE id = ANY(${ids}::bigint[])`) as any[];
  for (const x of r) m.set(Number(x.id), kopfAus(x));
  return m;
}

/**
 * Liest die Bytes, ganz oder als Teilstück [von, bis] (beide inklusive, wie HTTP-Range).
 * substring() auf der EXTERNAL-Spalte liest nur die nötigen TOAST-Stücke.
 */
export async function dateiLesen(id: number, teil?: { von: number; bis: number }): Promise<Buffer | null> {
  if (teil) {
    const laenge = teil.bis - teil.von + 1;
    const r = (await sqlPool`SELECT substring(inhalt FROM ${teil.von + 1} FOR ${laenge}) AS stueck FROM fiaon_social_dateien WHERE id = ${id} AND ablage = 'db'`) as any[];
    return r[0]?.stueck ? Buffer.from(r[0].stueck) : null;
  }
  const r = (await sqlPool`SELECT inhalt FROM fiaon_social_dateien WHERE id = ${id} AND ablage = 'db'`) as any[];
  return r[0]?.inhalt ? Buffer.from(r[0].inhalt) : null;
}

/** Stückgröße beim Lesen großer Dateien (Auslieferung ohne Range, ZIP). */
export const STUECK_BYTES = 8 * 1024 * 1024;

/**
 * Liest eine Datei in Stücken von höchstens STUECK_BYTES (E-294, Prüfung 06.10.2026):
 * nie die ganze Datei samt Hex-Kopie auf einmal im Speicher. Der Aufrufer zieht
 * Stück für Stück (for await) und kann jederzeit aufhören (Abbruch des Downloads).
 */
export async function* dateiStuecke(id: number, bytes: number): AsyncGenerator<Buffer> {
  for (let von = 0; von < bytes; von += STUECK_BYTES) {
    const b = await dateiLesen(id, { von, bis: Math.min(bytes, von + STUECK_BYTES) - 1 });
    if (!b || !b.length) return;
    yield b;
  }
}

/**
 * Gibt es diese Bytes schon irgendwo (mit Inhalt)? Dann darf der Import die
 * Datei weglassen; der Server kopiert sie in der Datenbank. Liefert je sha256
 * den gespeicherten Typ — der Import prüft ihn gegen die Rolle (ein Verweis darf
 * kein PDF als „bild“ einhängen).
 */
export async function vorhandeneShas(shas: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!shas.length) return m;
  const r = (await sqlPool`
    SELECT DISTINCT ON (sha256) sha256, mime FROM fiaon_social_dateien
     WHERE sha256 = ANY(${shas}::text[]) AND geloescht_am IS NULL AND inhalt_geleert_am IS NULL AND ablage = 'db'
     ORDER BY sha256, id`) as any[];
  for (const x of r) m.set(String(x.sha256).trim(), String(x.mime));
  return m;
}

/** Ein Feld im Textformat von COPY: \N für NULL, Backslash/Tab/Zeilenumbruch maskiert. */
function copyFeld(v: string | number | null | undefined): string {
  if (v == null) return "\\N";
  return String(v).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/**
 * Macht aus dem Byte-Strom EINE COPY-Zeile: `vorne` (die übrigen Spalten) und
 * dann das BYTEA als `\\x<hex>` (der Backslash ist im COPY-Text verdoppelt).
 * Prüft unterwegs die sha256 — passt sie am Ende nicht, bricht COPY ab.
 */
function alsCopyZeile(vorne: string, sha: string, name: string): Transform {
  const h = createHash("sha256");
  let erster = true;
  return new Transform({
    transform(stueck: Buffer, _enc, fertig) {
      h.update(stueck);
      const hex = stueck.toString("hex");
      if (erster) { erster = false; fertig(null, `${vorne}\\\\x${hex}`); } else fertig(null, hex);
    },
    flush(fertig) {
      if (erster) this.push(`${vorne}\\\\x`);
      if (h.digest("hex") !== sha) return fertig(new Error(`Die Datei „${name}“ hat sich während des Imports verändert.`));
      this.push("\n");
      fertig();
    },
  });
}

export interface DateiNeu {
  post_id: number;
  pos: number;
  rolle: SocialRolle;
  dateiname: string;
  sha256: string;
  /**
   * Woher die Bytes kommen: ein Pfad auf der Platte (multer-Upload, wird erst
   * hier gelesen — eine Datei nach der anderen), ein Buffer, oder null — dann
   * wird aus einer vorhandenen Zeile mit derselben sha256 kopiert.
   */
  inhalt: Buffer | { pfad: string } | null;
  analyse: DateiAnalyse | null;
  sekunden: number | null;
  von: string;
}

/**
 * Schreibt eine Datei in der Transaktion `tx`. Liegt dieselbe sha256 für
 * denselben Post schon da, wird die Zeile wiederverwendet (Position/Rolle/Name
 * nachgezogen) — eine neue Fassung speichert unveränderte Bilder kein zweites Mal.
 * Kommt dieselbe sha256 in einem Manifest zweimal vor (Titelbild = Folie 1), zeigt
 * die Zeile danach pos/rolle des letzten Eintrags — maßgeblich für Reihenfolge und
 * Download-Namen ist deshalb immer die jsonb-Liste `dateien` am Post, nie die Zeile.
 * Liefert die id.
 */
export async function dateiSchreiben(tx: any, d: DateiNeu): Promise<number> {
  const da = (await tx`
    SELECT id FROM fiaon_social_dateien
     WHERE post_id = ${d.post_id} AND sha256 = ${d.sha256} AND variante = 'original' AND geloescht_am IS NULL
     LIMIT 1`) as any[];
  if (da[0]) {
    await tx`UPDATE fiaon_social_dateien SET pos = ${d.pos}, rolle = ${d.rolle}, dateiname = ${d.dateiname}, ersetzt_durch = NULL WHERE id = ${da[0].id}`;
    return Number(da[0].id);
  }
  if (d.inhalt) {
    // Bytes per COPY … FROM STDIN als Strom: Platte → Hex in 1-MB-Stücken → Postgres.
    // Ein normales INSERT schickte die ganze Datei als EINEN Hex-Text (postgres.js
    // serialisiert BYTEA so) — bei 40 MB rund 80 MB String plus Puffer je Datei.
    // So liegt nie die ganze Datei als Hex im Speicher; die sha256 wird unterwegs
    // gegengeprüft (Datei während des Imports verändert → Abbruch, Rollback).
    const a = d.analyse;
    const quelle: Readable = Buffer.isBuffer(d.inhalt)
      ? Readable.from([d.inhalt])
      : fs.createReadStream(d.inhalt.pfad, { highWaterMark: 1024 * 1024 });
    const bytes = Buffer.isBuffer(d.inhalt) ? d.inhalt.length : (await fs.promises.stat(d.inhalt.pfad)).size;
    const vorne = [
      d.post_id, d.pos, d.rolle, d.dateiname, a?.mime ?? "application/octet-stream", bytes, d.sha256,
      massOderNull(a?.breite), massOderNull(a?.hoehe), sekundenOderNull(d.sekunden ?? a?.sekunden ?? null), d.von,
    ].map(copyFeld).join("\t") + "\t";
    const ziel = await tx`
      COPY fiaon_social_dateien (post_id, pos, rolle, dateiname, mime, bytes, sha256, breite, hoehe, sekunden, hochgeladen_von, inhalt)
      FROM STDIN`.writable();
    await pipeline(quelle, alsCopyZeile(vorne, d.sha256, d.dateiname), ziel);
    const r = (await tx`
      SELECT id FROM fiaon_social_dateien
       WHERE post_id = ${d.post_id} AND sha256 = ${d.sha256} AND variante = 'original' AND geloescht_am IS NULL
       ORDER BY id DESC LIMIT 1`) as any[];
    if (!r[0]) throw new Error(`Die Datei „${d.dateiname}“ ließ sich nicht speichern.`);
    return Number(r[0].id);
  }
  // Kopie aus einer vorhandenen Zeile (gleiche Bytes, anderer Post oder alte Fassung).
  // Ehrlich: Das ist eine echte KOPIE der Bytes in der Datenbank (INSERT … SELECT
  // inhalt) — gespart wird nur der Upload, nicht der Speicher.
  const r = (await tx`
    INSERT INTO fiaon_social_dateien (post_id, pos, rolle, dateiname, mime, bytes, sha256, breite, hoehe, sekunden, inhalt, quelle_id, hochgeladen_von)
    SELECT ${d.post_id}, ${d.pos}, ${d.rolle}, ${d.dateiname}, mime, bytes, sha256, breite, hoehe, COALESCE(${sekundenOderNull(d.sekunden)}::numeric, sekunden), inhalt, id, ${d.von}
      FROM fiaon_social_dateien
     WHERE sha256 = ${d.sha256} AND geloescht_am IS NULL AND inhalt_geleert_am IS NULL AND ablage = 'db'
     ORDER BY id LIMIT 1
    RETURNING id`) as any[];
  if (!r[0]) throw new Error(`Die Datei „${d.dateiname}“ fehlt und liegt auch nicht schon in der Datenbank.`);
  return Number(r[0].id);
}

/** Speicherbedarf aller Social-Dateien (für den Studio-Kopf: Warnung ab 3 GB). */
export async function speicherBytes(): Promise<number> {
  const r = (await sqlPool`SELECT COALESCE(SUM(bytes), 0)::bigint AS n FROM fiaon_social_dateien WHERE geloescht_am IS NULL AND inhalt_geleert_am IS NULL`) as any[];
  return Number(r[0]?.n ?? 0);
}

/** Studio-Adressen einer Datei. */
export const dateiUrl = (id: number) => `/api/fiaon/chef/social/datei/${id}`;
export const dateiDownloadUrl = (id: number) => `/api/fiaon/chef/social/datei/${id}?download=1`;

/** Download-Name mit Foliennummer: „2026-10-06-launch-03_Folie-02.jpg", „…_Reel.mp4", „…_Titelbild.jpg". */
export function downloadName(externId: string, pos: number, rolle: SocialRolle, mime: string, anzahlBilder: number): string {
  const endung = mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : mime === "video/quicktime" ? "mov" : mime.startsWith("video/") ? "mp4" : "jpg";
  const nr = String(pos).padStart(2, "0");
  const teil = rolle === "video" ? "Reel" : rolle === "cover" ? "Titelbild" : rolle === "story" ? `Story-${nr}` : rolle === "dokument" ? "Dokument" : anzahlBilder > 1 ? `Folie-${nr}` : "Bild";
  return `${externId.replace(/[^a-zA-Z0-9._-]/g, "_")}_${teil}.${endung}`;
}
