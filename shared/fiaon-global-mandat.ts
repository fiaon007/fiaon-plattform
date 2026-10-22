// ═══════════════════════════════════════════════════════════════════════════
// DAS GLOBAL-MANDAT — gemeinsame Bausteine für Kundenportal und Chefbüro
// (E-338, 12.10.2026)
//
// Justin: „Die Firmenkunden brauchen ein PERFEKTES Dashboard … für ihre
//          Verträge, Status zur LLC, Infomaterial, Vollmachten, Unterlagen,
//          Anfragen … UND unser Admin Dashboard braucht eine Global Seite …
//          100 % synchron … und so, dass sich das NICHT vermischt."
//
// Die Akte bleibt `fiaon_global_auftraege` (eine Zeile je Auftrag, Schlüssel
// `ref`). Hier liegen nur die Wörter und Regeln, die Portal und Chefbüro
// teilen — damit beide Seiten dasselbe sagen:
//
//   · der FAHRPLAN in Schritten (unter den Etappen 0–5 aus fiaon-global-bereich),
//   · die KATEGORIEN des Dokumententresors (aus der Dokumentart abgeleitet),
//   · BANKEN & KAPITAL (Konto, Karte, Kreditrahmen, Darlehen) mit Status,
//   · die erweiterten GESELLSCHAFTSDATEN (EIN-Nummer, Registered Agent …).
//
// Bewusst NICHT im Fahrplan: die BOI-Meldung bei FinCEN. Seit der Regel vom
// 21.03.2025 sind in den USA gegründete Gesellschaften davon befreit — ein
// Schritt dafür würde Kunden nur beunruhigen.
//
// Feste Texte hier sind Hausworte: keine Zusagen von Ergebnissen, keine
// Institutsnamen (shared/fiaon-global-wortregeln.ts gilt).
// ═══════════════════════════════════════════════════════════════════════════
import type { BereichSprache } from "./fiaon-global-bereich";

type Paar = { de: string; en: string };
const t = (p: Paar, s: BereichSprache) => (s === "en" ? p.en : p.de);

// ── DER FAHRPLAN ─────────────────────────────────────────────────────────────
// 22.10.2026 (Stationen-Editor): „beantragt“ dazu — eine Behörde oder ein Institut hat den Antrag und
// entscheidet in eigener Frist (ITIN, EIN, Konto). Die Datenbank kennt den Wert seit Migration 123.
export type GlobalSchrittStatus = "offen" | "in_arbeit" | "beantragt" | "erledigt" | "entfaellt";
export const GLOBAL_SCHRITT_STATUS: GlobalSchrittStatus[] = ["offen", "in_arbeit", "beantragt", "erledigt", "entfaellt"];
export const GLOBAL_SCHRITT_STATUS_TEXT: Record<GlobalSchrittStatus, Paar> = {
  offen: { de: "Offen", en: "Open" },
  in_arbeit: { de: "In Arbeit", en: "In progress" },
  beantragt: { de: "Beantragt", en: "Applied for" },
  erledigt: { de: "Erledigt", en: "Done" },
  entfaellt: { de: "Entfällt", en: "Not needed" },
};

export interface GlobalSchrittVorlage {
  schluessel: string;
  /** Zu welcher Etappe (0–5) der Schritt gehört — das Portal ordnet ihn dort ein. */
  etappe: 1 | 2 | 3 | 4;
  titel: Paar;
  /** Ein Satz für den Kunden: was dieser Schritt ist. */
  text: Paar;
  /** Wird beim Erledigen ein Wert erfasst (z. B. die EIN)? Dann steht er in den Gesellschaftsdaten. */
  feld?: keyof GlobalGesellschaftPlus;
}

export const GLOBAL_FAHRPLAN: GlobalSchrittVorlage[] = [
  { schluessel: "name", etappe: 1, titel: { de: "Name geprüft", en: "Name checked" },
    text: { de: "Der Wunschname ist im Register des Bundesstaats frei und für Ihre Gesellschaft vorgesehen.", en: "The preferred name is available in the state register and set aside for your company." } },
  { schluessel: "articles", etappe: 1, titel: { de: "Gründung eingereicht", en: "Formation filed" },
    text: { de: "Die Gründungsunterlagen (Articles of Organization) liegen beim Bundesstaat.", en: "The formation documents (Articles of Organization) have been filed with the state." } },
  { schluessel: "eingetragen", etappe: 1, titel: { de: "Gesellschaft eingetragen", en: "Company registered" },
    text: { de: "Ihre Gesellschaft ist im Register eingetragen und aktiv.", en: "Your company is entered in the register and active." }, feld: "aktenzeichen" },
  { schluessel: "agent", etappe: 1, titel: { de: "Registered Agent bestellt", en: "Registered agent appointed" },
    text: { de: "Der Registered Agent nimmt amtliche Post für Ihre Gesellschaft im Bundesstaat entgegen.", en: "The registered agent receives official mail for your company in the state." }, feld: "registeredAgent" },
  { schluessel: "adresse", etappe: 1, titel: { de: "US-Adresse und Telefonnummer", en: "US address and phone number" },
    text: { de: "Ihre Gesellschaft hat eine Geschäftsadresse und eine Telefonnummer in den USA.", en: "Your company has a business address and a phone number in the US." }, feld: "usAdresse" },
  { schluessel: "ein", etappe: 1, titel: { de: "EIN der Gesellschaft", en: "Company EIN" },
    text: { de: "Die US-Steuerbehörde hat Ihrer Gesellschaft die Steuernummer (EIN) erteilt.", en: "The US tax authority has issued your company's tax number (EIN)." }, feld: "ein" },
  { schluessel: "operating_agreement", etappe: 1, titel: { de: "Operating Agreement unterschrieben", en: "Operating agreement signed" },
    text: { de: "Der Gesellschaftsvertrag Ihrer LLC ist unterschrieben und liegt in Ihrem Tresor.", en: "Your LLC's operating agreement is signed and stored in your vault." } },
  { schluessel: "itin", etappe: 1, titel: { de: "ITIN", en: "ITIN" },
    text: { de: "Die persönliche US-Steuernummer, wenn sie gebraucht wird. Die Behörde vergibt sie in eigener Frist.", en: "The personal US tax number, where it is needed. The authority issues it on its own timeline." } },
  { schluessel: "konto", etappe: 1, titel: { de: "US-Geschäftskonto", en: "US business account" },
    text: { de: "Das Geschäftskonto Ihrer Gesellschaft — beantragt, geprüft, eröffnet.", en: "Your company's business account — applied for, reviewed, opened." } },
  // 22.10.2026 (Stationen-Editor): nach dem Konto, vor den Karten — die Nummer im Firmenverzeichnis.
  { schluessel: "duns", etappe: 1, titel: { de: "D-U-N-S-Nummer", en: "D-U-N-S number" },
    text: { de: "Die Nummer Ihrer Gesellschaft im Firmenverzeichnis — die Grundlage für ein Firmenprofil in den USA.", en: "Your company's number in the business directory — the basis for a company profile in the US." }, feld: "duns" },
  { schluessel: "karte_1", etappe: 2, titel: { de: "Erste Firmenkarte", en: "First business card" },
    text: { de: "Der erste Kartenantrag Ihrer Gesellschaft — vorbereitet, gestellt, entschieden.", en: "Your company's first card application — prepared, submitted, decided." } },
  { schluessel: "kartenleiter", etappe: 3, titel: { de: "Weitere Firmenkarten", en: "Further business cards" },
    text: { de: "Die weiteren Kartenanträge in abgestimmter Reihenfolge.", en: "The further card applications in a coordinated order." } },
  { schluessel: "kreditrahmen", etappe: 4, titel: { de: "Kreditrahmen und Darlehen", en: "Credit line and loan" },
    text: { de: "Die Anträge für Kreditrahmen und Darlehen — vorbereitet und begleitet bis zur Entscheidung.", en: "The applications for credit lines and loans — prepared and supported until the decision." } },
];
const SCHRITT_NACH_KEY = new Map(GLOBAL_FAHRPLAN.map((s) => [s.schluessel, s]));
export function globalSchrittVorlage(schluessel: unknown): GlobalSchrittVorlage | null {
  return SCHRITT_NACH_KEY.get(String(schluessel ?? "")) ?? null;
}
export function globalSchrittStatus(v: unknown): GlobalSchrittStatus | null {
  const s = String(v ?? "").trim();
  return (GLOBAL_SCHRITT_STATUS as string[]).includes(s) ? (s as GlobalSchrittStatus) : null;
}
export function globalSchrittTitel(schluessel: string, s: BereichSprache = "de"): string {
  const v = SCHRITT_NACH_KEY.get(schluessel);
  return v ? t(v.titel, s) : schluessel;
}
export function globalSchrittText(schluessel: string, s: BereichSprache = "de"): string {
  const v = SCHRITT_NACH_KEY.get(schluessel);
  return v ? t(v.text, s) : "";
}

// ── DIE GESELLSCHAFT, ERWEITERT ──────────────────────────────────────────────
// Neben `gesellschaft` (Name, Form, Bundesstaat, gegründet, EIN ja/nein, ITIN)
// stehen in `fiaon_global_auftraege.gesellschaft_plus` die Angaben, die ein
// Kunde nachschlagen will: die Nummern und Adressen seiner Gesellschaft.
export interface GlobalGesellschaftPlus {
  /** Document Number / File Number im Register des Bundesstaats (Florida: z. B. L26000123456). */
  aktenzeichen?: string | null;
  /** EIN im Format 12-3456789. */
  ein?: string | null;
  registeredAgent?: string | null;
  usAdresse?: string | null;
  usTelefon?: string | null;
  /** Freier Satz für den Kunden, z. B. „Annual Report bis 1. Mai fällig“. */
  hinweis?: string | null;
  // ── Stationen-Editor (22.10.2026) — alles optional, alte Akten bleiben lesbar ──
  /** Datum des Bestätigungsschreibens der IRS zur EIN (CP 575), YYYY-MM-DD. */
  einBriefAm?: string | null;
  /** Anschrift des Registered Agent — NUR die Adresse; der Name des Anbieters steht nie beim Kunden. */
  agentAdresse?: string | null;
  /** Kontaktperson der Gesellschaft im Bundesstaat (Name). */
  kontaktperson?: string | null;
  /** Private US-Adresse des Kunden (mehrzeilig). */
  privatAdresse?: string | null;
  /** ITIN — NUR verschlüsselt (encryptSecret, v1:…). Geht nie an den Kunden oder in eine Liste. */
  itinEnc?: string | null;
  /** Die letzten vier Ziffern der ITIN — für die Maske •••-••-1234 ohne Entschlüsseln. */
  itinEnde?: string | null;
  /** Datum des IRS-Bescheids zur ITIN (CP 565), YYYY-MM-DD. */
  itinBescheidAm?: string | null;
  /** D-U-N-S-Nummer, neun Ziffern, geschrieben 12-345-6789. */
  duns?: string | null;
  /** Institut des Geschäftskontos — NUR intern (der Kunde sieht „Geschäftskonto eröffnet“). */
  kontoInstitut?: string | null;
  /** Tag der Kontoeröffnung, YYYY-MM-DD. */
  kontoEroeffnetAm?: string | null;
}
export const GLOBAL_GESELLSCHAFT_PLUS_FELDER: { feld: keyof GlobalGesellschaftPlus; titel: Paar; max: number }[] = [
  { feld: "aktenzeichen", titel: { de: "Registernummer (Document Number)", en: "Register number (document number)" }, max: 40 },
  { feld: "ein", titel: { de: "EIN (US-Steuernummer der Gesellschaft)", en: "EIN (company tax number)" }, max: 12 },
  { feld: "registeredAgent", titel: { de: "Registered Agent", en: "Registered agent" }, max: 200 },
  { feld: "usAdresse", titel: { de: "US-Geschäftsadresse", en: "US business address" }, max: 300 },
  { feld: "usTelefon", titel: { de: "US-Telefonnummer", en: "US phone number" }, max: 40 },
  { feld: "hinweis", titel: { de: "Hinweis für den Kunden", en: "Note for the client" }, max: 400 },
];
/** EIN: neun Ziffern, geschrieben 12-3456789. Alles andere → null (Fehler beim Speichern). */
export function globalEinFormat(roh: unknown): string | null {
  const z = String(roh ?? "").replace(/\D/g, "");
  return z.length === 9 ? `${z.slice(0, 2)}-${z.slice(2)}` : null;
}

// ── DER TRESOR: KATEGORIEN ───────────────────────────────────────────────────
// Die Kategorie folgt aus der Dokumentart — so bleibt jede bestehende Datei
// richtig einsortiert, ohne dass jemand nachträglich etwas ändern muss.
export type GlobalTresorKategorie =
  | "vertrag" | "vollmacht" | "gesellschaft" | "identitaet" | "unternehmen" | "bank" | "kapital" | "steuern" | "post" | "info" | "sonstiges";
export const GLOBAL_TRESOR: { kategorie: GlobalTresorKategorie; titel: Paar; text: Paar }[] = [
  { kategorie: "vertrag", titel: { de: "Vertrag und Rechnungen", en: "Contract and invoices" }, text: { de: "Ihr Auftrag, Anlagen, Rechnungen und Nachweise.", en: "Your order, annexes, invoices and supporting documents." } },
  { kategorie: "vollmacht", titel: { de: "Vollmachten und Unterschriften", en: "Powers of attorney and signatures" }, text: { de: "Was Sie unterschreiben — und was Sie unterschrieben haben.", en: "What you sign — and what you have signed." } },
  { kategorie: "gesellschaft", titel: { de: "Ihre US-Gesellschaft", en: "Your US company" }, text: { de: "Gründungsurkunde, EIN-Bestätigung, Operating Agreement.", en: "Formation certificate, EIN letter, operating agreement." } },
  { kategorie: "bank", titel: { de: "Bank und Konto", en: "Bank and account" }, text: { de: "Kontounterlagen und Verträge mit Banken.", en: "Account documents and bank agreements." } },
  { kategorie: "kapital", titel: { de: "Karten und Kapital", en: "Cards and capital" }, text: { de: "Kartenanträge, Zusagen, Kredit- und Finanzierungsverträge.", en: "Card applications, approvals, credit and financing agreements." } },
  { kategorie: "steuern", titel: { de: "Steuern und Pflichten", en: "Tax and compliance" }, text: { de: "Steuererklärungen, Bescheide, Jahresberichte.", en: "Tax returns, notices, annual reports." } },
  { kategorie: "post", titel: { de: "Eingegangene Post", en: "Incoming mail" }, text: { de: "Zustellungen und Behördenpost — in der Regel innerhalb eines Tages eingescannt; dazu fünf weitere Geschäftsbriefe je Jahr.", en: "Service of process and official mail — usually scanned within one day; five further business letters a year as well." } },
  { kategorie: "identitaet", titel: { de: "Ihre Nachweise", en: "Your identification" }, text: { de: "Reisepass und Adressnachweis.", en: "Passport and proof of address." } },
  { kategorie: "unternehmen", titel: { de: "Ihr Unternehmen", en: "Your business" }, text: { de: "Registerauszug, Gesellschafterliste, Beschreibung der Tätigkeit.", en: "Register extract, shareholder list, business description." } },
  { kategorie: "info", titel: { de: "Infomaterial", en: "Information" }, text: { de: "Leitfäden und Erklärungen für Ihre Gesellschaft.", en: "Guides and explanations for your company." } },
  { kategorie: "sonstiges", titel: { de: "Weitere Dokumente", en: "Other documents" }, text: { de: "Alles, was in keine andere Mappe passt.", en: "Everything that fits no other folder." } },
];
const KATEGORIE_NACH_ART: Record<string, GlobalTresorKategorie> = {
  reisepass: "identitaet", adressnachweis: "identitaet",
  registerauszug: "unternehmen", gesellschafterliste: "unternehmen", namenswunsch: "unternehmen", taetigkeitsbeschreibung: "unternehmen",
  gruendungsurkunde: "gesellschaft", ein_brief: "gesellschaft", operating_agreement: "gesellschaft", itin_bescheid: "gesellschaft",
  bank_unterlage: "bank", bank_vertrag: "bank",
  vollmacht: "vollmacht",
  kapital_vertrag: "kapital", karten_unterlage: "kapital",
  steuer: "steuern", jahresbericht: "steuern",
  post: "post", info: "info", sonstiges: "sonstiges",
};
export function globalTresorKategorie(art: unknown): GlobalTresorKategorie {
  return KATEGORIE_NACH_ART[String(art ?? "")] ?? "sonstiges";
}
export function globalTresorTitel(k: GlobalTresorKategorie, s: BereichSprache = "de"): string {
  const e = GLOBAL_TRESOR.find((x) => x.kategorie === k);
  return e ? t(e.titel, s) : k;
}

// Die Arten selbst stehen in GLOBAL_DOKUMENTARTEN (shared/fiaon-global-bereich.ts) — eine Liste für Office, Chefbüro und Portal.

// ── BANKEN & KAPITAL ─────────────────────────────────────────────────────────
export type GlobalKapitalArt = "konto" | "karte" | "kreditrahmen" | "darlehen" | "sonstiges";
export const GLOBAL_KAPITAL_ARTEN: { art: GlobalKapitalArt; titel: Paar }[] = [
  { art: "konto", titel: { de: "Geschäftskonto", en: "Business account" } },
  { art: "karte", titel: { de: "Firmenkarte", en: "Business card" } },
  { art: "kreditrahmen", titel: { de: "Kreditrahmen", en: "Credit line" } },
  { art: "darlehen", titel: { de: "Darlehen", en: "Loan" } },
  { art: "sonstiges", titel: { de: "Sonstige Finanzierung", en: "Other financing" } },
];
export type GlobalKapitalStatus = "vorbereitung" | "beantragt" | "in_pruefung" | "zugesagt" | "aktiv" | "abgelehnt" | "beendet";
export const GLOBAL_KAPITAL_STATUS: { status: GlobalKapitalStatus; titel: Paar; ton: "leise" | "blau" | "gruen" | "rot" }[] = [
  { status: "vorbereitung", titel: { de: "In Vorbereitung", en: "Being prepared" }, ton: "leise" },
  { status: "beantragt", titel: { de: "Beantragt", en: "Applied for" }, ton: "blau" },
  { status: "in_pruefung", titel: { de: "In Prüfung", en: "Under review" }, ton: "blau" },
  { status: "zugesagt", titel: { de: "Zugesagt", en: "Approved" }, ton: "gruen" },
  { status: "aktiv", titel: { de: "Aktiv", en: "Active" }, ton: "gruen" },
  { status: "abgelehnt", titel: { de: "Abgelehnt", en: "Declined" }, ton: "rot" },
  { status: "beendet", titel: { de: "Beendet", en: "Closed" }, ton: "leise" },
];
export function globalKapitalArt(v: unknown): GlobalKapitalArt | null {
  const s = String(v ?? "");
  return GLOBAL_KAPITAL_ARTEN.some((a) => a.art === s) ? (s as GlobalKapitalArt) : null;
}
export function globalKapitalStatus(v: unknown): GlobalKapitalStatus | null {
  const s = String(v ?? "");
  return GLOBAL_KAPITAL_STATUS.some((a) => a.status === s) ? (s as GlobalKapitalStatus) : null;
}
export function globalKapitalArtTitel(a: string, s: BereichSprache = "de"): string {
  const e = GLOBAL_KAPITAL_ARTEN.find((x) => x.art === a);
  return e ? t(e.titel, s) : a;
}
export function globalKapitalStatusTitel(st: string, s: BereichSprache = "de"): string {
  const e = GLOBAL_KAPITAL_STATUS.find((x) => x.status === st);
  return e ? t(e.titel, s) : st;
}
/** Zählt für „zugesagter Rahmen“: zugesagt oder aktiv, Art Karte/Kreditrahmen/Darlehen. */
export function globalKapitalZaehlt(art: string, status: string): boolean {
  return (status === "zugesagt" || status === "aktiv") && (art === "karte" || art === "kreditrahmen" || art === "darlehen");
}

/** Betrag in US-Cent → „$ 25.000“ (de) / „$25,000“ (en). */
export function globalUsd(cents: number | null | undefined, s: BereichSprache = "de"): string {
  const n = Math.round(Number(cents || 0) / 100);
  return s === "en" ? `$${n.toLocaleString("en-GB")}` : `$ ${n.toLocaleString("de-DE")}`;
}

// ── DER NAME EINES ANGEBOTS-KUNDEN (22.10.2026) ──────────────────────────────
// Die Angebote speichern `kunde` je Art verschieden: Individual-/Begleitangebot mit vorname/nachname, Firmen- und
// Kapitalangebot mit `firma: { name, marke }` und `vertretung: { anrede, vorname, nachname }`, die Kooperation mit
// `firma` als Text — und ältere Zeilen als doppelt kodierten JSON-Text. Die Leiste „Angebote in Arbeit“ schrieb
// String(k.firma) und zeigte „[object Object]“. Hier die EINE Auflösung: Person (Name) und Firma (Text).
export function globalAngebotKundeAnzeige(roh: unknown): { name: string; firma: string | null } {
  let k: unknown = roh;
  for (let i = 0; i < 2 && typeof k === "string"; i++) { try { k = JSON.parse(k); } catch { break; } }
  const o = k && typeof k === "object" ? (k as Record<string, any>) : {};
  const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim() : "");
  const v = o.vertretung && typeof o.vertretung === "object" ? o.vertretung : null;
  const person = [v?.vorname ?? o.vorname, v?.nachname ?? o.nachname].map(text).filter(Boolean).join(" ") || text(o.name);
  const firma = o.firma && typeof o.firma === "object" ? text(o.firma.name) || text(o.firma.marke) : text(o.firma);
  return { name: person || firma || "—", firma: firma || null };
}
