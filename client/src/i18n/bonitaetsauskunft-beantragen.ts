// /bonitaetsauskunft-beantragen · /en/request-your-credit-report — Wörterbuch (02.09.2026)
// Beide Sprachen Schlüssel für Schlüssel. Der FAQ-Generator teilt an „const en".
//
// 24.09.2026 (E-240): zwei Preise (149 € einzeln, 74 € mit laufendem FIAON-Paket;
// Unternehmen 349/199 €). Preise und die deutsche Leistungsliste kommen aus
// shared/fiaon-auskunft.ts und werden von der Seite als Argument hereingereicht.
// NUR die FAQ tragen die Preise als Text: Der FAQ-Generator
// (scripts/seo-fragen-erzeugen.ts) liest ausschließlich reine Zeichenketten —
// bei einem Preiswechsel dort mitziehen.
//
// 14.10.2026 (E-365): Das Produkt hinter 149/74 € ist die FIAON-Bonitätsauswertung
// — Ihre Bonität aus Sicht einer Bank, aus Ausweis und Kontoauszügen. FIAON
// fordert bei keiner Auskunftei mehr an. Die Seite bleibt das Suchziel
// „Bonitätsauskunft beantragen" und sagt ehrlich: Die Datenkopie beantragen Sie
// kostenlos selbst — die Bonitätsauswertung ist etwas anderes. Die Firmen-Auskunft
// (349/199 €) ist unverändert.
// Das Gratisrecht steht weiter vorne: Wer den kostenlosen Weg verschweigt,
// wirkt wie die Anbieter, vor denen wir warnen.
//
// 25.09.2026 (E-241): Die Seite trägt die Gestaltung der Seitenfamilie
// /bonitaetsauskunft (Kopf, Preiszeile, Abschluss, Kaufleiste am Handy) und
// verweist in sie (schlussPille … familieLinks).
import {
  AUSWERTUNG_KEINE_AUSKUNFT_SATZ, auskunftLeistung, type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { auskunftLeistungszeit } from "@shared/fiaon-auskunft-widerruf";
import { BX_INKLUSIVE_NEU } from "@/i18n/bonitaetsauskunft-familie";

const de = {
  metaTitel: "Bonitätsauskunft beantragen oder Bonitätsauswertung?",
  metaBeschreibung: "Bonitätsauskunft kostenlos beantragen (Art. 15 DSGVO) — und was die FIAON-Bonitätsauswertung aus Ihren Kontoauszügen zeigt: Ihre Bonität aus Bankensicht.",
  seoTitel: "Bonitätsauskunft oder Bonitätsauswertung? | FIAON",
  seoBeschreibung: "Bonitätsauskunft kostenlos beantragen (Art. 15 DSGVO) — und was die FIAON-Bonitätsauswertung aus Ihren Kontoauszügen zeigt: Ihre Bonität aus Bankensicht.",
  krume: "Bonitätsauskunft beantragen",
  ldName: "FIAON-Bonitätsauswertung",
  ldArt: "Bonitätsauswertung aus eigenen Kontoauszügen (Deutschland, Österreich, Schweiz) — keine Auskunft einer Auskunftei",
  ldFirma: "FIAON-Bonitätsauskunft für Unternehmen",
  pille: "Zwei Wege, volle Klarheit", h1a: "Bonitätsauskunft kostenlos beantragen — ", h1b: "und Ihre Bonität mit FIAON auswerten.",
  lead: (einzeln: string, mitPaket: string) => `Ihre Datenkopie steht Ihnen bei jeder Auskunftei kostenlos zu — das sagen wir zuerst, und Sie fordern sie selbst an. Die FIAON-Bonitätsauswertung ist etwas anderes: Ihre Bonität aus Sicht einer Bank, aus Ihren eigenen Kontoauszügen — einmalig ${einzeln}, mit laufendem FIAON-Paket ${mitPaket}, kein Abo.`,
  antragStarten: "Bonitätsauswertung bestellen", kostenlosPruefen: "Erst Fragen stellen", fuerFirmen: "Für Unternehmen",
  vergleichTitel: "Datenkopie oder Bonitätsauswertung?", vergleichLead: "Beides hat seinen Platz. Die Datenkopie zeigt, was Auskunfteien gespeichert haben. Die Bonitätsauswertung zeigt, was eine Bank aus Ihren Kontoauszügen liest.",
  kopf: ["", "Datenkopie (Art. 15 DSGVO)", "FIAON-Bonitätsauswertung"],
  preisZeile: (einzeln: string, mitPaket: string) => ["Preis", "0 € — gesetzliches Recht", `${einzeln} einmalig · mit Paket ${mitPaket}`],
  zeilen: [
    ["Woher", "von der Auskunftei — Sie fordern sie selbst an", "aus Ihrem Ausweis und Ihren Kontoauszügen der letzten drei Monate"],
    ["Was drinsteht", "gespeicherte Einträge, Meldedaten, Score", "Haushaltsrechnung, die neun Merkmale einer Kreditprüfung, jede Ausgabe nach Empfänger"],
    ["Einordnung", "machen Sie selbst (unsere Werkzeuge helfen kostenlos)", "Ampel für sieben Bereiche und Ihr FIAON-Finanzwert"],
    ["Danach", "Sie entscheiden selbst, was Sie tun", "Ihr Potenzial und Ihr Plan für zwölf Monate — ein Mensch prüft und gibt frei"],
    ["Für wen", "alle, die wissen wollen, was gespeichert ist", "alle, die sehen wollen, was eine Bank bei einer Kreditprüfung sieht"],
  ] as string[][],
  gratisA: "Den Gratisweg bereiten unsere Werkzeuge kostenlos vor: ", gratisLink1: "Selbstauskunft anfordern", gratisB: " und ", gratisLink2: "Eintrag prüfen", gratisC: ". Wer beides anbietet und den Gratisweg verschweigt, verkauft Ihnen Ihr eigenes Recht.",
  // ── WAS GELIEFERT WIRD, JE LAND UND ART ─────────────────────────────────
  leistungTitel: "Was Sie bekommen",
  leistungLead: "Die Bonitätsauswertung ist in Deutschland, Österreich und der Schweiz dieselbe. Für Unternehmen gibt es eine eigene Bonitätsauskunft mit den Firmendaten.",
  laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" } as Record<AuskunftLand, string>,
  arten: { privat: "Für mich privat", firma: "Für mein Unternehmen" } as Record<AuskunftArt, string>,
  // Deutsch: wörtlich die eine Liste aus shared/fiaon-auskunft.ts. Die dritte
  // Angabe (Auskunfteien als Satzteil) braucht nur die englische Fassung der Firmen-Auskunft.
  leistung: (art: AuskunftArt, land: AuskunftLand, _bei: string) => auskunftLeistung(art, land),
  leistungPreis: (preis: string, mitPaket: string) => `${preis} einmalig · mit laufendem FIAON-Paket ${mitPaket}`,
  // E-365: unter der privaten Liste — die ehrliche Abgrenzung, wörtlich aus der einen Quelle.
  keineAuskunft: AUSWERTUNG_KEINE_AUSKUNFT_SATZ,
  ablaufTitel: "So läuft es ab", ablaufLead: "Vier Schritte — den Stand sehen Sie in Ihrem FIAON-Bereich.",
  ablauf: [
    { dauer: "wenige Minuten", titel: "Bestellen", text: "Name, Anschrift, Geburtsdatum, E-Mail und Telefon — dann öffnet sich Ihre Zahlungsseite. Einmalig, kein Abo." },
    { dauer: "nach der Bestellung", titel: "Hochladen", text: "Ausweis und Kontoauszüge der letzten drei Monate — per Link, ohne Anmeldung. Ihre kostenlose Datenkopie laden Sie gern dazu." },
    { dauer: "sobald alles vorliegt", titel: "Wir entwickeln", text: "Ihr FIAON-Team wertet jede Buchung aus; ein Mensch prüft den Bericht und gibt ihn frei. Bei keiner Auskunftei wird etwas angefragt." },
    { dauer: "nach der Freigabe", titel: "Sie erhalten", text: "Rund 25 Seiten als PDF per E-Mail und in Ihrem FIAON-Bereich. Über Konto und Karte entscheidet die Bank." },
  ],
  erhaltenTitel: "So sieht Ihr Ergebnis aus", erhaltenLead: "Kein Zahlenfriedhof, sondern eine geprüfte Übersicht mit dem nächsten Schritt.",
  dokumentAria: "Beispielhafte Darstellung der FIAON-Bonitätsauswertung: vier Bereiche mit Einordnung", dokumentTitel: "FIAON-Bonitätsauswertung", dokumentBeispiel: "Beispieldarstellung",
  dokumentZeilen: [
    ["Einnahmen, regelmäßig", "stabil", "gruen"], ["Wohnen und Energie", "passt zum Einkommen", "gruen"],
    ["Verträge und Abos", "Potenzial: 29 € im Monat", "gelb"], ["FIAON-Finanzwert", "im Bericht erklärt", ""],
  ] as string[][],
  preisTitel: "Zwei Preise, keine Überraschungen", preisEinmalig: " einmalig",
  preisMitPaket: (mitPaket: string) => `Mit laufendem FIAON-Paket: ${mitPaket}`,
  preisFirma: (einzeln: string, mitPaket: string) => `Bonitätsauskunft für Unternehmen: ${einzeln} einzeln, ${mitPaket} mit Paket`,
  // E-365: für neue Paketkunden enthalten — unter den Preisen.
  preisNeuKunden: BX_INKLUSIVE_NEU,
  // PAngV § 6 (Fernabsatz): neben dem Preis sagen, dass die Steuer drin ist — wortgleich
  // mit AGB § 5 Abs. 1 und der Bestellseite (client/src/i18n/bonitaet-antrag.ts, PREIS_STEUER).
  preisSteuer: "Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer.",
  preisZeilen: ["Ihre Bonität aus Sicht einer Bank — aus Ihren eigenen Kontoauszügen", "Haushaltsrechnung und die neun Merkmale einer Kreditprüfung", "Jede Ausgabe nach Empfänger, Ampel und FIAON-Finanzwert", "Ihr Potenzial und Ihr Plan für zwölf Monate", "Einmalzahlung per Überweisung — kein Abo, keine Erfolgsbeteiligung"],
  fragenTitel: "Häufige Fragen: Bonitätsauskunft und Bonitätsauswertung",
  fragen: [
    { f: "Ist eine Bonitätsauskunft wirklich kostenlos möglich?", a: "Ja. Die Datenkopie nach Art. 15 DSGVO ist gesetzlich kostenlos — bei jeder Auskunftei, in der Schweiz nach Art. 25 DSG. Sie enthält alle gespeicherten Daten samt Meldedatum und meldender Stelle. Sie fordern sie selbst an; unser Generator schreibt Ihnen den Brief. Kostenpflichtig ist bei den Auskunfteien nur das Bonitätszertifikat zum Weitergeben." },
    { f: "Was ist die FIAON-Bonitätsauswertung?", a: "Ihre Bonität aus Sicht einer Bank — aus Ihren eigenen Kontoauszügen. Rund 25 Seiten: Haushaltsrechnung und die neun Merkmale einer Kreditprüfung, jede Einnahme und Ausgabe nach Empfänger, eine Ampel für sieben Bereiche, Ihr FIAON-Finanzwert, Ihr Potenzial und Ihr Plan für zwölf Monate. Die Bonitätsauswertung ist keine Auskunft einer Auskunftei und kein Score. Ihre kostenlose Datenkopie können Sie jederzeit selbst anfordern — laden Sie sie hoch, beziehen wir sie ein." },
    { f: "Was kostet die Bonitätsauswertung?", a: "Einmalig 149 €. Mit einem laufenden FIAON-Paket zahlen Sie den Kundenpreis von 74 €. Für neue Paketkunden ist die Bonitätsauswertung im Paket enthalten — sie ist der Schritt vor dem Link unserer Partnerbank für Ihren Kartenantrag. Kein Abo, keine Erfolgsbeteiligung." },
    { f: "Was muss ich dafür tun?", a: "Nach der Bestellung bekommen Sie einen Link und laden Ihren Ausweis und Ihre Kontoauszüge der letzten drei Monate hoch — ohne Anmeldung. Bei keiner Auskunftei wird etwas angefragt." },
    { f: "Wie lange dauert es, bis ich meine Bonitätsauswertung habe?", a: `Die Bestellung dauert wenige Minuten. ${auskunftLeistungszeit("privat")}` },
    { f: "Was ist der Unterschied zwischen Datenkopie und Bonitätszertifikat?", a: "Die Datenkopie ist für SIE: vollständig, mit jedem Eintrag und jedem Detail — und kostenlos. Das Bonitätszertifikat der Auskunfteien ist für DRITTE (z. B. Vermieter): gekürzt, dafür zum Vorzeigen gedacht und kostenpflichtig. Wer wissen will, was gespeichert ist, braucht die Datenkopie." },
    { f: "Sieht die SCHUFA, dass ich eine Auskunft beantrage?", a: "Die Eigenauskunft ist neutral: Sie wird nicht als Anfrage gespeichert, die andere Banken sehen, und sie verändert Ihren Score nicht. Die FIAON-Bonitätsauswertung fragt ohnehin bei keiner Auskunftei an." },
    { f: "Gilt das auch für Österreich und die Schweiz?", a: "Ja. Ihre kostenlose Datenkopie fordern Sie in Deutschland bei SCHUFA, CRIF und Creditreform Boniversum an, in Österreich bei KSV1870 und CRIF, in der Schweiz bei CRIF und Intrum. In Österreich gilt die DSGVO unmittelbar, die Schweiz kennt mit dem revidierten DSG eigene Auskunftsrechte (Art. 25 DSG). Die Bonitätsauswertung ist in allen drei Ländern dieselbe." },
    { f: "Gibt es die Bonitätsauskunft auch für Unternehmen?", a: "Ja. Für Unternehmen fordern wir die Firmendaten bei den Wirtschaftsauskunfteien an (u. a. Creditreform und CRIF) und dazu die persönliche Datenkopie der Inhaberin, des Inhabers oder der Geschäftsführung. Jeder Eintrag wird erklärt, dazu Handlungsplan und fertige Schreiben. Sie kostet 349 € einzeln und 199 € mit laufendem FIAON-Paket." },
    { f: "Kann FIAON zusagen, dass Einträge gelöscht werden?", a: "Nein — und niemand kann das seriös. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf; ob gelöscht wird, entscheidet die Auskunftei. Die Bonitätsauswertung ändert an Einträgen nichts — sie zeigt, was in Ihrer Hand liegt. Anbieter, die eine Löschung versprechen, erkennen Sie als unseriös." },
  ],
  weiterlesen: "Weiterlesen: ", weiterLinks: [
    { href: "/schufa-score-verstehen", t: "Was der Score bedeutet" }, { href: "/selbstauskunft-checkliste", t: "Selbstauskunft richtig lesen" },
    { href: "/auskunfteien", t: "SCHUFA, KSV und CRIF im Überblick" }, { href: "/preise", t: "alle FIAON-Pakete" },
  ],
  fussSatz: "Stand Oktober 2026 — keine Rechtsberatung im Einzelfall.",
  aufrufTitel: "Wenige Minuten bestellen, dann arbeitet FIAON.",
  aufrufSatz: (einzeln: string, mitPaket: string) => `Ihre Bonität aus Sicht einer Bank: Haushaltsrechnung, jede Ausgabe nach Empfänger, Ampel, FIAON-Finanzwert und Ihr Plan für zwölf Monate — einmalig ${einzeln}, mit laufendem FIAON-Paket ${mitPaket}.`,
  aufrufFuss: `${AUSWERTUNG_KEINE_AUSKUNFT_SATZ} Über Konto, Karte und Rahmen entscheidet immer die Bank.`,
  kartenbildAlt: "Die FIAON-Karte auf dunklem Grund mit blauem Leuchtring",
  // ── E-241: Gestaltung der Seitenfamilie ─────────────────────────────────
  krumeFamilie: "Bonitätsauswertung",
  preisZeileEinmal: "einmalig · kein Abo",
  schlussPille: "Einmalig · kein Abo",
  leisteWas: "Bonitätsauswertung",
  leistePaket: (mitPaket: string) => `mit Paket ${mitPaket}`,
  leisteKnopf: "Bestellen",
  familieSatz: "Mehr zur Bonitätsauswertung: ",
  familieLinks: [
    { href: "/bonitaetsauskunft", t: "Übersicht" }, { href: "/bonitaetsauskunft/ablauf", t: "Ablauf" },
    { href: "/bonitaetsauskunft/handlungsplan", t: "Ihr Plan" }, { href: "/bonitaetsauskunft/fragen", t: "alle Fragen" },
  ] as { href: string; t: string }[],
};
const en: typeof de = {
  metaTitel: "Credit report or credit assessment? Both routes",
  metaBeschreibung: "Request your credit report free of charge under Art. 15 GDPR — and what the FIAON credit assessment shows from your bank statements: your credit as a bank sees it.",
  seoTitel: "Credit report or credit assessment? | FIAON",
  seoBeschreibung: "Request your credit report free of charge under Art. 15 GDPR — and what the FIAON credit assessment shows from your bank statements: your credit as a bank sees it.",
  krume: "Requesting your credit report",
  ldName: "FIAON credit assessment",
  ldArt: "Credit assessment from your own bank statements (Germany, Austria, Switzerland) — not a credit bureau report",
  ldFirma: "FIAON credit report for companies",
  pille: "Two routes, full clarity", h1a: "Requesting your credit report for free — ", h1b: "and assessing your credit with FIAON.",
  lead: (einzeln: string, mitPaket: string) => `You are legally entitled to your data copy from every credit bureau free of charge — we say that first, and you request it yourself. The FIAON credit assessment is something else: your creditworthiness as a bank sees it, from your own bank statements — ${einzeln} one-off, ${mitPaket} with a running FIAON plan, no subscription.`,
  antragStarten: "Order the credit assessment", kostenlosPruefen: "Ask us first", fuerFirmen: "For companies",
  vergleichTitel: "Data copy or credit assessment?", vergleichLead: "Both have their place. The data copy shows what credit bureaus have stored. The credit assessment shows what a bank reads from your bank statements.",
  kopf: ["", "Data copy (Art. 15 GDPR)", "FIAON credit assessment"],
  preisZeile: (einzeln: string, mitPaket: string) => ["Price", "€0 — a legal right", `${einzeln} one-off · ${mitPaket} with a plan`],
  zeilen: [
    ["Source", "the credit bureau — you request it yourself", "your ID and your bank statements for the last three months"],
    ["Contents", "stored entries, reporting dates, score", "household budget, the nine criteria of a credit check, every expense by payee"],
    ["Assessment", "you do it yourself (our tools help for free)", "a traffic light for seven areas and your FIAON financial score"],
    ["Afterwards", "you decide yourself what to do", "your potential and your twelve-month plan — a person checks and releases it"],
    ["For whom", "everyone who wants to know what is stored", "everyone who wants to see what a bank sees in a credit check"],
  ],
  gratisA: "Our tools prepare the free route free of charge: ", gratisLink1: "request self-disclosure", gratisB: " and ", gratisLink2: "check an entry", gratisC: ". Anyone who offers both and conceals the free route is selling you your own right.",
  leistungTitel: "What you receive",
  leistungLead: "The credit assessment is the same in Germany, Austria and Switzerland. For companies there is a separate credit report covering the company's data.",
  laender: { DE: "Germany", AT: "Austria", CH: "Switzerland" },
  arten: { privat: "For me personally", firma: "For my company" },
  leistung: (art: AuskunftArt, _land: AuskunftLand, bei: string) => art === "privat"
    ? [
      "Your creditworthiness as a bank sees it: household budget and the nine criteria a credit check looks at.",
      "Every income and every expense in detail — by payee, month by month, with a traffic light for seven areas and your FIAON financial score.",
      "Your potential and your plan: what can become free each month and each year, projected over twelve months.",
      "Around 25 pages, prepared by your FIAON team from your own bank statements — a person checks the report and releases it.",
      "As a PDF by email and at any time in your FIAON area. Your contact person goes through it with you and aligns your route to a card accordingly.",
    ]
    : [
      "We request your company's data from the business credit bureaus (including Creditreform and CRIF) — with your authorisation.",
      `Plus the personal data copy of the owner or the managing director from ${bei}.`,
      "We explain every entry and check deadlines as well as wrong or outdated company data.",
      "Your action plan for the company: what you can do, and in which order.",
      "Finished letters for correction and deletion — you approve, we send.",
    ],
  leistungPreis: (preis: string, mitPaket: string) => `${preis} one-off · ${mitPaket} with a running FIAON plan`,
  keineAuskunft: "The credit assessment is not a report from a credit bureau and not a credit score. You can request your free data copy yourself at any time — upload it and we will include it.",
  ablaufTitel: "How it works", ablaufLead: "Four steps — you see the status in your FIAON area.",
  ablauf: [
    { dauer: "a few minutes", titel: "Order", text: "Name, address, date of birth, email and phone — then your payment page opens. One-off, no subscription." },
    { dauer: "after ordering", titel: "Upload", text: "Your ID and your bank statements for the last three months — via a link, no login needed. You are welcome to add your free data copy." },
    { dauer: "once everything is in", titel: "We develop it", text: "Your FIAON team assesses every transaction; a person checks the report and releases it. No credit bureau is contacted." },
    { dauer: "after release", titel: "You receive it", text: "Around 25 pages as a PDF by email and in your FIAON area. The bank decides on account and card." },
  ],
  erhaltenTitel: "What your result looks like", erhaltenLead: "Not a graveyard of numbers but a reviewed overview with the next step.",
  dokumentAria: "Example representation of the FIAON credit assessment: four areas with an assessment", dokumentTitel: "FIAON credit assessment", dokumentBeispiel: "Example",
  dokumentZeilen: [
    ["Income, regular", "stable", "gruen"], ["Housing and energy", "in line with income", "gruen"],
    ["Contracts and subscriptions", "Potential: €29 a month", "gelb"], ["FIAON financial score", "explained in the report", ""],
  ],
  preisTitel: "Two prices, no surprises", preisEinmalig: " one-off",
  preisMitPaket: (mitPaket: string) => `With a running FIAON plan: ${mitPaket}`,
  preisFirma: (einzeln: string, mitPaket: string) => `Credit report for companies: ${einzeln} on its own, ${mitPaket} with a plan`,
  preisNeuKunden: "For new plan customers the credit assessment is included in the plan — it is the step before our partner bank's link for your card application.",
  preisSteuer: "Final prices including any applicable VAT.",
  preisZeilen: ["Your creditworthiness as a bank sees it — from your own bank statements", "Household budget and the nine criteria of a credit check", "Every expense by payee, a traffic light and your FIAON financial score", "Your potential and your twelve-month plan", "One-off payment by bank transfer — no subscription, no success fee"],
  fragenTitel: "Frequently asked questions: credit report and credit assessment",
  fragen: [
    { f: "Is a credit report really possible free of charge?", a: "Yes. The data copy under Art. 15 GDPR is free by law — at every credit bureau, in Switzerland under Art. 25 DSG. It contains all stored data including reporting date and reporting body. You request it yourself; our generator writes the letter for you. What the bureaus charge for is only the credit certificate to pass on." },
    { f: "What is the FIAON credit assessment?", a: "Your creditworthiness as a bank sees it — from your own bank statements. Around 25 pages: household budget and the nine criteria of a credit check, every income and expense by payee, a traffic light for seven areas, your FIAON financial score, your potential and your twelve-month plan. The credit assessment is not a report from a credit bureau and not a credit score. You can request your free data copy yourself at any time — upload it and we will include it." },
    { f: "What does the credit assessment cost?", a: "€149 one-off. With a running FIAON plan you pay the customer price of €74. For new plan customers the credit assessment is included in the plan — it is the step before our partner bank's link for your card application. No subscription, no success fee." },
    { f: "What do I have to do?", a: "After ordering you get a link and upload your ID and your bank statements for the last three months — no login needed. No credit bureau is contacted." },
    { f: "How long until I have my credit assessment?", a: "Ordering takes a few minutes. We start as soon as your payment has arrived and your ID and bank statements are in. You receive your credit assessment as a PDF by email and in your FIAON area; the status is always visible there." },
    { f: "What is the difference between a data copy and a credit certificate?", a: "The data copy is for YOU: complete, with every entry and every detail — and free. The credit bureaus' credit certificate is for THIRD PARTIES (landlords, say): abridged, meant for showing, and paid. Anyone who wants to know what is stored needs the data copy." },
    { f: "Does SCHUFA see that I am requesting a report?", a: "Self-disclosure is neutral: it is not stored as an enquiry that other banks see, and it does not change your score. The FIAON credit assessment does not contact any credit bureau anyway." },
    { f: "Does this also apply in Austria and Switzerland?", a: "Yes. You request your free data copy in Germany from SCHUFA, CRIF and Creditreform Boniversum, in Austria from KSV1870 and CRIF, in Switzerland from CRIF and Intrum. In Austria the GDPR applies directly, Switzerland has its own rights of access under the revised DSG (Art. 25 DSG). The credit assessment is the same in all three countries." },
    { f: "Is the credit report also available for companies?", a: "Yes. For companies we request the company's data from the business credit bureaus (including Creditreform and CRIF) plus the personal data copy of the owner or the managing director. Every entry is explained, with an action plan and finished letters. It costs €349 on its own and €199 with a running FIAON plan." },
    { f: "Can FIAON promise that entries will be deleted?", a: "No — and nobody can, seriously. Justified, lawfully reported entries stay until the deadline expires; whether an entry is deleted is decided by the credit bureau. The credit assessment does not change any entry — it shows what is in your hands. You can recognise providers who promise deletion as not serious." },
  ],
  weiterlesen: "Read on: ", weiterLinks: [
    { href: "/schufa-score-verstehen", t: "what the score means" }, { href: "/selbstauskunft-checkliste", t: "reading your self-disclosure correctly" },
    { href: "/auskunfteien", t: "SCHUFA, KSV and CRIF at a glance" }, { href: "/preise", t: "all FIAON plans" },
  ],
  fussSatz: "As of October 2026 — no legal advice in individual cases.",
  aufrufTitel: "A few minutes to order, then FIAON gets to work.",
  aufrufSatz: (einzeln: string, mitPaket: string) => `Your creditworthiness as a bank sees it: household budget, every expense by payee, a traffic light, your FIAON financial score and your twelve-month plan — ${einzeln} one-off, ${mitPaket} with a running FIAON plan.`,
  aufrufFuss: "The credit assessment is not a report from a credit bureau and not a credit score. You can request your free data copy yourself at any time — upload it and we will include it. The bank always decides on account and card.",
  kartenbildAlt: "The FIAON card on a dark background with a blue ring of light",
  // E-241: the page family /bonitaetsauskunft exists in German only — no family links here.
  krumeFamilie: "Credit assessment",
  preisZeileEinmal: "one-off · no subscription",
  schlussPille: "One-off · no subscription",
  leisteWas: "Credit assessment",
  leistePaket: (mitPaket: string) => `${mitPaket} with a plan`,
  leisteKnopf: "Order",
  familieSatz: "",
  familieLinks: [],
};
export const BONITAETSAUSKUNFT_WOERTER = { de, en };
