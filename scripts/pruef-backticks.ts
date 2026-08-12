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
// KEIN vorzeitiger Ausstieg: Darunter folgt die zweite Wand (Regex-Literale
// mit Zeilenumbruch). Ein `process.exit(0)` hier hätte sie nie laufen lassen —
// und genau das ist beim ersten Versuch passiert: Der Prüfstand meldete
// „Keiner" und war fertig, obwohl der zweite Teil nie startete.
if (gefunden === 0) {
  console.log("  Keiner. Für zitierte Bedingungen die deutschen „…\u201c nehmen.\n");
} else {
  for (const t of treffer) console.log(`  FAIL  ${t}`);
  console.log(`\n  ${gefunden} Fundstelle(n). Jede beendet das Template-Literal und`);
  console.log("  hängt den Serverstart still auf. Ersetze den Backtick durch „…\u201c.\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// ZWEITE WAND: DIE DATEIEN MÜSSEN SICH ÜBERSETZEN LASSEN
//
// ── DIE GESCHICHTE ─────────────────────────────────────────────────────────
// Ein Regex-Literal /…/ darf keinen Zeilenumbruch enthalten. Wer aus einem
// mehrzeiligen Kommentar zitiert und den Text hineinkopiert, bekommt
// „Unterminated regular expression" — und der ganze Prüfstand startet nicht.
//
// Am 11.08.2026 ist mir das ZEHNMAL passiert, immer beim Zitieren eines
// Kommentars als Beweis.
//
// ── WARUM NICHT SELBST NACH REGEXEN SUCHEN ─────────────────────────────────
// Erster Versuch: Zeilen finden, die ein /…/ öffnen und nicht schließen.
// Ergebnis: 13 Fundstellen, ALLE Fehlalarme — bei
// `/UPDATE … SET pdf_base64 = /.test(x)` sah der Erkenner das „= /" INNERHALB
// des Regex als Anfang und fand danach kein Ende.
//
// Eine Bremse, die falsch auslöst, ist gefährlicher als keine (AGENTS.md).
//
// Also lasse ich esbuild urteilen — es weiß genau, was ein Regex ist. Ein
// Aufruf je Datei, in Sekunden, ohne einen einzigen Fehlalarm.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { execFileSync } = await import("node:child_process");
  const kandidaten = ORTE.flatMap((o) => dateien(o))
    .filter((d) => d.startsWith("scripts/") || d.startsWith("server/"));
  let kaputt = 0;
  const meldungen: string[] = [];
  for (const datei of kandidaten) {
    try {
      execFileSync("npx", ["esbuild", "--log-level=error", datei], { stdio: "pipe" });
    } catch (e: any) {
      kaputt++;
      const roh = String(e?.stderr ?? e?.message ?? "").split("\n")
        .filter((z) => z.includes("ERROR") || z.includes("error:"))
        .slice(0, 2).join(" | ");
      meldungen.push(`${datei}\n    ${roh.slice(0, 150)}`);
    }
  }
  console.log(`══ Übersetzbarkeit (${kandidaten.length} Dateien) ══\n`);
  if (kaputt === 0) {
    console.log("  Alle übersetzen sich. Zitate aus Kommentaren immer EINZEILIG.\n");
  } else {
    for (const m of meldungen) console.log(`  FAIL  ${m}`);
    console.log(`\n  ${kaputt} Datei(en) übersetzen sich nicht. Häufigste Ursache:`);
    console.log("  ein Regex-Literal mit Zeilenumbruch oder ein Backtick im Kommentar.\n");
  }
  // ═══════════════════════════════════════════════════════════════════════
  // DRITTE WAND: INTERPOLATIONEN IN SQL-KOMMENTAREN
  //
  // ── DER FALL (11.08.2026) ─────────────────────────────────────────────
  // In einem UPDATE stand ein erklärender SQL-Kommentar, der zur Erläuterung
  // eines früheren Fehlers eine Interpolation enthielt — Dollarzeichen,
  // geschweifte Klammer, Wert. Innerhalb eines Template-Literals ist das keine
  // Beschreibung, sondern eine echte Einsetzung: postgres.js schickte einen
  // zusätzlichen Parameter ohne Typ.
  //
  // PostgreSQL antwortete „could not determine data type of parameter" —
  // dieselbe Meldung wie beim eigentlichen Problem, das der Kommentar erklären
  // sollte. Vier Anläufe gingen dafür drauf.
  //
  // esbuild findet das nicht: Die Datei ist syntaktisch einwandfrei. Nur die
  // Datenbank merkt es, und erst zur Laufzeit.
  // ═══════════════════════════════════════════════════════════════════════
  let interpolationen = 0;
  const interMeldungen: string[] = [];
  for (const datei of kandidaten) {
    const quelle = readFileSync(datei, "utf8");
    const zeilen = quelle.split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (!/^\s*--/.test(z)) continue;
      if (!z.includes("${")) continue;
      interpolationen++;
      interMeldungen.push(`${datei}:${i + 1}\n    ${z.trim().slice(0, 110)}`);
    }
  }
  console.log(`══ Interpolationen in SQL-Kommentaren ══\n`);
  if (interpolationen === 0) {
    console.log("  Keine. Kommentare erklären, sie setzen nichts ein.\n");
  } else {
    for (const m of interMeldungen) console.log(`  FAIL  ${m}`);
    console.log(`\n  ${interpolationen} SQL-Kommentar(e) enthalten eine Interpolation.`);
    console.log("  Die Erklärung gehört ÜBER die Abfrage, nicht hinein.\n");
  }

  if (gefunden > 0 || kaputt > 0 || interpolationen > 0) process.exit(1);
}
