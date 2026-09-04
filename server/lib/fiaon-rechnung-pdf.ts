// ═══════════════════════════════════════════════════════════════════════════
// RECHNUNG ALS PDF — IM SPEICHER, ZUM ANHÄNGEN AN EINE MAIL
//
// 04.09.2026 (E-115, Justin: „dass direkt die Rechnung mitgeschickt wird").
//
// VORHER: Die Rechnung gab es nur als Strom in eine HTTP-Antwort
// (server/routes/fiaon-antrag.ts, `doc.pipe(res)`). Mara konnte sie nicht
// mitschicken, und für Monatsraten (FIAON-XXXXXX-N) gab es gar keine — nur die
// Zahlungsseite. Fragte ein Ratenkunde nach „der Rechnung", lief es ins Leere.
//
// NACHHER: `rechnungAlsPdf(referenz)` liefert Buffer + Dateiname, für die
// Bestellung UND für jede Monatsrate. Die Rate bekommt eine eigene Nummer aus
// demselben lückenlosen Kreis (`fiaon_counters`), abgelegt an der Rate selbst
// (`fiaon_abo_raten.rechnungsnummer`). Gezeichnet wird mit dem bestehenden
// Renderer — dieselbe Rechnung, nur mit Ratenbeschreibung und Zeitraum.
// ═══════════════════════════════════════════════════════════════════════════

import PDFDocument from "pdfkit";
import { sqlPool } from "./db-pool";
import { renderInvoicePdf, ensureInvoiceNumber, ensureInvoiceTables } from "../fiaon-invoice";

export interface RechnungPdf {
  pdf: Buffer;
  dateiname: string;
  rechnungsnummer: string;
  art: "bestellung" | "rate";
  referenz: string;
  betrag: string;
}

const RATEN_MUSTER = /^(FIAON-[A-Z0-9]{6})-(\d{1,2})$/;
const RATEN_VON = 12;

let spaltenBereit = false;
async function ratenSpalten(): Promise<void> {
  if (spaltenBereit) return;
  await sqlPool`
    ALTER TABLE fiaon_abo_raten
      ADD COLUMN IF NOT EXISTS rechnungsnummer VARCHAR,
      ADD COLUMN IF NOT EXISTS rechnungsdatum TIMESTAMPTZ
  `.catch((e) => console.error("[RECHNUNG-PDF] Spalten:", String(e).slice(0, 160)));
  spaltenBereit = true;
}

/** Das PDF des Renderers als Buffer einsammeln (Muster aus fiaon-bild-zu-pdf.ts). */
function zeichnen(zeile: any): Promise<Buffer> {
  return new Promise((aufloesen, ablehnen) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const teile: Buffer[] = [];
    doc.on("data", (c: Buffer) => teile.push(c));
    doc.on("end", () => aufloesen(Buffer.concat(teile)));
    doc.on("error", ablehnen);
    try {
      renderInvoicePdf(doc, zeile);
      doc.end();
    } catch (e) {
      ablehnen(e);
    }
  });
}

/** Rechnungsnummer für eine Rate — genau einmal, aus dem Jahreskreis der Bestellungen. */
async function ratenRechnungsnummer(rateId: number): Promise<string> {
  await ensureInvoiceTables(sqlPool);
  const [da] = (await sqlPool`SELECT rechnungsnummer FROM fiaon_abo_raten WHERE id = ${rateId}`) as any[];
  if (da?.rechnungsnummer) return String(da.rechnungsnummer);
  const jahr = new Date().getFullYear();
  const zaehler = `invoice-${jahr}`;
  await sqlPool`INSERT INTO fiaon_counters (name, value) VALUES (${zaehler}, 0) ON CONFLICT (name) DO NOTHING`;
  const [hoch] = (await sqlPool`UPDATE fiaon_counters SET value = value + 1 WHERE name = ${zaehler} RETURNING value`) as any[];
  const nummer = `FIAON-INV-${jahr}-${String(hoch.value).padStart(5, "0")}`;
  const genommen = (await sqlPool`
    UPDATE fiaon_abo_raten SET rechnungsnummer = ${nummer}, rechnungsdatum = NOW()
     WHERE id = ${rateId} AND rechnungsnummer IS NULL RETURNING rechnungsnummer
  `) as any[];
  if (genommen.length) {
    console.log(`[RECHNUNG-PDF] Rechnungsnummer vergeben: ${nummer} (Rate ${rateId})`);
    return nummer;
  }
  const [nochmal] = (await sqlPool`SELECT rechnungsnummer FROM fiaon_abo_raten WHERE id = ${rateId}`) as any[];
  return String(nochmal?.rechnungsnummer || nummer);
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Rechnung zu einer Zahlungsreferenz als PDF. `null`, wenn es die Referenz
 * nicht gibt. Bestellung: FIAON-XXXXXX · Rate: FIAON-XXXXXX-N.
 */
export async function rechnungAlsPdf(referenzRoh: string): Promise<RechnungPdf | null> {
  const referenz = String(referenzRoh || "").trim().toUpperCase();
  if (!referenz) return null;

  const rate = referenz.match(RATEN_MUSTER);
  if (rate) {
    await ratenSpalten();
    const [r] = (await sqlPool`
      SELECT r.id AS rate_id, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.faellig_am,
             r.rechnungsnummer AS raten_rechnungsnummer, r.rechnungsdatum AS raten_rechnungsdatum,
             a.*
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
       WHERE UPPER(r.zahlungsreferenz) = ${referenz}
       ORDER BY r.id DESC LIMIT 1
    `) as any[];
    if (!r) return null;
    const nummer = r.raten_rechnungsnummer ? String(r.raten_rechnungsnummer) : await ratenRechnungsnummer(Number(r.rate_id));
    const paket = r.pack_name ? String(r.pack_name).replace(/\n/g, " ") : "FIAON Zugang";
    const zeile = {
      ...r,
      invoice_number: nummer,
      invoice_date: r.raten_rechnungsdatum || new Date(),
      payment_reference: r.zahlungsreferenz,
      amount_due: eur(Number(r.betrag_cents)),
      payment_due_date: r.faellig_am,
      beschreibung: `${paket} — Monatsrate ${r.rate_nr} von ${RATEN_VON}: Zugang zur FIAON SaaS- und E-Learning-Plattform (Software-Lizenz, KI-Profilanalyse, Lernmodule, Dashboard)`,
      zeitraum: `Monat ${r.rate_nr} der Laufzeit`,
    };
    const pdf = await zeichnen(zeile);
    return { pdf, dateiname: `${nummer}.pdf`, rechnungsnummer: nummer, art: "rate", referenz: String(r.zahlungsreferenz), betrag: zeile.amount_due };
  }

  let [a] = (await sqlPool`SELECT * FROM fiaon_applications WHERE payment_reference = ${referenz} LIMIT 1`) as any[];
  if (!a) [a] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${referenz} AND merged_into IS NULL LIMIT 1`) as any[];
  if (!a) return null;
  if (!a.invoice_number) {
    await ensureInvoiceNumber(sqlPool, a.ref);
    [a] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${a.ref} LIMIT 1`) as any[];
  }
  const nummer = String(a.invoice_number || "FIAON-Rechnung");
  const pdf = await zeichnen(a);
  return { pdf, dateiname: `${nummer}.pdf`, rechnungsnummer: nummer, art: "bestellung", referenz: String(a.payment_reference || a.ref), betrag: String(a.amount_due ?? "") };
}
