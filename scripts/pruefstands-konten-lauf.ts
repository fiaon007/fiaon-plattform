// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTANDS-KONTEN: WAS DARAN HÄNGT, GEHÖRT ZURÜCK
//
// ── WAS ICH GESTERN FALSCH BERICHTET HABE ─────────────────────────────────
// Am Ende der Notfall-Sitzung habe ich geschrieben: „10 Kunden hängen an
// stillgelegten Prüfstands-Konten aus früheren Sitzungen — die sieht aktuell
// niemand." Das war eine Vermutung aus einer Zählung, kein Befund.
//
// GEMESSEN (scripts/mess-pruefstands-konten.ts, 21.08.2026):
//   203 Konten tragen die Marke `is_test_account`.
//   16 Personen hängen daran — 11 davon sind SELBST Testeinträge (in Ordnung).
//   Die stillgelegten PRUEFSTAND-Konten halten AUSSCHLIESSLICH Testeinträge.
//   Alle produktiven Datensätze hängen an ZWEI Konten: #2 und #7.
//
// Und diese zwei sind keine Prüfstands-Konten. Sie heißen „Justin Schwarzott",
// sind AKTIV, haben ein Passwort und echte Adressen
// (office@schwarzott-global.com, js.schwarzott@icloud.com), angelegt am
// 04.07.2026 — es sind die Konten des Betreibers. Sie tragen die Marke
// `is_test_account` zu Unrecht.
//
// ── WARUM DAS TROTZDEM SCHADET ────────────────────────────────────────────
// JEDE Team-Ansicht filtert über `echteMitarbeiterSql()`. Diese zwei Konten
// fallen also aus Team-Zentrale, Kennzahlen, Rangliste und Verteilung heraus.
// Was daran hängt, ist damit unsichtbar:
//
//     5 Personen (3 davon HABEN BEZAHLT)      4 Bestellungen
//     3 Termine                                3 Leads
//     6 Provisionen über 591,60 €              1 Auszahlung
//     1 Vermerk
//
// ── DIE BEHEBUNG IST NICHT UMHÄNGEN, SONDERN ENTMARKIEREN ─────────────────
// Der Auftrag lautete „Zuweisung an echte Mitarbeiter". Das wäre hier falsch:
// Die Kunden sind bei ihrem richtigen Betreuer — der Betreuer ist nur falsch
// etikettiert. Umhängen würde fünf Menschen einem fremden Mitarbeiter geben
// und die Provisionen erst richtig durcheinanderbringen.
//
// Also: Marke weg, sonst nichts. Nur bei Konten, die die drei Merkmale eines
// echten Kontos tragen (aktiv, Passwort gesetzt, keine Prüfstands-Kennung im
// Namen) — und nur nach ausdrücklicher Freigabe (`--schreiben`).
//
//   npx tsx scripts/pruefstands-konten-lauf.ts               # Vorschau
//   npx tsx scripts/pruefstands-konten-lauf.ts --schreiben    # nach Freigabe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { istTestkontoSql, TEST_NAMENSMUSTER } from "../server/lib/fiaon-mitarbeiter-sicht";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Die drei Merkmale eines ECHTEN Kontos, das nur falsch markiert ist.
 *
 * Bewusst konservativ: Ein Konto ohne Passwort oder mit Prüfstands-Kennung im
 * Namen wird NICHT angefasst, auch wenn produktive Daten daran hängen. Dann
 * ist die Marke richtig und der Datensatz falsch — das ist ein anderer Fall
 * und braucht eine andere Entscheidung.
 */
const ECHT_TROTZ_MARKE = `(
  a.active
  AND a.password_hash IS NOT NULL
  AND NOT ${TEST_NAMENSMUSTER}
)`;

async function main(): Promise<void> {
  titel("1 — WELCHE MARKEN SIND FALSCH GESETZT?");
  const falsch = (await sqlPool.unsafe(`
    SELECT a.id, a.name, a.email, a.rolle, a.active, a.created_at,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
               AND p.ist_test_am IS NULL) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
               AND p.ist_test_am IS NULL
               AND EXISTS (SELECT 1 FROM fiaon_applications ap
                 WHERE ap.person_id = p.id AND ap.merged_into IS NULL
                   AND ap.archived_at IS NULL AND ap.payment_status = 'paid')) AS bezahlte,
           (SELECT COUNT(*)::int FROM fiaon_termine t
             WHERE t.agent_id = a.id AND t.abgesagt_am IS NULL) AS termine,
           (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provisionen,
           (SELECT COALESCE(SUM(c.amount_cents), 0)::bigint FROM fiaon_commissions c
             WHERE c.agent_id = a.id) AS provision_cents,
           (SELECT COUNT(*)::int FROM fiaon_leads l WHERE l.assigned_agent_id = a.id) AS leads
    FROM fiaon_agents a
    WHERE COALESCE(a.is_test_account, FALSE) AND ${ECHT_TROTZ_MARKE}
    ORDER BY a.id
  `)) as any[];

  if (falsch.length === 0) log("  Keine. Jede Marke sitzt auf einem echten Prüfstands-Konto.");
  for (const k of falsch) {
    log(`  #${k.id} ${k.name} <${k.email ?? "-"}>`);
    log(`        Rolle ${k.rolle} · aktiv · Passwort gesetzt · angelegt `
      + `${new Date(k.created_at).toLocaleDateString("de-DE")}`);
    log(`        daran: ${k.personen} Personen (${k.bezahlte} bezahlt), ${k.termine} Termine, `
      + `${k.provisionen} Provisionen (${(Number(k.provision_cents) / 100).toFixed(2)} €), ${k.leads} Leads`);
  }

  titel("2 — WAS WIRD DADURCH WIEDER SICHTBAR?");
  const sichtbar = (await sqlPool.unsafe(`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          p.company_name, 'Ohne Namen') AS name,
           a.id AS agent_id, a.name AS agent_name,
           EXISTS (SELECT 1 FROM fiaon_applications ap
             WHERE ap.person_id = p.id AND ap.merged_into IS NULL
               AND ap.archived_at IS NULL AND ap.payment_status = 'paid') AS bezahlt
    FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE COALESCE(a.is_test_account, FALSE) AND ${ECHT_TROTZ_MARKE}
      AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
    ORDER BY p.id
  `)) as any[];
  for (const p of sichtbar) {
    log(`  Person ${String(p.id).padEnd(8)} ${String(p.name).slice(0, 32).padEnd(33)} `
      + `${p.bezahlt ? "BEZAHLT" : "offen  "}  → #${p.agent_id} ${p.agent_name}`);
  }

  titel("3 — WAS BLEIBT UNANGETASTET");
  const bleibt = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS konten,
           COUNT(*) FILTER (WHERE a.active)::int AS aktiv
    FROM fiaon_agents a
    WHERE COALESCE(a.is_test_account, FALSE) AND NOT ${ECHT_TROTZ_MARKE}
  `)) as any[];
  log(`  ${bleibt[0].konten} echte Prüfstands-Konten behalten ihre Marke (${bleibt[0].aktiv} aktiv).`);
  const testPersonen = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE COALESCE(a.is_test_account, FALSE) AND NOT ${ECHT_TROTZ_MARKE}
      AND p.merged_into_person_id IS NULL
  `)) as any[];
  log(`  ${testPersonen[0].n} Personen hängen daran — alle selbst Testeinträge, deshalb kein Umhängen.`);

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/pruefstands-konten-vorschau.csv", "\uFEFF" + [
    ["art", "id", "name", "email", "personen", "bezahlte", "termine", "provisionen", "provision_eur", "leads"],
    ...falsch.map((k) => ["marke-entfernen", k.id, k.name, k.email ?? "", k.personen,
      k.bezahlte, k.termine, k.provisionen, (Number(k.provision_cents) / 100).toFixed(2), k.leads]),
    ...sichtbar.map((p) => ["wird-sichtbar", p.id, p.name, "", "", p.bezahlt ? "ja" : "nein",
      "", "", "", `Betreuer #${p.agent_id} ${p.agent_name}`]),
  ].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log("\n  → reports/pruefstands-konten-vorschau.csv");

  if (!SCHREIBEN) {
    titel("VORSCHAU — es wurde NICHTS geändert");
    log("  Mit --schreiben ausführen, wenn die Liste oben stimmt.");
    await sqlPool.end();
    return;
  }

  titel("SCHREIBEN");
  for (const k of falsch) {
    // NUR die Marke. Nicht `active`, nicht das Passwort, nicht die Verteilung —
    // wer ein Konto wieder in die Verteilung nehmen will, entscheidet das
    // getrennt in der Team-Zentrale.
    await sqlPool`
      UPDATE fiaon_agents SET is_test_account = FALSE WHERE id = ${Number(k.id)}
    `;
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${Number(k.id)}, 'testmarke_entfernt',
              ${JSON.stringify({ personen: k.personen, bezahlte: k.bezahlte, provisionen: k.provisionen })},
              'scripts/pruefstands-konten-lauf.ts',
              ${"Marke is_test_account zu Unrecht gesetzt — echtes Konto (aktiv, Passwort, kein Prüfstands-Name). "
                + "Dadurch fiel es aus jeder Team-Ansicht und alles daran war unsichtbar."})
    `.catch((e) => console.error(`[LAUF] Protokolleintrag für #${k.id} nicht geschrieben:`, e));
    log(`  #${k.id} ${k.name}: Marke entfernt.`);
  }

  // ── ZÄHLPROBE ─────────────────────────────────────────────────────────
  // Ein Lauf, der nicht nachzählt, behauptet nur, gewirkt zu haben.
  const [nach] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_agents a
    WHERE COALESCE(a.is_test_account, FALSE) AND ${ECHT_TROTZ_MARKE}
  `)) as any[];
  log(`\n  Zählprobe: ${nach.n} falsch markierte Konten übrig (muss 0 sein).`);
  const [sicht] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
  `)) as any[];
  log(`  Produktive Personen an Prüfstands-Konten: ${sicht.n} (muss 0 sein).`);
  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
