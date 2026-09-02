// ═══════════════════════════════════════════════════════════════════════════
// /kreditkarte · /en/credit-card — das Wörterbuch der Seite (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel; die Seite liest über useWoerter().
// Britisches Englisch. Keine Zusagen — die Bank entscheidet, in beiden Sprachen.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Kreditkarte trotz SCHUFA-Eintrag · Der Weg über die Auskunft",
  metaBeschreibung: "Kreditkarte trotz Eintrag: Welche Karte heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Herausgeber wirklich sehen. FIAON bereitet vor – die Bank entscheidet.",
  pille: "Kreditkarte", h1a: "Die Karte kommt ", h1b: "über die Auskunft.",
  lead: "Nicht über Tricks, nicht über Anbieter, die „garantiert“ versprechen – sondern darüber, dass das, was Herausgeber über Sie lesen, stimmt. FIAON sorgt dafür. Über Karte und Rahmen entscheidet die Bank.",
  kartenCheck: "Karten-Check (kostenlos)", wieWaechst: "Wie der Rahmen wächst",
  zahlen: [
    { wert: "25k", label: "Euro Rahmen bei guter Bonität – die Schwelle des Kartenpartners" },
    { wert: "10", label: "Tage, die eine Kreditanfrage für andere sichtbar bleibt" },
    { wert: "18", label: "Monate Speicherfrist bei Zahlung innerhalb von 100 Tagen" },
    { wert: "0", label: "Anfragen, die FIAON ohne Ihre Freigabe stellt" },
  ],
  wegePille: "Drei Wege", wegeH2a: "Welche Karte ", wegeH2b: "heute geht.",
  wegeLead: "Es gibt nicht „die“ Kreditkarte. Es gibt drei Wege – und für jede Lage einen, der offen ist.",
  wege: [
    { tag: "Weg 1", titel: "Debit- oder Prepaid-Karte", text: "Funktioniert überall, wo eine Karte verlangt wird: Hotel, Mietwagen, Online-Kauf. Kein Rahmen, keine Auskunft nötig. Der Weg für offene Einträge und Rücklastschriften – solange die Bereinigung läuft." },
    { tag: "Weg 2", titel: "Kreditkarte mit kleinem Rahmen", text: "Echte Kreditkarte mit 500 bis 2.000 Euro. Herausgeber starten so bei erledigten Einträgen, befristeten Verträgen, kurzer Historie. Pünktlich abgerechnet, wächst der Rahmen." },
    { tag: "Weg 3", titel: "Kreditkarte mit vollem Rahmen", text: "Bis 25.000 Euro bei guter Bonität und entsprechendem Spielraum. Der Weg für saubere Auskünfte – und das Ziel für alle anderen nach zwölf Monaten." },
  ],
  zeitPille: "Zeitachse", zeitH2a: "So wächst ", zeitH2b: "der Rahmen.",
  zeitLead: "Klicken Sie durch die zwölf Monate. Kein Versprechen – der typische Verlauf, wenn Auskunft, Konto und Abrechnung stimmen.",
  etappen: [
    { monat: "Monat 0", titel: "Auskunft", text: "FIAON beschafft Ihre Auskunft und erklärt jeden Eintrag. Sie wissen, was Herausgeber sehen – bevor Sie irgendwo anfragen.", rahmen: "–" },
    { monat: "Monat 1–2", titel: "Bereinigen", text: "Angreifbare Einträge werden angegriffen, alte Anfragen und Adressfehler bereinigt. Das Girokonto wird eröffnet und sauber geführt.", rahmen: "Girokonto" },
    { monat: "Monat 2–4", titel: "Erste Karte", text: "Sobald die Auskunft trägt, bereitet FIAON den Kartenantrag vor. Bei erledigten Einträgen oft mit kleinem Rahmen – die Tür ist offen.", rahmen: "500 – 2.000 €" },
    { monat: "Monat 6", titel: "Erste Anpassung", text: "Sechs Monate pünktlich abgerechnet: Herausgeber prüfen den Rahmen neu. FIAON bereitet die Anfrage mit aktueller Auskunft vor.", rahmen: "2.000 – 5.000 €" },
    { monat: "Monat 12", titel: "Volle Karte", text: "Ein Jahr sauber, Einträge gelöscht oder abgelaufen: Jetzt ist der Rahmen realistisch, den Einkommen und Spielraum hergeben – bis 25.000 € bei guter Bonität.", rahmen: "bis 25.000 €" },
  ],
  typischerRahmen: "Typischer Rahmen", zurueck: "Zurück", weiter: "Weiter",
  sehenPille: "Was Herausgeber sehen", sehenH2a: "Die fünf Dinge, ", sehenH2b: "die zählen.",
  sehenLead: "Kartenpartner lesen Ihre Auskunft in einer Minute. Das sind die Stellen, an denen sie hängen bleiben – und was FIAON daran tut.",
  sehen: [
    ["Negativmerkmale", "Offene Forderungen sperren fast immer; erledigte bremsen. FIAON prüft jede auf ihre Voraussetzungen (§ 31 BDSG) und ihre Frist – viele sind angreifbar, manche längst zu löschen."],
    ["Anfragen", "Drei Kreditanfragen in vier Wochen lesen sich wie Not. FIAON stellt keine Anfrage ohne Freigabe und rät zu Konditionsanfragen, die neutral sind."],
    ["Konto", "Rücklastschriften und Dauer-Dispo sind sichtbar, wenn der Kontoauszug verlangt wird. Drei saubere Monate sind die Währung."],
    ["Adresse und Identität", "Falsche Schreibweisen, alte Adressen, Verwechslungen – erstaunlich häufig. Berichtigung nach Art. 16 DSGVO, von FIAON vorbereitet."],
    ["Spielraum", "Einkommen minus Fixkosten. Faustregel vieler Herausgeber: Rahmen bis zum Acht- bis Zehnfachen des Spielraums. Rechnen Sie es aus – Spielraum-Rechner."],
  ] as [string, string][],
  spielraum: "Spielraum-Rechner", eintragPruefen: "Ist mein Eintrag angreifbar?",
  weiterlesen: "Zum Weiterlesen",
  weiterLinks: [
    { href: "/girokonto-trotz-negativer-bonitaet", t: "Girokonto trotz negativer Bonität", s: "Der Unterbau der Karte: erst das Konto, dann der Rahmen — ehrlich erklärt." },
    { href: "/schufa-score-verstehen", t: "SCHUFA-Score verstehen", s: "Die Zahl, an der der Kartenrahmen hängt — Tabelle und Hebel." },
  ],
  ehrlichPille: "Ehrlichkeit", ehrlichH2a: "Was wir ", ehrlichH2b: "nicht versprechen.",
  ehrlich: [
    { tag: "Keine Garantie", titel: "Die Bank entscheidet", text: "Niemand kann eine Kreditkarte garantieren – wer es tut, verkauft Prepaid oder Gebühren. FIAON bereitet vor und sagt vorher, was realistisch ist." },
    { tag: "Kein Score-Trick", titel: "Nur, was nicht hingehört, geht weg", text: "Berechtigte Einträge bleiben, bis ihre Frist abläuft. FIAON nennt das Datum – und nutzt die 100-Tage-Regel, wo sie greift." },
    { tag: "Keine Anfragen-Flut", titel: "Erst die Auskunft, dann der Antrag", text: "FIAON stellt den Kartenantrag erst, wenn die Auskunft trägt. Eine Ablehnung kostet Zeit – und steht zwölf Monate in der Auskunft." },
  ],
  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Bekomme ich mit einem offenen Eintrag eine Kreditkarte?", a: "Mit Rahmen praktisch nie. Eine Debit- oder Prepaid-Karte ja – und parallel gehört der Eintrag geprüft: Ist er berechtigt? Wann läuft die Frist? Oft ist die Sperre kürzer als gedacht." },
    { f: "Wie hoch ist der Rahmen am Anfang?", a: "Bei erledigten Einträgen oder kurzer Historie meist 500 bis 2.000 Euro. Nach sechs Monaten pünktlicher Abrechnung prüfen Herausgeber neu. Die Schwelle des Kartenpartners liegt bei 25.000 Euro." },
    { f: "Schadet die Anfrage für die Karte meiner Auskunft?", a: "Eine Kreditanfrage wird zwölf Monate gespeichert und ist zehn Tage für andere sichtbar. Deshalb stellt FIAON den Antrag erst, wenn die Auskunft trägt – und nie mehrere gleichzeitig." },
    { f: "Welche Karte bekomme ich über FIAON?", a: "Eine Kreditkarte eines Kartenpartners, je nach Profil Mastercard oder Visa, mit Monatsabrechnung. Welche konkret, klärt das Startgespräch anhand Ihrer Auskunft." },
    { f: "Was kostet die Karte?", a: "Die Kartengebühr legt der Herausgeber fest und wird vorher genannt. FIAON nimmt keine Provision auf Karte oder Rahmen – der Paketpreis ist der Preis." },
  ],
  zwischenrufA: "Fünf Angaben, eine ehrliche Einordnung.", zwischenrufB: " Der Karten-Check stellt keine Anfrage und hinterlässt keine Spur.",
  checkStarten: "Karten-Check starten", paketeAnsehen: "Pakete ansehen",
  abschlussA: "Die Karte beginnt ", abschlussB: "mit der Auskunft.",
  abschlussText: "Antrag in zwei Minuten, Auskunft innerhalb von 24 Stunden, Kartenantrag vorbereitet, sobald sie trägt.",
  jetztStarten: "Jetzt starten", preise: "Preise",
};

const en: typeof de = {
  metaTitel: "A credit card despite a SCHUFA entry · the route via your report",
  metaBeschreibung: "A credit card despite an entry: which card is realistic today, how the limit grows over twelve months and what issuers really see. FIAON prepares — the bank decides.",
  pille: "Credit card", h1a: "The card comes ", h1b: "through your report.",
  lead: "Not through tricks, not through providers that promise “guaranteed” — but by making sure that what issuers read about you is correct. FIAON takes care of that. The bank decides on card and limit.",
  kartenCheck: "Card check (free)", wieWaechst: "How the limit grows",
  zahlen: [
    { wert: "25k", label: "euro limit with a good file — the card partner's threshold" },
    { wert: "10", label: "days a credit enquiry stays visible to others" },
    { wert: "18", label: "months of storage if you pay within 100 days" },
    { wert: "0", label: "enquiries FIAON makes without your approval" },
  ],
  wegePille: "Three routes", wegeH2a: "Which card ", wegeH2b: "works today.",
  wegeLead: "There is no such thing as “the” credit card. There are three routes — and for every situation one that is open.",
  wege: [
    { tag: "Route 1", titel: "Debit or prepaid card", text: "Works wherever a card is required: hotel, hire car, online purchase. No limit, no report needed. The route for open entries and returned direct debits — while the clean-up is under way." },
    { tag: "Route 2", titel: "Credit card with a small limit", text: "A real credit card with €500 to €2,000. Issuers start this way with settled entries, fixed-term contracts, a short history. Settled on time, the limit grows." },
    { tag: "Route 3", titel: "Credit card with a full limit", text: "Up to €25,000 with a good file and the headroom to match. The route for clean reports — and the goal for everyone else after twelve months." },
  ],
  zeitPille: "Timeline", zeitH2a: "How ", zeitH2b: "the limit grows.",
  zeitLead: "Click through the twelve months. Not a promise — the typical course when report, account and statements are in order.",
  etappen: [
    { monat: "Month 0", titel: "Report", text: "FIAON obtains your report and explains every entry. You know what issuers see — before you apply anywhere.", rahmen: "–" },
    { monat: "Months 1–2", titel: "Clean-up", text: "Challengeable entries are challenged, old enquiries and address errors cleaned up. The current account is opened and run cleanly.", rahmen: "Current account" },
    { monat: "Months 2–4", titel: "First card", text: "As soon as the report supports it, FIAON prepares the card application. With settled entries often with a small limit — the door is open.", rahmen: "€500 – 2,000" },
    { monat: "Month 6", titel: "First review", text: "Six months settled on time: issuers review the limit. FIAON prepares the request with a current report.", rahmen: "€2,000 – 5,000" },
    { monat: "Month 12", titel: "Full card", text: "A clean year, entries deleted or expired: now the limit is realistic that income and headroom allow — up to €25,000 with a good file.", rahmen: "up to €25,000" },
  ],
  typischerRahmen: "Typical limit", zurueck: "Back", weiter: "Next",
  sehenPille: "What issuers see", sehenH2a: "The five things ", sehenH2b: "that count.",
  sehenLead: "Card partners read your report in a minute. These are the places where they stop — and what FIAON does about them.",
  sehen: [
    ["Negative entries", "Open claims block almost always; settled ones slow things down. FIAON checks each one for its legal requirements (Section 31 BDSG) and its deadline — many can be challenged, some should long have been deleted."],
    ["Enquiries", "Three credit enquiries in four weeks read like distress. FIAON makes no enquiry without approval and advises rate enquiries, which are neutral."],
    ["Account", "Returned direct debits and a permanent overdraft are visible when a bank statement is requested. Three clean months are the currency."],
    ["Address and identity", "Misspellings, old addresses, mix-ups — surprisingly common. Correction under Art. 16 GDPR, prepared by FIAON."],
    ["Headroom", "Income minus fixed costs. Rule of thumb of many issuers: a limit of up to eight to ten times the headroom. Work it out — headroom calculator."],
  ],
  spielraum: "Headroom calculator", eintragPruefen: "Can my entry be challenged?",
  weiterlesen: "Read on",
  weiterLinks: [
    { href: "/girokonto-trotz-negativer-bonitaet", t: "A current account despite a poor record", s: "The foundation of the card: first the account, then the limit — explained honestly." },
    { href: "/schufa-score-verstehen", t: "Understanding the SCHUFA score", s: "The number the card limit depends on — table and levers." },
  ],
  ehrlichPille: "Honesty", ehrlichH2a: "What we ", ehrlichH2b: "do not promise.",
  ehrlich: [
    { tag: "No guarantee", titel: "The bank decides", text: "Nobody can guarantee a credit card — anyone who does is selling prepaid or fees. FIAON prepares and tells you beforehand what is realistic." },
    { tag: "No score trick", titel: "Only what does not belong goes", text: "Justified entries stay until their deadline expires. FIAON names the date — and uses the 100-day rule where it applies." },
    { tag: "No flood of enquiries", titel: "First the report, then the application", text: "FIAON only makes the card application once the report supports it. A rejection costs time — and stays on your report for twelve months." },
  ],
  fragenPille: "Frequently asked questions",
  fragen: [
    { f: "Can I get a credit card with an open entry?", a: "With a limit, practically never. A debit or prepaid card, yes — and in parallel the entry should be checked: is it justified? When does the deadline expire? The block is often shorter than you think." },
    { f: "How high is the limit at the start?", a: "With settled entries or a short history usually €500 to €2,000. After six months of statements settled on time, issuers review. The card partner's threshold is €25,000." },
    { f: "Does the card application hurt my report?", a: "A credit enquiry is stored for twelve months and visible to others for ten days. That is why FIAON only applies once the report supports it — and never several at once." },
    { f: "Which card do I get through FIAON?", a: "A credit card from a card partner, Mastercard or Visa depending on your profile, with a monthly statement. Which one exactly is settled in the onboarding call on the basis of your report." },
    { f: "What does the card cost?", a: "The card fee is set by the issuer and named beforehand. FIAON takes no commission on card or limit — the plan price is the price." },
  ],
  zwischenrufA: "Five inputs, one honest assessment.", zwischenrufB: " The card check makes no enquiry and leaves no trace.",
  checkStarten: "Start the card check", paketeAnsehen: "See the plans",
  abschlussA: "The card starts ", abschlussB: "with the report.",
  abschlussText: "Application in two minutes, report within 24 hours, card application prepared as soon as it supports it.",
  jetztStarten: "Get started", preise: "Pricing",
};

export const KREDITKARTE_WOERTER = { de, en };
