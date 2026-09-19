// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DIE GEMEINSAMEN GRUNDLAGEN (19.09.2026)
//
// Justin: „Baue alles fix fertig für den Radar (aber nicht bei Nikita, Admin!),
// der uns PERFEKTE Firmen sucht (jeden Tag 50) bzw. auf Knopfdruck: Bereich
// wählen, Firma wählen, dann scannt die KI das gesamte Unternehmen und schreibt
// eine super personalisierte E-Mail — 100 % angepasst, 100 % menschlich, auf den
// Kauf aus. Kein Massenversand, sondern 100 % personalisiert."
//
// Hier steht, was Server und Chefbüro gleich sehen müssen: die Bereiche (mit der
// passenden FIAON-Seite für den Link in der Mail), das Zielbild einer perfekten
// Firma, die Stände einer Firma im Radar und das Tagesziel. Die Arbeit selbst
// macht server/lib/fiaon-radar.ts, die Oberfläche components/admin/ChefRadar.tsx.
// ═══════════════════════════════════════════════════════════════════════════

export const RADAR_TAGESZIEL = 50;

export type RadarLand = "DE" | "AT" | "CH";
export const RADAR_LAENDER: readonly RadarLand[] = ["DE", "AT", "CH"];

export interface RadarBereich {
  key: string;
  label: string;
  /** Ein Satz fürs Chefbüro. */
  satz: string;
  /** Wonach die KI im Netz sucht — Branchen, Signale, typische Firmen. */
  suche: string;
  /** Die FIAON-Seite, auf die die Mail verweist (Zielgruppen-Seite oder die Übersicht). */
  seite: string;
}

export const RADAR_BEREICHE: readonly RadarBereich[] = [
  { key: "onlinehandel", label: "Onlinehandel & Marken", seite: "/business/onlinehandel",
    satz: "Shops und Marken, die in die USA verkaufen oder es vorhaben.",
    suche: "inhabergeführte Onlineshops und D2C-Marken (Shopify, Amazon, eigener Shop) mit Versand in die USA, englischer Shopversion, US-Marktplatz oder Plänen für den US-Markt" },
  { key: "software", label: "Software, SaaS & Agenturen", seite: "/business/agenturen-software",
    satz: "Software-Firmen und Agenturen mit internationalen Kunden.",
    suche: "Software- und SaaS-Unternehmen, Digital- und Marketingagenturen mit US- oder internationalen Kunden, englischer Website, Wachstum und Einstellungen" },
  { key: "bau", label: "Bau, Immobilien & Projektentwicklung", seite: "/business/bau-immobilien",
    satz: "Bauträger, Projektentwickler und Immobilienunternehmen mit Wachstumsplänen.",
    suche: "Bauträger, Projektentwickler und Immobilienunternehmen mit laufenden Projekten, neuen Standorten, Investitionsvorhaben oder Interesse an Immobilien und Projekten in den USA" },
  { key: "mittelstand", label: "Industrie & Mittelstand (Export)", seite: "/business/tochtergesellschaft-usa",
    satz: "Hersteller und Zulieferer mit Exportgeschäft, die in den USA Fuß fassen.",
    suche: "mittelständische Hersteller, Maschinenbauer und Zulieferer mit Export, US-Kunden, US-Vertriebspartnern oder Messeauftritten in den USA" },
  { key: "konsum", label: "Konsumgüter, Food & Lifestyle", seite: "/business/onlinehandel",
    satz: "Hersteller von Lebensmitteln, Kosmetik und Lifestyle-Produkten mit Expansion.",
    suche: "Hersteller von Lebensmitteln, Getränken, Kosmetik, Mode und Lifestyle-Produkten mit internationalem Vertrieb, Exportplänen oder US-Händlern" },
  { key: "gesundheit", label: "Gesundheit & Medizintechnik", seite: "/business/tochtergesellschaft-usa",
    satz: "Medizintechnik, Health-Tech und Gesundheitsanbieter mit US-Ambitionen.",
    suche: "Medizintechnik-, Health-Tech- und Laborunternehmen sowie Gesundheitsanbieter mit internationalem Vertrieb, US-Zulassungsplänen oder US-Partnern" },
  { key: "energie", label: "Energie, Cleantech & Mobilität", seite: "/business",
    satz: "Energie- und Cleantech-Firmen, die wachsen und investieren.",
    suche: "Unternehmen aus Solar, Energiespeicher, Cleantech und E-Mobilität mit Wachstum, Investitionsbedarf oder internationalen Projekten" },
  { key: "logistik", label: "Logistik, Handel & Import/Export", seite: "/business",
    satz: "Händler und Logistiker mit internationalem Warenverkehr.",
    suche: "Groß- und Außenhändler, Importeure, Exporteure und Logistikdienstleister mit Warenverkehr in die USA oder aus den USA" },
  { key: "franchise", label: "Franchise, Gastronomie & Hotellerie", seite: "/business",
    satz: "Konzepte, die expandieren — Franchise, Gastronomie, Hotels.",
    suche: "Franchise-Systeme, Gastronomie- und Hotelkonzepte mit Expansion, neuen Standorten oder internationalen Plänen" },
  { key: "startups", label: "Start-ups mit Kapitalbedarf", seite: "/business",
    satz: "Junge Firmen, die wachsen wollen und Kapital suchen.",
    suche: "Start-ups und junge Wachstumsunternehmen mit laufender oder geplanter Finanzierung, Kapitalbedarf, internationalen Plänen oder US-Markteintritt" },
];

export function radarBereich(key: unknown): RadarBereich | null {
  return RADAR_BEREICHE.find((b) => b.key === String(key ?? "")) ?? null;
}

/** Das Bild der perfekten Firma — die KI sucht danach, das Chefbüro zeigt es. */
export const RADAR_ZIELBILD = {
  muss: [
    "Sitz in Deutschland, Österreich oder der Schweiz, eigene Website mit Impressum",
    "Inhabergeführt oder mittelständisch — etwa 5 bis 250 Mitarbeiter",
    "Mindestens ein Signal: US- oder Auslandsbezug, Wachstum (Standorte, Einstellungen, Projekte) oder Kapitalbedarf",
    "Noch KEINE eigene US-Gesellschaft — dann ist der Aufbau unser Auftrag. Eine bestehende US-Tochter passt nur bei klarem Kapitalbedarf",
  ],
  nie: [
    "Konzerne, börsennotierte Unternehmen, Behörden, Vereine, Stiftungen",
    "Banken, Versicherungen, Finanzdienstleister, Krypto-Handel, Glücksspiel, Erotik, Waffen",
    "Anbieter wie wir selbst: Gründungsdienste, US-Steuerkanzleien, Firmengründungs-Agenturen",
    "Firmen in Insolvenz oder Liquidation",
  ],
} as const;

export type RadarStatus = "neu" | "gescannt" | "mail" | "im_postfach" | "versendet" | "antwort" | "kein_interesse" | "gesperrt";

export const RADAR_STATUS: Record<RadarStatus, { label: string; ton: "neu" | "arbeit" | "gut" | "aus" }> = {
  neu: { label: "Neu", ton: "neu" },
  gescannt: { label: "Gescannt", ton: "arbeit" },
  mail: { label: "Mail geschrieben", ton: "arbeit" },
  im_postfach: { label: "Entwurf im Postfach", ton: "arbeit" },
  versendet: { label: "Versendet", ton: "gut" },
  antwort: { label: "Antwort erhalten", ton: "gut" },
  kein_interesse: { label: "Kein Interesse", ton: "aus" },
  gesperrt: { label: "Gesperrt", ton: "aus" },
};

export const RADAR_PAKETE = ["global_struktur", "global_banking", "global_kapital", "global_vip"] as const;
export type RadarPaket = (typeof RADAR_PAKETE)[number];

/** Die Kennung, unter der Besuche aus einer Radar-Mail in der Kampagnen-Zuordnung landen. */
export const RADAR_KAMPAGNE = "firmen_radar";

/** Domäne einer Website: klein, ohne Schema, ohne www., ohne Pfad — oder null. */
export function radarDomain(roh: unknown): string | null {
  let s = String(roh ?? "").trim().toLowerCase();
  if (!s || s.includes("@")) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.username || u.password || !/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^www\d?\./, "").replace(/\.$/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || host.length > 120) return null;
    return host;
  } catch {
    return null;
  }
}

/** Freemail-Domänen: nie eine Firmen-Website, nie eine Firmen-Domäne für die Sperrliste. */
export const RADAR_FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "web.de", "t-online.de", "yahoo.com", "yahoo.de",
  "hotmail.com", "hotmail.de", "outlook.com", "outlook.de", "live.com", "icloud.com", "me.com", "aon.at", "bluewin.ch", "freenet.de", "posteo.de", "proton.me", "protonmail.com",
]);

/** „DE" | „AT" | „CH" aus einer Eingabe — sonst null (dann sucht der Radar in allen drei Ländern). */
export function alsRadarLand(roh: unknown): RadarLand | null {
  const s = String(roh ?? "").trim().toUpperCase();
  return (RADAR_LAENDER as readonly string[]).includes(s) ? (s as RadarLand) : null;
}
