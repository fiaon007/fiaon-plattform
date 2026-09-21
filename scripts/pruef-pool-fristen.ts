// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND POOL-FRISTEN (21.09.2026, E-203) — liest nur den Quelltext
//
// Die zwei Rückfall-Fristen der Arbeitsliste (server/routes/fiaon-office-
// vertrieb.ts, poolNachschub) und der Nachschub aus dem Pool:
//
//   · 21 Tage „liegen gelassen" zählen ab dem JÜNGSTEN Anlass — letzter
//     Kontakt ODER Zuteilung (GREATEST). Mit COALESCE zählte ein alter Anruf
//     vor der frischen Zuteilung: Die Verteilung vom 14.09. war am selben
//     Nachmittag zurück im Pool, am 21.09. sprangen 319 von 320 gezogenen
//     B-Kunden binnen zehn Minuten zurück.
//   · Der Nachschub zieht nur Nie-Angerufene — er füllt „Neu für dich" und
//     zählt nur diese. Sonst hortet jeder Aufbau sechs früher Angerufene.
//   · 3 Tage „gezogen und nichts getan" bleiben, wie sie sind.
//
// Praxisbeweis (lokaler Prüfstand, sechs Personen, alter gegen neuen Code):
// siehe CHANGELOG 21.09.2026 (E-203).
//
//   npx tsx scripts/pruef-pool-fristen.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const q = fs.readFileSync(path.join(wurzel, "server/routes/fiaon-office-vertrieb.ts"), "utf8");

const start = q.indexOf("async function poolNachschub(");
const ende = q.indexOf("router.get(\"/agent/vertrieb/arbeitsliste\"", start);
ok(start > 0 && ende > start, "poolNachschub und nachschubZiehen gefunden");
const block = q.slice(start, ende);

// Die 21-Tage-Frist
const erstesUpdate = block.indexOf("UPDATE fiaon_persons p SET assigned_agent_id = NULL");
const zweitesUpdate = block.indexOf("UPDATE fiaon_persons p SET assigned_agent_id = NULL", erstesUpdate + 10);
ok(erstesUpdate > 0 && zweitesUpdate > erstesUpdate, "Zwei Rückfall-Läufe gefunden (3 und 21 Tage)");
const frist = block.slice(zweitesUpdate, block.indexOf("await nachschubZiehen(me);", zweitesUpdate));
ok(/AND GREATEST\(\s*\(SELECT MAX\(c3\.created_at\)[\s\S]*?p\.assigned_at\s*\) < NOW\(\) - INTERVAL '\$\{POOL_LIEGEN_TAGE\} days'/.test(frist),
  "21 Tage zählen ab dem jüngsten Anlass: GREATEST(letzter Kontakt Person, letzter Kontakt Antrag, Zuteilung)");
ok(!/AND COALESCE\(\s*\(SELECT MAX\(c3/.test(frist), "Kein COALESCE mehr in der 21-Tage-Frist (alter Anruf schlug frische Zuteilung)");
ok(/const POOL_LIEGEN_TAGE = 21;/.test(q), "Frist bleibt 21 Tage");
ok(/p\.mandat_seit IS NULL/.test(frist) && /t2\.beginn > NOW\(\)/.test(frist), "Mandat und künftiger Termin schützen weiter");

// Die 3-Tage-Frist bleibt
const drei = block.slice(erstesUpdate, zweitesUpdate);
ok(/const POOL_RUECKFALL_TAGE = 3;/.test(q) && drei.includes("INTERVAL '${POOL_RUECKFALL_TAGE} days'")
  && drei.includes("NOT EXISTS (SELECT 1 FROM fiaon_contact_log c2 WHERE c2.person_id = p.id)") && drei.includes("NOT EXISTS (SELECT 1 FROM fiaon_termine tx"),
  "3 Tage „gezogen und nichts getan“ unverändert");

// Der Nachschub
const zug = block.slice(block.indexOf("UPDATE fiaon_persons SET assigned_agent_id = $1, assigned_at = NOW()"));
ok(zug.length > 0, "Pool-Zug gefunden");
const zugWhere = zug.slice(0, zug.indexOf("ORDER BY ${POOL_ORDNUNG}"));
ok(/AND \$\{NIE_SQL\}/.test(zugWhere), "Der Pool-Zug nimmt nur Nie-Angerufene (füllt „Neu für dich“, zählt nur diese)");
ok(/p\.assigned_agent_id IS NULL AND p\.mandat_seit IS NULL/.test(zugWhere), "Gezogen wird nur aus dem Pool, nie ein Mandat");
ok(/LIMIT \$\{fehlt\}/.test(zug) && /FOR UPDATE SKIP LOCKED/.test(zug), "Nur so viele, wie fehlen — ohne Doppelzug");
const zaehlt = block.slice(block.indexOf("async function nachschubZiehen("), block.indexOf("const fehlt = SLOTS"));
ok(/AND \$\{NIE_SQL\}/.test(zaehlt), "Gezählt werden dieselben Nie-Angerufenen, die gezogen werden");
ok(/if \(Number\(alle\?\.n \?\? 0\) >= SLOTS \* 3\) return;/.test(block), "Deckel gegen Horten (18) bleibt");

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
