// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DIE REINEN REGELN DES SERVERS (E-489, 09.11.2026)
//
// Was der Server bei jeder Anfrage entscheidet, ohne Datenbank und ohne Netz
// nachrechenbar (scripts/pruef-datenraum.ts, Teil A):
//   · Welche Datei ist das? Am INHALT erkannt, nie am Namen (Muster
//     fiaon-global-bereich-regeln.ts) — PDF, JPG, PNG und Word/Excel/PowerPoint
//     im OOXML-Format ohne Makros. HTML, SVG und alte Office-Formate (OLE) nie.
//   · Ist im Unterschriftsbild Tinte? (Muster der Firmen-Annahme, E-301.)
//   · Einladungscodes erzeugen und nur als Prüfsumme speichern.
//   · Das Sitzungs-Plätzchen: signiert, mit Ablauf und Sitzungsstand des Gastes
//     (Sperren oder neuer Code beendet jede offene Sitzung sofort).
//   · Darf dieser Gast dieses Dokument sehen? — die EINE Regel.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { DR_CODE_ALPHABET, DR_CODE_ZEICHEN, DR_DATEI_MAX_BYTES, drCodeAnzeige, type DrDateiArt } from "@shared/fiaon-datenraum-nda";
import { globalDateiname, globalDateinameKopf } from "./fiaon-global-bereich-regeln";

// ── Dateien ────────────────────────────────────────────────────────────────
export interface DrDateiTyp { mime: string; endung: string; art: DrDateiArt }
const OOXML: { marke: string; mime: string; endung: string }[] = [
  { marke: "word/document.xml", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", endung: "docx" },
  { marke: "xl/workbook.xml", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", endung: "xlsx" },
  { marke: "ppt/presentation.xml", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", endung: "pptx" },
];
/** Die Typen, die der Raum ausliefert — und nur diese. */
export const DR_AUSLIEFERBAR = new Set(["application/pdf", "image/jpeg", "image/png", ...OOXML.map((o) => o.mime)]);

/** Typ aus den Bytes — oder der Satz, warum die Datei nicht angenommen wird. */
export function drDateiTyp(b: Uint8Array | null | undefined): DrDateiTyp | { fehler: string } {
  if (!b || b.length < 16) return { fehler: "Die Datei ist leer oder beschädigt." };
  if (b.length > DR_DATEI_MAX_BYTES) return { fehler: "Die Datei ist größer als 25 MB." };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: "application/pdf", endung: "pdf", art: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", endung: "jpg", art: "bild" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: "image/png", endung: "png", art: "bild" };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // Ein Office-Dokument ist ein ZIP-Behälter. Die Namen der Einträge stehen unverschlüsselt im Behälter —
    // daran erkennen wir die Art, und an „vbaProject.bin“ die Makros (.docm/.xlsm/.pptm), die hier nie hineinkommen.
    const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
    if (buf.indexOf("[Content_Types].xml", 0, "latin1") < 0) return { fehler: "Nur PDF, JPG, PNG oder Word, Excel, PowerPoint — erkannt am Inhalt der Datei." };
    if (buf.indexOf("vbaProject.bin", 0, "latin1") >= 0) return { fehler: "Dateien mit Makros nehmen wir nicht an. Bitte als PDF oder ohne Makros speichern." };
    const o = OOXML.find((x) => buf.indexOf(x.marke, 0, "latin1") >= 0);
    if (o) return { mime: o.mime, endung: o.endung, art: "office" };
  }
  return { fehler: "Nur PDF, JPG, PNG oder Word, Excel, PowerPoint — erkannt am Inhalt der Datei." };
}
export function drDateiArtVonMime(mime: string): DrDateiArt {
  return mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "bild" : "office";
}
/** Der Name in Liste und Antwortkopf — ohne Pfad und Steuerzeichen, mit der Endung des ERKANNTEN Inhalts. */
export function drDateiname(roh: unknown, endung: string): string { return globalDateiname(roh, endung); }
/** Content-Disposition für Ansehen (inline) oder Herunterladen (attachment) — ASCII plus UTF-8-Form. */
export function drDispositionKopf(art: "inline" | "attachment", dateiname: string): string {
  return `${art}; filename="${globalDateinameKopf(dateiname)}"; filename*=UTF-8''${encodeURIComponent(dateiname)}`;
}

// ── Unterschriftsbild ──────────────────────────────────────────────────────
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Liest „data:image/png;base64,…“ — null, wenn es keins ist. */
export function drPngAusDataUrl(v: unknown): Buffer | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(v ?? ""));
  if (!m) return null;
  try { return Buffer.from(m[1], "base64"); } catch { return null; }
}
/** null = gültige Unterschrift; sonst der Grund. Nur RGBA mit 8 Bit (so liefert jedes Canvas), Tinte = deckende Punkte. */
export function drPngTintePruefen(png: Buffer | null): string | null {
  if (!png || png.length < 200 || png.length > 600_000 || !png.subarray(0, 8).equals(PNG_KOPF)) return "kein gültiges Bild";
  let pos = 8; let breite = 0; let hoehe = 0; let tiefe = 0; let farbe = 0; const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const laenge = png.readUInt32BE(pos); const art = png.toString("latin1", pos + 4, pos + 8);
    const daten = png.subarray(pos + 8, pos + 8 + laenge);
    if (daten.length !== laenge) return "Bild abgeschnitten";
    if (art === "IHDR") { breite = daten.readUInt32BE(0); hoehe = daten.readUInt32BE(4); tiefe = daten[8]; farbe = daten[9]; }
    else if (art === "IDAT") idat.push(daten);
    else if (art === "IEND") break;
    pos += 12 + laenge;
  }
  if (breite < 60 || hoehe < 24 || breite > 4000 || hoehe > 2000 || !idat.length) return "Bildmaße unpassend";
  if (farbe !== 6 || tiefe !== 8) return "Bildformat unpassend";
  let roh: Buffer;
  try { roh = inflateSync(Buffer.concat(idat)); } catch { return "Bild nicht lesbar"; }
  const zeile = breite * 4 + 1;
  if (roh.length < zeile * hoehe) return "Bild unvollständig";
  let tinte = 0;
  for (let y = 0; y < hoehe; y++) { const a = y * zeile + 1; for (let x = a; x < a + zeile - 1; x++) if (roh[x] !== 0) { tinte++; if (tinte > 60) return null; } }
  return "Das Unterschriftsfeld ist leer";
}

// ── Codes und Kennungen ────────────────────────────────────────────────────
/** Ein neuer Einladungscode: Anzeige (einmal), Prüfsumme (gespeichert) und die letzten vier Zeichen (Wiedererkennen). */
export function drCodeErzeugen(): { code: string; normal: string; hash: string; hinweis: string } {
  let k = "";
  for (let i = 0; i < DR_CODE_ZEICHEN; i++) k += DR_CODE_ALPHABET[randomInt(DR_CODE_ALPHABET.length)];
  const normal = `DR${k}`;
  return { code: drCodeAnzeige(normal), normal, hash: drCodeHash(normal), hinweis: k.slice(-4) };
}
/** Gespeichert wird nur diese Prüfsumme — rund 59 Bit Zufall im Code machen ein Zurückrechnen aussichtslos. */
export function drCodeHash(normal: string): string {
  return createHash("sha256").update(`fiaon-dr-code.v1:${normal}`).digest("hex");
}
/** Zufällige, nicht ratbare Kennung (Dokumente in Adressen). */
export function drKennung(): string { return randomBytes(16).toString("base64url"); }
export const drSha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

// ── Sitzung ────────────────────────────────────────────────────────────────
export const DR_COOKIE = "fiaon_dr";
export const DR_COOKIE_PFAD = "/api/fiaon/datenraum";
export const DR_SITZUNG_TAGE = 7;
function drSignatur(gastId: number, version: number, bis: number, geheim: string): string {
  return createHmac("sha256", geheim).update(`fiaon-dr.v1:${gastId}:${version}:${bis}`).digest("hex").slice(0, 40);
}
/** gastId.version.bis.signatur — `version` ist der Sitzungsstand des Gastes (Sperren und neuer Code erhöhen ihn). */
export function drTokenBauen(gastId: number, version: number, geheim: string, jetzt = Date.now()): string {
  const bis = jetzt + DR_SITZUNG_TAGE * 24 * 3600_000;
  return `${gastId}.${version}.${bis}.${drSignatur(gastId, version, bis, geheim)}`;
}
export function drTokenPruefen(token: unknown, geheim: string, jetzt = Date.now()): { gastId: number; version: number } | null {
  if (typeof token !== "string" || token.length > 120) return null;
  const t = token.split(".");
  if (t.length !== 4) return null;
  const gastId = Number(t[0]); const version = Number(t[1]); const bis = Number(t[2]);
  if (!Number.isInteger(gastId) || gastId <= 0 || !Number.isInteger(version) || version < 1 || !Number.isFinite(bis) || bis < jetzt) return null;
  const soll = Buffer.from(drSignatur(gastId, version, bis, geheim));
  const ist = Buffer.from(String(t[3]));
  if (ist.length !== soll.length || !timingSafeEqual(ist, soll)) return null;
  return { gastId, version };
}
export function drGeheimnis(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-datenraum-secret";
}

// ── Die EINE Zugriffsregel ─────────────────────────────────────────────────
export interface DrZugriffLage {
  /** Gültige Sitzung mit passendem Sitzungsstand. */
  angemeldet: boolean;
  gastRaumId: number | null;
  gastGesperrt: boolean;
  raumArchiviert: boolean;
  /** Projekte, die die zuletzt unterzeichnete Vereinbarung abdeckt — null = noch keine Vereinbarung. */
  ndaProjektIds: number[] | null;
  dokument: { raumId: number; projektId: number; sichtbar: boolean; entfernt: boolean; projektEntfernt: boolean } | null;
}
export type DrZugriff =
  | { erlaubt: true }
  | { erlaubt: false; status: 401 | 403 | 404; grund: "anmeldung" | "gesperrt" | "unbekannt" | "nda" | "nachtrag"; text: string };
/**
 * Darf der Gast das Dokument öffnen? Reihenfolge mit Absicht: Ein fremdes, entferntes oder unsichtbares Dokument
 * ist „unbekannt“ (404) — der Gast erfährt nicht, dass es das gibt. Erst danach zählt die Vereinbarung.
 */
export function drZugriff(z: DrZugriffLage): DrZugriff {
  if (!z.angemeldet || z.gastRaumId == null) return { erlaubt: false, status: 401, grund: "anmeldung", text: "Bitte melden Sie sich mit Ihrem Einladungscode erneut an." };
  if (z.gastGesperrt || z.raumArchiviert) return { erlaubt: false, status: 403, grund: "gesperrt", text: "Ihr Zugang ist derzeit nicht freigeschaltet." };
  const d = z.dokument;
  if (!d || d.raumId !== z.gastRaumId || d.entfernt || !d.sichtbar || d.projektEntfernt) {
    return { erlaubt: false, status: 404, grund: "unbekannt", text: "Dieses Dokument gibt es hier nicht." };
  }
  if (!z.ndaProjektIds) return { erlaubt: false, status: 403, grund: "nda", text: "Bitte unterzeichnen Sie zuerst die Vertraulichkeitsvereinbarung." };
  if (!z.ndaProjektIds.includes(d.projektId)) return { erlaubt: false, status: 403, grund: "nachtrag", text: "Für dieses Thema ergänzen wir Ihre Vereinbarung — bitte bestätigen Sie die ergänzte Fassung im Datenraum." };
  return { erlaubt: true };
}

// ── Zeit (Europe/Berlin) ───────────────────────────────────────────────────
/** „09.11.2026“ */
export function drBerlinDatum(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
/** „9. November 2026 um 15:42 Uhr“ */
export function drBerlinZeitLang(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric" }).format(d);
  const u = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${t} um ${u} Uhr`;
}
/** Der Vermerk auf jeder ausgelieferten PDF-Seite. */
export function drVermerkText(name: string, d: Date): string {
  return `Vertraulich · ${String(name).replace(/\s+/g, " ").trim()} · ${drBerlinDatum(d)}`;
}
