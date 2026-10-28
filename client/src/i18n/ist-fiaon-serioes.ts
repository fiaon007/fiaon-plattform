// ═══════════════════════════════════════════════════════════════════════════
// /ist-fiaon-serioes · /en/is-fiaon-legit — das Wörterbuch der Seite (28.10.2026, E-445)
// Die Abschnitte und die Tabelle „Auf einen Blick“ stehen in shared/fiaon-serioes.ts (sichtbar UND im
// Vorab-HTML); hier nur Knöpfe, kurze Sätze und die FAQ. Der FAQ-Generator teilt an „const en“ —
// Antworten deshalb als reine Zeichenketten, ohne Einsetzungen.
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Ist FIAON seriös? Die Fakten",
  metaBeschreibung: "Ist FIAON seriös oder Abzocke? Die prüfbaren Fakten: FIAON LTD London (Nr. 17318250), Zahlung nur per Überweisung, klare Laufzeit, Datenschutz, Kontakt.",
  krume: "Ist FIAON seriös?",
  pille: (stand: string) => `Die Fakten · Stand ${stand}`,
  dieFakten: "Die Fakten", kontakt: "Kontakt",
  registerPruefen: "Registereintrag prüfen", impressum: "Impressum", team: "Das Team",
  bankTag: "Unser einziges Geschäftskonto",
  bankZeilen: { empfaenger: "Empfänger", iban: "IBAN", bic: "BIC", bank: "Bank" },
  agb: "AGB", widerruf: "Widerrufsbelehrung", preise: "Alle Preise",
  sicherheit: "Datenschutz & Sicherheit", datenschutz: "Datenschutzerklärung",
  dringend: "Dringend melden", termin: "Startgespräch buchen",
  soArbeitet: "So arbeitet FIAON", soArbeitetSatz: "Der Ablauf in drei Schritten und ein Seriositäts-Check, der für jeden Anbieter gilt.",
  fragenTitel: "Häufige Fragen zur Seriosität",
  fragen: [
    { f: "Ist FIAON seriös?", a: "Prüfen Sie es an Fakten, nicht an Versprechen: FIAON wird von der FIAON LTD betrieben, eingetragen im britischen Handelsregister Companies House unter der Nummer 17318250, Sitz 128 City Road, London. Sie zahlen nur per Überweisung auf das Geschäftskonto der FIAON LTD, Paket und Monatsentgelt stehen vor dem Abschluss fest, es gilt das gesetzliche Widerrufsrecht von 14 Tagen, und Sie erreichen Menschen per Telefon und E-Mail." },
    { f: "Ist FIAON Abzocke?", a: "Nein – und Sie können es selbst prüfen. Vor dem Abschluss sehen Sie Paket, Monatsentgelt, Gesamtbetrag, Laufzeit und Kündigungsregel; dieselben Angaben stehen in Ihrer Vertragsbestätigung. Von Ihrem Konto wird nichts abgebucht – jede Zahlung lösen Sie selbst per Überweisung aus. Die Leistungen stehen im Vertrag, und jeder Schritt ist in Ihrem Kundenbereich nachlesbar." },
    { f: "Wer steht hinter FIAON?", a: "Die FIAON LTD mit Sitz in 128 City Road, London, EC1V 2NX, eingetragen beim Companies House (England and Wales) unter der Nummer 17318250. Geschäftsführer ist der Gründer Justin Schwarzott. Den Eintrag können Sie kostenlos und ohne Anmeldung auf der Seite des Companies House einsehen; alle Pflichtangaben stehen im Impressum." },
    { f: "Wohin zahle ich, und wie erkenne ich eine echte Zahlungsaufforderung?", a: "Sie zahlen nur per Überweisung an den Empfänger FIAON LTD; die Bankverbindung steht auf dieser Seite und in jeder Zahlungsaufforderung, zusammen mit Ihrem persönlichen Verwendungszweck. FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto. Erhalten Sie eine solche Aufforderung im Namen von FIAON, zahlen Sie bitte nicht und melden Sie sich bei support@fiaon.com oder unter +41 44 244 93 01." },
    { f: "Ist FIAON eine Bank oder ein Kreditvermittler?", a: "FIAON ist eine Plattform für Bonität und Zugang. Ihr Konto und Ihre Visa-Kreditkarte führt unsere Partnerbank, die DKB; FIAON bereitet Ihren Antrag mit Ihnen vor. FIAON vermittelt keine Kredite und verlangt keine Gebühr für einen Kredit – Sie zahlen ein Monatsentgelt für Leistungen, die in Ihrem Vertrag stehen." },
    { f: "Wie lange läuft der Vertrag, und wie kündige ich?", a: "Pakete für Privatkunden haben eine Mindestlaufzeit von zwölf Monaten und sind danach jederzeit mit einer Frist von einem Monat kündbar. Zum Ende der Mindestlaufzeit kündigen Sie mit einem Monat Frist – formlos per E-Mail an support@fiaon.com oder im Kundenbereich unter „Abo & Zahlungen“. Das gesetzliche Widerrufsrecht von 14 Tagen ab Vertragsschluss gilt zusätzlich. FIAON Global arbeitet mit Festpreisen je Paket." },
    { f: "Was passiert mit meinen Daten?", a: "Ihre Akte liegt auf Servern in Frankfurt am Main, verschlüsselt bei Übertragung und Ablage. FIAON verarbeitet nur, was Sie selbst hochladen, verschickt kein Schreiben ohne Ihre Freigabe und verkauft keine Daten. Auskunft, Berichtigung und Löschung nach der DSGVO können Sie jederzeit verlangen; nach Vertragsende löschen wir Ihre Unterlagen auf Wunsch vollständig, nur Rechnungsdaten bleiben aus gesetzlichen Gründen aufbewahrt." },
    { f: "Wie erreiche ich FIAON?", a: "Telefonisch werktags unter +41 44 244 93 01, per E-Mail an support@fiaon.com (Antwort in der Regel am selben Werktag), als Kunde im Kundenbereich unter „Hilfe“ und für Dringendes über „Dringend melden“ auf der Kontaktseite – die Meldung geht direkt an die Geschäftsführung. Post: FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom." },
    { f: "Warum finde ich Warnungen oder Bewertungen, die nicht zu FIAON passen?", a: "Weil es Unternehmen mit ähnlich klingenden Namen gibt. FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die FIAON LTD in London. Warnlisten von Aufsichtsbehörden und Verbraucherportalen nennen Anbieter mit Namen und Adresse – prüfen Sie beides genau. Wenn etwas nicht zusammenpasst, fragen Sie uns direkt." },
  ],
  schlussA: "Noch eine Frage offen?", schlussB: " Rufen Sie uns an oder schreiben Sie uns – ein Mensch antwortet, in der Regel am selben Werktag.",
};

const en: typeof de = {
  metaTitel: "Is FIAON legit? The facts",
  metaBeschreibung: "Is FIAON legitimate? The verifiable facts: FIAON LTD London (Companies House 17318250), payment by bank transfer only, clear terms, privacy, contact.",
  krume: "Is FIAON legit?",
  pille: (stand: string) => `The facts · as of ${stand}`,
  dieFakten: "The facts", kontakt: "Contact",
  registerPruefen: "Check the register entry", impressum: "Legal notice", team: "The team",
  bankTag: "Our only business account",
  bankZeilen: { empfaenger: "Recipient", iban: "IBAN", bic: "BIC", bank: "Bank" },
  agb: "Terms and conditions", widerruf: "Right of withdrawal", preise: "All prices",
  sicherheit: "Privacy & security", datenschutz: "Privacy policy",
  dringend: "Report urgently", termin: "Book an introductory call",
  soArbeitet: "How FIAON works", soArbeitetSatz: "The process in three steps and a seriousness check that applies to every provider.",
  fragenTitel: "Frequently asked questions",
  fragen: [
    { f: "Is FIAON legit?", a: "Judge us on facts, not promises: FIAON is operated by FIAON LTD, registered with Companies House (England and Wales) under number 17318250, registered office 128 City Road, London. You pay by bank transfer only, to the business account of FIAON LTD; plan and monthly fee are fixed before you sign; the statutory 14-day right of withdrawal applies; and you can reach real people by phone and e-mail." },
    { f: "Is FIAON a scam?", a: "No — and you can check that yourself. Before you sign, you see the plan, the monthly fee, the total amount, the term and the cancellation rule; the same details are repeated in your contract confirmation. Nothing is ever debited from your account — you make every payment yourself by bank transfer. The services are set out in the contract, and every step is visible in your customer area." },
    { f: "Who is behind FIAON?", a: "FIAON LTD, registered office 128 City Road, London, EC1V 2NX, registered with Companies House (England and Wales) under number 17318250. The Director is the founder, Justin Schwarzott. You can view the entry free of charge and without an account on the Companies House website; all statutory details are in the legal notice (Impressum)." },
    { f: "Where do I pay, and how do I recognise a genuine payment request?", a: "You pay by bank transfer only, to the recipient FIAON LTD; the account details are on this page and in every payment request, together with your personal payment reference. FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account. If you receive such a request in FIAON's name, please do not pay and contact support@fiaon.com or +41 44 244 93 01." },
    { f: "Is FIAON a bank or a credit broker?", a: "FIAON is a platform for credit standing and access. Your account and your Visa credit card are provided by our partner bank, DKB; FIAON prepares your application with you. FIAON does not broker loans and never charges a fee for a loan — you pay a monthly fee for services set out in your contract." },
    { f: "How long does the contract run, and how do I cancel?", a: "Plans for private customers have a minimum term of twelve months and can then be cancelled at any time with one month's notice. To end the contract at the close of the minimum term, give one month's notice — informally by e-mail to support@fiaon.com or in your customer area under “Subscription & payments”. The statutory 14-day right of withdrawal from the conclusion of the contract applies in addition. FIAON Global works with a fixed price per package." },
    { f: "What happens to my data?", a: "Your file is stored on servers in Frankfurt am Main, encrypted in transit and at rest. FIAON processes only what you upload yourself, sends no letter without your approval and never sells data. You can request access, correction and erasure under the GDPR at any time; once the contract has ended, we delete your documents in full on request — only invoicing records are kept, as the law requires." },
    { f: "How do I reach FIAON?", a: "By phone on weekdays on +41 44 244 93 01, by e-mail to support@fiaon.com (reply usually on the same working day), as a customer in your customer area under “Help”, and for anything urgent via “Report urgently” on the contact page — your message goes straight to the management. Post: FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom." },
    { f: "Why do I find warnings or reviews that do not fit FIAON?", a: "Because there are companies with similar-sounding names. FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is FIAON LTD in London. Warning lists from regulators and consumer portals name providers with their name and address — check both carefully. If something does not add up, ask us directly." },
  ],
  schlussA: "Still have a question?", schlussB: " Call us or write to us — a person replies, usually on the same working day.",
};

export const SERIOES_WOERTER = { de, en };
