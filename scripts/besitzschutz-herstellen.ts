// ═══════════════════════════════════════════════════════════════════════════
// BESITZSCHUTZ HERSTELLEN — Backfill und Rückgabe
//
// Auslöser (05.08.2026, Team-Chat):
//   Florentine: „Teilweise werden Kunden anderer Mitarbeiter angezeigt. Dadurch
//               kommt es vor, dass mehrere Mitarbeiter denselben Kunden
//               kontaktieren."
//   Daniel:     „Axel Conrad zahlt heute, wurde von mir betreut, weiß nicht bei
//               wem er jetzt zugeteilt ist."
//
// Dieses Skript macht drei Dinge:
//
//   1. BACKFILL  `betreuung_seit` für jede Person mit dokumentiertem Kontakt —
//      der ÄLTESTE Eintrag gewinnt, denn er markiert den Beginn der Betreuung.
//      Ab dann ist die Person für jede Automatik tabu.
//
//   2. RÜCKGABE  Personen, die in den letzten 7 Tagen AUTOMATISCH umverteilt
//      wurden, obwohl sie betreut waren, gehen an ihren Betreuer zurück.
//      Betreuer = Agent des jüngsten dokumentierten Ergebnisses — dieselbe
//      Definition wie beim Provisionsanspruch. Es gibt nur einen Begriff von
//      „betreut", sonst behauptet die Zuweisung etwas anderes als die Abrechnung.
//
//   3. BERICHT   reports/zurueckgegeben.csv mit jedem Fall, damit die Rückgabe
//      prüfbar ist und nicht auf Zusicherung beruht.
//
// Vorschau ist Standard; erst `--schreiben` ändert etwas.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { ensureBetreuungSpalte } from "../server/lib/tier";

const SCHREIBEN = process.argv.includes("--schreiben");
const TAGE = 7;

function csvFeld(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  await ensureBetreuungSpalte(sqlPool);

  // ── 1 · Backfill ──────────────────────────────────────────────────────────
  console.log("── 1. Betreuung nachtragen ──");
  const [offen] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.betreuung_seit IS NULL
      AND EXISTS (
        SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE a.person_id = p.id AND cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL)
  `;
  console.log(`   ${offen.c} Person(en) haben dokumentierten Kontakt, aber keine Betreuungsmarke`);

  if (SCHREIBEN) {
    const erg = await sqlPool`
      WITH erster AS (
        SELECT a.person_id, MIN(cl.created_at) AS am
        FROM fiaon_contact_log cl
        JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
          AND a.person_id IS NOT NULL
        GROUP BY a.person_id
      )
      UPDATE fiaon_persons p
      SET betreuung_seit = erster.am, updated_at = NOW()
      FROM erster
      WHERE p.id = erster.person_id AND p.betreuung_seit IS NULL
    `;
    console.log(`   geschrieben: ${(erg as any).count ?? "?"} Zeilen`);
  }

  // ── 2 · Wer wurde fälschlich umverteilt? ──────────────────────────────────
  // Die Umverteilung erkennt man an `fiaon_agent_events`: type
  // 'person_owner_changed' mit einem SYSTEM-Akteur. Betroffen ist eine Person
  // nur dann, wenn ihr heutiger Agent nicht ihr Betreuer ist.
  console.log(`\n── 2. Automatisch umverteilt trotz Betreuung (letzte ${TAGE} Tage) ──`);
  const faelle = await sqlPool`
    WITH wechsel AS (
      SELECT (meta::json->>'person_id')::int AS person_id,
             MIN(created_at) AS zuerst,
             MAX(created_at) AS zuletzt,
             STRING_AGG(DISTINCT reason, ', ') AS gruende,
             STRING_AGG(DISTINCT actor, ', ') AS akteure
      FROM fiaon_agent_events
      WHERE type = 'person_owner_changed'
        AND created_at > NOW() - (${TAGE} || ' days')::interval
        AND actor LIKE 'system:%'
        AND meta IS NOT NULL AND meta LIKE '{%'
      GROUP BY 1
    ),
    betreuer AS (
      SELECT DISTINCT ON (a.person_id) a.person_id, cl.agent_id, cl.created_at AS letzter_kontakt
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      WHERE cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
        AND a.person_id IS NOT NULL
      ORDER BY a.person_id, cl.created_at DESC
    )
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name,
                    p.contact_name, p.primary_email, CONCAT('Person ', p.id)) AS name,
           p.primary_email, p.primary_phone,
           p.priority_tier, p.tier_reason, p.promised_payment_date,
           p.assigned_agent_id AS ist_agent, ista.name AS ist_name,
           b.agent_id AS soll_agent, solla.name AS soll_name,
           b.letzter_kontakt, w.zuletzt AS umverteilt_am, w.gruende, w.akteure
    FROM wechsel w
    JOIN fiaon_persons p ON p.id = w.person_id AND p.merged_into_person_id IS NULL
    JOIN betreuer b ON b.person_id = p.id
    LEFT JOIN fiaon_agents ista ON ista.id = p.assigned_agent_id
    LEFT JOIN fiaon_agents solla ON solla.id = b.agent_id
    WHERE COALESCE(p.assigned_agent_id, 0) <> b.agent_id
      AND b.letzter_kontakt < w.zuletzt
    ORDER BY b.letzter_kontakt DESC
  `;
  console.log(`   ${faelle.length} Fall/Fälle gefunden\n`);
  for (const f of (faelle as any[]).slice(0, 15)) {
    console.log(`   ${String(f.name).slice(0, 28).padEnd(30)} betreut von ${String(f.soll_name).padEnd(20)} → steht bei ${f.ist_name || "NIEMANDEM"}`);
    console.log(`     letzter Kontakt ${String(f.letzter_kontakt).slice(4, 21)} · umverteilt ${String(f.umverteilt_am).slice(4, 21)} (${f.gruende})`);
  }
  if (faelle.length > 15) console.log(`   … und ${faelle.length - 15} weitere`);

  // ── 3 · Bericht schreiben ─────────────────────────────────────────────────
  mkdirSync("reports", { recursive: true });
  const kopf = [
    "person_id", "name", "email", "telefon", "tier", "tier_grund", "zusagedatum",
    "betreuer_soll", "betreuer_soll_id", "stand_bei_ist", "stand_bei_ist_id",
    "letzter_kontakt", "umverteilt_am", "gruende", "akteure", "zurueckgegeben",
  ].join(";");
  const zeilen = (faelle as any[]).map((f) => [
    f.id, f.name, f.primary_email, f.primary_phone, f.priority_tier, f.tier_reason,
    f.promised_payment_date ? String(f.promised_payment_date).slice(0, 10) : "",
    f.soll_name, f.soll_agent, f.ist_name || "(niemand)", f.ist_agent ?? "",
    String(f.letzter_kontakt).slice(0, 19), String(f.umverteilt_am).slice(0, 19),
    f.gruende, f.akteure, SCHREIBEN ? "ja" : "nein (Vorschau)",
  ].map(csvFeld).join(";"));
  writeFileSync("reports/zurueckgegeben.csv", `${kopf}\n${zeilen.join("\n")}\n`, "utf8");
  console.log(`\n   Bericht: reports/zurueckgegeben.csv (${zeilen.length} Zeilen)`);

  // ── 4 · Zurückgeben ───────────────────────────────────────────────────────
  if (SCHREIBEN) {
    console.log("\n── 3. Zurückgeben ──");
    let zurueck = 0;
    for (const f of faelle as any[]) {
      await sqlPool.begin(async (tx) => {
        // Der Trigger aus Migration 033 protokolliert den Wechsel selbst; Grund
        // und Akteur werden hier gesetzt, damit im Protokoll steht, WARUM.
        await tx`SELECT set_config('fiaon.reason', 'rueckgabe_an_betreuer', true)`;
        await tx`SELECT set_config('fiaon.actor', 'admin:besitzschutz', true)`;
        await tx`
          UPDATE fiaon_persons
          SET assigned_agent_id = ${f.soll_agent},
              betreuung_seit = COALESCE(betreuung_seit, ${f.letzter_kontakt}),
              updated_at = NOW()
          WHERE id = ${f.id}
        `;
      });
      zurueck++;
    }
    console.log(`   ${zurueck} Person(en) an ihren Betreuer zurückgegeben`);

    // Kontrolle
    const [rest] = await sqlPool`
      WITH betreuer AS (
        SELECT DISTINCT ON (a.person_id) a.person_id, cl.agent_id
        FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
          AND a.person_id IS NOT NULL
        ORDER BY a.person_id, cl.created_at DESC
      )
      SELECT COUNT(*)::int AS c FROM fiaon_persons p JOIN betreuer b ON b.person_id = p.id
      WHERE p.merged_into_person_id IS NULL AND p.priority_tier BETWEEN 1 AND 3
        AND COALESCE(p.assigned_agent_id, 0) <> b.agent_id
    `;
    console.log(`   Kontrolle: ${rest.c} betreute Person(en) stehen noch bei einem anderen Agenten`);

    // ── Zweiter Durchgang: ALLE betreuten Personen beim Betreuer ────────────
    // Der erste Durchgang nimmt nur, was in sieben Tagen automatisch umverteilt
    // wurde. Es gibt aber auch ältere Fälle und solche, bei denen die Zuweisung
    // ohne Protokolleintrag verloren ging (Mehmet Dilsiz: betreut von
    // Florentine, stand bei niemandem). Für die gilt dieselbe Regel.
    //
    // Ausnahme: Ist der Betreuer inaktiv oder ein Testkonto, wird NICHT
    // zugewiesen. Der Kunde braucht dann eine menschliche Entscheidung — er
    // erscheint im Bericht und in der Vertriebsleiter-Ansicht unter „ohne Agent".
    const weitere = await sqlPool`
      WITH betreuer AS (
        SELECT DISTINCT ON (a.person_id) a.person_id, cl.agent_id, cl.created_at
        FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
          AND a.person_id IS NOT NULL
        ORDER BY a.person_id, cl.created_at DESC
      )
      SELECT p.id, b.agent_id, b.created_at,
             ag.active AS betreuer_aktiv, COALESCE(ag.is_test_account, FALSE) AS betreuer_test,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name,
                      p.primary_email, CONCAT('Person ', p.id)) AS name,
             ag.name AS betreuer_name
      FROM fiaon_persons p
      JOIN betreuer b ON b.person_id = p.id
      LEFT JOIN fiaon_agents ag ON ag.id = b.agent_id
      WHERE p.merged_into_person_id IS NULL AND p.priority_tier BETWEEN 1 AND 3
        AND COALESCE(p.assigned_agent_id, 0) <> b.agent_id
    `;
    let nachgezogen = 0;
    const braucht_mensch: any[] = [];
    for (const w of weitere as any[]) {
      if (!w.betreuer_aktiv || w.betreuer_test) { braucht_mensch.push(w); continue; }
      await sqlPool.begin(async (tx) => {
        await tx`SELECT set_config('fiaon.reason', 'rueckgabe_an_betreuer', true)`;
        await tx`SELECT set_config('fiaon.actor', 'admin:besitzschutz', true)`;
        await tx`
          UPDATE fiaon_persons
          SET assigned_agent_id = ${w.agent_id}, betreuung_seit = COALESCE(betreuung_seit, ${w.created_at}),
              updated_at = NOW()
          WHERE id = ${w.id}
        `;
      });
      nachgezogen++;
    }
    console.log(`   Zweiter Durchgang: ${nachgezogen} weitere an ihren Betreuer gegeben`);
    if (braucht_mensch.length > 0) {
      console.log(`   ${braucht_mensch.length} Person(en) brauchen eine menschliche Zuweisung (Betreuer inaktiv oder Testkonto):`);
      for (const b of braucht_mensch) {
        console.log(`     ${String(b.name).slice(0, 30).padEnd(32)} betreut von ${b.betreuer_name} (nicht zuweisbar)`);
      }
      const kopf2 = ["person_id", "name", "betreuer", "grund"].join(";");
      const zeilen2 = braucht_mensch.map((b) => [b.id, b.name, b.betreuer_name,
        b.betreuer_test ? "Betreuer ist Testkonto" : "Betreuer inaktiv"].map(csvFeld).join(";"));
      writeFileSync("reports/braucht-zuweisung.csv", `${kopf2}\n${zeilen2.join("\n")}\n`, "utf8");
      console.log("     Bericht: reports/braucht-zuweisung.csv");
    }
    const [ohneMarke] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.betreuung_seit IS NULL
        AND EXISTS (SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
                      WHERE a.person_id = p.id AND cl.type = 'result' AND cl.voided_at IS NULL
                        AND cl.agent_id IS NOT NULL)
    `;
    console.log(`   Kontrolle: ${ohneMarke.c} betreute Person(en) ohne Betreuungsmarke (soll 0)`);
  } else {
    console.log("\nNur Vorschau — mit --schreiben ausführen.");
  }

  // ── 5 · Axel Conrad ausdrücklich ──────────────────────────────────────────
  console.log("\n── Axel Conrad ──");
  const axel = await sqlPool`
    SELECT p.id, p.assigned_agent_id, ag.name AS agent, p.betreuung_seit, p.priority_tier, p.tier_reason,
           (SELECT cl.agent_name FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
             WHERE a.person_id = p.id AND cl.type = 'result' AND cl.agent_id IS NOT NULL
             ORDER BY cl.created_at DESC LIMIT 1) AS betreuer
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE LOWER(CONCAT_WS(' ', p.first_name, p.last_name)) LIKE '%axel%conrad%'
  `;
  for (const a of axel as any[]) {
    console.log(`   Person ${a.id}: steht bei ${a.agent || "NIEMANDEM"} · Betreuer laut Verlauf: ${a.betreuer || "-"} · betreut seit ${a.betreuung_seit ? String(a.betreuung_seit).slice(4, 21) : "-"} · Tier ${a.priority_tier} (${a.tier_reason})`);
  }

  await sqlPool.end();
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
