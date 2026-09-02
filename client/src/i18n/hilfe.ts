// ═══════════════════════════════════════════════════════════════════════════
// /hilfe · /en/help — das Wörterbuch des Hilfe-Centers (02.09.2026)
// Acht Themen, je vier bis sechs Fragen, in beiden Sprachen. Die Antworten
// folgen shared/fiaon-wissen.ts — dieselben Aussagen wie am Telefon.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
export type HilfeThema = { key: string; titel: string; satz: string; fragen: { f: string; a: string }[] };

const de = {
  metaTitel: "Hilfe-Center · Antworten auf einen Blick",
  metaBeschreibung: "Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: Das FIAON-Hilfe-Center beantwortet die häufigsten Fragen – mit Suche.",
  seoTitel: "Hilfe-Center: Antworten zu Antrag, Zahlung, Auskunft",
  seoBeschreibung: "Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: Das FIAON-Hilfe-Center beantwortet die häufigsten Fragen – mit Suche.",
  krume: "Hilfe",
  pille: "Hilfe-Center", h1a: "Antworten, ", h1b: "bevor Sie fragen müssen.",
  lead: "Acht Themen, dieselben Antworten wie am Telefon und im Assistenten. Suchen Sie – oder öffnen Sie das Thema, das gerade dran ist.",
  suchen: "Suchen", einMensch: "Ein Mensch, bitte",
  wonach: "Wonach suchen Sie?", suchePlatz: "z. B. kündigen, Rate, Vollmacht, Mahnbescheid",
  keinTrefferA: "Kein Treffer. Fragen Sie den Assistenten auf der ", keinTrefferLink: "Kontaktseite", keinTrefferB: " – er antwortet sofort.",
  nichtDabeiTag: "Nicht dabei?", nichtDabeiTitel: "Drei Wege zu einem Menschen",
  nichtDabeiA: "Der ", nichtDabeiLink: "Assistent auf der Kontaktseite", nichtDabeiB: " antwortet sofort und kennt die Plattform im Detail. Kunden erreichen ihre Ansprechpartnerin im Kundenbereich unter Hilfe. Alle anderen: Support +41 44 244 93 01 (werktags 9–19 Uhr) oder support@fiaon.com – Antwort innerhalb eines Werktags. Dringendes landet über „Dringend melden“ direkt bei der Geschäftsführung.",
  zwischenrufA: "Lieber reden als lesen?", zwischenrufB: " 15 Minuten am Telefon, kostenlos – wählen Sie ein Zeitfenster.",
  terminBuchen: "Startgespräch buchen", werkzeuge: "Kostenlose Werkzeuge",
  themen: [
    { key: "antrag", titel: "Antrag und Start", satz: "Vom ersten Klick bis zum Startgespräch.", fragen: [
      { f: "Wie lange dauert der Antrag?", a: "Etwa zwei Minuten: E-Mail, Name, Geburtsdatum, Telefon, Adresse (füllt sich beim Tippen selbst aus), Beschäftigung, Einkommen, Wunschlimit. Danach nehmen Sie den Vertrag an und sind sofort in Ihrem Bereich." },
      { f: "Was passiert nach dem Antrag?", a: "Sie legen ein Passwort fest und wählen: „Jetzt aktivieren“ (Zahlungsdaten mit QR-Code) oder „Zuerst sprechen“ (Termin mit einem Mitarbeiter). Nach Zahlungseingang buchen Sie das Startgespräch – bis dahin bleibt der Bereich geschlossen." },
      { f: "Was ist das Startgespräch?", a: "Ein Telefonat von rund 15 Minuten mit einem Mitarbeiter: Lage, Ziel, Unterlagen, nächste Schritte. Es ist Pflicht, weil danach Ihre Auskunft beantragt wird. Wer vorher einen Termin über /termin gebucht hat, braucht keinen zweiten." },
      { f: "Kann ich das Paket noch ändern?", a: "Ja – im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf der Preisseite gibt die erste Orientierung." },
      { f: "Ich habe den Antrag abgebrochen – was nun?", a: "Sie können jederzeit weitermachen: Der Link in der E-Mail führt zurück in den Antrag. Es entstehen keine Kosten, bis Sie den Vertrag annehmen und die erste Rate zahlen." },
    ] },
    { key: "zahlung", titel: "Zahlung und Raten", satz: "Erste Rate, SEPA, Zahlungskalender.", fragen: [
      { f: "Wie bezahle ich die erste Rate?", a: "Per Überweisung an die Zahlungsdaten im Kundenbereich (mit QR-Code zum Scannen). Sobald die Bank den Eingang bestätigt, ist Ihr Paket aktiv – „bezahlt“ heißt bei FIAON immer bankbestätigt, nicht nur gemeldet." },
      { f: "Wie laufen die weiteren Raten?", a: "Per SEPA-Lastschrift über einen verifizierten Kreditor, jeweils zum Monatsanfang. Sie erteilen das Mandat einmal im Kundenbereich. Zwei Tage vor jeder Abbuchung erinnert der Zahlungskalender." },
      { f: "Meine Zahlung ist nicht angekommen – was tun?", a: "Überweisungen brauchen ein bis zwei Bankarbeitstage. Prüfen Sie Verwendungszweck (Ihre Referenz) und Betrag. Ist die Zahlung nach drei Werktagen nicht zugeordnet, melden Sie sich mit Datum und Betrag beim Support – wir suchen sie im Bankbuch." },
      { f: "Was passiert, wenn eine Rate nicht abgebucht werden kann?", a: "Sie bekommen eine Nachricht mit einem neuen Termin; es entstehen keine Mahngebühren bei FIAON. Melden Sie sich vor dem Termin, wenn es eng wird – Ihre Ansprechpartnerin kann eine Rate verschieben." },
      { f: "Bekomme ich eine Rechnung?", a: "Ja, je Rate im Kundenbereich unter Abo & Zahlungen als PDF – mit Umsatzsteuer ausgewiesen." },
      { f: "Wird die Bonitätsauskunft angerechnet?", a: "Wer zuerst nur die Auskunft (74 Euro) bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag auf die erste Rate angerechnet – sagen Sie es im Startgespräch." },
    ] },
    { key: "auskunft", titel: "Auskunft und Einträge", satz: "Was FIAON beschafft und wie Sie es lesen.", fragen: [
      { f: "Welche Auskünfte beschafft FIAON?", a: "In Deutschland die SCHUFA (auf Wunsch auch Boniversum, CRIF), in Österreich KSV1870 und CRIF, in der Schweiz CRIF, Intrum und den Betreibungsregisterauszug – mit Ihrer digitalen Vollmacht. Sie füllen kein Formular aus." },
      { f: "Wie lange dauert es, bis die Auskunft da ist?", a: "Die Auskunfteien haben einen Monat Zeit (Art. 15 DSGVO); in der Praxis kommen Datenkopien oft nach ein bis drei Wochen. Sobald sie vorliegt, sehen Sie sie innerhalb von 24 Stunden erklärt im Kundenbereich." },
      { f: "Was bedeuten die Bewertungen an den Einträgen?", a: "Jeder Eintrag bekommt eine Einordnung: erledigt, löschbar, berichtigbar, angreifbar – oder berechtigt. Berechtigt heißt: zulässig gemeldet und noch in der Frist; daran ändert kein Schreiben etwas, und das sagen wir vorher." },
      { f: "Was ist der neue SCHUFA-Score?", a: "Seit dem 17. März 2026 rechnet die SCHUFA mit 100 bis 999 Punkten aus zwölf veröffentlichten Kriterien in fünf Klassen. Er ersetzt den Basisscore in Prozent. FIAON ordnet Ihren Score je Kriterium ein – die Tabelle steht auf der Seite SCHUFA-Score verstehen." },
      { f: "Kann ich meine Auskunft selbst kostenlos anfordern?", a: "Ja, die Datenkopie nach Art. 15 DSGVO ist bei jeder Auskunftei kostenlos. Der Selbstauskunft-Generator unter /werkzeuge/selbstauskunft schreibt den Brief. FIAON lohnt sich für die Erklärung, die Prüfung und alles danach." },
    ] },
    { key: "schreiben", titel: "Schreiben und Fristen", satz: "Löschanträge, Widersprüche, Ratenangebote.", fragen: [
      { f: "Wer schreibt die Briefe?", a: "FIAON, aus anwaltlich geprüften Vorlagen, mit Ihren Daten und dem passenden Grund (§ 31 BDSG, Art. 16/17/21 DSGVO). Sie sehen jedes Schreiben im Kundenbereich und geben es frei – nichts geht ohne Sie raus." },
      { f: "Wie werden die Schreiben versendet?", a: "Ab dem Paket Pro per Einschreiben durch FIAON; im Paket Start bereiten wir sie vor und Sie versenden selbst. Der Nachweis über den Zugang liegt in Ihrer Akte." },
      { f: "Wie lange dauert es, bis eine Auskunftei antwortet?", a: "Einen Monat nach Zugang, in Ausnahmefällen mit Mitteilung bis zu drei. FIAON verfolgt die Frist und fasst nach; bei Ablehnung ohne Grund folgt die Beschwerde bei der Datenschutzaufsicht (Art. 77 DSGVO)." },
      { f: "Was, wenn ein Gläubiger nicht reagiert?", a: "Dann geht die Aufforderung an die Auskunftei, die selbst prüfen muss – und parallel die Erinnerung mit Frist an den Gläubiger. Sie sehen jeden Schritt und jede Antwort in Ihrer Akte." },
      { f: "Ich habe einen Mahnbescheid bekommen – hilft FIAON?", a: "FIAON ist keine Rechtsberatung; die Widerspruchsfrist (zwei Wochen) müssen Sie selbst wahren – der Fristenrechner unter /werkzeuge/mahnbescheid nennt den Tag. Wir prüfen mit Ihnen Forderung, Kosten und Verjährung und formulieren Ratenangebote." },
    ] },
    { key: "konto", titel: "Konto und Karte", satz: "Girokonto, Kreditkarte, Rahmen.", fragen: [
      { f: "Bekomme ich garantiert ein Konto oder eine Karte?", a: "Nein – und wer das verspricht, arbeitet unseriös. FIAON bereitet vor: Girokonto beim Partnerinstitut für jeden Kunden, Kreditkarte, sobald Ihre Akte die Schwelle des Kartenpartners erreicht. Über die Vergabe entscheidet die Bank." },
      { f: "Was ist die Karten-Readiness?", a: "Ein Wert, den FIAON aus Einträgen, Einkommen und Kontoverhalten berechnet. Er zeigt, wie nah Sie an der Schwelle des Kartenpartners sind und welcher Schritt sie wie weit bewegt – ein Fortschrittsbalken, kein Versprechen." },
      { f: "Ich habe ein Basiskonto – reicht das?", a: "Das Basiskonto ist Ihr gesetzliches Recht und ein guter Boden: Gehaltseingänge, pünktliche Abbuchungen, kein Dauer-Dispo bauen die Kontohistorie, die Banken später lesen. Der Weg über FIAON baut darauf auf." },
      { f: "Wie hoch ist der Rahmen am Anfang?", a: "Das entscheidet der Kartenpartner anhand der Akte; typisch beginnt es klein und wächst mit pünktlicher Abrechnung. Die Zeitachse steht auf der Seite Kreditkarte trotz Eintrag – ein typischer Verlauf, kein Versprechen." },
    ] },
    { key: "kuendigung", titel: "Kündigung und Widerruf", satz: "Monatlich, formlos, ohne Grund.", fragen: [
      { f: "Wie kündige ich?", a: "Jederzeit zum Ende des laufenden Monats, formlos: im Kundenbereich unter Abo & Zahlungen mit einem Klick oder per E-Mail an support@fiaon.com. Sie bekommen eine Bestätigung; die letzte Rate ist die des laufenden Monats." },
      { f: "Gibt es ein Widerrufsrecht?", a: "Ja, 14 Tage ab Vertragsschluss, ohne Angabe von Gründen – die Widerrufsbelehrung und das Musterformular stehen auf der Seite Widerrufsbelehrung. Bereits erbrachte Leistungen (etwa eine beschaffte Auskunft) werden anteilig berechnet." },
      { f: "Was passiert mit meinen Daten nach der Kündigung?", a: "Auf Wunsch löschen wir Auskunft, Unterlagen und Akte vollständig (Art. 17 DSGVO) und bestätigen das innerhalb von 30 Tagen. Gesetzliche Aufbewahrungspflichten für Rechnungen bleiben." },
      { f: "Laufen meine Schreiben nach der Kündigung weiter?", a: "Bereits versendete Schreiben bleiben wirksam – die Auskunftei muss antworten. Die Nachverfolgung durch FIAON endet mit dem Paket; Sie erhalten alle Unterlagen als Kopie." },
    ] },
    { key: "datenschutz", titel: "Datenschutz und Sicherheit", satz: "Wo Ihre Daten liegen, wer sie sieht.", fragen: [
      { f: "Wo liegen meine Daten?", a: "Auf Servern in Frankfurt am Main (EU), verschlüsselt übertragen und gespeichert. Details und den Live-Status finden Sie unter /status und /sicherheit." },
      { f: "Wer sieht meine Akte?", a: "Ihre Ansprechpartnerin, die Betreiber – und niemand sonst. Partnerbanken sehen nur, was Sie ausdrücklich freigeben; die Einwilligung wird protokolliert und ist widerrufbar." },
      { f: "Sieht FIAON mein Online-Banking?", a: "Nein. Sie laden Kontoauszüge als Datei oder Foto hoch; die Kontoanbindung (PSD2) ist in Vorbereitung und wird nur mit Ihrer ausdrücklichen Zustimmung genutzt." },
      { f: "Wie bekomme ich eine Kopie meiner Daten bei FIAON?", a: "Im Kundenbereich unter Mein Konto oder per E-Mail – Auskunft nach Art. 15 DSGVO, kostenlos, innerhalb eines Monats." },
    ] },
    { key: "mitarbeiter", titel: "Mitarbeiter werden", satz: "Von zuhause, fest oder frei.", fragen: [
      { f: "Kann ich als Kunde für FIAON arbeiten?", a: "Ja – viele im Team waren selbst Kunden. Bewerbung in vier Schritten auf der Karriere-Seite; Florentine meldet sich persönlich innerhalb von zwei Werktagen." },
      { f: "Fest oder frei?", a: "Beides: Festanstellung oder freie Mitarbeit auf Provision, remote in Deutschland, Österreich und der Schweiz. Niemand spricht mit Kunden, bevor er die Academy bestanden hat." },
      { f: "Was verdiene ich?", a: "Das steht im Gespräch und im Vertrag – ehrlich geregelt, keine Fantasiezahlen auf der Website. Auf der Karriere-Seite steht, wie die Zusammenarbeit funktioniert." },
    ] },
  ] as HilfeThema[],
};

const en: typeof de = {
  metaTitel: "Help centre · answers at a glance",
  metaBeschreibung: "Application, payment, report, letters, account and card, cancellation, privacy, joining the team: the FIAON help centre answers the most common questions — with search.",
  seoTitel: "Help centre: answers on application, payment, report",
  seoBeschreibung: "Application, payment, report, letters, account and card, cancellation, privacy, joining the team: the FIAON help centre answers the most common questions — with search.",
  krume: "Help",
  pille: "Help centre", h1a: "Answers, ", h1b: "before you have to ask.",
  lead: "Eight topics, the same answers as on the phone and in the assistant. Search — or open the topic that is on your mind.",
  suchen: "Search", einMensch: "A person, please",
  wonach: "What are you looking for?", suchePlatz: "e.g. cancel, instalment, authorisation, court order",
  keinTrefferA: "No match. Ask the assistant on the ", keinTrefferLink: "contact page", keinTrefferB: " — it answers straight away.",
  nichtDabeiTag: "Not here?", nichtDabeiTitel: "Three ways to a person",
  nichtDabeiA: "The ", nichtDabeiLink: "assistant on the contact page", nichtDabeiB: " answers straight away and knows the platform in detail. Customers reach their contact person in the customer area under Help. Everyone else: support +41 44 244 93 01 (weekdays 9–19 h) or support@fiaon.com — a reply within one working day. Urgent matters go straight to the management via “Report urgently”.",
  zwischenrufA: "Rather talk than read?", zwischenrufB: " 15 minutes on the phone, free — choose a time slot.",
  terminBuchen: "Book a call", werkzeuge: "Free tools",
  themen: [
    { key: "antrag", titel: "Application and start", satz: "From the first click to the onboarding call.", fragen: [
      { f: "How long does the application take?", a: "About two minutes: e-mail, name, date of birth, phone, address (fills in as you type), occupation, income, desired limit. Then you accept the contract and are in your area straight away. The application is currently in German; our team helps in English on the phone." },
      { f: "What happens after the application?", a: "You set a password and choose: “Activate now” (payment details with a QR code) or “Talk first” (an appointment with one of our team). After the payment arrives you book the onboarding call — until then the area stays closed." },
      { f: "What is the onboarding call?", a: "A phone call of around 15 minutes with one of our team: situation, goal, documents, next steps. It is mandatory because your report is requested afterwards. Anyone who booked a call beforehand does not need a second one." },
      { f: "Can I still change the plan?", a: "Yes — in the application, in the onboarding call and upwards at any time afterwards; downwards from the next instalment cycle. The plan finder on the pricing page gives a first orientation." },
      { f: "I abandoned the application — what now?", a: "You can continue at any time: the link in the e-mail takes you back into the application. No costs arise until you accept the contract and pay the first instalment." },
    ] },
    { key: "zahlung", titel: "Payment and instalments", satz: "First instalment, SEPA, payment calendar.", fragen: [
      { f: "How do I pay the first instalment?", a: "By bank transfer to the payment details in the customer area (with a QR code to scan). As soon as the bank confirms receipt, your plan is active — at FIAON “paid” always means bank-confirmed, not just reported." },
      { f: "How do the further instalments work?", a: "By SEPA direct debit through a verified creditor, at the start of each month. You grant the mandate once in the customer area. Two days before each debit the payment calendar reminds you." },
      { f: "My payment has not arrived — what should I do?", a: "Bank transfers take one to two banking days. Check the reference (your reference) and the amount. If the payment has not been allocated after three working days, contact support with date and amount — we look for it in the bank ledger." },
      { f: "What happens if an instalment cannot be collected?", a: "You get a message with a new date; no reminder fees arise at FIAON. Get in touch before the date if money is tight — your contact person can move an instalment." },
      { f: "Do I get an invoice?", a: "Yes, per instalment in the customer area under Subscription & payments as a PDF — with VAT shown." },
      { f: "Is the credit report credited?", a: "If you first buy only the report (€74) and choose a plan within 30 days, the amount is credited against the first instalment — say so in the onboarding call." },
    ] },
    { key: "auskunft", titel: "Report and entries", satz: "What FIAON obtains and how to read it.", fragen: [
      { f: "Which reports does FIAON obtain?", a: "In Germany SCHUFA (on request also Boniversum, CRIF), in Austria KSV1870 and CRIF, in Switzerland CRIF, Intrum and the debt enforcement register extract — with your digital authorisation. You fill in no forms." },
      { f: "How long until the report arrives?", a: "The credit bureaus have one month (Art. 15 GDPR); in practice data copies often arrive after one to three weeks. As soon as it is there, you see it explained in the customer area within 24 hours." },
      { f: "What do the assessments on the entries mean?", a: "Every entry gets a classification: settled, deletable, correctable, challengeable — or justified. Justified means: lawfully reported and still within the deadline; no letter changes that, and we say so beforehand." },
      { f: "What is the new SCHUFA score?", a: "Since 17 March 2026 SCHUFA calculates 100 to 999 points from twelve published criteria in five classes. It replaces the base score in per cent. FIAON classifies your score criterion by criterion — the table is on the page Understanding the SCHUFA score." },
      { f: "Can I request my report myself free of charge?", a: "Yes, the data copy under Art. 15 GDPR is free at every credit bureau. The self-disclosure generator under /werkzeuge/selbstauskunft writes the letter. FIAON is worth it for the explanation, the review and everything afterwards." },
    ] },
    { key: "schreiben", titel: "Letters and deadlines", satz: "Deletion requests, objections, instalment offers.", fragen: [
      { f: "Who writes the letters?", a: "FIAON, from templates reviewed by lawyers, with your data and the fitting ground (Section 31 BDSG, Art. 16/17/21 GDPR). You see every letter in the customer area and approve it — nothing goes out without you." },
      { f: "How are the letters sent?", a: "From the Pro plan upwards by registered post through FIAON; in the Start plan we prepare them and you send them yourself. The proof of delivery is in your file." },
      { f: "How long until a credit bureau replies?", a: "One month after receipt, in exceptional cases with notice up to three. FIAON tracks the deadline and follows up; if refused without reason, a complaint to the data protection authority follows (Art. 77 GDPR)." },
      { f: "What if a creditor does not react?", a: "Then the request goes to the credit bureau, which has to check itself — and in parallel the reminder with a deadline to the creditor. You see every step and every reply in your file." },
      { f: "I have received a court payment order — does FIAON help?", a: "FIAON is not legal advice; you must keep the objection deadline (two weeks) yourself — the deadline calculator under /werkzeuge/mahnbescheid names the day. We check claim, costs and limitation with you and draft instalment offers." },
    ] },
    { key: "konto", titel: "Account and card", satz: "Current account, credit card, limit.", fragen: [
      { f: "Am I guaranteed an account or a card?", a: "No — and anyone who promises that is not serious. FIAON prepares: a current account with the partner institution for every customer, a credit card as soon as your file reaches the card partner's threshold. The bank decides on the issue." },
      { f: "What is card readiness?", a: "A value FIAON calculates from entries, income and account behaviour. It shows how close you are to the card partner's threshold and which step moves it how far — a progress bar, not a promise." },
      { f: "I have a basic account — is that enough?", a: "The basic account is your legal right and good ground: salary receipts, punctual debits, no permanent overdraft build the account history that banks read later. The route via FIAON builds on that." },
      { f: "How high is the limit at the start?", a: "The card partner decides that on the basis of the file; typically it starts small and grows with statements settled on time. The timeline is on the page A credit card despite an entry — a typical course, not a promise." },
    ] },
    { key: "kuendigung", titel: "Cancellation and withdrawal", satz: "Monthly, informal, without giving a reason.", fragen: [
      { f: "How do I cancel?", a: "At any time to the end of the current month, informally: in the customer area under Subscription & payments with one click or by e-mail to support@fiaon.com. You get a confirmation; the last instalment is the one for the current month." },
      { f: "Is there a right of withdrawal?", a: "Yes, 14 days from the conclusion of the contract, without giving reasons — the withdrawal notice and the model form are on the page Right of withdrawal. Services already provided (such as a report obtained) are charged proportionately." },
      { f: "What happens to my data after cancellation?", a: "On request we delete report, documents and file completely (Art. 17 GDPR) and confirm it within 30 days. Statutory retention obligations for invoices remain." },
      { f: "Do my letters continue after cancellation?", a: "Letters already sent remain effective — the credit bureau has to reply. Follow-up by FIAON ends with the plan; you receive all documents as copies." },
    ] },
    { key: "datenschutz", titel: "Privacy and security", satz: "Where your data is held, who sees it.", fragen: [
      { f: "Where is my data held?", a: "On servers in Frankfurt am Main (EU), encrypted in transit and at rest. Details and the live status are under /status and /en/security." },
      { f: "Who sees my file?", a: "Your contact person, the operators — and nobody else. Partner banks see only what you explicitly approve; the consent is logged and revocable." },
      { f: "Does FIAON see my online banking?", a: "No. You upload bank statements as a file or photo; account connection (PSD2) is being prepared and will only be used with your explicit consent." },
      { f: "How do I get a copy of my data at FIAON?", a: "In the customer area under My account or by e-mail — access under Art. 15 GDPR, free, within one month." },
    ] },
    { key: "mitarbeiter", titel: "Joining the team", satz: "From home, employed or freelance.", fragen: [
      { f: "Can I work for FIAON as a customer?", a: "Yes — many in the team were customers themselves. Application in four steps on the careers page; Florentine gets in touch personally within two working days." },
      { f: "Employed or freelance?", a: "Both: employment or freelance work on commission, remote in Germany, Austria and Switzerland. Nobody speaks to customers before passing the Academy." },
      { f: "What do I earn?", a: "That is settled in the conversation and in the contract — regulated honestly, no fantasy numbers on the website. The careers page explains how the collaboration works." },
    ] },
  ],
};

export const HILFE_WOERTER = { de, en };
