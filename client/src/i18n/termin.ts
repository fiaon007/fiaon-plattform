// ═══════════════════════════════════════════════════════════════════════════
// /termin · /en/book-a-call — das Wörterbuch der Seite (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel; die Seite liest über useWoerter().
// Die Anfrage läuft in beiden Sprachen über dieselbe Art „termin" an den
// Betreiber; englische Auswahlwerte landen so in der Aufgabe.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Startgespräch buchen · 15 Minuten, ein Mensch",
  metaBeschreibung: "Lieber erst reden? Wählen Sie ein Zeitfenster – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos, ohne Verpflichtung, werktags 9 bis 19 Uhr.",
  seoTitel: "Startgespräch buchen: 15 Minuten mit einem Menschen",
  seoBeschreibung: "Lieber erst reden? Zeitfenster wählen – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos, ohne Verpflichtung.",
  krume: "Startgespräch buchen",
  pille: "Startgespräch · kostenlos, ohne Verpflichtung", h1a: "Lieber erst ", h1b: "reden?",
  lead: "15 Minuten am Telefon, ein Mensch, der die Auskunft lesen kann. Sie sagen, was Sie beschäftigt – wir sagen, was geht, was nicht geht und was es kosten würde. Wählen Sie ein Zeitfenster; der Rückruf kommt spätestens am nächsten Werktag.",
  zeitfenster: "Zeitfenster wählen", direktStarten: "Lieber direkt starten",
  zahlen: [{ wert: "15", label: "Minuten, mehr braucht es selten" }, { wert: "0 €", label: "kostet das Gespräch" }, { wert: "9–19", label: "Uhr, werktags erreichbar" }, { wert: "1", label: "Mensch, danach mit Namen" }],
  ablaufH2a: "Was in den 15 Minuten ", ablaufH2b: "passiert.", ablaufLead: "Dieselbe Agenda, nach der unsere Mitarbeiter jedes Startgespräch führen – Sie wissen vorher, was kommt.",
  ablauf: [
    { titel: "Ihre Lage", text: "Was ist passiert – Ablehnung, Brief, Eintrag, Kündigung? Welche Auskunftei, welches Land? Zwei Minuten, keine Formulare." },
    { titel: "Was die Auskunft hergibt", text: "Wir erklären, was ein Eintrag rechtlich bedeutet, ob er angreifbar sein könnte und welche Frist läuft – ohne Versprechen, mit Paragrafen." },
    { titel: "Ihr Ziel", text: "Nur Klarheit? Einträge weg? Konto, Karte, Finanzierung? Das Ziel bestimmt den Weg – und ob FIAON überhaupt der richtige ist." },
    { titel: "Der ehrliche Vorschlag", text: "Kostenlose Werkzeuge, die Auskunft für 74 Euro oder ein Paket – wir nennen das, was zu Ihrem Fall passt, nicht das teuerste." },
    { titel: "Die nächsten Schritte", text: "Wenn Sie wollen: Paket, erste Rate, Vollmacht, Auskunft. Wenn nicht: eine Zusammenfassung per E-Mail und die Links zu den Werkzeugen." },
  ],
  buchenH2a: "Zeitfenster wählen – ", buchenH2b: "wir rufen an.", buchenLead: "Ihre Angaben gehen direkt ins Team; niemand außerhalb von FIAON sieht sie. Sie bekommen eine Bestätigung per E-Mail.",
  felder: {
    name: "Vor- und Nachname", telefon: "Telefon (für den Rückruf)", email: "E-Mail (Bestätigung)", land: "Land",
    laender: ["Deutschland", "Österreich", "Schweiz"],
    fenster: "Wunsch-Zeitfenster", fensterOptionen: ["So schnell wie möglich", "Heute 9–12 Uhr", "Heute 12–15 Uhr", "Heute 15–19 Uhr", "Morgen vormittags", "Morgen nachmittags", "Nächste Woche"],
    thema: "Worum geht es?", themaOptionen: ["Ablehnung bei Konto/Karte/Kredit", "Brief von Inkasso oder Mahnbescheid", "Eintrag in der Auskunft", "Ich will nur wissen, was drinsteht", "Konto oder Karte gesucht", "Etwas anderes"],
    text: "Was sollten wir vorher wissen? (optional)",
  },
  knopf: "Rückruf anfordern",
  hinweis: "Kostenlos, ohne Verpflichtung. Wir rufen im gewünschten Zeitfenster an, spätestens am nächsten Werktag. Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben zur Terminvereinbarung zu (Datenschutzerklärung).",
  warumH2a: "Warum reden, bevor Sie ", warumH2b: "etwas kaufen?", warumLead: "Weil die Antwort manchmal „Sie brauchen uns nicht“ lautet.",
  warum: [
    { tag: "Ehrlich", titel: "Manchmal reichen die Werkzeuge", text: "Ein einziger, klar erledigter Eintrag: Der Löschantrag-Generator schreibt den Brief kostenlos. Das sagen wir am Telefon – und schicken den Link." },
    { tag: "Konkret", titel: "Die Frist, die gerade läuft", text: "Mahnbescheid, Inkassofrist, Löschfrist: Am Telefon klären wir in zwei Minuten, welcher Tag der letzte ist – bevor Sie ein Paket wählen." },
    { tag: "Passend", titel: "Das richtige Paket, nicht das größte", text: "Start, Pro, Ultra oder nur die Auskunft: Der Unterschied liegt darin, wie viel FIAON übernimmt. Wer allein nachhalten kann, braucht weniger." },
  ],
  fragenTitel: "Häufige Fragen zum Gespräch",
  fragen: [
    { f: "Was kostet das Gespräch?", a: "Nichts. Es ist ein Telefonat von rund 15 Minuten, ohne Verpflichtung. Danach wissen Sie, was Ihre Auskunft hergibt, welches Paket passt – oder dass die kostenlosen Werkzeuge in Ihrem Fall reichen. Das sagen wir Ihnen genauso." },
    { f: "Wer ruft mich an?", a: "Ein Mitarbeiter aus Vertrieb oder Onboarding – ein Mensch mit Namen, der die Plattform selbst täglich nutzt; viele im Team waren selbst Kunden. Kein Callcenter, kein Bot." },
    { f: "Was sollte ich bereithalten?", a: "Nichts Pflichtiges. Hilfreich sind: der Brief oder die Auskunft, um die es geht, die ungefähre Höhe offener Forderungen und ein Blick auf den Kontoauszug der letzten drei Monate. Wer schon eine Datenkopie hat, legt sie neben das Telefon." },
    { f: "Wie schnell kommt der Rückruf?", a: "Im gewünschten Zeitfenster, spätestens am nächsten Werktag. Wer „so schnell wie möglich“ wählt, wird in der Regel innerhalb weniger Stunden angerufen – zu den Telefonzeiten des Teams (werktags 9 bis 19 Uhr)." },
    { f: "Ist das schon das Startgespräch?", a: "Wenn Sie danach ein Paket wählen und die erste Rate eingeht, wird derselbe Termin zum Startgespräch – Sie brauchen keinen zweiten. Wer nur reden wollte, hat geredet. Beides ist in Ordnung." },
    { f: "Ich bin schon Kunde – wo buche ich?", a: "Im Kundenbereich unter Hilfe erreichen Sie Ihre Ansprechpartnerin direkt; dort steht auch der nächste Termin. Diese Seite ist für alle, die FIAON noch nicht kennen." },
  ],
  zwischenrufA: "Lieber schriftlich?", zwischenrufB: " Der FIAON-Assistent auf der Kontaktseite beantwortet Fragen sofort – oder Sie schreiben an support@fiaon.com.",
  zurKontaktseite: "Zur Kontaktseite", eintragPruefen: "Eintrag kostenlos prüfen",
};

const en: typeof de = {
  metaTitel: "Book a call · 15 minutes, one person",
  metaBeschreibung: "Rather talk first? Choose a time slot — one of our team calls you, explains what your report shows and which plan fits. Free, no obligation, weekdays 9 to 19 h.",
  seoTitel: "Book a call: 15 minutes with a person",
  seoBeschreibung: "Rather talk first? Choose a time slot — one of our team calls you, explains what your report shows and which plan fits. Free, no obligation.",
  krume: "Book a call",
  pille: "Onboarding call · free, no obligation", h1a: "Rather ", h1b: "talk first?",
  lead: "15 minutes on the phone with a person who can read a credit report. You say what is on your mind — we say what is possible, what is not and what it would cost. Choose a time slot; the call comes back on the next working day at the latest.",
  zeitfenster: "Choose a time slot", direktStarten: "Rather start straight away",
  zahlen: [{ wert: "15", label: "minutes — it rarely takes more" }, { wert: "€0", label: "is what the call costs" }, { wert: "9–19", label: "h, reachable on weekdays" }, { wert: "1", label: "person, known by name afterwards" }],
  ablaufH2a: "What happens ", ablaufH2b: "in the 15 minutes.", ablaufLead: "The same agenda our team follows in every onboarding call — you know beforehand what is coming.",
  ablauf: [
    { titel: "Your situation", text: "What has happened — a rejection, a letter, an entry, a termination? Which credit bureau, which country? Two minutes, no forms." },
    { titel: "What the report shows", text: "We explain what an entry means legally, whether it might be challengeable and which deadline is running — without promises, with the relevant sections." },
    { titel: "Your goal", text: "Just clarity? Entries gone? Account, card, finance? The goal determines the path — and whether FIAON is the right choice at all." },
    { titel: "The honest suggestion", text: "Free tools, the report for €74 or a plan — we name what fits your case, not the most expensive option." },
    { titel: "The next steps", text: "If you want: plan, first instalment, authorisation, report. If not: a summary by e-mail and the links to the tools." },
  ],
  buchenH2a: "Choose a time slot — ", buchenH2b: "we call you.", buchenLead: "Your details go straight to the team; nobody outside FIAON sees them. You receive a confirmation by e-mail.",
  felder: {
    name: "First and last name", telefon: "Phone (for the call back)", email: "E-mail (confirmation)", land: "Country",
    laender: ["Germany", "Austria", "Switzerland"],
    fenster: "Preferred time slot", fensterOptionen: ["As soon as possible", "Today 9–12 h", "Today 12–15 h", "Today 15–19 h", "Tomorrow morning", "Tomorrow afternoon", "Next week"],
    thema: "What is it about?", themaOptionen: ["Rejection for account/card/loan", "Letter from a debt collector or a court order", "An entry in my report", "I just want to know what is on file", "Looking for an account or a card", "Something else"],
    text: "What should we know beforehand? (optional)",
  },
  knopf: "Request a call back",
  hinweis: "Free, no obligation. We call in the preferred time slot, on the next working day at the latest. By sending you agree to the processing of your details for arranging the call (privacy policy). Our team speaks English.",
  warumH2a: "Why talk before you ", warumH2b: "buy anything?", warumLead: "Because sometimes the answer is “you do not need us”.",
  warum: [
    { tag: "Honest", titel: "Sometimes the tools are enough", text: "A single, clearly settled entry: the deletion request generator writes the letter free of charge. We say so on the phone — and send the link." },
    { tag: "Concrete", titel: "The deadline running right now", text: "Court order, collection deadline, deletion deadline: on the phone we clarify in two minutes which day is the last — before you choose a plan." },
    { tag: "Fitting", titel: "The right plan, not the biggest", text: "Start, Pro, Ultra or just the report: the difference is how much FIAON takes on. Anyone who can follow up alone needs less." },
  ],
  fragenTitel: "Frequently asked questions about the call",
  fragen: [
    { f: "What does the call cost?", a: "Nothing. It is a phone call of around 15 minutes, with no obligation. Afterwards you know what your report shows, which plan fits — or that the free tools are enough in your case. We tell you that just the same." },
    { f: "Who calls me?", a: "Someone from sales or onboarding — a person with a name who uses the platform every day; many in the team were customers themselves. No call centre, no bot." },
    { f: "What should I have to hand?", a: "Nothing is required. Helpful: the letter or the report in question, the rough amount of open claims and a look at your bank statements for the last three months. If you already have a data copy, keep it next to the phone." },
    { f: "How quickly does the call come?", a: "In the preferred time slot, on the next working day at the latest. If you choose “as soon as possible”, you are usually called within a few hours — during the team's phone hours (weekdays 9 to 19 h)." },
    { f: "Is this already the onboarding call?", a: "If you choose a plan afterwards and the first instalment arrives, the same appointment becomes the onboarding call — you do not need a second one. If you just wanted to talk, you have talked. Both are fine." },
    { f: "I am already a customer — where do I book?", a: "In the customer area under Help you reach your contact person directly; your next appointment is shown there too. This page is for everyone who does not know FIAON yet." },
  ],
  zwischenrufA: "Rather in writing?", zwischenrufB: " The FIAON assistant on the contact page answers questions straight away — or write to support@fiaon.com.",
  zurKontaktseite: "To the contact page", eintragPruefen: "Check an entry for free",
};

export const TERMIN_WOERTER = { de, en };
