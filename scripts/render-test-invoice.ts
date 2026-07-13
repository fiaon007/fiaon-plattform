// PAKET AB/AF — Beispiel-Rechnungen offline rendern (kein DB-Zugriff).
// Aufruf: npx tsx scripts/render-test-invoice.ts → /tmp/fiaon-invoice-*.pdf
import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { renderInvoicePdf } from "../server/fiaon-invoice";

const cases = [
  {
    name: "kurz",
    row: {
      invoice_number: "FIAON-INV-2026-00042", invoice_date: new Date(), payment_due_date: new Date(Date.now() + 7 * 864e5),
      first_name: "Max", last_name: "Muster", email: "max@example.com", street: "Musterweg 1", zip: "10115", city: "Berlin",
      pack_name: "FIAON Basis", amount_due: "49.99", payment_reference: "FIAON-PAY-AB12CD34", ref: "FIAON-TEST-KURZ",
    },
  },
  {
    name: "lang",
    row: {
      invoice_number: "FIAON-INV-2026-00043", invoice_date: new Date(), payment_due_date: new Date(Date.now() + 7 * 864e5),
      first_name: "Maximiliane-Alexandra", last_name: "von Hohenlohe-Schillingsfürst-Wittgenstein",
      email: "maximiliane-alexandra.von-hohenlohe@very-long-domain-example-for-testing.de",
      street: "Fürst-von-Hohenlohe-Schillingsfürster-Straße 128a, Hinterhaus Aufgang B", zip: "80539", city: "München",
      pack_name: "FIAON Business Premium Plus – Erweiterte E-Learning-Lizenz mit KI-Profilanalyse und Dashboard",
      amount_due: "1249.99", payment_reference: "FIAON-PAY-ZZ99YY88", ref: "FIAON-TEST-LANG",
    },
  },
];

for (const c of cases) {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const out = `/tmp/fiaon-invoice-${c.name}.pdf`;
  doc.pipe(createWriteStream(out));
  renderInvoicePdf(doc as any, c.row);
  doc.end();
  console.log("geschrieben:", out);
}
