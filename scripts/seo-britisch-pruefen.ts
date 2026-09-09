// ═══════════════════════════════════════════════════════════════════════════
// Britisches Englisch auf allen englischen Seiten (09.09.2026, E-100)
//
// Justin: „Schau dir an, ob JEDE Seite wirklich PERFEKT ins Englische übersetzt
// wird." Entschieden wurde am 02.09. britisches Englisch — colour, organisation,
// licence, instalment. Bisher prüfte das niemand; seo-wortverbote-en sucht nur
// nach verbotenen Versprechen, nicht nach der Schreibung.
//
// Geprüft werden BEIDE Quellen, aus denen eine englische Seite entsteht:
//   · shared/fiaon-seo-seiten.ts — der Textkörper für den Crawler
//   · client/src/i18n/*.ts — der `en`-Block, den der Besucher sieht
//
//   npx tsx scripts/seo-britisch-pruefen.ts          (Bericht)
//   npx tsx scripts/seo-britisch-pruefen.ts --streng (Rückgabewert 1 bei Fund)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { SEO_SEITEN } from "../shared/fiaon-seo-seiten";

const STRENG = process.argv.includes("--streng");

/** Amerikanisch → britisch. Nur Fälle, die eindeutig sind. */
const AMERIKANISCH: [RegExp, string][] = [
  [/\bcolor(s|ed|ing)?\b/gi, "colour"],
  [/\bfavor(s|ed|ing|ite|ites)?\b/gi, "favour"],
  [/\bbehavior(s|al)?\b/gi, "behaviour"],
  [/\blabor(s|ed)?\b/gi, "labour"],
  [/\bneighbor(s|hood)?\b/gi, "neighbour"],
  [/\bcenter(s|ed)?\b/gi, "centre"],
  [/\bmeter(s)?\b/gi, "metre"],
  [/\bdefense\b/gi, "defence"],
  [/\boffense\b/gi, "offence"],
  [/\blicense\b(?!\s+(to|a)\b)/gi, "licence (Substantiv)"],
  [/\bpractice(s|d)?\b(?=\s+(the|a|an|his|her|their)\b)/gi, "practise (Verb)"],
  [/\borganiz(e|es|ed|ing|ation|ations)\b/gi, "organise"],
  [/\brecogniz(e|es|ed|ing)\b/gi, "recognise"],
  [/\bprioritiz(e|es|ed|ing)\b/gi, "prioritise"],
  [/\bsummariz(e|es|ed|ing)\b/gi, "summarise"],
  [/\bminimiz(e|es|ed|ing)\b/gi, "minimise"],
  [/\bmaximiz(e|es|ed|ing)\b/gi, "maximise"],
  [/\bapologiz(e|es|ed|ing)\b/gi, "apologise"],
  [/\banaly(z|zes|zed|zing)e?\b/gi, "analyse"],
  [/\bcatalog(s)?\b/gi, "catalogue"],
  [/\bdialog(s)?\b/gi, "dialogue"],
  [/\bprogram(s)?\b(?!\w)/gi, "programme (ausser EDV)"],
  [/\btravel(ed|ing)\b/gi, "travelled / travelling"],
  [/\bcancel(ed|ing)\b/gi, "cancelled / cancelling"],
  // „fulfilled" und „fulfilling" sind in BEIDEN Varianten richtig — nur der
  // Stamm mit zwei l ist amerikanisch: fulfill, fulfills, fulfillment.
  [/\bfulfill(s|ment)?\b(?!ed|ing)/gi, "fulfil / fulfils / fulfilment"],
  [/\benroll(ed|ing|ment)\b/gi, "enrol / enrolment"],
  [/\binstallment(s)?\b/gi, "instalment"],
  [/\binquir(y|ies)\b/gi, "enquiry / enquiries"],
  [/\bcheck\b(?=\s+(number|book))/gi, "cheque"],
  [/\bgray\b/gi, "grey"],
  [/\btire(s)?\b(?!d)/gi, "tyre"],
  [/\bmath\b/gi, "maths"],
];

/** Was wie amerikanisch aussieht, aber keins ist. */
const AUSNAHMEN = [
  /\bprogram(m)?ing\b/i,      // EDV
  /\bJavaScript program\b/i,
  /\bcheck\b/i,               // „check your entry" ist britisch wie amerikanisch
  /\bpractice\b/i,            // als Substantiv britisch korrekt
];

// ── Selbsttest ──────────────────────────────────────────────────────────────
// Ein Prüfer, der nichts findet, ist entweder gut oder kaputt. Diese Fälle
// unterscheiden das. Aufruf: npx tsx scripts/seo-britisch-pruefen.ts --selbsttest
const TESTFAELLE: [string, boolean][] = [
  ["the colour of the card", false], ["the color of the card", true],
  ["organised alphabetically", false], ["organized alphabetically", true],
  ["twelve instalments", false], ["twelve installments", true],
  ["fulfilled the plan", false], ["fulfilling the plan", false],
  ["fulfillment centre", true], ["we fulfil the plan", false],
  ["an enquiry at the bureau", false], ["an inquiry at the bureau", true],
  ["the defence is weak", false], ["the defense is weak", true],
  ["travelled to Vienna", false], ["traveled to Vienna", true],
  ["analyse the entry", false], ["analyze the entry", true],
  ["behaviour is reported", false], ["behavior is reported", true],
];

function selbsttest(): void {
  let fehler = 0;
  for (const [text, erwartet] of TESTFAELLE) {
    const treffer = AMERIKANISCH.some(([re]) => new RegExp(re.source, "i").test(text));
    if (treffer !== erwartet) { fehler++; console.log(`  FALSCH   „${text}" → erkannt=${treffer}, erwartet=${erwartet}`); }
    else console.log(`  richtig  „${text}" → ${treffer ? "amerikanisch" : "britisch"}`);
  }
  console.log(fehler ? `\n${fehler} von ${TESTFAELLE.length} Fällen falsch.` : `\nAlle ${TESTFAELLE.length} Fälle richtig.`);
  process.exit(fehler ? 1 : 0);
}
if (process.argv.includes("--selbsttest")) selbsttest();

interface Fund { quelle: string; ort: string; wort: string; soll: string; kontext: string }
const funde: Fund[] = [];

function pruefe(quelle: string, ort: string, text: string) {
  const t = String(text ?? "");
  if (!t) return;
  for (const [re, soll] of AMERIKANISCH) {
    if (!soll) continue;
    for (const m of t.matchAll(re)) {
      const kontext = t.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 40).replace(/\s+/g, " ");
      if (AUSNAHMEN.some((a) => a.test(kontext))) continue;
      funde.push({ quelle, ort, wort: m[0], soll, kontext });
    }
  }
}

// ── Quelle 1: die SEO-Tabelle ───────────────────────────────────────────────
for (const s of Object.values(SEO_SEITEN) as any[]) {
  if (s.sprache !== "en") continue;
  pruefe("Tabelle", `${s.pfad} titel`, s.titel);
  pruefe("Tabelle", `${s.pfad} beschreibung`, s.beschreibung);
  pruefe("Tabelle", `${s.pfad} h1`, s.h1);
  pruefe("Tabelle", `${s.pfad} lead`, s.lead);
  (s.abschnitte ?? []).forEach((a: any, i: number) => {
    pruefe("Tabelle", `${s.pfad} abschnitt ${i + 1}`, `${a.h2} ${a.text} ${(a.punkte ?? []).join(" ")}`);
  });
  (s.fragen ?? []).forEach((f: any, i: number) => pruefe("Tabelle", `${s.pfad} frage ${i + 1}`, `${f.f ?? f.frage} ${f.a ?? f.antwort}`));
}

// ── Quelle 2: die en-Blöcke der Wörterbücher ────────────────────────────────
const i18n = path.resolve(import.meta.dirname, "..", "client", "src", "i18n");
for (const f of fs.readdirSync(i18n).filter((x) => x.endsWith(".ts"))) {
  const roh = fs.readFileSync(path.join(i18n, f), "utf8");
  const i = roh.search(/\nconst en\s*:/);
  if (i < 0) continue;
  pruefe("Wörterbuch", f, roh.slice(i));
}

// ── Bericht ─────────────────────────────────────────────────────────────────
if (!funde.length) {
  console.log("Britisches Englisch: keine amerikanischen Schreibungen gefunden.");
  process.exit(0);
}
const nachWort = new Map<string, Fund[]>();
funde.forEach((x) => { const k = x.wort.toLowerCase(); nachWort.set(k, [...(nachWort.get(k) ?? []), x]); });
console.log(`${funde.length} amerikanische Schreibungen in ${new Set(funde.map((x) => x.ort)).size} Stellen:\n`);
for (const [wort, liste] of Array.from(nachWort.entries()).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  „${wort}" → ${liste[0].soll}  (${liste.length}×)`);
  liste.slice(0, 3).forEach((x) => console.log(`      ${x.quelle} ${x.ort}: …${x.kontext}…`));
}
if (STRENG) process.exit(1);
