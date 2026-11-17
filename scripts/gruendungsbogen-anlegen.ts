// ═══════════════════════════════════════════════════════════════════════════
// GRÜNDUNGSBOGEN ANLEGEN AUS EINER JSON-DATEI (E-526, 17.11.2026)
//
// Dieselbe Server-Funktion wie das Formular im Chefbüro (gbAnlegen in server/lib/fiaon-global-gruendungsbogen.ts),
// dieselbe Prüfung (anlagePruefen in shared/fiaon-global-gruendungsbogen.ts). Das Skript enthält KEINE Daten — die
// Datei liegt außerhalb des Repos und kommt als Argument.
//
//   npx tsx scripts/gruendungsbogen-anlegen.ts <datei.json> --vorschau        nur prüfen, nichts schreiben
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=… SESSION_SECRET=… npx tsx scripts/gruendungsbogen-anlegen.ts <datei.json>
//   … --produktion                                                          gegen die Produktion, NUR mit Justins Go
//
// Schema der Datei (Beispielwerte, keine echten Daten):
//   {
//     "gruss": "Sehr geehrter Herr Muster, sehr geehrte Frau Beispiel",
//     "kostenHinweis": "Die Kosten der Gründung trägt ein Dritter; Ihnen entstehen keine Kosten.",   (freiwillig, sonst Vorgabe)
//     "bundesstaat": "delaware",                      (delaware | florida | wyoming, freiwillig, Vorgabe delaware)
//     "wunschname": "Muster Holdings",                (ohne „LLC“)
//     "gegenstand": "Beteiligungen und Beratung",     (freiwillig — die Gesellschafter können ihn ändern)
//     "fuehrung": "member",                           (member | manager, freiwillig, Vorgabe member)
//     "mitglieder": [                                 (2 bis 6, Anteile zusammen genau 100)
//       { "anzeigename": "Herr Max Muster",  "email": "max@beispiel.example",   "anteil": 50 },
//       { "anzeigename": "Frau Erika Beispiel", "email": "erika@beispiel.example", "anteil": 50 }
//     ],
//     "notizIntern": "…"                               (freiwillig, nur im Chefbüro sichtbar)
//   }
//
// Ausgabe: Kennung und gemeinsamer Link. Der Link ist mit SESSION_SECRET signiert — ohne das Geheimnis des Servers ist er
// dort ungültig. Dann im Chefbüro › Gründungsbögen „Gemeinsamen Link kopieren“ (stellt ihn neu aus).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

const pfad = process.argv.slice(2).find((a) => !a.startsWith("--"));
const vorschau = process.argv.includes("--vorschau");
const produktion = process.argv.includes("--produktion");
if (!pfad) { console.error("ABBRUCH: Pfad zur JSON-Datei fehlt. Aufruf: npx tsx scripts/gruendungsbogen-anlegen.ts <datei.json> [--vorschau]"); process.exit(2); }

let roh: unknown;
try { roh = JSON.parse(readFileSync(pfad, "utf8")); } catch (e) { console.error(`ABBRUCH: ${pfad} ist kein lesbares JSON (${e instanceof Error ? e.message : e}).`); process.exit(2); }

const { anlagePruefen, anteilText, gbStaatName } = await import("../shared/fiaon-global-gruendungsbogen");
const p = anlagePruefen(roh);
if (!p.ok) { console.error(`ABBRUCH (${p.feld}): ${p.error}`); process.exit(1); }
console.log(`Geprüft: ${p.daten.wunschname} LLC · ${gbStaatName(p.daten.bundesstaat)} · ${p.daten.fuehrung}-managed · ${p.daten.mitglieder.length} Gesellschafter`);
for (const m of p.daten.mitglieder) console.log(`  · ${m.anzeigename} — ${anteilText(m.anteil)}`);
if (vorschau) { console.log("Vorschau: nichts geschrieben."); process.exit(0); }

const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!["127.0.0.1", "localhost"].includes(host) && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — nur mit --produktion.`); process.exit(2); }
if (!process.env.SESSION_SECRET) console.warn("HINWEIS: SESSION_SECRET fehlt — der ausgegebene Link gilt dann nicht auf dem Server. Den gültigen Link gibt es im Chefbüro.");

const { gbAnlegen } = await import("../server/lib/fiaon-global-gruendungsbogen");
const { sqlPool } = await import("../server/lib/db-pool");
try {
  const erg = await gbAnlegen(p.daten, "Skript gruendungsbogen-anlegen");
  if (!erg.ok) { console.error(`ABBRUCH (${erg.feld ?? erg.status}): ${erg.error}`); process.exitCode = 1; }
  else {
    console.log(`Angelegt: ${erg.kennung}`);
    console.log(`Gemeinsamer Link (90 Tage): ${erg.link}`);
    console.log(`Chefbüro: /chef/s/gruendungsboegen?bogen=${erg.kennung}`);
  }
} finally {
  await sqlPool.end({ timeout: 5 }).catch(() => {});
}
