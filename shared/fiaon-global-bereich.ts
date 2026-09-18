// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „MEIN AUFTRAG": ETAPPEN, UNTERLAGEN, PFLICHTENKALENDER
// (17.09.2026, E-188)
//
// Justin: „Mach alles fix fertig, keine Platzhalter" — was die Pakete zusagen
// (eigener Dokumentenraum, Pflichtenkalender, fester Ansprechpartner,
// monatlicher Durchgang), muss es als Funktion geben.
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Die Kundenseite „Mein Auftrag" (/business/auftrag/<ref>), die Office-Seite
// (/agent/global/<ref>), die Mails und der Tageslauf sprechen über dieselben
// Dinge: sechs Etappen, zwölf Dokumentarten, fünf Unterlagen, ein Kalender mit
// Pflichten. Stünde jeder Satz dort, wo er gebraucht wird, sagte die Mail
// „Etappe 2" und die Seite etwas anderes. Hier steht jeder Satz EINMAL, deutsch
// und englisch, und alles hier ist REIN: keine Datenbank, kein Netz, kein Datum
// „von jetzt" — der Tag kommt als Parameter. scripts/pruef-global-bereich.ts
// rechnet deshalb jede Regel nach, ohne dass ein Server läuft.
//
// ── DIE GRENZEN DER WORTWAHL ───────────────────────────────────────────────
// Wie in shared/fiaon-global.ts: Über Konto, Karte, Rahmen und Darlehen
// entscheidet das Institut. Steuer- und Rechtsfragen beantworten Steuerberater
// und Anwälte auf eigenes Mandat — FIAON koordiniert. Kein „bis zu", kein
// Bankname, keine Frist mit Ziffer in Tagen/Wochen/Monaten, kein Zinssatz als
// Zahl. Jeder deutsche Satz passiert die Wortwand und die schärferen
// Global-Regeln (Prüfstand oben).
//
// ── DER PFLICHTENKALENDER IST INFORMATION, KEINE AUSKUNFT IM EINZELFALL ────
// Die Regeln unten nennen allgemein bekannte, gesetzliche Termine — ohne
// Beträge, ohne Steuersätze, ohne Aussage zum einzelnen Unternehmen. Jede Frist
// trägt den Satz „Ihr Steuerberater bzw. US-CPA bestätigt die für Sie geltenden
// Fristen". Geprüft am 17.09.2026 gegen:
//   · IRS, Instructions for Form 5472: eine US-Gesellschaft in ausländischer
//     Hand reicht Form 5472 mit einer Pro-forma-Form 1120 ein, „by the due date
//     (including extensions) of that Form 1120"; Verlängerung über Form 7004.
//     https://www.irs.gov/instructions/i5472
//   · IRS, Instructions for Form 1120: „by the 15th day of the 4th month after
//     the end of its tax year"; fällt der Tag auf Samstag, Sonntag oder einen
//     Feiertag, gilt der nächste Werktag. Bei Kalenderjahr: 15. April.
//     https://www.irs.gov/instructions/i1120
//   · Delaware Division of Corporations: LLC/LP/GP — „The annual taxes for the
//     prior year are due on or before June 1st", kein Jahresbericht.
//     https://corp.delaware.gov/alt-entitytaxinstructions/
//     Corporations — „Annual Reports and Franchise Taxes for the prior year are
//     due annually on or before March 1st". https://corp.delaware.gov/paytaxes/
//   · Wyoming Secretary of State, FAQ Business: „The annual report due date …
//     is based on the anniversary month of formation" — fällig am ersten Tag
//     dieses Monats. https://sos.wyo.gov/faqs.aspx?root=BUS
//   · Florida: § 605.0212(3) Florida Statutes (LLC) und § 607.1622(4) (Corporation),
//     wortgleich: „The first annual report must be delivered to the department
//     between January 1 and May 1 of the year following the calendar year in
//     which … became effective … Subsequent annual reports must be delivered …
//     between January 1 and May 1 of each calendar year thereafter."
//     http://www.leg.state.fl.us/statutes/ (Kapitel 605 und 607). Die Seite von
//     Sunbiz (dos.fl.gov) verweigerte am 17.09. den automatischen Abruf (403);
//     geprüft ist deshalb der Gesetzestext selbst.
//   · New Mexico: LLCs reichen beim Secretary of State nach unserem Stand keinen
//     Jahres- oder Zweijahresbericht ein (Corporations schon — dafür gibt es hier
//     KEINE Regel, sondern den Handeintrag). NICHT an einer Primärquelle belegt:
//     Die Seiten der Behörde (sos.nm.gov) nennen die Frage nicht bzw. waren am
//     17.09. nicht abrufbar; die Aussage stützt sich auf übereinstimmende
//     Sekundärquellen. Für New Mexico entsteht deshalb schlicht KEINE Staatsfrist
//     (wie für jeden Staat ohne Regel), und das Office bekommt beim Speichern den
//     Satz, das vom Registered Agent bestätigen zu lassen. Im Bericht zu E-188 offen.
// Der erste Staatstermin liegt überall im Jahr NACH der Gründung. Die
// Verlängerung des Registered Agent ist kein Gesetzestermin, sondern die
// übliche Jahresabrechnung ab Gründung — der Hinweis sagt das.
// ═══════════════════════════════════════════════════════════════════════════

import { globalPaket } from "./fiaon-global";

export type BereichSprache = "de" | "en";

// ── DIE ETAPPEN ──────────────────────────────────────────────────────────────
// Titel und Sätze folgen „Der Weg" auf /business (client/src/i18n/global.ts):
// dieselben vier Etappen, davor der angelegte Auftrag, danach der Abschluss.
export const GLOBAL_ETAPPE_MAX = 5;
export type GlobalEtappeNr = 0 | 1 | 2 | 3 | 4 | 5;

export interface GlobalEtappeText { titel: string; text: string }
export const GLOBAL_ETAPPEN: { nr: GlobalEtappeNr; de: GlobalEtappeText; en: GlobalEtappeText }[] = [
  {
    nr: 0,
    de: { titel: "Auftrag angelegt", text: "Ihr Auftrag ist unterschrieben; Vertrag und Rechnung finden Sie auf dieser Seite. Mit dem Zahlungseingang beginnt die Arbeit, und Ihr Ansprechpartner vereinbart das Startgespräch." },
    en: { titel: "Order placed", text: "Your order is signed; the contract and the invoice are on this page. Work begins once your payment has arrived, and your contact arranges the kick-off call." },
  },
  {
    nr: 1,
    de: { titel: "Gründung und Dokumente", text: "Gesellschaft, EIN, ITIN, Registered Agent, US-Adresse und Telefonnummer, Operating Agreement. Unser Team vor Ort reicht ein und holt ab; Ihre Unterlagen laden Sie auf dieser Seite hoch. Die ITIN vergibt die US-Steuerbehörde in eigener Frist." },
    en: { titel: "Formation and documents", text: "Company, EIN, ITIN, registered agent, US address and phone number, operating agreement. Our team on the ground files and collects; you upload your documents on this page. The ITIN is issued by the US tax authority on its own timeline." },
  },
  {
    nr: 2,
    de: { titel: "Die erste Firmenkarte", text: "Mit vollständigen Dokumenten stellen Sie den ersten Antrag bei einem US-Herausgeber — meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers. Wir bereiten den Antrag vor; der Herausgeber entscheidet." },
    en: { titel: "The first business card", text: "With complete documents you submit the first application to a US issuer — usually with a small limit and no cash deposit, but with a personal guarantee from the owner. We prepare the application; the issuer decides." },
  },
  {
    nr: 3,
    de: { titel: "Die Kartenleiter", text: "Pünktliche Abrechnung über einige Monate öffnet weitere Herausgeber. FIAON plant die Reihenfolge und begleitet jeden Antrag; ob und zu welchen Bedingungen ein Herausgeber zusagt, legt er selbst fest." },
    en: { titel: "The card ladder", text: "Paying on time for several months opens further issuers. FIAON plans the sequence and supports every application; whether and on what terms an issuer accepts is set by the issuer." },
  },
  {
    nr: 4,
    de: { titel: "Das Bankdarlehen", text: "Mit gewachsener Historie kann ein Darlehen bei einer US-Bank in Frage kommen. FIAON bereitet Unterlagen und Kennzahlen auf; den Antrag stellen Sie bei der Bank, die ihn nach ihren Regeln prüft." },
    en: { titel: "The bank loan", text: "With an established history, a loan from a US bank may become an option. FIAON prepares documents and key figures; you apply to the bank, which assesses the application under its own rules." },
  },
  {
    nr: 5,
    de: { titel: "Abgeschlossen", text: "Die vereinbarte Begleitung ist abgeschlossen. Ihre Dokumente und Ihr Pflichtenkalender bleiben auf dieser Seite für Sie erreichbar." },
    en: { titel: "Completed", text: "The agreed support is complete. Your documents and your compliance calendar remain available to you on this page." },
  },
];

export function globalEtappeText(nr: number, sprache: BereichSprache = "de"): GlobalEtappeText {
  const e = GLOBAL_ETAPPEN.find((x) => x.nr === nr) ?? GLOBAL_ETAPPEN[0];
  return sprache === "en" ? e.en : e.de;
}

/**
 * Bis zu welcher Etappe ein Paket begleitet — aus den Leistungen in
 * shared/fiaon-global.ts: Struktur endet mit dem ersten Konto- und
 * Kartenantrag, Banking führt die Kartenleiter, Kapital und VIP bereiten
 * zusätzlich das Bankdarlehen vor. Die Oberfläche zeigt Etappen dahinter leiser.
 */
export function globalPaketEtappeBis(paketKey: unknown): GlobalEtappeNr {
  const key = globalPaket(paketKey)?.key;
  if (key === "global_struktur") return 2;
  if (key === "global_banking") return 3;
  return 4;
}

/** Pakete mit dem zugesagten „monatlichen Durchgang" (Leistungstext ab Global Banking). */
export function globalHatMonatsdurchgang(paketKey: unknown): boolean {
  const key = globalPaket(paketKey)?.key;
  return key === "global_banking" || key === "global_kapital" || key === "global_vip";
}

export type GlobalEtappeStand = "fertig" | "jetzt" | "offen";
/** Der Stand einer Etappe aus der aktuellen: davor fertig, sie selbst jetzt, danach offen. Abgeschlossen = alles fertig. */
export function globalEtappeStand(nr: number, aktuell: number): GlobalEtappeStand {
  if (aktuell >= GLOBAL_ETAPPE_MAX) return "fertig";
  if (nr < aktuell) return "fertig";
  return nr === aktuell ? "jetzt" : "offen";
}

// ── DOKUMENTARTEN ────────────────────────────────────────────────────────────
export type GlobalDokumentArt =
  | "reisepass" | "adressnachweis" | "registerauszug" | "gesellschafterliste" | "namenswunsch" | "taetigkeitsbeschreibung"
  | "gruendungsurkunde" | "ein_brief" | "operating_agreement" | "itin_bescheid" | "bank_unterlage" | "sonstiges";

/** `von`: wer diese Art üblicherweise liefert. Der Kunde wählt nur aus „kunde" und „beide"; FIAON darf jede Art ablegen. */
export const GLOBAL_DOKUMENTARTEN: { art: GlobalDokumentArt; von: "kunde" | "fiaon" | "beide"; de: string; en: string }[] = [
  { art: "reisepass", von: "kunde", de: "Reisepass", en: "Passport" },
  { art: "adressnachweis", von: "kunde", de: "Adressnachweis", en: "Proof of address" },
  { art: "registerauszug", von: "kunde", de: "Handelsregisterauszug", en: "Commercial register extract" },
  { art: "gesellschafterliste", von: "kunde", de: "Gesellschafterliste", en: "Shareholder list" },
  { art: "namenswunsch", von: "kunde", de: "Namenswunsch für die US-Gesellschaft", en: "Preferred name for the US company" },
  { art: "taetigkeitsbeschreibung", von: "kunde", de: "Beschreibung der Geschäftstätigkeit", en: "Description of the business activity" },
  { art: "gruendungsurkunde", von: "fiaon", de: "Gründungsurkunde der US-Gesellschaft", en: "Formation certificate of the US company" },
  { art: "ein_brief", von: "fiaon", de: "EIN-Bestätigung der US-Steuerbehörde", en: "EIN confirmation letter from the US tax authority" },
  { art: "operating_agreement", von: "fiaon", de: "Operating Agreement", en: "Operating agreement" },
  { art: "itin_bescheid", von: "fiaon", de: "ITIN-Bescheid", en: "ITIN notice" },
  { art: "bank_unterlage", von: "beide", de: "Unterlage für Bank oder Kartenherausgeber", en: "Document for a bank or card issuer" },
  { art: "sonstiges", von: "beide", de: "Sonstiges Dokument", en: "Other document" },
];

const ART_NACH_KEY = new Map(GLOBAL_DOKUMENTARTEN.map((a) => [a.art as string, a]));

export function globalDokumentArt(art: unknown): (typeof GLOBAL_DOKUMENTARTEN)[number] | null {
  return ART_NACH_KEY.get(String(art ?? "").trim().toLowerCase()) ?? null;
}
export function globalDokumentArtText(art: unknown, sprache: BereichSprache = "de"): string {
  const a = globalDokumentArt(art) ?? ART_NACH_KEY.get("sonstiges")!;
  return sprache === "en" ? a.en : a.de;
}
/** Darf der KUNDE ein Dokument dieser Art hochladen? */
export function globalKundeDarfArt(art: unknown): boolean {
  const a = globalDokumentArt(art);
  return !!a && a.von !== "fiaon";
}

/**
 * Die Auswahl beim Hochladen: Der Kunde bekommt nur die Arten, die er liefern
 * darf; das Office jede. EINE Liste für beide Oberflächen (Feld `dokumentArten`
 * in GET …/mein-auftrag/:ref und GET /agent/global/auftraege/:ref).
 */
export function globalDokumentArtenFuer(fuer: "kunde" | "office", sprache: BereichSprache = "de"): { art: GlobalDokumentArt; titel: string }[] {
  return GLOBAL_DOKUMENTARTEN
    .filter((a) => fuer === "office" || a.von !== "fiaon")
    .map((a) => ({ art: a.art, titel: sprache === "en" ? a.en : a.de }));
}

/** Die zwei Unterlagen, die keine Datei sein müssen: Der Kunde kann sie auch als Text einreichen — abgelegt wird eine Textdatei. */
export const GLOBAL_TEXT_UNTERLAGEN: GlobalDokumentArt[] = ["namenswunsch", "taetigkeitsbeschreibung"];

// ── DIE UNTERLAGEN, DIE DER KUNDE LIEFERT ────────────────────────────────────
// EINE Liste für die Startmail, die Aufgabe „US-Struktur starten", die
// Kundenseite und den Tageslauf. Bis zum 17.09. stand sie in
// server/mail/vorlagen/global.ts; dort wird sie jetzt nur noch eingelesen.
// `zeile` ist der Satz der Mail, `titel`/`hinweis` sind die Zeile auf der Seite.
// `erfuelltDurch`: Ein Dokument einer dieser Arten macht die Zeile „vorhanden".
// `textHinweis` (nur bei den zwei Text-Unterlagen): der Satz, den die Seite zeigt, WENN sie das Textfeld
// dazu anbietet (POST …/nachricht { text, art }). Er steht bewusst NICHT im `hinweis`: Ein Hinweis, der
// ein Eingabefeld verspricht, das die Seite nicht hat, wäre ein Knopf ohne Route von der anderen Seite.
export interface GlobalUnterlage {
  art: GlobalDokumentArt;
  erfuelltDurch: GlobalDokumentArt[];
  de: { zeile: string; titel: string; hinweis: string; textHinweis?: string };
  en: { zeile: string; titel: string; hinweis: string; textHinweis?: string };
}
export const GLOBAL_UNTERLAGEN_LISTE: GlobalUnterlage[] = [
  {
    art: "reisepass", erfuelltDurch: ["reisepass"],
    de: { zeile: "Reisepass der Gesellschafter und der Geschäftsführung (Farbkopie)", titel: "Reisepass", hinweis: "Farbkopie der Seite mit Foto — für jede Gesellschafterin, jeden Gesellschafter und die Geschäftsführung ein eigenes Dokument." },
    en: { zeile: "Passports of the shareholders and the managing directors (colour copy)", titel: "Passport", hinweis: "Colour copy of the photo page — one document for each shareholder and each managing director." },
  },
  {
    art: "adressnachweis", erfuelltDurch: ["adressnachweis"],
    de: { zeile: "Adressnachweis, nicht älter als drei Monate", titel: "Adressnachweis", hinweis: "Zum Beispiel eine Strom-, Gas- oder Telefonrechnung oder ein Kontoauszug mit Ihrer Wohnanschrift, nicht älter als drei Monate." },
    en: { zeile: "Proof of address, no older than three months", titel: "Proof of address", hinweis: "For example a utility or phone bill or a bank statement showing your home address, no older than three months." },
  },
  {
    art: "registerauszug", erfuelltDurch: ["registerauszug", "gesellschafterliste"],
    de: { zeile: "Gesellschafterliste oder Handelsregisterauszug Ihres Unternehmens", titel: "Gesellschafterliste oder Handelsregisterauszug", hinweis: "Eines von beiden genügt — aktuell und vollständig. Einzelunternehmen laden stattdessen die Gewerbeanmeldung hoch." },
    en: { zeile: "Shareholder list or commercial register extract of your company", titel: "Shareholder list or commercial register extract", hinweis: "Either one is sufficient — current and complete. Sole traders upload their business registration instead." },
  },
  {
    art: "namenswunsch", erfuelltDurch: ["namenswunsch"],
    de: { zeile: "der gewünschte Name der US-Gesellschaft in drei Varianten", titel: "Name der US-Gesellschaft", hinweis: "Drei Varianten in der Reihenfolge Ihres Wunsches — der Bundesstaat vergibt jeden Namen nur einmal.", textHinweis: "Sie können die Namen hier auch einfach als Text eintragen." },
    en: { zeile: "The name you would like for the US company, in three variants", titel: "Name of the US company", hinweis: "Three variants in order of preference — each state registers a name only once.", textHinweis: "You can also simply enter the names here as text." },
  },
  {
    art: "taetigkeitsbeschreibung", erfuelltDurch: ["taetigkeitsbeschreibung"],
    de: { zeile: "eine kurze Beschreibung der Geschäftstätigkeit", titel: "Beschreibung der Geschäftstätigkeit", hinweis: "Einige Sätze genügen: was die US-Gesellschaft tun wird, für wen und in welchen Ländern.", textHinweis: "Sie können die Beschreibung hier auch einfach als Text eintragen." },
    en: { zeile: "A short description of the business activity", titel: "Description of the business activity", hinweis: "A few sentences are enough: what the US company will do, for whom and in which countries.", textHinweis: "You can also simply enter the description here as text." },
  },
];

/** Die Liste als Sätze — deutsch für die Startmail und die Aufgabe (Name und Inhalt wie bisher in vorlagen/global.ts). */
export const GLOBAL_UNTERLAGEN: string[] = GLOBAL_UNTERLAGEN_LISTE.map((u) => u.de.zeile);
/** Dieselbe Liste englisch — gleiche Reihenfolge, gleicher Umfang. */
export const GLOBAL_UNTERLAGEN_EN: string[] = GLOBAL_UNTERLAGEN_LISTE.map((u) => u.en.zeile);

/** Welche Unterlagen liegen vor? `arten` = die Arten aller nicht gelöschten Dokumente des Auftrags. */
export function globalUnterlagenStand(arten: Iterable<string>, sprache: BereichSprache = "de"): { art: GlobalDokumentArt; titel: string; hinweis: string; vorhanden: boolean; alsText?: true; textHinweis?: string }[] {
  const da = new Set(Array.from(arten, (a) => String(a)));
  return GLOBAL_UNTERLAGEN_LISTE.map((u) => {
    const t = sprache === "en" ? u.en : u.de;
    return {
      art: u.art, titel: t.titel, hinweis: t.hinweis, vorhanden: u.erfuelltDurch.some((a) => da.has(a)),
      ...(GLOBAL_TEXT_UNTERLAGEN.includes(u.art) && t.textHinweis ? { alsText: true as const, textHinweis: t.textHinweis } : {}),
    };
  });
}
export function globalUnterlagenOffen(arten: Iterable<string>): number {
  return globalUnterlagenStand(arten).filter((u) => !u.vorhanden).length;
}

// ── DIE US-GESELLSCHAFT ──────────────────────────────────────────────────────
export type GlobalGesellschaftForm = "LLC" | "Corporation";
export type GlobalItinStand = "offen" | "beantragt" | "vorhanden";
export interface GlobalGesellschaft {
  name?: string | null;
  form?: GlobalGesellschaftForm | null;
  /** Zwei Buchstaben, z. B. „DE" für Delaware — nie mit dem Land des Kunden verwechseln. */
  bundesstaat?: string | null;
  /** YYYY-MM-DD */
  gegruendetAm?: string | null;
  einVorhanden?: boolean | null;
  itinStand?: GlobalItinStand | null;
}

export const US_BUNDESSTAATEN: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
/** „Delaware", „delaware", „DE" → „DE"; Unbekanntes → null. */
export function usBundesstaatCode(roh: unknown): string | null {
  const s = String(roh ?? "").trim();
  if (!s) return null;
  const gross = s.toUpperCase();
  if (US_BUNDESSTAATEN[gross]) return gross;
  const treffer = Object.entries(US_BUNDESSTAATEN).find(([, name]) => name.toLowerCase() === s.toLowerCase());
  return treffer ? treffer[0] : null;
}
export function usBundesstaatName(code: unknown): string | null {
  return US_BUNDESSTAATEN[String(code ?? "").trim().toUpperCase()] ?? null;
}

// ── DIE PFLICHTEN-REGELN ─────────────────────────────────────────────────────
const ISO_TAG = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ist das ein echter Kalendertag? „2027-02-29" ist keiner. */
export function istIsoTag(v: unknown): v is string {
  const m = ISO_TAG.exec(String(v ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}
function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}
const zwei = (n: number) => String(n).padStart(2, "0");
/** Ein Kalendertag; ein Tag, den es in diesem Monat nicht gibt, fällt auf den Monatsletzten (29.02. → 28.02.). */
function tagIn(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${zwei(monat)}-${zwei(Math.min(tag, tageImMonat(jahr, monat)))}`;
}
/** Kalendermonate weiter, derselbe Tag oder der Monatsletzte — reine Datumsrechnung ohne Uhrzeit und Zeitzone. */
export function isoPlusMonate(iso: string, monate: number): string {
  const m = ISO_TAG.exec(iso)!;
  const gesamt = Number(m[1]) * 12 + (Number(m[2]) - 1) + monate;
  return tagIn(Math.floor(gesamt / 12), (gesamt % 12) + 1, Number(m[3]));
}

/** Kalendertage weiter — reine Datumsrechnung auf dem ISO-Tag. */
export function isoPlusTage(iso: string, tage: number): string {
  const m = ISO_TAG.exec(iso)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + tage)).toISOString().slice(0, 10);
}

/**
 * Der „monatliche Durchgang" (Leistung ab Global Banking): fällig am Monatstag
 * des Starts, zum ersten Mal einen Monat danach. Zurück kommt der Monat
 * („2026-11") des jüngsten fälligen Durchgangs — er ist der Schlüssel, unter dem
 * die Aufgabe genau einmal entsteht — oder null, solange noch keiner fällig ist.
 * Startet ein Auftrag am 31., ist der Durchgang in kurzen Monaten am Monatsletzten.
 */
export function globalDurchgangMonat(startIso: unknown, heuteIso: unknown): string | null {
  if (!istIsoTag(startIso) || !istIsoTag(heuteIso) || heuteIso <= startIso) return null;
  let treffer: string | null = null;
  for (let k = 1; k <= 600; k++) {
    const faellig = isoPlusMonate(startIso, k);
    if (faellig > heuteIso) break;
    treffer = faellig.slice(0, 7);
  }
  return treffer;
}

/**
 * Welche Erinnerung ist für eine Frist HEUTE dran? Rund einen Monat vorher die
 * Marke 30, rund eine Woche vorher die Marke 7 — jede genau einmal (`schon`).
 * Wer die Woche erreicht, ohne dass die Monatsmarke je gesetzt wurde (Frist
 * kurzfristig eingetragen), bekommt NUR die Wochen-Erinnerung. Vergangenes und
 * was weiter als 30 Tage weg liegt: keine.
 */
export function globalFristMarke(faelligAm: unknown, heute: unknown, schon: { m30: boolean; m7: boolean }): 30 | 7 | null {
  if (!istIsoTag(faelligAm) || !istIsoTag(heute) || faelligAm < heute) return null;
  if (faelligAm <= isoPlusTage(heute, 7)) return schon.m7 ? null : 7;
  if (faelligAm <= isoPlusTage(heute, 30)) return schon.m30 ? null : 30;
  return null;
}

/**
 * Der Tageslauf arbeitet nur am Tag (Berliner Zeit, 08:00 bis vor 20:00): Er
 * verschickt Erinnerungen an Firmenkunden und Aufgaben-Mails an Mitarbeiter —
 * beides gehört nicht in die Nacht. `minuten` = Minuten seit Mitternacht in Berlin.
 */
export function globalTageslaufFenster(minuten: number): boolean {
  return Number.isFinite(minuten) && minuten >= 8 * 60 && minuten < 20 * 60;
}

/** Nach so vielen Tagen ohne vollständige Unterlagen bekommt die zuständige Person eine Aufgabe (keine Mail-Kaskade an den Kunden). */
export const GLOBAL_UNTERLAGEN_NACHFASS_TAGE = 5;

export const GLOBAL_KALENDER_MONATE = 18;

export const GLOBAL_FRIST_STANDARDHINWEIS: Record<BereichSprache, string> = {
  de: "Ihr Steuerberater bzw. US-CPA bestätigt die für Sie geltenden Fristen.",
  en: "Your tax adviser or US CPA confirms the deadlines that apply to you.",
};

export interface GlobalRegelFrist {
  /** Eindeutig je Auftrag: Regel + Jahr — daran erkennt der Server eine Frist wieder. */
  regelKey: string;
  titel: string;
  /** YYYY-MM-DD */
  faelligAm: string;
  hinweis: string;
}

interface RegelText { titel: string; hinweis: string }
const REGEL_TEXTE = {
  us_llc: {
    de: { titel: "Jährliche US-Meldung der Gesellschaft (Form 5472 mit Form 1120)", hinweis: "Allgemeiner gesetzlicher Termin für Gesellschaften in ausländischer Hand mit dem Kalenderjahr als Steuerjahr — die Meldung ist auch ohne Umsatz abzugeben. Fällt der Tag auf ein Wochenende oder einen Feiertag, gilt der nächste Werktag; eine Verlängerung ist auf Antrag möglich." },
    en: { titel: "Annual US filing of the company (Form 5472 with Form 1120)", hinweis: "General statutory date for foreign-owned companies whose tax year is the calendar year — the filing is due even without revenue. If the date falls on a weekend or public holiday, the next business day applies; an extension is available on application." },
  },
  us_corp: {
    de: { titel: "Jährliche US-Steuererklärung der Gesellschaft (Form 1120, bei ausländischen Anteilseignern mit Form 5472)", hinweis: "Allgemeiner gesetzlicher Termin für Gesellschaften mit dem Kalenderjahr als Steuerjahr. Fällt der Tag auf ein Wochenende oder einen Feiertag, gilt der nächste Werktag; eine Verlängerung ist auf Antrag möglich." },
    en: { titel: "Annual US tax return of the company (Form 1120, with Form 5472 for foreign shareholders)", hinweis: "General statutory date for companies whose tax year is the calendar year. If the date falls on a weekend or public holiday, the next business day applies; an extension is available on application." },
  },
  de_llc: {
    de: { titel: "Jahressteuer des Bundesstaats Delaware", hinweis: "Delaware erhebt die Jahressteuer für das Vorjahr; einen Jahresbericht reichen LLCs dort nicht ein." },
    en: { titel: "Annual tax of the State of Delaware", hinweis: "Delaware charges the annual tax for the prior year; LLCs do not file an annual report there." },
  },
  de_corp: {
    de: { titel: "Jahresbericht und Franchise Tax des Bundesstaats Delaware", hinweis: "Delaware verlangt von Corporations den Jahresbericht und die Franchise Tax für das Vorjahr." },
    en: { titel: "Annual report and franchise tax of the State of Delaware", hinweis: "Delaware requires corporations to file the annual report and pay the franchise tax for the prior year." },
  },
  wy: {
    de: { titel: "Jahresbericht des Bundesstaats Wyoming", hinweis: "Wyoming erwartet den Jahresbericht am ersten Tag des Monats, in dem die Gesellschaft gegründet wurde." },
    en: { titel: "Annual report of the State of Wyoming", hinweis: "Wyoming expects the annual report on the first day of the month in which the company was formed." },
  },
  fl: {
    de: { titel: "Jahresbericht des Bundesstaats Florida", hinweis: "Florida nimmt den Jahresbericht vom Jahresbeginn an entgegen; der genannte Tag ist der letzte ohne Verspätungszuschlag." },
    en: { titel: "Annual report of the State of Florida", hinweis: "Florida accepts the annual report from the start of the year; the date shown is the last day without a late fee." },
  },
  agent: {
    de: { titel: "Verlängerung des Registered Agent", hinweis: "Der Registered Agent wird üblicherweise jährlich ab dem Gründungstag abgerechnet; den genauen Termin nennt Ihr Registered Agent. Eine US-Gesellschaft braucht durchgehend einen Registered Agent." },
    en: { titel: "Renewal of the registered agent", hinweis: "The registered agent is usually billed annually from the formation date; your registered agent states the exact date. A US company needs a registered agent at all times." },
  },
} satisfies Record<string, Record<BereichSprache, RegelText>>;

/**
 * Aus Bundesstaat, Gründungstag und Rechtsform entstehen die Fristen der
 * nächsten 18 Monate ab `heute` (beide Grenzen eingeschlossen). REIN: keine Uhr,
 * keine Datenbank. Ohne gültigen Gründungstag gibt es keine Fristen — ein
 * Kalender ohne Gesellschaft wäre erfunden.
 *
 * Andere Bundesstaaten als Delaware, Wyoming, Florida und New Mexico (LLC)
 * bekommen KEINE Staatsregel: Dort trägt die zuständige Person den Termin von
 * Hand ein (POST …/frist). Die US-Meldung und der Registered Agent gelten überall.
 */
export function globalPflichtFristen(
  ein: { bundesstaat?: string | null; gegruendetAm?: string | null; form?: string | null },
  heute: string,
  sprache: BereichSprache = "de",
): GlobalRegelFrist[] {
  if (!istIsoTag(ein.gegruendetAm) || !istIsoTag(heute)) return [];
  const gruendung = ein.gegruendetAm;
  const [gJahr, gMonat, gTag] = gruendung.split("-").map(Number);
  const staat = usBundesstaatCode(ein.bundesstaat);
  const corp = String(ein.form ?? "").trim().toLowerCase() === "corporation";
  const bis = isoPlusMonate(heute, GLOBAL_KALENDER_MONATE);
  const hJahr = Number(heute.slice(0, 4));
  const standard = GLOBAL_FRIST_STANDARDHINWEIS[sprache];
  const fristen: GlobalRegelFrist[] = [];
  const dazu = (regelKey: string, text: Record<BereichSprache, RegelText>, faelligAm: string) => {
    // Nur was im Fenster liegt — und nie ein Termin vor oder am Gründungstag.
    if (faelligAm < heute || faelligAm > bis || faelligAm <= gruendung) return;
    fristen.push({ regelKey, titel: text[sprache].titel, faelligAm, hinweis: `${text[sprache].hinweis} ${standard}` });
  };

  for (let jahr = hJahr; jahr <= hJahr + 2; jahr++) {
    // Alles hier betrifft das VORJAHR — also frühestens das Jahr nach der Gründung.
    if (jahr > gJahr) {
      dazu(`us_meldung:${jahr}`, corp ? REGEL_TEXTE.us_corp : REGEL_TEXTE.us_llc, `${jahr}-04-15`);
      if (staat === "DE") dazu(`staat:DE:${jahr}`, corp ? REGEL_TEXTE.de_corp : REGEL_TEXTE.de_llc, corp ? `${jahr}-03-01` : `${jahr}-06-01`);
      if (staat === "WY") dazu(`staat:WY:${jahr}`, REGEL_TEXTE.wy, `${jahr}-${zwei(gMonat)}-01`);
      if (staat === "FL") dazu(`staat:FL:${jahr}`, REGEL_TEXTE.fl, `${jahr}-05-01`);
      // New Mexico: LLCs melden dem Staat nichts Jährliches; für Corporations (Zweijahresbericht)
      // und alle übrigen Staaten gibt es bewusst keine Regel — Handeintrag.
      dazu(`agent:${jahr}`, REGEL_TEXTE.agent, tagIn(jahr, gMonat, gTag));
    }
  }
  return fristen.sort((a, b) => a.faelligAm.localeCompare(b.faelligAm) || a.regelKey.localeCompare(b.regelKey));
}

/**
 * Die Meldung der Gründung beim heimischen Finanzamt hat kein Datum, das FIAON
 * nennen dürfte (in Deutschland § 138 AO — Form und Frist nennt der
 * Steuerberater). Sie wird deshalb NICHT als Frist geführt, sondern als nächster
 * Schritt, sobald der Gründungstag eingetragen ist.
 */
export function globalHeimatMeldungSchritt(land: unknown, sprache: BereichSprache = "de"): string {
  const l = String(land ?? "").trim().toUpperCase();
  if (sprache === "en") {
    return l === "DE"
      ? "Report the formation of your US company to your tax office (in Germany under section 138 of the Fiscal Code) — your tax adviser tells you the form and the deadline."
      : "Report the formation of your US company to the tax authority in your country of residence — your tax adviser tells you the form and the deadline.";
  }
  return l === "DE"
    ? "Melden Sie die Gründung Ihrer US-Gesellschaft Ihrem Finanzamt (in Deutschland nach § 138 AO) — Form und Frist nennt Ihnen Ihr Steuerberater."
    : "Melden Sie die Gründung Ihrer US-Gesellschaft der Steuerbehörde Ihres Wohnsitzlandes — Form und Frist nennt Ihnen Ihr Steuerberater.";
}

// ── KLEINE TEXTE DER SEITE, DIE DER SERVER SCHREIBT ──────────────────────────
// Verlaufszeilen, die der Kunde liest. Sie entstehen in der Sprache des Auftrags.
export const GLOBAL_VERLAUF_TEXT = {
  de: {
    auftrag: (paket: string) => `Auftrag erteilt und unterschrieben — ${paket}.`,
    zahlung: "Zahlung eingegangen.",
    start: "Ihr Auftrag ist gestartet.",
    etappe: (nr: number, titel: string) => (nr >= GLOBAL_ETAPPE_MAX ? "Ihr Auftrag ist abgeschlossen." : `Etappe ${nr} hat begonnen: ${titel}.`),
    stichtag: (tag: string) => `Stichtag für Gesellschaft und EIN: ${tag}.`,
    schritt: (text: string) => `Nächster Schritt: ${text}`,
    gesellschaft: "Die Angaben zu Ihrer US-Gesellschaft wurden aktualisiert.",
    kalender: (n: number) => (n === 1 ? "Ihr Pflichtenkalender wurde um einen Termin ergänzt." : `Ihr Pflichtenkalender wurde um ${n} Termine ergänzt.`),
    fristNeu: (titel: string, tag: string) => `Neuer Termin im Pflichtenkalender: ${titel} — ${tag}.`,
    fristErledigt: (titel: string) => `Im Pflichtenkalender erledigt: ${titel}.`,
    dokumentKunde: (art: string, name: string) => `Sie haben ein Dokument hochgeladen: ${art} (${name}).`,
    dokumentFiaon: (art: string, name: string) => `FIAON hat ein Dokument für Sie bereitgestellt: ${art} (${name}).`,
    nachricht: (text: string) => `Ihre Nachricht: ${text}`,
    wiederOffen: "Ihr Auftrag wird weiter begleitet.",
  },
  en: {
    auftrag: (paket: string) => `Order placed and signed — ${paket}.`,
    zahlung: "Payment received.",
    start: "Your order has started.",
    etappe: (nr: number, titel: string) => (nr >= GLOBAL_ETAPPE_MAX ? "Your order is complete." : `Stage ${nr} has begun: ${titel}.`),
    stichtag: (tag: string) => `Agreed date for the company and the EIN: ${tag}.`,
    schritt: (text: string) => `Next step: ${text}`,
    gesellschaft: "The details of your US company have been updated.",
    kalender: (n: number) => (n === 1 ? "One date has been added to your compliance calendar." : `${n} dates have been added to your compliance calendar.`),
    fristNeu: (titel: string, tag: string) => `New date in your compliance calendar: ${titel} — ${tag}.`,
    fristErledigt: (titel: string) => `Completed in your compliance calendar: ${titel}.`,
    dokumentKunde: (art: string, name: string) => `You uploaded a document: ${art} (${name}).`,
    dokumentFiaon: (art: string, name: string) => `FIAON has provided a document for you: ${art} (${name}).`,
    nachricht: (text: string) => `Your message: ${text}`,
    wiederOffen: "Support for your order continues.",
  },
} as const;

/** „in rund einem Monat" / „in einer Woche" — der Abstand in Worten, nie als Ziffer mit Tagen (Global-Regel). */
export function globalFristAbstandText(marke: 30 | 7, sprache: BereichSprache = "de"): string {
  if (sprache === "en") return marke === 7 ? "in about a week" : "in about a month";
  return marke === 7 ? "in rund einer Woche" : "in rund einem Monat";
}

/** 17.09.2026 → „17.09.2026" bzw. „17 September 2026" — aus einem ISO-Tag, ohne Zeitzone. */
export function globalTagAlsText(iso: unknown, sprache: BereichSprache = "de"): string {
  if (!istIsoTag(iso)) return "—";
  const [j, m, t] = iso.split("-").map(Number);
  if (sprache === "en") {
    const MONATE = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${t} ${MONATE[m - 1]} ${j}`;
  }
  return `${zwei(t)}.${zwei(m)}.${j}`;
}
