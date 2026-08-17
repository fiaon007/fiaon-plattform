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
      const stderr = String(e?.stderr ?? e?.message ?? "");
      const roh = stderr.split("\n")
        .filter((z) => z.includes("ERROR") || z.includes("error:"))
        .slice(0, 2).join(" | ");

      // ── DIE URSACHE BENENNEN, NICHT NUR DEN ORT ────────────────────────
      // esbuild meldet „Expected ) but found …" — und man sucht an der
      // falschen Stelle. Am 19.08.2026 war es DREIMAL dasselbe: ein deutsches
      // Zitat, das mit einem GERADEN Anführungszeichen endet und damit den
      // umgebenden String beendet.
      //
      // Diese Prüfung sieht nur in Zeilen, die esbuild schon abgelehnt hat.
      // Deshalb kann sie keinen Fehlalarm erzeugen — ein erster Entwurf prüfte
      // ALLE Zeilen und meldete 343 Treffer, fast alle davon mehrzeilige
      // Zitate. Eine Bremse, die falsch auslöst, ist gefährlicher als keine.
      let hinweis = "";
      // Das esbuild-Format lautet:
      //   ✘ [ERROR] Expected ")" but found "—"
      //       scripts/mess-datenkosmetik.ts:44:46:
      // Die Zeilennummer steht also in der ZWEITEN Zeile, nach dem Dateinamen —
      // nicht davor. Ein erster Entwurf suchte „:44:46: ERROR" und fand nichts.
      const zeilenNr = Number(
        new RegExp(`${datei.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+):\\d+:`)
          .exec(stderr)?.[1] ?? 0,
      );
      if (zeilenNr > 0) {
        const zeile = readFileSync(datei, "utf8").split("\n")[zeilenNr - 1] ?? "";
        const auf = (zeile.match(/\u201e/g) ?? []).length;
        const zu = (zeile.match(/\u201c/g) ?? []).length;
        if (auf > zu) {
          hinweis = "\n    → In dieser Zeile öffnet ein deutsches Zitat („) und schließt nicht. "
            + "Das schließende Zeichen ist \u201c — ein gerades \" beendet den String.";
        }
      }
      meldungen.push(`${datei}\n    ${roh.slice(0, 150)}${hinweis}`);
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

  // ═══════════════════════════════════════════════════════════════════════
  // HALB-OFFENE DEUTSCHE ANFÜHRUNGSZEICHEN — WARUM HIER KEINE EIGENE PRÜFUNG
  //
  // ── DER VERSUCH UND SEIN ERGEBNIS (23.08.2026) ───────────────────────
  // Viermal in einer Sitzung ist dasselbe passiert: Das öffnende Zeichen ist
  // deutsch („), das schließende bleibt ein ASCII-" — und beendet damit den
  // String. Der Übersetzungsfehler erscheint an einer Stelle, die mit dem
  // Zitat nichts zu tun hat („Expected ) but found oder").
  //
  // Also wurde hier eine Prüfung gebaut: „Zahl der „ muss zur Zahl der “
  // passen." Ergebnis: 365 Treffer, davon fast alle FALSCHE ALARME —
  //   · JSX-Text: <b>„QR-Code speichern"</b> — dort ist " harmlos
  //   · mehrzeilige Template-Literale, die in der nächsten Zeile schließen
  //   · Fortsetzungszeilen mehrzeiliger Kommentare
  //
  // Das ist genau die Falle, die weiter oben schon beschrieben steht: Ein
  // Regex, der Quelltext ohne Parser beurteilt, meldet Rauschen. Eine Prüfung
  // mit 365 Fehlalarmen wird nach dem dritten Mal abgeschaltet — und dann
  // fängt sie auch die echten Fälle nicht mehr.
  //
  // ── WAS STATTDESSEN GILT ─────────────────────────────────────────────
  // Der esbuild-Durchgang WEITER OBEN fängt diese Fehler bereits: Ein
  // beendeter String macht die Datei syntaktisch kaputt, und esbuild weiß als
  // Übersetzer genau, was ein String ist und was JSX-Text.
  //
  // Die Lehre ist also nicht „mehr Regex", sondern: Nach jeder Änderung an
  // scripts/ oder server/ diesen Prüfstand laufen lassen. Er hätte alle vier
  // Fälle gefunden — er wurde nur nicht gefragt.
  // ═══════════════════════════════════════════════════════════════════════

  if (gefunden > 0 || kaputt > 0 || interpolationen > 0) process.exit(1);
}
