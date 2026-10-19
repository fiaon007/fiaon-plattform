// ═══════════════════════════════════════════════════════════════════════════
// HAUSPUTZ — PROBELAUF NACHRECHNEN, NUR LESEND (E-397, 19.10.2026)
//
// Dieselben Regeln wie der Plattform-Lauf (shared/fiaon-hausputz-regeln.ts), ohne
// Datenbank: Das Skript druckt die drei Abfragen; gelesen wird mit dem Nur-Lese-
// Werkzeug (ro.mjs, READ ONLY, Zeitlimit) — dann zählt es je Regel.
//
//   npx tsx scripts/hausputz-probelauf.ts --sql auftraege > a.sql   (ebenso vermerke, rueckrufe)
//   node ~/Developer/it-rettung/werkzeuge/ro.mjs a.sql kompakt > a.json
//   npx tsx scripts/hausputz-probelauf.ts --zaehlen <ordner mit a.json v.json r.json>
//
// Schreibt nichts, nirgends. Produktion wird nie per Skript beschrieben.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import {
  hausputzAuftraegeSql, hausputzBewerten, hausputzRueckrufeSql, hausputzVermerkeSql, hausputzZaehlen, HAUSPUTZ_REGELN,
} from "../shared/fiaon-hausputz-regeln";

const arg = process.argv.slice(2);
if (arg[0] === "--sql") {
  const welche = arg[1];
  const sql = welche === "auftraege" ? hausputzAuftraegeSql() : welche === "vermerke" ? hausputzVermerkeSql() : welche === "rueckrufe" ? hausputzRueckrufeSql() : null;
  if (!sql) { console.error("auftraege | vermerke | rueckrufe"); process.exit(2); }
  process.stdout.write(`${sql};\n`);
} else if (arg[0] === "--zaehlen") {
  const ordner = arg[1];
  const lies = (n: string) => JSON.parse(fs.readFileSync(path.join(ordner, n), "utf8"));
  const daten = { auftraege: lies("a.json"), vermerke: lies("v.json"), rueckrufe: lies("r.json") };
  const ent = hausputzBewerten(daten);
  const z = hausputzZaehlen(daten, ent);
  console.log(JSON.stringify(z, null, 1));
  // Beispiele je Regel (Kennung, Titel/Text gekürzt) — zum Gegenlesen, nicht für Justin.
  if (arg.includes("--beispiele")) {
    for (const r of HAUSPUTZ_REGELN) {
      const l = ent.filter((e) => e.regel === r.id).slice(0, 6);
      if (!l.length) continue;
      console.log(`\n## ${r.id} — ${r.label}`);
      for (const e of l) {
        const quelle = e.tabelle === "auftrag" ? daten.auftraege : e.tabelle === "vermerk" ? daten.vermerke : daten.rueckrufe;
        const z0 = quelle.find((x: any) => Number(x.id) === e.id) ?? {};
        console.log(`  ${e.tabelle} #${e.id}${e.ziel ? ` → #${e.ziel}` : ""}: ${String(z0.titel ?? z0.text ?? z0.anliegen ?? "").replace(/\s+/g, " ").slice(0, 140)}`);
      }
    }
  }
} else {
  console.error("--sql <auftraege|vermerke|rueckrufe> | --zaehlen <ordner> [--beispiele]");
  process.exit(2);
}
