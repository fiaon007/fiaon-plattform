// ═══════════════════════════════════════════════════════════════════════════
// AUSGEZAHLT OHNE BELEG — DIE FEHLENDEN PDFS NACHZIEHEN
//
// ── DER AUSFALL (21.08.2026) ──────────────────────────────────────────────
// Chromium fehlte auf Render. FIAON-COM-2026-0012 (120,00 € an Rifka) und 0013
// (60,00 € an Viktoria) wurden als überwiesen gebucht, der Beleg scheiterte —
// und „Neu erzeugen" lief in denselben Fehler. Eine Schleife ohne Ausgang.
//
// ── WARUM DIESER LAUF UND KEIN KLICK ──────────────────────────────────────
// Der Knopf im Verwaltungsbereich braucht einen laufenden Server MIT Browser.
// Solange der Deploy nicht durch ist, gibt es ihn dort nicht. Dieser Lauf
// druckt von einem Rechner, auf dem Chromium liegt — die Belege sind damit
// SOFORT da, unabhängig vom Deploy.
//
// ── DIESELBE FUNKTION, KEINE ZWEITE ───────────────────────────────────────
// Er ruft `abrechnungNeuErzeugen` — genau das, was der Knopf ruft. Ein eigener
// Druckweg hier wäre eine zweite Fassung desselben Dokuments, und die beiden
// würden auseinanderlaufen.
//
//   npx tsx scripts/belege-nachziehen.ts              # Vorschau
//   npx tsx scripts/belege-nachziehen.ts --schreiben   # erzeugen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

/** Was gilt als „kein Beleg"? Eine leere oder winzige Ablage. */
const MINDESTGROESSE = 100;

async function offeneBelege(): Promise<any[]> {
  return (await sqlPool`
    SELECT s.id, s.statement_no, s.net_cents, s.payout_id,
           COALESCE(LENGTH(s.pdf_base64), 0) AS groesse,
           x.status AS auszahlung_status, x.processed_at AS ausgezahlt_am,
           ag.name AS mitarbeiter
    FROM fiaon_commission_statements s
    JOIN fiaon_payouts x ON x.id = s.payout_id
    LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
    WHERE x.status = 'ausgezahlt'
      AND (s.pdf_base64 IS NULL OR LENGTH(s.pdf_base64) < ${MINDESTGROESSE})
    ORDER BY s.statement_no
  `) as any[];
}

async function main(): Promise<void> {
  titel("WELCHE AUSGEZAHLTEN ABRECHNUNGEN HABEN KEINEN BELEG?");
  const offen = await offeneBelege();
  log(`  ${String(offen.length).padStart(6)}  ausgezahlt und ohne Beleg\n`);
  for (const r of offen) {
    log(`  ${String(r.statement_no).padEnd(22)} `
      + `${(Number(r.net_cents ?? 0) / 100).toFixed(2).padStart(9)} € an ${r.mitarbeiter ?? "?"}, `
      + `ausgezahlt ${r.ausgezahlt_am ? new Date(r.ausgezahlt_am).toLocaleDateString("de-DE") : "?"}`);
  }

  if (offen.length === 0) {
    log("\n  Nichts zu tun.");
    await sqlPool.end();
    process.exit(0);
  }

  // ── DRUCKT CHROMIUM HIER? ─────────────────────────────────────────────
  // Ohne diese Prüfung würde der Lauf die Belege als Notbehelf erzeugen, und
  // ein Ersatzdruck ist für eine Buchhaltung die zweitbeste Lösung. Wer den
  // Lauf startet, soll VORHER wissen, was er bekommt.
  const { pdfBrowserPruefen } = await import("../server/lib/fiaon-html-pdf");
  const stand = await pdfBrowserPruefen();
  titel("DRUCKT CHROMIUM AUF DIESEM RECHNER?");
  if (stand.ok) {
    log(`  ok — Chromium startet (${stand.dauerMs} ms). Die Belege werden in der `
      + "vollen Fassung erzeugt.");
  } else {
    log(`  NEIN: ${stand.grund}`);
    log("  Die Belege würden als ERSATZDRUCK entstehen (lesbar, aber ohne laufende");
    log("  Fußzeile und Seitenzahl). Besser wäre ein Rechner mit Browser:");
    log("      npx playwright install chromium");
  }

  if (!SCHREIBEN) {
    titel("VORSCHAU — es wurde nichts erzeugt");
    log("  Mit --schreiben nachziehen.");
    await sqlPool.end();
    process.exit(0);
  }

  titel("ERZEUGEN");
  const { abrechnungNeuErzeugen } = await import("../server/routes/fiaon-onboarding");
  let fertig = 0;
  for (const r of offen) {
    const erg = await abrechnungNeuErzeugen(
      Number(r.id),
      "Nachlauf 21.08.2026 (Chromium fehlte auf Render)",
    ).catch((e: unknown) => ({ ok: false, grund: String((e as Error)?.message ?? e) }));
    if ((erg as any).ok) {
      fertig++;
      log(`  ok    ${r.statement_no}`);
    } else {
      log(`  ROT   ${r.statement_no}: ${(erg as any).grund ?? "unbekannt"}`);
    }
  }

  titel("ZÄHLPROBE");
  const nach = await offeneBelege();
  log(`  ${fertig} von ${offen.length} erzeugt.`);
  log(`  ${nach.length} ausgezahlte Abrechnungen ohne Beleg  (Ziel: 0)`);
  for (const r of nach) log(`      ${r.statement_no} — weiterhin ohne Beleg`);

  // Und die Größen, damit „erzeugt" nicht „leer angelegt" heißt.
  const groessen = (await sqlPool`
    SELECT s.statement_no, COALESCE(LENGTH(s.pdf_base64), 0) AS groesse,
           s.pdf_nachtraeglich, s.pdf_erzeugt_am
    FROM fiaon_commission_statements s
    WHERE s.id = ANY(${offen.map((r) => Number(r.id))})
    ORDER BY s.statement_no
  `) as any[];
  log("");
  for (const g of groessen) {
    log(`  ${String(g.statement_no).padEnd(22)} ${String(g.groesse).padStart(8)} Bytes`
      + `${g.pdf_nachtraeglich ? "  (nachträglich)" : ""}`);
  }

  await sqlPool.end();
  // Der offene Browser hält den Prozess sonst am Leben.
  process.exit(nach.length === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
