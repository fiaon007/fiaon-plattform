// ═══════════════════════════════════════════════════════════════════════════
// AUSGEZAHLT, ABER KEIN BELEG — WIE VIELE, UND WARUM?
//
// ── DER BEFUND AUS PRODUKTION (20.08.2026) ─────────────────────────────────
// FIAON-COM-2026-0011 (Nikita Boychenko, 386,40 €, ausgezahlt) hat KEIN PDF.
// Der Abruf antwortet `PDF_FEHLT` mit dem Hinweis, es sei „über Neu erzeugen
// erstellbar, solange die Auszahlung nicht abgeschlossen ist" — und genau das
// ist sie. Damit existiert eine ausgezahlte Provision ohne Beleg, und das
// System verweigert die Erstellung.
//
// Die Wand steht an der falschen Stelle: Sie soll vor ÜBERSCHREIBEN schützen,
// nicht vor ERSTELLEN. Eine Erst-Erzeugung ist kein Eingriff in einen Beleg —
// sie stellt ihn erst her.
//
// NUR LESEND.
//   npx tsx scripts/mess-abrechnung-ohne-pdf.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1 — WIE VIELE ABRECHNUNGEN HABEN KEIN PDF?");
  // ═════════════════════════════════════════════════════════════════════════
  const jeStatus = (await sqlPool`
    SELECT COALESCE(p.status, '(keine Auszahlung)') AS status,
           COUNT(*)::int AS alle,
           COUNT(*) FILTER (WHERE s.pdf_base64 IS NULL)::int AS ohne_pdf,
           COALESCE(SUM(s.net_cents) FILTER (WHERE s.pdf_base64 IS NULL), 0)::int AS ohne_pdf_cents
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     GROUP BY 1 ORDER BY 1
  `) as any[];
  log("  Status               Abrechnungen   ohne PDF   Betrag ohne Beleg");
  log("  " + "─".repeat(66));
  let ohneGesamt = 0;
  for (const r of jeStatus) {
    ohneGesamt += Number(r.ohne_pdf);
    log(`  ${String(r.status).padEnd(20)} ${String(r.alle).padStart(12)} `
      + `${String(r.ohne_pdf).padStart(10)} ${((Number(r.ohne_pdf_cents)) / 100).toFixed(2).padStart(18)} €`);
  }
  log(`\n  ${ohneGesamt} Abrechnungen ohne PDF.`);

  const liste = (await sqlPool`
    SELECT s.id, s.statement_no, s.agent_id, s.payout_id, s.issued_at,
           s.period_start, s.period_end, s.gross_cents, s.net_cents,
           ag.name AS mitarbeiter, p.status AS auszahlung_status, p.processed_at,
           (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.payout_id = s.payout_id) AS positionen
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     WHERE s.pdf_base64 IS NULL
     ORDER BY s.issued_at DESC
  `) as any[];
  if (liste.length > 0) {
    log("\n  Nummer                  Mitarbeiter          Betrag   Pos.  Status      erzeugt");
    log("  " + "─".repeat(84));
    for (const r of liste) {
      log(`  ${String(r.statement_no).padEnd(23)} ${String(r.mitarbeiter ?? "?").slice(0, 19).padEnd(20)} `
        + `${((Number(r.net_cents)) / 100).toFixed(2).padStart(8)} ${String(r.positionen).padStart(5)}  `
        + `${String(r.auszahlung_status ?? "-").padEnd(11)} `
        + `${new Date(r.issued_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`);
    }
    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/abrechnung-ohne-pdf.csv", "\uFEFF"
      + ["nummer;mitarbeiter;betrag_eur;positionen;auszahlung_status;erzeugt_am"]
        .concat(liste.map((r) => [r.statement_no, r.mitarbeiter ?? "",
          (Number(r.net_cents) / 100).toFixed(2), r.positionen, r.auszahlung_status ?? "",
          new Date(r.issued_at).toISOString()].join(";"))).join("\n"));
    log(`\n  → reports/abrechnung-ohne-pdf.csv`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2 — FIAON-COM-2026-0011 IM DETAIL");
  // ═════════════════════════════════════════════════════════════════════════
  const [n] = (await sqlPool`
    SELECT s.*, ag.name, ag.email, ag.rolle, ag.partner_type, ag.vat_id, ag.tax_id,
           p.status AS auszahlung_status, p.processed_at, p.requested_at, p.iban_masked,
           p.amount_cents AS payout_cents
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     WHERE s.statement_no = 'FIAON-COM-2026-0011'
  `) as any[];
  if (!n) {
    log("  Nicht gefunden.");
  } else {
    log(`  ${n.name} · ${(Number(n.net_cents) / 100).toFixed(2)} € · Auszahlung `
      + `${n.auszahlung_status} · PDF: ${n.pdf_base64 ? "vorhanden" : "FEHLT"}`);
    log(`  Abrechnung erzeugt: ${new Date(n.issued_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`);
    log(`  Auszahlung angefordert: ${n.requested_at ? new Date(n.requested_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—"}`);
    log(`  Auszahlung ausgeführt:  ${n.processed_at ? new Date(n.processed_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—"}`);
    log(`  Brutto ${(Number(n.gross_cents) / 100).toFixed(2)} € · Netto/Auszahlung `
      + `${(Number(n.net_cents) / 100).toFixed(2)} € · Auszahlungssatz `
      + `${n.payout_cents != null ? (Number(n.payout_cents) / 100).toFixed(2) : "—"} €`);

    // ── DIE ZEITFOLGE: WAS KAM ZUERST? ──────────────────────────────────
    // Die Abrechnung entsteht in `generateCommissionStatement(payoutId)`, das
    // aus der Freigabe gerufen wird. Wenn die Zeile existiert, aber kein PDF,
    // ist die Erzeugung des PDF gescheitert — nicht die der Abrechnung.
    const zeilen = JSON.parse(String(n.lines_json || "[]"));
    log(`\n  ${zeilen.length} Positionen in lines_json.`);
    const mitSatz = zeilen.filter((l: any) => Number(l.rateBp) > 0);
    const ohneSatz = zeilen.filter((l: any) => !Number(l.rateBp));
    log(`  ${mitSatz.length} mit Satz (Provisionen) · ${ohneSatz.length} OHNE Satz (Pauschalen/Boni)`);

    log("\n  Die Positionen ohne Satz — sie gehören in die Pauschal-Tabelle:");
    for (const l of ohneSatz) {
      log(`    ${String(l.reference ?? "?").padEnd(30)} `
        + `${((Number(l.commissionCents)) / 100).toFixed(2).padStart(9)} € `
        + `· „${String(l.note ?? l.pack ?? "").slice(0, 46)}“`);
    }

    // Die echten Buchungen dazu.
    const buchungen = (await sqlPool`
      SELECT id, ref, payment_reference, pack_name, kind, base_amount_cents, rate_bp,
             amount_cents, note, created_at
        FROM fiaon_commissions WHERE payout_id = ${n.payout_id}
       ORDER BY created_at
    `) as any[];
    log(`\n  ${buchungen.length} Buchungen hängen an der Auszahlung.`);
    const summe = buchungen.reduce((s, b) => s + Number(b.amount_cents || 0), 0);
    log(`  Summe der Buchungen: ${(summe / 100).toFixed(2)} € `
      + `(Abrechnung sagt ${(Number(n.net_cents) / 100).toFixed(2)} €) — `
      + `${summe === Number(n.net_cents) ? "stimmt überein" : "WEICHT AB"}`);
    const boni = buchungen.filter((b) => Number(b.rate_bp || 0) === 0);
    log(`\n  ${boni.length} Buchungen ohne Prozentsatz:`);
    for (const b of boni) {
      log(`    ${String(b.payment_reference || b.ref || "?").padEnd(24)} `
        + `${((Number(b.amount_cents)) / 100).toFixed(2).padStart(9)} € `
        + `· kind=${b.kind ?? "—"} · „${String(b.note ?? b.pack_name ?? "").slice(0, 42)}“`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3 — WO KANN DIE ERZEUGUNG STILL GESCHEITERT SEIN?");
  // ═════════════════════════════════════════════════════════════════════════
  log("  In `generateCommissionStatement` (fiaon-onboarding.ts) steht:");
  log("");
  log("      try   { const erg = await abrechnungPdf(daten); pdfBase64 = … }");
  log("      catch { console.error(…) }        ← der Lauf geht WEITER");
  log("");
  log("  Danach wird die Zeile INSERT-iert — mit pdfBase64 = null. Die Abrechnung");
  log("  entsteht also auch ohne Beleg, und die Freigabe meldet Erfolg.");
  log("  Das war bewusst so gebaut — die Auszahlung sollte nicht an der");
  log("  Druckmaschine hängen. Aber ohne einen zweiten Weg, der das PDF nachholt,");
  log("  bleibt der Beleg für immer aus.");
  log("");
  const [ereignis] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agent_events
     WHERE type = 'commission_statement_issued'
  `.catch(() => [{ n: 0 }] as any[])) as any[];
  log(`  Protokoll-Einträge „commission_statement_issued": ${ereignis.n}`);
  log("  (Sie entstehen NACH dem INSERT — also auch dann, wenn kein PDF vorliegt.)");

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
