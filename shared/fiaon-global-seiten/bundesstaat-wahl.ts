// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „WELCHER US-BUNDESSTAAT PASST?“ (E-465, 29.10.2026)
//
// Die Wissensseite FG · 27 (/business/wissen/bundesstaat-waehlen und
// /en/business/knowledge/choosing-a-state) entsteht für BEIDE Sprachen aus einer
// Funktion — Zeiten, Express, Beträge, Vor- und Nachteile kommen aus
// shared/fiaon-global-bundesstaaten.ts. So sind deutsche und englische Seite immer
// gleich gebaut (gleich viele Ziffern, Blick-Zeilen, Fragen und Quellen — das prüft
// scripts/pruef-global-en.ts).
//
// Vorher (seit E-191, 19.09.2026): „Drei Fragen entscheiden“ mit Florida vorn, ohne
// Zeiten. Seit 29.10.2026: ehrliche Eintragungszeiten (Florida derzeit langsam, kein
// Express), Delaware als Standard für neue Aufträge, Wyoming als günstiger Weg,
// Nevada zur Einordnung, EIN-Zeiten und was bei Konto und Karte wirklich zählt.
// ═══════════════════════════════════════════════════════════════════════════
import {
  BUNDESSTAATEN, EIN_ZEITEN, STAAT_BANKEN, STAATEN_STAND, STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL,
  type BundesstaatInfo, type Sprache,
} from "../fiaon-global-bundesstaaten";
import { QUELLEN_IRS, QUELLEN_STAATEN } from "./fakten";
import { QUELLEN_IRS_EN, QUELLEN_STAATEN_EN } from "./fakten-en";
import type { GlobalSeite } from "./typen";

const D = BUNDESSTAATEN.delaware;
const F = BUNDESSTAATEN.florida;
const W = BUNDESSTAATEN.wyoming;

/** Ein Abschnitt je Staat: Einordnung, Eintragung, Vorteile als Punkte, Kehrseite danach. */
function staatAbschnitt(b: BundesstaatInfo, s: Sprache) {
  const titel: Record<string, Record<Sprache, string>> = {
    delaware: { de: "Delaware — der schnellste planbare Weg", en: "Delaware — the fastest predictable route" },
    florida: { de: "Florida — Auftritt in Miami, derzeit langsam", en: "Florida — a presence in Miami, slow at present" },
    wyoming: { de: "Wyoming — schnell und schlank im Unterhalt", en: "Wyoming — fast and lean to maintain" },
  };
  return {
    typ: "text" as const, id: b.schluessel, h2: titel[b.schluessel][s],
    absaetze: [b.einordnung[s], `${s === "en" ? "Registration" : "Eintragung"}: ${b.eintragung[s]}`, `${s === "en" ? "A fit for" : "Passt für"}: ${b.passtFuer[s].charAt(0).toLowerCase()}${b.passtFuer[s].slice(1)}`],
    punkte: b.vorteile[s],
    nach: `${s === "en" ? "The other side" : "Die Kehrseite"}: ${b.nachteile[s].join(" ")}`,
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
          titel: "Delaware, Florida or Wyoming? Which US state — FIAON Global",
          beschreibung: "Which US state fits your LLC? Delaware, Florida and Wyoming compared: honest registration times, express options, annual costs, pros and cons.",
        }
      : {
          titel: "Delaware, Florida oder Wyoming? Vergleich — FIAON Global",
          beschreibung: "Welcher US-Bundesstaat passt? Delaware, Florida und Wyoming im Vergleich: ehrliche Eintragungszeiten, Express, Jahreskosten, Vor- und Nachteile.",
        },
    stand: STAATEN_STAND,
    kennung: "FG · 27",
    auge: en ? "Knowledge · State" : "Wissen · Bundesstaat",
    h1: en ? "Which US state fits?" : "Welcher US-Bundesstaat passt?",
    h1b: en ? "Delaware, Florida and Wyoming compared." : "Delaware, Florida und Wyoming im Vergleich.",
    lead: en
      ? `How quickly a company stands now depends heavily on the state. Delaware registers in one or two business days with its express service, Wyoming in around three — and Florida, until recently quick, often takes around two weeks at present. Here is what each state does well, where it falls short and what really counts with banks. As of ${stand}.`
      : `Wie schnell eine Gesellschaft steht, hängt heute stark vom Bundesstaat ab. Delaware trägt mit Express in ein bis zwei Werktagen ein, Wyoming in rund drei — und Florida, bis vor Kurzem schnell, braucht derzeit oft rund zwei Wochen. Hier steht, was jeder Staat gut kann, wo er schwächer ist und was bei Banken wirklich zählt. Stand ${stand}.`,
    ziffern: [
      { wert: en ? "1–2 business days" : "1–2 Werktage", label: en ? "Delaware with express" : "Delaware mit Express" },
      { wert: en ? "around 3 business days" : "rund 3 Werktage", label: en ? "Wyoming" : "Wyoming" },
      { wert: en ? "around 2 weeks" : "rund 2 Wochen", label: en ? `Florida at present (${stand})` : `Florida derzeit (${stand})` },
    ],
    blick: [
      ["Delaware", en ? "one or two business days with express" : "ein bis zwei Werktage mit Express"],
      ["Florida", en ? "around two weeks at present, no express" : "derzeit rund zwei Wochen, kein Express"],
      ["Wyoming", en ? "around three business days" : "rund drei Werktage"],
      [en ? "Each year" : "Jährlich", `DE ${D.jahr.betrag[s]} · FL ${F.jahr.betrag[s]} · WY ${en ? "from $60" : "ab 60 $"}`],
      [en ? "Our standard" : "Unser Standard", en ? "Delaware — unless something speaks for another state" : "Delaware — wenn nichts anderes dafür spricht"],
      ["EIN", EIN_ZEITEN[s].kurz],
      [en ? "Banks" : "Banken", en ? "a consistent picture counts more than the state" : "ein stimmiges Bild zählt mehr als der Staat"],
      [en ? "As of" : "Stand", en ? `times ${stand}, fees September 2026` : `Zeiten ${stand}, Beträge September 2026`],
    ],
    kurz: en
      ? `For most clients Delaware is the right start: with the state’s express service the company usually stands after one or two business days, and banks and lenders know Delaware. Florida suits business and appointments in Florida, but registration often takes around two weeks at present and there is no express option. Wyoming is fast (around three business days) and the cheapest to maintain (${W.jahr.betrag.en} a year). For accounts and cards, a consistent picture counts more than the state.`
      : `Für die meisten Kunden ist Delaware der richtige Start: Mit dem Express des Staats steht die Gesellschaft in der Regel nach ein bis zwei Werktagen, und Banken und Geldgeber kennen Delaware. Florida passt für Geschäft und Termine in Florida, trägt derzeit aber oft erst nach rund zwei Wochen ein — ohne Express. Wyoming ist schnell (rund drei Werktage) und am günstigsten im Unterhalt (${W.jahr.betrag.de} im Jahr). Für Konto und Karten zählt ein stimmiges Bild mehr als der Staat.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: en ? "The three states compared" : "Die drei Staaten im Vergleich",
        lead: en ? `Registration times as of ${stand} — experience, not a commitment. The state decides.` : `Eintragungszeiten Stand ${stand} — Erfahrungswerte, keine Zusage. Es entscheidet der Staat.`,
        kopf: ["", ...STAATEN_ZUR_WAHL.map((b) => b.name)],
        zeilen: [
          [en ? "Registration" : "Eintragung", ...STAATEN_ZUR_WAHL.map((b) => b.eintragungKurz[s])],
          ["Express", ...STAATEN_ZUR_WAHL.map((b) => b.express.kurz[s])],
          [en ? "Formation fee" : "Gründungsgebühr", ...STAATEN_ZUR_WAHL.map((b) => b.gruendung[s])],
          [en ? "Paid to the state each year" : "Jährlich an den Staat", ...STAATEN_ZUR_WAHL.map((b) => b.jahr.betrag[s])],
          [en ? "Deadline" : "Frist", ...STAATEN_ZUR_WAHL.map((b) => b.jahr.frist[s])],
          [en ? "Strength" : "Stärke", en ? "speed, reputation with banks and investors" : "Tempo, Ruf bei Banken und Investoren", en ? "presence in Miami, branch banks on the ground" : "Auftritt in Miami, Filialbanken vor Ort", en ? "low cost, privacy" : "niedrige Kosten, Privatsphäre"],
          [en ? "Drawback" : "Kehrseite", en ? "higher annual tax" : "höhere Jahressteuer", en ? "slow at present, no express" : "derzeit langsam, kein Express", en ? "some banks look more closely" : "manche Banken schauen genauer hin"],
        ],
        hervor: 1,
        fuss: [
          en ? `Times as of ${stand}; fees for LLCs as of September 2026, sources at the end of the page.` : `Zeiten Stand ${stand}; Beträge für LLCs Stand September 2026, Quellen am Ende der Seite.`,
          en ? "In Florida the official formation documents follow some twelve business days after registration." : "In Florida folgen die amtlichen Gründungsunterlagen etwa zwölf Werktage nach der Eintragung.",
        ],
      },
      staatAbschnitt(D, s),
      staatAbschnitt(F, s),
      staatAbschnitt(W, s),
      {
        typ: "text", id: "banken", h2: en ? "What really counts with banks" : "Was bei Banken wirklich zählt",
        absaetze: [STAAT_BANKEN[s]],
        punkte: en
          ? ["The same US address and phone number in every document", "A signed operating agreement", "Your personal credit standing as the owner"]
          : ["Dieselbe US-Adresse und Telefonnummer in allen Unterlagen", "Ein unterschriebenes Operating Agreement", "Ihre persönliche Bonität als Inhaber"],
      },
      {
        typ: "text", id: "ein", h2: en ? "The EIN: the same in every state" : "Die EIN: in jedem Staat gleich",
        absaetze: [EIN_ZEITEN[s].satz],
      },
      {
        typ: "etappen", id: "fragen-drei", h2: en ? "Three questions that decide" : "Drei Fragen, die entscheiden",
        etappen: en
          ? [
              { titel: "How quickly should the company stand?", text: "If time matters, Delaware with express or Wyoming are the routes you can plan on. Florida is registering more slowly at present." },
              { titel: "Where does the business take place?", text: "If the company is active in a state — with an office, warehouse, employees or projects — it has to register there anyway. For business in Florida, Florida is the simplest choice." },
              { titel: "Investors, lenders or low running costs?", text: "Investors and lenders know Delaware best. If low running costs matter most and no appointments on the ground are needed, Wyoming is the lean route." },
            ]
          : [
              { titel: "Wie schnell soll die Gesellschaft stehen?", text: "Zählt die Zeit, sind Delaware mit Express oder Wyoming die planbaren Wege. Florida trägt derzeit langsamer ein." },
              { titel: "Wo findet das Geschäft statt?", text: "Ist die Gesellschaft in einem Staat tätig — mit Büro, Lager, Mitarbeitern oder Projekten —, muss sie sich dort ohnehin registrieren. Für Geschäft in Florida ist Florida die einfachste Wahl." },
              { titel: "Investoren, Geldgeber oder niedrige Kosten?", text: "Investoren und Geldgeber kennen Delaware am besten. Sind niedrige laufende Kosten am wichtigsten und braucht es keine Termine vor Ort, ist Wyoming der schlanke Weg." },
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
              `The times are experience as of ${stand}, not a commitment: the state decides on registration, the US tax authority on the EIN.`,
              "The state changes nothing about tax liability in your home country — that depends on the place of management.",
              "A company that becomes active in another state generally has to register there as well.",
              "We decide on the state together with you in the kick-off call; the state formation fee is included in the fixed price.",
            ]
          : [
              `Die Zeiten sind Erfahrungswerte Stand ${stand}, keine Zusage: Über die Eintragung entscheidet der Staat, über die EIN die US-Steuerbehörde.`,
              "Der Bundesstaat ändert nichts an der Steuerpflicht im Heimatland — sie hängt am Ort der Geschäftsleitung.",
              "Eine Gesellschaft, die in einem anderen Staat tätig wird, muss sich dort in der Regel zusätzlich registrieren.",
              "Den Staat legen wir im Startgespräch gemeinsam fest; die Gründungsgebühr des Staats ist im Festpreis enthalten.",
            ],
      },
    ],
    fragen: en
      ? [
          { f: "Which US state registers an LLC fastest?", a: "Delaware with its express service: usually one or two business days, very reliably. Wyoming usually takes around three business days. Florida often takes around two weeks at present and offers no express option." },
          { f: "Why is Florida slow at the moment?", a: "Florida has been processing formations much more slowly since autumn 2026: registration often takes around two weeks, and the official formation documents follow some twelve business days later. There is no express option. Florida used to be faster — the backlog is new." },
          { f: "Does the state matter for my bank account and cards?", a: "Less than many assume. What counts is a consistent picture: the same US address and phone number everywhere, a signed operating agreement and your personal credit standing. Each institution decides by its own rules." },
          { f: "When do I receive the EIN?", a: "Only after registration, and it is the same in every state: by phone for applicants outside the US on the same day, by fax often after around two weeks at present. The confirmation letter follows by post some four to five weeks later." },
          { f: "What about Nevada?", a: BUNDESSTAATEN.nevada.einordnung.en },
          { f: "Does the state affect my tax at home?", a: "No. Tax liability in your home country depends on the place of management, not on the company’s registered office." },
        ]
      : [
          { f: "Welcher US-Bundesstaat gründet eine LLC am schnellsten?", a: "Delaware mit dem Express des Staats: in der Regel ein bis zwei Werktage, sehr verlässlich. Wyoming braucht meist rund drei Werktage. Florida braucht derzeit oft rund zwei Wochen und bietet keinen Express an." },
          { f: "Warum ist Florida gerade langsam?", a: "Florida bearbeitet Gründungen seit Herbst 2026 deutlich langsamer: Bis zur Eintragung vergehen oft rund zwei Wochen, die amtlichen Gründungsunterlagen folgen etwa zwölf Werktage später. Einen Express gibt es nicht. Florida war lange schneller — der Stau ist neu." },
          { f: "Spielt der Bundesstaat für Konto und Karten eine Rolle?", a: "Weniger, als viele denken. Entscheidend ist ein stimmiges Bild: überall dieselbe US-Adresse und Telefonnummer, ein unterschriebenes Operating Agreement und Ihre persönliche Bonität. Die Entscheidung trifft jedes Institut nach eigenen Regeln." },
          { f: "Wann bekomme ich die EIN?", a: "Erst nach der Eintragung, und das in jedem Staat gleich: per Telefon für Antragsteller aus dem Ausland noch am selben Tag, per Fax derzeit oft nach rund zwei Wochen. Der Bestätigungsbrief kommt rund vier bis fünf Wochen später per Post." },
          { f: "Und Nevada?", a: BUNDESSTAATEN.nevada.einordnung.de },
          { f: "Beeinflusst der Bundesstaat meine Steuern zu Hause?", a: "Nein. Die Steuerpflicht im Heimatland hängt am Ort der Geschäftsleitung, nicht am Sitz der Gesellschaft." },
        ],
    weiter: en
      ? ["/en/business/delaware", "/en/business/florida", "/en/business/wyoming", "/en/business/knowledge/form-a-us-llc"]
      : ["/business/delaware", "/business/florida", "/business/wyoming", "/business/wissen/llc-gruenden"],
    quellen: [q.delaware[2], q.delaware[0], q.florida[0], q.florida[1], q.wyoming[0], irs[0]],
  };
}
