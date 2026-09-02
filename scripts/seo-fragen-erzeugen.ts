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
  "client/src/i18n/was-ist-fiaon.ts": "/was-ist-fiaon|/en/what-is-fiaon",
  "client/src/i18n/privatkunden.ts": "/privatkunden|/en/personal",
  "client/src/i18n/business.ts": "/business|/en/business",
  // 02.09.2026: Die Fragen von /preise stehen im zweisprachigen Wörterbuch —
  // erste Hälfte (const de) → /preise, zweite Hälfte (const en) → /en/pricing.
  "client/src/i18n/preise.ts": "/preise|/en/pricing",
  "client/src/pages/site/en-start.tsx": "/en",
  "client/src/i18n/kreditkarte.ts": "/kreditkarte|/en/credit-card",
  "client/src/i18n/laender.ts#oesterreich": "/oesterreich|/en/austria@oesterreich",
  "client/src/i18n/laender.ts#schweiz": "/schweiz|/en/switzerland@schweiz",
  "client/src/i18n/sicherheit.ts": "/sicherheit|/en/security",
  "client/src/i18n/kontakt.ts": "/kontakt|/en/contact",
  "client/src/pages/site/team.tsx": "/team",
  "client/src/pages/site/karriere.tsx": "/karriere",
  "client/src/pages/site/partner.tsx": "/partner",
  "client/src/pages/site/presse.tsx": "/presse",
  "client/src/pages/site/investoren.tsx": "/investoren",
  "client/src/pages/site/datenraum.tsx": "/datenraum",
  "client/src/i18n/fiaon-erfahrungen.ts": "/fiaon-erfahrungen|/en/how-fiaon-works",
  "client/src/i18n/termin.ts": "/termin|/en/book-a-call",
  "client/src/i18n/vergleich.ts": "/vergleich|/en/compare",
  "client/src/i18n/hilfe.ts": "/hilfe|/en/help",
  "client/src/i18n/ueber-uns.ts": "/ueber-uns|/en/about",
  "client/src/i18n/transparenz.ts": "/transparenz|/en/transparency",
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
  "client/src/i18n/kredit-ohne-schufa.ts": "/kredit-ohne-schufa|/en/loans-without-schufa",
  "client/src/i18n/bonitaet-verbessern.ts": "/bonitaet-verbessern|/en/strengthen-your-credit-file",
  "client/src/i18n/auskunfteien.ts": "/auskunfteien|/en/credit-bureaus",
  "client/src/i18n/schufa-score-verstehen.ts": "/schufa-score-verstehen|/en/schufa-score",
  "client/src/i18n/bonitaetsauskunft-beantragen.ts": "/bonitaetsauskunft-beantragen|/en/request-your-credit-report",
  "client/src/i18n/inkasso-brief-erhalten.ts": "/inkasso-brief-erhalten|/en/debt-collection-letter",
  "client/src/i18n/eintrag-verjaehrung.ts": "/eintrag-verjaehrung|/en/entries-and-limitation",
  "client/src/i18n/girokonto.ts": "/girokonto-trotz-negativer-bonitaet|/en/current-account-despite-poor-credit",
  "client/src/i18n/ratenzahlung.ts": "/ratenzahlung-und-bonitaet|/en/instalments-and-credit-file",
  "client/src/i18n/selbstauskunft-checkliste.ts": "/selbstauskunft-checkliste|/en/reading-your-credit-report",
  "client/src/i18n/schufa-neutral-anfragen.ts": "/schufa-neutral-anfragen|/en/schufa-neutral-enquiries",
  "client/src/i18n/schufa-eintrag-loeschen.ts": "/schufa-eintrag-loeschen|/en/delete-a-schufa-entry",
  "client/src/i18n/plattform-konzept.ts": "/plattform-konzept|/en/how-the-platform-works",
};

type Frage = { f: string; a: string };

function fragenAus(quelltext: string, englisch = false): Frage[] {
  const re = /\{\s*f:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"/gs;
  const out: Frage[] = [];
  for (const m of quelltext.matchAll(re)) {
    const f = m[1].replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    const a = m[2].replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
    // Die Investorenseite führt jede Frage auf Deutsch UND Englisch; für die
    // deutsche Suche zählt nur die deutsche Fassung. Für eine ENGLISCHE Seite
    // (02.09.2026, en-Hälfte eines Wörterbuchs) gilt das Gegenteil.
    if (!englisch && /^(How|Is|Where|What|Why|Who|Can|Does|Am|Are|Which|Do)\b/.test(f)) continue;
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
  // 02.09.2026: Das Glossar lebt im Wörterbuch (de-Hälfte vor „const en", en-Hälfte danach).
  const glossarDatei = path.join(WURZEL, "client/src/i18n/glossar-bonitaet.ts");
  const glossarQuelle = fs.existsSync(glossarDatei) ? fs.readFileSync(glossarDatei, "utf8") : "";
  const glossarSchnitt = glossarQuelle.indexOf("\nconst en");
  const glossar = glossarAus(glossarSchnitt >= 0 ? glossarQuelle.slice(0, glossarSchnitt) : glossarQuelle);
  const glossarEn = glossarSchnitt >= 0 ? glossarAus(glossarQuelle.slice(glossarSchnitt)) : [];
  const zaehler: string[] = [];
  for (let [datei, pfad] of Object.entries(QUELLEN)) {
    // „datei#x" ist ein Schlüssel-Block in einem Wörterbuch mit mehreren
    // Seiten (z. B. laender.ts: oesterreich und schweiz) — nur dieser Block
    // zählt; der Pfad trägt „@x" als Marke, die hier wieder entfernt wird.
    const [dateiRein, block] = datei.split("#");
    const voll = path.join(WURZEL, dateiRein);
    if (!fs.existsSync(voll)) { console.warn(`[SEO-FRAGEN] fehlt: ${datei}`); continue; }
    const quelltextRoh = fs.readFileSync(voll, "utf8");
    const nurBlock = (text: string) => {
      if (!block) return text;
      const re = new RegExp(`\\n  ${block}: \\{`); const m = re.exec(text); if (!m) return "";
      const rest = text.slice(m.index + 1); const ende = rest.search(/\n  [a-z]+: \{/); return ende < 0 ? rest : rest.slice(0, ende);
    };
    const quelltext = quelltextRoh;
    pfad = pfad.replace(/@\w+$/, "");
    // Zweisprachiges Wörterbuch: „/de-pfad|/en-pfad" — der Quelltext wird an
    // `const en` geteilt, jede Hälfte gehört zu ihrer Seite.
    const teile = pfad.includes("|")
      ? (() => { const [pDe, pEn] = pfad.split("|"); const schnitt = quelltext.indexOf("\nconst en"); return schnitt < 0 ? [[pDe, nurBlock(quelltext)]] : [[pDe, nurBlock(quelltext.slice(0, schnitt))], [pEn, nurBlock(quelltext.slice(schnitt))]]; })()
      : [[pfad, nurBlock(quelltext)]];
    for (const [p, text] of teile) {
      const fragen = fragenAus(text, p.startsWith("/en"));
      if (!fragen.length) continue;
      zaehler.push(`${p} (${fragen.length})`);
      bloecke.push(`  ${JSON.stringify(p)}: ${JSON.stringify(fragen, null, 2).replace(/\n/g, "\n  ")},`);
    }
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

/** Die Begriffe von /en/credit-glossary (${glossarEn.length}). */
export const SEO_GLOSSAR_EN: { wort: string; text: string }[] = ${JSON.stringify(glossarEn, null, 2)};
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
