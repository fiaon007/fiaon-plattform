// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN (19.09.2026, E-191)
// „LLC gründen Kosten" ist eine der häufigsten Suchen. Diese Seite sagt alles:
// den Festpreis, was er enthält, was ab dem zweiten Jahr anfällt, was die
// Staaten verlangen — und was es kosten würde, alles selbst zu organisieren.
// Zahlen Dritter aus fakten.ts (Quelle und Stand dort).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_INKLUSIVE, GLOBAL_LAUFEND, GLOBAL_PAKETE, globalPlanungText, globalPreisText } from "../fiaon-global";
import { FAKTEN_STAND, IRS, MARKT, QUELLEN_IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";

const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const KOSTEN: GlobalSeite[] = [
  {
    pfad: "/business/kosten",
    art: "preise",
    seo: {
      titel: "LLC gründen: Kosten im Überblick — FIAON Global",
      beschreibung: "Was eine US-LLC kostet: Staatsgebühren in Florida, Delaware und Wyoming, laufende Kosten ab Jahr zwei und der Festpreis von FIAON Global — mit Quellen.",
    },
    stand: "2026-09-19",
    kennung: "FG · 07",
    auge: "Preise und Ablauf · Kosten",
    h1: "Was eine US-Firma kostet.",
    h1b: "Einmalig, jährlich — offen gesagt.",
    lead: "Eine US-Gesellschaft kostet beim Staat wenig. Teuer werden die Dinge, die niemand vorher nennt: Registered Agent, jährliche Meldung, Steuerberater, US-CPA. Hier steht alles — der Festpreis von FIAON Global, was er enthält und was ab dem zweiten Jahr anfällt.",
    ziffern: [
      { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, einmalig — erstes Jahr inklusive" },
      { wert: `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`, label: "Gründungsgebühr des Staats für eine LLC" },
      { wert: "ab Jahr zwei", label: "Staat, Registered Agent, US-Meldung — vorab genannt" },
    ],
    blick: [
      ["Festpreis", `${GLOBAL_PAKETE.map((p) => globalPreisText(p.key)).join(" · ")}`],
      ["Enthalten", "Staatsgebühr, Registered Agent und Adresse im ersten Jahr, EIN, ITIN, Anwalt, Steuerberater, US-CPA"],
      ["Staat, einmalig", `Florida ${STAAT.florida.gruendung} · Delaware ${STAAT.delaware.gruendung} · Wyoming ${STAAT.wyoming.gruendung}`],
      ["Staat, jährlich", `Florida ${STAAT.florida.jahr} · Delaware ${STAAT.delaware.jahr} · Wyoming ${STAAT.wyoming.jahr}`],
      ["IRS", "EIN und ITIN ohne Gebühr"],
      ["Umsatzsteuer", "Unternehmen: zuzüglich, soweit sie anfällt · Privatpersonen: Endpreise"],
    ],
    kurz: `Die Gründung einer US-LLC kostet beim Bundesstaat ${STAAT.wyoming.gruendung} (Wyoming) bis ${STAAT.florida.gruendung} (Florida); EIN und ITIN vergibt die IRS ohne Gebühr. Jährlich fallen die Staatsgebühr oder -steuer, der Registered Agent (am Markt ${MARKT.agent}) und die Meldung an die IRS durch einen US-CPA (am Markt ${MARKT.cpa5472}) an. Bei FIAON Global ist das erste Jahr im Festpreis ab ${globalPreisText("global_struktur")} enthalten — mit Anwalt, Steuerberater und US-CPA.`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "Die Festpreise",
        lead: "Jedes Paket ist ein Betreuungsauftrag zum Festpreis, einmalig bezahlt. Kein Abo, keine Monatsrate.",
        kopf: ["Paket", "Festpreis", "Kapitalrahmen", "Begleitung"],
        zeilen: GLOBAL_PAKETE.map((p) => [p.de.name, globalPreisText(p.key), globalPlanungText(p.key), gross(p.de.dauerKurz)]),
        hervor: 1,
        fuss: ["Unternehmen: zuzüglich Umsatzsteuer, soweit sie anfällt. Privatpersonen: Endpreise. Der Kapitalrahmen ist Ihr Ziel; über jeden Rahmen entscheidet das Institut."],
      },
      {
        typ: "text", id: "enthalten", h2: "Was im Festpreis enthalten ist",
        absaetze: ["Sie zahlen einen Preis. Wir bezahlen alle, die für Ihre Gesellschaft arbeiten — in jedem der vier Pakete:"],
        punkte: [...GLOBAL_INKLUSIVE.de],
        nach: "Darüber hinaus enthalten die größeren Pakete weitere Kartenanträge, den Pflichtenkalender, die Kennzahlen-Mappe und beim Paket Global VIP Flug und Hotel für den Auftakt in Miami.",
      },
      {
        typ: "tabelle", id: "staaten", h2: "Was die Bundesstaaten verlangen",
        lead: "Die drei Staaten, nach denen am häufigsten gefragt wird — Beträge für eine LLC.",
        kopf: ["", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Gründung", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich", `${STAAT.florida.jahr} (${STAAT.florida.jahrName})`, `${STAAT.delaware.jahr} (${STAAT.delaware.jahrName})`, `${STAAT.wyoming.jahr} (${STAAT.wyoming.jahrName})`],
          ["Frist", "1. Januar bis 1. Mai", STAAT.delaware.jahrFrist, "Gründungsmonat"],
          ["Bei Verzug", STAAT.florida.jahrVerzug, STAAT.delaware.jahrVerzug, "Auflösung nach 60 Tagen möglich"],
          ["Registered Agent", "Pflicht", "Pflicht", "Pflicht"],
        ],
        fuss: [
          `Stand ${FAKTEN_STAND}. ${STAAT.florida.gruendung} in Florida = ${STAAT.florida.gruendungDetail}.`,
          `Delaware: ${STAAT.delaware.jahrAlt}`,
          `Wyoming: ${STAAT.wyoming.jahrDetail}.`,
          "Für Corporations gelten andere Beträge; die Einzelheiten stehen auf den Seiten der Bundesstaaten.",
        ],
      },
      {
        typ: "tabelle", id: "laufend", h2: "Was ab dem zweiten Jahr jährlich anfällt",
        lead: GLOBAL_LAUFEND.de,
        kopf: ["Posten", "Betrag", "Bemerkung"],
        zeilen: [
          ["Staatsgebühr oder -steuer", "60 $ bis 400 $", "je nach Bundesstaat, siehe oben"],
          ["Registered Agent", MARKT.agent, "gesetzlich vorgeschrieben"],
          ["Form 5472 mit Form 1120", MARKT.cpa5472, "durch einen US-CPA, auch ohne Umsatz Pflicht"],
          ["Steuerberater im Heimatland", "nach dessen Honorar", "Steuererklärung und Meldung der Beteiligung"],
          ["Jahresbetreuung FIAON Global", "699 € im Jahr", "Staatsgebühr, Registered Agent, Adresse, Telefon und Form 5472 inklusive"],
        ],
        fuss: ["Registered Agent und US-CPA: veröffentlichte Preise mehrerer Anbieter, September 2026 — keine amtlichen Werte. Mit der Jahresbetreuung übernehmen wir alle Posten außer dem Steuerberater im Heimatland für 699 € im Jahr, alle Gebühren inklusive (19.09.2026)."],
      },
      {
        typ: "tabelle", id: "selbst", h2: "Selbst organisiert — oder im Festpreis",
        lead: "Was jede Stelle einzeln kosten würde. Wer nur eine Gesellschaft braucht und alles selbst koordiniert, zahlt weniger als unseren Festpreis — und trägt jedes Risiko allein.",
        kopf: ["Posten", "Selbst organisiert", "FIAON Global"],
        zeilen: [
          ["Gründungsgebühr des Staats", `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`, "enthalten"],
          ["Registered Agent, erstes Jahr", MARKT.agent.replace(" im Jahr", ""), "enthalten"],
          ["US-Adresse und Telefonnummer", "nach Anbieter", "enthalten, erstes Jahr"],
          ["EIN", "keine Gebühr, Ihr Aufwand", "enthalten"],
          ["ITIN über einen Acceptance Agent", MARKT.acceptanceAgent, "enthalten"],
          ["Operating Agreement durch einen Anwalt", "nach Honorar", "enthalten"],
          ["Prüfung durch einen Steuerberater", "nach Honorar", "enthalten"],
          ["Erste Form 5472 durch einen US-CPA", MARKT.cpa5472.replace(" im Jahr", ""), "enthalten"],
          ["Konto- und Kartenantrag, Koordination", "Ihre Zeit", "enthalten"],
        ],
        hervor: 2,
        fuss: [`Gebühren der Staaten und der IRS: amtliche Werte, Stand ${FAKTEN_STAND}. Übrige Posten: Marktspannen.`],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Laufende Buchhaltung, Umsatzsteuer-Registrierungen in den USA und die Steuererklärung im Heimatland sind nicht Teil der Pakete.",
          `Für eine versäumte Form 5472 kann die IRS ${IRS.strafe5472} festsetzen — die teuerste Position ist die vergessene.`,
          "Gebühren der Staaten ändern sich: Delaware hat die Jahressteuer der LLC ab dem Steuerjahr 2026 von 300 $ auf 400 $ angehoben.",
        ],
      },
      { typ: "pakete", id: "pakete", h2: "Die vier Pakete", lead: "Festpreis, einmalig — alle Gebühren und die Honorare unserer Partner inklusive." },
    ],
    fragen: [
      { f: "Was kostet es, eine LLC in den USA zu gründen?", a: `Beim Bundesstaat ${STAAT.wyoming.gruendung} (Wyoming), ${STAAT.delaware.gruendung} (Delaware) oder ${STAAT.florida.gruendung} (Florida). Dazu kommen Registered Agent, Adresse, Anwalt, Steuerberater und US-CPA. Bei FIAON Global ist all das im Festpreis ab ${globalPreisText("global_struktur")} enthalten.` },
      { f: "Welche laufenden Kosten hat eine US-LLC?", a: `Jährlich die Staatsgebühr oder -steuer (60 $ bis 400 $ je nach Staat), den Registered Agent (am Markt ${MARKT.agent}) und die Meldung an die IRS durch einen US-CPA (am Markt ${MARKT.cpa5472}).` },
      { f: "Was kosten EIN und ITIN?", a: `Bei der IRS nichts. Wer die ITIN über einen Acceptance Agent beantragt, zahlt am Markt ${MARKT.acceptanceAgent}. Bei FIAON Global sind beide Anträge im Festpreis enthalten.` },
      { f: "Gibt es versteckte Kosten?", a: "Nein. Was im Festpreis steckt, steht im Vertrag. Die laufenden Kosten Ihrer Gesellschaft ab dem zweiten Jahr übernimmt auf Wunsch die Jahresbetreuung für 699 € im Jahr, alle Gebühren inklusive; Buchhaltung und Steuererklärung im Heimatland sind nicht Teil der Pakete." },
      { f: "Ist die Umsatzsteuer im Festpreis enthalten?", a: "Für Unternehmen verstehen sich die Preise zuzüglich Umsatzsteuer, soweit sie anfällt. Für Privatpersonen sind die Festpreise Endpreise." },
      { f: "Warum ist der Festpreis höher als die Staatsgebühr?", a: "Weil er alle enthält, die für Ihre Gesellschaft arbeiten: Registered Agent, Adresse, Telefon, Anwalt, Steuerberater, US-CPA, die Anträge für EIN und ITIN und die Vorbereitung von Konto und Karte — koordiniert von einem Ansprechpartner." },
    ],
    weiter: ["/business/vergleich", "/business/paket-finder", "/business/privatpersonen", "/business/us-pflichten"],
    quellen: [...QUELLEN_STAATEN.florida.slice(0, 2), QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.delaware[1], QUELLEN_STAATEN.wyoming[0], QUELLEN_STAATEN.wyoming[1], QUELLEN_IRS[0], QUELLEN_IRS[2], QUELLEN_IRS[4]],
  },
];
