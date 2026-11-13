// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „US-BUNDESSTAAT FÜR IHRE LLC“ (E-465, 29.10.2026 · Wortlaut E-510, 13.11.2026)
//
// Die Wissensseite FG · 27 (/business/wissen/bundesstaat-waehlen und
// /en/business/knowledge/choosing-a-state) entsteht für BEIDE Sprachen aus einer
// Funktion — Kurz-Zeiten, Express und Beträge kommen aus
// shared/fiaon-global-bundesstaaten.ts. So sind deutsche und englische Seite immer
// gleich gebaut (gleich viele Ziffern, Blick-Zeilen, Fragen und Quellen — das prüft
// scripts/pruef-global-en.ts).
//
// Vorher (seit E-191, 19.09.2026): „Drei Fragen entscheiden“ mit Florida vorn, ohne
// Zeiten. Seit 29.10.2026: Eintragungszeiten als Erfahrungswerte (Florida derzeit
// länger, kein Express), Delaware als Standard für neue Mandate, Wyoming mit der
// niedrigsten Jahresgebühr, Nevada zur Einordnung.
//
// E-510 (13.11.2026) — Wortlaut nach dem Sprachleitfaden:
//   · Jede Dauer steht als Erfahrungswert mit Stand und mit dem, der entscheidet — nie in Titel,
//     Beschreibung, H1, Lead oder als große Zahl (Leitfaden 5.5). Die drei Kennziffern sind deshalb
//     die Jahresgebühren der Staaten (Zahlen Dritter mit Quelle), nicht mehr die Zeiten.
//   · Tempo und Preis sind keine Werbewörter: „kurze Eintragungszeit“ und „niedrige Jahresgebühr“
//     statt der alten Steigerungsformen.
//   · Kein Satz über ein eigenes Team vor Ort; „Banken und Investoren ist Delaware vertraut.“
//   · Keine Dauer für die EIN, bis die Quelle zur heutigen Praxis passt (Leitfaden 5.5):
//     EIN_ZEITEN aus fiaon-global-bundesstaaten.ts steht hier nicht mehr.
//   · STAAT_SEITENTEXT unten hält die Sätze je Staat, die diese Seite und die drei Staatsseiten
//     (staaten.ts, en/staaten.ts) brauchen. Die Felder einordnung, vorteile, nachteile, passtFuer und
//     eintragung in fiaon-global-bundesstaaten.ts tragen noch den alten Wortlaut; jene Datei speist
//     auch Angebote und Verträge und wird hier nicht angefasst.
// ═══════════════════════════════════════════════════════════════════════════
import {
  BUNDESSTAATEN, STAAT_BANKEN, STAATEN_BETRAEGE_STAND, STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL,
  type AngebotenerStaat, type Sprache,
} from "../fiaon-global-bundesstaaten";
import { satz } from "../fiaon-global-saetze";
import { QUELLEN_IRS, QUELLEN_STAATEN } from "./fakten";
import { QUELLEN_IRS_EN, QUELLEN_STAATEN_EN } from "./fakten-en";
import type { GlobalSeite } from "./typen";

/** Tag der letzten inhaltlichen Änderung (E-510: Wortlaut nach dem Sprachleitfaden). */
const STAND_SEITE = "2026-11-13";

const D = BUNDESSTAATEN.delaware;
const F = BUNDESSTAATEN.florida;
const W = BUNDESSTAATEN.wyoming;

type Zwei = Record<Sprache, string>;
type ZweiListe = Record<Sprache, string[]>;

/** Die Sätze je Staat für die Wissensseite und die drei Staatsseiten — deutsch und englisch, nach dem Sprachleitfaden. */
export interface StaatSeitentext {
  /** Überschrift des Abschnitts auf der Wissensseite. */
  titel: Zwei;
  /** Unsere Einordnung in einem oder zwei Sätzen — beschreibt, bewertet nicht. */
  einordnung: Zwei;
  /** Die Eintragungszeit als Erfahrungswert — ohne Stand und Entscheider; die hängt staatEintragung() an. */
  zeit: Zwei;
  /** Für wen der Staat passt — so, wie es hinter „Passt für:“ steht. */
  passtFuer: Zwei;
  vorteile: ZweiListe;
  nachteile: ZweiListe;
}

export const STAAT_SEITENTEXT: Record<AngebotenerStaat, StaatSeitentext> = {
  delaware: {
    titel: { de: "Delaware — planbar mit Express", en: "Delaware — predictable with express" },
    einordnung: {
      de: "Unser Standard für neue Mandate: Der Staat bietet einen Express an, und Banken und Investoren ist Delaware vertraut.",
      en: "Our standard for new engagements: the state offers an express service, and Delaware is familiar to banks and investors.",
    },
    zeit: {
      de: "Im Standardweg derzeit rund zehn Werktage; mit dem Express des Staats in der Regel ein bis zwei Werktage.",
      en: "Around ten business days on the standard route at present; with the state’s express service, usually one or two business days.",
    },
    passtFuer: {
      de: "Vorhaben mit festem Zeitplan und Gesellschaften, die Investoren aufnehmen oder mit US-Instituten arbeiten wollen.",
      en: "plans with a fixed timetable, and companies that intend to take on investors or work with US institutions.",
    },
    vorteile: {
      de: [
        "Planbare Eintragung: mit dem Express des Staats in der Regel nach ein bis zwei Werktagen (Erfahrungswert).",
        "Ein in den USA weithin bekanntes Gesellschaftsrecht, mit eigenem Gericht für Gesellschaftsstreitigkeiten.",
        "Banken und Investoren ist Delaware vertraut.",
      ],
      en: [
        "Predictable registration: with the state’s express service, usually after one or two business days (based on experience).",
        "A body of company law that is widely known in the United States, with its own court for corporate disputes.",
        "Delaware is familiar to banks and investors.",
      ],
    },
    nachteile: {
      de: [
        `Höhere Jahressteuer von ${D.jahr.betrag.de}, fällig am ${D.jahr.frist.de}.`,
        "Wer in einem anderen Staat tätig ist, registriert die Gesellschaft dort in der Regel zusätzlich.",
      ],
      en: [
        `A higher annual tax of ${D.jahr.betrag.en}, due on ${D.jahr.frist.en}.`,
        "A company that does business in another state generally has to register there as well.",
      ],
    },
  },
  florida: {
    titel: { de: "Florida — Geschäft vor Ort, längere Eintragung", en: "Florida — business in the state, longer registration" },
    einordnung: {
      de: "Die Wahl für Geschäft und Termine in Florida. Wer einen festen Zeitplan hat, plant die derzeit längere Eintragung ein.",
      en: "The choice for business and appointments in Florida. If you have a fixed timetable, allow for the longer registration at present.",
    },
    zeit: {
      de: "Derzeit oft rund zwei Wochen bis zur Eintragung; die amtlichen Gründungsunterlagen folgen etwa zwölf Werktage später. Einen Express bietet Florida nicht an. Die längere Bearbeitung besteht seit Herbst 2026.",
      en: "Often around two weeks to registration at present; the official formation documents follow some twelve business days later. Florida offers no express service. Processing has taken longer since autumn 2026.",
    },
    passtFuer: {
      de: "Unternehmen mit Geschäft, Kunden oder Terminen in Florida und Inhaber, die ein Institut mit Filialen in Florida nutzen wollen.",
      en: "companies with business, customers or appointments in Florida, and owners who wish to use an institution with branches in Florida.",
    },
    vorteile: {
      de: [
        "Für Geschäft in Florida die naheliegende Wahl: Die Gesellschaft ist dort angemeldet, wo sie tätig ist.",
        "Naheliegend für Institute mit Filialen und für Termine vor Ort in Florida.",
        `Jahresgebühr an den Staat: ${F.jahr.betrag.de} (Annual Report).`,
      ],
      en: [
        "The natural choice for business in Florida: the company is filed in the state where it operates.",
        "A natural fit for institutions with branches and for in-person appointments in Florida.",
        `Annual state fee: ${F.jahr.betrag.en} (annual report).`,
      ],
    },
    nachteile: {
      de: [
        "Die Eintragung dauert derzeit länger, oft rund zwei Wochen; die Unterlagen folgen danach, und einen Express gibt es nicht.",
        "Feste Frist im Frühjahr; nach dem 1. Mai kommen 400 $ Verspätungsgebühr hinzu.",
      ],
      en: [
        "Registration takes longer at present, often around two weeks; the documents follow after that, and there is no express service.",
        "A fixed deadline in spring; after 1 May a $400 late fee is added.",
      ],
    },
  },
  wyoming: {
    titel: { de: "Wyoming — niedrige laufende Kosten", en: "Wyoming — low running costs" },
    einordnung: {
      de: "Passt, wenn niedrige laufende Kosten wichtiger sind als die Bekanntheit des Staats bei Banken und Investoren.",
      en: "A fit where low running costs matter more than how familiar the state is to banks and investors.",
    },
    zeit: {
      de: "Oft schon am selben Tag, sonst in der Regel innerhalb von rund drei Werktagen.",
      en: "Often on the same day, otherwise usually within around three business days.",
    },
    passtFuer: {
      de: "Gesellschaften, die in keinem bestimmten Staat tätig sind, niedrige laufende Kosten wollen und keine Termine vor Ort brauchen.",
      en: "companies that do not operate in any particular state, want low running costs and need no in-person appointments.",
    },
    vorteile: {
      de: [
        "Eintragung in der Regel nach rund drei Werktagen (Erfahrungswert).",
        `Die niedrigste Jahresgebühr der drei Staaten: ${W.jahr.betrag.de} im Jahr.`,
        "Privatsphäre: Die Gesellschafter stehen nicht im öffentlichen Register.",
      ],
      en: [
        "Registration usually after around three business days (based on experience).",
        `The lowest annual state fee of the three: ${W.jahr.betrag.en} a year.`,
        "Privacy: the members do not appear in the public register.",
      ],
    },
    nachteile: {
      de: [
        "Manche Institute schauen bei Wyoming-Gesellschaften ohne Geschäft vor Ort genauer hin.",
        "Banken und Investoren ist Wyoming weniger vertraut als Delaware.",
      ],
      en: [
        "Some institutions look more closely at Wyoming companies with no business in the state.",
        "Wyoming is less familiar to banks and investors than Delaware.",
      ],
    },
  },
};

/** Nevada — nur zur Einordnung; wir gründen dort nicht. */
export const NEVADA_SEITENTEXT: Zwei = {
  de: "Nevada trägt in ähnlicher Zeit ein wie Wyoming, ist im Unterhalt aber teurer — deshalb bieten wir Nevada nicht als eigenen Weg an.",
  en: "Nevada registers in about the same time as Wyoming but costs more to maintain — which is why we do not offer Nevada as a route of its own.",
};

/** Der Satz, der jede Zeitangabe trägt: Erfahrungswert, Stand, und wer entscheidet (Leitfaden 5.5). */
export function staatErfahrungSatz(s: Sprache): string {
  return s === "en"
    ? `These timings are based on experience (as at ${STAATEN_STAND_TEXT.en}); registration is decided by the state.`
    : `Das sind Erfahrungswerte (Stand ${STAATEN_STAND_TEXT.de}); über die Eintragung entscheidet der Staat.`;
}

/** Die Eintragungszeit eines Staats als ganze Antwort: Zeit, dann Erfahrungswert, Stand und Entscheider. */
export function staatEintragung(k: AngebotenerStaat, s: Sprache): string {
  return `${STAAT_SEITENTEXT[k].zeit[s]} ${staatErfahrungSatz(s)}`;
}

/** Ein Abschnitt je Staat: Einordnung, Eintragung, Vorteile als Punkte, Kehrseite danach. */
function staatAbschnitt(k: AngebotenerStaat, s: Sprache) {
  const t = STAAT_SEITENTEXT[k];
  const en = s === "en";
  return {
    typ: "text" as const, id: k, h2: t.titel[s],
    absaetze: [
      t.einordnung[s],
      en
        ? `Registration (based on experience, as at ${STAATEN_STAND_TEXT.en}): ${t.zeit.en} The state decides.`
        : `Eintragung (Erfahrungswert, Stand ${STAATEN_STAND_TEXT.de}): ${t.zeit.de} Es entscheidet der Staat.`,
      `${en ? "A fit for" : "Passt für"}: ${t.passtFuer[s]}`,
    ],
    punkte: t.vorteile[s],
    nach: `${en ? "The drawback" : "Die Kehrseite"}: ${t.nachteile[s].join(" ")}`,
  };
}

export function bundesstaatWahlSeite(s: Sprache): GlobalSeite {
  const en = s === "en";
  const stand = STAATEN_STAND_TEXT[s];
  const q = en ? QUELLEN_STAATEN_EN : QUELLEN_STAATEN;
  const irs = en ? QUELLEN_IRS_EN : QUELLEN_IRS;
  const p = (de: string, enPfad: string) => (en ? enPfad : de);
  return {
    pfad: p("/business/wissen/bundesstaat-waehlen", "/en/business/knowledge/choosing-a-state"),
    ...(en ? { sprache: "en" as const, schwester: "/business/wissen/bundesstaat-waehlen", erschienen: "2026-09-24" } : {}),
    art: "wissen",
    seo: en
      ? {
          titel: "Delaware, Florida or Wyoming for your LLC — FIAON Global",
          beschreibung: "Delaware, Florida and Wyoming compared for your US LLC: registration, express service, annual state fees, strengths and drawbacks. With sources and dates.",
        }
      : {
          titel: "Delaware, Florida, Wyoming: LLC-Vergleich — FIAON Global",
          beschreibung: "Delaware, Florida und Wyoming für Ihre US-LLC im Vergleich: Eintragung, Express, Jahresgebühren, Stärken und Kehrseiten. Mit Quellen und Stand.",
        },
    stand: STAND_SEITE,
    kennung: "FG · 27",
    auge: en ? "Knowledge · State" : "Wissen · Bundesstaat",
    h1: en ? "A US state for your LLC." : "US-Bundesstaat für Ihre LLC.",
    h1b: en ? "Delaware, Florida and Wyoming compared." : "Delaware, Florida und Wyoming im Vergleich.",
    lead: en
      ? `How long registration takes and what the company costs each year depend on the state. This page sets Delaware, Florida and Wyoming side by side: registration, express service, annual fees, strengths and drawbacks. The registration times are as at ${stand}.`
      : `Wie lange die Eintragung dauert und was die Gesellschaft jährlich kostet, hängt vom Bundesstaat ab. Diese Seite stellt Delaware, Florida und Wyoming nebeneinander: Eintragung, Express, Jahresgebühren, Stärken und Kehrseiten. Die Eintragungszeiten haben den Stand ${stand}.`,
    // Kennziffern: Zahlen Dritter mit ihrem Satz (Fälligkeit) — keine Dauer als große Zahl (Leitfaden 5.14).
    ziffern: [
      { wert: D.jahr.betrag[s], label: en ? "Delaware: annual tax, due on 1 June" : "Delaware: Jahressteuer, fällig am 1. Juni" },
      { wert: F.jahr.betrag[s], label: en ? "Florida: annual report, 1 January to 1 May" : "Florida: Annual Report, 1. Januar bis 1. Mai" },
      { wert: W.jahr.betrag[s], label: en ? "Wyoming: License Tax, due in the month of formation" : "Wyoming: License Tax, fällig im Gründungsmonat" },
    ],
    // Das Merkblatt zeigt zuerst drei Zeilen: Die Zeiten stehen deshalb in EINER Zeile, mit Stand und Entscheider (Leitfaden 5.5).
    blick: [
      [en ? "Registration" : "Eintragung", en
        ? `Based on experience, as at ${stand}: Delaware one or two business days with express, Florida around two weeks at present, Wyoming around three business days. The state decides.`
        : `Erfahrungswerte, Stand ${stand}: Delaware ein bis zwei Werktage mit Express, Florida derzeit rund zwei Wochen, Wyoming rund drei Werktage. Es entscheidet der Staat.`],
      ["Express", en ? "Delaware yes · Florida no · Wyoming possible, rarely needed" : "Delaware ja · Florida nein · Wyoming möglich, selten nötig"],
      [en ? "Each year" : "Jährlich", `DE ${D.jahr.betrag[s]} · FL ${F.jahr.betrag[s]} · WY ${W.jahr.betrag[s]}`],
      [en ? "Our standard" : "Unser Standard", en ? "Delaware — unless there is a reason to choose another state" : "Delaware — wenn nichts für einen anderen Staat spricht"],
      ["EIN", en ? "applied for after registration; the US tax authority decides" : "nach der Eintragung beantragt; es entscheidet die US-Steuerbehörde"],
      [en ? "Accounts and cards" : "Konto und Karten", en ? "each institution decides; consistent documents count for more than the state" : "es entscheidet das jeweilige Institut; stimmige Unterlagen zählen mehr als der Staat"],
      [en ? "As at" : "Stand", en ? `timings ${stand}, fees ${STAATEN_BETRAEGE_STAND}; sources at the end of the page` : `Zeiten ${stand}, Beträge ${STAATEN_BETRAEGE_STAND}; Quellen am Ende der Seite`],
    ],
    kurz: en
      ? `Our standard is Delaware: the state offers an express service, and Delaware is familiar to banks and investors. Florida suits business and appointments in Florida, but registration takes longer there at present and there is no express service. Wyoming has the lowest annual state fee (${W.jahr.betrag.en}). The registration times are set out in the comparison, based on experience; the state decides.`
      : `Unser Standard ist Delaware: Der Staat bietet einen Express an, und Banken und Investoren ist Delaware vertraut. Florida passt für Geschäft und Termine in Florida, braucht für die Eintragung derzeit aber länger und bietet keinen Express. Wyoming hat die niedrigste Jahresgebühr (${W.jahr.betrag.de}). Die Eintragungszeiten stehen als Erfahrungswerte im Vergleich; es entscheidet der Staat.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: en ? "The three states compared" : "Die drei Staaten im Vergleich",
        lead: en ? `Registration times as at ${stand}: based on experience, not deadlines. The state decides.` : `Eintragungszeiten Stand ${stand}: Erfahrungswerte, keine Fristen. Es entscheidet der Staat.`,
        kopf: ["", ...STAATEN_ZUR_WAHL.map((b) => b.name)],
        zeilen: [
          [en ? "Registration" : "Eintragung", ...STAATEN_ZUR_WAHL.map((b) => b.eintragungKurz[s])],
          ["Express", ...STAATEN_ZUR_WAHL.map((b) => b.express.kurz[s])],
          [en ? "Formation fee" : "Gründungsgebühr", ...STAATEN_ZUR_WAHL.map((b) => b.gruendung[s])],
          [en ? "Paid to the state each year" : "Jährlich an den Staat", ...STAATEN_ZUR_WAHL.map((b) => b.jahr.betrag[s])],
          [en ? "Deadline" : "Frist", ...STAATEN_ZUR_WAHL.map((b) => b.jahr.frist[s])],
          [en ? "Strength" : "Stärke", en ? "express service; familiar to banks and investors" : "Express; Banken und Investoren vertraut", en ? "business and appointments in Florida" : "Geschäft und Termine in Florida", en ? "low running costs, privacy" : "niedrige laufende Kosten, Privatsphäre"],
          [en ? "Drawback" : "Kehrseite", en ? "higher annual tax" : "höhere Jahressteuer", en ? "longer registration at present, no express" : "derzeit längere Eintragung, kein Express", en ? "some institutions look more closely" : "manche Institute schauen genauer hin"],
        ],
        hervor: 1,
        fuss: [
          en ? `Times as at ${stand}; fees for LLCs as at ${STAATEN_BETRAEGE_STAND}, sources at the end of the page.` : `Zeiten Stand ${stand}; Beträge für LLCs Stand ${STAATEN_BETRAEGE_STAND}, Quellen am Ende der Seite.`,
          en ? "In Florida the official formation documents follow some twelve business days after registration." : "In Florida folgen die amtlichen Gründungsunterlagen etwa zwölf Werktage nach der Eintragung.",
          satz("S15", s),
        ],
      },
      staatAbschnitt("delaware", s),
      staatAbschnitt("florida", s),
      staatAbschnitt("wyoming", s),
      {
        typ: "text", id: "banken", h2: en ? "What counts for accounts and cards" : "Was bei Konto und Karten zählt",
        // Gegenlesen: Die drei Punkte (Adresse und Telefonnummer, Operating Agreement, Bonität) stehen schon wörtlich in STAAT_BANKEN — keine zweite Liste darunter.
        absaetze: [STAAT_BANKEN[s]],
      },
      {
        typ: "text", id: "ein", h2: en ? "The EIN: the same in every state" : "Die EIN: in jedem Staat gleich",
        absaetze: [en
          ? "The EIN is the company’s tax identification number; it does not depend on the state. We apply for it once the company is registered. The US tax authority, the IRS, decides on the EIN and determines how long processing takes."
          : "Die EIN ist die Steuernummer der Gesellschaft; sie hängt nicht vom Bundesstaat ab. Wir beantragen sie nach der Eintragung. Über die EIN entscheidet die US-Steuerbehörde IRS; wie lange die Bearbeitung dauert, bestimmt die Behörde."],
      },
      {
        typ: "etappen", id: "fragen-drei", h2: en ? "Three questions for your choice" : "Drei Fragen für Ihre Wahl",
        etappen: en
          ? [
              { titel: "How fixed is your timetable?", text: "With a fixed timetable, Delaware with express or Wyoming are the options to consider. Florida takes longer to register at present." },
              { titel: "Where does the business take place?", text: "If the company operates in a state with an office, warehouse, employees or projects, it has to register there in any case. For business in Florida, Florida is therefore the natural choice." },
              { titel: "Investors or low running costs?", text: "Delaware is familiar to banks and investors. If low running costs matter most and no in-person appointments are needed, Wyoming has the lowest annual state fee." },
            ]
          : [
              { titel: "Wie fest ist Ihr Zeitplan?", text: "Bei einem festen Zeitplan kommen Delaware mit Express oder Wyoming in Betracht. Florida braucht für die Eintragung derzeit länger." },
              { titel: "Wo findet das Geschäft statt?", text: "Ist die Gesellschaft in einem Staat mit Büro, Lager, Mitarbeitern oder Projekten tätig, muss sie sich dort ohnehin registrieren. Für Geschäft in Florida ist Florida deshalb die naheliegende Wahl." },
              { titel: "Investoren oder niedrige laufende Kosten?", text: "Banken und Investoren ist Delaware vertraut. Zählen vor allem niedrige laufende Kosten und braucht es keine Termine vor Ort, hat Wyoming die niedrigste Jahresgebühr." },
            ],
      },
      {
        typ: "verzeichnis", id: "staaten", h2: en ? "The states in detail" : "Die Staaten im Einzelnen",
        eintraege: [
          { pfad: p("/business/delaware", "/en/business/delaware"), tag: en ? "State" : "Bundesstaat" },
          { pfad: p("/business/florida", "/en/business/florida"), tag: en ? "State" : "Bundesstaat" },
          { pfad: p("/business/wyoming", "/en/business/wyoming"), tag: en ? "State" : "Bundesstaat" },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: en ? "What you need to know" : "Was Sie wissen müssen",
        punkte: en
          ? [
              `${satz("S15", "en")} ${satz("S3", "en")}`,
              `${satz("S10", "en")} The state changes nothing about that; what counts is the place of management.`,
              "A company that becomes active in another state generally has to register there as well.",
              "In the fee calculator, Delaware is the state provided for; we agree any other state with you in a call. The state formation fee is included in your fee.",
            ]
          : [
              `${satz("S15", "de")} ${satz("S3", "de")}`,
              `${satz("S10", "de")} Der Bundesstaat ändert daran nichts; maßgeblich ist der Ort der Geschäftsleitung.`,
              "Eine Gesellschaft, die in einem anderen Staat tätig wird, muss sich dort in der Regel zusätzlich registrieren.",
              "Im Honorarrechner ist Delaware als Bundesstaat vorgesehen; einen anderen Staat stimmen wir im Gespräch mit Ihnen ab. Die Gründungsgebühr des Staats ist in Ihrem Honorar enthalten.",
            ],
      },
    ],
    fragen: en
      ? [
          { f: "In which US state does registration take the least time?", a: `In Delaware with the state’s express service: usually one or two business days. Wyoming usually takes around three business days. Florida often takes around two weeks at present and offers no express service. ${staatErfahrungSatz("en")}` },
          { f: "Why does registration in Florida take longer at present?", a: `Florida has taken markedly longer to process formations since autumn 2026: registration often takes around two weeks, and the official formation documents follow some twelve business days later. There is no express service. Before that, the times were shorter. ${staatErfahrungSatz("en")}` },
          { f: "Does the state matter for my bank account and cards?", a: "Less than many assume. What counts is a consistent picture: the same US address and telephone number everywhere, a signed operating agreement and your personal credit standing. Each institution decides by its own rules." },
          { f: "When is the EIN applied for?", a: "After registration, and it is the same in every state. We apply for the EIN once the company is registered. The US tax authority decides on the EIN and determines how long processing takes." },
          { f: "What about Nevada?", a: NEVADA_SEITENTEXT.en },
          { f: "Does the state affect my tax at home?", a: "No. Tax liability in your country of residence depends on the place of management, not on the company’s registered office." },
        ]
      : [
          { f: "In welchem US-Bundesstaat dauert die Eintragung am kürzesten?", a: `In Delaware mit dem Express des Staats: in der Regel ein bis zwei Werktage. Wyoming braucht meist rund drei Werktage. Florida braucht derzeit oft rund zwei Wochen und bietet keinen Express an. ${staatErfahrungSatz("de")}` },
          { f: "Warum dauert die Eintragung in Florida derzeit länger?", a: `Florida braucht für Gründungen seit Herbst 2026 deutlich länger: Bis zur Eintragung vergehen oft rund zwei Wochen, die amtlichen Gründungsunterlagen folgen etwa zwölf Werktage später. Einen Express gibt es nicht. Zuvor waren die Zeiten kürzer. ${staatErfahrungSatz("de")}` },
          { f: "Spielt der Bundesstaat für Konto und Karten eine Rolle?", a: "Weniger, als viele denken. Entscheidend ist ein stimmiges Bild: überall dieselbe US-Adresse und Telefonnummer, ein unterzeichnetes Operating Agreement und Ihre persönliche Bonität. Die Entscheidung trifft jedes Institut nach eigenen Regeln." },
          { f: "Wann wird die EIN beantragt?", a: "Nach der Eintragung, in jedem Staat gleich. Wir beantragen die EIN, sobald die Gesellschaft eingetragen ist. Über die EIN entscheidet die US-Steuerbehörde; wie lange die Bearbeitung dauert, bestimmt sie." },
          { f: "Und Nevada?", a: NEVADA_SEITENTEXT.de },
          { f: "Beeinflusst der Bundesstaat meine Steuern zu Hause?", a: "Nein. Die Steuerpflicht im Wohnsitzland hängt vom Ort der Geschäftsleitung ab, nicht vom Sitz der Gesellschaft." },
        ],
    weiter: en
      ? ["/en/business/delaware", "/en/business/florida", "/en/business/wyoming", "/en/business/knowledge/form-a-us-llc"]
      : ["/business/delaware", "/business/florida", "/business/wyoming", "/business/wissen/llc-gruenden"],
    quellen: [q.delaware[2], q.delaware[0], q.florida[0], q.florida[1], q.wyoming[0], irs[0]],
  };
}
