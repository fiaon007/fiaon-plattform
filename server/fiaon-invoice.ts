// ═══════════════════════════════════════════════════════════════════
// FIAON Rechnungssystem (Vorkasse per Banküberweisung)
// - Lückenloser Nummernkreis FIAON-INV-<Jahr>-00001 (Counter-Tabelle, atomar)
// - PDF-Rendering im FIAON-CI (pdfkit), bankrechnungs-sauber, keine Marketing-Elemente
// - Signierte, ablaufende Download-Links für E-Mail-Anhänge (Make: invoice_url)
// TAX REVIEW REQUIRED: Non-Union OSS Registrierung ausstehend – USt-Behandlung
// vor Massenversand mit Steuerberater festlegen. NIEMALS 19% ausweisen,
// solange keine Registrierung vorliegt (INVOICE_VAT_MODE, Default "none").
// ═══════════════════════════════════════════════════════════════════

import { createHmac } from "crypto";
import { absoluteUrl } from "./fiaon-base-url";
import { BANK } from "@shared/fiaon-bank";
import type PDFKit from "pdfkit";

export const FIAON_ENTITY = {
  name: "FIAON LTD",
  addressLine1: "128 City Road",
  addressLine2: "London, EC1V 2NX",
  country: "United Kingdom",
  companyNo: "17318250",
  director: "Justin Schwarzott",
  email: "support@fiaon.com",
  registeredFooter: "Registered in England and Wales, Companies House No. 17318250 · Director: Justin Schwarzott",
};

export const FIAON_BANK_DETAILS = {
  recipient: "FIAON LTD",
  iban: BANK.ibanDisplay,   // 02.09.2026: Wise gesperrt → shared/fiaon-bank.ts
  bic: BANK.bic,
};

const CI = {
  blue: "#2563eb",
  dark: "#0f172a",
  slate: "#64748b",
  lightLine: "#e2e8f0",
  bgSoft: "#f8fafc",
};

function invoiceSecret(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

// ── Signierte Download-Links (öffentlich nicht erratbar, mit Ablauf) ─────────
export function signInvoiceUrl(paymentReference: string, ttlMs = 72 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", invoiceSecret()).update(`${paymentReference}.${exp}`).digest("hex").slice(0, 32);
  return absoluteUrl(`/api/fiaon/invoice/${encodeURIComponent(paymentReference)}.pdf?exp=${exp}&sig=${sig}`);
}

export function verifyInvoiceSig(paymentReference: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!expNum || expNum < Date.now()) return false;
  const expected = createHmac("sha256", invoiceSecret()).update(`${paymentReference}.${expNum}`).digest("hex").slice(0, 32);
  return expected === sig;
}

// ── Lückenloser Nummernkreis (Counter-Tabelle, atomares UPDATE) ──────────────
let countersEnsured = false;
export async function ensureInvoiceTables(sqlPool: any): Promise<void> {
  if (countersEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_counters (
      name VARCHAR PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    )
  `;
  countersEnsured = true;
}

/**
 * Weist einem Antrag genau einmal eine fortlaufende, lückenlose Rechnungsnummer zu
 * (beim Übergang zu pending_payment). Idempotent: bestehende Nummer wird zurückgegeben.
 */
export async function ensureInvoiceNumber(sqlPool: any, ref: string): Promise<string | null> {
  await ensureInvoiceTables(sqlPool);
  const existing = await sqlPool`SELECT invoice_number FROM fiaon_applications WHERE ref = ${ref}`;
  if (existing.length === 0) return null;
  if (existing[0].invoice_number) return existing[0].invoice_number;

  const year = new Date().getFullYear();
  const counterName = `invoice-${year}`;
  await sqlPool`
    INSERT INTO fiaon_counters (name, value) VALUES (${counterName}, 0)
    ON CONFLICT (name) DO NOTHING
  `;
  const bumped = await sqlPool`
    UPDATE fiaon_counters SET value = value + 1 WHERE name = ${counterName} RETURNING value
  `;
  const invoiceNumber = `FIAON-INV-${year}-${String(bumped[0].value).padStart(5, "0")}`;
  // Nur setzen, wenn noch keine Nummer existiert (Schutz gegen parallele Aufrufe)
  const claimed = await sqlPool`
    UPDATE fiaon_applications
    SET invoice_number = ${invoiceNumber}, invoice_date = NOW()
    WHERE ref = ${ref} AND invoice_number IS NULL
    RETURNING invoice_number
  `;
  if (claimed.length > 0) {
    console.log(`[FIAON-INVOICE] Rechnungsnummer vergeben: ${invoiceNumber} (ref=${ref})`);
    return invoiceNumber;
  }
  const again = await sqlPool`SELECT invoice_number FROM fiaon_applications WHERE ref = ${ref}`;
  return again[0]?.invoice_number || null;
}

// ── PDF-Rendering (Paket AF: formatfest für kurze UND lange Namen/Pakete) ────
function eur(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return (Number.isFinite(v) ? v : 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** IBAN in Vierergruppen (unabhängig von der Eingabe-Formatierung). */
function groupIban(iban: string): string {
  return String(iban).replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Zeichnet die Rechnung in ein pdfkit-Dokument. Erwartet eine fiaon_applications-Zeile
 * mit invoice_number, payment_reference, amount_due, payment_due_date etc.
 */
export function renderInvoicePdf(doc: PDFKit.PDFDocument, a: any): void {
  // Paket AF: Ränder ≥ 20 mm (A4: 1 mm ≈ 2.835 pt → 57 pt), feste Spaltengrenzen,
  // KEINE Überlappungen — Empfängerblock und Meta-Block haben harte Breiten,
  // alle dynamischen Höhen werden gemessen statt geraten.
  //
  // WICHTIG (Fix „leere Seiten"): pdfkit fügt automatisch eine neue Seite an,
  // sobald Text unterhalb des unteren Seitenrands (page.margins.bottom) gezeichnet
  // wird — genau das löste die Fußzeile (bei page.height − 52) aus und erzeugte 1–2
  // leere Folgeseiten. Da wir ALLES absolut positionieren, deaktivieren wir die
  // Seitenränder komplett → kein Auto-Umbruch, garantiert genau EINE Seite.
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  const M = 57;                       // 20 mm
  const W = doc.page.width - 2 * M;   // Nutzbreite
  const invoiceDate = a.invoice_date ? new Date(a.invoice_date) : new Date();
  const dueDate = a.payment_due_date ? new Date(a.payment_due_date) : null;
  const customerName = [a.first_name, a.last_name].filter(Boolean).join(" ")
    || a.contact_name || a.company_name || "Kunde";
  const packName = a.pack_name ? String(a.pack_name).replace(/\n/g, " ") : "FIAON Zugang";
  const amount = a.amount_due != null ? parseFloat(String(a.amount_due)) : 0;

  // ── Kopf: FIAON Wortmarke links, Entity-Block rechtsbündig ──
  doc.font("Helvetica-Bold").fontSize(24).fillColor(CI.blue).text("FIAON", M, M);
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
    .text("SaaS- & E-Learning-Plattform", M, M + 28);

  const entityW = 210;
  const entityX = M + W - entityW;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.dark).text(FIAON_ENTITY.name, entityX, M, { width: entityW, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
    .text(FIAON_ENTITY.addressLine1, entityX, doc.y + 1, { width: entityW, align: "right" })
    .text(`${FIAON_ENTITY.addressLine2}, ${FIAON_ENTITY.country}`, entityX, doc.y + 1, { width: entityW, align: "right" })
    .text(`Company No. ${FIAON_ENTITY.companyNo}`, entityX, doc.y + 1, { width: entityW, align: "right" })
    .text(FIAON_ENTITY.email, entityX, doc.y + 1, { width: entityW, align: "right" });

  // Trennlinie unter dem Kopf
  const headBottom = Math.max(M + 44, doc.y + 8);
  doc.moveTo(M, headBottom).lineTo(M + W, headBottom).lineWidth(1.2).strokeColor(CI.blue).stroke();

  // ── Empfängerblock (Fensterkuvert-Bereich, links) + Rechnungsmeta (rechts) ──
  // Harte Spaltengrenze: Empfänger max. W-260 breit, Meta fix 240 — NIE überlappend.
  const metaW = 240;
  const metaX = M + W - metaW;
  const addrW = W - metaW - 20;
  let y = headBottom + 18;

  // Absenderzeile (klein, Fensterkuvert-Konvention)
  doc.font("Helvetica").fontSize(7).fillColor(CI.slate)
    .text(`${FIAON_ENTITY.name} · ${FIAON_ENTITY.addressLine1} · ${FIAON_ENTITY.addressLine2} · ${FIAON_ENTITY.country}`, M, y, { width: addrW });
  let ay = doc.y + 8;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.dark).text("Rechnungsempfänger", M, ay, { width: addrW });
  ay = doc.y + 3;
  doc.font("Helvetica").fontSize(10).fillColor(CI.dark).text(customerName, M, ay, { width: addrW });
  ay = doc.y + 1;
  if (a.street) { doc.text(String(a.street), M, ay, { width: addrW }); ay = doc.y + 1; }
  if (a.zip || a.city) { doc.text(`${a.zip || ""} ${a.city || ""}`.trim(), M, ay, { width: addrW }); ay = doc.y + 1; }
  if (a.email) { doc.fillColor(CI.slate).fontSize(8.5).text(String(a.email), M, ay, { width: addrW }); ay = doc.y + 1; }
  const addrBottom = doc.y;

  // Rechnungsmeta rechtsbündig als Block (Label links, Wert rechts)
  let my = y;
  const meta: Array<[string, string]> = [
    ["Rechnungsnummer", a.invoice_number || "—"],
    ["Rechnungsdatum", deDate(invoiceDate)],
    ["Zahlungsreferenz", a.payment_reference || "—"],
    ["Antrags-Nr.", a.ref || "—"],
  ];
  if (dueDate) meta.push(["Zahlungsziel", deDate(dueDate)]);
  for (const [label, value] of meta) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, metaX, my, { width: 108, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, metaX + 110, my, { width: metaW - 110, align: "right", lineBreak: false });
    my += 15;
  }

  // ── Titel ──
  y = Math.max(addrBottom, my) + 26;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(CI.dark).text("Rechnung", M, y);
  y += 26;

  // ── Positionstabelle: Beschreibung | Zeitraum | Betrag (Beträge RECHTSBÜNDIG) ──
  const amountW = 90;
  const periodW = 120;
  const descX = M + 10;
  const descW = W - amountW - periodW - 40;
  const periodX = M + 10 + descW + 10;
  const amountX = M + W - amountW - 10;

  doc.rect(M, y, W, 22).fillColor(CI.bgSoft).fill();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.slate)
    .text("Beschreibung", descX, y + 7, { width: descW, lineBreak: false })
    .text("Zeitraum", periodX, y + 7, { width: periodW, lineBreak: false })
    .text("Betrag", amountX, y + 7, { width: amountW, align: "right", lineBreak: false });
  y += 22;

  const description = `${packName} — monatlicher Zugang zur FIAON SaaS- und E-Learning-Plattform (Software-Lizenz, KI-Profilanalyse, Lernmodule, Dashboard)`;
  const rowTop = y + 10;
  doc.font("Helvetica").fontSize(9.5).fillColor(CI.dark)
    .text(description, descX, rowTop, { width: descW });
  const descBottom = doc.y;
  doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate)
    .text("1 Monat ab Freischaltung des Zugangs", periodX, rowTop, { width: periodW });
  const periodBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.dark)
    .text(eur(amount), amountX, rowTop, { width: amountW, align: "right", lineBreak: false });
  y = Math.max(descBottom, periodBottom) + 12;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  y += 12;

  // ── Summenblock rechts (Gesamtbetrag fett) + USt-Hinweis ──
  const vatMode = (process.env.INVOICE_VAT_MODE || "none").toLowerCase();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(CI.dark)
    .text("Gesamtbetrag", metaX, y, { width: 110, lineBreak: false })
    .text(eur(amount), metaX + 110, y, { width: metaW - 110, align: "right", lineBreak: false });
  y += 20;
  if (vatMode === "none") {
    doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
      .text("Gesamtbetrag ohne gesonderten Steuerausweis. Hinweis zur Umsatzsteuer: folgt nach steuerlicher Registrierung.", M, y, { width: W, align: "right" });
    y = doc.y;
  }
  y += 22;

  // ── Zahlungsdaten-Block (dynamische Höhe — Hinweiszeile kollidiert NIE) ──
  const payRows: Array<[string, string]> = [
    ["Empfänger", FIAON_BANK_DETAILS.recipient],
    ["IBAN", groupIban(FIAON_BANK_DETAILS.iban)],
    ["BIC", FIAON_BANK_DETAILS.bic],
    ["Verwendungszweck", a.payment_reference || "—"],
    ["Zahlungsziel", dueDate ? deDate(dueDate) : "—"],
  ];
  const payBoxH = 12 + 20 + payRows.length * 14 + 18; // Titel + Zeilen + Hinweis
  doc.roundedRect(M, y, W, payBoxH, 8).fillColor(CI.bgSoft).fill();
  doc.roundedRect(M, y, W, payBoxH, 8).lineWidth(1).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.blue).text("Zahlung per SEPA-Banküberweisung (Vorkasse)", M + 14, y + 12, { width: W - 28, lineBreak: false });
  let py = y + 32;
  for (const [label, value] of payRows) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, M + 14, py, { width: 120, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, M + 140, py, { width: W - 154, lineBreak: false });
    py += 14;
  }
  doc.font("Helvetica").fontSize(7.5).fillColor(CI.slate)
    .text("Bitte geben Sie den Verwendungszweck exakt an – nur so kann Ihre Zahlung automatisch zugeordnet werden.", M + 14, py + 4, { width: W - 28, lineBreak: false });

  // ── Fußzeile: einzeilig sauber + Seitenzahl bei Mehrseitigkeit ──
  const range = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
  const pageCount = Math.max(1, range.count);
  const footY = doc.page.height - 52;
  doc.moveTo(M, footY - 8).lineTo(M + W, footY - 8).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica").fontSize(7).fillColor(CI.slate)
    .text(`${FIAON_ENTITY.name} · Companies House No. ${FIAON_ENTITY.companyNo} · Registered Office: ${FIAON_ENTITY.addressLine1}, ${FIAON_ENTITY.addressLine2} (UK) · Director: ${FIAON_ENTITY.director}`, M, footY, { width: W, align: "center", lineBreak: false })
    .text(`${FIAON_ENTITY.email} · fiaon.com${pageCount > 1 ? ` · Seite ${range.start + 1} von ${pageCount}` : ""}`, M, footY + 10, { width: W, align: "center", lineBreak: false });
}
