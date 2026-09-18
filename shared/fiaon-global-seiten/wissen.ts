// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN (19.09.2026, E-191)
// Die Übersicht und sechs Beiträge. Sie beantworten, wonach Unternehmer vor
// einer US-Gründung suchen („llc steuern", „llc oder corporation", „llc vs
// gmbh", „form 5472", „welcher bundesstaat", „llc seriös") — ehrlich, mit
// Quellen, ohne Steuerversprechen. Autor ist die Redaktion von FIAON Global;
// keine erfundene Person (bei Geld- und Steuerthemen zählt, wer spricht).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPreisText } from "../fiaon-global";
import { GLOBAL_VERBUNDEN } from "../fiaon-global-partner";
import { FAKTEN_STAND, IRS, QUELLEN_IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";

const S = "2026-09-19";
const QUELLE_AO10 = { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" };
const QUELLE_AO138 = { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" };
const QUELLE_KSTG1 = { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" };
const QUELLE_BMF = { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" };
const QUELLE_DBG50 = { titel: "Art. 50 DBG — Persönliche Zugehörigkeit", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" };
const QUELLE_ASTG = { titel: "§ 7 AStG — Hinzurechnungsbesteuerung", url: "https://www.gesetze-im-internet.de/astg/__7.html" };
const QUELLE_GMBHG5 = { titel: "§ 5 GmbHG — Stammkapital", url: "https://www.gesetze-im-internet.de/gmbhg/__5.html" };
const QUELLE_I1120 = { titel: "IRS — Instructions for Form 1120", url: "https://www.irs.gov/instructions/i1120" };

export const WISSEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen",
    art: "hub",
    seo: {
      titel: "US-Gesellschaft: Wissen für Unternehmer — FIAON Global",
      beschreibung: "Steuern, Form 5472, LLC oder Corporation, LLC oder GmbH, Florida, Delaware, Wyoming: das Wissen vor einer US-Gründung — ehrlich erklärt, mit Quellen.",
    },
    stand: S,
    kennung: "FG · 22",
    auge: "Wissen",
    h1: "Wissen vor der Gründung.",
    h1b: "Ehrlich erklärt, mit Quellen.",
    lead: "Was Unternehmer aus Deutschland, Österreich und der Schweiz vor einer US-Gründung wissen sollten: Steuern, Meldepflichten, Rechtsformen, Bundesstaaten. Jeder Beitrag nennt seine Quellen und seinen Stand — und sagt auch, was eine US-Gesellschaft nicht kann.",
    ziffern: [
      { wert: "6 Beiträge", label: "Steuern, Rechtsformen, Meldungen, Anbieter" },
      { wert: "3 Staaten", label: "Florida, Delaware, Wyoming" },
      { wert: FAKTEN_STAND, label: "Stand aller Zahlen" },
    ],
    blick: [
      ["Steuern", "Spart eine US-LLC Steuern? Die ehrliche Antwort"],
      ["Rechtsform", "LLC oder Corporation · LLC oder GmbH"],
      ["Meldungen", "Form 5472 mit Form 1120"],
      ["Bundesstaaten", "Florida, Delaware, Wyoming — und wie man wählt"],
      ["Anbieter", "Woran Sie seriöse Begleitung erkennen"],
      ["Redaktion", "FIAON Global — Quellen am Ende jedes Beitrags"],
    ],
    kurz: "Eine US-Gesellschaft ist ein Werkzeug für echtes Geschäft in den USA — kein Steuermodell. Wer sie aus Deutschland, Österreich oder der Schweiz führt, versteuert sie in der Regel zu Hause, meldet sie dem Finanzamt und gibt in den USA jährlich Form 5472 ab. Die Beiträge hier erklären, was das im Einzelnen bedeutet.",
    bloecke: [
      {
        typ: "verzeichnis", id: "beitraege", h2: "Die Beiträge",
        eintraege: [
          { pfad: "/business/wissen/us-llc-steuern", tag: "Steuern" },
          { pfad: "/business/wissen/llc-oder-corporation", tag: "Rechtsform" },
          { pfad: "/business/wissen/llc-oder-gmbh", tag: "Rechtsform" },
          { pfad: "/business/wissen/form-5472", tag: "Meldepflicht" },
          { pfad: "/business/wissen/bundesstaat-waehlen", tag: "Bundesstaat" },
          { pfad: "/business/wissen/anbieter-pruefen", tag: "Anbieter" },
        ],
      },
      {
        typ: "verzeichnis", id: "staaten", h2: "Die Bundesstaaten",
        eintraege: [
          { pfad: "/business/florida", tag: "Bundesstaat" },
          { pfad: "/business/delaware", tag: "Bundesstaat" },
          { pfad: "/business/wyoming", tag: "Bundesstaat" },
        ],
      },
      {
        typ: "verzeichnis", id: "laender", h2: "Nach Herkunftsland",
        eintraege: [
          { pfad: "/business/aus-deutschland", tag: "Deutschland" },
          { pfad: "/business/aus-der-schweiz", tag: "Schweiz" },
          { pfad: "/business/partner", tag: "Standorte" },
        ],
      },
    ],
    fragen: [],
    weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/fragen", "/business/paket-finder"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/us-llc-steuern",
    art: "wissen",
    seo: {
      titel: "US-LLC und Steuern: Die ehrliche Antwort — FIAON Global",
      beschreibung: "Spart eine US-LLC Steuern? Für Unternehmer aus Deutschland und der Schweiz meist nicht: Geschäftsleitung, Typenvergleich, Meldepflichten — mit Quellen.",
    },
    stand: S,
    kennung: "FG · 23",
    auge: "Wissen · Steuern",
    h1: "Spart eine US-LLC Steuern?",
    h1b: "Die ehrliche Antwort.",
    lead: "„Steuerfrei mit der US-LLC“ ist eines der hartnäckigsten Versprechen im Netz. Für Unternehmer, die in Deutschland, Österreich oder der Schweiz leben und von dort arbeiten, trägt es in aller Regel nicht. Hier steht, warum — und wofür eine US-Gesellschaft trotzdem gut ist.",
    ziffern: [
      { wert: "§ 10 AO", label: "Ort der Geschäftsleitung entscheidet" },
      { wert: "Art. 50 DBG", label: "tatsächliche Verwaltung in der Schweiz" },
      { wert: "Form 5472", label: "jährliche Meldung an die IRS" },
    ],
    blick: [
      ["Kurz", "Geführt von zu Hause = in der Regel zu Hause steuerpflichtig"],
      ["Deutschland", "Ort der Geschäftsleitung (§ 10 AO), Typenvergleich, § 138 AO"],
      ["Schweiz", "Sitz oder tatsächliche Verwaltung (Art. 50 DBG)"],
      ["USA", "Meldepflicht Form 5472 auch ohne Umsatz"],
      ["Wofür sie taugt", "Geschäft, Konto, Karten und Verträge in den USA"],
      ["Prüfung", "Vor jeder Gründung durch unseren Partner-Steuerberater"],
    ],
    kurz: "In der Regel nicht. Eine US-LLC, die ein Unternehmer von Deutschland, Österreich oder der Schweiz aus führt, hat dort ihren Ort der Geschäftsleitung beziehungsweise ihre tatsächliche Verwaltung und ist dort steuerpflichtig. Dazu kommen Meldepflichten in beiden Ländern. Eine US-Gesellschaft lohnt sich für echtes Geschäft in den USA — nicht, um Steuern zu vermeiden.",
    bloecke: [
      {
        typ: "text", id: "mythos", h2: "Woher das Versprechen kommt",
        absaetze: [
          "Eine LLC mit einem einzigen ausländischen Gesellschafter wird in den USA steuerlich meist nicht als eigenes Steuersubjekt behandelt. Hat sie dort kein Geschäft, zahlt sie in den USA oft keine Bundessteuer auf ihren Gewinn. Staaten wie Wyoming erheben zudem keine eigene Körperschaftsteuer.",
          "Daraus wird im Netz schnell „steuerfrei“. Übersehen wird dabei, dass der Staat, in dem der Unternehmer lebt und arbeitet, eigene Regeln hat — und die knüpfen nicht an den Sitz der Gesellschaft an, sondern daran, wo sie tatsächlich geführt wird.",
        ],
      },
      {
        typ: "text", id: "deutschland", h2: "Deutschland: der Ort der Geschäftsleitung",
        absaetze: [
          "Nach § 10 AO ist die Geschäftsleitung der Mittelpunkt der geschäftlichen Oberleitung. Wer die wichtigen Entscheidungen seiner US-Gesellschaft an seinem Schreibtisch in Deutschland trifft, hat die Geschäftsleitung in Deutschland. Eine Kapitalgesellschaft mit Geschäftsleitung im Inland ist hier unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG) — mit allen Einkünften.",
          "Wie das Finanzamt die LLC einordnet — wie eine GmbH oder wie eine Personengesellschaft —, entscheidet ein Typenvergleich nach dem Gesamtbild ihrer Merkmale (BMF-Schreiben vom 19. März 2004). Die Einordnung in den USA spielt dafür keine Rolle. Bei niedrig besteuerten, passiven Einkünften kann zudem die Hinzurechnungsbesteuerung nach dem Außensteuergesetz greifen.",
          "Hinzu kommt die Meldung: Gründung oder Erwerb der Beteiligung sind dem Finanzamt nach § 138 AO mitzuteilen, zusammen mit der Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "schweiz", h2: "Schweiz und Österreich",
        absaetze: [
          "In der Schweiz sind juristische Personen steuerpflichtig, wenn sich ihr Sitz oder ihre tatsächliche Verwaltung hier befindet (Art. 50 DBG). Auch hier gilt: Wer die US-Gesellschaft von der Schweiz aus führt, muss mit der Steuerpflicht in der Schweiz rechnen.",
          "Österreich knüpft ebenfalls an den Ort der Geschäftsleitung an. In allen drei Ländern entscheidet damit dieselbe Frage: Wo wird die Gesellschaft tatsächlich geführt?",
        ],
      },
      {
        typ: "tabelle", id: "uebersicht", h2: "Was wo gilt",
        kopf: ["", "USA", "Deutschland", "Schweiz"],
        zeilen: [
          ["Anknüpfung", "Geschäft in den USA, Rechtsform", "Ort der Geschäftsleitung (§ 10 AO)", "Sitz oder tatsächliche Verwaltung (Art. 50 DBG)"],
          ["Meldung", "Form 5472 mit Form 1120, jährlich", "§ 138 AO mit der Steuererklärung", "nach kantonalem und Bundesrecht"],
          ["Einordnung der LLC", "meist kein eigenes Steuersubjekt", "Typenvergleich", "nach Schweizer Recht"],
          ["Wer es prüft", "US-CPA", "Steuerberater", "Treuhand oder Steuerberater"],
        ],
        fuss: ["Vereinfachte Übersicht; im Einzelfall entscheiden Tätigkeit, Rechtsform und Doppelbesteuerungsabkommen."],
      },
      {
        typ: "karten", id: "wofuer", h2: "Wofür eine US-Gesellschaft gut ist", spalten: 2,
        karten: [
          { tag: "Gut für", titel: "Geschäft in den USA", text: "Verträge mit US-Kunden, ein US-Konto, Zahlungen in US-Dollar, getrennte Haftung, eine eigene Kartenhistorie in den USA." },
          { tag: "Nicht gut für", titel: "Steuern zu Hause vermeiden", text: "Wird sie von zu Hause geführt, ist sie dort in der Regel steuerpflichtig. Wer „steuerfrei“ verspricht, verschweigt den Ort der Geschäftsleitung." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Dieser Beitrag erklärt Grundlagen. Ihren Fall prüft vor der Gründung unser Partner-Steuerberater auf Ihr Mandat — die Prüfung ist im Festpreis jedes Pakets enthalten.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Muss ich meine US-LLC in Deutschland versteuern?", a: "Wenn Sie sie von Deutschland aus führen, in der Regel ja: Der Ort der Geschäftsleitung liegt dann in Deutschland (§ 10 AO). Wie das Finanzamt die LLC einordnet, entscheidet ein Typenvergleich." },
      { f: "Ist eine Wyoming-LLC steuerfrei?", a: "Wyoming erhebt keine eigene Körperschaftsteuer. Steuerpflichtig ist die Gesellschaft aber dort, wo sie geführt wird — für Unternehmer aus Deutschland, Österreich oder der Schweiz in der Regel zu Hause." },
      { f: "Warum werben so viele mit einer steuerfreien LLC?", a: "Weil eine LLC mit ausländischem Gesellschafter in den USA oft keine Bundessteuer zahlt. Das stimmt für die USA, sagt aber nichts über die Steuerpflicht im Heimatland — und die hängt am Ort der Geschäftsleitung." },
      { f: "Wofür lohnt sich eine US-Gesellschaft dann?", a: "Für echtes Geschäft in den USA: Verträge mit US-Kunden, ein US-Konto, Zahlungen in US-Dollar, getrennte Haftung und eine eigene Kartenhistorie in den USA." },
    ],
    weiter: ["/business/aus-deutschland", "/business/aus-der-schweiz", "/business/wissen/form-5472", "/business/wissen/anbieter-pruefen"],
    quellen: [QUELLE_AO10, QUELLE_KSTG1, QUELLE_BMF, QUELLE_ASTG, QUELLE_AO138, QUELLE_DBG50, QUELLEN_IRS[4]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/llc-oder-corporation",
    art: "wissen",
    seo: {
      titel: "LLC oder Corporation: Was passt? — FIAON Global",
      beschreibung: "LLC oder C-Corporation: Haftung, Besteuerung, Investoren, Formalitäten und Kosten im Vergleich — und wann welche Rechtsform zu Ihrem Vorhaben passt.",
    },
    stand: S,
    kennung: "FG · 24",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder Corporation?",
    h1b: "Die Wahl, die alles Weitere prägt.",
    lead: "Beide Rechtsformen beschränken die Haftung. Der Unterschied liegt in der Besteuerung, in der inneren Ordnung und darin, wer später einsteigen soll. Die Wahl prägt Konto, Karten, Meldungen und jeden Investor, der kommt.",
    ziffern: [
      { wert: IRS.koerperschaftsteuer, label: "Körperschaftsteuer des Bundes für Corporations" },
      { wert: "2 Formen", label: "beide mit beschränkter Haftung" },
      { wert: "vor der Gründung", label: "geprüft durch unseren Partner-Steuerberater" },
    ],
    blick: [
      ["LLC", "Schlank, flexibel, meist kein eigenes Steuersubjekt in den USA"],
      ["Corporation", "Eigenes Steuersubjekt, Standard für Investoren"],
      ["Haftung", "Bei beiden auf das Gesellschaftsvermögen beschränkt"],
      ["Investoren", "Erwarten in der Regel eine Corporation"],
      ["Wechsel", "Später möglich, aber mit Aufwand"],
      ["Prüfung", "Vor der Gründung im Festpreis enthalten"],
    ],
    kurz: `Die LLC ist die schlankere Form: flexibel geregelt im Operating Agreement und mit einem ausländischen Gesellschafter in den USA meist kein eigenes Steuersubjekt. Die Corporation ist ein eigenes Steuersubjekt — auf Bundesebene mit ${IRS.koerperschaftsteuer} Körperschaftsteuer — und der Standard, wenn Investoren einsteigen oder Mitarbeiter beteiligt werden sollen. Für Handel, Dienstleistung und den Aufbau einer Kartenhistorie ist meist die LLC die einfachere Wahl.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Der Vergleich",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuer in den USA", "mit einem ausländischen Gesellschafter meist kein eigenes Steuersubjekt", `eigenes Steuersubjekt, Bund ${IRS.koerperschaftsteuer}, dazu je nach Staat`],
          ["Innere Ordnung", "Operating Agreement, frei gestaltbar", "Satzung, Vorstand, Aktien nach festen Regeln"],
          ["Investoren", "selten", "der Standard"],
          ["Mitarbeiterbeteiligung", "möglich, aber unüblich", "üblich über Aktienoptionen"],
          ["Jährliche Meldung an die IRS", "Form 5472 mit Form 1120 (als Deckblatt)", "Form 1120; ist ein Anteilseigner zu mindestens 25 % ausländisch, dazu Form 5472"],
          ["Laufende Kosten", "niedriger", "höher, etwa durch Franchise Tax in Delaware"],
        ],
        fuss: ["Vereinfachte Übersicht; die Einordnung im Heimatland folgt eigenen Regeln."],
      },
      {
        typ: "karten", id: "wann", h2: "Wann welche Form passt", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Handel, Dienstleistung, Kartenhistorie", text: "Wenn die Gesellschaft Aufträge abwickelt, Waren verkauft oder eine eigene Bank- und Kartenhistorie aufbauen soll — und keine Investoren geplant sind." },
          { tag: "Corporation", titel: "Investoren, Beteiligungen, Verkauf", text: "Wenn US-Investoren einsteigen, Mitarbeiter Anteile erhalten oder das Unternehmen später verkauft werden soll." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Kann man später wechseln?",
        absaetze: [
          "Ja — eine LLC lässt sich in eine Corporation umwandeln. Der Wechsel kostet aber Zeit, Gebühren und steuerliche Prüfung in beiden Ländern. Deshalb lohnt es sich, die Frage vor der Gründung ernsthaft zu stellen: Wer soll in drei Jahren an dieser Gesellschaft beteiligt sein?",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die Wahl der Rechtsform hat steuerliche Folgen im Heimatland. Unser Partner-Steuerberater prüft sie vor der Gründung auf Ihr Mandat.",
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Was ist der Unterschied zwischen LLC und Corporation?", a: `Beide beschränken die Haftung. Die LLC ist flexibler und mit einem ausländischen Gesellschafter in den USA meist kein eigenes Steuersubjekt; die Corporation ist ein eigenes Steuersubjekt (Bund ${IRS.koerperschaftsteuer}) und der Standard für Investoren.` },
      { f: "Welche Rechtsform brauche ich für US-Investoren?", a: "In der Regel eine Corporation, oft in Delaware. Investoren in den USA kennen diese Form und erwarten sie." },
      { f: "Kann ich eine LLC später in eine Corporation umwandeln?", a: "Ja, aber mit Aufwand: Gebühren, neue Unterlagen und eine steuerliche Prüfung in beiden Ländern." },
    ],
    weiter: ["/business/delaware", "/business/wissen/llc-oder-gmbh", "/business/us-firmengruendung", "/business/agenturen-software"],
    quellen: [QUELLE_I1120, QUELLEN_IRS[4], QUELLEN_STAATEN.delaware[3]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/llc-oder-gmbh",
    art: "wissen",
    seo: {
      titel: "LLC oder GmbH: Der Vergleich — FIAON Global",
      beschreibung: "US-LLC oder GmbH: Gründung, Stammkapital, Notar, Haftung, Steuern und Pflichten im Vergleich — und warum die Frage meist nicht entweder-oder lautet.",
    },
    stand: S,
    kennung: "FG · 25",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder GmbH?",
    h1b: "Meist kein Entweder-oder.",
    lead: "Die LLC gilt als „amerikanische GmbH“ — schneller gegründet, ohne Notar, ohne Stammkapital. Das stimmt. Aber die Frage ist selten, welche von beiden: Die GmbH ist für das Geschäft zu Hause gemacht, die LLC für das Geschäft in den USA. Oft gehört die LLC der GmbH.",
    ziffern: [
      { wert: "25.000 €", label: "Stammkapital einer GmbH (§ 5 GmbHG)" },
      { wert: "kein", label: "Mindestkapital und kein Notar bei der LLC" },
      { wert: "oft beides", label: "die GmbH als Gesellschafterin der LLC" },
    ],
    blick: [
      ["GmbH", "Notar, Handelsregister, 25.000 € Stammkapital"],
      ["LLC", "Einreichung beim Bundesstaat, kein Mindestkapital"],
      ["Haftung", "Bei beiden auf das Gesellschaftsvermögen beschränkt"],
      ["Steuern", "Beide dort, wo sie geführt werden"],
      ["Typisch", "GmbH zu Hause, LLC als US-Tochter"],
      ["Prüfung", "Vor der Gründung durch unseren Partner-Steuerberater"],
    ],
    kurz: "Die GmbH wird mit Notar und Handelsregister gegründet und braucht 25.000 Euro Stammkapital; die LLC wird beim Bundesstaat eingereicht und braucht weder Notar noch Mindestkapital. Beide beschränken die Haftung, und beide sind dort steuerpflichtig, wo sie geführt werden. Für Unternehmen mit Geschäft in beiden Ländern ist die typische Lösung keine Wahl, sondern eine Struktur: die GmbH zu Hause als Gesellschafterin der LLC in den USA.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Der Vergleich",
        kopf: ["", "GmbH", "US-LLC"],
        zeilen: [
          ["Gründung", "Notar und Handelsregister", "Einreichung beim Bundesstaat"],
          ["Mindestkapital", "25.000 €, bei der Gründung mindestens zur Hälfte eingezahlt", "keins"],
          ["Satzung", "Gesellschaftsvertrag, notariell beurkundet", "Operating Agreement, privatschriftlich"],
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuern", "dort, wo sie geführt wird", "dort, wo sie geführt wird — dazu US-Meldepflichten"],
          ["Jährlich", "Jahresabschluss, Offenlegung", "Staatsgebühr, Registered Agent, Form 5472"],
          ["Gemacht für", "Geschäft in Deutschland", "Geschäft in den USA"],
        ],
        fuss: ["Vereinfachte Übersicht. Für die UG (haftungsbeschränkt) gelten eigene Regeln zum Stammkapital."],
      },
      {
        typ: "text", id: "struktur", h2: "Die typische Struktur: GmbH und LLC",
        absaetze: [
          "Wer in Deutschland ein Unternehmen führt und in den USA Geschäft aufbaut, gründet in der Regel keine LLC statt der GmbH, sondern eine LLC unter der GmbH. Die GmbH ist Gesellschafterin, die LLC schließt Verträge in den USA, führt das US-Konto und baut dort eine eigene Historie auf.",
          "So bleiben Haftung und Zahlen des US-Geschäfts getrennt. Steuerlich ist dabei zu klären, wo die LLC geführt wird und wie sie eingeordnet wird — das prüft unser Partner-Steuerberater vor der Gründung. Gehört eine Florida-LLC einer GmbH, gibt die GmbH in Florida zudem eine eigene Steuererklärung ab.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine LLC ersetzt keine GmbH für das Geschäft in Deutschland — und umgekehrt.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Die Beteiligung der GmbH an der LLC ist dem Finanzamt nach § 138 AO zu melden.",
        ],
      },
    ],
    fragen: [
      { f: "Ist eine LLC dasselbe wie eine GmbH?", a: "Nicht ganz. Beide beschränken die Haftung, aber die LLC braucht weder Notar noch Mindestkapital, und ihre Satzung — das Operating Agreement — ist frei gestaltbar." },
      { f: "Kann meine GmbH eine US-LLC gründen?", a: "Ja. Die GmbH wird Gesellschafterin der LLC. Wir benötigen dann den Handelsregisterauszug der GmbH und die Pässe der Geschäftsführung." },
      { f: "Spart die LLC gegenüber der GmbH Steuern?", a: "In der Regel nicht. Beide sind dort steuerpflichtig, wo sie geführt werden; die LLC bringt zusätzlich Meldepflichten in den USA mit sich." },
    ],
    weiter: ["/business/tochtergesellschaft-usa", "/business/wissen/llc-oder-corporation", "/business/aus-deutschland", "/business/wissen/us-llc-steuern"],
    quellen: [QUELLE_GMBHG5, QUELLE_AO10, QUELLE_AO138, QUELLEN_STAATEN.florida[4]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/form-5472",
    art: "wissen",
    seo: {
      titel: "Form 5472 für die LLC: Frist, Strafe, Ablauf — FIAON Global",
      beschreibung: "Form 5472 mit Pro-forma-1120: wer melden muss, was meldepflichtig ist, Frist 15. April, Strafe 25.000 $ — Pflicht auch ohne Umsatz.",
    },
    stand: S,
    kennung: "FG · 26",
    auge: "Wissen · Meldepflicht",
    h1: "Form 5472.",
    h1b: "Die Meldung, die niemand vergessen darf.",
    lead: "Gehört eine US-Gesellschaft einem ausländischen Gesellschafter, meldet sie der IRS jedes Jahr ihre Geschäfte mit ihm — mit Form 5472 und einer Form 1120 als Deckblatt. Die Meldung ist auch ohne Umsatz Pflicht, und ihr Versäumnis ist teuer.",
    ziffern: [
      { wert: "15. April", label: "Frist, mit Form 7004 bis 15. Oktober" },
      { wert: "25.000 $", label: "Strafe je Formular und Jahr" },
      { wert: "Fax oder Post", label: "nicht elektronisch" },
    ],
    blick: [
      ["Wer", "US-Gesellschaft mit ausländischem Gesellschafter, steuerlich kein eigenes Steuersubjekt"],
      ["Was", "Form 5472 mit einer Pro-forma-Form 1120"],
      ["Meldepflichtig", "Einlagen, Entnahmen, Darlehen, Zahlungen — auch die Einlage bei Gründung"],
      ["Frist", IRS.frist5472],
      ["Einreichung", "Per Fax oder Post, nicht elektronisch"],
      ["Strafe", `${IRS.strafe5472}, weitere Beträge nach Aufforderung`],
    ],
    kurz: `Form 5472 meldet der IRS die Geschäfte zwischen einer US-Gesellschaft und ihrem ausländischen Gesellschafter. Eine LLC, die steuerlich kein eigenes Steuersubjekt ist, reicht sie mit einer Pro-forma-Form 1120 ein — bis zum 15. April, verlängerbar bis 15. Oktober, per Fax oder Post. Meldepflichtig ist schon die Einlage bei der Gründung; die Strafe für eine fehlende Meldung beträgt ${IRS.strafe5472}.`,
    bloecke: [
      {
        typ: "text", id: "wer", h2: "Wer melden muss",
        absaetze: [
          "Seit 2017 gilt: Eine US-LLC mit einem einzigen ausländischen Gesellschafter, die steuerlich nicht als eigenes Steuersubjekt gilt, wird für diese Meldung wie eine Corporation behandelt. Sie gibt jedes Jahr Form 5472 ab, zusammen mit einer Form 1120, die nur Name, Adresse und EIN trägt — der sogenannten Pro-forma-Form 1120.",
          "Auch Corporations mit ausländischem Anteilseigner melden auf Form 5472, dort als Anlage zu ihrer regulären Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "was", h2: "Was meldepflichtig ist",
        absaetze: ["Gemeldet werden die Geschäfte zwischen der Gesellschaft und ihrem ausländischen Gesellschafter oder ihm nahestehenden Personen, etwa:"],
        punkte: [
          "die Einlage bei der Gründung und jede weitere Einlage",
          "Entnahmen und Ausschüttungen",
          "Darlehen in beide Richtungen",
          "Zahlungen für Leistungen, Waren oder Rechte",
        ],
        nach: "Weil schon die Einlage bei der Gründung zählt, ist die Meldung im ersten Jahr praktisch immer fällig — auch ohne einen Dollar Umsatz. Die Gesellschaft muss außerdem Aufzeichnungen führen, die diese Geschäfte belegen.",
      },
      {
        typ: "etappen", id: "ablauf", h2: "So läuft die Meldung ab",
        etappen: [
          { titel: "Aufzeichnungen", text: "Einlagen, Entnahmen und Zahlungen werden über das Jahr festgehalten — mit Belegen." },
          { titel: "Erstellung durch den US-CPA", text: "Der US-CPA erstellt Form 5472 und die Pro-forma-Form 1120 aus diesen Aufzeichnungen." },
          { titel: "Einreichung", text: "Bis zum 15. April per Fax oder Post an die IRS; mit Form 7004 verlängerbar bis 15. Oktober." },
          { titel: "Ablage", text: "Kopie und Nachweis der Einreichung liegen in Ihrem Dokumentenraum." },
        ],
      },
      {
        typ: "hinweis", id: "strafe", h2: "Was ein Versäumnis kostet",
        punkte: [
          `Für eine fehlende oder wesentlich unvollständige Meldung kann die IRS ${IRS.strafe5472} festsetzen — ebenso, wenn die nötigen Aufzeichnungen fehlen.`,
          "Bleibt die Meldung länger als 90 Tage nach einer Aufforderung der IRS aus, kommen für jeden weiteren Zeitraum von 30 Tagen erneut 25.000 $ hinzu.",
          "Die erste jährliche Meldung erstellt bei FIAON Global unser US-CPA — das Honorar ist im Festpreis jedes Pakets enthalten.",
        ],
      },
    ],
    fragen: [
      { f: "Wer muss Form 5472 abgeben?", a: "Eine US-Gesellschaft mit ausländischem Gesellschafter — auch eine LLC, die steuerlich kein eigenes Steuersubjekt ist. Sie reicht Form 5472 mit einer Pro-forma-Form 1120 ein." },
      { f: "Muss ich Form 5472 abgeben, wenn meine LLC keinen Umsatz hatte?", a: "Ja, sobald es meldepflichtige Geschäfte gab — und schon die Einlage bei der Gründung zählt dazu." },
      { f: "Kann ich Form 5472 elektronisch einreichen?", a: "Für die Pro-forma-Form 1120 mit Form 5472 nein. Sie wird per Fax oder Post an die IRS geschickt." },
      { f: "Wie hoch ist die Strafe für eine vergessene Form 5472?", a: `Die IRS kann ${IRS.strafe5472} festsetzen, bei fortdauerndem Versäumnis nach einer Aufforderung weitere Beträge.` },
    ],
    weiter: ["/business/us-pflichten", "/business/kosten", "/business/wissen/us-llc-steuern", "/business/ein-itin"],
    quellen: [QUELLEN_IRS[4], QUELLEN_IRS[5], QUELLE_I1120],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/bundesstaat-waehlen",
    art: "wissen",
    seo: {
      titel: "Welcher Bundesstaat für die LLC? — FIAON Global",
      beschreibung: "Florida, Delaware oder Wyoming? Gebühren, Fristen, Stärken und Kehrseiten im Vergleich — und die drei Fragen, die die Wahl des Bundesstaats entscheiden.",
    },
    stand: S,
    kennung: "FG · 27",
    auge: "Wissen · Bundesstaat",
    h1: "Welcher Bundesstaat?",
    h1b: "Drei Fragen entscheiden.",
    lead: "Delaware für Investoren, Wyoming für niedrige Kosten, Florida für Geschäft und Termine vor Ort — die Faustregeln stimmen. Entscheidend sind aber drei Fragen zu Ihrem Vorhaben, nicht die Werbung eines Staats.",
    ziffern: [
      { wert: `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`, label: "Gründungsgebühr einer LLC" },
      { wert: `60 $ bis ${STAAT.delaware.jahr}`, label: "jährlich an den Staat" },
      { wert: "3 Fragen", label: "die die Wahl entscheiden" },
    ],
    blick: [
      ["Florida", `${STAAT.florida.gruendung} Gründung, ${STAAT.florida.jahr} im Jahr — Team vor Ort in Miami`],
      ["Delaware", `${STAAT.delaware.gruendung} Gründung, ${STAAT.delaware.jahr} im Jahr — Standard für Investoren`],
      ["Wyoming", `${STAAT.wyoming.gruendung} Gründung, ab 60 $ im Jahr — schlank im Unterhalt`],
      ["Frage 1", "Wo sind Ihre Kunden, Lieferanten, Projekte?"],
      ["Frage 2", "Sollen Investoren einsteigen?"],
      ["Frage 3", "Brauchen Sie Termine vor Ort?"],
    ],
    kurz: `Für die meisten Unternehmer entscheidet sich die Wahl an drei Fragen: Wo findet das Geschäft statt? Sollen Investoren einsteigen? Braucht es Termine vor Ort? Wer in Florida tätig ist oder Termine in Miami braucht, gründet dort (${STAAT.florida.gruendung}). Wer Investoren plant, gründet meist eine Corporation in Delaware. Wer in keinem Staat tätig ist und niedrige Kosten will, schaut auf Wyoming (${STAAT.wyoming.gruendung}, ab 60 $ im Jahr).`,
    bloecke: [
      {
        typ: "etappen", id: "fragen-drei", h2: "Die drei Fragen",
        etappen: [
          { titel: "Wo findet das Geschäft statt?", text: "Ist die Gesellschaft in einem Staat tätig — mit Büro, Lager, Mitarbeitern oder Projekten —, muss sie sich dort ohnehin registrieren. Dann ist dieser Staat meist die einfachste Wahl." },
          { titel: "Sollen Investoren einsteigen?", text: "Investoren in den USA erwarten in der Regel eine Corporation in Delaware. Wer das plant, gründet besser gleich dort." },
          { titel: "Braucht es Termine vor Ort?", text: "Verlangt ein Institut einen persönlichen Termin oder wollen Sie den Aufbau selbst erleben, ist Florida mit unserem Team in Miami naheliegend." },
        ],
      },
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Staaten im Vergleich",
        kopf: ["", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Gründung", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich an den Staat", STAAT.florida.jahr, STAAT.delaware.jahr, STAAT.wyoming.jahr],
          ["Frist", "1. Januar bis 1. Mai", "1. Juni", "Gründungsmonat"],
          ["Stärke", "Geschäft in Florida, Team vor Ort", "Gesellschaftsrecht, Investoren", "niedrige laufende Kosten"],
          ["Kehrseite", "Frist im Frühjahr, Zuschlag 400 $", "höhere Jahressteuer", "kein Team vor Ort"],
        ],
        fuss: [`Stand ${FAKTEN_STAND}, Beträge für LLCs.`],
      },
      {
        typ: "verzeichnis", id: "staaten", h2: "Die Staaten im Einzelnen",
        eintraege: [
          { pfad: "/business/florida", tag: "Bundesstaat" },
          { pfad: "/business/delaware", tag: "Bundesstaat" },
          { pfad: "/business/wyoming", tag: "Bundesstaat" },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Der Bundesstaat ändert nichts an der Steuerpflicht im Heimatland — sie hängt am Ort der Geschäftsleitung.",
          "Eine Gesellschaft, die in einem anderen Staat tätig wird, muss sich dort in der Regel zusätzlich registrieren.",
          "Den Staat legen wir im Startgespräch gemeinsam fest; die Staatsgebühr ist im Festpreis enthalten.",
        ],
      },
    ],
    fragen: [
      { f: "Welcher Bundesstaat ist der beste für eine LLC?", a: "Es gibt keinen besten, nur einen passenden: Florida für Geschäft und Termine vor Ort, Delaware für Investoren, Wyoming für niedrige laufende Kosten." },
      { f: "Warum nicht einfach den günstigsten Staat?", a: "Weil eine Gesellschaft, die in einem anderen Staat tätig ist, sich dort zusätzlich registrieren muss — dann zahlt sie doppelt." },
      { f: "Beeinflusst der Bundesstaat meine Steuern zu Hause?", a: "Nein. Die Steuerpflicht im Heimatland hängt am Ort der Geschäftsleitung, nicht am Sitz der Gesellschaft." },
    ],
    weiter: ["/business/florida", "/business/delaware", "/business/wyoming", "/business/kosten"],
    quellen: [QUELLEN_STAATEN.florida[0], QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.delaware[1], QUELLEN_STAATEN.wyoming[0]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/anbieter-pruefen",
    art: "wissen",
    seo: {
      titel: "LLC-Anbieter seriös? Die Prüfliste — FIAON Global",
      beschreibung: "Seriöse Begleitung bei der US-Gründung erkennen: Vertragspartner im Register, Festpreis, keine Steuer- und Kreditversprechen, Partner mit Zulassung.",
    },
    stand: S,
    kennung: "FG · 28",
    auge: "Wissen · Anbieter",
    h1: "Seriös oder nicht?",
    h1b: "Die Prüfliste vor dem Auftrag.",
    lead: "„LLC“ ist eine Rechtsform — nicht mehr und nicht weniger. Viele Anbieter nutzen sie, gute wie schlechte. Ob eine Begleitung seriös ist, zeigt sich an acht Punkten, die Sie vor jedem Auftrag prüfen können. Wir legen dieselbe Liste an uns selbst an.",
    ziffern: [
      { wert: "8 Punkte", label: "vor jedem Auftrag prüfbar" },
      { wert: "2 Minuten", label: "genügen für den Registercheck" },
      { wert: "Companies House", label: "FIAON LTD No. 17318250" },
    ],
    blick: [
      ["Register", "Vertragspartner mit Registernummer, prüfbar"],
      ["Preis", "Festpreis mit Leistungsverzeichnis"],
      ["Steuern", "Keine Versprechen — Pflichthinweise stattdessen"],
      ["Kredit", "Keine Zusage zu Rahmen, Karte oder Darlehen"],
      ["Partner", "Steuerberater und Anwälte mit Zulassung, auf Ihr Mandat"],
      ["Offenheit", "Verbundene Gesellschaften werden genannt"],
    ],
    kurz: "Seriöse Begleitung bei der US-Gründung erkennen Sie an einem Vertragspartner mit prüfbarer Registernummer, einem Festpreis mit Leistungsverzeichnis, klaren Pflichthinweisen zu Steuern und Meldungen, dem Verzicht auf Zusagen zu Steuern, Karten und Krediten, Partnern mit eigener Zulassung — und daran, dass verbundene Gesellschaften offen genannt werden.",
    bloecke: [
      {
        typ: "etappen", id: "liste", h2: "Die acht Punkte",
        etappen: [
          { titel: "Wer ist Ihr Vertragspartner?", text: "Name, Rechtsform, Sitz und Registernummer müssen im Vertrag stehen — und im Register auffindbar sein. Ohne prüfbaren Vertragspartner kein Auftrag." },
          { titel: "Gibt es einen Festpreis mit Leistungsverzeichnis?", text: "Was enthalten ist, steht schriftlich — auch, was ab dem zweiten Jahr anfällt. Abos, die erst nach der Unterschrift auftauchen, sind ein Warnzeichen." },
          { titel: "Werden Steuern versprochen?", text: "„Steuerfrei“ oder „ohne Steuern“ verschweigt den Ort der Geschäftsleitung. Seriöse Anbieter nennen die Steuerpflicht zu Hause und die Meldepflichten." },
          { titel: "Werden Karten, Rahmen oder Kredite zugesagt?", text: "Über Konto, Karte und Rahmen entscheidet das Institut. Wer Beträge verspricht, verspricht, was er nicht halten kann." },
          { titel: "Wer beantwortet Steuer- und Rechtsfragen?", text: "Nur Steuerberater, US-CPA und Anwälte mit Zulassung — auf Ihr eigenes Mandat. Ein Gründungsdienst selbst darf das nicht." },
          { titel: "Werden die US-Pflichten genannt?", text: "Form 5472, Staatsgebühr, Registered Agent: Wer sie vor dem Auftrag nicht nennt, lässt Sie mit der teuersten Frist allein." },
          { titel: "Wer hat Zugriff auf Ihr Geld?", text: "Kontoinhaber ist Ihre Gesellschaft. Ein Anbieter braucht keine Vollmacht über Ihr Konto und nimmt kein Geld für Sie entgegen." },
          { titel: "Werden Verbindungen offen genannt?", text: "Gehören Partner zum selben Eigentümer, gehört das auf die Seite — nicht ins Kleingedruckte." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "Dieselbe Liste für FIAON Global",
        absaetze: [
          "Unser Vertragspartner ist die FIAON LTD, eingetragen im Companies House unter der Nummer 17318250. Der Festpreis steht mit Leistungsverzeichnis im Vertrag, die laufenden Kosten ab dem zweiten Jahr nennen wir vorab. Zu Steuern geben wir keine Zusagen, und wir sagen weder Karten noch Rahmen zu.",
          GLOBAL_ROLLEN.de.partner,
          GLOBAL_VERBUNDEN,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine Rechtsform sagt nichts über Seriosität — weder eine LLC noch eine Ltd noch eine GmbH.",
          "Prüfen Sie Registernummern selbst: im Companies House, in Zefix oder im Handelsregister.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Woran erkenne ich einen seriösen Anbieter für die US-Gründung?", a: "An einem prüfbaren Vertragspartner mit Registernummer, einem Festpreis mit Leistungsverzeichnis, klaren Pflichthinweisen und dem Verzicht auf Zusagen zu Steuern, Karten und Krediten." },
      { f: "Ist eine LLC an sich unseriös?", a: "Nein. Die LLC ist eine gewöhnliche Rechtsform in den USA. Über Seriosität entscheidet, wie ein Anbieter arbeitet — nicht, welche Rechtsform er hat." },
      { f: "Wie prüfe ich die Registernummer von FIAON?", a: "Im Companies House (England and Wales) unter der Nummer 17318250. Die Schwarzott Capital Partners AG finden Sie in Zefix unter CHE-102.119.428." },
    ],
    weiter: ["/business/partner", "/business/vergleich", "/business/kosten", "/business/wissen/us-llc-steuern"],
    quellen: [
      { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
      { titel: "Zefix — Schwarzott Capital Partners AG", url: "https://www.zefix.ch/de/search/entity/list/firm/304048" },
    ],
  },
];
