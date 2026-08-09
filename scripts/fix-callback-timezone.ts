// ════════════════════════════════════════════════════════════════════
// EINMAL-KORREKTUR Zeitzonen-Altbestand (Ticket #13, Phase 0 A).
//
// Vor dem Fix wurden agent-eingegebene Rückruf-Zeiten (datetime-local) auf dem
// UTC-Server als UTC statt als Berlin-Zeit gespeichert → sie liegen aktuell
// +1 h (Winter) bzw. +2 h (Sommer) zu spät. Messung: der Versatz ist EINHEITLICH
// (alle betroffenen Zukunfts-Termine agent-eingegeben, keine Admin-/Browser-Zeiten).
//
// Diese Korrektur ist DETERMINISTISCH pro Zeile (neuer UTC = alt − Berlin-Offset).
//
// SICHERHEIT:
//   • Standard = DRY-RUN (zeigt nur Vorher/Nachher, ändert NICHTS).
//   • Änderung NUR mit  --apply  UND ausdrücklicher Freigabe des Vorgesetzten.
//   • Vor jeder Änderung wird ein Backup (JSON) geschrieben → manuelle Rücknahme.
//   • Nur ZUKÜNFTIGE, offene, AGENT-eingegebene Rückrufe (contact_log + lead_log).
//     Admin/System-Einträge und Zahlungs-Zusagen (tagesgenau) werden NICHT angefasst.
//   • Nur Zeilen, die VOR dem Deploy-Stichtag erfasst wurden (--cutoff, ISO).
//
// Aufruf (Test):   npx tsx scripts/fix-callback-timezone.ts
// Aufruf (scharf): npx tsx scripts/fix-callback-timezone.ts --apply --cutoff=2026-07-16T09:00:00Z
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import postgres from "postgres";
import { berlinOffsetMinutes, formatBerlin } from "../server/lib/fiaon-time";

const APPLY = process.argv.includes("--apply");
const cutoffArg = process.argv.find((a) => a.startsWith("--cutoff="));
const CUTOFF = cutoffArg ? new Date(cutoffArg.split("=")[1]) : new Date();

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });
const isAdminActor = (name: string | null, id: number | null) =>
  id == null || /^(admin|system)$/i.test((name || "").trim());

async function main() {
  console.log(`\n=== Zeitzonen-Korrektur ${APPLY ? "*** SCHARF (--apply) ***" : "(DRY-RUN, ändert nichts)"} ===`);
  console.log(`Stichtag (nur Zeilen davor): ${CUTOFF.toISOString()}\n`);

  const cust = await sql`
    SELECT id, ref, agent_id, agent_name, scheduled_at, created_at
    FROM fiaon_contact_log
    WHERE scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL
      AND scheduled_at > NOW() AND created_at < ${CUTOFF}
    ORDER BY scheduled_at ASC`;
  const leadCb = await sql`
    SELECT DISTINCT ON (lead_id) id, lead_id, agent_id, agent_name, scheduled_at, created_at
    FROM fiaon_lead_log
    WHERE scheduled_at IS NOT NULL AND scheduled_at > NOW() AND created_at < ${CUTOFF}
    ORDER BY lead_id, scheduled_at DESC`;

  type Fix = { table: string; id: number; ref: string; oldUtc: string; newUtc: string; off: number; actor: string };
  const fixes: Fix[] = [];
  const skipped: string[] = [];

  for (const r of cust as any[]) {
    if (isAdminActor(r.agent_name, r.agent_id)) { skipped.push(`contact_log#${r.id} (Admin/System-Eintrag)`); continue; }
    const d = new Date(r.scheduled_at); const off = berlinOffsetMinutes(d);
    fixes.push({ table: "fiaon_contact_log", id: r.id, ref: r.ref, oldUtc: d.toISOString(), newUtc: new Date(d.getTime() - off * 60000).toISOString(), off, actor: r.agent_name });
  }
  for (const r of leadCb as any[]) {
    if (isAdminActor(r.agent_name, r.agent_id)) { skipped.push(`lead_log#${r.id} (Admin/System-Eintrag)`); continue; }
    const d = new Date(r.scheduled_at); const off = berlinOffsetMinutes(d);
    fixes.push({ table: "fiaon_lead_log", id: r.id, ref: `lead ${r.lead_id}`, oldUtc: d.toISOString(), newUtc: new Date(d.getTime() - off * 60000).toISOString(), off, actor: r.agent_name });
  }

  console.log(`Betroffen: ${fixes.length} Rückruf-Termine · übersprungen (Admin/System): ${skipped.length}\n`);
  for (const f of fixes) {
    console.log(`  ${f.table}#${f.id} ${f.ref} [${f.actor}]`);
    console.log(`     ${formatBerlin(f.oldUtc)}  →  ${formatBerlin(f.newUtc)}   (−${f.off} min)`);
  }
  if (skipped.length) { console.log(`\n  Übersprungen (nicht deterministisch korrigierbar):`); for (const s of skipped) console.log(`   - ${s}`); }

  const offsets = new Set(fixes.map((f) => f.off));
  console.log(`\nVersatz einheitlich? ${offsets.size <= 1 ? "JA" : "NEIN (gemischt: " + [...offsets].join(", ") + " min)"}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN — nichts geändert. Für die scharfe Korrektur (nach Freigabe):`);
    console.log(`  npx tsx scripts/fix-callback-timezone.ts --apply --cutoff=<Deploy-Zeit ISO>\n`);
    await sql.end(); return;
  }

  // ── SCHARF ──
  mkdirSync("scripts/backups", { recursive: true });
  const backupFile = `scripts/backups/callback-tz-backup-${Date.now()}.json`;
  writeFileSync(backupFile, JSON.stringify(fixes, null, 2));
  console.log(`\nBackup geschrieben: ${backupFile}`);

  let done = 0;
  for (const f of fixes) {
    if (f.table === "fiaon_contact_log") {
      await sql`UPDATE fiaon_contact_log SET scheduled_at = ${f.newUtc}, reminder_sent_at = NULL WHERE id = ${f.id}`;
      await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
                VALUES (${f.ref}, NULL, 'System', 'system', ${'Zeitzonen-Korrektur Altbestand: Rückruf um ' + f.off + ' min zurückgesetzt (war vor dem Zeitzonen-Fix erfasst).'})`;
    } else {
      await sql`UPDATE fiaon_lead_log SET scheduled_at = ${f.newUtc} WHERE id = ${f.id}`;
    }
    done++;
  }
  console.log(`\nFERTIG: ${done} Termine korrigiert. Rücknahme über ${backupFile} möglich.\n`);
  await sql.end();
}
main().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
