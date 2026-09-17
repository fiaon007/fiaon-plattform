// PAKET AB/AF — Beispiel-Rechnungen offline rendern (kein DB-Zugriff).
// Aufruf: npx tsx scripts/render-test-invoice.ts [Zielordner] → <Zielordner oder /tmp>/fiaon-invoice-*.pdf
// 17.09.2026 (E-188): zwei Firmenrechnungen für FIAON Global dazu — ohne Steuerausweis und mit Reverse Charge.
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
  {
    name: "global-none",
    row: {
      invoice_number: "FIAON-INV-2026-00044", invoice_date: new Date(), payment_due_date: new Date(Date.now() + 7 * 864e5),
      type: "business", pack_key: "global_struktur", pack_name: "FIAON Global Struktur", company_name: "Muster & Söhne GmbH",
      contact_name: "Max Muster", contact_email: "m.muster@muster-gmbh.example", email: "m.muster@muster-gmbh.example",
      street: "Beispielweg 12", zip: "80331", city: "München", country: "DE", tax_id: "DE123456789", rechnung_ust_modus: "none",
      amount_due: "2499.00", payment_reference: "FIAON-A1B2C3", ref: "FIAON-TEST-GLOBAL-1",
    },
  },
  {
    name: "global-reverse-charge",
    row: {
      invoice_number: "FIAON-INV-2026-00045", invoice_date: new Date(), payment_due_date: new Date(Date.now() + 7 * 864e5),
      type: "business", pack_key: "global_vip", pack_name: "FIAON Global VIP", company_name: "Beispiel Handels- und Beteiligungsgesellschaft mbH & Co. KG",
      contact_name: "Dr. Eva-Maria Beispiel-Mustermann", contact_email: "eva@beispiel-handel.example", email: "eva@beispiel-handel.example",
      street: "Am Langen Beispielweg 128a", zip: "1010", city: "Wien", country: "AT", tax_id: "ATU12345678", rechnung_ust_modus: "reverse_charge",
      amount_due: "35999.00", payment_reference: "FIAON-Z9Y8X7", ref: "FIAON-TEST-GLOBAL-2",
    },
  },
];
const ZIEL = process.argv[2] || "/tmp";

for (const c of cases) {
  // Identisch zu den echten Endpoints: margin 50 + bufferPages zum Zählen der Seiten.
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const out = `${ZIEL}/fiaon-invoice-${c.name}.pdf`;
  doc.pipe(createWriteStream(out));
  renderInvoicePdf(doc as any, c.row);
  const pages = doc.bufferedPageRange().count;
  doc.end();
  console.log(`geschrieben: ${out} — Seiten: ${pages}${pages === 1 ? " ✓" : " ✗ (erwartet 1)"}`);
}
