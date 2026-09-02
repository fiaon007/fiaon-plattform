// ═══════════════════════════════════════════════════════════════════════════
// /transparenz · /en/transparency — das Wörterbuch der Seite (02.09.2026)
// Zahlen bleiben in der Seite (eine Quelle, Stand sichtbar); hier nur Texte.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
const de = {
  metaTitel: "Transparenzbericht · Zahlen mit Definition und Stand",
  metaBeschreibung: "Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition, Stand und Herkunft. Und was noch in Messung ist.",
  seoTitel: "FIAON Transparenzbericht: Zahlen mit Definition und Stand",
  seoBeschreibung: "Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition, Stand und Herkunft. Und was noch in Messung ist.",
  krume: "Transparenzbericht", stand: "2. September 2026",
  pille: "Transparenzbericht · Stand 2. September 2026", h1a: "Zahlen, die man ", h1b: "nachrechnen kann.",
  lead: "Kein Marktteilnehmer zeigt, wie viele Kunden wirklich bezahlt haben und wie viele Raten wirklich eingegangen sind. FIAON tut es – mit Definition, Stand und Herkunft. Und sagt, was noch nicht gemessen ist.",
  dieZahlen: "Die Zahlen", soArbeitet: "So arbeitet FIAON",
  zahlenLabels: ["zahlende Kunden, bankbestätigt", "bezahlte Monatsraten", "Kunden in DE · AT · CH", "Werkzeuge · Ratgeber"],
  standSatz: (stand: string) => `Stand ${stand}, gemessen in der Datenbank der Plattform. Nächste Aktualisierung Anfang Oktober 2026.`,
  defH2a: "Jede Zahl mit ", defH2b: "Definition.", defLead: "So wird gezählt – damit Sie es nachrechnen könnten, wenn Sie die Datenbank hätten.",
  definitionen: [
    ["Zahlende Kunden", "Personen mit mindestens einer Bestellung, deren Zahlung die Bank bestätigt hat; Testkonten und zusammengeführte Dubletten ausgeschlossen. Nicht gezählt: Anmeldungen, gemeldete, aber nicht bestätigte Zahlungen."],
    ["Bezahlte Monatsraten", "Raten mit Zahlungsdatum im Bankbuch; stornierte Raten ausgeschlossen. Erste Raten per Überweisung und Folgeraten per SEPA zusammen."],
    ["Kunden nach Land", "Land der Bestellung des zahlenden Kunden. 22 Kunden ohne Landesangabe sind in der Summe enthalten, in der Länderzeile nicht."],
    ["Werkzeuge", "Kostenlose Rechner, Prüfer und Brief-Generatoren unter /werkzeuge – alle im Browser, ohne Anmeldung, nichts wird gespeichert."],
    ["Ratgeber", "Veröffentlichte Artikel unter /ratgeber, jede Zahl darin mit Quelle und Jahr."],
  ] as [string, string][],
  nordH2a: "Die vier Nordstern-Kennzahlen – ", nordH2b: "in Messung.", nordLead: "Sie messen Kundennutzen und Unternehmenswert zugleich. Veröffentlicht werden sie, sobald sie über ein Quartal belastbar sind – nicht vorher.",
  nord: [
    { tag: "Einsicht · in Messung", titel: "Zeit bis zur ersten Einsicht", text: "Von der bankbestätigten Zahlung bis zur erklärten Auskunft im Kundenbereich. Ziel: unter 24 Stunden nach Vorliegen der Auskunft. Die Messung läuft seit Juli 2026; die Auskunfteien brauchen ein bis vier Wochen, das rechnen wir getrennt aus." },
    { tag: "Aktion · in Messung", titel: "Antwortquote auf Schreiben", text: "Anteil der versendeten Löschanträge, Widersprüche und Ratenvorschläge, die eine Antwort erhalten – und wie viele davon positiv ausfallen. Erste belastbare Werte nach einem vollen Quartal Schriftwechsel." },
    { tag: "Zugang · in Messung", titel: "Graduation-Rate", text: "Anteil der Kunden, die aus dem Programm in ein Konto oder eine Finanzierung übergehen. Die Zahl, die Partnerbanken interessiert – und die erst nach zwölf Raten der ersten Kunden ehrlich ist." },
    { tag: "Ertrag · in Messung", titel: "Raten-Einzugsquote", text: "Anteil der fälligen Raten, die beim ersten Versuch eingezogen werden, und nach Begleitung durch das Team. Die Umstellung auf SEPA-Lastschrift läuft seit September 2026; die Quote wird ab dem ersten vollen Lastschrift-Quartal veröffentlicht." },
  ],
  nichtTag: "Was hier nicht steht", nichtTitel: "Und warum nicht",
  nichtText: "Keine Bewertungen – die Profile sind im Aufbau, und wir zeigen nichts, was es nicht gibt. Keine Umsätze – die stehen im Datenraum für Investoren unter NDA. Keine Einzelfälle – nur mit Freigabe der Kunden. Keine Erfolgsquote „gelöschter Einträge“ – bis die Antwortquote belastbar ist, wäre jede Zahl eine Behauptung. Wer Zahlen mit Definition sehen will, findet sie hier; wer Behauptungen sehen will, anderswo.",
  fragenTitel: "Häufige Fragen zum Bericht",
  fragen: [
    { f: "Warum veröffentlicht FIAON Kennzahlen?", a: "Weil Vertrauen prüfbar sein muss. Wer „Erfahrungen“ sucht, findet sonst nur Behauptungen. Hier stehen Zahlen mit Definition, Stand und Herkunft – und ehrlich das, was noch nicht belastbar gemessen ist." },
    { f: "Woher kommen die Zahlen?", a: "Aus der Datenbank der Plattform, mit derselben Definition, die das Chefbüro intern nutzt: zahlende Kunden nur mit bankbestätigter Zahlung und ohne Testkonten, Raten nur mit Zahlungsdatum. Abgerundet, nie geschätzt." },
    { f: "Wie oft wird aktualisiert?", a: "Alle vier Wochen, jeweils mit neuem Stand-Datum. Die vier Nordstern-Kennzahlen folgen, sobald sie über mindestens ein Quartal belastbar sind – Ziel ist ein Quartalsbericht." },
    { f: "Was veröffentlicht FIAON nicht?", a: "Keine Bewertungen, die es noch nicht gibt; keine Umsatzzahlen außerhalb des Datenraums für Investoren; keine Einzelfälle ohne Freigabe der Kunden. Und keine Zahl ohne Definition." },
  ],
  statusKnopf: "Status und Sicherheit", investorenKnopf: "Für Investoren",
};

const en: typeof de = {
  metaTitel: "Transparency report · figures with definition and date",
  metaBeschreibung: "What FIAON measures and publishes: paying customers, paid instalments, countries, tools, guides — bank-confirmed, with definition, date and source. And what is still being measured.",
  seoTitel: "FIAON transparency report: figures with definition and date",
  seoBeschreibung: "What FIAON measures and publishes: paying customers, paid instalments, countries, tools, guides — bank-confirmed, with definition, date and source. And what is still being measured.",
  krume: "Transparency report", stand: "2 September 2026",
  pille: "Transparency report · as of 2 September 2026", h1a: "Figures you can ", h1b: "check yourself.",
  lead: "No market participant shows how many customers have really paid and how many instalments have really arrived. FIAON does — with definition, date and source. And says what has not been measured yet.",
  dieZahlen: "The figures", soArbeitet: "How FIAON works",
  zahlenLabels: ["paying customers, bank-confirmed", "paid monthly instalments", "customers in DE · AT · CH", "tools · guides"],
  standSatz: (stand: string) => `As of ${stand}, measured in the platform's database. Next update at the beginning of October 2026.`,
  defH2a: "Every figure with a ", defH2b: "definition.", defLead: "This is how we count — so that you could check it if you had the database.",
  definitionen: [
    ["Paying customers", "People with at least one order whose payment the bank has confirmed; test accounts and merged duplicates excluded. Not counted: sign-ups, payments reported but not confirmed."],
    ["Paid monthly instalments", "Instalments with a payment date in the bank ledger; cancelled instalments excluded. First instalments by bank transfer and subsequent instalments by SEPA together."],
    ["Customers by country", "Country of the paying customer's order. 22 customers without a country are included in the total, not in the country row."],
    ["Tools", "Free calculators, checkers and letter generators under /werkzeuge — all in the browser, without registration, nothing is stored."],
    ["Guides", "Published articles under /ratgeber, every figure in them with source and year."],
  ],
  nordH2a: "The four north-star metrics — ", nordH2b: "being measured.", nordLead: "They measure customer benefit and company value at the same time. They are published as soon as they are reliable over a quarter — not before.",
  nord: [
    { tag: "Insight · being measured", titel: "Time to first insight", text: "From the bank-confirmed payment to the explained report in the customer area. Target: under 24 hours after the report arrives. Measurement has been running since July 2026; the credit bureaus take one to four weeks, which we calculate separately." },
    { tag: "Action · being measured", titel: "Reply rate on letters", text: "Share of deletion requests, objections and instalment proposals sent that receive a reply — and how many of them are positive. First reliable values after a full quarter of correspondence." },
    { tag: "Access · being measured", titel: "Graduation rate", text: "Share of customers who move from the programme into an account or finance. The figure partner banks are interested in — and which is only honest after the first customers' twelve instalments." },
    { tag: "Revenue · being measured", titel: "Instalment collection rate", text: "Share of due instalments collected on the first attempt, and after support from the team. The switch to SEPA direct debit has been running since September 2026; the rate will be published from the first full direct-debit quarter." },
  ],
  nichtTag: "What is not here", nichtTitel: "And why not",
  nichtText: "No reviews — the profiles are being set up, and we show nothing that does not exist. No revenue — that is in the data room for investors under NDA. No individual cases — only with the customers' approval. No success rate of “deleted entries” — until the reply rate is reliable, any figure would be a claim. Anyone who wants figures with definitions finds them here; anyone who wants claims, elsewhere.",
  fragenTitel: "Frequently asked questions about the report",
  fragen: [
    { f: "Why does FIAON publish metrics?", a: "Because trust has to be verifiable. Anyone searching for “experiences” otherwise finds only claims. Here are figures with definition, date and source — and, honestly, what has not yet been reliably measured." },
    { f: "Where do the figures come from?", a: "From the platform's database, with the same definition the management uses internally: paying customers only with bank-confirmed payment and without test accounts, instalments only with a payment date. Rounded down, never estimated." },
    { f: "How often is it updated?", a: "Every four weeks, each time with a new date. The four north-star metrics follow as soon as they are reliable over at least one quarter — the aim is a quarterly report." },
    { f: "What does FIAON not publish?", a: "No reviews that do not exist yet; no revenue figures outside the data room for investors; no individual cases without the customers' approval. And no figure without a definition." },
  ],
  statusKnopf: "Status and security", investorenKnopf: "For investors",
};

export const TRANSPARENZ_WOERTER = { de, en };
