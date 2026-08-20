// ═══════════════════════════════════════════════════════════════════════════
// WAND: WAS RENDER TUT, HIER TUN — VOR DEM PUSH
//
// ── DER SCHADEN (20.08.2026) ───────────────────────────────────────────────
// Der Deploy brach mit „sh: 1: eslint: not found", exit 127. Vorausgegangen war
// ein `npm install --save-dev eslint …` und ein `npm run build`, der auf diesem
// Rechner grün war — weil hier ein `node_modules` mit ALLEN Paketen liegt.
//
// Render installiert die devDependencies nicht. Das steht nirgends
// geschrieben, ist aber an der package.json ABLESBAR: `vite`, `esbuild`,
// `typescript`, `@vitejs/plugin-react` und `playwright` stehen alle in
// `dependencies`. Wer das misst, bevor er installiert, macht den Fehler nicht.
// Ich habe es nicht gemessen.
//
// ── WAS DIESER LAUF TUT ───────────────────────────────────────────────────
// Er baut das Projekt in einer SAUBEREN KOPIE nach, mit genau den Paketen, die
// Render bekommt:
//
//   1. Nur die Dateien, die in git liegen (`git ls-files`) — kein node_modules,
//      keine .env, kein lokaler Zwischenstand.
//   2. `npm ci --omit=dev` mit NODE_ENV=production.
//   3. `npm run build`.
//
// Läuft das durch, läuft Render durch. „Läuft bei mir" ist danach kein Argument
// mehr, sondern eine überprüfbare Aussage.
//
// ── ER DAUERT ─────────────────────────────────────────────────────────────
// Zwei bis vier Minuten, das meiste davon `npm ci`. Das ist der Preis dafür,
// einen kaputten Deploy VOR dem Push zu sehen statt danach — und ein kaputter
// Deploy kostet das Team einen halben Tag.
//
//   npx tsx scripts/pruef-deploy.ts
//   npx tsx scripts/pruef-deploy.ts --rot-probe   (prüft, dass die Wand greift)
// ═══════════════════════════════════════════════════════════════════════════
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const lauf = promisify(execFile);
const ROT_PROBE = process.argv.includes("--rot-probe");

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `\n        → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }

/** Sekunden seit einem Zeitpunkt, für die Geduld des Lesers. */
function seit(t: number): string { return `${Math.round((Date.now() - t) / 1000)} s`; }

async function main(): Promise<void> {
  log("\n══ Deploy-Probe: was Render tut ══");
  const wurzel = process.cwd();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Werkzeuge des Builds stehen an der richtigen Stelle");
  // ═════════════════════════════════════════════════════════════════════════
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const dep: Record<string, string> = pkg.dependencies ?? {};
  const dev: Record<string, string> = pkg.devDependencies ?? {};
  const bauBefehl = String(pkg.scripts?.build ?? "");
  log(`        build: ${bauBefehl.slice(0, 96)}…`);

  // ── WELCHE WERKZEUGE RUFT DER BUILD? ────────────────────────────────────
  // Aus dem Befehl gelesen, nicht aus einer Liste, die veraltet: Wer morgen ein
  // Werkzeug ergänzt, wird von dieser Prüfung automatisch mitgenommen.
  // `npx`, `npm` und `node` sind KEINE Pakete — sie kommen mit der Laufzeit.
  // Der erste Lauf hat `npx` als fehlendes Werkzeug gemeldet: ein Fehlalarm,
  // und Fehlalarme sind der Anfang vom Ende einer Wand. Hinter `npx` steht das
  // eigentliche Werkzeug, also wird eins weitergelesen.
  const LAUFZEIT = new Set(["npm", "npx", "node", "cd", "rm", "cp", "mkdir", "bash", "sh"]);
  function werkzeugAus(befehl: string): string | null {
    const teile = befehl.trim().split(/\s+/).filter((x) => !x.startsWith("-"));
    for (const t of teile) {
      if (!LAUFZEIT.has(t)) return t;
      // `npx playwright …` → playwright. `npm run x` wird oben aufgelöst.
      if (t === "npm") return null;
    }
    return null;
  }
  const teilBefehle = bauBefehl.split(/&&|\|\|/).map((t) => t.trim()).filter(Boolean);
  const werkzeuge = new Set<string>();
  for (const t of teilBefehle) {
    if (/^npm\s+run\s+/.test(t)) {
      const unter = t.split(/\s+/)[2];
      const w = werkzeugAus(String(pkg.scripts?.[unter] ?? ""));
      if (w) werkzeuge.add(w);
      continue;
    }
    const w = werkzeugAus(t);
    if (w) werkzeuge.add(w);
  }
  log(`        Werkzeuge im Build: ${[...werkzeuge].join(", ")}`);
  for (const w of werkzeuge) {
    const inDep = w in dep;
    const inDev = w in dev;
    ok(`\`${w}\` steht in dependencies`, inDep,
      inDev
        ? `steht in devDependencies — Render installiert die NICHT (npm ci --omit=dev). `
          + `Genau daran ist der Deploy am 20.08.2026 gescheitert.`
        : "steht in keiner der beiden Listen");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Der Bau in einer sauberen Kopie");
  // ═════════════════════════════════════════════════════════════════════════
  const kopie = mkdtempSync(join(tmpdir(), "fiaon-deploy-"));
  let erfolg = false;
  try {
    // ── NUR, WAS IN GIT LIEGT ─────────────────────────────────────────────
    // `git ls-files` ist die einzige ehrliche Quelle: Render bekommt genau das
    // und nichts sonst. Ein `cp -r` würde node_modules, .env und jeden
    // ungespeicherten Zwischenstand mitnehmen — und damit das Gegenteil prüfen.
    const t0 = Date.now();
    await lauf("bash", ["-c",
      `cd ${JSON.stringify(wurzel)} && git ls-files -z | tar --null -T - -cf - | `
      + `(cd ${JSON.stringify(kopie)} && tar xf -)`], { maxBuffer: 64 * 1024 * 1024 });
    ok("Die Kopie enthält nur, was in git liegt",
      existsSync(join(kopie, "package.json")) && !existsSync(join(kopie, "node_modules")),
      "node_modules ist mitgekommen — dann prüft der Lauf nichts");
    log(`        Kopie in ${seit(t0)}: ${kopie}`);

    // ── DIE ROT-PROBE ─────────────────────────────────────────────────────
    // Sie verschiebt ein Build-Werkzeug in die devDependencies — also genau den
    // Fehler vom 20.08. Danach MUSS der Bau scheitern. Sie wirkt nur in der
    // Kopie; das Repo bleibt unberührt.
    if (ROT_PROBE) {
      const opfer = "eslint";
      const p = join(kopie, "package.json");
      const k = JSON.parse(readFileSync(p, "utf8"));
      k.devDependencies = { ...(k.devDependencies ?? {}), [opfer]: k.dependencies[opfer] };
      delete k.dependencies[opfer];
      writeFileSync(p, JSON.stringify(k, null, 2));

      // ── DER LOCK MUSS MIT ─────────────────────────────────────────────
      // Erster Entwurf änderte nur die package.json. Die Rot-Probe blieb
      // GRÜN — der Bau lief durch, obwohl eslint angeblich devDependency war.
      //
      // Grund: `npm ci --omit=dev` entscheidet anhand des LOCKS. Dort steht je
      // Paket ein `"dev": true/false`, und das stand weiter auf false. Das ist
      // keine Kleinigkeit, sondern der Kern der Sache: Wer `npm install
      // --save-dev` ausführt, ändert BEIDE Dateien — und erst dann fällt das
      // Paket bei Render weg. Eine Rot-Probe, die nur die eine Datei anfasst,
      // stellt den Schaden nicht nach.
      const lp = join(kopie, "package-lock.json");
      const lock = JSON.parse(readFileSync(lp, "utf8"));
      const eintrag = lock.packages?.[`node_modules/${opfer}`];
      if (eintrag) eintrag.dev = true;
      if (lock.packages?.[""]?.dependencies?.[opfer]) {
        lock.packages[""].devDependencies = {
          ...(lock.packages[""].devDependencies ?? {}),
          [opfer]: lock.packages[""].dependencies[opfer],
        };
        delete lock.packages[""].dependencies[opfer];
      }
      writeFileSync(lp, JSON.stringify(lock, null, 2));
      log(`        ROT-PROBE: \`${opfer}\` in der Kopie nach devDependencies verschoben`);
      log(`        (package.json UND package-lock.json — sonst wirkt es nicht).`);
    }

    // ── npm ci --omit=dev, wie Render ─────────────────────────────────────
    const t1 = Date.now();
    let ciFehler = "";
    try {
      await lauf("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
        cwd: kopie, env: { ...process.env, NODE_ENV: "production" },
        maxBuffer: 64 * 1024 * 1024, timeout: 600_000,
      });
    } catch (e: any) {
      ciFehler = (String(e?.stderr ?? "") + String(e?.stdout ?? "")).slice(-700);
    }
    ok("`npm ci --omit=dev` läuft durch", ciFehler === "", ciFehler);
    log(`        Installation in ${seit(t1)}`);

    // ── npm run build, wie Render ─────────────────────────────────────────
    if (ciFehler === "") {
      const t2 = Date.now();
      let bauFehler = "";
      let ausgabe = "";
      try {
        const r = await lauf("npm", ["run", "build"], {
          cwd: kopie, env: { ...process.env, NODE_ENV: "production" },
          maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
        });
        ausgabe = String(r.stdout ?? "");
      } catch (e: any) {
        bauFehler = (String(e?.stdout ?? "") + String(e?.stderr ?? "")).slice(-900);
      }
      ok("`npm run build` läuft durch", bauFehler === "", bauFehler);
      log(`        Bau in ${seit(t2)}`);
      if (bauFehler === "") {
        ok("Der gebaute Client liegt vor",
          existsSync(join(kopie, "dist", "public", "index.html")));
        ok("Der gebaute Server liegt vor", existsSync(join(kopie, "dist", "index.js")));
        const module = ausgabe.match(/(\d+) modules transformed/);
        if (module) log(`        ${module[1]} Module übersetzt.`);
        erfolg = true;
      }
    }
  } finally {
    // Immer aufräumen — auch wenn eine Prüfung fällt. Ein Aufräumen, das nur im
    // Erfolgsfall läuft, läuft nie (AGENTS.md).
    rmSync(kopie, { recursive: true, force: true });
    log(`        Kopie entfernt.`);
  }

  if (ROT_PROBE) {
    log("");
    if (erfolg) {
      log("  ROT-PROBE FEHLGESCHLAGEN: Der Bau lief trotz verschobenem Werkzeug durch.");
      log("  Die Wand greift nicht — sie würde den nächsten kaputten Deploy durchlassen.");
      process.exit(1);
    }
    log("  ROT-PROBE BESTANDEN: Ein Werkzeug in devDependencies bricht den Bau.");
    log("  Genau dieser Fehler hätte den Deploy vom 20.08.2026 hier gestoppt.\n");
    process.exit(0);
  }

  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══`);
  if (fehlgeschlagen === 0) {
    log("  Render wird durchlaufen. Das ist keine Vermutung, sondern derselbe Weg.\n");
  } else {
    log("  Der Deploy würde brechen. NICHT pushen, bevor das behoben ist.\n");
  }
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
