// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PREISE UND ABLAUF (19.09.2026, E-191)
// Ablauf und Dauer, Paket-Finder, Vergleich, Fragen & Antworten. Die Seite
// „Kosten“ steht in kosten.ts (Zahlen Dritter mit Quelle und Stand).
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN,
  globalPaket, globalPreisText, globalPlanungText, globalKapitalSpanne,
} from "../fiaon-global";
import { GLOBAL_ETAPPEN } from "../fiaon-global-bereich";
import type { GlobalSeite } from "./typen";

const S = "2026-09-19";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const PREISE_UND_ABLAUF: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "Ablauf einer US-Firmengründung — FIAON Global",
      beschreibung: "Vom ersten Gespräch bis zur Kartenleiter: acht Schritte, vier Etappen, klare Zuständigkeiten. Dauern als Erfahrungswerte — Behörden bestimmen ihr Tempo.",
    },
    stand: S,
    kennung: "FG · 08",
    auge: "Preise und Ablauf · Ablauf",
    h1: "Der Ablauf.",
    h1b: "Acht Schritte, eine Reihenfolge.",
    lead: "Vom ersten Gespräch bis zur Kartenleiter: Sie wissen zu jeder Zeit, wer gerade am Zug ist, was als Nächstes kommt und wie lange es erfahrungsgemäß dauert. Den Stand sehen Sie jederzeit in „Mein Auftrag“.",
    ziffern: [
      { wert: "8 Schritte", label: "vom Gespräch bis zur Bank" },
      { wert: "4 Etappen", label: "Gründung, erste Karte, Kartenleiter, Bankdarlehen" },
      { wert: "1 Ansprechpartner", label: "vom ersten Tag an" },
    ],
    blick: [
      ["Start", "Gespräch vereinbaren oder direkt beauftragen"],
      ["Vertrag", "Am Bildschirm unterschrieben, Vertrag und Rechnung per E-Mail"],
      ["Arbeitsbeginn", "Mit dem Zahlungseingang"],
      ["Ihr Beitrag", "Fünf Unterlagen, Entscheidungen, Unterschriften"],
      ["Stand", "Jederzeit in „Mein Auftrag“, mit Etappe und nächstem Schritt"],
      ["Dauer", "Erfahrungswerte je Paket — Behörden und Institute bestimmen ihr Tempo"],
    ],
    kurz: "Ein Auftrag bei FIAON Global beginnt mit einem Gespräch oder dem Direktauftrag am Bildschirm. Nach dem Zahlungseingang folgen Startgespräch und Unterlagen, die Prüfung durch den Partner-Steuerberater, die Gründung mit EIN und ITIN, dann Konto und Karten. Die Gesellschaft steht in der Regel nach wenigen Wochen; die Begleitung dauert je nach Paket rund acht Wochen bis sechs Monate und länger.",
    bloecke: [
      {
        typ: "etappen", id: "schritte", h2: "Die acht Schritte",
        etappen: [
          { titel: "Gespräch oder Direktauftrag", text: "Dreißig Minuten mit Ihrem Ansprechpartner — oder direkt beauftragen: Paket wählen, Unternehmen eintragen, Vertrag am Bildschirm unterschreiben." },
          { titel: "Vertrag und Rechnung", text: "Beides erhalten Sie sofort per E-Mail, dazu den Zugang zu „Mein Auftrag“. Vertragspartner ist die FIAON LTD in London." },
          { titel: "Zahlungseingang", text: "Mit dem Eingang Ihrer Zahlung beginnt die Arbeit. Ihr Ansprechpartner meldet sich für das Startgespräch." },
          { titel: "Startgespräch und Unterlagen", text: "Rechtsform, Bundesstaat und Name werden festgelegt; Sie laden fünf Unterlagen in Ihren Dokumentenraum." },
          { titel: "Prüfung durch den Steuerberater", text: "Unser Partner-Steuerberater prüft vor der Gründung, wie Ihre Gesellschaft im Heimatland behandelt wird und welche Meldungen dort anfallen." },
          { titel: "Gründung", text: GLOBAL_ETAPPEN[1].de.text.replace(" auf dieser Seite", " in „Mein Auftrag“") },
          { titel: "Karten", text: GLOBAL_ETAPPEN[2].de.text },
          { titel: "Bank", text: GLOBAL_ETAPPEN[4].de.text },
        ],
      },
      {
        typ: "tabelle", id: "dauer", h2: "Wie lange begleitet wird",
        lead: "Erfahrungswerte, keine Fristen. Wie schnell es geht, bestimmen Behörden, Institute und die Vollständigkeit der Unterlagen.",
        kopf: ["Paket", "Begleitung", "Kapitalrahmen", "Festpreis"],
        zeilen: GLOBAL_PAKETE.map((p) => [p.de.name, gross(p.de.dauerKurz), globalPlanungText(p.key), globalPreisText(p.key)]),
        hervor: 1,
      },
      {
        typ: "rollen", id: "wer", h2: "Wer wann am Zug ist",
        fiaon: ["Startgespräch, Plan und Koordination", "Einreichungen beim Bundesstaat und bei der IRS", "Konto- und Kartenanträge vorbereitet", "Pflichtenkalender und Dokumentenraum"],
        partner: ["Partner-Steuerberater: Prüfung vor der Gründung", "Partner-Anwalt: Operating Agreement", "US-CPA: erste jährliche US-Meldung", "Schwarzott Global LLC: Termine vor Ort in Miami"],
        sie: ["Unterlagen hochladen", "Entscheidungen treffen und unterschreiben", "Anträge bei Herausgebern und Banken stellen", "Pünktlich abrechnen — das baut Ihre Historie"],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [...GLOBAL_PFLICHTHINWEIS.de, `${GLOBAL_GELD_ZURUECK.de.titel}: ${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`],
      },
      { typ: "pakete", id: "pakete", h2: "Die vier Pakete", lead: "Jedes Paket ist ein Betreuungsauftrag zum Festpreis — alle Gebühren und die Honorare unserer Partner inklusive." },
    ],
    fragen: [
      { f: "Wie lange dauert es, bis meine US-Gesellschaft steht?", a: "In der Regel wenige Wochen nach vollständigen Unterlagen. EIN und ITIN vergibt die US-Steuerbehörde in eigener Frist." },
      { f: "Wann beginnt die Arbeit?", a: "Mit dem Eingang Ihrer Zahlung. Danach meldet sich Ihr Ansprechpartner für das Startgespräch." },
      { f: "Wo sehe ich, wie weit mein Auftrag ist?", a: "In „Mein Auftrag“: Etappe, nächster Schritt, Dokumente und Pflichtenkalender — den Zugang erhalten Sie mit Vertrag und Rechnung." },
      { f: "Was muss ich selbst tun?", a: "Fünf Unterlagen hochladen, Entscheidungen treffen und unterschreiben. Anträge bei Herausgebern und Banken stellen Sie selbst — vollständig vorbereitet von uns." },
    ],
    weiter: ["/business/kosten", "/business/paket-finder", "/business/us-firmengruendung", "/business/privatpersonen"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/paket-finder",
    art: "werkzeug",
    seo: {
      titel: "Paket-Finder: Welches Paket passt? — FIAON Global",
      beschreibung: "Vier Fragen zu Ziel, Kapitalrahmen, Zeit und Begleitung — der Paket-Finder zeigt, welches Paket von FIAON Global zu Ihnen passt. Ohne Anmeldung.",
    },
    stand: S,
    kennung: "FG · 09",
    auge: "Preise und Ablauf · Paket-Finder",
    h1: "Welches Paket passt?",
    h1b: "Vier Fragen, eine klare Antwort.",
    lead: "Beantworten Sie vier Fragen zu Ihrem Vorhaben. Der Paket-Finder zeigt, welches Paket am ehesten passt — und warum. Ohne Anmeldung, ohne Speicherung Ihrer Antworten.",
    ziffern: [
      { wert: "4 Fragen", label: "Ziel, Kapitalrahmen, Zeit, Begleitung" },
      { wert: "1 Minute", label: "ohne Anmeldung" },
      { wert: globalKapitalSpanne(), label: "Kapitalrahmen je Paket, als Ziel" },
    ],
    blick: [
      // 19.09.2026: nicht mehr „Ihr Ziel in den USA" — das Kapital ist nicht an die USA gebunden (GLOBAL_KAPITAL_FREI).
      ["Frage 1", "Was ist Ihr Ziel mit der US-Gesellschaft?"],
      ["Frage 2", "Welchen Kapitalrahmen streben Sie an?"],
      ["Frage 3", "Wie viel Zeit geben Sie dem Aufbau?"],
      ["Frage 4", "Wie möchten Sie begleitet werden?"],
      ["Ergebnis", "Das passende Paket mit Begründung — beauftragen oder erst sprechen"],
      ["Daten", "Ihre Antworten bleiben in Ihrem Browser"],
    ],
    kurz: "Der Paket-Finder ordnet Ihr Vorhaben einem der vier Pakete zu: Global Struktur für Gründung und erste Karte, Global Banking für die Kartenleiter, Global Kapital bis zum Bankdarlehen, Global VIP mit Auftakt vor Ort in Miami. Das Ergebnis ist eine Orientierung; im Gespräch prüft Ihr Ansprechpartner, ob es zu Ihrem Fall passt.",
    bloecke: [
      { typ: "finder", id: "finder", h2: "Vier Fragen", lead: "Wählen Sie jeweils die Antwort, die Ihrem Vorhaben am nächsten kommt." },
      { typ: "pakete", id: "pakete", h2: "Alle vier Pakete", lead: "Festpreis, einmalig — alle Gebühren und die Honorare unserer Partner inklusive." },
    ],
    fragen: [
      { f: "Ist das Ergebnis verbindlich?", a: "Nein. Der Paket-Finder ist eine Orientierung. Ob das Paket zu Ihrem Fall passt, prüft Ihr Ansprechpartner im Gespräch — oder Sie beauftragen direkt." },
      { f: "Werden meine Antworten gespeichert?", a: "Nein. Die Antworten bleiben in Ihrem Browser und werden nicht an FIAON übertragen." },
      { f: "Kann ich später in ein größeres Paket wechseln?", a: "Sprechen Sie Ihren Ansprechpartner an. Ein Wechsel in ein anderes Paket wird gesondert vereinbart — mit einem neuen Vertrag, der sagt, was bereits erledigt ist." },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/firmenkarten-kapital", "/business/ablauf"],
  },

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
      ["FIAON Global", "Ein Ansprechpartner, ein Vertrag, ein Festpreis — Partner-Honorare inklusive"],
      ["Entscheidend", "Wer koordiniert Steuerberater, US-CPA, Anwalt und Institute?"],
      ["Ehrlich", "Wer nur eine Gesellschaft braucht, zahlt bei einem Dienst weniger"],
      ["Festpreis", `ab ${globalPreisText("global_struktur")} bei FIAON Global`],
    ],
    kurz: "Wer eine US-Gesellschaft selbst gründet, zahlt nur die Gebühren, spricht aber mit Bundesstaat, Registered Agent, IRS, Anwalt, Steuerberater, US-CPA, Banken und Herausgebern einzeln. Ein Gründungsdienst übernimmt die Gründung, lässt Steuern, Konto und Karten aber meist beim Kunden. FIAON Global koordiniert alles aus einer Hand, zum Festpreis mit Partner-Honoraren.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Wege im Vergleich",
        kopf: ["", "Selbst gründen", "Gründungsdienst", "FIAON Global"],
        zeilen: [
          ["Gründung beim Bundesstaat", "Sie selbst", "enthalten", "enthalten"],
          ["Registered Agent und Adresse", "selbst buchen", "meist enthalten, oft im Abo", "erstes Jahr enthalten"],
          ["EIN", "selbst beantragen", "oft enthalten", "enthalten"],
          ["ITIN", "selbst, mit Acceptance Agent", "selten enthalten", "enthalten"],
          ["Prüfung durch Steuerberater vor der Gründung", "selbst beauftragen", "nicht enthalten", "enthalten"],
          ["Operating Agreement durch Anwalt", "Vorlage oder selbst beauftragen", "meist Vorlage", "durch Partner-Anwalt"],
          ["Erste US-Meldung (Form 5472)", "selbst oder US-CPA beauftragen", "oft gegen Aufpreis", "durch US-CPA enthalten"],
          ["Konto- und Kartenanträge", "selbst", "selten", "vorbereitet, ab Global Banking jeder weitere"],
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
          { tag: "FIAON Global", titel: "Wenn alles zusammenpassen muss", text: "Wer Gesellschaft, Steuernummern, Konto, Karten und Kapital in einer Hand haben will — mit Partner-Honoraren im Festpreis." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "Der eigentliche Unterschied",
        absaetze: [
          "Die Gründung beim Bundesstaat ist ein Formular. Was eine US-Gesellschaft teuer macht, sind die Dinge danach: eine vergessene Form 5472, ein Konto, das an widersprüchlichen Unterlagen scheitert, eine Kartenleiter ohne Plan, eine Steuerpflicht im Heimatland, die niemand vorher geprüft hat.",
          GLOBAL_ROLLEN.de.partner,
        ],
      },
      { typ: "pakete", id: "pakete", h2: "Die vier Pakete", lead: "Festpreis, einmalig — alles inklusive, was für Ihr Paket gebraucht wird." },
    ],
    fragen: [
      { f: "Ist FIAON Global teurer als ein Gründungsdienst?", a: `Ja, wenn Sie nur die Gesellschaft brauchen. Der Festpreis ab ${globalPreisText("global_struktur")} enthält dafür die Prüfung durch den Steuerberater, das Operating Agreement durch den Anwalt, EIN, ITIN, die erste US-Meldung und die Vorbereitung von Konto und Karte.` },
      { f: "Kann ich die Gesellschaft selbst gründen und FIAON nur für Konto und Karten beauftragen?", a: "Nein. Die Pakete beginnen mit der Gründung, weil Konto- und Kartenanträge nur mit Unterlagen gelingen, die von Anfang an zusammenpassen." },
      { f: "Nennt FIAON Namen von Wettbewerbern?", a: "Nein. Der Vergleich beschreibt das übliche Angebot am Markt, nicht einzelne Anbieter." },
    ],
    weiter: ["/business/kosten", "/business/paket-finder", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"],
  },
];
