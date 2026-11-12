// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PREISE UND ABLAUF (19.09.2026, E-191)
// Ablauf und Dauer, Vergleich. Die Seite
// „Kosten“ steht in kosten.ts (Zahlen Dritter mit Quelle und Stand).
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Der Ablauf folgt dem Vertrag (Gründung, Steuernummern, US-Büro,
// Konto und Karten, Kapital). Die Seite /business/paket-finder gibt es nicht mehr: Der Konfigurator /business/start ist der
// neue Finder, die alte Adresse leitet dauerhaft dorthin (GLOBAL_UMGEZOGEN). Preise nur aus EIN_PRODUKT (ein-produkt.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

const S = "2026-11-12";
const P = EIN_PRODUKT.de;

export const PREISE_UND_ABLAUF: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "Ablauf einer US-Firmengründung — FIAON Global",
      beschreibung: "Vom Angebot bis zur Finanzierung: acht Schritte, klare Zuständigkeiten. Dauern als Erfahrungswerte — Behörden und Institute bestimmen ihr Tempo.",
    },
    stand: S,
    kennung: "FG · 08",
    auge: "Preise und Ablauf · Ablauf",
    h1: "Der Ablauf.",
    h1b: "Acht Schritte, eine Reihenfolge.",
    lead: "Vom Angebot bis zur Finanzierung: Sie wissen zu jeder Zeit, wer gerade am Zug ist, was als Nächstes kommt und wie lange es erfahrungsgemäß dauert. Den Stand sehen Sie jederzeit in „Mein Auftrag“.",
    ziffern: [
      { wert: "8 Schritte", label: "vom Angebot bis zur Finanzierung" },
      { wert: "1 Auftrag", label: "Gründung, US-Büro, Konto, Karten und Kapital" },
      { wert: "1 Ansprechpartner", label: "vom ersten Tag an" },
    ],
    blick: [
      ["Start", "Angebot selbst zusammenstellen oder erst sprechen"],
      ["Vertrag", "Online unterschrieben, Vertrag und Rechnung per E-Mail"],
      ["Arbeitsbeginn", "Mit Zahlungseingang und Reisepass"],
      ["Ihr Beitrag", "Ihr Reisepass, der Name Ihrer Gesellschaft, Ihre Unterschriften"],
      ["Stand", "Jederzeit in „Mein Auftrag“, mit Etappe und nächstem Schritt"],
      ["Dauer", "Erfahrungswerte — Behörden und Institute bestimmen ihr Tempo"],
    ],
    kurz: "Ein Auftrag bei FIAON Global beginnt im Konfigurator oder mit einem Gespräch. Sie unterschreiben online; sobald Ihre Zahlung und Ihr Reisepass da sind, melden wir Ihre Gesellschaft an und beantragen EIN und ITIN. Danach folgen Ihr US-Büro, Konto und Karten und die Begleitung bis zur Finanzierung. Die Gesellschaft steht in der Regel nach wenigen Wochen; über Steuernummern, Konto, Karten und Finanzierung entscheiden Behörden und Institute in eigener Frist.",
    bloecke: [
      {
        typ: "etappen", id: "schritte", h2: "Die acht Schritte",
        etappen: [
          { titel: "Angebot zusammenstellen", text: "Im Konfigurator wählen Sie Ihre Schwerpunkte und Ihren Kapitalrahmen und sehen Ihren Preis. Oder Sie sprechen zuerst dreißig Minuten mit Ihrem Ansprechpartner." },
          { titel: "Vertrag und Rechnung", text: "Auf Ihrer Angebotsseite wählen Sie Laufzeit und Namen Ihrer Gesellschaft und unterschreiben online. Vertrag und Rechnung erhalten Sie sofort per E-Mail, dazu den Zugang zu „Mein Auftrag“. Vertragspartner ist die FIAON LTD in London." },
          { titel: "Zahlung und Reisepass", text: "Mit dem Eingang Ihrer Zahlung und Ihres Reisepasses beginnt die Arbeit. Den Reisepass laden Sie direkt nach der Unterschrift hoch." },
          { titel: "Gründung", text: "Wir prüfen den Namen im Register, melden Ihre Gesellschaft beim Bundesstaat an und stellen Operating Agreement und Gründungsunterlagen bereit. Über die Eintragung entscheidet der Bundesstaat." },
          { titel: "Steuernummern", text: "Wir beantragen die EIN Ihrer Gesellschaft und — sobald unser ITIN-Check die Voraussetzungen bestätigt — Ihre ITIN. Über beide Nummern entscheidet die US-Steuerbehörde in eigener Frist." },
          { titel: "Ihr US-Büro", text: "Registered Agent, US-Geschäftsadresse, US-Telefonnummer und Assistenz für Post, Anrufe und Termine — im ersten Jahr enthalten." },
          { titel: "Konto und Karten", text: "Wir bereiten die Anträge für Ihr privates US-Konto, private US-Karten, das Geschäftskonto und die Firmenkreditkarte vollständig vor. Sie stellen die Anträge selbst; über Konto, Karten und Rahmen entscheidet das jeweilige Institut." },
          { titel: "Kapital", text: "Wir bereiten jeden Antrag für die Finanzierung in Ihrem Kapitalrahmen vor und begleiten bis zur Auszahlung. Unsere US-Partnergesellschaft übernimmt die Bürgschaft; über die Finanzierung entscheidet das finanzierende Institut." },
        ],
      },
      {
        typ: "tabelle", id: "dauer", h2: "Wie lange es dauert",
        lead: "Erfahrungswerte, keine Fristen. Wie schnell es geht, bestimmen Behörden, Institute und die Vollständigkeit der Unterlagen.",
        kopf: ["Schritt", "Erfahrungswert", "Wer entscheidet"],
        zeilen: [
          ["Eintragung der Gesellschaft", "je nach Bundesstaat wenige Tage bis rund zwei Wochen", "der Bundesstaat"],
          ["EIN und ITIN", "in eigener Frist der US-Steuerbehörde", "die US-Steuerbehörde"],
          ["Konto und Karten", "nach der Prüfung des jeweiligen Instituts", "das Institut"],
          ["Finanzierung", "Ziel und Bedingungen stehen in Ihrem Vertrag", "das finanzierende Institut"],
        ],
        hervor: 1,
      },
      {
        typ: "rollen", id: "wer", h2: "Wer wann am Zug ist",
        fiaon: ["Angebot, Vertrag und Koordination", "Einreichungen beim Bundesstaat und bei der US-Steuerbehörde", "Konto- und Kartenanträge vollständig vorbereitet", "Pflichtenkalender und „Mein Auftrag“"],
        partner: ["Partner-Anwalt: Operating Agreement und Gründungsunterlagen", "US-Steuerberater (CPA): erste jährliche US-Meldung", "Partner-Steuerberater: klärt vorab, wie Überweisungen zu behandeln sind", "US-Partnergesellschaft: Bürgschaft für die Finanzierung"],
        sie: ["Reisepass hochladen", "Entscheidungen treffen und unterschreiben", "Anträge bei Herausgebern und Banken stellen", "Pünktlich abrechnen — das baut Ihre Historie"],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [...GLOBAL_PFLICHTHINWEIS.de, P.geldZurueck],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "Wie lange dauert es, bis meine US-Gesellschaft steht?", a: "In der Regel wenige Wochen, sobald Zahlung und Reisepass da sind. EIN und ITIN vergibt die US-Steuerbehörde in eigener Frist." },
      { f: "Wann beginnt die Arbeit?", a: "Mit dem Eingang Ihrer Zahlung und Ihres Reisepasses. Den Stand sehen Sie danach jederzeit in „Mein Auftrag“." },
      { f: "Wo sehe ich, wie weit mein Auftrag ist?", a: "In „Mein Auftrag“: Etappe, nächster Schritt, Dokumente und Pflichtenkalender — den Zugang erhalten Sie mit Vertrag und Rechnung." },
      { f: "Was muss ich selbst tun?", a: "Ihren Reisepass hochladen, Entscheidungen treffen und unterschreiben. Anträge bei Herausgebern und Banken stellen Sie selbst — vollständig vorbereitet von uns." },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/us-firmengruendung", "/business/privatpersonen"],
  },

  // E-509 (12.11.2026): Die Seite /business/paket-finder (bis E-509: vier Fragen → eines von vier Paketen) gibt es nicht mehr.
  // Der Konfigurator /business/start ist der neue Finder; die alte Adresse leitet dauerhaft (301) dorthin
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
    auge: "Preise und Ablauf · Vergleich",
    h1: "Selbst, Dienst oder FIAON Global?",
    h1b: "Drei Wege zur US-Gesellschaft.",
    lead: "Eine US-Gesellschaft lässt sich selbst gründen, über einen Gründungsdienst oder mit FIAON Global. Der Unterschied liegt nicht in der Gründung selbst, sondern in allem danach: Steuern, Meldungen, Konto, Karten — und wer das koordiniert.",
    ziffern: [
      { wert: "3 Wege", label: "selbst, Gründungsdienst, FIAON Global" },
      { wert: "8 Anlaufstellen", label: "wer selbst gründet, spricht mit allen einzeln" },
      { wert: "1 Vertrag", label: "bei FIAON Global für alles" },
    ],
    blick: [
      ["Selbst", "Günstig beim Staat, aber jede Stelle einzeln — und jedes Risiko bei Ihnen"],
      ["Gründungsdienst", "Die Gesellschaft ist schnell gegründet; Steuern, Konto und Karten bleiben Ihre Sache"],
      ["FIAON Global", "Ein Ansprechpartner, ein Vertrag, ein Preis — Partner-Honorare inklusive"],
      ["Entscheidend", "Wer koordiniert Steuerberater, US-CPA, Anwalt und Institute?"],
      ["Ehrlich", "Wer nur eine Gesellschaft braucht, zahlt bei einem Dienst weniger"],
      ["Preis", `${P.preis} mit Ihrem Auftrag bei FIAON Global`],
    ],
    kurz: "Wer eine US-Gesellschaft selbst gründet, zahlt nur die Gebühren, spricht aber mit Bundesstaat, Registered Agent, IRS, Anwalt, Steuerberater, US-CPA, Banken und Herausgebern einzeln. Ein Gründungsdienst übernimmt die Gründung, lässt Steuern, Konto und Karten aber meist beim Kunden. FIAON Global koordiniert alles aus einer Hand — mit einem Vertrag und den Honoraren der Partner im Preis.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Wege im Vergleich",
        kopf: ["", "Selbst gründen", "Gründungsdienst", "FIAON Global"],
        zeilen: [
          ["Gründung beim Bundesstaat", "Sie selbst", "enthalten", "enthalten"],
          ["Registered Agent und Adresse", "selbst buchen", "meist enthalten, oft im Abo", "erstes Jahr enthalten"],
          ["EIN", "selbst beantragen", "oft enthalten", "enthalten"],
          ["ITIN", "selbst, mit Acceptance Agent", "selten enthalten", "enthalten"],
          ["Steuerfragen vorab geklärt", "selbst beauftragen", "nicht enthalten", "durch Partner-Steuerberater"],
          ["Operating Agreement durch Anwalt", "Vorlage oder selbst beauftragen", "meist Vorlage", "durch Partner-Anwalt"],
          ["Erste US-Meldung (Form 5472)", "selbst oder US-CPA beauftragen", "oft gegen Aufpreis", "durch US-CPA enthalten"],
          ["Konto- und Kartenanträge", "selbst", "selten", "vollständig vorbereitet"],
          ["Ein Ansprechpartner für alles", "nein", "nein", "ja"],
        ],
        hervor: 3,
        fuss: ["„Gründungsdienst“ beschreibt das übliche Angebot am Markt; einzelne Anbieter weichen davon ab."],
      },
      {
        typ: "karten", id: "wann", h2: "Wann welcher Weg passt", spalten: 3,
        karten: [
          { tag: "Selbst", titel: "Wenn Sie Zeit haben — und Erfahrung", text: "Wer die US-Formulare kennt, einen Steuerberater mit US-Erfahrung hat und nur eine Gesellschaft braucht, kommt selbst am günstigsten ans Ziel." },
          { tag: "Gründungsdienst", titel: "Wenn nur die Gesellschaft zählt", text: "Wer kein Konto, keine Karten und keinen Kapitalaufbau plant, ist mit einem reinen Gründungsdienst gut bedient." },
          { tag: "FIAON Global", titel: "Wenn alles zusammenpassen muss", text: "Wer Gesellschaft, Steuernummern, Konto, Karten und Kapital in einer Hand haben will — mit den Honoraren der Partner im Preis." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "Der eigentliche Unterschied",
        absaetze: [
          "Die Gründung beim Bundesstaat ist ein Formular. Was eine US-Gesellschaft teuer macht, sind die Dinge danach: eine vergessene Form 5472, ein Konto, das an widersprüchlichen Unterlagen scheitert, Kartenanträge ohne Plan, eine Steuerpflicht im Heimatland, die niemand vorher geprüft hat.",
          P.partner,
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "Ist FIAON Global teurer als ein Gründungsdienst?", a: `Ja, wenn Sie nur die Gesellschaft brauchen. Der Preis von ${P.preis} enthält dafür das Operating Agreement durch den Anwalt, EIN, ITIN, Adresse, Telefonnummer und Assistenz im ersten Jahr, die erste US-Meldung und die Vorbereitung von Konto und Karten.` },
      { f: "Kann ich die Gesellschaft selbst gründen und FIAON nur für Konto und Karten beauftragen?", a: "Haben Sie schon eine US-Gesellschaft, übernehmen wir sie, statt neu zu gründen: Wir prüfen zuerst ihre Unterlagen und nennen Ihnen dann Ihr Angebot. Konto- und Kartenanträge gelingen nur mit Unterlagen, die von Anfang an zusammenpassen." },
      { f: "Nennt FIAON Namen von Wettbewerbern?", a: "Nein. Der Vergleich beschreibt das übliche Angebot am Markt, nicht einzelne Anbieter." },
    ],
    weiter: ["/business/kosten", "/business/ablauf", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"],
  },
];
