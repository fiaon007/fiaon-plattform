// ═══════════════════════════════════════════════════════════════════════════
// NACHHOLEN, WAS DER AUSGEFALLENE TAGESLAUF LIEGENGELASSEN HAT
//
// ── DER BEFUND (scripts/mess-tageslaeufe.ts, 30.08.2026) ──────────────────
// Von acht Läufen ist EINER wirklich ausgefallen: das Tageswerk im Folgelauf
// (`followup_last_run` = 03.08., Kalender 18.08.). Die anderen sieben liefen —
// oder hatten nichts zu tun, was an der Zahl der wartenden Vorgänge ablesbar
// ist:
//
//   abo-motor                    lief (Raten, Mahnungen, Überfälligkeit tagesaktuell)
//   zahlungserinnerungen         lief (jüngste Mahnung heute)
//   lead-nachfass-und-verteilung lief (Slot von heute)
//   warten-nummern-nachtragen    lief
//   rueckruf-eskalation          keine Spur — und 0 Rückrufe mit gerissener Frist
//   aufnahmen-aufraeumen         keine Spur — und 0 Aufnahmen über der Frist
//   agent-rueckruf-erinnerungen  28 h her — 1 offener Fall
//
// Zwei „keine Spur" sind also KEIN Ausfall: Die Läufe hatten nichts zu tun.
// Ohne die Gegenfrage („wartet Arbeit?") hätte dieser Lauf sie nachgeholt und
// damit Arbeit erzeugt, wo keine war.
//
// ── WAS HIER NACHGEHOLT WIRD ──────────────────────────────────────────────
// Nur der eine echte Ausfall, und davon nur die DATENSTÄNDE:
//   · Einstufung (längst erledigt, läuft seit dem 30.08. bei jedem Takt)
//   · Zuteilung herrenloser Stufe-A/B-Kunden
//   · Eskalation gebrochener Zahlungszusagen
//
// ── UND WAS AUSDRÜCKLICH NICHT ────────────────────────────────────────────
// KEINE rückwirkenden Mails. Fünfzehn Tage Mahnungen und Erinnerungen auf
// einmal wären für den Kunden eine Lawine und für die Zustellbarkeit ein
// Schaden, von dem sich eine Absenderdomain monatelang nicht erholt. Wer heute
// drei Mahnungen aus der vorletzten Woche bekommt, meldet sie als Spam — und
// danach kommt auch die richtige Mail nicht mehr an.
//
// Stattdessen: eine LISTE „so viele Kunden hätten in diesem Zeitraum eine
// Mahnung bekommen", zur Entscheidung des Betreibers.
//
// Rückwirkende Termin-Erinnerungen gibt es GAR NICHT — eine Erinnerung an einen
// Termin von letzter Woche ist keine Erinnerung, sondern eine Verwirrung.
//
//   npx tsx scripts/tageslauf-nachholen.ts              → Vorschau
//   npx tsx scripts/tageslauf-nachholen.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euro = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  log(`\n══ Nachholen nach dem Tageslauf-Ausfall ══${SCHREIBEN ? "" : "   (VORSCHAU)"}\n`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. EINSTUFUNG — der Datenstand");
  // ═════════════════════════════════════════════════════════════════════════
  const { personTierSql } = await import("../server/lib/tier");
  const [drift] = (await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    SELECT COUNT(*)::int AS n FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND (p.priority_tier IS DISTINCT FROM t.priority_tier
        OR p.tier_reason IS DISTINCT FROM t.tier_reason)
  `)) as any[];
  log(`  ${String(drift.n).padStart(5)}  Personen mit abweichender Stufe`);
  if (Number(drift.n) === 0) {
    log("         Nichts nachzuholen — die Einstufung läuft seit dem 30.08.2026");
    log("         bei jedem Takt, unabhängig vom Tagesfenster.");
  } else if (SCHREIBEN) {
    const { alleTierAktualisieren } = await import("../server/lib/tier");
    const r = await alleTierAktualisieren(sqlPool);
    log(`         ${r.geaendert} nachgezogen.`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. HERRENLOSE STUFE-A/B-KUNDEN — die Zuteilung");
  // ═════════════════════════════════════════════════════════════════════════
  const herrenlos = (await sqlPool`
    SELECT p.id, p.priority_tier, p.tier_reason,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS name
    FROM fiaon_persons p
    WHERE p.assigned_agent_id IS NULL AND p.merged_into_person_id IS NULL
      AND p.priority_tier IN (1, 2) AND NOT p.is_blocked AND p.ist_test_am IS NULL
    ORDER BY p.priority_tier, p.id
  `) as any[];
  log(`  ${String(herrenlos.length).padStart(5)}  Stufe-A/B-Kunden ohne Zuständigen`);
  for (const h of herrenlos.slice(0, 15)) {
    log(`         Person ${String(h.id).padStart(6)}  Stufe ${h.priority_tier}  ${String(h.name).slice(0, 34)}`);
  }
  let zugeteilt = 0;
  if (SCHREIBEN && herrenlos.length > 0) {
    const { sofortZuteilen } = await import("../server/lib/fiaon-zuteilung");
    for (const h of herrenlos) {
      const e = await sofortZuteilen(Number(h.id), sqlPool);
      if (e.zugeteilt) zugeteilt++;
    }
    log(`         ${zugeteilt} zugeteilt.`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. GEBROCHENE ZAHLUNGSZUSAGEN — die Eskalation");
  // ═════════════════════════════════════════════════════════════════════════
  // Eine Zusage, deren Datum verstrichen ist, gehört dem Zuständigen auf den
  // Tisch. Fünfzehn Tage lang ist das nicht passiert.
  const zusagen = (await sqlPool`
    SELECT p.id, p.promised_payment_date, p.assigned_agent_id, ag.name AS agent,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS name,
           (CURRENT_DATE - p.promised_payment_date) AS tage_her
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.promised_payment_date < CURRENT_DATE
      AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND p.assigned_agent_id IS NOT NULL AND p.ist_test_am IS NULL
    ORDER BY p.promised_payment_date ASC
  `) as any[];
  log(`  ${String(zusagen.length).padStart(5)}  überfällige Zahlungszusagen`);
  const jeAgent = new Map<string, number>();
  for (const z of zusagen) jeAgent.set(String(z.agent ?? "—"), (jeAgent.get(String(z.agent ?? "—")) ?? 0) + 1);
  for (const [a, n] of Array.from(jeAgent.entries()).sort((x, y) => y[1] - x[1])) {
    log(`         ${String(a).padEnd(26)} ${String(n).padStart(4)}`);
  }
  const aeltestes = zusagen[0];
  if (aeltestes) {
    log(`         Älteste: Person ${aeltestes.id}, zugesagt für `
      + `${String(aeltestes.promised_payment_date).slice(0, 10)} (${aeltestes.tage_her} Tage her)`);
  }
  log("");
  log("         Diese Fälle brauchen KEINEN Datenschreib-Vorgang: Sie stehen");
  log("         über „Überfällig“ in der Arbeitsliste jedes Zuständigen. Was");
  log("         fehlte, war die tägliche Wiedervorlage — und die entsteht mit");
  log("         dem nächsten Tageswerk von selbst.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. WAS NICHT NACHVERSANDT WIRD — die Betreiber-Entscheidung");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Liste, um die der Auftrag ausdrücklich bittet: Wer hätte in dem
  // Zeitraum eine Mail bekommen? Sie wird NICHT verschickt.
  const [mails] = (await sqlPool`
    SELECT
      -- Zahlungserinnerungen, die im Ausfallzeitraum fällig gewesen wären.
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
          AND a.payment_status IN ('pending_payment', 'expired')
          AND a.payment_due_date BETWEEN DATE '2026-08-03' AND CURRENT_DATE
          AND (a.last_reminder_at IS NULL OR a.last_reminder_at < DATE '2026-08-03')) AS erinnerungen,
      -- Abo-Mahnungen im selben Zeitraum.
      (SELECT COUNT(*)::int FROM fiaon_abo_raten r
        WHERE r.status = 'offen' AND r.storniert_am IS NULL
          AND r.faellig_am BETWEEN DATE '2026-08-03' AND CURRENT_DATE
          AND COALESCE(r.erinnerungen, 0) = 0) AS abo_mahnungen,
      (SELECT COALESCE(SUM(r.betrag_cents), 0)::bigint FROM fiaon_abo_raten r
        WHERE r.status = 'offen' AND r.storniert_am IS NULL
          AND r.faellig_am BETWEEN DATE '2026-08-03' AND CURRENT_DATE
          AND COALESCE(r.erinnerungen, 0) = 0) AS abo_summe,
      -- Termin-Erinnerungen: NUR zur Information. Sie werden NIE nachgeholt.
      (SELECT COUNT(*)::int FROM fiaon_termine t
        WHERE t.erinnert_am IS NULL AND t.beginn BETWEEN DATE '2026-08-03' AND NOW()) AS termine_ohne_erinnerung
  `) as any[];

  log(`  ${String(mails.erinnerungen).padStart(5)}  Zahlungserinnerungen wären im Zeitraum fällig gewesen`);
  log(`  ${String(mails.abo_mahnungen).padStart(5)}  Abo-Raten wurden im Zeitraum fällig und NIE angemahnt (${euro(mails.abo_summe)})`);
  log(`  ${String(mails.termine_ohne_erinnerung).padStart(5)}  vergangene Termine ohne Erinnerung — wird NIEMALS nachgeholt`);
  log("");
  log("  Es geht KEINE dieser Mails raus. Fünfzehn Tage Mahnungen auf einmal");
  log("  sind für den Kunden eine Lawine und für die Absenderdomain ein");
  log("  Reputationsschaden, von dem sie sich monatelang nicht erholt.");
  log("");
  log("  ENTSCHEIDUNG DES BETREIBERS:");
  log("   a) Nichts nachsenden. Die laufenden Mahnstufen holen die Fälle in den");
  log("      nächsten Tagen ohnehin ein — jede Rate wird weiter angemahnt.");
  log("   b) Gezielt nachsenden, gestaffelt. Dafür gibt es den Abo-Motor mit");
  log("      seiner Tagesgrenze; er arbeitet die Liste von selbst ab, sobald er");
  log("      läuft. Ein Sonderlauf ist NICHT nötig.");
  log("  Empfehlung: (a). Der Motor läuft, die Fälle sind nicht verloren.");

  writeFileSync("reports/tageslauf-nachholen.csv",
    "bereich;kennung;name;stufe;detail\n"
    + herrenlos.map((h) => ["herrenlos", h.id, h.name, h.priority_tier, h.tier_reason].map(feld).join(";")).join("\n")
    + (herrenlos.length && zusagen.length ? "\n" : "")
    + zusagen.map((z) => ["zusage_ueberfaellig", z.id, z.name, "",
      `zugesagt ${String(z.promised_payment_date).slice(0, 10)}, ${z.tage_her} Tage her, ${z.agent ?? "—"}`]
      .map(feld).join(";")).join("\n") + "\n",
    "utf8");

  log("");
  log("  Liste: reports/tageslauf-nachholen.csv");
  if (!SCHREIBEN) {
    log("");
    log("  Nur Vorschau — es wurde nichts geändert. Ausführen mit --schreiben.");
    log("  (Auch mit --schreiben geht KEINE Mail raus — nur Datenstände.)");
  }
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
