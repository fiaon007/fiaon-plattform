// ═══════════════════════════════════════════════════════════════════════════
// DIE RUHE-STAFFEL AUF DEN BESTAND ANWENDEN
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Kunden, die bereits mehrfach erfolglos angerufen wurden, teilweise 10–12 Mal
// oder mehr, erscheinen trotzdem weiterhin weit oben."
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// 26 Personen mit neun und mehr erfolglosen Versuchen standen in der
// Arbeitsliste. Die Automatik feuerte nur EINMAL (Begründung in
// `server/lib/fiaon-nicht-erreicht.ts`), und Stufe A war dauerhaft ausgenommen.
//
// ── WAS DER LAUF TUT ───────────────────────────────────────────────────────
// Er wendet die neue Staffel auf den BESTAND an — die Automatik greift ab jetzt
// bei jedem neuen Fehlversuch, aber die 26 von heute ruft sie nie an, weil bei
// ihnen kein neuer Versuch mehr dokumentiert werden soll.
//
//   ab 9 Versuchen   ruhe_seit setzen, Wiedervorlage leeren  → RUHEND
//   3–8 Versuche     Wiedervorlage strecken, wenn sie fällig ist
//
// Er fasst NICHT an: gesperrte, zusammengeführte, DSGVO-gelöschte Personen und
// jeden, der einen Termin in der Zukunft hat — ein gebuchter Termin ist das
// Gegenteil von „nicht erreichbar".
//
//   npx tsx scripts/ruhe-staffel-nachziehen.ts              # Vorschau
//   npx tsx scripts/ruhe-staffel-nachziehen.ts --schreiben  # anwenden
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  SCHWELLE_RUHEND, SCHWELLE_STRECKEN, SCHWELLE_MAIL,
  STRECKUNG_TAGE, STRECKUNG_TAGE_LANG, ruhtSql,
} from "../server/lib/fiaon-nicht-erreicht";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

/** Ein Termin in der Zukunft heißt: Der Kunde hat sich gemeldet. Finger weg. */
const HAT_TERMIN = `EXISTS (SELECT 1 FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW())`;

const LEBENDIG = `p.merged_into_person_id IS NULL
    AND COALESCE(p.is_blocked, FALSE) = FALSE
    AND NOT ${HAT_TERMIN}`;

async function main(): Promise<void> {
  titel(`RUHE-STAFFEL NACHZIEHEN — ${SCHREIBEN ? "SCHREIBEND" : "VORSCHAU"}`);
  log(`  Staffel: ab ${SCHWELLE_STRECKEN} Versuchen +${STRECKUNG_TAGE} Tage, `
    + `ab ${SCHWELLE_MAIL} +${STRECKUNG_TAGE_LANG} Tage, ab ${SCHWELLE_RUHEND} RUHEND.`);

  // ── GRUPPE 1: RUHEND ────────────────────────────────────────────────────
  const ruhend = (await sqlPool.unsafe(`
    SELECT p.id, p.unreachable_count AS v, p.priority_tier, p.ruhe_seit, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE ${LEBENDIG}
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_RUHEND}
       AND NOT ${ruhtSql("p")}
     ORDER BY p.unreachable_count DESC
  `)) as any[];

  log(`\n  ${ruhend.length} Personen mit >= ${SCHWELLE_RUHEND} Versuchen stehen noch in der Tagesliste:`);
  log("  Versuche  Stufe  Betreuer             Kunde");
  log("  " + "─".repeat(70));
  for (const r of ruhend) {
    log(`  ${String(r.v).padStart(8)}  ${String(r.priority_tier ?? "-").padStart(5)}  `
      + `${String(r.agent ?? "(niemand)").padEnd(20)} ${r.name}`);
  }

  // ── GRUPPE 2: WIEDERVORLAGE STRECKEN ────────────────────────────────────
  const strecken = (await sqlPool.unsafe(`
    SELECT p.id, p.unreachable_count AS v, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name
      FROM fiaon_persons p
     WHERE ${LEBENDIG}
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_STRECKEN}
       AND COALESCE(p.unreachable_count, 0) < ${SCHWELLE_RUHEND}
       AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
     ORDER BY p.unreachable_count DESC
  `)) as any[];
  log(`\n  ${strecken.length} Personen mit ${SCHWELLE_STRECKEN}–${SCHWELLE_RUHEND - 1} Versuchen sind fällig`);
  log("  und bekommen eine gestreckte Wiedervorlage.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/ruhe-staffel-nachziehen.csv", "\uFEFF"
    + ["person_id;name;betreuer;versuche;stufe;wirkung"]
      .concat(ruhend.map((r) => `${r.id};${r.name};${r.agent ?? ""};${r.v};${r.priority_tier ?? ""};RUHEND`))
      .concat(strecken.map((r) => `${r.id};${r.name};;${r.v};;Wiedervorlage gestreckt`))
      .join("\n"));
  log(`\n  → reports/ruhe-staffel-nachziehen.csv (${ruhend.length + strecken.length} Zeilen)`);

  if (!SCHREIBEN) {
    log("\n  Das ist die VORSCHAU. Es wurde nichts geändert.");
    log("  Anwenden mit: npx tsx scripts/ruhe-staffel-nachziehen.ts --schreiben");
    await zaehlprobe();
    await sqlPool.end();
    return;
  }

  let a = 0;
  for (const r of ruhend) {
    const erg = await sqlPool`
      UPDATE fiaon_persons
         SET ruhe_seit = COALESCE(ruhe_seit, NOW()), follow_up_date = NULL, updated_at = NOW()
       WHERE id = ${r.id} AND COALESCE(unreachable_count, 0) >= ${SCHWELLE_RUHEND}
    `;
    if ((erg as any).count > 0) a++;
  }
  log(`\n  ${a} Personen auf RUHEND gesetzt.`);

  let b = 0;
  for (const r of strecken) {
    const tage = Number(r.v) >= SCHWELLE_MAIL ? STRECKUNG_TAGE_LANG : STRECKUNG_TAGE;
    const erg = await sqlPool`
      UPDATE fiaon_persons
         SET follow_up_date = (CURRENT_DATE + ${tage}::int), updated_at = NOW()
       WHERE id = ${r.id}
         AND (follow_up_date IS NULL OR follow_up_date < (CURRENT_DATE + ${tage}::int))
    `;
    if ((erg as any).count > 0) b++;
  }
  log(`  ${b} Wiedervorlagen gestreckt.`);

  await zaehlprobe();
  await sqlPool.end();
}

/**
 * Der Beweis, den der Auftrag verlangt: Die Tagesliste enthält keinen Kunden
 * mit neun oder mehr Versuchen ohne Termin.
 */
async function zaehlprobe(): Promise<void> {
  titel("ZÄHLPROBE — Tagesliste, Personen mit >= 9 Versuchen ohne Termin");
  const [z] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL
       AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_RUHEND}
       AND NOT ${HAT_TERMIN}
       AND NOT ${ruhtSql("p")}
       AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
  `)) as any[];
  const n = Number(z?.n ?? -1);
  log(`\n  ${n} — ${n === 0 ? "Zählprobe bestanden." : "NICHT bestanden, es bleiben Fälle stehen."}`);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
