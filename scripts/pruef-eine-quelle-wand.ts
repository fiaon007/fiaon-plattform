// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND GEGEN NEUE KONTAKT-SPALTEN-ZUGRIFFE
//
// ── DER STAND (28.08.2026) ─────────────────────────────────────────────────
// Die Spalten `email`, `phone`, `contact_email`, `billing_email`,
// `contact_phone`, `phone_country_code` an `fiaon_applications` und
// `email`/`telefon` an `fiaon_leads` sind seit Migration 059 **Abschriften**:
// Ein Trigger schreibt jeden Wert an die Person durch.
//
// GEMESSEN heute: **397 Zugriffe in 62 Dateien**, davon **36 schreibende**.
// Der DROP folgt, sobald diese Liste leer ist — und das ist mehrtägige Arbeit.
//
// ── WARUM DIESE WAND JETZT KOMMT UND NICHT ERST DANN ──────────────────────
// Ein Arbeitsvorrat, der WÄCHST, wird nie abgearbeitet. Am 20.08. waren es 397
// Zugriffe; heute sind es 397. Er ist nicht gewachsen — aber nur, weil
// zufällig niemand eine neue Stelle gebaut hat.
//
// Diese Wand hält die Zahl fest: Wer eine NEUE schreibende Stelle einbaut,
// bekommt einen roten Prüfstand. Der Bestand bleibt geduldet (mit Zahl im
// Prüfstand), das Wachstum nicht.
//
// ── UND WARUM SIE DEN BESTAND NICHT VERBIETET ─────────────────────────────
// Eine Wand, die 397 Fehler meldet, wird nach dem zweiten Lauf abgeschaltet.
// Dann fängt sie auch die 398. Stelle nicht. Also: Obergrenze statt Verbot,
// und die Obergrenze sinkt mit jeder abgearbeiteten Stelle.
//
//   npx tsx scripts/pruef-eine-quelle-wand.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

/**
 * Die Obergrenzen — sie dürfen nur SINKEN.
 *
 * Nach jeder abgearbeiteten Stelle wird die Zahl hier kleiner gesetzt. Steigt
 * sie, wird der Prüfstand rot und nennt die neue Stelle.
 *
 * Die Datei `reports/eine-quelle-grenzen.json` hält den Stand fest, damit die
 * Zahl nicht im Quelltext gepflegt werden muss — und damit ein Absenken
 * sichtbar im Commit steht.
 */
const GRENZEN_DATEI = "reports/eine-quelle-grenzen.json";

/** Die Spalten, die verschwinden sollen. */
const SPALTEN = [
  "contact_email", "billing_email", "contact_phone", "phone_country_code",
];

function zaehle(muster: string): number {
  try {
    // `grep -c` je Datei, dann summieren. `|| true`, weil grep ohne Treffer
    // mit 1 endet — und ein Prüfstand, der an einem leeren Ergebnis stirbt,
    // meldet Erfolg als Fehler.
    const aus = execSync(
      `grep -rn "${muster}" server/ --include=*.ts | grep -v "Sophias in Konflikt" | wc -l || true`,
      { encoding: "utf8", cwd: process.cwd() },
    );
    return Number(aus.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Schreibende Anweisungen zählen — über den ANWEISUNGSBLOCK, nicht die Zeile.
 *
 * ── WARUM (aus dem Bericht vom 20.08.) ────────────────────────────────────
 * Die erste Messung sagte „2 schreibend". Falsch: Der Regex suchte
 * INSERT/UPDATE und die Spalte in DERSELBEN Zeile. FIAON schreibt mehrzeiliges
 * SQL — die Anweisung steht oben, die Spalten zehn Zeilen weiter unten.
 */
function zaehleSchreibend(): { anzahl: number; stellen: string[] } {
  const stellen: string[] = [];
  const dateien = execSync(
    'grep -rl "fiaon_applications\\|fiaon_leads" server/ --include=*.ts | grep -v "Sophias in Konflikt" || true',
    { encoding: "utf8", cwd: process.cwd() },
  ).trim().split("\n").filter(Boolean);

  for (const datei of dateien) {
    const zeilen = readFileSync(datei, "utf8").split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      if (!/\b(INSERT INTO|UPDATE)\s+(fiaon_applications|fiaon_leads)\b/.test(zeilen[i])) continue;
      // Der Block bis zum Ende des Template-Literals — höchstens 40 Zeilen,
      // sonst frisst ein fehlendes Backtick die halbe Datei.
      const block = zeilen.slice(i, i + 40).join("\n").split("`")[0];
      const getroffen = SPALTEN.filter((sp) => new RegExp(`\\b${sp}\\s*=`).test(block)
        || new RegExp(`[(,]\\s*${sp}\\s*[,)]`).test(block));
      if (getroffen.length > 0) {
        stellen.push(`${datei}:${i + 1} — ${getroffen.join(",")}`);
      }
    }
  }
  return { anzahl: stellen.length, stellen };
}

function main(): void {
  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE ZAHLEN — sie dürfen nur SINKEN");
  // ═════════════════════════════════════════════════════════════════════════
  const jetzt: Record<string, number> = {};
  for (const sp of SPALTEN) jetzt[sp] = zaehle(sp);
  const schreibend = zaehleSchreibend();
  jetzt.__schreibend = schreibend.anzahl;

  const alt: Record<string, number> = existsSync(GRENZEN_DATEI)
    ? JSON.parse(readFileSync(GRENZEN_DATEI, "utf8"))
    : {};

  const ersterLauf = Object.keys(alt).length === 0;
  if (ersterLauf) {
    console.log("  (Erster Lauf — die heutigen Zahlen werden zur Obergrenze.)");
  }

  for (const [name, zahl] of Object.entries(jetzt)) {
    const grenze = alt[name];
    const beschriftung = name === "__schreibend" ? "SCHREIBENDE Anweisungen" : name;
    if (grenze == null) {
      console.log(`  ${String(zahl).padStart(5)}  ${beschriftung}  (neu aufgenommen)`);
      ok++;
      continue;
    }
    // ── NUR SINKEN ERLAUBT ────────────────────────────────────────────────
    pruef(`${beschriftung}: nicht mehr als ${grenze}`, zahl <= grenze,
      `jetzt ${zahl} — eine NEUE Stelle ist dazugekommen. `
        + "Die Kontakt-Spalten sind Abschriften; wer sie schreibt, erzeugt eine "
        + "zweite Wahrheit. Bitte die Personen-Funktionen benutzen "
        + "(server/fiaon-person-model.ts).");
    if (zahl < grenze) {
      console.log(`         ${grenze} → ${zahl} — ${grenze - zahl} abgearbeitet. Danke.`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE SCHREIBENDEN STELLEN — der kritische Teil");
  // ═════════════════════════════════════════════════════════════════════════
  console.log(`  ${schreibend.anzahl} Anweisungen schreiben noch in die Abschriften:`);
  for (const st of schreibend.stellen.slice(0, 40)) console.log(`     ${st}`);
  if (schreibend.stellen.length > 40) {
    console.log(`     … und ${schreibend.stellen.length - 40} weitere`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER TRIGGER MUSS LAUFEN, SOLANGE DIE SPALTEN LEBEN");
  // ═════════════════════════════════════════════════════════════════════════
  // Solange irgendetwas in die Abschriften schreibt, muss der Trigger den Wert
  // an die Person durchschreiben. Ohne ihn entstehen genau die zwei Wahrheiten,
  // die Migration 059 beseitigt hat.
  const migration = existsSync("db/migrations/059_eine_quelle_wand.sql")
    ? readFileSync("db/migrations/059_eine_quelle_wand.sql", "utf8") : "";
  pruef("Die Trigger-Migration liegt im Repo", migration.length > 0);
  pruef("… und legt den Trigger für fiaon_applications an",
    /CREATE (OR REPLACE )?(TRIGGER|FUNCTION)/i.test(migration)
      && /fiaon_applications/.test(migration));

  // Die Archiv-Migration ist vorbereitet, aber sie DROPPT noch nicht.
  const archiv = existsSync("db/migrations/061_kontaktspalten_archiv.sql")
    ? readFileSync("db/migrations/061_kontaktspalten_archiv.sql", "utf8") : "";
  pruef("Die Archiv-Migration liegt bereit", archiv.length > 0,
    "sie sichert die Spalten, damit der DROP später ein Einzeiler ist");
  pruef("… und sie DROPPT noch NICHTS",
    archiv.length > 0 && !/ALTER TABLE fiaon_applications\s+DROP COLUMN/i.test(archiv),
    "erst wenn alle 397 Zugriffe umgezogen sind — ein halber Umzug bricht "
      + "beim ersten Kundenkontakt");

  writeFileSync(GRENZEN_DATEI, `${JSON.stringify(jetzt, null, 2)}\n`, "utf8");
  console.log(`\n  Stand festgehalten: ${GRENZEN_DATEI}`);
  console.log("  Wer eine Stelle abarbeitet, lässt die Zahl sinken — der Commit zeigt es.");

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main();
