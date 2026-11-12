// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR PRIVATPERSONEN UND GRÜNDER (19.09.2026, E-191)
//
// Justin (19.09.2026): „Man muss nicht als Firma unser Paket kaufen, auch
// Privatpersonen können über uns kaufen/gründen … auch ein Unternehmer privat
// buchen/kaufen kann!"
//
// Was das rechtlich heißt, steht hier offen: Wer als Privatperson beauftragt,
// kann Verbraucher sein — dann gilt ein Widerrufsrecht von vierzehn Tagen, und
// FIAON beginnt vor Ablauf nur auf ausdrücklichen Wunsch (§ 356 Abs. 4 BGB).
// Die Preise sind für Privatpersonen Endpreise. Die Bestellstrecke
// (/business/start) fragt die Art des Auftraggebers ab; Vertrag und Rechnung
// richten sich danach (server/lib/fiaon-global-auftrag.ts, -vertrag.ts).
//
// E-509 (12.11.2026): EIN Produkt, und JEDER beauftragt als Person (Vertrag der Fassung C: der Auftraggeber ist
// einziger Gesellschafter seiner US-Gesellschaft). Die Seite sagt deshalb nicht mehr „Privatperson oder Unternehmen“,
// sondern was es heißt, persönlich zu beauftragen. Preise nur aus EIN_PRODUKT (ein-produkt.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

const P = EIN_PRODUKT.de;

export const PRIVAT_SEITE: GlobalSeite = {
  pfad: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "US-Firma als Privatperson gründen — FIAON Global",
    beschreibung: "Keine eigene Firma nötig: Als Privatperson oder Gründer beauftragen Sie FIAON Global direkt — US-Gesellschaft, EIN, ITIN und Kontoantrag in einem Auftrag.",
  },
  // 06.10.2026 (E-293): H1 und Lead deckungsgleich mit der sichtbaren Startseite für Privatpersonen
  // (GLOBAL_WOERTER.de.privat, business-privat.tsx) — Vorab-HTML und Seite sagen dasselbe.
  stand: "2026-11-12",
  kennung: "FG · 29",
  auge: "Für wen · Privatpersonen und Gründer",
  h1: "Ihre eigene US-Gesellschaft.",
  h1b: "Ohne Firma, in einem Auftrag.",
  lead: "Sie werden selbst Gesellschafter: Wir gründen, beantragen EIN und ITIN und bereiten Konto- und Kartenanträge vor — Vertrag und Rechnung laufen auf Ihren Namen.",
  ziffern: [
    { wert: P.preis, label: "mit Ihrem Auftrag — Endpreis" },
    { wert: "Ihr Name", label: "auf Vertrag und Rechnung" },
    { wert: "Sie selbst", label: "als Gesellschafter der US-Gesellschaft" },
  ],
  blick: [
    ["Auftraggeber", "Sie persönlich — Name und Anschrift statt Firma"],
    ["Gesellschafter", "Sie selbst; später auf Wunsch Ihre Holding"],
    ["Unterlagen", "Ihr Reisepass — Sie laden ihn nach der Unterschrift hoch"],
    ["Preis", `${P.preis} mit Ihrem Auftrag — Endpreis; Erfolgshonorar mit der Eintragung`],
    ["Widerruf", "Gesetzliches Widerrufsrecht von vierzehn Tagen; wir beginnen sofort, weil Sie es ausdrücklich verlangen"],
    ["Vertragspartner", "FIAON LTD, London"],
  ],
  kurz: "Ja — Sie beauftragen FIAON Global als Person. Sie brauchen keine eigene Firma: Sie werden persönlich Gesellschafter der US-Gesellschaft, Vertrag und Rechnung laufen auf Ihren Namen. Alle Beträge sind Endpreise. Es gilt das gesetzliche Widerrufsrecht von vierzehn Tagen; mit Ihrer Unterschrift verlangen Sie ausdrücklich, dass wir sofort beginnen.",
  bloecke: [
    {
      typ: "karten", id: "fuer-wen", h2: "Für wen das passt", spalten: 3,
      karten: [
        { tag: "Gründer", titel: "Sie starten etwas Neues", text: "Die US-Gesellschaft ist Ihr erstes Unternehmen oder der Start eines neuen Geschäfts — Sie beauftragen als Person." },
        { tag: "Unternehmer", titel: "Sie buchen privat", text: "Sie führen bereits ein Unternehmen, wollen die US-Gesellschaft aber persönlich halten — nicht über Ihre Firma." },
        { tag: "Privatperson", titel: "Sie wollen eigenes US-Geschäft", text: "Kunden, Verträge oder ein Projekt in den USA — und eine eigene Gesellschaft dafür, ohne vorher eine Firma zu Hause zu gründen." },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "So beauftragen Sie als Privatperson",
      etappen: [
        { titel: "Angebot zusammenstellen", text: "Im Konfigurator wählen Sie Ihre Schwerpunkte und Ihren Kapitalrahmen und sehen Ihren Preis — als Endpreis." },
        { titel: "Ihre Angaben eintragen", text: "Auf Ihrer Angebotsseite tragen Sie Geburtsdatum und Anschrift ein und wählen den Namen Ihrer Gesellschaft. Registerauszug und Firmendaten entfallen." },
        { titel: "Widerrufsbelehrung und Beginn", text: "Sie lesen den Vertrag mit der Widerrufsbelehrung. Mit Ihrer Unterschrift verlangen Sie ausdrücklich, dass wir sofort beginnen." },
        { titel: "Unterschreiben", text: "Vertrag und Rechnung auf Ihren Namen kommen per E-Mail, mit der Widerrufsbelehrung und dem Muster-Widerrufsformular. Danach laden Sie Ihren Reisepass hoch." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "Sie persönlich — was das heißt",
      kopf: ["", "So ist es geregelt"],
      zeilen: [
        ["Vertragspartei", "Sie persönlich"],
        ["Gesellschafter der US-Gesellschaft", "Sie selbst, allein"],
        ["Unterlagen", "Ihr Reisepass, nach der Unterschrift"],
        ["Preisangabe", "Endpreise"],
        ["Widerrufsrecht", "gesetzlich vierzehn Tage"],
        ["Ihr Unternehmen als Gesellschafterin", "stimmen wir im Gespräch mit Ihnen ab"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Steuern — auch privat gilt dasselbe",
      absaetze: [
        "Wer eine US-Gesellschaft privat hält und von zu Hause aus führt, versteuert sie in der Regel zu Hause. In Deutschland ist die Beteiligung dem Finanzamt nach § 138 AO zu melden; wie die Einkünfte eingeordnet werden, hängt von der Tätigkeit und vom Typenvergleich der Gesellschaft ab.",
        "Unser Partner-Steuerberater klärt vorab mit Ihnen, wie Überweisungen und Investitionen zu behandeln sind. Die laufende Steuererklärung übernimmt Ihr eigener Steuerberater.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Widerrufsrecht: Sie können den Auftrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen. Weil Sie verlangen, dass wir vorher beginnen, zahlen Sie dann für die bis dahin erbrachten Leistungen einen angemessenen Anteil. Ist der Auftrag vollständig erfüllt, erlischt das Widerrufsrecht.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
    // 19.09.2026 (E-196): die Seite selbst ist eine Startseite (client/src/pages/site/business-privat.tsx); dieser Eintrag
    // liefert Kopfdaten, FAQ-Markup und das Vorab-HTML. Seit E-509: ein Produkt, die Karte „Ein Mandat“.
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
  ],
  fragen: [
    { f: "Kann ich als Privatperson eine US-Firma gründen?", a: "Ja. Sie brauchen weder eine eigene Firma noch einen Wohnsitz in den USA. Sie werden persönlich Gesellschafter der US-Gesellschaft; Vertrag und Rechnung laufen auf Ihren Namen." },
    { f: "Brauche ich eine Firma, um FIAON Global zu beauftragen?", a: "Nein. Sie beauftragen als Person: Auf Ihrer Angebotsseite tragen Sie Name, Geburtsdatum und Anschrift ein. Registerauszug und Firmendaten entfallen." },
    { f: "Habe ich als Privatperson ein Widerrufsrecht?", a: "Ja — das gesetzliche Widerrufsrecht von vierzehn Tagen ab Vertragsschluss. Mit Ihrer Unterschrift verlangen Sie, dass wir sofort beginnen; im Fall des Widerrufs zahlen Sie dann einen angemessenen Anteil für bereits Erbrachtes." },
    { f: "Was kostet es?", a: P.preisSatzKurz },
    { f: "Welchen Kapitalrahmen kann ich wählen?", a: P.rahmenSatz },
    // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — dieselbe Frage wie auf /business (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
    { f: "Was kostet die Gesellschaft ab dem zweiten Jahr?", a: `Mit der Jahresbetreuung ${P.jahres} im Jahr, alle Gebühren inklusive — Registered Agent, US-Adresse und Telefon, die jährliche US-Meldung und die Jahresmeldung beim Bundesstaat samt Staatsgebühr. Sie verlängert sich nicht von selbst.` },
    { f: "Kann ich die US-Gesellschaft später auf meine Firma übertragen?", a: "Grundsätzlich ja. Eine Übertragung hat steuerliche Folgen in beiden Ländern; das prüfen Sie vorher mit Ihrem Steuerberater." },
    { f: "Muss ich in die USA reisen?", a: "Nein. Unsere Partner in den USA nehmen die Wege vor Ort wahr; Sie unterschreiben online. Ab 1 Mio. US-Dollar Kapitalrahmen treffen wir Sie persönlich in Miami." },
    { f: "Welche Unterlagen brauche ich als Privatperson?", a: "Ihren Reisepass — Sie laden ihn nach der Unterschrift hoch. Den Namen Ihrer Gesellschaft wählen Sie auf Ihrer Angebotsseite. Verlangt eine Behörde oder ein Institut weitere Unterlagen, nennen wir sie Ihnen." },
  ],
  paket: "global_struktur",
  auftraggeber: "privat",
  weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/wissen/llc-gruenden", "/business/ablauf"],
  quellen: [
    { titel: "§ 355 BGB — Widerrufsrecht bei Verbraucherverträgen", url: "https://www.gesetze-im-internet.de/bgb/__355.html" },
    { titel: "§ 356 BGB — Widerrufsrecht bei Fernabsatzverträgen", url: "https://www.gesetze-im-internet.de/bgb/__356.html" },
    { titel: "§ 357a BGB — Wertersatz", url: "https://www.gesetze-im-internet.de/bgb/__357a.html" },
    { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  ],
};
