// ═══════════════════════════════════════════════════════════════════════════
// EINGANGSPRÜFUNG JEDER HOCHGELADENEN DATEI (E-IT-C, 08.10.2026, Punkt 13 A)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// · Der Typ wurde nach der Angabe des Browsers entschieden (fiaon-antrag.ts,
//   multer-fileFilter). HEIC, WEBP und PDFs mit abweichendem Mimetype flogen
//   raus; iPhone-Fotos bekamen den Rat „Drucken → Als PDF sichern" — genau der
//   erzeugt die übergroßen PDFs mit Fotos in voller Auflösung.
// · Eine PDF mit Öffnungspasswort wurde angenommen, die Seitenzahl war 0, die
//   Texterkennung schickte verschlüsselte Bytes an die KI („invalid_file"), und
//   der Kunde las „zu unscharf".
// · Der Mitarbeiterweg legte ein einzelnes Foto ROH als JPEG in die _pdf-Spalte
//   (7 Ausweise), mit GPS-Daten und ohne EXIF-Drehung.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Jede Datei geht vor dem Speichern hier durch, synchron und schnell:
//   1. Typ am INHALT (Magic Bytes). Die Angabe des Browsers zählt nie.
//   2. Fotos: HEIC/HEIF → JPEG (heic-convert, WASM), WEBP/TIFF/GIF/AVIF → JPEG
//      (sharp). Jedes Foto wird gedreht (EXIF), auf die längste Kante 2.400 px
//      verkleinert, als JPEG q82 gespeichert — OHNE Metadaten (GPS, Kamera).
//      Das Original wird nicht zusätzlich gespeichert (Entscheidung Justin 08.10.).
//   3. PDFs: öffnen (pdfjs). Öffnungspasswort → sofort abweisen, Klasse
//      'passwort'. Ladefehler → 'beschaedigt', 0 Seiten → 'leer'. Reiner
//      Rechteschutz (verschlüsselt, ohne Öffnungspasswort) wird ANGENOMMEN —
//      4 von 6 solchen Bankauszügen wurden bisher fertig gelesen. Zum Binden mit
//      anderen Dateien und für die KI entschlüsselt qpdf (WASM) nur diesen
//      Rechteschutz; Passwörter werden nie geraten.
//   4. Je Seite: Textschicht ja/nein → lese_befund (textseiten, fotoseiten).
// Fehler kommen als Klasse mit Satz aus shared/fiaon-lesefehler.ts zurück.
//
// Speicher: Bilder werden nacheinander gewandelt (eine Wandlung je Prozess zur
// Zeit) — heic-convert braucht für ein 12-MP-Foto ~250 MB Arbeitsspeicher.
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { UNTERLAGEN_GRENZEN, type DateiBefund } from "@shared/fiaon-unterlagen";
import type { LeseKlasse } from "@shared/fiaon-lesefehler";

const nodeRequire = createRequire(import.meta.url);

export type EingangsTyp = "pdf" | "jpg" | "png" | "heic" | "avif" | "webp" | "tiff" | "gif";

/** Der Typ am Inhalt — nie am Namen, nie an der Angabe des Browsers. */
export function typAmInhalt(b: Buffer | null | undefined): EingangsTyp | null {
  if (!b || b.length < 4) return null;
  // E-IT-C Nachbesserung: ERST die harten Signaturen an Byte 0 — ein Foto, dessen EXIF/XMP in den
  // ersten 1 KB zufällig „%PDF" enthält, wurde sonst als PDF behandelt und als „beschädigt" abgewiesen.
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b.subarray(4, 8).toString("latin1") === "ftyp") {
    const marke = b.subarray(8, 12).toString("latin1").toLowerCase();
    if (marke === "avif" || marke === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(marke)) return "heic";
  }
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.length >= 12 && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) return "tiff";
  if (b.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  // „%PDF" darf nach der Norm irgendwo in den ersten 1024 Bytes stehen.
  if (b.subarray(0, 1024).includes("%PDF", 0, "latin1")) return "pdf";
  return null;
}

export function sha256Hex(b: Buffer): string {
  return createHash("sha256").update(b).digest("hex");
}

/** Bilder nacheinander — eine Wandlung zur Zeit je Prozess (Arbeitsspeicher). */
let bildKette: Promise<unknown> = Promise.resolve();
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  const p = bildKette.then(f, f);
  bildKette = p.catch(() => undefined);
  return p;
}

/** HEIC/HEIF (iPhone) → JPEG. heic-convert ist reines WASM, ohne native Abhängigkeit. */
export async function heicZuJpeg(b: Buffer): Promise<Buffer> {
  const convert = nodeRequire("heic-convert");
  const aus = await convert({ buffer: b, format: "JPEG", quality: 0.92 });
  return Buffer.from(aus);
}

/**
 * Ein Foto für die Akte: nach EXIF gedreht, längste Kante höchstens 2.400 px,
 * JPEG q82, ohne Metadaten (sharp schreibt ohne `withMetadata()` keine).
 */
export async function bildNormalisieren(b: Buffer): Promise<{ buffer: Buffer; breite: number; hoehe: number }> {
  const sharp = (await import("sharp")).default;
  const kante = UNTERLAGEN_GRENZEN.bildKante;
  const { data, info } = await sharp(b, { failOn: "none", limitInputPixels: 120_000_000 })
    .rotate()
    .resize({ width: kante, height: kante, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: UNTERLAGEN_GRENZEN.jpegQualitaet })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, breite: info.width, hoehe: info.height };
}

// ───────────────────────────────────────────────────────────────────────────
// PDF: öffnen, Passwort erkennen, Seiten zählen, Textschicht je Seite
// ───────────────────────────────────────────────────────────────────────────

/** Rechteschutz oder Passwort? „/Encrypt" steht im Trailer (auch in einem Xref-Strom unkomprimiert). */
export function pdfVerschluesselt(b: Buffer): boolean {
  return b.includes("/Encrypt", 0, "latin1");
}

/** Unser eigener Vermerk auf gewandelten Fotos zählt nicht als Text (fiaon-bild-zu-pdf.ts). */
function ohneVermerk(t: string): string {
  return String(t || "").replace(/Vom Kunden als Bilddatei eingereicht \([^)]*\) · automatisch in PDF gewandelt/g, "");
}

export type PdfBefund =
  | { ok: true; seiten: number; textseiten: number; fotoseiten: number; geschuetzt: boolean }
  | { ok: false; klasse: Extract<LeseKlasse, "passwort" | "beschaedigt" | "leer">; detail: string };

/** Höchstens so viele Seiten werden auf Text abgeklopft — der Rest zählt wie die letzte. */
const SEITEN_ABKLOPFEN = 60;

export async function pdfPruefen(b: Buffer, zeitMs = 20_000): Promise<PdfBefund> {
  const mod: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  (mod.GlobalWorkerOptions as any).workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  const geschuetzt = pdfVerschluesselt(b);
  let doc: any;
  try {
    doc = await mod.getDocument({ data: new Uint8Array(b), useSystemFonts: true, disableFontFace: true, isEvalSupported: false, stopAtErrors: false }).promise;
  } catch (e: any) {
    const name = String(e?.name || "");
    if (name === "PasswordException" || /password/i.test(String(e?.message || ""))) return { ok: false, klasse: "passwort", detail: "Öffnungspasswort" };
    return { ok: false, klasse: "beschaedigt", detail: String(e?.message || e).slice(0, 160) };
  }
  try {
    const seiten = Number(doc.numPages) || 0;
    if (seiten <= 0) return { ok: false, klasse: "leer", detail: "0 Seiten" };
    let textseiten = 0;
    let geprueft = 0;
    const ende = Date.now() + zeitMs;
    for (let i = 1; i <= Math.min(seiten, SEITEN_ABKLOPFEN) && Date.now() < ende; i++) {
      try {
        const seite = await doc.getPage(i);
        const inhalt = await seite.getTextContent();
        const text = ohneVermerk((inhalt.items as any[]).map((s) => (typeof s?.str === "string" ? s.str : "")).join(" "));
        if (text.replace(/\s/g, "").length >= 40) textseiten++;
        seite.cleanup?.();
      } catch { /* eine kaputte Seite ist eine Fotoseite für uns */ }
      geprueft++;
    }
    // Nicht geprüfte Seiten (sehr lange Dateien) zählen im Verhältnis der geprüften.
    const anteil = geprueft ? textseiten / geprueft : 0;
    const text = geprueft >= seiten ? textseiten : Math.round(anteil * seiten);
    return { ok: true, seiten, textseiten: text, fotoseiten: Math.max(0, seiten - text), geschuetzt };
  } finally {
    await doc.destroy?.();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// qpdf (WASM): nur Rechteschutz lösen — nie ein Passwort raten
// ───────────────────────────────────────────────────────────────────────────
let qpdfModul: Promise<any> | null = null;
let qpdfZaehler = 0;
async function qpdf(): Promise<any> {
  if (!qpdfModul) {
    qpdfModul = (async () => {
      const mod = nodeRequire("@neslinesli93/qpdf-wasm");
      const erzeugen = mod.default || mod;
      const wasm = nodeRequire.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm");
      return erzeugen({ locateFile: () => wasm, noInitialRun: true });
    })().catch((e) => { qpdfModul = null; throw e; });
  }
  return qpdfModul;
}

/**
 * Entfernt den reinen Rechteschutz einer Bank-PDF (verschlüsselt mit leerem
 * Öffnungspasswort). Eine Datei mit Öffnungspasswort bleibt, wie sie ist (null).
 * Ohne /Encrypt kommt die Datei unverändert zurück.
 */
export async function pdfEntschluesseln(b: Buffer): Promise<Buffer | null> {
  if (!pdfVerschluesselt(b)) return b;
  let q: any;
  try { q = await qpdf(); } catch (e) {
    console.error("[DATEI-EINGANG] qpdf nicht verfügbar:", String((e as Error)?.message || e).slice(0, 160));
    return null;
  }
  const nr = ++qpdfZaehler;
  const ein = `/ein-${nr}.pdf`; const aus = `/aus-${nr}.pdf`;
  // qpdf ist ein Kommandozeilenprogramm: callMain setzt process.exitCode — danach zurücksetzen,
  // sonst endete der Server nach einer Warnung (Rückgabe 3) beim nächsten Neustart mit Fehlercode.
  const vorher = process.exitCode;
  try {
    q.FS.writeFile(ein, new Uint8Array(b));
    const rc = q.callMain(["--decrypt", ein, aus]);
    if (rc !== 0 && rc !== 3) return null;
    const ergebnis = Buffer.from(q.FS.readFile(aus));
    return ergebnis.length && !pdfVerschluesselt(ergebnis) ? ergebnis : null;
  } catch {
    return null;
  } finally {
    process.exitCode = vorher;
    try { q.FS.unlink(ein); } catch { /* schon weg */ }
    try { q.FS.unlink(aus); } catch { /* nie entstanden */ }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Der eine Einstieg
// ───────────────────────────────────────────────────────────────────────────
export interface EingangsDatei {
  buffer: Buffer;
  mime: "application/pdf" | "image/jpeg" | "image/png";
  typ: "pdf" | "jpg" | "png";
  name: string;
  seiten: number;
  befund: DateiBefund;
}

export type EingangsErgebnis =
  | { ok: true; datei: EingangsDatei }
  | { ok: false; klasse: LeseKlasse; detail: string | null; name: string };

/** Ein Dateiname, der in Kopfzeilen und Listen nichts anrichtet; Endung passend zum Inhalt. */
export function dateinameSauber(roh: string | null | undefined, endung: string): string {
  const basis = String(roh || "datei").split(/[\\/]/).pop() || "datei";
  const ohne = basis.replace(/[\u0000-\u001f\u007f"<>|*?]/g, "").replace(/\.[A-Za-z0-9]{1,5}$/, "").trim().slice(0, 100) || "datei";
  return `${ohne}.${endung}`;
}

export async function dateiEingang(roh: Buffer, nameRoh: string | null | undefined): Promise<EingangsErgebnis> {
  const name = String(nameRoh || "Datei").split(/[\\/]/).pop()!.slice(0, 120);
  if (!roh?.length) return { ok: false, klasse: "leer", detail: "0 Byte", name };
  if (roh.length > UNTERLAGEN_GRENZEN.bytesJeDatei) return { ok: false, klasse: "zu_gross", detail: `${Math.round(roh.length / 1024 / 1024)} MB`, name };
  const typ = typAmInhalt(roh);
  if (!typ) return { ok: false, klasse: "format", detail: `Kopf ${roh.subarray(0, 4).toString("hex")}`, name };

  if (typ === "pdf") {
    let pr: PdfBefund;
    try { pr = await pdfPruefen(roh); } catch (e) {
      return { ok: false, klasse: "beschaedigt", detail: String((e as Error)?.message || e).slice(0, 160), name };
    }
    if (!pr.ok) return { ok: false, klasse: pr.klasse, detail: pr.detail, name };
    return {
      ok: true,
      datei: {
        buffer: roh, mime: "application/pdf", typ: "pdf", name: dateinameSauber(name, "pdf"), seiten: pr.seiten,
        befund: { typ: "pdf", seiten: pr.seiten, textseiten: pr.textseiten, fotoseiten: pr.fotoseiten, geschuetzt: pr.geschuetzt },
      },
    };
  }

  // Fotos: wandeln (falls nötig), drehen, verkleinern, Metadaten weg — nacheinander.
  try {
    return await nacheinander(async () => {
      let quelle = roh;
      if (typ === "heic") quelle = await heicZuJpeg(roh);
      const n = await bildNormalisieren(quelle);
      return {
        ok: true as const,
        datei: {
          buffer: n.buffer, mime: "image/jpeg" as const, typ: "jpg" as const, name: dateinameSauber(name, "jpg"), seiten: 1,
          befund: {
            typ: "jpg" as const, ausTyp: typ === "jpg" ? null : typ, seiten: 1, textseiten: 0, fotoseiten: 1, geschuetzt: false,
            verkleinert: { vonKb: Math.max(1, Math.round(roh.length / 1024)), aufKb: Math.max(1, Math.round(n.buffer.length / 1024)) },
          },
        },
      };
    });
  } catch (e) {
    console.warn(`[DATEI-EINGANG] Bild ${typ} nicht lesbar:`, String((e as Error)?.message || e).slice(0, 160));
    return { ok: false, klasse: "beschaedigt", detail: `${typ}: ${String((e as Error)?.message || e).slice(0, 120)}`, name };
  }
}
