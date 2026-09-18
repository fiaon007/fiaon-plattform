// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL: die Texte der Seite (17.09.2026, E-188)
//
// Sie-Form, ruhig, ohne Zahl im Blickfang. Was ein Paket enthält und was es
// kostet, steht NICHT hier, sondern in shared/fiaon-global.ts und im Katalog
// (shared/fiaon-pakete.ts) — die Seite liest beides.
//
// 18.09.2026 — Justin: „In den Paketen sind ALLE Gebühren enthalten … wir
// kümmern uns um alles", „mehr Informationen, mehr Conversion, seriöser —
// eine Mischung aus Anwalt, Bank und Unternehmensberatung." Die Seite spricht
// deshalb vom Festpreis mit allen Gebühren, vom Mandat, vom Vertragspartner.
//
// Die Grenzen der Wortwahl (Register E-187/E-188): kein Ergebnis zusagen, das
// ein Institut entscheidet; kein Bankname; keine Frist mit Ziffer;
// Steuerberater und Anwälte arbeiten auf das Mandat des Kunden (die Honorare
// trägt FIAON); Dauer nur als Erfahrungswert. Jeder deutsche Satz passiert
// scripts/pruef-wortwand-de.ts, jeder englische scripts/seo-wortverbote-en.ts.
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  metaTitel: "US-Gesellschaft aus einer Hand — FIAON Global",
  metaBeschreibung: "US-Gesellschaft mit Team vor Ort: Gründung, Steuernummern, Bank- und Kartenaufbau aus einer Hand. Festpreis, alle Gebühren inklusive.",

  auge: "FIAON Global · US-Struktur für Unternehmen",
  h1a: "Ihre US-Gesellschaft.",
  h1b: "Aus einer Hand, zum Festpreis.",
  lead: "Gründung, Steuernummern, Bankkonto und Firmenkarten in den USA: Unser Team vor Ort, unsere Partner-Anwälte und Partner-Steuerberater übernehmen alles. Sie haben einen Ansprechpartner, einen Vertrag und einen Festpreis — alle Gebühren inklusive.",
  knopfPakete: "Pakete vergleichen",
  knopfGespraech: "Gespräch vereinbaren",
  vertrauen: ["Festpreis, alle Gebühren inklusive", "Vertrag in Textform", "Geld zurück, wenn wir nicht liefern", "Team vor Ort in den USA"],

  mandatTitel: "Ihr Mandat",
  mandatMarke: "FIAON Global",
  mandat: [
    ["Gesellschaft", "US-LLC oder Corporation, gegründet von unserem Team vor Ort"],
    ["Steuernummern", "EIN und ITIN, beantragt und eingereicht"],
    ["Bank und Karten", "Konto- und Kartenanträge, vollständig vorbereitet"],
    ["Partner", "Anwalt, Steuerberater und US-CPA — Honorare inklusive"],
    ["Betreuung", "Ein fester Ansprechpartner ab dem ersten Tag"],
    ["Preis", "Festpreis, einmalig, alle Gebühren inklusive"],
  ] as [string, string][],
  mandatPartner: "Vertragspartner",

  vsAuge: "Eine Anlaufstelle",
  vsH2: "Acht Anlaufstellen — oder ein Vertrag.",
  vsLead: "Wer eine US-Gesellschaft selbst aufbaut, verhandelt mit Gründungsdienst, Registered Agent, US-Steuerbehörde, Anwalt, Steuerberater, US-CPA, Banken und Kartenherausgebern — jeder mit eigenem Vertrag und eigener Rechnung. Bei FIAON Global koordiniert ein Ansprechpartner alle.",
  ohneTitel: "Ohne FIAON Global",
  ohne: [
    "Gründungsdienst für die Gesellschaft",
    "Registered Agent und US-Adresse",
    "US-Steuerbehörde für EIN und ITIN",
    "Anwalt für den Gesellschaftsvertrag",
    "Steuerberater im Wohnsitzland",
    "US-CPA für die jährliche Meldung",
    "Banken für das Geschäftskonto",
    "Kartenherausgeber für jede Firmenkarte",
  ],
  mitTitel: "Mit FIAON Global",
  mit: [
    "Ein Vertrag, am Bildschirm unterschrieben",
    "Ein Ansprechpartner für alle Schritte",
    "Ein Festpreis — alle Gebühren und Honorare inklusive",
    "Ein Team, das vor Ort Termine wahrnimmt",
  ],

  handAuge: "Aus einer Hand",
  handH2: "Ein Ansprechpartner. Ein Team vor Ort. Ein Partnernetz.",
  handLead: "Hinter jeder US-Struktur stehen viele Beteiligte. Bei FIAON Global arbeiten sie für Sie zusammen — koordiniert von einem Ansprechpartner, bezahlt aus Ihrem Festpreis.",
  hand: [
    { tag: "Team vor Ort", titel: "Menschen, wo Behörden und Banken sitzen", text: "Unsere Gründungsagenten in den USA nehmen Termine wahr, reichen Unterlagen ein und holen Dokumente ab — dort, wo es zählt." },
    { tag: "Steuer und Recht", titel: "Partner auf Ihr Mandat", text: "Steuerberater, US-CPA und Anwälte im Partnernetz übernehmen alles, was ein Mandat verlangt — in den USA wie in Ihrem Wohnsitzland. Sie arbeiten für Sie, die Honorare trägt FIAON." },
    { tag: "Banken und Herausgeber", titel: "Vorbereitet in der richtigen Reihenfolge", text: "Kontakte zu US-Banken und Kartenherausgebern, vollständige Unterlagen, eine saubere Reihenfolge. Über Konto und Rahmen entscheidet das Institut." },
    { tag: "Infrastruktur", titel: "Alles, was eine Gesellschaft braucht", text: "US-Geschäftsadresse, US-Telefonnummer, Registered Agent und ein Dokumentenraum — damit Ihre Gesellschaft erreichbar und prüfbar ist." },
  ],

  wegAuge: "Der Weg",
  wegH2: "Vier Etappen. Eine Reihenfolge, die sich bewährt hat.",
  wegLead: "Jede Etappe macht die nächste erst möglich. Wie lange eine Etappe dauert, bestimmen Behörden und Institute — wir nennen Ihnen deshalb Erfahrungswerte, keine Fristen.",
  weg: [
    { titel: "Gründung und Dokumente", dauer: "in der Regel wenige Wochen", text: "Gesellschaft, EIN, ITIN, Registered Agent, US-Adresse und Telefonnummer, Operating Agreement. Unser Team vor Ort reicht ein und holt ab; die ITIN vergibt die US-Steuerbehörde in eigener Frist." },
    { titel: "Die erste Firmenkarte", dauer: "nach vollständigen Dokumenten", text: "Sie stellen den ersten Antrag bei einem US-Herausgeber — meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers. Wir bereiten den Antrag vor; der Herausgeber entscheidet." },
    { titel: "Die Kartenleiter", dauer: "über einige Monate", text: "Pünktliche Abrechnung öffnet weitere Herausgeber. Viele bieten neuen Firmenkunden einen Einführungszeitraum ohne Sollzins — ob und zu welchen Bedingungen, legt jeder Herausgeber selbst fest." },
    { titel: "Das Bankdarlehen", dauer: "mit gewachsener Historie", text: "Mit gewachsener Historie kann ein Darlehen bei einer US-Bank in Frage kommen. Wir bereiten Unterlagen und Kennzahlen auf; den Antrag stellen Sie bei der Bank, die ihn nach ihren Regeln prüft." },
  ],
  wegErfahrung: "Wir sind diesen Weg selbst gegangen — mit eigener US-Gesellschaft, eigenen Karten, eigenen Fehlern. Davon profitieren Sie.",

  fuerAuge: "Für wen",
  fuerH2: "Für Unternehmen jeder Art — nicht für eine Branche.",
  fuerLead: "Die US-Struktur passt zu Betrieben, die in den USA Kunden, Lieferanten, Projekte oder Kapitalbedarf haben — und zu Inhabern, die ein zweites Standbein mit eigener Bank- und Kartenhistorie aufbauen wollen.",
  fuer: [
    { tag: "Handwerk und Bau", text: "Betriebe mit Aufträgen, Material oder Partnern in den USA." },
    { tag: "Handel und Online-Handel", text: "Wareneinkauf, Lager und Zahlungsverkehr in US-Dollar." },
    { tag: "Dienstleistung und Agenturen", text: "Kunden, Werbekonten und Abrechnung in den USA." },
    { tag: "Produktion und Industrie", text: "Vertriebsgesellschaft, Ersatzteile, Service vor Ort." },
    { tag: "Projektentwicklung und Immobilien", text: "Objektgesellschaften, Partner und Finanzierung in den USA." },
    { tag: "Gründer und Holdings", text: "Die US-Gesellschaft als zweites Standbein mit eigener Historie." },
  ],
  fuerAusstieg: "Im ersten Gespräch prüfen wir gemeinsam, ob die Struktur zu Ihrem Vorhaben passt — und sagen es Ihnen auch, wenn nicht.",

  paketeAuge: "Pakete",
  paketeH2: "Vier Pakete. Ein Festpreis, alles inklusive.",
  paketeLead: "Jedes Paket ist ein Betreuungsauftrag zum Festpreis — alle Gebühren und die Honorare unserer Partner inklusive. Der Kapitalrahmen ist das Ziel, das Sie anstreben; danach richten sich Dauer und Tiefe unserer Begleitung. Über jeden Rahmen entscheiden die Institute.",
  festpreis: "Festpreis · einmalig",
  inklusive: "Alle Gebühren inklusive",
  planung: "Kapitalrahmen",
  planungZusatz: "Ihr Ziel — über den Rahmen entscheidet das Institut",
  kapitalKopf: "Kapitalrahmen je nach Paket",
  kapitalKopfZusatz: "Ihr Ziel — über jeden Rahmen entscheidet das jeweilige Institut.",
  begleitung: "Begleitung",
  beauftragen: (name: string) => `${name} beauftragen`,
  beauftragenKurz: "Jetzt beauftragen",
  wischen: "Tabelle seitlich verschieben, um alle vier Pakete zu sehen.",
  erstSprechen: "Erst sprechen",
  kostenHinweis: "Alle Preise zuzüglich Umsatzsteuer, soweit sie anfällt.",

  inklAuge: "Alles inklusive",
  inklTitel: "Sie zahlen einen Preis. Wir bezahlen alle, die für Ihre Gesellschaft arbeiten.",
  inklLead: "Im Festpreis jedes Pakets enthalten:",
  wissenTitel: "Was Sie vor dem Auftrag wissen müssen",

  vergleichAuge: "Im Detail",
  vergleichH2: "Alle Leistungen im Vergleich.",
  vergleichLead: "Was jedes Paket enthält — Zeile für Zeile. Dieselben Leistungen stehen in Ihrem Vertrag.",
  leistung: "Leistung",
  zeileFestpreis: "Festpreis, einmalig",
  zeilePlanung: "Kapitalrahmen",
  zeileDauer: "Begleitung (Erfahrungswert)",
  ja: "enthalten",
  nein: "nicht enthalten",

  unterlagenAuge: "Für den Start",
  unterlagenH2: "Was wir von Ihnen brauchen.",
  unterlagenLead: "Fünf Unterlagen — alles Weitere besorgt unser Team. Sie laden sie nach dem Start in Ihren Dokumentenraum.",

  sicherAuge: "Klare Verhältnisse",
  sicherH2: "Wer was tut — und mit wem Sie den Vertrag schließen.",
  rollenTitel: { fiaon: "Was FIAON tut", partner: "Was Partner tun", kosten: "Was der Festpreis abdeckt" },
  vertragspartnerTitel: "Ihr Vertragspartner",
  vertragspartnerText: "Der Auftrag kommt mit der FIAON LTD zustande. Vertrag und Rechnung erhalten Sie direkt nach der Unterschrift in Textform.",
  ablaufTitel: "So läuft es ab",
  ablauf: ["Gespräch oder Direktauftrag", "Vertrag und Rechnung", "Zahlungseingang", "Startgespräch und Unterlagen", "Prüfung durch den Steuerberater", "Gründung", "Karten", "Bank"],

  gespraechAuge: "Gespräch",
  gespraechH2: "Erst sprechen, dann entscheiden.",
  gespraechLead: "Dreißig Minuten mit Ihrem Ansprechpartner: Vorhaben, Wohnsitz, Ziel — und welches Paket dazu passt. Ohne Verpflichtung.",

  fragenAuge: "Häufige Fragen",
  fragenH2: "Was Unternehmer vor dem Auftrag fragen.",
  fragen: [
    { f: "Was ist im Festpreis enthalten?", a: "Alle Gebühren und Honorare für die Leistungen Ihres Pakets: staatliche Gründungsgebühren, Registered Agent, US-Adresse und Telefon im ersten Jahr, die Anträge für EIN und ITIN, die Honorare unseres Partner-Anwalts, unseres Partner-Steuerberaters und unseres US-CPA sowie die Arbeit unseres Teams vor Ort. Sie zahlen einen Preis — wir bezahlen alle, die für Ihre Gesellschaft arbeiten." },
    { f: "Was kostet die Gesellschaft ab dem zweiten Jahr?", a: "Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Die Höhe hängt vom Bundesstaat ab; wir nennen sie Ihnen rechtzeitig vorab." },
    { f: "Entscheidet FIAON über Karten und Rahmen?", a: "Nein. Über Konto, Karte und Rahmen entscheidet das jeweilige Institut nach eigenen Regeln. FIAON baut die Struktur auf, bereitet Anträge vor und plant die Reihenfolge." },
    { f: "Muss ich in die USA reisen?", a: "In der Regel nicht. Unser Team vor Ort nimmt die Termine wahr. Wer den Aufbau persönlich erleben möchte, wählt Global VIP — Flug und Hotel für den Auftakt in Miami sind dort im Festpreis enthalten." },
    { f: "Was ist mit Steuern?", a: "Die US-Gesellschaft ersetzt keine Steuerpflicht zu Hause: Wer sie aus Deutschland, Österreich oder der Schweiz führt, versteuert dort. Unser Partner-Steuerberater prüft Ihre Lage vor der Gründung, unser US-CPA übernimmt die erste jährliche US-Meldung — beide auf Ihr Mandat, die Honorare trägt FIAON." },
    { f: "Wie lange dauert es?", a: "Gründung und Dokumente in der Regel wenige Wochen, die ITIN in der Frist der US-Steuerbehörde, die erste Firmenkarte danach, weitere Herausgeber über mehrere Monate. Feste Fristen nennen wir nicht — Behörden und Institute bestimmen das Tempo." },
    { f: "Kann ich sofort beauftragen?", a: "Ja. Sie wählen ein Paket, tragen Ihr Unternehmen ein, unterschreiben den Vertrag am Bildschirm und erhalten Vertrag und Rechnung per E-Mail. Mit dem Zahlungseingang beginnt Ihr Ansprechpartner." },
    { f: "Wie bezahle ich?", a: "Per Überweisung auf das Geschäftskonto der FIAON LTD — Bankverbindung und Verwendungszweck stehen auf Ihrer Rechnung. Es gibt kein Abo und keine Raten." },
    { f: "Für wen passt es nicht?", a: "Für Vorhaben ohne Bezug zu den USA und ohne Bereitschaft, eine echte Gesellschaft mit Pflichten zu führen. Das klären wir im ersten Gespräch — offen, auch wenn die Antwort ein Nein ist." },
    { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD, eingetragen im Companies House (England and Wales) unter der Nummer 17318250. Steuerberater, US-CPA und Anwälte arbeiten auf Ihr Mandat; ihre Honorare trägt FIAON." },
  ],

  schlussA: "Eine Struktur, die Ihnen gehört — ",
  schlussB: "aufgebaut von Menschen, die Sie kennen.",
  schlussText: "Wählen Sie ein Paket oder vereinbaren Sie ein Gespräch. Sie erhalten eine Antwort von einem Menschen, nicht von einem Automaten.",
};

const en: typeof de = {
  metaTitel: "Your US company, handled end to end — FIAON Global",
  metaBeschreibung: "A US company with a team on the ground: formation, tax numbers, banking and card build-up from one source. Fixed price, all fees included.",

  auge: "FIAON Global · US structure for companies",
  h1a: "Your US company.",
  h1b: "From one source, at a fixed price.",
  lead: "Formation, tax numbers, bank account and business cards in the United States: our team on the ground, our partner lawyers and partner tax advisers handle everything. You have one contact, one contract and one fixed price — all fees included.",
  knopfPakete: "Compare packages",
  knopfGespraech: "Arrange a call",
  vertrauen: ["Fixed price, all fees included", "Contract in text form", "Your money back if we do not deliver", "Team on the ground in the US"],

  mandatTitel: "Your engagement",
  mandatMarke: "FIAON Global",
  mandat: [
    ["Company", "US LLC or corporation, formed by our team on the ground"],
    ["Tax numbers", "EIN and ITIN, applied for and filed"],
    ["Banking and cards", "Account and card applications, fully prepared"],
    ["Partners", "Lawyer, tax adviser and US CPA — fees included"],
    ["Support", "One dedicated contact from day one"],
    ["Price", "Fixed price, one-off, all fees included"],
  ],
  mandatPartner: "Contracting party",

  vsAuge: "One point of contact",
  vsH2: "Eight points of contact — or one contract.",
  vsLead: "Anyone building a US company alone deals with a formation service, registered agent, the US tax authority, a lawyer, a tax adviser, a US CPA, banks and card issuers — each with its own contract and its own invoice. At FIAON Global one contact coordinates them all.",
  ohneTitel: "Without FIAON Global",
  ohne: [
    "Formation service for the company",
    "Registered agent and US address",
    "US tax authority for EIN and ITIN",
    "Lawyer for the operating agreement",
    "Tax adviser in your country of residence",
    "US CPA for the annual filing",
    "Banks for the business account",
    "Card issuers for every business card",
  ],
  mitTitel: "With FIAON Global",
  mit: [
    "One contract, signed on screen",
    "One contact for every step",
    "One fixed price — all fees and charges included",
    "One team attending appointments on the ground",
  ],

  handAuge: "One source",
  handH2: "One contact. One team on the ground. One partner network.",
  handLead: "Every US structure involves many parties. At FIAON Global they work together for you — coordinated by one contact, paid for out of your fixed price.",
  hand: [
    { tag: "Team on the ground", titel: "People where authorities and banks are", text: "Our formation agents in the US attend appointments, file documents and collect paperwork — where it matters." },
    { tag: "Tax and law", titel: "Partners under your engagement", text: "Tax advisers, US CPAs and lawyers in our partner network handle everything that requires an engagement — in the US and in your country of residence. They work for you; FIAON pays their fees." },
    { tag: "Banks and issuers", titel: "Prepared in the right order", text: "Contacts at US banks and card issuers, complete documents, a clean sequence. The institution decides on account and limit." },
    { tag: "Infrastructure", titel: "Everything a company needs", text: "US business address, US phone number, registered agent and a document room — so your company can be reached and verified." },
  ],

  wegAuge: "The path",
  wegH2: "Four stages. A sequence that has proven itself.",
  wegLead: "Each stage makes the next one possible. How long a stage takes is set by authorities and institutions — so we give you typical experience, not deadlines.",
  weg: [
    { titel: "Formation and documents", dauer: "typically a few weeks", text: "Company, EIN, ITIN, registered agent, US address and phone number, operating agreement. Our team on the ground files and collects; the ITIN is issued by the US tax authority on its own timeline." },
    { titel: "The first business card", dauer: "once documents are complete", text: "You submit the first application to a US issuer — usually with a small limit and no cash deposit, but with a personal guarantee from the owner. We prepare the application; the issuer decides." },
    { titel: "The card ladder", dauer: "over several months", text: "Paying on time opens further issuers. Many offer new business customers an introductory period without interest — whether and on what terms is set by each issuer." },
    { titel: "The bank loan", dauer: "with an established history", text: "With an established history, a loan from a US bank may become an option. We prepare documents and key figures; you apply to the bank, which assesses the application under its own rules." },
  ],
  wegErfahrung: "We have walked this path ourselves — with our own US company, our own cards, our own mistakes. You benefit from that.",

  fuerAuge: "Who it is for",
  fuerH2: "For companies of every kind — not for one sector.",
  fuerLead: "The US structure suits businesses with customers, suppliers, projects or capital needs in the United States — and owners who want to build a second pillar with its own banking and card history.",
  fuer: [
    { tag: "Trades and construction", text: "Businesses with contracts, materials or partners in the US." },
    { tag: "Retail and e-commerce", text: "Purchasing, warehousing and payments in US dollars." },
    { tag: "Services and agencies", text: "Clients, advertising accounts and billing in the US." },
    { tag: "Manufacturing and industry", text: "Sales company, spare parts, service on site." },
    { tag: "Project development and property", text: "Project companies, partners and financing in the US." },
    { tag: "Founders and holdings", text: "The US company as a second pillar with its own history." },
  ],
  fuerAusstieg: "In the first call we check together whether the structure fits your plans — and we tell you if it does not.",

  paketeAuge: "Packages",
  paketeH2: "Four packages. One fixed price, everything included.",
  paketeLead: "Each package is a support engagement at a fixed price — all fees and our partners’ charges included. The capital range is the limit you are aiming for; it determines how long and how closely we work with you. Every limit is decided by the institutions.",
  festpreis: "Fixed price · one-off",
  inklusive: "All fees included",
  planung: "Capital range",
  planungZusatz: "Your target — the institution decides on the limit",
  kapitalKopf: "Capital range by package",
  kapitalKopfZusatz: "Your target — each institution decides on its own limit.",
  begleitung: "Support",
  beauftragen: (name: string) => `Order ${name}`,
  beauftragenKurz: "Order now",
  wischen: "Scroll the table sideways to see all four packages.",
  erstSprechen: "Talk first",
  kostenHinweis: "All prices plus VAT where applicable.",

  inklAuge: "Everything included",
  inklTitel: "You pay one price. We pay everyone who works on your company.",
  inklLead: "Included in the fixed price of every package:",
  wissenTitel: "What you need to know before ordering",

  vergleichAuge: "In detail",
  vergleichH2: "All services compared.",
  vergleichLead: "What each package contains — line by line. The same services appear in your contract.",
  leistung: "Service",
  zeileFestpreis: "Fixed price, one-off",
  zeilePlanung: "Capital range",
  zeileDauer: "Support (typical)",
  ja: "included",
  nein: "not included",

  unterlagenAuge: "For the start",
  unterlagenH2: "What we need from you.",
  unterlagenLead: "Five documents — our team obtains everything else. You upload them to your document room once work starts.",

  sicherAuge: "Clear arrangements",
  sicherH2: "Who does what — and whom you contract with.",
  rollenTitel: { fiaon: "What FIAON does", partner: "What partners do", kosten: "What the fixed price covers" },
  vertragspartnerTitel: "Your contracting party",
  vertragspartnerText: "The engagement is concluded with FIAON LTD. You receive contract and invoice in text form straight after signing.",
  ablaufTitel: "How it works",
  ablauf: ["Call or direct order", "Contract and invoice", "Payment received", "Kick-off call and documents", "Review by the tax adviser", "Formation", "Cards", "Bank"],

  gespraechAuge: "Call",
  gespraechH2: "Talk first, then decide.",
  gespraechLead: "Thirty minutes with your contact: your plans, your residence, your goal — and which package fits. No obligation.",

  fragenAuge: "Frequently asked questions",
  fragenH2: "What business owners ask before ordering.",
  fragen: [
    { f: "What is included in the fixed price?", a: "All fees and charges for the services in your package: US state formation fees, registered agent, US address and phone in the first year, the EIN and ITIN applications, the fees of our partner lawyer, partner tax adviser and US CPA, and the work of our team on the ground. You pay one price — we pay everyone who works on your company." },
    { f: "What does the company cost from the second year?", a: "From the second year onwards your company incurs running costs: the state fee, the registered agent and the annual US filing. The amount depends on the state; we tell you about it well in advance." },
    { f: "Does FIAON decide on cards and limits?", a: "No. The institution concerned decides on account, card and limit under its own rules. FIAON builds the structure, prepares applications and plans the sequence." },
    { f: "Do I have to travel to the US?", a: "Usually not. Our team on the ground attends the appointments. If you want to experience the build-up in person, choose Global VIP — flights and hotel for the kick-off in Miami are included in its fixed price." },
    { f: "What about taxes?", a: "The US company does not replace tax liability at home: if you manage it from Germany, Austria or Switzerland, you pay tax there. Our partner tax adviser reviews your position before formation and our US CPA handles the first annual US filing — both under your engagement, with FIAON paying their fees." },
    { f: "How long does it take?", a: "Formation and documents typically a few weeks, the ITIN on the US tax authority's timeline, the first business card after that, further issuers over several months. We do not quote fixed deadlines — authorities and institutions set the pace." },
    { f: "Can I order straight away?", a: "Yes. You choose a package, enter your company, sign the contract on screen and receive contract and invoice by email. Your contact starts once payment has been received." },
    { f: "How do I pay?", a: "By bank transfer to the business account of FIAON LTD — bank details and payment reference are on your invoice. There is no subscription and there are no instalments." },
    { f: "Who is it not for?", a: "For plans with no connection to the US and no willingness to run a real company with duties. We clarify that in the first call — openly, even if the answer is no." },
    { f: "Who is my contracting party?", a: "FIAON LTD, registered at Companies House (England and Wales) under number 17318250. Tax advisers, US CPAs and lawyers act under your engagement; FIAON pays their fees." },
  ],

  schlussA: "A structure that belongs to you — ",
  schlussB: "built by people you know.",
  schlussText: "Choose a package or arrange a call. You will hear back from a person, not a machine.",
};

export const GLOBAL_WOERTER = { de, en };

// ── Das Gespräch (Kalender auf /business#gespraech) ────────────────────────
const gespraechDe = {
  punkte: [
    "Ihr Vorhaben, Ihr Wohnsitz, Ihr Ziel — in dreißig Minuten geordnet.",
    "Welche Gesellschaftsform und welches Paket zu Ihrer Lage passen.",
    "Was im Festpreis steckt und was wir nicht zusagen können.",
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
    "What the fixed price covers and what we cannot commit to.",
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
