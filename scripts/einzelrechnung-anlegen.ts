// ═══════════════════════════════════════════════════════════════════════════
// EINE EINZELRECHNUNG FÜR EINEN BESTANDSKUNDEN ANLEGEN (Register E-419, 22.10.2026)
//
// Für Positionen, die FIAON weiterberechnet (z. B. Fast-Track der Gründung, llc_fasttrack) — derselbe Weg wie die
// Gründungsrechnungen E-316/E-322: eigene Bestellzeile mit Katalogschlüssel (fester Preis, eigener Rechnungstext,
// zahlungsseite „global“), bestellungFuerAntrag (Verwendungszweck, Zahlungsziel), fortlaufende Rechnungsnummer, PDF.
//
// Was hier NICHT passiert: keine Zahlungsmail an den Kunden (payment_email_sent_at wird vorher gesetzt — die Mail schreibt
// Mara als Entwurf), kein Abo, keine Mahnkette (abo_gestoppt_am/mahnstopp_am wie E-316), kein Verknüpfen mit einer älteren
// Bestellung (ohneVerknuepfung), kein Ablösen der Schwesterbestellungen (Einzelrechnungen sind davon ausgenommen).
// Kundendaten kommen aus einer bestehenden Bestellzeile desselben Kunden (--vorlage) — nichts davon steht im Code.
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=… SESSION_SECRET=… npx tsx scripts/einzelrechnung-anlegen.ts \
//     --vorlage <ref einer Bestellzeile des Kunden> --paket <katalogschlüssel> --name "<Bestellname>" --grund "<Abo-Stopp-Grund>" \
//     [--tage 7] [--pdf <ordner>]            → Vorschau (nichts geschrieben)
//   … --schreiben                          → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion             → gegen die Produktion, NUR mit Justins Go
//   [--zweck FIAON-XXXXXX]   E-432: dieser Verwendungszweck statt eines neuen (der Kunde hat ihn schon überwiesen)
//   [--bank <txn_id>]        E-432: den Bankeingang gleich über den einen Buchungsweg buchen (bankeingangBuchen, Betrag muss passen)
// Ein zweiter Lauf mit derselben Vorlage und demselben Paket legt keine zweite Rechnung an (offene/bezahlte Zeile wird gezeigt).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const vorlage = arg("--vorlage"); const paketKey = arg("--paket"); const name = arg("--name"); const grund = arg("--grund");
const tage = Math.max(0, Math.min(30, Number(arg("--tage") ?? 7) || 0)); const pdfOrdner = arg("--pdf");
const zweck = arg("--zweck"); const bankTxn = arg("--bank");
if (zweck && !/^FIAON-[A-Z0-9]{6}$/.test(zweck)) { console.error("ABBRUCH: --zweck in der Form FIAON-XXXXXX."); process.exit(2); }
if (!vorlage || !paketKey || !name || !grund) { console.error("ABBRUCH: --vorlage, --paket, --name und --grund sind Pflicht."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = ""; try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten."); process.exit(2); }

const { paket, istGlobalPaket, istAngebotsPaket, istGlobalEinzelrechnung } = await import("../shared/fiaon-pakete");
const p = paket(paketKey);
if (!p) { console.error(`ABBRUCH: Unbekanntes Paket ${paketKey}.`); process.exit(2); }
if (p.abo || istGlobalPaket(p.key) || istAngebotsPaket(p.key) || !p.eingestellt || !p.rechnung || !istGlobalEinzelrechnung(p.key)) {
  console.error(`ABBRUCH: ${p.key} ist keine Einzelrechnung (Einmalkauf, eingestellt, eigener Rechnungstext, Zahlungsseite global).`); process.exit(2);
}
const { sqlPool } = await import("../server/lib/db-pool");
const [v] = (await sqlPool`
  SELECT ref, type, first_name, last_name, company_name, contact_name, email, billing_email, street, zip, city, country, person_id
    FROM fiaon_applications WHERE ref = ${vorlage} LIMIT 1`) as any[];
if (!v) { console.error(`ABBRUCH: Vorlage ${vorlage} nicht gefunden.`); await sqlPool.end(); process.exit(2); }
console.log(`Kunde: ${v.first_name} ${v.last_name} · Person ${v.person_id ?? "—"} · ${v.city ?? ""} (${v.country ?? ""})`);
console.log(`Rechnung: ${p.label} · ${(p.preisCents / 100).toFixed(2)} € · „${name} — ${p.rechnung.beschreibung}“ · Zahlungsziel ${tage} Tage`);

// Schon da? (dieselbe Person, dasselbe Paket, nicht storniert)
const [da] = (await sqlPool`
  SELECT ref, payment_reference, invoice_number, payment_status FROM fiaon_applications
   WHERE pack_key = ${p.key} AND person_id IS NOT DISTINCT FROM ${v.person_id} AND COALESCE(payment_status, '') NOT IN ('cancelled', 'superseded', 'refunded')
   ORDER BY created_at DESC LIMIT 1`) as any[];
if (da) { console.log(`Gibt es schon: ${da.ref} · ${da.payment_reference} · ${da.invoice_number ?? "ohne Nummer"} · ${da.payment_status}`); }
if (!schreiben || da) {
  if (da && pdfOrdner && da.payment_reference) {
    const { rechnungAlsPdf } = await import("../server/lib/fiaon-rechnung-pdf");
    const r = await rechnungAlsPdf(String(da.payment_reference));
    if (r) { fs.mkdirSync(pdfOrdner, { recursive: true }); fs.writeFileSync(path.join(pdfOrdner, `Rechnung_${r.rechnungsnummer}.pdf`), r.pdf); console.log(`PDF: ${path.join(pdfOrdner, `Rechnung_${r.rechnungsnummer}.pdf`)}`); }
  }
  if (!schreiben) console.log("Nur Vorschau — zum Anlegen --schreiben.");
  await sqlPool.end(); process.exit(0);
}

if (zweck) {
  const [belegt] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE payment_reference = ${zweck} LIMIT 1`) as any[];
  if (belegt) { console.error(`ABBRUCH: Verwendungszweck ${zweck} gehört schon zu ${belegt.ref}.`); await sqlPool.end(); process.exit(2); }
}
const [tx] = bankTxn ? ((await sqlPool`SELECT id, amount_cents, applied FROM fiaon_bank_txns WHERE txn_id = ${bankTxn} LIMIT 1`) as any[]) : [];
if (bankTxn && (!tx || tx.applied || Number(tx.amount_cents) !== p.preisCents)) {
  console.error(`ABBRUCH: Bankeingang ${bankTxn} fehlt, ist schon verbucht oder passt nicht zum Betrag (${tx ? tx.amount_cents : "—"} ≠ ${p.preisCents} Cent).`); await sqlPool.end(); process.exit(2);
}
const ref = `FIAON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
await sqlPool`
  INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, first_name, last_name, company_name, contact_name, email, billing_email,
                                  street, zip, city, country, person_id, payment_email_sent_at, abo_gestoppt_am, abo_stopp_grund, mahnstopp_am, created_at, updated_at)
  VALUES (${ref}, ${v.type ?? "business"}, 'submitted', ${p.key}, ${name}, ${v.first_name}, ${v.last_name}, ${v.company_name}, ${v.contact_name}, ${v.email}, ${v.billing_email},
          ${v.street}, ${v.zip}, ${v.city}, ${v.country}, ${v.person_id}, NOW(), NOW(), ${grund}, NOW(), NOW(), NOW())`;
const { bestellungFuerAntrag } = await import("../server/routes/fiaon-antrag");
const b = await bestellungFuerAntrag(ref, { ohneVerknuepfung: true });
// bestellungFuerAntrag stößt im Hintergrund Prüfungen an (Dubletten, Leads) — erst abwarten, dann weiter (sonst schließt die Verbindung zu früh).
await new Promise((r) => setTimeout(r, 4000));
if (b.status !== 200 || !b.body.paymentReference) { console.error(`FEHLER Bestellung: ${JSON.stringify(b.body)}`); await sqlPool.end(); process.exit(1); }
// Zahlungsziel nach Wunsch (bestellungFuerAntrag setzt die Vorgabe)
await sqlPool`UPDATE fiaon_applications SET payment_due_date = ${new Date(Date.now() + tage * 864e5)}, updated_at = NOW() WHERE ref = ${ref}`;
const { ensureInvoiceNumber } = await import("../server/fiaon-invoice");
const nummer = await ensureInvoiceNumber(sqlPool, ref);
const vz = zweck ?? String(b.body.paymentReference);
if (zweck) await sqlPool`UPDATE fiaon_applications SET payment_reference = ${zweck}, updated_at = NOW() WHERE ref = ${ref}`;
console.log(`Angelegt: ${ref} · Verwendungszweck ${vz} · ${nummer}`);
if (tx) {
  const { bankeingangBuchen } = await import("../server/lib/fiaon-bank-nachholen");
  const r = await bankeingangBuchen(Number(tx.id), { ziel: ref, wer: "Skript einzelrechnung-anlegen" });
  console.log(r.ok ? `Gebucht: Bankeingang ${bankTxn} → ${ref}` : `NICHT gebucht (${r.status}): ${r.error}`);
}
if (pdfOrdner) {
  const { rechnungAlsPdf } = await import("../server/lib/fiaon-rechnung-pdf");
  const r = await rechnungAlsPdf(vz);
  if (r) { fs.mkdirSync(pdfOrdner, { recursive: true }); fs.writeFileSync(path.join(pdfOrdner, `Rechnung_${r.rechnungsnummer}.pdf`), r.pdf); console.log(`PDF: ${path.join(pdfOrdner, `Rechnung_${r.rechnungsnummer}.pdf`)}`); }
}
await new Promise((r) => setTimeout(r, 2000));
await sqlPool.end().catch(() => {});
process.exit(0);
