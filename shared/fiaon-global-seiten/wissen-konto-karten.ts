// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: KONTO, BONITÄT, BUSINESS CREDIT, FIRMENKARTEN
// (23.09.2026, E-232 · Wortlaut neu gefasst 13.11.2026, E-510)
//
// Vier der zehn Beiträge vom 23.09.2026 (die übrigen sechs: wissen-gruendung.ts).
// Hier ist die Wortwand am engsten: Es geht um Geld, Karten und Rahmen. Deshalb
// steht in jedem Beitrag, wer entscheidet (das Institut, der Herausgeber), was
// der Inhaber unterzeichnet (persönliche Haftung) und was FIAON NICHT tut
// (keine Bank, keine Kredite, keine Vermittlung).
// Der Fall FTC v. Seek Capital (Entscheidung 16.09.2025, Anordnung 01.10.2025,
// Mitteilung der FTC 17.11.2025) steht mit Quelle da — als Maßstab, an dem sich
// jeder Anbieter messen lassen muss, auch FIAON.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ 7.4):
// Je Seite EIN Abschnitt „Was FIAON Global dabei übernimmt“ — was wir tun, Ihr Teil,
// die Bedingung (wer entscheidet). Die Schritte 3 (Konten) und 4 (Kreditkarten auf
// Wunsch) und die festen Sätze kommen wortgleich aus shared/fiaon-global-saetze.ts.
// WAS HIER NIE STEHT: ein Name für die Abfolge der Kartenanträge, eine Zusage zu
// Konto, Karte oder Rahmen, ein Zins als Zahl oder Größenordnung, ein Warnzeichen,
// das unser eigenes Honorar träfe (Leitfaden 5.6 Nr. 12: Warnzeichen ist das
// Honorar, das mit jedem weiteren Kartenantrag wächst — nicht das Honorar nach dem
// gewählten Kapitalrahmen), der Erklär-Satz zum Erfolgshonorar (S16, Vorbehalt V3),
// ein „Team vor Ort“. Der Einführungszeitraum ohne Sollzins steht als EIN Satz
// Marktwissen mit Beleg da (Leitfaden 7.4).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz, type Schritt, type SchrittNr } from "../fiaon-global-saetze";
import { EIN_PRODUKT } from "./ein-produkt";
import { FAKTEN_STAND, QUELLEN_WISSEN as Q, SCHWELLEN } from "./fakten";
import type { GlobalSeite } from "./typen";

/** Tag der Erstveröffentlichung (E-232). */
const ERSCHIENEN = "2026-09-23";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). */
const S = "2026-11-13";
const P = EIN_PRODUKT.de;
/** Ein Schritt der festen Erzählung (Leitfaden 2.2) — Satz, Bedingung und „Ihr Teil“ wortgleich aus der einen Quelle. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
const KONTEN = schritt(3);
const KARTEN = schritt(4);
const FINANZIERUNG = schritt(5);
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Überschrift des einen Abschnitts über uns (Leitfaden 7.4). */
const FIAON_H2 = "Was FIAON Global dabei übernimmt";
/** Der Entscheider-Satz aus S2: „Über Konto, Karte und Rahmen entscheidet das jeweilige Institut.“ */
const INSTITUT = satz("S2").split(/(?<=\.)\s+/)[1];
/** Der eine Satz Marktwissen zum Einführungszeitraum (Leitfaden 7.4) — wortgleich, je Seite einmal, mit Beleg. */
const EINFUEHRUNG = "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.";

export const WISSEN_KONTO_KARTEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 5 · DAS US-KONTO DER LLC — Unterlagen, Regeln, Ablehnungsgründe
  {
    pfad: "/business/wissen/us-bankkonto-unterlagen",
    art: "wissen",
    seo: {
      titel: "US-Geschäftskonto für die LLC: die Unterlagen — FIAON Global",
      beschreibung: "Welche Unterlagen US-Institute für das Konto einer LLC verlangen, warum sie fragen, woran Anträge scheitern und was die Einlagensicherung abdeckt.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 34",
    auge: "Wissen · Konto",
    h1: "Das US-Konto der LLC.",
    h1b: "Die Unterlagen, die Institute verlangen.",
    lead: "Ein Antrag auf ein US-Geschäftskonto scheitert selten an der Gesellschaft. In der Regel scheitert er an den Unterlagen: Ein Dokument fehlt, eine Anschrift weicht ab oder die Geschäftsbeschreibung ist unklar. Dieser Beitrag nennt die Unterlagen, ihre Rechtsgrundlage und den Inhalt eines vollständigen Antrags.",
    ziffern: [
      { wert: "7 Unterlagen", label: "die fast jedes Institut verlangt" },
      { wert: "25 %", label: "ab diesem Anteil identifiziert das Institut jeden Gesellschafter" },
      { wert: "250.000 $", label: "Einlagensicherung je Einleger, Institut und Kategorie (FDIC)" },
    ],
    blick: [
      ["Voraussetzung", "Eingetragene Gesellschaft mit EIN"],
      ["Pflicht der Institute", "Identität feststellen, Eigentümer ab 25 % erfassen"],
      ["Kernunterlagen", "Gründungsdokument, EIN-Bestätigung, Operating Agreement, Pässe"],
      ["Häufige Ablehnungsgründe", "Unklare Geschäftsbeschreibung, abweichende Anschrift"],
      ["Einlagensicherung", "250.000 $ je Einleger, Institut und Kategorie"],
      ["Wer entscheidet", "Das jeweilige Institut"],
      ["Mit FIAON Global", "Antrag vollständig vorbereitet, Rückfragen begleitet; Sie stellen ihn selbst"],
    ],
    kurz: `Für das Konto einer LLC verlangen US-Institute das Gründungsdokument, die EIN-Bestätigung der US-Steuerbehörde IRS und das Operating Agreement. Hinzu kommen die Pässe aller Gesellschafter ab ${SCHWELLEN.eigentuemer} und der Person, die die Gesellschaft lenkt, sowie Adressnachweise. Das Institut verlangt außerdem eine Geschäftsbeschreibung mit den erwarteten Zahlungsströmen. Die Institute erheben diese Angaben nach US-Recht. Über das Konto und seine Bedingungen entscheidet das jeweilige Institut.`,
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Die Identifizierungspflicht der Institute",
        absaetze: [
          "Jedes US-Institut muss vor der Kontoeröffnung die Identität seines Kunden feststellen (Customer Identification Program, 31 CFR 1020.220). Es erhebt Name, Anschrift und eine Identifikationsnummer. Bei Personen ohne US-Staatsbürgerschaft ist das etwa die Passnummer mit dem Ausstellungsland. Bei Gesellschaften sind es die EIN und ein physischer Ort der Geschäftstätigkeit.",
          `Bei Gesellschaften erfasst das Institut zusätzlich die wirtschaftlich Berechtigten (31 CFR 1010.230). Das sind jede Person, die mindestens ${SCHWELLEN.eigentuemer} hält, und eine Person, die die Gesellschaft maßgeblich lenkt. Seit Februar 2026 müssen Institute diese Angaben nur noch bei der ersten Kontoeröffnung und bei Zweifeln prüfen, nicht mehr bei jedem weiteren Konto.`,
        ],
      },
      {
        typ: "tabelle", id: "unterlagen", h2: "Die sieben Unterlagen",
        kopf: ["Unterlage", "Zweck", "Anforderung"],
        zeilen: [
          ["Gründungsdokument (Articles of Organization)", "Nachweis, dass die Gesellschaft besteht", "vom Bundesstaat eingetragene Fassung; Name genau wie im Antrag"],
          ["EIN-Bestätigung (CP 575 oder Letter 147C)", "Steuernummer der Gesellschaft", "Name und Anschrift wie im Gründungsdokument"],
          ["Operating Agreement (Gesellschaftsvertrag der LLC)", "Wer beteiligt ist und wer handeln darf", "unterzeichnet; die Beteiligungen ergeben zusammen 100 Prozent"],
          ["Pässe", "Identität der Gesellschafter ab 25 % und der lenkenden Person", "gültig, lesbar, Namen wie im Operating Agreement"],
          ["Adressnachweise", "Wohnanschrift der Beteiligten", "aktuell und auf den Namen der Person"],
          ["Geschäftsbeschreibung", "Was die Gesellschaft tut", "Kunden, Produkte, Länder, erwartete Umsätze und Zahlungswege"],
          ["Beleg zur ersten Einlage", "Herkunft der Mittel", "Kontoauszug oder Beleg der Einlage"],
        ],
        fuss: ["Manche Institute verlangen zusätzlich eine Bescheinigung über den ordnungsgemäßen Status (Certificate of Good Standing), eine Website oder erste Verträge."],
      },
      {
        typ: "karten", id: "ablehnung", h2: "Häufige Gründe einer Ablehnung", spalten: 3,
        karten: [
          { tag: "Grund", titel: "Unklare Geschäftsbeschreibung", text: "Die Angabe „Consulting“ ohne Kunden, Website und Verträge genügt nicht. Das Institut kann das Risiko dann nicht einschätzen und lehnt ab." },
          { tag: "Grund", titel: "Abweichende Anschriften", text: "Wohnsitz, Geschäftsadresse und die Anschrift in der EIN-Bestätigung weichen voneinander ab. Oder die Geschäftsadresse ist die Anschrift eines Registered Agent, des vorgeschriebenen Zustellungsempfängers im Bundesstaat." },
          { tag: "Grund", titel: "Lücken im Operating Agreement", text: "Die Unterschrift fehlt, die Beteiligungen ergeben keine Summe oder ein Gesellschafter ist nicht genannt. Das Institut kann die Angaben zu den Eigentümern dann nicht prüfen." },
          { tag: "Grund", titel: "Branchen mit erhöhtem Risiko", text: "Einige Tätigkeiten prüfen Institute strenger, andere Tätigkeiten nehmen sie nicht an. Darüber entscheidet das Institut, unabhängig von den Unterlagen." },
          { tag: "Grund", titel: "Bezüge zu Sanktionsländern", text: "Zahlungen oder Beteiligte mit Bezug zu sanktionierten Ländern führen fast immer zur Ablehnung." },
          { tag: "Grund", titel: "Widersprüche im Gespräch", text: "Weichen Ihre Angaben im Gespräch vom Antrag ab, wertet das Institut das als Widerspruch. Eine Ablehnung aus diesem Grund ist oft endgültig." },
        ],
      },
      {
        typ: "tabelle", id: "art", h2: "Bank und Finanzplattform im Vergleich",
        kopf: ["", "Bank", "Finanzplattform"],
        zeilen: [
          ["Eröffnung", "teils nur mit Termin vor Ort", "meist vollständig online"],
          ["Wer das Konto führt", "die Bank selbst", "meist eine Bank, mit der die Plattform zusammenarbeitet"],
          ["Einlagensicherung", "über die FDIC, wenn die Bank versichert ist", "nur über die kontoführende Bank und nur zu deren Bedingungen"],
          ["Karten und Darlehen", "oft beim selben Institut", "oft nur Karten"],
        ],
        fuss: ["Allgemeine Übersicht; Leistungen und Bedingungen legt jedes Institut selbst fest."],
      },
      {
        typ: "text", id: "sicherung", h2: "Was die Einlagensicherung abdeckt",
        absaetze: [
          `Die US-Einlagensicherung FDIC schützt ${SCHWELLEN.fdic} je Einleger, je versichertem Institut und je Eigentumskategorie. Eine LLC oder Corporation mit eigenem Geschäft bildet eine eigene Kategorie. Die FDIC rechnet ihr Guthaben nicht mit Ihren privaten Konten beim selben Institut zusammen.`,
          "Die Sicherung greift nur, wenn ein versichertes Institut ausfällt. Eine Finanzplattform ist selbst keine Bank. Ob und wie Guthaben dort geschützt sind, richtet sich nach der kontoführenden Bank und den Bedingungen der Plattform.",
        ],
      },
      {
        typ: "etappen", id: "weg", h2: "Der Ablauf eines vollständigen Antrags",
        etappen: [
          { titel: "Unterlagen zusammenstellen", text: "Sie stellen alle sieben Unterlagen zusammen. Namen und Anschriften stimmen in jeder Unterlage überein." },
          { titel: "Geschäft beschreiben", text: "Zwei Absätze genügen, wenn ein Außenstehender sie versteht. Sie nennen Tätigkeit, Kunden, Länder, erwartete Umsätze und Zahlungswege." },
          { titel: "Institut wählen", text: "Maßgeblich sind Ihr Geschäft, die benötigten Währungen und der Weg der Eröffnung. Prüfen Sie auch, ob das Institut später Karten ausgibt." },
          { titel: "Antrag und Rückfragen", text: "Rückfragen stellt das Institut fast immer. Beantworten Sie jede vollständig und ohne Widerspruch zum Antrag. Über den Antrag entscheidet das Institut." },
          { titel: "Eröffnung und erste Einlage", text: "Nach der Zusage des Instituts folgt die erste Einlage, mit einem Beleg zur Herkunft der Mittel. Bei einer LLC mit ausländischem Gesellschafter ist die Einlage zugleich ein meldepflichtiger Vorgang für Form 5472." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${KONTEN.satz} Wir verfassen die Geschäftsbeschreibung mit Ihnen und stellen die Unterlagen mit übereinstimmenden Angaben zusammen. Bei Rückfragen des Instituts begleiten wir Sie. Verlangt ein Institut einen Termin vor Ort, bereiten wir ihn mit Ihnen vor.`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${KONTEN.bedingung}`,
          `Karten: ${satz("S4")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die Kontoanträge in Ihrem Mandat", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Über jedes Konto entscheidet das Institut, auch bei vollständigen Unterlagen.",
          `Hält Ihre US-Gesellschaft Konten außerhalb der USA mit zusammen mehr als ${SCHWELLEN.fbar}, meldet sie diese jährlich an die US-Behörde FinCEN (FBAR).`,
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Kann ich für meine LLC ein US-Konto eröffnen, ohne in die USA zu reisen?", a: "Bei vielen Instituten ja. Diese Institute eröffnen Konten für Gesellschaften mit Gesellschaftern im Ausland online. Andere verlangen einen Termin vor Ort. Den Weg der Eröffnung legt jedes Institut selbst fest." },
      { f: "Welche Unterlagen brauche ich für ein US-Geschäftskonto?", a: "In der Regel sieben: Gründungsdokument, EIN-Bestätigung, Operating Agreement, Pässe, Adressnachweise, Geschäftsbeschreibung und einen Beleg zur ersten Einlage. Die Pässe betreffen alle Gesellschafter ab 25 Prozent und die lenkende Person. Welche weiteren Unterlagen es verlangt, legt jedes Institut selbst fest." },
      { f: "Brauche ich eine SSN oder ITIN für das Konto meiner LLC?", a: "Die Gesellschaft braucht ihre Steuernummer (EIN). Für Gesellschafter ohne US-Sozialversicherungsnummer (SSN) genügt vielen Instituten der Pass. Manche Institute fragen nach der persönlichen Steuernummer (ITIN)." },
      { f: "Warum wurde mein Kontoantrag abgelehnt?", a: "Häufige Gründe sind eine unklare Geschäftsbeschreibung, widersprüchliche Angaben oder eine Anschrift, die das Institut nicht annimmt. Institute nennen ihre Gründe oft nicht. Deshalb kommt es auf einen vollständigen ersten Antrag an." },
      { f: "Sind Einlagen auf einem US-Geschäftskonto gesichert?", a: `Bei einem FDIC-versicherten Institut schützt die Einlagensicherung ${SCHWELLEN.fdic} je Einleger, Institut und Eigentumskategorie. Bei Finanzplattformen richtet sich der Schutz nach der kontoführenden Bank.` },
    ],
    paket: "global_banking",
    weiter: ["/business/us-geschaeftskonto", "/business/wissen/ein-beantragen", "/business/wissen/registered-agent-adresse", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [Q.cip, Q.cdd, Q.cddAusnahme, Q.fdic, Q.fbar],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6 · US-BONITÄT AUFBAUEN — der persönliche Credit Score
  {
    pfad: "/business/wissen/us-bonitaet-aufbauen",
    art: "wissen",
    seo: {
      titel: "US-Bonität aufbauen: der Credit Score — FIAON Global",
      beschreibung: "Warum die SCHUFA in den USA nicht zählt, wie der FICO Score entsteht, was ein erster Score voraussetzt und wie Sie eine US-Kredithistorie aufbauen.",
    },
    // 27.10.2026: Abschnitt „Zählt meine SCHUFA in den USA?“ (Experian, Dienst für ausländische Kreditdaten mit
    // eigener Länderliste und Dokumentation), EO 14406 Sec. 3(a)(vi) zur ITIN im Abschnitt „null“, eine Frage dazu.
    // Der Abschnitt trägt heute den Sachtitel „SCHUFA-Daten in den USA“ (Anker schufa-usa); die Frage steht im Fragen-Baustein.
    // Länder-Regel: Der Absatz, der Österreich und die Schweiz nennt, nennt weder Konto noch Karte — die Herausgeber stehen im Absatz danach.
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 35",
    auge: "Wissen · Bonität in den USA",
    h1: "Bonität in den USA.",
    h1b: "Sie beginnt bei null.",
    lead: "Bonität in den USA entsteht aus den Daten der US-Auskunfteien; Daten der SCHUFA gehen dort nicht ein. Wer aus Europa kommt, beginnt deshalb ohne Kreditakte. Dieser Beitrag erklärt, wie eine US-Kredithistorie entsteht und in welcher Reihenfolge Sie sie aufbauen.",
    ziffern: [
      { wert: "300 – 850", label: "Spanne des FICO Score" },
      { wert: "6 Monate", label: "Mindestalter eines Kontos für einen ersten Score" },
      { wert: "35 %", label: "Gewicht der Zahlungshistorie" },
    ],
    blick: [
      ["Ausgangslage", "SCHUFA-Daten zählen in den USA nicht"],
      ["Die Auskunfteien", "Equifax, Experian, TransUnion"],
      ["Der Score", "FICO, 300 bis 850, aus fünf Faktoren"],
      ["Erster Score", "Ein Konto, mindestens sechs Monate alt, in den letzten sechs Monaten gemeldet"],
      ["Kennung der Kreditakte", "SSN oder ITIN"],
      ["Was zählt", "Fristgerecht zahlen, Rahmen gering auslasten, Anträge planen"],
      ["Mit FIAON Global", "Reihenfolge geplant, Anträge vollständig vorbereitet; es entscheidet der Herausgeber"],
    ],
    kurz: "Eine US-Bonität bauen Sie neu auf: SCHUFA-Daten zählen in den USA nicht. Einen ersten FICO Score gibt es, sobald ein Konto mindestens sechs Monate besteht und in den letzten sechs Monaten gemeldet wurde. Der Score reicht von 300 bis 850. Fünf Faktoren bestimmen ihn: Zahlungshistorie (35 Prozent), Auslastung (30), Alter der Historie (15), neue Konten (10) und Mischung der Kreditarten (10). Es zählen fristgerechte Zahlungen, eine geringe Auslastung der Rahmen und wenige Anträge nach Plan.",
    bloecke: [
      {
        typ: "text", id: "null", h2: "Auskunfteien arbeiten national",
        absaetze: [
          "Auskunfteien arbeiten national. Die SCHUFA in Deutschland, die KSV1870 in Österreich und die CRIF in der Schweiz melden nicht an die US-Auskunfteien Equifax, Experian und TransUnion. Eine einwandfreie Kredithistorie in Europa zählt beim ersten US-Antrag deshalb in aller Regel nicht. Ein alter Eintrag zählt dort ebenfalls nicht.",
          "Die US-Auskunfteien führen persönliche Kreditakten in der Praxis über die Sozialversicherungsnummer (SSN) oder die persönliche Steuernummer (ITIN). Hinzu kommen Name, Anschrift und Geburtsdatum. Ohne eine dieser Nummern entsteht kaum eine Akte, der sich Zahlungen zuordnen lassen.",
          "Am 19. Mai 2026 kam für die ITIN ein weiterer Punkt hinzu. Die Executive Order 14406 „Restoring Integrity to America’s Financial System“ beauftragt den US-Finanzminister, Finanzinstituten in einem Hinweis (Advisory) Warnsignale zu beschreiben. Dazu zählt die Nutzung einer ITIN, um Kreditprodukte zu erhalten oder Einlagenkonten zu eröffnen, wenn kein geprüfter rechtmäßiger Aufenthaltsstatus vorliegt. Die Order hält fest, dass die ITIN der Erfüllung der Steuerpflicht dient. Ihre Nutzung anstelle einer Sozialversicherungsnummer oder eines gültigen Visums mit Arbeitserlaubnis kann aber als Risikofaktor gelten, der eine vertiefte Prüfung verlangt. Die vertiefte Prüfung soll verhindern, dass ein Konto der Beschäftigung ohne Arbeitserlaubnis dient. Rechnen Sie bei einem Antrag mit ITIN deshalb mit Rückfragen.",
        ],
      },
      {
        typ: "text", id: "schufa-usa", h2: "SCHUFA-Daten in den USA",
        absaetze: [
          "SCHUFA-Daten zählen in den USA nicht. Kreditdaten aus anderen Ländern gehen nicht in das US-System über. Das gilt für Einträge der SCHUFA in Deutschland, der KSV1870 in Österreich und der CRIF in der Schweiz. Ihre US-Kreditakte beginnt bei null. Eine beigelegte SCHUFA-Auskunft ändert daran nichts: FICO berechnet den Score allein aus den Daten Ihrer US-Kreditakte.",
          "Es gibt eine begrenzte Ausnahme: einen Dienst für Menschen, die in die USA gezogen sind. Über ihn können sie ihre ausländische Kredithistorie in einen US-Antrag einbringen. Der Dienst nennt Deutschland, Österreich und die Schweiz unter den Ländern, aus denen er Kreditdaten liest. Nach seiner technischen Dokumentation stützt er sich in allen drei Ländern auf Daten der CRIF; SCHUFA und KSV1870 nennt sie nicht.",
          "Einzelne US-Institute, darunter Kartenherausgeber, nutzen diesen Dienst. Für welche Länder ein Herausgeber den Weg tatsächlich anbietet und wie er die Daten wertet, entscheidet er selbst. Eine US-Kreditakte ersetzt der Weg nicht. Einen ersten FICO Score gibt es erst, wenn ein Konto mindestens sechs Monate besteht und in den letzten sechs Monaten an eine US-Auskunftei gemeldet wurde. Der Aufbau beginnt deshalb in jedem Fall mit dem ersten US-Konto.",
        ],
      },
      {
        typ: "tabelle", id: "faktoren", h2: "Die fünf Faktoren des FICO Score",
        kopf: ["Faktor", "Gewicht", "Was zählt"],
        zeilen: [
          ["Zahlungshistorie", "35 %", "fristgerechte Zahlungen, jeder Verzug, Inkasso"],
          ["Auslastung", "30 %", "genutzter Anteil der Rahmen; gemeldet meist zum Abrechnungsstichtag"],
          ["Alter der Historie", "15 %", "wie lange Ihre Konten bestehen"],
          ["Neue Konten", "10 %", "wie viele Konten Sie zuletzt eröffnet oder beantragt haben"],
          ["Mischung der Kreditarten", "10 %", "Karten, Ratenkredite, Hypotheken"],
        ],
        fuss: ["Gewichtung nach FICO für die Bevölkerung insgesamt; bei jungen Kreditakten weicht sie ab."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "Die Reihenfolge des Aufbaus",
        etappen: [
          { titel: "Nummer und Anschrift", text: "Sie brauchen eine ITIN oder SSN, eine US-Anschrift und eine Telefonnummer. Die Angaben stimmen in jedem Antrag überein." },
          { titel: "Das erste Konto", text: "Das erste Konto ist meist eine persönliche Karte mit kleinem Rahmen, oft gegen Einlage (Secured Card). Ob eine Firmenkarte in Ihrer persönlichen Kreditakte erscheint, legt jeder Herausgeber selbst fest." },
          { titel: "Sechs Monate mit Meldungen", text: "Einen ersten FICO Score gibt es erst nach sechs Monaten mit Meldungen. In dieser Zeit zahlen Sie jede Rechnung fristgerecht und vollständig." },
          { titel: "Geringe Auslastung", text: "Nutzen Sie die Rahmen nur zu einem kleinen Teil und zahlen Sie vor dem Abrechnungsstichtag. Herausgeber melden meist den Saldo dieses Tages." },
          { titel: "Weitere Konten mit Abstand", text: "Weitere Konten folgen nach Plan und mit Abstand zwischen den Anträgen. Die Auskunftei vermerkt jede Anfrage, und jedes neue Konto senkt das Durchschnittsalter Ihrer Konten." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Drei verbreitete Irrtümer", spalten: 3,
        karten: [
          { tag: "Irrtum", titel: "Viele Anträge in kurzer Zeit", text: "Die Auskunftei vermerkt jede Anfrage, und jedes neue Konto senkt das Durchschnittsalter Ihrer Konten. Mehrere Ablehnungen in Folge belasten die Kreditakte zusätzlich." },
          { tag: "Irrtum", titel: "Gekaufte Historie", text: "Manche Anbieter tragen Sie gegen Gebühr als Zusatznutzer fremder Karten ein. Herausgeber können solche Konten schließen; der Nutzen ist ungewiss." },
          { tag: "Irrtum", titel: "„Credit Repair“ gegen Vorkasse", text: "Zutreffende Einträge kann niemand entfernen lassen. Die US-Handelsaufsicht FTC warnt vor Diensten, die das zusagen." },
        ],
      },
      {
        typ: "text", id: "einsicht", h2: "Einsicht in Ihre US-Kreditakte",
        absaetze: [
          "Jede der drei Auskunfteien zeigt Ihnen Ihre Kreditakte ohne Gebühr. Das Gesetz sieht eine Auskunft im Jahr vor. Über AnnualCreditReport.com, die gemeinsame Stelle der drei, ist sie inzwischen dauerhaft jede Woche möglich. Online setzt der Abruf eine SSN voraus. Mit ITIN fordern Sie die Akte schriftlich per Post bei jeder Auskunftei an. Legen Sie eine Kopie des Reisepasses und einen Adressnachweis bei, und weisen Sie darauf hin, dass Ihre Nummer eine ITIN ist und keine SSN.",
          "Fehler lassen Sie direkt bei der Auskunftei berichtigen, etwa ein fremdes Konto, einen falschen Verzug oder eine alte Anschrift. Die Berichtigung ist ohne Gebühr und setzt keinen Dienstleister voraus.",
        ],
      },
      {
        typ: "text", id: "firma", h2: "Persönliche und geschäftliche Kredithistorie",
        absaetze: [
          "Neben Ihrer persönlichen Kreditakte kann Ihre Gesellschaft eine eigene Kredithistorie bei den Wirtschaftsauskunfteien aufbauen, mit eigener Kennziffer und eigenem Score. Bei einer jungen Gesellschaft prüfen Kartenherausgeber aber fast immer zuerst den Inhaber. Die persönliche Haftung ist die Regel; deshalb zählt Ihre persönliche Kredithistorie.",
          "Beide Historien entstehen nebeneinander: durch fristgerechte Zahlungen der Gesellschaft, eine fehlerfreie persönliche Kreditakte und wenige Anträge nach Plan.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `Wir beantragen Ihre ITIN nach unserem ITIN-Check; über die ITIN entscheidet die US-Steuerbehörde. ${KARTEN.satz} Wir bereiten jeden Antrag einzeln und vollständig vor. Die Reihenfolge der Anträge planen wir mit Ihnen.`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
          `${TEIL.bedingung}: ${KARTEN.bedingung}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die Kartenanträge in Ihrem Mandat", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Einen bestimmten Score oder Rahmen kann niemand zusagen. Der Score folgt den Daten, die Herausgeber melden.",
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Die ITIN dient steuerlichen Zwecken. Wer sie hat, übernimmt die zugehörigen Pflichten.",
        ],
      },
    ],
    fragen: [
      { f: "Zählt meine SCHUFA in den USA?", a: "Nein. US-Auskunfteien lesen keine SCHUFA-Daten ein. Ihre US-Kredithistorie beginnt bei null: ohne Vorteil aus guten Einträgen und ohne Nachteil aus alten." },
      { f: "Wie bekomme ich einen US Credit Score ohne SSN?", a: "Über die ITIN. Auskunfteien führen persönliche Kreditakten in der Praxis über SSN oder ITIN. Einen ersten FICO Score gibt es, sobald ein Konto mindestens sechs Monate besteht und in den letzten sechs Monaten gemeldet wurde." },
      { f: "Was ändert die Executive Order 14406 für Anträge mit ITIN?", a: "Sie beauftragt den US-Finanzminister, Finanzinstituten Warnsignale zu beschreiben. Dazu zählt die Nutzung einer ITIN statt einer Sozialversicherungsnummer oder eines Visums mit Arbeitserlaubnis bei Konto- und Kreditanträgen, wenn kein geprüfter rechtmäßiger Aufenthaltsstatus vorliegt. Diese Nutzung kann als Risikofaktor gelten, der eine vertiefte Prüfung verlangt. Rechnen Sie mit Rückfragen. Über jeden Antrag entscheidet das Institut." },
      { f: "Wie lange dauert es, eine US-Kredithistorie aufzubauen?", a: "Einen ersten Score gibt es nach etwa sechs Monaten. Eine Kredithistorie, auf die Herausgeber höhere Rahmen stützen, entsteht über Jahre. Sie setzt fristgerechte Zahlungen und wenige Anträge nach Plan voraus." },
      { f: "Wie hoch sollte die Auslastung meiner Karten sein?", a: "So niedrig wie möglich. Die Auslastung macht rund 30 Prozent des FICO Score aus. Herausgeber melden meist den Saldo am Abrechnungsstichtag." },
      { f: "Hilft eine Firmenkarte meinem persönlichen Score?", a: "Das legt jeder Herausgeber selbst fest. Manche melden Firmenkarten in der persönlichen Kreditakte, manche nur bei Verzug, manche nicht." },
    ],
    paket: "global_banking",
    weiter: ["/business/firmenkarten-kapital", "/business/wissen/business-credit-usa", "/business/wissen/itin-beantragen", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [
      Q.ficoFaktoren, Q.ficoMindest, Q.ftcAuskunft, Q.ftcCredit, Q.itinUebersicht,
      { titel: "Experian — Kreditaufbau für Neuankömmlinge in den USA (26.05.2026)", url: "https://www.experian.com/blogs/ask-experian/how-to-build-credit-when-new-to-us/" },
      { titel: "Nova Credit — Credit Passport: Herkunftsländer und Nutzer", url: "https://www.novacredit.com/company" },
      { titel: "Nova Credit — Credit Passport API v4: Auskunfteien je Land", url: "https://docs.novacredit.com/credit-passport/v4" },
      { titel: "Weißes Haus — Executive Order 14406 „Restoring Integrity to America’s Financial System“ (19.05.2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7 · BUSINESS CREDIT — die Bonität der Gesellschaft
  {
    pfad: "/business/wissen/business-credit-usa",
    art: "wissen",
    seo: {
      titel: "Business Credit aufbauen: D-U-N-S, PAYDEX — FIAON Global",
      beschreibung: "Firmenbonität in den USA: D-U-N-S-Nummer, PAYDEX, Experian, Equifax, Lieferantenkonten — und was Herausgeber bei jungen Gesellschaften prüfen.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 36",
    auge: "Wissen · Firmenbonität",
    h1: "Business Credit.",
    h1b: "Die Bonität Ihrer Gesellschaft.",
    lead: "Business Credit ist die eigene Kredithistorie Ihrer US-Gesellschaft bei den Wirtschaftsauskunfteien, mit eigener Kennziffer und eigenem Score. Mit ihr kann eine Gesellschaft über die Jahre selbst kreditwürdig werden. Der Aufbau folgt einer festen Reihenfolge und beginnt mit den Stammdaten.",
    ziffern: [
      { wert: "9 Ziffern", label: "D-U-N-S-Nummer, ohne Gebühr vergeben" },
      { wert: "80 – 100", label: "PAYDEX: geringes Risiko" },
      { wert: "3 Auskunfteien", label: "Dun & Bradstreet, Experian, Equifax" },
    ],
    blick: [
      ["Was", "Eigene Kreditakte der Gesellschaft bei Wirtschaftsauskunfteien"],
      ["Kennung", "D-U-N-S-Nummer von Dun & Bradstreet, ohne Gebühr"],
      ["Scores", "PAYDEX (1–100), Experian Intelliscore Plus (1–100)"],
      ["Was zählt", "Fristgerechte Zahlungen an Lieferanten und Herausgeber"],
      ["Grundlage", "Übereinstimmende Stammdaten in jedem Register und Antrag"],
      ["Grenze", "Bei jungen Gesellschaften zählt zuerst die persönliche Haftung"],
      ["Mit FIAON Global", "Übereinstimmende Stammdaten; Anträge vollständig vorbereitet, es entscheidet das Institut"],
    ],
    kurz: "Business Credit ist die Kredithistorie Ihrer Gesellschaft bei den US-Wirtschaftsauskunfteien Dun & Bradstreet, Experian und Equifax. Grundlage ist die D-U-N-S-Nummer, die Dun & Bradstreet ohne Gebühr vergibt. Die Auskunfteien bewerten vor allem fristgerechte Zahlungen an Lieferanten und Herausgeber. Der PAYDEX von Dun & Bradstreet reicht von 1 bis 100; ab 80 gilt das Risiko als gering. Bei jungen Gesellschaften verlangen Kartenherausgeber fast immer die persönliche Haftung des Inhabers. Die Historie der Gesellschaft entsteht über Jahre.",
    bloecke: [
      {
        typ: "text", id: "zwei", h2: "Persönliche Akte und Firmenakte",
        absaetze: [
          "Für Sie persönlich führen Equifax, Experian und TransUnion eine Kreditakte, die ein FICO Score zusammenfasst. Für Ihre Gesellschaft führen Wirtschaftsauskunfteien eine zweite, getrennte Akte. Die Auskunfteien erfassen Zahlungsverhalten, Stammdaten, öffentliche Register und Eigentümer. Kartenherausgeber, Lieferanten, Vermieter und Versicherer rufen diese Akte ab.",
          "Aussagekraft erhält die Akte Ihrer Gesellschaft erst, wenn Geschäftspartner Zahlungen melden. Bis dahin enthält sie wenige Einträge. Einem Institut gibt eine solche Akte kaum mehr Auskunft als keine Akte.",
        ],
      },
      {
        typ: "tabelle", id: "auskunfteien", h2: "Die drei Wirtschaftsauskunfteien",
        kopf: ["", "Dun & Bradstreet", "Experian", "Equifax"],
        zeilen: [
          ["Kennung", "D-U-N-S-Nummer, neun Ziffern, je Standort", "eigene Kennung der Gesellschaft", "eigene Kennung der Gesellschaft"],
          ["Bekannter Score", "PAYDEX, 1 bis 100", "Intelliscore Plus, 1 bis 100", "eigene Scores"],
          ["Was er misst", "wie fristgerecht die Gesellschaft Lieferanten bezahlt", "das Risiko eines ernsten Zahlungsverzugs", "Zahlungsverhalten und Ausfallrisiko"],
          ["Eintrag", "ohne Gebühr anlegen und pflegen", "entsteht aus Meldungen und Registern", "entsteht aus Meldungen und Registern"],
        ],
        fuss: [`Nach den Angaben der Auskunfteien, Stand ${FAKTEN_STAND}. Die Auskunfteien ändern Skalen und Modelle von Zeit zu Zeit.`],
      },
      {
        typ: "tabelle", id: "paydex", h2: "Der PAYDEX und seine Einteilung",
        kopf: ["PAYDEX", "Risiko eines Zahlungsverzugs", "Bedeutung"],
        zeilen: [
          ["80 – 100", "gering", "die Gesellschaft zahlt fristgerecht oder früher"],
          ["50 – 79", "mittel", "Zahlungen kommen teils verspätet"],
          ["0 – 49", "hoch", "Zahlungen kommen regelmäßig verspätet"],
        ],
        fuss: ["Einteilung nach Dun & Bradstreet. Ein Wert entsteht erst, wenn genügend Zahlungserfahrungen gemeldet sind."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "Der Aufbau in fünf Schritten",
        etappen: [
          { titel: "Stammdaten vereinheitlichen", text: "Name, Anschrift, Telefonnummer, EIN und Website stimmen an jeder Stelle überein: im Register des Bundesstaats, bei der IRS, beim Institut, bei Lieferanten und Auskunfteien." },
          { titel: "D-U-N-S-Nummer anlegen", text: "Dun & Bradstreet vergibt die Nummer ohne Gebühr. Prüfen Sie dort, ob Ihre Gesellschaft schon erfasst ist, und berichtigen Sie abweichende Angaben." },
          { titel: "Geschäftskonto und erste Karte", text: "Das Konto zeigt Umsatz, die erste Firmenkarte die ersten fristgerechten Zahlungen. Ob ein Herausgeber an Wirtschaftsauskunfteien meldet, legt er selbst fest." },
          { titel: "Lieferanten, die melden", text: "Geeignet sind echte Geschäftsbeziehungen mit Zahlungsziel, etwa für Büro, Software, Logistik oder Waren. Voraussetzung ist, dass der Lieferant seine Zahlungserfahrungen an die Auskunfteien meldet." },
          { titel: "Zeit und Kennzahlen", text: "Zahlen Sie fristgerecht, bauen Sie Umsatz und Rücklagen auf und führen Sie ordentliche Abschlüsse. Für ein späteres Bankdarlehen zählen die Kennzahlen der Gesellschaft, nicht Scores allein." },
        ],
      },
      {
        typ: "karten", id: "warnung", h2: "Drei Warnzeichen bei Anbietern", spalten: 3,
        karten: [
          { tag: "Warnzeichen", titel: "Lieferantenkonten ohne Geschäft", text: "Manche Anbieter verkaufen Konten mit Zahlungsziel, die nur dem Score dienen sollen. Ein Konto ohne echtes Geschäft hält der Prüfung durch ein Institut nicht stand." },
          { tag: "Warnzeichen", titel: "Zugesagte Rahmen", text: "Über einen Kreditrahmen entscheidet das Institut. Ein Anbieter, der Ihrer Gesellschaft eine bestimmte Höhe zusagt, kann diese Zusage nicht selbst einlösen." },
          { tag: "Warnzeichen", titel: "Karten statt Darlehen", text: "Auf Klage der US-Handelsaufsicht FTC ist einem Anbieter seit 2025 dauerhaft untersagt, Finanzierungen anzubieten. Er hatte mit Unternehmensfinanzierung geworben und gegen hohe Gebühren Kreditkarten beantragt." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Die Grundlage legen wir mit der Gründung: Wir verwenden in jeder Unterlage und jedem Antrag dieselben Stammdaten, beantragen die EIN und stellen US-Geschäftsadresse und US-Telefonnummer bereit. Konto- und Kartenanträge bereiten wir vollständig vor; Sie stellen sie selbst.",
          `${FINANZIERUNG.satz} ${satz("S9")}`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${INSTITUT}`,
          P.geldZurueck,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Scores legen die Auskunfteien fest, Rahmen die Institute. Niemand kann einen bestimmten Wert zusagen.",
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Bei jungen Gesellschaften ersetzt die Historie der Gesellschaft nicht die persönliche Haftung des Inhabers.",
        ],
      },
    ],
    fragen: [
      { f: "Was ist eine D-U-N-S-Nummer?", a: "Die D-U-N-S-Nummer ist die neunstellige Kennung von Dun & Bradstreet für Unternehmen, vergeben je Standort. Dun & Bradstreet vergibt sie ohne Gebühr. Sie ist die Grundlage für den PAYDEX und die Akte Ihrer Gesellschaft bei Dun & Bradstreet." },
      { f: "Was ist ein guter PAYDEX?", a: "Ab 80 gilt das Risiko eines Zahlungsverzugs als gering, von 50 bis 79 als mittel, darunter als hoch." },
      { f: "Wie lange dauert es, Business Credit aufzubauen?", a: "Einen PAYDEX gibt es erst, wenn genügend Zahlungserfahrungen gemeldet sind. Das ist meist nach einigen Monaten mit mehreren Geschäftspartnern der Fall. Eine Historie, die Herausgebern ohne persönliche Haftung genügt, entsteht erst über Jahre." },
      { f: "Brauche ich Business Credit für eine Firmenkarte?", a: "Bei jungen Gesellschaften prüfen Herausgeber vor allem die persönliche Kredithistorie des Inhabers und verlangen seine persönliche Haftung. Die Historie der Gesellschaft gewinnt mit den Jahren an Gewicht." },
      // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — Wortlaut aus GLOBAL_KAPITAL_FREI (eine Quelle); seit E-510 als Frage statt im Abschnitt über uns.
      { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
    ],
    paket: "global_kapital",
    weiter: ["/business/firmenkarten-kapital", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-bankkonto-unterlagen"],
    quellen: [Q.duns, Q.paydex, Q.experian, Q.ftcSeek],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8 · DIE US-FIRMENKARTE — Prüfung, Haftung, Einführungszeitraum, Warnzeichen
  {
    pfad: "/business/wissen/us-firmenkarte-beantragen",
    art: "wissen",
    seo: {
      titel: "US-Firmenkarte beantragen: Kriterien, Haftung — FIAON Global",
      beschreibung: "US-Firmenkarte für die LLC: was Herausgeber prüfen, was persönliche Haftung heißt, wann der Einführungszeitraum endet, woran Sie Unseriöses erkennen.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 37",
    auge: "Wissen · Firmenkarten",
    h1: "Die US-Firmenkarte.",
    h1b: "Wie Herausgeber entscheiden.",
    lead: "Eine US-Firmenkarte ist für eine junge Gesellschaft der übliche erste Kredit. Über jeden Antrag entscheidet der Herausgeber nach eigener Prüfung; Werbung im Netz mit „hohen Rahmen für jede LLC“ ändert daran nichts. Dieser Beitrag nennt, was der Herausgeber prüft, was Sie unterzeichnen und woran Sie unseriöse Angebote erkennen.",
    ziffern: [
      { wert: "persönlich", label: "haftet der Inhaber in der Regel mit" },
      { wert: "Reg Z", label: "Verbraucherschutz gilt für Firmenkarten nur teilweise" },
      { wert: "10/2025", label: "dauerhaftes Verbot für einen Anbieter (FTC v. Seek Capital)" },
    ],
    blick: [
      ["Wer entscheidet", "Der Herausgeber, nach eigenen Regeln"],
      ["Was er prüft", "Persönliche Kredithistorie, Einkommen, Geschäft, Unterlagen"],
      ["Haftung", "Persönliche Haftung des Inhabers ist die Regel"],
      ["Einführungszeitraum", "Endet zu einem festen Datum — danach gilt der reguläre Zins des Herausgebers"],
      ["Verbraucherschutz", "Für Firmenkarten nur eingeschränkt"],
      ["Warnzeichen", "Zugesagte Rahmen, Honorar je Kartenantrag, „Darlehen“ statt Karten"],
      ["Mit FIAON Global", "Jeder Antrag einzeln vorbereitet — auf Wunsch, ohne zusätzliches Honorar von FIAON"],
    ],
    kurz: "Über eine US-Firmenkarte entscheidet der Herausgeber. Bei einer jungen Gesellschaft prüft er vor allem die persönliche US-Kredithistorie des Inhabers, Einkommen, Geschäft und Unterlagen. In der Regel verlangt er die persönliche Haftung des Inhabers. Ein Einführungszeitraum endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo. Die meisten Regeln des Verbraucherschutzes gelten für Firmenkarten nicht; maßgeblich ist der Kartenvertrag. Einen Rahmen kann kein Anbieter zusagen.",
    bloecke: [
      {
        typ: "text", id: "pruefung", h2: "Was ein Herausgeber prüft",
        absaetze: ["Eine neue Gesellschaft hat weder Kredithistorie noch Bilanz noch Umsatz über Jahre. Der Herausgeber prüft deshalb, was vorliegt:"],
        punkte: [
          "die persönliche Kredithistorie des Inhabers in den USA, über SSN oder ITIN",
          "das Einkommen des Inhabers und den Umsatz der Gesellschaft, soweit vorhanden",
          "die Unterlagen: Gründung, EIN, Anschrift, Telefonnummer, Konto",
          "das Geschäft: was die Gesellschaft tut und ob es zu den Angaben passt",
          "die Zahl der Anträge und neuen Konten der letzten Monate",
        ],
        nach: "Ohne persönliche US-Kredithistorie kommen weniger Herausgeber in Betracht. Manche prüfen Anträge mit ITIN, manche nur mit SSN, manche verlangen ein bestehendes Konto beim Herausgeber selbst. Diese Vorgaben ändern sich; jeder Herausgeber legt sie selbst fest.",
      },
      {
        typ: "text", id: "haftung", h2: "Persönliche Haftung: was Sie unterzeichnen",
        absaetze: [
          "Mit fast jeder Firmenkarte für eine junge Gesellschaft übernimmt der Inhaber die persönliche Haftung („personal guarantee“). Zahlt die Gesellschaft nicht, haftet er selbst. Die beschränkte Haftung der LLC schützt ihn in diesem Fall nicht.",
          "Behandeln Sie die Karte deshalb wie einen persönlichen Kredit. Geben Sie nur aus, was die Gesellschaft sicher zurückzahlen kann.",
        ],
      },
      {
        typ: "text", id: "einfuehrung", h2: "Der Einführungszeitraum und sein Ende",
        absaetze: [
          `${EINFUEHRUNG} Ein solcher Zeitraum ist ein Kredit auf Zeit. Er endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo.`,
          "Wer einen Einführungszeitraum nutzt, plant deshalb dessen Ende: Die Rückzahlung kommt aus dem Geschäft, nicht aus der nächsten Karte. Gebühren, etwa für Bargeld oder Überträge von anderen Karten, erfasst der Zeitraum oft nicht. Sie fallen ab dem ersten Tag an.",
        ],
        nach: "Beleg: Im Fall FTC v. Seek Capital stellte das Gericht fest, dass der Anbieter auch Karten ohne einen solchen Einführungszeitraum beantragt hatte (Entscheidung vom 16. September 2025, siehe Quellen).",
      },
      {
        typ: "tabelle", id: "schutz", h2: "Schutzregeln für Privat- und Firmenkarte",
        kopf: ["", "Karte für private Zwecke", "Karte für geschäftliche Zwecke"],
        zeilen: [
          ["Regeln des Truth in Lending Act (Regulation Z)", "gelten umfassend", "gelten nur für die Ausgabe der Karte und die Haftung bei Missbrauch"],
          ["Schutz des CARD Act, etwa bei Zinserhöhungen", "ja", "in der Regel nein"],
          ["Haftung bei unbefugter Nutzung", "gesetzlich begrenzt", "gesetzlich begrenzt; bei zehn und mehr Karten eines Unternehmens abweichend vereinbar"],
          ["Wer die Bedingungen bestimmt", "Gesetz und Vertrag", "vor allem der Vertrag"],
        ],
        fuss: ["Nach 12 CFR 1026.3 und 1026.12 (Regulation Z) mit der amtlichen Kommentierung; vereinfachte Übersicht."],
      },
      {
        typ: "text", id: "stapeln", h2: "Serienanträge: ein Fall der FTC",
        absaetze: [
          "Manche Anbieter beantragen gegen hohe Gebühren mehrere Karten mit Einführungszeitraum in kurzer Zeit und bezeichnen das als „Finanzierung“. Das Risiko trägt der Unternehmer: viele Anfragen in kurzer Zeit, eine hohe Auslastung und die persönliche Haftung für jede Karte. Hinzu kommt, dass alle Einführungszeiträume zugleich enden.",
          "Die Folgen zeigt ein Fall der US-Handelsaufsicht FTC. Ein Anbieter hatte mit Unternehmensfinanzierung geworben und für seine Kunden ausschließlich Kreditkarten beantragt, gegen Gebühren von mehreren Tausend Dollar. Ein US-Bundesgericht stellte im September 2025 fest, dass er seine Kunden dabei getäuscht hatte. Die Täuschung betraf unter anderem seine Beziehungen zu Kreditgebern, die Gebühren und harte Anfragen bei Auskunfteien. Seit Oktober 2025 ist ihm und seinem Gründer dauerhaft untersagt, Unternehmern Finanzierungen anzubieten. Das Geldurteil lautet auf 48,28 Millionen US-Dollar. Es ist zum Teil ausgesetzt, weil die Beklagten es nicht vollständig leisten können.",
        ],
      },
      {
        typ: "karten", id: "warnzeichen", h2: "Sechs Warnzeichen bei Anbietern", spalten: 3,
        karten: [
          { tag: "Warnzeichen", titel: "Ein Rahmen wird zugesagt", text: "Über jeden Rahmen entscheidet der Herausgeber. Ein Anbieter, der eine Höhe zusagt, kann diese Zusage nicht selbst einlösen." },
          { tag: "Warnzeichen", titel: "Honorar, das mit jedem Kartenantrag wächst", text: "Ein Anbieter, der an jeder weiteren Karte verdient, hat einen Anreiz zu weiteren Anträgen, auch wenn sie Ihrer Kreditakte schaden. Verlangen Sie Honorar und Leistungsverzeichnis schriftlich, bevor Sie unterzeichnen." },
          { tag: "Warnzeichen", titel: "„Darlehen“, das eine Karte ist", text: "Eine Kreditkarte ist kein Darlehen. Wer „Darlehen“ oder „Kreditlinie“ ankündigt und Kartenanträge stellt, verschweigt, was Sie unterzeichnen." },
          { tag: "Warnzeichen", titel: "Viele Anträge an einem Tag", text: "Anträge in Serie belasten Ihre Kreditakte und erschweren jede weitere Entscheidung eines Herausgebers." },
          { tag: "Warnzeichen", titel: "Kein Hinweis auf die Haftung", text: "Wer die persönliche Haftung nicht nennt, verschweigt eine wesentliche Pflicht aus jeder Firmenkarte." },
          { tag: "Warnzeichen", titel: "Verbot von Bewertungen", text: "Klauseln, die Kunden negative Bewertungen untersagen, sind in den USA unzulässig. Ein Vertrag mit einer solchen Klausel ist ein Warnzeichen." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${KARTEN.satz} Wir bereiten jeden Kartenantrag einzeln und vollständig vor. Anträge in Serie bereiten wir nicht vor.`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
          `${TEIL.bedingung}: ${KARTEN.bedingung}`,
          `Honorar: ${beleg("honorarVorab")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die Kartenanträge in Ihrem Mandat", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Ein Einführungszeitraum endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers.",
          satz("S8"),
        ],
      },
    ],
    fragen: [
      { f: "Kann meine LLC eine US-Firmenkarte beantragen?", a: "Ja. Ob eine Karte ausgegeben wird, entscheidet der Herausgeber. Bei jungen Gesellschaften prüft er vor allem die persönliche US-Kredithistorie des Inhabers und verlangt dessen persönliche Haftung. Ohne SSN oder ITIN kommen nur wenige Herausgeber in Betracht." },
      { f: "Hafte ich persönlich für die Firmenkarte meiner LLC?", a: "In der Regel ja. Fast alle Herausgeber verlangen bei jungen Gesellschaften die persönliche Haftung des Inhabers. Die beschränkte Haftung der LLC schützt Sie in diesem Fall nicht." },
      { f: "Was passiert nach dem Einführungszeitraum?", a: "Er endet zu einem festen Datum. Danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo. Höhe und Bedingungen legt jeder Herausgeber selbst fest." },
      { f: "Gilt der US-Verbraucherschutz für Firmenkarten?", a: "Nur eingeschränkt. Für Karten zu geschäftlichen Zwecken gelten aus Regulation Z vor allem die Regeln zur Ausgabe der Karte und zur Haftung bei Missbrauch. Die Schutzregeln des CARD Act, etwa bei Zinserhöhungen, gelten in der Regel nicht." },
      { f: "Woran erkenne ich unseriöse Anbieter für Firmenkarten?", a: "An sechs Warnzeichen: zugesagte Rahmen, ein Honorar, das mit jedem Kartenantrag wächst, und „Darlehen“, die Kartenanträge sind. Hinzu kommen viele Anträge an einem Tag, kein Hinweis auf die persönliche Haftung und ein Verbot von Bewertungen im Vertrag." },
    ],
    paket: "global_banking",
    weiter: ["/business/firmenkarten-kapital", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/business-credit-usa", "/business/wissen/anbieter-pruefen"],
    quellen: [Q.regZ3, Q.regZ12, Q.ftcSeek, Q.ftcSeekUrteil],
  },
];
