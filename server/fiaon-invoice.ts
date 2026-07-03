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
  iban: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
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
  const base = process.env.FIAON_BASE_URL || "https://fiaon.de";
  return `${base}/api/fiaon/invoice/${encodeURIComponent(paymentReference)}.pdf?exp=${exp}&sig=${sig}`;
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

// ── PDF-Rendering ────────────────────────────────────────────────────────────
function eur(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return (Number.isFinite(v) ? v : 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";
}

/**
 * Zeichnet die Rechnung in ein pdfkit-Dokument. Erwartet eine fiaon_applications-Zeile
 * mit invoice_number, payment_reference, amount_due, payment_due_date etc.
 */
export function renderInvoicePdf(doc: PDFKit.PDFDocument, a: any): void {
  const M = 50;
  const W = doc.page.width - 2 * M;
  const invoiceDate = a.invoice_date ? new Date(a.invoice_date) : new Date();
  const dueDate = a.payment_due_date ? new Date(a.payment_due_date) : null;
  const customerName = [a.first_name, a.last_name].filter(Boolean).join(" ")
    || a.contact_name || a.company_name || "Kunde";
  const packName = a.pack_name ? String(a.pack_name).replace(/\n/g, " ") : "FIAON Zugang";
  const amount = a.amount_due != null ? parseFloat(String(a.amount_due)) : 0;

  // ── Kopf: FIAON Wortmarke links, Entity-Block rechts ──
  doc.font("Helvetica-Bold").fontSize(26).fillColor(CI.blue).text("FIAON", M, M);
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
    .text("SaaS- & E-Learning-Plattform", M, M + 30);

  const entityX = M + W - 220;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.dark).text(FIAON_ENTITY.name, entityX, M, { width: 220, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
    .text(FIAON_ENTITY.addressLine1, entityX, doc.y + 1, { width: 220, align: "right" })
    .text(`${FIAON_ENTITY.addressLine2}, ${FIAON_ENTITY.country}`, entityX, doc.y + 1, { width: 220, align: "right" })
    .text(`Company No. ${FIAON_ENTITY.companyNo}`, entityX, doc.y + 1, { width: 220, align: "right" })
    .text(FIAON_ENTITY.email, entityX, doc.y + 1, { width: 220, align: "right" });

  // Trennlinie
  doc.moveTo(M, 130).lineTo(M + W, 130).lineWidth(1.5).strokeColor(CI.blue).stroke();

  // ── Empfänger + Rechnungsmeta ──
  let y = 150;
  doc.font("Helvetica").fontSize(7.5).fillColor(CI.slate)
    .text(`${FIAON_ENTITY.name} · ${FIAON_ENTITY.addressLine1} · ${FIAON_ENTITY.addressLine2} · ${FIAON_ENTITY.country}`, M, y);
  y += 14;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.dark).text("Rechnungsempfänger", M, y);
  y += 14;
  doc.font("Helvetica").fontSize(10).fillColor(CI.dark).text(customerName, M, y);
  y += 13;
  if (a.street) { doc.text(`${a.street}`, M, y); y += 13; }
  if (a.zip || a.city) { doc.text(`${a.zip || ""} ${a.city || ""}`.trim(), M, y); y += 13; }
  if (a.email) { doc.fillColor(CI.slate).fontSize(9).text(a.email, M, y); y += 13; }

  const metaX = M + W - 240;
  let my = 150 + 14;
  const meta: Array<[string, string]> = [
    ["Rechnungsnummer", a.invoice_number || "—"],
    ["Rechnungsdatum", invoiceDate.toLocaleDateString("de-DE")],
    ["Zahlungsreferenz", a.payment_reference || "—"],
    ["Antrags-Nr.", a.ref || "—"],
  ];
  if (dueDate) meta.push(["Zahlungsziel", dueDate.toLocaleDateString("de-DE")]);
  for (const [label, value] of meta) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, metaX, my, { width: 110 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, metaX + 112, my, { width: 128, align: "right" });
    my += 15;
  }

  // ── Titel ──
  y = Math.max(y, my) + 28;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(CI.dark).text("Rechnung", M, y);
  y += 26;

  // ── Leistungstabelle ──
  const col1 = M, col2 = M + W - 110;
  doc.rect(M, y, W, 22).fillColor(CI.bgSoft).fill();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.slate)
    .text("Leistungsbeschreibung", col1 + 10, y + 7)
    .text("Betrag", col2, y + 7, { width: 100, align: "right" });
  y += 22;

  const description = `${packName} – Monatlicher Zugang zur FIAON SaaS- und E-Learning-Plattform (Software-Lizenz, KI-Profilanalyse, Lernmodule, Dashboard)`;
  const period = "Leistungszeitraum: 1 Monat ab Freischaltung des Zugangs";
  doc.font("Helvetica").fontSize(9.5).fillColor(CI.dark)
    .text(description, col1 + 10, y + 10, { width: W - 140 });
  const descBottom = doc.y;
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate).text(period, col1 + 10, descBottom + 4, { width: W - 140 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.dark)
    .text(eur(amount), col2, y + 10, { width: 100, align: "right" });
  y = Math.max(doc.y, descBottom) + 16;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  y += 10;

  // ── Summe + USt-Zeile (konfigurierbar) ──
  const vatMode = (process.env.INVOICE_VAT_MODE || "none").toLowerCase();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(CI.dark)
    .text("Gesamtbetrag", col1 + 10, y)
    .text(eur(amount), col2, y, { width: 100, align: "right" });
  y += 20;
  if (vatMode === "none") {
    doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
      .text("Gesamtbetrag ohne gesonderten Steuerausweis.", col1 + 10, y, { width: W - 20 });
    y = doc.y + 2;
    doc.text("Hinweis zur Umsatzsteuer: folgt nach steuerlicher Registrierung.", col1 + 10, y, { width: W - 20 });
    y = doc.y;
  }
  y += 24;

  // ── Zahlungsdaten-Block ──
  const payBoxH = 108;
  doc.roundedRect(M, y, W, payBoxH, 8).fillColor(CI.bgSoft).fill();
  doc.roundedRect(M, y, W, payBoxH, 8).lineWidth(1).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.blue).text("Zahlung per SEPA-Banküberweisung (Vorkasse)", M + 14, y + 12);
  const rows: Array<[string, string]> = [
    ["Empfänger", FIAON_BANK_DETAILS.recipient],
    ["IBAN", FIAON_BANK_DETAILS.iban],
    ["BIC", FIAON_BANK_DETAILS.bic],
    ["Verwendungszweck", a.payment_reference || "—"],
    ["Zahlungsziel", dueDate ? dueDate.toLocaleDateString("de-DE") : "—"],
  ];
  let py = y + 32;
  for (const [label, value] of rows) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, M + 14, py, { width: 120 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, M + 140, py);
    py += 14;
  }
  doc.font("Helvetica").fontSize(7.5).fillColor(CI.slate)
    .text("Bitte geben Sie den Verwendungszweck exakt an – nur so kann Ihre Zahlung automatisch zugeordnet werden.", M + 14, y + payBoxH - 14, { width: W - 28 });

  // ── Fußzeile ──
  const footY = doc.page.height - 64;
  doc.moveTo(M, footY - 8).lineTo(M + W, footY - 8).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(CI.slate)
    .text(`${FIAON_ENTITY.name} · ${FIAON_ENTITY.addressLine1} · ${FIAON_ENTITY.addressLine2} · ${FIAON_ENTITY.country}`, M, footY, { width: W, align: "center" })
    .text(FIAON_ENTITY.registeredFooter, M, footY + 11, { width: W, align: "center" })
    .text(`${FIAON_ENTITY.email} · fiaon.com`, M, footY + 22, { width: W, align: "center" });
}
