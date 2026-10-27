/**
 * PRÜFSTAND: EIGENES VORSCHAUBILD JE BUSINESS-ADRESSE (27.10.2026, E-439)
 *
 *   npx tsx scripts/pruef-og-business.ts
 *
 * Prüft ohne Datenbank und ohne Netz:
 *   1. jede Register-Seite (DE + EN), beide Übersichten und jede Landingpage steht in shared/fiaon-og-business.ts,
 *   2. die Datei liegt in client/public/og/business, ist ein JPEG mit 1200×630 und unter 300 KB (WhatsApp lädt größere nicht),
 *   3. das Redaktionsbild (DE/EN) für neue Redaktionsartikel ist da,
 *   4. das ausgelieferte Vorab-HTML trägt dieses Bild samt Maßen und eigenem Alternativtext — nie das Bonitäts-Bild,
 *   5. keine Datei im Ordner ist verwaist (Seite gelöscht, Bild geblieben).
 */
process.env.DATABASE_URL ||= "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { GLOBAL_SEITEN, GLOBAL_SEITEN_EN } = await import("../shared/fiaon-global-seiten");
const { LANDINGPAGES } = await import("../shared/fiaon-global-seiten/landingpages");
const { OG_BUSINESS } = await import("../shared/fiaon-og-business");
const { ogBusinessBild, ogDateiName, OG_BUSINESS_REDAKTION } = await import("../shared/fiaon-og-business-regeln");
const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");

let pruefungen = 0;
const fehler: string[] = [];
const ok = (bed: boolean, text: string) => { pruefungen++; if (!bed) fehler.push(text); };
const ORDNER = join(process.cwd(), "client/public/og/business");

/** Breite und Höhe aus dem SOF-Segment eines JPEG — ohne Bildbibliothek. */
function jpegMasse(datei: string): { b: number; h: number } | null {
  const d = readFileSync(datei);
  if (d[0] !== 0xff || d[1] !== 0xd8) return null;
  let i = 2;
  while (i < d.length) {
    if (d[i] !== 0xff) return null;
    const m = d[i + 1];
    const laenge = d.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: d.readUInt16BE(i + 5), b: d.readUInt16BE(i + 7) };
    i += 2 + laenge;
  }
  return null;
}

const pflicht = [
  ...GLOBAL_SEITEN.map((s) => s.pfad), ...GLOBAL_SEITEN_EN.map((s) => s.pfad), "/business", "/en/business",
  ...LANDINGPAGES.map((l) => l.pfad), OG_BUSINESS_REDAKTION.de, OG_BUSINESS_REDAKTION.en,
];

for (const pfad of pflicht) {
  const e = OG_BUSINESS[pfad];
  ok(!!e, `${pfad}: kein eigenes Vorschaubild — npx tsx scripts/og-business-bilder.ts laufen lassen`);
  if (!e) continue;
  ok(e.datei === ogDateiName(pfad), `${pfad}: Dateiname ${e.datei} ≠ Regel ${ogDateiName(pfad)}`);
  ok(e.alt.length >= 12 && !/Betriebssystem für Bonität/.test(e.alt) && /FIAON Global/.test(e.alt), `${pfad}: Alternativtext fehlt, nennt FIAON Global nicht oder trägt den Bonitäts-Werbesatz („${e.alt}“)`);
  const datei = join(ORDNER, `${e.datei}.jpg`);
  ok(existsSync(datei), `${pfad}: Datei fehlt (${datei})`);
  if (!existsSync(datei)) continue;
  const m = jpegMasse(datei);
  ok(!!m && m.b === 1200 && m.h === 630, `${pfad}: kein 1200×630-JPEG (${m ? `${m.b}×${m.h}` : "unlesbar"})`);
  ok(statSync(datei).size < 300_000, `${pfad}: ${Math.round(statSync(datei).size / 1000)} KB — WhatsApp zeigt Bilder über 300 KB nicht`);
}

// Das ausgelieferte HTML — für jede indexierbare Seite und die Übersichten.
for (const pfad of [...GLOBAL_SEITEN.map((s) => s.pfad), ...GLOBAL_SEITEN_EN.map((s) => s.pfad), "/business", "/en/business"]) {
  const html = seitenHtml(pfad, { bereich: "business" }) ?? "";
  const bild = ogBusinessBild(pfad);
  if (!bild) continue;
  ok(html.includes(`<meta property="og:image" content="${bild.url}"`), `${pfad}: og:image im Vorab-HTML ist nicht das eigene Bild`);
  ok(html.includes(`<meta name="twitter:image" content="${bild.url}"`), `${pfad}: twitter:image fehlt`);
  ok(html.includes('<meta property="og:image:width" content="1200"') && html.includes('<meta property="og:image:height" content="630"'), `${pfad}: Bildmaße fehlen`);
  ok(!/<meta [^>]*content="[^"]*Betriebssystem für Bonität/.test(html), `${pfad}: der Bonitäts-Werbesatz steht noch in einem Meta-Tag`);
  ok(!/<meta name="keywords"/.test(html), `${pfad}: Stichwörter der Privatkunden im Kopf`);
  ok(html.includes('<meta property="og:site_name" content="FIAON Global"'), `${pfad}: og:site_name ist nicht „FIAON Global“`);
  ok(html.includes('<meta name="twitter:card" content="summary_large_image"'), `${pfad}: twitter:card nicht summary_large_image`);
}

// Verwaiste Dateien.
if (existsSync(ORDNER)) {
  const bekannt = new Set(Object.values(OG_BUSINESS).map((e) => `${e.datei}.jpg`));
  for (const f of readdirSync(ORDNER)) ok(bekannt.has(f), `client/public/og/business/${f}: keine Seite dazu (verwaist — löschen oder Skript neu laufen lassen)`);
}

console.log(`\nVorschaubilder Business: ${Object.keys(OG_BUSINESS).length} in der Liste, ${pflicht.length} Pflichtadressen.`);
if (fehler.length) { console.log(fehler.map((f) => `  FEHLER  ${f}`).join("\n")); }
console.log(`${pruefungen} Prüfungen, ${fehler.length} Fehler.`);
process.exit(fehler.length ? 1 : 0);
