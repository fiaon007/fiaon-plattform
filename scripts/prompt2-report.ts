// ═══════════════════════════════════════════════════════════════════
// PROMPT 2 — Phase-0-Report (NUR LESEND, kein Heredoc).
// Beantwortet die akut umsatzrelevanten Tickets #18 und #20:
//   #18  Bestellungen seit > 7 Tagen „bezahlt gemeldet" (claimed_paid), aber nie
//        bestätigt → unerkannter Umsatz. Inkl. Bank-Abgleich-Status je Fall.
//        Plus Einzelfall Alan Imsirovic.
//   #20  Bezahlte/aktive Kunden, deren Portal-Limit vom Paket abweicht
//        (approved_limit fehlt/auf 250 € geklemmt → falsches Limit im Portal).
//
// Aufruf:  npx tsx scripts/prompt2-report.ts
// ═══════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });

// Kanonische Paket-Limits (identisch zu server/routes/fiaon-antrag.ts PACK_LIMITS)
const PACK_LIMITS: Record<string, number> = {
  start: 500, pro: 5000, ultra: 15000, highend: 25000,
  business_starter: 5000, business_pro: 25000, business_ultra: 75000, business_enterprise: 250000,
};
const FLOOR = 250;
function effectiveLimit(packKey: string | null, approved: any): number | null {
  const n = Number(approved);
  if (Number.isFinite(n) && n > FLOOR) return n;
  const pl = packKey ? PACK_LIMITS[packKey] : undefined;
  if (pl != null) return pl;
  return Number.isFinite(n) && n > 0 ? n : null;
}
function h(t: string) { console.log(`\n═══════════ ${t} ═══════════`); }
const eur = (v: any) => v == null ? "—" : `${Number(v).toLocaleString("de-DE")} €`;

async function main() {
  // ── #18a: Einzelfall Alan Imsirovic ────────────────────────────────
  h("#18a — Alan Imsirovic (Einzelfall)");
  const alan = await sql`
    SELECT ref, first_name, last_name, email, phone, payment_status, payment_reference,
           amount_due, pack_name, claimed_paid_at, completed_at, confirmed_email_sent_at,
           merged_into, superseded_by, assigned_agent_id, created_at
    FROM fiaon_applications
    WHERE (first_name ILIKE '%alan%' AND last_name ILIKE '%imsirovic%')
       OR last_name ILIKE '%imsirovic%'
    ORDER BY created_at ASC
  `;
  console.log(`Treffer: ${alan.length}`);
  for (const a of alan) {
    console.log(JSON.stringify(a, null, 1));
    // Gibt es einen Bank-Eingang zu dieser Referenz? (Warum wurde nie bestätigt?)
    if (a.payment_reference || a.ref) {
      const txns = await sql`
        SELECT id, txn_id, amount_cents, payer_name, reference_raw, extracted_ref,
               matched_ref, match_status, applied, applied_at, booked_at
        FROM fiaon_bank_txns
        WHERE matched_ref = ${a.ref}
           OR extracted_ref = ${a.payment_reference}
           OR reference_raw ILIKE ${"%" + (a.payment_reference || "___nope___") + "%"}
           OR payer_name ILIKE '%imsirovic%'
      `;
      console.log(`   → Bank-Eingänge (${txns.length}):`);
      for (const t of txns) console.log(`     #${t.id} ${t.amount_cents / 100}€ payer=${t.payer_name} ref=${t.reference_raw} match=${t.match_status} applied=${t.applied}`);
    }
  }

  // ── #18b: alle „lange bezahlt gemeldet, nie bestätigt" ──────────────
  h("#18b — claimed_paid seit > 7 Tagen, nie auf 'paid' bestätigt (unerkannter Umsatz)");
  const backlog = await sql`
    SELECT a.ref, a.first_name, a.last_name, a.email, a.payment_reference, a.amount_due,
           a.pack_name, a.claimed_paid_at, a.assigned_agent_id,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - a.claimed_paid_at)) / 86400)::int AS tage,
           (SELECT COUNT(*)::int FROM fiaon_bank_txns t
              WHERE t.matched_ref = a.ref OR t.extracted_ref = a.payment_reference) AS bank_treffer
    FROM fiaon_applications a
    WHERE a.payment_status = 'claimed_paid' AND a.merged_into IS NULL
      AND a.claimed_paid_at IS NOT NULL AND a.claimed_paid_at < NOW() - INTERVAL '7 days'
    ORDER BY a.claimed_paid_at ASC
  `;
  console.log(`Fälle: ${backlog.length}`);
  for (const b of backlog)
    console.log(`  ${b.tage}d · ${b.ref} · ${[b.first_name, b.last_name].filter(Boolean).join(" ")} · ${eur(b.amount_due)} · Zahlungsref ${b.payment_reference || "—"} · Bank-Treffer: ${b.bank_treffer} · Agent ${b.assigned_agent_id ?? "—"}`);
  const summe = backlog.reduce((s: number, b: any) => s + Number(b.amount_due || 0), 0);
  console.log(`→ Potenzieller unerkannter Umsatz (Summe amount_due): ${summe.toLocaleString("de-DE")} €`);

  // Zusatz: matched-but-not-applied Bank-Eingänge (Geld erkannt, nicht verbucht)
  const matchedUnapplied = await sql`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_cents),0)::bigint AS cents
    FROM fiaon_bank_txns WHERE match_status IN ('matched','manual') AND applied = FALSE
  `;
  console.log(`Bank: zugeordnet, aber NICHT verbucht: ${matchedUnapplied[0].c} (${(Number(matchedUnapplied[0].cents)/100).toLocaleString("de-DE")} €)`);

  // ── #20: falsches Portal-Limit bei bezahlten/aktiven Kunden ─────────
  h("#20 — bezahlte/aktive Kunden mit falschem Portal-Limit (approved_limit vs. Paket)");
  const cust = await sql`
    SELECT ref, first_name, last_name, email, pack_key, pack_name, approved_limit, payment_status
    FROM fiaon_applications
    WHERE merged_into IS NULL
      AND payment_status IN ('paid','pending_payment','claimed_paid')
    ORDER BY payment_status, created_at DESC
  `;
  let falsch = 0;
  const ilija: any[] = [];
  for (const c of cust) {
    const eff = effectiveLimit(c.pack_key, c.approved_limit);
    const stored = c.approved_limit == null ? null : Number(c.approved_limit);
    if (eff !== stored) {
      falsch++;
      if (falsch <= 60)
        console.log(`  ${c.ref} · ${[c.first_name, c.last_name].filter(Boolean).join(" ")} · ${c.pack_name || c.pack_key || "—"} · gespeichert ${eur(stored)} → korrekt ${eur(eff)} · ${c.payment_status}`);
    }
    if (String(c.last_name || "").toLowerCase().includes("dzankic") || String(c.first_name || "").toLowerCase().includes("ilija")) ilija.push({ ...c, eff });
  }
  console.log(`→ Kunden mit abweichendem/geklemmtem Limit: ${falsch} von ${cust.length} aktiven/bezahlten`);
  if (ilija.length) {
    h("#20 — Einzelfall Ilija Dzankic");
    for (const c of ilija) console.log(`  ${c.ref} · ${c.pack_name || c.pack_key} · gespeichert ${eur(c.approved_limit)} → korrekt ${eur(c.eff)} · ${c.payment_status}`);
  }

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
