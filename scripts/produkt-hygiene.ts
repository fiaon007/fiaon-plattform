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
import { hygieneAusfuehren, hygieneFaelle } from "../server/lib/fiaon-produkt-hygiene";

const SCHREIBEN = process.argv.includes("--schreiben");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const datum = (v: unknown): string =>
  v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" }).format(new Date(String(v))) : "";

async function main(): Promise<void> {
  console.log("\n══ Produkt-Hygiene: ein Kunde, eine Stufe ══\n");

  // Die Regel selbst steht in `server/lib/fiaon-produkt-hygiene.ts` — dieselbe,
  // die die Massen-Zusammenführung je Gewinner anwendet. Dieses Skript ist die
  // Vorschau, die CSV und der Auslöser, nicht eine zweite Fassung der Regel.
  const faelle = await hygieneFaelle(null);

  const kopf = ["person_id", "kunde", "stilllegen_ref", "stilllegen_paket", "stilllegen_stand",
    "stilllegen_angelegt", "ersetzt_durch_ref", "ersetzt_durch_paket", "ersetzt_durch_stand", "ersetzt_durch_angelegt"];
  const zeilen = faelle.map((f) => [
    f.personId, f.kunde,
    f.stilllegen.ref, f.stilllegen.packName, f.stilllegen.status, datum(f.stilllegen.angelegt),
    f.behalten.ref, f.behalten.packName, f.behalten.status, datum(f.behalten.angelegt),
  ].map(feld).join(";"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/produkt-hygiene.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  const personen = new Set(faelle.map((f) => f.personId)).size;
  console.log(`  Personen mit mehr als einer offenen Stufe: ${personen}`);
  console.log(`  Stillzulegende Bestellungen:              ${faelle.length}`);
  console.log(`  Vorschau: reports/produkt-hygiene.csv\n`);
  for (const f of faelle) {
    console.log(`  Person ${String(f.personId).padEnd(6)} ${f.kunde.slice(0, 24).padEnd(26)} `
      + `${f.stilllegen.ref} (${f.stilllegen.status}, ${datum(f.stilllegen.angelegt)}) `
      + `→ ersetzt durch ${f.behalten.ref} (${datum(f.behalten.angelegt)})`);
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

  let stillgelegt: string[] = [];
  await sqlPool.begin(async (tx) => {
    stillgelegt = await hygieneAusfuehren(faelle, tx as any, "Produkt-Hygiene 08.08.2026");
  });

  console.log(`\n  Stillgelegt: ${stillgelegt.length} Bestellung(en). Nichts gelöscht, nichts bezahlt angefasst.`);
  console.log(`  Jede Stilllegung steht im Kundenverlauf und in fiaon_agent_events.\n`);
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[PRODUKT-HYGIENE]", err);
  process.exit(1);
});
