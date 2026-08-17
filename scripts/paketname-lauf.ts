// ═══════════════════════════════════════════════════════════════════════════
// BEZAHLT, ABER OHNE PAKETBEZEICHNUNG
//
//   npx tsx scripts/paketname-lauf.ts                nur Vorschau + CSV
//   npx tsx scripts/paketname-lauf.ts --schreiben    trägt die ableitbaren nach
//
// ── DER BEFUND (22.08.2026) ────────────────────────────────────────────────
// Der Betreiber meldete Bestellungen, die „bezahlt — ohne Bezeichnung" zeigen.
//
// GEMESSEN: 39 bezahlte Bestellungen ohne `pack_name`. Davon
//    5 mit einem Betrag (`amount_due`) — daraus lässt sich das Paket ableiten
//   34 ohne jeden Hinweis: kein Betrag, kein Bankeingang, kein Paket-Schlüssel
//
// ── WARUM DIE 34 NICHT „BEHOBEN" WERDEN ────────────────────────────────────
// Weil die Information nicht existiert. Ein geratenes Paket wäre schlimmer als
// eine Lücke: Es landet in der Rechnung, in der Abo-Rate und in der
// Provisionsrechnung, und niemand könnte hinterher sagen, ob es stimmt.
//
// Diese 34 bekommen daher KEINEN Namen, sondern werden ANGEZEIGT — als
// „Paket unbekannt (Altbestand)" mit der Bitte, es nachzutragen. Eine sichtbare
// Lücke ist ehrlich; eine gefüllte Lücke ist eine Behauptung.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(8)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}

/**
 * Die Preise, wie sie in der Antragsstrecke stehen.
 *
 * ── WARUM DIE TABELLE HIER STEHT UND NICHT GERATEN WIRD ──────────────────
 * Ein Betrag von 59,99 gehört eindeutig zu „Pro". Damit ist die Ableitung eine
 * RECHNUNG, keine Vermutung — und sie wird nur angewandt, wenn der Betrag
 * EXAKT passt. Alles andere bleibt eine Lücke.
 */
const PREISE: [number, string][] = [
  [7.99, "FIAON Starter (Das Fundament)"],
  [59.99, "FIAON Pro (Standard)"],
  [79.99, "FIAON Ultra (Elite Konto)"],
  [99.99, "FIAON High End (Das Maximum)"],
];

function paketAusBetrag(betrag: unknown): string | null {
  const b = Number(betrag);
  if (!Number.isFinite(b)) return null;
  for (const [preis, name] of PREISE) {
    if (Math.abs(b - preis) < 0.005) return name;
  }
  return null;
}

function feld(v: unknown): string {
  const s = v == null ? "" : String(v).replace(/[\r\n]+/g, " ");
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  log(SCHREIBEN
    ? "\n  ⚠  SCHREIBMODUS — ableitbare Paketnamen werden nachgetragen."
    : "\n  VORSCHAU. Nichts wird geändert. Zum Schreiben: --schreiben");

  titel("DIE BETROFFENEN");
  const zeilen = (await sqlPool`
    SELECT a.ref, a.person_id, a.amount_due, a.status, a.created_at::date AS am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name) AS name,
           a.pack_key
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_status = 'paid'
      AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NULLIF(TRIM(COALESCE(a.pack_name, '')), '') IS NULL
    ORDER BY a.created_at DESC
  `) as any[];

  const ableitbar = zeilen.filter((z) => paketAusBetrag(z.amount_due) !== null);
  const luecke = zeilen.filter((z) => paketAusBetrag(z.amount_due) === null);

  zahl("Bezahlt ohne Paketbezeichnung", zeilen.length);
  zahl("… aus dem Betrag ABLEITBAR", ableitbar.length, "exakter Preistreffer");
  zahl("… ohne jeden Hinweis", luecke.length,
    "kein Betrag, kein Bankeingang — die Information existiert nicht");

  log("\n  DIE ABLEITBAREN:");
  for (const z of ableitbar) {
    log(`    ${String(z.ref).padEnd(24)} ${String(z.name ?? "").padEnd(26)} `
      + `${String(z.amount_due).padStart(7)} € → ${paketAusBetrag(z.amount_due)}`);
  }

  log("\n  DIE LÜCKEN (bekommen KEINEN geratenen Namen):");
  for (const z of luecke.slice(0, 12)) {
    log(`    ${String(z.ref).padEnd(24)} ${String(z.name ?? "").padEnd(26)} `
      + `Betrag: ${String(z.amount_due ?? "—").padStart(7)} · ${z.am}`);
  }
  if (luecke.length > 12) log(`    … und ${luecke.length - 12} weitere`);

  mkdirSync("reports", { recursive: true });
  const kopf = ["ref", "name", "amount_due", "am", "wirkung"];
  writeFileSync("reports/lauf-paketname.csv",
    `${[kopf.join(";"), ...zeilen.map((z) => [
      feld(z.ref), feld(z.name), feld(z.amount_due), feld(z.am),
      feld(paketAusBetrag(z.amount_due) ?? "LÜCKE — wird angezeigt, nicht geraten"),
    ].join(";"))].join("\n")}\n`, "utf8");
  log("\n  CSV: reports/lauf-paketname.csv");

  if (!SCHREIBEN) {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log("  Das war die VORSCHAU. Zum Nachtragen der ableitbaren:");
    log("  npx tsx scripts/paketname-lauf.ts --schreiben");
    log("");
    await sqlPool.end();
    return;
  }

  titel("NACHTRAGEN");
  let geschrieben = 0;
  for (const z of ableitbar) {
    const name = paketAusBetrag(z.amount_due);
    if (!name) continue;
    const r = (await sqlPool`
      UPDATE fiaon_applications
      SET pack_name = ${name}, updated_at = NOW()
      WHERE ref = ${z.ref} AND merged_into IS NULL
        -- Nur wenn wirklich noch leer: Zwischen Vorschau und Lauf kann jemand
        -- von Hand eingetragen haben, und dann gilt seine Eingabe.
        AND NULLIF(TRIM(COALESCE(pack_name, '')), '') IS NULL
      RETURNING ref
    `) as any[];
    if (r.length > 0) {
      geschrieben++;
      // Jede Änderung am Bestand braucht eine Spur.
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${z.ref}, NULL, 'System', 'system',
                ${`Paketbezeichnung nachgetragen: „${name}“ — aus dem Betrag `
                  + `${z.amount_due} € abgeleitet (exakter Preistreffer). `
                  + `Vorher war das Feld leer, die Bestellung zeigte „bezahlt ohne Bezeichnung“.`})
      `.catch(() => {});
    }
  }
  zahl("Nachgetragen", geschrieben);

  // ── ZÄHLPROBE ────────────────────────────────────────────────────────────
  const [nach] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE amount_due IS NOT NULL)::int AS mit_betrag
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL AND payment_status = 'paid'
      AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NULLIF(TRIM(COALESCE(pack_name, '')), '') IS NULL
  `) as any[];
  zahl("Noch ohne Bezeichnung", nach.n, `davon ${nach.mit_betrag} mit Betrag`);
  if (Number(nach.mit_betrag) > 0) {
    log("  ACHTUNG: Es sind noch Zeilen MIT Betrag übrig — der Preis passte nicht");
    log("  exakt auf die Tabelle. Sie stehen in der CSV und brauchen einen Blick.");
    process.exitCode = 1;
  } else {
    log("  Richtig: Alle ableitbaren sind nachgetragen. Die übrigen haben keine");
    log("  Information, aus der sich etwas ableiten ließe — sie werden in der");
    log("  Verwaltung als „Paket unbekannt (Altbestand)“ angezeigt.");
  }

  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
