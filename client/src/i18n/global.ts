// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL: die Texte der Seite (17.09.2026, E-188)
//
// Sie-Form, ruhig, ohne Zahl im Blickfang. Was ein Paket enthält und was es
// kostet, steht NICHT hier, sondern in shared/fiaon-global.ts und im Katalog
// (shared/fiaon-pakete.ts) — die Seite liest beides.
//
// Die Grenzen der Wortwahl (Prüfung vom 17.09.2026, Register E-187/E-188):
// kein Ergebnis zusagen, das ein Institut entscheidet; kein Bankname; keine
// Frist mit Ziffer; „Steuerberater im Partnernetz" statt eigener Steuerhilfe;
// Dauer nur als Erfahrungswert. Jeder deutsche Satz passiert die Wortwand
// (scripts/pruef-wortwand-de.ts), jeder englische scripts/seo-wortverbote-en.ts.
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  metaTitel: "US-Gesellschaft aus einer Hand — FIAON Global",
  metaBeschreibung: "US-Gesellschaft mit Team vor Ort: Gründung, Steuernummern, Dokumente, Bank- und Kartenaufbau aus einer Hand. Vier Pakete, ein Ansprechpartner.",

  pille: "FIAON Global · US-Struktur aus einer Hand",
  h1a: "Ihre Gesellschaft in den USA. ",
  h1b: "Aufgebaut von Menschen vor Ort.",
  lead: "FIAON gründet Ihre US-Gesellschaft, besorgt Steuernummern und Dokumente und baut Schritt für Schritt Ihre Bank- und Kartenbeziehung in den USA auf — die Grundlage für Kapital am größten Finanzmarkt der Welt. Mit einem Team vor Ort und einem Ansprechpartner für Sie.",
  knopfPakete: "Pakete ansehen",
  knopfGespraech: "Gespräch vereinbaren",
  fakten: ["Team vor Ort in den USA", "Steuerberater und Anwälte im Partnernetz", "Ein Ansprechpartner", "Vertrag, Rechnung, Start"],

  handPille: "Aus einer Hand",
  handH2: "Ein Ansprechpartner. Ein Team vor Ort. Ein Partnernetz.",
  handLead: "Hinter jeder US-Struktur stehen viele Beteiligte: Gründungsagenten, Steuerberater, Anwälte, Banken, Adress- und Telefonanbieter. Bei FIAON koordiniert ein Ansprechpartner alle — Sie führen ein Gespräch, nicht zwölf.",
  hand: [
    { tag: "Team vor Ort", titel: "Menschen, wo Behörden und Banken sitzen", text: "Unsere Gründungsagenten in den USA nehmen Termine wahr, reichen Unterlagen ein und holen Dokumente ab — dort, wo es zählt." },
    { tag: "Steuer und Recht", titel: "Partner mit eigenem Mandat", text: "Steuerberater und Anwälte im Partnernetz übernehmen alles, was ein Mandat verlangt — in den USA wie in Ihrem Wohnsitzland. Sie beauftragen sie direkt; FIAON stimmt die Schritte ab." },
    { tag: "Banken und Herausgeber", titel: "Vorbereitet in der richtigen Reihenfolge", text: "Kontakte zu US-Banken und Kartenherausgebern, vollständige Unterlagen, eine saubere Reihenfolge. Anträge stellen Sie selbst; über Konto und Rahmen entscheidet das Institut." },
    { tag: "Infrastruktur", titel: "Alles, was eine Gesellschaft braucht", text: "US-Geschäftsadresse, US-Telefonnummer, Registered Agent und ein Dokumentenraum — damit Ihre Gesellschaft erreichbar und prüfbar ist." },
  ],

  wegPille: "Der Weg",
  wegH2: "Vier Etappen. Eine Reihenfolge, die sich bewährt hat.",
  wegLead: "Der Aufbau folgt einer festen Reihenfolge, weil jede Etappe die nächste erst möglich macht. Wie lange eine Etappe dauert, bestimmen Behörden und Institute — wir nennen Ihnen deshalb Erfahrungswerte, keine Fristen.",
  weg: [
    { titel: "Gründung und Dokumente", text: "Gesellschaft, EIN, ITIN, Registered Agent, US-Adresse und Telefonnummer, Operating Agreement. Unser Team vor Ort reicht ein und holt ab. Die Gesellschaft steht in der Regel nach wenigen Wochen; die ITIN vergibt die US-Steuerbehörde in eigener Frist." },
    { titel: "Die erste Firmenkarte", text: "Mit vollständigen Dokumenten stellen Sie den ersten Antrag bei einem US-Herausgeber — meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers. Wir bereiten den Antrag vor; der Herausgeber entscheidet." },
    { titel: "Die Kartenleiter", text: "Pünktliche Abrechnung über einige Monate öffnet weitere Herausgeber. Viele bieten neuen Firmenkunden einen Einführungszeitraum ohne Sollzins — ob und zu welchen Bedingungen, legt jeder Herausgeber selbst fest. FIAON plant die Reihenfolge und begleitet jeden Antrag." },
    { titel: "Das Bankdarlehen", text: "Mit gewachsener Historie kann ein Darlehen bei einer US-Bank in Frage kommen. FIAON bereitet Unterlagen und Kennzahlen auf; den Antrag stellen Sie bei der Bank, die ihn nach ihren Regeln prüft." },
  ],
  wegErfahrung: "Wir sind diesen Weg selbst gegangen — mit eigener US-Gesellschaft, eigenen Karten, eigenen Fehlern. Davon profitieren Sie.",

  fuerPille: "Für wen",
  fuerH2: "Für Unternehmen jeder Art — nicht für eine Branche.",
  fuerLead: "Die US-Struktur ist kein Modell für eine Nische. Sie passt zu Betrieben, die in den USA Kunden, Lieferanten, Projekte oder Kapitalbedarf haben — und zu Inhabern, die ein zweites Standbein mit eigener Bank- und Kartenhistorie aufbauen wollen.",
  fuer: [
    { tag: "Handwerk und Bau", text: "Betriebe mit Aufträgen, Material oder Partnern in den USA." },
    { tag: "Handel und Online-Handel", text: "Wareneinkauf, Lager und Zahlungsverkehr in US-Dollar." },
    { tag: "Dienstleistung und Agenturen", text: "Kunden, Werbekonten und Abrechnung in den USA." },
    { tag: "Produktion und Industrie", text: "Vertriebsgesellschaft, Ersatzteile, Service vor Ort." },
    { tag: "Projektentwicklung und Immobilien", text: "Objektgesellschaften, Partner und Finanzierung in den USA." },
    { tag: "Gründer und Holdings", text: "Die US-Gesellschaft als zweites Standbein mit eigener Historie." },
  ],
  fuerAusstieg: "Im ersten Gespräch prüfen wir gemeinsam, ob die Struktur zu Ihrem Vorhaben passt — und sagen es Ihnen auch, wenn nicht.",

  paketePille: "Pakete",
  paketeH2: "Vier Pakete. Ein Preis, einmalig.",
  paketeLead: "Jedes Paket ist ein Betreuungsauftrag. Die Planungsgröße ist der Rahmen, den Sie anstreben — danach richten sich Dauer und Tiefe unserer Begleitung. Über jeden Rahmen entscheiden die Institute.",
  einmalig: "einmalig",
  planung: "Planungsgröße",
  planungZusatz: "Ihr Ziel — über den Rahmen entscheidet das Institut",
  beauftragen: "Direkt beauftragen",
  erstSprechen: "Erst sprechen",
  kostenHinweis: "Alle Preise zuzüglich Umsatzsteuer, soweit sie anfällt.",
  wissenTitel: "Was Sie vor dem Auftrag wissen müssen",

  vertrauenPille: "Klare Rollen",
  vertrauenH2: "Was wir tun. Was Partner tun. Was laufend anfällt.",
  vertrauen: [
    { titel: "Was FIAON tut", key: "fiaon" as const },
    { titel: "Was Partner tun", key: "partner" as const },
    { titel: "Was laufend anfällt", key: "kosten" as const },
  ],
  ablaufTitel: "So läuft es ab",
  ablauf: ["Gespräch oder Direktauftrag", "Vertrag und Rechnung", "Zahlungseingang", "Startgespräch und Unterlagen", "Prüfung durch den Steuerberater", "Gründung", "Karten", "Bank"],
  traeger: "Vertragspartner ist die FIAON LTD. Leistungen von Steuerberatern, Anwälten und Instituten sind nicht Teil des FIAON-Vertrags.",

  teamPille: "Die Menschen",
  teamH2: "Menschen, die Sie erreichen.",
  teamLead: "Drei Gesellschafter tragen die Verantwortung, ein Team in den USA nimmt die Termine wahr. Wer Ihr Ansprechpartner ist, wissen Sie ab dem ersten Tag.",
  teamKnopf: "Das ganze Team kennenlernen",

  gespraechPille: "Gespräch",
  gespraechH2: "Erst sprechen, dann entscheiden.",
  gespraechLead: "Dreißig Minuten mit Ihrem Ansprechpartner: Vorhaben, Wohnsitz, Ziel — und welches Paket dazu passt. Ohne Verpflichtung.",

  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Entscheidet FIAON über Karten und Rahmen?", a: "Nein. Über Konto, Karte und Rahmen entscheidet das jeweilige Institut nach eigenen Regeln. FIAON baut die Struktur auf, bereitet Anträge vor und plant die Reihenfolge." },
    { f: "Muss ich in die USA reisen?", a: "In der Regel nicht. Unser Team vor Ort nimmt Termine wahr. Wer den Aufbau persönlich erleben möchte, wählt Global VIP." },
    { f: "Was ist mit Steuern?", a: "Die US-Gesellschaft ersetzt keine Steuerpflicht zu Hause: Wer sie aus Deutschland, Österreich oder der Schweiz führt, versteuert dort. Steuerberater im Partnernetz prüfen Ihre Lage vor der Gründung und begleiten die jährlichen Meldungen in den USA — auf eigenes Mandat." },
    { f: "Wie lange dauert es?", a: "Gründung und Dokumente in der Regel wenige Wochen, die ITIN in der Frist der US-Steuerbehörde, die erste Firmenkarte danach, weitere Herausgeber über mehrere Monate. Feste Fristen nennen wir nicht — Behörden und Institute bestimmen das Tempo." },
    { f: "Warum ein Einmalpreis?", a: "Weil der Aufbau ein abgeschlossener Auftrag mit klarem Ziel ist. Laufende Kosten — Staatsgebühren, Registered Agent, jährliche Meldungen — fallen bei jeder US-Gesellschaft an und werden getrennt ausgewiesen." },
    { f: "Kann ich sofort beauftragen?", a: "Ja. Sie wählen ein Paket, tragen Ihr Unternehmen ein, unterschreiben den Vertrag am Bildschirm und erhalten Vertrag und Rechnung per E-Mail. Mit dem Zahlungseingang beginnt Ihr Ansprechpartner." },
    { f: "Für wen passt es nicht?", a: "Für Vorhaben ohne Bezug zu den USA und ohne Bereitschaft, eine echte Gesellschaft mit Pflichten zu führen. Das klären wir im ersten Gespräch — offen, auch wenn die Antwort ein Nein ist." },
    { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD. Steuerberater, Anwälte und Institute beauftragen Sie direkt." },
  ],

  abschlussA: "Eine Struktur, die Ihnen gehört — ",
  abschlussB: "aufgebaut von Menschen, die Sie kennen.",
  abschlussText: "Wählen Sie ein Paket oder vereinbaren Sie ein Gespräch. Sie erhalten eine Antwort von einem Menschen, nicht von einem Automaten.",
};

const en: typeof de = {
  metaTitel: "Your US company, handled end to end — FIAON Global",
  metaBeschreibung: "A US company with a team on the ground: formation, tax numbers, documents, banking and card build-up from one source. Four packages, one contact.",

  pille: "FIAON Global · US structure from one source",
  h1a: "Your company in the United States. ",
  h1b: "Built by people on the ground.",
  lead: "FIAON forms your US company, obtains tax numbers and documents and builds your banking and card relationship in the United States step by step — the basis for capital in the world's largest financial market. With a team on the ground and one contact for you.",
  knopfPakete: "View packages",
  knopfGespraech: "Arrange a call",
  fakten: ["Team on the ground in the US", "Tax advisers and lawyers in our partner network", "One contact", "Contract, invoice, start"],

  handPille: "One source",
  handH2: "One contact. One team on the ground. One partner network.",
  handLead: "Every US structure involves many parties: formation agents, tax advisers, lawyers, banks, address and phone providers. At FIAON one contact coordinates them all — you have one conversation, not twelve.",
  hand: [
    { tag: "Team on the ground", titel: "People where authorities and banks are", text: "Our formation agents in the US attend appointments, file documents and collect paperwork — where it matters." },
    { tag: "Tax and law", titel: "Partners under their own engagement", text: "Tax advisers and lawyers in our partner network handle everything that requires an engagement — in the US and in your country of residence. You instruct them directly; FIAON aligns the steps." },
    { tag: "Banks and issuers", titel: "Prepared in the right order", text: "Contacts at US banks and card issuers, complete documents, a clean sequence. You submit the applications yourself; the institution decides on account and limit." },
    { tag: "Infrastructure", titel: "Everything a company needs", text: "US business address, US phone number, registered agent and a document room — so your company can be reached and verified." },
  ],

  wegPille: "The path",
  wegH2: "Four stages. A sequence that has proven itself.",
  wegLead: "The build-up follows a fixed order because each stage makes the next one possible. How long a stage takes is set by authorities and institutions — so we give you typical experience, not deadlines.",
  weg: [
    { titel: "Formation and documents", text: "Company, EIN, ITIN, registered agent, US address and phone number, operating agreement. Our team on the ground files and collects. The company is typically in place after a few weeks; the ITIN is issued by the US tax authority on its own timeline." },
    { titel: "The first business card", text: "With complete documents you submit the first application to a US issuer — usually with a small limit and no cash deposit, but with a personal guarantee from the owner. We prepare the application; the issuer decides." },
    { titel: "The card ladder", text: "Paying on time for several months opens further issuers. Many offer new business customers an introductory period without interest — whether and on what terms is set by each issuer. FIAON plans the sequence and supports every application." },
    { titel: "The bank loan", text: "With an established history, a loan from a US bank may become an option. FIAON prepares documents and key figures; you apply to the bank, which assesses the application under its own rules." },
  ],
  wegErfahrung: "We have walked this path ourselves — with our own US company, our own cards, our own mistakes. You benefit from that.",

  fuerPille: "Who it is for",
  fuerH2: "For companies of every kind — not for one sector.",
  fuerLead: "The US structure is not a niche model. It suits businesses with customers, suppliers, projects or capital needs in the United States — and owners who want to build a second pillar with its own banking and card history.",
  fuer: [
    { tag: "Trades and construction", text: "Businesses with contracts, materials or partners in the US." },
    { tag: "Retail and e-commerce", text: "Purchasing, warehousing and payments in US dollars." },
    { tag: "Services and agencies", text: "Clients, advertising accounts and billing in the US." },
    { tag: "Manufacturing and industry", text: "Sales company, spare parts, service on site." },
    { tag: "Project development and property", text: "Project companies, partners and financing in the US." },
    { tag: "Founders and holdings", text: "The US company as a second pillar with its own history." },
  ],
  fuerAusstieg: "In the first call we check together whether the structure fits your plans — and we tell you if it does not.",

  paketePille: "Packages",
  paketeH2: "Four packages. One price, one-off.",
  paketeLead: "Each package is a support engagement. The planning figure is the limit you are aiming for — it determines how long and how closely we work with you. Every limit is decided by the institutions.",
  einmalig: "one-off",
  planung: "Planning figure",
  planungZusatz: "Your target — the institution decides on the limit",
  beauftragen: "Order now",
  erstSprechen: "Talk first",
  kostenHinweis: "All prices plus VAT where applicable.",
  wissenTitel: "What you need to know before ordering",

  vertrauenPille: "Clear roles",
  vertrauenH2: "What we do. What partners do. What recurs.",
  vertrauen: [
    { titel: "What FIAON does", key: "fiaon" as const },
    { titel: "What partners do", key: "partner" as const },
    { titel: "What recurs", key: "kosten" as const },
  ],
  ablaufTitel: "How it works",
  ablauf: ["Call or direct order", "Contract and invoice", "Payment received", "Kick-off call and documents", "Review by the tax adviser", "Formation", "Cards", "Bank"],
  traeger: "Your contracting party is FIAON LTD. Services by tax advisers, lawyers and institutions are not part of the FIAON contract.",

  teamPille: "The people",
  teamH2: "People you can reach.",
  teamLead: "Three partners carry the responsibility, a team in the US attends the appointments. You know who your contact is from day one.",
  teamKnopf: "Meet the whole team",

  gespraechPille: "Call",
  gespraechH2: "Talk first, then decide.",
  gespraechLead: "Thirty minutes with your contact: your plans, your residence, your goal — and which package fits. No obligation.",

  fragenPille: "Frequently asked questions",
  fragen: [
    { f: "Does FIAON decide on cards and limits?", a: "No. The institution concerned decides on account, card and limit under its own rules. FIAON builds the structure, prepares applications and plans the sequence." },
    { f: "Do I have to travel to the US?", a: "Usually not. Our team on the ground attends the appointments. If you want to experience the build-up in person, choose Global VIP." },
    { f: "What about taxes?", a: "The US company does not replace tax liability at home: if you manage it from Germany, Austria or Switzerland, you pay tax there. Tax advisers in our partner network review your position before formation and handle the annual US filings — under their own engagement." },
    { f: "How long does it take?", a: "Formation and documents typically a few weeks, the ITIN on the US tax authority's timeline, the first business card after that, further issuers over several months. We do not quote fixed deadlines — authorities and institutions set the pace." },
    { f: "Why a one-off price?", a: "Because the build-up is a defined engagement with a clear goal. Running costs — state fees, registered agent, annual filings — arise with every US company and are itemised separately." },
    { f: "Can I order straight away?", a: "Yes. You choose a package, enter your company, sign the contract on screen and receive contract and invoice by email. Your contact starts once payment has been received." },
    { f: "Who is it not for?", a: "For plans with no connection to the US and no willingness to run a real company with duties. We clarify that in the first call — openly, even if the answer is no." },
    { f: "Who is my contracting party?", a: "FIAON LTD. You instruct tax advisers, lawyers and institutions directly." },
  ],

  abschlussA: "A structure that belongs to you — ",
  abschlussB: "built by people you know.",
  abschlussText: "Choose a package or arrange a call. You will hear back from a person, not a machine.",
};

export const GLOBAL_WOERTER = { de, en };

// ── Das Gespräch (Kalender auf /business#gespraech) ────────────────────────
const gespraechDe = {
  punkte: [
    "Ihr Vorhaben, Ihr Wohnsitz, Ihr Ziel — in dreißig Minuten geordnet.",
    "Welche Gesellschaftsform und welches Paket zu Ihrer Lage passen.",
    "Was es kostet, was laufend anfällt und was wir nicht zusagen können.",
  ],
  laedt: "Freie Zeiten werden geladen …",
  tagWaehlen: "Tag wählen",
  zeitWaehlen: "Uhrzeit wählen",
  zeitzone: "Alle Zeiten in deutscher Zeit (Berlin).",
  gewaehlt: (tag: string, zeit: string) => `Ihr Gespräch: ${tag}, ${zeit} Uhr`,
  name: "Ihr Name",
  firma: "Unternehmen",
  email: "E-Mail",
  telefon: "Telefon (mit Ländervorwahl)",
  thema: "Worum geht es? (optional)",
  wunschzeit: "Wann erreichen wir Sie am besten?",
  buchen: "Gespräch verbindlich vereinbaren",
  anfragen: "Rückruf anfragen",
  sendet: "Wird gesendet …",
  rueckfallTitel: "Wir rufen Sie zurück",
  rueckfallText: "Im Moment sind online keine freien Zeiten hinterlegt. Hinterlassen Sie Ihre Angaben — Ihr Ansprechpartner meldet sich und stimmt einen Termin mit Ihnen ab.",
  lieberRueckruf: "Keine passende Zeit dabei? Rückruf anfragen",
  zurueckKalender: "Zurück zu den freien Zeiten",
  vergeben: "Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.",
  fehler: "Das hat nicht geklappt. Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.",
  pflicht: "Bitte füllen Sie Name, Unternehmen, E-Mail und Telefon aus.",
  fertigTitel: "Ihr Gespräch steht.",
  fertigText: (wann: string, wer: string) => `${wann} Uhr${wer ? " mit " + wer : ""}. Die Bestätigung ist unterwegs an Ihre E-Mail-Adresse — mit allem, was Sie für das Gespräch brauchen.`,
  anfrageTitel: "Ihre Anfrage ist angekommen.",
  anfrageText: "Ihr Ansprechpartner meldet sich bei Ihnen und stimmt einen Termin ab.",
  paketGewaehlt: (name: string) => `Paketwunsch: ${name}`,
  datenschutz: "Ihre Angaben verwenden wir nur für dieses Gespräch. Einzelheiten stehen in der Datenschutzerklärung.",
};

const gespraechEn: typeof gespraechDe = {
  punkte: [
    "Your plans, your residence, your goal — put in order in thirty minutes.",
    "Which company form and which package suit your situation.",
    "What it costs, what recurs and what we cannot commit to.",
  ],
  laedt: "Loading available times …",
  tagWaehlen: "Choose a day",
  zeitWaehlen: "Choose a time",
  zeitzone: "All times are German time (Berlin).",
  gewaehlt: (tag: string, zeit: string) => `Your call: ${tag}, ${zeit}`,
  name: "Your name",
  firma: "Company",
  email: "Email",
  telefon: "Phone (with country code)",
  thema: "What is it about? (optional)",
  wunschzeit: "When is the best time to reach you?",
  buchen: "Confirm the call",
  anfragen: "Request a call back",
  sendet: "Sending …",
  rueckfallTitel: "We will call you back",
  rueckfallText: "There are currently no available times online. Leave your details — your contact will get in touch and agree a time with you.",
  lieberRueckruf: "No suitable time? Request a call back",
  zurueckKalender: "Back to the available times",
  vergeben: "This time has just been taken. Please choose another one.",
  fehler: "That did not work. Please check your details and try again.",
  pflicht: "Please fill in name, company, email and phone.",
  fertigTitel: "Your call is booked.",
  fertigText: (wann: string, wer: string) => `${wann}${wer ? " with " + wer : ""}. The confirmation is on its way to your email address — with everything you need for the call.`,
  anfrageTitel: "Your request has arrived.",
  anfrageText: "Your contact will get in touch and agree a time with you.",
  paketGewaehlt: (name: string) => `Package of interest: ${name}`,
  datenschutz: "We use your details only for this call. Details are in the privacy policy.",
};

export const GLOBAL_GESPRAECH_WOERTER = { de: gespraechDe, en: gespraechEn };
