// ═══════════════════════════════════════════════════════════════════════════
// WELCHE AUSGEZAHLTEN ABRECHNUNGEN HABEN KEINEN BELEG?
//
// ── DER NOTFALL (21.08.2026) ──────────────────────────────────────────────
// Produktionsfehler beim Auszahlen:
//
//     browserType.launch: Executable doesn't exist at
//     /opt/render/.cache/ms-playwright/chromium_headless_shell-1200/
//     chrome-headless-shell-linux64/chrome-headless-shell
//
// Folge: FIAON-COM-2026-0012 und 0013 sind als überwiesen gebucht und haben
// KEIN PDF. „Neu erzeugen" scheitert an derselben Stelle — der Betreiber kommt
// aus der Schleife nicht heraus.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-pdf-belege.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

async function main(): Promise<void> {
  titel("1 — ALLE ABRECHNUNGEN: BELEG DA ODER NICHT?");
  const zeilen = (await sqlPool`
    SELECT s.id, s.statement_no, s.payout_id, s.issued_at,
           s.net_cents, s.pdf_erzeugt_am, s.pdf_nachtraeglich,
           (s.pdf_base64 IS NOT NULL AND LENGTH(s.pdf_base64) > 100) AS hat_pdf,
           COALESCE(LENGTH(s.pdf_base64), 0) AS groesse,
           x.status AS auszahlung_status, x.processed_at AS ausgezahlt_am,
           ag.name AS mitarbeiter
    FROM fiaon_commission_statements s
    LEFT JOIN fiaon_payouts x ON x.id = s.payout_id
    LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
    ORDER BY s.statement_no
  `) as any[];

  log(`  ${z(zeilen.length)}  Abrechnungen insgesamt`);
  log(`  ${z(zeilen.filter((r) => r.hat_pdf).length)}  mit Beleg`);
  log(`  ${z(zeilen.filter((r) => !r.hat_pdf).length)}  OHNE Beleg`);
  log("");
  log("  Nummer                 Beleg      Größe  Auszahlung   Mitarbeiter");
  log("  " + "─".repeat(70));
  for (const r of zeilen) {
    log(`  ${String(r.statement_no).padEnd(22)} ${r.hat_pdf ? "ja   " : "NEIN "} `
      + `${z(Number(r.groesse), 10)}  ${String(r.auszahlung_status ?? "-").padEnd(12)} `
      + `${String(r.mitarbeiter ?? "-").slice(0, 22)}`);
  }

  titel("2 — DIE ZÄHLPROBE DES AUFTRAGS: AUSGEZAHLT UND OHNE BELEG");
  // ── DER ZUSTAND HEISST „ausgezahlt", NICHT „paid" ──────────────────────
  // Erster Entwurf verglich gegen `paid`. Ergebnis: „0 ausgezahlte
  // Abrechnungen ohne Beleg" — bei zwei Fällen, die genau das sind. Eine
  // Zählprobe, die den Zustandsnamen errät, meldet Erfolg, wo keiner ist.
  // `fiaon_payouts.status` kennt „ausgezahlt"; nachgesehen, nicht geraten.
  const AUSGEZAHLT = "ausgezahlt";
  const kritisch = zeilen.filter((r) =>
    !r.hat_pdf && String(r.auszahlung_status ?? "") === AUSGEZAHLT);
  log(`  ${z(kritisch.length)}  ausgezahlte Abrechnungen ohne Beleg  (Ziel: 0)`);
  for (const r of kritisch) {
    log(`      ${String(r.statement_no).padEnd(22)} `
      + `${(Number(r.net_cents ?? 0) / 100).toFixed(2)} € an ${r.mitarbeiter ?? "?"}, `
      + `ausgezahlt ${r.ausgezahlt_am ? new Date(r.ausgezahlt_am).toLocaleDateString("de-DE") : "?"}`);
  }

  titel("3 — UND DIE, DIE NOCH NICHT AUSGEZAHLT SIND");
  const wartend = zeilen.filter((r) =>
    !r.hat_pdf && String(r.auszahlung_status ?? "") !== AUSGEZAHLT);
  log(`  ${z(wartend.length)}  ohne Beleg, aber auch nicht ausgezahlt`);
  for (const r of wartend) {
    log(`      ${String(r.statement_no).padEnd(22)} Auszahlung: ${r.auszahlung_status ?? "keine"}`);
  }

  titel("4 — LÄUFT DIE PDF-ERZEUGUNG AUF DIESEM RECHNER?");
  // Der Beweis, dass die Kette selbst heil ist: Ein leeres Dokument drucken.
  // Scheitert es hier, ist es nicht Render, sondern der Code.
  const t0 = Date.now();
  try {
    const { htmlToPdf } = await import("../server/lib/fiaon-html-pdf");
    const buf = await htmlToPdf("<html><body><h1>Probe</h1></body></html>");
    const istPdf = buf.subarray(0, 5).toString() === "%PDF-";
    log(`  ok    Chromium druckt (${buf.length} Bytes, ${Date.now() - t0} ms, `
      + `Kopf ${istPdf ? "%PDF-" : buf.subarray(0, 5).toString()})`);
  } catch (e: any) {
    log(`  ROT   Chromium druckt NICHT: ${String(e?.message ?? e).slice(0, 200)}`);
  }

  titel("5 — WAS DER BROWSER VERLANGT UND WO ER LIEGT");
  const browsers = await import("playwright-core/browsers.json", { with: { type: "json" } })
    .then((m: any) => m.default).catch(() => null);
  if (browsers) {
    for (const b of browsers.browsers) {
      if (/^chromium/.test(b.name) && b.installByDefault) {
        log(`  ${String(b.name).padEnd(30)} Revision ${b.revision}`);
      }
    }
  }
  log(`  PLAYWRIGHT_BROWSERS_PATH = ${process.env.PLAYWRIGHT_BROWSERS_PATH ?? "(nicht gesetzt)"}`);

  await sqlPool.end();
  // ── DER BROWSER HÄLT DEN PROZESS OFFEN ────────────────────────────────
  // `htmlToPdf` lässt die Chromium-Instanz absichtlich stehen (sie wird für
  // weitere Dokumente wiederverwendet). In einem Messlauf heißt das: Das
  // Skript ist fertig und kehrt nie zurück. Gemerkt daran, dass zwei Läufe
  // minutenlang „still running" waren.
  process.exit(0);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
