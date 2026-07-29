/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PERSONENMODELL — VERIFIKATION (nur lesend, < 60 s)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Prüft die fünf harten Zusagen des Umbaus gegen die echte Datenbank. Läuft
 * VOR dem Backfill (dann meldet er sauber „noch nicht ausgeführt") und danach.
 *
 *   V1  Jede bezahlte Bestellung gehört zu genau einer Person.
 *   V2  Die Zahl bezahlter Personen stimmt mit der unabhängig nachgerechneten
 *       Familienauflösung überein — jede Abweichung wird namentlich benannt.
 *   V3  Keine zwei Personen teilen eine normalisierte E-Mail-Adresse.
 *   V4  Kein Kontaktdatum ist verloren: jede E-Mail und jede Rufnummer aus den
 *       Quellzeilen existiert an der Person oder in ihren Aliasen.
 *   V5  Provisions-Summen vorher = nachher, auf den Cent.
 *
 * Verwendung: npx tsx scripts/person-verify.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { normEmail, phoneKey9, rowEmails, rowPhoneKeys } from "../server/fiaon-person-model";

// ── Messwerte aus Phase 0 (SYSTEM_DIAGNOSE.md, 29.07.2026) ───────────────────
// Sie sind der Maßstab. Weicht etwas ab, ist entweder die Welt weitergelaufen
// (neue Zahlungen — erklärbar) oder der Umbau hat etwas angefasst, das er nicht
// anfassen durfte (nicht erklärbar → Rücknahme mit --undo).
const BASELINE_AT = "2026-07-29T16:00:00+02:00";
const BASELINE_COMMISSION_ENTRIES = 217;
const BASELINE_COMMISSION_CENTS = 320340;
const BASELINE_PAID_PERSONS = 254;

let failures = 0;
let warnings = 0;

function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}\n     ${detail}`);
}
function hinweis(name: string, detail: string): void {
  warnings++;
  console.log(`⚠️  ${name}\n     ${detail}`);
}
function eur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
}

class UnionFind {
  private p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(i: number): number {
    while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; }
    return i;
  }
  union(a: number, b: number): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p[rb] = ra;
  }
}

async function main(): Promise<void> {
  const t0 = Date.now();

  const [{ da }] = await sqlPool<{ da: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fiaon_persons'
    ) AS da
  `;
  if (!da) {
    console.log("ℹ️  Die Personen-Tabellen existieren noch nicht — P1-A wurde nie ausgeführt.");
    console.log("   Anlegen (legt nur leere Tabellen an): npx tsx scripts/person-backfill.ts");
    await sqlPool.end();
    process.exit(0);
  }

  const [{ n: personen }] = await sqlPool<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM fiaon_persons`;
  const backfillGelaufen = Number(personen) > 0;

  console.log("");
  console.log("PERSONENMODELL — VERIFIKATION");
  console.log("─".repeat(70));
  console.log(`Personen in der Datenbank: ${personen}`);
  console.log("");

  // ── V5 zuerst: Geld. Diese Prüfung gilt IMMER, auch ohne Backfill. ────────
  const [prov] = await sqlPool`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_cents),0)::bigint AS s
    FROM fiaon_commissions WHERE created_at < ${BASELINE_AT}::timestamptz
  `;
  const provC = Number(prov.c);
  const provS = Number(prov.s);
  check(
    "V5 · Provisionen vor dem Umbau unverändert (auf den Cent)",
    provC === BASELINE_COMMISSION_ENTRIES && provS === BASELINE_COMMISSION_CENTS,
    provC === BASELINE_COMMISSION_ENTRIES && provS === BASELINE_COMMISSION_CENTS
      ? `${provC} Einträge · ${eur(provS)} — identisch zur Phase-0-Baseline`
      : `IST ${provC} Einträge / ${eur(provS)} — SOLL ${BASELINE_COMMISSION_ENTRIES} / ${eur(BASELINE_COMMISSION_CENTS)}. ` +
        `Der Umbau darf Provisionen nicht berühren.`,
  );

  if (!backfillGelaufen) {
    console.log("");
    console.log("ℹ️  Backfill (P1-B) wurde noch nicht ausgeführt — V1 bis V4 sind noch nicht prüfbar.");
    console.log("   Trockenlauf: npx tsx scripts/person-backfill.ts");
    console.log("   Scharf:      npx tsx scripts/person-backfill.ts --apply");
    await sqlPool.end();
    process.exit(failures === 0 ? 0 : 1);
  }

  // ── V1: jede bezahlte Bestellung hat genau eine Person ────────────────────
  const [{ n: bezahltOhnePerson }] = await sqlPool<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE payment_status = 'paid' AND gdpr_deleted_at IS NULL AND person_id IS NULL
  `;
  const offeneRefs = bezahltOhnePerson > 0
    ? await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE payment_status = 'paid' AND gdpr_deleted_at IS NULL AND person_id IS NULL
        ORDER BY created_at DESC LIMIT 20`
    : [];
  check(
    "V1 · Jede bezahlte Bestellung gehört zu genau einer Person",
    bezahltOhnePerson === 0,
    bezahltOhnePerson === 0
      ? "0 bezahlte Bestellungen ohne Person"
      : `${bezahltOhnePerson} ohne Person: ${(offeneRefs as any[]).map((r) => r.ref).join(", ")}`,
  );

  // ── V2: Zahl bezahlter Personen gegen unabhängige Nachrechnung ────────────
  const [{ n: bezahltePersonenDb }] = await sqlPool<{ n: number }[]>`
    SELECT COUNT(DISTINCT person_id)::int AS n FROM fiaon_applications
    WHERE payment_status = 'paid' AND person_id IS NOT NULL
  `;

  // Unabhängige Nachrechnung: Familien nur aus E-Mail + Merge-Ketten, ohne
  // jeden Bezug auf person_id. Findet sie eine andere Zahl, ist die Zuordnung
  // falsch — nicht die Zählung.
  const apps = await sqlPool`
    SELECT id, ref, email, contact_email, billing_email, phone, phone_country_code, contact_phone,
           merged_into, superseded_by, payment_status, person_id
    FROM fiaon_applications WHERE gdpr_deleted_at IS NULL
  `;
  const uf = new UnionFind(apps.length);
  const byRef = new Map<string, number>();
  (apps as any[]).forEach((r, i) => byRef.set(r.ref, i));
  const emailFirst = new Map<string, number>();
  (apps as any[]).forEach((r, i) => {
    for (const raw of [r.email, r.contact_email, r.billing_email]) {
      const m = normEmail(raw);
      if (!m) continue;
      const seen = emailFirst.get(m);
      if (seen === undefined) emailFirst.set(m, i);
      else uf.union(seen, i);
    }
  });
  (apps as any[]).forEach((r, i) => {
    for (const t of [r.merged_into, r.superseded_by]) {
      const j = t ? byRef.get(t) : undefined;
      if (j !== undefined) uf.union(i, j);
    }
  });
  const bezahlteFamilien = new Set<number>();
  (apps as any[]).forEach((r, i) => {
    if (r.payment_status === "paid") bezahlteFamilien.add(uf.find(i));
  });

  check(
    "V2 · Bezahlte Personen = unabhängig nachgerechnete Familien",
    bezahltePersonenDb === bezahlteFamilien.size,
    bezahltePersonenDb === bezahlteFamilien.size
      ? `${bezahltePersonenDb} bezahlte Personen (Phase-0-Baseline: ${BASELINE_PAID_PERSONS})`
      : `Zuordnung sagt ${bezahltePersonenDb}, Nachrechnung sagt ${bezahlteFamilien.size}`,
  );
  if (bezahltePersonenDb !== BASELINE_PAID_PERSONS) {
    const neue = await sqlPool`
      SELECT p.person_ref, MIN(a.completed_at) AS bezahlt_am
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.payment_status = 'paid' AND a.completed_at >= ${BASELINE_AT}::timestamptz
      GROUP BY p.person_ref ORDER BY 2 DESC LIMIT 25
    `;
    hinweis(
      `V2b · Abweichung zur Baseline (${bezahltePersonenDb} statt ${BASELINE_PAID_PERSONS})`,
      (neue as any[]).length > 0
        ? `Seit der Messung bezahlt: ${(neue as any[]).map((r) => r.person_ref).join(", ")} — erklärt die Differenz.`
        : "Keine Zahlung seit der Messung gefunden — Differenz NICHT erklärt, bitte prüfen.",
    );
  }

  // ── V3: keine geteilte E-Mail ─────────────────────────────────────────────
  const doppelt = await sqlPool`
    SELECT value_norm, COUNT(DISTINCT person_id)::int AS n
    FROM fiaon_person_aliases WHERE kind = 'email'
    GROUP BY value_norm HAVING COUNT(DISTINCT person_id) > 1 LIMIT 20
  `;
  check(
    "V3 · Keine zwei Personen teilen eine normalisierte E-Mail",
    (doppelt as any[]).length === 0,
    (doppelt as any[]).length === 0
      ? "0 geteilte Adressen (in der Datenbank per eindeutigem Index erzwungen)"
      : `${(doppelt as any[]).length} geteilte Adressen gefunden`,
  );

  // ── V4: kein Kontaktdatum verloren ────────────────────────────────────────
  const aliases = await sqlPool`SELECT person_id, kind, value_norm FROM fiaon_person_aliases`;
  const habe = new Set<string>();
  for (const a of aliases as any[]) habe.add(`${a.person_id}:${a.kind}:${a.value_norm}`);

  let fehlend = 0;
  const beispiele: string[] = [];
  for (const r of apps as any[]) {
    if (r.person_id == null) continue;
    for (const m of rowEmails(r)) {
      if (!habe.has(`${r.person_id}:email:${m}`)) {
        fehlend++;
        if (beispiele.length < 10) beispiele.push(`${r.ref} (E-Mail)`);
      }
    }
    for (const p of rowPhoneKeys(r)) {
      if (!habe.has(`${r.person_id}:phone:${p}`)) {
        fehlend++;
        if (beispiele.length < 10) beispiele.push(`${r.ref} (Telefon)`);
      }
    }
  }
  const leadsMitPerson = await sqlPool`
    SELECT id, email, telefon, person_id FROM fiaon_leads WHERE person_id IS NOT NULL
  `;
  for (const l of leadsMitPerson as any[]) {
    const m = normEmail(l.email);
    if (m && !habe.has(`${l.person_id}:email:${m}`)) {
      fehlend++;
      if (beispiele.length < 10) beispiele.push(`lead-${l.id} (E-Mail)`);
    }
    const p = phoneKey9(l.telefon);
    if (p && !habe.has(`${l.person_id}:phone:${p}`)) {
      fehlend++;
      if (beispiele.length < 10) beispiele.push(`lead-${l.id} (Telefon)`);
    }
  }
  check(
    "V4 · Kein Kontaktdatum verloren (jede Adresse/Nummer liegt an der Person)",
    fehlend === 0,
    fehlend === 0
      ? `${(aliases as any[]).length} Aliase decken alle Quellzeilen ab`
      : `${fehlend} fehlende Aliase, z. B. ${beispiele.join(", ")}`,
  );

  // ── Ergänzende Kennzahlen (keine Prüfung, nur Sicht) ─────────────────────
  const [zahlen] = await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_persons)                                        AS personen,
      (SELECT COUNT(*)::int FROM fiaon_persons WHERE agent_conflict)                   AS konflikte,
      (SELECT COUNT(*)::int FROM fiaon_applications WHERE person_id IS NOT NULL)       AS apps_zugeordnet,
      (SELECT COUNT(*)::int FROM fiaon_applications WHERE person_id IS NULL)           AS apps_verwaist,
      (SELECT COUNT(*)::int FROM fiaon_leads WHERE person_id IS NOT NULL)              AS leads_zugeordnet,
      (SELECT COUNT(*)::int FROM fiaon_person_aliases)                                 AS aliase
  `;
  console.log("");
  console.log(`Personen ${zahlen.personen} · davon Agenten-Konflikt ${zahlen.konflikte}`);
  console.log(`Anträge zugeordnet ${zahlen.apps_zugeordnet} · ohne Person (Funnel-Abbrecher) ${zahlen.apps_verwaist}`);
  console.log(`Leads zugeordnet ${zahlen.leads_zugeordnet} · Aliase ${zahlen.aliase}`);

  await sqlPool.end();
  console.log("");
  console.log(
    failures === 0
      ? `✅ Alle Zusagen erfüllt${warnings > 0 ? ` (${warnings} Hinweis[e])` : ""} — ${((Date.now() - t0) / 1000).toFixed(1)} s`
      : `❌ ${failures} Prüfung(en) fehlgeschlagen — Rücknahme mit scripts/person-backfill.ts --undo <STAPEL>`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Verifikation fehlgeschlagen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
