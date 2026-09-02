// ═══════════════════════════════════════════════════════════════════════════
// RATGEBER-PRÜFSTAND (03.09.2026, E-092) — misst die Artikel nach demselben
// Maßstab wie der Seobility-Bericht: Titel und Beschreibung in Pixeln, H1-Länge,
// Überschriftenhierarchie, Zahl der Überschriften im Verhältnis zum Text,
// Länge und Doppelung von Fettungen, doppelte Textblöcke, Tippfehler.
//
//   DBURL=… npx tsx scripts/ratgeber-lesen.ts /tmp/ratgeber.json
//   npx tsx scripts/ratgeber-pruefen.ts /tmp/ratgeber.json [--json]
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import { titelPixel, beschreibungPixel, TITEL_MAX_PX, BESCHREIBUNG_MAX_PX, beschreibungKuerzen, titelMitMarke as ratgeberTitel } from "../shared/fiaon-pixel";


const artikel = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
const JSONAUS = process.argv.includes("--json");
// Häufige Tippfehler (Liste wie bei Seobility, auf unsere Texte zugeschnitten).
const TIPPFEHLER: [RegExp, string][] = [
  [/\bnich\b/g, "nicht"], [/\bdasss\b/g, "dass"], [/\bunf\b/g, "und"], [/\bmti\b/g, "mit"],
  [/\bdre\b/g, "der"], [/\bsich\s+sich\b/g, "sich"], [/\bmit\s+mit\b/g, "mit"], [/\bauf\s+auf\b/g, "auf"], [/\bvom\s+vom\b/g, "vom"], [/\bden\s+den\b/g, "den"],
  [/\bund\s+und\b/g, "und"],
  [/\bin\s+in\b/g, "in"], [/\bzu\s+zu\b/g, "zu"], [/\bist\s+ist\b/g, "ist"], [/\beine\s+eine\b/g, "eine"],
];

interface B { slug: string; art: string; wert: string }
const befunde: B[] = [];
const alleBloecke = new Map<string, string[]>();

for (const a of artikel) {
  const inhalt: string = a.inhalt || "";
  // Gemessen wird, was der Server ausliefert — mit Marke und Pixelkürzung.
  const titel: string = ratgeberTitel(a.meta_titel || a.titel);
  const beschr: string = beschreibungKuerzen(a.meta_beschreibung || a.teaser);

  const tp = titelPixel(titel);
  if (tp > TITEL_MAX_PX) befunde.push({ slug: a.slug, art: "titel-zu-lang", wert: `${tp} px: ${titel}` });
  const bp = beschreibungPixel(beschr);
  if (bp > BESCHREIBUNG_MAX_PX) befunde.push({ slug: a.slug, art: "beschreibung-zu-lang", wert: `${bp} px: ${beschr}` });
  if (a.titel.length > 120) befunde.push({ slug: a.slug, art: "h1-zu-lang", wert: `${a.titel.length} Zeichen: ${a.titel}` });

  // Überschriften aus dem Markdown
  const ueber = [...inhalt.matchAll(/^(#{2,6})\s+(.+)$/gm)].map((m) => ({ tiefe: m[1].length, text: m[2].trim() }));
  const woerter = inhalt.replace(/^#{1,6}\s+.*$/gm, "").split(/\s+/).filter(Boolean).length;
  // Seobility beanstandet „zu viele Überschriften“ ab etwa einer je 100 Wörter.
  // Schwelle gegen den Bericht vom 02.09.2026 geeicht: gemeldet wurden Artikel
  // ab 14 Überschriften, nicht gemeldet solche mit 13 und weniger.
  if (ueber.length >= 14) befunde.push({ slug: a.slug, art: "zu-viele-ueberschriften", wert: `${ueber.length} Überschriften auf ${woerter} Wörter` });
  const gesehenU = new Map<string, number>();
  for (const u of ueber) { const k = u.text.toLowerCase(); gesehenU.set(k, (gesehenU.get(k) ?? 0) + 1); }
  for (const [k, n] of gesehenU) if (n > 1) befunde.push({ slug: a.slug, art: "doppelte-ueberschrift", wert: `${n}×: ${k}` });
  // Hierarchie: nach H2 darf kein H4 kommen
  let vorher = 1;
  for (const u of ueber) { if (u.tiefe > vorher + 1) befunde.push({ slug: a.slug, art: "hierarchie-lueckenhaft", wert: `H${vorher} → H${u.tiefe}: ${u.text}` }); vorher = u.tiefe; }

  // Fettungen: **…** länger als 70 Zeichen oder doppelt
  const fett = [...inhalt.matchAll(/\*\*([^*]{1,400})\*\*/g)].map((m) => m[1].trim());
  for (const f of fett) if (f.length > 70) befunde.push({ slug: a.slug, art: "fettung-zu-lang", wert: `${f.length} Zeichen: ${f.slice(0, 60)}…` });
  const gesehenF = new Map<string, number>();
  for (const f of fett) { const k = f.toLowerCase(); gesehenF.set(k, (gesehenF.get(k) ?? 0) + 1); }
  for (const [k, n] of gesehenF) if (n > 1) befunde.push({ slug: a.slug, art: "fettung-doppelt", wert: `${n}×: ${k.slice(0, 50)}` });

  // Tippfehler
  const allesText = [inhalt, a.titel, a.untertitel, a.teaser, a.meta_titel, a.meta_beschreibung, JSON.stringify(a.faq ?? [])].filter(Boolean).join("\n");
  for (const [muster, richtig] of TIPPFEHLER) { const t = allesText.match(muster); if (t) befunde.push({ slug: a.slug, art: "tippfehler", wert: `${t[0]} → ${richtig} (${t.length}×)` }); }

  // Textblöcke: Absätze
  const absaetze = inhalt.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 60 && !x.startsWith("#"));
  const aufSeite = new Map<string, number>();
  for (const p of absaetze) { const k = p.toLowerCase(); aufSeite.set(k, (aufSeite.get(k) ?? 0) + 1); (alleBloecke.get(k) ?? alleBloecke.set(k, []).get(k)!).push(a.slug); }
  for (const [k, n] of aufSeite) if (n > 1) befunde.push({ slug: a.slug, art: "block-doppelt-auf-seite", wert: `${n}×: ${k.slice(0, 60)}` });
}

let ueberSeiten = 0;
for (const [k, slugs] of alleBloecke) { const e = [...new Set(slugs)]; if (e.length > 1) { ueberSeiten++; befunde.push({ slug: e.join(" · "), art: "block-auf-mehreren-artikeln", wert: k.slice(0, 60) }); } }

if (JSONAUS) { console.log(JSON.stringify(befunde, null, 1)); process.exit(0); }
const nach = new Map<string, B[]>();
for (const b of befunde) (nach.get(b.art) ?? nach.set(b.art, []).get(b.art)!).push(b);
console.log(`RATGEBER-PRÜFSTAND — ${artikel.length} veröffentlichte Artikel\n`);
for (const [art, liste] of [...nach].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${art.toUpperCase().replace(/-/g, " ")}: ${liste.length}`);
  for (const b of liste.slice(0, 10)) console.log(`   ${b.slug}  →  ${b.wert}`);
  if (liste.length > 10) console.log(`   … und ${liste.length - 10} weitere`);
  console.log("");
}
