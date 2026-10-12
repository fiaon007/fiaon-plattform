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
  | "neu" | "gescannt" | "mail" | "im_postfach" | "versendet" | "antwort"
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
export const RADAR_GRUPPEN: { key: string; label: string; stati: RadarStatus[]; ohneMail?: boolean }[] = [
  { key: "offen", label: "Offen", stati: ["neu", "gescannt"] },
  { key: "bereit", label: "Mail bereit", stati: ["mail", "im_postfach"] },
  { key: "raus", label: "Unterwegs", stati: ["versendet"] },
  { key: "gespraech", label: "Im Gespräch", stati: ["antwort", "lead", "termin", "angebot", "kauf"] },
  // Dieser Reiter zählt nach fehlender Adresse, nicht nach Stand — sonst übersieht man frisch gefundene Firmen ohne E-Mail.
  { key: "ohne", label: "Ohne E-Mail", stati: ["ohne_kontakt"], ohneMail: true },
  { key: "aus", label: "Aussortiert", stati: ["unzustellbar", "passt_nicht", "kein_interesse", "gesperrt"] },
];
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

/** Was eine eingehende Mail in einem Radar-Faden ist. */
export type RadarAntwortArt =
  | "interesse" | "frage" | "termin_wunsch" | "kein_interesse" | "abwesend" | "weitergeleitet"
  | "falscher_empfaenger" | "unzustellbar" | "automatisch" | "sonstiges";

export const RADAR_ANTWORT_ARTEN: Record<RadarAntwortArt, { label: string; lead: boolean; stopptNachfass: boolean }> = {
  interesse: { label: "Interesse", lead: true, stopptNachfass: true },
  frage: { label: "Sachfrage", lead: true, stopptNachfass: true },
  termin_wunsch: { label: "Will einen Termin", lead: true, stopptNachfass: true },
  kein_interesse: { label: "Kein Interesse", lead: false, stopptNachfass: true },
  abwesend: { label: "Abwesend", lead: false, stopptNachfass: false },
  weitergeleitet: { label: "Weitergeleitet", lead: false, stopptNachfass: false },
  falscher_empfaenger: { label: "Falscher Empfänger", lead: false, stopptNachfass: true },
  unzustellbar: { label: "Unzustellbar", lead: false, stopptNachfass: true },
  automatisch: { label: "Automatische Antwort", lead: false, stopptNachfass: false },
  sonstiges: { label: "Sonstiges", lead: false, stopptNachfass: true },
};
export const RADAR_ANTWORT_SCHLUESSEL = Object.keys(RADAR_ANTWORT_ARTEN) as RadarAntwortArt[];

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

/** Werktags 8:30–17:30 Uhr (Berlin) — dann lesen Geschäftsführer Mails, und nur dann schreibt der Radar selbst. Rein. */
export function radarSendefenster(jetzt: Date = new Date()): boolean {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  const wert = (t: string) => teile.find((x) => x.type === t)?.value ?? "";
  const tag = wert("weekday");
  const minuten = Number(wert("hour")) * 60 + Number(wert("minute"));
  if (tag === "Sat" || tag === "Sun") return false;
  return minuten >= 8 * 60 + 30 && minuten < 17 * 60 + 30;
}

// ── DER TRICHTER ────────────────────────────────────────────────────────────
/** Die Stufen vom Fund bis zum Kauf — in dieser Reihenfolge zeigt sie das Chefbüro. */
export const RADAR_TRICHTER: { key: string; label: string; satz: string }[] = [
  { key: "gefunden", label: "Gefunden", satz: "Firmen mit geprüfter Website und E-Mail" },
  { key: "angeschrieben", label: "Angeschrieben", satz: "erste persönliche Mail raus" },
  { key: "zugestellt", label: "Zugestellt", satz: "ohne Rückläufer" },
  { key: "antworten", label: "Antworten", satz: "von Menschen, ohne Automaten" },
  { key: "leads", label: "Leads", satz: "Interesse, Sachfrage oder Terminwunsch" },
  { key: "termine", label: "Termine", satz: "Gespräch gebucht" },
  { key: "angebote", label: "Angebote", satz: "Auftrag oder Angebot offen" },
  { key: "kaeufe", label: "Käufe", satz: "Auftrag bezahlt" },
];

// ── DER KERNSATZ DER AKQUISE-MAIL (Justin, 12.10.2026) ──────────────────────
// Justin: „Wir helfen Unternehmern dabei, eine LLC (gleichzusetzen mit einer GmbH) in den USA zu gründen, eröffnen für
// unsere Kunden Geschäftskonten, Kreditkarten und ermöglichen Zugang zu Funding (US-Geld ist billiger als europäische
// Kredite in den meisten Fällen!) — baue das sinnvoll und stilvoll ein!“
// So steht es jetzt da, und es hält: Das Konto eröffnet die Bank — wir „kümmern uns darum“. Der Preisvorteil hängt am
// Einführungszeitraum ohne Sollzins (das Hauswort statt „0 %“, E-188) — in dieser Zeit ist das Kapital günstiger als
// jeder verzinste Kredit. Kein Betrag, kein Rahmen, kein Institut-Satz (Justin, 12.10.).
export const RADAR_KERNSATZ = {
  was: "Wir gründen für Unternehmer eine eigene LLC in den USA – das US-Gegenstück zur GmbH –, kümmern uns um Geschäftskonto und Firmenkreditkarten und ebnen den Weg zu US-Funding.",
  vorteil: "Viele US-Firmenkarten starten mit einem Einführungszeitraum ohne Sollzins, und das Kapital lässt sich auch in Europa einsetzen.",
  vorOrt: "Alles Amerikanische erledigt unser Team vor Ort.",
} as const;
