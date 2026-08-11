// ═══════════════════════════════════════════════════════════════════════════
// EINE WAND GEGEN DEN FEHLER, DEN ICH NEUNMAL GEMACHT HABE
//
// ── DIE GESCHICHTE ─────────────────────────────────────────────────────────
// Ein Backtick in einem SQL- oder CSS-Kommentar INNERHALB eines
// Template-Literals beendet das Literal. Der Client-Build bleibt grün, der
// Typcheck geht im Alt-Bestand unter, und der Serverstart hängt still: kein
// Fehler, keine Zeile, nur ein Prozess, der nie „serving on port" meldet.
//
// AGENTS.md warnt davor seit dem 08.08.2026. Ich bin seitdem NEUNMAL
// hineingelaufen — zuletzt am 11.08. in fiaon-inkasso.ts, weil ich in einem
// Kommentar eine SQL-Bedingung zitieren wollte.
//
// Eine Regel, die man neunmal vergisst, braucht keine zehnte Erinnerung,
// sondern eine Wand. Dieser Prüfstand ist die Wand.
//
//   npx tsx scripts/pruef-backticks.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ORTE = ["server", "client/src", "scripts", "shared"];
let gefunden = 0;
const treffer: string[] = [];

function dateien(ort: string): string[] {
  const raus: string[] = [];
  const gehe = (p: string) => {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const v = join(p, e);
      if (statSync(v).isDirectory()) gehe(v);
      else if (/\.(ts|tsx)$/.test(e)) raus.push(v);
    }
  };
  try { gehe(ort); } catch { /* Ort gibt es nicht */ }
  return raus;
}

// ── UMGEKEHRT SUCHEN ───────────────────────────────────────────────────────
// Zwei Entwürfe waren wertlos:
//
//   1. Ein Zustandsautomat über die ganze Datei — 22 Fundstellen, fast alle
//      harmlose JSDoc-Kommentare. Eine Bremse, die falsch auslöst, ist
//      gefährlicher als keine (AGENTS.md).
//   2. Die Literale suchen und darin nach Kommentaren schauen — fand meinen
//      ECHTEN Fehler nicht. Henne und Ei: Genau der Backtick, den ich suche,
//      beendet das Literal und macht es unauffindbar.
//
// Der dritte Entwurf ist der einfachste und der einzige, der greift:
//
//   Eine Zeile, die mit „--" beginnt, ist ein SQL-Kommentar. SQL-Kommentare
//   gibt es in TypeScript NUR innerhalb von Template-Literalen — außerhalb
//   wäre „--" ein Syntaxfehler. Steht darin ein Backtick, ist es IMMER der
//   Fehler, der den Serverstart aufhängt.
//
// Kein Zustand, keine Vermutung, keine Fehlalarme.
for (const ort of ORTE) {
  for (const datei of dateien(ort)) {
    const text = readFileSync(datei, "utf8");
    text.split("\n").forEach((z, i) => {
      if (!/^[ \t]*--/.test(z)) return;
      if (!z.includes("`")) return;
      gefunden++;
      treffer.push(`${datei}:${i + 1}\n    ${z.trim().slice(0, 96)}`);
    });
  }
}

console.log("\n══ Backticks in Kommentaren innerhalb von Template-Literalen ══\n");
if (gefunden === 0) {
  console.log("  Keiner. Für zitierte Bedingungen die deutschen „…\u201c nehmen.\n");
  process.exit(0);
}
for (const t of treffer) console.log(`  FAIL  ${t}`);
console.log(`\n  ${gefunden} Fundstelle(n). Jede beendet das Template-Literal und`);
console.log("  hängt den Serverstart still auf. Ersetze den Backtick durch „…\u201c.\n");
process.exit(1);
