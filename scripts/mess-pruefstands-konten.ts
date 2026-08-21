// ═══════════════════════════════════════════════════════════════════════════
// WAS HÄNGT AN PRÜFSTANDS-KONTEN? — ALLE OBJEKTTYPEN, NICHT NUR PERSONEN
//
// ── DER BEFUND (21.08.2026, am Ende der Notfall-Sitzung) ──────────────────
// Beim Aufräumen fiel auf: zehn Kunden sind einem stillgelegten
// Prüfstands-Konto zugewiesen. Ein Kunde, dessen Betreuer ein Konto ist, das
// niemand benutzt, steht in keiner Arbeitsliste — er ist unsichtbar. Bei
// bezahlten Menschen ist das der schlimmste Zustand, den diese Plattform
// kennt: Er wartet, und niemand ruft an.
//
// ── WARUM DIESER LAUF NICHT NUR PERSONEN ZÄHLT ───────────────────────────
// „Zehn Kunden" war die Zahl, die auffiel. Sie ist nicht die Frage. Ein Konto
// kann Besitzer von SEHR viel mehr sein: Termine, Anrufe, Aufgaben,
// Verlaufseinträge, Provisionen, Raten. Wer nur die Spalte prüft, die er
// gerade gesehen hat, findet genau einen der Fälle.
//
// Deshalb geht dieser Lauf über `information_schema`: Er sucht ALLE Spalten in
// allen `fiaon_*`-Tabellen, die auf einen Mitarbeiter zeigen können, und zählt
// je Spalte, wie viele Zeilen an einem Prüfstands-Konto hängen. Eine Spalte,
// die morgen dazukommt, wird damit von selbst mitgezählt.
//
// NUR LESEND. Schreibt reports/pruefstands-konten-bestand.csv.
//
//   npx tsx scripts/mess-pruefstands-konten.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { istTestkontoSql } from "../server/lib/fiaon-mitarbeiter-sicht";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSchreiben(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  writeFileSync(datei, "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

/**
 * Spalten, die auf einen Mitarbeiter zeigen — aus dem Katalog, nicht aus dem
 * Gedächtnis.
 *
 * Die Namensmuster sind bewusst breit (`%agent_id`, `agent_id`, `%_by`), und
 * jede Spalte wird danach GEGEN `fiaon_agents` geprüft: Trifft kein einziger
 * Wert einen Mitarbeiter, ist es keine Besitz-Spalte, sondern ein Zufall im
 * Namen. So braucht der Lauf keine gepflegte Liste, die veraltet.
 */
async function besitzSpalten(): Promise<{ tabelle: string; spalte: string }[]> {
  const kandidaten = (await sqlPool`
    SELECT c.table_name AS tabelle, c.column_name AS spalte
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'fiaon\\_%'
      AND c.data_type IN ('integer', 'bigint', 'smallint')
      AND (c.column_name LIKE '%agent_id' OR c.column_name = 'agent_id'
        OR c.column_name LIKE 'agent\\_%' OR c.column_name LIKE '%_agent'
        OR c.column_name IN ('owner_id', 'created_by', 'assigned_to', 'bearbeiter_id'))
    ORDER BY 1, 2
  `) as any[];

  const echt: { tabelle: string; spalte: string }[] = [];
  for (const k of kandidaten) {
    // Zeigt diese Spalte wirklich auf Mitarbeiter? Eine Zeile genügt als Beweis.
    const [t] = (await sqlPool.unsafe(`
      SELECT 1 AS ok FROM "${k.tabelle}" x
      JOIN fiaon_agents a ON a.id = x."${k.spalte}"
      LIMIT 1
    `).catch(() => [])) as any[];
    if (t) echt.push({ tabelle: String(k.tabelle), spalte: String(k.spalte) });
  }
  return echt;
}

async function main(): Promise<void> {
  titel("1 — WELCHE KONTEN SIND PRÜFSTANDS-KONTEN?");
  // Die Marke UND das Namensmuster — dieselbe Definition, die jede
  // Team-Ansicht benutzt (server/lib/fiaon-mitarbeiter-sicht.ts). Eine zweite
  // hier würde genau die Frage anders beantworten, um die es geht.
  const konten = (await sqlPool.unsafe(`
    SELECT a.id, a.name, a.email, a.rolle, a.active,
           COALESCE(a.is_test_account, FALSE) AS marke,
           ${istTestkontoSql("a")} AS ist_test,
           a.created_at
    FROM fiaon_agents a
    WHERE ${istTestkontoSql("a")}
    ORDER BY a.id
  `)) as any[];
  const nurMuster = konten.filter((k) => !k.marke);
  log(`  ${z(konten.length)}  Prüfstands-Konten insgesamt`);
  log(`  ${z(konten.filter((k) => k.marke).length)}  davon über die Marke is_test_account`);
  log(`  ${z(nurMuster.length)}  davon NUR über das Namensmuster erkannt`);
  log(`  ${z(konten.filter((k) => k.active).length)}  davon noch AKTIV`);
  if (nurMuster.length > 0) {
    log("\n  Ohne Marke (nur am Namen erkannt) — hier greift kein Marken-Filter:");
    for (const k of nurMuster) log(`      #${k.id} ${k.name} (${k.email ?? "-"})`);
  }
  const aktiv = konten.filter((k) => k.active);
  if (aktiv.length > 0) {
    log("\n  Noch aktiv:");
    for (const k of aktiv) {
      log(`      #${k.id} ${String(k.name).slice(0, 46).padEnd(47)} `
        + `${String(k.rolle ?? "-").padEnd(16)} angelegt ${new Date(k.created_at).toLocaleDateString("de-DE")}`);
    }
  }

  titel("2 — WELCHE ECHTEN DATENSÄTZE HÄNGEN DARAN?");
  const spalten = await besitzSpalten();
  log(`  ${spalten.length} Besitz-Spalten gefunden (aus dem Katalog abgeleitet, nicht aufgezählt):\n`);

  const zeilen: unknown[][] = [];
  let gesamt = 0;
  log("  Anzahl  Tabelle.Spalte");
  log("  " + "─".repeat(60));
  for (const s of spalten) {
    const [n] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM "${s.tabelle}" x
      JOIN fiaon_agents a ON a.id = x."${s.spalte}"
      WHERE ${istTestkontoSql("a")}
    `).catch(() => [{ n: 0 }])) as any[];
    const anzahl = Number(n?.n ?? 0);
    if (anzahl === 0) continue;
    gesamt += anzahl;
    log(`  ${z(anzahl)}  ${s.tabelle}.${s.spalte}`);
    zeilen.push([s.tabelle, s.spalte, anzahl]);
  }
  if (zeilen.length === 0) log("  (nichts — kein einziger Datensatz hängt an einem Prüfstands-Konto)");
  log(`\n  ${z(gesamt)}  Datensätze insgesamt an Prüfstands-Konten`);

  titel("3 — DIE PERSONEN, NAMENTLICH (das ist der teuerste Fall)");
  // Warum Personen getrennt: Eine Person ohne erreichbaren Betreuer steht in
  // keiner Arbeitsliste. Ein Anruf-Protokolleintrag an einem Testkonto ist
  // Unordnung; ein bezahlter Kunde ohne Betreuer ist Umsatzverlust.
  const personen = (await sqlPool.unsafe(`
    SELECT p.id, p.assigned_agent_id AS agent_id, a.name AS agent_name, a.active AS agent_aktiv,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           p.primary_email AS email, p.priority_tier,
           p.betreuung_seit, p.ist_test_am,
           EXISTS (SELECT 1 FROM fiaon_applications ap
             WHERE ap.person_id = p.id AND ap.merged_into IS NULL
               AND ap.archived_at IS NULL AND ap.payment_status = 'paid') AS hat_bezahlt,
           (SELECT MAX(ap.created_at) FROM fiaon_applications ap
             WHERE ap.person_id = p.id AND ap.merged_into IS NULL) AS letzte_bestellung,
           EXISTS (SELECT 1 FROM fiaon_termine t
             WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
               AND t.quelle = 'onboarding_call' AND t.status = 'erledigt') AS onboarding_fertig
    FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL
    ORDER BY p.id
  `)) as any[];

  log(`  ${z(personen.length)}  Personen hängen an einem Prüfstands-Konto`);
  log(`  ${z(personen.filter((p) => p.hat_bezahlt).length)}  davon haben BEZAHLT`);
  log(`  ${z(personen.filter((p) => p.ist_test_am).length)}  davon sind selbst Testeinträge (dann ist es in Ordnung)`);
  log("");
  log("  Person   Name                            bezahlt  Testeintrag  hängt an");
  log("  " + "─".repeat(72));
  for (const p of personen) {
    log(`  ${String(p.id).padEnd(8)} ${String(p.name).slice(0, 30).padEnd(31)} `
      + `${p.hat_bezahlt ? "JA     " : "nein   "}  ${p.ist_test_am ? "ja         " : "nein       "}  `
      + `#${p.agent_id} ${String(p.agent_name).slice(0, 26)}`);
  }

  csvSchreiben("reports/pruefstands-konten-bestand.csv",
    ["art", "tabelle", "spalte_oder_person", "anzahl_oder_name", "bezahlt", "ist_testeintrag",
      "konto_id", "konto_name", "konto_aktiv"],
    [
      ...konten.map((k) => ["konto", "fiaon_agents", String(k.id), k.name,
        "", "", k.id, k.name, k.active ? "ja" : "nein"]),
      ...zeilen.map((r) => ["besitz", r[0], r[1], r[2], "", "", "", "", ""]),
      ...personen.map((p) => ["person", "fiaon_persons", String(p.id), p.name,
        p.hat_bezahlt ? "ja" : "nein", p.ist_test_am ? "ja" : "nein",
        p.agent_id, p.agent_name, p.agent_aktiv ? "ja" : "nein"]),
    ]);

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
