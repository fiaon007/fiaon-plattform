// ═══════════════════════════════════════════════════════════════════════════
// /ueber-uns · /en/about — das Wörterbuch der Seite (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel; die Seite liest über useWoerter().
// Alle Daten aus Register, Logbuch und Datenbank — in beiden Sprachen dieselben.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Über FIAON · Geschichte, Meilensteine, Haltung",
  metaBeschreibung: "Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, jede Entscheidung im Register. Sitz London, Betrieb in DACH.",
  seoTitel: "Über FIAON: Geschichte, Meilensteine und Haltung",
  seoBeschreibung: "Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, jede Entscheidung im Register.",
  krume: "Über FIAON",
  pille: "Über FIAON", h1a: "Der Platz, den ", h1b: "niemand besetzt hatte.",
  lead: "Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen stand niemand – bis FIAON. Hier steht, warum es uns gibt, was seit der Gründung passiert ist und woran wir uns halten. Mit Daten, nicht mit Gefühlen.",
  meilensteineKnopf: "Die Meilensteine", teamKnopf: "Das Team",
  zahlen: [{ wert: "2025", label: "gegründet, FIAON LTD" }, { wert: "440+", label: "zahlende Kunden, bankbestätigt" }, { wert: "3", label: "Länder: DE, AT, CH" }, { wert: "8", label: "Menschen im Team" }],
  stand: "Stand 2. September 2026.",
  warumH2a: "Warum es FIAON ", warumH2b: "gibt.", warumLead: "Eine Beobachtung, die jeder kennt, der je eine Ablehnung ohne Erklärung bekommen hat.",
  warum1: "100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Die meisten wissen nicht, was dort steht. Wer es herausfindet, steht vor einem Berg: Paragrafen, Fristen, Formulare, Briefe, die niemand zurückverfolgt. Score-Apps zeigen die Zahl und lassen einen dann allein. Anwälte sind für die Klage da, nicht für den zwölften Nachfass-Brief. Schuldnerberatungen sind wertvoll – und haben Wartelisten.",
  warum2: "FIAON besetzt den Platz dazwischen: Einsicht (die Auskunft, erklärt), Aktion (Schreiben, die rausgehen und verfolgt werden), Zugang (das Konto, die Karte, später die Finanzierung). Ein Betriebssystem für Bonität – gebaut wie eine Bank, gesprochen wie ein Mensch.",
  meilH2a: "Was seit der Gründung ", meilH2b: "passiert ist.", meilLead: "Jeder Punkt lässt sich belegen – im Handelsregister, im Logbuch, in der Datenbank.",
  meilensteine: [
    { zeit: "2025", titel: "Gründung als FIAON LTD", text: "Eintragung im britischen Handelsregister (Company No. 17318250). Die Idee: Der Platz zwischen Auskunftei und Bank ist unbesetzt – Score-Apps zeigen, Banken entscheiden, dazwischen hilft niemand." },
    { zeit: "Frühjahr 2026", titel: "Die Plattform wird gebaut", text: "Kundenbereich, Antrag, Startgespräch, Schreiben aus anwaltlich geprüften Vorlagen. Zahlungen per Überweisung und SEPA-Lastschrift über einen verifizierten Kreditor – nie Vorkasse für Unerbrachtes." },
    { zeit: "4. Juli 2026", titel: "Erste bankbestätigte Zahlung", text: "Der erste Kunde, dessen Zahlung die Bank bestätigt hat – seither zählt FIAON nur, was bankbestätigt ist. Keine Anmeldungen, keine Absichten." },
    { zeit: "August 2026", titel: "Team, Academy, Ratgeber, Werkzeuge", text: "Acht Menschen in Vertrieb, Onboarding und Forderungsmanagement; niemand spricht mit Kunden, bevor er die Academy bestanden hat. Der Ratgeber mit Quellen je Zahl, die ersten kostenlosen Werkzeuge." },
    { zeit: "24. August 2026", titel: "Server nach Frankfurt", text: "Anwendung und Datenbank ziehen aus den USA in die EU-Region Frankfurt um. Seither: Deploys ohne Unterbrechung über einen Gesundheitspfad, Praxistest gegen die echte Datenbank vor jedem Release." },
    { zeit: "2. September 2026", titel: "Über 440 zahlende Kunden, 20 Werkzeuge", text: "443 zahlende Kunden in Deutschland, Österreich und der Schweiz, 450 bezahlte Raten, 20 kostenlose Werkzeuge, 57 Ratgeber – und die Korrektur aller Texte auf den neuen SCHUFA-Score." },
  ],
  szeneA: "Erst ein Land perfekt. ", szeneB: "Dann die Nachbarn.",
  szeneText: "Deutschland mit der SCHUFA, Österreich mit KSV1870 und CRIF, die Schweiz mit CRIF, Intrum und dem Betreibungsregister – dieselbe Plattform, drei Regelwerke. Danach Europa: dasselbe Betriebssystem, weitere Auskunfteien.",
  haltungH2a: "Woran wir uns ", haltungH2b: "halten.", haltungLead: "Vier Regeln, die in jedem Gespräch, jedem Schreiben und jeder Entscheidung gelten.",
  haltung: [
    { tag: "Respekt", titel: "Sie-Form, immer", text: "Kunden werden gesiezt. Wer bei FIAON anruft, spricht mit jemandem, der seine Akte kennt – nicht mit einer Warteschleife und nicht mit einem Bot." },
    { tag: "Ehrlichkeit", titel: "Keine Fantasiezahlen", text: "Über Konto und Karte entscheidet die Bank. Berechtigte Einträge lassen sich nicht weglöschen. Wir versprechen, was wir halten: Einsicht binnen 24 Stunden nach Vorliegen, geprüfte Schreiben, verfolgte Antworten." },
    { tag: "Prüfbarkeit", titel: "Jede Entscheidung ein Eintrag", text: "Entscheidungsregister und Logbuch seit Tag eins, eine Quelle für jede Zahl. Wer das Unternehmen prüft, findet alles – Investoren im Datenraum, Kunden in ihrer Akte." },
    { tag: "Herkunft", titel: "Wem geholfen wurde, hilft", text: "Viele im Team waren selbst Kunden. Sie erklären den Weg, weil sie ihn gegangen sind – nach der Academy, mit Prüfung, bevor sie das erste Gespräch führen." },
  ],
  sitzH2a: "Sitz London, ", sitzH2b: "Betrieb in DACH.", sitzLead: "Eine Frage, die Prüfer stellen – deshalb steht die Antwort hier.",
  sitzText: "FIAON LTD ist im britischen Handelsregister eingetragen (Company No. 17318250, 128 City Road, London EC1V 2NX) – mit öffentlich einsehbaren Unterlagen. Der Betrieb liegt in der DACH-Region: Server und Datenbank in Frankfurt am Main, Support unter einer Schweizer Nummer, Team und Kunden in Deutschland, Österreich und der Schweiz, Investor in Zürich. Eine Gesellschaft im Europäischen Wirtschaftsraum ist in Vorbereitung; Entscheidung und Begründung stehen im Register.",
  zitat: "Ein Unternehmen, das jederzeit geprüft werden kann, wird besser geführt. Deshalb halten wir alles fest – nicht für den Verkauf, sondern für die Kunden.", zitatWer: "Justin Schwarzott, Gründer und Geschäftsführer",
  fragenTitel: "Häufige Fragen zu FIAON",
  fragen: [
    { f: "Warum sitzt FIAON in London, wenn die Kunden in Deutschland, Österreich und der Schweiz sind?", a: "Die Gesellschaft wurde als FIAON LTD im britischen Handelsregister gegründet (Company No. 17318250) – schnell, transparent und mit öffentlich einsehbaren Unterlagen. Der Betrieb, das Team und die Server sind in der DACH-Region: Server in Frankfurt, Support mit Schweizer Nummer, Kunden in drei Ländern. Eine Gesellschaft im EWR ist in Vorbereitung." },
    { f: "Wer steht hinter FIAON?", a: "Gründer und Geschäftsführer Justin Schwarzott; Florentine Lombardi (Menschen und Onboarding) und Daniel Stripling (Vertrieb) als Gesellschafter im operativen Betrieb; ein Team aus Vertrieb, Onboarding und Forderungsmanagement – viele davon selbst ehemalige Kunden. Investor und Partner: Schwarzott Capital Partners AG, Zürich. Namen und Gesichter stehen auf der Team-Seite." },
    { f: "Ist FIAON eine Bank, ein Inkasso oder eine Kanzlei?", a: "Nichts davon. FIAON ist eine Bonitätsplattform: Auskunft beschaffen und erklären, Einträge nach DSGVO und § 31 BDSG angreifen, Raten verhandeln, Konto und Karte beim Partnerinstitut vorbereiten. Keine Rechtsberatung im Einzelfall, keine Kreditvermittlung, keine eigenen Konten." },
    { f: "Wie verdient FIAON Geld?", a: "Mit Festpreisen: der Bonitätsauskunft (74 Euro einmalig) und Paketen über zwölf Monatsraten. Keine Erfolgsbeteiligung, keine Gebühr je Schreiben. Über Partnerbanken kann später eine Vergütung je vermitteltem Konto hinzukommen – das steht offen auf der Partner-Seite." },
    { f: "Warum führt FIAON ein öffentliches Entscheidungsregister?", a: "Weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Jede Entscheidung mit Datum, Alternativen und Begründung; jeder Tag im Logbuch. Investoren sehen es im Datenraum, Kunden merken es daran, dass Regeln nicht über Nacht wechseln." },
  ],
  teamKennenlernen: "Das Team kennenlernen", soArbeitet: "So arbeitet FIAON", presse: "Presse",
};

const en: typeof de = {
  metaTitel: "About FIAON · history, milestones, principles",
  metaBeschreibung: "Why FIAON exists, who is behind it, what has happened since it was founded and what the company holds to: courtesy, no guarantees, every decision on record. Registered in London, operating in DACH.",
  seoTitel: "About FIAON: history, milestones and principles",
  seoBeschreibung: "Why FIAON exists, who is behind it, what has happened since it was founded and what the company holds to: courtesy, no guarantees, every decision on record.",
  krume: "About FIAON",
  pille: "About FIAON", h1a: "The place ", h1b: "nobody had taken.",
  lead: "Score apps show a number. Banks decide. In between stood nobody — until FIAON. Here is why we exist, what has happened since we were founded and what we hold to. With data, not feelings.",
  meilensteineKnopf: "The milestones", teamKnopf: "The team",
  zahlen: [{ wert: "2025", label: "founded, FIAON LTD" }, { wert: "440+", label: "paying customers, bank-confirmed" }, { wert: "3", label: "countries: DE, AT, CH" }, { wert: "8", label: "people in the team" }],
  stand: "As of 2 September 2026.",
  warumH2a: "Why FIAON ", warumH2b: "exists.", warumLead: "An observation familiar to anyone who has ever received a rejection without an explanation.",
  warum1: "100 million people in Germany, Austria and Switzerland have an entry with SCHUFA, KSV or CRIF. Most do not know what it says. Those who find out face a mountain: sections of law, deadlines, forms, letters nobody follows up. Score apps show the number and then leave you alone. Lawyers are there for the lawsuit, not for the twelfth follow-up letter. Debt counselling is valuable — and has waiting lists.",
  warum2: "FIAON takes the place in between: insight (the report, explained), action (letters that go out and are followed up), access (the account, the card, later finance). An operating system for creditworthiness — built like a bank, spoken like a person.",
  meilH2a: "What has happened ", meilH2b: "since we were founded.", meilLead: "Every point can be verified — in the companies register, in the logbook, in the database.",
  meilensteine: [
    { zeit: "2025", titel: "Founded as FIAON LTD", text: "Registered at Companies House (Company No. 17318250). The idea: the place between credit bureau and bank is empty — score apps display, banks decide, nobody helps in between." },
    { zeit: "Spring 2026", titel: "The platform is built", text: "Customer area, application, onboarding call, letters from templates reviewed by lawyers. Payments by bank transfer and SEPA direct debit through a verified creditor — never payment in advance for services not delivered." },
    { zeit: "4 July 2026", titel: "First bank-confirmed payment", text: "The first customer whose payment the bank confirmed — since then FIAON counts only what is bank-confirmed. No sign-ups, no intentions." },
    { zeit: "August 2026", titel: "Team, Academy, guides, tools", text: "Eight people in sales, onboarding and collections; nobody speaks to customers before passing the Academy. The guides with a source for every number, the first free tools." },
    { zeit: "24 August 2026", titel: "Servers to Frankfurt", text: "Application and database move from the USA to the EU region Frankfurt. Since then: deployments without interruption via a health path, a practical test against the real database before every release." },
    { zeit: "2 September 2026", titel: "Over 440 paying customers, 20 tools", text: "443 paying customers in Germany, Austria and Switzerland, 450 paid instalments, 20 free tools, 57 guides — and every text corrected for the new SCHUFA score." },
  ],
  szeneA: "One country done properly first. ", szeneB: "Then the neighbours.",
  szeneText: "Germany with SCHUFA, Austria with KSV1870 and CRIF, Switzerland with CRIF, Intrum and the debt enforcement register — the same platform, three sets of rules. Then Europe: the same operating system, more credit bureaus.",
  haltungH2a: "What we ", haltungH2b: "hold to.", haltungLead: "Four rules that apply in every conversation, every letter and every decision.",
  haltung: [
    { tag: "Respect", titel: "Courtesy, always", text: "Customers are addressed formally. Anyone who calls FIAON speaks to someone who knows their file — not to a queue and not to a bot." },
    { tag: "Honesty", titel: "No fantasy numbers", text: "The bank decides on account and card. Justified entries cannot be deleted away. We promise what we keep: insight within 24 hours of the report arriving, reviewed letters, replies followed up." },
    { tag: "Verifiability", titel: "Every decision an entry", text: "A decision register and a logbook since day one, one source for every number. Anyone who audits the company finds everything — investors in the data room, customers in their file." },
    { tag: "Origin", titel: "Those who were helped, help", text: "Many in the team were customers themselves. They explain the path because they have walked it — after the Academy, with an exam, before they hold their first call." },
  ],
  sitzH2a: "Registered in London, ", sitzH2b: "operating in DACH.", sitzLead: "A question auditors ask — so the answer is here.",
  sitzText: "FIAON LTD is registered at Companies House (Company No. 17318250, 128 City Road, London EC1V 2NX) — with publicly available filings. Operations are in the DACH region: servers and database in Frankfurt am Main, support on a Swiss number, team and customers in Germany, Austria and Switzerland, investor in Zurich. A company in the European Economic Area is being prepared; decision and reasoning are on record in the register.",
  zitat: "A company that can be audited at any time is run better. That is why we record everything — not for a sale, but for the customers.", zitatWer: "Justin Schwarzott, founder and managing director",
  fragenTitel: "Frequently asked questions about FIAON",
  fragen: [
    { f: "Why is FIAON based in London when the customers are in Germany, Austria and Switzerland?", a: "The company was founded as FIAON LTD at Companies House (Company No. 17318250) — quick, transparent and with publicly available filings. Operations, team and servers are in the DACH region: servers in Frankfurt, support on a Swiss number, customers in three countries. A company in the EEA is being prepared." },
    { f: "Who is behind FIAON?", a: "Founder and managing director Justin Schwarzott; Florentine Lombardi (people and onboarding) and Daniel Stripling (sales) as shareholders in day-to-day operations; a team in sales, onboarding and collections — many of them former customers themselves. Investor and partner: Schwarzott Capital Partners AG, Zurich. Names and faces are on the team page." },
    { f: "Is FIAON a bank, a debt collector or a law firm?", a: "None of those. FIAON is a credit platform: obtain and explain the report, challenge entries under the GDPR and Section 31 BDSG, negotiate instalments, prepare account and card with the partner institution. No legal advice in individual cases, no credit brokerage, no accounts of its own." },
    { f: "How does FIAON make money?", a: "With fixed prices: the credit report (€74 one-off) and plans over twelve monthly instalments. No success fee, no fee per letter. Through partner banks a fee per account introduced may be added later — that is stated openly on the partner page." },
    { f: "Why does FIAON keep a public decision register?", a: "Because a company that can be audited at any time is run better. Every decision with date, alternatives and reasoning; every day in the logbook. Investors see it in the data room; customers notice it in rules that do not change overnight." },
  ],
  teamKennenlernen: "Meet the team", soArbeitet: "How FIAON works", presse: "Press",
};

export const UEBER_UNS_WOERTER = { de, en };
