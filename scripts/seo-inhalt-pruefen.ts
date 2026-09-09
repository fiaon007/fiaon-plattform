// ═══════════════════════════════════════════════════════════════════════════
// INHALTS-PRÜFSTAND (03.09.2026, E-092) — misst mit demselben Maßstab wie der
// Seobility-Bericht vom 02.09.2026, aber über ALLE Seiten statt über eine
// Stichprobe von zehn. Der Bericht sagte: Technik 96 %, Struktur 100 %,
// Inhalt 74 %. Hier steht, woran das liegt — Seite für Seite.
//
// Geprüft wird der Korpus, den server/lib/fiaon-seiten-seo.ts ausliefert
// (H1, Lead, Abschnitte, Werkzeugliste, Glossar, Fragen, Weiterlesen) —
// genau der Text, den ein Crawler sieht, bevor React übernimmt.
//
//   npx tsx scripts/seo-inhalt-pruefen.ts            → Bericht
//   npx tsx scripts/seo-inhalt-pruefen.ts --json     → Maschinenform
// ═══════════════════════════════════════════════════════════════════════════
import { SEO_SEITEN, SEO_WERKZEUGE, SEO_WERKZEUGE_EN, SEO_GLOSSAR, SEO_GLOSSAR_EN, SEO_NAV, SEO_FUSS, seoFragen, schwesterPfad, seoSeite, type SeoSeite } from "../shared/fiaon-seo-seiten";
import { EN_NAV, EN_FUSS } from "../shared/fiaon-sprache";
import { titelPixel, beschreibungPixel, TITEL_MAX_PX, BESCHREIBUNG_MAX_PX, wortwiederholung } from "../shared/fiaon-pixel";

const JSONAUS = process.argv.includes("--json");
const STRENG = process.argv.includes("--streng");

/** Der Textkörper einer Seite — dieselben Bausteine wie im Vorrendering. */
function bloecke(s: SeoSeite): string[] {
  const en = s.sprache === "en";
  const b: string[] = [s.h1, s.lead];
  for (const a of s.abschnitte ?? []) { b.push(a.h2); b.push(a.text); for (const p of a.punkte ?? []) b.push(p); }
  if (s.pfad === "/werkzeuge" || s.pfad === "/en/tools")
    for (const w of en ? SEO_WERKZEUGE_EN : SEO_WERKZEUGE) b.push(`${w.name} – ${w.frage} ${w.satz}`);
  if (s.pfad === "/glossar-bonitaet" || s.pfad === "/en/credit-glossary")
    for (const g of en ? SEO_GLOSSAR_EN : SEO_GLOSSAR) b.push(`${g.wort} ${g.text}`);
  for (const f of seoFragen(s.pfad)) { b.push(f.f); b.push(f.a); }
  return b.filter(Boolean);
}

/**
 * Die Wörter der Weiterlesen-Liste — getrennt gehalten.
 *
 * 03.09.2026: Sie zählen bei der TEXTMENGE mit, weil Seobility Navigation und
 * Fußzeile mitzählt. Sie zählen bei DOPPELTEN BLÖCKEN NICHT mit: Der Linktext
 * ist die H1 der Zielseite, und die steht zwangsläufig auf jeder Seite, die
 * dorthin verweist. Das ist eine Verweisliste, kein doppelter Inhalt — beides
 * in einen Topf zu werfen meldet 70 Befunde, die keine sind.
 */
function verweisWoerter(s: SeoSeite): string[] {
  const en = s.sprache === "en";
  const out: string[] = [];
  for (const p of s.weiter ?? []) {
    const z = seoSeite(en ? (schwesterPfad(p, "en") ?? p) : p);
    if (z) out.push(z.h1.replace(/\s+/g, " "));
  }
  return out;
}

/** Seiten, deren Überschrift der Rechtsname des Dokuments ist. */
const RECHTSTEXTE = new Set(["/agb", "/impressum", "/privacy", "/widerrufsbelehrung"]);

const WORT = /[^\p{L}\p{N}]+/u;
const FUELL = new Set("der die das den dem des ein eine einer eines und oder aber auch für mit von vom im in am an auf aus bei bis durch gegen ohne um zu zur zum nach seit über unter vor zwischen ist sind war waren wird werden kann können soll sollen muss müssen hat haben sie ihr ihre ihren wir uns was wer wie wo wann warum nicht kein keine als wenn dann noch nur schon mehr sehr the and or but also for with from in on at by to of a an is are was were will can could should must has have you your we us what who how where when why not no as if then still only more very".split(" "));
const wortliste = (t: string) => t.toLowerCase().split(WORT).filter((w) => w.length > 2 && !FUELL.has(w));
/** Normalform für den Blockvergleich — wie Seobility Textblöcke vergleicht. */
const normal = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
/** Stammform, damit „Werkzeuge“ und „Werkzeug“ als dasselbe Wort zählen. */
const stamm = (w: string) => w.replace(/(ungen|ungs|erin|innen|isch|lich|keit|heit|ende|enden|ern|est|end|ung|en|er|es|em|el|st|te|ts|s|e|n)$/u, "").slice(0, 8);

interface Befund { pfad: string; art: string; wert: string }
const befunde: Befund[] = [];
const alleBloecke = new Map<string, string[]>();   // Normalform -> Pfade
const seiten = Object.values(SEO_SEITEN).filter((s) => !String(s.robots ?? "").includes("noindex") && !s.canonical);

for (const s of seiten) {
  const b = bloecke(s);
  const text = b.join(" ");
  // Seobility zählt die ganze Seite — Navigation und Fußzeile gehören dazu.
  const en2 = s.sprache === "en";
  const rahmen = [...(en2 ? EN_NAV : SEO_NAV).map((n) => n[1]), ...(en2 ? EN_FUSS : SEO_FUSS).flatMap((g) => [g.titel, ...g.links.map((l) => l[1])])].join(" ");
  const verweise = verweisWoerter(s).join(" ");
  const woerter = (text + " " + rahmen + " " + verweise).split(/\s+/).filter(Boolean).length + 25;

  // 1. Titel: Pixelbreite und Wortwiederholung
  const tp = titelPixel(s.titel);
  if (tp > TITEL_MAX_PX) befunde.push({ pfad: s.pfad, art: "titel-zu-lang", wert: `${tp} px (max ${TITEL_MAX_PX}): ${s.titel}` });
  const wdh = wortwiederholung(s.titel);
  if (wdh.length) befunde.push({ pfad: s.pfad, art: "titel-wortwiederholung", wert: `${wdh.join(", ")}: ${s.titel}` });

  // 1b. Titel: fehlt, ein Wort, zu kurz
  // Der Bericht vom 02.09.2026 fand hier nichts. Die Prüfungen stehen trotzdem
  // hier, damit eine neue Seite nicht unbemerkt hinter den Maßstab zurückfällt.
  const titelWorte = s.titel.trim().split(/\s+/).filter(Boolean);
  if (!s.titel.trim()) befunde.push({ pfad: s.pfad, art: "titel-fehlt", wert: "(leer)" });
  else if (titelWorte.length < 2) befunde.push({ pfad: s.pfad, art: "titel-ein-wort", wert: s.titel });
  else if (s.titel.trim().length < 30) befunde.push({ pfad: s.pfad, art: "titel-zu-kurz", wert: `${s.titel.trim().length} Zeichen: ${s.titel}` });

  // 2. Beschreibung: Pixelbreite, und ebenso die untere Grenze
  const bp = beschreibungPixel(s.beschreibung);
  if (bp > BESCHREIBUNG_MAX_PX) befunde.push({ pfad: s.pfad, art: "beschreibung-zu-lang", wert: `${bp} px (max ${BESCHREIBUNG_MAX_PX}): ${s.beschreibung}` });
  const beschrWorte = s.beschreibung.trim().split(/\s+/).filter(Boolean);
  if (!s.beschreibung.trim()) befunde.push({ pfad: s.pfad, art: "beschreibung-fehlt", wert: "(leer)" });
  else if (beschrWorte.length < 2) befunde.push({ pfad: s.pfad, art: "beschreibung-ein-wort", wert: s.beschreibung });
  else if (s.beschreibung.trim().length < 50) befunde.push({ pfad: s.pfad, art: "beschreibung-zu-kurz", wert: `${s.beschreibung.trim().length} Zeichen: ${s.beschreibung}` });

  // 3. H1: 20–120 Zeichen, mehr als ein Wort, nicht gleich dem Titel
  //
  // 03.09.2026: Rechtstexte sind ausgenommen. Ihre Überschrift IST der
  // Rechtsname des Dokuments — „Datenschutzerklärung", „Widerrufsbelehrung",
  // „Impressum". Der Name ist zugleich der Suchbegriff, unter dem Menschen die
  // Seite suchen. Eine erklärende Überschrift daraus zu machen, würde beides
  // verschlechtern: die Auffindbarkeit und die rechtliche Eindeutigkeit.
  const h1 = s.h1.trim();
  if (!RECHTSTEXTE.has(s.pfad)) {
    if (h1.length < 20) befunde.push({ pfad: s.pfad, art: "h1-zu-kurz", wert: `${h1.length} Zeichen: ${h1}` });
    if (h1.split(/\s+/).filter(Boolean).length < 2) befunde.push({ pfad: s.pfad, art: "h1-ein-wort", wert: h1 });
  }
  if (h1.length > 120) befunde.push({ pfad: s.pfad, art: "h1-zu-lang", wert: `${h1.length} Zeichen: ${h1}` });
  if (normal(h1) === normal(s.titel)) befunde.push({ pfad: s.pfad, art: "h1-gleich-titel", wert: h1 });

  // 4. Schlüsselwörter aus Titel und H1 müssen im Text vorkommen
  const imText = new Set(wortliste(text).map(stamm));
  // Der Fließtext ohne H1 und Titel — daran misst Seobility die Überschrift.
  const imFliess = new Set(wortliste(b.slice(1).join(" ")).map(stamm));
  const fehltTitel = [...new Set(wortliste(s.titel))].filter((w) => !imText.has(stamm(w)) && w !== "fiaon");
  if (fehltTitel.length) befunde.push({ pfad: s.pfad, art: "titel-wort-fehlt-im-text", wert: fehltTitel.join(", ") });
  const fehltH1 = [...new Set(wortliste(h1))].filter((w) => !imFliess.has(stamm(w)) && w !== "fiaon");
  if (fehltH1.length) befunde.push({ pfad: s.pfad, art: "h1-wort-fehlt-im-text", wert: fehltH1.join(", ") });

  // 5. Textmenge
  if (woerter < 500) befunde.push({ pfad: s.pfad, art: "wenig-text", wert: `${woerter} Wörter` });

  // 6. Blöcke sammeln (nur solche mit Substanz — kurze Überschriften zählen nicht)
  const gesehen = new Set<string>();
  for (const roh of b) {
    const n = normal(roh);
    if (n.length < 40) continue;
    if (gesehen.has(n)) befunde.push({ pfad: s.pfad, art: "block-doppelt-auf-seite", wert: roh.slice(0, 70) });
    gesehen.add(n);
    (alleBloecke.get(n) ?? alleBloecke.set(n, []).get(n)!).push(s.pfad);
  }
}

// 7. Blöcke, die auf mehreren Seiten stehen
let mehrfach = 0;
for (const [n, pfade] of alleBloecke) {
  const einzig = [...new Set(pfade)];
  if (einzig.length > 1) { mehrfach++; if (befunde.filter((f) => f.art === "block-auf-mehreren-seiten").length < 40) befunde.push({ pfad: einzig.join(" · "), art: "block-auf-mehreren-seiten", wert: n.slice(0, 70) }); }
}

if (JSONAUS) { console.log(JSON.stringify({ befunde, mehrfach, seiten: seiten.length }, null, 1)); process.exit(0); }

const nachArt = new Map<string, Befund[]>();
for (const f of befunde) (nachArt.get(f.art) ?? nachArt.set(f.art, []).get(f.art)!).push(f);
console.log(`INHALTS-PRÜFSTAND — ${seiten.length} indexierbare Seiten\n`);
const reihenfolge = ["titel-fehlt", "beschreibung-fehlt", "titel-ein-wort", "beschreibung-ein-wort", "titel-zu-lang", "titel-zu-kurz", "beschreibung-zu-kurz", "titel-wortwiederholung", "beschreibung-zu-lang", "h1-zu-kurz", "h1-zu-lang", "h1-ein-wort", "h1-gleich-titel", "titel-wort-fehlt-im-text", "h1-wort-fehlt-im-text", "wenig-text", "block-doppelt-auf-seite", "block-auf-mehreren-seiten"];
for (const art of reihenfolge) {
  const liste = nachArt.get(art) ?? [];
  const gesamt = art === "block-auf-mehreren-seiten" ? mehrfach : liste.length;
  console.log(`${art.toUpperCase().replace(/-/g, " ")}: ${gesamt}`);
  for (const f of liste.slice(0, 12)) console.log(`   ${f.pfad}  →  ${f.wert}`);
  if (liste.length > 12) console.log(`   … und ${liste.length - 12} weitere`);
  console.log("");
}
console.log(`Blöcke auf mehreren Seiten insgesamt: ${mehrfach}`);

// Im Strengmodus ist jeder Befund ein Fehler — so hängt der Prüfstand daran.
if (STRENG && befunde.length) process.exit(1);
