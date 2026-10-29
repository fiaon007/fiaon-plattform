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

import { FIAON_FIRMA } from "./fiaon-firma";

export const RADAR_TAGESZIEL = 50;

export type RadarLand = "DE" | "AT" | "CH";
export const RADAR_LAENDER: readonly RadarLand[] = ["DE", "AT", "CH"];
/**
 * E-458 (Justin 29.10.2026): „lass Österreich komplett weg, kein Brief, keine Email nur DE und CH – später erweitern wir passend“.
 * Nur in diesen Ländern sucht der Radar, und nur hierhin schreibt die Automatik (erste Mail, Nachfass, Wiedervorlage, Brief).
 * Österreich wieder aufnehmen = hier ergänzen.
 */
export const RADAR_LAENDER_AKTIV: readonly RadarLand[] = ["DE", "CH"];
/** Ohne Angabe gilt Deutschland (wie beim Anlegen einer Firma). */
export function radarLandAktiv(land: unknown): boolean {
  return (RADAR_LAENDER_AKTIV as readonly string[]).includes(String(land || "DE").trim().toUpperCase());
}

export interface RadarBereich {
  key: string;
  label: string;
  /** Ein Satz fürs Chefbüro. */
  satz: string;
  /** Wonach die KI im Netz sucht — Branchen, Signale, typische Firmen. */
  suche: string;
  /**
   * Die FIAON-Seite, auf die die Mail verweist (Zielgruppen-Seite /business/… oder die Übersicht). Die Übersicht ist seit
   * E-461 (29.10.2026) die Startseite „/“ — /business leitet nur noch per 301 dorthin, ein Link soll ohne Umweg ankommen.
   */
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
  { key: "energie", label: "Energie, Cleantech & Mobilität", seite: "/",
    satz: "Energie- und Cleantech-Firmen, die wachsen und investieren.",
    suche: "Unternehmen aus Solar, Energiespeicher, Cleantech und E-Mobilität mit Wachstum, Investitionsbedarf oder internationalen Projekten" },
  { key: "logistik", label: "Logistik, Handel & Import/Export", seite: "/",
    satz: "Händler und Logistiker mit internationalem Warenverkehr.",
    suche: "Groß- und Außenhändler, Importeure, Exporteure und Logistikdienstleister mit Warenverkehr in die USA oder aus den USA" },
  { key: "franchise", label: "Franchise, Gastronomie & Hotellerie", seite: "/",
    satz: "Konzepte, die expandieren — Franchise, Gastronomie, Hotels.",
    suche: "Franchise-Systeme, Gastronomie- und Hotelkonzepte mit Expansion, neuen Standorten oder internationalen Plänen" },
  { key: "startups", label: "Start-ups mit Kapitalbedarf", seite: "/",
    satz: "Junge Firmen, die wachsen wollen und Kapital suchen.",
    suche: "Start-ups und junge Wachstumsunternehmen mit laufender oder geplanter Finanzierung, Kapitalbedarf, internationalen Plänen oder US-Markteintritt" },
];

export function radarBereich(key: unknown): RadarBereich | null {
  return RADAR_BEREICHE.find((b) => b.key === String(key ?? "")) ?? null;
}

/** Das Bild der perfekten Firma — die KI sucht danach, das Chefbüro zeigt es. */
// E-337 (12.10.2026): vorher fand der Radar „Wachstum oder US-Bezug“ — und damit VC-finanzierte Scale-ups mit eigenem
// Finanzchef (Langdock, Kraftblock, neustark, FENECON mit 400 Mitarbeitern und US-Fabrik). Unser Käufer ist der Inhaber
// einer kleinen oder mittleren Firma, der JETZT Kapital braucht. Ohne belegtes Kapitalsignal schreibt Mara nicht selbst.
export const RADAR_ZIELBILD = {
  muss: [
    // E-458 (Justin 29.10.2026): Österreich vorerst raus — gesucht wird nur in Deutschland und der Schweiz.
    "Sitz in Deutschland oder der Schweiz, eigene Website mit Impressum",
    "Inhabergeführt, etwa 3 bis 150 Mitarbeiter — der Inhaber oder Geschäftsführer entscheidet selbst",
    "Ein belegtes Kapitalsignal: sucht Kapital, finanziert sich gerade, expandiert vor der Finanzierung, geht in die USA oder ist jung mit Investitionsvorhaben",
    "Noch KEINE eigene US-Gesellschaft — dann ist der Aufbau unser Auftrag",
  ],
  nie: [
    "Konzerne, börsennotierte Unternehmen, Behörden, Vereine, Stiftungen",
    "VC-finanzierte Scale-ups mit Runden über etwa 10 Mio. € oder eigenem Finanzvorstand",
    "Banken, Versicherungen, Finanzdienstleister, Krypto-Handel, Glücksspiel, Erotik, Waffen",
    "Anbieter wie wir selbst: Gründungsdienste, US-Steuerkanzleien, Firmengründungs-Agenturen",
    "Firmen in Insolvenz oder Liquidation",
  ],
} as const;

// ── DER SIGNAL-JÄGER (E-337) ────────────────────────────────────────────────
// Stärke wie in der Recherche vom 12.10.2026 (side-session-notes/radar-recherche-kapitalsignale-2026-10-12.md):
// 5 = sagt selbst „wir suchen Kapital“ · 4 = finanziert sich gerade sichtbar · 3 = Lage macht Bedarf wahrscheinlich ·
// 2 = indirekt (Wachstum, Professionalisierung) · 1 = kaum. Ein Signal zählt nur mit WÖRTLICHEM Beleg auf der
// genannten Seite (wie die Aufhänger) — sonst höchstens Stärke 2. Automatisch angeschrieben wird ab RADAR_SIGNAL_AB.
export interface RadarSignal { key: string; label: string; staerke: number; suche: string }
export const RADAR_SIGNALE: readonly RadarSignal[] = [
  { key: "kapital_gesucht", label: "Sucht Kapital", staerke: 5,
    suche: "Firmen, die öffentlich Kapital, Investoren, eine Beteiligung oder ein Darlehen suchen — auf der eigenen Website („Investoren gesucht“, „Beteiligungsmöglichkeit“), in einer Pressemitteilung oder als Gesuch auf einer Unternehmensbörse (companymarket.ch, DUB-Minderheitsbeteiligung)" },
  { key: "crowd", label: "Crowdinvesting läuft", staerke: 4,
    suche: "Firmen mit einer laufenden oder gerade abgeschlossenen Crowdinvesting- oder Crowdlending-Kampagne (Companisto, FunderNation, Wiwin, Conda, Rockets, dagobertinvest, Invesdor, GLS Crowd, Bergfürst, Econeers) — echte Betriebe, keine reinen Immobilien-Projektgesellschaften" },
  { key: "finanzierung", label: "Finanziert sich gerade", staerke: 4,
    suche: "kleine und mittlere Firmen, die 2025/2026 eine Finanzierung, Förderzusage, Kapitalerhöhung oder einen Förderkredit melden und weiter investieren — keine VC-Runden über 10 Mio. €" },
  { key: "expansion", label: "Expansion vor der Finanzierung", staerke: 3,
    suche: "inhabergeführte Firmen, die 2025/2026 konkret neue Standorte, Filialen, ein Werk, eine Halle, neue Märkte oder einen Franchise-Ausbau ankündigen — Investitionen, bevor der Umsatz kommt" },
  { key: "usa", label: "Geht in die USA", staerke: 3,
    suche: "DACH-Firmen, die den US-Markt angehen (US-Messe oder German Pavilion, US-Vertrieb, US-Marke, Versand in die USA, US-Händler) und noch KEINE eigene US-Gesellschaft haben" },
  { key: "neugruendung", label: "Junge Firma mit Vorhaben", staerke: 3,
    suche: "junge GmbH, UG oder AG (gegründet 2024–2026) mit einem konkreten Investitionsvorhaben (Produktion, Fahrzeuge, Ladenlokal, Lager, Ausstattung), sichtbar auf der Website oder in Meldungen" },
  { key: "finance_stelle", label: "Baut die Finanzen auf", staerke: 2,
    suche: "kleine Firmen unter 100 Mitarbeitern, die gerade Finanzbuchhaltung, Controlling oder eine kaufmännische Leitung einstellen und wachsen" },
];
/** Ab dieser Signalstärke schreibt Mara automatisch (Justin, 12.10.: „Nur Stärke ≥ 3 wird angeschrieben“). */
export const RADAR_SIGNAL_AB = 3;
export function radarSignal(key: unknown): RadarSignal | null {
  return RADAR_SIGNALE.find((x) => x.key === String(key ?? "")) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-458 (29.10.2026) — DER PARTNER-STROM: Menschen, die uns Kunden bringen
//
// Justin: „Mara soll sich auch Steuerberater, Finanzierer, Kreditvermittler, Anwälte und was weiß ich suchen und
// anschreiben als Kooperationspartner.“ Gesucht werden Menschen, deren Mandanten oder Kunden eine US-Gesellschaft, ein
// Konto, Karten oder Kapital brauchen. Eigene Liste (RADAR_BEREICHE bleiben die zehn Branchen der Firmen): je Gruppe,
// wonach die KI sucht, was wir anbieten und welche eine Frage die Mail stellt. Steuerberater und Anwälte bekommen KEINE
// Provision (berufsrechtlich nicht möglich) — wir gründen ihren Mandanten eine US-Gesellschaft und kümmern uns um Konto
// und Karten (über beides entscheidet die Bank, deshalb nie „bekommen bei uns“), die Kanzlei behält die Betreuung, wir
// stellen uns gegenseitig Mandanten vor. Alle anderen: Tippgeber mit dem Provisions-Satz aus dem Chefbüro (Vorgabe
// „30 Prozent unseres Honorars, ein Jahr lang“, Kooperationsmodell E-419; verbindlich ist allein der IA-KOOP-Vertrag).
// Partner bekommen nie einen Terminlink und nie einen Gesprächswunsch — Konditionen gehen schriftlich (keine Meetings).
// ═══════════════════════════════════════════════════════════════════════════
export interface RadarPartnerGruppe {
  key: string; label: string;
  /** Wonach die KI im Netz sucht. */
  suche: string;
  /** Was wir dieser Gruppe anbieten — die Mail sagt es in eigenen Worten. */
  angebot: string;
  /** Eine Frage, wie die Mail sie stellen kann (schriftlich beantwortbar, kein Termin). */
  frage: string;
  /** Tippgeber-Provision erlaubt? Steuerberater und Anwälte: nein (Berufsrecht). */
  provision: boolean;
  /** Art der Akte im Partner-CRM (PARTNER_ARTEN). */
  crmArt: "kanzlei" | "kooperation";
}
/** Der Platzhalter für den Provisions-Satz aus dem Chefbüro (radar_partner_provision_text) — EINE Quelle für Mail, Prüf-KI, Mara und CRM. */
export const RADAR_PROVISION_PLATZHALTER = "{PROVISION}";
// E-458 (Befund): Über Konto und Karte entscheidet die Bank — wir „kümmern uns darum“, nie „Ihre Kunden bekommen bei uns“.
const ANGEBOT_PROVISION = "Wir gründen Ihren Kunden eine eigene US-Gesellschaft und kümmern uns um Geschäftskonto, Firmenkarten und den Weg zu US-Funding. Für jeden Kunden, den Sie uns vorstellen, bekommen Sie {PROVISION}.";
export const RADAR_PARTNER_GRUPPEN: readonly RadarPartnerGruppe[] = [
  { key: "steuerberater", label: "Steuerberater und Steuerkanzleien", provision: false, crmArt: "kanzlei",
    suche: "inhabergeführte Steuerkanzleien und Steuerberater mit Unternehmern als Mandanten (Onlinehandel, Mittelstand, Gründer), gern mit internationalem Steuerrecht oder Mandanten mit Geschäft im Ausland",
    angebot: "Wir gründen Ihren Mandanten eine eigene US-Gesellschaft und kümmern uns um Geschäftskonto und Firmenkarten. Die steuerliche Betreuung bleibt ganz bei Ihnen, und wir stellen uns gegenseitig Mandanten vor.",
    frage: "Haben Sie Mandanten, für die eine eigene Gesellschaft in den USA gerade ein Thema ist?" },
  { key: "rechtsanwaelte", label: "Rechtsanwälte (Wirtschafts-, Gesellschafts-, internationales Recht)", provision: false, crmArt: "kanzlei",
    suche: "inhabergeführte Kanzleien für Wirtschafts-, Gesellschafts- oder internationales Recht mit Unternehmern und Gründern als Mandanten, keine Großkanzleien",
    angebot: "Wir gründen Ihren Mandanten eine eigene US-Gesellschaft und kümmern uns um Geschäftskonto und Firmenkarten. Die rechtliche Betreuung bleibt ganz bei Ihnen, und wir stellen uns gegenseitig Mandanten vor.",
    frage: "Gibt es unter Ihren Mandanten Unternehmer, die gerade in die USA gehen wollen?" },
  { key: "finanzierer", label: "Finanzierer und Finanzierungsberater", provision: true, crmArt: "kooperation",
    suche: "unabhängige Finanzierungsvermittler, Finanzierungsberater und kleine Finanzierungshäuser, die mittelständischen Unternehmern Kapital besorgen (keine Banken, keine Versicherer)",
    angebot: ANGEBOT_PROVISION, frage: "Darf ich Ihnen die Konditionen dafür schriftlich schicken?" },
  { key: "kreditvermittler", label: "Kreditvermittler", provision: true, crmArt: "kooperation",
    suche: "inhabergeführte Kreditvermittler und Darlehensvermittler für Gewerbekunden, Selbstständige und den Mittelstand",
    angebot: ANGEBOT_PROVISION, frage: "Haben Sie Kunden, denen eine zweite Kapitalquelle in den USA helfen würde?" },
  { key: "foerdermittel", label: "Fördermittelberater", provision: true, crmArt: "kooperation",
    suche: "Fördermittelberater und Förderlotsen, die kleine und mittlere Unternehmen zu Förderkrediten und Zuschüssen begleiten",
    angebot: ANGEBOT_PROVISION, frage: "Haben Sie Kunden, für die eine zweite Kapitalquelle in den USA gerade passen würde?" },
  { key: "vermoegen", label: "Vermögens- und Finanzberater", provision: true, crmArt: "kooperation",
    suche: "unabhängige Vermögensverwalter, Finanzplaner und Family Offices mit Unternehmern als Kunden (keine Banken, keine Versicherer, keine Strukturvertriebe)",
    angebot: ANGEBOT_PROVISION, frage: "Haben Sie Unternehmer unter Ihren Kunden, für die eine eigene Gesellschaft in den USA ein Thema ist?" },
  { key: "unternehmensberater", label: "Unternehmensberater", provision: true, crmArt: "kooperation",
    suche: "inhabergeführte Unternehmensberatungen für kleine und mittlere Unternehmen (Wachstum, Internationalisierung, Finanzen), keine großen Beratungshäuser",
    angebot: ANGEBOT_PROVISION, frage: "Darf ich Ihnen die Konditionen dafür schriftlich schicken?" },
  { key: "gruendung", label: "Gründungsbegleiter und Gründerzentren", provision: true, crmArt: "kooperation",
    suche: "Gründercoaches, Gründungsbegleiter und private Gründerzentren, die Start-ups und junge GmbHs begleiten (keine Anbieter, die selbst US-Gesellschaften gründen)",
    angebot: ANGEBOT_PROVISION, frage: "Begegnen Ihnen Gründer, die von Anfang an auch in den USA verkaufen wollen?" },
  { key: "ecommerce", label: "E-Commerce-Agenturen", provision: true, crmArt: "kooperation",
    suche: "Shopify-, Amazon- und E-Commerce-Agenturen in Deutschland und der Schweiz, die Onlinehändler beim Verkauf in die USA unterstützen",
    angebot: ANGEBOT_PROVISION, frage: "Haben Sie Händler unter Ihren Kunden, die gerade in die USA verkaufen wollen?" },
  { key: "us_expansion", label: "US-Expansionsbegleiter", provision: true, crmArt: "kooperation",
    suche: "Begleiter und Netzwerke für den Markteintritt in den USA (Messen, Vertrieb, Marketing), die selbst KEINE US-Gesellschaften gründen und keine Konten vermitteln",
    angebot: ANGEBOT_PROVISION, frage: "Haben Sie Kunden, denen für den Schritt in die USA noch die eigene Gesellschaft fehlt?" },
];
export function radarPartnerGruppe(key: unknown): RadarPartnerGruppe | null {
  return RADAR_PARTNER_GRUPPEN.find((g) => g.key === String(key ?? "")) ?? null;
}
/** Das Angebot einer Gruppe mit dem Provisions-Satz aus dem Chefbüro eingesetzt. Ohne Gruppe der neutrale Satz. Rein. */
export function radarPartnerAngebot(g: RadarPartnerGruppe | null | undefined, provisionText?: string | null): string {
  if (!g) return "Wir gründen Ihren Kunden eine eigene US-Gesellschaft und kümmern uns um Geschäftskonto und Firmenkarten.";
  return g.angebot.replace(RADAR_PROVISION_PLATZHALTER, String(provisionText || RADAR_MOTOR_VORGABE.partnerProvisionText));
}
/**
 * E-458 (Befund Prüf-KI 29.10.2026): Das Angebot für die Schreib-KI als INHALT („was drinstehen muss“), nicht als fertiger
 * Satz — acht von zehn Gruppen teilten denselben Satz, die Mails glichen sich zu 40 % und fielen durch den Fingerabdruck.
 * Kanzleien bekommen statt des hohlen „wir stellen uns gegenseitig Mandanten vor“ einen echten Grund. Rein.
 */
export function radarPartnerAngebotPunkte(g: RadarPartnerGruppe | null | undefined, provisionText?: string | null): string[] {
  const satz = String(provisionText || RADAR_MOTOR_VORGABE.partnerProvisionText);
  if (g && !g.provision) {
    const betreuung = g.key === "rechtsanwaelte" ? "rechtliche" : "steuerliche";
    return [
      "wir gründen ihren Mandanten eine eigene Gesellschaft in den USA",
      "wir kümmern uns um Geschäftskonto und Firmenkarten (darüber entscheidet die Bank, also nie „bekommen bei uns“)",
      `die ${betreuung} Betreuung bleibt ganz bei der Kanzlei`,
      `ein echter Grund für die Kanzlei: Unsere Kunden brauchen für ihre US-Gesellschaft oft eine Kanzlei in Deutschland, die beide Seiten kennt`,
    ];
  }
  return [
    "wir gründen ihren Kunden eine eigene Gesellschaft in den USA",
    "wir kümmern uns um Geschäftskonto und Firmenkarten oder helfen dabei (darüber entscheidet die Bank, also nie „bekommen bei uns“)",
    `für jeden Kunden, den der Partner vorstellt, bekommt er wörtlich „${satz}“`,
    "sein eigenes Geschäft mit dem Kunden bleibt davon unberührt",
  ];
}

/** Das Bild eines guten Partners — die KI sucht danach, das Chefbüro zeigt es. */
export const RADAR_PARTNER_ZIELBILD = {
  muss: [
    "Sitz in Deutschland oder der Schweiz, eigene Website mit Impressum",
    "Inhabergeführt, etwa 1 bis 50 Berufsträger — die Inhaberin oder der Partner entscheidet selbst",
    "Die Mandanten oder Kunden sind Unternehmer in DACH, mit wörtlichem Beleg auf der Website",
  ],
  nie: [
    "Großkanzleien, Big Four, Konzerne, Banken, Versicherer, Strukturvertriebe",
    "Wer selbst US-Gesellschaften gründet oder Konten und Karten vermittelt (Wettbewerber)",
    "Kanzleien oder Firmen in Insolvenz oder Liquidation",
  ],
} as const;

/** Wie nah ist der Partner an unseren Kunden? Wie die Kapitalsignale: nur mit WÖRTLICHEM Beleg, sonst höchstens 2. */
export const RADAR_PARTNER_SIGNALE: readonly RadarSignal[] = [
  { key: "p_us_expansion", label: "Begleitet in die USA", staerke: 5, suche: "berät oder begleitet Unternehmer ausdrücklich beim Schritt in die USA (US-Gesellschaft, US-Markt, US-Vertrieb)" },
  { key: "p_international", label: "Internationales Steuer- oder Gesellschaftsrecht", staerke: 4, suche: "Schwerpunkt internationales Steuerrecht, Gesellschaftsrecht oder Auslandsgesellschaften" },
  { key: "p_finanzierung", label: "Besorgt Unternehmern Kapital", staerke: 4, suche: "vermittelt oder begleitet Finanzierungen, Förderkredite oder Kapital für Unternehmer" },
  { key: "p_foerdermittel", label: "Fördermittel für Unternehmer", staerke: 4, suche: "begleitet Unternehmer zu Fördermitteln und Förderkrediten" },
  { key: "p_gruender", label: "Gründer als Mandanten", staerke: 3, suche: "betreut ausdrücklich Gründer, Start-ups oder junge GmbHs" },
  { key: "p_ecommerce", label: "Onlinehändler als Mandanten", staerke: 3, suche: "betreut Onlinehändler, Shopify- oder Amazon-Händler" },
  { key: "p_unternehmer", label: "Unternehmer als Mandanten", staerke: 3, suche: "Mandanten sind ausdrücklich Unternehmer und Mittelstand" },
  { key: "p_privat", label: "Überwiegend Privatkunden", staerke: 2, suche: "Mandanten sind überwiegend Privatpersonen" },
];
export function radarPartnerSignal(key: unknown): RadarSignal | null {
  return RADAR_PARTNER_SIGNALE.find((x) => x.key === String(key ?? "")) ?? null;
}
/** Das Signal je Strom: Firmen bekommen nur Kapitalsignale, Partner nur Partnersignale. Rein. */
export function radarSignalFuer(key: unknown, strom: RadarStrom = "firma"): RadarSignal | null {
  return strom === "partner" ? radarPartnerSignal(key) : radarSignal(key);
}

/** Der nächste Werktag (Mo–Fr) nach einem Tag „YYYY-MM-DD“. Rein. */
export function radarNaechsterWerktag(tag: string): string {
  const d = new Date(`${String(tag).slice(0, 10)}T12:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Was eine positive Partner-Antwort im Partner-CRM anlegt (Chefbüro › Geschäftspartner): Firma mit Art und Kondition je
 * Gruppe, der Entscheider als Hauptkontakt, die Antwort als Verlauf, eine Aufgabe für den nächsten Werktag. Rein — der
 * Server übergibt es an uebernehmen() (eine Transaktion).
 */
export function radarPartnerCrmEingabe(e: {
  firma: { name: string; website?: string | null; email?: string | null; bereich?: string | null; impressum?: any; entscheider?: { name?: string | null; rolle?: string | null; email?: string | null } | null };
  antwort: { text: string; zusammenfassung?: string | null; datum: Date | string; telefon?: string | null };
  heute: string;
  /** E-458 (Befund): der Provisions-Satz aus dem Chefbüro — dieselbe Fassung wie in der Mail. */
  provisionText?: string | null;
}) {
  const g = radarPartnerGruppe(e.firma.bereich);
  const provision = g ? g.provision : true;
  const provisionText = String(e.provisionText || RADAR_MOTOR_VORGABE.partnerProvisionText);
  const imp = e.firma.impressum && typeof e.firma.impressum === "object" ? e.firma.impressum : {};
  const strasseRoh = String(imp.strasse ?? "").trim();
  const hausnummer = (strasseRoh.match(/\s(\d+\s?[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/)?.[1] ?? "").trim();
  const am = new Date(e.antwort.datum);
  return {
    firma: {
      name: String(e.firma.name ?? "").slice(0, 160), art: (g?.crmArt ?? "kooperation") as "kanzlei" | "kooperation", status: "gespraech",
      website: String(e.firma.website ?? ""), email: String(e.firma.email ?? ""), telefon: String(imp.telefon ?? e.antwort.telefon ?? ""),
      strasse: hausnummer ? strasseRoh.slice(0, strasseRoh.length - hausnummer.length).trim() : strasseRoh, hausnummer, adresszusatz: "",
      plz: String(imp.plz ?? ""), ort: String(imp.ort ?? ""), region: "", landCode: String(imp.land ?? ""),
      registerNr: String(imp.registernummer ?? ""), steuerNr: "", ustId: String(imp.ustId ?? imp.ust_id ?? ""),
      leistung: `${g?.label ?? "Kooperationspartner"} · über den Firmen-Radar`,
      tags: ["radar", ...(g ? [g.key] : [])],
      konditionen: [provision
        ? { label: "Provision", value: `${provisionText}, je vorgestelltem Kunden (Tippgeber, IA-KOOP-Vertrag)` }
        : { label: "Zusammenarbeit", value: "gegenseitig, ohne Provision (Berufsrecht) — wir gründen den Mandanten die US-Gesellschaft und kümmern uns um Konto und Karten; die Betreuung bleibt bei der Kanzlei" }],
    },
    kontakte: e.firma.entscheider?.name ? [{
      name: String(e.firma.entscheider.name), rolle: String(e.firma.entscheider.rolle ?? ""), email: String(e.firma.entscheider.email ?? e.firma.email ?? ""),
      telefon: String(e.antwort.telefon ?? ""), mobil: "", durchwahl: "", erreichbarkeit: "", sprache: "de", notiz: "Antwortete auf die Radar-Mail.", haupt: true,
    }] : [],
    verlauf: { typ: "email" as const, am: Number.isFinite(am.getTime()) ? am.toISOString().slice(0, 10) : e.heute, titel: `Antwort auf Maras Partner-Mail: ${String(e.antwort.zusammenfassung ?? "Interesse").slice(0, 120)}`, text: String(e.antwort.text ?? "").slice(0, 4000) },
    aufgabe: {
      titel: provision ? "Tippgeber-Vereinbarung schicken (IA-KOOP)" : "Kooperation ohne Provision schriftlich bestätigen",
      faelligAm: radarNaechsterWerktag(e.heute),
      notiz: provision ? "Partner hat auf die Radar-Mail positiv geantwortet. Vereinbarung per scripts/angebot-koop-anlegen.ts schicken." : "Kanzlei hat positiv geantwortet. Zusammenarbeit (gegenseitige Vorstellung, ohne Provision) schriftlich bestätigen.",
    },
  };
}

export type RadarStatus =
  | "neu" | "gescannt" | "mail" | "im_postfach" | "versendet" | "brief" | "antwort"
  | "lead" | "termin" | "angebot" | "kauf"
  | "ohne_kontakt" | "unzustellbar" | "passt_nicht" | "kein_interesse" | "gesperrt";

// E-337 (12.10.2026): Der Weg endet nicht mehr bei „Versendet“. Justin: „10 Leads und 5 Käufe am Tag, gesteuert über
// Mara“ — also muss der Radar wissen, was nach der Mail geschah. Lead = die Firma hat Interesse gezeigt oder eine
// Sachfrage gestellt; Termin, Angebot und Kauf kommen aus dem Kalender und den Global-Aufträgen (radarAbgleich).
export const RADAR_STATUS: Record<RadarStatus, { label: string; ton: "neu" | "arbeit" | "gut" | "top" | "aus" }> = {
  neu: { label: "Neu", ton: "neu" },
  gescannt: { label: "Gescannt", ton: "arbeit" },
  mail: { label: "Mail geschrieben", ton: "arbeit" },
  im_postfach: { label: "Entwurf im Postfach", ton: "arbeit" },
  versendet: { label: "Versendet", ton: "arbeit" },
  // E-339 (12.10.2026): der erste Kontakt ging als Brief an den Geschäftsführer (Pingen/LetterXpress).
  brief: { label: "Brief unterwegs", ton: "arbeit" },
  antwort: { label: "Antwort erhalten", ton: "gut" },
  lead: { label: "Lead · Interesse", ton: "top" },
  termin: { label: "Termin gebucht", ton: "top" },
  angebot: { label: "Angebot offen", ton: "top" },
  kauf: { label: "Gekauft", ton: "top" },
  ohne_kontakt: { label: "Ohne E-Mail", ton: "aus" },
  unzustellbar: { label: "Unzustellbar", ton: "aus" },
  passt_nicht: { label: "Passt nicht", ton: "aus" },
  kein_interesse: { label: "Kein Interesse", ton: "aus" },
  gesperrt: { label: "Gesperrt", ton: "aus" },
};

/** Stände, in denen eine Firma „im Gespräch“ ist — dort schreibt der Radar nie automatisch. */
export const RADAR_IM_GESPRAECH: readonly RadarStatus[] = ["antwort", "lead", "termin", "angebot", "kauf"];

export const RADAR_PAKETE = ["global_struktur", "global_banking", "global_kapital", "global_vip"] as const;
export type RadarPaket = (typeof RADAR_PAKETE)[number];

/** Die Reiter über der Liste — je Reiter die Stände, die er zeigt. */
export const RADAR_GRUPPEN: { key: string; label: string; stati: RadarStatus[]; ohneMail?: boolean; qualifiziert?: boolean; archiv?: boolean }[] = [
  // E-337 (Justin, 12.10. nachts): „ab jetzt schreibt Mara nur noch qualifizierte Unternehmen an“ — dieser Reiter ist die Startansicht:
  // offene Firmen mit belegtem Kapitalsignal ab Stärke 3 (Kanal: Mail an den Entscheider, sonst Brief).
  { key: "qualifiziert", label: "Qualifiziert", stati: ["neu", "gescannt", "mail", "ohne_kontakt"], qualifiziert: true },
  { key: "offen", label: "Offen", stati: ["neu", "gescannt"] },
  { key: "bereit", label: "Mail bereit", stati: ["mail", "im_postfach"] },
  { key: "raus", label: "Unterwegs", stati: ["versendet", "brief"] },
  { key: "gespraech", label: "Im Gespräch", stati: ["antwort", "lead", "termin", "angebot", "kauf"] },
  // Dieser Reiter zählt nach fehlender Adresse, nicht nach Stand — sonst übersieht man frisch gefundene Firmen ohne E-Mail.
  { key: "ohne", label: "Ohne E-Mail", stati: ["ohne_kontakt"], ohneMail: true },
  { key: "aus", label: "Aussortiert", stati: ["unzustellbar", "passt_nicht", "kein_interesse", "gesperrt"] },
  // Archiv: alles, was nach dem alten Muster recherchiert wurde, und neue Funde ohne ausreichendes Signal — gespeichert,
  // aber aus allen anderen Reitern, aus dem Vorrat und aus Versand und Brief heraus.
  { key: "archiv", label: "Archiv", stati: [], archiv: true },
];
/** Ab diesem Zeitpunkt sucht der Radar nach dem neuen Muster (Signal-Jäger + Entscheider, E-337 Runde 2 live 12.10.2026 20:39). */
export const RADAR_NEUES_MUSTER_AB = "2026-10-12T18:39:00Z";
/** Höchstens so viele Firmen in einem Stapel — mehr wäre Massenversand und dauert zu lang. */
export const RADAR_STAPEL_MAX = 25;

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

// ═══════════════════════════════════════════════════════════════════════════
// E-337 (12.10.2026) — VOM RADAR ZUM VERTRIEB
//
// Justin: „Jeden Tag 10 Leads und 5 Käufe aus Firmen, die Kapital suchen — gesteuert über Mara.“
// Bestandsaufnahme am selben Tag (06_Marketing/2026-10-12_B2B_Radar_Bestandsaufnahme.md): 1.079 Firmen gefunden,
// 77 Mails versendet (seit 28.09. keine), 4 unzustellbar, 4 Absagen, 0 Interessenten — und keine einzige Antwort
// war im Radar angekommen, weil niemand das Postfach las. Deshalb steht hier, was Server und Chefbüro gleich
// sehen müssen: das Tagesziel bis zum Kauf, die Arten einer Antwort, die Adress-Wand, das Nachfassen und die
// Schalter der Automatik.
// ═══════════════════════════════════════════════════════════════════════════

/** Das Tagesziel bis zum Kauf (Justin, 12.10.2026). */
export const RADAR_ZIEL = { leads: 10, kaeufe: 5 } as const;

/** Was eine eingehende Mail in einem Radar-Faden ist. E-361 (14.10.2026, Justin: „trainiere Mara, jedes erdenkliche Szenario“): 18 Arten. */
export type RadarAntwortArt =
  | "interesse" | "frage" | "termin_wunsch" | "rueckruf" | "info" | "einwand" | "spaeter"
  | "termin_gebucht" | "termin_abgesagt"
  | "kein_interesse" | "datenschutz" | "rechtlich"
  | "abwesend" | "weitergeleitet" | "falscher_empfaenger" | "unzustellbar" | "automatisch" | "sonstiges";

/**
 * Die Regel je Art. lead = zählt als Interessent · stopptNachfass = kein weiteres Nachfassen · mara = antwortet sie
 * (nach dem Schalter), schreibt sie höchstens einen Entwurf für Justin, oder nie · sperre = Domäne und Adresse auf die
 * Sperrliste · dringend = Aufgabe für Justin als dringend. was = ein Satz fürs Chefbüro („Mara testen“).
 */
export interface RadarAntwortRegel {
  label: string; lead: boolean; stopptNachfass: boolean;
  mara: "antwort" | "entwurf" | "nie"; sperre: boolean; dringend: boolean; was: string;
}
export const RADAR_ANTWORT_ARTEN: Record<RadarAntwortArt, RadarAntwortRegel> = {
  interesse: { label: "Interesse", lead: true, stopptNachfass: true, mara: "antwort", sperre: false, dringend: true, was: "Lead. Mara antwortet und bietet freie Gesprächszeiten an." },
  frage: { label: "Sachfrage", lead: true, stopptNachfass: true, mara: "antwort", sperre: false, dringend: true, was: "Lead. Mara beantwortet die Frage mit Fakten und bietet das Gespräch an." },
  termin_wunsch: { label: "Will einen Termin", lead: true, stopptNachfass: true, mara: "antwort", sperre: false, dringend: true, was: "Lead. Ist die Wunschzeit frei, trägt Mara sie ein — sonst nennt sie die nächsten freien Zeiten." },
  rueckruf: { label: "Will einen Anruf", lead: true, stopptNachfass: true, mara: "antwort", sperre: false, dringend: true, was: "Lead. Aufgabe mit Telefonnummer; Mara bestätigt den Anruf und nennt Zeiten." },
  info: { label: "Will Unterlagen", lead: true, stopptNachfass: true, mara: "antwort", sperre: false, dringend: true, was: "Lead. Mara schickt einen kurzen Überblick mit Link und bietet das Gespräch an." },
  einwand: { label: "Einwand", lead: false, stopptNachfass: true, mara: "antwort", sperre: false, dringend: false, was: "Mara nimmt den Einwand ernst und antwortet einmal mit Fakten — ohne zu drängen." },
  spaeter: { label: "Später melden", lead: false, stopptNachfass: true, mara: "antwort", sperre: false, dringend: false, was: "Kein Nachfassen. Mara bestätigt und meldet sich zum genannten Zeitpunkt wieder (Wiedervorlage)." },
  termin_gebucht: { label: "Termin gebucht", lead: true, stopptNachfass: true, mara: "nie", sperre: false, dringend: false, was: "Stand „Termin“. Keine Antwort an eine Kalender-Mail — Aufgabe für Justin." },
  termin_abgesagt: { label: "Termin abgesagt", lead: true, stopptNachfass: true, mara: "entwurf", sperre: false, dringend: true, was: "Zurück auf „Lead“. Dringende Aufgabe; Mara legt neue Zeiten als Entwurf bereit." },
  kein_interesse: { label: "Kein Interesse", lead: false, stopptNachfass: true, mara: "nie", sperre: true, dringend: false, was: "Sperrliste. Wer ablehnt, bekommt nie wieder eine Mail von uns." },
  datenschutz: { label: "Datenschutz", lead: false, stopptNachfass: true, mara: "entwurf", sperre: true, dringend: true, was: "Sperrliste. Dringende Aufgabe; Antwort mit der Datenquelle liegt als Entwurf von Justin bereit — nie automatisch." },
  rechtlich: { label: "Anwalt / Abmahnung", lead: false, stopptNachfass: true, mara: "nie", sperre: true, dringend: true, was: "Sperrliste. Dringende Aufgabe für Justin. Keine Antwort von Mara." },
  abwesend: { label: "Abwesend", lead: false, stopptNachfass: false, mara: "nie", sperre: false, dringend: false, was: "Nachfassen wartet bis nach der Rückkehr." },
  weitergeleitet: { label: "Weitergeleitet", lead: false, stopptNachfass: false, mara: "nie", sperre: false, dringend: false, was: "Stand „Antwort“. Nachgefasst wird in fünf Tagen." },
  falscher_empfaenger: { label: "Falscher Empfänger", lead: false, stopptNachfass: true, mara: "nie", sperre: false, dringend: false, was: "Aufgabe; eine genannte neue Adresse liegt zum Übernehmen bereit." },
  unzustellbar: { label: "Unzustellbar", lead: false, stopptNachfass: true, mara: "nie", sperre: false, dringend: false, was: "Adresse gilt als falsch; der Radar sucht eine neue." },
  automatisch: { label: "Automatische Antwort", lead: false, stopptNachfass: false, mara: "nie", sperre: false, dringend: false, was: "Ticket, Eingangsbestätigung oder verzögerte Zustellung — nichts zu tun." },
  sonstiges: { label: "Sonstiges", lead: false, stopptNachfass: true, mara: "entwurf", sperre: false, dringend: false, was: "Aufgabe für Justin; Mara schreibt höchstens einen Entwurf." },
};
export const RADAR_ANTWORT_SCHLUESSEL = Object.keys(RADAR_ANTWORT_ARTEN) as RadarAntwortArt[];

/** Arten, bei denen eine freie Wunschzeit direkt in den Global-Kalender darf. */
export const RADAR_BUCHBAR: readonly RadarAntwortArt[] = ["termin_wunsch", "rueckruf", "interesse", "frage"];

/** Fremde Buchungskalender („Buchen Sie über meinen Link“) — Calendly, Google-Terminplan, Microsoft Bookings, HubSpot … */
const BUCHUNGS_DIENSTE = /(calendly\.com|(^|\.)cal\.com|calendar\.app\.google|calendar\.google\.com\/calendar\/(u\/\d+\/)?(appointments|selfsched)|outlook\.office(365)?\.com\/(owa\/)?(calendar|book)|bookings\.cloud\.microsoft|meetings(-eu1)?\.hubspot\.com|zcal\.co|tidycal\.com|youcanbook\.me|doodle\.com\/(bp|meeting|sm)|savvycal\.com|koalendar\.com|etermin\.net|terminland\.de|simplymeet\.me|zoho\.(com|eu)\/bookings|acuityscheduling\.com|setmore\.com|appointlet\.com|reclaim\.ai\/m|leadconnectorhq\.com\/widget\/booking|tucalendi\.com|vyte\.in)/i;

/** Der erste Link auf einen fremden Buchungskalender im Text — nie unser eigener. Rein. */
export function radarBuchungslink(text: string): string | null {
  for (const roh of String(text ?? "").match(/https?:\/\/[^\s<>"'\])]+/gi) ?? []) {
    const url = roh.replace(/[.,;:!?]+$/, "");
    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch { continue; }
    if (/(^|\.)fiaon\.com$/.test(host)) continue;
    if (BUCHUNGS_DIENSTE.test(url)) return url.slice(0, 500);
  }
  return null;
}

/** Schreibt hier eine Maschine (noreply, Kalender, Benachrichtigung)? Einer Maschine antwortet Mara nie. Rein. */
export function radarRoboter(adresse: string): boolean {
  const a = String(adresse ?? "").toLowerCase().trim();
  const lokal = a.split("@")[0] ?? "";
  const domain = a.split("@")[1] ?? "";
  return /^(no-?reply|noreply|do-?not-?reply|donotreply|mailer-daemon|postmaster|calendar-notification|calendar|notifications?|notify|benachrichtigung(en)?|bounces?|autoresponder|auto-?reply|automailer)([.+_-]|$)/.test(lokal)
    || /\+noreply$/.test(lokal) || /(^|\.)calendly\.com$/.test(domain);
}

/** Die Lage, in der Mara über eine Antwort entscheidet. */
export interface RadarPlanLage {
  art: RadarAntwortArt;
  maraModus: RadarAutomatik["mara"];
  /** Die Antwort kam in Justins Postfach js@ — dort sendet Mara nie selbst (E-171). */
  postfachJs: boolean;
  /** Höchstens 48 Stunden alt (beim Nachholen alter Mails wird nur eingeordnet). */
  frisch: boolean;
  /** Der Absender ist eine Maschine. */
  roboter: boolean;
  /** Fremder Buchungslink in der Mail. */
  buchungslink: string | null;
  /** Die Wunschzeit steht genau so im freien Global-Kalender. */
  wunschFrei: boolean;
  /** Eine Telefonnummer ist bekannt (Antwort oder Impressum). */
  telefon: boolean;
  /** So oft hat Mara in diesem Faden in den letzten 24 Stunden selbst gesendet. */
  maraHeute: number;
  /** E-458: Partner (Kooperation) buchen nie einen Global-Termin — Konditionen gehen schriftlich (keine Meetings). */
  strom?: RadarStrom;
}

export interface RadarPlan {
  mara: "senden" | "entwurf" | "keine";
  buchen: boolean;
  aufgabe: boolean;
  dringend: boolean;
  sperre: boolean;
  /** Was passiert, in Sätzen — für „Mara testen“ und die Aufgabe. */
  schritte: string[];
}

/** Höchstens so viele eigene Antworten je Faden in 24 Stunden — danach nur Entwürfe (Schleifenbremse). */
export const RADAR_MARA_JE_FADEN = 3;

/**
 * Was Mara mit einer eingeordneten Antwort tut. EINE Stelle für Server und „Mara testen“. Rein.
 * Reihenfolge der Bremsen: alt → Art ohne Antwort → Maschine → Schalter aus → fremder Buchungslink / Art nur als
 * Entwurf / Schalter Entwurf / js@ / Schleifenbremse → senden.
 */
export function radarPlan(l: RadarPlanLage): RadarPlan {
  const r = RADAR_ANTWORT_ARTEN[l.art];
  const schritte: string[] = [r.was];
  const partner = l.strom === "partner";
  const buchen = !partner && RADAR_BUCHBAR.includes(l.art) && l.wunschFrei && l.telefon && l.maraModus === "auto" && l.frisch && !l.buchungslink && !l.roboter;
  if (partner && r.lead) schritte.push("Partner: kein Termin und kein Gespräch — Mara sagt die Konditionen schriftlich zu; der Partner landet im Partner-CRM (Geschäftspartner) mit einer Aufgabe. Will er ausdrücklich einen Anruf, ist das eine Aufgabe, keine Buchung.");
  if (buchen) schritte.push("Die Wunschzeit ist frei: Mara trägt sie in den Global-Kalender ein. Die Firma bekommt die Bestätigung mit Kalendereintrag.");
  else if (!partner && RADAR_BUCHBAR.includes(l.art) && l.wunschFrei && !l.buchungslink) {
    schritte.push(!l.telefon
      ? "Die Wunschzeit ist frei, aber eine Telefonnummer fehlt — Mara fragt danach."
      : "Die Wunschzeit ist frei — „Termin eintragen“ an der Antwort bucht sie mit einem Klick.");
  }
  if (l.buchungslink) schritte.push("Die Firma möchte über ihren eigenen Kalender buchen: dringende Aufgabe mit dem Link — Maras Antwort nur als Entwurf.");

  let mara: RadarPlan["mara"] = "senden";
  let warum = "";
  if (l.art === "datenschutz") { mara = "entwurf"; }
  else if (!l.frisch) { mara = "keine"; warum = "Älter als 48 Stunden: nur eingeordnet, keine verspätete Antwort."; }
  else if (r.mara === "nie") { mara = "keine"; }
  else if (l.roboter) { mara = "keine"; warum = "Keine Antwort: Der Absender ist eine Maschine."; }
  else if (l.maraModus === "aus") { mara = "keine"; warum = "Mara ist für Antworten ausgeschaltet."; }
  else if (l.buchungslink) { mara = "entwurf"; }
  else if (r.mara === "entwurf") { mara = "entwurf"; warum = "Diese Art geht nur als Entwurf zur Freigabe."; }
  else if (l.maraModus === "entwurf") { mara = "entwurf"; warum = "Schalter „Entwurf“: Maras Antwort liegt zur Freigabe bereit."; }
  else if (l.postfachJs) { mara = "entwurf"; warum = "Justins Postfach js@: Mara sendet dort nie selbst — Entwurf zur Freigabe."; }
  else if (l.maraHeute >= RADAR_MARA_JE_FADEN) { mara = "entwurf"; warum = `Schleifenbremse: Mara hat in diesem Faden heute schon ${l.maraHeute}-mal geantwortet — jetzt nur Entwurf.`; }
  if (mara === "senden") schritte.push("Die Antwort geht sofort hinaus, im selben Faden, mit Signaturkarte.");
  if (warum) schritte.push(warum);

  // Nur, was der Satz der Art nicht schon sagt — „Mara testen“ soll kurz bleiben.
  const sperre = r.sperre;
  if (sperre && !/Sperrliste/.test(r.was)) schritte.push("Domäne und Adresse kommen auf die Sperrliste.");
  const ohneAufgabe: RadarAntwortArt[] = ["automatisch", "abwesend", "unzustellbar", "kein_interesse", "weitergeleitet"];
  const aufgabe = !ohneAufgabe.includes(l.art) && (l.frisch || (r.sperre && r.dringend));
  const dringend = aufgabe && (r.dringend || !!l.buchungslink);
  if (aufgabe && !/Aufgabe/.test(r.was)) schritte.push(dringend ? "Dringende Aufgabe für Justin." : "Aufgabe für Justin.");
  return { mara, buchen, aufgabe, dringend, sperre, schritte };
}

// ── DIE ADRESS-WAND ─────────────────────────────────────────────────────────
// Gemessen an den 77 Mails: Jede zehnte ging an ein Ticket-System (support@, enjoy@zammad), an privacy@, media@,
// imprint@ oder booking@ — eine an den EXTERNEN Datenschutzbeauftragten (officer@proliance.ai), eine an den
// Platzhalter „info@domain1.tld“ aus einem Impressum. Solche Adressen erreichen keinen Entscheider.
/** Postfachnamen, die nie einen Entscheider erreichen. */
export const RADAR_ADRESSE_NIE = /^(datenschutz|privacy|dsb|dpo|gdpr|dsgvo|officer|legal|recht|imprint|impressum|noreply|no-reply|donotreply|do-not-reply|support|help|hilfe|helpdesk|ticket|tickets|servicedesk|bewerbung|bewerbungen|jobs|job|karriere|career|careers|hr|personal|presse|press|media|medien|pr|buchhaltung|rechnung|rechnungen|invoice|invoices|billing|accounting|abuse|postmaster|webmaster|hostmaster|newsletter|booking|bookings|reservierung|reservation|reservations|order|orders|bestellung|bestellungen|webshop|shop|returns|retoure|retouren|versand|logistik|lieferung)([.+_-]|$|\d)/i;
/** Platzhalter aus Vorlagen — nie eine echte Adresse. */
export const RADAR_ADRESSE_PLATZHALTER = /(@|\.)(domain\d*\.tld|example\.(com|org|net|de)|beispiel\.(de|com)|musterfirma\.de|mustermann\.de|test\.(de|com)|ihre-?domain\.\w+|yourdomain\.\w+|domain\.(de|com))$|\.tld$/i;

/** Taugt diese Adresse für eine erste Mail an diese Firma? Rein — Server und Chefbüro sagen dasselbe. */
export function radarAdressePruefen(emailRoh: unknown, domain: string, firmenname?: string | null): { ok: boolean; grund: string | null } {
  const email = String(emailRoh ?? "").trim().toLowerCase();
  if (!/^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/i.test(email)) return { ok: false, grund: "keine gültige Adresse" };
  if (RADAR_ADRESSE_PLATZHALTER.test(email)) return { ok: false, grund: "Platzhalter aus einer Vorlage" };
  const [lokal, dom] = email.split("@");
  if (RADAR_ADRESSE_NIE.test(lokal)) return { ok: false, grund: `${lokal}@ erreicht keinen Entscheider` };
  if (RADAR_FREEMAIL.has(dom)) return { ok: true, grund: null };
  // Fremde Firmen-Domäne (z. B. der externe Datenschutzbeauftragte): nur, wenn der Name der Firma darin steckt.
  const eigen = String(domain || "").toLowerCase();
  const kern = (d: string) => d.split(".").slice(0, -1).join(".").replace(/[^a-z0-9]/g, "");
  if (eigen && dom !== eigen && !dom.endsWith(`.${eigen}`) && !eigen.endsWith(`.${dom}`)) {
    const a = kern(dom), b = kern(eigen);
    // Die Betreibergesellschaft hat oft eine eigene Domäne (Kaspar Schmauser → FoundingRestaurants GmbH):
    // Trägt die Domäne ein Wort aus dem Firmennamen, ist es dieselbe Firma.
    const woerter = String(firmenname ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(gmbh|holding|group|gruppe|international|services?|solutions?)$/.test(w));
    const gleich = (a && b && (a.includes(b) || b.includes(a))) || woerter.some((w) => a.includes(w));
    if (!gleich) return { ok: false, grund: `Adresse einer fremden Firma (${dom})` };
  }
  return { ok: true, grund: null };
}

// ── NACHFASSEN ──────────────────────────────────────────────────────────────
/**
 * Nach wie vielen Tagen die Nachfass-Mail fällig wird (ab der Mail davor). Danach Schluss.
 * E-458 (Justin 29.10.2026, „go“ auf den Vorschlag): nur noch EINE Erinnerung — vorher [3, 5]. Mehr Platz für erste Mails je Postfach.
 */
export const RADAR_NACHFASS_TAGE: readonly number[] = [3];

// ── DIE SCHALTER DER AUTOMATIK (fiaon_settings, im Chefbüro bedienbar) ───────
export interface RadarAutomatik {
  /** Schreibt und sendet der Radar selbst erste Mails (Werktags im Sendefenster)? */
  versand: boolean;
  /** Höchstens so viele erste Mails am Tag. */
  jeTag: number;
  /** Fasst der Radar selbst nach (zwei kurze Mails im selben Faden)? */
  nachfass: boolean;
  /** Was Mara mit einer Antwort tut: „auto“ = antwortet selbst, „entwurf“ = legt die Antwort zur Freigabe bereit, „aus“. */
  mara: "auto" | "entwurf" | "aus";
  /** Angeschrieben wird nur ab dieser Passung (0–100). */
  abPassung: number;
}
export const RADAR_AUTOMATIK_VORGABE: RadarAutomatik = { versand: false, jeTag: 20, nachfass: false, mara: "entwurf", abPassung: 80 };
/** Harte Obergrenze je Postfach und Tag — darüber leidet die Zustellung, und aus persönlich wird Massenversand. */
export const RADAR_HOECHSTENS_JE_TAG = 60;
export const RADAR_AUTOMATIK_SCHLUESSEL = {
  versand: "radar_auto_versand", jeTag: "radar_auto_je_tag", nachfass: "radar_auto_nachfass", mara: "radar_mara_antwort", abPassung: "radar_auto_ab_passung",
} as const;

/** Liest die Schalter aus Rohwerten (fiaon_settings key → value). Rein. */
export function radarAutomatikLesen(roh: Record<string, string | null | undefined>): RadarAutomatik {
  const v = RADAR_AUTOMATIK_VORGABE;
  const k = RADAR_AUTOMATIK_SCHLUESSEL;
  const zahl = (x: unknown, vorgabe: number, min: number, max: number) => {
    const n = Math.round(Number(x));
    return Number.isFinite(n) && String(x ?? "").trim() !== "" ? Math.max(min, Math.min(max, n)) : vorgabe;
  };
  const mara = String(roh[k.mara] ?? "").trim();
  return {
    versand: roh[k.versand] != null ? roh[k.versand] === "an" : v.versand,
    jeTag: zahl(roh[k.jeTag], v.jeTag, 0, RADAR_HOECHSTENS_JE_TAG),
    nachfass: roh[k.nachfass] != null ? roh[k.nachfass] === "an" : v.nachfass,
    mara: mara === "auto" || mara === "entwurf" || mara === "aus" ? mara : v.mara,
    abPassung: zahl(roh[k.abPassung], v.abPassung, 0, 100),
  };
}

/** Werktags 8:30–17:30 Uhr (Berlin) — dann lesen Geschäftsführer Mails. Gilt seit E-458 nur noch für den Brief. Rein. */
export function radarSendefenster(jetzt: Date = new Date()): boolean {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  const wert = (t: string) => teile.find((x) => x.type === t)?.value ?? "";
  const tag = wert("weekday");
  const minuten = Number(wert("hour")) * 60 + Number(wert("minute"));
  if (tag === "Sat" || tag === "Sun") return false;
  return minuten >= 8 * 60 + 30 && minuten < 17 * 60 + 30;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-458 (29.10.2026) — DER MAIL-MOTOR: ZWEI STRÖME, JEDE STUNDE
//
// Justin: „Ab heute, jede Stunde MINDESTENS 10 Mails an Firmen die Kapitalbedarf haben und 10 neue Kooperationspartner
// die uns Kunden bringen — also 20 Mails, jede Stunde — von 07.00 Uhr bis 19.00 Uhr.“
// Tag und Nacht arbeitet Mara vor (suchen, Chef finden, Mail schreiben, prüfen) und legt fertige Mails in eine
// Warteschlange; verschickt wird nur im Fenster, gleichmäßig über die Stunde. Hier steht, was Server, Chefbüro und
// Prüfstand gleich sehen müssen: Ströme, Schalter, Fenster und Takt. Die Arbeit macht server/lib/fiaon-radar-motor.ts.
// ═══════════════════════════════════════════════════════════════════════════
/** firma = Firmen mit belegtem Kapitalbedarf · partner = Kooperationspartner, die uns Kunden bringen (Steuerberater, Finanzierer …). */
export type RadarStrom = "firma" | "partner";
export const RADAR_STROEME: readonly RadarStrom[] = ["firma", "partner"];
export const RADAR_STROM_LABEL: Record<RadarStrom, string> = { firma: "Firmen", partner: "Partner" };
export function alsRadarStrom(roh: unknown): RadarStrom { return roh === "partner" ? "partner" : "firma"; }

export interface RadarMotor {
  /** Sendetage, 1 = Montag … 7 = Sonntag. */
  tage: number[];
  /** Fenster in Berliner Zeit, „HH:MM“ — von einschließlich, bis ausschließlich. */
  von: string;
  bis: string;
  /** Erste Mails je Stunde und Strom (0 = Strom aus). */
  firmenJeStunde: number;
  partnerJeStunde: number;
  /** So viele Tage der heutigen Leistung liegen fertig in der Warteschlange (an die Postfach-Leistung gekoppelt, nicht ans Ziel). */
  puffer: number;
  /** So viele Tage bleibt eine fertige Mail sendbar — danach ist sie veraltet. */
  haltbarTage: number;
  /** Firmen-Mails: der kurze Terminlink (fiaon.com/g/r<ID>) als Satz nach der Frage — oder keiner. Partner-Mails tragen nie einen. */
  link: "termin" | "keiner";
  /** Prüf-KI (Punkt 4): höchstens so viel KI-Klang (0 = klingt menschlich, 10 = klar KI) besteht. */
  kiKlangMax: number;
  /** Fingerabdruck (Punkt 4): Anteil der 5-Wort-Folgen, die schon in einer früheren Mail standen — darüber sperrt es. */
  aehnlichMax: number;
  /** Nachschub (Punkt 1): so viele qualifizierte Firmen sucht der Tageslauf am Tag, mit höchstens so vielen Suchläufen. */
  sucheTagesziel: number;
  sucheLaeufe: number;
  /** Partner-Strom (Punkt 2): eingeschaltete Gruppen, qualifizierte Partner-Funde am Tag, Provisions-Satz (nur Mailtext). */
  partnerGruppen: string[];
  partnerTagesziel: number;
  partnerProvisionText: string;
  /** Adress-Ableitung (Punkt 5): an/aus, höchstens so viel Prozent der Mails je Stunde, Rückläufer-Grenze in 7 Tagen. */
  ableitung: boolean;
  ableitungAnteil: number;
  ableitungRueckMax: number;
  /** Postfächer (Punkt 6): Tagesgrenze je Postfach, Hochfahren neuer Postfächer (Woche 1, Woche 2), pausierte Postfächer. */
  postfachJeTag: number;
  postfachRampe: number[];
  postfachAus: string[];
  /** Zustellung (Punkt 7): Rückläufer- und Beschwerde-Grenze in Prozent über 7 Tage, Mindestzahl Sendungen. */
  zustellRueckMax: number;
  zustellBeschwerdeMax: number;
  zustellBasis: number;
  /**
   * E-458 (Befund Go-live): Justins Freigabe des Motors (ISO-Zeit) — erst danach bereitet er von selbst vor und sendet.
   * So ist ein Deploy nie der Start: Justin sieht zuerst echte Mails in der Akte. Ab hier fahren die Postfächer hoch.
   */
  freigabeAm: string | null;
  /** Ist der Anteil abgeleiteter Adressen ausdrücklich gesetzt? Sonst gilt in der ersten Woche nach der Freigabe der Startwert. */
  ableitungAnteilEigen: boolean;
  /**
   * E-458 (Befund Go-live, KI-Geld): Vorbereitung und Suche zusammen höchstens so viel Prozent des B2B-Topfs der KI-Kasse
   * am Tag — der Rest bleibt für Nachfassen, Ratgeber und Partner-CRM. Antworten an Menschen zahlen aus ihrem eigenen Topf.
   */
  kiAnteil: number;
}
/** Harte Obergrenze je Strom und Stunde — darüber wird aus persönlich Massenversand. */
export const RADAR_MOTOR_HOECHSTENS_JE_STUNDE = 30;
export const RADAR_MOTOR_VORGABE: RadarMotor = { tage: [1, 2, 3, 4, 5], von: "07:00", bis: "19:00", firmenJeStunde: 10, partnerJeStunde: 10, puffer: 1.2, haltbarTage: 7, link: "termin", kiKlangMax: 3, aehnlichMax: 0.35, sucheTagesziel: RADAR_TAGESZIEL, sucheLaeufe: 30,
  partnerGruppen: RADAR_PARTNER_GRUPPEN.map((g) => g.key), partnerTagesziel: 100, partnerProvisionText: "30 Prozent unseres Honorars, ein Jahr lang",
  ableitung: true, ableitungAnteil: 50, ableitungRueckMax: 5, postfachJeTag: 60, postfachRampe: [20, 40], postfachAus: [],
  zustellRueckMax: 3, zustellBeschwerdeMax: 0.3, zustellBasis: 50, freigabeAm: null, ableitungAnteilEigen: false, kiAnteil: 60 };
export const RADAR_MOTOR_SCHLUESSEL = {
  tage: "radar_motor_tage", von: "radar_motor_von", bis: "radar_motor_bis", firmenJeStunde: "radar_motor_firmen_je_stunde",
  partnerJeStunde: "radar_motor_partner_je_stunde", puffer: "radar_motor_puffer", haltbarTage: "radar_motor_haltbar_tage",
  link: "radar_motor_link", kiKlangMax: "radar_pruef_ki_klang_max", aehnlichMax: "radar_motor_aehnlich_max",
  sucheTagesziel: "radar_suche_tagesziel", sucheLaeufe: "radar_suche_laeufe",
  partnerGruppen: "radar_partner_gruppen", partnerTagesziel: "radar_partner_tagesziel", partnerProvisionText: "radar_partner_provision_text",
  ableitung: "radar_ableitung", ableitungAnteil: "radar_ableitung_anteil", ableitungRueckMax: "radar_ableitung_rueck_max",
  postfachJeTag: "radar_postfach_je_tag", postfachRampe: "radar_postfach_rampe", postfachAus: "radar_postfach_aus",
  zustellRueckMax: "radar_zustell_rueck_max", zustellBeschwerdeMax: "radar_zustell_beschwerde_max", zustellBasis: "radar_zustell_basis",
  freigabeAm: "radar_motor_freigabe", kiAnteil: "radar_motor_ki_anteil",
} as const;

/** Die Stände einer Mail in der Warteschlange (Spalte motor_status; der Radar-Stand der Firma bleibt daneben, wie er ist). */
export type RadarMotorStatus = "arbeit" | "bereit" | "sendet" | "gesendet" | "verworfen" | "abgelaufen";
export const RADAR_MOTOR_STATUS: Record<RadarMotorStatus, string> = {
  arbeit: "In Arbeit", bereit: "Bereit", sendet: "Wird gesendet", gesendet: "Gesendet", verworfen: "Verworfen", abgelaufen: "Abgelaufen",
};

/** „07:00“ → 420, sonst null. Rein. */
export function radarUhrzeitMinuten(roh: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(roh ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** Liest die Motor-Schalter aus Rohwerten (fiaon_settings key → value). Unsinn fällt auf die Vorgabe. Rein. */
export function radarMotorLesen(roh: Record<string, string | null | undefined>): RadarMotor {
  const v = RADAR_MOTOR_VORGABE;
  const k = RADAR_MOTOR_SCHLUESSEL;
  const text = (x: unknown) => String(x ?? "").trim();
  const tageRoh = text(roh[k.tage]).split(/[,;\s]+/).filter(Boolean);
  const tage = Array.from(new Set(tageRoh.map(Number))).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7).sort((a, b) => a - b);
  const vonM = radarUhrzeitMinuten(roh[k.von]) ?? radarUhrzeitMinuten(v.von)!;
  const bisM = radarUhrzeitMinuten(roh[k.bis]) ?? radarUhrzeitMinuten(v.bis)!;
  const fenster = vonM < bisM ? { von: text(roh[k.von]) || v.von, bis: text(roh[k.bis]) || v.bis } : { von: v.von, bis: v.bis };
  const norm = (s: string) => { const n = radarUhrzeitMinuten(s)!; return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
  const jeStunde = (x: unknown, vorgabe: number) => {
    const s = text(x);
    if (!/^\d+$/.test(s)) return vorgabe;
    return Math.min(RADAR_MOTOR_HOECHSTENS_JE_STUNDE, Number(s));
  };
  const zahl = (x: unknown, vorgabe: number, min: number, max: number) => {
    const n = Number(text(x).replace(",", "."));
    return text(x) !== "" && Number.isFinite(n) && n >= min && n <= max ? n : vorgabe;
  };
  return {
    tage: tageRoh.length && tage.length ? tage : [...v.tage],
    von: radarUhrzeitMinuten(fenster.von) != null ? norm(fenster.von) : v.von,
    bis: radarUhrzeitMinuten(fenster.bis) != null ? norm(fenster.bis) : v.bis,
    firmenJeStunde: jeStunde(roh[k.firmenJeStunde], v.firmenJeStunde),
    partnerJeStunde: jeStunde(roh[k.partnerJeStunde], v.partnerJeStunde),
    puffer: zahl(roh[k.puffer], v.puffer, 0.1, 5),
    haltbarTage: Math.round(zahl(roh[k.haltbarTage], v.haltbarTage, 1, 30)),
    link: text(roh[k.link]) === "keiner" ? "keiner" : v.link,
    kiKlangMax: Math.round(zahl(roh[k.kiKlangMax], v.kiKlangMax, 0, 10)),
    aehnlichMax: zahl(roh[k.aehnlichMax], v.aehnlichMax, 0.05, 1),
    sucheTagesziel: Math.round(zahl(roh[k.sucheTagesziel], v.sucheTagesziel, 0, 500)),
    sucheLaeufe: Math.round(zahl(roh[k.sucheLaeufe], v.sucheLaeufe, 0, 200)),
    // Ohne Einstellung: alle Gruppen. Eine leere Liste schaltet alle ab; unbekannte Schlüssel fallen weg.
    partnerGruppen: roh[k.partnerGruppen] == null ? [...v.partnerGruppen]
      : Array.from(new Set(text(roh[k.partnerGruppen]).split(/[,;\s]+/).filter((g) => !!radarPartnerGruppe(g)))),
    partnerTagesziel: Math.round(zahl(roh[k.partnerTagesziel], v.partnerTagesziel, 0, 500)),
    partnerProvisionText: /^[^\n]{10,120}$/.test(text(roh[k.partnerProvisionText])) && /prozent|%/i.test(text(roh[k.partnerProvisionText])) ? text(roh[k.partnerProvisionText]) : v.partnerProvisionText,
    ableitung: roh[k.ableitung] != null ? text(roh[k.ableitung]) !== "aus" : v.ableitung,
    ableitungAnteil: Math.round(zahl(roh[k.ableitungAnteil], v.ableitungAnteil, 0, 100)),
    ableitungRueckMax: zahl(roh[k.ableitungRueckMax], v.ableitungRueckMax, 0.5, 50),
    postfachJeTag: Math.round(zahl(roh[k.postfachJeTag], v.postfachJeTag, 1, RADAR_HOECHSTENS_JE_TAG)),
    postfachRampe: (() => {
      const r = text(roh[k.postfachRampe]).split(/[,;\s]+/).filter(Boolean).map(Number);
      return r.length && r.length <= 4 && r.every((n) => Number.isInteger(n) && n >= 1 && n <= RADAR_HOECHSTENS_JE_TAG) ? r : [...v.postfachRampe];
    })(),
    postfachAus: text(roh[k.postfachAus]).toLowerCase().split(/[,;\s]+/).filter((a) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(a)),
    zustellRueckMax: zahl(roh[k.zustellRueckMax], v.zustellRueckMax, 0.5, 20),
    zustellBeschwerdeMax: zahl(roh[k.zustellBeschwerdeMax], v.zustellBeschwerdeMax, 0.05, 5),
    zustellBasis: Math.round(zahl(roh[k.zustellBasis], v.zustellBasis, 10, 1000)),
    freigabeAm: (() => {
      const t = text(roh[k.freigabeAm]);
      const d = t ? new Date(t) : null;
      return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
    })(),
    ableitungAnteilEigen: zahl(roh[k.ableitungAnteil], -1, 0, 100) >= 0,
    kiAnteil: Math.round(zahl(roh[k.kiAnteil], v.kiAnteil, 10, 100)),
  };
}

/** E-458 (Befund Go-live): In der ersten Woche nach der Freigabe höchstens so viel Prozent abgeleiteter Adressen je Tag. */
export const RADAR_ABLEITUNG_START = { tage: 7, anteil: 20 } as const;
/**
 * Der Anteil abgeleiteter Adressen, der JETZT gilt: in den ersten sieben Tagen nach der Freigabe höchstens 20 % (die ersten
 * Rückläufer gingen sonst voll auf den Ruf von Justins Hauptpostfach) — es sei denn, Justin hat ihn ausdrücklich gesetzt. Rein.
 */
export function radarAbleitungAnteilJetzt(m: Pick<RadarMotor, "ableitungAnteil" | "ableitungAnteilEigen" | "freigabeAm">, jetzt: Date = new Date()): number {
  if (m.ableitungAnteilEigen || !m.freigabeAm) return m.ableitungAnteil;
  const seit = jetzt.getTime() - new Date(m.freigabeAm).getTime();
  return seit >= 0 && seit < RADAR_ABLEITUNG_START.tage * 86_400_000 ? Math.min(m.ableitungAnteil, RADAR_ABLEITUNG_START.anteil) : m.ableitungAnteil;
}

/**
 * E-458 (Befund Go-live): Ab wann ein Postfach hochfährt (Woche 1 → 20, Woche 2 → 40 …). Ohne Radar-Geschichte: Woche 1
 * (null). Mit Geschichte: der erste Radar-Versand — aber nie vor der Freigabe des Motors. Sonst stünde js@ (Radar seit
 * 19.09.) am ersten Tag auf voller Grenze: zehnmal so viele Kaltmails aus Justins Hauptpostfach wie bisher. Rein.
 */
export function radarPostfachStart(ersterVersand: Date | string | null | undefined, freigabeAm: Date | string | null | undefined): Date | null {
  const a = ersterVersand ? new Date(ersterVersand).getTime() : NaN;
  if (!Number.isFinite(a)) return null;
  const b = freigabeAm ? new Date(freigabeAm).getTime() : NaN;
  return new Date(Number.isFinite(b) ? Math.max(a, b) : a);
}

// ── ZUSTELLUNG SCHÜTZEN (E-458 Punkt 7) ─────────────────────────────────────
// Rückläufer über 3 % oder Beschwerden über 0,3 % in 7 Tagen → der Motor halbiert seinen Takt (bleibt es 48 Stunden
// drüber: ein Viertel, nie weniger) und Justin bekommt eine Aufgabe. Drei Tage in Folge unter beiden Grenzen → volle
// Fahrt. Unter 50 Sendungen gibt es keine Quote — sonst schaltete ein einzelner Rückläufer die Bremse.
export interface RadarZustellWerte { gesendet: number; rueck: number; beschwerden: number; rueckQuote: number | null; beschwerdeQuote: number | null }
/** Quoten in Prozent (eine bzw. zwei Nachkommastellen) — unter der Mindestbasis null. Rein. */
export function radarZustellWerte(e: { gesendet: number; rueck: number; beschwerden: number; basis?: number }): RadarZustellWerte {
  const basis = e.basis ?? RADAR_MOTOR_VORGABE.zustellBasis;
  const g = Math.max(0, Math.round(e.gesendet));
  if (g < basis) return { gesendet: g, rueck: e.rueck, beschwerden: e.beschwerden, rueckQuote: null, beschwerdeQuote: null };
  return { gesendet: g, rueck: e.rueck, beschwerden: e.beschwerden,
    rueckQuote: Math.round((e.rueck / g) * 1000) / 10, beschwerdeQuote: Math.round((e.beschwerden / g) * 10000) / 100 };
}
export interface RadarBremse { faktor: number; seit: string | null; grund: string | null; unterSeit?: string | null; werte?: RadarZustellWerte | null }
/** Ist eine Beschwerde? Anwalt/Abmahnung, Datenschutz-Antrag oder eine Absage mit Spam-Wort. Rein. */
export function radarBeschwerde(art: string | null | undefined, text: string | null | undefined): boolean {
  return art === "rechtlich" || art === "datenschutz" || (art === "kein_interesse" && /\bspam\w*|unverlangt|belästig|belaestig|unerwünscht|unerwuenscht/i.test(String(text ?? "")));
}
/**
 * Die Bremse: über einer Grenze → 0,5; schon gebremst und nach 48 Stunden weiter drüber → 0,25 (nie weniger); drei Tage
 * in Folge unter beiden Grenzen → 1. Rein — der Server schreibt das Ergebnis nach radar_motor_bremse.
 */
export function radarBremseEntscheiden(e: { werte: RadarZustellWerte; bremse: RadarBremse | null; jetzt: Date; grenzen: { rueckMax: number; beschwerdeMax: number } }):
  RadarBremse & { neu: boolean; geloest: boolean } {
  const w = e.werte;
  const rueck = w.rueckQuote != null && w.rueckQuote > e.grenzen.rueckMax;
  const beschwerde = w.beschwerdeQuote != null && w.beschwerdeQuote > e.grenzen.beschwerdeMax;
  const alt = e.bremse && e.bremse.faktor > 0 && e.bremse.faktor <= 1 ? e.bremse : { faktor: 1, seit: null, grund: null, unterSeit: null };
  const jetztIso = e.jetzt.toISOString();
  const seitMs = alt.seit ? e.jetzt.getTime() - new Date(alt.seit).getTime() : 0;
  const zahl = (n: number | null) => String(n ?? 0).replace(".", ",");
  const grund = [rueck ? `Rückläufer ${zahl(w.rueckQuote)} % (Grenze ${zahl(e.grenzen.rueckMax)} %)` : "", beschwerde ? `Beschwerden ${zahl(w.beschwerdeQuote)} % (Grenze ${zahl(e.grenzen.beschwerdeMax)} %)` : ""].filter(Boolean).join(" · ");
  if (rueck || beschwerde) {
    if (alt.faktor >= 1) return { faktor: 0.5, seit: jetztIso, grund, unterSeit: null, werte: w, neu: true, geloest: false };
    if (alt.faktor > 0.25 && seitMs >= 48 * 3_600_000) return { faktor: 0.25, seit: jetztIso, grund, unterSeit: null, werte: w, neu: true, geloest: false };
    return { faktor: Math.max(0.25, alt.faktor), seit: alt.seit, grund, unterSeit: null, werte: w, neu: false, geloest: false };
  }
  if (alt.faktor >= 1) return { faktor: 1, seit: null, grund: null, unterSeit: null, werte: w, neu: false, geloest: false };
  const unterSeit = alt.unterSeit ?? jetztIso;
  if (e.jetzt.getTime() - new Date(unterSeit).getTime() >= 72 * 3_600_000) return { faktor: 1, seit: null, grund: null, unterSeit: null, werte: w, neu: false, geloest: true };
  return { faktor: alt.faktor, seit: alt.seit, grund: alt.grund, unterSeit, werte: w, neu: false, geloest: false };
}

/**
 * Tagesgrenze eines Postfachs: neue Postfächer fahren hoch (Woche 1 → 20, Woche 2 → 40, danach radar_postfach_je_tag).
 * Beginn = erster Radar-Versand des Postfachs; ohne Geschichte = Woche 1. Rein.
 */
export function radarPostfachGrenze(e: { ersterVersand: Date | string | null | undefined; jetzt: Date; jeTag: number; rampe: readonly number[] }): number {
  const erster = e.ersterVersand ? new Date(e.ersterVersand).getTime() : NaN;
  const tage = Number.isFinite(erster) ? Math.max(0, Math.floor((e.jetzt.getTime() - erster) / 86_400_000)) : 0;
  const woche = Math.floor(tage / 7);
  const stufe = woche < e.rampe.length ? e.rampe[woche] : e.jeTag;
  return Math.max(0, Math.min(e.jeTag, stufe));
}

/**
 * Ist ein Postfach bereit für erste Mails? Gmail-Zugang (wenn eingerichtet), eine echte Person (Vor- und Nachname) mit
 * Signatur MIT Bild — Justins Karte zählt als Bild —, und bei einer anderen Domäne als fiaon.com: MX, SPF (Google),
 * DKIM und DMARC. Ein Postfach ohne echte Person sendet nie. Rein.
 */
export function radarPostfachBereit(e: {
  person: { name: string; signaturHtml: string; quelle: "gmail" | "karte" } | null; gmail: boolean | null;
  dns: { mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean } | null; eigeneDomain: boolean;
}): { bereit: boolean; gruende: string[] } {
  const gruende: string[] = [];
  if (e.gmail === false) gruende.push("Gmail-Zugang fehlt (Dienstkonto-Delegation)");
  if (!e.person) gruende.push("Keine Unterschrift — in Gmail Name und Signatur einrichten");
  else {
    if (String(e.person.name ?? "").replace(/\|.*$/, "").trim().split(/\s+/).filter((w) => w.length >= 2).length < 2) gruende.push("Absendername ohne Vor- und Nachnamen");
    if (e.person.quelle !== "karte" && !/<img\b/i.test(e.person.signaturHtml)) gruende.push("Gmail-Signatur ohne Bild");
  }
  if (!e.eigeneDomain) {
    if (!e.dns) gruende.push("DNS der Versand-Domäne nicht lesbar");
    else {
      if (!e.dns.mx) gruende.push("MX fehlt");
      if (!e.dns.spf) gruende.push("SPF ohne Google");
      if (!e.dns.dkim) gruende.push("DKIM fehlt");
      if (!e.dns.dmarc) gruende.push("DMARC fehlt");
    }
  }
  return { bereit: !gruende.length, gruende };
}

// ── POSTFÄCHER UND EHRLICHE LEISTUNG (E-458 Punkt 6) ────────────────────────
/** Ein Versandpostfach heute: Tagesgrenze, heute schon gesendet (alles aus dem Radar), Reserve für fällige Nachfass-Mails. */
export interface RadarPostfachLage {
  adresse: string; grenze: number; heute: number; reserve?: number; letzteAm?: Date | string | null;
  /** Gmail-Zugang, echte Person mit Signatur, DNS — nur „bereit“ sendet. */
  bereit: boolean;
  /** Pausiert (Chefbüro, Zustell-Bremse oder Störung beim Senden) — für Auswahl und Leistung zählt nur das. */
  pause?: boolean;
  /** E-458 (Befund Sicht): nur Justins eigene Pause (Schalter im Chefbüro) — der Schalter zeigt genau das. */
  aus?: boolean;
  /** Das Postfach ruht von selbst bis … (Gmail-Störung oder Zustell-Bremse) — mit Grund in einfachen Worten. */
  ruhtBis?: string | null;
  ruhtGrund?: string | null;
}
/** Abstand zwischen zwei Mails aus demselben Postfach: 3 Minuten plus 0–59 Sekunden, fest je letzter Mail. Rein. */
export function radarPostfachAbstandSek(letzteAm: Date | string | null | undefined): number {
  const t = letzteAm ? new Date(letzteAm).getTime() : NaN;
  return 180 + (Number.isFinite(t) ? Math.floor(t / 1000) % 60 : 0);
}
/**
 * Der Takt eines Postfachs (E-458, Befund Bremse): Sein Rest für heute verteilt sich gleichmäßig über das restliche
 * Fenster — sonst wäre ein Postfach mit 60 am Tag um 10 Uhr leer und schwiege den Rest des Tages (und die Zustell-Bremse,
 * die die Grenze halbiert, verlängerte nur die Pause statt den Takt). Abstand = restliche Fenstersekunden / Rest, nie
 * unter dem Mindestabstand. Ohne restSek (Knopf „Jetzt eine senden“) nur der Mindestabstand. Rein.
 */
export function radarPostfachTaktSek(p: RadarPostfachLage, restSek?: number | null): number {
  const mindest = radarPostfachAbstandSek(p.letzteAm);
  const rest = p.grenze - p.heute - (p.reserve ?? 0);
  if (!restSek || restSek <= 0 || rest <= 0) return mindest;
  return Math.max(mindest, Math.floor(restSek / rest));
}
/**
 * Welches Postfach sendet die nächste Mail? Ein bereites, nicht pausiertes Postfach unter seiner Grenze, dessen Takt
 * abgelaufen ist — mit dem größten Rest (Rest / Grenze), bei Gleichstand das am längsten ruhende. Keins frei → null. Rein.
 */
export function radarPostfachWaehlen(liste: readonly RadarPostfachLage[], jetzt: Date = new Date(), restSek?: number | null): RadarPostfachLage | null {
  const frei = liste.filter((p) => {
    if (!p.bereit || p.pause || p.grenze <= 0) return false;
    if (p.heute + (p.reserve ?? 0) >= p.grenze) return false;
    const letzte = p.letzteAm ? new Date(p.letzteAm).getTime() : NaN;
    return !Number.isFinite(letzte) || (jetzt.getTime() - letzte) / 1000 >= radarPostfachTaktSek(p, restSek);
  });
  if (!frei.length) return null;
  const rest = (p: RadarPostfachLage) => (p.grenze - p.heute - (p.reserve ?? 0)) / p.grenze;
  const ruhe = (p: RadarPostfachLage) => (p.letzteAm ? new Date(p.letzteAm).getTime() : 0);
  return [...frei].sort((a, b) => rest(b) - rest(a) || ruhe(a) - ruhe(b))[0];
}

/** Sendungen je erster Mail, wenn nachgefasst wird (ein Teil antwortet vorher): 1 Nachfass ≈ 1,95 · 2 Nachfass ≈ 2,85. Rein. */
export function radarSendungenJeErstmail(nachfassStufen: number = RADAR_NACHFASS_TAGE.length): number {
  let f = 1;
  for (let i = 1; i <= Math.max(0, nachfassStufen); i++) f += Math.max(0, 1 - 0.05 * i);
  return Math.round(f * 100) / 100;
}

export interface RadarMoeglich {
  /** Ziel beider Ströme je Stunde (nach der Bremse). */
  ziel: number;
  /** Was die bereiten Postfächer in den restlichen Fensterstunden heute je Stunde tragen (abgerundet). */
  moeglich: number;
  /** Leistung = das Kleinere aus Ziel und möglich — je Strom nach seinem Anteil am Ziel. */
  leistung: number;
  je: Record<RadarStrom, number>;
  /** Erste Mails, die ein voller Tag je Strom trägt (für den Puffer der Warteschlange). */
  tagJe: Record<RadarStrom, number>;
  /** So viele warme Postfächer à Tagesgrenze bräuchte das Ziel. */
  postfaecherNoetig: number;
  satz: string;
}
/**
 * Die ehrliche Leistung: (Σ Rest heute − Nachfass-Reserve) / restliche Fensterstunden, aufgeteilt nach den Zielen der
 * Ströme. Leistung = min(Ziel, möglich). Dazu der Satz fürs Chefbüro und die Rechnung, wie viele Postfächer das Ziel
 * bräuchte (je erste Mail kommen Nachfass-Mails dazu). Rein.
 */
export function radarMoeglich(e: {
  postfaecher: readonly RadarPostfachLage[]; reststunden: number; fensterStunden: number;
  ziele: Record<RadarStrom, number>; bremse?: number; nachfassStufen?: number; grenzeVoll?: number;
}): RadarMoeglich {
  const bremse = Math.max(0, Math.min(1, e.bremse ?? 1));
  const zf = Math.max(0, e.ziele.firma) * bremse, zp = Math.max(0, e.ziele.partner) * bremse;
  const ziel = Math.round((zf + zp) * 10) / 10;
  const bereit = e.postfaecher.filter((p) => p.bereit && !p.pause);
  const rest = bereit.reduce((n, p) => n + Math.max(0, p.grenze - p.heute - (p.reserve ?? 0)), 0);
  const tagVoll = bereit.reduce((n, p) => n + Math.max(0, p.grenze - (p.reserve ?? 0)), 0);
  const genau = e.reststunden > 0 ? rest / e.reststunden : 0;
  const moeglich = Math.floor(genau);
  const leistung = Math.min(ziel, genau);
  const anteil = (z: number) => (zf + zp > 0 ? z / (zf + zp) : 0);
  const tagZiel = (z: number) => z * Math.max(0, e.fensterStunden);
  const sendungen = radarSendungenJeErstmail(e.nachfassStufen);
  const grenzeVoll = Math.max(1, e.grenzeVoll ?? RADAR_HOECHSTENS_JE_TAG);
  const postfaecherNoetig = ziel > 0 ? Math.ceil((ziel * Math.max(0, e.fensterStunden) * sendungen) / grenzeVoll) : 0;
  const zahlText = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
  const satz = moeglich >= ziel
    ? `Ziel ${zahlText(ziel)} je Stunde, heute möglich ${zahlText(ziel)}`
    : `Ziel ${zahlText(ziel)} je Stunde, heute möglich ${moeglich} — mehr Postfächer = mehr Tempo`;
  return {
    ziel, moeglich, leistung: Math.round(leistung * 10) / 10,
    je: { firma: Math.round(leistung * anteil(zf) * 10) / 10, partner: Math.round(leistung * anteil(zp) * 10) / 10 },
    tagJe: { firma: Math.floor(Math.min(tagZiel(zf), tagVoll * anteil(zf))), partner: Math.floor(Math.min(tagZiel(zp), tagVoll * anteil(zp))) },
    postfaecherNoetig, satz,
  };
}

/** „17:13“ in Berliner Zeit — nur über formatToParts (Zeit-Falle Berlin). Rein. */
export function radarUhrzeit(d: Date | string): string {
  const x = new Date(d);
  if (!Number.isFinite(x.getTime())) return "";
  const m = radarBerlinTagMinute(x).minute;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * E-458 (Befund Sicht): Gmail- und Netzfehler in einfachen Worten fürs Chefbüro. Die Rohmeldung (Englisch, JSON) gehört ins
 * Server-Protokoll, nicht in Kachel und Akte. Rein.
 */
export function radarFehlerKlartext(roh: unknown): string {
  const t = String((roh as any)?.message ?? roh ?? "").trim();
  if (/unklar, ob (die mail hinausging|gesendet|der letzte versuch)/i.test(t)) return "Unklar, ob die letzte Mail hinausging — der Gesendet-Ordner wird geprüft";
  const m = /HTTP (\d{3})/.exec(t);
  const c = m ? Number(m[1]) : 0;
  if (c === 429 || /rate.?limit|RESOURCE_EXHAUSTED|too many requests/i.test(t)) return "Gmail bremst kurz (zu viele Mails in kurzer Zeit)";
  if (/^Token für /i.test(t)) return c >= 500 ? "Gmail-Anmeldung kurz gestört" : "Gmail-Zugang abgelaufen oder gesperrt";
  if (c === 401 || c === 403 || /unauthorized_client|invalid_grant|access_denied|GOOGLE_SA_KEY/i.test(t)) return "Gmail-Zugang abgelaufen oder gesperrt";
  if (c >= 500 || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|timeout|aborted/i.test(t)) return "Gmail kurz nicht erreichbar";
  if (c >= 400) return "Gmail hat diese Mail abgelehnt";
  if (/Unterschrift/i.test(t)) return "Keine echte Unterschrift im Postfach";
  return t ? (t.length > 140 ? `${t.slice(0, 137)}…` : t) : "Unbekannte Störung";
}

export interface RadarMotorLage {
  /** Kurz für den Chip oben rechts in der Kachel. */
  chip: string;
  ton: "gut" | "warm" | "leise";
  /** Der Grund in einem einfachen Satz — null, wenn alles läuft. */
  grund: string | null;
  /** Darf „Jetzt eine senden …“ gerade etwas bewirken? */
  senden: boolean;
}
/**
 * E-458 (Befund Sicht): Was der Motor gerade tut — EIN Satz mit dem wahren Grund statt „sendet gerade“ bei „heute möglich 0“.
 * Reihenfolge: Freigabe, Schalter, Fenster, Postfächer (Störung, Pause, voll), Warteschlange. Rein.
 */
export function radarMotorLage(e: {
  an: boolean; freigabe: boolean; imFenster: boolean; schlange: number; von: string;
  postfaecher: readonly RadarPostfachLage[];
}): RadarMotorLage {
  if (!e.freigabe) return { chip: "wartet auf deine Freigabe", ton: "warm", grund: "Der Motor sendet erst nach deiner Freigabe: zuerst drei echte Mails ansehen, dann „Freigeben und starten“.", senden: false };
  if (!e.an) return { chip: "aus", ton: "leise", grund: "„Erste Mails“ ist aus — der Motor bereitet nichts vor und sendet nichts.", senden: false };
  if (!e.imFenster) return { chip: "bereitet vor", ton: "leise", grund: "Außerhalb des Sendefensters: Mara bereitet vor, gesendet wird im Fenster.", senden: false };
  const bereit = e.postfaecher.filter((p) => p.bereit);
  const frei = bereit.filter((p) => !p.pause);
  if (!frei.length) {
    const ruht = bereit.filter((p) => !p.aus && p.ruhtBis).sort((a, b) => String(a.ruhtBis).localeCompare(String(b.ruhtBis)))[0];
    if (ruht) return { chip: `Störung bis ${radarUhrzeit(ruht.ruhtBis!)}`, ton: "warm", grund: `${ruht.ruhtGrund ?? "Kurze Störung"}. Ab ${radarUhrzeit(ruht.ruhtBis!)} Uhr sendet ${ruht.adresse} von selbst weiter.`, senden: false };
    if (bereit.length && bereit.every((p) => p.aus)) return { chip: "Postfächer pausiert", ton: "warm", grund: "Alle Postfächer sind im Chefbüro pausiert (Kachel Postfächer).", senden: false };
    return { chip: "kein Postfach bereit", ton: "warm", grund: "Kein Postfach ist bereit — die Kachel Postfächer zeigt, was fehlt.", senden: false };
  }
  if (frei.every((p) => p.heute + (p.reserve ?? 0) >= p.grenze)) {
    const p = frei[0];
    return { chip: "für heute voll", ton: "warm", grund: `Heute möglich 0: ${p.adresse} hat sein Tageslimit erreicht (${p.heute} von ${p.grenze}${p.reserve ? `, ${p.reserve} Nachfass reserviert` : ""}). Morgen ab ${e.von} Uhr geht es weiter.`, senden: false };
  }
  if (e.schlange <= 0) return { chip: "Warteschlange leer", ton: "leise", grund: "Noch keine fertige Mail — Mara bereitet gerade vor.", senden: false };
  return { chip: "sendet gerade", ton: "gut", grund: null, senden: true };
}

/** Wochentag (1 = Montag) und Minute des Tages in Berliner Zeit — nur über formatToParts (Zeit-Falle Berlin). Rein. */
export function radarBerlinTagMinute(jetzt: Date = new Date()): { tag: number; minute: number } {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  const wert = (t: string) => teile.find((x) => x.type === t)?.value ?? "";
  const tag = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wert("weekday")) + 1;
  return { tag, minute: Number(wert("hour")) * 60 + Number(wert("minute")) };
}

/** Der Berliner Kalendertag „YYYY-MM-DD“ — nur über formatToParts (Zeit-Falle Berlin). Rein. */
export function radarBerlinDatum(d: Date = new Date()): string {
  const teile = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const wert = (t: string) => teile.find((x) => x.type === t)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}

/** Liegt jetzt im Sendefenster des Motors (Tag und Uhrzeit, Berlin)? Rein. */
export function radarMotorImFenster(jetzt: Date, m: RadarMotor): boolean {
  const { tag, minute } = radarBerlinTagMinute(jetzt);
  const von = radarUhrzeitMinuten(m.von) ?? 0, bis = radarUhrzeitMinuten(m.bis) ?? 0;
  return m.tage.includes(tag) && minute >= von && minute < bis;
}

/** Wie viele Stunden das Fenster je Tag hat (für die ehrliche Leistung). Rein. */
export function radarMotorFensterStunden(m: RadarMotor): number {
  return Math.max(0, ((radarUhrzeitMinuten(m.bis) ?? 0) - (radarUhrzeitMinuten(m.von) ?? 0)) / 60);
}

/** Restliche Fensterstunden heute ab jetzt (0 außerhalb). Rein. */
export function radarMotorReststunden(jetzt: Date, m: RadarMotor): number {
  const { tag, minute } = radarBerlinTagMinute(jetzt);
  if (!m.tage.includes(tag)) return 0;
  const von = radarUhrzeitMinuten(m.von) ?? 0, bis = radarUhrzeitMinuten(m.bis) ?? 0;
  return Math.max(0, (bis - Math.max(minute, von)) / 60);
}

export interface RadarMotorSollEin {
  jetzt: Date; m: RadarMotor;
  /** Ziel dieses Stroms je Stunde (vor der Bremse). */
  jeStunde: number;
  /** Erste Mails dieses Stroms heute im Fenster. */
  gesendetHeute: number;
  /** Zeitpunkt der letzten ersten Mail dieses Stroms. */
  letzteAm: Date | string | null;
  /** Zustell-Bremse (1 = volle Fahrt, 0,5 = halbiert, E-458 Punkt 7). */
  bremse?: number;
  /** Seit wann gebremst wird — davor gilt heute das volle Ziel (ohne Angabe: der ganze Tag gebremst). */
  bremseSeit?: Date | string | null;
  /** 0–1 für den Mindestabstand; ohne Angabe fest aus dem Zeitpunkt der letzten Mail (gleiche Mail → gleicher Abstand). */
  zufall?: number;
}

/**
 * Ist jetzt die nächste erste Mail dieses Stroms dran? Soll = Ziel je Stunde × Minuten seit Fensterbeginn / 60; dazu ein
 * Mindestabstand von 60–100 % von 3600 / Ziel Sekunden seit der letzten Mail. So verteilen sich die Mails gleichmäßig über
 * die Stunde, und nach einem Ausfall kommt kein Schwall: höchstens eine je Takt, mit Abstand. Rein.
 * E-458 (Befund Bremse): Beginnt die Bremse heute mitten im Fenster, zählt das volle Ziel bis dahin und das gebremste erst
 * danach — vorher lag das halbe Soll eines ganzen Tages sofort unter dem schon Gesendeten, und der Motor schwieg bis abends.
 */
export function radarMotorSoll(e: RadarMotorSollEin): { faellig: boolean; soll: number; abstandSek: number; grund: string } {
  const faktor = Math.max(0, Math.min(1, e.bremse ?? 1));
  const voll = Math.max(0, e.jeStunde);
  const ziel = voll * faktor;
  if (!radarMotorImFenster(e.jetzt, e.m)) return { faellig: false, soll: 0, abstandSek: 0, grund: "außerhalb des Sendefensters" };
  if (ziel <= 0) return { faellig: false, soll: 0, abstandSek: 0, grund: "Strom aus" };
  const von = radarUhrzeitMinuten(e.m.von) ?? 0;
  const minuteVon = (d: Date) => radarBerlinTagMinute(d).minute + d.getUTCSeconds() / 60;
  const seit = Math.max(0, minuteVon(e.jetzt) - von);
  let ungebremst = 0;
  if (faktor < 1 && e.bremseSeit) {
    const ab = new Date(e.bremseSeit);
    if (Number.isFinite(ab.getTime()) && radarBerlinDatum(ab) === radarBerlinDatum(e.jetzt)) ungebremst = Math.max(0, Math.min(seit, minuteVon(ab) - von));
  }
  const soll = (voll * ungebremst + ziel * (seit - ungebremst)) / 60;
  const letzte = e.letzteAm ? new Date(e.letzteAm).getTime() : NaN;
  const zufall = e.zufall ?? (Number.isFinite(letzte) ? (((Math.floor(letzte / 1000) * 9301 + 49297) % 233280) / 233280) : 0.5);
  const abstandSek = Math.round((3600 / ziel) * (0.6 + 0.4 * Math.max(0, Math.min(1, zufall))));
  if (e.gesendetHeute >= soll) return { faellig: false, soll, abstandSek, grund: "Soll erreicht" };
  if (Number.isFinite(letzte) && (e.jetzt.getTime() - letzte) / 1000 < abstandSek) return { faellig: false, soll, abstandSek, grund: "Abstand zur letzten Mail" };
  return { faellig: true, soll, abstandSek, grund: "fällig" };
}

// ── ÖSTERREICH: KEINE MAILS (E-458 Punkt 8) — seit Justin 29.10.2026 vorerst gar keine Post ─────────────
/**
 * In diese Länder geht nie eine erste Mail und kein Nachfassen (AT: § 174 TKG 2021). Seit Justin 29.10.2026 schreibt die
 * Automatik dorthin auch keinen Brief (RADAR_LAENDER_AKTIV: nur DE und CH) — ein Brief nur noch von Hand in der Akte.
 */
export const RADAR_NUR_BRIEF_LAENDER: readonly RadarLand[] = ["AT"];
/**
 * E-458 (Befund): ÖSTERREICH GEWINNT. Eine Firma gilt als österreichisch, sobald EIN Zeichen es sagt — Spalte land,
 * Impressum-Land, Domäne .at, UID „ATU…“ oder Telefon +43. Vorher entschied die Spalte land allein, und die füllt die
 * Suche notfalls mit „DE“ (das Impressum nimmt das Suchland vor der Endung) — eine .at-Firma aus einer Deutschland-Suche
 * bekam dann eine Mail. Im Zweifel also Brief. Dieselbe Regel steht als SQL in server/lib/fiaon-radar.ts (sqlOesterreich). Rein.
 */
export function radarIstOesterreich(f: { land?: unknown; impressum?: any; domain?: unknown; website?: unknown } | null | undefined): boolean {
  if (!f) return false;
  const imp = f.impressum && typeof f.impressum === "object" ? f.impressum : {};
  if (alsRadarLand(f.land) === "AT" || alsRadarLand(imp.land) === "AT") return true;
  if (/\.at$/.test(radarDomain(f.domain ?? f.website) ?? "")) return true;
  if (/^ATU/i.test(String(imp.ustId ?? imp.ust_id ?? "").replace(/\s+/g, ""))) return true;
  return /^(\+|00)43/.test(String(imp.telefon ?? "").replace(/[^\d+]/g, ""));
}
/** Das Land einer Firma: Österreich, sobald ein Zeichen es sagt; sonst Spalte land, Impressum, Endung .ch, sonst DE. Rein. */
export function radarLandFuer(f: { land?: unknown; impressum?: any; domain?: unknown; website?: unknown } | null | undefined): RadarLand {
  if (radarIstOesterreich(f)) return "AT";
  const direkt = alsRadarLand(f?.land) ?? alsRadarLand(f?.impressum?.land);
  if (direkt) return direkt;
  const d = radarDomain(f?.domain ?? f?.website) ?? "";
  return /\.ch$/.test(d) ? "CH" : "DE";
}
/** Darf in dieses Land eine Mail gehen? Rein. */
export function radarMailErlaubt(land: unknown): boolean {
  return !(RADAR_NUR_BRIEF_LAENDER as readonly string[]).includes(alsRadarLand(land) ?? "DE");
}

// ── DIE PRÜF-KI VOR JEDER MAIL (E-458 Punkt 4) — die Regel, nach der ihr Urteil zählt ─────────
export interface RadarPruefPunkt { regel: string; stelle: string; hinweis: string }
export interface RadarPruefUrteil {
  ok: boolean;
  /** 0 = klingt wie ein Mensch, der genau diesem Menschen schreibt · 10 = klar KI oder Serienmail. */
  ki_klang: number;
  bezug_konkret: boolean; nutzen_klar: boolean; eine_frage: boolean;
  /** Zusage (Finanzierung, Zinssatz, Betrag, Bürgschaft, „bis zu“, Bankname …) — dann nie. */
  zusage: boolean;
  /** Behauptung über die Firma, die nicht in Aufhängern oder Profil steht — dann nie. */
  erfunden: boolean;
  punkte: RadarPruefPunkt[];
  neu_hinweis: string;
}
/**
 * Liest das Urteil der Prüf-KI. Bestanden NUR bei ok && ki_klang ≤ max && bezug && nutzen && eine Frage && keine Zusage &&
 * nichts erfunden. Kaputtes JSON, fehlende Felder oder Unklares zählen als durchgefallen. Rein.
 */
export function radarPruefUrteil(roh: unknown, maxKlang = RADAR_MOTOR_VORGABE.kiKlangMax): { bestanden: boolean; urteil: RadarPruefUrteil | null; gruende: string[] } {
  let x: any = roh;
  if (typeof x === "string") { try { x = JSON.parse(x); } catch { return { bestanden: false, urteil: null, gruende: ["Die Prüf-KI gab kein gültiges Urteil (JSON) zurück"] }; } }
  if (!x || typeof x !== "object" || Array.isArray(x)) return { bestanden: false, urteil: null, gruende: ["Die Prüf-KI gab kein Urteil zurück"] };
  const klang = Number(x.ki_klang);
  const u: RadarPruefUrteil = {
    ok: x.ok === true,
    ki_klang: Number.isFinite(klang) ? Math.max(0, Math.min(10, Math.round(klang))) : 10,
    bezug_konkret: x.bezug_konkret === true, nutzen_klar: x.nutzen_klar === true, eine_frage: x.eine_frage === true,
    zusage: x.zusage !== false, erfunden: x.erfunden !== false,
    punkte: (Array.isArray(x.punkte) ? x.punkte : []).slice(0, 8).map((p: any) => ({
      regel: String(p?.regel ?? "").slice(0, 80), stelle: String(p?.stelle ?? "").slice(0, 200), hinweis: String(p?.hinweis ?? "").slice(0, 300),
    })),
    neu_hinweis: String(x.neu_hinweis ?? "").slice(0, 600),
  };
  const gruende: string[] = [];
  if (u.zusage) gruende.push("Zusage oder Versprechen in der Mail");
  if (u.erfunden) gruende.push("Behauptung über die Firma ohne Beleg");
  if (u.ki_klang > maxKlang) gruende.push(`Klingt nach KI (${u.ki_klang} von 10)`);
  if (!u.bezug_konkret) gruende.push("Kein konkreter Bezug zu genau dieser Firma");
  if (!u.nutzen_klar) gruende.push("Der Nutzen wird nicht klar");
  if (!u.eine_frage) gruende.push("Nicht genau eine Frage");
  if (!u.ok && !gruende.length) gruende.push("Die Prüferin gibt die Mail nicht frei");
  const bestanden = u.ok && !gruende.length;
  if (!bestanden) for (const p of u.punkte.slice(0, 2)) gruende.push(`${p.regel}: ${p.hinweis}`.slice(0, 200));
  return { bestanden, urteil: u, gruende };
}

/**
 * E-458 (Befund Prüf-KI 29.10.2026): Fiel die Mail NUR wegen „Zusage“ durch (sonst alles in Ordnung)? Gemessen schwankte
 * genau dieses Urteil bei wortgleicher Mail (10-mal frei, 2-mal „Zusage“) — dann holt der Motor ein zweites Urteil, bevor er
 * neu schreibt. Rein.
 */
export function radarNurZusage(u: RadarPruefUrteil | null | undefined, maxKlang = RADAR_MOTOR_VORGABE.kiKlangMax): boolean {
  return !!u && u.zusage && !u.erfunden && u.ki_klang <= maxKlang && u.bezug_konkret && u.nutzen_klar && u.eine_frage;
}

/** Die 5-Wort-Folgen eines Textes (klein, ohne Akzente, ß → ss). Rein. */
export function radarSchindeln(text: string, n = 5): Set<string> {
  const woerter = String(text ?? "").toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const aus = new Set<string>();
  for (let i = 0; i + n <= woerter.length; i++) aus.add(woerter.slice(i, i + n).join(" "));
  return aus;
}
/**
 * Fingerabdruck gegen Massenmail-Muster: Welcher Anteil der 5-Wort-Folgen dieses Textes stand schon in EINER der früheren
 * Mails? (Der höchste Wert zählt.) Spamfilter erkennen Serienmails an genau solchen Wiederholungen. Rein.
 */
export function radarAehnlichkeit(text: string, andere: readonly string[]): number {
  const a = radarSchindeln(text);
  if (!a.size) return 0;
  let max = 0;
  for (const t of andere) {
    const b = radarSchindeln(t);
    if (!b.size) continue;
    let gleich = 0;
    for (const x of Array.from(a)) if (b.has(x)) gleich++;
    max = Math.max(max, gleich / a.size);
  }
  return Math.round(max * 1000) / 1000;
}

// ── DER TRICHTER ────────────────────────────────────────────────────────────
/** Die Stufen vom Fund bis zum Kauf — in dieser Reihenfolge zeigt sie das Chefbüro. */
export const RADAR_TRICHTER: { key: string; label: string; satz: string }[] = [
  { key: "gefunden", label: "Gefunden", satz: "geprüfte Firmen" },
  { key: "angeschrieben", label: "Angeschrieben", satz: "erste Mail raus" },
  { key: "zugestellt", label: "Zugestellt", satz: "ohne Rückläufer" },
  { key: "antworten", label: "Antworten", satz: "von Menschen" },
  { key: "leads", label: "Leads", satz: "Interesse" },
  { key: "termine", label: "Termine", satz: "Gespräch gebucht" },
  { key: "angebote", label: "Angebote", satz: "Auftrag offen" },
  { key: "kaeufe", label: "Käufe", satz: "bezahlt" },
]

// ── DER KERNSATZ DER AKQUISE-MAIL (Justin, 12.10.2026) ──────────────────────
// Justin: „Wir helfen Unternehmern dabei, eine LLC (gleichzusetzen mit einer GmbH) in den USA zu gründen, eröffnen für
// unsere Kunden Geschäftskonten, Kreditkarten und ermöglichen Zugang zu Funding (US-Geld ist billiger als europäische
// Kredite in den meisten Fällen!) — baue das sinnvoll und stilvoll ein!“
// So steht es jetzt da, und es hält: Das Konto eröffnet die Bank — wir „kümmern uns darum“. Der Preisvorteil hängt am
// Einführungszeitraum ohne Sollzins (das Hauswort statt „0 %“, E-188) — in dieser Zeit ist das Kapital günstiger als
// jeder verzinste Kredit. Kein Betrag, kein Rahmen, kein Institut-Satz (Justin, 12.10.).
// E-458 (29.10.2026): ohne Gedankenstriche — Justin: „NIEMALS klingt sie nach KI“, und Gedankenstrich-Ketten sind das
// erste Erkennungszeichen. Wirkt auch auf Brief, Nachfass und das Zitat im Chefbüro.
// E-458 (Befund Prüf-KI 29.10.2026): „das Kapital lässt sich einsetzen“ las die Prüf-KI als sicheres Geld (Zusage) — der
// Vorteil steht jetzt als Möglichkeit („wenn es klappt“). Inhalt und Hauswort bleiben, wie Justin sie freigab.
export const RADAR_KERNSATZ = {
  was: "Wir gründen für Unternehmer eine eigene LLC in den USA, das US-Gegenstück zur GmbH, kümmern uns um Geschäftskonto und Firmenkreditkarten und ebnen den Weg zu US-Funding.",
  vorteil: "Viele US-Firmenkarten starten mit einem Einführungszeitraum ohne Sollzins, und wenn es klappt, lässt sich das Kapital auch in Europa einsetzen.",
  vorOrt: "Alles Amerikanische erledigt unser Team vor Ort.",
} as const;

// ── MENSCHLICH, NIE NACH KI (E-458 Punkt 3) ─────────────────────────────────
// Justin: „immer 100 % menschlich, mit Signatur, 100 % personalisiert und NIEMALS klingt sie nach KI … kein Abmelde-Link,
// es soll ja so fühlen, als würde man hier explizit an die Person schreiben und keine Bulk-Kampagne.“
/** Floskeln, an denen man eine KI- oder Massenmail erkennt — in jeder Motor-Mail gesperrt. */
export const RADAR_KI_FLOSKELN: readonly { muster: RegExp; wort: string }[] = [
  { muster: /ich hoffe,?\s+(diese|meine)\s+(nachricht|mail|e-mail)|ich hoffe,?\s+(es geht ihnen|ihnen geht es|sie hatten)/i, wort: "Ich hoffe, diese Nachricht …" },
  { muster: /in der heutigen zeit|in zeiten wie diesen/i, wort: "in der heutigen Zeit" },
  { muster: /\bspannend\w*/i, wort: "spannend" },
  { muster: /\binnovativ\w*/i, wort: "innovativ" },
  { muster: /ma(ß|ss)geschneidert\w*/i, wort: "maßgeschneidert" },
  { muster: /\bnahtlos\w*/i, wort: "nahtlos" },
  { muster: /\bsynergie\w*/i, wort: "Synergie" },
  { muster: /\bmehrwert\w*/i, wort: "Mehrwert" },
  { muster: /\bganzheitlich\w*/i, wort: "ganzheitlich" },
  { muster: /\beinzigartig\w*/i, wort: "einzigartig" },
  { muster: /game.?changer/i, wort: "Game-Changer" },
  { muster: /\brevolution\w*|\bbahnbrechend\w*/i, wort: "revolutionär" },
  { muster: /zögern sie nicht/i, wort: "zögern Sie nicht" },
  { muster: /ich freue mich[^.?!]{0,40}(von ihnen zu hören|auf ihre (rückmeldung|antwort))/i, wort: "Ich freue mich, von Ihnen zu hören" },
  { muster: /\blassen sie uns\b/i, wort: "Lassen Sie uns" },
  { muster: /\bstellen sie sich vor\b/i, wort: "Stellen Sie sich vor" },
  { muster: /win.?win/i, wort: "Win-win" },
  { muster: /nächste[ns]?\s+level/i, wort: "nächstes Level" },
  { muster: /potenzial\w*\s+(voll\s+)?(aus)?(zu\s+)?schöpf/i, wort: "Potenzial ausschöpfen" },
  { muster: /\bunverbindlich\w*/i, wort: "unverbindlich" },
  { muster: /\bkostenlos\w*/i, wort: "kostenlos" },
];

/**
 * Statt eines Abmelde-Links oder Abmelde-Satzes: ein natürlicher letzter Satz vor dem Gruß. Wer antwortet, dass es kein
 * Thema ist, kommt auf die Sperrliste und hört nie wieder von uns (eingangVerarbeiten). Je Firma fest (id % Anzahl).
 * E-458 (Befund „Echo“): Der Satz wird erst NACH dem Schreiben gewählt — einer, der kein Wort mit der Frage teilt.
 * „… gerade ein Thema?“ und danach „… gerade kein Thema …“ liest sich wie ein Baukasten. Die letzten zwei Fassungen tragen
 * keines dieser Wörter und passen deshalb immer.
 */
export const RADAR_SCHLUSSSAETZE: readonly string[] = [
  "Falls das für Sie gerade kein Thema ist, sagen Sie mir einfach kurz Bescheid.",
  "Wenn das bei Ihnen gerade nicht passt, reicht mir eine kurze Antwort.",
  "Ist das für Sie im Moment kein Thema, schreiben Sie mir einfach eine Zeile.",
  "Sollte das gerade nicht Ihr Thema sein, genügt mir ein kurzes Nein.",
  "Falls nicht, genügt mir eine kurze Zeile.",
  "Und wenn nicht, sagen Sie es mir einfach.",
];
/** Die Wörter, die Frage und Schlusssatz nicht teilen dürfen (Thema, passt, gerade, Moment) — je als Stamm. Rein. */
function echoWoerter(text: string | null | undefined): Set<string> {
  const aus = new Set<string>();
  for (const m of Array.from(String(text ?? "").toLowerCase().matchAll(/\b(thema|themen|pass\w*|gerade|moment)\b/g))) {
    aus.add(m[1].startsWith("pass") ? "pass" : m[1].startsWith("them") ? "thema" : m[1]);
  }
  return aus;
}
/** Welche dieser Wörter stehen in Frage UND Schlusssatz? Leer = kein Echo. Rein. */
export function radarSchlussEcho(frage: string | null | undefined, schluss: string | null | undefined): string[] {
  const s = echoWoerter(schluss);
  return Array.from(echoWoerter(frage)).filter((w) => s.has(w));
}
/**
 * Der Schlusssatz dieser Firma zu dieser Frage — ab id % Anzahl der erste ohne Echo. Gleiche Firma, gleiche Frage, gleicher Satz.
 * E-458 (Befund Prüf-KI): Trägt die Mail den Terminlink („Wenn Sie mögen, suchen Sie sich …“), folgt kein zweiter Satz, der
 * mit „Wenn“ beginnt — zweimal „Wenn“ hintereinander liest sich wie ein Baukasten. Rein.
 */
export function radarSchlusssatzFuer(id: number, frage?: string | null, o: { mitLink?: boolean } = {}): string {
  const n = Math.abs(Math.round(Number(id) || 0));
  for (let i = 0; i < RADAR_SCHLUSSSAETZE.length; i++) {
    const s = RADAR_SCHLUSSSAETZE[(n + i) % RADAR_SCHLUSSSAETZE.length];
    if (o.mitLink && /^wenn\b/i.test(s)) continue;
    if (!radarSchlussEcho(frage, s).length) return s;
  }
  return RADAR_SCHLUSSSAETZE[RADAR_SCHLUSSSAETZE.length - 1];
}

/**
 * E-458 (Befund Prüf-KI 29.10.2026): „Ich habe gesehen, dass Sie …“ ist der bekannteste Einstieg automatischer Kaltakquise —
 * vier Mails mit demselben Anfang verraten die Vorlage. Je Firma fest eine von vier Arten, den Anlass zu nennen. Rein.
 */
export const RADAR_EINSTIEGE: readonly { key: string; anweisung: string }[] = [
  { key: "fakt", anweisung: "Beginne direkt mit der Beobachtung als Aussage über die Firma, ohne „Ich habe gesehen“ oder „Ich habe gelesen“ (z. B. „Sie bauen dieses Jahr eine zweite Halle, so steht es auf Ihrer Seite.“)." },
  { key: "quelle", anweisung: "Nenne zuerst kurz, wo es steht, dann die Beobachtung (z. B. „Auf Ihrer Seite steht, dass …“ oder „In Ihrer Mitteilung vom Frühjahr lese ich, dass …“). Nicht „Ich habe gesehen“." },
  { key: "ich", anweisung: "Beginne mit „Ich habe gelesen, dass …“ oder „Ich habe gesehen, dass …“ und der Beobachtung." },
  { key: "kurz", anweisung: "Beginne mit „Kurz zu …“ und dem Anlass als Stichwort, dann ein Satz dazu (z. B. „Kurz zu Ihrer neuen Halle: Bis so ein Bau etwas einbringt, vergeht meist eine Weile.“)." },
];
/** Der Einstieg dieser Firma — je Firma fest (id % 4). Rein. */
export function radarEinstiegFuer(id: number): { key: string; anweisung: string } {
  return RADAR_EINSTIEGE[Math.abs(Math.round(Number(id) || 0)) % RADAR_EINSTIEGE.length];
}

/** Feste, freigegebene Wendungen, die in vielen Mails gleich stehen dürfen (Hauswort) — sie zählen nicht für den Fingerabdruck. */
export const RADAR_HAUSWOERTER: readonly string[] = ["Einführungszeitraum ohne Sollzins"];
/**
 * E-458 (Befund Prüf-KI): der Text für den Fingerabdruck — ohne Hauswort und ohne den freigegebenen Provisions-Satz. Der
 * Pflichtsatz allein machte zwei Partner-Mails schon zu 21 % „gleich“; mit der Angebots-Vorlage sperrte der Motor gute Mails. Rein.
 */
export function radarFingerabdruckText(text: string, feste: readonly (string | null | undefined)[] = []): string {
  let t = String(text ?? "");
  for (const f of [...RADAR_HAUSWOERTER, ...feste]) {
    const s = String(f ?? "").trim();
    if (s.length < 8) continue;
    t = t.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi"), " · ");
  }
  return t;
}
/** Ein Betreff ohne Groß/Klein, Satzzeichen und Doppel-Leerzeichen — gleiche Betreffs über viele Mails sind ein Serienmuster. Rein. */
export function radarBetreffSchluessel(betreff: string | null | undefined): string {
  return String(betreff ?? "").toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
/** Der Schlusssatz dieser Firma ohne bekannte Frage (Rückweg für alte Mails). Rein. */
export function radarSchlusssatz(id: number): string {
  return radarSchlusssatzFuer(id, null);
}
/** Der Gruß dieser Firma — „Viele Grüße“ oder „Beste Grüße“, je Firma fest. Rein. */
export function radarGruss(id: number): string {
  return Math.abs(Math.round(Number(id) || 0)) % 2 ? "Beste Grüße" : "Viele Grüße";
}

// ── NUR ENTSCHEIDER (Justin, 12.10.2026) ────────────────────────────────────
// „Keine info, office, welcome Emails oder so.“ Die erste Mail geht nur noch an die PERSÖNLICHE Adresse eines
// Menschen aus Geschäftsführung, Inhaberschaft oder Vorstand — und nur, wenn sie wörtlich irgendwo steht (Website,
// Pressemitteilung, Verzeichnis). Geraten wird nie (kein vorname.nachname@ auf Verdacht).
/** Sammelpostfächer — nie für eine erste Mail. */
export const RADAR_ADRESSE_GENERISCH = /^(info|infos|office|kontakt|contact|contacts|hello|hallo|hi|hey|servus|moin|mail|email|e-mail|post|postbox|team|service|services|kundenservice|customer|welcome|willkommen|anfrage|anfragen|request|sales|vertrieb|verkauf|business|partner|zentrale|empfang|rezeption|buero|office\d*|verwaltung|admin|administration|general|enquiries|inquiry|inquiries|shop|store|support|marketing|einkauf|purchasing|projekt|projekte|order|team\d*|gf|geschaeftsleitung|geschaeftsfuehrung|management|ceo|vorstand|direktion|leitung)([.+_-]|$|\d)/i;

const PARTIKEL = new Set(["von", "van", "vom", "zu", "zur", "zum", "der", "den", "de", "del", "di", "da", "le", "la", "und", "dr", "prof", "dipl", "ing", "mag", "msc", "mba"]);
/** Namensteile, die in einer persönlichen Adresse stehen können — ohne Umlaute, ohne Partikel. Rein. */
export function radarNamensteile(name: string | null | undefined): string[] {
  const n = String(name ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return Array.from(new Set(n.split(/[^a-z]+/).filter((w) => w.length >= 3 && !PARTIKEL.has(w))));
}

/** Ein Mensch als Vergleichsschlüssel („Dr. Petra Brandt“ → „petra brandt“) — leer, wenn kein Vor- und Nachname da ist. Rein. */
export function radarPersonSchluessel(name: string | null | undefined): string {
  const t = radarNamensteile(name);
  return t.length >= 2 ? t.join(" ") : "";
}
/**
 * E-458 (Befund Go-live): Gehören zwei Radar-Firmen wohl zum selben Betrieb — gleicher Ort oder gleicher Kern der Domäne
 * („kornblume-backstuben.example“ und „kornblume.example“)? Für die Regel „derselbe Mensch bekommt keine zweite Kaltmail“. Rein.
 */
export function radarGleicherBetrieb(a: { ort?: string | null; domain?: string | null }, b: { ort?: string | null; domain?: string | null }): boolean {
  const ort = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-zäöüß]+/g, " ").trim().split(" ")[0] ?? "";
  if (ort(a.ort) && ort(a.ort) === ort(b.ort)) return true;
  const kern = (d: unknown) => new Set(String(d ?? "").toLowerCase().split(".").slice(0, -1).join("-").split(/[^a-z0-9äöü]+/)
    .filter((w) => w.length >= 4 && !/^(gmbh|group|gruppe|holding|online|shop|home|info|mail|team|firma|kanzlei)$/.test(w)));
  const kb = kern(b.domain);
  return Array.from(kern(a.domain)).some((w) => kb.has(w));
}

/** Ist das die persönliche Adresse eines Menschen (und, wenn Namen bekannt sind, eines dieser Menschen)? Rein. */
export function radarAdressePersoenlich(emailRoh: unknown, namen: (string | null | undefined)[] = []): boolean {
  const email = String(emailRoh ?? "").trim().toLowerCase();
  const lokal = email.split("@")[0] ?? "";
  if (!lokal || !email.includes("@")) return false;
  if (RADAR_ADRESSE_GENERISCH.test(lokal) || RADAR_ADRESSE_NIE.test(lokal)) return false;
  const lokalFlach = lokal.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");
  const teile = namen.flatMap((n) => radarNamensteile(n));
  if (teile.length) {
    if (teile.some((t) => lokalFlach.includes(t))) return true;
    // Initiale + Nachname: „jschmidt“, „j.schmidt“, „schmidt.j“
    return namen.some((n) => {
      const t = radarNamensteile(n);
      if (t.length < 2) return false;
      const vor = t[0], nach = t[t.length - 1];
      return lokalFlach === `${vor[0]}${nach}` || lokalFlach === `${nach}${vor[0]}`;
    });
  }
  // Ohne bekannte Namen: nur die eindeutige Form „vorname.nachname“.
  return /^[a-z]{2,}[._-][a-z]{2,}$/.test(lokal);
}

/**
 * E-458 (Befund Anrede): Wem gehört diese Adresse? Der erste Name aus der Liste, zu dem die Adresse passt — sonst null.
 * Stehen zwei Geschäftsführer im Impressum, spricht die Mail den an, dem die Adresse gehört (nicht den ersten). Rein.
 */
export function radarEmpfaengerName(emailRoh: unknown, namen: (string | null | undefined)[]): string | null {
  for (const roh of namen) {
    const n = String(roh ?? "").replace(/\s*\(.*\)\s*$/, "").replace(/\s+/g, " ").trim();
    if (n.split(" ").length >= 2 && radarAdressePersoenlich(emailRoh, [n])) return n;
  }
  return null;
}

/** Zwei Buchstaben in Folge (auch Umlaute) — als RegExp-Objekt, weil das Flag „u“ als Literal hier nicht erlaubt ist. */
const ZWEI_BUCHSTABEN = new RegExp("\\p{L}{2,}", "u");
/** Der Name aus einer Anrede: „Hallo Frau Dr. Brandt,“ → „Brandt“, „Guten Tag Max Müller,“ → „Max Müller“, „Guten Tag,“ → null. Rein. */
export function radarAnredeName(anrede: string | null | undefined): string | null {
  const s = String(anrede ?? "").trim().replace(/,\s*$/, "")
    .replace(/^(guten tag|hallo|sehr geehrte[rs]?|liebe[rs]?)(\s+|$)/i, "")
    .replace(/^(herrn?|frau)\s+/i, "").replace(/^((prof|dr)\.?(-ing\.?)?\s+)+/i, "").trim();
  return ZWEI_BUCHSTABEN.test(s) ? s : null;
}

// ── DIE CHEF-ADRESSE ABLEITEN — NUR MIT BELEGTEM MUSTER (E-458 Punkt 5) ─────────────
// Den Namen der Geschäftsführung kennen wir aus dem Impressum fast immer, ihre persönliche Adresse steht aber nur bei
// knapp der Hälfte irgendwo. Geraten wird trotzdem NIE: Abgeleitet wird nur, wenn auf den Seiten der Firma (Team,
// Karriere, Presse, Datenschutz) mindestens eine persönliche Adresse eines anderen Menschen DERSELBEN Domäne mit Namen
// steht, die genau einem Muster folgt — und keine andere widerspricht. Dazu muss die Domäne Post annehmen (MX).
export const RADAR_ADRESS_MUSTER = [
  "{vorname}.{nachname}", "{v}.{nachname}", "{vorname}{nachname}", "{v}{nachname}", "{nachname}", "{vorname}",
  "{nachname}.{vorname}", "{vorname}-{nachname}", "{vorname}_{nachname}", "{v}{n}",
] as const;
export type RadarAdressMuster = (typeof RADAR_ADRESS_MUSTER)[number];

const NAMEN_TITEL = /^(dr|prof|dipl|ing|mag|msc|mba|bsc|ba|ma|llm|rechtsanwalt|rechtsanwältin|ra|stb|wp|herr|frau)\.?$/i;
const NAMEN_PARTIKEL_ABL = /^(von|van|vom|zu|zur|zum|de|del|der|den|di|da|le|la|du|ten|ter)$/i;
const flach = (t: string) => String(t ?? "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

/** Vor- und Nachname für Adressen (ä → ae, ß → ss, ohne Akzente); mehrteilig = Doppel-, Partikel- oder Mittelname. Rein. */
export function radarNamensFormen(name: string | null | undefined): { vorname: string; nachname: string; mehrteilig: boolean } | null {
  const teile = String(name ?? "").replace(/\(.*?\)/g, " ").replace(/,/g, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t && !NAMEN_TITEL.test(t.replace(/-/g, "")));
  if (teile.length < 2) return null;
  const mehrteilig = teile.length > 2 || teile.some((t) => t.includes("-") || NAMEN_PARTIKEL_ABL.test(t));
  const vorname = flach(teile[0]), nachname = flach(teile[teile.length - 1]);
  if (vorname.length < 2 || nachname.length < 2) return null;
  return { vorname, nachname, mehrteilig };
}

/** Der lokale Teil einer Adresse nach einem Muster. Rein. */
export function radarMusterAnwenden(muster: RadarAdressMuster, f: { vorname: string; nachname: string }): string {
  const v = f.vorname, n = f.nachname;
  switch (muster) {
    case "{vorname}.{nachname}": return `${v}.${n}`;
    case "{v}.{nachname}": return `${v[0]}.${n}`;
    case "{vorname}{nachname}": return `${v}${n}`;
    case "{v}{nachname}": return `${v[0]}${n}`;
    case "{nachname}": return n;
    case "{vorname}": return v;
    case "{nachname}.{vorname}": return `${n}.${v}`;
    case "{vorname}-{nachname}": return `${v}-${n}`;
    case "{vorname}_{nachname}": return `${v}_${n}`;
    case "{v}{n}": return `${v[0]}${n[0]}`;
  }
}

/** Welche Muster ergeben genau diesen lokalen Teil aus diesem Namen? Rein. */
export function radarMusterVon(lokal: string, name: string): RadarAdressMuster[] {
  const f = radarNamensFormen(name);
  if (!f) return [];
  const l = String(lokal ?? "").toLowerCase();
  return RADAR_ADRESS_MUSTER.filter((m) => radarMusterAnwenden(m, f) === l);
}

export interface RadarAdressBeispiel { adresse: string; name: string; url?: string | null }

/**
 * Muster aus nur EINEM Namensteil (oder zwei Buchstaben) sind schwach: „export@“ neben „Abteilung Export“ sieht aus wie
 * {nachname}, „hamburg@“ neben „Niederlassung Hamburg“ ebenso. Sie gelten erst mit zwei verschiedenen Beispielen (E-458, Befund).
 */
export const RADAR_SCHWACHE_MUSTER: readonly RadarAdressMuster[] = ["{nachname}", "{vorname}", "{v}{n}"];

/**
 * Lernt das Adress-Muster einer Domäne aus Beispielen mit Namen. Nur Beispiele der EIGENEN Domäne, nie Sammeladressen.
 * Ergebnis nur, wenn jedes verwertbare Beispiel genau einem Muster folgt und alle dasselbe zeigen — sonst null (nie raten).
 * Schwache Muster (RADAR_SCHWACHE_MUSTER) brauchen mindestens zwei verschiedene Beispiele.
 */
export function radarAdressMusterLernen(beispiele: readonly RadarAdressBeispiel[], domain: string): RadarAdressMuster | null {
  const d = String(domain ?? "").toLowerCase().replace(/^www\./, "");
  let gefunden: RadarAdressMuster | null = null;
  const belege = new Set<string>();
  for (const b of beispiele) {
    const a = String(b?.adresse ?? "").trim().toLowerCase();
    const [lokal, dom] = a.split("@");
    if (!lokal || dom !== d) continue;
    if (RADAR_ADRESSE_GENERISCH.test(lokal) || RADAR_ADRESSE_NIE.test(lokal)) continue;
    if (!radarNamensFormen(b.name)) continue;
    const muster = radarMusterVon(lokal, b.name);
    if (muster.length !== 1) return null;
    if (gefunden && gefunden !== muster[0]) return null;
    gefunden = muster[0];
    belege.add(a);
  }
  if (!gefunden || !belege.size) return null;
  return RADAR_SCHWACHE_MUSTER.includes(gefunden) && belege.size < 2 ? null : gefunden;
}

/**
 * Leitet die Adresse eines Menschen aus Muster und Domäne ab — null bei Doppel-, Partikel- oder Mittelnamen, solange
 * kein Beispiel genau diesen Fall zeigt (dann weiß niemand, wie die Firma ihn schreibt). Rein.
 */
export function radarAdresseAbleiten(name: string, muster: RadarAdressMuster | null, domain: string, beispiele: readonly RadarAdressBeispiel[] = []): string | null {
  const f = radarNamensFormen(name);
  const d = String(domain ?? "").toLowerCase().replace(/^www\./, "");
  if (!f || !muster || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  if (f.mehrteilig && !beispiele.some((b) => radarNamensFormen(b.name)?.mehrteilig && String(b.adresse ?? "").toLowerCase().endsWith(`@${d}`))) return null;
  const lokal = radarMusterAnwenden(muster, f);
  return lokal.length >= 2 ? `${lokal}@${d}` : null;
}

/** Schutz der Ableitung: Rückläuferquote abgeleiteter Adressen in 7 Tagen über der Grenze (ab 30 Sendungen) → abschalten. Rein. */
export function radarAbleitungUrteil(e: { gesendet: number; rueck: number; rueckMax: number; basis?: number }): { abschalten: boolean; quote: number | null } {
  const basis = e.basis ?? 30;
  if (e.gesendet < basis) return { abschalten: false, quote: null };
  const quote = Math.round((e.rueck / e.gesendet) * 1000) / 10;
  return { abschalten: quote > e.rueckMax, quote };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-339 (12.10.2026) — BRIEF STATT MAIL
//
// Seit Justins Vorgabe „keine info, office, welcome Emails“ geht die erste Mail nur an die persönliche, öffentlich
// belegte Adresse eines Entscheiders — und die steht (Probe 12.10.) bei 1 von 20 Firmen auf der Website. Name des
// Geschäftsführers und Firmenanschrift stehen dagegen im Impressum (gemessen 12.10.: 943 von 1.079 Firmen mit
// Anschrift, 512 davon auch mit Namen eines Vertreters). Für Firmen mit Kapitalsignal ≥ 3 ohne persönliche Adresse
// schreibt Mara deshalb einen Brief an den Geschäftsführer. Personalisierte Briefwerbung ist nach Art. 6 Abs. 1 lit. f
// DSGVO zulässig (OLG Stuttgart, Hinweisbeschluss 02.02.2024, 2 U 63/22) — mit Datenschutzhinweis samt Herkunft der
// Daten (Art. 14) und deutlich abgesetztem Widerspruchsweg (Art. 21 Abs. 4). Für den Text gelten dieselben Wände wie
// für die Mail: kein Betrag, kein Kapitalrahmen, kein Institut-Satz, Wortwand.
// Hier steht, was Server und Chefbüro gleich sehen müssen; die Arbeit macht server/lib/fiaon-radar-brief.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type RadarBriefAnbieter = "pingen" | "letterxpress";

/** Die zwei Versanddienste (Recherche 12.10.2026). Preise netto in Cent je Brief — eine Schätzung, bis der Dienst den echten Preis meldet. */
export const RADAR_BRIEF_ANBIETER: Record<RadarBriefAnbieter, { label: string; preisCents: Record<RadarLand, number>; geschaetzt: readonly RadarLand[]; test: string; schluessel: string }> = {
  // Pingen-Rechner, gemessen 12.10.2026: DE 1,14 € unter 500 Briefen im Monat (ab 500: 0,96 €), AT 1,43 €, CH 1,28 €.
  pingen: {
    label: "Pingen", preisCents: { DE: 114, AT: 143, CH: 128 }, geschaetzt: [],
    test: "Testmodus: Der Brief wird bei Pingen hochgeladen und geprüft, aber nicht abgeschickt — er liegt dort zur Ansicht und kostet nichts.",
    schluessel: "PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET, PINGEN_ORGANISATION_ID",
  },
  // LetterXpress-Preisliste: 0,76 € netto (DE). Ins Ausland ist der Preis nicht belegt — 1,50 € geschätzt.
  letterxpress: {
    label: "LetterXpress", preisCents: { DE: 76, AT: 150, CH: 150 }, geschaetzt: ["AT", "CH"],
    test: "Testmodus: Der Auftrag landet in der LetterXpress-Postbox und wird nicht gedruckt.",
    schluessel: "LETTERXPRESS_BENUTZER, LETTERXPRESS_API_KEY",
  },
};

export interface RadarBriefEinstellung {
  /** Gehen Briefe hinaus (von Hand aus der Akte und durch Mara im Tageskontingent)? Ohne Schalter: nur Brief und Vorschau. */
  versand: boolean;
  /** Höchstens so viele Briefe am Tag (von Hand und automatisch zusammen). */
  jeTag: number;
  anbieter: RadarBriefAnbieter;
  /** Testmodus: Der Dienst bekommt den Brief, druckt ihn aber nicht (Pingen ohne Absenden, LetterXpress-Postbox). */
  testmodus: boolean;
  /** Farbdruck (Glasblau) oder Graustufen. */
  farbe: boolean;
}
export const RADAR_BRIEF_VORGABE: RadarBriefEinstellung = { versand: false, jeTag: 10, anbieter: "pingen", testmodus: true, farbe: true };
/** Harte Obergrenze je Tag — ein Fehler in der Automatik kostet sonst schnell dreistellig. */
export const RADAR_BRIEF_HOECHSTENS_JE_TAG = 100;
export const RADAR_BRIEF_SCHLUESSEL = {
  versand: "radar_brief_versand", jeTag: "radar_brief_je_tag", anbieter: "radar_brief_anbieter", testmodus: "radar_brief_testmodus", farbe: "radar_brief_farbe",
} as const;

/** Liest die Brief-Schalter aus Rohwerten (fiaon_settings key → value). Rein. */
export function radarBriefEinstellungLesen(roh: Record<string, string | null | undefined>): RadarBriefEinstellung {
  const v = RADAR_BRIEF_VORGABE;
  const k = RADAR_BRIEF_SCHLUESSEL;
  const n = Math.round(Number(roh[k.jeTag]));
  const anbieter = String(roh[k.anbieter] ?? "").trim();
  return {
    versand: roh[k.versand] != null ? roh[k.versand] === "an" : v.versand,
    jeTag: Number.isFinite(n) && String(roh[k.jeTag] ?? "").trim() !== "" ? Math.max(0, Math.min(RADAR_BRIEF_HOECHSTENS_JE_TAG, n)) : v.jeTag,
    anbieter: anbieter === "pingen" || anbieter === "letterxpress" ? anbieter : v.anbieter,
    // Unbekannt = Testmodus. Echte Briefe nur, wenn jemand ausdrücklich „aus“ gesetzt hat.
    testmodus: roh[k.testmodus] != null ? roh[k.testmodus] !== "aus" : v.testmodus,
    farbe: roh[k.farbe] != null ? roh[k.farbe] !== "aus" : v.farbe,
  };
}

/** Was ein Brief voraussichtlich kostet (netto, Cent) — geschätzt, bis der Dienst den Preis meldet. Rein. */
export function radarBriefKosten(anbieter: RadarBriefAnbieter, land: unknown): { cents: number; geschaetzt: boolean } {
  const a = RADAR_BRIEF_ANBIETER[anbieter] ?? RADAR_BRIEF_ANBIETER.pingen;
  const l = alsRadarLand(land) ?? "DE";
  return { cents: a.preisCents[l], geschaetzt: a.geschaetzt.includes(l) };
}

/** Die Kennung, unter der Besuche aus dem QR-Code des Briefs zählen (utm_source). */
export const RADAR_BRIEF_QUELLE = "radar_brief";
/**
 * Der Link im QR-Code: die Startseite fiaon.com/ mit Kennung r<ID> und Sprung zum Gesprächstermin. E-458 nach E-461
 * (29.10.2026): direkt auf „/“ — /business leitet nur noch per 301 dorthin. Gezählt wird der Besuch auf „/“ (server/routes.ts);
 * alte Briefe mit /business… kommen über die 301 mit derselben Abfrage dort an und zählen genau einmal. Rein.
 */
export function radarBriefLink(id: number, basis = "https://fiaon.com"): string {
  return `${String(basis).replace(/\/+$/, "")}/?utm_source=${RADAR_BRIEF_QUELLE}&utm_content=r${Math.round(id)}#gespraech`;
}
/** Die Kennung der Firma auf dem Brief — für Widerspruch und Rückfragen. */
export function radarBriefKennung(id: number): string {
  return `R-${Math.round(id)}`;
}
/** „r123“ → 123, sonst null. Rein. */
export function radarKennungLesen(utmContent: unknown): number | null {
  const m = String(utmContent ?? "").trim().match(/^r(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

/**
 * Der Terminlink einer Radar-Mail mit Zuordnung (utm_content = r<ID>) — EINE Stelle für Mail und Kurzlink. E-458 nach E-461
 * (29.10.2026): Den Abschnitt „Gespräch vereinbaren“ (#gespraech) trägt jetzt die Startseite fiaon.com/ — der Link zeigt
 * direkt dorthin, ohne die 301 von /business; Abfrage (utm_*) und Anker kommen so ohne Umweg an. Rein.
 */
export function radarTerminLink(id: number, basis = "https://fiaon.com"): string {
  return `${String(basis).replace(/\/+$/, "")}/?utm_source=radar&utm_medium=email&utm_campaign=${RADAR_KAMPAGNE}&utm_content=r${Math.round(id)}#gespraech`;
}
/**
 * E-458 nach E-461 (29.10.2026): stellt einen Link des Radars auf die neue Startseite — „/“ (deutsch) oder „/en“ (englisch).
 * Gilt für die Übersicht in jeder alten Form (/business, /business/, /en/business, /en, „/“) und auch für Links, die schon
 * gespeichert sind (Mails vor E-461, f.mail.links); Abfrage (utm_*) und Anker (#gespraech) bleiben unverändert. Unterseiten
 * (/business/onlinehandel …), der Kurzlink (/g/r<ID>) und alles andere bleiben, wie sie sind. Nur für eigene Links. Rein.
 */
export function radarStartseiteLink(link: string, en = false): string {
  return String(link ?? "").replace(/^((?:https?:\/\/[^/?#]+)?)(?:\/(?:en\/?|(?:en\/)?business\/?)?)?(?=[?#]|$)/i,
    (_m: string, host: string) => `${host}${en ? "/en" : "/"}`);
}
/**
 * E-458 (Befund): Der Link in der ersten Mail ist kurz und persönlich — fiaon.com/g/r<ID> statt einer langen Adresse mit
 * „utm_campaign=firmen_radar“, an der jeder Empfänger die Serienmail erkennt. Der Server leitet weiter (radarKurzlinkZiel). Rein.
 */
export function radarKurzlink(id: number, basis = "https://fiaon.com"): string {
  return `${String(basis).replace(/\/+$/, "")}/g/r${Math.round(id)}`;
}
/**
 * Wohin der Kurzlink führt: mit gültiger Kennung zum Terminlink (die Zuordnung bleibt), sonst zur Übersicht — beides seit
 * E-461 direkt auf der Startseite „/“ (eine Weiterleitung, keine Kette). Rein.
 */
export function radarKurzlinkZiel(kennung: unknown): string {
  const id = radarKennungLesen(kennung);
  return id ? radarTerminLink(id, "") : "/";
}

const LAND_ZEILE: Record<RadarLand, string> = { DE: "DEUTSCHLAND", AT: "ÖSTERREICH", CH: "SCHWEIZ" };
/** Geschäftsführung, Inhaberschaft, Vorstand — wer über einen Brief an die Firma entscheidet. */
export const RADAR_ROLLE_CHEF = /geschäftsführ|geschaeftsfuehr|inhaber|ceo|vorstand|director|gründer|gruender|founder|präsident|praesident|managing|gesellschafter|komplementär/i;
/**
 * E-458 (Befund Prüf-KI 29.10.2026): „Guten Tag Hannah Albrecht“ wirkt wie ein Serienbrief-Feld. Ein weibliches Rollenwort
 * AM NAMEN dieses Menschen (Impressum: „Geschäftsführerin“, „Inhaberin“, „Steuerberaterin“ …) belegt „Frau“. Männliche Formen
 * nicht — sie stehen oft für alle. Geraten wird weiter nie. Rein.
 */
export const RADAR_ROLLE_WEIBLICH = /(^|[^a-zäöüß])(geschäftsführerin|geschaeftsfuehrerin|inhaberin|steuerberaterin|rechtsanwältin|rechtsanwaeltin|gesellschafterin|gründerin|gruenderin|vorständin|vorstaendin|prokuristin|partnerin|direktorin|präsidentin|praesidentin|wirtschaftsprüferin|wirtschaftsprueferin|notarin)([^a-zäöüß]|$)/i;
export function radarAnredeAusRolle(rolle: string | null | undefined): "Frau" | null {
  return RADAR_ROLLE_WEIBLICH.test(String(rolle ?? "")) ? "Frau" : null;
}
const NAMEN_PARTIKEL = /^(von|van|vom|zu|zur|zum|de|del|der|den|di|da|le|la|und)$/i;

/**
 * „ANDREAS SCHMALE“ → „Andreas Schmale“ (Impressen schreiben Namen oft in Versalien). Gemischte Schreibung bleibt,
 * wie sie ist — „McLean“ oder „zur Linden“ weiß der Mensch besser als wir. Rein.
 */
export function radarNameSchreibweise(name: string | null | undefined): string {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!/[A-ZÄÖÜ]/.test(n) || n !== n.toUpperCase()) return n;
  return n.split(" ").map((w, i) => {
    if (i > 0 && NAMEN_PARTIKEL.test(w)) return w.toLowerCase();
    return w.split("-").map((t) => t.charAt(0) + t.slice(1).toLowerCase()).join("-");
  }).join(" ");
}

export interface RadarBriefEmpfaenger {
  firma: string;
  person: string | null;
  rolle: string | null;
  anrede: "Herr" | "Frau" | null;
  strasse: string;
  plz: string;
  ort: string;
  land: RadarLand | null;
  /** Die Zeilen im Anschriftfeld, von oben nach unten (DIN 5008). */
  zeilen: string[];
  /** Was für einen persönlichen Brief fehlt — leer = vollständig. */
  fehlt: string[];
}

/** Die Person, an die der Brief geht: Geschäftsführung aus dem Impressum zuerst, sonst der belegte Entscheider. Rein. */
export function radarBriefPerson(impressum: any, entscheider?: { name?: string | null; rolle?: string | null } | null): { name: string; rolle: string | null } | null {
  const vertreter: { name: string; rolle: string | null }[] = (Array.isArray(impressum?.vertreter) ? impressum.vertreter : [])
    .map((v: any) => ({ name: radarNameSchreibweise(String(v?.name || [v?.vorname, v?.nachname].filter(Boolean).join(" ")).replace(/\(.*?\)/g, "")), rolle: v?.funktion ? String(v.funktion).trim() : null }))
    .filter((v: { name: string }) => v.name.split(/\s+/).filter((w) => /[a-zäöüß]{2,}/i.test(w)).length >= 2 && v.name.length <= 60);
  const chef = vertreter.find((v) => v.rolle && RADAR_ROLLE_CHEF.test(v.rolle)) ?? vertreter.find((v) => !v.rolle);
  if (chef) return chef;
  const e = radarNameSchreibweise(entscheider?.name ?? "");
  if (e.split(/\s+/).length >= 2) return { name: e, rolle: entscheider?.rolle ? String(entscheider.rolle) : null };
  return null;
}

/** Baut das Anschriftfeld aus dem Impressum. „Herrn“/„Frau“ nur, wenn die Anrede belegt ist — geraten wird nie. Rein. */
export function radarBriefAnschrift(impressum: any, opts: { firmenname?: string | null; land?: unknown; anrede?: "Herr" | "Frau" | null; entscheider?: { name?: string | null; rolle?: string | null } | null } = {}): RadarBriefEmpfaenger {
  const imp = impressum && typeof impressum === "object" ? impressum : {};
  const firma = String(imp.name || opts.firmenname || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const person = radarBriefPerson(imp, opts.entscheider ?? null);
  const strasse = String(imp.strasse ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const plz = String(imp.plz ?? "").replace(/\s+/g, "").trim();
  const ort = String(imp.ort ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const land = alsRadarLand(imp.land) ?? alsRadarLand(opts.land);
  const anrede = opts.anrede === "Herr" || opts.anrede === "Frau" ? opts.anrede : null;
  const fehlt: string[] = [];
  if (!firma) fehlt.push("Firmenname");
  if (!person) fehlt.push("Name der Geschäftsführung");
  if (!strasse || !/\d/.test(strasse)) fehlt.push("Straße mit Hausnummer");
  if (!land) fehlt.push("Land (DE, AT oder CH)");
  if (!(land === "DE" ? /^\d{5}$/.test(plz) : /^\d{4}$/.test(plz))) fehlt.push("Postleitzahl");
  if (!ort) fehlt.push("Ort");
  const personZeile = person ? `${anrede === "Herr" ? "Herrn " : anrede === "Frau" ? "Frau " : ""}${person.name}` : null;
  const zeilen = [firma, personZeile, strasse, `${plz} ${ort}`.trim(), land ? LAND_ZEILE[land] : ""].filter((z): z is string => !!z && !!z.trim());
  return { firma, person: person?.name ?? null, rolle: person?.rolle ?? null, anrede, strasse, plz, ort, land, zeilen, fehlt };
}

export interface RadarBriefPruefFirma {
  status: string; land?: string | null; signal_staerke?: number | null; versendet_am?: unknown; brief_versendet_am?: unknown;
  entscheider?: { name?: string | null; email?: string | null; weg?: string | null; muster_widerlegt?: boolean | null } | null; impressum?: any; name?: string | null; domain?: string | null;
}
/**
 * Bekommt diese Firma einen Brief? Jede Bedingung einzeln — das Chefbüro zeigt sie als Liste mit Haken. Rein.
 * Die Mail an eine persönliche Adresse geht vor (kostet nichts, Antwort mit einer Zeile) — außer in Ländern ohne Mail
 * (E-458: Österreich; seit 29.10. schreibt die Automatik dorthin auch keinen Brief, nur noch von Hand).
 */
export function radarBriefPruefen(f: RadarBriefPruefFirma): { ok: boolean; punkte: { key: string; ok: boolean; text: string }[] } {
  const anschrift = radarBriefAnschrift(f.impressum, { firmenname: f.name, land: f.land });
  const nurBrief = !radarMailErlaubt(radarLandFuer(f));
  // E-458 (Justin 29.10.2026, wörtlich „lass Österreich komplett weg, kein Brief, keine Email“): auch kein Brief von Hand.
  const landAktiv = radarLandAktiv(radarLandFuer(f));
  // E-458 (Punkt 5): Eine abgeleitete Adresse, die als unzustellbar zurückkam (muster_widerlegt), zählt nicht mehr.
  const widerlegt = f.entscheider?.weg === "abgeleitet" && f.entscheider?.muster_widerlegt === true;
  const persoenlich = !nurBrief && !widerlegt && !!f.entscheider?.email && radarAdressePersoenlich(f.entscheider.email, [f.entscheider.name]);
  const zu = ["gesperrt", "kein_interesse", "passt_nicht"].includes(f.status);
  const gespraech = (RADAR_IM_GESPRAECH as readonly string[]).includes(f.status);
  // E-458 (Befund): Kam die erste Mail an eine ABGELEITETE Adresse unzustellbar zurück, hat die Firma nie etwas von uns
  // gelesen — dann geht der Brief (das verspricht die Ableitung), obwohl versendet_am gesetzt ist.
  const zurueck = f.status === "unzustellbar" && widerlegt;
  const punkte = [
    { key: "land", ok: landAktiv, text: landAktiv ? "Deutschland oder Schweiz" : "Österreich: vorerst gar keine Post — weder Mail noch Brief (nur Deutschland und die Schweiz)" },
    { key: "signal", ok: Number(f.signal_staerke ?? 0) >= RADAR_SIGNAL_AB, text: `Kapitalsignal ab Stärke ${RADAR_SIGNAL_AB}${f.signal_staerke != null ? ` (hat ${f.signal_staerke})` : " (noch nicht geprüft)"}` },
    { key: "persoenlich", ok: !persoenlich, text: nurBrief ? "Österreich: keine Mail" : persoenlich ? "Persönliche Adresse des Entscheiders bekannt — die Mail geht vor" : "Keine persönliche Adresse des Entscheiders" },
    { key: "anschrift", ok: !anschrift.fehlt.length, text: anschrift.fehlt.length ? `Anschrift unvollständig: ${anschrift.fehlt.join(", ")}` : "Name und Anschrift aus dem Impressum vollständig" },
    { key: "offen", ok: !zu && !gespraech && (!f.versendet_am || zurueck), text: zu ? "Gesperrt, abgelehnt oder passt nicht" : gespraech ? "Mit der Firma läuft schon ein Gespräch" : zurueck ? "Die Mail an die abgeleitete Adresse kam zurück — der Brief geht" : f.versendet_am ? "Hat schon eine erste Mail bekommen" : "Noch kein Kontakt, nicht gesperrt" },
    { key: "einmal", ok: !f.brief_versendet_am, text: f.brief_versendet_am ? "Hat schon einen Brief bekommen — je Firma genau einer" : "Noch kein Brief an diese Firma" },
  ];
  return { ok: punkte.every((p) => p.ok), punkte };
}

/**
 * Die festen Sätze auf jedem Brief — eine Quelle für Server, Chefbüro und die Wortwand (scripts/pruef-wortwand-de.ts).
 * Datenschutzhinweis nach Art. 14 DSGVO in knapper Form (Verantwortlicher, Zweck, Rechtsgrundlage, Quelle, Empfänger,
 * Speicherdauer als Kriterium, Rechte) mit Verweis auf die volle Erklärung; der Widerspruch steht davon abgesetzt.
 */
export const RADAR_BRIEF_TEXTE = {
  qrTitel: "Ihr Gespräch mit mir",
  qrSatz: "Code scannen und eine Zeit für 30 Minuten wählen.",
  // E-461: fiaon.com/ ist die Global-Startseite mit „Gespräch vereinbaren“ — die kurze Adresse genügt.
  qrOhneCode: "Ohne Code: fiaon.com",
  antwort: (mail: string) => `Lieber direkt: ${mail}`,
  telefon: (telefon: string) => `oder Telefon ${telefon}`,
  widerspruchTitel: "Keine Post mehr von uns?",
  widerspruch: (kennung: string, mail: string, telefon: string) =>
    `Sie können der Nutzung Ihrer Daten für Werbung jederzeit widersprechen (Art. 21 DSGVO). Eine kurze Nachricht an ${mail}, ein Anruf unter ${telefon} oder eine Zeile an die Anschrift oben genügt, gern mit der Kennung ${kennung}. Wir sperren Ihre Daten dann sofort für jede weitere Werbung.`,
  datenschutzTitel: "Datenschutzhinweis",
  datenschutz: (quelle: string) =>
    `Verantwortlich ist ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} (${FIAON_FIRMA.email}). Ihren Namen, Ihre Funktion und die Geschäftsanschrift haben wir ${quelle} entnommen. Wir nutzen sie, um Ihnen unser Angebot einmal persönlich vorzustellen; Rechtsgrundlage ist unser berechtigtes Interesse an Direktwerbung (Art. 6 Abs. 1 lit. f DSGVO). Gedruckt und versandt hat den Brief ein Druck- und Versanddienstleister in unserem Auftrag. Der Code trägt eine Kennnummer, damit wir sehen, ob dieser Brief zu einem Besuch auf unserer Website geführt hat. Wir speichern die Angaben, bis Sie widersprechen oder die Ansprache abgeschlossen ist; nach einem Widerspruch bleibt nur der Eintrag in unserer Sperrliste, damit Sie keine Werbung mehr erhalten. Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Beschwerde bei einer Aufsichtsbehörde. Mehr unter fiaon.com/datenschutz.`,
  ruecksendung: `${FIAON_FIRMA.name} · ${FIAON_FIRMA.strasse} · ${FIAON_FIRMA.ortZeile} · UK`,
} as const;
