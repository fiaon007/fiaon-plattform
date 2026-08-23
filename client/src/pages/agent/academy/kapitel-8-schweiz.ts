// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 8 — Schweiz: Betreibungsregister, CRIF, Intrum (23.08.2026)
// Quellen: client/src/pages/site/schweiz.tsx, shared/fiaon-wissen.ts, SchKG, OR,
// revidiertes DSG (1.9.2023). Keine deutschen Regeln übertragen.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, merk, warn, tab, sagen, muster, schritte, quellen, frage } from "./typen";

export const KAPITEL_8: KapitelInhalt = {
  inhalte: {
    system: {
      einleitung: "In der Schweiz ist der wichtigste Hebel kein privater Score, sondern ein Amt: das Betreibungsamt am Wohnort. Dazu zwei private Stellen – CRIF und Intrum.",
      bloecke: [
        tab(["Stelle", "Was sie ist", "Wer fragt dort ab"],
          ["Betreibungsregister", "Register des Betreibungsamts (Gemeinde/Bezirk/Kanton) über alle Betreibungen – auch unberechtigte – der letzten fünf Jahre", "Vermieter, Arbeitgeber, Mobilfunkanbieter, Banken – sie verlangen den Auszug vom Kunden"],
          ["CRIF AG (Zürich)", "Private Auskunftei: Zahlungserfahrungen aus Handel, Telekommunikation, Kredit; Scores für Online-Händler und Banken", "Online-Shops, Telekommunikation, Banken"],
          ["Intrum AG", "Inkassounternehmen mit eigener Bonitätsdatenbank – wer Post von Intrum hatte, ist meist auch dort gespeichert", "Intrum-Kunden, Händler"],
          ["ZEK / IKO", "Zentralstelle für Kreditinformation (Banken, Leasing, Kreditkarten) und Informationsstelle für Konsumkredit (gesetzlich, KKG)", "Banken und Kreditkartenherausgeber bei Kredit- und Kartenanträgen"],
        ),
        p("Eine Betreibung ist schnell eingeleitet – jeder Gläubiger kann sie ohne Beweis beim Betreibungsamt beantragen. Sie steht fünf Jahre im Auszug, auch wenn die Forderung unbegründet war. Deshalb ist in der Schweiz die Betreibung oft das Problem, nicht der Eintrag bei CRIF."),
        ul(
          "Rechtsrahmen: Bundesgesetz über Schuldbetreibung und Konkurs (SchKG); Obligationenrecht (OR) für Verjährung und Verzug; revidiertes Datenschutzgesetz (DSG) seit 1. September 2023; Aufsicht: Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB).",
          "Die DSGVO gilt in der Schweiz nicht – die Rechte sind ähnlich, die Artikel andere (Art. 25 DSG statt Art. 15 DSGVO).",
          "Sprache und Ton: Schweizer Kunden erwarten Sachlichkeit und Präzision; „Betreibung“, „Zahlungsbefehl“, „Rechtsvorschlag“ sind Alltagsbegriffe, die du richtig benutzen musst.",
        ),
        merk("In der Schweiz beschafft FIAON den Betreibungsregisterauszug sowie die Auskünfte bei CRIF und Intrum – mit Vollmacht, ohne Behördengang."),
        quellen("SchKG, insbesondere Art. 8a, 67 ff., 74, 80 ff., 149a", "Bundesgesetz über den Datenschutz (DSG), in Kraft seit 1.9.2023", "Seite fiaon.com/schweiz"),
      ],
    },
    betreibung: {
      einleitung: "Zahlungsbefehl, Rechtsvorschlag, Rechtsöffnung, Auszug – der Ablauf einer Betreibung, den du erklären können musst.",
      bloecke: [
        schritte("Der Ablauf",
          ["1 · Betreibungsbegehren", "Der Gläubiger stellt es beim Betreibungsamt am Wohnort des Schuldners – ohne Beweis der Forderung. Ab jetzt steht die Betreibung im Register."],
          ["2 · Zahlungsbefehl", "Das Amt stellt ihn dem Schuldner zu (Art. 69 ff. SchKG). Darin: Gläubiger, Forderung, Hinweis auf den Rechtsvorschlag."],
          ["3 · Rechtsvorschlag", "Innerhalb von zehn Tagen ab Zustellung kann der Schuldner mündlich oder schriftlich beim Amt Rechtsvorschlag erheben (Art. 74 SchKG) – ohne Begründung. Die Betreibung ist damit gestoppt; der Gläubiger muss vor Gericht."],
          ["4 · Rechtsöffnung / Klage", "Der Gläubiger kann beim Gericht die Rechtsöffnung verlangen (Art. 80 ff. SchKG – provisorisch bei Schuldanerkennung, definitiv bei Urteil) oder klagen. Tut er nichts, bleibt die Betreibung stehen – und im Auszug."],
          ["5 · Fortsetzung, Pfändung, Verlustschein", "Ohne Rechtsvorschlag oder nach Rechtsöffnung: Fortsetzungsbegehren, Pfändung. Reicht das Vermögen nicht: Verlustschein – 20 Jahre vollstreckbar (Art. 149a SchKG)."],
        ),
        tab(["Im Auszug sichtbar", "Wie lange", "Grundlage"],
          ["Betreibungen (auch mit Rechtsvorschlag, auch bezahlte)", "5 Jahre nach Abschluss", "Art. 8a Abs. 4 SchKG"],
          ["Verlustscheine", "bis zur Tilgung oder Verjährung (20 Jahre)", "Art. 149a SchKG"],
          ["Nichtig erklärte / gerichtlich aufgehobene Betreibungen", "nicht mehr sichtbar", "Art. 8a Abs. 3 lit. a/b SchKG"],
          ["Vom Gläubiger zurückgezogene Betreibungen", "nicht mehr sichtbar", "Art. 8a Abs. 3 lit. c SchKG"],
          ["Betreibungen mit Gesuch um Nichtbekanntgabe (seit 2019)", "nicht mehr an Dritte bekannt gegeben", "Art. 8a Abs. 3 lit. d SchKG"],
        ),
        warn("Der Rechtsvorschlag ist kein Widerspruch gegen den Eintrag – die Betreibung bleibt im Register. Er verhindert nur die Fortsetzung. Wer den Auszug sauber will, braucht Rückzug, Aufhebung oder das Gesuch nach Art. 8a Abs. 3 lit. d."),
        merk("Zehn Tage. Der wichtigste Satz für einen Schweizer Kunden mit frischem Zahlungsbefehl: „Innerhalb von zehn Tagen ab Zustellung können Sie beim Betreibungsamt Rechtsvorschlag erheben – ohne Begründung.“ Die Entscheidung trifft er."),
        quellen("Art. 8a, 67–69, 74, 80–84, 88, 149a SchKG", "Bundesamt für Justiz: Merkblatt Betreibungsregisterauszug"),
      ],
    },
    "crif-intrum": {
      einleitung: "Die privaten Datenbanken: CRIF sammelt, Intrum treibt ein und speichert. Beide geben Auskunft nach DSG.",
      bloecke: [
        tab(["", "CRIF AG", "Intrum AG"],
          ["Daten", "Zahlungserfahrungen (Handel, Telekommunikation, Kredit), Adressdaten, Betreibungsdaten (aus öffentlichen Quellen), Scores", "Inkassofälle mit Gläubiger, Betrag, Status; eigene Bonitätsdaten"],
          ["Typische Folge", "Ablehnung beim Online-Kauf auf Rechnung oder Handyvertrag", "Zahlungsdruck, Betreibung, Eintrag in der eigenen Datenbank"],
          ["Auskunft", "Art. 25 DSG – kostenlos, in der Regel innerhalb von 30 Tagen", "Art. 25 DSG – kostenlos, 30 Tage"],
          ["Berichtigung / Löschung", "Art. 32 DSG (Berichtigung); Löschung bei unrichtigen oder nicht mehr erforderlichen Daten", "dito; dazu Forderungsprüfung (besteht sie? verjährt nach OR?)"],
          ["Aufsicht", "EDÖB; Zivilklage möglich (Art. 32 DSG)", "EDÖB; Inkasso ist in der Schweiz nicht bewilligungspflichtig (kantonal unterschiedlich)"],
        ),
        ul(
          "Inkassokosten: In der Schweiz gibt es keine Gebührentabelle wie RVG oder IGV. Geschuldet ist der Verzugsschaden (Art. 106 OR) – pauschale „Inkassogebühren“ oder „Verzugsschaden“-Posten sind nur geschuldet, wenn sie vereinbart oder nachgewiesen sind. Verzugszins gesetzlich 5 % (Art. 104 OR).",
          "Verjährung nach OR: allgemein zehn Jahre (Art. 127 OR); fünf Jahre für Miet- und Pachtzinsen, Kapitalzinsen, Lebensmittel, Handwerkerarbeiten, Detailverkauf von Waren, ärztliche Besorgungen, Anwaltshonorare (Art. 128 OR). Verlustschein: 20 Jahre.",
          "Die Verjährung muss auch in der Schweiz eingewendet werden (Art. 142 OR: Der Richter darf sie nicht von Amtes wegen berücksichtigen).",
        ),
        warn("Der deutsche Verjährungs-Rechner (drei Jahre ab Jahresende) ist für die Schweiz falsch. Regeln nennen, Fall an das Back-Office – das prüft nach OR."),
        quellen("Art. 25, 32 DSG", "Art. 104, 106, 127, 128, 142 OR", "CRIF AG: Auskunftsformular (crif.ch); Intrum AG: Datenschutzinformation"),
      ],
    },
    rechte: {
      einleitung: "Die Rechte-Landkarte für die Schweiz nach dem revidierten Datenschutzgesetz – seit 1. September 2023.",
      bloecke: [
        tab(["Thema", "Schweiz", "Nicht verwechseln mit Deutschland"],
          ["Auskunft", "Art. 25 DSG – kostenlos (Ausnahmen bei unverhältnismäßigem Aufwand), Antwort innerhalb von 30 Tagen", "Art. 15 DSGVO, ein Monat"],
          ["Berichtigung", "Art. 32 Abs. 1 DSG – Anspruch auf Berichtigung unrichtiger Daten; Bestreitungsvermerk, wenn Richtigkeit nicht feststeht", "Art. 16 DSGVO"],
          ["Löschung / Unterlassung", "Art. 32 Abs. 2 DSG i. V. m. Art. 28 ZGB – bei widerrechtlicher Persönlichkeitsverletzung (z. B. unrichtige oder nicht mehr erforderliche Bonitätsdaten)", "Art. 17 DSGVO"],
          ["Bonitätsdaten", "Art. 31 Abs. 2 lit. c DSG: Rechtfertigungsgrund für Auskunfteien – nur Daten, die nicht älter als zehn Jahre sind, die betroffene Person ist volljährig, Daten werden nur für Vertragsabschluss/-abwicklung Dritten bekannt gegeben", "–"],
          ["Aufsicht", "EDÖB – kann Untersuchungen führen und Verfügungen erlassen; keine Bussen gegen Unternehmen, aber gegen Privatpersonen bei Verletzung von Pflichten (Art. 60 ff. DSG)", "Datenschutzbehörden mit Bussgeldern"],
          ["Betreibung", "SchKG: Rechtsvorschlag 10 Tage; Nichtbekanntgabe Art. 8a Abs. 3 lit. d nach 3 Monaten; Auszug 5 Jahre", "kein Gegenstück"],
          ["Basiskonto", "Kein allgemeiner Rechtsanspruch; PostFinance hat einen Grundversorgungsauftrag (Zahlungsverkehr für Personen mit Wohnsitz in der Schweiz); FIAON arbeitet mit Partnerbanken", "ZKG-Anspruch in DE"],
          ["Privatkonkurs", "Privatkonkurs (Art. 191 SchKG) führt NICHT zur Schuldbefreiung – Verlustscheine bleiben; eine Entschuldung nach deutschem Muster gibt es nicht (Revision in Diskussion)", "Restschuldbefreiung in DE"],
        ),
        warn("Kein Privatkonkurs-Versprechen: In der Schweiz gibt es keine Restschuldbefreiung wie in Deutschland. Wer das verwechselt, richtet Schaden an. Der Weg in der Schweiz ist die Einigung mit dem Gläubiger und das saubere Register."),
        quellen("Bundesgesetz über den Datenschutz (DSG) vom 25.9.2020, in Kraft 1.9.2023: Art. 25, 31, 32, 60 ff.", "Art. 28 ZGB", "Art. 8a, 191 SchKG", "Postgesetz (Grundversorgung Zahlungsverkehr)"),
      ],
    },
    wege: {
      einleitung: "Nichtbekanntgabe, Rückzug, Berichtigung – die drei Wege zu einem sauberen Auszug, und was FIAON dabei übernimmt.",
      bloecke: [
        schritte("Der Weg",
          ["1 · Auszug und Auskünfte", "Betreibungsregisterauszug (vom Amt am Wohnort – und von früheren Wohnorten der letzten fünf Jahre), CRIF, Intrum. Mit Vollmacht."],
          ["2 · Jede Betreibung einordnen", "Gläubiger, Betrag, Stand (Zahlungsbefehl, Rechtsvorschlag, Fortsetzung, Verlustschein), Datum. Berechtigt? Bezahlt? Verjährt nach OR? Vom Gläubiger weiterverfolgt?"],
          ["3 · Gesuch um Nichtbekanntgabe (Art. 8a Abs. 3 lit. d SchKG)", "Frühestens drei Monate nach Zustellung des Zahlungsbefehls, wenn der Gläubiger keine Rechtsöffnung, Klage oder Fortsetzung eingeleitet hat. Gesuch beim Betreibungsamt (Gebühr ca. 40 Franken); das Amt setzt dem Gläubiger eine Frist von 20 Tagen, den Nachweis zu erbringen. Kein Nachweis → die Betreibung wird Dritten nicht mehr bekannt gegeben."],
          ["4 · Rückzugserklärung (Art. 8a Abs. 3 lit. c)", "Bei bezahlten oder unbegründeten Betreibungen: Den Gläubiger schriftlich um Rückzug der Betreibung beim Betreibungsamt bitten – oft gegen Zahlung. Nach Rückzug ist sie nicht mehr im Auszug."],
          ["5 · Gerichtliche Aufhebung (Art. 85/85a SchKG)", "Bei nachweislich getilgter oder nicht bestehender Forderung: Klage auf Aufhebung der Betreibung. Anwaltssache – FIAON bereitet die Unterlagen vor."],
          ["6 · Berichtigung bei CRIF / Intrum (Art. 32 DSG)", "Unrichtige oder nicht mehr erforderliche Daten berichtigen oder löschen lassen; Bestreitungsvermerk verlangen, wenn die Richtigkeit strittig ist."],
          ["7 · Nachhalten", "Neuer Auszug nach Erledigung; Fristen in der Akte."],
        ),
        muster("Gesuch um Nichtbekanntgabe (Art. 8a Abs. 3 lit. d SchKG)", "Sehr geehrte Damen und Herren, ich ersuche Sie, die Betreibung Nr. [Nummer] des Gläubigers [Name] (Zahlungsbefehl zugestellt am [Datum]) Dritten nicht mehr bekannt zu geben. Seit der Zustellung sind mehr als drei Monate vergangen; der Gläubiger hat kein Verfahren zur Beseitigung des Rechtsvorschlags eingeleitet. Ich bitte Sie, dem Gläubiger gemäss Art. 8a Abs. 3 lit. d SchKG Frist zum Nachweis anzusetzen. Die Gebühr überweise ich nach Rechnungstellung."),
        muster("Bitte um Rückzug an den Gläubiger", "Sehr geehrte Damen und Herren, die Forderung aus der Betreibung Nr. [Nummer] wurde am [Datum] vollständig beglichen [oder: besteht nicht, Begründung]. Ich ersuche Sie, die Betreibung beim Betreibungsamt [Ort] schriftlich zurückzuziehen (Art. 8a Abs. 3 lit. c SchKG) und mir den Rückzug zu bestätigen."),
        muster("Auskunftsbegehren Art. 25 DSG an CRIF / Intrum", "Gestützt auf Art. 25 DSG ersuche ich um Auskunft über sämtliche zu meiner Person bearbeiteten Personendaten: Inhalt, Herkunft, Zweck, Aufbewahrungsdauer, Empfänger sowie – bei Bonitätsbewertungen – die Logik der Bewertung. Ich bitte um Antwort innerhalb von 30 Tagen. Kopie meines Ausweises liegt bei."),
        merk("In der Schweiz gibt es keine Löschfristen wie die Verhaltensregeln in Deutschland. Der Auszug wird sauber durch Rückzug, Aufhebung oder Nichtbekanntgabe – und das braucht Schreiben, Fristen und Geduld. Genau das übernimmt FIAON."),
        quellen("Art. 8a, 85, 85a SchKG", "Art. 25, 32 DSG", "Bundesamt für Justiz: Erläuterungen zu Art. 8a Abs. 3 lit. d SchKG (Inkrafttreten 1.1.2019)"),
      ],
    },
    sagen: {
      einleitung: "Was ich dem Kunden aus Zürich sage – und was ich nie sage.",
      bloecke: [
        sagen(
          ["„In der Schweiz zählt vor allem der Betreibungsregisterauszug – jede Betreibung steht fünf Jahre drin, auch eine unberechtigte. Wir beschaffen den Auszug sowie die Auskünfte bei CRIF und Intrum.“", "„Innerhalb von zehn Tagen ab Zustellung des Zahlungsbefehls können Sie Rechtsvorschlag erheben – ohne Begründung. Ob Sie das tun, entscheiden Sie.“", "„Hat der Gläubiger nach drei Monaten nichts unternommen, können Sie beim Betreibungsamt beantragen, dass die Betreibung Dritten nicht mehr bekannt gegeben wird. Wir bereiten das Gesuch vor.“", "„Ihr Auskunftsrecht bei CRIF und Intrum steht in Art. 25 DSG – Antwort in 30 Tagen, kostenlos.“", "„Verjährung richtet sich nach dem Obligationenrecht – zehn oder fünf Jahre je nach Forderung. Wir prüfen das Datum.“"],
          ["„Nach drei Jahren ist der Eintrag automatisch weg.“ (keine Löschfrist wie in DE)", "„Mit Rechtsvorschlag ist die Betreibung aus dem Register.“ (falsch – sie bleibt)", "„Nach dem Privatkonkurs sind Sie schuldenfrei.“ (keine Restschuldbefreiung in CH)", "„Die Inkassogebühren sind nach RVG zu hoch.“ (kein RVG in CH)", "„Das regeln wir garantiert.“"],
        ),
      ],
    },
  },
  test: [
    frage("Wie lange steht eine Betreibung im Auszug?", ["1 Jahr", "5 Jahre", "10 Jahre", "bis zur Zahlung"], 1, "Art. 8a Abs. 4 SchKG – auch unberechtigte und bezahlte."),
    frage("Frist für den Rechtsvorschlag?", ["10 Tage ab Zustellung des Zahlungsbefehls", "30 Tage", "3 Monate", "keine"], 0, "Art. 74 SchKG – ohne Begründung."),
    frage("Was bewirkt der Rechtsvorschlag für den Auszug?", ["Die Betreibung wird gelöscht", "Nichts – sie bleibt sichtbar; er stoppt nur die Fortsetzung", "Sie wird für 3 Monate ausgeblendet", "Der Gläubiger wird gesperrt"], 1, "Sauber wird der Auszug nur durch Rückzug, Aufhebung oder Nichtbekanntgabe."),
    frage("Gesuch um Nichtbekanntgabe – Voraussetzung?", ["Sofort möglich", "Frühestens 3 Monate nach Zustellung, wenn der Gläubiger kein Verfahren eingeleitet hat (Art. 8a Abs. 3 lit. d SchKG)", "Nur mit Anwalt", "Nur bei bezahlten Forderungen"], 1, "Das Amt setzt dem Gläubiger 20 Tage Frist zum Nachweis."),
    frage("Rechtsgrundlage für die Auskunft bei CRIF (CH)?", ["Art. 15 DSGVO", "Art. 25 DSG", "§ 31 BDSG", "Art. 8a SchKG"], 1, "Revidiertes DSG seit 1.9.2023, Antwort in 30 Tagen."),
    frage("Gibt es in der Schweiz eine Restschuldbefreiung wie in Deutschland?", ["Ja, nach 3 Jahren", "Nein – Verlustscheine bleiben 20 Jahre; der Weg ist die Einigung", "Ja, nach 6 Monaten", "Nur in Zürich"], 1, "Das darf man nie verwechseln."),
    frage("Handwerkerrechnung in der Schweiz – Verjährung?", ["3 Jahre ab Jahresende", "5 Jahre (Art. 128 OR)", "30 Jahre", "6 Monate"], 1, "Allgemein 10 Jahre (Art. 127), 5 Jahre für die Fälle des Art. 128 OR."),
  ],
};
