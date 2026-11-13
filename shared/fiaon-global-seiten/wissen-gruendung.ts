// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: GRÜNDUNG, STEUERNUMMERN, PRÄSENZ, STEUERN, STRUKTUR
// (23.09.2026, E-232 · neu gefasst 13.11.2026, E-510)
//
// Sechs Wissens-Artikel, je eine Suchfrage: LLC gründen, EIN beantragen, ITIN
// beantragen, Registered Agent und Adresse, US-Steuererklärung der LLC, Tochter
// oder Zweigniederlassung. Die vier Artikel zu Konto, Bonität und Karten stehen
// in wissen-konto-karten.ts.
//
// E-510 (13.11.2026, Justin: „keine Magie, sondern knallharte Fakten“): Jede
// Seite folgt dem Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ (7.4):
// erklären, nicht verkaufen — der Artikel muss ohne uns stimmen. Je Seite gibt es
// EINEN Abschnitt „Was FIAON Global dabei übernimmt“ (höchstens 120 Wörter): was
// wir tun, Ihr Teil, die Bedingung (wer entscheidet). Die festen Sätze (S1 bis
// S17), die Schritte 1 und 2 der festen Erzählung und die Übergangssätze kommen
// aus shared/fiaon-global-saetze.ts — sie werden hier nie ein zweites Mal getippt.
// Kein Betrag ist getippt: Der eine Betrag (Jahresbetreuung) kommt aus der
// Preisquelle (SAETZE_BETRAEGE); Zahlen Dritter kommen aus fakten.ts (eine Quelle).
//
// WAS HIER NIE STEHT: der Satz zur Erstattung nach Ziffer 4 (er gilt nur für die
// Finanzierung — diese Artikel handeln von Gründung, Steuernummern und Pflichten),
// eine Zusage zu Konto, Karte oder Finanzierung (es entscheidet das jeweilige
// Institut), „eingetragen“ als unsere Leistung (eintragen kann nur der
// Bundesstaat), eine Dauer als Zusage (Dauern sind Angaben der Behörden oder
// Erfahrungswerte, mit S15), ein „Team vor Ort“, ein Partner bei der Arbeit im
// Präsens (nur die Rollenwörter: „Partner-Anwälte“, „US-Steuerberater (CPA) aus
// unserem Partnernetz“, „unsere Partner in den USA“), ein Steuerversprechen.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import {
  SAETZE_BETRAEGE, SCHRITTE_KOPF, SECHS_SCHRITTE,
  beleg, satz, weitererSatz, type Schritt, type SchrittNr,
} from "../fiaon-global-saetze";
import { EIN_PRODUKT } from "./ein-produkt";
import { EIN_WEG, FAKTEN_STAND, FRISTEN, IRS, MARKT, QUELLEN_STAATEN, QUELLEN_WISSEN as Q, SCHWELLEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";

/** Tag der Erstveröffentlichung (E-232). */
const ERSCHIENEN = "2026-09-23";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). */
const S = "2026-11-13";
const P = EIN_PRODUKT.de;
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ein Schritt der festen Erzählung (Leitfaden 2.2) — Satz, Bedingung und „Ihr Teil“ wortgleich aus der einen Quelle. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Überschrift des einen Abschnitts über uns (Leitfaden 7.4). */
const FIAON_H2 = "Was FIAON Global dabei übernimmt";
/** S15 mit dem Stand der Angaben — steht in jedem Baustein, der eine Dauer nennt (Leitfaden 5.5). */
const DAUERN = `${satz("S15")} Stand: ${FAKTEN_STAND}.`;
/** Der Entscheider-Satz aus S2: „Über Konto, Karte und Rahmen entscheidet das jeweilige Institut.“ */
const INSTITUT = satz("S2").split(/(?<=\.)\s+/)[1];
/** Haftung bei Firmenkreditkarten (S11) mit dem Entscheider-Satz. */
const KARTEN_HAFTUNG = `${satz("S11")} ${INSTITUT}`;
/** Was ab dem zweiten Jahr anfällt (Vertrag Ziffer 6 Absatz 3) — Betrag aus der Preisquelle. */
const LAUFEND = `Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir das auf Wunsch für ${SAETZE_BETRAEGE.de.jahresbetreuung} im Jahr, Staatsgebühr enthalten; sie verlängert sich nicht von selbst.`;
/** Die erste jährliche US-Meldung — Wortlaut des Vertrags (Ziffer 2), Rollenbezeichnung nach Leitplanke 5. */
const US_MELDUNG = "die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz";

export const WISSEN_GRUENDUNG: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1 · LLC GRÜNDEN — der Überblick: alle zehn Schritte in Reihenfolge
  {
    pfad: "/business/wissen/llc-gruenden",
    art: "wissen",
    seo: {
      titel: "LLC gründen aus Deutschland: die Anleitung — FIAON Global",
      beschreibung: "LLC gründen aus Deutschland: zehn Schritte von der steuerlichen Einordnung bis zur Form 5472 — Gebühren, Unterlagen und Pflichten, mit Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 30",
    auge: "Wissen · Gründung",
    h1: "Eine LLC gründen.",
    h1b: "Schritt für Schritt, aus Deutschland.",
    lead: "Eine US-LLC lässt sich aus dem Ausland gründen — ohne Wohnsitz in den USA und ohne Mindestkapital. Die Einreichung beim Bundesstaat ist der kleinste Teil. Hier stehen die zehn Schritte in ihrer Reihenfolge: Kosten, Zuständigkeit, häufige Fehler.",
    ziffern: [
      { wert: "10 Schritte", label: "von der steuerlichen Einordnung bis zur ersten US-Meldung" },
      { wert: `${STAAT.wyoming.gruendung} – ${STAAT.florida.gruendung}`, label: "Gründungsgebühr des Bundesstaats" },
      { wert: "kein", label: "Mindestkapital, kein Notartermin" },
    ],
    blick: [
      ["Voraussetzung", "Reisepass, Wohnanschrift, ein klares Vorhaben — kein US-Wohnsitz"],
      ["Reihenfolge", "Steuerliche Einordnung, Bundesstaat, Gründung, EIN, Kontoantrag"],
      ["Staatsgebühr", `Florida ${STAAT.florida.gruendung}, Delaware ${STAAT.delaware.gruendung}, Wyoming ${STAAT.wyoming.gruendung}`],
      ["Pflicht in den USA", "Registered Agent, Jahresmeldung im Staat, Form 5472"],
      ["Pflicht im Wohnsitzland", "Meldung nach § 138 AO, Steuer am Ort der Geschäftsleitung"],
      ["Seit August 2026", "Keine BOI-Meldung mehr für US-Gesellschaften"],
      ["Mit FIAON Global", "Anmeldung, Unterlagen und Anträge für die Steuernummern in einem Mandat"],
    ],
    kurz: `Eine US-LLC gründen Sie aus Deutschland in zehn Schritten. Vor der Gründung stehen steuerliche Einordnung, Rechtsform, Bundesstaat und Name. Es folgen Registered Agent, Einreichung beim Staat, Operating Agreement, EIN und gegebenenfalls ITIN, dann Kontoantrag und Pflichtenkalender. Die Gebühr des Staats liegt zwischen ${STAAT.wyoming.gruendung} (Wyoming) und ${STAAT.florida.gruendung} (Florida); jedes Jahr fallen Staatsgebühr und Form 5472 an.`,
    bloecke: [
      {
        typ: "text", id: "vorab", h2: "Bevor Sie gründen: zwei Fragen",
        absaetze: [
          "Die erste Frage lautet nicht „Welcher Staat?“, sondern: Was soll die Gesellschaft tun? Verträge mit US-Kunden, Verkauf über US-Marktplätze, Zahlungsverkehr in US-Dollar, eine eigene Zahlungshistorie in den USA — je nach Antwort passen Rechtsform, Bundesstaat und Struktur anders.",
          "Die zweite Frage stellt Ihr Wohnsitzland: Wo wird die Gesellschaft geführt? Wer sie von Deutschland, Österreich oder der Schweiz aus leitet, ist dort in der Regel steuerpflichtig. Diese Einordnung gehört vor die Gründung, nicht danach — sie entscheidet auch, ob die LLC Ihnen persönlich oder Ihrer GmbH gehören sollte.",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: "Die zehn Schritte",
        lead: `In dieser Reihenfolge — jeder Schritt setzt den vorigen voraus. ${DAUERN}`,
        etappen: [
          { titel: "Vorhaben und steuerliche Einordnung", dauer: "vor allem anderen", text: "Klären Sie, was die Gesellschaft tun soll und wo sie geführt wird. Ein Steuerberater mit US-Erfahrung prüft, wie Ihr Wohnsitzland die LLC einordnet (in Deutschland per Typenvergleich) und welche Meldungen anfallen." },
          { titel: "Rechtsform wählen", text: "Die LLC für Handel, Dienstleistung und eine eigene Zahlungshistorie in den USA; die Corporation, wenn Investoren einsteigen sollen. Eine LLC kann einer Person gehören, mehreren oder Ihrer GmbH — jede Variante hat eigene Steuerfolgen." },
          { titel: "Bundesstaat wählen", text: "Wie lange darf die Eintragung dauern, wo findet das Geschäft statt, kommen Investoren, braucht es Termine vor Ort? Danach richtet sich die Wahl zwischen Delaware, Florida und Wyoming. Wer in einem weiteren Staat tätig wird, registriert sich dort zusätzlich." },
          { titel: "Namen prüfen", text: "Jeder Name wird im Staat nur einmal vergeben und trägt den Zusatz „LLC“ oder „Limited Liability Company“. Prüfen Sie ihn im Register des Staats und halten Sie zwei Ausweichnamen bereit." },
          { titel: "Registered Agent benennen", text: "Jede LLC braucht im Gründungsstaat einen Registered Agent mit physischer Anschrift, der amtliche Post und Klagen entgegennimmt — ab dem ersten Tag und ohne Unterbrechung." },
          { titel: "Beim Bundesstaat einreichen", dauer: "je nach Staat ein bis zwei Werktage bis rund zwei Wochen", text: `Das Gründungsdokument geht mit der Gebühr an den Staat: in Florida die Articles of Organization (${STAAT.florida.gruendung}), in Delaware das Certificate of Formation (${STAAT.delaware.gruendung}), in Wyoming die Articles of Organization (${STAAT.wyoming.gruendung}). ${GRUENDUNG.bedingung} Mit der Eintragung besteht die Gesellschaft.` },
          { titel: "Operating Agreement aufsetzen", text: "Der Gesellschaftsvertrag regelt Beteiligung, Geschäftsführung, Gewinnverteilung und Nachfolge. Er wird nicht eingereicht, aber Institute verlangen ihn in der Regel — und seit dem 1. Juni 2026 auch die IRS, wenn ein ITIN-Antrag auf die Beteiligung an einer LLC mit mehreren Gesellschaftern gestützt wird." },
          { titel: "EIN beantragen", dauer: "per Telefon am selben Tag, per Fax derzeit oft rund zwei Wochen", text: "Die Steuernummer der Gesellschaft beantragen Sie mit Form SS-4 — ohne US-Sozialversicherungsnummer per Fax, Post oder Telefon, nicht online. Die EIN ist Voraussetzung für Kontoantrag, Kartenantrag und Form 5472; über sie entscheidet die US-Steuerbehörde IRS." },
          { titel: "ITIN, wenn ein Grund vorliegt", text: "Die persönliche US-Steuernummer gibt es nur mit steuerlichem Grund (Form W-7). Für die EIN ist sie nicht nötig; für eine persönliche Kredithistorie in den USA ist sie es oft." },
          { titel: "Kontoantrag, Pflichtenkalender, Meldung im Wohnsitzland", text: "Mit Gründungsdokument, EIN und Operating Agreement folgt der Kontoantrag; über das Konto entscheidet das jeweilige Institut. Danach beginnen die Pflichten: Jahresmeldung im Staat, Form 5472 bis zum 15. April, die Meldung ans Finanzamt nach § 138 AO." },
        ],
      },
      {
        typ: "tabelle", id: "kosten", h2: "Was die Gründung kostet",
        lead: "Die Gebühren der Staaten sind überschaubar. Die größeren Kosten entstehen durch Agent, Verträge, Steuernummern und die jährliche Meldung — und durch Fehler in der Reihenfolge.",
        kopf: ["Posten", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Gründungsgebühr des Staats", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich an den Staat", STAAT.florida.jahr, STAAT.delaware.jahr, STAAT.wyoming.jahr],
          ["Registered Agent (marktüblich)", MARKT.agent, MARKT.agent, MARKT.agent],
          ["EIN bei der IRS", "keine Gebühr", "keine Gebühr", "keine Gebühr"],
          ["Form 5472 durch einen US-Steuerberater (CPA), marktüblich", MARKT.cpa5472, MARKT.cpa5472, MARKT.cpa5472],
        ],
        fuss: [
          `Stand ${FAKTEN_STAND}. Staatsgebühren nach den amtlichen Gebührenordnungen; marktübliche Beträge sind veröffentlichte Angaben mehrerer Anbieter, keine amtlichen Werte.`,
          `Im ersten Jahr Ihres Mandats bei FIAON Global enthalten: Staatsgebühr, Registered Agent, die Anträge für EIN und ITIN und ${US_MELDUNG}. ${beleg("honorarVorab")}`,
        ],
      },
      {
        typ: "text", id: "boi", h2: "Seit August 2026: keine BOI-Meldung mehr",
        absaetze: [
          "Bis 2025 galt: Jede neue US-Gesellschaft meldet der Behörde FinCEN ihre wirtschaftlich Berechtigten (Beneficial Ownership Information, BOI). Für Gesellschaften, die in den USA gegründet wurden, ist diese Pflicht entfallen — endgültig mit der Regel, die am 14. August 2026 in Kraft trat.",
          "Melden müssen nur noch ausländische Gesellschaften, die sich für Geschäfte in einem Bundesstaat registrieren — etwa eine GmbH mit Zweigniederlassung in den USA. Für eine LLC, die Sie in Florida, Delaware oder Wyoming gründen, fällt die Meldung weg. Hinweise auf Strafen für eine versäumte BOI-Meldung geben für diese Gesellschaften einen veralteten Stand wieder.",
        ],
      },
      {
        typ: "karten", id: "fehler", h2: "Sechs häufige Fehler", spalten: 3,
        karten: [
          { tag: "Fehler", titel: "Erst gründen, dann einordnen", text: "Die Steuerfrage im Wohnsitzland kommt nach der Gründung. Dann steht die Struktur schon — auch wenn die LLC unter der GmbH besser gepasst hätte." },
          { tag: "Fehler", titel: "Der Staat mit der niedrigsten Gebühr", text: "Wer in Florida tätig ist und in Wyoming gründet, registriert sich in Florida zusätzlich — und zahlt in beiden Staaten." },
          { tag: "Fehler", titel: "Die Agent-Anschrift als Sitz", text: "Viele Institute lehnen Konten ab, deren Geschäftsadresse die Anschrift eines Registered Agent oder ein Postfach ist." },
          { tag: "Fehler", titel: "Kein Operating Agreement", text: "Der Kontoantrag scheitert an einem Dokument, das mit der Gründung hätte vorliegen sollen: Wer ist beteiligt, wer darf handeln?" },
          { tag: "Fehler", titel: "Form 5472 nicht eingereicht", text: `Schon die Einlage bei der Gründung ist meldepflichtig. Die Strafe für eine fehlende Meldung: ${IRS.strafe5472}.` },
          { tag: "Fehler", titel: "Keine Meldung ans Finanzamt", text: "Gründung oder Beteiligung sind in Deutschland nach § 138 AO anzuzeigen — mit der nächsten Steuererklärung." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
          `Konto und Karten: ${satz("S2")}`,
          `${TEIL.bedingung}: ${satz("S3")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Eine LLC ersetzt kein Geschäftsmodell: Institute prüfen, was die Gesellschaft tut — nicht, in welchem Staat sie gegründet ist.",
        ],
      },
    ],
    fragen: [
      { f: "Kann ich als Deutscher eine LLC in den USA gründen?", a: `Ja. Für die Gründung brauchen Sie weder einen US-Wohnsitz noch die US-Staatsbürgerschaft und kein Mindestkapital. Nötig sind ein Registered Agent im Gründungsstaat und die Gebühr des Staats. ${GRUENDUNG.bedingung}` },
      { f: "Was kostet es, eine LLC zu gründen?", a: `Die Gebühr des Staats beträgt in Wyoming ${STAAT.wyoming.gruendung}, in Delaware ${STAAT.delaware.gruendung} und in Florida ${STAAT.florida.gruendung}. Dazu kommen Registered Agent, Operating Agreement und jedes Jahr Staatsgebühr und Form 5472. Zum Honorar von FIAON Global: ${beleg("honorarVorab")}` },
      { f: "Wie lange dauert die Gründung einer LLC?", a: `Die Eintragung beim Staat dauert derzeit ein bis zwei Werktage (Delaware mit Express), rund drei Werktage (Wyoming) oder oft rund zwei Wochen (Florida). Länger dauern EIN, ITIN und Kontoantrag. ${satz("S15")}` },
      { f: "Brauche ich für die LLC eine US-Adresse?", a: "Die LLC braucht einen Registered Agent mit Anschrift im Gründungsstaat. Für Kontoantrag und Verträge braucht sie zusätzlich eine Geschäftsadresse; die Anschrift des Agent reicht vielen Instituten dafür nicht. Welche Adresse genügt, legt jedes Institut selbst fest." },
      { f: "Muss eine neue LLC noch eine BOI-Meldung abgeben?", a: "Nein, wenn sie in den USA gegründet wurde. Seit dem 14. August 2026 sind US-Gesellschaften endgültig von der BOI-Meldung befreit; melden müssen nur ausländische Gesellschaften, die sich in einem Bundesstaat registrieren." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-firmengruendung", "/business/wissen/bundesstaat-waehlen", "/business/wissen/ein-beantragen", "/business/wissen/registered-agent-adresse"],
    quellen: [QUELLEN_STAATEN.florida[0], QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.wyoming[0], Q.ein, Q.boiEnde, Q.caa, Q.ao138],
    prio: 0.7,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2 · EIN BEANTRAGEN — ohne SSN, Form SS-4 Zeile für Zeile
  {
    pfad: "/business/wissen/ein-beantragen",
    art: "wissen",
    seo: {
      titel: "EIN beantragen aus dem Ausland: Form SS-4 — FIAON Global",
      beschreibung: "EIN für Ihre LLC ohne SSN beantragen: Form SS-4 Zeile für Zeile, die Wege per Fax, Post oder Telefon und typische Fehler — mit Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 31",
    auge: "Wissen · Steuernummer",
    h1: "Die EIN beantragen.",
    h1b: "Ohne Sozialversicherungsnummer.",
    lead: "Die EIN ist die Steuernummer Ihrer US-Gesellschaft — Voraussetzung für Kontoantrag, Kartenantrag und jede Meldung an die IRS. Der Online-Antrag setzt eine US-Sozialversicherungsnummer oder eine ITIN voraus. Ohne sie beantragen Sie die EIN mit Form SS-4: per Fax, Post oder Telefon.",
    ziffern: [
      { wert: "keine Gebühr", label: "die IRS erhebt für die EIN keine Gebühr" },
      { wert: "3 Wege", label: "Fax, Post oder Telefon — ohne SSN nicht online" },
      { wert: "9 Ziffern", label: "im Format 12-3456789" },
    ],
    blick: [
      ["Was", "Employer Identification Number — die Steuernummer der Gesellschaft"],
      ["Wann", "Nach der Eintragung beim Bundesstaat"],
      ["Formular", "Form SS-4, unterzeichnet für die Gesellschaft"],
      ["Wege ohne SSN", "Fax, Post oder Telefon — nicht online"],
      ["Bearbeitungszeit der IRS", gross(IRS.einDauer)],
      ["Gebühr", "Die IRS erhebt keine"],
      ["Mit FIAON Global", "Antrag vorbereitet und eingereicht — es entscheidet die US-Steuerbehörde"],
    ],
    kurz: `Ohne US-Sozialversicherungsnummer beantragen Sie die EIN mit Form SS-4 per Fax, per Post oder, als Antragsteller aus dem Ausland, telefonisch bei der IRS. Voraussetzung ist die Eintragung der Gesellschaft. In Zeile 7b steht „foreign“ oder „N/A“, wenn die verantwortliche Person weder SSN noch ITIN hat. Eine LLC mit einem ausländischen Gesellschafter vermerkt in Zeile 9a „${EIN_WEG.zeile9a}“.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "Die EIN: Zweck und Verwendung",
        absaetze: [
          "Die Employer Identification Number ist die Steuernummer einer US-Gesellschaft: neun Ziffern, vergeben von der US-Steuerbehörde IRS. Trotz ihres Namens braucht sie nicht nur, wer Mitarbeiter beschäftigt. Institute verlangen sie für jedes Geschäftskonto, Kartenherausgeber für jeden Antrag, und ohne sie lässt sich Form 5472 nicht einreichen.",
          "Eine LLC mit einem einzigen ausländischen Gesellschafter braucht die EIN schon deshalb, weil sie jedes Jahr Form 5472 abgeben muss. Sie meldet unter ihrem eigenen Namen und ihrer eigenen EIN.",
        ],
      },
      {
        typ: "text", id: "online", h2: "Online-Antrag: nur mit SSN oder ITIN",
        absaetze: [
          "Die IRS bietet einen Online-Antrag an, der die Nummer in derselben Sitzung ausgibt. Er setzt aber voraus, dass die verantwortliche Person eine gültige SSN oder ITIN hat. Gründer aus Deutschland, Österreich oder der Schweiz haben in aller Regel keine von beiden — für sie bleiben Fax, Post und Telefon.",
          "Eine ITIN eigens für die EIN zu beantragen, ist nicht nötig. Die EIN lässt sich ohne ITIN beantragen, und die ITIN braucht einen eigenen steuerlichen Grund.",
        ],
      },
      {
        typ: "text", id: "verantwortlich", h2: "Die verantwortliche Person",
        absaetze: [
          "Die IRS will wissen, wer hinter der Gesellschaft steht: die „responsible party“ — die Person, die die Gesellschaft letztlich besitzt oder kontrolliert. Außer bei Behörden muss das ein Mensch sein, keine Gesellschaft. Gehört die LLC Ihrer GmbH, ist es der Mensch, der die GmbH und damit die LLC tatsächlich lenkt.",
          "Hat diese Person weder SSN noch ITIN und kann auch keine bekommen, steht in Zeile 7b „foreign“ oder „N/A“. Je verantwortlicher Person vergibt die IRS nur eine EIN am Tag.",
        ],
      },
      {
        typ: "tabelle", id: "zeilen", h2: "Form SS-4: die maßgeblichen Zeilen",
        lead: "Für eine LLC mit einem ausländischen Gesellschafter. Die übrigen Zeilen erklären sich weitgehend selbst.",
        kopf: ["Zeile", "Was hinein gehört", "Typischer Fehler"],
        zeilen: [
          ["1", "Der Name der LLC, genau wie im Gründungsdokument — mit „LLC“", "Abkürzungen oder Schreibweisen, die vom Register abweichen"],
          ["4a–5b", "Post- und Geschäftsanschrift der Gesellschaft", "Eine Anschrift, an der die Briefe der IRS niemanden erreichen"],
          ["7a–7b", "Name der verantwortlichen Person; ohne SSN oder ITIN „foreign“ oder „N/A“", "Eine Gesellschaft statt eines Menschen"],
          ["8a–8c", "LLC ja, Zahl der Gesellschafter, in den USA gegründet", "Die Zahl weicht vom Operating Agreement ab"],
          ["9a", `„Other“ mit dem Vermerk „${EIN_WEG.zeile9a}“`, "„Sole proprietor“ angekreuzt"],
          ["10", "Grund: neues Geschäft, mit Angabe der Tätigkeit", "Ein leeres Feld"],
          ["11", "Datum der Gründung", "Das Datum des Antrags statt der Eintragung"],
          ["16–17", "Haupttätigkeit, konkret beschrieben", "„Other“ ohne Erklärung"],
          ["Third Party Designee", "Wer die Nummer für Sie entgegennimmt und Fragen zum Formular beantwortet", "Keine Unterschrift unter der Befugnis"],
        ],
        fuss: ["Nach den Instructions for Form SS-4 der IRS (Stand Dezember 2025). Die Befugnis des Designee endet, sobald die EIN vergeben und übermittelt ist."],
      },
      {
        typ: "karten", id: "wege", h2: "Drei Wege zur Nummer", spalten: 3,
        lead: DAUERN,
        karten: [
          { tag: "Fax", titel: "Laut IRS etwa vier Werktage", text: `Aus dem Ausland an ${EIN_WEG.faxAusland}. Geben Sie eine Faxnummer für die Antwort an — so kommt die Nummer auf demselben Weg zurück. In der Praxis dauert es derzeit oft rund zwei Wochen.` },
          { tag: "Post", titel: "Etwa vier Wochen", text: `An ${EIN_WEG.post}. Der längste der drei Wege; fehlt eine Angabe, kommt die Zeit für die Rückfrage hinzu.` },
          { tag: "Telefon", titel: "Nur für Antragsteller aus dem Ausland", text: `Unter ${EIN_WEG.telefon}, ${EIN_WEG.telefonZeit}. Anrufen darf, wer für die Gesellschaft unterzeichnen darf oder als Designee befugt ist.` },
        ],
      },
      {
        typ: "text", id: "danach", h2: "Nach der Vergabe",
        absaetze: [
          "Die IRS bestätigt die Nummer mit einem Schreiben (CP 575). Bewahren Sie es gut auf: Institute verlangen es beim Kontoantrag. Geht es verloren, bestätigt die IRS die Nummer auf Anfrage erneut (Letter 147C).",
          "Ändern sich Anschrift oder verantwortliche Person, melden Sie das der IRS mit Form 8822-B — innerhalb von sechzig Tagen.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Der EIN-Antrag ist Teil Ihres Mandats. Wir bereiten Form SS-4 vor, legen sie Ihnen unterschriftsreif vor, reichen sie bei der IRS ein und verfolgen den Antrag. Rückfragen der IRS klären wir mit Ihnen; das Schreiben der IRS legen wir in Ihr Portal.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `${TEIL.bedingung}: ${satz("S3")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die EIN in Ihrem Mandat", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die EIN ist eine Steuernummer, keine Genehmigung: Sie sagt nichts darüber, ob ein Institut ein Konto eröffnet.",
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Wer Form SS-4 unterzeichnet, versichert die Richtigkeit der Angaben gegenüber der IRS — Schreibweisen und Zahlen müssen zum Gründungsdokument passen.",
        ],
      },
    ],
    fragen: [
      { f: "Kann ich eine EIN ohne SSN beantragen?", a: "Ja. Ohne SSN oder ITIN beantragen Sie die EIN mit Form SS-4 per Fax, per Post oder, als Antragsteller aus dem Ausland, telefonisch. Nur der Online-Antrag verlangt eine SSN oder ITIN." },
      { f: "Wie lange dauert es, eine EIN zu bekommen?", a: `${gross(IRS.einDauer)}. Der telefonische Antrag ist der kürzeste Weg, wenn alle Angaben bereitliegen. ${satz("S15")}` },
      { f: "Kostet die EIN etwas?", a: "Bei der IRS nicht. Kosten entstehen nur, wenn Sie jemanden beauftragen. Bei FIAON Global ist der EIN-Antrag Teil Ihres Mandats." },
      { f: "Brauche ich eine ITIN, um eine EIN zu beantragen?", a: "Nein. Hat die verantwortliche Person weder SSN noch ITIN, steht in Zeile 7b der Form SS-4 „foreign“ oder „N/A“." },
      { f: "Was mache ich, wenn das EIN-Schreiben verloren ist?", a: "Die IRS bestätigt die Nummer auf Anfrage erneut (Letter 147C). Viele Institute akzeptieren diese Bestätigung anstelle des ursprünglichen Schreibens (CP 575)." },
    ],
    paket: "global_struktur",
    weiter: ["/business/ein-itin", "/business/wissen/itin-beantragen", "/business/wissen/llc-gruenden", "/business/wissen/us-bankkonto-unterlagen"],
    quellen: [Q.ss4, Q.ein, Q.smllc, Q.f8822b],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3 · ITIN BEANTRAGEN — Form W-7, der steuerliche Grund, der Reisepass
  {
    pfad: "/business/wissen/itin-beantragen",
    art: "wissen",
    seo: {
      titel: "ITIN beantragen aus Deutschland: Form W-7 — FIAON Global",
      beschreibung: "ITIN mit Form W-7 beantragen: wer sie braucht, welcher steuerliche Grund trägt, Reisepass und Acceptance Agent, Verfall — mit Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 32",
    auge: "Wissen · Steuernummer",
    h1: "Die ITIN beantragen.",
    h1b: "Nur mit steuerlichem Grund.",
    lead: "Die ITIN ist Ihre persönliche Steuernummer in den USA. Die IRS vergibt sie nur für steuerliche Zwecke und nur mit Begründung; für die Kreditwürdigkeit allein gibt es sie nicht. Ein Antrag mit tragfähigem Grund und vollständigen Nachweisen vermeidet Rückfragen.",
    ziffern: [
      { wert: "Form W-7", label: "mit Reisepass und steuerlichem Grund" },
      { wert: "5 Ausnahmen", label: "nur dann ohne US-Steuererklärung" },
      { wert: "9 Ziffern", label: "beginnt mit einer 9 und dient allein steuerlichen Zwecken" },
    ],
    blick: [
      ["Was", "Individual Taxpayer Identification Number — für Personen ohne SSN"],
      ["Wer", "Wer in den USA eine Steuererklärung abgeben muss oder eine Ausnahme nutzt"],
      ["Formular", "Form W-7, im Regelfall mit Steuererklärung"],
      ["Reisepass", "Original, Kopie der ausstellenden Behörde oder Bestätigung durch einen CAA"],
      ["Bearbeitungszeit der IRS", "Etwa sieben Wochen, Hauptsaison und Ausland neun bis elf"],
      ["Verfall", "Nach drei Steuerjahren ohne Erklärung"],
      ["Mit FIAON Global", "ITIN-Check vorab, Antrag nur mit tragfähigem Grund"],
    ],
    kurz: "Die ITIN beantragen Sie mit Form W-7 bei der IRS, im Regelfall zusammen mit einer US-Steuererklärung. Ohne sie geht es nur, wenn eine der fünf Ausnahmen der IRS greift. Für die EIN Ihrer Gesellschaft ist die ITIN nicht nötig. Den Reisepass schicken Sie im Original oder als behördlich beglaubigte Kopie, oder ein Certifying Acceptance Agent bestätigt ihn.",
    bloecke: [
      {
        typ: "text", id: "was", h2: "ITIN: Zweck und Grenzen",
        absaetze: [
          "Die Individual Taxpayer Identification Number vergibt die IRS an Personen, die in den USA steuerlich erfasst werden müssen, aber keine Sozialversicherungsnummer bekommen können. Sie hat neun Ziffern, beginnt mit einer 9 und dient allein steuerlichen Zwecken.",
          "Eine ITIN ist keine Arbeitserlaubnis, kein Aufenthaltstitel und kein Anspruch auf Leistungen der US-Sozialversicherung. Außerhalb des Steuerrechts ist sie auch kein Ausweis.",
        ],
      },
      {
        typ: "text", id: "grund", h2: "Der steuerliche Grund entscheidet",
        absaetze: [
          "Die IRS verlangt mit jedem Antrag einen Grund. Der Regelfall: Sie reichen Form W-7 zusammen mit einer US-Steuererklärung ein — etwa, weil Sie als Gesellschafter einer LLC Einkünfte aus Geschäft in den USA erklären müssen. Ohne Steuererklärung geht es nur, wenn eine der fünf Ausnahmen der IRS greift.",
          "Eine davon betrifft Gesellschafter einer Personengesellschaft, die in den USA Vermögen hält, dessen Erträge meldepflichtig sind und dem Steuerabzug unterliegen. Dazu zählt steuerlich auch die LLC mit mehreren Gesellschaftern. Seit dem 1. Juni 2026 legt ein Acceptance Agent solchen Anträgen den Teil des Gesellschaftsvertrags bei, der Name und EIN der Gesellschaft sowie Name und Unterschrift des Antragstellers zeigt.",
          "Für die Kreditwürdigkeit allein vergibt die IRS keine ITIN. Einen Antrag, der sich darauf stützt, weist sie zurück.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Ablauf des Antrags",
        lead: DAUERN,
        etappen: [
          { titel: "Grund klären", text: "Ein US-Steuerberater (CPA) prüft, welche Steuererklärung oder welche Ausnahme den Antrag trägt. Ohne tragfähigen Grund kein Antrag." },
          { titel: "Form W-7 ausfüllen", text: "Den Grund ankreuzen (für Ausländer mit US-Steuererklärung ist das meist „b“), Name wie im Reisepass, Anschrift im Ausland, Geburtsdaten, Passdaten. Bei einer Ausnahme gehören ihre Nachweise dazu." },
          { titel: "Reisepass bestätigen lassen", text: "Der Reisepass allein genügt als Nachweis für Identität und Staatsangehörigkeit. Er geht im Original oder als von der ausstellenden Behörde beglaubigte Kopie an die IRS. Oder ein Certifying Acceptance Agent prüft ihn persönlich und gibt ihn im Termin zurück." },
          { titel: "Einreichen", text: "Mit Steuererklärung oder Nachweis der Ausnahme an die ITIN-Stelle der IRS in Austin, Texas — oder über den Acceptance Agent." },
          { titel: "Bescheid", dauer: "etwa sieben Wochen", text: "Die IRS teilt die Nummer schriftlich mit (CP 565). Zwischen Mitte Januar und Ende April und bei Anträgen aus dem Ausland dauert es neun bis elf Wochen." },
        ],
      },
      {
        typ: "tabelle", id: "pass", h2: "Der Reisepass: drei Wege",
        kopf: ["Weg", "Was Sie tun", "Ihr Reisepass"],
        zeilen: [
          ["Original per Post", "Reisepass mit dem Antrag an die IRS schicken", "ist für die Dauer der Bearbeitung unterwegs"],
          ["Beglaubigte Kopie", "Kopie, beglaubigt von der Behörde, die den Reisepass ausgestellt hat", "bleibt bei Ihnen"],
          ["Certifying Acceptance Agent", "Termin beim CAA, der den Reisepass bestätigt und den Antrag einreicht", "geht im Termin zurück"],
        ],
        fuss: [
          "Eine notariell beglaubigte Kopie genügt der IRS nicht — beglaubigen muss die ausstellende Behörde.",
          `Acceptance Agents berechnen für Bestätigung und Einreichung ${MARKT.acceptanceAgent} (marktüblich, ${FAKTEN_STAND}).`,
        ],
      },
      {
        typ: "text", id: "verfall", h2: "Wann die ITIN verfällt",
        absaetze: [
          "Eine ITIN, die drei Steuerjahre in Folge auf keiner US-Steuererklärung steht, verfällt zum 31. Dezember des dritten Jahres. So sind zum 31. Dezember 2025 alle ITINs erloschen, die in den Jahren 2022, 2023 und 2024 nicht genutzt wurden.",
          "Eine verfallene ITIN erneuern Sie mit Form W-7 — mit demselben Aufwand wie beim ersten Antrag. Wer die Nummer behalten will, braucht also einen laufenden steuerlichen Grund.",
        ],
      },
      {
        typ: "karten", id: "karten", h2: "ITIN, Konto und Karten", spalten: 2,
        karten: [
          { tag: "Was stimmt", titel: "Manche Herausgeber fragen nach der ITIN", text: "Eine persönliche Kredithistorie führen die US-Auskunfteien in der Praxis über SSN oder ITIN. Manche Kartenherausgeber prüfen Anträge mit ITIN, andere verlangen eine SSN — das legt jeder Herausgeber selbst fest." },
          { tag: "Was nicht stimmt", titel: "„Mit ITIN gibt es Karten“", text: "Eine ITIN ist eine Voraussetzung, keine Zusage. Über jeden Antrag entscheidet der Herausgeber nach Historie, Einkommen und Geschäft." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${weitererSatz("UEBERGANG-ITIN")} Ohne tragfähigen Grund stellen wir keinen Antrag. Liegt er vor, bereiten wir Form W-7 mit allen Anlagen vor, reichen den Antrag ein und verfolgen ihn bis zum Bescheid.`,
          "Welchen der drei Wege Ihr Reisepass nimmt, stimmen wir vor dem Antrag mit Ihnen ab.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `Aus Ihrem Vertrag: ${UNTERLAGEN.werMachtWas.wennEsAusbleibt}`,
          `${TEIL.bedingung}: ${UNTERLAGEN.bedingung}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die ITIN in Ihrem Mandat", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die ITIN dient nur steuerlichen Zwecken. Wer sie beantragt, übernimmt die Pflichten, auf die sich der Antrag stützt — etwa eine jährliche US-Steuererklärung.",
          KARTEN_HAFTUNG,
          "Eine ITIN ersetzt keine SSN: Für Arbeit und Sozialleistungen in den USA gelten eigene Regeln.",
        ],
      },
    ],
    fragen: [
      { f: "Brauche ich eine ITIN für meine LLC?", a: "Für die EIN der Gesellschaft nicht. Eine ITIN brauchen Sie persönlich, wenn Sie in den USA eine Steuererklärung abgeben müssen oder eine der Ausnahmen der IRS greift." },
      { f: "Wie lange dauert es, eine ITIN zu bekommen?", a: `${gross(IRS.itinDauer)}. ${satz("S15")}` },
      { f: "Muss ich für die ITIN meinen Reisepass aus der Hand geben?", a: "In die USA schicken müssen Sie ihn nicht. Statt des Originals genügt eine von der ausstellenden Behörde beglaubigte Kopie — oder ein von der IRS zugelassener Certifying Acceptance Agent bestätigt Ihren Reisepass." },
      { f: "Kann ich eine ITIN nur für eine Kreditkarte beantragen?", a: "Nein. Die IRS vergibt ITINs nur für steuerliche Zwecke; der Antrag braucht eine Steuererklärung oder eine Ausnahme. Manche Kartenherausgeber fragen nach der ITIN — über die Karte entscheiden sie selbst." },
      { f: "Verfällt eine ITIN?", a: "Ja, wenn sie drei Steuerjahre in Folge auf keiner US-Steuererklärung steht — zum 31. Dezember des dritten Jahres. Erneuert wird sie mit Form W-7." },
    ],
    paket: "global_struktur",
    weiter: ["/business/ein-itin", "/business/wissen/ein-beantragen", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/llc-steuererklaerung"],
    quellen: [Q.itin, Q.w7, Q.caa, Q.itinAusland, Q.itinUebersicht],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4 · REGISTERED AGENT UND ADRESSE — die US-Präsenz
  {
    pfad: "/business/wissen/registered-agent-adresse",
    art: "wissen",
    seo: {
      titel: "Registered Agent und US-Adresse der LLC — FIAON Global",
      beschreibung: "Registered Agent, Geschäftsadresse, Telefonnummer: was die LLC gesetzlich braucht, was Institute verlangen und warum ein Postfach nicht reicht.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 33",
    auge: "Wissen · US-Präsenz",
    h1: "Registered Agent und Adresse.",
    h1b: "Die US-Präsenz Ihrer Gesellschaft.",
    lead: "Jede LLC braucht vom ersten Tag an einen Registered Agent im Gründungsstaat — das ist Gesetz. Für Kontoantrag und Verträge braucht sie mehr: eine Geschäftsadresse, die das jeweilige Institut akzeptiert, und eine Telefonnummer, unter der jemand erreichbar ist.",
    ziffern: [
      { wert: "Pflicht", label: "in jedem Bundesstaat, ohne Unterbrechung" },
      { wert: "3 Anschriften", label: "Agent, Geschäftsadresse, Postanschrift" },
      { wert: "4. Freitag im September", label: "Auflösung in Florida bei fehlender Jahresmeldung" },
    ],
    blick: [
      ["Registered Agent", "Nimmt Klagen und amtliche Post entgegen — gesetzliche Pflicht"],
      ["Anschrift des Agent", "Physisch im Gründungsstaat, kein Postfach"],
      ["Geschäftsadresse", "Wo die Gesellschaft erreichbar ist — Institute prüfen sie"],
      ["Postanschrift", "Wohin die IRS schreibt"],
      ["Telefonnummer", "Eine US-Nummer, die jemand annimmt"],
      ["Wenn der Agent fehlt", "Verzug beim Staat, im schlimmsten Fall die Auflösung"],
      ["Mit FIAON Global", "Agent, Adresse und Nummer im ersten Jahr enthalten"],
    ],
    kurz: "Der Registered Agent ist die Stelle, an die Gerichte und Behörden im Gründungsstaat Klagen und amtliche Schreiben zustellen. Er braucht eine physische Anschrift in diesem Staat und muss zu Geschäftszeiten erreichbar sein; jeder Bundesstaat schreibt ihn vor. Seine Anschrift ist keine Geschäftsadresse: Für ein Konto verlangen Institute eine Adresse, an der die Gesellschaft erreichbar ist — ein Postfach reicht meist nicht.",
    bloecke: [
      {
        typ: "text", id: "agent", h2: "Was der Registered Agent tut",
        absaetze: [
          "In den USA wird eine Klage nicht per Post zugestellt, sondern persönlich übergeben — „service of process“. Damit das bei einer Gesellschaft ohne Büro im Staat funktioniert, verlangt jeder Bundesstaat einen Registered Agent. Das ist eine Person oder ein Unternehmen mit Anschrift im Staat; der Agent nimmt Klagen und Schreiben der Behörden entgegen und gibt sie unverzüglich weiter.",
          "Florida verlangt ihn in § 605.0113 der Florida Statutes, Delaware im Limited Liability Company Act, Wyoming mit physischer Anschrift im Staat. Der Agent steht mit Name und Anschrift im öffentlichen Register.",
          "Selbst Agent sein kann nur, wer im Staat wohnt oder dort ein Büro hat, das zu Geschäftszeiten besetzt ist. Für Gründer aus Europa ist ein gewerblicher Agent der Regelfall.",
        ],
      },
      {
        typ: "tabelle", id: "drei", h2: "Drei Anschriften, drei Aufgaben",
        kopf: ["", "Registered Agent", "Geschäftsadresse", "Postanschrift"],
        zeilen: [
          ["Wozu", "Klagen und amtliche Post", "Sitz der Gesellschaft für Institute und Kunden", "Briefe der IRS und der Staaten"],
          ["Pflicht", "ja, im Gründungsstaat", "für Kontoantrag und Verträge faktisch ja", "ja, in Form SS-4"],
          ["Wo", "im Gründungsstaat, physisch", "wo die Gesellschaft tätig ist", "wo die Post Sie verlässlich erreicht"],
          ["Öffentlich", "ja, im Register", "meist ja", "nein"],
          ["Typischer Fehler", "Agent gekündigt, Staat nicht informiert", "Agent-Anschrift oder Postfach als Sitz", "Briefe der IRS erreichen niemanden"],
        ],
      },
      {
        typ: "text", id: "institute", h2: "Warum Institute eine physische Adresse verlangen",
        absaetze: [
          "US-Institute müssen die Identität jedes Kunden feststellen. Für Gesellschaften gehört dazu eine Anschrift: der Hauptsitz, ein örtliches Büro oder ein anderer physischer Ort der Geschäftstätigkeit (31 CFR 1020.220). Eine Adresse, unter der Hunderte Gesellschaften gemeldet sind, beantwortet diese Frage nicht.",
          "Deshalb lehnen viele Institute Konten ab, deren Geschäftsadresse die Anschrift eines Registered Agent, ein Postfach oder ein reiner Briefkasten ist. Andere akzeptieren eine Geschäftsadresse im Ausland, wenn sie zum Geschäft passt. Welche Adresse genügt, legt jedes Institut selbst fest.",
        ],
      },
      {
        typ: "text", id: "telefon", h2: "Die Telefonnummer",
        absaetze: [
          "Kartenherausgeber und Institute rufen an — zur Bestätigung eines Antrags, bei Rückfragen, bei ungewöhnlichen Zahlungen. Ist die US-Nummer nicht erreichbar oder meldet sich nur eine Bandansage, bleibt die Rückfrage offen; wie ein Institut damit umgeht, entscheidet es selbst. Die Nummer gehört zur Gesellschaft, ist erreichbar und lautet in allen Unterlagen gleich.",
        ],
      },
      {
        typ: "karten", id: "folgen", h2: "Wenn der Agent fehlt", spalten: 3,
        karten: [
          { tag: "Folge", titel: "Keine Zustellung", text: "Findet das Gericht keinen Agent, sehen viele Staaten die Zustellung über den Secretary of State vor. Wer davon nichts erfährt, versäumt Fristen — bis hin zum Urteil in Abwesenheit." },
          { tag: "Folge", titel: "Kein ordnungsgemäßer Status", text: "Ohne Agent ist die Gesellschaft beim Staat nicht mehr „in good standing“. Institute und Vertragspartner prüfen diesen Status." },
          { tag: "Folge", titel: "Auflösung von Amts wegen", text: "In Florida kann der Staat eine LLC ohne Registered Agent auflösen (§ 605.0714) — ebenso, wenn die Jahresmeldung fehlt: dann am vierten Freitag im September." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Den Agent wechseln",
        absaetze: [
          "Ein Wechsel ist jederzeit möglich: Der neue Agent erklärt sich bereit, die Gesellschaft meldet den Wechsel beim Staat — meist mit einem eigenen Formular und gegen Gebühr. Kündigen Sie den alten Agent erst, wenn der neue im Register steht; jede Lücke dazwischen ist eine Lücke in der Zustellung.",
          "Ändern sich Name oder Anschrift des Agent, muss das ebenfalls im Register stehen. In Florida muss die Änderung binnen dreißig Tagen gemeldet sein — sonst droht auch hier die Auflösung von Amts wegen (§ 605.0714).",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `Registered Agent, US-Geschäftsadresse und US-Telefonnummer sind im ersten Jahr Ihres Mandats enthalten. Zustellungen und Behördenpost stellen wir digital in Ihr Portal ein; die Fristen stehen im Pflichtenkalender Ihrer Gesellschaft. ${weitererSatz("UEBERGANG-ASSISTENZ")}`,
          LAUFEND,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `${TEIL.bedingung}: Welche Anschrift für ein Konto genügt, legt jedes Institut selbst fest.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die US-Präsenz in Ihrem Mandat", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine US-Adresse verlegt nicht die Geschäftsleitung: Steuerlich zählt, wo die Gesellschaft tatsächlich geführt wird.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Wird die Gesellschaft in einem weiteren Staat tätig, braucht sie dort in der Regel einen eigenen Registered Agent.",
        ],
      },
    ],
    fragen: [
      { f: "Was ist ein Registered Agent?", a: "Die gesetzlich vorgeschriebene Empfangsstelle einer US-Gesellschaft im Gründungsstaat: Sie nimmt Klagen und amtliche Schreiben entgegen und gibt sie weiter. Jeder Bundesstaat verlangt einen." },
      { f: "Kann ich mein eigener Registered Agent sein?", a: "Nur, wenn Sie im Gründungsstaat wohnen oder dort ein Büro haben, das zu Geschäftszeiten besetzt ist. Für Gründer aus Europa ist ein gewerblicher Agent der Regelfall." },
      { f: "Kann ich die Adresse des Registered Agent als Geschäftsadresse nutzen?", a: "Rechtlich ist sie die Anschrift des Agent, nicht Ihr Geschäftssitz. Viele Institute lehnen Konten mit dieser Adresse als Geschäftsadresse ab; welche Adresse genügt, entscheidet jedes Institut selbst." },
      { f: "Was kostet ein Registered Agent?", a: `Am Markt ${MARKT.agent}. Bei FIAON Global sind Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr Ihres Mandats enthalten. Ab dem zweiten Jahr gehören sie zur Jahresbetreuung für ${SAETZE_BETRAEGE.de.jahresbetreuung} im Jahr; sie verlängert sich nicht von selbst.` },
      { f: "Was passiert, wenn meine LLC keinen Registered Agent hat?", a: "Sie verliert ihren ordnungsgemäßen Status beim Staat; bleibt der Mangel bestehen, kann der Staat sie auflösen. Klagen erreichen Sie womöglich nicht rechtzeitig." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-firmengruendung", "/business/wissen/llc-gruenden", "/business/wissen/us-bankkonto-unterlagen", "/business/florida"],
    quellen: [QUELLEN_STAATEN.florida[3], Q.floridaAufloesung, Q.delawareAgent, QUELLEN_STAATEN.wyoming[1], Q.cip],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9 · DIE US-STEUERERKLÄRUNG DER LLC — welche Formulare, welche Fristen
  {
    pfad: "/business/wissen/llc-steuererklaerung",
    art: "wissen",
    seo: {
      titel: "US-Steuererklärung der LLC: alle Fristen — FIAON Global",
      beschreibung: "Pro-forma-1120, 1040-NR, 1065, 1120-F, FBAR: welche US-Erklärungen Ihre LLC je nach Struktur abgibt — mit Fristen, Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 38",
    auge: "Wissen · Steuererklärung",
    h1: "Die US-Steuererklärung der LLC.",
    h1b: "Welche Formulare, welche Fristen.",
    lead: "Auch eine LLC, die in den USA keine Steuer zahlt, gibt dort in der Regel Erklärungen ab. Welche es sind, hängt an Eigentümer, steuerlicher Einordnung und Geschäft in den USA. Diese Übersicht ordnet Formulare und Fristen nach Struktur.",
    ziffern: [
      { wert: "15. April", label: "Frist für Form 5472 mit Form 1120" },
      { wert: IRS.koerperschaftsteuer, label: "Bundessteuer auf Gewinne einer Corporation" },
      { wert: "10.000 $", label: "Auslandskonten in Summe — darüber gilt der FBAR" },
    ],
    blick: [
      ["Einzel-LLC ohne US-Geschäft", "Form 5472 mit Pro-forma-Form 1120"],
      ["Einzel-LLC mit US-Geschäft", "Dazu Form 1040-NR (Person) oder 1120-F (GmbH)"],
      ["Mehrere Gesellschafter", "Form 1065, Steuerabzug für ausländische Gesellschafter"],
      ["Corporation", `Form 1120, ${IRS.koerperschaftsteuer} Bundessteuer`],
      ["Konten außerhalb der USA", `FBAR bei mehr als ${SCHWELLEN.fbar} in Summe`],
      ["Wohnsitzland", "Steuererklärung und § 138 AO — unabhängig davon"],
      ["Mit FIAON Global", "Die erste jährliche US-Meldung ist im ersten Jahr enthalten"],
    ],
    kurz: `Eine LLC mit einem ausländischen Gesellschafter reicht jedes Jahr Form 5472 mit Pro-forma-Form 1120 ein (${IRS.frist5472}). Mit Einkünften aus Geschäft in den USA kommt Form 1040-NR (Person) oder Form 1120-F (GmbH) hinzu. Mehrere Gesellschafter geben Form 1065 ab, eine Corporation Form 1120. Bei Auslandskonten über ${SCHWELLEN.fbar} kommt der FBAR hinzu.`,
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "Die Übersicht: welche Erklärung wann",
        kopf: ["Struktur", "Erklärung", "Frist bei Kalenderjahr"],
        zeilen: [
          ["LLC mit einem ausländischen Gesellschafter, ohne Geschäft in den USA", "Form 5472 mit Pro-forma-Form 1120", IRS.frist5472],
          ["Dieselbe LLC mit Einkünften aus US-Geschäft, Gesellschafter ist eine Person", "zusätzlich Form 1040-NR des Gesellschafters", FRISTEN.f1040nr],
          ["Dieselbe LLC, Gesellschafterin ist eine GmbH", "zusätzlich Form 1120-F der GmbH", FRISTEN.f1120f],
          ["LLC mit mehreren Gesellschaftern", "Form 1065 mit Anteilsmitteilungen; Steuerabzug auf Anteile ausländischer Gesellschafter (Form 8804, 8805)", FRISTEN.f1065],
          ["Corporation, auch LLC mit Wahl nach Form 8832", `Form 1120, Bundessteuer ${IRS.koerperschaftsteuer}; dazu Form 5472 bei einem ausländischen Anteilseigner ab 25 %`, "15. April, mit Form 7004 verlängerbar bis 15. Oktober"],
          [`Jede US-Gesellschaft mit Auslandskonten über ${SCHWELLEN.fbar}`, "FBAR (FinCEN Form 114) — an FinCEN, nicht an die IRS", FRISTEN.fbar],
        ],
        fuss: ["Vereinfachte Übersicht nach den Anleitungen von IRS und FinCEN. Die Staaten verlangen je nach Tätigkeit eigene Erklärungen."],
      },
      {
        typ: "text", id: "geschaeft", h2: "Maßgeblich: Geschäft in den USA",
        absaetze: [
          "Die USA besteuern Ausländer vor allem auf Einkünfte, die mit einem Geschäft in den USA tatsächlich verbunden sind („effectively connected income“). Ob ein solches Geschäft vorliegt, entscheiden die Tatsachen: Personal, Büro oder Lager vor Ort, Vertreter mit Abschlussvollmacht, eine laufende Tätigkeit in den USA. Wer die Arbeit für US-Kunden vollständig in Europa erbringt, erzielt in der Regel keine solchen Einkünfte — wer dort ein Lager betreibt oder Mitarbeiter beschäftigt, meist schon.",
          "Das Doppelbesteuerungsabkommen zwischen Deutschland und den USA zieht eine zweite Grenze: Unternehmensgewinne dürfen die USA nur besteuern, soweit sie einer Betriebsstätte dort zuzurechnen sind (Art. 5 und 7). Ob das Abkommen im Einzelfall greift und welche Angaben die IRS dazu verlangt, klärt ein US-Steuerberater (CPA).",
        ],
      },
      {
        typ: "text", id: "einzel", h2: "Einzel-LLC ohne Geschäft in den USA",
        absaetze: [
          "Ein häufiger Fall bei Gründern aus Deutschland, Österreich und der Schweiz: Die LLC gehört einer Person und ist steuerlich nicht als eigenes Steuersubjekt eingeordnet. Einkünfte aus Geschäft in den USA hat sie nicht. Sie zahlt dann in den USA meist keine Bundessteuer auf den Gewinn. Erklären muss sie trotzdem: jedes Jahr Form 5472 mit einer Pro-forma-Form 1120, per Fax oder Post, nicht elektronisch.",
          `Meldepflichtig ist schon die Einlage bei der Gründung, dazu jede Entnahme und jedes Darlehen zwischen Ihnen und der Gesellschaft. Die Strafe für eine fehlende Meldung beträgt ${IRS.strafe5472}. Die Gesellschaft meldet unter ihrer EIN; für einen Gesellschafter ohne US-Steuernummer lässt die IRS eine Referenznummer zu.`,
        ],
      },
      {
        typ: "text", id: "mehrere", h2: "Mehrere Gesellschafter: die LLC als Personengesellschaft",
        absaetze: [
          `Hat die LLC zwei oder mehr Gesellschafter, gilt sie steuerlich als Personengesellschaft. Sie gibt Form 1065 ab und teilt jedem Gesellschafter seinen Anteil mit. Soweit ihr Gewinn mit Geschäft in den USA verbunden ist und auf ausländische Gesellschafter entfällt, behält sie Steuer ein und führt sie ab: ${SCHWELLEN.abzug1446} (Form 8804, 8805, 8813). Das gilt auch, wenn sie nichts ausschüttet.`,
          "Die Gesellschafter geben dann selbst eine US-Erklärung ab und rechnen die einbehaltene Steuer an. Die ITIN, die sie dafür brauchen, beantragt der Acceptance Agent seit Juni 2026 mit einem Auszug aus dem Gesellschaftsvertrag.",
        ],
      },
      {
        typ: "text", id: "corporation", h2: "Die Corporation",
        absaetze: [
          `Eine Corporation ist ein eigenes Steuersubjekt; dasselbe gilt für eine LLC, die nach Form 8832 wie eine Corporation behandelt werden will. Sie versteuert ihren Gewinn mit ${IRS.koerperschaftsteuer} auf Bundesebene; dazu kommt die Steuer des Staats, in Florida etwa ${STAAT.florida.steuer}.`,
          "Schüttet sie an einen Anteilseigner in Deutschland aus, begrenzt das Abkommen die US-Quellensteuer: 5 Prozent für Gesellschaften mit mindestens 10 Prozent der Stimmrechte, sonst 15 Prozent (Art. 10). Ausländische Anteilseigner ab 25 Prozent meldet die Corporation mit Form 5472 als Anlage zu ihrer Erklärung.",
        ],
      },
      {
        typ: "text", id: "fbar", h2: "Konten in Europa: der FBAR",
        absaetze: [
          `Eine US-Gesellschaft ist für das US-Recht eine US-Person — auch wenn sie Ihnen gehört und steuerlich transparent ist. Hält sie Konten außerhalb der USA, etwa ein Euro-Konto bei einem europäischen Institut, kann eine Meldepflicht entstehen. Liegt der Stand dieser Konten zusammen irgendwann im Jahr über ${SCHWELLEN.fbar}, meldet sie sie jährlich an FinCEN (FBAR, FinCEN Form 114). Frist ist der ${FRISTEN.fbar}.`,
          "Das betrifft gerade Gesellschaften, die Mittel aus den USA auf Konten in Europa übertragen. Wie solche Überweisungen und Investitionen steuerlich zu behandeln sind, gehört vor der ersten Überweisung geklärt. Das gilt auch für die Meldungen, die in den USA dadurch entstehen. Zuständig sind ein US-Steuerberater (CPA) und Ihr Steuerberater im Wohnsitzland.",
        ],
      },
      {
        typ: "text", id: "zuhause", h2: "Pflichten im Wohnsitzland",
        absaetze: [
          "Alles hier betrifft die USA. Unabhängig davon ist die Gesellschaft dort zu versteuern, wo sie geführt wird, und dem Finanzamt zu melden — in Deutschland nach § 138 AO. Welche Erklärungen im Wohnsitzland anfallen und wie eine in den USA gezahlte Steuer angerechnet wird, klärt Ihr Steuerberater; beide Seiten müssen zusammenpassen.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `Im ersten Jahr Ihres Mandats enthalten: der Pflichtenkalender und ${US_MELDUNG} (Form 5472 mit Form 1120).`,
          LAUFEND,
        ],
        punkte: [
          `${TEIL.ihrTeil}: Ihre Steuererklärung und die Meldung im Wohnsitzland liegen bei Ihnen und Ihrem Steuerberater.`,
          `${TEIL.bedingung}: Über die Besteuerung entscheiden die US-Steuerbehörde und das Finanzamt Ihres Wohnsitzlands.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die erste US-Meldung in Ihrem Mandat", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Diese Übersicht ersetzt nicht die Prüfung Ihres Falls durch einen US-Steuerberater (CPA) und Ihren Steuerberater im Wohnsitzland.",
        ],
      },
    ],
    fragen: [
      { f: "Muss meine LLC in den USA eine Steuererklärung abgeben?", a: "Ja, fast immer. Eine LLC mit einem ausländischen Gesellschafter reicht jedes Jahr Form 5472 mit einer Pro-forma-Form 1120 ein — auch ohne Umsatz. Mit Geschäft in den USA kommen weitere Erklärungen hinzu." },
      { f: "Zahlt meine LLC in den USA Steuern?", a: `Eine Einzel-LLC ohne Geschäft in den USA zahlt meist keine US-Bundessteuer auf den Gewinn. Mit Einkünften aus Geschäft in den USA wird der Gesellschafter dort steuerpflichtig, soweit das Abkommen es zulässt; eine Corporation zahlt ${IRS.koerperschaftsteuer} Bundessteuer.` },
      { f: "Wann ist die US-Steuererklärung meiner LLC fällig?", a: `Form 5472 mit Pro-forma-1120 am ${IRS.frist5472}. Form 1065 bei mehreren Gesellschaftern am ${FRISTEN.f1065}, Form 1040-NR ohne US-Löhne am 15. Juni.` },
      { f: "Muss meine LLC ihr Konto in Europa melden?", a: `Ja, wenn die Konten der Gesellschaft außerhalb der USA zusammen irgendwann im Jahr mehr als ${SCHWELLEN.fbar} erreichen: dann mit dem FBAR an FinCEN, bis ${FRISTEN.fbar}.` },
      { f: "Brauche ich für die US-Steuererklärung eine ITIN?", a: "Wer als Person eine eigene US-Erklärung abgibt, etwa Form 1040-NR, braucht eine ITIN oder SSN. Für Form 5472 genügt die EIN der Gesellschaft; für den Gesellschafter lässt die IRS eine Referenznummer zu." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-pflichten", "/business/wissen/form-5472", "/business/wissen/us-llc-steuern", "/business/wissen/tochter-oder-zweigniederlassung"],
    quellen: [Q.i5472, Q.i1120, Q.i1040nr, Q.i1065, Q.i1120f, Q.abzug1446, Q.fbar, Q.dba],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10 · TOCHTER ODER ZWEIGNIEDERLASSUNG — mit der GmbH in die USA
  {
    pfad: "/business/wissen/tochter-oder-zweigniederlassung",
    art: "wissen",
    seo: {
      titel: "Tochter oder Zweigniederlassung in den USA — FIAON Global",
      beschreibung: "Mit der GmbH in die USA: Zweigniederlassung, LLC oder Corporation als Tochter — Haftung, Steuern, Quellensteuer und Meldungen im Vergleich.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 39",
    auge: "Wissen · Struktur",
    h1: "Tochter oder Zweigniederlassung.",
    h1b: "Mit der GmbH in die USA.",
    lead: "Wer mit einem bestehenden Unternehmen in die USA geht, hat drei Wege: Die GmbH wird selbst dort tätig, sie gründet eine LLC oder eine Corporation als Tochter. Die Wahl bestimmt Haftung, Steuern in beiden Ländern und Meldungen.",
    ziffern: [
      { wert: "3 Wege", label: "Zweigniederlassung, LLC, Corporation" },
      { wert: "5 %", label: "Quellensteuer nach dem Abkommen ab 10 % der Stimmrechte" },
      { wert: IRS.koerperschaftsteuer, label: "Bundessteuer der US-Corporation" },
    ],
    blick: [
      ["Zweigniederlassung", "Die GmbH selbst in den USA — volle Haftung, Form 1120-F"],
      ["LLC als Tochter", "Haftung getrennt, steuerlich ohne Wahl transparent"],
      ["Corporation als Tochter", "Eigenes Steuersubjekt, Banken und Investoren vertraut"],
      ["Abkommen", "Quellensteuer auf Dividenden 5 %, unter Bedingungen keine"],
      ["Meldungen", "Form 5472, § 138 AO, bei der Zweigniederlassung auch BOI"],
      ["Steuerliche Einordnung", "Vor der Gründung, in beiden Ländern"],
      ["Mit FIAON Global", "Gründung einer LLC in einem Mandat — die Strukturfrage klären Sie vorab"],
    ],
    kurz: `Eine GmbH kann in den USA als Zweigniederlassung tätig werden oder eine Tochter gründen. Die Zweigniederlassung ist rechtlich die GmbH selbst und haftet voll. Eine LLC als Tochter trennt die Haftung, ist steuerlich aber ohne Wahl nach Form 8832 transparent. Eine Corporation als Tochter ist ein eigenes Steuersubjekt (${IRS.koerperschaftsteuer} Bundessteuer); auf Dividenden begrenzt das Doppelbesteuerungsabkommen die Quellensteuer.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Wege im Vergleich",
        kopf: ["", "Zweigniederlassung", "LLC als Tochter", "Corporation als Tochter"],
        zeilen: [
          ["Rechtlich", "die GmbH selbst, registriert im Bundesstaat", "eigene Gesellschaft", "eigene Gesellschaft"],
          ["Haftung", "die GmbH haftet voll", "auf die LLC beschränkt", "auf die Corporation beschränkt"],
          ["US-Steuer", "die GmbH mit Form 1120-F", "ohne Wahl: bei der GmbH (Form 1120-F); mit Wahl: wie eine Corporation", `eigene Erklärung, Form 1120, ${IRS.koerperschaftsteuer} Bund`],
          ["Gewinne an die GmbH", "Branch Profits Tax, durch das Abkommen begrenzt", "je nach Wahl wie Zweigniederlassung oder Corporation", "Quellensteuer auf Dividenden, durch das Abkommen begrenzt"],
          ["Meldung", "BOI-Meldung als ausländische Gesellschaft", "Form 5472 mit Pro-forma-1120", "Form 5472 als Anlage zur Form 1120"],
          ["Bei US-Instituten", "Antrag als ausländische Gesellschaft", "Antrag als US-Gesellschaft", "Antrag als US-Gesellschaft; bei Darlehen die übliche Form"],
        ],
        fuss: [
          "Vereinfachte Übersicht. Die Einordnung in Deutschland folgt dem Typenvergleich und kann von der US-Einordnung abweichen.",
          "Über Konto und Darlehen entscheidet das jeweilige Institut.",
        ],
      },
      {
        typ: "text", id: "zweig", h2: "Die Zweigniederlassung: ohne Haftungstrennung",
        absaetze: [
          `Die GmbH registriert sich im Bundesstaat als ausländische Gesellschaft („foreign qualification“) und wird dort unter eigenem Namen tätig. Der Aufwand der Einrichtung ist gering, aber alles liegt in der GmbH: Verträge, Haftung, Rechtsstreit in den USA. Die GmbH gibt jedes Jahr Form 1120-F ab — Frist ${FRISTEN.f1120f}.`,
          "Auf Gewinne der Zweigniederlassung, die nicht in den USA bleiben, erheben die USA die Branch Profits Tax von 30 Prozent. Das Abkommen begrenzt sie auf 5 Prozent und schließt sie für bestimmte Gesellschaften aus (Art. 10 Abs. 9 und 10). Und anders als eine US-Gesellschaft bleibt die GmbH als ausländische Gesellschaft mit Registrierung in einem Bundesstaat zur BOI-Meldung bei FinCEN verpflichtet.",
        ],
      },
      {
        typ: "text", id: "llc", h2: "LLC als Tochter: steuerlich transparent",
        absaetze: [
          `Gehört die LLC der GmbH, ist die Haftung getrennt: Gläubiger der LLC greifen nicht auf die GmbH durch, solange die Trennung gelebt wird. Steuerlich ist die LLC in den USA ohne Wahl kein eigenes Steuersubjekt. Ihre Gewinne aus US-Geschäft werden der GmbH zugerechnet; diese gibt dann Form 1120-F ab, als hätte sie eine Zweigniederlassung. Jedes Jahr kommt Form 5472 mit Pro-forma-1120 hinzu. ${STAAT.florida.llcSteuer}`,
          "Mit Form 8832 kann die LLC wählen, wie eine Corporation behandelt zu werden. In Deutschland entscheidet unabhängig davon der Typenvergleich; fällt die Einordnung in beiden Ländern auseinander, greifen eigene Regeln. Diese Frage gehört vor die Gründung.",
        ],
      },
      {
        typ: "text", id: "corp", h2: "Corporation als Tochter: eigenes Steuersubjekt",
        absaetze: [
          `Die Corporation ist ein eigenes Steuersubjekt: Sie versteuert ihren Gewinn mit ${IRS.koerperschaftsteuer} Bundessteuer zuzüglich der Steuer des Staats. Sie gibt Form 1120 ab, mit Form 5472 für die GmbH als Anteilseignerin. US-Instituten und Investoren ist diese Form vertraut; für Darlehen, Leasing und größere Rahmen ist sie oft die übliche. Über jedes Darlehen entscheidet das jeweilige Institut.`,
          "Schüttet die Corporation an die GmbH aus, begrenzt das Abkommen die US-Quellensteuer auf 5 Prozent, wenn die GmbH mindestens 10 Prozent der Stimmrechte hält. Sie entfällt, wenn die GmbH seit zwölf Monaten mindestens 80 Prozent der Stimmrechte hält und die Voraussetzungen der Missbrauchsklausel erfüllt (Art. 10 Abs. 3, Art. 28). Wie die Dividende bei der GmbH in Deutschland zu behandeln ist, regelt § 8b KStG — die Einzelheiten klärt der Steuerberater.",
        ],
      },
      {
        typ: "text", id: "verrechnung", h2: "Verrechnungspreise zwischen GmbH und Tochter",
        absaetze: [
          "Liefert die GmbH Waren, Software oder Leistungen an die Tochter, müssen die Preise so gestaltet sein, wie fremde Dritte sie vereinbaren würden. Beide Länder prüfen das — die USA nach eigenen Regeln, Deutschland nach dem Fremdvergleichsgrundsatz (§ 1 AStG); das Protokoll zum Abkommen verweist auf die Leitlinien der OECD. Jede dieser Zahlungen meldet die Tochter zudem auf Form 5472.",
          "Eine Dokumentation von Anfang an beugt Auseinandersetzungen in beiden Ländern vor.",
        ],
      },
      {
        typ: "etappen", id: "entscheidung", h2: "Fünf Kriterien für die Entscheidung",
        etappen: [
          { titel: "Tätigkeit in den USA", text: "Vertrieb aus Europa, eigene Mitarbeiter in den USA, Lager, Projekte, Investoren — je mehr in den USA stattfindet, desto eher kommt eine eigene Tochter in Betracht." },
          { titel: "Risiko und Haftung", text: "Verträge und Haftung in den USA gehören in eine eigene Gesellschaft, wenn sie die GmbH gefährden könnten." },
          { titel: "Verwendung der Gewinne", text: "Bleiben sie in den USA, zählt die Steuer dort; fließen sie zurück, zählen Quellensteuer und Abkommen." },
          { titel: "Investoren und Darlehen", text: "US-Investoren setzen meist eine Corporation voraus; bei größeren Darlehen erwarten Institute sie oft ebenfalls." },
          { titel: "Steuerliche Einordnung in beiden Ländern", text: "Ihr Steuerberater und ein US-Steuerberater (CPA) prüfen die Struktur gemeinsam, bevor gegründet wird." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Ihr Mandat sieht die Gründung einer LLC vor. Soll Ihre GmbH die Anteile halten oder kommt für Ihr Vorhaben eine Corporation in Betracht, stimmen wir das vorab im Gespräch mit Ihnen ab.",
          `${weitererSatz("UEBERGANG-EINREICHUNG")} ${UNTERLAGEN.satz}`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: Die Strukturentscheidung treffen Sie mit Ihrem Steuerberater und einem US-Steuerberater (CPA), bevor gegründet wird.`,
          `${TEIL.bedingung}: ${satz("S3")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Ein Mandat — auch für Unternehmen", lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Die Haftungstrennung einer Tochter setzt voraus, dass sie gelebt wird: eigene Konten, eigene Verträge, eigene Buchführung.",
          KARTEN_HAFTUNG,
        ],
      },
    ],
    fragen: [
      { f: "Soll meine GmbH in den USA eine LLC oder eine Corporation gründen?", a: "Für Vertrieb und kleinere Vorhaben reicht oft die LLC: Sie trennt die Haftung, ist steuerlich aber ohne Wahl transparent. Investoren und, bei größeren Darlehen, Institute erwarten meist eine Corporation; sie ist auch für Gewinne, die in den USA bleiben sollen, oft die klarere Form. Die Entscheidung gehört vor die Gründung — mit Ihrem Steuerberater und einem US-Steuerberater (CPA)." },
      { f: "Was ist der Unterschied zwischen Tochtergesellschaft und Zweigniederlassung in den USA?", a: "Die Zweigniederlassung ist die GmbH selbst, tätig in den USA — sie haftet voll. Die Tochter ist eine eigene US-Gesellschaft mit eigener Haftung, eigener Steuer und eigenen Meldungen." },
      { f: "Wie hoch ist die US-Quellensteuer auf Dividenden an eine GmbH?", a: "Nach dem Abkommen 5 Prozent, wenn die GmbH mindestens 10 Prozent der Stimmrechte hält, sonst 15 Prozent. Hält sie seit zwölf Monaten mindestens 80 Prozent und erfüllt sie die Bedingungen der Missbrauchsklausel, fällt keine Quellensteuer an." },
      { f: "Muss eine Zweigniederlassung in den USA eine BOI-Meldung abgeben?", a: "Ja. Befreit sind seit August 2026 nur Gesellschaften, die in den USA gegründet wurden; eine GmbH, die sich in einem Bundesstaat registriert, bleibt als ausländische Gesellschaft meldepflichtig." },
      { f: "Muss ich die US-Tochter dem Finanzamt melden?", a: "Ja. Gründung oder Erwerb einer Beteiligung an einer ausländischen Gesellschaft sind in Deutschland nach § 138 AO anzuzeigen — zusammen mit der Steuererklärung." },
    ],
    paket: "global_kapital",
    weiter: ["/business/tochtergesellschaft-usa", "/business/wissen/llc-oder-corporation", "/business/wissen/llc-steuererklaerung", "/business/aus-deutschland"],
    quellen: [Q.dba, Q.i1120f, Q.i5472, Q.f8832, Q.boi, Q.ao138, Q.astg1, Q.kstg8b],
  },
];
