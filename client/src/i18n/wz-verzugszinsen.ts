// /werkzeuge/verzugszinsen · /en/tools/late-payment-interest — Wörterbuch (09.09.2026, E-099)
// Die Nachforderung bleibt DEUTSCH (Empfänger: deutscher Geschäftskunde).
// Generator teilt an „const en".
const de = {
  metaTitel: "Verzugsrechner für Firmen · 9 Punkte und 40 Euro",
  metaBeschreibung: "Rechnung überfällig? Der Rechner ermittelt taggenau die Verzugszinsen nach § 288 Abs. 2 BGB, die 40-Euro-Pauschale und formuliert die Nachforderung. Kostenlos, ohne Anmeldung.",
  seoTitel: "Verzugsrechner für Firmen: Zinsen und 40-Euro-Pauschale",
  seoBeschreibung: "Betrag und Daten eingeben – der Rechner ermittelt Verzugszinsen mit neun Punkten über dem Basiszins, die Pauschale nach § 288 Abs. 5 BGB und den Nachforderungstext.",
  werkzeugName: "Verzugsrechner für Firmen", krumeWerkzeuge: "Werkzeuge", krume: "Verzugsrechner für Firmen",
  pille: "Werkzeug für Unternehmen · kostenlos, ohne Anmeldung",
  h1a: "Ihr Geschäftskunde zahlt nicht. ", h1b: "Das steht Ihnen zu.",
  lead: "Zwischen Unternehmen sind es neun Prozentpunkte über dem Basiszins – fast das Doppelte des Satzes gegenüber Verbrauchern – und dazu eine Pauschale von 40 Euro je Forderung. Der Rechner ermittelt beides taggenau und schreibt die Nachforderung.",

  schritt1: "Schritt 1", frage1: "Um welche Rechnung geht es?",
  betrag: "Offener Betrag (€)", bspBetrag: "z. B. 4.800,00",
  hinweisBrutto: "Tragen Sie den Bruttobetrag ein. Verzugszinsen werden aus der offenen Forderung berechnet, und dazu gehört die ausgewiesene Umsatzsteuer.",
  faellig: "Fällig am", bis: "Berechnet bis",
  hinweisBis: "Voreingestellt ist der heutige Tag. Für ein Mahnschreiben können Sie ein späteres Datum eintragen.",

  schritt2: "Schritt 2", frage2: "Wodurch ist der Verzug eingetreten?",
  hinweis2: "Verzugszinsen laufen nicht ab dem Rechnungsdatum, sondern ab dem Verzug. Das Gesetz kennt dafür drei Wege.",
  wegFrist: "Feste Zahlungsfrist war vereinbart", wegFristHinweis: "„zahlbar bis 30. Juni“ – Verzug ab dem Tag danach, ohne Mahnung (§ 286 Abs. 2 Nr. 1 BGB)",
  wegMahnung: "Ich habe gemahnt", wegMahnungHinweis: "Verzug ab dem Tag nach Zugang der Mahnung (§ 286 Abs. 1 BGB)",
  wegDreissig: "Weder noch", wegDreissigHinweis: "Dann spätestens 30 Tage nach Fälligkeit und Rechnungszugang (§ 286 Abs. 3 BGB)",
  mahnungAm: "Mahnung zugegangen am",

  schritt3: "Schritt 3", frage3: "Ist Ihr Schuldner ein Unternehmen?",
  hinweis3: "Der erhöhte Satz und die Pauschale gelten nur, wenn an dem Geschäft kein Verbraucher beteiligt ist.",
  jaFirma: "Ja, ein Unternehmen", jaFirmaHinweis: "Neun Punkte über Basiszins, 40 Euro Pauschale",
  neinVerbraucher: "Nein, eine Privatperson", neinVerbraucherHinweis: "Fünf Punkte über Basiszins, keine Pauschale",

  stufeOffen: "Verzug läuft", stufeKein: "Noch kein Verzug",
  titel: (tage: number, summe: string) => `${tage} Tage Verzug · ${summe} zusätzlich`,
  titelKein: "Nach diesen Angaben ist noch kein Verzug eingetreten",
  keinText: "Zinsen und Pauschale entstehen erst ab dem Tag, an dem der Verzug beginnt. Prüfen Sie das Datum – oder mahnen Sie, damit die Uhr zu laufen beginnt.",
  zeileZins: "Verzugszinsen", zeilePauschale: "Pauschale § 288 Abs. 5 BGB", zeileSumme: "Zusätzlich zur Hauptforderung", zeileGesamt: "Gesamtforderung",
  verzugAb: "Verzug seit", satzZeile: "Zinssatz",
  teilzeitraeume: "Der Basiszins wird zum 1. Januar und 1. Juli neu festgesetzt. Läuft der Verzug über einen Stichtag, rechnet das Werkzeug jeden Abschnitt einzeln:",
  spalteZeitraum: "Zeitraum", spalteTage: "Tage", spalteSatz: "Satz", spalteZins: "Zinsen",

  formulierung: "Nachforderung zum Kopieren",
  formulierungHinweis: "Der Text bleibt deutsch, weil er an einen deutschen Geschäftskunden geht.",
  kopieren: "Text kopieren", kopiert: "Kopiert",

  anrechnung: "Ein Punkt, den die meisten übersehen",
  anrechnungText: "Die 40 Euro sind auf spätere Kosten der Rechtsverfolgung anzurechnen (§ 288 Abs. 5 Satz 3 BGB). Geben Sie die Sache später an einen Anwalt oder an ein Inkassounternehmen, mindert die Pauschale deren erstattungsfähige Kosten – sie kommt nicht obendrauf. Das macht sie nicht wertlos: Bis dahin ist es Geld, das Ihnen ohne weiteren Aufwand zusteht.",
  agb: "Wegbedingen lässt sich das nicht",
  agbText: "Eine Klausel, die den Anspruch auf Verzugszinsen ausschließt, ist unwirksam. Für den Ausschluss der 40-Euro-Pauschale vermutet das Gesetz sogar ausdrücklich, dass er grob unbillig ist (§ 288 Abs. 6 BGB). Wenn in den Einkaufsbedingungen Ihres Kunden so etwas steht, hindert es Sie nicht.",

  standTitel: "Stand und Quelle",
  stand: "§ 286 Abs. 1–3 BGB (Verzugseintritt), § 288 Abs. 2 BGB (neun Prozentpunkte über dem Basiszinssatz bei Entgeltforderungen ohne Verbraucherbeteiligung), § 288 Abs. 5 BGB (Pauschale 40 Euro, Anrechnung auf Rechtsverfolgungskosten), § 288 Abs. 6 BGB (Unwirksamkeit abweichender Vereinbarungen), § 247 BGB (Basiszinssatz). Basiszinssatz der Deutschen Bundesbank: 3,62 Prozent ab 1. Januar 2024, 3,37 Prozent ab 1. Juli 2024, 2,27 Prozent ab 1. Januar 2025, 1,27 Prozent ab 1. Juli 2025 (zum 1. Januar 2026 unverändert), 1,52 Prozent ab 1. Juli 2026. Abgerufen am 9. September 2026.",
  grenze: "Was der Rechner nicht kann",
  grenzeText: "Er rechnet die gesetzlichen Sätze. Haben Sie im Vertrag einen höheren Zins vereinbart oder können Sie einen konkreten höheren Schaden nachweisen – etwa einen teureren Kontokorrentkredit –, steht Ihnen mehr zu (§ 288 Abs. 3 BGB). Ob die Forderung selbst berechtigt ist, prüft der Rechner nicht; bei einer bestrittenen Forderung gerät der Kunde nicht ohne Weiteres in Verzug.",

  fuss: "Der Rechner läuft vollständig in Ihrem Browser. Keine Eingabe verlässt Ihr Gerät, nichts wird gespeichert.",
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Wie hoch sind Verzugszinsen zwischen Unternehmen genau?", a: "Neun Prozentpunkte über dem Basiszinssatz (§ 288 Abs. 2 BGB). Der Basiszinssatz liegt seit dem 1. Juli 2026 bei 1,52 Prozent, der Verzugszins für Geschäfte ohne Verbraucherbeteiligung damit bei 10,52 Prozent im Jahr. Gegenüber Verbrauchern sind es nur fünf Punkte, also 6,52 Prozent." },
    { f: "Bekomme ich die 40 Euro für jede Rechnung oder einmal?", a: "Je Entgeltforderung. Bleiben drei Rechnungen desselben Kunden offen, entsteht die Pauschale dreimal. Bei Abschlagszahlungen aus einem Vertrag hat der Bundesgerichtshof das anders gesehen – dort fällt sie nur einmal an. Wichtig ist die Anrechnung auf spätere Anwaltskosten." },
    { f: "Ab wann läuft der Verzug?", a: "Nicht ab dem Rechnungsdatum. Entweder ab dem Tag nach einer kalendermäßig bestimmten Zahlungsfrist, ab dem Tag nach Zugang einer Mahnung – oder spätestens 30 Tage nach Fälligkeit und Zugang der Rechnung (§ 286 Abs. 3 BGB). Gegenüber Verbrauchern greift diese 30-Tage-Regel nur, wenn in der Rechnung darauf hingewiesen wurde." },
    { f: "Muss ich Zinsen auf den Netto- oder den Bruttobetrag rechnen?", a: "Auf den offenen Betrag – das ist die Bruttoforderung einschließlich der ausgewiesenen Umsatzsteuer. Der Kunde schuldet den Bruttobetrag, und darauf entstehen die Verzugszinsen." },
    { f: "Lohnt sich das überhaupt bei kleinen Rechnungen?", a: "Bei 800 Euro und 60 Tagen Verzug sind es rund 14 Euro Zinsen plus 40 Euro Pauschale. Der Betrag ist selten der Punkt. Wirksam ist, dass die Forderung sichtbar gestellt wird: Ein Kunde, der weiß, dass mitgezählt wird, zahlt beim nächsten Mal früher – und Ihre eigene Zahlungsweise bleibt sauber, weil das Geld ankommt." },
  ],
  zwischenrufFett: "Offene Rechnungen wirken doppelt.",
  zwischenruf: " Sie fehlen in der Kasse – und die eigene Zahlungsweise ist ein Viertel Ihres Bonitätsindex. FIAON beschafft die Unternehmensauskunft und ordnet, was dort steht.",
  zwischenrufKnopf: "FIAON Business ansehen", weiterLink: "Bonitätsindex einordnen",
};

const en: typeof de = {
  metaTitel: "Late payment calculator for companies · 9 points and 40 euro",
  metaBeschreibung: "Invoice overdue? The calculator works out late payment interest under Section 288(2) BGB to the day, the 40-euro fixed sum, and drafts the demand. Free, no sign-up.",
  seoTitel: "Late payment calculator for companies: interest and 40 euro",
  seoBeschreibung: "Enter the amount and the dates – the calculator works out interest at nine points above base rate, the fixed sum under Section 288(5) BGB and the demand text.",
  werkzeugName: "Late payment calculator for companies", krumeWerkzeuge: "Tools", krume: "Late payment calculator",
  pille: "Tool for companies · free, no sign-up",
  h1a: "Your business customer is not paying. ", h1b: "Here is what you are owed.",
  lead: "Between companies it is nine percentage points above the base rate – almost double the rate that applies to consumers – plus a fixed sum of 40 euro per claim. The calculator works out both to the day and drafts the demand.",

  schritt1: "Step 1", frage1: "Which invoice is this about?",
  betrag: "Outstanding amount (€)", bspBetrag: "e.g. 4,800.00",
  hinweisBrutto: "Enter the gross amount. Late payment interest is calculated on the outstanding claim, and that includes the VAT shown on the invoice.",
  faellig: "Due on", bis: "Calculated to",
  hinweisBis: "Today's date is preset. For a reminder letter you can enter a later date.",

  schritt2: "Step 2", frage2: "How did the default arise?",
  hinweis2: "Interest does not run from the invoice date but from the moment of default. The law provides three routes.",
  wegFrist: "A fixed payment date was agreed", wegFristHinweis: "“payable by 30 June” – default from the following day, without a reminder (Section 286(2) no. 1 BGB)",
  wegMahnung: "I sent a reminder", wegMahnungHinweis: "Default from the day after the reminder is received (Section 286(1) BGB)",
  wegDreissig: "Neither", wegDreissigHinweis: "Then at the latest 30 days after the due date and receipt of the invoice (Section 286(3) BGB)",
  mahnungAm: "Reminder received on",

  schritt3: "Step 3", frage3: "Is your debtor a business?",
  hinweis3: "The higher rate and the fixed sum apply only where no consumer is party to the transaction.",
  jaFirma: "Yes, a business", jaFirmaHinweis: "Nine points above base rate, 40 euro fixed sum",
  neinVerbraucher: "No, a private individual", neinVerbraucherHinweis: "Five points above base rate, no fixed sum",

  stufeOffen: "Default running", stufeKein: "No default yet",
  titel: (tage: number, summe: string) => `${tage} days in default · ${summe} on top`,
  titelKein: "On these details, no default has arisen yet",
  keinText: "Interest and the fixed sum only arise from the day default begins. Check the date – or send a reminder so the clock starts.",
  zeileZins: "Late payment interest", zeilePauschale: "Fixed sum, Section 288(5) BGB", zeileSumme: "On top of the principal", zeileGesamt: "Total claim",
  verzugAb: "In default since", satzZeile: "Interest rate",
  teilzeitraeume: "The base rate is reset on 1 January and 1 July. Where the default period crosses a reset, the tool calculates each stretch separately:",
  spalteZeitraum: "Period", spalteTage: "Days", spalteSatz: "Rate", spalteZins: "Interest",

  formulierung: "Demand to copy",
  formulierungHinweis: "The text stays in German because it goes to a German business customer.",
  kopieren: "Copy text", kopiert: "Copied",

  anrechnung: "One point most people miss",
  anrechnungText: "The 40 euro is credited against later costs of legal pursuit (Section 288(5) sentence 3 BGB). If you hand the matter to a solicitor or a collection agency later, the fixed sum reduces their recoverable costs – it does not come on top. That does not make it worthless: until then it is money you are owed without further effort.",
  agb: "It cannot be contracted away",
  agbText: "A clause excluding the claim to late payment interest is ineffective. For the exclusion of the 40-euro fixed sum, the law even expressly presumes that it is grossly unfair (Section 288(6) BGB). If your customer's purchasing terms say otherwise, it does not stop you.",

  standTitel: "Source and date",
  stand: "Sections 286(1)–(3) BGB (when default arises), 288(2) BGB (nine percentage points above base rate for payment claims without consumer involvement), 288(5) BGB (40-euro fixed sum, credited against costs of legal pursuit), 288(6) BGB (deviating agreements ineffective), 247 BGB (base rate). Deutsche Bundesbank base rate: 3.62 per cent from 1 January 2024, 3.37 per cent from 1 July 2024, 2.27 per cent from 1 January 2025, 1.27 per cent from 1 July 2025 (unchanged on 1 January 2026), 1.52 per cent from 1 July 2026. Retrieved 9 September 2026.",
  grenze: "What the calculator cannot do",
  grenzeText: "It applies the statutory rates. If you agreed a higher rate by contract, or can prove a specific greater loss – a more expensive overdraft, for instance – you are owed more (Section 288(3) BGB). Whether the claim itself is justified is not something the calculator checks; where a claim is disputed, the customer does not simply fall into default.",

  fuss: "The calculator runs entirely in your browser. Nothing you enter leaves your device, nothing is stored.",
  fragenTitel: "Common questions",
  fragen: [
    { f: "Exactly how high is late payment interest between businesses?", a: "Nine percentage points above the base rate (Section 288(2) BGB). The base rate has been 1.52 per cent since 1 July 2026, putting the rate for transactions without consumer involvement at 10.52 per cent a year. Towards consumers it is only five points, so 6.52 per cent." },
    { f: "Do I get the 40 euro for every invoice or once?", a: "Per payment claim. If three invoices from the same customer remain unpaid, the fixed sum arises three times. For instalments under a single contract the Federal Court of Justice took a different view – there it arises only once. What matters most is the credit against later solicitor's costs." },
    { f: "From when does default run?", a: "Not from the invoice date. Either from the day after a payment date fixed by the calendar, from the day after a reminder is received – or at the latest 30 days after the due date and receipt of the invoice (Section 286(3) BGB). Towards consumers that 30-day rule applies only if the invoice pointed it out." },
    { f: "Do I calculate interest on the net or the gross amount?", a: "On the outstanding amount – that is the gross claim including the VAT shown. The customer owes the gross amount, and late payment interest arises on it." },
    { f: "Is it even worth it on small invoices?", a: "On 800 euro and 60 days of delay it comes to around 14 euro of interest plus the 40-euro fixed sum. The amount is rarely the point. What works is making the claim visible: a customer who knows the days are being counted pays earlier next time – and your own payment record stays clean because the money arrives." },
  ],
  zwischenrufFett: "Unpaid invoices hit twice.",
  zwischenruf: " They are missing from the till – and your own payment behaviour is a quarter of your business credit index. FIAON obtains the company report and sorts out what it says.",
  zwischenrufKnopf: "See FIAON Business", weiterLink: "Read your credit index",
};

export const WZ_VERZUGSZINSEN_WOERTER = { de, en };
