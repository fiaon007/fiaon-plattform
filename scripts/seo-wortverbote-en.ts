// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand: Wortverbote in den ENGLISCHEN Texten (03.09.2026, E-091)
//
// Die deutschen Wortverbote (garantiert, Beratung, Empfehlung, Affiliate,
// Score verbessern) gelten auch auf Englisch. Geprüft werden die en-Hälften
// aller Wörterbücher unter client/src/i18n und die en-Objekte in
// shared/fiaon-seo-seiten.ts. Verneinungen sind erlaubt („no legal advice",
// „not guaranteed"), weil sie genau das Versprechen ausschließen, das verboten ist.
//
// Aufruf: npx tsx scripts/seo-wortverbote-en.ts   (Exit 1 bei Treffern)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const VERBOTEN: { muster: RegExp; erlaubtDavor: RegExp | null; name: string }[] = [
  { muster: /\bguarantee[sd]?\b/gi, erlaubtDavor: /\b(no|not|never|without|nobody can|cannot|can't|nor)\s*(a |any |legal )?$/i, name: "guarantee" },
  { muster: /\badvice\b/gi, erlaubtDavor: /\b(no|not|never|without|neither|nor|instead of|replace|replaces|is not|are not)\s*(legal |financial |investment |loan |debt |professional |tax |a |any |or )*$/i, name: "advice" },
  { muster: /\brecommend(s|ed|ation|ations)?\b/gi, erlaubtDavor: null, name: "recommend" },
  { muster: /\bimprove(s|d)? (your|the|his|her|their) (score|credit score)\b/gi, erlaubtDavor: /\b(nobody can|cannot|can't|not|never|no one can)\s*$/i, name: "improve your score" },
  { muster: /\baffiliate(s)?\b/gi, erlaubtDavor: null, name: "affiliate" },
];

// Für „guarantee" und „advice" zählt der SATZ: Warnungen vor Garantien, Verneinungen,
// Zitate unseriöser Werbung und Eigennamen (consumer advice centre) sind erlaubt —
// verboten ist nur das eigene Versprechen. Für recommend/affiliate/improve your score gibt es keine Ausnahme.
const SATZ_ERLAUBT = /\b(no|not|never|nobody|no one|cannot|can't|beware|warning|promis\w*|fake|folklore|centre|substitute|legal advice|financial advice|investment advice|dubious|serious|legitimate|reputable|instead)\b|[“”"]/i;
function pruefeText(text: string, quelle: string, treffer: string[]) {
  for (const v of VERBOTEN) {
    for (const m of text.matchAll(v.muster)) {
      const davor = text.slice(Math.max(0, m.index! - 40), m.index);
      if (v.erlaubtDavor && v.erlaubtDavor.test(davor)) continue;
      if (v.name === "guarantee" || v.name === "advice") {
        const a = Math.max(text.lastIndexOf(". ", m.index!), text.lastIndexOf("? ", m.index!), text.lastIndexOf("! ", m.index!), text.lastIndexOf('", ', m.index!), text.lastIndexOf(': "', m.index!));
        const bEnde = [text.indexOf(". ", m.index!), text.indexOf("? ", m.index!), text.indexOf("! ", m.index!), text.indexOf('",', m.index!)].filter((x) => x >= 0);
        const b = bEnde.length ? Math.min(...bEnde) : text.length;
        if (SATZ_ERLAUBT.test(text.slice(Math.max(0, a), b + 1))) continue;
      }
      const umfeld = text.slice(Math.max(0, m.index! - 50), m.index! + m[0].length + 30).replace(/\s+/g, " ");
      treffer.push(`${quelle}: „${v.name}“ → …${umfeld}…`);
    }
  }
}

const treffer: string[] = [];
const i18n = path.join(WURZEL, "client/src/i18n");
for (const datei of fs.readdirSync(i18n)) {
  if (!datei.endsWith(".ts") || datei === "sprache.ts") continue;
  const q = fs.readFileSync(path.join(i18n, datei), "utf8");
  const schnitt = q.indexOf("\nconst en");
  if (schnitt < 0) continue;
  pruefeText(q.slice(schnitt), `client/src/i18n/${datei}`, treffer);
}
const seo = fs.readFileSync(path.join(WURZEL, "shared/fiaon-seo-seiten.ts"), "utf8");
for (const m of seo.matchAll(/\n    en: \{[\s\S]*?\n    \},/g)) pruefeText(m[0], "shared/fiaon-seo-seiten.ts (en-Objekt)", treffer);
for (const m of seo.matchAll(/export const SEO_WERKZEUGE_EN[\s\S]*?\n\];/g)) pruefeText(m[0], "shared/fiaon-seo-seiten.ts (SEO_WERKZEUGE_EN)", treffer);

if (treffer.length) {
  console.log(`Wortverbote (EN): ${treffer.length} Treffer`);
  for (const t of treffer) console.log("  FEHLER " + t);
  process.exit(1);
}
console.log("Wortverbote (EN): keine Treffer.");
