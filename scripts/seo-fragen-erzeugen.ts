// ═══════════════════════════════════════════════════════════════════════════
// SEO-FRAGEN ERZEUGEN — die sichtbaren FAQ jeder öffentlichen Seite als Datei
// (02.09.2026, E-079)
//
// ── WARUM ES DIESE DATEI GIBT ─────────────────────────────────────────────
// Der Server rendert seit E-079 für jede öffentliche Seite Titel, H1, Text
// und FAQ ins ausgelieferte HTML (server/lib/fiaon-seiten-seo.ts). Die FAQ
// stehen aber als FRAGEN-Konstanten in den Seitendateien unter
// client/src/pages/site/**. Zweimal pflegen wäre der sichere Weg in die
// Abweichung — und unsichtbares FAQ-Markup, das nicht zum sichtbaren Text
// passt, ist bei Google ein Abstrafungsgrund, kein Trick.
//
// Deshalb wird shared/fiaon-seo-fragen.ts NICHT von Hand geschrieben, sondern
// aus den Seitendateien erzeugt. Wer eine FAQ auf einer Seite ändert, ruft
// danach auf:
//
//     npx tsx scripts/seo-fragen-erzeugen.ts
//
// Mit --pruefen wird nur verglichen und bei Abweichung mit Fehlercode 1
// beendet — für die Abnahme vor dem Deploy.
//
// ── WAS ERKANNT WIRD ──────────────────────────────────────────────────────
// Objekte der Form { f: "…", a: "…" } mit reinen Zeichenketten. Antworten
// mit JSX (a: <>…</>) werden bewusst übersprungen: Sie enthalten Links und
// Formatierung, die im Vorrendering nicht sauber abgebildet wären.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";

const WURZEL = path.resolve(import.meta.dirname, "..");
const ZIEL = path.join(WURZEL, "shared", "fiaon-seo-fragen.ts");

/** Seitendatei → Pfad der Seite. Nur was hier steht, wird gelesen. */
const QUELLEN: Record<string, string> = {
  "client/src/pages/fiaon-home.tsx": "/",
  "client/src/pages/site/was-ist-fiaon.tsx": "/was-ist-fiaon",
  "client/src/pages/site/privatkunden.tsx": "/privatkunden",
  "client/src/pages/site/business.tsx": "/business",
  "client/src/pages/site/preise.tsx": "/preise",
  "client/src/pages/site/kreditkarte.tsx": "/kreditkarte",
  "client/src/pages/site/oesterreich.tsx": "/oesterreich",
  "client/src/pages/site/schweiz.tsx": "/schweiz",
  "client/src/pages/site/sicherheit.tsx": "/sicherheit",
  "client/src/pages/site/kontakt.tsx": "/kontakt",
  "client/src/pages/site/team.tsx": "/team",
  "client/src/pages/site/karriere.tsx": "/karriere",
  "client/src/pages/site/partner.tsx": "/partner",
  "client/src/pages/site/presse.tsx": "/presse",
  "client/src/pages/site/investoren.tsx": "/investoren",
  "client/src/pages/site/datenraum.tsx": "/datenraum",
  "client/src/pages/site/plattform-konzept.tsx": "/plattform-konzept",
  "client/src/pages/site/fiaon-erfahrungen.tsx": "/fiaon-erfahrungen",
  "client/src/pages/site/termin.tsx": "/termin",
  "client/src/pages/site/vergleich.tsx": "/vergleich",
  "client/src/pages/site/ueber-uns.tsx": "/ueber-uns",
  "client/src/pages/site/transparenz.tsx": "/transparenz",
  "client/src/pages/site/status.tsx": "/status",
  "client/src/pages/site/werkzeuge-hub.tsx": "/werkzeuge",
  "client/src/pages/site/werkzeuge/kreditrechner.tsx": "/werkzeuge/kreditrechner",
  "client/src/pages/site/werkzeuge/umschuldung.tsx": "/werkzeuge/umschuldung",
  "client/src/pages/site/werkzeuge/schulden-check.tsx": "/werkzeuge/schulden-check",
  "client/src/pages/site/werkzeuge/widerspruch.tsx": "/werkzeuge/widerspruch",
  "client/src/pages/site/werkzeuge/mahnbescheid.tsx": "/werkzeuge/mahnbescheid",
  "client/src/pages/site/werkzeuge/ratenplan.tsx": "/werkzeuge/ratenplan",
  "client/src/pages/site/werkzeuge/inkasso-antwort.tsx": "/werkzeuge/inkasso-antwort",
  "client/src/pages/site/werkzeuge/basiskonto.tsx": "/werkzeuge/basiskonto",
  "client/src/pages/site/werkzeuge/pfaendungsrechner.tsx": "/werkzeuge/pfaendungsrechner",
  "client/src/pages/site/werkzeuge/dispo-rechner.tsx": "/werkzeuge/dispo-rechner",
  "client/src/pages/site/werkzeuge/mahngebuehren.tsx": "/werkzeuge/mahngebuehren",
  "client/src/pages/site/werkzeuge/kartenkosten.tsx": "/werkzeuge/kartenkosten",
  "client/src/pages/site/werkzeuge/schuldenplan.tsx": "/werkzeuge/schuldenplan",
  "client/src/pages/site/kredit-ohne-schufa.tsx": "/kredit-ohne-schufa",
  "client/src/pages/site/schufa-eintrag-loeschen.tsx": "/schufa-eintrag-loeschen",
  "client/src/pages/site/bonitaet-verbessern.tsx": "/bonitaet-verbessern",
  "client/src/pages/site/auskunfteien.tsx": "/auskunfteien",
  "client/src/pages/site/schufa-score-verstehen.tsx": "/schufa-score-verstehen",
  "client/src/pages/site/bonitaetsauskunft-beantragen.tsx": "/bonitaetsauskunft-beantragen",
  "client/src/pages/site/inkasso-brief-erhalten.tsx": "/inkasso-brief-erhalten",
  "client/src/pages/site/eintrag-verjaehrung.tsx": "/eintrag-verjaehrung",
  "client/src/pages/site/girokonto-trotz-negativer-bonitaet.tsx": "/girokonto-trotz-negativer-bonitaet",
  "client/src/pages/site/ratenzahlung-und-bonitaet.tsx": "/ratenzahlung-und-bonitaet",
  "client/src/pages/site/selbstauskunft-checkliste.tsx": "/selbstauskunft-checkliste",
  "client/src/pages/site/schufa-neutral-anfragen.tsx": "/schufa-neutral-anfragen",
};

type Frage = { f: string; a: string };

function fragenAus(quelltext: string): Frage[] {
  const re = /\{\s*f:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"/gs;
  const out: Frage[] = [];
  for (const m of quelltext.matchAll(re)) {
    const f = m[1].replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    const a = m[2].replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    // Die Investorenseite führt jede Frage auf Deutsch UND Englisch; für die
    // deutsche Suche zählt nur die deutsche Fassung.
    if (/^(How|Is|Where|What|Why|Who|Can|Does)\b/.test(f)) continue;
    if (f && a) out.push({ f, a });
  }
  return out;
}

/** Das Glossar: Begriff und Erklärung, für das Vorrendering von /glossar-bonitaet. */
function glossarAus(quelltext: string): { wort: string; text: string }[] {
  const re = /\{\s*wort:\s*"((?:[^"\\]|\\.)*)",\s*text:\s*"((?:[^"\\]|\\.)*)"/gs;
  const out: { wort: string; text: string }[] = [];
  for (const m of quelltext.matchAll(re)) out.push({ wort: m[1].replace(/\\"/g, '"'), text: m[2].replace(/\\"/g, '"').replace(/\s+/g, " ").trim() });
  return out;
}

function erzeugen(): string {
  const bloecke: string[] = [];
  const glossarDatei = path.join(WURZEL, "client/src/pages/site/glossar-bonitaet.tsx");
  const glossar = fs.existsSync(glossarDatei) ? glossarAus(fs.readFileSync(glossarDatei, "utf8")) : [];
  const zaehler: string[] = [];
  for (const [datei, pfad] of Object.entries(QUELLEN)) {
    const voll = path.join(WURZEL, datei);
    if (!fs.existsSync(voll)) { console.warn(`[SEO-FRAGEN] fehlt: ${datei}`); continue; }
    const fragen = fragenAus(fs.readFileSync(voll, "utf8"));
    if (!fragen.length) continue;
    zaehler.push(`${pfad} (${fragen.length})`);
    bloecke.push(`  ${JSON.stringify(pfad)}: ${JSON.stringify(fragen, null, 2).replace(/\n/g, "\n  ")},`);
  }
  return `// ═══════════════════════════════════════════════════════════════════════════
// GENERIERT — NICHT VON HAND BEARBEITEN.
//
// Erzeugt von scripts/seo-fragen-erzeugen.ts aus den FRAGEN-Konstanten der
// öffentlichen Seiten. Enthält je Seite genau die Fragen, die dort sichtbar
// stehen — damit das FAQPage-Markup im Vorrendering (E-079) nie etwas
// behauptet, was der Besucher nicht sieht.
//
// Neu erzeugen:   npx tsx scripts/seo-fragen-erzeugen.ts
// Nur prüfen:     npx tsx scripts/seo-fragen-erzeugen.ts --pruefen
//
// Seiten: ${zaehler.join(", ")}
// ═══════════════════════════════════════════════════════════════════════════
export type SeoFrage = { f: string; a: string };

export const SEO_FRAGEN: Record<string, SeoFrage[]> = {
${bloecke.join("\n")}
};

/** Die Begriffe von /glossar-bonitaet (${glossar.length}). */
export const SEO_GLOSSAR: { wort: string; text: string }[] = ${JSON.stringify(glossar, null, 2)};
`;
}

const neu = erzeugen();
if (process.argv.includes("--pruefen")) {
  const alt = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, "utf8") : "";
  if (alt !== neu) {
    console.error("[SEO-FRAGEN] shared/fiaon-seo-fragen.ts ist veraltet — bitte neu erzeugen: npx tsx scripts/seo-fragen-erzeugen.ts");
    process.exit(1);
  }
  console.log("[SEO-FRAGEN] aktuell.");
} else {
  fs.writeFileSync(ZIEL, neu);
  console.log(`[SEO-FRAGEN] geschrieben: ${path.relative(WURZEL, ZIEL)} (${neu.length} Zeichen)`);
}
