// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: KONTO, BONITÄT, BUSINESS CREDIT, FIRMENKARTEN
// (23.09.2026, E-232)
//
// Vier der zehn Beiträge vom 23.09.2026 (die übrigen sechs: wissen-gruendung.ts).
// Hier ist die Wortwand am engsten: Es geht um Geld, Karten und Rahmen. Deshalb
// steht in jedem Beitrag, wer entscheidet (das Institut, der Herausgeber), was
// der Inhaber unterschreibt (persönliche Haftung) und was FIAON NICHT tut
// (keine Bank, keine Kredite, keine Vermittlung, kein Honorar nach Rahmen).
// Der Fall FTC v. Seek Capital (17.11.2025) steht mit Quelle da — als Maßstab,
// an dem sich jeder Anbieter messen lassen muss, auch FIAON.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN } from "../fiaon-global";
import { FAKTEN_STAND, QUELLEN_WISSEN as Q, SCHWELLEN } from "./fakten";
import type { GlobalSeite } from "./typen";

const S = "2026-09-23";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

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
    erschienen: S,
    kennung: "FG · 34",
    auge: "Wissen · Konto",
    h1: "Das US-Konto der LLC.",
    h1b: "Was Institute sehen wollen.",
    lead: "Ein US-Geschäftskonto scheitert selten an der Gesellschaft, sondern an den Unterlagen: ein fehlendes Dokument, eine Adresse, die nicht passt, ein Geschäft, das niemand versteht. Hier steht, was Institute verlangen, warum sie es verlangen müssen — und wie ein Antrag aussieht, der beim ersten Mal trägt.",
    ziffern: [
      { wert: "7 Unterlagen", label: "die fast jedes Institut verlangt" },
      { wert: "25 %", label: "ab diesem Anteil wird jeder Gesellschafter identifiziert" },
      { wert: "250.000 $", label: "Einlagensicherung je Institut und Kategorie (FDIC)" },
    ],
    blick: [
      ["Voraussetzung", "Eingetragene Gesellschaft mit EIN"],
      ["Pflicht der Institute", "Identität feststellen, Eigentümer ab 25 % erfassen"],
      ["Kernunterlagen", "Gründungsdokument, EIN-Schreiben, Operating Agreement, Pässe"],
      ["Häufigster Ablehnungsgrund", "Unklares Geschäft, unpassende Adresse"],
      ["Einlagensicherung", "250.000 $ je Einleger, Institut und Kategorie"],
      ["Wer entscheidet", "Allein das Institut"],
      ["Mit FIAON Global", "Antrag vollständig vorbereitet, Rückfragen begleitet"],
    ],
    kurz: `Für das Konto einer LLC verlangen US-Institute das Gründungsdokument, die EIN-Bestätigung der IRS, das Operating Agreement, die Pässe aller Gesellschafter ab ${SCHWELLEN.eigentuemer} und der Person, die die Gesellschaft lenkt, Adressnachweise sowie eine nachvollziehbare Beschreibung des Geschäfts mit den erwarteten Zahlungsströmen. Die Institute müssen diese Angaben nach US-Recht erheben; ob und zu welchen Bedingungen sie ein Konto eröffnen, entscheiden sie selbst.`,
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Warum Institute so viel fragen",
        absaetze: [
          "Jedes US-Institut muss vor der Kontoeröffnung die Identität seines Kunden feststellen (Customer Identification Program, 31 CFR 1020.220): Name, Anschrift und eine Identifikationsnummer. Bei Personen ohne US-Staatsbürgerschaft ist das etwa die Passnummer mit dem Ausstellungsland, bei Gesellschaften die EIN und ein physischer Ort der Geschäftstätigkeit.",
          `Dazu kommen die wirtschaftlich Berechtigten (31 CFR 1010.230): jede Person, die mindestens ${SCHWELLEN.eigentuemer} hält, und eine Person, die die Gesellschaft maßgeblich lenkt. Seit Februar 2026 müssen Institute diese Angaben nicht mehr bei jedem weiteren Konto neu prüfen, sondern bei der ersten Eröffnung und wenn Zweifel entstehen — die erste Prüfung bleibt.`,
        ],
      },
      {
        typ: "tabelle", id: "unterlagen", h2: "Die sieben Unterlagen",
        kopf: ["Unterlage", "Wozu", "Worauf es ankommt"],
        zeilen: [
          ["Articles of Organization", "Nachweis, dass die Gesellschaft besteht", "vom Staat eingetragene Fassung, Name exakt wie im Antrag"],
          ["EIN-Bestätigung (CP 575 oder Letter 147C)", "Steuernummer der Gesellschaft", "Name und Anschrift wie im Gründungsdokument"],
          ["Operating Agreement", "Wer beteiligt ist und wer handeln darf", "unterschrieben, Beteiligungen ergeben zusammen 100 Prozent"],
          ["Pässe", "Identität der Gesellschafter ab 25 % und der lenkenden Person", "gültig, gut lesbar, Namen wie im Operating Agreement"],
          ["Adressnachweise", "Wohnanschrift der Beteiligten", "aktuell und auf den Namen der Person"],
          ["Geschäftsbeschreibung", "Was die Gesellschaft tut", "Kunden, Produkte, Länder, erwartete Umsätze und Zahlungswege"],
          ["Herkunft der ersten Einlage", "Woher das erste Geld kommt", "Kontoauszug oder Beleg der Einlage"],
        ],
        fuss: ["Manche Institute verlangen zusätzlich eine Bescheinigung über den ordnungsgemäßen Status (Certificate of Good Standing), eine Website oder erste Verträge."],
      },
      {
        typ: "karten", id: "ablehnung", h2: "Woran Anträge scheitern", spalten: 3,
        karten: [
          { tag: "Grund", titel: "Ein Geschäft, das niemand versteht", text: "„Consulting“ ohne Kunden, ohne Website, ohne Verträge: Das Institut kann das Risiko nicht einschätzen und lehnt ab." },
          { tag: "Grund", titel: "Adressen, die nicht zusammenpassen", text: "Wohnsitz, Geschäftsadresse und die Anschrift im EIN-Schreiben weichen voneinander ab — oder die Geschäftsadresse ist die eines Registered Agent." },
          { tag: "Grund", titel: "Lücken im Operating Agreement", text: "Keine Unterschrift, Beteiligungen ohne Summe, ein Gesellschafter fehlt: Die Angaben zu den Eigentümern lassen sich nicht prüfen." },
          { tag: "Grund", titel: "Branchen mit erhöhtem Risiko", text: "Manche Tätigkeiten prüfen Institute strenger oder gar nicht — das ist ihre Entscheidung, keine Frage der Unterlagen." },
          { tag: "Grund", titel: "Bezüge zu Sanktionsländern", text: "Zahlungen oder Beteiligte mit Bezug zu sanktionierten Ländern führen fast immer zur Ablehnung." },
          { tag: "Grund", titel: "Widersprüche im Gespräch", text: "Wer im Antrag anderes schreibt, als er im Gespräch sagt, verliert das Vertrauen des Instituts — oft endgültig." },
        ],
      },
      {
        typ: "tabelle", id: "art", h2: "Bank oder Finanzplattform?",
        kopf: ["", "Bank", "Finanzplattform"],
        zeilen: [
          ["Eröffnung", "teils nur mit Termin vor Ort", "meist vollständig online"],
          ["Wer das Konto führt", "die Bank selbst", "meist eine Partnerbank im Hintergrund"],
          ["Einlagensicherung", "über die FDIC, wenn die Bank versichert ist", "nur über die Partnerbank und nur unter deren Bedingungen"],
          ["Später: Karten und Darlehen", "oft aus einer Hand", "oft nur Karten"],
        ],
        fuss: ["Allgemeine Übersicht; Leistungen und Bedingungen legt jedes Institut selbst fest."],
      },
      {
        typ: "text", id: "sicherung", h2: "Was die Einlagensicherung abdeckt",
        absaetze: [
          `Die US-Einlagensicherung FDIC schützt ${SCHWELLEN.fdic} je Einleger, je versichertem Institut und je Eigentumskategorie. Eine LLC oder Corporation mit eigenem Geschäft bildet eine eigene Kategorie — ihr Guthaben wird nicht mit Ihren privaten Konten beim selben Institut zusammengerechnet.`,
          "Die Sicherung greift nur, wenn ein versichertes Institut ausfällt. Eine Finanzplattform ist selbst keine Bank; ob und wie Guthaben dort geschützt sind, hängt an der Partnerbank und an den Bedingungen der Plattform.",
        ],
      },
      {
        typ: "etappen", id: "weg", h2: "So läuft ein gut vorbereiteter Antrag",
        etappen: [
          { titel: "Unterlagen bündeln", text: "Alle sieben Unterlagen, mit identischen Namen und Anschriften, in einer Mappe." },
          { titel: "Geschäft beschreiben", text: "Zwei Absätze, die ein Fremder versteht: was, für wen, in welchen Ländern, mit welchen Umsätzen und Zahlungswegen." },
          { titel: "Institut wählen", text: "Nach Geschäft, Währungen, Online-Eröffnung und späteren Karten — nicht nach Werbung." },
          { titel: "Antrag und Rückfragen", text: "Rückfragen kommen fast immer. Wer sie schnell und widerspruchsfrei beantwortet, hat die besten Aussichten." },
          { titel: "Eröffnung und erste Einlage", text: "Nach der Zusage folgt die erste Einlage — mit Beleg, woher das Geld stammt. Bei einer LLC mit ausländischem Gesellschafter ist sie zugleich ein meldepflichtiger Vorgang für Form 5472." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So bringt FIAON Global Ihr Konto auf den Weg",
        absaetze: [
          "Bei FIAON Global beginnt der Kontoantrag nicht mit einem Formular, sondern mit Ihrem Geschäft. Wir schreiben die Geschäftsbeschreibung mit Ihnen, stellen alle Unterlagen mit identischen Angaben zusammen, wählen das Institut nach Ihrem Vorhaben und bereiten den Antrag vollständig vor. Rückfragen des Instituts begleiten wir; verlangt ein Institut einen Termin vor Ort, geht unser Team in Miami mit Ihnen hin.",
          "Das Konto ist der Anfang der Kartenleiter: Mit Global Banking planen wir danach die Reihenfolge weiterer Herausgeber und bereiten jeden Antrag vor.",
          GLOBAL_ROLLEN.de.fiaon,
        ],
      },
      { typ: "paket", id: "paket", h2: "Konto und Kartenleiter im Paket", lead: "Vom ersten Kontoantrag bis zur geplanten Reihenfolge weiterer Herausgeber — Global Banking.", paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Über jedes Konto entscheidet allein das Institut — auch bei vollständigen Unterlagen.",
          `Hält Ihre US-Gesellschaft Konten außerhalb der USA mit zusammen mehr als ${SCHWELLEN.fbar}, meldet sie diese jährlich an FinCEN (FBAR).`,
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Kann ich für meine LLC ein US-Konto eröffnen, ohne in die USA zu reisen?", a: "Oft ja. Viele Institute eröffnen Konten für Gesellschaften mit Gesellschaftern im Ausland online; manche verlangen einen Termin vor Ort. Welche Wege es gibt, legt jedes Institut selbst fest." },
      { f: "Welche Unterlagen brauche ich für ein US-Geschäftskonto?", a: "Gründungsdokument, EIN-Bestätigung, Operating Agreement, die Pässe aller Gesellschafter ab 25 Prozent und der lenkenden Person, Adressnachweise, eine Geschäftsbeschreibung und einen Beleg zur Herkunft der ersten Einlage." },
      { f: "Brauche ich eine SSN oder ITIN für das Konto meiner LLC?", a: "Die Gesellschaft braucht ihre EIN. Für Gesellschafter ohne SSN genügt vielen Instituten der Pass; manche fragen nach einer ITIN." },
      { f: "Warum wurde mein Kontoantrag abgelehnt?", a: "Meist wegen eines unklar beschriebenen Geschäfts, widersprüchlicher Angaben oder einer Adresse, die das Institut nicht akzeptiert. Institute nennen ihre Gründe oft nicht — deshalb zählt der vollständige erste Antrag." },
      { f: "Sind Einlagen auf einem US-Geschäftskonto gesichert?", a: `Bei einem FDIC-versicherten Institut sind Einlagen in Höhe von ${SCHWELLEN.fdic} je Einleger, Institut und Eigentumskategorie geschützt. Bei Finanzplattformen hängt der Schutz an der Partnerbank.` },
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
      beschreibung: "Warum die SCHUFA in den USA nicht zählt, wie der FICO Score entsteht, was ein erster Score braucht und wie eine US-Kredithistorie wächst.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 35",
    auge: "Wissen · Bonität in den USA",
    h1: "Bonität in den USA.",
    h1b: "Sie beginnt bei null.",
    lead: "In Deutschland kennt die SCHUFA Ihre Zahlungsgeschichte seit Jahrzehnten. In den USA kennt Sie niemand — für die dortigen Auskunfteien sind Sie ein unbeschriebenes Blatt. Das ist kein Makel, aber ein Startpunkt. Hier steht, wie eine US-Kredithistorie entsteht und in welcher Reihenfolge sie wächst.",
    ziffern: [
      { wert: "300 – 850", label: "Spanne des FICO Score" },
      { wert: "6 Monate", label: "Mindestalter eines Kontos für einen ersten Score" },
      { wert: "35 %", label: "Gewicht der Zahlungshistorie" },
    ],
    blick: [
      ["Ausgangslage", "SCHUFA-Daten zählen in den USA nicht"],
      ["Die Auskunfteien", "Equifax, Experian, TransUnion"],
      ["Der Score", "FICO, 300 bis 850, aus fünf Faktoren"],
      ["Erster Score", "Ein Konto, mindestens sechs Monate alt, zuletzt gemeldet"],
      ["Schlüssel", "SSN oder ITIN für die persönliche Akte"],
      ["Was trägt", "Pünktlich zahlen, Rahmen wenig ausnutzen, Anträge planen"],
      ["Mit FIAON Global", "Reihenfolge geplant, jeder Antrag vorbereitet"],
    ],
    kurz: "Ihre SCHUFA-Daten zählen in den USA nicht; eine US-Kredithistorie beginnt bei null. Einen ersten FICO Score gibt es, sobald ein Konto mindestens sechs Monate besteht und in den letzten sechs Monaten gemeldet wurde. Der Score (300 bis 850) folgt fünf Faktoren: Zahlungshistorie 35 Prozent, Auslastung 30, Alter der Historie 15, neue Konten 10 und Mischung der Kreditarten 10. Wer pünktlich zahlt, die Rahmen wenig ausnutzt und Anträge plant, baut die Historie am zügigsten auf.",
    bloecke: [
      {
        typ: "text", id: "null", h2: "Warum Sie in den USA bei null beginnen",
        absaetze: [
          "Auskunfteien arbeiten national. Die SCHUFA in Deutschland, die KSV1870 in Österreich oder die CRIF in der Schweiz melden nicht an die US-Auskunfteien Equifax, Experian und TransUnion. Eine lange, saubere Zahlungsgeschichte in Europa zählt beim ersten US-Antrag deshalb in aller Regel nicht — ein alter Eintrag allerdings auch nicht.",
          "Die US-Auskunfteien führen persönliche Akten in der Praxis über die Sozialversicherungsnummer oder die ITIN, dazu Name, Anschrift und Geburtsdatum. Ohne eine dieser Nummern entsteht kaum eine Akte, an die sich Zahlungen knüpfen lassen.",
        ],
      },
      {
        typ: "tabelle", id: "faktoren", h2: "Woraus der FICO Score besteht",
        kopf: ["Faktor", "Gewicht", "Was zählt"],
        zeilen: [
          ["Zahlungshistorie", "35 %", "pünktliche Zahlungen, jeder Verzug, Inkasso"],
          ["Auslastung", "30 %", "wie viel der Rahmen Sie nutzen — gemeldet meist zum Abrechnungsstichtag"],
          ["Alter der Historie", "15 %", "wie lange Ihre Konten bestehen"],
          ["Neue Konten", "10 %", "wie viele Konten Sie zuletzt eröffnet oder beantragt haben"],
          ["Mischung", "10 %", "Karten, Ratenkredite, Hypotheken"],
        ],
        fuss: ["Gewichtung nach FICO für die Bevölkerung insgesamt; bei jungen Akten verschiebt sie sich."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "Die Reihenfolge des Aufbaus",
        etappen: [
          { titel: "Nummer und Anschrift", text: "Eine ITIN oder SSN, eine US-Anschrift, eine Telefonnummer — in allen Anträgen identisch." },
          { titel: "Das erste Konto", text: "Eine persönliche Karte mit kleinem Rahmen, oft gegen Einlage (Secured Card). Ob eine Firmenkarte in Ihrer persönlichen Akte erscheint, regelt jeder Herausgeber selbst." },
          { titel: "Sechs Monate Geduld", text: "Erst nach sechs Monaten mit Meldungen gibt es einen ersten FICO Score. In dieser Zeit zählt nur eines: jede Rechnung pünktlich und vollständig." },
          { titel: "Auslastung niedrig halten", text: "Nutzen Sie die Rahmen nur zu einem kleinen Teil und zahlen Sie vor dem Abrechnungsstichtag — gemeldet wird meist der Saldo an diesem Tag." },
          { titel: "Behutsam erweitern", text: "Mit wachsender Historie folgen weitere Konten — geplant und mit Abstand zwischen den Anträgen, weil jede Anfrage vermerkt wird und jedes neue Konto das Durchschnittsalter senkt." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Was nicht hilft", spalten: 3,
        karten: [
          { tag: "Irrweg", titel: "Viele Anträge auf einmal", text: "Jede Anfrage wird vermerkt, jedes neue Konto senkt das Durchschnittsalter. Ablehnungen in Serie sind der langsamste Weg." },
          { tag: "Irrweg", titel: "Gekaufte Historie", text: "Angebote, sich gegen Gebühr als Zusatznutzer auf fremde Karten setzen zu lassen, sind riskant: Herausgeber können solche Konten schließen, der Nutzen ist ungewiss." },
          { tag: "Irrweg", titel: "„Credit Repair“ gegen Vorkasse", text: "Richtige Einträge kann niemand entfernen lassen. Die US-Handelsaufsicht FTC warnt ausdrücklich vor Diensten, die das versprechen." },
        ],
      },
      {
        typ: "text", id: "einsicht", h2: "Ihre US-Akte selbst prüfen",
        absaetze: [
          "Jede der drei Auskunfteien zeigt Ihnen Ihre Akte kostenlos — gesetzlich einmal im Jahr, über AnnualCreditReport.com, die gemeinsame Stelle der drei, inzwischen dauerhaft jede Woche. Voraussetzung ist, dass es eine Akte gibt: mit SSN oder ITIN und einer US-Anschrift.",
          "Finden Sie einen Fehler — ein fremdes Konto, einen falschen Verzug, eine alte Anschrift —, lassen Sie ihn direkt bei der Auskunftei berichtigen. Das kostet nichts und braucht keinen Dienstleister.",
        ],
      },
      {
        typ: "text", id: "firma", h2: "Persönliche und geschäftliche Historie",
        absaetze: [
          "Neben Ihrer persönlichen Akte kann Ihre Gesellschaft eine eigene Historie bei den Wirtschaftsauskunfteien aufbauen — mit eigener Kennziffer und eigenem Score. Bei einer jungen Gesellschaft schauen Kartenherausgeber aber fast immer zuerst auf die Person dahinter: Die persönliche Haftung ist die Regel, und damit zählt Ihre persönliche Historie.",
          "Beide Historien wachsen am besten zusammen: pünktliche Zahlungen der Gesellschaft, eine saubere persönliche Akte, keine hektischen Anträge.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So baut FIAON Global Ihre US-Historie mit auf",
        absaetze: [
          "Eine US-Kredithistorie entsteht nicht durch einen Trick, sondern nach einem Plan: die richtigen Nummern, identische Angaben, der passende erste Antrag, dann Geduld und Reihenfolge. Genau das ist die Kartenleiter von FIAON Global. Wir sorgen dafür, dass ITIN, Anschrift und Telefonnummer von Anfang an stimmen, planen die Reihenfolge der Herausgeber, bereiten jeden Antrag vollständig vor und gehen jeden Monat mit Ihnen durch, wo Sie stehen.",
          "Über jeden Rahmen entscheidet der Herausgeber. Unsere Aufgabe ist, dass er Ihre Anträge vollständig, widerspruchsfrei und zum richtigen Zeitpunkt sieht.",
        ],
      },
      { typ: "paket", id: "paket", h2: "Die Kartenleiter im Paket", lead: "Gesellschaft, Steuernummern, erste Karte und die geplante Reihenfolge weiterer Herausgeber — Global Banking.", paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Einen bestimmten Score oder Rahmen kann niemand zusagen — der Score folgt den Daten, die Herausgeber melden.",
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Die ITIN dient steuerlichen Zwecken; wer sie hat, übernimmt die zugehörigen Pflichten.",
        ],
      },
    ],
    fragen: [
      { f: "Zählt meine SCHUFA in den USA?", a: "Nein. US-Auskunfteien lesen keine SCHUFA-Daten ein; Ihre US-Kredithistorie beginnt bei null — ohne Vorteil aus guten, aber auch ohne Nachteil aus alten Einträgen." },
      { f: "Wie bekomme ich einen US Credit Score ohne SSN?", a: "Über die ITIN: Auskunfteien führen persönliche Akten in der Praxis über SSN oder ITIN. Einen ersten FICO Score gibt es, sobald ein Konto mindestens sechs Monate besteht und in den letzten sechs Monaten gemeldet wurde." },
      { f: "Wie lange dauert es, eine US-Kredithistorie aufzubauen?", a: "Einen ersten Score gibt es nach etwa sechs Monaten. Eine belastbare Historie, die größere Rahmen trägt, wächst über Jahre — mit pünktlichen Zahlungen und wenigen, geplanten Anträgen." },
      { f: "Wie hoch sollte die Auslastung meiner Karten sein?", a: "So niedrig wie möglich. Die Auslastung macht rund 30 Prozent des FICO Score aus; gemeldet wird meist der Saldo am Abrechnungsstichtag." },
      { f: "Hilft eine Firmenkarte meinem persönlichen Score?", a: "Das regelt jeder Herausgeber selbst: Manche melden Firmenkarten in der persönlichen Akte, manche nur bei Verzug, manche gar nicht." },
    ],
    paket: "global_banking",
    weiter: ["/business/firmenkarten-kapital", "/business/wissen/business-credit-usa", "/business/wissen/itin-beantragen", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [Q.ficoFaktoren, Q.ficoMindest, Q.ftcAuskunft, Q.ftcCredit, Q.itinUebersicht],
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
    erschienen: S,
    kennung: "FG · 36",
    auge: "Wissen · Firmenbonität",
    h1: "Business Credit.",
    h1b: "Die Bonität Ihrer Gesellschaft.",
    lead: "Neben Ihrer persönlichen Akte kann Ihre US-Gesellschaft eine eigene Kreditgeschichte aufbauen — bei Wirtschaftsauskunfteien, mit eigener Kennziffer und eigenem Score. Sie ist der Weg, auf dem eine Gesellschaft irgendwann für sich selbst kreditwürdig wird. Er verläuft in Etappen, und er beginnt nicht mit Karten, sondern mit Stammdaten.",
    ziffern: [
      { wert: "9 Ziffern", label: "D-U-N-S-Nummer, kostenlos" },
      { wert: "80 – 100", label: "PAYDEX: geringes Risiko" },
      { wert: "3 Auskunfteien", label: "Dun & Bradstreet, Experian, Equifax" },
    ],
    blick: [
      ["Was", "Eigene Kreditakte der Gesellschaft bei Wirtschaftsauskunfteien"],
      ["Schlüssel", "D-U-N-S-Nummer bei Dun & Bradstreet, kostenlos"],
      ["Scores", "PAYDEX (1–100), Experian Intelliscore Plus (1–100)"],
      ["Was zählt", "Pünktliche Zahlungen an Lieferanten und Herausgeber"],
      ["Grundlage", "Einheitliche Stammdaten überall"],
      ["Grenze", "Bei jungen Gesellschaften zählt zuerst die persönliche Haftung"],
      ["Mit FIAON Global", "Stammdaten, Reihenfolge, Kennzahlen-Mappe"],
    ],
    kurz: "Business Credit ist die Kreditgeschichte Ihrer Gesellschaft bei den US-Wirtschaftsauskunfteien Dun & Bradstreet, Experian und Equifax. Grundlage ist die kostenlose D-U-N-S-Nummer; bewertet werden vor allem pünktliche Zahlungen an Lieferanten und Herausgeber — beim PAYDEX von Dun & Bradstreet auf einer Skala von 1 bis 100, ab 80 gilt das Risiko als gering. Bei jungen Gesellschaften verlangen Kartenherausgeber trotzdem fast immer die persönliche Haftung des Inhabers; die eigene Historie der Gesellschaft wächst über Jahre.",
    bloecke: [
      {
        typ: "text", id: "zwei", h2: "Zwei Akten, zwei Welten",
        absaetze: [
          "Für Sie persönlich führen Equifax, Experian und TransUnion eine Akte, die ein FICO Score zusammenfasst. Für Ihre Gesellschaft gibt es eine zweite, getrennte Welt: Wirtschaftsauskunfteien, die Zahlungsverhalten, Stammdaten, öffentliche Register und Eigentümer erfassen. Kartenherausgeber, Lieferanten, Vermieter und Versicherer fragen dort nach.",
          "Aussagekräftig wird die Akte Ihrer Gesellschaft erst, wenn Geschäftspartner über sie Zahlungen melden. Bis dahin ist sie dünn — und eine dünne Akte ist für ein Institut kaum besser als keine.",
        ],
      },
      {
        typ: "tabelle", id: "auskunfteien", h2: "Die drei Wirtschaftsauskunfteien",
        kopf: ["", "Dun & Bradstreet", "Experian", "Equifax"],
        zeilen: [
          ["Kennung", "D-U-N-S-Nummer, neun Ziffern, je Standort", "eigene Kennung der Gesellschaft", "eigene Kennung der Gesellschaft"],
          ["Bekannter Score", "PAYDEX, 1 bis 100", "Intelliscore Plus, 1 bis 100", "eigene Scores"],
          ["Was er misst", "wie pünktlich die Gesellschaft Lieferanten bezahlt", "das Risiko eines ernsten Zahlungsverzugs", "Zahlungsverhalten und Ausfallrisiko"],
          ["Eintrag", "kostenlos anlegen und pflegen", "entsteht aus Meldungen und Registern", "entsteht aus Meldungen und Registern"],
        ],
        fuss: [`Nach den Angaben der Auskunfteien, Stand ${FAKTEN_STAND}. Skalen und Modelle ändern die Anbieter von Zeit zu Zeit.`],
      },
      {
        typ: "tabelle", id: "paydex", h2: "Was der PAYDEX bedeutet",
        kopf: ["PAYDEX", "Risiko eines Zahlungsverzugs", "Was es heißt"],
        zeilen: [
          ["80 – 100", "gering", "die Gesellschaft zahlt pünktlich oder früher"],
          ["50 – 79", "mittel", "Zahlungen kommen teils verspätet"],
          ["0 – 49", "hoch", "Zahlungen kommen regelmäßig spät"],
        ],
        fuss: ["Einteilung nach Dun & Bradstreet. Ein Wert entsteht erst, wenn genügend Zahlungserfahrungen gemeldet sind."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "In fünf Etappen zur eigenen Historie",
        etappen: [
          { titel: "Stammdaten vereinheitlichen", text: "Name, Anschrift, Telefonnummer, EIN und Website sind überall identisch — im Register des Staats, bei der IRS, beim Institut, bei Lieferanten und Auskunfteien." },
          { titel: "D-U-N-S-Nummer anlegen", text: "Kostenlos bei Dun & Bradstreet. Prüfen Sie dort auch, ob Ihre Gesellschaft schon erfasst ist, und korrigieren Sie abweichende Angaben." },
          { titel: "Geschäftskonto und erste Karte", text: "Das Konto zeigt Umsatz, die erste Firmenkarte die ersten pünktlichen Zahlungen. Ob ein Herausgeber an Wirtschaftsauskunfteien meldet, legt er selbst fest." },
          { titel: "Lieferanten, die melden", text: "Echte Geschäftsbeziehungen mit Zahlungsziel — für Büro, Software, Logistik oder Waren —, deren Zahlungserfahrungen bei den Auskunfteien ankommen." },
          { titel: "Zeit und Zahlen", text: "Pünktlich zahlen, Umsatz und Rücklagen aufbauen, Abschlüsse sauber führen. Für ein späteres Bankdarlehen zählen am Ende Kennzahlen, nicht Scores allein." },
        ],
      },
      {
        typ: "karten", id: "warnung", h2: "Wovor Sie sich hüten sollten", spalten: 3,
        karten: [
          { tag: "Vorsicht", titel: "Lieferantenkonten ohne Geschäft", text: "Manche Anbieter verkaufen Konten mit Zahlungsziel, die nur dem Score dienen sollen. Was kein echtes Geschäft abbildet, trägt keine Prüfung durch ein Institut." },
          { tag: "Vorsicht", titel: "Versprochene Rahmen", text: "Wer Ihrer Gesellschaft einen Kreditrahmen in bestimmter Höhe verspricht, verspricht, was nur ein Institut entscheiden kann." },
          { tag: "Vorsicht", titel: "Karten statt Darlehen", text: "Die US-Handelsaufsicht FTC hat 2025 einem Anbieter dauerhaft untersagt, Finanzierungen anzubieten: Er hatte Darlehen versprochen und gegen hohe Gebühren Kreditkarten beantragt." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So baut FIAON Global die Historie Ihrer Gesellschaft auf",
        absaetze: [
          "Die Historie einer Gesellschaft lässt sich nicht kaufen — aber planen. FIAON Global legt die Grundlage schon bei der Gründung: identische Stammdaten in allen Registern und Anträgen, EIN, US-Adresse und Telefonnummer, ein Konto, das zum Geschäft passt. Danach planen wir die Reihenfolge der Herausgeber, bereiten jeden Antrag vor und gehen Monat für Monat mit Ihnen durch, was die Auskunfteien über Ihre Gesellschaft wissen.",
          "Mit Global Kapital führen wir diesen Weg bis zur Kennzahlen-Mappe für ein späteres Bankdarlehen — in laufender Abstimmung mit Partner-Anwalt und Partner-Steuerberater.",
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "Der ganze Weg im Paket", lead: "Stammdaten, Kartenleiter über mehrere Herausgeber und die Unterlagen für ein Bankdarlehen — Global Kapital.", paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Scores legen die Auskunfteien fest, Rahmen die Institute. Niemand kann einen bestimmten Wert zusagen.",
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Eine eigene Historie der Gesellschaft ersetzt bei jungen Gesellschaften nicht die persönliche Haftung.",
        ],
      },
    ],
    fragen: [
      { f: "Was ist eine D-U-N-S-Nummer?", a: "Die neunstellige Kennung von Dun & Bradstreet für Unternehmen, vergeben je Standort. Sie ist kostenlos und die Grundlage für den PAYDEX und die Akte Ihrer Gesellschaft bei Dun & Bradstreet." },
      { f: "Was ist ein guter PAYDEX?", a: "Ab 80 gilt das Risiko eines Zahlungsverzugs als gering, von 50 bis 79 als mittel, darunter als hoch." },
      { f: "Wie lange dauert es, Business Credit aufzubauen?", a: "Einen PAYDEX gibt es erst, wenn genügend Zahlungserfahrungen gemeldet sind — meist nach einigen Monaten mit mehreren Geschäftspartnern. Eine Historie, die ohne persönliche Haftung trägt, braucht Jahre." },
      { f: "Brauche ich Business Credit für eine Firmenkarte?", a: "Bei jungen Gesellschaften prüfen Herausgeber vor allem die persönliche Historie des Inhabers und verlangen seine persönliche Haftung. Die Historie der Gesellschaft gewinnt mit den Jahren an Gewicht." },
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
      titel: "US-Firmenkarte beantragen: Prüfung, Haftung — FIAON Global",
      beschreibung: "US-Firmenkarte für die LLC: wie Herausgeber prüfen, was persönliche Haftung heißt, wann der Einführungszeitraum endet und woran Sie Abzocke erkennen.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 37",
    auge: "Wissen · Firmenkarten",
    h1: "Die US-Firmenkarte.",
    h1b: "Wie Herausgeber entscheiden.",
    lead: "Firmenkarten sind in den USA der übliche Einstieg in Kredit für eine junge Gesellschaft — und das beliebteste Werbeversprechen im Netz. Zwischen „hohe Rahmen für jede LLC“ und der Wirklichkeit liegt die Prüfung des Herausgebers. Hier steht, was er prüft, was Sie unterschreiben und woran Sie unseriöse Angebote erkennen.",
    ziffern: [
      { wert: "persönlich", label: "haftet der Inhaber in der Regel mit" },
      { wert: "Reg Z", label: "Verbraucherschutz gilt für Firmenkarten nur teilweise" },
      { wert: "11/2025", label: "FTC untersagt einem Anbieter das Geschäft dauerhaft" },
    ],
    blick: [
      ["Wer entscheidet", "Der Herausgeber — nach eigenen Regeln"],
      ["Was er prüft", "Persönliche Historie, Einkommen, Geschäft, Unterlagen"],
      ["Haftung", "Persönliche Haftung des Inhabers ist die Regel"],
      ["Einführungszeitraum", "Ohne Sollzins auf Zeit — danach gilt der reguläre Zins"],
      ["Verbraucherschutz", "Für Firmenkarten nur eingeschränkt"],
      ["Warnzeichen", "Versprochene Rahmen, Honorar nach Rahmen, „Darlehen“ statt Karten"],
      ["Mit FIAON Global", "Reihenfolge geplant, jeder Antrag vorbereitet, Festpreis"],
    ],
    kurz: "Über eine US-Firmenkarte entscheidet der Herausgeber. Bei einer jungen Gesellschaft prüft er vor allem die persönliche Kredithistorie des Inhabers in den USA, Einkommen, Geschäft und Unterlagen, und er verlangt in der Regel dessen persönliche Haftung. Ein Einführungszeitraum ohne Sollzins endet zu einem festen Datum; danach gilt der reguläre Zins auf den offenen Saldo. Weil die meisten Verbraucherschutzregeln für Firmenkarten nicht gelten, lohnt der genaue Blick in die Bedingungen — und Vorsicht bei jedem, der Rahmen verspricht.",
    bloecke: [
      {
        typ: "text", id: "pruefung", h2: "Was ein Herausgeber prüft",
        absaetze: ["Eine neue Gesellschaft hat keine Historie, keine Bilanz, keinen Umsatz über Jahre. Der Herausgeber schaut deshalb auf das, was er prüfen kann:"],
        punkte: [
          "die persönliche Kredithistorie des Inhabers in den USA — über SSN oder ITIN",
          "das Einkommen des Inhabers und den Umsatz der Gesellschaft, soweit vorhanden",
          "die Unterlagen: Gründung, EIN, Anschrift, Telefonnummer, Konto",
          "das Geschäft: was die Gesellschaft tut und ob es zu den Angaben passt",
          "die Zahl der Anträge und neuen Konten der letzten Monate",
        ],
        nach: "Ohne persönliche US-Historie sind die Wege schmaler: Manche Herausgeber prüfen Anträge mit ITIN, manche nur mit SSN, manche verlangen ein bestehendes Konto bei ihnen. Welche das sind, ändert sich — und entscheidet jeder Herausgeber selbst.",
      },
      {
        typ: "text", id: "haftung", h2: "Persönliche Haftung: was Sie unterschreiben",
        absaetze: [
          "Mit fast jeder Firmenkarte für eine junge Gesellschaft unterschreibt der Inhaber eine persönliche Haftung („personal guarantee“): Zahlt die Gesellschaft nicht, haftet er selbst. Die beschränkte Haftung der LLC schützt ihn dann nicht.",
          "Das spricht nicht gegen die Karte, aber dafür, sie wie einen persönlichen Kredit zu behandeln: nur ausgeben, was die Gesellschaft sicher zurückzahlen kann.",
        ],
      },
      {
        typ: "text", id: "einfuehrung", h2: "Der Einführungszeitraum ohne Sollzins",
        absaetze: [
          "Viele US-Firmenkarten bieten neuen Kunden einen Einführungszeitraum ohne Sollzins auf Einkäufe. Das ist Kredit auf Zeit, kein geschenktes Geld: Der Zeitraum endet zu einem festen Datum, danach gilt der reguläre Zins auf den offenen Saldo — bei Karten meist ein zweistelliger Satz.",
          "Wer einen Einführungszeitraum nutzt, braucht deshalb einen Plan für sein Ende: Rückzahlung aus dem Geschäft, nicht aus der nächsten Karte. Gebühren etwa für Bargeld oder Überträge von anderen Karten sind oft nicht erfasst und kosten ab dem ersten Tag.",
        ],
      },
      {
        typ: "tabelle", id: "schutz", h2: "Privatkarte und Firmenkarte: der Unterschied im Schutz",
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
        typ: "text", id: "stapeln", h2: "„Kartenstapeln“ — und ein Fall der FTC",
        absaetze: [
          "Im Netz wird ein Modell beworben, das mehrere Karten mit Einführungszeitraum auf einmal beantragt und als „Finanzierung“ verkauft — gegen hohe Gebühren. Das Risiko liegt vollständig beim Unternehmer: viele Anfragen auf einmal, hohe Auslastung, persönliche Haftung für jede Karte und ein gemeinsames Ende aller Einführungszeiträume.",
          "Wie das enden kann, zeigt ein Fall der US-Handelsaufsicht FTC: Im November 2025 wurde einem Anbieter und seinem Chef dauerhaft untersagt, Unternehmern Finanzierungen anzubieten. Er hatte Darlehen und Kreditlinien versprochen und stattdessen gegen Gebühren von mehreren Tausend Dollar Kreditkarten beantragt; das Gericht sah darin eine Täuschung. Der Vergleich lautet auf 48,28 Millionen US-Dollar, zum Teil ausgesetzt, weil die Beklagten nicht zahlen können.",
        ],
      },
      {
        typ: "karten", id: "warnzeichen", h2: "Sechs Warnzeichen bei Anbietern", spalten: 3,
        karten: [
          { tag: "Warnzeichen", titel: "Ein Rahmen wird versprochen", text: "Über jeden Rahmen entscheidet der Herausgeber. Wer eine Höhe verspricht, verspricht, was er nicht halten kann." },
          { tag: "Warnzeichen", titel: "Honorar in Prozent des Rahmens", text: "Wer am Rahmen verdient, verdient an jedem weiteren Antrag — auch wenn er Ihnen schadet." },
          { tag: "Warnzeichen", titel: "„Darlehen“, das eine Karte ist", text: "Karten sind Karten. Wer von Darlehen oder Kreditlinie spricht und Kartenanträge meint, täuscht." },
          { tag: "Warnzeichen", titel: "Viele Anträge an einem Tag", text: "Anträge in Serie belasten Ihre Historie und machen jede weitere Entscheidung schwerer." },
          { tag: "Warnzeichen", titel: "Kein Wort zur Haftung", text: "Wer die persönliche Haftung nicht erwähnt, verschweigt das Wichtigste an jeder Firmenkarte." },
          { tag: "Warnzeichen", titel: "Bewertungen verboten", text: "Klauseln, die Kunden negative Bewertungen untersagen, sind in den USA unzulässig — und ein deutliches Signal." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "So bringt FIAON Global Sie zur ersten Karte — und weiter",
        absaetze: [
          "FIAON Global macht aus dem Kartenantrag einen Plan statt einer Wette. Wir legen die Grundlage — Gesellschaft, EIN, ITIN, Anschrift, Telefonnummer, Konto —, wählen den ersten Herausgeber passend zu Ihrer Historie, bereiten den Antrag vollständig vor und planen die Kartenleiter: weitere Herausgeber in der richtigen Reihenfolge, mit Abstand zwischen den Anträgen, begleitet in einem monatlichen Durchgang.",
          "Wir arbeiten zum Festpreis, der vor dem Auftrag feststeht — ohne Honorar nach Rahmen und ohne Anteil am Kapital. Über jeden Rahmen entscheidet der Herausgeber; der Kapitalrahmen Ihres Pakets ist Ihr Ziel, keine Zusage.",
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "Die Kartenleiter im Paket", lead: "Erste Karte, geplante Folgeanträge, monatlicher Durchgang — Global Banking zum Festpreis.", paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Ein Einführungszeitraum ohne Sollzins endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers.",
          "FIAON ist keine Bank, vergibt keine Kredite und vermittelt keine Kredite.",
        ],
      },
    ],
    fragen: [
      { f: "Kann meine LLC eine US-Firmenkarte beantragen?", a: "Ja. Ob eine Karte ausgegeben wird, entscheidet der Herausgeber: Bei jungen Gesellschaften prüft er vor allem die persönliche Historie des Inhabers in den USA und verlangt dessen persönliche Haftung. Ohne SSN oder ITIN sind die Wege schmal." },
      { f: "Hafte ich persönlich für die Firmenkarte meiner LLC?", a: "In der Regel ja. Fast alle Herausgeber verlangen bei jungen Gesellschaften eine persönliche Haftung des Inhabers; die beschränkte Haftung der LLC greift dann nicht." },
      { f: "Was passiert nach dem Einführungszeitraum ohne Sollzins?", a: "Er endet zu einem festen Datum. Danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo — bei Karten meist ein zweistelliger Satz." },
      { f: "Gilt der US-Verbraucherschutz für Firmenkarten?", a: "Nur eingeschränkt. Für Karten zu geschäftlichen Zwecken gelten aus Regulation Z vor allem die Regeln zur Ausgabe der Karte und zur Haftung bei Missbrauch; die Schutzregeln des CARD Act, etwa bei Zinserhöhungen, in der Regel nicht." },
      { f: "Woran erkenne ich unseriöse Anbieter für Firmenkarten?", a: "An versprochenen Rahmen, an Honoraren in Prozent des Rahmens, an „Darlehen“, die sich als Kartenanträge entpuppen, an vielen Anträgen auf einmal und an Verträgen, die Bewertungen verbieten." },
    ],
    paket: "global_banking",
    weiter: ["/business/firmenkarten-kapital", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/business-credit-usa", "/business/wissen/anbieter-pruefen"],
    quellen: [Q.regZ3, Q.regZ12, Q.ftcSeek, Q.ftcSeekUrteil],
  },
];
