// /werkzeuge · /en/tools — Wörterbuch des Hubs (03.09.2026). Die Werkzeugtexte selbst
// kommen aus shared/fiaon-seo-seiten.ts (SEO_WERKZEUGE / SEO_WERKZEUGE_EN). Generator teilt an „const en".
const de = {
  metaTitel: "Werkzeuge · Zwanzig kostenlose Rechner und Prüfer",
  metaBeschreibung: "Zwanzig kostenlose Werkzeuge rund um SCHUFA, Bonität und Kredit: Datenkopie anfordern, Einträge und Löschfristen prüfen, Kredit- und Umschuldungsrechner, Schulden-Check. Ohne Anmeldung, nichts wird gespeichert.",
  seoBeschreibung: "Zwanzig kostenlose Werkzeuge rund um SCHUFA, Bonität und Kredit — ohne Anmeldung, nichts wird gespeichert.",
  krume: "Werkzeuge", ldName: "FIAON Werkzeuge",
  pille: "Zwanzig Werkzeuge · kostenlos, ohne Anmeldung", h1a: "Erst wissen, ", h1b: "dann handeln.",
  lead: "Jedes Werkzeug beantwortet eine Frage, die sonst Geld oder Wochen kostet. Alles läuft in Ihrem Browser — nichts wird gespeichert.",
  gruppen: [
    { key: "eintrag", titel: "Einträge und Forderungen", satz: "Wissen, was gespeichert ist — und was davon weg kann." },
    { key: "geld", titel: "Kredit und Haushalt", satz: "Rechnen, bevor Sie unterschreiben." },
    { key: "karte", titel: "Karte und Konto", satz: "Realistisch einschätzen statt hoffen." },
  ] as { key: "eintrag" | "geld" | "karte"; titel: string; satz: string }[],
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Was kosten die FIAON-Werkzeuge?", a: "Nichts. Alle Werkzeuge sind kostenlos, verlangen keine Anmeldung und keine E-Mail-Adresse. Die Berechnungen laufen in Ihrem Browser — es wird nichts übertragen und nichts gespeichert." },
    { f: "Ersetzen die Werkzeuge eine Beratung?", a: "Nein. Sie geben eine fundierte erste Einschätzung nach den geltenden Regeln — die verbindliche Prüfung Ihres Einzelfalls leisten sie nicht. Bei ernster Überschuldung gehört der erste Weg zur kostenlosen, staatlich anerkannten Schuldnerberatung." },
    { f: "Woher stammen die Regeln in den Werkzeugen?", a: "Aus den veröffentlichten Quellen: Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 31 BDSG, Art. 15 und 17 DSGVO, § 6a PAngV, §§ 195 ff. und 500 ff. BGB, RVG für Inkassokosten sowie der Rechtsprechung von BGH und EuGH. Jedes Werkzeug nennt seine Grundlage unten auf der Seite." },
    { f: "Warum stellt FIAON das kostenlos bereit?", a: "Weil die erste Frage — was steht über mich drin, und was davon ist angreifbar? — jeder selbst beantworten können sollte. Wer danach möchte, dass jemand die Beschaffung, Prüfung und Durchsetzung übernimmt, kennt uns dann schon." },
  ],
  weiterTitel: "Die Ratgeber zu den Werkzeugen",
  weiter: [
    { href: "/inkasso-brief-erhalten", titel: "Inkasso-Brief erhalten?", text: "Der ruhige 5-Schritte-Plan: prüfen, nachrechnen, richtig reagieren." },
    { href: "/eintrag-verjaehrung", titel: "Eintrag & Verjährung", text: "Wann ein Eintrag verschwinden muss — Fristen-Checker und Tabelle." },
    { href: "/selbstauskunft-checkliste", titel: "Selbstauskunft-Checkliste", text: "Die Datenkopie liegt vor Ihnen? So lesen Sie sie richtig." },
    { href: "/glossar-bonitaet", titel: "Bonitäts-Glossar A–Z", text: "Alle Begriffe erklärt — von der Anfrage bis zur Zahlungshistorie, mit dem neuen Score seit 2026." },
  ],
  zwischenrufFett: "Die Werkzeuge zeigen, was möglich ist — FIAON setzt es durch.", zwischenruf: " Beschaffung aller Auskünfte, Prüfung jedes Eintrags, Schreiben mit Fristenlauf: ein Auftrag, ein Ansprechpartner.", zwischenrufKnopf: "So arbeitet FIAON",
};
const en: typeof de = {
  metaTitel: "Tools · Twenty free calculators and checkers",
  metaBeschreibung: "Twenty free tools on SCHUFA, credit files and loans: request your data copy, check entries and deletion deadlines, loan and consolidation calculators, debt check. No sign-up, nothing is stored.",
  seoBeschreibung: "Twenty free tools on SCHUFA, credit files and loans — no sign-up, nothing is stored.",
  krume: "Tools", ldName: "FIAON tools",
  pille: "Twenty tools · free, no sign-up", h1a: "First know, ", h1b: "then act.",
  lead: "Each tool answers a question that otherwise costs money or weeks. Everything runs in your browser — nothing is stored. Letters to German-speaking recipients are generated in German, ready to send.",
  gruppen: [
    { key: "eintrag", titel: "Entries and claims", satz: "Know what is stored — and what can go." },
    { key: "geld", titel: "Loans and household", satz: "Calculate before you sign." },
    { key: "karte", titel: "Card and account", satz: "Assess realistically instead of hoping." },
  ],
  fragenTitel: "Frequently asked questions",
  fragen: [
    { f: "What do the FIAON tools cost?", a: "Nothing. All tools are free, require no sign-up and no e-mail address. The calculations run in your browser — nothing is transmitted and nothing is stored." },
    { f: "Do the tools replace professional help?", a: "No. They give a well-founded first assessment under the applicable rules — they do not provide a binding check of your individual case. In serious over-indebtedness the first route is free, state-recognised debt counselling." },
    { f: "Where do the rules in the tools come from?", a: "From the published sources: the code of conduct of the credit bureaus (2024 version), Section 31 BDSG, Articles 15 and 17 GDPR, Section 6a PAngV, Sections 195 ff. and 500 ff. BGB, the RVG for debt collection costs and the case law of the Federal Court of Justice and the European Court of Justice. Every tool names its basis at the bottom of the page." },
    { f: "Why does FIAON provide this for free?", a: "Because the first question — what is stored about me, and what of it can be challenged? — is one everyone should be able to answer themselves. Anyone who then wants someone to take over obtaining, checking and enforcing already knows us." },
  ],
  weiterTitel: "The guides to the tools",
  weiter: [
    { href: "/inkasso-brief-erhalten", titel: "Received a debt collection letter?", text: "The calm 5-step plan: check, recalculate, react correctly." },
    { href: "/eintrag-verjaehrung", titel: "Entries and limitation periods", text: "When an entry has to disappear — deadline checker and table." },
    { href: "/selbstauskunft-checkliste", titel: "Credit report checklist", text: "The data copy is in front of you? This is how to read it correctly." },
    { href: "/glossar-bonitaet", titel: "Credit glossary A–Z", text: "Every term explained — from enquiry to payment history, with the new score since 2026." },
  ],
  zwischenrufFett: "The tools show what is possible — FIAON enforces it.", zwischenruf: " Obtaining all reports, checking every entry, letters with deadline tracking: one order, one contact.", zwischenrufKnopf: "How FIAON works",
};
export const WZ_HUB_WOERTER = { de, en };
