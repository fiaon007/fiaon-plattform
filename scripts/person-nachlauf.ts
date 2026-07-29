/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NACHLAUF — WIE VIELE ZEILEN ENTSTEHEN OHNE PERSON?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der Backfill hat 4.224 Personen angelegt. Solange aber kein Schreibpfad die
 * Person kennt, entsteht jede neue Bestellung und jeder neue Lead wieder ohne
 * Zuordnung. Diese Zahl wächst stündlich — sie ist der Beleg dafür, dass der
 * Dauerschutz (P1-C) keine Fleißaufgabe ist, sondern die eigentliche Arbeit.
 *
 * Das Skript liest ausschliesslich. Es verändert nichts.
 *
 *   npx tsx scripts/person-nachlauf.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));
const pad = (v: unknown, n = 6) => String(v).padStart(n);
const zeit = (d: Date) => d.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

async function main(): Promise<void> {
  log();
  log("NACHLAUF-MESSUNG — ZEILEN OHNE PERSON");
  log("═".repeat(74));

  // ── Der Stapel als Zeitmarke ──────────────────────────────────────────────
  const stapel = await sqlPool`
    SELECT batch_id, started_at, finished_at, persons_created, apps_linked,
           leads_linked, conflicts, orphans, undone_at
    FROM fiaon_person_batches
    ORDER BY started_at ASC
  `;
  log();
  log("BACKFILL-STAPEL");
  linie();
  for (const b of stapel as any[]) {
    const zustand = b.undone_at ? `zurückgenommen ${zeit(new Date(b.undone_at))}` : "gültig";
    log(`  ${b.batch_id}  ${zustand}`);
    log(`     Personen ${pad(b.persons_created)} · Anträge ${pad(b.apps_linked)} · Leads ${pad(b.leads_linked)} · Konflikte ${pad(b.conflicts)}`);
  }
  const gueltig = (stapel as any[]).filter((b) => !b.undone_at);
  const stichtag: Date | null = gueltig.length > 0
    ? new Date(gueltig[gueltig.length - 1].finished_at ?? gueltig[gueltig.length - 1].started_at)
    : null;
  if (!stichtag) {
    log("  Kein gültiger Stapel — der Backfill ist nicht gelaufen oder wurde zurückgenommen.");
  } else {
    log();
    log(`  Stichtag für den Nachlauf: ${zeit(stichtag)}`);
  }

  // ── Nachlauf: seit dem Backfill entstanden, ohne person_id ────────────────
  const [appNach] = await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person,
      COUNT(*) FILTER (WHERE person_id IS NULL AND payment_status = 'paid')::int AS ohne_person_bezahlt,
      COUNT(*) FILTER (WHERE person_id IS NULL
                         AND COALESCE(NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), ''),
                                      NULLIF(TRIM(billing_email), ''), NULLIF(TRIM(phone), ''),
                                      NULLIF(TRIM(contact_phone), '')) IS NOT NULL)::int AS ohne_person_kontaktierbar
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
      AND created_at > ${stichtag}
  `;
  const [leadNach] = await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person
    FROM fiaon_leads
    WHERE erstellt_am > ${stichtag}
  `;

  const stunden = stichtag ? Math.max(1, (Date.now() - stichtag.getTime()) / 3600000) : 1;
  const nachlauf = Number(appNach.ohne_person) + Number(leadNach.ohne_person);

  log();
  log("SEIT DEM BACKFILL ENTSTANDEN");
  linie("═");
  log(`  Antragszeilen ................... ${pad(appNach.gesamt)}`);
  log(`    davon OHNE person_id .......... ${pad(appNach.ohne_person)}`);
  log(`      davon kontaktierbar ......... ${pad(appNach.ohne_person_kontaktierbar)}  (hätten eine Person bekommen müssen)`);
  log(`      davon bereits bezahlt ....... ${pad(appNach.ohne_person_bezahlt)}`);
  log(`  Leads ........................... ${pad(leadNach.gesamt)}`);
  log(`    davon OHNE person_id .......... ${pad(leadNach.ohne_person)}`);
  log();
  log(`  Nachlauf gesamt ................. ${pad(nachlauf)} Zeilen in ${stunden.toFixed(1)} Stunden`);
  log(`  Hochgerechnet ................... ${pad((nachlauf / stunden * 24).toFixed(1))} pro Tag`);
  if (nachlauf === 0) {
    log("  Noch nichts nachgelaufen — der Vorsprung hält aber nur bis zur nächsten Bestellung.");
  }

  // ── Gesamtbestand ohne Person ─────────────────────────────────────────────
  const [appAlle] = await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person,
      COUNT(*) FILTER (WHERE person_id IS NULL
                         AND COALESCE(NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), ''),
                                      NULLIF(TRIM(billing_email), ''), NULLIF(TRIM(phone), ''),
                                      NULLIF(TRIM(contact_phone), '')) IS NOT NULL)::int AS ohne_person_kontaktierbar
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
  `;
  const [leadAlle] = await sqlPool`
    SELECT COUNT(*)::int AS gesamt, COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person
    FROM fiaon_leads
  `;
  log();
  log("GESAMTBESTAND");
  linie("═");
  log(`  Antragszeilen ................... ${pad(appAlle.gesamt)}`);
  log(`    ohne person_id ................ ${pad(appAlle.ohne_person)}`);
  log(`      davon kontaktierbar ......... ${pad(appAlle.ohne_person_kontaktierbar)}  (echter Rückstand)`);
  log(`      davon Funnel-Abbrecher ...... ${pad(Number(appAlle.ohne_person) - Number(appAlle.ohne_person_kontaktierbar))}  (bewusst ohne Person)`);
  log(`  Leads ........................... ${pad(leadAlle.gesamt)}`);
  log(`    ohne person_id ................ ${pad(leadAlle.ohne_person)}`);

  // ── Die Agenten-Konflikte aufschlüsseln ───────────────────────────────────
  const konflikte = await sqlPool`
    SELECT p.id, p.person_ref, p.assigned_agent_id, p.quality_flags,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email) AS name,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlte,
           (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.person_id = p.id) AS bestellungen,
           (SELECT COUNT(*)::int FROM fiaon_leads l WHERE l.person_id = p.id) AS leads
    FROM fiaon_persons p
    WHERE p.agent_conflict = TRUE
    ORDER BY bezahlte DESC, p.id ASC
  `;
  const mitBezahlt = (konflikte as any[]).filter((k) => Number(k.bezahlte) > 0);

  log();
  log("AGENTEN-KONFLIKTE");
  linie("═");
  log(`  Personen mit mehreren Agenten ... ${pad(konflikte.length)}`);
  log(`    davon mit bezahlter Bestellung  ${pad(mitBezahlt.length)}  (hier hängt Provision dran)`);
  log(`    davon ohne Zahlung .............${pad(konflikte.length - mitBezahlt.length)}`);

  // Welche Agenten sind betroffen?
  const agentZaehler = new Map<number, { konflikte: number; bezahlt: number }>();
  for (const k of konflikte as any[]) {
    const flags = typeof k.quality_flags === "string" ? JSON.parse(k.quality_flags) : k.quality_flags;
    const agenten: number[] = Array.isArray(flags?.agents) ? flags.agents.map(Number) : [];
    for (const a of agenten) {
      const e = agentZaehler.get(a) ?? { konflikte: 0, bezahlt: 0 };
      e.konflikte++;
      if (Number(k.bezahlte) > 0) e.bezahlt++;
      agentZaehler.set(a, e);
    }
  }
  if (agentZaehler.size > 0) {
    const ids = Array.from(agentZaehler.keys());
    const namen = await sqlPool`
      SELECT id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name, email) AS name
      FROM fiaon_agents WHERE id = ANY(${ids}::int[])
    `.catch(() => []);
    const nameById = new Map((namen as any[]).map((u) => [Number(u.id), String(u.name)]));
    log();
    log("  Betroffene Agenten:");
    for (const [id, e] of Array.from(agentZaehler.entries()).sort((a, b) => b[1].konflikte - a[1].konflikte)) {
      log(`    ${String(nameById.get(id) ?? `Agent ${id}`).slice(0, 30).padEnd(32)} ${pad(e.konflikte, 3)} Konflikte · ${pad(e.bezahlt, 3)} mit Zahlung`);
    }
  }

  // ── Aufräum-Kontrolle nach dem --undo ─────────────────────────────────────
  const [leichen] = await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE NOT EXISTS (SELECT 1 FROM fiaon_person_aliases a WHERE a.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM fiaon_leads l WHERE l.person_id = p.id)
  `;
  const [waisenAlias] = await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_person_aliases a
    WHERE NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id)
  `;
  const [totLink] = await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.person_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id)) AS apps,
      (SELECT COUNT(*)::int FROM fiaon_leads l
        WHERE l.person_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l.person_id)) AS leads
  `;
  const [personen] = await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons`;

  log();
  log("AUFRÄUM-KONTROLLE NACH DEM --undo");
  linie("═");
  log(`  Personen insgesamt .............. ${pad(personen.n)}`);
  log(`  Personen ohne Alias UND ohne Zeile ${pad(leichen.n)}  ${leichen.n === 0 ? "✓ keine Leichen" : "✗ Rückstände"}`);
  log(`  Aliase ohne Person .............. ${pad(waisenAlias.n)}  ${waisenAlias.n === 0 ? "✓" : "✗"}`);
  log(`  Anträge mit toter person_id ..... ${pad(totLink.apps)}  ${Number(totLink.apps) === 0 ? "✓" : "✗"}`);
  log(`  Leads mit toter person_id ....... ${pad(totLink.leads)}  ${Number(totLink.leads) === 0 ? "✓" : "✗"}`);

  const sauber = Number(leichen.n) === 0 && Number(waisenAlias.n) === 0
    && Number(totLink.apps) === 0 && Number(totLink.leads) === 0;
  log();
  log(sauber
    ? "  ✓ Der zurückgenommene Zweitlauf hat nichts hinterlassen."
    : "  ✗ Es liegen Rückstände. Vor dem nächsten Lauf bereinigen.");

  log();
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nMessung fehlgeschlagen:", err?.message || err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
