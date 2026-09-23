// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: GRÜNDUNG, STEUERNUMMERN, PRÄSENZ, STEUERN, STRUKTUR
// (23.09.2026, E-231)
//
// Justin (23.09.2026): „schreibe 10 neue Ratgeber perfekt zu diesem Thema …
// 100% SEO optimiert … HIGH END" und dazu: „du musst dabei immer FIAON als die
// Lösung nennen". Sechs der zehn Beiträge stehen hier, die vier zu Konto,
// Bonität und Karten in wissen-konto-karten.ts.
//
// Jeder Beitrag beantwortet eine Suchfrage vollständig — mit den Wegen der
// Behörden, Zahlen aus fakten.ts (eine Quelle, geprüft am 23.09.2026) und den
// ehrlichen Grenzen. Und jeder zeigt, wie FIAON Global die Aufgabe übernimmt:
// ein Abschnitt „So übernimmt FIAON Global …", das passende Paket, der Knopf.
// Die Wortgrenzen gelten unverändert (typen.ts): keine Zusage zu Konto, Karte
// oder Rahmen, kein Steuerversprechen, keine Frist mit Ziffer, Geld zurück nur
// mit seinen Bedingungen, der Kapital-Satz nur mit dem Steuersatz daneben.
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_GELD_ZURUECK, GLOBAL_INKLUSIVE, GLOBAL_KAPITAL_FREI, GLOBAL_LAUFEND, GLOBAL_PFLICHTHINWEIS,
  globalJahresbetreuungPreisText, globalPaket, globalPreisText,
} from "../fiaon-global";
import { EIN_WEG, FAKTEN_STAND, FRISTEN, IRS, MARKT, QUELLEN_STAATEN, QUELLEN_WISSEN as Q, SCHWELLEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";

const S = "2026-09-23";
const GELD_ZURUECK = `${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`;
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;
const STRUKTUR_DAUER = globalPaket("global_struktur")?.de.dauerKurz ?? "";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const WISSEN_GRUENDUNG: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1 · LLC GRÜNDEN — der Pfeiler: alle zehn Schritte in Reihenfolge
  {
    pfad: "/business/wissen/llc-gruenden",
    art: "wissen",
    seo: {
      titel: "LLC gründen aus Deutschland: die Anleitung — FIAON Global",
      beschreibung: "US-LLC aus Deutschland, Österreich oder der Schweiz gründen: zehn Schritte von der Prüfung bis zur Form 5472 — mit Kosten, Unterlagen und Fristen.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 30",
    auge: "Wissen · Gründung",
    h1: "Eine LLC gründen.",
    h1b: "Schritt für Schritt, aus Deutschland.",
    lead: "Eine US-LLC lässt sich vollständig aus dem Ausland gründen — ohne Wohnsitz in den USA, ohne Reise, ohne Mindestkapital. Die Einreichung beim Bundesstaat ist dabei der kleinste Teil. Hier stehen alle zehn Schritte in der richtigen Reihenfolge: was jeder kostet, wer ihn erledigt und wo die meisten Gründer hängen bleiben.",
    ziffern: [
      { wert: "10 Schritte", label: "von der Prüfung bis zur ersten US-Meldung" },
      { wert: `${STAAT.wyoming.gruendung} – ${STAAT.florida.gruendung}`, label: "Gründungsgebühr des Bundesstaats" },
      { wert: "kein", label: "Mindestkapital, kein Notar, keine Reise" },
    ],
    blick: [
      ["Voraussetzung", "Pass, Wohnanschrift, ein klares Vorhaben — kein US-Wohnsitz"],
      ["Reihenfolge", "Prüfung, Staat, Gründung, EIN, Konto"],
      ["Staatsgebühr", `Florida ${STAAT.florida.gruendung}, Delaware ${STAAT.delaware.gruendung}, Wyoming ${STAAT.wyoming.gruendung}`],
      ["Pflicht in den USA", "Registered Agent, Jahresmeldung im Staat, Form 5472"],
      ["Pflicht zu Hause", "Meldung nach § 138 AO, Steuer am Ort der Geschäftsleitung"],
      ["Seit August 2026", "Keine BOI-Meldung mehr für US-Gesellschaften"],
      ["Mit FIAON Global", "Alle zehn Schritte aus einer Hand, zum Festpreis"],
    ],
    kurz: `Eine US-LLC gründen Sie aus Deutschland in zehn Schritten: steuerliche Prüfung zu Hause, Rechtsform, Bundesstaat, Name, Registered Agent, Einreichung beim Staat, Operating Agreement, EIN bei der IRS, bei steuerlichem Grund die ITIN, dann Konto und Pflichtenkalender. Die Gebühr des Staats liegt zwischen ${STAAT.wyoming.gruendung} (Wyoming) und ${STAAT.florida.gruendung} (Florida). Aufwendig sind nicht die Gebühren, sondern die Reihenfolge und die Pflichten danach — Form 5472 in jedem Jahr und die Meldung ans Finanzamt.`,
    bloecke: [
      {
        typ: "text", id: "vorab", h2: "Bevor Sie gründen: zwei Fragen",
        absaetze: [
          "Die erste Frage lautet nicht „Welcher Staat?“, sondern: Was soll die Gesellschaft tun? Verträge mit US-Kunden, Verkauf über US-Marktplätze, ein Konto in US-Dollar, eine eigene Kartenhistorie, der Aufbau von Kapital — je nach Antwort passen Rechtsform, Bundesstaat und Struktur anders.",
          "Die zweite Frage stellt Ihr Heimatland: Wo wird die Gesellschaft geführt? Wer sie von Deutschland, Österreich oder der Schweiz aus leitet, ist dort in der Regel steuerpflichtig. Diese Prüfung gehört vor die Gründung, nicht danach — sie entscheidet auch, ob die LLC Ihnen persönlich oder Ihrer GmbH gehören sollte.",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: "Die zehn Schritte",
        lead: "In dieser Reihenfolge — jeder Schritt setzt den vorigen voraus.",
        etappen: [
          { titel: "Vorhaben und steuerliche Prüfung", dauer: "vor allem anderen", text: "Klären Sie, was die Gesellschaft tun soll und wo sie geführt wird. Ein Steuerberater mit US-Erfahrung prüft, wie Ihr Heimatland die LLC einordnet (in Deutschland per Typenvergleich) und welche Meldungen anfallen." },
          { titel: "Rechtsform wählen", text: "Die LLC für Handel, Dienstleistung und eine eigene Kartenhistorie; die Corporation, wenn Investoren einsteigen sollen. Eine LLC kann einer Person gehören, mehreren oder Ihrer GmbH — jede Variante hat eigene Steuerfolgen." },
          { titel: "Bundesstaat wählen", text: "Wo findet das Geschäft statt, kommen Investoren, braucht es Termine vor Ort? Danach richtet sich die Wahl zwischen Florida, Delaware und Wyoming. Wer in einem weiteren Staat tätig wird, registriert sich dort zusätzlich." },
          { titel: "Namen prüfen", text: "Jeder Name wird im Staat nur einmal vergeben und trägt den Zusatz „LLC“ oder „Limited Liability Company“. Prüfen Sie ihn im Register des Staats und halten Sie zwei Ausweichnamen bereit." },
          { titel: "Registered Agent bestellen", text: "Jede LLC braucht im Gründungsstaat einen Registered Agent mit physischer Anschrift, der amtliche Post und Klagen entgegennimmt — ab dem ersten Tag und ohne Unterbrechung." },
          { titel: "Beim Bundesstaat einreichen", dauer: "online meist zügig", text: `Das Gründungsdokument geht mit der Gebühr an den Staat: in Florida die Articles of Organization (${STAAT.florida.gruendung}), in Delaware das Certificate of Formation (${STAAT.delaware.gruendung}), in Wyoming die Articles of Organization (${STAAT.wyoming.gruendung}). Mit der Eintragung besteht die Gesellschaft.` },
          { titel: "Operating Agreement aufsetzen", text: "Der Gesellschaftsvertrag regelt Beteiligung, Geschäftsführung, Gewinnverteilung und Nachfolge. Er wird nicht eingereicht, aber jedes Institut fragt danach — und seit dem 1. Juni 2026 auch die IRS, wenn ein ITIN-Antrag auf die Beteiligung an einer LLC mit mehreren Gesellschaftern gestützt wird." },
          { titel: "EIN beantragen", dauer: "per Fax etwa vier Werktage", text: "Die Steuernummer der Gesellschaft beantragen Sie mit Form SS-4 — ohne US-Sozialversicherungsnummer per Fax, Post oder Telefon, nicht online. Ohne EIN kein Konto, kein Kartenantrag, keine Form 5472." },
          { titel: "ITIN, wenn ein Grund vorliegt", text: "Die persönliche US-Steuernummer gibt es nur mit steuerlichem Grund (Form W-7). Für die EIN ist sie nicht nötig; für eine persönliche Kredithistorie in den USA oft schon." },
          { titel: "Konto, Pflichtenkalender, Meldung zu Hause", text: "Mit Gründungsdokument, EIN und Operating Agreement folgt der Kontoantrag. Danach beginnen die Pflichten: Jahresmeldung im Staat, Form 5472 bis zum 15. April, die Meldung ans Finanzamt nach § 138 AO." },
        ],
      },
      {
        typ: "tabelle", id: "kosten", h2: "Was die Gründung kostet",
        lead: "Die Gebühren der Staaten sind überschaubar. Die eigentlichen Kosten entstehen durch Agent, Verträge, Steuernummern und die jährliche Meldung — und durch Fehler in der Reihenfolge.",
        kopf: ["Posten", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Gründungsgebühr des Staats", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich an den Staat", STAAT.florida.jahr, STAAT.delaware.jahr, STAAT.wyoming.jahr],
          ["Registered Agent (Marktpreis)", MARKT.agent, MARKT.agent, MARKT.agent],
          ["EIN bei der IRS", "kostenlos", "kostenlos", "kostenlos"],
          ["Form 5472 durch einen US-CPA (Marktpreis)", MARKT.cpa5472, MARKT.cpa5472, MARKT.cpa5472],
        ],
        fuss: [
          `Stand ${FAKTEN_STAND}. Staatsgebühren nach den amtlichen Gebührenordnungen; Marktpreise sind veröffentlichte Preise mehrerer Anbieter, keine amtlichen Werte.`,
          "Bei FIAON Global sind Staatsgebühr, Registered Agent im ersten Jahr, beide Steuernummern und die erste Form 5472 im Festpreis enthalten.",
        ],
      },
      {
        typ: "text", id: "boi", h2: "Seit August 2026: keine BOI-Meldung mehr",
        absaetze: [
          "Bis 2025 galt: Jede neue US-Gesellschaft meldet der Behörde FinCEN ihre wirtschaftlich Berechtigten (Beneficial Ownership Information, BOI). Für Gesellschaften, die in den USA gegründet wurden, ist diese Pflicht entfallen — endgültig mit der Regel, die am 14. August 2026 in Kraft trat.",
          "Melden müssen nur noch ausländische Gesellschaften, die sich für Geschäfte in einem Bundesstaat registrieren — etwa eine GmbH mit Zweigniederlassung in den USA. Für eine LLC, die Sie in Florida, Delaware oder Wyoming gründen, fällt die Meldung weg. Wer noch mit Strafen für eine versäumte BOI-Meldung wirbt, arbeitet mit einem veralteten Stand.",
        ],
      },
      {
        typ: "karten", id: "fehler", h2: "Die sechs häufigsten Fehler", spalten: 3,
        karten: [
          { tag: "Fehler", titel: "Erst gründen, dann prüfen", text: "Die Steuerfrage zu Hause kommt nach der Gründung. Dann steht die Struktur schon — auch wenn die LLC unter der GmbH besser gepasst hätte." },
          { tag: "Fehler", titel: "Der günstigste Staat", text: "Wer in Florida tätig ist und in Wyoming gründet, registriert sich in Florida zusätzlich — und zahlt in beiden Staaten." },
          { tag: "Fehler", titel: "Die Agent-Anschrift als Sitz", text: "Viele Institute lehnen Konten ab, deren Geschäftsadresse die Anschrift eines Registered Agent oder ein Postfach ist." },
          { tag: "Fehler", titel: "Kein Operating Agreement", text: "Das Konto scheitert an einem Dokument, das vor der Gründung hätte stehen sollen: Wer ist beteiligt, wer darf handeln?" },
          { tag: "Fehler", titel: "Form 5472 vergessen", text: `Schon die Einlage bei der Gründung ist meldepflichtig. Die Strafe für eine fehlende Meldung: ${IRS.strafe5472}.` },
          { tag: "Fehler", titel: "Keine Meldung ans Finanzamt", text: "Gründung oder Beteiligung sind in Deutschland nach § 138 AO anzuzeigen — mit der nächsten Steuererklärung." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "Wie FIAON Global die zehn Schritte übernimmt",
        absaetze: [
          "Jeder Schritt ist für sich lösbar. Zusammen sind sie ein Projekt mit Behörden in zwei Ländern, drei Berufsgruppen und Fristen, die nichts verzeihen. FIAON Global macht daraus einen einzigen Auftrag: ein fester Ansprechpartner, ein Festpreis, ein Dokumentenraum, in dem jedes Papier liegt.",
          "Unser Team in Miami reicht die Gründung ein und stellt Registered Agent, US-Geschäftsadresse und Telefonnummer. Unser Partner-Anwalt setzt das Operating Agreement auf, unser Partner-Steuerberater prüft vor der Gründung die Folgen in Ihrem Heimatland, unser US-CPA erstellt die erste Form 5472. EIN und ITIN bereiten wir vor und reichen sie ein; den ersten Konto- und Kartenantrag bereiten wir vollständig vor.",
          GELD_ZURUECK,
        ],
        punkte: [...GLOBAL_INKLUSIVE.de],
        nach: `Global Struktur beginnt bei ${globalPreisText("global_struktur")}, einmalig — die Begleitung dauert in der Regel ${STRUKTUR_DAUER}.`,
      },
      { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Global Struktur deckt alle zehn Schritte ab — vom Startgespräch bis zur ersten Form 5472.", paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Eine LLC ersetzt kein Geschäftsmodell: Institute prüfen, was die Gesellschaft tut — nicht, wo sie eingetragen ist.",
        ],
      },
    ],
    fragen: [
      { f: "Kann ich als Deutscher eine LLC in den USA gründen?", a: "Ja. Eine LLC gründen Sie vollständig aus Deutschland — ohne US-Wohnsitz, ohne Reise, ohne Mindestkapital und ohne US-Staatsbürgerschaft. Nötig sind ein Registered Agent im Gründungsstaat und die Gebühr des Staats." },
      { f: "Was kostet es, eine LLC zu gründen?", a: `Die Gebühr des Staats beträgt in Wyoming ${STAAT.wyoming.gruendung}, in Delaware ${STAAT.delaware.gruendung} und in Florida ${STAAT.florida.gruendung}. Dazu kommen Registered Agent, Operating Agreement und jedes Jahr Staatsgebühr und Form 5472. Bei FIAON Global ist das erste Jahr im Festpreis ab ${globalPreisText("global_struktur")} enthalten.` },
      { f: "Wie lange dauert die Gründung einer LLC?", a: `Die Eintragung beim Staat geht online meist zügig. Länger dauern EIN (${IRS.einDauer}), ITIN und Kontoantrag. Mit FIAON Global dauert die Begleitung bis zum ersten Konto- und Kartenantrag in der Regel ${STRUKTUR_DAUER}.` },
      { f: "Brauche ich für die LLC eine US-Adresse?", a: "Die LLC braucht einen Registered Agent mit Anschrift im Gründungsstaat. Für Konto und Verträge braucht sie zusätzlich eine Geschäftsadresse; die Anschrift des Agent reicht vielen Instituten dafür nicht." },
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
      beschreibung: "EIN für Ihre LLC ohne SSN beantragen: Form SS-4 Zeile für Zeile, Fax, Post oder Telefon, Dauer und die typischen Fehler — Stand September 2026.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 31",
    auge: "Wissen · Steuernummer",
    h1: "Die EIN beantragen.",
    h1b: "Ohne Sozialversicherungsnummer.",
    lead: "Die EIN ist die Steuernummer Ihrer US-Gesellschaft — ohne sie kein Konto, kein Kartenantrag, keine Meldung an die IRS. Der Online-Antrag bleibt Gründern ohne US-Sozialversicherungsnummer verschlossen. So kommen Sie trotzdem an die Nummer: mit Form SS-4, per Fax, Post oder Telefon.",
    ziffern: [
      { wert: "kostenlos", label: "die EIN selbst kostet bei der IRS nichts" },
      { wert: "etwa 4 Werktage", label: "per Fax, per Post etwa vier Wochen" },
      { wert: "9 Ziffern", label: "im Format 12-3456789" },
    ],
    blick: [
      ["Was", "Employer Identification Number — die Steuernummer der Gesellschaft"],
      ["Wann", "Nach der Eintragung beim Bundesstaat"],
      ["Formular", "Form SS-4, unterschrieben für die Gesellschaft"],
      ["Wege ohne SSN", "Fax, Post oder Telefon — nicht online"],
      ["Dauer", gross(IRS.einDauer)],
      ["Kosten", "Bei der IRS kostenlos"],
      ["Mit FIAON Global", "Vorbereitet, eingereicht, verfolgt — im Festpreis"],
    ],
    kurz: `Ohne US-Sozialversicherungsnummer beantragen Sie die EIN mit Form SS-4 per Fax, per Post oder — nur für Antragsteller aus dem Ausland — telefonisch bei der IRS. Voraussetzung ist die eingetragene Gesellschaft. In Zeile 7b steht „foreign“ oder „N/A“, wenn die verantwortliche Person weder SSN noch ITIN hat; eine LLC mit einem ausländischen Gesellschafter vermerkt in Zeile 9a „${EIN_WEG.zeile9a}“. Die Dauer: ${IRS.einDauer}.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "Was die EIN ist — und wofür Sie sie brauchen",
        absaetze: [
          "Die Employer Identification Number ist die Steuernummer einer US-Gesellschaft: neun Ziffern, vergeben von der US-Steuerbehörde IRS. Trotz ihres Namens braucht sie nicht nur, wer Mitarbeiter beschäftigt. Institute verlangen sie für jedes Geschäftskonto, Kartenherausgeber für jeden Antrag, und ohne sie lässt sich Form 5472 nicht einreichen.",
          "Eine LLC mit einem einzigen ausländischen Gesellschafter braucht die EIN schon deshalb, weil sie jedes Jahr Form 5472 abgeben muss — unter ihrem eigenen Namen und ihrer eigenen EIN.",
        ],
      },
      {
        typ: "text", id: "online", h2: "Warum der Online-Antrag nicht geht",
        absaetze: [
          "Die IRS bietet einen Online-Antrag an, der die Nummer sofort ausgibt. Er setzt aber voraus, dass die verantwortliche Person eine gültige SSN oder ITIN hat. Gründer aus Deutschland, Österreich oder der Schweiz haben in aller Regel keine von beiden — für sie bleiben Fax, Post und Telefon.",
          "Eine ITIN eigens für die EIN zu beantragen, lohnt sich nicht: Die EIN lässt sich ohne ITIN beantragen, und die ITIN braucht einen eigenen steuerlichen Grund.",
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
        typ: "tabelle", id: "zeilen", h2: "Form SS-4: die Zeilen, auf die es ankommt",
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
        karten: [
          { tag: "Fax", titel: "Etwa vier Werktage", text: `Aus dem Ausland an ${EIN_WEG.faxAusland}. Geben Sie eine Faxnummer für die Antwort an — so kommt die Nummer auf demselben Weg zurück.` },
          { tag: "Post", titel: "Etwa vier Wochen", text: `An ${EIN_WEG.post}. Der langsamste Weg — und der mit den meisten verlorenen Wochen, wenn eine Angabe fehlt.` },
          { tag: "Telefon", titel: "Nur für Antragsteller aus dem Ausland", text: `Unter ${EIN_WEG.telefon}, ${EIN_WEG.telefonZeit}. Anrufen darf, wer für die Gesellschaft unterschreiben darf oder als Designee befugt ist.` },
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
        typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global die EIN",
        absaetze: [
          "Bei FIAON Global ist die EIN Teil jedes Pakets. Wir füllen Form SS-4 aus, Sie unterschreiben, wir reichen ein und verfolgen den Antrag bis zur Nummer. Rückfragen der IRS klären wir mit Ihnen, das Schreiben der IRS liegt danach in Ihrem Dokumentenraum — und die EIN fließt sofort in den Kontoantrag und in den Pflichtenkalender Ihrer Gesellschaft.",
          GELD_ZURUECK,
        ],
      },
      { typ: "paket", id: "paket", h2: "Die EIN im Paket", lead: "Gesellschaft, EIN, ITIN und der erste Konto- und Kartenantrag — Global Struktur zum Festpreis.", paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die EIN ist eine Steuernummer, keine Genehmigung: Sie sagt nichts darüber, ob ein Institut ein Konto eröffnet.",
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Wer Form SS-4 unterschreibt, versichert die Richtigkeit der Angaben gegenüber der IRS — Schreibweisen und Zahlen müssen zum Gründungsdokument passen.",
        ],
      },
    ],
    fragen: [
      { f: "Kann ich eine EIN ohne SSN beantragen?", a: "Ja. Ohne SSN oder ITIN beantragen Sie die EIN mit Form SS-4 per Fax, per Post oder — als Antragsteller aus dem Ausland — telefonisch. Nur der Online-Antrag verlangt eine SSN oder ITIN." },
      { f: "Wie lange dauert es, eine EIN zu bekommen?", a: `${gross(IRS.einDauer)}. Am Telefon geht es am schnellsten, wenn alle Angaben bereitliegen.` },
      { f: "Kostet die EIN etwas?", a: "Bei der IRS nicht. Kosten entstehen nur, wenn Sie jemanden beauftragen — bei FIAON Global ist die EIN im Festpreis jedes Pakets enthalten." },
      { f: "Brauche ich eine ITIN, um eine EIN zu beantragen?", a: "Nein. Hat die verantwortliche Person weder SSN noch ITIN, steht in Zeile 7b der Form SS-4 „foreign“ oder „N/A“." },
      { f: "Was mache ich, wenn das EIN-Schreiben verloren ist?", a: "Die IRS bestätigt die Nummer auf Anfrage erneut (Letter 147C). Viele Institute akzeptieren diese Bestätigung anstelle des ursprünglichen Schreibens (CP 575)." },
    ],
    paket: "global_struktur",
    weiter: ["/business/ein-itin", "/business/wissen/itin-beantragen", "/business/wissen/llc-gruenden", "/business/wissen/us-bankkonto-unterlagen"],
    quellen: [Q.ss4, Q.ein, Q.smllc, Q.f8822b],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3 · ITIN BEANTRAGEN — Form W-7, der steuerliche Grund, der Pass
  {
    pfad: "/business/wissen/itin-beantragen",
    art: "wissen",
    seo: {
      titel: "ITIN beantragen aus Deutschland: Form W-7 — FIAON Global",
      beschreibung: "ITIN mit Form W-7 beantragen: wer sie braucht, welcher steuerliche Grund trägt, Pass und Acceptance Agent, Dauer und Verfall — Stand September 2026.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 32",
    auge: "Wissen · Steuernummer",
    h1: "Die ITIN beantragen.",
    h1b: "Nur mit steuerlichem Grund.",
    lead: "Die ITIN ist Ihre persönliche Steuernummer in den USA. Viele Anbieter verkaufen sie als Schlüssel zu Konto und Karten — die IRS vergibt sie aber nur für steuerliche Zwecke und nur mit Begründung. Wer das weiß, stellt einen Antrag, der durchgeht, statt einen, der nach Wochen zurückkommt.",
    ziffern: [
      { wert: "etwa 7 Wochen", label: "Bearbeitung; Hauptsaison und Ausland neun bis elf" },
      { wert: "Form W-7", label: "mit Pass und steuerlichem Grund" },
      { wert: "3 Jahre", label: "ohne Steuererklärung — dann verfällt sie" },
    ],
    blick: [
      ["Was", "Individual Taxpayer Identification Number — für Personen ohne SSN"],
      ["Wer", "Wer in den USA eine Steuererklärung abgeben muss oder eine Ausnahme nutzt"],
      ["Formular", "Form W-7, im Regelfall mit Steuererklärung"],
      ["Pass", "Original, Kopie der ausstellenden Behörde oder Prüfung durch einen CAA"],
      ["Dauer", "Etwa sieben Wochen, Hauptsaison und Ausland neun bis elf"],
      ["Verfall", "Nach drei Steuerjahren ohne Erklärung"],
      ["Mit FIAON Global", "Grund geprüft, Pass im Termin geprüft, Antrag verfolgt"],
    ],
    kurz: `Die ITIN beantragen Sie mit Form W-7 bei der IRS — im Regelfall zusammen mit einer US-Steuererklärung, ohne sie nur, wenn eine der fünf Ausnahmen der IRS greift. Sie brauchen einen steuerlichen Grund; für die EIN Ihrer Gesellschaft ist die ITIN nicht nötig. Den Pass schicken Sie im Original oder als beglaubigte Kopie der ausstellenden Behörde — oder ein Certifying Acceptance Agent prüft ihn und gibt ihn sofort zurück. Die Bearbeitung dauert ${IRS.itinDauer}.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "Was die ITIN ist — und was nicht",
        absaetze: [
          "Die Individual Taxpayer Identification Number vergibt die IRS an Personen, die in den USA steuerlich erfasst werden müssen, aber keine Sozialversicherungsnummer bekommen können. Sie hat neun Ziffern, beginnt mit einer 9 und dient allein steuerlichen Zwecken.",
          "Eine ITIN ist keine Arbeitserlaubnis, kein Aufenthaltstitel und kein Anspruch auf Leistungen der US-Sozialversicherung. Außerhalb des Steuerrechts ist sie auch kein Ausweis.",
        ],
      },
      {
        typ: "text", id: "grund", h2: "Der steuerliche Grund entscheidet",
        absaetze: [
          "Die IRS verlangt mit jedem Antrag einen Grund. Der Regelfall: Sie reichen Form W-7 zusammen mit einer US-Steuererklärung ein — etwa, weil Sie als Gesellschafter einer LLC Einkünfte aus Geschäft in den USA erklären müssen. Ohne Steuererklärung geht es nur, wenn eine der fünf Ausnahmen der IRS greift.",
          "Eine davon betrifft Gesellschafter einer Personengesellschaft — dazu zählt steuerlich auch die LLC mit mehreren Gesellschaftern —, die in den USA Vermögen hält, dessen Erträge meldepflichtig sind und dem Steuerabzug unterliegen. Seit dem 1. Juni 2026 legt ein Acceptance Agent solchen Anträgen den Teil des Gesellschaftsvertrags bei, der Name und EIN der Gesellschaft sowie Name und Unterschrift des Antragstellers zeigt.",
          "Für die Kreditwürdigkeit allein vergibt die IRS keine ITIN. Ein Antrag, der sich darauf stützt, kommt zurück — und kostet Wochen.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "So läuft der Antrag ab",
        etappen: [
          { titel: "Grund klären", text: "Ein US-CPA prüft, welche Steuererklärung oder welche Ausnahme den Antrag trägt. Ohne tragfähigen Grund kein Antrag." },
          { titel: "Form W-7 ausfüllen", text: "Den Grund ankreuzen — für Ausländer mit US-Steuererklärung ist das meist „b“ —, Name wie im Pass, Anschrift im Ausland, Geburtsdaten, Passdaten. Bei einer Ausnahme gehören ihre Nachweise dazu." },
          { titel: "Pass prüfen lassen", text: "Der Pass allein genügt als Nachweis für Identität und Staatsangehörigkeit. Er geht im Original oder als von der ausstellenden Behörde beglaubigte Kopie an die IRS — oder ein Certifying Acceptance Agent prüft ihn persönlich und gibt ihn sofort zurück." },
          { titel: "Einreichen", text: "Mit Steuererklärung oder Nachweis der Ausnahme an die ITIN-Stelle der IRS in Austin, Texas — oder über den Acceptance Agent." },
          { titel: "Bescheid", dauer: "etwa sieben Wochen", text: "Die IRS teilt die Nummer schriftlich mit (CP 565). Zwischen Mitte Januar und Ende April und bei Anträgen aus dem Ausland dauert es neun bis elf Wochen." },
        ],
      },
      {
        typ: "tabelle", id: "pass", h2: "Der Pass: drei Wege",
        kopf: ["Weg", "Was Sie tun", "Ihr Pass"],
        zeilen: [
          ["Original per Post", "Pass mit dem Antrag an die IRS schicken", "ist für die Dauer der Prüfung unterwegs"],
          ["Beglaubigte Kopie", "Kopie, beglaubigt von der Behörde, die den Pass ausgestellt hat", "bleibt bei Ihnen"],
          ["Certifying Acceptance Agent", "Termin beim CAA, der den Pass prüft und den Antrag einreicht", "geht sofort zurück"],
        ],
        fuss: [
          "Eine notariell beglaubigte Kopie genügt der IRS nicht — beglaubigen muss die ausstellende Behörde.",
          `Acceptance Agents berechnen für Prüfung und Einreichung ${MARKT.acceptanceAgent} (Marktpreis, ${FAKTEN_STAND}).`,
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
        typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global die ITIN",
        absaetze: [
          "In jedem Paket von FIAON Global ist der ITIN-Antrag enthalten — mit dem Schritt, den viele Anbieter auslassen: Unser US-CPA prüft zuerst, ob und mit welchem Grund der Antrag trägt. Ohne tragfähigen Grund stellen wir keinen Antrag, statt Ihren Pass wochenlang auf die Reise zu schicken.",
          "Der Certifying Acceptance Agent prüft Ihren Pass im Termin und gibt ihn sofort zurück. Wir reichen den Antrag mit allen Anlagen ein, verfolgen ihn bis zum Bescheid und legen ihn in Ihren Dokumentenraum — abgestimmt mit der EIN Ihrer Gesellschaft und dem ersten Kartenantrag.",
        ],
      },
      { typ: "paket", id: "paket", h2: "Die ITIN im Paket", lead: "Beide Steuernummern, Gesellschaft und erster Konto- und Kartenantrag — Global Struktur zum Festpreis.", paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die ITIN dient nur steuerlichen Zwecken. Wer sie beantragt, übernimmt die Pflichten, auf die sich der Antrag stützt — etwa eine jährliche US-Steuererklärung.",
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Eine ITIN ersetzt keine SSN: Für Arbeit und Sozialleistungen in den USA gelten eigene Regeln.",
        ],
      },
    ],
    fragen: [
      { f: "Brauche ich eine ITIN für meine LLC?", a: "Für die EIN der Gesellschaft nicht. Eine ITIN brauchen Sie persönlich, wenn Sie in den USA eine Steuererklärung abgeben müssen oder eine der Ausnahmen der IRS greift." },
      { f: "Wie lange dauert es, eine ITIN zu bekommen?", a: `${gross(IRS.itinDauer)}.` },
      { f: "Muss ich für die ITIN meinen Pass aus der Hand geben?", a: "Nicht zwingend. Statt des Originals geht eine von der ausstellenden Behörde beglaubigte Kopie, oder ein Certifying Acceptance Agent prüft den Pass und gibt ihn sofort zurück." },
      { f: "Kann ich eine ITIN nur für eine Kreditkarte beantragen?", a: "Nein. Die IRS vergibt ITINs nur für steuerliche Zwecke; der Antrag braucht eine Steuererklärung oder eine Ausnahme. Manche Kartenherausgeber fragen nach der ITIN — über die Karte entscheiden sie trotzdem selbst." },
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
    erschienen: S,
    kennung: "FG · 33",
    auge: "Wissen · US-Präsenz",
    h1: "Registered Agent und Adresse.",
    h1b: "Die US-Präsenz Ihrer Gesellschaft.",
    lead: "Jede LLC braucht vom ersten Tag an einen Registered Agent im Gründungsstaat — das ist Gesetz. Für Konto, Karten und Verträge braucht sie mehr: eine Geschäftsadresse, die ein Institut akzeptiert, und eine Telefonnummer, unter der jemand erreichbar ist. Drei Dinge, die oft verwechselt werden.",
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
      ["Mit FIAON Global", "Agent, Adresse und Nummer im ersten Jahr inklusive"],
    ],
    kurz: "Der Registered Agent ist die Stelle, an die Gerichte und Behörden im Gründungsstaat Klagen und amtliche Schreiben zustellen. Er braucht eine physische Anschrift in diesem Staat und muss zu Geschäftszeiten erreichbar sein; jeder Bundesstaat schreibt ihn vor. Seine Anschrift ist aber keine Geschäftsadresse: Für Konto und Karten verlangen Institute eine Adresse, an der die Gesellschaft tatsächlich erreichbar ist — ein Postfach reicht dafür meist nicht.",
    bloecke: [
      {
        typ: "text", id: "agent", h2: "Was der Registered Agent tut",
        absaetze: [
          "In den USA wird eine Klage nicht per Post zugestellt, sondern persönlich übergeben — „service of process“. Damit das bei einer Gesellschaft ohne Büro im Staat funktioniert, verlangt jeder Bundesstaat einen Registered Agent: eine Person oder ein Unternehmen mit Anschrift im Staat, das Klagen, Schreiben der Behörden und Fristen entgegennimmt und unverzüglich weitergibt.",
          "Florida verlangt ihn in § 605.0113 der Florida Statutes, Delaware im Limited Liability Company Act, Wyoming mit physischer Anschrift im Staat. Der Agent steht mit Name und Anschrift im öffentlichen Register.",
          "Selbst Agent sein kann nur, wer im Staat wohnt oder dort ein Büro hat, das zu Geschäftszeiten besetzt ist. Für Gründer aus Europa ist ein gewerblicher Agent der Regelfall.",
        ],
      },
      {
        typ: "tabelle", id: "drei", h2: "Drei Anschriften, drei Aufgaben",
        kopf: ["", "Registered Agent", "Geschäftsadresse", "Postanschrift"],
        zeilen: [
          ["Wozu", "Klagen und amtliche Post", "Sitz der Gesellschaft für Institute und Kunden", "Briefe der IRS und der Staaten"],
          ["Pflicht", "ja, im Gründungsstaat", "für Konto und Verträge faktisch ja", "ja, in Form SS-4"],
          ["Wo", "im Gründungsstaat, physisch", "wo die Gesellschaft tätig ist", "wo die Post Sie sicher erreicht"],
          ["Öffentlich", "ja, im Register", "meist ja", "nein"],
          ["Typischer Fehler", "Agent gekündigt, Staat nicht informiert", "Agent-Anschrift oder Postfach als Sitz", "Briefe der IRS gehen ins Leere"],
        ],
      },
      {
        typ: "text", id: "institute", h2: "Warum Institute eine echte Adresse wollen",
        absaetze: [
          "US-Institute müssen die Identität jedes Kunden feststellen. Für Gesellschaften gehört dazu eine Anschrift: der Hauptsitz, ein örtliches Büro oder ein anderer physischer Ort der Geschäftstätigkeit (31 CFR 1020.220). Eine Adresse, unter der Hunderte Gesellschaften gemeldet sind, beantwortet diese Frage nicht.",
          "Deshalb lehnen viele Institute Konten ab, deren Geschäftsadresse die Anschrift eines Registered Agent, ein Postfach oder ein reiner Briefkasten ist. Andere akzeptieren eine Geschäftsadresse im Ausland, wenn sie zum Geschäft passt. Welche Adresse genügt, legt jedes Institut selbst fest.",
        ],
      },
      {
        typ: "text", id: "telefon", h2: "Die Telefonnummer",
        absaetze: [
          "Kartenherausgeber und Institute rufen an — zur Bestätigung eines Antrags, bei Rückfragen, bei ungewöhnlichen Zahlungen. Eine US-Nummer, die ins Leere läuft oder nur eine Bandansage kennt, kostet Anträge. Die Nummer gehört zur Gesellschaft, ist erreichbar und lautet in allen Unterlagen gleich.",
        ],
      },
      {
        typ: "karten", id: "folgen", h2: "Wenn der Agent fehlt", spalten: 3,
        karten: [
          { tag: "Folge", titel: "Keine Zustellung", text: "Findet das Gericht keinen Agent, sehen viele Staaten die Zustellung über den Secretary of State vor. Wer davon nichts erfährt, verpasst Fristen — bis hin zum Urteil in Abwesenheit." },
          { tag: "Folge", titel: "Kein ordnungsgemäßer Status", text: "Ohne Agent ist die Gesellschaft beim Staat nicht mehr „in good standing“. Institute und Vertragspartner prüfen diesen Status." },
          { tag: "Folge", titel: "Auflösung von Amts wegen", text: "In Florida kann der Staat eine LLC ohne Registered Agent auflösen (§ 605.0714) — ebenso, wenn die Jahresmeldung fehlt: dann am vierten Freitag im September." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Den Agent wechseln",
        absaetze: [
          "Ein Wechsel ist jederzeit möglich: Der neue Agent erklärt sich bereit, die Gesellschaft meldet den Wechsel beim Staat — meist mit einem eigenen Formular und gegen Gebühr. Kündigen Sie den alten Agent erst, wenn der neue eingetragen ist; jede Lücke dazwischen ist eine Lücke in der Zustellung.",
          "Ändern sich Name oder Anschrift des Agent, muss das ebenfalls im Register stehen. In Florida muss die Änderung binnen dreißig Tagen gemeldet sein — sonst droht auch hier die Auflösung von Amts wegen (§ 605.0714).",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So löst FIAON Global die US-Präsenz",
        absaetze: [
          "Bei FIAON Global gehört die US-Präsenz zum Paket: Registered Agent, US-Geschäftsadresse und US-Telefonnummer sind im ersten Jahr im Festpreis enthalten — gestellt von unserem Team vor Ort und von Anfang an abgestimmt auf die Unterlagen für Konto und Karten. Amtliche Post und Fristen landen in Ihrem Dokumentenraum und im Pflichtenkalender Ihrer Gesellschaft.",
          GLOBAL_LAUFEND.de,
        ],
      },
      { typ: "paket", id: "paket", h2: "Die US-Präsenz im Paket", lead: "Agent, Adresse und Telefonnummer im ersten Jahr — mit Gründung und Steuernummern in Global Struktur.", paket: "global_struktur" },
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
      { f: "Was kostet ein Registered Agent?", a: `Am Markt ${MARKT.agent}. Bei FIAON Global sind Agent, US-Geschäftsadresse und Telefonnummer im ersten Jahr im Festpreis enthalten, danach in der Jahresbetreuung für ${globalJahresbetreuungPreisText("de")} im Jahr.` },
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
      beschreibung: "Pro-forma-1120, 1040-NR, 1065, 1120-F, FBAR: welche US-Erklärungen Ihre LLC je nach Struktur abgibt — mit Fristen und dem Blick auf das Abkommen.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 38",
    auge: "Wissen · Steuererklärung",
    h1: "Die US-Steuererklärung der LLC.",
    h1b: "Welche Formulare, welche Fristen.",
    lead: "„Meine LLC zahlt in den USA keine Steuern, also muss ich dort nichts erklären“ — dieser Satz kostet jedes Jahr Strafen. Welche Erklärungen eine LLC abgibt, hängt davon ab, wem sie gehört, wie sie eingeordnet ist und ob sie in den USA Geschäft betreibt. Hier steht die Übersicht, die fast jeder Gründer vermisst.",
    ziffern: [
      { wert: "15. April", label: "Frist für Form 5472 mit Form 1120" },
      { wert: IRS.koerperschaftsteuer, label: "Bundessteuer auf Gewinne einer Corporation" },
      { wert: "10.000 $", label: "Auslandskonten in Summe — ab dann gilt der FBAR" },
    ],
    blick: [
      ["Einzel-LLC ohne US-Geschäft", "Form 5472 mit Pro-forma-Form 1120"],
      ["Einzel-LLC mit US-Geschäft", "Dazu Form 1040-NR (Person) oder 1120-F (GmbH)"],
      ["Mehrere Gesellschafter", "Form 1065, Steuerabzug für ausländische Gesellschafter"],
      ["Corporation", `Form 1120, ${IRS.koerperschaftsteuer} Bundessteuer`],
      ["Konten außerhalb der USA", `FBAR ab ${SCHWELLEN.fbar} in Summe`],
      ["Heimatland", "Steuererklärung und § 138 AO — unabhängig davon"],
      ["Mit FIAON Global", "Erste Meldung durch unseren US-CPA im Festpreis"],
    ],
    kurz: `Welche US-Erklärungen eine LLC abgibt, hängt an drei Fragen: Wem gehört sie, wie ist sie eingeordnet, betreibt sie Geschäft in den USA? Eine LLC mit einem ausländischen Gesellschafter reicht jedes Jahr Form 5472 mit einer Pro-forma-Form 1120 ein (${IRS.frist5472}). Erzielt sie Einkünfte aus Geschäft in den USA, erklärt der Gesellschafter sie zusätzlich selbst — als Person mit Form 1040-NR, als GmbH mit Form 1120-F. Eine LLC mit mehreren Gesellschaftern gibt Form 1065 ab, eine Corporation Form 1120. Hält die Gesellschaft Konten außerhalb der USA mit zusammen mehr als ${SCHWELLEN.fbar}, kommt der FBAR hinzu.`,
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
        typ: "text", id: "geschaeft", h2: "Die entscheidende Frage: Geschäft in den USA?",
        absaetze: [
          "Die USA besteuern Ausländer vor allem auf Einkünfte, die mit einem Geschäft in den USA tatsächlich verbunden sind („effectively connected income“). Ob ein solches Geschäft vorliegt, entscheiden die Tatsachen: Personal, Büro oder Lager vor Ort, Vertreter mit Abschlussvollmacht, eine laufende Tätigkeit in den USA. Wer die Arbeit für US-Kunden vollständig in Europa erbringt, erzielt in der Regel keine solchen Einkünfte — wer dort ein Lager betreibt oder Mitarbeiter beschäftigt, meist schon.",
          "Das Doppelbesteuerungsabkommen zwischen Deutschland und den USA zieht eine zweite Grenze: Unternehmensgewinne dürfen die USA nur besteuern, soweit sie einer Betriebsstätte dort zuzurechnen sind (Art. 5 und 7). Ob das Abkommen im Einzelfall greift und welche Angaben die IRS dazu verlangt, klärt der US-CPA.",
        ],
      },
      {
        typ: "text", id: "einzel", h2: "Die Einzel-LLC ohne Geschäft in den USA",
        absaetze: [
          "Der häufigste Fall bei Gründern aus Deutschland, Österreich und der Schweiz: Die LLC gehört einer Person, ist steuerlich nicht als eigenes Steuersubjekt eingeordnet und hat keine Einkünfte aus Geschäft in den USA. Sie zahlt dann in den USA meist keine Bundessteuer auf den Gewinn — erklären muss sie trotzdem: jedes Jahr Form 5472 mit einer Pro-forma-Form 1120, per Fax oder Post, nicht elektronisch.",
          `Meldepflichtig ist schon die Einlage bei der Gründung, dazu jede Entnahme und jedes Darlehen zwischen Ihnen und der Gesellschaft. Die Strafe für eine fehlende Meldung beträgt ${IRS.strafe5472}. Die Gesellschaft meldet unter ihrer EIN; für einen Gesellschafter ohne US-Steuernummer lässt die IRS eine Referenznummer zu.`,
        ],
      },
      {
        typ: "text", id: "mehrere", h2: "Mehrere Gesellschafter: die LLC als Personengesellschaft",
        absaetze: [
          `Hat die LLC zwei oder mehr Gesellschafter, gilt sie steuerlich als Personengesellschaft. Sie gibt Form 1065 ab und teilt jedem Gesellschafter seinen Anteil mit. Soweit ihr Gewinn mit Geschäft in den USA verbunden ist und auf ausländische Gesellschafter entfällt, behält sie Steuer ein und führt sie ab — ${SCHWELLEN.abzug1446} (Form 8804, 8805, 8813) —, auch wenn sie nichts ausschüttet.`,
          "Die Gesellschafter geben dann selbst eine US-Erklärung ab und rechnen die einbehaltene Steuer an. Die ITIN, die sie dafür brauchen, beantragt der Acceptance Agent seit Juni 2026 mit einem Auszug aus dem Gesellschaftsvertrag.",
        ],
      },
      {
        typ: "text", id: "corporation", h2: "Die Corporation",
        absaetze: [
          `Eine Corporation — oder eine LLC, die nach Form 8832 wie eine Corporation behandelt werden will — ist ein eigenes Steuersubjekt. Sie versteuert ihren Gewinn mit ${IRS.koerperschaftsteuer} auf Bundesebene; dazu kommt die Steuer des Staats, in Florida etwa ${STAAT.florida.steuer}.`,
          "Schüttet sie an einen Anteilseigner in Deutschland aus, begrenzt das Abkommen die US-Quellensteuer: 5 Prozent für Gesellschaften mit mindestens 10 Prozent der Stimmrechte, sonst 15 Prozent (Art. 10). Ausländische Anteilseigner ab 25 Prozent meldet die Corporation mit Form 5472 als Anlage zu ihrer Erklärung.",
        ],
      },
      {
        typ: "text", id: "fbar", h2: "Konten in Europa: der FBAR",
        absaetze: [
          `Eine US-Gesellschaft ist für das US-Recht eine US-Person — auch wenn sie Ihnen gehört und steuerlich transparent ist. Hält sie Konten außerhalb der USA, etwa ein Euro-Konto bei einem europäischen Institut, und liegt deren Stand zusammen irgendwann im Jahr über ${SCHWELLEN.fbar}, meldet sie diese Konten jährlich an FinCEN (FBAR, FinCEN Form 114). Frist ist der ${FRISTEN.fbar}.`,
          `Das betrifft gerade Gesellschaften, die Kapital nach Europa bringen. ${KAPITAL_FREI} Zu dieser Klärung gehört auch, welche Meldungen in den USA dadurch entstehen.`,
        ],
      },
      {
        typ: "text", id: "zuhause", h2: "Und zu Hause?",
        absaetze: [
          "Alles hier betrifft die USA. Unabhängig davon ist die Gesellschaft dort zu versteuern, wo sie geführt wird, und dem Finanzamt zu melden — in Deutschland nach § 138 AO. Welche Erklärungen zu Hause anfallen und wie eine in den USA gezahlte Steuer angerechnet wird, klärt der Steuerberater; beide Seiten müssen zusammenpassen.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So hält FIAON Global Ihre Fristen",
        absaetze: [
          "In jedem Paket von FIAON Global erstellt unser US-CPA die erste jährliche US-Meldung — Form 5472 mit Form 1120 —, das Honorar ist im Festpreis enthalten. Jede Frist Ihrer Gesellschaft steht im Pflichtenkalender: Staat, Registered Agent, IRS und, wo nötig, der FBAR. Unser Partner-Steuerberater prüft vor der Gründung, welche Erklärungen zu Hause anfallen, damit beide Seiten von Anfang an zusammenpassen.",
          GLOBAL_LAUFEND.de,
        ],
      },
      { typ: "paket", id: "paket", h2: "Die erste US-Meldung im Paket", lead: "Gründung, Steuernummern, Pflichtenkalender und die erste Form 5472 durch unseren US-CPA — Global Struktur.", paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
          "Diese Übersicht ersetzt nicht die Prüfung Ihres Falls durch den US-CPA und Ihren Steuerberater zu Hause.",
        ],
      },
    ],
    fragen: [
      { f: "Muss meine LLC in den USA eine Steuererklärung abgeben?", a: "Ja, fast immer. Eine LLC mit einem ausländischen Gesellschafter reicht jedes Jahr Form 5472 mit einer Pro-forma-Form 1120 ein — auch ohne Umsatz. Mit Geschäft in den USA kommen weitere Erklärungen hinzu." },
      { f: "Zahlt meine LLC in den USA Steuern?", a: `Eine Einzel-LLC ohne Geschäft in den USA zahlt meist keine US-Bundessteuer auf den Gewinn. Mit Einkünften aus Geschäft in den USA wird der Gesellschafter dort steuerpflichtig, soweit das Abkommen es zulässt; eine Corporation zahlt ${IRS.koerperschaftsteuer} Bundessteuer.` },
      { f: "Wann ist die US-Steuererklärung meiner LLC fällig?", a: `Form 5472 mit Pro-forma-1120 am ${IRS.frist5472}. Form 1065 bei mehreren Gesellschaftern am ${FRISTEN.f1065}, Form 1040-NR ohne US-Löhne am 15. Juni.` },
      { f: "Muss meine LLC ihr Konto in Europa melden?", a: `Ja, wenn die Konten der Gesellschaft außerhalb der USA zusammen irgendwann im Jahr mehr als ${SCHWELLEN.fbar} erreichen: dann mit dem FBAR an FinCEN, bis ${FRISTEN.fbar}.` },
      { f: "Brauche ich für die US-Steuererklärung eine ITIN?", a: "Wer als Person eine eigene US-Erklärung abgibt — etwa Form 1040-NR —, braucht eine ITIN oder SSN. Für Form 5472 genügt die EIN der Gesellschaft; für den Gesellschafter lässt die IRS eine Referenznummer zu." },
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
      titel: "Tochter oder Zweigniederlassung in den USA? — FIAON Global",
      beschreibung: "Mit der GmbH in die USA: Zweigniederlassung, LLC oder Corporation als Tochter — Haftung, Steuern, Quellensteuer und Meldungen im Vergleich.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 39",
    auge: "Wissen · Struktur",
    h1: "Tochter oder Zweigniederlassung?",
    h1b: "Mit der GmbH in die USA.",
    lead: "Wer mit einem bestehenden Unternehmen in die USA geht, hat drei Wege: Die GmbH wird selbst dort tätig, sie gründet eine LLC oder eine Corporation als Tochter. Die Wahl entscheidet über Haftung, Steuern in beiden Ländern, Meldungen — und darüber, wie ernst US-Institute das Vorhaben nehmen.",
    ziffern: [
      { wert: "3 Wege", label: "Zweigniederlassung, LLC, Corporation" },
      { wert: "5 %", label: "Quellensteuer nach dem Abkommen ab 10 % der Stimmrechte" },
      { wert: IRS.koerperschaftsteuer, label: "Bundessteuer der US-Corporation" },
    ],
    blick: [
      ["Zweigniederlassung", "Die GmbH selbst in den USA — volle Haftung, Form 1120-F"],
      ["LLC als Tochter", "Haftung getrennt, steuerlich ohne Wahl transparent"],
      ["Corporation als Tochter", "Eigenes Steuersubjekt, Standard für Banken und Investoren"],
      ["Abkommen", "Quellensteuer auf Dividenden 5 %, unter Bedingungen keine"],
      ["Meldungen", "Form 5472, § 138 AO, bei der Zweigniederlassung auch BOI"],
      ["Prüfung", "Vor der Gründung, in beiden Ländern"],
      ["Mit FIAON Global", "Struktur geprüft, Tochter gegründet, Konto vorbereitet"],
    ],
    kurz: `Eine GmbH kann in den USA als Zweigniederlassung tätig werden oder eine Tochter gründen. Die Zweigniederlassung ist rechtlich die GmbH selbst: Sie haftet voll und erklärt ihre US-Gewinne mit Form 1120-F. Eine LLC als Tochter trennt die Haftung, ist steuerlich aber ohne Wahl nach Form 8832 transparent — Gewinne aus US-Geschäft werden dann ebenfalls der GmbH zugerechnet. Eine Corporation als Tochter ist ein eigenes Steuersubjekt (${IRS.koerperschaftsteuer} Bundessteuer); auf Dividenden an die GmbH begrenzt das Doppelbesteuerungsabkommen die Quellensteuer auf 5 Prozent und lässt sie unter Bedingungen ganz entfallen.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Die drei Wege im Vergleich",
        kopf: ["", "Zweigniederlassung", "LLC als Tochter", "Corporation als Tochter"],
        zeilen: [
          ["Rechtlich", "die GmbH selbst, registriert im Bundesstaat", "eigene Gesellschaft", "eigene Gesellschaft"],
          ["Haftung", "die GmbH haftet voll", "auf die LLC beschränkt", "auf die Corporation beschränkt"],
          ["US-Steuer", "die GmbH mit Form 1120-F", "ohne Wahl: bei der GmbH (Form 1120-F); mit Wahl: wie eine Corporation", `eigene Erklärung, Form 1120, ${IRS.koerperschaftsteuer} Bund`],
          ["Gewinne in die Heimat", "Branch Profits Tax, durch das Abkommen begrenzt", "je nach Wahl wie Zweigniederlassung oder Corporation", "Quellensteuer auf Dividenden, durch das Abkommen begrenzt"],
          ["Meldung", "BOI-Meldung als ausländische Gesellschaft", "Form 5472 mit Pro-forma-1120", "Form 5472 als Anlage zur Form 1120"],
          ["Bei US-Instituten", "Konto für eine ausländische Gesellschaft", "Konto für eine US-Gesellschaft", "Konto für eine US-Gesellschaft, bei Darlehen der Standard"],
        ],
        fuss: ["Vereinfachte Übersicht. Die Einordnung in Deutschland folgt dem Typenvergleich und kann von der US-Einordnung abweichen."],
      },
      {
        typ: "text", id: "zweig", h2: "Die Zweigniederlassung: schnell, aber ohne Schutzwand",
        absaetze: [
          `Die GmbH registriert sich im Bundesstaat als ausländische Gesellschaft („foreign qualification“) und wird dort unter eigenem Namen tätig. Das ist schnell eingerichtet, zieht aber alles in die GmbH: Verträge, Haftung, Rechtsstreit in den USA. Die GmbH gibt jedes Jahr Form 1120-F ab — Frist ${FRISTEN.f1120f}.`,
          "Auf Gewinne der Zweigniederlassung, die nicht in den USA bleiben, erheben die USA die Branch Profits Tax von 30 Prozent; das Abkommen begrenzt sie auf 5 Prozent und schließt sie für bestimmte Gesellschaften aus (Art. 10 Abs. 9 und 10). Und anders als eine US-Gesellschaft bleibt die GmbH als ausländische Gesellschaft mit Registrierung in einem Bundesstaat zur BOI-Meldung bei FinCEN verpflichtet.",
        ],
      },
      {
        typ: "text", id: "llc", h2: "Die LLC als Tochter: getrennte Haftung, transparente Steuer",
        absaetze: [
          `Gehört die LLC der GmbH, ist die Haftung getrennt: Gläubiger der LLC greifen nicht auf die GmbH durch, solange die Trennung gelebt wird. Steuerlich ist die LLC in den USA ohne Wahl kein eigenes Steuersubjekt — ihre Gewinne aus US-Geschäft werden der GmbH zugerechnet, die dann Form 1120-F abgibt, als hätte sie eine Zweigniederlassung. Jedes Jahr kommt Form 5472 mit Pro-forma-1120 hinzu. ${STAAT.florida.llcSteuer}`,
          "Mit Form 8832 kann die LLC wählen, wie eine Corporation behandelt zu werden. In Deutschland entscheidet unabhängig davon der Typenvergleich; fällt die Einordnung in beiden Ländern auseinander, greifen eigene Regeln. Diese Frage gehört vor die Gründung.",
        ],
      },
      {
        typ: "text", id: "corp", h2: "Die Corporation als Tochter: der Standard für Größeres",
        absaetze: [
          `Die Corporation ist ein eigenes Steuersubjekt: Sie versteuert ihren Gewinn mit ${IRS.koerperschaftsteuer} Bundessteuer zuzüglich der Steuer des Staats und gibt Form 1120 ab, mit Form 5472 für die GmbH als Anteilseignerin. US-Institute und Investoren kennen diese Form am besten — für Darlehen, Leasing und größere Rahmen ist sie oft der einfachste Weg.`,
          "Schüttet die Corporation an die GmbH aus, begrenzt das Abkommen die US-Quellensteuer: 5 Prozent, wenn die GmbH mindestens 10 Prozent der Stimmrechte hält; keine Quellensteuer, wenn sie seit zwölf Monaten mindestens 80 Prozent der Stimmrechte hält und die Voraussetzungen der Missbrauchsklausel erfüllt (Art. 10 Abs. 3, Art. 28). Wie die Dividende bei der GmbH in Deutschland zu behandeln ist, regelt § 8b KStG — die Einzelheiten klärt der Steuerberater.",
        ],
      },
      {
        typ: "text", id: "verrechnung", h2: "Verrechnungspreise: was zwischen GmbH und Tochter fließt",
        absaetze: [
          "Liefert die GmbH Waren, Software oder Leistungen an die Tochter, müssen die Preise so gestaltet sein, wie fremde Dritte sie vereinbaren würden. Beide Länder prüfen das — die USA nach eigenen Regeln, Deutschland nach dem Fremdvergleichsgrundsatz (§ 1 AStG); das Protokoll zum Abkommen verweist auf die Leitlinien der OECD. Jede dieser Zahlungen meldet die Tochter zudem auf Form 5472.",
          "Wer das von Anfang an dokumentiert, erspart sich Streit in zwei Ländern.",
        ],
      },
      {
        typ: "etappen", id: "entscheidung", h2: "So fällt die Entscheidung",
        etappen: [
          { titel: "Was soll in den USA passieren?", text: "Vertrieb aus Europa, eigenes Team vor Ort, Lager, Projekte, Investoren — je mehr in den USA stattfindet, desto eher lohnt eine eigene Tochter." },
          { titel: "Wer trägt das Risiko?", text: "Verträge und Haftung in den USA gehören in eine eigene Gesellschaft, wenn sie die GmbH gefährden könnten." },
          { titel: "Wohin fließen die Gewinne?", text: "Bleiben sie in den USA, zählt die Steuer dort; fließen sie zurück, zählen Quellensteuer und Abkommen." },
          { titel: "Wer soll später einsteigen?", text: "US-Investoren und größere Darlehen setzen meist eine Corporation voraus." },
          { titel: "Prüfung in beiden Ländern", text: "Steuerberater zu Hause und US-CPA prüfen die Struktur gemeinsam, bevor gegründet wird." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So baut FIAON Global Ihre US-Struktur",
        absaetze: [
          "Für ein Unternehmen ist die US-Gründung eine Strukturentscheidung, keine Formalie. FIAON Global beginnt deshalb mit der Prüfung: Unser Partner-Steuerberater klärt vor der Gründung, wie die Tochter in Deutschland eingeordnet wird und welche Meldungen anfallen; unser US-CPA schaut auf die US-Seite. Erst dann gründet unser Team in Miami die Gesellschaft — mit Gründungsunterlagen durch unseren Partner-Anwalt, EIN, Registered Agent, Adresse und Telefonnummer.",
          "Danach bereiten wir Konto und Karten der Tochter vor, führen ihren Pflichtenkalender und bauen mit Global Kapital die Historie und die Kennzahlen-Mappe auf, die eine US-Bank für ein Darlehen sehen will.",
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "Das Paket für Unternehmen", lead: "Gründung, Prüfung in beiden Ländern, Konto, Kartenleiter und die Unterlagen für ein Bankdarlehen — Global Kapital.", paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Eine Tochter ist nur so stark wie ihre Trennung von der GmbH: eigene Konten, eigene Verträge, eigene Buchführung.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Soll meine GmbH in den USA eine LLC oder eine Corporation gründen?", a: "Für Vertrieb und kleinere Vorhaben reicht oft die LLC: Sie trennt die Haftung, ist steuerlich aber ohne Wahl transparent. Für Investoren, größere Darlehen und Gewinne, die in den USA bleiben sollen, ist die Corporation meist die klarere Form. Die Entscheidung gehört vor die Gründung — geprüft von Steuerberater und US-CPA." },
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
