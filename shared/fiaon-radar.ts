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
// E-337 (12.10.2026): vorher fand der Radar „Wachstum oder US-Bezug“ — und damit VC-finanzierte Scale-ups mit eigenem
// Finanzchef (Langdock, Kraftblock, neustark, FENECON mit 400 Mitarbeitern und US-Fabrik). Unser Käufer ist der Inhaber
// einer kleinen oder mittleren Firma, der JETZT Kapital braucht. Ohne belegtes Kapitalsignal schreibt Mara nicht selbst.
export const RADAR_ZIELBILD = {
  muss: [
    "Sitz in Deutschland, Österreich oder der Schweiz, eigene Website mit Impressum",
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
  const buchen = RADAR_BUCHBAR.includes(l.art) && l.wunschFrei && l.telefon && l.maraModus === "auto" && l.frisch && !l.buchungslink && !l.roboter;
  if (buchen) schritte.push("Die Wunschzeit ist frei: Mara trägt sie in den Global-Kalender ein. Die Firma bekommt die Bestätigung mit Kalendereintrag.");
  else if (RADAR_BUCHBAR.includes(l.art) && l.wunschFrei && !l.buchungslink) {
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
/** Nach wie vielen Tagen die erste und die zweite Nachfass-Mail fällig werden (ab der Mail davor). Danach Schluss. */
export const RADAR_NACHFASS_TAGE: readonly number[] = [3, 5];

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
  /** Firmen-Mails: ein Link „Einen Termin wählen“ nach der Frage — oder keiner. Partner-Mails tragen nie einen. */
  link: "termin" | "keiner";
}
/** Harte Obergrenze je Strom und Stunde — darüber wird aus persönlich Massenversand. */
export const RADAR_MOTOR_HOECHSTENS_JE_STUNDE = 30;
export const RADAR_MOTOR_VORGABE: RadarMotor = { tage: [1, 2, 3, 4, 5], von: "07:00", bis: "19:00", firmenJeStunde: 10, partnerJeStunde: 10, puffer: 1.2, haltbarTage: 7, link: "termin" };
export const RADAR_MOTOR_SCHLUESSEL = {
  tage: "radar_motor_tage", von: "radar_motor_von", bis: "radar_motor_bis", firmenJeStunde: "radar_motor_firmen_je_stunde",
  partnerJeStunde: "radar_motor_partner_je_stunde", puffer: "radar_motor_puffer", haltbarTage: "radar_motor_haltbar_tage",
  link: "radar_motor_link",
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
  };
}

/** Wochentag (1 = Montag) und Minute des Tages in Berliner Zeit — nur über formatToParts (Zeit-Falle Berlin). Rein. */
export function radarBerlinTagMinute(jetzt: Date = new Date()): { tag: number; minute: number } {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  const wert = (t: string) => teile.find((x) => x.type === t)?.value ?? "";
  const tag = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wert("weekday")) + 1;
  return { tag, minute: Number(wert("hour")) * 60 + Number(wert("minute")) };
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
  /** 0–1 für den Mindestabstand; ohne Angabe fest aus dem Zeitpunkt der letzten Mail (gleiche Mail → gleicher Abstand). */
  zufall?: number;
}

/**
 * Ist jetzt die nächste erste Mail dieses Stroms dran? Soll = Ziel je Stunde × Minuten seit Fensterbeginn / 60; dazu ein
 * Mindestabstand von 60–100 % von 3600 / Ziel Sekunden seit der letzten Mail. So verteilen sich die Mails gleichmäßig über
 * die Stunde, und nach einem Ausfall kommt kein Schwall: höchstens eine je Takt, mit Abstand. Rein.
 */
export function radarMotorSoll(e: RadarMotorSollEin): { faellig: boolean; soll: number; abstandSek: number; grund: string } {
  const ziel = Math.max(0, e.jeStunde) * Math.max(0, Math.min(1, e.bremse ?? 1));
  if (!radarMotorImFenster(e.jetzt, e.m)) return { faellig: false, soll: 0, abstandSek: 0, grund: "außerhalb des Sendefensters" };
  if (ziel <= 0) return { faellig: false, soll: 0, abstandSek: 0, grund: "Strom aus" };
  const { minute } = radarBerlinTagMinute(e.jetzt);
  const seit = Math.max(0, minute - (radarUhrzeitMinuten(e.m.von) ?? 0)) + e.jetzt.getUTCSeconds() / 60;
  const soll = (ziel * seit) / 60;
  const letzte = e.letzteAm ? new Date(e.letzteAm).getTime() : NaN;
  const zufall = e.zufall ?? (Number.isFinite(letzte) ? (((Math.floor(letzte / 1000) * 9301 + 49297) % 233280) / 233280) : 0.5);
  const abstandSek = Math.round((3600 / ziel) * (0.6 + 0.4 * Math.max(0, Math.min(1, zufall))));
  if (e.gesendetHeute >= soll) return { faellig: false, soll, abstandSek, grund: "Soll erreicht" };
  if (Number.isFinite(letzte) && (e.jetzt.getTime() - letzte) / 1000 < abstandSek) return { faellig: false, soll, abstandSek, grund: "Abstand zur letzten Mail" };
  return { faellig: true, soll, abstandSek, grund: "fällig" };
}

// ── ÖSTERREICH BEKOMMT BRIEFE, KEINE MAILS (E-458 Punkt 8) ───────────────────
/** In diese Länder geht keine erste Mail und kein Nachfassen — nur der Brief (AT: § 174 TKG 2021). */
export const RADAR_NUR_BRIEF_LAENDER: readonly RadarLand[] = ["AT"];
/** Das Land einer Firma: Spalte land, sonst das Impressum, sonst die Endung der Domäne (.at, .ch), sonst DE. Rein. */
export function radarLandFuer(f: { land?: unknown; impressum?: any; domain?: unknown; website?: unknown } | null | undefined): RadarLand {
  const direkt = alsRadarLand(f?.land) ?? alsRadarLand(f?.impressum?.land);
  if (direkt) return direkt;
  const d = radarDomain(f?.domain ?? f?.website) ?? "";
  return /\.at$/.test(d) ? "AT" : /\.ch$/.test(d) ? "CH" : "DE";
}
/** Darf in dieses Land eine Mail gehen? Rein. */
export function radarMailErlaubt(land: unknown): boolean {
  return !(RADAR_NUR_BRIEF_LAENDER as readonly string[]).includes(alsRadarLand(land) ?? "DE");
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
export const RADAR_KERNSATZ = {
  was: "Wir gründen für Unternehmer eine eigene LLC in den USA, das US-Gegenstück zur GmbH, kümmern uns um Geschäftskonto und Firmenkreditkarten und ebnen den Weg zu US-Funding.",
  vorteil: "Viele US-Firmenkarten starten mit einem Einführungszeitraum ohne Sollzins, und das Kapital lässt sich auch in Europa einsetzen.",
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
 * Thema ist, kommt auf die Sperrliste und hört nie wieder von uns (eingangVerarbeiten). Je Firma fest (id % 4).
 */
export const RADAR_SCHLUSSSAETZE: readonly string[] = [
  "Falls das für Sie gerade kein Thema ist, sagen Sie mir einfach kurz Bescheid.",
  "Wenn das bei Ihnen gerade nicht passt, reicht mir eine kurze Antwort.",
  "Ist das für Sie im Moment kein Thema, schreiben Sie mir einfach eine Zeile.",
  "Sollte das gerade nicht Ihr Thema sein, genügt mir ein kurzes Nein.",
];
/** Der Schlusssatz dieser Firma — gleiche Firma, gleicher Satz. Rein. */
export function radarSchlusssatz(id: number): string {
  const n = Math.abs(Math.round(Number(id) || 0));
  return RADAR_SCHLUSSSAETZE[n % RADAR_SCHLUSSSAETZE.length];
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
/** Der Link im QR-Code: /business mit Kennung r<ID> und Sprung zum Gesprächstermin. Rein. */
export function radarBriefLink(id: number, basis = "https://fiaon.com"): string {
  return `${String(basis).replace(/\/+$/, "")}/business?utm_source=${RADAR_BRIEF_QUELLE}&utm_content=r${Math.round(id)}#gespraech`;
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

const LAND_ZEILE: Record<RadarLand, string> = { DE: "DEUTSCHLAND", AT: "ÖSTERREICH", CH: "SCHWEIZ" };
/** Geschäftsführung, Inhaberschaft, Vorstand — wer über einen Brief an die Firma entscheidet. */
export const RADAR_ROLLE_CHEF = /geschäftsführ|geschaeftsfuehr|inhaber|ceo|vorstand|director|gründer|gruender|founder|präsident|praesident|managing|gesellschafter|komplementär/i;
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
  entscheider?: { name?: string | null; email?: string | null } | null; impressum?: any; name?: string | null; domain?: string | null;
}
/**
 * Bekommt diese Firma einen Brief? Jede Bedingung einzeln — das Chefbüro zeigt sie als Liste mit Haken. Rein.
 * Die Mail an eine persönliche Adresse geht vor (kostet nichts, Antwort mit einer Zeile) — außer in Ländern, die nur
 * Briefe bekommen (E-458: Österreich).
 */
export function radarBriefPruefen(f: RadarBriefPruefFirma): { ok: boolean; punkte: { key: string; ok: boolean; text: string }[] } {
  const anschrift = radarBriefAnschrift(f.impressum, { firmenname: f.name, land: f.land });
  const nurBrief = !radarMailErlaubt(radarLandFuer(f));
  const persoenlich = !nurBrief && !!f.entscheider?.email && radarAdressePersoenlich(f.entscheider.email, [f.entscheider.name]);
  const zu = ["gesperrt", "kein_interesse", "passt_nicht"].includes(f.status);
  const gespraech = (RADAR_IM_GESPRAECH as readonly string[]).includes(f.status);
  const punkte = [
    { key: "signal", ok: Number(f.signal_staerke ?? 0) >= RADAR_SIGNAL_AB, text: `Kapitalsignal ab Stärke ${RADAR_SIGNAL_AB}${f.signal_staerke != null ? ` (hat ${f.signal_staerke})` : " (noch nicht geprüft)"}` },
    { key: "persoenlich", ok: !persoenlich, text: nurBrief ? "Österreich: hier geht der Brief statt der Mail" : persoenlich ? "Persönliche Adresse des Entscheiders bekannt — die Mail geht vor" : "Keine persönliche Adresse des Entscheiders" },
    { key: "anschrift", ok: !anschrift.fehlt.length, text: anschrift.fehlt.length ? `Anschrift unvollständig: ${anschrift.fehlt.join(", ")}` : "Name und Anschrift aus dem Impressum vollständig" },
    { key: "offen", ok: !zu && !gespraech && !f.versendet_am, text: zu ? "Gesperrt, abgelehnt oder passt nicht" : gespraech ? "Mit der Firma läuft schon ein Gespräch" : f.versendet_am ? "Hat schon eine erste Mail bekommen" : "Noch kein Kontakt, nicht gesperrt" },
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
  qrOhneCode: "Ohne Code: fiaon.com/business",
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
