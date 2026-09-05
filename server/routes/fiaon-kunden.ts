// ═══════════════════════════════════════════════════════════════════
// FIAON — DIE ZENTRALE KUNDENAKTE (Prompt 1/2, 20.07.2026)
// „Eine Seite. Alles." — eine Akte pro Person, eine Liste für alle.
//
// STRIKT ADDITIV: Diese Datei AGGREGIERT und EDITIERT Stammdaten mit Audit.
// Sie ersetzt KEINE Geld-Hooks: bezahlt/stornieren/reaktivieren/Merge/Events
// laufen weiter über die bestehenden Endpoints (fiaon-antrag.ts,
// fiaon-admin-hub.ts, fiaon-team.ts, fiaon-leads.ts) — die Akte ruft sie nur.
//
// Personen-Modell (SYSTEM_DIAGNOSE.md D5 + P1-Prävention):
//   Eine „Person" = Bestell-Familie aus fiaon_applications (gleiche E-Mail
//   ODER gleiche Telefon-Ziffern ≥ 7, inkl. merged_into/superseded_by-Ketten)
//   + alle fiaon_leads derselben Kontaktdaten bzw. converted_order_id.
//   Akte-ID: Antrags-ref (FIAON-…) oder "lead-<id>" für Lead-only-Personen.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { isAddonOrderRow } from "../fiaon-login-logic";
import { nummerAusZeile } from "../lib/fiaon-telefon";
import { fristAbgelaufenSql, nichtArchiviertSql } from "../lib/fiaon-bestand-filter";
import { statusFuerPerson, statusFuerBestellungen } from "../lib/fiaon-kundenstatus";
import { produktstand, produktstandFuerBestellungen } from "../lib/fiaon-produktstand";
import { PAKETE, paketPreisEuro } from "../../shared/fiaon-pakete";
import { katalogpreisCents } from "../lib/fiaon-massgebliche-bestellung";

const router = Router();

// ── Hilfen ───────────────────────────────────────────────────────────────────

/** Telefon-Ziffern eines Antrags (Vorwahl+Nummer, sonst contact_phone). */
const APP_PHONE_SQL = `
  COALESCE(
    NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
  )`;

function digits(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}
/** Suffix-Vergleich (letzte 9 Ziffern) — robust gegen +49/0-Präfixe. */
function phonesMatch(a: string, b: string): boolean {
  if (a.length < 7 || b.length < 7) return false;
  return a.slice(-9) === b.slice(-9);
}
function normEmail(v: string | null | undefined): string {
  return String(v || "").trim().toLowerCase();
}
function appName(a: any): string {
  return (
    [a.first_name, a.last_name].filter(Boolean).join(" ") ||
    a.contact_name || a.company_name || a.email || a.ref || "—"
  );
}
function appEmail(a: any): string | null {
  return a.email || a.contact_email || a.billing_email || null;
}
function appPhoneDigits(a: any): string {
  const d = digits(`${a.phone_country_code || ""}${a.phone || ""}`);
  return d || digits(a.contact_phone);
}
function fullNameKey(a: any): string {
  const n = [a.first_name, a.last_name].filter(Boolean).join(" ").trim().toLowerCase();
  return n;
}
function leadNameKey(l: any): string {
  return [l.vorname, l.nachname].filter(Boolean).join(" ").trim().toLowerCase();
}

/** Lifecycle-Status einer Person (Antrag gewinnt über Lead). */
function lifecycleOf(app: any | null, lead: any | null): string {
  if (app) {
    switch (app.payment_status) {
      case "paid": return "bezahlt";
      case "claimed_paid": return "angekuendigt";
      case "pending_payment": return "offen";
      case "expired": return "abgelaufen";
      case "cancelled": return "storniert";
      case "superseded": return "ersetzt";
      // Vorher „hat Referenz → offen": Die Referenz gibt es jetzt immer.
      default: return app.payment_status === "pending" ? "antrag" : "offen";
    }
  }
  return lead ? "lead" : "unbekannt";
}

// Audit-Eintrag (bestehendes Muster aus updateCustomerContact / fiaon-antrag.ts)
async function auditApp(ref: string, note: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${ref}, NULL, 'Admin', 'edit', ${note})
  `.catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// B — DIE EINE LISTE: GET /admin/kunden
// Serverseitig paginiert (512-MB-tauglich), Leads + Kunden vereint,
// kombinierbare Filter. Konvertierte/gemergte Sätze erscheinen NIE doppelt.
// ═══════════════════════════════════════════════════════════════════
router.get("/admin/kunden", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();          // lead|offen|angekuendigt|bezahlt|abgelaufen|storniert|direktzahler
    const agentId = req.query.agent !== undefined && String(req.query.agent) !== "" ? Number(req.query.agent) : null;
    const ohneAgent = String(req.query.ohne_agent || "") === "1";
    const ohneTelefon = String(req.query.ohne_telefon || "") === "1";
    const dubletten = String(req.query.dubletten || "") === "1";
    const ueberfaellig = String(req.query.ueberfaellig || "") === "1"; // Zahlung angekündigt > 7 Tage unbestätigt
    const quelle = String(req.query.quelle || "").trim();
    const paket = String(req.query.paket || "").trim();
    const von = String(req.query.von || "").trim();
    const bis = String(req.query.bis || "").trim();
    const anonyme = String(req.query.anonyme || "") === "1";        // Funnel-Abbrecher ohne Kontaktdaten einblenden
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };

    // ── Anträge (sichtbar, keine Dublette, keine ersetzten Doppel-Bestellungen) ──
    // `archiv=1` zeigt ausschließlich das Archiv — sonst bleibt es draußen.
    // Ein archivierter Antrag ist nicht gelöscht: Er ist in der Akte und über
    // diesen Schalter erreichbar, aber nicht mehr in der Arbeitsliste.
    const nurArchiv = req.query.archiv === "1" || req.query.archiv === "true";
    const appWhere: string[] = [
      `a.merged_into IS NULL`,
      `a.payment_status IS DISTINCT FROM 'superseded'`,
      nurArchiv ? `a.archived_at IS NOT NULL` : nichtArchiviertSql("a"),
    ];
    if (!anonyme) {
      // Bis zum 08.08.2026 stand hier auch `OR a.payment_reference IS NOT NULL` als
      // Beweis „das ist eine echte Bestellung". Seit jede Bestellung bedingungslos
      // einen Verwendungszweck bekommt, wäre diese Bedingung immer wahr — und die
      // Kundenliste hätte 3 522 Funnel-Abbrecher ohne jeden Kontaktweg gezeigt.
      // Der Beweis ist jetzt: eine angeforderte Rechnung (Zahlungsstand).
      appWhere.push(`(COALESCE(a.email,'') <> '' OR COALESCE(a.contact_email,'') <> '' OR COALESCE(a.phone,'') <> '' OR COALESCE(a.contact_phone,'') <> '' OR a.payment_status <> 'pending')`);
    }
    if (q) {
      const like = p(`%${q}%`);
      const qd = digits(q);
      const digitCond = qd.length >= 5
        ? ` OR ${APP_PHONE_SQL} LIKE ${p(`%${qd}%`)}`
        : "";
      appWhere.push(`(
        a.ref ILIKE ${like} OR a.payment_reference ILIKE ${like} OR a.invoice_number ILIKE ${like}
        OR a.first_name ILIKE ${like} OR a.last_name ILIKE ${like}
        OR (COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) ILIKE ${like}
        OR a.company_name ILIKE ${like} OR a.contact_name ILIKE ${like}
        OR a.email ILIKE ${like} OR a.contact_email ILIKE ${like}
        ${digitCond}
      )`);
    }
    if (agentId != null && Number.isFinite(agentId)) appWhere.push(`a.assigned_agent_id = ${p(agentId)}`);
    if (ohneAgent) appWhere.push(`a.assigned_agent_id IS NULL`);
    if (ohneTelefon) appWhere.push(`${APP_PHONE_SQL} IS NULL`);
    if (paket) appWhere.push(`(a.pack_key = ${p(paket)} OR a.pack_name ILIKE ${p(`%${paket}%`)})`);
    if (von) appWhere.push(`a.created_at >= ${p(von)}::timestamptz`);
    if (bis) appWhere.push(`a.created_at < ${p(bis)}::timestamptz + INTERVAL '1 day'`);
    if (ueberfaellig) appWhere.push(`a.payment_status = 'claimed_paid' AND a.claimed_paid_at < NOW() - INTERVAL '7 days'`);
    if (quelle) appWhere.push(`COALESCE(a.utm::text,'') ILIKE ${p(`%${quelle}%`)}`);
    if (dubletten) {
      appWhere.push(`(
        EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.merged_into IS NULL AND b.ref <> a.ref
                AND COALESCE(NULLIF(LOWER(TRIM(b.email)),''), NULL) IS NOT NULL
                AND LOWER(TRIM(b.email)) = LOWER(TRIM(a.email)))
        OR EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.merged_into IS NULL AND b.ref <> a.ref
                AND LENGTH(COALESCE(regexp_replace(COALESCE(b.phone_country_code,'')||COALESCE(b.phone,''),'\\D','','g'),'')) >= 7
                AND RIGHT(regexp_replace(COALESCE(b.phone_country_code,'')||COALESCE(b.phone,''),'\\D','','g'), 9)
                  = RIGHT(COALESCE(${APP_PHONE_SQL},''), 9)
                AND LENGTH(COALESCE(${APP_PHONE_SQL},'')) >= 7)
      )`);
    }
    // Lifecycle-Filter auf Anträge
    const statusMap: Record<string, string> = {
      offen: `a.payment_status = 'pending_payment'`,
      angekuendigt: `a.payment_status = 'claimed_paid'`,
      bezahlt: `a.payment_status = 'paid'`,
      // Etikett, kein Zustand (siehe lib/fiaon-bestand-filter.ts).
      abgelaufen: fristAbgelaufenSql("a"),
      storniert: `a.payment_status = 'cancelled'`,
      direktzahler: `a.payment_status = 'paid' AND a.commission_basis = 'direktzahler'`,
      // „Antrag" = angefangen, aber noch keine Rechnung angefordert. Das war
      // vorher „ohne Verwendungszweck"; seit 08.08.2026 hat den jede Bestellung,
      // also entscheidet der Zahlungsstand: 'pending' setzt die Anlage,
      // 'pending_payment' setzt erst /payment-order.
      antrag: `a.payment_status = 'pending'`,
    };
    if (status && status !== "lead" && statusMap[status]) appWhere.push(statusMap[status]);

    // ── Lead-only (nicht konvertiert, keine Antrags-Schwester per E-Mail/Telefon) ──
    const leadParams: any[] = [];
    const lp = (v: any) => { leadParams.push(v); return `$${leadParams.length}`; };
    const leadWhere: string[] = [
      `l.converted_order_id IS NULL`,
      `l.status <> 'konvertiert'`,
      `NOT EXISTS (
        SELECT 1 FROM fiaon_applications a WHERE a.merged_into IS NULL AND (
          (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
          OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
              AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
                = RIGHT(COALESCE(${APP_PHONE_SQL},''), 9))
        )
      )`,
    ];
    if (q) {
      const like = lp(`%${q}%`);
      const qd = digits(q);
      const digitCond = qd.length >= 5 ? ` OR regexp_replace(COALESCE(l.telefon,''),'\\D','','g') LIKE ${lp(`%${qd}%`)}` : "";
      leadWhere.push(`(
        l.vorname ILIKE ${like} OR l.nachname ILIKE ${like}
        OR (COALESCE(l.vorname,'') || ' ' || COALESCE(l.nachname,'')) ILIKE ${like}
        OR l.email ILIKE ${like}
        ${digitCond}
      )`);
    }
    if (agentId != null && Number.isFinite(agentId)) leadWhere.push(`l.assigned_agent_id = ${lp(agentId)}`);
    if (ohneAgent) leadWhere.push(`l.assigned_agent_id IS NULL`);
    if (ohneTelefon) leadWhere.push(`COALESCE(l.telefon,'') = ''`);
    if (quelle) leadWhere.push(`(l.quelle ILIKE ${lp(`%${quelle}%`)} OR l.kampagne ILIKE ${lp(`%${quelle}%`)})`);
    if (von) leadWhere.push(`l.erstellt_am >= ${lp(von)}::timestamptz`);
    if (bis) leadWhere.push(`l.erstellt_am < ${lp(bis)}::timestamptz + INTERVAL '1 day'`);
    // Leads werden bei Antrags-Filtern (Paket/überfällig/Dubletten-App-Kriterium) ausgeblendet
    const leadsApplicable = !paket && !ueberfaellig && !dubletten && (!status || status === "lead");
    const appsApplicable = !status || status !== "lead";

    // Anträge-Seite
    const appSql = `
      SELECT 'app' AS kind, a.ref AS id, a.ref, a.payment_reference, a.payment_status, a.commission_basis,
             a.amount_due, a.pack_name, a.created_at, a.updated_at, a.claimed_paid_at, a.payment_due_date,
             a.first_name, a.last_name, a.contact_name, a.company_name,
             a.email, a.contact_email, a.phone, a.phone_country_code, a.contact_phone,
             a.assigned_agent_id, ag.name AS agent_name, a.dismissed_at,
             NULL::varchar AS quelle, NULL::varchar AS kampagne, NULL::int AS lead_id
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      WHERE ${appWhere.join(" AND ")}`;
    const leadSql = `
      SELECT 'lead' AS kind, 'lead-' || l.id AS id, NULL AS ref, NULL AS payment_reference,
             NULL AS payment_status, NULL AS commission_basis,
             NULL::numeric AS amount_due, NULL AS pack_name, l.erstellt_am AS created_at, l.updated_at,
             NULL::timestamptz AS claimed_paid_at, NULL::timestamptz AS payment_due_date,
             l.vorname AS first_name, l.nachname AS last_name, NULL AS contact_name, NULL AS company_name,
             l.email, NULL AS contact_email, l.telefon AS phone, NULL AS phone_country_code, NULL AS contact_phone,
             l.assigned_agent_id, ag.name AS agent_name, l.dismissed_at,
             l.quelle, l.kampagne, l.id AS lead_id
      FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
      WHERE ${leadWhere.join(" AND ")}`;

    // Lead-Parameter hinter die App-Parameter hängen (Offsets anpassen)
    const shiftedLeadSql = leadSql.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + params.length}`);
    const allParams = [...params, ...leadParams];

    const parts: string[] = [];
    if (appsApplicable) parts.push(appSql);
    if (leadsApplicable) parts.push(shiftedLeadSql);
    if (parts.length === 0) return res.json({ ok: true, rows: [], total: 0 });

    const union = parts.join("\nUNION ALL\n");
    const finalSql = `
      SELECT *, COUNT(*) OVER() AS total_count FROM (${union}) u
      ORDER BY u.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}`;
    const rows = await sqlPool.unsafe(finalSql, allParams);
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    res.json({
      ok: true,
      total,
      rows: rows.map((r: any) => ({
        id: r.id,
        kind: r.kind,
        ref: r.ref,
        leadId: r.lead_id,
        name: r.kind === "lead"
          ? [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || r.phone || `Lead #${r.lead_id}`
          : appName(r),
        email: r.email || r.contact_email || null,
        phone: r.kind === "lead" ? r.phone : (`${r.phone_country_code || ""}${r.phone || ""}` || r.contact_phone || null),
        lifecycle: lifecycleOf(r.kind === "app" ? r : null, r.kind === "lead" ? r : null),
        paymentReference: r.payment_reference,
        amountDue: r.amount_due,
        packName: r.pack_name,
        agentId: r.assigned_agent_id,
        agentName: r.agent_name,
        quelle: r.quelle,
        kampagne: r.kampagne,
        createdAt: r.created_at,
        claimedPaidAt: r.claimed_paid_at,
        dismissedAt: r.dismissed_at,
        commissionBasis: r.commission_basis,
      })),
    });
  } catch (err) {
    console.error("[FIAON-KUNDEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// A — DIE AKTE: GET /admin/kunden/akte?id=<ref | lead-<id>>
// Aggregiert ALLES einer Person: Stammdaten, Bestell-Familie, Zahlungen,
// Bankeingänge, Provision, Leads, Timeline, Mail-Historie, Dubletten.
// ═══════════════════════════════════════════════════════════════════
router.get("/admin/kunden/akte", async (req: Request, res: Response) => {
  try {
    let id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id erforderlich (Antrags-ref, lead-<id> oder Personen-Nummer)" });

    // ── EINE ZENTRALE AKTE (27.08.2026, Justins Auftrag) ──────────────────
    // Gemeldet: Klick in der Chef-Kundenliste → „Akte nicht gefunden". Die
    // Aufrufer uebergaben die PERSONEN-Nummer, die Akte kannte nur die
    // Antrags-ref. Statt jeden Aufrufer zu jagen, loest die Akte die Person
    // jetzt SELBST auf: beste Bestellung des Menschen (bezahlt vor neu).
    // Damit fuehrt jeder Link im Haus — Lagezimmer, Kundenliste, Zahlungen —
    // in dieselbe Akte, egal welche Kennung er in der Hand hatte.
    if (/^(person-)?\d+$/i.test(id)) {
      const personId = Number(id.replace(/^person-/i, ""));
      const [beste] = (await sqlPool`
        SELECT a.ref FROM fiaon_applications a
         WHERE a.person_id = ${personId} AND a.merged_into IS NULL
         ORDER BY (a.payment_status = 'paid') DESC,
                  (a.ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
                  a.created_at DESC
         LIMIT 1`) as any[];
      if (beste?.ref) {
        id = String(beste.ref);
      } else {
        return res.status(404).json({
          ok: false,
          error: `Zur Person ${personId} liegt keine Bestellung vor — die Akte entsteht mit dem ersten Vorgang.`,
        });
      }
    }

    let primaryApp: any = null;
    let primaryLead: any = null;

    if (/^lead-\d+$/i.test(id)) {
      const leadId = Number(id.replace(/^lead-/i, ""));
      const rows = await sqlPool`
        SELECT l.*, ag.name AS agent_name FROM fiaon_leads l
        LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
        WHERE l.id = ${leadId}`;
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
      primaryLead = rows[0];
      // Hat der Lead doch schon eine Antrags-Schwester? → Akte am Antrag verankern.
      if (primaryLead.converted_order_id) {
        const app = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${primaryLead.converted_order_id}`;
        if (app.length > 0) primaryApp = app[0];
      }
      if (!primaryApp) {
        const em = normEmail(primaryLead.email);
        const ph = digits(primaryLead.telefon);
        const cand = await sqlPool.unsafe(`
          SELECT a.* FROM fiaon_applications a
          WHERE a.merged_into IS NULL AND (
            ($1 <> '' AND LOWER(TRIM(a.email)) = $1)
            OR ($2 <> '' AND LENGTH($2) >= 7 AND RIGHT(COALESCE(${APP_PHONE_SQL},''),9) = RIGHT($2,9))
          )
          ORDER BY (a.payment_status = 'paid') DESC, a.created_at ASC LIMIT 1`, [em, ph]);
        if (cand.length > 0) primaryApp = cand[0];
      }
    } else {
      const rows = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${id}`;
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
      primaryApp = rows[0];
      // Wurde dieser Datensatz gemergt? → auf den Gewinner umlenken (eine Akte).
      if (primaryApp.merged_into) {
        const winner = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${primaryApp.merged_into}`;
        if (winner.length > 0) primaryApp = winner[0];
      }
    }

    // ── Bestell-Familie der Person (E-Mail ODER Telefon-Ziffern ≥ 7 + Merge-Ketten) ──
    let family: any[] = [];
    if (primaryApp) {
      const em = normEmail(appEmail(primaryApp));
      const ph = appPhoneDigits(primaryApp);
      // Die Familie wird über DREI Wege gebildet: gleiche Referenz-Kette,
      // gleiche E-Mail/Telefonnummer UND dieselbe Person.
      //
      // Der letzte Weg fehlte. Das Personen-Modell (fiaon_persons) verknüpft
      // Bestellungen bereits sauber — auch dann, wenn der Kunde beim zweiten Kauf
      // eine andere Adresse und eine andere Nummer angegeben hat. Die Akte
      // bildete ihre Familie aber nach einer EIGENEN Regel und übersah genau
      // diese Fälle: Stammdaten wirkten unvollständig, obwohl sie zwei Zeilen
      // weiter standen, und dieselbe Person konnte in zwei Ansichten
      // unterschiedlich aussehen.
      family = await sqlPool.unsafe(`
        SELECT a.*, ag.name AS agent_name, ${APP_PHONE_SQL} AS phone_digits
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE a.ref = $3 OR a.merged_into = $3 OR a.superseded_by = $3
           OR ($1 <> '' AND LOWER(TRIM(COALESCE(a.email, a.contact_email, a.billing_email,''))) = $1)
           OR ($2 <> '' AND LENGTH($2) >= 7 AND RIGHT(COALESCE(${APP_PHONE_SQL},''),9) = RIGHT($2,9))
           OR ($4::int IS NOT NULL AND a.person_id = $4::int)
        ORDER BY (a.payment_status = 'paid') DESC, a.created_at ASC`,
        [em, ph, primaryApp.ref, primaryApp.person_id ?? null]);
      // Primärsatz = bezahlter Gewinner der sichtbaren Familie, sonst wie geladen.
      const visible = family.filter((f) => !f.merged_into);
      const paidVisible = visible.find((f) => f.payment_status === "paid");
      if (paidVisible && paidVisible.ref !== primaryApp.ref) primaryApp = paidVisible;
    }
    const familyRefs = family.map((f) => f.ref);

    // ── Leads der Person ──
    let leads: any[] = [];
    {
      const em = normEmail(primaryApp ? appEmail(primaryApp) : primaryLead?.email);
      const ph = primaryApp ? appPhoneDigits(primaryApp) : digits(primaryLead?.telefon);
      const leadIdParam = primaryLead ? Number(primaryLead.id) : -1;
      leads = await sqlPool.unsafe(`
        SELECT l.*, ag.name AS agent_name FROM fiaon_leads l
        LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
        WHERE l.id = $1
           OR ($2 <> '' AND LOWER(TRIM(COALESCE(l.email,''))) = $2)
           OR ($3 <> '' AND LENGTH($3) >= 7 AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'),9) = RIGHT($3,9))
           OR (l.converted_order_id = ANY($4))
        ORDER BY l.erstellt_am ASC`,
        [leadIdParam, em, ph, familyRefs.length ? familyRefs : ["__none__"]]);
    }
    const leadIds = leads.map((l) => Number(l.id));

    // ── Timeline: Kontakt-Log (Familie) + Lead-Log (Person), chronologisch ──
    const contactLog = familyRefs.length
      ? await sqlPool`
          SELECT id, ref, agent_id, agent_name, type, outcome, note, scheduled_at, promised_date, created_at, voided_at
          FROM fiaon_contact_log WHERE ref = ANY(${familyRefs})
          ORDER BY created_at ASC LIMIT 1000`
      : [];
    const leadLog = leadIds.length
      ? await sqlPool`
          SELECT id, lead_id, agent_id, agent_name, type, outcome, note, scheduled_at, created_at
          FROM fiaon_lead_log WHERE lead_id = ANY(${leadIds})
          ORDER BY created_at ASC LIMIT 1000`
      : [];

    // ── Das Forderungsmanagement dieses Menschen (30.08.2026) ──────────────
    // Die Akte nannte bisher nur EINEN Namen, unbeschriftet („betreut von X").
    // Ein Mensch hat aber zwei Zuständige, und das Team hielt das für einen
    // Fehler, weil nirgends stand, welcher welcher ist. Seit dem 30.08.2026
    // liegt genau EIN Inkasso-Zuständiger je Person fest
    // (server/lib/fiaon-inkasso.ts) — deshalb genügt hier ein Name.
    const inkassoZustaendig = familyRefs.length
      ? await sqlPool`
          SELECT ag.name
          FROM fiaon_abo_raten r
          JOIN fiaon_agents ag ON ag.id = r.inkasso_agent_id
          WHERE r.ref = ANY(${familyRefs})
            AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
          ORDER BY r.faellig_am ASC, r.id ASC LIMIT 1`
      : [];

    // ── Bankeingänge (Kontoabgleich) der Familie ──
    const bankTxns = familyRefs.length
      ? await sqlPool`
          SELECT id, txn_id, booked_at, amount_cents, currency, payer_name, reference_raw,
                 extracted_ref, matched_ref, match_status, amount_ok, applied, applied_at
          FROM fiaon_bank_txns WHERE matched_ref = ANY(${familyRefs})
          ORDER BY booked_at DESC NULLS LAST LIMIT 100`
      : [];

    // ── Provisionen der Familie ──
    const commissions = familyRefs.length
      ? await sqlPool`
          SELECT c.id, c.ref, c.agent_id, ag.name AS agent_name, c.amount_cents, c.rate_bp, c.status, c.kind, c.note, c.created_at
          FROM fiaon_commissions c LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
          WHERE c.ref = ANY(${familyRefs}) ORDER BY c.created_at ASC`
      : [];

    // ── Mail-Historie: Spalten-Flags des Primärsatzes + email_sent/followup-Logs ──
    const emailHistory: Array<{ at: string; event: string; label: string; source: string }> = [];
    const pushMail = (at: any, event: string, label: string, source: string) => {
      if (at) emailHistory.push({ at: new Date(at).toISOString(), event, label, source });
    };
    for (const f of family) {
      pushMail(f.welcome_sent_at, "welcome", `Willkommens-Mail (${f.ref})`, "system");
      pushMail(f.payment_email_sent_at, "payment_details", `Zahlungsdaten-Mail (${f.ref})`, "system");
      pushMail(f.claim_email_sent_at, "claim_received", `Ankündigung bestätigt (${f.ref})`, "system");
      pushMail(f.confirmed_email_sent_at, "payment_confirmed", `Bezahlt-Bestätigung mit Login (${f.ref})`, "system");
      pushMail(f.last_reminder_at, "payment_reminder", `Letzte Zahlungserinnerung${f.reminder_count ? ` (Nr. ${f.reminder_count})` : ""} (${f.ref})`, "system");
      pushMail(f.agent_email_sent_at, "agent_payment_reminder", `„Wie besprochen"-Mail durch Mitarbeiter (${f.ref})`, "agent");
    }
    for (const l of contactLog) {
      if (l.type === "email_sent") pushMail(l.created_at, "email_sent", `${l.note || "Kundenmail"} — ${l.agent_name}`, "log");
    }
    for (const l of leadLog) {
      if (l.type === "email_sent" || l.type === "followup") pushMail(l.created_at, l.type, `${l.note || "Lead-Mail"} — ${l.agent_name}`, "lead");
    }
    emailHistory.sort((a, b) => b.at.localeCompare(a.at));

    // ── Dubletten-Verdacht: Namens-Treffer AUSSERHALB der Familie (unsicher) ──
    let nameSuspects: any[] = [];
    const nameKey = primaryApp ? fullNameKey(primaryApp) : (primaryLead ? leadNameKey(primaryLead) : "");
    if (nameKey && nameKey.includes(" ")) {
      nameSuspects = await sqlPool.unsafe(`
        SELECT a.ref, a.payment_reference, a.payment_status, a.email, a.created_at,
               COALESCE(NULLIF(TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')),''), a.contact_name) AS name
        FROM fiaon_applications a
        WHERE a.merged_into IS NULL
          AND LOWER(TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,''))) = $1
          AND NOT (a.ref = ANY($2))
        ORDER BY a.created_at DESC LIMIT 10`,
        [nameKey, familyRefs.length ? familyRefs : ["__none__"]]);
    }

    // ── VOLLSTÄNDIGE STAMMDATEN (Meldung 04.08.2026) ─────────────────────────
    // Die Akte zeigte nur die Felder der EINEN Bestellung, die als Primärsatz
    // gewählt wurde. Trägt der Kunde Adresse und Geburtsdatum bei seiner ersten
    // Bestellung ein und kauft später ein zweites Produkt, war die Akte leer,
    // obwohl die Daten zwei Zeilen weiter standen. Gemessen: 107 Bestellungen
    // mit Lücken, die aus einer Schwesterbestellung derselben Person gefüllt
    // werden können.
    //
    // Regel: Der Primärsatz bleibt die Wahrheit. NUR leere Felder werden aus der
    // Familie ergänzt — jüngste brauchbare Angabe zuerst. Nichts wird
    // überschrieben, und jede Ergänzung ist nachvollziehbar (`ergaenzt`).
    const ERGAENZBAR = [
      "first_name", "last_name", "contact_name", "company_name",
      "email", "contact_email", "billing_email",
      "phone", "phone_country_code", "contact_phone",
      "street", "zip", "city", "country", "birthdate", "nationality",
    ] as const;
    const ergaenzt: { feld: string; ausRef: string }[] = [];
    if (primaryApp && family.length > 1) {
      const geschwister = family
        .filter((f) => f.ref !== primaryApp.ref)
        .sort((a, b) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
      for (const feld of ERGAENZBAR) {
        const wert = (primaryApp as any)[feld];
        const fehlt = wert === null || wert === undefined || String(wert).trim() === "";
        if (!fehlt) continue;
        const quelle = geschwister.find((g) => {
          const v = (g as any)[feld];
          return v !== null && v !== undefined && String(v).trim() !== "";
        });
        if (quelle) {
          (primaryApp as any)[feld] = (quelle as any)[feld];
          ergaenzt.push({ feld, ausRef: quelle.ref });
        }
      }
    }

    // ── DUBLETTEN: nur echte, nicht jedes Zweitprodukt ───────────────────────
    // Vorher galt JEDE zweite sichtbare Bestellung als Dublettenverdacht. Damit
    // schrie die Akte bei jedem Kunden „Dubletten!", der zusätzlich zum Paket
    // eine Bonitätsauskunft gekauft hat — also beim besten Teil des Bestands.
    // Ein Zusammenführen wäre dort sogar falsch: Es sind zwei bezahlte Produkte.
    //
    // Es gilt dieselbe Kategoriegrenze wie in `supersedeSisterOrders`:
    // Stufenpaket (Kontoaktivierung) und Zusatzprodukt (Bonitätsauskunft, 74 €)
    // sind verschiedene Dinge. Eine Dublette liegt nur INNERHALB einer Kategorie
    // vor — und auch nur, wenn höchstens eine der beiden bezahlt ist. Zwei
    // bezahlte Bestellungen derselben Kategorie sind kein Merge-Fall, sondern
    // ein Geldthema (Doppelzahlung) und stehen weiter unten als Warnung.
    const visibleFamily = family.filter((f) => !f.merged_into);
    const kategorie = (f: any) => (isAddonOrderRow(f) ? "zusatz" : "paket");
    const gleicheKategorie = new Map<string, any[]>();
    for (const f of visibleFamily) {
      const k = kategorie(f);
      gleicheKategorie.set(k, [...(gleicheKategorie.get(k) || []), f]);
    }
    // Nur LEBENDE Bestellungen zählen. Abgelaufene, storniete und ersetzte sind
    // erledigt — ein Zusammenführen ändert an ihnen nichts. Vorher meldete die
    // Akte „Dubletten!", weil ein Kunde vor Monaten vier Mal auf denselben Knopf
    // geklickt hatte und alle vier Bestellungen abgelaufen sind.
    const LEBENDIG = new Set(["pending_payment", "claimed_paid", "paid"]);
    const echteDubletten = Array.from(gleicheKategorie.values())
      .map((gruppe) => gruppe.filter((f) => LEBENDIG.has(String(f.payment_status))))
      .filter((gruppe) => gruppe.length > 1 && gruppe.filter((f) => f.payment_status === "paid").length <= 1)
      .flat();
    const mergeCandidates = echteDubletten.length > 1 ? echteDubletten : [];
    // Gewinner-Vorschlag: bezahlt > angekündigt > offen; mit Agent > ohne; vollständiger.
    let suggestedWinner: string | null = null;
    if (mergeCandidates.length > 1) {
      const score = (a: any) =>
        (a.payment_status === "paid" ? 1000 : a.payment_status === "claimed_paid" ? 500 : a.payment_status === "pending_payment" ? 250 : 0) +
        (a.assigned_agent_id ? 100 : 0) +
        ["email", "phone", "street", "city", "birthdate"].reduce((s, k) => s + (a[k] ? 10 : 0), 0);
      suggestedWinner = [...mergeCandidates].sort((a, b) => score(b) - score(a))[0].ref;
    }

    // Agents fürs Zuweisungs-Dropdown — mit Dienst-/Präsenz-/Last-Markierung
    // (P3, 01.09.2026): Die Auswahl bleibt vollständig, aber sie BENENNT, wer
    // gerade nicht im Dienst ist oder eine volle Liste hat. imDienst = NULL
    // heißt „kein Wochenplan hinterlegt" — ein eigener Zustand, nicht abwesend.
    const agents = await sqlPool`
      SELECT a.id, a.name, a.active,
             CASE WHEN NOT EXISTS (SELECT 1 FROM fiaon_arbeitszeiten w0 WHERE w0.agent_id = a.id)
                  THEN NULL
                  ELSE EXISTS (
                    SELECT 1 FROM fiaon_arbeitszeiten w
                    WHERE w.agent_id = a.id
                      AND w.wochentag = EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::smallint
                      AND (NOW() AT TIME ZONE 'Europe/Berlin')::time BETWEEN w.von AND w.bis)
             END AS "imDienst",
             (pr.zuletzt IS NOT NULL AND pr.zuletzt > NOW() - INTERVAL '20 minutes'
              AND pr.status IN ('da', 'telefon')) AS anwesend,
             (SELECT COUNT(*)::int FROM fiaon_persons mp
               WHERE mp.assigned_agent_id = a.id AND mp.mandat_seit IS NOT NULL
                 AND mp.merged_into_person_id IS NULL) AS mandate
      FROM fiaon_agents a
      LEFT JOIN fiaon_praesenz pr ON pr.agent_id = a.id
      WHERE a.active = TRUE ORDER BY a.name ASC`;

    // ── „Warum dieser Status?" (08.08.2026) ────────────────────────────────
    // Ein Status ohne Begründung ist eine Behauptung. „Antrag abgeschlossen,
    // keine Zahlung" hat eine Agentin einen Kunden für bezahlt halten lassen —
    // sie konnte nirgends nachsehen, woraus der Status folgte. Ab jetzt steht
    // daneben: welche Bestellung, welches Ereignis, welches Datum.
    //
    // WICHTIG: gezählt wird über `familyRefs` — also über genau die Bestellungen,
    // die diese Akte auch anzeigt. Nach `person_id` zu zählen ergab am 08.08.2026
    // den Widerspruch „genau eine Bestellung" neben einer Liste mit vier.
    const statusHerkunft = familyRefs.length > 0
      ? await statusFuerBestellungen(familyRefs).catch(() => null)
      : primaryApp?.person_id
        ? await statusFuerPerson(Number(primaryApp.person_id)).catch(() => null)
        : null;

    // Produktstand als EINE Zeile („Ultra (79,99 €/M) + Bonitätsauskunft").
    // Vorher standen fünf Bestellungen gleichwertig untereinander und niemand
    // konnte am Telefon sagen, was der Kunde eigentlich hat.
    const produkt = familyRefs.length > 0
      ? await produktstandFuerBestellungen(familyRefs).catch(() => null)
      : primaryApp?.person_id
        ? await produktstand(Number(primaryApp.person_id)).catch(() => null)
        : null;

    // ── VERTRIEBSSPERRE SICHTBAR MACHEN (05.09.2026, Fall Cataldo Sapia) ────
    // Der Betreiber sah „Voll aktiv", die Mitarbeiterin „gesperrt" — beides
    // stimmte: „Voll aktiv" ist die Vertragsstufe, „gesperrt" die Vertriebs-
    // sperre `fiaon_persons.is_blocked` (kein Kontakt, keine Listen). Die Akte
    // nannte die Sperre nirgends. Jetzt steht sie im Kopf, mit dem Verlauf
    // aus dem Sperr-Protokoll (Trigger, fiaon-kunde-aktiv.ts) und einem Knopf.
    const sperrPersonId = primaryApp?.person_id ? Number(primaryApp.person_id) : null;
    let vertriebSperre: { personId: number; gesperrt: boolean; verlauf: any[] } | null = null;
    if (sperrPersonId) {
      const [sp] = (await sqlPool`SELECT is_blocked FROM fiaon_persons WHERE id = ${sperrPersonId}`.catch(() => [] as any[])) as any[];
      const verlauf = (await sqlPool`
        SELECT alt, neu, geaendert_am, anwendung, anweisung
        FROM fiaon_sperr_protokoll WHERE person_id = ${sperrPersonId}
        ORDER BY geaendert_am DESC LIMIT 5
      `.catch(() => [] as any[])) as any[];
      vertriebSperre = {
        personId: sperrPersonId,
        gesperrt: Boolean(sp?.is_blocked),
        verlauf: verlauf.map((v) => ({
          alt: v.alt, neu: v.neu, am: v.geaendert_am, anwendung: v.anwendung || null,
          anweisung: v.anweisung ? String(v.anweisung).replace(/\s+/g, " ").slice(0, 240) : null,
        })),
      };
    }

    // Kopf-Daten
    const head = {
      id: primaryApp ? primaryApp.ref : `lead-${primaryLead.id}`,
      name: primaryApp ? appName(primaryApp) : ([primaryLead.vorname, primaryLead.nachname].filter(Boolean).join(" ") || primaryLead.email || primaryLead.telefon || `Lead #${primaryLead.id}`),
      lifecycle: lifecycleOf(primaryApp, primaryLead || (leads.length ? leads[0] : null)),
      /** Produktstand in einer Zeile — Details darunter, einklappbar. */
      produkt: produkt
        ? {
            text: produkt.text, stufe: produkt.stufe, zusatz: produkt.zusatz,
            stillgelegt: produkt.stillgelegt, mehrfachStufe: produkt.mehrfachStufe,
          }
        : null,
      /** Der EINE Statustext plus Herkunft. Quelle: shared/fiaon-kundenstatus.ts. */
      status: statusHerkunft
        ? {
            text: statusHerkunft.status.text,
            zusatz: statusHerkunft.status.zusatz,
            etikett: statusHerkunft.status.etikett,
            anzeige: statusHerkunft.status.anzeige,
            hinweis: statusHerkunft.status.hinweis,
            warum: {
              ref: statusHerkunft.ref,
              verwendungszweck: statusHerkunft.verwendungszweck,
              paket: statusHerkunft.paket,
              betragCent: statusHerkunft.betragCent,
              zahlungsstatus: statusHerkunft.zahlungsstatus,
              ereignis: statusHerkunft.ereignis,
              ereignisAm: statusHerkunft.ereignisAm,
              frist: statusHerkunft.frist,
              bestellungen: statusHerkunft.bestellungen,
              begruendung: statusHerkunft.begruendung,
            },
          }
        : null,
      email: primaryApp ? appEmail(primaryApp) : primaryLead?.email || null,
      // Nummer in wählbarer Form: Vorwahl und Nummer werden zusammengesetzt,
      // statt sie nur aneinanderzuhängen (das ergab bei fehlender Vorwahl eine
      // nicht wählbare Nummer).
      phone: primaryApp
        ? (nummerAusZeile(primaryApp).anzeige || primaryApp.contact_phone || null)
        : primaryLead?.telefon || null,
      phoneWaehlbar: primaryApp ? nummerAusZeile(primaryApp).waehlbar : null,
      phoneHinweis: primaryApp ? nummerAusZeile(primaryApp).hinweis : null,
      agentId: primaryApp ? primaryApp.assigned_agent_id : primaryLead?.assigned_agent_id || null,
      agentName: primaryApp
        ? (family.find((f) => f.ref === primaryApp.ref)?.agent_name || null)
        : primaryLead?.agent_name || null,
      // Der zweite Zuständige, ausdrücklich getrennt. Ist keine Rate offen,
      // bleibt er null — die Anzeige schreibt dann „niemand", nicht nichts.
      inkassoAgentName: (inkassoZustaendig as any[])[0]?.name ?? null,
      seit: primaryApp ? primaryApp.created_at : primaryLead?.erstellt_am,
      commissionBasis: primaryApp?.commission_basis || null,
      commissionBasisNote: primaryApp?.commission_basis_note || null,
      // Nur echte Dubletten lösen die Warnfarbe aus. Namensgleichheit bei
      // anderer E-Mail und anderer Nummer ist ein HINWEIS, kein Verdacht —
      // „Müller" gibt es mehrfach. Sie wird unten separat gemeldet.
      duplicateSuspicion: mergeCandidates.length > 1,
      namensHinweise: nameSuspects.length,
      gdprDeleted: Boolean(primaryApp?.gdpr_deleted_at),
      dismissedAt: primaryApp?.dismissed_at || primaryLead?.dismissed_at || null,
      /** Vertriebssperre (is_blocked) — getrennt von Stufe und Kontostatus. */
      vertriebSperre,
    };

    // ══════════════════════════════════════════════════════════════════════
    // DIE EINE ABLEITUNG, AUCH IN DER AKTE (20.08.2026)
    //
    // ── DER FEHLER, DEN DER BETREIBER SAH ───────────────────────────────
    // Die Akte zeigte einen Statustext („Aktiv"), das Portal eine Spalte, die
    // Status-Kachel `account_status`. Drei Quellen, drei Wahrheiten — und bei
    // 364 von 365 bezahlten Kunden stand überall etwas Falsches, weil keiner
    // von ihnen ein Startgespräch geführt hatte.
    //
    // Der bestehende Statustext BLEIBT: Er beschreibt die Zahlung und den
    // Produktstand, und dafür ist er richtig. Die STUFE kommt daneben, aus der
    // einen Ableitung — und die Ablauf-Leiste zeigt beides zusammen.
    // ══════════════════════════════════════════════════════════════════════
    let stufenlage: any = null;
    if (primaryApp?.ref) {
      try {
        const { stufeAbleiten } = await import("../lib/fiaon-kundenstufe");
        const { kontoBestellungVon } = await import("../lib/fiaon-kundenansicht");
        // Die Stufe gehört zum KONTO des Menschen, nicht zur angeklickten
        // Zeile: Wer auf einer Bonitäts-Bestellung steht, will trotzdem den
        // Stand des Kontos sehen.
        const konto = primaryApp.person_id
          ? await kontoBestellungVon(Number(primaryApp.person_id))
          : null;
        const lage = await stufeAbleiten(konto?.ref ?? String(primaryApp.ref));
        if (lage) {
          stufenlage = {
            stufe: lage.stufe,
            grund: lage.grund,
            naechsterSchritt: lage.naechsterSchritt,
            ablauf: lage.ablauf,
            ausnahme: lage.ausnahme,
            nurAuskunft: lage.nurAuskunft,
            // Weicht die gespeicherte Spalte ab? Dann stimmt etwas nicht, und
            // die Akte soll es zeigen statt es zu verschweigen.
            spalteWeichtAb: lage.spalteWeichtAb,
          };
        }
      } catch (e) {
        // Eine fehlende Ableitung darf die Akte nicht leer lassen — sie hat
        // dreißig andere Angaben, die weiter stimmen.
        console.error("[AKTE] Stufen-Ableitung:", e);
      }
    }

    res.json({
      ok: true,
      head,
      /** Die abgeleitete Stufe samt Ablauf-Stand — für Kopf und Leiste. */
      stufenlage,
      // Welche Felder aus einer Schwesterbestellung ergänzt wurden — die Akte
      // zeigt das an, damit niemand rätselt, woher ein Wert kommt.
      ergaenzt,
      app: primaryApp
        ? {
            ref: primaryApp.ref,
            type: primaryApp.type,
            paymentReference: primaryApp.payment_reference,
            paymentStatus: primaryApp.payment_status,
            invoiceNumber: primaryApp.invoice_number,
            firstName: primaryApp.first_name,
            lastName: primaryApp.last_name,
            contactName: primaryApp.contact_name,
            companyName: primaryApp.company_name,
            email: primaryApp.email,
            contactEmail: primaryApp.contact_email,
            phone: nummerAusZeile(primaryApp).anzeige || primaryApp.contact_phone || "",
            phoneWaehlbar: nummerAusZeile(primaryApp).waehlbar,
            phoneHinweis: nummerAusZeile(primaryApp).hinweis,
            street: primaryApp.street,
            zip: primaryApp.zip,
            city: primaryApp.city,
            birthdate: primaryApp.birthdate,
            packKey: primaryApp.pack_key,
            packName: primaryApp.pack_name,
            approvedLimit: primaryApp.approved_limit,
            amountDue: primaryApp.amount_due,
            paymentDueDate: primaryApp.payment_due_date,
            allowRemindersDespitePaid: primaryApp.allow_reminders_despite_paid,
            accountStatus: primaryApp.account_status,
            claimedPaidAt: primaryApp.claimed_paid_at,
            completedAt: primaryApp.completed_at,
            // Die Akte braucht die Personen-Kennung: Dokumente, Anrufe und
            // das Gesprächsblatt hängen an der PERSON, nicht an der
            // Bestellung. Ohne sie stand die Dokumente-Sektion leer da.
            personId: primaryApp.person_id ?? null,
          }
        : null,
      orders: family.map((f) => ({
        ref: f.ref,
        paymentReference: f.payment_reference,
        paymentStatus: f.payment_status,
        amountDue: f.amount_due,
        packName: f.pack_name,
        invoiceNumber: f.invoice_number,
        createdAt: f.created_at,
        claimedPaidAt: f.claimed_paid_at,
        paymentDueDate: f.payment_due_date,
        completedAt: f.completed_at,
        mergedInto: f.merged_into,
        supersededBy: f.superseded_by,
        agentName: f.agent_name,
        isPrimary: primaryApp ? f.ref === primaryApp.ref : false,
        // Archiv (Teil 3): Die Akte zeigt eine archivierte Bestellung weiter —
        // getrennt und mit Grund. Sie aus der Akte zu verstecken wäre das, was
        // wir gerade abschaffen: ein Datensatz, den es angeblich nicht gibt.
        archiviertAm: f.archived_at ?? null,
        archivGrund: f.archived_reason ?? null,
        archivNotiz: f.archived_note ?? null,
        archiviertVon: f.archived_by ?? null,
        geldGebunden: f.payment_status === "paid",
      })),
      leads: leads.map((l) => ({
        id: l.id,
        vorname: l.vorname,
        nachname: l.nachname,
        email: l.email,
        telefon: l.telefon,
        quelle: l.quelle,
        kampagne: l.kampagne,
        status: l.status,
        agentId: l.assigned_agent_id,
        agentName: l.agent_name,
        convertedOrderId: l.converted_order_id,
        inSequence: l.in_sequence,
        erstelltAm: l.erstellt_am,
        dismissedAt: l.dismissed_at,
      })),
      bankTxns,
      commissions,
      emailHistory: emailHistory.slice(0, 100),
      timeline: [
        ...contactLog.map((c: any) => ({
          at: new Date(c.created_at).toISOString(),
          scope: "kunde", ref: c.ref, type: c.type, outcome: c.outcome,
          actor: c.agent_name, note: c.note, voided: Boolean(c.voided_at),
        })),
        ...leadLog.map((g: any) => ({
          at: new Date(g.created_at).toISOString(),
          scope: "lead", leadId: g.lead_id, type: g.type, outcome: g.outcome,
          actor: g.agent_name, note: g.note, voided: false,
        })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
      duplicates: {
        family: mergeCandidates.map((f) => ({
          ref: f.ref, paymentReference: f.payment_reference, paymentStatus: f.payment_status,
          email: appEmail(f), name: appName(f), createdAt: f.created_at,
        })),
        suggestedWinner,
        nameSuspects,
      },
      agents,
    });
  } catch (err) {
    console.error("[FIAON-KUNDEN] akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Stammdaten (Kontakt/Adresse) — delegiert an die BESTEHENDE Engine
// updateCustomerContact (Audit alt→neu inklusive). Zusätzlich: Geburtsdatum.
// ═══════════════════════════════════════════════════════════════════
router.post("/admin/kunden/:ref/stammdaten", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const body = req.body || {};
    const { updateCustomerContact } = await import("./fiaon-agent");
    // Kontakt-Felder über die bestehende, auditierte Engine
    const contactKeys = ["firstName", "lastName", "email", "phone", "street", "zip", "city"];
    const contactBody: any = {};
    for (const k of contactKeys) if (body[k] !== undefined) contactBody[k] = body[k];
    let changes: Array<{ field: string; from: string; to: string }> = [];
    let duplicate: any = null;
    if (Object.keys(contactBody).length > 0) {
      const result = await updateCustomerContact(ref, contactBody, { id: null, name: "Admin" });
      if (result.error) return res.status(result.error.code).json({ ok: false, error: result.error.msg });
      changes = result.changes || [];
      duplicate = result.duplicate || null;
    }
    // Geburtsdatum (nicht Teil der Engine) — eigenes auditiertes Update
    if (body.birthdate !== undefined) {
      const bd = String(body.birthdate || "").trim();
      if (bd && !/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
        return res.status(400).json({ ok: false, error: "Geburtsdatum ungültig (JJJJ-MM-TT)" });
      }
      const cur = await sqlPool`SELECT birthdate FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`;
      if (cur.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
      const from = cur[0].birthdate ? String(cur[0].birthdate).slice(0, 10) : "—";
      if (from !== (bd || "—")) {
        await sqlPool`UPDATE fiaon_applications SET birthdate = ${bd || null}, updated_at = NOW() WHERE ref = ${ref}`;
        await auditApp(ref, `Geburtsdatum korrigiert durch Admin: ${from} → ${bd || "—"}`);
        changes.push({ field: "Geburtsdatum", from, to: bd || "—" });
      }
    }
    res.json({ ok: true, changes, duplicate });
  } catch (err) {
    console.error("[FIAON-KUNDEN] stammdaten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Konditionen (sensibel, mit Bestätigung): Limit, Betrag, Zahlungsfrist, Paket.
// Reine Feld-Updates mit Audit — KEIN Eingriff in Zahlungs-/Provisions-Hooks.
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// DIE PAKETLISTE KOMMT AUS DEM KATALOG (19.08.2026)
//
// Hier stand eine eigene, handgeschriebene Liste mit acht Bezeichnungen. Sie
// war die dritte Preis- bzw. Paketquelle im Haus — und die einzige ohne Preis.
// Genau deshalb konnte die Route darunter das Paket wechseln und den Betrag
// stehen lassen („Betrag bewusst NICHT automatisch angepasst").
//
// AGENTS.md: „Eine Definition, ein Ort." Der Katalog liegt in
// shared/fiaon-pakete.ts; die Bonitätsauskunft ist ausgenommen, weil sie kein
// Stufenpaket ist und in der Akte nicht umgestellt wird.
// ═══════════════════════════════════════════════════════════════════════════
const PACKS_ALLOWED: Record<string, string> = Object.fromEntries(
  PAKETE.filter((p) => p.key !== "schufa").map((p) => [p.key, p.label]),
);
router.post("/admin/kunden/:ref/konditionen", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const body = req.body || {};
    if (!body.confirmed) return res.status(400).json({ ok: false, error: "Bestätigung erforderlich (confirmed=true) — sensible Felder" });
    const rows = await sqlPool`
      SELECT ref, payment_status, approved_limit, amount_due, payment_due_date, pack_key, pack_name
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const cur = rows[0];
    const changes: Array<{ field: string; from: string; to: string }> = [];

    // Limit (approved_limit) — reine Anzeige-/Portal-Größe, kein Geldfluss
    if (body.approvedLimit !== undefined) {
      const v = Number(body.approvedLimit);
      if (!Number.isFinite(v) || v < 0 || v > 500000) return res.status(400).json({ ok: false, error: "Limit ungültig (0 – 500.000 €)" });
      const from = cur.approved_limit != null ? String(cur.approved_limit) : "—";
      if (from !== String(v)) {
        await sqlPool`UPDATE fiaon_applications SET approved_limit = ${v}, updated_at = NOW() WHERE ref = ${ref}`;
        await auditApp(ref, `Kreditlimit (approved_limit) geändert durch Admin: ${from} € → ${v} €`);
        changes.push({ field: "Limit", from: `${from} €`, to: `${v} €` });
      }
    }
    // ══════════════════════════════════════════════════════════════════════
    // BETRAG — NUR NOCH DER KATALOGPREIS (19.08.2026)
    //
    // ── DAS WAR DIE LETZTE OFFENE STELLE ────────────────────────────────
    // Hier stand ein freies Feld: `Number(body.amountDue)`, geprüft auf
    // „0 bis 50.000 €". In der Akte („Betrag (amount_due, €)",
    // client/src/pages/admin-kunde.tsx) ließ sich damit jede Zahl eintippen.
    //
    // Die Antragsstrecke nimmt den Katalogpreis. Die Telefon-Anlage lehnt
    // einen mitgeschickten Betrag ausdrücklich ab („Beträge werden nicht
    // übernommen"). Die erste Rechnung rechnet aus dem Paket. Nur dieser Weg
    // schrieb, was jemand tippte — GEMESSEN: zwei bezahlte Bestellungen
    // stehen auf 10,00 € („Betrag ergänzt aus manueller Eingabe").
    //
    // Ein freier Betrag ist kein Komfort, sondern eine Zahlungsaufforderung
    // über eine Summe, die niemand herleiten kann: Der Kontoabgleich findet
    // sie nicht, die Abo-Rate und die Provision rechnen damit weiter.
    //
    // Bleibt erlaubt: den Betrag auf den Katalogpreis ZURÜCKSETZEN. Das ist
    // die einzige Änderung, die ein Mensch hier braucht.
    // ══════════════════════════════════════════════════════════════════════
    if (body.amountDue !== undefined) {
      if (cur.payment_status === "paid") {
        return res.status(409).json({ ok: false, error: "Betrag einer BEZAHLTEN Bestellung kann nicht geändert werden (Rechnung/Provision gebucht). Bei echtem Fehler: stornieren + neu anlegen." });
      }
      const v = Number(body.amountDue);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ ok: false, error: "Betrag ungültig" });
      const sollCents = katalogpreisCents(cur);
      if (sollCents == null) {
        return res.status(409).json({
          ok: false,
          error: "Für diese Bestellung ist kein Katalogpaket hinterlegt — ohne Paket gibt es "
            + "keinen Preis. Erst das Paket setzen, dann ergibt sich der Betrag von selbst.",
        });
      }
      const soll = sollCents / 100;
      if (Math.round(v * 100) !== sollCents) {
        return res.status(409).json({
          ok: false,
          error: `Beträge kommen nur aus dem Katalog. Für dieses Paket sind es `
            + `${soll.toFixed(2).replace(".", ",")} € — ein anderer Betrag lässt sich hier `
            + `nicht setzen. Soll der Kunde etwas anderes zahlen, gehört das Paket geändert.`,
          katalogEuro: soll,
        });
      }
      const from = cur.amount_due != null ? Number(cur.amount_due).toFixed(2) : "—";
      if (from !== v.toFixed(2)) {
        await sqlPool`UPDATE fiaon_applications SET amount_due = ${v.toFixed(2)}::numeric, updated_at = NOW() WHERE ref = ${ref}`;
        await auditApp(ref, `Betrag (amount_due) auf den Katalogpreis gesetzt durch Admin: ${from} € → ${v.toFixed(2)} €`);
        changes.push({ field: "Betrag", from: `${from} €`, to: `${v.toFixed(2)} €` });
      }
    }
    // Zahlungsfrist — nur bei offenen/angekündigten/abgelaufenen Bestellungen
    if (body.paymentDueDate !== undefined) {
      if (!["pending_payment", "claimed_paid", "expired"].includes(cur.payment_status)) {
        return res.status(409).json({ ok: false, error: "Zahlungsfrist nur bei offenen Bestellungen änderbar" });
      }
      const d = String(body.paymentDueDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ ok: false, error: "Frist ungültig (JJJJ-MM-TT)" });
      const from = cur.payment_due_date ? new Date(cur.payment_due_date).toISOString().slice(0, 10) : "—";
      if (from !== d) {
        // Ende des Tages Europe/Berlin ≈ 22:00 UTC (Sommer) — bewusst 23:59 Berlin über Datums-Cast:
        await sqlPool`
          UPDATE fiaon_applications SET
            payment_due_date = (${d}::date + INTERVAL '1 day' - INTERVAL '1 second') AT TIME ZONE 'Europe/Berlin',
            payment_status = CASE WHEN payment_status = 'expired' AND ${d}::date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date THEN 'pending_payment' ELSE payment_status END,
            updated_at = NOW()
          WHERE ref = ${ref}`;
        await auditApp(ref, `Zahlungsfrist geändert durch Admin: ${from} → ${d}`);
        changes.push({ field: "Zahlungsfrist", from, to: d });
      }
    }
    // ══════════════════════════════════════════════════════════════════════
    // PAKET — UND DER BETRAG GEHT MIT (19.08.2026)
    //
    // Hier stand wörtlich: „Betrag wird bewusst NICHT automatisch angepasst".
    // Das war die zweite Hälfte desselben Fehlers: Wer im Dropdown von Pro auf
    // High End stellte, hatte danach ein High-End-Paket zu 59,99 € — und die
    // Zahlungsdaten-Mail verschickte genau das.
    //
    // Ein Paket OHNE seinen Preis zu ändern ist keine Vorsicht, sondern zwei
    // Wahrheiten in einer Zeile. Bei einer BEZAHLTEN Bestellung ist beides
    // gesperrt: Dort hängen Rechnung und Provision daran.
    // ══════════════════════════════════════════════════════════════════════
    if (body.packKey !== undefined) {
      const key = String(body.packKey || "").trim();
      if (!PACKS_ALLOWED[key]) return res.status(400).json({ ok: false, error: "Unbekanntes Paket" });
      const from = cur.pack_name || cur.pack_key || "—";
      if (key !== cur.pack_key) {
        if (cur.payment_status === "paid") {
          return res.status(409).json({
            ok: false,
            error: "Das Paket einer BEZAHLTEN Bestellung kann nicht geändert werden — daran "
              + "hängen Rechnung und Provision. Bei echtem Fehler: stornieren und neu anlegen.",
          });
        }
        const neuEuro = paketPreisEuro(key);
        const altBetrag = cur.amount_due != null ? Number(cur.amount_due).toFixed(2) : "—";
        await sqlPool`
          UPDATE fiaon_applications
          SET pack_key = ${key}, pack_name = ${PACKS_ALLOWED[key]},
              -- Der Betrag folgt dem Paket. Nur wo schon einer stand: Ein
              -- Entwurf ohne Betrag soll keinen bekommen, bloß weil jemand das
              -- Paket gesetzt hat — die Rechnung entsteht später und holt ihn
              -- sich dann aus demselben Katalog.
              amount_due = CASE WHEN amount_due IS NULL THEN NULL
                                ELSE ${neuEuro.toFixed(2)}::numeric END,
              updated_at = NOW()
          WHERE ref = ${ref}
        `;
        await auditApp(ref, `Paket geändert durch Admin: ${from} → ${PACKS_ALLOWED[key]}`
          + (cur.amount_due != null
            ? ` — Betrag mit dem Katalog nachgezogen: ${altBetrag} € → ${neuEuro.toFixed(2)} €`
            : " — kein Betrag gesetzt (Entwurf); die Rechnung holt ihn aus dem Katalog"));
        changes.push({ field: "Paket", from: String(from), to: PACKS_ALLOWED[key] });
        if (cur.amount_due != null) {
          changes.push({ field: "Betrag", from: `${altBetrag} €`, to: `${neuEuro.toFixed(2)} €` });
        }
      }
    }
    res.json({ ok: true, changes });
  } catch (err) {
    console.error("[FIAON-KUNDEN] konditionen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Notiz des Vorgesetzten am Kunden (Kontakt-Log, bestehendes Format) ─────────
router.post("/admin/kunden/:ref/note", async (req: Request, res: Response) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const exists = await sqlPool`SELECT ref FROM fiaon_applications WHERE ref = ${req.params.ref}`;
    if (exists.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const rows = await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${req.params.ref}, NULL, 'Admin', 'note', ${note})
      RETURNING id, created_at`;
    res.json({ ok: true, entry: rows[0] });
  } catch (err) {
    console.error("[FIAON-KUNDEN] note:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/kunden/:personId/vertriebssperre — Sperre setzen oder aufheben
// (05.09.2026, Fall Cataldo Sapia)
//
// Bis heute konnte nur die Vertriebsleitung im Cockpit sperren und entsperren;
// die Verwaltung sah die Sperre nicht einmal. Body: { gesperrt: boolean,
// grund?: string }. Der Grund landet als Vermerk im Kontaktverlauf jeder
// Bestellung der Person, damit der Betreuer weiß, warum der Kunde wieder in
// seiner Liste steht. Das Sperr-Protokoll (Trigger) schreibt ohnehin mit.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/kunden/:personId/vertriebssperre", async (req: Request, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Person fehlt" });
    const gesperrt = req.body?.gesperrt === true;
    const grund = String(req.body?.grund || "").trim().slice(0, 500);
    const [vorher] = (await sqlPool`
      SELECT id, is_blocked FROM fiaon_persons WHERE id = ${personId} AND merged_into_person_id IS NULL
    `) as any[];
    if (!vorher) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (Boolean(vorher.is_blocked) === gesperrt) {
      return res.json({ ok: true, unveraendert: true, meldung: gesperrt ? "Der Kunde war schon gesperrt." : "Der Kunde war nicht gesperrt." });
    }
    await sqlPool`
      UPDATE fiaon_persons
      SET is_blocked = ${gesperrt}, follow_up_date = ${gesperrt ? null : sqlPool`follow_up_date`}, updated_at = NOW()
      WHERE id = ${personId}
    `;
    const refs = (await sqlPool`SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL`) as any[];
    const note = (gesperrt ? "Vertriebssperre GESETZT durch die Verwaltung" : "Vertriebssperre AUFGEHOBEN durch die Verwaltung")
      + (grund ? ` — ${grund}` : "");
    for (const r of refs) await auditApp(String(r.ref), note);
    console.log(`[FIAON-KUNDEN] vertriebssperre person=${personId} ${vorher.is_blocked} → ${gesperrt}${grund ? ` (${grund})` : ""}`);
    res.json({
      ok: true,
      meldung: gesperrt
        ? "Gesperrt — der Kunde erscheint in keiner Anrufliste mehr."
        : "Sperre aufgehoben — der Kunde steht wieder in den Listen seines Betreuers.",
    });
  } catch (err) {
    console.error("[FIAON-KUNDEN] vertriebssperre:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
