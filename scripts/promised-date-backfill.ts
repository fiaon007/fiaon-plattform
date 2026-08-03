/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKFILL: promised_payment_date auf der Person
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Migration 032 hat die Spalte angelegt, aber nie gefüllt. Ohne sie kann die
 * Tagesliste „Heute fällig" nicht funktionieren.
 *
 * WAS HIER RICHTIGGESTELLT WIRD
 * `tier_reason = 'zahlung_angekuendigt'` klingt nach einer telefonischen Zusage,
 * kommt aber aus `payment_status = 'claimed_paid'` (server/lib/tier.ts): Der
 * KUNDE hat selbst „bezahlt" gemeldet, das Geld ist nicht angekommen. Das ist
 * kein Termin, sondern ein Prüffall.
 *
 * Ein echtes Zusagedatum entsteht nur im Gespräch: `fiaon_contact_log` mit
 * `outcome = 'erreicht_zahlt_am'` trägt dann `promised_date`. Genau diese Daten
 * werden hier übernommen — der jüngste Eintrag pro Person gewinnt, weil eine
 * neue Zusage die alte ersetzt.
 *
 * `erreicht_zahlt_gleich` bekommt bewusst KEIN Datum. „Zahlt gleich“ heißt
 * jetzt; ein erfundenes Datum würde einen Termin behaupten, den niemand genannt
 * hat. Diese Personen laufen über die Wiedervorlage.
 *
 * NUR PERSONEN MIT OFFENER ZAHLUNG
 * Tier 0 (bezahlt) und Tier -1 (ausgeschlossen) bleiben aussen vor. Von den 74
 * auffindbaren Zusagen gehört die Mehrheit zu Kunden, die inzwischen bezahlt
 * haben — ihr altes Zusagedatum wäre nur noch Rauschen und würde sie in jeder
 * Überfällig-Liste auftauchen lassen, obwohl sie nichts mehr schulden.
 *
 * WIEDERVORLAGE FÜR ALLE OHNE DATUM
 * Wer Tier 1 ist und kein Zusagedatum hat, bekommt `follow_up_date` auf morgen —
 * sonst wäre er in jeder Tagesliste unsichtbar. Ein bereits gesetztes
 * `follow_up_date` wird NICHT überschrieben: Der Agent hat sich dann schon
 * etwas überlegt, und diese Entscheidung ist besser als die des Skripts.
 *
 * Der Kontaktverlauf hängt an `ref` (Antrag), nicht an der Person. Der Weg führt
 * deshalb über `fiaon_applications.person_id` — und über ALLE Anträge der
 * Person, weil die Zusage an einer beliebigen ihrer Bestellungen notiert sein
 * kann.
 *
 *   npx tsx scripts/promised-date-backfill.ts            # nur zeigen
 *   npx tsx scripts/promised-date-backfill.ts --apply
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const APPLY = process.argv.includes("--apply");

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));

async function main() {
  linie("═");
  log("  BACKFILL: promised_payment_date");
  log(`  Modus: ${APPLY ? "SCHREIBEN" : "nur zeigen (--apply fehlt)"}`);
  linie("═");
  log();

  // ── Was ist überhaupt auffindbar? ────────────────────────────────────────
  const [lage] = (await sqlPool`
    WITH zusagen AS (
      SELECT DISTINCT ON (ap.person_id)
             ap.person_id, c.promised_date, c.created_at, c.agent_name
      FROM fiaon_contact_log c
      JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE c.promised_date IS NOT NULL
        AND c.voided_at IS NULL
        AND ap.person_id IS NOT NULL
      ORDER BY ap.person_id, c.created_at DESC
    )
    SELECT
      count(*) FILTER (WHERE z.promised_date IS NOT NULL)::int AS mit_datum,
      count(*) FILTER (WHERE z.promised_date IS NULL AND p.priority_tier = 1)::int AS tier1_ohne_datum,
      count(*) FILTER (WHERE z.promised_date IS NOT NULL
                         AND z.promised_date < CURRENT_DATE)::int AS datum_in_vergangenheit
    FROM fiaon_persons p
    LEFT JOIN zusagen z ON z.person_id = p.id
    WHERE p.merged_into_person_id IS NULL
      AND p.priority_tier NOT IN (0, -1)
  `) as any[];

  log(`  Personen mit auffindbarem Zusagedatum:      ${lage.mit_datum}`);
  log(`  davon Datum liegt in der Vergangenheit:     ${lage.datum_in_vergangenheit}`);
  log(`  Tier-1-Personen ohne Zusagedatum:           ${lage.tier1_ohne_datum}`);
  log();
  log("  Die Tier-1-Personen ohne Datum sind keine offenen Termine, sondern");
  log("  Prüffälle: Der Kunde hat selbst „bezahlt“ gemeldet, das Geld fehlt.");
  log("  Sie bekommen eine Wiedervorlage auf morgen, damit sie sichtbar sind.");
  log();

  if (!APPLY) {
    // Vorschau: die ersten Übernahmen zeigen, damit man sie gegenlesen kann.
    const beispiele = (await sqlPool`
      WITH zusagen AS (
        SELECT DISTINCT ON (ap.person_id)
               ap.person_id, c.promised_date, c.created_at, c.agent_name
        FROM fiaon_contact_log c
        JOIN fiaon_applications ap ON ap.ref = c.ref
        WHERE c.promised_date IS NOT NULL AND c.voided_at IS NULL AND ap.person_id IS NOT NULL
        ORDER BY ap.person_id, c.created_at DESC
      )
      SELECT p.id, p.priority_tier AS tier, p.tier_reason,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.contact_name, p.primary_email) AS person,
             z.promised_date, z.agent_name
      FROM fiaon_persons p
      JOIN zusagen z ON z.person_id = p.id
      WHERE p.merged_into_person_id IS NULL
        AND p.priority_tier NOT IN (0, -1)
        AND p.promised_payment_date IS DISTINCT FROM z.promised_date
      ORDER BY z.promised_date
      LIMIT 12
    `) as any[];

    if (beispiele.length > 0) {
      log("  Beispiele der Übernahme (erste 12):");
      for (const b of beispiele) {
        const d = new Date(b.promised_date).toLocaleDateString("de-DE");
        log(`    Tier ${b.tier}  ${d}  ${String(b.person ?? "").slice(0, 30).padEnd(30)}  notiert von ${b.agent_name ?? "—"}`);
      }
      log();
    }
    linie();
    log("  Nichts geschrieben. Mit --apply übernehmen.");
    linie();
    await sqlPool.end({ timeout: 5 });
    return;
  }

  // ── 1 · Zusagedaten übernehmen ───────────────────────────────────────────
  const gesetzt = await sqlPool`
    WITH zusagen AS (
      SELECT DISTINCT ON (ap.person_id) ap.person_id, c.promised_date
      FROM fiaon_contact_log c
      JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE c.promised_date IS NOT NULL
        AND c.voided_at IS NULL
        AND ap.person_id IS NOT NULL
      ORDER BY ap.person_id, c.created_at DESC
    )
    UPDATE fiaon_persons p
       SET promised_payment_date = z.promised_date,
           updated_at = NOW()
      FROM zusagen z
     WHERE p.id = z.person_id
       AND p.merged_into_person_id IS NULL
       AND p.priority_tier NOT IN (0, -1)
       AND p.promised_payment_date IS DISTINCT FROM z.promised_date
    RETURNING p.id
  `;
  log(`  ${gesetzt.length} Zusagedaten übernommen.`);

  // ── 2 · Wiedervorlage für Tier 1 ohne Datum ──────────────────────────────
  // `follow_up_date IS NULL` schützt eine bestehende Entscheidung des Agenten.
  const wiedervorlage = await sqlPool`
    UPDATE fiaon_persons
       SET follow_up_date = CURRENT_DATE + 1,
           updated_at = NOW()
     WHERE merged_into_person_id IS NULL
       AND priority_tier = 1
       AND promised_payment_date IS NULL
       AND follow_up_date IS NULL
       AND NOT is_blocked
    RETURNING id
  `;
  log(`  ${wiedervorlage.length} Wiedervorlagen auf morgen gesetzt (Tier 1 ohne Datum).`);
  log();

  // ── Kontrolle ────────────────────────────────────────────────────────────
  const [rest] = (await sqlPool`
    SELECT
      count(*) FILTER (WHERE priority_tier = 1
                         AND promised_payment_date IS NULL
                         AND follow_up_date IS NULL
                         AND NOT is_blocked)::int AS tier1_unsichtbar,
      count(*) FILTER (WHERE priority_tier = 1 AND promised_payment_date IS NOT NULL)::int AS tier1_mit_datum,
      count(*) FILTER (WHERE priority_tier = 1)::int AS tier1_gesamt
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL
  `) as any[];

  linie("═");
  log(`  Tier 1 gesamt:        ${rest.tier1_gesamt}`);
  log(`  davon mit Zusagedatum: ${rest.tier1_mit_datum}`);
  log(`  ohne Datum UND ohne Wiedervorlage (unsichtbar): ${rest.tier1_unsichtbar}`);
  if (rest.tier1_unsichtbar === 0) {
    log();
    log("  KONTROLLE BESTANDEN — keine Tier-1-Person ist unsichtbar.");
  } else {
    log();
    log("  KONTROLLE FEHLGESCHLAGEN — es bleiben unsichtbare Tier-1-Personen.");
  }
  linie("═");

  await sqlPool.end({ timeout: 5 });
  if (rest.tier1_unsichtbar !== 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("[PROMISED-DATE-BACKFILL]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
