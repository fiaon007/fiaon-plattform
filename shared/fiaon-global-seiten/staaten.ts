// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE BUNDESSTAATEN (19.09.2026, E-191)
// Florida, Delaware, Wyoming — die drei, nach denen am häufigsten gesucht wird
// („florida llc gründen", „delaware llc gründen", „wyoming llc gründen").
// Beträge und Fristen aus fakten.ts (amtlich, Stand September 2026).
// Welcher Staat passt, hängt vom Vorhaben ab — die Seiten sagen, wann welcher
// passt, und nennen die Kehrseite.
//
// E-510 (13.11.2026) — Wortlaut nach dem Sprachleitfaden:
//   · Kein Satz über ein eigenes Team vor Ort; die Partnergesellschaft wird hier nicht genannt. Der Baustein
//     „standorte“ der Florida-Seite (bis 12.11.: „Unser Team in Miami“ mit der Orte-Karte) ist deshalb entfallen —
//     die Karte der verbundenen Gesellschaft gehört nur auf die Partnerseite (Leitfaden 6.2).
//   · „Banken und Investoren ist Delaware vertraut.“ statt einer Rangfolge ohne Beleg.
//   · Jede Dauer ist ein Erfahrungswert mit Stand und mit dem, der entscheidet — nie in Titel,
//     Beschreibung, H1, Lead oder Kennziffer (Leitfaden 5.5 und 5.14).
//   · Kein Honorar-Betrag auf diesen Seiten: Das Honorar hat drei Zeilen und steht in der Karte „Ein Mandat“.
//   · Die Sätze je Staat (Eintragungszeit, Kehrseite) kommen aus STAAT_SEITENTEXT in bundesstaat-wahl.ts,
//     feste Sätze aus shared/fiaon-global-saetze.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_AGENT, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import { FAKTEN_STAND, IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import { STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL } from "../fiaon-global-bundesstaaten";
import { beleg, satz, sechsSchritte, vierSchritte } from "../fiaon-global-saetze";
import { STAAT_SEITENTEXT, staatEintragung } from "./bundesstaat-wahl";
import type { GlobalBlock, GlobalSeite } from "./typen";

/** Tag der letzten inhaltlichen Änderung (E-510: Wortlaut nach dem Sprachleitfaden). */
const STAND_SEITE = "2026-11-13";
/** Überschrift des Bausteins „Ein Mandat“ (E-509: ein Produkt statt vier Pakete; Wortlaut nach Leitfaden 7.2). */
const KARTE_H2 = "Ein Mandat";
// E-465 (29.10.2026): Eintragungszeiten als Erfahrungswerte, Express und Delaware als Standard für neue Mandate —
// Kurz-Zeiten aus shared/fiaon-global-bundesstaaten.ts (Stand Oktober 2026).
const ZEIT = STAATEN_STAND_TEXT.de;

// Feste Wortlaute aus shared/fiaon-global-saetze.ts — hier nur zusammengesetzt, nie neu getippt.
/** Was wir bei der Gründung tun, und wer entscheidet (Kurzfassung, Platz 1). */
const GRUENDUNG = vierSchritte("de").schritte[0].text;
/** Was der Klient selbst tut (Schritt 1). */
const IHR_TEIL = sechsSchritte("de").schritte[0].ihrTeil;
/** Der Satz zum Honorar ohne Betrag. */
const HONORAR_VORAB = beleg("honorarVorab", "de");
/** Was im ersten Jahr an Staatsgebühren enthalten ist (Vertrag, Ziffer 2). */
const STAAT_ENTHALTEN = "Im Mandat von FIAON Global sind die Gründungsgebühr des Staats und die erste Jahresmeldung beim Bundesstaat enthalten.";

/** Der Vergleich der drei Staaten — auf jeder Staatsseite derselbe (E-465: Reihenfolge Delaware, Florida, Wyoming; Eintragung und Express). */
function vergleich(hervor: 1 | 2 | 3): GlobalBlock {
  return {
    typ: "tabelle", id: "vergleich", h2: "Delaware, Florida und Wyoming im Vergleich",
    lead: `Die drei Staaten für eine LLC nebeneinander. Eintragungszeiten Stand ${ZEIT}: Erfahrungswerte, keine Fristen. Es entscheidet der Staat.`,
    kopf: ["", ...STAATEN_ZUR_WAHL.map((b) => b.name)],
    zeilen: [
      ["Eintragung", ...STAATEN_ZUR_WAHL.map((b) => b.eintragungKurz.de)],
      ["Express", ...STAATEN_ZUR_WAHL.map((b) => b.express.kurz.de)],
      ["Gründung", STAAT.delaware.gruendung, STAAT.florida.gruendung, STAAT.wyoming.gruendung],
      ["Jährlich an den Staat", STAAT.delaware.jahr, STAAT.florida.jahr, STAAT.wyoming.jahr],
      ["Frist", "1. Juni", "1. Januar bis 1. Mai", "Gründungsmonat"],
      ["Steuer des Staats", "je nach Tätigkeit", "5,5 % für Corporations", "keine Körperschaft- und Einkommensteuer"],
      ["Stärke", "Express; Banken und Investoren vertraut", "Geschäft und Termine in Florida", "niedrige laufende Kosten"],
    ],
    hervor,
    fuss: [`Zeiten Stand ${ZEIT}, Beträge Stand ${FAKTEN_STAND} für LLCs. Delaware: ${STAAT.delaware.jahrAlt}`, satz("S15", "de")],
  };
}

export const STAATEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/florida",
    art: "staat",
    seo: {
      titel: "Florida LLC gründen: Kosten und Pflichten — FIAON Global",
      beschreibung: `Florida LLC: ${STAAT.florida.gruendung} Gründungsgebühr, ${STAAT.florida.jahr} Annual Report bis 1. Mai, Registered Agent mit Anschrift in Florida. Mit Quellen und Stand.`,
    },
    stand: STAND_SEITE,
    kennung: "FG · 19",
    auge: "Wissen · Bundesstaat",
    h1: "Florida LLC.",
    h1b: "Für Geschäft und Termine vor Ort.",
    lead: "Florida passt für Unternehmen, die dort tätig sind: mit Kunden, Projekten oder Terminen im Staat. Die Gebühren stehen im Gesetz, und der Annual Report hat eine feste Frist im Frühjahr. Für die Eintragung braucht Florida derzeit länger als gewohnt; einen Express bietet der Staat nicht an.",
    ziffern: [
      { wert: STAAT.florida.gruendung, label: "Gründungsgebühr des Staats für eine LLC" },
      { wert: STAAT.florida.jahr, label: "Annual Report, 1. Januar bis 1. Mai" },
      { wert: "kein Express", label: `Florida bietet keine Eilbearbeitung an (Stand ${ZEIT})` },
    ],
    blick: [
      ["Eintragung", `Erfahrungswert: derzeit rund zwei Wochen, kein Express (Stand ${ZEIT}); es entscheidet der Staat`],
      ["Gründung", `${STAAT.florida.gruendung} — ${STAAT.florida.gruendungDetail}`],
      ["Jährlich", `${STAAT.florida.jahr} ${STAAT.florida.jahrName}, ${STAAT.florida.jahrFrist}`],
      ["Verzug", STAAT.florida.jahrVerzug],
      ["Registered Agent", STAAT.florida.agent],
      ["Steuer des Staats", STAAT.florida.steuer],
      ["LLC einer GmbH oder AG", "eigene Florida-Steuererklärung der Gesellschafterin (Form F-1120)"],
    ],
    kurz: `Eine LLC in Florida kostet bei der Gründung ${STAAT.florida.gruendung} Staatsgebühr. Jedes Jahr ist zwischen 1. Januar und 1. Mai ein Annual Report über ${STAAT.florida.jahr} fällig; danach kommen 400 $ hinzu. Ein Registered Agent mit Anschrift in Florida ist Pflicht. Die Eintragung dauert derzeit oft rund zwei Wochen, ohne Express (Erfahrungswert, Stand ${ZEIT}); es entscheidet der Staat.`,
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
        absaetze: ["Florida ist kein Steuerstaat und kein Investorenstaat. Es ist der Staat für Unternehmen, die dort tätig sind. Florida passt, wenn:"],
        punkte: [
          "Ihre Kunden, Lieferanten oder Projekte in Florida liegen",
          "Ihre Gesellschaft in Florida ein Büro, ein Lager oder Mitarbeiter hat",
          "Sie Termine vor Ort brauchen — bei Behörden oder Instituten",
          "Sie ein Institut mit Filialen in Florida nutzen wollen",
        ],
        nach: STAAT.florida.llcSteuer,
      },
      vergleich(2),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Eintragung: ${staatEintragung("florida", "de")} Für einen festen Zeitplan kommen Delaware mit Express oder Wyoming in Betracht.`,
          `Wer den Annual Report nach dem 1. Mai abgibt, zahlt ${STAAT.florida.jahrVerzug.replace("nach dem 1. Mai ", "")}. Die Frist steht in Ihrem Pflichtenkalender.`,
          GLOBAL_PFLICHTHINWEIS.de[0],
          `Unabhängig vom Staat verlangt die IRS jährlich Form 5472 mit Form 1120; bei Versäumnis drohen ${IRS.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL} Im Honorarrechner ist Delaware als Bundesstaat vorgesehen; eine Gründung in Florida stimmen wir im Gespräch mit Ihnen ab.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Florida?", a: `Die Gründung kostet beim Staat ${STAAT.florida.gruendung}, der jährliche Annual Report ${STAAT.florida.jahr}. ${STAAT_ENTHALTEN} ${HONORAR_VORAB}` },
      { f: "Wann ist der Annual Report in Florida fällig?", a: "Zwischen 1. Januar und 1. Mai, erstmals im Jahr nach der Gründung. Nach dem 1. Mai kommen 400 $ Verspätungsgebühr hinzu." },
      { f: "Zahlt eine Florida-LLC Körperschaftsteuer?", a: "Eine LLC, die steuerlich nicht als eigenes Steuersubjekt gilt, gibt keine eigene Florida-Erklärung ab. Gehört sie einer Kapitalgesellschaft wie einer GmbH, gibt diese eine Florida-Erklärung ab; Corporations zahlen 5,5 % mit einem Freibetrag von 50.000 $." },
      { f: "Wie lange dauert die Gründung in Florida?", a: staatEintragung("florida", "de") },
      { f: "Brauche ich eine Adresse in Florida?", a: "Die Gesellschaft braucht einen Registered Agent mit Anschrift in Florida. Den Registered Agent und die US-Geschäftsadresse stellen wir im ersten Jahr." },
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
      beschreibung: `Delaware LLC: ${STAAT.delaware.gruendung} Gründungsgebühr, ${STAAT.delaware.jahr} Jahressteuer zum 1. Juni, Express des Staats gegen Eilgebühr. Wann Delaware passt — mit Quellen und Stand.`,
    },
    stand: STAND_SEITE,
    kennung: "FG · 20",
    auge: "Wissen · Bundesstaat",
    h1: "Delaware LLC.",
    h1b: "Banken und Investoren vertraut.",
    lead: `Delaware ist für sein Gesellschaftsrecht bekannt: ein eigenes Gericht für Gesellschaftsstreitigkeiten und eine lange Rechtsprechung. Banken und Investoren ist Delaware vertraut. Für die Eintragung bietet der Staat einen Express an; die Kehrseite ist die Jahressteuer von ${STAAT.delaware.jahr}.`,
    ziffern: [
      { wert: STAAT.delaware.gruendung, label: "Gründungsgebühr des Staats für eine LLC" },
      { wert: STAAT.delaware.jahr, label: "Jahressteuer der LLC ab Steuerjahr 2026" },
      { wert: "Express", label: `Eilbearbeitung des Staats gegen amtliche Gebühr (Stand ${ZEIT})` },
    ],
    blick: [
      ["Eintragung", `Erfahrungswert: ein bis zwei Werktage mit Express (Stand ${ZEIT}); es entscheidet der Staat`],
      ["Gründung", `${STAAT.delaware.gruendung} (${STAAT.delaware.gruendungDetail})`],
      ["Jährlich", `${STAAT.delaware.jahr} ${STAAT.delaware.jahrName}, fällig ${STAAT.delaware.jahrFrist}`],
      ["Verzug", STAAT.delaware.jahrVerzug],
      ["Neu", `Ab Steuerjahr 2026 ${STAAT.delaware.jahr} statt 300 $`],
      ["Registered Agent", STAAT.delaware.agent],
      ["Corporation", "Annual Report 50 $, Franchise Tax mindestens 175 $, fällig 1. März"],
    ],
    kurz: `Eine LLC in Delaware kostet bei der Gründung ${STAAT.delaware.gruendung}. Jedes Jahr ist am 1. Juni eine Jahressteuer von ${STAAT.delaware.jahr} fällig. Ein Registered Agent mit Büro in Delaware ist Pflicht. Mit dem Express des Staats dauert die Eintragung in der Regel ein bis zwei Werktage (Erfahrungswert, Stand ${ZEIT}); es entscheidet der Staat. Delaware ist unser Standard für neue Mandate.`,
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
        typ: "karten", id: "wann", h2: "Wann Delaware passt — und wann nicht", spalten: 3,
        karten: [
          { tag: "Passt", titel: "Fester Zeitplan", text: "Delaware bietet für die Eintragung einen Express an; die Erfahrungswerte stehen im Vergleich. Banken und Investoren ist Delaware vertraut." },
          { tag: "Passt", titel: "Corporation mit Investoren", text: "US-Investoren, Beteiligungsprogramme für Mitarbeiter, ein späterer Verkauf: Dafür wird in der Regel eine Corporation in Delaware gewählt." },
          { tag: "Passt weniger", titel: "Wenn niedrige laufende Kosten zählen", text: `Die Jahressteuer von ${STAAT.delaware.jahr} ist der höchste Posten der drei Staaten. Zählen vor allem niedrige laufende Kosten, liegt Wyoming mit ${STAAT.wyoming.jahr} License Tax im Jahr darunter.` },
        ],
      },
      vergleich(1),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Eintragung: ${staatEintragung("delaware", "de")}`,
          `Die Jahressteuer der LLC ist fällig, auch wenn die Gesellschaft ruht. Bei Verzug fallen ${STAAT.delaware.jahrVerzug.replace("bei Verzug ", "")} an.`,
          "Eine Gesellschaft aus Delaware, die in einem anderen Staat tätig ist, muss sich dort in der Regel zusätzlich registrieren — mit eigenen Gebühren.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL}`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Delaware?", a: `Die Gründung kostet beim Staat ${STAAT.delaware.gruendung}, die Jahressteuer ${STAAT.delaware.jahr} — ab dem Steuerjahr 2026, fällig am 1. Juni des Folgejahres. Vorher betrug sie 300 $.` },
      { f: "Warum gründen so viele Unternehmen in Delaware?", a: "Wegen des Gesellschaftsrechts: ein eigenes Gericht für Gesellschaftsstreitigkeiten, eine lange Rechtsprechung und Investoren, denen Delaware vertraut ist. Das zählt vor allem für Corporations mit Investoren." },
      { f: "Wie lange dauert die Eintragung in Delaware?", a: staatEintragung("delaware", "de") },
      { f: "Ist Delaware auch für eine kleine LLC sinnvoll?", a: `Oft ja: Der Staat bietet einen Express an, und Banken und Investoren ist Delaware vertraut. Die Kehrseite ist die Jahressteuer von ${STAAT.delaware.jahr}. Zählen vor allem niedrige laufende Kosten, liegt Wyoming darunter.` },
      { f: "Muss sich eine Delaware-Gesellschaft in anderen Staaten registrieren?", a: "Ist sie in einem anderen Staat tätig, in der Regel ja — mit eigenen Gebühren dort." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/bundesstaat-waehlen", "/business/wissen/llc-oder-corporation", "/business/florida", "/business/wyoming"],
    quellen: QUELLEN_STAATEN.delaware,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wyoming",
    art: "staat",
    seo: {
      titel: "Wyoming LLC gründen: Kosten und Pflichten — FIAON Global",
      beschreibung: `Wyoming LLC: ${STAAT.wyoming.gruendung} Gründungsgebühr, License Tax ${STAAT.wyoming.jahr} im Jahr, keine Körperschaftsteuer des Staats, kein Steuermodell. Mit Quellen und Stand.`,
    },
    stand: STAND_SEITE,
    kennung: "FG · 21",
    auge: "Wissen · Bundesstaat",
    h1: "Wyoming LLC.",
    h1b: "Niedrige laufende Kosten.",
    lead: `Wyoming ist der Staat der niedrigen Gebühren: ${STAAT.wyoming.gruendung} zur Gründung, ${STAAT.wyoming.jahr} im Jahr, keine Körperschaft- und keine Einkommensteuer des Staats. Für eine LLC, die in keinem bestimmten Staat tätig ist, sind das die niedrigsten laufenden Kosten der drei Staaten. Ein Steuermodell für Unternehmer aus Deutschland, Österreich oder der Schweiz ist Wyoming nicht.`,
    ziffern: [
      { wert: STAAT.wyoming.gruendung, label: "Gründungsgebühr des Staats für eine LLC" },
      { wert: STAAT.wyoming.jahr, label: "License Tax im Jahr" },
      { wert: "keine", label: "Körperschaft- und Einkommensteuer des Staats" },
    ],
    blick: [
      ["Eintragung", `Erfahrungswert: rund drei Werktage (Stand ${ZEIT}); es entscheidet der Staat`],
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
          "Wyoming passt, wenn Ihre LLC in keinem bestimmten Staat tätig ist und die laufenden Kosten niedrig bleiben sollen. Das gilt etwa für eine Gesellschaft, die ihr Geschäft online abwickelt oder eine Zahlungshistorie in den USA aufbaut.",
          "Es passt nicht als Steuermodell: Dass Wyoming keine eigene Körperschaftsteuer erhebt, ändert nichts an der Steuerpflicht dort, wo die Gesellschaft geführt wird, und nichts an den Meldepflichten gegenüber der IRS.",
        ],
      },
      vergleich(3),
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `Eintragung: ${staatEintragung("wyoming", "de")}`,
          STAAT_SEITENTEXT.wyoming.nachteile.de[0],
          `Der Annual Report ist im Gründungsmonat fällig; ${STAAT.wyoming.jahrVerzug}. Die Frist steht in Ihrem Pflichtenkalender.`,
          "Wyoming verlangt für jede Gesellschaft eine Kontaktperson mit Anschrift und Telefonnummer — in der Regel Sie selbst als Inhaber. Wir hinterlegen diese Angaben vertraulich; öffentlich einsehbar sind sie nicht.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          `Unabhängig vom Staat verlangt die IRS jährlich Form 5472 mit Form 1120; bei Versäumnis drohen ${IRS.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL} Im Honorarrechner ist Delaware als Bundesstaat vorgesehen; eine Gründung in Wyoming stimmen wir im Gespräch mit Ihnen ab.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Was kostet eine LLC in Wyoming?", a: `Die Gründung kostet beim Staat ${STAAT.wyoming.gruendung}, der jährliche Annual Report ${STAAT.wyoming.jahr} License Tax. ${STAAT_ENTHALTEN} ${HONORAR_VORAB}` },
      { f: "Zahlt eine Wyoming-LLC keine Steuern?", a: "Wyoming erhebt keine Körperschaft- und keine Einkommensteuer des Staats. Steuerpflichtig ist die Gesellschaft aber dort, wo sie geführt wird — für Unternehmer aus Deutschland, Österreich oder der Schweiz in der Regel zu Hause." },
      { f: "Wann ist der Annual Report in Wyoming fällig?", a: "Am ersten Tag des Monats, in dem die Gesellschaft gegründet wurde. Nach sechzig Tagen Verzug droht die Auflösung durch den Staat." },
      { f: "Ist Wyoming besser als Delaware?", a: `Wyoming hat die niedrigeren laufenden Kosten: ${STAAT.wyoming.jahr} License Tax im Jahr gegenüber ${STAAT.delaware.jahr} Jahressteuer in Delaware. Banken und Investoren ist Delaware vertraut; manche Institute schauen bei Wyoming-Gesellschaften ohne Geschäft vor Ort genauer hin. Die Eintragungszeiten beider Staaten stehen im Vergleich, als Erfahrungswerte.` },
      { f: "Wie lange dauert die Eintragung in Wyoming?", a: staatEintragung("wyoming", "de") },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/florida", "/business/delaware", "/business/wissen/bundesstaat-waehlen"],
    quellen: QUELLEN_STAATEN.wyoming,
  },
];
