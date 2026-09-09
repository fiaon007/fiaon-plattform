// ═══════════════════════════════════════════════════════════════════════════
// DIE SCHLANKE SEO-TABELLE FÜR DEN BROWSER (03.09.2026, E-092)
//
// Der Befund: shared/fiaon-seo-seiten.ts (199 kB) und shared/fiaon-seo-fragen.ts
// (215 kB) landeten im JavaScript jeder Seite, weil fünf Client-Dateien aus der
// großen Tabelle importierten. Gebraucht werden dort aber nur vier Felder je
// Pfad — Titel, Beschreibung, Sprache, Schwesterpfad — und die Werkzeugliste.
// Diese Datei enthält genau das. Die großen Tabellen bleiben auf dem Server.
//
//   npx tsx scripts/seo-kurz-erzeugen.ts            → schreiben
//   npx tsx scripts/seo-kurz-erzeugen.ts --pruefen  → nur prüfen (für den Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { SEO_SEITEN, SEO_WERKZEUGE, SEO_WERKZEUGE_EN } from "../shared/fiaon-seo-seiten";

const WURZEL = path.resolve(import.meta.dirname, "..");
const ZIEL = path.join(WURZEL, "shared/fiaon-seo-kurz.ts");

function erzeugen(): string {
  const zeilen = Object.values(SEO_SEITEN)
    .sort((a, b) => a.pfad.localeCompare(b.pfad))
    .map((s) => `  ${JSON.stringify(s.pfad)}: ${JSON.stringify({ titel: s.titel, beschreibung: s.beschreibung, ...(s.sprache ? { sprache: s.sprache } : {}), ...(s.schwester ? { schwester: s.schwester } : {}) })},`);
  const w = (liste: typeof SEO_WERKZEUGE) => JSON.stringify(liste.map((x) => ({ pfad: x.pfad, name: x.name, frage: x.frage, satz: x.satz })), null, 1);
  return `// ═══════════════════════════════════════════════════════════════════════════
// ERZEUGT — NICHT VON HAND ÄNDERN.
// Quelle: shared/fiaon-seo-seiten.ts · Generator: scripts/seo-kurz-erzeugen.ts
//
// Die Kurzfassung der Seitentabelle für den Browser: nur Titel, Beschreibung,
// Sprache und Schwesterpfad. Die vollständige Tabelle mit Lead, Abschnitten,
// Fragen und Glossar bleibt auf dem Server — sie wäre im Bündel jeder Seite
// über 400 kB tote Fracht (Befund des Seobility-Berichts vom 02.09.2026).
// ═══════════════════════════════════════════════════════════════════════════

export interface SeoKurz { titel: string; beschreibung: string; sprache?: "de" | "en"; schwester?: string }

export const SEO_KURZ: Record<string, SeoKurz> = {
${zeilen.join("\n")}
};

/** Pfad → Eintrag, mit derselben Normalisierung wie seoSeite() auf dem Server. */
export function seoKurz(pfad: string): SeoKurz | null {
  const p = (pfad.split("?")[0].replace(/\\/+$/, "") || "/").toLowerCase();
  return SEO_KURZ[p] ?? null;
}

/** Die Schwesterseite in der anderen Sprache — für den Sprachwechsler. */
export function schwesterKurz(pfad: string, ziel: "de" | "en"): string | null {
  const e = seoKurz(pfad);
  if (!e) return null;
  const eigene = e.sprache ?? "de";
  if (eigene === ziel) return pfad;
  return e.schwester ?? null;
}

/** Die zwanzig Werkzeuge — Reihenfolge und Texte wie in der großen Tabelle. */
export const WERKZEUGE_KURZ = ${w(SEO_WERKZEUGE)};

export const WERKZEUGE_KURZ_EN = ${w(SEO_WERKZEUGE_EN)};
`;
}

const neu = erzeugen();
if (process.argv.includes("--pruefen")) {
  const alt = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, "utf8") : "";
  if (alt !== neu) { console.error("[SEO-KURZ] shared/fiaon-seo-kurz.ts ist veraltet — npx tsx scripts/seo-kurz-erzeugen.ts"); process.exit(1); }
  console.log("[SEO-KURZ] aktuell.");
} else {
  fs.writeFileSync(ZIEL, neu);
  console.log(`[SEO-KURZ] geschrieben: shared/fiaon-seo-kurz.ts (${Math.round(neu.length / 1024)} kB)`);
}
