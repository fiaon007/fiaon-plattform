// ═══════════════════════════════════════════════════════════════════════════
// FACHBEGRIFFE IM FLIESSTEXT VERLINKEN (27.10.2026, E-439)
//
// Die Live-Prüfung vom 27.10.2026 zählte im Fließtext der 86 Business-Seiten
// null Links: Linkkraft floss nur über Menü, Fuß, Brotkrumen und „Weiterlesen“.
// Hier steht, welcher Fachbegriff auf welche Seite zeigt. Server (Vorab-HTML)
// und Browser (global-seite.tsx) verlinken nach derselben Regel:
//   · nur das ERSTE Vorkommen eines Begriffs je Seite,
//   · höchstens SECHS Links je Seite,
//   · nie auf die eigene Seite, nie in Überschriften,
//   · Groß-/Kleinschreibung wie in der Liste (EIN ist nicht „ein“).
// Neue Seite mit eigenem Fachbegriff → Zeile hier ergänzen (deutsch und englisch).
// ═══════════════════════════════════════════════════════════════════════════

/** Begriff → Zielseite. Längere Begriffe zuerst (sie gewinnen gegen enthaltene kürzere). */
const BEGRIFFE: Record<"de" | "en", [string, string][]> = {
  de: [
    ["Registered Agent", "/business/wissen/registered-agent-adresse"],
    ["Form 5472", "/business/wissen/form-5472"],
    ["US-Geschäftskonto", "/business/us-geschaeftskonto"],
    ["Business Credit", "/business/wissen/business-credit-usa"],
    ["D-U-N-S", "/business/wissen/business-credit-usa"],
    ["Kartenleiter", "/business/firmenkarten-kapital"],
    ["Credit Score", "/business/wissen/us-bonitaet-aufbauen"],
    ["US-Funding", "/business/wissen/us-funding"],
    ["E-2-Visum", "/business/wissen/e2-visum"],
    ["Tochtergesellschaft", "/business/tochtergesellschaft-usa"],
    ["Corporation", "/business/wissen/llc-oder-corporation"],
    ["Wyoming", "/business/wyoming"],
    ["Delaware", "/business/delaware"],
    ["Florida", "/business/florida"],
    ["ITIN", "/business/wissen/itin-beantragen"],
    ["EIN", "/business/wissen/ein-beantragen"],
  ],
  en: [
    ["registered agent", "/en/business/knowledge/registered-agent-address"],
    ["Form 5472", "/en/business/knowledge/form-5472"],
    ["US business bank account", "/en/business/us-business-bank-account"],
    ["business credit", "/en/business/knowledge/us-business-credit"],
    ["D-U-N-S", "/en/business/knowledge/us-business-credit"],
    ["card ladder", "/en/business/us-business-credit-cards"],
    ["credit score", "/en/business/knowledge/building-us-credit"],
    ["E-2 visa", "/en/business/knowledge/e2-visa-own-us-company"],
    ["subsidiary", "/en/business/us-subsidiary"],
    ["corporation", "/en/business/knowledge/llc-vs-corporation"],
    ["Wyoming", "/en/business/wyoming"],
    ["Delaware", "/en/business/delaware"],
    ["Florida", "/en/business/florida"],
    ["ITIN", "/en/business/knowledge/applying-for-an-itin"],
    ["EIN", "/en/business/knowledge/applying-for-an-ein"],
  ],
};

export const BEGRIFFE_JE_SEITE = 6;

export type Textteil = string | { text: string; pfad: string };

/** Merkt sich je Seite, was schon verlinkt ist. Eine Instanz je Seite und Durchlauf. */
export interface BegriffStand { sprache: "de" | "en"; eigenePfad: string; vergeben: Set<string>; anzahl: number; gibtEs: (pfad: string) => boolean }

export function begriffStand(sprache: "de" | "en", eigenePfad: string, gibtEs: (pfad: string) => boolean): BegriffStand {
  return { sprache, eigenePfad, vergeben: new Set(), anzahl: 0, gibtEs };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Zerlegt einen Absatz in Text und Links — nach den Regeln oben. Ändert `stand`. */
export function begriffeVerlinken(text: string, stand: BegriffStand): Textteil[] {
  let teile: Textteil[] = [text];
  for (const [wort, pfad] of BEGRIFFE[stand.sprache]) {
    if (stand.anzahl >= BEGRIFFE_JE_SEITE) break;
    if (stand.vergeben.has(pfad) || pfad === stand.eigenePfad || !stand.gibtEs(pfad)) continue;
    // Ganzes Wort, kein Bindestrich-Anschluss („EIN-Antrag“ zählt, „VEREIN“ nicht); englische Begriffe ohne Rücksicht auf den ersten Großbuchstaben.
    const muster = new RegExp(`(?<![\\p{L}\\p{N}-])${stand.sprache === "en" && /^[a-z]/.test(wort) ? `[${wort[0]}${wort[0].toUpperCase()}]${esc(wort.slice(1))}` : esc(wort)}(?![\\p{L}\\p{N}])`, "u");
    const neu: Textteil[] = [];
    let gefunden = false;
    for (const t of teile) {
      if (gefunden || typeof t !== "string") { neu.push(t); continue; }
      const m = muster.exec(t);
      if (!m) { neu.push(t); continue; }
      gefunden = true;
      if (m.index > 0) neu.push(t.slice(0, m.index));
      neu.push({ text: m[0], pfad });
      if (m.index + m[0].length < t.length) neu.push(t.slice(m.index + m[0].length));
    }
    if (gefunden) { stand.vergeben.add(pfad); stand.anzahl++; teile = neu; }
  }
  return teile;
}
