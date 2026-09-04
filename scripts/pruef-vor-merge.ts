// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND VOR JEDEM MERGE NACH main — FÜNF PRÜFUNGEN, JEDE EINZELN ROT-PROBEFÄHIG
//
// ── DER ANLASS ────────────────────────────────────────────────────────────
// Am 20.08.2026 brach der Deploy mit `sh: 1: eslint: not found`, exit 127 —
// ein Build-Werkzeug lag in devDependencies, und Render installiert die nicht.
// Der Push war grün, weil auf diesem Rechner alles liegt.
//
// ── WAS SIE PRÜFT ─────────────────────────────────────────────────────────
//   1  BAU        `npm ci --omit=dev` + `npm run build` in einer sauberen Kopie
//   2  MIGRATION  jede SQL-Migration trocken einspielen (Transaktion, Rollback)
//   3  BACKTICKS  keine Backticks in SQL- und CSS-Kommentaren
//   4  PROTOKOLL  jede agentensichtbare Änderung hat Einträge in CHANGELOG.md
//                 UND client/src/pages/agent/updates-data.ts
//   5  ROLLEN     jede Mitarbeiter-Rolle im Quelltext existiert (pruef-rollen.ts)
//
// ── WARUM JEDE EINZELN EINE ROT-PROBE HAT ─────────────────────────────────
// Eine Wand, von der man nicht weiß, ob sie greift, ist eine Behauptung. Die
// Rot-Probe baut den Schaden absichtlich ein und prüft, dass die Wand rot wird:
//
//   npx tsx scripts/pruef-vor-merge.ts
//   npx tsx scripts/pruef-vor-merge.ts --rot-probe          (alle fünf)
//   npx tsx scripts/pruef-vor-merge.ts --rot-probe=migration (nur eine)
//
// Prüfung 1 delegiert an `scripts/pruef-deploy.ts` — sie hat ihre eigene
// Rot-Probe und ist dort begründet. Eine zweite Fassung hier wäre die zweite
// Wahrheit über denselben Bau.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const ROT_ALLE = process.argv.includes("--rot-probe");
const ROT_EINE = (process.argv.find((a) => a.startsWith("--rot-probe=")) ?? "").split("=")[1] ?? "";
const NUR = (process.argv.find((a) => a.startsWith("--nur=")) ?? "").split("=")[1] ?? "";
const rot = (name: string) => ROT_ALLE || ROT_EINE === name;

let ok = 0;
let nichtOk = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { nichtOk++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `\n        → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

// ═══════════════════════════════════════════════════════════════════════════
// 1 — DER BAU
// ═══════════════════════════════════════════════════════════════════════════
function pruefeBau(): void {
  titel("1 — DER BAU IN EINER SAUBEREN KOPIE (npm ci --omit=dev && npm run build)");
  if (rot("bau")) {
    console.log("  ROT-PROBE: übersprungen — `pruef-deploy.ts --rot-probe` hat ihre eigene.");
    console.log("             Sie verschiebt ein Werkzeug in devDependencies und prüft, dass");
    console.log("             der Bau bricht. Hier zweimal dasselbe zu tun wäre die zweite Wand.");
    return;
  }
  try {
    execSync("npx tsx scripts/pruef-deploy.ts", { stdio: "pipe", encoding: "utf-8" });
    pruef("Der Bau läuft durch — Render wird durchlaufen", true);
  } catch (e: any) {
    const aus = String(e?.stdout ?? "") + String(e?.stderr ?? "");
    pruef("Der Bau läuft durch — Render wird durchlaufen", false,
      aus.split("\n").filter((z) => /ROT|FAIL|error/i.test(z)).slice(0, 4).join(" | ")
      || "pruef-deploy.ts ist rot geworden");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — DIE MIGRATIONEN, TROCKEN
//
// Jede Migration läuft in einer Transaktion, die am Ende ZURÜCKGEROLLT wird.
// Damit ist bewiesen, dass PostgreSQL sie annimmt — ohne dass sie wirkt.
//
// ── WARUM DAS NÖTIG IST ─────────────────────────────────────────────────
// `run-migrations.mjs` läuft beim Start von `npm start`. Eine Migration mit
// einem Syntaxfehler bricht also den DEPLOY, nicht den Push. Am 21.08.2026
// hätte ein Tippfehler in 072 den Dienst nicht mehr starten lassen.
// ═══════════════════════════════════════════════════════════════════════════
async function pruefeMigrationen(): Promise<void> {
  titel("2 — MIGRATIONEN TROCKEN EINSPIELEN (Transaktion, dann Rollback)");
  const ordner = "db/migrations";
  const dateien = readdirSync(ordner).filter((f) => f.endsWith(".sql")).sort();

  // Welche sind schon eingespielt? Die müssen nicht noch einmal prüfen — und
  // eine alte Migration, die heute nicht mehr durchläuft (weil die Tabelle
  // inzwischen anders aussieht), wäre ein Fehlalarm.
  // ── DIE TABELLE HEISST `schema_migrations`, SPALTE `filename` ─────────
  // Der erste Entwurf fragte `fiaon_migrations.name` — die gibt es nicht. Das
  // `.catch(() => [])` machte daraus eine leere Menge, und die Wand prüfte
  // ALLE 73 Migrationen statt der offenen. Ergebnis: drei alte, nicht
  // wiederholbare Migrationen wurden rot, und die Wand hätte jeden Merge
  // blockiert — mit einem Befund, der nichts mit der Änderung zu tun hat.
  //
  // Genau die Fehlerklasse dieser Sitzung: ein `.catch`, das einen Irrtum in
  // ein plausibles Ergebnis verwandelt. Deshalb wird der Fehler hier GENANNT.
  const angewandt = new Set(((await sqlPool`
    SELECT filename FROM schema_migrations
  `.catch((e) => {
    console.error("  ---   schema_migrations nicht lesbar — es werden ALLE Migrationen "
      + "geprüft, auch längst eingespielte:", e?.message ?? e);
    return [];
  })) as any[]).map((r) => String(r.filename)));

  // ── ZERSTÖRENDES IST KEINE OFFENE ARBEIT ────────────────────────────
  // `run-migrations.mjs` verweigert Migrationen mit DROP/TRUNCATE dauerhaft.
  // `006_service_orders.sql` steht deshalb seit Monaten „offen" und wird es
  // bleiben. Sie als offene Arbeit zu zählen, hätte die Wand jeden Merge
  // blockieren lassen — mit einem Befund von vor einem halben Jahr.
  const zerstoerend = (f: string) =>
    /\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE|DROP\s+COLUMN)\b/i
      .test(readFileSync(`${ordner}/${f}`, "utf-8"));
  const offen = dateien.filter((f) => !angewandt.has(f) && !zerstoerend(f));
  const verweigert = dateien.filter((f) => !angewandt.has(f) && zerstoerend(f));
  if (verweigert.length > 0) {
    console.log(`  ---   ${verweigert.length} zerstörend und dauerhaft verweigert: `
      + verweigert.join(", "));
  }
  console.log(`  ${dateien.length} Migrationen, ${angewandt.size} eingespielt, ${offen.length} offen`);

  if (rot("migration")) {
    // ── DIE ROT-PROBE ──────────────────────────────────────────────────
    // Eine absichtlich kaputte Anweisung. Bleibt die Prüfung grün, prüft sie
    // die Syntax nicht wirklich.
    const kaputt = "ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXIST rotprobe INT;";
    let gebrochen = false;
    await sqlPool.begin(async (tx) => {
      await tx.unsafe(kaputt).catch(() => { gebrochen = true; });
      throw new Error("ROLLBACK");
    }).catch((e) => { if (String(e.message) !== "ROLLBACK") gebrochen = true; });
    pruef("ROT-PROBE: eine kaputte Migration wird abgelehnt", gebrochen,
      "PostgreSQL hat den Syntaxfehler durchgelassen — dann prüft diese Wand nichts");
  }

  if (offen.length === 0) {
    pruef("Alle Migrationen sind eingespielt — nichts trocken zu prüfen", true);
    return;
  }
  // ── EIN ABSCHNITT OHNE PRÜFUNG IST KEIN GRÜN ────────────────────────
  // Sind alle offenen Migrationen zerstörend (und damit übersprungen), stand
  // hier „0 ok, 0 rot" — und das las sich wie Erfolg. Ein Abschnitt, der
  // nichts geprüft hat, muss es SAGEN.
  let geprueft = 0;
  for (const f of offen) {
    const sql = readFileSync(`${ordner}/${f}`, "utf-8");
    let grund: string | null = null;
    await sqlPool.begin(async (tx) => {
      await tx.unsafe(sql);
      throw new Error("ROLLBACK");
    }).catch((e) => { if (String(e.message) !== "ROLLBACK") grund = String(e?.message ?? e).slice(0, 200); });
    pruef(`${f} läuft durch`, grund === null, grund ?? "");
    geprueft++;
  }
  if (geprueft === 0) {
    pruef("Mindestens eine offene Migration wurde trocken geprüft", false,
      `${offen.length} offen, aber alle zerstörend und damit übersprungen — `
      + "dieser Abschnitt hat NICHTS geprüft. Das ist kein Grün.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — BACKTICKS IN SQL- UND CSS-KOMMENTAREN
// ═══════════════════════════════════════════════════════════════════════════
function pruefeBackticks(): void {
  titel("3 — BACKTICKS IN SQL- UND CSS-KOMMENTAREN");
  if (rot("backticks")) {
    // Der Schaden nachgestellt: eine Zeile, wie sie am 08. und 17.08.2026
    // dreimal im Repo stand.
    const beispiel = 'const q = sql`SELECT 1 -- ein `wort` in Backticks\n`;';
    const findet = /--[^\n]*`/.test(beispiel);
    pruef("ROT-PROBE: ein Backtick in einem SQL-Kommentar wird gefunden", findet,
      "das Muster erkennt den Schaden nicht, der dreimal passiert ist");
  }
  try {
    const aus = execSync("npx tsx scripts/pruef-backticks.ts", { stdio: "pipe", encoding: "utf-8" });
    // `pruef-backticks.ts` meldet im Erfolgsfall „Keiner." bzw. „Keine."
    const sauber = /Keiner\.|Keine\.|Alle übersetzen sich/.test(aus);
    pruef("Keine Backticks in SQL-Kommentaren, alle Dateien übersetzen sich", sauber,
      aus.split("\n").slice(-6).join(" | "));
  } catch (e: any) {
    pruef("Keine Backticks in SQL-Kommentaren, alle Dateien übersetzen sich", false,
      String(e?.stdout ?? e?.message ?? "").split("\n").slice(-5).join(" | "));
  }

  // CSS-Kommentare: `/* … ` … */` in Template-Literalen. Dieselbe Falle, nur
  // in den Stil-Blöcken der Oberfläche (`const CSS = \`…\``).
  const dateien = execSync("git ls-files 'client/src/**/*.tsx' 'client/src/**/*.ts'",
    { encoding: "utf-8" }).split("\n").filter(Boolean);
  const treffer: string[] = [];
  for (const d of dateien) {
    const zeilen = readFileSync(d, "utf-8").split("\n");
    let imCss = false;
    zeilen.forEach((z, i) => {
      if (/^(const|export const)\s+\w*(CSS|_CSS)\b/.test(z.trim())) imCss = true;
      else if (imCss && /^`;\s*$/.test(z.trim())) imCss = false;
      // Ein Backtick in einem CSS-Kommentar beendet das Template-Literal.
      if (imCss && /\/\*[^*]*`/.test(z)) treffer.push(`${d}:${i + 1}`);
    });
  }
  pruef("Keine Backticks in CSS-Kommentaren", treffer.length === 0, treffer.slice(0, 5).join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — HAT JEDE AGENTENSICHTBARE ÄNDERUNG IHRE EINTRÄGE?
//
// ── DIE HAUSREGEL ───────────────────────────────────────────────────────
// AGENTS.md: Jede Änderung bekommt einen CHANGELOG.md-Eintrag im SELBEN
// Commit. Ist sie für Agenten sichtbar, kommt ein Eintrag in
// `client/src/pages/agent/updates-data.ts` dazu.
//
// ── WAS „AGENTENSICHTBAR" HEISST ────────────────────────────────────────
// Eine Änderung unter `client/src/pages/agent/` oder an einer Komponente, die
// das Team benutzt (Softphone, ErgebnisWahl, agent/*). Serverdateien allein
// zählen nicht: Ein Sperrgrund, der sich ändert, ist sichtbar — aber das
// zeigt sich immer auch in einer Client-Datei.
// ═══════════════════════════════════════════════════════════════════════════
function pruefeProtokoll(): void {
  titel("4 — CHANGELOG UND AGENTEN-EINTRAG");
  const basis = process.env.PRUEF_BASIS_REF || "origin/main";
  let geaendert: string[];
  try {
    geaendert = execSync(`git diff --name-only ${basis}...HEAD`, { encoding: "utf-8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    // Ohne Vergleichspunkt (frischer Klon in CI) nimmt sie den letzten Commit.
    geaendert = execSync("git diff --name-only HEAD~1...HEAD", { encoding: "utf-8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  }
  // ── AUCH DAS, WAS NOCH NICHT EINGECHECKT IST ──────────────────────────
  // In der CI vergleicht `git diff origin/main...HEAD` den Zweig — dort ist
  // alles eingecheckt. Auf dem Rechner eines Menschen läuft die Wand VOR dem
  // Commit; dann ist der Vergleich leer, und die Prüfung wurde rot, obwohl
  // zwanzig Dateien geändert waren. Eine Wand, die vor dem Commit immer rot
  // ist, wird beim zweiten Mal umgangen.
  const offeneArbeit = execSync("git status --porcelain", { encoding: "utf-8" })
    .split("\n").map((z) => z.slice(3).trim()).filter(Boolean);
  for (const f of offeneArbeit) if (!geaendert.includes(f)) geaendert.push(f);

  if (geaendert.length === 0) {
    pruef("Es gibt Änderungen zu prüfen", false,
      `Weder gegen ${basis} noch im Arbeitsverzeichnis eine Änderung — `
      + "dann prüft dieser Schritt nichts");
    return;
  }
  console.log(`  ${geaendert.length} Dateien geändert gegenüber ${basis}`);

  const AGENT_SICHTBAR = /^client\/src\/(pages\/agent\/|components\/(Softphone|AnrufPlayer|agent\/))/;
  const sichtbar = geaendert.filter((f) => AGENT_SICHTBAR.test(f)
    && !f.endsWith("updates-data.ts"));

  const hatChangelog = geaendert.includes("CHANGELOG.md");
  const hatUpdates = geaendert.includes("client/src/pages/agent/updates-data.ts");

  if (rot("protokoll")) {
    // Der Schaden: eine agentensichtbare Datei ohne Einträge.
    const probeSichtbar = ["client/src/pages/agent/kunden-neu.tsx"];
    const probeGeaendert = [...probeSichtbar];
    const wuerdeRot = probeSichtbar.length > 0
      && (!probeGeaendert.includes("CHANGELOG.md")
        || !probeGeaendert.includes("client/src/pages/agent/updates-data.ts"));
    pruef("ROT-PROBE: eine Agenten-Änderung ohne Einträge wird gefunden", wuerdeRot,
      "die Ableitung erkennt den Fall nicht");
  }

  pruef("CHANGELOG.md ist mitgeändert", hatChangelog,
    "AGENTS.md: jede Änderung bekommt einen Eintrag im SELBEN Commit");
  if (sichtbar.length === 0) {
    pruef("Keine agentensichtbare Änderung — updates-data.ts nicht nötig", true);
  } else {
    pruef(`updates-data.ts ist mitgeändert (${sichtbar.length} Agenten-Dateien betroffen)`,
      hatUpdates,
      `betroffen: ${sichtbar.slice(0, 4).join(", ")}${sichtbar.length > 4 ? " …" : ""}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — MITARBEITER-ROLLEN IM QUELLTEXT
//
// ── DER SCHADEN (04.09.2026) ─────────────────────────────────────────────
// `rolle IN ('vertriebsleitung', 'leitung', 'admin')` — zwei Rollen, die es
// nicht gibt. Die Abfrage traf null Zeilen, kompilierte einwandfrei, und
// Postmeister-Aufgaben für Kunden ohne Betreuer landeten unsichtbar beim
// Betreiber. Kompilieren beweist bei einem Textwert nichts.
//
// Die Prüfung selbst steht in `scripts/pruef-rollen.ts` — mit eigener
// Rot-Probe und der Begründung, was sie absichtlich NICHT liest. Hier nur
// der Aufruf; eine zweite Fassung wäre die zweite Wahrheit.
// ═══════════════════════════════════════════════════════════════════════════
function pruefeRollen(): void {
  titel("5 — JEDE MITARBEITER-ROLLE IM QUELLTEXT EXISTIERT (scripts/pruef-rollen.ts)");
  const lauf = (args: string) => execSync(`npx tsx scripts/pruef-rollen.ts ${args}`.trim(),
    { stdio: "pipe", encoding: "utf-8" });
  const letzte = (aus: string) => aus.split("\n").filter((z) => /FAIL|PASS/.test(z)).slice(-4).join(" | ");
  if (rot("rollen")) {
    // Die Rot-Probe von pruef-rollen.ts baut die zwei Zeilen vom 04.09.2026
    // nach und prüft dazu, dass Gesprächs-Rollen („kunde") NICHT rot werden.
    try { lauf("--rot-probe"); pruef("ROT-PROBE: 'vertriebsleitung' und 'leitung' werden gefunden, „kunde“ nicht", true); }
    catch (e: any) {
      pruef("ROT-PROBE: 'vertriebsleitung' und 'leitung' werden gefunden, „kunde“ nicht", false,
        letzte(String(e?.stdout ?? e?.message ?? "")));
    }
  }
  try { lauf(""); pruef("Jede Rolle in server/ steht in der Liste — und die Datenbank kennt keine andere", true); }
  catch (e: any) {
    pruef("Jede Rolle in server/ steht in der Liste — und die Datenbank kennt keine andere", false,
      letzte(String(e?.stdout ?? e?.message ?? "")) || "pruef-rollen.ts ist rot geworden");
  }
}

async function main(): Promise<void> {
  console.log("\n══ Wand vor dem Merge nach main ══");
  if (NUR) console.log(`  (nur „${NUR}")`);
  if (!NUR || NUR === "bau") pruefeBau();
  if (!NUR || NUR === "migration") await pruefeMigrationen();
  if (!NUR || NUR === "backticks") pruefeBackticks();
  if (!NUR || NUR === "protokoll") pruefeProtokoll();
  if (!NUR || NUR === "rollen") pruefeRollen();

  console.log(`\n══ ${ok} ok, ${nichtOk} rot ══`);
  if (nichtOk > 0) {
    console.log("\n  ROT:");
    for (const f of fehler) console.log(`    · ${f}`);
    console.log("\n  NICHT nach main mergen, bevor das behoben ist.");
  } else {
    console.log("  Der Merge ist sicher. Das ist keine Vermutung, sondern derselbe Weg.");
  }
  await sqlPool.end();
  process.exit(nichtOk > 0 ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
