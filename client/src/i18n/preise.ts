// ═══════════════════════════════════════════════════════════════════════════
// /preise · /en/pricing — das Wörterbuch der Seite (02.09.2026)
//
// Beide Sprachen nebeneinander, Schlüssel für Schlüssel: Wer einen deutschen
// Satz ändert, sieht den englischen direkt darunter und zieht ihn mit. Die
// Seite (pages/site/preise.tsx) liest über useWoerter() die passende Hälfte.
// Britisches Englisch; Zahlen und Preise kommen aus dem Paketkatalog, nie
// von hier. Keine Garantie-, Beratungs- oder Score-Versprechen — in beiden
// Sprachen. Die Kündigungsregel „monatlich, formlos" ist Geschäftsregel seit
// 02.09.2026 und steht in beiden Fassungen gleich.
//
// Der FAQ-Generator (scripts/seo-fragen-erzeugen.ts) teilt diese Datei an
// „const en": erste Hälfte → /preise, zweite → /en/pricing.
//
// 24.09.2026 (E-240): Die Bonitätsauskunft ist in KEINEM Paket enthalten. Hier
// stand „Jedes Paket beginnt mit Ihrer Bonitätsauskunft", die Auskunft als
// Leistung jeder Spalte und das Versprechen, den Betrag binnen 30 Tagen auf ein
// Paket anzurechnen — eine Anrechnung gibt es nicht, und der Aufpreis (149 € einzeln, 74 € mit Paket)
// widersprach der Tabelle. Preise kommen als Argument aus
// shared/fiaon-auskunft.ts; nur in den FAQ stehen sie als Text, weil der
// FAQ-Generator ausschließlich reine Zeichenketten liest — bei einem
// Preiswechsel dort mitziehen.
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  seoTitel: "Preise & Pakete: FIAON ab 7,99 € im Monat",
  seoBeschreibung: "Alle FIAON-Pakete auf einen Blick: Start, Pro, Ultra und High-End – was enthalten ist, was es kostet, was Selbermachen kostet. Zwölf Raten.",
  krume: "Preise & Pakete",
  pille: "Preise & Pakete",
  h1a: "Ein Preis, ", h1b: "keine Überraschung.",
  lead: "Zwölf Monatsraten, danach monatlich kündbar – und wir fragen, ob Sie bleiben. Keine Provision auf Rahmen, keine Gebühr je Schreiben, kein Kleingedrucktes. Hier steht alles – inklusive dessen, was Selbermachen und Anwalt kosten.",
  knopfFinder: "Welches Paket passt?", knopfAlle: "Alle Pakete",
  kz1: "Raten, danach monatlich kündbar", kz2: "Provision, Gebühr je Schreiben, Aufschlag", kz3: (mitPaket: string) => `Bonitätsauskunft einzeln · mit Paket ${mitPaket}`, kz4: "günstigstes Paket im Monat",
  finderH2a: "Drei Fragen, ", finderH2b: "ein Paket.",
  finderLead: "Kein Verkaufsgespräch – eine ehrliche Zuordnung. Jedes Paket lässt sich im Antrag und im Startgespräch noch ändern.",
  frage: "Frage",
  finder: [
    { key: "wer", frage: "Für wen suchen Sie?", optionen: [["privat", "Für mich privat"], ["business", "Für mein Unternehmen"]] },
    { key: "lage", frage: "Wie ist die Lage?", optionen: [["klar", "Ich will nur wissen, was drinsteht"], ["eintrag", "Es gibt Einträge, die weg sollen"], ["zugang", "Ich brauche Konto oder Karte"], ["alles", "Alles davon – und einen festen Ansprechpartner"]] },
    { key: "tempo", frage: "Wie schnell soll es gehen?", optionen: [["ruhig", "In Ruhe, Schritt für Schritt"], ["zuegig", "Zügig, ich habe Fristen"], ["sofort", "So schnell wie irgendwie möglich"]] },
  ] as { key: string; frage: string; optionen: [string, string][] }[],
  // 17.09.2026 (E-188): Für Unternehmen gibt es keine Monatspakete mehr, sondern
  // FIAON Global. Der Paketfinder fragt dort nicht weiter (Lage und Tempo sind
  // Fragen der Bonitätslinie), sondern zeigt den Weg zur Seite.
  globalTitel: "FIAON Global",
  globalText: "Für Unternehmen gibt es FIAON Global: Ihre US-Gesellschaft aus einer Hand, mit einem Team vor Ort in den USA und einem Ansprechpartner. Vier Pakete, jedes zum Einmalpreis – kein Abo. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  globalAb: (ab: string) => `ab ${ab} einmalig`,
  globalGespraech: "Erst sprechen",
  gruende: {
    schufa: "Nur die Auskunft: Datenkopien aller Auskunfteien Ihres Landes, jede Zeile erklärt, Fristen geprüft, Handlungsplan und fertige Schreiben – einmalig, kein Abo.",
    start: "Auskunft, Erklärung und die Schreiben zum Selbstversand – günstig und vollständig.",
    pro_fristen: "FIAON versendet und verfolgt – bei Fristen der sichere Weg.",
    pro_zugang: "Konto- und Kartenvorbereitung sind ab Pro enthalten.",
    highend: "Vorrang bei allem, direkter Draht, alles aus einer Hand.",
    ultra: "Bereinigen, Konto, Karte und ein fester Ansprechpartner – das volle Programm.",
  } as Record<string, string>,
  vorschlag: "Unser Vorschlag", imMonat: "im Monat", zwoelfRaten: "zwölf Raten", gesamt: "gesamt", einmalig: "einmalig",
  zurBusiness: "Zu FIAON Global", diesesPaket: "Dieses Paket wählen", auskunftBestellen: "Bonitätsauskunft bestellen", lieberReden: "Lieber erst reden",
  privatPille: "Privatkunden", privatH2a: "Vier Pakete ", privatH2b: "und Ihre Auskunft.",
  privatLead: "Jedes Paket erklärt Ihre Bonitätsauskunft in Menschensprache – inklusive des neuen SCHUFA-Scores je Kriterium. Die Auskunft selbst ist nicht im Paket enthalten: Sie bestellen sie bei FIAON zum Kundenpreis dazu oder laden eine selbst angeforderte Datenkopie hoch. Der Unterschied der Pakete liegt darin, wie viel FIAON danach übernimmt.",
  leistung: "Leistung", auskunft: "Auskunft", auskunftTitel: "Bonitätsauskunft", meistgewaehlt: "Meistgewählt", proMonat: "im Monat", nurAuskunft: "Nur Auskunft", waehlen: "Wählen",
  mitPaket: (preis: string) => `mit Paket ${preis}`,
  leistungen: [
    "Bonitätsauskunft: Datenkopien aller Auskunfteien Ihres Landes angefordert", "Jeder Eintrag erklärt, neuer SCHUFA-Score (100–999) je Kriterium eingeordnet", "Löschfristen und 100-Tage-Regel je Eintrag",
    "Finanzauswertung aus dem Kontoauszug", "Schreiben an Gläubiger und Auskunfteien", "Fristen verfolgt, Antworten bewertet, Eskalation zur Aufsicht",
    "Ratenvereinbarungen mit Gläubigern", "Girokonto vorbereitet", "Kreditkarte vorbereitet", "Fester Ansprechpartner", "Vorrang bei Fristen und Rückfragen", "Direkte Durchwahl, alles aus einer Hand",
  ],
  selbstversand: "zum Selbstversand", fiaonVersendet: "FIAON versendet", abSchwelle: "ab Schwelle",
  anAuskunfteien: "an Auskunfteien, zur Freigabe", zubuchbar: (preis: string) => `+ ${preis} Kundenpreis`,
  preisHinweis: "Alle Preise inklusive Umsatzsteuer. Zwölf Raten, jede per Überweisung; danach monatlich kündbar. Über Konto, Karte und Rahmen entscheidet die Bank – FIAON bereitet vor. Preise gelten in Deutschland, Österreich und der Schweiz (Abrechnung in Euro).",
  antragHinweis: "",
  fallH2a: "Was kostet ", fallH2b: "mein Fall?",
  fallLead: "Drei Angaben – der Rechner nennt das passende Paket, den Gesamtpreis über zwölf Raten und was derselbe Fall beim Anwalt oder in eigener Zeit kostet.",
  eintraege: "Einträge, um die es geht: ", laender: "Auskunfteien / Länder: ", stunde: "Was eine Stunde Ihrer Zeit wert ist: ",
  zielAuskunft: "Nur wissen, was drinsteht", zielKonto: "Einträge angehen, Konto", zielKarte: "Bis zur Kreditkarte",
  zwoelfRatenA: "Zwölf Raten à ", einmaligGross: "Einmalig",
  auskunftBei: (n: number) => `Auskunft${n > 1 ? ` bei ${n} Auskunfteien` : ""}, Erklärung, Fristen`,
  schreiben: "Schreiben", schreibenAuskunft: "Schreiben an Auskunfteien, zur Freigabe", auskunftMitPaket: "Bonitätsauskunft (Kundenpreis mit Paket)", schreibenSelbst: "Schreiben zum Selbstversand", schreibenVersand: "Schreiben, Versand, Nachfassen", inklusive: "inklusive",
  ihreZeit: "Ihre Zeit: Freigaben, rund 1 Stunde", summeGesamt: "Gesamt",
  selbstOhneAnwalt: "Selbst, ohne Anwalt", datenkopie: "Datenkopie (Art. 15 DSGVO)", einschreiben: "Einschreiben, je Eintrag zwei",
  eigeneZeit: (h: number) => `Eigene Zeit, rund ${h} Stunden`, mitAnwalt: "Mit Anwalt je Schreiben (Richtwert)",
  richtwerteA: "Richtwerte: Einschreiben Einwurf rund 5,50 €; Anwaltskosten für ein einfaches Schreiben nach RVG je nach Gegenstandswert, hier 190 € je Eintrag. Ehrlich gesagt: Bei einem einzigen, klaren Eintrag reichen die kostenlosen ",
  richtwerteLink: "Werkzeuge", richtwerteB: " oft aus – nutzen Sie sie.",
  wegH2a: "Der Zahlungsweg – ", wegH2b: "Schritt für Schritt.",
  wegLead: "Keine Vorkasse für Leistungen, die noch nicht erbracht sind. So läuft die Zahlung wirklich.",
  weg: [
    { dauer: "Tag 0", titel: "Antrag, Paket, Vertrag", text: "Sie wählen das Paket, sehen den Preis, nehmen den Vertrag an. Ihr Kundenbereich ist sofort aktiv – noch ohne Zahlung." },
    { dauer: "Tag 0–3", titel: "Erste Rate per Überweisung", text: "Zahlungsdaten mit QR-Code im Kundenbereich. Sobald die Bank den Eingang bestätigt, startet das Startgespräch – „bezahlt“ heißt bei FIAON immer bankbestätigt." },
    { dauer: "ab Monat 2", titel: "Jede weitere Rate per Überweisung", text: "Elf weitere Raten, jeden Monat per Überweisung. Bankverbindung und Verwendungszweck stehen in jeder Zahlungsmail und im Kundenbereich; zwei Tage vorher erinnert der Zahlungskalender. Keine Kreditkarte nötig." },
    { dauer: "jederzeit", titel: "Kündigen zum Monatsende, formlos", text: "Im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Nach der zwölften Rate fragen wir, ob Sie bleiben – Ansprechpartner, Akte und Fristenüberwachung laufen dann weiter." },
  ],
  weiterlesen: "Zum Weiterlesen",
  weiter: [
    { href: "/fiaon-erfahrungen", t: "So arbeitet FIAON", s: "Bankbestätigte Zahlen, Ablauf, Grenzen, Seriositäts-Check für jeden Anbieter." },
    { href: "/bonitaetsauskunft-beantragen", t: "Bonitätsauskunft beantragen", s: "Was die Bonitätsauskunft leistet – und wann der kostenlose Weg reicht." },
    { href: "/kreditkarte", t: "Kreditkarte trotz Eintrag", s: "Welche Karte heute realistisch ist und wie der Rahmen wächst." },
    { href: "/werkzeuge", t: "20 kostenlose Werkzeuge", s: "Alles, was Sie selbst tun können – bevor Sie etwas bezahlen." },
  ],
  businessPille: "Unternehmen", businessH2a: "Für Unternehmen: ", businessH2b: "FIAON Global.",
  businessLead: "FIAON gründet Ihre US-Gesellschaft, bereitet Steuernummern und Dokumente vor und baut Schritt für Schritt Ihre Bank- und Kartenbeziehung auf – mit einem Team vor Ort in den USA und einem Ansprechpartner für Sie. Vier Pakete, jedes zum Einmalpreis, kein Abo. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  globalEinmalig: "einmalig · kein Abo",
  globalKosten: "Festpreis, einmalig: Alle Gebühren und Honorare für die Leistungen des Pakets sind enthalten — Staatsgebühren, Registered Agent, Partner-Anwalt, Partner-Steuerberater und US-CPA.",
  ehrlichTag: "Ehrlich gesagt", ehrlichTitel: "Wann Sie FIAON nicht brauchen",
  ehrlichA: "Ein einziger, klar erledigter Eintrag ohne Erledigt-Vermerk? Der ", ehrlichLink1: "Löschantrag-Generator", ehrlichB: " schreibt den Brief kostenlos. Nur wissen, was drinsteht? Die Datenkopie nach Art. 15 DSGVO ist kostenlos – der ", ehrlichLink2: "Generator", ehrlichC: " auch. FIAON lohnt sich, wenn mehrere Einträge, mehrere Länder, Fristen und Antworten zu verfolgen sind – oder wenn am Ende Konto und Karte stehen sollen.",
  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Wie lange läuft der Vertrag?", a: "Der Vertrag läuft über zwölf Monatsraten – so lange, weil Auskunft, Schreiben und Antworten Zeit brauchen. Danach läuft er unbefristet weiter und ist jederzeit mit einer Frist von einem Monat kündbar, formlos: im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das gesetzliche Widerrufsrecht von 14 Tagen ab Vertragsschluss gilt zusätzlich." },
    { f: "Ist die Bonitätsauskunft im Paket enthalten?", a: "Nein, sie ist ein eigenes Produkt. Mit laufendem Paket kostet sie einmalig 74 €, ohne Paket 149 € (für Unternehmen 199 € mit Paket, 349 € ohne). Sie bekommen die Datenkopien aller Auskunfteien Ihres Landes, jede Zeile erklärt, die Speicherfristen geprüft, einen Handlungsplan und fertige Schreiben zur Freigabe. Ihre Datenkopie steht Ihnen bei jeder Auskunftei auch kostenlos zu – fordern Sie sie selbst an, laden Sie sie im Kundenbereich hoch, und Ihr Paket erklärt sie." },
    { f: "Gibt es Kosten je Schreiben oder Erfolgsprovisionen?", a: "Nein. Weder je Schreiben noch auf Löschungen, Konten oder Kartenrahmen. Der Paketpreis ist der Preis – dazu auf Wunsch die Bonitätsauskunft. Einschreiben-Porto, Nachfassen, Eskalation – alles enthalten." },
    { f: "Wie wird bezahlt?", a: "Jede Rate per Überweisung – die erste wie alle weiteren. Die Zahlungsdaten mit QR-Code stehen im Kundenbereich, Bankverbindung und Verwendungszweck zusätzlich in jeder Zahlungsmail. Keine Kreditkarte nötig, keine Vorkasse für Leistungen, die noch nicht erbracht sind." },
    { f: "Kann ich das Paket wechseln?", a: "Im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf dieser Seite gibt die erste Orientierung – die endgültige Zuordnung besprechen Sie im Startgespräch." },
    { f: "Was, wenn alle meine Einträge berechtigt sind?", a: "Dann sagen wir es Ihnen nach der Auskunft – und Sie entscheiden, ob Sie weitermachen. Auch bei berechtigten Einträgen gibt es einen Weg: Erledigt-Vermerke, Ratenvereinbarungen mit Meldeverzicht, das Girokonto, die Zahlungshistorie. Nur Löschung gibt es dann nicht, und das versprechen wir auch nicht." },
  ],
  zwischenrufA: "Nicht sicher, welches Paket?", zwischenrufB: " Drei Fragen im Paketfinder oben – oder 15 Minuten mit einem Mitarbeiter.",
  paketfinder: "Paketfinder", kontakt: "Kontakt aufnehmen",
  abschlussA: "Ihr Weg beginnt ", abschlussB: "mit einer E-Mail-Adresse.",
  abschlussText: (ab: string) => `Antrag in zwei Minuten, jeder Eintrag Ihrer Auskunft erklärt, ein Mensch, der Sie durch alles führt – ab ${ab} im Monat, zwölf Raten.`,
  mitStarten: (paket: string) => `Mit ${paket} starten`, nurDieAuskunft: "Nur die Auskunft",
};

const en: typeof de = {
  seoTitel: "Pricing and plans: twelve instalments, no surprises | FIAON",
  seoBeschreibung: "What FIAON costs: twelve monthly instalments, then cancellable monthly, or the credit report on its own. Every service compared with doing it yourself.",
  krume: "Pricing",
  pille: "Pricing & plans",
  h1a: "One price, ", h1b: "no surprises.",
  lead: "Twelve monthly instalments, cancellable monthly thereafter — and then we ask whether you want to stay. No commission on limits, no fee per letter, no small print. Everything is here — including what doing it yourself or a lawyer costs.",
  knopfFinder: "Which plan fits?", knopfAlle: "All plans",
  kz1: "instalments, cancellable monthly thereafter", kz2: "commission, fee per letter, mark-up", kz3: (mitPaket: string) => `credit report on its own · ${mitPaket} with a plan`, kz4: "cheapest plan per month",
  finderH2a: "Three questions, ", finderH2b: "one plan.",
  finderLead: "No sales pitch — an honest match. Every plan can still be changed in the application and in the onboarding call.",
  frage: "Question",
  finder: [
    { key: "wer", frage: "Who is it for?", optionen: [["privat", "For me personally"], ["business", "For my company"]] },
    { key: "lage", frage: "What is the situation?", optionen: [["klar", "I just want to know what is on file"], ["eintrag", "There are entries that need to go"], ["zugang", "I need an account or a card"], ["alles", "All of that — and a named contact person"]] },
    { key: "tempo", frage: "How fast does it need to be?", optionen: [["ruhig", "Calmly, step by step"], ["zuegig", "Quickly, I have deadlines"], ["sofort", "As fast as humanly possible"]] },
  ],
  globalTitel: "FIAON Global",
  globalText: "For companies there is FIAON Global: your US company from a single source, with a team on the ground in the United States and one dedicated contact. Four packages, each at a one-off price — no subscription. The institution alone decides on the account, the card and the limit.",
  globalAb: (ab: string) => `from ${ab} one-off`,
  globalGespraech: "Talk first",
  gruende: {
    schufa: "Just the report: data copies from every credit bureau in your country, every line explained, deadlines checked, an action plan and finished letters — one-off, no subscription.",
    start: "Report, explanation and the letters for you to send — affordable and complete.",
    pro_fristen: "FIAON sends and follows up — the safe route when deadlines are involved.",
    pro_zugang: "Account and card preparation are included from Pro upwards.",
    highend: "Priority on everything, a direct line, everything from one hand.",
    ultra: "Clean-up, account, card and a named contact person — the full programme.",
  },
  vorschlag: "Our suggestion", imMonat: "a month", zwoelfRaten: "twelve instalments", gesamt: "in total", einmalig: "one-off",
  zurBusiness: "To FIAON Global", diesesPaket: "Choose this plan", auskunftBestellen: "Order the credit report", lieberReden: "Talk first",
  privatPille: "Personal", privatH2a: "Four plans ", privatH2b: "and your credit report.",
  privatLead: "Every plan explains your credit report in plain language — including the new SCHUFA score, criterion by criterion. The report itself is not included in a plan: you add it from FIAON at the customer price or upload a data copy you requested yourself. The difference between the plans is how much FIAON takes on afterwards.",
  leistung: "Service", auskunft: "Report", auskunftTitel: "Credit report", meistgewaehlt: "Most chosen", proMonat: "a month", nurAuskunft: "Report only", waehlen: "Choose",
  mitPaket: (preis: string) => `${preis} with a plan`,
  leistungen: [
    "Credit report: data copies requested from every bureau in your country", "Every entry explained, new SCHUFA score (100–999) per criterion", "Deletion deadlines and the 100-day rule per entry",
    "Financial analysis from your bank statement", "Letters to creditors and credit bureaus", "Deadlines tracked, replies assessed, escalation to the supervisory authority",
    "Instalment agreements with creditors", "Current account prepared", "Credit card prepared", "Named contact person", "Priority on deadlines and queries", "Direct line, everything from one hand",
  ],
  selbstversand: "you send them", fiaonVersendet: "FIAON sends them", abSchwelle: "from threshold",
  anAuskunfteien: "to credit bureaus, for your approval", zubuchbar: (preis: string) => `+ ${preis} customer price`,
  preisHinweis: "All prices include VAT. Twelve instalments, each by bank transfer; cancellable monthly thereafter. The bank decides on account, card and limit — FIAON prepares. Prices apply in Germany, Austria and Switzerland (billed in euros).",
  antragHinweis: "The application and the customer area are currently in German; our team speaks English on the phone.",
  fallH2a: "What does ", fallH2b: "my case cost?",
  fallLead: "Three inputs — the calculator names the matching plan, the total over twelve instalments and what the same case costs with a lawyer or in your own time.",
  eintraege: "Entries at stake: ", laender: "Credit bureaus / countries: ", stunde: "What an hour of your time is worth: ",
  zielAuskunft: "Just know what is on file", zielKonto: "Tackle entries, get an account", zielKarte: "All the way to a credit card",
  zwoelfRatenA: "Twelve instalments of ", einmaligGross: "One-off",
  auskunftBei: (n: number) => `Report${n > 1 ? ` from ${n} bureaus` : ""}, explanation, deadlines`,
  schreiben: "Letters", schreibenAuskunft: "Letters to credit bureaus, for your approval", auskunftMitPaket: "Credit report (customer price with a plan)", schreibenSelbst: "Letters for you to send", schreibenVersand: "Letters, sending, follow-up", inklusive: "included",
  ihreZeit: "Your time: approvals, around 1 hour", summeGesamt: "Total",
  selbstOhneAnwalt: "Yourself, without a lawyer", datenkopie: "Data copy (Art. 15 GDPR)", einschreiben: "Registered letters, two per entry",
  eigeneZeit: (h: number) => `Your own time, around ${h} hours`, mitAnwalt: "With a lawyer per letter (guide value)",
  richtwerteA: "Guide values: a registered letter costs around €5.50; a lawyer's fee for a simple letter follows the German fee schedule (RVG) and depends on the amount at stake — here €190 per entry. Honestly: with a single, clear entry the free ",
  richtwerteLink: "tools", richtwerteB: " are often enough — use them.",
  wegH2a: "How you pay — ", wegH2b: "step by step.",
  wegLead: "No payment in advance for services not yet delivered. This is how payment really works.",
  weg: [
    { dauer: "Day 0", titel: "Application, plan, contract", text: "You choose the plan, see the price, accept the contract. Your customer area is active straight away — before any payment." },
    { dauer: "Days 0–3", titel: "First instalment by bank transfer", text: "Payment details with a QR code in your customer area. As soon as the bank confirms receipt, the onboarding call is booked — at FIAON, “paid” always means confirmed by the bank." },
    { dauer: "from month 2", titel: "Every further instalment by bank transfer", text: "Eleven further instalments, each month by bank transfer. Bank details and payment reference are in every payment e-mail and in your customer area; the payment calendar reminds you two days ahead. No credit card needed." },
    { dauer: "any time", titel: "Cancel to the end of the month, informally", text: "In your customer area under Subscription & payments or by e-mail. After the twelfth instalment we ask whether you want to stay — your contact person, your file and deadline tracking then continue." },
  ],
  weiterlesen: "Read on",
  weiter: [
    { href: "/fiaon-erfahrungen", t: "How FIAON works", s: "Bank-confirmed figures, process, limits, a seriousness check for any provider." },
    { href: "/bonitaetsauskunft-beantragen", t: "Requesting your credit report", s: "What the credit report delivers — and when the free route is enough." },
    { href: "/kreditkarte", t: "A credit card despite an entry", s: "Which card is realistic today and how the limit grows." },
    { href: "/werkzeuge", t: "20 free tools", s: "Everything you can do yourself — before you pay for anything." },
  ],
  businessPille: "Companies", businessH2a: "For companies: ", businessH2b: "FIAON Global.",
  businessLead: "FIAON forms your US company, prepares tax numbers and documents and builds your banking and card relationship step by step — with a team on the ground in the United States and one dedicated contact for you. Four packages, each at a one-off price, no subscription. The institution alone decides on the account, the card and the limit.",
  globalEinmalig: "one-off · no subscription",
  globalKosten: "Fixed price, one-off: all fees and charges for the services in the package are included — state fees, registered agent, partner lawyer, partner tax adviser and US CPA.",
  ehrlichTag: "Honestly", ehrlichTitel: "When you do not need FIAON",
  ehrlichA: "A single, clearly settled entry without a settled marker? The ", ehrlichLink1: "deletion request generator", ehrlichB: " writes the letter free of charge. Just want to know what is on file? The data copy under Art. 15 GDPR is free — and so is the ", ehrlichLink2: "generator", ehrlichC: ". FIAON is worth it when several entries, several countries, deadlines and replies have to be tracked — or when an account and a card are the goal.",
  fragenPille: "Frequently asked questions",
  fragen: [
    { f: "How long does the contract run?", a: "The contract runs for twelve monthly instalments — that long because reports, letters and replies take time. After that it continues indefinitely and can be cancelled at any time with one month\x27s notice, informally: in your customer area under Subscription & payments or by e-mail. The statutory 14-day right of withdrawal from the conclusion of the contract applies in addition." },
    { f: "Is the credit report included in a plan?", a: "No, it is a separate product. With a running plan it costs €74 one-off, without a plan €149 (for companies €199 with a plan, €349 without). You receive the data copies from every credit bureau in your country, every line explained, storage periods checked, an action plan and finished letters for your approval. You are also entitled to your data copy from each bureau free of charge — request it yourself, upload it in your customer area and your plan explains it." },
    { f: "Are there fees per letter or success commissions?", a: "No. Neither per letter nor on deletions, accounts or card limits. The plan price is the price — plus the credit report if you want it. Registered-letter postage, follow-up, escalation — all included." },
    { f: "How do I pay?", a: "Every instalment by bank transfer — the first and all further ones. The payment details with a QR code are in your customer area, and bank details and payment reference are also in every payment e-mail. No credit card needed, no payment in advance for services not yet delivered." },
    { f: "Can I change plans?", a: "In the application, in the onboarding call and upwards at any time afterwards; downwards from the next instalment cycle. The plan finder on this page gives a first orientation — the final choice is discussed in the onboarding call." },
    { f: "What if all my entries are justified?", a: "Then we tell you so after the report — and you decide whether to continue. Even with justified entries there is a way forward: settled markers, instalment agreements with a waiver of reporting, the current account, your payment history. Only deletion is off the table then, and we do not promise it." },
  ],
  zwischenrufA: "Not sure which plan?", zwischenrufB: " Three questions in the plan finder above — or 15 minutes with one of our team.",
  paketfinder: "Plan finder", kontakt: "Get in touch",
  abschlussA: "Your journey starts ", abschlussB: "with an e-mail address.",
  abschlussText: (ab: string) => `Application in two minutes, every entry in your report explained, a person who guides you through everything — from ${ab} a month, twelve instalments.`,
  mitStarten: (paket: string) => `Start with ${paket}`, nurDieAuskunft: "Report only",
};

export const PREISE_WOERTER = { de, en };
