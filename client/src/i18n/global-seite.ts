// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE FESTEN WÖRTER DER UNTERSEITEN-VORLAGE (24.09.2026, E-234)
//
// Bis heute standen sie deutsch im JSX von client/src/pages/site/global-seite.tsx
// („Auf einen Blick", „Weiterlesen", die Fragen des Paket-Finders …). Seit es die
// Unterseiten auch englisch gibt, stehen sie hier — in beiden Sprachen, gleich
// gebaut. Die Datei folgt der Hausform der i18n-Wörterbücher („const de", dann
// „const en: typeof de"), damit scripts/seo-wortverbote-en.ts die englische Hälfte
// prüft und scripts/pruef-wortwand-de.ts die deutsche.
// „Kurz beantwortet" und „Häufige Fragen" stehen NICHT hier, sondern in
// GLOBAL_SEITE_WORTE (shared/fiaon-global-seiten/index.ts) — der Server braucht
// dieselben Wörter für den Korpus.
// ═══════════════════════════════════════════════════════════════════════════

export interface FinderFrage {
  kurz: string;
  frage: string;
  hilfe: string;
  /** Vier Antworten in der Reihenfolge der Stufen 0–3 (Global Struktur … Global VIP). */
  antworten: { titel: string; text: string }[];
}

const de = {
  krumen: "Brotkrumen",
  blick: "Auf einen Blick",
  stand: (datum: string) => `Stand ${datum}`,
  inhaltLabel: "Inhalt dieser Seite",
  inhalt: "Inhalt",
  jetzt: "Jetzt beauftragen",
  vermerkStand: "Stand:",
  vermerkRedaktion: "Redaktion:",
  vermerkKennung: "Kennung:",
  quellen: "Quellen",
  vermerkHinweis: "Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls. Die Prüfung vor der Gründung durch unseren Partner-Steuerberater ist in jedem Paket enthalten.",
  weiterlesen: "Weiterlesen",
  uebersichtTitel: "Die Übersicht",
  uebersichtText: "Pakete, Leistungen, Vertragspartner",
  rollen: { fiaon: "FIAON übernimmt", partner: "Partner übernehmen", sie: "Sie übernehmen" },
  vermerk: "Vermerk",
  alleImVergleich: "Alle Pakete und Leistungen im Vergleich",
  kapitalrahmen: "Kapitalrahmen",
  festpreisEinmalig: "Festpreis · einmalig",
  ortszeit: (stadt: string) => `Ortszeit ${stadt}`,
  zitat: (text: string) => `„${text}“`,
  finder: {
    fortschritt: "Fortschritt",
    zurueck: "Zurück",
    frageVon: (n: number, m: number) => `Frage ${n} von ${m}`,
    ergebnis: "Am ehesten passt",
    zeitKnapp: (dauer: string) => `Ihr Zeitrahmen ist knapper, als dieses Paket in der Regel braucht (${dauer}). Das besprechen wir im Gespräch ehrlich mit Ihnen.`,
    neu: "Noch einmal beginnen",
    orientierung: "Eine Orientierung — keine Zusage.",
    erstSprechen: "Erst sprechen",
    // 19.09.2026: „mit der US-Gesellschaft" statt „in den USA" — das Kapital ist nicht an die USA gebunden. Deckungsgleich mit preise.ts (Merkblatt).
    fragen: [
      { kurz: "Ziel", frage: "Was ist Ihr Ziel mit der US-Gesellschaft?", hilfe: "Wählen Sie, was dem Vorhaben am nächsten kommt.", antworten: [
        { titel: "Eine US-Gesellschaft mit Steuernummern", text: "Gründung, EIN, ITIN, Adresse — und der erste Konto- und Kartenantrag." },
        { titel: "Gesellschaft, Konto und weitere Karten", text: "Nach der ersten Karte planvoll weitere Herausgeber gewinnen." },
        { titel: "Kapital aufbauen bis zum Bankdarlehen", text: "Über mehrere Herausgeber bis zur Kennzahlen-Mappe." },
        { titel: "Alles davon — mit Auftakt vor Ort", text: "Der Aufbau persönlich in Miami, mit Terminen vor Ort." },
      ] },
      { kurz: "Kapitalrahmen", frage: "Welchen Kapitalrahmen streben Sie an?", hilfe: "Ihr Ziel — über jeden Rahmen entscheidet das Institut.", antworten: [
        { titel: "Rund 50.000 $", text: "Der Einstieg mit der ersten Karte." },
        { titel: "Rund 100.000 $", text: "Mehrere Karten in einer klugen Reihenfolge." },
        { titel: "Rund 250.000 $", text: "Über mehrere Herausgeber hinweg." },
        { titel: "Darüber hinaus", text: "Der größte Rahmen, den ein Paket begleitet." },
      ] },
      { kurz: "Zeit", frage: "Wie viel Zeit geben Sie dem Aufbau?", hilfe: "Erfahrungswerte — Behörden und Institute bestimmen ihr Tempo.", antworten: [
        { titel: "Rund acht Wochen", text: "Gründung, Steuernummern, erste Karte." },
        { titel: "Drei bis fünf Monate", text: "Zeit für die Kartenleiter." },
        { titel: "Sechs Monate und länger", text: "Zeit bis zur Kapital-Etappe." },
        { titel: "So lange, wie es braucht", text: "Mit Auftakt vor Ort und Vorrang bei Terminen." },
      ] },
      { kurz: "Begleitung", frage: "Wie möchten Sie begleitet werden?", hilfe: "Jedes Paket hat einen festen Ansprechpartner.", antworten: [
        { titel: "Digital, aus der Ferne", text: "Dokumentenraum und Ansprechpartner genügen." },
        { titel: "Mit monatlichem Durchgang", text: "Ein fester Termin im Monat mit Ihrem Ansprechpartner." },
        { titel: "Mit Vorrang bei Terminen vor Ort", text: "Unser Team in Miami nimmt Termine für Sie vorrangig wahr." },
        { titel: "Persönlich in Miami", text: "Sie sitzen selbst am Tisch — Flug und Hotel inklusive." },
      ] },
    ] as FinderFrage[],
  },
};

const en: typeof de = {
  krumen: "Breadcrumbs",
  blick: "At a glance",
  stand: (datum: string) => `As of ${datum}`,
  inhaltLabel: "On this page",
  inhalt: "Contents",
  jetzt: "Order now",
  vermerkStand: "As of:",
  vermerkRedaktion: "Editorial team:",
  vermerkKennung: "Reference:",
  quellen: "Sources",
  vermerkHinweis: "This page explains the basics and does not replace a tax or legal review of your case. The review before formation by our partner tax adviser is included in every package.",
  weiterlesen: "Read on",
  uebersichtTitel: "The overview",
  uebersichtText: "Packages, services, contracting party",
  rollen: { fiaon: "What FIAON does", partner: "What partners do", sie: "What you do" },
  vermerk: "Note",
  alleImVergleich: "Compare all packages and services",
  kapitalrahmen: "Capital range",
  festpreisEinmalig: "Fixed price · one-off",
  ortszeit: (stadt: string) => `Local time in ${stadt}`,
  zitat: (text: string) => `“${text}”`,
  finder: {
    fortschritt: "Progress",
    zurueck: "Back",
    frageVon: (n: number, m: number) => `Question ${n} of ${m}`,
    ergebnis: "The closest fit",
    zeitKnapp: (dauer: string) => `Your timeframe is tighter than this package usually needs (${dauer}). We will discuss this openly with you in the call.`,
    neu: "Start again",
    orientierung: "A pointer — not a commitment.",
    erstSprechen: "Talk first",
    fragen: [
      { kurz: "Goal", frage: "What is your goal with the US company?", hilfe: "Choose what comes closest to your plans.", antworten: [
        { titel: "A US company with tax numbers", text: "Formation, EIN, ITIN, address — and the first account and card application." },
        { titel: "Company, account and further cards", text: "After the first card, adding further issuers in a planned order." },
        { titel: "Building capital through to a bank loan", text: "Across several issuers, through to the key-figures file." },
        { titel: "All of it — with a kick-off on site", text: "The build-up in person in Miami, with appointments on site." },
      ] },
      { kurz: "Capital range", frage: "Which capital range are you aiming for?", hilfe: "Your target — the institution decides on every limit.", antworten: [
        { titel: "Around $50,000", text: "Getting started with the first card." },
        { titel: "Around $100,000", text: "Several cards in a sensible order." },
        { titel: "Around $250,000", text: "Across several issuers." },
        { titel: "Beyond that", text: "The largest range a package supports." },
      ] },
      { kurz: "Time", frage: "How much time will you give the set-up?", hilfe: "Typical experience — authorities and institutions set their own pace.", antworten: [
        { titel: "Around eight weeks", text: "Formation, tax numbers, first card." },
        { titel: "Three to five months", text: "Time for the card ladder." },
        { titel: "Six months or longer", text: "Time to reach the capital stage." },
        { titel: "As long as it takes", text: "With a kick-off on site and priority for appointments." },
      ] },
      { kurz: "Support", frage: "How would you like to be supported?", hilfe: "Every package has a dedicated contact.", antworten: [
        { titel: "Digitally, remotely", text: "The document room and your contact are enough." },
        { titel: "With a monthly review", text: "A fixed appointment each month with your contact." },
        { titel: "With priority for appointments on the ground", text: "Our team in Miami attends appointments for you with priority." },
        { titel: "In person in Miami", text: "You sit at the table yourself — flight and hotel included." },
      ] },
    ],
  },
};

export const GLOBAL_SEITE_WOERTER = { de, en };
