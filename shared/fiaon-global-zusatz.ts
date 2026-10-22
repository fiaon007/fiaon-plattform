// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ZUSATZDIENSTE PER KLICK (Scheibe 1 „Ihr US-Büro“, 22.10.2026)
//
// Justin (Konzept 05_Vision/GLOBAL_US_BUERO_2026-10-22): Jeder Global-Kunde
// bucht Dienste für sein US-Büro mit einem Klick dazu — Katalog → Fenster →
// „Hinzufügen“ → Rechnung automatisch per E-Mail → nach Zahlung eingerichtet
// und im Portal sichtbar. Das Team setzt den Dienst im Chefbüro (Reiter
// „Leistungen“) auf „aktiv“, sobald er eingerichtet ist.
//
// ── EINE QUELLE ────────────────────────────────────────────────────────────
// Dieser Katalog ist die EINE Stelle für Preis, Abrechnungsart und jeden Satz,
// den der Kunde über einen Zusatzdienst liest (Portal, Fenster, Rechnung,
// Verlauf, Mail-Felder). shared/fiaon-pakete.ts erzeugt daraus die
// Katalogzeilen (global_zusatz_*), damit Bestellzeile, Rechnungsnummer,
// Zahlungsseite und Preis-Wand (fiaon_paketpreise) unverändert mitlaufen —
// ein Preis steht nie zweimal im Quelltext.
//
// ── WORTWAHL (Justin, 22.10.2026) ──────────────────────────────────────────
// Ruhig und selbstverständlich: keine Qualitäts-Etiketten, keine Anbieter-
// namen, keine Marge, kein „Premium“, kein „bis zu“, keine Frist mit Ziffer,
// kein „empfohlen“. Anbieter und Einkauf stehen nur in Kommentaren (`intern`)
// und gehen nie an den Kunden. Jeder Satz passiert die Wortwand
// (scripts/pruef-wortwand-de.ts, scripts/pruef-global-zusatz.ts).
//
// ── WIEDERKEHRENDE DIENSTE ─────────────────────────────────────────────────
// Monatlich und jährlich abgerechnete Dienste werden in DIESER Scheibe nur für
// den ersten Zeitraum berechnet (eine Rechnung beim Hinzufügen; Text „erster
// Monat“ bzw. „erstes Jahr“). Die laufende Abrechnung der Folgezeiträume ist
// eine spätere Scheibe — bis dahin legt die Leitung Folgerechnungen von Hand an.
//
// ── SPÄTER: DIE GESCHÄFTSADRESSE ───────────────────────────────────────────
// Eine Geschäftsadresse mit Büro kommt als weiterer Eintrag dazu, sobald der
// Partner feststeht: Gruppe „adressen“, eigener Schlüssel, `buchbar: false`
// bis zum Start (dann zeigt das Portal ihn nicht). Mehr braucht es nicht —
// Paketzeile, Tabelle, Portal und Chefbüro lesen alles aus dieser Liste.
// ═══════════════════════════════════════════════════════════════════════════

export type ZusatzSprache = "de" | "en";
export type ZusatzAbrechnung = "einmalig" | "monatlich" | "jaehrlich";
export type ZusatzGruppe = "erreichbarkeit" | "adressen" | "auftritt";
export type ZusatzStatus = "gebucht" | "bezahlt" | "aktiv" | "storniert";

export interface ZusatzText {
  /** Name des Dienstes — ruhig, ohne Etikett. */
  titel: string;
  /** Ein Satz unter dem Namen. */
  kurz: string;
  /** Was enthalten ist — drei kurze Zeilen. */
  enthalten: string[];
  /** Was nach dem Zahlungseingang geschieht. */
  einrichtung: string;
  /** Beschreibung der Rechnungszeile (hinter dem Titel). */
  rechnung: string;
}

export interface ZusatzAngabe {
  /** Feldname in der Anfrage und in der Tabelle (`angabe`). */
  art: "domain";
  pflicht: boolean;
  de: { label: string; platzhalter: string; hinweis: string };
  en: { label: string; platzhalter: string; hinweis: string };
}

export interface GlobalZusatz {
  /** Schlüssel in fiaon_global_zusatz.zusatz_key und in der Anfrage. */
  key: string;
  /** Schlüssel der Bestellzeile (fiaon_applications.pack_key) — beginnt mit global_, damit jede Global-Wand greift. */
  packKey: string;
  gruppe: ZusatzGruppe;
  /** Preis in Cent — bei monatlich/jährlich der Preis EINES Zeitraums. */
  preisCents: number;
  abrechnung: ZusatzAbrechnung;
  /** Braucht der Dienst eine Angabe des Kunden (z. B. die Wunschdomain)? */
  angabe: ZusatzAngabe | null;
  /** false = noch nicht buchbar (Portal zeigt ihn nicht, der Server lehnt ab). */
  buchbar: boolean;
  /** Nur für das Team (Chefbüro, Aufgabe) — geht NIE an den Kunden. */
  intern: string;
  de: ZusatzText;
  en: ZusatzText;
}

const DOMAIN_ANGABE: ZusatzAngabe = {
  art: "domain",
  pflicht: true,
  de: { label: "Ihre Wunschdomain", platzhalter: "ihre-gesellschaft.com", hinweis: "Ist sie vergeben, stimmen wir eine Alternative mit Ihnen ab." },
  en: { label: "Your preferred domain", platzhalter: "your-company.com", hinweis: "If it is taken, we agree an alternative with you." },
};

export const GLOBAL_ZUSATZ: GlobalZusatz[] = [
  {
    key: "mobilnummer", packKey: "global_zusatz_mobilnummer", gruppe: "erreichbarkeit",
    preisCents: 14900, abrechnung: "einmalig", angabe: null, buchbar: true,
    intern: "eSIM-Mobilnummer auf den Kunden (Partner US Mobile, Provision je Aktivierung). Einrichtung von Hand; Sicherheitscodes bleiben beim Kunden.",
    de: {
      titel: "Ihre US-Mobilnummer",
      kurz: "Eine eigene US-Mobilnummer für Ihre Gesellschaft, eingerichtet auf Ihren Namen.",
      enthalten: ["Mobilnummer mit US-Vorwahl als eSIM auf Ihrem Telefon", "Einrichtung durch unser Team", "Codes und Nachrichten erreichen nur Sie"],
      einrichtung: "Nach dem Zahlungseingang richten wir Ihre Nummer ein und begleiten Sie durch die Aktivierung.",
      rechnung: "Einrichtung einer US-Mobilnummer (eSIM) auf den Namen des Kunden",
    },
    en: {
      titel: "Your US mobile number",
      kurz: "A US mobile number of your own for your company, set up in your name.",
      enthalten: ["Mobile number with a US area code as an eSIM on your phone", "Set up by our team", "Codes and messages reach only you"],
      einrichtung: "Once your payment has arrived, we set up your number and guide you through the activation.",
      rechnung: "Set-up of a US mobile number (eSIM) in the client’s name",
    },
  },
  {
    key: "telefon_ki", packKey: "global_zusatz_telefon_ki", gruppe: "erreichbarkeit",
    preisCents: 14900, abrechnung: "monatlich", angabe: null, buchbar: true,
    intern: "Eigener Sprachassistent (ARAS/Mara-Stack) auf der US-Nummer des Kunden — Scheibe 7; bis dahin Einrichtung von Hand.",
    de: {
      titel: "Telefonassistenz rund um die Uhr",
      kurz: "Eine digitale Assistenz nimmt die Anrufe Ihrer Gesellschaft an — Tag und Nacht.",
      enthalten: ["Annahme jedes Anrufs, auch nachts und am Wochenende", "Begrüßung im Namen Ihrer Gesellschaft", "Eine Notiz zu jedem Gespräch"],
      einrichtung: "Nach dem Zahlungseingang richten wir die Assistenz auf Ihrer US-Nummer ein und stimmen die Begrüßung mit Ihnen ab.",
      rechnung: "Digitale Annahme der Anrufe auf der US-Nummer, Tag und Nacht",
    },
    en: {
      titel: "Round-the-clock phone assistant",
      kurz: "A digital assistant answers your company’s calls — day and night.",
      enthalten: ["Every call answered, including nights and weekends", "Greeting in your company’s name", "A note on every call"],
      einrichtung: "Once your payment has arrived, we set up the assistant on your US number and agree the greeting with you.",
      rechnung: "Digital call answering on the US number, day and night",
    },
  },
  {
    key: "telefon_persoenlich", packKey: "global_zusatz_telefon_persoenlich", gruppe: "erreichbarkeit",
    preisCents: 39000, abrechnung: "monatlich", angabe: null, buchbar: true,
    intern: "Persönlicher Telefondienst über Partner (Smith.ai, Partnerdeal). Einrichtung von Hand.",
    de: {
      titel: "Persönliche Telefonassistenz",
      kurz: "Ein Assistenzteam nimmt Ihre Anrufe persönlich und in Ihrem Namen an.",
      enthalten: ["Annahme durch geschulte Mitarbeitende zu US-Geschäftszeiten", "Termine und Weiterleitung nach Ihren Vorgaben", "Eine Notiz zu jedem Gespräch"],
      einrichtung: "Nach dem Zahlungseingang stimmen wir Begrüßung und Vorgaben mit Ihnen ab und schalten die Assistenz auf Ihre US-Nummer.",
      rechnung: "Annahme der Anrufe durch ein Assistenzteam im Namen des Kunden",
    },
    en: {
      titel: "Personal phone assistant",
      kurz: "An assistant team answers your calls in person and in your name.",
      enthalten: ["Calls answered by trained staff during US business hours", "Appointments and forwarding as you specify", "A note on every call"],
      einrichtung: "Once your payment has arrived, we agree the greeting and your instructions with you and connect the assistant to your US number.",
      rechnung: "Call answering by an assistant team in the client’s name",
    },
  },
  {
    key: "wohnadresse", packKey: "global_zusatz_wohnadresse", gruppe: "adressen",
    preisCents: 49000, abrechnung: "einmalig", angabe: null, buchbar: true,
    intern: "Private US-Wohnadresse mit Mietvertrag (Partner TruResidence, Premium Blueground); Provision erster Monat. Laufende Miete zahlt der Kunde an den Partner — vorab mit ihm klären.",
    de: {
      titel: "Ihre private US-Adresse",
      kurz: "Eine Wohnadresse in den USA auf Ihren Namen.",
      enthalten: ["Wohnadresse in den USA auf Ihren Namen", "Unterlagen dazu in Ihrem Tresor", "Einrichtung durch unser Team"],
      einrichtung: "Vor der Einrichtung besprechen wir die laufenden Kosten der Adresse mit Ihnen; danach erledigen wir alles Weitere.",
      rechnung: "Einrichtung einer privaten US-Wohnadresse auf den Namen des Kunden",
    },
    en: {
      titel: "Your private US address",
      kurz: "A residential address in the United States in your name.",
      enthalten: ["Residential address in the United States in your name", "The related documents in your vault", "Set up by our team"],
      einrichtung: "Before the set-up we go through the running costs of the address with you; after that we take care of everything else.",
      rechnung: "Set-up of a private US residential address in the client’s name",
    },
  },
  {
    key: "domain", packKey: "global_zusatz_domain", gruppe: "auftritt",
    preisCents: 4900, abrechnung: "jaehrlich", angabe: DOMAIN_ANGABE, buchbar: true,
    intern: "Domain über Cloudflare (Domain-Prüfung live folgt in Scheibe 5), Postfächer über Google Workspace (Provision je Nutzer; Lizenzen laufen über das Konto des Kunden).",
    de: {
      titel: "Ihre Domain & E-Mail",
      kurz: "Ihre Wunschdomain für die Gesellschaft, verbunden mit Ihren E-Mail-Postfächern.",
      enthalten: ["Registrierung Ihrer Wunschdomain", "Verbindung mit Ihren E-Mail-Postfächern", "Verlängerung Jahr für Jahr"],
      einrichtung: "Nach dem Zahlungseingang sichern wir Ihre Wunschdomain und richten die Verbindung zu Ihren Postfächern ein.",
      rechnung: "Registrierung und Verwaltung einer Domain mit E-Mail-Anbindung",
    },
    en: {
      titel: "Your domain & email",
      kurz: "Your preferred domain for the company, connected to your email inboxes.",
      enthalten: ["Registration of your preferred domain", "Connection to your email inboxes", "Renewed year after year"],
      einrichtung: "Once your payment has arrived, we secure your preferred domain and connect it to your inboxes.",
      rechnung: "Registration and management of a domain with email connection",
    },
  },
  {
    key: "website", packKey: "global_zusatz_website", gruppe: "auftritt",
    preisCents: 190000, abrechnung: "einmalig", angabe: null, buchbar: true,
    intern: "Website aus dem eigenen Studio (Framer, Framer-Partnerprovision). Einrichtung = Auftaktgespräch, Entwurf, Veröffentlichung.",
    de: {
      titel: "Ihre Website",
      kurz: "Ein eigener Internetauftritt für Ihre Gesellschaft, gestaltet von unserem Studio.",
      enthalten: ["Gestaltung und Umsetzung durch unser Studio", "Abgestimmt auf Ihre Gesellschaft und Ihre Kunden", "Veröffentlichung auf Ihrer Domain"],
      einrichtung: "Nach dem Zahlungseingang beginnen wir mit einem Auftaktgespräch zu Inhalt und Gestaltung.",
      rechnung: "Gestaltung und Umsetzung der Website der Gesellschaft",
    },
    en: {
      titel: "Your website",
      kurz: "A website of your own for your company, designed by our studio.",
      enthalten: ["Design and build by our studio", "Tailored to your company and your clients", "Published on your domain"],
      einrichtung: "Once your payment has arrived, we begin with a kick-off call on content and design.",
      rechnung: "Design and build of a website for the company",
    },
  },
  {
    key: "website_pflege", packKey: "global_zusatz_website_pflege", gruppe: "auftritt",
    preisCents: 4900, abrechnung: "monatlich", angabe: null, buchbar: true,
    intern: "Laufende Pflege der Website (Studio). Ohne eigene Website von uns: vorher klären, ob die Seite des Kunden übernommen werden kann.",
    de: {
      titel: "Website-Betreuung",
      kurz: "Laufende Pflege Ihrer Website — Änderungen, Aktualisierungen, Betrieb.",
      enthalten: ["Inhaltliche Änderungen auf Zuruf", "Technische Aktualisierungen und Sicherungen", "Betrieb auf Ihrer Domain"],
      einrichtung: "Nach dem Zahlungseingang übernehmen wir die Betreuung Ihrer Website.",
      rechnung: "Laufende Pflege, Aktualisierung und Betrieb der Website",
    },
    en: {
      titel: "Website care",
      kurz: "Ongoing care of your website — changes, updates, operation.",
      enthalten: ["Content changes on request", "Technical updates and backups", "Operation on your domain"],
      einrichtung: "Once your payment has arrived, we take over the care of your website.",
      rechnung: "Ongoing maintenance, updates and operation of the website",
    },
  },
];

export const GLOBAL_ZUSATZ_GRUPPEN: { gruppe: ZusatzGruppe; de: string; en: string }[] = [
  { gruppe: "erreichbarkeit", de: "Erreichbarkeit", en: "Reachability" },
  { gruppe: "adressen", de: "Adressen", en: "Addresses" },
  { gruppe: "auftritt", de: "Auftritt", en: "Presence" },
];

const NACH_KEY = new Map(GLOBAL_ZUSATZ.map((z) => [z.key, z]));
const NACH_PAKET = new Map(GLOBAL_ZUSATZ.map((z) => [z.packKey, z]));

/** Der Dienst zu einem Schlüssel (Anfrage, Tabelle) — null, wenn es ihn nicht gibt. */
export function globalZusatz(key: unknown): GlobalZusatz | null {
  return NACH_KEY.get(String(key ?? "").trim().toLowerCase()) ?? null;
}
/** Der Dienst zu einer Bestellzeile (pack_key) — null, wenn die Zeile kein Zusatzdienst ist. */
export function globalZusatzZuPaket(packKey: unknown): GlobalZusatz | null {
  return NACH_PAKET.get(String(packKey ?? "").trim().toLowerCase()) ?? null;
}
/** Ist diese Bestellzeile ein Zusatzdienst? */
export function istGlobalZusatzPaket(packKey: unknown): boolean {
  return NACH_PAKET.has(String(packKey ?? "").trim().toLowerCase());
}
/** Was das Portal anbietet — nur buchbare Dienste. */
export function buchbareZusatzdienste(): GlobalZusatz[] {
  return GLOBAL_ZUSATZ.filter((z) => z.buchbar);
}

// ── FREIGABE JE DIENST (Justin, 22.10.2026: „sicher starten“) ────────────────
// Ein Dienst erscheint beim Kunden erst, wenn die Leitung ihn im Chefbüro freigibt (Global-Raum, Leiste oben).
// Gespeichert in fiaon_settings unter GLOBAL_ZUSATZ_FREIGABE_SCHLUESSEL als JSON-Liste der Schlüssel. Fehlt der
// Eintrag (oder ist er kaputt), gilt die Vorgabe: NUR „Ihre Domain & E-Mail“. Nicht Freigegebenes sieht der Kunde
// nicht, und der Server lehnt es ab (409 „noch nicht verfügbar“); die Vorschau der Leitung zeigt alles mit Marke.
export const GLOBAL_ZUSATZ_FREIGABE_SCHLUESSEL = "global_zusatz_freigabe";
export const GLOBAL_ZUSATZ_FREIGABE_VORGABE: readonly string[] = ["domain"];
/** Liest den gespeicherten Wert (Text aus fiaon_settings) — unbekannte Schlüssel fallen weg, Unlesbares → Vorgabe. */
export function zusatzFreigabeAus(wert: unknown): string[] {
  if (wert == null || String(wert).trim() === "") return [...GLOBAL_ZUSATZ_FREIGABE_VORGABE];
  let liste: unknown;
  try { liste = typeof wert === "string" ? JSON.parse(wert) : wert; } catch { return [...GLOBAL_ZUSATZ_FREIGABE_VORGABE]; }
  if (!Array.isArray(liste)) return [...GLOBAL_ZUSATZ_FREIGABE_VORGABE];
  const bekannt = new Set(GLOBAL_ZUSATZ.map((z) => z.key));
  return Array.from(new Set(liste.map((x) => String(x ?? "").trim().toLowerCase()).filter((k) => bekannt.has(k))));
}
/** Ist der Dienst für Kunden freigegeben? */
export function zusatzFreigegeben(key: unknown, freigabe: readonly string[]): boolean {
  const z = globalZusatz(key);
  return !!z && z.buchbar && freigabe.includes(z.key);
}

// ── WAS DER AUFTRAG SCHON ENTHÄLT (Justin, 22.10.2026) ───────────────────────
// Nie anbieten oder berechnen, was zum Paket oder zum individuellen Angebot des Kunden schon gehört.
// Gelesen aus den Leistungstexten (Stand 22.10.2026):
//   · Pakete global_struktur … global_vip (shared/fiaon-global.ts, GLOBAL_INKLUSIVE) und Individual-, Kapital-,
//     Begleit-Angebot: „Registered Agent, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr“ — das ist die
//     Standardnummer und die Adresse der Gesellschaft, KEIN Zusatzdienst dieses Katalogs (Mobilnummer auf den Kunden,
//     Assistenz, private Wohnadresse, Domain, Website sind dort nicht enthalten).
//   · Firmenangebot IA-FIRMA (shared/fiaon-global-angebot-firma.ts): „Telefonannahme unter Ihrer US-Nummer während der
//     Geschäftszeiten“ (Büro in Miami mit Telefonassistenz), „Website und SEO“, Technikkosten „Server, Hosting, CDN,
//     Domains und E-Mail“ → persönliche Telefonassistenz, Domain & E-Mail, Website und Website-Betreuung sind enthalten.
//     Die Assistenz rund um die Uhr (nachts, am Wochenende) geht darüber hinaus und bleibt buchbar.
// Ändert sich ein Leistungsumfang, ändert sich diese Tabelle — der Prüfstand pruef-global-zusatz.ts hält sie fest.
export const ZUSATZ_IM_AUFTRAG: { art: "paket" | "angebot"; muster: RegExp; keys: string[]; grund: string }[] = [
  { art: "angebot", muster: /^IA-FIRMA-/, keys: ["telefon_persoenlich", "domain", "website", "website_pflege"], grund: "Firmenangebot: Telefonannahme, Website, Domains und E-Mail sind Teil der Vereinbarung" },
];
export interface ZusatzAuftrag {
  /** paket_key der Akte (global_struktur …, global_individuell). */
  paketKey?: string | null;
  /** Fassung des verbundenen Angebots (fiaon_global_angebote.fassung, z. B. „IA-FIRMA-…“), sonst null. */
  angebotFassung?: string | null;
}
/**
 * Darf dieser Kunde den Dienst buchen? `enthalten` = schon Teil seines Pakets/Angebots (Portal: „Im Auftrag enthalten“,
 * Server: keine Rechnung). `nicht_buchbar` = Dienst gibt es (noch) nicht. Rein — Portal, Server und Prüfstand fragen hier.
 */
export function globalZusatzVerfuegbar(auftrag: ZusatzAuftrag | null | undefined, key: unknown): { verfuegbar: boolean; grund: "enthalten" | "nicht_buchbar" | null } {
  const z = globalZusatz(key);
  if (!z || !z.buchbar) return { verfuegbar: false, grund: "nicht_buchbar" };
  const paketKey = String(auftrag?.paketKey ?? "").trim().toLowerCase();
  const fassung = String(auftrag?.angebotFassung ?? "").trim().toUpperCase();
  for (const r of ZUSATZ_IM_AUFTRAG) {
    const wert = r.art === "paket" ? paketKey : fassung;
    if (wert && r.muster.test(wert) && r.keys.includes(z.key)) return { verfuegbar: false, grund: "enthalten" };
  }
  return { verfuegbar: true, grund: null };
}

// ── PREIS ALS TEXT ───────────────────────────────────────────────────────────
function euro(cents: number, s: ZusatzSprache): string {
  const ganz = cents % 100 === 0;
  const opt = { minimumFractionDigits: ganz ? 0 : 2, maximumFractionDigits: 2 };
  return s === "en" ? `€${(cents / 100).toLocaleString("en-GB", opt)}` : `${(cents / 100).toLocaleString("de-DE", opt)} €`;
}
const ABRECHNUNG_TEXT: Record<ZusatzAbrechnung, Record<ZusatzSprache, string>> = {
  einmalig: { de: "einmalig", en: "one-off" },
  monatlich: { de: "im Monat", en: "per month" },
  jaehrlich: { de: "im Jahr", en: "per year" },
};
/** „149 € einmalig“, „149 € im Monat“, „€49 per year“. */
export function zusatzPreisText(z: Pick<GlobalZusatz, "preisCents" | "abrechnung">, s: ZusatzSprache = "de"): string {
  return `${euro(z.preisCents, s)} ${ABRECHNUNG_TEXT[z.abrechnung][s]}`;
}
/** Der Zeitraum der ersten Rechnung — auf der Rechnung und im Fenster. */
export function zusatzZeitraumText(abrechnung: ZusatzAbrechnung, s: ZusatzSprache = "de"): string {
  return { einmalig: { de: "einmalig", en: "one-off" }, monatlich: { de: "erster Monat", en: "first month" }, jaehrlich: { de: "erstes Jahr", en: "first year" } }[abrechnung][s];
}
/** Beschreibung und Zeitraum der Rechnungszeile — gelesen von server/fiaon-invoice.ts (rechnungsSpracheSetzen). */
export function zusatzRechnungsZeile(packKey: unknown, s: ZusatzSprache = "de", angabe?: string | null): { beschreibung: string; zeitraum: string } | null {
  const z = globalZusatzZuPaket(packKey);
  if (!z) return null;
  const t = z[s];
  const zusatz = angabe ? ` (${angabe})` : "";
  return { beschreibung: `${t.titel} — ${t.rechnung}${zusatz}`, zeitraum: zusatzZeitraumText(z.abrechnung, s) };
}

// ── DIE ANGABE DES KUNDEN ────────────────────────────────────────────────────
/** Prüft die Angabe (z. B. Wunschdomain). Rein — Server und Fenster benutzen dieselbe Prüfung. */
export function zusatzAngabePruefen(z: GlobalZusatz, roh: unknown, s: ZusatzSprache = "de"): { ok: true; wert: string | null } | { ok: false; error: string } {
  const text = String(roh ?? "").trim().toLowerCase();
  if (!z.angabe) return { ok: true, wert: null };
  if (!text) return z.angabe.pflicht ? { ok: false, error: ZUSATZ_WOERTER[s].angabeFehlt(z.angabe[s].label) } : { ok: true, wert: null };
  if (z.angabe.art === "domain") {
    const ohne = text.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    if (ohne.length > 120 || !/^(?=.{4,120}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(ohne)) return { ok: false, error: ZUSATZ_WOERTER[s].angabeDomain };
    return { ok: true, wert: ohne };
  }
  return { ok: true, wert: text.slice(0, 200) };
}

// ── IDEMPOTENZ UND STATUS — REIN, VOM PRÜFSTAND GEPRÜFT ──────────────────────
export interface ZusatzVorhanden { status: ZusatzStatus; bestellRef: string | null; rechnungSteht: boolean }
/**
 * Was ein Klick auf „Hinzufügen“ tut: `neu` = Buchung anlegen; `weiter` = eine Buchung ist da, aber ihre Rechnung steht
 * noch nicht (ein Schritt hing) — dort weitermachen; `schon` = Buchung mit Rechnung steht, NICHTS Neues anlegen.
 * Eine stornierte Buchung zählt nicht (der Server sucht nur nicht stornierte; Tabelle: höchstens eine je Mandat und Dienst).
 */
export function zusatzKlickEntscheidung(v: ZusatzVorhanden | null): "neu" | "weiter" | "schon" {
  if (!v || v.status === "storniert") return "neu";
  if (v.status !== "gebucht") return "schon";
  return v.bestellRef && v.rechnungSteht ? "schon" : "weiter";
}
/** Welche Statuswechsel das Chefbüro setzen darf. „bezahlt“ setzt sonst die Zahlung selbst. */
export const ZUSATZ_WECHSEL: Record<ZusatzStatus, ZusatzStatus[]> = {
  gebucht: ["bezahlt", "aktiv", "storniert"],
  bezahlt: ["aktiv", "storniert"],
  aktiv: ["storniert"],
  storniert: [],
};
export function zusatzWechselErlaubt(von: unknown, nach: unknown): boolean {
  const v = String(von) as ZusatzStatus;
  return (ZUSATZ_WECHSEL[v] ?? []).includes(String(nach) as ZusatzStatus);
}
export const ZUSATZ_STATUS: ZusatzStatus[] = ["gebucht", "bezahlt", "aktiv", "storniert"];

// ── WÖRTER FÜR DEN KUNDEN (Portal, Antworten des Servers, Verlauf) ───────────
export const ZUSATZ_WOERTER = {
  de: {
    nav: "Dienste",
    titel: "Ihr Büro erweitern",
    lead: "Weitere Dienste für Ihre Gesellschaft. Ein Klick genügt — den Rest übernehmen wir.",
    gebuchtTitel: "Ihre Dienste",
    status: { gebucht: "Gebucht – Rechnung unterwegs", bezahlt: "Bezahlt – wird eingerichtet", aktiv: "Aktiv", storniert: "Storniert" } as Record<ZusatzStatus, string>,
    statusKurz: { gebucht: "Rechnung unterwegs", bezahlt: "Wird eingerichtet", aktiv: "Aktiv", storniert: "Storniert" } as Record<ZusatzStatus, string>,
    mehr: "Ansehen",
    enthaltenMarke: "Im Auftrag enthalten",
    enthaltenText: "Dieser Dienst ist bereits Teil Ihres Auftrags — Sie müssen nichts hinzufügen.",
    schonEnthalten: "Dieser Dienst ist bereits Teil Ihres Auftrags. Es entsteht keine Rechnung.",
    enthalten: "Enthalten",
    danach: "Nach der Zahlung",
    rechnungHinweis: "Die Rechnung kommt per E-Mail; freigeschaltet nach Zahlungseingang.",
    ersterZeitraum: (zeitraum: string) => `Die Rechnung umfasst den Zeitraum: ${zeitraum}.`,
    hinzufuegen: "Hinzufügen",
    laeuft: "Wird hinzugefügt …",
    fertigTitel: "Hinzugefügt",
    fertigText: "Die Rechnung ist unterwegs zu Ihnen. Den Stand sehen Sie hier jederzeit.",
    schonText: "Diesen Dienst haben Sie bereits hinzugefügt — den Stand sehen Sie hier.",
    schliessen: "Schließen",
    zurZahlung: "Zur Zahlung",
    rechnung: "Rechnung",
    gebuchtAm: (d: string) => `Hinzugefügt am ${d}`,
    aktivSeit: (d: string) => `Aktiv seit ${d}`,
    tunTitel: (titel: string) => `Rechnung offen: ${titel}`,
    tunText: "Mit dem Zahlungseingang richten wir den Dienst ein.",
    vorschau: "Vorschau — hinzufügen kann hier nur der Kunde.",
    nichtFreigegeben: "nicht freigegeben",
    nochNichtVerfuegbar: "Dieser Dienst ist noch nicht verfügbar.",
    angabeFehlt: (label: string) => `Bitte geben Sie „${label}“ an.`,
    angabeDomain: "Bitte geben Sie die Domain in der Form „name.com“ an.",
    // Antworten des Servers
    unbekannt: "Diesen Dienst gibt es nicht.",
    storniert: "Ihr Auftrag ist storniert — Dienste lassen sich nicht mehr hinzufügen.",
    test: "Bei einem Test-Auftrag entsteht keine Rechnung — bitte im Chefbüro an einem echten Auftrag hinzufügen.",
    roboter: "Diese Buchung können wir nicht entgegennehmen. Bitte öffnen Sie Ihr Portal im Browser und fügen Sie den Dienst dort hinzu.",
    zuViel: "Das waren gerade viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten noch einmal.",
    technisch: "Der Dienst ließ sich gerade nicht hinzufügen. Bitte versuchen Sie es gleich noch einmal — ein weiterer Klick macht dort weiter.",
    // Verlauf (sichtbar für den Kunden)
    verlaufGebucht: (titel: string, preis: string, nr: string) => `Dienst hinzugefügt: ${titel} (${preis}). Rechnung ${nr} erstellt.`,
    verlaufBezahlt: (titel: string) => `Zahlung eingegangen: ${titel}. Wir richten den Dienst jetzt ein.`,
    verlaufAktiv: (titel: string) => `${titel} ist eingerichtet und aktiv.`,
    verlaufStorniert: (titel: string) => `${titel} wurde storniert.`,
  },
  en: {
    nav: "Services",
    titel: "Extend your office",
    lead: "Further services for your company. One click is enough — we take care of the rest.",
    gebuchtTitel: "Your services",
    status: { gebucht: "Added – invoice on its way", bezahlt: "Paid – being set up", aktiv: "Active", storniert: "Cancelled" } as Record<ZusatzStatus, string>,
    statusKurz: { gebucht: "Invoice on its way", bezahlt: "Being set up", aktiv: "Active", storniert: "Cancelled" } as Record<ZusatzStatus, string>,
    mehr: "View",
    enthaltenMarke: "Included in your order",
    enthaltenText: "This service is already part of your order — there is nothing to add.",
    schonEnthalten: "This service is already part of your order. No invoice is created.",
    enthalten: "Included",
    danach: "After payment",
    rechnungHinweis: "The invoice arrives by email; activated once payment is received.",
    ersterZeitraum: (zeitraum: string) => `The invoice covers: ${zeitraum}.`,
    hinzufuegen: "Add",
    laeuft: "Adding …",
    fertigTitel: "Added",
    fertigText: "The invoice is on its way to you. You can follow the status here at any time.",
    schonText: "You have already added this service — you can follow the status here.",
    schliessen: "Close",
    zurZahlung: "Go to payment",
    rechnung: "Invoice",
    gebuchtAm: (d: string) => `Added on ${d}`,
    aktivSeit: (d: string) => `Active since ${d}`,
    tunTitel: (titel: string) => `Invoice open: ${titel}`,
    tunText: "We set up the service once your payment has arrived.",
    vorschau: "Preview — only the client can add services here.",
    nichtFreigegeben: "not released",
    nochNichtVerfuegbar: "This service is not available yet.",
    angabeFehlt: (label: string) => `Please enter “${label}”.`,
    angabeDomain: "Please enter the domain in the form “name.com”.",
    unbekannt: "This service does not exist.",
    storniert: "Your order has been cancelled — services can no longer be added.",
    test: "A test order does not produce an invoice — please add the service to a real order in the back office.",
    roboter: "We cannot accept this booking. Please open your portal in your browser and add the service there.",
    zuViel: "There were many requests in a short time. Please try again in a few minutes.",
    technisch: "The service could not be added just now. Please try again shortly — another click continues where it stopped.",
    verlaufGebucht: (titel: string, preis: string, nr: string) => `Service added: ${titel} (${preis}). Invoice ${nr} created.`,
    verlaufBezahlt: (titel: string) => `Payment received: ${titel}. We are now setting up the service.`,
    verlaufAktiv: (titel: string) => `${titel} is set up and active.`,
    verlaufStorniert: (titel: string) => `${titel} has been cancelled.`,
  },
};
