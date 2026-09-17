// ═══════════════════════════════════════════════════════════════════════════
// /global — das Wörterbuch der Seite (15.09.2026)
//
// Neue Positionierung: FIAON Global OS — US-Entity, US-Banking, hohe
// Credit-Limits für DACH-Unternehmen. Vorerst nur Deutsch; die Struktur
// folgt i18n/business.ts, eine englische Hälfte kann später dazukommen,
// ohne die Seite anzufassen.
//
// Ton: Sie-Form, Unternehmensberatung — offensiv, aber ehrlich wie überall
// im Haus: „Ziel-Limit", „bis zu", der Kartenherausgeber entscheidet. Keine
// Limit-Garantie, keine Steuer- oder Rechtsberatung.
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  metaTitel: "FIAON Global · US-Struktur & bis zu 250.000 $ Limit",
  metaBeschreibung: "US-Unternehmensstruktur für DACH-Unternehmen: FIAON gründet Ihre US-Entity, stellt Banking und Firmeninfrastruktur — und bereitet US-Kreditkarten mit hohem Limit vor. Vier Pakete ab 2.499 € einmalig.",

  // ── Hero ──────────────────────────────────────────────────────────────
  pille: "FIAON Global",
  h1a: "Ihr Kapital. ",
  h1b: "Ohne europäische Obergrenze.",
  lead: "Lösen Sie Ihre Ad-Spends und Wareneinkäufe von den starren Limits europäischer Hausbanken. FIAON gründet Ihre US-Entity, stellt die Firmeninfrastruktur und bereitet den Zugang zu US-Kreditkarten mit hohen Limits vor — bis zu 250.000 $ Zielrahmen.",
  auditStart: "Limit-Qualifikation prüfen",
  gespraech: "Qualifikationsgespräch",
  heroPunkte: [
    "US-Entity mit EIN und eigener Geschäftsadresse",
    "Banking mit ACH, Wire und US-Routing",
    "Kartenrahmen Richtung 250.000 $",
  ],

  zahlen: [
    { wert: "250k $", label: "Ziel-Limit in der höchsten Stufe — der Herausgeber entscheidet" },
    { wert: "4", label: "Pakete — vom ersten US-Konto bis Miami vor Ort" },
    { wert: "2 Min.", label: "Limit-Qualifikation direkt auf dieser Seite" },
    { wert: "1", label: "Ansprechpartner, der Ihre Struktur kennt" },
  ],

  // ── Warum die USA ─────────────────────────────────────────────────────
  warumPille: "Warum die USA",
  warumH2a: "Europäische Banken deckeln. ",
  warumH2b: "US-Infrastruktur skaliert.",
  warumLead: "Wer in Deutschland, Österreich oder der Schweiz Werbung und Ware einkauft, kennt die Grenze: Die Firmenkarte endet bei 10.000 €, der Kontokorrent ist ausgereizt, die Hausbank redet in Quartalen. Der US-Markt bewertet Unternehmen anders — auf Umsatz und Verhalten, nicht auf Registerhistorie.",
  warum: [
    { tag: "US-Entity", titel: "Ihre eigene US-Gesellschaft", text: "LLC oder C-Corp, registriert, mit EIN des IRS und US-Geschäftsadresse. Das Fundament, auf dem US-Banken und Kartenherausgeber überhaupt mit Ihnen arbeiten." },
    { tag: "US-Banking", titel: "Konten bei US-Finanzpartnern", text: "Business-Accounts mit ACH, Wire und echten US-Routing-Nummern. Ihre Umsätze laufen durch die Infrastruktur, die die Herausgeber kennen und bewerten." },
    { tag: "US-Limits", titel: "Rahmen, der mit dem Umsatz wächst", text: "US-Kartenherausgeber vergeben Limits nach Ausgabeverhalten — nicht nach der Bilanz von 2019. Wir bereiten den Antrag vor; Karte und Limit entscheidet der Herausgeber." },
  ],

  // ── Die Struktur (drei Schichten, 3D-Glasplatten) ─────────────────────
  strukturPille: "Die Architektur",
  strukturH2a: "Eine Struktur. ",
  strukturH2b: "Drei Schichten.",
  strukturLead: "Was FIAON aufbaut, gehört Ihnen — keine Mitgliedschaft, kein Abo. Eine Unternehmensinfrastruktur in drei Ebenen.",
  strukturSchichten: ["US-Entity", "US-Banking", "US-Limit"],
  schichten: [
    { n: "01", titel: "US-Entity", text: "LLC oder C-Corp im Register, EIN des IRS, eigene US-Geschäftsadresse — die juristische Grundlage." },
    { n: "02", titel: "US-Banking", text: "Business-Accounts bei US-Finanzpartnern: ACH, Wire, Abrechnung in US-Dollar — die sichtbare Substanz." },
    { n: "03", titel: "US-Limit", text: "Der vorbereitete Antrag beim Kartenherausgeber — der Rahmen, der mit Ihrem Umsatz wächst." },
  ],

  // ── Audit-Tool ────────────────────────────────────────────────────────
  auditPille: "Werkzeug · US-Limit-Audit",
  auditH2a: "Welches US-Limit ",
  auditH2b: "steckt in Ihrem Unternehmen?",
  auditLead: "Geben Sie an, was Sie monatlich für Werbung und Ware investieren — und was Ihre Karten heute hergeben. Das Audit zeigt den Puffer, den Ihre derzeitige Struktur ungenutzt lässt, und das Paket, das dorthin führt.",
  auditWerbung: "Werbeausgaben im Monat (Meta, Google, TikTok)",
  auditEinkauf: "Wareneinkauf und sonstige Ausgaben im Monat",
  auditLimit: "Aktuelles Kartenlimit gesamt (optional)",
  auditPlatz: "z. B. 30.000",
  auditMiami: "Ich wünsche das Setup persönlich vor Ort in Miami",
  auditErgebnis: "Ihr Audit-Ergebnis",
  auditTitelA: "Mögliches US-Limit: bis zu ",
  auditTitelB: " (Richtwert).",
  auditText: (puffer: string, paket: string) => `Ihre derzeitige Struktur lässt rund ${puffer} monatlichen Puffer liegen — Ausgaben, die ein US-Limit tragen könnte. Empfohlenes Paket: ${paket}.`,
  auditPaketZeile: "Empfohlenes Paket",
  auditPufferZeile: "Ungenutzter Puffer im Monat",
  auditPaketAnfragen: "Paket anfragen",
  auditGespraech: "Qualifikationsgespräch buchen",
  auditFussnote: "Richtwert ohne Zusage: Karte und Limit entscheidet der US-Kartenherausgeber. Das Audit ersetzt keine Prüfung — es zeigt, wohin der Weg geht.",

  // ── Pakete ────────────────────────────────────────────────────────────
  paketePille: "Pakete",
  paketeH2a: "Vier Wege in die USA. ",
  paketeH2b: "Ein Ziel: Ihr Limit.",
  paketeLead: "Jedes Paket ist eine einmalige Setup-Investition — kein Abo, keine Provision auf Ihr Limit. Der Zielrahmen ist das, worauf FIAON hinarbeitet; über Karte und Limit entscheidet der Herausgeber.",
  einmalig: "einmalig · Setup-Investition",
  zielLimit: "Ziel-Limit bis ",
  paketWaehlen: "Paket anfragen",
  empfohlenStarten: "Empfohlen · Anfragen",
  pakete: {
    starter: {
      fuer: "Dropshipper, kleine Agenturen, der erste US-Schritt",
      punkte: ["US-LLC inklusive Registrierung", "EIN-Steuernummer des IRS", "US-Business-Account mit ACH/Wire", "US-Geschäftsadresse", "Setup Richtung 50.000 $ Ziel-Limit"],
    },
    pro: {
      fuer: "Etablierte Media Buyer mit laufenden Ad-Spends",
      punkte: ["Alles aus Starter Credit", "Multibank-Setup: zwei US-Konten", "Prioritäts-EIN und beschleunigte KYC-Strecke", "Setup Richtung 100.000 $ Ziel-Limit"],
    },
    enterprise: {
      fuer: "Mittelstand, Gruppen und Holdings",
      punkte: ["Alles aus Pro Scale", "Holding- oder C-Corp-Option", "Steuer-Compliance-Vorbereitung mit Partnern", "Setup Richtung 250.000 $ Ziel-Limit"],
    },
    miami: {
      fuer: "Das Flaggschiff — für alle, die es persönlich wollen",
      punkte: ["All-inclusive Setup vor Ort in Miami", "Business-Class-Flug und 5-Sterne-Hotel", "VIP-Shuttle und Begleitung durch FIAON", "Bank- und Karten-Termine persönlich vor Ort", "Höchste verfügbare Strukturstufe"],
    },
  } as Record<string, { fuer: string; punkte: string[] }>,

  // ── Der Weg ───────────────────────────────────────────────────────────
  wegPille: "Der Weg",
  wegH2a: "Von der Qualifikation ",
  wegH2b: "zur US-Karte.",
  weg: [
    { titel: "Limit-Qualifikation", text: "Zwei Minuten hier auf der Seite — oder direkt im Gespräch. Wir prüfen Ausgaben, Struktur und Ziel und nennen Ihnen ehrlich, welches Limit realistisch ist." },
    { titel: "US-Entity gründen", text: "FIAON registriert Ihre LLC oder C-Corp, beantragt die EIN und richtet die US-Geschäftsadresse ein. Sie unterschreiben, wir erledigen." },
    { titel: "Banking aufbauen", text: "Business-Accounts bei US-Finanzpartnern: ACH, Wire, Karten-fähige Infrastruktur. Ab hier läuft Ihr Umsatz sichtbar für die Herausgeber." },
    { titel: "Karten-Setup", text: "Wir bereiten den Antrag beim US-Kartenpartner vollständig vor — Sie bestätigen, der Herausgeber entscheidet." },
    { titel: "Rahmen wächst", text: "Pünktliche Abrechnung, sauberes Ausgabeverhalten, begleitete Aufstockungen. Ihr Ansprechpartner bleibt." },
  ],

  // ── Für wen ───────────────────────────────────────────────────────────
  fuerPille: "Für wen",
  fuerH2a: "Gebaut für Unternehmen, ",
  fuerH2b: "die skalieren wollen.",
  fuer: [
    { tag: "E-Com-Brands", titel: "Wareneinkauf ohne Deckel", text: "Bestellungen, die das europäische Kartenlimit sprengen, laufen über die US-Struktur — der Einkauf wartet nicht auf die Hausbank." },
    { tag: "Agenturen & Media Buyer", titel: "Ad-Spends, die durchgehen", text: "Meta- und Google-Budgets auf US-Karten mit hohen Limits: keine gesperrten Kampagnen mehr, weil die Karte am Anschlag ist." },
    { tag: "Gründer", titel: "Von Tag eins international", text: "Die US-Entity als Wachstumsfundament: amerikanische Zahlungsfähigkeit, US-Investoren-taugliche Struktur, kein EU-Korsett." },
    { tag: "Mittelstand & Gruppen", titel: "Strukturen statt Einzelkarten", text: "Holding, mehrere Entities, Compliance-Vorbereitung — ein Ansprechpartner, der die ganze Struktur kennt." },
  ],

  // ── Team ──────────────────────────────────────────────────────────────
  teamPille: "Die Menschen dahinter",
  teamH2a: "Kein anonymer Anbieter. ",
  teamH2b: "Ein Team mit Namen.",
  teamLead: "Ihre US-Struktur richtet kein Automat ein: Drei Gesellschafter tragen die Verantwortung — und sind persönlich erreichbar.",
  teamLink: "Das ganze Team kennenlernen",

  // ── FAQ ───────────────────────────────────────────────────────────────
  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Garantiert FIAON das Limit?", a: "Nein — und wer das verspricht, ist unseriös. Über Karte und Limit entscheidet der US-Kartenherausgeber. FIAON baut die Struktur, die die Entscheidung ermöglicht: Entity, EIN, Banking, sauberer Antrag." },
    { f: "Muss ich in die USA umziehen oder dort wohnen?", a: "Nein. Sie bleiben in Deutschland, Österreich oder der Schweiz. Die US-Entity ist Ihre Gesellschaft vor Ort — geführt aus der DACH-Region." },
    { f: "Übernimmt FIAON meine Steuern?", a: "FIAON bereitet die Steuer-Compliance mit Partnern vor (Enterprise Limit), ist aber keine Steuerberatung. Für die laufende US- und DACH-Steuerpflicht brauchen Sie Ihren Steuerberater — wir machen die Struktur anschlussfähig." },
    { f: "Wie lange dauert es bis zur Karte?", a: "Entity und EIN sind in der Regel in wenigen Wochen da, Banking und Kartenantrag folgen. Eine feste Dauer versprechen wir nicht — im Qualifikationsgespräch erhalten Sie den realistischen Fahrplan für Ihren Fall." },
    { f: "Warum einmalig statt Abo?", a: "Weil die Gründung einer US-Struktur eine Investition ist, kein laufender Service. Sie zahlen das Setup einmal — danach gehört die Entity Ihnen. Begleitung bei Limits und Aufstockungen bleibt Teil des Pakets." },
  ],

  // ── Zwischenruf & Abschluss ───────────────────────────────────────────
  zwischenrufA: "Erst wissen, was geht — dann entscheiden.",
  zwischenrufB: " Im Qualifikationsgespräch prüfen wir Ihre Ausgaben und nennen Ihnen den realistischen Rahmen.",
  termin: "Qualifikationsgespräch buchen",
  kontakt: "Frage stellen",
  abschlussA: "Ihr Unternehmen ist größer ",
  abschlussB: "als Ihr Kartenlimit.",
  abschlussText: "Audit in zwei Minuten, Gespräch in der Regel innerhalb von zwei Werktagen, eine Struktur, die Ihnen gehört.",
  paketeAnsehen: "Pakete ansehen",

  // ── VIP-Miami-Band ────────────────────────────────────────────────────
  miamiPille: "Flaggschiff",
  miamiH2: "VIP Miami Experience.",
  miamiText: "Wer 35.999 € investiert, bekommt kein Ticket zum Schalter — sondern die komplette Gründungsreise: Business-Class-Flug, 5-Sterne-Hotel, VIP-Shuttle und die Bank- und Karten-Termine persönlich in Miami, begleitet von FIAON. Die US-Struktur entsteht dort, wo sie hingehört — vor Ihren Augen.",
  miamiKnopf: "Miami anfragen",
};

export const GLOBAL_WOERTER = { de };
