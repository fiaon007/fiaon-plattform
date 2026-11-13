// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — HONORAR UND ABLAUF (19.09.2026, E-191)
// Ablauf und Dauer, Vergleich. Die Seite
// „Kosten“ steht in kosten.ts (Zahlen Dritter mit Quelle und Stand).
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Die Seite /business/paket-finder gibt es nicht mehr: Der Honorarrechner
// /business/start ist der neue Finder, die alte Adresse leitet dauerhaft dorthin (GLOBAL_UMGEZOGEN).
// E-510 (13.11.2026): nach dem Sprachleitfaden. Der Ablauf zählt die SECHS Schritte in Justins Reihenfolge — Gründung,
// Unterlagen, Konten, Kreditkarten auf Wunsch, Finanzierung, Umschuldung und Aufstockung — und holt sie wortgleich aus
// shared/fiaon-global-saetze.ts (Satz, Bedingung, Ihr Ergebnis; die Tabelle „Wer handelt, wer entscheidet“ aus werMachtWas).
// Angebot, Unterschrift, Rechnung und Reisepass stehen davor unter „Ihr Mandat beginnt“, ohne eigene Nummern.
// Dauern nur als Erfahrungswerte mit dem, der entscheidet (fester Satz S15). Beträge nur aus der Preisquelle, das Honorar
// immer in drei Zeilen. Kein Wort zur Bürgschaft; Partner nur mit ihrer Zuständigkeit, nie bei der Arbeit im Präsens.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import { globalMenuePunkt } from "../fiaon-global-menue";
import { SAETZE_BETRAEGE, SCHRITTE_KOPF, satz, sechsSchritte, weitererSatz } from "../fiaon-global-saetze";
import { STAATEN_STAND_TEXT } from "../fiaon-global-bundesstaaten";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

const S = "2026-11-13";
/** Die Beträge aus der Preisquelle — nie getippt. */
const B = SAETZE_BETRAEGE.de;
/** Die sechs Schritte, wortgleich aus der Quelle der festen Sätze. */
const SCHRITTE = sechsSchritte("de").schritte;
const KOPF = SCHRITTE_KOPF.de;
/** Das Honorar in Kurzform (Leitfaden 1.3, Antwort „Was kostet es — und wann?“). */
const HONORAR_KURZ = `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`;
/** Dasselbe als eine Zeile für „Auf einen Blick“ — immer alle drei Teile. */
const HONORAR_ZEILE = `${B.honorarAuftrag} mit Ihrem Auftrag · Erfolgshonorar mit der Eintragung, mindestens ${B.erfolgMin} · ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr`;
/** Die Karte „Ein Mandat“ am Ende beider Seiten — Überschrift und Einleitung wie auf jeder Unterseite (ein-produkt.ts). */
const KARTE = { h2: EIN_PRODUKT.de.karteH2, lead: EIN_PRODUKT.de.karteLead };
/** Der Name der Kostenseite, wie er im Menü steht — für den Verweis in der Fußzeile der Tabelle. */
const KOSTEN_SEITE = globalMenuePunkt("/business/kosten")?.titel ?? "Kosten im Überblick";
/** Erfahrungswerte je Schritt (Tabelle „Wie lange es dauert“) — nie eine Frist, immer mit dem, der entscheidet. */
const ERFAHRUNG: Record<number, string> = {
  1: "Eintragung je nach Bundesstaat wenige Tage bis rund zwei Wochen",
  2: "EIN und ITIN in eigener Frist der US-Steuerbehörde",
  3: "nach der Prüfung durch das jeweilige Institut",
  4: "nach der Prüfung durch den Herausgeber",
  5: "Ziel und Bedingungen stehen in Ihrem Vertrag",
  6: "ab dem achtzehnten Monat, mit laufender Jahresbetreuung",
};

export const PREISE_UND_ABLAUF: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "Ablauf einer US-Firmengründung — FIAON Global",
      beschreibung: "Der Ablauf einer US-Firmengründung in sechs Schritten: was wir tun, was Sie selbst tun, wer entscheidet. Dauern sind Erfahrungswerte, keine Fristen.",
    },
    stand: S,
    kennung: "FG · 08",
    auge: "Honorar und Ablauf · Ablauf",
    h1: "Ablauf der US-Firmengründung.",
    h1b: "Sechs Schritte, eine Reihenfolge.",
    lead: "Von der Gründung bis zur Entscheidung des finanzierenden Instituts: Sie sehen zu jeder Zeit, wer handelt, wer entscheidet und was als Nächstes folgt. Den Stand zeigt Ihr Portal.",
    ziffern: [
      { wert: "6 Schritte", label: "jeder mit seiner Bedingung" },
      { wert: "1 Mandat", label: "ein Vertrag, ein fester Ansprechpartner" },
      { wert: "1 Portal", label: "Stand, Unterlagen und Pflichtenkalender" },
    ],
    blick: [
      ["Ihr Angebot", "Angebot anfordern oder Gespräch vereinbaren"],
      ["Vertrag", "Online unterzeichnet; Vertrag und Rechnung per E-Mail"],
      ["Beginn der Arbeit", "Nach Eingang Ihrer Zahlung und Ihres Reisepasses"],
      ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen; die Anträge bei den Instituten stellen Sie selbst"],
      ["Wer entscheidet", "Der Bundesstaat, die US-Steuerbehörde und das jeweilige Institut"],
      ["Stand", "Jederzeit in Ihrem Portal: aktueller Schritt, Unterlagen, Pflichtenkalender"],
      ["Dauer", "Erfahrungswerte, keine Fristen — es bestimmen Behörden und Institute"],
    ],
    kurz: `Ihr Mandat beginnt mit Ihrem Angebot: Sie fordern es im Honorarrechner an oder vereinbaren zuerst ein Gespräch, und Sie unterzeichnen online. Nach Eingang Ihrer Zahlung und Ihres Reisepasses folgen sechs Schritte: Gründung, Unterlagen, Konten, Kreditkarten auf Wunsch, Finanzierung, Umschuldung und Aufstockung. Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde, über Konto, Karte und Finanzierung das jeweilige Institut. ${satz("S15")}`,
    bloecke: [
      {
        // Angebot, Unterschrift, Rechnung und Reisepass stehen VOR den sechs Schritten — ohne eigene Schritt-Nummern (Leitfaden 2.1).
        typ: "text", id: "beginn", h2: "Ihr Mandat beginnt",
        absaetze: ["Bevor der erste Schritt beginnt, liegen vier Dinge vor:"],
        punkte: [
          "Ihr Angebot: Sie fordern es im Honorarrechner an oder vereinbaren zuerst ein Gespräch — dreißig Minuten, kostenfrei.",
          "Ihre Unterschrift: Sie lesen Ihren vollständigen Vertrag in Ihrem persönlichen Angebot, wählen den Namen Ihrer Gesellschaft und unterzeichnen online. Vertragspartner ist die FIAON LTD, London.",
          `Ihre Rechnung: Vertrag und Rechnung erhalten Sie per E-Mail, dazu den Zugang zu Ihrem Portal. ${weitererSatz("ZAHLUNG")}`,
          "Ihr Reisepass: Sie laden ihn nach der Unterschrift hoch. Nach Eingang Ihrer Zahlung und Ihres Reisepasses beginnen wir.",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: KOPF.h2, lead: KOPF.lead,
        etappen: SCHRITTE.map((s) => ({ titel: s.titel, text: `${s.satz} ${s.bedingung} ${KOPF.teile.ihrErgebnis}: ${s.ihrErgebnis}` })),
      },
      {
        // Die Tabelle „Wer macht was — und was gilt, wenn etwas ausbleibt“ (Leitfaden 2.4), ganz. Die Spalte „Partner“ gibt es
        // öffentlich erst, wenn Justin die Partner bestätigt hat; bis dahin steht ihre Zuständigkeit im Rollen-Satz darunter.
        typ: "tabelle", id: "wer", h2: "Wer handelt, wer entscheidet",
        lead: "Je Schritt: was FIAON tut, was Sie selbst tun, wer entscheidet — und was gilt, wenn es ausbleibt.",
        kopf: [KOPF.spalten.schritt, KOPF.spalten.fiaon, KOPF.spalten.sie, KOPF.spalten.entscheidet, KOPF.spalten.wennEsAusbleibt],
        zeilen: SCHRITTE.map((s) => [`${s.nr} ${s.titel}`, s.werMachtWas.fiaon, s.werMachtWas.sie, s.entscheidet, s.werMachtWas.wennEsAusbleibt]),
        fuss: [weitererSatz("ROLLEN")],
      },
      {
        typ: "tabelle", id: "dauer", h2: "Wie lange es dauert",
        lead: satz("S15"),
        kopf: ["Schritt", "Erfahrungswert", "Wer entscheidet"],
        zeilen: SCHRITTE.map((s) => [`${s.nr} ${s.titel}`, ERFAHRUNG[s.nr] ?? "", s.entscheidet]),
        hervor: 1,
        fuss: [`Eintragungszeiten: Stand ${STAATEN_STAND_TEXT.de}; die Werte je Bundesstaat stehen auf der Seite „${KOSTEN_SEITE}“.`],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [...GLOBAL_PFLICHTHINWEIS.de, satz("S7")],
      },
      { typ: "pakete", id: "mandat", h2: KARTE.h2, lead: KARTE.lead },
    ],
    fragen: [
      { f: "Wie lange dauert die Gründung meiner US-Gesellschaft?", a: `${satz("S15")} Die Erfahrungswerte je Schritt stehen oben in der Tabelle „Wie lange es dauert“ — mit der Angabe, wer jeweils entscheidet.` },
      { f: "Wann beginnt die Arbeit?", a: "Nach Eingang Ihrer Zahlung und Ihres Reisepasses. Den Stand sehen Sie danach jederzeit in Ihrem Portal." },
      { f: "Wo sehe ich den Stand meines Mandats?", a: "In Ihrem Portal: aktueller Schritt, nächste Handlung, Unterlagen und Pflichtenkalender. Den Zugang erhalten Sie mit Vertrag und Rechnung." },
      { f: "Was muss ich selbst tun?", a: `Sie wählen den Namen, laden Ihren Reisepass hoch und unterzeichnen die Unterlagen, die wir vorlegen. ${satz("S2")}` },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/us-firmengruendung", "/business/privatpersonen"],
  },

  // E-509 (12.11.2026): Die Seite /business/paket-finder (bis E-509: vier Fragen → eines von vier Paketen) gibt es nicht mehr.
  // Der Honorarrechner /business/start ist der neue Finder; die alte Adresse leitet dauerhaft (301) dorthin
  // (GLOBAL_UMGEZOGEN in shared/fiaon-global-pfade.ts, gelesen von server/routes.ts).

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/vergleich",
    art: "preise",
    seo: {
      titel: "US-Firma selbst gründen oder gründen lassen? — FIAON Global",
      beschreibung: "Selbst gründen, einen Gründungsdienst beauftragen oder FIAON Global: was jeweils enthalten ist, wer koordiniert und wer für Steuern und Meldungen sorgt.",
    },
    stand: S,
    kennung: "FG · 10",
    auge: "Honorar und Ablauf · Vergleich",
    h1: "US-LLC selbst gründen oder gründen lassen.",
    h1b: "Drei Wege im Vergleich.",
    lead: "Eine US-Gesellschaft lässt sich selbst gründen, über einen Gründungsdienst oder mit FIAON Global. Der Unterschied liegt nicht in der Gründung selbst, sondern in allem danach: Steuern, Meldungen, Konten, Karten — und wer das koordiniert.",
    ziffern: [
      { wert: "3 Wege", label: "selbst, Gründungsdienst, FIAON Global" },
      { wert: "8 Anlaufstellen", label: "wer selbst gründet, spricht mit allen einzeln" },
      { wert: "1 Mandat", label: "bei FIAON Global: ein Vertrag für alle Schritte" },
    ],
    blick: [
      ["Selbst", "Nur Staatsgebühren; Koordination und Risiko bei Ihnen"],
      ["Dienst", "Gründung übernommen; Steuern, Konten, Karten bei Ihnen"],
      ["FIAON Global", "Gründung, Unterlagen, Anträge in einem Mandat"],
      ["Entscheidend", "Wer koordiniert Anwalt, Steuerberater, US-Steuerberater (CPA) und die Anträge bei den Instituten?"],
      ["Zur Einordnung", "Wer nur die Gründung braucht, zahlt bei einem Gründungsdienst weniger"],
      ["Honorar", HONORAR_ZEILE],
    ],
    kurz: "Wer eine US-Gesellschaft selbst gründet, zahlt nur die Gebühren. Er spricht mit acht Stellen einzeln: Bundesstaat, Registered Agent, US-Steuerbehörde, Anwalt, Steuerberater, US-Steuerberater (CPA), Banken und Herausgeber. Ein Gründungsdienst übernimmt die Gründung, lässt Steuern, Konten und Karten aber meist bei Ihnen. FIAON Global führt Gründung, Unterlagen und die Vorbereitung Ihrer Anträge in einem Mandat zusammen; die Honorare der Partner für die Leistungen Ihres Vertrags trägt FIAON. Die Anträge stellen Sie selbst; es entscheidet das jeweilige Institut.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Wege im Vergleich",
        kopf: ["", "Selbst gründen", "Gründungsdienst", "FIAON Global"],
        zeilen: [
          ["Gründung beim Bundesstaat", "Sie selbst", "enthalten", "enthalten"],
          ["Registered Agent und Adresse", "selbst beauftragen", "meist enthalten, oft mit jährlicher Verlängerung", "erstes Jahr enthalten"],
          ["EIN", "selbst beantragen", "oft enthalten", "Antrag enthalten"],
          ["ITIN", "selbst, mit Acceptance Agent", "selten enthalten", "Antrag nach unserem ITIN-Check enthalten"],
          ["Steuerliche Fragen vorab", "selbst beauftragen", "nicht enthalten", "liegen bei Partner-Steuerberatern"],
          ["Operating Agreement", "Vorlage oder Anwalt beauftragen", "meist Vorlage", "enthalten"],
          ["Erste US-Meldung (Form 5472)", "selbst oder US-Steuerberater (CPA) beauftragen", "oft gegen Aufpreis", "enthalten"],
          ["Konto- und Kartenanträge", "selbst", "selten", "vollständig vorbereitet"],
          ["Ein fester Ansprechpartner", "nein", "nein", "ja"],
        ],
        hervor: 3,
        fuss: [
          "„Gründungsdienst“ beschreibt das übliche Angebot am Markt; einzelne Anbieter weichen davon ab.",
          satz("S2"),
        ],
      },
      {
        typ: "karten", id: "wann", h2: "Wann welcher Weg passt", spalten: 3,
        karten: [
          { tag: "Selbst", titel: "Wenn Sie Zeit und Erfahrung haben", text: "Wer die US-Formulare kennt, einen Steuerberater mit US-Erfahrung hat und nur eine Gesellschaft braucht, zahlt auf diesem Weg am wenigsten." },
          { tag: "Gründungsdienst", titel: "Wenn nur die Gründung zählt", text: "Wer nur die Gründung braucht und weder Konten noch Kreditkarten noch eine Finanzierung plant, zahlt bei einem Gründungsdienst weniger." },
          { tag: "FIAON Global", titel: "Wenn Unterlagen und Anträge zusammenpassen sollen", text: "Für Unternehmer mit einem Vorhaben, das eine eigene US-Gesellschaft trägt. In einem Mandat: Gründung, Unterlagen und vollständig vorbereitete Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung. Über jeden Antrag entscheidet das jeweilige Institut." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "Der eigentliche Unterschied",
        absaetze: [
          "Die Gründung beim Bundesstaat ist ein Formular. Was eine US-Gesellschaft teuer macht, sind die Dinge danach: eine vergessene Form 5472, ein Kontoantrag mit widersprüchlichen Unterlagen, ungeordnete Kartenanträge. Oder eine Steuerpflicht im Wohnsitzland, die vorab niemand geklärt hat.",
          weitererSatz("ROLLEN"),
        ],
        // Auf jeder Seite, auf der Finanzierung steht: der Satz, was gilt, wenn sie ausbleibt (S7, mit Fristbeginn, Ziffer 4 und Institut).
        nach: `Zur Finanzierung: ${satz("S7")}`,
      },
      { typ: "pakete", id: "mandat", h2: KARTE.h2, lead: KARTE.lead },
    ],
    fragen: [
      { f: "Ist FIAON Global teurer als ein Gründungsdienst?", a: `Ja, wenn Sie nur die Gründung brauchen. Unser Honorar: ${HONORAR_KURZ} Es umfasst im ersten Jahr auch die Unterlagen Ihrer Gesellschaft, Ihr US-Büro, die Anträge für EIN und ITIN und die erste US-Meldung.` },
      { f: "Kann ich selbst gründen und FIAON nur für Konto und Karten beauftragen?", a: `Haben Sie schon eine US-Gesellschaft, gründen wir nicht neu. ${weitererSatz("UNTERLAGEN-ZUERST")} Konto- und Kartenanträge setzen Unterlagen voraus, die von Anfang an zusammenpassen; über jeden Antrag entscheidet das jeweilige Institut.` },
      { f: "Nennt FIAON Namen von Wettbewerbern?", a: "Nein. Der Vergleich beschreibt das übliche Angebot am Markt, nicht einzelne Anbieter." },
    ],
    weiter: ["/business/kosten", "/business/ablauf", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"],
  },
];
