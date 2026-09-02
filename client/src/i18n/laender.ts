// /oesterreich · /en/austria und /schweiz · /en/switzerland — Wörterbuch (02.09.2026)
// Beide Länderseiten in einer Datei, je Land ein Block, beide Sprachen Schlüssel
// für Schlüssel. Der FAQ-Generator teilt an „const en" — die Fragen beider
// Länder stehen deshalb je Sprache zusammen (Zuordnung über QUELLEN im Generator
// bewusst je Land: siehe scripts/seo-fragen-erzeugen.ts).
type Land = {
  metaTitel: string; metaBeschreibung: string; pille: string; h1a: string; h1b: string; lead: string;
  beschaffen: string; brief: string;
  zahlen: { wert: string; label: string }[];
  werPille: string; werH2a: string; werH2b: string;
  stellen: { tag: string; titel: string; text: string }[];
  rechtePille: string; rechteH2a: string; rechteH2b: string;
  rechte: [string, string][];
  wegPille: string; wegH2a: string; wegH2b: string;
  weg: { titel: string; text: string }[];
  werkzeugePille: string; werkzeugeH2a: string; werkzeugeH2b: string;
  werkzeuge: { href: string; tag: string; titel: string; text: string; mehr: string }[];
  fragenPille: string; fragen: { f: string; a: string }[];
  zwischenA: string; zwischenB: string; anderesLand: string; anderesLandHref: string;
  abschlussA: string; abschlussB: string; abschlussText: string; jetztStarten: string; preise: string;
};
const de: { oesterreich: Land; schweiz: Land } = {
  oesterreich: {
    metaTitel: "FIAON in Österreich · KSV1870, CRIF, Ihre Rechte",
    metaBeschreibung: "Bonität in Österreich: KSV1870 und CRIF erklärt, Selbstauskunft nach Art. 15 DSGVO, Löschfristen, Bonitätsdatenbanken der Banken – und wie FIAON Einträge prüft, bereinigt und Konto und Karte vorbereitet.",
    pille: "Österreich", h1a: "Bonität in Österreich, ", h1b: "Klartext.",
    lead: "KSV1870, CRIF, die Warnlisten der Banken: In Österreich entscheiden andere Stellen über Konto, Karte und Handyvertrag als in Deutschland – mit eigenen Regeln und eigenen Fristen. FIAON kennt sie.",
    beschaffen: "Auskunft beschaffen", brief: "Selbstauskunft-Brief (kostenlos)",
    zahlen: [{ wert: "2", label: "große Auskunfteien: KSV1870 und CRIF" }, { wert: "1", label: "Monat Frist für die Selbstauskunft (Art. 15 DSGVO)" }, { wert: "3", label: "Jahre übliche Speicherdauer nach Erledigung" }, { wert: "0 €", label: "kostet die Auskunft über Ihre Daten" }],
    werPille: "Wer speichert was", werH2a: "Die Stellen, ", werH2b: "die über Sie entscheiden.",
    stellen: [
      { tag: "KSV1870", titel: "Der Kreditschutzverband", text: "Die größte Auskunftei des Landes. Speichert Zahlungserfahrungen, Inkassofälle, Exekutionen und Insolvenzdaten – und berechnet einen Score, den Banken, Leasinggeber und Händler abfragen." },
      { tag: "CRIF", titel: "Die zweite Auskunftei", text: "Stark bei Telekommunikation, Versandhandel und Konsumentenkrediten. Viele Ablehnungen beim Handyvertrag gehen auf CRIF zurück, nicht auf den KSV." },
      { tag: "Warnlisten der Banken", titel: "Die interne Liste", text: "Die Kreditinstitute führen gemeinsame Warnlisten (etwa über gekündigte Konten oder Kredite). Wer dort steht, bekommt oft auch ohne Negativeintrag bei KSV oder CRIF kein Konto – deshalb muss auch diese Auskunft her." },
    ],
    rechtePille: "Ihre Rechte", rechteH2a: "Was Sie verlangen ", rechteH2b: "können.",
    rechte: [
      ["Auskunft", "Kostenlose Selbstauskunft nach Art. 15 DSGVO bei KSV1870, CRIF und jeder Bank, die eine Warnliste führt. Antwort innerhalb eines Monats. Einmal jährlich ohne Angabe von Gründen."],
      ["Richtigstellung", "Falsche oder unvollständige Daten müssen berichtigt werden (Art. 16 DSGVO). Dazu gehören erledigte Forderungen ohne Erledigungsvermerk und Verwechslungen."],
      ["Löschung", "Daten dürfen nur so lange gespeichert werden, wie es für den Zweck nötig ist (Art. 17 DSGVO). Erledigte Forderungen: in der Regel drei Jahre; danach ist die Löschung zu verlangen."],
      ["Widerspruch", "Gegen die Verarbeitung in Konsumentendatenbanken können Sie Widerspruch einlegen (Art. 21 DSGVO); die Auskunftei muss dann zwingende Gründe nachweisen."],
      ["Beschwerde", "Die Datenschutzbehörde in Wien ist zuständig, wenn Auskunftei oder Bank nicht reagieren. Daneben gilt § 152 GewO für Kreditauskunfteien: Betroffene haben ein Recht auf Auskunft und Richtigstellung."],
    ],
    wegPille: "Der Weg mit FIAON", wegH2a: "Von der Auskunft ", wegH2b: "zur Karte.",
    weg: [
      { titel: "Vollmacht und Auskünfte", text: "FIAON fordert Ihre Daten bei KSV1870, CRIF und – mit Ihrer Freigabe – bei den Banken an. Sie füllen kein Formular aus." },
      { titel: "Jeder Eintrag erklärt", text: "Was steht da, wer hat es gemeldet, ist es berechtigt, wann ist es weg. In Menschensprache, im Kundenbereich." },
      { titel: "Schreiben nach österreichischem Recht", text: "Richtigstellung, Löschung, Widerspruch – mit den richtigen Paragraphen, per Einschreiben, mit Frist." },
      { titel: "Konto und Karte", text: "Girokonto über Partnerbanken, die auch bei Einträgen eröffnen; Kreditkarte, sobald die Auskunft trägt. Die Bank entscheidet." },
    ],
    werkzeugePille: "Werkzeuge", werkzeugeH2a: "Kostenlos, ", werkzeugeH2b: "sofort.",
    werkzeuge: [
      { href: "/werkzeuge/selbstauskunft", tag: "Selbstauskunft", titel: "Fertiger Brief an KSV1870 und CRIF", text: "Art. 15 DSGVO, richtig formuliert, mit allen nötigen Angaben – ausdrucken, unterschreiben, abschicken.", mehr: "Brief erstellen" },
      { href: "/werkzeuge/eintrag-pruefen", tag: "Eintrag prüfen", titel: "Ist mein Eintrag angreifbar?", text: "Fünf Fragen zu Mahnungen, Fristen und Bestreiten – eine ehrliche Einschätzung.", mehr: "Jetzt prüfen" },
    ],
    fragenPille: "Häufige Fragen",
    fragen: [
      { f: "Gibt es in Österreich die SCHUFA?", a: "Nein. Die Rolle übernehmen KSV1870 und CRIF, daneben die Warnlisten der Banken. Wer aus Deutschland nach Österreich zieht, beginnt bei KSV und CRIF ohne Historie – die SCHUFA-Daten werden nicht übertragen." },
      { f: "Wie lange bleibt ein Eintrag beim KSV?", a: "Erledigte Forderungen in der Regel drei Jahre nach Erledigung; Insolvenzdaten entsprechend der Ediktsdatei. Länger gespeicherte Daten sind nach Art. 17 DSGVO zu löschen." },
      { f: "Warum wurde mein Handyvertrag abgelehnt, obwohl der KSV nichts hat?", a: "Mobilfunkanbieter fragen häufig bei CRIF an. Fordern Sie dort die Selbstauskunft – FIAON tut das für Sie." },
      { f: "Kann ich trotz Eintrag ein Konto eröffnen?", a: "Ja. Auf ein Basiskonto besteht nach dem Verbraucherzahlungskontogesetz ein Rechtsanspruch. FIAON bereitet die Eröffnung bei einer Partnerbank vor." },
      { f: "Arbeitet FIAON mit österreichischem Recht?", a: "Ja. Schreiben, Fristen und Paragraphen sind für Österreich angepasst: DSGVO, DSG, GewO, Verbraucherzahlungskontogesetz. Der Ansprechpartner kennt beide Länder." },
    ],
    zwischenA: "Sie sind in Österreich?", zwischenB: " Der Antrag erkennt Ihr Land und beschafft KSV- und CRIF-Auskunft.", anderesLand: "Schweiz", anderesLandHref: "/schweiz",
    abschlussA: "Ihr Weg beginnt ", abschlussB: "mit einer E-Mail-Adresse.", abschlussText: "Antrag in zwei Minuten, Auskünfte innerhalb von 24 Stunden nach Eingang, ein Mensch, der Sie durch alles Weitere begleitet.", jetztStarten: "Jetzt starten", preise: "Preise",
  },
  schweiz: {
    metaTitel: "FIAON in der Schweiz · Betreibungsregister, CRIF, Intrum",
    metaBeschreibung: "Bonität in der Schweiz: Betreibungsregisterauszug, CRIF und Intrum erklärt, Auskunft nach Art. 25 DSG, Löschung unbegründeter Betreibungen (Art. 8a SchKG) – und wie FIAON Einträge prüft, bereinigt und Konto und Karte vorbereitet.",
    pille: "Schweiz", h1a: "Bonität in der Schweiz, ", h1b: "Klartext.",
    lead: "Betreibungsregister, CRIF, Intrum: In der Schweiz entscheidet oft ein Auszug vom Betreibungsamt über Wohnung, Handy und Karte – und fünf Jahre sind lang. FIAON kennt die Wege, ihn zu bereinigen.",
    beschaffen: "Auskunft beschaffen", brief: "Auskunftsbrief (kostenlos)",
    zahlen: [{ wert: "5", label: "Jahre bleibt eine Betreibung im Registerauszug sichtbar" }, { wert: "3", label: "Monate Frist, eine unbegründete Betreibung sperren zu lassen (Art. 8a SchKG)" }, { wert: "30", label: "Tage Frist für die Auskunft nach Art. 25 DSG" }, { wert: "17 CHF", label: "kostet der Betreibungsregisterauszug beim Amt" }],
    werPille: "Wer speichert was", werH2a: "Die Stellen, ", werH2b: "die über Sie entscheiden.",
    stellen: [
      { tag: "Betreibungsregister", titel: "Das Amt am Wohnort", text: "Jede Betreibung – auch eine unberechtigte – steht fünf Jahre im Auszug des Betreibungsamts. Vermieter, Arbeitgeber, Mobilfunkanbieter verlangen ihn. Der wichtigste Hebel in der Schweiz." },
      { tag: "CRIF", titel: "Die private Auskunftei", text: "Sammelt Zahlungserfahrungen aus Handel, Telekommunikation und Kredit und berechnet Scores, die Online-Händler und Banken abfragen. Auskunft nach Art. 25 DSG kostenlos." },
      { tag: "Intrum", titel: "Inkasso und Auskunft", text: "Intrum bearbeitet Inkassofälle und führt eigene Bonitätsdaten. Wer einmal Post von Intrum hatte, ist meist auch in deren Datenbank – und sollte das prüfen." },
    ],
    rechtePille: "Ihre Rechte", rechteH2a: "Was Sie verlangen ", rechteH2b: "können.",
    rechte: [
      ["Auskunft", "Nach Art. 25 DSG (revidiert seit September 2023) kostenlos bei CRIF, Intrum und jedem Unternehmen, das Daten über Sie bearbeitet. Antwort innerhalb von 30 Tagen. Der Betreibungsregisterauszug kostet 17 Franken beim Amt."],
      ["Unbegründete Betreibung sperren", "Art. 8a Abs. 3 lit. d SchKG: Wer innerhalb von drei Monaten nach Zustellung des Zahlungsbefehls Rechtsvorschlag erhebt und der Gläubiger kein Rechtsöffnungsverfahren einleitet, kann beim Betreibungsamt verlangen, dass Dritte die Betreibung nicht mehr sehen."],
      ["Löschung nach Bezahlung", "Eine bezahlte Betreibung bleibt sichtbar – mit Vermerk „bezahlt“. Nur die Rückzugserklärung des Gläubigers lässt sie verschwinden. FIAON bereitet das Gesuch vor; viele Gläubiger unterschreiben gegen Zahlung."],
      ["Berichtigung und Löschung bei CRIF/Intrum", "Falsche oder veraltete Daten sind zu berichtigen oder zu löschen (Art. 32 DSG). Erledigte Forderungen dürfen nicht unbegrenzt gespeichert bleiben."],
      ["Beschwerde", "Der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) und die Aufsichtsbehörde des Betreibungsamts (kantonal) – bei Weigerung der Gegenseite."],
    ],
    wegPille: "Der Weg mit FIAON", wegH2a: "Vom Registerauszug ", wegH2b: "zur Karte.",
    weg: [
      { titel: "Auszug und Auskünfte", text: "FIAON beschafft den Betreibungsregisterauszug sowie die Auskünfte bei CRIF und Intrum – mit Vollmacht, ohne Behördengang." },
      { titel: "Jede Betreibung erklärt", text: "Gläubiger, Betrag, Stand, Rechtsvorschlag, Frist. Welche lässt sich sperren, welche zurückziehen, welche bleibt." },
      { titel: "Gesuche und Schreiben", text: "Nichtbekanntgabe nach Art. 8a SchKG, Rückzugserklärung vom Gläubiger, Berichtigung bei CRIF und Intrum – per Einschreiben, mit Frist." },
      { titel: "Konto und Karte", text: "Konto bei einer Partnerbank, Kreditkarte, sobald der Auszug trägt. Die Bank entscheidet – FIAON bereitet vor." },
    ],
    werkzeugePille: "Werkzeuge", werkzeugeH2a: "Kostenlos, ", werkzeugeH2b: "sofort.",
    werkzeuge: [
      { href: "/werkzeuge/selbstauskunft", tag: "Auskunft", titel: "Fertiger Brief an CRIF und Intrum", text: "Art. 25 DSG, richtig formuliert – ausdrucken, unterschreiben, abschicken. Antwort in 30 Tagen.", mehr: "Brief erstellen" },
      { href: "/werkzeuge/verjaehrung", tag: "Verjährung", titel: "Ist die Forderung verjährt?", text: "Rechner für deutsche Fristen – für die Schweiz gelten abweichende (OR Art. 127 ff.); der Ansprechpartner prüft.", mehr: "Rechner öffnen" },
    ],
    fragenPille: "Häufige Fragen",
    fragen: [
      { f: "Eine Betreibung war unberechtigt – warum steht sie trotzdem im Auszug?", a: "Weil das Register jede Betreibung einträgt, unabhängig von ihrer Berechtigung. Sichtbar bleibt sie fünf Jahre – es sei denn, Sie lassen sie nach Art. 8a SchKG sperren oder der Gläubiger zieht sie zurück." },
      { f: "Ich habe bezahlt – ist die Betreibung jetzt weg?", a: "Nein, sie trägt den Vermerk „bezahlt“ und bleibt sichtbar. Erst die Rückzugserklärung des Gläubigers entfernt sie. FIAON formuliert das Gesuch – oft als Bedingung der Zahlung." },
      { f: "Gilt die deutsche SCHUFA in der Schweiz?", a: "Nein. Schweizer Banken und Händler fragen Betreibungsregister, CRIF und Intrum ab. Wer aus Deutschland zuzieht, beginnt ohne Historie – und sollte den ersten Auszug früh prüfen." },
      { f: "Bekomme ich mit Betreibungen ein Konto?", a: "Banken dürfen ablehnen; PostFinance führt Konten für Personen mit Wohnsitz in der Schweiz weitgehend unabhängig von Betreibungen. FIAON bereitet die Eröffnung vor." },
      { f: "Wie lange dauert die Nichtbekanntgabe nach Art. 8a?", a: "Das Gesuch ist frühestens drei Monate nach Zustellung des Zahlungsbefehls möglich; das Amt fragt den Gläubiger an, der 20 Tage Zeit hat, ein Verfahren nachzuweisen. Danach wird die Betreibung Dritten nicht mehr angezeigt." },
    ],
    zwischenA: "Sie sind in der Schweiz?", zwischenB: " Der Antrag erkennt Ihr Land und beschafft Registerauszug, CRIF- und Intrum-Auskunft.", anderesLand: "Österreich", anderesLandHref: "/oesterreich",
    abschlussA: "Ihr Weg beginnt ", abschlussB: "mit einer E-Mail-Adresse.", abschlussText: "Antrag in zwei Minuten, Auskünfte innerhalb von 24 Stunden nach Eingang, ein Mensch, der Sie durch alles Weitere begleitet.", jetztStarten: "Jetzt starten", preise: "Preise",
  },
};
const en: typeof de = {
  oesterreich: {
    metaTitel: "FIAON in Austria · KSV1870, CRIF, your rights",
    metaBeschreibung: "Creditworthiness in Austria: KSV1870 and CRIF explained, self-disclosure under Art. 15 GDPR, deletion deadlines, the banks' credit databases — and how FIAON checks and cleans up entries and prepares account and card.",
    pille: "Austria", h1a: "Creditworthiness in Austria, ", h1b: "in plain terms.",
    lead: "KSV1870, CRIF, the banks' warning lists: in Austria, different bodies decide on account, card and mobile contract than in Germany — with their own rules and their own deadlines. FIAON knows them.",
    beschaffen: "Obtain the report", brief: "Self-disclosure letter (free)",
    zahlen: [{ wert: "2", label: "major credit bureaus: KSV1870 and CRIF" }, { wert: "1", label: "month to reply to a self-disclosure request (Art. 15 GDPR)" }, { wert: "3", label: "years usual storage after settlement" }, { wert: "€0", label: "is what access to your data costs" }],
    werPille: "Who stores what", werH2a: "The bodies ", werH2b: "that decide about you.",
    stellen: [
      { tag: "KSV1870", titel: "The Kreditschutzverband", text: "The country's largest credit bureau. Stores payment experience, debt collection cases, enforcement and insolvency data — and calculates a score that banks, lessors and retailers query." },
      { tag: "CRIF", titel: "The second bureau", text: "Strong in telecommunications, mail order and consumer credit. Many mobile contract rejections go back to CRIF, not to KSV." },
      { tag: "The banks' warning lists", titel: "The internal list", text: "The credit institutions keep joint warning lists (of terminated accounts or loans, for instance). Anyone on them often gets no account even without a negative entry at KSV or CRIF — so this disclosure has to be obtained too." },
    ],
    rechtePille: "Your rights", rechteH2a: "What you can ", rechteH2b: "demand.",
    rechte: [
      ["Access", "Free self-disclosure under Art. 15 GDPR from KSV1870, CRIF and every bank that keeps a warning list. Reply within one month. Once a year without giving reasons."],
      ["Rectification", "Wrong or incomplete data must be corrected (Art. 16 GDPR). That includes settled claims without a settled marker and mix-ups."],
      ["Erasure", "Data may only be stored as long as necessary for the purpose (Art. 17 GDPR). Settled claims: usually three years; after that erasure is to be demanded."],
      ["Objection", "You can object to processing in consumer databases (Art. 21 GDPR); the bureau must then demonstrate compelling grounds."],
      ["Complaint", "The Data Protection Authority in Vienna is responsible if bureau or bank do not react. In addition, Section 152 GewO applies to credit bureaus: those affected have a right to access and rectification."],
    ],
    wegPille: "The path with FIAON", wegH2a: "From report ", wegH2b: "to card.",
    weg: [
      { titel: "Authorisation and reports", text: "FIAON requests your data from KSV1870, CRIF and — with your approval — from the banks. You fill in no forms." },
      { titel: "Every entry explained", text: "What is there, who reported it, is it justified, when will it go. In plain language, in the customer area." },
      { titel: "Letters under Austrian law", text: "Rectification, erasure, objection — with the right sections, by registered post, with a deadline." },
      { titel: "Account and card", text: "A current account via partner banks that open accounts even with entries; a credit card as soon as the report supports it. The bank decides." },
    ],
    werkzeugePille: "Tools", werkzeugeH2a: "Free, ", werkzeugeH2b: "right away.",
    werkzeuge: [
      { href: "/werkzeuge/selbstauskunft", tag: "Self-disclosure", titel: "A ready letter to KSV1870 and CRIF", text: "Art. 15 GDPR, correctly worded, with all the necessary details — print, sign, send.", mehr: "Create the letter" },
      { href: "/werkzeuge/eintrag-pruefen", tag: "Check an entry", titel: "Can my entry be challenged?", text: "Five questions on reminders, deadlines and disputes — an honest assessment.", mehr: "Check now" },
    ],
    fragenPille: "Frequently asked questions",
    fragen: [
      { f: "Is there a SCHUFA in Austria?", a: "No. The role is taken by KSV1870 and CRIF, alongside the banks' warning lists. Anyone who moves from Germany to Austria starts at KSV and CRIF without a history — the SCHUFA data is not transferred." },
      { f: "How long does an entry stay at KSV?", a: "Settled claims usually three years after settlement; insolvency data according to the insolvency register (Ediktsdatei). Data stored longer is to be erased under Art. 17 GDPR." },
      { f: "Why was my mobile contract rejected although KSV has nothing?", a: "Mobile providers frequently enquire at CRIF. Request the self-disclosure there — FIAON does that for you." },
      { f: "Can I open an account despite an entry?", a: "Yes. There is a legal right to a basic account under the Consumer Payment Accounts Act (Verbraucherzahlungskontogesetz). FIAON prepares the opening with a partner bank." },
      { f: "Does FIAON work under Austrian law?", a: "Yes. Letters, deadlines and sections are adapted for Austria: GDPR, DSG, GewO, Consumer Payment Accounts Act. Your contact person knows both countries." },
    ],
    zwischenA: "Are you in Austria?", zwischenB: " The application recognises your country and obtains the KSV and CRIF reports.", anderesLand: "Switzerland", anderesLandHref: "/schweiz",
    abschlussA: "Your journey starts ", abschlussB: "with an e-mail address.", abschlussText: "Application in two minutes, reports explained within 24 hours of receipt, a person who guides you through everything else.", jetztStarten: "Get started", preise: "Pricing",
  },
  schweiz: {
    metaTitel: "FIAON in Switzerland · debt enforcement register, CRIF, Intrum",
    metaBeschreibung: "Creditworthiness in Switzerland: the debt enforcement register extract, CRIF and Intrum explained, access under Art. 25 DSG, blocking unjustified enforcements (Art. 8a SchKG) — and how FIAON checks and cleans up entries and prepares account and card.",
    pille: "Switzerland", h1a: "Creditworthiness in Switzerland, ", h1b: "in plain terms.",
    lead: "Debt enforcement register, CRIF, Intrum: in Switzerland an extract from the enforcement office often decides on flat, phone and card — and five years is a long time. FIAON knows the routes to clean it up.",
    beschaffen: "Obtain the report", brief: "Access letter (free)",
    zahlen: [{ wert: "5", label: "years an enforcement stays visible in the register extract" }, { wert: "3", label: "months to have an unjustified enforcement blocked (Art. 8a SchKG)" }, { wert: "30", label: "days to reply to an access request under Art. 25 DSG" }, { wert: "CHF 17", label: "is what the register extract costs at the office" }],
    werPille: "Who stores what", werH2a: "The bodies ", werH2b: "that decide about you.",
    stellen: [
      { tag: "Debt enforcement register", titel: "The office at your place of residence", text: "Every enforcement — even an unjustified one — stays five years in the enforcement office's extract. Landlords, employers, mobile providers demand it. The most important lever in Switzerland." },
      { tag: "CRIF", titel: "The private bureau", text: "Collects payment experience from retail, telecommunications and credit and calculates scores that online retailers and banks query. Access under Art. 25 DSG is free." },
      { tag: "Intrum", titel: "Debt collection and credit data", text: "Intrum handles debt collection cases and keeps its own credit data. Anyone who has ever had post from Intrum is usually also in their database — and should check that." },
    ],
    rechtePille: "Your rights", rechteH2a: "What you can ", rechteH2b: "demand.",
    rechte: [
      ["Access", "Under Art. 25 DSG (revised since September 2023) free from CRIF, Intrum and every company that processes data about you. Reply within 30 days. The register extract costs 17 francs at the office."],
      ["Block an unjustified enforcement", "Art. 8a para. 3 lit. d SchKG: anyone who lodges an objection (Rechtsvorschlag) within three months of service of the payment order, where the creditor initiates no proceedings to set it aside, can demand at the enforcement office that third parties no longer see the enforcement."],
      ["Deletion after payment", "A paid enforcement remains visible — with the marker “paid”. Only the creditor's withdrawal declaration makes it disappear. FIAON prepares the request; many creditors sign in return for payment."],
      ["Rectification and erasure at CRIF/Intrum", "Wrong or outdated data is to be corrected or erased (Art. 32 DSG). Settled claims may not be stored indefinitely."],
      ["Complaint", "The Federal Data Protection and Information Commissioner (FDPIC) and the supervisory authority of the enforcement office (cantonal) — if the other side refuses."],
    ],
    wegPille: "The path with FIAON", wegH2a: "From register extract ", wegH2b: "to card.",
    weg: [
      { titel: "Extract and reports", text: "FIAON obtains the debt enforcement register extract and the reports from CRIF and Intrum — with authorisation, without a trip to the office." },
      { titel: "Every enforcement explained", text: "Creditor, amount, status, objection, deadline. Which can be blocked, which withdrawn, which stays." },
      { titel: "Requests and letters", text: "Non-disclosure under Art. 8a SchKG, withdrawal declaration from the creditor, rectification at CRIF and Intrum — by registered post, with a deadline." },
      { titel: "Account and card", text: "An account with a partner bank, a credit card as soon as the extract supports it. The bank decides — FIAON prepares." },
    ],
    werkzeugePille: "Tools", werkzeugeH2a: "Free, ", werkzeugeH2b: "right away.",
    werkzeuge: [
      { href: "/werkzeuge/selbstauskunft", tag: "Access", titel: "A ready letter to CRIF and Intrum", text: "Art. 25 DSG, correctly worded — print, sign, send. Reply within 30 days.", mehr: "Create the letter" },
      { href: "/werkzeuge/verjaehrung", tag: "Limitation", titel: "Is the claim time-barred?", text: "Calculator for German periods — different ones apply in Switzerland (CO Art. 127 ff.); your contact person checks.", mehr: "Open the calculator" },
    ],
    fragenPille: "Frequently asked questions",
    fragen: [
      { f: "An enforcement was unjustified — why is it still in the extract?", a: "Because the register records every enforcement regardless of whether it is justified. It stays visible for five years — unless you have it blocked under Art. 8a SchKG or the creditor withdraws it." },
      { f: "I have paid — is the enforcement gone now?", a: "No, it carries the marker “paid” and remains visible. Only the creditor's withdrawal declaration removes it. FIAON drafts the request — often as a condition of payment." },
      { f: "Does the German SCHUFA apply in Switzerland?", a: "No. Swiss banks and retailers query the debt enforcement register, CRIF and Intrum. Anyone who moves in from Germany starts without a history — and should check the first extract early." },
      { f: "Can I get an account with enforcements?", a: "Banks may refuse; PostFinance runs accounts for people resident in Switzerland largely regardless of enforcements. FIAON prepares the opening." },
      { f: "How long does non-disclosure under Art. 8a take?", a: "The request is possible at the earliest three months after service of the payment order; the office asks the creditor, who has 20 days to prove proceedings. After that the enforcement is no longer shown to third parties." },
    ],
    zwischenA: "Are you in Switzerland?", zwischenB: " The application recognises your country and obtains the register extract and the CRIF and Intrum reports.", anderesLand: "Austria", anderesLandHref: "/oesterreich",
    abschlussA: "Your journey starts ", abschlussB: "with an e-mail address.", abschlussText: "Application in two minutes, reports explained within 24 hours of receipt, a person who guides you through everything else.", jetztStarten: "Get started", preise: "Pricing",
  },
};
export const LAENDER_WOERTER = { de, en };
