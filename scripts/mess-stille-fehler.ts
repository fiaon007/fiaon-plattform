// ═══════════════════════════════════════════════════════════════════════════
// STILLE FEHLERSCHLUCKER — DIE VOLLSTÄNDIGE LISTE
//
// ── WARUM DIESER LAUF ─────────────────────────────────────────────────────
// Drei Ausfälle in Folge, die niemand gesehen hat, weil der Fehler
// weggeworfen wurde:
//
//   19.–21.08.  `.catch(() => {})` um den Akteneintrag der Rechnungsstellung.
//               63 Rechnungen gingen raus, kein einziger Eintrag entstand.
//   21.08.      `if (!j?.ok) return;` im Telefon-Panel. Der 403 wurde zu einem
//               ewigen „Wird geladen …" — Onboarding sah nie Kundendaten.
//   21.08.      `if (!callId) { setZustand("bereit"); return; }` — der
//               Ergebnis-Klick verpuffte ohne eine Zeile im Netz oder im Log.
//
// ── WAS DIESER LAUF NICHT IST ─────────────────────────────────────────────
// Keine Wand. Ein Prüfstand, der 200 Meldungen wirft, wird beim dritten Mal
// abgeschaltet (AGENTS.md). Er ERZEUGT eine Liste und ordnet sie ein; behoben
// wird nach Pfad, nicht nach Menge.
//
// NUR LESEND. Schreibt reports/stille-fehler.md.
//
//   npx tsx scripts/mess-stille-fehler.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const log = (s = "") => console.log(s);

/** Die Pfade, auf denen ein verschluckter Fehler Geld oder Vertrauen kostet. */
const KRITISCH: { name: string; muster: RegExp }[] = [
  { name: "Mailversand", muster: /(mail|brevo|make-webhook|versand)/i },
  { name: "PDF-Erzeugung", muster: /(pdf|invoice|rechnung|abrechnung)/i },
  { name: "Rechnungsstellung", muster: /(rechnung-stellen|massgebliche-bestellung|agent-kunden)/i },
  { name: "Terminbuchung", muster: /(termine?|startgespraech|StartgespraechGate)/i },
  { name: "Rollen und Rechte", muster: /(kundenzugriff|zustaendigkeit|rolle|agent\.ts)/i },
  { name: "Zahlungsstatus", muster: /(zahlung|payment|kontoabgleich|abo)/i },
];

interface Treffer {
  datei: string;
  zeile: number;
  code: string;
  muster: "A" | "B";
  /** Ein `.catch(() => null)`, dessen Rückgabe danach geprüft wird, ist weich. */
  weich: boolean;
  bereich: string;
  pfad: string | null;
}

function bereichVon(datei: string): string {
  if (datei.startsWith("scripts/")) return "scripts";
  if (datei.startsWith("client/")) return "client/src";
  if (datei.startsWith("server/lib/")) return "server/lib";
  if (datei.startsWith("server/routes/")) return "server/routes";
  return "server";
}

function pfadVon(datei: string): string | null {
  for (const k of KRITISCH) if (k.muster.test(datei)) return k.name;
  return null;
}

function main(): void {
  // `git ls-files` statt eines eigenen Verzeichnis-Durchlaufs: Was nicht im
  // Repo liegt, geht auch nicht in Betrieb.
  const dateien = execSync("git ls-files '*.ts' '*.tsx'", { encoding: "utf-8" })
    .split("\n").map((s) => s.trim()).filter(Boolean)
    // Die eigene Datei würde sich selbst finden (die Muster stehen darin).
    .filter((f) => !f.endsWith("scripts/mess-stille-fehler.ts"));

  const treffer: Treffer[] = [];
  // MUSTER A — catch ohne jede Ausgabe.
  const leerCatch = /\.catch\(\s*\(\s*(?:_|e|err|error)?\s*\)\s*=>\s*(\{\s*\}|null|\[\]|undefined|0|false|"")\s*\)/;
  const leerBlock = /catch\s*(?:\(\s*\w*\s*\))?\s*\{\s*\}/;
  // MUSTER B — Antwortprüfung, die ohne Meldung abbricht.
  const stillesReturn = /if\s*\(\s*![\w.?]*\??\.?ok\s*\)\s*return\s*;/;

  for (const datei of dateien) {
    let inhalt: string;
    try { inhalt = readFileSync(datei, "utf-8"); } catch { continue; }
    const zeilen = inhalt.split("\n");
    zeilen.forEach((z, i) => {
      const code = z.trim();
      // ── KOMMENTARE SIND KEINE TREFFER (behoben 21.08.2026) ────────────
      // Der erste Entwurf fand 34 „kritische" Stellen — darunter sechs
      // Kommentarzeilen, die das Muster ZITIEREN, weil an genau dieser Stelle
      // schon einmal ein stiller Fehler behoben wurde. Ein Prüfstand, der die
      // Dokumentation seiner eigenen Behebung als Fehler meldet, wird beim
      // zweiten Lesen abgeschaltet (AGENTS.md: „13 Fehlalarme").
      if (/^(\/\/|\*|\/\*|--)/.test(code)) return;
      if (leerCatch.test(code) || leerBlock.test(code)) {
        // Ein `.catch(() => null)` ist weich, wenn der Rückgabewert danach
        // geprüft wird — das ist ein Rückfall, kein Verschlucken.
        const naechste = zeilen.slice(i, i + 4).join(" ");
        const weich = /=>\s*(null|\[\])\s*\)/.test(code)
          && /(if\s*\(\s*!|\?\?|\?\.|\|\||\.length)/.test(naechste);
        treffer.push({
          datei, zeile: i + 1, code: code.slice(0, 120), muster: "A", weich,
          bereich: bereichVon(datei), pfad: pfadVon(datei),
        });
      }
      if (stillesReturn.test(code)) {
        // Steht in den vier Zeilen davor oder danach eine Meldung? Dann ist es
        // kein stilles Abbrechen.
        const umfeld = zeilen.slice(Math.max(0, i - 4), i + 5).join(" ");
        const meldet = /(setFehler|setMeldung|setDatenFehler|zeige\(|flash\(|toast|alert\(|console\.(error|warn))/.test(umfeld);
        if (!meldet) {
          treffer.push({
            datei, zeile: i + 1, code: code.slice(0, 120), muster: "B", weich: false,
            bereich: bereichVon(datei), pfad: pfadVon(datei),
          });
        }
      }
    });
  }

  const harte = treffer.filter((t) => !t.weich);
  const kritisch = harte.filter((t) => t.pfad && t.bereich !== "scripts");

  log(`  ${dateien.length} Dateien durchsucht`);
  log(`  ${treffer.length} Treffer, davon ${harte.length} hart und ${treffer.length - harte.length} weich`);
  log(`  ${kritisch.length} auf einem kritischen Pfad (ohne scripts/)\n`);
  for (const b of ["server/lib", "server/routes", "server", "client/src", "scripts"]) {
    const n = harte.filter((t) => t.bereich === b);
    log(`  ${String(n.length).padStart(5)}  ${b}`
      + `  (A: ${n.filter((t) => t.muster === "A").length}, B: ${n.filter((t) => t.muster === "B").length})`);
  }

  // ── DER BERICHT ────────────────────────────────────────────────────────
  const zeile = (t: Treffer) =>
    `| \`${t.datei}:${t.zeile}\` | ${t.muster} | \`${t.code.replace(/\|/g, "\\|")}\` |`;

  const md: string[] = [
    "# Stille Fehlerschlucker — Arbeitsvorrat",
    "",
    `Erzeugt von \`scripts/mess-stille-fehler.ts\` über ${dateien.length} Dateien aus \`git ls-files\`.`,
    "",
    "**Muster A** — `catch` ohne jede Ausgabe (`.catch(() => {})`, leerer Block).",
    "**Muster B** — `if (!j?.ok) return;` ohne Meldung im Umfeld.",
    "",
    "Weiche Treffer (`.catch(() => null)`, dessen Rückgabe danach geprüft wird)",
    "sind ausgenommen: Das ist ein Rückfall, kein Verschlucken.",
    "",
    "## Zahlen",
    "",
    "| Bereich | hart | Muster A | Muster B |",
    "|---|---|---|---|",
    ...["server/lib", "server/routes", "server", "client/src", "scripts"].map((b) => {
      const n = harte.filter((t) => t.bereich === b);
      return `| ${b} | ${n.length} | ${n.filter((t) => t.muster === "A").length} | `
        + `${n.filter((t) => t.muster === "B").length} |`;
    }),
    "",
    `Gesamt hart: **${harte.length}** · auf kritischen Pfaden: **${kritisch.length}**`,
    "",
    "## Kritische Pfade — hier zuerst",
    "",
    "Ein verschluckter Fehler kostet hier Geld oder Vertrauen.",
    "",
  ];

  for (const k of KRITISCH) {
    const n = kritisch.filter((t) => t.pfad === k.name);
    md.push(`### ${k.name} (${n.length})`, "");
    if (n.length === 0) { md.push("Keiner.", ""); continue; }
    md.push("| Fundstelle | Muster | Code |", "|---|---|---|", ...n.map(zeile), "");
  }

  md.push("## Der Rest, nach Bereich", "");
  for (const b of ["server/lib", "server/routes", "server", "client/src"]) {
    const n = harte.filter((t) => t.bereich === b && !(t.pfad && kritisch.includes(t)));
    md.push(`### ${b} (${n.length})`, "");
    if (n.length === 0) { md.push("Keiner.", ""); continue; }
    md.push("| Fundstelle | Muster | Code |", "|---|---|---|", ...n.map(zeile), "");
  }

  md.push(
    "## scripts/ — bewusst nicht behoben", "",
    `${harte.filter((t) => t.bereich === "scripts").length} Treffer. In einem Prüfstand`,
    "ist ein `.catch(() => {})` um einen Playwright-Zeitablauf richtig: Der",
    "Prüfstand meldet sein Ergebnis selbst, und ein Abbruch beim Aufräumen würde",
    "die Abnahme verlieren. Sie stehen hier nicht als Arbeitsvorrat.", "",
  );

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/stille-fehler.md", md.join("\n"));
  log("\n  → reports/stille-fehler.md");
}

main();
