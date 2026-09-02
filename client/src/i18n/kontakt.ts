// ═══════════════════════════════════════════════════════════════════════════
// /kontakt · /en/contact — das Wörterbuch der Seite (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel; die Seite liest über useWoerter().
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Kontakt & Support",
  metaBeschreibung: "FIAON Support: Telefon +41 44 244 93 01, E-Mail support@fiaon.com. KI-Assistent für alle Fragen zur Plattform, Dringendes direkt an die Geschäftsführung.",
  pille: "Kontakt & Support", h1a: "Wir sind ", h1b: "erreichbar.",
  lead: "Ein Mensch am Telefon, eine Antwort per E-Mail, ein Assistent, der die Plattform kennt – und ein direkter Draht für alles, was nicht warten kann.",
  telefon: "Telefon", telefonSatz: "Werktags · Deutsch und Englisch", email: "E-Mail", emailSatz: "Antwort in der Regel am selben Werktag",
  dringend: "Dringend", dringendTitel: "Direkt an die Geschäftsführung", dringendSatz: "Landet sofort im Dashboard – Priorität heute",
  assistentPille: "Der FIAON-Assistent", assistentH2a: "Fragen Sie, ", assistentH2b: "was Sie wollen.",
  assistentLead: "Pakete, Ablauf, Zahlung, Startgespräch, Ihre Rechte gegenüber SCHUFA, KSV und CRIF – der Assistent kennt die Plattform im Detail und antwortet sofort. Er sieht keine Kundendaten und ersetzt keine Rechtsberatung.",
  dringendPille: "Dringend melden", dringendH2a: "Wenn es ", dringendH2b: "nicht warten kann.",
  dringendLead: "Eine Frist läuft morgen ab, eine Zahlung ist falsch zugeordnet, ein Brief der Gegenseite braucht sofort eine Antwort: Ihre Meldung landet direkt als Aufgabe mit Priorität „heute“ bei der Geschäftsführung – oder bei Ihrer Ansprechpartnerin, wenn Sie angemeldet sind.",
  name: "Name", namePlatz: "Max Mustermann", emailFeld: "E-Mail", emailPlatz: "max@beispiel.de", telefonFeld: "Telefon", telefonPlatz: "+49 170 1234567",
  anWen: "An wen", anGf: "Geschäftsführung (Justin Schwarzott)", anAnsprech: "Meine Ansprechpartnerin / mein Ansprechpartner", anAnsprechAnmelden: "Mein Ansprechpartner (bitte anmelden)",
  wasPassiert: "Was ist passiert – und bis wann muss etwas geschehen?", wasPlatz: "Kurz und konkret: Worum geht es, welche Frist, welche Referenz?",
  wirdGesendet: "Wird gesendet …", dringendMelden: "Dringend melden",
  angemeldetAls: (ref: string) => `Angemeldet als ${ref} – Ihre Meldung wird Ihrer Akte zugeordnet.`, kundeHinweis: "Kunde? Nach der Anmeldung erreicht die Meldung direkt Ihre Ansprechpartnerin.",
  angekommen: (nummer: string, an: string) => `Angekommen – Vorgang Nr. ${nummer}. Ihre Meldung liegt jetzt bei ${an}. Wir melden uns so schnell wie möglich.`,
  nichtGeklappt: "Das hat nicht geklappt – bitte rufen Sie uns an.", keineVerbindung: "Keine Verbindung – bitte rufen Sie uns an.",
  erwartenPille: "Was Sie erwarten können",
  erwarten: [
    { tag: "Am Telefon", titel: "Ein Mensch, der die Akte kennt", text: "Kunden erreichen ihre Ansprechpartnerin direkt; Interessenten den Vertrieb. Keine Warteschleife mit Musik, keine Nummern, die Sie tippen müssen." },
    { tag: "Per E-Mail", titel: "Antwort am selben Werktag", text: "Schreiben Sie an support@fiaon.com – mit Referenz, wenn Sie Kunde sind. Anhänge wie Briefe der Gegenseite gern als Foto." },
    { tag: "Im Bereich", titel: "Anliegen in der Akte", text: "Angemeldete Kunden stellen Fragen unter „Hilfe“ im Kundenbereich. Jede Antwort bleibt in der Akte nachlesbar." },
  ],
  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Wann erreiche ich FIAON telefonisch?", a: "Werktags unter +41 44 244 93 01. Außerhalb der Zeiten nutzen Sie „Dringend melden“ – die Meldung liegt am nächsten Werktag als Erstes oben." },
    { f: "Ich bin Kunde – wo stelle ich Fragen zu meiner Akte?", a: "Am besten im Kundenbereich unter „Hilfe“: Dort sieht Ihre Ansprechpartnerin die Akte gleich mit. Dringendes über diese Seite mit „An meine Ansprechpartnerin“." },
    { f: "Kann der Assistent meine Zahlung oder meinen Termin prüfen?", a: "Nein – er hat keinen Zugriff auf Kundendaten. Zahlung, Termin und Unterlagen sehen Sie im Kundenbereich; bei Unstimmigkeiten hilft der Support." },
    { f: "Wie schnell reagiert die Geschäftsführung auf „Dringend“?", a: "Die Meldung erscheint sofort mit Priorität „heute“ in der Aufgabenliste der Geschäftsführung. Eine Rückmeldung erhalten Sie in der Regel am selben Werktag per Telefon oder E-Mail." },
    { f: "Wohin mit Post, Rechnungen oder rechtlichen Schreiben?", a: "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Rechtlich relevante Post bitte zusätzlich als Foto per E-Mail – das spart Tage." },
  ],
};

const en: typeof de = {
  metaTitel: "Contact & support",
  metaBeschreibung: "FIAON support: phone +41 44 244 93 01, e-mail support@fiaon.com. An AI assistant for all questions about the platform, urgent matters straight to the management.",
  pille: "Contact & support", h1a: "We are ", h1b: "reachable.",
  lead: "A person on the phone, an answer by e-mail, an assistant that knows the platform — and a direct line for everything that cannot wait.",
  telefon: "Phone", telefonSatz: "Weekdays · German and English", email: "E-mail", emailSatz: "Reply usually on the same working day",
  dringend: "Urgent", dringendTitel: "Straight to the management", dringendSatz: "Lands in the dashboard immediately — priority today",
  assistentPille: "The FIAON assistant", assistentH2a: "Ask ", assistentH2b: "whatever you like.",
  assistentLead: "Plans, process, payment, onboarding call, your rights towards SCHUFA, KSV and CRIF — the assistant knows the platform in detail and answers straight away. It sees no customer data and is no substitute for legal advice.",
  dringendPille: "Report something urgent", dringendH2a: "When it ", dringendH2b: "cannot wait.",
  dringendLead: "A deadline expires tomorrow, a payment has been allocated wrongly, a letter from the other side needs an answer now: your report lands directly as a task with priority “today” with the management — or with your contact person if you are logged in.",
  name: "Name", namePlatz: "Jane Doe", emailFeld: "E-mail", emailPlatz: "jane@example.com", telefonFeld: "Phone", telefonPlatz: "+49 170 1234567",
  anWen: "To whom", anGf: "Management (Justin Schwarzott)", anAnsprech: "My contact person", anAnsprechAnmelden: "My contact person (please log in)",
  wasPassiert: "What has happened — and by when does something need to happen?", wasPlatz: "Short and concrete: what is it about, which deadline, which reference?",
  wirdGesendet: "Sending …", dringendMelden: "Report urgently",
  angemeldetAls: (ref: string) => `Logged in as ${ref} — your report will be attached to your file.`, kundeHinweis: "A customer? After logging in, your report reaches your contact person directly.",
  angekommen: (nummer: string, an: string) => `Received — case no. ${nummer}. Your report is now with ${an}. We will get back to you as quickly as possible.`,
  nichtGeklappt: "That did not work — please call us.", keineVerbindung: "No connection — please call us.",
  erwartenPille: "What you can expect",
  erwarten: [
    { tag: "On the phone", titel: "A person who knows the file", text: "Customers reach their contact person directly; prospects reach sales. No hold music, no numbers to type." },
    { tag: "By e-mail", titel: "A reply on the same working day", text: "Write to support@fiaon.com — with your reference if you are a customer. Attachments such as letters from the other side are welcome as photos." },
    { tag: "In your area", titel: "Requests in the file", text: "Logged-in customers ask questions under “Help” in the customer area. Every answer stays readable in the file." },
  ],
  fragenPille: "Frequently asked questions",
  fragen: [
    { f: "When can I reach FIAON by phone?", a: "On weekdays on +41 44 244 93 01. Outside those hours use “Report urgently” — the report is at the top of the list first thing on the next working day." },
    { f: "I am a customer — where do I ask questions about my file?", a: "Best in the customer area under “Help”: there your contact person sees the file alongside. Urgent matters via this page with “To my contact person”." },
    { f: "Can the assistant check my payment or my appointment?", a: "No — it has no access to customer data. You see payment, appointment and documents in the customer area; if something does not add up, support helps." },
    { f: "How quickly does the management react to “Urgent”?", a: "The report appears immediately with priority “today” in the management's task list. You usually get a reply on the same working day by phone or e-mail." },
    { f: "Where do I send post, invoices or legal letters?", a: "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Legally relevant post please additionally as a photo by e-mail — that saves days." },
  ],
};

export const KONTAKT_WOERTER = { de, en };
