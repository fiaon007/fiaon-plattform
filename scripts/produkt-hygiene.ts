// ═══════════════════════════════════════════════════════════════════════════
// PRODUKT-HYGIENE — ein Kunde, eine Stufe
//
// Ein Konto hat GENAU EINE Stufe. Im Bestand liegen Personen mit zwei und mehr
// offenen Stufenpaketen: Der Kunde hat den Antrag zweimal durchlaufen, bekam zwei
// Rechnungen mit zwei Verwendungszwecken und zwei Mahnketten. Wer dann zahlt,
// zahlt auf eine von beiden — und die andere mahnt weiter.
//
// Der Lauf legt je Person die ÄLTERE offene Stufenpaket-Bestellung still
// (`payment_status='superseded'`) und setzt einen GEPRÜFTEN Verweis
// (`superseded_by`) auf die jüngere.
//
// WAS NIE ANGEFASST WIRD
//   · bezahlte Bestellungen (Geld ist geflossen)
//   · Zusatzprodukte (Bonitätsauskunft) — sie sind kein Stufenpaket und immer
//     ein Zweitprodukt
//   · archivierte und bereits ersetzte Zeilen
//
// Der Verweis wird VOR dem Schreiben geprüft: `superseded_by` speicherte früher
// bevorzugt die kurze Zahlungsreferenz, und wenn die sich änderte, zeigte der
// Zeiger ins Leere — so entstanden zwei Phantom-Fälle, bei denen niemand mehr
// nachvollziehen konnte, wodurch eine Bestellung ersetzt wurde.
//
//   npx tsx scripts/produkt-hygiene.ts              → Vorschau + CSV
//   npx tsx scripts/produkt-hygiene.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const datum = (v: unknown): string =>
  v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" }).format(new Date(String(v))) : "";

async function main(): Promise<void> {
  console.log("\n══ Produkt-Hygiene: ein Kunde, eine Stufe ══\n");

  // Offene STUFENPAKETE je Person. Zusatzprodukte bleiben ausdrücklich draußen.
  const offene = await sqlPool`
    SELECT a.person_id, a.ref, a.payment_reference, a.pack_name, a.pack_key,
           a.amount_due, a.payment_status, a.payment_due_date, a.created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS kunde
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE a.merged_into IS NULL
      AND a.archived_at IS NULL
      AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      AND COALESCE(a.type, '') <> 'schufa'
      AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY a.person_id, a.created_at DESC
  `;

  const jePerson = new Map<number, any[]>();
  for (const o of offene as any[]) {
    const id = Number(o.person_id);
    const arr = jePerson.get(id) ?? [];
    arr.push(o);
    jePerson.set(id, arr);
  }

  type Fall = { person: number; kunde: string; behalten: any; stilllegen: any };
  const faelle: Fall[] = [];
  for (const [person, liste] of Array.from(jePerson.entries())) {
    if (liste.length < 2) continue;
    // Die jüngste bleibt — der Kunde hat sich zuletzt so entschieden. Bei
    // gleichem Datum entscheidet der stärkere Zahlungsstand.
    const rang = (r: any) => ({ claimed_paid: 3, pending_payment: 2, expired: 1 } as any)[String(r.payment_status)] ?? 0;
    const sortiert = liste.slice().sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || rang(b) - rang(a));
    const behalten = sortiert[0];
    for (const s of sortiert.slice(1)) {
      faelle.push({ person, kunde: String(behalten.kunde), behalten, stilllegen: s });
    }
  }

  const kopf = ["person_id", "kunde", "stilllegen_ref", "stilllegen_paket", "stilllegen_stand",
    "stilllegen_angelegt", "ersetzt_durch_ref", "ersetzt_durch_paket", "ersetzt_durch_stand", "ersetzt_durch_angelegt"];
  const zeilen = faelle.map((f) => [
    f.person, f.kunde,
    f.stilllegen.ref, String(f.stilllegen.pack_name ?? "").split("\n")[0], f.stilllegen.payment_status,
    datum(f.stilllegen.created_at),
    f.behalten.ref, String(f.behalten.pack_name ?? "").split("\n")[0], f.behalten.payment_status,
    datum(f.behalten.created_at),
  ].map(feld).join(";"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/produkt-hygiene.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  const personen = new Set(faelle.map((f) => f.person)).size;
  console.log(`  Personen mit mehr als einer offenen Stufe: ${personen}`);
  console.log(`  Stillzulegende Bestellungen:              ${faelle.length}`);
  console.log(`  Vorschau: reports/produkt-hygiene.csv\n`);
  for (const f of faelle) {
    console.log(`  Person ${String(f.person).padEnd(6)} ${f.kunde.slice(0, 24).padEnd(26)} `
      + `${f.stilllegen.ref} (${f.stilllegen.payment_status}, ${datum(f.stilllegen.created_at)}) `
      + `→ ersetzt durch ${f.behalten.ref} (${datum(f.behalten.created_at)})`);
  }

  if (faelle.length === 0) {
    console.log("\n  Nichts zu tun — jeder Kunde hat höchstens eine offene Stufe.\n");
    await sqlPool.end();
    return;
  }
  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  let stillgelegt = 0;
  await sqlPool.begin(async (tx) => {
    for (const f of faelle) {
      // Zeiger PRÜFEN, nicht glauben: bevorzugt der Verwendungszweck, aber nur,
      // wenn er auch auflösbar ist. Sonst die `ref` — sie ist Primärschlüssel.
      const kandidat = f.behalten.payment_reference || f.behalten.ref;
      const [ok] = await tx`
        SELECT 1 AS treffer FROM fiaon_applications
        WHERE payment_reference = ${kandidat} OR ref = ${kandidat} LIMIT 1
      `;
      const zeiger = ok ? kandidat : f.behalten.ref;

      const rows = await tx`
        UPDATE fiaon_applications SET
          payment_status = 'superseded',
          superseded_by = ${zeiger},
          updated_at = NOW()
        WHERE ref = ${f.stilllegen.ref}
          AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
          AND archived_at IS NULL AND merged_into IS NULL
        RETURNING ref
      `;
      if (rows.length === 0) continue;
      stillgelegt++;

      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
        VALUES (${f.stilllegen.ref}, NULL, 'System', 'system', 'superseded',
                ${`Stillgelegt: Dieselbe Person hatte zwei offene Stufenpakete. Diese Bestellung wird durch ${zeiger} ersetzt (Produkt-Hygiene 08.08.2026). Keine weiteren Erinnerungen; die Bestellung bleibt in der Akte sichtbar.`})
      `;
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (NULL, 'produkt_hygiene',
                ${JSON.stringify({ personId: f.person, stillgelegt: f.stilllegen.ref, ersetztDurch: zeiger })},
                'Produkt-Hygiene (Lauf)',
                ${"Zweite offene Stufenpaket-Bestellung derselben Person stillgelegt"})
      `;
      const { personTierAktualisieren } = await import("../server/lib/tier");
      await personTierAktualisieren(tx, { personId: f.person }).catch(() => {});
    }
  });

  console.log(`\n  Stillgelegt: ${stillgelegt} Bestellung(en). Nichts gelöscht, nichts bezahlt angefasst.`);
  console.log(`  Jede Stilllegung steht im Kundenverlauf und in fiaon_agent_events.\n`);
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[PRODUKT-HYGIENE]", err);
  process.exit(1);
});
