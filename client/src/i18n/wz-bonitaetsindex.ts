// /werkzeuge/bonitaetsindex · /en/tools/business-credit-index — Wörterbuch (09.09.2026, E-099)
// Erstes Werkzeug für Firmenkunden. Generator teilt an „const en".
const de = {
  metaTitel: "Bonitätsindex-Deuter · Was Ihre Firmennote bedeutet",
  metaBeschreibung: "Creditreform-Bonitätsindex eingeben: Der Deuter nennt die Klasse, die veröffentlichte Ausfallwahrscheinlichkeit und die zwei Merkmale, die zusammen die Hälfte des Werts ausmachen. Kostenlos.",
  seoTitel: "Bonitätsindex-Deuter: Was Ihre Firmennote bedeutet",
  seoBeschreibung: "Bonitätsindex zwischen 100 und 600 eingeben – der Deuter nennt Klasse, Ausfallwahrscheinlichkeit und die Stellhebel nach der Gewichtung von Creditreform.",
  werkzeugName: "Bonitätsindex-Deuter", krumeWerkzeuge: "Werkzeuge", krume: "Bonitätsindex-Deuter",
  pille: "Werkzeug für Unternehmen · kostenlos, ohne Anmeldung",
  h1a: "Ihr Bonitätsindex: ", h1b: "Was diese drei Ziffern auslösen",
  lead: "Zwischen 100 und 600 entscheidet eine dreistellige Zahl darüber, ob Ihr Lieferant auf Rechnung liefert. Tragen Sie Ihren Wert ein: Der Deuter nennt die Klasse, die von Creditreform veröffentlichte Ausfallwahrscheinlichkeit und die beiden Merkmale, die zusammen die Hälfte der Note ausmachen.",

  schritt1: "Schritt 1", frage1: "Welchen Bonitätsindex hat Ihr Unternehmen?",
  hinweis1: "Der Wert steht auf jeder Creditreform-Auskunft über Ihr Unternehmen. Kennen Sie ihn nicht, führt Sie Schritt 3 zu der Stelle, die ihn herausgeben muss.",
  index: "Bonitätsindex (100–600)", bspIndex: "z. B. 249",
  schritt2: "Schritt 2", frage2: "Wie zahlen Sie Ihre eigenen Rechnungen?",
  hinweis2: "Die Zahlungsweise ist mit 25 Prozent das schwerste Einzelmerkmal – gleichauf mit dem Krediturteil. Zusammen tragen die beiden die Hälfte des Index.",
  zahlPuenktlich: "Innerhalb der vereinbarten Ziele", zahlPuenktlichHinweis: "Keine Mahnungen offen",
  zahlSpaet: "Regelmäßig ein paar Tage später", zahlSpaetHinweis: "Mahnungen kommen vor",
  zahlStreit: "Es gibt eine offene, bestrittene Forderung", zahlStreitHinweis: "Oder ein Inkassofall läuft",

  ergebnisTitel: (i: string) => `Bonitätsindex ${i}`,
  klasse: "Klasse", pd: "Ausfallwahrscheinlichkeit", schnitt: "Deutscher Durchschnitt",
  k1: "sehr gute Bonität", k2: "gute Bonität", k3: "mittlere Bonität",
  k4: "schwächere Bonität", k5: "erhöhtes Risiko", k6: "hohes Risiko", k7: "Ausfall",
  deutungGut: "In diesem Bereich liefern Lieferanten in aller Regel auf Rechnung, und Banken prüfen ohne besondere Auflagen. Der Wert ist ein Aktivposten – er lässt sich in Verhandlungen über Zahlungsziele einsetzen.",
  deutungMittel: "Hier beginnt der Bereich, in dem Warenkreditversicherer und Einkaufsabteilungen genauer hinsehen. Geschäfte kommen zustande, aber Zahlungsziele werden kürzer und Limits kleiner.",
  deutungSchwach: "Ab etwa 300 verschlechtern sich Zahlungsbedingungen in der Praxis spürbar: Vorkasse, Anzahlungen, gekürzte Limits. Hier lohnt der Blick auf die Einzelmerkmale, bevor der nächste Lieferant absagt.",
  deutungAusfall: "Die Werte 500 und 600 gelten bei Creditreform als Ausfall. Das ist keine Prognose über Ihr Unternehmen, sondern eine Einstufung aus vorliegenden Merkmalen – und genau deshalb lohnt die Prüfung, ob diese Merkmale stimmen.",
  vergleich: (pd: string) => `Die von Creditreform veröffentlichte Ausfallwahrscheinlichkeit dieser Klasse liegt bei ${pd} im Jahr. Der Durchschnitt über alle deutschen Unternehmen lag bei 1,43 Prozent.`,

  hebelTitel: "Wo die Note entsteht",
  hebelText: "Creditreform veröffentlicht die Gewichtung der Merkmale. Zwei davon können Sie unmittelbar beeinflussen – sie machen zusammen die Hälfte aus:",
  hebel: [
    { m: "Zahlungsweise", g: "25 %", t: "Wie Ihre Lieferanten Ihr Zahlungsverhalten melden. Das einzige Merkmal, das sich in Wochen ändern lässt." },
    { m: "Krediturteil", g: "25 %", t: "Die Einschätzung von Creditreform, bis zu welcher Höhe eine Geschäftsverbindung tragbar ist." },
    { m: "Bilanzbonität", g: "10 %", t: "Kennzahlen aus dem Jahresabschluss. Wirkt mit der Verzögerung der Offenlegung." },
    { m: "Branchenrisiko", g: "6 %", t: "Nicht beeinflussbar." },
    { m: "Umsatz, Kapital, Auftragslage, Unternehmensentwicklung", g: "je 5 %", t: "Struktur und Entwicklung." },
    { m: "Rechtsform, Unternehmensalter, Mitarbeiterzahl", g: "je 4 %", t: "Eine junge GmbH startet strukturell schlechter als ein alter Betrieb – das ist normal und wächst sich aus." },
    { m: "Umsatz je Mitarbeiter", g: "2 %", t: "Produktivitätskennzahl." },
  ],

  ratPuenktlich: "Ihre Zahlungsweise trägt zum Ergebnis bei, statt es zu belasten. Der schnellste verbleibende Hebel ist die Offenlegung: Ein fristgerecht eingereichter Jahresabschluss wirkt auf die Bilanzbonität, ein fehlender wirkt gegen Sie.",
  ratSpaet: "Ein paar Tage Verzug wirken stärker, als die meisten annehmen – die Zahlungsweise ist ein Viertel der Note. Wer die zehn größten Lieferanten konsequent innerhalb des Ziels bezahlt, verändert das schwerste Merkmal, ohne einen Cent mehr auszugeben.",
  ratStreit: "Eine offene oder bestrittene Forderung schlägt über die Zahlungsweise und das Krediturteil doppelt durch. Prüfen Sie zuerst, ob sie berechtigt ist: Eine bestrittene Forderung darf nicht wie eine anerkannte behandelt werden.",

  schritt3: "So kommen Sie an Ihre eigene Auskunft",
  schritt3Text: "Ihr Unternehmen ist keine natürliche Person – das Auskunftsrecht aus Art. 15 DSGVO greift für die juristische Person nicht. Es greift aber für Sie persönlich, wenn Sie als Inhaber, Gesellschafter oder Geschäftsführer in der Auskunft vorkommen. Und unabhängig davon geben die Auskunfteien Unternehmen Einsicht in den eigenen Datensatz.",
  schritt3Punkte: [
    "Creditreform: Selbstauskunft über die für Ihren Sitz zuständige Vereinsniederlassung.",
    "Für Sie persönlich: Datenkopie nach Art. 15 DSGVO, kostenlos, Frist ein Monat.",
    "Weitere Stellen mit Firmendaten: CRIF, SCHUFA (Inhaberdaten), in Österreich KSV1870.",
  ],

  standTitel: "Stand und Quelle",
  stand: "Creditreform, Flyer „Wirtschaftsinformationen · Creditreform Bonitätsindex“ (C2001.2024.01): Skala 100 bis 500 und 600, Gewichtung der zwölf Merkmale, Ausfallwahrscheinlichkeiten für den Zeitraum September 2022 bis September 2023; die Werte 500 und 600 gelten als Ausfall. Durchschnittliche Ausfallwahrscheinlichkeit deutscher Unternehmen 1,43 Prozent (Stand September 2023). Abgerufen am 9. September 2026.",
  grenze: "Was der Deuter nicht kann",
  grenzeText: "Creditreform veröffentlicht die Gewichtung, nicht die Formel. Der Deuter ordnet Ihren Wert also ein und zeigt, wo die Merkmale liegen – er rechnet keinen neuen Index aus und sagt keine Kreditlinie voraus. Über Limits entscheidet immer der Lieferant oder die Bank, nicht die Auskunftei. Liegen unklare Sachverhalte vor, vergibt Creditreform gar keinen Index.",

  fuss: "Der Deuter läuft vollständig in Ihrem Browser. Keine Eingabe verlässt Ihr Gerät, nichts wird gespeichert.",
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Ist ein niedriger Bonitätsindex gut oder schlecht?", a: "Niedrig ist gut. Die Skala läuft von 100 (sehr gute Bonität) bis 600 (Zahlungseinstellung) – anders als beim SCHUFA-Score für Privatpersonen, wo ein hoher Wert der bessere ist. Diese Umkehrung führt regelmäßig zu Missverständnissen in Gesprächen mit der Bank." },
    { f: "Wie schnell ändert sich der Index?", a: "Die Zahlungsweise ist das beweglichste Merkmal: Neue Zahlungserfahrungen von Lieferanten fließen laufend ein. Strukturmerkmale wie Rechtsform, Alter oder Bilanzkennzahlen ändern sich nur mit dem Jahresabschluss oder gar nicht. Eine spürbare Bewegung nach unten braucht daher Monate, keine Tage." },
    { f: "Darf ich meinen eigenen Index erfahren?", a: "Ja. Auskunfteien geben Unternehmen Einsicht in den über sie geführten Datensatz. Kommen Sie als Inhaber oder Geschäftsführer persönlich darin vor, haben Sie zusätzlich das Auskunftsrecht aus Art. 15 DSGVO auf Ihre personenbezogenen Daten – kostenlos, mit einer Frist von einem Monat." },
    { f: "Was ist der Unterschied zwischen Bonitätsindex und Krediturteil?", a: "Der Bonitätsindex ist die verdichtete Gesamtnote als dreistellige Zahl. Das Krediturteil ist eines der zwölf Merkmale, die in sie einfließen – die Aussage, ob und in welchem Rahmen eine Geschäftsverbindung aus Sicht der Auskunftei tragbar ist. Es wiegt ein Viertel." },
    { f: "Mein Index hat sich verschlechtert, obwohl ich pünktlich zahle. Warum?", a: "Häufige Ursachen sind ein fehlender oder verspätet offengelegter Jahresabschluss, eine Veränderung im Branchenrisiko, ein Wechsel der Rechtsform – oder eine gemeldete Zahlungserfahrung, die nicht stimmt. Der letzte Fall ist der einzige, den Sie mit einer Berichtigung angreifen können; deshalb lohnt der Blick in den eigenen Datensatz." },
  ],
  zwischenrufFett: "Die Zahl ist nicht das Problem – die Merkmale dahinter sind es.",
  zwischenruf: " FIAON beschafft die Unternehmens- und Inhaberauskunft, erklärt jeden Eintrag und bereitet Berichtigungen vor.",
  zwischenrufKnopf: "FIAON Business ansehen", weiterLink: "Falsche Zahlungserfahrung korrigieren",
};

const en: typeof de = {
  metaTitel: "Business credit index reader · what your rating means",
  metaBeschreibung: "Enter your Creditreform business credit index: the reader gives the class, the published probability of default and the two features that together make up half the rating. Free.",
  seoTitel: "Business credit index reader: what your rating means",
  seoBeschreibung: "Enter a business credit index between 100 and 600 – the reader gives the class, the probability of default and the levers, based on Creditreform's published weighting.",
  werkzeugName: "Business credit index reader", krumeWerkzeuge: "Tools", krume: "Business credit index reader",
  pille: "Tool for companies · free, no sign-up",
  h1a: "Your business credit index: ", h1b: "what those three digits trigger",
  lead: "Between 100 and 600, a three-digit number decides whether your supplier ships on account. Enter your value: the reader gives the class, the probability of default published by Creditreform, and the two features that together make up half the rating.",

  schritt1: "Step 1", frage1: "What is your company's credit index?",
  hinweis1: "The value appears on every Creditreform report about your company. If you do not know it, step 3 points you to the office that has to disclose it.",
  index: "Credit index (100–600)", bspIndex: "e.g. 249",
  schritt2: "Step 2", frage2: "How do you pay your own invoices?",
  hinweis2: "Payment behaviour carries 25 per cent, the heaviest single feature – level with the credit assessment. Together the two carry half the index.",
  zahlPuenktlich: "Within the agreed terms", zahlPuenktlichHinweis: "No reminders outstanding",
  zahlSpaet: "Regularly a few days late", zahlSpaetHinweis: "Reminders do occur",
  zahlStreit: "There is an open, disputed claim", zahlStreitHinweis: "Or a collection case is running",

  ergebnisTitel: (i: string) => `Credit index ${i}`,
  klasse: "Class", pd: "Probability of default", schnitt: "German average",
  k1: "very good standing", k2: "good standing", k3: "medium standing",
  k4: "weaker standing", k5: "elevated risk", k6: "high risk", k7: "default",
  deutungGut: "In this range suppliers generally ship on account and banks review without special conditions. The value is an asset – you can put it to work when negotiating payment terms.",
  deutungMittel: "This is where trade credit insurers and purchasing departments start looking more closely. Business still happens, but payment terms shorten and limits shrink.",
  deutungSchwach: "From around 300, payment conditions noticeably deteriorate in practice: prepayment, deposits, reduced limits. It is worth examining the individual features before the next supplier says no.",
  deutungAusfall: "Creditreform treats the values 500 and 600 as default. That is not a forecast about your company but a classification drawn from the features on file – which is precisely why it is worth checking whether those features are correct.",
  vergleich: (pd: string) => `The probability of default published by Creditreform for this class is ${pd} a year. The average across all German companies was 1.43 per cent.`,

  hebelTitel: "Where the rating comes from",
  hebelText: "Creditreform publishes the weighting of the features. Two of them are directly in your hands – and together they make up half:",
  hebel: [
    { m: "Payment behaviour", g: "25 %", t: "How your suppliers report the way you pay. The only feature that can change within weeks." },
    { m: "Credit assessment", g: "25 %", t: "Creditreform's view of the volume a business relationship can carry." },
    { m: "Balance sheet standing", g: "10 %", t: "Figures from the annual accounts. Takes effect with the delay of filing." },
    { m: "Sector risk", g: "6 %", t: "Outside your control." },
    { m: "Turnover, capital, order book, company development", g: "5 % each", t: "Structure and trajectory." },
    { m: "Legal form, company age, headcount", g: "4 % each", t: "A young limited company starts structurally weaker than an established firm – that is normal and grows out over time." },
    { m: "Turnover per employee", g: "2 %", t: "Productivity ratio." },
  ],

  ratPuenktlich: "Your payment behaviour is adding to the result rather than dragging it down. The quickest remaining lever is filing: annual accounts submitted on time feed the balance sheet standing, missing accounts count against you.",
  ratSpaet: "A few days of delay weigh more heavily than most people assume – payment behaviour is a quarter of the rating. Paying your ten largest suppliers consistently within terms moves the heaviest feature without spending a cent more.",
  ratStreit: "An open or disputed claim hits twice, through payment behaviour and through the credit assessment. Check first whether it is justified: a disputed claim must not be treated like an acknowledged one.",

  schritt3: "How to obtain your own report",
  schritt3Text: "Your company is not a natural person, so the right of access under Article 15 GDPR does not apply to the legal entity. It does apply to you personally where you appear in the report as owner, shareholder or managing director. Independently of that, the agencies do give companies sight of their own record.",
  schritt3Punkte: [
    "Creditreform: self-disclosure through the branch responsible for your registered office.",
    "For you personally: a copy of your data under Article 15 GDPR, free of charge, within one month.",
    "Other offices holding company data: CRIF, SCHUFA (owner data), and KSV1870 in Austria.",
  ],

  standTitel: "Source and date",
  stand: "Creditreform, brochure “Wirtschaftsinformationen · Creditreform Bonitätsindex” (C2001.2024.01): scale 100 to 500 and 600, weighting of the twelve features, probabilities of default for the period September 2022 to September 2023; the values 500 and 600 count as default. Average probability of default of German companies 1.43 per cent (as at September 2023). Retrieved 9 September 2026.",
  grenze: "What the reader cannot do",
  grenzeText: "Creditreform publishes the weighting, not the formula. So the reader places your value and shows where the features sit – it does not compute a new index and does not predict a credit line. Limits are always set by the supplier or the bank, never by the agency. Where matters are unclear, Creditreform issues no index at all.",

  fuss: "The reader runs entirely in your browser. Nothing you enter leaves your device, nothing is stored.",
  fragenTitel: "Common questions",
  fragen: [
    { f: "Is a low business credit index good or bad?", a: "Low is good. The scale runs from 100 (very good standing) to 600 (cessation of payments) – unlike the SCHUFA score for individuals, where a high value is the better one. This reversal causes regular misunderstandings in conversations with banks." },
    { f: "How quickly does the index change?", a: "Payment behaviour is the most mobile feature: new payment experiences from suppliers feed in continuously. Structural features such as legal form, age or balance sheet ratios change only with the annual accounts, or not at all. A noticeable downward movement therefore takes months, not days." },
    { f: "Am I allowed to see my own index?", a: "Yes. Agencies give companies sight of the record held about them. Where you appear personally as owner or managing director, you additionally have the right of access to your personal data under Article 15 GDPR – free of charge, within one month." },
    { f: "What is the difference between the credit index and the credit assessment?", a: "The credit index is the condensed overall rating as a three-digit number. The credit assessment is one of the twelve features feeding into it – the statement of whether, and at what volume, a business relationship is sustainable in the agency's view. It carries a quarter of the weight." },
    { f: "My index has worsened although I pay on time. Why?", a: "Common causes are annual accounts missing or filed late, a change in sector risk, a change of legal form – or a reported payment experience that is simply wrong. The last case is the only one you can attack with a correction, which is why it pays to look at your own record." },
  ],
  zwischenrufFett: "The number is not the problem – the features behind it are.",
  zwischenruf: " FIAON obtains the company and owner reports, explains every entry and prepares corrections.",
  zwischenrufKnopf: "See FIAON Business", weiterLink: "Correct a wrong payment record",
};

export const WZ_BONITAETSINDEX_WOERTER = { de, en };
