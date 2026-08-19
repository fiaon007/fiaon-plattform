// ═══════════════════════════════════════════════════════════════════════════
// WARUM STEHT EIN VOLLSTÄNDIGER ANTRAG „NOCH IM FORMULAR"?
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Bei einigen Kunden wird angezeigt, dass sich der Antrag noch ‚im Formular'
// befindet und man den Kunden anrufen soll. Das Problem ist, dass der Antrag
// aus meiner Sicht bereits vollständig ausgefüllt ist. Es ist nicht ersichtlich,
// welche Information noch fehlt."
//
// ── WAS DIESER LAUF MISST ─────────────────────────────────────────────────
//   1. Wie viele Personen tragen welchen Sperrgrund (`sendeGrundSql`)?
//   2. Bei `antrag_unfertig`: WELCHER Antragszustand steht in der Zeile?
//   3. Ist der Antrag INHALTLICH voll? Feld für Feld, je Fall — das ist die
//      Tabelle, die der Auftrag verlangt.
//   4. Das Zustellprotokoll der letzten sieben Tage: Rechnungs- und
//      Zahlungsdaten-Sendungen nach Ausgang, Fehlschläge mit Grund.
//
// NUR LESEND. Schreibt zwei CSV nach reports/.
//
//   npx tsx scripts/mess-rechnung-blockade.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { sendeGrundSql } from "../server/lib/fiaon-massgebliche-bestellung";
import { PFLICHTFELDER, fehlendeFelder } from "../server/lib/fiaon-antrag-vollstaendig";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

/** CSV-Feld: Semikolon-Trennung, deutsches Excel (AGENTS.md). */
function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSchreiben(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  const text = "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(csvFeld).join(";")).join("\n");
  writeFileSync(datei, text);
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1 — DER SPERRGRUND ÜBER DEN GANZEN BESTAND");
  // ═════════════════════════════════════════════════════════════════════════
  // Dieselbe Funktion, die die Arbeitsliste benutzt. Keine zweite Fassung der
  // Regel — sonst misst der Lauf etwas anderes als der Agent sieht.
  const gruende = (await sqlPool.unsafe(`
    SELECT ${sendeGrundSql("p")} AS grund, COUNT(*)::int AS anzahl
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND COALESCE(p.is_blocked, FALSE) = FALSE
    GROUP BY 1 ORDER BY 2 DESC
  `)) as any[];
  for (const g of gruende) log(`  ${z(g.anzahl)}  ${g.grund}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2 — ANTRAG_UNFERTIG: WELCHER ZUSTAND STEHT IN DER ZEILE?");
  // ═════════════════════════════════════════════════════════════════════════
  const zustaende = (await sqlPool.unsafe(`
    SELECT a.status, a.payment_status, COUNT(*)::int AS anzahl
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id
     AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    WHERE p.merged_into_person_id IS NULL
      AND COALESCE(p.is_blocked, FALSE) = FALSE
      AND ${sendeGrundSql("p")} = 'antrag_unfertig'
    GROUP BY 1, 2 ORDER BY 3 DESC
  `)) as any[];
  log("  Anzahl  status                 payment_status");
  log("  " + "─".repeat(56));
  for (const s of zustaende) {
    log(`  ${z(s.anzahl)}  ${String(s.status ?? "(leer)").padEnd(22)} ${s.payment_status ?? "(leer)"}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3 — IST DER ANTRAG INHALTLICH VOLL? (Feld für Feld)");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Pflichtfelder kommen aus der EINEN Liste, die auch die Ableitung im
  // Server benutzt (`fiaon-antrag-vollstaendig.ts`). Eine zweite Liste hier
  // würde genau die Frage anders beantworten, um die es geht.
  log(`  Pflichtfelder (${PFLICHTFELDER.length}): `
    + PFLICHTFELDER.map((f) => f.spalte).join(", "));

  const faelle = (await sqlPool.unsafe(`
    SELECT a.ref, a.person_id, a.status, a.payment_status, a.created_at, a.updated_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent_name,
           ${PFLICHTFELDER.map((f) => `a.${f.spalte}`).join(", ")},
           COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                    NULLIF(TRIM(a.billing_email),''), NULLIF(TRIM(p.primary_email),'')) AS empfaenger
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id
     AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL
      AND COALESCE(p.is_blocked, FALSE) = FALSE
      AND ${sendeGrundSql("p")} = 'antrag_unfertig'
    ORDER BY a.updated_at DESC NULLS LAST
  `)) as any[];

  let voll = 0;
  const luecken = new Map<string, number>();
  const zeilen: unknown[][] = [];
  for (const f of faelle) {
    const fehlt = fehlendeFelder(f);
    if (fehlt.length === 0) voll++;
    for (const n of fehlt) luecken.set(n, (luecken.get(n) ?? 0) + 1);
    zeilen.push([
      f.ref, f.person_id, f.name, f.agent_name ?? "(niemand)", f.status, f.payment_status,
      fehlt.length === 0 ? "VOLL" : `fehlt: ${fehlt.join(", ")}`,
      f.empfaenger ?? "",
      f.updated_at ? new Date(f.updated_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "",
    ]);
  }

  log(`\n  ${z(faelle.length)}  Anträge stehen auf „im Formular"`);
  log(`  ${z(voll)}  davon tragen ALLE Pflichtfelder — sie sind fertig und werden`);
  log("          trotzdem blockiert. Das ist Daniels Meldung, in einer Zahl.");
  log(`  ${z(faelle.length - voll)}  davon fehlt wirklich etwas:`);
  const sortiert = Array.from(luecken.entries()).sort((a, b) => b[1] - a[1]);
  for (const [name, n] of sortiert) log(`          ${z(n, 5)}× ${name}`);

  // ── DIE TABELLE FÜR DEN REPORT: zehn Fälle, die ungünstigsten zuerst ────
  // AGENTS.md: „Der ungünstigste Fall, nicht der erstbeste." Also die
  // vollständigen zuerst — sie sind der Beweis, nicht die halbleeren.
  titel("4 — ZEHN KONKRETE FÄLLE (vollständige zuerst)");
  const geordnet = [...zeilen].sort((a, b) =>
    (a[6] === "VOLL" ? 0 : 1) - (b[6] === "VOLL" ? 0 : 1));
  log("  Referenz          Person  Zustand         Befund");
  log("  " + "─".repeat(72));
  for (const r of geordnet.slice(0, 10)) {
    log(`  ${String(r[0]).padEnd(17)} ${String(r[1]).padEnd(7)} `
      + `${String(r[4]).padEnd(15)} ${r[6]}`);
  }
  csvSchreiben("reports/rechnung-blockade.csv",
    ["ref", "person_id", "name", "agent", "status", "payment_status", "befund",
      "empfaenger", "zuletzt_geaendert"], zeilen);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5 — DAS ZUSTELLPROTOKOLL, LETZTE 7 TAGE (Rechnung + Zahlungsdaten)");
  // ═════════════════════════════════════════════════════════════════════════
  const ausgang = (await sqlPool`
    SELECT event, status, COUNT(*)::int AS anzahl
    FROM fiaon_mail_log
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND event IN ('payment_details', 'agent_payment_reminder')
    GROUP BY 1, 2 ORDER BY 1, 3 DESC
  `) as any[];
  if (ausgang.length === 0) log("  (keine Sendungen in sieben Tagen)");
  log("  Anzahl  Ereignis                   Ausgang");
  log("  " + "─".repeat(58));
  for (const a of ausgang) {
    log(`  ${z(a.anzahl)}  ${String(a.event).padEnd(26)} ${a.status}`);
  }

  const fehl = (await sqlPool`
    SELECT l.created_at, l.event, l.status, l.empfaenger, l.grund, l.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name
    FROM fiaon_mail_log l
    LEFT JOIN fiaon_persons p ON p.id = l.person_id
    WHERE l.created_at > NOW() - INTERVAL '7 days'
      AND l.event IN ('payment_details', 'agent_payment_reminder')
      AND l.status NOT IN ('ok', 'versandt')
    ORDER BY l.created_at DESC
  `) as any[];
  log(`\n  ${z(fehl.length)}  Sendungen NICHT angenommen — Gründe:`);
  const fg = new Map<string, number>();
  for (const f of fehl) {
    const g = `${f.status}: ${String(f.grund ?? "(ohne Grund)").slice(0, 60)}`;
    fg.set(g, (fg.get(g) ?? 0) + 1);
  }
  for (const [g, n] of Array.from(fg.entries()).sort((a, b) => b[1] - a[1])) {
    log(`          ${z(n, 5)}× ${g}`);
  }
  csvSchreiben("reports/zustellprotokoll-7tage.csv",
    ["zeit", "ereignis", "ausgang", "empfaenger", "grund", "person_id", "name"],
    fehl.map((f) => [
      new Date(f.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
      f.event, f.status, f.empfaenger ?? "", f.grund ?? "", f.person_id ?? "", f.name,
    ]));

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
