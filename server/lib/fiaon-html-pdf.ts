// ─────────────────────────────────────────────────────────────────────────────
// FIAON — HTML → PDF (Playwright/Chromium), revisionssicher & im FIAON-CI.
//
// Verträge und Provisions-Abrechnungen werden serverseitig aus HTML gerendert,
// damit die CI (Wortmarke FIAON, saubere Typografie, Fußzeile FIAON LTD) exakt
// stimmt. Ein einzelner Chromium-Prozess wird lazy gestartet und wiederverwendet.
//
// Manipulationsschutz: Jedes fertige Dokument trägt einen SHA-256-Hash über den
// gerenderten Inhalt + die harten Metadaten (Signatur, Zeit, IP, Version).
// ─────────────────────────────────────────────────────────────────────────────

import { chromium, type Browser } from "playwright";
import { createHash } from "crypto";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    // Fällt der Browser weg (Crash), Promise zurücksetzen, damit neu gestartet wird.
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

export { FIAON_FOOTER };
