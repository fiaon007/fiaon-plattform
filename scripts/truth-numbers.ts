// „Eine Wahrheit"-Kennzahlen direkt aus der DB (nur lesend) — gleiche
// Definition wie server/lib/fiaon-truth.ts und /api/fiaon/admin/truth-check.
// Aufruf: npx tsx scripts/truth-numbers.ts
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });

async function main() {
  const [t] = await sql`
    SELECT COUNT(*)::int AS bezahlt,
           COALESCE(SUM(ROUND(COALESCE(amount_due::numeric, 0) * 100)), 0)::bigint AS umsatz_cents
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND payment_reference IS NOT NULL
  `;
  const [l] = await sql`
    SELECT COUNT(*)::int AS altbestand,
           COUNT(*) FILTER (WHERE COALESCE(amount_due, 0) = 0)::int AS ohne_betrag
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND payment_reference IS NULL
  `;
  console.log("EINE WAHRHEIT — bezahlt:", t.bezahlt, "· Umsatz:", (Number(t.umsatz_cents) / 100).toFixed(2), "€");
  console.log("Alt-Bestand (separat):", l.altbestand, "· davon ohne Betrag:", l.ohne_betrag);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
