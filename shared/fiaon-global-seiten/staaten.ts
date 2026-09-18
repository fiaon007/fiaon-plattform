// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE BUNDESSTAATEN (19.09.2026, E-191)
// Florida, Delaware, Wyoming — die drei, nach denen am häufigsten gesucht wird
// („florida llc gründen", „delaware llc gründen", „wyoming llc gründen").
// Beträge und Fristen aus fakten.ts (amtlich, Stand September 2026).
// Welcher Staat passt, hängt vom Vorhaben ab — die Seiten sagen, wann welcher
// passt, und nennen die Kehrseite.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, globalPreisText } from "../fiaon-global";
import { FAKTEN_STAND, IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import type { GlobalBlock, GlobalSeite } from "./typen";

const S = "2026-09-19";

/** Der Vergleich der drei Staaten — auf jeder Staatsseite derselbe. */
function vergleich(hervor: 1 | 2 | 3): GlobalBlock {
  return {
    typ: "tabelle", id: "vergleich", h2: "Florida, Delaware und Wyoming im Vergleich",
    lead: "Die drei Staaten für eine LLC nebeneinander.",
    kopf: ["", "Florida", "Delaware", "Wyoming"],
    zeilen: [
      ["Gründung", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
      ["Jährlich an den Staat", STAAT.florida.jahr, STAAT.delaware.jahr, STAAT.wyoming.jahr],
      ["Frist", "1. Januar bis 1. Mai", "1. Juni", "Gründungsmonat"],
      ["Steuer des Staats", "5,5 % für Corporations", "je nach Tätigkeit", "keine Körperschaft- und Einkommensteuer"],
      ["Stärke", "Team vor Ort in Miami, Geschäft in Florida", "Gesellschaftsrecht, Investoren", "schlank, günstig im Unterhalt"],
    ],
    hervor,
    fuss: [`Stand ${FAKTEN_STAND}, Beträge für LLCs. Delaware: ${STAAT.delaware.jahrAlt}`],
  };
}

export const STAATEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/florida",
    art: "staat",
    seo: {
      titel: "Florida LLC gründen: Kosten und Pflichten — FIAON Global",
      beschreibung: `Florida LLC: ${STAAT.florida.gruendung} Gründung, ${STAAT.florida.jahr} Annual Report bis 1. Mai, Registered Agent mit Florida-Adresse. Mit Team vor Ort in Miami.`,
    },
    stand: S,
    kennung: "FG · 19",
    auge: "Wissen · Bundesstaat",
    h1: "Florida.",
    h1b: "Der Staat unseres Teams vor Ort.",
    lead: "In Florida sitzt unser Team vor Ort, die Schwarzott Global LLC in Miami. Für Unternehmen mit Geschäft in Florida, mit Terminen vor Ort oder mit dem Auftakt im Paket Global VIP ist der Staat die naheliegende Wahl — mit klaren Gebühren und einer festen Frist im Frühjahr.",
    ziffern: [
      { wert: STAAT.florida.gruendung, label: "Gründung einer LLC" },
      { wert: STAAT.florida.jahr, label: "Annual Report, 1. Januar bis 1. Mai" },
      { wert: "Miami", label: "unser Team vor Ort" },
    ],
    blick: [
      ["Gründung", `${STAAT.florida.gruendung} — ${STAAT.florida.gruendungDetail}`],
      ["Jährlich", `${STAAT.florida.jahr} ${STAAT.florida.jahrName}, ${STAAT.florida.jahrFrist}`],
      ["Verzug", STAAT.florida.jahrVerzug],
      ["Registered Agent", STAAT.florida.agent],
      ["Steuer des Staats", STAAT.florida.steuer],
      ["Vor Ort", "Schwarzott Global LLC, 3119 Coral Way, Miami"],
    ],
    kurz: `Eine LLC in Florida kostet bei der Gründung ${STAAT.florida.gruendung} (${STAAT.florida.gruendungDetail}). Jedes Jahr ist zwischen 1. Januar und 1. Mai ein Annual Report über ${STAAT.florida.jahr} fällig; danach kommen 400 $ hinzu. Ein Registered Agent mit Anschrift in Florida ist Pflicht. Florida ist der Staat unseres Teams vor Ort — Termine in Miami nimmt die Schwarzott Global LLC wahr.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Florida in Zahlen",
        kopf: ["", "Florida"],
        zeilen: [
          ["Gründung einer LLC", `${STAAT.florida.gruendung} (${STAAT.florida.gruendungDetail})`],
          ["Annual Report", `${STAAT.florida.jahr}, ${STAAT.florida.jahrFrist}`],
          ["Verzug", STAAT.florida.jahrVerzug],
          ["Registered Agent", STAAT.florida.agent],
          ["Steuer des Staats", STAAT.florida.steuer],
          ["LLC im Besitz einer GmbH oder AG", "eigene Florida-Steuererklärung der Gesellschafterin (Form F-1120)"],
        ],
        fuss: [`Stand ${FAKTEN_STAND}; Quellen am Ende der Seite.`],
      },
      {
        typ: "text", id: "wann", h2: "Wann Florida passt",
        absaetze: ["Florida ist kein Steuerstaat und kein Investorenstaat — es ist der Staat für Unternehmen, die dort etwas tun. Florida passt, wenn:"],
        punkte: [
          "Ihre Kunden, Lieferanten oder Projekte in Florida liegen",
          "Sie Termine vor Ort brauchen — bei Behörden oder Instituten",
          "Sie den Auftakt persönlich in Miami erleben wollen (Global VIP)",
          "Sie eine Gesellschaft mit einem Team in der Nähe möchten",
        ],
        nach: STAAT.florida.llcSteuer,
      },
      vergleich(1),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Wer den Annual Report nach dem 1. Mai abgibt, zahlt ${STAAT.florida.jahrVerzug.replace("nach dem 1. Mai ", "")}. Die Frist steht in Ihrem Pflichtenkalender.`,
          GLOBAL_PFLICHTHINWEIS.de[0],
          `Unabhängig vom Staat verlangt die IRS jährlich Form 5472 mit Form 1120; bei Versäumnis drohen ${IRS.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gründung in Florida mit allem, was zum Start gehört — oder mit Auftakt vor Ort im Paket Global VIP.", paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Unser Team in Miami", lead: "Die Schwarzott Global LLC nimmt Termine vor Ort wahr; Vertragspartner ist die FIAON LTD." },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Florida?", a: `Die Gründung kostet ${STAAT.florida.gruendung}, der jährliche Annual Report ${STAAT.florida.jahr}. Bei FIAON Global sind Gründung und das erste Jahr im Festpreis ab ${globalPreisText("global_struktur")} enthalten.` },
      { f: "Wann ist der Annual Report in Florida fällig?", a: "Zwischen 1. Januar und 1. Mai, erstmals im Jahr nach der Gründung. Nach dem 1. Mai kommen 400 $ Verspätungsgebühr hinzu." },
      { f: "Zahlt eine Florida-LLC Körperschaftsteuer?", a: "Eine LLC, die steuerlich nicht als eigenes Steuersubjekt gilt, gibt keine eigene Florida-Erklärung ab. Gehört sie einer Kapitalgesellschaft wie einer GmbH, gibt diese eine Florida-Erklärung ab; Corporations zahlen 5,5 % mit einem Freibetrag von 50.000 $." },
      { f: "Brauche ich eine Adresse in Florida?", a: "Die Gesellschaft braucht einen Registered Agent mit Anschrift in Florida. Den stellen wir im ersten Jahr, ebenso die Geschäftsadresse." },
    ],
    paket: "global_struktur",
    weiter: ["/business/miami", "/business/delaware", "/business/wyoming", "/business/wissen/bundesstaat-waehlen"],
    quellen: QUELLEN_STAATEN.florida,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/delaware",
    art: "staat",
    seo: {
      titel: "Delaware LLC gründen: Kosten und Pflichten — FIAON Global",
      beschreibung: `Delaware LLC: ${STAAT.delaware.gruendung} Gründung, ${STAAT.delaware.jahr} Jahressteuer ab Steuerjahr 2026, fällig 1. Juni. Wann Delaware passt — und wann nicht.`,
    },
    stand: S,
    kennung: "FG · 20",
    auge: "Wissen · Bundesstaat",
    h1: "Delaware.",
    h1b: "Der Staat der Investoren.",
    lead: "Delaware ist berühmt für sein Gesellschaftsrecht: eigene Gerichte für Gesellschaftsstreitigkeiten, eine lange Rechtsprechung, Investoren, die es kennen. Für eine Corporation mit Investorenplänen ist das ein Argument — für eine kleine LLC oft nicht, denn die Jahressteuer ist gerade gestiegen.",
    ziffern: [
      { wert: STAAT.delaware.gruendung, label: "Gründung einer LLC" },
      { wert: STAAT.delaware.jahr, label: "Jahressteuer der LLC ab Steuerjahr 2026" },
      { wert: "1. Juni", label: "Frist der Jahressteuer" },
    ],
    blick: [
      ["Gründung", `${STAAT.delaware.gruendung} (${STAAT.delaware.gruendungDetail})`],
      ["Jährlich", `${STAAT.delaware.jahr} ${STAAT.delaware.jahrName}, fällig ${STAAT.delaware.jahrFrist}`],
      ["Verzug", STAAT.delaware.jahrVerzug],
      ["Neu", "Ab Steuerjahr 2026 400 $ statt 300 $"],
      ["Registered Agent", STAAT.delaware.agent],
      ["Corporation", "Annual Report 50 $, Franchise Tax ab 175 $, fällig 1. März"],
    ],
    kurz: `Eine LLC in Delaware kostet bei der Gründung ${STAAT.delaware.gruendung}. Jedes Jahr ist am 1. Juni eine Jahressteuer von ${STAAT.delaware.jahr} fällig — ab dem Steuerjahr 2026, vorher waren es 300 $. Ein Registered Agent mit Büro in Delaware ist Pflicht. Delaware passt vor allem zu Corporations, die Investoren aufnehmen wollen.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Delaware in Zahlen",
        kopf: ["", "Delaware"],
        zeilen: [
          ["Gründung einer LLC", `${STAAT.delaware.gruendung} (${STAAT.delaware.gruendungDetail})`],
          ["Jahressteuer der LLC", `${STAAT.delaware.jahr}, fällig ${STAAT.delaware.jahrFrist}`],
          ["Verzug", STAAT.delaware.jahrVerzug],
          ["Registered Agent", STAAT.delaware.agent],
          ["Corporation", STAAT.delaware.corp.replace("Corporations: ", "")],
        ],
        fuss: [STAAT.delaware.jahrAlt, `Stand ${FAKTEN_STAND}; Quellen am Ende der Seite.`],
      },
      {
        typ: "karten", id: "wann", h2: "Wann Delaware passt — und wann nicht", spalten: 2,
        karten: [
          { tag: "Passt", titel: "Corporation mit Investoren", text: "US-Investoren, Beteiligungsprogramme für Mitarbeiter, ein späterer Verkauf: Hier ist Delaware der Standard, den jeder kennt." },
          { tag: "Passt selten", titel: "Kleine LLC ohne Investoren", text: "Für eine LLC, die Aufträge abwickelt oder eine Kartenhistorie aufbaut, ist die Jahressteuer von 400 $ ein Posten ohne Gegenwert." },
        ],
      },
      vergleich(2),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Die Jahressteuer der LLC ist fällig, auch wenn die Gesellschaft ruht. Bei Verzug fallen ${STAAT.delaware.jahrVerzug.replace("bei Verzug ", "")} an.`,
          "Eine Gesellschaft aus Delaware, die in einem anderen Staat tätig ist, muss sich dort in der Regel zusätzlich registrieren — mit eigenen Gebühren.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Für Corporations mit Investorenplänen: Gründung, EIN und die Abstimmung mit Anwalt und Steuerberater.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Delaware?", a: `Die Gründung kostet ${STAAT.delaware.gruendung}, die Jahressteuer ${STAAT.delaware.jahr} — ab dem Steuerjahr 2026, fällig am 1. Juni des Folgejahres. Vorher betrug sie 300 $.` },
      { f: "Warum gründen so viele Unternehmen in Delaware?", a: "Wegen des Gesellschaftsrechts: eigene Gerichte für Gesellschaftsstreitigkeiten, eine lange Rechtsprechung und Investoren, die es kennen. Das zählt vor allem für Corporations mit Investoren." },
      { f: "Ist Delaware für eine kleine LLC sinnvoll?", a: "Selten. Für eine LLC ohne Investorenpläne ist die Jahressteuer ein Posten ohne Gegenwert; oft passen Florida oder Wyoming besser." },
      { f: "Muss sich eine Delaware-Gesellschaft in anderen Staaten registrieren?", a: "Ist sie in einem anderen Staat tätig, in der Regel ja — mit eigenen Gebühren dort." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/llc-oder-corporation", "/business/florida", "/business/wyoming", "/business/agenturen-software"],
    quellen: QUELLEN_STAATEN.delaware,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wyoming",
    art: "staat",
    seo: {
      titel: "Wyoming LLC gründen: Kosten und Pflichten — FIAON Global",
      beschreibung: `Wyoming LLC: ${STAAT.wyoming.gruendung} Gründung, License Tax ab 60 $ im Gründungsmonat, keine Körperschaftsteuer des Staats. Wann Wyoming passt — und was es nicht ist.`,
    },
    stand: S,
    kennung: "FG · 21",
    auge: "Wissen · Bundesstaat",
    h1: "Wyoming.",
    h1b: "Schlank und günstig im Unterhalt.",
    lead: "Wyoming ist der Staat der niedrigen Gebühren: 100 $ zur Gründung, ab 60 $ im Jahr, keine Körperschaft- und keine Einkommensteuer des Staats. Für eine LLC, die in keinem bestimmten Staat tätig ist, oft die schlankste Lösung — aber kein Steuermodell für Unternehmer aus Deutschland, Österreich oder der Schweiz.",
    ziffern: [
      { wert: STAAT.wyoming.gruendung, label: "Gründung einer LLC" },
      { wert: "ab 60 $", label: "License Tax im Jahr" },
      { wert: "keine", label: "Körperschaft- und Einkommensteuer des Staats" },
    ],
    blick: [
      ["Gründung", `${STAAT.wyoming.gruendung} (${STAAT.wyoming.gruendungDetail})`],
      ["Jährlich", `${STAAT.wyoming.jahrName}: ${STAAT.wyoming.jahrDetail}`],
      ["Frist", STAAT.wyoming.jahrFrist],
      ["Verzug", STAAT.wyoming.jahrVerzug],
      ["Registered Agent", STAAT.wyoming.agent],
      ["Steuer des Staats", STAAT.wyoming.steuer],
    ],
    kurz: `Eine LLC in Wyoming kostet bei der Gründung ${STAAT.wyoming.gruendung}. Jedes Jahr ist im Gründungsmonat ein Annual Report mit License Tax fällig — 60 $ oder 0,02 % des Vermögens in Wyoming, der höhere Wert. Wyoming erhebt keine Körperschaft- und keine Einkommensteuer des Staats. Steuerpflichtig bleibt die Gesellschaft trotzdem dort, wo sie tatsächlich geführt wird.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Wyoming in Zahlen",
        kopf: ["", "Wyoming"],
        zeilen: [
          ["Gründung einer LLC", `${STAAT.wyoming.gruendung} (${STAAT.wyoming.gruendungDetail})`],
          ["Annual Report", `${STAAT.wyoming.jahrDetail}, ${STAAT.wyoming.jahrFrist}`],
          ["Verzug", STAAT.wyoming.jahrVerzug],
          ["Registered Agent", STAAT.wyoming.agent],
          ["Steuer des Staats", STAAT.wyoming.steuer],
        ],
        fuss: [`Stand ${FAKTEN_STAND}; Quellen am Ende der Seite.`],
      },
      {
        typ: "text", id: "wann", h2: "Wann Wyoming passt",
        absaetze: [
          "Wyoming passt, wenn Ihre LLC in keinem bestimmten Staat tätig ist — etwa eine Gesellschaft, die Onlinegeschäft abwickelt oder eine Kartenhistorie aufbaut — und die laufenden Kosten niedrig bleiben sollen.",
          "Es passt nicht als Steuermodell: Dass Wyoming keine eigene Körperschaftsteuer erhebt, ändert nichts an der Steuerpflicht dort, wo die Gesellschaft geführt wird, und nichts an den Meldepflichten gegenüber der IRS.",
        ],
      },
      vergleich(3),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Der Annual Report ist im Gründungsmonat fällig; ${STAAT.wyoming.jahrVerzug}. Die Frist steht in Ihrem Pflichtenkalender.`,
          GLOBAL_PFLICHTHINWEIS.de[0],
          `Unabhängig vom Staat verlangt die IRS jährlich Form 5472 mit Form 1120; bei Versäumnis drohen ${IRS.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gründung in Wyoming mit allem, was zum Start gehört.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Wyoming?", a: `Die Gründung kostet ${STAAT.wyoming.gruendung}, der jährliche Annual Report mindestens 60 $ License Tax. Bei FIAON Global sind Gründung und das erste Jahr im Festpreis ab ${globalPreisText("global_struktur")} enthalten.` },
      { f: "Zahlt eine Wyoming-LLC keine Steuern?", a: "Wyoming erhebt keine Körperschaft- und keine Einkommensteuer des Staats. Steuerpflichtig ist die Gesellschaft aber dort, wo sie geführt wird — für Unternehmer aus Deutschland, Österreich oder der Schweiz in der Regel zu Hause." },
      { f: "Wann ist der Annual Report in Wyoming fällig?", a: "Am ersten Tag des Monats, in dem die Gesellschaft gegründet wurde. Nach 60 Tagen Verzug droht die Auflösung durch den Staat." },
      { f: "Ist Wyoming besser als Delaware?", a: "Für eine LLC ohne Investoren meist günstiger im Unterhalt. Für eine Corporation mit Investorenplänen ist Delaware der Standard." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/florida", "/business/delaware", "/business/wissen/bundesstaat-waehlen"],
    quellen: QUELLEN_STAATEN.wyoming,
  },
];
