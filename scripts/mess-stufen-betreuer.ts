// ═══════════════════════════════════════════════════════════════════════════
// STUFEN UND BETREUER — STIMMT DIE GESPEICHERTE SPALTE MIT DER ABLEITUNG?
//
// ── DIE MELDUNGEN (Team, 30.08.2026) ───────────────────────────────────────
//   „Kunden mit gemeldeter oder eingegangener Zahlung stehen auf Stufe C."
//   „Bezahlte Kunden haben keinen Vertriebs-Betreuer."
//
// ── WARUM DAS NICHT DIE ABLEITUNG SEIN KANN ────────────────────────────────
// `server/lib/tier.ts` bildet ab:
//   paid → Rang 60 → Stufe 0 (Bestandskunde)
//   claimed_paid → Rang 50 → Stufe 1 (Stufe A)
// Eine Zahlung KANN nach dieser Rechnung nicht auf Stufe 3 führen.
//
// Aber `priority_tier` ist eine SPALTE, keine Rechnung. AGENTS.md, 20.08.2026:
// „Eine Spalte ist ein Merker, keine Wahrheit." Wenn die Zahlung eintrifft und
// der Nachzug nicht läuft, bleibt der alte Wert stehen — und die Anzeige liest
// den alten Wert.
//
// Dieser Lauf vergleicht deshalb die GESPEICHERTE Spalte mit dem, was die
// Ableitung HEUTE ergäbe — mit derselben SQL-Fassung, die `tier.ts` benutzt.
// Zwei Fassungen derselben Regel wären hier der Fehler, den wir suchen.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-stufen-betreuer.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { personTierSql } from "../server/lib/tier";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. GESPEICHERTE STUFE GEGEN ABLEITUNG — wo laufen sie auseinander?");
  // ═════════════════════════════════════════════════════════════════════════
  const abweichungen = (await sqlPool.unsafe(`
    WITH soll AS (${personTierSql()})
    SELECT p.id, p.person_ref,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           p.priority_tier AS ist_stufe, p.tier_reason AS ist_grund,
           s.priority_tier AS soll_stufe, s.tier_reason AS soll_grund,
           p.assigned_agent_id, ag.name AS agent_name,
           (SELECT MAX(a.payment_status) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL) AS ein_status
    FROM fiaon_persons p
    JOIN soll s ON s.person_id = p.id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND (p.priority_tier IS DISTINCT FROM s.priority_tier
           OR COALESCE(p.tier_reason, '') <> COALESCE(s.tier_reason, ''))
    ORDER BY p.priority_tier DESC, p.id
  `)) as any[];

  log(`  ${String(abweichungen.length).padStart(6)}  Personen: gespeicherte Stufe weicht von der Ableitung ab`);
  const jeRichtung = new Map<string, number>();
  for (const a of abweichungen) {
    const k = `${a.ist_stufe} → ${a.soll_stufe}`;
    jeRichtung.set(k, (jeRichtung.get(k) ?? 0) + 1);
  }
  for (const [k, n] of Array.from(jeRichtung.entries()).sort((x, y) => y[1] - x[1])) {
    log(`   ${String(n).padStart(5)}  Stufe ${k}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE GEMELDETE LAGE — Zahlung gemeldet/eingegangen, aber Stufe C");
  // ═════════════════════════════════════════════════════════════════════════
  const zahlungAberKalt = (await sqlPool`
    SELECT p.id, p.person_ref, p.priority_tier, p.tier_reason,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS name,
           p.assigned_agent_id, ag.name AS agent_name,
           (SELECT STRING_AGG(DISTINCT a.payment_status, ',') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL) AS status_liste
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.priority_tier = 3
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL
          AND a.payment_status IN ('paid', 'claimed_paid')
      )
    ORDER BY p.id
  `) as any[];
  log(`  ${String(zahlungAberKalt.length).padStart(6)}  Personen auf Stufe C (kalt) MIT bezahlter oder gemeldeter Zahlung`);
  for (const z of zahlungAberKalt.slice(0, 15)) {
    log(`   Person ${String(z.id).padStart(6)}  ${String(z.name).slice(0, 26).padEnd(28)} `
      + `Grund „${z.tier_reason}“  Zahlung: ${z.status_liste}  Betreuer: ${z.agent_name ?? "—"}`);
  }

  // Und dieselbe Frage für Stufe 0: „Bestandskunde" ist NICHT kalt, aber wer
  // eine OFFENE Rate hat, gehört trotzdem bearbeitet. Das ist die Verwechslung,
  // die hinter der Meldung stecken kann.
  const [stufen] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE priority_tier = 0)::int AS s0,
           COUNT(*) FILTER (WHERE priority_tier = 1)::int AS s1,
           COUNT(*) FILTER (WHERE priority_tier = 2)::int AS s2,
           COUNT(*) FILTER (WHERE priority_tier = 3)::int AS s3,
           COUNT(*) FILTER (WHERE priority_tier = -1)::int AS sminus
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND ist_test_am IS NULL
  `) as any[];
  log("");
  log(`  Verteilung: Stufe 0 (bezahlt) ${stufen.s0} · Stufe 1 (A) ${stufen.s1} · `
    + `Stufe 2 (B) ${stufen.s2} · Stufe 3 (C) ${stufen.s3} · ausgeschlossen ${stufen.sminus}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. BEZAHLTE OHNE VERTRIEBS-BETREUER");
  // ═════════════════════════════════════════════════════════════════════════
  const ohneBetreuer = (await sqlPool`
    SELECT p.id, p.person_ref, p.priority_tier,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS name,
           (SELECT MAX(a.paid_at) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.payment_status = 'paid') AS bezahlt_am,
           (SELECT STRING_AGG(DISTINCT a.commission_basis, ',') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
               AND a.payment_status IN ('paid','claimed_paid')) AS provisionsgrund,
           -- Steht an der BESTELLUNG ein Agent, obwohl die Person keinen hat?
           -- Das wäre kein fehlender Betreuer, sondern die falsche Quelle.
           (SELECT STRING_AGG(DISTINCT ag2.name, ' / ') FROM fiaon_applications a
             JOIN fiaon_agents ag2 ON ag2.id = a.assigned_agent_id
             WHERE a.person_id = p.id AND a.merged_into IS NULL) AS agent_an_bestellung
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.assigned_agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL
          AND a.payment_status IN ('paid', 'claimed_paid')
      )
    ORDER BY p.id
  `) as any[];
  const mitAgentAnBestellung = ohneBetreuer.filter((o) => o.agent_an_bestellung);
  log(`  ${String(ohneBetreuer.length).padStart(6)}  bezahlte/gemeldete Personen OHNE Betreuer an der Person`);
  log(`  ${String(mitAgentAnBestellung.length).padStart(6)}  davon haben einen Agenten an der BESTELLUNG`);
  log(`          → das ist kein fehlender Betreuer, sondern die falsche Quelle`);
  for (const o of ohneBetreuer.slice(0, 15)) {
    log(`   Person ${String(o.id).padStart(6)}  ${String(o.name).slice(0, 24).padEnd(26)} `
      + `Stufe ${o.priority_tier}  Bestellung-Agent: ${o.agent_an_bestellung ?? "—"}  `
      + `Provision: ${o.provisionsgrund ?? "—"}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE ZAHLUNGSANSICHT — liest sie die richtige Quelle?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Suche in der Zahlungsansicht liest `fiaon_applications.assigned_agent_id`.
  // Nach den Zusammenführungen kann dort ein anderer Agent stehen als an der
  // Person. Diese Zahl sagt, ob die Anzeige deshalb lügt.
  const [quellen] = (await sqlPool`
    SELECT COUNT(*)::int AS bezahlte,
           COUNT(*) FILTER (WHERE a.assigned_agent_id IS DISTINCT FROM p.assigned_agent_id)::int AS weichen_ab,
           COUNT(*) FILTER (WHERE a.assigned_agent_id IS NULL AND p.assigned_agent_id IS NOT NULL)::int AS nur_person,
           COUNT(*) FILTER (WHERE a.assigned_agent_id IS NOT NULL AND p.assigned_agent_id IS NULL)::int AS nur_bestellung
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND p.merged_into_person_id IS NULL
      AND a.payment_status IN ('paid', 'claimed_paid')
  `) as any[];
  log(`  ${String(quellen.bezahlte).padStart(6)}  bezahlte/gemeldete Bestellungen`);
  log(`  ${String(quellen.weichen_ab).padStart(6)}  davon: Agent an der Bestellung ≠ Agent an der Person`);
  log(`  ${String(quellen.nur_person).padStart(6)}  nur die Person hat einen  ← Anzeige zeigt „niemand“, obwohl es einen gibt`);
  log(`  ${String(quellen.nur_bestellung).padStart(6)}  nur die Bestellung hat einen`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. PROVISION ODER WAND — was steht neben der Zahlung?");
  // ═════════════════════════════════════════════════════════════════════════
  const [prov] = (await sqlPool`
    SELECT COUNT(*)::int AS bezahlte,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_commissions k WHERE k.ref = a.ref AND k.status <> 'storniert'
           ))::int AS mit_provision,
           COUNT(*) FILTER (WHERE a.commission_basis = 'direktzahler')::int AS direktzahler,
           COUNT(*) FILTER (WHERE a.commission_basis IS NULL
             AND NOT EXISTS (SELECT 1 FROM fiaon_commissions k WHERE k.ref = a.ref))::int AS gar_nichts
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
  `) as any[];
  log(`  ${String(prov.bezahlte).padStart(6)}  bezahlte Bestellungen`);
  log(`  ${String(prov.mit_provision).padStart(6)}  mit gebuchter Provision  → die wird angezeigt`);
  log(`  ${String(prov.direktzahler).padStart(6)}  als „Direktzahler“ vermerkt  → DAS muss dastehen`);
  log(`  ${String(prov.gar_nichts).padStart(6)}  ohne Provision UND ohne Vermerk  ← hier bliebe das Feld leer`);

  // ── CSV ──────────────────────────────────────────────────────────────────
  const kopf = ["befund", "person_id", "person_ref", "name", "ist_stufe", "soll_stufe",
    "ist_grund", "soll_grund", "betreuer", "agent_an_bestellung"];
  const zeilen: string[] = [];
  for (const a of abweichungen) {
    zeilen.push(["stufe_weicht_ab", a.id, a.person_ref, a.name, a.ist_stufe, a.soll_stufe,
      a.ist_grund, a.soll_grund, a.agent_name ?? "", ""].map(feld).join(";"));
  }
  for (const o of ohneBetreuer) {
    zeilen.push(["bezahlt_ohne_betreuer", o.id, o.person_ref, o.name, o.priority_tier, "",
      "", "", "", o.agent_an_bestellung ?? ""].map(feld).join(";"));
  }
  writeFileSync("reports/stufen-betreuer.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  log("");
  log(`  Vorschau: reports/stufen-betreuer.csv (${zeilen.length} Zeilen)`);
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
