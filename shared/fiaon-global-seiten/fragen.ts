// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FRAGEN & ANTWORTEN (19.09.2026, E-191)
// Die Seite sammelt die Fragen aller Unterseiten — geordnet nach den Spalten
// des Menüs. Keine Frage wird hier von Hand geschrieben: Wer eine Antwort
// ändert, ändert sie auf ihrer Seite, und hier steht sie im selben Moment neu.
// Doppelte Fragen (gleicher Wortlaut) erscheinen einmal.
// E-510 (13.11.2026): Kopf, Blick und Kurzantwort nach dem Sprachleitfaden (Abschnitt 7.8 und 9.3). Titel und Beschreibung
// nennen kein Land neben Konto, Karte oder Finanzierung; das Honorar steht in drei Teilen, die Beträge kommen aus der
// Preisquelle (shared/fiaon-global-saetze.ts). Die Antworten selbst gehören den Seiten, von denen sie stammen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalBlock, GlobalSeite, MenueGruppe } from "./typen";
import { globalMenuePunkt } from "../fiaon-global-menue";
import { SAETZE_BETRAEGE, SECHS_SCHRITTE, satz } from "../fiaon-global-saetze";

const STAND = "2026-11-13";
/** Das Honorar als eine Zeile für „Auf einen Blick“ — immer alle drei Teile, Beträge aus der Preisquelle. */
const HONORAR_ZEILE = {
  de: `${SAETZE_BETRAEGE.de.honorarAuftrag} mit Ihrem Auftrag · Erfolgshonorar mit der Eintragung, mindestens ${SAETZE_BETRAEGE.de.erfolgMin} · ab dem zweiten Jahr auf Wunsch ${SAETZE_BETRAEGE.de.jahresbetreuung} im Jahr`,
  en: `${SAETZE_BETRAEGE.en.honorarAuftrag} on engagement · success fee on registration, at least ${SAETZE_BETRAEGE.en.erfolgMin} · from the second year, on request, ${SAETZE_BETRAEGE.en.jahresbetreuung} a year`,
} as const;
/** Schritt 5 (Finanzierung): was gilt, wenn sie ausbleibt — die Zeile aus der Tabelle „Wer macht was“ (mit Fristbeginn und Ziffer 4). */
const ERSTATTUNG = {
  de: SECHS_SCHRITTE.de.find((s) => s.nr === 5)?.werMachtWas.wennEsAusbleibt ?? satz("S7"),
  en: SECHS_SCHRITTE.en.find((s) => s.nr === 5)?.werMachtWas.wennEsAusbleibt ?? satz("S7", "en"),
} as const;

const GRUPPEN: { gruppe: MenueGruppe; id: string; h2: string; lead: string }[] = [
  { gruppe: "leistungen", id: "leistungen", h2: "Gründung, Steuernummern, Konten und Karten", lead: "Was FIAON Global übernimmt — und wo die Entscheidung bei Behörden und Instituten liegt." },
  { gruppe: "preise", id: "preise", h2: "Honorar und Ablauf", lead: "Was es kostet, wie lange es dauert, wie Sie Ihr Angebot anfordern." },
  { gruppe: "fuerwen", id: "fuerwen", h2: "Für wen", lead: "Mittelstand, Handel, Dienstleister, Bau — und die Regeln Ihres Wohnsitzlandes." },
  { gruppe: "wissen", id: "wissen", h2: "Steuern, Bundesstaaten und Rechtsformen", lead: "Die Grundlagen, mit Quellen und Stand." },
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
      titel: "US-Gesellschaft gründen: Fragen und Antworten — FIAON Global",
      beschreibung: "Antworten zu Gründung, Steuernummern, Honorar und Pflichten einer US-Gesellschaft — mit Quellen und der Angabe, wer jeweils entscheidet.",
    },
    stand: STAND,
    kennung: "FG · 17",
    auge: "Honorar und Ablauf · Fragen",
    h1: "Fragen zur US-Gesellschaft.",
    h1b: `${anzahl} Antworten, an einem Ort.`,
    lead: "Die Fragen, die uns Unternehmer vor einer US-Gründung stellen — mit den Antworten, die auch auf den jeweiligen Seiten stehen. Fehlt Ihre Frage, vereinbaren Sie ein Gespräch.",
    blick: [
      ["Gründung", "LLC in Delaware, Florida oder Wyoming"],
      ["EIN und ITIN", "Die US-Steuernummern — beantragt, nicht zugesagt"],
      ["Konten und Karten", "Vorbereitet von uns, entschieden vom Institut"],
      ["Finanzierung", "Anträge vollständig vorbereitet, begleitet bis zur Entscheidung des finanzierenden Instituts"],
      ["Erstattung", ERSTATTUNG.de],
      ["Honorar", HONORAR_ZEILE.de],
      ["Steuern", satz("S10")],
      ["Ihre Frage fehlt?", "Erstgespräch: dreißig Minuten, kostenfrei"],
    ],
    kurz: "Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein, beantragen die Steuernummern und bereiten Ihre Anträge für Konten, Karten und Finanzierung vollständig vor. Sie wählen den Namen, laden Ihren Reisepass hoch, unterzeichnen die Unterlagen und stellen die Anträge bei den Instituten selbst. Über Eintragung und Steuernummern entscheiden Bundesstaat und US-Steuerbehörde, über Konto, Karte und Finanzierung das jeweilige Institut.",
    bloecke,
    fragen: [],
    weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/ablauf", "/business/vergleich"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIESELBE SEITE AUF ENGLISCH (24.09.2026, E-234) — /en/business/faq
// Sammelt die Fragen der englischen Unterseiten. Die Gruppe kommt vom Menüpunkt
// der DEUTSCHEN Schwester (das Menü ist nach deutschen Pfaden geordnet); sonst
// fielen alle Leistungs-, Preis- und Zielgruppen-Fragen aus der englischen Seite.
// ═══════════════════════════════════════════════════════════════════════════
const GRUPPEN_EN: Record<MenueGruppe, { h2: string; lead: string }> = {
  leistungen: { h2: "Formation, tax identification numbers, accounts and cards", lead: "What FIAON Global handles — and where authorities and institutions make the decision." },
  preise: { h2: "Fees and process", lead: "What it costs, how long it takes, how you request your proposal." },
  fuerwen: { h2: "Who it is for", lead: "SMEs, e-commerce, service providers, construction — and the rules of your country of residence." },
  wissen: { h2: "Tax, states and legal forms", lead: "The fundamentals, stated plainly, with sources." },
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
      titel: "Forming a US company: questions and answers — FIAON Global",
      beschreibung: "Answers on formation, tax identification numbers, fees and obligations of a US company — with sources and a note on who decides in each case.",
    },
    stand: STAND,
    erschienen: "2026-09-24",
    kennung: "FG · 17",
    auge: "Fees and process · Questions",
    h1: "Questions about a US company.",
    h1b: `${anzahl} answers in one place.`,
    lead: "The questions business owners ask us before forming a US company — with the answers that also appear on the individual pages. If your question is missing, arrange a call.",
    blick: [
      ["Formation", "LLC in Delaware, Florida or Wyoming"],
      ["EIN and ITIN", "The tax identification numbers — applied for, not promised"],
      ["Accounts and cards", "Prepared by us, decided by the institution"],
      ["Financing", "Applications prepared in full, supported through to the lender’s decision"],
      ["Refund", ERSTATTUNG.en],
      ["Fees", HONORAR_ZEILE.en],
      ["Tax", satz("S10", "en")],
      ["Question not listed?", "Initial call: thirty minutes, free of charge"],
    ],
    kurz: "We form your US company, assemble every document, apply for its tax identification numbers and prepare your applications for accounts, cards and financing in full. You choose the name, upload your passport, sign the documents and submit the applications to the institutions yourself. The state and the US tax authority decide on registration and the numbers; the institution concerned decides on accounts, cards and financing.",
    bloecke,
    fragen: [],
    weiter: ["/en/business/us-company-formation", "/en/business/costs", "/en/business/process", "/en/business/comparison"],
  };
}
