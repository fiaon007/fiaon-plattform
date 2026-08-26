// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND FÜR DAS CHEFBÜRO (26.08.2026)
//
// Ruft jede Abfrage der neuen Chef-Endpunkte gegen die ECHTE Datenbank auf,
// bevor irgendetwas live geht. Grund: Beim Bau dieser Endpunkte waren vier
// Spaltennamen falsch geraten (nummer statt rate_nr, created_at statt
// issued_at, email statt primary_email, portal_access_at existierte gar
// nicht). Jeder einzelne wäre erst live als leere Kachel aufgefallen.
//
// Aufruf:  npx tsx scripts/chef-pruefstand.ts
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "../server/lib/db-pool";

let gut = 0, schlecht = 0;

async function probe(name: string, fn: () => Promise<any>) {
  const t0 = Date.now();
  try {
    const erg = await fn();
    const ms = Date.now() - t0;
    const zahl = Array.isArray(erg) ? `${erg.length} Zeilen` : typeof erg === "object" ? "Objekt" : String(erg);
    const warnung = ms > 1500 ? `  ← LANGSAM (${ms} ms)` : "";
    console.log(`   ok   ${name.padEnd(38)} ${zahl.padEnd(14)} ${String(ms).padStart(5)} ms${warnung}`);
    gut++;
    return erg;
  } catch (e: any) {
    console.log(`   ✗    ${name.padEnd(38)} ${String(e?.message).slice(0, 90)}`);
    schlecht++;
    return null;
  }
}

const HEUTE = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";
const ECHT = "p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL";

(async () => {
  console.log("── WAHRHEITS-CHECK ──");
  await probe("ohneKette", () => sqlPool.unsafe(`
    SELECT a.ref, a.pack_name, a.amount_due,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde, a.created_at
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status='paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
       AND COALESCE(a.pack_key,'') NOT IN ('schufa','')
       AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref)
     ORDER BY a.created_at DESC LIMIT 50`));
  await probe("ohneAgent", () => sqlPool.unsafe(`
    SELECT a.ref, a.pack_name, a.amount_due, a.created_at,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status='paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
       AND p.assigned_agent_id IS NULL ORDER BY a.created_at DESC LIMIT 50`));
  await probe("provOffen", () => sqlPool.unsafe(`
    SELECT ag.id AS agent_id, ag.name, COUNT(*)::int AS positionen,
           SUM(c.amount_cents)::int AS summe, MIN(c.created_at)::date AS aelteste
      FROM fiaon_commissions c JOIN fiaon_agents ag ON ag.id = c.agent_id
     WHERE c.status='bestaetigt' AND c.payout_id IS NULL
     GROUP BY ag.id, ag.name ORDER BY SUM(c.amount_cents) DESC`));
  await probe("widerspruch", () => sqlPool.unsafe(`
    SELECT a.ref, a.payment_status, COUNT(r.id)::int AS bezahlte_raten, SUM(r.betrag_cents)::int AS summe,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.bezahlt_am IS NOT NULL AND a.payment_status <> 'paid' AND a.merged_into IS NULL
     GROUP BY a.ref, a.payment_status, p.first_name, p.last_name
     ORDER BY SUM(r.betrag_cents) DESC LIMIT 50`));
  await probe("nichtFrei (Person, kein Passwort)", () => sqlPool.unsafe(`
    SELECT p.id AS person_id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
           p.primary_email AS email, MAX(a.paid_at) AS zuletzt_bezahlt, STRING_AGG(DISTINCT a.ref, ', ') AS akten
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status='paid' AND a.merged_into IS NULL
     GROUP BY p.id, p.first_name, p.last_name, p.primary_email
    HAVING COUNT(*) FILTER (WHERE a.password IS NOT NULL AND a.password <> '') = 0
     ORDER BY MAX(a.paid_at) DESC NULLS LAST LIMIT 100`));

  console.log("\n── FREIGABESTAPEL ──");
  await probe("Auszahlungen offen", () => sqlPool.unsafe(`
    SELECT po.id, po.amount_cents, po.requested_at, po.iban_masked, ag.name AS mitarbeiter, ag.email
      FROM fiaon_payouts po JOIN fiaon_agents ag ON ag.id = po.agent_id
     WHERE po.status IN ('requested','angefordert','offen') ORDER BY po.requested_at ASC NULLS LAST`));
  await probe("Abrechnungen ungesendet", () => sqlPool.unsafe(`
    SELECT s.id, s.statement_no, s.payout_id, s.issued_at, (s.pdf_base64 IS NOT NULL) AS hat_pdf,
           COALESCE(s.net_cents, s.gross_cents, po.amount_cents) AS amount_cents, ag.name AS mitarbeiter, ag.email
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_payouts po ON po.id = s.payout_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(po.agent_id, s.agent_id)
     WHERE s.gesendet_am IS NULL ORDER BY s.issued_at DESC NULLS LAST`));
  await probe("Entscheidung (Mahnstufe 3+)", () => sqlPool.unsafe(`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am, r.mahnstufe,
           (${HEUTE} - r.faellig_am) AS tage_offen,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_abo_raten r LEFT JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status='offen' AND r.bezahlt_am IS NULL AND r.storniert_am IS NULL
       AND r.mahnstufe >= 3 AND r.faellig_am < ${HEUTE}
     ORDER BY r.faellig_am ASC LIMIT 100`));
  await probe("Belege fehlen", () => sqlPool.unsafe(`
    SELECT COUNT(*) FROM fiaon_payouts po WHERE po.status IN ('ausgezahlt','paid')
       AND NOT EXISTS (SELECT 1 FROM fiaon_commission_statements s WHERE s.payout_id = po.id)`));

  console.log("\n── POSTEINGANG ──");
  await probe("Anfragen von der Website", () => sqlPool.unsafe(`
    SELECT id, art, name, email, firma, telefon, rolle, land, text, created_at
      FROM fiaon_anfragen ORDER BY created_at DESC LIMIT 100`));
  await probe("Offene Kundentickets", () => sqlPool.unsafe(`
    SELECT t.id, t.ref, t.betreff, t.text, t.status, t.created_at, t.beantwortet_am,
           ag.name AS zustaendig,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
           EXTRACT(EPOCH FROM (NOW() - t.created_at))/3600 AS liegt_stunden
      FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.status <> 'geschlossen' ORDER BY t.created_at ASC LIMIT 100`));

  console.log("\n── KUNDENAUFLISTUNG ──");
  const bezahltHat = `EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id
                               AND a3.payment_status='paid' AND a3.merged_into IS NULL)`;
  const basis = `
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.bezahlt_am IS NOT NULL),0)::bigint AS bezahlt_cents,
             COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL AND r.status='offen'),0)::bigint AS offen_cents,
             COUNT(*) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL AND r.status='offen' AND r.faellig_am < ${HEUTE})::int AS ueberfaellig,
             MAX(r.bezahlt_am) AS letzte_zahlung,
             MIN(r.faellig_am) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL AND r.status='offen') AS naechste_faellig,
             MAX(r.mahnstufe) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL AND r.status='offen') AS hoechste_mahnstufe
        FROM fiaon_applications a JOIN fiaon_abo_raten r ON r.ref = a.ref
       WHERE a.person_id = p.id AND a.merged_into IS NULL
    ) g ON TRUE
    WHERE ${ECHT}`;
  const seite = await probe("Seite 1, 50 Zeilen", () => sqlPool.unsafe(`
    SELECT p.id, p.person_ref, p.first_name, p.last_name, p.company_name,
           p.primary_email, p.primary_phone, p.city, p.zip, p.priority_tier,
           p.mandat_seit, p.assigned_agent_id, p.assigned_at, p.is_blocked,
           p.inkasso_ab, p.created_at, p.follow_up_date, ag.name AS mitarbeiter,
           g.bezahlt_cents, g.offen_cents, g.ueberfaellig, g.letzte_zahlung,
           g.naechste_faellig, g.hoechste_mahnstufe,
           (SELECT STRING_AGG(DISTINCT a6.pack_name, ' · ') FROM fiaon_applications a6
             WHERE a6.person_id = p.id AND a6.merged_into IS NULL AND a6.payment_status='paid'
               AND a6.pack_name IS NOT NULL) AS pakete,
           EXISTS (SELECT 1 FROM fiaon_applications a7 WHERE a7.person_id = p.id
                    AND a7.merged_into IS NULL AND a7.password IS NOT NULL AND a7.password <> '') AS hat_zugang,
           (SELECT a8.ref FROM fiaon_applications a8 WHERE a8.person_id = p.id AND a8.merged_into IS NULL
             ORDER BY (a8.payment_status='paid') DESC, a8.created_at DESC LIMIT 1) AS ref
    ${basis} ORDER BY letzte_zahlung DESC NULLS LAST, p.created_at DESC LIMIT 50 OFFSET 0`));
  await probe("Suche mit Parameter", () => sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE ${ECHT} AND (p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.primary_email ILIKE $1)`, ["%a%"]));
  await probe("Kopfzahlen", () => sqlPool.unsafe(`
    SELECT COUNT(*)::int AS menschen, COUNT(*) FILTER (WHERE ${bezahltHat})::int AS zahlende,
           COUNT(*) FILTER (WHERE p.mandat_seit IS NOT NULL)::int AS mandate,
           COUNT(*) FILTER (WHERE p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL)::int AS pool,
           COUNT(*) FILTER (WHERE p.is_blocked)::int AS gesperrt,
           COUNT(*) FILTER (WHERE p.inkasso_ab IS NOT NULL)::int AS inkasso
      FROM fiaon_persons p WHERE ${ECHT}`));

  console.log("\n── ZAHLUNGSZENTRALE ──");
  const zBasis = `
    FROM fiaon_abo_raten r
    LEFT JOIN fiaon_applications a ON a.ref = r.ref
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE r.bezahlt_am IS NOT NULL
      AND date_trunc('month', r.bezahlt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('month', ${HEUTE})`;
  const zahlungen = await probe("Zahlungen des Monats", () => sqlPool.unsafe(`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.bezahlt_am, r.faellig_am,
           r.zahlungsreferenz, r.quelle, r.status, r.mahnstufe, r.lastschrift_status,
           r.rechnung_am, r.notiz,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r2 WHERE r2.ref = r.ref) AS raten_gesamt,
           a.pack_name, a.pack_key, a.amount_due, a.payment_status,
           p.id AS person_id, p.person_ref,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
           p.primary_email, p.primary_phone, p.city,
           ag.id AS agent_id, ag.name AS mitarbeiter, ag.commission_rate_bp,
           (SELECT c.amount_cents FROM fiaon_commissions c WHERE c.ref = r.ref
             AND c.base_amount_cents = r.betrag_cents ORDER BY c.created_at DESC LIMIT 1) AS provision_cents,
           (SELECT c.rate_bp FROM fiaon_commissions c WHERE c.ref = r.ref
             AND c.base_amount_cents = r.betrag_cents ORDER BY c.created_at DESC LIMIT 1) AS provision_bp,
           (SELECT c.payout_id IS NOT NULL FROM fiaon_commissions c WHERE c.ref = r.ref
             AND c.base_amount_cents = r.betrag_cents ORDER BY c.created_at DESC LIMIT 1) AS abgerechnet
    ${zBasis} ORDER BY r.bezahlt_am DESC LIMIT 50 OFFSET 0`));
  const summe = await probe("Monatssumme", () => sqlPool.unsafe(`
    SELECT COALESCE(SUM(r.betrag_cents),0)::bigint AS cents, COUNT(DISTINCT p.id)::int AS kunden,
           COUNT(*)::int AS zahlungen ${zBasis}`));
  await probe("Verlauf 12 Monate", () => sqlPool.unsafe(`
    SELECT to_char(date_trunc('month', bezahlt_am AT TIME ZONE 'Europe/Berlin'),'YYYY-MM') AS monat,
           SUM(betrag_cents)::bigint AS cents, COUNT(*)::int AS anzahl
      FROM fiaon_abo_raten WHERE bezahlt_am IS NOT NULL
        AND bezahlt_am >= (${HEUTE} - INTERVAL '11 months') GROUP BY 1 ORDER BY 1`));

  console.log("\n── EINZELNE AKTE ──");
  const einer = seite?.[0]?.id;
  if (einer) {
    await probe(`Person ${einer}: Akten`, () => sqlPool`
      SELECT ref, pack_name, pack_key, amount_due, payment_status, paid_at, created_at,
             onboarding_stufe, merged_into, (password IS NOT NULL AND password <> '') AS hat_passwort
        FROM fiaon_applications WHERE person_id = ${einer} ORDER BY created_at DESC`);
    await probe(`Person ${einer}: Raten`, () => sqlPool`
      SELECT r.* FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
       WHERE a.person_id = ${einer} ORDER BY r.faellig_am ASC`);
    await probe(`Person ${einer}: Termine`, () => sqlPool`
      SELECT id, beginn, status, quelle, herkunft FROM fiaon_termine
       WHERE person_id = ${einer} ORDER BY beginn DESC LIMIT 20`);
    await probe(`Person ${einer}: Vermerke`, () => sqlPool`
      SELECT id, text, created_at, agent_id FROM fiaon_vermerke
       WHERE person_id = ${einer} ORDER BY created_at DESC LIMIT 30`);
  }

  // ── GEGENPROBE: Sagt die Zahlungszentrale dasselbe wie das Lagezimmer? ──
  console.log("\n── GEGENPROBE ──");
  const [lage] = (await sqlPool.unsafe(`
    SELECT COALESCE(SUM(betrag_cents),0)::bigint AS cents FROM fiaon_abo_raten
     WHERE bezahlt_am IS NOT NULL
       AND date_trunc('month', bezahlt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('month', ${HEUTE})`)) as any[];
  const a = Number(lage?.cents ?? -1);
  const b = Number(summe?.[0]?.cents ?? -2);
  const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 });
  if (a === b) { console.log(`   ok   Lagezimmer und Zahlungszentrale: beide ${eur(a)} EUR`); gut++; }
  else { console.log(`   ✗    AUSEINANDER: Lagezimmer ${eur(a)} vs. Zahlungszentrale ${eur(b)}`); schlecht++; }

  console.log(`\n${gut} in Ordnung, ${schlecht} fehlerhaft.`);
  if (zahlungen?.length) {
    const z = zahlungen[0];
    console.log(`\nBeispielzeile: ${z.kunde} · ${z.pack_name} · Rate ${z.rate_nr}/${z.raten_gesamt} · ${eur(Number(z.betrag_cents))} EUR · ${z.mitarbeiter ?? "kein Mitarbeiter"} · Provision ${z.provision_cents != null ? eur(Number(z.provision_cents)) + " EUR" : "nicht gebucht"}`);
  }
  await sqlPool.end();
  process.exit(schlecht ? 1 : 0);
})();
