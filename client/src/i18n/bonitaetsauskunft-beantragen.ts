// /bonitaetsauskunft-beantragen · /en/request-your-credit-report — Wörterbuch (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel. Der FAQ-Generator teilt an „const en".
//
// 24.09.2026 (E-240): Die Auskunft hat zwei Preise (149 € einzeln, 74 € mit
// laufendem FIAON-Paket; Unternehmen 349/199 €) und fragt je Land bei ALLEN
// Auskunfteien an — nicht mehr „SCHUFA, KSV, CRIF aus einer Hand für 74 €".
// Preise, Auskunfteien und die deutsche Leistungsliste kommen aus
// shared/fiaon-auskunft.ts und werden von der Seite als Argument hereingereicht.
// NUR die FAQ tragen die Preise als Text: Der FAQ-Generator
// (scripts/seo-fragen-erzeugen.ts) liest ausschließlich reine Zeichenketten —
// bei einem Preiswechsel dort mitziehen.
// Das Gratisrecht steht weiter vorne: Wer den kostenlosen Weg verschweigt,
// wirkt wie die Anbieter, vor denen wir warnen.
//
// 25.09.2026 (E-241): Die Seite trägt die Gestaltung der Seitenfamilie
// /bonitaetsauskunft (Kopf, Preiszeile, Abschluss, Kaufleiste am Handy) und
// verweist in sie. Neu hier nur die Worte dafür (schlussPille … familieLinks) —
// die FAQ bleiben unverändert (scripts/seo-fragen-erzeugen.ts liest sie).
import { auskunftLeistung, type AuskunftArt, type AuskunftLand } from "@shared/fiaon-auskunft";

const de = {
  metaTitel: "Bonitätsauskunft beantragen: kostenlos oder mit FIAON",
  metaBeschreibung: "Bonitätsauskunft beantragen: der kostenlose Weg nach Art. 15 DSGVO und die FIAON-Bonitätsauskunft mit Handlungsplan im Vergleich — die großen Auskunfteien Ihres Landes.",
  seoTitel: "Bonitätsauskunft beantragen: beide Wege | FIAON",
  seoBeschreibung: "Bonitätsauskunft beantragen: der kostenlose Weg nach Art. 15 DSGVO und die FIAON-Bonitätsauskunft mit Handlungsplan im Vergleich — die großen Auskunfteien Ihres Landes.",
  krume: "Bonitätsauskunft beantragen",
  ldName: "FIAON-Bonitätsauskunft mit Handlungsplan",
  ldArt: "Anforderung und Erklärung von Bonitätsauskünften bei den großen Auskunfteien des Landes (Deutschland, Österreich, Schweiz)",
  ldFirma: "FIAON-Bonitätsauskunft für Unternehmen",
  pille: "Zwei Wege, volle Klarheit", h1a: "Bonitätsauskunft beantragen — ", h1b: "kostenlos oder mit FIAON.",
  lead: (einzeln: string, mitPaket: string) => `Ihre Datenkopie steht Ihnen gesetzlich kostenlos zu — das sagen wir zuerst. Die FIAON-Bonitätsauskunft ist für alle, die Anforderung, Erklärung und Fristenprüfung abgeben wollen: einmalig ${einzeln}, mit laufendem FIAON-Paket ${mitPaket}, kein Abo.`,
  antragStarten: "Bonitätsauskunft bestellen", kostenlosPruefen: "Kostenlos prüfen lassen", fuerFirmen: "Für Unternehmen",
  vergleichTitel: "Selbst anfordern oder anfordern lassen?", vergleichLead: "Beides führt zur Auskunft. Der Unterschied ist, wer die Arbeit macht — und wer die Einträge versteht.",
  kopf: ["", "Selbstauskunft (Art. 15 DSGVO)", "FIAON-Bonitätsauskunft"],
  preisZeile: (einzeln: string, mitPaket: string) => ["Preis", "0 € — gesetzliches Recht", `${einzeln} einmalig · mit Paket ${mitPaket}`],
  zeilen: [
    ["Anforderung", "Sie schreiben jede Auskunftei einzeln an", "FIAON fordert bei den großen Auskunfteien Ihres Landes an — in Ihrem Auftrag"],
    ["Form", "Rohdaten, Fachbegriffe, Abkürzungen", "Jede Zeile in klaren Worten erklärt"],
    ["Prüfung", "machen Sie selbst (unsere Werkzeuge helfen kostenlos)", "Speicherfristen und Richtigkeit jedes Eintrags geprüft"],
    ["Danach", "Schreiben selbst aufsetzen, Fristen selbst verfolgen", "Handlungsplan und fertige Schreiben — Sie geben frei, wir übermitteln"],
    ["Für wen", "Zeit und Ruhe, sich einzuarbeiten", "Klarheit, ohne Paragrafen-Arbeit"],
  ] as string[][],
  gratisA: "Den Gratisweg bereiten unsere Werkzeuge kostenlos vor: ", gratisLink1: "Selbstauskunft anfordern", gratisB: " und ", gratisLink2: "Eintrag prüfen", gratisC: ". Wer beides anbietet und den Gratisweg verschweigt, verkauft Ihnen Ihr eigenes Recht.",
  // ── WAS GELIEFERT WIRD, JE LAND UND ART ─────────────────────────────────
  leistungTitel: "Was Sie bekommen — je Land",
  leistungLead: "Angefragt wird bei den großen Auskunfteien Ihres Landes. Für Unternehmen gibt es eine eigene Variante mit den Firmendaten.",
  laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" } as Record<AuskunftLand, string>,
  arten: { privat: "Für mich privat", firma: "Für mein Unternehmen" } as Record<AuskunftArt, string>,
  // Deutsch: wörtlich die eine Liste aus shared/fiaon-auskunft.ts. Die dritte
  // Angabe (Auskunfteien als Satzteil) braucht nur die englische Fassung.
  leistung: (art: AuskunftArt, land: AuskunftLand, _bei: string) => auskunftLeistung(art, land),
  leistungPreis: (preis: string, mitPaket: string) => `${preis} einmalig · mit laufendem FIAON-Paket ${mitPaket}`,
  ablaufTitel: "So läuft es ab", ablaufLead: "Vier Etappen — Sie sehen jede davon in Ihrem Kundenbereich.",
  ablauf: [
    { dauer: "wenige Minuten", titel: "Bestellen und Vollmacht erteilen", text: "Name, Anschrift, Geburtsdatum — mehr brauchen die Auskunfteien nicht, um Sie sicher zuzuordnen. Mit Ihrer Vollmacht dürfen wir die Datenkopien für Sie anfordern." },
    { dauer: "in der Regel bis zu einem Monat", titel: "FIAON fordert die Datenkopien an", text: "Wir fordern Ihre Datenkopien bei den großen Auskunfteien Ihres Landes an. Die Häuser haben dafür gesetzlich in der Regel einen Monat Zeit — oft geht es schneller. Sie müssen nichts tun." },
    { dauer: "sobald sie vorliegen", titel: "Erklärung und Fristenprüfung", text: "Jede Zeile wird in klaren Worten erklärt und geprüft: zulässig gemeldet? Speicherfrist abgelaufen? Inhaltlich richtig? Sie sehen das Ergebnis in Ihrem Kundenbereich." },
    { dauer: "danach", titel: "Handlungsplan und fertige Schreiben", text: "Ihr Handlungsplan sagt, was Sie konkret tun können, in welcher Reihenfolge. Die Schreiben — etwa Löschung nach Fristablauf oder Berichtigung falscher Daten — liegen fertig bereit: Sie geben frei, wir übermitteln. Über Konto und Karte entscheidet die Bank." },
  ],
  erhaltenTitel: "So sieht Ihr Ergebnis aus", erhaltenLead: "Kein Zahlenfriedhof, sondern eine geprüfte Übersicht mit dem nächsten Schritt.",
  dokumentAria: "Beispielhafte Darstellung der FIAON-Auswertung: drei Einträge mit Bewertung", dokumentTitel: "FIAON-Auswertung", dokumentBeispiel: "Beispieldarstellung",
  dokumentZeilen: [
    ["Girokonto, geführt seit 2019", "Positivmerkmal", "gruen"], ["Ratenkredit, vertragsgemäß bedient", "Positivmerkmal", "gruen"],
    ["Forderung Mobilfunk, 214 €, erledigt 2022", "Frist prüfen — Schreiben bereit", "gelb"], ["SCHUFA-Score (100–999)", "im Bericht erklärt", ""],
  ] as string[][],
  preisTitel: "Zwei Preise, keine Überraschungen", preisEinmalig: " einmalig",
  preisMitPaket: (mitPaket: string) => `Mit laufendem FIAON-Paket: ${mitPaket}`,
  preisFirma: (einzeln: string, mitPaket: string) => `Für Unternehmen: ${einzeln} einzeln, ${mitPaket} mit Paket`,
  // PAngV § 6 (Fernabsatz): neben dem Preis sagen, dass die Steuer drin ist — wortgleich
  // mit AGB § 5 Abs. 1 und der Bestellseite (client/src/i18n/bonitaet-antrag.ts, PREIS_STEUER).
  preisSteuer: "Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer.",
  preisZeilen: ["Datenkopien bei den großen Auskunfteien Ihres Landes — in Ihrem Auftrag", "Jede Zeile in klaren Worten erklärt", "Speicherfristen und Richtigkeit jedes Eintrags geprüft", "Persönlicher Handlungsplan und fertige Schreiben zur Freigabe", "Einmalzahlung per Überweisung — kein Abo, keine Erfolgsbeteiligung"],
  fragenTitel: "Häufige Fragen zur Bonitätsauskunft",
  fragen: [
    { f: "Ist eine Bonitätsauskunft wirklich kostenlos möglich?", a: "Ja. Die Datenkopie nach Art. 15 DSGVO ist gesetzlich kostenlos — bei jeder Auskunftei, in der Schweiz nach Art. 25 DSG. Sie enthält alle gespeicherten Daten samt Meldedatum und meldender Stelle. Kostenpflichtig ist bei den Auskunfteien nur das Bonitätszertifikat zum Weitergeben — und bei FIAON die Arbeit drumherum: anfordern bei den großen Auskunfteien Ihres Landes, jede Zeile erklären, Fristen prüfen, Handlungsplan und fertige Schreiben." },
    { f: "Was kostet die Bonitätsauskunft über FIAON?", a: "Einmalig 149 €. Mit einem laufenden FIAON-Paket zahlen Sie den Kundenpreis von 74 €. Für Unternehmen: 349 € einzeln, 199 € mit Paket. Darin enthalten: die Anforderung Ihrer Datenkopien bei den großen Auskunfteien Ihres Landes, die Erklärung jeder Zeile, die Prüfung der Speicherfristen, Ihr Handlungsplan und fertige Schreiben zur Freigabe. Kein Abo, keine Erfolgsbeteiligung — seriöse Arbeit rechnet nicht pro „gelöschtem Eintrag“ ab." },
    { f: "Wie lange dauert es, bis ich meine Auskunft habe?", a: "Die Bestellung dauert wenige Minuten. Die Auskunfteien haben für die Datenkopie gesetzlich in der Regel einen Monat Zeit, oft geht es schneller. Sobald die Kopien vorliegen, erklären und prüfen wir sie und legen Handlungsplan und Schreiben in Ihren Kundenbereich." },
    { f: "Was ist der Unterschied zwischen Datenkopie und Bonitätszertifikat?", a: "Die Datenkopie ist für SIE: vollständig, mit jedem Eintrag und jedem Detail — und kostenlos. Das Bonitätszertifikat der Auskunfteien ist für DRITTE (z. B. Vermieter): gekürzt, dafür zum Vorzeigen gedacht und kostenpflichtig. Wer seine Lage verstehen und angehen will, braucht die Datenkopie." },
    { f: "Sieht die SCHUFA, dass ich eine Auskunft beantrage?", a: "Die Eigenauskunft ist neutral: Sie wird nicht als Anfrage gespeichert, die andere Banken sehen, und sie verändert Ihren Score nicht. Das gilt auch, wenn FIAON sie in Ihrem Auftrag für Sie anfordert." },
    { f: "Gilt das auch für Österreich und die Schweiz?", a: "Ja. In Deutschland fordern wir bei SCHUFA, CRIF und Creditreform Boniversum an, in Österreich bei KSV1870 und CRIF, in der Schweiz bei CRIF und Intrum. In Österreich gilt die DSGVO unmittelbar, die Schweiz kennt mit dem revidierten DSG eigene Auskunfts- und Berichtigungsrechte (Art. 25 DSG)." },
    { f: "Gibt es die Bonitätsauskunft auch für Unternehmen?", a: "Ja. Für Unternehmen fordern wir die Firmendaten bei den Wirtschaftsauskunfteien an (u. a. Creditreform und CRIF) und dazu die persönliche Datenkopie der Inhaberin, des Inhabers oder der Geschäftsführung. Jeder Eintrag wird erklärt, dazu Handlungsplan und fertige Schreiben. Sie kostet 349 € einzeln und 199 € mit laufendem FIAON-Paket." },
    { f: "Kann FIAON zusagen, dass Einträge gelöscht werden?", a: "Nein — und niemand kann das seriös. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf. Was FIAON leistet: jeden Eintrag gegen die gesetzlichen Voraussetzungen halten und für das, was angreifbar ist, die Schreiben fertig machen. Ob gelöscht wird, entscheidet die Auskunftei. Anbieter, die eine Löschung versprechen, erkennen Sie als unseriös." },
  ],
  weiterlesen: "Weiterlesen: ", weiterLinks: [
    { href: "/schufa-score-verstehen", t: "Was der Score bedeutet" }, { href: "/selbstauskunft-checkliste", t: "Selbstauskunft richtig lesen" },
    { href: "/auskunfteien", t: "SCHUFA, KSV und CRIF im Überblick" }, { href: "/preise", t: "alle FIAON-Pakete" },
  ],
  fussSatz: "Stand September 2026 — keine Rechtsberatung im Einzelfall.",
  aufrufTitel: "Wenige Minuten bestellen, dann arbeitet FIAON.",
  aufrufSatz: (einzeln: string, mitPaket: string) => `Datenkopien aller Auskunfteien Ihres Landes, jede Zeile erklärt, Fristen geprüft, Handlungsplan und fertige Schreiben — einmalig ${einzeln}, mit laufendem FIAON-Paket ${mitPaket}.`,
  aufrufFuss: "FIAON ist keine Rechtsberatung und verspricht keine Löschung berechtigter Einträge. Über Konto, Karte und Rahmen entscheidet immer die Bank.",
  kartenbildAlt: "Die FIAON-Karte auf dunklem Grund mit blauem Leuchtring",
  // ── E-241: Gestaltung der Seitenfamilie ─────────────────────────────────
  krumeFamilie: "Bonitätsauskunft",
  preisZeileEinmal: "einmalig · kein Abo",
  schlussPille: "Einmalig · kein Abo",
  leisteWas: "Bonitätsauskunft",
  leistePaket: (mitPaket: string) => `mit Paket ${mitPaket}`,
  leisteKnopf: "Bestellen",
  familieSatz: "Mehr zur Bonitätsauskunft: ",
  familieLinks: [
    { href: "/bonitaetsauskunft", t: "Übersicht" }, { href: "/bonitaetsauskunft/ablauf", t: "Ablauf" },
    { href: "/bonitaetsauskunft/handlungsplan", t: "Handlungsplan" }, { href: "/bonitaetsauskunft/fragen", t: "alle Fragen" },
  ] as { href: string; t: string }[],
};
const en: typeof de = {
  metaTitel: "Requesting your credit report: free or with FIAON",
  metaBeschreibung: "Requesting your credit report: the free route under Art. 15 GDPR and the FIAON credit report with an action plan compared — every credit bureau in your country.",
  seoTitel: "Requesting your credit report: both routes | FIAON",
  seoBeschreibung: "Requesting your credit report: the free route under Art. 15 GDPR and the FIAON credit report with an action plan compared — every credit bureau in your country.",
  krume: "Requesting your credit report",
  ldName: "FIAON credit report with action plan",
  ldArt: "Requesting and explaining credit reports from every credit bureau in the country (Germany, Austria, Switzerland)",
  ldFirma: "FIAON credit report for companies",
  pille: "Two routes, full clarity", h1a: "Requesting your credit report — ", h1b: "free or with FIAON.",
  lead: (einzeln: string, mitPaket: string) => `You are legally entitled to your data copy free of charge — we say that first. The FIAON credit report is for everyone who wants to hand over requesting it, the plain-language explanation and the deadline check: ${einzeln} one-off, ${mitPaket} with a running FIAON plan, no subscription.`,
  antragStarten: "Order the credit report", kostenlosPruefen: "Have it checked for free", fuerFirmen: "For companies",
  vergleichTitel: "Request it yourself or have it requested?", vergleichLead: "Both lead to the report. The difference is who does the work — and who understands the entries.",
  kopf: ["", "Self-disclosure (Art. 15 GDPR)", "FIAON credit report"],
  preisZeile: (einzeln: string, mitPaket: string) => ["Price", "€0 — a legal right", `${einzeln} one-off · ${mitPaket} with a plan`],
  zeilen: [
    ["Requesting", "you write to each bureau separately", "FIAON requests from every credit bureau in your country — with your authorisation"],
    ["Form", "raw data, jargon, abbreviations", "every line explained in plain language"],
    ["Check", "you do it yourself (our tools help for free)", "storage periods and accuracy of every entry checked"],
    ["Afterwards", "draft letters yourself, track deadlines yourself", "action plan and finished letters — you approve, we send"],
    ["For whom", "time and calm to get into it", "clarity, without working through sections of law"],
  ],
  gratisA: "Our tools prepare the free route free of charge: ", gratisLink1: "request self-disclosure", gratisB: " and ", gratisLink2: "check an entry", gratisC: ". Anyone who offers both and conceals the free route is selling you your own right.",
  leistungTitel: "What you receive — by country",
  leistungLead: "We request from every credit bureau in your country. For companies there is a separate version covering the company's data.",
  laender: { DE: "Germany", AT: "Austria", CH: "Switzerland" },
  arten: { privat: "For me personally", firma: "For my company" },
  leistung: (art: AuskunftArt, _land: AuskunftLand, bei: string) => art === "privat"
    ? [
      `We request your data copies from ${bei} — with your authorisation, you do not have to write a single letter.`,
      "We explain every entry in plain language and check whether storage periods have expired.",
      "Your personal action plan: what you can do, and in which order.",
      "Finished letters (for example deletion after the storage period, correction of wrong data) — you approve, we send.",
      "Your contact person goes through the results with you and aligns your route to a card and a limit accordingly.",
    ]
    : [
      "We request your company's data from the business credit bureaus (including Creditreform and CRIF) — with your authorisation.",
      `Plus the personal data copy of the owner or the managing director from ${bei}.`,
      "We explain every entry and check deadlines as well as wrong or outdated company data.",
      "Your action plan for the company: what you can do, and in which order.",
      "Finished letters for correction and deletion — you approve, we send.",
    ],
  leistungPreis: (preis: string, mitPaket: string) => `${preis} one-off · ${mitPaket} with a running FIAON plan`,
  ablaufTitel: "How it works", ablaufLead: "Four stages — you see each of them in your customer area.",
  ablauf: [
    { dauer: "a few minutes", titel: "Order and give your authorisation", text: "Name, address, date of birth — the credit bureaus need no more to identify you reliably. With your authorisation we may request the data copies for you." },
    { dauer: "usually up to one month", titel: "FIAON requests the data copies", text: "We request your data copies from every credit bureau in your country. By law the bureaus usually have one month — often it is faster. You need do nothing." },
    { dauer: "as soon as they arrive", titel: "Explanation and deadline check", text: "Every line is explained in plain language and checked: lawfully reported? Storage period expired? Factually correct? You see the result in your customer area." },
    { dauer: "afterwards", titel: "Action plan and finished letters", text: "Your action plan says what you can do, and in which order. The letters — for example deletion after the storage period or correction of wrong data — are ready: you approve, we send. The bank decides on account and card." },
  ],
  erhaltenTitel: "What your result looks like", erhaltenLead: "Not a graveyard of numbers but a reviewed overview with the next step.",
  dokumentAria: "Example representation of the FIAON analysis: three entries with assessment", dokumentTitel: "FIAON analysis", dokumentBeispiel: "Example",
  dokumentZeilen: [
    ["Current account, held since 2019", "Positive feature", "gruen"], ["Instalment loan, serviced as agreed", "Positive feature", "gruen"],
    ["Mobile phone claim, €214, settled 2022", "Check deadline — letter ready", "gelb"], ["SCHUFA score (100–999)", "explained in the report", ""],
  ],
  preisTitel: "Two prices, no surprises", preisEinmalig: " one-off",
  preisMitPaket: (mitPaket: string) => `With a running FIAON plan: ${mitPaket}`,
  preisFirma: (einzeln: string, mitPaket: string) => `For companies: ${einzeln} on its own, ${mitPaket} with a plan`,
  preisSteuer: "Final prices including any applicable VAT.",
  preisZeilen: ["Data copies from every credit bureau in your country — with your authorisation", "Every line explained in plain language", "Storage periods and accuracy of every entry checked", "Personal action plan and finished letters for your approval", "One-off payment by bank transfer — no subscription, no success fee"],
  fragenTitel: "Frequently asked questions about the credit report",
  fragen: [
    { f: "Is a credit report really possible free of charge?", a: "Yes. The data copy under Art. 15 GDPR is free by law — at every credit bureau, in Switzerland under Art. 25 DSG. It contains all stored data including reporting date and reporting body. What the bureaus charge for is only the credit certificate to pass on — and what FIAON charges for is the work around it: requesting from every bureau in your country, explaining every line, checking deadlines, an action plan and finished letters." },
    { f: "What does the credit report via FIAON cost?", a: "€149 one-off. With a running FIAON plan you pay the customer price of €74. For companies: €349 on its own, €199 with a plan. Included: requesting your data copies from every credit bureau in your country, explaining every line, checking the storage periods, your action plan and finished letters for your approval. No subscription, no success fee — serious work does not charge per “deleted entry”." },
    { f: "How long until I have my report?", a: "Ordering takes a few minutes. By law the credit bureaus usually have one month for the data copy, often it is faster. As soon as the copies arrive, we explain and check them and put the action plan and letters in your customer area." },
    { f: "What is the difference between a data copy and a credit certificate?", a: "The data copy is for YOU: complete, with every entry and every detail — and free. The credit bureaus' credit certificate is for THIRD PARTIES (landlords, say): abridged, meant for showing, and paid. Anyone who wants to understand and tackle their situation needs the data copy." },
    { f: "Does SCHUFA see that I am requesting a report?", a: "Self-disclosure is neutral: it is not stored as an enquiry that other banks see, and it does not change your score. That also applies when FIAON requests it for you with your authorisation." },
    { f: "Does this also apply in Austria and Switzerland?", a: "Yes. In Germany we request from SCHUFA, CRIF and Creditreform Boniversum, in Austria from KSV1870 and CRIF, in Switzerland from CRIF and Intrum. In Austria the GDPR applies directly, Switzerland has its own rights of access and rectification under the revised DSG (Art. 25 DSG)." },
    { f: "Is the credit report also available for companies?", a: "Yes. For companies we request the company's data from the business credit bureaus (including Creditreform and CRIF) plus the personal data copy of the owner or the managing director. Every entry is explained, with an action plan and finished letters. It costs €349 on its own and €199 with a running FIAON plan." },
    { f: "Can FIAON promise that entries will be deleted?", a: "No — and nobody can, seriously. Justified, lawfully reported entries stay until the deadline expires. What FIAON does: hold every entry against the legal requirements and prepare the letters for whatever can be challenged. Whether an entry is deleted is decided by the credit bureau. You can recognise providers who promise deletion as not serious." },
  ],
  weiterlesen: "Read on: ", weiterLinks: [
    { href: "/schufa-score-verstehen", t: "what the score means" }, { href: "/selbstauskunft-checkliste", t: "reading your self-disclosure correctly" },
    { href: "/auskunfteien", t: "SCHUFA, KSV and CRIF at a glance" }, { href: "/preise", t: "all FIAON plans" },
  ],
  fussSatz: "As of September 2026 — no legal advice in individual cases.",
  aufrufTitel: "A few minutes to order, then FIAON gets to work.",
  aufrufSatz: (einzeln: string, mitPaket: string) => `Data copies from every credit bureau in your country, every line explained, deadlines checked, an action plan and finished letters — ${einzeln} one-off, ${mitPaket} with a running FIAON plan.`,
  aufrufFuss: "FIAON is not legal advice and does not promise the deletion of justified entries. The bank always decides on account, card and limit.",
  kartenbildAlt: "The FIAON card on a dark background with a blue ring of light",
  // E-241: the page family /bonitaetsauskunft exists in German only — no family links here.
  krumeFamilie: "Credit report",
  preisZeileEinmal: "one-off · no subscription",
  schlussPille: "One-off · no subscription",
  leisteWas: "Credit report",
  leistePaket: (mitPaket: string) => `${mitPaket} with a plan`,
  leisteKnopf: "Order",
  familieSatz: "",
  familieLinks: [],
};
export const BONITAETSAUSKUNFT_WOERTER = { de, en };
