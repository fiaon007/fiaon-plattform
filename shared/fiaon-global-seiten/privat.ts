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
// Die Festpreise sind für Privatpersonen Endpreise. Die Bestellstrecke
// (/business/start) fragt die Art des Auftraggebers ab; Vertrag und Rechnung
// richten sich danach (server/lib/fiaon-global-auftrag.ts, -vertrag.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, globalPreisText } from "../fiaon-global";
import type { GlobalSeite } from "./typen";

export const PRIVAT_SEITE: GlobalSeite = {
  pfad: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "US-Firma als Privatperson gründen — FIAON Global",
    beschreibung: "Sie brauchen keine eigene Firma: Als Privatperson oder Gründer beauftragen Sie FIAON Global direkt — US-Gesellschaft, EIN, ITIN und Konto zum Festpreis.",
  },
  stand: "2026-09-19",
  kennung: "FG · 29",
  auge: "Für wen · Privatpersonen und Gründer",
  h1: "Keine Firma nötig.",
  h1b: "Auch privat beauftragen.",
  lead: "Sie brauchen kein bestehendes Unternehmen, um FIAON Global zu beauftragen. Als Privatperson, als Gründer oder als Unternehmer, der privat bucht, werden Sie selbst Gesellschafter Ihrer US-Gesellschaft — mit demselben Festpreis, demselben Team vor Ort und denselben Partnern.",
  ziffern: [
    { wert: `ab ${globalPreisText("global_struktur")}`, label: "Festpreis, für Privatpersonen Endpreis" },
    { wert: "Ihr Name", label: "auf Vertrag und Rechnung" },
    { wert: "Sie selbst", label: "als Gesellschafter der US-Gesellschaft" },
  ],
  blick: [
    ["Auftraggeber", "Sie persönlich — Name und Anschrift statt Firma"],
    ["Gesellschafter", "Sie selbst; später auf Wunsch Ihre Holding"],
    ["Unterlagen", "Reisepass, Adressnachweis, Namenswunsch, Tätigkeitsbeschreibung"],
    ["Preis", `ab ${globalPreisText("global_struktur")} — Endpreis, alle Gebühren inklusive`],
    ["Widerruf", "Gesetzliches Widerrufsrecht für Verbraucher; Beginn vor Fristende nur auf Ihren Wunsch"],
    ["Vertragspartner", "FIAON LTD, London"],
  ],
  kurz: "Ja — Sie können FIAON Global auch als Privatperson beauftragen. Sie brauchen keine eigene Firma: Sie werden persönlich Gesellschafter der US-Gesellschaft, Vertrag und Rechnung laufen auf Ihren Namen. Die Festpreise sind für Privatpersonen Endpreise. Handeln Sie als Verbraucher, gilt das gesetzliche Widerrufsrecht von vierzehn Tagen; vor Ablauf der Frist beginnen wir nur, wenn Sie es ausdrücklich wünschen.",
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
        { titel: "Paket wählen", text: "Dieselben vier Pakete, dieselben Festpreise — für Sie als Endpreise." },
        { titel: "„Als Privatperson“ angeben", text: "Im Auftrag wählen Sie „Privatperson“ und tragen Name und Anschrift ein. Registerauszug und Firmendaten entfallen." },
        { titel: "Widerrufsbelehrung und Wunsch zum Beginn", text: "Sie lesen die Widerrufsbelehrung. Sollen wir sofort beginnen, bestätigen Sie das ausdrücklich — sonst beginnen wir nach Ablauf der Widerrufsfrist." },
        { titel: "Unterschreiben", text: "Vertrag und Rechnung auf Ihren Namen kommen per E-Mail, mit der Widerrufsbelehrung und dem Muster-Widerrufsformular." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "Privatperson oder Unternehmen — was sich ändert",
      kopf: ["", "Als Privatperson", "Als Unternehmen"],
      zeilen: [
        ["Vertragspartei", "Sie persönlich", "Ihr Unternehmen"],
        ["Gesellschafter der US-Gesellschaft", "Sie selbst", "Ihr Unternehmen oder Sie"],
        ["Unterlagen", "Pass, Adressnachweis, Namenswunsch, Tätigkeit", "zusätzlich Registerauszug oder Gesellschafterliste"],
        ["Preisangabe", "Endpreis", "zuzüglich Umsatzsteuer, soweit sie anfällt"],
        ["Widerrufsrecht", "gesetzlich vierzehn Tage, wenn Sie Verbraucher sind", "gesetzlich keins"],
        ["Leistungen", "dieselben", "dieselben"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Steuern — auch privat gilt dasselbe",
      absaetze: [
        "Wer eine US-Gesellschaft privat hält und von zu Hause aus führt, versteuert sie in der Regel zu Hause. In Deutschland ist die Beteiligung dem Finanzamt nach § 138 AO zu melden; wie die Einkünfte eingeordnet werden, hängt von der Tätigkeit und vom Typenvergleich der Gesellschaft ab.",
        "Unser Partner-Steuerberater prüft das vor der Gründung — auch für Privatpersonen im Festpreis. Die laufende Steuererklärung übernimmt Ihr eigener Steuerberater.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Widerrufsrecht: Handeln Sie als Verbraucher, können Sie den Auftrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen. Haben Sie verlangt, dass wir vorher beginnen, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Anteil. Ist der Auftrag vollständig erfüllt, erlischt das Widerrufsrecht.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
    // 19.09.2026 (E-196): Privatpersonen wählen aus allen vier Paketen — die Seite selbst ist seitdem eine Startseite
    // (client/src/pages/site/business-privat.tsx); dieser Eintrag liefert Kopfdaten, FAQ-Markup und das Vorab-HTML.
    { typ: "pakete", id: "pakete", h2: "Alle vier Pakete — auch für Privatpersonen", lead: "Dieselben Pakete und Festpreise wie für Unternehmen, für Sie als Endpreise — alle Gebühren und die Honorare unserer Partner inklusive." },
  ],
  fragen: [
    { f: "Kann ich als Privatperson eine US-Firma gründen?", a: "Ja. Sie brauchen weder eine eigene Firma noch einen Wohnsitz in den USA. Sie werden persönlich Gesellschafter der US-Gesellschaft; Vertrag und Rechnung laufen auf Ihren Namen." },
    { f: "Brauche ich eine Firma, um FIAON Global zu beauftragen?", a: "Nein. Im Auftrag wählen Sie „Privatperson“ und tragen Name und Anschrift ein. Registerauszug und Firmendaten entfallen." },
    { f: "Habe ich als Privatperson ein Widerrufsrecht?", a: "Wenn Sie als Verbraucher handeln, ja — das gesetzliche Widerrufsrecht von vierzehn Tagen ab Vertragsschluss. Vor Ablauf beginnen wir nur auf Ihren ausdrücklichen Wunsch; dann zahlen Sie im Fall des Widerrufs einen angemessenen Anteil für bereits Erbrachtes." },
    { f: "Gilt der Festpreis auch für Privatpersonen?", a: `Ja, als Endpreis — für alle vier Pakete, ab ${globalPreisText("global_struktur")} für Global Struktur, mit allen Gebühren und Partner-Honoraren des Pakets.` },
    { f: "Welche Pakete kann ich als Privatperson wählen?", a: "Alle vier: Global Struktur für den sauberen Start, Global Banking, Global Kapital und Global VIP, wenn Sie die Kartenleiter und später ein Bankdarlehen planen." },
    // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — dieselbe Frage wie auf /business (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
    { f: "Was kostet die Gesellschaft ab dem zweiten Jahr?", a: "Mit der Jahresbetreuung 699 € im Jahr, alle Gebühren inklusive — Registered Agent, US-Adresse und Telefon, die jährliche US-Meldung und die Jahresmeldung beim Bundesstaat samt Staatsgebühr. Sie verlängert sich nicht von selbst." },
    { f: "Kann ich die US-Gesellschaft später auf meine Firma übertragen?", a: "Grundsätzlich ja. Eine Übertragung hat steuerliche Folgen in beiden Ländern; das prüfen Sie vorher mit Ihrem Steuerberater." },
    { f: "Muss ich in die USA reisen?", a: "In der Regel nicht. Unser Team vor Ort in Miami reicht ein und nimmt Termine wahr; Sie unterschreiben digital. Wer den Aufbau persönlich erleben möchte, wählt Global VIP — Flug und Hotel für den Auftakt in Miami sind dort im Festpreis." },
    { f: "Welche Unterlagen brauche ich als Privatperson?", a: "Ihren Reisepass, einen Adressnachweis, den gewünschten Namen der Gesellschaft in drei Varianten und eine kurze Beschreibung der geplanten Tätigkeit." },
  ],
  paket: "global_struktur",
  auftraggeber: "privat",
  weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/wissen/llc-gruenden", "/business/paket-finder"],
  quellen: [
    { titel: "§ 355 BGB — Widerrufsrecht bei Verbraucherverträgen", url: "https://www.gesetze-im-internet.de/bgb/__355.html" },
    { titel: "§ 356 BGB — Widerrufsrecht bei Fernabsatzverträgen", url: "https://www.gesetze-im-internet.de/bgb/__356.html" },
    { titel: "§ 357a BGB — Wertersatz", url: "https://www.gesetze-im-internet.de/bgb/__357a.html" },
    { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  ],
};
