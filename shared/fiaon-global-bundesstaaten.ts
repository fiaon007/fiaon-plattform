// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE BUNDESSTAATEN ZUR WAHL (E-465, 29.10.2026)
//
// Die EINE Quelle für die Staaten-Wahl: welche Staaten wir anbieten, wie lange die
// Eintragung heute ehrlich dauert, ob es einen Express gibt, was jährlich an den
// Staat geht, Vor- und Nachteile, für wen der Staat passt und unsere Einordnung.
// Website (Wissensseite „Welcher US-Bundesstaat passt?“, Staatsseiten, Kosten, FAQ),
// Angebote/Verträge für neue Kunden, Mara-Wissen und der Arbeitsablauf im Chefbüro
// lesen von hier.
//
// ── ANLASS ────────────────────────────────────────────────────────────────
// Florida (bisher unser einziger Staat, Team in Miami) bearbeitet Gründungen seit
// Oktober 2026 deutlich langsamer. Unser Gründungspartner hat am 29.10.2026 schriftlich
// die heutigen Zeiten genannt; sie stehen unten als Erfahrungswerte mit Stand-Datum.
// Zeiten sind NIE eine Zusage — über die Eintragung entscheidet der Bundesstaat,
// über die EIN die US-Steuerbehörde.
//
// ── BETRÄGE ───────────────────────────────────────────────────────────────
// Gründungsgebühr und Jahreskosten kommen aus shared/fiaon-global-seiten/fakten.ts
// (STAAT / STAAT_EN, dort mit Quellen). Am 29.10.2026 gegengeprüft:
//   · Delaware: Annual Tax der LLC 400 $, fällig 1. Juni, bei Verzug 200 $ + 1,5 %/Monat
//     — https://corp.delaware.gov/alt-entitytaxinstructions/ (amtlich, abgerufen 29.10.2026)
//   · Wyoming: Annual Report License Tax 60 $ oder 0,0002 × Vermögen in Wyoming (der höhere
//     Wert); Gründung 100 $; amtlicher Eilservice 700 $ (nächster Werktag) / 1.400 $ (selber
//     Werktag) — https://sos.wyo.gov/Business/Docs/BusinessFees.pdf (Fassung gültig ab 01.07.2026)
//   · Florida: Gründung 125 $, Annual Report 138,75 $ (1. Januar bis 1. Mai) — Florida
//     Statutes 2026 §§ 605.0212, 605.0213 (Quellen in fakten.ts)
//   · Nevada (nur zur Einordnung, wird nicht angeboten): Articles 75 $ + Initial List 150 $ +
//     State Business License 200 $; jährlich Annual List 150 $ + Business License 200 $ —
//     nvsos.gov lieferte am 29.10.2026 keine lesbare Gebührenseite; die Werte stimmen in
//     mehreren Gründungsratgebern überein, sind aber NICHT amtlich gegengeprüft. Deshalb
//     zeigt keine öffentliche Seite Nevada-Beträge.
// Die amtlichen Eilgebühren von Delaware (24 Stunden, selber Tag …) wurden zum
// 01.08.2026 neu gefasst; die Gebührenseite war am 29.10.2026 nicht abrufbar → keine Zahl
// auf der Website, nur „gegen amtliche Eilgebühr“.
//
// ── WORTREGELN ────────────────────────────────────────────────────────────
// Zahlen bei Zeiten als Wort („zehn Werktage“), nie „binnen 10 Tagen“, nie „bis zu“,
// nie „garantiert“, nie „empfohlen/recommend“ (unsere Einordnung heißt „einordnung“),
// kein Partnername (Registered Agent), keine Bank als Zusage. Kundentexte gesiezt.
// ═══════════════════════════════════════════════════════════════════════════
import { STAAT, FAKTEN_STAND } from "./fiaon-global-seiten/fakten";
import { STAAT_EN } from "./fiaon-global-seiten/fakten-en";

export type StaatSchluessel = "delaware" | "florida" | "wyoming" | "nevada";
export type Sprache = "de" | "en";

/** Stand der Zeiten (Erfahrungswerte, schriftlich vom Gründungspartner am 29.10.2026). */
export const STAATEN_STAND = "2026-10-29";
export const STAATEN_STAND_TEXT: Record<Sprache, string> = { de: "Oktober 2026", en: "October 2026" };
/** Stand der Beträge (fakten.ts). */
export const STAATEN_BETRAEGE_STAND = FAKTEN_STAND;

/** Die Staaten, die wir für neue Gründungen anbieten — in dieser Reihenfolge. */
export const STAATEN_ANGEBOTEN = ["delaware", "florida", "wyoming"] as const;
export type AngebotenerStaat = (typeof STAATEN_ANGEBOTEN)[number];
/** Vorgabe für neue Angebote und Aufträge (E-465): Delaware — schnellster planbarer Weg. */
export const STAAT_VORGABE_NEU: AngebotenerStaat = "delaware";

interface Zweisprachig { de: string; en: string }
interface ListeZweisprachig { de: string[]; en: string[] }

export interface BundesstaatInfo {
  schluessel: StaatSchluessel;
  /** Zwei Buchstaben wie im Register der Global-Akte („DE“). */
  kurz: string;
  name: string;
  angeboten: boolean;
  /** Eintragung beim Staat — ganzer Satz, ehrlich, mit „derzeit“/„rund“ (Erfahrungswert). */
  eintragung: Zweisprachig;
  /** Für Tabellen: kurz. */
  eintragungKurz: Zweisprachig;
  /** Werktage (Erfahrungswert, intern für Planung/Prüfung) — Standardweg ohne Express. */
  werktage: { von: number; bis: number };
  express: { moeglich: boolean; werktage: { von: number; bis: number } | null; text: Zweisprachig; kurz: Zweisprachig };
  /** Wann die Gesellschaft im Fahrplan eines Angebots steht („Woche eins bis zwei“). */
  fahrplan: Zweisprachig;
  /** Was jährlich an den Staat geht (Betrag aus fakten.ts) und wie es heißt. */
  jahr: { betrag: Zweisprachig; name: Zweisprachig; frist: Zweisprachig };
  gruendung: Zweisprachig;
  /** Wie die jährliche Pflicht im Vertrag heißt (für „die erste … einschließlich der Staatsgebühr“). */
  jahrVertrag: string;
  vorteile: ListeZweisprachig;
  nachteile: ListeZweisprachig;
  passtFuer: Zweisprachig;
  /** Unsere Einordnung in einem Satz (kein „empfohlen“). */
  einordnung: Zweisprachig;
  /** Amtliches Register (intern: Arbeitsablauf). */
  register: { name: string; sucheUrl: string; /** Suche mit Namen in der Adresse ({name} wird url-codiert ersetzt) — nur wo das Register das kann. */ sucheMitName: string | null; jahresUrl: string };
}

export const BUNDESSTAATEN: Record<StaatSchluessel, BundesstaatInfo> = {
  delaware: {
    schluessel: "delaware", kurz: "DE", name: "Delaware", angeboten: true,
    eintragung: {
      de: "Im Standardweg derzeit rund zehn Werktage. Mit dem Express des Staats in der Regel ein bis zwei Werktage — sehr verlässlich.",
      en: "Around ten business days on the standard route at present. With the state’s express service, usually one or two business days — very reliable.",
    },
    eintragungKurz: { de: "rund zehn Werktage, mit Express ein bis zwei", en: "around ten business days, one or two with express" },
    werktage: { von: 8, bis: 12 },
    express: {
      moeglich: true, werktage: { von: 1, bis: 2 },
      text: { de: "Ja — gegen eine amtliche Eilgebühr, in der Regel ein bis zwei Werktage.", en: "Yes — for an official expedite fee, usually one or two business days." },
      kurz: { de: "ja, ein bis zwei Werktage", en: "yes, one or two business days" },
    },
    fahrplan: { de: "Woche eins bis zwei", en: "weeks one to two" },
    jahr: {
      betrag: { de: STAAT.delaware.jahr, en: STAAT_EN.delaware.jahr },
      name: { de: "Jahressteuer (Annual Tax)", en: "annual tax" },
      frist: { de: "1. Juni", en: "1 June" },
    },
    gruendung: { de: STAAT.delaware.gruendung, en: STAAT_EN.delaware.gruendung },
    jahrVertrag: "die erste Jahressteuer der Gesellschaft beim Bundesstaat (Annual Tax)",
    vorteile: {
      de: [
        "Schnellster planbarer Weg: Mit Express steht die Gesellschaft in der Regel nach ein bis zwei Werktagen.",
        "Das bekannteste Gesellschaftsrecht der USA, mit eigenem Gericht für Gesellschaftsfragen.",
        "Banken, Investoren und Geldgeber kennen Delaware — es erklärt sich von selbst.",
      ],
      en: [
        "The fastest route you can plan on: with express, the company usually stands after one or two business days.",
        "The best-known company law in the US, with its own court for corporate matters.",
        "Banks, investors and lenders know Delaware — it needs no explanation.",
      ],
    },
    nachteile: {
      de: [
        `Höhere Jahressteuer: ${STAAT.delaware.jahr} im Jahr, fällig am 1. Juni.`,
        "Kein Team vor Ort — für Termine in Florida ist Miami näher.",
      ],
      en: [
        `Higher annual tax: ${STAAT_EN.delaware.jahr} a year, due on 1 June.`,
        "No team on the ground — for appointments in Florida, Miami is closer.",
      ],
    },
    passtFuer: {
      de: "Alle, die schnell und planbar starten wollen, und alle mit Investoren oder Finanzierung im Blick.",
      en: "Anyone who wants a fast, predictable start, and anyone with investors or financing in mind.",
    },
    einordnung: {
      de: "Unser Standard für neue Aufträge: der schnellste planbare Weg und der beste Ruf bei Banken und Geldgebern.",
      en: "Our standard for new engagements: the fastest predictable route and the strongest reputation with banks and lenders.",
    },
    register: {
      name: "Division of Corporations",
      sucheUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx",
      sucheMitName: null,
      jahresUrl: "https://corp.delaware.gov/paytaxes/",
    },
  },
  florida: {
    schluessel: "florida", kurz: "FL", name: "Florida", angeboten: true,
    eintragung: {
      de: "Derzeit oft rund zwei Wochen bis zur Eintragung; die amtlichen Gründungsunterlagen folgen etwa zwölf Werktage später. Einen Express gibt es nicht. Florida war lange schneller — der Stau ist neu.",
      en: "Often around two weeks to registration at present; the official formation documents follow some twelve business days later. There is no express option. Florida used to be faster — the backlog is new.",
    },
    eintragungKurz: { de: "derzeit rund zwei Wochen, Unterlagen danach", en: "around two weeks at present, documents after that" },
    werktage: { von: 10, bis: 22 },
    express: {
      moeglich: false, werktage: null,
      text: { de: "Nein — Florida bietet keinen Express an.", en: "No — Florida offers no express option." },
      kurz: { de: "nein", en: "no" },
    },
    fahrplan: { de: "Woche eins bis vier", en: "weeks one to four" },
    jahr: {
      betrag: { de: STAAT.florida.jahr, en: STAAT_EN.florida.jahr },
      name: { de: "Jahresbericht (Annual Report)", en: "annual report" },
      frist: { de: "1. Januar bis 1. Mai", en: "1 January to 1 May" },
    },
    gruendung: { de: STAAT.florida.gruendung, en: STAAT_EN.florida.gruendung },
    jahrVertrag: "die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual Report)",
    vorteile: {
      de: [
        "Eine Gesellschaft mit Auftritt in Miami, wo unser Team vor Ort sitzt.",
        "Naheliegend für Filialbanken und Termine vor Ort in Florida.",
        `Moderate Jahreskosten: ${STAAT.florida.jahr} im Jahr.`,
      ],
      en: [
        "A company with a presence in Miami, where our team on the ground is based.",
        "A natural fit for branch banks and appointments on the ground in Florida.",
        `Moderate annual cost: ${STAAT_EN.florida.jahr} a year.`,
      ],
    },
    nachteile: {
      de: [
        "Derzeit langsam: oft rund zwei Wochen bis zur Eintragung, danach die Unterlagen — und kein Express.",
        "Feste Frist im Frühjahr; nach dem 1. Mai kommen 400 $ Verspätungsgebühr hinzu.",
      ],
      en: [
        "Slow at present: often around two weeks to registration, then the documents — and no express option.",
        "A fixed deadline in spring; after 1 May a $400 late fee is added.",
      ],
    },
    passtFuer: {
      de: "Alle mit Geschäft, Kunden oder Terminen in Florida und alle, die eine Filialbank vor Ort nutzen wollen.",
      en: "Anyone with business, customers or appointments in Florida, and anyone who wants to use a local branch bank.",
    },
    einordnung: {
      de: "Die Wahl für Geschäft und Termine in Florida — wer es eilig hat, plant die längere Eintragung ein.",
      en: "The choice for business and appointments in Florida — if time matters, allow for the longer registration.",
    },
    register: {
      name: "Sunbiz",
      sucheUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
      sucheMitName: "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchTerm={name}",
      jahresUrl: "https://services.sunbiz.org/Filings/AnnualReport/FilingStart",
    },
  },
  wyoming: {
    schluessel: "wyoming", kurz: "WY", name: "Wyoming", angeboten: true,
    eintragung: {
      de: "Rund drei Werktage, oft schon am selben Tag — zugesagt wird das vom Staat nicht.",
      en: "Around three business days, often on the same day — the state does not commit to that.",
    },
    eintragungKurz: { de: "rund drei Werktage", en: "around three business days" },
    werktage: { von: 1, bis: 4 },
    express: {
      moeglich: true, werktage: { von: 0, bis: 1 },
      text: { de: "Gegen eine hohe amtliche Eilgebühr möglich — meist nicht nötig.", en: "Possible for a high official expedite fee — rarely needed." },
      kurz: { de: "möglich, selten nötig", en: "possible, rarely needed" },
    },
    fahrplan: { de: "Woche eins bis zwei", en: "weeks one to two" },
    jahr: {
      betrag: { de: STAAT.wyoming.jahr, en: STAAT_EN.wyoming.jahr },
      name: { de: "Jahresbericht mit License Tax", en: "annual report with licence tax" },
      frist: { de: "Gründungsmonat", en: "month of formation" },
    },
    gruendung: { de: STAAT.wyoming.gruendung, en: STAAT_EN.wyoming.gruendung },
    jahrVertrag: "die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual Report mit License Tax)",
    vorteile: {
      de: [
        "Schnell: in der Regel nach rund drei Werktagen eingetragen.",
        `Die niedrigsten Jahreskosten: ${STAAT.wyoming.jahr} im Jahr.`,
        "Viel Privatsphäre: Die Gesellschafter stehen nicht im öffentlichen Register.",
      ],
      en: [
        "Fast: usually registered after around three business days.",
        `The lowest annual cost: ${STAAT_EN.wyoming.jahr} a year.`,
        "Strong privacy: the members do not appear in the public register.",
      ],
    },
    nachteile: {
      de: [
        "Manche Institute schauen bei Wyoming-Gesellschaften ohne Geschäft vor Ort genauer hin.",
        "Kein Team vor Ort, kein besonderer Ruf bei Investoren.",
      ],
      en: [
        "Some institutions look more closely at Wyoming companies with no business in the state.",
        "No team on the ground, no particular standing with investors.",
      ],
    },
    passtFuer: {
      de: "Alle, die schlank und günstig im Unterhalt starten wollen und keinen Termin vor Ort brauchen.",
      en: "Anyone who wants a lean, low-cost company and needs no appointments on the ground.",
    },
    einordnung: {
      de: "Günstig und schnell — passt, wenn niedrige laufende Kosten wichtiger sind als der Ruf bei Banken.",
      en: "Low-cost and fast — a fit when low running costs matter more than standing with banks.",
    },
    register: {
      name: "wyobiz",
      sucheUrl: "https://wyobiz.wyo.gov/Business/FilingSearch.aspx",
      sucheMitName: null,
      jahresUrl: "https://wyobiz.wyo.gov/Business/AnnualReport.aspx",
    },
  },
  nevada: {
    schluessel: "nevada", kurz: "NV", name: "Nevada", angeboten: false,
    eintragung: {
      de: "Rund drei Werktage.",
      en: "Around three business days.",
    },
    eintragungKurz: { de: "rund drei Werktage", en: "around three business days" },
    werktage: { von: 2, bis: 4 },
    express: {
      moeglich: true, werktage: null,
      text: { de: "Gegen Eilgebühr möglich.", en: "Possible for an expedite fee." },
      kurz: { de: "möglich", en: "possible" },
    },
    fahrplan: { de: "Woche eins bis zwei", en: "weeks one to two" },
    // Nicht amtlich gegengeprüft (siehe Kopf) — nur intern, keine öffentliche Seite zeigt diese Beträge.
    jahr: { betrag: { de: "350 $", en: "$350" }, name: { de: "Annual List und State Business License", en: "annual list and state business licence" }, frist: { de: "Gründungsmonat", en: "month of formation" } },
    gruendung: { de: "425 $", en: "$425" },
    jahrVertrag: "die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual List)",
    vorteile: { de: ["Schnelle Eintragung."], en: ["Fast registration."] },
    nachteile: {
      de: ["Deutlich höhere Gründungs- und Jahreskosten als Wyoming, ohne Vorteil für Bank oder Investor."],
      en: ["Markedly higher formation and annual costs than Wyoming, with no advantage for banks or investors."],
    },
    passtFuer: { de: "Vorhaben mit Geschäft in Nevada.", en: "Plans with business in Nevada." },
    einordnung: {
      de: "Ähnlich schnell wie Wyoming, aber teurer im Unterhalt — deshalb bieten wir Nevada nicht als eigenen Weg an.",
      en: "About as fast as Wyoming but more expensive to maintain — which is why we do not offer Nevada as a route of its own.",
    },
    register: { name: "SilverFlume", sucheUrl: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch", sucheMitName: null, jahresUrl: "https://www.nvsilverflume.gov/" },
  },
};

/** Die angebotenen Staaten als Liste (Reihenfolge Delaware, Florida, Wyoming). */
export const STAATEN_ZUR_WAHL: BundesstaatInfo[] = STAATEN_ANGEBOTEN.map((k) => BUNDESSTAATEN[k]);

/** „Delaware“, „delaware“, „DE“, „State of Delaware“ → „delaware“; Unbekanntes → null. */
export function staatSchluessel(roh: unknown): StaatSchluessel | null {
  const s = String(roh ?? "").trim().replace(/^state of\s+/i, "").toLowerCase();
  if (!s) return null;
  for (const b of Object.values(BUNDESSTAATEN)) {
    if (s === b.schluessel || s === b.kurz.toLowerCase() || s === b.name.toLowerCase()) return b.schluessel;
  }
  return null;
}
/** Die Angaben zu einem Staat (Name oder Kürzel) — null, wenn wir ihn nicht kennen. */
export function staatInfo(roh: unknown): BundesstaatInfo | null {
  const k = staatSchluessel(roh);
  return k ? BUNDESSTAATEN[k] : null;
}
/** true = ein Staat, den wir für neue Gründungen anbieten. */
export function staatAngeboten(roh: unknown): boolean {
  return !!staatInfo(roh)?.angeboten;
}
/** Der amtliche Name aus Name oder Kürzel („DE“ → „Delaware“); Unbekanntes bleibt, wie es ist. */
export function staatName(roh: unknown): string {
  return staatInfo(roh)?.name ?? String(roh ?? "").trim();
}
/** Der Name des Vorgabe-Staats für neue Angebote („Delaware“). */
export const STAAT_VORGABE_NAME = BUNDESSTAATEN[STAAT_VORGABE_NEU].name;
/** Die angebotenen Namen („Delaware, Florida oder Wyoming“). */
export function staatenAufzaehlung(s: Sprache = "de"): string {
  const n = STAATEN_ZUR_WAHL.map((b) => b.name);
  return `${n.slice(0, -1).join(", ")} ${s === "en" ? "or" : "oder"} ${n[n.length - 1]}`;
}

// ── EIN (Steuernummer der Gesellschaft) — unabhängig vom Staat, erst nach der Eintragung ──
// Laut IRS per Fax etwa vier Werktage (fakten.ts IRS.einDauer); in der Praxis derzeit oft rund
// zwei Wochen bis zur Nummer, der Bestätigungsbrief (CP 575) kommt vier bis fünf Wochen später.
// Antragsteller aus dem Ausland können telefonisch beantragen — die Nummer gibt es im Gespräch.
export const EIN_ZEITEN: Record<Sprache, { telefon: string; fax: string; brief: string; satz: string; kurz: string }> = {
  de: {
    telefon: "per Telefon (für Antragsteller aus dem Ausland) noch am selben Tag",
    fax: "per Fax derzeit oft rund zwei Wochen bis zur Nummer",
    brief: "der Bestätigungsbrief der US-Steuerbehörde kommt rund vier bis fünf Wochen später per Post",
    satz: "Die EIN — die Steuernummer der Gesellschaft — hängt nicht vom Bundesstaat ab und wird erst nach der Eintragung beantragt: per Telefon (für Antragsteller aus dem Ausland) gibt es sie noch am selben Tag, per Fax derzeit oft nach rund zwei Wochen; der Bestätigungsbrief der US-Steuerbehörde kommt rund vier bis fünf Wochen später per Post.",
    kurz: "nach der Eintragung: per Telefon am selben Tag, per Fax derzeit oft rund zwei Wochen",
  },
  en: {
    telefon: "by phone (for applicants outside the US) on the same day",
    fax: "by fax often around two weeks to the number at present",
    brief: "the US tax authority’s confirmation letter follows by post some four to five weeks later",
    satz: "The EIN — the company’s tax number — does not depend on the state and can only be applied for after registration: by phone (for applicants outside the US) it is issued on the same day, by fax it often takes around two weeks at present; the US tax authority’s confirmation letter follows by post some four to five weeks later.",
    kurz: "after registration: same day by phone, often around two weeks by fax at present",
  },
};

/** Was bei Konto und Karte wirklich zählt — kundentauglich, ohne Bank als Zusage. */
export const STAAT_BANKEN: Record<Sprache, string> = {
  de: "Für Konto und Karten zählt der Bundesstaat weniger, als viele denken. Entscheidend ist ein stimmiges Bild: dieselbe US-Adresse und Telefonnummer in allen Unterlagen, ein unterschriebenes Operating Agreement und Ihre persönliche Bonität als Inhaber. Die Entscheidung trifft jedes Institut nach eigenen Regeln.",
  en: "For accounts and cards, the state matters less than many assume. What counts is a consistent picture: the same US address and phone number in every document, a signed operating agreement and your personal credit standing as the owner. Each institution decides by its own rules.",
};

/** Der eine Satz zur Staaten-Wahl für Übersicht, FAQ und Mara. */
export const STAAT_WAHL_SATZ: Record<Sprache, string> = {
  de: `Wir gründen in ${staatenAufzaehlung("de")} — Sie wählen mit uns im Startgespräch. Wenn nichts anderes dafür spricht, gründen wir in Delaware: Mit dem Express des Staats steht die Gesellschaft in der Regel nach ein bis zwei Werktagen, und Delaware hat den besten Ruf bei Banken und Geldgebern. Florida trägt derzeit langsamer ein (oft rund zwei Wochen, ohne Express), Wyoming ist schnell und am günstigsten im Unterhalt.`,
  en: `We form in ${staatenAufzaehlung("en")} — you choose with us in the kick-off call. Unless something speaks for another state, we form in Delaware: with the state’s express service the company usually stands after one or two business days, and Delaware has the strongest reputation with banks and lenders. Florida is registering more slowly at present (often around two weeks, no express option); Wyoming is fast and the cheapest to maintain.`,
};

/** Für Angebote: Eintragung kurz in einem Satz („Delaware trägt mit Express in der Regel in ein bis zwei Werktagen ein.“). */
export function staatEintragungSatz(roh: unknown, s: Sprache = "de"): string {
  const b = staatInfo(roh);
  if (!b) return "";
  if (b.schluessel === "delaware") return s === "en" ? "With the state’s express service, Delaware usually registers in one or two business days." : "Delaware trägt mit dem Express des Staats in der Regel in ein bis zwei Werktagen ein.";
  if (b.schluessel === "florida") return s === "en" ? "Florida is registering more slowly at present: often around two weeks, with the documents following after that." : "Florida trägt derzeit langsamer ein: oft rund zwei Wochen, die Unterlagen folgen danach.";
  if (b.schluessel === "wyoming") return s === "en" ? "Wyoming usually registers in around three business days." : "Wyoming trägt in der Regel in rund drei Werktagen ein.";
  return b.eintragung[s];
}

// ═══════════════════════════════════════════════════════════════════════════
// ANGEBOTE UND VERTRÄGE FÜR NEUE KUNDEN (E-465)
//
// Bestandsschutz: Jedes Angebot, das VOR E-465 angelegt wurde, trägt kein
// `staatenFassung` in seinen Parametern — es zeigt und unterschreibt weiter genau den
// Text von damals (die Prüfsumme der angenommenen Verträge bleibt gleich; geprüft mit
// scripts/pruef-global-bundesstaaten.ts gegen die Produktion, nur lesend).
// Neue Angebote (Anlegen per Skript bzw. *Anlegen() auf dem Server) bekommen
// `staatenFassung: "E-465"` und — ohne ausdrückliche Wahl — Delaware. Nur dann
// ziehen Fahrplan, Eintragungssatz und der Name der Jahrespflicht den Staat.
// ═══════════════════════════════════════════════════════════════════════════
export const STAATEN_FASSUNG = "E-465";

/** true = das Angebot ist mit E-465 angelegt (neue, staatsabhängige Texte). */
export function staatenFassungAktiv(f: unknown): boolean {
  return String(f ?? "").trim() === STAATEN_FASSUNG;
}

/**
 * Die Parameter eines NEUEN Angebots: der Staat (Name oder Kürzel → amtlicher Name; fehlt er → Delaware)
 * und die Kennung der Staaten-Fassung. Bestehende Angebote laufen NIE hier durch.
 */
export function neuesAngebotParameter<T extends object>(roh: T | null | undefined): T & { bundesstaat: string; staatenFassung: string } {
  const r = (roh ?? {}) as T & { bundesstaat?: unknown };
  const staat = String(r.bundesstaat ?? "").trim();
  return { ...r, bundesstaat: staat ? staatName(staat) : STAAT_VORGABE_NAME, staatenFassung: STAATEN_FASSUNG };
}

/** Prüfung für neue Angebote: nur die angebotenen Staaten. null = in Ordnung. */
export function angebotStaatFehler(bundesstaat: unknown, staatenFassung: unknown): string | null {
  if (!staatenFassungAktiv(staatenFassung)) return null; // Bestand: nie nachträglich prüfen
  return staatAngeboten(bundesstaat) ? null : `Bundesstaat: nur ${staatenAufzaehlung("de")} (gewählt: „${String(bundesstaat ?? "")}“).`;
}

export interface AngebotStaatTexte {
  name: string;
  /** Fahrplan-Schritt „Ihre Gesellschaft entsteht“ — Dauer. */
  fahrplanDauer: string;
  /** Ein Satz zur Eintragung (ehrlich, ohne Zusage). */
  eintragungSatz: string;
  /** Wann die Eintragung nach unserem Plan liegt („in Woche eins oder zwei“). */
  planWoche: string;
  /** „die erste Jahressteuer der Gesellschaft beim Bundesstaat (Annual Tax)“ … */
  jahrVertrag: string;
  /** Wo der Name geprüft wird („im offiziellen Register von Delaware“). */
  register: string;
}

/** Die staatsabhängigen Angebotstexte — null für Bestandsangebote (dann gilt der alte Text unverändert). */
export function angebotStaatTexte(bundesstaat: unknown, staatenFassung: unknown): AngebotStaatTexte | null {
  if (!staatenFassungAktiv(staatenFassung)) return null;
  const b = staatInfo(bundesstaat);
  if (!b) return null;
  const planWoche = b.schluessel === "florida" ? "in Woche zwei bis vier" : "in Woche eins oder zwei";
  return {
    name: b.name,
    fahrplanDauer: b.fahrplan.de.charAt(0).toUpperCase() + b.fahrplan.de.slice(1),
    eintragungSatz: staatEintragungSatz(b.schluessel, "de"),
    planWoche,
    jahrVertrag: b.jahrVertrag,
    register: `im offiziellen Register von ${b.name}`,
  };
}

/** Intern (Aufgaben, Arbeitsablauf): wo der Name vor der Anmeldung geprüft wird. */
export function staatRegisterIntern(bundesstaat: unknown): string {
  const b = staatInfo(bundesstaat);
  return b ? `im Register von ${b.name} (${b.register.name})` : "im Register des Bundesstaats";
}
