// ═══════════════════════════════════════════════════════════════════════════
// /team · /en/team — das Wörterbuch der Seite UND der Team-Bausteine (02.09.2026)
// Namen, E-Mails, Telefonnummern und Fotos bleiben in components/site/Team.tsx
// (eine Quelle); hier stehen nur die TEXTE je Person und je Bereich in beiden
// Sprachen, per Kürzel zugeordnet. Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Team",
  metaBeschreibung: "Das Team hinter FIAON: Justin Schwarzott (Gründer), Florentine Lombardi (Menschen & Onboarding), Daniel Stripling (Vertrieb) – und Schwarzott Capital Partners AG als Investor.",
  pille: "Team", h1a: "Ein junges Legal- und FinTech ", h1b: "auf dem Weg zum Unicorn.",
  lead: "FIAON ist ein Team aus Vertrieb, Onboarding und Forderungsmanagement – und drei Gesellschaftern, die selbst im Betrieb stehen. Wir bauen das Betriebssystem für Bonität in Deutschland, Österreich und der Schweiz: Einsicht, Aktion, Zugang für 100 Millionen Menschen. Und wir suchen Menschen, die das mit uns bauen.",
  kontakt: "Kontakt aufnehmen", teilWerden: "Teil des Teams werden",
  szeneNamen: ["Vertrieb", "Onboarding", "Betreuung"],
  teamPille: "Das Team", teamH2a: "Die Menschen, die Sie ", teamH2b: "am Telefon erreichen.",
  teamLead: "Vertrieb, Onboarding, Forderungsmanagement – wer bei FIAON anruft, spricht mit einem dieser Menschen. Viele von ihnen waren selbst Kunden.",
  gesPille: "Die Gesellschafter", gesH2a: "Wer was ", gesH2b: "verantwortet.",
  arbeitPille: "So arbeiten wir", arbeitH2a: "Ein Kunde, ", arbeitH2b: "drei Hände.",
  arbeitLead: "Jeder Kunde durchläuft dieselben drei Stationen – und an jeder steht jemand, der seinen Namen kennt.",
  arbeit: [
    { titel: "Vertrieb", text: "Daniels Team führt das erste Gespräch: Was steht in der Auskunft, welches Paket passt, was ist der erste Schritt. Kein Verkaufen gegen den Kunden." },
    { titel: "Onboarding", text: "Florentines Team übernimmt: Startgespräch, Zahlung prüfen, Auskunft beantragen, Fahrplan festlegen. Jeder Kunde kennt danach seinen Ansprechpartner." },
    { titel: "Betreuung", text: "Schreiben freigeben, Raten begleiten, Fristen halten, Zugang vorbereiten. Justin liest jede Woche die Zahlen dahinter – und jede Rückfrage." },
  ],
  grundPille: "Grundsätze", grundH2a: "Woran wir uns ", grundH2b: "halten.",
  grund: [
    { tag: "Sie-Form", titel: "Respekt zuerst", text: "Kunden werden gesiezt, immer. Wer bei FIAON anruft, spricht mit jemandem, der seine Akte kennt – nicht mit einer Warteschleife." },
    { tag: "Ehrlich", titel: "Keine Fantasiezahlen", text: "Über Konto und Karte entscheidet die Bank. Wir versprechen, was wir halten: Einsicht in 24 Stunden, geprüfte Schreiben, ein Mensch am Telefon." },
    { tag: "Festgehalten", titel: "Jede Entscheidung ein Eintrag", text: "Register, Logbuch, eine Quelle für jede Zahl. Wer das Unternehmen prüft, findet alles – vom ersten Tag an." },
    { tag: "Aus Kunden", titel: "Wer geholfen bekam, hilft", text: "Viele im Team waren selbst Kunden. Sie erklären den Weg, weil sie ihn gegangen sind." },
  ],
  zwischenruf: "Sie möchten von zuhause für das arbeiten, was Ihnen selbst geholfen hat? Florentine liest jede Bewerbung persönlich.", bewerben: "In 60 Sekunden bewerben", fuerPartner: "Für Partner",
  kontaktPille: "Kontakt", kontaktH2a: "Direkt zu ", kontaktH2b: "uns.", investor: "Investor",
  fussZeile: "FIAON LTD · 128 City Road, London EC1V 2NX · Companies House No. 17318250 · Kundenanliegen: support@fiaon.com",
  abschlussA: "Ein Team, das Sie ", abschlussB: "beim Namen kennt.",
  abschlussText: "Einsicht, Aktion, Zugang – dahinter stehen Menschen, die jeden Schritt selbst gehen. Wenn Sie starten, lernen Sie einen von ihnen im Startgespräch kennen.",
  jetztStarten: "Jetzt starten", fuerInvestoren: "Für Investoren",
  // ── Die Bausteine (components/site/Team.tsx) ─────────────────────────────
  personen: {
    justin: { rolle: "Gründer · Geschäftsführer · Director", kurz: "Führt FIAON seit dem ersten Tag – Produkt, Strategie, Partner. Entscheidungen stehen im Register, jeder Tag im Logbuch.", lang: "Justin hat FIAON gegründet, weil er gesehen hat, wie viele Menschen an einem Eintrag scheitern, den niemand erklärt und niemand anfasst. Er verantwortet Produkt, Strategie, Partnerschaften und Finanzen – und führt das Unternehmen so, als würde es morgen geprüft." },
    florentine: { rolle: "Gesellschafterin · Menschen & Onboarding", kurz: "Verantwortet Mitarbeiter, Einschulungen und Onboardings – jeder neue Kollege und jeder neue Kunde beginnt bei ihr.", lang: "Florentine baut das Team auf und hält es zusammen: Sie schult neue Mitarbeiter in der Academy, begleitet die Onboardings und sorgt dafür, dass jeder Kunde sein Startgespräch mit einem Menschen führt, der die Akte kennt." },
    daniel: { rolle: "Gesellschafter · Leitung Vertrieb", kurz: "Leitet den gesamten Vertrieb – vom ersten Anruf bis zum Abschluss, inklusive Provisionsregeln und Qualität der Gespräche.", lang: "Daniel führt den Vertrieb: Gesprächsqualität, Ergebnisse, Provisionen, Bestandspflege. Er entscheidet, wer welchen Kunden betreut, und hält die Linie zwischen ‚verkaufen‘ und ‚helfen‘ – bei FIAON ist das dasselbe." },
  } as Record<string, { rolle: string; kurz: string; lang: string }>,
  mitarbeiter: {
    nikita: { rolle: "Vertrieb", titel: "Der erste Anruf", text: "Nikita ist oft die erste Stimme, die ein Kunde von FIAON hört. Er erklärt in fünf Minuten, was eine Auskunft ist, was sie nicht ist – und welches Paket zu der Lage des Menschen passt, nicht zu seinem Wunsch." },
    lucas: { rolle: "Vertrieb", titel: "Klartext statt Verkaufsdruck", text: "Lucas führt Gespräche so, wie er sie selbst gern hätte: ehrlich, ohne Versprechen, mit einem klaren nächsten Schritt. Wer bei ihm ‚Nein‘ sagt, bekommt trotzdem einen Rat, was er selbst tun kann." },
    angelique: { rolle: "Vertrieb", titel: "Die Brücke zur Akte", text: "Angelique sorgt dafür, dass aus einem Interessenten ein Kunde mit vollständigen Unterlagen wird – Paket, Zahlung, Termin. Nichts bleibt liegen, und niemand muss zweimal dasselbe erzählen." },
    viktoria: { rolle: "Onboarding", titel: "Das Startgespräch", text: "Viktoria führt die ersten fünfzehn Minuten eines jeden Kunden: Bereich gemeinsam öffnen, Fahrplan erklären, Unterlagen klären. Danach weiß der Kunde, wo er steht – und kennt seine Ansprechpartnerin mit Namen." },
    rifka: { rolle: "Onboarding", titel: "Die ersten Wochen", text: "Rifka begleitet Kunden von der Zahlung bis zur ersten Auskunft: Sie erinnert an fehlende Unterlagen, erklärt Wartezeiten ehrlich und meldet sich, bevor der Kunde fragen muss." },
    diana: { rolle: "Forderungsmanagement", titel: "Fristen, die jemand hält", text: "Diana behält jede Frist und jede Antwort im Blick: Löschanträge, Widersprüche, Ratenvereinbarungen. Wenn eine Gegenseite schweigt, ist sie diejenige, die nachfasst – freundlich, bestimmt, dokumentiert." },
    "hans-juergen": { rolle: "Forderungsmanagement", titel: "Erfahrung am Telefon mit Gläubigern", text: "Hans-Jürgen verhandelt mit Inkassounternehmen und Gläubigern auf Augenhöhe: Vergleiche, Ratenpläne, Erledigungsvermerke. Er kennt die Abläufe auf der anderen Seite – und nutzt das für unsere Kunden." },
  } as Record<string, { rolle: string; titel: string; text: string }>,
  investorTag: "Investor und Partner", investorText: "Hat in FIAON investiert und damit den Aufbau ermöglicht – Partner seit dem ersten Tag.",
  investorKompaktA: "Investor und Partner: ", investorKompaktB: ", Zürich – hat den Aufbau ermöglicht.",
  duPlatz: "Sie?", duTag: "Offene Plätze", duTitel: "Möchten Sie auch hier stehen?", duUntertitel: "Fest oder frei, remote in Deutschland, Österreich und der Schweiz",
  duText: "Ein junges Legal- und FinTech auf dem Weg zum Unicorn sucht Menschen für Vertrieb, Onboarding, Forderungsmanagement, Kundenservice, Produkt, Marketing und Recht. Bewerbung in vier Schritten.", duKnopf: "Bereiche ansehen",
};

const en: typeof de = {
  metaTitel: "Team",
  metaBeschreibung: "The team behind FIAON: Justin Schwarzott (founder), Florentine Lombardi (people & onboarding), Daniel Stripling (sales) — and Schwarzott Capital Partners AG as investor.",
  pille: "Team", h1a: "A young legal and fintech company ", h1b: "on its way to becoming a unicorn.",
  lead: "FIAON is a team in sales, onboarding and collections — and three shareholders who work in the business themselves. We are building the operating system for creditworthiness in Germany, Austria and Switzerland: insight, action, access for 100 million people. And we are looking for people to build it with us.",
  kontakt: "Get in touch", teilWerden: "Join the team",
  szeneNamen: ["Sales", "Onboarding", "Support"],
  teamPille: "The team", teamH2a: "The people you reach ", teamH2b: "on the phone.",
  teamLead: "Sales, onboarding, collections — anyone who calls FIAON speaks to one of these people. Many of them were customers themselves.",
  gesPille: "The shareholders", gesH2a: "Who is responsible ", gesH2b: "for what.",
  arbeitPille: "How we work", arbeitH2a: "One customer, ", arbeitH2b: "three pairs of hands.",
  arbeitLead: "Every customer passes through the same three stations — and at each one stands someone who knows their name.",
  arbeit: [
    { titel: "Sales", text: "Daniel's team holds the first conversation: what is in the report, which plan fits, what the first step is. No selling against the customer." },
    { titel: "Onboarding", text: "Florentine's team takes over: onboarding call, checking the payment, requesting the report, setting the roadmap. Afterwards every customer knows their contact person." },
    { titel: "Support", text: "Approving letters, accompanying instalments, keeping deadlines, preparing access. Justin reads the numbers behind it every week — and every query." },
  ],
  grundPille: "Principles", grundH2a: "What we ", grundH2b: "hold to.",
  grund: [
    { tag: "Courtesy", titel: "Respect first", text: "Customers are addressed formally, always. Anyone who calls FIAON speaks to someone who knows their file — not to a queue." },
    { tag: "Honest", titel: "No fantasy numbers", text: "The bank decides on account and card. We promise what we keep: insight within 24 hours, reviewed letters, a person on the phone." },
    { tag: "On record", titel: "Every decision an entry", text: "Register, logbook, one source for every number. Anyone who audits the company finds everything — from day one." },
    { tag: "From customers", titel: "Those who were helped, help", text: "Many in the team were customers themselves. They explain the path because they have walked it." },
  ],
  zwischenruf: "Would you like to work from home for the thing that helped you yourself? Florentine reads every application personally.", bewerben: "Apply in 60 seconds", fuerPartner: "For partners",
  kontaktPille: "Contact", kontaktH2a: "Straight to ", kontaktH2b: "us.", investor: "Investor",
  fussZeile: "FIAON LTD · 128 City Road, London EC1V 2NX · Companies House No. 17318250 · Customer matters: support@fiaon.com",
  abschlussA: "A team that knows you ", abschlussB: "by name.",
  abschlussText: "Insight, action, access — behind it are people who walk every step themselves. When you start, you meet one of them in the onboarding call.",
  jetztStarten: "Get started", fuerInvestoren: "For investors",
  personen: {
    justin: { rolle: "Founder · Managing Director · Director", kurz: "Has run FIAON since day one — product, strategy, partners. Decisions are on record in the register, every day in the logbook.", lang: "Justin founded FIAON because he saw how many people fail because of an entry that nobody explains and nobody touches. He is responsible for product, strategy, partnerships and finance — and runs the company as if it were to be audited tomorrow." },
    florentine: { rolle: "Shareholder · People & Onboarding", kurz: "Responsible for staff, training and onboarding — every new colleague and every new customer starts with her.", lang: "Florentine builds the team and holds it together: she trains new staff in the Academy, accompanies onboardings and makes sure every customer has their onboarding call with a person who knows the file." },
    daniel: { rolle: "Shareholder · Head of Sales", kurz: "Leads all of sales — from the first call to the close, including commission rules and the quality of conversations.", lang: "Daniel leads sales: quality of conversations, results, commissions, care of the existing customer base. He decides who looks after which customer and holds the line between ‘selling’ and ‘helping’ — at FIAON they are the same thing." },
  },
  mitarbeiter: {
    nikita: { rolle: "Sales", titel: "The first call", text: "Nikita is often the first voice a customer hears from FIAON. In five minutes he explains what a credit report is, what it is not — and which plan fits the person's situation, not their wish." },
    lucas: { rolle: "Sales", titel: "Plain talk instead of sales pressure", text: "Lucas holds conversations the way he would like them himself: honest, without promises, with a clear next step. Anyone who says ‘no’ to him still gets a tip on what they can do themselves." },
    angelique: { rolle: "Sales", titel: "The bridge to the file", text: "Angelique makes sure a prospect becomes a customer with complete documents — plan, payment, appointment. Nothing is left lying, and nobody has to tell the same story twice." },
    viktoria: { rolle: "Onboarding", titel: "The onboarding call", text: "Viktoria leads every customer's first fifteen minutes: open the area together, explain the roadmap, sort out documents. Afterwards the customer knows where they stand — and knows their contact person by name." },
    rifka: { rolle: "Onboarding", titel: "The first weeks", text: "Rifka accompanies customers from payment to the first report: she reminds them of missing documents, explains waiting times honestly and gets in touch before the customer has to ask." },
    diana: { rolle: "Collections", titel: "Deadlines someone keeps", text: "Diana keeps an eye on every deadline and every reply: deletion requests, objections, instalment agreements. When the other side goes quiet, she is the one who follows up — friendly, firm, documented." },
    "hans-juergen": { rolle: "Collections", titel: "Experience on the phone with creditors", text: "Hans-Jürgen negotiates with debt collectors and creditors as an equal: settlements, instalment plans, settled markers. He knows the processes on the other side — and uses that for our customers." },
  },
  investorTag: "Investor and partner", investorText: "Invested in FIAON and thereby made the build-up possible — a partner since day one.",
  investorKompaktA: "Investor and partner: ", investorKompaktB: ", Zurich — made the build-up possible.",
  duPlatz: "You?", duTag: "Open positions", duTitel: "Would you like to be here too?", duUntertitel: "Employed or freelance, remote in Germany, Austria and Switzerland",
  duText: "A young legal and fintech company on its way to becoming a unicorn is looking for people in sales, onboarding, collections, customer service, product, marketing and legal. Application in four steps.", duKnopf: "See the areas",
};

export const TEAM_WOERTER = { de, en };
