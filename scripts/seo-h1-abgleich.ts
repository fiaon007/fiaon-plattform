// ═══════════════════════════════════════════════════════════════════════════
// H1-ABGLEICH (03.09.2026, E-092)
//
// Jede Seite trägt ihre Hauptüberschrift an zwei Stellen: in der Tabelle
// shared/fiaon-seo-seiten.ts (die der Server ins HTML schreibt) und im
// Wörterbuch client/src/i18n/<seite>.ts (die React anzeigt). Weichen sie
// voneinander ab, sieht ein Crawler ohne JavaScript eine andere Überschrift
// als ein Besucher — und Google liest beides.
//
//   npx tsx scripts/seo-h1-abgleich.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { SEO_SEITEN } from "../shared/fiaon-seo-seiten";

const WURZEL = path.resolve(import.meta.dirname, "..");
const I18N = path.join(WURZEL, "client/src/i18n");

const zuordnung = new Map<string, string>();
for (const d of fs.readdirSync(I18N).filter((f) => f.endsWith(".ts"))) {
  const kopf = fs.readFileSync(path.join(I18N, d), "utf8").slice(0, 700);
  for (const m of kopf.matchAll(/(^|[\s·(])(\/[a-z0-9\-\/]+)/gm)) {
    const p = m[2].replace(/[.,)]$/, "");
    if (p.length > 1 && !zuordnung.has(p)) zuordnung.set(p, d);
  }
}

/**
 * Findet das h1a/h1b-Paar für einen Pfad in einem Wörterbuch.
 * Manche Dateien tragen ZWEI Seiten (laender.ts: oesterreich und schweiz) —
 * dann wird der Block gesucht, der nach dem Pfad benannt ist.
 */
export function h1AusWoerterbuch(quelle: string, pfad: string, englisch: boolean): { h1: string; h1a: string; h1b: string; von: number; bis: number } | null {
  const schnitt = quelle.indexOf("\nconst en");
  const von = englisch ? (schnitt >= 0 ? schnitt : 0) : 0;
  const bis = englisch ? quelle.length : (schnitt >= 0 ? schnitt : quelle.length);
  let teil = quelle.slice(von, bis);
  let versatz = von;
  const paare = [...teil.matchAll(/\b(?:h1a|heroA):\s*"((?:[^"\\]|\\.)*)"\s*,\s*(?:h1b|heroB):\s*"((?:[^"\\]|\\.)*)"/g)];
  if (paare.length > 1) {
    // Mehrere Seiten in einer Datei: den Block nach dem letzten Pfadstück suchen.
    const stueck = pfad.split("/").filter(Boolean).pop() ?? "";
    const schluessel = { switzerland: "schweiz", austria: "oesterreich" }[stueck] ?? stueck.replace(/-/g, "");
    const blockStart = teil.search(new RegExp(`\\n  ${schluessel}:\\s*\\{`, "i"));
    if (blockStart >= 0) { versatz += blockStart; teil = teil.slice(blockStart); }
  }
  const m = teil.match(/\b(?:h1a|heroA):\s*"((?:[^"\\]|\\.)*)"\s*,\s*(?:h1b|heroB):\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  const h1a = JSON.parse(`"${m[1]}"`), h1b = JSON.parse(`"${m[2]}"`);
  return { h1: (h1a + h1b).replace(/\s+/g, " ").trim(), h1a, h1b, von: versatz, bis: versatz + teil.length };
}

// Nur ausführen, wenn direkt aufgerufen — als Modul liefert die Datei nur den Finder.
if (process.argv[1]?.endsWith("seo-h1-abgleich.ts")) {
  const abweichungen: string[] = [];
  let geprueft = 0, ohneWoerterbuch = 0;
  for (const s of Object.values(SEO_SEITEN) as any[]) {
    if (String(s.robots ?? "").includes("noindex") || s.canonical) continue;
    const datei = zuordnung.get(s.pfad);
    if (!datei) { ohneWoerterbuch++; continue; }
    const quelle = fs.readFileSync(path.join(I18N, datei), "utf8");
    const gefunden = h1AusWoerterbuch(quelle, s.pfad, s.sprache === "en");
    if (!gefunden) { ohneWoerterbuch++; continue; }
    geprueft++;
    const ausWoerterbuch = gefunden.h1;
    const ausTabelle = String(s.h1).replace(/\s+/g, " ").trim();
    if (ausWoerterbuch !== ausTabelle) abweichungen.push(`${s.pfad}\n    Tabelle:    ${ausTabelle}\n    Wörterbuch: ${ausWoerterbuch}`);
  }
  console.log(`H1-ABGLEICH — ${geprueft} Seiten mit Wörterbuch geprüft, ${ohneWoerterbuch} ohne\n`);
  if (!abweichungen.length) console.log("Keine Abweichung.");
  else { console.log(`${abweichungen.length} Abweichungen:`); for (const a of abweichungen) console.log("  " + a); }
  process.exit(abweichungen.length ? 1 : 0);
}
