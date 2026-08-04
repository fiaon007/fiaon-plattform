import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 2 });
(async () => {
  const agenten = await sql`SELECT id, name FROM fiaon_agents WHERE active AND COALESCE(is_test_account,FALSE)=FALSE ORDER BY id`;
  console.log("=== 1) Zwei Welten: Personen (Heute) vs. Bestellungen (Meine Kunden) ===");
  for (const a of agenten) {
    const [p] = await sql`SELECT COUNT(*)::int c FROM fiaon_persons WHERE assigned_agent_id=${a.id} AND merged_into_person_id IS NULL`;
    const [heute] = await sql`
      SELECT COUNT(*)::int c FROM fiaon_persons
      WHERE assigned_agent_id=${a.id} AND merged_into_person_id IS NULL AND NOT is_blocked
        AND priority_tier IN (1,2)
        AND (promised_payment_date=CURRENT_DATE OR (follow_up_date IS NOT NULL AND follow_up_date<=CURRENT_DATE))`;
    const [app] = await sql`SELECT COUNT(*)::int c FROM fiaon_applications WHERE assigned_agent_id=${a.id} AND merged_into IS NULL`;
    // Personen in Heute, deren Bestellungen NICHT dem Agenten zugewiesen sind → in "Meine Kunden" unsichtbar
    const [luecke] = await sql`
      SELECT COUNT(*)::int c FROM fiaon_persons p
      WHERE p.assigned_agent_id=${a.id} AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
        AND (p.promised_payment_date=CURRENT_DATE OR (p.follow_up_date IS NOT NULL AND p.follow_up_date<=CURRENT_DATE))
        AND NOT EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id=p.id AND a2.merged_into IS NULL AND a2.assigned_agent_id=${a.id})`;
    console.log(`  ${a.name}: Personen ${p.c} · heute fällig ${heute.c} · Bestellungen(Meine Kunden) ${app.c} · davon in Heute aber NICHT in Meine Kunden: ${luecke.c}`);
  }

  console.log("\n=== 2) Ergebnis in Meine Kunden ohne Wirkung auf Heute ===");
  const [wirkung] = await sql`
    SELECT COUNT(*)::int c FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref=c.ref
    JOIN fiaon_persons p ON p.id=a.person_id
    WHERE c.type='result' AND c.created_at > NOW() - INTERVAL '14 days' AND c.agent_id IS NOT NULL
      AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
      AND p.promised_payment_date IS NULL AND NOT p.is_blocked`;
  console.log(`  Ergebnisse (14 Tage), bei denen die Person weiter heute/überfällig steht: ${wirkung.c}`);
  const letzte = await sql`
    SELECT c.outcome, c.created_at::date d, p.id pid, p.follow_up_date, p.promised_payment_date, p.unreachable_count
    FROM fiaon_contact_log c JOIN fiaon_applications a ON a.ref=c.ref JOIN fiaon_persons p ON p.id=a.person_id
    WHERE c.type='result' AND c.agent_id IS NOT NULL ORDER BY c.created_at DESC LIMIT 6`;
  for (const r of letzte) console.log(`   ${r.d} ${String(r.outcome).padEnd(22)} Person ${r.pid}: WV=${r.follow_up_date ? String(r.follow_up_date).slice(0,10) : "—"} Zusage=${r.promised_payment_date ? String(r.promised_payment_date).slice(0,10) : "—"} nicht-erreicht-Zähler=${r.unreachable_count}`);

  console.log("\n=== 3) Telefonnummern: Ländervorwahl vorhanden? ===");
  const [tel] = await sql`
    SELECT COUNT(*)::int gesamt,
           COUNT(*) FILTER (WHERE primary_phone LIKE '+%')::int mit_plus,
           COUNT(*) FILTER (WHERE primary_phone IS NOT NULL AND primary_phone NOT LIKE '+%')::int ohne_plus,
           COUNT(*) FILTER (WHERE primary_phone IS NULL)::int leer
    FROM fiaon_persons WHERE merged_into_person_id IS NULL`;
  console.log(`  Personen: ${tel.gesamt} · mit + ${tel.mit_plus} · OHNE Vorwahl ${tel.ohne_plus} · ohne Nummer ${tel.leer}`);
  const bsp = await sql`
    SELECT p.id, p.primary_phone, a.phone_country_code, a.phone, a.contact_phone
    FROM fiaon_persons p LEFT JOIN fiaon_applications a ON a.person_id=p.id AND a.merged_into IS NULL
    WHERE p.primary_phone IS NOT NULL AND p.primary_phone NOT LIKE '+%' LIMIT 5`;
  for (const r of bsp) console.log(`   Person ${r.id}: person="${r.primary_phone}" | app_vorwahl="${r.phone_country_code}" app_phone="${r.phone}" contact="${r.contact_phone}"`);

  console.log("\n=== 4) Akte: Vollständigkeit und Dubletten-Verdacht ===");
  const [voll] = await sql`
    SELECT COUNT(*)::int gesamt,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(street,''),NULL) IS NULL)::int ohne_strasse,
      COUNT(*) FILTER (WHERE birthdate IS NULL)::int ohne_gebdatum,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(phone,''),NULLIF(contact_phone,'')) IS NULL)::int ohne_tel
    FROM fiaon_applications WHERE merged_into IS NULL AND NOT COALESCE(ist_entwurf,FALSE)`;
  console.log(`  Bestellungen ${voll.gesamt}: ohne Straße ${voll.ohne_strasse} · ohne Geburtsdatum ${voll.ohne_gebdatum} · ohne Telefon ${voll.ohne_tel}`);
  // Wie oft ist ein Feld in der EINEN Bestellung leer, aber in einer Schwester derselben Person gefüllt?
  const [heilbar] = await sql`
    SELECT COUNT(*)::int c FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND (NULLIF(a.street,'') IS NULL OR a.birthdate IS NULL OR NULLIF(a.phone,'') IS NULL)
      AND EXISTS (
        SELECT 1 FROM fiaon_applications b WHERE b.person_id=a.person_id AND b.ref<>a.ref
          AND (NULLIF(b.street,'') IS NOT NULL OR b.birthdate IS NOT NULL OR NULLIF(b.phone,'') IS NOT NULL))`;
  console.log(`  Bestellungen mit Lücke, die aus einer Schwester gefüllt werden könnte: ${heilbar.c}`);
  const [dubl] = await sql`
    SELECT COUNT(*)::int c FROM (
      SELECT person_id FROM fiaon_applications WHERE merged_into IS NULL AND person_id IS NOT NULL
      GROUP BY person_id HAVING COUNT(*) > 1) x`;
  console.log(`  Personen mit mehreren offenen Bestellungen (Dubletten-Verdacht): ${dubl.c}`);
  await sql.end();
})();
