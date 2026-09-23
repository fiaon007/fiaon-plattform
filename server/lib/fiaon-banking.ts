// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — was auf den Konten passiert ist (E-228, 23.09.2026)
//
// Justin: „Übertrage alle Kundeneingänge. Ich brauch die gesamten Transaktionen
// der Kunden, die Auszahlungen aller Mitarbeiter und sonst alles, was eine
// Banking-Seite braucht."
//
// ── DIE QUELLEN ────────────────────────────────────────────────────────────
// Ein Umsatz entsteht hier nie von selbst. Jede Zeile kommt aus genau einer
// Quelle, die es im Haus schon gibt:
//
//   bank:       fiaon_bank_txns — die echten Gutschriften, wie die Bank sie
//               geliefert hat (Wise-CSV bis 01.09., Airwallex-Abruf seit
//               02.09.). Sie ist die Wahrheit für alles, was hereinkam.
//   auszahlung: fiaon_payouts mit Status „ausgezahlt" — Provision und Gehalt.
//   buch:       fiaon_buch_bewegung — Einlagen, Korrekturen, von Hand
//               erfasste Kosten und die ausgeführten Zahlungsaufträge.
//
// Absichtlich NICHT die Umsatzformel des Chefbüros (umsatzBausteine): Sie
// zählt Erlös, also was gebucht ist. Ein Konto zeigt Geld, also was ankam —
// einschließlich der Zahlungen, die noch keiner Bestellung zugeordnet sind.
//
// ── ZWEI KONTEN ────────────────────────────────────────────────────────────
// Geschäftskonto: die IBAN aus shared/fiaon-bank.ts, seit 02.09.2026.
// Altkonto Wise: gesperrt seit 02.09.2026, bleibt als Verlauf sichtbar.
// Auszahlungen vor dem Wechsel liefen über Wise und stehen dort.
//
// ── DER SALDO ──────────────────────────────────────────────────────────────
// Das Buch kennt Eingänge vollständig, Abflüsse nur, soweit sie über das Haus
// laufen (Auszahlungen, Aufträge) oder erfasst werden. Deshalb beginnt der
// Saldo beim Anfangsbestand, den der Inhaber setzt (Tagesendstand), und der
// Abgleich mit der Bank — live über Airwallex, sonst von Hand — nennt die
// Differenz. Ein Saldo ohne Abgleich wird als solcher bezeichnet.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { BANK, BANK_ALT_GESPERRT } from "@shared/fiaon-bank";
import { anfangsbestand, bankabgleich, buchSchema, type Anfangsbestand, type Bankabgleich } from "./fiaon-buchhaltung";

export type KontoSchluessel = "geschaeft" | "wise";

export interface Konto {
  schluessel: KontoSchluessel;
  name: string;
  inhaber: string;
  iban: string;
  ibanDisplay: string;
  bic: string;
  institut: string;
  seit: string | null;
  gesperrtSeit: string | null;
}

/** Der Kontowechsel. Alles davor lief über Wise. */
export const KONTOWECHSEL = BANK.gueltigSeit;

export const KONTEN: readonly Konto[] = [
  {
    schluessel: "geschaeft", name: "Geschäftskonto", inhaber: BANK.empfaenger,
    iban: BANK.iban, ibanDisplay: BANK.ibanDisplay, bic: BANK.bic, institut: BANK.bank,
    seit: BANK.gueltigSeit, gesperrtSeit: null,
  },
  {
    schluessel: "wise", name: "Altkonto Wise", inhaber: BANK.empfaenger,
    iban: BANK_ALT_GESPERRT.iban, ibanDisplay: BANK_ALT_GESPERRT.ibanDisplay, bic: BANK_ALT_GESPERRT.bic,
    institut: "Wise (gesperrt)", seit: null, gesperrtSeit: BANK_ALT_GESPERRT.gesperrtAm,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// DER UMSATZSTROM
// ═══════════════════════════════════════════════════════════════════════════
const UMSATZ_CTE = `
  u AS (
    SELECT
      'bank:' || b.id                                                   AS uid,
      CASE WHEN b.txn_id LIKE 'AWX-%' THEN 'geschaeft' ELSE 'wise' END  AS konto,
      COALESCE(b.booked_at, b.created_at)                               AS zeit,
      (COALESCE(b.booked_at, b.created_at) AT TIME ZONE 'Europe/Berlin')::date AS tag,
      b.amount_cents::bigint                                            AS cents,
      CASE WHEN b.match_status = 'ignored' THEN 'sonstiges'
           WHEN b.match_status IN ('matched', 'manual') THEN 'kunde'
           ELSE 'offen' END                                             AS art,
      COALESCE(NULLIF(TRIM(b.payer_name), ''), 'Unbekannter Absender')  AS gegenpartei,
      NULLIF(TRIM(b.reference_raw), '')                                 AS zweck,
      COALESCE(b.matched_ref, b.extracted_ref)                          AS referenz,
      b.txn_id                                                          AS beleg,
      (COALESCE(b.note, '') LIKE 'Airwallex: Geld ist UNTERWEGS%')      AS schwebend,
      FALSE                                                             AS storniert,
      b.match_status::text                                              AS zuordnung,
      COALESCE(b.applied, FALSE)                                        AS verbucht,
      NULLIF(TRIM(b.note), '')                                          AS notiz,
      NULL::text                                                        AS erfasst_von,
      NULL::bigint                                                      AS auftrag_id,
      NULL::int                                                         AS auszahlung_id,
      NULL::int                                                         AS abrechnung_id,
      (SELECT NULLIF(TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')), '')
         FROM fiaon_applications a WHERE a.ref = b.matched_ref LIMIT 1) AS kunde
    FROM fiaon_bank_txns b
    UNION ALL
    SELECT
      'auszahlung:' || p.id,
      CASE WHEN (p.processed_at AT TIME ZONE 'Europe/Berlin')::date < DATE '${KONTOWECHSEL}' THEN 'wise' ELSE 'geschaeft' END,
      p.processed_at,
      (p.processed_at AT TIME ZONE 'Europe/Berlin')::date,
      -p.amount_cents::bigint,
      'auszahlung',
      COALESCE(NULLIF(TRIM(ag.name), ''), 'Mitarbeiter ' || p.agent_id),
      'Auszahlung ' || CASE WHEN EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = 'gehalt')
                            THEN 'Gehalt' ELSE 'Provision' END
        || COALESCE(' · Abrechnung ' || st.statement_no, ''),
      st.statement_no,
      'FIAON-AUS-' || p.id,
      FALSE, FALSE, NULL, TRUE, NULL, NULL,
      (SELECT o.id FROM fiaon_buch_auftrag o WHERE o.payout_id = p.id AND o.status = 'ausgefuehrt' ORDER BY o.id DESC LIMIT 1),
      p.id, st.id, NULL
    FROM fiaon_payouts p
    LEFT JOIN fiaon_agents ag ON ag.id = p.agent_id
    LEFT JOIN LATERAL (
      SELECT s.id, s.statement_no FROM fiaon_commission_statements s WHERE s.payout_id = p.id ORDER BY s.id DESC LIMIT 1
    ) st ON TRUE
    WHERE p.status = 'ausgezahlt' AND p.processed_at IS NOT NULL
    UNION ALL
    SELECT
      'buch:' || m.id,
      'geschaeft',
      ((m.wert_am::timestamp + TIME '12:00') AT TIME ZONE 'Europe/Berlin'),
      m.wert_am,
      (m.richtung * m.betrag_cents)::bigint,
      CASE WHEN m.auftrag_id IS NOT NULL THEN 'ueberweisung' ELSE m.art END,
      COALESCE(NULLIF(TRIM(m.gegenpartei), ''),
               CASE m.art WHEN 'einlage' THEN 'Einlage' WHEN 'korrektur' THEN 'Korrekturbuchung' ELSE 'Kassenbuch' END),
      m.zweck,
      m.beleg,
      COALESCE(m.beleg, 'FIAON-BU-' || m.id),
      FALSE,
      (m.storniert_am IS NOT NULL),
      NULL, TRUE,
      m.storno_grund,
      m.erfasst_von,
      m.auftrag_id, NULL, NULL, NULL
    FROM fiaon_buch_bewegung m
  )`;

/** Zählt diese Zeile zum Saldo des Geschäftskontos? ($1 = Tag des Anfangsbestands) */
const IM_BUCH = `(u.konto = 'geschaeft' AND $1::date IS NOT NULL AND u.tag > $1::date AND NOT u.schwebend AND NOT u.storniert)`;

export type UmsatzArt = "kunde" | "offen" | "sonstiges" | "auszahlung" | "ueberweisung" | "einlage" | "eingang" | "ausgabe" | "korrektur";

export interface Umsatz {
  uid: string;
  konto: KontoSchluessel;
  zeit: string;
  tag: string;
  cents: number;
  art: UmsatzArt;
  gegenpartei: string;
  zweck: string | null;
  referenz: string | null;
  beleg: string | null;
  schwebend: boolean;
  storniert: boolean;
  zuordnung: string | null;
  verbucht: boolean;
  notiz: string | null;
  erfasstVon: string | null;
  auftragId: number | null;
  auszahlungId: number | null;
  abrechnungId: number | null;
  kunde: string | null;
  /** Saldo nach dieser Buchung — nur für Zeilen, die zum Buch gehören. */
  saldoNach: number | null;
}

export interface UmsatzFilter {
  konto?: KontoSchluessel | "alle";
  richtung?: "ein" | "aus" | "alle";
  arten?: UmsatzArt[];
  von?: string | null;
  bis?: string | null;
  suche?: string | null;
  limit?: number;
  offset?: number;
}

function zuUmsatz(r: any): Umsatz {
  return {
    uid: String(r.uid),
    konto: r.konto === "wise" ? "wise" : "geschaeft",
    zeit: new Date(r.zeit).toISOString(),
    tag: r.tag instanceof Date ? r.tag.toISOString().slice(0, 10) : String(r.tag).slice(0, 10),
    cents: Number(r.cents),
    art: String(r.art) as UmsatzArt,
    gegenpartei: String(r.gegenpartei || ""),
    zweck: r.zweck ?? null,
    referenz: r.referenz ?? null,
    beleg: r.beleg ?? null,
    schwebend: !!r.schwebend,
    storniert: !!r.storniert,
    zuordnung: r.zuordnung ?? null,
    verbucht: !!r.verbucht,
    notiz: r.notiz ?? null,
    erfasstVon: r.erfasst_von ?? null,
    auftragId: r.auftrag_id != null ? Number(r.auftrag_id) : null,
    auszahlungId: r.auszahlung_id != null ? Number(r.auszahlung_id) : null,
    abrechnungId: r.abrechnung_id != null ? Number(r.abrechnung_id) : null,
    kunde: r.kunde ?? null,
    saldoNach: r.saldo_nach != null ? Number(r.saldo_nach) : null,
  };
}

const ARTEN: readonly UmsatzArt[] = ["kunde", "offen", "sonstiges", "auszahlung", "ueberweisung", "einlage", "eingang", "ausgabe", "korrektur"];
const istTag = (v: unknown): v is string => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/** Baut die WHERE-Bedingungen. $1 und $2 sind für Anfangsbestand reserviert. */
function bedingungen(f: UmsatzFilter): { sql: string; werte: unknown[] } {
  const teile: string[] = [];
  const werte: unknown[] = [];
  const platz = (v: unknown) => { werte.push(v); return `$${werte.length + 2}`; };
  if (f.konto && f.konto !== "alle") teile.push(`s.konto = ${platz(f.konto)}`);
  if (f.richtung === "ein") teile.push("s.cents > 0");
  if (f.richtung === "aus") teile.push("s.cents < 0");
  const arten = (f.arten || []).filter((a) => ARTEN.includes(a));
  if (arten.length) teile.push(`s.art = ANY(${platz(arten)}::text[])`);
  if (istTag(f.von)) teile.push(`s.tag >= ${platz(f.von)}::date`);
  if (istTag(f.bis)) teile.push(`s.tag <= ${platz(f.bis)}::date`);
  const q = String(f.suche || "").trim();
  if (q) {
    const betrag = /^[+-]?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^[+-]?\d+([.,]\d{1,2})?$/.test(q)
      ? Math.round(Number(q.includes(",") ? q.replace(/\./g, "").replace(",", ".") : q) * 100)
      : null;
    const muster = platz(`%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
    const textTeil = `(s.gegenpartei ILIKE ${muster} OR COALESCE(s.zweck, '') ILIKE ${muster} OR COALESCE(s.referenz, '') ILIKE ${muster}
                       OR COALESCE(s.beleg, '') ILIKE ${muster} OR COALESCE(s.kunde, '') ILIKE ${muster})`;
    teile.push(betrag != null && Number.isFinite(betrag) && betrag !== 0
      ? `(${textTeil} OR ABS(s.cents) = ${platz(Math.abs(betrag))})`
      : textTeil);
  }
  return { sql: teile.length ? `WHERE ${teile.join(" AND ")}` : "", werte };
}

function stromMitSaldo(): string {
  return `
    WITH ${UMSATZ_CTE},
    s AS (
      SELECT u.*,
             ${IM_BUCH} AS im_buch,
             $2::bigint + SUM(CASE WHEN ${IM_BUCH} THEN u.cents ELSE 0 END)
               OVER (ORDER BY u.zeit, u.uid ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo_lauf
        FROM u
    )`;
}

export async function umsaetze(f: UmsatzFilter): Promise<{ zeilen: Umsatz[]; gesamt: number; einCents: number; ausCents: number }> {
  await buchSchema();
  const a = await anfangsbestand();
  const { sql: wo, werte } = bedingungen(f);
  const limit = Math.min(500, Math.max(1, Number(f.limit) || 60));
  const offset = Math.max(0, Number(f.offset) || 0);
  const basis = [a?.am ?? null, a?.cents ?? 0, ...werte];
  const zeilen = (await sqlPool.unsafe(`
    ${stromMitSaldo()}
    SELECT s.*, CASE WHEN s.im_buch THEN s.saldo_lauf END AS saldo_nach
      FROM s ${wo}
     ORDER BY s.zeit DESC, s.uid DESC
     LIMIT ${limit} OFFSET ${offset}`, basis as any[])) as any[];
  const [summe] = (await sqlPool.unsafe(`
    ${stromMitSaldo()}
    SELECT COUNT(*)::int AS n,
           COALESCE(SUM(s.cents) FILTER (WHERE s.cents > 0 AND NOT s.storniert), 0)::bigint AS ein,
           COALESCE(SUM(-s.cents) FILTER (WHERE s.cents < 0 AND NOT s.storniert), 0)::bigint AS aus
      FROM s ${wo}`, basis as any[])) as any[];
  return {
    zeilen: zeilen.map(zuUmsatz),
    gesamt: Number(summe?.n || 0),
    einCents: Number(summe?.ein || 0),
    ausCents: Number(summe?.aus || 0),
  };
}

export async function umsatz(uid: string): Promise<Umsatz | null> {
  await buchSchema();
  const a = await anfangsbestand();
  const [r] = (await sqlPool.unsafe(`
    ${stromMitSaldo()}
    SELECT s.*, CASE WHEN s.im_buch THEN s.saldo_lauf END AS saldo_nach FROM s WHERE s.uid = $3`,
    [a?.am ?? null, a?.cents ?? 0, uid])) as any[];
  return r ? zuUmsatz(r) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KASSE
// ═══════════════════════════════════════════════════════════════════════════
export interface LiveStand {
  ok: boolean;
  cents?: number;
  verfuegbarCents?: number;
  schwebendCents?: number;
  stand?: string;
  grund?: string;
}

let liveCache: { bis: number; wert: LiveStand } | null = null;

/**
 * Der Kontostand direkt von Airwallex. Der API-Schlüssel ist auf die Adressen
 * von Render beschränkt — außerhalb davon und ohne die Berechtigung
 * „Balances lesen" kommt ein ehrliches „nicht abrufbar" zurück, nie eine Zahl.
 */
export async function liveKontostand(): Promise<LiveStand> {
  if (liveCache && liveCache.bis > Date.now()) return liveCache.wert;
  let wert: LiveStand;
  try {
    const { airwallexGet, airwallexKonfiguriert } = await import("../routes/fiaon-airwallex");
    if (!airwallexKonfiguriert()) {
      wert = { ok: false, grund: "Airwallex ist nicht verbunden." };
    } else {
      const j = await airwallexGet("/api/v1/balances/current");
      const liste: any[] = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      const eur = liste.find((x) => String(x?.currency || "").toUpperCase() === "EUR");
      if (!eur) {
        wert = { ok: false, grund: "Airwallex liefert kein EUR-Guthaben." };
      } else {
        const zahl = (v: unknown) => (v == null || v === "" ? null : Math.round(Number(v) * 100));
        const gesamt = zahl(eur.total_amount) ?? zahl(eur.available_amount);
        wert = gesamt == null || !Number.isFinite(gesamt)
          ? { ok: false, grund: "Das Airwallex-Guthaben war nicht lesbar." }
          : {
            ok: true, cents: gesamt,
            verfuegbarCents: zahl(eur.available_amount) ?? gesamt,
            schwebendCents: zahl(eur.pending_amount) ?? 0,
            stand: new Date().toISOString(),
          };
      }
    }
  } catch (e) {
    const t = String((e as Error)?.message || e);
    wert = {
      ok: false,
      grund: /HTTP 40[13]/.test(t)
        ? "Airwallex gibt den Kontostand nicht frei — dem API-Schlüssel fehlt die Berechtigung „Balances lesen“."
        : `Airwallex nicht erreichbar (${t.slice(0, 80)}).`,
    };
  }
  liveCache = { bis: Date.now() + (wert.ok ? 2 * 60_000 : 10 * 60_000), wert };
  return wert;
}

export interface Kasse {
  anfang: Anfangsbestand | null;
  /** Saldo laut Buch (nur Geschäftskonto), null ohne Anfangsbestand. */
  buchCents: number | null;
  zuflussCents: number;
  abflussCents: number;
  unterwegsCents: number;
  abgleich: (Bankabgleich & { buchAmTagCents: number | null; differenzCents: number | null }) | null;
  live: LiveStand;
  liveDifferenzCents: number | null;
}

export async function kasse(): Promise<Kasse> {
  await buchSchema();
  const [a, g] = await Promise.all([anfangsbestand(), bankabgleich()]);
  const [r] = (await sqlPool.unsafe(`
    WITH ${UMSATZ_CTE}
    SELECT
      COALESCE(SUM(u.cents) FILTER (WHERE ${IM_BUCH}), 0)::bigint AS seit,
      COALESCE(SUM(u.cents) FILTER (WHERE ${IM_BUCH} AND u.cents > 0), 0)::bigint AS zu,
      COALESCE(SUM(-u.cents) FILTER (WHERE ${IM_BUCH} AND u.cents < 0), 0)::bigint AS ab,
      COALESCE(SUM(u.cents) FILTER (WHERE u.konto = 'geschaeft' AND u.schwebend), 0)::bigint AS unterwegs,
      COALESCE(SUM(u.cents) FILTER (WHERE ${IM_BUCH} AND $2::date IS NOT NULL AND u.tag <= $2::date), 0)::bigint AS bis_abgleich
    FROM u`, [a?.am ?? null, g?.am ?? null])) as any[];
  const buchCents = a ? a.cents + Number(r?.seit || 0) : null;
  const buchAmTag = a && g && g.am >= a.am ? a.cents + Number(r?.bis_abgleich || 0) : null;
  const live = await liveKontostand();
  return {
    anfang: a,
    buchCents,
    zuflussCents: Number(r?.zu || 0),
    abflussCents: Number(r?.ab || 0),
    unterwegsCents: Number(r?.unterwegs || 0),
    abgleich: g ? { ...g, buchAmTagCents: buchAmTag, differenzCents: buchAmTag == null ? null : g.cents - buchAmTag } : null,
    live,
    liveDifferenzCents: live.ok && live.cents != null && buchCents != null ? live.cents - buchCents : null,
  };
}

/** Saldo laut Buch am Ende eines Tages — für Auszüge. null vor Buchbeginn. */
export async function buchSaldoAm(tag: string): Promise<number | null> {
  const a = await anfangsbestand();
  if (!a || tag < a.am) return null;
  const [r] = (await sqlPool.unsafe(`
    WITH ${UMSATZ_CTE}
    SELECT COALESCE(SUM(u.cents) FILTER (WHERE ${IM_BUCH} AND u.tag <= $2::date), 0)::bigint AS s FROM u`,
    [a.am, tag])) as any[];
  return a.cents + Number(r?.s || 0);
}

// ── Geldfluss je Monat und Konto ────────────────────────────────────────────
export interface MonatsFluss { monat: string; konto: KontoSchluessel; einCents: number; ausCents: number; anzahl: number }

export async function monatsfluss(): Promise<MonatsFluss[]> {
  await buchSchema();
  const rows = (await sqlPool.unsafe(`
    WITH ${UMSATZ_CTE}
    SELECT to_char(u.tag, 'YYYY-MM') AS monat, u.konto,
           COALESCE(SUM(u.cents) FILTER (WHERE u.cents > 0 AND NOT u.schwebend AND NOT u.storniert), 0)::bigint AS ein,
           COALESCE(SUM(-u.cents) FILTER (WHERE u.cents < 0 AND NOT u.storniert), 0)::bigint AS aus,
           COUNT(*)::int AS n
      FROM u GROUP BY 1, 2 ORDER BY 1, 2`)) as any[];
  return rows.map((r) => ({
    monat: String(r.monat), konto: r.konto === "wise" ? "wise" : "geschaeft",
    einCents: Number(r.ein), ausCents: Number(r.aus), anzahl: Number(r.n),
  }));
}

/** Was offen ist: Eingänge ohne Zuordnung, schwebendes Geld. */
export async function offenePosten(): Promise<{ offenAnzahl: number; offenCents: number; schwebendAnzahl: number; schwebendCents: number }> {
  await buchSchema();
  const [r] = (await sqlPool.unsafe(`
    WITH ${UMSATZ_CTE}
    SELECT COUNT(*) FILTER (WHERE u.art = 'offen' AND NOT u.schwebend)::int AS oa,
           COALESCE(SUM(u.cents) FILTER (WHERE u.art = 'offen' AND NOT u.schwebend), 0)::bigint AS oc,
           COUNT(*) FILTER (WHERE u.schwebend)::int AS sa,
           COALESCE(SUM(u.cents) FILTER (WHERE u.schwebend), 0)::bigint AS sc
      FROM u`)) as any[];
  return { offenAnzahl: Number(r?.oa || 0), offenCents: Number(r?.oc || 0), schwebendAnzahl: Number(r?.sa || 0), schwebendCents: Number(r?.sc || 0) };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGEN AN MITARBEITER
// ═══════════════════════════════════════════════════════════════════════════
export interface Auszahlung {
  id: number;
  agentId: number;
  name: string;
  cents: number;
  status: string;
  art: "Gehalt" | "Provision";
  ibanMaskiert: string | null;
  angefordertAm: string | null;
  ausgezahltAm: string | null;
  ablehnGrund: string | null;
  abrechnungId: number | null;
  abrechnungNr: string | null;
  hatAbrechnungPdf: boolean;
  auftragId: number | null;
  auftragNr: string | null;
  auftragStatus: string | null;
}

export async function auszahlungen(): Promise<Auszahlung[]> {
  await buchSchema();
  const rows = (await sqlPool`
    SELECT p.id, p.agent_id, p.amount_cents, p.status, p.iban_masked, p.requested_at, p.processed_at, p.reject_reason,
           COALESCE(NULLIF(TRIM(ag.name), ''), 'Mitarbeiter ' || p.agent_id) AS name,
           st.id AS abrechnung_id, st.statement_no, COALESCE(st.hat_pdf, FALSE) AS hat_pdf,
           EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = 'gehalt') AS ist_gehalt,
           o.id AS auftrag_id, o.nummer AS auftrag_nr, o.status AS auftrag_status
      FROM fiaon_payouts p
      LEFT JOIN fiaon_agents ag ON ag.id = p.agent_id
      LEFT JOIN LATERAL (
        SELECT s.id, s.statement_no, (s.pdf_base64 IS NOT NULL) AS hat_pdf
          FROM fiaon_commission_statements s WHERE s.payout_id = p.id ORDER BY s.id DESC LIMIT 1
      ) st ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, nummer, status FROM fiaon_buch_auftrag
         WHERE payout_id = p.id AND status NOT IN ('abgelehnt', 'zurueckgezogen')
         ORDER BY id DESC LIMIT 1
      ) o ON TRUE
     ORDER BY COALESCE(p.processed_at, p.requested_at) DESC NULLS LAST, p.id DESC`) as any[];
  return rows.map((r) => ({
    id: Number(r.id),
    agentId: Number(r.agent_id),
    name: String(r.name),
    cents: Number(r.amount_cents),
    status: String(r.status),
    art: r.ist_gehalt ? "Gehalt" : "Provision",
    ibanMaskiert: r.iban_masked ?? null,
    angefordertAm: r.requested_at ? new Date(r.requested_at).toISOString() : null,
    ausgezahltAm: r.status === "ausgezahlt" && r.processed_at ? new Date(r.processed_at).toISOString() : null,
    ablehnGrund: r.reject_reason ?? null,
    abrechnungId: r.abrechnung_id != null ? Number(r.abrechnung_id) : null,
    abrechnungNr: r.statement_no ?? null,
    hatAbrechnungPdf: !!r.hat_pdf,
    auftragId: r.auftrag_id != null ? Number(r.auftrag_id) : null,
    auftragNr: r.auftrag_nr ?? null,
    auftragStatus: r.auftrag_status ?? null,
  }));
}

export async function abrechnungPdf(id: number): Promise<{ name: string; daten: Buffer } | null> {
  const [r] = (await sqlPool`SELECT statement_no, pdf_base64 FROM fiaon_commission_statements WHERE id = ${id}`) as any[];
  if (!r?.pdf_base64) return null;
  return { name: `${r.statement_no || `Abrechnung-${id}`}.pdf`, daten: Buffer.from(String(r.pdf_base64), "base64") };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT — für die Steuerberatung
// ═══════════════════════════════════════════════════════════════════════════
const ART_TEXT: Record<UmsatzArt, string> = {
  kunde: "Kundenzahlung", offen: "Eingang ohne Zuordnung", sonstiges: "Sonstiger Eingang",
  auszahlung: "Auszahlung Mitarbeiter", ueberweisung: "Überweisung", einlage: "Einlage",
  eingang: "Eingang (erfasst)", ausgabe: "Ausgabe (erfasst)", korrektur: "Korrekturbuchung",
};

export function artText(a: UmsatzArt): string { return ART_TEXT[a] ?? a; }

export async function umsaetzeCsv(f: UmsatzFilter): Promise<string> {
  const { zeilen } = await umsaetze({ ...f, limit: 500, offset: 0 });
  // Alles holen, nicht nur die erste Seite: in 500er-Schritten nachladen.
  const alle = [...zeilen];
  for (let off = 500; zeilen.length === 500 && off < 20000; off += 500) {
    const weiter = await umsaetze({ ...f, limit: 500, offset: off });
    alle.push(...weiter.zeilen);
    if (weiter.zeilen.length < 500) break;
  }
  const zahl = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const feld = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kopf = ["Buchungstag", "Konto", "Art", "Gegenpartei", "Kunde", "Verwendungszweck", "Referenz", "Beleg", "Betrag EUR", "Saldo laut Buch EUR", "Status"];
  const zeilenText = alle.map((u) => [
    u.tag.split("-").reverse().join("."),
    u.konto === "wise" ? "Altkonto Wise" : "Geschäftskonto",
    artText(u.art),
    u.gegenpartei,
    u.kunde ?? "",
    u.zweck ?? "",
    u.referenz ?? "",
    u.beleg ?? "",
    zahl(u.cents),
    zahl(u.saldoNach),
    u.storniert ? "storniert" : u.schwebend ? "unterwegs" : u.art === "offen" ? "nicht zugeordnet" : "gebucht",
  ].map(feld).join(";"));
  return `﻿${[kopf.join(";"), ...zeilenText].join("\r\n")}\r\n`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE — einmal nach dem Start, nur ins Log, ohne Beträge
// ═══════════════════════════════════════════════════════════════════════════
let geprobt = false;
export function airwallexProbe(): void {
  if (geprobt || process.env.NODE_ENV !== "production") return;
  geprobt = true;
  setTimeout(() => {
    void (async () => {
      const stand = await liveKontostand();
      console.log(`[BANKING] Airwallex-Kontostand: ${stand.ok ? "abrufbar (EUR)" : `nicht abrufbar — ${stand.grund}`}`);
      try {
        const { airwallexGet } = await import("../routes/fiaon-airwallex");
        const j = await airwallexGet("/api/v1/financial_transactions?page_size=1");
        const item = Array.isArray(j?.items) ? j.items[0] : null;
        console.log(`[BANKING] Airwallex-Buchungen: abrufbar${item ? ` · Felder: ${Object.keys(item).join(", ")} · Art ${String(item.transaction_type ?? item.type ?? "?")}` : " · leer"}`);
      } catch (e) {
        console.log(`[BANKING] Airwallex-Buchungen: nicht abrufbar — ${String((e as Error)?.message || e).slice(0, 140)}`);
      }
    })();
  }, 20_000);
}
