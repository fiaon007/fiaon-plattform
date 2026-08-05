// ═══════════════════════════════════════════════════════════════════════════
// EINE ZUSTÄNDIGKEIT, NICHT ZWEI
//
// Gemeldet: „Teilweise sind Kunden in Heute, aber nicht in Meine Kunden."
//
// Ursache, gemessen am 05.08.2026: Die Zuständigkeit steht an ZWEI Stellen —
// an der Person (fiaon_persons.assigned_agent_id) und an jeder Bestellung
// (fiaon_applications.assigned_agent_id). Die alte Seite „Meine Kunden" las die
// Bestellungen, „Heute" die Personen. Wo beide auseinanderliefen, war derselbe
// Kunde auf einer Seite da und auf der anderen weg.
//
// 24 Datensätze liefen auseinander. Bei 18 fehlte der Zuständige an der
// Bestellung, obwohl die Person zugewiesen war — diese Bestellungen tauchten in
// keiner Provisionsrechnung des Altmodells auf, weil dort `assigned_agent_id`
// gelesen wird. Das ist nicht bloß eine Anzeige, das ist Geld.
//
// WAS DIESES SKRIPT TUT
//   Fall A (Bestellung ohne, Person mit Zuständigem): füllt die Bestellung auf.
//           Hier ist nichts zu verlieren — eine leere Zuständigkeit hat noch
//           keinen Anspruch begründet.
//   Fall B (beide gesetzt, aber verschieden): ändert NICHTS und listet den Fall
//           auf. Hier steckt möglicherweise ein Provisionsanspruch drin; das
//           entscheidet ein Mensch, kein Skript.
//
// Aufruf:  npx tsx scripts/abgleich-zustaendigkeit.ts              (nur zeigen)
//          npx tsx scripts/abgleich-zustaendigkeit.ts --schreiben  (Fall A füllen)
//          … zusätzlich --fall-c: verschwundene Personen an ihren Betreuer zurück
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const schreiben = process.argv.includes("--schreiben");

(async () => {
  const abweichend = await sqlPool`
    SELECT a.ref, a.assigned_agent_id AS app_agent, a.payment_status, a.amount_due,
           p.id AS person_id, p.assigned_agent_id AS person_agent, p.betreuung_seit,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, CONCAT('Person ', p.id)) AS name,
           ag1.name AS app_agent_name, ag2.name AS person_agent_name
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag1 ON ag1.id = a.assigned_agent_id
    LEFT JOIN fiaon_agents ag2 ON ag2.id = p.assigned_agent_id
    WHERE a.merged_into IS NULL AND p.merged_into_person_id IS NULL
      AND COALESCE(a.assigned_agent_id, 0) <> COALESCE(p.assigned_agent_id, 0)
    ORDER BY a.assigned_agent_id NULLS FIRST, p.assigned_agent_id
  `;

  const fallA = (abweichend as any[]).filter((r) => r.app_agent == null && r.person_agent != null);
  const fallB = (abweichend as any[]).filter((r) => r.app_agent != null && r.person_agent != null);
  const fallC = (abweichend as any[]).filter((r) => r.person_agent == null && r.app_agent != null);

  console.log(`\n══ Zuständigkeit: Bestellung gegen Person ══\n`);
  console.log(`  Fall A — Bestellung leer, Person zugewiesen: ${fallA.length}`);
  console.log(`  Fall B — beide gesetzt, aber verschieden:    ${fallB.length}  (bleibt unangetastet)`);
  console.log(`  Fall C — Person leer, Bestellung zugewiesen: ${fallC.length}  (bleibt unangetastet)\n`);

  for (const r of fallA.slice(0, 25)) {
    console.log(`  A  ${String(r.ref).padEnd(30)} → ${r.person_agent_name} (${r.name}, ${r.payment_status})`);
  }
  for (const r of fallB) {
    console.log(`  B  ${String(r.ref).padEnd(30)} Bestellung: ${r.app_agent_name} ↔ Person: ${r.person_agent_name} (${r.name})`);
  }
  for (const r of fallC) {
    console.log(`  C  ${String(r.ref).padEnd(30)} Bestellung: ${r.app_agent_name}, Person: niemand (${r.name})`);
  }

  if ((fallB.length > 0 || fallC.length > 0)) {
    const kopf = "fall;ref;kunde;bestellung_agent;person_agent;zahlungsstatus;betrag;betreut_seit\n";
    const zeilen = [...fallB.map((r) => ["B", r]), ...fallC.map((r) => ["C", r])] as [string, any][];
    const csv = kopf + zeilen.map(([f, r]) =>
      [f, r.ref, r.name, r.app_agent_name || "", r.person_agent_name || "", r.payment_status,
       r.amount_due ?? "", r.betreuung_seit ? new Date(r.betreuung_seit).toISOString().slice(0, 10) : ""]
        .map((x) => String(x).replace(/;/g, ",")).join(";")).join("\n") + "\n";
    writeFileSync("zustaendigkeit-entscheiden.csv", csv);
    console.log(`\n  → zustaendigkeit-entscheiden.csv geschrieben (${zeilen.length} Fälle für eine menschliche Entscheidung)`);
  }

  if (!schreiben) {
    console.log(`\n  Nichts geändert. Zum Auffüllen von Fall A: --schreiben\n`);
    await sqlPool.end?.();
    return;
  }

  // ── Fall C: die Person hat keinen Zuständigen, die Bestellung schon ───────
  // Diese Kunden sind in der neuen Kundenliste UNSICHTBAR — sie hängt an der
  // Person. Für den Agenten ist sein Kunde damit verschwunden, obwohl die
  // Bestellung ihn weiterhin nennt. Genau so verlor Daniel Axel Conrad.
  // Zurückgegeben wird an den Agenten, den die Bestellung nennt; steht dort ein
  // dokumentierter Kontakt eines ANDEREN, gewinnt der dokumentierte Kontakt.
  let zurueckgegeben = 0;
  if (process.argv.includes("--fall-c")) {
    for (const r of fallC) {
      const [dok] = await sqlPool`
        SELECT cl.agent_id, ag.name
        FROM fiaon_contact_log cl
        JOIN fiaon_applications x ON x.ref = cl.ref
        LEFT JOIN fiaon_agents ag ON ag.id = cl.agent_id
        WHERE x.person_id = ${r.person_id} AND cl.type = 'result'
          AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
        ORDER BY cl.created_at DESC LIMIT 1
      `;
      const ziel = Number(dok?.agent_id || r.app_agent);
      await sqlPool.begin(async (tx) => {
        await tx`SELECT set_config('fiaon.reason', 'zustaendigkeit_zurueckgegeben', true)`;
        await tx`SELECT set_config('fiaon.actor', 'abgleich-zustaendigkeit', true)`;
        await tx`UPDATE fiaon_persons SET assigned_agent_id = ${ziel}, updated_at = NOW() WHERE id = ${r.person_id}`;
      });
      console.log(`  C→ ${r.name}: Person zurück an ${dok?.name || r.app_agent_name}`
        + `${dok?.agent_id && Number(dok.agent_id) !== Number(r.app_agent) ? " (dokumentierter Kontakt schlägt die Bestellung)" : ""}`);
      zurueckgegeben++;
    }
  }

  let gefuellt = 0;
  for (const r of fallA) {
    await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${r.person_agent}, updated_at = NOW()
      WHERE ref = ${r.ref} AND assigned_agent_id IS NULL
    `;
    // Nachvollziehbarkeit: Wer eine Zuständigkeit füllt, hinterlässt eine Spur.
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor)
      VALUES (${r.person_agent}, 'zustaendigkeit_abgeglichen',
              ${JSON.stringify({ ref: r.ref, person_id: r.person_id, grund: "Bestellung war leer, Person zugewiesen" })},
              'abgleich-zustaendigkeit')
    `.catch(() => {});
    gefuellt++;
  }
  console.log(`\n  ✓ ${gefuellt} Bestellung(en) aufgefüllt — dieselbe Zuständigkeit wie an der Person.`);

  const [rest] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND p.merged_into_person_id IS NULL
      AND a.assigned_agent_id IS NULL AND p.assigned_agent_id IS NOT NULL
  `;
  console.log(`  Verbleibend in Fall A: ${rest.c}`);
  if (zurueckgegeben > 0) console.log(`  ✓ ${zurueckgegeben} Person(en) an ihren Betreuer zurückgegeben — sie sind wieder in der Kundenliste sichtbar.`);
  console.log("");
  await sqlPool.end?.();
})();
