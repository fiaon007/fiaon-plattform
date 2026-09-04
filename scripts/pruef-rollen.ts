// ═══════════════════════════════════════════════════════════════════════════
// EINE ROLLE, DIE ES NICHT GIBT, TRIFFT NIEMANDEN
//
// ── DER SCHADEN (04.09.2026) ───────────────────────────────────────────────
// In fiaon-postmeister-werkzeuge.ts suchte der Rückfall für „wer ist
// zuständig" nach `rolle IN ('vertriebsleitung', 'leitung', 'admin')`. Die
// ersten beiden Werte gibt es nicht — die Rolle heißt 'vertriebsleiter'. Die
// Abfrage traf null Zeilen, kompilierte einwandfrei, und jede Aufgabe für
// einen Kunden ohne Betreuer landete als „Leitung" auf dem Betreiber-Brett,
// wo kein Mitarbeiter sie sieht (/agent/aufgaben liest nur
// zustaendig_art = 'agent'). Kein Fehler, keine Zeile im Log — nur eine
// Aufgabe, die niemand bekam. Zwei lagen so, seit dem 02.09.
//
// Kompilieren beweist bei einem Textwert nichts. Diese Wand liest den
// Quelltext und hält jede Mitarbeiter-Rolle gegen die Liste.
//
// ── DIE LISTE ──────────────────────────────────────────────────────────────
// fiaon_agents.rolle (Standard 'agent', server/routes/fiaon-agent.ts):
//   agent | onboarding | inkasso | vertriebsleiter | admin
// Dazu 'chef': keine Datenbank-Rolle, sondern die Sitzungsrolle des Chefbüros
// (fiaon-assistent.ts). Sie steht in den Werkzeug-Registern NEBEN den
// Mitarbeiter-Rollen und gehört deshalb in dieselbe Liste.
// Dieselbe Liste an drei anderen Orten: fiaon-mail-events.ts (Typ Rolle),
// fiaon-assistent-werkzeuge.ts (ALLE_ROLLEN), fiaon-zustaendigkeit.ts
// (ROLLEN_FUER). Wand 4 hält sie gegen die Datenbank, damit sie nicht
// unbemerkt veraltet.
//
// ── VIER WÄNDE ─────────────────────────────────────────────────────────────
//   1  SQL     rolle = '…', rolle IN (…), COALESCE(rolle, '…'), DEFAULT '…'
//   2  TS      rolle === "…", !==, ??, ||  — Vergleiche mit geladenen Werten
//   3  LISTEN  rollen: […], ROLLEN = […], ROLLEN_FUER { … }
//   4  DB      jede Rolle, die in fiaon_agents steht, kennt der Code
//              (nur mit DATABASE_URL; sonst übersprungen — und gesagt)
//
// ── WAS SIE NICHT PRÜFT, UND WARUM ────────────────────────────────────────
// Das Wort „rolle" hat in diesem Repo noch ZWEI andere Bedeutungen:
//   · wer in einem Gespräch spricht (kunde | assistent | nutzer | manager) —
//     fiaon-kontakt.ts, fiaon-assistent.ts, fiaon-office-academy.ts
//   · wer im Protokoll handelt (`rolle: "leitung"`, `rolle: "mitarbeiter"`,
//     SCP-Datenraum `rolle: "veraeusserer"`)
// Wand 2 lässt das Gesprächs-Vokabular durch (benannt, nicht erraten), und
// keine Wand liest `rolle: "…"`-Eigenschaften — dort leben die anderen
// Bedeutungen. Ein erster Entwurf, der alles las, hätte fünf Fehlalarme
// gemeldet. Eine Bremse, die falsch auslöst, ist gefährlicher als keine
// (AGENTS.md). Die Gegenproben in der Rot-Probe halten das fest.
//
//   npx tsx scripts/pruef-rollen.ts
//   npx tsx scripts/pruef-rollen.ts --rot-probe    (baut den Schaden nach)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MITARBEITER_ROLLEN = ["agent", "onboarding", "inkasso", "vertriebsleiter", "admin", "chef"] as const;
const KANON = new Set<string>(MITARBEITER_ROLLEN);
/** Wer in einem Gespräch spricht — kein Mitarbeiter. Wand 2 lässt sie durch. */
const GESPRAECHS_ROLLEN = new Set(["kunde", "assistent", "nutzer", "manager", "system"]);
const ORTE = ["server"];
const ROT_PROBE = process.argv.includes("--rot-probe");
/** Direkt aufgerufen — oder nur importiert (dann läuft nichts)? */
const HAUPT = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

let bestanden = 0;
let fehlgeschlagen = 0;
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; console.log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; console.log(`  FAIL  ${name}${detail ? `\n        → ${detail}` : ""}`); }
}

function dateien(ort: string): string[] {
  const raus: string[] = [];
  const gehe = (p: string) => {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const v = join(p, e);
      if (statSync(v).isDirectory()) gehe(v);
      else if (/\.ts$/.test(e)) raus.push(v);
    }
  };
  try { gehe(ort); } catch { /* Ort gibt es nicht */ }
  return raus;
}

/**
 * Kommentare raus. Eine Wand, die Kommentare liest, meldet Erklärungen —
 * etwa diesen Kopf, der den falschen Wert ZITIERT (AGENTS.md: „Wer die
 * Abwesenheit von Code prüft, schließt Kommentare UND Anzeigetext aus").
 */
function ohneKommentar(z: string): string {
  const t = z.trimStart();
  if (t.startsWith("//") || t.startsWith("--") || t.startsWith("*") || t.startsWith("/*")) return "";
  // Zeilenende-Kommentar. `://` (URLs) bleibt stehen — dort steht nie eine Rolle.
  return z.replace(/(^|[^:])\/\/.*$/, "$1");
}

interface Fund { wand: 1 | 2 | 3; wert: string; zeile: number; text: string }

// ── WAND 1: SQL ───────────────────────────────────────────────────────────
// Das „Subjekt" ist `rolle`, `a.rolle` oder `COALESCE(a.rolle, 'agent')` —
// letzteres steht in 30 Abfragen, und der Vergleich dahinter darf nicht
// durchrutschen, nur weil ein COALESCE davor steht.
const SUBJEKT = String.raw`(?:COALESCE\(\s*(?:\w+\.)?rolle\s*,\s*'[a-z_]+'\s*\)|\brolle\b)\s*\)?\s*`;
const SQL_EINZEL = new RegExp(SUBJEKT + String.raw`(?:=|<>|!=)\s*'([a-z_]+)'`, "gi");
const SQL_LISTE = new RegExp(SUBJEKT + String.raw`(?:NOT\s+)?IN\s*\(([^)]*)\)`, "gi");
const SQL_DEFAULT = /COALESCE\(\s*(?:\w+\.)?rolle\s*,\s*'([a-z_]+)'/gi;
const SQL_DDL = /\brolle\s+(?:TEXT|VARCHAR)\b[^,]*?DEFAULT\s+'([a-z_]+)'/gi;
// ── WAND 2: TS-Vergleiche ─────────────────────────────────────────────────
const TS_VERGLEICH = /\brolle\b\s*\)?\s*(?:===|!==|==|!=|\?\?|\|\|)\s*["']([a-z_]+)["']/g;
// ── WAND 3: Listen ────────────────────────────────────────────────────────
const LISTEN_ZEILE = /rollen/i;
const LISTEN_BLOCK_AUF = /\bROLLEN\w*\s*[:=]\s*\{/;
const STRING_ARRAY = /\[\s*((?:["'][a-z_]+["']\s*,?\s*)+)\]/g;

function alle(re: RegExp, text: string): string[] {
  const raus: string[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) raus.push(m[1]);
  return raus;
}
const literale = (s: string) => alle(/["']([a-z_]+)["']/g, s);

/** Prüft EINEN Quelltext und liefert jede Rolle, die nicht in der Liste steht. */
export function pruefeText(text: string): Fund[] {
  const funde: Fund[] = [];
  const zeilen = text.split("\n");
  let imBlock = false;
  let sammel: { start: number; text: string } | null = null;

  const melde = (wand: 1 | 2 | 3, werte: string[], i: number, z: string, durchlass?: Set<string>) => {
    for (const w of werte) {
      if (KANON.has(w) || durchlass?.has(w)) continue;
      funde.push({ wand, wert: w, zeile: i + 1, text: z.trim().slice(0, 110) });
    }
  };

  zeilen.forEach((roh, i) => {
    const z = ohneKommentar(roh);
    if (!z.trim()) return;

    // Wand 1 — SQL
    melde(1, alle(SQL_EINZEL, z), i, z);
    for (const liste of alle(SQL_LISTE, z)) melde(1, literale(liste), i, z);
    melde(1, alle(SQL_DEFAULT, z), i, z);
    melde(1, alle(SQL_DDL, z), i, z);

    // Wand 2 — TS-Vergleiche (Gesprächs-Rollen ausdrücklich durchgelassen)
    melde(2, alle(TS_VERGLEICH, z), i, z, GESPRAECHS_ROLLEN);

    // Wand 3 — Listen. Einzeilig, mehrzeilig (bis zur schließenden Klammer)
    // und die Zeilen innerhalb eines ROLLEN_…-Objekts.
    if (LISTEN_BLOCK_AUF.test(z)) imBlock = true;
    else if (imBlock && /^\s*\};?\s*$/.test(z)) imBlock = false;

    if (sammel) {
      sammel.text += " " + z;
      if (z.includes("]")) {
        for (const arr of alle(STRING_ARRAY, sammel.text)) melde(3, literale(arr), sammel.start, sammel.text);
        sammel = null;
      }
      return;
    }
    if (LISTEN_ZEILE.test(z) || imBlock) {
      if (z.includes("[") && !z.includes("]")) { sammel = { start: i, text: z }; return; }
      for (const arr of alle(STRING_ARRAY, z)) melde(3, literale(arr), i, z);
    }
  });
  return funde;
}

async function main(): Promise<void> {
// ═══════════════════════════════════════════════════════════════════════════
// ROT-PROBE — der Schaden, nachgebaut, und die Gegenproben
// ═══════════════════════════════════════════════════════════════════════════
if (ROT_PROBE) {
  console.log("\n══ Rot-Probe: findet die Wand den Schaden vom 04.09.2026? ══\n");
  const PROBEN: { text: string; erwartet: string[] }[] = [
    // Die zwei Zeilen, wie sie im Repo standen.
    { text: "     WHERE active IS NOT FALSE AND rolle IN ('vertriebsleitung', 'leitung', 'admin')", erwartet: ["leitung", "vertriebsleitung"] },
    { text: "     ORDER BY (rolle = 'vertriebsleitung') DESC, id ASC LIMIT 1", erwartet: ["vertriebsleitung"] },
    // Dieselbe Fehlerklasse in den anderen Formen.
    { text: "      AND COALESCE(a.rolle, 'agnet') IN ('agent', 'vertriebsleiter')", erwartet: ["agnet"] },
    { text: "      WHERE active AND rolle <> 'vertriebsleitung'", erwartet: ["vertriebsleitung"] },
    { text: `  if (req.agent!.rolle === "vertriebsleitung") return;`, erwartet: ["vertriebsleitung"] },
    { text: `  const r = String(a.rolle) !== "leitung";`, erwartet: ["leitung"] },
    { text: `    rollen: ["leitung", "admin"],`, erwartet: ["leitung"] },
    { text: `const ROLLEN = [\n  "agent",\n  "vertriebsleitung",\n];`, erwartet: ["vertriebsleitung"] },
    { text: `export const ROLLEN_FUER = {\n  inkasso: ["inkaso", "vertriebsleiter"],\n};`, erwartet: ["inkaso"] },
    // GEGENPROBEN — das darf NICHT rot werden. Eine Wand mit Fehlalarmen
    // wird beim dritten Mal abgeschaltet.
    { text: `        role: n.rolle === "kunde" ? "assistant" : "user",`, erwartet: [] },
    { text: `            role: n.rolle === "nutzer" ? "user" : "assistant",`, erwartet: [] },
    { text: `    String(req.params.ref), req.body, { ...alsAkteur(req), rolle: "leitung" },`, erwartet: [] },
    { text: `    rolle: "veraeusserer", bezeichnung: "Veräußerer",`, erwartet: [] },
    { text: `  // früher: rolle IN ('vertriebsleitung', 'leitung') — das war der Fehler`, erwartet: [] },
    { text: `      -- rolle = 'leitung' gab es nie`, erwartet: [] },
    { text: `     WHERE active AND rolle = 'vertriebsleiter' AND NOT COALESCE(is_test_account, FALSE)`, erwartet: [] },
    { text: `      AND COALESCE(rolle, 'agent') = ANY(\${rollen})`, erwartet: [] },
  ];
  for (const p of PROBEN) {
    const gefunden = pruefeText(p.text).map((f) => f.wert).sort();
    const soll = [...p.erwartet].sort();
    const passt = JSON.stringify(gefunden) === JSON.stringify(soll);
    const kurz = p.text.replace(/\s+/g, " ").trim().slice(0, 70);
    ok(`${soll.length ? "findet " + soll.join(", ") : "bleibt still"}  ·  ${kurz}`, passt,
      `gefunden: ${gefunden.length ? gefunden.join(", ") : "nichts"}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WÄNDE 1–3 — der Quelltext
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n══ Mitarbeiter-Rollen im Quelltext (server/) ══\n");
const treffer: { datei: string; f: Fund }[] = [];
let gelesen = 0;
for (const ort of ORTE) {
  for (const datei of dateien(ort)) {
    gelesen++;
    for (const f of pruefeText(readFileSync(datei, "utf8"))) treffer.push({ datei, f });
  }
}
const WAND = { 1: "SQL", 2: "TS", 3: "LISTE" } as const;
for (const { datei, f } of treffer) {
  console.log(`  FAIL  ${datei}:${f.zeile}  [${WAND[f.wand]}] '${f.wert}' ist keine Mitarbeiter-Rolle\n        ${f.text}`);
}
ok(`${gelesen} Dateien gelesen — jede Rolle steht in der Liste (${MITARBEITER_ROLLEN.join(" | ")})`,
  treffer.length === 0,
  `${treffer.length} Fundstelle(n). Die Rolle heißt 'vertriebsleiter', nicht 'vertriebsleitung' oder 'leitung'.`);

// ═══════════════════════════════════════════════════════════════════════════
// WAND 4 — die Datenbank kennt keine Rolle, die der Code nicht kennt
//
// Die andere Richtung derselben Drift: Bekommt jemand in der Datenbank eine
// Rolle, die hier nicht steht, greift keine Rechteprüfung des Codes für ihn.
// Nur mit DATABASE_URL — und ohne sie wird das GESAGT, nicht verschwiegen
// (AGENTS.md: ein Abschnitt ohne Prüfung ist kein Grün).
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n══ Rollen in der Datenbank ══\n");
if (!process.env.DATABASE_URL) {
  console.log("  ---   ÜBERSPRUNGEN: keine DATABASE_URL. Wand 4 hat NICHTS geprüft.");
  console.log("        DATABASE_URL=\"$DATABASE_URL_EXTERN\" npx tsx scripts/pruef-rollen.ts\n");
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  try {
    const zeilen = (await Promise.race([
      sqlPool`
        SELECT COALESCE(rolle, 'agent') AS rolle, COUNT(*)::int AS n,
               COUNT(*) FILTER (WHERE active IS NOT FALSE AND NOT COALESCE(is_test_account, FALSE))::int AS aktiv
        FROM fiaon_agents GROUP BY 1 ORDER BY 1
      `,
      new Promise<never>((_, nein) => setTimeout(() => nein(new Error("Datenbank antwortet nicht (15 s)")), 15_000)),
    ])) as { rolle: string; n: number; aktiv: number }[];
    const fremd = zeilen.filter((z) => !KANON.has(z.rolle));
    for (const z of zeilen) console.log(`        ${z.rolle.padEnd(16)} ${String(z.n).padStart(4)} Konten, ${String(z.aktiv).padStart(3)} aktiv und echt`);
    ok("Jede Rolle in fiaon_agents steht in der Liste", fremd.length === 0,
      `unbekannt: ${fremd.map((z) => `'${z.rolle}' (${z.n})`).join(", ")}`);
    // Kein Fehler, aber gut zu wissen: Ein Rückfall auf eine Rolle ohne
    // aktiven Träger landet bei der Leitung. Am 04.09.2026 galt das für
    // inkasso und onboarding — Rollenmodell vom 25.08.: keine Abteilungen mehr.
    const leer = MITARBEITER_ROLLEN.filter((r) => r !== "chef" && r !== "admin"
      && !zeilen.some((z) => z.rolle === r && z.aktiv > 0));
    if (leer.length) console.log(`  ---   ohne aktiven Träger: ${leer.join(", ")} — ein Rückfall auf diese Rolle landet bei der Leitung`);
  } catch (e: any) {
    console.log(`  ---   ÜBERSPRUNGEN: ${String(e?.message ?? e).slice(0, 120)}. Wand 4 hat NICHTS geprüft.`);
  } finally {
    await sqlPool.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n══ ${bestanden} PASS, ${fehlgeschlagen} FAIL ══\n`);
process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

if (HAUPT) main().catch((e) => { console.error(e); process.exit(1); });
