// ═══════════════════════════════════════════════════════════════════════════
// TESTEINTRÄGE AUFRÄUMEN
//
// Was wir selbst beim Ausprobieren erzeugt haben, steht als echter Kunde in
// der Arbeitsliste, in der Verteilung, in der Dublettensuche und in jeder
// Kennzahl. Die Regeln stehen in server/lib/fiaon-testerkennung.ts und sind
// über die Einstellungen pflegbar — dieses Skript ist die Vorschau und der
// Auslöser, nicht eine zweite Fassung der Regel.
//
// EINE BEZAHLTE BESTELLUNG MACHT UNANTASTBAR. Ein Testeintrag mit echtem
// Geldeingang ist ein Widerspruch: Entweder ist das Geld echt (dann ist es ein
// Kunde) oder die Buchung ist falsch (dann gehört sie korrigiert, nicht
// versteckt).
//
//   npx tsx scripts/test-aufraeumen.ts              # Vorschau + CSV
//   npx tsx scripts/test-aufraeumen.ts --schreiben  # markieren
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { alsTestMarkieren, kennzeichenLaden, testKandidaten } from "../server/lib/fiaon-testerkennung";

const SCHREIBEN = process.argv.includes("--schreiben");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  console.log("\n══ Testeinträge: was wir selbst angelegt haben ══\n");

  const k = await kennzeichenLaden();
  console.log(`  Interne Domains:   ${k.domains.join(", ")}`);
  console.log(`  Präfixe:           ${k.praefixe.join(", ")}`);
  console.log(`  Namen im Haus:     ${k.namen.join(", ")}`);
  console.log(`  Testprodukte:      ${k.produkte.join(", ")}\n`);
  console.log("  (änderbar in den Einstellungen unter „test_kennzeichen“)\n");

  const kandidaten = await testKandidaten();
  console.log(`  Kandidaten: ${kandidaten.length}\n`);

  mkdirSync("reports", { recursive: true });
  const kopf = ["person_id", "name", "email", "telefon", "bestellungen", "bezahlt", "grund"];
  const zeilen = kandidaten.map((x) => [
    x.personId, x.name, x.email, x.telefon, x.bestellungen, x.bezahlt, x.grund,
  ].map(feld).join(";"));
  writeFileSync("reports/test-aufraeumen.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  console.log("  Vorschau: reports/test-aufraeumen.csv\n");

  for (const x of kandidaten) {
    console.log(`  ${String(x.personId).padEnd(6)} ${x.name.slice(0, 22).padEnd(24)} `
      + `${String(x.bestellungen).padStart(2)} Best.  ${x.grund}`);
  }

  // Gegenprobe: Wie viele bezahlte Kunden hat die Regel ausgelassen? Diese
  // Zahl muss die Zahl der bezahlten Kunden sein, die auf ein Kennzeichen
  // passen — und sie muss vollständig verschont bleiben.
  const [geschuetzt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.payment_status = 'paid')
      AND (LOWER(TRIM(CONCAT_WS(' ', p.first_name, p.last_name))) = ANY(${k.namen})
        OR EXISTS (SELECT 1 FROM unnest(${k.domains}::text[]) d
                     WHERE LOWER(COALESCE(p.primary_email, '')) LIKE '%@' || d))
  `) as any[];
  console.log(`\n  Durch die Zahlungs-Grenze geschützt: ${geschuetzt.n} bezahlte Kunden passen auf ein `
    + "Kennzeichen und bleiben trotzdem unangetastet.");

  if (kandidaten.length === 0) { console.log("\n  Nichts zu tun.\n"); await sqlPool.end(); return; }
  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Markieren mit --schreiben.");
    console.log("  Rücknahme jederzeit über die Akte oder testMarkierungAufheben().\n");
    await sqlPool.end();
    return;
  }

  let n = 0;
  for (const x of kandidaten) {
    if (await alsTestMarkieren(x.personId, x.grund, "script:test-aufraeumen")) n++;
  }
  console.log(`\n  Markiert: ${n}. Sie fallen ab sofort aus Liste, Verteilung, Dubletten, `
    + "Kennzahlen und Mail-Zielgruppen — gelöscht wurde nichts.\n");
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nAbgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
