// ═══════════════════════════════════════════════════════════════════════════
// EINMAL-LAUF E-IT-D (08.10.2026, Punkt 4a) — Altbestand der Auskunft-Beschaffung
//
// Die neue Regel (beschaffungBeiEigenemUpload) greift ab dem Deploy: Kommt eine
// Auskunft auf anderem Weg in die Akte, während ein Beschaffungsauftrag offen
// ist, geht der Auftrag auf „Problem" mit dem Satz „Leistung klären" und einer
// Aufgabe. Für den ALTBESTAND (gemessen 08.10.: 3 offene Aufträge, bei denen
// das PDF längst in der Akte liegt) zieht dieser Lauf dieselbe Regel einmal nach.
//
// Er SCHICKT NICHTS an Kunden. Den Rückstand liefern (Datenkopie-Weg, Mail zur
// Auftragsbestätigung) ist ein Knopf für einen Menschen: Mara-Steuerpult ›
// Bonitätsauskunft › Beschaffung › „Auftragsbestätigung an alle offenen senden".
// Der Trockenlauf zählt nur mit, wie viele der Knopf heute träfe.
//
//   npx tsx scripts/it-d-einmal.ts                      Trockenlauf (Standard): Vorschau-CSV, nichts geschrieben
//   npx tsx scripts/it-d-einmal.ts --ausfuehren         schreibt — vorher Sicherung (JSON) und Rückweg-SQL
//   … --ordner=<pfad>                                   wohin Vorschau, Sicherung und Rückweg gehen (Standard: reports/)
//
// Rückweg: die erzeugte Datei it-d-einmal-rueckweg-<zeit>.sql (setzt Status und
// Notiz zurück, schließt die angelegten Aufgaben mit Vermerk — löscht nichts).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const AUSFUEHREN = process.argv.includes("--ausfuehren") || process.argv.includes("--schreiben");
const ordnerArg = process.argv.find((a) => a.startsWith("--ordner="))?.slice("--ordner=".length);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const ordner = path.resolve(ordnerArg || path.join(wurzel, "reports"));
const zeit = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL fehlt."); process.exit(1); }
const { sqlPool } = await import("../server/lib/db-pool");
const LI = await import("../server/lib/fiaon-auskunft-lieferung");

const [t] = (await sqlPool`SELECT to_regclass('fiaon_auskunft_beschaffung') IS NOT NULL AS da`) as any[];
if (!t?.da) { console.log("Keine Tabelle fiaon_auskunft_beschaffung — nichts zu tun."); await sqlPool.end(); process.exit(0); }

// 1. Die Fälle: offen/in Arbeit, aber eine Auskunft liegt schon in der Akte (an irgendeiner Bestellung der Person).
const faelle = (await sqlPool`
  SELECT b.id, b.ref, b.person_id, b.status, b.notiz, b.modus, b.quelle, b.updated_at,
         TRIM(CONCAT_WS(' ', p.first_name, p.last_name)) AS name,
         (SELECT MAX(d.documents_uploaded_at) FROM fiaon_applications d WHERE d.person_id = b.person_id AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL) AS dok_am
    FROM fiaon_auskunft_beschaffung b
    LEFT JOIN fiaon_persons p ON p.id = b.person_id
   WHERE b.status IN ('offen', 'in_arbeit')
     AND EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = b.person_id AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL)
   ORDER BY b.id`) as any[];

// 2. Nur zur Information: wen der Sammelknopf heute träfe (es wird NICHTS gesendet).
const liste = await LI.beschaffungListe();
const kandidaten = liste.filter((a) => LI.sammelKandidat(a).ja);

fs.mkdirSync(ordner, { recursive: true });
const csv = (zeilen: any[][]) => zeilen.map((z) => z.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
const vorschau = path.join(ordner, `it-d-einmal-vorschau-${zeit}.csv`);
fs.writeFileSync(vorschau, csv([
  ["teil", "auftrag", "ref", "person", "name", "status_vorher", "status_nachher", "auskunft_in_akte_seit", "modus", "quelle"],
  ...faelle.map((f) => ["eigene_auskunft", f.id, f.ref, f.person_id, f.name, f.status, "problem", f.dok_am ? new Date(f.dok_am).toISOString() : "", f.modus, f.quelle]),
  ...kandidaten.map((a) => ["nur_info_sammelknopf", a.id, a.ref, a.personId, a.kunde.name, a.status, "(unverändert — Knopf im Steuerpult)", "", a.modus, a.quelle]),
]));
console.log(`Offene Beschaffungsaufträge mit Auskunft schon in der Akte: ${faelle.length}`);
for (const f of faelle) console.log(`  #${f.id} ${f.ref} · ${f.name} · ${f.status} · Auskunft seit ${f.dok_am ? new Date(f.dok_am).toLocaleDateString("de-DE") : "?"}`);
console.log(`Nur zur Information — der Sammelknopf träfe heute: ${kandidaten.length} Aufträge (es wird nichts gesendet).`);
console.log(`Vorschau: ${vorschau}`);

if (!AUSFUEHREN) {
  console.log("\nTrockenlauf — nichts geschrieben. Zum Schreiben: --ausfuehren");
  await sqlPool.end();
  process.exit(0);
}

// 3. Sicherung und Rückweg VOR dem Schreiben.
const sicherung = path.join(ordner, `it-d-einmal-sicherung-${zeit}.json`);
fs.writeFileSync(sicherung, JSON.stringify(faelle.map((f) => ({ id: Number(f.id), ref: f.ref, person_id: Number(f.person_id), status: f.status, notiz: f.notiz, updated_at: f.updated_at })), null, 2));
const lit = (v: unknown) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const rueckweg = path.join(ordner, `it-d-einmal-rueckweg-${zeit}.sql`);
fs.writeFileSync(rueckweg, [
  "-- Rückweg zum Einmal-Lauf E-IT-D (4a). Löscht nichts: Status und Notiz zurück, Aufgaben mit Vermerk geschlossen.",
  "BEGIN;",
  "SET LOCAL lock_timeout = '5s';",
  ...faelle.map((f) => `UPDATE fiaon_auskunft_beschaffung SET status = ${lit(f.status)}, notiz = ${lit(f.notiz)}, updated_at = NOW() WHERE id = ${Number(f.id)} AND status = 'problem';`),
  ...faelle.map((f) => `UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, 'Rückweg Einmal-Lauf E-IT-D'), updated_at = NOW() WHERE schluessel = ${lit(`auskunft-eigene:${f.id}`)} AND status <> 'erledigt';`),
  "COMMIT;",
].join("\n") + "\n");
console.log(`Sicherung: ${sicherung}\nRückweg:   ${rueckweg}`);

// 4. Schreiben — je Person über DIESELBE Funktion wie der neue Upload-Weg (eine Regel).
let gesamt = 0;
for (const personId of Array.from(new Set(faelle.map((f) => Number(f.person_id))))) {
  const n = await LI.beschaffungBeiEigenemUpload(personId, "mitarbeiter", "Einmal-Lauf E-IT-D (Auskunft lag schon in der Akte)");
  gesamt += n;
}
console.log(`\nGeschrieben: ${gesamt} Aufträge auf „Problem — Leistung klären“, je eine Aufgabe an die Verantwortung.`);
await sqlPool.end();
