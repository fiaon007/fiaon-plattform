// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WAS EIN PAKET ENTHÄLT (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Der Preis eines Pakets steht im Katalog (shared/fiaon-pakete.ts) — und nur
// dort. Was der Kunde dafür bekommt, steht hier — und nur hier. Die Seite
// /business, der Auftrag /business/start, der Vertrag als PDF, die Mails und
// das Firmen-Cockpit lesen dieselben Sätze. Ändert sich eine Leistung, ändert
// sie sich an einer Stelle; der Vertrag kann nie etwas anderes sagen als die
// Seite, auf der der Kunde gekauft hat.
//
// ── DIE REGELN, DIE JEDER SATZ HIER EINHÄLT ────────────────────────────────
// Justin (17.09.2026): Team vor Ort in den USA, Partner-Steuerberater,
// Anwälte, Bankkontakte — „alles über uns", drei Pakete und ein VIP-Paket,
// die Rahmen bestimmen, wie lange und wie eng wir betreuen.
//
// Die Prüfung vom selben Tag (05_Vision/B2B_GLOBAL_MODELL_2026-09-17) zieht
// die Grenze der Wortwahl:
//   · Über Konto, Karte und Rahmen entscheidet das Institut. Der Dollar-Wert
//     ist deshalb die PLANUNGSGRÖSSE des Kunden, nie ein Ergebnis von FIAON,
//     und der Satz dazu steht in derselben Tafel (Blickfang-Regel, BGH
//     I ZR 129/13). Kein „bis zu", keine Banknamen, kein Zinssatz als Zahl.
//     AUSNAHME (Justin, 18.09.2026, E-190): Auf der Seite heißt die Zahl
//     „Kapitalrahmen" und steht groß — „darum geht's ja"; beim VIP-Paket
//     „bis zu 1 Mio. US-Dollar". Das „bis zu" gibt es NUR in dieser einen Zahl
//     (planungBisZu, globalPlanungText); der Satz „über den Rahmen entscheidet
//     das Institut" steht weiter direkt darunter. Überall sonst gilt die Regel.
//   · Steuerliche und rechtliche Fragen beantworten Steuerberater und
//     Anwälte auf eigenes Mandat (§ 5, § 9 StBerG) — FIAON koordiniert.
//   · Dauer nur als Erfahrungswert („in der Regel"), nie als Frist.
//   · Zugesagt wird nur die eigene Leistung. Die Geld-zurück-Zusage gilt für
//     Gesellschaft + EIN — das liefert FIAON selbst — und nennt ihre
//     Bedingungen im selben Atemzug (BGH I ZR 194/06).
// Jeder Satz passiert shared/fiaon-wortverbote.ts (scripts/pruef-wortwand-de.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { PAKETE, type Paket } from "./fiaon-pakete";

export type GlobalSchluessel = "global_struktur" | "global_banking" | "global_kapital" | "global_vip";

export interface GlobalPaketText {
  /** Kurzname ohne „FIAON" — für Tafeln und Überschriften. */
  name: string;
  /** Was das Paket ausmacht, in drei Wörtern — Überzeile der Tafel (18.09.2026). */
  marke: string;
  /** Die Dauer ohne Satz — für die Vergleichstabelle. */
  dauerKurz: string;
  /** Eine Zeile: für wen dieses Paket gedacht ist. */
  fuer: string;
  /** Wie lange FIAON in der Regel begleitet — Erfahrungswert, keine Frist. */
  dauer: string;
  /** Was FIAON in diesem Paket leistet. */
  leistungen: string[];
}

export interface GlobalPaket {
  key: GlobalSchluessel;
  /**
   * Der Kapitalrahmen in US-Dollar (bis 18.09.2026 „Planungsgröße"): der Rahmen,
   * den der KUNDE anstrebt und an dem sich Dauer und Tiefe der Betreuung
   * ausrichten. Kein Ergebnis, keine Zusage — über jeden Rahmen entscheidet das
   * Institut.
   */
  planungUsd: number;
  /** Die Zahl ist eine Obergrenze: „bis zu …" (nur Global VIP, Justin 18.09.2026). */
  planungBisZu?: boolean;
  /** Vor-Ort-Paket mit Reise (VIP). */
  vorOrt: boolean;
  de: GlobalPaketText;
  en: GlobalPaketText;
}

export const GLOBAL_PAKETE: GlobalPaket[] = [
  // 18.09.2026 — Justin: „In den Paketen sind ALLE Gebühren enthalten (für Steuerberater,
  // Gründung, Anwalt, Agenten und co.) — wir kümmern uns dabei um alles!" Die Leistungen
  // nennen deshalb die Partner und die Gebühren ausdrücklich; der Umfang steht in
  // GLOBAL_INKLUSIVE, der Vertrag (Ziffer 3 und 5) sagt dasselbe.
  {
    key: "global_struktur",
    planungUsd: 50_000,
    vorOrt: false,
    de: {
      name: "Global Struktur",
      marke: "Gründung und erste Karte",
      fuer: "Für den sauberen Start: Gesellschaft, Steuernummern und der erste Konto- und Kartenantrag.",
      dauer: "Begleitung in der Regel rund acht Wochen",
      dauerKurz: "rund acht Wochen",
      leistungen: [
        "Gründung Ihrer US-Gesellschaft durch unser Team vor Ort, staatliche Gebühren inklusive",
        "EIN und ITIN: Anträge vorbereitet und eingereicht",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr",
        "Operating Agreement durch unseren Partner-Anwalt",
        "Prüfung vor der Gründung durch unseren Partner-Steuerberater",
        "Erste jährliche US-Meldung (Form 5472 mit Form 1120) durch unseren US-CPA",
        "Erster Konto- und Kartenantrag vollständig vorbereitet",
        "Ein fester Ansprechpartner und Ihr Dokumentenraum",
      ],
    },
    en: {
      name: "Global Structure",
      marke: "Formation and first card",
      fuer: "For a clean start: the company, tax numbers and the first account and card application.",
      dauer: "Support typically runs for around eight weeks",
      dauerKurz: "around eight weeks",
      leistungen: [
        "Formation of your US company by our team on the ground, state fees included",
        "EIN and ITIN: applications prepared and filed",
        "Registered agent, US business address and US phone number for the first year",
        "Operating agreement drafted by our partner lawyer",
        "Review before formation by our partner tax adviser",
        "First annual US filing (Form 5472 with Form 1120) by our US CPA",
        "First account and card application fully prepared",
        "One dedicated contact and your document room",
      ],
    },
  },
  {
    key: "global_banking",
    planungUsd: 100_000,
    vorOrt: false,
    de: {
      name: "Global Banking",
      marke: "Mit Kartenleiter",
      fuer: "Für den planvollen Ausbau nach der ersten Karte — weitere Herausgeber in der richtigen Reihenfolge.",
      dauer: "Begleitung in der Regel drei bis fünf Monate",
      dauerKurz: "drei bis fünf Monate",
      leistungen: [
        "Alles aus Global Struktur",
        "Plan für die Reihenfolge weiterer Kartenherausgeber",
        "Jeder weitere Antrag vollständig vorbereitet",
        "Monatlicher Durchgang mit Ihrem Ansprechpartner",
        "Pflichtenkalender für US-Meldungen und Fristen",
      ],
    },
    en: {
      name: "Global Banking",
      marke: "With the card ladder",
      fuer: "For a planned build-up after the first card — further issuers in the right order.",
      dauer: "Support typically runs for three to five months",
      dauerKurz: "three to five months",
      leistungen: [
        "Everything in Global Structure",
        "A plan for the sequence of further card issuers",
        "Every further application fully prepared",
        "Monthly review with your dedicated contact",
        "Compliance calendar for US filings and deadlines",
      ],
    },
  },
  {
    key: "global_kapital",
    planungUsd: 250_000,
    vorOrt: false,
    de: {
      name: "Global Kapital",
      marke: "Bis zum Bankdarlehen",
      fuer: "Für größeren Kapitalbedarf: der ganze Weg über mehrere Institute, einschließlich der Unterlagen für ein Bankdarlehen.",
      dauer: "Begleitung in der Regel sechs Monate und länger",
      dauerKurz: "sechs Monate und länger",
      leistungen: [
        "Alles aus Global Banking",
        "Begleitung über mehrere Herausgeber hinweg",
        "Kennzahlen-Mappe und Unterlagen für ein späteres Bankdarlehen",
        "Laufende Abstimmung mit Partner-Anwalt und Partner-Steuerberater, Honorare inklusive",
        "Vorrang bei Terminen unseres Teams vor Ort",
      ],
    },
    en: {
      name: "Global Capital",
      marke: "Through to the bank loan",
      fuer: "For larger capital needs: the whole route across several institutions, including the documents for a bank loan.",
      dauer: "Support typically runs for six months or longer",
      dauerKurz: "six months or longer",
      leistungen: [
        "Everything in Global Banking",
        "Support across several issuers",
        "Key-figures file and documents for a later bank loan",
        "Ongoing coordination with our partner lawyer and partner tax adviser, fees included",
        "Priority for appointments handled by our team on the ground",
      ],
    },
  },
  {
    key: "global_vip",
    // Justin, 18.09.2026: „Beim VIP-Paket bis zu 1 Mio. US-Dollar Kapital."
    planungUsd: 1_000_000,
    planungBisZu: true,
    vorOrt: true,
    de: {
      name: "Global VIP",
      marke: "Persönlich vor Ort",
      fuer: "Für alle, die den Aufbau persönlich in Miami erleben und selbst am Tisch sitzen wollen.",
      dauer: "Begleitung wie Global Kapital, Auftakt persönlich vor Ort",
      dauerKurz: "wie Global Kapital, Auftakt vor Ort",
      leistungen: [
        "Alles aus Global Kapital",
        "Der Auftakt persönlich vor Ort in Miami",
        "Termine bei Behörden und Banken gemeinsam mit unserem Team",
        "Flug und Hotel für den Auftakt in Miami inklusive",
        "Begleitung durch die Geschäftsführung",
      ],
    },
    en: {
      name: "Global VIP",
      marke: "In person on site",
      fuer: "For everyone who wants to experience the build-up in person in Miami and sit at the table themselves.",
      dauer: "Support as in Global Capital, with the kick-off in person on site",
      dauerKurz: "as Global Capital, kick-off on site",
      leistungen: [
        "Everything in Global Capital",
        "The kick-off in person in Miami",
        "Appointments with authorities and banks together with our team",
        "Flights and hotel for the kick-off in Miami included",
        "Accompanied by our management",
      ],
    },
  },
];


const NACH_KEY = new Map(GLOBAL_PAKETE.map((p) => [p.key as string, p]));

export function globalPaket(key: unknown): GlobalPaket | null {
  return NACH_KEY.get(String(key ?? "").trim().toLowerCase()) ?? null;
}

/** Der Katalogeintrag zum Global-Paket — der Preis kommt NUR von dort. */
export function globalKatalog(key: unknown): Paket | null {
  const g = globalPaket(key);
  return g ? PAKETE.find((p) => p.key === g.key) ?? null : null;
}

/** „2.499 €" — ganze Euro, deutsches oder britisches Zahlenbild. */
export function globalPreisText(key: unknown, sprache: "de" | "en" = "de"): string {
  const cents = globalKatalog(key)?.preisCents ?? 0;
  const euro = Math.round(cents / 100);
  return sprache === "en" ? "€" + euro.toLocaleString("en-GB") : euro.toLocaleString("de-DE") + " €";
}

/**
 * Der Kapitalrahmen in zwei Teilen — „bis zu" klein, die Zahl groß (Paketkarte).
 * `bisZu` ist null, wo die Zahl keine Obergrenze ist.
 */
export function globalKapital(key: unknown, sprache: "de" | "en" = "de"): { bisZu: string | null; wert: string } {
  const g = globalPaket(key);
  const usd = g?.planungUsd ?? 0;
  const wert = sprache === "en" ? "$" + usd.toLocaleString("en-GB") : usd.toLocaleString("de-DE") + " $";
  return { bisZu: g?.planungBisZu ? (sprache === "en" ? "up to" : "bis zu") : null, wert };
}

/** „50.000 $" bzw. „$50,000" — beim VIP-Paket „bis zu 1.000.000 $" bzw. „up to $1,000,000". */
export function globalPlanungText(key: unknown, sprache: "de" | "en" = "de"): string {
  const k = globalKapital(key, sprache);
  return k.bisZu ? `${k.bisZu} ${k.wert}` : k.wert;
}

/** Die Spanne über alle Pakete — „50.000 $ – 1.000.000 $" (Kopf der Seite). */
export function globalKapitalSpanne(sprache: "de" | "en" = "de"): string {
  const werte = GLOBAL_PAKETE.map((p) => p.planungUsd);
  const zahl = (usd: number) => (sprache === "en" ? "$" + usd.toLocaleString("en-GB") : usd.toLocaleString("de-DE") + " $");
  return `${zahl(Math.min(...werte))} – ${zahl(Math.max(...werte))}`;
}

// ── DIE SÄTZE, DIE NIE FEHLEN DÜRFEN ───────────────────────────────────────
// Sie stehen unter den Paketen auf der Seite, vor der Unterschrift im Auftrag
// und im Vertrag. § 5a UWG verlangt sie auch gegenüber Unternehmen: Wer eine
// US-Gesellschaft verkauft, ohne die Steuerpflicht zu Hause, die jährlichen
// US-Meldungen und die persönliche Haftung bei Firmenkarten zu nennen,
// verschweigt, was der Kunde für seine Entscheidung braucht.
export const GLOBAL_PFLICHTHINWEIS = {
  de: [
    "Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, bleibt dort steuerpflichtig; die Gründung ist dem Finanzamt zu melden (in Deutschland nach § 138 AO).",
    "In den USA gelten jährliche Meldepflichten, auch ohne Umsatz (Form 5472 mit Form 1120), dazu Staatsgebühren und die Kosten des Registered Agent.",
    "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  ],
  en: [
    "A US company that is managed from Germany, Austria or Switzerland remains taxable there; its formation must be reported to the tax office (in Germany under section 138 of the Fiscal Code).",
    "Annual filing duties apply in the United States even without revenue (Form 5472 with Form 1120), along with state fees and the cost of the registered agent.",
    "US business cards generally require a personal guarantee from the owner. The institution alone decides on the account, the card and the limit.",
  ],
} as const;

/** Wer was tut — die Grenze zwischen FIAON und den Partnern, in einem Satz je Seite. */
export const GLOBAL_ROLLEN = {
  de: {
    fiaon: "FIAON koordiniert, bereitet vor, reicht ein und nimmt Termine vor Ort wahr. FIAON ist keine Kanzlei und keine Bank.",
    // 18.09.2026: Die Honorare trägt FIAON (Justin: „ALLE Gebühren enthalten"). Das Mandat
    // bleibt beim Kunden — Steuer- und Rechtsberatung darf FIAON nicht selbst schulden
    // (§ 5 StBerG, § 3 RDG); FIAON übernimmt die Kosten, der Partner arbeitet für den Kunden.
    partner: "Steuerberater, US-CPA und Anwälte aus unserem Partnernetz arbeiten auf Ihr Mandat — ihre Honorare für die Leistungen Ihres Pakets trägt FIAON.",
    kosten: "Alle Gebühren und Honorare für die Leistungen Ihres Pakets sind im Festpreis enthalten. Laufende Kosten Ihrer Gesellschaft ab dem zweiten Jahr nennen wir Ihnen rechtzeitig vorab.",
  },
  en: {
    fiaon: "FIAON coordinates, prepares, files and attends appointments on the ground. FIAON is neither a law firm nor a bank.",
    partner: "Tax advisers, US CPAs and lawyers from our partner network act under your engagement — FIAON pays their fees for the services in your package.",
    kosten: "All fees and charges for the services in your package are included in the fixed price. We tell you about your company’s running costs from the second year onwards well in advance.",
  },
} as const;

// ── ALLES INKLUSIVE (18.09.2026) ────────────────────────────────────────────
// Was der Festpreis im Einzelnen abdeckt — die Seite, der Auftrag und das Office
// zeigen diese Liste. Sie gilt für alle vier Pakete; die Pakete darüber hinaus
// stehen in GLOBAL_PAKETE und GLOBAL_VERGLEICH.
export const GLOBAL_INKLUSIVE = {
  de: [
    "Staatliche Gründungsgebühren in den USA",
    "Registered Agent, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr",
    "Anträge für EIN und ITIN",
    "Honorar unseres Partner-Anwalts für Operating Agreement und Gründungsunterlagen",
    "Honorar unseres Partner-Steuerberaters für die Prüfung vor der Gründung",
    "Honorar unseres US-CPA für die erste jährliche US-Meldung",
    "Termine und Einreichungen unseres Teams vor Ort",
    "Ihr fester Ansprechpartner für die gesamte Begleitung",
  ],
  en: [
    "US state formation fees",
    "Registered agent, US business address and US phone number for the first year",
    "EIN and ITIN applications",
    "Our partner lawyer’s fee for the operating agreement and formation documents",
    "Our partner tax adviser’s fee for the review before formation",
    "Our US CPA’s fee for the first annual US filing",
    "Appointments and filings handled by our team on the ground",
    "Your dedicated contact for the entire engagement",
  ],
} as const;

/** Was ab dem zweiten Jahr anfällt — offen gesagt, nicht versteckt. */
export const GLOBAL_LAUFEND = {
  de: "Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir das für 699 € im Jahr – alle Gebühren inklusive.",
  en: "From the second year onwards your company incurs running costs: the state fee, the registered agent and the annual US filing. With the annual care plan we take care of all of it for €699 a year – all fees included.",
} as const;

// ══════════════════════════════════════════════════════════════════════════
// JAHRESBETREUUNG AB DEM ZWEITEN JAHR (19.09.2026, E-196)
//
// Justin: „Egal ob ein Unternehmen eine US LLC gründet oder eine Privatperson:
// Für 699 € im Jahr kümmern wir uns fortlaufend um alles (Steuerbescheid,
// Telefonnummer, Adresse und co.). Füge und pflege das bitte auf jeder Seite
// neu ein." Entscheidungen vom selben Tag: ALLE Gebühren inklusive — auch die
// Staatsgebühr des Bundesstaats — und im Auftrag ankreuzbar (neue
// Vertragsfassung). Das erste Jahr steckt in jedem Paket (Registered Agent,
// Adresse, Telefon, erste US-Meldung); die Jahresbetreuung beginnt danach.
//
// Sie verlängert sich NICHT von selbst: Vor jedem Betreuungsjahr kommt eine
// Rechnung, mit ihrer Zahlung beginnt das Jahr. So gibt es keine Laufzeitfalle
// für Verbraucher (§ 309 Nr. 9 BGB) und keine Kündigungsfrist, die jemand
// verpasst. Die Seite, der Auftrag, der Vertrag und die Rechnung lesen diese
// Sätze — der Preis steht nur hier (preisCents).
// ══════════════════════════════════════════════════════════════════════════
export const GLOBAL_JAHRESBETREUUNG = {
  preisCents: 69900,
  de: {
    titel: "Jahresbetreuung",
    marke: "Ab dem zweiten Jahr",
    preisZeile: "699 € im Jahr",
    kurz: "Ab dem zweiten Jahr: 699 € im Jahr – wir kümmern uns fortlaufend um alles, alle Gebühren inklusive.",
    lead: "Das erste Jahr steckt in jedem Paket. Ab dem zweiten Jahr halten wir Ihre Gesellschaft für 699 € im Jahr am Laufen – mit allen Gebühren, ohne dass Sie eine Frist im Kopf behalten müssen.",
    leistungen: [
      "Registered Agent und US-Geschäftsadresse",
      "US-Telefonnummer",
      "Jährliche US-Meldung (Form 5472 mit Form 1120) durch unseren US-CPA",
      "Jahresmeldung beim Bundesstaat – die Staatsgebühr ist enthalten",
      "Pflichtenkalender mit allen US-Fristen",
      "Ihr fester Ansprechpartner",
    ],
    bedingungen: "Beginn mit dem zweiten Jahr nach der Gründung. Berechnet wird jährlich im Voraus; die Jahresbetreuung verlängert sich nicht von selbst – mit der Zahlung der Jahresrechnung beginnt das nächste Betreuungsjahr.",
    buchen: "Jahresbetreuung ab dem zweiten Jahr dazubuchen – 699 € im Jahr, alle Gebühren inklusive",
    gebucht: "Jahresbetreuung ab dem zweiten Jahr: 699 € im Jahr, alle Gebühren inklusive",
    nichtHeute: "Heute wird nur der Paketpreis fällig; die Jahresbetreuung berechnen wir erst zum zweiten Jahr.",
    // Vertragssprache (Ziffern 2 und 5) — kein „Ihr", „unser", „wir" (pruef-global-vertrag.ts).
    vertrag: "Der Auftraggeber bucht die Jahresbetreuung dazu. Ab dem zweiten Jahr nach der Gründung übernimmt FIAON für 699 € je Betreuungsjahr: den Registered Agent und die US-Geschäftsadresse, die US-Telefonnummer, die jährliche US-Meldung (Form 5472 mit Form 1120) durch einen US-CPA aus dem Partnernetz von FIAON, die Jahresmeldung beim Bundesstaat einschließlich der Staatsgebühr, den Pflichtenkalender und einen festen Ansprechpartner. Alle Gebühren und Honorare für diese Leistungen sind im Preis enthalten.",
    vertragBedingungen: "Die Jahresbetreuung wird jährlich im Voraus berechnet und verlängert sich nicht von selbst: Mit der Zahlung der Jahresrechnung beginnt das jeweilige Betreuungsjahr. Bleibt die Zahlung aus, endet die Jahresbetreuung; die laufenden Kosten der Gesellschaft trägt der Auftraggeber dann selbst.",
  },
  en: {
    titel: "Annual care plan",
    marke: "From the second year",
    preisZeile: "€699 a year",
    kurz: "From the second year: €699 a year – we take care of everything on an ongoing basis, all fees included.",
    lead: "The first year is included in every package. From the second year we keep your company running for €699 a year – with all fees, and without you having to keep any deadline in mind.",
    leistungen: [
      "Registered agent and US business address",
      "US phone number",
      "Annual US filing (Form 5472 with Form 1120) by our US CPA",
      "Annual report to the state – the state fee is included",
      "Compliance calendar with every US deadline",
      "Your dedicated contact",
    ],
    bedingungen: "Starts with the second year after formation. Billed annually in advance; the plan does not renew automatically – the next year of care begins when the annual invoice is paid.",
    buchen: "Add the annual care plan from the second year – €699 a year, all fees included",
    gebucht: "Annual care plan from the second year: €699 a year, all fees included",
    nichtHeute: "Only the package price is due today; we invoice the annual care plan from the second year.",
    vertrag: "The Client adds the annual care plan. From the second year after formation, FIAON takes over for €699 per year of care: the registered agent and the US business address, the US phone number, the annual US filing (Form 5472 with Form 1120) by a US CPA from FIAON’s partner network, the annual report to the state including the state fee, the compliance calendar and a dedicated contact. All fees and charges for these services are included in the price.",
    vertragBedingungen: "The annual care plan is billed annually in advance and does not renew automatically: each year of care begins when the annual invoice is paid. If payment is not made, the annual care plan ends and the Client then bears the company’s running costs itself.",
  },
} as const;

/** „699 €" bzw. „€699" — der Preis der Jahresbetreuung aus der einen Quelle. */
export function globalJahresbetreuungPreisText(sprache: "de" | "en" = "de"): string {
  const euro = Math.round(GLOBAL_JAHRESBETREUUNG.preisCents / 100);
  return sprache === "en" ? "€" + euro.toLocaleString("en-GB") : euro.toLocaleString("de-DE") + " €";
}

// ── NICHT IM FESTPREIS (19.09.2026, E-192) ──────────────────────────────────
// „Alle Gebühren inklusive" heißt: alle Gebühren für die Leistungen des Pakets.
// Was darüber hinaus anfallen kann, steht auf /business direkt neben den Paketen —
// deckungsgleich mit /business/kosten („nicht Teil der Pakete") und dem Vertrag
// (Ziffer 5: die laufenden Kosten ab dem zweiten Jahr trägt der Auftraggeber).
export const GLOBAL_NICHT_INKLUSIVE = {
  de: [
    "Laufende Kosten Ihrer Gesellschaft ab dem zweiten Jahr: Staatsgebühr, Registered Agent und die jährliche US-Meldung – mit der Jahresbetreuung für 699 € im Jahr alles inklusive",
    "Laufende Buchhaltung und die Steuererklärungen in Ihrem Wohnsitzland",
    "Umsatzsteuer-Registrierungen in einzelnen US-Bundesstaaten",
    "Gebühren, Einlagen oder Zinsen, die ein Institut selbst verlangt",
  ],
  en: [
    "Your company’s running costs from the second year: state fee, registered agent and the annual US filing – all included with the annual care plan for €699 a year",
    "Ongoing bookkeeping and the tax returns in your country of residence",
    "Sales tax registrations in individual US states",
    "Fees, deposits or interest charged by an institution itself",
  ],
} as const;

// ── VERTRAGSSPRACHE (18.09.2026) ────────────────────────────────────────────
// Die Seite spricht den Kunden an („Ihre Gesellschaft", „unser Team"), der Vertrag
// spricht über die Parteien („der Auftraggeber", „FIAON"). Dieselben Inhalte, zwei
// Tonlagen — der Prüfstand (pruef-global-vertrag.ts) lässt im Vertrag kein „Ihr",
// „unser", „wir" (und kein your/our/we) durch. Wer oben eine Leistung umformuliert,
// ergänzt hier die Ersetzung.
export const GLOBAL_LAUFEND_VERTRAG = {
  de: "Ab dem zweiten Jahr trägt der Auftraggeber die laufenden Kosten der Gesellschaft (Staatsgebühr, Registered Agent und jährliche US-Meldung); FIAON nennt sie ihm rechtzeitig vorab.",
  en: "From the second year onwards the Client bears the running costs of the company (state fee, registered agent and annual US filing); FIAON informs the Client of them well in advance.",
} as const;

const VERTRAGSSPRACHE: Record<"de" | "en", ReadonlyArray<readonly [string, string]>> = {
  de: [
    ["Gründung Ihrer US-Gesellschaft durch unser Team vor Ort", "Gründung der US-Gesellschaft des Auftraggebers durch das Team von FIAON vor Ort"],
    ["durch unseren Partner-Anwalt", "durch einen Partner-Anwalt von FIAON"],
    ["durch unseren Partner-Steuerberater", "durch einen Partner-Steuerberater von FIAON"],
    ["durch unseren US-CPA", "durch einen US-CPA aus dem Partnernetz von FIAON"],
    ["Ein fester Ansprechpartner und Ihr Dokumentenraum", "Ein fester Ansprechpartner und ein Dokumentenraum"],
    ["mit Ihrem Ansprechpartner", "mit dem Ansprechpartner"],
    ["Terminen unseres Teams vor Ort", "Terminen des Teams von FIAON vor Ort"],
    ["gemeinsam mit unserem Team", "gemeinsam mit dem Team von FIAON"],
    ["Begleitung durch die Geschäftsführung", "Begleitung durch die Geschäftsführung von FIAON"],
    ["Honorar unseres Partner-Anwalts", "Honorar des Partner-Anwalts"],
    ["Honorar unseres Partner-Steuerberaters", "Honorar des Partner-Steuerberaters"],
    ["Honorar unseres US-CPA", "Honorar des US-CPA"],
    ["Einreichungen unseres Teams vor Ort", "Einreichungen des Teams von FIAON vor Ort"],
    ["Ihr fester Ansprechpartner für die gesamte Begleitung", "Ein fester Ansprechpartner für die gesamte Begleitung"],
  ],
  en: [
    ["Formation of your US company by our team on the ground", "Formation of the Client’s US company by FIAON’s team on the ground"],
    ["drafted by our partner lawyer", "drafted by a partner lawyer of FIAON"],
    ["by our partner tax adviser", "by a partner tax adviser of FIAON"],
    ["by our US CPA", "by a US CPA from FIAON’s partner network"],
    ["One dedicated contact and your document room", "One dedicated contact and a document room"],
    ["with your dedicated contact", "with the dedicated contact"],
    ["with our partner lawyer and partner tax adviser", "with the partner lawyer and partner tax adviser"],
    ["handled by our team on the ground", "handled by FIAON’s team on the ground"],
    ["together with our team", "together with FIAON’s team"],
    ["Accompanied by our management", "Accompanied by FIAON’s management"],
    ["Our partner lawyer’s fee", "The partner lawyer’s fee"],
    ["Our partner tax adviser’s fee", "The partner tax adviser’s fee"],
    ["Our US CPA’s fee", "The US CPA’s fee"],
    ["Your dedicated contact for the entire engagement", "A dedicated contact for the entire engagement"],
  ],
};

// ── FLUG UND HOTEL IM PAKET VIP (18.09.2026, Justin: „Flug und Hotel ist im VIP
// Paket enthalten — kein Reiseunternehmen.") ─────────────────────────────────
// Gebaut als Kostenübernahme wie bei den Partner-Honoraren: FIAON trägt die
// Kosten einer Geschäftsreise, gebucht im Namen des Auftraggebers — FIAON
// verkauft keine Reise. Der Satz steht so im Auftrag (Ziffer 5).
export const GLOBAL_VIP_REISE = {
  de: "Beim Paket FIAON Global VIP trägt FIAON zusätzlich die Kosten für Hin- und Rückflug ab Deutschland, Österreich oder der Schweiz und für die Hotelübernachtungen in Miami während des Auftakts, jeweils für eine vom Auftraggeber benannte Person. Gebucht wird im Namen des Auftraggebers; Reisedaten, Flugklasse und Hotel stimmen die Parteien vor der Buchung ab. Die Reise ist Teil der Begleitung und keine eigenständige Reiseleistung.",
  en: "For the FIAON Global VIP package, FIAON additionally bears the costs of the return flight from Germany, Austria or Switzerland and of the hotel nights in Miami during the kick-off, in each case for one person named by the Client. Bookings are made in the Client’s name; travel dates, class of travel and hotel are agreed between the parties before booking. The trip is part of the support and not a separate travel service.",
} as const;

/** Eine Zeile aus Paketliste oder Inklusiv-Liste in Vertragssprache. */
export function inVertragssprache(zeile: string, sprache: "de" | "en"): string {
  let t = zeile;
  for (const [aus, ein] of VERTRAGSSPRACHE[sprache]) t = t.split(aus).join(ein);
  return t;
}

// Die Unterlagen für den Start stehen seit dem Merge (18.09.2026) an EINER Stelle:
// shared/fiaon-global-bereich.ts (GLOBAL_UNTERLAGEN / GLOBAL_UNTERLAGEN_EN, mit Art und Hinweis je Zeile).

// ── ALLE LEISTUNGEN IM VERGLEICH (18.09.2026) ───────────────────────────────
// Die Tabelle unter den Paketen. Jede Zeile nennt, in welchem Paket sie steckt —
// deckungsgleich mit den Leistungen oben (scripts/pruef-pakete.ts prüft das nicht
// wortgleich, deshalb bei jeder Änderung beide Stellen anfassen).
type Wert = boolean;
const alle: Record<GlobalSchluessel, Wert> = { global_struktur: true, global_banking: true, global_kapital: true, global_vip: true };
const abBanking: Record<GlobalSchluessel, Wert> = { global_struktur: false, global_banking: true, global_kapital: true, global_vip: true };
const abKapital: Record<GlobalSchluessel, Wert> = { global_struktur: false, global_banking: false, global_kapital: true, global_vip: true };
const nurVip: Record<GlobalSchluessel, Wert> = { global_struktur: false, global_banking: false, global_kapital: false, global_vip: true };

export interface GlobalVergleichGruppe {
  titel: { de: string; en: string };
  zeilen: { de: string; en: string; in: Record<GlobalSchluessel, Wert> }[];
}

export const GLOBAL_VERGLEICH: GlobalVergleichGruppe[] = [
  { titel: { de: "Gründung und Dokumente", en: "Formation and documents" }, zeilen: [
    { de: "US-Gesellschaft gegründet, staatliche Gebühren inklusive", en: "US company formed, state fees included", in: alle },
    { de: "EIN und ITIN beantragt", en: "EIN and ITIN applied for", in: alle },
    { de: "Registered Agent, US-Adresse und Telefon im ersten Jahr", en: "Registered agent, US address and phone in the first year", in: alle },
    { de: "Operating Agreement durch Partner-Anwalt", en: "Operating agreement by partner lawyer", in: alle },
    { de: "Prüfung vor der Gründung durch Partner-Steuerberater", en: "Review before formation by partner tax adviser", in: alle },
    { de: "Erste jährliche US-Meldung durch US-CPA", en: "First annual US filing by US CPA", in: alle },
  ] },
  { titel: { de: "Bank und Karten", en: "Banking and cards" }, zeilen: [
    { de: "Erster Konto- und Kartenantrag vorbereitet", en: "First account and card application prepared", in: alle },
    { de: "Plan für weitere Kartenherausgeber", en: "Plan for further card issuers", in: abBanking },
    { de: "Jeder weitere Antrag vorbereitet", en: "Every further application prepared", in: abBanking },
    { de: "Begleitung über mehrere Herausgeber", en: "Support across several issuers", in: abKapital },
  ] },
  { titel: { de: "Kapital", en: "Capital" }, zeilen: [
    { de: "Kennzahlen-Mappe für ein späteres Bankdarlehen", en: "Key-figures file for a later bank loan", in: abKapital },
    { de: "Laufende Abstimmung mit Anwalt und Steuerberater", en: "Ongoing coordination with lawyer and tax adviser", in: abKapital },
  ] },
  { titel: { de: "Betreuung", en: "Support" }, zeilen: [
    { de: "Fester Ansprechpartner und Dokumentenraum", en: "Dedicated contact and document room", in: alle },
    { de: "Monatlicher Durchgang", en: "Monthly review", in: abBanking },
    { de: "Pflichtenkalender für US-Meldungen", en: "Compliance calendar for US filings", in: abBanking },
    { de: "Vorrang bei Terminen vor Ort", en: "Priority for appointments on the ground", in: abKapital },
    { de: "Auftakt persönlich in Miami, Flug und Hotel inklusive", en: "Kick-off in person in Miami, flights and hotel included", in: nurVip },
    { de: "Begleitung durch die Geschäftsführung", en: "Accompanied by our management", in: nurVip },
  ] },
];

// ── GELD ZURÜCK, WENN WIR NICHT LIEFERN ────────────────────────────────────
// Justin wollte „garantiert". Auf eine Bankentscheidung lässt sich das nicht
// abmahnsicher sagen (OLG Hamm 4 U 171/12: Erfolg hängt von Dritten ab). Auf
// die EIGENE Leistung schon: Gesellschaft und EIN liefert FIAON selbst. Die
// Zusage steht im Vertrag (Ziffer „Geld zurück"), und ihre Bedingungen stehen
// überall direkt daneben. Schalter aus = der Satz verschwindet von der Seite,
// aus dem Auftrag und aus dem Vertrag zugleich.
export const GLOBAL_GELD_ZURUECK = {
  aktiv: true,
  de: {
    titel: "Geld zurück, wenn wir nicht liefern",
    // Für Listen und Leisten, in denen die Bedingungen nicht direkt daneben stehen: genau begrenzt.
    kurz: "Geld zurück, wenn Gesellschaft und EIN nicht zum vereinbarten Stichtag stehen",
    text: "Stehen Ihre US-Gesellschaft und die EIN nicht zu dem Stichtag, den wir beim Start mit Ihnen vereinbaren, erstatten wir den Paketpreis.",
    bedingungen: "Voraussetzung sind vollständige Unterlagen und Ihre Mitwirkung. Ausgenommen ist die Ablehnung durch eine Behörde aus Gründen, die in Ihrer Person oder Ihrem Unternehmen liegen. Entscheidungen von Banken und Kartenherausgebern sind nicht Gegenstand dieser Zusage.",
    // Dieselbe Zusage in Vertragssprache (Ziffer 6 des Auftrags).
    vertrag: "Stehen die US-Gesellschaft des Auftraggebers und die EIN nicht zu dem Stichtag, den FIAON und der Auftraggeber beim Start vereinbaren, erstattet FIAON den Paketpreis.",
    vertragBedingungen: "Voraussetzung sind vollständige Unterlagen und die Mitwirkung des Auftraggebers. Ausgenommen ist die Ablehnung durch eine Behörde aus Gründen, die in der Person des Auftraggebers oder in seinem Unternehmen liegen. Entscheidungen von Banken und Kartenherausgebern sind nicht Gegenstand dieser Zusage.",
  },
  en: {
    titel: "Your money back if we do not deliver",
    kurz: "Your money back if the company and EIN are not in place by the agreed date",
    text: "If your US company and the EIN are not in place by the date we agree with you at the start, we refund the package price.",
    bedingungen: "This requires complete documents and your cooperation. It does not cover a refusal by an authority for reasons relating to you or your company. Decisions by banks and card issuers are not part of this commitment.",
    vertrag: "If the Client’s US company and the EIN are not in place by the date agreed between FIAON and the Client at the start, FIAON refunds the package price.",
    vertragBedingungen: "This requires complete documents and the Client’s cooperation. It does not cover a refusal by an authority for reasons relating to the Client or its business. Decisions by banks and card issuers are not part of this commitment.",
  },
} as const;

/** Version des Vertragstexts — steht im PDF und in der Auftragsakte. */
export const GLOBAL_VERTRAG_VERSION = "2026-09-19c";

// ── FIAON IST IMMER DIE GEGENSEITE (19.09.2026, Florentines Fund) ─────────────
// Im Bestellweg ließ sich als eigenes Unternehmen „FIAON LTD" mit einer Anschrift
// in Meißenheim eintragen. Vertrag und Rechnung zeigten dann ZWEI Parteien namens
// FIAON LTD, eine davon mit fremder Adresse — ein Dokument, das aussieht, als hätte
// FIAON eine andere Anschrift. FIAON ist Vertragspartner, nie Auftraggeber,
// Unterzeichner oder Website des Kunden. Server (fiaon-global-auftrag.ts,
// firmensuche/impressum) und Seite (business-start.tsx) prüfen mit dieser Funktion.
/** Enthält die Eingabe den Namen FIAON — auch als „F.I.A.O.N." oder „fiaon.com"? */
export function istFiaonSelbst(roh: unknown): boolean {
  return String(roh ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").includes("fiaon");
}
