// ═══════════════════════════════════════════════════════════════════════════
// WAS STEHT WIRKLICH IN DER ABRECHNUNG? — DER BEFUND AM ECHTEN PDF
//
// Referenz-Befund (19.08.2026): FIAON-COM-2026-0010 — Sprachen-Mix, Fußzeile
// doppelt, Pauschal-Gutschriften in Prozent-Spalten gepresst („Rate —"), Datum
// mehrfach wiederholt.
//
// Dieser Lauf BEHAUPTET nichts, sondern liest das gespeicherte PDF aus der
// Datenbank, zieht den Text heraus und zählt. NUR LESEND — das ausgezahlte
// Dokument ist ein Beleg und wird nicht angefasst.
//
//   npx tsx scripts/mess-abrechnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  pdfText, pdfSeiten, pdfTextBrauchbar, pdfTextJeSeite, pdfLeereSeiten, pdfWortJeSeite,
} from "../server/lib/fiaon-pdf-lesen";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }

async function main(): Promise<void> {
  titel("1 — DER BESTAND AN ABRECHNUNGEN");
  const alle = (await sqlPool`
    SELECT s.id, s.statement_no, s.agent_id, s.payout_id, s.gross_cents, s.net_cents,
           s.issued_at, s.period_start, s.period_end,
           (s.pdf_base64 IS NOT NULL) AS hat_pdf,
           LENGTH(COALESCE(s.pdf_base64, '')) AS pdf_groesse,
           ag.name AS mitarbeiter, ag.rolle,
           p.status AS auszahlung_status, p.processed_at
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     ORDER BY s.issued_at DESC
  `) as any[];
  log(`  ${alle.length} Abrechnungen insgesamt.\n`);
  log("  Nummer                  Mitarbeiter            Betrag      Auszahlung   PDF");
  log("  " + "─".repeat(78));
  for (const s of alle) {
    log(`  ${String(s.statement_no).padEnd(23)} ${String(s.mitarbeiter ?? "?").slice(0, 21).padEnd(22)} `
      + `${(Number(s.net_cents) / 100).toFixed(2).padStart(9)} € ${String(s.auszahlung_status ?? "-").padEnd(12)} `
      + `${s.hat_pdf ? `${Math.round(Number(s.pdf_groesse) / 1024)} kB` : "FEHLT"}`);
  }
  const ohnePdf = alle.filter((s) => !s.hat_pdf).length;
  log(`\n  ${ohnePdf} Abrechnungen haben KEIN PDF — dort greift heute der pdfkit-Rückfall`);
  log("  oder es ist beim Rendern gescheitert und niemand hat es gemerkt.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2 — FIAON-COM-2026-0010: DER TEXT, WIE ER IM PDF STEHT");
  // ═════════════════════════════════════════════════════════════════════════
  const [ref] = (await sqlPool`
    SELECT s.*, ag.name AS mitarbeiter FROM fiaon_commission_statements s
     LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
     WHERE s.statement_no = 'FIAON-COM-2026-0010'
  `) as any[];
  if (!ref) {
    log("  FIAON-COM-2026-0010 gibt es nicht. Der Auftrag nennt eine Nummer aus der");
    log("  Erinnerung — die tatsächlichen Nummern stehen oben.");
  } else if (!ref.pdf_base64) {
    log("  Die Abrechnung existiert, hat aber kein gespeichertes PDF.");
  } else {
    mkdirSync("reports/abrechnung", { recursive: true });
    const buf = Buffer.from(ref.pdf_base64, "base64");
    writeFileSync("reports/abrechnung/ALT-COM-2026-0010.pdf", buf);
    const text = await pdfText(buf);
    const seiten = await pdfSeiten(buf);
    const jeSeite = await pdfTextJeSeite(buf);
    const leer = await pdfLeereSeiten(buf);
    if (!pdfTextBrauchbar(text)) {
      log("  ACHTUNG: Die Textausbeute ist unbrauchbar (Schrift ohne ToUnicode).");
      log("  Die Zählungen unten sagen dann NICHTS — nicht „Wort fehlt\".");
    }
    log(`  ${Math.round(buf.length / 1024)} kB · ${seiten} Seite(n)`);
    log(`  → reports/abrechnung/ALT-COM-2026-0010.pdf\n`);

    // ── BEFUND A: FUSSZEILE DOPPELT ─────────────────────────────────────
    log(`  Leerseiten: ${leer.length > 0 ? leer.join(", ") : "keine"}`);
    log(`  Zeichen je Seite: ${jeSeite.map((s) => s.length).join(" · ")}\n`);
    const firmaJeSeite = await pdfWortJeSeite(buf, "FIAON LTD");
    const anschriftJeSeite = await pdfWortJeSeite(buf, "128 City Road");
    log(`  BEFUND A — „FIAON LTD“ je Seite: ${firmaJeSeite.join(" · ")} (Summe ${firmaJeSeite.reduce((a, b) => a + b, 0)})`);
    log(`             „128 City Road“ je Seite: ${anschriftJeSeite.join(" · ")}`);
    log("    Erwartet: Seite 1 zweimal (Aussteller-Block + Fußzeile), Folgeseiten je einmal.");
    log("    Mehr heißt: derselbe Block wird zweimal gedruckt.");

    // ── BEFUND B: SPRACHEN-MIX ──────────────────────────────────────────
    const englisch = ["Issued by", "Agent", "Commission items", "Date", "Order / reference",
      "Sale value", "Rate", "Commission", "Subtotal", "Net amount paid out",
      "VAT treatment", "Tax treatment", "Payout date", "Method", "Reference",
      "Statement no", "Issue date", "Period", "Document hash", "self-billed credit note"];
    const gefunden = englisch.filter((w) => text.includes(w));
    log(`\n  BEFUND B — ${gefunden.length} von ${englisch.length} englischen Beschriftungen im Dokument:`);
    log(`    ${gefunden.join(" · ")}`);
    const deutsch = ["Gutschrift", "Provision", "Abrechnung", "Steuer", "Auszahlung", "Betrag"];
    const deutschDa = deutsch.filter((w) => text.includes(w));
    log(`    Deutsche Begriffe daneben: ${deutschDa.join(" · ") || "(keine)"}`);
    log("    → Der Empfängerkreis ist DACH. Ein Dokument für den Steuerberater");
    log("      darf nicht halb englisch sein.");

    // ── BEFUND C: „RATE —" BEI PAUSCHALEN ───────────────────────────────
    const striche = (text.match(/—/g) ?? []).length;
    log(`\n  BEFUND C — ${striche} Gedankenstriche „—" im Text.`);
    log("    Sie stehen in den Spalten „Sale value“ und „Rate“, wenn eine Position");
    log("    eine PAUSCHALE ist. Eine Pauschale hat keinen Satz und keine");
    log("    Bemessungsgrundlage — die leeren Spalten sind kein Datenfehler,");
    log("    sondern die falsche Tabelle.");

    // ── BEFUND D: DATUM MEHRFACH ────────────────────────────────────────
    const datumsMuster = text.match(/\d{2}\.\d{2}\.\d{4}/g) ?? [];
    const zaehlung = new Map<string, number>();
    for (const d of datumsMuster) zaehlung.set(d, (zaehlung.get(d) ?? 0) + 1);
    log(`\n  BEFUND D — ${datumsMuster.length} Datumsangaben, davon mehrfach:`);
    for (const [d, n] of Array.from(zaehlung.entries()).sort((a, b) => b[1] - a[1])) {
      if (n > 1) log(`    ${d} steht ${n}×`);
    }

    // ── DIE POSITIONEN AUS DER DATENBANK ────────────────────────────────
    const zeilen = JSON.parse(String(ref.lines_json || "[]"));
    const mitSatz = zeilen.filter((l: any) => Number(l.rateBp) > 0);
    const pauschal = zeilen.filter((l: any) => !Number(l.rateBp));
    log(`\n  Positionen: ${zeilen.length} — davon ${mitSatz.length} mit Satz, `
      + `${pauschal.length} PAUSCHAL (ohne Satz und ohne Bemessungsgrundlage).`);
    for (const l of pauschal.slice(0, 6)) {
      log(`    Pauschale: ${l.reference ?? "?"} · ${(Number(l.commissionCents) / 100).toFixed(2)} € `
        + `· „${String(l.note ?? l.pack ?? "").slice(0, 60)}"`);
    }

    writeFileSync("reports/abrechnung/ALT-COM-2026-0010.txt", text);
    log(`\n  → reports/abrechnung/ALT-COM-2026-0010.txt (Volltext zum Nachlesen)`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3 — WIE VIELE POSITIONEN KOMMEN VOR? (Format-Grenzen)");
  // ═════════════════════════════════════════════════════════════════════════
  const verteilung = (await sqlPool`
    SELECT s.statement_no,
           (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.payout_id = s.payout_id) AS positionen,
           (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.payout_id = s.payout_id
             AND COALESCE(c.rate_bp, 0) = 0) AS pauschalen
      FROM fiaon_commission_statements s
     ORDER BY positionen DESC
  `) as any[];
  log("  Nummer                  Positionen  davon pauschal");
  log("  " + "─".repeat(54));
  for (const v of verteilung) {
    log(`  ${String(v.statement_no).padEnd(23)} ${String(v.positionen).padStart(10)} ${String(v.pauschalen).padStart(15)}`);
  }
  const max = Math.max(0, ...verteilung.map((v) => Number(v.positionen)));
  log(`\n  Größte Abrechnung: ${max} Positionen. Die Format-Wand prüft 1, 10 und 40.`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("4 — GIBT ES MEHR ALS EINEN RENDERER?");
  // ═════════════════════════════════════════════════════════════════════════
  log("  Grep steht im Prüfstand (pruef-abrechnung.ts). Hier nur die Wege:");
  log("    · Freigabe einer Auszahlung  → generateCommissionStatement(payoutId)");
  log("    · Mitarbeiter-PDF            → /agent/documents/statement/:id.pdf");
  log("    · Mail-Anhang                → sendMakeWebhook(commission_statement_issued)");
  log("  Alle drei müssen aus DERSELBEN Funktion kommen.");

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
