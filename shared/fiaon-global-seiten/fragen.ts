// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FRAGEN & ANTWORTEN (19.09.2026, E-191)
// Die Seite sammelt die Fragen aller Unterseiten — geordnet nach den Spalten
// des Menüs. Keine Frage wird hier von Hand geschrieben: Wer eine Antwort
// ändert, ändert sie auf ihrer Seite, und hier steht sie im selben Moment neu.
// Doppelte Fragen (gleicher Wortlaut) erscheinen einmal.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalBlock, GlobalSeite, MenueGruppe } from "./typen";
import { globalMenuePunkt } from "../fiaon-global-menue";
import { GLOBAL_KAPITAL_FREI } from "../fiaon-global";

const GRUPPEN: { gruppe: MenueGruppe; id: string; h2: string; lead: string }[] = [
  { gruppe: "leistungen", id: "leistungen", h2: "Gründung, Steuernummern, Konto und Karten", lead: "Was FIAON Global übernimmt — und wo die Entscheidung bei Behörden und Instituten liegt." },
  { gruppe: "preise", id: "preise", h2: "Preise, Ablauf und Pakete", lead: "Was es kostet, wie lange es dauert, welches Paket passt." },
  { gruppe: "fuerwen", id: "fuerwen", h2: "Für wen", lead: "Mittelstand, Handel, Dienstleister, Bau — und die Regeln in Deutschland und der Schweiz." },
  { gruppe: "wissen", id: "wissen", h2: "Steuern, Bundesstaaten und Rechtsformen", lead: "Die Grundlagen, ehrlich erklärt." },
];

export function fragenSeite(alle: GlobalSeite[]): GlobalSeite {
  const gesehen = new Set<string>();
  const bloecke: GlobalBlock[] = [];
  for (const g of GRUPPEN) {
    const fragen = alle
      .filter((s) => (globalMenuePunkt(s.pfad)?.gruppe ?? (["wissen", "staat", "hub", "partner"].includes(s.art) ? "wissen" : null)) === g.gruppe)
      .flatMap((s) => s.fragen)
      .filter((f) => (gesehen.has(f.f) ? false : (gesehen.add(f.f), true)));
    if (fragen.length) bloecke.push({ typ: "fragen", id: g.id, h2: g.h2, lead: g.lead, fragen });
  }
  const anzahl = bloecke.reduce((n, b) => n + (b.typ === "fragen" ? b.fragen.length : 0), 0);
  return {
    pfad: "/business/fragen",
    art: "preise",
    seo: {
      titel: "Fragen zur US-Firmengründung — FIAON Global",
      beschreibung: "Alle Antworten zu FIAON Global: US-Gesellschaft, EIN und ITIN, Konto und Karten, Kosten, Ablauf, Steuern in Deutschland und der Schweiz.",
    },
    stand: "2026-09-19",
    kennung: "FG · 17",
    auge: "Preise und Ablauf · Fragen",
    h1: "Fragen und Antworten.",
    h1b: `${anzahl} Antworten, an einem Ort.`,
    lead: "Die Fragen, die uns Unternehmer vor einer US-Gründung stellen — mit den Antworten, die auch auf den jeweiligen Seiten stehen. Fehlt Ihre Frage, stellen Sie sie im Gespräch.",
    blick: [
      ["Gründung", "US-Gesellschaft ohne Wohnsitz und ohne Reise"],
      ["Steuernummern", "EIN für die Gesellschaft, ITIN für Sie"],
      ["Konto und Karten", "Vorbereitet von uns, entschieden vom Institut"],
      // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden. Die Frage dazu kommt von /business/firmenkarten-kapital.
      ["Kapital", `${GLOBAL_KAPITAL_FREI.de.kurz} — über Rahmen und Bedingungen entscheidet das Institut, die steuerliche Behandlung klärt unser Partner-Steuerberater vorab`],
      ["Kosten", "Festpreis, alle Gebühren inklusive"],
      ["Steuern", "Steuerpflicht dort, wo die Gesellschaft geführt wird"],
      ["Ihre Frage fehlt?", "Im Gespräch — dreißig Minuten, ohne Verpflichtung"],
    ],
    kurz: "Eine US-Gesellschaft lässt sich aus Deutschland, Österreich oder der Schweiz ohne Wohnsitz und ohne Reise gründen. FIAON Global übernimmt Gründung, EIN, ITIN, Registered Agent, Adresse und die Vorbereitung von Konto und Karten zum Festpreis. Über Konto, Karte und Rahmen entscheidet das Institut; steuerpflichtig bleibt die Gesellschaft in der Regel dort, wo sie geführt wird.",
    bloecke,
    fragen: [],
    weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/ablauf", "/business/paket-finder"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIESELBE SEITE AUF ENGLISCH (24.09.2026, E-234) — /en/business/faq
// Sammelt die Fragen der englischen Unterseiten. Die Gruppe kommt vom Menüpunkt
// der DEUTSCHEN Schwester (das Menü ist nach deutschen Pfaden geordnet); sonst
// fielen alle Leistungs-, Preis- und Zielgruppen-Fragen aus der englischen Seite.
// ═══════════════════════════════════════════════════════════════════════════
const GRUPPEN_EN: Record<MenueGruppe, { h2: string; lead: string }> = {
  leistungen: { h2: "Formation, tax numbers, account and cards", lead: "What FIAON Global takes on — and where authorities and institutions make the decision." },
  preise: { h2: "Prices, process and packages", lead: "What it costs, how long it takes, which package fits." },
  fuerwen: { h2: "Who it is for", lead: "SMEs, e-commerce, service providers, construction — and the rules in Germany and Switzerland." },
  wissen: { h2: "Tax, states and legal forms", lead: "The fundamentals, explained honestly." },
};

export function fragenSeiteEn(alle: GlobalSeite[]): GlobalSeite {
  const gesehen = new Set<string>();
  const bloecke: GlobalBlock[] = [];
  for (const g of GRUPPEN) {
    const fragen = alle
      .filter((s) => (globalMenuePunkt(s.schwester ?? "")?.gruppe ?? (["wissen", "staat", "hub", "partner"].includes(s.art) ? "wissen" : null)) === g.gruppe)
      .flatMap((s) => s.fragen)
      .filter((f) => (gesehen.has(f.f) ? false : (gesehen.add(f.f), true)));
    if (fragen.length) bloecke.push({ typ: "fragen", id: g.id, h2: GRUPPEN_EN[g.gruppe].h2, lead: GRUPPEN_EN[g.gruppe].lead, fragen });
  }
  const anzahl = bloecke.reduce((n, b) => n + (b.typ === "fragen" ? b.fragen.length : 0), 0);
  return {
    pfad: "/en/business/faq",
    sprache: "en",
    schwester: "/business/fragen",
    art: "preise",
    seo: {
      titel: "US company formation FAQ — FIAON Global",
      beschreibung: "All answers about FIAON Global: US company, EIN and ITIN, account and cards, costs, process, and tax in Germany and Switzerland.",
    },
    stand: "2026-09-24",
    erschienen: "2026-09-24",
    kennung: "FG · 17",
    auge: "Prices and process · FAQ",
    h1: "Questions and answers.",
    h1b: `${anzahl} answers in one place.`,
    lead: "The questions business owners ask us before forming a US company — with the answers that also appear on the individual pages. If your question is missing, ask it in a call.",
    blick: [
      ["Formation", "A US company without residence and without travel"],
      ["Tax numbers", "EIN for the company, ITIN for you"],
      ["Account and cards", "Prepared by us, decided by the institution"],
      ["Capital", `${GLOBAL_KAPITAL_FREI.en.kurz} — the institution decides on the limit and its terms, our partner tax adviser clarifies the tax treatment in advance`],
      ["Costs", "Fixed price, all fees included"],
      ["Tax", "Taxable where the company is managed"],
      ["Question not listed?", "In a call — thirty minutes, without obligation"],
    ],
    kurz: "A US company can be formed from Germany, Austria or Switzerland without residence and without travel. FIAON Global handles formation, EIN, ITIN, registered agent, address and the preparation of account and card applications at a fixed price. The institution decides on the account, the card and the limit; the company generally remains taxable where it is managed.",
    bloecke,
    fragen: [],
    weiter: ["/en/business/us-company-formation", "/en/business/costs", "/en/business/process", "/en/business/package-finder"],
  };
}
