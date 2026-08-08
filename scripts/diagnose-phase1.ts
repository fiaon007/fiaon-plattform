// ═══════════════════════════════════════════════════════════════════
// PHASE-1-DIAGNOSE für SYSTEM_DIAGNOSE.md (D1–D6 + Sofort-Fix-Prüfung)
// NUR LESEND — ausschließlich SELECT, keine Schreiboperationen.
// Aufruf: npx tsx scripts/diagnose-phase1.ts
// Ausgabe: Konsole + /tmp/diagnose.txt
// ═══════════════════════════════════════════════════════════════════
import "dotenv/config";
import { appendFileSync, writeFileSync } from "fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const OUT = "/tmp/diagnose.txt";
writeFileSync(OUT, `Phase-1-Diagnose ${new Date().toISOString()}\n`);

function log(...args: any[]) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 1))).join(" ");
  console.log(line);
  appendFileSync(OUT, line + "\n");
}

async function main() {
  // ═══════════════ D1 — Agenten / offene Leads ═══════════════
  log("\n═══════════ D1 — Leads & Zuweisung ═══════════");
  const [d11] = await sql`
    SELECT COUNT(*)::int AS offene_leads,
           COUNT(*) FILTER (WHERE assigned_agent_id IS NOT NULL)::int AS zugewiesen,
           COUNT(*) FILTER (WHERE assigned_agent_id IS NULL)::int AS ohne_agent
    FROM fiaon_leads WHERE status IN ('neu','kontaktiert','nicht_erreichbar')`;
  log("D1.1 offene Leads:", d11);

  const perAgent = await sql`
    SELECT ag.id, ag.name, ag.active, ag.distribution_active,
      (SELECT COUNT(*)::int FROM fiaon_leads l WHERE l.assigned_agent_id=ag.id AND l.status IN ('neu','kontaktiert','nicht_erreichbar')) AS offene_leads,
      (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.assigned_agent_id=ag.id AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment','claimed_paid')) AS offene_kunden,
      (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.assigned_agent_id=ag.id AND a.merged_into IS NULL AND a.payment_status='expired') AS abgelaufen
    FROM fiaon_agents ag ORDER BY ag.id`;
  log("D1.1 pro Agent:");
  for (const r of perAgent) log(" ", r);

  const seq = await sql`
    SELECT in_sequence, COUNT(*)::int AS c FROM fiaon_leads
    WHERE status IN ('neu','kontaktiert','nicht_erreichbar') GROUP BY 1 ORDER BY 1`;
  log("D1.3 in_sequence unter offenen Leads:", seq);

  const leadStatus = await sql`SELECT status, COUNT(*)::int AS c FROM fiaon_leads GROUP BY 1 ORDER BY 2 DESC`;
  log("D1 Lead-Status gesamt:", leadStatus);

  const [openCust] = await sql`
    SELECT COUNT(*)::int AS offene_kunden, COUNT(*) FILTER (WHERE assigned_agent_id IS NULL)::int AS unzugewiesen
    FROM fiaon_applications WHERE merged_into IS NULL AND payment_status IN ('pending_payment','claimed_paid')`;
  log("D1 offene Kunden (Arbeitsliste):", openCust);

  // Gegenprobe Agent #8 — exakt die WHERE-Klausel von GET /agent/leads
  const [agent8] = await sql`
    SELECT COUNT(*)::int AS anrufliste FROM fiaon_leads
    WHERE assigned_agent_id = 8 AND status IN ('neu','kontaktiert','nicht_erreichbar')`;
  log("D1.4 Agent #8 Anrufliste (GET /agent/leads):", agent8);

  // Warum greift Round-Robin nicht? Alter der unzugewiesenen offenen Leads + letzter Verteilungslauf
  const [unassignedAge] = await sql`
    SELECT MIN(erstellt_am) AS aeltester, MAX(erstellt_am) AS neuester, COUNT(*)::int AS c
    FROM fiaon_leads WHERE status IN ('neu','kontaktiert','nicht_erreichbar') AND assigned_agent_id IS NULL`;
  log("D1.5 unzugewiesene offene Leads (Alter):", unassignedAge);
  const [lastRot] = await sql`
    SELECT MAX(created_at) AS letzter_lauf, COUNT(*)::int AS gesamt
    FROM fiaon_lead_log WHERE note LIKE '%Rotationsverteilung%'`;
  log("D1.5 letzte Lead-Rotationsverteilung (fiaon_lead_log):", lastRot);

  // Schaden 100er-Grenze (Deliverability)
  const [dmg] = await sql`
    SELECT MAX(COALESCE(lead_reminder_count,0))::int AS max_nachfaesse,
           COUNT(*) FILTER (WHERE COALESCE(lead_reminder_count,0) > 6)::int AS ueber_6,
           COUNT(*) FILTER (WHERE COALESCE(lead_reminder_count,0) > 10)::int AS ueber_10
    FROM fiaon_leads`;
  log("D1/Fix1 Nachfass-Zähler (Schaden):", dmg);

  // ═══════════════ D2 — Attribution Lead→Kunde ═══════════════
  log("\n═══════════ D2 — Attribution ═══════════");
  const dereliLeads = await sql`
    SELECT id, vorname, nachname, email, telefon, status, assigned_agent_id, converted_order_id,
           konvertiert_am, in_sequence, lead_reminder_count, erstellt_am
    FROM fiaon_leads WHERE nachname ILIKE '%dereli%' OR vorname ILIKE '%hüseyin%' OR vorname ILIKE '%huseyin%'`;
  log("D2 Lead(s) Dereli:", dereliLeads);
  for (const l of dereliLeads) {
    const lg = await sql`SELECT type, outcome, note, agent_name, created_at FROM fiaon_lead_log WHERE lead_id = ${l.id} ORDER BY created_at ASC`;
    log(`D2 Lead-Log #${l.id}:`, lg);
  }
  const dereliApps = await sql`
    SELECT ref, payment_reference, payment_status, amount_due, assigned_agent_id, status,
           created_at, claimed_paid_at, completed_at, merged_into, superseded_by
    FROM fiaon_applications
    WHERE payment_reference ILIKE '%MRLQ%' OR ref ILIKE '%MRLQ838F%' OR last_name ILIKE '%dereli%'`;
  log("D2 Bestellung(en) Dereli/MRLQ838F:", dereliApps);
  for (const a of dereliApps) {
    const comm = await sql`SELECT id, agent_id, amount_cents, status, kind FROM fiaon_commissions WHERE ref = ${a.ref}`;
    log(`D2 Provisionen zu ${a.ref}:`, comm.length ? comm : "KEINE");
  }

  // Umfang: konvertierte Leads vs. Agent auf der Bestellung
  const [d2scope] = await sql`
    SELECT
      COUNT(*)::int AS konvertierte_leads,
      COUNT(*) FILTER (WHERE a.ref IS NOT NULL)::int AS mit_bestellung,
      COUNT(*) FILTER (WHERE l.assigned_agent_id IS NOT NULL AND a.ref IS NOT NULL AND a.assigned_agent_id IS NULL)::int AS lead_hat_agent_bestellung_keinen,
      COUNT(*) FILTER (WHERE l.assigned_agent_id IS NOT NULL AND a.assigned_agent_id IS NOT NULL AND l.assigned_agent_id <> a.assigned_agent_id)::int AS lead_und_bestellung_verschieden,
      COUNT(*) FILTER (WHERE a.payment_status = 'paid' AND a.assigned_agent_id IS NULL)::int AS bezahlt_ohne_agent,
      COUNT(*) FILTER (WHERE a.payment_status = 'paid' AND NOT EXISTS (
        SELECT 1 FROM fiaon_commissions c WHERE c.ref = a.ref AND c.amount_cents > 0 AND c.status <> 'storniert'))::int AS bezahlt_ohne_provision
    FROM fiaon_leads l
    LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
    WHERE l.status = 'konvertiert'`;
  log("D2 Umfang (konvertierte Leads):", d2scope);

  // Bezahlte Bestellungen insgesamt ohne Agent / ohne Provision (auch ohne Lead-Bezug)
  const [d2paid] = await sql`
    SELECT
      COUNT(*)::int AS bezahlt_gesamt,
      COUNT(*) FILTER (WHERE assigned_agent_id IS NULL)::int AS ohne_agent,
      COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_commissions c WHERE c.ref = fiaon_applications.ref AND c.amount_cents > 0 AND c.status <> 'storniert'))::int AS ohne_provision
    FROM fiaon_applications WHERE payment_status = 'paid' AND merged_into IS NULL`;
  log("D2 alle bezahlten Bestellungen:", d2paid);

  // ═══════════════ D3 — Fünf „Bezahlt"-Kennzahlen nachrechnen ═══════════════
  log("\n═══════════ D3 — Kennzahlen ═══════════");
  const [k1] = await sql`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_due),0) AS summe
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE) AND merged_into IS NULL`;
  log("D3.1 Zahlungszentrale (paid + payment_reference NOT NULL + merged NULL):", k1);
  const [k2] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_applications
    WHERE payment_status='paid' AND merged_into IS NULL AND created_at >= NOW() - INTERVAL '30 days'`;
  log("D3.2 Gesamt-Funnel 30T (paid + merged NULL + created_at 30d):", k2);
  const [k3] = await sql`
    SELECT COUNT(*)::int AS c, COALESCE(SUM(ROUND(COALESCE(amount_due::numeric,0)*100)),0)::bigint AS cents
    FROM fiaon_applications
    WHERE payment_status='paid' AND merged_into IS NULL
      AND COALESCE(completed_at, updated_at) >= NOW() - INTERVAL '30 days'`;
  log("D3.3 Umsatz Brutto 30T (paid + merged NULL + completed/updated 30d):", k3);
  const [k4] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_applications WHERE payment_status='paid' AND merged_into IS NULL`;
  log("D3.4 Bestand all-time (paid + merged NULL):", k4);
  const [k5] = await sql`
    SELECT COUNT(*)::int AS c,
           COALESCE(SUM(ROUND(COALESCE(a.amount_due::numeric,0)*100)),0)::bigint AS cents
    FROM fiaon_leads l
    JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
    WHERE a.payment_status='paid'`;
  log("D3.5 Leads 'Zahlend' (konvertierte Leads mit bezahlter Bestellung):", k5);

  // Erklärungen der Deltas
  const [delta] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(alt_bestand, FALSE))::int AS paid_ohne_payment_ref,
      COUNT(*) FILTER (WHERE superseded_by IS NOT NULL)::int AS paid_mit_superseded_by,
      COUNT(*) FILTER (WHERE amount_due IS NULL OR amount_due = 0)::int AS paid_ohne_betrag
    FROM fiaon_applications WHERE payment_status='paid' AND merged_into IS NULL`;
  log("D3 Deltas unter den 154 bezahlten:", delta);
  const paidDup = await sql`
    SELECT LOWER(TRIM(email)) AS email, COUNT(*)::int AS c, COALESCE(SUM(amount_due),0) AS summe
    FROM fiaon_applications
    WHERE payment_status='paid' AND merged_into IS NULL AND email IS NOT NULL AND email <> ''
    GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC`;
  log("D3/D5 Personen (E-Mail) mit MEHREREN bezahlten Datensätzen:", paidDup.length, "Gruppen");
  for (const r of paidDup) log(" ", r);

  // LTV/CAC-Inputs (Formel: LTV = AOV × 12; CAC = Werbebudget ÷ bezahlt 30T)
  const [cac] = await sql`
    SELECT COALESCE(SUM(amount_cents),0)::bigint AS spend_cents
    FROM fiaon_ad_spend
    WHERE period_start >= (NOW() - INTERVAL '30 days')::date AND period_start <= NOW()::date`;
  log("D3 Werbebudget 30T (fiaon_ad_spend):", cac);
  // Lead-Funnel „Kontaktiert" 30T (Definition: status <> 'neu')
  const [lf] = await sql`
    SELECT COUNT(*)::int AS leads,
           COUNT(*) FILTER (WHERE status <> 'neu')::int AS kontaktiert
    FROM fiaon_leads WHERE erstellt_am >= NOW() - INTERVAL '30 days'`;
  log("D3 Lead-Funnel 30T (kontaktiert = status <> 'neu'):", lf);

  // ═══════════════ D4 — Die 4.297 „Anträge" aufschlüsseln ═══════════════
  log("\n═══════════ D4 — /admin/database Datenbestand ═══════════");
  const [d4] = await sql`
    SELECT
      COUNT(*)::int AS gesamt_roh,
      COUNT(*) FILTER (WHERE merged_into IS NULL)::int AS sichtbar_ui,
      COUNT(*) FILTER (WHERE merged_into IS NOT NULL)::int AS dubletten_gemerged,
      COUNT(*) FILTER (WHERE gdpr_deleted_at IS NOT NULL)::int AS gdpr_geloescht
    FROM fiaon_applications`;
  log("D4 Anträge gesamt:", d4);
  const [d4b] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(email),''), NULLIF(TRIM(contact_email),''), NULLIF(TRIM(billing_email),'')) IS NULL
                   AND COALESCE(NULLIF(TRIM(phone),''), NULLIF(TRIM(contact_phone),'')) IS NULL)::int AS ohne_email_und_telefon,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(email,'')) LIKE '%test%' OR LOWER(COALESCE(email,'')) LIKE '%example%'
                   OR LOWER(COALESCE(first_name,'')) LIKE '%test%' OR LOWER(COALESCE(last_name,'')) LIKE '%test%')::int AS test_junk_heuristik,
      COUNT(DISTINCT LOWER(TRIM(email))) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '')::int AS eindeutige_emails,
      COUNT(*) FILTER (WHERE email IS NULL OR TRIM(email) = '')::int AS ohne_email
    FROM fiaon_applications WHERE merged_into IS NULL`;
  log("D4 Aufschlüsselung (nur sichtbare):", d4b);
  const appStatus = await sql`
    SELECT COALESCE(status,'(NULL)') AS status, COUNT(*)::int AS c
    FROM fiaon_applications WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC`;
  log("D4 Antrags-Status-Verteilung:", appStatus);
  const payStatus = await sql`
    SELECT COALESCE(payment_status,'(NULL)') AS payment_status, COUNT(*)::int AS c
    FROM fiaon_applications WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC`;
  log("D4 Zahlungs-Status-Verteilung:", payStatus);
  const [kyc] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE bank_statement_pdf IS NOT NULL)::int AS mit_kontoauszug,
      COUNT(*) FILTER (WHERE id_card_pdf IS NOT NULL)::int AS mit_ausweis,
      COUNT(*) FILTER (WHERE schufa_pdf IS NOT NULL)::int AS mit_schufa_pdf,
      COUNT(*) FILTER (WHERE status IN ('completed','payment_completed','documents_submitted')
                   AND (bank_statement_pdf IS NULL OR id_card_pdf IS NULL))::int AS kyc_fehlt_logik,
      COUNT(*) FILTER (WHERE status = 'documents_submitted' AND bank_statement_pdf IS NOT NULL AND id_card_pdf IS NOT NULL)::int AS pruefbereit_logik
    FROM fiaon_applications WHERE merged_into IS NULL`;
  log("D4 KYC-Kennzahlen (Logik aus admin-database.tsx nachgerechnet):", kyc);
  const schufa = await sql`
    SELECT COALESCE(schufa_status,'(NULL)') AS schufa_status, COUNT(*)::int AS c
    FROM fiaon_applications WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC`;
  log("D4 schufa_status-Verteilung:", schufa);

  // ═══════════════ D5 — Dubletten ═══════════════
  log("\n═══════════ D5 — Dubletten ═══════════");
  const [dupEmail] = await sql`
    SELECT COUNT(*)::int AS gruppen, COALESCE(SUM(c-1),0)::int AS ueberzaehlig FROM (
      SELECT LOWER(TRIM(email)) AS e, COUNT(*)::int AS c FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY 1 HAVING COUNT(*) > 1) x`;
  log("D5 Dubletten nach E-Mail:", dupEmail);
  const [dupPhone] = await sql`
    SELECT COUNT(*)::int AS gruppen, COALESCE(SUM(c-1),0)::int AS ueberzaehlig FROM (
      SELECT REGEXP_REPLACE(COALESCE(phone, contact_phone), '\\D', '', 'g') AS p, COUNT(*)::int AS c
      FROM fiaon_applications
      WHERE merged_into IS NULL AND LENGTH(REGEXP_REPLACE(COALESCE(phone, contact_phone, ''), '\\D', '', 'g')) >= 7
      GROUP BY 1 HAVING COUNT(*) > 1) x`;
  log("D5 Dubletten nach Telefon (normalisiert, ≥7 Ziffern):", dupPhone);
  const [dupNameDob] = await sql`
    SELECT COUNT(*)::int AS gruppen, COALESCE(SUM(c-1),0)::int AS ueberzaehlig FROM (
      SELECT LOWER(TRIM(first_name)) || '|' || LOWER(TRIM(last_name)) || '|' || TRIM(birthdate) AS k, COUNT(*)::int AS c
      FROM fiaon_applications
      WHERE merged_into IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
        AND birthdate IS NOT NULL AND TRIM(birthdate) <> ''
      GROUP BY 1 HAVING COUNT(*) > 1) x`;
  log("D5 Dubletten nach Name+Geburtsdatum:", dupNameDob);
  const [dupNameAddr] = await sql`
    SELECT COUNT(*)::int AS gruppen, COALESCE(SUM(c-1),0)::int AS ueberzaehlig FROM (
      SELECT LOWER(TRIM(first_name)) || '|' || LOWER(TRIM(last_name)) || '|' || LOWER(TRIM(street)) || '|' || TRIM(zip) AS k, COUNT(*)::int AS c
      FROM fiaon_applications
      WHERE merged_into IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
        AND street IS NOT NULL AND TRIM(street) <> '' AND zip IS NOT NULL
      GROUP BY 1 HAVING COUNT(*) > 1) x`;
  log("D5 Dubletten nach Name+Adresse:", dupNameAddr);

  const top20 = await sql`
    SELECT LOWER(TRIM(email)) AS email,
           MIN(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))) AS name,
           COUNT(*)::int AS datensaetze,
           COUNT(*) FILTER (WHERE payment_status='paid')::int AS davon_bezahlt
    FROM fiaon_applications
    WHERE merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY 1 ORDER BY 3 DESC LIMIT 20`;
  log("D5 Top 20 schlimmste Fälle (nach E-Mail):");
  for (const r of top20) log(" ", r);

  // Feld-Befüllungsgrad → Identitäts-Anker-Begründung
  const [fill] = await sql`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '')::int AS mit_email,
      COUNT(*) FILTER (WHERE LENGTH(REGEXP_REPLACE(COALESCE(phone, contact_phone, ''), '\\D', '', 'g')) >= 7)::int AS mit_telefon,
      COUNT(*) FILTER (WHERE birthdate IS NOT NULL AND TRIM(birthdate) <> '')::int AS mit_geburtsdatum,
      COUNT(*) FILTER (WHERE street IS NOT NULL AND TRIM(street) <> '')::int AS mit_adresse
    FROM fiaon_applications WHERE merged_into IS NULL`;
  log("D5 Feld-Befüllung (Anker-Auswahl):", fill);

  // ═══════════════ D6 — Kontoabgleich ═══════════════
  log("\n═══════════ D6 — Bank-Reconciliation ═══════════");
  const bank = await sql`
    SELECT match_status, COUNT(*)::int AS c, COALESCE(SUM(amount_cents),0)::bigint AS cents,
           COUNT(*) FILTER (WHERE applied)::int AS verbucht
    FROM fiaon_bank_txns GROUP BY 1 ORDER BY 2 DESC`;
  log("D6 match_status-Verteilung:", bank);
  const [d6a] = await sql`
    SELECT COUNT(*)::int AS unmatched_mit_extracted_ref,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_applications a
             WHERE a.payment_reference = fiaon_bank_txns.extracted_ref AND a.merged_into IS NULL))::int AS wuerde_gegen_payment_reference_matchen
    FROM fiaon_bank_txns WHERE match_status = 'unmatched' AND extracted_ref IS NOT NULL`;
  log("D6 Beleg findApp-Bug (extracted_ref vs. payment_reference):", d6a);
  const samples = await sql`
    SELECT id, payer_name, LEFT(COALESCE(reference_raw,''), 120) AS verwendungszweck, extracted_ref, amount_cents, booked_at
    FROM fiaon_bank_txns WHERE match_status = 'unmatched'
    ORDER BY booked_at DESC NULLS LAST LIMIT 10`;
  log("D6 10 reale unzugeordnete Verwendungszwecke:");
  for (const r of samples) log(" ", r);
  // Wie viele unmatched würden über Name+Betrag matchen? (Fuzzy-Potenzial, exakte Namensteile)
  const [fuzzy] = await sql`
    SELECT COUNT(*)::int AS name_und_betrag_treffer FROM fiaon_bank_txns t
    WHERE t.match_status = 'unmatched' AND t.payer_name IS NOT NULL AND EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.merged_into IS NULL
        AND ROUND(COALESCE(a.amount_due::numeric,0)*100) = t.amount_cents
        AND LOWER(t.payer_name) LIKE '%' || LOWER(TRIM(COALESCE(a.last_name,'∅'))) || '%')`;
  log("D6 Fuzzy-Potenzial (Nachname im Einzahlernamen + exakter Betrag):", fuzzy);

  // ═══════════════ Sofort-Fix 2 — „Heute versendet: 1621" ═══════════════
  log("\n═══════════ Fix2 — Follow-up-Zähler ═══════════");
  const perDay = await sql`
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS tag, COUNT(*)::int AS followups
    FROM fiaon_lead_log WHERE type = 'followup'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 14`;
  log("Fix2 lead_followup-Log pro Tag (Berlin):", perDay);
  const [allTime] = await sql`SELECT COUNT(*)::int AS followups_gesamt FROM fiaon_lead_log WHERE type = 'followup'`;
  log("Fix2 followups all-time:", allTime);
  const [setting] = await sql`SELECT value FROM fiaon_settings WHERE key = 'max_lead_followups'`;
  log("Fix1 max_lead_followups (DB-Setting):", setting);

  // ═══════════════ Ergänzungen ═══════════════
  log("\n═══════════ Ergänzungen ═══════════");
  // D1/D2: konvertierte Leads ohne Agent (erklärt „Agent —" in der Admin-Liste)
  const [convNoAgent] = await sql`
    SELECT COUNT(*)::int AS konvertiert_ohne_agent
    FROM fiaon_leads WHERE status = 'konvertiert' AND assigned_agent_id IS NULL`;
  log("E1 konvertierte Leads ohne Agent:", convNoAgent);
  // D4: echte eindeutige Personen (Identität = E-Mail, sonst Telefon, sonst Name+Geburtsdatum)
  const [persons] = await sql`
    SELECT COUNT(DISTINCT ident)::int AS eindeutige_personen FROM (
      SELECT COALESCE(
        NULLIF(LOWER(TRIM(email)), ''),
        NULLIF(REGEXP_REPLACE(COALESCE(phone, contact_phone, ''), '\\D', '', 'g'), ''),
        NULLIF(LOWER(TRIM(COALESCE(first_name,'') || '|' || COALESCE(last_name,'') || '|' || COALESCE(birthdate,''))), '||')
      ) AS ident
      FROM fiaon_applications WHERE merged_into IS NULL
    ) x WHERE ident IS NOT NULL`;
  log("E2 echte eindeutige Personen (sichtbare Anträge):", persons);
  const [personsContact] = await sql`
    SELECT COUNT(DISTINCT ident)::int AS personen_mit_kontaktdaten FROM (
      SELECT COALESCE(
        NULLIF(LOWER(TRIM(email)), ''),
        NULLIF(REGEXP_REPLACE(COALESCE(phone, contact_phone, ''), '\\D', '', 'g'), '')
      ) AS ident
      FROM fiaon_applications WHERE merged_into IS NULL
    ) x WHERE ident IS NOT NULL`;
  log("E2b davon über E-Mail/Telefon identifizierbar:", personsContact);
  // D2: Dereli-Zeitachse — Bestellung vor Lead? (Reihenfolge belegen)
  const [ordering] = await sql`
    SELECT a.created_at AS bestellung_angelegt, l.erstellt_am AS lead_angelegt, l.konvertiert_am
    FROM fiaon_applications a, fiaon_leads l
    WHERE a.ref = 'FIAON-MRLQ838F-P2FA' AND l.id = 1822`;
  log("E3 Dereli Zeitachse:", ordering);

  // D5: Personen mit mehreren BEZAHLTEN Datensätzen — auch nach Telefon geprüft
  const paidDupPhone = await sql`
    SELECT REGEXP_REPLACE(COALESCE(phone, contact_phone), '\\D', '', 'g') AS tel, COUNT(*)::int AS c
    FROM fiaon_applications
    WHERE merged_into IS NULL AND payment_status='paid'
      AND LENGTH(REGEXP_REPLACE(COALESCE(phone, contact_phone, ''), '\\D', '', 'g')) >= 7
    GROUP BY 1 HAVING COUNT(*) > 1`;
  log("E4 mehrfach bezahlt nach Telefon:", paidDupPhone.length, "Gruppen", paidDupPhone);

  await sql.end();
  log("\nFertig. Vollständige Ausgabe: " + OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
