// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND GEGEN DEN FEHLENDEN BROWSER
//
// ── DER AUSFALL, DEN SIE VERHINDERT (21.08.2026) ──────────────────────────
//     browserType.launch: Executable doesn't exist at
//     /opt/render/.cache/ms-playwright/chromium_headless_shell-1200/…
//
// Zwei ausgezahlte Abrechnungen ohne Beleg, und „Neu erzeugen" scheiterte an
// derselben Stelle.
//
// ── WAS GEPRÜFT WIRD ──────────────────────────────────────────────────────
//   1  Die Version ist EXAKT gepinnt (keine Spanne) und im Lock identisch
//   2  Die Browser-Installation steht VORN in der Build-Kette
//   3  Build und Laufzeit zeigen auf DIESELBE Ablage
//   4  Chromium startet und druckt
//   5  Der pdfkit-Notbehelf greift, wenn er nicht startet (Rot-Probe)
//   6  Kein ausgezahlter Beleg fehlt
//
//   npx tsx scripts/pruef-pdf-browser.ts
//   npx tsx scripts/pruef-pdf-browser.ts --rot-probe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const ROT = process.argv.includes("--rot-probe");
let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `\n        → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

async function main(): Promise<void> {
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf-8"));

  // ═══════════════════════════════════════════════════════════════════════
  titel("1 — DIE VERSION IST EXAKT GEPINNT");
  // ═══════════════════════════════════════════════════════════════════════
  const wunsch = String(pkg.dependencies?.playwright ?? "");
  pruef("playwright steht in dependencies (nicht dev)", !!pkg.dependencies?.playwright,
    "Render installiert devDependencies nicht — dann fehlt die Bibliothek selbst");
  pruef(`playwright ist exakt gepinnt („${wunsch}“)`, /^\d+\.\d+\.\d+$/.test(wunsch),
    "eine Spanne (^ oder ~) lässt Bibliothek und Browser-Revision auseinanderlaufen");
  const imLock = String(lock.packages?.["node_modules/playwright"]?.version ?? "");
  pruef(`Lock und package.json stimmen überein (${imLock})`, imLock === wunsch,
    `Lock: ${imLock}, package.json: ${wunsch}`);
  const test = String(pkg.devDependencies?.["@playwright/test"] ?? pkg.dependencies?.["@playwright/test"] ?? "");
  if (test) {
    pruef(`@playwright/test hat dieselbe Version (${test})`, test === wunsch,
      "zwei Playwright-Versionen im Baum bedeuten zwei erwartete Browser-Revisionen");
  }

  // Welche Revision verlangt diese Version?
  const browsers = JSON.parse(readFileSync("node_modules/playwright-core/browsers.json", "utf-8"));
  const noetig = browsers.browsers
    .filter((b: any) => /^chromium/.test(b.name) && b.installByDefault)
    .map((b: any) => `${b.name}-${b.revision}`);
  console.log(`        verlangt: ${noetig.join(", ")}`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("2 — DIE INSTALLATION STEHT VORN IN DER BUILD-KETTE");
  // ═══════════════════════════════════════════════════════════════════════
  const build = String(pkg.scripts?.build ?? "");
  const glieder = build.split("&&").map((s: string) => s.trim());
  const platz = glieder.findIndex((g: string) => g.includes("pdf:browser"));
  pruef("Die Browser-Installation ist Teil des Builds", platz >= 0, build);
  // ── WARUM „VORN" DER GANZE PUNKT IST ─────────────────────────────────
  // Sie stand als VIERTES Glied hinter `npm run haken`. Der eslint-Schritt ist
  // tagelang gescheitert — also wurde der Browser nie installiert. Ein Glied
  // hinter einem fehleranfälligen Schritt ist ein Glied, das nicht läuft.
  pruef("… und zwar als ERSTES Glied", platz === 0,
    `steht an Stelle ${platz + 1} von ${glieder.length}: „${glieder[platz] ?? "?"}“`);
  pruef("Der Build installiert MIT Systemabhängigkeiten (--with-deps)",
    String(pkg.scripts?.["pdf:browser"] ?? "").includes("--with-deps"),
    "ohne sie fehlen auf einem schlanken Linux die Bibliotheken");
  // Ein `|| echo` am Ende hätte den Ausfall verschluckt — genau das war der
  // Zustand vor dem 21.08.
  pruef("Ein Fehlschlag wird NICHT weggeschluckt",
    !/\|\|\s*echo/.test(String(pkg.scripts?.["pdf:browser"] ?? "")),
    "`|| echo …` lässt den Build grün werden, obwohl kein Browser da ist");

  // ═══════════════════════════════════════════════════════════════════════
  titel("3 — BUILD UND LAUFZEIT SEHEN DIESELBE ABLAGE");
  // ═══════════════════════════════════════════════════════════════════════
  const start = String(pkg.scripts?.start ?? "");
  const pfadAus = (s: string) => (s.match(/PLAYWRIGHT_BROWSERS_PATH=("?)([^"\s]+)\1/) ?? [])[2] ?? null;
  const imBuild = pfadAus(String(pkg.scripts?.["pdf:browser"] ?? ""));
  const imStart = pfadAus(start);
  pruef("Der Build legt die Ablage fest", !!imBuild, `pdf:browser: ${imBuild ?? "(keine)"}`);
  pruef("Die Laufzeit legt dieselbe Ablage fest", !!imStart && imStart === imBuild,
    `build=${imBuild ?? "-"} start=${imStart ?? "-"}`);
  pruef("Die Ablage liegt IM PROJEKT, nicht im Home-Cache",
    !!imBuild && !imBuild.includes(".cache") && imBuild.includes(".playwright"),
    `${imBuild} — ein geleerter Build-Cache nimmt den Home-Cache mit`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("4 — CHROMIUM STARTET UND DRUCKT");
  // ═══════════════════════════════════════════════════════════════════════
  const { pdfBrowserPruefen } = await import("../server/lib/fiaon-html-pdf");
  const e = await pdfBrowserPruefen();
  pruef(`Chromium startet (${e.dauerMs} ms)`, e.ok, e.grund ?? "");
  console.log(`        Ablage: ${e.ablage ?? "Standard (~/.cache/ms-playwright)"}`);

  const { abrechnungPdf } = await import("../server/lib/fiaon-abrechnung-pdf");
  void abrechnungPdf;
  const { htmlZuPdfMitFusszeile } = await import("../server/lib/fiaon-html-pdf");
  const buf = await htmlZuPdfMitFusszeile({
    html: "<html><body><h1>Probe</h1></body></html>",
    fusszeile: "FIAON LTD · Probe",
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
  }).catch(() => null);
  pruef("Der Abrechnungs-Druckweg liefert ein PDF",
    !!buf && buf.subarray(0, 5).toString() === "%PDF-",
    buf ? `Kopf: ${buf.subarray(0, 5).toString()}` : "nichts zurückgekommen");

  // ═══════════════════════════════════════════════════════════════════════
  titel("5 — DER NOTBEHELF GREIFT, WENN CHROMIUM FEHLT");
  // ═══════════════════════════════════════════════════════════════════════
  if (ROT) {
    // ══════════════════════════════════════════════════════════════════════
    // DIE ROT-PROBE LÄUFT IN EINEM EIGENEN PROZESS
    //
    // ── WARUM (gemerkt beim ersten Versuch) ─────────────────────────────
    // Erster Entwurf setzte `PLAYWRIGHT_BROWSERS_PATH` auf ein leeres
    // Verzeichnis und importierte das Modul mit `?rotprobe=…` neu, um den
    // gemerkten Browser zu umgehen. Ergebnis: „ohne Browser entsteht trotzdem
    // ein PDF" — grün, aber falsch. Der Anhang an den Modulpfad wurde nicht
    // als neues Modul behandelt, und `browserPromise` hielt den BEREITS
    // OFFENEN Browser. Die Probe prüfte ihre eigene Umgehung.
    //
    // Ein eigener Prozess hat nichts geöffnet und keine Umgebung geerbt. Das
    // ist die einzige Fassung, die den Schaden wirklich nachstellt.
    // ══════════════════════════════════════════════════════════════════════
    const { execFileSync } = await import("node:child_process");
    const leer = "/tmp/fiaon-rotprobe-ohne-browser";
    // `--eval` übersetzt tsx nach CJS — dort ist `await` auf oberster Ebene
    // verboten. Deshalb eine Datei und keine Zeichenkette im Aufruf.
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const skriptDatei = "scripts/_rotprobe-pdf.ts";
    writeFileSync(skriptDatei, [
      'import { htmlZuPdfMitFusszeile, pdfBrowserPruefen } from "../server/lib/fiaon-html-pdf";',
      'import * as modul from "../server/lib/fiaon-html-pdf";',
      "async function main() {",
      "  const buf = await htmlZuPdfMitFusszeile({",
      '    html: "<html><body><h1>Rot-Probe</h1></body></html>",',
      '    fusszeile: "FIAON LTD",',
      '    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },',
      "  });",
      "  const stand = await pdfBrowserPruefen();",
      "  console.log(JSON.stringify({",
      '    kopf: buf.subarray(0, 5).toString(),',
      "    bytes: buf.length,",
      "    notbehelf: modul.pdfNotbehelf === true,",
      "    pruefungOk: stand.ok,",
      "    grund: stand.grund,",
      "  }));",
      "  process.exit(0);",
      "}",
      "void main();",
      "",
    ].join("\n"));
    let erg: any = null;
    try {
      const aus = execFileSync("npx", ["tsx", skriptDatei], {
        encoding: "utf-8",
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: leer },
        cwd: process.cwd(),
        timeout: 120_000,
      });
      const zeile = aus.trim().split("\n").filter((z) => z.startsWith("{")).pop();
      erg = zeile ? JSON.parse(zeile) : null;
    } catch (e: any) {
      console.log(`        (Unterprozess: ${String(e?.message ?? e).slice(0, 160)})`);
      const aus = String(e?.stdout ?? "");
      const zeile = aus.trim().split("\n").filter((z) => z.startsWith("{")).pop();
      erg = zeile ? JSON.parse(zeile) : null;
    }
    pruef("ROT-PROBE: der Unterprozess ohne Browser liefert eine Auskunft", !!erg,
      "ohne sie prüft dieser Abschnitt nichts");
    if (erg) {
      pruef("ROT-PROBE: ohne Browser entsteht trotzdem ein gültiges PDF",
        erg.kopf === "%PDF-" && erg.bytes > 500,
        `Kopf ${erg.kopf}, ${erg.bytes} Bytes — sonst bleibt eine gebuchte `
        + "Auszahlung ohne Beleg, der Ausfall von heute");
      pruef("ROT-PROBE: der Notbehelf ist als solcher gemeldet", erg.notbehelf === true,
        "ein Notbehelf, den niemand erkennt, wird zum Dauerzustand");
      pruef("ROT-PROBE: die Selbstprüfung meldet den Fehlschlag", erg.pruefungOk === false,
        `pruefungOk=${erg.pruefungOk} — dann bleibt die rote Karte aus, und es `
        + "fällt wieder erst beim Auszahlen auf");
      if (erg.grund) console.log(`        gemeldeter Grund: ${String(erg.grund).slice(0, 130)}`);
    }
    // Das Hilfsskript ist Werkzeug, nicht Bestand.
    try { unlinkSync(skriptDatei); } catch { /* schon weg */ }
  } else {
    console.log("        (mit --rot-probe wird der fehlende Browser nachgestellt)");
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("6 — KEIN AUSGEZAHLTER BELEG FEHLT");
  // ═══════════════════════════════════════════════════════════════════════
  const [belege] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COALESCE(SUM(s.net_cents), 0)::bigint / 100.0 AS summe
    FROM fiaon_commission_statements s
    JOIN fiaon_payouts x ON x.id = s.payout_id
    WHERE x.status = 'ausgezahlt'
      AND (s.pdf_base64 IS NULL OR LENGTH(s.pdf_base64) < 100)
  `) as any[];
  pruef(`Keine ausgezahlte Abrechnung ohne Beleg (${belege.n} gefunden)`,
    Number(belege.n) === 0,
    `${belege.n} über ${Number(belege.summe).toFixed(2)} € — `
    + "npx tsx scripts/belege-nachziehen.ts --schreiben");

  console.log(`\n${"═".repeat(72)}\n  ${ok} ok · ${rot} rot`);
  if (rot > 0) { console.log("\n  ROT:"); for (const f of fehler) console.log(`    · ${f}`); }
  console.log("═".repeat(72));
  await sqlPool.end();
  // Der offene Browser hält den Prozess sonst am Leben.
  process.exit(rot > 0 ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
