// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FRAGEN & ANTWORTEN (19.09.2026, E-191)
// Die Seite sammelt die Fragen aller Unterseiten — geordnet nach den Spalten
// des Menüs. Keine Frage wird hier von Hand geschrieben: Wer eine Antwort
// ändert, ändert sie auf ihrer Seite, und hier steht sie im selben Moment neu.
// Doppelte Fragen (gleicher Wortlaut) erscheinen einmal.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalBlock, GlobalSeite, MenueGruppe } from "./typen";
import { globalMenuePunkt } from "../fiaon-global-menue";

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
