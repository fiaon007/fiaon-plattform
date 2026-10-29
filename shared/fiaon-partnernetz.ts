// ═══════════════════════════════════════════════════════════════════════════
// FIAON PARTNER-NETZWERK FÜR PRIVATKUNDEN (Register E-388, 16.10.2026) — die EINE Quelle für Bereiche, Pfade und Preise
//
// Justin (16.10.2026): „mach eine eigene Seite für die Privatkunden. Für Vermögensberater, Rechtsanwälte, Steuerberater,
// Energieversorger alles was passt wo die sich bei uns bewerben können … bei die Preise pass auf, setze sie lieber höher an“.
//
// ── DIE PREISMODELLE (Entscheidung der Sitzung) ───────────────────────────
//   · je Kontakt bzw. je Abschluss — Vorsorge, Energie, Telefon & Internet: FIAON ist Tippgeber, fest je Kontakt, nie ein
//     Anteil an einer Provision (§ 34d GewO bleibt beim Partner). Lieferung über die Strecke E-386 (Einwilligung am Telefon).
//   · Partnerplatz je Monat — Recht und Steuern: Anwälte dürfen für die Vermittlung von Mandaten nichts zahlen
//     (§ 49b Abs. 3 BRAO), Steuerberater ebenso nicht (§ 9 StBerG). Ein fester Preis für Sichtbarkeit und
//     Terminorganisation, unabhängig davon, ob und wie viele Mandate entstehen, ist zulässig — und nur der steht hier.
//   · Preise bewusst oben im Marktband angesetzt (Justin: „lieber höher“), netto, Reverse Charge, monatliche Rechnung.
// Wer Preise ändert, ändert sie HIER — die FAQ-Antworten im Wörterbuch nennen sie wörtlich (Generator liest nur Zeichenketten)
// und müssen mitgezogen werden.
// ═══════════════════════════════════════════════════════════════════════════

export type NetzBereich = "vorsorge" | "recht" | "steuern" | "energie" | "telekom";
export const NETZ_BEREICHE: NetzBereich[] = ["vorsorge", "recht", "steuern", "energie", "telekom"];

/** Pfade je Sprache. Der Hub und die Demo hängen am selben Stamm. */
export const NETZ_PFAD = {
  de: { hub: "/partnernetzwerk", vorsorge: "/partnernetzwerk/vorsorge", recht: "/partnernetzwerk/recht", steuern: "/partnernetzwerk/steuern", energie: "/partnernetzwerk/energie", telekom: "/partnernetzwerk/telekommunikation" },
  en: { hub: "/en/partner-network", vorsorge: "/en/partner-network/financial-planning", recht: "/en/partner-network/legal", steuern: "/en/partner-network/tax", energie: "/en/partner-network/energy", telekom: "/en/partner-network/telecoms" },
} as const;
/** Der Demo-Zugang: der echte Partnerbereich mit Beispieldaten (client/src/lib/koop-partner-demo.ts). */
export function netzDemoPfad(bereich: NetzBereich): string { return `/partner/demo?bereich=${bereich}`; }

export function netzBereichAusPfad(pfad: string): NetzBereich | "hub" | null {
  const p = pfad.replace(/\/+$/, "") || "/";
  for (const sprache of ["de", "en"] as const) {
    for (const [k, v] of Object.entries(NETZ_PFAD[sprache])) if (v === p) return k as NetzBereich | "hub";
  }
  return null;
}

export type NetzModell = "kontakt" | "abschluss" | "platz";
export interface NetzPreis {
  modell: NetzModell;
  /** Hauptpreis in Cent (je Kontakt, je Abschluss oder je Monat) */
  cents: number;
  /** Zweiter Preis (z. B. Gas neben Strom, Internet neben Mobilfunk) */
  zweitCents?: number;
  /** Höchstzahl Partner je Region (Partnerplatz) */
  jeRegion?: number;
  /** Mindestlaufzeit in Monaten (Partnerplatz) */
  mindestMonate?: number;
  /** Start-Rahmen bis zur ersten bezahlten Rechnung (je Kontakt) */
  startDeckel?: number;
}
export const NETZ_PREISE: Record<NetzBereich, NetzPreis> = {
  vorsorge: { modell: "kontakt", cents: 8_900, startDeckel: 40 },
  recht: { modell: "platz", cents: 69_000, jeRegion: 3, mindestMonate: 3 },
  steuern: { modell: "platz", cents: 49_000, jeRegion: 3, mindestMonate: 3 },
  energie: { modell: "abschluss", cents: 12_900, zweitCents: 15_900, startDeckel: 50 },
  telekom: { modell: "abschluss", cents: 9_900, zweitCents: 14_900, startDeckel: 50 },
};
export function netzEur(cents: number, en = false): string {
  const e = Math.round(cents) / 100;
  return en
    ? `€${e.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })}`
    : `${e.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

/** Für die Bewerbung (Anfrage art „netzwerk“) — der Bereich steht als Feld in der Anfrage. */
export const NETZ_BEREICH_NAME: Record<NetzBereich, { de: string; en: string }> = {
  vorsorge: { de: "Vorsorge & Versicherung", en: "Financial planning & insurance" },
  recht: { de: "Recht", en: "Legal" },
  steuern: { de: "Steuern", en: "Tax" },
  energie: { de: "Energie", en: "Energy" },
  telekom: { de: "Telefon & Internet", en: "Phone & internet" },
};
