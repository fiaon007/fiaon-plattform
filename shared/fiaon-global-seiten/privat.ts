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
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): Mandat, Honorar, Honorarrechner, „Angebot anfordern“. Der Blickfang
// sagt, was wir tun, was Sie selbst tun und wer entscheidet (dieselben Zeilen wie auf den Zielgruppen-Seiten,
// zielgruppen.ts). Das Honorar steht in drei Zeilen, jeder Betrag aus der Preisquelle. Beim Widerruf steht „vor Ablauf
// der Widerrufsfrist“ statt „sofort“ — in der Sache unverändert (Leitfaden 6.4; die Antwort zum Widerruf wartet noch auf
// die Freigabe des Anwalts, Vorbehalt V4). Steuern im Wohnsitzland: Zuständigkeit der Partner-Steuerberater statt einer
// Tätigkeit im Präsens (Leitfaden 5.11).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, handlung, satz, weitererSatz } from "../fiaon-global-saetze";

const P = EIN_PRODUKT.de;
const B = SAETZE_BETRAEGE.de;
/** Das Honorar in drei Zeilen — immer zusammen (Leitfaden 1.3, 5.6); wortgleich mit der Zeile der Zielgruppen-Seiten. */
const HONORAR_KURZ = `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`;
/** Schritt 5 (Finanzierung): was gilt, wenn sie ausbleibt — die Zeile aus der Tabelle „Wer macht was“ (Leitfaden 2.4). */
const WENN_ES_AUSBLEIBT = SECHS_SCHRITTE.de.find((x) => x.nr === 5)!.werMachtWas.wennEsAusbleibt;

export const PRIVAT_SEITE: GlobalSeite = {
  pfad: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "US-Firma als Privatperson gründen — FIAON Global",
    beschreibung: "Ohne eigene Firma: Sie beauftragen FIAON Global als Person. Wir gründen Ihre US-Gesellschaft, beantragen die EIN und bereiten Ihre Kontoanträge vor.",
  },
  // 06.10.2026 (E-293): H1 und Lead deckungsgleich mit der sichtbaren Startseite für Privatpersonen
  // (GLOBAL_WOERTER.de.privat, business-privat.tsx) — Vorab-HTML und Seite sagen dasselbe.
  stand: "2026-11-13",
  kennung: "FG · 29",
  auge: "Für wen · Privatpersonen und Gründer",
  h1: "Ihre eigene US-Gesellschaft.",
  h1b: "Ohne Firma, in einem Mandat.",
  // Aussage. Bedingung. Entscheider. (Leitfaden 3.2) — in drei Sätzen.
  lead: "Sie werden selbst Gesellschafter; Vertrag und Rechnung laufen auf Ihren Namen. Wir gründen Ihre US-Gesellschaft, beantragen die EIN und nach unserem ITIN-Check Ihre ITIN und bereiten Ihre Kontoanträge vor — auf Wunsch auch Ihre Kreditkartenanträge. Die Anträge stellen Sie selbst; es entscheidet das jeweilige Institut.",
  ziffern: [
    { wert: P.preis, label: P.preisLabel },
    { wert: "Ihr Name", label: "auf Vertrag und Rechnung" },
    { wert: "Sie selbst", label: "als Gesellschafter der US-Gesellschaft" },
  ],
  blick: [
    ["Auftraggeber", "Sie persönlich — Name und Anschrift statt Firma"],
    ["Gesellschafter", "Sie selbst; später auf Wunsch Ihre Holding"],
    ["Unterlagen", "Ihr Reisepass — Sie laden ihn nach der Unterschrift hoch"],
    ["Wir übernehmen", "Gründung, Unterlagen, Anträge für EIN und ITIN; vorbereitete Anträge für Konten, auf Wunsch Kreditkarten und Finanzierung"],
    ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen; die Anträge bei den Instituten selbst stellen"],
    ["Wer entscheidet", "Bundesstaat und US-Steuerbehörde; über Konto, Karte und Finanzierung das jeweilige Institut"],
    [GELD_ZURUECK.de.auge, WENN_ES_AUSBLEIBT],
    ["Honorar", HONORAR_KURZ],
    ["Widerruf", "Gesetzlich vierzehn Tage. Verlangen Sie, dass wir vor Ablauf der Frist beginnen, zahlen Sie bei einem Widerruf einen angemessenen Anteil für das bis dahin Erbrachte"],
    ["Vertragspartner", "FIAON LTD, London"],
  ],
  kurz: "Ja — Sie beauftragen FIAON Global als Person. Sie brauchen keine eigene Firma: Sie werden persönlich Gesellschafter der US-Gesellschaft, Vertrag und Rechnung laufen auf Ihren Namen. Alle Beträge sind Endpreise. Es gilt das gesetzliche Widerrufsrecht von vierzehn Tagen; mit Ihrer Unterschrift verlangen Sie ausdrücklich, dass wir vor Ablauf der Widerrufsfrist beginnen.",
  bloecke: [
    {
      typ: "karten", id: "fuer-wen", h2: "Für wen das passt", spalten: 3,
      karten: [
        { tag: "Gründer", titel: "Sie starten etwas Neues", text: "Die US-Gesellschaft ist Ihr erstes Unternehmen oder der Start eines neuen Geschäfts — Sie beauftragen als Person." },
        { tag: "Unternehmer", titel: "Sie beauftragen persönlich", text: "Sie führen bereits ein Unternehmen, wollen die US-Gesellschaft aber persönlich halten — nicht über Ihre Firma." },
        { tag: "Privatperson", titel: "Sie wollen eigenes US-Geschäft", text: "Kunden, Verträge oder ein Projekt in den USA — und eine eigene Gesellschaft dafür, ohne vorher eine Firma zu Hause zu gründen." },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "So beauftragen Sie als Privatperson",
      etappen: [
        { titel: handlung("angebot", "de"), text: "Im Honorarrechner machen Sie Ihre Angaben und sehen Ihre Honorarübersicht vorab." },
        { titel: "Ihre Angaben eintragen", text: "Auf Ihrer Angebotsseite tragen Sie Geburtsdatum und Anschrift ein und wählen den Namen Ihrer Gesellschaft. Registerauszug und Firmendaten entfallen." },
        { titel: "Widerrufsbelehrung und Beginn", text: "Sie lesen den Vertrag mit der Widerrufsbelehrung. Mit Ihrer Unterschrift verlangen Sie ausdrücklich, dass wir vor Ablauf der Widerrufsfrist beginnen." },
        { titel: "Vertrag, Rechnung, Reisepass", text: "Vertrag und Rechnung auf Ihren Namen kommen per E-Mail, mit der Widerrufsbelehrung und dem Muster-Widerrufsformular. Danach laden Sie Ihren Reisepass hoch." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "Sie persönlich — was das heißt",
      kopf: ["", "So ist es geregelt"],
      zeilen: [
        ["Vertragspartei", "Sie persönlich"],
        ["Gesellschafter der US-Gesellschaft", "Sie selbst, allein"],
        ["Unterlagen", "Ihr Reisepass, nach der Unterschrift"],
        ["Beträge", "Endpreise"],
        ["Widerrufsrecht", "gesetzlich vierzehn Tage"],
        ["Ihr Unternehmen als Gesellschafterin", "stimmen wir im Gespräch mit Ihnen ab"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Steuern — auch privat gilt dasselbe",
      absaetze: [
        `${satz("S10", "de")} Wer eine US-Gesellschaft privat hält und von zu Hause aus führt, versteuert sie in der Regel zu Hause. In Deutschland ist die Beteiligung dem Finanzamt nach § 138 AO zu melden; wie die Einkünfte eingeordnet werden, hängt von der Tätigkeit und vom Typenvergleich der Gesellschaft ab.`,
        "Steuerfragen in Ihrem Wohnsitzland liegen bei Partner-Steuerberatern; sie arbeiten in eigener Verantwortung. Die laufende Steuererklärung übernimmt Ihr eigener Steuerberater.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Widerrufsrecht: Sie können Ihren Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen. Weil Sie verlangen, dass wir vor Ablauf der Frist beginnen, zahlen Sie dann für die bis dahin erbrachten Leistungen einen angemessenen Anteil. Ist der Vertrag vollständig erfüllt, erlischt das Widerrufsrecht.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[2],
        // Für wen es nicht passt (Leitfaden 3.1 Regel 10, 6.2) — wie auf den Leistungsseiten als letzter Punkt.
        beleg("fuerWenNicht", "de"),
      ],
    },
    // 19.09.2026 (E-196): die Seite selbst ist eine Startseite (client/src/pages/site/business-privat.tsx); dieser Eintrag
    // liefert Kopfdaten, FAQ-Markup und das Vorab-HTML. Seit E-509: ein Produkt, die Karte „Ein Mandat“.
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
  ],
  fragen: [
    { f: "Kann ich als Privatperson eine US-Firma gründen?", a: "Ja. Sie brauchen weder eine eigene Firma noch einen Wohnsitz in den USA. Sie werden persönlich Gesellschafter der US-Gesellschaft; Vertrag und Rechnung laufen auf Ihren Namen." },
    { f: "Brauche ich eine Firma, um FIAON Global zu beauftragen?", a: "Nein. Sie beauftragen als Person: Auf Ihrer Angebotsseite tragen Sie Name, Geburtsdatum und Anschrift ein. Registerauszug und Firmendaten entfallen." },
    { f: "Habe ich als Privatperson ein Widerrufsrecht?", a: "Ja — das gesetzliche Widerrufsrecht von vierzehn Tagen ab Vertragsschluss. Mit Ihrer Unterschrift verlangen Sie, dass wir vor Ablauf der Widerrufsfrist beginnen; im Fall des Widerrufs zahlen Sie dann einen angemessenen Anteil für bereits Erbrachtes." },
    { f: "Was kostet es?", a: P.preisSatzKurz },
    { f: "Welchen Kapitalrahmen kann ich wählen?", a: P.rahmenSatz },
    // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — dieselbe Frage wie auf /business (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
    { f: "Was kostet die Gesellschaft ab dem zweiten Jahr?", a: `Mit der Jahresbetreuung ${P.jahres} im Jahr, auf Wunsch. Enthalten sind Staatsgebühr, Registered Agent, US-Geschäftsadresse, US-Telefonnummer und die jährliche US-Meldung (Form 5472). Die Jahresbetreuung verlängert sich nicht von selbst. Nicht enthalten ist der Steuerberater in Ihrem Wohnsitzland.` },
    { f: "Kann ich die US-Gesellschaft später auf meine Firma übertragen?", a: "Grundsätzlich ja. Eine Übertragung hat steuerliche Folgen in beiden Ländern; das prüfen Sie vorher mit Ihrem Steuerberater." },
    { f: "Muss ich in die USA reisen?", a: `Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut. ${weitererSatz("MIAMI", "de")}` },
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
