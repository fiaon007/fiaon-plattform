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
   * Die Planungsgröße in US-Dollar: der Rahmen, den der KUNDE anstrebt und an
   * dem sich Dauer und Tiefe der Betreuung ausrichten. Kein Ergebnis, keine
   * Zusage — über jeden Rahmen entscheidet das Institut.
   */
  planungUsd: number;
  /** Vor-Ort-Paket mit Reise (VIP). */
  vorOrt: boolean;
  de: GlobalPaketText;
  en: GlobalPaketText;
}

export const GLOBAL_PAKETE: GlobalPaket[] = [
  {
    key: "global_struktur",
    planungUsd: 50_000,
    vorOrt: false,
    de: {
      name: "Global Struktur",
      fuer: "Für Unternehmen, die ihre US-Gesellschaft sauber aufsetzen und die erste Bank- und Kartenbeziehung beginnen.",
      dauer: "Begleitung in der Regel rund acht Wochen",
      leistungen: [
        "Gründung Ihrer US-Gesellschaft durch unser Team vor Ort",
        "EIN und ITIN: Anträge vorbereitet und eingereicht",
        "US-Geschäftsadresse, US-Telefonnummer, Registered Agent",
        "Operating Agreement und eigener Dokumentenraum",
        "Erster Konto- und Kartenantrag vollständig vorbereitet",
        "Ein fester Ansprechpartner von Anfang an",
      ],
    },
    en: {
      name: "Global Structure",
      fuer: "For companies setting up their US entity properly and starting their first banking and card relationship.",
      dauer: "Support typically runs for around eight weeks",
      leistungen: [
        "Formation of your US company by our team on the ground",
        "EIN and ITIN: applications prepared and filed",
        "US business address, US phone number, registered agent",
        "Operating agreement and your own document room",
        "First account and card application fully prepared",
        "One dedicated contact from day one",
      ],
    },
  },
  {
    key: "global_banking",
    planungUsd: 100_000,
    vorOrt: false,
    de: {
      name: "Global Banking",
      fuer: "Für Unternehmen, die nach der ersten Karte planvoll weitere Herausgeber gewinnen wollen.",
      dauer: "Begleitung in der Regel drei bis fünf Monate",
      leistungen: [
        "Alles aus Global Struktur",
        "Plan für die Reihenfolge weiterer Kartenherausgeber",
        "Jeder weitere Antrag vollständig vorbereitet",
        "Monatlicher Durchgang mit Ihrem Ansprechpartner",
        "Pflichtenkalender für US-Meldungen und Staatsgebühren",
      ],
    },
    en: {
      name: "Global Banking",
      fuer: "For companies that want to add further issuers in a planned sequence after the first card.",
      dauer: "Support typically runs for three to five months",
      leistungen: [
        "Everything in Global Structure",
        "A plan for the sequence of further card issuers",
        "Every further application fully prepared",
        "Monthly review with your dedicated contact",
        "Compliance calendar for US filings and state fees",
      ],
    },
  },
  {
    key: "global_kapital",
    planungUsd: 250_000,
    vorOrt: false,
    de: {
      name: "Global Kapital",
      fuer: "Für Unternehmen mit größerem Kapitalbedarf, die den Aufbau über mehrere Institute hinweg führen lassen.",
      dauer: "Begleitung in der Regel sechs Monate und länger",
      leistungen: [
        "Alles aus Global Banking",
        "Begleitung über mehrere Herausgeber hinweg",
        "Kennzahlen-Mappe und Unterlagen für ein späteres Bankdarlehen",
        "Abstimmung mit Steuerberater und Anwalt aus dem Partnernetz",
        "Vorrang bei Terminen unseres Teams vor Ort",
      ],
    },
    en: {
      name: "Global Capital",
      fuer: "For companies with larger capital needs that want the build-up managed across several institutions.",
      dauer: "Support typically runs for six months or longer",
      leistungen: [
        "Everything in Global Banking",
        "Support across several issuers",
        "Key-figures file and documents for a later bank loan",
        "Coordination with the tax adviser and lawyer from our partner network",
        "Priority for appointments handled by our team on the ground",
      ],
    },
  },
  {
    key: "global_vip",
    planungUsd: 250_000,
    vorOrt: true,
    de: {
      name: "Global VIP",
      fuer: "Für Unternehmer, die den Aufbau persönlich vor Ort in Miami erleben und selbst am Tisch sitzen wollen.",
      dauer: "Begleitung wie Global Kapital, Auftakt persönlich vor Ort",
      leistungen: [
        "Alles aus Global Kapital",
        "Der Auftakt persönlich vor Ort in Miami",
        "Termine bei Behörden und Banken gemeinsam mit unserem Team",
        "Reise und Aufenthalt für Sie organisiert",
        "Begleitung durch die Geschäftsführung",
      ],
    },
    en: {
      name: "Global VIP",
      fuer: "For business owners who want to experience the build-up in person in Miami and sit at the table themselves.",
      dauer: "Support as in Global Capital, with the kick-off in person on site",
      leistungen: [
        "Everything in Global Capital",
        "The kick-off in person in Miami",
        "Appointments with authorities and banks together with our team",
        "Travel and accommodation arranged for you",
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

/** „50.000 $" bzw. „$50,000". */
export function globalPlanungText(key: unknown, sprache: "de" | "en" = "de"): string {
  const usd = globalPaket(key)?.planungUsd ?? 0;
  return sprache === "en" ? "$" + usd.toLocaleString("en-GB") : usd.toLocaleString("de-DE") + " $";
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
    partner: "Steuerberater und Anwälte arbeiten auf eigenes Mandat und rechnen direkt mit Ihnen ab. FIAON erhält dafür keine Vergütung.",
    kosten: "Staatliche Gebühren, Registered Agent sowie die Honorare von Steuerberatern und Anwälten sind im Paketpreis nicht enthalten und werden vor dem Start ausgewiesen.",
  },
  en: {
    fiaon: "FIAON coordinates, prepares, files and attends appointments on the ground. FIAON is neither a law firm nor a bank.",
    partner: "Tax advisers and lawyers act under their own engagement and invoice you directly. FIAON receives no payment for this.",
    kosten: "State fees, the registered agent and the fees of tax advisers and lawyers are not included in the package price and are itemised before work starts.",
  },
} as const;

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
    text: "Stehen Ihre US-Gesellschaft und die EIN nicht zu dem Stichtag, den wir beim Start mit Ihnen vereinbaren, erstatten wir den Paketpreis.",
    bedingungen: "Voraussetzung sind vollständige Unterlagen und Ihre Mitwirkung. Ausgenommen ist die Ablehnung durch eine Behörde aus Gründen, die in Ihrer Person oder Ihrem Unternehmen liegen. Entscheidungen von Banken und Kartenherausgebern sind nicht Gegenstand dieser Zusage.",
  },
  en: {
    titel: "Your money back if we do not deliver",
    text: "If your US company and the EIN are not in place by the date we agree with you at the start, we refund the package price.",
    bedingungen: "This requires complete documents and your cooperation. It does not cover a refusal by an authority for reasons relating to you or your company. Decisions by banks and card issuers are not part of this commitment.",
  },
} as const;

/** Version des Vertragstexts — steht im PDF und in der Auftragsakte. */
export const GLOBAL_VERTRAG_VERSION = "2026-09-17";
