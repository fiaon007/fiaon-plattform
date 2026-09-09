// /ratgeber · /en/guide — Wörterbuch (09.09.2026, E-100)
// Der Ratgeber war bis hierher einsprachig: kein Sprachfeld, eine Route, kein
// hreflang. Generator teilt an „const en".
const de = {
  metaTitel: "Ratgeber", dokumentTitel: "Ratgeber · Bonität verstehen · FIAON",
  metaBeschreibung: "Bonität verstehen: SCHUFA-Einträge löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüft, ehrlich, ohne Versprechen.",
  pille: "Ratgeber · Bonität verstehen",
  heroA: "Wissen, das ", heroB: "Einträge bewegt.",
  heroLead: "Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – für Deutschland, Österreich und die Schweiz. Jeder Text wird gegen Gesetz, Verhaltensregeln der Auskunfteien und die Praxis aus FIAON-Akten geprüft.",
  heroKnopf: "Artikel lesen", heroKnopfStill: "Auskunft beschaffen lassen",

  themenPille: "Alle Themen", themenA: "Ehrlich erklärt. ", themenB: "Nichts versprochen.",
  themenLead: "Wählen Sie ein Thema – oder lesen Sie von oben. Neue Texte erscheinen laufend.",
  alle: "Alle", laden: "Ratgeber werden geladen …",
  leer: "In dieser Kategorie ist noch kein Text erschienen – bald.",
  lesezeit: "Min. Lesezeit", lesen: "Lesen →",

  werkzeugePille: "Werkzeuge", werkzeugeA: "Kostenlos, sofort, ", werkzeugeB: "ohne Anmeldung.",
  werkzeugLabel: "Werkzeug", sofort: "Sofort, ohne Anmeldung",
  werkzeuge: [
    { pfad: "/werkzeuge/eintrag-pruefen", titel: "Ist mein Eintrag angreifbar?", text: "Fünf Fragen, eine ehrliche Einschätzung nach § 31 BDSG, Löschfristen und BGH-Rechtsprechung – mit Ihrem nächsten Schritt.", dauer: "2 Minuten", tat: "Prüfen →" },
    { pfad: "/werkzeuge/selbstauskunft", titel: "Selbstauskunft-Generator", text: "Der fertige Brief für Ihre kostenlose Datenkopie nach Art. 15 DSGVO – an SCHUFA, KSV1870, CRIF oder Intrum. Kopieren, drucken, absenden.", dauer: "1 Minute", tat: "Brief erstellen →" },
    { pfad: "/werkzeuge/loeschfrist", titel: "Löschfrist-Rechner", text: "Art des Eintrags und Daten eingeben – das taggenaue Löschdatum, inklusive 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/bonitaetsindex", titel: "Bonitätsindex-Deuter", text: "Für Unternehmen: Index von 100 bis 600 einordnen – mit der veröffentlichten Ausfallwahrscheinlichkeit und den Merkmalen, die am schwersten wiegen.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/verzugszinsen", titel: "Verzugsrechner für Firmen", text: "Neun Prozentpunkte über dem Basiszins und 40 Euro je Rechnung – taggenau gerechnet, mit fertiger Nachforderung.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/inkassokosten", titel: "Inkassokosten-Prüfer", text: "Rechnet die zulässigen Gebühren nach RVG und § 13e RDG nach – und liefert die Formulierung für die Zurückweisung überhöhter Posten.", dauer: "", tat: "" },
  ],

  autorinPille: "Wer schreibt",
  zwischenruf: "Lesen hilft. Handeln hilft mehr: FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag und bereitet die Schreiben vor.",
  zwischenrufKnopf: "Konto eröffnen", zwischenrufStill: "Was ist FIAON",

  laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", DACH: "DACH" } as Record<string, string>,
  gebiet: "de-DE",

  // Artikelseite
  aZurueck: "Alle Ratgeber", aFehltTitel: "Diesen Text gibt es nicht.",
  aInhalt: "Inhalt", aFragen: "Häufige Fragen", aWeiter: "Weiterlesen",
  aVon: "Von", aGeprueft: "Geprüft gegen Gesetzestexte, die Verhaltensregeln der Auskunfteien und die Praxis aus FIAON-Akten.",
  aLaden: "Der Text wird geladen …", aFehltStandard: "Diesen Ratgeber gibt es nicht.",
  aNichtErreichbar: "Der Ratgeber ist gerade nicht erreichbar.",
  aTocKnopf: "Auskunft beschaffen", aTocKlein: "Konto in zwei Minuten · Einsicht in 24 Stunden",
  aEinschubKlein: "Was FIAON übernimmt", aEinschubFett: "Auskunft beschaffen, jeden Eintrag erklären, Schreiben versenden, Fristen halten.",
  aEinschubText: "Konto in zwei Minuten, Einsicht in 24 Stunden. Danach Girokonto für jeden Kunden – und die Karte, sobald der Wert reicht.",
  aEinschubKnopf: "Konto eröffnen", aVorschau: "Vorschau",
  aHinweis: "Dieser Text informiert allgemein über Rechte und Abläufe rund um Auskunfteien und ersetzt keine Rechtsberatung im Einzelfall. FIAON beschafft Auskünfte, erklärt Einträge und bereitet Schreiben vor – über Konto, Karte und Rahmen entscheidet immer die Bank. Stand: ",
  aZwischenruf: "Sie möchten wissen, welche Ihrer Einträge angreifbar sind? FIAON beschafft die Auskunft und erklärt jeden Eintrag – innerhalb von 24 Stunden.",
  aMin: "Min.",
};

const en: typeof de = {
  metaTitel: "Guide", dokumentTitel: "Guide · understanding credit standing · FIAON",
  metaBeschreibung: "Understanding credit standing: deleting SCHUFA entries, requesting your data copy free of charge, a card despite an entry, KSV and CRIF – checked, honest, without promises.",
  pille: "Guide · understanding credit standing",
  heroA: "Knowledge that ", heroB: "moves entries.",
  heroLead: "Which entries can be challenged, how the free copy of your data works, what is realistic despite an entry – for Germany, Austria and Switzerland. Every text is checked against the law, the credit agencies' codes of conduct and the practice in FIAON case files.",
  heroKnopf: "Read the articles", heroKnopfStill: "Have your report obtained",

  themenPille: "All topics", themenA: "Explained honestly. ", themenB: "Nothing promised.",
  themenLead: "Pick a topic – or read from the top. New texts appear continuously.",
  alle: "All", laden: "Loading the guide …",
  leer: "No text has appeared in this category yet – soon.",
  lesezeit: "min read", lesen: "Read →",

  werkzeugePille: "Tools", werkzeugeA: "Free, instant, ", werkzeugeB: "no sign-up.",
  werkzeugLabel: "Tool", sofort: "Instant, no sign-up",
  werkzeuge: [
    { pfad: "/werkzeuge/eintrag-pruefen", titel: "Can my entry be challenged?", text: "Five questions, an honest assessment under Section 31 BDSG, deletion periods and case law – with your next step.", dauer: "2 minutes", tat: "Check →" },
    { pfad: "/werkzeuge/selbstauskunft", titel: "Data copy request generator", text: "The finished letter for your free copy of your data under Article 15 GDPR – to SCHUFA, KSV1870, CRIF or Intrum. Copy, print, send.", dauer: "1 minute", tat: "Draft the letter →" },
    { pfad: "/werkzeuge/loeschfrist", titel: "Deletion deadline calculator", text: "Enter the type of entry and the dates – the deletion date to the day, including the 100-day rule and the six-month period after discharge.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/bonitaetsindex", titel: "Business credit index reader", text: "For companies: place an index from 100 to 600 – with the published probability of default and the features that carry the most weight.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/verzugszinsen", titel: "Late payment calculator", text: "Nine percentage points above base rate and 40 euro per invoice – calculated to the day, with the demand ready to send.", dauer: "", tat: "" },
    { pfad: "/werkzeuge/inkassokosten", titel: "Debt collection cost checker", text: "Recalculates the permissible fees under RVG and Section 13e RDG – and supplies the wording to reject excessive items.", dauer: "", tat: "" },
  ],

  autorinPille: "Who writes here",
  zwischenruf: "Reading helps. Acting helps more: FIAON obtains your report, explains every entry and prepares the letters.",
  zwischenrufKnopf: "Open an account", zwischenrufStill: "What FIAON is",

  laender: { DE: "Germany", AT: "Austria", CH: "Switzerland", DACH: "DACH" } as Record<string, string>,
  gebiet: "en-GB",

  aZurueck: "All guides", aFehltTitel: "This text does not exist.",
  aInhalt: "Contents", aFragen: "Common questions", aWeiter: "Read on",
  aVon: "By", aGeprueft: "Checked against statutes, the credit agencies' codes of conduct and the practice in FIAON case files.",
  aLaden: "Loading the text …", aFehltStandard: "This guide does not exist.",
  aNichtErreichbar: "The guide is not reachable at the moment.",
  aTocKnopf: "Obtain your report", aTocKlein: "Account in two minutes · sight of your file within 24 hours",
  aEinschubKlein: "What FIAON takes on", aEinschubFett: "Obtaining the report, explaining every entry, sending the letters, keeping the deadlines.",
  aEinschubText: "An account in two minutes, sight of your file within 24 hours. After that a current account for every customer – and the card once the standing carries it.",
  aEinschubKnopf: "Open an account", aVorschau: "Preview",
  aHinweis: "This text gives general information about rights and procedures involving credit agencies and is not legal advice in an individual case. FIAON obtains reports, explains entries and prepares letters – the bank always decides on the account, the card and the limit. As at: ",
  aZwischenruf: "Would you like to know which of your entries can be challenged? FIAON obtains the report and explains every entry – within 24 hours.",
  aMin: "min",
};

export const RATGEBER_WOERTER = { de, en };
