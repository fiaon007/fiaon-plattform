// ═══════════════════════════════════════════════════════════════════
// PROMPT 1/2 — Read-only-Smoke-Test der Zentralen Kundenakte.
// AUSSCHLIESSLICH SELECT — keine Datenänderung. Ausführen:
//   npx tsx scripts/test-kundenakte.ts
// Prüft: (1) Listen-UNION (Anträge + Lead-only) läuft und zeigt niemanden
// doppelt, (2) Akte-Aggregat für einen echten Kunden, (3) Suche „Terzi".
// ═══════════════════════════════════════════════════════════════════

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });

const APP_PHONE_SQL = `
  COALESCE(
    NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
  )`;

async function main() {
  let pass = 0, fail = 0;
  const ok = (name: string, cond: boolean, detail = "") => {
    if (cond) { pass++; console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
    else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  };

  // 1) Listen-UNION (Default-Filter der Route: sichtbar, nicht superseded, mit Kontaktdaten)
  const rows = await sql.unsafe(`
    SELECT *, COUNT(*) OVER() AS total_count FROM (
      SELECT 'app' AS kind, a.ref AS id, a.email AS mail, ${APP_PHONE_SQL} AS tel, a.created_at
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.payment_status IS DISTINCT FROM 'superseded'
        AND (COALESCE(a.email,'') <> '' OR COALESCE(a.contact_email,'') <> '' OR COALESCE(a.phone,'') <> '' OR COALESCE(a.contact_phone,'') <> '' OR a.payment_reference IS NOT NULL)
      UNION ALL
      SELECT 'lead' AS kind, 'lead-' || l.id AS id, l.email AS mail,
             regexp_replace(COALESCE(l.telefon,''),'\\D','','g') AS tel, l.erstellt_am AS created_at
      FROM fiaon_leads l
      WHERE l.converted_order_id IS NULL AND l.status <> 'konvertiert'
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_applications a WHERE a.merged_into IS NULL AND (
            (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
            OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
                AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
                  = RIGHT(COALESCE(${APP_PHONE_SQL},''), 9))
          )
        )
    ) u ORDER BY u.created_at DESC NULLS LAST LIMIT 50`);
  ok("Liste läuft (50er-Seite)", rows.length > 0, `total=${rows.length ? rows[0].total_count : 0}`);

  // Keine Person doppelt: keine Lead-Zeile teilt E-Mail mit einer App-Zeile derselben Seite
  const appMails = new Set(rows.filter((r: any) => r.kind === "app" && r.mail).map((r: any) => String(r.mail).toLowerCase().trim()));
  const dupLead = rows.find((r: any) => r.kind === "lead" && r.mail && appMails.has(String(r.mail).toLowerCase().trim()));
  ok("Kein Lead doppelt neben seiner Antrags-Schwester", !dupLead, dupLead ? `Kollision: ${dupLead.id}` : "");

  // 2) Akte-Familie für einen bezahlten Kunden (erste bezahlte ref)
  const [paid] = await sql`
    SELECT ref, email FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND payment_reference IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST LIMIT 1`;
  if (paid) {
    const family = await sql.unsafe(`
      SELECT a.ref, a.payment_status FROM fiaon_applications a
      WHERE a.ref = $2 OR a.merged_into = $2 OR a.superseded_by = $2
         OR ($1 <> '' AND LOWER(TRIM(COALESCE(a.email, a.contact_email, a.billing_email,''))) = $1)`,
      [String(paid.email || "").toLowerCase().trim(), paid.ref]);
    ok("Akte-Familie eines bezahlten Kunden", family.length >= 1, `${paid.ref}: ${family.length} Datensätze`);
    const logs = await sql`SELECT COUNT(*)::int AS c FROM fiaon_contact_log WHERE ref = ${paid.ref}`;
    ok("Verlauf lesbar", Number(logs[0].c) >= 0, `${logs[0].c} Log-Einträge`);
  } else {
    ok("Akte-Familie eines bezahlten Kunden", false, "kein bezahlter Kunde gefunden");
  }

  // 3) Suche „Terzi" (Testplan 1)
  const hits = await sql`
    SELECT ref, first_name, last_name FROM fiaon_applications
    WHERE merged_into IS NULL AND (first_name ILIKE ${"%Terzi%"} OR last_name ILIKE ${"%Terzi%"})`;
  console.log(`INFO  Suche „Terzi": ${hits.length} Antrags-Treffer → ${hits.map((h: any) => h.ref).join(", ") || "—"}`);

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await sql.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
