// ═══════════════════════════════════════════════════════════════════
// FIAON Rechnungssystem (Vorkasse per Banküberweisung)
// - Lückenloser Nummernkreis FIAON-INV-<Jahr>-00001 (Counter-Tabelle, atomar)
// - PDF-Rendering im FIAON-CI (pdfkit), bankrechnungs-sauber, keine Marketing-Elemente
// - Signierte, ablaufende Download-Links für E-Mail-Anhänge (Make: invoice_url)
// TAX REVIEW REQUIRED: Non-Union OSS Registrierung ausstehend – USt-Behandlung
// vor Massenversand mit Steuerberater festlegen. NIEMALS 19% ausweisen,
// solange keine Registrierung vorliegt (INVOICE_VAT_MODE, Default "none").
//
// ── FIRMENKUNDEN: FIAON GLOBAL (17.09.2026, E-188) ─────────────────
// Eine Rechnung über 2.499 bis 35.999 € an eine GmbH braucht die Firma als
// Empfänger, ihre Anschrift und ihre USt-IdNr. — und einen Satz zur
// Umsatzsteuer, der nicht „folgt nach Registrierung" heißt. Erkannt wird der
// Firmenkunde am KATALOG (Paket der Art "global"), nicht am Aufrufer: Alle
// fünf Stellen, die diese Rechnung zeichnen (Kunde, Betreuer, Verwaltung,
// ZIP-Export, Mail-Anhang), liefern so dieselbe Rechnung.
// Der USt-Modus steht AN DER BESTELLUNG (fiaon_applications.rechnung_ust_modus)
// und wird beim Auftrag eingefroren — eine Rechnung darf sich nicht ändern,
// weil später jemand einen Schalter umlegt. Werte:
//   none            ohne gesonderten Steuerausweis (Vorgabe, bis der
//                   Steuerberater entschieden hat)
//   reverse_charge  Netto, Hinweis auf die Steuerschuldnerschaft des
//                   Leistungsempfängers; nur MIT USt-IdNr. des Kunden
// Auch hier gilt: NIEMALS selbst 19 % ausweisen.
// Privatkunden-Rechnungen laufen durch keinen der neuen Zweige.
//
// ── ENGLISCHE ZWEITZEILE (17.09.2026, E-188, Querschnitt) ───────────
// Wer seinen Auftrag auf /en/business/start geführt hat, bekam Vertrag, Mail
// und Zahlungsseite englisch — und eine rein deutsche Rechnung. Die Rechnung
// BLEIBT deutsch (ein Beleg, eine Sprache für die Buchhaltung); für diese
// Aufträge trägt aber jeder Kopfbegriff eine kleine englische Zweitzeile
// („Rechnungsnummer / Invoice no."), dazu Beschreibung, Steuersatz und
// Zahlungshinweis in einem zweiten, englischen Satz. Gesteuert über
// `rechnung_sprache = "en"` an der Zeile; gesetzt von rechnungsSpracheSetzen()
// aus der Auftragsakte (fiaon_global_auftraege.vertrag_sprache) — an allen
// fünf Zeichenstellen, damit es dieselbe Rechnung bleibt. Ohne das Feld ist
// jede Rechnung Byte für Byte, wie sie war (Zeilenhöhen, Kastenhöhen, Texte).
// ═══════════════════════════════════════════════════════════════════

import { createHmac } from "crypto";
import { absoluteUrl } from "./fiaon-base-url";
import { BANK } from "@shared/fiaon-bank";
import { istGlobalPaket } from "@shared/fiaon-pakete";
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
  recipient: BANK.empfaenger,
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

export type B2bUstModus = "none" | "reverse_charge";

/** Der wirksame USt-Modus einer Firmenrechnung: Reverse Charge nur MIT USt-IdNr. des Kunden. */
export function b2bUstModus(a: { rechnung_ust_modus?: unknown; tax_id?: unknown }): B2bUstModus {
  return String(a?.rechnung_ust_modus || "") === "reverse_charge" && String(a?.tax_id || "").trim() ? "reverse_charge" : "none";
}

const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

/**
 * Die Sprache der Rechnung an die Zeile hängen — NUR für Aufträge über FIAON Global, deren Auftrag
 * englisch geführt wurde. Fehlt die Akte oder die Tabelle, bleibt die Rechnung deutsch: Eine Rechnung
 * darf an dieser Frage nie scheitern.
 */
export async function rechnungsSpracheSetzen(sqlPool: any, a: any): Promise<void> {
  if (!a || a.rechnung_sprache || !istGlobalPaket(a.pack_key) || !a.ref) return;
  try {
    const [g] = await sqlPool`SELECT vertrag_sprache FROM fiaon_global_auftraege WHERE ref = ${a.ref} LIMIT 1`;
    if (String(g?.vertrag_sprache ?? "").trim().toLowerCase() === "en") a.rechnung_sprache = "en";
  } catch { /* keine Akte, keine Tabelle → deutsch */ }
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
  // E-188: Firmenkunde = Paket der Art "global" (siehe Kopfkommentar).
  const firmenkunde = istGlobalPaket(a.pack_key);
  const ustModus: B2bUstModus = firmenkunde ? b2bUstModus(a) : "none";
  // Englische Zweitzeile je Kopfbegriff — nur Firmenauftrag, nur wenn der Auftrag englisch geführt wurde.
  const en = firmenkunde && String(a.rechnung_sprache || "").trim().toLowerCase() === "en";
  const zweit = (text: string, x: number, yy: number, width: number, align: "left" | "right" = "left") => {
    if (en) doc.font("Helvetica").fontSize(6.5).fillColor(CI.slate).text(text, x, yy, { width, align, lineBreak: false });
  };

  // ── Kopf: FIAON Wortmarke links, Entity-Block rechtsbündig ──
  doc.font("Helvetica-Bold").fontSize(24).fillColor(CI.blue).text("FIAON", M, M);
  doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
    .text(firmenkunde ? "FIAON Global" : "SaaS- & E-Learning-Plattform", M, M + 28);

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
  if (en) { zweit("Bill to", M, ay - 3, addrW); ay += 8; }
  if (firmenkunde) {
    // Rechnungsempfänger ist die FIRMA — der Mensch steht als Ansprechpartner darunter.
    const firma = String(a.company_name || "").trim() || customerName;
    const ansprech = String(a.contact_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || "").trim();
    doc.font("Helvetica").fontSize(10).fillColor(CI.dark).text(firma, M, ay, { width: addrW });
    ay = doc.y + 1;
    if (ansprech && ansprech !== firma) { doc.text(`z. Hd. ${ansprech}`, M, ay, { width: addrW }); ay = doc.y + 1; }
    if (a.street) { doc.text(String(a.street), M, ay, { width: addrW }); ay = doc.y + 1; }
    if (a.zip || a.city) { doc.text(`${a.zip || ""} ${a.city || ""}`.trim(), M, ay, { width: addrW }); ay = doc.y + 1; }
    const land = String(a.country || "").trim().toUpperCase();
    if (land) { doc.text(LAND_NAME[land] ?? land, M, ay, { width: addrW }); ay = doc.y + 1; }
    if (String(a.tax_id || "").trim()) { doc.fontSize(9).text(`USt-IdNr.: ${String(a.tax_id).trim()}`, M, ay + 2, { width: addrW }); ay = doc.y + 1; }
    const mail = a.contact_email || a.email || a.billing_email;
    if (mail) { doc.fillColor(CI.slate).fontSize(8.5).text(String(mail), M, ay, { width: addrW }); ay = doc.y + 1; }
  } else {
    doc.font("Helvetica").fontSize(10).fillColor(CI.dark).text(customerName, M, ay, { width: addrW });
    ay = doc.y + 1;
    if (a.street) { doc.text(String(a.street), M, ay, { width: addrW }); ay = doc.y + 1; }
    if (a.zip || a.city) { doc.text(`${a.zip || ""} ${a.city || ""}`.trim(), M, ay, { width: addrW }); ay = doc.y + 1; }
    if (a.email) { doc.fillColor(CI.slate).fontSize(8.5).text(String(a.email), M, ay, { width: addrW }); ay = doc.y + 1; }
  }
  const addrBottom = doc.y;

  // Rechnungsmeta rechtsbündig als Block (Label links, Wert rechts)
  let my = y;
  const meta: Array<[string, string, string]> = [
    ["Rechnungsnummer", a.invoice_number || "—", "Invoice no."],
    ["Rechnungsdatum", deDate(invoiceDate), "Invoice date (DD.MM.YYYY)"],
    ["Zahlungsreferenz", a.payment_reference || "—", "Payment reference"],
    ["Antrags-Nr.", a.ref || "—", "Order no."],
  ];
  if (dueDate) meta.push(["Zahlungsziel", deDate(dueDate), "Payment due"]);
  for (const [label, value, labelEn] of meta) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, metaX, my, { width: 108, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, metaX + 110, my, { width: metaW - 110, align: "right", lineBreak: false });
    zweit(labelEn, metaX, my + 10, 108);
    my += en ? 22 : 15;
  }

  // ── Titel ──
  y = Math.max(addrBottom, my) + 26;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(CI.dark).text("Rechnung", M, y);
  if (en) doc.font("Helvetica").fontSize(9).fillColor(CI.slate).text("Invoice", M, y + 19, { lineBreak: false });
  y += en ? 38 : 26;

  // ── Positionstabelle: Beschreibung | Zeitraum | Betrag (Beträge RECHTSBÜNDIG) ──
  const amountW = 90;
  const periodW = 120;
  const descX = M + 10;
  const descW = W - amountW - periodW - 40;
  const periodX = M + 10 + descW + 10;
  const amountX = M + W - amountW - 10;

  const kopfH = en ? 31 : 22;
  doc.rect(M, y, W, kopfH).fillColor(CI.bgSoft).fill();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(CI.slate)
    .text("Beschreibung", descX, y + 7, { width: descW, lineBreak: false })
    .text("Zeitraum", periodX, y + 7, { width: periodW, lineBreak: false })
    .text("Betrag", amountX, y + 7, { width: amountW, align: "right", lineBreak: false });
  zweit("Description", descX, y + 19, descW);
  zweit("Period", periodX, y + 19, periodW);
  zweit("Amount", amountX, y + 19, amountW, "right");
  y += kopfH;

  // 04.09.2026 (E-115): Eine Monatsrate bekommt dieselbe Rechnung, nur mit
  // eigener Beschreibung und eigenem Zeitraum — die Zeile darf sie mitbringen.
  const description = a.beschreibung
    ? String(a.beschreibung)
    : firmenkunde
      ? `${packName} — Aufbau einer US-Unternehmensstruktur gemäß Auftrag ${a.ref || ""}`.trim()
      : `${packName} — monatlicher Zugang zur FIAON SaaS- und E-Learning-Plattform (Software-Lizenz, KI-Profilanalyse, Lernmodule, Dashboard)`;
  const zeitraum = a.zeitraum ? String(a.zeitraum) : firmenkunde ? "einmalig" : "1 Monat ab Freischaltung des Zugangs";
  const rowTop = y + 10;
  doc.font("Helvetica").fontSize(9.5).fillColor(CI.dark)
    .text(description, descX, rowTop, { width: descW });
  if (en && !a.beschreibung) {
    doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
      .text(`Set-up of a US company structure as per order ${a.ref || ""}`.trim(), descX, doc.y + 3, { width: descW });
  }
  const descBottom = doc.y;
  doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate)
    .text(zeitraum, periodX, rowTop, { width: periodW });
  if (en && !a.zeitraum) doc.font("Helvetica").fontSize(6.5).fillColor(CI.slate).text("one-off", periodX, doc.y + 1, { width: periodW });
  const periodBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.dark)
    .text(eur(amount), amountX, rowTop, { width: amountW, align: "right", lineBreak: false });
  y = Math.max(descBottom, periodBottom) + 12;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  y += 12;

  // ── Summenblock rechts (Gesamtbetrag fett) + USt-Hinweis ──
  const vatMode = (process.env.INVOICE_VAT_MODE || "none").toLowerCase();
  if (firmenkunde && ustModus === "reverse_charge") {
    doc.font("Helvetica").fontSize(9.5).fillColor(CI.slate)
      .text("Nettobetrag", metaX, y, { width: 110, lineBreak: false })
      .text(eur(amount), metaX + 110, y, { width: metaW - 110, align: "right", lineBreak: false });
    zweit("Net amount", metaX, y + 11, 110);
    y += en ? 23 : 16;
  }
  doc.font("Helvetica-Bold").fontSize(12).fillColor(CI.dark)
    .text(firmenkunde && ustModus === "reverse_charge" ? "Rechnungsbetrag" : "Gesamtbetrag", metaX, y, { width: 110, lineBreak: false })
    .text(eur(amount), metaX + 110, y, { width: metaW - 110, align: "right", lineBreak: false });
  zweit(ustModus === "reverse_charge" ? "Invoice amount" : "Total", metaX, y + 14, 110);
  y += en ? 27 : 20;
  if (firmenkunde) {
    // Sachlich, ohne „folgt nach Registrierung": Was auf dieser Rechnung gilt, steht auf dieser Rechnung.
    const satz = ustModus === "reverse_charge"
      ? `Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge). USt-IdNr. des Leistungsempfängers: ${String(a.tax_id).trim()}. Der Rechnungsbetrag enthält keine Umsatzsteuer.`
      : "Rechnungsbetrag ohne gesonderten Ausweis von Umsatzsteuer.";
    doc.font("Helvetica").fontSize(8).fillColor(CI.slate).text(satz, M, y, { width: W, align: "right" });
    if (en) {
      const satzEn = ustModus === "reverse_charge"
        ? `Reverse charge: the recipient of the service is liable for VAT. VAT ID of the recipient: ${String(a.tax_id).trim()}. The invoice amount contains no VAT.`
        : "Invoice amount without separate statement of VAT.";
      doc.font("Helvetica").fontSize(7).fillColor(CI.slate).text(satzEn, M, doc.y + 2, { width: W, align: "right" });
    }
    y = doc.y;
  } else if (vatMode === "none") {
    doc.font("Helvetica").fontSize(8).fillColor(CI.slate)
      .text("Gesamtbetrag ohne gesonderten Steuerausweis. Hinweis zur Umsatzsteuer: folgt nach steuerlicher Registrierung.", M, y, { width: W, align: "right" });
    y = doc.y;
  }
  y += 22;

  // ── Zahlungsdaten-Block (dynamische Höhe — Hinweiszeile kollidiert NIE) ──
  const payRows: Array<[string, string, string]> = [
    ["Empfänger", FIAON_BANK_DETAILS.recipient, "Recipient"],
    ["IBAN", groupIban(FIAON_BANK_DETAILS.iban), ""],
    ["BIC", FIAON_BANK_DETAILS.bic, ""],
    ["Verwendungszweck", a.payment_reference || "—", "Payment reference"],
    ["Zahlungsziel", dueDate ? deDate(dueDate) : "—", "Payment due"],
  ];
  const payStep = en ? 21 : 14;
  const payBoxH = 12 + 20 + (en ? 9 : 0) + payRows.length * payStep + 18 + (en ? 10 : 0); // Titel + Zeilen + Hinweis
  doc.roundedRect(M, y, W, payBoxH, 8).fillColor(CI.bgSoft).fill();
  doc.roundedRect(M, y, W, payBoxH, 8).lineWidth(1).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CI.blue).text("Zahlung per SEPA-Banküberweisung (Vorkasse)", M + 14, y + 12, { width: W - 28, lineBreak: false });
  zweit("Payment by SEPA bank transfer (payment in advance)", M + 14, y + 25, W - 28);
  let py = y + 32 + (en ? 9 : 0);
  for (const [label, value, labelEn] of payRows) {
    doc.font("Helvetica").fontSize(8.5).fillColor(CI.slate).text(label, M + 14, py, { width: 120, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CI.dark).text(value, M + 140, py, { width: W - 154, lineBreak: false });
    if (labelEn) zweit(labelEn, M + 14, py + 10, 120);
    py += payStep;
  }
  doc.font("Helvetica").fontSize(7.5).fillColor(CI.slate)
    .text("Bitte geben Sie den Verwendungszweck exakt an – nur so kann Ihre Zahlung automatisch zugeordnet werden.", M + 14, py + 4, { width: W - 28, lineBreak: false });
  zweit("Please state the payment reference exactly – it is the only way your payment can be matched automatically.", M + 14, py + 14, W - 28);

  // ── Fußzeile: einzeilig sauber + Seitenzahl bei Mehrseitigkeit ──
  const range = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
  const pageCount = Math.max(1, range.count);
  const footY = doc.page.height - 52;
  doc.moveTo(M, footY - 8).lineTo(M + W, footY - 8).lineWidth(0.5).strokeColor(CI.lightLine).stroke();
  doc.font("Helvetica").fontSize(7).fillColor(CI.slate)
    .text(`${FIAON_ENTITY.name} · Companies House No. ${FIAON_ENTITY.companyNo} · Registered Office: ${FIAON_ENTITY.addressLine1}, ${FIAON_ENTITY.addressLine2} (UK) · Director: ${FIAON_ENTITY.director}`, M, footY, { width: W, align: "center", lineBreak: false })
    .text(`${FIAON_ENTITY.email} · fiaon.com${pageCount > 1 ? ` · Seite ${range.start + 1} von ${pageCount}` : ""}`, M, footY + 10, { width: W, align: "center", lineBreak: false });
}
