/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNNEL-ABBRECHER EINMALIG ALS ENTWURF KENNZEICHNEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 3.235 Antragszeilen — 54 % des Bestands — haben WEDER E-Mail NOCH Telefon.
 * Der Funnel speichert bei jedem Schritt-Wechsel; wer vor dem Kontaktschritt
 * abbricht, hinterlässt genau so eine Zeile. Das ist kein Kunde, kein Lead und
 * kein Interessent: Man kann diese Menschen nicht einmal erreichen.
 *
 * Bisher zählten sie überall mit. Das ist der Grund, warum keine Zahl im
 * Dashboard stimmte — „Neue Anträge heute" war die Summe aus echten Anträgen
 * und Leuten, die auf Schritt 1 abgesprungen sind.
 *
 * WARUM EIN KENNZEICHEN UND KEINE WHERE-BEDINGUNG
 * Eine Bedingung, die an zwanzig Abfragen abgeschrieben wird, weicht irgendwann
 * an einer davon ab — und dann stimmt wieder nichts. Das Kennzeichen wird an
 * EINER Stelle gesetzt (`bindePersonAnAntrag`) und überall nur gelesen.
 *
 * SELBSTHEILEND
 * Der Schreibpfad setzt das Kennzeichen bei jedem Speichern neu. Trägt jemand
 * im nächsten Schritt seine E-Mail ein, ist die Zeile automatisch kein Entwurf
 * mehr. Dieses Skript holt nur den Bestand nach.
 *
 * NICHTS WIRD GELÖSCHT. Die Zeilen bleiben vollständig erhalten — sie werden
 * nur nicht mehr als Kunde gezählt.
 *
 *   npx tsx scripts/entwuerfe-kennzeichnen.ts           → Trockenlauf
 *   npx tsx scripts/entwuerfe-kennzeichnen.ts --apply   → kennzeichnet
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { ensurePersonTables } from "../server/fiaon-person-model";

const APPLY = process.argv.includes("--apply");
const log = (s = "") => console.log(s);
const pad = (v: unknown, n = 6) => String(v).padStart(n);

/**
 * Ein Entwurf ist eine Zeile ohne jeden Kontaktweg UND ohne Person.
 * Die Person ist die zweite Sicherung: Sobald eine Zeile einer Person gehört,
 * ist der Mensch erreichbar — dann ist es niemals ein Entwurf.
 */
const ENTWURF_BEDINGUNG = `
  person_id IS NULL
  AND COALESCE(
        NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), ''),
        NULLIF(TRIM(billing_email), ''), NULLIF(TRIM(phone), ''),
        NULLIF(TRIM(contact_phone), '')
      ) IS NULL
`;

async function main(): Promise<void> {
  const t0 = Date.now();
  await ensurePersonTables();

  log("\nFUNNEL-ABBRECHER ALS ENTWURF KENNZEICHNEN");
  log("═".repeat(70));

  const [zaehlung] = await sqlPool.unsafe(`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE ${ENTWURF_BEDINGUNG})::int AS entwuerfe,
      COUNT(*) FILTER (WHERE ist_entwurf)::int AS bereits_markiert,
      COUNT(*) FILTER (WHERE ist_entwurf AND NOT (${ENTWURF_BEDINGUNG}))::int AS falsch_markiert,
      COUNT(*) FILTER (WHERE (${ENTWURF_BEDINGUNG}) AND payment_status = 'paid')::int AS bezahlt_aber_entwurf
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
  `);

  log();
  log(`  Antragszeilen gesamt ............ ${pad(zaehlung.gesamt)}`);
  log(`  davon Entwürfe (kein Kontaktweg)  ${pad(zaehlung.entwuerfe)}  = ${Math.round((zaehlung.entwuerfe / zaehlung.gesamt) * 100)} % des Bestands`);
  log(`  bereits gekennzeichnet .......... ${pad(zaehlung.bereits_markiert)}`);
  log(`  zu kennzeichnen ................. ${pad(zaehlung.entwuerfe - zaehlung.bereits_markiert)}`);
  if (Number(zaehlung.falsch_markiert) > 0) {
    log(`  ⚠️  fälschlich gekennzeichnet .... ${pad(zaehlung.falsch_markiert)}  (bekommen ihr Kennzeichen zurückgenommen)`);
  }

  // Die eine Prüfung, die zählt: Eine bezahlte Zeile darf NIEMALS ein Entwurf
  // sein. Träfe das zu, wäre die Bedingung falsch — und wir würden Umsatz aus
  // der Zählung werfen.
  log();
  if (Number(zaehlung.bezahlt_aber_entwurf) > 0) {
    log(`  ❌ ABBRUCH: ${zaehlung.bezahlt_aber_entwurf} BEZAHLTE Zeilen gelten als Entwurf.`);
    log("     Das darf nicht sein — die Bedingung ist falsch. Es wurde nichts geändert.");
    await sqlPool.end();
    process.exit(1);
  }
  log("  ✓ Keine einzige bezahlte Zeile fällt unter die Entwurfs-Bedingung.");

  if (!APPLY) {
    log();
    log("  TROCKENLAUF — nichts geändert. Scharf schalten mit --apply");
    log();
    await sqlPool.end();
    return;
  }

  const gesetzt = await sqlPool.unsafe(`
    UPDATE fiaon_applications SET ist_entwurf = TRUE
    WHERE gdpr_deleted_at IS NULL AND NOT ist_entwurf AND (${ENTWURF_BEDINGUNG})
    RETURNING ref
  `);
  const zurueck = await sqlPool.unsafe(`
    UPDATE fiaon_applications SET ist_entwurf = FALSE
    WHERE gdpr_deleted_at IS NULL AND ist_entwurf AND NOT (${ENTWURF_BEDINGUNG})
    RETURNING ref
  `);

  log();
  log(`  ✅ ${gesetzt.length} Zeilen als Entwurf gekennzeichnet.`);
  if (zurueck.length > 0) log(`     ${zurueck.length} Kennzeichen zurückgenommen (inzwischen erreichbar).`);
  log("     Keine Zeile wurde gelöscht oder inhaltlich verändert.");
  log(`     Dauer: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  log();

  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nFehlgeschlagen:", err?.message || err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
