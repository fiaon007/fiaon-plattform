// /werkzeuge/selbstauskunft · /en/tools/request-your-data-copy — Wörterbuch (03.09.2026)
// Der Brief selbst bleibt deutsch (Empfänger: SCHUFA, KSV1870, CRIF, Intrum); die englische
// Seite erklärt das und beschriftet das Formular englisch.
const de = {
  metaTitel: "Selbstauskunft-Generator · kostenlose Datenkopie",
  metaBeschreibung: "Erzeugen Sie in einer Minute den fertigen Brief für Ihre kostenlose Datenkopie nach Art. 15 DSGVO – an SCHUFA, KSV1870, CRIF oder Intrum. Kopieren, drucken, absenden.",
  pille: "Werkzeug · kostenlos, ohne Anmeldung", h1a: "Ihre Datenkopie – ", h1b: "der fertige Brief.",
  lead: "Vier Angaben, und der Antrag auf die kostenlose Datenkopie steht – mit den Punkten, die Auskunfteien oft weglassen: Score-Werte, Empfänger, Herkunft. Nichts wird gespeichert; der Brief entsteht in Ihrem Browser.",
  briefErstellen: "Brief erstellen", soFunktioniert: "So funktioniert die Datenkopie",
  blockPille: "Der Generator", blockA: "Ausfüllen, kopieren, ", blockB: "absenden.",
  auskunftei: "Auskunftei", laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" } as Record<string, string>,
  name: "Vor- und Nachname", geburt: "Geburtsdatum", strasse: "Straße und Hausnummer", plzOrt: "PLZ und Ort", frueher: "Frühere Anschrift (optional, hilft bei der Zuordnung)",
  hinweisAusweis: "Legen Sie eine Kopie Ihres Ausweises bei (Vorder- und Rückseite). Nicht benötigte Angaben – Augenfarbe, Größe, Zugangsnummer – dürfen Sie schwärzen; Name, Geburtsdatum, Anschrift und Gültigkeit müssen lesbar bleiben.",
  hinweisSprache: "",
  kopiert: "Kopiert", kopieren: "Brief kopieren", drucken: "Drucken",
  zwischenruf: "Sie möchten die Auskunft nicht selbst beantragen und lesen? FIAON beschafft sie, erklärt jeden Eintrag und bereitet die Schreiben vor.", kontoEroeffnen: "Konto eröffnen", eintragPruefen: "Ist mein Eintrag angreifbar?",
};
const en: typeof de = {
  metaTitel: "Data copy request generator · your free credit report",
  metaBeschreibung: "Generate the finished letter for your free data copy under Article 15 GDPR in one minute – to SCHUFA, KSV1870, CRIF or Intrum. Copy, print, send.",
  pille: "Tool · free, no sign-up", h1a: "Your data copy – ", h1b: "the finished letter.",
  lead: "Four details, and the request for the free data copy is ready – including the points credit bureaus often leave out: score values, recipients, origin. Nothing is stored; the letter is created in your browser.",
  briefErstellen: "Create the letter", soFunktioniert: "How the data copy works",
  blockPille: "The generator", blockA: "Fill in, copy, ", blockB: "send.",
  auskunftei: "Credit bureau", laender: { DE: "Germany", AT: "Austria", CH: "Switzerland" },
  name: "First and last name", geburt: "Date of birth", strasse: "Street and house number", plzOrt: "Postcode and town", frueher: "Previous address (optional, helps with matching)",
  hinweisAusweis: "Enclose a copy of your ID (front and back). Details that are not needed – eye colour, height, access number – may be blacked out; name, date of birth, address and validity must remain legible.",
  hinweisSprache: "The letter is written in German: SCHUFA, KSV1870, CRIF and Intrum process requests in German. Fill in your details here – the placeholders in the letter are replaced automatically, and you can send it exactly as it is.",
  kopiert: "Copied", kopieren: "Copy the letter", drucken: "Print",
  zwischenruf: "You would rather not request and read the report yourself? FIAON obtains it, explains every entry and prepares the letters.", kontoEroeffnen: "Open an account", eintragPruefen: "Can my entry be challenged?",
};
export const WZ_SELBSTAUSKUNFT_WOERTER = { de, en };
