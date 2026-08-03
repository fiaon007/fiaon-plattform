/**
 * ═══════════════════════════════════════════════════════════════════════════
 * „BEZAHLT" OHNE BANKZUORDNUNG — URSACHENANALYSE (NUR LESEN)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Frage: Warum haben Bestellungen den Status `paid`, ohne dass im Bankbuch ein
 * passender Eingang steht?
 *
 * Die naheliegende Erklärung „falsch gebucht" ist mit hoher Wahrscheinlichkeit
 * falsch. Es gibt mindestens einen zweiten Zahlungskanal: `fiaon_applications`
 * führt `stripe_session_id`, `stripe_customer_id` und `stripe_subscription_id`.
 * Kartenzahlungen über Stripe erscheinen in keinem Wise-Kontoauszug. Ebenso
 * deckt ein Auszug immer nur EIN Guthaben in EINER Währung ab — ein zweites
 * Guthaben hat seinen eigenen Auszug.
 *
 * Dieses Skript trennt die Fälle sauber, statt sie zu vermischen:
 *   · Bank      — Eingang im Bankbuch zuordenbar
 *   · Stripe    — Stripe-Kennung vorhanden, kein Bankeingang
 *   · unklar    — weder das eine noch das andere → einzige echte Prüfliste
 *
 * Schreibt NICHTS in die Datenbank. Ergebnis:
 *   reports/paid_ohne_bankzuordnung.csv
 *
 *   npx tsx scripts/paid-ohne-bank.ts
 */

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));
const pad = (s: unknown, n: number) => String(s).padStart(n);

/** CSV-Feld maskieren: Anführungszeichen verdoppeln, immer quoten. */
const feld = (v: unknown): string => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function main(): Promise<void> {
  await sqlPool.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION READ ONLY");

    // ── Bankbuch: Gesamtzahl nach dem Import ────────────────────────────────
    const [bank] = (await tx`
      SELECT count(*)::int AS txns,
             (count(*) FILTER (WHERE applied))::int AS verbucht,
             (count(*) FILTER (WHERE match_status = 'matched'))::int AS zugeordnet,
             (count(*) FILTER (WHERE match_status = 'unmatched'))::int AS offen,
             min(booked_at)::date AS von,
             max(booked_at)::date AS bis
      FROM fiaon_bank_txns`) as any[];

    log();
    log("BANKBUCH — STAND NACH DEM IMPORT");
    linie("═");
    log(`  Transaktionen gesamt ........... ${pad(bank.txns, 6)}`);
    log(`  davon zugeordnet (matched) ..... ${pad(bank.zugeordnet, 6)}`);
    log(`  davon offen (unmatched) ........ ${pad(bank.offen, 6)}`);
    log(`  davon verbucht (applied) ....... ${pad(bank.verbucht, 6)}`);
    log(`  Zeitraum ....................... ${bank.von} bis ${bank.bis}`);

    // ── Kanal-Analyse ───────────────────────────────────────────────────────
    // Der Bank-Nachweis akzeptiert bewusst mehrere Wege: matched_ref, aber auch
    // extracted_ref und die payment_reference. Sonst zählt eine korrekt
    // eingegangene Zahlung nur deshalb als fehlend, weil sie über ein anderes
    // Feld zugeordnet wurde.
    const bankNachweis = `EXISTS (
      SELECT 1 FROM fiaon_bank_txns t
      WHERE t.matched_ref   IN (a.ref, a.payment_reference)
         OR t.extracted_ref IN (a.ref, a.payment_reference)
    )`;
    const stripeNachweis = `(
      a.stripe_session_id IS NOT NULL
      OR a.stripe_subscription_id IS NOT NULL
      OR a.stripe_customer_id IS NOT NULL
    )`;

    const [k] = (await tx.unsafe(`
      SELECT count(*)::int AS paid_total,
             (count(*) FILTER (WHERE ${bankNachweis}))::int AS mit_bank,
             (count(*) FILTER (WHERE NOT ${bankNachweis} AND ${stripeNachweis}))::int AS nur_stripe,
             (count(*) FILTER (WHERE NOT ${bankNachweis} AND NOT ${stripeNachweis}))::int AS unklar
      FROM fiaon_applications a
      WHERE a.payment_status = 'paid' AND a.merged_into IS NULL`)) as any[];

    log();
    log("WOHER KAM DAS GELD BEI DEN ALS BEZAHLT GEFÜHRTEN BESTELLUNGEN?");
    linie("═");
    log(`  Als bezahlt geführt ............ ${pad(k.paid_total, 6)}`);
    log(`    Bankeingang zuordenbar ....... ${pad(k.mit_bank, 6)}`);
    log(`    Stripe-Kennung, keine Bank ... ${pad(k.nur_stripe, 6)}  → anderer Kanal, kein Fehler`);
    log(`    weder Bank noch Stripe ....... ${pad(k.unklar, 6)}  → echte Prüfliste`);

    // ── Prüfliste als Datei ─────────────────────────────────────────────────
    const zeilen = (await tx.unsafe(`
      SELECT a.ref,
             a.payment_reference,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      a.contact_name, a.company_name, a.email) AS name,
             a.email,
             a.amount_due,
             a.status,
             a.created_at::date AS angelegt,
             a.person_id,
             a.assigned_agent_id,
             CASE WHEN ${stripeNachweis} THEN 'stripe' ELSE 'unklar' END AS kanal
      FROM fiaon_applications a
      WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND NOT ${bankNachweis}
      ORDER BY (CASE WHEN ${stripeNachweis} THEN 1 ELSE 0 END), a.created_at`)) as any[];

    const kopf = ["ref", "payment_reference", "name", "email", "amount_due", "status",
      "angelegt", "person_id", "assigned_agent_id", "kanal"];
    const csv = [
      kopf.join(","),
      ...zeilen.map((r) => kopf.map((s) => feld((r as any)[s])).join(",")),
    ].join("\n");

    const pfad = resolve(dirname(new URL(import.meta.url).pathname), "..",
      "reports", "paid_ohne_bankzuordnung.csv");
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, csv + "\n", "utf8");

    log();
    log(`  Prüfliste geschrieben: ${pfad}`);
    log(`  Zeilen: ${zeilen.length} (davon ${zeilen.filter((r: any) => r.kanal === "unklar").length} wirklich unklar)`);
    log();
    log("  Keine Bestellung wurde verändert. Nichts wurde zurückgesetzt.");
  });

  await sqlPool.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("\nFehler:", err?.message || err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
