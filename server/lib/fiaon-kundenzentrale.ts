// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN-ZENTRALE — eine Liste statt sechs Seiten
//
// Der Betreiber sprang bisher zwischen sechs sich überlappenden Seiten:
// „Kunden — die eine Liste", „Anträge & KYC", „Kunden & Zuordnung", „Offene
// Kartei" (seit 03.08. stillgelegt), „Leads" und „Kündigungen". Jede hatte
// ihre eigene Suche, ihre eigenen Filter und ihre eigene Vorstellung davon,
// was ein Kunde ist.
//
// Diese Datei ist die eine Abfrage dahinter. Sie benutzt, was schon da ist:
//   Filterbedingungen   server/lib/fiaon-bestand-filter.ts
//   Statusvokabular     shared/fiaon-kundenstatus.ts
//   Stufen A/B/C        priority_tier
//
// FILTER SIND KOMBINIERBAR UND STEHEN IN DER ADRESSE. Ein Kollege soll einen
// Link schicken können statt „geh auf Kunden, dann Stufe B, dann ohne Agent".
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { echtePersonSql } from "./fiaon-bestand-filter";

type Lauf = typeof sqlPool;

export interface Filter {
  q?: string;
  /** Stufen A/B/C bzw. bezahlt — mehrfach wählbar. */
  stufe?: string[];
  /** Statusvokabular (tier_reason). */
  status?: string[];
  agent?: number | null;
  /** „ohne" = ausdrücklich niemand zuständig. */
  ohneAgent?: boolean;
  paket?: string;
  quelle?: string;
  von?: string;
  bis?: string;
  /** Spezialfilter, alle kombinierbar. */
  ohneTelefon?: boolean;
  dubletten?: boolean;
  zahlungUnbestaetigt?: boolean;
  anonyme?: boolean;
  kuendigungen?: boolean;
  kycOffen?: boolean;
  ruhend?: boolean;
  /** Testeinträge NUR mit diesem Schalter. */
  tests?: boolean;
  archiv?: boolean;
  sortierung?: "arbeit" | "neueste" | "name" | "umsatz";
  limit?: number;
  offset?: number;
}

const NAME_SQL = `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                           p.company_name, p.contact_name, p.primary_email, p.person_ref)`;

const MAIL_SQL = `COALESCE(NULLIF(p.primary_email, ''), (
  SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
  FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
  ORDER BY a.created_at DESC LIMIT 1))`;

/**
 * Baut die WHERE-Bedingungen. Werte gehen IMMER als Parameter, nie in den Text
 * — dieselbe Regel wie in fiaon-bestand-filter.ts.
 */
function bedingungen(f: Filter): { wo: string[]; werte: unknown[] } {
  const wo: string[] = [echtePersonSql("p")];
  const werte: unknown[] = [];
  const par = (v: unknown): string => { werte.push(v); return `$${werte.length}`; };

  // ── Testeinträge ────────────────────────────────────────────────────────
  // `echtePersonSql` schließt sie aus. Wer sie sehen will, muss es sagen —
  // dann wird die Bedingung ersetzt, nicht ergänzt.
  if (f.tests) {
    wo[0] = "p.merged_into_person_id IS NULL AND p.ist_test_am IS NOT NULL";
  }

  // Gelöschte tauchen nie auf, in keinem Filter.
  wo.push(`NOT EXISTS (SELECT 1 FROM fiaon_applications g
                        WHERE g.person_id = p.id AND g.gdpr_deleted_at IS NOT NULL)`);

  if (f.archiv) {
    wo.push(`EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.archived_at IS NOT NULL)`);
  } else {
    wo.push(`(EXISTS (SELECT 1 FROM fiaon_applications a
                       WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL)
              OR NOT EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = p.id))`);
  }

  if (f.q?.trim()) {
    const roh = f.q.trim();
    // Rufnummern werden mit und ohne Leerzeichen gesucht: Am Telefon liest
    // jemand „0176 229 106 92" vor, in der Datenbank steht es zusammen.
    const ziffern = roh.replace(/\D/g, "");
    const t = par(`%${roh}%`);
    const z = ziffern.length >= 4 ? par(`%${ziffern}%`) : null;
    wo.push(`(
      ${NAME_SQL} ILIKE ${t}
      OR COALESCE(p.primary_email, '') ILIKE ${t}
      OR COALESCE(p.primary_phone, '') ILIKE ${t}
      ${z ? `OR regexp_replace(COALESCE(p.primary_phone, ''), '\\D', '', 'g') ILIKE ${z}
             OR COALESCE(p.phone_key9, '') ILIKE ${z}` : ""}
      OR EXISTS (SELECT 1 FROM fiaon_applications s WHERE s.person_id = p.id
                   AND (s.ref ILIKE ${t} OR COALESCE(s.payment_reference, '') ILIKE ${t}
                        OR COALESCE(s.invoice_number, '') ILIKE ${t}))
      OR EXISTS (SELECT 1 FROM fiaon_person_aliases al WHERE al.person_id = p.id
                   AND (al.value_norm ILIKE ${t} OR COALESCE(al.value_raw, '') ILIKE ${t}))
    )`);
  }

  if (f.stufe?.length) {
    const stufen = f.stufe
      .map((s) => ({ A: 1, B: 2, C: 3, bezahlt: 0 } as Record<string, number>)[s])
      .filter((n) => n != null);
    if (stufen.length) wo.push(`p.priority_tier = ANY(${par(stufen)}::int[])`);
  }
  if (f.status?.length) wo.push(`p.tier_reason = ANY(${par(f.status)}::text[])`);
  if (f.agent) wo.push(`p.assigned_agent_id = ${par(f.agent)}`);
  if (f.ohneAgent) wo.push("p.assigned_agent_id IS NULL");
  if (f.ohneTelefon) wo.push("COALESCE(NULLIF(TRIM(p.primary_phone), ''), NULL) IS NULL");
  if (f.ruhend) wo.push("p.ruhe_seit IS NOT NULL");

  if (f.paket) {
    wo.push(`EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                       AND COALESCE(a.pack_name, '') ILIKE ${par(`%${f.paket}%`)})`);
  }
  if (f.quelle) {
    wo.push(`(COALESCE(p.first_source, '') ILIKE ${par(`%${f.quelle}%`)}
              OR COALESCE(p.first_campaign, '') ILIKE ${par(`%${f.quelle}%`)})`);
  }
  if (f.von) wo.push(`p.created_at >= ${par(f.von)}::date`);
  if (f.bis) wo.push(`p.created_at < (${par(f.bis)}::date + INTERVAL '1 day')`);

  // ── Spezialfilter ───────────────────────────────────────────────────────
  if (f.dubletten) {
    // Verdacht: Eine andere Person teilt Rufnummer oder Adresse.
    wo.push(`EXISTS (SELECT 1 FROM fiaon_persons d
                      WHERE d.id <> p.id AND d.merged_into_person_id IS NULL
                        AND ((NULLIF(p.phone_key9, '') IS NOT NULL AND d.phone_key9 = p.phone_key9)
                          OR (NULLIF(p.primary_email, '') IS NOT NULL
                              AND LOWER(d.primary_email) = LOWER(p.primary_email))))`);
  }
  if (f.zahlungUnbestaetigt) {
    // Gemeldet, aber seit über sieben Tagen nicht gebucht.
    wo.push(`EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                       AND a.payment_status = 'claimed_paid'
                       AND a.updated_at < NOW() - INTERVAL '7 days')`);
  }
  if (f.anonyme) {
    wo.push(`COALESCE(NULLIF(TRIM(p.primary_email), ''), NULLIF(TRIM(p.primary_phone), '')) IS NULL`);
  }
  if (f.kuendigungen) {
    wo.push(`EXISTS (SELECT 1 FROM cancellation_requests c
                      JOIN fiaon_applications a ON a.ref = c.ref
                      WHERE a.person_id = p.id AND c.status = 'pending')`);
  }
  if (f.kycOffen) {
    wo.push(`EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                       AND a.merged_into IS NULL AND a.documents_uploaded_at IS NOT NULL
                       AND COALESCE(a.kyc_status, 'pending') = 'pending')`);
  }
  return { wo, werte };
}

const SORT: Record<string, string> = {
  // Arbeit: Stufe zuerst, dann was am längsten liegt.
  arbeit: "p.priority_tier ASC NULLS LAST, p.updated_at ASC NULLS LAST, p.id ASC",
  neueste: "p.created_at DESC NULLS LAST, p.id DESC",
  name: `${NAME_SQL} ASC`,
  umsatz: `(SELECT COALESCE(SUM(a.amount_due), 0) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.payment_status = 'paid') DESC NULLS LAST`,
};

export interface ZeilenErgebnis {
  zeilen: any[];
  gesamt: number;
}

export async function kundenListe(f: Filter, lauf: Lauf = sqlPool): Promise<ZeilenErgebnis> {
  const { wo, werte } = bedingungen(f);
  const limit = Math.min(200, Math.max(10, Number(f.limit) || 50));
  const offset = Math.max(0, Number(f.offset) || 0);
  const sort = SORT[f.sortierung ?? "arbeit"] ?? SORT.arbeit;

  const [z] = (await lauf.unsafe(
    `SELECT COUNT(*)::int AS n FROM fiaon_persons p WHERE ${wo.join(" AND ")}`, werte as any[],
  )) as any[];

  const zeilen = (await lauf.unsafe(`
    SELECT p.id AS person_id, ${NAME_SQL} AS name,
           p.priority_tier, p.tier_reason, p.primary_phone, ${MAIL_SQL} AS email,
           p.created_at, p.updated_at, p.ist_test_am, p.ruhe_seit,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent,
           p.assigned_agent_id,
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref,
           (SELECT a.payment_reference FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT SPLIT_PART(a.pack_name, E'\\n', 1) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.pack_name IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS paket,
           (SELECT COALESCE(SUM(a.amount_due), 0) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.payment_status = 'paid') AS umsatz,
           (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
             JOIN fiaon_applications a ON a.ref = cl.ref
             WHERE a.person_id = p.id AND cl.type <> 'system') AS letzter_kontakt
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE ${wo.join(" AND ")}
    ORDER BY ${sort}
    LIMIT ${limit} OFFSET ${offset}
  `, werte as any[])) as any[];

  return { zeilen, gesamt: Number(z?.n ?? 0) };
}

/**
 * ALLE Treffer-Kennungen — für „alle auswählen" über Seitengrenzen hinweg.
 *
 * Getrennt von der Liste, weil eine Auswahl über 4.000 Zeilen keine Namen und
 * keine Unterabfragen braucht. Die Obergrenze schützt davor, dass jemand
 * versehentlich den ganzen Bestand markiert und dann auf „Löschen" klickt.
 */
export async function alleTrefferIds(f: Filter, lauf: Lauf = sqlPool): Promise<number[]> {
  const { wo, werte } = bedingungen(f);
  const rows = (await lauf.unsafe(
    `SELECT p.id FROM fiaon_persons p WHERE ${wo.join(" AND ")} LIMIT 5000`, werte as any[],
  )) as any[];
  return rows.map((r) => Number(r.id));
}

/** Die Zahlen für die Filterleiste — eine Abfrage, nicht zwölf. */
export async function filterZahlen(lauf: Lauf = sqlPool): Promise<Record<string, number>> {
  // ── DIESELBE BASIS WIE DIE LISTE ────────────────────────────────────────
  // Die erste Fassung zählte hier OHNE die Archiv-Regel. Ergebnis: Der Knopf
  // versprach „Stufe B 1067", die Liste lieferte 1065 — zwei Personen, deren
  // einzige Bestellung archiviert ist. Gefunden von der Zählprobe in
  // scripts/pruef-zentralen.ts.
  //
  // Eine Zahl auf einem Knopf ist ein Versprechen. Wenn sie nicht hält, sucht
  // der Betreiber nach zwei Kunden, die es in dieser Ansicht nicht gibt.
  const basis = `${echtePersonSql("p")}
    AND NOT EXISTS (SELECT 1 FROM fiaon_applications g
                     WHERE g.person_id = p.id AND g.gdpr_deleted_at IS NOT NULL)
    AND (EXISTS (SELECT 1 FROM fiaon_applications a
                  WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL)
         OR NOT EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = p.id))`;
  const [z] = (await lauf.unsafe(`
    SELECT
      COUNT(*)::int AS alle,
      COUNT(*) FILTER (WHERE p.priority_tier = 1)::int AS stufe_a,
      COUNT(*) FILTER (WHERE p.priority_tier = 2)::int AS stufe_b,
      COUNT(*) FILTER (WHERE p.priority_tier = 3)::int AS stufe_c,
      COUNT(*) FILTER (WHERE p.priority_tier = 0)::int AS bezahlt,
      COUNT(*) FILTER (WHERE p.assigned_agent_id IS NULL)::int AS ohne_agent,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(p.primary_phone), '') IS NULL)::int AS ohne_telefon,
      COUNT(*) FILTER (WHERE p.ruhe_seit IS NOT NULL)::int AS ruhend,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(p.primary_email), ''),
                                      NULLIF(TRIM(p.primary_phone), '')) IS NULL)::int AS anonyme,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
          AND a.payment_status = 'claimed_paid' AND a.updated_at < NOW() - INTERVAL '7 days'))::int AS zahlung_unbestaetigt,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
          AND a.documents_uploaded_at IS NOT NULL AND COALESCE(a.kyc_status, 'pending') = 'pending'))::int AS kyc_offen,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM cancellation_requests c JOIN fiaon_applications a ON a.ref = c.ref
          WHERE a.person_id = p.id AND c.status = 'pending'))::int AS kuendigungen
    FROM fiaon_persons p WHERE ${basis}
  `, [])) as any[];
  const [t] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NOT NULL
  `) as any[];
  return { ...z, tests: Number(t.n) };
}
