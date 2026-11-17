// Prüfstand: Firmen-Radar ordnet Mails nie über eine Freemail-Domäne zu (17.11.2026, Migration 137).
// npx tsx scripts/pruef-radar-freemail.ts
import fs from "node:fs";
import { RADAR_FREEMAIL } from "../shared/fiaon-radar";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string) => { if (b) gut++; else { schlecht++; console.log("FEHLER ", was); } };

for (const d of ["gmail.com", "googlemail.com", "gmx.net", "gmx.de", "web.de", "t-online.de", "yahoo.de", "outlook.de", "icloud.com", "bluewin.ch", "aon.at"]) {
  ok(RADAR_FREEMAIL.has(d), `Freemail-Liste kennt ${d}`);
}
ok(!RADAR_FREEMAIL.has("hms-beispiel.de") && !RADAR_FREEMAIL.has("fiaon.com"), "Firmen-Domänen stehen nicht in der Freemail-Liste");

const q = fs.readFileSync("server/lib/fiaon-radar-faden.ts", "utf8");
ok(/import \{ RADAR_FREEMAIL \} from "@shared\/fiaon-radar"/.test(q), "Radar-Post kennt die Freemail-Liste");
ok(/if \(d && !frei\(d\)\) domaenen\.set\(d, Number\(x\.id\)\)/.test(q), "Firmen-Domäne nur ohne Freemail");
ok(/if \(ed && !frei\(ed\)\) domaenen\.set\(ed, Number\(x\.id\)\)/.test(q), "Domäne der Kontaktadresse nur ohne Freemail");
ok(/adressen\.set\(e, Number\(x\.id\)\)/.test(q), "die genaue Kontaktadresse zählt immer");
ok(/faeden\.get\(m\.threadId\) \?\? adressen\.get\(von\) \?\? \(frei\(dom\) \? null : domaenen\.get\(dom\) \?\? null\)/.test(q), "Reihenfolge: Faden → genaue Adresse → Domäne (nie Freemail)");
ok(!/domaenen\.get\(n\.vonAdresse\)/.test(q) && !/String\(x\.email\)\.split\("@"\)\[1\], Number\(x\.id\)\)/.test(q), "die alte Zuordnung über die Domäne der Kontaktadresse ist weg");
ok(/filter\(\(e\) => frei\(e\.split\("@"\)\[1\] \?\? ""\)\)/.test(q), "Gmail-Suche nur mit der genauen Adresse, nie „from:gmail.com“");

const m = fs.readFileSync("db/migrations/137_radar_freemail_zuordnung.sql", "utf8");
ok(m.includes("fiaon_radar_post_falsch") && m.includes("INSERT INTO fiaon_radar_post_falsch") && m.indexOf("INSERT INTO fiaon_radar_post_falsch") < m.indexOf("DELETE FROM fiaon_radar_post WHERE"), "Migration 137 legt erst ab, dann entfernt sie");
ok(m.includes("to_regclass('public.fiaon_radar_post') IS NULL"), "Migration 137 tut auf frischer Datenbank nichts");
ok(!/@(gmail|gmx|web|hms)/i.test(m.replace(/\('[a-z0-9.-]+'\)/g, "")), "Migration 137 nennt keine Adressen oder Firmen");

console.log(`\n${gut} Prüfungen grün, ${schlecht} rot.`);
if (schlecht) process.exitCode = 1;
