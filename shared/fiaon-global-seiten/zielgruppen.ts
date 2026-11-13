// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR WEN (19.09.2026, E-191 · neu gefasst 13.11.2026, E-510)
// Vier Unternehmensformen (Mittelstand, Onlinehandel, Agenturen und Software,
// Bau und Immobilien) und zwei Herkunftsländer (Deutschland, Schweiz).
// Österreich hat seit 27.10.2026 eine eigene Seite (E-439, /business/aus-oesterreich in e439/): Justin hat die
// gewerberechtliche Frage aus E-187 entschieden; die Seite nennt sich selbst nicht „Unternehmensberatung“ und lässt
// österreichisches Steuerrecht nur durch in Österreich befugte Partner-Steuerberater prüfen (§ 124 WTBG).
//
// E-510 (13.11.2026): Jede Seite folgt dem Sprachleitfaden FIAON Global — erst die Tatsache, dann die Bedingung,
// dann wer entscheidet. Was das heißt:
//   · Feste Sätze, die sechs Schritte und jeder Betrag kommen aus shared/fiaon-global-saetze.ts — hier wird keiner getippt.
//   · „Auf einen Blick“ trägt die vier Antworten der 30-Sekunden-Probe: Wir übernehmen · Honorar · Sie selbst ·
//     Wer entscheidet (dazu, wo Finanzierung genannt ist: was gilt, wenn sie ausbleibt).
//   · Die Schweiz-Seite nennt Konto und Karte weder in Titel, Beschreibung, H1 noch im Blickfang; im Fließtext steht
//     nur der eine Satz dazu (satz("S2", "de", "CH")). Die Schritte dort: Gründung und Unterlagen, Finanzierung,
//     Umschuldung und Aufstockung.
//   · Keine Seite nennt einen Ort der Partnergesellschaft, ein „Team vor Ort“ oder eine Leistung, die der Vertrag des
//     einen Produkts nicht trägt (Prüfung vor der Gründung „im Preis“, Kennzahlen-Mappe, Startgespräch).
//
// Jede Seite sagt, wann eine US-Gesellschaft passt — und wann nicht.
// Kein Steuerversprechen, keine Zahl ohne Quelle, kein Bankname. Wo Kapital Thema ist (Bau und Immobilien), steht
// dazu, dass es nicht an die USA gebunden ist (GLOBAL_KAPITAL_FREI, Justin).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_AGENT, GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import type { GlobalSeite } from "./typen";
import {
  GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, satz, vierSchritte, weitererSatz, type SatzLand,
} from "../fiaon-global-saetze";

const S = "2026-11-13";
const B = SAETZE_BETRAEGE.de;

// ── „Auf einen Blick“: die Zeilen, die auf mehreren Seiten gleich lauten ──────────────────────────────────────────
/** Honorar in drei Zeilen — immer zusammen: mit Ihrem Auftrag · mit der Eintragung · ab dem zweiten Jahr (Leitfaden 1.3, 5.6). */
const Z_HONORAR: [string, string] = ["Honorar", `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`];
const Z_UEBERNEHMEN: [string, string] = ["Wir übernehmen", "Gründung, Unterlagen, Anträge für EIN und ITIN; vorbereitete Anträge für Konten, auf Wunsch Kreditkarten und Finanzierung"];
const Z_SELBST: [string, string] = ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen; die Anträge bei den Instituten selbst stellen"];
const Z_ENTSCHEIDET: [string, string] = ["Wer entscheidet", "Bundesstaat und US-Steuerbehörde; über Konto, Karte und Finanzierung das jeweilige Institut"];
/** Was gilt, wenn die Finanzierung ausbleibt — die Zeile aus der Tabelle „Wer macht was“ (Leitfaden 2.4), direkt unter „Wer entscheidet“. */
const Z_AUSBLEIBT: [string, string] = [GELD_ZURUECK.de.auge, SECHS_SCHRITTE.de.find((x) => x.nr === 5)!.werMachtWas.wennEsAusbleibt];
/** Schweiz: der Blickfang ohne Konto, Karte und Finanzierung (Leitfaden 1.3, Fassung B). */
const Z_UEBERNEHMEN_CH: [string, string] = ["Wir übernehmen", "Gründung, Unterlagen, Anträge für EIN und ITIN; im ersten Jahr Fristen und Meldungen"];
const Z_SELBST_CH: [string, string] = ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen"];
const Z_ENTSCHEIDET_CH: [string, string] = ["Wer entscheidet", "Über die Eintragung der Bundesstaat, über EIN und ITIN die US-Steuerbehörde"];

// ── Der Baustein „Ein Mandat“ — Kopf über der Karte ───────────────────────────────────────────────────────────────
const KARTE_H2 = "Ein Mandat";
const KARTE_LEAD = `Ein Mandat, ein Vertrag, ein Ansprechpartner. ${beleg("honorarVorab", "de")}`;

/** Die Bedingung von Schritt 6 in einem Satz („Voraussetzung ist die laufende Jahresbetreuung.“) — aus den sechs Schritten gelesen, nicht getippt. */
const JAHRESBETREUUNG_BEDINGUNG = ((b: string) => b.slice(0, b.indexOf(". ") + 1))(SECHS_SCHRITTE.de.find((x) => x.nr === 6)!.bedingung);

/**
 * Die Schritte in Kurzfassung (Leitfaden 2.5), nach Land gekürzt (5.12): vier schmale Plätze, deshalb die kurzen Texte.
 * Umschuldung und Aufstockung tragen zusätzlich ihre Bedingung (2.7: „Die Bedingung gehört immer dazu“). Für die Schweiz
 * ohne „Konten — Karten“. Was gilt, wenn die Finanzierung ausbleibt, steht in „Auf einen Blick“ — auf der Schweiz-Seite,
 * deren Blickfang keine Finanzierung nennt, als Randnotiz direkt neben den Schritten (S7).
 */
const kurzSchritte = (land: SatzLand): { titel: string; text: string }[] =>
  vierSchritte("de", land).schritte.map((x) => ({ titel: x.titel, text: x.nr === 4 ? `${x.text} ${JAHRESBETREUUNG_BEDINGUNG}` : x.text }));

/** Zuständigkeit für Steuerfragen — sagt, wer verantwortet, nicht, was ein Partner gerade tut (Leitfaden 5.11). */
const STEUERFRAGEN = "Steuerfragen klären Partner-Steuerberater in eigener Verantwortung";

export const ZIELGRUPPEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/tochtergesellschaft-usa",
    art: "zielgruppe",
    seo: {
      titel: "Tochtergesellschaft in den USA gründen — FIAON Global",
      beschreibung: "Tochtergesellschaft in den USA: wann sie passt, LLC oder Corporation, Meldepflichten zu Hause. Gründung und Steuernummern in einem Mandat.",
    },
    stand: S,
    kennung: "FG · 11",
    auge: "Für wen · Mittelstand",
    h1: "Tochtergesellschaft in den USA.",
    h1b: "Für echtes US-Geschäft.",
    lead: "Kunden in den USA, ein Lieferant in Texas, ein Projekt in Florida: Für echtes US-Geschäft gründen Unternehmen dort eine eigene Gesellschaft. Wir gründen Ihre US-Tochter, beantragen die Steuernummern und bereiten Ihre Kontoanträge vor; über das Konto entscheidet das jeweilige Institut.",
    ziffern: [
      { wert: "Haftung", label: "für das US-Geschäft getrennt vom Stammhaus" },
      { wert: "§ 138 AO", label: "Meldung der Beteiligung an das Finanzamt in Deutschland" },
      { wert: "Drei Staaten", label: "Delaware, Florida oder Wyoming — Sie wählen" },
    ],
    blick: [
      ["Inhaberin", "Ihre GmbH, AG oder Holding — oder Sie persönlich"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
    ],
    kurz: "Eine US-Tochtergesellschaft gründet Ihr Unternehmen, wenn es in den USA verkauft, einkauft, Verträge schließt oder Mitarbeiter einsetzt. Gesellschafterin ist meist die GmbH, AG oder Holding im Heimatland. FIAON Global gründet die Gesellschaft, beantragt die EIN und bereitet den Kontoantrag vor. Über Eintragung, Steuernummer und Konto entscheiden Bundesstaat, US-Steuerbehörde und das jeweilige Institut.",
    bloecke: [
      {
        typ: "text", id: "wann", h2: "Anlässe für eine US-Tochter",
        absaetze: ["Eine eigene Gesellschaft in den USA lohnt sich, wenn dort echtes Geschäft entsteht — nicht als Formalität. Typische Anlässe sind:"],
        punkte: [
          "US-Kunden verlangen einen Vertragspartner mit Sitz in den USA",
          "Einkauf, Lager oder Fertigung in den USA",
          "Projekte vor Ort, etwa im Bau oder im Anlagenbau",
          "Mitarbeiter oder Vertriebspartner in den USA",
          "Haftung für das US-Geschäft soll vom Stammhaus getrennt sein",
        ],
        nach: beleg("fuerWenNicht", "de"),
      },
      {
        typ: "karten", id: "form", h2: "LLC oder Corporation für die Tochter", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Schlank und flexibel", text: "Ein Operating Agreement statt fester Organe, keine Mindestkapitalregeln. Diese Form gründen wir in Ihrem Mandat." },
          { tag: "Corporation", titel: "Wenn Dritte Anteile halten sollen", text: "Die übliche Form, wenn US-Investoren, Joint-Venture-Partner oder Mitarbeiter beteiligt werden sollen. Ob sie für Ihr Vorhaben in Frage kommt, besprechen wir im Erstgespräch." },
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf für Ihre US-Tochter",
        etappen: [
          { titel: "Erstgespräch", text: "Sie schildern Vorhaben, Konzernstruktur und Zeitplan." },
          { titel: "Ihre Unterlagen", text: "Registerauszug der Muttergesellschaft, Pässe der Geschäftsführung, Name und Tätigkeit der Tochter." },
          { titel: "Gründung und Steuernummer", text: `${weitererSatz("UEBERGANG-EINREICHUNG", "de")} Operating Agreement und EIN-Antrag bereiten wir vor. Es entscheiden Bundesstaat und US-Steuerbehörde.` },
          { titel: "Konto und Pflichten", text: "Wir bereiten den Kontoantrag vollständig vor. Sie stellen ihn selbst. Es entscheidet das Institut. Ihr Pflichtenkalender nennt US-Meldungen und Staatsgebühren." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Wird die US-Tochter tatsächlich aus Deutschland, Österreich oder der Schweiz geleitet, kann sie dort steuerpflichtig sein. Wer die Tochter von wo aus leitet, klären Sie deshalb vor der Gründung mit Ihrem Steuerberater.",
          "Die Beteiligung an einer ausländischen Gesellschaft ist dem Finanzamt zu melden — in Deutschland nach § 138 AO. Gehört eine Florida-LLC einer GmbH oder AG, gibt diese in Florida zudem eine eigene Steuererklärung ab (Form F-1120).",
          "Verrechnungspreise zwischen Mutter und Tochter, Lohnbuchhaltung in den USA und Visa sind nicht Teil Ihres Mandats.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_banking" },
    ],
    fragen: [
      { f: "Kann meine GmbH Gesellschafterin der US-Gesellschaft sein?", a: "Ja. Gesellschafterin einer LLC oder Corporation kann eine GmbH, AG oder Holding ebenso sein wie eine natürliche Person. Wir benötigen dann den Registerauszug der Muttergesellschaft." },
      { f: "Muss die US-Tochter in den USA versteuert werden?", a: `Das hängt von Rechtsform, Tätigkeit und Ort der Leitung ab. ${STEUERFRAGEN}; die laufende Steuererklärung übernimmt Ihr Steuerberater.` },
      { f: "Übernimmt FIAON auch Visa für Mitarbeiter?", a: "Nein. Visa, Lohnbuchhaltung und Verrechnungspreise sind nicht Teil Ihres Mandats." },
      { f: "Wie lange dauert die Gründung der Tochter?", a: "Das bestimmen die Behörden: Über die Eintragung entscheidet der Bundesstaat, über die EIN die US-Steuerbehörde. Eine Frist sagen wir deshalb nicht zu." },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/tochter-oder-zweigniederlassung", "/business/wissen/markteintritt-usa", "/business/aus-deutschland", "/business/us-pflichten"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/onlinehandel",
    art: "zielgruppe",
    seo: {
      titel: "US-Gesellschaft gründen für Onlinehändler — FIAON Global",
      beschreibung: "US-Firma für Onlinehändler und Marken: wozu EIN und US-Adresse dienen, was Sales Tax verlangt. Gründung und Steuernummern in einem Mandat.",
    },
    stand: S,
    kennung: "FG · 12",
    auge: "Für wen · Onlinehandel",
    h1: "US-Gesellschaft für Onlinehändler.",
    h1b: "EIN, US-Adresse, Sales Tax.",
    lead: "Marktplätze, Zahlungsdienste und Logistiker in den USA erwarten oft eine US-Gesellschaft mit EIN und US-Adresse. Wir gründen Ihre Gesellschaft, beantragen die Steuernummern und bereiten Ihre Konto- und Kartenanträge vor; über Konto und Karte entscheidet das jeweilige Institut.",
    ziffern: [
      { wert: "EIN", label: "die US-Steuernummer Ihrer Gesellschaft; es entscheidet die US-Steuerbehörde" },
      { wert: "Sales Tax", label: "erheben die Bundesstaaten, mit eigenen Schwellen" },
      { wert: "US-Adresse", label: "für die Unterlagen beim Bundesstaat, nicht als Händler- oder Lageradresse" },
    ],
    blick: [
      ["Für", "Eigene Marken, Onlineshops, Händler auf US-Marktplätzen"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
      ["Nicht enthalten", "Buchhaltung, Umsatzsteuer-Registrierungen, Marktplatz-Konten"],
    ],
    kurz: "Für den Verkauf an Kunden in den USA ist eine eigene US-Gesellschaft kein Muss; viele Marktplätze, Zahlungsdienste und Logistiker erwarten aber EIN und US-Adresse. FIAON Global gründet die Gesellschaft, beantragt die EIN und bereitet Ihre Kontoanträge vor; über das Konto entscheidet das jeweilige Institut. Umsatzsteuern, Buchhaltung und die Steuerpflicht im Wohnsitzland klären Sie mit Ihrem Steuerberater und einem US-Steuerberater (CPA).",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "US-Gesellschaft im Handel: die Gründe",
        absaetze: ["Für den Verkauf an US-Kunden ist eine eigene Gesellschaft kein Muss. In der Praxis sprechen diese Gründe dafür:"],
        punkte: [
          "Marktplätze und Zahlungsdienste in den USA fragen bei der Anmeldung häufig eine EIN und eine US-Adresse ab",
          "Erlöse in US-Dollar gehen ohne Währungsumrechnung auf ein US-Konto",
          "US-Logistiker und Lager verlangen oft einen US-Vertragspartner",
          "Die Haftung für das US-Geschäft liegt bei der US-Gesellschaft",
        ],
        nach: "Den Antrag für ein US-Konto stellen Sie selbst; es entscheidet das jeweilige Institut.",
      },
      {
        typ: "hinweis", id: "steuern", h2: "Pflichten beim Verkauf in den USA",
        punkte: [
          "Umsatzsteuer (Sales Tax): In den USA erheben die Bundesstaaten eigene Umsatzsteuern mit eigenen Schwellen. Ob und wo Ihre Gesellschaft sich registrieren muss, klären Sie mit einem US-Steuerberater (CPA). Das ist nicht Teil Ihres Mandats.",
          `${GLOBAL_AGENT.de.anschrift} Warensendungen nimmt sie nicht an.`,
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
      {
        typ: "karten", id: "passt", h2: "Passt — und passt nicht", spalten: 2,
        karten: [
          { tag: "Passt", titel: "Marken mit echtem US-Geschäft", text: "Sie verkaufen bereits an US-Kunden oder starten dort mit Lager, Marktplatz oder eigenem Shop. Zahlungen in den USA wollen Sie über eine eigene Gesellschaft abwickeln." },
          { tag: "Passt nicht", titel: "Wer nur aus Steuergründen gründen will", text: `Wird die Gesellschaft aus Deutschland, Österreich oder der Schweiz geführt, ist sie dort in der Regel steuerpflichtig. ${satz("S10", "de")}` },
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_banking" },
    ],
    fragen: [
      { f: "Brauche ich für den Verkauf in die USA eine US-Firma?", a: "Nein, nicht zwingend. Viele Marktplätze, Zahlungsdienste und Logistiker erwarten aber eine US-Gesellschaft mit EIN und US-Adresse." },
      { f: "Muss meine US-Gesellschaft Umsatzsteuer abführen?", a: "Das hängt vom Bundesstaat und Ihren Umsätzen dort ab. Die Bundesstaaten erheben eigene Umsatzsteuern mit eigenen Schwellen; das klären Sie mit einem US-Steuerberater (CPA)." },
      { f: "Ist die Buchhaltung enthalten?", a: "Nein. Enthalten ist die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz, nicht die laufende Buchhaltung." },
      { f: "Spare ich mit einer US-LLC Steuern?", a: `Nein. ${satz("S10", "de")} Wird die Gesellschaft von dort aus geführt, ist sie dort in der Regel steuerpflichtig.` },
    ],
    paket: "global_banking",
    weiter: ["/business/us-geschaeftskonto", "/business/wissen/us-bankkonto-unterlagen", "/business/us-pflichten", "/business/wissen/amazon-stripe-paypal-llc"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/agenturen-software",
    art: "zielgruppe",
    seo: {
      titel: "US-Gesellschaft für Agenturen und Software — FIAON Global",
      beschreibung: "US-Firma für Agenturen, Software und Dienstleister mit US-Kunden: Steuernummer, Steuerformular, Rechtsform. Gründung in einem Mandat.",
    },
    stand: S,
    kennung: "FG · 13",
    auge: "Für wen · Agenturen und Software",
    h1: "US-Gesellschaft für Agenturen und Software.",
    h1b: "Für Verträge mit US-Kunden.",
    lead: "Einkaufsabteilungen in den USA fragen bei Lieferanten eine US-Steuernummer und ein Steuerformular ab. Wir gründen Ihre US-Gesellschaft, beantragen die EIN und bereiten Ihren Kontoantrag vor; über das Konto entscheidet das jeweilige Institut.",
    ziffern: [
      { wert: "EIN", label: "die US-Steuernummer, die US-Kunden abfragen" },
      { wert: "W-9 oder W-8", label: "das Steuerformular, das US-Kunden von Lieferanten verlangen" },
      { wert: "LLC oder Corporation", label: "je nach Kunden- und Investorenplänen" },
    ],
    blick: [
      ["Für", "Agenturen, Softwarehäuser, Dienstleister und freie Berufe mit US-Kunden, Gründer mit US-Investoren"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
    ],
    kurz: "Mit einer US-Gesellschaft stellen Dienstleister ihren US-Kunden Rechnungen aus den USA und geben bei Vertragsschluss eine US-Steuernummer an. Wer Investoren in den USA ansprechen will, gründet in der Regel eine Corporation. FIAON Global gründet Ihre Gesellschaft (LLC), beantragt die EIN und bereitet den Kontoantrag vor; über das Konto entscheidet das jeweilige Institut.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "US-Gesellschaft für US-Kunden: die Gründe",
        absaetze: [
          "Einkaufsabteilungen in den USA arbeiten mit festen Abläufen: ein Lieferant mit US-Steuernummer, das passende Steuerformular, Zahlung per US-Überweisung. Ein ausländischer Dienstleister passt oft nicht in diesen Ablauf — eine US-Gesellschaft schon.",
          "Hinzu kommt die Haftung: Verträge nach US-Recht mit US-Kunden liegen bei der US-Gesellschaft, nicht beim Unternehmen zu Hause.",
        ],
      },
      {
        typ: "karten", id: "form", h2: "LLC oder Corporation", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Für Dienstleister", text: "Schlank, ohne feste Organe. Passt, wenn die US-Gesellschaft Aufträge abwickelt und keine Investoren aufnimmt. Diese Form gründen wir in Ihrem Mandat." },
          { tag: "Corporation", titel: "Für Gründer mit US-Investoren", text: "Investoren in den USA erwarten in der Regel eine Corporation. Ob sie für Ihr Vorhaben in Frage kommt, besprechen wir im Erstgespräch." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Arbeiten Sie selbst oder Ihre Mitarbeiter in den USA, sind Visa und US-Arbeitsrecht zu beachten. Beides ist nicht Teil Ihres Mandats.",
          "Ihr Mandat enthält das Operating Agreement Ihrer Gesellschaft, nicht Ihre Kundenverträge. Diese legen Sie einem US-Anwalt vor.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Warum verlangen US-Kunden eine US-Steuernummer?", a: "US-Unternehmen fragen bei Lieferanten eine Steuernummer und ein Steuerformular ab (W-9 oder W-8), weil sie Zahlungen der Steuerbehörde melden. Mit einer eigenen US-Gesellschaft und EIN beantworten Sie diese Abfrage aus den USA. Welches Formular Ihre Gesellschaft ausfüllt, klären Sie mit einem US-Steuerberater (CPA)." },
      { f: "Brauche ich für US-Investoren eine Corporation?", a: "In der Regel ja. Investoren in den USA erwarten meist eine Corporation. In Ihrem Mandat gründen wir eine LLC; ob eine Corporation für Ihr Vorhaben in Frage kommt, besprechen wir im Erstgespräch." },
      { f: "Prüft FIAON meine Kundenverträge?", a: "Nein. Ihr Mandat enthält das Operating Agreement und die Gründungsunterlagen Ihrer Gesellschaft. Ihre Kundenverträge legen Sie einem US-Anwalt vor; FIAON ist keine Kanzlei." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-firmengruendung", "/business/wissen/llc-oder-corporation", "/business/delaware", "/business/wissen/llc-steuererklaerung"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/bau-immobilien",
    art: "zielgruppe",
    seo: {
      titel: "US-Gesellschaft für Bau und Immobilien — FIAON Global",
      beschreibung: "Projekte und Objekte in den USA in einer eigenen Gesellschaft: Gründung, Steuernummern und Anträge. Über jede Finanzierung entscheidet das Institut.",
    },
    stand: S,
    kennung: "FG · 14",
    auge: "Für wen · Bau und Immobilien",
    h1: "US-Gesellschaft für Bau und Immobilien.",
    h1b: "Eine Gesellschaft je Projekt.",
    lead: "Wer in den USA baut, saniert oder Objekte hält, führt jedes Projekt üblicherweise in einer eigenen Gesellschaft. Wir gründen sie, beantragen die Steuernummern und bereiten jeden Antrag für Konto und Finanzierung vor; es entscheidet das jeweilige Institut.",
    ziffern: [
      { wert: "Je Projekt", label: "eine eigene Gesellschaft, meist eine LLC" },
      { wert: "Jeder Antrag", label: "für die Finanzierung vollständig vorbereitet" },
      { wert: "Das Institut", label: "entscheidet über jede Finanzierung" },
    ],
    blick: [
      ["Für", "Bauunternehmen, Projektentwickler, Bestandshalter"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      ["Kapitalrahmen", `${B.rahmen}. ${satz("S9", "de")} ${weitererSatz("MIAMI", "de")}`],
      Z_AUSBLEIBT,
    ],
    kurz: "Für Projekte und Objekte in den USA wird üblicherweise je Projekt eine eigene Gesellschaft gegründet, meist eine LLC. FIAON Global gründet sie, beantragt die EIN und bereitet die Anträge für Konto und Finanzierung vollständig vor. Über jede Finanzierung entscheidet das finanzierende Institut; FIAON vergibt und vermittelt keine Kredite.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Eine Gesellschaft je Projekt",
        absaetze: [
          "In den USA ist es üblich, jedes Bauprojekt und jedes Objekt in einer eigenen Gesellschaft zu halten. Das trennt Haftung und Zahlen je Projekt; jedes Objekt lässt sich für sich bewerten und verkaufen.",
          `${weitererSatz("UEBERGANG-EINREICHUNG", "de")} ${weitererSatz("UEBERGANG-ASSISTENZ", "de")}`,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf in Kurzfassung", lead: "Für jede Projektgesellschaft gilt derselbe Ablauf.",
        etappen: kurzSchritte("DE"),
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          `FIAON vergibt und vermittelt keine Kredite. ${satz("S1", "de")}`,
          satz("S11", "de"),
          "Der Erwerb von Immobilien in den USA bringt eigene Steuer- und Meldepflichten mit sich. Das klären Sie mit einem US-Steuerberater (CPA) und Ihrem Steuerberater.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_kapital" },
    ],
    fragen: [
      { f: "Brauche ich für jedes Projekt eine eigene Gesellschaft?", a: "Vorgeschrieben ist es nicht, üblich schon: Eine Gesellschaft je Projekt trennt Haftung und Zahlen. Ob das zu Ihrem Vorhaben passt, besprechen wir im Erstgespräch." },
      { f: "Finanziert FIAON mein Projekt?", a: `Nein. FIAON vergibt und vermittelt keine Kredite; wir bereiten die Anträge vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung. ${satz("S1", "de")} ${satz("S5-C", "de")}` },
      { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
      { f: "Muss ich für Gründung und Anträge in die USA reisen?", a: `Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut. ${weitererSatz("MIAMI", "de")}` },
    ],
    paket: "global_kapital",
    weiter: ["/business/firmenkarten-kapital", "/business/miami", "/business/wissen/us-immobilie-finanzieren", "/business/wissen/business-credit-usa"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/aus-deutschland",
    art: "land",
    seo: {
      titel: "US-Gesellschaft gründen aus Deutschland — FIAON Global",
      beschreibung: "US-Firma aus Deutschland gründen: Ort der Geschäftsleitung, Meldung nach § 138 AO, Typenvergleich — mit Quellen. Gründung in einem Mandat.",
    },
    stand: S,
    kennung: "FG · 15",
    auge: "Für wen · Aus Deutschland",
    h1: "US-Gesellschaft aus Deutschland.",
    h1b: "Steuerpflicht und Meldung.",
    lead: "Eine US-Gesellschaft gründen Sie aus Deutschland ohne Wohnsitz in den USA. Zu Hause gilt: Wo die Gesellschaft geleitet wird, ist sie in der Regel steuerpflichtig, und die Beteiligung ist dem Finanzamt zu melden.",
    ziffern: [
      { wert: "§ 138 AO", label: "Meldung der ausländischen Beteiligung" },
      { wert: "§ 10 AO", label: "Ort der Geschäftsleitung" },
      { wert: "Typenvergleich", label: "wie das Finanzamt die LLC einordnet" },
    ],
    blick: [
      ["Steuerpflicht", "Dort, wo die Gesellschaft tatsächlich geleitet wird (§ 10 AO, § 1 KStG)"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
      ["Laufend", "Steuererklärung zu Hause mit Ihrem Steuerberater"],
    ],
    kurz: "Unternehmer aus Deutschland können eine US-LLC oder Corporation ohne Wohnsitz in den USA gründen. Wird die Gesellschaft von Deutschland aus geleitet, liegt der Ort ihrer Geschäftsleitung in Deutschland (§ 10 AO) und sie ist hier in der Regel steuerpflichtig. Die Beteiligung ist dem Finanzamt nach § 138 AO zu melden. Wie das Finanzamt eine LLC einordnet, entscheidet ein Typenvergleich.",
    bloecke: [
      {
        typ: "text", id: "geschaeftsleitung", h2: "Ort der Geschäftsleitung — der entscheidende Punkt",
        absaetze: [
          "Nach § 10 AO ist die Geschäftsleitung der Mittelpunkt der geschäftlichen Oberleitung — dort, wo die wichtigen Entscheidungen getroffen werden. Eine Kapitalgesellschaft mit Geschäftsleitung in Deutschland ist hier unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG), auch wenn ihr Sitz in den USA liegt.",
          "Für die meisten Unternehmer bedeutet das: Wer seine US-Gesellschaft vom Schreibtisch in Deutschland aus führt, versteuert sie in Deutschland. In den USA kommen die jährlichen Meldepflichten hinzu. Das ist kein Nachteil der US-Gesellschaft — es ist nur kein Steuermodell.",
        ],
      },
      {
        typ: "text", id: "typenvergleich", h2: "Der Typenvergleich",
        absaetze: [
          "Das deutsche Steuerrecht kennt keine LLC. Deshalb prüft das Finanzamt anhand ihrer Merkmale, ob sie eher einer Kapitalgesellschaft wie der GmbH oder einer Personengesellschaft entspricht — der sogenannte Typenvergleich. Die Kriterien hat das Bundesfinanzministerium für die US-LLC in einem eigenen Schreiben festgelegt (BMF vom 19. März 2004). Die Einordnung in den USA, das sogenannte Check-the-box-Wahlrecht, spielt dafür keine Rolle.",
          `Das Ergebnis hängt vom Operating Agreement ab: Wer entscheidet, wie Gewinne verteilt werden, ob Anteile übertragbar sind. Deshalb gehört die Einordnung geklärt, bevor das Operating Agreement geschrieben wird. ${STEUERFRAGEN}.`,
        ],
      },
      {
        typ: "text", id: "meldung", h2: "Die Meldung nach § 138 AO",
        absaetze: [
          "Wer eine Beteiligung an einer Gesellschaft im Ausland gründet oder erwirbt, meldet das dem Finanzamt — ab zehn Prozent oder mehr als 150.000 Euro Anschaffungskosten. Für Gesellschaften in Drittstaaten wie den USA gilt das zusätzlich, sobald Sie erstmals beherrschenden Einfluss haben. Gemeldet wird elektronisch mit der Einkommen- oder Körperschaftsteuererklärung, spätestens vierzehn Monate nach Ablauf des Jahres. Wer die Meldung versäumt, riskiert ein Bußgeld von höchstens 25.000 Euro (§ 379 AO).",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          satz("S10", "de"),
          `${STEUERFRAGEN}; die laufende Steuererklärung übernimmt Ihr Steuerberater.`,
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Kann ich als Deutscher eine US-LLC gründen?", a: "Ja, ohne Wohnsitz und ohne Staatsbürgerschaft in den USA. Sie brauchen einen Reisepass, einen Adressnachweis und bei einer Firma als Gesellschafterin deren Registerauszug." },
      { f: "Muss ich meine US-LLC in Deutschland versteuern?", a: `In der Regel ja, wenn Sie sie von Deutschland aus leiten: Der Ort der Geschäftsleitung liegt dann in Deutschland (§ 10 AO). ${STEUERFRAGEN}.` },
      { f: "Muss ich die US-Gesellschaft dem Finanzamt melden?", a: "Ja. Nach § 138 AO ist die Gründung oder der Erwerb einer Beteiligung an einer ausländischen Gesellschaft zu melden. Das geschieht elektronisch mit der Steuererklärung, spätestens vierzehn Monate nach Ablauf des Jahres. Versäumnisse können mit einem Bußgeld geahndet werden." },
      { f: "Wie ordnet das Finanzamt eine LLC ein?", a: "Über einen Typenvergleich: je nach Operating Agreement wie eine Kapitalgesellschaft oder wie eine Personengesellschaft. Deshalb gehört die Einordnung geklärt, bevor das Operating Agreement geschrieben wird." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/wissen/llc-gruenden", "/business/wissen/us-llc-wohnsitz-deutschland"],
    quellen: [
      { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
      { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
      { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
      { titel: "§ 379 AO — Steuergefährdung", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
      { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SCHWEIZ (Leitfaden 5.12, 2.8): Konto und Karte nie in Titel, Beschreibung, H1 oder Blickfang; im Fließtext nur der
  // eine Satz satz("S2", "de", "CH"). Kein Ort und keine Rolle der Partnergesellschaft auf dieser Seite.
  {
    pfad: "/business/aus-der-schweiz",
    art: "land",
    seo: {
      titel: "US-Gesellschaft gründen aus der Schweiz — FIAON Global",
      beschreibung: "US-Gesellschaft aus der Schweiz: tatsächliche Verwaltung, Steuerpflicht und Meldungen — Gründung und Steuernummern in einem Mandat.",
    },
    stand: S,
    kennung: "FG · 16",
    auge: "Für wen · Aus der Schweiz",
    h1: "US-Gesellschaft aus der Schweiz.",
    h1b: "Tatsächliche Verwaltung.",
    lead: "Für eine US-Gesellschaft brauchen Sie keinen Wohnsitz in den USA. Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein, beantragen die Steuernummern und übernehmen im ersten Jahr Fristen und Meldungen.",
    ziffern: [
      { wert: "Art. 50 DBG", label: "Steuerpflicht bei Sitz oder tatsächlicher Verwaltung in der Schweiz" },
      { wert: "Form 5472", label: "jährliche US-Meldung, auch ohne Umsatz" },
      { wert: "FIAON LTD", label: "Ihr Vertragspartner, Sitz London" },
    ],
    blick: [
      ["Steuerpflicht", "Bei Sitz oder tatsächlicher Verwaltung in der Schweiz (Art. 50 DBG)"],
      Z_UEBERNEHMEN_CH,
      Z_HONORAR,
      Z_SELBST_CH,
      Z_ENTSCHEIDET_CH,
      ["Laufend", "Steuererklärung in der Schweiz mit Ihrer Treuhand"],
    ],
    kurz: "Unternehmen und Unternehmer aus der Schweiz können eine US-Gesellschaft ohne Wohnsitz in den USA gründen. Wird die Gesellschaft tatsächlich von der Schweiz aus verwaltet, ist sie hier nach Art. 50 DBG unbeschränkt steuerpflichtig. FIAON Global gründet die Gesellschaft, holt jede Unterlage ein und beantragt die Steuernummern. Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde.",
    bloecke: [
      {
        typ: "text", id: "verwaltung", h2: "Die tatsächliche Verwaltung",
        absaetze: [
          "Das Schweizer Recht knüpft die Steuerpflicht einer juristischen Person an ihren Sitz oder den Ort ihrer tatsächlichen Verwaltung (Art. 50 DBG). Wer seine US-Gesellschaft von der Schweiz aus führt, muss deshalb damit rechnen, dass sie hier steuerpflichtig ist.",
          `Wie die Gesellschaft in der Schweiz eingeordnet wird und welche Pflichten daraus folgen, gehört vor der Gründung geklärt. ${STEUERFRAGEN}; die laufende Erklärung übernimmt Ihre Treuhand.`,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf in Kurzfassung",
        etappen: kurzSchritte("CH"),
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          satz("S10", "de", "CH"),
          GLOBAL_PFLICHTHINWEIS.de[1],
          satz("S2", "de", "CH"),
          satz("S7", "de", "CH"),
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Kann ich als Schweizer Unternehmer eine US-LLC gründen?", a: "Ja, ohne Wohnsitz in den USA. Sie brauchen einen Reisepass, einen Adressnachweis und bei einer Firma als Gesellschafterin deren Handelsregisterauszug." },
      { f: "Ist meine US-Gesellschaft in der Schweiz steuerpflichtig?", a: `In der Regel ja, wenn sie tatsächlich von der Schweiz aus verwaltet wird (Art. 50 DBG). ${STEUERFRAGEN}; die laufende Erklärung übernimmt Ihre Treuhand.` },
      { f: "Wer ist mein Vertragspartner?", a: `Die FIAON LTD mit Sitz in London. ${weitererSatz("ZAHLUNG", "de")}` },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-pflichten", "/business/wissen/us-llc-steuern", "/business/aus-oesterreich", "/business/us-firmengruendung"],
    quellen: [
      { titel: "Art. 50 DBG — Persönliche Zugehörigkeit", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
    ],
  },
];
