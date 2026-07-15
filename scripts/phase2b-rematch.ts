// ════════════════════════════════════════════════════════════════════
// PHASE 2B (V4) — Rematch der offenen Bank-Eingänge.
// Nutzt EXAKT denselben Code-Pfad wie der UI-Button „Offene neu abgleichen"
// (extractRef + findApp aus fiaon-reconcile) — keine Logik-Duplikate.
//
//   npx tsx scripts/phase2b-rematch.ts           → DRY-RUN (nur lesen, zählt)
//   npx tsx scripts/phase2b-rematch.ts --write   → ordnet zu (verbucht NICHTS)
//
// Jede Zuordnung wird in fiaon_bank_txns protokolliert (extracted_ref, note,
// updated_at); Verbuchen bleibt ein separater, bewusster Admin-Schritt.
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";
import { extractRef, findApp } from "../server/routes/fiaon-reconcile";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const WRITE = process.argv.includes("--write");

async function main() {
  const rows = await sql`
    SELECT id, reference_raw, payer_name, amount_cents FROM fiaon_bank_txns
    WHERE match_status = 'unmatched' AND applied = FALSE
    ORDER BY id ASC
  `;
  console.log(`${WRITE ? "WRITE" : "DRY-RUN"}: ${rows.length} unzugeordnete Eingänge werden geprüft…\n`);

  let matched = 0, noRef = 0, refButNoApp = 0;
  const details: string[] = [];
  for (const t of rows) {
    const extracted = extractRef(t.reference_raw) || extractRef(t.payer_name);
    if (!extracted) { noRef++; details.push(`#${t.id}  KEINE Referenz erkennbar: "${String(t.reference_raw || "").slice(0, 60)}"`); continue; }
    const app = await findApp(extracted);
    if (!app) { refButNoApp++; details.push(`#${t.id}  Referenz ${extracted} → KEIN Antrag gefunden`); continue; }
    const amountOk = Math.round(Number(app.amount_due || 0) * 100) === Number(t.amount_cents);
    matched++;
    details.push(`#${t.id}  ${extracted} → ${app.ref} (${app.payment_status})${amountOk ? "" : " [Betrag weicht ab]"}`);
    if (WRITE) {
      await sql`
        UPDATE fiaon_bank_txns SET
          extracted_ref = ${extracted}, matched_ref = ${app.ref}, match_status = 'matched',
          amount_ok = ${amountOk},
          note = ${amountOk ? null : `Abweichung: Bank ${(Number(t.amount_cents) / 100).toFixed(2)} € vs. Soll ${(Number(app.amount_due || 0)).toFixed(2)} €`},
          updated_at = NOW()
        WHERE id = ${t.id} AND match_status = 'unmatched' AND applied = FALSE
      `;
    }
  }

  for (const d of details) console.log(d);
  console.log(`\n═══ ERGEBNIS (${WRITE ? "geschrieben" : "Dry-Run, NICHTS geschrieben"}) ═══`);
  console.log(`Geprüft:               ${rows.length}`);
  console.log(`Zuordenbar/zugeordnet: ${matched}`);
  console.log(`Keine Referenz:        ${noRef}`);
  console.log(`Referenz ohne Antrag:  ${refButNoApp}`);
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
