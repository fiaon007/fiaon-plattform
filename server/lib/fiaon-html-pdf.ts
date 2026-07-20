// ─────────────────────────────────────────────────────────────────────────────
// FIAON — Dokument-PDF, revisionssicher & im FIAON-CI.
//
// Primär: HTML → PDF via Playwright/Chromium (pixelgenaue CI). Playwright wird
// LAZY geladen (dynamischer Import), damit der Server auch startet, wenn Paket
// oder Browser in Produktion fehlen.
// Fallback: pdfkit (immer verfügbar, kein Browser) — erzeugt ein sauberes,
// gültiges PDF aus demselben Inhalt, falls Chromium nicht startbar ist. So wird
// IMMER ein PDF erzeugt.
//
// Manipulationsschutz: Jedes fertige Dokument trägt einen SHA-256-Hash über den
// gerenderten Inhalt + die harten Metadaten (Signatur, Zeit, IP, Version).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import PDFDocument from "pdfkit";

type Browser = any;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // In node_modules abgelegte Browser (Build mit PLAYWRIGHT_BROWSERS_PATH=0)
    // finden — sonst greift die Standard-Auflösung (~/.cache/ms-playwright).
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    })();
    // Fällt der Browser weg (Crash/kein Browser), Promise zurücksetzen.
    browserPromise.then((b) => b.on("disconnected", () => { browserPromise = null; })).catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

/** Rendert vollständiges HTML (A4) zu einem PDF-Buffer. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** SHA-256-Hash (hex) über beliebigen String — Dokument-Fingerabdruck. */
export function docHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** HTML-Escaping für Variablenwerte, die in Text eingesetzt werden. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FIAON_ACCENT = "#2563eb";
const FIAON_FOOTER = "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom";

/**
 * Umschließt einen Dokument-Body mit dem FIAON-CI (Wortmarke, Typografie,
 * Kopf-/Fußzeile). `subtitle` erscheint klein unter der Wortmarke,
 * `documentTitle` als große Überschrift. `watermark` (z. B. „DRAFT") wird
 * dezent diagonal hinterlegt.
 */
export function wrapFiaonDocument(opts: {
  documentTitle: string;
  subtitle?: string;
  bodyHtml: string;
  watermark?: string | null;
}): string {
  const { documentTitle, subtitle, bodyHtml, watermark } = opts;
  const watermarkHtml = watermark
    ? `<div class="watermark">${escapeHtml(watermark)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #0f172a;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .wordmark { font-size: 20pt; font-weight: 800; letter-spacing: -0.02em; color: ${FIAON_ACCENT}; }
  .brandline { font-size: 8pt; color: #64748b; margin-top: 2px; letter-spacing: .02em; }
  header.doc { border-bottom: 2px solid ${FIAON_ACCENT}; padding-bottom: 10px; margin-bottom: 18px; }
  h1.doc-title { font-size: 15pt; font-weight: 800; margin: 18px 0 2px; color: #0f172a; }
  .doc-subtitle { font-size: 9.5pt; color: #475569; margin: 0 0 14px; }
  h2 { font-size: 11pt; font-weight: 700; margin: 16px 0 6px; color: #0f172a; }
  p { margin: 0 0 8px; text-align: justify; }
  .clause { margin: 0 0 6px; }
  .muted { color: #64748b; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin: 10px 0; background: #f8fafc; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 8pt; letter-spacing: .04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.negative td { color: #b91c1c; }
  tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; }
  .sig-grid { display: flex; gap: 28px; margin-top: 26px; }
  .sig-col { flex: 1; }
  .sig-line { border-top: 1px solid #0f172a; margin-top: 34px; padding-top: 4px; font-size: 8.5pt; color: #475569; }
  .sig-img { max-height: 70px; max-width: 240px; }
  .meta { font-size: 8pt; color: #64748b; margin-top: 4px; }
  footer.doc { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7.5pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 5px; }
  .hash { font-family: "Courier New", monospace; font-size: 7pt; word-break: break-all; color: #94a3b8; }
  .watermark {
    position: fixed; top: 42%; left: 0; right: 0; text-align: center;
    font-size: 90pt; font-weight: 900; color: rgba(37,99,235,.06);
    transform: rotate(-24deg); letter-spacing: .05em; z-index: 0; pointer-events: none;
  }
  .content { position: relative; z-index: 1; }
</style>
</head>
<body>
  ${watermarkHtml}
  <div class="content">
    <header class="doc">
      <div class="wordmark">FIAON</div>
      <div class="brandline">FIAON LTD · Company No. 17318250 · London, United Kingdom</div>
    </header>
    <h1 class="doc-title">${escapeHtml(documentTitle)}</h1>
    ${subtitle ? `<p class="doc-subtitle">${escapeHtml(subtitle)}</p>` : ""}
    ${bodyHtml}
  </div>
  <footer class="doc">${FIAON_FOOTER}</footer>
</body>
</html>`;
}

// ── Öffentliche API: erzeugt IMMER ein PDF (Playwright, sonst pdfkit) ─────────
export interface DocumentPdfOptions {
  documentTitle: string;
  subtitle?: string;
  bodyHtml: string;
  watermark?: string | null;
}

/**
 * Rendert ein FIAON-Dokument als PDF. Versucht zuerst Playwright/Chromium
 * (pixelgenaue CI); ist der Browser nicht verfügbar/startbar, wird automatisch
 * der pdfkit-Fallback genutzt, sodass immer ein gültiges PDF entsteht.
 */
export async function renderDocumentPdf(opts: DocumentPdfOptions): Promise<Buffer> {
  try {
    return await htmlToPdf(wrapFiaonDocument(opts));
  } catch (e) {
    console.warn(`[FIAON-PDF] Playwright nicht verfügbar — pdfkit-Fallback: ${(e as Error)?.message || e}`);
    return await renderPdfKitFallback(opts);
  }
}

// ── pdfkit-Fallback: HTML-Body → einfaches, sauberes Text-PDF ─────────────────
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—",
  hellip: "…", euro: "€", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö",
  Uuml: "Ü", szlig: "ß", middot: "·", times: "×", eacute: "é", agrave: "à",
};
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z0-9#]+);/g, (_m, name) => (ENTITIES[name] != null ? ENTITIES[name] : _m));
}

interface Block { kind: "h1" | "h2" | "p" | "row"; text: string; }

function htmlToBlocks(html: string): Block[] {
  let s = html;
  s = s.replace(/<img[^>]*>/gi, "[electronic signature on file]");
  s = s.replace(/<tr[^>]*>/gi, "\n[[ROW]]").replace(/<\/tr>/gi, "");
  s = s.replace(/<(td|th)[^>]*>/gi, "").replace(/<\/(td|th)>/gi, " \u00b7 ");
  s = s.replace(/<h1[^>]*>/gi, "\n[[H1]]").replace(/<\/h1>/gi, "\n");
  s = s.replace(/<h[2-6][^>]*>/gi, "\n[[H2]]").replace(/<\/h[2-6]>/gi, "\n");
  s = s.replace(/<(p|div|li|section|tfoot|thead|tbody|table)[^>]*>/gi, "\n").replace(/<\/(p|div|li|section)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  const out: Block[] = [];
  for (let raw of s.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (line.startsWith("[[H1]]")) out.push({ kind: "h1", text: line.slice(6).trim() });
    else if (line.startsWith("[[H2]]")) out.push({ kind: "h2", text: line.slice(6).trim() });
    else if (line.startsWith("[[ROW]]")) out.push({ kind: "row", text: line.slice(7).trim() });
    else out.push({ kind: "p", text: line });
  }
  return out;
}

function renderPdfKitFallback(opts: DocumentPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: 56, bottom: 70, left: 56, right: 56 } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Kopf: Wortmarke + Markenzeile + Trennlinie
      doc.fillColor(FIAON_ACCENT).font("Helvetica-Bold").fontSize(20).text("FIAON");
      doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("FIAON LTD · Company No. 17318250 · London, United Kingdom");
      doc.moveDown(0.4);
      const y = doc.y;
      doc.moveTo(56, y).lineTo(539, y).lineWidth(1.5).strokeColor(FIAON_ACCENT).stroke();
      doc.moveDown(0.8);

      // Titel + Untertitel
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(15).text(opts.documentTitle);
      if (opts.subtitle) doc.fillColor("#475569").font("Helvetica").fontSize(9.5).text(opts.subtitle);
      if (opts.watermark) doc.moveDown(0.2).fillColor("#b91c1c").font("Helvetica-Bold").fontSize(10).text(`— ${opts.watermark} —`);
      doc.moveDown(0.6);

      for (const b of htmlToBlocks(opts.bodyHtml)) {
        if (b.kind === "h1") {
          doc.moveDown(0.5).fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text(b.text);
          doc.moveDown(0.2);
        } else if (b.kind === "h2") {
          doc.moveDown(0.4).fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(b.text);
          doc.moveDown(0.15);
        } else if (b.kind === "row") {
          doc.fillColor("#334155").font("Helvetica").fontSize(9).text(b.text);
        } else {
          doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(b.text, { align: "justify" });
          doc.moveDown(0.25);
        }
      }

      // Fußzeile auf jeder Seite
      const range = doc.bufferedPageRange?.() || { start: 0, count: 1 };
      for (let i = range.start; i < range.start + range.count; i++) {
        try {
          doc.switchToPage(i);
          doc.fillColor("#94a3b8").font("Helvetica").fontSize(7.5)
            .text(FIAON_FOOTER, 56, 782, { width: 483, align: "center" });
        } catch { /* Seite evtl. nicht adressierbar */ }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export { FIAON_FOOTER };
