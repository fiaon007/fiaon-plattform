// ============================================================================
// SCHWARZOTT GROUP — Investor Program: Tiers, Benefits & Card definitions
// Shared between the investor portal (/banking) and the admin dashboard.
// ============================================================================

export type InvestorTier = "standard" | "premium" | "circle";

export interface TierDef {
  key: InvestorTier;
  label: string;
  tagline: string;
  /** primary accent color */
  accent: string;
  /** subtle gradient for badges/cards */
  gradient: string;
}

export const TIERS: Record<InvestorTier, TierDef> = {
  standard: {
    key: "standard",
    label: "Standard",
    tagline: "Ihr Einstieg in die Schwarzott Group.",
    accent: "#64748b",
    gradient: "linear-gradient(135deg,#475569,#334155)",
  },
  premium: {
    key: "premium",
    label: "Premium",
    tagline: "Erweiterte Leistungen für aktive Investoren.",
    accent: "#2563eb",
    gradient: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  },
  circle: {
    key: "circle",
    label: "Circle Investor",
    tagline: "Der innerste Kreis. Alles inklusive.",
    accent: "#b8923a",
    gradient: "linear-gradient(135deg,#d4af6a,#b8923a 55%,#8a6d24)",
  },
};

export const TIER_ORDER: InvestorTier[] = ["standard", "premium", "circle"];

export function tierLabel(tier?: string | null): string {
  return TIERS[(tier as InvestorTier)]?.label ?? "Standard";
}

// ----------------------------------------------------------------------------
// Benefits catalog — admin toggles which of these are active per investor.
// ----------------------------------------------------------------------------
export interface BenefitDef {
  key: string;
  title: string;
  description: string;
  /** the tier at which this benefit is typically included (for hints only) */
  includedFrom: InvestorTier;
}

export const BENEFITS: BenefitDef[] = [
  { key: "relationship", title: "Persönlicher Relationship Manager", description: "Ihr dedizierter Ansprechpartner für alle Anliegen – diskret und jederzeit erreichbar.", includedFrom: "premium" },
  { key: "consulting", title: "Unternehmensberatung", description: "Strategische Beratung durch unsere Partner – kostenfrei und unverbindlich.", includedFrom: "circle" },
  { key: "card", title: "Schwarzott Card", description: "Ihre persönliche Metallkarte. Für Circle Investoren ohne Ausgabegebühr.", includedFrom: "circle" },
  { key: "flights", title: "Private Aviation", description: "Zugang zu Privatjet-Charter und First-Class-Arrangements zu Vorzugskonditionen.", includedFrom: "circle" },
  { key: "insurance", title: "Versicherungsschutz", description: "Umfassender Schutz für Sie, Ihre Familie und Ihre Investments.", includedFrom: "circle" },
  { key: "legal", title: "Rechtsabteilung", description: "Direkter Zugang zu unserer hauseigenen Rechtsabteilung für Beratung & Vertretung.", includedFrom: "circle" },
  { key: "tax", title: "Steuerberatung", description: "Steuerliche Optimierung und Strukturierung durch unsere Experten.", includedFrom: "circle" },
  { key: "concierge", title: "24/7 Concierge", description: "Persönlicher Concierge-Service rund um die Uhr – von Reservierung bis Reiseplanung.", includedFrom: "circle" },
  { key: "realestate", title: "Off-Market Immobilien", description: "Vorzugszugang zu exklusiven Immobilien-Opportunitäten abseits des Marktes.", includedFrom: "circle" },
  { key: "events", title: "Exklusive Events", description: "Einladungen zu Investoren-Dinners, Salons und Circle-Gatherings.", includedFrom: "premium" },
];

export const BENEFIT_MAP: Record<string, BenefitDef> = Object.fromEntries(BENEFITS.map((b) => [b.key, b]));

// ----------------------------------------------------------------------------
// Card definitions
// ----------------------------------------------------------------------------
export const CARD_PRICE_EUR = 499;

export type CardDesign = "classic" | "gold" | "circle";

export interface CardDesignDef {
  key: CardDesign;
  label: string;
  /** CSS background for the card face */
  face: string;
  /** text color on the card */
  ink: string;
  /** subtle foil/sheen overlay */
  sheen: string;
}

export const CARD_DESIGNS: Record<CardDesign, CardDesignDef> = {
  classic: {
    key: "classic",
    label: "Classic",
    face: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
    ink: "#e2e8f0",
    sheen: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,.08) 50%,transparent 70%)",
  },
  gold: {
    key: "gold",
    label: "Gold",
    face: "linear-gradient(135deg,#2a2a2a 0%,#1a1a1a 100%)",
    ink: "#e8d9b0",
    sheen: "linear-gradient(115deg,transparent 30%,rgba(212,175,106,.18) 50%,transparent 70%)",
  },
  circle: {
    key: "circle",
    label: "Circle",
    face: "linear-gradient(135deg,#0d1b3e 0%,#101010 60%,#0d1b3e 100%)",
    ink: "#d4af6a",
    sheen: "linear-gradient(115deg,transparent 25%,rgba(212,175,106,.28) 50%,transparent 75%)",
  },
};

export const CARD_STATUS_LABEL: Record<string, string> = {
  requested: "Bestellung eingegangen",
  approved: "Freigegeben",
  in_production: "In Produktion",
  shipped: "Versandt",
  active: "Aktiv",
  cancelled: "Storniert",
};

export const CARD_STATUS_STEPS: { key: string; label: string }[] = [
  { key: "requested", label: "Eingegangen" },
  { key: "approved", label: "Freigegeben" },
  { key: "in_production", label: "Produktion" },
  { key: "shipped", label: "Versand" },
  { key: "active", label: "Aktiv" },
];
