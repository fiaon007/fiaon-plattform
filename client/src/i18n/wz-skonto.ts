// /werkzeuge/skonto · /en/tools/early-payment-discount — Wörterbuch (09.09.2026, E-099)
const de = {
  metaTitel: "Skonto-Rechner · Was zwei Prozent wirklich wert sind",
  metaBeschreibung: "Skonto ziehen oder das Zahlungsziel ausnutzen? Der Rechner setzt den Skontosatz in einen Jahreszins um und vergleicht ihn mit Ihrem Kontokorrentzins. Kostenlos, ohne Anmeldung.",
  seoTitel: "Skonto-Rechner: Was zwei Prozent wirklich wert sind",
  seoBeschreibung: "Skontosatz, Skontofrist und Zahlungsziel eingeben – der Rechner nennt den effektiven Jahreszins und sagt, ob sich das Ziehen gegen Ihren Kontokorrent lohnt.",
  werkzeugName: "Skonto-Rechner", krumeWerkzeuge: "Werkzeuge", krume: "Skonto-Rechner",
  pille: "Werkzeug für Unternehmen · kostenlos, ohne Anmeldung",
  h1a: "Zwei Prozent Skonto sind ", h1b: "kein kleiner Rabatt",
  lead: "„2 % bei Zahlung innerhalb von 10 Tagen, 30 Tage netto“ klingt nach einer Nebensache. Auf das Jahr gerechnet sind es rund 37 Prozent. Der Rechner zeigt, was Ihr Skonto wirklich kostet – oder einbringt.",

  schritt1: "Schritt 1", frage1: "Auf welcher Seite stehen Sie?",
  seiteZahlen: "Ich bekomme Skonto angeboten", seiteZahlenHinweis: "Lohnt es sich, früher zu zahlen?",
  seiteGeben: "Ich gewähre Skonto", seiteGebenHinweis: "Was kostet mich das im Jahr?",

  schritt2: "Schritt 2", frage2: "Wie lauten die Konditionen?",
  betrag: "Rechnungsbetrag (€)", bspBetrag: "z. B. 12.000,00",
  satz: "Skonto (%)", bspSatz: "z. B. 2",
  frist: "Skontofrist (Tage)", bspFrist: "z. B. 10",
  ziel: "Zahlungsziel (Tage)", bspZiel: "z. B. 30",
  hinweis2: "Beide Fristen laufen ab Rechnungsdatum. Der Rechner arbeitet mit dem kaufmännischen Jahr zu 360 Tagen – so wird Skonto in Deutschland üblicherweise verglichen.",

  schritt3: "Schritt 3", frage3: "Was kostet Ihr Kontokorrent im Jahr?",
  hinweis3: "Nur nötig, wenn Sie das Skonto ziehen wollen und dafür den Rahmen in Anspruch nehmen müssten. Lassen Sie das Feld leer, wenn Sie aus vorhandenem Guthaben zahlen.",
  kk: "Kontokorrentzins (% im Jahr)", bspKk: "z. B. 9,5",

  stufeLohnt: "Skonto ziehen", stufeLohntNicht: "Ziel ausnutzen", stufeTeuer: "Teurer Rabatt", stufeGuenstig: "Vertretbar",
  titelZahlen: (zins: string) => `Das Skonto entspricht ${zins} Jahreszins`,
  titelGeben: (zins: string) => `Ihr Skonto kostet ${zins} im Jahr`,
  ersparnis: "Skontobetrag", zahlbetrag: "Zu zahlen bei Skonto", tageFrueher: "Tage früher gezahlt", jahreszins: "Effektiver Jahreszins",

  deutungZahlenLohnt: (zins: string, kk: string) => `Sie leihen sich das Geld für ${kk} und sparen dafür ${zins}. Solange Ihr Rahmen reicht und die Bank nicht mehr verlangt, ist das Ziehen des Skontos die günstigere Seite. Bezahlt wird der Vorteil in Liquidität – prüfen Sie also, ob der Rahmen bis zum nächsten Zahlungseingang trägt.`,
  deutungZahlenNicht: (zins: string, kk: string) => `Hier dreht es sich um: Ihr Kontokorrent kostet ${kk}, das Skonto bringt nur ${zins}. Das Zahlungsziel auszunutzen ist in diesem Fall die günstigere Seite – vorausgesetzt, Sie zahlen dann tatsächlich pünktlich am letzten Tag.`,
  deutungZahlenOhneKk: (zins: string) => `Aus vorhandenem Guthaben gezahlt, ist das eine Rendite von ${zins} auf zehn bis zwanzig Tage. In dieser Größenordnung schlägt Skonto nahezu jede andere kurzfristige Verwendung des Geldes. Die Frage ist nur, ob das Konto den Abfluss trägt.`,
  deutungGeben: (zins: string) => `Auf das Jahr gerechnet zahlen Sie ${zins} dafür, das Geld früher zu bekommen. Das ist teurer als fast jede Kontokorrentlinie. Zu rechtfertigen ist es, wenn Sie den Betrag früher wirklich brauchen oder wenn das Skonto die Zahlungsmoral Ihrer Kunden messbar verbessert – nicht, weil es alle so machen.`,
  hinweisGrenze: "Ab etwa 300 Tagen Differenz verliert die Umrechnung ihren Sinn; prüfen Sie die eingetragenen Fristen.",

  formel: "So wird gerechnet",
  formelText: "Skontosatz geteilt durch (100 minus Skontosatz), mal 360 geteilt durch die Zahl der gewonnenen Tage. Die Division durch 100 minus Skontosatz ist der genauere Weg: Sie sparen die zwei Prozent auf einem Betrag, den Sie gar nicht mehr zahlen. Die verbreitete Faustformel „Satz mal 360 durch Tage“ liegt etwas darunter.",

  fristTitel: "Wenn die Skontofrist verstrichen ist",
  fristText: "Ein einseitig gezogener Skontoabzug nach Ablauf der Frist ist keine Kleinigkeit, sondern eine Unterzahlung: Die Restforderung bleibt offen, und Ihr Lieferant kann sie mahnen. In den Zahlungserfahrungen, die Auskunfteien sammeln, taucht so etwas als unvollständige Zahlung auf – bei einem Merkmal, das ein Viertel des Bonitätsindex trägt.",

  standTitel: "Stand und Quelle",
  stand: "Kaufmännische Skontoumrechnung auf Basis von 360 Zinstagen; genaue Formel mit Bezug auf den tatsächlich gezahlten Betrag. Zahlungsziele zwischen Unternehmen sind nach § 271a Abs. 1 BGB über 60 Tage hinaus nur wirksam, wenn sie ausdrücklich vereinbart und nicht grob unbillig sind; gegenüber öffentlichen Auftraggebern gilt nach § 271a Abs. 2 BGB grundsätzlich eine Grenze von 30 Tagen, mehr als 60 Tage sind unwirksam. Stand: 9. September 2026.",
  grenze: "Was der Rechner nicht kann",
  grenzeText: "Er vergleicht Zinssätze, keine Geschäftsbeziehungen. Ob Sie einen Lieferanten mit pünktlicher Zahlung an sich binden oder ob ein Kunde bei kürzerem Ziel abspringt, steht in keiner Formel. Und er sagt nichts darüber, ob Ihr Rahmen den früheren Abfluss trägt – das entscheidet Ihre Kontoauslastung, nicht der Zinssatz.",

  fuss: "Der Rechner läuft vollständig in Ihrem Browser. Keine Eingabe verlässt Ihr Gerät, nichts wird gespeichert.",
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Warum entsprechen zwei Prozent Skonto rund 37 Prozent Jahreszins?", a: "Weil die zwei Prozent nicht für ein Jahr gelten, sondern für die gewonnenen Tage. Bei „2 %, 10 Tage, 30 Tage netto“ zahlen Sie zwanzig Tage früher. Zwanzig Tage passen achtzehnmal in ein kaufmännisches Jahr – und achtzehn mal gut zwei Prozent ergeben rund siebenunddreißig." },
    { f: "Rechnet man mit 360 oder 365 Tagen?", a: "Im deutschen Geschäftsverkehr üblicherweise mit 360. Mit 365 fällt das Ergebnis rund anderthalb Prozent höher aus – an der Aussage ändert das nichts, weil der Vergleichswert, der Kontokorrentzins, in derselben Größenordnung bleibt." },
    { f: "Lohnt sich Skonto auch auf Kredit?", a: "Meistens ja, solange der Kontokorrentzins deutlich unter dem errechneten Jahreszins liegt – bei den üblichen Konditionen ist das der Fall. Die Grenze ist nicht der Zinssatz, sondern der Rahmen: Wer ihn ausreizt, um Skonto zu ziehen, hat beim nächsten unerwarteten Betrag keine Luft mehr." },
    { f: "Darf mein Kunde ein Zahlungsziel von 90 Tagen vorgeben?", a: "Nur eingeschränkt. Über 60 Tage hinaus ist eine Vereinbarung zwischen Unternehmen nur wirksam, wenn sie ausdrücklich getroffen wurde und nicht grob unbillig ist (§ 271a Abs. 1 BGB). Ist Ihr Kunde ein öffentlicher Auftraggeber, sind mehr als 60 Tage unwirksam, und über 30 Tage braucht es eine sachliche Rechtfertigung." },
    { f: "Was ist, wenn ich Skonto nach Fristablauf abziehe?", a: "Dann bleibt der Restbetrag offen. Ihr Lieferant kann ihn anmahnen, und in den Zahlungserfahrungen erscheint eine unvollständige Zahlung. Weil die Zahlungsweise ein Viertel des Bonitätsindex ausmacht, ist der kurzfristige Vorteil oft teurer als der abgezogene Betrag." },
  ],
  zwischenrufFett: "Skonto ist eine Zinsentscheidung.",
  zwischenruf: " Und Ihre Zahlungsweise ist ein Viertel Ihres Bonitätsindex. FIAON beschafft die Unternehmensauskunft und zeigt, was Lieferanten über Sie gemeldet haben.",
  zwischenrufKnopf: "FIAON Business ansehen", weiterLink: "Bonitätsindex einordnen",
};

const en: typeof de = {
  metaTitel: "Early payment discount calculator · what 2 % is really worth",
  metaBeschreibung: "Take the discount or use the full payment term? The calculator turns the discount rate into an annual interest rate and compares it with your overdraft. Free, no sign-up.",
  seoTitel: "Early payment discount calculator: what 2 % is really worth",
  seoBeschreibung: "Enter the discount rate, the discount period and the payment term – the calculator gives the effective annual rate and says whether taking it beats your overdraft.",
  werkzeugName: "Early payment discount calculator", krumeWerkzeuge: "Tools", krume: "Discount calculator",
  pille: "Tool for companies · free, no sign-up",
  h1a: "Two per cent discount is ", h1b: "no small rebate",
  lead: "“2 % if paid within 10 days, net 30” sounds like a footnote. Annualised it is around 37 per cent. The calculator shows what your early payment discount really costs – or earns.",

  schritt1: "Step 1", frage1: "Which side are you on?",
  seiteZahlen: "I am offered a discount", seiteZahlenHinweis: "Is paying early worth it?",
  seiteGeben: "I grant a discount", seiteGebenHinweis: "What does it cost me a year?",

  schritt2: "Step 2", frage2: "What are the terms?",
  betrag: "Invoice amount (€)", bspBetrag: "e.g. 12,000.00",
  satz: "Discount (%)", bspSatz: "e.g. 2",
  frist: "Discount period (days)", bspFrist: "e.g. 10",
  ziel: "Payment term (days)", bspZiel: "e.g. 30",
  hinweis2: "Both periods run from the invoice date. The calculator uses the commercial year of 360 days – the usual basis for comparing discounts in Germany.",

  schritt3: "Step 3", frage3: "What does your overdraft cost a year?",
  hinweis3: "Only needed if you would have to draw on the facility to take the discount. Leave it empty if you pay from existing funds.",
  kk: "Overdraft rate (% a year)", bspKk: "e.g. 9.5",

  stufeLohnt: "Take the discount", stufeLohntNicht: "Use the full term", stufeTeuer: "Expensive rebate", stufeGuenstig: "Defensible",
  titelZahlen: (zins: string) => `The discount equals ${zins} a year`,
  titelGeben: (zins: string) => `Your discount costs ${zins} a year`,
  ersparnis: "Discount amount", zahlbetrag: "Payable with discount", tageFrueher: "Days paid earlier", jahreszins: "Effective annual rate",

  deutungZahlenLohnt: (zins: string, kk: string) => `You borrow the money at ${kk} and save ${zins} by doing so. As long as your facility stretches and the bank charges no more, taking the discount is the cheaper side. You pay for the advantage in liquidity – so check that the facility lasts until the next money comes in.`,
  deutungZahlenNicht: (zins: string, kk: string) => `Here it turns around: your overdraft costs ${kk}, the discount returns only ${zins}. Using the full payment term is the cheaper side in this case – provided you then actually pay on the last day.`,
  deutungZahlenOhneKk: (zins: string) => `Paid from existing funds, that is a return of ${zins} over ten to twenty days. At that order of magnitude a discount beats almost any other short-term use of the money. The only question is whether the account can carry the outflow.`,
  deutungGeben: (zins: string) => `Annualised, you are paying ${zins} to receive the money earlier. That is dearer than almost any overdraft line. It is justified if you genuinely need the amount sooner, or if the discount measurably improves how your customers pay – not because everyone does it.`,
  hinweisGrenze: "Beyond about 300 days of difference the conversion loses its meaning; check the periods you entered.",

  formel: "How it is calculated",
  formelText: "The discount rate divided by (100 minus the discount rate), times 360 divided by the number of days gained. Dividing by 100 minus the rate is the more accurate route: you save the two per cent on an amount you no longer pay. The common rule of thumb, “rate times 360 divided by days”, comes out slightly lower.",

  fristTitel: "When the discount period has passed",
  fristText: "Deducting a discount unilaterally after the period has expired is not a trifle but an underpayment: the remainder stays open and your supplier can chase it. In the payment records that agencies collect, this appears as an incomplete payment – against a feature that carries a quarter of the business credit index.",

  standTitel: "Source and date",
  stand: "Commercial discount conversion on a basis of 360 interest days; precise formula referenced to the amount actually paid. Payment terms between companies beyond 60 days are effective under Section 271a(1) BGB only where expressly agreed and not grossly unfair; towards public contracting authorities Section 271a(2) BGB sets a limit of 30 days in principle, and more than 60 days is ineffective. As at 9 September 2026.",
  grenze: "What the calculator cannot do",
  grenzeText: "It compares interest rates, not business relationships. Whether paying on time binds a supplier to you, or whether a customer walks away at a shorter term, appears in no formula. And it says nothing about whether your facility can carry the earlier outflow – that is decided by how far your account is already drawn, not by the rate.",

  fuss: "The calculator runs entirely in your browser. Nothing you enter leaves your device, nothing is stored.",
  fragenTitel: "Common questions",
  fragen: [
    { f: "Why does a two per cent discount equal around 37 per cent a year?", a: "Because the two per cent applies not to a year but to the days you gain. With “2 %, 10 days, net 30” you pay twenty days earlier. Twenty days fit into a commercial year eighteen times – and eighteen times a little over two per cent comes to about thirty-seven." },
    { f: "Do you calculate with 360 or 365 days?", a: "German business practice generally uses 360. With 365 the result comes out around one and a half per cent higher, which changes nothing about the conclusion, because the comparison figure – your overdraft rate – stays in the same range." },
    { f: "Is a discount worth taking on credit?", a: "Usually yes, as long as the overdraft rate is clearly below the calculated annual rate, which it is on normal terms. The limit is not the rate but the facility: draw it down to take discounts and there is no room left for the next unexpected amount." },
    { f: "May my customer impose a payment term of 90 days?", a: "Only within limits. Beyond 60 days an agreement between companies is effective only if it was expressly made and is not grossly unfair (Section 271a(1) BGB). If your customer is a public contracting authority, more than 60 days is ineffective, and anything over 30 days needs objective justification." },
    { f: "What if I deduct the discount after the period has expired?", a: "Then the remainder stays open. Your supplier can chase it, and an incomplete payment appears in the payment records. Because payment behaviour makes up a quarter of the business credit index, the short-term gain often costs more than the amount deducted." },
  ],
  zwischenrufFett: "A discount is an interest decision.",
  zwischenruf: " And your payment behaviour is a quarter of your business credit index. FIAON obtains the company report and shows what suppliers have reported about you.",
  zwischenrufKnopf: "See FIAON Business", weiterLink: "Read your credit index",
};

export const WZ_SKONTO_WOERTER = { de, en };
